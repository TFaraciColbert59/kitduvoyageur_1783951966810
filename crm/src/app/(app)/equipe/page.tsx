import { AgentsBoard } from '@/components/agents/agents-board';
import { getAgentsOverview, getContext } from '@/components/data/admin-rpc';
import { ErrorState } from '@/ui/error-state';
import { Workspace } from '@/components/shell/workspace';
import s from '@/ui/crm.module.css';

export const dynamic = 'force-dynamic';

/** Équipe et agents IA (maquette `Agents.dc.html`). */
export default async function AgentsPage() {
  const [overview, context] = await Promise.all([getAgentsOverview(), getContext()]);

  if (!overview.data) {
    return (
      <Workspace>
        <h1 className={s.titleSm} style={{ fontSize: 28 }}>Équipe et agents IA</h1>
        <div className={s.card}>
          <ErrorState
            cause={overview.failure?.cause ?? 'Les agents ne sont pas joignables.'}
            solution={overview.failure?.solution ?? 'Réessayez : la file humaine reste utilisable sans eux.'}
          />
        </div>
      </Workspace>
    );
  }

  return (
    <Workspace>
      <AgentsBoard agents={overview.data.agents ?? []} solo={overview.data.solo} ctx={context.data} />
    </Workspace>
  );
}
