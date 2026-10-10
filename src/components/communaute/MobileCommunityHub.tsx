'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { Badge, Button, Card, Chip, EmptyState, Skeleton, Spinner, Tabs } from '@/components/ui';
import CommunityPostCard, { CommunityPostItem } from '@/components/communaute/CommunityPostCard';
import CarnetHubCard from '@/components/carnets/CarnetHubCard';
import CommunityStoriesBar from '@/components/communaute/CommunityStoriesBar';
import MobileCommunityHeader from '@/components/communaute/MobileCommunityHeader';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useGeolocation } from '@/hooks/useGeolocation';
import type { FeedV1Item } from '@/features/community/feed/types/feed.types';

export type CommunityMobileTab =
  | 'pour-toi'
  | 'abonnements'
  | 'autour-de-moi'
  | 'clubs'
  | 'fil'
  | 'carnets'
  | 'groupes'
  | 'evenements'
  | 'entraide';

export interface MobileCommunityHubProps {
  posts?: CommunityPostItem[];
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
}

const OPERATIONAL_TABS: Array<{ id: CommunityMobileTab; label: string; icon: React.ReactNode }> = [
  { id: 'pour-toi', label: 'Pour toi', icon: <Icon name="sparkles" size={17} aria-hidden="true" /> },
  { id: 'abonnements', label: 'Abonnements', icon: <Icon name="users" size={17} aria-hidden="true" /> },
  { id: 'autour-de-moi', label: 'Autour de moi', icon: <Icon name="map-pin" size={17} aria-hidden="true" /> },
  { id: 'clubs', label: 'Clubs', icon: <Icon name="compass" size={17} aria-hidden="true" /> },
];

const MASSIFS = ['all', 'Chartreuse', 'Vercors', 'Mont-Blanc', 'Belledonne', 'Vanoise'];

