'use client';

import { createClient } from '@/lib/supabase/client';
import type {
  CarnetFormValuesV2,
  ClubFormValuesV2,
  KitFormValuesV2,
  MediaItemV2,
  PostFormValuesV2,
  SortieFormValuesV2,
  StoryFormValuesV2,
} from './engine/createSchemasV2';
import { SORTIE_LEVEL_TO_DB_V2 } from './engine/createSchemasV2';
import { parseServerError } from './engine/errors';
import type { MediaBucketV2 } from './fields/media';

/**
 * Appels RPC typés du tiroir Création (`handoff/communaute-v2/RPC-CONTRACTS.md`).
 *
 * Règles :
 * - **une écriture multi-tables = une RPC atomique** (jamais d'enchaînement
 *   d'`insert` client) ;
 * - `client_request_id` est envoyé tel quel (idempotence) ;
 * - les erreurs serveur `{code,message,field}` sont converties en
 *   `CreateRpcError` (message FR, champ à surligner) et affichées **une fois**
 *   près du bouton par le moteur ;
 * - les médias sont téléversés avant l'appel ; si la RPC échoue, l'appelant
 *   supprime les objets envoyés.
 */

export class CreateRpcError extends Error {
  code: string | null;
  field: string | null;

  constructor(message: string, code: string | null = null, field: string | null = null) {
    super(message);
    this.name = 'CreateRpcError';
    this.code = code;
    this.field = field;
  }
}

function toRpcError(error: unknown): CreateRpcError {
  const info = parseServerError(error);
  return new CreateRpcError(info.message, info.code, info.field);
}

async function callRpc<T>(name: string, payload: Record<string, unknown>): Promise<T> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(name, { p: payload });
  if (error) throw toRpcError(error);
  if (!data || typeof data !== 'object') {
    throw new CreateRpcError('Réponse du serveur inattendue. Réessaie.');
  }
  return data as T;
}

export interface CreatePostResultV2 {
  id: string;
  audience: string;
  created_at?: string;
  idempotent?: boolean;
}

export interface CreateClubResultV2 {
  id: string;
  slug: string;
  privacy?: string;
  post_id?: string | null;
  members_count?: number;
  idempotent?: boolean;
}

export interface CreateEventResultV2 {
  id: string;
  event_date?: string;
  starts_at?: string;
  status?: string;
  current_participants?: number;
  waitlist_enabled?: boolean;
  post_id?: string | null;
  idempotent?: boolean;
}

export interface CreateKitResultV2 {
  id: string;
  items_count?: number;
  total_weight_g?: number;
  is_public?: boolean;
  post_id?: string | null;
  idempotent?: boolean;
}

export interface CreateCarnetResultV2 {
  id: string;
  visibility?: string;
  moments_count?: number;
  media_count?: number;
  nights_count?: number;
  collaborators_count?: number;
  post_id?: string | null;
  idempotent?: boolean;
}

/** URL du premier média téléversé (aperçu/`image_url`), ou null. */
export function firstMediaUrl(media: readonly MediaItemV2[] | undefined): string | null {
  const first = media?.find((item) => item.status === 'uploaded' && item.url);
  return first?.url ?? null;
}

export function mediaUrls(media: readonly MediaItemV2[] | undefined): string[] {
  return (media ?? []).filter((item) => item.status === 'uploaded' && item.url).map((item) => item.url);
}

export function mediaAlts(media: readonly MediaItemV2[] | undefined): string[] {
  return (media ?? []).map((item) => item.alt.trim());
}

/** Libellés d'activité d'une sortie (`events.activity` est lisible). */
export const SORTIE_ACTIVITY_LABELS: Record<SortieFormValuesV2['activity'], string> = {
  rando: 'Randonnée',
  trail: 'Trail',
  ski: 'Ski de rando',
  velo: 'Vélo',
  escalade: 'Escalade',
  autre: 'Autre',
};

