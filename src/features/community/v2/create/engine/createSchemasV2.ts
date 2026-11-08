import { z } from 'zod';
import { moderateText } from '@/features/community/create/moderation';

/**
 * Schémas de création V2 — la loi du formulaire, un schéma par type et une
 * validation par étape (`steps.ts`).
 *
 * - messages en français, affichés tels quels (une erreur = un message, sous son
 *   champ, `aria-describedby`) ;
 * - médias : images ≤ 10 Mo pour Publication/Sortie/Club/Kit/Carnet, images ou
 *   vidéos ≤ 25 Mo pour Story (`03 § 7`) — la limite de fichier est vérifiée à
 *   la sélection (`fields/MediaFieldV2`), le schéma vérifie le nombre et l'état ;
 * - `clientRequestId` : UUID stable pendant le brouillon, rejoué tel quel à la
 *   RPC (idempotence) ;
 * - toutes les longueurs restent sous les limites des RPC
 *   (`supabase/migrations/20261108130005_communaute_v2_lot_e_atomic_creations.sql`).
 */

export const CREATE_KINDS_V2 = ['post', 'story', 'carnet', 'sortie', 'kit', 'club'] as const;
export type CreateKindV2 = (typeof CREATE_KINDS_V2)[number];

export const POST_FORMATS_V2 = ['photo', 'billet', 'question'] as const;
export type PostFormatV2 = (typeof POST_FORMATS_V2)[number];

export const POST_AUDIENCES_V2 = ['public', 'abonnies', 'club'] as const;
export type PostAudienceV2 = (typeof POST_AUDIENCES_V2)[number];

export const STORY_AUDIENCES_V2 = ['public', 'abonnies', 'close_friends', 'only_me'] as const;
export type StoryAudienceV2 = (typeof STORY_AUDIENCES_V2)[number];

export const STORY_REPLY_POLICIES_V2 = ['everyone', 'followers', 'off'] as const;
export type StoryReplyPolicyV2 = (typeof STORY_REPLY_POLICIES_V2)[number];

export const SORTIE_ACTIVITIES_V2 = ['rando', 'trail', 'ski', 'velo', 'escalade', 'autre'] as const;
export type SortieActivityV2 = (typeof SORTIE_ACTIVITIES_V2)[number];

export const SORTIE_LEVELS_V2 = ['facile', 'moyen', 'difficile'] as const;
export type SortieLevelV2 = (typeof SORTIE_LEVELS_V2)[number];

export const SORTIE_RECURRENCES_V2 = ['', 'weekly', 'monthly'] as const;
export type SortieRecurrenceV2 = (typeof SORTIE_RECURRENCES_V2)[number];

export const KIT_SEASONS_V2 = ['toute_saison', 'printemps', 'ete', 'automne', 'hiver'] as const;
export type KitSeasonV2 = (typeof KIT_SEASONS_V2)[number];

export const CARNET_VISIBILITIES_V2 = ['public', 'friends', 'private'] as const;
export type CarnetVisibilityV2 = (typeof CARNET_VISIBILITIES_V2)[number];

export const CARNET_MOMENT_KINDS_V2 = ['photo', 'rencontre', 'nuit', 'depense', 'objet', 'espece'] as const;
export type CarnetMomentKindV2 = (typeof CARNET_MOMENT_KINDS_V2)[number];

export const CLUB_PRIVACIES_V2 = ['open', 'closed'] as const;
export type ClubPrivacyV2 = (typeof CLUB_PRIVACIES_V2)[number];

/** Limites de médias (`03 § 7`), réexportées pour l'UI. */
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const STORY_MEDIA_MAX_BYTES = 25 * 1024 * 1024;
export const POST_MEDIA_MAX_COUNT = 10;
export const STORY_MAX_DURATION_MS = 60_000;

export type MediaCropV2 = 'original' | '4:5' | '1:1' | '9:16' | '3:1';
export type MediaStatusV2 = 'local' | 'uploading' | 'uploaded' | 'error';

