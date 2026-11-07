/**
 * src/features/kit-studio/domain/bagAnchorsTable.ts
 * Table des 6 points d'accroche audités des sacs LKDV ONE (§ 4.1) et règle géométrique de
 * compatibilité module ↔ sac avec garde de 15 % au bord (§ 4.2).
 *
 * IMPORTANT — Portée des coordonnées :
 * Ces coordonnées valent **pour le rendu du Studio et non pour la fabrication** : elles décrivent
 * un maillage photogrammétrique, pas un patron de coupe, et la position des coutures reste inconnue.
 *
 * Audit géométrique sur les cinq sacs (sondage de planéité sur les maillages, ~260 centres
 * candidats par face, composition de zone sous une empreinte de 80 × 54 mm, notation pondérée sur
 * neuf critères) :
 * - Une ancre par sac (`facade`), deux sur le 80 L (`facade` + `flanc-droit`).
 * - Les emplacements `dos`, `dessous`, `top-lid` et les flancs des quatre premiers sacs sont
 *   écartés (et non simplement affaiblis) : le dos est le harnais contre les lombaires (note 0 en
 *   ergonomie, rédhibitoire), le dessous est la face qu'on pose au sol, et les flancs des petits
 *   sacs bâillent jusqu'à 7,62 mm.
 */

import type { BagAnchorSpec, BagManifest, BoundingBoxM, Vec3Tuple } from './bagModel';

export type BagAnchorZone = 'facade' | 'flanc-droit';

export interface AuditedBagAnchor extends BagAnchorSpec {
  readonly label: string;
  readonly zone: BagAnchorZone;
  /** Vecteur « haut » local pour verrouiller le roulis de la platine. */
  readonly up: Vec3Tuple;
}

/** Alias conservé pour la compatibilité de typage du chargeur et des contrôleurs. */
export type ProvisionalBagAnchor = AuditedBagAnchor;

/**
 * Garde au bord de 15 % appliquée sur la largeur et la hauteur de la face porteuse du sac (§ 4.2).
 */
export const MODULE_FACE_MARGIN_RATIO = 0.15;

/** Dimensions réelles des boîtes englobantes des sacs LKDV ONE (en mètres). */
export const LKDV_ONE_BAG_BBOXES: Readonly<Record<string, BoundingBoxM>> = {
  'lkdv-one-15': { w: 0.284, h: 0.46, d: 0.2341 },
  'lkdv-one-25': { w: 0.2883, h: 0.52, d: 0.2193 },
  'lkdv-one-45': { w: 0.4329, h: 0.66, d: 0.3083 },
  'lkdv-one-60': { w: 0.4172, h: 0.74, d: 0.339 },
  'lkdv-one-80': { w: 0.5445, h: 0.8, d: 0.3745 },
};

/**
 * Les six ancres auditées des cinq sacs LKDV ONE — une par sac (`facade`), deux sur le 80 L
 * (`facade` et `flanc-droit`).
 *
 * Repère de chaque sac : origine au centre du fond, Y vers le haut, +Z vers la façade.
 * Ces coordonnées valent pour le rendu du Studio et non pour la fabrication : elles décrivent un
 * maillage photogrammétrique, pas un patron de coupe, et la position des coutures reste inconnue.
 */
export const LKDV_ONE_AUDITED_ANCHORS: Readonly<Record<string, readonly AuditedBagAnchor[]>> = {
  'lkdv-one-15': [
    {
      id: 'facade',
      label: 'Façade',
      zone: 'facade',
      position: [0, 0.171, 0.113],
      normal: [0, 0, 1],
      up: [0, 1, 0],
    },
  ],
  'lkdv-one-25': [
    {
      id: 'facade',
      label: 'Façade',
      zone: 'facade',
      position: [0, 0.229, 0.107],
      normal: [0, 0, 1],
      up: [0, 1, 0],
    },
  ],
  'lkdv-one-45': [
    {
      id: 'facade',
      label: 'Façade',
      zone: 'facade',
      position: [0, 0.213, 0.124],
      normal: [0, 0, 1],
      up: [0, 1, 0],
    },
  ],
  'lkdv-one-60': [
    {
      id: 'facade',
      label: 'Façade',
      zone: 'facade',
      position: [0, 0.164, 0.138],
      normal: [0, 0, 1],
      up: [0, 1, 0],
    },
  ],
  'lkdv-one-80': [
    {
      id: 'facade',
      label: 'Façade',
      zone: 'facade',
      position: [0, 0.362, 0.182],
      normal: [0, 0, 1],
      up: [0, 1, 0],
    },
    {
      id: 'flanc-droit',
      label: 'Flanc droit',
      zone: 'flanc-droit',
      position: [0.178, 0.476, 0.092],
      normal: [1, 0, 0],
      up: [0, 1, 0],
    },
  ],
} as const;

/** Alias maintenu pour les imports existants qui référencent `LKDV_ONE_PROVISIONAL_ANCHORS`. */
export const LKDV_ONE_PROVISIONAL_ANCHORS = LKDV_ONE_AUDITED_ANCHORS;

