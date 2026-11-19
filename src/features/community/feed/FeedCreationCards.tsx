'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { EventTicket } from '@/features/community/v2/shared/EventTicket';
import { ClubCrest } from '@/features/community/v2/shared/ClubCrest';
import type { EventCardVM } from '@/features/community/v2/shared/types';
import { activityLabel, normalizeRouteTrace } from '@/features/community/v2/data/communityFeedMappers';
import { KitRectangularPreviewV2 } from '@/features/community/v2/create/forms/KitFormV2';
import type { KitFormValuesV2, KitItemV2 } from '@/features/community/v2/create/engine/createSchemasV2';
import { EngagementBar } from '@/components/social-kit';
import { Check, Download } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import type { FeedPost } from './useCommunityFeed';

type CreationMetaRecord = Record<string, unknown>;

export function isSortiePost(post: FeedPost): boolean {
  const meta = (post.creation_meta ?? null) as CreationMetaRecord | null;
  if (!meta) return false;
  return (
    meta.created_from === 'create_event_with_post' ||
    meta.source === 'event' ||
    typeof meta.event_id === 'string'
  );
}

export function isKitPost(post: FeedPost): boolean {
  if (typeof post.linked_kit_id === 'string' && post.linked_kit_id.length > 0) return true;
  const meta = (post.creation_meta ?? null) as CreationMetaRecord | null;
  return Boolean(meta && meta.created_from === 'create_kit_with_items');
}

export function isCarnetPost(post: FeedPost): boolean {
  const meta = (post.creation_meta ?? null) as CreationMetaRecord | null;
  return Boolean(meta && typeof meta.carnet_id === 'string' && meta.carnet_id.length > 0);
}

export function isClubPost(post: FeedPost): boolean {
  if (isSortiePost(post) || isKitPost(post) || isCarnetPost(post)) return false;
  const meta = (post.creation_meta ?? null) as CreationMetaRecord | null;
  return Boolean(
    meta &&
      (meta.created_from === 'create_club_with_admin' ||
        (typeof meta.club_id === 'string' && meta.club_id.length > 0)),
  );
}

function normalizeSortieLevel(raw: unknown): EventCardVM['level'] {
  const val = String(raw ?? '').toLowerCase().trim();
  if (val === 'tres_facile' || val === 't1') return 'tres_facile';
  if (val === 'facile' || val === 't2') return 'facile';
  if (val === 'difficile' || val === 't4') return 'difficile';
  if (val === 'expert' || val === 't5' || val === 'tres_difficile') return 'expert';
  return 'moyen';
}

function buildFallbackEventVM(post: FeedPost): EventCardVM {
  const meta = (post.creation_meta ?? {}) as CreationMetaRecord;
  const contentTitle = (post.content ?? '').split('·')[0]?.replace(/\*\*/g, '').trim();
  const tracePts = normalizeRouteTrace(
    meta.trace ?? (meta.map_points as { trace?: unknown } | undefined)?.trace,
  );
  return {
    id: typeof meta.event_id === 'string' ? meta.event_id : post.id,
    title:
      (typeof meta.event_title === 'string' && meta.event_title.trim()) ||
      (typeof post.title === 'string' && post.title.trim()) ||
      contentTitle ||
      'Sortie communautaire',
    activity: 'rando',
    startsAt: typeof meta.starts_at === 'string' ? meta.starts_at : post.created_at ?? null,
    endsAt: null,
    eventDate: typeof meta.event_date === 'string' ? meta.event_date : null,
    location:
      (typeof meta.location === 'string' && meta.location.trim()) ||
      (typeof post.location === 'string' && post.location.trim()) ||
      'En montagne',
    meetingPoint: null,
    level: 'moyen',
    distanceKm: null,
    elevationGainM: null,
    duration: null,
    coverImage: post.image_url ?? null,
    coverAlt: post.image_alt ?? null,
    maxParticipants: 10,
    currentParticipants: 1,
    spotsLeft: 9,
    waitlistEnabled: false,
    myStatus: null,
    organizer: {
      id: post.author_id ?? 'org',
      name: post.author?.full_name ?? 'Organisateur',
      initials: (post.author?.full_name ?? 'O').charAt(0).toUpperCase(),
      avatarUrl: post.author?.avatar_url ?? null,
    },
    participants: [],
    participantsTotal: 1,
    clubId: post.club_id ?? null,
    clubName: null,
    kitId: null,
    description: null,
    safetyNotes: null,
    safetyChecklist: [],
    recurrence: null,
    past: false,
    distanceKmFromMe: null,
    routeTrace: tracePts,
  };
}

