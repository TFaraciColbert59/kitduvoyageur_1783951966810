'use client';

import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import {
  HUB_GROUP_PATH,
  pendingViews,
  type MemberLoadView,
  type MemberView,
} from '../engine/crewView';
import type { CompasPendingInvite } from '../engine/team';
import { MemberAvatar } from './CompasCards';
import { Chip } from './CompasPrimitives';

/**
 * Nous · Équipe : les membres EN LECTURE (niveau, présence, rôle, charge portée).
 * Aucune commande de gestion ici : inviter, retirer et changer un rôle se font dans le Hub
 * (`/hub/groupe`), le Compas y renvoie. Tout ce qui est affiché vient du modèle réel ; une valeur
 * absente est dite « non renseignée ».
 */

/** Jauge charge / capacité : décorative, la phrase de la ligne dit les mêmes chiffres. */
export function LoadBar({ load }: { load: MemberLoadView }) {
  if (load.barPct == null) return null;
  return (
    <span className="cp-meter cp-mem__bar" data-tone={load.tone === 'good' ? undefined : load.tone} aria-hidden="true">
      <i style={{ width: `${load.barPct}%` }} />
    </span>
  );
}

/** Rôle et niveau en pastilles ; le reste de la ligne dit ce qui manque. */
export function MemberTags({ view }: { view: MemberView }) {
  return (
    <span className="cp-mem__tags">
      <Chip tone="soft" icon="user">
        {view.role}
      </Chip>
      {view.level && (
        <Chip icon="mountain">
          Niveau {view.level}
          {view.levelNote ? ` · ${view.levelNote}` : ''}
        </Chip>
      )}
    </span>
  );
}

/** Ce qui n'est pas renseigné, dit une fois sur la ligne : allure et niveau. */
export function memberFacts(view: MemberView): string {
  return [
    view.pace ? `${view.pace}${view.paceNote ? ` · ${view.paceNote}` : ''}` : 'allure non renseignée',
    view.level ? null : 'niveau non renseigné',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Une personne de l'équipe : toucher ouvre son sac (lecture). */
export function MemberRow({
  view,
  isViewer,
  onOpenBag,
}: {
  view: MemberView;
  isViewer: boolean;
  onOpenBag: () => void;
}) {
  const { load } = view;
  return (
    <button type="button" className="cp-row cp-mem" aria-haspopup="dialog" onClick={onOpenBag}>
      <MemberAvatar name={view.name} url={view.avatarUrl} />
      <span className="cp-row__t">
        <b>
          {view.name}
          {isViewer ? ' (moi)' : ''}
        </b>
        <MemberTags view={view} />
        <span>{load.text}</span>
        <LoadBar load={load} />
        <span>{memberFacts(view)}</span>
      </span>
      <span className="cp-row__end">
        {load.pct != null && <Chip tone={load.tone}>{load.pct} %</Chip>}
        <Icon name="chevron-right" size={16} />
      </span>
    </button>
  );
}

/** Une invitation qui attend sa réponse : la personne n'est pas encore dans le voyage. */
export function PendingRow({ invite }: { invite: CompasPendingInvite }) {
  const [view] = pendingViews([invite]);
  return (
    <div className="cp-row cp-mem" style={{ cursor: 'default' }}>
      <MemberAvatar name={view.name} url={invite.avatarUrl} />
      <span className="cp-row__t">
        <b>{view.name}</b>
        <span>{view.text}</span>
      </span>
      <span className="cp-row__end">
        <Chip>En attente</Chip>
      </span>
    </div>
  );
}

/** Renvoi vers la gestion du groupe : le Compas ne la double jamais. */
export function HubGroupLink() {
  return (
    <div className="cp-mem__hub">
      <p className="cp-note">Inviter, retirer ou changer un rôle se fait dans le Hub.</p>
      <Link className="cp-btn cp-btn--soft cp-btn--tap" href={HUB_GROUP_PATH}>
        <Icon name="external-link" size={16} aria-hidden="true" />
        Gérer le groupe dans le Hub
      </Link>
    </div>
  );
}
