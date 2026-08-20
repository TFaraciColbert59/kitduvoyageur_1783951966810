'use client';
import { useMemo, useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import type { LoanItem } from '@/features/materiel/services/getLoans';

const STATUS_TONE: Record<string, 'info' | 'danger' | 'sage' | 'warn'> = {
  en_cours: 'info', en_retard: 'danger', rendu: 'sage', litige: 'warn',
};
const STATUS_LABEL: Record<string, string> = {
  en_cours: 'En cours', en_retard: 'En retard', rendu: 'Rendu', litige: 'Litige',
};

type Tab = 'lender' | 'borrower' | 'all';

/** W-A-4 LoanTabs — prêts « Par moi / À moi / Tous ». */
export function LoanTabs({ loans, userId }: { loans: LoanItem[]; userId: string | null }) {
  const [tab, setTab] = useState<Tab>('all');

  const filtered = useMemo(() => {
    if (tab === 'all' || !userId) return loans;
    return loans.filter((l) => (tab === 'lender' ? l.lender_id === userId : l.borrower_id === userId));
  }, [loans, tab, userId]);

  return (
    <GlassCard as="article" ariaLabelledBy="loans-tabs-title" className="p-4">
      <h3 id="loans-tabs-title" className="sr-only">Liste des prêts</h3>
      <div className="glass-segmented" role="group" aria-label="Filtre des prêts">
        <button type="button" className={`glass-segmented-item ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>Tous</button>
        <button type="button" className={`glass-segmented-item ${tab === 'lender' ? 'active' : ''}`} onClick={() => setTab('lender')}>Par moi</button>
        <button type="button" className={`glass-segmented-item ${tab === 'borrower' ? 'active' : ''}`} onClick={() => setTab('borrower')}>À moi</button>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {filtered.map((l) => (
          <li key={l.id} className="glass p-3 flex items-center justify-between">
            <span className="text-sm text-[color:var(--label)]">
              {l.borrower_contact ?? 'Emprunteur'} · {l.due_date ? new Date(l.due_date).toLocaleDateString('fr-FR') : 'sans date'}
            </span>
            <Badge tone={STATUS_TONE[l.status] ?? 'info'}>{STATUS_LABEL[l.status] ?? l.status}</Badge>
          </li>
        ))}
        {filtered.length === 0 && <li className="text-sm text-[color:var(--label-secondary)]">Aucun prêt.</li>}
      </ul>
    </GlassCard>
  );
}
