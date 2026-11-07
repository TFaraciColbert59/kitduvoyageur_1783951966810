// @vitest-environment jsdom
/**
 * src/features/kit-studio/__tests__/moduleLoader.test.ts
 * Vérification complète du chemin des modules 3D (§ 4.1, § 4.2, § 4.3 + Avenant ingestion modules) :
 * - platine mécanique standard à deux pieds (jamais quatre) ;
 * - table lisible des points d'accroche provisoires des sacs LKDV ONE ;
 * - cycle complet sur fixture `tests/fixtures/kit-studio/module-poche-test.{glb,manifest.json}` ;
 * - palier web des 12 modules maillés `.glb` (`M03..M08, M15..M20`) : strictement < 400 Ko par module,
 *   taille de texture par module (512² par défaut, 1024² pour M05, M17, M20) et géométrie intacte
 *   (8 568 à 11 733 triangles) ;
 * - orientation portée dans les manifestes (Y haut, façade +Z, dos −Z, rotation Y de 180° pour
 *   M04, M05 et M16) et pose d'un module tourné dans le bon sens sur une ancre ;
 * - cohabitation des deux origines (`glb` et `procedural` : M09, M10, M11, M12, M14) sur les mêmes
 *   ancres et la même platine, avec l'épaisseur 3,5 mm des panneaux rigides portée comme convention ;
 * - réserves fournisseur (M04, M05, M07, M15, M16) portées dans les manifestes sans bricolage shader.
 */

import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { BagManifest } from '../domain/bagModel';
import {
  LKDV_ONE_PROVISIONAL_ANCHORS,
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
  type ModuleManifest,
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

describe("Table des points d'accroche des sacs LKDV ONE (§ 4.2)", () => {
  it('définit façade, flancs et dessus cohérents avec boundingBoxM pour les 5 sacs LKDV ONE', () => {
    const ids = ['lkdv-one-15', 'lkdv-one-25', 'lkdv-one-45', 'lkdv-one-60', 'lkdv-one-80'];
    for (const id of ids) {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(BAGS_DIR, `${id}.manifest.json`), 'utf8'),
      ) as BagManifest;
      const anchors = resolveBagAttachmentAnchors(manifest);
      expect(anchors).toEqual(LKDV_ONE_PROVISIONAL_ANCHORS[id]);
      expect(anchors.map((a) => a.id)).toEqual([
        'front-upper',
        'front-lower',
        'side-left',
        'side-right',
        'top-lid',
      ]);

      // Chaque point d'accroche reste dans l'enveloppe physique du sac
      for (const a of anchors) {
        expect(Math.abs(a.position[0])).toBeLessThanOrEqual(manifest.boundingBoxM.w * 0.55);
        expect(a.position[1]).toBeGreaterThan(0);
        expect(a.position[1]).toBeLessThanOrEqual(manifest.boundingBoxM.h);
        expect(Math.abs(a.position[2])).toBeLessThanOrEqual(manifest.boundingBoxM.d * 0.55);
      }
    }
  });
});

