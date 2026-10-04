import 'server-only';

import { createClient } from '@/lib/supabase/server';

import { requireAdminOrRedirect } from './queries';

/**
 * Données du shell Admin OS — Server Components uniquement.
 * Tout passe par le client RLS de l'appelant après garde.
 */

export interface NavBadges {
  community: number;
  support: number;
  system: number;
}

export interface AccountBadge {
  initials: string;
  name: string;
  roleLine: string;
}

/** Compteurs nav : signalements clubs, inbox unifiée, services dégradés. */
export async function getNavBadges(): Promise<NavBadges> {
  const { supabase } = await requireAdminOrRedirect('users.read');
  const [reports, queue, withdrawals, stock] = await Promise.all([
    supabase.from('club_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('moderation_queue').select('id', { count: 'exact', head: true }).eq('statut', 'en_attente'),
    supabase.from('reward_withdrawals').select('id', { count: 'exact', head: true }).in('status', ['pending', 'under_review']),
    supabase.from('shop_products').select('id', { count: 'exact', head: true }).lte('stock', 2),
  ]);
  const community = reports.count ?? 0;
  const support = (queue.count ?? 0) + (withdrawals.count ?? 0) + (stock.count ?? 0);
  const system = await getDegradedCount(supabase);
  return { community, support, system };
}

async function getDegradedCount(supabase: Awaited<ReturnType<typeof createClient>>): Promise<number> {
  let degraded = 0;
  try {
    const start = Date.now();
    const { error } = await supabase.from('action_logs').select('id', { head: true, count: 'exact' }).limit(1);
    if (error || Date.now() - start > 1500) degraded += 1;
  } catch {
    degraded += 1;
  }
  if (!process.env.STRIPE_SECRET_KEY) degraded += 1;
  return degraded;
}

/** Pastille compte sidebar : identité réelle + rôle + MFA. */
export async function getAccountBadge(): Promise<AccountBadge> {
  const { supabase, user } = await requireAdminOrRedirect('users.read');
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single();
  const { data: grants } = await supabase
    .from('user_roles')
    .select('roles ( name )')
    .eq('user_id', user.id);
  const roles = ((grants ?? []) as unknown as { roles: { name: string } | null }[])
    .map((g) => g.roles?.name)
    .filter(Boolean) as string[];
  const role = roles.includes('super_admin') ? 'Super Admin' : roles.includes('admin') ? 'Admin' : 'Modérateur';
  let mfa = false;
  try {
    const { data } = await supabase.auth.mfa.listFactors();
    mfa = ((data?.totp ?? []) as { status?: string }[]).some((f) => f.status === 'verified');
  } catch {
    mfa = false;
  }
  const name =
    ((profile as { full_name?: string | null } | null)?.full_name ||
      (profile as { email?: string | null } | null)?.email ||
      user.email ||
      'Admin').split(' ')[0] || 'Admin';
  const initials = name.slice(0, 2).toUpperCase();
  return { initials, name, roleLine: `${role} · MFA ${mfa ? 'actif' : 'inactif'}` };
}

export interface OverviewMetrics {
  users: number;
  usersNewMonth: number;
  usersDeltaPct: number | null;
  gmv: number;
  orders: number;
  trustAvg: number | null;
  todo: number;
  todoBreakdown: string;
}

/** KPI Mission Control — tous calculés, jamais de mock. */
export async function getOverviewMetrics(): Promise<OverviewMetrics> {
  const { supabase } = await requireAdminOrRedirect('users.read');
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const [users, usersMonth, usersPrev, orders, trust, mods, draws, stocks] = await Promise.all([
    supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
    supabase.from('user_profiles').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
    supabase.from('user_profiles').select('id', { count: 'exact', head: true }).gte('created_at', prevStart).lt('created_at', monthStart),
    supabase.from('orders').select('total_eur'),
    supabase.from('user_profiles').select('trust_score'),
    supabase.from('moderation_queue').select('id', { count: 'exact', head: true }).eq('statut', 'en_attente'),
    supabase.from('reward_withdrawals').select('id', { count: 'exact', head: true }).in('status', ['pending', 'under_review']),
    supabase.from('shop_products').select('id', { count: 'exact', head: true }).lte('stock', 2).is('deleted_at', null),
  ]);
  const gmv = ((orders.data ?? []) as { total_eur: number | null }[]).reduce(
    (s, o) => s + (o.total_eur ?? 0),
    0
  );
  const scores = ((trust.data ?? []) as { trust_score: number | null }[])
    .map((t) => t.trust_score)
    .filter((n): n is number => typeof n === 'number');
  const trustAvg = scores.length > 0 ? scores.reduce((s, n) => s + n, 0) / scores.length : null;
  const m = mods.count ?? 0;
  const w = draws.count ?? 0;
  const s = stocks.count ?? 0;
  const prev = usersPrev.count ?? 0;
  const cur = usersMonth.count ?? 0;
  return {
    users: users.count ?? 0,
    usersNewMonth: cur,
    usersDeltaPct: prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null,
    gmv,
    orders: orders.data?.length ?? 0,
    trustAvg: trustAvg !== null ? Math.round(trustAvg * 10) / 10 : null,
    todo: m + w + s,
    todoBreakdown: `${m} modération · ${w} retraits · ${s} stocks`,
  };
}

export interface ActivityPoint {
  day: string;
  count: number;
}

/** Série d'activité réelle (action_logs par jour, N derniers jours). */
export async function getActivitySeries(days = 30): Promise<ActivityPoint[]> {
  const { supabase } = await requireAdminOrRedirect('audit.read');
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from('action_logs')
    .select('created_at')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: true })
    .limit(5000);
  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of ((data ?? []) as { created_at: string }[])) {
    const key = String(row.created_at).slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([day, count]) => ({ day, count }));
}

