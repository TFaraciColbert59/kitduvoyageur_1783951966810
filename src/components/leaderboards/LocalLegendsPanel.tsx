'use client';

import React from 'react';
import type { LocalLegendEntry, LocalLegendResult } from '@/features/leaderboards';
import type { LeaderboardSegmentView } from '@/lib/leaderboards/types';
import {
  formatDuration,
  formatEffortCount,
  formatShortDate,
  initialsFor,
} from '@/lib/leaderboards/format';

export interface LocalLegendsPanelProps {
  result: LocalLegendResult;
  segment?: LeaderboardSegmentView | null;
}

function LegendAvatar({ entry }: { entry: LocalLegendEntry }) {
  return (
    <span className="lkb-legend-avatar" aria-hidden="true">
      {initialsFor(entry.displayName)}
    </span>
  );
}

function hiddenReason(result: LocalLegendResult, segment?: LeaderboardSegmentView | null): string {
  if (segment?.isArchived) {
    return 'Ce segment est archivé : la mention Local Legend n’est plus publiée.';
  }
  if (segment?.isHazardous) {
    return 'Ce segment est signalé comme dangereux : aucun titre Local Legend n’est affiché.';
  }
  if (result.tiedLegends.length === 0) {
    return `Aucun voyageur n’atteint ${result.minEffortsForTitle} passages sur les ${result.windowDays} derniers jours.`;
  }
  return 'Les données nécessaires à la mention Local Legend ne sont pas disponibles.';
}

/**
 * Panneau S4.08. La mention n'est rendue que si le moteur l'autorise
 * (`shouldDisplayMention`) ; une égalité affiche tous les titulaires, jamais
 * un gagnant arbitraire.
 */
export function LocalLegendsPanel({ result, segment }: LocalLegendsPanelProps) {
  const topRankings = result.rankings.slice(0, 10);
  const viewerOutsideTop =
    result.viewerStanding &&
    !topRankings.some((entry) => entry.userId === result.viewerStanding?.userId)
      ? result.viewerStanding
      : null;

  return (
    <section className="lkb-legend" aria-labelledby="lkb-legend-title">
      <header className="lkb-legend-header">
        <div>
          <p className="lkb-eyebrow">S4.08 · Fenêtre glissante</p>
          <h2 id="lkb-legend-title" className="lkb-legend-title">
            Local Legend
          </h2>
        </div>
        <span className="lkb-legend-window">{result.windowDays} jours</span>
      </header>

      {!result.shouldDisplayMention ? (
        <div className="lkb-legend-hidden" role="status">
          <p className="lkb-legend-hidden-title">Mention non affichée</p>
          <p className="lkb-legend-hidden-text">{hiddenReason(result, segment)}</p>
        </div>
      ) : (
        <>
          <div className="lkb-legend-hero">
            <LegendAvatar entry={result.legend ?? result.tiedLegends[0]} />
            <div className="lkb-legend-hero-copy">
              <p className="lkb-legend-kicker">
                {result.tiedLegends.length > 1 ? 'Titre partagé' : 'Titulaire actuel'}
              </p>
              <p className="lkb-legend-name">
                {result.tiedLegends.length > 1
                  ? result.tiedLegends.map((entry) => entry.displayName).join(' · ')
                  : (result.legend ?? result.tiedLegends[0])?.displayName}
              </p>
              <p className="lkb-legend-meta">
                {formatEffortCount(
                  result.legend?.effortCount ?? result.tiedLegends[0]?.effortCount ?? 0
                )}
                {' · '}
                meilleur temps{' '}
                {formatDuration(
                  result.legend?.bestElapsedTimeS ?? result.tiedLegends[0]?.bestElapsedTimeS ?? 0
                )}
              </p>
            </div>
          </div>

          <p className="lkb-legend-rule">
            Seuil : {result.minEffortsForTitle} passages valides sur {result.windowDays} jours.
            {result.tiedLegends.length > 1
              ? ` ${result.tiedLegends.length} voyageurs sont ex æquo au rang 1.`
              : ''}
          </p>

          <ol className="lkb-legend-list" aria-label="Classement Local Legend">
            {topRankings.map((entry) => (
              <li
                key={entry.userId}
                className={
                  entry.isViewer ? 'lkb-legend-row lkb-legend-row-viewer' : 'lkb-legend-row'
                }
              >
                <span className="lkb-legend-rank">
                  {entry.rank}
                  {entry.isTied && <span aria-label="ex æquo">=</span>}
                </span>
                <LegendAvatar entry={entry} />
                <span className="lkb-legend-row-name">
                  {entry.displayName}
                  {entry.isViewer && <span className="lkb-you">Vous</span>}
                </span>
                <span className="lkb-legend-row-count">{formatEffortCount(entry.effortCount)}</span>
                <span className="lkb-legend-row-date">{formatShortDate(entry.lastEffortAt)}</span>
              </li>
            ))}
          </ol>

          {viewerOutsideTop && (
            <div className="lkb-viewer-card" aria-label="Votre position Local Legend">
              <span className="lkb-viewer-label">Votre position</span>
              <span className="lkb-viewer-rank">#{viewerOutsideTop.rank}</span>
              <span className="lkb-viewer-time">
                {formatEffortCount(viewerOutsideTop.effortCount)}
              </span>
              <span className="lkb-viewer-date">
                {formatShortDate(viewerOutsideTop.lastEffortAt)}
              </span>
            </div>
          )}
        </>
      )}
    </section>
  );
}
