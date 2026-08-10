'use client';

import React from 'react';

interface PreparationScoreProps {
  score: number;
  totalOk: number;
  totalNeeds: number;
  missingCount: number;
  partialCount: number;
}

export const PreparationScore: React.FC<PreparationScoreProps> = ({
  score,
  totalOk,
  totalNeeds,
  missingCount,
  partialCount,
}) => {
  const R = 26;
  const C = 2 * Math.PI * R;
  const off = C * (1 - score / 100);

  let title = <>Tu es <em>prêt</em> à partir.</>;
  if (score < 95) title = <>Presque <em>prêt</em>.</>;
  if (score < 85) title = <>Encore <em>quelques items</em>.</>;
  if (score < 70) title = <>Il te manque <em>l'essentiel</em>.</>;

  let subtitleText = `${totalOk}/${totalNeeds}`;
  if (missingCount > 0) {
    subtitleText += ` · ${missingCount} manquant${missingCount > 1 ? 's' : ''}`;
  }
  if (partialCount > 0) {
    subtitleText += ` · ${partialCount} insuffisant${partialCount > 1 ? 's' : ''}`;
  }

  return (
    <div className="score-panel">
      <div className="score-ring">
        <svg viewBox="0 0 62 62">
          <circle className="track" cx="31" cy="31" r={R} fill="none" strokeWidth="5" />
          <circle
            className="fill"
            cx="31"
            cy="31"
            r={R}
            fill="none"
            strokeWidth="5"
            strokeDasharray={C}
            strokeDashoffset={off}
          />
        </svg>
        <div className="num">
          {score}
          <span className="pct">%</span>
        </div>
      </div>
      <div className="txt">
        <div className="k">Score de préparation</div>
        <div className="h">{title}</div>
        <div className="s">{subtitleText}</div>
      </div>
    </div>
  );
};
