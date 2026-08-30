'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import Header from '@/components/Header';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
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

  // Data States
  const [posts, setPosts] = useState<any[]>([
    {
      id: 'p-1',
      content: '« Traversée des arêtes de Chartreuse bouclée ce matin. Températures parfaites (6°C au lever du jour), sentier sec et vue dégagée sur le Mont-Blanc. Attention, la source sous le col coule très faiblement. »',
      author: { full_name: 'Marceline Chevrier', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200', loyalty_level: 'GUIDE CERTIFIÉE' },
      image_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1000',
      likes_count: 28,
      comments_count: 4,
      created_at: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: 'p-2',
      content: '« Bivouac au lac Achard : nuit claire, voie lactée spectaculaire. Sac de 45L chargé à 8.2 kg avec autonomie 2 jours. Merci aux membres du club pour le conseil sur le filtre ! »',
      author: { full_name: 'Antoine Duprès', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200', loyalty_level: 'MARCHEUR SOLO' },
      image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1000',
      likes_count: 19,
      comments_count: 2,
      created_at: new Date(Date.now() - 14400000).toISOString(),
    },
  ]);

  const [carnets, setCarnets] = useState<any[]>([]);
  const [clubs, setClubs] = useState<any[]>([
    { id: 'c-1', name: 'Cimes partagées', slogan: 'Marcher ensemble en Chartreuse sans se précipiter.', category: 'Randonnée & bivouac', members_count: 48, emoji: '🏔️', cover_image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=600' },
    { id: 'c-2', name: 'Bivouac & Étoiles', slogan: 'Nuits en altitude et photographie nocturne.', category: 'Bivouac sauvage', members_count: 36, emoji: '⛺', cover_image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=600' },
    { id: 'c-3', name: 'Alpinistes du Dauphiné', slogan: 'Courses rocheuses et arêtes alpines.', category: 'Alpinisme', members_count: 29, emoji: '🧗', cover_image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=600' },
  ]);

  const [groups, setGroups] = useState<any[]>([
    { id: 'grp-1', name: 'Traversée de la Chartreuse', description: '3 jours en autonomie sur les crêtes et bivouacs avec nuit en refuge.', massif: 'Chartreuse', max_members: 6, spots_left: 2, pictogram: '⛺' },
    { id: 'grp-2', name: 'Tour des Glaciers de la Vanoise', description: 'Itinérance 5 jours sous les dômes glaciaires.', massif: 'Vanoise', max_members: 8, spots_left: 4, pictogram: '🏔️' },
  ]);

  const [events, setEvents] = useState<any[]>([
    { id: 'ev-1', title: 'Rando bivouac Charmant Som', date: 'Samedi 17 oct. 2026', time: '09h00', location: 'Saint-Pierre-de-Chartreuse', participants: 8, maxParticipants: 12, guide: 'Marceline' },
    { id: 'ev-2', title: 'Atelier Sécurité Bivouac & Cartographie', date: 'Dimanche 25 oct. 2026', time: '10h30', location: 'Grenoble', participants: 15, maxParticipants: 20, guide: 'Antoine' },
  ]);

  // Filters
  const [carnetFilterCategory, setCarnetFilterCategory] = useState('all');
  const [carnetSearchQuery, setCarnetSearchQuery] = useState('');
  const [clubFilterTab, setClubFilterTab] = useState<'all' | 'activite' | 'pays' | 'my_clubs'>('all');
  const [clubSearchQuery, setClubSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    const supabase = createClient();

    try {
      let localCarnets: any[] = [];
      let localClubs: any[] = [];
      let localGroups: any[] = [];
      try {
        localCarnets = JSON.parse(localStorage.getItem('user_carnets_data') || '[]');
        localClubs = JSON.parse(localStorage.getItem('user_created_clubs') || '[]');
        localGroups = JSON.parse(localStorage.getItem('user_created_groups') || '[]');
      } catch {}

      // Parallel fetch for instant loading
      const [postsRes, carnetsRes, clubsRes, groupsRes] = await Promise.allSettled([
        supabase
          .from('community_posts')
          .select(`*, author:user_profiles!community_posts_author_id_fkey(full_name, avatar_url, loyalty_level)`)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('carnets')
          .select(`*, author:user_profiles!author_id(full_name, avatar_url)`)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('clubs').select('*').order('members_count', { ascending: false }),
        supabase.from('groupes').select('*').limit(20),
      ]);

      if (postsRes.status === 'fulfilled' && postsRes.value.data && postsRes.value.data.length > 0) {
        setPosts(postsRes.value.data);
      }

      if (carnetsRes.status === 'fulfilled') {
        const carnetsData = carnetsRes.value.data || [];
        const allCarnets = [...localCarnets, ...carnetsData];
        if (allCarnets.length > 0) {
          setCarnets(Array.from(new Map(allCarnets.map((c) => [c.id || c.title, c])).values()));
        }
      }

      if (clubsRes.status === 'fulfilled') {
        const clubsData = clubsRes.value.data || [];
        const allClubs = [...localClubs, ...clubsData];
        if (allClubs.length > 0) {
          setClubs(Array.from(new Map(allClubs.map((c) => [c.id || c.name || c.title, c])).values()));
        }
      }

      if (groupsRes.status === 'fulfilled') {
        const groupsData = groupsRes.value.data || [];
        const allGroups = [...localGroups, ...groupsData];
        if (allGroups.length > 0) {
          setGroups(Array.from(new Map(allGroups.map((g) => [g.id || g.name, g])).values()));
        }
      }
    } catch (err) {
      console.error('[CommunautePage] Error loading data:', err);
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
            loading={false}
            user={user}
            onRefresh={fetchData}
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
                      const clubDesc = club.description || club.slogan || 'Collectif de montagnards';
                      const cover = club.coverImage || club.cover_image || 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=600';
                      const slug = club.slug || club.id || `club-${i}`;

                      return (
                        <Link
                          key={club.id || i}
                          href={`/clubs/${slug}`}
                          className="glass bg-white/90 backdrop-blur-xl rounded-2xl overflow-hidden border border-white flex flex-col justify-between group hover:-translate-y-1 hover:shadow-xl transition-all"
                        >
                          <div className="h-32 relative bg-[#17402C] overflow-hidden">
                            <img src={cover} alt={clubName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                            <span className="absolute bottom-2 left-3 px-2.5 py-0.5 bg-black/40 backdrop-blur-md rounded-full text-[9px] font-mono text-white font-bold">
                              {club.category || 'Randonnée'}
                            </span>
                          </div>
                          <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                            <div>
                              <h3 className="font-display font-bold text-base text-[#17402C] group-hover:text-emerald-800 transition-colors">
                                {clubName}
                              </h3>
                              <p className="text-xs text-[#5C6B5E] line-clamp-2 mt-1">
                                {clubDesc}
                              </p>
                            </div>
                            <div className="pt-2 border-t border-[#17402C]/10 flex items-center justify-between text-xs">
                              <span className="text-[10px] font-mono text-[#5C6B5E]">
                                👥 {club.members_count || 12} membres
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
                        href={`/groupes/${grp.id || 'grp-1'}`}
                        className="glass bg-white/90 backdrop-blur-xl rounded-2xl p-5 border border-white hover:shadow-xl transition-all group flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-2xl">{grp.pictogram || '⛺'}</span>
                            <span className="glass-pill text-[9px] font-mono font-bold text-[#17402C]">
                              {grp.max_members || 6} PLACES
                            </span>
                          </div>
                          <h4 className="font-display font-bold text-base text-[#17402C] group-hover:text-emerald-800 transition-colors">
                            {grp.name || 'Expédition Chartreuse'}
                          </h4>
                          <p className="text-xs text-[#5C6B5E] line-clamp-2">
                            {grp.description || '3 jours de traversée sur les crêtes.'}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-[#17402C]/10 flex items-center justify-between text-[10px] font-mono text-[#5C6B5E] mt-3">
                          <span>📍 {grp.massif || 'Chartreuse'}</span>
                          <span className="glass-capsule-btn text-[10.5px] font-bold !py-1 !px-2.5">
                            Voir le cockpit →
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
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
                    {events.map((ev) => (
                      <div key={ev.id} className="glass bg-white/90 backdrop-blur-xl p-5 rounded-2xl border border-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="bg-[#17402C] text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded">
                              {ev.date}
                            </span>
                            <span className="text-[10px] font-mono text-[#5C6B5E]">
                              ⏰ {ev.time}
                            </span>
                          </div>
                          <h4 className="font-display font-bold text-base text-[#17402C]">
                            {ev.title}
                          </h4>
                          <p className="text-xs text-[#5C6B5E]">
                            📍 {ev.location} · Encadré par <strong>{ev.guide}</strong>
                          </p>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#17402C]/10">
                          <span className="text-[10px] font-mono font-bold text-emerald-800">
                            {ev.participants}/{ev.maxParticipants} inscrits
                          </span>
                          <button
                            onClick={() => alert(`Inscription enregistrée pour "${ev.title}" !`)}
                            className="glass-capsule-btn primary text-[10.5px] font-bold !py-1 !px-3"
                          >
                            S'inscrire
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
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
                    <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/60 text-xs text-[#17402C] space-y-1">
                      <span className="font-bold block">✓ Réponses validées par les Guides</span>
                      <p className="text-[11px] text-[#5C6B5E]">Chaque information critique sur les sources et passages délicats est vérifiée par les référents du massif.</p>
                    </div>
                  </div>
                </div>
              )}
            </main>

            {/* RIGHT COLUMN: SIDEBAR WIDGETS (310px) */}
            <div className="w-[310px] shrink-0 h-full overflow-hidden">
              <CommunityRightSidebar />
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
