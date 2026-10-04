'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button, ErrorState, Spinner } from '@/components/ui';
import { useAdminFetch } from './useCsrfToken';
import { ProductEditor, type ProductFormState } from './ProductEditor';
import { ProductImagesManager } from './ProductImagesManager';
import { StockAdjust } from './StockAdjust';
import type { ProductImage, ShopProduct, StockMovement } from '@/features/admin/productUtils';

interface Detail {
  product: ShopProduct;
  images: ProductImage[];
  movements: StockMovement[];
}

function toForm(p: ShopProduct): Partial<ProductFormState> {
  return {
    name: p.name,
    slug: p.slug,
    brand: p.brand ?? '',
    model: p.model ?? '',
    category: p.category ?? '',
    category_main: p.category_main ?? '',
    category_sub: p.category_sub ?? '',
    price_eur: String(p.price_eur ?? 0),
    original_price: p.original_price != null ? String(p.original_price) : '',
    weight_g: String(p.weight_g ?? 0),
    stock: String(p.stock ?? 0),
    dimensions: p.dimensions ?? '',
    materials: p.materials ?? '',
    warranty: p.warranty ?? '',
    description_why: p.description_why ?? '',
    advantages: (p.advantages_array ?? []).join('\n'),
    disadvantages: (p.disadvantages_array ?? []).join('\n'),
    essentiality: p.essentiality ?? 'Recommandé',
    transaction_type: p.transaction_type ?? 'achat',
    score_kdv: String(p.score_kdv ?? 0),
    rating: String(p.rating ?? 0),
    image: p.image ?? '',
    image_alt: p.image_alt ?? '',
    available: p.available ?? true,
    is_active: p.is_active ?? true,
    available_europe: p.available_europe ?? true,
    available_usa: p.available_usa ?? false,
    cabin_compatible: p.cabin_compatible ?? false,
  };
}

/** Îlot client : fiche produit complète (édition + visuels + stock + archivage). */
export function ProductDetailLoader({ id }: { id: string }) {
  const { call } = useAdminFetch();
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [failed, setFailed] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/products/${id}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled) {
          if (j?.data) setDetail(j.data as Detail);
          else setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (failed) return <ErrorState title="Fiche inaccessible" message="Produit introuvable." />;
  if (!detail) return <Spinner label="Chargement du produit…" />;

  const archived = detail.product.deleted_at !== null;

  async function archive() {
    setArchiving(true);
    const res = await call(`/api/admin/products/${id}`, { method: 'DELETE' });
    setArchiving(false);
    if (res.ok) router.push('/admin/produits');
  }

  return (
    <div className="flex flex-col gap-6">
      {archived ? (
        <p role="status" className="text-sm font-semibold text-[color:var(--lkv-danger)]">
          Produit archivé (lecture seule) — la restauration se fait en base
          (désarchivage volontairement absent de l&apos;UI).
        </p>
      ) : null}
      <section aria-label="Édition">
        <h2 className="mb-2 text-lg font-bold text-[color:var(--glass-label)]">Édition</h2>
        <ProductEditor productId={id} initial={toForm(detail.product)} />
      </section>
      <section aria-label="Visuels">
        <h2 className="mb-2 text-lg font-bold text-[color:var(--glass-label)]">Visuels</h2>
        <ProductImagesManager productId={id} images={detail.images} />
      </section>
      <section aria-label="Stock">
        <h2 className="mb-2 text-lg font-bold text-[color:var(--glass-label)]">Stock</h2>
        <StockAdjust
          productId={id}
          currentStock={detail.product.stock ?? 0}
          movements={detail.movements}
        />
      </section>
      {!archived ? (
        <div>
          <Button variant="destructive" size="sm" disabled={archiving} onClick={archive}>
            Archiver le produit
          </Button>
        </div>
      ) : null}
    </div>
  );
}
