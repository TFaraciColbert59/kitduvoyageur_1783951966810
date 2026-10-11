import 'server-only';
import TABLE from '../data/entryRequirements.json';
import { entryRequirementIn, type EntryRequirement, type EntryTable } from '../engine/entry';

/**
 * Table passeport × destination (travelrequirements.info, jeu « Entry Requirements
 * Dataset » v1.3.0, CC BY 4.0), lue côté serveur seulement : le fichier (environ 170 Ko)
 * ne part jamais dans le navigateur. Généré par
 * `scripts/compas/build-entry-requirements.mjs` (voir `data/entryRequirements.meta.json`
 * pour la version, le crédit exact et les dates de vérification).
 */
const ROWS = TABLE as unknown as EntryTable;

/**
 * Ce que la table dit pour un passeport (nationalité ISO2) et une destination (ISO2),
 * null s'il n'y a pas de ligne (territoires, pays hors du jeu).
 */
export function entryRequirement(
  passport: string | null | undefined,
  destination: string | null | undefined
): EntryRequirement | null {
  return entryRequirementIn(ROWS, passport, destination);
}
