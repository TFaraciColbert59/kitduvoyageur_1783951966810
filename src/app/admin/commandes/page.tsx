import Link from 'next/link';

import { EmptyState } from '@/components/ui';
import { ROUTES } from '../_os/routeConfig';
import { Hero, MetricGrid, DataPanel } from '../_os/panels';
import { InspectorBox } from '../_os/osUi';
import { ReportButton } from '../_os/ReportButton';
import { listOrdersPage } from '@/features/admin/queries';
import { getOrdersStats } from '@/features/admin/osQueries';
import { formatPriceEur } from '@/features/admin/productUtils';

const PAGE_SIZE = 20;

interface SearchParams {
  page?: string;
}

/** GET /admin/commandes — Marketplace (Admin OS). */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  const cfg = ROUTES['market'];

  const [result, stats] = await Promise.all([
    listOrdersPage(page, PAGE_SIZE).catch(() => null),
    getOrdersStats().catch(() => null),
  ]);

  if (!result || !stats) {
    return (
      <>
        <Hero eyebrow={cfg.eyebrow} title={cfg.title} subtitle={cfg.subtitle} actions={<ReportButton section="orders" label="Exporter" />} />
        <EmptyState title="Lecture impossible" description="Permission orders.read requise." />
      </>
    );
  }

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <>
      <Hero
        eyebrow={cfg.eyebrow}
        title={cfg.title}
        subtitle={cfg.subtitle}
        actions={<ReportButton section="orders" label="Exporter" />}
      />
      <MetricGrid
        metrics={[
          { label: 'GMV total', value: `${(stats.gmv / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k€`, delta: `${stats.total} commandes`, icon: 'bag' },
          { label: 'Commandes', value: String(stats.total), delta: 'toutes périodes', icon: 'pulse' },
          { label: 'Panier moyen', value: stats.total > 0 ? formatPriceEur(stats.gmv / stats.total) : '—', delta: 'par commande', icon: 'check' },
          { label: 'Dernière', value: stats.latest ? stats.latest.label.split('·')[0].trim() : '—', delta: stats.latest?.detail ?? '', icon: 'clock' },
        ]}
      />
      <section className="os-workspace">
        <div className="os-workspace-primary">
          <DataPanel label="COMMERCE" title="Transactions" chip={`${result.total} commandes`} kind="table" rows={[]}>
            {result.data.length === 0 ? (
              <EmptyState title="Aucune commande" description="Aucune commande enregistrée." />
            ) : (
              <ul className="os-rows">
                {result.data.map((o) => {
                  const items = Array.isArray(o.items) ? o.items : [];
                  return (
                    <li key={o.id} className="os-row">
                      <span className="os-row-copy">
                        <strong>
                          {o.order_number || o.id.slice(0, 8)} · {o.total_eur !== null ? formatPriceEur(o.total_eur) : '—'}
                        </strong>
                        <small>
                          {new Date(o.created_at).toLocaleString('fr-FR')} · statut : {o.status ?? '—'} · {items.length} article(s)
                          {o.user_profiles?.email ? ` · ${o.user_profiles.email}` : ''}
                        </small>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <nav aria-label="Pagination" className="os-pagination">
              {page > 1 ? <Link href={`/admin/commandes?page=${page - 1}`}>← Précédent</Link> : null}
              <span>Page {page} / {totalPages}</span>
              {page < totalPages ? <Link href={`/admin/commandes?page=${page + 1}`}>Suivant →</Link> : null}
            </nav>
          </DataPanel>
        </div>
        <InspectorBox
          content={{
            title: 'Trust & Verification',
            subtitle: 'Dernière commande',
            headline: stats.latest ? stats.latest.label : 'Aucune commande',
            text: stats.latest ? stats.latest.detail : 'Aucune transaction enregistrée.',
            rows: stats.latest
              ? [{ title: 'Commande', detail: 'la plus récente', value: stats.latest.label.split('·')[0].trim(), tone: 'info' }]
              : [],
          }}
        />
      </section>
    </>
  );
}
