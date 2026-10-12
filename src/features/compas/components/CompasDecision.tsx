'use client';

import { useEffect, useRef } from 'react';
import Icon from '@/components/ui/Icon';
import type { CompasDecision } from '../engine/compasModel';
import type { DecisionApply } from '../engine/decisionApply';
import { compasSetCarrierAction } from '../server/compasActions';
import type { CompasCtl } from './compasTypes';

/**
 * Îlot de la prochaine décision (maquette finale), posé au-dessus de la barre d'onglets.
 *
 * - « Voir » ouvre l'étape de la décision, toujours ;
 * - « Appliquer » n'est là que si le moteur dit que la décision est un calcul sûr
 *   (`planDecisionApply`) : il exécute les actions EXISTANTES (ici `compasSetCarrierAction`), puis
 *   l'annonce propose « Annuler » (aussi Ctrl/⌘+Z) qui remet les objets sans porteur ;
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
  const setCarrier = (itemId: string, carrierId: string | null) =>
    compasSetCarrierAction({ tripId, tripSlug: slug, itemId, carrierId, shared: true });

  const applyNow = async () => {
    if (!apply) return;
    const count = apply.assignments.length;
    const done: string[] = [];
    await ctl.run(
      `Matériel commun réparti · ${count} objet${count > 1 ? 's' : ''}`,
      async () => {
        for (const a of apply.assignments) {
          const res = await setCarrier(a.itemId, a.carrierId);
          if (!res.success) {
            // Rien à moitié : ce qui vient d'être confié est remis sans porteur.
            for (const id of done) await setCarrier(id, null).catch(() => undefined);
            return res;
          }
          done.push(a.itemId);
        }
        return { success: true };
      },
      async () => {
        for (const a of apply.assignments) {
          const res = await setCarrier(a.itemId, null);
          if (!res.success) return res;
        }
        return { success: true };
      }
    );
  };

  return (
    <div
      className="cp-decision cp-glass"
      role="group"
      aria-label="Prochaine décision"
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
        <Icon name="compass" size={17} />
      </span>
      <span className="cp-decision__t">
        <b>{decision.label}</b>
        <span>{decision.detail}</span>
        {apply && <span>Proposé : {apply.summary}</span>}
      </span>
      <button
        type="button"
        className="cp-decision__btn"
        aria-label={`Voir : ${decision.label}`}
        onClick={onView}
      >
        Voir
      </button>
      {apply && (
        <button
          type="button"
          className="cp-decision__btn cp-decision__btn--pg"
          aria-label={`Appliquer : ${apply.label}`}
          disabled={ctl.busy}
          onClick={() => void applyNow()}
        >
          Appliquer
        </button>
      )}
    </div>
  );
}
