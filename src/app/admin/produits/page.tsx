import Link from 'next/link';

import { Button, EmptyState } from '@/components/ui';
import { ROUTES } from '../_os/routeConfig';
import { Hero, MetricGrid, DataPanel } from '../_os/panels';
import { InspectorBox } from '../_os/osUi';
import { ReportButton } from '../_os/ReportButton';
import { AdminField, AdminInput } from '../_components/AdminField';
import { CsvExportButton } from '../_components/CsvExportButton';
import { listProductsPage } from '@/features/admin/queries';
import { getProductsStats } from '@/features/admin/osQueries';
import { formatPriceEur } from '@/features/admin/productUtils';

const PAGE_SIZE = 20;

interface SearchParams {
  q?: string;
  page?: string;
}

/** GET /admin/produits — catalogue (Admin OS). */
export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? '').slice(0, 120);
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  const cfg = ROUTES['gear'];

  const [result, stats] = await Promise.all([
    listProductsPage(q, page, PAGE_SIZE).catch(() => null),
    getProductsStats().catch(() => null),
  ]);

  if (!result || !stats) {
    return (
      <>
        <Hero eyebrow={cfg.eyebrow} title={cfg.title} subtitle={cfg.subtitle} actions={<ReportButton section="products" label="Exporter" />} />
        <EmptyState title="Lecture impossible" description="Permission products.read requise." />
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
        actions={
          <>
            <ReportButton section="products" label="Exporter" />
            <Link className="os-btn os-tint" href="/admin/produits/nouveau">
              {cfg.ctaLabel}
            </Link>
          </>
        }
      />
      <MetricGrid
        metrics={[
          { label: 'Produits', value: String(stats.total), delta: 'références actives', icon: 'backpack' },
          { label: 'Valeur stock', value: `${(stats.stockValue / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k€`, delta: 'prix × stock', icon: 'bag' },
          { label: 'Stock bas', value: stats.lowStock ? `${stats.lowStock.stock}` : '0', delta: stats.lowStock?.name ?? 'aucun', icon: 'warning', tone: stats.lowStock ? 'warn' : undefined },
          { label: 'Inactifs', value: String(stats.inactive), delta: 'masqués boutique', icon: 'check' },
        ]}
      />
      <section className="os-workspace">
        <div className="os-workspace-primary">
          <DataPanel label="INVENTAIRE" title="Gear Intelligence" chip={`${result.total} produit(s)`} kind="table" rows={[]}>
            <div className="flex flex-wrap items-end gap-2">
              <form method="get" className="flex items-end gap-2">
                <AdminField label="Recherche (nom, slug, marque)">
                  <AdminInput name="q" defaultValue={q} placeholder="osprey…" maxLength={120} />
                </AdminField>
                <Button variant="secondary" type="submit">
                  Filtrer
                </Button>
              </form>
              <CsvExportButton q={q} />
            </div>
            {result.data.length === 0 ? (
              <EmptyState title="Aucun produit" description="Aucun produit ne correspond." />
            ) : (
              <ul className="os-rows">
                {result.data.map((p) => (
                  <li key={p.id} className="os-row">
                    <span className="os-row-copy">
                      <strong>
                        <Link href={`/admin/produits/${p.id}`}>{p.name}</Link>
                      </strong>
                      <small>
                        {p.brand} · {p.category} · {formatPriceEur(p.price_eur)} · stock {p.stock}
                        {!p.is_active ? ' · inactif' : ''}
                        {p.deleted_at ? ' · archivé' : ''}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <nav aria-label="Pagination" className="os-pagination">
              {page > 1 ? <Link href={`/admin/produits?q=${encodeURIComponent(q)}&page=${page - 1}`}>← Précédent</Link> : null}
              <span>Page {page} / {totalPages}</span>
              {page < totalPages ? <Link href={`/admin/produits?q=${encodeURIComponent(q)}&page=${page + 1}`}>Suivant →</Link> : null}
            </nav>
          </DataPanel>
        </div>
        <InspectorBox
          content={{
            title: 'Kit Readiness',
            subtitle: 'Stock critique',
            headline: stats.lowStock ? `${stats.lowStock.name} · ${stats.lowStock.stock} restants` : 'Stocks sains',
            text: stats.lowStock ? 'Le produit le plus bas doit être réapprovisionné ou archivé.' : 'Aucun produit sous le seuil.',
            rows: stats.lowStock
              ? [{ title: 'Stock', detail: stats.lowStock.name, value: `${stats.lowStock.stock}`, tone: 'warn' as const }]
              : [],
          }}
        />
      </section>
    </>
  );
}
