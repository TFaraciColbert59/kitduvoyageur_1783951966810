import Link from 'next/link';
import s from '@/ui/crm.module.css';
import { Card, Label } from '@/ui/card';
import { ErrorState } from '@/ui/error-state';
import { Workspace } from '@/components/shell/workspace';
import { MemberRecord } from '@/components/member/member-record';
import { getMember360 } from '@/components/data/admin-rpc';
import type { Member360 } from '@/lib/rpc';

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
    <Workspace bare rail={<MemberRail member={member} />}>
      <MemberRecord member={member} />
    </Workspace>
  );
}

function MemberRail({ member }: { member: Member360 }) {
  const score = member.trust_score;
  return (
    <>
      <Label>Contexte</Label>

      <div className={`${s.card} ${s.railCard}`}>
        <Label>Confiance</Label>
        <span className={s.between}>
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
          Signalements reçus : {member.activity.reports_against} · avertissements actifs :{' '}
          {member.strikes.filter((strike) => strike.active).length}
        </span>
      </div>

      <div className={`${s.card} ${s.railCard}`}>
        <Label>Commandes</Label>
        <span style={{ fontSize: 13 }}>{member.activity.orders} commande(s) au compteur</span>
        <span className={s.muted} style={{ fontSize: 12.5 }}>
          Le détail s’ouvre par la commande « Ouvrir une commande » (barre de commande).
        </span>
      </div>

      <div className={`${s.card} ${s.railCard}`}>
        <Label>Support</Label>
        <span style={{ fontSize: 13 }}>Tickets ouverts : non renseigné</span>
        <span className={s.muted} style={{ fontSize: 12.5 }}>
          La fiche ne reçoit pas la liste des tickets ; elle s’ouvre depuis le pôle Membres.
        </span>
      </div>

      <div className={`${s.card} ${s.railCard}`}>
        <Label>Appareils et sessions</Label>
        <span style={{ fontSize: 13 }}>Sessions actives : non renseigné</span>
        <span className={s.muted} style={{ fontSize: 12.5 }}>
          Dernière activité : {member.activity.last_seen ? new Date(member.activity.last_seen).toLocaleString('fr-FR') : 'non renseignée'}
        </span>
      </div>

      <Card className={s.railCard} style={{ background: 'var(--lkv-sage-50)' }}>
        <Label>Rappel</Label>
        <span className={s.muted} style={{ fontSize: 12.5 }}>
          Un agent ne valide jamais une sanction. Les documents d’identité restent hors de cet écran.
        </span>
      </Card>
    </>
  );
}
