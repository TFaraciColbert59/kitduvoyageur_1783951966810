import { EmptyState } from '@/components/ui';
import { ROUTES } from '../_os/routeConfig';
import { Hero, MetricGrid, DataPanel, FilterPanel } from '../_os/panels';
import { InspectorBox } from '../_os/osUi';
import { ReportButton } from '../_os/ReportButton';
import { getSupportInbox } from '@/features/admin/osQueries';

/** GET /admin/support — dossier unique (Admin OS, sans table dédiée). */
export default async function AdminSupportPage() {
  const cfg = ROUTES['support'];
  const inbox = await getSupportInbox().catch(() => null);

  if (!inbox) {
    return (
      <>
        <Hero eyebrow={cfg.eyebrow} title={cfg.title} subtitle={cfg.subtitle} actions={<ReportButton section="moderation" label="Exporter" />} />
        <EmptyState title="Lecture impossible" description="Permission users.read requise." />
      </>
    );
  }

  const first = inbox.items[0];

  return (
    <>
      <Hero
        eyebrow={cfg.eyebrow}
        title={cfg.title}
        subtitle={cfg.subtitle}
        actions={<ReportButton section="moderation" label="Exporter" />}
      />
      <MetricGrid
        metrics={[
          { label: 'Dossiers ouverts', value: String(inbox.items.length), delta: 'toutes sources', icon: 'support' },
          { label: 'Modération', value: String(inbox.counts.moderation), delta: 'signalements', icon: 'shield', tone: inbox.counts.moderation > 0 ? 'warn' : undefined },
          { label: 'Retraits', value: String(inbox.counts.withdrawals), delta: 'à valider', icon: 'clock' },
          { label: 'Stocks', value: String(inbox.counts.stock), delta: 'à réassortir', icon: 'bag' },
        ]}
      />
      <section className="os-workspace">
        <div className="os-workspace-primary">
          <DataPanel label="DOSSIERS" title="Support Inbox" chip={`${inbox.items.length} ouverts`} kind="table" rows={[]}>
            {inbox.items.length === 0 ? (
              <EmptyState title="File vide" description="Aucun dossier ouvert. Tout est traité." />
            ) : (
              <ul className="os-rows">
                {inbox.items.map((item, i) => (
                  <li key={`${item.kind}-${i}`} className="os-row">
                    <span className="os-row-copy">
                      <strong>
                        {item.kind} · {item.title}
                      </strong>
                      <small>{item.detail}</small>
                    </span>
                    <span className={`os-row-value ${item.tone}`}>{item.kind}</span>
                  </li>
                ))}
              </ul>
            )}
          </DataPanel>
          <FilterPanel
            label="ÉQUIPE"
            title="Service Health"
            filter={<span className="os-chip os-clear">Par source</span>}
            rows={[
              { title: 'Modération', detail: 'signalements en attente', value: String(inbox.counts.moderation), tone: inbox.counts.moderation > 0 ? 'warn' : 'good' },
              { title: 'Retraits', detail: 'validations financières', value: String(inbox.counts.withdrawals), tone: inbox.counts.withdrawals > 0 ? 'warn' : 'good' },
              { title: 'Stocks', detail: 'réassorts à prévoir', value: String(inbox.counts.stock), tone: 'info' },
            ]}
            empty="Aucune donnée."
          />
        </div>
        <InspectorBox
          content={{
            title: first ? first.kind : 'Aucun dossier',
            subtitle: first ? first.detail : '—',
            headline: first ? first.title : 'File nominale',
            text: first ? 'Dossier le plus prioritaire du guichet unique.' : 'Aucun dossier ouvert dans aucune source.',
            rows: first ? [{ title: first.kind, detail: first.detail, value: first.title, tone: first.tone }] : [],
          }}
        />
      </section>
    </>
  );
}
