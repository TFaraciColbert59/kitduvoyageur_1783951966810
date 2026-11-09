/**
 * src/features/kit-studio/scene/bag/moduleLoader.ts
 * Chemin complet des modules 3D externes (platine mécanique à 2 pieds, manifeste, chargeur GLB
 * mutualisé, constructeur procédural des 5 modules code et contrôleur d'accroche sur les ancres
 * auditées du sac) — § 4 + Avenant Lot I-D final.
 *
 * Principes verrouillés :
 * 1. Deux origines de modules cohabitent sur les mêmes ancres et la même platine :
 *    - 15 modules maillés `.glb` (`M01..M08, M13, M15..M20`), compressés en meshopt + quantification
 *      + WebP (< 400 Ko en 512², < 700 Ko pour M05, M17 et M20 en 1024²), géométrie intacte ;
 *    - 5 modules procéduraux construits par code (`M09, M10, M11, M12, M14`), dont les panneaux
 *      rigides partagent l'épaisseur `RIGID_PANEL_THICKNESS_MM = 3.5` mm (reprise du socle de la
 *      platine standard 80 × 54 × 3,5 mm, portée comme convention de projet et non comme mesure).
 * 2. Aucune rotation ni mise à l'échelle n'est appliquée au chargement des `.glb` (facteur 1,
 *    rotation supplémentaire 0) : `M04`, `M05` et `M16` portent déjà exactement `Y = 180°` dans
 *    leur matrice racine, et l'échelle métrique (`0,079` à `0,237`) y est déjà cuite.
 * 3. Avec une seule ancre auditée par sac (`facade`, plus `flanc-droit` sur le 80 L), le refus
 *    d'ancre occupée produit un message explicite destiné à l'utilisateur (`userMessage`).
 */

import * as THREE from 'three';
import type { BagAnchorId, BagAnchorSpec, BoundingBoxM, Vec3Tuple } from '../../domain/bagModel';
import type { ModuleFitRule, ProvisionalBagAnchor } from '../../domain/bagAnchorsTable';
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

/**
 * Épaisseur commune des panneaux rigides des modules construits par code (M09, M10, M11, M12, M14),
 * en millimètres. Reprise du socle de la platine standard (80 × 54 × 3,5 mm) et portée comme
 * convention de projet — jamais comme mesure sur prototype.
 */
export const RIGID_PANEL_THICKNESS_MM = PLATINE_DIMENSIONS_MM.plateThicknessMm;

export interface RigidPanelConventionSpec {
  readonly thicknessMm: 3.5;
  readonly status: 'convention_projet';
  readonly measuredOnPrototype: false;
  readonly source: string;
}

export const RIGID_PANEL_CONVENTION: RigidPanelConventionSpec = {
  thicknessMm: RIGID_PANEL_THICKNESS_MM,
  status: 'convention_projet',
  measuredOnPrototype: false,
  source: 'Reprise du socle de la platine standard (80 × 54 × 3,5 mm)',
};

export type ModuleOrigin = 'glb' | 'procedural';

export interface ModuleOrientationSpec {
  readonly up: 'Y';
  readonly front: '+Z';
  readonly back: '-Z';
  /** Vrai lorsque l'orientation et l'échelle sont déjà cuites dans la matrice racine du GLB. */
  readonly bakedInGlbRoot?: boolean;
  /** Rotation Y déjà présente dans la matrice racine du GLB (180° pour M04, M05, M16 ; 0° sinon). */
  readonly rootYawDegInGlb?: 0 | 180;
  /** Facteur d'échelle métrique déjà cuit dans la matrice racine du GLB (0,079 à 0,237). */
  readonly bakedScaleFactor?: number;
  /** Rotation supplémentaire à appliquer au chargement : toujours `[0, 0, 0]`. */
  readonly loadRotationDeg?: readonly [0, 0, 0];
  /** Facteur d'échelle supplémentaire à appliquer au chargement : toujours `1`. */
  readonly loadScale?: 1;
}

export interface ModuleTierAssetSpec {
  readonly url: string;
  readonly bytes: number;
  readonly triangles: number;
  readonly textureSize?: number;
}

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
  readonly code?: string;
  readonly label: string;
  readonly units: 'meters';
  readonly origin?: ModuleOrigin;
  readonly fitRule?: ModuleFitRule;
  readonly boundingBoxM: BoundingBoxM;
  readonly cotesReferenceMm?: { readonly w: number; readonly h: number; readonly d: number };
  readonly referenceState?: string;
  readonly glbUrl?: string;
  readonly orientation?: ModuleOrientationSpec;
  readonly platine: ModulePlatineSpec;
  readonly texturedSource?: boolean;
  readonly textureSize?: 512 | 1024;
  readonly reserve?: string | null;
  readonly rigidPanelConvention?: RigidPanelConventionSpec;
  readonly assets?: {
    readonly web?: ModuleTierAssetSpec;
    readonly hd?: ModuleTierAssetSpec;
  };
}

/**
 * Les 15 modules maillés `.glb` livrés dans `LKDV-ONE-LOT-I-D-FINAL.zip`
 * (`M01..M08, M13, M15..M20`).
 *
 * Tous ont leur orientation (`Y` haut, façade `+Z`, dos `-Z`, dont `Y = 180°` déjà cuit dans la
 * matrice racine de `M04`, `M05` et `M16`) et leur échelle métrique déjà cuites dans le GLB :
 * ils se chargent tous à `loadScale: 1` et `loadRotationDeg: [0, 0, 0]`.
 */