/**
 * Média du formulaire : le fichier local n'est jamais sérialisé dans le
 * brouillon ; seuls les médias déjà téléversés (URL non vide) le sont.
 */
export interface MediaItemV2 {
  id: string;
  name: string;
  /** Type MIME (`image/jpeg`, `video/mp4`…). */
  type: string;
  size: number;
  /** Aperçu local (`blob:`) — jamais persisté dans un brouillon. */
  previewUrl: string;
  /** URL publique (carnet-media) ou signée (stories-private). */
  url: string;
  alt: string;
  cover: boolean;
  status: MediaStatusV2;
  progress: number;
  error?: string;
  storageBucket: string;
  storagePath: string;
  crop: MediaCropV2;
  /** Story vidéo : extrait publié, en millisecondes. */
  durationMs?: number;
  trimStartMs?: number;
  trimEndMs?: number;
}

export interface StoryTextLayerV2 {
  id: string;
  text: string;
  /** Position relative 0..1 dans le cadre 9:16. */
  x: number;
  y: number;
  scale: number;
  rotation: number;
  style: 'clair' | 'encre' | 'sauge';
}

export interface StoryLinkV2 {
  url: string;
  label: string;
}

export interface StoryPlaceV2 {
  label: string;
  lat: number | null;
  lng: number | null;
}

export interface StoryStickersV2 {
  place: StoryPlaceV2 | null;
  altitudeM: number | null;
  weatherLabel: string;
  distanceKm: number | null;
  link: StoryLinkV2 | null;
  /** Carnet lié (chaîne vide = aucun). */
  carnetId: string;
  carnetTitle: string;
}

export interface KitItemV2 {
  id: string;
  name: string;
  category: string;
  weightG: number;
  quantity: number;
  productId: string | null;
  ownershipId: string | null;
}

export interface CarnetMomentV2 {
  id: string;
  kind: CarnetMomentKindV2;
  /** Heure `HH:MM`, vide si non renseignée. */
  time: string;
  text: string;
  place: string;
  photo: MediaItemV2 | null;
}

export interface CarnetNightV2 {
  name: string;
  type: 'refuge' | 'gite' | 'bivouac' | 'hotel' | 'camping' | 'autre';
  infos: string;
}

export interface CarnetDayV2 {
  id: string;
  /** 1..60. */
  dayNumber: number;
  title: string;
  date: string;
  night: CarnetNightV2 | null;
  moments: CarnetMomentV2[];
}

export interface CreateFormValuesMapV2 {
  post: PostFormValuesV2;
  story: StoryFormValuesV2;
  carnet: CarnetFormValuesV2;
  sortie: SortieFormValuesV2;
  kit: KitFormValuesV2;
  club: ClubFormValuesV2;
}

// ---------------------------------------------------------------------------
// Briques communes
// ---------------------------------------------------------------------------

const mediaItemSchema = z.custom<MediaItemV2>(
  (value) =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as MediaItemV2).id === 'string' &&
    typeof (value as MediaItemV2).status === 'string',
  { error: 'Média invalide.' },
);