export interface PriorityItem {
  level: 'P0' | 'P1' | 'P2';
  title: string;
  detail: string;
  tone: 'danger' | 'warn' | 'info';
  href: string;
}

/** File de priorité : modération critique, retraits, stocks bas (réel). */
export async function getPriorityQueue(limit = 8): Promise<PriorityItem[]> {
  const { supabase } = await requireAdminOrRedirect('users.read');
  const [mods, draws, stocks] = await Promise.all([
    supabase
      .from('moderation_queue')
      .select('id, contenu_type, contenu_id, statut, created_at')
      .eq('statut', 'en_attente')
      .order('created_at', { ascending: true })
      .limit(4),
    supabase
      .from('reward_withdrawals')
      .select('id, amount, requested_at')
      .in('status', ['pending', 'under_review'])
      .order('requested_at', { ascending: true })
      .limit(3),
    supabase
      .from('shop_products')
      .select('id, name, stock')
      .lte('stock', 2)
      .is('deleted_at', null)
      .order('stock', { ascending: true })
      .limit(3),
  ]);
  const items: PriorityItem[] = [];
  for (const m of (mods.data ?? []) as { id: string; contenu_type: string; contenu_id: string }[]) {
    items.push({
      level: 'P0',
      title: 'Signalement prioritaire',
      detail: `${m.contenu_type} · ${String(m.contenu_id).slice(0, 24)}`,
      tone: 'danger',
      href: '/admin/moderation',
    });
  }
  for (const w of (draws.data ?? []) as { id: string; amount: number }[]) {
    items.push({
      level: 'P1',
      title: 'Remboursement à approuver',
      detail: `Retrait · ${Number(w.amount).toLocaleString('fr-FR')} €`,
      tone: 'warn',
      href: '/admin/recompenses',
    });
  }
  for (const p of (stocks.data ?? []) as { id: string; name: string; stock: number }[]) {
    items.push({
      level: 'P2',
      title: 'Stock bas',
      detail: `${p.name} · reste ${p.stock}`,
      tone: 'info',
      href: `/admin/produits/${p.id}`,
    });
  }
  return items.slice(0, limit);
}

export interface CopilotSignal {
  headline: string;
  subtitle: string;
  text: string;
  rows: { title: string; detail: string; value: string; tone: 'good' | 'info' | 'warn' | 'danger' }[];
}

