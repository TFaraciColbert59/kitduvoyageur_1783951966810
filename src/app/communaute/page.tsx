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
import CommunityHeroOverview from '@/components/communaute/CommunityHeroOverview';
import CommunityRightSidebar from '@/components/communaute/CommunityRightSidebar';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import MobileCommunityHub from '@/components/communaute/MobileCommunityHub';
import CommunityPostCard from '@/components/communaute/CommunityPostCard';
import LineageDiscovery from '@/components/kits/LineageDiscovery';

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

  const handleTabSelect = (tab: CommunityHubTab) => {
    setActiveTab(tab);
    router.push(`/communaute?tab=${tab}`);
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
          .order('event_date', { ascending: true })
          .limit(20),
      ]);

      const postsData = postsRes.status === 'fulfilled' ? (postsRes.value.data ?? []) : [];
      const carnetsData = carnetsRes.status === 'fulfilled' ? (carnetsRes.value.data ?? []) : [];
      const clubsData = clubsRes.status === 'fulfilled' ? (clubsRes.value.data ?? []) : [];
      const groupsData = groupsRes.status === 'fulfilled' ? (groupsRes.value.data ?? []) : [];
      const eventsData = eventsRes.status === 'fulfilled' ? (eventsRes.value.data ?? []) : [];

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
    <div className="min-h-screen md:h-dvh md:overflow-hidden text-[#17402C] selection:bg-[#17402C]/10 font-sans relative">
      {/* Background immersif végétal / canopée */}
      <CompteBackground />

      {/* ══════════════════════════════════════════════════════════════════════
          1. VERSION MOBILE (block md:hidden)
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="block md:hidden min-h-screen">
        {/* safeTop=false: MobileCommunityHeader embarque son propre header sticky (MobileCommunityHeader.tsx:24)
            qui calcule pt-[calc(max(env(safe-area-inset-top,0px),10px)+6px)] */}
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
      <div className="hidden md:flex flex-col h-full overflow-hidden">
        {/* Global Site Header */}
        <Header />

        {/* Main 3-Column Cockpit Container */}
        <div className="flex-1 overflow-hidden pt-24 sm:pt-[96px] pb-5 px-4 sm:px-6 lg:px-8 max-w-[1680px] w-full mx-auto">
          <div className="flex items-start gap-6 h-full">

            {/* LEFT COLUMN: NAVIGATION SIDEBAR (280px) */}
            <div className="w-[280px] shrink-0 h-full overflow-hidden">
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
            <main className="flex-1 h-full overflow-y-auto no-scrollbar space-y-6 px-1">
              {/* HERO BANNER COMMUNAUTÉ */}
              <CommunityHeroOverview
                carnetsCount={carnets.length}
                clubsCount={clubs.length}
                groupsCount={groups.length}
                onNavigateTab={handleTabSelect}
              />

              {/* LIVE EXPLORER STORIES BAR */}
              <div className="glass rounded-[1.5rem] p-3.5 border border-white/50 shadow-xs">
                <CommunityStoriesBar currentUser={user} />
              </div>

              {/* DÉCOUVERTE LIGNÉES (Lot 7) — ce qui revient du terrain + lignées endurantes */}
              {activeTab === 'fil' && (
                <div className="glass rounded-[1.5rem] p-4 border border-white/50 shadow-xs">
                  <LineageDiscovery />
                </div>
              )}

              {/* ONGLET 1: FIL D'ACTUALITÉ */}
              {activeTab === 'fil' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="font-display font-bold text-lg text-[#17402C]">
                      Derniers échos des sentiers
                    </h3>
                    <span className="glass-pill text-[9.5px] font-mono font-bold text-[#5B7F55]">
                      {posts.length} publications
                    </span>
                  </div>

                  <div className="space-y-4">
                    {posts.map((post, i) => (
                      <CommunityPostCard key={post.id || i} post={post} user={user} />
                    ))}
                    {!loading && posts.length === 0 && (
                      <div className="glass bg-white/90 rounded-2xl p-10 border border-white text-center space-y-2">
                        <span className="text-3xl block">🌲</span>
                        <h4 className="font-display font-bold text-sm text-[#17402C]">Le fil est calme</h4>
                        <p className="text-xs text-[#5C6B5E]">
                          Aucune publication pour le moment. Partagez votre première sortie.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ONGLET 2: CARNETS DE VOYAGE */}
              {activeTab === 'carnets' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex bg-white/80 p-1 rounded-full border border-[#17402C]/10 overflow-x-auto gap-1">
                      {[
                        { id: 'all', label: 'Tous' },
                        { id: 'Trek', label: '🏔️ Trek' },
                        { id: 'Bivouac', label: '🏕️ Bivouac' },
                        { id: 'Kayak', label: '🚣 Kayak' },
                        { id: 'Van Life', label: '🚐 Van Life' },
                        { id: 'Vélo', label: '🚵 Vélo' },
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => setCarnetFilterCategory(cat.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                            carnetFilterCategory === cat.id
                              ? 'bg-[#17402C] text-white shadow-xs'
                              : 'text-[#5C6B5E] hover:text-[#17402C]'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative w-full sm:w-64">
                      <input
                        type="text"
                        value={carnetSearchQuery}
                        onChange={(e) => setCarnetSearchQuery(e.target.value)}
                        placeholder="Rechercher un récit ou massif..."
                        className="w-full bg-white/90 border border-[#17402C]/15 rounded-full px-3.5 py-1.5 text-xs text-[#17402C] focus:outline-none focus:ring-1 focus:ring-[#17402C]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filteredCarnets.map((carnet, i) => (
                      <CarnetHubCard key={carnet.id || i} carnet={carnet} currentUserId={user?.id} />
                    ))}
                  </div>
                  {!loading && filteredCarnets.length === 0 && (
                    <div className="glass bg-white/90 rounded-2xl p-10 border border-white text-center space-y-2">
                      <span className="text-3xl block">📖</span>
                      <h4 className="font-display font-bold text-sm text-[#17402C]">Aucun carnet publié</h4>
                      <p className="text-xs text-[#5C6B5E]">
                        Les carnets apparaissent ici une fois partagés explicitement par leurs auteurs.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ONGLET 3: CLUBS & COLLECTIFS */}
              {activeTab === 'clubs' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex bg-white/80 p-1 rounded-full border border-[#17402C]/10 overflow-x-auto gap-1">
                      {[
                        { id: 'all', label: 'Tous les clubs' },
                        { id: 'activite', label: '🎯 Par Activité' },
                        { id: 'pays', label: '🌍 Par Massif' },
                        { id: 'my_clubs', label: '⭐ Mes Clubs' },
                      ].map((tb) => (
                        <button
                          key={tb.id}
                          onClick={() => setClubFilterTab(tb.id as any)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                            clubFilterTab === tb.id
                              ? 'bg-[#17402C] text-white shadow-xs'
                              : 'text-[#5C6B5E] hover:text-[#17402C]'
                          }`}
                        >
                          {tb.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative w-full sm:w-64">
                      <input
                        type="text"
                        value={clubSearchQuery}
                        onChange={(e) => setClubSearchQuery(e.target.value)}
                        placeholder="Rechercher un club..."
                        className="w-full bg-white/90 border border-[#17402C]/15 rounded-full px-3.5 py-1.5 text-xs text-[#17402C] focus:outline-none focus:ring-1 focus:ring-[#17402C]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filteredClubs.map((club, i) => {
                      const clubName = club.name || club.title || 'Club';
                      const clubDesc = club.description || club.slogan || '';
                      const cover = club.coverImage || club.cover_image || '';
                      const slug = club.slug || club.id || `club-${i}`;

                      return (
                        <Link
                          key={club.id || i}
                          href={`/clubs/${slug}`}
                          className="glass bg-white/90 backdrop-blur-xl rounded-2xl overflow-hidden border border-white flex flex-col justify-between group hover:-translate-y-1 hover:shadow-xl transition-all"
                        >
                          <div className="h-32 relative bg-[#17402C] overflow-hidden">
                            {cover ? (
                              <img src={cover} alt={clubName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-4xl">{club.emoji || '🏕️'}</div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                            {club.category && (
                              <span className="absolute bottom-2 left-3 px-2.5 py-0.5 bg-black/40 backdrop-blur-md rounded-full text-[9px] font-mono text-white font-bold">
                                {club.category}
                              </span>
                            )}
                          </div>
                          <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                            <div>
                              <h3 className="font-display font-bold text-base text-[#17402C] group-hover:text-forest-800 transition-colors">
                                {clubName}
                              </h3>
                              {clubDesc && (
                                <p className="text-xs text-[#5C6B5E] line-clamp-2 mt-1">
                                  {clubDesc}
                                </p>
                              )}
                            </div>
                            <div className="pt-2 border-t border-[#17402C]/10 flex items-center justify-between text-xs">
                              <span className="text-[10px] font-mono text-[#5C6B5E]">
                                👥 {club.members_count ?? 0} membres
                              </span>
                              <span className="glass-capsule-btn text-[10.5px] font-bold !py-1 !px-2.5">
                                Rejoindre →
                              </span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                  {!loading && filteredClubs.length === 0 && (
                    <div className="glass bg-white/90 rounded-2xl p-10 border border-white text-center space-y-2">
                      <span className="text-3xl block">🏔️</span>
                      <h4 className="font-display font-bold text-sm text-[#17402C]">Aucun club pour le moment</h4>
                      <p className="text-xs text-[#5C6B5E]">Les collectifs créés apparaîtront ici.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ONGLET 4: GROUPES D'EXPÉDITION */}
              {activeTab === 'groupes' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-display font-bold text-lg text-[#17402C]">Expéditions en formation</h3>
                      <p className="text-xs text-[#5C6B5E]">Trouvez des équipiers et partagez les préparatifs de bivouac.</p>
                    </div>
                    <Link
                      href="/nouveau-groupe"
                      className="glass-capsule-btn primary text-xs font-bold !py-1.5 !px-3.5 flex items-center gap-1.5"
                    >
                      <Icon name="PlusIcon" size={13} />
                      <span>Créer</span>
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {groups.map((grp, i) => (
                      <Link
                        key={grp.id || i}
                        href={grp.id ? `/groupes/${grp.id}` : '/communaute?tab=groupes'}
                        className="glass bg-white/90 backdrop-blur-xl rounded-2xl p-5 border border-white hover:shadow-xl transition-all group flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-2xl">{grp.pictogram || '🏕️'}</span>
                            {grp.max_members > 0 && (
                              <span className="glass-pill text-[9px] font-mono font-bold text-[#17402C]">
                                {grp.max_members} PLACES
                              </span>
                            )}
                          </div>
                          <h4 className="font-display font-bold text-base text-[#17402C] group-hover:text-forest-800 transition-colors">
                            {grp.name}
                          </h4>
                          {grp.description && (
                            <p className="text-xs text-[#5C6B5E] line-clamp-2">
                              {grp.description}
                            </p>
                          )}
                        </div>

                        <div className="pt-3 border-t border-[#17402C]/10 flex items-center justify-between text-[10px] font-mono text-[#5C6B5E] mt-3">
                          <span>📍 {grp.massif || 'Massif non précisé'}</span>
                          <span className="glass-capsule-btn text-[10.5px] font-bold !py-1 !px-2.5">
                            Voir le cockpit →
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                  {!loading && groups.length === 0 && (
                    <div className="glass bg-white/90 rounded-2xl p-10 border border-white text-center space-y-2">
                      <span className="text-3xl block">⛺</span>
                      <h4 className="font-display font-bold text-sm text-[#17402C]">Aucune expédition en formation</h4>
                      <p className="text-xs text-[#5C6B5E]">Créez un groupe pour préparer votre prochaine sortie.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ONGLET 5: ÉVÉNEMENTS & SORTIES */}
              {activeTab === 'evenements' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-display font-bold text-lg text-[#17402C]">Calendrier des Sorties Collectives</h3>
                      <p className="text-xs text-[#5C6B5E]">Rejoignez une marche encadrée par des passionnés et des guides locaux.</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {events.map((ev) => {
                      const joined = joinedEventIds[String(ev.id)];
                      return (
                      <div key={ev.id} className="glass bg-white/90 backdrop-blur-xl p-5 rounded-2xl border border-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="bg-[#17402C] text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded">
                              {ev.date || 'Date à confirmer'}
                            </span>
                            {ev.duration && (
                              <span className="text-[10px] font-mono text-[#5C6B5E]">
                                ⏱ {ev.duration}
                              </span>
                            )}
                          </div>
                          <h4 className="font-display font-bold text-base text-[#17402C]">
                            {ev.title}
                          </h4>
                          <p className="text-xs text-[#5C6B5E]">
                            📍 {ev.location || 'Lieu à préciser'}
                            {ev.guide ? <> · Encadré par <strong>{ev.guide}</strong></> : null}
                          </p>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#17402C]/10">
                          <span className="text-[10px] font-mono font-bold text-forest-800">
                            {ev.participants}{ev.maxParticipants > 0 ? `/${ev.maxParticipants}` : ''} inscrits
                          </span>
                          <button
                            onClick={() => handleJoinEvent(ev.id)}
                            disabled={joined}
                            className="glass-capsule-btn primary text-[10.5px] font-bold !py-1 !px-3 disabled:opacity-60"
                          >
                            {joined ? 'Inscrit ✓' : "S'inscrire"}
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                  {!loading && events.length === 0 && (
                    <div className="glass bg-white/90 rounded-2xl p-10 border border-white text-center space-y-2">
                      <span className="text-3xl block">📅</span>
                      <h4 className="font-display font-bold text-sm text-[#17402C]">Aucune sortie programmée</h4>
                      <p className="text-xs text-[#5C6B5E]">Les événements à venir apparaîtront ici.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ONGLET 6: ENTRAIDE & Q&A */}
              {activeTab === 'entraide' && (
                <div className="space-y-4">
                  <div className="glass bg-white/90 rounded-2xl p-5 border border-white space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">💡</span>
                      <h3 className="font-display font-bold text-base text-[#17402C]">Entraide &amp; Questions Terrain</h3>
                    </div>
                    <p className="text-xs text-[#5C6B5E] leading-relaxed">
                      Posez vos questions sur l&apos;état des sentiers, le débit des sources, les conditions d&apos;enneigement et le matériel.
                    </p>
                    <div className="p-3.5 rounded-xl bg-forest-50/80 border border-forest-200/60 text-xs text-[#17402C] space-y-1">
                      <span className="font-bold block">✓ Réponses validées par les Guides</span>
                      <p className="text-[11px] text-[#5C6B5E]">Chaque information critique sur les sources et passages délicats est vérifiée par les référents du massif.</p>
                    </div>
                  </div>
                </div>
              )}
            </main>

            {/* RIGHT COLUMN: SIDEBAR WIDGETS (310px) */}
            <div className="w-[310px] shrink-0 h-full overflow-hidden">
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
    <Suspense fallback={<div className="min-h-screen bg-[#17402C] flex items-center justify-center text-white text-xs font-mono">Chargement du Hub Communauté...</div>}>
      <CommunautePageContent />
    </Suspense>
  );
}
