import Link from 'next/link';
import s from '@/ui/crm.module.css';
import { Label } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { ErrorState } from '@/ui/error-state';
import { Workspace } from '@/components/shell/workspace';
import { ApprovalPanel } from '@/components/approval/approval-panel';
import { LOCAL_CATALOG } from '@/components/command/catalog';
import { getRequestDetail } from '@/components/data/admin-rpc';
import { euros } from '@/lib/format';

export const dynamic = 'force-dynamic';

/** Demande à valider (maquette `Remboursement.dc.html`). */
export default async function ApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getRequestDetail(id);

  if (!result.data) {
    return (
      <Workspace>
        <span className={s.muted} style={{ fontSize: 13 }}>
          <Link href="/">À traiter</Link> › À valider
        </span>
        <div className={s.card}>
          <ErrorState
            cause={result.failure?.cause ?? 'Cette demande n’est pas accessible.'}
            solution={result.failure?.solution ?? 'Revenez à la file : la demande y figure tant qu’elle est en attente.'}
          />
        </div>
      </Workspace>
    );
  }

  const request = result.data;
  const definition = LOCAL_CATALOG.find((command) => command.command === request.command);
  const isMoney = request.amount_cents !== null;
  const title = isMoney ? `Valider un remboursement de ${euros(request.amount_cents)}` : `Valider : ${definition?.label ?? request.label}`;

  return (
    <Workspace
      rail={
        <>
          <Label>Contexte de la demande</Label>

          <div className={`${s.card} ${s.railCard}`}>
            <Label>Commande</Label>
            <span style={{ fontSize: 13 }}>{definition?.label ?? request.label}</span>
            <span className={s.mono} style={{ fontSize: 12 }}>{request.command}</span>
            <span className={s.rowFlexWrap}>
              {definition?.needsValidation ? <Chip tone="info">2 personnes</Chip> : null}
              {definition?.undoable ? <Chip tone="sage">Annul. 10 s</Chip> : null}
              {request.solo ? <Chip tone="warn">Mode solo</Chip> : null}
            </span>
          </div>

          <div className={`${s.card} ${s.railCard}`}>
            <Label>Risque</Label>
            <span style={{ fontSize: 13 }}>
              {request.self_authored ? 'Vous avez préparé cette demande.' : 'Préparée par une autre personne.'}
            </span>
            <span style={{ fontSize: 13 }}>
              {request.second_human_required ? 'Un second humain doit valider.' : 'Validation possible en solo.'}
            </span>
            <span className={s.muted} style={{ fontSize: 12.5 }}>
              Litiges, remboursements antérieurs et historique du membre : non renseignés sur cet écran.
            </span>
          </div>

          <div className={`${s.card} ${s.railCard}`}>
            <Label>Empreinte</Label>
            <span className={s.mono} style={{ fontSize: 11.5, overflowWrap: 'anywhere' }}>
              {request.fingerprint || 'non renseignée'}
            </span>
            <span className={s.muted} style={{ fontSize: 12.5 }}>
              Si une valeur change, l’empreinte change et la validation est refusée.
            </span>
          </div>
        </>
      }
    >
      <span className={s.muted} style={{ fontSize: 13 }}>
        <Link href="/">À traiter</Link> › {definition ? definition.pole : 'Pilotage'} › À valider
      </span>

      <h1 className={s.titleSm}>{title}</h1>

      <ApprovalPanel request={request} />
    </Workspace>
  );
}
