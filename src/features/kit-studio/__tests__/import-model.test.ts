/**
 * Aller-retour de l'importateur de modèle externe (préparation Meshy).
 *
 * On fabrique ici un GLB qui a les défauts typiques d'un modèle image-vers-3D — un seul objet, deux
 * primitives séparées par matériau, une primitive non indexée, une transformation de nœud, une
 * échelle arbitraire, une orientation tournée, des matériaux et une image cuits — puis on vérifie
 * que `import-model.mjs` le ramène aux conventions du Studio et que `loadBagAsset` sait le charger.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadBagAsset, type BagAssetProvider } from '../scene/bag/loader';
import type { BagManifest } from '../scene/bag/parts';

const ALIGN = (n: number) => (n % 4 ? n + (4 - (n % 4)) : n);

/** Assemble un GLB à la main, pour contrôler exactement ses défauts. */
function buildFakeImportedGlb(): Buffer {
  // Corps : non indexé, comme beaucoup de sorties de maillage automatique.
  const body = new THREE.BoxGeometry(0.4, 1.2, 0.3).toNonIndexed();
  // Poche avant : indexée, décalée vers +Z pour rendre la profondeur asymétrique et pouvoir
  // vérifier que la rotation de cap est bien appliquée. Elle reste en deçà de la largeur du corps
  // (profondeur totale 0,37 m contre 0,40 m de large), sans quoi le test de cap ne prouverait rien.
  const pocket = new THREE.BoxGeometry(0.2, 0.3, 0.1);
  pocket.translate(0, 0.45, 0.17);

  const views: { data: Float32Array | Uint16Array; target?: number }[] = [];
  const accessors: Record<string, unknown>[] = [];

  const push = (
    data: Float32Array | Uint16Array,
    type: string,
    count: number,
    target?: number,
    minmax?: { min: number[]; max: number[] }
  ) => {
    views.push({ data, target });
    accessors.push({
      bufferView: views.length - 1,
      componentType: data instanceof Float32Array ? 5126 : 5123,
      count,
      type,
      ...(minmax ?? {}),
    });
    return accessors.length - 1;
  };

  const bounds = (g: THREE.BufferGeometry) => {
    g.computeBoundingBox();
    const b = g.boundingBox!;
    return { min: [b.min.x, b.min.y, b.min.z], max: [b.max.x, b.max.y, b.max.z] };
  };

  const bodyPos = push(
    body.getAttribute('position').array as Float32Array, 'VEC3',
    body.getAttribute('position').count, 34962, bounds(body)
  );
  const bodyNrm = push(
    body.getAttribute('normal').array as Float32Array, 'VEC3',
    body.getAttribute('normal').count, 34962
  );
  const pocketPos = push(
    pocket.getAttribute('position').array as Float32Array, 'VEC3',
    pocket.getAttribute('position').count, 34962, bounds(pocket)
  );
  const pocketNrm = push(
    pocket.getAttribute('normal').array as Float32Array, 'VEC3',
    pocket.getAttribute('normal').count, 34962
  );
  const pocketIdx = push(
    new Uint16Array(pocket.getIndex()!.array), 'SCALAR', pocket.getIndex()!.count, 34963
  );

  // Disposition du binaire, aligné sur 4 octets.
  let offset = 0;
  const bufferViews = views.map((v) => {
    const byteOffset = ALIGN(offset);
    const byteLength = v.data.byteLength;
    offset = byteOffset + byteLength;
    return { buffer: 0, byteOffset, byteLength, ...(v.target ? { target: v.target } : {}) };
  });
  const binLength = ALIGN(offset);
  const bin = Buffer.alloc(binLength);
  views.forEach((v, i) => {
    Buffer.from(v.data.buffer, v.data.byteOffset, v.data.byteLength)
      .copy(bin, bufferViews[i].byteOffset);
  });

  // Échelle arbitraire (×100) et cap tourné de +90° autour de Y : les deux défauts que
  // l'importateur doit corriger.
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);

  const json = {
    asset: { version: '2.0', generator: 'faux-maillage-automatique' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'Object_0', mesh: 0, scale: [100, 100, 100], rotation: [q.x, q.y, q.z, q.w] }],
    meshes: [{
      name: 'Object_0',
      primitives: [
        { attributes: { POSITION: bodyPos, NORMAL: bodyNrm }, material: 0, mode: 4 },
        { attributes: { POSITION: pocketPos, NORMAL: pocketNrm }, indices: pocketIdx, material: 1, mode: 4 },
      ],
    }],
    // Matière cuite : exactement ce que l'importateur doit ignorer.
    materials: [
      { name: 'mat_0', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, baseColorFactor: [0.3, 0.35, 0.2, 1] } },
      { name: 'mat_1', pbrMetallicRoughness: { baseColorFactor: [0.1, 0.1, 0.1, 1] } },
    ],
    textures: [{ source: 0 }],
    images: [{ mimeType: 'image/png', uri: 'texture_diffuse.png' }],
    accessors,
    bufferViews,
    buffers: [{ byteLength: binLength }],
  };

  const jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPad = Buffer.alloc(ALIGN(jsonBuf.length) - jsonBuf.length, 0x20);
  const jsonChunk = Buffer.concat([jsonBuf, jsonPad]);

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + bin.length, 8);

  const jsonHead = Buffer.alloc(8);
  jsonHead.writeUInt32LE(jsonChunk.length, 0);
  jsonHead.writeUInt32LE(0x4e4f534a, 4);

  const binHead = Buffer.alloc(8);
  binHead.writeUInt32LE(bin.length, 0);
  binHead.writeUInt32LE(0x004e4942, 4);

  return Buffer.concat([header, jsonHead, jsonChunk, binHead, bin]);
}

