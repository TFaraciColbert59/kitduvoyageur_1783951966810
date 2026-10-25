import { z } from 'zod';

/**
 * Schémas de création des six types de contenu.
 *
 * Règles :
 * - messages d’erreur en français, destinés à être affichés tels quels ;
 * - un schéma par type, avec des règles conditionnelles (`post`) ;
 * - aucune URL de couverture brute : les covers passent par `MediaItem[]` ;
 * - dates au format `AAAA-MM-JJ`, validées comme de vraies dates.
 */

export const CREATE_KINDS = ['post', 'story', 'carnet', 'sortie', 'kit', 'club'] as const;
export type CreateKind = (typeof CREATE_KINDS)[number];

export const POST_KINDS = ['photo', 'billet', 'question', 'event'] as const;
export type PostKind = (typeof POST_KINDS)[number];

export const POST_AUDIENCES = ['public', 'abonnies', 'club'] as const;
export type PostAudience = (typeof POST_AUDIENCES)[number];

export const STORY_AUDIENCES = ['public', 'abonnies', 'only_me'] as const;
export type StoryAudience = (typeof STORY_AUDIENCES)[number];

/** Politique de réponse, alignée sur `post_stories.reply_policy`. */
export const STORY_REPLY_POLICIES = ['everyone', 'followers', 'off'] as const;
export type StoryReplyPolicy = (typeof STORY_REPLY_POLICIES)[number];

export const KIT_SEASONS = ['toute_saison', 'printemps', 'ete', 'automne', 'hiver'] as const;
export type KitSeason = (typeof KIT_SEASONS)[number];

export const SORTIE_LEVELS = ['facile', 'moyen', 'difficile'] as const;
export type SortieLevel = (typeof SORTIE_LEVELS)[number];

export const CARNET_VISIBILITIES = ['public', 'private'] as const;
export type CarnetVisibility = (typeof CARNET_VISIBILITIES)[number];

export const CLUB_PRIVACIES = ['open', 'closed'] as const;
export type ClubPrivacy = (typeof CLUB_PRIVACIES)[number];

/** Taille maximale d’un média, alignée sur `uploadPostMedia`. */
export const MEDIA_MAX_BYTES = 50 * 1024 * 1024;
export const MEDIA_MAX_COUNT = 10;

// ---------------------------------------------------------------------------
// Briques communes
// ---------------------------------------------------------------------------

const mediaItemSchema = z.object({
  id: z.string().default(''),
  name: z.string().default(''),
  type: z.string().default(''),
  size: z.number().min(0).default(0),
  previewUrl: z.string().default(''),
  url: z.string().url('L’adresse du média est invalide.').nullable().default(null),
  alt: z.string().max(200, '200 caractères maximum pour le texte alternatif.').default(''),
  cover: z.boolean().default(false),
  status: z.enum(['local', 'uploading', 'uploaded', 'error']).default('local'),
  progress: z.number().min(0).max(100).default(0),
  error: z.string().optional(),
  file: z.any().optional(),
});

const mediaArray = (max: number) =>
  z.array(mediaItemSchema).max(max, `${max} média${max > 1 ? 's' : ''} maximum.`);

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

function requiredText(message: string, max?: number) {
  const schema = z.string({ error: message }).trim().min(1, message);
  return typeof max === 'number'
    ? schema.max(max, `${max} caractères maximum.`)
    : schema;
}

const optionalDate = z
  .string()
  .default('')
  .refine((value) => value === '' || isIsoDate(value), 'Date invalide (format AAAA-MM-JJ).');

const requiredDate = z
  .string({ error: 'La date est requise.' })
  .refine((value) => isIsoDate(value), 'La date est requise (format AAAA-MM-JJ).');

function addDateRangeIssue(
  value: { startDate?: string; endDate?: string },
  ctx: z.RefinementCtx,
) {
  if (!value.startDate || !value.endDate) return;
  if (!isIsoDate(value.startDate) || !isIsoDate(value.endDate)) return;
  if (value.endDate < value.startDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'La date de fin ne peut pas précéder la date de début.',
    });
  }
}

function addFutureIssue(value: string, ctx: z.RefinementCtx, path: string) {
  if (!value || !isIsoDate(value)) return;
  if (value < todayIso()) {
    ctx.addIssue({
      code: 'custom',
      path: [path],
      message: 'La date doit être aujourd’hui ou dans le futur.',
    });
  }
}

