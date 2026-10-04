import Link from 'next/link';

import { Button, EmptyState } from '@/components/ui';
import { Hero, MetricGrid, DataPanel } from '../_os/panels';
import { InspectorBox } from '../_os/osUi';
import { ReportButton } from '../_os/ReportButton';
import { AdminField, AdminInput } from '../_components/AdminField';
import { listAuditPage } from '@/features/admin/queries';
import { getAuditStats } from '@/features/admin/osQueries';

const PAGE_SIZE = 20;

interface SearchParams {
  action?: string;
  target_table?: string;
  page?: string;
}

/** GET /admin/audit — journal append-only (Admin OS). */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const action = (sp.action ?? '').slice(0, 120);
  const target_table = (sp.target_table ?? '').slice(0, 63);
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);

  const [result, stats] = await Promise.all([
    listAuditPage({ ...(action ? { action } : {}), ...(target_table ? { target_table } : {}) }, page, PAGE_SIZE).catch(() => null),
    getAuditStats().catch(() => null),
  ]);

  if (!result || !stats) {
    return (
      <>
        <Hero eyebrow="PLATFORM" title="Audit" subtitle="Journal des actions sensibles." actions={<ReportButton section="audit" label="Exporter" />} />
        <EmptyState title="Lecture impossible" description="Permission audit.read requise." />
      </>
    );
  }

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const qs = (p: number) =>
    `/admin/audit?action=${encodeURIComponent(action)}&target_table=${encodeURIComponent(target_table)}&page=${p}`;

  return (
    <>
      <Hero
        eyebrow="PLATFORM"
        title="Audit"
        subtitle={`${result.total} entrée(s) — append-only, écriture serveur.`}
        actions={<ReportButton section="audit" label="Exporter" />}
      />
      <MetricGrid
        metrics={[
          { label: 'Entrées', value: stats.total.toLocaleString('fr-FR'), delta: 'cumulées', icon: 'report' },
          { label: 'Aujourd’hui', value: String(stats.today), delta: 'depuis minuit', icon: 'pulse' },
          { label: 'Acteurs', value: String(stats.actors), delta: 'distincts', icon: 'users' },
          { label: 'Dernière action', value: stats.latest ? stats.latest.action : '—', delta: stats.latest?.when ?? '', icon: 'clock' },
        ]}
      />
      <section className="os-workspace">
        <div className="os-workspace-primary">
          <DataPanel label="TRAÇABILITÉ" title="Journal" chip="append-only" kind="table" rows={[]}>
            <form method="get" className="flex flex-wrap items-end gap-2">
              <AdminField label="Action">
                <AdminInput name="action" defaultValue={action} placeholder="role.grant" maxLength={120} />
              </AdminField>
              <AdminField label="Table cible">
                <AdminInput name="target_table" defaultValue={target_table} placeholder="user_roles" maxLength={63} />
              </AdminField>
              <Button variant="secondary" type="submit">
                Filtrer
              </Button>
            </form>
            {result.data.length === 0 ? (
              <EmptyState title="Aucune entrée" description="Aucune action journalisée pour ces filtres." />
            ) : (
              <ul className="os-rows">
                {result.data.map((e) => (
                  <li key={e.id} className="os-row os-row-top">
                    <span className="os-row-copy">
                      <strong>{e.action}</strong>
                      <small>
                        {new Date(e.created_at).toLocaleString('fr-FR')} · acteur : {e.actor_id ?? '—'}
                        {e.target_table ? ` · cible : ${e.target_table}/${e.target_id ?? '—'}` : ''} · source : {e.source}
                      </small>
                      {e.diff ? <small>diff : {JSON.stringify(e.diff).slice(0, 160)}</small> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <nav aria-label="Pagination" className="os-pagination">
              {page > 1 ? <Link href={qs(page - 1)}>← Précédent</Link> : null}
              <span>Page {page} / {totalPages}</span>
              {page < totalPages ? <Link href={qs(page + 1)}>Suivant →</Link> : null}
            </nav>
          </DataPanel>
        </div>
        <InspectorBox
          content={{
            title: 'Audit Trail',
            subtitle: 'Dernière entrée',
            headline: stats.latest ? stats.latest.action : 'Journal vide',
            text: stats.latest ? `Enregistrée : ${stats.latest.when}.` : 'Aucune action journalisée.',
            rows: stats.latest
              ? [{ title: 'Action', detail: 'la plus récente', value: stats.latest.action, tone: 'info' as const }]
              : [],
          }}
        />
      </section>
    </>
  );
}
