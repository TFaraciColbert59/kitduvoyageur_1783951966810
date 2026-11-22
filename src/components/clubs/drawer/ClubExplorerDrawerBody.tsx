'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as Cmd from 'cmdk';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpRight,
  Bookmark,
  Calendar,
  Check,
  Compass,
  FileText,
  Globe,
  Layers,
  Lock,
  MapPin,
  Mountain,
  Package,
  Pin,
  Plus,
  Route,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { EventTicket } from '@/features/community/v2/shared/EventTicket';
import type { EventCardVM } from '@/features/community/v2/shared/types';
import { canAppearInPublicClubSearch, normalizeClubPrivacy } from '@/features/clubs/privacy';
import type { Club } from '@/features/clubs/types';
import {
  AnimatedNumber,
  CLUB_SPRING,
  StaggerCard,
  StaggerList,
} from './ClubDrawerMotion';
import {
  ClubEmptyCard,
  ClubEntityPeek,
  ClubFilterPopoverButton,
  type ClubPeekAction,
  haversineKm,
  normalizeSearchText,
  resolveMassifCoords,
  useDebouncedValue,
  useLocalStorageState,
  useLongPressPeek,
} from './ClubSharedUi';
import type {
  ClubExplorerDrawerBodyProps,
  ClubGearVaultItem,
  ClubItemData,
  ClubMemberData,
  ClubOutingData,
} from './ClubDrawerTypes';
import type { ClubFeedPostItem } from '../feed/ClubInlineFeed';

type MyClubsSort = 'active' | 'recent' | 'next_outing' | 'role';
type DiscoverViewMode = 'popular' | 'massif' | 'recent';
type SearchScope = 'all' | 'clubs' | 'outings' | 'members' | 'posts' | 'gear';

const DISCOVER_FILTER_CHIPS = [
  { id: 'all', label: 'Tous' },
  { id: 'alpes', label: 'Alpes' },
  { id: 'pyrenees', label: 'Pyrénées' },
  { id: 'vercors', label: 'Vercors' },
  { id: 'alpinisme', label: 'Alpinisme' },
  { id: 'trail', label: 'Trail' },
  { id: 'bivouac', label: 'Bivouac' },
  { id: 'nearby', label: 'Autour de moi' },
] as const;

const SMART_SEARCH_PRESETS = [
  { id: 'weekend', label: 'Dispo ce week-end', query: 'week-end' },
  { id: 'covoit', label: 'Covoit', query: 'covoit' },
  { id: 'guides', label: 'Encadrants', query: 'encadrant' },
  { id: 'gpx', label: 'Traces GPX', query: 'gpx' },
  { id: 'bivouac', label: 'Bivouac', query: 'bivouac' },
] as const;

function ClubCoverImage({
  coverUrl,
  name,
  className,
}: {
  coverUrl?: string;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initial = (name || 'C').trim().charAt(0).toUpperCase() || 'C';
  if (!coverUrl || failed) {
    return <span className={className} aria-hidden="true">{initial}</span>;
  }
  return (
    <span className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={coverUrl}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </span>
  );
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const clean = query.trim();
  if (clean.length < 2) return <>{text}</>;
  const idx = normalizeSearchText(text).indexOf(normalizeSearchText(clean));
  if (idx === -1) return <>{text}</>;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + clean.length);
  const after = text.slice(idx + clean.length);
  return (
    <>
      {before}
      <mark className="club-highlight-mark">{match}</mark>
      {after}
    </>
  );
}

function MyClubsSkeleton() {
  return (
    <div className="club-drawer-pane-content" aria-busy="true" aria-label="Chargement des clubs">
      <span className="club-skel-block" style={{ height: 84 }} />
      <span className="club-skel-block" style={{ height: 56 }} />
      <span className="club-skel-block" style={{ height: 56 }} />
      <span className="club-skel-block" style={{ height: 56 }} />
    </div>
  );
}