export function FeedSortiePostCard({
  post,
  likesCount,
  commentsCount,
  sharesCount,
  liked,
  showEngagement,
  onLike,
  onComment,
  onShare,
}: {
  post: FeedPost;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  liked: boolean;
  showEngagement: boolean;
  onLike?: () => void;
  onComment?: () => void;
  onShare: () => void;
}) {
  const router = useRouter();
  const meta = (post.creation_meta ?? {}) as CreationMetaRecord;
  const eventId = typeof meta.event_id === 'string' ? meta.event_id : null;
  const [eventVM, setEventVM] = useState<EventCardVM>(() => buildFallbackEventVM(post));

  useEffect(() => {
    if (!eventId) return;
    let alive = true;
    try {
      const supabase = createClient();
      void supabase
        .from('events')
        .select(
          'id, title, activity, type, starts_at, ends_at, event_date, location, meeting_point, level, distance_km, elevation_gain_m, duration, cover_image, cover_alt, max_participants, current_participants, waitlist_enabled',
        )
        .eq('id', eventId)
        .maybeSingle()
        .then(({ data }) => {
          if (!alive || !data) return;
          const row = data as Record<string, unknown>;
          const maxP = Number(row.max_participants ?? 10) || 10;
          const curP = Number(row.current_participants ?? 1) || 1;
          setEventVM((prev) => ({
            ...prev,
            id: String(row.id ?? prev.id),
            title: String(row.title ?? prev.title),
            activity: String(row.type ?? row.activity ?? prev.activity),
            startsAt: (row.starts_at as string | null) ?? prev.startsAt,
            endsAt: (row.ends_at as string | null) ?? prev.endsAt,
            eventDate: (row.event_date as string | null) ?? prev.eventDate,
            location: String(row.location ?? prev.location),
            meetingPoint: (row.meeting_point as string | null) ?? prev.meetingPoint,
            level: normalizeSortieLevel(row.level),
            distanceKm: typeof row.distance_km === 'number' ? row.distance_km : prev.distanceKm,
            elevationGainM:
              typeof row.elevation_gain_m === 'number' ? row.elevation_gain_m : prev.elevationGainM,
            duration: (row.duration as string | null) ?? prev.duration,
            coverImage: (row.cover_image as string | null) ?? prev.coverImage,
            coverAlt: (row.cover_alt as string | null) ?? prev.coverAlt,
            maxParticipants: maxP,
            currentParticipants: curP,
            spotsLeft: Math.max(0, maxP - curP),
            waitlistEnabled: Boolean(row.waitlist_enabled),
          }));
        });
    } catch {
      /* fallback déjà en place */
    }
    return () => {
      alive = false;
    };
  }, [eventId]);

  const openSortie = () => {
    const targetId = eventVM.id;
    router.push(`/sorties/${encodeURIComponent(targetId)}`);
  };

  return (
    <div className="lkdv-feed-creation-card lkdv-feed-creation-card--sortie" data-testid="feed-sortie-card">
      <EventTicket
        event={eventVM}
        variant="tile"
        showCapacity={false}
        onOpen={openSortie}
        href={`/sorties/${encodeURIComponent(eventVM.id)}`}
      />
      {showEngagement ? (
        <div className="lkdv-feed-sortie-engage">
          <EngagementBar
            tone="ink"
            likesCount={likesCount}
            commentsCount={commentsCount}
            sharesCount={sharesCount}
            liked={liked}
            onLike={onLike ?? (() => undefined)}
            onComment={onComment ?? (() => undefined)}
            onShare={onShare}
          />
        </div>
      ) : null}
    </div>
  );
}

