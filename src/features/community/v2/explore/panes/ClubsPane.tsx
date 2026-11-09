'use client';

import React from 'react';
import type { ClubCardVM, ClubFilter, ClubSort, GeoPermissionState, MemberStatus } from '../../shared/types';
import type { CursorFeedResult } from '../../data/useCursorFeed';
import { activityLabel } from '../../data/communityFeedMappers';
import { formatCountFr } from '../../shared/format';
import { ClubTileV2 } from '../tiles/ClubTileV2';
import { ExploreEmpty, ExploreError, ExploreGeoPrompt, ExploreListFoot, ExploreOfflineBanner, ExploreSkeleton } from '../ExploreStates';
import { usePaneNearBottom, usePaneScrollMemory } from '../usePaneScrollMemory';

export const CLUB_ACTIVITY_CHIPS: Array<{ value: string | null; label: string }> = [
  { value: null, label: 'Tous' },
  { value: 'rando', label: 'Rando' },
  { value: 'ski', label: 'Ski' },
  { value: 'velo', label: 'Vélo' },
  { value: 'escalade', label: 'Escalade' },
  { value: 'trail', label: 'Trail' },
];

export interface ClubsPaneProps {
  feed: CursorFeedResult<ClubCardVM>;
  filter: ClubFilter;
  sort: ClubSort;
  activity: string | null;
  nearState: GeoPermissionState;
  nearPointKnown: boolean;
  online: boolean;
  overrides: Record<string, MemberStatus>;
  busyClubId: string | null;
  onActivityChange: (activity: string | null) => void;
  onFilterChange: (filter: ClubFilter) => void;
  onRequestGeo: () => void;
  onOpen: (club: ClubCardVM, opener: HTMLElement) => void;
  onJoin: (club: ClubCardVM) => void;
  onPeek: (club: ClubCardVM, opener: HTMLElement) => void;
  onCreateClub: () => void;
}

/** Statut effectif d'un club : patch optimiste du parent d'abord, feed ensuite. */
export function effectiveClubStatus(
  club: ClubCardVM,
  overrides: Record<string, MemberStatus>,
): MemberStatus {
  return overrides[club.id] ?? club.myStatus;
}

export function effectiveClubMembers(club: ClubCardVM, status: MemberStatus): number {
  const wasMember = club.myStatus === 'member' || club.myStatus === 'admin';
  const isMember = status === 'member' || status === 'admin';
  if (!wasMember && isMember) return club.membersCount + 1;
  if (wasMember && !isMember) return Math.max(0, club.membersCount - 1);
  return club.membersCount;
}

/**
 * Volet Clubs (Clubs#1-6, 9, 12, 17-20) — chips d'activité en tête, club du
 * mois en pleine largeur puis grille, pilule d'adhésion de 44 px, détail
 * empilé (coque), tri en menu, états distincts.
 */
