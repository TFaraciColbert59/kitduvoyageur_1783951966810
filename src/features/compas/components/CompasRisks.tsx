'use client';

import { useId } from 'react';
import type { DangerAssessment } from '../engine/danger';
import { riskBars, type RiskAxisBar } from '../engine/riskBars';

/**
 * Barres de risque par axe (onglet « Risques »). Jamais de score : trois barres à quatre
 * niveaux (faible · modéré · élevé · non évalué) lisibles sans la couleur — le niveau est écrit,
 * le nombre de segments pleins le redit, un axe non évalué est une barre vide hachurée.
 * Chaque barre cite sa source et sa date ; le détail des signaux reste dans « Signaux du verdict ».
 */
export function RiskBars({ danger }: { danger: DangerAssessment }) {
  const id = useId();
  const bars = riskBars(danger);
  return (
    <section className="cp-risks" aria-labelledby={`${id}-h`}>
      <h4 id={`${id}-h`} className="cp-risks__h">
        Niveau par risque
      </h4>
      <ul className="cp-risks__list">
        {bars.map((bar) => (
          <RiskRow key={bar.axis} bar={bar} />
        ))}
      </ul>
      <p className="cp-sub">
        Pas de note globale : chaque axe a son niveau, tiré des signaux du moteur. Date : le jour
        concerné pour une prévision, le jour d’émission pour une alerte officielle.
      </p>
    </section>
  );
}

function RiskRow({ bar }: { bar: RiskAxisBar }) {
  return (
    <li className="cp-risk" data-level={bar.level}>
      {/* Une seule phrase pour un lecteur d'écran (nom, niveau, segments) ; le dessin et le mot sont décoratifs. */}
      <div className="cp-risk__top" role="img" aria-label={bar.summary}>
        <span className="cp-risk__name">{bar.label}</span>
        <span className="cp-gauge" data-level={bar.level} aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <i key={n} data-on={n <= bar.segments ? '1' : undefined} />
          ))}
        </span>
        <b className="cp-risk__lvl">
          {bar.levelText}
          {bar.inPart ? ' · en partie' : ''}
        </b>
      </div>
      {bar.sources.length > 0 ? (
        bar.sources.map((line) => (
          <p key={line} className="cp-risk__src">
            {line}
          </p>
        ))
      ) : bar.level === 'non_evalue' ? null : (
        <p className="cp-risk__src">Source : non précisée</p>
      )}
      {bar.note && <p className="cp-risk__note">{bar.note}</p>}
    </li>
  );
}
