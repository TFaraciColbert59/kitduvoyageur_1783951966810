import Link from 'next/link';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { InventoryOverview } from '@/features/materiel/components/inventaire/InventoryOverview';
import { InventoryWorkspace } from '@/features/materiel/components/inventaire/InventoryWorkspace';
import { PurchasesInvest } from '@/features/materiel/components/inventaire/PurchasesInvest';
import { AiInsightBanner } from '@/features/materiel/components/inventaire/AiInsightBanner';
import { CrossSellStrip } from '@/features/materiel/components/inventaire/CrossSellStrip';
import type { Insight } from '@/features/materiel/components/inventaire/AiInsightBanner';
import { getInventory } from '@/features/materiel/services/getInventory';
import { getProductSuggestions } from '@/features/materiel/services/getProductSuggestions';

export const dynamic = 'force-dynamic';

export default async function InventairePage() {
  const [items, products] = await Promise.all([getInventory(), getProductSuggestions()]);

  const totalWeight = items.reduce((s, i) => s + (i.weight_g ?? 0), 0);
  const lent = items.filter((i) => i.is_lent).length;
  const toReplace = items.filter((i) => i.condition === 'a_remplacer' || i.condition === 'pour_pieces').length;
  const reliability = Math.max(0, 100 - toReplace * 12 - items.filter((i) => i.maintenance_due_at && new Date(i.maintenance_due_at) < new Date()).length * 5);
  const totalInvestment = items.reduce((s, i) => s + (i.price_cents ?? 0), 0);

  const byMonth = new Map<string, number>();
  for (const i of items) {
    if (!i.purchase_date) continue;
    const month = i.purchase_date.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + (i.price_cents ?? 0));
  }
  const purchasesSeries = Array.from(byMonth.entries())
    .map(([month, v]) => ({ month, valueEur: Math.round(v / 100) }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12);

  const insights: Insight[] = [];
  if (toReplace > 0) insights.push({ title: `${toReplace} à remplacer`, body: 'Certains objets ont un état dégradé. Pensez à les remplacer.', tone: 'danger' });
  if (lent > 0) insights.push({ title: `${lent} en prêt`, body: 'Des objets sont actuellement prêtés et indisponibles.', tone: 'warn' });
  if (items.length === 0) insights.push({ title: 'Inventaire vide', body: 'Ajoutez vos premiers objets pour piloter votre équipement.', tone: 'info' });
  if (items.length > 0 && totalWeight > 0) insights.push({ title: `${(totalWeight / 1000).toFixed(1)} kg`, body: 'Poids total de votre équipement.', tone: 'sage' });

  return (
    <main className="max-w-[var(--page-max-w)] mx-auto px-4 py-8 pb-28">
      <header className="flex items-center justify-between mb-6">
        <div>
          <Eyebrow>Mon Matériel</Eyebrow>
          <h1 className="font-display font-semibold text-[32px] tracking-tight text-[color:var(--label)]">Inventaire</h1>
        </div>
        <Link href="/materiel" className="glass-capsule-btn secondary">
          ← Retour
        </Link>
      </header>

      <div className="grid grid-cols-12 gap-[var(--grid-gap)]">
        <div className="col-span-12"><InventoryOverview data={{ count: items.length, totalWeightG: totalWeight, lentCount: lent, reliabilityPct: reliability }} /></div>
        <div className="col-span-12"><InventoryWorkspace items={items} /></div>
        <div className="col-span-12 md:col-span-6"><PurchasesInvest series={purchasesSeries} totalEur={totalInvestment / 100} /></div>
        <div className="col-span-12 md:col-span-6"><AiInsightBanner insights={insights} /></div>
        <div className="col-span-12"><CrossSellStrip products={products} /></div>
      </div>
    </main>
  );
}

