#!/usr/bin/env node
/**
 * LKDV — Importateur de modèle 3D externe vers le format du Kit Studio.
 *
 * Prend un GLB produit ailleurs (Meshy image-vers-3D, à partir des 4 vues d'un sac LKDV ONE) et
 * le ramène aux conventions que le Studio sait charger : mètres, origine au centre du sol, +Y en
 * haut, +Z vers l'utilisateur, une pièce nommée, un manifeste, une entrée d'index.
 *
 * PARTI PRIS : on garde la GÉOMÉTRIE, on jette la MATIÈRE.
 * Un modèle image-vers-3D arrive avec un atlas de texture où tout est mélangé — tissu, fermetures,
 * sangles, écusson — et une couleur cuite dedans. Le Studio, lui, laisse choisir une matière ET une
 * couleur, appliquées à l'exécution. Cuire un coloris obligerait à générer un modèle par
 * combinaison (5 sacs x 5 matières x 8 nuances = 200). On ignore donc les matériaux et les images du
 * fichier, et l'apparence vient de `scene/bag/fabricMaps.ts` et des tokens.
 *
 * Conséquence sur les UV : l'atlas d'un modèle importé n'a ni échelle ni orientation homogènes, donc
 * une trame de tissu y serait déformée d'une région à l'autre. On remplace les UV par une
 * PROJECTION EN BOÎTE exprimée en mètres, comme celles du générateur : le tissu garde alors la même
 * échelle physique partout sur le sac. Les coutures de projection sont invisibles sur une armure
 * régulière.
 *
 * Usage :
 *   node tools/bag-generator/import-model.mjs \
 *     --in ~/Downloads/meshy-b45.glb --model-id lkdv-one-45 \
 *     --label "LKDV ONE 45 L" --height 0.62 --capacity 45 --out ./out
 *
 * Options :
 *   --in <fichier>       GLB d'entrée (obligatoire)
 *   --model-id <id>      identifiant du modèle, en minuscules-tiret (obligatoire)
 *   --label <texte>      nom affiché (obligatoire)
 *   --height <m>         hauteur réelle du sac en mètres : fixe l'échelle (obligatoire)
 *   --capacity <L>       capacité déclarée en litres (obligatoire)
 *   --out <dossier>      dossier de sortie (défaut ./out)
 *   --up y|z             axe haut du fichier d'entrée (défaut y, la norme glTF)
 *   --yaw <degres>       rotation autour de Y pour mettre la face vers +Z (défaut 0)
 *   --max-tri <n>        plafond de triangles (défaut 40000, le budget de l'index)
 *
 * Sorties : <out>/<modelId>.glb, <out>/<modelId>.manifest.json, <out>/bags.index.entry.json
 */

import * as THREE from 'three';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { writeGLB } from './glb-writer.mjs';

// ---------------------------------------------------------------- lecture GLB

const COMPONENT = {
  5120: Int8Array,
  5121: Uint8Array,
  5122: Int16Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array,
};
const ITEMS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

/** Découpe un GLB binaire en sa partie JSON et sa partie binaire. */
function parseGlb(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('Ce fichier n’est pas un GLB (magic absent)');
  const total = dv.getUint32(8, true);
  let p = 12;
  let json = null;
  let bin = null;
  while (p < total) {
    const len = dv.getUint32(p, true);
    const type = dv.getUint32(p + 4, true);
    const start = p + 8;
    if (type === 0x4e4f534a) json = JSON.parse(Buffer.from(buf.buffer, buf.byteOffset + start, len).toString('utf8'));
    else if (type === 0x004e4942) bin = Buffer.from(buf.buffer, buf.byteOffset + start, len);
    p = start + len + (len % 4 ? 4 - (len % 4) : 0);
  }
  if (!json) throw new Error('Morceau JSON absent du GLB');
  return { json, bin };
}

