import Link from 'next/link';

import { Button, EmptyState } from '@/components/ui';
import { PageLayout } from '@/design';
import { listProductsPage } from '@/features/admin/queries';
import { formatPriceEur } from '@/features/admin/productUtils';
import { AdminNav } from '../_components/AdminNav';
import { AdminField, AdminInput } from '../_components/AdminField';
import { CsvExportButton } from '../_components/CsvExportButton';

const PAGE_SIZE = 20;

interface SearchParams {
  q?: string;
  page?: string;
}

/** GET /admin/produits — catalogue temps réel + export CSV. */
export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? '').slice(0, 120);
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);

  let result: Awaited<ReturnType<typeof listProductsPage>>;
  try {
    result = await listProductsPage(q, page, PAGE_SIZE);
  } catch {
    return (
      <PageLayout title="Produits" subtitle="Catalogue boutique">
        <AdminNav />
        <EmptyState
          title="Lecture impossible"
          description="Permission products.read requise."
        />
      </PageLayout>
    );
  }

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <PageLayout title="Produits" subtitle={`${result.total} produit(s)`}>
      <AdminNav />
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
        <Link href="/admin/produits/nouveau">
          <Button variant="primary">Nouveau produit</Button>
        </Link>
      </div>

      {result.data.length === 0 ? (
        <EmptyState title="Aucun produit" description="Aucun produit ne correspond." />
      ) : (
        <ul className="flex flex-col gap-3">
          {result.data.map((p) => (
            <li
              key={p.id}
              className="rounded-3xl border border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] p-4 backdrop-blur-md"
            >
              <Link href={`/admin/produits/${p.id}`}>
                <span className="font-semibold text-[color:var(--glass-label)]">{p.name}</span>
              </Link>
              <p className="text-xs text-[color:var(--glass-label-secondary)]">
                {p.brand} · {p.category} · {formatPriceEur(p.price_eur)} · stock {p.stock}
                {!p.is_active ? ' · inactif' : ''}
                {p.deleted_at ? ' · archivé' : ''}
              </p>
            </li>
          ))}
        </ul>
      )}

      <nav aria-label="Pagination" className="flex items-center gap-3">
        {page > 1 ? (
          <Link href={`/admin/produits?q=${encodeURIComponent(q)}&page=${page - 1}`}>
            ← Précédent
          </Link>
        ) : null}
        <span className="text-sm text-[color:var(--glass-label-secondary)]">
          Page {page} / {totalPages}
        </span>
        {page < totalPages ? (
          <Link href={`/admin/produits?q=${encodeURIComponent(q)}&page=${page + 1}`}>
            Suivant →
          </Link>
        ) : null}
      </nav>
    </PageLayout>
  );
}
