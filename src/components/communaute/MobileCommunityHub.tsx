'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { Badge, Button, Card, Chip, EmptyState, Skeleton, Spinner, Tabs } from '@/components/ui';
import CommunityPostCard, { CommunityPostItem } from '@/components/communaute/CommunityPostCard';
import CarnetHubCard from '@/components/carnets/CarnetHubCard';
import CommunityStoriesBar from '@/components/communaute/CommunityStoriesBar';
import MobileCommunityHeader from '@/components/communaute/MobileCommunityHeader';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

export type CommunityMobileTab = 'fil' | 'carnets' | 'clubs' | 'groupes' | 'evenements' | 'entraide';

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
}

const TABS: Array<{ id: CommunityMobileTab; label: string; icon: React.ReactNode }> = [
  { id: 'fil', label: 'Pour vous', icon: <Icon name="layers" size={17} aria-hidden="true" /> },
  { id: 'carnets', label: 'Carnets', icon: <Icon name="book-open" size={17} aria-hidden="true" /> },
  { id: 'clubs', label: 'Clubs', icon: <Icon name="users" size={17} aria-hidden="true" /> },
  { id: 'groupes', label: 'Expéditions', icon: <Icon name="map" size={17} aria-hidden="true" /> },
  { id: 'evenements', label: 'Sorties', icon: <Icon name="calendar" size={17} aria-hidden="true" /> },
  { id: 'entraide', label: 'Entraide', icon: <Icon name="message-square" size={17} aria-hidden="true" /> },
];

const MASSIFS = ['all', 'Chartreuse', 'Vercors', 'Mont-Blanc', 'Belledonne', 'Vanoise'];

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
}: MobileCommunityHubProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [currentTab, setCurrentTab] = useState<CommunityMobileTab>(activeTab);
  const [carnetFilter, setCarnetFilter] = useState('all');

  const { isRefreshing, pullProgress } = usePullToRefresh(async () => {
    if (onRefresh) {
      triggerHaptic('medium');
      await onRefresh();
    }
  });

  useEffect(() => {
    setCurrentTab(activeTab);
  }, [activeTab]);

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail) {
        const tab = e.detail as CommunityMobileTab;
        setCurrentTab(tab);
        if (onTabChange) onTabChange(tab);
      }
    };
    window.addEventListener('community-tab-change', handler);
    return () => window.removeEventListener('community-tab-change', handler);
  }, [onTabChange]);

  const filteredCarnets = carnets.filter((c) => {
    if (carnetFilter === 'all') return true;
    const dest = (c.destination || '').toLowerCase();
    const tags = (c.tags || []).join(' ').toLowerCase();
    return dest.includes(carnetFilter.toLowerCase()) || tags.includes(carnetFilter.toLowerCase());
  });

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

        <Tabs
          variant="scrollable"
          ariaLabel="Espaces de la communauté"
          value={currentTab}
          onChange={(tab) => {
            triggerHaptic('light');
            setCurrentTab(tab as CommunityMobileTab);
            onTabChange?.(tab as CommunityMobileTab);
          }}
          options={TABS}
        />
        {/* 1. LIVE EXPLORER STORIES BAR */}
        <Card variant="featured" className="p-[var(--space-2)]">
          <CommunityStoriesBar currentUser={user} />
        </Card>

        {/* 3. ACTIVE TAB CONTENT STREAM */}
        <div className="space-y-[var(--space-4)] pt-[var(--space-1)]">
          {/* ── TAB 1: FIL D'ACTUALITÉ ── */}
          {currentTab === 'fil' && (
            <div className="space-y-[var(--space-4)]">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold">Au fil des aventures</h2>
                <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Les derniers récits</span>
              </div>
              {loading ? (
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
                posts.map((post) => (
                  <CommunityPostCard key={post.id} post={post} user={user} />
                ))
              )}
            </div>
          )}

          {/* ── TAB 2: CARNETS DE VOYAGE ── */}
          {currentTab === 'carnets' && (
            <div className="space-y-[var(--space-3)]">
              {/* Massif filter chips */}
              <div className="no-scrollbar flex items-center gap-[var(--space-1)] overflow-x-auto pb-[var(--space-1)]">
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

          {/* ── TAB 3: CLUBS & COLLECTIFS ── */}
          {currentTab === 'clubs' && (
            <div className="space-y-[var(--space-3)]">
              {clubs.map((c) => (
                <Link
                  key={c.id || c.name}
                  href={c.id ? `/clubs/${c.id}` : c.slug ? `/clubs/${c.slug}` : '/communaute?tab=clubs'}
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
                        {c.category && (
                          <span className="block font-mono text-[length:var(--lkv-text-caption-2)] font-semibold text-[color:var(--lkv-secondary)]">
                            📍 {c.category}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-text-secondary)]">
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

          {/* ── TAB 4: GROUPES D'EXPÉDITION ── */}
          {currentTab === 'groupes' && (
            <div className="space-y-[var(--space-3)]">
              {groups.map((grp) => (
                <Link
                  key={grp.id || grp.name}
                  href={grp.id ? `/groupes/${grp.id}` : '/communaute?tab=groupes'}
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

          {/* ── TAB 5: ÉVÉNEMENTS & SORTIES ── */}
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

          {/* ── TAB 6: ENTRAIDE & Q&A ── */}
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
                <Card variant="compact" tone="info" className="space-y-[var(--space-1)]">
                  <span className="block text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">
                    ✓ Réponses validées par les Guides LKDV
                  </span>
                  <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-secondary)]">
                    Chaque info critique est confirmée sur le terrain par les explorateurs référents.
                  </p>
                </Card>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
