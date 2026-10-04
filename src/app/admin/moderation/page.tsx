import Link from 'next/link';

import { EmptyState } from '@/components/ui';
import { ROUTES } from '../_os/routeConfig';
import { Hero, MetricGrid, DataPanel } from '../_os/panels';
import { InspectorBox } from '../_os/osUi';
import { ReportButton } from '../_os/ReportButton';
import { ModerationActions } from '../_components/ModerationActions';
import { listModerationQueue } from '@/features/admin/queries';
import { getModerationStats } from '@/features/admin/osQueries';

const STATUTS = ['en_attente', 'approuve', 'rejete', 'signale'] as const;

interface SearchParams {
  statut?: string;
}

/** GET /admin/moderation — Trust & Safety (Admin OS). */
export default async function AdminModerationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const statut = STATUTS.includes(sp.statut as (typeof STATUTS)[number]) ? (sp.statut as string) : 'en_attente';
  const cfg = ROUTES['moderation'];

  const [queue, stats] = await Promise.all([
    listModerationQueue(statut).catch(() => null),
    getModerationStats().catch(() => null),
  ]);

  if (!queue || !stats) {
    return (
      <>
        <Hero eyebrow={cfg.eyebrow} title={cfg.title} subtitle={cfg.subtitle} actions={<ReportButton section="moderation" label="Exporter" />} />
        <EmptyState title="Lecture impossible" description="Permission moderation.read requise." />
      </>
    );
  }

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
          { label: 'Queue critique', value: String(stats.pending), delta: 'en attente', icon: 'warning', tone: stats.pending > 0 ? 'warn' : undefined },
          { label: 'En attente', value: String(stats.pending), delta: `statut : ${statut}`, icon: 'clock' },
          { label: 'Approuvés', value: String(stats.approved), delta: 'traités', icon: 'check' },
          { label: 'Rejetés', value: String(stats.rejected), delta: 'traités', icon: 'shield' },
        ]}
      />
      <section className="os-workspace">
        <div className="os-workspace-primary">
          <DataPanel label="PRIORITÉ" title="Safety Queue" chip={`${queue.length} élément(s)`} kind="table" rows={[]}>
            <nav aria-label="Filtrer par statut" className="flex flex-wrap gap-2">
              {STATUTS.map((s) => (
                <Link
                  key={s}
                  href={`/admin/moderation?statut=${s}`}
                  aria-current={s === statut ? 'page' : undefined}
                  className={s === statut ? 'os-btn os-tint os-btn-sm' : 'os-btn os-interactive os-btn-sm'}
                >
                  {s}
                </Link>
              ))}
            </nav>
            {queue.length === 0 ? (
              <EmptyState title="File vide" description="Aucun élément dans ce statut." />
            ) : (
              <ul className="os-rows">
                {queue.map((m) => (
                  <li key={m.id} className="os-row os-row-top">
                    <span className="os-row-copy">
                      <strong>
                        {m.contenu_type} · {m.contenu_id}
                      </strong>
                      <small>
                        {new Date(m.created_at).toLocaleString('fr-FR')}
                        {m.moderateur_id ? ` · traité par ${m.moderateur_id.slice(0, 8)}` : ''}
                      </small>
                      <span className="os-row-actions">
                        <ModerationActions id={m.id} />
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
            title: 'Policy Signals',
            subtitle: 'Dossier prioritaire',
            headline: stats.oldest ? `${stats.oldest.type} en attente` : 'File nominale',
            text: stats.oldest
              ? `Le dossier le plus ancien attend depuis : ${stats.oldest.waiting}. Traitez par ancienneté pour tenir le SLA.`
              : 'Aucun signalement en attente. Les files sont vides.',
            rows: stats.oldest
              ? [{ title: 'Ancienneté max', detail: stats.oldest.type, value: stats.oldest.waiting, tone: 'warn' as const }]
              : [],
          }}
        />
      </section>
    </>
  );
}
