import type { Metadata } from 'next';
import { getAuthenticatedRouteActor } from '@/app/api/routes/[id]/_auth';
import { getWorkspaceForActor } from '@/features/route-collab/serverStore';
import { RouteCollabPageClient } from '@/features/route-collab/components/RouteCollabPageClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Créateur d’itinéraire collaboratif — Compas LKDV',
  description: 'Préparation d’itinéraire multi-jours collaborative, hors ligne et reliée au sac.',
};

export default async function CompasItinerairePage({
  searchParams,
}: {
  searchParams: Promise<{ workspaceId?: string; token?: string; from?: string; routeId?: string }>;
}) {
  const { workspaceId, token } = await searchParams;
  const actor = await getAuthenticatedRouteActor();
  const userId = actor?.userId ?? 'guest-local';
  const userName = actor?.displayName ?? 'Voyageur';

  let serverWorkspace = null;
  let accessDeniedMessage: string | null = null;

  if (workspaceId) {
    const res = getWorkspaceForActor(workspaceId, actor?.userId ?? null, token ?? null);
    if (res.ok) {
      serverWorkspace = res.workspace;
    } else {
      accessDeniedMessage = res.error;
    }
  }

  return (
    <RouteCollabPageClient
      userId={userId}
      userName={userName}
      serverWorkspace={serverWorkspace}
      requestedWorkspaceId={workspaceId ?? null}
      shareToken={token ?? null}
      accessDeniedMessage={accessDeniedMessage}
    />
  );
}
