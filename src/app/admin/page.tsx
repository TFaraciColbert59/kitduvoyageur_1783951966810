import Link from 'next/link';

import { DashboardPageLayout } from '@/design';
import { EmptyState } from '@/components/ui';
import { getOverviewCounts } from '@/features/admin/queries';
import { formatPriceEur } from '@/features/admin/productUtils';
import { AdminNav } from './_components/AdminNav';

/** GET /admin — tableau de bord temps réel, zéro mock. */
export default async function AdminOverviewPage() {
  const counts = await getOverviewCounts();

  const kpis = [
    { label: 'Produits au catalogue', value: String(counts.products), href: '/admin/produits' },
    { label: 'Commandes', value: String(counts.orders), href: '/admin/commandes' },
    { label: 'Utilisateurs', value: String(counts.users), href: '/admin/utilisateurs' },
    {
      label: 'Retraits en attente',
      value: String(counts.pendingWithdrawals),
      href: '/admin/recompenses',
    },
  ];

  return (
    <DashboardPageLayout
      title="Administration"
      subtitle="Back-office LKDV — données temps réel, aucune donnée fictive"
      columns={2}
    >
      <div className="col-span-full">
        <AdminNav />
      </div>
      {kpis.map((kpi) => (
        <Link
          key={kpi.label}
          href={kpi.href}
          className="rounded-3xl border border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] p-5 shadow-[var(--glass-specular)] backdrop-blur-md"
        >
          <p className="text-sm text-[color:var(--glass-label-secondary)]">{kpi.label}</p>
          <p className="mt-1 text-3xl font-bold text-[color:var(--glass-label)]">{kpi.value}</p>
        </Link>
      ))}
      <div className="col-span-full">
        <EmptyState
          title="Journal d'audit actif"
          description="Chaque action sensible est journalisée côté serveur. Consultez les dernières entrées."
          actionLabel="Voir l'audit"
          actionHref="/admin/audit"
          compact
        />
      </div>
      <p className="col-span-full text-xs text-[color:var(--glass-label-tertiary)]">
        Devises affichées en euros — exemple : {formatPriceEur(0)}.
      </p>
    </DashboardPageLayout>
  );
}
