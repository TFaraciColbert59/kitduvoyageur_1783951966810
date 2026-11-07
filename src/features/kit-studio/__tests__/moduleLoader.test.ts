// @vitest-environment jsdom
/**
 * src/features/kit-studio/__tests__/moduleLoader.test.ts
 * Vérification complète du chemin des modules 3D (§ 4 + Avenant Lot I-D final) :
 * 1. Platine mécanique standard à deux pieds (jamais quatre).
 * 2. Les 15 modules maillés `.glb` (`M01..M08, M13, M15..M20`) :
 *    - moins de 400 Ko par module en 512² ;
 *    - moins de 700 Ko pour M05, M17 et M20 en 1024² ;
 *    - géométrie intacte (8 568 à 11 733 triangles).
 * 3. Zéro rotation ni mise à l'échelle ajoutée au chargement (facteur 1, rotation 0) :
 *    - M04, M05 et M16 portent déjà exactement Y = 180° dans leur matrice racine, et l'échelle
 *      métrique y est cuite aussi ;
 *    - leur façade fonctionnelle sort bien en +Z après chargement.
 * 4. Les 6 ancres auditées (`LKDV_ONE_AUDITED_ANCHORS`) :
 *    - une par sac (`facade`), deux sur le 80 L (`facade` et `flanc-droit`) ;
 *    - suppression du dos, du dessous, du dessus (`top-lid`) et des flancs des 4 petits sacs ;
 *    - refus d'ancre occupée annoncé explicitement à l'utilisateur (`userMessage` + `bagModelNotice`).
 * 5. Filtrage géométrique du catalogue par sac (garde de 15 % au bord) :
 *    - 5 modules refusés sur le 15 L (`M05, M13, M17, M19, M20`, 10 acceptés sur 15) ;
 *    - 4 modules refusés sur le 25 L (`M05, M13, M17, M20`, `M19` accepté, 11 acceptés sur 15) ;
 *    - 15/15 acceptés sur 45 L, 60 L et 80 L.
 * 6. Cohabitation des deux origines (15 `.glb` importés + 5 procéduraux `M09, M10, M11, M12, M14`
 *    à panneaux rigides de 3,5 mm par convention de projet) sur les mêmes ancres et la même platine.
 */

import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { BagManifest } from '../domain/bagModel';
import {
  LKDV_ONE_AUDITED_ANCHORS,
  LKDV_ONE_PROVISIONAL_ANCHORS,
  MODULE_FACE_MARGIN_RATIO,
  doesModuleFitBag,
  filterCompatibleModulesForBag,
  resolveBagAttachmentAnchors,
} from '../domain/bagAnchorsTable';
import {
  AVAILABLE_3D_MODULE_MANIFESTS,
  IMPORTED_GLB_MODULE_MANIFESTS,
  PLATINE_DIMENSIONS_MM,
  PROCEDURAL_CODE_MODULE_MANIFESTS,
  RIGID_PANEL_CONVENTION,
  RIGID_PANEL_THICKNESS_MM,
  buildPlatineMesh,
  createModuleAttachmentController,
  loadModuleAsset,
  validateModuleManifest,
  type ModuleAssetProvider,
} from '../scene/bag/moduleLoader';
import { bagModelNotice } from '../scene/SceneView';

const FIXTURES_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'kit-studio');
const BAGS_DIR = path.join(process.cwd(), 'public', 'assets', 'bags');
const MODULES_DIR = path.join(process.cwd(), 'public', 'assets', 'modules');

const fixtureProvider: ModuleAssetProvider = {
  async fetchManifest(moduleId: string): Promise<unknown> {
    const p = path.join(FIXTURES_DIR, `${moduleId}.manifest.json`);
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  },
  async fetchGlb(moduleId: string): Promise<ArrayBuffer> {
    const p = path.join(FIXTURES_DIR, `${moduleId}.glb`);
    const buf = fs.readFileSync(p);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  },
};

const publicModulesProvider: ModuleAssetProvider = {
  async fetchManifest(moduleId: string): Promise<unknown> {
    const p = path.join(MODULES_DIR, `${moduleId}.manifest.json`);
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  },
  async fetchGlb(moduleId: string): Promise<ArrayBuffer> {
    const p = path.join(MODULES_DIR, `${moduleId}.glb`);
    const buf = fs.readFileSync(p);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  },
};

