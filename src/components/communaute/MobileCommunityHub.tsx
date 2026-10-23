'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { Button, Card, EmptyState, Skeleton, Spinner } from '@/components/ui';
import { CapsuleTabs } from '@/components/ui/CapsuleTabs';
import { OfflineBanner } from '@/features/adventure-intelligence/ui/OfflineBanner';
import { CommunityGrid, type CommunityGridItem } from '@/components/communaute/CommunityGrid';
import { CommunityContentDrawer } from '@/components/communaute/CommunityContentDrawer';
import { isCommunityVideoUrl, usableCommunityMedia } from '@/lib/community/media';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

export type CommunityMobileTab = 'fil' | 'carnets' | 'clubs' | 'groupes' | 'evenements' | 'entraide';

interface CommunityPostItemLike {
  id: string;
  content?: string;
  image_url?: string | null;
  media_urls?: string[] | null;
  author?: { full_name?: string };
  created_at?: string;
  [key: string]: unknown;
}

interface MobileCommunityHubProps {
  posts: CommunityPostItemLike[];
  carnets?: any[];
  clubs?: any[];
  groups?: any[];
  events?: any[];
  activeTab?: CommunityMobileTab;
  onTabChange?: (tab: CommunityMobileTab) => void;
  loading?: boolean;
  user?: any;
  onRefresh?: () => Promise<void> | void;
  joinedEventIds?: Record<string, boolean>;
  onJoinEvent?: (eventId: string | number) => Promise<void> | void;
  hasMorePosts?: boolean;
  onLoadMorePosts?: () => void;
  loadingMore?: boolean;
  sectionError?: string | null;
  onDiscover?: () => void;
  initialPostId?: string | null;
  focusCommentId?: string | null;
}

/** Les six espaces deviennent des filtres de la grille, pas des routes. */
const TABS: Array<{ id: CommunityMobileTab; label: string; icon: React.ReactNode }> = [
  { id: 'fil', label: 'Tout', icon: <Icon name="layers" size={18} aria-hidden="true" /> },
  { id: 'carnets', label: 'Carnets', icon: <Icon name="book-open" size={18} aria-hidden="true" /> },
  { id: 'clubs', label: 'Clubs', icon: <Icon name="users" size={18} aria-hidden="true" /> },
  { id: 'groupes', label: 'Expéditions', icon: <Icon name="map" size={18} aria-hidden="true" /> },
  { id: 'evenements', label: 'Sorties', icon: <Icon name="calendar" size={18} aria-hidden="true" /> },
  { id: 'entraide', label: 'Entraide', icon: <Icon name="message-square" size={18} aria-hidden="true" /> },
];

function useOffline() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  return offline;
}

function postItem(post: CommunityPostItemLike): CommunityGridItem {
  const media = usableCommunityMedia(post.media_urls ?? null, post.image_url ?? null)[0] ?? null;
  return {
    key: `post:${post.id}`,
    kind: 'post',
    id: String(post.id),
    title: String(post.content || 'Publication').slice(0, 70),
    subtitle: post.author?.full_name || 'Voyageur',
    image: media,
    video: Boolean(media && isCommunityVideoUrl(media)),
    date: post.created_at,
    raw: post,
  };
}

/**
 * Hub Communauté.
 *
 * La capsule 48 px filtre une **grille de tuiles identiques à celles du
 * Compte** (3 colonnes, `aspect-ratio: 1/1.05`, rayon 9, badge verre). Chaque
 * tuile ouvre un drawer de contenu : publication, carnet, club, expédition ou
 * sortie. Aucune section ne navigue d'abord vers une page.
 */
