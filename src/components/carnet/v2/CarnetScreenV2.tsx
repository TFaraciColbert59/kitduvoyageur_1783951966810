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
import { CarnetAltitude } from './CarnetAltitude';
import { CarnetMapBadge } from './CarnetMapBadge';
import { CompteMap } from '@/components/compte/map/CompteMap';
import { DRAWER_V2_CSS } from '@/components/compte/drawer/SlotShell';
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
import { ZoomIn, ZoomOut, Compass } from 'lucide-react';

import '@/styles/tokens.css';
import '@/styles/carnet-v2.css';
import '@/components/compte/compte-apple-hig.css';
import '@/components/compte/compte-v8.css';

export interface CarnetScreenV2Props {
  detail: CarnetDetail;
}

export function CarnetScreenV2({ detail }: CarnetScreenV2Props) {
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
  const [isEditing, setIsEditing] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const grabRef = useRef<{ startY: number; dragged: boolean } | null>(null);
  const suppressGrabClickRef = useRef(false);

  // Drawer & Overlay States
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSlot, setDrawerSlot] = useState<CarnetSlotId>('fil');
  const [isAccountDrawer, setIsAccountDrawer] = useState(false);
  const [postSheetIndex, setPostSheetIndex] = useState<number | null>(null);
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
    drawerOpen || peekMoment !== null || postSheetIndex !== null || storiesOpen || reportOpen;

  /* Les feuilles Radix (post, stories, signalement) ne passent pas par
     `useCarnetDialog` : sans ce crochet, la barre flottante reste au-dessus
     de leur pied et intercepte le bouton d'action. */
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('lkdv-overlay-open', overlayOpen);
    return () => document.body.classList.remove('lkdv-overlay-open');
  }, [overlayOpen]);

  const showIsland = useCallback((message: string, undo?: () => void) => {
    setIslandToast({
      id: String(Date.now()),
      message,
      undo,
    });
  }, []);

  const dismissIsland = useCallback(() => {
    setIslandToast(null);
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
    initialLivePosition: detail.livePosition,
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

  const postMoment =
    postSheetIndex === null || detail.photoMoments.length === 0
      ? null
      : detail.photoMoments[Math.max(0, Math.min(postSheetIndex, detail.photoMoments.length - 1))];

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
    (slot: CarnetSlotId) => {
      haptic('light');
      setIsAccountDrawer(false);
      setDrawerSlot(slot);
      setDrawerOpen(true);
    },
    [haptic]
  );

  // Markers for steps and nights on map
  const mapMarkers = useMemo(() => {
    const list: Array<{
      id: string;
      lat: number;
      lng: number;
      title: string;
      type?: string;
      badge?: string;
    }> = [];
    for (const night of detail.nights ?? []) {
      if (night.lat && night.lng) {
        list.push({
          id: `night-${night.id}`,
          lat: night.lat,
          lng: night.lng,
          title: night.name,
          type: night.type,
          badge: `N${night.dayNumber}`,
        });
      }
    }
    if (scrubPoint) {
      list.push({
        id: 'scrub',
        lat: scrubPoint.lat,
        lng: scrubPoint.lng,
        title: 'Point du profil',
        type: 'scrub',
      });
    }
    return list;
  }, [detail.nights, scrubPoint]);

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
        showIsland('Réponse envoyée en message privé');
        return true;
      } else {
        showIsland(res.error || 'Impossible d’envoyer la réponse');
        return false;
      }
    },
    [currentUserId, detail.id, requireAuth, showIsland]
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

  const handleExportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(detail, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${detail.title.replace(/[^a-zA-Z0-9]/g, '_')}-carnet.json`;
    a.click();
    URL.revokeObjectURL(url);
    showIsland('Carnet exporté en JSON');
  }, [detail, showIsland]);

  return (
    <div
      className={`lkdv-carnet-v2-root lkdv-compte-v8 ${mapBig ? 'mapbig' : ''} ${outdoor ? 'outdoor' : ''} ${overlayOpen ? 'overlay-open' : ''}`}
      data-testid="carnet-v2-root"
      data-reduce-motion={reduceMotion ? 'true' : 'false'}
    >
      {/* Coquille des tiroirs : le SlotShell n'a pas de CSS global, le Compte
          l'injecte lui-même. Sans cette feuille, le tiroir n'a ni position ni
          capsule de lentille ancrée (les onglets tombaient hors de la feuille). */}
      <style dangerouslySetInnerHTML={{ __html: DRAWER_V2_CSS }} />

      <div className="lkdv-carnet-bg" aria-hidden="true">
        {detail.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={detail.coverImage} alt="" loading="eager" decoding="async" />
        ) : null}
      </div>

      {/* Dynamic Island notification */}
      <CarnetIsland toast={islandToast} onDismiss={dismissIsland} />

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
          onToggleEdit={() => setIsEditing((prev) => !prev)}
          onOpenSettings={() => {
            setIsAccountDrawer(true);
            setDrawerOpen(true);
          }}
          onCreateMoment={() => {
            // Participant: open create moment sheet or drawer
            handleOpenDrawerSlot('fil');
            showIsland('Sélectionnez un lieu ou photo pour le nouveau moment');
          }}
          onToggleOutdoor={() => setOutdoor((prev) => !prev)}
          isOutdoor={outdoor}
          reduceMotion={reduceMotion}
          onToggleReduceMotion={() => setReduceMotion((prev) => !prev)}
          onShare={() => {
            if (navigator.share) {
              void navigator.share({ title: detail.title, url: shareUrl });
            } else {
              handleCopyLink();
            }
          }}
          onExport={handleExportJson}
          onReport={() => setReportTarget({ kind: 'carnet' })}
          onCopyLink={handleCopyLink}
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
          onSelectMoment={(moment, idx) => {
            // Find photo index in photoMoments for PostSheet
            const photoIdx = detail.photoMoments.findIndex((m) => m.id === moment.id);
            setPostSheetIndex(photoIdx >= 0 ? photoIdx : idx);
          }}
          onPeekMoment={(moment) => {
            setPeekMoment(moment);
          }}
          isEditing={isEditing}
          onAddMoment={() => {
            handleOpenDrawerSlot('fil');
          }}
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
          trace={detail.trace}
          focus={mapFocus}
          activeDay={activeDay}
          livePosition={
            live.livePosition ? { lat: live.livePosition.lat, lng: live.livePosition.lng } : null
          }
          publicZone={
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
        <CarnetMapBadge activeDay={activeDay} />

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

        {/* Map Zoom Controls */}
        <div className="lkdv-mctl" role="group" aria-label="Contrôles de la carte">
          <button
            type="button"
            onClick={() => {
              const map3D = (window as unknown as { __lkdvCompteMap3D?: { zoomIn: () => void } })
                .__lkdvCompteMap3D;
              map3D?.zoomIn();
            }}
            aria-label="Zoom avant"
          >
            <ZoomIn size={18} />
          </button>
          <button
            type="button"
            onClick={() => {
              const map3D = (window as unknown as { __lkdvCompteMap3D?: { zoomOut: () => void } })
                .__lkdvCompteMap3D;
              map3D?.zoomOut();
            }}
            aria-label="Zoom arrière"
          >
            <ZoomOut size={18} />
          </button>
          <button
            type="button"
            onClick={() => {
              // Recenter
              if (detail.place?.lat && detail.place?.lng) {
                setMapFocus({ lat: detail.place.lat, lng: detail.place.lng, zoom: 11 });
              }
            }}
            aria-label="Recentrer la carte"
          >
            <Compass size={18} />
          </button>
        </div>
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
        onSelectMoment={(moment, idx) => {
          const photoIdx = detail.photoMoments.findIndex((m) => m.id === moment.id);
          setPostSheetIndex(photoIdx >= 0 ? photoIdx : idx);
        }}
        onOpenStories={() => setStoriesOpen(true)}
        isAccountDrawer={isAccountDrawer}
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
          onOpenPost={(mode) => {
            const photoIdx = detail.photoMoments.findIndex((m) => m.id === peekMoment.id);
            setPostSheetPanel(mode === 'comments' ? 'comments' : null);
            setPostSheetIndex(photoIdx >= 0 ? photoIdx : 0);
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

      {/* Post Sheet Overlay (Photo Moments) */}
      {postSheetIndex !== null ? (
        <CarnetPostSheet
          detail={detail}
          index={postSheetIndex}
          onIndexChange={(idx) => setPostSheetIndex(idx)}
          onClose={() => {
            setPostSheetIndex(null);
            setPostSheetPanel(null);
          }}
          initialPanel={postSheetPanel}
          commentsMode="moment"
          comments={comments}
          canWrite={canWrite}
          currentUserId={currentUserId}
          onRequireAuth={requireAuth}
          initialEngagement={postMoment ? momentEngagementFor(postMoment.id) : null}
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

      {/* Stories Viewer Overlay */}
      {storiesOpen && storyUsers.length > 0 ? (
        <StoriesViewer
          users={storyUsers}
          startUser={0}
          onClose={() => setStoriesOpen(false)}
          onReply={handleStoryReply}
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
