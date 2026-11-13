import React from 'react';
import type { SportRecordChip, SportStat } from '@/features/community/g01/sportStats';
import styles from './g01.module.css';

export interface SportStatsRowProps {
  stats: readonly SportStat[];
  records?: readonly SportRecordChip[];
  /** Titre accessible du groupe de chiffres. */
  ariaLabel?: string;
}

/**
 * Chiffres clés d'une sortie. Le composant ne calcule rien : il reçoit les
 * statistiques déjà sélectionnées par `selectSportStats`, donc adaptées au
 * sport et exemptes de trace brute.
 */
export function SportStatsRow({
  stats,
  records = [],
  ariaLabel = 'Statistiques de la sortie',
}: SportStatsRowProps) {
  if (stats.length === 0 && records.length === 0) return null;
  return (
    <div>
      {stats.length > 0 ? (
        <dl className={styles.stats} aria-label={ariaLabel}>
          {stats.map((stat) => (
            <div key={stat.key} className={styles.stat}>
              <dt className={styles.statLabel}>{stat.label}</dt>
              <dd className={styles.statValue}>
                {stat.formatted}
                {stat.unit ? <span className={styles.statUnit}>{stat.unit}</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {records.length > 0 ? (
        <ul className={styles.records} aria-label="Records personnels">
          {records.map((record) => (
            <li key={record.id} className={styles.recordChip}>
              {record.label} · {record.formatted}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default SportStatsRow;
