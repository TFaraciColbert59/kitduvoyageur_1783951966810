import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import type { LoanItem } from '@/features/materiel/services/getLoans';

/** W-A-7 DigitalLoanContract — contrat de prêt digital. */
export function DigitalLoanContract({ loan }: { loan: LoanItem | null }) {
  return (
    <GlassCard as="article" ariaLabelledBy="contract-title" className="p-4">
      <Eyebrow>Contrat de prêt</Eyebrow>
      <h3 id="contract-title" className="sr-only">Contrat de prêt digital</h3>
      {loan ? (
        <dl className="mt-2 flex flex-col gap-2 text-sm">
          <div className="flex justify-between"><dt className="text-[color:var(--label-tertiary)]">Emprunteur</dt><dd className="text-[color:var(--label)]">{loan.borrower_contact ?? '—'}</dd></div>
          <div className="flex justify-between"><dt className="text-[color:var(--label-tertiary)]">Prêté le</dt><dd className="text-[color:var(--label)]">{loan.loaned_at ? new Date(loan.loaned_at).toLocaleDateString('fr-FR') : '—'}</dd></div>
          <div className="flex justify-between"><dt className="text-[color:var(--label-tertiary)]">Retour prévu</dt><dd className="text-[color:var(--label)]">{loan.due_date ? new Date(loan.due_date).toLocaleDateString('fr-FR') : '—'}</dd></div>
          <div className="flex justify-between"><dt className="text-[color:var(--label-tertiary)]">Statut</dt><dd className="text-[color:var(--label)]">{loan.status}</dd></div>
        </dl>
      ) : (
        <p className="mt-2 text-sm text-[color:var(--label-secondary)]">Sélectionnez un prêt pour voir son contrat.</p>
      )}
    </GlassCard>
  );
}
