import Link from 'next/link';

import { Button, EmptyState } from '@/components/ui';
import { PageLayout } from '@/design';
import { listAuditPage } from '@/features/admin/queries';
import { AdminNav } from '../_components/AdminNav';
import { AdminField, AdminInput } from '../_components/AdminField';

const PAGE_SIZE = 20;

interface SearchParams {
  action?: string;
  target_table?: string;
  page?: string;
}

/** GET /admin/audit — journal append-only, filtres + pagination. */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const action = (sp.action ?? '').slice(0, 120);
  const target_table = (sp.target_table ?? '').slice(0, 63);
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);

  let result: Awaited<ReturnType<typeof listAuditPage>>;
  try {
    result = await listAuditPage(
      {
        ...(action ? { action } : {}),
        ...(target_table ? { target_table } : {}),
      },
      page,
      PAGE_SIZE
    );
  } catch {
    return (
      <PageLayout title="Audit" subtitle="Journal des actions sensibles">
        <AdminNav />
        <EmptyState
          title="Lecture impossible"
          description="Permission audit.read requise."
        />
      </PageLayout>
    );
  }

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const qs = (p: number) =>
    `/admin/audit?action=${encodeURIComponent(action)}&target_table=${encodeURIComponent(target_table)}&page=${p}`;

  return (
    <PageLayout title="Audit" subtitle={`${result.total} entrée(s) — append-only`}>
      <AdminNav />
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
        <ul className="flex flex-col gap-3">
          {result.data.map((e) => (
            <li
              key={e.id}
              className="rounded-3xl border border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] p-4 backdrop-blur-md"
            >
              <p className="font-semibold text-[color:var(--glass-label)]">{e.action}</p>
              <p className="text-xs text-[color:var(--glass-label-secondary)]">
                {new Date(e.created_at).toLocaleString('fr-FR')} · acteur : {e.actor_id ?? '—'}
                {e.target_table ? ` · cible : ${e.target_table}/${e.target_id ?? '—'}` : ''} ·
                source : {e.source}
              </p>
              {e.diff ? (
                <pre className="mt-2 overflow-x-auto rounded-2xl bg-black/5 p-2 text-xs">
                  {JSON.stringify(e.diff, null, 2)}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <nav aria-label="Pagination" className="flex items-center gap-3">
        {page > 1 ? <Link href={qs(page - 1)}>← Précédent</Link> : null}
        <span className="text-sm text-[color:var(--glass-label-secondary)]">
          Page {page} / {totalPages}
        </span>
        {page < totalPages ? <Link href={qs(page + 1)}>Suivant →</Link> : null}
      </nav>
    </PageLayout>
  );
}
