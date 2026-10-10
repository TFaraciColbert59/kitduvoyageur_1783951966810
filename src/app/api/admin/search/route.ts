import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { z } from 'zod';

import { requireAdmin } from '@/server/admin/requireAdmin';
import { fail, ok } from '@/server/admin/respond';
import { logAdminAction } from '@/server/admin/audit';
import { sanitizeIlike } from '@/server/admin/sanitize';
import { readCorrelationId } from '@/lib/observability/correlation';
import {
  SEARCHABLE_ENTITIES,
  maskEmail,
} from '@/features/admin-os/search/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  q: z.string().min(2).max(120),
  domain: z.string().max(32).optional(),
});

export interface SearchHit {
  domain: string;
  id: string;
  label: string;
  secondary: string;
  href: string;
}

/**
 * GET /api/admin/search?q=&domain= — recherche fédérée avec droits.
 * Gate `admin.access`, puis filtre par domaine via `has_permission()`.
 * Emails masqués sauf `users.pii.reveal`. Pagination : 10 hits/domaine max.
 */
export async function GET(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const gate = await requireAdmin('admin.access');
  if (!gate.ok) return gate.response;
  const { supabase, user } = gate.ctx;

  const parsed = querySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!parsed.success) {
    return fail('invalid_query', 'Requête invalide (q ≥ 2 caractères)', 400, correlationId ?? undefined);
  }
  const q = sanitizeIlike(parsed.data.q);
  const domains = parsed.data.domain
    ? [parsed.data.domain]
    : Object.keys(SEARCHABLE_ENTITIES);
  for (const d of domains) {
    if (!SEARCHABLE_ENTITIES[d]) {
      return fail('unknown_domain', `Domaine inconnu : ${d}`, 400, correlationId ?? undefined);
    }
  }

  const can = async (code: string): Promise<boolean> => {
    const { data } = await supabase.rpc('has_permission', { p_code: code });
    return data === true;
  };

  // Contrôles de domaine en parallèle (1 gate + N checks groupés, pas N séquentiels).
  const [usersRead, piiReveal, ordersRead, productsRead, moderationRead, auditRead] =
    await Promise.all([
      domains.includes('user') ? can('users.read') : Promise.resolve(false),
      domains.includes('user') ? can('users.pii.reveal') : Promise.resolve(false),
      domains.includes('order') ? can('orders.read') : Promise.resolve(false),
      domains.includes('product') ? can('products.read') : Promise.resolve(false),
      domains.includes('ticket') ? can('moderation.read') : Promise.resolve(false),
      domains.includes('audit') ? can('audit.read') : Promise.resolve(false),
    ]);

  const hits: SearchHit[] = [];

  if (usersRead) {
    const reveal = piiReveal;
    const { data } = await supabase
      .from('user_profiles')
      .select('id, full_name, email')
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .limit(10);
    const rows = (data ?? []) as { id: string; full_name: string; email: string }[];
    if (reveal && rows.length > 0) {
      // Révélation PII auditée (contrat registre : jamais silencieuse).
      // Requête hashée (sha256) : jamais de PII brute dans l'audit.
      const qHash = createHash('sha256').update(parsed.data.q).digest('hex');
      await logAdminAction({
        action: 'users.pii.reveal',
        actor_id: user.id,
        target_table: 'user_profiles',
        target_id: rows[0].id,
        diff: { revealed: rows.length, via: 'admin.search', q_hash: qHash },
        risk_tier: 2,
        correlation_id: correlationId ?? undefined,
        reason: 'recherche admin avec révélation PII',
        ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
        user_agent: req.headers.get('user-agent') ?? undefined,
      });
    }
    for (const u of rows) {
      hits.push({
        domain: 'user',
        id: u.id,
        label: u.full_name || '(sans nom)',
        secondary: reveal ? u.email : maskEmail(u.email),
        href: SEARCHABLE_ENTITIES.user.adminRoute(u.id),
      });
    }
  }

  if (ordersRead) {
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, status')
      .ilike('order_number', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(10);
    for (const o of (data ?? []) as { id: string; order_number: string; status: string }[]) {
      hits.push({
        domain: 'order',
        id: o.id,
        label: o.order_number,
        secondary: o.status,
        href: SEARCHABLE_ENTITIES.order.adminRoute(o.id),
      });
    }
  }

  if (productsRead) {
    const { data } = await supabase
      .from('shop_products')
      .select('id, name, brand, slug')
      .or(`name.ilike.%${q}%,brand.ilike.%${q}%,slug.ilike.%${q}%`)
      .limit(10);
    for (const p of (data ?? []) as { id: string; name: string; brand: string; slug: string }[]) {
      hits.push({
        domain: 'product',
        id: p.id,
        label: p.name,
        secondary: p.brand || p.slug,
        href: SEARCHABLE_ENTITIES.product.adminRoute(p.id),
      });
    }
  }

  if (moderationRead) {
    const { data } = await supabase
      .from('moderation_queue')
      .select('id, contenu_type, contenu_id, statut')
      .or(`contenu_id.ilike.%${q}%,contenu_type.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .limit(10);
    for (const t of (data ?? []) as { id: string; contenu_type: string; contenu_id: string; statut: string }[]) {
      hits.push({
        domain: 'ticket',
        id: t.id,
        label: `${t.contenu_type} · ${t.contenu_id}`,
        secondary: t.statut,
        href: SEARCHABLE_ENTITIES.ticket.adminRoute(t.id),
      });
    }
  }

  if (auditRead) {
    const { data } = await supabase
      .from('action_logs')
      .select('id, action, target_table, target_id')
      .or(`action.ilike.%${q}%,target_id.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .limit(10);
    for (const a of (data ?? []) as { id: string; action: string; target_table: string; target_id: string }[]) {
      hits.push({
        domain: 'audit',
        id: a.id,
        label: a.action,
        secondary: `${a.target_table ?? '?'} · ${a.target_id ?? '?'}`,
        href: SEARCHABLE_ENTITIES.audit.adminRoute(a.id),
      });
    }
  }

  if (domains.includes('command') && (await can('admin.access'))) {
    const { data } = await supabase
      .from('admin_commands')
      .select('id, command_key, resource_type, resource_id, status')
      .or(`command_key.ilike.%${q}%,resource_id.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .limit(10);
    for (const c of (data ?? []) as { id: string; command_key: string; resource_type: string; resource_id: string; status: string }[]) {
      hits.push({
        domain: 'command',
        id: c.id,
        label: c.command_key,
        secondary: `${c.resource_type} · ${c.status}`,
        href: SEARCHABLE_ENTITIES.command.adminRoute(c.id),
      });
    }
  }

  return ok({ hits, count: hits.length }, { correlationId: correlationId ?? undefined });
}