function compterTrianglesGlb(fichier: string): number {
  const buf = fs.readFileSync(fichier);
  const longueur = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + longueur).toString('utf8')) as {
    meshes?: Array<{
      primitives?: Array<{
        mode?: number;
        indices?: number;
        attributes: { POSITION: number };
      }>;
    }>;
    accessors: Array<{ count: number }>;
  };
  let n = 0;
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      if ((prim.mode ?? 4) !== 4) continue;
      const acc = json.accessors[prim.indices != null ? prim.indices : prim.attributes.POSITION];
      n += Math.floor(acc.count / 3);
    }
  }
  return n;
}

function lireBagManifest(modelId: string): BagManifest {
  return JSON.parse(
    fs.readFileSync(path.join(BAGS_DIR, `${modelId}.manifest.json`), 'utf8'),
  ) as BagManifest;
}

describe('Platine mécanique standard LKDV (§ 4.1)', () => {
  it('modélise une platine avec un socle et exactement DEUX pieds (jamais quatre)', () => {
    expect(PLATINE_DIMENSIONS_MM.feetCount).toBe(2);

    const platine = buildPlatineMesh({
      position: [0, 0.09, -0.04],
      normal: [0, 0, -1],
      up: [0, 1, 0],
    });

    expect(platine.name).toBe('lkdv-platine');
    expect(platine.userData.feetCount).toBe(2);

    const feet = platine.children.filter((c) => c.userData.isPlatineFoot === true);
    expect(feet).toHaveLength(2);
    expect(feet.map((f) => f.name)).toEqual([
      'lkdv-platine-pied-gauche',
      'lkdv-platine-pied-droit',
    ]);

    const socle = platine.children.find((c) => c.name === 'lkdv-platine-socle');
    expect(socle).toBeDefined();
  });
});

describe("Les six ancres auditées des sacs LKDV ONE (§ 4.1 de l'avenant)", () => {
  it('définit exactement 6 ancres auditées (1 par sac sur 15/25/45/60 L, 2 sur 80 L) et supprime dos, dessous, top-lid et flancs des 4 petits sacs', () => {
    expect(LKDV_ONE_PROVISIONAL_ANCHORS).toBe(LKDV_ONE_AUDITED_ANCHORS);

    const expected: Record<string, Array<{ id: string; position: [number, number, number]; normal: [number, number, number] }>> = {
      'lkdv-one-15': [{ id: 'facade', position: [0, 0.171, 0.113], normal: [0, 0, 1] }],
      'lkdv-one-25': [{ id: 'facade', position: [0, 0.229, 0.107], normal: [0, 0, 1] }],
      'lkdv-one-45': [{ id: 'facade', position: [0, 0.213, 0.124], normal: [0, 0, 1] }],
      'lkdv-one-60': [{ id: 'facade', position: [0, 0.164, 0.138], normal: [0, 0, 1] }],
      'lkdv-one-80': [
        { id: 'facade', position: [0, 0.362, 0.182], normal: [0, 0, 1] },
        { id: 'flanc-droit', position: [0.178, 0.476, 0.092], normal: [1, 0, 0] },
      ],
    };

    let totalAnchors = 0;
    for (const [bagId, expectedAnchors] of Object.entries(expected)) {
      const manifest = lireBagManifest(bagId);
      const anchors = resolveBagAttachmentAnchors(manifest);
      totalAnchors += anchors.length;

      expect(anchors).toHaveLength(expectedAnchors.length);
      expect(anchors.map((a) => ({ id: a.id, position: a.position, normal: a.normal }))).toEqual(
        expectedAnchors,
      );

      // Aucune ancre interdite (dos, dessous, top-lid, side-left, ni flanc sur 15..60 L)
      for (const a of anchors) {
        expect(['dos', 'dessous', 'top-lid', 'side-left', 'flanc-gauche']).not.toContain(a.id);
        if (bagId !== 'lkdv-one-80') {
          expect(a.id).toBe('facade');
        }
      }
    }
    expect(totalAnchors).toBe(6);
  });
});

