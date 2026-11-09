import Link from 'next/link';
import s from '../../../../ui/crm.module.css';
import { ErrorState } from '../../../../ui/error-state';
import { Workspace } from '../../../../components/shell/workspace';
import { SosScreen } from '../../../../components/sos/sos-screen';
import { getSosBoard } from '../../../../components/data/admin-rpc';

export const dynamic = 'force-dynamic';

/** SOS en cours (maquette `SOS.dc.html`), mobile 390 px. */
export default async function SosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getSosBoard();
  const alert = result.data?.items?.find((item) => item.id === id);

  if (!alert) {
    return (
      <Workspace>
        <div className={s.card}>
          <ErrorState
            cause={result.failure?.cause ?? 'Cette alerte n’est plus dans le tableau des SOS.'}
            solution={result.failure?.solution ?? 'Elle a peut-être été close. Appelez le 112 si une personne est en danger.'}
          />
          <div className={s.pad}>
            <Link href="/sos" style={{ fontWeight: 600 }}>
              ← Revenir aux SOS
            </Link>
          </div>
        </div>
      </Workspace>
    );
  }

  return (
    <Workspace>
      <SosScreen alert={alert} />
    </Workspace>
  );
}
