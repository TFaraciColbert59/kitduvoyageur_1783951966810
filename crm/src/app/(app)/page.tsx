import { QueueScreen } from '../../components/queue/queue-screen';
import { getInbox } from '../../components/data/admin-rpc';
import { ErrorState } from '../../ui/error-state';
import { EmptyState } from '../../ui/states';
import { Workspace } from '../../components/shell/workspace';
import s from '../../ui/crm.module.css';

export const dynamic = 'force-dynamic';

/** Écran d'accueil : « À traiter », la file unifiée. */
export default async function QueuePage() {
  const result = await getInbox();
  const now = new Date().toISOString();

  if (result.failure && !result.data) {
    return (
      <Workspace>
        <h1 className={s.title}>À traiter</h1>
        <div className={s.card}>
          <ErrorState cause={result.failure.cause} solution={result.failure.solution} />
        </div>
      </Workspace>
    );
  }

  const items = result.data?.items ?? [];

  if (items.length === 0) {
    return (
      <Workspace>
        <h1 className={s.title}>À traiter</h1>
        <div className={s.card}>
          <EmptyState title="Boîte vide — rien à traiter">
            Tout est fait pour l’instant. La file se remplit dès qu’un signalement, un ticket, une demande de validation
            ou un SOS arrive.
          </EmptyState>
        </div>
      </Workspace>
    );
  }

  return <QueueScreen items={items} now={now} counts={result.data?.counts ?? null} sla={result.data?.sla ?? null} />;
}
