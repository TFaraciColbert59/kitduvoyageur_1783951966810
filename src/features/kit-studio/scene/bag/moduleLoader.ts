/**
 * src/features/kit-studio/scene/bag/moduleLoader.ts
 * Chemin complet des modules 3D externes (platine mécanique à 2 pieds, manifeste, chargeur GLB
 * mutualisé et contrôleur d'accroche sur les ancres du sac) — § 4.
 *
 * Tant que les maillages définitifs des modules sont en production, `AVAILABLE_3D_MODULE_MANIFESTS`
 * reste vide et l'interface annonce proprement cette indisponibilité temporaire. Le chemin de code,
 * lui, est complet et vérifié de bout en bout sur fixture.
 */

import * as THREE from 'three';
import type { BagAnchorId, BagAnchorSpec, BoundingBoxM, Vec3Tuple } from '../../domain/bagModel';
import type { ProvisionalBagAnchor } from '../../domain/bagAnchorsTable';
import { decodeGlbBufferToScene } from './loader';

/**
 * Dimensions mécaniques de la platine standard LKDV, en millimètres (§ 4.1).
 *
 * La platine comporte un socle et **deux pieds** d'ancrage symétriques (jamais quatre).
 */
export const PLATINE_DIMENSIONS_MM = {
  plateWidthMm: 80,
  plateHeightMm: 54,
  plateThicknessMm: 3.5,
  feetCount: 2,
  footWidthMm: 14,
  footHeightMm: 22,
  footDepthMm: 6.5,
  feetCenterSpacingMm: 48,
} as const;

/** Spécification de pose de la platine sur un module, dans le repère local du module (en mètres). */
export interface ModulePlatineSpec {
  /** Point d'appui de la platine sur le module (en mètres). */
  readonly position: Vec3Tuple;
  /**
   * Normale sortante de la platine (pointant du module vers la paroi du sac, typiquement `[0, 0, -1]`
   * lorsque la platine est au dos du module).
   */
  readonly normal: Vec3Tuple;
  /** Vecteur « haut » local de la platine (par défaut `[0, 1, 0]`). */
  readonly up?: Vec3Tuple;
}

/** Manifeste d'un module 3D externe (schéma 1), calqué sur `BagManifest` (§ 4.2). */
export interface ModuleManifest {
  readonly schema: number;
  readonly moduleId: string;
  readonly label: string;
  readonly units: 'meters';
  readonly boundingBoxM: BoundingBoxM;
  readonly glbUrl: string;
  readonly platine: ModulePlatineSpec;
  readonly texturedSource?: boolean;
}

/**
 * Catalogue des modules 3D livrés en production.
 * Vide tant que les maillages définitifs sont en cours de production (§ 4.3).
 */
export const AVAILABLE_3D_MODULE_MANIFESTS: readonly ModuleManifest[] = [];

export interface ModuleAssetProvider {
  fetchManifest: (moduleId: string) => Promise<unknown>;
  fetchGlb: (moduleId: string, url?: string) => Promise<ArrayBuffer>;
}

export interface LoadedModuleAsset {
  readonly status: 'ready';
  readonly moduleId: string;
  readonly manifest: ModuleManifest;
  readonly root: THREE.Group;
  readonly platineGroup: THREE.Group;
  readonly triangleCount: number;
  readonly dispose: () => void;
}

export type ModuleLoadErrorReason =
  | 'manifest-fetch-failed'
  | 'manifest-invalid'
  | 'glb-fetch-failed'
  | 'glb-parse-failed';

export interface ModuleLoadDegraded {
  readonly status: 'degraded';
  readonly moduleId: string;
  readonly reason: ModuleLoadErrorReason;
  readonly detail?: string;
  readonly dispose: () => void;
}

export type ModuleLoadResult = LoadedModuleAsset | ModuleLoadDegraded;