function mediaArray(max: number, min = 0, message = 'Ajoute au moins un média.') {
  const base = z.array(mediaItemSchema).max(max, `${max} médias maximum.`);
  return min > 0 ? base.min(min, message) : base;
}

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function todayIso(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function isClock(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

const optionalDate = z
  .string()
  .default('')
  .refine((value) => value === '' || isIsoDate(value), 'Date invalide.');

const requiredDate = (message: string) =>
  z
    .string()
    .default('')
    .refine((value) => value !== '', message)
    .refine((value) => value === '' || isIsoDate(value), 'Date invalide.');

const requiredClock = z
  .string()
  .default('')
  .refine((value) => value !== '', 'L’heure est requise.')
  .refine((value) => value === '' || isClock(value), 'Heure invalide (format HH:MM).');

const tagArray = z
  .array(z.string().trim().min(1, 'Un hashtag ne peut pas être vide.').max(24, '24 caractères maximum par hashtag.'))
  .max(10, '10 hashtags maximum.')
  .default([]);

const handleArray = z
  .array(z.string().trim().max(60, 'Mention invalide.'))
  .max(10, '10 mentions maximum.')
  .default([]);

/** Un UUID v4 stable (brouillon rejoué tel quel). */
export function newClientRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (mark) => {
    const random = Math.floor(Math.random() * 16);
    const value = mark === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

const clientRequestIdSchema = z.string().min(1).default(() => newClientRequestId());

/** Une soumission impossible tant qu'un média n'est pas téléversé. */
export function findPendingMedia(values: unknown): MediaItemV2 | null {
  if (!values || typeof values !== 'object') return null;
  const visit = (value: unknown): MediaItemV2 | null => {
    if (Array.isArray(value)) {
      for (const entry of value) {
        const found = visit(entry);
        if (found) return found;
      }
      return null;
    }
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if (
        typeof record.id === 'string' &&
        typeof record.status === 'string' &&
        typeof record.size === 'number' &&
        typeof record.name === 'string'
      ) {
        const media = record as unknown as MediaItemV2;
        return media.status === 'uploading' || media.status === 'error' || media.status === 'local'
          ? media
          : null;
      }
      for (const child of Object.values(record)) {
        const found = visit(child);
        if (found) return found;
      }
    }
    return null;
  };
  return visit(values);
}

/** Fabrique un média vide (id, état) pour les tests et les valeurs initiales. */
export function createMediaItemV2(partial: Partial<MediaItemV2> = {}): MediaItemV2 {
  return {
    id: newClientRequestId(),
    name: '',
    type: '',
    size: 0,
    previewUrl: '',
    url: '',
    alt: '',
    cover: false,
    status: 'local',
    progress: 0,
    storageBucket: '',
    storagePath: '',
    crop: 'original',
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// Publication — Format, Contenu, Diffusion
// ---------------------------------------------------------------------------

export const postSchemaV2 = z
  .object({
    format: z.enum(POST_FORMATS_V2, { error: 'Choisis un format de publication.' }).default('photo'),
    audience: z.enum(POST_AUDIENCES_V2, { error: 'Choisis une audience.' }).default('public'),
    clubId: z.string().default(''),
    media: mediaArray(POST_MEDIA_MAX_COUNT).default([]),
    title: z.string().max(120, '120 caractères maximum.').default(''),
    content: z.string().max(2000, '2 000 caractères maximum.').default(''),
    location: z.string().max(120, '120 caractères maximum.').default(''),
    locationLat: z.number().nullable().default(null),
    locationLng: z.number().nullable().default(null),
    tags: tagArray,
    mentions: handleArray,
    clientRequestId: clientRequestIdSchema,
  })
  .superRefine((value, ctx) => {
    const maxContent = value.format === 'photo' ? 600 : 2000;
    if (value.content.length > maxContent) {
      ctx.addIssue({
        code: 'custom',
        path: ['content'],
        message: `${maxContent} caractères maximum.`,
      });
    }
    if (value.format === 'photo') {
      if (value.media.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['media'],
          message: 'Ajoute au moins une photo.',
        });
      }
      if (!value.content.trim()) {
        ctx.addIssue({ code: 'custom', path: ['content'], message: 'Écris une légende.' });
      }
    } else if (value.format === 'billet') {
      if (!value.title.trim()) {
        ctx.addIssue({ code: 'custom', path: ['title'], message: 'Le titre est requis.' });
      }
      if (!value.content.trim()) {
        ctx.addIssue({ code: 'custom', path: ['content'], message: 'Le texte est requis.' });
      }
    } else if (!value.content.trim()) {
      ctx.addIssue({ code: 'custom', path: ['content'], message: 'Pose ta question.' });
    }
    if (value.audience !== 'public' && value.media.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['media'],
        message: 'Les médias ne sont autorisés que pour une publication publique.',
      });
    }
    if (value.audience === 'club' && !value.clubId.trim()) {
      ctx.addIssue({ code: 'custom', path: ['clubId'], message: 'Choisis un club.' });
    }
  });

