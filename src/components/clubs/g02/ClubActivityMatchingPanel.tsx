'use client';

import React, { useMemo } from 'react';

import {
  detachActivityFromEvent,
  detectGroupActivities,
  type ActivityEventMatch,
  type ClubActivityInput,
  type GroupActivityCluster,
  type S619BlockRelation,
} from '@/features/clubs';
import { formatEventDate, formatEventTimeRange } from './model';
import styles from './g02.module.css';

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export interface ClubActivityMatchingPanelProps {
  activities?: readonly ClubActivityInput[];
  clusters?: readonly GroupActivityCluster[];
  matches: readonly ActivityEventMatch[];
  blocks?: readonly S619BlockRelation[];
  nowIso?: string;
  currentUserId: string | null;
  memberNames?: ReadonlyMap<string, string> | Record<string, string>;
  onDetachMatch?: (match: ActivityEventMatch) => Promise<void> | void;
  onOpenActivity?: (activityId: string) => void;
}

function nameOf(
  names: ReadonlyMap<string, string> | Record<string, string> | undefined,
  userId: string,
): string {
  if (!names) return userId.slice(0, 8);
  if (names instanceof Map) return names.get(userId) ?? userId.slice(0, 8);
  return (names as Record<string, string>)[userId] ?? userId.slice(0, 8);
}

/**
 * S5.17 / S5.18 — appariement activité ↔ sortie et détection des sorties
 * faites ensemble. Le composant peut recalculer les groupes depuis les
 * activités brutes (`detectGroupActivities`) ; il ne fabrique jamais un
 * groupe sans consentement P01 ni entre utilisateurs bloqués S6.19.
 */
export function ClubActivityMatchingPanel({
  activities = [],
  clusters,
  matches,
  blocks,
  nowIso = new Date().toISOString(),
  currentUserId,
  memberNames,
  onDetachMatch,
  onOpenActivity,
}: ClubActivityMatchingPanelProps) {
  const safeClusters = useMemo(
    () => clusters ?? detectGroupActivities({ activities, blocks }),
    [activities, blocks, clusters],
  );

  const detachable = useMemo(() => {
    const set = new Set<string>();
    for (const match of matches) {
      if (detachActivityFromEvent({ match, actorUserId: currentUserId ?? '', nowIso }).ok) {
        set.add(match.id);
      }
    }
    return set;
  }, [currentUserId, matches, nowIso]);

  return (
    <section className={styles.screen} aria-label="Activités groupées et appariement">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>Activités · S5.17 / S5.18</p>
          <h2 className={styles.title}>Sorties faites ensemble</h2>
          <p className={styles.subtitle}>
            Seules les activités non privées, avec consentement d’appariement, sont rapprochées. Deux
            personnes qui se bloquent ne sont jamais regroupées.
          </p>
        </div>
        <span className={styles.badge} aria-live="polite">
          {safeClusters.length} groupe{safeClusters.length > 1 ? 's' : ''}
        </span>
      </div>

      {safeClusters.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Aucune activité groupée détectée</p>
          <p className={styles.emptyHint}>
            Les sorties simultanées au même endroit apparaîtront ici après validation du consentement.
          </p>
        </div>
      ) : (
        <ul className={styles.list}>
          {safeClusters.map((cluster) => (
            <li key={cluster.id}>
              <article className={styles.card} aria-label={`Groupe ${cluster.sport}`}>
                <div className={styles.cardHeader}>
                  <div>
                    <div className={styles.wrap}>
                      <span className={styles.badge}>{cluster.sport}</span>
                      <span className={styles.badge}>{cluster.isIndoor ? 'En salle' : 'En extérieur'}</span>
                      <span className={styles.badge}>
                        {cluster.participantUserIds.length} participant
                        {cluster.participantUserIds.length > 1 ? 's' : ''}
                      </span>
                      <span className={styles.badge}>{cluster.activityIds.length} activités</span>
                    </div>
                    <p className={styles.cardMeta} style={{ marginTop: 6 }}>
                      {formatEventDate(cluster.startsAt)} ·{' '}
                      {formatEventTimeRange(cluster.startsAt, cluster.endsAt)}
                    </p>
                  </div>
                </div>
                <div className={styles.wrap}>
                  {cluster.participantUserIds.map((userId) => (
                    <span key={userId} className={styles.badge}>
                      {nameOf(memberNames, userId)}
                      {currentUserId === userId ? ' · vous' : ''}
                    </span>
                  ))}
                </div>
                <div className={styles.wrap}>
                  {cluster.activityIds.map((activityId) => (
                    <button
                      key={activityId}
                      type="button"
                      className={cx(styles.linkButton, styles.tiny)}
                      onClick={() => onOpenActivity?.(activityId)}
                      disabled={!onOpenActivity}
                    >
                      Activité {activityId.slice(0, 8)}
                    </button>
                  ))}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      <section className={styles.card} aria-label="Appariements aux sorties">
        <div className={styles.cardHeader}>
          <div>
            <h3 className={styles.cardTitle}>Activités rattachées aux sorties</h3>
            <p className={styles.cardMeta}>
              Un retrait manuel est définitif : l’activité ne sera plus ré-appariée automatiquement.
            </p>
          </div>
        </div>
        {matches.length === 0 ? (
          <p className={styles.notice}>Aucune activité rattachée à une sortie pour l’instant.</p>
        ) : (
          <ul className={styles.list}>
            {matches.map((match) => (
              <li key={match.id} className={styles.listItem}>
                <div className={styles.grow}>
                  <p className={styles.tiny} style={{ margin: 0, fontWeight: 700 }}>
                    Activité {match.activityId.slice(0, 8)} → sortie {match.eventId.slice(0, 8)}
                  </p>
                  <p className={styles.cardMeta}>
                    Confiance {Math.round(match.confidenceScore * 100)} % · {formatEventDate(match.matchedAt)}
                    {match.detachedAt ? ' · retirée' : ''}
                  </p>
                </div>
                {!match.detachedAt && detachable.has(match.id) ? (
                  <button
                    type="button"
                    className={cx(styles.button, styles.small)}
                    onClick={() => void onDetachMatch?.(match)}
                  >
                    Détacher
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

export default ClubActivityMatchingPanel;