export const IMPORTED_GLB_MODULE_MANIFESTS: readonly ModuleManifest[] = [
  {
    schema: 1,
    moduleId: 'lkdv-m01',
    code: 'M01',
    label: 'Porte-gourde',
    units: 'meters',
    origin: 'glb',
    fitRule: 'face',
    glbUrl: '/assets/modules/lkdv-m01.glb',
    texturedSource: true,
    boundingBoxM: { w: 0.1098, h: 0.21, d: 0.1187 },
    cotesReferenceMm: { w: 95, h: 210, d: 95 },
    orientation: {
      up: 'Y',
      front: '+Z',
      back: '-Z',
      bakedInGlbRoot: true,
      rootYawDegInGlb: 0,
      bakedScaleFactor: 0.1106,
      loadRotationDeg: [0, 0, 0],
      loadScale: 1,
    },
    platine: { position: [0, 0.105, -0.0594], normal: [0, 0, -1] },
    textureSize: 512,
    reserve: null,
    rigidPanelConvention: RIGID_PANEL_CONVENTION,
  },
  {
    schema: 1,
    moduleId: 'lkdv-m02',
    code: 'M02',
    label: 'Poche téléphone',
    units: 'meters',
    origin: 'glb',
    fitRule: 'face',
    glbUrl: '/assets/modules/lkdv-m02.glb',
    texturedSource: true,
    boundingBoxM: { w: 0.0864, h: 0.17, d: 0.043 },
    cotesReferenceMm: { w: 90, h: 170, d: 30 },
    orientation: {
      up: 'Y',
      front: '+Z',
      back: '-Z',
      bakedInGlbRoot: true,
      rootYawDegInGlb: 0,
      bakedScaleFactor: 0.0895,
      loadRotationDeg: [0, 0, 0],
      loadScale: 1,
    },
    platine: { position: [0, 0.085, -0.0215], normal: [0, 0, -1] },
    textureSize: 512,
    reserve: null,
    rigidPanelConvention: RIGID_PANEL_CONVENTION,
  },
  {
    schema: 1,
    moduleId: 'lkdv-m03',
    code: 'M03',
    label: 'Poche GPS',
    units: 'meters',
    origin: 'glb',
    fitRule: 'face',
    glbUrl: '/assets/modules/lkdv-m03.glb',
    texturedSource: true,
    boundingBoxM: { w: 0.0773, h: 0.15, d: 0.0516 },
    cotesReferenceMm: { w: 78, h: 150, d: 38 },
    orientation: {
      up: 'Y',
      front: '+Z',
      back: '-Z',
      bakedInGlbRoot: true,
      rootYawDegInGlb: 0,
      bakedScaleFactor: 0.0791,
      loadRotationDeg: [0, 0, 0],
      loadScale: 1,
    },
    platine: { position: [0, 0.075, -0.0258], normal: [0, 0, -1] },
    textureSize: 512,
    reserve: null,
    rigidPanelConvention: RIGID_PANEL_CONVENTION,
  },
  {
    schema: 1,
    moduleId: 'lkdv-m04',
    code: 'M04',
    label: 'Poche multifonction',
    units: 'meters',
    origin: 'glb',
    fitRule: 'face',
    glbUrl: '/assets/modules/lkdv-m04.glb',
    texturedSource: true,
    boundingBoxM: { w: 0.1386, h: 0.2, d: 0.0761 },
    cotesReferenceMm: { w: 150, h: 200, d: 55 },
    orientation: {
      up: 'Y',
      front: '+Z',
      back: '-Z',
      bakedInGlbRoot: true,
      rootYawDegInGlb: 180,
      bakedScaleFactor: 0.1055,
      loadRotationDeg: [0, 0, 0],
      loadScale: 1,
    },
    platine: { position: [0, 0.1, -0.0381], normal: [0, 0, -1] },
    textureSize: 512,
    reserve:
      'Mélange recto/verso dans la texture : pictogramme projeté au dos et marquage sombre sur la façade.',
    rigidPanelConvention: RIGID_PANEL_CONVENTION,
  },
  {
    schema: 1,
    moduleId: 'lkdv-m05',
    code: 'M05',
    label: 'Grande poche cargo',
    units: 'meters',
    origin: 'glb',
    fitRule: 'face',
    glbUrl: '/assets/modules/lkdv-m05.glb',
    texturedSource: true,
    boundingBoxM: { w: 0.2618, h: 0.38, d: 0.1587 },
    cotesReferenceMm: { w: 260, h: 380, d: 120 },
    orientation: {
      up: 'Y',
      front: '+Z',
      back: '-Z',
      bakedInGlbRoot: true,
      rootYawDegInGlb: 180,
      bakedScaleFactor: 0.2001,
      loadRotationDeg: [0, 0, 0],
      loadScale: 1,
    },
    platine: { position: [0, 0.19, -0.0794], normal: [0, 0, -1] },
    textureSize: 1024,
    reserve: 'Détails de dos (filet et sangles) projetés sur la façade et le dos.',
    rigidPanelConvention: RIGID_PANEL_CONVENTION,
  },
  {
    schema: 1,
    moduleId: 'lkdv-m06',
    code: 'M06',
    label: 'Poche étanche',
    units: 'meters',
    origin: 'glb',
    fitRule: 'face',
    glbUrl: '/assets/modules/lkdv-m06.glb',
    texturedSource: true,
    boundingBoxM: { w: 0.1641, h: 0.25, d: 0.0772 },
    cotesReferenceMm: { w: 180, h: 250, d: 70 },
    orientation: {
      up: 'Y',
      front: '+Z',
      back: '-Z',
      bakedInGlbRoot: true,
      rootYawDegInGlb: 0,
      bakedScaleFactor: 0.1316,
      loadRotationDeg: [0, 0, 0],
      loadScale: 1,
    },
    platine: { position: [0, 0.125, -0.0386], normal: [0, 0, -1] },
    textureSize: 512,
    reserve: null,
    rigidPanelConvention: RIGID_PANEL_CONVENTION,
  },
  {
    schema: 1,
    moduleId: 'lkdv-m07',
    code: 'M07',
    label: 'Poche filet',
    units: 'meters',
    origin: 'glb',
    fitRule: 'face',
    glbUrl: '/assets/modules/lkdv-m07.glb',
    texturedSource: true,
    boundingBoxM: { w: 0.2237, h: 0.32, d: 0.097 },
    cotesReferenceMm: { w: 240, h: 320, d: 80 },
    orientation: {
      up: 'Y',
      front: '+Z',
      back: '-Z',
      bakedInGlbRoot: true,
      rootYawDegInGlb: 0,
      bakedScaleFactor: 0.1688,
      loadRotationDeg: [0, 0, 0],
      loadScale: 1,
    },
    platine: { position: [0, 0.16, -0.0485], normal: [0, 0, -1] },
    textureSize: 512,
    reserve: 'Filet aux faces et trous géométriques irréguliers.',
    rigidPanelConvention: RIGID_PANEL_CONVENTION,
  },
  {
    schema: 1,
    moduleId: 'lkdv-m08',
    code: 'M08',
    label: 'Porte-bâtons',
    units: 'meters',
    origin: 'glb',
    fitRule: 'face',
    glbUrl: '/assets/modules/lkdv-m08.glb',
    texturedSource: true,
    boundingBoxM: { w: 0.0449, h: 0.32, d: 0.0448 },
    cotesReferenceMm: { w: 40, h: 320, d: 45 },
    orientation: {
      up: 'Y',
      front: '+Z',
      back: '-Z',
      bakedInGlbRoot: true,
      rootYawDegInGlb: 0,
      bakedScaleFactor: 0.1685,
      loadRotationDeg: [0, 0, 0],
      loadScale: 1,
    },
    platine: { position: [0, 0.16, -0.0224], normal: [0, 0, -1] },
    textureSize: 512,
    reserve: null,
    rigidPanelConvention: RIGID_PANEL_CONVENTION,
  },
  {
    schema: 1,
    moduleId: 'lkdv-m13',
    code: 'M13',
    label: 'Porte-piolets',
    units: 'meters',
    origin: 'glb',
    fitRule: 'face',
    glbUrl: '/assets/modules/lkdv-m13.glb',
    texturedSource: true,
    boundingBoxM: { w: 0.0831, h: 0.45, d: 0.0831 },
    cotesReferenceMm: { w: 60, h: 450, d: 70 },
    orientation: {
      up: 'Y',
      front: '+Z',
      back: '-Z',
      bakedInGlbRoot: true,
      rootYawDegInGlb: 0,
      bakedScaleFactor: 0.2375,
      loadRotationDeg: [0, 0, 0],
      loadScale: 1,
    },
    platine: { position: [0, 0.225, -0.0416], normal: [0, 0, -1] },
    textureSize: 512,
    reserve: null,
    rigidPanelConvention: RIGID_PANEL_CONVENTION,
  },
  {
    schema: 1,
    moduleId: 'lkdv-m15',
    code: 'M15',
    label: 'Poche pharmacie',
    units: 'meters',
    origin: 'glb',
    fitRule: 'face',
    glbUrl: '/assets/modules/lkdv-m15.glb',
    texturedSource: true,
    boundingBoxM: { w: 0.1552, h: 0.11, d: 0.0598 },
    cotesReferenceMm: { w: 150, h: 110, d: 65 },
    orientation: {
      up: 'Y',
      front: '+Z',
      back: '-Z',
      bakedInGlbRoot: true,
      rootYawDegInGlb: 0,
      bakedScaleFactor: 0.0816,
      loadRotationDeg: [0, 0, 0],
      loadScale: 1,
    },
    platine: { position: [0, 0.055, -0.0299], normal: [0, 0, -1] },
    textureSize: 512,
    reserve: 'Superposition sombre autour de la croix.',
    rigidPanelConvention: RIGID_PANEL_CONVENTION,
  },
  {
    schema: 1,
    moduleId: 'lkdv-m16',
    code: 'M16',
    label: 'Poche batterie',
    units: 'meters',
    origin: 'glb',
    fitRule: 'face',
    glbUrl: '/assets/modules/lkdv-m16.glb',
    texturedSource: true,
    boundingBoxM: { w: 0.088, h: 0.165, d: 0.0443 },
    cotesReferenceMm: { w: 95, h: 165, d: 40 },
    orientation: {
      up: 'Y',
      front: '+Z',
      back: '-Z',
      bakedInGlbRoot: true,
      rootYawDegInGlb: 180,
      bakedScaleFactor: 0.0869,
      loadRotationDeg: [0, 0, 0],
      loadScale: 1,
    },
    platine: { position: [0, 0.0825, -0.0222], normal: [0, 0, -1] },
    textureSize: 512,
    reserve: 'Écusson peu lisible de face.',
    rigidPanelConvention: RIGID_PANEL_CONVENTION,
  },
  {
    schema: 1,
    moduleId: 'lkdv-m17',
    code: 'M17',
    label: 'Support panneau solaire',
    units: 'meters',
    origin: 'glb',
    fitRule: 'face',
    glbUrl: '/assets/modules/lkdv-m17.glb',
    texturedSource: true,
    boundingBoxM: { w: 0.2855, h: 0.38, d: 0.0478 },
    cotesReferenceMm: { w: 300, h: 380, d: 25 },
    orientation: {
      up: 'Y',
      front: '+Z',
      back: '-Z',
      bakedInGlbRoot: true,
      rootYawDegInGlb: 0,
      bakedScaleFactor: 0.2001,
      loadRotationDeg: [0, 0, 0],
      loadScale: 1,
    },
    platine: { position: [0, 0.19, -0.0239], normal: [0, 0, -1] },
    textureSize: 1024,
    reserve: null,
    rigidPanelConvention: RIGID_PANEL_CONVENTION,
  },
  {
    schema: 1,
    moduleId: 'lkdv-m18',
    code: 'M18',
    label: 'Poche photo',
    units: 'meters',
    origin: 'glb',
    fitRule: 'face',
    glbUrl: '/assets/modules/lkdv-m18.glb',
    texturedSource: true,
    boundingBoxM: { w: 0.1571, h: 0.21, d: 0.1079 },
    cotesReferenceMm: { w: 170, h: 210, d: 115 },
    orientation: {
      up: 'Y',
      front: '+Z',
      back: '-Z',
      bakedInGlbRoot: true,
      rootYawDegInGlb: 0,
      bakedScaleFactor: 0.1106,
      loadRotationDeg: [0, 0, 0],
      loadScale: 1,
    },
    platine: { position: [0, 0.105, -0.054], normal: [0, 0, -1] },
    textureSize: 512,
    reserve: null,
    rigidPanelConvention: RIGID_PANEL_CONVENTION,
  },
  {
    schema: 1,
    moduleId: 'lkdv-m19',
    code: 'M19',
    label: 'Sacoche détachable',
    units: 'meters',
    origin: 'glb',
    fitRule: 'face',
    glbUrl: '/assets/modules/lkdv-m19.glb',
    texturedSource: true,
    boundingBoxM: { w: 0.2426, h: 0.38, d: 0.1374 },
    cotesReferenceMm: { w: 250, h: 380, d: 120 },
    orientation: {
      up: 'Y',
      front: '+Z',
      back: '-Z',
      bakedInGlbRoot: true,
      rootYawDegInGlb: 0,
      bakedScaleFactor: 0.2003,
      loadRotationDeg: [0, 0, 0],
      loadScale: 1,
    },
    platine: { position: [0, 0.19, -0.0687], normal: [0, 0, -1] },
    textureSize: 512,
    reserve: null,
    rigidPanelConvention: RIGID_PANEL_CONVENTION,
  },
  {
    schema: 1,
    moduleId: 'lkdv-m20',
    code: 'M20',
    label: 'Panneau frontal interchangeable',
    units: 'meters',
    origin: 'glb',
    fitRule: 'face',
    glbUrl: '/assets/modules/lkdv-m20.glb',
    texturedSource: true,
    boundingBoxM: { w: 0.2663, h: 0.38, d: 0.0404 },
    cotesReferenceMm: { w: 300, h: 380, d: 22 },
    orientation: {
      up: 'Y',
      front: '+Z',
      back: '-Z',
      bakedInGlbRoot: true,
      rootYawDegInGlb: 0,
      bakedScaleFactor: 0.2,
      loadRotationDeg: [0, 0, 0],
      loadScale: 1,
    },
    platine: { position: [0, 0.19, -0.0202], normal: [0, 0, -1] },
    textureSize: 1024,
    reserve: null,
    rigidPanelConvention: RIGID_PANEL_CONVENTION,
  },
] as const;