export default function MobileCommunityHub({
  posts = [],
  carnets = [],
  clubs = [],
  groups = [],
  events = [],
  activeTab = 'fil',
  onTabChange,
  loading = false,
  user,
  onRefresh,
  joinedEventIds = {},
  onJoinEvent,
  hasMorePosts = false,
  onLoadMorePosts,
  loadingMore = false,
  sectionError = null,
  onDiscover,
  initialPostId = null,
  focusCommentId = null,
}: MobileCommunityHubProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [activeItem, setActiveItem] = useState<CommunityGridItem | null>(null);
  const offline = useOffline();
  const activeIndex = Math.max(0, TABS.findIndex((tab) => tab.id === activeTab));

  const { isRefreshing, pullProgress } = usePullToRefresh(async () => {
    if (onRefresh) {
      triggerHaptic('medium');
      await onRefresh();
    }
  });

  const deepLinkedItem = useMemo(() => {
    if (!initialPostId) return null;
    const post = posts.find((entry) => String(entry.id) === String(initialPostId));
    return post ? postItem(post) : null;
  }, [initialPostId, posts]);

  useEffect(() => {
    if (deepLinkedItem) setActiveItem(deepLinkedItem);
  }, [deepLinkedItem]);

  return (
    <div className="lkdv-social-mobile min-h-full w-full font-sans text-[color:var(--lkv-text-primary)]">
      <div className="lkdv-social-mobile-content space-y-[var(--space-4)] px-[var(--space-3)] pb-[var(--space-8)] pt-[var(--space-2)]">
        {(pullProgress > 0 || isRefreshing) && (
          <div
            className="flex w-full items-center justify-center overflow-hidden py-[var(--space-2)] transition-all"
            style={{ height: isRefreshing ? '44px' : `${Math.min(pullProgress * 44, 44)}px` }}
          >
            <Card variant="compact" className="flex items-center gap-[var(--space-2)] rounded-full py-[var(--space-1)] text-[length:var(--lkv-text-caption)] font-medium">
              <Spinner size="sm" />
              <span className="font-mono text-[length:var(--lkv-text-caption-2)]">
                {isRefreshing ? 'Actualisation...' : 'Tirer pour rafraîchir'}
              </span>
            </Card>
          </div>
        )}

        {offline ? <OfflineBanner offline /> : null}

        {!user ? (
          <div className="lkdv-hub-visitor" role="status">
            <Icon name="users" size={16} aria-hidden="true" />
            <p>Connectez-vous pour publier, aimer et rejoindre un club.</p>
            <Link href="/connexion?next=/communaute" className="lkdv-hub-visitor-cta">
              Se connecter
            </Link>
          </div>
        ) : null}

        {/* Capsule unique des six espaces — filtre de la grille. */}
        <div className="lkdv-social-category-tabs">
          <CapsuleTabs
            items={TABS}
            activeIndex={activeIndex}
            onIndexChange={(index) => {
              const tab = TABS[index];
              if (!tab) return;
              triggerHaptic('light');
              onTabChange?.(tab.id);
            }}
            ariaLabel="Espaces de la communauté"
            idFor={(id) => `hub-tab-${id}`}
            showLabels
          />
        </div>

        {sectionError ? (
          <div
            role="alert"
            className="flex items-center justify-between gap-[var(--space-2)] rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-danger)]/30 bg-[color:var(--lkv-danger)]/10 px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-danger)]"
          >
            <span>{sectionError}</span>
            {onRefresh ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => void onRefresh()}>
                Réessayer
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="lkdv-community-grid-card">
          <div className="lkdv-community-grid-head">
            <h2>La communauté</h2>
            <span>Publications, carnets, clubs et sorties</span>
          </div>

          {loading && posts.length === 0 ? (
            <div className="lkdv-community-grid-skeleton" aria-label="Chargement de la communauté">
              {Array.from({ length: 9 }).map((_, index) => (
                <Skeleton key={index} className="lkdv-community-grid-skeleton-tile" />
              ))}
            </div>
          ) : (
            <CommunityGrid
              posts={posts}
              carnets={carnets}
              clubs={clubs}
              groups={groups}
              events={events}
              activeTab={activeTab}
              onOpen={(item) => {
                triggerHaptic('light');
                setActiveItem(item);
              }}
              onLoadMore={onLoadMorePosts}
              hasMore={hasMorePosts}
              loadingMore={loadingMore}
              onDiscover={onDiscover}
            />
          )}
        </div>
      </div>

      <CommunityContentDrawer
        item={activeItem}
        onClose={() => setActiveItem(null)}
        user={user}
        joinedEventIds={joinedEventIds}
        onJoinEvent={onJoinEvent}
        focusCommentId={focusCommentId}
      />
    </div>
  );
}