export type PostFormValuesV2 = z.infer<typeof postSchemaV2>;

// ---------------------------------------------------------------------------
// Story — Média, Édition, Diffusion
// ---------------------------------------------------------------------------

const storyTextLayerSchema = z.object({
  id: z.string(),
  text: z.string().max(120, '120 caractères maximum.').default(''),
  x: z.number().min(0).max(1).default(0.5),
  y: z.number().min(0).max(1).default(0.5),
  scale: z.number().min(0.5).max(2.5).default(1),
  rotation: z.number().min(-45).max(45).default(0),
  style: z.enum(['clair', 'encre', 'sauge']).default('clair'),
});

export const storyStickersDefaults = (): StoryStickersV2 => ({
  place: null,
  altitudeM: null,
  weatherLabel: '',
  distanceKm: null,
  link: null,
  carnetId: '',
  carnetTitle: '',
});

const storyPlaceSchema = z.object({
  label: z.string().max(120).default(''),
  lat: z.number().nullable().default(null),
  lng: z.number().nullable().default(null),
});

const storyLinkSchema = z.object({
  url: z
    .string()
    .max(500, '500 caractères maximum.')
    .refine((value) => {
      try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'Lien invalide (adresse http ou https attendue).'),
  label: z.string().max(60, '60 caractères maximum.').default(''),
});

const storyStickersSchema = z.object({
  place: storyPlaceSchema.nullable().default(null),
  altitudeM: z.number().int().min(-500).max(9000).nullable().default(null),
  weatherLabel: z.string().max(60).default(''),
  distanceKm: z.number().min(0).max(500).nullable().default(null),
  link: storyLinkSchema.nullable().default(null),
  carnetId: z.string().default(''),
  carnetTitle: z.string().max(140).default(''),
});

export const storySchemaV2 = z
  .object({
    media: mediaArray(1, 1, 'Ajoute une photo ou une vidéo.').default([]),
    caption: z.string().max(280, '280 caractères maximum.').default(''),
    altText: z.string().max(200, '200 caractères maximum.').default(''),
    audience: z.enum(STORY_AUDIENCES_V2, { error: 'Choisis une audience.' }).default('public'),
    replyPolicy: z.enum(STORY_REPLY_POLICIES_V2, { error: 'Choisis une politique de réponse.' }).default('everyone'),
    allowReshare: z.boolean().default(true),
    textLayers: z.array(storyTextLayerSchema).max(5, '5 textes maximum.').default([]),
    stickers: storyStickersSchema.default(storyStickersDefaults),
    trimStartMs: z.number().int().min(0).nullable().default(null),
    trimEndMs: z.number().int().min(0).nullable().default(null),
    clientRequestId: clientRequestIdSchema,
  })
  .superRefine((value, ctx) => {
    const media = value.media[0];
    if (media && media.type.startsWith('video/')) {
      const duration = media.durationMs ?? 0;
      const start = value.trimStartMs ?? 0;
      const end = value.trimEndMs ?? duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        ctx.addIssue({ code: 'custom', path: ['media'], message: 'Durée de la vidéo inconnue.' });
      } else if (end - start <= 0) {
        ctx.addIssue({ code: 'custom', path: ['trimStartMs'], message: 'L’extrait est vide.' });
      } else if (end - start > STORY_MAX_DURATION_MS) {
        ctx.addIssue({ code: 'custom', path: ['trimEndMs'], message: 'Extrait de 60 secondes maximum.' });
      }
    }
    if (value.textLayers.some((layer) => !layer.text.trim())) {
      ctx.addIssue({ code: 'custom', path: ['textLayers'], message: 'Un texte posé est vide.' });
    }
  });

export type StoryFormValuesV2 = z.infer<typeof storySchemaV2>;

// ---------------------------------------------------------------------------
// Sortie — Activité et lieu, Itinéraire, Participants, Sécurité
// ---------------------------------------------------------------------------

