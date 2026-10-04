import { EmptyState } from '@/components/ui';
import { ROUTES } from '../_os/routeConfig';
import { Hero, MetricGrid, DataPanel, FilterPanel } from '../_os/panels';
import { InspectorBox } from '../_os/osUi';
import { ReportButton } from '../_os/ReportButton';
import { getSystemStatus } from '@/features/admin/osQueries';

/** GET /admin/systeme — Platform (Admin OS, sondes réelles). */
export default async function AdminSystemPage() {
  const cfg = ROUTES['system'];
  const status = await getSystemStatus().catch(() => null);

  if (!status) {
    return (
      <>
        <Hero eyebrow={cfg.eyebrow} title={cfg.title} subtitle={cfg.subtitle} actions={<ReportButton section="audit" label="Exporter" />} />
        <EmptyState title="Lecture impossible" description="Permission users.read requise." />
      </>
    );
  }

  const degraded = status.rows.filter((r) => r.tone === 'danger' || r.tone === 'warn');

  return (
    <>
      <Hero
        eyebrow={cfg.eyebrow}
        title={cfg.title}
        subtitle={cfg.subtitle}
        actions={<ReportButton section="audit" label="Exporter" />}
      />
      <MetricGrid
        metrics={[
          { label: 'Base de données', value: status.dbMs !== null ? `${status.dbMs} ms` : 'Down', delta: 'ping temps réel', icon: 'check', tone: status.dbMs !== null ? undefined : 'danger' },
          { label: 'Latence DB', value: status.dbMs !== null ? `${status.dbMs} ms` : '—', delta: 'aller-retour', icon: 'pulse' },
          { label: 'Migrations', value: String(status.migrations), delta: 'fichiers locaux', icon: 'report' },
          { label: 'Intégrations', value: `${degraded.length} à voir`, delta: 'non configurées ou en panne', icon: 'warning', tone: degraded.length > 0 ? 'warn' : undefined },
        ]}
      />
      <section className="os-workspace">
        <div className="os-workspace-primary">
          <DataPanel label="PRODUCTION" title="Service Matrix" chip={status.degraded > 0 ? 'Dégradé' : 'Sain'} kind="services" rows={[]}>
            <ul className="os-rows">
              {status.rows.map((r) => (
                <li key={r.name} className="os-row">
                  <span className={`os-row-status ${r.tone}`}>
                    <span className="os-island-dot" aria-hidden="true" />
                  </span>
                  <span className="os-row-copy">
                    <strong>{r.name}</strong>
                    <small>{r.detail}</small>
                  </span>
                  <span className={`os-row-value ${r.tone}`}>{r.status}</span>
                </li>
              ))}
            </ul>
          </DataPanel>
          <FilterPanel
            label="DÉPLOIEMENT"
            title="Release Control"
            filter={<span className="os-chip os-clear">Version {status.version}</span>}
            rows={[
              { title: 'Build applicatif', detail: `version ${status.version}`, value: 'En ligne', tone: 'good' },
              { title: 'Migrations locales', detail: `${status.migrations} fichiers`, value: 'Suivi', tone: 'info' },
            ]}
            empty="Aucune donnée."
          />
        </div>
        <InspectorBox
          content={{
            title: 'Incident Center',
            subtitle: status.degraded > 0 ? `${status.degraded} point(s) à voir` : 'Aucun incident',
            headline: status.degraded > 0 ? 'Points de vigilance' : 'Plateforme saine',
            text: status.degraded > 0
              ? 'Certaines intégrations sont injoignables ou non configurées. Vérifiez les variables d’environnement.'
              : 'Tous les services sondés répondent.',
            rows: degraded.map((r) => ({ title: r.name, detail: r.detail, value: r.status, tone: r.tone })),
          }}
        />
      </section>
    </>
  );
}
