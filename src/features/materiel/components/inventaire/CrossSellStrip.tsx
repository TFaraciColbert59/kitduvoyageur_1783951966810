import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { ProductGlassCard } from '@/components/ui/ProductGlassCard';
import type { ProductSuggestion } from '@/features/materiel/services/getProductSuggestions';

/** W-I-10 CrossSellStrip — cross-sell IA boutique (ProductGlassCard). */
export function CrossSellStrip({ products }: { products: ProductSuggestion[] }) {
  return (
    <GlassCard as="article" ariaLabelledBy="cross-sell-title" className="p-4">
      <Eyebrow>Suggestions pour compléter</Eyebrow>
      <h3 id="cross-sell-title" className="sr-only">Produits suggérés pour votre inventaire</h3>
      <div className="mt-3 flex gap-3 overflow-x-auto no-scrollbar">
        {products.map((p) => (
          <ProductGlassCard
            key={p.id}
            name={p.name}
            imageUrl={p.image}
            price={`${p.priceEur.toFixed(2)} €`}
            href={`/produit/${p.slug}`}
          />
        ))}
        {products.length === 0 && <p className="text-sm text-[color:var(--label-secondary)]">Aucune suggestion pour le moment.</p>}
      </div>
    </GlassCard>
  );
}
