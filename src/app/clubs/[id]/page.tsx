'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Club {
  id: string;
  slug: string;
  name: string;
  type: 'activité' | 'pays';
  emoji: string;
  description: string;
  cover_color: string;
  category: string;
  rules: string;
  privacy: 'open' | 'closed' | 'secret';
  members_count: number;
  active_this_month: number;
  is_verified: boolean;
  created_by: string;
  created_at?: string;
}

interface ClubTopic {
  id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  is_announcement: boolean;
  likes_count: number;
  replies_count: number;
  created_at: string;
  author?: { full_name: string };
}

interface ClubMember {
  id: string;
  user_id: string;
  role: 'admin' | 'moderator' | 'member';
  joined_at: string;
  user?: { full_name: string; trust_score: number };
}

interface ClubEvent {
  id: string;
  title: string;
  description: string;
  event_date: string | null;
  location: string;
  max_participants: number;
  participants_count: number;
}

// ─── Fake clubs data ──────────────────────────────────────────────────────────
const FAKE_CLUBS: Club[] = [
  {
    id: 'fake-club-1',
    slug: 'club-himalaya-trek',
    name: 'Himalaya Trek Club',
    type: 'activité',
    emoji: '🏔️',
    description: 'Le club dédié aux passionnés de trekking en Himalaya. Partagez vos expériences, préparez vos expéditions et trouvez des compagnons de cordée pour vos prochaines aventures en altitude.',
    cover_color: 'from-blue-600 to-indigo-800',
    category: 'Trekking haute altitude',
    rules: 'Respect mutuel, partage d\'expériences authentiques, pas de publicité commerciale. Les récits doivent être basés sur des expériences réelles.',
    privacy: 'open',
    members_count: 1247,
    active_this_month: 89,
    is_verified: true,
    created_by: 'fake-user-1',
    created_at: '2025-01-15T10:00:00Z',
  },
  {
    id: 'fake-club-2',
    slug: 'club-gr20-corse',
    name: 'GR20 & Sentiers Corses',
    type: 'pays',
    emoji: '🌿',
    description: 'Communauté des randonneurs passionnés par la Corse et ses sentiers mythiques. Du GR20 aux sentiers côtiers, partagez vos itinéraires, conseils et photos.',
    cover_color: 'from-emerald-600 to-teal-700',
    category: 'Randonnée, Corse',
    rules: 'Partage de bons plans, respect de la nature corse, informations pratiques bienvenues. Langues : français et corse acceptés.',
    privacy: 'open',
    members_count: 634,
    active_this_month: 45,
    is_verified: true,
    created_by: 'fake-user-2',
    created_at: '2025-03-20T14:00:00Z',
  },
  {
    id: 'fake-club-3',
    slug: 'club-ultralight',
    name: 'Ultralight Backpacking France',
    type: 'activité',
    emoji: '⚖️',
    description: 'Le club des randonneurs ultralight francophones. Optimisation du poids du sac, matériaux innovants, techniques de bivouac minimaliste. Partagez vos setups et pesées !',
    cover_color: 'from-amber-600 to-orange-700',
    category: 'Ultralight, Équipement',
    rules: 'Discussions techniques bienvenues, partage de pesées et setups, pas de jugement sur les choix d\'équipement. Bonne humeur obligatoire !',
    privacy: 'open',
    members_count: 892,
    active_this_month: 112,
    is_verified: false,
    created_by: 'fake-user-3',
    created_at: '2025-02-10T09:00:00Z',
  },
  {
    id: 'fake-club-4',
    slug: 'club-islande-aventure',
    name: 'Islande Aventure',
    type: 'pays',
    emoji: '🌋',
    description: 'Tout sur l\'Islande : trekking dans les Hautes Terres, traversée du Laugavegur, aurores boréales, conseils pratiques pour voyager en autonomie dans ce pays magique.',
    cover_color: 'from-cyan-600 to-blue-700',
    category: 'Islande, Aventure',
    rules: 'Partage d\'expériences islandaises, conseils météo et sécurité, respect des règles du Parc National. Informations à jour appréciées.',
    privacy: 'open',
    members_count: 423,
    active_this_month: 38,
    is_verified: false,
    created_by: 'fake-user-4',
    created_at: '2025-04-05T11:00:00Z',
  },
];

