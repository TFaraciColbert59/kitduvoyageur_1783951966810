import Link from 'next/link';
import { Badge, Card, EmptyState } from '@/components/ui';
import { Eyebrow } from '@/components/ui/Eyebrow';
import type { OccasionProduct } from '@/features/materiel/services/getOccasionProducts';

/** W-L-9 OccasionMarketplace — marketplace occasion. */
export function OccasionMarketplace({ products }: { products: OccasionProduct[] }) {
  return (
    <Card as="article" ariaLabelledBy="occasion-title" className="p-4">
      <Eyebrow>Occasion</Eyebrow>
      <h3 id="occasion-title" className="sr-only">Marketplace occasion</h3>
      <div className="mt-3 flex gap-3 overflow-x-auto no-scrollbar">
        {products.map((p) => (
          <Link key={p.id} href={`/produit/${p.slug}`} className="block w-[168px] shrink-0 rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset p-3" aria-label={p.name}>
            <p className="line-clamp-2 text-sm font-medium text-[color:var(--lkv-text-primary)]">{p.name}</p>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-display text-[15px] font-semibold text-[color:var(--lkv-text-primary)]">{p.priceEur.toFixed(0)} €</span>
              {p.condition && <Badge tone="stone">{p.condition}</Badge>}
            </div>
          </Link>
        ))}
        {products.length === 0 && <EmptyState compact title="Aucune annonce d'occasion disponible." />}
      </div>
    </Card>
  );
}
