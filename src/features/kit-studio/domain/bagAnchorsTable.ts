/**
 * src/features/kit-studio/domain/bagAnchorsTable.ts
 * Table lisible des points d'accroche provisoires des sacs LKDV ONE (§ 4.2).
 *
 * Les cinq manifestes `public/assets/bags/lkdv-one-*.manifest.json` déclarent aujourd'hui
 * `attachmentPoints: []`. Cette table isolée propose un jeu initial cohérent (façade haute,
 * façade basse, flanc gauche, flanc droit, dessus) déduit des dimensions réelles `boundingBoxM`
 * de chaque sac, dans le repère du modèle (`y = 0` au centre du sol, `+z` vers la façade avant,
 * `-x` flanc gauche, `+x` flanc droit, `+y` vers le haut).
 *
 * Tony peut retoucher directement les coordonnées ou les étiquettes dans `LKDV_ONE_PROVISIONAL_ANCHORS`
 * sans toucher au code du chargeur ni de la scène. Dès qu'un manifeste de sac déclarera ses
 * propres emplacements `kind: 'attachment'`, ceux du manifeste prendront automatiquement le dessus.
 */

import type { BagAnchorSpec, BagManifest, BoundingBoxM, Vec3Tuple } from './bagModel';

export type BagAnchorZone = 'facade' | 'flanc-gauche' | 'flanc-droit' | 'dessus';

export interface ProvisionalBagAnchor extends BagAnchorSpec {
  readonly label: string;
  readonly zone: BagAnchorZone;
  /** Vecteur « haut » local optionnel pour verrouiller le roulis de la platine. */
  readonly up?: Vec3Tuple;
}

/**
 * Calcule un jeu standard de 5 points d'accroche à partir d'une boîte englobante `boundingBoxM`.
 * Utile pour vérifier la cohérence géométrique ou couvrir un gabarit non listé.
 */
export function deriveAnchorsFromBoundingBox(bbox: BoundingBoxM): readonly ProvisionalBagAnchor[] {
  const halfW = round4(bbox.w * 0.46);
  const frontZ = round4(bbox.d * 0.48);
  const sideZ = round4(bbox.d * 0.04);
  const topZ = round4(-bbox.d * 0.05);

  return [
    {
      id: 'front-upper',
      label: 'Façade haute',
      zone: 'facade',
      position: [0, round4(bbox.h * 0.62), frontZ],
      normal: [0, 0, 1],
      up: [0, 1, 0],
    },
    {
      id: 'front-lower',
      label: 'Façade basse',
      zone: 'facade',
      position: [0, round4(bbox.h * 0.30), frontZ],
      normal: [0, 0, 1],
      up: [0, 1, 0],
    },
    {
      id: 'side-left',
      label: 'Flanc gauche',
      zone: 'flanc-gauche',
      position: [-halfW, round4(bbox.h * 0.42), sideZ],
      normal: [-1, 0, 0],
      up: [0, 1, 0],
    },
    {
      id: 'side-right',
      label: 'Flanc droit',
      zone: 'flanc-droit',
      position: [halfW, round4(bbox.h * 0.42), sideZ],
      normal: [1, 0, 0],
      up: [0, 1, 0],
    },
    {
      id: 'top-lid',
      label: 'Dessus (rabat)',
      zone: 'dessus',
      position: [0, round4(bbox.h * 0.96), topZ],
      normal: [0, 1, 0],
      up: [0, 0, -1],
    },
  ];
}

/**
 * Table éditable par Tony — coordonnées en mètres dans le repère de chaque sac LKDV ONE.
 *
 * Dimensions de référence (`boundingBoxM` des manifestes) :
 * - `lkdv-one-15` : w = 0.2840 m, h = 0.4600 m, d = 0.2341 m
 * - `lkdv-one-25` : w = 0.2883 m, h = 0.5200 m, d = 0.2193 m
 * - `lkdv-one-45` : w = 0.4329 m, h = 0.6600 m, d = 0.3083 m
 * - `lkdv-one-60` : w = 0.4172 m, h = 0.7400 m, d = 0.3390 m
 * - `lkdv-one-80` : w = 0.5445 m, h = 0.8000 m, d = 0.3745 m
 */