const FAKE_TOPICS: ClubTopic[] = [
  { id: 't1', title: 'Retour d\'expérience — Thorong La en mars 2026', content: 'Conditions excellentes cette année, col ouvert dès le 10 mars. Voici mon retour complet avec photos et données GPS.', is_pinned: true, is_announcement: false, likes_count: 47, replies_count: 12, created_at: '2026-07-02T10:00:00Z', author: { full_name: 'Thomas Vernet' } },
  { id: 't2', title: '📢 Expédition collective — Manaslu Circuit, octobre 2026', content: 'Nous organisons une expédition collective sur le circuit du Manaslu en octobre. Places limitées à 8 personnes. Contactez-moi si intéressé.', is_pinned: false, is_announcement: true, likes_count: 89, replies_count: 34, created_at: '2026-06-28T14:00:00Z', author: { full_name: 'Marie Dubois' } },
  { id: 't3', title: 'Quel sac de couchage pour -20°C ?', content: 'Je prépare une expédition en hiver au Ladakh. Besoin de conseils sur les sacs de couchage pour températures extrêmes.', is_pinned: false, is_announcement: false, likes_count: 23, replies_count: 18, created_at: '2026-07-05T09:00:00Z', author: { full_name: 'Lucas Martin' } },
  { id: 't4', title: 'Comparatif tentes 4 saisons — test terrain', content: 'J\'ai testé 5 tentes 4 saisons sur le circuit des Annapurnas. Voici mon comparatif détaillé avec notes et photos.', is_pinned: false, is_announcement: false, likes_count: 61, replies_count: 9, created_at: '2026-07-08T16:00:00Z', author: { full_name: 'Sophie Laurent' } },
];

const FAKE_MEMBERS: ClubMember[] = [
  { id: 'm1', user_id: 'u1', role: 'admin', joined_at: '2025-01-15T10:00:00Z', user: { full_name: 'Thomas Vernet', trust_score: 94 } },
  { id: 'm2', user_id: 'u2', role: 'moderator', joined_at: '2025-02-01T10:00:00Z', user: { full_name: 'Marie Dubois', trust_score: 91 } },
  { id: 'm3', user_id: 'u3', role: 'member', joined_at: '2025-03-10T10:00:00Z', user: { full_name: 'Camille Rousseau', trust_score: 87 } },
  { id: 'm4', user_id: 'u4', role: 'member', joined_at: '2025-04-20T10:00:00Z', user: { full_name: 'Lucas Martin', trust_score: 78 } },
  { id: 'm5', user_id: 'u5', role: 'member', joined_at: '2025-05-15T10:00:00Z', user: { full_name: 'Sophie Laurent', trust_score: 82 } },
];

const FAKE_EVENTS: ClubEvent[] = [
  { id: 'e1', title: 'Sortie collective — Chamonix', description: 'Randonnée d\'une journée autour du Mont-Blanc avec les membres du club. Niveau intermédiaire.', event_date: '2026-08-15T08:00:00Z', location: 'Chamonix, France', max_participants: 12, participants_count: 7 },
  { id: 'e2', title: 'Webinaire — Préparer son trek en Himalaya', description: 'Session en ligne avec Thomas Vernet pour préparer votre premier trek en Himalaya. Questions/réponses incluses.', event_date: '2026-07-25T19:00:00Z', location: 'En ligne (Zoom)', max_participants: 50, participants_count: 38 },
];

type ActiveTab = 'discussions' | 'membres' | 'evenements';

