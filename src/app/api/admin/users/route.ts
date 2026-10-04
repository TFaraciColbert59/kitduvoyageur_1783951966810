import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/server/admin/requireAdmin';
import { paginationSchema } from '@/server/admin/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROFILE_FIELDS =
  'id, full_name, email, loyalty_level, trust_score, role, created_at';

/**
 * GET /api/admin/users?q=&page=&pageSize=
 * Liste paginée des profils + rôles RBAC. Lecture RLS (policies admin).
 */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin('users.read');
  if (!gate.ok) return gate.response;
  const { supabase } = gate.ctx;

  const parsed = paginationSchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Requête invalide',
        fields: parsed.error.issues.map((i) => i.path.join('.')),
      },
      { status: 400 }
    );
  }
  const { page, pageSize, q } = parsed.data;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('user_profiles')
    .select(PROFILE_FIELDS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (q) {
    query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data: profiles, count, error } = await query;
  if (error) {
    console.error('[admin/users] lecture impossible', { code: error.code });
    return NextResponse.json({ error: 'Lecture impossible' }, { status: 500 });
  }

  const ids = (profiles ?? []).map((p) => p.id as string);
  let rolesByUser: Record<string, string[]> = {};
  if (ids.length > 0) {
    const { data: grants, error: grantError } = await supabase
      .from('user_roles')
      .select('user_id, roles ( name )')
      .in('user_id', ids);
    if (!grantError && grants) {
      for (const g of grants) {
        const row = g as unknown as {
          user_id: string;
          roles: { name: string } | null;
        };
        if (!rolesByUser[row.user_id]) rolesByUser[row.user_id] = [];
        if (row.roles?.name) rolesByUser[row.user_id].push(row.roles.name);
      }
    }
  }

  const res = NextResponse.json({
    data: (profiles ?? []).map((p) => ({
      ...(p as Record<string, unknown>),
      roles: rolesByUser[(p as { id: string }).id] ?? [],
    })),
    page,
    pageSize,
    total: count ?? 0,
  });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
