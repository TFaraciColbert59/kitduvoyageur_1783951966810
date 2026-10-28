'use client';

import React from 'react';
import { finiteCountOrNull, finiteNumber, formatCommunityDate } from './communityFormat';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

export interface Challenge {
  id: string;
  title: string;
  category?: string | null;
  difficulty?: string | null;
  xp?: number | null;
  deadline?: string | null;
  progress?: number | null;
  target?: number | null;
  completed?: boolean | null;
  active?: boolean | null;
}

export interface ChallengeRowProps {
  challenge: Challenge;
  /** Rendu dans la section repliée « Terminés ». */
  completed?: boolean;
}

/**
 * Carte défi (84 px) : titre, catégorie, difficulté, XP, progression et
 * échéance. Aucune valeur n'est inventée : une cible absente n'affiche ni
 * barre ni « / 0 ».
 */
export function ChallengeRow({ challenge, completed = false }: ChallengeRowProps) {
  const xp = finiteNumber(challenge.xp, 0);
  const progress = Math.max(0, finiteNumber(challenge.progress, 0));
  const targetValue = finiteCountOrNull(challenge.target);
  const target = targetValue !== null && targetValue > 0 ? targetValue : null;
  const percent = target ? Math.min(100, Math.round((progress / target) * 100)) : null;
  const deadline = formatCommunityDate(challenge.deadline);
  const category = challenge.category?.trim();
  const difficulty = challenge.difficulty?.trim();

  return (
    <li className="lkdv-challenge" data-completed={completed ? 'true' : 'false'}>
      <div className="lkdv-challenge-head">
        <h4 className="lkdv-challenge-title">
          {completed ? (
            <span className="lkdv-challenge-check" aria-hidden="true">
              <LKDVIcon name="valider" size="1em" className="lkdv-icon-inline" /></span>
          ) : null}
          {challenge.title}
        </h4>
        <span className="lkdv-challenge-count">{target ? `${progress} / ${target}` : progress}</span>
      </div>

      {category || difficulty || xp > 0 ? (
        <div className="lkdv-challenge-meta">
          {category ? <span>{category}</span> : null}
          {difficulty ? <span className="lkdv-challenge-diff">{difficulty}</span> : null}
          {xp > 0 ? <span className="lkdv-challenge-xp">+{xp} XP</span> : null}
        </div>
      ) : null}

      {target ? (
        <div
          className="lkdv-challenge-bar"
          role="progressbar"
          aria-label={`Progression : ${challenge.title}`}
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={Math.min(progress, target)}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
      ) : null}

      {deadline ? <p className="lkdv-challenge-deadline">Échéance : {deadline}</p> : null}
    </li>
  );
}

export default ChallengeRow;
