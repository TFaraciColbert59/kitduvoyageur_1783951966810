// Concepts du manifeste de sac (modèle GLB) portés par le domaine — P3 « unification ».
//
// Ce fichier reprend les seuls concepts utiles de l'ancien second modèle de domaine
// (`state/types.ts`, studio du hub, supprimé en P3) : slots d'un sac, points d'attache,
// ancrages d'insigne, capacité déclarée, capacités (rotation, ouverture, intérieur,
// pièces personnalisables). Le reste du second modèle (KitConfiguration, KitItem,
// PlacedBadge…) disparaît avec l'interface en double.
//
// Types purs : aucun import React / three / DOM. Le manifeste est la seule source
// d'autorité sur ce que le maillage sait faire (règle d'honnêteté C-13) : un modèle
// n'annonce que ce que son GLB porte réellement, et `bags.index.json` le brouillon public.

import type { ConfigSet, MaterialId } from './catalog';
import { MATERIALS } from './catalog';
import { RAW_MATERIALS } from './palette';
import type { MaterialKey } from './catalog';

/** Vecteur 3D en mètres (repère du modèle, y = haut, origine au centre du sol). */
export type Vec3Tuple = [number, number, number];

/** Boîte englobante du maillage, en mètres. */
export interface BoundingBoxM {
  readonly w: number;
  readonly h: number;
  readonly d: number;
}

/** Identifiants de pièce / d'emplacement / d'ancre d'un maillage importé. */
export type BagPartId = string;
export type BagSlotId = string;
export type BagAnchorId = string;

export type BagSlotKind = 'interior' | 'pocket' | 'attachment';
export type BagPartFinish = 'matte' | 'gloss' | 'metallic' | 'rough';

/** Apparence d'une pièce de maillage, réglée par le code (jamais cuite dans la géométrie). */
export interface BagPartAppearance {
  readonly material?: string;
  readonly color?: string;
  readonly finish?: BagPartFinish;
}

/**
 * Ce qu'un sac sait faire — repris tel quel de l'ancien `state/types.ts`.
 * `attachmentPoints` et `badgeAnchors` sont des identifiants de slot / d'ancre du GLB.
 */
export interface BagCapabilities {
  readonly rotatable: boolean;
  readonly openable: boolean;
  readonly hasInterior: boolean;
  readonly customizableParts: readonly BagPartId[];
  readonly badgeAnchors: readonly BagAnchorId[];
  readonly attachmentPoints: readonly BagSlotId[];
}

/** Emplacement déclaré par le manifeste (capacité en litres, ou `null` = non modélisé). */
export interface BagSlotManifestEntry {
  readonly id: BagSlotId;
  readonly kind: BagSlotKind;
  readonly capacityL: number | null;
  readonly maxItems: number | null;
  readonly anchor: Vec3Tuple;
  readonly normal: Vec3Tuple;
}

/** Point d'accroche nommé d'un maillage (`anchor:…` dans le GLB). */
export interface BagAnchorSpec {
  readonly id: BagAnchorId;
  readonly position: Vec3Tuple;
  readonly normal: Vec3Tuple;
}

/** Charnière extraite du GLB, uniquement si le manifeste déclare `openable: true` (C-13). */
export interface BagHingeSpec {
  readonly axis: Vec3Tuple;
  readonly pivot: Vec3Tuple;
  readonly maxAngleRad: number;
}

/** Manifeste d'un sac (schéma 1), tel qu'écrit par `tools/bag-generator/`. */
export interface BagManifest {
  readonly schema: number;
  readonly modelId: string;
  readonly label: string;
  readonly generator: string;
  readonly generatedBy: string;
  readonly license: string;
  readonly units: 'meters';
  readonly origin: string;
  readonly capabilities: BagCapabilities;
  readonly hasHinge: boolean;
  readonly declaredCapacityL: number | null;
  readonly boundingBoxM: BoundingBoxM;
  readonly slots: readonly BagSlotManifestEntry[];
  readonly budget: { readonly triangles: number; readonly fileBytes: number };
}

