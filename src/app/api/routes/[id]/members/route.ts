import { NextResponse } from 'next/server';
import { z } from 'zod';
import { shouldUseSupabaseRouteCollabStore, getRouteCollabStore } from '@/features/route-collab/store';
import { storeErrorResponse } from '@/features/route-collab/store/httpErrors';
import { invitableFromTrip, type InvitableCollaborator } from '@/features/route-collab/team';
import { createClient } from '@/lib/supabase/server';
import { MemberActionSchema } from '../../_teamSchemas';
import { getAuthenticatedRouteActor } from '../_auth';

export const dynamic = 'force-dynamic';

const TripRoleSchema = z.enum(['owner', 'editor', 'viewer']);

/**
 * 8.1 : les personnes invitables sont les collaborateurs du voyage (`trip_collaborators`), lus avec le client de
 * l'utilisateur (RLS), qui ne sont pas déjà actifs sur l'itinéraire. Aucune autre liste, aucun second système de
 * membres : pour faire entrer quelqu'un dans le voyage, on renvoie vers le flux d'invitation du Compas.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getAuthenticatedRouteActor();
  if (!actor) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  }
  try {
    const store = await getRouteCollabStore();
    const read = await store.getWorkspaceForActor(id, actor.userId);
    if (!read.ok) return NextResponse.json({ error: read.error }, { status: read.status });
    const { workspace } = read;
    const canManage = workspace.members.some(
      (m) => m.userId === actor.userId && !m.revokedAt && (m.role === 'owner' || m.role === 'co_organizer'),
    );
    if (!canManage) {
      return NextResponse.json({ error: 'Gestion des membres réservée au responsable.' }, { status: 403 });
    }
    if (!shouldUseSupabaseRouteCollabStore() || !workspace.tripId) {
      return NextResponse.json({ invitable: [] as InvitableCollaborator[], tripId: workspace.tripId ?? null });
    }

    const supabase = await createClient();
    const { data: rows, error } = await supabase
      .from('trip_collaborators')
      .select('user_id, role')
      .eq('trip_id', workspace.tripId)
      .limit(200);
    if (error) {
      console.error('[route-collab] collaborateurs du voyage', error.code);
      return NextResponse.json({ error: 'Lecture des collaborateurs impossible.' }, { status: 500 });
    }
    const collabs = (rows ?? [])
      .map((r) => ({ userId: String((r as { user_id: unknown }).user_id), role: TripRoleSchema.safeParse((r as { role: unknown }).role) }))
      .filter((r) => r.role.success);
    const ids = collabs.map((c) => c.userId);
    const names = new Map<string, string>();
    if (ids.length > 0) {
      const { data: profiles } = await supabase.from('public_profiles').select('id, full_name').in('id', ids);
      for (const p of (profiles ?? []) as Array<{ id: string; full_name: string | null }>) {
        if (p.full_name?.trim()) names.set(p.id, p.full_name.trim());
      }
    }
    const all: InvitableCollaborator[] = collabs.map((c) => ({
      userId: c.userId,
      displayName: names.get(c.userId) ?? `Voyageur ${c.userId.slice(0, 6)}`,
      tripRole: c.role.success ? c.role.data : 'viewer',
    }));
    return NextResponse.json({ invitable: invitableFromTrip(all, workspace.members), tripId: workspace.tripId });
  } catch (error) {
    return storeErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const actor = await getAuthenticatedRouteActor();
  if (!actor) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide.' }, { status: 400 });
  }
  const parsed = MemberActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête membres/partage invalide.' }, { status: 400 });
  }

  try {
    const store = await getRouteCollabStore();
    if (parsed.data.kind === 'share_link') {
      const res = await store.manageShareLink({
        workspaceId: id,
        actorId: actor.userId,
        action: parsed.data.action,
        expiresInHours: parsed.data.expiresInHours,
        hidePrivateStartRadiusM: parsed.data.hidePrivateStartRadiusM,
      });
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
      return NextResponse.json(res);
    }

    const res = await store.updateMemberRoleOrRevoke({
      workspaceId: id,
      actorId: actor.userId,
      targetUserId: parsed.data.targetUserId,
      displayName: parsed.data.displayName,
      role: parsed.data.role,
      delegatedPublish: parsed.data.delegatedPublish,
      revoke: parsed.data.revoke,
      stageScopeIds: parsed.data.stageScopeIds,
    });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json(res);
  } catch (error) {
    return storeErrorResponse(error);
  }
}
