'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { CommunitySheetShell, type SheetDetail } from '../shared/CommunitySheetShell';
import { DynamicIsland } from '@/components/ui/drawer/DynamicIsland';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSessionMemory } from '../shared/useSessionMemory';
import { resolveFocusTarget, restoreFocus } from '../shared/focus';
import type {
  CarnetCardVM,
  ClubCardVM,
  ClubJoinRequestVM,
  EventCardVM,
  EventRegistration,
  ExploreTab,
  MemberStatus,
  SearchHitVM,
  SearchScope,
} from '../shared/types';
import {
  CARNET_FILTER_ITEMS,
  CARNET_FILTERS,
  CARNET_SORT_OPTIONS,
  CLUB_FILTER_ITEMS,
  CLUB_FILTERS,
  CLUB_SORT_OPTIONS,
  EVENT_FILTER_ITEMS,
  EVENT_FILTERS,
  EXPLORE_CAPSULE_ITEMS,
  EXPLORE_TAB_ORDER,
  SEARCH_SCOPE_ITEMS,
  SEARCH_SCOPES,
  filterIndex,
} from './ExploreCapsule';
import { useExploreState } from './useExploreState';
import { useNearMe } from './useNearMe';
import { useCarnetsFeed } from '../data/useCarnetsFeed';
import { useClubsFeed } from '../data/useClubsFeed';
import { useEventsFeed } from '../data/useEventsFeed';
import { useEventAgenda } from '../data/useEventAgenda';
import {
  cancelJoinRequest,
  joinClub,
  joinEvent,
  leaveClub,
  leaveEvent,
  reviewJoinRequest,
  setCarnetLike,
} from '../data/communityMutations';
import { activityLabel } from '../data/communityFeedMappers';
import { CarnetsPane } from './panes/CarnetsPane';
import { ClubsPane, effectiveClubMembers, effectiveClubStatus } from './panes/ClubsPane';
import { EventsPane, effectiveEventState } from './panes/EventsPane';
import { SearchPane } from './panes/SearchPane';
import { ClubDetailView } from './details/ClubDetailView';
import { EventDetailView } from './details/EventDetailView';
import { PeekOverlay, type PeekItem } from './details/PeekOverlay';
import './explore-v2.css';

export type CreateKindV2Param = 'post' | 'story' | 'carnet' | 'sortie' | 'kit' | 'club';

export interface CommunityExploreSheetV2Props {
  open: boolean;
  /** Onglet demandé par la page (`recherche` → volet Recherche). */
  initialTab: 'recherche' | 'carnets' | 'clubs' | 'sorties';
  /** Loupe : ouvre Recherche et focalise le champ. */
  initialSearch: boolean;
  user: User | null;
  onClose: () => void;
  onRequireAuth: () => void;
  /** CTA des états vides : la page bascule sur le tiroir Création. */
  onCreateRequested?: (kind: CreateKindV2Param, prefill?: Record<string, unknown>) => void;
}

type ExploreDetail =
  | { kind: 'club'; clubs: ClubCardVM[]; index: number }
  | { kind: 'event'; event: EventCardVM };

type PeekState = PeekItem & { opener?: HTMLElement | null };

interface IslandMessage {
  title: string;
  subtitle?: string;
  undo?: { label?: string; onUndo: () => void };
  action?: { label: string; onAction: () => void };
}

const DETAIL_OPEN_DELAY_MS = 40;

/**
 * Pane de filtre montée à la première activation puis conservée. La coque rend
 * toutes les pages du LensPager : sans ce garde, les 6 pans Recherche
 * monteraient 6 hooks de recherche au premier rendu.
 */
function FilterSlot({ active, children }: { active: boolean; children: React.ReactNode }) {
  const [everActive, setEverActive] = useState(active);
  useEffect(() => {
    if (active) setEverActive(true);
  }, [active]);
  return <>{everActive ? children : null}</>;
}

function initialTabToExplore(tab: CommunityExploreSheetV2Props['initialTab']): ExploreTab {
  return tab === 'recherche' ? 'search' : tab;
}

function dateTimeLabel(event: EventCardVM): string {
  return [event.title, event.eventDate].filter(Boolean).join(' · ');
}

/**
 * Tiroir Explorer v2 (Communauté) : coque `/compte` + capsule 4 volets, mini-
 * capsule de filtres, menu de tri, détails empilés, Peek & Pop, île de
 * confirmation, mémoire de session. Les quatre volets sont montés dans le
 * LensPager de la coque.
 */