function MyClubRowCard({
  club,
  isCurrent,
  isPinned,
  confirmingLeave,
  onOpen,
  onFlyMap,
  onRequestLeaveToggle,
  onConfirmLeave,
  onCancelLeave,
  onPeek,
  onPrefetch,
  onJumpPendingMembers,
}: {
  club: ClubItemData;
  isCurrent: boolean;
  isPinned: boolean;
  confirmingLeave: boolean;
  onOpen: () => void;
  onFlyMap: () => void;
  onRequestLeaveToggle: () => void;
  onConfirmLeave: () => void;
  onCancelLeave: () => void;
  onPeek: () => void;
  onPrefetch: () => void;
  onJumpPendingMembers: () => void;
}) {
  const { handlers, wasLongPress } = useLongPressPeek(onPeek);
  const isPrivate = club.visibility === 'prive' || club.visibility === 'secret';

  return (
    <StaggerCard
      className={`reseau-user-row club-switch-row club-glass-card${isCurrent ? ' is-active-club' : ''}`}
      role="listitem"
      aria-current={isCurrent ? 'true' : undefined}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }} {...handlers}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
          <button
            type="button"
            className="club-row-main-btn"
            onMouseEnter={onPrefetch}
            onFocus={onPrefetch}
            onClick={() => {
              if (wasLongPress()) return;
              onOpen();
            }}
            aria-label={`Ouvrir ${club.name}, ${club.massif}, ${club.membersCount} membres`}
          >
            <ClubCoverImage
              coverUrl={club.coverUrl}
              name={club.name}
              className={`club-mini-emblem-v2${isCurrent ? ' is-current' : ''}`}
            />
            <span className="reseau-meta">
              <span className="reseau-name-row" style={{ gap: 5, flexWrap: 'wrap' }}>
                <b>{club.name}</b>
                {isPinned ? (
                  <Pin size={11} color="#17402c" aria-label="Épinglé" />
                ) : null}
                {isPrivate ? (
                  <Lock size={11} color="#56665d" aria-label="Club privé" />
                ) : null}
                {isCurrent ? (
                  <span className="club-badge-sage">
                    <Check size={10} aria-hidden="true" />
                    Actif
                  </span>
                ) : null}
                {club.role && club.role !== 'Membre' ? (
                  <span className="club-badge-soft">{club.role}</span>
                ) : null}
                {club.hasLiveOrImminentOuting ? (
                  <span className="lkdv-carnet-live-badge is-live">
                    <span className="lkdv-carnet-live-dot" />
                    48h
                  </span>
                ) : null}
              </span>
              <span className="reseau-sub" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                <span className="lkdv-carnet-metric-pill">
                  <Mountain size={10} aria-hidden="true" />
                  {club.massif}
                </span>
                <span>
                  <Users size={10} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 3 }} aria-hidden="true" />
                  {club.membersCount}
                </span>
                <span>· {club.outingsCount} sorties</span>
              </span>
              {club.nextOutingTitle ? (
                <span className="reseau-sub" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, color: '#17402c', fontWeight: 600 }}>
                  <Calendar size={10} aria-hidden="true" />
                  <span>{club.nextOutingDate} · {club.nextOutingTitle}</span>
                </span>
              ) : null}
            </span>
          </button>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none' }}>
            <button
              type="button"
              className="reseau-btn active club-icon-pill"
              onClick={(e) => {
                e.stopPropagation();
                onFlyMap();
              }}
              aria-label={`Voir ${club.name} sur la carte 3D`}
              title="Voir sur la carte 3D"
            >
              <MapPin size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`reseau-btn ${club.joined ? 'active' : 'primary'} club-icon-pill`}
              onClick={(e) => {
                e.stopPropagation();
                onRequestLeaveToggle();
              }}
              aria-label={club.joined ? `Options d'adhésion à ${club.name}` : `Rejoindre ${club.name}`}
              title={club.joined ? 'Membre' : 'Rejoindre'}
            >
              {club.joined ? <UserCheck size={15} aria-hidden="true" /> : <UserPlus size={15} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {club.pendingRequestsCount && club.pendingRequestsCount > 0 ? (
          <button
            type="button"
            className="club-pending-banner"
            onClick={(e) => {
              e.stopPropagation();
              onJumpPendingMembers();
            }}
          >
            <span>{club.pendingRequestsCount} demande{club.pendingRequestsCount > 1 ? 's' : ''} d’adhésion en attente</span>
            <ArrowUpRight size={14} aria-hidden="true" />
          </button>
        ) : null}

        {confirmingLeave ? (
          <div className="club-inline-form" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Quitter « {club.name} » ?</span>
            <div style={{ display: 'inline-flex', gap: 6 }}>
              <button type="button" className="lkdv-carnet-btn-soft" style={{ height: 28, padding: '0 10px', fontSize: 11 }} onClick={onCancelLeave}>
                Rester
              </button>
              <button
                type="button"
                className="lkdv-carnet-btn-primary"
                style={{ height: 28, padding: '0 10px', fontSize: 11, background: '#a8443a' }}
                onClick={onConfirmLeave}
              >
                Confirmer
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </StaggerCard>
  );
}

function MyClubsPane({
  loading,
  activeClub,
  clubs,
  members,
  outings,
  onSelectClub,
  onToggleJoinClub,
  onFlyToCoords,
  onSwitchLens,
  onSwitchTabAndLens,
  onOpenCreateClub,
  onToast,
}: Pick<
  ClubExplorerDrawerBodyProps,
  | 'loading'
  | 'activeClub'
  | 'clubs'
  | 'members'
  | 'outings'
  | 'onSelectClub'
  | 'onToggleJoinClub'
  | 'onFlyToCoords'
  | 'onSwitchLens'
  | 'onSwitchTabAndLens'
  | 'onOpenCreateClub'
  | 'onToast'
>) {
  const router = useRouter();
  const [pinnedIds, setPinnedIds] = useLocalStorageState<string[]>('lkdv.clubs.pinned', []);
  const [leaveConfirmId, setLeaveConfirmId] = useState<string | null>(null);
  const [peekClub, setPeekClub] = useState<ClubItemData | null>(null);
  const virtualParentRef = useRef<HTMLDivElement | null>(null);

  const myClubs = useMemo(() => {
    const joined = clubs.filter((c) => c.joined || c.id === activeClub.id);
    const pinSet = new Set(pinnedIds);
    return [...joined].sort((a, b) => {
      const pinDiff = (pinSet.has(b.id) ? 1 : 0) - (pinSet.has(a.id) ? 1 : 0);
      if (pinDiff !== 0) return pinDiff;
      if (a.id === activeClub.id) return -1;
      if (b.id === activeClub.id) return 1;
      const liveDiff = (b.hasLiveOrImminentOuting ? 1 : 0) - (a.hasLiveOrImminentOuting ? 1 : 0);
      if (liveDiff !== 0) return liveDiff;
      return b.membersCount - a.membersCount;
    });
  }, [activeClub.id, clubs, pinnedIds]);

  const managedClubs = useMemo(
    () =>
      myClubs.filter(
        (c) =>
          c.viewerRole === 'admin' ||
          c.viewerRole === 'moderator' ||
          /fondateur|admin|modérateur|encadrant/i.test(c.role),
      ),
    [myClubs],
  );
  const memberOnlyClubs = useMemo(() => {
    const managedSet = new Set(managedClubs.map((c) => c.id));
    return myClubs.filter((c) => !managedSet.has(c.id));
  }, [managedClubs, myClubs]);

  const totals = useMemo(() => {
    const upcomingCount = outings.filter((o) => o.status === 'upcoming' || o.status === 'live').length;
    const totalOutings = myClubs.reduce((acc, c) => acc + (c.outingsCount || 0), 0) || upcomingCount;
    const totalMembers = myClubs.reduce((acc, c) => acc + (c.membersCount || 0), 0);
    return { count: myClubs.length, totalOutings, totalMembers };
  }, [myClubs, outings]);

  const useVirtual = myClubs.length > 20;
  const rowVirtualizer = useVirtualizer({
    count: useVirtual ? myClubs.length : 0,
    getScrollElement: () => virtualParentRef.current,
    estimateSize: () => 92,
    overscan: 4,
  });

  const handleTogglePin = useCallback(
    (club: ClubItemData) => {
      setPinnedIds((prev) => {
        if (prev.includes(club.id)) {
          onToast({ title: `« ${club.name} » désépinglé` });
          return prev.filter((id) => id !== club.id);
        }
        const next = [club.id, ...prev].slice(0, 2);
        onToast({ title: `« ${club.name} » épinglé en tête` });
        return next;
      });
    },
    [onToast, setPinnedIds],
  );

  const handleLeaveClub = useCallback(
    async (club: ClubItemData) => {
      setLeaveConfirmId(null);
      await onToggleJoinClub(club.id);
      onToast({
        title: `Vous avez quitté ${club.name}`,
        subtitle: 'Vous pouvez annuler pendant 3,8 s',
        undo: () => {
          void onToggleJoinClub(club.id);
        },
      });
    },
    [onToast, onToggleJoinClub],
  );

  const handlePrefetch = useCallback(
    (club: ClubItemData) => {
      if (club.slug) {
        try {
          router.prefetch(`/clubs/${encodeURIComponent(club.slug)}`);
        } catch {
          // ignore in test env
        }
      }
    },
    [router],
  );

  const activeInList = myClubs.find((c) => c.id === activeClub.id) ?? (activeClub.id ? activeClub : null);

  if (loading && myClubs.length === 0) {
    return <MyClubsSkeleton />;
  }

  const peekActions: ClubPeekAction[] = peekClub
    ? [
        {
          id: 'open',
          label: 'Ouvrir le club',
          icon: <ArrowUpRight size={17} aria-hidden="true" />,
          onSelect: () => onSelectClub(peekClub.id),
        },
        {
          id: 'map',
          label: 'Voir sur la carte 3D',
          icon: <MapPin size={17} aria-hidden="true" />,
          onSelect: () => {
            const coords = resolveMassifCoords(peekClub.massif, peekClub.lat, peekClub.lng);
            onFlyToCoords(coords.lat, coords.lng, `${peekClub.name} · ${peekClub.massif}`);
          },
        },
        {
          id: 'pin',
          label: pinnedIds.includes(peekClub.id) ? 'Désépingler' : 'Épingler en tête',
          icon: <Pin size={17} aria-hidden="true" />,
          onSelect: () => handleTogglePin(peekClub),
        },
        {
          id: 'share',
          label: 'Partager le lien du club',
          icon: <Share2 size={17} aria-hidden="true" />,
          onSelect: async () => {
            const url = `${window.location.origin}/clubs/${peekClub.slug || peekClub.id}`;
            try {
              if (navigator.share) {
                await navigator.share({ title: peekClub.name, url });
              } else {
                await navigator.clipboard?.writeText(url);
              }
              onToast({ title: 'Lien du club copié ✓', subtitle: url });
            } catch {
              // ignore cancelled share
            }
          },
        },
        ...(peekClub.joined
          ? [
              {
                id: 'leave',
                label: 'Quitter le club',
                icon: <UserCheck size={17} aria-hidden="true" />,
                danger: true,
                onSelect: () => void handleLeaveClub(peekClub),
              },
            ]
          : []),
      ]
    : [];

  const nextOuting = outings[0] ?? null;

  const [fetchedSalonsCount, setFetchedSalonsCount] = useState<number | null>(null);
  useEffect(() => {
    if (typeof activeClub.salonsCount === 'number') {
      setFetchedSalonsCount(activeClub.salonsCount);
      return;
    }
    if (
      !activeClub.id ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(activeClub.id) ||
      typeof fetch !== 'function'
    ) {
      return;
    }
    let cancelled = false;
    fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/salons`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (cancelled) return;
        const list = payload?.data?.channels;
        if (Array.isArray(list)) setFetchedSalonsCount(list.length);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      cancelled = true;
    };
  }, [activeClub.id, activeClub.salonsCount]);

  const resolvedSalonsCount =
    typeof activeClub.salonsCount === 'number'
      ? activeClub.salonsCount
      : fetchedSalonsCount;

  const nextOutingTicket = useMemo<EventCardVM | null>(() => {
    if (!nextOuting) return null;
    const estHours =
      nextOuting.km > 0 || nextOuting.dplus > 0
        ? Math.max(1, Math.round(nextOuting.km / 4 + nextOuting.dplus / 400))
        : null;
    const leaderName = nextOuting.leaderName || activeClub.name;
    const initials = leaderName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() || '')
      .join('') || 'C';
    const maxP = Math.max(0, nextOuting.maxParticipants || 0);
    const curP = Math.max(0, nextOuting.participantsCount || 0);
    return {
      id: nextOuting.id,
      title: nextOuting.title,
      activity: activeClub.category || 'Randonnée',
      startsAt: nextOuting.startsAtIso ?? null,
      endsAt: null,
      eventDate: nextOuting.startsAtIso ? nextOuting.startsAtIso.slice(0, 10) : '',
      location: nextOuting.massif || activeClub.massif,
      meetingPoint: nextOuting.carpoolCity || null,
      level: null,
      distanceKm: nextOuting.km > 0 ? nextOuting.km : null,
      elevationGainM: nextOuting.dplus > 0 ? nextOuting.dplus : null,
      duration: estHours ? `~${estHours} h` : null,
      coverImage: null,
      coverAlt: null,
      maxParticipants: maxP,
      currentParticipants: curP,
      spotsLeft: maxP > 0 ? Math.max(0, maxP - curP) : 0,
      waitlistEnabled: false,
      myStatus: nextOuting.rsvpJoined ? 'registered' : 'none',
      organizer: {
        id: nextOuting.leaderHandle || activeClub.slug,
        name: leaderName,
        handle: nextOuting.leaderHandle || activeClub.slug,
        avatarUrl: null,
        initials,
      },
      participants: [],
      participantsTotal: curP,
      clubId: activeClub.id,
      clubName: activeClub.name,
      kitId: null,
      description: null,
      safetyNotes: null,
      safetyChecklist: [],
      recurrence: null,
      past: nextOuting.status === 'completed',
      routeTrace: null,
      distanceKmFromMe: null,
      lat: nextOuting.lat,
      lng: nextOuting.lng,
    };
  }, [activeClub.category, activeClub.id, activeClub.massif, activeClub.name, activeClub.slug, nextOuting]);

  return (
    <div className="club-drawer-pane-content" data-testid="club-overview-pane">
      {/* 1. Hero du club actif */}
      <div className="club-hero-card">
        {activeClub.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={activeClub.coverUrl} alt="" className="club-hero-cover-blur" />
        ) : null}
        <div className="club-hero-top">
          <ClubCoverImage coverUrl={activeClub.coverUrl} name={activeClub.name} className="club-hero-emblem" />
          <div className="club-hero-meta">
            <b>{activeClub.name}</b>
            <div className="club-hero-badges">
              <span className="club-badge-forest">{activeClub.joined ? 'Club actif' : 'Club public'}</span>
              {activeClub.role ? <span className="club-badge-soft">{activeClub.role}</span> : null}
              {activeClub.massif ? <span className="club-badge-soft">{activeClub.massif}</span> : null}
            </div>
          </div>
        </div>
        <div className="club-hero-kpis">
          <div className="club-hero-kpi">
            <small>Membres</small>
            <b><AnimatedNumber value={activeClub.membersCount || members.length} /></b>
          </div>
          <div className="club-hero-kpi">
            <small>Sorties</small>
            <b><AnimatedNumber value={outings.length} /></b>
          </div>
          <div className="club-hero-kpi">
            <small>Dénivelé +</small>
            <b><AnimatedNumber value={activeClub.totalDplus ?? 0} suffix=" m" /></b>
          </div>
        </div>
        <div className="club-hero-footer" style={{ justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="lkdv-carnet-btn-soft"
            style={{ height: 28, padding: '0 10px', fontSize: 11.5 }}
            onClick={() => void onToggleJoinClub(activeClub.id)}
          >
            {activeClub.joined ? 'Quitter le club' : 'Rejoindre'}
          </button>
        </div>
      </div>

      {/* 2. Prochaine sortie imminente (billet Communauté V2) */}
      {nextOuting && nextOutingTicket ? (
        <div className="lkdv-communaute-v2" style={{ background: 'transparent' }}>
          <EventTicket
            event={nextOutingTicket}
            variant="tile"
            onOpen={() => onSwitchTabAndLens(2, 0, { inspectOuting: nextOuting })}
          />
        </div>
      ) : null}

      {/* 3. Accès rapides vers chaque espace */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button
          type="button"
          className="club-glass-card"
          style={{ gridColumn: '1 / -1', textAlign: 'left', cursor: 'pointer', border: 0 }}
          onClick={() => onSwitchTabAndLens(2, 0)}
        >
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--label)' }}>Sorties</div>
          <div style={{ fontSize: 11.5, color: 'var(--label2)', marginTop: 2 }}>
            {outings.length} départs & GPX
          </div>
        </button>
        <button
          type="button"
          className="club-glass-card"
          style={{ textAlign: 'left', cursor: 'pointer', border: 0 }}
          onClick={() => onSwitchTabAndLens(4, 0)}
        >
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--label)' }}>Salons</div>
          <div style={{ fontSize: 11.5, color: 'var(--label2)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
            {resolvedSalonsCount !== null
              ? `${resolvedSalonsCount} salon${resolvedSalonsCount > 1 ? 's' : ''}`
              : '—'}
          </div>
        </button>
        <button
          type="button"
          className="club-glass-card"
          style={{ textAlign: 'left', cursor: 'pointer', border: 0 }}
          onClick={() => onSwitchTabAndLens(3, 0)}
        >
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--label)' }}>Coffre & Défis</div>
          <div style={{ fontSize: 11.5, color: 'var(--label2)', marginTop: 2 }}>
            Matériel & classements
          </div>
        </button>
      </div>

      {/* 4. À propos du club */}
      {activeClub.bio || activeClub.charter ? (
        <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--label2)' }}>
            À propos du club
          </div>
          {activeClub.bio ? (
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.45, color: 'var(--label)' }}>
              {activeClub.bio}
            </p>
          ) : null}
          {activeClub.charter && activeClub.charter !== activeClub.bio ? (
            <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.4, color: 'var(--label2)' }}>
              {activeClub.charter}
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        className="lkdv-carnet-btn-soft"
        style={{ width: '100%', justifyContent: 'center', height: 36 }}
        onClick={() => onSwitchLens(1)}
      >
        <Compass size={14} aria-hidden="true" />
        <span>Explorer les autres clubs</span>
      </button>

      <ClubEntityPeek
        open={Boolean(peekClub)}
        title={peekClub?.name || ''}
        subtitle={peekClub ? `${peekClub.massif} · ${peekClub.membersCount} membres` : undefined}
        imageUrl={peekClub?.coverUrl}
        monogram={peekClub?.name.slice(0, 2).toUpperCase()}
        actions={peekActions}
        onClose={() => setPeekClub(null)}
      />
    </div>
  );
}

function DiscoverClubsPane({
  active,
  loading,
  activeClub,
  clubs,
  currentUserId,
  onSelectClub,
  onToggleJoinClub,
  onFlyToCoords,
  onOpenCreateClub,
  onToast,
}: Pick<
  ClubExplorerDrawerBodyProps,
  | 'active'
  | 'loading'
  | 'activeClub'
  | 'clubs'
  | 'currentUserId'
  | 'onSelectClub'
  | 'onToggleJoinClub'
  | 'onFlyToCoords'
  | 'onOpenCreateClub'
  | 'onToast'
>) {
  const [filterChip, setFilterChip] = useState<string>(() => {
    if (typeof window === 'undefined') return 'all';
    return window.sessionStorage.getItem('lkdv.clubs.discoverChip') || 'all';
  });
  const [viewMode, setViewMode] = useState<DiscoverViewMode>('popular');
  const [quickFilter, setQuickFilter] = useState('');
  const [onlyUnjoined, setOnlyUnjoined] = useState(false);
  const [savedIds, setSavedIds] = useLocalStorageState<string[]>('lkdv.clubs.savedDiscover', []);
  const [joinPromptClubId, setJoinPromptClubId] = useState<string | null>(null);
  const [joinNote, setJoinNote] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [peekClub, setPeekClub] = useState<ClubItemData | null>(null);
  const [remoteClubs, setRemoteClubs] = useState<ClubItemData[]>([]);
  const [remoteTotal, setRemoteTotal] = useState<number | null>(null);
  const [remoteOffset, setRemoteOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const debouncedFilter = useDebouncedValue(quickFilter, 250);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem('lkdv.clubs.discoverChip', filterChip);
      } catch {
        // ignore
      }
    }
  }, [filterChip]);

  const fetchServerClubs = useCallback(async (offset: number, q: string, append: boolean) => {
    if (typeof fetch !== 'function') return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ limit: '20', offset: String(offset) });
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/clubs?${params.toString()}`);
      if (!res.ok) return;
      const json = await res.json();
      const rows: any[] = json.clubs || json.data || [];
      const mapped: ClubItemData[] = rows.map((r) => {
        const coords = resolveMassifCoords(r.zoneLabel || r.zone_label || r.primarySport || r.primary_sport || '');
        const priv = normalizeClubPrivacy(r.privacy);
        return {
          id: r.id,
          slug: r.slug || r.id,
          name: r.name,
          massif: r.zoneLabel || r.zone_label || r.primarySport || r.primary_sport || 'Outdoor',
          category: r.primarySport || r.primary_sport || 'Outdoor',
          level: 'Tous niveaux',
          membersCount: Number(r.membersCount ?? r.members_count ?? 1),
          outingsCount: Number(r.eventsCount ?? 0),
          totalKm: 0,
          totalDplus: 0,
          joined: false,
          role: 'Membre',
          visibility: priv === 'secret' ? 'secret' : priv === 'closed' ? 'prive' : 'public',
          bio: r.description || 'Club outdoor LKDV.',
          charter: r.rules || 'Respect strict de la montagne.',
          nextOutingTitle: 'Découvrir les prochaines sorties',
          nextOutingDate: 'À venir',
          weatherIso: 'Iso 0°C —',
          weatherWind: 'Vent calme',
          weatherTrail: 'Conditions stables',
          lat: coords.lat,
          lng: coords.lng,
          coverUrl: r.coverImage || r.cover_image || undefined,
          isVerified: r.verification?.status === 'verified',
        };
      });
      setRemoteClubs((prev) => (append ? [...prev, ...mapped] : mapped));
      if (typeof json.total === 'number') setRemoteTotal(json.total);
      setRemoteOffset(offset + mapped.length);
    } catch {
      // ignore network failure in offline/test env
    } finally {
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (!active || !debouncedFilter.trim()) return;
    void fetchServerClubs(0, debouncedFilter, false);
  }, [active, debouncedFilter, fetchServerClubs]);

  const mergedClubs = useMemo(() => {
    const map = new Map<string, ClubItemData>();
    for (const c of clubs) map.set(c.id, c);
    for (const rc of remoteClubs) {
      if (!map.has(rc.id)) map.set(rc.id, rc);
    }
    const viewerCtx = { viewerId: currentUserId ?? null, viewerClubIds: clubs.filter((c) => c.joined).map((c) => c.id) };
    return Array.from(map.values()).filter((c) => {
      const privacy = normalizeClubPrivacy(c.visibility === 'prive' ? 'closed' : c.visibility);
      const asClub: Club = {
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.bio,
        primarySport: c.category,
        sports: [c.category],
        privacy,
        zoneLabel: c.massif,
        coverImage: c.coverUrl ?? null,
        rules: c.charter,
        joinQuestions: [],
        verification: { status: c.isVerified ? 'verified' : 'unverified', verifiedAt: null, badgeLabel: null, eligibleSports: [] },
        createdBy: c.createdBy ?? '',
        createdAt: c.lastActivityAt ?? '',
      };
      return canAppearInPublicClubSearch(asClub, viewerCtx);
    });
  }, [clubs, currentUserId, remoteClubs]);

  const spotlightClubs = useMemo(() => {
    const catNorm = normalizeSearchText(activeClub.category);
    const massifNorm = normalizeSearchText(activeClub.massif);
    return mergedClubs
      .filter((c) => c.id !== activeClub.id && (normalizeSearchText(c.category).includes(catNorm) || normalizeSearchText(c.massif).includes(massifNorm)))
      .slice(0, 3);
  }, [activeClub.category, activeClub.id, activeClub.massif, mergedClubs]);

  const filteredList = useMemo(() => {
    const qNorm = normalizeSearchText(debouncedFilter);
    const base = mergedClubs.filter((c) => {
      if (onlyUnjoined && c.joined) return false;
      if (qNorm) {
        const hay = normalizeSearchText(`${c.name} ${c.massif} ${c.category} ${c.bio}`);
        if (!hay.includes(qNorm)) return false;
      }
      if (filterChip !== 'all' && filterChip !== 'nearby') {
        const hay = normalizeSearchText(`${c.massif} ${c.category} ${c.name}`);
        if (!hay.includes(filterChip)) return false;
      }
      return true;
    });

    return [...base].sort((a, b) => {
      if (filterChip === 'nearby') {
        const da = haversineKm(activeClub.lat, activeClub.lng, a.lat, a.lng);
        const db = haversineKm(activeClub.lat, activeClub.lng, b.lat, b.lng);
        return da - db;
      }
      if (viewMode === 'recent') {
        return (b.lastActivityAt || '').localeCompare(a.lastActivityAt || '');
      }
      const affA = normalizeSearchText(a.category) === normalizeSearchText(activeClub.category) ? 1 : 0;
      const affB = normalizeSearchText(b.category) === normalizeSearchText(activeClub.category) ? 1 : 0;
      if (affB !== affA) return affB - affA;
      return b.membersCount - a.membersCount;
    });
  }, [activeClub.category, activeClub.lat, activeClub.lng, debouncedFilter, filterChip, mergedClubs, onlyUnjoined, viewMode]);

  const groupedByMassif = useMemo(() => {
    if (viewMode !== 'massif') return null;
    const map = new Map<string, ClubItemData[]>();
    for (const club of filteredList) {
      const key = club.massif || 'Autres massifs';
      const arr = map.get(key) ?? [];
      arr.push(club);
      map.set(key, arr);
    }
    return map;
  }, [filteredList, viewMode]);

  const toggleSaveClub = useCallback(
    (club: ClubItemData) => {
      setSavedIds((prev) => {
        const exists = prev.includes(club.id);
        onToast({ title: exists ? `Retiré des favoris` : `« ${club.name} » enregistré pour plus tard` });
        return exists ? prev.filter((id) => id !== club.id) : [club.id, ...prev];
      });
    },
    [onToast, setSavedIds],
  );

  const renderClubDiscoverCard = (c: ClubItemData) => {
    const distKm = Math.round(haversineKm(activeClub.lat, activeClub.lng, c.lat, c.lng));
    const isPrivate = c.visibility === 'prive';
    const isExpanded = expandedId === c.id;
    const isSaved = savedIds.includes(c.id);
    const needsPrompt = !c.joined && isPrivate;

    return (
      <StaggerCard key={c.id} className="reseau-user-row club-switch-row club-glass-card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
            <button
              type="button"
              className="club-row-main-btn"
              onClick={() => onSelectClub(c.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setPeekClub(c);
              }}
            >
              <ClubCoverImage coverUrl={c.coverUrl} name={c.name} className="club-mini-emblem-v2" />
              <span className="reseau-meta">
                <span className="reseau-name-row" style={{ gap: 5, flexWrap: 'wrap' }}>
                  <b>{c.name}</b>
                  {c.isVerified ? (
                    <ShieldCheck size={13} color="#17402c" aria-label="Club vérifié" />
                  ) : null}
                  {c.hasLiveOrImminentOuting ? (
                    <span
                      title="Sortie cette semaine"
                      style={{ width: 6, height: 6, borderRadius: 999, background: '#16a34a', display: 'inline-block' }}
                    />
                  ) : null}
                  <span className={isPrivate ? 'club-badge-amber' : 'club-badge-soft'}>
                    {isPrivate ? <Lock size={10} aria-hidden="true" /> : null}
                    {isPrivate ? 'Sur cooptation' : 'Ouvert'}
                  </span>
                </span>
                <span className="reseau-sub" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.bio}
                </span>
                <span className="reseau-sub" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                  <span className="lkdv-carnet-metric-pill">
                    <Mountain size={10} aria-hidden="true" />
                    {c.massif}
                  </span>
                  <span>
                    <AnimatedNumber value={c.membersCount} /> membres
                  </span>
                  {distKm > 0 && distKm < 500 ? <span>· ~{distKm} km</span> : <span>· {c.level}</span>}
                </span>
              </span>
            </button>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none' }}>
              <button
                type="button"
                className="reseau-btn active club-icon-pill"
                onClick={() => setExpandedId(isExpanded ? null : c.id)}
                aria-expanded={isExpanded}
                aria-label={`Aperçu rapide de ${c.name}`}
              >
                <Layers size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={`reseau-btn ${c.joined ? 'active' : 'primary'} club-icon-pill`}
                aria-label={c.joined ? 'Membre' : isPrivate ? 'Candidater' : 'Rejoindre'}
                title={c.joined ? 'Membre' : isPrivate ? 'Candidater' : 'Rejoindre'}
                onClick={() => {
                  if (needsPrompt) {
                    setJoinPromptClubId((prev) => (prev === c.id ? null : c.id));
                  } else {
                    void onToggleJoinClub(c.id);
                  }
                }}
              >
                {c.joined ? <UserCheck size={15} aria-hidden="true" /> : <UserPlus size={15} aria-hidden="true" />}
              </button>
            </div>
          </div>

          {isExpanded ? (
            <div className="club-inline-form">
              <p style={{ margin: 0, fontSize: 12, color: '#56665d' }}>{c.charter}</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" className="lkdv-carnet-btn-soft" style={{ height: 30, fontSize: 11.5 }} onClick={() => onSelectClub(c.id)}>
                  <span>Ouvrir la fiche</span>
                  <ArrowUpRight size={13} aria-hidden="true" />
                </button>
                <button type="button" className="lkdv-carnet-btn-soft" style={{ height: 30, fontSize: 11.5 }} onClick={() => toggleSaveClub(c)}>
                  <Bookmark size={13} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
                  <span>{isSaved ? 'Enregistré' : 'À découvrir plus tard'}</span>
                </button>
              </div>
            </div>
          ) : null}

          {joinPromptClubId === c.id ? (
            <form
              className="club-inline-form"
              onSubmit={async (e) => {
                e.preventDefault();
                await onToggleJoinClub(c.id, { message: joinNote.trim() || undefined });
                setJoinPromptClubId(null);
                setJoinNote('');
              }}
            >
              <input
                type="text"
                className="club-inline-input"
                value={joinNote}
                onChange={(e) => setJoinNote(e.target.value)}
                placeholder="Mot de présentation aux encadrants (optionnel)…"
                aria-label="Message de candidature"
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                <button type="button" className="lkdv-carnet-btn-soft" style={{ height: 30, fontSize: 11.5 }} onClick={() => setJoinPromptClubId(null)}>
                  Annuler
                </button>
                <button type="submit" className="lkdv-carnet-btn-primary" style={{ height: 30, fontSize: 11.5 }}>
                  Envoyer ma demande
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </StaggerCard>
    );
  };

  if (loading && clubs.length === 0) {
    return <MyClubsSkeleton />;
  }

  return (
    <div className="club-drawer-pane-content">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div className="club-search-box-v2 is-compact" style={{ flex: 1, minWidth: 0 }}>
          <Search size={14} color="#56665d" aria-hidden="true" />
          <input
            type="search"
            value={quickFilter}
            onChange={(e) => setQuickFilter(e.target.value)}
            placeholder="Filtrer par massif, ville ou discipline…"
            aria-label="Filtrer les clubs à découvrir"
          />
          {quickFilter ? (
            <button type="button" className="club-search-clear-btn" onClick={() => setQuickFilter('')} aria-label="Effacer le filtre">
              <X size={13} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <ClubFilterPopoverButton
          value={filterChip}
          defaultValue="all"
          ariaLabel="Filtrer et trier les clubs à découvrir"
          onChange={setFilterChip}
          options={DISCOVER_FILTER_CHIPS.map((c) => ({ id: c.id, label: c.label }))}
          extraGroup={{
            label: 'Affichage',
            value: viewMode,
            defaultValue: 'popular',
            onChange: (next) => setViewMode(next as DiscoverViewMode),
            options: [
              { id: 'popular', label: 'Populaires' },
              { id: 'massif', label: 'Groupés par massif' },
              { id: 'recent', label: 'Activité récente' },
            ],
          }}
          extraToggle={{
            label: 'Non rejoints uniquement',
            checked: onlyUnjoined,
            onChange: setOnlyUnjoined,
          }}
        />
      </div>

      {spotlightClubs.length > 0 && !quickFilter && filterChip === 'all' ? (
        <div className="club-voyage-rail" data-hscroll="true" aria-label="Clubs recommandés">
          {spotlightClubs.map((c) => (
            <button
              key={c.id}
              type="button"
              className="club-voyage-card"
              onClick={() => onSelectClub(c.id)}
            >
              {c.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.coverUrl} alt="" loading="lazy" decoding="async" />
              ) : null}
              <span className="club-voyage-pill-top">{c.massif}</span>
              <span className="club-voyage-info">
                <b>{c.name}</b>
                <span>{c.membersCount} membres · {c.category}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {filteredList.length === 0 ? (
        <ClubEmptyCard
          icon={<Globe size={22} />}
          title="Aucun club répertorié dans ce massif."
          description="Modifiez vos filtres ou lancez la première cordée locale sur ce territoire."
          actions={
            <>
              {(quickFilter || filterChip !== 'all' || onlyUnjoined) ? (
                <button
                  type="button"
                  className="lkdv-carnet-btn-soft"
                  onClick={() => {
                    setQuickFilter('');
                    setFilterChip('all');
                    setOnlyUnjoined(false);
                  }}
                >
                  Réinitialiser les filtres
                </button>
              ) : null}
              <button
                type="button"
                className="lkdv-carnet-btn-primary"
                onClick={() => onOpenCreateClub(filterChip !== 'all' && filterChip !== 'nearby' ? filterChip : undefined)}
              >
                <Plus size={14} aria-hidden="true" />
                <span>Fonder ce club</span>
              </button>
            </>
          }
        />
      ) : groupedByMassif ? (
        Array.from(groupedByMassif.entries()).map(([massifName, group]) => (
          <div key={massifName} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="lkdv-carnet-kit-eyebrow" style={{ paddingLeft: 4 }}>
              {massifName} ({group.length})
            </span>
            <StaggerList className="reseau-list">
              {group.map(renderClubDiscoverCard)}
            </StaggerList>
          </div>
        ))
      ) : (
        <StaggerList className="reseau-list">
          {filteredList.map(renderClubDiscoverCard)}
        </StaggerList>
      )}

      {loadingMore ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="club-skel-block" style={{ height: 54 }} />
          <span className="club-skel-block" style={{ height: 54 }} />
        </div>
      ) : null}

      {mergedClubs.length >= 20 || (remoteTotal !== null && remoteClubs.length < remoteTotal) ? (
        <button
          type="button"
          className="lkdv-carnet-btn-soft"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => void fetchServerClubs(remoteOffset, debouncedFilter, true)}
        >
          Voir plus de clubs ({filteredList.length}{remoteTotal ? ` / ${remoteTotal}` : ''})
        </button>
      ) : null}

      <div className="lkdv-carnet-pokedex-banner">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <b style={{ fontSize: 13.5, color: '#172b24', display: 'block' }}>Vous ne trouvez pas votre cordée ?</b>
            <span style={{ fontSize: 11.5, color: '#56665d' }}>Fondez votre propre club local en moins d’une minute.</span>
          </div>
          <button
            type="button"
            className="lkdv-carnet-btn-primary"
            style={{ height: 32, padding: '0 12px', fontSize: 12 }}
            onClick={() => onOpenCreateClub(filterChip !== 'all' && filterChip !== 'nearby' ? filterChip : undefined)}
          >
            Fonder
          </button>
        </div>
      </div>

      {filteredList.length > 0 ? (
        <button
          type="button"
          className="club-context-pill"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => {
            const first = filteredList[0];
            const coords = resolveMassifCoords(first.massif, first.lat, first.lng);
            onFlyToCoords(coords.lat, coords.lng, `Carte des clubs · ${filteredList.length} clubs`);
          }}
        >
          <MapPin size={13} aria-hidden="true" />
          <span>Carte des clubs ({filteredList.length})</span>
        </button>
      ) : null}

      <ClubEntityPeek
        open={Boolean(peekClub)}
        title={peekClub?.name || ''}
        subtitle={peekClub ? `${peekClub.massif} · ${peekClub.membersCount} membres` : undefined}
        imageUrl={peekClub?.coverUrl}
        monogram={peekClub?.name.slice(0, 2).toUpperCase()}
        actions={
          peekClub
            ? [
                {
                  id: 'open',
                  label: 'Ouvrir le club',
                  icon: <ArrowUpRight size={17} aria-hidden="true" />,
                  onSelect: () => onSelectClub(peekClub.id),
                },
                {
                  id: 'save',
                  label: savedIds.includes(peekClub.id) ? 'Retirer des favoris' : 'À découvrir plus tard',
                  icon: <Bookmark size={17} aria-hidden="true" />,
                  onSelect: () => toggleSaveClub(peekClub),
                },
              ]
            : []
        }
        onClose={() => setPeekClub(null)}
      />
    </div>
  );
}

function SearchAllPane({
  active,
  initialSearchFocus,
  activeClub,
  clubs,
  members,
  outings,
  posts,
  vaultGear,
  searchQuery,
  onSearchQueryChange,
  onSelectClub,
  onFlyToCoords,
  onSwitchTabAndLens,
  onBorrowGear,
  onClose,
}: Pick<
  ClubExplorerDrawerBodyProps,
  | 'active'
  | 'initialSearchFocus'
  | 'activeClub'
  | 'clubs'
  | 'members'
  | 'outings'
  | 'posts'
  | 'vaultGear'
  | 'searchQuery'
  | 'onSearchQueryChange'
  | 'onSelectClub'
  | 'onFlyToCoords'
  | 'onSwitchTabAndLens'
  | 'onBorrowGear'
  | 'onClose'
>) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [scope, setScope] = useState<SearchScope>('all');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [recentQueries, setRecentQueries] = useLocalStorageState<string[]>('lkdv.clubs.recentSearches', []);
  const [remoteClubs, setRemoteClubs] = useState<ClubItemData[]>([]);
  const [remoteOutings, setRemoteOutings] = useState<ClubOutingData[]>([]);
  const [remoteSearching, setRemoteSearching] = useState(false);
  const [remoteOffline, setRemoteOffline] = useState(false);
  const debouncedQuery = useDebouncedValue(searchQuery, 250);
  const liveAnnouncement = useDebouncedValue(searchQuery, 300);

  // Deferred 280ms focus only when pane is active and triggered as search (no raw autoFocus)
  useEffect(() => {
    if (!active || !initialSearchFocus) return;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [active, initialSearchFocus]);

  const saveRecentQuery = useCallback(
    (q: string) => {
      const clean = q.trim();
      if (clean.length < 2) return;
      setRecentQueries((prev) => [clean, ...prev.filter((item) => item !== clean)].slice(0, 5));
    },
    [setRecentQueries],
  );

  // Debounced remote Supabase search with AbortController
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!active || q.length < 2) {
      setRemoteClubs([]);
      setRemoteOutings([]);
      setRemoteSearching(false);
      setRemoteOffline(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setRemoteSearching(true);
    setRemoteOffline(false);

    (async () => {
      try {
        const supabase = createClient();
        const safe = q.replace(/[%_,]/g, '');
        const clubsReq = supabase
          .from('clubs')
          .select('id, name, slug, description, category, cover_image, members_count, privacy')
          .or(`name.ilike.%${safe}%,category.ilike.%${safe}%`)
          .limit(8);
        const eventsReq = supabase
          .from('club_events')
          .select('*')
          .ilike('title', `%${safe}%`)
          .limit(8);

        const [clubsRes, eventsRes] = await Promise.all([clubsReq, eventsReq]);
        if (cancelled || controller.signal.aborted) return;

        const rClubs: ClubItemData[] = (clubsRes.data || []).map((r: any) => ({
          id: r.id,
          slug: r.slug || r.id,
          name: r.name,
          massif: r.category || 'Outdoor',
          category: r.category || 'Outdoor',
          level: 'Tous niveaux',
          membersCount: Number(r.members_count ?? 0),
          outingsCount: 0,
          totalKm: 0,
          totalDplus: 0,
          joined: false,
          role: 'Membre',
          visibility: r.privacy === 'closed' || r.privacy === 'private' ? 'prive' : r.privacy === 'secret' ? 'secret' : 'public',
          bio: r.description || '',
          charter: '',
          nextOutingTitle: 'Voir les sorties',
          nextOutingDate: 'À venir',
          weatherIso: 'Iso 0°C —',
          weatherWind: 'Vent calme',
          weatherTrail: 'Conditions stables',
          lat: 45.764,
          lng: 4.835,
          coverUrl: r.cover_image || undefined,
        }));

        const rOutings: ClubOutingData[] = (eventsRes.data || []).map((ev: any) => ({
          id: ev.id,
          clubId: ev.club_id || activeClub.id,
          title: ev.title || 'Sortie club',
          date: ev.event_date ? new Date(ev.event_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'À venir',
          massif: ev.location || activeClub.massif,
          km: Number(ev.distance_km ?? 0),
          dplus: Number(ev.elevation_gain_m ?? 0),
          maxAlt: Number(ev.max_altitude_m ?? 0),
          status: ev.status === 'cancelled' ? 'cancelled' : 'upcoming',
          leaderName: activeClub.name,
          leaderHandle: activeClub.slug,
          participantsCount: Number(ev.participants_count ?? 0),
          maxParticipants: Number(ev.max_participants ?? 12),
          rsvpJoined: false,
          carpoolCity: ev.meeting_point || ev.location || 'Sur place',
          carpoolSeatsLeft: 0,
          requiredGear: [],
          lat: Number(ev.lat ?? activeClub.lat),
          lng: Number(ev.lng ?? activeClub.lng),
        }));

        setRemoteClubs(rClubs);
        setRemoteOutings(rOutings);
      } catch {
        if (!cancelled) setRemoteOffline(true);
      } finally {
        if (!cancelled) setRemoteSearching(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [active, activeClub.id, activeClub.lat, activeClub.lng, activeClub.massif, activeClub.name, activeClub.slug, debouncedQuery]);

  const searchResults = useMemo(() => {
    const q = normalizeSearchText(searchQuery);
    const score = (title: string, extra: string) => {
      const t = normalizeSearchText(title);
      if (t.startsWith(q)) return 3;
      if (t.includes(q)) return 2;
      if (normalizeSearchText(extra).includes(q)) return 1;
      return 0;
    };

    if (!q) {
      return {
        clubs: clubs.slice(0, 3),
        outings: outings.slice(0, 2),
        members: members.slice(0, 2),
        posts: posts.slice(0, 2),
        gear: vaultGear.slice(0, 2),
      };
    }

    const dedupeById = <T extends { id: string }>(local: T[], remote: T[]) => {
      const seen = new Set<string>();
      const out: T[] = [];
      for (const item of [...local, ...remote]) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          out.push(item);
        }
      }
      return out;
    };

    const allClubs = dedupeById(clubs, remoteClubs);
    const allOutings = dedupeById(outings, remoteOutings);

    return {
      clubs: allClubs
        .map((c) => ({ item: c, s: score(c.name, `${c.massif} ${c.category} ${c.bio}`) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.item),
      outings: allOutings
        .map((o) => ({
          item: o,
          s:
            q === 'covoit' && o.carpoolSeatsLeft > 0
              ? 3
              : score(o.title, `${o.massif} ${o.carpoolCity} ${o.requiredGear.join(' ')}`),
        }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.item),
      members: members
        .map((m) => ({
          item: m,
          s:
            q.includes('week-end') && m.availableWeekend
              ? 3
              : score(m.name, `${m.handle} ${m.role} ${m.massif} ${m.skills.join(' ')} ${m.seekingObjective || ''}`),
        }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.item),
      posts: posts
        .map((p) => ({ item: p, s: score(p.spot, `${p.caption} ${p.authorName} ${p.massif}`) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.item),
      gear: vaultGear
        .map((g) => ({ item: g, s: score(g.name, `${g.brand} ${g.category} ${g.ownerName}`) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.item),
    };
  }, [clubs, members, outings, posts, remoteClubs, remoteOutings, searchQuery, vaultGear]);

  const counts = {
    all:
      searchResults.clubs.length +
      searchResults.outings.length +
      searchResults.members.length +
      searchResults.posts.length +
      searchResults.gear.length,
    clubs: searchResults.clubs.length,
    outings: searchResults.outings.length,
    members: searchResults.members.length,
    posts: searchResults.posts.length,
    gear: searchResults.gear.length,
  };

  const showGroup = (key: Exclude<SearchScope, 'all'>) => scope === 'all' || scope === key;
  const limitFor = <T,>(key: string, arr: T[]) => (expandedGroups[key] ? arr : arr.slice(0, 4));

  const openPostResult = (p: ClubFeedPostItem) => {
    saveRecentQuery(searchQuery);
    if (p.outingId) {
      const linked = outings.find((o) => o.id === p.outingId);
      if (linked) {
        onSwitchTabAndLens(2, 0, { inspectOuting: linked });
        return;
      }
    }
    onClose();
    if (typeof document !== 'undefined') {
      const target = document.getElementById(`club-feed-post-${p.id}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (typeof p.lat === 'number' && typeof p.lng === 'number') {
      onFlyToCoords(p.lat, p.lng, `${p.spot} · ${p.massif}`);
    }
  };

  if (!active || typeof ResizeObserver === 'undefined') {
    return (
      <div className="club-drawer-pane-content">
        <div className="club-search-box-v2" style={{ marginBottom: 8 }}>
          <Search size={15} color="#17402c" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            data-autofocus="true"
            className="club-search-input"
            placeholder="Chercher un club, une sortie, un membre, un spot…"
            aria-label="Rechercher dans les clubs"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="club-drawer-pane-content">
      <Cmd.CommandRoot loop shouldFilter={false}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <div className="club-search-box-v2" style={{ flex: 1, minWidth: 0, marginBottom: 0 }}>
            <Search size={15} color="#17402c" aria-hidden="true" />
            <Cmd.CommandInput
              ref={inputRef}
              data-autofocus="true"
              className="club-search-input"
              placeholder="Chercher un club, une sortie, un membre, un spot…"
              aria-label="Rechercher dans les clubs"
              value={searchQuery}
              onValueChange={onSearchQueryChange}
            />
            {remoteSearching ? (
              <span style={{ fontSize: 11, color: '#56665d' }} aria-label="Recherche en cours">…</span>
            ) : null}
            {searchQuery ? (
              <button
                type="button"
                className="club-search-clear-btn"
                onClick={() => onSearchQueryChange('')}
                aria-label="Effacer la recherche"
              >
                <X size={13} aria-hidden="true" />
              </button>
            ) : (
              <span className="club-kbd-hint" aria-hidden="true">⌘K</span>
            )}
          </div>
          <ClubFilterPopoverButton<SearchScope>
            value={scope}
            defaultValue="all"
            ariaLabel="Filtrer la recherche par catégorie"
            onChange={setScope}
            options={[
              { id: 'all', label: 'Tout chercher', count: searchQuery.trim() ? counts.all : undefined },
              { id: 'clubs', label: 'Clubs', count: searchQuery.trim() ? counts.clubs : undefined },
              { id: 'outings', label: 'Sorties & GPX', count: searchQuery.trim() ? counts.outings : undefined },
              { id: 'members', label: 'Membres', count: searchQuery.trim() ? counts.members : undefined },
              { id: 'posts', label: 'Publications', count: searchQuery.trim() ? counts.posts : undefined },
              { id: 'gear', label: 'Coffre matériel', count: searchQuery.trim() ? counts.gear : undefined },
            ]}
          />
        </div>

        {remoteOffline ? (
          <div className="club-badge-amber" style={{ marginBottom: 8, width: '100%', justifyContent: 'center', padding: '6px 10px' }}>
            Recherche locale uniquement (connexion limitée)
          </div>
        ) : null}

        <div className="sr-only" aria-live="polite">
          {liveAnnouncement.trim().length >= 2 ? `${counts.all} résultats pour ${liveAnnouncement}` : ''}
        </div>

        {!searchQuery.trim() ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 8 }}>
            {recentQueries.length > 0 ? (
              <div>
                <div className="club-sec-head" style={{ marginBottom: 4 }}>
                  <span className="club-sec-eyebrow">Recherches récentes</span>
                  <button
                    type="button"
                    style={{ border: 0, background: 'none', fontSize: 11, color: '#56665d', cursor: 'pointer' }}
                    onClick={() => setRecentQueries([])}
                  >
                    Effacer
                  </button>
                </div>
                <div className="club-filter-rail" data-hscroll="true">
                  {recentQueries.map((rq) => (
                    <button
                      key={rq}
                      type="button"
                      className="club-filter-pill"
                      onClick={() => onSearchQueryChange(rq)}
                    >
                      <span>{rq}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <span className="club-sec-eyebrow" style={{ display: 'block', marginBottom: 4 }}>
                Suggestions rapides
              </span>
              <div className="club-filter-rail" data-hscroll="true">
                {SMART_SEARCH_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="club-filter-pill"
                    onClick={() => onSearchQueryChange(preset.query)}
                  >
                    <Sparkles size={11} color="#17402c" aria-hidden="true" />
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 11.5, color: '#56665d', marginBottom: 6, fontVariantNumeric: 'tabular-nums' }}>
            <AnimatedNumber value={counts.all} /> résultat{counts.all > 1 ? 's' : ''}
          </div>
        )}

        <Cmd.CommandList style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {counts.all === 0 && searchQuery.trim().length > 0 ? (
            <ClubEmptyCard
              icon={<Search size={22} />}
              title="Aucun résultat trouvé"
              description={`Rien ne correspond à « ${searchQuery} » dans les clubs, sorties, membres, publications ou le coffre.`}
              actions={
                <button type="button" className="lkdv-carnet-btn-soft" onClick={() => onSearchQueryChange('')}>
                  Effacer la recherche
                </button>
              }
            />
          ) : null}

          {showGroup('clubs') && searchResults.clubs.length > 0 ? (
            <Cmd.CommandGroup
              heading={`Clubs · ${searchResults.clubs.length}`}
              style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              {limitFor('clubs', searchResults.clubs).map((c) => (
                <Cmd.CommandItem
                  key={c.id}
                  value={`club-${c.id}-${c.name}`}
                  className="reseau-user-row club-switch-row club-glass-card club-cmd-item"
                  onSelect={() => {
                    saveRecentQuery(searchQuery);
                    onSelectClub(c.id);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                    <ClubCoverImage coverUrl={c.coverUrl} name={c.name} className="club-mini-emblem-v2" />
                    <div className="reseau-meta">
                      <div className="reseau-name-row" style={{ gap: 5 }}>
                        <b><HighlightedText text={c.name} query={searchQuery} /></b>
                        {c.joined ? <span className="club-badge-sage">Rejoint</span> : null}
                      </div>
                      <div className="reseau-sub">
                        {c.massif} · {c.membersCount} membres · {c.outingsCount} sorties
                      </div>
                    </div>
                    <ArrowUpRight size={15} color="#17402c" aria-hidden="true" />
                  </div>
                </Cmd.CommandItem>
              ))}
              {searchResults.clubs.length > 4 && !expandedGroups.clubs ? (
                <button
                  type="button"
                  className="lkdv-carnet-btn-soft"
                  style={{ height: 30, fontSize: 11.5, alignSelf: 'flex-start' }}
                  onClick={() => setExpandedGroups((p) => ({ ...p, clubs: true }))}
                >
                  Tout voir ({searchResults.clubs.length})
                </button>
              ) : null}
            </Cmd.CommandGroup>
          ) : null}

          {showGroup('outings') && searchResults.outings.length > 0 ? (
            <Cmd.CommandGroup
              heading={`Sorties & Traces GPX · ${searchResults.outings.length}`}
              style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              {limitFor('outings', searchResults.outings).map((o) => (
                <Cmd.CommandItem
                  key={o.id}
                  value={`outing-${o.id}-${o.title}`}
                  className="club-glass-card club-cmd-item"
                  onSelect={() => {
                    saveRecentQuery(searchQuery);
                    onSwitchTabAndLens(2, 0, { inspectOuting: o });
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                    <span
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: '#d3ebd9',
                        color: '#17402c',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 'none',
                      }}
                    >
                      <Mountain size={16} aria-hidden="true" />
                    </span>
                    <div className="reseau-meta">
                      <b style={{ fontSize: 13 }}><HighlightedText text={o.title} query={searchQuery} /></b>
                      <div className="reseau-sub" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                        <span>{o.date}</span>
                        <span>· {o.massif}</span>
                        <span>· {o.km} km · +{o.dplus} m</span>
                        {o.carpoolSeatsLeft > 0 ? (
                          <span className="club-badge-sage">Covoit {o.carpoolSeatsLeft} pl.</span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="reseau-btn active club-icon-pill"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                        onFlyToCoords(o.lat, o.lng, o.title);
                      }}
                      aria-label={`Centrer la carte sur ${o.title}`}
                    >
                      <Route size={14} aria-hidden="true" />
                    </button>
                  </div>
                </Cmd.CommandItem>
              ))}
              {searchResults.outings.length > 4 && !expandedGroups.outings ? (
                <button
                  type="button"
                  className="lkdv-carnet-btn-soft"
                  style={{ height: 30, fontSize: 11.5, alignSelf: 'flex-start' }}
                  onClick={() => setExpandedGroups((p) => ({ ...p, outings: true }))}
                >
                  Tout voir ({searchResults.outings.length})
                </button>
              ) : null}
            </Cmd.CommandGroup>
          ) : null}

          {showGroup('members') && searchResults.members.length > 0 ? (
            <Cmd.CommandGroup
              heading={`Membres de la cordée · ${searchResults.members.length}`}
              style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              {limitFor('members', searchResults.members).map((m) => (
                <Cmd.CommandItem
                  key={m.id}
                  value={`member-${m.id}-${m.name}`}
                  className="reseau-user-row club-glass-card club-cmd-item"
                  onSelect={() => {
                    saveRecentQuery(searchQuery);
                    onSwitchTabAndLens(1, 0, { inspectMember: m });
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                    <span className="lkdv-carnet-crew-avatar" style={{ width: 36, height: 36 }}>
                      {m.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.avatarUrl} alt="" />
                      ) : (
                        m.name.charAt(0).toUpperCase()
                      )}
                    </span>
                    <div className="reseau-meta">
                      <div className="reseau-name-row" style={{ gap: 5 }}>
                        <b><HighlightedText text={m.name} query={searchQuery} /></b>
                        <span className="reseau-handle">@{m.handle}</span>
                        <span className="club-badge-soft">{m.role}</span>
                      </div>
                      <div className="reseau-sub">
                        {m.massif} · {(m.skills ?? []).slice(0, 3).join(' · ')}
                      </div>
                    </div>
                    <UserRound size={15} color="#17402c" aria-hidden="true" />
                  </div>
                </Cmd.CommandItem>
              ))}
            </Cmd.CommandGroup>
          ) : null}

          {showGroup('posts') && searchResults.posts.length > 0 ? (
            <Cmd.CommandGroup
              heading={`Publications & Spots · ${searchResults.posts.length}`}
              style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              {limitFor('posts', searchResults.posts).map((p) => (
                <Cmd.CommandItem
                  key={p.id}
                  value={`post-${p.id}-${p.spot}`}
                  className="club-post-result-card club-cmd-item"
                  onSelect={() => openPostResult(p)}
                >
                  <span className="club-post-thumb">
                    {p.mediaUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.mediaUrl} alt="" loading="lazy" />
                    ) : (
                      <FileText size={16} aria-hidden="true" />
                    )}
                  </span>
                  <div className="reseau-meta">
                    <div className="reseau-name-row" style={{ gap: 5 }}>
                      <b><HighlightedText text={p.spot || p.massif} query={searchQuery} /></b>
                      {p.pinned ? <span className="club-badge-forest">Épinglé</span> : null}
                      <span className="club-badge-soft">{p.kind}</span>
                    </div>
                    <p
                      style={{
                        margin: '2px 0',
                        fontSize: 12,
                        color: '#56665d',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      <HighlightedText text={p.caption} query={searchQuery} />
                    </p>
                    <span className="reseau-sub">Par {p.authorName} · {p.timeAgo}</span>
                  </div>
                  <ArrowUpRight size={15} color="#17402c" aria-hidden="true" />
                </Cmd.CommandItem>
              ))}
            </Cmd.CommandGroup>
          ) : null}

          {showGroup('gear') && searchResults.gear.length > 0 ? (
            <Cmd.CommandGroup
              heading={`Équipements du coffre · ${searchResults.gear.length}`}
              style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              {limitFor('gear', searchResults.gear).map((g: ClubGearVaultItem) => (
                <Cmd.CommandItem
                  key={g.id}
                  value={`gear-${g.id}-${g.name}`}
                  className="club-glass-card club-cmd-item"
                  onSelect={() => {
                    saveRecentQuery(searchQuery);
                    onSwitchTabAndLens(3, 0, { highlightGearId: g.id });
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                    <span
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: 'rgba(27,67,50,0.09)',
                        color: '#17402c',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 'none',
                      }}
                    >
                      <Package size={16} aria-hidden="true" />
                    </span>
                    <div className="reseau-meta">
                      <div className="reseau-name-row" style={{ gap: 5 }}>
                        <b><HighlightedText text={g.name} query={searchQuery} /></b>
                        <span className={g.available ? 'club-badge-sage' : 'club-badge-amber'}>
                          {g.available ? 'Disponible' : 'Prêté'}
                        </span>
                      </div>
                      <div className="reseau-sub" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {g.brand} · {g.weightG} g · {g.ownerName}
                      </div>
                    </div>
                    {onBorrowGear && g.available ? (
                      <button
                        type="button"
                        className="reseau-btn primary club-icon-pill"
                        style={{ padding: '0 10px', width: 'auto', fontSize: 11, fontWeight: 700 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onBorrowGear(g.id);
                        }}
                      >
                        Emprunter
                      </button>
                    ) : null}
                  </div>
                </Cmd.CommandItem>
              ))}
            </Cmd.CommandGroup>
          ) : null}
        </Cmd.CommandList>
      </Cmd.CommandRoot>
    </div>
  );
}

export function ClubExplorerDrawerBody(props: ClubExplorerDrawerBodyProps) {
  if (props.lensId === 'discover-clubs') {
    return (
      <AnimatePresence mode="wait">
        <DiscoverClubsPane
          key="discover-clubs"
          active={props.active}
          loading={props.loading}
          activeClub={props.activeClub}
          clubs={props.clubs}
          currentUserId={props.currentUserId}
          onSelectClub={props.onSelectClub}
          onToggleJoinClub={props.onToggleJoinClub}
          onFlyToCoords={props.onFlyToCoords}
          onOpenCreateClub={props.onOpenCreateClub}
          onToast={props.onToast}
        />
      </AnimatePresence>
    );
  }

  if (props.lensId === 'search-all') {
    return (
      <SearchAllPane
        active={props.active}
        initialSearchFocus={props.initialSearchFocus}
        activeClub={props.activeClub}
        clubs={props.clubs}
        members={props.members}
        outings={props.outings}
        posts={props.posts}
        vaultGear={props.vaultGear}
        searchQuery={props.searchQuery}
        onSearchQueryChange={props.onSearchQueryChange}
        onSelectClub={props.onSelectClub}
        onFlyToCoords={props.onFlyToCoords}
        onSwitchTabAndLens={props.onSwitchTabAndLens}
        onBorrowGear={props.onBorrowGear}
        onClose={props.onClose}
      />
    );
  }

  return (
    <MyClubsPane
      loading={props.loading}
      activeClub={props.activeClub}
      clubs={props.clubs}
      members={props.members}
      outings={props.outings}
      onSelectClub={props.onSelectClub}
      onToggleJoinClub={props.onToggleJoinClub}
      onFlyToCoords={props.onFlyToCoords}
      onSwitchLens={props.onSwitchLens}
      onSwitchTabAndLens={props.onSwitchTabAndLens}
      onOpenCreateClub={props.onOpenCreateClub}
      onToast={props.onToast}
    />
  );
}

export default ClubExplorerDrawerBody;
