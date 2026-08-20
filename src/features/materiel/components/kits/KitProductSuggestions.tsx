import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { ProductGlassCard } from '@/components/ui/ProductGlassCard';
import type { ProductSuggestion } from '@/features/materiel/services/getProductSuggestions';

/** W-K-10 KitProductSuggestions — cross-sell boutique (ProductGlassCard). */
export function KitProductSuggestions({ products }: { products: ProductSuggestion[] }) {
  return (
    <GlassCard as="article" ariaLabelledBy="suggestions-title" className="p-4">
      <Eyebrow>Suggestions produits</Eyebrow>
      <h3 id="suggestions-title" className="sr-only">Produits recommandés pour vos kits</h3>
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
        {products.length === 0 && (
          <p className="text-sm text-[color:var(--label-secondary)]">Aucun produit disponible pour le moment.</p>
        )}
      </div>
    </GlassCard>
  );
}
