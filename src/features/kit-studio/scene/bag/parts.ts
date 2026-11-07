/**
 * src/features/kit-studio/scene/bag/parts.ts
 * Catalogue des pièces, emplacements et ancres d'un sac maillé (couche GLB survivante).
 *
 * Depuis P3, les TYPES du manifeste vivent dans le domaine pur
 * (`domain/bagModel.ts`) : slots, points d'attache, ancrages d'insigne, capacité déclarée
 * et capacités y sont définis, sans dépendance à three ni au DOM. Ce module ne garde que
 * les libellés d'affichage et les ré-exports attendus par la couche de chargement.
 */

import type { BagPartId, BagSlotId } from '../../domain/bagModel';

export type {
  BagAnchorSpec,
  BagCapabilities,
  BagHingeSpec,
  BagIndexEntry,
  BagManifest,
  BagSlotId,
  BagSlotKind,
  BagSlotManifestEntry,
  BagTier,
  BagTierAsset,
} from '../../domain/bagModel';
export {
  BUILTIN_BAG_MODELS,
  DEGRADED_BAG_CAPABILITIES,
  bagModelFromManifest,
  declaredCapacityL,
} from '../../domain/bagModel';

/** Libellés des pièces d'un sac GLB. */
export const BAG_PART_LABELS: Readonly<Record<string, string>> = {
  body: 'Corps principal',
  interior: 'Doublure intérieure',
  lid: 'Rabat supérieur',
  'lid-buckle': 'Boucle de rabat',
  'lid-zip': 'Glissière supérieure',
  'front-pocket': 'Poche frontale',
  'side-pocket-l': 'Poche latérale gauche',
  'side-pocket-r': 'Poche latérale droite',
  'shoulder-strap-l': 'Bretelle gauche',
  'shoulder-strap-r': 'Bretelle droite',
  'hip-belt': 'Ceinture ventrale',
  'compression-strap-l-1': 'Sangle compression G1',
  'compression-strap-r-1': 'Sangle compression D1',
  'compression-strap-l-2': 'Sangle compression G2',
  'compression-strap-r-2': 'Sangle compression D2',
};

/** Libellés des emplacements d'un sac GLB. */
export const BAG_SLOT_LABELS: Readonly<Record<string, string>> = {
  'interior-bottom': 'Fond du sac (lourd / couchage)',
  'interior-top': 'Haut du sac (accès rapide)',
  'front-pocket': 'Poche frontale',
  'side-pocket-l': 'Poche latérale gauche',
  'side-pocket-r': 'Poche latérale droite',
  'lid-pocket': 'Poche de rabat',
  'attach-top': 'Accroche supérieure',
  'attach-bottom': 'Sangles sous le sac',
  'attach-side-l': 'Accroche externe gauche',
  'attach-side-r': 'Accroche externe droite',
};

/** Libellés des ancrages d'insigne d'un sac GLB. */
export const BAG_ANCHOR_LABELS: Readonly<Record<string, string>> = {
  'badge-body-front': 'Face avant du corps',
  'badge-lid': 'Dessus du rabat',
  'badge-front-pocket': 'Poche frontale',
};

export function getPartLabel(partId: BagPartId): string {
  return BAG_PART_LABELS[partId] ?? partId;
}

export function getSlotLabel(slotId: BagSlotId | null): string {
  if (!slotId) return 'Non rangé';
  return BAG_SLOT_LABELS[slotId] ?? slotId;
}

export function getAnchorLabel(anchorId: string): string {
  return BAG_ANCHOR_LABELS[anchorId] ?? anchorId;
}
