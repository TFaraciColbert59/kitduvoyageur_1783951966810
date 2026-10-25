/**
 * ORIENTATION — la « pratique » déclarée (ADRET-010, Lot B).
 * ===========================================================
 * Privée, jamais affichée, jamais dérivée vers un grade/label. Sert UNIQUEMENT
 * de prior (pré-remplissage) au configurateur. Modules purs, testés dans
 * `tests/identity/orientation.spec.ts`.
 *
 * Règles du chantier (ADR-010) :
 *  - L'orientation n'est jamais rendue dans un composant public.
 *  - Aucun dérivé de type rôle/grade/niveau affiché.
 *  - Le pré-remplissage est TOUJOURS annoncé (« pré-rempli d'après ta pratique —
 *    modifier »), jamais silencieux.
 *  - La boucle de correction (source = 'inferred') PROPOSE, jamais n'applique.
 */

export type Terrain =
  | 'sentier'
  | 'montagne'
  | 'hors_sentier'
  | 'itinerance'
  | 'urbain_transit';

export type Autonomy = 'journee' | 'bivouac_1_2' | 'itinerance_longue';

export type Priority = 'legerete' | 'confort' | 'budget' | 'securite';

export type Experience = 'debut' | 'regulier' | 'aguerri';

export interface Orientation {
  user_id?: string;
  terrain?: Terrain | null;
  autonomy?: Autonomy | null;
  priority?: Priority | null;
  experience?: Experience | null;
  source?: 'declared' | 'inferred';
  updated_at?: string;
}

export const TERRAINS: Terrain[] = [
  'sentier',
  'montagne',
  'hors_sentier',
  'itinerance',
  'urbain_transit',
];
export const AUTONOMIES: Autonomy[] = ['journee', 'bivouac_1_2', 'itinerance_longue'];
export const PRIORITIES: Priority[] = ['legerete', 'confort', 'budget', 'securite'];
export const EXPERIENCES: Experience[] = ['debut', 'regulier', 'aguerri'];

export const isTerrain = (v: unknown): v is Terrain =>
  typeof v === 'string' && TERRAINS.includes(v as Terrain);
export const isAutonomy = (v: unknown): v is Autonomy =>
  typeof v === 'string' && AUTONOMIES.includes(v as Autonomy);
export const isPriority = (v: unknown): v is Priority =>
  typeof v === 'string' && PRIORITIES.includes(v as Priority);
export const isExperience = (v: unknown): v is Experience =>
  typeof v === 'string' && EXPERIENCES.includes(v as Experience);

export const isValidOrientation = (o: unknown): o is Orientation => {
  if (!o || typeof o !== 'object') return false;
  const x = o as Record<string, unknown>;
  if (x.terrain !== undefined && x.terrain !== null && !isTerrain(x.terrain)) return false;
  if (x.autonomy !== undefined && x.autonomy !== null && !isAutonomy(x.autonomy)) return false;
  if (x.priority !== undefined && x.priority !== null && !isPriority(x.priority)) return false;
  if (x.experience !== undefined && x.experience !== null && !isExperience(x.experience)) return false;
  if (x.source !== undefined && x.source !== 'declared' && x.source !== 'inferred') return false;
  return true;
};

/** Champs du configurateur éligibles au pré-remplissage (per B.3). */
export type PrefillTarget = 'activity' | 'level' | 'maxWeightG' | 'budgetEur' | 'climate';

/** sessionParams partiel — on n'exige que les champs sur lesquels l'orientation agit. */
export interface ConfiguratorParams {
  activity?: string | null;
  level?: string | null;
  maxWeightG?: number | null;
  budgetEur?: number | null;
  climate?: string | null;
}

