'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { Badge, Button, Card, Chip, EmptyState, Skeleton, Spinner } from '@/components/ui';
import SmartImage from '@/components/ui/SmartImage';
import { CapsuleTabs } from '@/components/ui/CapsuleTabs';
import { OfflineBanner } from '@/features/adventure-intelligence/ui/OfflineBanner';
import CommunityPostCard, { type CommunityPostItem } from '@/components/communaute/CommunityPostCard';
import CarnetHubCard from '@/components/carnets/CarnetHubCard';
import { usableCommunityMedia, isCommunityVideoUrl } from '@/lib/community/media';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

export type CommunityMobileTab = 'fil' | 'carnets' | 'clubs' | 'groupes' | 'evenements' | 'entraide';
type CommunityView = 'fil' | 'grille';

interface MobileCommunityHubProps {
  posts: CommunityPostItem[];
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
  highlightPostId?: string | null;
  focusCommentId?: string | null;
  hasMorePosts?: boolean;
  onLoadMorePosts?: () => void;
  loadingMore?: boolean;
  sectionError?: string | null;
}

/** Les six espaces, dans l'ordre des lentilles. Icônes 18 px (capsule 48 px). */
const TABS: Array<{ id: CommunityMobileTab; label: string; icon: React.ReactNode }> = [
  { id: 'fil', label: 'Pour vous', icon: <Icon name="layers" size={18} aria-hidden="true" /> },
  { id: 'carnets', label: 'Carnets', icon: <Icon name="book-open" size={18} aria-hidden="true" /> },
  { id: 'clubs', label: 'Clubs', icon: <Icon name="users" size={18} aria-hidden="true" /> },
  { id: 'groupes', label: 'Expéditions', icon: <Icon name="map" size={18} aria-hidden="true" /> },
  { id: 'evenements', label: 'Sorties', icon: <Icon name="calendar" size={18} aria-hidden="true" /> },
  { id: 'entraide', label: 'Entraide', icon: <Icon name="message-square" size={18} aria-hidden="true" /> },
];

const MASSIFS = ['all', 'Chartreuse', 'Vercors', 'Mont-Blanc', 'Belledonne', 'Vanoise'];

/**
 * Détection hors-ligne minimale (aucun contexte global, aucun état partagé).
 * `navigator.onLine` est la seule source fiable côté navigateur.
 */
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

function firstMedia(post: CommunityPostItem): string | null {
  return usableCommunityMedia(post.media_urls, post.image_url)[0] ?? null;
}

