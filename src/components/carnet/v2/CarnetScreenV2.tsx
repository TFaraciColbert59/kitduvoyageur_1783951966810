'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import type {
  CarnetDetail,
  CarnetMomentEngagementItem,
  CarnetMomentItem,
} from '@/features/carnet/detail/types';
import { CarnetTopBarV2 } from './CarnetTopBarV2';
import { CarnetCardV2 } from './CarnetCardV2';
import { CarnetDrawerV2, type CarnetSlotId } from './CarnetDrawerV2';
import { CarnetIsland, type CarnetIslandToast } from './CarnetIsland';
import { CarnetPeek } from './CarnetPeek';
import { CarnetCreateSheet } from './CarnetCreateSheet';
import { CarnetHighlightEditSheet } from './CarnetHighlightEditSheet';
import { CarnetEditSheet, type CarnetEditTarget } from './CarnetEditSheet';
import { CarnetAltitude } from './CarnetAltitude';
import { CarnetMapBadge } from './CarnetMapBadge';
import { CompteMap } from '@/components/compte/map/CompteMap';
import { DRAWER_V2_CSS } from '@/components/compte/drawer/SlotShell';
import { parsePositions } from '@/features/compte/map/geometry';
import { CarnetPostSheet } from '@/components/carnet/profile/CarnetPostSheet';
import StoriesViewer, {
  type StoryUser,
  type StorySlide,
} from '@/components/communaute/StoriesViewer';
import ReportSheet from '@/components/social/ReportSheet';
import { useCarnetComments } from '@/features/carnet/detail/useCarnetComments';
import { useCarnetEngagement } from '@/features/carnet/detail/useCarnetEngagement';
import { useCarnetLivePosition } from '@/features/carnet/detail/useCarnetLivePosition';
import { elevationProfileGain } from '@/features/carnet/detail/elevationProfile';
import { createClient } from '@/lib/supabase/client';
import { replyToCarnetStory } from '@/lib/stories/carnetReply';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useCarnetEdits } from '@/features/carnet/detail/useCarnetEdits';
import { useCarnetStructureEdits } from '@/features/carnet/detail/useCarnetStructureEdits';
import { useCarnetHighlights, type CarnetHighlight } from '@/features/carnet/detail/highlights';
import { useFollowAuthor } from '@/features/carnet/detail/useFollowAuthor';
import { isParticipantRole } from '@/features/carnet/detail/viewerRole';
import { buildDayTraces, momentPosition, selectMapLayers, type MapContext } from '@/features/carnet/detail/mapLayers';
import type { MomentType } from '@/features/carnet/detail/momentTypes';
import type { StackIntent } from './CarnetDrawerV2';

import '@/styles/tokens.css';
import '@/styles/carnet-v2.css';
import '@/styles/carnet-v2-lenses.css';
import '@/components/compte/compte-apple-hig.css';
import '@/components/compte/compte-v8.css';

export interface CarnetScreenV2Props {
  detail: CarnetDetail;
  /** Banc seulement : force l'état d'erreur d'un slot ou d'une lentille. */
  simulate?: { slot?: boolean; lens?: string } | null;
}

const MAX_UNDO = 40;

