'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  BookOpen,
  Calendar,
  Check,
  Compass,
  Flag,
  Heart,
  Lock,
  MapPin,
  MessageCircle,
  Plus,
  Radar,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import type { SlotLens } from '@/components/compte/drawer/SlotShell';
import {
  CarnetHorizontalTimeline,
  type HorizontalTimelineDayGroup,
} from '@/components/carnet/v2/CarnetHorizontalTimeline';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import type { GeoJsonFeatureCollection } from '@/lib/explorer/edgeCache';

export const COMMUNITY_CATEGORY_LENSES: SlotLens[] = [
  { id: 'bottles', label: 'Bouteille à la mer', icon: <Send size={15} /> },
  { id: 'carnets', label: 'Carnets', icon: <BookOpen size={15} /> },
  { id: 'clubs', label: 'Clubs & Sorties', icon: <Flag size={15} /> },
  { id: 'stories', label: 'Stories & Amis', icon: <Sparkles size={15} /> },
];

export interface ExplorerBottleItem {
  id: string;
  name: string;
  description?: string | null;
  countryIso?: string | null;
  departureDate?: string | null;
  returnDate?: string | null;
  maxMembers: number;
  activeMembersCount: number;
  spotsLeft: number;
  minTrustScore: number;
  mixite?: string | null;
  ownerId?: string | null;
  coordinates?: [number, number] | null;
  ownerName?: string | null;
  ownerAvatarUrl?: string | null;
  ownerTrustScore?: number | null;
  destination?: string | null;
  inArea?: boolean;
  hasExactCoords?: boolean;
}

export interface ExplorerCarnetItem {
  id: string;
  title: string;
  destination?: string | null;
  coverImage?: string | null;
  nbNuits?: number | null;
  likesCount?: number | null;
  countryIso?: string | null;
  startDate?: string | null;
  coordinates?: [number, number] | null;
  inArea?: boolean;
  hasExactCoords?: boolean;
}

export interface ExplorerClubItem {
  id: string;
  slug: string;
  name: string;
  category?: string | null;
  emoji?: string | null;
  coverImage?: string | null;
  membersCount?: number | null;
  locationLabel?: string | null;
  isVerified?: boolean;
  coordinates?: [number, number] | null;
  inArea?: boolean;
  hasExactCoords?: boolean;
}

export interface ExplorerClubEventItem {
  id: string;
  clubId?: string | null;
  title: string;
  location?: string | null;
  startsAt?: string | null;
  surfaceType?: string | null;
  coordinates?: [number, number] | null;
}

export interface ExplorerStoryItem {
  id: string;
  caption?: string | null;
  mediaType?: string | null;
  imageUrl?: string | null;
  createdAt?: string | null;
  coordinates?: [number, number] | null;
  inArea?: boolean;
  hasExactCoords?: boolean;
}

export interface ExplorerFriendItem {
  id: string;
  name: string;
  handle?: string | null;
  avatarUrl?: string | null;
  fuzzyRadiusM?: number | null;
  coordinates?: [number, number] | null;
}

export type FocusCoordinatesHandler = (
  coordinates: [number, number] | null | undefined,
  label?: string,
) => void;

const MIN_TRUST_FLOOR = 50;
const RELATIVE_STORY_MEDIA_RE = /^\/api\/stories\/[A-Za-z0-9_-]+\/media$/;

function safeHttpsUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Allow safe internal app image/API routes alongside HTTPS URLs
  if (/^\/(api\/|images\/|assets\/|uploads\/|storage\/)[^\s"'<>]+$/.test(trimmed)) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function safeStoryImageUrl(raw: unknown): string | null {
  const https = safeHttpsUrl(raw);
  if (https) return https;
  if (typeof raw === 'string' && RELATIVE_STORY_MEDIA_RE.test(raw.trim())) {
    return raw.trim();
  }
  return null;
}

function readSuspensionFlag(profile: unknown): boolean {
  if (!profile || typeof profile !== 'object') return false;
  const rec = profile as Record<string, unknown>;
  return Boolean(rec.is_suspended_groups) || Boolean(rec.suspended_from_groups_at);
}

function formatShortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function hasExplicitTime(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return /T\d{2}:\d{2}/.test(iso) || /\s\d{2}:\d{2}/.test(iso);
}

function formatTimeLabel(iso: string | null | undefined): string {
  if (!iso) return 'À venir';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'À venir';
  if (!hasExplicitTime(iso)) {
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
  return d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDayLabel(iso: string | null | undefined): string {
  if (!iso) return 'Prochainement';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Prochainement';
  return d.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatSortieDateTimeFr(iso: string | null | undefined): string {
  if (!iso) return 'Date à confirmer';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Date à confirmer';
  const day = d.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  if (!hasExplicitTime(iso)) return day;
  const time = d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${day} · ${time}`;
}

function mixiteBadgeLabel(mixite: string | null | undefined): string | null {
  if (mixite === 'women_only') return 'Femmes';
  if (mixite === 'men_only') return 'Hommes';
  return null;
}

function readCoords(geom: unknown): [number, number] | null {
  if (!geom || typeof geom !== 'object') return null;
  const g = geom as { type?: unknown; coordinates?: unknown };
  if (g.type === 'Point' && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
    const lng = Number(g.coordinates[0]);
    const lat = Number(g.coordinates[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      return [lng, lat];
    }
  }
  return null;
}

export function extractCarnetsFromGeoJson(
  fc: GeoJsonFeatureCollection | null | undefined,
): ExplorerCarnetItem[] {
  if (!fc?.features?.length) return [];
  return fc.features.map((f, idx) => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    return {
      id: String(p.id ?? f.id ?? `carnet-${idx}`),
      title: String(p.title ?? 'Carnet de voyage'),
      destination: typeof p.destination === 'string' ? p.destination : null,
      coverImage: safeHttpsUrl(p.coverImage),
      nbNuits: typeof p.nbNuits === 'number' ? p.nbNuits : null,
      likesCount: typeof p.likesCount === 'number' ? p.likesCount : 0,
      countryIso: typeof p.countryIso === 'string' ? p.countryIso : null,
      startDate: typeof p.startDate === 'string' ? p.startDate : null,
      coordinates: p.hasExactCoords === false ? null : readCoords(f.geometry),
      inArea: typeof p.inArea === 'boolean' ? p.inArea : true,
      hasExactCoords: typeof p.hasExactCoords === 'boolean' ? p.hasExactCoords : true,
    };
  });
}

export function extractClubsFromGeoJson(
  fc: GeoJsonFeatureCollection | null | undefined,
): ExplorerClubItem[] {
  if (!fc?.features?.length) return [];
  return fc.features.map((f, idx) => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const id = String(p.id ?? f.id ?? `club-${idx}`);
    return {
      id,
      slug: String(p.slug ?? id),
      name: String(p.name ?? 'Club'),
      category: typeof p.category === 'string' ? p.category : null,
      emoji: typeof p.emoji === 'string' ? p.emoji : null,
      coverImage: safeHttpsUrl(p.coverImage),
      membersCount: typeof p.membersCount === 'number' ? p.membersCount : null,
      locationLabel: typeof p.locationLabel === 'string' ? p.locationLabel : null,
      isVerified: Boolean(p.isVerified),
      coordinates: p.hasExactCoords === false ? null : readCoords(f.geometry),
      inArea: typeof p.inArea === 'boolean' ? p.inArea : true,
      hasExactCoords: typeof p.hasExactCoords === 'boolean' ? p.hasExactCoords : true,
    };
  });
}

export function extractEventsFromGeoJson(
  fc: GeoJsonFeatureCollection | null | undefined,
): ExplorerClubEventItem[] {
  if (!fc?.features?.length) return [];
  return fc.features.map((f, idx) => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    return {
      id: String(p.id ?? f.id ?? `event-${idx}`),
      clubId: typeof p.clubId === 'string' ? p.clubId : null,
      title: String(p.title ?? 'Sortie club'),
      location: typeof p.location === 'string' ? p.location : null,
      startsAt: typeof p.startsAt === 'string' ? p.startsAt : null,
      surfaceType: typeof p.surfaceType === 'string' ? p.surfaceType : null,
      coordinates: readCoords(f.geometry),
    };
  });
}

export function extractStoriesFromGeoJson(
  fc: GeoJsonFeatureCollection | null | undefined,
): ExplorerStoryItem[] {
  if (!fc?.features?.length) return [];
  return fc.features.map((f, idx) => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    return {
      id: String(p.id ?? f.id ?? `story-${idx}`),
      caption: typeof p.caption === 'string' ? p.caption : null,
      mediaType: typeof p.mediaType === 'string' ? p.mediaType : 'image',
      imageUrl: safeStoryImageUrl(p.imageUrl),
      createdAt: typeof p.createdAt === 'string' ? p.createdAt : null,
      coordinates: p.hasExactCoords === false ? null : readCoords(f.geometry),
      inArea: typeof p.inArea === 'boolean' ? p.inArea : true,
      hasExactCoords: typeof p.hasExactCoords === 'boolean' ? p.hasExactCoords : true,
    };
  });
}

export function extractFriendsFromGeoJson(
  fc: GeoJsonFeatureCollection | null | undefined,
): ExplorerFriendItem[] {
  if (!fc?.features?.length) return [];
  return fc.features.map((f, idx) => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    return {
      id: String(p.id ?? f.id ?? `friend-${idx}`),
      name: String(p.name ?? 'Explorateur'),
      handle: typeof p.handle === 'string' ? p.handle : null,
      avatarUrl: safeHttpsUrl(p.avatarUrl),
      fuzzyRadiusM: typeof p.fuzzyRadiusM === 'number' ? p.fuzzyRadiusM : 250,
      coordinates: readCoords(f.geometry),
    };
  });
}

function LensEmptyTile({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div
      className="club-glass-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 8,
        padding: '22px 14px',
        color: '#56665D',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'rgba(23, 64, 44, 0.08)',
          color: '#17402C',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {icon}
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 5.0 — Bouteille à la mer                                                   */
/* -------------------------------------------------------------------------- */

export interface CommunityBottlesLensProps {
  bottles: ExplorerBottleItem[];
  loading?: boolean;
  selectedBottleId?: string | null;
  onFocusCoordinates?: FocusCoordinatesHandler;
  onJoined?: (bottleId: string) => void;
}

export function CommunityBottlesLens({
  bottles,
  loading = false,
  selectedBottleId = null,
  onFocusCoordinates,
  onJoined,
}: CommunityBottlesLensProps) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const [blockedIds, setBlockedIds] = useState<Set<string>>(() => new Set());
  const [requestedIds, setRequestedIds] = useState<Set<string>>(() => new Set());
  const [activeMemberIds, setActiveMemberIds] = useState<Set<string>>(() => new Set());
  const [confirmBottle, setConfirmBottle] = useState<ExplorerBottleItem | null>(null);
  const [confirmAdult, setConfirmAdult] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const userTrustScore =
    typeof profile?.trust_score === 'number' && Number.isFinite(profile.trust_score)
      ? Math.round(profile.trust_score)
      : 50;
  const isSuspended = readSuspensionFlag(profile);

  const bottleIdsKey = useMemo(() => bottles.map((b) => b.id).join(','), [bottles]);

  useEffect(() => {
    if (!user) {
      setBlockedIds(new Set());
      setRequestedIds(new Set());
      setActiveMemberIds(new Set());
      return;
    }

    let cancelled = false;

    const loadUserRelations = async () => {
      try {
        const [{ data: blockRows }, membershipsRes] = await Promise.all([
          supabase
            .from('user_blocks')
            .select('blocker_id, blocked_id')
            .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`)
            .limit(300),
          bottleIdsKey
            ? supabase
                .from('group_members')
                .select('group_id, status')
                .eq('user_id', user.id)
                .in('group_id', bottleIdsKey.split(','))
            : Promise.resolve({ data: [] as Array<{ group_id: string; status: string }> }),
        ]);

        if (cancelled) return;

        const nextBlocked = new Set<string>();
        for (const row of blockRows ?? []) {
          if (row.blocker_id && row.blocker_id !== user.id) nextBlocked.add(String(row.blocker_id));
          if (row.blocked_id && row.blocked_id !== user.id) nextBlocked.add(String(row.blocked_id));
        }
        setBlockedIds(nextBlocked);

        const nextPending = new Set<string>();
        const nextActive = new Set<string>();
        for (const row of membershipsRes.data ?? []) {
          const gid = String(row.group_id ?? '');
          if (!gid) continue;
          if (row.status === 'active') nextActive.add(gid);
          else if (row.status === 'pending') nextPending.add(gid);
        }
        setRequestedIds(nextPending);
        setActiveMemberIds(nextActive);
      } catch {
        // Keep current state cleanly without breaking the card list
      }
    };

    void loadUserRelations();
    return () => {
      cancelled = true;
    };
  }, [user, supabase, bottleIdsKey]);

  useEffect(() => {
    if (!confirmBottle) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConfirmBottle(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmBottle]);

  const visibleBottles = useMemo(
    () => bottles.filter((b) => !b.ownerId || !blockedIds.has(b.ownerId)),
    [bottles, blockedIds],
  );

  const handleConfirmJoin = async () => {
    if (!user || !confirmBottle || !confirmAdult || isSuspended || joiningId) return;
    const bottle = confirmBottle;
    const requiredTrust = Math.max(MIN_TRUST_FLOOR, bottle.minTrustScore || MIN_TRUST_FLOOR);
    if (userTrustScore < requiredTrust) {
      setJoinError(`Trust Score insuffisant (${userTrustScore}/${requiredTrust} requis).`);
      return;
    }

    setJoiningId(bottle.id);
    setJoinError(null);

    try {
      await supabase
        .from('user_profiles')
        .update({ age_confirmed_at: new Date().toISOString() })
        .eq('id', user.id);

      const { error } = await supabase.from('group_members').insert({
        group_id: bottle.id,
        user_id: user.id,
        role: 'member',
        status: 'pending',
      });

      if (error && error.code !== '23505') {
        throw error;
      }

      if (!error && bottle.ownerId && bottle.ownerId !== user.id) {
        await supabase.from('notifications').insert({
          user_id: bottle.ownerId,
          actor_id: user.id,
          related_type: 'travel_group',
          related_id: bottle.id,
          type: 'group_join_request',
          title: 'Nouvelle demande Bouteille à la mer',
          message: `${profile?.full_name || 'Un voyageur'} souhaite rejoindre "${bottle.name}".`,
          link: `/hub/groupe?groupId=${encodeURIComponent(bottle.id)}`,
        });
      }

      setRequestedIds((prev) => {
        const next = new Set(prev);
        next.add(bottle.id);
        return next;
      });
      setConfirmBottle(null);
      setConfirmAdult(false);
      onJoined?.(bottle.id);
    } catch (err) {
      setJoinError(
        err instanceof Error && err.message
          ? err.message
          : 'Impossible d’envoyer votre demande.',
      );
    } finally {
      setJoiningId(null);
    }
  };

  if (loading && visibleBottles.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 88 }}>
        {[0, 1].map((i) => (
          <div
            key={i}
            className="club-glass-card xp20-shimmer"
            style={{ height: 112 }}
            aria-busy="true"
          />
        ))}
      </div>
    );
  }

  if (visibleBottles.length === 0) {
    return (
      <div style={{ paddingBottom: 88 }}>
        <LensEmptyTile
          icon={<Send size={16} />}
          label="Aucune bouteille dans cette zone"
        />
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 88 }}>
        {visibleBottles.map((bottle) => {
          const isHighlighted = selectedBottleId === bottle.id;
          const isOwner = Boolean(user && bottle.ownerId && bottle.ownerId === user.id);
          const isRequested = requestedIds.has(bottle.id);
          const isActive = activeMemberIds.has(bottle.id);
          const requiredTrust = Math.max(MIN_TRUST_FLOOR, bottle.minTrustScore || MIN_TRUST_FLOOR);
          const hasTrust = !user || userTrustScore >= requiredTrust;
          const maxMembers = Math.max(2, bottle.maxMembers || 6);
          const activeCount = Math.max(0, Math.min(maxMembers, bottle.activeMembersCount || 0));
          const spotsLeft = Math.max(0, bottle.spotsLeft);
          const fillPct = Math.min(100, Math.round((activeCount / maxMembers) * 100));
          const dateLabel = formatShortDate(bottle.departureDate);
          const returnLabel = formatShortDate(bottle.returnDate);
          const mixiteTag = mixiteBadgeLabel(bottle.mixite);
          const ownerAvatar = safeHttpsUrl(bottle.ownerAvatarUrl);
          const avatarSlots = Math.min(3, Math.max(1, activeCount));

          return (
            <div
              key={bottle.id}
              role="button"
              tabIndex={0}
              onClick={() => onFocusCoordinates?.(bottle.coordinates, bottle.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onFocusCoordinates?.(bottle.coordinates, bottle.name);
                }
              }}
              className={`club-glass-card${isHighlighted ? ' is-map-highlighted' : ''}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                cursor: 'pointer',
                transition: 'box-shadow 180ms ease, transform 150ms ease',
                boxShadow: isHighlighted
                  ? 'inset 0 0 0 1.5px #17402C, 0 8px 22px rgba(23, 64, 44, 0.18)'
                  : undefined,
              }}
            >
              {/* Top pills row: Country/Date + Trust + Mixité */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                  {bottle.countryIso ? (
                    <span
                      style={{
                        height: 22,
                        padding: '0 8px',
                        borderRadius: 999,
                        background: 'rgba(23, 64, 44, 0.10)',
                        color: '#17402C',
                        fontSize: 11,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Compass size={11} aria-hidden="true" />
                      {bottle.countryIso.toUpperCase()}
                    </span>
                  ) : null}

                  {dateLabel ? (
                    <span
                      style={{
                        height: 22,
                        padding: '0 8px',
                        borderRadius: 999,
                        background: 'rgba(23, 43, 36, 0.06)',
                        color: '#56665D',
                        fontSize: 11,
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Calendar size={10} aria-hidden="true" />
                      {returnLabel ? `${dateLabel} – ${returnLabel}` : dateLabel}
                    </span>
                  ) : null}

                  {mixiteTag ? (
                    <span
                      style={{
                        height: 22,
                        padding: '0 8px',
                        borderRadius: 999,
                        background: 'rgba(150, 186, 142, 0.22)',
                        color: '#17402C',
                        fontSize: 11,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                    >
                      {mixiteTag}
                    </span>
                  ) : null}
                </div>

                <span
                  style={{
                    height: 22,
                    padding: '0 8px',
                    borderRadius: 999,
                    background: 'rgba(150, 186, 142, 0.22)',
                    color: '#17402C',
                    fontSize: 11,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <ShieldCheck size={11} aria-hidden="true" />
                  ≥{requiredTrust}
                </span>
              </div>

              {/* Title + compact avatar stack */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: '#172B24',
                      lineHeight: 1.25,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {bottle.name}
                  </div>
                  {bottle.destination ? (
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: '#56665D',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <MapPin size={11} aria-hidden="true" />
                      {bottle.destination}
                    </div>
                  ) : null}
                </div>

                {/* Compact avatar stack */}
                <div style={{ display: 'inline-flex', alignItems: 'center', flex: 'none' }}>
                  {Array.from({ length: avatarSlots }).map((_, idx) => (
                    <span
                      key={idx}
                      aria-hidden="true"
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        border: '1.5px solid #FBFAF6',
                        marginLeft: idx === 0 ? 0 : -7,
                        background:
                          idx === 0
                            ? 'linear-gradient(135deg, #17402C, #2A6145)'
                            : idx === 1
                              ? '#96BA8E'
                              : 'rgba(23, 64, 44, 0.16)',
                        color: idx === 0 ? '#FBFAF6' : '#172B24',
                        fontSize: 10,
                        fontWeight: 700,
                        display: 'grid',
                        placeItems: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      {idx === 0 && ownerAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={ownerAvatar}
                          alt=""
                          loading="lazy"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : idx === 0 ? (
                        (bottle.ownerName || bottle.name).charAt(0).toUpperCase()
                      ) : (
                        <Users size={10} />
                      )}
                    </span>
                  ))}
                </div>
              </div>

              {bottle.description?.trim() ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    fontWeight: 500,
                    lineHeight: 1.4,
                    color: '#46584E',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {bottle.description.trim()}
                </p>
              ) : null}

              {/* Footer: Spots meter + Single pill CTA */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#56665D',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <span>
                      {activeCount}/{maxMembers}
                    </span>
                    <span style={{ color: spotsLeft > 0 ? '#17402C' : '#56665D' }}>
                      {spotsLeft > 0
                        ? `${spotsLeft} libre${spotsLeft > 1 ? 's' : ''}`
                        : 'Complet'}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 5,
                      borderRadius: 999,
                      background: 'rgba(23, 64, 44, 0.10)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${fillPct}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: 'linear-gradient(90deg, #96BA8E, #17402C)',
                      }}
                    />
                  </div>
                </div>

                {isOwner ? (
                  <Link
                    href={`/hub/groupe?groupId=${encodeURIComponent(bottle.id)}`}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                      height: 32,
                      padding: '0 14px',
                      borderRadius: 999,
                      background: 'rgba(23, 64, 44, 0.10)',
                      color: '#17402C',
                      fontSize: 12,
                      fontWeight: 700,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      flex: 'none',
                    }}
                  >
                    Gérer
                    <ArrowUpRight size={13} aria-hidden="true" />
                  </Link>
                ) : isActive ? (
                  <Link
                    href={`/hub/groupe?groupId=${encodeURIComponent(bottle.id)}`}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                      height: 32,
                      padding: '0 14px',
                      borderRadius: 999,
                      background: 'rgba(150, 186, 142, 0.28)',
                      color: '#17402C',
                      fontSize: 12,
                      fontWeight: 700,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      flex: 'none',
                    }}
                  >
                    Membre ✓
                  </Link>
                ) : isRequested ? (
                  <span
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      height: 32,
                      padding: '0 14px',
                      borderRadius: 999,
                      background: 'rgba(150, 186, 142, 0.28)',
                      color: '#17402C',
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      flex: 'none',
                    }}
                  >
                    Demandé ✓
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={spotsLeft <= 0 || isSuspended || (Boolean(user) && !hasTrust)}
                    onPointerDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!user) {
                        router.push('/connexion?next=/explorer');
                        return;
                      }
                      if (spotsLeft <= 0 || isSuspended || !hasTrust) return;
                      setJoinError(null);
                      setConfirmAdult(false);
                      setConfirmBottle(bottle);
                    }}
                    style={{
                      height: 32,
                      padding: '0 14px',
                      borderRadius: 999,
                      border: 0,
                      background:
                        spotsLeft <= 0 || isSuspended || (Boolean(user) && !hasTrust)
                          ? 'rgba(23, 64, 44, 0.12)'
                          : '#17402C',
                      color:
                        spotsLeft <= 0 || isSuspended || (Boolean(user) && !hasTrust)
                          ? '#56665D'
                          : '#FBFAF6',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor:
                        spotsLeft <= 0 || isSuspended || (Boolean(user) && !hasTrust)
                          ? 'default'
                          : 'pointer',
                      flex: 'none',
                    }}
                  >
                    {spotsLeft <= 0
                      ? 'Complet'
                      : user && !hasTrust
                        ? `Trust ≥${requiredTrust}`
                        : 'Rejoindre'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Portaled Apple Liquid Glass majority confirmation sheet (zero inline forms in drawer) */}
      {confirmBottle && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Confirmer la demande"
              onClick={() => setConfirmBottle(null)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1460,
                isolation: 'isolate',
                background: 'rgba(14, 24, 19, 0.44)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                padding: 10,
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  maxWidth: 400,
                  borderRadius: 28,
                  background: 'rgba(251, 250, 246, 0.96)',
                  backdropFilter: 'blur(24px) saturate(1.15)',
                  WebkitBackdropFilter: 'blur(24px) saturate(1.15)',
                  border: '0.5px solid rgba(23, 64, 44, 0.14)',
                  boxShadow: '0 24px 60px rgba(11, 31, 23, 0.30)',
                  padding: '10px 16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  color: '#172B24',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 36,
                      height: 4,
                      borderRadius: 999,
                      background: 'rgba(23, 64, 44, 0.18)',
                    }}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <strong
                      style={{
                        display: 'block',
                        fontSize: 15,
                        fontWeight: 700,
                        color: '#172B24',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {confirmBottle.name}
                    </strong>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: '#56665D' }}>
                      Validation créateur · Trust ≥
                      {Math.max(MIN_TRUST_FLOOR, confirmBottle.minTrustScore || MIN_TRUST_FLOOR)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmBottle(null)}
                    aria-label="Fermer"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      border: 0,
                      background: 'rgba(23, 64, 44, 0.08)',
                      color: '#172B24',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                      flex: 'none',
                    }}
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </div>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '11px 14px',
                    borderRadius: 16,
                    background: confirmAdult ? 'rgba(150, 186, 142, 0.18)' : '#fff',
                    border: confirmAdult
                      ? '1px solid rgba(23, 64, 44, 0.30)'
                      : '0.5px solid rgba(23, 64, 44, 0.10)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={confirmAdult}
                    onChange={(e) => setConfirmAdult(e.target.checked)}
                    style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
                  />
                  <span
                    aria-hidden="true"
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: confirmAdult ? '#17402C' : 'rgba(23, 64, 44, 0.08)',
                      color: '#FBFAF6',
                      display: 'grid',
                      placeItems: 'center',
                      flex: 'none',
                    }}
                  >
                    {confirmAdult ? <Check size={12} /> : null}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: '#172B24' }}>
                    Je certifie avoir 18 ans ou plus (+18)
                  </span>
                </label>

                {joinError ? (
                  <div
                    role="alert"
                    style={{
                      padding: '8px 12px',
                      borderRadius: 12,
                      background: 'rgba(166, 38, 38, 0.08)',
                      color: '#8C1D1D',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {joinError}
                  </div>
                ) : null}

                <button
                  type="button"
                  disabled={!confirmAdult || joiningId === confirmBottle.id}
                  onClick={() => void handleConfirmJoin()}
                  style={{
                    height: 44,
                    borderRadius: 999,
                    border: 0,
                    background: '#17402C',
                    color: '#FBFAF6',
                    fontSize: 13.5,
                    fontWeight: 700,
                    cursor: !confirmAdult || joiningId === confirmBottle.id ? 'default' : 'pointer',
                    opacity: !confirmAdult || joiningId === confirmBottle.id ? 0.5 : 1,
                    boxShadow: '0 8px 20px rgba(23, 64, 44, 0.22)',
                  }}
                >
                  {joiningId === confirmBottle.id ? 'Envoi…' : 'Envoyer la demande'}
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* 5.1 — Carnets de voyage (2-col 4:5 photo covers)                           */
/* -------------------------------------------------------------------------- */

export interface CommunityCarnetsLensProps {
  carnets: ExplorerCarnetItem[];
  loading?: boolean;
  selectedCarnetId?: string | null;
  onFocusCoordinates?: FocusCoordinatesHandler;
}

export function CommunityCarnetsLens({
  carnets,
  loading = false,
  selectedCarnetId = null,
  onFocusCoordinates,
}: CommunityCarnetsLensProps) {
  const createCarnetPill = (
    <Link
      href="/communaute?create=carnet"
      style={{
        height: 30,
        padding: '0 12px',
        borderRadius: 999,
        background: '#17402C',
        color: '#FBFAF6',
        fontSize: 11.5,
        fontWeight: 700,
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        boxShadow: '0 4px 12px rgba(23, 64, 44, 0.16)',
        flex: 'none',
      }}
    >
      <Plus size={13} aria-hidden="true" />
      <span>Créer un carnet</span>
    </Link>
  );

  if (loading && carnets.length === 0) {
    return (
      <div className="xp20-carnet-ig-list" style={{ paddingBottom: 88 }}>
        {[0, 1].map((i) => (
          <div
            key={i}
            className="xp20-carnet-ig-card xp20-shimmer"
            style={{ minHeight: 158 }}
            aria-busy="true"
          />
        ))}
      </div>
    );
  }

  if (carnets.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 88 }}>
        <LensEmptyTile icon={<BookOpen size={16} />} label="Aucun carnet public dans cette zone" />
        <div style={{ display: 'flex', justifyContent: 'center' }}>{createCarnetPill}</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 88 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#56665D' }}>
          {carnets.length} carnet{carnets.length > 1 ? 's' : ''} public{carnets.length > 1 ? 's' : ''}
        </span>
        {createCarnetPill}
      </div>
      <div className="xp20-carnet-ig-list">
        {carnets.map((carnet) => {
          const coverUrl = safeHttpsUrl(carnet.coverImage);
          const isHighlighted = selectedCarnetId === carnet.id;
          const daysCount =
            typeof carnet.nbNuits === 'number' && carnet.nbNuits >= 0
              ? Math.max(1, carnet.nbNuits + 1)
              : 1;
          const likes = typeof carnet.likesCount === 'number' ? carnet.likesCount : 0;
          const initials = (carnet.title || 'LK')
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((w) => w[0] || '')
            .join('')
            .toUpperCase() || 'LK';
          const metaParts = [
            carnet.destination || null,
            `${daysCount} ${daysCount > 1 ? 'jours' : 'jour'}`,
            formatShortDate(carnet.startDate),
          ].filter(Boolean);

          return (
            <article
              key={carnet.id}
              className={`xp20-carnet-ig-card${coverUrl ? ' has-cover-bg' : ''}${isHighlighted ? ' is-map-highlighted' : ''}`}
              data-id={carnet.id}
            >
              {coverUrl ? (
                <span className="xp20-carnet-ig-bg" aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="xp20-carnet-ig-bg-img"
                  />
                  <span className="xp20-carnet-ig-bg-scrim" />
                </span>
              ) : null}

              <Link
                href={`/carnets/${encodeURIComponent(carnet.id)}`}
                className="xp20-carnet-ig-body"
                aria-label={`${carnet.title}${carnet.destination ? `, ${carnet.destination}` : ''}`}
              >
                <div className="xp20-carnet-ig-header">
                  <span className="xp20-carnet-ig-avi-wrap">
                    <span className="xp20-carnet-ig-avi">
                      {coverUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={coverUrl} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <span className="xp20-carnet-ig-initials">{initials}</span>
                      )}
                    </span>
                  </span>

                  <div className="xp20-carnet-ig-stats" role="group" aria-label="Statistiques">
                    <div className="xp20-carnet-ig-stat">
                      <b>{daysCount}</b>
                      <span>{daysCount > 1 ? 'jours' : 'jour'}</span>
                    </div>
                    <div className="xp20-carnet-ig-stat">
                      <b>—</b>
                      <span>km</span>
                    </div>
                    <div className="xp20-carnet-ig-stat">
                      <b>—</b>
                      <span>D+ m</span>
                    </div>
                  </div>
                </div>

                <div className="xp20-carnet-ig-bio">
                  <span className="xp20-carnet-ig-title">{carnet.title}</span>
                  {metaParts.length > 0 ? (
                    <span className="xp20-carnet-ig-meta">{metaParts.join(' · ')}</span>
                  ) : null}
                </div>
              </Link>

              <div className="xp20-carnet-ig-foot">
                {carnet.coordinates ? (
                  <button
                    type="button"
                    className="xp20-carnet-ig-map-btn"
                    onClick={() => onFocusCoordinates?.(carnet.coordinates, carnet.title)}
                  >
                    <MapPin size={12} aria-hidden="true" />
                    <span>Voir sur la carte</span>
                  </button>
                ) : (
                  <span className="xp20-carnet-ig-iso">{carnet.countryIso?.toUpperCase() ?? 'Carnet'}</span>
                )}

                <div className="xp20-carnet-ig-foot-right">
                  <span className="xp20-carnet-ig-likes" aria-label={`${likes} j’aime`}>
                    <Heart size={13} aria-hidden="true" />
                    <span>{likes}</span>
                  </span>
                  <Link
                    href={`/carnets/${encodeURIComponent(carnet.id)}`}
                    className="xp20-carnet-ig-open-btn"
                    aria-label={`Ouvrir ${carnet.title}`}
                  >
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 5.2 — Clubs & Sorties locales (CarnetHorizontalTimeline + 2-col cards)     */
/* -------------------------------------------------------------------------- */

export interface CommunityClubsLensProps {
  clubs: ExplorerClubItem[];
  events?: ExplorerClubEventItem[];
  loading?: boolean;
  selectedClubId?: string | null;
  onFocusCoordinates?: FocusCoordinatesHandler;
}

export function CommunityClubsLens({
  clubs,
  events = [],
  loading = false,
  selectedClubId = null,
  onFocusCoordinates,
}: CommunityClubsLensProps) {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const [registeredEventIds, setRegisteredEventIds] = useState<Set<string>>(() => new Set());
  const [rsvpBusyId, setRsvpBusyId] = useState<string | null>(null);
  const [joinedClubIds, setJoinedClubIds] = useState<Set<string>>(() => new Set());
  const [requestedClubIds, setRequestedClubIds] = useState<Set<string>>(() => new Set());
  const [clubJoinBusyId, setClubJoinBusyId] = useState<string | null>(null);

  const clubIdsKey = useMemo(() => clubs.map((c) => c.id).join(','), [clubs]);
  const eventIdsKey = useMemo(() => events.map((ev) => ev.id).join(','), [events]);

  useEffect(() => {
    if (!user) {
      setRegisteredEventIds(new Set());
      setJoinedClubIds(new Set());
      setRequestedClubIds(new Set());
      return;
    }

    let cancelled = false;
    const loadRelations = async () => {
      try {
        const [membersRes, regsRes] = await Promise.all([
          clubIdsKey
            ? supabase
                .from('club_members')
                .select('club_id, status')
                .eq('user_id', user.id)
                .in('club_id', clubIdsKey.split(','))
            : Promise.resolve({ data: [] as Array<{ club_id: string; status: string }> }),
          eventIdsKey
            ? supabase
                .from('club_event_registrations')
                .select('event_id, status')
                .eq('user_id', user.id)
                .in('event_id', eventIdsKey.split(','))
            : Promise.resolve({ data: [] as Array<{ event_id: string; status: string }> }),
        ]);

        if (cancelled) return;

        const nextJoined = new Set<string>();
        const nextReq = new Set<string>();
        for (const row of membersRes.data ?? []) {
          const cid = String(row.club_id ?? '');
          if (!cid) continue;
          if (row.status === 'active') nextJoined.add(cid);
          else if (row.status === 'pending') nextReq.add(cid);
        }
        setJoinedClubIds(nextJoined);
        setRequestedClubIds(nextReq);

        const nextRegs = new Set<string>();
        for (const row of regsRes.data ?? []) {
          const eid = String(row.event_id ?? '');
          if (eid && (row.status === 'registered' || row.status === 'waitlist')) {
            nextRegs.add(eid);
          }
        }
        setRegisteredEventIds(nextRegs);
      } catch {
        // Keep current state cleanly if RLS/table unavailable
      }
    };

    void loadRelations();
    return () => {
      cancelled = true;
    };
  }, [user, supabase, clubIdsKey, eventIdsKey]);

  const handleToggleEventRsvp = async (
    e: React.MouseEvent<HTMLButtonElement>,
    ev: ExplorerClubEventItem,
  ) => {
    e.stopPropagation();
    if (!user) {
      router.push('/connexion?next=/explorer');
      return;
    }
    if (!ev.clubId || rsvpBusyId === ev.id) return;

    const alreadyRegistered = registeredEventIds.has(ev.id);
    setRsvpBusyId(ev.id);
    try {
      const res = await fetch(
        `/api/clubs/${encodeURIComponent(ev.clubId)}/events/${encodeURIComponent(ev.id)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: alreadyRegistered ? 'cancel' : 'register' }),
        },
      );
      if (res.ok) {
        setRegisteredEventIds((prev) => {
          const next = new Set(prev);
          if (alreadyRegistered) next.delete(ev.id);
          else next.add(ev.id);
          return next;
        });
      } else if (res.status === 401) {
        router.push('/connexion?next=/explorer');
      }
    } catch {
      // Keep UI responsive without crashing on transient network errors
    } finally {
      setRsvpBusyId(null);
    }
  };

  const handleJoinClub = async (
    e: React.MouseEvent<HTMLButtonElement>,
    club: ExplorerClubItem,
  ) => {
    e.stopPropagation();
    if (!user) {
      router.push('/connexion?next=/explorer');
      return;
    }
    if (joinedClubIds.has(club.id) || requestedClubIds.has(club.id) || clubJoinBusyId === club.id) {
      return;
    }
    setClubJoinBusyId(club.id);
    try {
      const res = await fetch(`/api/clubs/${encodeURIComponent(club.id)}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          data?: { member?: unknown; joinRequest?: unknown };
        } | null;
        if (payload?.data?.joinRequest && !payload?.data?.member) {
          setRequestedClubIds((prev) => new Set(prev).add(club.id));
        } else {
          setJoinedClubIds((prev) => new Set(prev).add(club.id));
        }
      } else if (res.status === 401) {
        router.push('/connexion?next=/explorer');
      }
    } catch {
      // Fail gracefully
    } finally {
      setClubJoinBusyId(null);
    }
  };

  const timelineGroups = useMemo<HorizontalTimelineDayGroup[]>(() => {
    if (!events.length) return [];
    const byKey = new Map<string, HorizontalTimelineDayGroup>();
    let dayCounter = 1;

    for (const ev of events) {
      const key = ev.startsAt ? ev.startsAt.slice(0, 10) : 'upcoming';
      let group = byKey.get(key);
      if (!group) {
        group = {
          day: dayCounter++,
          groupLabel: formatDayLabel(ev.startsAt),
          events: [],
        };
        byKey.set(key, group);
      }
      group.events.push({
        id: ev.id,
        day: group.day,
        kind: 'perf',
        badge: ev.surfaceType || 'Sortie',
        timeLabel: formatTimeLabel(ev.startsAt),
        title: ev.title,
        subtitle: ev.location || undefined,
        onClick: () => {
          if (ev.coordinates) {
            onFocusCoordinates?.(ev.coordinates, ev.title);
          } else {
            router.push(`/sorties/${encodeURIComponent(ev.id)}`);
          }
        },
      });
    }

    return Array.from(byKey.values());
  }, [events, onFocusCoordinates, router]);

  if (loading && clubs.length === 0 && events.length === 0) {
    return (
      <div className="xp20-carnet-ig-list" style={{ paddingBottom: 88 }}>
        {[0, 1].map((i) => (
          <div
            key={i}
            className="xp20-carnet-ig-card xp20-shimmer"
            style={{ minHeight: 158 }}
            aria-busy="true"
          />
        ))}
      </div>
    );
  }

  if (clubs.length === 0 && events.length === 0) {
    return (
      <div style={{ paddingBottom: 88 }}>
        <LensEmptyTile icon={<Flag size={16} />} label="Aucun club ou sortie dans cette zone" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 88 }}>
      {timelineGroups.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            margin: 0,
            padding: 0,
            overflow: 'hidden',
            width: '100%',
          }}
        >
          {/* Unclipped horizontal timeline wrapper */}
          <div
            style={{
              margin: 0,
              padding: 0,
              overflow: 'hidden',
              width: '100%',
              borderRadius: 16,
            }}
          >
            <div style={{ paddingInline: 4 }}>
              <CarnetHorizontalTimeline
                groups={timelineGroups}
                ariaLabel="Sorties clubs à proximité"
              />
            </div>
          </div>

          {/* Direct sortie links + inline RSVP pills */}
          <div
            role="list"
            aria-label="Actions rapides sorties clubs"
            style={{
              display: 'flex',
              flexWrap: 'nowrap',
              gap: 8,
              overflowX: 'auto',
              padding: '2px 4px 4px',
              margin: 0,
              scrollbarWidth: 'none',
            }}
          >
            {events.map((ev) => {
              const isRegistered = registeredEventIds.has(ev.id);
              const isBusy = rsvpBusyId === ev.id;
              return (
                <div
                  key={ev.id}
                  role="listitem"
                  className="club-glass-card"
                  onClick={() => {
                    if (ev.coordinates) {
                      onFocusCoordinates?.(ev.coordinates, ev.title);
                    }
                  }}
                  style={{
                    flex: '0 0 228px',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 7,
                    cursor: ev.coordinates ? 'pointer' : 'default',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: '#17402C',
                        background: 'rgba(150, 186, 142, 0.24)',
                        padding: '2px 8px',
                        borderRadius: 999,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatSortieDateTimeFr(ev.startsAt)}
                    </span>
                    {ev.surfaceType ? (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: '#56665D',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {ev.surfaceType}
                      </span>
                    ) : null}
                  </div>

                  <Link
                    href={`/sorties/${encodeURIComponent(ev.id)}`}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#172B24',
                      textDecoration: 'none',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {ev.title}
                  </Link>

                  {ev.location ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#56665D',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <MapPin size={10} aria-hidden="true" style={{ flex: 'none' }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ev.location}
                      </span>
                    </span>
                  ) : null}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 6,
                      marginTop: 2,
                    }}
                  >
                    <Link
                      href={`/sorties/${encodeURIComponent(ev.id)}`}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      style={{
                        height: 28,
                        padding: '0 10px',
                        borderRadius: 999,
                        background: 'rgba(23, 64, 44, 0.08)',
                        color: '#17402C',
                        fontSize: 11,
                        fontWeight: 700,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span>Voir</span>
                      <ArrowUpRight size={12} aria-hidden="true" />
                    </Link>

                    {ev.clubId ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => void handleToggleEventRsvp(e, ev)}
                        style={{
                          height: 28,
                          padding: '0 11px',
                          borderRadius: 999,
                          border: 0,
                          background: isRegistered ? 'rgba(150, 186, 142, 0.34)' : '#17402C',
                          color: isRegistered ? '#17402C' : '#FBFAF6',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: isBusy ? 'default' : 'pointer',
                          opacity: isBusy ? 0.65 : 1,
                        }}
                      >
                        {isBusy ? '…' : isRegistered ? 'Inscrit ✓' : 'Participer'}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {clubs.length > 0 ? (
        <div className="xp20-carnet-ig-list">
          {clubs.map((club) => {
            const emblemUrl = safeHttpsUrl(club.coverImage);
            const isHighlighted = selectedClubId === club.id;
            const members = typeof club.membersCount === 'number' ? club.membersCount : 0;
            const clubEventCount = events.filter((ev) => ev.clubId === club.id).length;
            const metaParts = [club.category || null, club.locationLabel || null].filter(Boolean);
            const fallbackGlyph = club.emoji || club.name.charAt(0).toUpperCase() || 'C';
            const isClubMember = joinedClubIds.has(club.id);
            const isClubRequested = requestedClubIds.has(club.id);
            const isClubBusy = clubJoinBusyId === club.id;

            return (
              <article
                key={club.id}
                className={`xp20-carnet-ig-card${emblemUrl ? ' has-cover-bg' : ''}${isHighlighted ? ' is-map-highlighted' : ''}`}
                data-id={club.id}
              >
                {emblemUrl ? (
                  <span className="xp20-carnet-ig-bg" aria-hidden="true">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={emblemUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="xp20-carnet-ig-bg-img"
                    />
                    <span className="xp20-carnet-ig-bg-scrim" />
                  </span>
                ) : null}

                <Link
                  href={`/clubs/${encodeURIComponent(club.slug)}`}
                  onClick={(e) => e.stopPropagation()}
                  className="xp20-carnet-ig-body"
                  aria-label={`${club.name}${club.locationLabel ? `, ${club.locationLabel}` : ''}`}
                >
                  <div className="xp20-carnet-ig-header">
                    <span className="xp20-carnet-ig-avi-wrap">
                      <span className="xp20-carnet-ig-avi">
                        {emblemUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={emblemUrl} alt="" loading="lazy" decoding="async" />
                        ) : (
                          <span className="xp20-carnet-ig-initials">{fallbackGlyph}</span>
                        )}
                      </span>
                    </span>

                    <div className="xp20-carnet-ig-stats" role="group" aria-label="Statistiques du club">
                      <div className="xp20-carnet-ig-stat">
                        <b>{members}</b>
                        <span>{members > 1 ? 'membres' : 'membre'}</span>
                      </div>
                      <div className="xp20-carnet-ig-stat">
                        <b>{clubEventCount}</b>
                        <span>{clubEventCount > 1 ? 'sorties' : 'sortie'}</span>
                      </div>
                      <div className="xp20-carnet-ig-stat">
                        <b>{club.isVerified ? 'Vérifié' : 'Ouvert'}</b>
                        <span>accès</span>
                      </div>
                    </div>
                  </div>

                  <div className="xp20-carnet-ig-bio">
                    <span className="xp20-carnet-ig-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span>{club.name}</span>
                      {club.isVerified ? (
                        <ShieldCheck size={13} color="#0E8F5B" aria-label="Club vérifié" />
                      ) : null}
                    </span>
                    {metaParts.length > 0 ? (
                      <span className="xp20-carnet-ig-meta">{metaParts.join(' · ')}</span>
                    ) : null}
                  </div>
                </Link>

                <div className="xp20-carnet-ig-foot">
                  {club.coordinates ? (
                    <button
                      type="button"
                      className="xp20-carnet-ig-map-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onFocusCoordinates?.(club.coordinates, club.name);
                      }}
                    >
                      <MapPin size={12} aria-hidden="true" />
                      <span>Carte</span>
                    </button>
                  ) : (
                    <span className="xp20-carnet-ig-iso">{club.category || 'Club'}</span>
                  )}

                  <div
                    className="xp20-carnet-ig-foot-right"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    {isClubMember ? (
                      <span
                        style={{
                          height: 28,
                          padding: '0 10px',
                          borderRadius: 999,
                          background: 'rgba(150, 186, 142, 0.30)',
                          color: '#17402C',
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        Membre ✓
                      </span>
                    ) : isClubRequested ? (
                      <span
                        style={{
                          height: 28,
                          padding: '0 10px',
                          borderRadius: 999,
                          background: 'rgba(150, 186, 142, 0.24)',
                          color: '#17402C',
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        Demandé ✓
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={isClubBusy}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => void handleJoinClub(e, club)}
                        style={{
                          height: 28,
                          padding: '0 10px',
                          borderRadius: 999,
                          border: 0,
                          background: '#17402C',
                          color: '#FBFAF6',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: isClubBusy ? 'default' : 'pointer',
                          opacity: isClubBusy ? 0.65 : 1,
                        }}
                      >
                        {isClubBusy ? '…' : 'Rejoindre'}
                      </button>
                    )}

                    <Link
                      href={`/clubs/${encodeURIComponent(club.slug)}`}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="xp20-carnet-ig-join-pill"
                      style={{ position: 'relative', zIndex: 2 }}
                    >
                      <span>Voir le club</span>
                      <ArrowUpRight size={13} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 5.3 — Stories & Amis (.ig-hl-row bubbles + ~250 m fuzzy friends pills)     */
/* -------------------------------------------------------------------------- */

export interface CommunityStoriesLensProps {
  stories: ExplorerStoryItem[];
  friends?: ExplorerFriendItem[];
  loading?: boolean;
  selectedStoryId?: string | null;
  onFocusCoordinates?: FocusCoordinatesHandler;
  onSelectStory?: (story: ExplorerStoryItem) => void;
}

export function CommunityStoriesLens({
  stories,
  friends = [],
  loading = false,
  selectedStoryId = null,
  onFocusCoordinates,
  onSelectStory,
}: CommunityStoriesLensProps) {
  const { user, profile } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const initialShareFlag =
    profile && typeof profile === 'object' && 'share_club_location' in profile
      ? Boolean((profile as Record<string, unknown>).share_club_location)
      : false;
  const [shareLocation, setShareLocation] = useState<boolean>(initialShareFlag);
  const [savingShare, setSavingShare] = useState(false);

  useEffect(() => {
    if (!user) {
      setShareLocation(false);
      return;
    }

    let cancelled = false;
    const loadSharePref = async () => {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('share_club_location')
          .eq('id', user.id)
          .maybeSingle();
        if (!cancelled && !error && data && typeof data.share_club_location === 'boolean') {
          setShareLocation(data.share_club_location);
        }
      } catch {
        // Ignore gracefully
      }
    };

    void loadSharePref();
    return () => {
      cancelled = true;
    };
  }, [user, supabase]);

  const handleToggleShareLocation = async () => {
    if (!user || savingShare) return;
    const nextValue = !shareLocation;
    setShareLocation(nextValue);
    setSavingShare(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ share_club_location: nextValue })
        .eq('id', user.id);
      if (error) {
        setShareLocation(!nextValue);
      }
    } catch {
      setShareLocation(!nextValue);
    } finally {
      setSavingShare(false);
    }
  };

  if (loading && stories.length === 0 && friends.length === 0) {
    return (
      <div style={{ display: 'flex', gap: 10, padding: '6px 2px 88px' }} aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'rgba(23, 64, 44, 0.08)',
              flex: 'none',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 88 }}>
      {/* Action bar: Publish story CTA + ~250 m fuzzy location share toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <Link
          href="/communaute?composer=story"
          style={{
            height: 30,
            padding: '0 12px',
            borderRadius: 999,
            background: '#17402C',
            color: '#FBFAF6',
            fontSize: 11.5,
            fontWeight: 700,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            boxShadow: '0 4px 12px rgba(23, 64, 44, 0.16)',
          }}
        >
          <Plus size={13} aria-hidden="true" />
          <span>Publier une story</span>
        </Link>

        {user ? (
          <button
            type="button"
            role="switch"
            aria-checked={shareLocation}
            disabled={savingShare}
            onClick={() => void handleToggleShareLocation()}
            style={{
              height: 30,
              padding: '0 11px',
              borderRadius: 999,
              border: shareLocation
                ? '1px solid rgba(23, 64, 44, 0.28)'
                : '0.5px solid rgba(23, 64, 44, 0.14)',
              background: shareLocation
                ? 'rgba(150, 186, 142, 0.28)'
                : 'rgba(255, 255, 255, 0.76)',
              color: '#17402C',
              fontSize: 11.5,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: savingShare ? 'default' : 'pointer',
              opacity: savingShare ? 0.7 : 1,
            }}
          >
            <Radar size={12} aria-hidden="true" />
            <span>
              {shareLocation
                ? 'Position partagée (~250 m) ✓'
                : 'Partager ma position (~250 m)'}
            </span>
          </button>
        ) : null}
      </div>

      {/* Stories highlight row (.ig-hl-row) */}
      {stories.length > 0 ? (
        <div
          className="ig-hl-row lkdv-ig-hl-row"
          role="group"
          aria-label="Stories géolocalisées"
          style={{
            display: 'flex',
            flexWrap: 'nowrap',
            alignItems: 'flex-start',
            gap: 10,
            overflowX: 'auto',
            padding: '2px 2px 4px',
            scrollbarWidth: 'none',
          }}
        >
          {stories.map((story) => {
            const mediaUrl = safeStoryImageUrl(story.imageUrl);
            const isSelected = selectedStoryId === story.id;
            const shortLabel = (story.caption || 'Story').trim();

            return (
              <button
                key={story.id}
                type="button"
                className={`lkdv-ig-hl${isSelected ? ' is-map-highlighted' : ''}`}
                onClick={() => {
                  onFocusCoordinates?.(story.coordinates, shortLabel);
                  onSelectStory?.(story);
                }}
                aria-label={`Story : ${shortLabel}`}
                style={{
                  flex: '0 0 auto',
                  width: 58,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  border: 0,
                  background: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                <span
                  className="lkdv-ig-hl-ring"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    padding: 2,
                    background:
                      'conic-gradient(from 140deg, rgba(23, 64, 44, 0.85), rgba(150, 186, 142, 0.72), rgba(251, 250, 246, 0.96), rgba(23, 64, 44, 0.85))',
                    boxShadow: isSelected
                      ? '0 0 0 2px #17402C, 0 4px 12px rgba(23, 64, 44, 0.24)'
                      : 'inset 0 1px 0 #fff, 0 2px 6px rgba(23, 43, 36, 0.09)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <span
                    className="lkdv-ig-hl-thumb"
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      background: '#FBFAF6',
                      border: '1.5px solid #FBFAF6',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#17402C',
                    }}
                  >
                    {mediaUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mediaUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <Sparkles size={15} aria-hidden="true" />
                    )}
                  </span>
                </span>
                <span
                  className="lkdv-ig-hl-label"
                  style={{
                    width: '100%',
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: '#172B24',
                    textAlign: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <LensEmptyTile icon={<Sparkles size={16} />} label="Aucune story active ici" />
      )}

      {/* Friends nearby: discreet sign-in pill if guest, otherwise ~250 m fuzzed pills */}
      {!user ? (
        <Link
          href="/connexion?next=/explorer"
          className="club-glass-card"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '10px 14px',
            borderRadius: 999,
            textDecoration: 'none',
            color: '#172B24',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              fontWeight: 600,
              color: '#56665D',
              minWidth: 0,
            }}
          >
            <Lock size={13} color="#17402C" aria-hidden="true" style={{ flex: 'none' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Connectez-vous pour voir vos amis (~250 m)
            </span>
          </span>
          <ArrowUpRight size={14} color="#17402C" aria-hidden="true" style={{ flex: 'none' }} />
        </Link>
      ) : friends.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {friends.map((friend) => {
            const avatarUrl = safeHttpsUrl(friend.avatarUrl);
            const fuzzyM = Math.max(250, Math.round(friend.fuzzyRadiusM ?? 250));
            const profileSlug = encodeURIComponent(friend.handle || friend.id);

            return (
              <div
                key={friend.id}
                className="club-glass-card"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 8px 5px 6px',
                  borderRadius: 999,
                  maxWidth: '100%',
                }}
              >
                <button
                  type="button"
                  onClick={() => onFocusCoordinates?.(friend.coordinates, friend.name)}
                  aria-label={`Centrer la carte sur ${friend.name}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: 0,
                    border: 0,
                    background: 'none',
                    cursor: friend.coordinates ? 'pointer' : 'default',
                    flex: 'none',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #17402C, #96BA8E)',
                      color: '#FBFAF6',
                      fontSize: 11.5,
                      fontWeight: 700,
                      display: 'grid',
                      placeItems: 'center',
                      overflow: 'hidden',
                      flex: 'none',
                    }}
                  >
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl}
                        alt=""
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      friend.name.charAt(0).toUpperCase()
                    )}
                  </span>
                </button>

                <Link
                  href={`/profil/${profileSlug}`}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: '#172B24',
                    textDecoration: 'none',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 112,
                  }}
                >
                  {friend.name}
                </Link>

                <button
                  type="button"
                  onClick={() => onFocusCoordinates?.(friend.coordinates, friend.name)}
                  title="Centrer sur la carte"
                  style={{
                    height: 20,
                    padding: '0 7px',
                    borderRadius: 999,
                    border: 0,
                    background: 'rgba(150, 186, 142, 0.24)',
                    color: '#17402C',
                    fontSize: 10.5,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    cursor: friend.coordinates ? 'pointer' : 'default',
                    flex: 'none',
                  }}
                >
                  <Radar size={10} aria-hidden="true" />~{fuzzyM} m
                </button>

                <Link
                  href="/messagerie"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Envoyer un message à ${friend.name}`}
                  title="Envoyer un message"
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: 'rgba(23, 64, 44, 0.08)',
                    color: '#17402C',
                    display: 'grid',
                    placeItems: 'center',
                    textDecoration: 'none',
                    flex: 'none',
                  }}
                >
                  <MessageCircle size={12} aria-hidden="true" />
                </Link>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 999,
            background: 'rgba(23, 64, 44, 0.06)',
            color: '#56665D',
            fontSize: 11.5,
            fontWeight: 600,
            alignSelf: 'flex-start',
          }}
        >
          <Radar size={12} color="#17402C" aria-hidden="true" />
          Aucun ami à proximité (~250 m)
        </div>
      )}
    </div>
  );
}
