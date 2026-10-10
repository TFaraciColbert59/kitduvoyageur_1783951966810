import { EmptyState } from '@/components/ui';
import { Hero, MetricGrid, DataPanel } from '../_os/panels';
import { getPriorityQueue } from '@/features/admin/osQueries';
import { getPendingApprovals } from '@/features/admin-os/work/queries';

/**
 * GET /admin/mobile — console de crise (lecture + approbations).
 * Pas de version miniaturisée de l'admin : alertes P0, snapshot incident,
 * approbations en attente, kill switches (via /admin/experiments).
 */
export default async function AdminMobilePage() {
  const [queue, approvals] = await Promise.all([
    getPriorityQueue(10).catch(() => null),
    getPendingApprovals(10).catch(() => null),
  ]);

  if (!queue) {
    return (
      <>
        <Hero eyebrow="CRISE" title="Console mobile" subtitle="Alertes et approbations." actions={null} />
        <EmptyState title="Lecture impossible" description="Permission users.read requise." />
      </>
    );
  }

  const p0 = queue.filter((i) => i.level === 'P0');

  return (
    <>
      <Hero eyebrow="CRISE" title="Console mobile" subtitle="Alertes et approbations." actions={null} />
      <MetricGrid
        metrics={[
          { label: 'P0', value: String(p0.length), delta: 'critiques', icon: 'warning', tone: p0.length > 0 ? 'warn' : undefined },
          { label: 'Approbations', value: approvals === null ? '!' : String(approvals.length), delta: 'second regard', icon: 'shield' },
        ]}
      />
      <section className="os-workspace">
        <div className="os-workspace-primary">
          <DataPanel label="ALERTES" title="P0 en cours" chip={`${p0.length}`} kind="table" rows={[]}>
            {p0.length === 0 ? (
              <EmptyState title="Aucune P0" description="Situation nominale." />
            ) : (
              <ul className="os-rows">
                {p0.map((item) => (
                  <li key={`${item.href}|${item.title}`} className="os-row">
                    <span className="os-row-copy">
                      <strong>{item.title}</strong>
                      <small>{item.detail}</small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DataPanel>
          <DataPanel label="DÉCISIONS" title="Approbations" chip={approvals === null ? 'illisible' : `${approvals.length}`} kind="table" rows={[]}>
            {approvals === null ? (
              <EmptyState title="File illisible" description="Vérifier RLS/réseau." />
            ) : approvals.length === 0 ? (
              <EmptyState title="Rien à décider" description="Aucune approbation en attente." />
            ) : (
              <ul className="os-rows">
                {approvals.map((a) => (
                  <li key={a.id} className="os-row">
                    <span className="os-row-copy">
                      <strong>{a.command_key}</strong>
                      <small>
                        {a.resource_type} · {a.resource_id}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DataPanel>
        </div>
      </section>
    </>
  );
}