/**
 * Les 5 modules construits directement par code (`M09, M10, M11, M12, M14`), qui ne viendront
 * jamais d'un `.glb` et partagent la convention d'épaisseur `RIGID_PANEL_THICKNESS_MM = 3.5` mm.
 */
export const PROCEDURAL_CODE_MODULE_MANIFESTS: readonly ModuleManifest[] = [
  {
    schema: 1,
    moduleId: 'lkdv-m09',
    code: 'M09',
    label: 'Porte-tente',
    units: 'meters',
    origin: 'procedural',
    fitRule: 'porteur',
    boundingBoxM: { w: 0.46, h: 0.16, d: 0.16 },
    cotesReferenceMm: { w: 460, h: 160, d: 160 },
    referenceState: 'charge',
    orientation: {
      up: 'Y',
      front: '+Z',
      back: '-Z',
      bakedInGlbRoot: true,
      rootYawDegInGlb: 0,
      loadRotationDeg: [0, 0, 0],
      loadScale: 1,
    },
    platine: { position: [0, 0.08, -0.08], normal: [0, 0, -1] },
    reserve: null,
    rigidPanelConvention: RIGID_PANEL_CONVENTION,
  },
  {
    schema: 1,
    moduleId: 'lkdv-m10',
    code: 'M10',
    label: 'Porte-matelas',
    units: 'meters',
    origin: 'procedural',
    fitRule: 'porteur',
    boundingBoxM: { w: 0.56, h: 0.15, d: 0.15 },
    cotesReferenceMm: { w: 560, h: 150, d: 150 },
    referenceState: 'ouvert_sans_matelas',
    orientation: {
      up: 'Y',
      front: '+Z',
      back: '-Z',
      bakedInGlbRoot: true,
      rootYawDegInGlb: 0,
      loadRotationDeg: [0, 0, 0],
      loadScale: 1,
    },
    platine: { position: [0, 0.075, -0.075], normal: [0, 0, -1] },
    reserve: null,
    rigidPanelConvention: RIGID_PANEL_CONVENTION,
  },
  {
    schema: 1,
    moduleId: 'lkdv-m11',
    code: 'M11',
    label: 'Porte-sac de couchage',
    units: 'meters',
    origin: 'procedural',
    fitRule: 'porteur',
    boundingBoxM: { w: 0.42, h: 0.23, d: 0.23 },
    cotesReferenceMm: { w: 420, h: 230, d: 230 },
    referenceState: 'ouvert_sans_sac_de_couchage',
    orientation: {
      up: 'Y',
      front: '+Z',
      back: '-Z',
      bakedInGlbRoot: true,
      rootYawDegInGlb: 0,
      loadRotationDeg: [0, 0, 0],
      loadScale: 1,
    },
    platine: { position: [0, 0.115, -0.115], normal: [0, 0, -1] },
    reserve: null,
    rigidPanelConvention: RIGID_PANEL_CONVENTION,
  },
  {
    schema: 1,
    moduleId: 'lkdv-m12',
    code: 'M12',
    label: 'Porte-casque',
    units: 'meters',
    origin: 'procedural',
    fitRule: 'porteur',
    boundingBoxM: { w: 0.28, h: 0.3, d: 0.2 },
    cotesReferenceMm: { w: 280, h: 300, d: 200 },
    referenceState: 'filet_concave_sans_casque',
    orientation: {
      up: 'Y',
      front: '+Z',
      back: '-Z',
      bakedInGlbRoot: true,
      rootYawDegInGlb: 0,
      loadRotationDeg: [0, 0, 0],
      loadScale: 1,
    },
    platine: { position: [0, 0.15, -0.1], normal: [0, 0, -1] },
    reserve: null,
    rigidPanelConvention: RIGID_PANEL_CONVENTION,
  },
  {
    schema: 1,
    moduleId: 'lkdv-m14',
    code: 'M14',
    label: 'Porte-skis (paire, A-frame)',
    units: 'meters',
    origin: 'procedural',
    fitRule: 'porteur',
    boundingBoxM: { w: 0.09, h: 1.7, d: 0.09 },
    cotesReferenceMm: { w: 90, h: 1700, d: 90 },
    referenceState: 'lame_droite_sans_skis',
    orientation: {
      up: 'Y',
      front: '+Z',
      back: '-Z',
      bakedInGlbRoot: true,
      rootYawDegInGlb: 0,
      loadRotationDeg: [0, 0, 0],
      loadScale: 1,
    },
    // La platine se pose sur la boucle basse réellement modélisée (`m14-boucle-basse-noire`,
    // à h × 0,14), et non à mi-hauteur : centrée, une paire de skis de 1,70 m plongeait de
    // 64 cm sous le fond du sac, donc à travers le plan de travail du Studio.
    platine: { position: [0, 0.238, -0.045], normal: [0, 0, -1] },
    reserve: null,
    rigidPanelConvention: RIGID_PANEL_CONVENTION,
  },
] as const;

