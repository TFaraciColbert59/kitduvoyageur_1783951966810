'use client';

import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import { departureText } from '../engine/departure';
import type { ApplyOp } from '../engine/intent';
import { inverseOps, runOps } from './compasApply';
import type { CompasCtl } from './compasTypes';

/**
 * Le voyage a-t-il un trajet d'approche à chiffrer ? Faux pour une sortie de quelques heures
 * (module « trajet » du projet éteint) ; sans contexte résolu (écran plus ancien), oui.
 */
export function hasApproach(ctl: CompasCtl): boolean {
  return ctl.data.context ? ctl.data.context.modules.transport : true;
}

/**
 * D'où part le trajet d'approche, et d'où ça vient (PLAN-100 4.3). Trois sources : le départ dit
 * (« depuis Lyon »), le domicile du profil voyageur, la position de l'appareil. Seul le départ dit
 * est nommé ; le domicile et la position ne le sont jamais (`engine/departure.ts`).
 *
 * Un départ dit se remplace ou s'efface (retour au domicile, à la position, ou « non chiffré »).
 * Sans départ dit, un champ « Ville de départ » le pose par la MÊME écriture que « depuis Lyon »
 * dans « Dis-le » (`compasSetOriginAction` : même recherche sur la carte, même limite, même
 * refus d'un lieu qui n'est pas habité), annulable d'un geste.
 */
export function DepartureBlock({ ctl }: { ctl: CompasCtl }) {
  const { departure, canEdit } = ctl.data;
  const text = departureText(departure);
  const [draft, setDraft] = useState('');
  const edit = canEdit && !ctl.busy;
  const said = departure?.source === 'dit';

  const save = (place: string | null) => {
    const ops: ApplyOp[] = [{ op: 'origin', place }];
    const undo = inverseOps(ctl, ops);
    void ctl
      .run(
        place ? 'Départ enregistré' : 'Départ effacé',
        () => runOps(ctl, ops),
        undo ? () => runOps(ctl, undo) : undefined
      )
      .then((done) => {
        if (done && place) setDraft('');
      });
  };

  return (
    <div
      className="cp-prefs__block"
      data-testid="departure"
      data-source={departure?.source ?? 'aucun'}
    >
      <span className="cp-prefs__l">
        Départ
        {text.source && (
          <span className="cp-src" data-src={departure?.source}>
            {text.source}
          </span>
        )}
      </span>
      <p className="cp-kv" data-testid="departure-value">
        <b>{text.value}</b>
      </p>
      <p className="cp-sub">{text.hint}</p>
      {canEdit && (
        <form
          className="cp-searchrow"
          onSubmit={(e) => {
            e.preventDefault();
            const place = draft.trim();
            if (place.length >= 2 && edit) save(place);
          }}
        >
          <label className="cp-field">
            <span className="sr-only">Ville de départ</span>
            <input
              value={draft}
              maxLength={80}
              autoComplete="off"
              enterKeyHint="go"
              disabled={ctl.busy}
              placeholder={said ? 'Partir d’une autre ville' : 'Ville de départ'}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="cp-ibtn cp-glass"
            aria-label={said ? 'Remplacer le départ' : 'Partir de cette ville'}
            disabled={!edit || draft.trim().length < 2}
          >
            <Icon name="check" size={17} />
          </button>
        </form>
      )}
      {canEdit && said && (
        <div className="cp-actions">
          <button type="button" className="cp-btn" disabled={!edit} onClick={() => save(null)}>
            Effacer le départ
          </button>
        </div>
      )}
    </div>
  );
}
