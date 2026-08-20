import Link from 'next/link';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { KitsKpiBar } from '@/features/materiel/components/kits/KitsKpiBar';
import { KitsGrid } from '@/features/materiel/components/kits/KitsGrid';
import { KitBuilder } from '@/features/materiel/components/kits/KitBuilder';
import { KitOptimizer } from '@/features/materiel/components/kits/KitOptimizer';
import { KitComparator } from '@/features/materiel/components/kits/KitComparator';
import { TemplateStore } from '@/features/materiel/components/kits/TemplateStore';
import { KitHistoryTimeline } from '@/features/materiel/components/kits/KitHistoryTimeline';
import { WeatherMatchScore } from '@/features/materiel/components/kits/WeatherMatchScore';
import { KitProductSuggestions } from '@/features/materiel/components/kits/KitProductSuggestions';
import { getKits } from '@/features/materiel/services/getKits';
import { getInventory } from '@/features/materiel/services/getInventory';
import { getPublicKits } from '@/features/materiel/services/getPublicKits';
import { getProductSuggestions } from '@/features/materiel/services/getProductSuggestions';
import { getKitHistory } from '@/features/materiel/services/getKitHistory';

export const dynamic = 'force-dynamic';

export default async function KitsPage() {
  const [kits, inventory, publicKits, products] = await Promise.all([
    getKits(), getInventory(), getPublicKits(), getProductSuggestions(),
  ]);

  const active = kits.filter((k) => !k.is_trashed);
  const firstKit = active[0] ?? null;
  const history = firstKit ? await getKitHistory(firstKit.id) : [];

  const avgCompletion = active.length
    ? active.reduce((s, k) => s + (k.item_count ? (k.checked_count / k.item_count) * 100 : 100), 0) / active.length
    : 0;
  const totalWeight = active.reduce((s, k) => s + k.total_weight_g, 0);
  const kpi = { active: active.length, avgCompletionPct: avgCompletion, totalWeightG: totalWeight, trash: kits.length - active.length };

  return (
    <main className="max-w-[var(--page-max-w)] mx-auto px-4 py-8 pb-24">
      <header className="flex items-center justify-between mb-6">
        <div>
          <Eyebrow>Mon Matériel</Eyebrow>
          <h1 className="font-display font-semibold text-[32px] tracking-tight text-[color:var(--label)]">Mes kits</h1>
        </div>
        <Link href="/materiel" className="glass interactive h-9 px-4 rounded-full flex items-center text-sm font-medium text-sage-600">
          ← Retour
        </Link>
      </header>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12"><KitsKpiBar kpi={kpi} /></div>
        <div className="col-span-12"><KitsGrid kits={kits} /></div>
        <div className="col-span-12" aria-label="Assembleur de kit"><KitBuilder inventory={inventory} initialKitItems={[]} /></div>
        <div className="col-span-12"><KitOptimizer kits={kits} /></div>
        <div className="col-span-12 md:col-span-6"><KitComparator kits={kits} /></div>
        <div className="col-span-12 md:col-span-6"><WeatherMatchScore season={firstKit?.season ?? null} /></div>
        <div className="col-span-12"><TemplateStore kits={publicKits} /></div>
        <div className="col-span-12"><KitHistoryTimeline history={history} /></div>
        <div className="col-span-12"><KitProductSuggestions products={products} /></div>
      </div>
    </main>
  );
}
