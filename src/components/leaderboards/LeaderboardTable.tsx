'use client';

import React from 'react';
import type { LeaderboardSport, SanitizedLeaderboardEntry } from '@/features/leaderboards';
import AppImage from '@/components/ui/AppImage';
import {
  formatCompactDuration,
  formatShortDate,
  formatSpeed,
  initialsFor,
  sportLabel,
  TITLE_LABELS,
} from '@/lib/leaderboards/format';

export interface LeaderboardTableProps {
  entries: ReadonlyArray<SanitizedLeaderboardEntry>;
  viewerEntry?: SanitizedLeaderboardEntry | null;
  sport: LeaderboardSport;
  emptyLabel?: string;
}

function EntryAvatar({ entry }: { entry: SanitizedLeaderboardEntry }) {
  if (entry.avatarUrl) {
    return (
      <AppImage
        src={entry.avatarUrl}
        alt=""
        width={40}
        height={40}
        className="lkb-avatar"
        unoptimized
      />
    );
  }
  return (
    <span className="lkb-avatar lkb-avatar-fallback" aria-hidden="true">
      {initialsFor(entry.displayName)}
    </span>
  );
}

function EntryRow({ entry }: { entry: SanitizedLeaderboardEntry }) {
  return (
    <tr className={entry.isViewer ? 'lkb-row lkb-row-viewer' : 'lkb-row'}>
      <td className="lkb-rank">
        <span className="lkb-rank-number">{entry.rank}</span>
        {entry.isTied && (
          <span className="lkb-tie" aria-label="ex æquo">
            =
          </span>
        )}
      </td>
      <td className="lkb-athlete">
        <EntryAvatar entry={entry} />
        <span className="lkb-athlete-name">
          <span>{entry.displayName}</span>
          {entry.isViewer && <span className="lkb-you">Vous</span>}
          {entry.title && (
            <span
              className={`lkb-title-badge lkb-title-${entry.title.toLocaleLowerCase('en-US')}`}
              title={TITLE_LABELS[entry.title]}
            >
              {entry.title}
            </span>
          )}
        </span>
      </td>
      <td className="lkb-time">{formatCompactDuration(entry.elapsedTimeS)}</td>
      <td className="lkb-secondary">{formatSpeed(entry.averageSpeedKmh)}</td>
      <td className="lkb-secondary lkb-date">{formatShortDate(entry.achievedAt)}</td>
    </tr>
  );
}

/**
 * Tableau de classement S4.05 : rang stable, égalités explicites, titres
 * KOM/QOM/CR et ligne « Vous » repérable sans dépendre de la couleur.
 */
export function LeaderboardTable({
  entries,
  viewerEntry = null,
  sport,
  emptyLabel = 'Aucun passage classé pour ces filtres.',
}: LeaderboardTableProps) {
  const viewerIsPaged = Boolean(
    viewerEntry && entries.some((entry) => entry.userId === viewerEntry.userId)
  );

  return (
    <div className="lkb-table-block">
      <div className="lkb-table-wrap">
        <table className="lkb-table">
          <caption className="lkb-sr-only">
            Classement du segment, {sportLabel(sport)}. Les rangs identiques sont ex æquo.
          </caption>
          <thead>
            <tr>
              <th scope="col">Rang</th>
              <th scope="col">Voyageur</th>
              <th scope="col">Temps</th>
              <th scope="col" className="lkb-secondary">
                Vitesse
              </th>
              <th scope="col" className="lkb-secondary lkb-date">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="lkb-empty">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              entries.map((entry) => <EntryRow key={entry.effortId} entry={entry} />)
            )}
          </tbody>
        </table>
      </div>

      {viewerEntry && !viewerIsPaged && (
        <div className="lkb-viewer-card" aria-label="Votre position au classement">
          <span className="lkb-viewer-label">Votre position</span>
          <span className="lkb-viewer-rank">#{viewerEntry.rank}</span>
          <span className="lkb-viewer-time">{formatCompactDuration(viewerEntry.elapsedTimeS)}</span>
          <span className="lkb-viewer-date">{formatShortDate(viewerEntry.achievedAt)}</span>
        </div>
      )}
    </div>
  );
}
