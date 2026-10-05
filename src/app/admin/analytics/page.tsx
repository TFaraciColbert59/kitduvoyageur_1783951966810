import { ROUTES } from '../_os/routeConfig';
import { Hero, MetricGrid, DataPanel, FilterPanel } from '../_os/panels';
import { InspectorBox } from '../_os/osUi';
import { ReportButton } from '../_os/ReportButton';
import { EmptyState } from '@/components/ui';
import { getAnalytics, getUserSignupSeries } from '@/features/admin/osQueries';

/** GET /admin/analytics — Signals (Admin OS, agrégats réels). */
export default async function AdminAnalyticsPage() {
  const cfg = ROUTES['analytics'];
  const [stats, signups] = await Promise.all([
    getAnalytics().catch(() => null),
    getUserSignupSeries(30).catch(() => []),
  ]);

  if (!stats) {
    return (
      <>
        <Hero eyebrow={cfg.eyebrow} title={cfg.title} subtitle={cfg.subtitle} actions={<ReportButton section="users" label="Exporter" />} />
        <EmptyState title="Lecture impossible" description="Permission users.read requise." />
      </>
    );
  }

  const conv = stats.users > 0 ? Math.round((stats.orders / stats.users) * 1000) / 10 : 0;
  const funnel = [
    { title: 'Comptes créés', detail: 'base utilisateurs', value: String(stats.users), tone: 'good' as const },
    { title: 'Actifs 30 j', detail: 'nouveaux comptes', value: String(stats.users30d), tone: 'good' as const },
    { title: 'Carnets publiés', detail: 'contribution', value: String(stats.carnets), tone: 'info' as const },
    { title: 'Clubs rejoints', detail: 'communautés', value: String(stats.clubs), tone: 'info' as const },
    { title: 'Commandes', detail: 'conversion', value: String(stats.orders), tone: stats.orders > 0 ? ('warn' as const) : ('info' as const) },
  ];

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
          { label: 'Utilisateurs', value: stats.users.toLocaleString('fr-FR'), delta: `+${stats.users30d} à 30 j`, icon: 'pulse' },
          { label: 'GMV total', value: `${(stats.gmv / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k€`, delta: `${stats.orders} commandes`, icon: 'bag' },
          { label: 'Panier moyen', value: stats.orders > 0 ? `${Math.round((stats.gmv / stats.orders) * 100) / 100} €` : '—', delta: 'par commande', icon: 'check' },
          { label: 'Conversion', value: `${conv} %`, delta: 'commandes / comptes', icon: 'chart' },
        ]}
      />
      <section className="os-workspace">
        <div className="os-workspace-primary">
          <DataPanel label="USAGE" title="Product Activity" chip="Inscriptions 30 j" kind="chart" rows={[]} series={signups} foot={[
            { title: `+${stats.users30d}`, detail: 'nouveaux comptes', value: `${stats.users} au total`, tone: 'good' },
            { title: String(stats.carnets), detail: 'carnets publiés', value: `${stats.clubs} clubs`, tone: 'info' },
          ]} />
          <FilterPanel
            label="FUNNEL"
            title="Activation Funnel"
            filter={<span className="os-chip os-clear">Entonnoir réel</span>}
            rows={funnel}
            empty="Aucune donnée."
          />
        </div>
        <InspectorBox
          content={{
            title: 'Insight Engine',
            subtitle: 'Lecture des signaux',
            headline: stats.orders > 0 ? `Conversion ${conv} %` : 'Pas encore de conversion',
            text: 'Entonnoir calculé sur les tables réelles : comptes, carnets, clubs, commandes.',
            rows: [
              { title: 'Comptes', detail: 'base', value: String(stats.users), tone: 'good' },
              { title: 'Commandes', detail: 'convertis', value: String(stats.orders), tone: 'info' },
            ],
          }}
        />
      </section>
    </>
  );
}