/** Signal Copilot : premier fait marquant réel, sinon état nominal honnête. */
export async function getCopilotSignal(): Promise<CopilotSignal> {
  const { supabase } = await requireAdminOrRedirect('users.read');
  const [mods, draws] = await Promise.all([
    supabase.from('moderation_queue').select('id', { count: 'exact', head: true }).eq('statut', 'en_attente'),
    supabase.from('reward_withdrawals').select('id', { count: 'exact', head: true }).in('status', ['pending', 'under_review']),
  ]);
  const m = mods.count ?? 0;
  const w = draws.count ?? 0;
  if (m > 0) {
    return {
      headline: 'File de modération active',
      subtitle: 'Lecture seule par défaut',
      text: `${m} signalement${m > 1 ? 's' : ''} en attente de décision dans la file Trust & Safety.`,
      rows: [
        { title: 'Modération', detail: 'en attente', value: String(m), tone: m > 5 ? 'danger' : 'warn' },
        { title: 'Retraits', detail: 'en attente', value: String(w), tone: w > 0 ? 'warn' : 'good' },
      ],
    };
  }
  if (w > 0) {
    return {
      headline: 'Retraits à traiter',
      subtitle: 'Lecture seule par défaut',
      text: `${w} demande${w > 1 ? 's' : ''} de retrait en attente de validation financière.`,
      rows: [{ title: 'Retraits', detail: 'en attente', value: String(w), tone: 'warn' }],
    };
  }
  return {
    headline: 'Situation nominale',
    subtitle: 'Lecture seule par défaut',
    text: 'Aucun signalement ni retrait en attente. Les files critiques sont vides.',
    rows: [{ title: 'Files critiques', detail: 'modération + retraits', value: 'Vides', tone: 'good' }],
  };
}

export interface UsersStats {
  total: number;
  admins: number;
  highTrust: number;
  newMonth: number;
  riskiest: { id: string; name: string; score: number } | null;
}

export async function getUsersStats(): Promise<UsersStats> {
  const { supabase } = await requireAdminOrRedirect('users.read');
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [total, grants, trusted, fresh, bottom] = await Promise.all([
    supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
    supabase.from('user_roles').select('user_id', { count: 'exact', head: true }),
    supabase.from('user_profiles').select('id', { count: 'exact', head: true }).gte('trust_score', 80),
    supabase.from('user_profiles').select('id', { count: 'exact', head: true }).gte('created_at', monthStart.toISOString()),
    supabase.from('user_profiles').select('id, full_name, email, trust_score').order('trust_score', { ascending: true, nullsFirst: true }).limit(1).single(),
  ]);
  const b = bottom.data as { id: string; full_name: string | null; email: string | null; trust_score: number | null } | null;
  return {
    total: total.count ?? 0,
    admins: grants.count ?? 0,
    highTrust: trusted.count ?? 0,
    newMonth: fresh.count ?? 0,
    riskiest: b ? { id: b.id, name: b.full_name || b.email || b.id.slice(0, 8), score: b.trust_score ?? 0 } : null,
  };
}

export interface ProductsStats {
  total: number;
  stockValue: number;
  lowStock: { id: string; name: string; stock: number } | null;
  inactive: number;
}

export async function getProductsStats(): Promise<ProductsStats> {
  const { supabase } = await requireAdminOrRedirect('products.read');
  const [all, low, off] = await Promise.all([
    supabase.from('shop_products').select('price_eur, stock').is('deleted_at', null),
    supabase.from('shop_products').select('id, name, stock').is('deleted_at', null).order('stock', { ascending: true }).limit(1).single(),
    supabase.from('shop_products').select('id', { count: 'exact', head: true }).eq('is_active', false),
  ]);
  const rows = ((all.data ?? []) as { price_eur: number | null; stock: number | null }[]);
  const value = rows.reduce((s, p) => s + (p.price_eur ?? 0) * (p.stock ?? 0), 0);
  const l = low.data as { id: string; name: string; stock: number } | null;
  return {
    total: rows.length,
    stockValue: Math.round(value * 100) / 100,
    lowStock: l ? { id: l.id, name: l.name, stock: l.stock ?? 0 } : null,
    inactive: off.count ?? 0,
  };
}

export interface OrdersStats {
  total: number;
  gmv: number;
  latest: { id: string; label: string; detail: string } | null;
}

export async function getOrdersStats(): Promise<OrdersStats> {
  const { supabase } = await requireAdminOrRedirect('orders.read');
  const [sums, last] = await Promise.all([
    supabase.from('orders').select('total_eur'),
    supabase.from('orders').select('id, order_number, total_eur, status, created_at').order('created_at', { ascending: false }).limit(1).single(),
  ]);
  const rows = ((sums.data ?? []) as { total_eur: number | null }[]);
  const l = last.data as { id: string; order_number: string | null; total_eur: number | null; status: string | null; created_at: string } | null;
  return {
    total: rows.length,
    gmv: Math.round(rows.reduce((s, o) => s + (o.total_eur ?? 0), 0) * 100) / 100,
    latest: l
      ? {
          id: l.id,
          label: `${l.order_number || l.id.slice(0, 8)} · ${l.total_eur ?? 0} €`,
          detail: `${l.status ?? '—'} · ${new Date(l.created_at).toLocaleString('fr-FR')}`,
        }
      : null,
  };
}

