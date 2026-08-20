import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Metric } from '@/components/ui/Metric';
import { Badge } from '@/components/ui/Badge';
import { getKits } from '@/features/materiel/services/getKits';
import { getInventory } from '@/features/materiel/services/getInventory';
import { KitBuilder } from '@/features/materiel/components/kits/KitBuilder';

export const dynamic = 'force-dynamic';

export default async function KitsPage() {
  const [kits, inventory] = await Promise.all([getKits(), getInventory()]);
  const active = kits.filter((k) => !k.is_trashed);
  const avgCompletion = active.length
    ? active.reduce((s, k) => s + (k.item_count ? (k.checked_count / k.item_count) * 100 : 100), 0) / active.length
    : 0;
  const totalWeight = active.reduce((s, k) => s + k.total_weight_g, 0);

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

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" aria-label="Indicateurs clés">
        <GlassCard className="p-4"><Eyebrow>Kits actifs</Eyebrow><Metric value={active.length} /></GlassCard>
        <GlassCard className="p-4"><Eyebrow>Complétude moyenne</Eyebrow><Metric value={`${Math.round(avgCompletion)}%`} tone="sage" /></GlassCard>
        <GlassCard className="p-4"><Eyebrow>Poids total</Eyebrow><Metric value={(totalWeight / 1000).toFixed(1)} unit="kg" /></GlassCard>
        <GlassCard className="p-4"><Eyebrow>En corbeille</Eyebrow><Metric value={kits.length - active.length} /></GlassCard>
      </section>

      <section className="grid grid-cols-12 gap-4 mb-6">
        <GlassCard className="col-span-12 md:col-span-9 p-4" aria-labelledby="kits-grid">
          <h2 id="kits-grid" className="sr-only">Grille de kits</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {active.map((k) => {
              const pct = k.item_count ? (k.checked_count / k.item_count) * 100 : 100;
              return (
                <Link key={k.id} href={`/materiel/kits`} className="glass interactive p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-semibold text-[17px] text-[color:var(--label)]">{k.name}</span>
                    {k.is_favorite && <Badge tone="sage">★</Badge>}
                  </div>
                  {k.description && <p className="text-xs text-[color:var(--label-tertiary)] line-clamp-2">{k.description}</p>}
                  <div className="text-xs text-[color:var(--label-secondary)]">{(k.total_weight_g / 1000).toFixed(1)} kg · {k.item_count} article(s)</div>
                  <div className="h-1.5 w-full rounded-full bg-stone-200/70 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-sage-500 to-sage-300" style={{ width: `${pct}%` }} />
                  </div>
                </Link>
              );
            })}
            {active.length === 0 && <p className="text-sm text-[color:var(--label-secondary)] col-span-full">Aucun kit pour le moment.</p>}
          </div>
        </GlassCard>
        <GlassCard className="col-span-12 md:col-span-3 p-4" aria-labelledby="kits-filters">
          <h2 id="kits-filters" className="sr-only">Filtres</h2>
          <Eyebrow>Filtres</Eyebrow>
          <p className="text-sm text-[color:var(--label-secondary)] mt-2">Recherche & saison à venir.</p>
        </GlassCard>
      </section>

      <section aria-label="Assembleur de kit">
        <KitBuilder inventory={inventory} initialKitItems={[]} />
      </section>
    </main>
  );
}
