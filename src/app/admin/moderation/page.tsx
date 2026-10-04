import Link from 'next/link';

import { EmptyState } from '@/components/ui';
import { PageLayout } from '@/design';
import { listModerationQueue } from '@/features/admin/queries';
import { AdminNav } from '../_components/AdminNav';
import { ModerationActions } from '../_components/ModerationActions';

const STATUTS = ['en_attente', 'approuve', 'rejete', 'signale'] as const;

interface SearchParams {
  statut?: string;
}

/** GET /admin/moderation — file de modération temps réel + traitement. */
export default async function AdminModerationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const statut = STATUTS.includes(sp.statut as (typeof STATUTS)[number])
    ? (sp.statut as string)
    : 'en_attente';

  let queue: Awaited<ReturnType<typeof listModerationQueue>>;
  try {
    queue = await listModerationQueue(statut);
  } catch {
    return (
      <PageLayout title="Modération" subtitle="File de modération">
        <AdminNav />
        <EmptyState
          title="Lecture impossible"
          description="Permission moderation.read requise."
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Modération" subtitle={`${queue.length} élément(s) : ${statut}`}>
      <AdminNav />
      <nav aria-label="Filtrer par statut" className="flex flex-wrap gap-2">
        {STATUTS.map((s) => (
          <Link
            key={s}
            href={`/admin/moderation?statut=${s}`}
            aria-current={s === statut ? 'page' : undefined}
            className={
              s === statut
                ? 'shrink-0 rounded-full bg-[color:var(--g3-bg)] px-4 py-2 text-sm font-semibold text-[color:var(--g3-text)]'
                : 'shrink-0 rounded-full border border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] px-4 py-2 text-sm font-semibold text-[color:var(--glass-label)]'
            }
          >
            {s}
          </Link>
        ))}
      </nav>

      {queue.length === 0 ? (
        <EmptyState
          title="File vide"
          description="Aucun élément dans ce statut."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {queue.map((m) => (
            <li
              key={m.id}
              className="rounded-3xl border border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] p-4 backdrop-blur-md"
            >
              <p className="font-semibold text-[color:var(--glass-label)]">
                {m.contenu_type} · {m.contenu_id}
              </p>
              <p className="text-xs text-[color:var(--glass-label-secondary)]">
                {new Date(m.created_at).toLocaleString('fr-FR')}
                {m.moderateur_id ? ` · traité par ${m.moderateur_id.slice(0, 8)}` : ''}
              </p>
              <div className="mt-2">
                <ModerationActions id={m.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageLayout>
  );
}