export interface ModerationStats {
  pending: number;
  approved: number;
  rejected: number;
  oldest: { id: string; type: string; waiting: string } | null;
}

export async function getModerationStats(): Promise<ModerationStats> {
  const { supabase } = await requireAdminOrRedirect('moderation.read');
  const [p, a, r, o] = await Promise.all([
    supabase.from('moderation_queue').select('id', { count: 'exact', head: true }).eq('statut', 'en_attente'),
    supabase.from('moderation_queue').select('id', { count: 'exact', head: true }).eq('statut', 'approuve'),
    supabase.from('moderation_queue').select('id', { count: 'exact', head: true }).eq('statut', 'rejete'),
    supabase.from('moderation_queue').select('id, contenu_type, created_at').eq('statut', 'en_attente').order('created_at', { ascending: true }).limit(1).single(),
  ]);
  const oldest = o.data as { id: string; contenu_type: string; created_at: string } | null;
  return {
    pending: p.count ?? 0,
    approved: a.count ?? 0,
    rejected: r.count ?? 0,
    oldest: oldest
      ? {
          id: oldest.id,
          type: oldest.contenu_type,
          waiting: `en attente depuis le ${new Date(oldest.created_at).toLocaleString('fr-FR')}`,
        }
      : null,
  };
}

export interface RewardsStats {
  pending: number;
  pendingAmount: number;
  oldest: { id: string; amount: number; waiting: string } | null;
}

export async function getRewardsStats(): Promise<RewardsStats> {
  const { supabase } = await requireAdminOrRedirect('rewards.read');
  const { data } = await supabase
    .from('reward_withdrawals')
    .select('id, amount, requested_at')
    .in('status', ['pending', 'under_review'])
    .order('requested_at', { ascending: true });
  const rows = ((data ?? []) as { id: string; amount: number; requested_at: string }[]);
  const oldest = rows[0];
  return {
    pending: rows.length,
    pendingAmount: Math.round(rows.reduce((s, w) => s + (w.amount ?? 0), 0) * 100) / 100,
    oldest: oldest
      ? {
          id: oldest.id,
          amount: oldest.amount,
          waiting: `demandé le ${new Date(oldest.requested_at).toLocaleString('fr-FR')}`,
        }
      : null,
  };
}

export interface AuditStats {
  total: number;
  today: number;
  actors: number;
  latest: { action: string; when: string } | null;
}

export async function getAuditStats(): Promise<AuditStats> {
  const { supabase } = await requireAdminOrRedirect('audit.read');
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const [t, d, a, l] = await Promise.all([
    supabase.from('action_logs').select('id', { count: 'exact', head: true }),
    supabase.from('action_logs').select('id', { count: 'exact', head: true }).gte('created_at', dayStart.toISOString()),
    supabase.from('action_logs').select('actor_id'),
    supabase.from('action_logs').select('action, created_at').order('created_at', { ascending: false }).limit(1).single(),
  ]);
  const actors = new Set(((a.data ?? []) as { actor_id: string | null }[]).map((r) => r.actor_id).filter(Boolean));
  const last = l.data as { action: string; created_at: string } | null;
  return {
    total: t.count ?? 0,
    today: d.count ?? 0,
    actors: actors.size,
    latest: last ? { action: last.action, when: new Date(last.created_at).toLocaleString('fr-FR') } : null,
  };
}

export interface SecurityStats {
  admins: number;
  grants: number;
  secActions30d: number;
  lastSecAction: string | null;
}

export async function getSecurityStats(): Promise<SecurityStats> {
  const { supabase } = await requireAdminOrRedirect('users.read');
  const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const [admins, grants, sec] = await Promise.all([
    supabase.from('user_roles').select('user_id', { count: 'exact', head: true }),
    supabase.from('role_permissions').select('role_id', { count: 'exact', head: true }),
    supabase.from('action_logs').select('action, created_at').gte('created_at', monthAgo).order('created_at', { ascending: false }).limit(200),
  ]);
  const rows = ((sec.data ?? []) as { action: string; created_at: string }[]);
  const interesting = rows.filter((r) => r.action.startsWith('role.') || r.action.startsWith('mfa.') || r.action.startsWith('rewards.'));
  return {
    admins: admins.count ?? 0,
    grants: grants.count ?? 0,
    secActions30d: interesting.length,
    lastSecAction: interesting[0]
      ? `${interesting[0].action} · ${new Date(interesting[0].created_at).toLocaleString('fr-FR')}`
      : null,
  };
}

