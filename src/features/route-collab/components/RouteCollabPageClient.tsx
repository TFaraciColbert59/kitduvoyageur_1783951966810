'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RouteCollabWorkspace } from './RouteCollabWorkspace';
import { StartScreen } from './workspace/start/StartScreen';
import { AttachTripScreen } from './workspace/start/AttachTripScreen';
import type { AttachTripChoice } from '../attach';
import {
  RouteEntryProvider,
  type RouteGoal,
  type TripLinkState,
} from './workspace/start/RouteEntryContext';
import type { ItineraryDeepLink } from '../insights/deepLinks';
import type { TripEntry } from '../entry';
import type { UserPaceProfile } from '../paceProfile';
import type { PerformanceProfile } from '@/features/adventure-intelligence/schemas/performance.schema';
import { buildWorkspaceFromRouteDraft } from '../compasDraft';
import { adoptGuestWorkspace, clearGuestWorkspace, readGuestWorkspace, saveGuestWorkspace } from '../guestDraft';
import { getLastVerifiedPack } from '../offlinePackStore';
import { isRealTripId, persistWorkspaceToServer } from '../startPersist';
import type { RouteWorkspaceState } from '../types';

function buildWorkspaceFromVerifiedPack(
  userId: string,
  userName: string,
  workspaceId: string,
): RouteWorkspaceState | null {
  const pack = getLastVerifiedPack(userId, workspaceId);
  if (!pack) return null;
  const rev = pack.revision;
  return {
    id: rev.workspaceId,
    tripId: `offline-${rev.workspaceId}`,
    title: rev.summary || `Itinéraire hors ligne v${rev.revisionNo}`,
    status: 'published',
    sport: 'marche',
    shapeMode: 'one_way',
    routingOptions: {},
    headSeq: rev.basedOnSeq,
    reviewedSeq: rev.basedOnSeq,
    publishedRevisionId: rev.id,
    publishedRevisionNo: rev.revisionNo,
    sourceOrigin: { kind: 'blank', importedAt: rev.createdAt },
    points: rev.points,
    sections: rev.sections,
    stages: rev.stages,
    variants: [],
    proposals: [],
    comments: [],
    kitItems: rev.kitSnapshot,
    members: [{ userId, displayName: userName, role: 'participant' }],
    revisions: [rev],
    packs: [pack.manifest],
    participantPacks: [
      {
        userId,
        displayName: userName,
        preparedRevisionNo: rev.revisionNo,
        downloadedRevisionNo: rev.revisionNo,
        verifiedLocalAt: pack.verifiedAt,
        status: 'ready',
      },
    ],
    updatedAt: pack.verifiedAt,
  };
}

type Phase =
  | { readonly kind: 'checking' }
  | { readonly kind: 'start' }
  | { readonly kind: 'denied' }
  | { readonly kind: 'attach'; readonly draft: RouteWorkspaceState | null }
  | { readonly kind: 'persisting'; readonly workspace: RouteWorkspaceState }
  | { readonly kind: 'ready'; readonly workspace: RouteWorkspaceState; readonly serverSynced: boolean };

/** Routeur de l'application s'il est monté ; `null` hors application (tests, rendu isolé) : jamais d'exception. */
function useOptionalRouter(): ReturnType<typeof useRouter> | null {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useRouter();
  } catch {
    return null;
  }
}

const NO_DEEP_LINK: Omit<ItineraryDeepLink, 'tripId'> = {};

/**
 * Entrée de /compas/itineraire. Ordre de reprise, du plus fidèle au plus neutre : l'itinéraire du serveur
 * (ou sa copie hors ligne), puis le brouillon gardé sur l'appareil (1.7), puis le tracé que le Compas a déjà
 * calculé pour ce voyage (1.2), sinon l'écran de départ (1.3). Aucun itinéraire d'exemple n'est jamais posé.
 */