describe('Cycle complet d’un module 3D et annonce du refus d’ancre occupée (§ 4.2 & § 4.3)', () => {
  it('monte un module sur la façade du 45 L, refuse un deuxième module sur la même ancre en avertissant explicitement l’utilisateur, puis dépose et libère la mémoire', async () => {
    const mod1 = await loadModuleAsset('module-poche-test', fixtureProvider);
    const mod2 = await loadModuleAsset('module-poche-test', fixtureProvider);
    expect(mod1.status).toBe('ready');
    expect(mod2.status).toBe('ready');
    if (mod1.status !== 'ready' || mod2.status !== 'ready') return;

    expect(mod1.triangleCount).toBe(12);
    expect(mod1.platineGroup.parent).toBe(mod1.root);

    const bagRoot = new THREE.Group();
    const bag45Manifest = lireBagManifest('lkdv-one-45');
    const anchors45 = resolveBagAttachmentAnchors(bag45Manifest);
    expect(anchors45).toHaveLength(1);
    expect(anchors45[0].id).toBe('facade');

    let latestNotice: string | null = null;
    const controller45 = createModuleAttachmentController(bagRoot, anchors45, {
      onNoticeChange(notice) {
        latestNotice = notice;
      },
    });

    // 1. Pose du premier module sur l'unique ancre 'facade' du 45 L
    const resFirst = controller45.attach(mod1, 'facade');
    expect(resFirst.ok).toBe(true);
    if (!resFirst.ok) return;
    expect(resFirst.worldForward).toEqual([0, 0, 1]);
    expect(resFirst.worldPosition[0]).toBeCloseTo(0, 4);
    expect(resFirst.worldPosition[1]).toBeCloseTo(0.213, 4);
    expect(resFirst.worldPosition[2]).toBeCloseTo(0.124, 4);
    expect(latestNotice).toBeNull();

    // 2. Pose d'un deuxième module sur le 45 L : refus propre ET message dit à l'utilisateur (§ 4.3)
    const resOccupied = controller45.attach(mod2, 'facade');
    expect(resOccupied.ok).toBe(false);
    if (resOccupied.ok) return;
    expect(resOccupied.reason).toBe('anchor-occupied');
    expect(resOccupied.occupiedByModuleId).toBe('module-poche-test');
    expect(resOccupied.userMessage).toContain('déjà occupé');
    expect(controller45.getLastRejectionNotice()).toBe(resOccupied.userMessage);
    expect(latestNotice).toBe(resOccupied.userMessage);

    // Le bandeau d'état (aria-live) de SceneView relaie ce refus à l'utilisateur
    const uiNotice = bagModelNotice(
      {
        status: 'glb',
        modelId: 'lkdv-one-45',
        label: 'LKDV ONE 45 L',
        parts: ['body'],
        anchors: ['facade'],
        capabilities: null,
        declaredCapacityL: 45,
        colorCustomization: 'available',
        modules3dAvailable: true,
        attachmentNotice: latestNotice,
        reason: null,
      },
      'appearance',
      'mod',
    );
    expect(uiNotice).toBe(resOccupied.userMessage);

    // 3. Dépose du premier module : efface l'avertissement et libère l'ancre 'facade'
    const detached = controller45.detach('facade');
    expect(detached).toBe(mod1);
    expect(latestNotice).toBeNull();
    expect(controller45.isOccupied('facade')).toBe(false);

    // 4. Sur le 80 L (2 ancres : 'facade' et 'flanc-droit'), deux modules peuvent être posés simultanément
    const bag80Manifest = lireBagManifest('lkdv-one-80');
    const controller80 = createModuleAttachmentController(
      bagRoot,
      resolveBagAttachmentAnchors(bag80Manifest),
    );
    expect(controller80.attach(mod1, 'facade').ok).toBe(true);
    const resFlanc = controller80.attach(mod2, 'flanc-droit');
    expect(resFlanc.ok).toBe(true);
    if (resFlanc.ok) {
      expect(resFlanc.worldForward[0]).toBeCloseTo(1, 4);
      expect(resFlanc.worldForward[1]).toBeCloseTo(0, 4);
      expect(resFlanc.worldForward[2]).toBeCloseTo(0, 4);
    }

    const geomDisposeSpy = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    controller80.dispose();
    expect(geomDisposeSpy.mock.calls.length).toBeGreaterThanOrEqual(8);
    geomDisposeSpy.mockRestore();
  });

  it('dégrade proprement quand le manifeste ou le GLB du module manque', async () => {
    expect(AVAILABLE_3D_MODULE_MANIFESTS).toHaveLength(20);
    expect(IMPORTED_GLB_MODULE_MANIFESTS).toHaveLength(15);
    expect(PROCEDURAL_CODE_MODULE_MANIFESTS).toHaveLength(5);

    const missing = await loadModuleAsset('module-inexistant', fixtureProvider);
    expect(missing.status).toBe('degraded');
    if (missing.status === 'degraded') {
      expect(missing.reason).toBe('manifest-fetch-failed');
    }

    expect(() => validateModuleManifest({ schema: 99 })).toThrow();
  });
});

