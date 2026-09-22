'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import Header from '@/components/Header';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import { CommunityHubTab } from '@/components/social/CommunityHubNav';
import { CompteBackground } from '@/components/compte/CompteBackground';
import CarnetHubCard from '@/components/carnets/CarnetHubCard';
import CommunityStoriesBar from '@/components/communaute/CommunityStoriesBar';
import CommunityLeftSidebar from '@/components/communaute/CommunityLeftSidebar';
import CommunityRightSidebar from '@/components/communaute/CommunityRightSidebar';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import MobileCommunityHub from '@/components/communaute/MobileCommunityHub';
import CommunityPostCard from '@/components/communaute/CommunityPostCard';
import LineageDiscovery from '@/components/kits/LineageDiscovery';
import CommunityHeroOverview from '@/components/communaute/CommunityHeroOverview';
import { Badge, Button, Card, Chip, EmptyState, LoadingState, SearchField } from '@/components/ui';

function formatEventDate(value?: string | null): string {
  if (!value) return '';
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return value;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function CommunautePageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab mapping
  const paramTab = searchParams?.get('tab') || 'fil';
  const initialTab = (['fil', 'carnets', 'clubs', 'groupes', 'evenements', 'entraide'].includes(paramTab)
    ? paramTab
    : 'fil') as CommunityHubTab;

  const [activeTab, setActiveTab] = useState<CommunityHubTab>(initialTab);

  useEffect(() => {
    if (searchParams?.get('tab')) {
      const t = searchParams.get('tab') as CommunityHubTab;
      if (['fil', 'carnets', 'clubs', 'groupes', 'evenements', 'entraide'].includes(t)) {
        setActiveTab(t);
      }
    }
  }, [searchParams]);

  // P2 — mécanisme UNIQUE (miroir du plateau mobile `useNavigationPlateau`) :
  // carnets/clubs/groupes vivent sur leurs vraies routes ; seuls
  // fil/evenements/entraide restent des états `?tab=` du hub.
  const handleTabSelect = (tab: CommunityHubTab) => {
    setActiveTab(tab);
    if (tab === 'carnets') {
      router.push('/carnets');
    } else if (tab === 'clubs') {
      router.push('/clubs');
    } else if (tab === 'groupes') {
      router.push('/groupes');
    } else {
      router.push(`/communaute?tab=${tab}`);
    }
  };

  // Data States — uniquement alimentés par le serveur (aucune donnée fictive).
  const [posts, setPosts] = useState<any[]>([]);
  const [carnets, setCarnets] = useState<any[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinedEventIds, setJoinedEventIds] = useState<Record<string, boolean>>({});

  const handleJoinEvent = useCallback(
    async (eventId: string | number) => {
      if (!user) {
        router.push('/connexion');
        return;
      }
      const supabase = createClient();
      const { error } = await supabase
        .from('event_participants')
        .upsert(
          { event_id: eventId, user_id: user.id },
          { onConflict: 'event_id,user_id', ignoreDuplicates: true }
        );
      if (!error) {
        setJoinedEventIds((prev) => ({ ...prev, [String(eventId)]: true }));
      }
    },
    [user, router]
  );

  // Filters
  const [carnetFilterCategory, setCarnetFilterCategory] = useState('all');
  const [carnetSearchQuery, setCarnetSearchQuery] = useState('');
  const [clubFilterTab, setClubFilterTab] = useState<'all' | 'activite' | 'pays' | 'my_clubs'>('all');
  const [clubSearchQuery, setClubSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    const supabase = createClient();

    try {
      // Parallel fetch — la page n'affiche QUE des données serveur.
      const [postsRes, carnetsRes, clubsRes, groupsRes, eventsRes] = await Promise.allSettled([
        supabase
          .from('community_posts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('carnets')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('clubs').select('*').order('members_count', { ascending: false }),
        supabase.from('groupes').select('*').limit(20),
        supabase
          .from('events')
          .select('*')
          .neq('status', 'past')
          .gte('event_date', new Date().toISOString().split('T')[0])
          .order('event_date', { ascending: true })
          .limit(20),
      ]);

      const postsData = postsRes.status === 'fulfilled' ? (postsRes.value.data ?? []) : [];
      const carnetsData = carnetsRes.status === 'fulfilled' ? (carnetsRes.value.data ?? []) : [];
      const clubsData = clubsRes.status === 'fulfilled' ? (clubsRes.value.data ?? []) : [];
      const groupsData = groupsRes.status === 'fulfilled' ? (groupsRes.value.data ?? []) : [];
      const rawEvents = eventsRes.status === 'fulfilled' ? (eventsRes.value.data ?? []) : [];
      const seenEventIds = new Set<string>();
      const eventsData = rawEvents.filter((ev: any) => {
        const key = String(ev.id || `${ev.title}_${ev.event_date}`);
        if (seenEventIds.has(key)) return false;
        seenEventIds.add(key);
        return true;
      });

      // F1 — auteurs via la vue `public_profiles` (deux étapes, jamais d'embed).
      const authorProfiles = await fetchPublicProfilesWith(supabase, [
        ...postsData.map((p: any) => p.author_id as string),
        ...carnetsData.map((c: any) => c.author_id as string),
        ...eventsData.map((e: any) => e.organizer_id as string),
      ]);
      const withAuthor = <T extends { author_id?: string | null }>(row: T) => {
        const profile = row.author_id ? authorProfiles[row.author_id] : undefined;
        return {
          ...row,
          author: profile
            ? {
                id: profile.id,
                full_name: profile.full_name,
                avatar_url: profile.avatar_url,
                loyalty_level: profile.loyalty_level,
              }
            : undefined,
        };
      };

      setPosts(postsData.map(withAuthor));
      setCarnets(carnetsData.map(withAuthor));
      setClubs(clubsData);
      setGroups(groupsData);
      setEvents(
        eventsData.map((ev: any) => {
          const organizer = ev.organizer_id ? authorProfiles[ev.organizer_id] : undefined;
          return {
            ...ev,
            date: formatEventDate(ev.event_date),
            participants: ev.current_participants ?? 0,
            maxParticipants: ev.max_participants ?? 0,
            guide: organizer?.full_name || null,
          };
        })
      );
    } catch (err) {
      console.error('[CommunautePage] Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredCarnets = useMemo(() => {
    return carnets.filter((c) => {
      if (carnetFilterCategory !== 'all') {
        const dest = (c.destination || '').toLowerCase();
        const tags = (c.tags || []).join(' ').toLowerCase();
        if (!dest.includes(carnetFilterCategory.toLowerCase()) && !tags.includes(carnetFilterCategory.toLowerCase())) {
          return false;
        }
      }
      if (carnetSearchQuery.trim()) {
        const q = carnetSearchQuery.toLowerCase();
        const matchTitle = (c.title || '').toLowerCase().includes(q);
        const matchDest = (c.destination || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDest) return false;
      }
      return true;
    });
  }, [carnets, carnetFilterCategory, carnetSearchQuery]);

  const filteredClubs = useMemo(() => {
    return clubs.filter((c) => {
      const name = (c.name || c.title || '').toLowerCase();
      const desc = (c.description || '').toLowerCase();
      if (clubFilterTab === 'activite' && (c.type || '').toLowerCase() !== 'activité') return false;
      if (clubFilterTab === 'pays' && (c.type || '').toLowerCase() !== 'pays') return false;
      if (clubFilterTab === 'my_clubs' && !c.is_member) return false;
      if (clubSearchQuery.trim()) {
        const q = clubSearchQuery.toLowerCase();
        if (!name.includes(q) && !desc.includes(q)) return false;
      }
      return true;
    });
  }, [clubs, clubFilterTab, clubSearchQuery]);

  return (
    <div className="relative min-h-screen font-sans text-[color:var(--lkv-primary)] selection:bg-[color:var(--lkv-primary)]/10 md:h-dvh md:overflow-hidden">
      {/* Background immersif végétal / canopée */}
      <CompteBackground />

      {/* ══════════════════════════════════════════════════════════════════════
          1. VERSION MOBILE (block md:hidden)
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="block min-h-screen md:hidden">
        {/* safeTop=false: MobileCommunityHeader embarque son propre header sticky
            (safe-area top gérée par le composant, cf. MobileCommunityHeader.tsx) */}
        <MobilePageShell videoBackground={true} safeTop={false}>
          <MobileCommunityHub
            posts={posts}
            carnets={filteredCarnets}
            clubs={filteredClubs}
            groups={groups}
            events={events}
            activeTab={activeTab as any}
            onTabChange={(tab) => handleTabSelect(tab as any)}
            loading={loading}
            user={user}
            onRefresh={fetchData}
            joinedEventIds={joinedEventIds}
            onJoinEvent={handleJoinEvent}
          />
        </MobilePageShell>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          2. VERSION DESKTOP COCKPIT 3 COLONNES FULLSCREEN (hidden md:flex)
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="hidden h-full flex-col overflow-hidden md:flex">
        {/* Global Site Header */}
        <Header />

        {/* Main 3-Column Cockpit Container */}
        <div className="mx-auto w-full max-w-[1680px] flex-1 overflow-hidden px-4 pb-5 pt-24 sm:px-6 sm:pt-[96px] lg:px-8">
          <div className="flex h-full items-start gap-6">

            {/* LEFT COLUMN: NAVIGATION SIDEBAR (280px) */}
            <div className="h-full w-[280px] shrink-0 overflow-hidden">
              <CommunityLeftSidebar
                activeTab={activeTab}
                onTabChange={handleTabSelect}
                badgeCounts={{
                  fil: posts.length,
                  carnets: carnets.length,
                  clubs: clubs.length,
                  groupes: groups.length,
                  evenements: events.length,
                }}
                onFilterMassif={(m) => setCarnetFilterCategory(m)}
              />
            </div>

            {/* CENTER COLUMN: MAIN TAB CONTENT */}
            <main className="no-scrollbar h-full flex-1 space-y-[var(--space-6)] overflow-y-auto px-1">
              {/* HERO BANNER COMMUNAUTÉ */}
              <CommunityHeroOverview
                carnetsCount={carnets.length}
                clubsCount={clubs.length}
                groupsCount={groups.length}
                onNavigateTab={handleTabSelect}
              />

              {/* LIVE EXPLORER STORIES BAR */}
              <Card variant="featured" className="p-[var(--space-3)]">
                <CommunityStoriesBar currentUser={user} />
              </Card>

              {/* DÉCOUVERTE LIGNÉES (Lot 7) — ce qui revient du terrain + lignées endurantes */}
              {activeTab === 'fil' && (
                <Card variant="featured" className="p-[var(--space-4)]">
                  <LineageDiscovery />
                </Card>
              )}

              {/* ONGLET 1: FIL D'ACTUALITÉ */}
              {activeTab === 'fil' && (
                <div className="space-y-[var(--space-4)]">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="font-display text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-primary)]">
                      Derniers échos des sentiers
                    </h3>
                    <Badge tone="stone" className="font-mono">
                      {posts.length} publications
                    </Badge>
                  </div>

                  <div className="space-y-[var(--space-4)]">
                    {posts.map((post, i) => (
                      <CommunityPostCard key={post.id || i} post={post} user={user} />
                    ))}
                    {!loading && posts.length === 0 && (
                      <Card className="text-center">
                        <EmptyState
                          icon={<span className="text-3xl">🌲</span>}
                          title="Le fil est calme"
                          description="Aucune publication pour le moment. Partagez votre première sortie."
                        />
                      </Card>
                    )}
                  </div>
                </div>
              )}

              {/* ONGLET 2: CARNETS DE VOYAGE */}
              {activeTab === 'carnets' && (
                <div className="space-y-[var(--space-4)]">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    {/* P2 — fade iOS en fin de rail filtres */}
                    <div className="no-scrollbar flex gap-[var(--space-1)] overflow-x-auto rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn p-1 pr-[28px] [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] [-webkit-mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]">
                      {[
                        { id: 'all', label: 'Tous' },
                        { id: 'Trek', label: '🏔️ Trek' },
                        { id: 'Bivouac', label: '🏕️ Bivouac' },
                        { id: 'Kayak', label: '🚣 Kayak' },
                        { id: 'Van Life', label: '🚐 Van Life' },
                        { id: 'Vélo', label: '🚵 Vélo' },
                      ].map((cat) => (
                        <Chip
                          key={cat.id}
                          selected={carnetFilterCategory === cat.id}
                          onClick={() => setCarnetFilterCategory(cat.id)}
                          className="whitespace-nowrap"
                        >
                          {cat.label}
                        </Chip>
                      ))}
                    </div>

                    <SearchField
                      containerClassName="w-full sm:w-64"
                      value={carnetSearchQuery}
                      onChange={(e) => setCarnetSearchQuery(e.target.value)}
                      onClear={() => setCarnetSearchQuery('')}
                      placeholder="Rechercher un récit ou massif..."
                      aria-label="Rechercher un récit ou un massif"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-[var(--space-4)] sm:grid-cols-2">
                    {filteredCarnets.map((carnet, i) => (
                      <CarnetHubCard key={carnet.id || i} carnet={carnet} currentUserId={user?.id} />
                    ))}
                  </div>
                  {!loading && filteredCarnets.length === 0 && (
                    <Card className="text-center">
                      <EmptyState
                        icon={<span className="text-3xl">📖</span>}
                        title="Aucun carnet publié"
                        description="Les carnets apparaissent ici une fois partagés explicitement par leurs auteurs."
                      />
                    </Card>
                  )}
                </div>
              )}

              {/* ONGLET 3: CLUBS & COLLECTIFS */}
              {activeTab === 'clubs' && (
                <div className="space-y-[var(--space-4)]">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    {/* P2 — fade iOS en fin de rail filtres */}
                    <div className="no-scrollbar flex gap-[var(--space-1)] overflow-x-auto rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn p-1 pr-[28px] [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] [-webkit-mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]">
                      {[
                        { id: 'all', label: 'Tous les clubs' },
                        { id: 'activite', label: '🎯 Par Activité' },
                        { id: 'pays', label: '🌍 Par Massif' },
                        { id: 'my_clubs', label: '⭐ Mes Clubs' },
                      ].map((tb) => (
                        <Chip
                          key={tb.id}
                          selected={clubFilterTab === tb.id}
                          onClick={() => setClubFilterTab(tb.id as any)}
                          className="whitespace-nowrap"
                        >
                          {tb.label}
                        </Chip>
                      ))}
                    </div>

                    <SearchField
                      containerClassName="w-full sm:w-64"
                      value={clubSearchQuery}
                      onChange={(e) => setClubSearchQuery(e.target.value)}
                      onClear={() => setClubSearchQuery('')}
                      placeholder="Rechercher un club..."
                      aria-label="Rechercher un club"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-[var(--space-4)] sm:grid-cols-2">
                    {filteredClubs.map((club, i) => {
                      const clubName = club.name || club.title || 'Club';
                      const clubDesc = club.description || club.slogan || '';
                      const cover = club.coverImage || club.cover_image || '';
                      const slug = club.slug || club.id || `club-${i}`;

                      return (
                        <Link key={club.id || i} href={`/clubs/${slug}`} className="block">
                          <Card
                            variant="interactive"
                            className="flex h-full flex-col justify-between overflow-hidden p-0 transition-transform hover:-translate-y-1"
                          >
                            <div className="relative h-32 overflow-hidden bg-[color:var(--btn-tint)]">
                              {cover ? (
                                <img src={cover} alt={clubName} className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
                              ) : (
                                <div className="flex size-full items-center justify-center text-4xl">{club.emoji || '🏕️'}</div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                              {/* P2 — pastille sombre renforcée (blanc solide ≥11px sur photo) */}
                              {club.category && (
                                <Badge tone="stone" className="absolute bottom-2 left-3 border-0 bg-black/55 font-mono text-[color:var(--lkv-text-inverted)] backdrop-blur-[var(--blur-md)]">
                                  {club.category}
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-1 flex-col justify-between space-y-[var(--space-2)] p-[var(--space-4)]">
                              <div>
                                <h3 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-primary)] transition-colors">
                                  {clubName}
                                </h3>
                                {clubDesc && (
                                  <p className="mt-[var(--space-1)] line-clamp-2 text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
                                    {clubDesc}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center justify-between border-t border-[color:var(--lkv-border)] pt-[var(--space-2)] text-[length:var(--lkv-text-caption)]">
                                <span className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                                  👥 {club.members_count ?? 0} membres
                                </span>
                                <Badge tone="sage">Rejoindre →</Badge>
                              </div>
                            </div>
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                  {!loading && filteredClubs.length === 0 && (
                    <Card className="text-center">
                      <EmptyState
                        icon={<span className="text-3xl">🏔️</span>}
                        title="Aucun club pour le moment"
                        description="Les collectifs créés apparaîtront ici."
                      />
                    </Card>
                  )}
                </div>
              )}

              {/* ONGLET 4: GROUPES D'EXPÉDITION */}
              {activeTab === 'groupes' && (
                <div className="space-y-[var(--space-4)]">
                  <div className="flex items-center justify-between gap-[var(--space-3)]">
                    <div>
                      <h3 className="font-display text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-primary)]">
                        Expéditions en formation
                      </h3>
                      <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
                        Trouvez des équipiers et partagez les préparatifs de bivouac.
                      </p>
                    </div>
                    <Link href="/nouveau-groupe" className="inline-flex shrink-0">
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<Icon name="PlusIcon" size={13} aria-hidden="true" />}
                      >
                        Créer
                      </Button>
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 gap-[var(--space-4)] sm:grid-cols-2">
                    {groups.map((grp, i) => (
                      <Link
                        key={grp.id || i}
                        href={grp.id ? `/groupes/${grp.id}` : '/communaute?tab=groupes'}
                        className="block"
                      >
                        <Card variant="interactive" className="flex h-full flex-col justify-between">
                          <div className="space-y-[var(--space-2)]">
                            <div className="flex items-center justify-between">
                              <span className="text-2xl">{grp.pictogram || '🏕️'}</span>
                              {grp.max_members > 0 && (
                                <Badge tone="stone" className="font-mono">
                                  {grp.max_members} PLACES
                                </Badge>
                              )}
                            </div>
                            <h4 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-primary)] transition-colors">
                              {grp.name}
                            </h4>
                            {grp.description && (
                              <p className="line-clamp-2 text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
                                {grp.description}
                              </p>
                            )}
                          </div>

                          <div className="mt-[var(--space-3)] flex items-center justify-between border-t border-[color:var(--lkv-border)] pt-[var(--space-3)] font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                            <span>📍 {grp.massif || 'Massif non précisé'}</span>
                            <Badge tone="sage">Voir le cockpit →</Badge>
                          </div>
                        </Card>
                      </Link>
                    ))}
                  </div>
                  {!loading && groups.length === 0 && (
                    <Card className="text-center">
                      <EmptyState
                        icon={<span className="text-3xl">⛺</span>}
                        title="Aucune expédition en formation"
                        description="Créez un groupe pour préparer votre prochaine sortie."
                      />
                    </Card>
                  )}
                </div>
              )}

              {/* ONGLET 5: ÉVÉNEMENTS & SORTIES */}
              {activeTab === 'evenements' && (
                <div className="space-y-[var(--space-4)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-primary)]">
                        Calendrier des Sorties Collectives
                      </h3>
                      <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
                        Rejoignez une marche encadrée par des passionnés et des guides locaux.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-[var(--space-3)]">
                    {events.map((ev) => {
                      const joined = joinedEventIds[String(ev.id)];
                      return (
                      <Card key={ev.id} className="flex flex-col justify-between gap-[var(--space-4)] sm:flex-row sm:items-center">
                        <div className="space-y-[var(--space-1)]">
                          <div className="flex items-center gap-[var(--space-2)]">
                            <Badge tone="sage" className="font-mono">
                              {ev.date || 'Date à confirmer'}
                            </Badge>
                            {ev.duration && (
                              <span className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                                ⏱ {ev.duration}
                              </span>
                            )}
                          </div>
                          <h4 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-primary)]">
                            {ev.title}
                          </h4>
                          <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
                            📍 {ev.location || 'Lieu à préciser'}
                            {ev.guide ? <> · Encadré par <strong>{ev.guide}</strong></> : null}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-[var(--space-3)] border-t border-[color:var(--lkv-border)] pt-[var(--space-2)] sm:justify-end sm:border-t-0 sm:pt-0">
                          <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-primary)]">
                            {ev.participants}{ev.maxParticipants > 0 ? `/${ev.maxParticipants}` : ''} inscrits
                          </span>
                          <Button
                            type="button"
                            variant={joined ? 'secondary' : 'primary'}
                            size="sm"
                            disabled={joined}
                            onClick={() => handleJoinEvent(ev.id)}
                          >
                            {joined ? 'Inscrit ✓' : "S'inscrire"}
                          </Button>
                        </div>
                      </Card>
                      );
                    })}
                  </div>
                  {!loading && events.length === 0 && (
                    <Card className="text-center">
                      <EmptyState
                        icon={<span className="text-3xl">📅</span>}
                        title="Aucune sortie programmée"
                        description="Les événements à venir apparaîtront ici."
                      />
                    </Card>
                  )}
                </div>
              )}

              {/* ONGLET 6: ENTRAIDE & Q&A */}
              {activeTab === 'entraide' && (
                <div className="space-y-[var(--space-4)]">
                  <Card className="space-y-[var(--space-3)]">
                    <div className="flex items-center gap-[var(--space-2)]">
                      <span className="text-xl">💡</span>
                      <h3 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-primary)]">
                        Entraide &amp; Questions Terrain
                      </h3>
                    </div>
                    <p className="text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-muted)]">
                      Posez vos questions sur l&apos;état des sentiers, le débit des sources, les conditions d&apos;enneigement et le matériel.
                    </p>
                    <Card variant="compact" tone="sage" className="space-y-[var(--space-1)]">
                      <span className="block font-bold text-[color:var(--lkv-text-primary)]">✓ Réponses validées par les Guides</span>
                      <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                        Chaque information critique sur les sources et passages délicats est vérifiée par les référents du massif.
                      </p>
                    </Card>
                  </Card>
                </div>
              )}
            </main>

            {/* RIGHT COLUMN: SIDEBAR WIDGETS (310px) */}
            <div className="h-full w-[310px] shrink-0 overflow-hidden">
              <CommunityRightSidebar clubs={clubs} events={events} />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default function CommunautePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[color:var(--glass-bg-medium)]">
          <LoadingState label="Chargement du Hub Communauté..." />
        </div>
      }
    >
      <CommunautePageContent />
    </Suspense>
  );
}
