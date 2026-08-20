import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Metric } from '@/components/ui/Metric';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { getInventory } from '@/features/materiel/services/getInventory';
import { InventoryVirtualGrid } from '@/features/materiel/components/inventaire/InventoryVirtualGrid';

export const dynamic = 'force-dynamic';

export default async function InventairePage() {
  const items = await getInventory();
  const totalWeight = items.reduce((s, i) => s + (i.weight_g ?? 0), 0);
  const lent = items.filter((i) => i.is_lent).length;
  const goodPct = items.length
    ? (items.filter((i) => i.condition && i.condition !== 'a_remplacer').length / items.length) * 100
    : 100;

  return (
    <main className="max-w-[var(--page-max-w)] mx-auto px-4 py-8 pb-24">
      <header className="flex items-center justify-between mb-6">
        <div>
          <Eyebrow>Mon Matériel</Eyebrow>
          <h1 className="font-display font-semibold text-[32px] tracking-tight text-[color:var(--label)]">Inventaire</h1>
        </div>
        <Link href="/materiel" className="glass interactive h-9 px-4 rounded-full flex items-center text-sm font-medium text-sage-600">
          ← Retour
        </Link>
      </header>

      <GlassCard className="p-4 mb-6" aria-labelledby="inv-overview">
        <h2 id="inv-overview" className="sr-only">Vue d'ensemble</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 items-center">
          <Metric value={items.length} size="xl" />
          <div>
            <Metric value={(totalWeight / 1000).toFixed(1)} unit="kg" />
            <Eyebrow>Poids total</Eyebrow>
          </div>
          <div>
            <Metric value={lent} tone={lent > 0 ? 'danger' : 'default'} />
            <Eyebrow>En prêt</Eyebrow>
          </div>
        </div>
        <ProgressBar value={goodPct} label="Objets en bon état" tone={goodPct >= 80 ? 'sage' : 'warn'} />
      </GlassCard>

      {items.length > 0 ? (
        <InventoryVirtualGrid items={items} />
      ) : (
        <GlassCard className="p-6 flex flex-col items-center gap-3">
          <p className="text-sm text-[color:var(--label-secondary)]">Votre inventaire est vide.</p>
          <Link href="/materiel" className="glass interactive h-9 px-4 rounded-full flex items-center text-sm font-medium text-sage-600">
            Ajouter un article
          </Link>
        </GlassCard>
      )}
    </main>
  );
}