/** Entrée de `public/assets/bags/bags.index.json`. */
export interface BagIndexEntry {
  readonly modelId: string;
  readonly label: string;
  readonly triangles: number;
  readonly bytes: number;
  readonly openable: boolean;
  readonly parts: number;
  readonly slots: number;
  readonly valid: boolean;
}

/** Modèle de sac de référence livré avec le dépôt (généré par `tools/bag-generator/`). */
export interface BuiltinBagModel {
  readonly modelId: string;
  readonly label: string;
  readonly capacityL: number;
  readonly openable: boolean;
  readonly summary: string;
}

/** Les cinq sacs GLB présents dans `public/assets/bags/`. */
export const BUILTIN_BAG_MODELS: readonly BuiltinBagModel[] = [
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
    label: "Sac d'expédition 75 L",
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

/** Capacités d'un sac sans maillage : rien n'est promis (C-13). */
export const DEGRADED_BAG_CAPABILITIES: BagCapabilities = {
  rotatable: false,
  openable: false,
  hasInterior: false,
  customizableParts: [],
  badgeAnchors: [],
  attachmentPoints: [],
};

/** Projection « domaine » du manifeste : la forme que la scène et l'interface consomment. */
export interface BagModel {
  readonly modelId: string;
  readonly label: string;
  readonly declaredCapacityL: number | null;
  readonly capabilities: BagCapabilities;
  readonly slots: readonly BagSlotManifestEntry[];
  readonly hasHinge: boolean;
  readonly boundingBoxM: BoundingBoxM;
}

/**
 * Mapping manifeste → modèle de domaine. Une seule conversion, testée : la scène ne relit
 * jamais le JSON brut, et l'interface n'a besoin que de cette forme.
 */
export function bagModelFromManifest(manifest: BagManifest): BagModel {
  return {
    modelId: manifest.modelId,
    label: manifest.label,
    declaredCapacityL: declaredCapacityL(manifest),
    capabilities: {
      rotatable: Boolean(manifest.capabilities.rotatable),
      openable: Boolean(manifest.capabilities.openable && manifest.hasHinge),
      hasInterior: Boolean(manifest.capabilities.openable && manifest.hasHinge && manifest.capabilities.hasInterior),
      customizableParts: [...manifest.capabilities.customizableParts],
      badgeAnchors: [...manifest.capabilities.badgeAnchors],
      attachmentPoints: [...manifest.capabilities.attachmentPoints],
    },
    slots: manifest.slots.map((slot) => ({
      ...slot,
      capacityL: slot.capacityL === null ? null : round2(slot.capacityL),
      maxItems: slot.maxItems ?? null,
    })),
    hasHinge: Boolean(manifest.hasHinge),
    boundingBoxM: { ...manifest.boundingBoxM },
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Capacité déclarée du sac, en litres. Le manifeste fait foi ; à défaut, la somme des
 * capacités d'emplacements modélisées, ou `null` si rien n'est déclaré (jamais 0 inventé).
 */
export function declaredCapacityL(manifest: BagManifest): number | null {
  if (typeof manifest.declaredCapacityL === 'number' && Number.isFinite(manifest.declaredCapacityL)) {
    return round2(manifest.declaredCapacityL);
  }
  const known = manifest.slots.filter((slot) => typeof slot.capacityL === 'number' && Number.isFinite(slot.capacityL));
  if (known.length === 0) return null;
  return round2(known.reduce((sum, slot) => sum + (slot.capacityL ?? 0), 0));
}

/** Emplacements de rangement (intérieurs et poches) déclarés par le manifeste. */
export function storageSlots(manifest: BagManifest): readonly BagSlotManifestEntry[] {
  return manifest.slots.filter((slot) => slot.kind !== 'attachment');
}

/** Points d'attache déclarés par le manifeste (ce que l'on peut accrocher à l'extérieur). */
export function attachmentPoints(manifest: BagManifest): readonly BagSlotManifestEntry[] {
  return manifest.slots.filter((slot) => slot.kind === 'attachment');
}

/** URL de la carte de masque de tissu, rangée à côté du GLB (§4.6 de la spec). */
export function fabricMaskUrl(modelId: string): string {
  return `/assets/bags/${encodeURIComponent(modelId)}.mask.png`;
}

export function bagAssetUrl(modelId: string, ext: 'glb' | 'manifest.json'): string {
  return `/assets/bags/${encodeURIComponent(modelId)}.${ext}`;
}

/** Vrai si le modèle est un des sacs GLB livrés avec le dépôt. */
export function isBuiltinBagModel(modelId: string | null | undefined): boolean {
  if (!modelId) return false;
  return BUILTIN_BAG_MODELS.some((model) => model.modelId === modelId);
}

// ─────────────────────────── Mapping configuration → apparences de pièces ───────────────────────────

/**
 * Matières du studio survivant → identifiant de preset du banc de textures unique.
 * `dcf` n'a pas de relevé photographique (aucun composite Dyneema mesuré) : pas de preset,
 * l'aspect uni reste juste. Même règle pour `xpac` : le banc photographique ne contient pas
 * de relevé X-Pac (cf. textures.ts PHOTO_FABRICS) — la couleur et la rugosité suffisent.
 */
const MATERIAL_TO_PRESET: Readonly<Partial<Record<MaterialId, string>>> = {
  ripstop: 'ripstop-ultralight',
  cordura: 'cordura-matte',
  waxed: 'waxed-canvas',
};

/** Correspondance pièce du studio (Corps, Rabat, Poche avant…) → pièces nommées du GLB. */
const ENGINEER_PART_TO_MESH_PARTS: Readonly<Record<string, readonly BagPartId[]>> = {
  body: ['body', 'interior'],
  lid: ['lid'],
  front: ['front-pocket'],
  sides: ['side-pocket-l', 'side-pocket-r'],
  hip: ['hip-belt'],
  harness: ['shoulder-strap-l', 'shoulder-strap-r', 'webbing'],
  webbing: ['compression-strap-l-1', 'compression-strap-r-1', 'compression-strap-l-2', 'compression-strap-r-2', 'lid-zip', 'lid-buckle'],
};

/**
 * Mapping pur : configuration d'apparence du studio survivant → apparences appliquées aux
 * pièces du maillage GLB. Ne devine rien : seules les pièces présentes dans le GLB sont
 * ciblées par l'appelant (l'apparence d'une pièce absente est simplement ignorée).
 */
export function bagPartAppearances(config: ConfigSet): Readonly<Record<BagPartId, BagPartAppearance>> {
  const out: Record<BagPartId, BagPartAppearance> = {};
  for (const [engineerPart, meshParts] of Object.entries(ENGINEER_PART_TO_MESH_PARTS)) {
    const source = config[engineerPart as keyof ConfigSet];
    if (!source || typeof source !== 'object' || !('col' in source)) continue;
    const part = source as { mat?: MaterialId; col?: MaterialKey; fin?: string };
    const appearance: BagPartAppearance = {
      material: part.mat ? MATERIAL_TO_PRESET[part.mat] : undefined,
      color: part.col ? RAW_MATERIALS[part.col] : undefined,
      finish: part.fin ? finishToAppearance(part.fin) : undefined,
    };
    for (const meshPart of meshParts) out[meshPart] = appearance;
  }
  // La couleur d'accent (coutures/empiècements) n'a pas de pièce dédiée dans le GLB.
  return out;
}

function finishToAppearance(fin: string): BagPartFinish | undefined {
  if (fin === 'mat' || fin === 'heather') return 'matte';
  if (fin === 'satin') return 'rough';
  if (fin === 'gloss') return 'gloss';
  return undefined;
}

/** Matière → nom de trame du banc de textures (`fabric(name)`), ou `null` si non relevée. */
export function fabricNameForMaterial(material: MaterialId | undefined): string | null {
  if (!material) return null;
  return MATERIALS[material]?.tex ?? null;
}