export const sortieSchemaV2 = z
  .object({
    activity: z.enum(SORTIE_ACTIVITIES_V2, { error: 'Choisis une activité.' }).default('rando'),
    title: z
      .string()
      .default('')
      .refine((value) => value.trim().length > 0, 'Le titre est requis.')
      .refine((value) => value.trim().length <= 120, '120 caractères maximum.'),
    location: z
      .string()
      .default('')
      .refine((value) => value.trim().length > 0, 'Le lieu est requis.')
      .refine((value) => value.trim().length <= 120, '120 caractères maximum.'),
    meetingPoint: z.string().max(120, '120 caractères maximum.').default(''),
    meetingLat: z.number().nullable().default(null),
    meetingLng: z.number().nullable().default(null),
    date: requiredDate('La date est requise.'),
    startTime: requiredClock,
    endTime: z
      .string()
      .default('')
      .refine((value) => value === '' || isClock(value), 'Heure invalide (format HH:MM).'),
    level: z.enum(SORTIE_LEVELS_V2, { error: 'Choisis un niveau.' }).default('moyen'),
    distanceKm: z.number().min(0, 'La distance ne peut pas être négative.').max(500, '500 km maximum.').default(0),
    elevationGainM: z
      .number()
      .int('Le dénivelé doit être entier.')
      .min(0, 'Le dénivelé ne peut pas être négatif.')
      .max(20_000, '20 000 m maximum.')
      .default(0),
    duration: z.string().max(60, '60 caractères maximum.').default(''),
    maxParticipants: z
      .number()
      .int('Le nombre de participants doit être entier.')
      .min(2, '2 participants minimum.')
      .max(50, '50 participants maximum.')
      .default(10),
    waitlist: z.boolean().default(false),
    clubId: z.string().default(''),
    kitId: z.string().default(''),
    safetyChecklist: z.array(z.string().max(40, '40 caractères maximum.')).max(12, '12 consignes maximum.').default([]),
    safetyNotes: z.string().max(500, '500 caractères maximum.').default(''),
    description: z.string().max(1500, '1 500 caractères maximum.').default(''),
    recurrence: z.enum(SORTIE_RECURRENCES_V2).default(''),
    cover: mediaArray(1).default([]),
    announce: z.boolean().default(true),
    clientRequestId: clientRequestIdSchema,
  })
  .superRefine((value, ctx) => {
    if (isIsoDate(value.date) && value.date < todayIso()) {
      ctx.addIssue({
        code: 'custom',
        path: ['date'],
        message: 'La date doit être aujourd’hui ou dans le futur.',
      });
    }
    if (value.endTime && isClock(value.endTime) && isClock(value.startTime) && value.endTime <= value.startTime) {
      ctx.addIssue({
        code: 'custom',
        path: ['endTime'],
        message: 'L’heure de fin doit suivre l’heure de début.',
      });
    }
  });

export type SortieFormValuesV2 = z.infer<typeof sortieSchemaV2>;

// ---------------------------------------------------------------------------
// Kit — Inventaire, Compléter, Partager
// ---------------------------------------------------------------------------

const kitItemSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, 'Le nom de l’objet est requis.').max(100, '100 caractères maximum.'),
  category: z.string().max(60).default('Divers'),
  weightG: z.number().int().min(0).max(60_000).default(0),
  quantity: z.number().int().min(1).max(20).default(1),
  productId: z.string().nullable().default(null),
  ownershipId: z.string().nullable().default(null),
});

export const kitSchemaV2 = z
  .object({
    name: z
      .string()
      .default('')
      .refine((value) => value.trim().length > 0, 'Le nom du kit est requis.')
      .refine((value) => value.trim().length <= 100, '100 caractères maximum.'),
    description: z.string().max(1000, '1 000 caractères maximum.').default(''),
    season: z.enum(KIT_SEASONS_V2, { error: 'Choisis une saison.' }).default('toute_saison'),
    isPublic: z.boolean().default(false),
    cover: mediaArray(1).default([]),
    items: z.array(kitItemSchema).default([]),
    clientRequestId: clientRequestIdSchema,
  })
  .superRefine((value, ctx) => {
    if (value.items.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'Ajoute au moins un objet avec un poids.',
      });
      return;
    }
    if (!value.items.some((item) => item.weightG > 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'Ajoute au moins un objet avec un poids.',
      });
    }
  });

