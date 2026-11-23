import type { Metadata } from 'next';
import { getAuthenticatedRouteActor } from '@/app/api/routes/[id]/_auth';
import { getRouteCollabStore } from '@/features/route-collab/store';
import { parseEntryParams, type TripEntry } from '@/features/route-collab/entry';
import { loadTripEntry } from '@/features/route-collab/server/loadTripEntry';
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

  const actor = await getAuthenticatedRouteActor();
  const userId = actor?.userId ?? 'guest-local';
  const userName = actor?.displayName ?? 'Voyageur';

  // 1.1 : le voyage d'entrée (`?trip=`), lu sous RLS ; un lien faux ou privé est annoncé, jamais corrigé.
  let trip: TripEntry | null = null;
  let tripLink: TripLinkState = entryParams.tripInvalid ? 'invalid' : 'none';
  if (entryParams.tripId) {
    const res = await loadTripEntry(entryParams.tripId);
    if (res.status === 'ok') {
      trip = res.entry;
      tripLink = 'ok';
    } else {
      tripLink = res.status === 'not_found' ? 'not_found' : 'error';
    }
  }

  let serverWorkspace = null;
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
    } else if (trip && actor) {
      // Un seul tracé par voyage : s'il existe déjà un itinéraire rattaché à ce voyage, on l'ouvre.
      const mine = await store.listWorkspacesForActor(actor.userId);
      serverWorkspace = mine.find((w) => w.tripId === trip.tripId) ?? null;
    }
  } catch {
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
    />
  );
}