describe('Cycle complet d’un module 3D sur fixture (§ 4.2 & § 4.3)', () => {
  it('charge le module fixture, attache la platine, monte sur une ancre, oriente selon la normale, refuse une ancre occupée, dépose et libère la mémoire', async () => {
    const mod1 = await loadModuleAsset('module-poche-test', fixtureProvider);
    const mod2 = await loadModuleAsset('module-poche-test', fixtureProvider);
    expect(mod1.status).toBe('ready');
    expect(mod2.status).toBe('ready');
    if (mod1.status !== 'ready' || mod2.status !== 'ready') return;

    expect(mod1.triangleCount).toBe(12);
    expect(mod1.platineGroup.parent).toBe(mod1.root);
    const feet = mod1.platineGroup.children.filter((c) => c.userData.isPlatineFoot === true);
    expect(feet).toHaveLength(2);

    // Points d'accroche du sac LKDV ONE 45 L
    const bagRoot = new THREE.Group();
    const bag45Manifest = JSON.parse(
      fs.readFileSync(path.join(BAGS_DIR, 'lkdv-one-45.manifest.json'), 'utf8'),
    ) as BagManifest;
    const anchors = resolveBagAttachmentAnchors(bag45Manifest);
    const controller = createModuleAttachmentController(bagRoot, anchors);

    // 1. Pose sur l'ancre 'front-upper' (normale [0, 0, 1])
    const resFront = controller.attach(mod1, 'front-upper');
    expect(resFront.ok).toBe(true);
    if (!resFront.ok) return;
    expect(mod1.root.parent).toBe(bagRoot);
    expect(controller.isOccupied('front-upper')).toBe(true);

    // La direction sortante du module (initialement +Z car platine.normal = [0, 0, -1]) pointe vers [0, 0, 1]
    expect(resFront.worldForward[0]).toBeCloseTo(0, 4);
    expect(resFront.worldForward[1]).toBeCloseTo(0, 4);
    expect(resFront.worldForward[2]).toBeCloseTo(1, 4);

    // Le point d'appui de la platine coïncide exactement avec la position de l'ancre 'front-upper'
    const frontAnchor = anchors.find((a) => a.id === 'front-upper')!;
    expect(resFront.worldPosition[0]).toBeCloseTo(frontAnchor.position[0], 4);
    expect(resFront.worldPosition[1]).toBeCloseTo(frontAnchor.position[1], 4);
    expect(resFront.worldPosition[2]).toBeCloseTo(frontAnchor.position[2], 4);

    // 2. Refus d'un point d'ancrage déjà occupé
    const resOccupied = controller.attach(mod2, 'front-upper');
    expect(resOccupied).toEqual({
      ok: false,
      anchorId: 'front-upper',
      reason: 'anchor-occupied',
      occupiedByModuleId: 'module-poche-test',
    });

    // 3. Refus d'un point d'ancrage inexistant
    const resUnknown = controller.attach(mod2, 'ancre-inconnue');
    expect(resUnknown).toEqual({
      ok: false,
      anchorId: 'ancre-inconnue',
      reason: 'anchor-not-found',
    });

    // 4. Pose du second module sur le flanc gauche ('side-left', normale [-1, 0, 0])
    const resSide = controller.attach(mod2, 'side-left');
    expect(resSide.ok).toBe(true);
    if (!resSide.ok) return;
    expect(resSide.worldForward[0]).toBeCloseTo(-1, 4);
    expect(resSide.worldForward[1]).toBeCloseTo(0, 4);
    expect(resSide.worldForward[2]).toBeCloseTo(0, 4);

    // 5. Dépose du premier module : l'ancre 'front-upper' redevient libre
    const detached = controller.detach('front-upper');
    expect(detached).toBe(mod1);
    expect(mod1.root.parent).toBeNull();
    expect(controller.isOccupied('front-upper')).toBe(false);

    // On peut désormais reposer un module sur 'front-upper'
    const resReattach = controller.attach(mod1, 'front-upper');
    expect(resReattach.ok).toBe(true);

    // 6. Libération mémoire complète (dispose)
    const geomDisposeSpy = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    const matDisposeSpy = vi.spyOn(THREE.Material.prototype, 'dispose');

    controller.dispose();
    expect(controller.isOccupied('front-upper')).toBe(false);
    expect(controller.isOccupied('side-left')).toBe(false);
    expect(bagRoot.children).toHaveLength(0);
    // Chaque module dispose sa géométrie de corps + les 3 géométries de sa platine (socle + 2 pieds)
    expect(geomDisposeSpy.mock.calls.length).toBeGreaterThanOrEqual(8);
    expect(matDisposeSpy.mock.calls.length).toBeGreaterThanOrEqual(4);

    geomDisposeSpy.mockRestore();
    matDisposeSpy.mockRestore();
  });

  it('dégrade proprement quand le manifeste ou le GLB du module manque, et bascule le bandeau selon modules3dAvailable', async () => {
    // Les 17 modules (12 GLB + 5 procéduraux) sont désormais livrés en production
    expect(AVAILABLE_3D_MODULE_MANIFESTS).toHaveLength(17);
    expect(IMPORTED_GLB_MODULE_MANIFESTS).toHaveLength(12);
    expect(PROCEDURAL_CODE_MODULE_MANIFESTS).toHaveLength(5);

    // Lorsque modules3dAvailable est true, plus aucun bandeau d'attente n'est affiché
    const noticeAvailable = bagModelNotice(
      {
        status: 'glb',
        modelId: 'lkdv-one-45',
        label: 'LKDV ONE 45 L',
        parts: ['body'],
        anchors: ['front-upper'],
        capabilities: null,
        declaredCapacityL: 45,
        colorCustomization: 'available',
        modules3dAvailable: true,
        reason: null,
      },
      'appearance',
      'mod',
    );
    expect(noticeAvailable).toBeNull();

    // Si un sac déclare explicitement modules3dAvailable: false, le bandeau reste fonctionnel
    const noticeUnavailable = bagModelNotice(
      {
        status: 'glb',
        modelId: 'lkdv-one-45',
        label: 'LKDV ONE 45 L',
        parts: ['body'],
        anchors: ['front-upper'],
        capabilities: null,
        declaredCapacityL: 45,
        colorCustomization: 'available',
        modules3dAvailable: false,
        reason: null,
      },
      'appearance',
      'mod',
    );
    expect(noticeUnavailable).toContain('Modules 3D en cours de production');

    // Chargement d'un module introuvable → dégradation propre sans exception
    const missing = await loadModuleAsset('module-inexistant', fixtureProvider);
    expect(missing.status).toBe('degraded');
    if (missing.status === 'degraded') {
      expect(missing.reason).toBe('manifest-fetch-failed');
    }

    // Manifeste invalide rejeté explicitement
    expect(() => validateModuleManifest({ schema: 99 })).toThrow();
  });
});

