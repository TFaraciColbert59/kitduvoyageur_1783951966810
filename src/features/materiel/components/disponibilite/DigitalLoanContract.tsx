import { Card, EmptyState } from '@/components/ui';
import { Eyebrow } from '@/components/ui/Eyebrow';
import type { LoanItem } from '@/features/materiel/services/getLoans';

/** W-A-7 DigitalLoanContract — contrat de prêt digital. */
export function DigitalLoanContract({ loan }: { loan: LoanItem | null }) {
  return (
    <Card as="article" ariaLabelledBy="contract-title" className="p-4">
      <Eyebrow>Contrat de prêt</Eyebrow>
      <h3 id="contract-title" className="sr-only">Contrat de prêt digital</h3>
      {loan ? (
        <dl className="mt-2 flex flex-col gap-2 text-sm">
          <div className="flex justify-between"><dt className="text-[color:var(--lkv-text-muted)]">Emprunteur</dt><dd className="text-[color:var(--lkv-text-primary)]">{loan.borrower_contact ?? '—'}</dd></div>
          <div className="flex justify-between"><dt className="text-[color:var(--lkv-text-muted)]">Prêté le</dt><dd className="text-[color:var(--lkv-text-primary)]">{loan.loaned_at ? new Date(loan.loaned_at).toLocaleDateString('fr-FR') : '—'}</dd></div>
          <div className="flex justify-between"><dt className="text-[color:var(--lkv-text-muted)]">Retour prévu</dt><dd className="text-[color:var(--lkv-text-primary)]">{loan.due_date ? new Date(loan.due_date).toLocaleDateString('fr-FR') : '—'}</dd></div>
          <div className="flex justify-between"><dt className="text-[color:var(--lkv-text-muted)]">Statut</dt><dd className="text-[color:var(--lkv-text-primary)]">{loan.status}</dd></div>
        </dl>
      ) : (
        <EmptyState compact title="Sélectionnez un prêt pour voir son contrat." />
      )}
    </Card>
  );
}