export const LKDV_ONE_PROVISIONAL_ANCHORS: Readonly<Record<string, readonly ProvisionalBagAnchor[]>> = {
  'lkdv-one-15': [
    { id: 'front-upper', label: 'Façade haute',   zone: 'facade',       position: [0,       0.2852,  0.1124], normal: [0, 0, 1],  up: [0, 1, 0] },
    { id: 'front-lower', label: 'Façade basse',   zone: 'facade',       position: [0,       0.1380,  0.1124], normal: [0, 0, 1],  up: [0, 1, 0] },
    { id: 'side-left',   label: 'Flanc gauche',   zone: 'flanc-gauche', position: [-0.1306, 0.1932,  0.0094], normal: [-1, 0, 0], up: [0, 1, 0] },
    { id: 'side-right',  label: 'Flanc droit',    zone: 'flanc-droit',  position: [0.1306,  0.1932,  0.0094], normal: [1, 0, 0],  up: [0, 1, 0] },
    { id: 'top-lid',     label: 'Dessus (rabat)', zone: 'dessus',       position: [0,       0.4416, -0.0117], normal: [0, 1, 0],  up: [0, 0, -1] },
  ],
  'lkdv-one-25': [
    { id: 'front-upper', label: 'Façade haute',   zone: 'facade',       position: [0,       0.3224,  0.1053], normal: [0, 0, 1],  up: [0, 1, 0] },
    { id: 'front-lower', label: 'Façade basse',   zone: 'facade',       position: [0,       0.1560,  0.1053], normal: [0, 0, 1],  up: [0, 1, 0] },
    { id: 'side-left',   label: 'Flanc gauche',   zone: 'flanc-gauche', position: [-0.1326, 0.2184,  0.0088], normal: [-1, 0, 0], up: [0, 1, 0] },
    { id: 'side-right',  label: 'Flanc droit',    zone: 'flanc-droit',  position: [0.1326,  0.2184,  0.0088], normal: [1, 0, 0],  up: [0, 1, 0] },
    { id: 'top-lid',     label: 'Dessus (rabat)', zone: 'dessus',       position: [0,       0.4992, -0.0110], normal: [0, 1, 0],  up: [0, 0, -1] },
  ],
  'lkdv-one-45': [
    { id: 'front-upper', label: 'Façade haute',   zone: 'facade',       position: [0,       0.4092,  0.1480], normal: [0, 0, 1],  up: [0, 1, 0] },
    { id: 'front-lower', label: 'Façade basse',   zone: 'facade',       position: [0,       0.1980,  0.1480], normal: [0, 0, 1],  up: [0, 1, 0] },
    { id: 'side-left',   label: 'Flanc gauche',   zone: 'flanc-gauche', position: [-0.1991, 0.2772,  0.0123], normal: [-1, 0, 0], up: [0, 1, 0] },
    { id: 'side-right',  label: 'Flanc droit',    zone: 'flanc-droit',  position: [0.1991,  0.2772,  0.0123], normal: [1, 0, 0],  up: [0, 1, 0] },
    { id: 'top-lid',     label: 'Dessus (rabat)', zone: 'dessus',       position: [0,       0.6336, -0.0154], normal: [0, 1, 0],  up: [0, 0, -1] },
  ],
  'lkdv-one-60': [
    { id: 'front-upper', label: 'Façade haute',   zone: 'facade',       position: [0,       0.4588,  0.1627], normal: [0, 0, 1],  up: [0, 1, 0] },
    { id: 'front-lower', label: 'Façade basse',   zone: 'facade',       position: [0,       0.2220,  0.1627], normal: [0, 0, 1],  up: [0, 1, 0] },
    { id: 'side-left',   label: 'Flanc gauche',   zone: 'flanc-gauche', position: [-0.1919, 0.3108,  0.0136], normal: [-1, 0, 0], up: [0, 1, 0] },
    { id: 'side-right',  label: 'Flanc droit',    zone: 'flanc-droit',  position: [0.1919,  0.3108,  0.0136], normal: [1, 0, 0],  up: [0, 1, 0] },
    { id: 'top-lid',     label: 'Dessus (rabat)', zone: 'dessus',       position: [0,       0.7104, -0.0170], normal: [0, 1, 0],  up: [0, 0, -1] },
  ],
  'lkdv-one-80': [
    { id: 'front-upper', label: 'Façade haute',   zone: 'facade',       position: [0,       0.4960,  0.1798], normal: [0, 0, 1],  up: [0, 1, 0] },
    { id: 'front-lower', label: 'Façade basse',   zone: 'facade',       position: [0,       0.2400,  0.1798], normal: [0, 0, 1],  up: [0, 1, 0] },
    { id: 'side-left',   label: 'Flanc gauche',   zone: 'flanc-gauche', position: [-0.2505, 0.3360,  0.0150], normal: [-1, 0, 0], up: [0, 1, 0] },
    { id: 'side-right',  label: 'Flanc droit',    zone: 'flanc-droit',  position: [0.2505,  0.3360,  0.0150], normal: [1, 0, 0],  up: [0, 1, 0] },
    { id: 'top-lid',     label: 'Dessus (rabat)', zone: 'dessus',       position: [0,       0.7680, -0.0187], normal: [0, 1, 0],  up: [0, 0, -1] },
  ],
} as const;

/**
 * Résout les points d'accroche d'un sac :
 * 1. Si le manifeste déclare déjà des emplacements `kind === 'attachment'`, ils font foi.
 * 2. Sinon, si le modèle figure dans `LKDV_ONE_PROVISIONAL_ANCHORS`, on renvoie la table éditable.
 * 3. À défaut, on dérive les 5 points standards depuis `manifest.boundingBoxM`.
 */
export function resolveBagAttachmentAnchors(
  manifest: Pick<BagManifest, 'modelId' | 'boundingBoxM' | 'slots'>,
): readonly ProvisionalBagAnchor[] {
  const fromManifest = manifest.slots.filter((s) => s.kind === 'attachment');
  if (fromManifest.length > 0) {
    return fromManifest.map((s) => ({
      id: s.id,
      label: s.id,
      zone: inferZoneFromNormal(s.normal),
      position: [...s.anchor] as Vec3Tuple,
      normal: [...s.normal] as Vec3Tuple,
    }));
  }
  const tableEntry = LKDV_ONE_PROVISIONAL_ANCHORS[manifest.modelId];
  if (tableEntry) return tableEntry;
  return deriveAnchorsFromBoundingBox(manifest.boundingBoxM);
}

function inferZoneFromNormal(normal: Vec3Tuple): BagAnchorZone {
  const [nx, ny, nz] = normal;
  if (Math.abs(ny) >= Math.abs(nx) && Math.abs(ny) >= Math.abs(nz)) return 'dessus';
  if (Math.abs(nx) >= Math.abs(nz)) return nx < 0 ? 'flanc-gauche' : 'flanc-droit';
  return 'facade';
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
