'use client';

import { useEffect, useRef } from 'react';
import type { CompasDecision } from '../engine/compasModel';
import type { DecisionApply } from '../engine/decisionApply';
import { compasSetCarriersAction } from '../server/compasActions';
import { useTranslation } from '@/lib/i18n/context';
import { countText, type CompasCtl } from './compasTypes';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

/**
 * Îlot de la prochaine décision (maquette finale), posé au-dessus de la barre d'onglets.
 *
 * - « Voir » ouvre l'étape de la décision, toujours ;
 * - « Appliquer » n'est là que si le moteur dit que la décision est un calcul sûr
 *   (`planDecisionApply`) : la répartition entière part en UNE demande (`compasSetCarriersAction`, tout ou
 *   rien côté serveur : zod, session, droit d'édition, RLS, remise vérifiée si une écriture échoue), puis
 *   l'annonce propose « Annuler » (aussi Ctrl/⌘+Z) qui remet les objets sans porteur, aussi en une demande ;
 * - rien à décider : le composant n'est pas rendu.
 * L'annonce est polie (`aria-live`) ; toucher le texte vaut « Voir » ; aucun piège au clavier.
 */
export function DecisionCapsule({
  ctl,
  decision,
  apply,
  blocked,
  withAccessory,
  inert,
  onView,
}: {
  ctl: CompasCtl;
  decision: CompasDecision;
  apply: DecisionApply | null;
  /** Le verdict est bloquant : l'icône le dit. */
  blocked: boolean;
  /** L'accessoire (profil d'altitude) occupe déjà le bas de la carte : l'îlot se pose au-dessus. */
  withAccessory: boolean;
  /** Un tiroir est ouvert : l'îlot sort de l'ordre de tabulation et de l'arbre d'accessibilité. */
  inert: boolean;
  onView: () => void;
}) {
  const { t, locale } = useTranslation();
  // Le focus ne doit pas se perdre si l'îlot disparaît sous le doigt (la décision a été prise).
  const hadFocus = useRef(false);
  useEffect(
    () => () => {
      if (hadFocus.current)
        document.querySelector<HTMLElement>('.cp-steps [aria-current="step"]')?.focus();
    },
    []
  );

  const { tripId, slug } = ctl.data.model;
  /** Une seule demande pour tout le lot : jamais d'écritures en série dont une moitié pourrait rester. */
  const setCarriers = (assignments: ReadonlyArray<{ itemId: string; carrierId: string | null }>) =>
    compasSetCarriersAction({
      tripId,
      tripSlug: slug,
      assignments: assignments.map(({ itemId, carrierId }) => ({ itemId, carrierId })),
      shared: true,
    });

  const applyNow = async () => {
    if (!apply) return;
    const count = apply.assignments.length;
    // Réseau perdu : `ctl.run` le dit (« Connexion perdue »). Le lot étant tout ou rien côté serveur, il
    // n'y a rien à moitié à rattraper ici ; une relance rejoue le même lot et donne le même état.
    await ctl.run(
      countText(t, locale, count, 'compas.decision.sharedOne', 'compas.decision.sharedOther'),
      () => setCarriers(apply.assignments),
      () => setCarriers(apply.assignments.map((a) => ({ itemId: a.itemId, carrierId: null })))
    );
  };

  return (
    <div
      className="cp-decision cp-glass"
      role="group"
      aria-label={t('compas.decision.label')}
      aria-live="polite"
      data-acc={withAccessory ? '1' : undefined}
      inert={inert || undefined}
      onFocus={() => {
        hadFocus.current = true;
      }}
      onBlur={() => {
        hadFocus.current = false;
      }}
      // Toucher le texte vaut « Voir » ; les boutons gardent leur rôle (clavier : le bouton « Voir »).
      onClick={(e) => {
        if ((e.target as Element).closest('button')) return;
        onView();
      }}
    >
      <span className="cp-decision__i" data-tone={blocked ? 'bad' : undefined}>
        <LKDVIcon name="boussole" size={17} />
      </span>
      <span className="cp-decision__t">
        <b>{decision.label}</b>
        <span>{decision.detail}</span>
        {apply && <span>{t('compas.decision.proposed', { summary: apply.summary })}</span>}
      </span>
      <button
        type="button"
        className="cp-decision__btn"
        aria-label={t('compas.decision.viewOf', { label: decision.label })}
        onClick={onView}
      >
        {t('compas.decision.view')}
      </button>
      {apply && (
        <button
          type="button"
          className="cp-decision__btn cp-decision__btn--pg"
          aria-label={t('compas.decision.applyOf', { label: apply.label })}
          disabled={ctl.busy}
          onClick={() => void applyNow()}
        >
          {t('compas.decision.apply')}
        </button>
      )}
    </div>
  );
}
