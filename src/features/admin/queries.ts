import 'server-only';

import { redirect } from 'next/navigation';

import { requireAdmin, type AdminContext } from '@/server/admin/requireAdmin';
import { sanitizeIlike } from '@/server/admin/sanitize';

/**
 * Requêtes serveur du back-office — Server Components uniquement.
 * Chaque fonction vérifie la permission puis lit via le client RLS
 * de l'appelant (jamais de service_role en lecture).
 */

export async function requireAdminOrRedirect(code: string = 'users.read'): Promise<AdminContext> {
  const gate = await requireAdmin(code);
  if (!gate.ok) {
    redirect(gate.response.status === 401 ? '/connexion?redirect=/admin' : '/');
  }
  return gate.ctx;
}

export interface AdminUserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  loyalty_level: string | null;
  trust_score: number | null;
  role: string | null;
  created_at: string;
  roles: string[];
}

export async function listUsersPage(
  rawQ: string,
  page: number,
  pageSize: number
): Promise<{ data: AdminUserRow[]; total: number }> {
  const { supabase } = await requireAdminOrRedirect('users.read');
  const q = sanitizeIlike(rawQ);
  const from = (page - 1) * pageSize;
  let query = supabase
    .from('user_profiles')
    .select('id, full_name, email, loyalty_level, trust_score, role, created_at', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
  const { data, count, error } = await query;
  if (error) throw new Error('users_unavailable');

  const rows = (data ?? []) as unknown as Omit<AdminUserRow, 'roles'>[];
  const ids = rows.map((r) => r.id);
  const rolesByUser: Record<string, string[]> = {};
  if (ids.length > 0) {
    const { data: grants } = await supabase
      .from('user_roles')
      .select('user_id, roles ( name )')
      .in('user_id', ids);
    for (const g of (grants ?? []) as unknown as {
      user_id: string;
      roles: { name: string } | null;
    }[]) {
      if (!rolesByUser[g.user_id]) rolesByUser[g.user_id] = [];
      if (g.roles?.name) rolesByUser[g.user_id].push(g.roles.name);
    }
  }
  return {
    data: rows.map((r) => ({ ...r, roles: rolesByUser[r.id] ?? [] })),
    total: count ?? 0,
  };
}

export interface AuditRow {
  id: string;
  actor_id: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  diff: unknown;
  ip: string | null;
  source: string;
  created_at: string;
}

export async function listAuditPage(
  filters: { action?: string; target_table?: string; from?: string; to?: string },
  page: number,
  pageSize: number
): Promise<{ data: AuditRow[]; total: number }> {
  const { supabase } = await requireAdminOrRedirect('audit.read');
  const from = (page - 1) * pageSize;
  let query = supabase
    .from('action_logs')
    .select('id, actor_id, action, target_table, target_id, diff, ip, source, created_at', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (filters.action) query = query.eq('action', filters.action);
  if (filters.target_table) query = query.eq('target_table', filters.target_table);
  if (filters.from) query = query.gte('created_at', filters.from);
  if (filters.to) query = query.lte('created_at', filters.to);
  const { data, count, error } = await query;
  if (error) throw new Error('audit_unavailable');
  return { data: (data ?? []) as unknown as AuditRow[], total: count ?? 0 };
}

export interface OrderRow {
  id: string;
  order_number: string | null;
  status: string | null;
  total_eur: number | null;
  created_at: string;
  items: unknown;
  user_profiles: { full_name: string | null; email: string | null } | null;
}

export async function listOrdersPage(
  page: number,
  pageSize: number
): Promise<{ data: OrderRow[]; total: number }> {
  const { supabase } = await requireAdminOrRedirect('orders.read');
  const from = (page - 1) * pageSize;
  const { data, count, error } = await supabase
    .from('orders')
    .select('id, order_number, status, total_eur, created_at, items, user_profiles ( full_name, email )', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw new Error('orders_unavailable');
  return { data: (data ?? []) as unknown as OrderRow[], total: count ?? 0 };
}

export interface ModerationRow {
  id: string;
  contenu_type: string;
  contenu_id: string;
  statut: 'en_attente' | 'approuve' | 'rejete' | 'signale';
  moderateur_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function listModerationQueue(
  statut: string = 'en_attente'
): Promise<ModerationRow[]> {
  const { supabase } = await requireAdminOrRedirect('moderation.read');
  const { data, error } = await supabase
    .from('moderation_queue')
    .select('*')
    .eq('statut', statut)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw new Error('moderation_unavailable');
  return (data ?? []) as unknown as ModerationRow[];
}

export interface WithdrawalRow {
  id: string;
  user_id: string;
  amount: number;
  points_redeemed: number;
  status: string;
  payment_provider: string;
  requested_at: string;
  risk_score: number;
}

export async function listPendingWithdrawals(): Promise<WithdrawalRow[]> {
  const { supabase } = await requireAdminOrRedirect('rewards.read');
  const { data, error } = await supabase
    .from('reward_withdrawals')
    .select(
      'id, user_id, amount, points_redeemed, status, payment_provider, requested_at, risk_score'
    )
    .in('status', ['pending', 'under_review'])
    .order('requested_at', { ascending: true })
    .limit(100);
  if (error) throw new Error('withdrawals_unavailable');
  return (data ?? []) as unknown as WithdrawalRow[];
}

export interface OverviewCounts {
  products: number;
  orders: number;
  users: number;
  pendingWithdrawals: number;
}

export async function getOverviewCounts(): Promise<OverviewCounts> {
  const { supabase } = await requireAdminOrRedirect('users.read');
  const [products, orders, users, withdrawals] = await Promise.all([
    supabase.from('shop_products').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
    supabase
      .from('reward_withdrawals')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'under_review']),
  ]);
  const failed = [products, orders, users, withdrawals].find((r) => r.error);
  if (failed?.error) throw new Error('overview_unavailable');
  return {
    products: products.count ?? 0,
    orders: orders.count ?? 0,
    users: users.count ?? 0,
    pendingWithdrawals: withdrawals.count ?? 0,
  };
}

export interface ProductListRow {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  price_eur: number;
  stock: number;
  available: boolean;
  is_active: boolean;
  deleted_at: string | null;
  updated_at: string;
}

export async function listProductsPage(
  rawQ: string,
  page: number,
  pageSize: number
): Promise<{ data: ProductListRow[]; total: number }> {
  const { supabase } = await requireAdminOrRedirect('products.read');
  const q = sanitizeIlike(rawQ);
  const from = (page - 1) * pageSize;
  let query = supabase
    .from('shop_products')
    .select(
      'id, slug, name, brand, category, price_eur, stock, available, is_active, deleted_at, updated_at',
      { count: 'exact' }
    )
    .order('updated_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (q) query = query.or(`name.ilike.%${q}%,slug.ilike.%${q}%,brand.ilike.%${q}%`);
  const { data, count, error } = await query;
  if (error) throw new Error('products_unavailable');
  return { data: (data ?? []) as unknown as ProductListRow[], total: count ?? 0 };
}
