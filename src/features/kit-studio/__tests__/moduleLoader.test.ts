// @vitest-environment jsdom
/**
 * src/features/kit-studio/__tests__/moduleLoader.test.ts
 * Vérification complète du chemin des modules 3D (§ 4.1, § 4.2, § 4.3) :
 * - platine mécanique standard à deux pieds (jamais quatre) ;
 * - table lisible des points d'accroche provisoires des sacs LKDV ONE ;
 * - chargement du module fixture `tests/fixtures/kit-studio/module-poche-test.{glb,manifest.json}` ;
 * - pose sur un point d'ancrage avec orientation selon la normale locale ;
 * - refus d'un point d'ancrage déjà occupé ;
 * - dépose et libération mémoire (`dispose()`) ;
 * - annonce propre de l'absence tant qu'aucun vrai module 3D n'est livré.
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
  PLATINE_DIMENSIONS_MM,
  buildPlatineMesh,
  createModuleAttachmentController,
  loadModuleAsset,
  validateModuleManifest,
  type ModuleAssetProvider,
} from '../scene/bag/moduleLoader';
import { bagModelNotice } from '../scene/SceneView';

const FIXTURES_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'kit-studio');
const BAGS_DIR = path.join(process.cwd(), 'public', 'assets', 'bags');

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

  it('dégrade proprement quand le manifeste ou le GLB du module manque, et annonce l’absence des modules 3D en production', async () => {
    // Aucun vrai module 3D n'est encore livré en production
    expect(AVAILABLE_3D_MODULE_MANIFESTS).toEqual([]);

    // L'interface annonce proprement cette indisponibilité en mode Apparence > Modules
    const notice = bagModelNotice(
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
    expect(notice).toContain('Modules 3D en cours de production');

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