describe('1. Palier web des 15 modules maillés .glb (< 400 Ko en 512², < 700 Ko en 1024², géométrie intacte)', () => {
  const EXPECTED_TRIANGLES: Readonly<Record<string, number>> = {
    'lkdv-m01': 11346,
    'lkdv-m02': 11581,
    'lkdv-m03': 11733,
    'lkdv-m04': 10938,
    'lkdv-m05': 11299,
    'lkdv-m06': 11687,
    'lkdv-m07': 8568,
    'lkdv-m08': 11632,
    'lkdv-m13': 10231,
    'lkdv-m15': 11348,
    'lkdv-m16': 10515,
    'lkdv-m17': 9739,
    'lkdv-m18': 11686,
    'lkdv-m19': 11292,
    'lkdv-m20': 10529,
  };

  const EXPECTED_TEX_SIZE_1024 = new Set(['lkdv-m05', 'lkdv-m17', 'lkdv-m20']);

  it('impose moins de 400 Ko par module en 512², moins de 700 Ko pour M05/M17/M20 en 1024², et conserve les triangles exacts (8 568 à 11 733)', () => {
    expect(Object.keys(EXPECTED_TRIANGLES)).toHaveLength(15);

    for (const [moduleId, expectedTriangles] of Object.entries(EXPECTED_TRIANGLES)) {
      const glbPath = path.join(MODULES_DIR, `${moduleId}.glb`);
      const manifestPath = path.join(MODULES_DIR, `${moduleId}.manifest.json`);
      expect(fs.existsSync(glbPath)).toBe(true);
      expect(fs.existsSync(manifestPath)).toBe(true);

      const bytes = fs.statSync(glbPath).size;
      const is1024 = EXPECTED_TEX_SIZE_1024.has(moduleId);
      const maxAllowedBytes = is1024 ? 700 * 1024 : 400 * 1024;
      expect(bytes).toBeGreaterThan(10 * 1024);
      expect(bytes).toBeLessThan(maxAllowedBytes);

      const triangles = compterTrianglesGlb(glbPath);
      expect(triangles).toBe(expectedTriangles);
      expect(triangles).toBeGreaterThanOrEqual(8568);
      expect(triangles).toBeLessThanOrEqual(11733);

      const manifest = validateModuleManifest(
        JSON.parse(fs.readFileSync(manifestPath, 'utf8')),
        moduleId,
      );
      expect(manifest.textureSize).toBe(is1024 ? 1024 : 512);
      expect(manifest.assets?.web?.bytes).toBe(bytes);
      expect(manifest.assets?.web?.triangles).toBe(expectedTriangles);
    }
  });
});