function isVec3Tuple(v: unknown): v is Vec3Tuple {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    v.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

export function validateModuleManifest(raw: unknown, expectedModuleId?: string): ModuleManifest {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Manifeste de module non-objet');
  }
  const m = raw as Record<string, unknown>;
  if (m.schema !== 1) {
    throw new Error(`Schéma de manifeste de module non supporté : ${String(m.schema)}`);
  }
  if (typeof m.moduleId !== 'string' || m.moduleId.length === 0) {
    throw new Error('moduleId manquant');
  }
  if (expectedModuleId && m.moduleId !== expectedModuleId) {
    throw new Error(`moduleId incohérent : attendu ${expectedModuleId}, reçu ${m.moduleId}`);
  }
  if (typeof m.label !== 'string' || m.label.length === 0) {
    throw new Error('label manquant');
  }
  if (m.units !== 'meters') {
    throw new Error(`Unités invalides : ${String(m.units)}`);
  }
  const bbox = m.boundingBoxM as Record<string, unknown> | undefined;
  if (
    !bbox ||
    typeof bbox.w !== 'number' ||
    typeof bbox.h !== 'number' ||
    typeof bbox.d !== 'number' ||
    bbox.w <= 0 ||
    bbox.h <= 0 ||
    bbox.d <= 0
  ) {
    throw new Error('boundingBoxM invalide');
  }
  if (typeof m.glbUrl !== 'string' || m.glbUrl.length === 0) {
    throw new Error('glbUrl manquant');
  }
  const platine = m.platine as Record<string, unknown> | undefined;
  if (!platine || !isVec3Tuple(platine.position) || !isVec3Tuple(platine.normal)) {
    throw new Error('platine invalide');
  }
  if (platine.up !== undefined && !isVec3Tuple(platine.up)) {
    throw new Error('platine.up invalide');
  }
  const normLen = Math.hypot(platine.normal[0], platine.normal[1], platine.normal[2]);
  if (normLen < 1e-5) {
    throw new Error('platine.normal de longueur nulle');
  }

  return raw as ModuleManifest;
}

/**
 * Construit un repère orthonormé `[right, upOrtho, forward]` où l'axe `+Z` pointe selon `forward`.
 */
function buildOrthonormalBasis(
  forward: Vec3Tuple,
  upHint: Vec3Tuple = [0, 1, 0],
): THREE.Matrix4 {
  const zAxis = new THREE.Vector3(forward[0], forward[1], forward[2]).normalize();
  const up = new THREE.Vector3(upHint[0], upHint[1], upHint[2]).normalize();
  if (Math.abs(zAxis.dot(up)) > 0.98) {
    up.set(0, 0, zAxis.y > 0 ? -1 : 1);
    if (Math.abs(zAxis.dot(up)) > 0.98) {
      up.set(1, 0, 0);
    }
  }
  const xAxis = new THREE.Vector3().crossVectors(up, zAxis).normalize();
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
  return new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
}

/**
 * Modélise la platine mécanique standard LKDV une seule fois dans le code (§ 4.1) :
 * - un socle de 80 × 54 × 3,5 mm ;
 * - **deux pieds** d'ancrage symétriques (14 × 22 × 6,5 mm, entraxe 48 mm) — jamais quatre.
 *
 * Dans le repère local de la platine :
 * - l'origine `(0, 0, 0)` est le plan d'appui sur le sac ;
 * - `+Z` est la normale sortante de la platine (les deux pieds plongent vers `+Z`).
 */