export interface CommunityStats {
  clubs: number;
  members: number;
  carnets: number;
  reports: number;
  top: { id: string; name: string; members: number }[];
}

export async function getCommunityStats(): Promise<CommunityStats> {
  const { supabase } = await requireAdminOrRedirect('users.read');
  const [clubs, members, carnets, reports, top] = await Promise.all([
    supabase.from('clubs').select('id', { count: 'exact', head: true }),
    supabase.from('club_members').select('id', { count: 'exact', head: true }),
    supabase.from('carnets').select('id', { count: 'exact', head: true }),
    supabase.from('club_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('clubs').select('id, name').limit(50),
  ]);
  const ids = ((top.data ?? []) as { id: string }[]).map((c) => c.id);
  const counts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data } = await supabase.from('club_members').select('club_id').in('club_id', ids);
    for (const row of ((data ?? []) as { club_id: string }[])) {
      counts[row.club_id] = (counts[row.club_id] ?? 0) + 1;
    }
  }
  const ranked = ((top.data ?? []) as { id: string; name: string | null }[])
    .map((c) => ({ id: c.id, name: c.name ?? c.id.slice(0, 8), members: counts[c.id] ?? 0 }))
    .sort((a, b) => b.members - a.members)
    .slice(0, 5);
  return {
    clubs: clubs.count ?? 0,
    members: members.count ?? 0,
    carnets: carnets.count ?? 0,
    reports: reports.count ?? 0,
    top: ranked,
  };
}

export interface CompasStats {
  trips: number;
  upcoming: number;
  budget: number;
  recent: { id: string; title: string; detail: string; status: string }[];
}

export async function getCompasStats(): Promise<CompasStats> {
  const { supabase } = await requireAdminOrRedirect('users.read');
  const today = new Date().toISOString().slice(0, 10);
  const [all, up, recent] = await Promise.all([
    supabase.from('trips').select('id', { count: 'exact', head: true }),
    supabase.from('trips').select('id', { count: 'exact', head: true }).gte('start_date', today),
    supabase.from('trips').select('id, title, destination_name, status, estimated_budget, start_date').order('created_at', { ascending: false }).limit(8),
  ]);
  const rows = (recent.data ?? []) as {
    id: string; title: string | null; destination_name: string | null;
    status: string; estimated_budget: number | null; start_date: string | null;
  }[];
  return {
    trips: all.count ?? 0,
    upcoming: up.count ?? 0,
    budget: Math.round(rows.reduce((s, t) => s + (t.estimated_budget ?? 0), 0) * 100) / 100,
    recent: rows.map((t) => ({
      id: t.id,
      title: t.title || 'Sans titre',
      detail: `${t.destination_name ?? '—'} · départ ${t.start_date ?? '—'}`,
      status: t.status,
    })),
  };
}

export interface AnalyticsStats {
  users: number;
  users30d: number;
  carnets: number;
  clubs: number;
  orders: number;
  gmv: number;
}

export async function getAnalytics(): Promise<AnalyticsStats> {
  const { supabase } = await requireAdminOrRedirect('users.read');
  const ago = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const [users, fresh, carnets, clubs, orders] = await Promise.all([
    supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
    supabase.from('user_profiles').select('id', { count: 'exact', head: true }).gte('created_at', ago),
    supabase.from('carnets').select('id', { count: 'exact', head: true }),
    supabase.from('clubs').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('total_eur'),
  ]);
  const orows = ((orders.data ?? []) as { total_eur: number | null }[]);
  return {
    users: users.count ?? 0,
    users30d: fresh.count ?? 0,
    carnets: carnets.count ?? 0,
    clubs: clubs.count ?? 0,
    orders: orows.length,
    gmv: Math.round(orows.reduce((s, o) => s + (o.total_eur ?? 0), 0) * 100) / 100,
  };
}

export interface ServiceRow {
  name: string;
  detail: string;
  status: string;
  tone: 'good' | 'info' | 'warn' | 'danger';
}

export interface SystemStatus {
  dbMs: number | null;
  migrations: number;
  version: string;
  rows: ServiceRow[];
  degraded: number;
}

