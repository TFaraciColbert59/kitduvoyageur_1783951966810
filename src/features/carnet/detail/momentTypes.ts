/**
 * Les neuf types de moment de la fiche carnet v2 (maquette `CREATE_TYPES`,
 * spec 01 § 1.2). Un moment ancien n'a pas de type en base : il est déduit
 * de ce qu'il porte réellement (image, extension de la vidéo, légende) et
 * jamais d'une valeur inventée.
 */

export const MOMENT_TYPES = [
  'photo',
  'video',
  'voice',
  'text',
  'meet',
  'spend',
  'kit',
  'species',
  'inc',
] as const;

export type MomentType = (typeof MOMENT_TYPES)[number];

export const MOMENT_TYPE_LABELS: Record<MomentType, string> = {
  photo: 'Photo',
  video: 'Vidéo',
  voice: 'Note vocale',
  text: 'Texte',
  meet: 'Rencontre',
  spend: 'Dépense',
  kit: 'Objet du kit',
  species: 'Espèce',
  inc: 'Incident',
};

/** Valeurs historiques ou voisines vers le type canonique. */
const LEGACY_TYPES: Record<string, MomentType> = {
  rencontre: 'meet',
  faune_flore: 'species',
  espece: 'species',
  point_de_vue: 'photo',
  note: 'text',
  texte: 'text',
  incident: 'inc',
  depense: 'spend',
  audio: 'voice',
  kit_item: 'kit',
  objet: 'kit',
};

const VIDEO_EXT = /\.(mp4|mov|webm|m4v)(\?|#|$)/i;

export function isMomentType(value: unknown): value is MomentType {
  return typeof value === 'string' && (MOMENT_TYPES as readonly string[]).includes(value);
}

/**
 * Type canonique d'un moment. `raw` est la colonne `moment_type` (ou une valeur
 * historique). Sans valeur : image → photo (vidéo si l'extension le dit),
 * légende seule → texte, sinon `null` (aucune pastille).
 */
export function resolveMomentType(input: {
  raw?: string | null;
  imageUrl?: string | null;
  caption?: string | null;
}): MomentType | null {
  const raw = input.raw?.trim().toLowerCase() ?? '';
  if (isMomentType(raw)) return raw;
  if (raw && LEGACY_TYPES[raw]) return LEGACY_TYPES[raw];
  const image = input.imageUrl?.trim();
  if (image) return VIDEO_EXT.test(image) ? 'video' : 'photo';
  if (input.caption?.trim()) return 'text';
  return null;
}

/** Données structurées d'un moment (montant, citation…), toutes optionnelles. */
export interface MomentMeta {
  amountEur?: number;
  category?: string;
  who?: string;
  itemId?: string;
  latin?: string;
  durationLabel?: string;
}

const EXPENSE_CATEGORIES = ['Repas', 'Hébergement', 'Transport', 'Matériel'] as const;
export const MOMENT_EXPENSE_CATEGORIES = EXPENSE_CATEGORIES;

/** Lecture défensive de `moment_meta` : tout champ hors format est ignoré. */
export function parseMomentMeta(raw: unknown): MomentMeta | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const meta: MomentMeta = {};
  if (typeof source.amountEur === 'number' && Number.isFinite(source.amountEur)) {
    meta.amountEur = source.amountEur;
  }
  for (const key of ['category', 'who', 'itemId', 'latin', 'durationLabel'] as const) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) meta[key] = value.trim().slice(0, 120);
  }
  return Object.keys(meta).length > 0 ? meta : null;
}