/**
 * Dérive l'ancre de façade unique à partir d'une boîte englobante `boundingBoxM` pour un gabarit
 * non répertorié (jamais de dos, de dessous ni de rabat supérieur).
 */
export function deriveAnchorsFromBoundingBox(bbox: BoundingBoxM): readonly AuditedBagAnchor[] {
  return [
    {
      id: 'facade',
      label: 'Façade',
      zone: 'facade',
      position: [0, round4(bbox.h * 0.36), round4(bbox.d * 0.44)],
      normal: [0, 0, 1],
      up: [0, 1, 0],
    },
  ];
}

/**
 * Résout les points d'accroche d'un sac :
 * 1. Si le modèle figure dans `LKDV_ONE_AUDITED_ANCHORS`, ses ancres auditées font foi.
 * 2. Sinon, si le manifeste déclare des emplacements `kind === 'attachment'`, on les utilise.
 * 3. À défaut, on dérive l'ancre de façade depuis `manifest.boundingBoxM`.
 */
export function resolveBagAttachmentAnchors(
  manifest: Pick<BagManifest, 'modelId' | 'boundingBoxM' | 'slots'>,
): readonly AuditedBagAnchor[] {
  const tableEntry = LKDV_ONE_AUDITED_ANCHORS[manifest.modelId];
  if (tableEntry) return tableEntry;

  const fromManifest = manifest.slots.filter((s) => s.kind === 'attachment');
  if (fromManifest.length > 0) {
    return fromManifest.map((s) => ({
      id: s.id,
      label: s.id,
      zone: inferZoneFromNormal(s.normal),
      position: [...s.anchor] as Vec3Tuple,
      normal: [...s.normal] as Vec3Tuple,
      up: [0, 1, 0] as Vec3Tuple,
    }));
  }
  return deriveAnchorsFromBoundingBox(manifest.boundingBoxM);
}

/**
 * Règle d'encombrement d'un module 3D sur le sac :
 * - `face` : poches et pochettes se posant dans une face (garde de 15 %, max 85 % de la face) ;
 * - `porteur` : modules conçus pour déborder (ne vérifie que l'empreinte de la platine 80 × 54 mm
 *   et l'existence d'une ancre sur le sac).
 */
export type ModuleFitRule = 'face' | 'porteur';

/**
 * Empreinte mécanique standard de la platine LKDV, en mètres (80 × 54 mm).
 */
export const PLATINE_FOOTPRINT_M = {
  w: 0.08,
  h: 0.054,
} as const;

/**
 * Dimensions utiles `(faceWidthM, faceHeightM)` de la face porteuse d'une ancre sur un sac.
 * - Sur `facade` (normale selon `±Z`), la face porteuse a pour largeur `bagBbox.w` et hauteur `bagBbox.h`.
 * - Sur `flanc-droit` (normale selon `±X`), la face porteuse a pour largeur `bagBbox.d` et hauteur `bagBbox.h`.
 */
export function getAnchorFaceDimensionsM(
  bagBbox: BoundingBoxM,
  anchorZone: BagAnchorZone = 'facade',
): { readonly faceWidthM: number; readonly faceHeightM: number } {
  const faceWidthM = anchorZone === 'flanc-droit' ? bagBbox.d : bagBbox.w;
  return { faceWidthM, faceHeightM: bagBbox.h };
}

/**
 * Vérifie par calcul géométrique si un module de boîte `moduleBbox` (`w × h`) rentre sur une face de sac `bagBbox`.
 * - Si `fitRule === 'porteur'` : vérifie uniquement l'empreinte de la platine (80 × 54 mm).
 * - Sinon (`face`) : vérifie que le module rentre avec la garde au bord de 15 %
 *   (`MODULE_FACE_MARGIN_RATIO = 0.15`, soit au plus 85 % de la largeur et 85 % de la hauteur de la face).
 */
export function doesModuleFitBagFace(
  moduleItem: {
    readonly boundingBoxM: Pick<BoundingBoxM, 'w' | 'h'>;
    readonly fitRule?: ModuleFitRule;
  },
  bagBbox: BoundingBoxM,
  anchorZone: BagAnchorZone = 'facade',
  marginRatio: number = MODULE_FACE_MARGIN_RATIO,
): boolean {
  const { faceWidthM, faceHeightM } = getAnchorFaceDimensionsM(bagBbox, anchorZone);
  if (moduleItem.fitRule === 'porteur') {
    // Porteur : ne vérifie que l'empreinte de la platine standard 80 × 54 mm (0,08 × 0,054 m)
    return faceWidthM >= PLATINE_FOOTPRINT_M.w - 1e-6 && faceHeightM >= PLATINE_FOOTPRINT_M.h - 1e-6;
  }
  const usableFactor = Math.max(0, 1 - marginRatio);
  const maxWidthM = faceWidthM * usableFactor;
  const maxHeightM = faceHeightM * usableFactor;
  return moduleItem.boundingBoxM.w <= maxWidthM + 1e-6 && moduleItem.boundingBoxM.h <= maxHeightM + 1e-6;
}

