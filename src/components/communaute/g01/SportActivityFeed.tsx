'use client';

import React from 'react';
import type { SportActivityCardVM } from '@/features/community/g01/activityProjection';
import { applyFeedPreferences } from '@/features/community/g01/feedPreferences';
import type { SportActivityCardVideo } from './SportActivityCard';
import { SportActivityCard } from './SportActivityCard';
import styles from './g01.module.css';

export interface SportActivityFeedProps {
  items: readonly SportActivityCardVM[];
  preferences: unknown;
  videoForItem?: (item: SportActivityCardVM) => SportActivityCardVideo | null;
  onOpen?: (item: SportActivityCardVM) => void;
  onLike?: (item: SportActivityCardVM) => void;
  onComment?: (item: SportActivityCardVM) => void;
  onShare?: (item: SportActivityCardVM) => void;
  onReport?: (item: SportActivityCardVM) => void;
  onOpenPreferences?: () => void;
}

/**
 * Liste de cartes sportives. Le filtrage intervient APRÈS la projection
 * autorisée : une carte refusée n'arrive jamais ici, et les préférences ne
 * peuvent que réduire ce qui est déjà visible.
 */
export function SportActivityFeed({
  items,
  preferences,
  videoForItem,
  onOpen,
  onLike,
  onComment,
  onShare,
  onReport,
  onOpenPreferences,
}: SportActivityFeedProps) {
  const filtered = React.useMemo(
    () =>
      applyFeedPreferences(
        items.map((item) => ({
          id: item.id,
          authorId: item.author.id,
          sport: item.sport,
          audienceAllowed: item.canShare,
          item,
        })),
        preferences
      ),
    [items, preferences]
  );

  if (filtered.visible.length === 0) {
    return (
      <div className={styles.empty} role="status">
        <p className={styles.emptyTitle}>
          {filtered.hidden > 0 ? 'Aucune sortie ne passe tes préférences' : 'Aucune sortie partagée'}
        </p>
        <p className={styles.emptyHint}>
          {filtered.hidden > 0
            ? `${filtered.hidden} publication${filtered.hidden > 1 ? 's' : ''} masquée${
                filtered.hidden > 1 ? 's' : ''
              } par tes choix de fil.`
            : 'Les sorties partagées par les sportifs que tu suis apparaîtront ici.'}
        </p>
        {filtered.hidden > 0 && onOpenPreferences ? (
          <button type="button" className={styles.openLink} onClick={onOpenPreferences}>
            Régler le fil
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.drawer} aria-label="Fil des activités sportives">
      {filtered.visible.map(({ item }) => (
        <SportActivityCard
          key={item.id}
          item={item}
          video={videoForItem?.(item) ?? null}
          onOpen={onOpen}
          onLike={onLike}
          onComment={onComment}
          onShare={onShare}
          onReport={onReport}
        />
      ))}
    </div>
  );
}

export default SportActivityFeed;
