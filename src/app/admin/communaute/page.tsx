import { EmptyState } from '@/components/ui';
import { ROUTES } from '../_os/routeConfig';
import { Hero, MetricGrid, DataPanel, FilterPanel } from '../_os/panels';
import { InspectorBox } from '../_os/osUi';
import { ReportButton } from '../_os/ReportButton';
import { getCommunityStats } from '@/features/admin/osQueries';

/** GET /admin/communaute — Community Ops (Admin OS). */
export default async function AdminCommunityPage() {
  const cfg = ROUTES['community'];
  const stats = await getCommunityStats().catch(() => null);

  if (!stats) {
    return (
      <>
        <Hero eyebrow={cfg.eyebrow} title={cfg.title} subtitle={cfg.subtitle} actions={<ReportButton section="users" label="Exporter" />} />
        <EmptyState title="Lecture impossible" description="Permission users.read requise." />
      </>
    );
  }

  return (
    <>
      <Hero
        eyebrow={cfg.eyebrow}
        title={cfg.title}
        subtitle={cfg.subtitle}
        actions={<ReportButton section="users" label="Exporter" />}
      />
      <MetricGrid
        metrics={[
          { label: 'Membres', value: stats.members.toLocaleString('fr-FR'), delta: 'inscriptions clubs', icon: 'community' },
          { label: 'Carnets', value: stats.carnets.toLocaleString('fr-FR'), delta: 'récits publiés', icon: 'report' },
          { label: 'Clubs', value: String(stats.clubs), delta: 'communautés', icon: 'users' },
          { label: 'Signalements', value: String(stats.reports), delta: 'clubs en attente', icon: 'shield', tone: stats.reports > 0 ? 'warn' : undefined },
        ]}
      />
      <section className="os-workspace">
        <div className="os-workspace-primary">
          <DataPanel label="CONTENUS" title="Community Pulse" chip="Top clubs" kind="table" rows={stats.top.map((c) => ({ title: c.name, detail: `${c.members} membres`, value: '', tone: 'info' as const }))} />
          <FilterPanel
            label="CLUBS & GROUPES"
            title="Top Communities"
            filter={<span className="os-chip os-clear">Top 5 par membres</span>}
            rows={stats.top.map((c) => ({ title: c.name, detail: `${c.members} membres`, value: '', tone: 'info' as const }))}
            empty="Aucun club."
          />
        </div>
        <InspectorBox
          content={{
            title: 'Community Copilot',
            subtitle: 'Modération assistée',
            headline: stats.reports > 0 ? `${stats.reports} signalement(s) club` : 'Aucun signalement club',
            text: stats.reports > 0
              ? 'Des signalements de clubs attendent une revue dans Trust & Safety.'
              : 'Aucun signalement de club en attente.',
            rows: stats.reports > 0
              ? [{ title: 'Signalements clubs', detail: 'à revoir', value: String(stats.reports), tone: 'warn' as const }]
              : [{ title: 'Signalements clubs', detail: 'file vide', value: '0', tone: 'good' as const }],
          }}
        />
      </section>
    </>
  );
}