describe('Palier web des 12 modules maillés .glb (budget < 400 Ko et géométrie intacte)', () => {
  const EXPECTED_TRIANGLES: Readonly<Record<string, number>> = {
    'lkdv-m03': 11733,
    'lkdv-m04': 10938,
    'lkdv-m05': 11299,
    'lkdv-m06': 11687,
    'lkdv-m07': 8568,
    'lkdv-m08': 11632,
    'lkdv-m15': 11348,
    'lkdv-m16': 10515,
    'lkdv-m17': 9739,
    'lkdv-m18': 11686,
    'lkdv-m19': 11292,
    'lkdv-m20': 10529,
  };

  const EXPECTED_TEX_SIZE_1024 = new Set(['lkdv-m05', 'lkdv-m17', 'lkdv-m20']);

  it('impose moins de 400 Ko par module au palier web, la taille de texture cible (512² / 1024²) et conserve les triangles exacts (8 568 à 11 733)', () => {
    expect(Object.keys(EXPECTED_TRIANGLES)).toHaveLength(12);

    for (const [moduleId, expectedTriangles] of Object.entries(EXPECTED_TRIANGLES)) {
      const glbPath = path.join(MODULES_DIR, `${moduleId}.glb`);
      const manifestPath = path.join(MODULES_DIR, `${moduleId}.manifest.json`);
      expect(fs.existsSync(glbPath)).toBe(true);
      expect(fs.existsSync(manifestPath)).toBe(true);

      const bytes = fs.statSync(glbPath).size;
      expect(bytes).toBeGreaterThan(10 * 1024);
      // Budget strict : moins de 400 Ko par module au palier web
      expect(bytes).toBeLessThan(400 * 1024);

      // La géométrie n'est jamais décimée : 8 568 à 11 733 triangles exacts
      const triangles = compterTrianglesGlb(glbPath);
      expect(triangles).toBe(expectedTriangles);
      expect(triangles).toBeGreaterThanOrEqual(8568);
      expect(triangles).toBeLessThanOrEqual(11733);

      const manifest = validateModuleManifest(
        JSON.parse(fs.readFileSync(manifestPath, 'utf8')),
        moduleId,
      );
      const expectedTex = EXPECTED_TEX_SIZE_1024.has(moduleId) ? 1024 : 512;
      expect(manifest.textureSize).toBe(expectedTex);
      expect(manifest.assets?.web?.bytes).toBe(bytes);
      expect(manifest.assets?.web?.triangles).toBe(expectedTriangles);
    }
  });
});