export function FeedKitPostCard({
  post,
  userId,
  likesCount,
  commentsCount,
  sharesCount,
  liked,
  showEngagement,
  onLike,
  onComment,
  onShare,
}: {
  post: FeedPost;
  userId?: string | null;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  liked: boolean;
  showEngagement: boolean;
  onLike?: () => void;
  onComment?: () => void;
  onShare: () => void;
}) {
  const { toast } = useToast();
  const meta = (post.creation_meta ?? {}) as CreationMetaRecord;
  const kitId =
    (typeof post.linked_kit_id === 'string' && post.linked_kit_id) ||
    (typeof meta.kit_id === 'string' ? meta.kit_id : null);
  const fallbackName =
    (typeof meta.kit_name === 'string' && meta.kit_name.trim()) ||
    (post.content ?? '').split('·')[0]?.replace(/Mon kit|[«»]/g, '').trim() ||
    'Kit d’aventure';

  const [kitValues, setKitValues] = useState<Pick<KitFormValuesV2, 'name' | 'model' | 'season' | 'seasons' | 'goal'>>({
    name: fallbackName,
    model: 'bivouac',
    season: 'toute_saison',
    seasons: [],
    goal: 'leger',
  });
  const [kitItems, setKitItems] = useState<KitItemV2[]>([]);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);

  useEffect(() => {
    if (!kitId) return;
    let alive = true;
    try {
      const supabase = createClient();
      void Promise.all([
        supabase
          .from('materiel_kits')
          .select('id, name, season')
          .eq('id', kitId)
          .maybeSingle(),
        supabase
          .from('materiel_kit_items')
          .select('id, name, category, weight_g, quantity, is_checked')
          .eq('kit_id', kitId)
          .limit(30),
      ]).then(([kitRes, itemsRes]) => {
        if (!alive) return;
        const kitRow = kitRes.data as Record<string, unknown> | null;
        if (kitRow) {
          setKitValues((prev) => ({
            ...prev,
            name: String(kitRow.name ?? prev.name),
            season: (String(kitRow.season ?? 'toute_saison') as KitFormValuesV2['season']),
          }));
        }
        const rows = (itemsRes.data ?? []) as Array<Record<string, unknown>>;
        if (rows.length > 0) {
          setKitItems(
            rows.map((r, i) => ({
              id: String(r.id ?? `item-${i}`),
              name: String(r.name ?? 'Objet'),
              category: String(r.category ?? 'Divers'),
              weightG: Number(r.weight_g ?? 0) || 0,
              quantity: Math.max(1, Number(r.quantity ?? 1) || 1),
              isChecked: Boolean(r.is_checked ?? true),
              layer: 'sac',
              ownershipId: null,
              productId: null,
            })),
          );
        }
      });
    } catch {
      /* fallback déjà en place */
    }
    return () => {
      alive = false;
    };
  }, [kitId]);

  const handleForkKit = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!kitId || importing || imported) return;
    if (!userId) {
      toast('Connectez-vous pour importer un kit.', 'info');
      return;
    }
    setImporting(true);
    try {
      const res = await fetch('/api/materiel/fork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kit_id: kitId }),
      });
      if (!res.ok) throw new Error('Import impossible');
      setImported(true);
      toast('Kit importé dans votre matériel.', 'success');
    } catch {
      toast('Import du kit impossible.', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="lkdv-feed-creation-card" data-testid="feed-kit-card">
      <KitRectangularPreviewV2 items={kitItems} values={kitValues} />
      {showEngagement ? (
        <div className="lkdv-feed-creation-actions">
          {kitId ? (
            <button
              type="button"
              className="lkdv-feed-kit-import-pill"
              onClick={(e) => void handleForkKit(e)}
              disabled={importing || imported}
              aria-label="Importer ce kit dans mon matériel"
            >
              {imported ? <Check size={13} aria-hidden="true" /> : <Download size={13} aria-hidden="true" />}
              <span>{imported ? 'Importé' : importing ? 'Import…' : 'Importer'}</span>
            </button>
          ) : null}
          <EngagementBar
            tone="ink"
            likesCount={likesCount}
            commentsCount={commentsCount}
            sharesCount={sharesCount}
            liked={liked}
            onLike={onLike ?? (() => undefined)}
            onComment={onComment ?? (() => undefined)}
            onShare={onShare}
          />
        </div>
      ) : null}
    </div>
  );
}