/**
 * Contenu du hub Communauté.
 *
 * La capsule 48 px est le **seul** sélecteur des six espaces. Les stories, le
 * héro et les compteurs vivent au-dessus, dans `CommunityHeroCard`.
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
  highlightPostId = null,
  focusCommentId = null,
  hasMorePosts = false,
  onLoadMorePosts,
  loadingMore = false,
  sectionError = null,
}: MobileCommunityHubProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [carnetFilter, setCarnetFilter] = useState('all');
  const [view, setView] = useState<CommunityView>('fil');
  const offline = useOffline();
  const currentTab: CommunityMobileTab = activeTab;
  const activeIndex = Math.max(0, TABS.findIndex((tab) => tab.id === currentTab));

  const { isRefreshing, pullProgress } = usePullToRefresh(async () => {
    if (onRefresh) {
      triggerHaptic('medium');
      await onRefresh();
    }
  });

  const filteredCarnets = carnets.filter((c) => {
    if (carnetFilter === 'all') return true;
    const dest = (c.destination || '').toLowerCase();
    const tags = (c.tags || []).join(' ').toLowerCase();
    return dest.includes(carnetFilter.toLowerCase()) || tags.includes(carnetFilter.toLowerCase());
  });

  const gridPosts = useMemo(() => posts.filter((post) => Boolean(firstMedia(post))), [posts]);

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

        {/* Capsule unique des six espaces — 48 px, lentille `.sel-lens` 420 ms. */}
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

        <div
          className="lkdv-social-mobile-stream space-y-[var(--space-4)] pt-[var(--space-1)]"
          data-state={loading ? 'loading' : sectionError ? 'error' : 'ready'}
          data-view={view}
        >
          {currentTab === 'fil' && (
            <div className="space-y-[var(--space-4)]">
              <div className="lkdv-community-feed-head">
                <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold">
                  Au fil des aventures
                </h2>
                <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                  Les derniers récits
                </span>
              </div>

              {/* Sélecteur secondaire 30 px — Fil / Grille. */}
              <div
                className="lkdv-lens-float lkdv-community-view-lens"
                role="tablist"
                aria-label="Affichage du fil"
                style={{ '--n': 2 } as React.CSSProperties}
              >
                <span
                  className="ig-th lens"
                  aria-hidden="true"
                  style={{ transform: `translateX(${view === 'fil' ? 0 : 100}%)` }}
                />
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'fil'}
                  aria-label="Fil"
                  onClick={() => {
                    triggerHaptic('light');
                    setView('fil');
                  }}
                >
                  <Icon name="layers" size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'grille'}
                  aria-label="Grille"
                  onClick={() => {
                    triggerHaptic('light');
                    setView('grille');
                  }}
                >
                  <Icon name="square" size={15} aria-hidden="true" />
                </button>
              </div>

              {sectionError && (
                <div
                  role="alert"
                  className="flex items-center justify-between gap-[var(--space-2)] rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-danger)]/30 bg-[color:var(--lkv-danger)]/10 px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-danger)]"
                >
                  <span>{sectionError}</span>
                  {onRefresh && (
                    <Button type="button" variant="secondary" size="sm" onClick={() => void onRefresh()}>
                      Réessayer
                    </Button>
                  )}
                </div>
              )}

              {loading && posts.length === 0 ? (
                <div className="space-y-[var(--space-3)]" aria-label="Chargement du fil">
                  {[1, 2].map((i) => (
                    <div key={i} className="lkdv-community-post-skeleton">
                      <div className="flex items-center gap-[var(--space-3)]">
                        <Skeleton className="size-10 shrink-0 rounded-full" />
                        <div className="flex-1 space-y-[var(--space-1)]">
                          <Skeleton className="h-3 w-28 rounded" />
                          <Skeleton className="h-2 w-16 rounded" />
                        </div>
                      </div>
                      <Skeleton className="h-12 w-full rounded-[var(--lkv-radius-md)]" />
                    </div>
                  ))}
                </div>
              ) : view === 'grille' ? (
                gridPosts.length === 0 ? (
                  <Card>
                    <EmptyState
                      compact
                      icon={<span className="text-3xl">🖼️</span>}
                      title="Aucun média pour le moment"
                      description="Les photos et vidéos publiées apparaîtront ici."
                    />
                  </Card>
                ) : (
                  <section className="lkdv-community-grid" aria-label="Publications en grille">
                    {gridPosts.map((post) => {
                      const media = firstMedia(post);
                      return (
                        <Link
                          key={post.id}
                          href={`/communaute/post/${post.id}`}
                          className="lkdv-community-grid-tile"
                          aria-label="Ouvrir la publication"
                        >
                          {media && isCommunityVideoUrl(media) ? (
                            <span className="lkdv-community-grid-video" aria-hidden="true">
                              ▶
                            </span>
                          ) : media ? (
                            <SmartImage src={media} alt="" className="size-full object-cover" />
                          ) : null}
                        </Link>
                      );
                    })}
                  </section>
                )
              ) : posts.length === 0 ? (
                <Card>
                  <EmptyState
                    compact
                    icon={<span className="text-3xl">🌲</span>}
                    title="Le fil est calme"
                    description="Soyez le premier à partager votre traversée ou vos conseils !"
                    actionLabel="Publier un récit"
                    actionHref="/carnets/nouveau"
                  />
                </Card>
              ) : (
                <>
                  {posts.map((post) => (
                    <CommunityPostCard
                      key={post.id}
                      post={post}
                      user={user}
                      highlight={highlightPostId === post.id}
                      focusCommentId={post.id === highlightPostId ? focusCommentId : undefined}
                    />
                  ))}
                  {hasMorePosts && onLoadMorePosts && (
                    <div className="flex justify-center pt-[var(--space-2)]">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={onLoadMorePosts}
                        disabled={loadingMore}
                      >
                        {loadingMore ? 'Chargement…' : 'Charger plus de publications'}
                      </Button>
                    </div>
                  )}
                  {!hasMorePosts && posts.length > 0 && (
                    <p className="pb-[var(--space-2)] text-center text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                      Tu as tout vu.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

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

          {currentTab === 'clubs' && (
            <div className="space-y-[var(--space-3)]">
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
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] text-[color:var(--lkv-text-secondary)]">
                      <Icon name="arrow-right" size={12} aria-hidden="true" />
                    </span>
                  </Card>
                </Link>
              ))}
              {!loading && clubs.length === 0 && (
                <Card>
                  <EmptyState
                    compact
                    icon={<span className="text-3xl">🏔️</span>}
                    title="Aucun club pour le moment"
                    description="Les collectifs créés apparaîtront ici."
                  />
                </Card>
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
                        {grp.description && (
                          <p className="line-clamp-2 text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-muted)]">
                            {grp.description}
                          </p>
                        )}
                      </div>
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--lkv-radius-sm)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-xl shadow-elevation-1">
                        {grp.pictogram || '🏕️'}
                      </div>
                    </div>

                    {grp.max_members > 0 && (
                      <div className="flex items-center justify-between border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-2)]">
                        <div className="flex items-center gap-[var(--space-1)] font-mono text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
                          <span className="font-bold text-[color:var(--lkv-text-primary)]">{grp.max_members}</span> places max
                        </div>
                        <Badge tone="sage">Voir le cockpit →</Badge>
                      </div>
                    )}
                  </Card>
                </Link>
              ))}
              {!loading && groups.length === 0 && (
                <Card>
                  <EmptyState
                    compact
                    icon={<span className="text-3xl">⛺</span>}
                    title="Aucune expédition en formation"
                    description="Créez un groupe pour préparer votre prochaine sortie."
                  />
                </Card>
              )}
            </div>
          )}

          {currentTab === 'evenements' && (
            <div className="space-y-[var(--space-3)]">
              {events.map((ev) => {
                const joined = joinedEventIds[String(ev.id)];
                return (
                  <Card
                    key={ev.id || ev.title}
                    variant="compact"
                    className="flex items-center justify-between gap-[var(--space-3)]"
                  >
                    <div className="min-w-0 space-y-[var(--space-1)]">
                      <Badge tone="stone" className="font-mono">
                        📅 {ev.date || 'Date à confirmer'}
                      </Badge>
                      <h4 className="truncate font-display text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                        {ev.title}
                      </h4>
                      <p className="font-mono text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
                        📍 {ev.location || 'Lieu à préciser'}
                        {ev.guide ? ` · ${ev.guide}` : ''}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant={joined ? 'secondary' : 'primary'}
                      size="sm"
                      disabled={joined}
                      onClick={() => onJoinEvent?.(ev.id)}
                      className="shrink-0"
                    >
                      {joined ? 'Inscrit ✓' : "S'inscrire"}
                    </Button>
                  </Card>
                );
              })}
              {!loading && events.length === 0 && (
                <Card>
                  <EmptyState
                    compact
                    icon={<span className="text-3xl">📅</span>}
                    title="Aucune sortie programmée"
                    description="Les événements à venir apparaîtront ici."
                  />
                </Card>
              )}
            </div>
          )}

          {currentTab === 'entraide' && (
            <div className="space-y-[var(--space-3)]">
              <Card variant="compact" className="space-y-[var(--space-2)]">
                <div className="flex items-center gap-[var(--space-2)]">
                  <span className="text-xl">💡</span>
                  <h3 className="font-display text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                    Entraide &amp; Conditions de Sentier
                  </h3>
                </div>
                <p className="text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-muted)]">
                  Posez vos questions sur le débit des sources, l&apos;enneigement des cols et les refuges non gardés.
                </p>
                <Link href="/entraide" className="inline-flex min-h-11 items-center gap-1 text-[length:var(--lkv-text-caption)] font-semibold">
                  Ouvrir l&apos;entraide
                  <Icon name="arrow-right" size={14} aria-hidden="true" />
                </Link>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
