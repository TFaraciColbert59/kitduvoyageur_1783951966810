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
    <div className="club-drawer-pane-content" aria-busy="true" aria-label="Chargement des tribus">
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
  const [sortBy, setSortBy] = useLocalStorageState<MyClubsSort>('lkdv.clubs.myClubsSort', 'active');
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
      if (sortBy === 'active') {
        if (a.id === activeClub.id) return -1;
        if (b.id === activeClub.id) return 1;
        const liveDiff = (b.hasLiveOrImminentOuting ? 1 : 0) - (a.hasLiveOrImminentOuting ? 1 : 0);
        if (liveDiff !== 0) return liveDiff;
        return b.membersCount - a.membersCount;
      }
      if (sortBy === 'next_outing') {
        const aHas = a.outingsCount > 0 ? 1 : 0;
        const bHas = b.outingsCount > 0 ? 1 : 0;
        if (bHas !== aHas) return bHas - aHas;
        return b.outingsCount - a.outingsCount;
      }
      if (sortBy === 'role') {
        const score = (r: string) => (/fondateur|admin/i.test(r) ? 3 : /encadrant|mod/i.test(r) ? 2 : 1);
        return score(b.role) - score(a.role);
      }
      return b.membersCount - a.membersCount;
    });
  }, [activeClub.id, clubs, pinnedIds, sortBy]);

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
                label: 'Quitter la tribu',
                icon: <UserCheck size={17} aria-hidden="true" />,
                danger: true,
                onSelect: () => void handleLeaveClub(peekClub),
              },
            ]
          : []),
      ]
    : [];

  return (
    <div className="club-drawer-pane-content">
      <div className="club-sec-head">
        <div className="club-sec-head-titles">
          <span className="club-sec-eyebrow">Explorer · Mes Tribus</span>
          <b className="club-sec-title">Mes tribus rejointes</b>
        </div>
        <span className="lkdv-carnet-chip-soft" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <AnimatedNumber value={myClubs.length} />
        </span>
      </div>

      {myClubs.length === 0 ? (
        <ClubEmptyCard
          icon={<Compass size={22} />}
          title="Aucun club rejoint pour le moment."
          description="Rejoignez une cordée locale par massif ou fondez votre propre tribu pour partager traces GPX et matériel."
          actions={
            <>
              <button type="button" className="lkdv-carnet-btn-primary" onClick={() => onSwitchLens(1)}>
                <Globe size={14} aria-hidden="true" />
                <span>Découvrir les clubs</span>
              </button>
              <button type="button" className="lkdv-carnet-btn-soft" onClick={() => onOpenCreateClub()}>
                <Plus size={14} aria-hidden="true" />
                <span>Fonder une tribu</span>
              </button>
            </>
          }
        />
      ) : (
        <>
          <div className="lkdv-carnet-kpi-grid-3">
            <div className="lkdv-carnet-kpi-mini">
              <small>Tribus</small>
              <b><AnimatedNumber value={totals.count} /></b>
            </div>
            <div className="lkdv-carnet-kpi-mini">
              <small>Sorties à venir</small>
              <b><AnimatedNumber value={totals.totalOutings} /></b>
            </div>
            <div className="lkdv-carnet-kpi-mini">
              <small>Membres cumulés</small>
              <b><AnimatedNumber value={totals.totalMembers} /></b>
            </div>
          </div>

          {activeInList ? (
            <div className="club-hero-card">
              {activeInList.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activeInList.coverUrl} alt="" className="club-hero-cover-blur" />
              ) : null}
              <div className="club-hero-top">
                <ClubCoverImage coverUrl={activeInList.coverUrl} name={activeInList.name} className="club-hero-emblem" />
                <div className="club-hero-meta">
                  <b>{activeInList.name}</b>
                  <div className="club-hero-badges">
                    <span className="club-badge-forest">Tribu active</span>
                    <span className="club-badge-soft">{activeInList.role}</span>
                    {activeInList.hasLiveOrImminentOuting ? (
                      <span className="lkdv-carnet-live-badge is-live">
                        <span className="lkdv-carnet-live-dot" />
                        Sortie imminente
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="club-hero-kpis">
                <div className="club-hero-kpi">
                  <small>Membres</small>
                  <b><AnimatedNumber value={activeInList.membersCount} /></b>
                </div>
                <div className="club-hero-kpi">
                  <small>Sorties</small>
                  <b><AnimatedNumber value={activeInList.outingsCount} /></b>
                </div>
                <div className="club-hero-kpi">
                  <small>Dénivelé +</small>
                  <b><AnimatedNumber value={activeInList.totalDplus} suffix=" m" /></b>
                </div>
              </div>
              <div className="club-hero-footer">
                {members.length > 0 ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <div className="club-avatar-stack">
                      {members.slice(0, 4).map((m) => (
                        <span key={m.id} className="club-avatar-stack-item" title={m.name}>
                          {m.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.avatarUrl} alt="" />
                          ) : (
                            m.name.charAt(0).toUpperCase()
                          )}
                        </span>
                      ))}
                    </div>
                    <span style={{ fontSize: 11, color: '#56665d', fontWeight: 600 }}>
                      {members.length} en cordée
                    </span>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="club-next-outing-chip"
                  onClick={() => onSwitchTabAndLens(2, 0)}
                >
                  <Calendar size={11} aria-hidden="true" />
                  <span>{activeInList.nextOutingDate} · {activeInList.nextOutingTitle}</span>
                </button>
              </div>
            </div>
          ) : null}

          {myClubs.length > 3 ? (
            <div className="club-filter-rail" data-hscroll="true" role="tablist" aria-label="Trier mes tribus">
              {(
                [
                  { id: 'active', label: 'Actif' },
                  { id: 'recent', label: 'Récents' },
                  { id: 'next_outing', label: 'Prochaine sortie' },
                  { id: 'role', label: 'Mes rôles' },
                ] as const
              ).map((opt) => {
                const active = sortBy === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`club-filter-pill${active ? ' is-active' : ''}`}
                    onClick={() => setSortBy(opt.id)}
                  >
                    {active ? (
                      <motion.span
                        layoutId="club-myclubs-sort-pill"
                        className="club-filter-pill-bg"
                        transition={CLUB_SPRING}
                      />
                    ) : null}
                    <span className="club-filter-pill-label">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {useVirtual ? (
            <div ref={virtualParentRef} style={{ maxHeight: 380, overflowY: 'auto' }}>
              <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map((vRow) => {
                  const club = myClubs[vRow.index];
                  return (
                    <div
                      key={club.id}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${vRow.start}px)`,
                        paddingBottom: 8,
                      }}
                    >
                      <MyClubRowCard
                        club={club}
                        isCurrent={club.id === activeClub.id}
                        isPinned={pinnedIds.includes(club.id)}
                        confirmingLeave={leaveConfirmId === club.id}
                        onOpen={() => onSelectClub(club.id)}
                        onFlyMap={() => {
                          const coords = resolveMassifCoords(club.massif, club.lat, club.lng);
                          onFlyToCoords(coords.lat, coords.lng, `${club.name} · ${club.massif}`);
                        }}
                        onRequestLeaveToggle={() =>
                          club.joined
                            ? setLeaveConfirmId((prev) => (prev === club.id ? null : club.id))
                            : void onToggleJoinClub(club.id)
                        }
                        onConfirmLeave={() => void handleLeaveClub(club)}
                        onCancelLeave={() => setLeaveConfirmId(null)}
                        onPeek={() => setPeekClub(club)}
                        onPrefetch={() => handlePrefetch(club)}
                        onJumpPendingMembers={() => onSwitchTabAndLens(4, 3, { g02Section: 'members' })}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <StaggerList className="reseau-list" role="list" aria-label="Liste des tribus rejointes">
              {managedClubs.length > 0 && memberOnlyClubs.length > 0 ? (
                <span className="lkdv-carnet-kit-eyebrow" style={{ paddingLeft: 4 }}>
                  Tribus administrées ({managedClubs.length})
                </span>
              ) : null}
              {(managedClubs.length > 0 && memberOnlyClubs.length > 0 ? managedClubs : myClubs).map((club) => (
                <MyClubRowCard
                  key={club.id}
                  club={club}
                  isCurrent={club.id === activeClub.id}
                  isPinned={pinnedIds.includes(club.id)}
                  confirmingLeave={leaveConfirmId === club.id}
                  onOpen={() => onSelectClub(club.id)}
                  onFlyMap={() => {
                    const coords = resolveMassifCoords(club.massif, club.lat, club.lng);
                    onFlyToCoords(coords.lat, coords.lng, `${club.name} · ${club.massif}`);
                  }}
                  onRequestLeaveToggle={() =>
                    club.joined
                      ? setLeaveConfirmId((prev) => (prev === club.id ? null : club.id))
                      : void onToggleJoinClub(club.id)
                  }
                  onConfirmLeave={() => void handleLeaveClub(club)}
                  onCancelLeave={() => setLeaveConfirmId(null)}
                  onPeek={() => setPeekClub(club)}
                  onPrefetch={() => handlePrefetch(club)}
                  onJumpPendingMembers={() => onSwitchTabAndLens(4, 3, { g02Section: 'members' })}
                />
              ))}

              {managedClubs.length > 0 && memberOnlyClubs.length > 0 ? (
                <>
                  <span className="lkdv-carnet-kit-eyebrow" style={{ paddingLeft: 4, marginTop: 4 }}>
                    Tribus rejointes ({memberOnlyClubs.length})
                  </span>
                  {memberOnlyClubs.map((club) => (
                    <MyClubRowCard
                      key={club.id}
                      club={club}
                      isCurrent={club.id === activeClub.id}
                      isPinned={pinnedIds.includes(club.id)}
                      confirmingLeave={leaveConfirmId === club.id}
                      onOpen={() => onSelectClub(club.id)}
                      onFlyMap={() => {
                        const coords = resolveMassifCoords(club.massif, club.lat, club.lng);
                        onFlyToCoords(coords.lat, coords.lng, `${club.name} · ${club.massif}`);
                      }}
                      onRequestLeaveToggle={() =>
                        club.joined
                          ? setLeaveConfirmId((prev) => (prev === club.id ? null : club.id))
                          : void onToggleJoinClub(club.id)
                      }
                      onConfirmLeave={() => void handleLeaveClub(club)}
                      onCancelLeave={() => setLeaveConfirmId(null)}
                      onPeek={() => setPeekClub(club)}
                      onPrefetch={() => handlePrefetch(club)}
                      onJumpPendingMembers={() => onSwitchTabAndLens(4, 3, { g02Section: 'members' })}
                    />
                  ))}
                </>
              ) : null}
            </StaggerList>
          )}
        </>
      )}

      <button
        type="button"
        className="lkdv-carnet-btn-soft"
        style={{ width: '100%', justifyContent: 'center', height: 38 }}
        onClick={() => onOpenCreateClub()}
      >
        <Plus size={15} aria-hidden="true" />
        <span>Fonder une nouvelle tribu</span>
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
          bio: r.description || 'Tribu outdoor LKDV.',
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
                style={{ padding: '0 10px', width: 'auto', fontSize: 11.5, fontWeight: 700 }}
                onClick={() => {
                  if (needsPrompt) {
                    setJoinPromptClubId((prev) => (prev === c.id ? null : c.id));
                  } else {
                    void onToggleJoinClub(c.id);
                  }
                }}
              >
                {c.joined ? 'Membre ✓' : isPrivate ? 'Candidater' : 'Rejoindre'}
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
      <div className="club-sec-head">
        <div className="club-sec-head-titles">
          <span className="club-sec-eyebrow">Explorer · Découverte</span>
          <b className="club-sec-title">Découvrir tous les clubs</b>
        </div>
        <span className="lkdv-carnet-chip-soft" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <AnimatedNumber value={filteredList.length} />
        </span>
      </div>

      <div className="club-search-box-v2 is-compact">
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

      <div className="club-filter-rail" data-hscroll="true" role="tablist" aria-label="Filtrer par massif ou sport">
        {DISCOVER_FILTER_CHIPS.map((chip) => {
          const isCurrent = filterChip === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              role="tab"
              aria-selected={isCurrent}
              className={`club-filter-pill${isCurrent ? ' is-active' : ''}`}
              onClick={() => setFilterChip(chip.id)}
            >
              {isCurrent ? (
                <motion.span
                  layoutId="club-discover-filter-pill"
                  className="club-filter-pill-bg"
                  transition={CLUB_SPRING}
                />
              ) : null}
              <span className="club-filter-pill-label">{chip.label}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', gap: 4 }}>
          {(
            [
              { id: 'popular', label: 'Populaire' },
              { id: 'massif', label: 'Par massif' },
              { id: 'recent', label: 'Récents' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              className={viewMode === m.id ? 'club-badge-forest' : 'club-badge-soft'}
              style={{ border: 0, cursor: 'pointer', padding: '4px 9px' }}
              onClick={() => setViewMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={onlyUnjoined ? 'club-badge-forest' : 'club-badge-soft'}
          style={{ border: 0, cursor: 'pointer', padding: '4px 9px' }}
          onClick={() => setOnlyUnjoined((v) => !v)}
        >
          Nouveaux uniquement
        </button>
      </div>

      {spotlightClubs.length > 0 && !quickFilter && filterChip === 'all' ? (
        <div className="club-voyage-rail" data-hscroll="true" aria-label="Tribus recommandées">
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
            onFlyToCoords(coords.lat, coords.lng, `Carte des clubs · ${filteredList.length} tribus`);
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
            aria-label="Rechercher dans les clubs et la tribu"
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
        <div className="club-search-box-v2" style={{ marginBottom: 8 }}>
          <Search size={15} color="#17402c" aria-hidden="true" />
          <Cmd.CommandInput
            ref={inputRef}
            data-autofocus="true"
            className="club-search-input"
            placeholder="Chercher un club, une sortie, un membre, un spot…"
            aria-label="Rechercher dans les clubs et la tribu"
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

        <div className="club-filter-rail" data-hscroll="true" role="tablist" aria-label="Périmètre de recherche" style={{ marginBottom: 8 }}>
          {(
            [
              { id: 'all', label: 'Tout', count: counts.all },
              { id: 'clubs', label: 'Clubs', count: counts.clubs },
              { id: 'outings', label: 'Sorties', count: counts.outings },
              { id: 'members', label: 'Membres', count: counts.members },
              { id: 'posts', label: 'Publications', count: counts.posts },
              { id: 'gear', label: 'Coffre', count: counts.gear },
            ] as const
          ).map((s) => {
            const isCurrent = scope === s.id;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={isCurrent}
                className={`club-filter-pill${isCurrent ? ' is-active' : ''}`}
                onClick={() => setScope(s.id)}
              >
                {isCurrent ? (
                  <motion.span
                    layoutId="club-search-scope-pill"
                    className="club-filter-pill-bg"
                    transition={CLUB_SPRING}
                  />
                ) : null}
                <span className="club-filter-pill-label">
                  <span>{s.label}</span>
                  <span style={{ opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}>{s.count}</span>
                </span>
              </button>
            );
          })}
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
              heading={`Clubs & Tribus · ${searchResults.clubs.length}`}
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
