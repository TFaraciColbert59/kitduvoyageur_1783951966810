'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { EventTicket } from '@/features/community/v2/shared/EventTicket';
import type { EventCardVM } from '@/features/community/v2/shared/types';
import { normalizeRouteTrace } from '@/features/community/v2/data/communityFeedMappers';
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