export function CommunityExploreSheetV2({
  open,
  initialTab,
  initialSearch,
  user,
  onClose,
  onRequireAuth,
  onCreateRequested,
}: CommunityExploreSheetV2Props) {
  const router = useRouter();
  const { haptic } = useHapticFeedback();
  const { isOnline } = useOnlineStatus();
  const explore = useExploreState();
  const nearMe = useNearMe();
  const viewerId = user?.id ?? null;
  const isGuest = !viewerId || user?.is_anonymous === true;

  const [detail, setDetail] = useState<ExploreDetail | null>(null);
  const [peek, setPeek] = useState<PeekState | null>(null);
  const [island, setIsland] = useState<IslandMessage | null>(null);
  const [busyKeys, setBusyKeys] = useState<Record<string, boolean>>({});
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);
  const [clubOverrides, setClubOverrides] = useState<Record<string, MemberStatus>>({});
  const [eventOverrides, setEventOverrides] = useState<Record<string, EventRegistration>>({});
  const [reviewedRequestId, setReviewedRequestId] = useState<string | null>(null);
  const [searchRecents, setSearchRecents] = useSessionMemory<string[]>('cv2:explore:search:recents', []);
  const [saved, setSaved] = useSessionMemory<Record<string, boolean>>('cv2:explore:saved', {});

  const openerRef = useRef<HTMLElement | null>(null);
  const detailWasOpenRef = useRef(false);
  const firstOpenRef = useRef(false);
  // Les aperçus (Peek) sont définis avant les mutations et déclenchent leurs
  // actions plus tard : les refs évitent une dépendance circulaire de hooks.
  const clubActionRef = useRef<{
    join: (club: ClubCardVM) => void;
    leave: (club: ClubCardVM) => void;
    cancel: (club: ClubCardVM) => void;
  }>({ join: () => {}, leave: () => {}, cancel: () => {} });
  const eventActionRef = useRef<{
    signup: (event: EventCardVM) => void;
    leave: (event: EventCardVM) => void;
  }>({ signup: () => {}, leave: () => {} });

  const markBusy = useCallback((key: string, busy: boolean) => {
    setBusyKeys((current) => {
      const next = { ...current };
      if (busy) next[key] = true;
      else delete next[key];
      return next;
    });
  }, []);

  const showIsland = useCallback((message: IslandMessage) => setIsland(message), []);

  // ── Ouverture : volet mémorisé, sauf loupe (Recherche focalisée) ──────────
  const setTab = explore.setTab;
  useEffect(() => {
    if (!open) return;
    if (!firstOpenRef.current) {
      firstOpenRef.current = true;
      setTab(initialTabToExplore(initialTab));
    }
    if (initialSearch) setTab('search');
  }, [open, initialSearch, initialTab, setTab]);

  // ── « Près de moi » : position demandée au premier usage ────────────────
  const wantsNear =
    (explore.tab === 'carnets' && explore.carnetFilter === 'near') ||
    (explore.tab === 'clubs' && explore.clubFilter === 'near') ||
    (explore.tab === 'sorties' && explore.eventFilter === 'near') ||
    (explore.tab === 'search' && explore.searchContext.includes('near'));

  useEffect(() => {
    if (!open || !wantsNear || nearMe.state !== 'idle') return;
    void nearMe.request();
  }, [nearMe, open, wantsNear]);

  // ── Feeds (chargés à la première visite du volet, puis conservés) ────────
  const carnetsNear = explore.carnetFilter === 'near' ? nearMe.point : null;
  const clubsNear = explore.clubFilter === 'near' ? nearMe.point : null;
  const eventsNear = explore.eventFilter === 'near' ? nearMe.point : null;

  const carnetsFeed = useCarnetsFeed({
    filter: explore.carnetFilter,
    sort: explore.carnetSort,
    near: carnetsNear,
    enabled: open && explore.tab === 'carnets' && (explore.carnetFilter !== 'near' || carnetsNear != null),
  });
  const clubsFeed = useClubsFeed({
    filter: explore.clubFilter,
    sort: explore.clubSort,
    activity: explore.clubActivity,
    near: clubsNear,
    enabled: open && explore.tab === 'clubs' && (explore.clubFilter !== 'near' || clubsNear != null),
  });
  const eventsFeed = useEventsFeed({
    filter: explore.eventFilter,
    day: explore.eventDay,
    near: eventsNear,
    enabled: open && explore.tab === 'sorties' && (explore.eventFilter !== 'near' || eventsNear != null),
  });
  const agenda = useEventAgenda(14, open && explore.tab === 'sorties');

  // ── Focus : ‹ Retour à l'ouverture d'un détail, retour à la tuile sinon ──
  // FID-081 : la tuile est un `<article>` (appui long) souvent non focusable ;
  // `resolveFocusTarget` retombe sur son lien interne, puis sur l'onglet actif
  // de la capsule. Les reprises rAF + timers sont celles de la coque (J-13).
  const explorerFocusFallback = useCallback(
    () =>
      document.querySelector<HTMLElement>(
        '.lkdv-communaute-v2 [role="tab"][aria-selected="true"]',
      ) ??
      document.querySelector<HTMLElement>('.lkdv-communaute-v2 [data-testid="cv2-sheet"]'),
    [],
  );

  useEffect(() => {
    const hadDetail = detailWasOpenRef.current;
    detailWasOpenRef.current = Boolean(detail);
    if (detail) {
      const timer = window.setTimeout(() => {
        document
          .querySelector<HTMLElement>('.lkdv-cv2-detail [data-testid="cv2-back"]')
          ?.focus({ preventScroll: true });
      }, DETAIL_OPEN_DELAY_MS);
      return () => window.clearTimeout(timer);
    }
    if (hadDetail) {
      return restoreFocus(
        () => resolveFocusTarget(openerRef.current) ?? explorerFocusFallback(),
      );
    }
    return undefined;
  }, [detail, explorerFocusFallback]);

  const closeDetail = useCallback(() => setDetail(null), []);

  /**
   * Ferme l'aperçu et rend le focus : d'abord au `‹ Retour` du détail que
   * l'action vient d'ouvrir (maquette : `openDetail` remplace `SROOT`), sinon
   * à la tuile/au déclencheur, sinon à l'onglet actif de la capsule.
   */
  const closePeek = useCallback(() => {
    const opener = peek?.opener ?? null;
    setPeek(null);
    restoreFocus(() => {
      const back = document.querySelector<HTMLElement>('.lkdv-cv2-detail [data-testid="cv2-back"]');
      return back ?? resolveFocusTarget(opener) ?? explorerFocusFallback();
    });
  }, [explorerFocusFallback, peek]);

  const handleEscape = useCallback(() => {
    if (peek) {
      closePeek();
      return true;
    }
    if (detail) {
      closeDetail();
      return true;
    }
    return false;
  }, [closeDetail, closePeek, detail, peek]);

  // ── Détail empilé ────────────────────────────────────────────────────────
  const openClubDetail = useCallback(
    (club: ClubCardVM, opener?: HTMLElement | null) => {
      const list = clubsFeed.items.some((item) => item.id === club.id) ? clubsFeed.items : [club];
      const index = Math.max(0, list.findIndex((item) => item.id === club.id));
      openerRef.current = opener ?? null;
      haptic('light');
      setDetail({ kind: 'club', clubs: list, index });
    },
    [clubsFeed.items, haptic],
  );

  const openEventDetail = useCallback(
    (event: EventCardVM, opener?: HTMLElement | null) => {
      openerRef.current = opener ?? null;
      haptic('light');
      setDetail({ kind: 'event', event });
    },
    [haptic],
  );

  // ── Partage et enregistrement (Peek) ────────────────────────────────────
  const shareLink = useCallback(
    async (title: string, path: string) => {
      if (typeof window === 'undefined') return;
      const url = `${window.location.origin}${path}`;
      haptic('medium');
      try {
        if (typeof navigator.share === 'function') {
          await navigator.share({ title, url });
          return;
        }
        if (navigator.clipboard) await navigator.clipboard.writeText(url);
        showIsland({ title: 'Lien copié', subtitle: url });
        haptic('success');
      } catch {
        /* partage annulé par la personne */
      }
    },
    [haptic, showIsland],
  );

  const toggleSaved = useCallback(
    (id: string, title: string) => {
      const wasSaved = Boolean(saved[id]);
      setSaved((current) => ({ ...current, [id]: !wasSaved }));
      haptic('light');
      showIsland({
        title: wasSaved ? 'Retiré des enregistrements' : 'Enregistré',
        subtitle: title,
        undo: {
          onUndo: () => setSaved((current) => ({ ...current, [id]: wasSaved })),
        },
      });
    },
    [haptic, saved, setSaved, showIsland],
  );

  // ── « Tout voir » (Carnets#19) ───────────────────────────────────────────
  // Hors « Découvrir » : retour au flux complet (le tri est conservé). Dans
  // « Découvrir » : chargement de la suite jusqu'à la fin du flux.
  const handleCarnetsSeeAll = useCallback(() => {
    haptic('light');
    if (explore.carnetFilter !== 'discover') {
      explore.setCarnetFilter('discover');
      return;
    }
    carnetsFeed.loadMore();
  }, [carnetsFeed, explore, haptic]);

  // ── J'aime de carnet (optimiste + retour arrière) ───────────────────────
  const handleCarnetLike = useCallback(
    async (carnet: CarnetCardVM) => {
      if (isGuest) {
        onRequireAuth();
        return;
      }
      const key = `like:${carnet.id}`;
      if (busyKeys[key]) return;
      const nextLiked = !carnet.likedByMe;
      const apply = (liked: boolean, delta: number) =>
        carnetsFeed.update((items) =>
          items.map((item) =>
            item.id === carnet.id
              ? { ...item, likedByMe: liked, likesCount: Math.max(0, item.likesCount + delta) }
              : item,
          ),
        );
      apply(nextLiked, nextLiked ? 1 : -1);
      markBusy(key, true);
      haptic('medium');
      const result = await setCarnetLike(carnet.id, nextLiked, viewerId as string);
      markBusy(key, false);
      if (!result.ok) {
        apply(!nextLiked, nextLiked ? -1 : 1);
        haptic('error');
        showIsland({ title: 'J’aime impossible', subtitle: result.message });
        return;
      }
      haptic('success');
      showIsland({
        title: nextLiked ? 'Ajouté à tes j’aime' : 'J’aime retiré',
        subtitle: carnet.title,
        undo: {
          onUndo: () => {
            apply(!nextLiked, nextLiked ? -1 : 1);
            void setCarnetLike(carnet.id, !nextLiked, viewerId as string).then((undoResult) => {
              if (!undoResult.ok) {
                apply(nextLiked, nextLiked ? 1 : -1);
                showIsland({ title: 'Retour impossible', subtitle: undoResult.message });
              }
            });
          },
        },
      });
    },
    [busyKeys, carnetsFeed, haptic, isGuest, markBusy, onRequireAuth, showIsland, viewerId],
  );

  // ── Adhésion club ────────────────────────────────────────────────────────
  const setClubOverride = useCallback((clubId: string, status: MemberStatus) => {
    setClubOverrides((current) => ({ ...current, [clubId]: status }));
  }, []);

  const openClubPeek = useCallback(
    (club: ClubCardVM, opener?: HTMLElement | null) => {
      const status = effectiveClubStatus(club, clubOverrides);
      const actions: PeekItem['actions'] =
        status === 'member' || status === 'admin'
          ? [
              { label: 'Voir', icon: 'eye', primary: true, onSelect: () => openClubDetail(club, opener ?? null) },
              { label: 'Quitter le club', icon: 'close', tone: 'danger', onSelect: () => clubActionRef.current.leave(club) },
              { label: 'Partager', icon: 'send', onSelect: () => void shareLink(club.name, `/clubs/${club.slug}`) },
            ]
          : status === 'pending'
            ? [
                { label: 'Voir', icon: 'eye', primary: true, onSelect: () => openClubDetail(club, opener ?? null) },
                {
                  label: 'Annuler la demande',
                  icon: 'close',
                  tone: 'danger',
                  onSelect: () => clubActionRef.current.cancel(club),
                },
                { label: 'Partager', icon: 'send', onSelect: () => void shareLink(club.name, `/clubs/${club.slug}`) },
              ]
            : [
                { label: 'Voir', icon: 'eye', primary: true, onSelect: () => openClubDetail(club, opener ?? null) },
                { label: 'Rejoindre', icon: 'plus', onSelect: () => clubActionRef.current.join(club) },
                { label: 'Partager', icon: 'send', onSelect: () => void shareLink(club.name, `/clubs/${club.slug}`) },
              ];
      haptic('rigid');
      setPeek({
        kind: 'club',
        title: club.name,
        subtitle: [
          activityLabel(club.category),
          club.zoneLabel,
          `${effectiveClubMembers(club, status)} membres`,
        ]
          .filter(Boolean)
          .join(' · '),
        initials: club.name.charAt(0).toUpperCase(),
        crestSeed: club.crestSeed,
        activity: club.category,
        opener: opener ?? null,
        actions,
      });
    },
    [clubOverrides, haptic, openClubDetail, shareLink],
  );

  // ── Inscription sortie ──────────────────────────────────────────────────
  const openEventPeek = useCallback(
    (event: EventCardVM, opener?: HTMLElement | null) => {
      const state = effectiveEventState(event, eventOverrides);
      const actions: PeekItem['actions'] =
        state.status === 'registered' || state.status === 'waitlist'
          ? [
              { label: 'Ouvrir', icon: 'eye', primary: true, onSelect: () => openEventDetail(event, opener ?? null) },
              {
                label: state.status === 'waitlist' ? 'Quitter la liste d’attente' : 'Se désinscrire',
                icon: 'close',
                tone: 'danger',
                onSelect: () => eventActionRef.current.leave(event),
              },
              { label: 'Partager', icon: 'send', onSelect: () => void shareLink(event.title, `/sorties/${event.id}`) },
            ]
          : [
              { label: 'Ouvrir', icon: 'eye', primary: true, onSelect: () => openEventDetail(event, opener ?? null) },
              ...(event.past
                ? []
                : [{ label: 'S’inscrire', icon: 'plus' as const, onSelect: () => eventActionRef.current.signup(event) }]),
              { label: 'Partager', icon: 'send', onSelect: () => void shareLink(event.title, `/sorties/${event.id}`) },
            ];
      haptic('rigid');
      setPeek({
        kind: 'sortie',
        title: event.title,
        subtitle: [dateTimeLabel(event), event.location].filter(Boolean).join(' · '),
        dateIso: event.startsAt ?? `${event.eventDate}T09:00:00+01:00`,
        opener: opener ?? null,
        actions,
      });
    },
    [eventOverrides, haptic, openEventDetail, shareLink],
  );

  // ── Peek carnet / membre / publication ──────────────────────────────────
  const openCarnetPeek = useCallback(
    (carnet: CarnetCardVM, opener?: HTMLElement | null) => {
      haptic('rigid');
      setPeek({
        kind: 'carnet',
        title: carnet.title,
        subtitle: [carnet.destination, carnet.author.name].filter(Boolean).join(' · '),
        cover: carnet.coverImage,
        initials: carnet.author.initials,
        opener: opener ?? null,
        actions: [
          {
            label: 'Lire',
            icon: 'book',
            primary: true,
            onSelect: () => router.push(`/carnets/${carnet.id}`),
          },
          {
            label: saved[carnet.id] ? 'Retirer des enregistrements' : 'Enregistrer',
            icon: saved[carnet.id] ? 'bookmark-filled' : 'bookmark',
            onSelect: () => toggleSaved(carnet.id, carnet.title),
          },
          {
            label: 'Partager',
            icon: 'send',
            onSelect: () => void shareLink(carnet.title, `/carnets/${carnet.id}`),
          },
        ],
      });
    },
    [haptic, router, saved, shareLink, toggleSaved],
  );

  const openSearchPeek = useCallback(
    (hit: SearchHitVM, opener?: HTMLElement | null) => {
      haptic('rigid');
      setPeek({
        kind: hit.kind,
        title: hit.title,
        subtitle: hit.subtitle,
        cover: hit.cover,
        initials: hit.kind === 'membre' ? hit.title.charAt(0).toUpperCase() : undefined,
        crestSeed: hit.kind === 'club' ? hit.id : undefined,
        activity: hit.kind === 'club' ? hit.subtitle.split(' · ')[0] : undefined,
        dateIso: hit.startsAt,
        opener: opener ?? null,
        actions: [
          { label: 'Ouvrir', icon: 'eye', primary: true, onSelect: () => router.push(hit.href) },
          {
            label: saved[hit.id] ? 'Retirer des enregistrements' : 'Enregistrer',
            icon: saved[hit.id] ? 'bookmark-filled' : 'bookmark',
            onSelect: () => toggleSaved(hit.id, hit.title),
          },
          { label: 'Partager', icon: 'send', onSelect: () => void shareLink(hit.title, hit.href) },
        ],
      });
    },
    [haptic, router, saved, shareLink, toggleSaved],
  );

  // ── Mutations clubs ─────────────────────────────────────────────────────
  const handleClubJoin = useCallback(
    async (club: ClubCardVM) => {
      const status = effectiveClubStatus(club, clubOverrides);
      if (status === 'member' || status === 'admin' || status === 'pending') {
        openClubPeek(club, null);
        return;
      }
      if (isGuest) {
        onRequireAuth();
        return;
      }
      const key = `club:${club.id}`;
      if (busyKeys[key]) return;
      const target: MemberStatus = club.privacy === 'closed' ? 'pending' : 'member';
      setClubOverride(club.id, target);
      markBusy(key, true);
      haptic('light');
      const result = await joinClub(club.id);
      markBusy(key, false);
      if (!result.ok) {
        setClubOverride(club.id, club.myStatus);
        haptic('error');
        showIsland({ title: 'Adhésion impossible', subtitle: result.message });
        return;
      }
      setClubOverride(club.id, result.data);
      haptic('success');
      clubsFeed.refresh();
      showIsland({
        title: result.data === 'pending' ? 'Demande envoyée' : 'Club rejoint',
        subtitle: club.name,
        undo: {
          onUndo: () => {
            setClubOverride(club.id, club.myStatus);
            const rollback =
              result.data === 'pending' ? cancelJoinRequest(club.id) : leaveClub(club.id);
            void rollback.then((undoResult) => {
              if (!undoResult.ok) showIsland({ title: 'Retour impossible', subtitle: undoResult.message });
              clubsFeed.refresh();
            });
          },
        },
      });
    },
    [
      busyKeys,
      clubsFeed,
      clubOverrides,
      haptic,
      isGuest,
      markBusy,
      onRequireAuth,
      openClubPeek,
      setClubOverride,
      showIsland,
    ],
  );

  const handleClubLeave = useCallback(
    async (club: ClubCardVM) => {
      if (isGuest) {
        onRequireAuth();
        return;
      }
      const key = `club:${club.id}`;
      if (busyKeys[key]) return;
      const previous = effectiveClubStatus(club, clubOverrides);
      setClubOverride(club.id, 'none');
      markBusy(key, true);
      haptic('light');
      const result = await leaveClub(club.id);
      markBusy(key, false);
      if (!result.ok) {
        setClubOverride(club.id, previous);
        haptic('error');
        showIsland({ title: 'Impossible de quitter le club', subtitle: result.message });
        return;
      }
      haptic('success');
      clubsFeed.refresh();
      showIsland({
        title: 'Club quitté',
        subtitle: club.name,
        undo: {
          onUndo: () => {
            setClubOverride(club.id, previous);
            void joinClub(club.id).then((undoResult) => {
              if (!undoResult.ok) showIsland({ title: 'Retour impossible', subtitle: undoResult.message });
              clubsFeed.refresh();
            });
          },
        },
      });
    },
    [busyKeys, clubsFeed, clubOverrides, haptic, isGuest, markBusy, onRequireAuth, setClubOverride, showIsland],
  );

  const handleCancelRequest = useCallback(
    async (club: ClubCardVM) => {
      if (isGuest) {
        onRequireAuth();
        return;
      }
      const key = `club:${club.id}`;
      if (busyKeys[key]) return;
      setClubOverride(club.id, 'none');
      markBusy(key, true);
      haptic('light');
      const result = await cancelJoinRequest(club.id);
      markBusy(key, false);
      if (!result.ok) {
        setClubOverride(club.id, 'pending');
        haptic('error');
        showIsland({ title: 'Annulation impossible', subtitle: result.message });
        return;
      }
      haptic('success');
      clubsFeed.refresh();
      showIsland({
        title: 'Demande annulée',
        subtitle: club.name,
        undo: {
          onUndo: () => {
            setClubOverride(club.id, 'pending');
            void joinClub(club.id).then((undoResult) => {
              if (!undoResult.ok) showIsland({ title: 'Retour impossible', subtitle: undoResult.message });
              clubsFeed.refresh();
            });
          },
        },
      });
    },
    [busyKeys, clubsFeed, haptic, isGuest, markBusy, onRequireAuth, setClubOverride, showIsland],
  );

  const handleReviewRequest = useCallback(
    async (clubId: string, request: ClubJoinRequestVM, approve: boolean) => {
      if (reviewingRequestId) return;
      setReviewingRequestId(request.id);
      haptic('light');
      const result = await reviewJoinRequest(request.id, approve);
      setReviewingRequestId(null);
      if (!result.ok) {
        haptic('error');
        showIsland({ title: 'Demande non traitée', subtitle: result.message });
        return;
      }
      haptic('success');
      clubsFeed.refresh();
      showIsland({
        title: approve ? 'Demande acceptée' : 'Demande refusée',
        subtitle: request.user.name,
      });
      // Le détail club retire la demande traitée de sa pile (prop `reviewedRequestId`).
      setReviewedRequestId(request.id);
    },
    [clubsFeed, haptic, reviewingRequestId, showIsland],
  );

  // ── Mutations sorties ──────────────────────────────────────────────────
  const handleEventSignup = useCallback(
    async (event: EventCardVM) => {
      const state = effectiveEventState(event, eventOverrides);
      if (state.status === 'registered' || state.status === 'waitlist') {
        openEventPeek(event, null);
        return;
      }
      if (event.past) return;
      if (isGuest) {
        onRequireAuth();
        return;
      }
      const key = `event:${event.id}`;
      if (busyKeys[key]) return;
      const full = event.maxParticipants > 0 && state.spotsLeft <= 0;
      if (full && !event.waitlistEnabled) return;
      const optimistic: EventRegistration = full ? 'waitlist' : 'registered';
      setEventOverrides((current) => ({ ...current, [event.id]: optimistic }));
      markBusy(key, true);
      haptic('light');
      const result = await joinEvent(event.id);
      markBusy(key, false);
      if (!result.ok) {
        setEventOverrides((current) => ({ ...current, [event.id]: event.myStatus }));
        haptic('error');
        showIsland({ title: 'Inscription impossible', subtitle: result.message });
        return;
      }
      const finalStatus: EventRegistration = result.data.waitlisted ? 'waitlist' : 'registered';
      setEventOverrides((current) => ({ ...current, [event.id]: finalStatus }));
      haptic('success');
      eventsFeed.refresh();
      showIsland({
        title: finalStatus === 'waitlist' ? 'Ajouté à la liste d’attente' : 'Inscription confirmée',
        subtitle: [event.title, event.eventDate].filter(Boolean).join(' · '),
        undo: {
          onUndo: () => {
            setEventOverrides((current) => ({ ...current, [event.id]: event.myStatus }));
            void leaveEvent(event.id).then((undoResult) => {
              if (!undoResult.ok) showIsland({ title: 'Retour impossible', subtitle: undoResult.message });
              eventsFeed.refresh();
            });
          },
        },
      });
    },
    [
      busyKeys,
      eventOverrides,
      eventsFeed,
      haptic,
      isGuest,
      markBusy,
      onRequireAuth,
      openEventPeek,
      showIsland,
    ],
  );

  const handleEventLeave = useCallback(
    async (event: EventCardVM) => {
      if (isGuest) {
        onRequireAuth();
        return;
      }
      const key = `event:${event.id}`;
      if (busyKeys[key]) return;
      const previous = effectiveEventState(event, eventOverrides).status;
      setEventOverrides((current) => ({ ...current, [event.id]: 'none' }));
      markBusy(key, true);
      haptic('light');
      const result = await leaveEvent(event.id);
      markBusy(key, false);
      if (!result.ok) {
        setEventOverrides((current) => ({ ...current, [event.id]: previous }));
        haptic('error');
        showIsland({ title: 'Désinscription impossible', subtitle: result.message });
        return;
      }
      haptic('success');
      eventsFeed.refresh();
      showIsland({
        title: previous === 'waitlist' ? 'Liste d’attente quittée' : 'Inscription annulée',
        subtitle: event.title,
        undo: {
          onUndo: () => {
            setEventOverrides((current) => ({ ...current, [event.id]: previous }));
            void joinEvent(event.id).then((undoResult) => {
              if (!undoResult.ok) showIsland({ title: 'Retour impossible', subtitle: undoResult.message });
              eventsFeed.refresh();
            });
          },
        },
      });
    },
    [busyKeys, eventOverrides, eventsFeed, haptic, isGuest, markBusy, onRequireAuth, showIsland],
  );

  // Les refs d'action pointent sur les mutations réelles (après leur définition).
  useEffect(() => {
    clubActionRef.current = {
      join: (club) => void handleClubJoin(club),
      leave: (club) => void handleClubLeave(club),
      cancel: (club) => void handleCancelRequest(club),
    };
    eventActionRef.current = {
      signup: (event) => void handleEventSignup(event),
      leave: (event) => void handleEventLeave(event),
    };
  }, [handleCancelRequest, handleClubJoin, handleClubLeave, handleEventLeave, handleEventSignup]);

  // ── Recherche : récents et tendances ───────────────────────────────────
  const pushRecentSearch = useCallback(
    (query: string) => {
      const clean = query.trim();
      if (clean.length < 2) return;
      setSearchRecents((current) => [clean, ...current.filter((entry) => entry !== clean)].slice(0, 6));
    },
    [setSearchRecents],
  );

  const deleteRecentSearch = useCallback(
    (query: string) => setSearchRecents((current) => current.filter((entry) => entry !== query)),
    [setSearchRecents],
  );

  // ── Navigation / libellés de la coque ──────────────────────────────────
  const tabIndex = Math.max(0, EXPLORE_TAB_ORDER.indexOf(explore.tab));

  const handleTabChange = useCallback(
    (index: number) => {
      const next = EXPLORE_TAB_ORDER[index];
      if (next) explore.setTab(next);
    },
    [explore],
  );

  const busyIdFor = (prefix: string): string | null => {
    const key = Object.keys(busyKeys).find((entry) => entry.startsWith(prefix) && busyKeys[entry]);
    return key ? key.slice(prefix.length) : null;
  };

  const activeFilterIndex =
    explore.tab === 'search'
      ? filterIndex(SEARCH_SCOPE_ITEMS, explore.searchScope)
      : explore.tab === 'carnets'
        ? filterIndex(CARNET_FILTER_ITEMS, explore.carnetFilter)
        : explore.tab === 'clubs'
          ? filterIndex(CLUB_FILTER_ITEMS, explore.clubFilter)
          : filterIndex(EVENT_FILTER_ITEMS, explore.eventFilter);

  const voletActive = (tab: ExploreTab): boolean => open && explore.tab === tab;
  const activeScope = explore.searchScope;
  const activeCarnetFilter = explore.carnetFilter;
  const activeClubFilter = explore.clubFilter;
  const activeEventFilter = explore.eventFilter;

  // ── Une pane par filtre (LensPager de la mini-capsule, `00-MISSION § 3`) ──
  const filterPages: React.ReactNode[][] = [
    SEARCH_SCOPE_ITEMS.map((item, index) => {
      const scope = item.value as SearchScope;
      const paneActive = voletActive('search') && index === activeFilterIndex;
      return (
        <FilterSlot key={item.value} active={paneActive}>
          <SearchPane
            active={paneActive}
            open={open}
            initialSearch={initialSearch && paneActive}
            query={explore.searchQuery}
            scope={scope}
            context={explore.searchContext}
            showMap={explore.searchMap}
            near={nearMe.point}
            nearState={nearMe.state}
            online={isOnline}
            recents={searchRecents}
            onQueryChange={explore.setSearchQuery}
            onScopeChange={explore.setSearchScope}
            onToggleContext={explore.toggleSearchContext}
            onClearContext={explore.clearSearchContext}
            onShowMapChange={explore.setSearchMap}
            onRequestGeo={() => void nearMe.request()}
            onPushRecent={pushRecentSearch}
            onDeleteRecent={deleteRecentSearch}
            onPeek={openSearchPeek}
            onCreateRequested={
              onCreateRequested ? (kind, prefill) => onCreateRequested(kind, prefill) : undefined
            }
          />
        </FilterSlot>
      );
    }),
    CARNET_FILTERS.map((filterValue, index) => {
      const paneActive = voletActive('carnets') && index === activeFilterIndex;
      return (
        <FilterSlot key={filterValue} active={paneActive}>
          <CarnetsPane
            feed={carnetsFeed}
            filter={filterValue}
            sort={explore.carnetSort}
            nearState={nearMe.state}
            nearPointKnown={filterValue !== 'near' || carnetsNear != null}
            online={isOnline}
            likeBusyId={busyIdFor('like:')}
            onLike={(carnet) => void handleCarnetLike(carnet)}
            onPeek={(carnet, opener) => openCarnetPeek(carnet, opener)}
            onCreateCarnet={() => onCreateRequested?.('carnet')}
            onDiscover={() => explore.setCarnetFilter('discover')}
            onRequestGeo={() => void nearMe.request()}
            onSeeAll={handleCarnetsSeeAll}
          />
        </FilterSlot>
      );
    }),
    CLUB_FILTERS.map((filterValue, index) => {
      const paneActive = voletActive('clubs') && index === activeFilterIndex;
      return (
        <FilterSlot key={filterValue} active={paneActive}>
          <ClubsPane
            feed={clubsFeed}
            filter={filterValue}
            sort={explore.clubSort}
            activity={explore.clubActivity}
            nearState={nearMe.state}
            nearPointKnown={filterValue !== 'near' || clubsNear != null}
            online={isOnline}
            overrides={clubOverrides}
            busyClubId={busyIdFor('club:')}
            onActivityChange={explore.setClubActivity}
            onFilterChange={explore.setClubFilter}
            onRequestGeo={() => void nearMe.request()}
            onOpen={(club, opener) => openClubDetail(club, opener)}
            onJoin={(club) => void handleClubJoin(club)}
            onPeek={(club, opener) => openClubPeek(club, opener)}
            onCreateClub={() => onCreateRequested?.('club')}
          />
        </FilterSlot>
      );
    }),
    EVENT_FILTERS.map((filterValue, index) => {
      const paneActive = voletActive('sorties') && index === activeFilterIndex;
      return (
        <FilterSlot key={filterValue} active={paneActive}>
          <EventsPane
            feed={eventsFeed}
            filter={filterValue}
            day={explore.eventDay}
            view={explore.eventView}
            agendaCounts={agenda.counts}
            agendaLoading={agenda.loading}
            agendaError={agenda.error}
            nearState={nearMe.state}
            nearPointKnown={filterValue !== 'near' || eventsNear != null}
            online={isOnline}
            overrides={eventOverrides}
            busyEventId={busyIdFor('event:')}
            onDayChange={explore.setEventDay}
            onViewChange={explore.setEventView}
            onFilterChange={explore.setEventFilter}
            onRequestGeo={() => void nearMe.request()}
            onOpen={(event, opener) => openEventDetail(event, opener)}
            onSignup={(event) => void handleEventSignup(event)}
            onPeek={(event, opener) => openEventPeek(event, opener)}
            onCreateEvent={() => onCreateRequested?.('sortie')}
            onRetryAgenda={agenda.retry}
          />
        </FilterSlot>
      );
    }),
  ];

  const mini = (() => {
    if (explore.tab === 'search') {
      return {
        items: SEARCH_SCOPE_ITEMS.map((item) => ({ id: item.value, label: item.label, icon: item.icon })),
        active: filterIndex(SEARCH_SCOPE_ITEMS, activeScope),
        onChange: (index: number) => explore.setSearchScope(SEARCH_SCOPES[index] ?? 'all'),
        label: 'Filtres des résultats',
        pages: filterPages,
      };
    }
    if (explore.tab === 'carnets') {
      return {
        items: CARNET_FILTER_ITEMS.map((item) => ({ id: item.value, label: item.label, icon: item.icon })),
        active: filterIndex(CARNET_FILTER_ITEMS, activeCarnetFilter),
        onChange: (index: number) => explore.setCarnetFilter(CARNET_FILTERS[index] ?? 'discover'),
        label: 'Filtres des carnets',
        pages: filterPages,
        sort: {
          value: explore.carnetSort,
          defaultValue: 'recent',
          options: CARNET_SORT_OPTIONS,
          onChange: (value: string) => explore.setCarnetSort(value as typeof explore.carnetSort),
        },
      };
    }
    if (explore.tab === 'clubs') {
      return {
        items: CLUB_FILTER_ITEMS.map((item) => ({ id: item.value, label: item.label, icon: item.icon })),
        active: filterIndex(CLUB_FILTER_ITEMS, activeClubFilter),
        onChange: (index: number) => explore.setClubFilter(CLUB_FILTERS[index] ?? 'discover'),
        label: 'Filtres des clubs',
        pages: filterPages,
        sort: {
          value: explore.clubSort,
          defaultValue: 'activity',
          options: CLUB_SORT_OPTIONS,
          onChange: (value: string) => explore.setClubSort(value as typeof explore.clubSort),
        },
      };
    }
    return {
      items: EVENT_FILTER_ITEMS.map((item) => ({ id: item.value, label: item.label, icon: item.icon })),
      active: filterIndex(EVENT_FILTER_ITEMS, activeEventFilter),
      onChange: (index: number) => explore.setEventFilter(EVENT_FILTERS[index] ?? 'discover'),
      label: 'Filtres des sorties',
      pages: filterPages,
    };
  })();

  // Compatibilité coque : quand `mini.pages` est fourni, la coque n'utilise pas
  // `panes` (le LensPager suit la mini-capsule). On garde un tableau de la
  // bonne longueur pour les chemins de repli.
  const panes: React.ReactNode[] = EXPLORE_TAB_ORDER.map(() => null);

  const detailProp: SheetDetail | null = (() => {
    if (!detail) return null;
    if (detail.kind === 'club') {
      const current = detail.clubs[detail.index];
      const pages = detail.clubs.map((club) => {
        const status = effectiveClubStatus(club, clubOverrides);
        return (
          <ClubDetailView
            key={club.id}
            club={club}
            status={status}
            membersCount={effectiveClubMembers(club, status)}
            viewerId={viewerId}
            busy={Boolean(busyKeys[`club:${club.id}`])}
            onJoin={(target) => void handleClubJoin(target)}
            onLeave={(target) => void handleClubLeave(target)}
            onCancelRequest={(target) => void handleCancelRequest(target)}
            onReviewRequest={(clubId, request, approve) => void handleReviewRequest(clubId, request, approve)}
            reviewingRequestId={reviewingRequestId}
            reviewedRequestId={reviewedRequestId}
            onOpenPeek={(target) => openClubPeek(target, null)}
            onOpenEvent={(target) => openEventDetail(target, null)}
            onSignupEvent={(target) => void handleEventSignup(target)}
          />
        );
      });
      return {
        pages,
        index: detail.index,
        onIndexChange: (index: number) => {
          if (index === detail.index) return;
          haptic('selection');
          setDetail({ ...detail, index });
        },
        title: current?.name ?? 'Club',
        meta: `${detail.index + 1} / ${detail.clubs.length}`,
        label: 'Clubs',
        onBack: closeDetail,
      };
    }
    const state = effectiveEventState(detail.event, eventOverrides);
    return {
      pages: [
        <EventDetailView
          key={detail.event.id}
          event={detail.event}
          status={state.status}
          spotsLeft={state.spotsLeft}
          busy={Boolean(busyKeys[`event:${detail.event.id}`])}
          onSignup={(event) => void handleEventSignup(event)}
          viewerId={isGuest ? null : viewerId}
        />,
      ],
      index: 0,
      title: detail.event.title,
      meta: `/sorties/${detail.event.id.slice(0, 8)}`,
      label: 'Sortie',
      onBack: closeDetail,
    };
  })();

  return (
    <CommunitySheetShell
      open={open}
      onClose={onClose}
      kind="explore"
      label="Explorer la communauté"
      guestNotice={isGuest}
      capsule={{
        items: EXPLORE_CAPSULE_ITEMS,
        active: tabIndex,
        onChange: handleTabChange,
        ariaLabel: 'Volets de l’explorateur',
      }}
      mini={mini}
      panes={panes}
      detail={detailProp}
      onEscape={handleEscape}
      island={
        island ? (
          <div className="lkdv-cv2-island-layer" data-testid="cv2-island">
            <DynamicIsland
              open
              title={island.title}
              subtitle={island.subtitle}
              undo={island.undo}
              action={island.action}
              onClose={() => setIsland(null)}
            />
          </div>
        ) : null
      }
    >
      <PeekOverlay peek={peek} onClose={closePeek} />
    </CommunitySheetShell>
  );
}

export default CommunityExploreSheetV2;