export type KitFormValuesV2 = z.infer<typeof kitSchemaV2>;

// ---------------------------------------------------------------------------
// Club — Identité, Univers, Adhésion, Publication
// ---------------------------------------------------------------------------

const slugSchema = z
  .string()
  .default('')
  .refine(
    (value) => value === '' || /^[a-z0-9][a-z0-9-]{1,59}$/.test(value),
    'Adresse invalide : 2 à 60 caractères, lettres minuscules, chiffres et tirets.',
  );

export const clubSchemaV2 = z.object({
  name: z
    .string()
    .default('')
    .refine((value) => value.trim().length > 0, 'Le nom du club est requis.')
    .refine((value) => value.trim().length <= 80, '80 caractères maximum.')
    .superRefine((value, ctx) => {
      const issue = moderateText(value);
      if (issue) ctx.addIssue({ code: 'custom', message: issue });
    }),
  slug: slugSchema,
  privacy: z.enum(CLUB_PRIVACIES_V2, { error: 'Choisis un mode d’adhésion.' }).default('open'),
  cover: mediaArray(1).default([]),
  coverRatio: z.enum(['square', 'wide']).default('square'),
  activities: z
    .array(z.string().trim().min(1, 'Une activité ne peut pas être vide.').max(40, '40 caractères maximum.'))
    .max(5, '5 activités maximum.')
    .default([]),
  description: z.string().max(1500, '1 500 caractères maximum.').default(''),
  locationLabel: z.string().max(120, '120 caractères maximum.').default(''),
  zoneRadiusKm: z.number().min(1, '1 km minimum.').max(500, '500 km maximum.').nullable().default(null),
  membershipRules: z.string().max(1000, '1 000 caractères maximum.').default(''),
  joinQuestions: z
    .array(z.string().trim().min(1, 'Une question ne peut pas être vide.').max(200, '200 caractères maximum.'))
    .max(3, '3 questions maximum.')
    .default([]),
  welcomePost: z.boolean().default(true),
  welcomeContent: z.string().max(2000, '2 000 caractères maximum.').default(''),
  clientRequestId: clientRequestIdSchema,
});

export type ClubFormValuesV2 = z.infer<typeof clubSchemaV2>;

// ---------------------------------------------------------------------------
// Carnet — Infos, Tracé, Jours, Partage
// ---------------------------------------------------------------------------

const momentKindSchema = z.enum(CARNET_MOMENT_KINDS_V2).default('photo');

const carnetMomentSchema = z.object({
  id: z.string(),
  kind: momentKindSchema,
  time: z
    .string()
    .default('')
    .refine((value) => value === '' || isClock(value), 'Heure invalide (format HH:MM).'),
  text: z.string().max(500, '500 caractères maximum.').default(''),
  place: z.string().max(120, '120 caractères maximum.').default(''),
  photo: mediaItemSchema.nullable().default(null),
});

const carnetNightSchema = z.object({
  name: z.string().trim().min(1, 'Le nom du lieu est requis.').max(120, '120 caractères maximum.'),
  type: z.enum(['refuge', 'gite', 'bivouac', 'hotel', 'camping', 'autre']).default('bivouac'),
  infos: z.string().max(300, '300 caractères maximum.').default(''),
});

const carnetDaySchema = z.object({
  id: z.string(),
  dayNumber: z.number().int().min(1).max(60),
  title: z.string().max(120, '120 caractères maximum.').default(''),
  date: z
    .string()
    .default('')
    .refine((value) => value === '' || isIsoDate(value), 'Date invalide.'),
  night: carnetNightSchema.nullable().default(null),
  moments: z.array(carnetMomentSchema).max(12, '12 moments par jour maximum.').default([]),
});

