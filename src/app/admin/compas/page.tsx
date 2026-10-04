import { EmptyState } from '@/components/ui';
import { ROUTES } from '../_os/routeConfig';
import { Hero, MetricGrid, DataPanel, FilterPanel } from '../_os/panels';
import { InspectorBox } from '../_os/osUi';
import { ReportButton } from '../_os/ReportButton';
import { getCompasStats } from '@/features/admin/osQueries';
import { formatPriceEur } from '@/features/admin/productUtils';

/** GET /admin/compas — Compas & voyages (Admin OS). */
export default async function AdminCompasPage() {
  const cfg = ROUTES['compas'];
  const stats = await getCompasStats().catch(() => null);

  if (!stats) {
    return (
      <>
        <Hero eyebrow={cfg.eyebrow} title={cfg.title} subtitle={cfg.subtitle} actions={<ReportButton section="orders" label="Exporter" />} />
        <EmptyState title="Lecture impossible" description="Permission users.read requise." />
      </>
    );
  }

  const first = stats.recent[0];

  return (
    <>
      <Hero
        eyebrow={cfg.eyebrow}
        title={cfg.title}
        subtitle={cfg.subtitle}
        actions={<ReportButton section="orders" label="Exporter" />}
      />
      <MetricGrid
        metrics={[
          { label: 'Voyages suivis', value: String(stats.trips), delta: 'total', icon: 'compass' },
          { label: 'À venir', value: String(stats.upcoming), delta: 'départs futurs', icon: 'check' },
          { label: 'Budget suivi', value: formatPriceEur(stats.budget), delta: 'voyages récents', icon: 'bag' },
          { label: 'Suivi', value: stats.recent.length > 0 ? 'Actif' : 'Vide', delta: 'derniers voyages', icon: 'pulse' },
        ]}
      />
      <section className="os-workspace">
        <div className="os-workspace-primary">
          <DataPanel label="GÉNÉRATIONS" title="Preparation Runs" chip="Vue active" kind="table" rows={[]}>
            {stats.recent.length === 0 ? (
              <EmptyState title="Aucun voyage" description="Aucun voyage enregistré." />
            ) : (
              <ul className="os-rows">
                {stats.recent.map((t) => (
                  <li key={t.id} className="os-row">
                    <span className="os-row-copy">
                      <strong>{t.title}</strong>
                      <small>{t.detail}</small>
                    </span>
                    <span className="os-row-value info">{t.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </DataPanel>
          <FilterPanel
            label="IA & DONNÉES"
            title="Intelligence Stack"
            filter={<span className="os-chip os-clear">Lecture seule</span>}
            rows={[
              { title: 'Voyages suivis', detail: 'base trips', value: String(stats.trips), tone: 'info' },
              { title: 'Départs futurs', detail: 'à venir', value: String(stats.upcoming), tone: 'good' },
            ]}
            empty="Aucune donnée."
          />
        </div>
        <InspectorBox
          content={{
            title: first ? first.title : 'Aucun voyage',
            subtitle: first ? first.detail : '—',
            headline: first ? `Statut : ${first.status}` : 'File vide',
            text: first ? 'Dernier voyage enregistré dans le suivi.' : 'Aucun voyage à inspecter.',
            rows: first ? [{ title: 'Statut', detail: first.detail, value: first.status, tone: 'info' as const }] : [],
          }}
        />
      </section>
    </>
  );
}
