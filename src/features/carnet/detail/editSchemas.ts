/**
 * Schémas zod des écritures du mode modification qui ne sont pas des moments :
 * étape, nuit, verdict d'un objet, voyageur. Toute entrée est validée ici,
 * côté serveur, avant d'atteindre la base ; la base reste l'arbitre final
 * (`is_carnet_participant`, RLS). Messages en français, tutoiement.
 */
import { z } from 'zod';
import { toNumber } from './format';
import type {
  CarnetEtapeDay,
  CarnetKitVerdictItem,
  CarnetNightItem,
  EtapeRow,
  KitVerdictType,
} from './types';

export const NIGHT_TYPES = ['refuge', 'gite', 'bivouac', 'hotel', 'camping', 'autre'] as const;
export const NIGHT_TYPE_LABELS: Record<(typeof NIGHT_TYPES)[number], string> = {
  refuge: 'Refuge',
  gite: 'Gîte',
  bivouac: 'Bivouac',
  hotel: 'Hôtel',
  camping: 'Camping',
  autre: 'Autre',
};

export const EDITABLE_VERDICTS = ['essentiel', 'utile', 'jamais_servi', 'defaillant', 'manquait'] as const;
export type EditableVerdict = (typeof EDITABLE_VERDICTS)[number];
export const VERDICT_LABELS: Record<EditableVerdict, string> = {
  essentiel: 'Essentiel',
  utile: 'Utile',
  jamais_servi: 'Jamais servi',
  defaillant: 'Défaillant',
  manquait: 'Manquait',
};

/** Rôles qu'un auteur peut donner à un voyageur (`carnet_collaborators.role`). */
export const TRAVELER_ROLES = ['contributor', 'viewer'] as const;
export type TravelerRole = (typeof TRAVELER_ROLES)[number];
export const TRAVELER_ROLE_LABELS: Record<TravelerRole, string> = {
  contributor: 'Contributeur',
  viewer: 'Lecteur',
};

const carnetId = z.string().uuid('Carnet introuvable.');
const entityId = z.string().uuid('Élément introuvable.');
const day = z.coerce
  .number({ message: 'Indique le numéro du jour.' })
  .int('Indique le numéro du jour.')
  .min(1, 'Le jour commence à 1.')
  .max(366, 'Le jour est trop grand.');

