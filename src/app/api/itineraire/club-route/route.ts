// Sorties de club (10.5) : GET liste les sorties à venir que la personne organise ; POST propose la version publiée
// d'un espace à l'une d'elles (RPC `publish_club_event_route_from_workspace`, droits contrôlés en base). Session
// exigée, entrée validée par zod. S'inscrire à une sortie ne donne aucun droit : ici seul un organisateur agit.
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, fail } from '@/lib/api/respond';
import { listOrganizerClubEvents, publishWorkspaceToClubEvent } from '@/features/route-collab/server/clubRoute';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ workspaceId: z.string().uuid(), eventId: z.string().uuid() }).strict();

export async function GET() {
  const res = await listOrganizerClubEvents();
  if (res.status !== 'ok') return res.status === 'unauthenticated' ? fail('unauthorized', 'Session requise.') : fail('server', 'sorties_indisponibles');
  return ok({ events: res.events });
}

export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail('bad_request', 'json_invalide');
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return fail('bad_request', 'entree_invalide');
  const res = await publishWorkspaceToClubEvent(parsed.data.workspaceId, parsed.data.eventId);
  switch (res.status) {
    case 'ok':
      return ok({ status: 'ok', revision: res.revision, unchanged: res.unchanged });
    case 'unauthenticated':
      return fail('unauthorized', 'Session requise.');
    case 'forbidden':
      return fail('forbidden', 'organisateur_et_proprietaire_requis');
    case 'no_published':
    case 'no_pack':
      return fail('conflict', res.status);
    case 'unavailable':
    case 'invalid':
      return fail('conflict', res.status);
    default:
      return fail('server', 'publication_impossible');
  }
}