/** Mapping ORIENTATION → valeurs par défaut (surchargeables, jamais contraignantes). */
export function orientationToSessionParams(o: Orientation): Partial<ConfiguratorParams> {
  const out: Partial<ConfiguratorParams> = {};

  // terrain → activité (activité du configurateur)
  switch (o.terrain) {
    case 'sentier': out.activity = 'Randonnée'; break;
    case 'montagne': out.activity = 'Randonnée montagne'; break;
    case 'hors_sentier': out.activity = 'Trek'; break;
    case 'itinerance': out.activity = 'Trekking'; break;
    case 'urbain_transit': out.activity = 'Voyage'; break;
  }

  // experience → niveau (vocabulaire du configurateur)
  switch (o.experience) {
    case 'debut': out.level = 'debutant'; break;
    case 'regulier': out.level = 'intermediaire'; break;
    case 'aguerri': out.level = 'confirme'; break;
  }

  // priorité → bornes pratiques
  switch (o.priority) {
    case 'legerete': out.maxWeightG = 8000; out.climate = 'sec'; break;
    case 'confort': out.maxWeightG = 12000; break;
    case 'budget': out.budgetEur = 400; break;
    case 'securite': out.climate = 'froid'; break;
  }

  return out;
}

/**
 * Pré-remplit SEULEMENT les champs vides (''/null/undefined/0) fournis par
 * l'orientation. Ne touche JAMAIS une valeur explicitement posée. Renvoie les
 * champs réellement remplis pour que l'appelant l'ANNONCE (« jamais silencieux »).
 */
export function applyOrientationPrefill<T extends ConfiguratorParams>(
  sessionParams: T,
  orientation: Orientation | null | undefined
): { sessionParams: T; prefilledFields: PrefillTarget[] } {
  if (!orientation) return { sessionParams, prefilledFields: [] };

  const defaults = orientationToSessionParams(orientation);
  const merged: ConfiguratorParams = { ...sessionParams };
  const prefilledFields: PrefillTarget[] = [];

  const isEmpty = (v: unknown): boolean =>
    v === undefined || v === null || v === '' || (typeof v === 'number' && v === 0);

  for (const [field, value] of Object.entries(defaults)) {
    if (isEmpty((merged as Record<string, unknown>)[field])) {
      // On autorise le prefill d'un champ numérique à 0 ou vide.
      (merged as Record<string, unknown>)[field] = value;
      prefilledFields.push(field as PrefillTarget);
    }
  }

  return { sessionParams: merged as T, prefilledFields };
}

/**
 * Boucle de correction (B.4) : si l'empreinte contredit durablement l'orientation
 * déclarée, on PROPOSE une mise à jour — jamais on ne l'applique.
 * Rend la liste des champs en désaccord + la valeur suggérée (source='inferred').
 */
export interface OrientationCorrection {
  /** champ de l'orientation en désaccord */
  field: keyof Orientation;
  suggested: string | null;
  wording: string;
}

/**
 * @param orientation  orientation déclarée (source='declared' attendue)
 * @param signature    empreinte publique dérivée (Lot C) — voir fieldSignature.ts
 * @returns propositions ; [] si aucun écart durable
 */
export function proposeOrientationUpdate(
  orientation: Orientation | null | undefined,
  signature: { totalOutings?: number; bivouacsAfterDeclaredDay?: boolean; maxAutonomyDays?: number } | null | undefined
): OrientationCorrection[] {
  if (!orientation || !signature) return [];
  const corrections: OrientationCorrection[] = [];

  // Quelqu'un se déclarait « journée » mais accumule des bivouacs → autonomie.
  if (
    orientation.autonomy === 'journee' &&
    signature.bivouacsAfterDeclaredDay === true
  ) {
    corrections.push({
      field: 'autonomy',
      suggested: 'bivouac_1_2',
      wording:
        'Tes dernières sorties ressemblent à des bivouacs. Veux-tu ajuster ton autonomie ? Tu restes maître du changement.',
    });
  }

  // Moins de 3 sorties → pas encore d'empreinte fiable, on ne corrige rien.
  // (Les seuils se décident dans fieldSignature.ts, pas ici.)

  return corrections;
}