import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { logAdminAction } from '@/server/admin/audit';
import { checkCsrfToken } from '@/server/admin/csrf';
import { requireAdmin } from '@/server/admin/requireAdmin';
import { roleGrantSchema, roleRevokeSchema } from '@/server/admin/schemas';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const userIdParam = z.string().uuid();

function clientIp(req: NextRequest): string | undefined {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined;
}

async function resolveRoleId(
  supabase: SupabaseClient,
  role: string
): Promise<string | null> {
  const { data } = await supabase
    .from('roles')
    .select('id')
    .eq('name', role)
    .single();
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * POST /api/admin/users/[id]/role — octroie un rôle (upsert, expiration optionnelle).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin('roles.grant');
  if (!gate.ok) return gate.response;
  const { supabase, user } = gate.ctx;

  if (!(await checkCsrfToken(req))) {
    return NextResponse.json({ error: 'Jeton CSRF invalide' }, { status: 403 });
  }
  const limited = await enforceRateLimit(user.id, {
    scope: 'admin-role-grant',
    limit: 30,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return limited;

  const { id } = await params;
  if (!userIdParam.safeParse(id).success) {
    return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 });
  }
  const body = roleGrantSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      {
        error: 'Requête invalide',
        fields: body.error.issues.map((i) => i.path.join('.')),
      },
      { status: 400 }
    );
  }

  const { data: target } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('id', id)
    .single();
  if (!target) {
    return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
  }

  const roleId = await resolveRoleId(supabase, body.data.role);
  if (!roleId) {
    return NextResponse.json({ error: 'Rôle inconnu' }, { status: 400 });
  }

  const { error } = await supabase.from('user_roles').upsert(
    {
      user_id: id,
      role_id: roleId,
      granted_by: user.id,
      expires_at: body.data.expires_at ?? null,
    },
    { onConflict: 'user_id,role_id' }
  );
  if (error) {
    console.error('[admin/role] octroi impossible', { code: error.code });
    return NextResponse.json({ error: 'Octroi impossible' }, { status: 500 });
  }

  await logAdminAction({
    action: 'role.grant',
    actor_id: user.id,
    target_table: 'user_roles',
    target_id: id,
    diff: { role: body.data.role, expires_at: body.data.expires_at ?? null },
    ip: clientIp(req),
    user_agent: req.headers.get('user-agent') ?? undefined,
  });
  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/admin/users/[id]/role — retire un rôle.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin('roles.grant');
  if (!gate.ok) return gate.response;
  const { supabase, user } = gate.ctx;

  if (!(await checkCsrfToken(req))) {
    return NextResponse.json({ error: 'Jeton CSRF invalide' }, { status: 403 });
  }
  const limited = await enforceRateLimit(user.id, {
    scope: 'admin-role-grant',
    limit: 30,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return limited;

  const { id } = await params;
  if (!userIdParam.safeParse(id).success) {
    return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 });
  }
  const body = roleRevokeSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      {
        error: 'Requête invalide',
        fields: body.error.issues.map((i) => i.path.join('.')),
      },
      { status: 400 }
    );
  }

  const roleId = await resolveRoleId(supabase, body.data.role);
  if (!roleId) {
    return NextResponse.json({ error: 'Rôle inconnu' }, { status: 400 });
  }

  const { error } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', id)
    .eq('role_id', roleId);
  if (error) {
    console.error('[admin/role] retrait impossible', { code: error.code });
    return NextResponse.json({ error: 'Retrait impossible' }, { status: 500 });
  }

  await logAdminAction({
    action: 'role.revoke',
    actor_id: user.id,
    target_table: 'user_roles',
    target_id: id,
    diff: { role: body.data.role },
    ip: clientIp(req),
    user_agent: req.headers.get('user-agent') ?? undefined,
  });
  return NextResponse.json({ success: true });
}