describe('2. Zéro rotation ni mise à l’échelle ajoutée : M04, M05 et M16 sortent bien en +Z à facteur 1, rotation 0', () => {
  it('charge M04, M05 et M16 à facteur 1 et rotation supplémentaire 0, et vérifie que leur façade fonctionnelle sort en +Z grâce à Y=180° déjà cuit dans leur matrice racine', async () => {
    for (const moduleId of ['lkdv-m04', 'lkdv-m05', 'lkdv-m16'] as const) {
      const loaded = await loadModuleAsset(moduleId, publicModulesProvider);
      expect(loaded.status).toBe('ready');
      if (loaded.status !== 'ready') return;

      // Le chargeur n'ajoute aucune rotation ni mise à l'échelle (facteur 1, rotation 0)
      expect(loaded.root.scale.x).toBe(1);
      expect(loaded.root.scale.y).toBe(1);
      expect(loaded.root.scale.z).toBe(1);
      expect(loaded.root.rotation.x).toBe(0);
      expect(loaded.root.rotation.y).toBe(0);
      expect(loaded.root.rotation.z).toBe(0);
      expect(loaded.manifest.orientation?.loadScale).toBe(1);
      expect(loaded.manifest.orientation?.loadRotationDeg).toEqual([0, 0, 0]);
      expect(loaded.manifest.orientation?.rootYawDegInGlb).toBe(180);

      // Le nœud de maillage issu du GLB porte déjà la rotation Y = 180° (quaternion [0, ±1, 0, 0])
      // et l'échelle métrique cuites dans le fichier : un point de la façade brute Meshy (z_raw < 0)
      // sort donc bien en +Z dans le repère du module chargé !
      let meshNode: THREE.Mesh | null = null;
      loaded.root.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.isMesh && !obj.name.startsWith('lkdv-platine')) {
          meshNode = m;
        }
      });
      expect(meshNode).not.toBeNull();
      // Quaternion Y = 180° : |qy| ≈ 1, |qw| ≈ 0
      expect(Math.abs(meshNode!.quaternion.y)).toBeCloseTo(1, 3);
      expect(Math.abs(meshNode!.quaternion.w)).toBeCloseTo(0, 3);
      // L'échelle cuite dans le nœud est bien comprise entre 0,079 et 0,237
      expect(meshNode!.scale.y).toBeGreaterThanOrEqual(0.079);
      expect(meshNode!.scale.y).toBeLessThanOrEqual(0.238);

      // La façade brute (z_raw = -0.5 dans le maillage non tourné) sort en +Z après application
      // de la seule matrice du nœud GLB (sans aucune rotation ajoutée par le chargeur)
      const rawFrontPoint = new THREE.Vector3(0, 0, -0.5).applyMatrix4(meshNode!.matrixWorld);
      expect(rawFrontPoint.z).toBeGreaterThan(0.02);

      // Et la direction fonctionnelle sortante du module (-platine.normal) est bien +Z ([0, 0, 1])
      expect(loaded.manifest.platine.normal).toEqual([0, 0, -1]);

      loaded.dispose();
    }
  });

  it('porte les 5 réserves de fournisseur (M04, M05, M07, M15, M16) dans les manifestes sans les masquer', () => {
    const byCode = new Map(IMPORTED_GLB_MODULE_MANIFESTS.map((m) => [m.code, m]));
    expect(byCode.get('M04')?.reserve).toMatch(/recto\/verso/i);
    expect(byCode.get('M05')?.reserve).toMatch(/détails de dos/i);
    expect(byCode.get('M07')?.reserve).toMatch(/filet/i);
    expect(byCode.get('M15')?.reserve).toMatch(/superposition sombre/i);
    expect(byCode.get('M16')?.reserve).toMatch(/écusson peu lisible/i);
  });
});

describe('4. Filtrage géométrique du catalogue par sac avec garde de 15 % au bord (§ 4.2)', () => {
  it('calcule la compatibilité module ↔ sac avec une garde de 15 % et retrouve les 5 refus du 15 L (M05, M13, M17, M19, M20) et les 4 refus du 25 L', () => {
    expect(MODULE_FACE_MARGIN_RATIO).toBe(0.15);

    const bag15 = lireBagManifest('lkdv-one-15');
    const bag25 = lireBagManifest('lkdv-one-25');
    const bag45 = lireBagManifest('lkdv-one-45');
    const bag60 = lireBagManifest('lkdv-one-60');
    const bag80 = lireBagManifest('lkdv-one-80');

    // Sur le 15 L : seuls 10 modules sur 15 rentrent ; M05, M13, M17, M19 et M20 sont refusés
    const compat15 = filterCompatibleModulesForBag(IMPORTED_GLB_MODULE_MANIFESTS, bag15);
    const rejected15Codes = IMPORTED_GLB_MODULE_MANIFESTS.filter(
      (m) => !doesModuleFitBag(m, bag15),
    ).map((m) => m.code);
    expect(compat15).toHaveLength(10);
    expect(rejected15Codes).toEqual(['M05', 'M13', 'M17', 'M19', 'M20']);

    // Sur le 25 L : 11 modules sur 15 rentrent (M19 rentre sur le 25 L ; M05, M13, M17, M20 refusés)
    const compat25 = filterCompatibleModulesForBag(IMPORTED_GLB_MODULE_MANIFESTS, bag25);
    const rejected25Codes = IMPORTED_GLB_MODULE_MANIFESTS.filter(
      (m) => !doesModuleFitBag(m, bag25),
    ).map((m) => m.code);
    expect(compat25).toHaveLength(11);
    expect(rejected25Codes).toEqual(['M05', 'M13', 'M17', 'M20']);

    // Sur les 45 L, 60 L et 80 L : les 15 modules maillés rentrent tous
    expect(filterCompatibleModulesForBag(IMPORTED_GLB_MODULE_MANIFESTS, bag45)).toHaveLength(15);
    expect(filterCompatibleModulesForBag(IMPORTED_GLB_MODULE_MANIFESTS, bag60)).toHaveLength(15);
    expect(filterCompatibleModulesForBag(IMPORTED_GLB_MODULE_MANIFESTS, bag80)).toHaveLength(15);
  });
});