/** Champ numérique optionnel d'un formulaire : « 12,5 » et vide acceptés. */
const optionalNumber = (label: string, min: number, max: number, integer = false) =>
  z.preprocess(
    (value) => {
      if (value === '' || value === null || value === undefined) return undefined;
      if (typeof value === 'string') return Number(value.replace(',', '.').replace(/\s/g, ''));
      return value;
    },
    (integer ? z.number().int(`${label} : un nombre entier.`) : z.number())
      .finite(`${label} : un nombre.`)
      .min(min, `${label} : au moins ${min}.`)
      .max(max, `${label} : au plus ${max}.`)
      .optional()
  );

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} : ${max} caractères au plus.`)
    .optional()
    .transform((value) => (value ? value : undefined));

const requiredText = (message: string, max: number, label: string) =>
  z.string().trim().min(1, message).max(max, `${label} : ${max} caractères au plus.`);

// ── Étape ──────────────────────────────────────────────────────────────────

export const StepInputSchema = z.object({
  carnetId,
  id: entityId.optional(),
  dayNumber: day,
  from: requiredText('Indique le départ.', 80, 'Départ'),
  to: requiredText('Indique l’arrivée.', 80, 'Arrivée'),
  distanceKm: optionalNumber('Distance', 0, 2000),
  elevationM: optionalNumber('Dénivelé', 0, 20000, true),
  durationText: optionalText(30, 'Durée'),
  note: optionalText(1000, 'Récit'),
});
export type StepInput = z.infer<typeof StepInputSchema>;

export const StepDeleteSchema = z.object({ carnetId, id: entityId });

/**
 * Ligne `groupe_etapes` à écrire (colonnes historiques de la table). La météo et
 * la date ne sont jamais réécrites par ce formulaire : une modification ne
 * peut pas les effacer.
 */
export function stepRow(value: StepInput, groupeId: string) {
  return {
    groupe_id: groupeId,
    jour_numero: value.dayNumber,
    ordre: value.dayNumber,
    lieu_depart: value.from,
    lieu_arrivee: value.to,
    distance_km: value.distanceKm ?? null,
    denivele_m: value.elevationM ?? null,
    duree_texte: value.durationText ?? null,
    recit: value.note ?? null,
  };
}

/** L'étape telle que la fiche l'affiche tout de suite après l'écriture. */
export function etapeFromRow(
  row: EtapeRow,
  overnight: string | null = null
): CarnetEtapeDay {
  const dayNumber = row.jour_numero ?? row.ordre ?? 1;
  const dateLabel = row.date_etape
    ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(
        new Date(`${row.date_etape}T12:00:00Z`)
      )
    : null;
  return {
    id: row.id,
    dayNumber,
    label: dateLabel ? `JOUR ${dayNumber} · ${dateLabel}` : `JOUR ${dayNumber}`,
    from: row.lieu_depart?.trim() || null,
    to: row.lieu_arrivee?.trim() || null,
    note: row.recit?.trim() || null,
    distanceKm: toNumber(row.distance_km),
    elevationM: toNumber(row.denivele_m),
    durationText: row.duree_texte?.trim() || null,
    weather:
      [
        row.meteo?.trim(),
        row.temperature_c !== null && row.temperature_c !== undefined
          ? `${row.temperature_c} °C`
          : null,
      ]
        .filter(Boolean)
        .join(' · ') || null,
    overnight,
  };
}

// ── Nuit ───────────────────────────────────────────────────────────────────

export const NightInputSchema = z.object({
  carnetId,
  /** Absent : création (ou remplacement de la nuit du même jour). */
  id: entityId.optional(),
  dayNumber: day,
  name: requiredText('Donne un nom à cette nuit.', 80, 'Nom'),
  type: z.enum(NIGHT_TYPES, { message: 'Choisis un type d’hébergement.' }),
  altitudeM: optionalNumber('Altitude', -500, 9000, true),
  infos: optionalText(240, 'Infos'),
});
export type NightInput = z.infer<typeof NightInputSchema>;

export const NightDeleteSchema = z.object({ carnetId, dayNumber: day });

export function nightRow(value: NightInput, userId: string) {
  return {
    carnet_id: value.carnetId,
    jour_numero: value.dayNumber,
    nom: value.name,
    type: value.type,
    altitude_m: value.altitudeM ?? null,
    infos: value.infos ?? null,
    created_by: userId,
  };
}

export interface NightRowRead {
  id: string;
  jour_numero: number;
  nom: string;
  type: string;
  altitude_m: number | null;
  infos: string | null;
  lat: number | null;
  lng: number | null;
  map_refuge_id: string | null;
}

export function nightFromRow(row: NightRowRead): CarnetNightItem {
  const type = (NIGHT_TYPES as readonly string[]).includes(row.type)
    ? (row.type as CarnetNightItem['type'])
    : 'autre';
  return {
    id: row.id,
    dayNumber: row.jour_numero,
    name: row.nom,
    type,
    altitudeM: row.altitude_m,
    infos: row.infos,
    lat: row.lat,
    lng: row.lng,
    mapRefugeId: row.map_refuge_id,
  };
}

// ── Verdict ────────────────────────────────────────────────────────────────

export const VerdictInputSchema = z.object({
  carnetId,
  itemId: entityId,
  /** `null` : retire le verdict. */
  verdict: z.enum(EDITABLE_VERDICTS, { message: 'Choisis un verdict.' }).nullable(),
  note: optionalText(500, 'Note'),
  days: z
    .array(z.coerce.number().int().min(1).max(366))
    .max(60, 'Trop de jours.')
    .optional()
    .transform((value) => [...new Set(value ?? [])].sort((a, b) => a - b)),
});
export type VerdictInput = z.infer<typeof VerdictInputSchema>;

export function verdictRow(value: VerdictInput) {
  return {
    verdict: value.verdict,
    verdict_note: value.verdict ? (value.note ?? null) : null,
    jours_utilises: value.verdict && value.days.length > 0 ? value.days : null,
  };
}

export function verdictItem(value: VerdictInput): CarnetKitVerdictItem {
  return {
    itemId: value.itemId,
    verdict: value.verdict as KitVerdictType | null,
    verdictNote: value.verdict ? (value.note ?? null) : null,
    joursUtilises: value.verdict ? value.days : [],
  };
}

// ── Voyageur ───────────────────────────────────────────────────────────────

export const TravelerAddSchema = z.object({
  carnetId,
  handle: z
    .string()
    .trim()
    .transform((value) => value.replace(/^@/, ''))
    .pipe(
      z
        .string()
        .min(2, 'Indique le @pseudo du voyageur.')
        .max(40, 'Le pseudo est trop long.')
        .regex(/^[\p{L}\p{N}_.-]+$/u, 'Le pseudo ne contient que lettres, chiffres, point, tiret.')
    ),
  role: z.enum(TRAVELER_ROLES, { message: 'Choisis un rôle.' }),
});
export type TravelerAddInput = z.infer<typeof TravelerAddSchema>;

export const TravelerUpdateSchema = z.object({
  carnetId,
  userId: entityId,
  role: z.enum(TRAVELER_ROLES, { message: 'Choisis un rôle.' }),
});
export type TravelerUpdateInput = z.infer<typeof TravelerUpdateSchema>;

export const TravelerRemoveSchema = z.object({ carnetId, userId: entityId });

// ── Moment (modifier / supprimer depuis la carte) ──────────────────────────

export const MomentUpdateSchema = z.object({
  carnetId,
  id: entityId,
  place: requiredText('Indique un lieu.', 80, 'Lieu'),
  caption: optionalText(400, 'Texte'),
});
export type MomentUpdateInput = z.infer<typeof MomentUpdateSchema>;

export const MomentDeleteSchema = z.object({ carnetId, id: entityId });

/** Premier message d'erreur d'un résultat zod, ou un repli neutre. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Saisie invalide.';
}