export default function ClubDetailPage() {
  const params = useParams();
  const clubId = params?.id as string;
  const [club, setClub] = useState<Club | null>(null);
  const [topics, setTopics] = useState<ClubTopic[]>([]);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('discussions');
  const [isMember, setIsMember] = useState(false);
  const [joining, setJoining] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    if (!clubId) return;
    const load = async () => {
      setLoading(true);
      // Try Supabase first
      const { data: clubData } = await supabase.from('clubs').select('*').eq('id', clubId).maybeSingle();

      if (clubData) {
        setClub(clubData as Club);
        const [topicsRes, membersRes, eventsRes] = await Promise.all([
          supabase.from('club_topics').select('*, author:user_profiles(full_name)').eq('club_id', clubId).eq('is_approved', true).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(20),
          supabase.from('club_members').select('*, user:user_profiles(full_name, trust_score)').eq('club_id', clubId).eq('status', 'active').limit(20),
          supabase.from('club_events').select('*').eq('club_id', clubId).order('event_date', { ascending: true }).limit(10),
        ]);
        setTopics((topicsRes.data as ClubTopic[]) ?? []);
        setMembers((membersRes.data as ClubMember[]) ?? []);
        setEvents((eventsRes.data as ClubEvent[]) ?? []);

        if (user) {
          const { data: membership } = await supabase.from('club_members').select('id').eq('club_id', clubId).eq('user_id', user.id).eq('status', 'active').maybeSingle();
          setIsMember(!!membership);
        }
      } else {
        // Fallback to fake data
        const fake = FAKE_CLUBS.find((c) => c.id === clubId);
        if (fake) {
          setClub(fake);
          setTopics(FAKE_TOPICS);
          setMembers(FAKE_MEMBERS);
          setEvents(FAKE_EVENTS);
        }
      }
      setLoading(false);
    };
    load();
  }, [clubId, supabase, user]);

  const handleToggleMember = async () => {
    if (!user) { showToast('Connectez-vous pour rejoindre ce club'); return; }
    if (!club || club.id.startsWith('fake-')) { showToast('Fonctionnalité disponible avec un compte'); return; }
    setJoining(true);
    if (isMember) {
      await supabase.from('club_members').delete().eq('club_id', club.id).eq('user_id', user.id);
      setIsMember(false);
      showToast('Vous avez quitté le club');
    } else {
      await supabase.from('club_members').insert({ club_id: club.id, user_id: user.id, role: 'member', status: 'active' });
      setIsMember(true);
      showToast('Bienvenue dans le club !');
    }
    setJoining(false);
  };

  const TABS: { id: ActiveTab; label: string; icon: string; count: number }[] = [
    { id: 'discussions', label: 'Discussions', icon: 'ChatBubbleLeftRightIcon', count: topics.length },
    { id: 'membres', label: 'Membres', icon: 'UsersIcon', count: members.length },
    { id: 'evenements', label: 'Événements', icon: 'CalendarDaysIcon', count: events.length },
  ];

  return (
    <div className="min-h-screen bg-[#F5F2E8]">
      <Header />
      <main className="pt-16">
        {loading ? (
          <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
            <div className="h-48 bg-[#C8C3B0]/30 rounded-2xl animate-pulse" />
            <div className="h-8 w-2/3 bg-[#C8C3B0]/30 rounded animate-pulse" />
          </div>
        ) : !club ? (
          <div className="max-w-4xl mx-auto px-4 py-20 text-center">
            <p className="text-5xl mb-4">🏕️</p>
            <h1 className="font-display font-700 text-2xl text-[#1C2620] mb-2">Club introuvable</h1>
            <p className="text-[#5C6B5E] mb-6">Ce club n&apos;existe pas ou a été supprimé.</p>
            <Link href="/clubs" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#E4501C] text-white rounded-xl text-sm font-700 hover:bg-[#E4501C]/90 transition-colors">
              ← Retour aux clubs
            </Link>
          </div>
        ) : (
          <>
            {/* Club Hero */}
            <div className={`bg-gradient-to-br ${club.cover_color} py-14 px-4 relative overflow-hidden`}>
              <div className="absolute inset-0 opacity-20 pointer-events-none">
                <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white blur-3xl" />
              </div>
              <div className="max-w-4xl mx-auto relative">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <Link href="/clubs" className="flex items-center gap-2 text-white/70 hover:text-white text-sm transition-colors">
                    <Icon name="ArrowLeftIcon" size={14} />
                    Retour aux clubs
                  </Link>
                </div>
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-5xl flex-shrink-0">
                    {club.emoji}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h1 className="font-display font-800 text-white text-3xl">{club.name}</h1>
                      {club.is_verified && <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-700">✓ Vérifié</span>}
                    </div>
                    <p className="text-white/70 text-sm mb-1">{club.type === 'activité' ? '🎯 Club activité' : '🌍 Club destination'} · {club.category}</p>
                    <p className="text-white/60 text-sm mb-4 max-w-xl">{club.description}</p>
                    <div className="flex items-center gap-6 flex-wrap">
                      <span className="flex items-center gap-2 text-white/80 text-sm">
                        <Icon name="UsersIcon" size={14} />
                        {club.members_count.toLocaleString()} membres
                      </span>
                      <span className="flex items-center gap-2 text-white/80 text-sm">
                        <Icon name="BoltIcon" size={14} />
                        {club.active_this_month} actifs ce mois
                      </span>
                      <span className={`text-xs font-600 px-2.5 py-1 rounded-full bg-white/20 text-white`}>
                        {club.privacy === 'open' ? '🌍 Ouvert' : club.privacy === 'closed' ? '🔒 Fermé' : '🕵️ Secret'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleToggleMember}
                    disabled={joining}
                    className={`flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-700 transition-all ${isMember ? 'bg-white/20 text-white border border-white/30 hover:bg-white/30' : 'bg-white text-gray-800 hover:bg-white/90'}`}
                  >
                    <Icon name={isMember ? 'CheckIcon' : 'PlusIcon'} size={15} />
                    {joining ? '...' : isMember ? 'Membre' : 'Rejoindre'}
                  </button>
                </div>
              </div>
            </div>

            {/* Rules banner */}
            {club.rules && (
              <div className="bg-[#1C2620] px-4 py-3">
                <div className="max-w-4xl mx-auto flex items-start gap-3">
                  <Icon name="ShieldCheckIcon" size={16} className="text-[#E4501C] flex-shrink-0 mt-0.5" />
                  <p className="text-white/60 text-xs"><span className="text-white/80 font-600">Règles du club : </span>{club.rules}</p>
                </div>
              </div>
            )}

            <div className="max-w-4xl mx-auto px-4 py-8">
              {/* Tabs */}
              <div className="flex items-center gap-0 border-b border-[#C8C3B0] mb-6">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-600 border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-[#E4501C] text-[#E4501C]' : 'border-transparent text-[#5C6B5E] hover:text-[#1C2620]'}`}
                  >
                    <Icon name={tab.icon} size={14} />
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={`text-[10px] font-700 px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-[#E4501C]/10 text-[#E4501C]' : 'bg-[#C8C3B0]/50 text-[#5C6B5E]'}`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Discussions */}
              {activeTab === 'discussions' && (
                <div className="space-y-3">
                  {topics.length === 0 ? (
                    <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-8 text-center text-[#5C6B5E]">
                      <p className="text-3xl mb-2">💬</p>
                      <p className="text-sm">Aucune discussion pour l&apos;instant.</p>
                    </div>
                  ) : (
                    topics.map((topic) => (
                      <div key={topic.id} className={`bg-[#EDEAE0] border rounded-2xl p-5 ${topic.is_pinned ? 'border-[#E4501C]/30 bg-[#E4501C]/5' : 'border-[#C8C3B0]'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              {topic.is_pinned && <span className="text-[10px] bg-[#E4501C]/10 text-[#E4501C] px-2 py-0.5 rounded-full font-700">📌 Épinglé</span>}
                              {topic.is_announcement && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-700">📢 Annonce</span>}
                              <h3 className="font-600 text-[#1C2620] text-sm">{topic.title}</h3>
                            </div>
                            {topic.content && <p className="text-xs text-[#5C6B5E] mb-3 line-clamp-2">{topic.content}</p>}
                            <div className="flex items-center gap-4 text-[10px] text-[#5C6B5E]">
                              <span className="font-600">{topic.author?.full_name ?? 'Anonyme'}</span>
                              <span>{new Date(topic.created_at).toLocaleDateString('fr-FR')}</span>
                              <span className="flex items-center gap-1"><Icon name="HeartIcon" size={10} /> {topic.likes_count}</span>
                              <span className="flex items-center gap-1"><Icon name="ChatBubbleLeftIcon" size={10} /> {topic.replies_count} réponses</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  {!isMember && (
                    <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-5 text-center">
                      <p className="text-sm text-[#5C6B5E] mb-3">Rejoignez le club pour participer aux discussions</p>
                      <button onClick={handleToggleMember} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#E4501C] text-white rounded-xl text-sm font-700 hover:bg-[#E4501C]/90 transition-colors">
                        <Icon name="PlusIcon" size={14} /> Rejoindre le club
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Membres */}
              {activeTab === 'membres' && (
                <div className="space-y-3">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-4 bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4">
                      <div className="w-11 h-11 rounded-xl bg-[#E4501C]/20 flex items-center justify-center font-700 text-[#E4501C] text-base flex-shrink-0">
                        {m.user?.full_name?.[0] ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-600 text-[#1C2620] text-sm truncate">{m.user?.full_name ?? 'Anonyme'}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-700 ${m.role === 'admin' ? 'bg-amber-100 text-amber-700' : m.role === 'moderator' ? 'bg-blue-100 text-blue-700' : 'bg-[#E7E3D6] text-[#5C6B5E]'}`}>
                            {m.role === 'admin' ? '👑 Admin' : m.role === 'moderator' ? '🛡️ Modo' : '👤 Membre'}
                          </span>
                        </div>
                        <p className="text-xs text-[#5C6B5E]">Trust Score {m.user?.trust_score ?? 0} · Membre depuis {new Date(m.joined_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</p>
                      </div>
                      <Link href={`/profil/${m.user_id}`} className="flex-shrink-0 px-3 py-1.5 border border-[#C8C3B0] rounded-xl text-xs font-600 text-[#5C6B5E] hover:text-[#1C2620] hover:border-[#1C2620]/30 transition-all">
                        Profil
                      </Link>
                    </div>
                  ))}
                  {members.length === 0 && (
                    <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-8 text-center text-[#5C6B5E]">
                      <p className="text-3xl mb-2">👥</p>
                      <p className="text-sm">Aucun membre visible.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Événements */}
              {activeTab === 'evenements' && (
                <div className="space-y-4">
                  {events.length === 0 ? (
                    <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-8 text-center text-[#5C6B5E]">
                      <p className="text-3xl mb-2">📅</p>
                      <p className="text-sm">Aucun événement planifié.</p>
                    </div>
                  ) : (
                    events.map((ev) => (
                      <div key={ev.id} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-display font-700 text-[#1C2620] mb-1">{ev.title}</h3>
                            {ev.description && <p className="text-sm text-[#5C6B5E] mb-3">{ev.description}</p>}
                            <div className="flex items-center gap-4 text-xs text-[#5C6B5E] flex-wrap">
                              {ev.event_date && (
                                <span className="flex items-center gap-1.5">
                                  <Icon name="CalendarDaysIcon" size={12} />
                                  {new Date(ev.event_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                </span>
                              )}
                              {ev.location && (
                                <span className="flex items-center gap-1.5">
                                  <Icon name="MapPinIcon" size={12} />
                                  {ev.location}
                                </span>
                              )}
                              <span className="flex items-center gap-1.5">
                                <Icon name="UsersIcon" size={12} />
                                {ev.participants_count}/{ev.max_participants} participants
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => showToast('Inscription enregistrée !')}
                            disabled={ev.participants_count >= ev.max_participants}
                            className="flex-shrink-0 px-4 py-2 bg-[#E4501C] text-white rounded-xl text-sm font-700 hover:bg-[#E4501C]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {ev.participants_count >= ev.max_participants ? 'Complet' : 'S\'inscrire'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Other clubs */}
              <div className="mt-10">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display font-700 text-[#1C2620] text-lg">Autres clubs</h2>
                  <Link href="/clubs" className="text-xs text-[#E4501C] hover:underline">Voir tout →</Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {FAKE_CLUBS.filter((c) => c.id !== clubId).slice(0, 3).map((c) => (
                    <Link key={c.id} href={`/clubs/${c.id}`} className={`bg-gradient-to-br ${c.cover_color} rounded-2xl p-5 hover:opacity-90 transition-opacity`}>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{c.emoji}</span>
                        <p className="font-display font-700 text-white text-sm line-clamp-1">{c.name}</p>
                      </div>
                      <p className="text-white/60 text-xs">{c.members_count.toLocaleString()} membres</p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1C2620] text-white px-5 py-3 rounded-xl text-sm font-600 shadow-xl">
          {toast}
        </div>
      )}

      <Footer />
    </div>
  );
}
