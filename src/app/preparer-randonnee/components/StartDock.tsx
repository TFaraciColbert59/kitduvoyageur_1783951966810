'use client';

import React from 'react';
import { Icon } from './PreparationIcons';

interface StartDockProps {
  score: number;
  totalOk: number;
  totalNeeds: number;
  missingCount: number;
  anyEssentialMissing: boolean;
  onStart: () => void;
}

export const StartDock: React.FC<StartDockProps> = ({
  score,
  totalOk,
  totalNeeds,
  missingCount,
  anyEssentialMissing,
  onStart,
}) => {
  let statusText = 'Tout est prêt';
  if (anyEssentialMissing) statusText = 'Essentiels manquants';
  else if (missingCount > 0) statusText = `${missingCount} à compléter`;

  const dotClass = anyEssentialMissing ? 'miss' : missingCount > 0 ? 'warn' : '';

  return (
    <div className="dock">
      <div className="mini-status">
        <div className="l">
          <span className={`dot ${dotClass}`}></span>
          {statusText}
        </div>
        <div>
          {score}% · {totalOk}/{totalNeeds}
        </div>
      </div>
      <button className="cta" onClick={onStart}>
        <Icon name="gps" /> Démarrer la <em>randonnée</em>
        <span className="arrow">
          <Icon name="arrow" />
        </span>
      </button>
      {anyEssentialMissing ? (
        <div className="sec">
          Complète les essentiels pour <em>partir</em>
        </div>
      ) : missingCount > 0 ? (
        <div className="sec">Partir quand même — j'ajusterai en route</div>
      ) : null}
    </div>
  );
};