/** État plateforme réel : ping DB, version, présence d'intégrations (booléens). */
export async function getSystemStatus(): Promise<SystemStatus> {
  const { supabase } = await requireAdminOrRedirect('users.read');
  let dbMs: number | null = null;
  try {
    const start = Date.now();
    const { error } = await supabase.from('action_logs').select('id', { head: true }).limit(1);
    if (!error) dbMs = Date.now() - start;
  } catch {
    dbMs = null;
  }
  let migrations = 0;
  try {
    const { readdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    migrations = readdirSync(join(process.cwd(), 'supabase', 'migrations')).filter((f) =>
      f.endsWith('.sql')
    ).length;
  } catch {
    migrations = 0;
  }
  const has = (k: string) => Boolean(process.env[k]);
  const sso = (process.env.NEXT_PUBLIC_SSO_PROVIDERS ?? '').trim();
  const rows: ServiceRow[] = [
    { name: 'Web App', detail: `build ${process.env.npm_package_version ?? 'local'}`, status: 'Healthy', tone: 'good' },
    { name: 'Postgres', detail: dbMs !== null ? `${dbMs} ms` : 'injoignable', status: dbMs !== null ? 'Healthy' : 'Down', tone: dbMs !== null ? 'good' : 'danger' },
    { name: 'Stripe', detail: has('STRIPE_SECRET_KEY') ? 'clé configurée' : 'non configuré', status: has('STRIPE_SECRET_KEY') ? 'Healthy' : 'Off', tone: has('STRIPE_SECRET_KEY') ? 'good' : 'warn' },
    { name: 'IndexNow', detail: has('INDEXNOW_KEY') ? 'clé configurée' : 'non configuré', status: has('INDEXNOW_KEY') ? 'Healthy' : 'Off', tone: has('INDEXNOW_KEY') ? 'good' : 'warn' },
    { name: 'SSO', detail: sso || 'aucun fournisseur', status: sso ? 'On' : 'Off', tone: sso ? 'info' : 'warn' },
    { name: 'Migrations', detail: `${migrations} fichiers locaux`, status: 'Suivi', tone: 'info' },
  ];
  return {
    dbMs,
    migrations,
    version: process.env.npm_package_version ?? 'dev',
    rows,
    degraded: rows.filter((r) => r.tone === 'danger').length,
  };
}

export interface InboxItem {
  kind: string;
  title: string;
  detail: string;
  tone: 'danger' | 'warn' | 'info';
  href: string;
}

/** Dossier unique : modération + retraits + stocks bas (sans table dédiée). */
export async function getSupportInbox(): Promise<{ items: InboxItem[]; counts: { moderation: number; withdrawals: number; stock: number } }> {
  const { supabase } = await requireAdminOrRedirect('users.read');
  const [mods, draws, stocks] = await Promise.all([
    supabase.from('moderation_queue').select('id, contenu_type, created_at').eq('statut', 'en_attente').order('created_at', { ascending: true }).limit(20),
    supabase.from('reward_withdrawals').select('id, amount, requested_at').in('status', ['pending', 'under_review']).order('requested_at', { ascending: true }).limit(20),
    supabase.from('shop_products').select('id, name, stock').lte('stock', 2).is('deleted_at', null).order('stock', { ascending: true }).limit(20),
  ]);
  const items: InboxItem[] = [];
  for (const m of ((mods.data ?? []) as { id: string; contenu_type: string; created_at: string }[])) {
    items.push({
      kind: 'Modération',
      title: `Signalement · ${m.contenu_type}`,
      detail: new Date(m.created_at).toLocaleString('fr-FR'),
      tone: 'danger',
      href: '/admin/moderation',
    });
  }
  for (const w of ((draws.data ?? []) as { id: string; amount: number; requested_at: string }[])) {
    items.push({
      kind: 'Retrait',
      title: `Retrait ${w.amount} € à valider`,
      detail: new Date(w.requested_at).toLocaleString('fr-FR'),
      tone: 'warn',
      href: '/admin/recompenses',
    });
  }
  for (const p of ((stocks.data ?? []) as { id: string; name: string; stock: number }[])) {
    items.push({
      kind: 'Stock',
      title: `${p.name} · stock ${p.stock}`,
      detail: 'réapprovisionner ou archiver',
      tone: 'info',
      href: `/admin/produits/${p.id}`,
    });
  }
  return {
    items: items.slice(0, 40),
    counts: {
      moderation: mods.data?.length ?? 0,
      withdrawals: draws.data?.length ?? 0,
      stock: stocks.data?.length ?? 0,
    },
  };
}