export function RouteCollabPageClient({
  userId,
  userName,
  authenticated = userId !== 'guest-local',
  serverWorkspace = null,
  requestedWorkspaceId = null,
  shareToken = null,
  accessDeniedMessage = null,
  trip = null,
  tripLink = 'none',
  deepLink = NO_DEEP_LINK,
  paceProfile = null,
  performanceProfile = null,
  attachChoices = null,
}: {
  userId: string;
  userName: string;
  authenticated?: boolean;
  serverWorkspace?: RouteWorkspaceState | null;
  requestedWorkspaceId?: string | null;
  shareToken?: string | null;
  accessDeniedMessage?: string | null;
  trip?: TripEntry | null;
  tripLink?: TripLinkState;
  deepLink?: Omit<ItineraryDeepLink, 'tripId'>;
  /** Allure apprise des sorties de la personne (10.8), lue côté serveur ; `null` : allure standard, dite. */
  paceProfile?: UserPaceProfile | null;
  performanceProfile?: PerformanceProfile | null;
  /**
   * 1.1 : voyages que la personne peut modifier (lus côté serveur, sous RLS), pour « Rattacher à un voyage ».
   * `null` : la page n'a pas à proposer le rattachement (visiteur, ou itinéraire ouvert par son identifiant).
   */
  attachChoices?: ReadonlyArray<AttachTripChoice> | null;
}) {
  const router = useOptionalRouter();
  const [phase, setPhase] = useState<Phase>(() =>
    serverWorkspace ? { kind: 'ready', workspace: serverWorkspace, serverSynced: true } : { kind: 'checking' },
  );
  const [goal, setGoal] = useState<RouteGoal | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [deepLinkNow, setDeepLinkNow] = useState(deepLink);
  const saveTimer = useRef<number | null>(null);
  const checkedRef = useRef(false);
  const attachSkippedRef = useRef(false);
  const latestWorkspaceRef = useRef<RouteWorkspaceState | null>(null);

  // Enregistre côté serveur quand c'est possible (compte + voyage réel), sinon garde le brouillon sur l'appareil.
  const settle = useCallback(
    async (workspace: RouteWorkspaceState) => {
      if (authenticated && isRealTripId(workspace.tripId)) {
        setPhase({ kind: 'persisting', workspace });
        const res = await persistWorkspaceToServer(workspace);
        if (res.ok) {
          clearGuestWorkspace();
          setSaveNote(null);
          try {
            const url = new URL(window.location.href);
            url.searchParams.set('workspaceId', res.workspace.id);
            window.history.replaceState(null, '', url.toString());
          } catch {
            /* l'adresse n'est qu'un confort */
          }
          setPhase({ kind: 'ready', workspace: res.workspace, serverSynced: true });
          return;
        }
        saveGuestWorkspace(workspace);
        setSaveNote(res.reason);
        setPhase({ kind: 'ready', workspace, serverSynced: false });
        return;
      }
      saveGuestWorkspace(workspace);
      setSaveNote(
        authenticated
          ? 'Itinéraire non rattaché à un voyage : gardé sur cet appareil.'
          : 'Itinéraire non enregistré : connectez-vous pour le garder.',
      );
      setPhase({ kind: 'ready', workspace, serverSynced: false });
    },
    [authenticated],
  );

  useEffect(() => {
    if (phase.kind !== 'checking' || checkedRef.current) return;
    checkedRef.current = true;
    // 1. Copie hors ligne d'un itinéraire demandé par son identifiant.
    if (requestedWorkspaceId) {
      const offline = buildWorkspaceFromVerifiedPack(userId, userName, requestedWorkspaceId);
      if (offline) {
        setPhase({ kind: 'ready', workspace: offline, serverSynced: true });
        return;
      }
      if (accessDeniedMessage) {
        setPhase({ kind: 'denied' });
        return;
      }
    }
    // 1 bis. Sans voyage (`?trip=` absent, illisible ou privé) : la personne connectée choisit ou crée le voyage
    // avant de tracer ; le brouillon de l'appareil, s'il existe, est gardé tel quel (1.1).
    if (!trip && authenticated && attachChoices && !requestedWorkspaceId && !attachSkippedRef.current) {
      setPhase({ kind: 'attach', draft: readGuestWorkspace(null) });
      return;
    }
    // 2. Brouillon gardé sur l'appareil (tracé sans compte, repris après la connexion).
    const guest = readGuestWorkspace(trip?.tripId ?? null);
    if (guest) {
      void settle(adoptGuestWorkspace(guest, { userId, userName, tripId: trip?.tripId ?? null }));
      return;
    }
    // 3. Tracé déjà calculé par le Compas pour ce voyage.
    if (trip?.routeDraft) {
      void settle(
        buildWorkspaceFromRouteDraft({
          draft: trip.routeDraft,
          workspaceId: `ws-trip-${trip.tripId}`,
          tripId: trip.tripId,
          title: trip.title,
          userId,
          userName,
          nowIso: new Date().toISOString(),
          days: trip.days,
        }),
      );
      return;
    }
    // 4. Sinon : l'écran de départ.
    setPhase({ kind: 'start' });
  }, [phase.kind, requestedWorkspaceId, accessDeniedMessage, userId, userName, trip, settle, authenticated, attachChoices]);

  useEffect(
    () => () => {
      if (saveTimer.current != null) window.clearTimeout(saveTimer.current);
    },
    [],
  );

  // Tant que l'itinéraire n'est pas enregistré côté serveur, chaque changement est gardé sur l'appareil.
  const onWorkspaceChange = useCallback((next: RouteWorkspaceState) => {
    latestWorkspaceRef.current = next;
    if (saveTimer.current != null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveGuestWorkspace(next);
    }, 500);
  }, []);

  // 1.1 : depuis l'atelier d'une personne connectée, « Rattacher à un voyage » garde d'abord le brouillon.
  const requestAttach = useCallback(() => {
    if (saveTimer.current != null) window.clearTimeout(saveTimer.current);
    const current = latestWorkspaceRef.current;
    if (current) saveGuestWorkspace(current);
    attachSkippedRef.current = false;
    checkedRef.current = false;
    setPhase({ kind: 'checking' });
  }, []);

  const entryValue = useMemo(
    () => ({
      trip,
      tripLink,
      deepLink: deepLinkNow,
      authenticated,
      goal,
      localDraft: phase.kind === 'ready' && !phase.serverSynced,
      saveNote,
      navigate: router ? (href: string) => router.push(href) : undefined,
      requestAttach:
        authenticated && attachChoices && !trip && (phase.kind === 'start' || (phase.kind === 'ready' && !phase.serverSynced))
          ? requestAttach
          : undefined,
    }),
    [trip, tripLink, deepLinkNow, authenticated, goal, phase, saveNote, attachChoices, requestAttach, router],
  );

  if (phase.kind === 'denied') {
    return (
      <div className="xp-root rcw-empty-screen" data-theme="light" data-testid="route-collab-denied">
        <div className="rcw-empty-card">
          <strong>Accès refusé</strong>
          <p className="rcw-sub-note">{accessDeniedMessage ?? 'Vous n’avez pas accès à cet itinéraire.'}</p>
        </div>
      </div>
    );
  }

  if (phase.kind === 'checking' || phase.kind === 'persisting') {
    return (
      <div className="xp-root rcw-empty-screen" data-theme="light" data-testid="route-collab-loading" role="status">
        <div className="rcw-empty-card">
          <p className="rcw-sub-note">
            {phase.kind === 'persisting' ? 'Enregistrement de l’itinéraire…' : 'Ouverture de l’itinéraire…'}
          </p>
        </div>
      </div>
    );
  }

  if (phase.kind === 'attach') {
    return (
      <AttachTripScreen
        choices={attachChoices ?? []}
        draft={phase.draft}
        tripLink={tripLink}
        onSkip={() => {
          attachSkippedRef.current = true;
          checkedRef.current = false;
          setPhase({ kind: 'checking' });
        }}
      />
    );
  }

  if (phase.kind === 'start') {
    return (
      <RouteEntryProvider value={entryValue}>
        <StartScreen
          trip={trip}
          tripLink={tripLink}
          userId={userId}
          userName={userName}
          onStart={(workspace, nextGoal) => {
            setGoal(nextGoal);
            setDeepLinkNow(NO_DEEP_LINK);
            void settle(workspace);
          }}
        />
      </RouteEntryProvider>
    );
  }

  return (
    <RouteEntryProvider value={entryValue}>
      <RouteCollabWorkspace
        key={phase.workspace.id}
        initialWorkspace={phase.workspace}
        currentUserId={userId}
        currentUserName={userName}
        serverSynced={phase.serverSynced}
        shareToken={shareToken}
        onWorkspaceChange={phase.serverSynced ? undefined : onWorkspaceChange}
        paceProfile={paceProfile}
        performanceProfile={performanceProfile}
      />
    </RouteEntryProvider>
  );
}
