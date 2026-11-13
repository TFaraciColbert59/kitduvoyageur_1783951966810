import { Suspense } from 'react';
import { AuditTable } from '../../../components/audit/audit-table';
import { getAuditPage } from '../../../components/data/admin-rpc';
import { ErrorState } from '../../../ui/error-state';
import { SkeletonList } from '../../../ui/states';
import { Workspace } from '../../../components/shell/workspace';
import s from '../../../ui/crm.module.css';

export const dynamic = 'force-dynamic';

/** Journal d'audit (maquette `Journal.dc.html`). */
export default async function JournalPage({
  searchParams
}: {
  searchParams: Promise<{ periode?: string; acteur?: string; type?: string; avant?: string }>;
}) {
  const query = await searchParams;
  const result = await getAuditPage({
    before: query.avant ?? null,
    limit: 50,
    filters: { period: query.periode ?? 'aujourdhui', actor: query.acteur ?? 'tous', type: query.type ?? 'toutes' }
  });

  if (!result.data) {
    return (
      <Workspace>
        <h1 className={s.titleSm} style={{ fontSize: 28 }}>Journal d’audit</h1>
        <div className={s.card}>
          <ErrorState
            cause={result.failure?.cause ?? 'Le journal n’est pas accessible.'}
            solution={result.failure?.solution ?? 'Réessayez dans un instant.'}
          />
        </div>
      </Workspace>
    );
  }

  return (
    <Workspace>
      <Suspense fallback={<SkeletonList rows={8} />}>
        <AuditTable rows={result.data.rows ?? []} nextBefore={result.data.next_before ?? null} />
      </Suspense>
    </Workspace>
  );
}