export function FeedCarnetPostCard({
  post,
  likesCount,
  commentsCount,
  sharesCount,
  liked,
  showEngagement,
  onLike,
  onComment,
  onShare,
}: {
  post: FeedPost;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  liked: boolean;
  showEngagement: boolean;
  onLike?: () => void;
  onComment?: () => void;
  onShare: () => void;
}) {
  const meta = (post.creation_meta ?? {}) as CreationMetaRecord;
  const carnetId = typeof meta.carnet_id === 'string' ? meta.carnet_id : '';
  const [carnet, setCarnet] = useState<{
    title: string;
    destination: string | null;
    days: number;
    distanceKm: number | null;
    elevationGainM: number | null;
    coverImage: string | null;
  }>(() => ({
    title:
      (typeof meta.carnet_title === 'string' && meta.carnet_title.trim()) ||
      (post.content ?? '').split('·')[0]?.trim() ||
      'Carnet de voyage',
    destination:
      typeof meta.carnet_destination === 'string' && meta.carnet_destination.trim()
        ? meta.carnet_destination.trim()
        : null,
    days: Number(meta.carnet_days ?? 1) || 1,
    distanceKm: null,
    elevationGainM: null,
    coverImage:
      (typeof meta.carnet_cover === 'string' && meta.carnet_cover) || post.image_url || null,
  }));

  useEffect(() => {
    if (!carnetId) return;
    let alive = true;
    try {
      const supabase = createClient();
      void supabase
        .from('carnets')
        .select('title, destination, days_count, distance_km, elevation_gain_m, cover_image')
        .eq('id', carnetId)
        .maybeSingle()
        .then(({ data }) => {
          if (!alive || !data) return;
          const row = data as Record<string, unknown>;
          setCarnet((prev) => ({
            title: String(row.title ?? prev.title),
            destination: typeof row.destination === 'string' ? row.destination : prev.destination,
            days: Number(row.days_count ?? prev.days) || prev.days,
            distanceKm: row.distance_km != null ? Number(row.distance_km) : prev.distanceKm,
            elevationGainM:
              row.elevation_gain_m != null ? Number(row.elevation_gain_m) : prev.elevationGainM,
            coverImage:
              typeof row.cover_image === 'string' && row.cover_image
                ? row.cover_image
                : prev.coverImage,
          }));
        });
    } catch {
      /* fallback déjà en place */
    }
    return () => {
      alive = false;
    };
  }, [carnetId]);

  return (
    <div className="lkdv-feed-creation-card" data-testid="feed-carnet-card">
      <article
        className={`lkdv-carnet-card lkdv-cv2c-carnet-ig-editor lkdv-cv2x-carnet-ig-tile${carnet.coverImage ? ' has-cover-bg' : ''}`}
      >
        {carnet.coverImage ? (
          <span className="lkdv-cv2x-carnet-bg" aria-hidden="true">
            <AppImage
              src={carnet.coverImage}
              alt=""
              fill
              sizes="400px"
              className="lkdv-cv2x-carnet-bg-img"
            />
            <span className="lkdv-cv2x-carnet-bg-scrim" />
          </span>
        ) : null}
        <Link
          className="lkdv-carnet-card-scroll lkdv-cv2x-tile-link"
          href={carnetId ? `/carnets/${carnetId}` : '/communaute'}
        >
          <div className="lkdv-ig-header">
            <div className="lkdv-ig-avi-wrap">
              <span className="lkdv-ig-avi">
                {carnet.coverImage ? (
                  <AppImage
                    src={carnet.coverImage}
                    alt=""
                    fill
                    sizes="66px"
                    className="lkdv-cv2x-cover-img"
                  />
                ) : (
                  <span className="lkdv-cv2c-ig-avi-initials">
                    {carnet.title.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </span>
            </div>
            <div className="lkdv-ig-stats" role="group" aria-label="Statistiques du carnet">
              <div className="lkdv-ig-stat">
                <b>{carnet.days}</b>
                <span>{carnet.days > 1 ? 'jours' : 'jour'}</span>
              </div>
              <div className="lkdv-ig-stat">
                <b>{carnet.distanceKm != null ? Math.round(carnet.distanceKm) : '—'}</b>
                <span>km</span>
              </div>
              <div className="lkdv-ig-stat">
                <b>{carnet.elevationGainM != null ? `+${Math.round(carnet.elevationGainM)}` : '—'}</b>
                <span>D+ m</span>
              </div>
            </div>
          </div>
          <div className="lkdv-ig-bio">
            <span className="lkdv-ig-name lkdv-cv2x-carnet-title">{carnet.title}</span>
            {carnet.destination ? (
              <span className="lkdv-ig-handle-sub lkdv-cv2-meta">{carnet.destination}</span>
            ) : null}
          </div>
        </Link>
      </article>
      {showEngagement ? (
        <div className="lkdv-feed-creation-actions">
          <EngagementBar
            tone="ink"
            likesCount={likesCount}
            commentsCount={commentsCount}
            sharesCount={sharesCount}
            liked={liked}
            onLike={onLike ?? (() => undefined)}
            onComment={onComment ?? (() => undefined)}
            onShare={onShare}
          />
        </div>
      ) : null}
    </div>
  );
}

export function FeedClubPostCard({
  post,
  likesCount,
  commentsCount,
  sharesCount,
  liked,
  showEngagement,
  onLike,
  onComment,
  onShare,
}: {
  post: FeedPost;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  liked: boolean;
  showEngagement: boolean;
  onLike?: () => void;
  onComment?: () => void;
  onShare: () => void;
}) {
  const meta = (post.creation_meta ?? {}) as CreationMetaRecord;
  const clubId =
    (typeof meta.club_id === 'string' && meta.club_id) ||
    (typeof post.club_id === 'string' && post.club_id) ||
    '';
  const [club, setClub] = useState<{
    slug: string;
    name: string;
    category: string;
    zoneLabel: string | null;
    privacy: 'open' | 'closed';
    membersCount: number;
    eventsCount: number;
    coverImage: string | null;
  }>(() => ({
    slug: typeof meta.club_slug === 'string' ? meta.club_slug : clubId,
    name:
      (typeof meta.club_name === 'string' && meta.club_name.trim()) ||
      (post.content ?? '').split('·')[0]?.trim() ||
      'Club',
    category: typeof meta.club_category === 'string' ? meta.club_category : 'rando',
    zoneLabel:
      typeof meta.club_zone === 'string' && meta.club_zone.trim() ? meta.club_zone.trim() : null,
    privacy: meta.club_privacy === 'closed' ? 'closed' : 'open',
    membersCount: 1,
    eventsCount: 0,
    coverImage:
      (typeof meta.club_cover === 'string' && meta.club_cover) || post.image_url || null,
  }));

  useEffect(() => {
    if (!clubId) return;
    let alive = true;
    try {
      const supabase = createClient();
      void supabase
        .from('clubs')
        .select('slug, name, category, zone_label, privacy, members_count, cover_image')
        .eq('id', clubId)
        .maybeSingle()
        .then(({ data }) => {
          if (!alive || !data) return;
          const row = data as Record<string, unknown>;
          setClub((prev) => ({
            slug: String(row.slug ?? prev.slug),
            name: String(row.name ?? prev.name),
            category: String(row.category ?? prev.category),
            zoneLabel: typeof row.zone_label === 'string' ? row.zone_label : prev.zoneLabel,
            privacy: row.privacy === 'closed' ? 'closed' : 'open',
            membersCount: Number(row.members_count ?? prev.membersCount) || 1,
            eventsCount: prev.eventsCount,
            coverImage:
              typeof row.cover_image === 'string' && row.cover_image
                ? row.cover_image
                : prev.coverImage,
          }));
        });
    } catch {
      /* fallback déjà en place */
    }
    return () => {
      alive = false;
    };
  }, [clubId]);

  const metaLine = [activityLabel(club.category), club.zoneLabel].filter(Boolean).join(' · ');

  return (
    <div className="lkdv-feed-creation-card" data-testid="feed-club-card">
      <article
        className={`lkdv-carnet-card lkdv-cv2c-carnet-ig-editor lkdv-cv2x-carnet-ig-tile lkdv-cv2x-club-ig-tile${club.coverImage ? ' has-cover-bg' : ''}`}
      >
        {club.coverImage ? (
          <span className="lkdv-cv2x-carnet-bg" aria-hidden="true">
            <AppImage
              src={club.coverImage}
              alt=""
              fill
              sizes="400px"
              className="lkdv-cv2x-carnet-bg-img"
            />
            <span className="lkdv-cv2x-carnet-bg-scrim" />
          </span>
        ) : null}
        <Link
          className="lkdv-carnet-card-scroll lkdv-cv2x-tile-link"
          href={club.slug ? `/clubs/${club.slug}` : '/communaute'}
        >
          <div className="lkdv-ig-header">
            <div className="lkdv-ig-avi-wrap">
              <span className="lkdv-ig-avi">
                {club.coverImage ? (
                  <AppImage
                    src={club.coverImage}
                    alt=""
                    fill
                    sizes="66px"
                    className="lkdv-cv2x-cover-img"
                  />
                ) : (
                  <ClubCrest name={club.name} activity={club.category} seed={clubId || club.name} size={62} />
                )}
              </span>
            </div>
            <div className="lkdv-ig-stats" role="group" aria-label="Statistiques du club">
              <div className="lkdv-ig-stat">
                <b>{club.membersCount}</b>
                <span>{club.membersCount > 1 ? 'membres' : 'membre'}</span>
              </div>
              <div className="lkdv-ig-stat">
                <b>{club.eventsCount}</b>
                <span>{club.eventsCount > 1 ? 'sorties' : 'sortie'}</span>
              </div>
              <div className="lkdv-ig-stat">
                <b>{club.privacy === 'closed' ? 'Privé' : 'Ouvert'}</b>
                <span>accès</span>
              </div>
            </div>
          </div>
          <div className="lkdv-ig-bio">
            <span className="lkdv-ig-name lkdv-cv2x-carnet-title">{club.name}</span>
            {metaLine ? <span className="lkdv-ig-handle-sub lkdv-cv2-meta">{metaLine}</span> : null}
          </div>
        </Link>
      </article>
      {showEngagement ? (
        <div className="lkdv-feed-creation-actions">
          <EngagementBar
            tone="ink"
            likesCount={likesCount}
            commentsCount={commentsCount}
            sharesCount={sharesCount}
            liked={liked}
            onLike={onLike ?? (() => undefined)}
            onComment={onComment ?? (() => undefined)}
            onShare={onShare}
          />
        </div>
      ) : null}
    </div>
  );
}
