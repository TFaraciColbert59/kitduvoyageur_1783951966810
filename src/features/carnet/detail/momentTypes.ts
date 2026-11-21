import { privateMomentMediaPath } from './privateMomentMedia';
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
export const INCIDENT_TYPES = [
  {
    id: 'meteo',
    label: 'Météo',
    color: '#0369a1',
    bg: 'rgba(2, 132, 199, 0.14)',
    svgPath: 'M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973M13 12l-3 5h4l-3 5',
  },
  {
    id: 'blessure',
    label: 'Blessure',
    color: '#dc2626',
    bg: 'rgba(220, 38, 38, 0.14)',
    svgPath: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7ZM3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27',
  },
  {
    id: 'materiel',
    label: 'Matériel',
    color: '#b45309',
    bg: 'rgba(217, 119, 6, 0.14)',
    svgPath: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z',
  },
  {
    id: 'itineraire',
    label: 'Itinéraire',
    color: '#7c3aed',
    bg: 'rgba(124, 58, 237, 0.14)',
    svgPath: 'm16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
  },
  {
    id: 'eau',
    label: 'Eau',
    color: '#0284c7',
    bg: 'rgba(14, 165, 233, 0.14)',
    svgPath: 'M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97',
  },
  {
    id: 'autre',
    label: 'Autre',
    color: '#b45309',
    bg: 'rgba(217, 119, 6, 0.14)',
    svgPath: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01',
  },
] as const;

export type IncidentTypeId = (typeof INCIDENT_TYPES)[number]['id'];

export function getIncidentMeta(id?: string | null) {
  return INCIDENT_TYPES.find((t) => t.id === id) ?? INCIDENT_TYPES[INCIDENT_TYPES.length - 1];
}

export interface MomentMeta {
  amountEur?: number;
  category?: string;
  who?: string;
  whoUserId?: string;
  whoAvatarUrl?: string;
  itemId?: string;
  latin?: string;
  incidentType?: string;
  durationLabel?: string;
  timeZone?: string;
  /** URL publique de la note vocale enregistrée (https seulement). */
  audioUrl?: string;
  /**
   * Son d'ambiance (proposition n° 32) : un enregistrement sans commentaire,
   * pour capter un lieu (torrent, vent, oiseaux) plutôt qu'un récit.
   */
  ambiance?: boolean;
}

const EXPENSE_CATEGORIES = ['Repas', 'Hébergement', 'Transport', 'Matériel', 'Autre'] as const;
export const MOMENT_EXPENSE_CATEGORIES = EXPENSE_CATEGORIES;

/** Préfixe des URL publiques d'un seau Supabase du projet (lu à l'appel : l'env peut changer en test). */
export function publicMediaPrefix(bucket: 'carnet-media' | 'carnet-moments-media'): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  return `${base}/storage/v1/object/public/${bucket}/`;
}

/** Vrai si l'URL est une URL publique du seau indiqué, sur le projet Supabase de l'app. */
export function isOwnMediaUrl(url: unknown, bucket: 'carnet-media' | 'carnet-moments-media'): url is string {
  if (typeof url !== 'string' || !process.env.NEXT_PUBLIC_SUPABASE_URL) return false;
  return url.startsWith(publicMediaPrefix(bucket)) && !/\s/.test(url) && !url.includes('..');
}

/** Lecture défensive de `moment_meta` : tout champ hors format est ignoré. */
export function parseMomentMeta(raw: unknown): MomentMeta | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const meta: MomentMeta = {};
  if (typeof source.amountEur === 'number' && Number.isFinite(source.amountEur)) {
    meta.amountEur = source.amountEur;
  }
  for (const key of ['category', 'who', 'whoUserId', 'itemId', 'latin', 'durationLabel', 'timeZone', 'incidentType'] as const) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) meta[key] = value.trim().slice(0, 120);
  }
  if (typeof source.whoAvatarUrl === 'string' && source.whoAvatarUrl.trim().length <= 400) {
    meta.whoAvatarUrl = source.whoAvatarUrl.trim();
  }
  const audio = source.audioUrl;
  if (typeof audio === 'string' && audio.length <= 600 && (isOwnMediaUrl(audio, 'carnet-moments-media') || privateMomentMediaPath(audio))) meta.audioUrl = audio;
  if (source.ambiance === true) meta.ambiance = true;
  return Object.keys(meta).length > 0 ? meta : null;
}