export function buildPlatineMesh(spec?: ModulePlatineSpec): THREE.Group {
  const group = new THREE.Group();
  group.name = 'lkdv-platine';
  group.userData.feetCount = PLATINE_DIMENSIONS_MM.feetCount;

  const plateW = PLATINE_DIMENSIONS_MM.plateWidthMm / 1000;
  const plateH = PLATINE_DIMENSIONS_MM.plateHeightMm / 1000;
  const plateT = PLATINE_DIMENSIONS_MM.plateThicknessMm / 1000;

  const footW = PLATINE_DIMENSIONS_MM.footWidthMm / 1000;
  const footH = PLATINE_DIMENSIONS_MM.footHeightMm / 1000;
  const footD = PLATINE_DIMENSIONS_MM.footDepthMm / 1000;
  const halfSpacing = PLATINE_DIMENSIONS_MM.feetCenterSpacingMm / 2000;

  const material = new THREE.MeshPhysicalMaterial({
    name: 'lkdv-platine-material',
    color: new THREE.Color(0x181a19),
    roughness: 0.28,
    metalness: 0.12,
  });

  // Socle de la platine
  const baseGeom = new THREE.BoxGeometry(plateW, plateH, plateT);
  baseGeom.translate(0, 0, -plateT * 0.5);
  const baseMesh = new THREE.Mesh(baseGeom, material);
  baseMesh.name = 'lkdv-platine-socle';
  group.add(baseMesh);

  // Les DEUX pieds mécaniques (gauche et droit), et strictement deux
  const footOffsetsX: readonly [number, string][] = [
    [-halfSpacing, 'lkdv-platine-pied-gauche'],
    [halfSpacing, 'lkdv-platine-pied-droit'],
  ];

  for (const [offsetX, footName] of footOffsetsX) {
    const footGeom = new THREE.BoxGeometry(footW, footH, footD);
    footGeom.translate(offsetX, 0, footD * 0.5);
    const footMesh = new THREE.Mesh(footGeom, material);
    footMesh.name = footName;
    footMesh.userData.isPlatineFoot = true;
    group.add(footMesh);
  }

  if (spec) {
    const basis = buildOrthonormalBasis(spec.normal, spec.up ?? [0, 1, 0]);
    group.quaternion.setFromRotationMatrix(basis);
    group.position.set(spec.position[0], spec.position[1], spec.position[2]);
    group.updateMatrix();
  }

  return group;
}

