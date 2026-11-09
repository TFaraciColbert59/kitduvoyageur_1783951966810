import Link from 'next/link';
import s from '@/ui/crm.module.css';
import { Chip } from '@/ui/chip';
import { ErrorState } from '@/ui/error-state';
import { EmptyState } from '@/ui/states';
import { Workspace } from '@/components/shell/workspace';
import { getSosBoard } from '@/components/data/admin-rpc';
import { relativeFr } from '@/lib/format';

export const dynamic = 'force-dynamic';

/** Liste des SOS (mobile d'abord). */
export default async function SosListPage() {
  const result = await getSosBoard();

  if (!result.data) {
    return (
      <Workspace>
        <h1 className={s.sosTitle}>SOS</h1>
        <div className={s.card}>
          <ErrorState
            cause={result.failure?.cause ?? 'Le tableau des SOS n’est pas accessible.'}
            solution={result.failure?.solution ?? 'Appelez le 112 depuis un téléphone si une personne est en danger.'}
          />
        </div>
      </Workspace>
    );
  }

  const items = result.data.items ?? [];

  return (
    <Workspace>
      <div className={s.sosPage} style={{ margin: 0 }}>
        <h1 className={s.sosTitle}>SOS</h1>
        <p className={s.muted} style={{ margin: 0, fontSize: 13 }}>
          Le CRM ne remplace pas les secours. Le 112 reste joignable depuis chaque alerte.
        </p>

        {items.length === 0 ? (
          <div className={s.card}>
            <EmptyState title="Aucune alerte en cours">
              Les SOS déclenchés depuis l’application apparaissent ici, avec la position partagée pendant l’alerte.
            </EmptyState>
          </div>
        ) : (
          <div className={s.colGap}>
            {items.map((alert) => (
              <Link key={alert.id} href={`/sos/${alert.id}`} className={`${s.card} ${s.pad}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className={s.between}>
                  <strong>{alert.member}</strong>
                  <Chip tone={alert.status === 'open' ? 'danger' : alert.status === 'taken' ? 'warn' : 'stone'}>
                    {alert.status === 'open' ? 'Personne n’a pris' : alert.status === 'taken' ? 'Pris en charge' : 'Clos'}
                  </Chip>
                </div>
                <div className={s.muted} style={{ fontSize: 12.5, marginTop: 4 }}>
                  {relativeFr(alert.created_at)} · {alert.trip ?? 'sortie non renseignée'}
                  {alert.lat === null ? ' · position non renseignée' : ' · position partagée'}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Workspace>
  );
}
