import { getInventoryStatus } from '@/features/materiel/domain/inventory';
import { getInventoryCatalog } from '@/features/materiel/services/getInventoryCatalog';
import { InventoryOverview } from '@/features/materiel/components/inventaire/InventoryOverview';
import { InventoryWorkspace } from '@/features/materiel/components/inventaire/InventoryWorkspace';
import { PurchasesInvest } from '@/features/materiel/components/inventaire/PurchasesInvest';
import {
  AiInsightBanner,
  type Insight,
} from '@/features/materiel/components/inventaire/AiInsightBanner';
import { CrossSellStrip } from '@/features/materiel/components/inventaire/CrossSellStrip';
import { getInventory } from '@/features/materiel/services/getInventory';
import { getProductSuggestions } from '@/features/materiel/services/getProductSuggestions';

/**
 * H4.2 — Section inventaire du hub (composition des composants canoniques
 * inventaire : mêmes composants, mêmes services, mêmes dérivations — le
 * chrome hub remplace l'en-tête de page). /materiel/inventaire redirige
 * 307 ici (H-AUTO-42).
 */
export async function HubInventaireSection({ productId }: { productId?: string } = {}) {
  const [items, products] = await Promise.all([getInventory(), getProductSuggestions()]);

  const owned = items.filter((i) => !['vendu', 'a_acheter'].includes(getInventoryStatus(i)));
  const catalog = await getInventoryCatalog([
    ...items.flatMap((i) => (i.product_id ? [i.product_id] : [])),
    ...(productId ? [productId] : []),
  ]);
  const initialProduct = catalog.find((p) => p.id === productId) ?? null;
  const catalogLinks = Object.fromEntries(catalog.map((p) => [p.id, p.slug]));
  const totalWeight = owned.reduce((s, i) => s + (i.weight_g ?? 0) * (i.quantity ?? 1), 0);
  const lent = owned.filter((i) => getInventoryStatus(i) === 'en_pret').length;
  const toReplace = owned.filter(
    (i) => i.condition === 'a_remplacer' || i.condition === 'pour_pieces'
  ).length;
  const reliability = Math.max(
    0,
    100 -
      toReplace * 12 -
      owned.filter((i) => i.maintenance_due_at && new Date(i.maintenance_due_at) < new Date())
        .length *
        5
  );
  const totalInvestment = owned.reduce((s, i) => s + (i.price_cents ?? 0) * (i.quantity ?? 1), 0);

  const byMonth = new Map<string, number>();
  for (const i of owned) {
    if (!i.purchase_date) continue;
    const month = i.purchase_date.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + (i.price_cents ?? 0));
  }
  const purchasesSeries = Array.from(byMonth.entries())
    .map(([month, v]) => ({ month, valueEur: Math.round(v / 100) }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12);

  const insights: Insight[] = [];
  if (toReplace > 0)
    insights.push({
      title: `${toReplace} à remplacer`,
      body: 'Certains objets ont un état dégradé. Pensez à les remplacer.',
      tone: 'danger',
    });
  if (lent > 0)
    insights.push({
      title: `${lent} en prêt`,
      body: 'Des objets sont actuellement prêtés et indisponibles.',
      tone: 'warn',
    });
  if (owned.length === 0)
    insights.push({
      title: 'Inventaire vide',
      body: 'Ajoutez vos premiers objets pour piloter votre équipement.',
      tone: 'info',
    });
  if (owned.length > 0 && totalWeight > 0)
    insights.push({
      title: `${(totalWeight / 1000).toFixed(1)} kg`,
      body: 'Poids total de votre équipement.',
      tone: 'sage',
    });

  return (
    <div className="grid grid-cols-12 gap-[var(--grid-gap)]">
      <div className="col-span-12">
        <InventoryOverview
          data={{
            count: owned.length,
            totalWeightG: totalWeight,
            lentCount: lent,
            reliabilityPct: reliability,
          }}
        />
      </div>
      <div className="col-span-12">
        <InventoryWorkspace
          items={items}
          initialProduct={initialProduct}
          catalogLinks={catalogLinks}
        />
      </div>
      <div className="col-span-12 md:col-span-6">
        <PurchasesInvest series={purchasesSeries} totalEur={totalInvestment / 100} />
      </div>
      <div className="col-span-12 md:col-span-6">
        <AiInsightBanner insights={insights} />
      </div>
      <div className="col-span-12">
        <CrossSellStrip products={products} />
      </div>
    </div>
  );
}

export default HubInventaireSection;
