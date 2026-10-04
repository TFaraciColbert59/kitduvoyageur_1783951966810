import { EmptyState } from '@/components/ui';
import { PageLayout } from '@/design';
import { listPendingWithdrawals } from '@/features/admin/queries';
import { formatPriceEur } from '@/features/admin/productUtils';
import { AdminNav } from '../_components/AdminNav';
import { FinalizePeriodForm, WithdrawalActions } from '../_components/RewardsActions';

/** GET /admin/recompenses — retraits en attente + clôture de période. */
export default async function AdminRewardsPage() {
  let withdrawals: Awaited<ReturnType<typeof listPendingWithdrawals>>;
  try {
    withdrawals = await listPendingWithdrawals();
  } catch {
    return (
      <PageLayout title="Récompenses" subtitle="Retraits et périodes">
        <AdminNav />
        <EmptyState
          title="Lecture impossible"
          description="Permission rewards.read requise."
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Récompenses" subtitle={`${withdrawals.length} retrait(s) en attente`}>
      <AdminNav />
      <section aria-label="Clôturer une période">
        <h2 className="mb-2 text-lg font-bold text-[color:var(--glass-label)]">
          Clôturer une période
        </h2>
        <FinalizePeriodForm />
      </section>

      <section aria-label="Retraits en attente">
        <h2 className="mb-2 text-lg font-bold text-[color:var(--glass-label)]">
          Retraits en attente
        </h2>
        {withdrawals.length === 0 ? (
          <EmptyState title="Aucun retrait" description="File des retraits vide." />
        ) : (
          <ul className="flex flex-col gap-3">
            {withdrawals.map((w) => (
              <li
                key={w.id}
                className="rounded-3xl border border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] p-4 backdrop-blur-md"
              >
                <p className="font-semibold text-[color:var(--glass-label)]">
                  {formatPriceEur(w.amount)} · {w.points_redeemed} pts · {w.status}
                </p>
                <p className="text-xs text-[color:var(--glass-label-secondary)]">
                  {new Date(w.requested_at).toLocaleString('fr-FR')} · {w.payment_provider} ·
                  risque {w.risk_score}
                </p>
                <div className="mt-2">
                  <WithdrawalActions withdrawalId={w.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageLayout>
  );
}
