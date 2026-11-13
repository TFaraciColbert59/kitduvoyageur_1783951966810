import Link from 'next/link';
import s from '../../../ui/crm.module.css';
import { Chip } from '../../../ui/chip';
import { EmptyState } from '../../../ui/states';
import { ErrorState } from '../../../ui/error-state';
import { Workspace } from '../../../components/shell/workspace';
import { ActionButtons } from '../../../components/command/action-buttons';
import { getInbox } from '../../../components/data/admin-rpc';
import { relativeFr } from '../../../lib/format';

export const dynamic = 'force-dynamic';

/** Contenus : file du pôle Contenus + contributions en lot. */
export default async function ContenusPage() {
  const result = await getInbox();
  const items = (result.data?.items ?? []).filter((item) => item.pole === 'CONT');
  const contributions = items.filter((item) => item.group === 'contributions');

  if (!result.data) {
    return (
      <Workspace>
        <h1 className={s.title}>Contenus</h1>
        <div className={s.card}>
          <ErrorState
            cause={result.failure?.cause ?? 'La file des contenus n’est pas accessible.'}
            solution={result.failure?.solution ?? 'Réessayez dans un instant.'}
          />
        </div>
      </Workspace>
    );
  }

  return (
    <Workspace>
      <div className={s.between} style={{ alignItems: 'flex-end' }}>
        <div className={s.col} style={{ gap: 4 }}>
          <h1 className={s.title}>Contenus</h1>
          <span className={s.subtitle}>
            {items.length} élément{items.length > 1 ? 's' : ''} · {contributions.length} contribution
            {contributions.length > 1 ? 's' : ''} en lot
          </span>
        </div>
        <div className={s.rowFlexWrap}>
          <ActionButtons
            actions={[{ command: 'contribution_decide', label: 'Traiter les contributions en lot' }]}
            target={{ kind: 'contributions', id: 'lot' }}
            max={2}
          />
        </div>
      </div>

      <div className={s.card}>
        {items.length === 0 ? (
          <EmptyState title="Rien à traiter dans les contenus">
            Lieux, fiches pays, contributions et signalements terrain apparaîtront ici.
          </EmptyState>
        ) : (
          items.map((item) => (
            <Link key={item.key} href={`/cas/${item.source}/${item.id}`} className={s.row}>
              <span className={s.rowMain}>
                <span className={s.rowTitle}>{item.title}</span>
                <span className={s.rowSub}>
                  {item.subtitle} · {relativeFr(item.created_at)}
                </span>
              </span>
              <Chip tone={item.group === 'contributions' ? 'stone' : 'warn'}>{item.group}</Chip>
            </Link>
          ))
        )}
      </div>

      <div className={s.rowFlexWrap}>
        <Chip tone="stone">Actions du pôle</Chip>
        <ActionButtons
          actions={[
            { command: 'place_set_verified', label: 'Vérifier un lieu' },
            { command: 'country_content_review', label: 'Relire une fiche pays' },
            { command: 'terrain_report_decide', label: 'Décider un signalement terrain' },
            { command: 'coverage_dataset_publish', label: 'Publier un jeu de couverture' }
          ]}
          target={{ kind: 'contenu', id: 'libre' }}
          max={4}
        />
      </div>
    </Workspace>
  );
}
