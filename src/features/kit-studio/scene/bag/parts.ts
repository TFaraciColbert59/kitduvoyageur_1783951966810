/**
 * src/features/kit-studio/scene/bag/parts.ts
 * Canonical bag catalog, part labels, and slot definitions (Lot L4-2).
 */

import type {
  AnchorId,
  BagCapabilities,
  PartId,
  SlotId,
  SlotState,
} from '../../state/types';
import type { BoundingBoxM, Vec3Tuple } from '../camera/intents';

export interface BagHingeSpec {
  axis: Vec3Tuple;
  pivot: Vec3Tuple;
  maxAngleRad: number;
}

export interface BagAnchorSpec {
  id: string;
  position: Vec3Tuple;
  normal: Vec3Tuple;
}

export interface BagSlotManifestEntry {
  id: SlotId;
  kind: 'interior' | 'pocket' | 'attachment';
  capacityL: number | null;
  maxItems: number | null;
  anchor: Vec3Tuple;
  normal: Vec3Tuple;
}

/**
 * Palier de qualité d'un maillage.
 *
 * `web` part avec le déploiement : moins de 900 Ko, tout appareil le charge.
 * `hd` est le master, servi depuis le dépôt distant et réservé aux appareils dont on a la preuve
 * qu'ils le supportent. Sans preuve, on sert `web` : un sac qui met trente secondes à venir est
 * pire qu'un sac un peu moins fin.
 */
export type BagTier = 'web' | 'hd';

export interface BagTierAsset {
  /** Absolue pour un master distant, commençant par « / » pour un fichier du déploiement. */
  url: string;
  bytes: number;
  triangles: number;
}

export interface BagManifest {
  schema: number;
  modelId: string;
  label: string;
  generator: string;
  generatedBy: string;
  license: string;
  units: 'meters';
  origin: string;
  capabilities: BagCapabilities;
  hasHinge: boolean;
  declaredCapacityL: number | null;
  boundingBoxM: BoundingBoxM;
  slots: BagSlotManifestEntry[];
  budget: {
    triangles: number;
    fileBytes: number;
  };
  /**
   * Où trouver le maillage, par palier. Absent sur les modèles du générateur maison, qui n'ont
   * qu'un fichier à côté de leur manifeste : le chargeur retombe alors sur le chemin historique.
   */
  assets?: Partial<Record<BagTier, BagTierAsset>>;
  /** Vrai quand le maillage porte son propre atlas : la couleur ne se change pas sans masque. */
  texturedSource?: boolean;
}

export interface BagIndexEntry {
  modelId: string;
  label: string;
  triangles: number;
  bytes: number;
  openable: boolean;
  parts: number;
  slots: number;
  valid: boolean;
}

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
  'compression-strap-l-3': 'Sangle compression G3',
  'compression-strap-r-3': 'Sangle compression D3',
};

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

export const BAG_ANCHOR_LABELS: Readonly<Record<AnchorId, string>> = {
  'badge-body-front': 'Face avant du corps',
  'badge-lid': 'Dessus du rabat',
  'badge-front-pocket': 'Poche frontale',
};

export function getPartLabel(partId: PartId): string {
  return BAG_PART_LABELS[partId] ?? partId;
}

export function getSlotLabel(slotId: SlotId | null): string {
  if (!slotId) return 'Non rangé';
  return BAG_SLOT_LABELS[slotId] ?? slotId;
}

export function getAnchorLabel(anchorId: AnchorId): string {
  return BAG_ANCHOR_LABELS[anchorId] ?? anchorId;
}

export function manifestSlotsToSlotStates(manifest: BagManifest): SlotState[] {
  return manifest.slots.map((s) => ({
    id: s.id,
    kind: s.kind,
    capacityL: typeof s.capacityL === 'number' ? Number(s.capacityL.toFixed(2)) : null,
    maxItems: s.maxItems ?? null,
    itemIds: [],
  }));
}

export const DEGRADED_BAG_CAPABILITIES: BagCapabilities = {
  rotatable: false,
  openable: false,
  hasInterior: false,
  customizableParts: [],
  badgeAnchors: [],
  attachmentPoints: [],
};

export const BUILTIN_BAG_MODELS: readonly {
  modelId: string;
  label: string;
  capacityL: number;
  openable: boolean;
  summary: string;
}[] = [
  {
    modelId: 'daypack-22',
    label: 'Sac à dos journée 22 L',
    capacityL: 22,
    openable: true,
    summary: 'Sortie à la journée, ouverture zippée, poches latérales.',
  },
  {
    modelId: 'ultralight-40',
    label: 'Sac ultraléger 40 L',
    capacityL: 40,
    openable: true,
    summary: 'Fermeture enroulée rolltop, profil épuré grande randonnée.',
  },
  {
    modelId: 'trekker-55',
    label: 'Sac de trek 55 L',
    capacityL: 55,
    openable: true,
    summary: 'Rabat articulé, ceinture porteuse, 10 emplacements dédiés.',
  },
  {
    modelId: 'expedition-75',
    label: 'Sac d’expédition 75 L',
    capacityL: 75,
    openable: true,
    summary: 'Haut volume autonomie longue, triple compression.',
  },
  {
    modelId: 'duffel-60',
    label: 'Sac de voyage 60 L',
    capacityL: 60,
    openable: false,
    summary: 'Volume monobloc robuste (extérieur 3D, rangement intérieur en Liste).',
  },
] as const;
