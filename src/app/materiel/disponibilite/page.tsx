import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';
import { getLoans } from '@/features/materiel/services/getLoans';
import { getInventory } from '@/features/materiel/services/getInventory';
import { AvailabilityGauge } from '@/features/materiel/components/disponibilite/AvailabilityGauge';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, 'sage' | 'warn' | 'danger' | 'info'> = {
  en_cours: 'info', en_retard: 'danger', rendu: 'sage', litige: 'danger',
};
const STATUS_LABEL: Record<string, string> = {
  en_cours: 'En cours', en_retard: 'En retard', rendu: 'Rendu', litige: 'Litige',
};

export default async function DisponibilitePage() {
  const [loans, inventory] = await Promise.all([getLoans(), getInventory()]);
  const active = loans.filter((l) => l.status === 'en_cours' || l.status === 'en_retard');
  const unavailable = active.length;
  const available = inventory.length - unavailable;
  const nextReturn = active
    .filter((l) => l.due_date)
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())[0];

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
            <p className="text-sm text-[color:var(--label-secondary)]">{unavailable} en prêt</p>
          </div>
        </GlassCard>
        <GlassCard className="col-span-12 md:col-span-4 p-4" aria-labelledby="retour-title">
          <Eyebrow>Prochain retour</Eyebrow>
          <p className="text-sm text-[color:var(--label)] mt-1">
            {nextReturn ? new Date(nextReturn.due_date!).toLocaleDateString('fr-FR') : 'Aucun prêt en cours'}
          </p>
        </GlassCard>
        <GlassCard className="col-span-12 md:col-span-4 p-4" aria-labelledby="conflit-title">
          <Eyebrow>Conflits</Eyebrow>
          <p className="text-sm text-[color:var(--label)] mt-1">
            {active.length > 0 ? `${active.length} objet(s) indisponible(s)` : 'Aucun conflit détecté'}
          </p>
        </GlassCard>

        <div className="col-span-12">
          <GlassCard className="p-4" aria-labelledby="loans-list">
            <h2 id="loans-list" className="sr-only">Prêts</h2>
            <Eyebrow>Prêts</Eyebrow>
            <ul className="mt-3 flex flex-col gap-2">
              {loans.map((l) => (
                <li key={l.id} className="glass p-3 flex items-center justify-between">
                  <span className="text-sm text-[color:var(--label)]">
                    {l.borrower_contact ?? 'Emprunteur'} · {l.due_date ? new Date(l.due_date).toLocaleDateString('fr-FR') : 'sans date'}
                  </span>
                  <Badge tone={STATUS_TONE[l.status] ?? 'info'}>{STATUS_LABEL[l.status] ?? l.status}</Badge>
                </li>
              ))}
              {loans.length === 0 && <li className="text-sm text-[color:var(--label-secondary)]">Aucun prêt.</li>}
            </ul>
          </GlassCard>
        </div>
      </div>
    </main>
  );
}
