import Link from 'next/link';

import { EmptyState } from '@/components/ui';
import { PageLayout } from '@/design';
import { listOrdersPage } from '@/features/admin/queries';
import { formatPriceEur } from '@/features/admin/productUtils';
import { AdminNav } from '../_components/AdminNav';

const PAGE_SIZE = 20;

interface SearchParams {
  page?: string;
}

/** GET /admin/commandes — lecture seule des commandes. */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);

  let result: Awaited<ReturnType<typeof listOrdersPage>>;
  try {
    result = await listOrdersPage(page, PAGE_SIZE);
  } catch {
    return (
      <PageLayout title="Commandes" subtitle="Suivi des commandes">
        <AdminNav />
        <EmptyState
          title="Lecture impossible"
          description="Permission orders.read requise."
        />
      </PageLayout>
    );
  }

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <PageLayout title="Commandes" subtitle={`${result.total} commande(s)`}>
      <AdminNav />
      {result.data.length === 0 ? (
        <EmptyState title="Aucune commande" description="Aucune commande enregistrée." />
      ) : (
        <ul className="flex flex-col gap-3">
          {result.data.map((o) => {
            const items = Array.isArray(o.items) ? o.items : [];
            return (
              <li
                key={o.id}
                className="rounded-3xl border border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] p-4 backdrop-blur-md"
              >
                <p className="font-semibold text-[color:var(--glass-label)]">
                  {o.order_number || o.id.slice(0, 8)} ·{' '}
                  {o.total_eur !== null ? formatPriceEur(o.total_eur) : '—'}
                </p>
                <p className="text-xs text-[color:var(--glass-label-secondary)]">
                  {new Date(o.created_at).toLocaleString('fr-FR')} · statut : {o.status ?? '—'} ·{' '}
                  {items.length} article(s)
                  {o.user_profiles?.email ? ` · ${o.user_profiles.email}` : ''}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      <nav aria-label="Pagination" className="flex items-center gap-3">
        {page > 1 ? <Link href={`/admin/commandes?page=${page - 1}`}>← Précédent</Link> : null}
        <span className="text-sm text-[color:var(--glass-label-secondary)]">
          Page {page} / {totalPages}
        </span>
        {page < totalPages ? <Link href={`/admin/commandes?page=${page + 1}`}>Suivant →</Link> : null}
      </nav>
    </PageLayout>
  );
}
