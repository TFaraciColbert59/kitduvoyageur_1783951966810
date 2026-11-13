import Link from 'next/link';
import s from '../../../ui/crm.module.css';
import { ErrorState } from '../../../ui/error-state';
import { SosScreen } from '../../../components/sos/sos-screen';
import { getSosBoard } from '../../../components/data/admin-rpc';
import { ToastProvider } from '../../../ui/toast';

export const dynamic = 'force-dynamic';

/**
 * SOS en cours (maquette `SOS.dc.html`) : route NUE, sans coque — une urgence
 * doit tenir sur un téléphone, sans navigation ni recherche autour.
 */
export default async function SosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getSosBoard();
  const alert = result.data?.items?.find((item) => item.id === id);

  if (!alert) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: 'var(--lkv-surface)' }}>
        <div className={`${s.card} ${s.padLg}`} style={{ maxWidth: 420 }}>
          <ErrorState
            cause={result.failure?.cause ?? 'Cette alerte n’est plus dans le tableau des SOS.'}
            solution={result.failure?.solution ?? 'Elle a peut-être été close. Appelez le 112 si une personne est en danger.'}
          />
          <div style={{ marginTop: 12 }}>
            <Link href="/sos" style={{ fontWeight: 600 }}>← Revenir aux SOS</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <ToastProvider>
      <main style={{ minHeight: '100vh', background: 'var(--lkv-surface)' }}>
        <SosScreen alert={alert} />
      </main>
    </ToastProvider>
  );
}