export function CarnetScreenV2({ detail: detailProp, simulate = null }: CarnetScreenV2Props) {
  /* La fiche est rendue par le serveur : les écritures du mode modification
     s'appliquent ici tout de suite, puis le prochain chargement les confirme. */
  const [detail, setDetail] = useState<CarnetDetail>(detailProp);
  useEffect(() => setDetail(detailProp), [detailProp]);

  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const { haptic } = useHapticFeedback();
  const currentUserId = user?.id ?? null;
  const canWrite = Boolean(user?.id) && !user?.is_anonymous;

  // Screen State
  const [activeDay, setActiveDay] = useState<number>(0);
  const [mapBig, setMapBig] = useState(false);
  const [outdoor, setOutdoor] = useState(false);
  const [editRequested, setEditRequested] = useState(false);
  const isParticipant = isParticipantRole(detail.viewerRole);
  /* Le mode modification n'existe que pour un participant (spec § 7). */
  const isEditing = editRequested && isParticipant;
  const { isOnline } = useOnlineStatus();
  const [createSheet, setCreateSheet] = useState<{ type: MomentType | null } | null>(null);
  const [hlEdit, setHlEdit] = useState<CarnetHighlight | null>(null);
  const [editTarget, setEditTarget] = useState<CarnetEditTarget | null>(null);
  const detailRef = useRef(detail);
  detailRef.current = detail;
  const [drawerContext, setDrawerContext] = useState<{
    slot: MapContext['slot'];
    lensId: string;
  } | null>(null);
  const [drawerIntent, setDrawerIntent] = useState<{ nonce: number; view: StackIntent } | null>(
    null
  );
  const [pinnedIds, setPinnedIds] = useState<ReadonlySet<string>>(new Set());
  const [reduceMotion, setReduceMotion] = useState(false);
  const grabRef = useRef<{ startY: number; dragged: boolean } | null>(null);
  const suppressGrabClickRef = useRef(false);

  // Drawer & Overlay States
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSlot, setDrawerSlot] = useState<CarnetSlotId>('fil');
  const [isAccountDrawer, setIsAccountDrawer] = useState(false);
  const [postMomentId, setPostMomentId] = useState<string | null>(null);
  const [postSheetPanel, setPostSheetPanel] = useState<'comments' | null>(null);
  const [peekMoment, setPeekMoment] = useState<CarnetMomentItem | null>(null);
  const [scrubPoint, setScrubPoint] = useState<{
    elevationM: number;
    distanceKm: number;
    lat: number;
    lng: number;
  } | null>(null);

  const elevationProfile = detail.elevationProfile ?? [];
  const hasElevationProfile = elevationProfile.length >= 2;
  const profileGain = elevationProfileGain(elevationProfile);
  const profileDistance = hasElevationProfile
    ? elevationProfile[elevationProfile.length - 1].distanceKm
    : null;
  const [storiesOpen, setStoriesOpen] = useState(false);
  /* J'aime des stories : ce sont les j'aime des moments (`carnet_moment_likes`), les mêmes que ceux du post. */
  const [likedStories, setLikedStories] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        Object.values(detailProp.momentEngagement ?? {})
          .filter((entry) => entry.userLiked)
          .map((entry) => entry.momentId)
      )
  );
  /* Signalement : la cible est le carnet (barre haute, menu ··· du post) ou le
     moment affiché dans le Peek. Une seule feuille, une seule cible. */
  const [reportTarget, setReportTarget] = useState<
    { kind: 'carnet' } | { kind: 'moment'; momentId: string } | null
  >(null);
  const reportOpen = reportTarget !== null;
  const supabase = useMemo(() => createClient(), []);

  // Focus point for Map
  const [mapFocus, setMapFocus] = useState<{ lat: number; lng: number; zoom?: number } | null>(
    null
  );

  // Dynamic Island Toast State
  const [islandToast, setIslandToast] = useState<CarnetIslandToast | null>(null);

  const overlayOpen =
    drawerOpen ||
    peekMoment !== null ||
    postMomentId !== null ||
    storiesOpen ||
    reportOpen ||
    createSheet !== null ||
    editTarget !== null ||
    hlEdit !== null;

  /* Les feuilles Radix (post, stories, signalement) ne passent pas par
     `useCarnetDialog` : sans ce crochet, la barre flottante reste au-dessus
     de leur pied et intercepte le bouton d'action. */
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('lkdv-overlay-open', overlayOpen);
    return () => document.body.classList.remove('lkdv-overlay-open');
  }, [overlayOpen]);

  /* Pile d'annulation (maquette `U`) : chaque confirmation annulable s'y empile,
     Ctrl/⌘+Z défait la dernière, 40 au plus. */
  const undoStack = useRef<Array<{ label: string; run: () => void }>>([]);

  const showIsland = useCallback((message: string, undo?: () => void, subtitle?: string) => {
    if (undo) {
      undoStack.current.push({ label: message, run: undo });
      if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    }
    setIslandToast({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      message,
      subtitle,
      undo,
    });
  }, []);

  const doUndo = useCallback((): boolean => {
    const entry = undoStack.current.pop();
    if (!entry) return false;
    entry.run();
    haptic('medium');
    setIslandToast({
      id: `${Date.now()}-undo`,
      message: 'Annulé',
      subtitle: entry.label,
    });
    return true;
  }, [haptic]);

  const dismissIsland = useCallback(() => {
    setIslandToast(null);
  }, []);

  const addMoment = useCallback((moment: CarnetMomentItem) => {
    setDetail((d) => {
      const byDay = (a: CarnetMomentItem, b: CarnetMomentItem) =>
        a.dayNumber - b.dayNumber || (a.time ?? '').localeCompare(b.time ?? '');
      const moments = [...d.moments, moment].sort(byDay);
      return {
        ...d,
        moments,
        photoMoments: moments.filter((m) => Boolean(m.imageUrl)),
        days: d.days.map((day) =>
          (day.dayNumber ?? day.index) === moment.dayNumber
            ? { ...day, moments: moments.filter((m) => m.dayNumber === moment.dayNumber) }
            : day
        ),
        summary: { ...d.summary, moments: moments.length },
      };
    });
  }, []);

  const removeMomentLocal = useCallback((momentId: string) => {
    setDetail((d) => {
      const moments = d.moments.filter((m) => m.id !== momentId);
      return {
        ...d,
        moments,
        photoMoments: moments.filter((m) => Boolean(m.imageUrl)),
        days: d.days.map((day) => ({ ...day, moments: day.moments.filter((m) => m.id !== momentId) })),
        summary: { ...d.summary, moments: moments.length },
      };
    });
  }, []);

  const requireAuth = useCallback(() => {
    toast(user?.id ? 'Créez un compte pour interagir.' : 'Connectez-vous pour continuer.', 'info');
    router.push(`/connexion?next=/carnets/${detail.id}`);
  }, [detail.id, router, toast, user?.id]);

  const viewerRole = detail.viewerRole ?? 'visitor';

  // Live Position / Public Zone hook
  const liveSharingMode = detail.liveSharing
    ? viewerRole === 'participant'
      ? 'participants'
      : 'public'
    : 'off';

  const live = useCarnetLivePosition({
    carnetId: detail.id,
    viewerRole,
    liveSharing: liveSharingMode,
    userId: currentUserId,
    /* Défense en profondeur : un visiteur ne reçoit jamais la position exacte. */
    initialLivePosition: isParticipant ? detail.livePosition : null,
    initialPublicZone: detail.publicZone,
    onIsland: showIsland,
  });

  // Engagement & comments
  const engagement = useCarnetEngagement({
    carnetId: detail.id,
    initial: detail.engagement,
    userId: currentUserId,
    onRequireAuth: requireAuth,
  });

  const comments = useCarnetComments({ carnetId: detail.id, user });

  const edits = useCarnetEdits({
    carnetId: detail.id,
    userId: currentUserId,
    authorName: user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? null,
    onIsland: showIsland,
    onMomentAdded: addMoment,
    onMomentRemoved: removeMomentLocal,
  });

  const structure = useCarnetStructureEdits({
    carnetId: detail.id,
    setDetail,
    getDetail: () => detailRef.current,
    onIsland: showIsland,
  });

  const follow = useFollowAuthor({
    authorId: detail.author?.id ?? null,
    userId: currentUserId,
    onRequireAuth: requireAuth,
    onIsland: showIsland,
  });

  const { highlights, rename: renameHighlight, remove: removeHighlight, restore: restoreHighlight } =
    useCarnetHighlights(detail);

  /* Épingles : préférence de l'appareil (aucune table serveur). */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`lkdv:carnet:${detail.id}:pins`);
      const ids = raw ? (JSON.parse(raw) as unknown) : [];
      setPinnedIds(new Set(Array.isArray(ids) ? ids.filter((v): v is string => typeof v === 'string') : []));
    } catch {
      setPinnedIds(new Set());
    }
  }, [detail.id]);

  const writePins = useCallback(
    (next: Set<string>) => {
      setPinnedIds(next);
      try {
        window.localStorage.setItem(`lkdv:carnet:${detail.id}:pins`, JSON.stringify([...next]));
      } catch {
        /* stockage refusé : l'épingle reste valable pour la session */
      }
    },
    [detail.id]
  );

  const togglePin = useCallback(
    (moment: CarnetMomentItem) => {
      const was = pinnedIds.has(moment.id);
      const next = new Set(pinnedIds);
      if (was) next.delete(moment.id);
      else next.add(moment.id);
      writePins(next);
      showIsland(
        was ? 'Moment désépinglé' : 'Moment épinglé',
        () => {
          const back = new Set(next);
          if (was) back.add(moment.id);
          else back.delete(moment.id);
          writePins(back);
        },
        moment.place ?? undefined
      );
    },
    [pinnedIds, showIsland, writePins]
  );

  /* État vivant des moments. La fiche n'est pas rechargée après une action :
     sans ce cache, un j'aime posé dans le Peek réapparaîtrait non aimé en le
     rouvrant, et le post du même moment l'insérerait une seconde fois. */
  const momentsLive = useRef<
    Record<string, { liked: boolean; likesCount: number; saved: boolean; savesCount: number }>
  >({});

  const momentEngagementFor = useCallback(
    (momentId: string): CarnetMomentEngagementItem => {
      const base = detail.momentEngagement?.[momentId];
      const live = momentsLive.current[momentId];
      return {
        momentId,
        likesCount: live?.likesCount ?? base?.likesCount ?? 0,
        commentsCount: base?.commentsCount ?? 0,
        userLiked: live?.liked ?? base?.userLiked ?? false,
        userSaved: live?.saved ?? base?.userSaved ?? false,
        savesCount: live?.savesCount ?? base?.savesCount ?? 0,
      };
    },
    [detail.momentEngagement]
  );

  const rememberMomentEngagement = useCallback(
    (state: {
      momentId: string;
      liked: boolean;
      likesCount: number;
      saved: boolean;
      savesCount: number;
    }) => {
      momentsLive.current[state.momentId] = state;
    },
    []
  );

  /* Le post d'un moment photo navigue entre les médias ; un moment sans image
     s'ouvre seul (variante texte du post). */
  const postMoment = detail.moments.find((m) => m.id === postMomentId) ?? null;
  const postItems = useMemo(
    () => (postMoment ? (postMoment.imageUrl ? detail.photoMoments : [postMoment]) : []),
    [detail.photoMoments, postMoment]
  );
  const postIndex = Math.max(0, postItems.findIndex((m) => m.id === postMomentId));
  const postDetail = useMemo(() => ({ ...detail, photoMoments: postItems }), [detail, postItems]);
  const openPost = useCallback((moment: CarnetMomentItem) => setPostMomentId(moment.id), []);

  /* Signalement d'un moment : `post_reports.post_id` porte une FK vers
     `community_posts` en production, un id de moment y serait rejeté (23503).
     On écrit donc dans la table polymorphe `comment_reports`, avec le type
     réel dans `table_name` — c'est le repli déjà utilisé par le fil. */
  const handleSubmitReport = useCallback(
    async (reason: string, details?: string) => {
      const target = reportTarget;
      if (!target) return;
      if (!currentUserId || !canWrite) {
        requireAuth();
        throw new Error('Connexion requise');
      }
      /* Même table polymorphe pour les deux cibles : un carnet n'a pas de
         table de signalement dédiée, et `comment_id` n'a pas de FK. */
      const targetId = target.kind === 'carnet' ? detail.id : target.momentId;
      const tableName = target.kind === 'carnet' ? 'carnets' : 'carnet_moments';
      const { error } = await supabase.from('comment_reports').insert({
        comment_id: targetId,
        reporter_id: currentUserId,
        reason: details ? `${reason} — ${details}` : reason,
        table_name: tableName,
      });
      if (error) {
        showIsland('Le signalement n’a pas pu être envoyé');
        throw new Error(error.message);
      }
      showIsland('Signalement envoyé');
      setReportTarget(null);
    },
    [canWrite, currentUserId, reportTarget, requireAuth, showIsland, supabase]
  );

  // URL query params synchronization (?commentaires=1, ?jour=N&tiroir=X)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('commentaires') === '1') {
      setDrawerSlot('equipage');
      setDrawerOpen(true);
    }
    const dayParam = params.get('jour');
    if (dayParam) {
      const d = parseInt(dayParam, 10);
      if (!Number.isNaN(d) && d >= 0) setActiveDay(d);
    }
    if (params.get('modifier') === '1') {
      setEditRequested(true);
    }
    const tiroirParam = params.get('tiroir');
    if (tiroirParam && ['fil', 'route', 'sac', 'chiffres', 'equipage'].includes(tiroirParam)) {
      setDrawerSlot(tiroirParam as CarnetSlotId);
      setDrawerOpen(true);
    }
  }, []);

  useEffect(() => {
    void engagement.registerView();
  }, [engagement.registerView]);

  // Réduction des animations : préférence OS par défaut, choix explicite
  // conservé dans `localStorage` (popover Affichage).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('lkdv:carnet:reduce-motion');
    if (stored === 'true' || stored === 'false') {
      setReduceMotion(stored === 'true');
      return;
    }
    const query =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    setReduceMotion(query?.matches ?? false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('lkdv:carnet:reduce-motion', String(reduceMotion));
  }, [reduceMotion]);

  // Open Drawer to a specific slot
  const handleOpenDrawerSlot = useCallback(
    (slot: CarnetSlotId, lensIndex?: number) => {
      haptic('light');
      setIsAccountDrawer(false);
      setDrawerSlot(slot);
      if (lensIndex != null) {
        setDrawerIntent({ nonce: Date.now(), view: { type: 'lens', slot, index: lensIndex } });
      }
      setDrawerOpen(true);
    },
    [haptic]
  );

  // Markers for steps and nights on map
  /* Le jour actif recadre la carte sur ses propres points GPS ; sans points
     réels pour ce jour, on garde la trace complète (aucun tracé inventé). */
  const mapTrace = useMemo(() => {
    if (activeDay <= 0) return detail.trace;
    const day = detail.days.find((entry) => (entry.dayNumber ?? entry.index) === activeDay);
    if (!day || day.points.length < 2) return detail.trace;
    return {
      type: 'LineString' as const,
      coordinates: day.points.map((point) => [point.lng, point.lat]),
    };
  }, [activeDay, detail.days, detail.trace]);

  /* Couches de la carte selon le tiroir actif (Fil → moments, Route → étapes ou
     nuits, Sac → objets du kit, Équipage → position). */
  const mapContext: MapContext | null = drawerOpen
    ? (drawerContext ?? { slot: 'fil', lensId: 'moments' })
    : null;
  const layers = useMemo(
    () => selectMapLayers({ detail, activeDay, context: mapContext, scrub: scrubPoint }),
    // `mapContext` est dérivé de deux états déjà listés.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [detail, activeDay, drawerOpen, drawerContext, scrubPoint]
  );
  const dayTraces = useMemo(() => buildDayTraces(detail.days), [detail.days]);

  /* Sans point GPS par jour (anciens carnets), on garde le départ/l'arrivée de la
     trace complète et les nuits : aucune géométrie inventée. */
  const mapMarkers = useMemo(() => {
    if (dayTraces.length > 0) return layers.markers;
    const list: typeof layers.markers = [];
    const tracePoints = parsePositions(detail.trace);
    if (tracePoints.length >= 2) {
      const start = tracePoints[0];
      const end = tracePoints[tracePoints.length - 1];
      list.push(
        { id: 'trace-start', lat: start.lat, lng: start.lng, title: 'Départ', type: 'start' },
        { id: 'trace-end', lat: end.lat, lng: end.lng, title: 'Arrivée', type: 'end' }
      );
    }
    for (const night of detail.nights ?? []) {
      if (night.lat != null && night.lng != null) {
        list.push({
          id: `night-${night.id}`,
          lat: night.lat,
          lng: night.lng,
          title: night.name,
          type: 'night',
          badge: `N${night.dayNumber}`,
        });
      }
    }
    return list.concat(layers.markers.filter((m) => m.type === 'scrub'));
  }, [dayTraces.length, detail.nights, detail.trace, layers]);

  const focusMoment = useCallback(
    (moment: CarnetMomentItem) => {
      const day = detail.days.find((d) => (d.dayNumber ?? d.index) === moment.dayNumber);
      const ofDay = detail.moments.filter((m) => m.dayNumber === moment.dayNumber);
      const position = momentPosition(
        day,
        moment,
        Math.max(0, ofDay.findIndex((m) => m.id === moment.id)),
        ofDay.length
      );
      if (!position) {
        showIsland('Pas de position GPS pour ce moment');
        return;
      }
      if (activeDay > 0 && activeDay !== moment.dayNumber) setActiveDay(moment.dayNumber);
      setMapFocus({ lat: position.lat, lng: position.lng, zoom: 13 });
    },
    [activeDay, detail.days, detail.moments, showIsland]
  );

  const openCreate = useCallback(
    (type?: MomentType) => {
      if (!isParticipant) return;
      haptic('light');
      setCreateSheet({ type: type ?? null });
    },
    [haptic, isParticipant]
  );

  const createDay =
    activeDay > 0
      ? activeDay
      : detail.days.reduce((max, d) => Math.max(max, d.dayNumber ?? d.index), 0) || 1;

  const handleHighlightTap = useCallback(
    (highlight: CarnetHighlight) => {
      setIsAccountDrawer(false);
      if (highlight.kind === 'crew') {
        setDrawerSlot('equipage');
        setDrawerIntent({ nonce: Date.now(), view: { type: 'participant', userId: highlight.refId } });
        setDrawerOpen(true);
        return;
      }
      const etape = detail.etapes.find((e) => e.id === highlight.refId);
      setDrawerSlot('route');
      setDrawerIntent({ nonce: Date.now(), view: { type: 'etape', etapeId: highlight.refId } });
      setDrawerOpen(true);
      if (etape) {
        const day = detail.days.find((d) => (d.dayNumber ?? d.index) === etape.dayNumber);
        const last = day?.points[day.points.length - 1];
        if (last) setMapFocus({ lat: last.lat, lng: last.lng, zoom: 12 });
      }
    },
    [detail.days, detail.etapes]
  );

  /* Clavier : Ctrl/⌘+Z annule la dernière confirmation, ← → changent de jour
     quand rien d'autre n'a la main (maquette, écouteur `keydown` du document). */
  const maxDay = detail.days.reduce((max, d) => Math.max(max, d.dayNumber ?? d.index), 0);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = (target?.tagName ?? '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !typing) {
        if (doUndo()) event.preventDefault();
        return;
      }
      if (typing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (overlayOpen) return;
      if (
        target?.closest?.(
          '[role="tablist"],[role="slider"],[aria-roledescription="carrousel"],[role="menu"],[role="dialog"]'
        )
      ) {
        return;
      }
      event.preventDefault();
      setActiveDay((day) => Math.max(0, Math.min(maxDay, day + (event.key === 'ArrowRight' ? 1 : -1))));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [doUndo, maxDay, overlayOpen]);

  // Prepare Stories users grouped by author
  const storyUsers: StoryUser[] = useMemo(() => {
    const byAuthor = new Map<
      string,
      { id: string; name: string; avatarUrl?: string; slides: StorySlide[] }
    >();

    const defaultAuthor = {
      id: detail.author?.id || 'owner',
      name: detail.author?.name || 'Voyageur',
      avatarUrl: detail.author?.avatarUrl || undefined,
      slides: [] as StorySlide[],
    };
    byAuthor.set(defaultAuthor.id, defaultAuthor);

    for (const moment of detail.photoMoments) {
      if (!moment.imageUrl) continue;
      const authorId = moment.authorId || defaultAuthor.id;
      let userEntry = byAuthor.get(authorId);
      if (!userEntry) {
        const participant = detail.participants.find((p) => p.id === authorId);
        userEntry = {
          id: authorId,
          name: participant?.name || 'Compagnon',
          avatarUrl: participant?.avatarUrl || undefined,
          slides: [],
        };
        byAuthor.set(authorId, userEntry);
      }
      userEntry.slides.push({
        image: moment.imageUrl,
        caption: moment.caption || moment.title || undefined,
        storyId: moment.id,
        mediaType: 'image',
      });
    }

    return Array.from(byAuthor.values()).filter((u) => u.slides.length > 0);
  }, [detail]);

  const handleStoryReply = useCallback(
    async (slide: StorySlide, storyUser: StoryUser, text: string): Promise<boolean> => {
      if (!currentUserId) {
        requireAuth();
        return false;
      }
      const res = await replyToCarnetStory({
        carnetId: detail.id,
        momentId: slide.storyId,
        caption: slide.caption,
        author: { id: storyUser.id, name: storyUser.name },
        myUserId: currentUserId,
        text,
      });

      if (res.ok) {
        showIsland(`Message envoyé à ${storyUser.name.split(' ')[0]}`, undefined, 'Réponse privée à sa story');
        return true;
      } else {
        showIsland(res.error || 'Impossible d’envoyer la réponse');
        return false;
      }
    },
    [currentUserId, detail.id, requireAuth, showIsland]
  );

  const handleStoryLike = useCallback(
    async (slide: StorySlide, wasLiked: boolean) => {
      const momentId = slide.storyId;
      if (!momentId) return;
      if (!currentUserId || !canWrite) {
        requireAuth();
        return;
      }
      const flip = (on: boolean) =>
        setLikedStories((prev) => {
          const next = new Set(prev);
          if (on) next.add(momentId);
          else next.delete(momentId);
          return next;
        });
      flip(!wasLiked);
      const query = wasLiked
        ? supabase.from('carnet_moment_likes').delete().eq('moment_id', momentId).eq('user_id', currentUserId)
        : supabase.from('carnet_moment_likes').insert({ moment_id: momentId, user_id: currentUserId });
      const { error } = await query;
      if (error) {
        flip(wasLiked);
        showIsland('Le j’aime n’a pas pu être enregistré');
      }
    },
    [canWrite, currentUserId, requireAuth, showIsland, supabase]
  );

  const shareUrl = useMemo(
    () => (typeof window === 'undefined' ? '' : `${window.location.origin}/carnets/${detail.id}`),
    [detail.id]
  );

  const handleCopyLink = useCallback(() => {
    if (typeof window !== 'undefined') {
      void navigator.clipboard.writeText(shareUrl);
      showIsland('Lien du carnet copié');
    }
  }, [shareUrl, showIsland]);


  const showLive = layers.showLive;
  const zoneLabel = live.publicZone?.zoneLabel ?? detail.place.locality ?? null;

  return (
    <div
      className={`lkdv-carnet-v2-root lkdv-compte-v8 ${mapBig ? 'mapbig' : ''} ${outdoor ? 'outdoor' : ''} ${overlayOpen ? 'overlay-open' : ''} ${isEditing ? 'editing' : ''}`}
      data-testid="carnet-v2-root"
      data-reduce-motion={reduceMotion ? 'true' : 'false'}
      data-role={isParticipant ? 'participant' : 'visitor'}
      data-day={activeDay}
      data-online={isOnline ? 'true' : 'false'}
    >
      {/* Coquille des tiroirs : le SlotShell n'a pas de CSS global, le Compte
          l'injecte lui-même. Sans cette feuille, le tiroir n'a ni position ni
          capsule de lentille ancrée (les onglets tombaient hors de la feuille). */}
      <style dangerouslySetInnerHTML={{ __html: DRAWER_V2_CSS }} />

      <div className="lkdv-carnet-bg" aria-hidden="true">
        {detail.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={detail.coverImage} alt="" loading="eager" decoding="async" />
        ) : (
          /* Sans photo de couverture : le paysage dessiné de la maquette (`.bg svg`), jamais une photo inventée. */
          <svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" focusable="false">
            <circle cx="300" cy="120" r="46" fill="var(--pic-sun)" opacity=".55" />
            <path d="M0 260 L70 170 L120 220 L190 120 L260 215 L310 160 L390 250 V844 H0z" fill="var(--bg-r1)" />
            <path d="M0 360 L90 270 L160 330 L250 240 L330 320 L390 290 V844 H0z" fill="var(--bg-r2)" />
            <path d="M0 470 L110 400 L210 450 L300 380 L390 440 V844 H0z" fill="var(--bg-r3)" />
            <path d="M0 600 L120 540 L240 590 L390 530 V844 H0z" fill="var(--bg-r4)" />
            <path d="M178 140 L190 120 L204 148 L196 144 L190 152 L184 144z" fill="var(--pic-snow)" opacity=".85" />
          </svg>
        )}
      </div>

      {/* Dynamic Island notification */}
      <CarnetIsland toast={islandToast} onDismiss={dismissIsland} />

      {!isOnline ? (
        <div className="lkdv-carnet-offline" role="status" data-testid="carnet-offline">
          Hors ligne · les données affichées sont celles du dernier chargement
        </div>
      ) : null}

      {/* Top Section (69%) */}
      <section
        className="lkdv-carnet-top"
        aria-label="Présentation du carnet"
        inert={overlayOpen ? true : undefined}
        aria-hidden={overlayOpen ? true : undefined}
      >
        <CarnetTopBarV2
          title={detail.title}
          viewerRole={viewerRole}
          isEditing={isEditing}
          onToggleEdit={() => {
            const next = !editRequested;
            setEditRequested(next);
            showIsland(
              next ? 'Mode modification activé' : 'Mode modification terminé',
              undefined,
              next ? 'Les actions d’édition apparaissent en place.' : undefined
            );
          }}
          onOpenSettings={() => {
            setIsAccountDrawer(true);
            setDrawerOpen(true);
          }}
          onCreateMoment={() => openCreate()}
          onToggleOutdoor={() => setOutdoor((prev) => !prev)}
          isOutdoor={outdoor}
          reduceMotion={reduceMotion}
          onToggleReduceMotion={() => setReduceMotion((prev) => !prev)}
          onShare={() => {
            if (navigator.share) {
              void navigator.share({ title: detail.title, url: shareUrl }).catch(() => {});
            } else {
              handleCopyLink();
            }
          }}
          onReport={() => setReportTarget({ kind: 'carnet' })}
          onCopyLink={handleCopyLink}
          onFollow={() => void follow.toggle()}
          isFollowing={follow.following}
        />

        <CarnetCardV2
          detail={detail}
          activeDay={activeDay}
          onDayChange={(day) => setActiveDay(day)}
          onOpenDrawerSlot={handleOpenDrawerSlot}
          onOpenStories={() => {
            if (storyUsers.length > 0) setStoriesOpen(true);
            else showIsland('Aucune story disponible pour ce carnet');
          }}
          onSelectMoment={(moment) => openPost(moment)}
          onPeekMoment={(moment) => {
            setPeekMoment(moment);
          }}
          isEditing={isEditing}
          onAddMoment={() => openCreate()}
          onEndEdit={() => {
            setEditRequested(false);
            showIsland('Mode modification terminé');
          }}
          highlights={highlights}
          onHighlightTap={handleHighlightTap}
          onHighlightEdit={(highlight) => setHlEdit(highlight)}
          pinnedIds={pinnedIds}
          zoneLabel={zoneLabel}
        />
      </section>

      {/* Bottom Map Section (1fr) */}
      <section
        className="lkdv-carnet-mapzone"
        aria-label="Carte du parcours"
        inert={overlayOpen ? true : undefined}
        aria-hidden={overlayOpen ? true : undefined}
      >
        <CompteMap
          authState={user ? 'owner' : 'guest'}
          context={{ mode: 'overview' }}
          variant="carnet"
          trace={mapTrace}
          focus={mapFocus}
          activeDay={activeDay}
          dayTraces={dayTraces}
          onDayPick={(day) => {
            if (day !== activeDay) {
              haptic('light');
              setActiveDay(day);
            }
          }}
          onMarkerPick={(id) => {
            const moment = detail.moments.find((m) => `moment-${m.id}` === id);
            if (moment) focusMoment(moment);
          }}
          contextMode={drawerOpen}
          livePosition={
            showLive && live.livePosition
              ? { lat: live.livePosition.lat, lng: live.livePosition.lng }
              : null
          }
          publicZone={
            showLive &&
            live.publicZone &&
            typeof live.publicZone.centerLat === 'number' &&
            typeof live.publicZone.centerLng === 'number'
              ? {
                  centerLat: live.publicZone.centerLat,
                  centerLng: live.publicZone.centerLng,
                  radiusMeters: live.publicZone.radiusMeters,
                }
              : null
          }
          markers={mapMarkers}
        />
        {drawerOpen && !isAccountDrawer ? <CarnetMapBadge activeDay={activeDay} /> : null}

        {/* Grab handle : tap ou glisser > 20 px (maquette `.mgrab`) */}
        <button
          type="button"
          className="lkdv-mgrab"
          onPointerDown={(event) => {
            grabRef.current = { startY: event.clientY, dragged: false };
            suppressGrabClickRef.current = false;
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              /* capture optionnelle */
            }
          }}
          onPointerMove={(event) => {
            const grab = grabRef.current;
            if (!grab || grab.dragged) return;
            if (Math.abs(event.clientY - grab.startY) < 20) return;
            grab.dragged = true;
            suppressGrabClickRef.current = true;
            haptic('medium');
            setMapBig((prev) => !prev);
          }}
          onPointerUp={() => {
            grabRef.current = null;
          }}
          onPointerCancel={() => {
            grabRef.current = null;
          }}
          onClick={() => {
            if (suppressGrabClickRef.current) {
              suppressGrabClickRef.current = false;
              return;
            }
            haptic('medium');
            setMapBig((prev) => !prev);
          }}
          aria-label={mapBig ? 'Réduire la carte' : 'Agrandir la carte'}
          aria-pressed={mapBig}
        >
          <span />
        </button>
      </section>

      {/* Accessoire altimétrique — seulement avec de vraies mesures */}
      {hasElevationProfile && !overlayOpen ? (
        <div className="lkdv-carnet-acc" role="group" aria-label="Profil d’altitude du parcours">
          <span className="lkdv-acc-badge" aria-hidden="true">
            D+
          </span>
          <span className="lkdv-acc-ro">
            <b>
              {scrubPoint
                ? `${Math.round(scrubPoint.elevationM)} m`
                : profileGain !== null
                  ? `+${profileGain} m`
                  : '—'}
            </b>
            <span>
              {scrubPoint
                ? `${scrubPoint.distanceKm.toFixed(1)} km`
                : profileDistance !== null
                  ? `Profil · ${profileDistance.toFixed(1)} km`
                  : 'Dénivelé non renseigné'}
            </span>
          </span>
          <CarnetAltitude
            points={elevationProfile}
            interactive
            onScrub={(point) =>
              setScrubPoint(
                point
                  ? {
                      elevationM: point.elevationM,
                      distanceKm: point.distanceKm,
                      lat: point.lat,
                      lng: point.lng,
                    }
                  : null
              )
            }
            label="Profil d’altitude du parcours"
          />
        </div>
      ) : null}

      {/* 5-Slot Drawer (Fil, Route, Sac, Chiffres, Équipage) */}
      <CarnetDrawerV2
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        detail={detail}
        activeSlot={drawerSlot}
        onSlotChange={(slot) => setDrawerSlot(slot)}
        activeDay={activeDay}
        onFocusMap={(lat, lng, zoom) => {
          setMapFocus({ lat, lng, zoom });
          setDrawerOpen(false);
          setMapBig(true);
        }}
        onIsland={showIsland}
        userId={currentUserId}
        onRequireAuth={requireAuth}
        onSelectMoment={(moment) => openPost(moment)}
        onOpenStories={() => setStoriesOpen(true)}
        isAccountDrawer={isAccountDrawer}
        isEditing={isEditing}
        onCreate={openCreate}
        pinnedIds={pinnedIds}
        onContextChange={setDrawerContext}
        onDayPick={(day) => setActiveDay(day)}
        intent={drawerIntent}
        forceError={simulate}
        onEdit={isParticipant ? (target) => setEditTarget(target) : undefined}
        onSettingsSaved={(changes) =>
          setDetail((d) => ({
            ...d,
            title: typeof changes.title === 'string' ? changes.title : d.title,
            description:
              typeof changes.description === 'string' ? changes.description || null : d.description,
            visibility: typeof changes.visibility === 'string' ? changes.visibility : d.visibility,
            isPublic:
              typeof changes.visibility === 'string' ? changes.visibility === 'public' : d.isPublic,
            liveSharing:
              typeof changes.live_sharing === 'boolean' ? changes.live_sharing : d.liveSharing,
          }))
        }
        onDeleted={() => router.push('/compte')}
      />

      {/* Peek & Pop d'un moment (appui long 460 ms) */}
      {peekMoment ? (
        <CarnetPeek
          carnetId={detail.id}
          moment={peekMoment}
          initialEngagement={momentEngagementFor(peekMoment.id)}
          userId={currentUserId}
          onRequireAuth={requireAuth}
          onIsland={showIsland}
          onEngagementChange={rememberMomentEngagement}
          onClose={() => setPeekMoment(null)}
          pinned={pinnedIds.has(peekMoment.id)}
          onTogglePin={() => {
            togglePin(peekMoment);
            setPeekMoment(null);
          }}
          onShowOnMap={() => {
            focusMoment(peekMoment);
            setPeekMoment(null);
          }}
          onOpenPost={(mode) => {
            setPostSheetPanel(mode === 'comments' ? 'comments' : null);
            setPostMomentId(peekMoment.id);
            setPeekMoment(null);
          }}
          onShare={() => {
            const text = peekMoment.caption || peekMoment.title || detail.title;
            if (navigator.share) {
              void navigator.share({ title: detail.title, text, url: shareUrl }).catch(() => {});
            } else {
              void navigator.clipboard.writeText(shareUrl);
              showIsland('Lien du carnet copié');
            }
          }}
          onReport={() => {
            const momentId = peekMoment.id;
            setPeekMoment(null);
            if (!canWrite) {
              requireAuth();
              return;
            }
            setReportTarget({ kind: 'moment', momentId });
          }}
        />
      ) : null}

      {/* Post Sheet Overlay (tout moment) */}
      {postMoment ? (
        <CarnetPostSheet
          detail={postDetail}
          index={postIndex}
          onIndexChange={(idx) => setPostMomentId(postItems[idx]?.id ?? null)}
          onClose={() => {
            setPostMomentId(null);
            setPostSheetPanel(null);
          }}
          initialPanel={postSheetPanel}
          commentsMode="moment"
          comments={comments}
          canWrite={canWrite}
          currentUserId={currentUserId}
          onRequireAuth={requireAuth}
          initialEngagement={momentEngagementFor(postMoment.id)}
          onEngagementChange={rememberMomentEngagement}
          onIsland={showIsland}
          liked={engagement.liked}
          likes={engagement.likes}
          shareUrl={shareUrl}
          onCopied={handleCopyLink}
          saved={engagement.favorited}
          onReport={() => setReportTarget({ kind: 'carnet' })}
        />
      ) : null}

      {/* Feuille « Créer » (mode modification, participant) */}
      {createSheet && isParticipant ? (
        <CarnetCreateSheet
          day={createDay}
          defaultPlace={detail.etapes.find((e) => e.dayNumber === createDay)?.to ?? ''}
          kitItems={detail.kit.items}
          initialType={createSheet.type}
          onSubmit={async (input, file) => {
            if (!isOnline) return { ok: false, error: 'Tu es hors ligne : réessaie avec du réseau.' };
            return edits.createMoment(input, file);
          }}
          onClose={() => setCreateSheet(null)}
        />
      ) : null}

      {/* Feuille d'édition : étape, nuit, verdict, voyageur, texte d'un moment */}
      {editTarget && isParticipant ? (
        <CarnetEditSheet
          target={editTarget}
          detail={detail}
          edits={structure}
          canManageTravelers={detail.isOwner}
          onMomentRemoved={removeMomentLocal}
          onClose={() => setEditTarget(null)}
        />
      ) : null}

      {/* Tiroir d'édition d'une pastille « À la une » */}
      {hlEdit && isParticipant ? (
        <CarnetHighlightEditSheet
          highlight={hlEdit}
          onSave={(label) => {
            renameHighlight(hlEdit.id, label);
            showIsland('Sélection modifiée', undefined, label);
            setHlEdit(null);
          }}
          onRemove={() => {
            const target = hlEdit;
            removeHighlight(target.id);
            setHlEdit(null);
            showIsland('Retiré des stories à la une', () => restoreHighlight(target.id), target.label);
          }}
          onClose={() => setHlEdit(null)}
        />
      ) : null}

      {/* Stories Viewer Overlay */}
      {storiesOpen && storyUsers.length > 0 ? (
        <StoriesViewer
          users={storyUsers}
          startUser={0}
          onClose={() => setStoriesOpen(false)}
          onReply={handleStoryReply}
          onToggleLike={(slide, wasLiked) => void handleStoryLike(slide, wasLiked)}
          likedStoryIds={likedStories}
          onAuthor={(storyUser) => {
            setStoriesOpen(false);
            if (detail.participants.some((p) => p.userId === storyUser.id)) {
              setIsAccountDrawer(false);
              setDrawerSlot('equipage');
              setDrawerIntent({ nonce: Date.now(), view: { type: 'participant', userId: storyUser.id } });
              setDrawerOpen(true);
            }
          }}
          onReport={(_storyUser, slide) => {
            if (!slide.storyId) return;
            setStoriesOpen(false);
            if (!canWrite) {
              requireAuth();
              return;
            }
            setReportTarget({ kind: 'moment', momentId: slide.storyId });
          }}
          myUserId={currentUserId ?? undefined}
        />
      ) : null}

      {/* Report Sheet */}
      {reportOpen && reportTarget ? (
        <ReportSheet
          isOpen={reportOpen}
          onClose={() => setReportTarget(null)}
          contentType={reportTarget.kind === 'carnet' ? 'carnet' : 'post'}
          contentId={reportTarget.kind === 'carnet' ? detail.id : reportTarget.momentId}
          onSubmitReport={handleSubmitReport}
        />
      ) : null}
    </div>
  );
}
