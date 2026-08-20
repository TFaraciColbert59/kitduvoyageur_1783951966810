import Link from 'next/link';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { createClient } from '@/lib/supabase/server';
import { AvailabilityGauge } from '@/features/materiel/components/disponibilite/AvailabilityGauge';
import { DispoKpis } from '@/features/materiel/components/disponibilite/DispoKpis';
import { GanttTimeline } from '@/features/materiel/components/disponibilite/GanttTimeline';
import { LoanTabs } from '@/features/materiel/components/disponibilite/LoanTabs';
import { ConflictDetector } from '@/features/materiel/components/disponibilite/ConflictDetector';
import { LoanHeatmap } from '@/features/materiel/components/disponibilite/LoanHeatmap';
import { DigitalLoanContract } from '@/features/materiel/components/disponibilite/DigitalLoanContract';
import { AutoReminders } from '@/features/materiel/components/disponibilite/AutoReminders';
import { DispoScore } from '@/features/materiel/components/disponibilite/DispoScore';
import { CollectiveActions } from '@/features/materiel/components/disponibilite/CollectiveActions';
import { GlassCard } from '@/components/ui/GlassCard';
import { getLoans } from '@/features/materiel/services/getLoans';
import { getInventory } from '@/features/materiel/services/getInventory';
import { detectConflicts } from '@/lib/materiel/conflicts';

export const dynamic = 'force-dynamic';

export default async function DisponibilitePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  const [loans, inventory] = await Promise.all([getLoans(), getInventory()]);
  const active = loans.filter((l) => l.status === 'en_cours' || l.status === 'en_retard');
  const overdue = loans.filter((l) => l.status === 'en_retard').length;
  const returned = loans.filter((l) => l.status === 'rendu').length;

  const available = inventory.length - active.length;
  const score = Math.max(0, 100 - active.length * 8 - overdue * 15);

  // Conflits : objet prêté ET présent dans un kit (logique pure lib/materiel/conflicts)
  let kitProductIds = new Set<string>();
  if (user) {
    const { data: kitItems } = await supabase
      .from('materiel_kit_items')
      .select('product_ownership_id')
      .eq('user_id', user.id)
      .not('product_ownership_id', 'is', null);
    kitProductIds = new Set((kitItems ?? []).map((k) => k.product_ownership_id));
  }
  const itemsById = new Map(inventory.map((i) => [i.id, i.name]));
  const conflicts = detectConflicts(loans, kitProductIds, itemsById);

  const byMonth = new Map<string, number>();
  for (const l of loans) {
    const m = (l.loaned_at ?? '').slice(0, 7);
    if (m) byMonth.set(m, (byMonth.get(m) ?? 0) + 1);
  }
  const heatmap = Array.from(byMonth.entries()).map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);

  return (
    <main className="max-w-[var(--page-max-w)] mx-auto px-4 py-8 pb-24">
      <header className="flex items-center justify-between mb-6">
        <div>
          <Eyebrow>Mon Matériel</Eyebrow>
          <h1 className="font-display font-semibold text-[32px] tracking-tight text-[color:var(--label)]">Disponibilité</h1>
        </div>
        <Link href="/materiel" className="glass interactive h-9 px-4 rounded-full flex items-center text-sm font-medium text-sage-600">
          ← Retour
        </Link>
      </header>

      <div className="grid grid-cols-12 gap-4">
        <GlassCard className="col-span-12 md:col-span-4 p-4 flex items-center gap-4" aria-labelledby="gauge-title">
          <AvailabilityGauge availableCount={Math.max(0, available)} total={inventory.length} />
          <div>
            <h2 id="gauge-title" className="sr-only">Disponibilité</h2>
            <Eyebrow>Objets disponibles</Eyebrow>
            <p className="text-sm text-[color:var(--label-secondary)]">{active.length} en prêt</p>
          </div>
        </GlassCard>
        <div className="col-span-12 md:col-span-8">
          <DispoKpis data={{ active: active.length, overdue, returned, totalObjects: inventory.length }} />
        </div>
        <div className="col-span-12"><GanttTimeline loans={loans.map((l) => ({ id: l.id, label: l.borrower_contact ?? 'Prêt', start: l.loaned_at ?? '', end: l.due_date ?? l.loaned_at ?? '' }))} /></div>
        <div className="col-span-12"><LoanTabs loans={loans} userId={userId} /></div>
        <div className="col-span-12"><ConflictDetector conflicts={conflicts} /></div>
        <div className="col-span-12 md:col-span-6"><LoanHeatmap byMonth={heatmap} /></div>
        <div className="col-span-12 md:col-span-6"><DigitalLoanContract loan={active[0] ?? null} /></div>
        <div className="col-span-12"><AutoReminders reminders={active.filter((l) => l.due_date).map((l) => ({ id: l.id, label: `Retour de ${l.borrower_contact ?? 'prêt'}`, due: l.due_date! }))} /></div>
        <div className="col-span-12 md:col-span-6"><DispoScore score={score} overdue={overdue} /></div>
        <div className="col-span-12 md:col-span-6"><CollectiveActions /></div>
      </div>
    </main>
  );
}