const tracePointSchema = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

export const carnetSchemaV2 = z
  .object({
    title: z
      .string()
      .default('')
      .refine((value) => value.trim().length > 0, 'Le titre est requis.')
      .refine((value) => value.trim().length <= 140, '140 caractères maximum.'),
    destination: z
      .string()
      .default('')
      .refine((value) => value.trim().length > 0, 'La destination est requise.')
      .refine((value) => value.trim().length <= 120, '120 caractères maximum.'),
    startDate: optionalDate,
    endDate: optionalDate,
    description: z.string().max(1000, '1 000 caractères maximum.').default(''),
    visibility: z.enum(CARNET_VISIBILITIES_V2, { error: 'Choisis une visibilité.' }).default('private'),
    nbVoyageurs: z
      .number()
      .int()
      .min(1, '1 voyageur minimum.')
      .max(50, '50 voyageurs maximum.')
      .default(1),
    isCollaborative: z.boolean().default(false),
    collaborators: z.array(z.string()).max(20, '20 collaborateurs maximum.').default([]),
    tags: tagArray,
    trace: z.array(tracePointSchema).max(2000, 'Tracé trop long.').default([]),
    distanceKm: z.number().min(0).max(10_000, '10 000 km maximum.').default(0),
    deniveleM: z.number().int().min(0).max(30_000, '30 000 m maximum.').default(0),
    startLat: z.number().nullable().default(null),
    startLng: z.number().nullable().default(null),
    days: z.array(carnetDaySchema).max(60, '60 jours maximum.').default([]),
    coverMediaId: z.string().default(''),
    postEnabled: z.boolean().default(false),
    postContent: z.string().max(2000, '2 000 caractères maximum.').default(''),
    clientRequestId: clientRequestIdSchema,
  })
  .superRefine((value, ctx) => {
    if (value.startDate && value.endDate && value.endDate < value.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'La date de fin ne peut pas précéder la date de début.',
      });
    }
    if (value.days.some((day) => day.moments.some((moment) => !moment.text.trim() && !moment.photo))) {
      ctx.addIssue({
        code: 'custom',
        path: ['days'],
        message: 'Complète chaque moment (texte ou photo), ou retire-le.',
      });
    }
  });

export type CarnetFormValuesV2 = z.infer<typeof carnetSchemaV2>;

// ---------------------------------------------------------------------------
// Registre, valeurs initiales, libellés
// ---------------------------------------------------------------------------

export const createSchemasV2 = {
  post: postSchemaV2,
  story: storySchemaV2,
  carnet: carnetSchemaV2,
  sortie: sortieSchemaV2,
  kit: kitSchemaV2,
  club: clubSchemaV2,
} satisfies Record<CreateKindV2, z.ZodTypeAny>;