// ---------------------------------------------------------------------------
// Publication — règles conditionnelles par format
// ---------------------------------------------------------------------------

const postSchema = z
  .object({
    kind: z.enum(POST_KINDS, { error: 'Choisis un format de publication.' }).default('photo'),
    title: z.string().max(120, '120 caractères maximum.').default(''),
    content: z.string().max(4000, '4 000 caractères maximum.').default(''),
    audience: z.enum(POST_AUDIENCES, { error: 'Choisis une audience.' }).default('public'),
    clubId: z.string().default(''),
    location: z.string().max(120, '120 caractères maximum.').default(''),
    tags: z
      .array(z.string().trim().min(1).max(24, '24 caractères maximum par tag.'))
      .max(10, '10 tags maximum.')
      .default([]),
    media: mediaArray(MEDIA_MAX_COUNT).default([]),
    eventDate: optionalDate,
    eventDuration: z.string().max(60, '60 caractères maximum.').default(''),
    eventMax: z
      .number({ error: 'Le nombre de participants est requis.' })
      .int('Le nombre de participants doit être entier.')
      .min(2, '2 participants minimum.')
      .max(50, '50 participants maximum.')
      .default(10),
  })
  .superRefine((value, ctx) => {
    if (value.kind !== 'photo') {
      if (!value.title.trim()) {
        ctx.addIssue({ code: 'custom', path: ['title'], message: 'Le titre est requis.' });
      }
      if (!value.content.trim()) {
        ctx.addIssue({ code: 'custom', path: ['content'], message: 'Le texte est requis.' });
      }
    }
    if (value.kind === 'photo' && value.media.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['media'],
        message: 'Ajoute au moins une photo ou une vidéo.',
      });
    }
    if (value.kind === 'event') {
      if (!value.eventDate) {
        ctx.addIssue({
          code: 'custom',
          path: ['eventDate'],
          message: 'La date de l’événement est requise.',
        });
      } else {
        addFutureIssue(value.eventDate, ctx, 'eventDate');
      }
    }
    if (value.audience === 'club' && !value.clubId.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['clubId'],
        message: 'Choisis un club pour cette audience.',
      });
    }
  });

const storySchema = z.object({
  media: mediaArray(1).min(1, 'Ajoute au moins un média.'),
  caption: z.string().max(280, '280 caractères maximum.').default(''),
  audience: z.enum(STORY_AUDIENCES, { error: 'Choisis une audience.' }).default('public'),
  replyPolicy: z
    .enum(STORY_REPLY_POLICIES, { error: 'Choisis une politique de réponse.' })
    .default('everyone'),
});

const carnetSchema = z
  .object({
    title: requiredText('Le titre est requis.', 120),
    destination: requiredText('La destination est requise.', 120),
    startDate: optionalDate,
    endDate: optionalDate,
    description: z.string().max(1000, '1 000 caractères maximum.').default(''),
    visibility: z.enum(CARNET_VISIBILITIES, { error: 'Choisis une visibilité.' }).default('public'),
    cover: mediaArray(1).default([]),
  })
  .superRefine(addDateRangeIssue);

const sortieSchema = z
  .object({
    title: requiredText('Le titre est requis.', 120),
    startDate: requiredDate,
    endDate: optionalDate,
    duration: z.string().max(60, '60 caractères maximum.').default(''),
    location: requiredText('Le lieu est requis.', 120),
    level: z.enum(SORTIE_LEVELS, { error: 'Choisis un niveau.' }).default('moyen'),
    maxParticipants: z
      .number({ error: 'Le nombre de participants est requis.' })
      .int('Le nombre de participants doit être entier.')
      .min(2, '2 participants minimum.')
      .max(50, '50 participants maximum.')
      .default(10),
    description: z.string().max(1500, '1 500 caractères maximum.').default(''),
    cover: mediaArray(1).default([]),
  })
  .superRefine((value, ctx) => {
    addFutureIssue(value.startDate, ctx, 'startDate');
    addDateRangeIssue(value, ctx);
  });

const kitSchema = z.object({
  name: requiredText('Le nom du kit est requis.', 100),
  season: z.enum(KIT_SEASONS, { error: 'Choisis une saison.' }).default('toute_saison'),
  weightG: z
    .number({ error: 'Le poids est requis.' })
    .int('Le poids doit être un nombre entier de grammes.')
    .positive('Le poids doit être supérieur à 0 g.')
    .max(60_000, 'Le poids ne peut pas dépasser 60 000 g.')
    .default(0),
  description: z.string().max(1000, '1 000 caractères maximum.').default(''),
  isPublic: z.boolean().default(true),
  cover: mediaArray(1).default([]),
});