/** Emoji par activité (colonne `events.emoji`, aucune couleur). */
export const SORTIE_ACTIVITY_EMOJI: Record<SortieFormValuesV2['activity'], string> = {
  rando: '🥾',
  trail: '🏃',
  ski: '🎿',
  velo: '🚵',
  escalade: '🧗',
  autre: '🧭',
};

/** Durée lisible d'une sortie (« 2 jours », « 1 journée »). */
export function sortieDurationLabel(startDate: string, endDate: string): string {
  if (!startDate || !endDate || endDate < startDate) return '';
  const start = new Date(`${startDate}T12:00:00`).getTime();
  const end = new Date(`${endDate}T12:00:00`).getTime();
  const days = Math.round((end - start) / 86_400_000) + 1;
  return days > 1 ? `${days} jours` : '1 journée';
}

/** ISO 8601 local (`AAAA-MM-JJ` + `HH:MM`) vers `starts_at`. */
export function toStartsAt(date: string, time: string): string | null {
  if (!date || !time) return null;
  const value = new Date(`${date}T${time}:00`);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

// ---------------------------------------------------------------------------
// Construction des payloads (pures, testées)
// ---------------------------------------------------------------------------

export function buildPostPayload(values: PostFormValuesV2): Record<string, unknown> {
  const title = values.title.trim();
  const content =
    values.format === 'billet' && title ? `${title}\n\n${values.content.trim()}` : values.content.trim();
  const urls = mediaUrls(values.media);
  const payload: Record<string, unknown> = {
    content,
    post_type: values.format === 'question' ? 'question' : 'post',
    audience: values.audience,
    media_urls: urls,
    creation_meta: {
      created_from: 'create_community_post',
      format: values.format,
      title: title || null,
      mentions: values.mentions,
      media_alts: mediaAlts(values.media),
    },
    tags: values.tags,
    client_request_id: values.clientRequestId,
  };
  if (urls[0]) payload.image_url = urls[0];
  if (values.audience === 'club' && values.clubId) payload.club_id = values.clubId;
  if (values.location.trim()) payload.place_label = values.location.trim();
  if (values.locationLat != null && values.locationLng != null) {
    payload.place_lat = values.locationLat;
    payload.place_lng = values.locationLng;
  }
  return payload;
}

export async function createCommunityPostV2(values: PostFormValuesV2): Promise<CreatePostResultV2> {
  return callRpc<CreatePostResultV2>('create_community_post', buildPostPayload(values));
}

/** `post_stories.visibility` n'utilise pas le libellé d'interface « abonnies ». */
export const STORY_VISIBILITY: Record<StoryFormValuesV2['audience'], string> = {
  public: 'public',
  abonnies: 'followers',
  close_friends: 'close_friends',
  only_me: 'only_me',
};

export interface StoryCompositionEntryV2 {
  type: 'text' | 'link' | 'sticker';
  [key: string]: unknown;
}

/**
 * Composition de la story (jsonb `post_stories.composition` v1) : textes
 * déplaçables (position/échelle/rotation en plus du texte, ignorés par les
 * anciens lecteurs), stickers voyage et lien. Le visualiseur historique lit
 * `type: 'text'` et `type: 'link'` : la compatibilité est conservée.
 */
export function buildStoryCompositionV2(values: StoryFormValuesV2): StoryCompositionEntryV2[] | null {
  const entries: StoryCompositionEntryV2[] = [];
  for (const layer of values.textLayers) {
    const text = layer.text.trim().slice(0, 120);
    if (!text) continue;
    entries.push({
      type: 'text',
      text,
      x: Number(layer.x.toFixed(4)),
      y: Number(layer.y.toFixed(4)),
      scale: Number(layer.scale.toFixed(3)),
      rotation: Math.round(layer.rotation),
      style: layer.style,
    });
  }
  const stickers = values.stickers;
  if (stickers.place?.label) {
    entries.push({
      type: 'sticker',
      kind: 'lieu',
      label: stickers.place.label,
      lat: stickers.place.lat,
      lng: stickers.place.lng,
    });
  }
  if (stickers.altitudeM != null) {
    entries.push({ type: 'sticker', kind: 'altitude', value: stickers.altitudeM });
  }
  if (stickers.weatherLabel.trim()) {
    entries.push({ type: 'sticker', kind: 'meteo', label: stickers.weatherLabel.trim() });
  }
  if (stickers.distanceKm != null) {
    entries.push({ type: 'sticker', kind: 'distance', value: stickers.distanceKm });
  }
  if (stickers.link?.url) {
    entries.push({ type: 'link', url: stickers.link.url, label: stickers.link.label.trim() });
  }
  return entries.length > 0 ? entries : null;
}

export async function publishStoryV2(
  values: StoryFormValuesV2,
  userId: string,
): Promise<{ id: string }> {
  const media = values.media[0];
  if (!media || media.status !== 'uploaded' || !media.storagePath) {
    throw new CreateRpcError('Le média n’a pas pu être envoyé. Réessaie ou retire-le.');
  }
  const isVideo = media.type.startsWith('video/');
  const composition = buildStoryCompositionV2(values);
  const supabase = createClient();
  const storyId = crypto.randomUUID();
  const insert = {
    id: storyId,
    author_id: userId,
    image_url: null,
    storage_bucket: media.storageBucket || 'stories-private',
    storage_path: media.storagePath,
    media_type: isVideo ? 'video' : 'image',
    mime_type: media.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
    composition,
    composition_version: composition ? 2 : null,
    status: 'ready',
    client_request_id: crypto.randomUUID(),
    caption: values.caption.trim() ? values.caption.trim().slice(0, 280) : null,
    visibility: STORY_VISIBILITY[values.audience],
    reply_policy: values.replyPolicy,
    allow_reshare: values.allowReshare,
    alt_text: values.altText.trim() || null,
    trim_start_ms: isVideo ? values.trimStartMs ?? 0 : null,
    trim_end_ms: isVideo ? values.trimEndMs ?? media.durationMs ?? null : null,
    linked_carnet_id: values.stickers.carnetId || null,
    // FID-028 : jour du carnet lié (`linked_carnet_day`, migration lot F L22).
    linked_carnet_day: values.stickers.carnetId ? values.stickers.carnetDay ?? null : null,
  };
  const { error } = await supabase.from('post_stories').insert(insert);
  if (error) {
    // L'insert a échoué : le média envoyé ne doit pas rester orphelin.
    try {
      const { deleteMediaObjectsV2 } = await import('./fields/media');
      await deleteMediaObjectsV2([
        { bucket: (media.storageBucket || 'stories-private') as MediaBucketV2, path: media.storagePath },
      ]);
    } catch {
      /* le cron purge-stories nettoiera */
    }
    throw toRpcError(error);
  }
  return { id: storyId };
}

export function buildEventPayload(values: SortieFormValuesV2): Record<string, unknown> {
  const startsAt = toStartsAt(values.date, values.startTime);
  const endsAt = values.endTime ? toStartsAt(values.date, values.endTime) : null;
  const payload: Record<string, unknown> = {
    title: values.title.trim(),
    starts_at: startsAt,
    ends_at: endsAt,
    event_date: values.date || null,
    activity: SORTIE_ACTIVITY_LABELS[values.activity],
    type: values.activity,
    emoji: SORTIE_ACTIVITY_EMOJI[values.activity],
    description: values.description.trim() || null,
    location: values.location.trim(),
    meeting_point: values.meetingPoint.trim() || null,
    /* Repli TS : `events.level` n'accepte que facile/moyen/difficile (CHECK,
       migration 20261108130003 L30). Les 5 niveaux de la maquette restent dans
       l'UI ; on écrit la borne la plus proche jusqu'à la migration dédiée. */
    level: SORTIE_LEVEL_TO_DB_V2[values.level],
    distance_km: values.distanceKm,
    elevation_gain_m: values.elevationGainM,
    max_participants: values.maxParticipants,
    waitlist_enabled: values.waitlist,
    safety_notes: values.safetyNotes.trim() || null,
    safety_checklist: values.safetyChecklist,
    recurrence: values.recurrence || null,
    announce: values.announce,
    client_request_id: values.clientRequestId,
  };
  if (values.meetingLat != null && values.meetingLng != null) {
    payload.meeting_lat = values.meetingLat;
    payload.meeting_lng = values.meetingLng;
  }
  if (values.clubId) payload.club_id = values.clubId;
  if (values.kitId) payload.kit_id = values.kitId;
  const cover = values.cover[0];
  if (cover?.status === 'uploaded' && cover.url) {
    payload.cover_image = cover.url;
    payload.cover_alt = cover.alt.trim() || null;
  }
  return payload;
}

export async function createEventWithPostV2(values: SortieFormValuesV2): Promise<CreateEventResultV2> {
  return callRpc<CreateEventResultV2>('create_event_with_post', buildEventPayload(values));
}

export function buildClubPayload(values: ClubFormValuesV2, slug: string): Record<string, unknown> {
  const activities = values.activities.map((activity) => activity.trim()).filter(Boolean);
  const avatar = values.avatar[0];
  const banner = values.banner[0];
  const payload: Record<string, unknown> = {
    name: values.name.trim(),
    slug: slug || undefined,
    privacy: values.privacy,
    type: 'activite',
    category: activities[0] ?? null,
    activities,
    description: values.description.trim() || null,
    location_label: values.locationLabel.trim() || null,
    rules: values.membershipRules.trim() || null,
    join_questions: values.joinQuestions.map((question) => question.trim()).filter(Boolean),
    welcome_post: values.welcomePost,
    welcome_post_content: values.welcomeContent.trim() || null,
    client_request_id: values.clientRequestId,
  };
  /*
   * Repli TS (migration hors périmètre) : `create_club_with_admin` n'accepte que
   * `cover_image` (migration 20261108130005, L322-327) et `clubs` n'a pas de
   * colonne bannière. On envoie donc l'**avatar carré** — ou la bannière à
   * défaut — dans `cover_image` ; la bannière 3:1 reste locale jusqu'à une
   * migration qui ajoutera `clubs.banner_url` et l'argument `banner_url`.
   */
  const cover = avatar?.status === 'uploaded' && avatar.url ? avatar : banner;
  if (cover?.status === 'uploaded' && cover.url) payload.cover_image = cover.url;
  return payload;
}

export async function createClubWithAdminV2(
  values: ClubFormValuesV2,
  slug: string,
): Promise<CreateClubResultV2> {
  return callRpc<CreateClubResultV2>('create_club_with_admin', buildClubPayload(values, slug));
}

export function buildKitPayload(values: KitFormValuesV2): Record<string, unknown> {
  const totalItems = values.items.reduce((total, item) => total + item.quantity, 0);
  const cover = values.cover[0];
  const payload: Record<string, unknown> = {
    name: values.name.trim(),
    description: values.description.trim() || null,
    season: values.season,
    is_public: values.isPublic,
    tags: [],
    items: values.items.map((item) => ({
      name: item.name.trim(),
      category: item.category || 'Divers',
      weight_g: item.weightG,
      quantity: item.quantity,
      is_checked: item.isChecked,
      product_ownership_id: item.ownershipId,
      product_id: item.productId,
    })),
    share_content: values.isPublic ? `${values.name.trim()} · ${totalItems} objets` : null,
    client_request_id: values.clientRequestId,
  };
  if (cover?.status === 'uploaded' && cover.url) payload.cover_image_url = cover.url;
  return payload;
}

export async function createKitWithItemsV2(values: KitFormValuesV2): Promise<CreateKitResultV2> {
  return callRpc<CreateKitResultV2>('create_kit_with_items', buildKitPayload(values));
}

/** Carte des photos de moments (id → média téléversé) pour la couverture et les médias. */
export function carnetPhotos(values: CarnetFormValuesV2): MediaItemV2[] {
  const photos: MediaItemV2[] = [];
  for (const day of values.days) {
    for (const moment of day.moments) {
      if (moment.photo) photos.push(moment.photo);
    }
  }
  return photos;
}

export function carnetCover(values: CarnetFormValuesV2): MediaItemV2 | null {
  const photos = carnetPhotos(values).filter((photo) => photo.status === 'uploaded' && photo.url);
  if (values.coverMediaId) {
    return photos.find((photo) => photo.id === values.coverMediaId) ?? photos[0] ?? null;
  }
  return photos[0] ?? null;
}

export function buildCarnetPayload(
  values: CarnetFormValuesV2,
  options: { hasCarnetNights: boolean },
): Record<string, unknown> {
  const photos = carnetPhotos(values);
  const cover = carnetCover(values);
  const mapPoints = {
    trace: values.trace,
    days: values.days.map((day) => ({
      label: day.title || `Jour ${day.dayNumber}`,
      date: day.date || null,
      moments: day.moments.length,
    })),
  };
  const moments: Record<string, unknown>[] = [];
  for (const day of values.days) {
    for (const moment of day.moments) {
      moments.push({
        jour_numero: day.dayNumber,
        heure: moment.time || null,
        citation: moment.text.trim() || null,
        auteur_nom: null,
        lieu: moment.place.trim() || null,
        image_url: moment.photo?.status === 'uploaded' ? moment.photo.url : null,
        moment_timestamp: day.date
          ? `${day.date}T${moment.time || '12:00'}:00`
          : moment.time
            ? undefined
            : null,
        source: 'manuel',
        kind: moment.kind,
      });
    }
  }
  const media = photos
    .filter((photo) => photo.status === 'uploaded' && photo.url)
    .map((photo, index) => ({
      url: photo.url,
      type: 'image',
      caption: photo.alt.trim() || null,
      position: index,
    }));
  const payload: Record<string, unknown> = {
    title: values.title.trim(),
    destination: values.destination.trim(),
    description: values.description.trim() || null,
    visibility: values.visibility,
    start_date: values.startDate || null,
    end_date: values.endDate || null,
    cover_image: cover?.url ?? null,
    cover_image_alt: cover?.alt.trim() || null,
    tags: values.tags,
    distance_km: values.distanceKm,
    denivele_m: values.deniveleM,
    nb_nuits: values.days.filter((day) => day.night).length,
    nb_voyageurs: values.nbVoyageurs,
    lieu_depart: values.days[0]?.title || null,
    lieu_arrivee: values.days[values.days.length - 1]?.title || null,
    country_iso: null,
    map_points: mapPoints,
    start_lat: values.trace[0]?.[1] ?? null,
    start_lng: values.trace[0]?.[0] ?? null,
    is_collaborative: values.isCollaborative,
    collaborators: values.collaborators.filter(Boolean),
    moments,
    media,
    nights: options.hasCarnetNights
      ? values.days
          .filter((day) => day.night)
          .map((day) => ({
            jour_numero: day.dayNumber,
            nom: day.night?.name ?? '',
            type: day.night?.type ?? 'autre',
            infos: day.night?.infos?.trim() || null,
          }))
      : [],
    post: {
      enabled: values.postEnabled && values.visibility === 'public',
      content: values.postContent.trim() || null,
    },
    client_request_id: values.clientRequestId,
  };
  return payload;
}

export async function createCarnetV2(
  values: CarnetFormValuesV2,
  options: { hasCarnetNights: boolean },
): Promise<CreateCarnetResultV2> {
  return callRpc<CreateCarnetResultV2>('create_carnet_v2', buildCarnetPayload(values, options));
}

/** Disponibilité d'un slug de club (`Club#5`, lecture seule, ouverte à anon). */
export async function checkClubSlugV2(slug: string): Promise<boolean> {
  if (!slug) return false;
  const supabase = createClient();
  const { data, error } = await supabase.rpc('check_club_slug', { p_slug: slug });
  if (error) throw toRpcError(error);
  return data === true;
}

/** Supprime les objets d'un envoi qui a échoué (aucun orphelin Storage). */
export async function cleanupUploadedMedia(
  objects: readonly { bucket: MediaBucketV2; path: string }[],
): Promise<void> {
  if (objects.length === 0) return;
  const { deleteMediaObjectsV2 } = await import('./fields/media');
  await deleteMediaObjectsV2(objects);
}
