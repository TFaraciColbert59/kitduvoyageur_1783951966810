import { EmptyState } from '@/components/ui';
import { Hero, MetricGrid, DataPanel } from '../_os/panels';
import { InspectorBox } from '../_os/osUi';
import { ReportButton } from '../_os/ReportButton';
import { FinalizePeriodForm, WithdrawalActions } from '../_components/RewardsActions';
import { listPendingWithdrawals } from '@/features/admin/queries';
import { getRewardsStats } from '@/features/admin/osQueries';
import { formatPriceEur } from '@/features/admin/productUtils';

/** GET /admin/recompenses — Récompenses (Admin OS). */
export default async function AdminRewardsPage() {
  const [withdrawals, stats] = await Promise.all([
    listPendingWithdrawals().catch(() => null),
    getRewardsStats().catch(() => null),
  ]);

  if (!withdrawals || !stats) {
    return (
      <>
        <Hero eyebrow="COMMERCE" title="Récompenses" subtitle="Retraits et périodes." actions={<ReportButton section="rewards" label="Exporter" />} />
        <EmptyState title="Lecture impossible" description="Permission rewards.read requise." />
      </>
    );
  }

  return (
    <>
      <Hero
        eyebrow="COMMERCE"
        title="Récompenses"
        subtitle="Retraits en attente et clôture de période."
        actions={<ReportButton section="rewards" label="Exporter" />}
      />
      <MetricGrid
        metrics={[
          { label: 'Retraits en attente', value: String(stats.pending), delta: 'à valider', icon: 'clock', tone: stats.pending > 0 ? 'warn' : undefined },
          { label: 'Montant en attente', value: formatPriceEur(stats.pendingAmount), delta: 'cumulé', icon: 'bag' },
          { label: 'Plus ancien', value: stats.oldest ? `${stats.oldest.amount} €` : '—', delta: stats.oldest?.waiting ?? '', icon: 'warning' },
          { label: 'Traçabilité', value: '100 %', delta: 'actions journalisées', icon: 'check' },
        ]}
      />
      <section className="os-workspace">
        <div className="os-workspace-primary">
          <DataPanel label="PÉRIODES" title="Clôturer une période" chip="Finance" kind="table" rows={[]}>
            <FinalizePeriodForm />
          </DataPanel>
          <DataPanel label="RETRAITS" title="File des retraits" chip={`${withdrawals.length} en attente`} kind="table" rows={[]}>
            {withdrawals.length === 0 ? (
              <EmptyState title="Aucun retrait" description="File des retraits vide." />
            ) : (
              <ul className="os-rows">
                {withdrawals.map((w) => (
                  <li key={w.id} className="os-row os-row-top">
                    <span className="os-row-copy">
                      <strong>
                        {formatPriceEur(w.amount)} · {w.points_redeemed} pts · {w.status}
                      </strong>
                      <small>
                        {new Date(w.requested_at).toLocaleString('fr-FR')} · {w.payment_provider} · risque {w.risk_score}
                      </small>
                      <span className="os-row-actions">
                        <WithdrawalActions withdrawalId={w.id} />
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DataPanel>
        </div>
        <InspectorBox
          content={{
            title: 'Trust & Verification',
            subtitle: 'Dossier prioritaire',
            headline: stats.oldest ? `Retrait ${stats.oldest.amount} €` : 'File nominale',
            text: stats.oldest
              ? `La demande la plus ancienne : ${stats.oldest.waiting}. Vérifiez l’identité avant approbation.`
              : 'Aucun retrait en attente.',
            rows: stats.oldest
              ? [{ title: 'Montant', detail: 'plus ancien dossier', value: `${stats.oldest.amount} €`, tone: 'warn' as const }]
              : [],
          }}
        />
      </section>
    </>
  );
}
