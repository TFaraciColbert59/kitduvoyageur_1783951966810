import Link from 'next/link';

import { Button, EmptyState } from '@/components/ui';
import { PageLayout } from '@/design';
import { listUsersPage } from '@/features/admin/queries';
import { AdminNav } from '../_components/AdminNav';
import { AdminField, AdminInput } from '../_components/AdminField';
import { RoleManager } from '../_components/RoleManager';

const PAGE_SIZE = 20;

interface SearchParams {
  q?: string;
  page?: string;
}

/** GET /admin/utilisateurs — annuaire + gestion des rôles RBAC. */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? '').slice(0, 120);
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);

  let result: Awaited<ReturnType<typeof listUsersPage>>;
  try {
    result = await listUsersPage(q, page, PAGE_SIZE);
  } catch {
    return (
      <PageLayout title="Utilisateurs" subtitle="Annuaire et rôles">
        <AdminNav />
        <EmptyState
          title="Lecture impossible"
          description="Vérifiez la permission users.read et la connexion base."
        />
      </PageLayout>
    );
  }

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <PageLayout title="Utilisateurs" subtitle={`${result.total} compte(s)`}>
      <AdminNav />
      <form method="get" className="flex items-end gap-2">
        <AdminField label="Recherche (nom ou e-mail)">
          <AdminInput name="q" defaultValue={q} placeholder="marie…" maxLength={120} />
        </AdminField>
        <Button variant="secondary" type="submit">
          Filtrer
        </Button>
      </form>

      {result.data.length === 0 ? (
        <EmptyState title="Aucun utilisateur" description="Aucun compte ne correspond." />
      ) : (
        <ul className="flex flex-col gap-3">
          {result.data.map((u) => (
            <li
              key={u.id}
              className="rounded-3xl border border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] p-4 backdrop-blur-md"
            >
              <p className="font-semibold text-[color:var(--glass-label)]">
                {u.full_name || 'Sans nom'}
              </p>
              <p className="text-sm text-[color:var(--glass-label-secondary)]">{u.email}</p>
              <p className="mt-1 text-xs text-[color:var(--glass-label-tertiary)]">
                {u.loyalty_level ? `Fidélité : ${u.loyalty_level} · ` : ''}
                {u.trust_score !== null ? `Confiance : ${u.trust_score}` : 'Confiance : —'}
              </p>
              <div className="mt-2">
                <RoleManager userId={u.id} roles={u.roles} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <nav aria-label="Pagination" className="flex items-center gap-3">
        {page > 1 ? (
          <Link href={`/admin/utilisateurs?q=${encodeURIComponent(q)}&page=${page - 1}`}>
            ← Précédent
          </Link>
        ) : null}
        <span className="text-sm text-[color:var(--glass-label-secondary)]">
          Page {page} / {totalPages}
        </span>
        {page < totalPages ? (
          <Link href={`/admin/utilisateurs?q=${encodeURIComponent(q)}&page=${page + 1}`}>
            Suivant →
          </Link>
        ) : null}
      </nav>
    </PageLayout>
  );
}
