'use client';

import React, { useMemo } from 'react';
import Icon from '@/components/ui/Icon';
import SmartImage from '@/components/ui/SmartImage';
import { EmptyState } from '@/components/ui';
import { isCommunityVideoUrl, usableCommunityMedia } from '@/lib/community/media';
import type { CommunityMobileTab } from '@/components/communaute/MobileCommunityHub';

export type CommunityGridKind = 'post' | 'carnet' | 'club' | 'group' | 'event';

export interface CommunityGridItem {
  key: string;
  kind: CommunityGridKind;
  id: string;
  title: string;
  subtitle?: string;
  image?: string | null;
  video?: boolean;
  date?: string | null;
  raw: any;
}

export interface CommunityGridProps {
  posts: any[];
  carnets: any[];
  clubs: any[];
  groups: any[];
  events: any[];
  activeTab: CommunityMobileTab;
  onOpen: (item: CommunityGridItem) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onDiscover?: () => void;
}

const KIND_ICON: Record<CommunityGridKind, string> = {
  post: 'image-plus',
  carnet: 'book-open',
  club: 'users',
  group: 'map',
  event: 'calendar',
};

const KIND_LABEL: Record<CommunityGridKind, string> = {
  post: 'Publication',
  carnet: 'Carnet',
  club: 'Club',
  group: 'Expédition',
  event: 'Sortie',
};

function asDate(value: unknown): number {
  if (!value) return 0;
  const time = new Date(String(value)).getTime();
  return Number.isFinite(time) ? time : 0;
}

function excerpt(value: unknown, max = 70): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Grille de contenus de la Communauté — mêmes tuiles que le Compte
 * (3 colonnes, `aspect-ratio: 1/1.05`, rayon 9, badge verre en haut à droite).
 *
 * Chaque tuile ouvre un drawer ; aucune section ne navigue vers une page.
 */
export function CommunityGrid({
  posts = [],
  carnets = [],
  clubs = [],
  groups = [],
  events = [],
  activeTab,
  onOpen,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
  onDiscover,
}: CommunityGridProps) {
  const items = useMemo(() => {
    const postItems: CommunityGridItem[] = posts.map((post) => {
      const media = usableCommunityMedia(post.media_urls, post.image_url)[0] ?? null;
      return {
        key: `post:${post.id}`,
        kind: 'post',
        id: String(post.id),
        title: excerpt(post.content || 'Publication'),
        subtitle: post.author?.full_name || 'Voyageur',
        image: media,
        video: Boolean(media && isCommunityVideoUrl(media)),
        date: post.created_at,
        raw: post,
      };
    });

    const carnetItems: CommunityGridItem[] = carnets.map((carnet) => ({
      key: `carnet:${carnet.id}`,
      kind: 'carnet',
      id: String(carnet.id),
      title: carnet.title || 'Carnet de voyage',
      subtitle: carnet.destination || carnet.author?.full_name,
      image: carnet.cover_image || null,
      date: carnet.created_at,
      raw: carnet,
    }));

    const clubItems: CommunityGridItem[] = clubs.map((club) => ({
      key: `club:${club.id}`,
      kind: 'club',
      id: String(club.id),
      title: club.name || club.title || 'Club',
      subtitle: club.category || `${club.members_count ?? 0} membres`,
      image: club.cover_image || club.coverImage || null,
      date: club.created_at,
      raw: club,
    }));

    const groupItems: CommunityGridItem[] = groups.map((group) => ({
      key: `group:${group.id}`,
      kind: 'group',
      id: String(group.id),
      title: group.name || 'Expédition',
      subtitle: group.massif || group.destination,
      image: group.cover_url || null,
      date: group.created_at,
      raw: group,
    }));

    const eventItems: CommunityGridItem[] = events.map((event) => ({
      key: `event:${event.id}`,
      kind: 'event',
      id: String(event.id),
      title: event.title || 'Sortie',
      subtitle: [event.date, event.location].filter(Boolean).join(' · '),
      image: event.cover_url || event.image_url || null,
      date: event.event_date || event.date,
      raw: event,
    }));

    const visual = [...postItems, ...carnetItems, ...clubItems, ...groupItems]
      .filter((item) => Boolean(item.image))
      .sort((a, b) => asDate(b.date) - asDate(a.date));
    const textual = [...postItems, ...carnetItems, ...clubItems, ...groupItems]
      .filter((item) => !item.image)
      .sort((a, b) => asDate(b.date) - asDate(a.date))
      .slice(0, 6);

    const byTab: Record<string, CommunityGridItem[]> = {
      // Les sorties ont leur propre filtre : elles ne saturent pas « Tout ».
      fil: [...visual, ...textual].slice(0, 30),
      carnets: carnetItems.sort((a, b) => asDate(b.date) - asDate(a.date)),
      clubs: clubItems.sort((a, b) => asDate(b.date) - asDate(a.date)),
      groupes: groupItems.sort((a, b) => asDate(b.date) - asDate(a.date)),
      evenements: eventItems.sort((a, b) => asDate(a.date) - asDate(b.date)),
      entraide: [],
    };

    return byTab[activeTab] ?? byTab.fil;
  }, [posts, carnets, clubs, groups, events, activeTab]);

  if (activeTab === 'entraide') {
    return (
      <div className="lkdv-community-grid-empty">
        <EmptyState
          compact
          icon={<span className="text-3xl">💡</span>}
          title="Entraide & conditions de sentier"
          description="Posez vos questions sur le débit des sources, l’enneigement des cols et les refuges non gardés."
          actionLabel="Ouvrir l’entraide"
          actionHref="/entraide"
        />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="lkdv-community-grid-empty">
        <EmptyState
          compact
          icon={<span className="text-3xl">🌲</span>}
          title="Rien à afficher pour le moment"
          description="Les publications, carnets, clubs et sorties apparaîtront ici."
          actionLabel={onDiscover ? 'Découvrir' : undefined}
          actionHref={onDiscover ? '/communaute/decouvrir' : undefined}
        />
      </div>
    );
  }

  return (
    <div className="lkdv-community-grid-wrap">
      <div className="lkdv-community-grid" role="list" aria-label="Contenus de la communauté">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            role="listitem"
            className={
              item.image
                ? 'lkdv-community-tile'
                : 'lkdv-community-tile lkdv-community-tile--fallback'
            }
            onClick={() => onOpen(item)}
            aria-label={`Ouvrir ${KIND_LABEL[item.kind].toLowerCase()} : ${item.title}`}
          >
            {item.image ? (
              <SmartImage src={item.image} alt="" className="lkdv-community-tile-media" />
            ) : (
              <span className="lkdv-community-tile-fallback" aria-hidden="true">
                <Icon name={KIND_ICON[item.kind]} size={22} />
                <b>{item.title}</b>
                {item.subtitle ? <small>{item.subtitle}</small> : null}
              </span>
            )}

            <span className="lkdv-community-tile-badge" aria-hidden="true">
              <Icon name={KIND_ICON[item.kind]} size={12} />
            </span>

            {item.video ? (
              <span className="lkdv-community-tile-play" aria-hidden="true">
                ▶
              </span>
            ) : null}

            {item.image ? (
              <span className="lkdv-community-tile-caption" aria-hidden="true">
                <b>{item.title}</b>
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {activeTab === 'fil' && hasMore && onLoadMore ? (
        <div className="lkdv-community-grid-more">
          <button type="button" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Chargement…' : 'Charger plus de contenus'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default CommunityGrid;
