'use client';

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { CommunityFeedShell } from '@/features/community/feed/CommunityFeedShell';
import { setCarnetLike } from '@/features/community/v2/data/communityMutations';
import {
  HUB_FILTERS,
  defaultHubFilter,
  filterHubItems,
} from '@/features/carnet/hub/filters';
import type {
  CarnetHubItem,
  CarnetsHubData,
  CarnetsHubFilter,
} from '@/features/carnet/hub/types';
import { CarnetCoverCard } from './CarnetCoverCard';
import { CarnetHubEmptyState } from './CarnetHubEmptyState';
import { CarnetHubLiveStrip } from './CarnetHubLiveStrip';

interface LikeOverride {
  liked: boolean;
  count: number;
}

export interface CarnetsHubScreenProps {
  /** Données lues côté serveur sous RLS (`loadCarnetsHub`). */
  data: CarnetsHubData;
  /**
   * Écriture du j'aime, injectable pour les tests ; par défaut `carnet_likes`
   * sous RLS (même mutation que la fiche et la tuile Communauté v2).
   */
  onToggleLike?: (carnetId: string, liked: boolean) => Promise<void>;
}

/**
 * Écran du hub `/carnets` (maquette écran 1). Tout est chargé côté serveur ;
 * ici, uniquement l'état local : filtre de la capsule (100 % client), j'aime
 * optimiste et bande « En route maintenant ».
 */
export function CarnetsHubScreen({ data, onToggleLike }: CarnetsHubScreenProps) {
  const router = useRouter();
  const { haptic } = useHapticFeedback();
  const [filter, setFilter] = useState<CarnetsHubFilter>(() => defaultHubFilter(data.items));
  const [likeOverrides, setLikeOverrides] = useState<Record<string, LikeOverride>>({});
  const [likeBusy, setLikeBusy] = useState<Record<string, boolean>>({});
  const [likeError, setLikeError] = useState<string | null>(null);

  // J'aime optimiste : la carte lit la surcharge locale tant que la page vit.
  const items = useMemo(
    () =>
      data.items.map((item) => {
        const override = likeOverrides[item.id];
        return override
          ? { ...item, likedByMe: override.liked, likesCount: override.count }
          : item;
      }),
    [data.items, likeOverrides],
  );

  const visibleItems = useMemo(() => filterHubItems(items, filter), [items, filter]);
  const liveItems = useMemo(() => items.filter((item) => item.phase === 'en_route'), [items]);

  const selectFilter = useCallback(
    (next: CarnetsHubFilter) => {
      haptic('selection');
      setFilter(next);
    },
    [haptic],
  );

  const handleLike = useCallback(
    async (item: CarnetHubItem) => {
      if (likeBusy[item.id]) return;
      if (!data.viewerId) {
        // J'aime = écriture authentifiée : on emmène vers la connexion.
        router.push('/connexion?next=/carnets');
        return;
      }
      haptic('light');
      const nextLiked = !item.likedByMe;
      const nextCount = Math.max(0, item.likesCount + (nextLiked ? 1 : -1));
      setLikeError(null);
      setLikeOverrides((previous) => ({
        ...previous,
        [item.id]: { liked: nextLiked, count: nextCount },
      }));
      setLikeBusy((previous) => ({ ...previous, [item.id]: true }));
      try {
        if (onToggleLike) {
          await onToggleLike(item.id, nextLiked);
        } else {
          const result = await setCarnetLike(item.id, nextLiked, data.viewerId);
          if (!result.ok) throw new Error(result.message);
        }
      } catch {
        // Retour à l'état serveur : jamais de compteur inventé.
        setLikeOverrides((previous) => {
          const next = { ...previous };
          delete next[item.id];
          return next;
        });
        setLikeError('Le j’aime n’a pas pu être enregistré. Réessaie.');
      } finally {
        setLikeBusy((previous) => {
          const next = { ...previous };
          delete next[item.id];
          return next;
        });
      }
    },
    [data.viewerId, haptic, likeBusy, onToggleLike, router],
  );

  const retry = useCallback(() => {
    router.refresh();
  }, [router]);

  const header = (
    <div className="lkdh-header">
      <div className="lkdh-header-row">
        <span className="lkdh-eyebrow">Carnets de bord</span>
        <Link className="lkdh-cta" href="/communaute?creer=carnet">
          <Icon name="plus" size={15} aria-hidden="true" />
          <span>Créer un carnet</span>
        </Link>
      </div>
      <h1 className="lkdh-title">
        Des aventures <em>en route</em>, des récits de retour.
      </h1>
    </div>
  );

  if (data.error) {
    return (
      <CommunityFeedShell topBar={header}>
        <div className="lkdh-body">
          <section className="lkdh-error" role="alert">
            <h2>Les carnets n’ont pas pu être chargés</h2>
            <p>
              La lecture des carnets a échoué. Vérifie ta connexion, puis réessaie.
            </p>
            <div className="lkdh-empty-actions">
              <button type="button" className="lkdh-empty-btn" onClick={retry}>
                Réessayer
              </button>
            </div>
          </section>
        </div>
      </CommunityFeedShell>
    );
  }

  return (
    <CommunityFeedShell topBar={header}>
      <div className="lkdh-body">
        <div className="lkdh-filters" role="group" aria-label="Filtrer les carnets">
          {HUB_FILTERS.map((definition) => (
            <button
              key={definition.id}
              type="button"
              className="lkdh-filter"
              aria-pressed={filter === definition.id}
              onClick={() => selectFilter(definition.id)}
              data-testid={`lkdh-filter-${definition.id}`}
            >
              {definition.label}
            </button>
          ))}
        </div>

        {liveItems.length > 0 ? <CarnetHubLiveStrip items={liveItems} /> : null}

        {visibleItems.length === 0 ? (
          <CarnetHubEmptyState filter={filter} onExplore={() => selectFilter('world')} />
        ) : (
          <ul className="lkdh-list">
            {visibleItems.map((item) => (
              <CarnetCoverCard
                key={item.id}
                item={item}
                likeBusy={Boolean(likeBusy[item.id])}
                onLike={handleLike}
              />
            ))}
          </ul>
        )}

        {likeError ? (
          <p className="lkdh-like-status" role="status" aria-live="polite">
            {likeError}
          </p>
        ) : null}
      </div>
    </CommunityFeedShell>
  );
}

export default CarnetsHubScreen;
