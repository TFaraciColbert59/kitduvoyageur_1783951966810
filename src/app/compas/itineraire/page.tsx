import type { Metadata } from 'next';
import { getAuthenticatedRouteActor } from '@/app/api/routes/[id]/_auth';
import { getRouteCollabStore } from '@/features/route-collab/store';
import { parseEntryParams, type TripEntry } from '@/features/route-collab/entry';
import { carnetReplayNote, parseCarnetReplayParams, type CarnetReplay, type CarnetReplayState } from '@/features/route-collab/carnetReplay';
import { loadCarnetReplay } from '@/features/route-collab/server/loadCarnetReplay';
import { loadTripEntry } from '@/features/route-collab/server/loadTripEntry';
import { listAttachableTrips } from '@/features/route-collab/server/listAttachableTrips';
import { getPaceContextForUser } from '@/features/route-collab/server/paceProfile';
import { RouteCollabPageClient } from '@/features/route-collab/components/RouteCollabPageClient';
import type { TripLinkState } from '@/features/route-collab/components/workspace/start/RouteEntryContext';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Créateur d’itinéraire collaboratif — Compas LKDV',
  description: 'Préparation d’itinéraire multi-jours collaborative, hors ligne et reliée au sac.',
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CompasItinerairePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const raw = await searchParams;
  const first = (k: string): string | undefined => {
    const v = raw[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const workspaceId = first('workspaceId');
  const token = first('token');
  const entryParams = parseEntryParams(raw);
  const carnetParams = parseCarnetReplayParams(raw);

  const actor = await getAuthenticatedRouteActor();
  const userId = actor?.userId ?? 'guest-local';
  const userName = actor?.displayName ?? 'Voyageur';

  // 1.1 : le voyage d'entrée (`?trip=`), lu sous RLS ; un lien faux ou privé est annoncé, jamais corrigé.
  // 9.10 : « Reprendre le tracé » d'un carnet (`?from=carnet&carnetId=`), lu sous RLS avec les masques du lecteur.
  const carnetState: CarnetReplayState = carnetParams ? await loadCarnetReplay(carnetParams.carnetId) : { status: 'none' };
  const carnetReplay: CarnetReplay | null = carnetState.status === 'ok' ? carnetState.replay : null;
  const carnetNote = carnetReplayNote(carnetState);
  const tripIdToLoad = entryParams.tripId ?? (carnetState.status === 'ok' ? carnetState.tripId ?? undefined : undefined);

  let trip: TripEntry | null = null;
  let tripLink: TripLinkState = entryParams.tripInvalid ? 'invalid' : 'none';
  if (tripIdToLoad) {
    const res = await loadTripEntry(tripIdToLoad);
    if (res.status === 'ok') {
      trip = res.entry;
      tripLink = 'ok';
    } else {
      tripLink = res.status === 'not_found' ? 'not_found' : 'error';
    }
  }

  // 10.8 : allure apprise des sorties de la personne (RLS : la sienne seulement) ; sans compte, profil à froid ou
  // erreur de lecture : `null`, la page garde l'allure standard et le dit.
  const paceContext = actor ? await getPaceContextForUser(actor.userId) : null;

  let serverWorkspace = null;
  let attachChoices: Awaited<ReturnType<typeof listAttachableTrips>> | null = null;
  let accessDeniedMessage: string | null = null;

  try {
    const store = await getRouteCollabStore();
    if (workspaceId) {
      const res = await store.getWorkspaceForActor(workspaceId, actor?.userId ?? null, token ?? null);
      if (res.ok) {
        serverWorkspace = res.workspace;
      } else {
        accessDeniedMessage = res.error;
      }
    } else if (trip && actor && !carnetReplay) {
      // Un seul tracé par voyage : s'il existe déjà un itinéraire rattaché à ce voyage, on l'ouvre.
      const mine = await store.listWorkspacesForActor(actor.userId);
      serverWorkspace = mine.find((w) => w.tripId === trip.tripId) ?? null;
    } else if (!trip && actor && !carnetReplay) {
      // 1.1 : sans voyage, la personne choisit ou crée le voyage (lecture sous RLS) ; ceux qui ont déjà un tracé sont dits.
      const mine = await store.listWorkspacesForActor(actor.userId);
      attachChoices = await listAttachableTrips(actor.userId, new Set(mine.map((w) => w.tripId)));
    }
  } catch {
    if (!workspaceId && !trip && actor && !carnetReplay) attachChoices = await listAttachableTrips(actor.userId);
    if (workspaceId) accessDeniedMessage = 'Itinéraire momentanément indisponible. Réessayez.';
  }

  return (
    <RouteCollabPageClient
      userId={userId}
      userName={userName}
      authenticated={Boolean(actor)}
      serverWorkspace={serverWorkspace}
      requestedWorkspaceId={workspaceId ?? null}
      shareToken={token ?? null}
      accessDeniedMessage={accessDeniedMessage}
      trip={trip}
      tripLink={tripLink}
      deepLink={entryParams.deepLink}
      paceProfile={paceContext?.pace ?? null}
      performanceProfile={paceContext?.performance ?? null}
      attachChoices={attachChoices}
      carnetReplay={carnetReplay}
      carnetNote={carnetNote}
    />
  );
}