/**
 * Vérifie si un module rentre sur au moins l'une des ancres auditées du sac.
 * - Exige l'existence d'au moins une ancre sur le sac (retourne false si sac sans ancre).
 * - Pour `porteur`, valide dès qu'au moins une ancre accueille l'empreinte de la platine 80 × 54 mm.
 * - Pour `face`, valide si la boîte rentre à 85 % sur la face de l'ancre.
 */
export function doesModuleFitBag(
  moduleItem: {
    readonly boundingBoxM: Pick<BoundingBoxM, 'w' | 'h'>;
    readonly fitRule?: ModuleFitRule;
  },
  bag: Pick<BagManifest, 'modelId' | 'boundingBoxM'> & {
    readonly slots?: BagManifest['slots'];
  },
  marginRatio: number = MODULE_FACE_MARGIN_RATIO,
): boolean {
  const anchors = resolveBagAttachmentAnchors({
    modelId: bag.modelId,
    boundingBoxM: bag.boundingBoxM,
    slots: bag.slots ?? [],
  });
  if (anchors.length === 0) return false;
  return anchors.some((anchor) =>
    doesModuleFitBagFace(moduleItem, bag.boundingBoxM, anchor.zone, marginRatio),
  );
}

/**
 * Calcule géométriquement la mention de débordement d'un module porteur sur un sac.
 *
 * Évalue le dépassement au-dessus du sac, en largeur et sous le sac selon la position
 * de l'ancre et de la platine du module.
 *
 * Retourne la chaîne explicite (ex. « dépasse de 56 cm au-dessus du sac »,
 * « dépasse de 28 cm en largeur ») ou `null` si le module ne déborde pas ou n'est pas un porteur.
 */
export function calculateModuleOverflowNotice(
  moduleItem: {
    readonly boundingBoxM: Pick<BoundingBoxM, 'w' | 'h'>;
    readonly platine?: { readonly position: Vec3Tuple };
    readonly fitRule?: ModuleFitRule;
  },
  bag: Pick<BagManifest, 'modelId' | 'boundingBoxM'> & {
    readonly slots?: BagManifest['slots'];
  },
  preferredAnchor?: ProvisionalBagAnchor | BagAnchorSpec | null,
): string | null {
  if (moduleItem.fitRule !== 'porteur') {
    return null;
  }

  const anchors = resolveBagAttachmentAnchors({
    modelId: bag.modelId,
    boundingBoxM: bag.boundingBoxM,
    slots: bag.slots ?? [],
  });
  if (anchors.length === 0) return null;
  const anchor = preferredAnchor ?? anchors[0];

  const zone =
    'zone' in anchor && typeof (anchor as ProvisionalBagAnchor).zone === 'string'
      ? (anchor as ProvisionalBagAnchor).zone
      : inferZoneFromNormal(anchor.normal);
  const faceDims = getAnchorFaceDimensionsM(bag.boundingBoxM, zone);
  const widthOverflowM = Math.max(0, moduleItem.boundingBoxM.w - faceDims.faceWidthM);

  const anchorY = anchor.position[1];
  const platineY = moduleItem.platine?.position?.[1] ?? (moduleItem.boundingBoxM.h * 0.5);
  const moduleTop = anchorY + (moduleItem.boundingBoxM.h - platineY);
  const moduleBottom = anchorY - platineY;

  const topOverflowM = Math.max(0, moduleTop - bag.boundingBoxM.h);
  const bottomOverflowM = Math.max(0, -moduleBottom);

  const topCm = Math.round(topOverflowM * 100);
  const widthCm = Math.round(widthOverflowM * 100);
  const bottomCm = Math.round(bottomOverflowM * 100);

  if (topCm <= 0 && widthCm <= 0 && bottomCm <= 0) {
    return null;
  }

  if (topCm > 0 && widthCm > 0) {
    return `dépasse de ${topCm} cm au-dessus du sac et de ${widthCm} cm en largeur`;
  }
  if (topCm > 0) {
    return `dépasse de ${topCm} cm au-dessus du sac`;
  }
  if (widthCm > 0) {
    return `dépasse de ${widthCm} cm en largeur`;
  }
  return `dépasse de ${bottomCm} cm sous le sac`;
}

/**
 * Filtre une liste de modules pour ne retenir que ceux compatibles avec le sac (§ 4.2 & Suite Porteurs).
 */
export function filterCompatibleModulesForBag<
  T extends {
    readonly boundingBoxM: Pick<BoundingBoxM, 'w' | 'h'>;
    readonly fitRule?: ModuleFitRule;
  },
>(
  modules: readonly T[],
  bag: Pick<BagManifest, 'modelId' | 'boundingBoxM'> & {
    readonly slots?: BagManifest['slots'];
  },
  marginRatio: number = MODULE_FACE_MARGIN_RATIO,
): readonly T[] {
  return modules.filter((mod) => doesModuleFitBag(mod, bag, marginRatio));
}

function inferZoneFromNormal(normal: Vec3Tuple): BagAnchorZone {
  const [nx, , nz] = normal;
  if (Math.abs(nx) > Math.abs(nz)) return 'flanc-droit';
  return 'facade';
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
