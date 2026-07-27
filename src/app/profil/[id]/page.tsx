'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string;
  trust_score: number;
  loyalty_points: number;
  loyalty_level: string;
  bio: string;
  location: string;
  xp: number;
  level: number;
  created_at: string;
}

interface Post {
  id: string;
  content: string;
  post_type: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

interface Carnet {
  id: string;
  title: string;
  destination: string;
  description: string;
  cover_image: string;
  cover_image_alt: string;
  start_date: string | null;
  end_date: string | null;
  weather: string;
  route_rating: number;
  visibility: string;
  tags: string[];
  likes_count: number;
  comments_count: number;
  favorites_count: number;
  views_count: number;
  verified: boolean;
  is_collaborative: boolean;
  created_at: string;
}

interface ClubMembership {
  id: string;
  club_id: string;
  role: string;
  joined_at: string;
  club?: { name: string; emoji: string; category: string; members_count: number; type: string };
}

interface EventParticipation {
  id: string;
  event_id: string;
  event?: { title: string; emoji: string; event_date: string; location: string; type: string; status: string };
}

interface Badge {
  id: string;
  name: string;
  icon: string;
  rarity: string;
}

interface UserGroup {
  id: string;
  name: string;
  destination: string;
  theme: string;
  departure_date: string | null;
  return_date: string | null;
  visibility: string;
  group_level: number;
  optimization_score: number;
  my_role?: string;
  member_count?: number;
}

const LEVEL_CFG: Record<string, { color: string; icon: string; bg: string }> = {
  Explorateur: { color: 'text-stone-600', icon: '🥾', bg: 'bg-stone-100 border-stone-300' },
  Aventurier: { color: 'text-emerald-700', icon: '🏕️', bg: 'bg-emerald-50 border-emerald-300' },
  'Randonneur Expert': { color: 'text-blue-700', icon: '🧗', bg: 'bg-blue-50 border-blue-300' },
  'Guide de Montagne': { color: 'text-purple-700', icon: '🏔️', bg: 'bg-purple-50 border-purple-300' },
  'Légende du Voyage': { color: 'text-amber-700', icon: '🌍', bg: 'bg-amber-50 border-amber-300' },
};

const POST_TYPE_CFG: Record<string, { label: string; color: string; emoji: string }> = {
  post: { label: 'Post', color: 'bg-gray-100 text-gray-700', emoji: '💬' },
  tip: { label: 'Conseil', color: 'bg-emerald-100 text-emerald-700', emoji: '💡' },
  question: { label: 'Question', color: 'bg-blue-100 text-blue-700', emoji: '❓' },
  share: { label: 'Partage', color: 'bg-purple-100 text-purple-700', emoji: '🔗' },
};

// ─── Carnet Detail Modal ──────────────────────────────────────────────────────
function CarnetDetailModal({ carnet, onClose }: { carnet: Carnet | null; onClose: () => void }) {
  if (!carnet) return null;
  const durationDays = carnet.start_date && carnet.end_date
    ? Math.ceil((new Date(carnet.end_date).getTime() - new Date(carnet.start_date).getTime()) / 86400000)
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl w-full max-w-2xl my-4 overflow-hidden">
        {/* Cover */}
        <div className="relative h-56 overflow-hidden bg-[#1C2620]">
          {carnet.cover_image ? (
            <Image src={carnet.cover_image} alt={carnet.cover_image_alt || carnet.title} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl">🗺️</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/40 backdrop-blur-sm rounded-xl hover:bg-black/60 transition-colors"
          >
            <Icon name="XMarkIcon" size={18} className="text-white" />
          </button>
          <div className="absolute top-4 left-4 flex gap-2 flex-wrap">
            {carnet.verified && <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-700">✓ Vérifié</span>}
            {carnet.is_collaborative && <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-700">👥 Collaboratif</span>}
          </div>
          <div className="absolute bottom-4 left-5 right-5">
            <p className="text-[10px] font-mono text-white/60 uppercase tracking-wider mb-1">{carnet.destination}</p>
            <h2 className="font-display font-800 text-white text-xl leading-tight">{carnet.title}</h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Note', value: `${carnet.route_rating}/10`, icon: '⭐' },
              { label: 'Durée', value: durationDays ? `${durationDays}j` : '—', icon: '📅' },
              { label: 'Vues', value: carnet.views_count ?? 0, icon: '👁️' },
              { label: 'Favoris', value: carnet.favorites_count ?? 0, icon: '🔖' },
            ].map((s) => (
              <div key={s.label} className="bg-white/60 rounded-xl p-3 text-center">
                <p className="text-base mb-0.5">{s.icon}</p>
                <p className="font-display font-700 text-[#1C2620] text-sm">{s.value}</p>
                <p className="text-[10px] text-[#5C6B5E]">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Dates */}
          {(carnet.start_date || carnet.end_date) && (
            <div className="flex items-center gap-4 p-4 bg-[#1C2620] rounded-xl">
              <Icon name="CalendarDaysIcon" size={18} className="text-[#E4501C] flex-shrink-0" />
              <div className="flex items-center gap-3 text-sm">
                {carnet.start_date && (
                  <span className="text-white/70">
                    Départ : <span className="text-white font-600">{new Date(carnet.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </span>
                )}
                {carnet.start_date && carnet.end_date && <span className="text-white/30">→</span>}
                {carnet.end_date && (
                  <span className="text-white/70">
                    Retour : <span className="text-white font-600">{new Date(carnet.end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {carnet.description && (
            <div>
              <p className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-wider mb-2">Récit d&apos;expédition</p>
              <p className="text-sm text-[#1C2620] leading-relaxed">{carnet.description}</p>
            </div>
          )}

          {/* Weather */}
          {carnet.weather && (
            <div className="flex items-center gap-3 p-3 bg-[#E7E3D6] rounded-xl border border-[#C8C3B0]">
              <Icon name="CloudIcon" size={16} className="text-[#5C6B5E] flex-shrink-0" />
              <div>
                <p className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-wider">Conditions météo</p>
                <p className="text-sm text-[#1C2620] font-500">{carnet.weather}</p>
              </div>
            </div>
          )}

          {/* Tags */}
          {carnet.tags?.length > 0 && (
            <div>
              <p className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-wider mb-2">Tags</p>
              <div className="flex flex-wrap gap-2">
                {carnet.tags.map((tag) => (
                  <span key={tag} className="text-xs bg-[#1C2620] text-white/70 px-3 py-1 rounded-full">#{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Engagement */}
          <div className="flex items-center gap-4 pt-3 border-t border-[#C8C3B0]">
            <span className="flex items-center gap-1.5 text-sm text-[#5C6B5E]">
              <Icon name="HeartIcon" size={14} /> {carnet.likes_count} réactions
            </span>
            <span className="flex items-center gap-1.5 text-sm text-[#5C6B5E]">
              <Icon name="ChatBubbleLeftIcon" size={14} /> {carnet.comments_count} commentaires
            </span>
            <span className="flex items-center gap-1.5 text-sm text-[#5C6B5E]">
              <Icon name="BookmarkIcon" size={14} /> {carnet.favorites_count} favoris
            </span>
          </div>
        </div>

        <div className="p-5 border-t border-[#C8C3B0]">
          <Link
            href="/carnets"
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#E4501C] text-white rounded-xl text-sm font-700 hover:bg-[#E4501C]/90 transition-colors"
          >
            <Icon name="ArrowTopRightOnSquareIcon" size={14} />
            Voir tous les carnets
          </Link>
        </div>
      </div>
    </div>
  );
}

type ProfileTab = 'publications' | 'carnets' | 'clubs' | 'evenements' | 'badges' | 'groupes';

export default function ProfilPage() {
  const params = useParams();
  const profileId = params?.id as string;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [carnets, setCarnets] = useState<Carnet[]>([]);
  const [clubs, setClubs] = useState<ClubMembership[]>([]);
  const [events, setEvents] = useState<EventParticipation[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>('publications');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedCarnet, setSelectedCarnet] = useState<Carnet | null>(null);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    if (!profileId) return;
    const load = async () => {
      setLoading(true);
      const [profileRes, postsRes, carnetsRes, clubsRes, eventsRes, badgesRes] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', profileId).single(),
        supabase.from('community_posts').select('id, content, post_type, likes_count, comments_count, created_at').eq('author_id', profileId).order('created_at', { ascending: false }).limit(10),
        supabase.from('carnets').select('*').eq('author_id', profileId).eq('visibility', 'public').order('created_at', { ascending: false }).limit(12),
        supabase.from('club_members').select('id, club_id, role, joined_at, club:clubs(name, emoji, category, members_count, type)').eq('user_id', profileId).eq('status', 'active').limit(8),
        supabase.from('event_participants').select('id, event_id, event:events(title, emoji, event_date, location, type, status)').eq('user_id', profileId).limit(8),
        supabase.from('user_badges').select('badge_id, badge:badges(id, name, icon, rarity)').eq('user_id', profileId).limit(12),
      ]);

      setProfile(profileRes.data ?? null);
      setPosts(postsRes.data ?? []);
      setCarnets((carnetsRes.data ?? []) as Carnet[]);
      setClubs((clubsRes.data ?? []) as unknown as ClubMembership[]);
      setEvents((eventsRes.data ?? []) as unknown as EventParticipation[]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setBadges(((badgesRes.data ?? []) as any[]).map((b) => b.badge).filter(Boolean));

      // Load groups
      const { data: memberData } = await supabase
        .from('group_members')
        .select('group_id, role')
        .eq('user_id', profileId)
        .eq('status', 'active');

      if (memberData?.length) {
        const groupIds = memberData.map(m => m.group_id);
        const { data: groupsData } = await supabase
          .from('travel_groups')
          .select('id, name, destination, theme, departure_date, return_date, visibility, group_level, optimization_score')
          .in('id', groupIds)
          .order('created_at', { ascending: false })
          .limit(8);

        const enriched = await Promise.all((groupsData || []).map(async (g) => {
          const { count } = await supabase
            .from('group_members').select('*', { count: 'exact', head: true })
            .eq('group_id', g.id).eq('status', 'active');
          return { ...g, member_count: count || 0, my_role: memberData.find(m => m.group_id === g.id)?.role };
        }));
        setGroups(enriched);
      }

      const [fwersRes, fwingRes] = await Promise.all([
        supabase.from('user_follows').select('*', { count: 'exact', head: true }).eq('following_id', profileId),
        supabase.from('user_follows').select('*', { count: 'exact', head: true }).eq('follower_id', profileId),
      ]);
      setFollowersCount(fwersRes.count ?? 0);
      setFollowingCount(fwingRes.count ?? 0);

      if (user) {
        const { data: followData } = await supabase.from('user_follows').select('id').eq('follower_id', user.id).eq('following_id', profileId).maybeSingle();
        setIsFollowing(!!followData);
      }
      setLoading(false);
    };
    load();
  }, [profileId, supabase, user]);

  const handleFollow = async () => {
    if (!user) { showToast('Connectez-vous pour suivre'); return; }
    if (user.id === profileId) return;
    if (isFollowing) {
      await supabase.from('user_follows').delete().eq('follower_id', user.id).eq('following_id', profileId);
      setIsFollowing(false);
      setFollowersCount((c) => Math.max(0, c - 1));
      showToast('Abonnement annulé');
    } else {
      await supabase.from('user_follows').insert({ follower_id: user.id, following_id: profileId });
      setIsFollowing(true);
      setFollowersCount((c) => c + 1);
      showToast('Abonné !');
    }
  };

  const levelCfg = LEVEL_CFG[profile?.loyalty_level ?? 'Explorateur'] ?? LEVEL_CFG.Explorateur;
  const initials = profile?.full_name ? profile.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : '?';
  const isOwnProfile = user?.id === profileId;

  const PROFILE_TABS: { id: ProfileTab; label: string; icon: string; count?: number }[] = [
    { id: 'publications', label: 'Publications', icon: 'ChatBubbleLeftRightIcon', count: posts.length },
    { id: 'carnets', label: 'Carnets', icon: 'BookOpenIcon', count: carnets.length },
    { id: 'groupes', label: 'Groupes', icon: 'MapIcon', count: groups.length },
    { id: 'clubs', label: 'Clubs', icon: 'UserGroupIcon', count: clubs.length },
    { id: 'evenements', label: 'Événements', icon: 'CalendarDaysIcon', count: events.length },
    { id: 'badges', label: 'Badges', icon: 'TrophyIcon', count: badges.length },
  ];

  const RARITY_CFG: Record<string, string> = {
    Commun: 'text-stone-600 bg-stone-100',
    Rare: 'text-blue-600 bg-blue-100',
    Épique: 'text-purple-600 bg-purple-100',
    Légendaire: 'text-amber-600 bg-amber-100',
  };

  return (
    <div className="min-h-screen bg-[#F5F2E8]">
      <Header />
      <main className="pt-20 pb-24">
        {/* Hero Banner Full Width */}
        <div className="bg-[#1C2620] h-[40vh] min-h-[300px] w-full relative overflow-hidden">
          <div className="absolute inset-0 opacity-40 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          {profile?.avatar_url ? (
            <Image src={profile.avatar_url} alt="Cover" fill className="object-cover opacity-60 mix-blend-overlay blur-sm" />
          ) : (
            <div className="absolute inset-0 bg-[#E4501C]/10" />
          )}
          
          <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-center">
            {/* Avatar overlapping */}
            <div className="translate-y-1/2">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt={`Photo de ${profile.full_name}`} className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-[#F5F2E8] shadow-xl" />
              ) : (
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-[#E4501C] flex items-center justify-center text-4xl md:text-5xl font-700 text-white border-4 border-[#F5F2E8] shadow-xl">
                  {initials}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 mt-20 md:mt-24">
          
          {loading ? (
             <div className="flex flex-col items-center justify-center space-y-4 py-12">
               <div className="h-10 w-64 bg-[#C8C3B0]/30 rounded animate-pulse" />
               <div className="h-4 w-48 bg-[#C8C3B0]/30 rounded animate-pulse" />
             </div>
          ) : !profile ? (
            <div className="text-center py-12">
              <p className="text-[#5C6B5E]">Profil introuvable</p>
              <Link href="/communaute" className="text-[#E4501C] text-sm mt-2 inline-block">← Retour à la communauté</Link>
            </div>
          ) : (
            <>
              {/* Profile Header Title */}
              <div className="text-center mb-12">
                <h1 className="font-display font-800 text-4xl md:text-5xl text-[#1C2620] mb-3">
                  {profile.full_name ? profile.full_name.split(' ').map((word, i, arr) => 
                    i === arr.length - 1 ? <em key={i} className="italic font-400 text-[#5C6B5E] ml-2">{word}</em> : <span key={i}>{word}</span>
                  ) : 'Aventurier'}
                </h1>
                <div className="flex items-center justify-center gap-3 text-sm text-[#5C6B5E] font-500">
                  <span className="flex items-center gap-1"><Icon name="MapPinIcon" size={14} /> {profile.location || 'Nomade'}</span>
                  <span className="w-1 h-1 rounded-full bg-[#C8C3B0]" />
                  <span className="flex items-center gap-1">{levelCfg.icon} {profile.loyalty_level}</span>
                </div>
                
                {/* Actions */}
                <div className="flex justify-center gap-3 mt-6">
                  {isOwnProfile ? (
                    <Link href="/compte" className="px-6 py-2.5 rounded-full border border-[#C8C3B0] text-[#1C2620] font-600 text-sm hover:bg-white transition-colors">
                      Éditer le profil
                    </Link>
                  ) : (
                    <>
                      <button onClick={handleFollow} className={`px-6 py-2.5 rounded-full font-600 text-sm transition-colors ${isFollowing ? 'border border-[#C8C3B0] text-[#1C2620] hover:bg-white' : 'bg-[#1C2620] text-white hover:bg-[#2A3830]'}`}>
                        {isFollowing ? 'Abonné' : 'Suivre'}
                      </button>
                      <button className="w-10 h-10 rounded-full border border-[#C8C3B0] flex items-center justify-center text-[#1C2620] hover:bg-white transition-colors">
                        <Icon name="ChatBubbleLeftIcon" size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Two Columns Layout */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
                
                {/* Left Column: Bio & Details */}
                <div className="md:col-span-4 space-y-8">
                  <div>
                    <h3 className="font-mono text-xs tracking-widest uppercase text-[#5C6B5E] mb-4">À propos</h3>
                    <p className="text-[#1C2620] leading-relaxed text-sm">
                      {profile.bio || "Ce voyageur n'a pas encore écrit de biographie. Mais ses aventures parlent pour lui !"}
                    </p>
                  </div>
                  
                  <div className="pt-6 border-t border-[#C8C3B0]/50">
                    <h3 className="font-mono text-xs tracking-widest uppercase text-[#5C6B5E] mb-4">Statistiques</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[#5C6B5E]">Abonnés</span>
                        <span className="font-600 text-[#1C2620]">{followersCount}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[#5C6B5E]">Abonnements</span>
                        <span className="font-600 text-[#1C2620]">{followingCount}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[#5C6B5E]">Trust Score</span>
                        <span className="font-600 text-emerald-600 flex items-center gap-1">{profile.trust_score ?? 50}/100 <Icon name="ShieldCheckIcon" size={14} /></span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6">
                    <Link href={`/profil/${profileId}/equipement`} className="w-full flex items-center justify-between px-5 py-4 bg-[#EDEAE0] border border-[#C8C3B0] rounded-xl hover:bg-white hover:border-[#1C2620]/30 transition-all group">
                      <div className="flex items-center gap-3">
                        <Icon name="ArchiveBoxIcon" size={20} className="text-[#1C2620]" />
                        <span className="font-600 text-[#1C2620] text-sm">Voir son équipement</span>
                      </div>
                      <Icon name="ArrowRightIcon" size={16} className="text-[#5C6B5E] group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>

                {/* Right Column: Feed / Carnets */}
                <div className="md:col-span-8 space-y-10">
                  <div>
                    <h3 className="font-display font-800 text-2xl text-[#1C2620] mb-6 flex items-center gap-2">
                      Dernières aventures <span className="text-xl">🗺️</span>
                    </h3>
                    
                    {carnets.length === 0 ? (
                      <div className="p-8 border border-dashed border-[#C8C3B0] rounded-2xl text-center">
                        <p className="text-[#5C6B5E] text-sm">Aucune aventure publiée pour le moment.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {carnets.slice(0, 4).map((carnet) => (
                          <div key={carnet.id} onClick={() => setSelectedCarnet(carnet)} className="cursor-pointer group">
                            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[#C8C3B0] mb-3">
                              {carnet.cover_image ? (
                                <Image src={carnet.cover_image} alt={carnet.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center bg-[#EDEAE0]">🗺️</div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                              <div className="absolute bottom-3 left-3 right-3">
                                <p className="text-[10px] text-white/80 font-mono uppercase tracking-wider mb-0.5">{carnet.destination}</p>
                                <p className="font-600 text-white text-sm leading-tight line-clamp-1">{carnet.title}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="font-display font-800 text-2xl text-[#1C2620] mb-6 flex items-center gap-2">
                      Fil d'actualité <span className="text-xl">💬</span>
                    </h3>
                    
                    <div className="space-y-4">
                      {posts.length === 0 ? (
                        <div className="p-8 border border-dashed border-[#C8C3B0] rounded-2xl text-center">
                          <p className="text-[#5C6B5E] text-sm">Rien à signaler pour le moment.</p>
                        </div>
                      ) : (
                        posts.map((post) => {
                          const typeCfg = POST_TYPE_CFG[post.post_type] ?? POST_TYPE_CFG.post;
                          return (
                            <div key={post.id} className="bg-white rounded-2xl p-5 shadow-sm border border-[#C8C3B0]/30">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full ${typeCfg.color}`}>{typeCfg.emoji} {typeCfg.label}</span>
                                  <span className="text-xs text-[#5C6B5E]">{new Date(post.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                                </div>
                              </div>
                              <p className="text-[#1C2620] text-sm leading-relaxed mb-4">{post.content}</p>
                              <div className="flex items-center gap-4 text-xs text-[#5C6B5E]">
                                <span className="flex items-center gap-1 cursor-pointer hover:text-[#E4501C]"><Icon name="HeartIcon" size={14} /> {post.likes_count}</span>
                                <span className="flex items-center gap-1 cursor-pointer hover:text-[#E4501C]"><Icon name="ChatBubbleLeftIcon" size={14} /> {post.comments_count}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Carnet Detail Modal */}
      <CarnetDetailModal carnet={selectedCarnet} onClose={() => setSelectedCarnet(null)} />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1C2620] text-white px-5 py-3 rounded-xl text-sm font-600 shadow-xl">
          {toast}
        </div>
      )}

      <Footer />
    </div>
  );
}