describe('Orientation portée dans les manifestes (yaw 180° pour M04, M05 et M16) et réserves fournisseur', () => {
  const ROTATED_180 = new Set(['lkdv-m04', 'lkdv-m05', 'lkdv-m16']);

  it('déclare Y haut, façade +Z, dos −Z et yawDeg = 180 uniquement pour M04, M05 et M16 dans les manifestes (jamais en dur dans le chargeur)', () => {
    for (const m of IMPORTED_GLB_MODULE_MANIFESTS) {
      const diskManifest = validateModuleManifest(
        JSON.parse(fs.readFileSync(path.join(MODULES_DIR, `${m.moduleId}.manifest.json`), 'utf8')),
        m.moduleId,
      );
      const expectedYaw = ROTATED_180.has(m.moduleId) ? 180 : 0;
      expect(m.orientation).toEqual({
        up: 'Y',
        front: '+Z',
        back: '-Z',
        yawDeg: expectedYaw,
      });
      expect(diskManifest.orientation).toEqual(m.orientation);
    }
  });

  it('applique la rotation Y du manifeste au chargement et pose un module tourné (M04) dans le bon sens sur une ancre', async () => {
    const m04Rotated = await loadModuleAsset('lkdv-m04', publicModulesProvider);
    expect(m04Rotated.status).toBe('ready');
    if (m04Rotated.status !== 'ready') return;

    const bodyGroup = m04Rotated.root.children.find((c) => c.name === 'lkdv-module-body');
    expect(bodyGroup).toBeDefined();
    expect(bodyGroup!.userData.appliedYawDeg).toBe(180);
    expect(bodyGroup!.rotation.y).toBeCloseTo(Math.PI, 5);

    // Preuve que l'orientation vient du manifeste et non d'une liste en dur dans le chargeur :
    // si l'on charge ce même module avec un manifeste dont yawDeg = 0, rotation.y vaut 0.
    const unrotatedProvider: ModuleAssetProvider = {
      async fetchManifest(moduleId: string): Promise<unknown> {
        const raw = (await publicModulesProvider.fetchManifest(moduleId)) as ModuleManifest;
        return {
          ...raw,
          orientation: { up: 'Y', front: '+Z', back: '-Z', yawDeg: 0 },
        };
      },
      fetchGlb: publicModulesProvider.fetchGlb,
    };
    const m04Unrotated = await loadModuleAsset('lkdv-m04', unrotatedProvider);
    expect(m04Unrotated.status).toBe('ready');
    if (m04Unrotated.status !== 'ready') return;
    const unrotatedBody = m04Unrotated.root.children.find((c) => c.name === 'lkdv-module-body')!;
    expect(unrotatedBody.userData.appliedYawDeg).toBe(0);
    expect(unrotatedBody.rotation.y).toBeCloseTo(0, 5);

    // Un point témoin de la façade brute (0, 0.1, -0.038) dans le maillage non tourné se retrouve
    // en +Z (+0.038) dans le repère de m04Rotated grâce à yawDeg = 180 du manifeste.
    const probeLocal = new THREE.Vector3(0, 0.1, -0.038);
    const probeInRotatedRoot = probeLocal.clone().applyMatrix4(bodyGroup!.matrix);
    const probeInUnrotatedRoot = probeLocal.clone().applyMatrix4(unrotatedBody.matrix);
    expect(probeInRotatedRoot.z).toBeCloseTo(0.038, 4);
    expect(probeInUnrotatedRoot.z).toBeCloseTo(-0.038, 4);

    // Pose de M04 tourné sur l'ancre 'front-upper' (normale [0, 0, 1]) et 'side-left' (normale [-1, 0, 0])
    const bagRoot = new THREE.Group();
    const bag45Manifest = JSON.parse(
      fs.readFileSync(path.join(BAGS_DIR, 'lkdv-one-45.manifest.json'), 'utf8'),
    ) as BagManifest;
    const anchors = resolveBagAttachmentAnchors(bag45Manifest);
    const controller = createModuleAttachmentController(bagRoot, anchors);

    const resFront = controller.attach(m04Rotated, 'front-upper');
    expect(resFront.ok).toBe(true);
    if (!resFront.ok) return;
    expect(resFront.worldForward[0]).toBeCloseTo(0, 4);
    expect(resFront.worldForward[1]).toBeCloseTo(0, 4);
    expect(resFront.worldForward[2]).toBeCloseTo(1, 4);

    // Dans le repère du sac, le point témoin de la façade de M04 est bien en avant de l'ancre (+Z)
    const frontAnchor = anchors.find((a) => a.id === 'front-upper')!;
    const probeWorld = probeLocal.clone().applyMatrix4(bodyGroup!.matrixWorld);
    expect(probeWorld.z).toBeGreaterThan(frontAnchor.position[2] + 0.05);

    m04Rotated.dispose();
    m04Unrotated.dispose();
  });

  it('porte les 5 réserves de fournisseur (M04, M05, M07, M15, M16) dans les manifestes sans les masquer', () => {
    const byCode = new Map(IMPORTED_GLB_MODULE_MANIFESTS.map((m) => [m.code, m]));
    expect(byCode.get('M04')?.reserve).toMatch(/recto\/verso/i);
    expect(byCode.get('M05')?.reserve).toMatch(/détails de dos/i);
    expect(byCode.get('M07')?.reserve).toMatch(/filet/i);
    expect(byCode.get('M15')?.reserve).toMatch(/superposition sombre/i);
    expect(byCode.get('M16')?.reserve).toMatch(/écusson peu lisible/i);

    // Les 7 autres modules maillés n'ont pas de réserve
    for (const code of ['M03', 'M06', 'M08', 'M17', 'M18', 'M19', 'M20']) {
      expect(byCode.get(code)?.reserve).toBeNull();
    }
  });
});

