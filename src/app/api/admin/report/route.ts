import { NextRequest } from 'next/server';

import { requireAdmin } from '@/server/admin/requireAdmin';
import { fail, ok } from '@/server/admin/respond';
import { readCorrelationId } from '@/lib/observability/correlation';
import { logAdminAction } from '@/server/admin/audit';
import {
  listAuditPage,
  listOrdersPage,
  listPendingWithdrawals,
  listProductsPage,
  listUsersPage,
} from '@/features/admin/queries';
import { getOverviewMetrics, getPriorityQueue } from '@/features/admin/osQueries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SECTIONS = [
  'overview',
  'users',
  'products',
  'orders',
  'moderation',
  'rewards',
  'audit',
] as const;

type Section = (typeof SECTIONS)[number];

const PERMISSION: Record<Section, string> = {
  overview: 'users.read',
  users: 'users.read',
  products: 'products.read',
  orders: 'orders.read',
  moderation: 'moderation.read',
  rewards: 'rewards.read',
  audit: 'audit.read',
};

/**
 * GET /api/admin/report?section= — dataset CSV d'une section (Rapport).
 * Données réelles uniquement, journalisé (export = action sensible).
 */
export async function GET(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const section = req.nextUrl.searchParams.get('section') as Section | null;
  if (!section || !SECTIONS.includes(section)) {
    return fail('unknown_section', 'Section inconnue', 400, correlationId ?? undefined);
  }
  const gate = await requireAdmin(PERMISSION[section]);
  if (!gate.ok) return gate.response;

  const out: { columns: string[]; rows: (string | number)[][] } = { columns: [], rows: [] };
  try {
    switch (section) {
      case 'overview': {
        const [m, q] = await Promise.all([getOverviewMetrics(), getPriorityQueue(50)]);
        out.columns = ['indicateur', 'valeur'];
        out.rows = [
          ['Utilisateurs', m.users],
          ['Nouveaux ce mois', m.usersNewMonth],
          ['GMV €', Math.round(m.gmv * 100) / 100],
          ['Commandes', m.orders],
          ['Confiance moyenne', m.trustAvg ?? '—'],
          ['À traiter', m.todo],
          ...q.map((i) => [`${i.level} ${i.title}`, `${i.detail}`] as (string | number)[]),
        ];
        break;
      }
      case 'users': {
        const r = await listUsersPage('', 1, 1000);
        out.columns = ['id', 'nom', 'email', 'fidélité', 'confiance', 'rôles'];
        out.rows = r.data.map((u) => [u.id, u.full_name ?? '', u.email ?? '', u.loyalty_level ?? '', u.trust_score ?? '', u.roles.join(' ')]);
        break;
      }
      case 'products': {
        const r = await listProductsPage('', 1, 1000);
        out.columns = ['id', 'slug', 'nom', 'marque', 'prix €', 'stock', 'actif'];
        out.rows = r.data.map((p) => [p.id, p.slug, p.name, p.brand, p.price_eur, p.stock, p.is_active ? 'oui' : 'non']);
        break;
      }
      case 'orders': {
        const r = await listOrdersPage(1, 1000);
        out.columns = ['id', 'numéro', 'statut', 'total €', 'client', 'créée le'];
        out.rows = r.data.map((o) => [o.id, o.order_number ?? '', o.status ?? '', o.total_eur ?? '', o.user_profiles?.email ?? '', o.created_at]);
        break;
      }
      case 'moderation': {
        const { listModerationQueue } = await import('@/features/admin/queries');
        const q = await listModerationQueue('en_attente');
        out.columns = ['id', 'type', 'cible', 'créée le'];
        out.rows = q.map((m) => [m.id, m.contenu_type, m.contenu_id, m.created_at]);
        break;
      }
      case 'rewards': {
        const w = await listPendingWithdrawals();
        out.columns = ['id', 'utilisateur', 'montant €', 'points', 'statut'];
        out.rows = w.map((x) => [x.id, x.user_id, x.amount, x.points_redeemed, x.status]);
        break;
      }
      case 'audit': {
        const r = await listAuditPage({}, 1, 1000);
        out.columns = ['id', 'acteur', 'action', 'cible', 'créée le'];
        out.rows = r.data.map((a) => [a.id, a.actor_id ?? '', a.action, `${a.target_table ?? ''}/${a.target_id ?? ''}`, a.created_at]);
        break;
      }
    }
  } catch {
    return fail('export_failed', 'Export impossible', 500, correlationId ?? undefined);
  }

  await logAdminAction({
    action: 'report.export',
    actor_id: gate.ctx.user.id,
    target_table: 'report',
    target_id: section,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    user_agent: req.headers.get('user-agent') ?? undefined,
  });
  const res = ok(
    { ...out, total: out.rows.length },
    { correlationId: correlationId ?? undefined }
  );
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