export default function MobileCommunityHub({
  posts = [],
  carnets = [],
  clubs = [],
  groups = [],
  events = [],
  activeTab = 'pour-toi',
  onTabChange,
  loading: initialLoading = false,
  user,
  onRefresh,
  joinedEventIds = {},
  onJoinEvent,
}: MobileCommunityHubProps) {
  const { triggerHaptic } = useHapticFeedback();
  const { position, requestPermission, loading: geoLoading } = useGeolocation();

  // Normalize legacy tab names
  const normalizedInitialTab = (activeTab === 'fil' ? 'pour-toi' : activeTab) as CommunityMobileTab;
  const [currentTab, setCurrentTab] = useState<CommunityMobileTab>(normalizedInitialTab);
  const [feedItems, setFeedItems] = useState<FeedV1Item[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [carnetFilter, setCarnetFilter] = useState('all');

  // Synchronize when parent prop activeTab changes
  useEffect(() => {
    if (activeTab) {
      const norm = activeTab === 'fil' ? 'pour-toi' : activeTab;
      setCurrentTab(norm);
    }
  }, [activeTab]);

  // Fetch feed items dynamically based on tab and coordinates
  const fetchFeedForTab = useCallback(
    async (tab: CommunityMobileTab) => {
      const validTabs = ['pour-toi', 'abonnements', 'autour-de-moi', 'clubs'];
      const targetTab = validTabs.includes(tab) ? tab : 'pour-toi';

      setFeedLoading(true);
      try {
        let url = `/api/community/feed?tab=${targetTab}&limit=20`;
        if (targetTab === 'autour-de-moi' && position?.coords) {
          url += `&lat=${position.coords.latitude}&lng=${position.coords.longitude}`;
        }
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.items)) {
            setFeedItems(data.items);
          }
        }
      } catch (err) {
        console.error('[MobileCommunityHub] feed fetch error:', err);
      } finally {
        setFeedLoading(false);
      }
    },
    [position]
  );

  // Trigger feed load when tab or geolocation changes
  useEffect(() => {
    if (['pour-toi', 'abonnements', 'autour-de-moi', 'clubs'].includes(currentTab)) {
      fetchFeedForTab(currentTab);
    }
  }, [currentTab, fetchFeedForTab]);

  // Pull to refresh support
  const { isRefreshing, pullProgress } = usePullToRefresh(async () => {
    triggerHaptic('medium');
    if (onRefresh) {
      await onRefresh();
    }
    await fetchFeedForTab(currentTab);
  });

  const handleTabSelect = (tabId: CommunityMobileTab) => {
    triggerHaptic('light');
    setCurrentTab(tabId);
    onTabChange?.(tabId);
  };

  const handleRemovePost = (postId: string) => {
    setFeedItems((prev) => prev.filter((item) => item.post.id !== postId));
  };

  const filteredCarnets = carnets.filter((c) => {
    if (carnetFilter === 'all') return true;
    const dest = (c.destination || '').toLowerCase();
    const tags = (c.tags || []).join(' ').toLowerCase();
    return dest.includes(carnetFilter.toLowerCase()) || tags.includes(carnetFilter.toLowerCase());
  });

  const isLoading = initialLoading || feedLoading;

  return (
    <div className="min-h-full w-full bg-transparent font-sans text-[color:var(--lkv-text-primary)]">
      {/* 0. STICKY TOPBAR HEADER */}
      <MobileCommunityHeader />

      <div className="space-y-[var(--space-5)] px-[var(--space-4)] pb-[var(--space-8)] pt-[var(--space-2)]">
        {/* Pull to refresh visual feedback indicator */}
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

        {/* 1. OPERATIONAL 4 TABS NAVIGATION RAIL */}
        <Tabs
          variant="scrollable"
          ariaLabel="Flux communautaire LKDV"
          value={currentTab}
          onChange={(tab) => handleTabSelect(tab as CommunityMobileTab)}
          options={OPERATIONAL_TABS}
          className="pr-[28px] [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] [-webkit-mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]"
        />

        {/* 2. LIVE EXPLORER STORIES BAR */}
        <Card variant="featured" className="p-[var(--space-2)]">
          <CommunityStoriesBar currentUser={user} />
        </Card>

        {/* 3. ACTIVE TAB CONTENT STREAM */}
        <div className="space-y-[var(--space-4)] pt-[var(--space-1)]">
          {/* ══════════════════════════════════════════════════════════════
              TAB 1: POUR TOI (FEED V1 SCORÉ DÉTERMINISTE)
             ══════════════════════════════════════════════════════════════ */}
          {(currentTab === 'pour-toi' || currentTab === 'fil') && (
            <div className="space-y-[var(--space-4)]">
              <div className="flex items-center justify-between px-[var(--space-1)]">
                <div className="flex items-center gap-1.5">
                  <span className="text-base" aria-hidden="true">✨</span>
                  <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold">
                    Recommandations terrain
                  </h2>
                </div>
                <span className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                  Feed V1 scoré
                </span>
              </div>

              {isLoading ? (
                <div className="space-y-[var(--space-3)]">
                  {[1, 2].map((i) => (
                    <Card key={i} className="space-y-[var(--space-3)]">
                      <div className="flex items-center gap-[var(--space-3)]">
                        <Skeleton className="size-10 shrink-0 rounded-full" />
                        <div className="flex-1 space-y-[var(--space-1)]">
                          <Skeleton className="h-3 w-28 rounded" />
                          <Skeleton className="h-2 w-16 rounded" />
                        </div>
                      </div>
                      <Skeleton className="h-12 w-full rounded-[var(--lkv-radius-md)]" />
                      <Skeleton className="h-44 w-full rounded-[var(--lkv-radius-md)]" />
                    </Card>
                  ))}
                </div>
              ) : feedItems.length === 0 && posts.length === 0 ? (
                <Card>
                  <EmptyState
                    compact
                    icon={<span className="text-3xl">🌲</span>}
                    title="Le fil est calme"
                    description="Soyez le premier à partager votre traversée ou vos conseils !"
                    actionLabel="Publier un récit"
                    actionHref="/communaute/publier"
                  />
                </Card>
              ) : (
                <>
                  {/* First batch of posts */}
                  {(feedItems.length > 0 ? feedItems : posts.map((p) => ({ post: p, transparency: p.transparency || null, userInteractions: { isSaved: p.user_saved ?? false, isLiked: p.user_liked ?? false } })))
                    .slice(0, 2)
                    .map((item: any) => (
                      <CommunityPostCard
                        key={item.post.id}
                        post={item.post}
                        transparency={item.transparency}
                        user={user}
                        onHide={handleRemovePost}
                      />
                    ))}

                  {/* CARNETS DURABLES DISCOVERY CAROUSEL */}
                  {filteredCarnets.length > 0 && (
                    <div className="space-y-[var(--space-2)] py-[var(--space-2)]">
                      <div className="flex items-center justify-between px-[var(--space-1)]">
                        <div className="flex items-center gap-1.5">
                          <Icon name="book-open" size={16} className="text-[color:var(--lkv-action)]" aria-hidden="true" />
                          <h3 className="font-display text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                            Carnets durables vérifiés
                          </h3>
                        </div>
                        <Link
                          href="/carnets"
                          className="font-mono text-[length:var(--lkv-text-caption-2)] font-semibold text-[color:var(--lkv-action)] hover:underline"
                        >
                          Explorer →
                        </Link>
                      </div>

                      <div className="no-scrollbar flex gap-[var(--space-3)] overflow-x-auto pb-[var(--space-2)] pr-[28px] [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] [-webkit-mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]">
                        {filteredCarnets.slice(0, 4).map((carnet) => (
                          <div key={carnet.id || carnet.title} className="w-[280px] shrink-0">
                            <CarnetHubCard carnet={carnet} currentUserId={user?.id} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Remaining feed items */}
                  {(feedItems.length > 0 ? feedItems : posts.map((p) => ({ post: p, transparency: p.transparency || null, userInteractions: { isSaved: p.user_saved ?? false, isLiked: p.user_liked ?? false } })))
                    .slice(2)
                    .map((item: any) => (
                      <CommunityPostCard
                        key={item.post.id}
                        post={item.post}
                        transparency={item.transparency}
                        user={user}
                        onHide={handleRemovePost}
                      />
                    ))}

                  {/* CLUBS & COLLECTIFS DISCOVERY SHELF */}
                  {clubs.length > 0 && (
                    <div className="space-y-[var(--space-2)] pt-[var(--space-2)]">
                      <div className="flex items-center justify-between px-[var(--space-1)]">
                        <div className="flex items-center gap-1.5">
                          <Icon name="compass" size={16} className="text-[color:var(--lkv-action)]" aria-hidden="true" />
                          <h3 className="font-display text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                            Clubs &amp; Collectifs LKDV
                          </h3>
                        </div>
                        <Link
                          href="/clubs"
                          className="font-mono text-[length:var(--lkv-text-caption-2)] font-semibold text-[color:var(--lkv-action)] hover:underline"
                        >
                          Tous les clubs →
                        </Link>
                      </div>

                      <div className="no-scrollbar flex gap-[var(--space-3)] overflow-x-auto pb-[var(--space-2)] pr-[28px] [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] [-webkit-mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]">
                        {clubs.slice(0, 4).map((c) => (
                          <Link
                            key={c.id || c.name}
                            href={c.id ? `/clubs/${c.id}` : c.slug ? `/clubs/${c.slug}` : '/clubs'}
                            className="block w-[240px] shrink-0 transition-transform active:scale-[0.98]"
                          >
                            <Card variant="compact" className="h-full space-y-2 p-[var(--space-3)]">
                              <div className="flex items-center gap-[var(--space-2)]">
                                <span className="flex size-9 items-center justify-center rounded-lg bg-[color:var(--glass-bg-subtle)] text-xl">
                                  {c.emoji || '🏕️'}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <h4 className="truncate font-display text-[length:var(--lkv-text-caption)] font-bold">
                                    {c.name}
                                  </h4>
                                  <span className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                                    {c.members_count ?? 0} membres
                                  </span>
                                </div>
                              </div>
                              {c.slogan && (
                                <p className="line-clamp-2 text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-secondary)]">
                                  {c.slogan}
                                </p>
                              )}
                            </Card>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB 2: ABONNEMENTS (CRÉATEURS SUIVIS CHRONOLOGIQUE)
             ══════════════════════════════════════════════════════════════ */}
          {currentTab === 'abonnements' && (
            <div className="space-y-[var(--space-4)]">
              <div className="flex items-center justify-between px-[var(--space-1)]">
                <div className="flex items-center gap-1.5">
                  <Icon name="users" size={16} className="text-[color:var(--lkv-action)]" aria-hidden="true" />
                  <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold">
                    Explorateurs suivis
                  </h2>
                </div>
                <span className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                  Chronologique
                </span>
              </div>

              {!user ? (
                <Card className="space-y-3 p-[var(--space-4)] text-center">
                  <span className="text-3xl">👤</span>
                  <h3 className="font-display text-[length:var(--lkv-text-footnote)] font-bold">
                    Connectez-vous pour voir vos abonnements
                  </h3>
                  <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-secondary)]">
                    Suivez vos compagnons d&apos;expédition pour ne manquer aucun de leurs récits.
                  </p>
                  <Link href="/connexion" className="inline-block pt-1">
                    <Button variant="primary" size="sm">
                      Se connecter
                    </Button>
                  </Link>
                </Card>
              ) : isLoading ? (
                <div className="space-y-[var(--space-3)]">
                  {[1, 2].map((i) => (
                    <Card key={i} className="space-y-[var(--space-3)]">
                      <Skeleton className="h-10 w-full rounded" />
                      <Skeleton className="h-32 w-full rounded" />
                    </Card>
                  ))}
                </div>
              ) : feedItems.length === 0 ? (
                <Card>
                  <EmptyState
                    compact
                    icon={<span className="text-3xl">👥</span>}
                    title="Aucune sortie récente de vos abonnements"
                    description="Découvrez des explorateurs référents dans l'onglet « Pour toi » et suivez leurs sorties."
                  />
                </Card>
              ) : (
                feedItems.map((item) => (
                  <CommunityPostCard
                    key={item.post.id}
                    post={item.post}
                    transparency={item.transparency}
                    user={user}
                    onHide={handleRemovePost}
                  />
                ))
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB 3: AUTOUR DE MOI (PROXIMITÉ GÉO & MASSIFS)
             ══════════════════════════════════════════════════════════════ */}
          {currentTab === 'autour-de-moi' && (
            <div className="space-y-[var(--space-4)]">
              {/* Geolocation status header banner */}
              <div className="flex items-center justify-between rounded-[var(--lkv-radius-md)] border border-[color:var(--btn-glass-border)] bg-[color:var(--glass-bg-subtle)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-action)]">
                <div className="flex items-center gap-1.5 font-medium">
                  <Icon name="map-pin" size={14} className="shrink-0" aria-hidden="true" />
                  <span>
                    {position
                      ? `Position active : ${position.coords.latitude.toFixed(2)}°, ${position.coords.longitude.toFixed(2)}°`
                      : 'Position non partagée (Massif par défaut)'}
                  </span>
                </div>
                {!position && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={geoLoading}
                    onClick={() => {
                      triggerHaptic('light');
                      requestPermission();
                    }}
                    className="h-7 text-xs font-semibold"
                  >
                    {geoLoading ? <Spinner size="sm" /> : 'Activer le GPS'}
                  </Button>
                )}
              </div>

              {isLoading ? (
                <div className="space-y-[var(--space-3)]">
                  {[1, 2].map((i) => (
                    <Card key={i} className="space-y-[var(--space-3)]">
                      <Skeleton className="h-10 w-full rounded" />
                      <Skeleton className="h-32 w-full rounded" />
                    </Card>
                  ))}
                </div>
              ) : feedItems.length === 0 ? (
                <Card>
                  <EmptyState
                    compact
                    icon={<span className="text-3xl">📍</span>}
                    title="Aucune sortie dans ce secteur"
                    description="Élargissez votre recherche ou soyez le premier à partager une observation sur ce massif."
                  />
                </Card>
              ) : (
                feedItems.map((item) => (
                  <CommunityPostCard
                    key={item.post.id}
                    post={item.post}
                    transparency={item.transparency}
                    user={user}
                    onHide={handleRemovePost}
                  />
                ))
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB 4: CLUBS (FLUX DES COLLECTIFS & ANNUAIRE)
             ══════════════════════════════════════════════════════════════ */}
          {currentTab === 'clubs' && (
            <div className="space-y-[var(--space-4)]">
              <div className="flex items-center justify-between px-[var(--space-1)]">
                <div className="flex items-center gap-1.5">
                  <Icon name="compass" size={16} className="text-[color:var(--lkv-action)]" aria-hidden="true" />
                  <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold">
                    Activités de vos clubs
                  </h2>
                </div>
                <Link
                  href="/clubs"
                  className="font-mono text-[length:var(--lkv-text-caption-2)] font-semibold text-[color:var(--lkv-action)] hover:underline"
                >
                  Tous les clubs ({clubs.length}) →
                </Link>
              </div>

              {/* Club Posts from Feed V1 */}
              {isLoading ? (
                <div className="space-y-[var(--space-3)]">
                  {[1, 2].map((i) => (
                    <Card key={i} className="space-y-[var(--space-3)]">
                      <Skeleton className="h-10 w-full rounded" />
                      <Skeleton className="h-32 w-full rounded" />
                    </Card>
                  ))}
                </div>
              ) : feedItems.length > 0 ? (
                <div className="space-y-[var(--space-3)]">
                  {feedItems.map((item) => (
                    <CommunityPostCard
                      key={item.post.id}
                      post={item.post}
                      transparency={item.transparency}
                      user={user}
                      onHide={handleRemovePost}
                    />
                  ))}
                </div>
              ) : null}

              {/* Collective Clubs Directory Cards */}
              <div className="space-y-[var(--space-3)] pt-[var(--space-2)]">
                <h3 className="font-display text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                  Collectifs disponibles
                </h3>
                {clubs.map((c) => (
                  <Link
                    key={c.id || c.name}
                    href={c.id ? `/clubs/${c.id}` : c.slug ? `/clubs/${c.slug}` : '/clubs'}
                    className="block transition-transform active:scale-[0.98]"
                  >
                    <Card variant="compact" className="flex items-center justify-between gap-[var(--space-3)]">
                      <div className="flex min-w-0 items-center gap-[var(--space-3)]">
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-2xl shadow-elevation-1">
                          {c.emoji || '🏕️'}
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-[var(--space-2)]">
                            <h4 className="truncate font-display text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                              {c.name}
                            </h4>
                            <Badge tone="stone" className="shrink-0 font-mono">
                              {c.members_count ?? 0} m.
                            </Badge>
                          </div>
                          {(c.slogan || c.description) && (
                            <p className="line-clamp-1 text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
                              {c.slogan || c.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-text-secondary)]">
                        <Icon name="arrow-right" size={12} aria-hidden="true" />
                      </span>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              LEGACY COMPATIBILITY TABS (CARNETS, GROUPES, EVENEMENTS, ENTRAIDE)
             ══════════════════════════════════════════════════════════════ */}
          {currentTab === 'carnets' && (
            <div className="space-y-[var(--space-3)]">
              <div className="no-scrollbar flex items-center gap-[var(--space-1)] overflow-x-auto pb-[var(--space-1)] pr-[28px] [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] [-webkit-mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]">
                {MASSIFS.map((m) => (
                  <Chip
                    key={m}
                    selected={carnetFilter === m}
                    onClick={() => {
                      triggerHaptic('light');
                      setCarnetFilter(m);
                    }}
                    className="whitespace-nowrap"
                  >
                    {m === 'all' ? 'Tous les massifs' : m}
                  </Chip>
                ))}
              </div>

              {filteredCarnets.length === 0 ? (
                <Card>
                  <EmptyState
                    compact
                    icon={<span className="text-3xl">📖</span>}
                    title="Aucun carnet pour ce massif"
                    description="Essayez un autre massif ou filtre."
                  />
                </Card>
              ) : (
                <div className="space-y-[var(--space-3)]">
                  {filteredCarnets.map((carnet) => (
                    <CarnetHubCard key={carnet.id || carnet.title} carnet={carnet} currentUserId={user?.id} />
                  ))}
                </div>
              )}
            </div>
          )}

          {currentTab === 'groupes' && (
            <div className="space-y-[var(--space-3)]">
              {groups.map((grp) => (
                <Link
                  key={grp.id || grp.name}
                  href={grp.id ? `/groupes/${grp.id}` : '/hub'}
                  className="block transition-transform active:scale-[0.98]"
                >
                  <Card variant="compact" className="flex flex-col justify-between space-y-[var(--space-3)]">
                    <div className="flex items-start justify-between gap-[var(--space-2)]">
                      <div className="space-y-[var(--space-1)]">
                        <Badge tone="stone" className="font-mono">
                          📍 {grp.massif || 'Massif non précisé'}
                        </Badge>
                        <h4 className="font-display text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                          {grp.name}
                        </h4>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {currentTab === 'evenements' && (
            <div className="space-y-[var(--space-3)]">
              {events.map((ev) => {
                const joined = joinedEventIds[String(ev.id)];
                return (
                  <Card key={ev.id || ev.title} variant="compact" className="flex items-center justify-between gap-[var(--space-3)]">
                    <div className="min-w-0 space-y-[var(--space-1)]">
                      <h4 className="truncate font-display text-[length:var(--lkv-text-footnote)] font-bold">
                        {ev.title}
                      </h4>
                    </div>
                    <Button
                      type="button"
                      variant={joined ? 'secondary' : 'primary'}
                      size="sm"
                      disabled={joined}
                      onClick={() => onJoinEvent?.(ev.id)}
                    >
                      {joined ? 'Inscrit ✓' : "S'inscrire"}
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}

          {currentTab === 'entraide' && (
            <div className="space-y-[var(--space-3)]">
              <Card variant="compact" className="space-y-[var(--space-2)]">
                <h3 className="font-display text-[length:var(--lkv-text-footnote)] font-bold">
                  Entraide &amp; Conditions de Sentier
                </h3>
                <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
                  Posez vos questions sur le débit des sources, l&apos;enneigement des cols et les refuges.
                </p>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