describe('Deux origines de module : cohabitation des 5 modules procéduraux (M09, M10, M11, M12, M14) et des modules .glb', () => {
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

  it('construit par code M09, M10, M11, M12 et M14 sans aucun fichier .glb et les fait cohabiter avec les maillages importés sur les mêmes ancres et la même platine', async () => {
    // Provider qui interdit tout appel à fetchGlb pour prouver que M09..M14 ne lisent aucun .glb
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

      // Platine standard à 2 pieds présente sur chaque module procédural
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

    // Vérifications géométriques spécifiques des 5 modules procéduraux :
    // - M09 : état de référence 'charge', boîte 460 × 160 × 160 mm
    expect(m09.manifest.referenceState).toBe('charge');
    expect(m09.manifest.boundingBoxM).toEqual({ w: 0.46, h: 0.16, d: 0.16 });

    // - M10 & M11 : sangles en boucles ouvertes (openLoop = true), sans cylindre plein
    let m10OpenLoops = 0;
    m10.root.traverse((o) => {
      if (o.userData?.openLoop === true) m10OpenLoops++;
    });
    expect(m10OpenLoops).toBe(2);

    let m11OpenLoops = 0;
    m11.root.traverse((o) => {
      if (o.userData?.openLoop === true) m11OpenLoops++;
    });
    expect(m11OpenLoops).toBe(2);

    // - M12 : filet concave ouvert sans casque (isConcaveOpenNet = true)
    let m12NetFound = false;
    m12.root.traverse((o) => {
      if (o.userData?.isConcaveOpenNet === true) m12NetFound = true;
    });
    expect(m12NetFound).toBe(true);

    // - M14 : lame droite élancée 90 × 1700 × 3,5 mm (H/L = 1700 / 90 ≈ 18,89)
    let m14AspectRatio = 0;
    m14.root.traverse((o) => {
      if (typeof o.userData?.aspectRatioHL === 'number') {
        m14AspectRatio = o.userData.aspectRatioHL;
      }
    });
    expect(m14AspectRatio).toBeCloseTo(1700 / 90, 2);

    // Cohabitation sur les ancres d'un même sac (lkdv-one-45) avec un module .glb importé (lkdv-m03)
    const m03Glb = await loadModuleAsset('lkdv-m03', publicModulesProvider);
    expect(m03Glb.status).toBe('ready');
    if (m03Glb.status !== 'ready') return;

    const bagRoot = new THREE.Group();
    const bag45Manifest = JSON.parse(
      fs.readFileSync(path.join(BAGS_DIR, 'lkdv-one-45.manifest.json'), 'utf8'),
    ) as BagManifest;
    const anchors = resolveBagAttachmentAnchors(bag45Manifest);
    const controller = createModuleAttachmentController(bagRoot, anchors);

    expect(controller.attach(m03Glb, 'front-upper').ok).toBe(true);
    expect(controller.attach(m09, 'front-lower').ok).toBe(true);
    expect(controller.attach(m10, 'top-lid').ok).toBe(true);
    expect(controller.attach(m12, 'side-left').ok).toBe(true);
    expect(controller.attach(m14, 'side-right').ok).toBe(true);

    expect(bagRoot.children).toHaveLength(5);
    expect(controller.getMountedModule('front-upper')?.manifest.origin).toBe('glb');
    expect(controller.getMountedModule('front-lower')?.manifest.origin).toBe('procedural');
    expect(controller.getMountedModule('top-lid')?.manifest.origin).toBe('procedural');
    expect(controller.getMountedModule('side-left')?.manifest.origin).toBe('procedural');
    expect(controller.getMountedModule('side-right')?.manifest.origin).toBe('procedural');

    controller.dispose();
    m11.dispose();
  });
});