/** Lit un accesseur glTF en tableau typé. Les accesseurs creux ne sont pas pris en charge. */
function readAccessor(json, bin, index) {
  const acc = json.accessors?.[index];
  if (!acc) throw new Error(`Accesseur ${index} introuvable`);
  if (acc.sparse) throw new Error(`Accesseur ${index} creux : non pris en charge`);
  const items = ITEMS[acc.type];
  const Ctor = COMPONENT[acc.componentType];
  if (!items || !Ctor) throw new Error(`Accesseur ${index} : type ${acc.type}/${acc.componentType} inconnu`);
  const view = json.bufferViews?.[acc.bufferView];
  if (!view) throw new Error(`Accesseur ${index} sans bufferView`);
  if (!bin) throw new Error('Morceau binaire absent : les buffers externes ne sont pas pris en charge');

  const base = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const count = acc.count * items;
  const stride = view.byteStride;
  const bytes = Ctor.BYTES_PER_ELEMENT;

  if (!stride || stride === items * bytes) {
    // Compact : une seule copie.
    const out = new Ctor(acc.count * items);
    const src = new Ctor(bin.buffer, bin.byteOffset + base, count);
    out.set(src);
    return { array: out, itemSize: items };
  }
  // Entrelacé : on dé-entrelace élément par élément.
  const out = new Ctor(acc.count * items);
  const dv = new DataView(bin.buffer, bin.byteOffset);
  const get = {
    5120: (o) => dv.getInt8(o),
    5121: (o) => dv.getUint8(o),
    5122: (o) => dv.getInt16(o, true),
    5123: (o) => dv.getUint16(o, true),
    5125: (o) => dv.getUint32(o, true),
    5126: (o) => dv.getFloat32(o, true),
  }[acc.componentType];
  for (let i = 0; i < acc.count; i++) {
    for (let k = 0; k < items; k++) out[i * items + k] = get(base + i * stride + k * bytes);
  }
  return { array: out, itemSize: items };
}

/**
 * Rassemble toutes les primitives de toutes les mailles du fichier en une géométrie unique,
 * transformations de nœuds appliquées. Un sac importé est un objet, pas un assemblage de pièces
 * nommées : c'est la limite assumée de cette voie (voir le compte rendu).
 */
function collectGeometry(json, bin) {
  const positions = [];
  const normals = [];
  const indices = [];
  let dropped = 0;

  const walk = (nodeIdx, parentMatrix) => {
    const node = json.nodes?.[nodeIdx];
    if (!node) return;
    const local = new THREE.Matrix4();
    if (node.matrix) {
      local.fromArray(node.matrix);
    } else {
      const t = new THREE.Vector3().fromArray(node.translation ?? [0, 0, 0]);
      const q = new THREE.Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]);
      const s = new THREE.Vector3().fromArray(node.scale ?? [1, 1, 1]);
      local.compose(t, q, s);
    }
    const world = new THREE.Matrix4().multiplyMatrices(parentMatrix, local);

    if (node.mesh !== undefined && json.meshes?.[node.mesh]) {
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(world);
      for (const prim of json.meshes[node.mesh].primitives ?? []) {
        if (prim.mode !== undefined && prim.mode !== 4) { dropped += 1; continue; } // triangles seuls
        if (prim.attributes?.POSITION === undefined) { dropped += 1; continue; }

        const pos = readAccessor(json, bin, prim.attributes.POSITION);
        const vertexCount = pos.array.length / pos.itemSize;
        const base = positions.length / 3;

        const v = new THREE.Vector3();
        for (let i = 0; i < vertexCount; i++) {
          v.set(pos.array[i * 3], pos.array[i * 3 + 1], pos.array[i * 3 + 2]).applyMatrix4(world);
          positions.push(v.x, v.y, v.z);
        }

        if (prim.attributes.NORMAL !== undefined) {
          const nrm = readAccessor(json, bin, prim.attributes.NORMAL);
          const n = new THREE.Vector3();
          for (let i = 0; i < vertexCount; i++) {
            n.set(nrm.array[i * 3], nrm.array[i * 3 + 1], nrm.array[i * 3 + 2])
              .applyMatrix3(normalMatrix).normalize();
            normals.push(n.x, n.y, n.z);
          }
        } else {
          for (let i = 0; i < vertexCount; i++) normals.push(0, 0, 0); // recalculé plus bas
        }

        if (prim.indices !== undefined) {
          const idx = readAccessor(json, bin, prim.indices);
          for (let i = 0; i < idx.array.length; i++) indices.push(idx.array[i] + base);
        } else {
          for (let i = 0; i < vertexCount; i++) indices.push(base + i);
        }
      }
    }
    for (const child of node.children ?? []) walk(child, world);
  };

  const scene = json.scenes?.[json.scene ?? 0];
  for (const nodeIdx of scene?.nodes ?? []) walk(nodeIdx, new THREE.Matrix4());

  if (positions.length === 0) throw new Error('Aucune géométrie triangulée trouvée dans le fichier');

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
  geometry.setIndex(
    positions.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(indices, 1)
      : new THREE.Uint16BufferAttribute(indices, 1)
  );
  return { geometry, dropped };
}