describe('Deux origines de module : cohabitation des 15 modules .glb et des 5 modules procéduraux (M09, M10, M11, M12, M14)', () => {
  it('porte la convention d’épaisseur 3,5 mm des panneaux rigides comme convention de projet (non mesurée sur prototype)', () => {
    expect(RIGID_PANEL_THICKNESS_MM).toBe(3.5);
    expect(RIGID_PANEL_THICKNESS_MM).toBe(PLATINE_DIMENSIONS_MM.plateThicknessMm);
    expect(RIGID_PANEL_CONVENTION).toEqual({
      thicknessMm: 3.5,
      status: 'convention_projet',
      measuredOnPrototype: false,
      source: 'Reprise du socle de la platine standard (80 × 54 × 3,5 mm)',
    });
  });

  it('construit par code M09, M10, M11, M12 et M14 sans aucun fichier .glb et les fait cohabiter avec les maillages importés sur les ancres auditées du 80 L', async () => {
    const proceduralStrictProvider: ModuleAssetProvider = {
      fetchManifest: publicModulesProvider.fetchManifest,
      async fetchGlb(): Promise<ArrayBuffer> {
        throw new Error('Aucun .glb ne doit être chargé pour un module procédural');
      },
    };

    const loadedProcedural = await Promise.all(
      ['lkdv-m09', 'lkdv-m10', 'lkdv-m11', 'lkdv-m12', 'lkdv-m14'].map((id) =>
        loadModuleAsset(id, proceduralStrictProvider),
      ),
    );

    for (const res of loadedProcedural) {
      expect(res.status).toBe('ready');
      if (res.status !== 'ready') return;
      expect(res.manifest.origin).toBe('procedural');
      expect(res.manifest.rigidPanelConvention).toEqual(RIGID_PANEL_CONVENTION);
      expect(res.triangleCount).toBeGreaterThan(0);

      const feet = res.platineGroup.children.filter((c) => c.userData.isPlatineFoot === true);
      expect(feet).toHaveLength(2);
    }

    const [m09, m10, m11, m12, m14] = loadedProcedural;
    if (
      m09.status !== 'ready' ||
      m10.status !== 'ready' ||
      m11.status !== 'ready' ||
      m12.status !== 'ready' ||
      m14.status !== 'ready'
    ) {
      return;
    }

    // Cohabitation simultanée d'un module .glb importé (lkdv-m04) et d'un module procédural (lkdv-m12)
    // sur les deux ancres auditées ('facade' et 'flanc-droit') du sac LKDV ONE 80 L
    const m04Glb = await loadModuleAsset('lkdv-m04', publicModulesProvider);
    expect(m04Glb.status).toBe('ready');
    if (m04Glb.status !== 'ready') return;

    const bagRoot = new THREE.Group();
    const bag80Manifest = lireBagManifest('lkdv-one-80');
    const anchors80 = resolveBagAttachmentAnchors(bag80Manifest);
    const controller = createModuleAttachmentController(bagRoot, anchors80);

    expect(controller.attach(m04Glb, 'facade').ok).toBe(true);
    expect(controller.attach(m12, 'flanc-droit').ok).toBe(true);
    expect(bagRoot.children).toHaveLength(2);
    expect(controller.getMountedModule('facade')?.manifest.origin).toBe('glb');
    expect(controller.getMountedModule('flanc-droit')?.manifest.origin).toBe('procedural');

    controller.dispose();
    m09.dispose();
    m10.dispose();
    m11.dispose();
    m14.dispose();
  });
});