/**
 * Catalogue complet des 20 modules 3D livrés en production (15 maillés `.glb` + 5 procéduraux).
 */
export const AVAILABLE_3D_MODULE_MANIFESTS: readonly ModuleManifest[] = [
  ...IMPORTED_GLB_MODULE_MANIFESTS,
  ...PROCEDURAL_CODE_MODULE_MANIFESTS,
] as const;

const BUILTIN_MANIFEST_BY_ID: ReadonlyMap<string, ModuleManifest> = new Map(
  AVAILABLE_3D_MODULE_MANIFESTS.map((m) => [m.moduleId, m]),
);

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
  | 'glb-parse-failed'
  | 'maillage-absent';

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
  const origin: ModuleOrigin = m.origin === 'procedural' ? 'procedural' : 'glb';
  if (m.origin !== undefined && m.origin !== 'glb' && m.origin !== 'procedural') {
    throw new Error(`Origine de module invalide : ${String(m.origin)}`);
  }
  if (m.fitRule !== undefined && m.fitRule !== 'face' && m.fitRule !== 'porteur') {
    throw new Error(`fitRule invalide : ${String(m.fitRule)}`);
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
  if (origin === 'glb' && (typeof m.glbUrl !== 'string' || m.glbUrl.length === 0)) {
    throw new Error('glbUrl manquant');
  }
  if (m.orientation !== undefined) {
    const ori = m.orientation as Record<string, unknown>;
    if (!ori || ori.up !== 'Y' || ori.front !== '+Z' || ori.back !== '-Z') {
      throw new Error('orientation invalide');
    }
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

/**
 * Construit un anneau de sangle cylindrique creux (ouvert en son centre) d'axe `X`,
 * inscrit exactement dans le diamètre extérieur `2 * outerRadius` et de largeur `widthX`.
 * Utilisé pour M10 (Porte-matelas) et M11 (Porte-sac de couchage) afin qu'ils restent
 * ouverts au centre (sans cylindre plein ni matelas/sac de couchage modélisé).
 */
function buildOpenStrapLoopGeometry(
  outerRadius: number,
  thickness: number,
  widthX: number,
  segments = 32,
): THREE.BufferGeometry {
  const innerRadius = Math.max(0.005, outerRadius - thickness);
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: widthX,
    bevelEnabled: false,
    curveSegments: segments,
  });
  geom.translate(0, 0, -widthX * 0.5);
  geom.rotateY(Math.PI * 0.5);
  return geom;
}

