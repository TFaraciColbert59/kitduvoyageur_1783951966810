'use client';

import React from 'react';

import type { ChallengeMetric, WeeklyClubLeaderboard, WeeklyClubLeaderboardEntry } from '@/features/clubs';
import {
  formatDayMonth,
  formatDistance,
  formatDuration,
  formatElevation,
  leaderboardPodium,
  METRIC_LABELS,
} from './model';
import { ClubAvatar } from './ClubIdentity';
import styles from './g02.module.css';

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

const METRICS: ChallengeMetric[] = ['distance_m', 'duration_s', 'elevation_gain_m', 'activities_count'];

function metricValue(entry: WeeklyClubLeaderboardEntry, metric: ChallengeMetric): string {
  switch (metric) {
    case 'distance_m':
      return formatDistance(entry.totalDistanceM);
    case 'duration_s':
      return formatDuration(entry.totalDurationS);
    case 'elevation_gain_m':
      return formatElevation(entry.totalElevationGainM);
    case 'activities_count':
      return `${entry.activitiesCount}`;
  }
}

export interface ClubLeaderboardProps {
  leaderboard: WeeklyClubLeaderboard;
  sports?: readonly string[];
  loading?: boolean;
  error?: string | null;
  onMetricChange?: (metric: ChallengeMetric) => void;
  onSportChange?: (sport: string | null) => void;
  onRetry?: () => void;
}

/**
 * S5.11 — classement hebdomadaire du club.
 *
 * Le classement est calculé côté serveur par `buildWeeklyClubLeaderboard`
 * (opt-out P01, blocages S6.19, activités privées exclus). L’écran se contente
 * d’afficher `excludedCount` : il ne révèle jamais l’identité des exclus.
 */
export function ClubLeaderboard({
  leaderboard,
  sports = [],
  loading = false,
  error = null,
  onMetricChange,
  onSportChange,
  onRetry,
}: ClubLeaderboardProps) {
  const podium = leaderboardPodium(leaderboard.entries);

  if (loading) {
    return (
      <section className={styles.screen} aria-busy="true" aria-label="Chargement du classement">
        <div className={styles.skeleton} />
        <div className={styles.skeleton} />
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.screen}>
        <div className={styles.alert} role="alert">
          <span aria-hidden="true">⚠</span>
          <div className={styles.grow}>
            <strong>Le classement n’a pas pu être chargé.</strong>
            <p className={styles.tiny}>{error}</p>
            {onRetry ? (
              <button type="button" className={cx(styles.button, styles.small)} onClick={onRetry}>
                Réessayer
              </button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.screen} aria-label="Classement hebdomadaire du club">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>Classement · S5.11</p>
          <h2 className={styles.title}>La semaine du club</h2>
          <p className={styles.subtitle}>
            Du {formatDayMonth(leaderboard.weekStartIso)} au {formatDayMonth(leaderboard.weekEndIso)}. Les
            membres qui refusent le classement ne sont jamais comptés.
          </p>
        </div>
        <span className={styles.badge} aria-live="polite">
          {leaderboard.entries.length} classé{leaderboard.entries.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className={styles.card}>
        <div className={styles.filters}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="g02-lb-metric">
              Métrique
            </label>
            <select
              id="g02-lb-metric"
              className={styles.select}
              value={leaderboard.metric}
              onChange={(event) => onMetricChange?.(event.target.value as ChallengeMetric)}
            >
              {METRICS.map((metric) => (
                <option key={metric} value={metric}>
                  {METRIC_LABELS[metric]}
                </option>
              ))}
            </select>
          </div>
          {sports.length > 0 ? (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="g02-lb-sport">
                Sport
              </label>
              <select
                id="g02-lb-sport"
                className={styles.select}
                value={leaderboard.sport ?? ''}
                onChange={(event) => onSportChange?.(event.target.value || null)}
              >
                <option value="">Tous les sports</option>
                {sports.map((sport) => (
                  <option key={sport} value={sport}>
                    {sport}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        {leaderboard.excludedCount > 0 ? (
          <p className={styles.notice}>
            {leaderboard.excludedCount} membre{leaderboard.excludedCount > 1 ? 's' : ''} masqué
            {leaderboard.excludedCount > 1 ? 's' : ''} par leurs préférences de confidentialité ou un
            blocage. Aucun nom n’est révélé.
          </p>
        ) : null}
      </div>

      {leaderboard.entries.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Pas encore de classement cette semaine</p>
          <p className={styles.emptyHint}>
            Les activités partagées et consenties apparaîtront ici dès la première sortie.
          </p>
        </div>
      ) : (
        <>
          {podium.length > 0 ? (
            <div className={styles.podium} aria-label="Podium">
              {podium.map((entry) => (
                <div key={entry.userId} className={styles.podiumStep} data-place={entry.rank}>
                  <span className={styles.podiumRank}>{entry.rank}</span>
                  <ClubAvatar name={entry.displayName} avatarUrl={entry.avatarUrl} small />
                  <span className={styles.tiny} style={{ fontWeight: 700 }}>
                    {entry.displayName}
                    {entry.isCurrentUser ? ' · vous' : ''}
                  </span>
                  <span className={styles.tiny}>{metricValue(entry, leaderboard.metric)}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className={styles.card}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption className={styles.srOnly}>
                  Classement hebdomadaire par {METRIC_LABELS[leaderboard.metric].toLowerCase()}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Rang</th>
                    <th scope="col">Membre</th>
                    <th scope="col" className={styles.num}>
                      {METRIC_LABELS[leaderboard.metric]}
                    </th>
                    <th scope="col" className={styles.num}>
                      Sorties
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.entries.map((entry) => (
                    <tr key={entry.userId} data-current={entry.isCurrentUser}>
                      <td>{entry.rank}</td>
                      <th scope="row" style={{ textAlign: 'left', fontWeight: 600 }}>
                        <span className={styles.row}>
                          <ClubAvatar name={entry.displayName} avatarUrl={entry.avatarUrl} small />
                          <span>
                            {entry.displayName}
                            {entry.isCurrentUser ? <span className={styles.muted}> · vous</span> : null}
                          </span>
                        </span>
                      </th>
                      <td className={styles.num}>{metricValue(entry, leaderboard.metric)}</td>
                      <td className={styles.num}>{entry.activitiesCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.grid}>
            <div className={styles.metric}>
              <span className={styles.metricValue}>{formatDistance(leaderboard.entries.reduce((sum, entry) => sum + entry.totalDistanceM, 0))}</span>
              <span className={styles.metricLabel}>Distance cumulée</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricValue}>{formatDuration(leaderboard.entries.reduce((sum, entry) => sum + entry.totalDurationS, 0))}</span>
              <span className={styles.metricLabel}>Temps cumulé</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricValue}>{formatElevation(leaderboard.entries.reduce((sum, entry) => sum + entry.totalElevationGainM, 0))}</span>
              <span className={styles.metricLabel}>Dénivelé cumulé</span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default ClubLeaderboard;