const defaultModuleProvider: ModuleAssetProvider = {
  async fetchManifest(moduleId: string): Promise<unknown> {
    const res = await fetch(`/assets/modules/${encodeURIComponent(moduleId)}.manifest.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  async fetchGlb(moduleId: string, url?: string): Promise<ArrayBuffer> {
    const target = url ?? `/assets/modules/${encodeURIComponent(moduleId)}.glb`;
    const res = await fetch(target);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.arrayBuffer();
  },
};

function disposeObject3D(root: THREE.Object3D): void {
  const seenGeoms = new Set<THREE.BufferGeometry>();
  const seenMats = new Set<THREE.Material>();
  const seenTex = new Set<THREE.Texture>();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      if (mesh.geometry && !seenGeoms.has(mesh.geometry)) {
        seenGeoms.add(mesh.geometry);
        mesh.geometry.dispose();
      }
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : mesh.material
          ? [mesh.material]
          : [];
      for (const m of mats) {
        if (!seenMats.has(m)) {
          seenMats.add(m);
          const std = m as THREE.MeshStandardMaterial;
          for (const tex of [std.map, std.normalMap, std.roughnessMap, std.metalnessMap]) {
            if (tex && !seenTex.has(tex)) {
              seenTex.add(tex);
              tex.dispose();
            }
          }
          m.dispose();
        }
      }
    }
  });
}

/**
 * Charge un module 3D externe et lui greffe sa platine mécanique à deux pieds (§ 4.2).
 * Réutilise `decodeGlbBufferToScene` de `loader.ts` sans aucune duplication de code glTF.
 */
export async function loadModuleAsset(
  moduleId: string,
  provider: ModuleAssetProvider = defaultModuleProvider,
): Promise<ModuleLoadResult> {
  const degraded = (reason: ModuleLoadErrorReason, detail?: string): ModuleLoadDegraded => ({
    status: 'degraded',
    moduleId,
    reason,
    detail,
    dispose: () => {},
  });

  let rawManifest: unknown;
  try {
    rawManifest = await provider.fetchManifest(moduleId);
  } catch (err) {
    return degraded('manifest-fetch-failed', (err as Error)?.message);
  }

  let manifest: ModuleManifest;
  try {
    manifest = validateModuleManifest(rawManifest, moduleId);
  } catch (err) {
    return degraded('manifest-invalid', (err as Error)?.message);
  }

  let glbBuffer: ArrayBuffer;
  try {
    glbBuffer = await provider.fetchGlb(moduleId, manifest.glbUrl);
  } catch (err) {
    return degraded('glb-fetch-failed', (err as Error)?.message);
  }

  try {
    const decoded = await decodeGlbBufferToScene(glbBuffer, `module:${manifest.moduleId}`);
    let triangleCount = 0;
    decoded.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry) {
        const idx = mesh.geometry.getIndex();
        const pos = mesh.geometry.getAttribute('position');
        triangleCount += idx ? Math.floor(idx.count / 3) : pos ? Math.floor(pos.count / 3) : 0;
      }
    });
    const platineGroup = buildPlatineMesh(manifest.platine);
    decoded.root.add(platineGroup);
    decoded.root.updateMatrixWorld(true);

    let disposed = false;
    const dispose = (): void => {
      if (disposed) return;
      disposed = true;
      if (decoded.root.parent) {
        decoded.root.parent.remove(decoded.root);
      }
      decoded.dispose();
      disposeObject3D(platineGroup);
    };

    return {
      status: 'ready',
      moduleId: manifest.moduleId,
      manifest,
      root: decoded.root,
      platineGroup,
      triangleCount,
      dispose,
    };
  } catch (err) {
    return degraded('glb-parse-failed', (err as Error)?.message);
  }
}

export type AttachModuleFailureReason = 'anchor-not-found' | 'anchor-occupied';

export type AttachModuleResult =
  | {
      readonly ok: true;
      readonly anchorId: BagAnchorId;
      readonly moduleId: string;
      readonly worldPosition: Vec3Tuple;
      readonly worldForward: Vec3Tuple;
    }
  | {
      readonly ok: false;
      readonly anchorId: BagAnchorId;
      readonly reason: AttachModuleFailureReason;
      readonly occupiedByModuleId?: string;
    };

export interface ModuleAttachmentController {
  /** Monte un module chargé sur un point d'ancrage du sac. Refuse si l'ancre est occupée. */
  attach: (module: LoadedModuleAsset, anchorId: BagAnchorId) => AttachModuleResult;
  /** Dépose le module monté sur `anchorId` (sans le détruire) et libère le point d'ancrage. */
  detach: (anchorId: BagAnchorId) => LoadedModuleAsset | null;
  /** Indique si le point d'ancrage est actuellement occupé. */
  isOccupied: (anchorId: BagAnchorId) => boolean;
  /** Renvoie le module monté sur `anchorId`, ou `null`. */
  getMountedModule: (anchorId: BagAnchorId) => LoadedModuleAsset | null;
  /** Liste les identifiants de points d'ancrage connus du contrôleur. */
  listAnchors: () => readonly (BagAnchorSpec | ProvisionalBagAnchor)[];
  /** Dépose tous les modules montés et libère toutes leurs ressources GPU (`dispose()`). */
  dispose: () => void;
}

/**
 * Crée le contrôleur d'accroche des modules sur un sac (§ 4.2).
 *
 * Orientation géométrique lors de la pose :
 * - la direction sortante du module (`-platine.normal`) s'aligne sur la normale locale du point
 *   d'ancrage du sac (`anchor.normal`) ;
 * - la position du groupe racine du module est compensée de `-R * platine.position` pour que le
 *   point d'appui de la platine tombe exactement sur `anchor.position`.
 */
export function createModuleAttachmentController(
  bagRoot: THREE.Object3D,
  anchors: readonly (BagAnchorSpec | ProvisionalBagAnchor)[],
): ModuleAttachmentController {
  const anchorMap = new Map<BagAnchorId, BagAnchorSpec | ProvisionalBagAnchor>();
  for (const a of anchors) {
    anchorMap.set(a.id, a);
  }
  const occupied = new Map<BagAnchorId, LoadedModuleAsset>();

  const attach = (module: LoadedModuleAsset, anchorId: BagAnchorId): AttachModuleResult => {
    const anchor = anchorMap.get(anchorId);
    if (!anchor) {
      return { ok: false, anchorId, reason: 'anchor-not-found' };
    }
    const existing = occupied.get(anchorId);
    if (existing) {
      return {
        ok: false,
        anchorId,
        reason: 'anchor-occupied',
        occupiedByModuleId: existing.moduleId,
      };
    }

    // Si ce même module était déjà posé sur une autre ancre, on libère l'ancienne ancre.
    for (const [otherId, mounted] of occupied.entries()) {
      if (mounted === module) {
        occupied.delete(otherId);
        if (module.root.parent) module.root.parent.remove(module.root);
      }
    }

    const pNorm = module.manifest.platine.normal;
    const moduleOutward: Vec3Tuple = [-pNorm[0], -pNorm[1], -pNorm[2]];
    const moduleUp: Vec3Tuple = module.manifest.platine.up ?? [0, 1, 0];
    const anchorUp: Vec3Tuple =
      'up' in anchor && anchor.up ? anchor.up : [0, 1, 0];

    const basisModule = buildOrthonormalBasis(moduleOutward, moduleUp);
    const basisAnchor = buildOrthonormalBasis(anchor.normal, anchorUp);
    const rotMatrix = new THREE.Matrix4().multiplyMatrices(
      basisAnchor,
      basisModule.clone().transpose(),
    );

    module.root.quaternion.setFromRotationMatrix(rotMatrix);

    const platineOffset = new THREE.Vector3(
      module.manifest.platine.position[0],
      module.manifest.platine.position[1],
      module.manifest.platine.position[2],
    ).applyQuaternion(module.root.quaternion);

    module.root.position.set(
      anchor.position[0] - platineOffset.x,
      anchor.position[1] - platineOffset.y,
      anchor.position[2] - platineOffset.z,
    );
    module.root.updateMatrixWorld(true);

    bagRoot.add(module.root);
    occupied.set(anchorId, module);

    const forwardVec = new THREE.Vector3(
      moduleOutward[0],
      moduleOutward[1],
      moduleOutward[2],
    )
      .applyQuaternion(module.root.quaternion)
      .normalize();

    return {
      ok: true,
      anchorId,
      moduleId: module.moduleId,
      worldPosition: [
        module.root.position.x + platineOffset.x,
        module.root.position.y + platineOffset.y,
        module.root.position.z + platineOffset.z,
      ],
      worldForward: [forwardVec.x, forwardVec.y, forwardVec.z],
    };
  };

  const detach = (anchorId: BagAnchorId): LoadedModuleAsset | null => {
    const mounted = occupied.get(anchorId);
    if (!mounted) return null;
    occupied.delete(anchorId);
    if (mounted.root.parent) {
      mounted.root.parent.remove(mounted.root);
    }
    return mounted;
  };

  const isOccupied = (anchorId: BagAnchorId): boolean => occupied.has(anchorId);

  const getMountedModule = (anchorId: BagAnchorId): LoadedModuleAsset | null =>
    occupied.get(anchorId) ?? null;

  const listAnchors = (): readonly (BagAnchorSpec | ProvisionalBagAnchor)[] => anchors;

  const dispose = (): void => {
    for (const [anchorId, mounted] of occupied.entries()) {
      occupied.delete(anchorId);
      if (mounted.root.parent) {
        mounted.root.parent.remove(mounted.root);
      }
      mounted.dispose();
    }
  };

  return {
    attach,
    detach,
    isOccupied,
    getMountedModule,
    listAnchors,
    dispose,
  };
}