/**
 * Construit une nappe de filet concave ouverte (sans casque ni coque pleine) pour M12,
 * s'appuyant sur le cadre dorsal rigide (`Z = -d/2 + t`) et atteignant `Z = +d/2` au centre.
 */
function buildConcaveNetGeometry(
  w: number,
  h: number,
  d: number,
  panelThicknessM: number,
  segX = 12,
  segY = 12,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const zBack = -d * 0.5 + panelThicknessM;
  const depthSpan = Math.max(0.005, d - panelThicknessM);

  for (let iy = 0; iy <= segY; iy++) {
    const v = iy / segY;
    const y = v * h;
    for (let ix = 0; ix <= segX; ix++) {
      const u = ix / segX;
      const x = (u - 0.5) * w;
      const dome = Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
      const z = zBack + depthSpan * dome;
      positions.push(x, y, z);
    }
  }

  const stride = segX + 1;
  for (let iy = 0; iy < segY; iy++) {
    for (let ix = 0; ix < segX; ix++) {
      const a = iy * stride + ix;
      const b = a + 1;
      const c = a + stride;
      const dIdx = c + 1;
      indices.push(a, b, dIdx, a, dIdx, c);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Construit directement par code le maillage 3D d'un des 5 modules procéduraux
 * (`M09, M10, M11, M12, M14`).
 *
 * Tous les panneaux rigides utilisent la constante partagée `RIGID_PANEL_THICKNESS_MM = 3.5` mm
 * (`PLATINE_DIMENSIONS_MM.plateThicknessMm`), portée comme convention de projet.
 * Repère local identique aux modules `.glb` : `Y` haut (`[0, h]`), façade `+Z`, dos `-Z`.
 */
export function buildProceduralModuleMesh(manifest: ModuleManifest): THREE.Group {
  const group = new THREE.Group();
  group.name = `lkdv-procedural-${manifest.moduleId}`;
  group.userData.origin = 'procedural';
  group.userData.rigidPanelConvention = RIGID_PANEL_CONVENTION;
  group.userData.rigidPanelThicknessMm = RIGID_PANEL_THICKNESS_MM;

  const { w, h, d } = manifest.boundingBoxM;
  const t = RIGID_PANEL_THICKNESS_MM / 1000; // 0.0035 m (3,5 mm)

  const oliveRigidMat = new THREE.MeshPhysicalMaterial({
    name: `${manifest.moduleId}-olive-rigid`,
    color: new THREE.Color(0x3e4d3c),
    roughness: 0.88,
    metalness: 0.02,
    sheen: 0.25,
    sheenRoughness: 0.45,
  });

  const oliveSoftMat = new THREE.MeshPhysicalMaterial({
    name: `${manifest.moduleId}-olive-soft`,
    color: new THREE.Color(0x465643),
    roughness: 0.9,
    metalness: 0.01,
    sheen: 0.35,
    sheenRoughness: 0.4,
  });

  const blackStrapMat = new THREE.MeshPhysicalMaterial({
    name: `${manifest.moduleId}-black-webbing`,
    color: new THREE.Color(0x1b1e1d),
    roughness: 0.72,
    metalness: 0.06,
  });

  const code = (manifest.code ?? manifest.moduleId).toUpperCase();

  if (code.includes('M09')) {
    const fondGeom = new THREE.BoxGeometry(w, t, d);
    fondGeom.translate(0, t * 0.5, 0);
    const fondMesh = new THREE.Mesh(fondGeom, oliveRigidMat);
    fondMesh.name = 'm09-fond-rigide';
    fondMesh.userData.panelThicknessMm = RIGID_PANEL_THICKNESS_MM;
    group.add(fondMesh);

    const dosGeom = new THREE.BoxGeometry(w, h - t, t);
    dosGeom.translate(0, t + (h - t) * 0.5, -d * 0.5 + t * 0.5);
    const dosMesh = new THREE.Mesh(dosGeom, oliveRigidMat);
    dosMesh.name = 'm09-dos-rigide';
    dosMesh.userData.panelThicknessMm = RIGID_PANEL_THICKNESS_MM;
    group.add(dosMesh);

    const flancGaucheGeom = new THREE.BoxGeometry(t, h - t, d - t);
    flancGaucheGeom.translate(-w * 0.5 + t * 0.5, t + (h - t) * 0.5, t * 0.5);
    const flancGauche = new THREE.Mesh(flancGaucheGeom, oliveSoftMat);
    flancGauche.name = 'm09-flanc-gauche-souple';
    group.add(flancGauche);

    const flancDroitGeom = new THREE.BoxGeometry(t, h - t, d - t);
    flancDroitGeom.translate(w * 0.5 - t * 0.5, t + (h - t) * 0.5, t * 0.5);
    const flancDroit = new THREE.Mesh(flancDroitGeom, oliveSoftMat);
    flancDroit.name = 'm09-flanc-droit-souple';
    group.add(flancDroit);

    const facadeGeom = new THREE.BoxGeometry(w - 2 * t, (h - t) * 0.65, t);
    facadeGeom.translate(0, t + (h - t) * 0.325, d * 0.5 - t * 0.5);
    const facadeMesh = new THREE.Mesh(facadeGeom, oliveSoftMat);
    facadeMesh.name = 'm09-facade-souple';
    group.add(facadeMesh);

    const strapW = 0.025;
    for (const [offsetX, suffix] of [
      [-w * 0.28, 'gauche'],
      [w * 0.28, 'droite'],
    ] as const) {
      const strapGeom = new THREE.BoxGeometry(strapW, h - t, t);
      strapGeom.translate(offsetX, t + (h - t) * 0.5, d * 0.5 - t * 0.5);
      const strapMesh = new THREE.Mesh(strapGeom, blackStrapMat);
      strapMesh.name = `m09-sangle-compression-${suffix}`;
      group.add(strapMesh);
    }
  } else if (code.includes('M10') || code.includes('M11')) {
    const prefix = code.includes('M10') ? 'm10' : 'm11';
    const strapWidth = code.includes('M10') ? 0.028 : 0.032;
    const outerRadius = Math.min(h, d) * 0.5;

    const railH = Math.min(h, PLATINE_DIMENSIONS_MM.plateHeightMm / 1000);
    const railGeom = new THREE.BoxGeometry(w, railH, t);
    railGeom.translate(0, h * 0.5, -d * 0.5 + t * 0.5);
    const railMesh = new THREE.Mesh(railGeom, oliveRigidMat);
    railMesh.name = `${prefix}-rail-dos-rigide`;
    railMesh.userData.panelThicknessMm = RIGID_PANEL_THICKNESS_MM;
    group.add(railMesh);

    const loopCenterX = w * 0.5 - strapWidth * 0.5;
    for (const [cx, side] of [
      [-loopCenterX, 'gauche'],
      [loopCenterX, 'droite'],
    ] as const) {
      const loopGeom = buildOpenStrapLoopGeometry(outerRadius, t, strapWidth);
      loopGeom.translate(cx, h * 0.5, 0);
      const loopMesh = new THREE.Mesh(loopGeom, blackStrapMat);
      loopMesh.name = `${prefix}-boucle-ouverte-${side}`;
      loopMesh.userData.openLoop = true;
      group.add(loopMesh);
    }
  } else if (code.includes('M12')) {
    const cadreGeom = new THREE.BoxGeometry(w, h, t);
    cadreGeom.translate(0, h * 0.5, -d * 0.5 + t * 0.5);
    const cadreMesh = new THREE.Mesh(cadreGeom, oliveRigidMat);
    cadreMesh.name = 'm12-cadre-dos-rigide';
    cadreMesh.userData.panelThicknessMm = RIGID_PANEL_THICKNESS_MM;
    group.add(cadreMesh);

    const netMat = new THREE.MeshPhysicalMaterial({
      name: 'm12-filet-noir',
      color: new THREE.Color(0x1f2321),
      roughness: 0.82,
      metalness: 0.04,
      side: THREE.DoubleSide,
      wireframe: true,
    });
    const netGeom = buildConcaveNetGeometry(w, h, d, t);
    const netMesh = new THREE.Mesh(netGeom, netMat);
    netMesh.name = 'm12-nappe-filet-concave';
    netMesh.userData.isConcaveOpenNet = true;
    group.add(netMesh);

    const cordT = 0.004;
    for (const [cx, cy, cornerName] of [
      [-w * 0.5 + cordT, h - cordT, 'haut-gauche'],
      [w * 0.5 - cordT, h - cordT, 'haut-droit'],
      [-w * 0.5 + cordT, cordT, 'bas-gauche'],
      [w * 0.5 - cordT, cordT, 'bas-droit'],
    ] as const) {
      const cordGeom = new THREE.BoxGeometry(cordT, cordT, d * 0.35);
      cordGeom.translate(cx, cy, -d * 0.5 + t + d * 0.175);
      const cordMesh = new THREE.Mesh(cordGeom, blackStrapMat);
      cordMesh.name = `m12-cordon-${cornerName}`;
      group.add(cordMesh);
    }
  } else if (code.includes('M14')) {
    const lameGeom = new THREE.BoxGeometry(w, h, t);
    lameGeom.translate(0, h * 0.5, -d * 0.5 + t * 0.5);
    const lameMesh = new THREE.Mesh(lameGeom, oliveRigidMat);
    lameMesh.name = 'm14-lame-rigide-droite';
    lameMesh.userData.panelThicknessMm = RIGID_PANEL_THICKNESS_MM;
    lameMesh.userData.aspectRatioHL = h / w;
    group.add(lameMesh);

    const strapH = 0.028;
    const brideHauteGeom = new THREE.BoxGeometry(w, strapH, d - t);
    brideHauteGeom.translate(0, h * 0.82, t * 0.5);
    const brideHaute = new THREE.Mesh(brideHauteGeom, blackStrapMat);
    brideHaute.name = 'm14-bride-haute-noire';
    group.add(brideHaute);

    const boucleBasseGeom = new THREE.BoxGeometry(w, strapH * 1.2, d - t);
    boucleBasseGeom.translate(0, h * 0.14, t * 0.5);
    const boucleBasse = new THREE.Mesh(boucleBasseGeom, blackStrapMat);
    boucleBasse.name = 'm14-boucle-basse-noire';
    group.add(boucleBasse);
  } else {
    const panelGeom = new THREE.BoxGeometry(w, h, t);
    panelGeom.translate(0, h * 0.5, -d * 0.5 + t * 0.5);
    const panelMesh = new THREE.Mesh(panelGeom, oliveRigidMat);
    panelMesh.name = `${manifest.moduleId}-panneau-rigide`;
    panelMesh.userData.panelThicknessMm = RIGID_PANEL_THICKNESS_MM;
    group.add(panelMesh);

    if (d > t) {
      const bodyGeom = new THREE.BoxGeometry(w, h, d - t);
      bodyGeom.translate(0, h * 0.5, t * 0.5);
      const bodyMesh = new THREE.Mesh(bodyGeom, oliveSoftMat);
      bodyMesh.name = `${manifest.moduleId}-corps-proceduraux`;
      group.add(bodyMesh);
    }
  }

  return group;
}

export const defaultModuleProvider: ModuleAssetProvider = {
  async fetchManifest(moduleId: string): Promise<unknown> {
    const builtin = BUILTIN_MANIFEST_BY_ID.get(moduleId);
    if (typeof fetch !== 'function') {
      if (builtin) return builtin;
      throw new Error('fetch indisponible');
    }
    try {
      const res = await fetch(`/assets/modules/${encodeURIComponent(moduleId)}.manifest.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (builtin) return builtin;
      throw err;
    }
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

function countTrianglesInObject(root: THREE.Object3D): number {
  let triangleCount = 0;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry) {
      const idx = mesh.geometry.getIndex();
      const pos = mesh.geometry.getAttribute('position');
      triangleCount += idx ? Math.floor(idx.count / 3) : pos ? Math.floor(pos.count / 3) : 0;
    }
  });
  return triangleCount;
}

/**
 * Charge un module 3D externe (maillé `.glb` ou procédural construit par code) **sans lui appliquer
 * aucune rotation ni mise à l'échelle supplémentaire** (facteur 1, rotation 0) et lui greffe sa
 * platine mécanique standard à deux pieds (§ 2 & § 3 de l'avenant).
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

  const origin: ModuleOrigin = manifest.origin === 'procedural' ? 'procedural' : 'glb';

  if (origin === 'procedural') {
    // Règle produit : le Studio n'affiche que des maillages réels. Un module sans `.glb` n'est
    // plus représenté par une forme dessinée à la main — il est signalé comme non disponible,
    // pour qu'on sache qu'il manque au lieu de croire qu'on le voit.
    return degraded('maillage-absent', `Aucun maillage publié pour ${manifest.moduleId}.`);
  }

  let glbBuffer: ArrayBuffer;
  try {
    glbBuffer = await provider.fetchGlb(moduleId, manifest.glbUrl);
  } catch (err) {
    return degraded('glb-fetch-failed', (err as Error)?.message);
  }

  try {
    const decoded = await decodeGlbBufferToScene(glbBuffer, `module:${manifest.moduleId}`);
    const triangleCount = countTrianglesInObject(decoded.root);

    // § 2 de l'avenant : N'appliquer AUCUNE rotation ni mise à l'échelle (facteur 1, rotation 0).
    // M04, M05 et M16 portent déjà exactement Y = 180° dans leur matrice racine, et l'échelle
    // métrique (0,079 à 0,237) est déjà cuite dans les nœuds du GLB.
    decoded.root.scale.set(1, 1, 1);
    decoded.root.rotation.set(0, 0, 0);
    decoded.root.userData.origin = 'glb';
    decoded.root.userData.loadScale = 1;
    decoded.root.userData.loadRotationDeg = [0, 0, 0];
    decoded.root.userData.reserve = manifest.reserve ?? null;

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
      readonly userMessage: string;
    };

/**
 * Construit le message lisible destiné à l'utilisateur lorsqu'une pose de module est refusée (§ 4.3).
 */
export function formatModuleAttachFailureNotice(
  failure: {
    readonly anchorId: BagAnchorId;
    readonly reason: AttachModuleFailureReason;
    readonly occupiedByModuleId?: string;
    readonly occupiedByLabel?: string;
    readonly anchorLabel?: string;
  },
): string {
  const anchorText = failure.anchorLabel ?? failure.anchorId;
  if (failure.reason === 'anchor-occupied') {
    const modText = failure.occupiedByLabel
      ? `${failure.occupiedByLabel} (${failure.occupiedByModuleId ?? ''})`.trim()
      : (failure.occupiedByModuleId ?? 'un autre module');
    return `Point d’accroche « ${anchorText} » déjà occupé par ${modText} : déposez le module en place avant d’en poser un autre.`;
  }
  return `Point d’accroche « ${anchorText} » introuvable sur ce sac.`;
}

export interface ModuleAttachmentControllerOptions {
  /** Appelé à chaque refus de pose (message utilisateur) ou remise à zéro (`null`). */
  readonly onNoticeChange?: (notice: string | null) => void;
  /** Appelé à chaque modification du montage d'un module (attachement, détachement). */
  readonly onAttachmentChange?: () => void;
  readonly reducedMotion?: boolean;
}

export interface ModuleAttachmentController {
  /** Monte un module chargé sur un point d'ancrage du sac. Refuse et avertit si l'ancre est occupée. */
  attach: (module: LoadedModuleAsset, anchorId: BagAnchorId) => AttachModuleResult;
  /** Dépose le module monté sur `anchorId` (sans le détruire) et libère le point d'ancrage. */
  detach: (anchorId: BagAnchorId) => LoadedModuleAsset | null;
  /** Indique si le point d'ancrage est actuellement occupé. */
  isOccupied: (anchorId: BagAnchorId) => boolean;
  /** Renvoie le module monté sur `anchorId`, ou `null`. */
  getMountedModule: (anchorId: BagAnchorId) => LoadedModuleAsset | null;
  /** Dernier message utilisateur de refus d'accroche (ex. ancre occupée sur un sac à 1 ancre). */
  getLastRejectionNotice: () => string | null;
  /** Liste les identifiants de points d'ancrage connus du contrôleur. */
  listAnchors: () => readonly (BagAnchorSpec | ProvisionalBagAnchor)[];
  /** Avance les micro-animations de translation des modules (250-350 ms). */
  advance?: (dt: number) => boolean;
  /** Dépose tous les modules montés et libère toutes leurs ressources GPU (`dispose()`). */
  dispose: () => void;
}

/**
 * Crée le contrôleur d'accroche des modules sur un sac (§ 4.2 & § 4.3).
 */
export function createModuleAttachmentController(
  bagRoot: THREE.Object3D,
  anchors: readonly (BagAnchorSpec | ProvisionalBagAnchor)[],
  options?: ModuleAttachmentControllerOptions,
): ModuleAttachmentController {
  const anchorMap = new Map<BagAnchorId, BagAnchorSpec | ProvisionalBagAnchor>();
  for (const a of anchors) {
    anchorMap.set(a.id, a);
  }
  const occupied = new Map<BagAnchorId, LoadedModuleAsset>();
  const animating = new Map<
    string,
    {
      targetPos: THREE.Vector3;
      module: LoadedModuleAsset;
      remaining: number;
    }
  >();
  let lastRejectionNotice: string | null = null;

  const setNotice = (notice: string | null): void => {
    lastRejectionNotice = notice;
    options?.onNoticeChange?.(notice);
  };

  const attach = (module: LoadedModuleAsset, anchorId: BagAnchorId): AttachModuleResult => {
    const anchor = anchorMap.get(anchorId);
    if (!anchor) {
      const userMessage = formatModuleAttachFailureNotice({
        anchorId,
        reason: 'anchor-not-found',
      });
      setNotice(userMessage);
      return { ok: false, anchorId, reason: 'anchor-not-found', userMessage };
    }
    const existing = occupied.get(anchorId);
    if (existing) {
      const anchorLabel = 'label' in anchor && typeof anchor.label === 'string' ? anchor.label : anchor.id;
      const userMessage = formatModuleAttachFailureNotice({
        anchorId,
        anchorLabel,
        reason: 'anchor-occupied',
        occupiedByModuleId: existing.moduleId,
        occupiedByLabel: existing.manifest.label,
      });
      setNotice(userMessage);
      return {
        ok: false,
        anchorId,
        reason: 'anchor-occupied',
        occupiedByModuleId: existing.moduleId,
        userMessage,
      };
    }

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

    const targetPos = new THREE.Vector3(
      anchor.position[0] - platineOffset.x,
      anchor.position[1] - platineOffset.y,
      anchor.position[2] - platineOffset.z,
    );

    if (options?.reducedMotion) {
      module.root.position.copy(targetPos);
    } else {
      const normalOffset = new THREE.Vector3(
        anchor.normal[0],
        anchor.normal[1],
        anchor.normal[2],
      ).multiplyScalar(0.08);
      module.root.position.copy(targetPos).add(normalOffset);
      animating.set(module.moduleId, {
        targetPos,
        module,
        remaining: 0.32,
      });
    }
    module.root.updateMatrixWorld(true);

    bagRoot.add(module.root);
    occupied.set(anchorId, module);
    setNotice(null);
    options?.onAttachmentChange?.();

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
        targetPos.x + platineOffset.x,
        targetPos.y + platineOffset.y,
        targetPos.z + platineOffset.z,
      ],
      worldForward: [forwardVec.x, forwardVec.y, forwardVec.z],
    };
  };

  const detach = (anchorId: BagAnchorId): LoadedModuleAsset | null => {
    const mounted = occupied.get(anchorId);
    if (!mounted) return null;
    occupied.delete(anchorId);
    animating.delete(mounted.moduleId);
    if (mounted.root.parent) {
      mounted.root.parent.remove(mounted.root);
    }
    setNotice(null);
    options?.onAttachmentChange?.();
    return mounted;
  };

  const isOccupied = (anchorId: BagAnchorId): boolean => occupied.has(anchorId);

  const getMountedModule = (anchorId: BagAnchorId): LoadedModuleAsset | null =>
    occupied.get(anchorId) ?? null;

  const getLastRejectionNotice = (): string | null => lastRejectionNotice;

  const listAnchors = (): readonly (BagAnchorSpec | ProvisionalBagAnchor)[] => anchors;

  const advance = (dt: number): boolean => {
    let moving = false;
    for (const [id, anim] of animating.entries()) {
      anim.remaining -= dt;
      if (anim.remaining <= 0) {
        anim.module.root.position.copy(anim.targetPos);
        anim.module.root.updateMatrixWorld(true);
        animating.delete(id);
      } else {
        const factor = 1 - Math.exp(-12 * dt);
        anim.module.root.position.lerp(anim.targetPos, factor);
        anim.module.root.updateMatrixWorld(true);
        moving = true;
      }
    }
    return moving;
  };

  const dispose = (): void => {
    animating.clear();
    for (const [anchorId, mounted] of occupied.entries()) {
      occupied.delete(anchorId);
      if (mounted.root.parent) {
        mounted.root.parent.remove(mounted.root);
      }
      mounted.dispose();
    }
    setNotice(null);
    options?.onAttachmentChange?.();
  };

  return {
    attach,
    detach,
    isOccupied,
    getMountedModule,
    getLastRejectionNotice,
    listAnchors,
    advance,
    dispose,
  };
}