const defaultsFactories = {
  post: (): PostFormValuesV2 => ({
    format: 'photo',
    audience: 'public',
    clubId: '',
    media: [],
    title: '',
    content: '',
    location: '',
    locationLat: null,
    locationLng: null,
    tags: [],
    mentions: [],
    clientRequestId: newClientRequestId(),
  }),
  story: (): StoryFormValuesV2 => ({
    media: [],
    caption: '',
    altText: '',
    audience: 'public',
    replyPolicy: 'everyone',
    allowReshare: true,
    textLayers: [],
    stickers: storyStickersDefaults(),
    trimStartMs: null,
    trimEndMs: null,
    clientRequestId: newClientRequestId(),
  }),
  sortie: (): SortieFormValuesV2 => ({
    activity: 'rando',
    title: '',
    location: '',
    meetingPoint: '',
    meetingLat: null,
    meetingLng: null,
    date: '',
    startTime: '',
    endTime: '',
    level: 'moyen',
    distanceKm: 0,
    elevationGainM: 0,
    duration: '',
    maxParticipants: 10,
    waitlist: false,
    clubId: '',
    kitId: '',
    safetyChecklist: [],
    safetyNotes: '',
    description: '',
    recurrence: '',
    cover: [],
    announce: true,
    clientRequestId: newClientRequestId(),
  }),
  kit: (): KitFormValuesV2 => ({
    name: '',
    description: '',
    season: 'toute_saison',
    isPublic: false,
    cover: [],
    items: [],
    clientRequestId: newClientRequestId(),
  }),
  club: (): ClubFormValuesV2 => ({
    name: '',
    slug: '',
    privacy: 'open',
    cover: [],
    coverRatio: 'square',
    activities: [],
    description: '',
    locationLabel: '',
    zoneRadiusKm: null,
    membershipRules: '',
    joinQuestions: [],
    welcomePost: true,
    welcomeContent: '',
    clientRequestId: newClientRequestId(),
  }),
  carnet: (): CarnetFormValuesV2 => ({
    title: '',
    destination: '',
    startDate: '',
    endDate: '',
    description: '',
    visibility: 'private',
    nbVoyageurs: 1,
    isCollaborative: false,
    collaborators: [],
    tags: [],
    trace: [],
    distanceKm: 0,
    deniveleM: 0,
    startLat: null,
    startLng: null,
    days: [],
    coverMediaId: '',
    postEnabled: false,
    postContent: '',
    clientRequestId: newClientRequestId(),
  }),
} satisfies Record<CreateKindV2, () => unknown>;

/** Valeurs initiales neuves (les tableaux ne sont jamais partagés). */
export function createDefaultsV2<K extends CreateKindV2>(kind: K): CreateFormValuesMapV2[K] {
  return defaultsFactories[kind]() as CreateFormValuesMapV2[K];
}

export function isCreateKindV2(value: string | null | undefined): value is CreateKindV2 {
  return !!value && (CREATE_KINDS_V2 as readonly string[]).includes(value);
}

/** Libellés lisibles des champs (compteur d'erreurs, messages serveur). */
export const CREATE_FIELD_LABELS_V2: Record<string, string> = {
  format: 'Format',
  audience: 'Audience',
  clubId: 'Club',
  media: 'Médias',
  title: 'Titre',
  content: 'Texte',
  location: 'Lieu',
  tags: 'Hashtags',
  mentions: 'Mentions',
  caption: 'Légende',
  altText: 'Texte alternatif',
  replyPolicy: 'Réponses',
  textLayers: 'Texte posé',
  stickers: 'Stickers',
  trimStartMs: 'Début de l’extrait',
  trimEndMs: 'Fin de l’extrait',
  activity: 'Activité',
  meetingPoint: 'Rendez-vous',
  date: 'Date',
  startTime: 'Heure',
  endTime: 'Heure de fin',
  level: 'Niveau',
  distanceKm: 'Distance',
  elevationGainM: 'Dénivelé',
  duration: 'Durée',
  maxParticipants: 'Participants maximum',
  waitlist: 'Liste d’attente',
  safetyChecklist: 'Check-list sécurité',
  safetyNotes: 'Consignes de sécurité',
  description: 'Description',
  recurrence: 'Récurrence',
  cover: 'Couverture',
  announce: 'Annonce',
  privacy: 'Adhésion',
  activities: 'Activités',
  slug: 'Adresse du club',
  locationLabel: 'Zone d’activité',
  zoneRadiusKm: 'Rayon',
  membershipRules: 'Règles d’adhésion',
  joinQuestions: 'Questions d’adhésion',
  welcomePost: 'Post d’accueil',
  welcomeContent: 'Message d’accueil',
  destination: 'Destination',
  startDate: 'Date de début',
  endDate: 'Date de fin',
  visibility: 'Visibilité',
  nbVoyageurs: 'Voyageurs',
  collaborators: 'Collaborateurs',
  trace: 'Tracé',
  deniveleM: 'Dénivelé',
  days: 'Jours',
  coverMediaId: 'Couverture',
  postEnabled: 'Post dans le fil',
  postContent: 'Texte du post',
  items: 'Inventaire',
  isPublic: 'Visibilité',
  name: 'Nom',
  season: 'Saison',
};
