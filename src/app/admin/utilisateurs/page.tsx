import Link from 'next/link';

import { EmptyState } from '@/components/ui';
import { ROUTES } from '../_os/routeConfig';
import { Hero, MetricGrid, DataPanel } from '../_os/panels';
import { InspectorBox } from '../_os/osUi';
import { ReportButton } from '../_os/ReportButton';
import { AdminField, AdminInput } from '../_components/AdminField';
import { RoleManager } from '../_components/RoleManager';
import { listUsersPage } from '@/features/admin/queries';
import { getUsersStats } from '@/features/admin/osQueries';

const PAGE_SIZE = 20;

interface SearchParams {
  q?: string;
  page?: string;
}

/** GET /admin/utilisateurs — annuaire + rôles RBAC (Admin OS). */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? '').slice(0, 120);
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  const cfg = ROUTES['users'];

  const [result, stats] = await Promise.all([
    listUsersPage(q, page, PAGE_SIZE).catch(() => null),
    getUsersStats().catch(() => null),
  ]);

  if (!result || !stats) {
    return (
      <>
        <Hero eyebrow={cfg.eyebrow} title={cfg.title} subtitle={cfg.subtitle} actions={<ReportButton section="users" label="Exporter" />} />
        <EmptyState title="Lecture impossible" description="Permission users.read requise." />
      </>
    );
  }

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const risky = stats.riskiest;

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
          { label: 'Total utilisateurs', value: stats.total.toLocaleString('fr-FR'), delta: `+${stats.newMonth} ce mois`, icon: 'users' },
          { label: 'Rôles attribués', value: String(stats.admins), delta: 'octrois actifs', icon: 'shield' },
          { label: 'Confiance élevée', value: String(stats.highTrust), delta: 'score ≥ 80', icon: 'check' },
          { label: 'Nouveaux (mois)', value: String(stats.newMonth), delta: 'comptes créés', icon: 'pulse' },
        ]}
      />
      <section className="os-workspace">
        <div className="os-workspace-primary">
          <DataPanel label="IDENTITÉS" title="User Directory" chip={`${result.total} comptes`} kind="table" rows={[]}>
            <form method="get" className="flex items-end gap-2" role="search">
              <AdminField label="Recherche (nom ou e-mail)">
                <AdminInput name="q" defaultValue={q} placeholder="marie…" maxLength={120} />
              </AdminField>
              <button type="submit" className="os-btn os-interactive">
                Filtrer
              </button>
            </form>
            {result.data.length === 0 ? (
              <EmptyState title="Aucun utilisateur" description="Aucun compte ne correspond." />
            ) : (
              <ul className="os-rows">
                {result.data.map((u) => (
                  <li key={u.id} className="os-row os-row-top">
                    <span className="os-row-copy">
                      <strong>{u.full_name || 'Sans nom'}</strong>
                      <small>{u.email}</small>
                      <small>
                        {u.loyalty_level ? `Fidélité : ${u.loyalty_level} · ` : ''}
                        {u.trust_score !== null ? `Confiance : ${u.trust_score}` : 'Confiance : —'}
                      </small>
                      <span className="os-row-actions">
                        <RoleManager userId={u.id} roles={u.roles} />
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <nav aria-label="Pagination" className="os-pagination">
              {page > 1 ? (
                <Link href={`/admin/utilisateurs?q=${encodeURIComponent(q)}&page=${page - 1}`}>← Précédent</Link>
              ) : null}
              <span>Page {page} / {totalPages}</span>
              {page < totalPages ? (
                <Link href={`/admin/utilisateurs?q=${encodeURIComponent(q)}&page=${page + 1}`}>Suivant →</Link>
              ) : null}
            </nav>
          </DataPanel>
        </div>
        <InspectorBox
          content={{
            title: 'Trust Signals',
            subtitle: 'Compte le plus à risque',
            headline: risky ? `${risky.name} · ${risky.score}/100` : 'Aucun compte',
            text: risky
              ? 'Score de confiance le plus bas de la base. Vérifiez l’historique avant toute sanction.'
              : 'Aucun compte à signaler.',
            rows: risky
              ? [{ title: 'Trust score', detail: 'score minimal', value: `${risky.score} / 100`, tone: risky.score < 50 ? 'danger' : 'warn' }]
              : [],
          }}
        />
      </section>
    </>
  );
}
