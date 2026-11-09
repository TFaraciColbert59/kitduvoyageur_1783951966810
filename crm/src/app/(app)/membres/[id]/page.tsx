import Link from 'next/link';
import s from '../../../../ui/crm.module.css';
import { Card, Label } from '../../../../ui/card';
import { ErrorState } from '../../../../ui/error-state';
import { Workspace } from '../../../../components/shell/workspace';
import { MemberRecord } from '../../../../components/member/member-record';
import { getMember360 } from '../../../../components/data/admin-rpc';
import { euros, relativeFr } from '../../../../lib/format';
import type { Member360 } from '../../../../lib/rpc';

export const dynamic = 'force-dynamic';

/** Fiche membre 360° (maquette `Membre.dc.html`). */
export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getMember360(id);

  if (!result.data) {
    return (
      <Workspace>
        <span className={s.muted} style={{ fontSize: 13 }}>
          <Link href="/">À traiter</Link> › Membre <span className={s.mono}>{id}</span>
        </span>
        <div className={s.card}>
          <ErrorState
            cause={result.failure?.cause ?? 'Cette fiche n’est pas accessible.'}
            solution={result.failure?.solution ?? 'Revenez à la file et rouvrez la fiche depuis un cas.'}
          />
        </div>
      </Workspace>
    );
  }

  const member = result.data;

  return (
    <Workspace bare>
      <MemberRecord member={member} rail={<MemberRail member={member} />} />
    </Workspace>
  );
}

/** Rail de contexte : confiance, commandes, support, sessions (maquette `Membre.dc.html`). */
function MemberRail({ member }: { member: Member360 }) {
  const score = member.trust_score;
  const orders = member.orders ?? [];
  const sessions = member.sessions;
  const openTickets = member.support?.open_tickets ?? null;

  return (
    <>
      <Card className={s.railCard} style={{ gap: 8 }}>
        <Label>Confiance</Label>
        <span className={s.between} style={{ flexWrap: 'nowrap', gap: 12 }}>
          <span>Score de confiance</span>
          <strong>{score === null ? 'non renseigné' : `${score} / 100`}</strong>
        </span>
        <span className={s.progress}>
          <span
            className={`${s.progressFill} ${score !== null && score < 50 ? s.progressWarn : ''}`}
            style={{ width: `${score ?? 0}%` }}
          />
        </span>
        <span className={s.muted} style={{ fontSize: 12.5 }}>
          Sorties prouvées au GPS : {member.gps_proofs ?? 'non renseigné'} · signalements reçus :{' '}
          {member.activity.reports_against}
        </span>
      </Card>

      <Card className={s.railCard} style={{ gap: 8 }}>
        <Label>Commandes</Label>
        {orders.length === 0 ? (
          <span className={s.muted} style={{ fontSize: 13 }}>
            Aucune commande au compteur
          </span>
        ) : (
          orders.map((order) => (
            <span key={order.number} className={s.between} style={{ flexWrap: 'nowrap', gap: 12, fontSize: 13 }}>
              <span className={s.mono}>{order.number}</span>
              <span>
                {euros(order.amount_cents)} · {order.status}
              </span>
            </span>
          ))
        )}
      </Card>

      <Card className={s.railCard} style={{ gap: 8 }}>
        <Label>Support</Label>
        <span style={{ fontSize: 13 }}>
          {openTickets === null
            ? 'Tickets ouverts : non renseigné'
            : openTickets === 0
              ? 'Aucun ticket ouvert'
              : `${openTickets} ticket${openTickets > 1 ? 's' : ''} ouvert${openTickets > 1 ? 's' : ''}`}
        </span>
      </Card>

      <Card className={s.railCard} style={{ gap: 8 }}>
        <Label>Appareils et sessions</Label>
        <span style={{ fontSize: 13 }}>
          {sessions
            ? `${sessions.count} session${sessions.count > 1 ? 's' : ''} active${sessions.count > 1 ? 's' : ''} · ${sessions.device}`
            : 'Sessions actives : non renseigné'}
        </span>
        <span className={s.muted} style={{ fontSize: 12.5 }}>
          Dernière connexion {sessions?.last_seen ? relativeFr(sessions.last_seen) : 'non renseignée'}
        </span>
      </Card>
    </>
  );
}