// ------------------------------------------------------------ normalisation

/**
 * Remplace les UV par une projection en boîte exprimée en mètres : pour chaque triangle, on projette
 * sur le plan perpendiculaire à l'axe dominant de sa normale. Le tissu garde ainsi la même échelle
 * physique sur tout le sac, ce qu'un atlas importé ne garantit pas.
 */
function boxProjectUvs(geometry) {
  const pos = geometry.getAttribute('position');
  const nrm = geometry.getAttribute('normal');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ax = Math.abs(nrm.getX(i)), ay = Math.abs(nrm.getY(i)), az = Math.abs(nrm.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = x; v = z; }        // dessus / dessous
    else if (ax >= az) { u = z; v = y; }               // flancs
    else { u = x; v = y; }                             // face / dos
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function normalize(geometry, { up, yawDeg, height }) {
  // 1. Axe haut : un export Z-up se redresse par une rotation de -90° autour de X.
  if (up === 'z') geometry.rotateX(-Math.PI / 2);
  // 2. Orientation de la face.
  if (yawDeg) geometry.rotateY((yawDeg * Math.PI) / 180);

  // 3. Échelle : la hauteur réelle du sac commande, c'est la seule mesure fiable qu'on ait.
  geometry.computeBoundingBox();
  let box = geometry.boundingBox;
  const size = box.getSize(new THREE.Vector3());
  if (size.y <= 1e-6) throw new Error('Modèle plat sur l’axe Y : vérifiez --up');
  const scale = height / size.y;
  geometry.scale(scale, scale, scale);

  // 4. Origine : centre du sol, y = 0 au fond.
  geometry.computeBoundingBox();
  box = geometry.boundingBox;
  const center = box.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -box.min.y, -center.z);

  geometry.computeBoundingBox();
  const finalSize = geometry.boundingBox.getSize(new THREE.Vector3());
  return { scale, size: finalSize };
}

// ------------------------------------------------------------------- sortie

function round(n, d = 4) { const f = 10 ** d; return Math.round(n * f) / f; }

