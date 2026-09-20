'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, EmptyState, ListItem, Tabs } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import type { LoanItem } from '@/features/materiel/services/getLoans';

const STATUS_TONE: Record<string, 'info' | 'danger' | 'sage' | 'warn'> = {
  en_cours: 'info', en_retard: 'danger', rendu: 'sage', litige: 'warn',
};
const STATUS_LABEL: Record<string, string> = {
  en_cours: 'En cours', en_retard: 'En retard', rendu: 'Rendu', litige: 'Litige',
};

type Tab = 'lender' | 'borrower' | 'all';

const TAB_OPTIONS = [
  { id: 'all', label: 'Tous' },
  { id: 'lender', label: 'Par moi' },
  { id: 'borrower', label: 'À moi' },
];

/** W-A-4 LoanTabs — prêts « Par moi / À moi / Tous » + marquer rendu. */
export function LoanTabs({ loans, userId }: { loans: LoanItem[]; userId: string | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('all');

  const filtered = useMemo(() => {
    if (tab === 'all' || !userId) return loans;
    return loans.filter((l) => (tab === 'lender' ? l.lender_id === userId : l.borrower_id === userId));
  }, [loans, tab, userId]);

  const markReturned = async (l: LoanItem) => {
    const res = await fetch(`/api/materiel/loans/${l.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'rendu' }),
    });
    if (res.ok) { toast('Prêt marqué rendu', 'success'); router.refresh(); }
    else toast('Erreur', 'error');
  };

  return (
    <Card as="article" ariaLabelledBy="loans-tabs-title" className="p-4">
      <h3 id="loans-tabs-title" className="sr-only">Liste des prêts</h3>
      <Tabs
        options={TAB_OPTIONS}
        value={tab}
        onChange={(id) => setTab(id as Tab)}
      />
      <ul className="mt-3 flex flex-col gap-2">
        {filtered.map((l) => (
          <li key={l.id}>
            <ListItem
              as="div"
              className="bg-[color:var(--lkv-surface-muted)]"
              title={`${l.borrower_contact ?? 'Emprunteur'} · ${l.due_date ? new Date(l.due_date).toLocaleDateString('fr-FR') : 'sans date'}`}
              trailing={
                <span className="flex items-center gap-2">
                  <Badge tone={STATUS_TONE[l.status] ?? 'info'}>{STATUS_LABEL[l.status] ?? l.status}</Badge>
                  {l.status !== 'rendu' && (
                    <Button size="sm" variant="secondary" onClick={() => markReturned(l)}>Rendu</Button>
                  )}
                </span>
              }
            />
          </li>
        ))}
        {filtered.length === 0 && (
          <li>
            <EmptyState compact title="Aucun prêt." />
          </li>
        )}
      </ul>
    </Card>
  );
}
