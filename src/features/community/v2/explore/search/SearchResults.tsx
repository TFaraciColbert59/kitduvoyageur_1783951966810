'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import type { SearchHitVM, SearchScope, TypeKind } from '../../shared/types';
import { formatDateStamp, formatKm, initialsFromName } from '../../shared/format';
import { SEARCH_KIND_LABELS, groupSearchHits } from '../../data/communityFeedMappers';
import { ClubCrest } from '../../shared/ClubCrest';
import { ExploreIcon } from '../ExploreIcons';
import { useLongPress } from '../useLongPress';
import { HighlightedText } from './HighlightedText';

interface MemberStats {
  posts: number;
  followers: number;
  following: number;
}

function useMemberStats(memberIds: string[]): Record<string, MemberStats> {
  const [stats, setStats] = useState<Record<string, MemberStats>>({});
  const key = memberIds.join(',');

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const ids = key.split(',').filter(Boolean);
    const supabase = createClient();

    void Promise.all([
      supabase.from('community_posts').select('author_id').in('author_id', ids),
      supabase.from('user_follows').select('following_id').in('following_id', ids),
      supabase.from('user_follows').select('follower_id').in('follower_id', ids),
    ])
      .then(([postsRes, followersRes, followingRes]) => {
        if (cancelled) return;
        const map: Record<string, MemberStats> = {};
        for (const id of ids) map[id] = { posts: 0, followers: 0, following: 0 };
        for (const row of postsRes.data ?? []) {
          const id = (row as { author_id?: string }).author_id;
          if (id && map[id]) map[id].posts += 1;
        }
        for (const row of followersRes.data ?? []) {
          const id = (row as { following_id?: string }).following_id;
          if (id && map[id]) map[id].followers += 1;
        }
        for (const row of followingRes.data ?? []) {
          const id = (row as { follower_id?: string }).follower_id;
          if (id && map[id]) map[id].following += 1;
        }
        setStats(map);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [key]);

  return stats;
}

/** Nombre de résultats affichés par groupe avant « Voir tout ». */
export const SEARCH_GROUP_PREVIEW = 3;

export function scopeToKind(scope: SearchScope): TypeKind | null {
  if (scope === 'posts') return 'post';
  if (scope === 'carnets') return 'carnet';
  if (scope === 'clubs') return 'club';
  if (scope === 'sorties') return 'sortie';
  if (scope === 'membres') return 'membre';
  return null;
}

/** Résultats réellement affichés (ordre des groupes), pour le clavier ↑ ↓. */
export function visibleSearchHits(results: ReadonlyArray<SearchHitVM>, scope: SearchScope): SearchHitVM[] {
  const kind = scopeToKind(scope);
  if (kind) return results.filter((hit) => hit.kind === kind);
  return groupSearchHits(results).flatMap((group) => group.items.slice(0, SEARCH_GROUP_PREVIEW));
}

function coverFor(hit: SearchHitVM): React.ReactNode {
  if (hit.kind === 'club') {
    return <ClubCrest name={hit.title} seed={hit.id} size={44} />;
  }
  if (hit.kind === 'sortie') {
    const stamp = formatDateStamp(hit.startsAt);
    return (
      <span className="lkdv-cv2x-search-stamp" aria-hidden="true">
        <b>{stamp.day}</b>
        <i>{stamp.month}</i>
      </span>
    );
  }
  if (hit.kind === 'membre') {
    return (
      <span className="lkdv-cv2x-search-avatar" aria-hidden="true">
        {hit.cover ? (
          <AppImage src={hit.cover} alt="" width={40} height={40} className="lkdv-cv2x-avatar-img" />
        ) : (
          initialsFromName(hit.title).slice(0, 1)
        )}
      </span>
    );
  }
  if (hit.kind === 'post') {
    return (
      <span className="lkdv-cv2x-search-post" aria-hidden="true">
        <ExploreIcon name="doc" size={18} />
      </span>
    );
  }
  return (
    <span className="lkdv-cv2x-search-cover" aria-hidden="true">
      {hit.cover ? (
        <AppImage src={hit.cover} alt="" width={52} height={52} className="lkdv-cv2x-cover-img" />
      ) : (
        <span className="lkdv-cv2x-cover-fallback" />
      )}
    </span>
  );
}

export interface SearchResultRowProps {
  hit: SearchHitVM;
  terms: ReadonlyArray<string>;
  /** Index dans la liste visible (navigation clavier). */
  index: number;
  active: boolean;
  rowId: string;
  memberStats?: MemberStats;
  onPeek?: (hit: SearchHitVM, opener: HTMLElement) => void;
}

/** Ligne de résultat : un seul lien, libellé complet, appui long → Peek. */
export function SearchResultRow({ hit, terms, index, active, rowId, memberStats, onPeek }: SearchResultRowProps) {
  const longPress = useLongPress({
    onLongPress: (element) => onPeek?.(hit, element),
    enabled: Boolean(onPeek),
  });
  const label = SEARCH_KIND_LABELS[hit.kind];
  const ariaLabel = [label.singular, hit.title, hit.subtitle, hit.distanceKm != null ? `à ${formatKm(hit.distanceKm)}` : '']
    .filter(Boolean)
    .join(' : ');

  if (hit.kind === 'membre') {
    const postsCount = memberStats ? memberStats.posts : '—';
    const followersCount = memberStats ? memberStats.followers : '—';
    const followingCount = memberStats ? memberStats.following : '—';
    const subtitleText = hit.subtitle
      ? hit.subtitle.startsWith('@') || hit.subtitle.includes('·')
        ? hit.subtitle
        : `@${hit.subtitle}`
      : '';

    return (
      <a
        id={rowId}
        className={`lkdv-carnet-card lkdv-cv2c-carnet-ig-editor lkdv-cv2x-carnet-ig-tile lkdv-cv2x-member-ig-tile${hit.cover ? ' has-cover-bg' : ''}${active ? ' is-kb' : ''}`}
        href={hit.href}
        aria-label={ariaLabel}
        data-testid={`cv2-tile-${hit.kind}`}
        data-type={hit.kind}
        data-id={hit.id}
        data-index={index}
        {...longPress}
      >
        {hit.cover ? (
          <span className="lkdv-cv2x-carnet-bg" aria-hidden="true">
            <AppImage src={hit.cover} alt="" fill sizes="320px" className="lkdv-cv2x-carnet-bg-img" />
            <span className="lkdv-cv2x-carnet-bg-scrim" />
          </span>
        ) : null}
        <span className="lkdv-carnet-card-scroll lkdv-cv2x-tile-link">
          <span className="lkdv-ig-header">
            <span className="lkdv-ig-avi-wrap">
              <span className="lkdv-ig-avi">
                {hit.cover ? (
                  <AppImage src={hit.cover} alt="" fill sizes="66px" className="lkdv-cv2x-cover-img" />
                ) : (
                  <span className="lkdv-cv2c-ig-avi-initials">
                    {initialsFromName(hit.title).slice(0, 1)}
                  </span>
                )}
              </span>
            </span>
            <span className="lkdv-ig-stats" role="group" aria-label="Statistiques du profil">
              <span className="lkdv-ig-stat">
                <b>{postsCount}</b>
                <span>publications</span>
              </span>
              <span className="lkdv-ig-stat">
                <b>{followersCount}</b>
                <span>followers</span>
              </span>
              <span className="lkdv-ig-stat">
                <b>{followingCount}</b>
                <span>suivi(e)s</span>
              </span>
            </span>
          </span>
          <span className="lkdv-ig-bio">
            <span className="lkdv-ig-name lkdv-cv2x-carnet-title">
              <HighlightedText text={hit.title} terms={terms} />
            </span>
            {subtitleText ? (
              <span className="lkdv-ig-handle-sub lkdv-cv2-meta">
                <HighlightedText text={subtitleText} terms={terms} />
              </span>
            ) : null}
          </span>
        </span>
        <span className="lkdv-cv2x-tile-foot">
          <span className="lkdv-cv2-meta">
            {hit.distanceKm != null ? `à ${formatKm(hit.distanceKm)}` : 'Voyageur'}
          </span>
          <span className="lkdv-cv2x-member-cta">Voir le profil</span>
        </span>
      </a>
    );
  }

  return (
    <a
      id={rowId}
      className={`lkdv-cv2-tile lkdv-cv2x-search-card${active ? ' is-kb' : ''}`}
      href={hit.href}
      aria-label={ariaLabel}
      data-testid={`cv2-tile-${hit.kind}`}
      data-type={hit.kind}
      data-id={hit.id}
      data-index={index}
      {...longPress}
    >
      <span className="lkdv-cv2x-search-card-top">
        <span className="lkdv-cv2x-search-media">{coverFor(hit)}</span>
        <span className="lkdv-cv2x-search-end">
          <span className="lkdv-cv2-type" data-type={hit.kind}>
            <i className="lkdv-cv2x-type-dot" aria-hidden="true" />
            {label.singular}
          </span>
          {hit.distanceKm != null ? (
            <span className="lkdv-cv2x-search-distance">{formatKm(hit.distanceKm)}</span>
          ) : null}
        </span>
      </span>
      <span className="lkdv-cv2x-search-body">
        <span className="lkdv-cv2x-search-title">
          <HighlightedText text={hit.title} terms={terms} />
        </span>
        {hit.subtitle ? (
          <span className="lkdv-cv2-meta">
            <HighlightedText text={hit.subtitle} terms={terms} />
          </span>
        ) : null}
        {hit.excerpt ? (
          <span className="lkdv-cv2x-search-excerpt">
            <HighlightedText text={hit.excerpt} terms={terms} />
          </span>
        ) : null}
      </span>
    </a>
  );
}

export interface SearchResultsProps {
  results: SearchHitVM[];
  terms: string[];
  scope: SearchScope;
  activeIndex: number;
  rowIdFor: (index: number) => string;
  onSeeAll: (kind: TypeKind) => void;
  onPeek?: (hit: SearchHitVM, opener: HTMLElement) => void;
}

/**
 * Résultats groupés (Recherche#6-8, 13) : en-tête eyebrow + compteur +
 * « Voir tout », terme surligné, un seul lien par ligne. En filtre de type, un
 * seul groupe avec tous les résultats.
 */
export function SearchResults({
  results,
  terms,
  scope,
  activeIndex,
  rowIdFor,
  onSeeAll,
  onPeek,
}: SearchResultsProps) {
  const memberIds = useMemo(
    () => results.filter((hit) => hit.kind === 'membre').map((hit) => hit.id),
    [results],
  );
  const memberStats = useMemberStats(memberIds);
  let cursor = 0;
  const kind = scopeToKind(scope);
  if (kind) {
    const items = results.filter((hit) => hit.kind === kind);
    return (
      <div className="lkdv-cv2-group" data-tone={kind}>
        <div className="lkdv-cv2-group-head">
          <span className="lkdv-cv2-eyebrow">
            {SEARCH_KIND_LABELS[kind].group}
            <b className="lkdv-cv2x-count">{items.length}</b>
          </span>
        </div>
        <div className="lkdv-cv2x-search-list">
          {items.map((hit) => {
            const index = cursor;
            cursor += 1;
            return (
              <SearchResultRow
                key={`${hit.kind}-${hit.id}`}
                hit={hit}
                terms={terms}
                index={index}
                active={activeIndex === index}
                rowId={rowIdFor(index)}
                memberStats={hit.kind === 'membre' ? memberStats[hit.id] : undefined}
                onPeek={onPeek}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      {groupSearchHits(results).map((group) => {
        const preview = group.items.slice(0, SEARCH_GROUP_PREVIEW);
        return (
          <div key={group.kind} className="lkdv-cv2-group">
            <div className="lkdv-cv2-group-head">
              <span className="lkdv-cv2-eyebrow">
                <i className="lkdv-cv2x-kind-dot" data-type={group.kind} aria-hidden="true" />
                {SEARCH_KIND_LABELS[group.kind].group}
                <b className="lkdv-cv2x-count">{group.items.length}</b>
              </span>
              {group.items.length > SEARCH_GROUP_PREVIEW ? (
                <button
                  type="button"
                  className="lkdv-cv2x-see-all"
                  onClick={() => onSeeAll(group.kind)}
                  aria-label={`Voir tout : ${SEARCH_KIND_LABELS[group.kind].group}, ${group.items.length} résultats`}
                >
                  Voir tout
                </button>
              ) : null}
            </div>
            <div className="lkdv-cv2x-search-list">
              {preview.map((hit) => {
                const index = cursor;
                cursor += 1;
                return (
                  <SearchResultRow
                    key={`${hit.kind}-${hit.id}`}
                    hit={hit}
                    terms={terms}
                    index={index}
                    active={activeIndex === index}
                    rowId={rowIdFor(index)}
                    memberStats={hit.kind === 'membre' ? memberStats[hit.id] : undefined}
                    onPeek={onPeek}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

export default SearchResults;
