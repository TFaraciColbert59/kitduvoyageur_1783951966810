import { PoleScreen } from '../../../../components/pole/pole-screen';
import { getContext, getInbox } from '../../../../components/data/admin-rpc';
import { LOCAL_CATALOG } from '../../../../lib/catalog-local';
import { ErrorState } from '../../../../ui/error-state';
import { Workspace } from '../../../../components/shell/workspace';
import { POLES } from '../../../../lib/catalog';
import s from '../../../../ui/crm.module.css';
import type { PoleCode } from '../../../../lib/rpc';

export const dynamic = 'force-dynamic';

/** Pôle (maquette `Main.dc.html` filtrée sur le pôle). */
export default async function PolePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const known = POLES.find((pole) => pole.code === code);

  if (!known) {
    return (
      <Workspace>
        <div className={s.card}>
          <ErrorState
            cause={`Le pôle « ${code} » n’existe pas.`}
            solution="Les 7 pôles sont Confiance, Membres, Commerce, Contenus, Produit et IA, Croissance, Technique."
          />
        </div>
      </Workspace>
    );
  }

  const [inbox, context] = await Promise.all([getInbox(), getContext()]);
  const items = (inbox.data?.items ?? []).filter((item) => item.pole === code);
  const commands = LOCAL_CATALOG.filter((command) => command.pole === code);
  const now = new Date().toISOString();

  if (!inbox.data) {
    return (
      <Workspace>
        <h1 className={s.title}>{known.label}</h1>
        <div className={s.card}>
          <ErrorState
            cause={inbox.failure?.cause ?? 'La file de ce pôle n’est pas accessible.'}
            solution={inbox.failure?.solution ?? 'Réessayez dans un instant.'}
          />
        </div>
      </Workspace>
    );
  }

  return (
    <Workspace>
      <PoleScreen code={code as PoleCode} items={items} commands={commands} ctx={context.data} now={now} />
    </Workspace>
  );
}