function parseArgs(argv) {
  const get = (flag, fallback) => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
  };
  const args = {
    in: get('--in'),
    modelId: get('--model-id'),
    label: get('--label'),
    height: Number(get('--height', NaN)),
    capacity: Number(get('--capacity', NaN)),
    out: get('--out', './out'),
    up: get('--up', 'y'),
    yaw: Number(get('--yaw', 0)),
    maxTri: Number(get('--max-tri', 40000)),
  };
  const missing = [];
  if (!args.in) missing.push('--in');
  if (!args.modelId) missing.push('--model-id');
  if (!args.label) missing.push('--label');
  if (!Number.isFinite(args.height) || args.height <= 0) missing.push('--height');
  if (!Number.isFinite(args.capacity) || args.capacity <= 0) missing.push('--capacity');
  if (missing.length) {
    throw new Error(`Options manquantes : ${missing.join(', ')}\nVoir l’en-tête du fichier pour l’usage.`);
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(args.modelId)) {
    throw new Error(`--model-id "${args.modelId}" doit être en minuscules-tiret (ex. lkdv-one-45)`);
  }
  if (args.up !== 'y' && args.up !== 'z') throw new Error('--up doit valoir y ou z');
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = readFileSync(args.in);
  const { json, bin } = parseGlb(input);

  const imagesIgnored = (json.images ?? []).length;
  const materialsIgnored = (json.materials ?? []).length;

  const { geometry, dropped } = collectGeometry(json, bin);
  const hadNormals = geometry.getAttribute('normal').array.some((v) => v !== 0);
  if (!hadNormals) geometry.computeVertexNormals();

  const { scale, size } = normalize(geometry, { up: args.up, yawDeg: args.yaw, height: args.height });
  boxProjectUvs(geometry);

  const triangles = geometry.getIndex().count / 3;

  console.log(`entrée      : ${args.in}`);
  console.log(`modèle      : ${args.modelId} — ${args.label}`);
  console.log(`triangles   : ${triangles}`);
  console.log(`échelle     : ×${round(scale, 5)} pour une hauteur de ${args.height} m`);
  console.log(`encombrement: l ${round(size.x)} × h ${round(size.y)} × p ${round(size.z)} m`);
  console.log(`ignoré      : ${materialsIgnored} matériau(x), ${imagesIgnored} image(s)` +
    (dropped ? `, ${dropped} primitive(s) non triangulée(s)` : ''));

  // Garde-fou honnête : on refuse plutôt que de livrer un sac hors budget. La décimation se fait à
  // l'export du générateur amont (Meshy a un réglage de nombre de polygones), pas ici.
  if (triangles > args.maxTri) {
    console.error(
      `\nREFUS : ${triangles} triangles pour un plafond de ${args.maxTri}.\n` +
      `Ré-exportez le modèle avec moins de polygones, ou relevez --max-tri en connaissance de cause\n` +
      `(l'index du Studio valide à 40 000 triangles et 900 Ko).`
    );
    process.exit(1);
  }
  if (size.y < size.x && size.y < size.z) {
    console.warn('\nATTENTION : le modèle est plus large et plus profond que haut. Un sac à dos ne l’est ' +
      'normalement pas — vérifiez --up et --yaw avant de livrer.');
  }

  const root = new THREE.Object3D();
  root.name = `bag:${args.modelId}`;
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.02 }));
  // Une seule pièce nommée : le Studio sait personnaliser « body », et son tiroir affiche un état
  // indisponible explicite pour tout le reste tant que le maillage n'est pas découpé (D-07).
  mesh.name = 'body';
  root.add(mesh);

  mkdirSync(args.out, { recursive: true });
  const glb = writeGLB(root, { generator: 'LKDV import-model.mjs' });
  const glbPath = join(args.out, `${args.modelId}.glb`);
  writeFileSync(glbPath, glb);

  const manifest = {
    schema: 1,
    modelId: args.modelId,
    label: args.label,
    generator: 'import-model.mjs',
    generatedBy: 'imported',
    license: 'LKDV — maillage importé, matière et couleur appliquées par le Studio',
    units: 'meters',
    origin: 'centre du sol du sac (y=0 au fond)',
    capabilities: {
      rotatable: true,
      // Honnêteté C-13 : rien n'est annoncé qui ne soit dans le maillage. Un modèle importé n'a ni
      // charnière, ni intérieur, ni ancrage : ces capacités viendront du découpage en pièces.
      openable: false,
      hasInterior: false,
      customizableParts: ['body'],
      badgeAnchors: [],
      attachmentPoints: [],
    },
    hasHinge: false,
    declaredCapacityL: args.capacity,
    boundingBoxM: { w: round(size.x), h: round(size.y), d: round(size.z) },
    slots: [],
    budget: { triangles, fileBytes: glb.length },
  };
  writeFileSync(join(args.out, `${args.modelId}.manifest.json`), JSON.stringify(manifest, null, 2));

  const entry = {
    modelId: args.modelId,
    label: args.label,
    triangles,
    bytes: glb.length,
    openable: false,
    parts: 1,
    slots: 0,
    valid: triangles <= args.maxTri && glb.length <= 900 * 1024,
  };
  writeFileSync(join(args.out, 'bags.index.entry.json'), JSON.stringify(entry, null, 2));

  console.log(`\nécrit       : ${glbPath} (${Math.round(glb.length / 1024)} Ko)`);
  console.log(`              ${join(args.out, `${args.modelId}.manifest.json`)}`);
  console.log(`              ${join(args.out, 'bags.index.entry.json')}`);
  console.log('\nÀ faire ensuite : copier le .glb et le .manifest.json dans public/assets/bags/,');
  console.log('puis ajouter l’entrée d’index au tableau "models" de bags.index.json.');
}

main();