const clubSchema = z.object({
  name: requiredText('Le nom du club est requis.', 80),
  category: requiredText('La catégorie est requise.', 60),
  location: z.string().max(80, '80 caractères maximum.').default(''),
  description: z.string().max(1500, '1 500 caractères maximum.').default(''),
  privacy: z.enum(CLUB_PRIVACIES, { error: 'Choisis un mode d’adhésion.' }).default('open'),
  membershipRules: z.string().max(1000, '1 000 caractères maximum.').default(''),
  cover: mediaArray(1).default([]),
});

// ---------------------------------------------------------------------------
// Registre et valeurs initiales
// ---------------------------------------------------------------------------

export const createSchemas = {
  post: postSchema,
  story: storySchema,
  carnet: carnetSchema,
  sortie: sortieSchema,
  kit: kitSchema,
  club: clubSchema,
} satisfies Record<CreateKind, z.ZodTypeAny>;

export type PostFormValues = z.infer<typeof postSchema>;
export type StoryFormValues = z.infer<typeof storySchema>;
export type CarnetFormValues = z.infer<typeof carnetSchema>;
export type SortieFormValues = z.infer<typeof sortieSchema>;
export type KitFormValues = z.infer<typeof kitSchema>;
export type ClubFormValues = z.infer<typeof clubSchema>;

export interface CreateFormValuesMap {
  post: PostFormValues;
  story: StoryFormValues;
  carnet: CarnetFormValues;
  sortie: SortieFormValues;
  kit: KitFormValues;
  club: ClubFormValues;
}

const defaultsFactories = {
  post: (): PostFormValues => ({
    kind: 'photo',
    title: '',
    content: '',
    audience: 'public',
    clubId: '',
    location: '',
    tags: [],
    media: [],
    eventDate: '',
    eventDuration: '',
    eventMax: 10,
  }),
  story: (): StoryFormValues => ({
    media: [],
    caption: '',
    audience: 'public',
    replyPolicy: 'everyone',
  }),
  carnet: (): CarnetFormValues => ({
    title: '',
    destination: '',
    startDate: '',
    endDate: '',
    description: '',
    visibility: 'public',
    cover: [],
  }),
  sortie: (): SortieFormValues => ({
    title: '',
    startDate: '',
    endDate: '',
    duration: '',
    location: '',
    level: 'moyen',
    maxParticipants: 10,
    description: '',
    cover: [],
  }),
  kit: (): KitFormValues => ({
    name: '',
    season: 'toute_saison',
    weightG: 0,
    description: '',
    isPublic: true,
    cover: [],
  }),
  club: (): ClubFormValues => ({
    name: '',
    category: '',
    location: '',
    description: '',
    privacy: 'open',
    membershipRules: '',
    cover: [],
  }),
} satisfies Record<CreateKind, () => unknown>;

/** Valeurs initiales neuves (les tableaux ne sont jamais partagés). */
export function createDefaults<K extends CreateKind>(kind: K): CreateFormValuesMap[K] {
  return defaultsFactories[kind]() as CreateFormValuesMap[K];
}

/** Libellés lisibles pour le résumé d’erreurs et les aperçus. */
export const CREATE_FIELD_LABELS: Record<string, string> = {
  kind: 'Format',
  title: 'Titre',
  content: 'Texte',
  audience: 'Audience',
  clubId: 'Club',
  location: 'Lieu',
  tags: 'Tags',
  media: 'Médias',
  eventDate: 'Date de l’événement',
  eventDuration: 'Durée',
  eventMax: 'Participants maximum',
  caption: 'Légende',
  replyPolicy: 'Réponses',
  destination: 'Destination',
  startDate: 'Date de début',
  endDate: 'Date de fin',
  description: 'Description',
  visibility: 'Visibilité',
  cover: 'Couverture',
  duration: 'Durée',
  level: 'Niveau',
  maxParticipants: 'Participants maximum',
  name: 'Nom',
  season: 'Saison',
  weightG: 'Poids',
  isPublic: 'Visibilité',
  category: 'Catégorie',
  privacy: 'Adhésion',
  membershipRules: 'Règles d’adhésion',
};