const HEIGHT_M = 0.62;
const CAPACITY_L = 45;
const MODEL_ID = 'test-modele-importe';

let tmpDir = '';
let outDir = '';
let stdout = '';

const provider: BagAssetProvider = {
  async fetchManifest(modelId: string): Promise<BagManifest> {
    return JSON.parse(fs.readFileSync(path.join(outDir, `${modelId}.manifest.json`), 'utf8'));
  },
  async fetchGlb(modelId: string): Promise<ArrayBuffer> {
    const buf = fs.readFileSync(path.join(outDir, `${modelId}.glb`));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  },
};

describe('Importateur de modèle externe vers le Kit Studio', () => {
  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lkdv-import-'));
    outDir = path.join(tmpDir, 'out');
    const input = path.join(tmpDir, 'faux-meshy.glb');
    fs.writeFileSync(input, buildFakeImportedGlb());

    stdout = execFileSync(
      process.execPath,
      [
        path.join(process.cwd(), 'tools', 'bag-generator', 'import-model.mjs'),
        '--in', input,
        '--model-id', MODEL_ID,
        '--label', 'Modèle importé de test',
        '--height', String(HEIGHT_M),
        '--capacity', String(CAPACITY_L),
        '--yaw', '-90',
        '--out', outDir,
      ],
      { encoding: 'utf8' }
    );
  });

  afterAll(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('ignore les matériaux et les images cuits dans le fichier, et le dit', () => {
    expect(stdout).toMatch(/2 matériau\(x\), 1 image\(s\)/);
  });

  it('écrit les trois sorties attendues', () => {
    expect(fs.existsSync(path.join(outDir, `${MODEL_ID}.glb`))).toBe(true);
    expect(fs.existsSync(path.join(outDir, `${MODEL_ID}.manifest.json`))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'bags.index.entry.json'))).toBe(true);
  });

  it('ramène le modèle à la hauteur réelle demandée, quelle que soit son échelle d’origine', async () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(outDir, `${MODEL_ID}.manifest.json`), 'utf8')
    ) as BagManifest;
    // L'entrée faisait 120 unités de haut (1,2 × 100) : seule la hauteur réelle commande.
    expect(manifest.boundingBoxM.h).toBeCloseTo(HEIGHT_M, 3);
    expect(manifest.units).toBe('meters');
  });

  it('corrige le cap : le sac est plus large que profond, pas l’inverse', async () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(outDir, `${MODEL_ID}.manifest.json`), 'utf8')
    ) as BagManifest;
    expect(manifest.boundingBoxM.w).toBeGreaterThan(manifest.boundingBoxM.d);
  });

  it('n’annonce aucune capacité que le maillage ne porte pas (honnêteté C-13)', async () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(outDir, `${MODEL_ID}.manifest.json`), 'utf8')
    ) as BagManifest;
    expect(manifest.capabilities.openable).toBe(false);
    expect(manifest.capabilities.hasInterior).toBe(false);
    expect(manifest.capabilities.badgeAnchors).toEqual([]);
    expect(manifest.capabilities.attachmentPoints).toEqual([]);
    expect(manifest.slots).toEqual([]);
    expect(manifest.capabilities.customizableParts).toEqual(['body']);
  });

  it('se charge par loadBagAsset, avec ses deux primitives fusionnées et des UV en mètres', async () => {
    const loaded = await loadBagAsset(MODEL_ID, provider);
    expect(loaded.status).toBe('ready');
    if (loaded.status !== 'ready') return;

    const body = loaded.parts.get('body');
    expect(body).toBeDefined();

    // Les deux primitives sont bien là : 12 triangles pour le corps + 12 pour la poche.
    expect(body!.geometry.getIndex()!.count / 3).toBe(24);

    const uv = body!.geometry.getAttribute('uv');
    expect(uv).toBeDefined();
    expect(uv.itemSize).toBe(2);
    expect(uv.count).toBe(body!.geometry.getAttribute('position').count);

    // UV en mètres : l'amplitude reste de l'ordre des dimensions du sac, pas de 0..1.
    let max = 0;
    for (let i = 0; i < uv.count; i++) {
      max = Math.max(max, Math.abs(uv.getX(i)), Math.abs(uv.getY(i)));
    }
    expect(max).toBeGreaterThan(0.1);
    expect(max).toBeLessThan(2);
  });

  it('refuse un modèle hors budget de triangles au lieu de le livrer', () => {
    const input = path.join(tmpDir, 'faux-meshy.glb');
    expect(() =>
      execFileSync(
        process.execPath,
        [
          path.join(process.cwd(), 'tools', 'bag-generator', 'import-model.mjs'),
          '--in', input,
          '--model-id', 'test-hors-budget',
          '--label', 'Hors budget',
          '--height', String(HEIGHT_M),
          '--capacity', String(CAPACITY_L),
          '--max-tri', '10',
          '--out', outDir,
        ],
        { encoding: 'utf8', stdio: 'pipe' }
      )
    ).toThrow();
  });
});
