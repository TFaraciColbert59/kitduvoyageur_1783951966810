'use client';

import Link from 'next/link';
import {
  HUB_GROUP_PATH,
  pendingViews,
  type MemberLoadView,
  type MemberView,
} from '../engine/crewView';
import type { CompasPendingInvite } from '../engine/team';
import { MemberAvatar } from './CompasCards';
import { Chip } from './CompasPrimitives';
import { useTranslation } from '@/lib/i18n/context';
import { FR_T, type CompasT } from './compasTypes';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

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
  const { t } = useTranslation();
  return (
    <span className="cp-mem__tags">
      <Chip tone="soft" icon="profil">
        {view.role}
      </Chip>
      {view.level && (
        <Chip icon="montagne">
          {t('compas.members.level', { level: view.level })}
          {view.levelNote ? ` · ${view.levelNote}` : ''}
        </Chip>
      )}
    </span>
  );
}

/** Ce qui n'est pas renseigné, dit une fois sur la ligne : allure et niveau. */
export function memberFacts(view: MemberView, t: CompasT = FR_T): string {
  return [
    view.pace
      ? `${view.pace}${view.paceNote ? ` · ${view.paceNote}` : ''}`
      : t('compas.members.paceUnknown'),
    view.level ? null : t('compas.members.levelUnknown'),
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
  const { t } = useTranslation();
  const { load } = view;
  return (
    <button type="button" className="cp-row cp-mem" aria-haspopup="dialog" onClick={onOpenBag}>
      <MemberAvatar name={view.name} url={view.avatarUrl} />
      <span className="cp-row__t">
        <b>
          {view.name}
          {isViewer ? ` ${t('compas.members.me')}` : ''}
        </b>
        <MemberTags view={view} />
        <span>{load.text}</span>
        <LoadBar load={load} />
        <span>{memberFacts(view, t)}</span>
      </span>
      <span className="cp-row__end">
        {load.pct != null && (
          <Chip tone={load.tone}>{t('compas.cards.pct', { pct: load.pct })}</Chip>
        )}
        <LKDVIcon name="suivant" size={16} />
      </span>
    </button>
  );
}

/** Une invitation qui attend sa réponse : la personne n'est pas encore dans le voyage. */
export function PendingRow({ invite }: { invite: CompasPendingInvite }) {
  const { t } = useTranslation();
  const [view] = pendingViews([invite]);
  return (
    <div className="cp-row cp-mem" style={{ cursor: 'default' }}>
      <MemberAvatar name={view.name} url={invite.avatarUrl} />
      <span className="cp-row__t">
        <b>{view.name}</b>
        <span>{view.text}</span>
      </span>
      <span className="cp-row__end">
        <Chip>{t('compas.members.pending')}</Chip>
      </span>
    </div>
  );
}

/** Renvoi vers la gestion du groupe : le Compas ne la double jamais. */
export function HubGroupLink() {
  const { t } = useTranslation();
  return (
    <div className="cp-mem__hub">
      <p className="cp-note">{t('compas.members.hubNote')}</p>
      <Link className="cp-btn cp-btn--soft cp-btn--tap" href={HUB_GROUP_PATH}>
        <LKDVIcon name="lien" size={16} aria-hidden="true" />
        {t('compas.members.hubLink')}
      </Link>
    </div>
  );
}
