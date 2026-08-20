import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';
import type { OccasionProduct } from '@/features/materiel/services/getOccasionProducts';

/** W-L-9 OccasionMarketplace — marketplace occasion. */
export function OccasionMarketplace({ products }: { products: OccasionProduct[] }) {
  return (
    <GlassCard as="article" ariaLabelledBy="occasion-title" className="p-4">
      <Eyebrow>Occasion</Eyebrow>
      <h3 id="occasion-title" className="sr-only">Marketplace occasion</h3>
      <div className="mt-3 flex gap-3 overflow-x-auto no-scrollbar">
        {products.map((p) => (
          <Link key={p.id} href={`/produit/${p.slug}`} className="bg-white/60 rounded-[var(--r-md)] block w-[168px] shrink-0 p-3" aria-label={p.name}>
            <p className="text-sm font-medium text-[color:var(--label)] line-clamp-2">{p.name}</p>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-display font-semibold text-[15px] text-[color:var(--label)]">{p.priceEur.toFixed(0)} €</span>
              {p.condition && <Badge tone="stone">{p.condition}</Badge>}
            </div>
          </Link>
        ))}
        {products.length === 0 && <p className="text-sm text-[color:var(--label-secondary)]">Aucune annonce d'occasion disponible.</p>}
      </div>
    </GlassCard>
  );
}
