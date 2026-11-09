/**
 * Communauté v2 — modèles de kit exposés à la couche données (FID-069).
 *
 * Les modèles existent déjà (`src/features/community/create/kit/kitCompletion.ts`,
 * `KIT_TEMPLATES` : day/bivouac/alpine/ski/bike/water) mais seul le formulaire
 * `KitFormV2` les connaît, et il fige aujourd'hui `'bivouac'`. Cette façade
 * donne aux consommateurs hors `create/**` (et aux tests) une liste stable et
 * une préparation calculée, sans dupliquer les catégories requises ni créer de
 * nouvelle source de vérité : elle ré-exporte et adapte.
 *
 * La liste de préparation est exactement celle de la maquette (suggestions par
 * catégorie manquante, `suggestKitCompletion`) ; le formulaire reste libre de
 * l'afficher avec ses propres composants.
 */

import {
  KIT_TEMPLATES,
  suggestKitCompletion,
  type CustomKitItem,
  type InventoryItem,
  type KitSuggestion,
  type KitTemplateId,
} from '@/features/community/create/kit/kitCompletion';

export type { KitSuggestion, KitTemplateId };

/** Modèle de kit proposé à l'utilisateur (journée, bivouac, alpi…). */
export interface KitModelVM {
  id: KitTemplateId;
  label: string;
}

/** Ordre de la maquette : journée, bivouac, alpinisme, puis les autres. */
export const KIT_MODEL_OPTIONS: readonly KitModelVM[] = KIT_TEMPLATES.map(({ id, label }) => ({
  id,
  label,
}));

/** Libellé d'un modèle ; `null` si l'identifiant est inconnu (jamais deviné). */
export function kitModelLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  return KIT_MODEL_OPTIONS.find((model) => model.id === id)?.label ?? null;
}

/**
 * Préparation d'un kit : catégories requises par le modèle et absentes de la
 * sélection, avec le nom suggéré et la raison (« Catégorie requise pour un kit
 * bivouac. »). Fonction pure, testable, sans accès au profil ni au réseau.
 */
export function kitPreparationSuggestions(
  template: KitTemplateId,
  selected: readonly InventoryItem[] = [],
  custom: readonly CustomKitItem[] = [],
): KitSuggestion[] {
  return suggestKitCompletion([...selected], [...custom], template);
}