export function ClubsPane({
  feed,
  filter,
  activity,
  nearState,
  nearPointKnown,
  online,
  overrides,
  busyClubId,
  onActivityChange,
  onFilterChange,
  onRequestGeo,
  onOpen,
  onJoin,
  onPeek,
  onCreateClub,
}: ClubsPaneProps) {
  const scrollRef = usePaneScrollMemory<HTMLDivElement>(`cv2:explore:scroll:clubs:${filter}:${activity ?? 'all'}`);
  const nearBottomRef = usePaneNearBottom<HTMLDivElement>(
    feed.hasMore && !feed.loadingMore && !feed.loading,
    feed.loadMore,
  );

  const chips = (
    <div className="lkdv-cv2-chips lkdv-cv2x-club-chips" role="group" aria-label="Activité du club">
      {CLUB_ACTIVITY_CHIPS.map((chip) => (
        <button
          key={chip.value ?? 'all'}
          type="button"
          className="lkdv-cv2-chip"
          aria-pressed={activity === chip.value}
          onClick={() => onActivityChange(chip.value)}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );

  if (filter === 'near' && !nearPointKnown) {
    return (
      <div ref={scrollRef} className="lkdv-cv2x-pane">
        {chips}
        <ExploreGeoPrompt state={nearState} onRequest={onRequestGeo} />
      </div>
    );
  }

  if (feed.error && feed.items.length === 0) {
    return (
      <div ref={scrollRef} className="lkdv-cv2x-pane">
        {chips}
        <ExploreError title="Clubs indisponibles" onRetry={feed.refresh} />
      </div>
    );
  }

  if (feed.loading && feed.items.length === 0) {
    return (
      <div ref={scrollRef} className="lkdv-cv2x-pane">
        {chips}
        <ExploreSkeleton variant="tiles" />
      </div>
    );
  }

  if (!feed.loading && feed.items.length === 0) {
    if (filter === 'mine') {
      return (
        <div ref={scrollRef} className="lkdv-cv2x-pane">
          {chips}
          <ExploreEmpty
            icon="users"
            title="Aucun club pour l’instant"
            description="Rejoins un club près de chez toi ou crée le tien en quelques étapes."
          >
            <button type="button" className="lkdv-cv2-pill lkdv-cv2-pill--primary" onClick={onCreateClub}>
              Créer un club
            </button>
            <button
              type="button"
              className="lkdv-cv2-pill lkdv-cv2-pill--secondary"
              onClick={() => onFilterChange('discover')}
            >
              Explorer par activité
            </button>
          </ExploreEmpty>
        </div>
      );
    }
    if (activity) {
      return (
        <div ref={scrollRef} className="lkdv-cv2x-pane">
          {chips}
          <ExploreEmpty
            icon="users"
            title={`Aucun club en ${activityLabel(activity).toLowerCase()}`}
            description="Essaie une autre activité ou retire le filtre."
          >
            <button
              type="button"
              className="lkdv-cv2-pill lkdv-cv2-pill--secondary"
              onClick={() => onActivityChange(null)}
            >
              Toutes les activités
            </button>
          </ExploreEmpty>
        </div>
      );
    }
    return (
      <div ref={scrollRef} className="lkdv-cv2x-pane">
        {chips}
        <ExploreEmpty
          icon="users"
          title="Aucun club à découvrir"
          description="Les clubs se créent entre voyageurs : ouvre le tien et rassemble ta cordée."
        >
          <button type="button" className="lkdv-cv2-pill lkdv-cv2-pill--primary" onClick={onCreateClub}>
            Créer un club
          </button>
        </ExploreEmpty>
      </div>
    );
  }

  const featured = filter === 'discover' && !activity ? feed.items[0] : null;
  const gridItems = featured ? feed.items.slice(1) : feed.items;

  return (
    <div ref={scrollRef} className="lkdv-cv2x-pane">
      {!online ? <ExploreOfflineBanner /> : null}
      {chips}
      {featured ? (
        <div className="lkdv-cv2x-featured">
          <ClubTileV2
            club={featured}
            status={effectiveClubStatus(featured, overrides)}
            membersCount={effectiveClubMembers(featured, effectiveClubStatus(featured, overrides))}
            month
            busy={busyClubId === featured.id}
            onOpen={onOpen}
            onJoin={onJoin}
            onPeek={onPeek}
          />
        </div>
      ) : null}
      <div className="lkdv-cv2-grid lkdv-cv2x-club-grid">
        {gridItems.map((club) => {
          const status = effectiveClubStatus(club, overrides);
          return (
            <ClubTileV2
              key={club.id}
              club={club}
              status={status}
              membersCount={effectiveClubMembers(club, status)}
              busy={busyClubId === club.id}
              onOpen={onOpen}
              onJoin={onJoin}
              onPeek={onPeek}
            />
          );
        })}
      </div>
      <div ref={nearBottomRef}>
        <ExploreListFoot
          hasMore={feed.hasMore}
          loadingMore={feed.loadingMore}
          onLoadMore={feed.loadMore}
          total={feed.items.length}
          label={formatCountFr(feed.items.length, 'club')}
        />
      </div>
    </div>
  );
}

export default ClubsPane;
