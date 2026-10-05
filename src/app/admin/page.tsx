import Link from 'next/link';

import { Button } from '@/components/ui';
import { ROUTES } from './_os/routeConfig';
import { Hero, MetricGrid, DataPanel, FilterPanel, PeriodPills } from './_os/panels';
import { InspectorBox } from './_os/osUi';
import { ReportButton } from './_os/ReportButton';
import { AdminField, AdminInput } from './_components/AdminField';
import {
  getAccountBadge,
  getActivitySeries,
  getCopilotSignal,
  getOverviewMetrics,
  getPriorityQueue,
} from '@/features/admin/osQueries';
import { listAuditPage } from '@/features/admin/queries';
import { greeting, parsePeriod } from './_os/period';

interface SearchParams {
  period?: string;
  from?: string;
  to?: string;
  q?: string;
}

/** GET /admin — Mission Control sur données réelles. */
export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const range = parsePeriod(sp);
  const q = (sp.q ?? '').slice(0, 120).toLowerCase();
  const cfg = ROUTES['overview'];

  const [account, metrics, series, queue, copilot, audit] = await Promise.all([
    getAccountBadge(),
    getOverviewMetrics(),
    getActivitySeries(30).catch(() => []),
    getPriorityQueue(50),
    getCopilotSignal(),
    listAuditPage({ from: range.from, to: range.to }, 1, 5).catch(() => ({ data: [], total: 0 })),
  ]);

  const hour = new Date().getHours();
  const totalActions = series.reduce((s, p) => s + p.count, 0);
  const peak = series.reduce((m, p) => (p.count > m.count ? p : m), { day: '—', count: 0 });
  const filtered = queue.filter(
    (i) => !q || `${i.level} ${i.title} ${i.detail}`.toLowerCase().includes(q)
  );

  return (
    <>
      <Hero
        eyebrow={cfg.eyebrow}
        title={greeting(hour, account.name)}
        subtitle={cfg.subtitle}
        actions={
          <>
            <Link className="os-btn os-interactive" href="/admin/audit">
              Voir l’audit
            </Link>
            <ReportButton section="overview" label={cfg.ctaLabel} />
          </>
        }
      />
      <PeriodPills base="/admin" current={range.current} />
      {range.current === 'custom' ? (
        <form method="get" className="os-panel" aria-label="Période personnalisée">
          <input type="hidden" name="period" value="custom" />
          <div className="flex flex-wrap items-end gap-2">
            <AdminField label="Du">
              <AdminInput type="date" name="from" defaultValue={range.from?.slice(0, 10) ?? ''} />
            </AdminField>
            <AdminField label="Au">
              <AdminInput type="date" name="to" defaultValue={range.to?.slice(0, 10) ?? ''} />
            </AdminField>
            <Button variant="secondary" size="sm" type="submit">
              Appliquer
            </Button>
          </div>
        </form>
      ) : null}
      <MetricGrid
        metrics={[
          {
            label: 'Utilisateurs',
            value: metrics.users.toLocaleString('fr-FR'),
            delta:
              metrics.usersDeltaPct !== null
                ? `${metrics.usersDeltaPct > 0 ? '+' : ''}${metrics.usersDeltaPct} % ce mois`
                : `+${metrics.usersNewMonth} ce mois`,
            icon: 'pulse',
          },
          {
            label: 'Marketplace',
            value: `${(metrics.gmv / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k€`,
            delta: `${metrics.orders} commandes`,
            icon: 'bag',
          },
          {
            label: 'Confiance moyenne',
            value: metrics.trustAvg !== null ? metrics.trustAvg.toLocaleString('fr-FR') : '—',
            delta: 'score / 100',
            icon: 'check',
          },
          {
            label: 'À traiter',
            value: String(metrics.todo),
            delta: metrics.todoBreakdown,
            icon: 'warning',
            tone: metrics.todo > 0 ? 'warn' : undefined,
          },
        ]}
      />
      <section className="os-workspace">
        <div className="os-workspace-primary">
          <DataPanel
            label="TEMPS RÉEL"
            title="Live Pulse"
            chip={`${totalActions} actions · ${range.current}`}
            kind="chart"
            rows={[]}
            series={series}
            foot={[
              {
                title: String(totalActions),
                detail: 'actions journalisées',
                value: `pic ${peak.count} (${peak.day})`,
                tone: 'info',
              },
              ...audit.data.slice(0, 2).map((a) => ({
                title: a.action,
                detail: new Date(a.created_at).toLocaleString('fr-FR'),
                value: a.target_table ?? '',
                tone: 'info' as const,
              })),
            ]}
          >
            {totalActions === 0 ? (
              <p className="os-row-copy">
                <small>Pas encore d’activité journalisée — le graphique se remplit dès la première action auditée.</small>
              </p>
            ) : null}
          </DataPanel>
          <FilterPanel
            label="DÉCISIONS"
            title="Priority Queue"
            filter={
              <form method="get" className="os-filter os-clear" role="search">
                {range.current !== "Aujourd'hui" ? <input type="hidden" name="period" value={range.current} /> : null}
                <input name="q" defaultValue={sp.q ?? ''} placeholder="Filtrer…" aria-label="Filtrer la file" maxLength={120} />
              </form>
            }
            rows={filtered.map((i) => ({ title: `${i.level} · ${i.title}`, detail: i.detail, value: '', tone: i.tone, href: i.href }))}
            empty="File vide — rien ne requiert de décision."
          />
        </div>
        <InspectorBox
          content={{
            title: 'Admin Copilot',
            subtitle: copilot.subtitle,
            headline: copilot.headline,
            text: copilot.text,
            rows: copilot.rows,
          }}
          noteTarget={{ table: 'dashboard', id: 'overview' }}
          openHref="/admin/audit"
        />
      </section>
    </>
  );
}
