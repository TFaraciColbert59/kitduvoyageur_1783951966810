'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
      <main className="pt-20">
        {/* Hero Banner */}
        <div className="bg-[#1C2620] h-44 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-[#E4501C] via-transparent to-[#1C2620]" />
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(228,80,28,0.15) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(92,107,94,0.2) 0%, transparent 50%)' }} />
        </div>

        <div className="max-w-4xl mx-auto px-4">
          {/* Profile Card */}
          <div className="relative -mt-20 mb-6">
            <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-6">
              {loading ? (
                <div className="space-y-3">
                  <div className="w-24 h-24 rounded-2xl bg-[#C8C3B0]/30 animate-pulse" />
                  <div className="h-6 w-48 bg-[#C8C3B0]/30 rounded animate-pulse" />
                  <div className="h-4 w-64 bg-[#C8C3B0]/30 rounded animate-pulse" />
                </div>
              ) : !profile ? (
                <div className="text-center py-8">
                  <p className="text-[#5C6B5E]">Profil introuvable</p>
                  <Link href="/communaute" className="text-[#E4501C] text-sm mt-2 inline-block">← Retour à la communauté</Link>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-6">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {profile.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.avatar_url} alt={`Photo de profil de ${profile.full_name}`} className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-lg" />
                    ) : (
                      <div className="w-24 h-24 rounded-2xl bg-[#E4501C]/20 flex items-center justify-center text-3xl font-700 text-[#E4501C] border-4 border-white shadow-lg">
                        {initials}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                      <div>
                        <h1 className="font-display font-800 text-2xl text-[#1C2620] tracking-tight">{profile.full_name || 'Aventurier'}</h1>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-xs font-600 px-2.5 py-1 rounded-full border ${levelCfg.bg} ${levelCfg.color}`}>
                            {levelCfg.icon} {profile.loyalty_level}
                          </span>
                          {profile.location && (
                            <span className="text-xs text-[#5C6B5E] flex items-center gap-1">
                              <Icon name="MapPinIcon" size={12} /> {profile.location}
                            </span>
                          )}
                          <span className="text-xs text-[#5C6B5E]">
                            Membre depuis {new Date(profile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {isOwnProfile ? (
                          <>
                            <Link href="/compte" className="flex items-center gap-2 px-4 py-2 border border-[#C8C3B0] rounded-xl text-sm font-600 text-[#5C6B5E] hover:text-[#1C2620] hover:border-[#1C2620]/30 transition-all">
                              <Icon name="PencilIcon" size={14} /> Modifier
                            </Link>
                            <Link href="/groupes" className="flex items-center gap-2 px-4 py-2 bg-[#E4501C] text-white rounded-xl text-sm font-600 hover:bg-[#E4501C]/90 transition-all">
                              <Icon name="UserGroupIcon" size={14} /> Mes groupes
                            </Link>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={handleFollow}
                              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-600 transition-all ${isFollowing ? 'border border-[#C8C3B0] text-[#5C6B5E] hover:border-red-300 hover:text-red-500' : 'bg-[#E4501C] text-white hover:bg-[#E4501C]/90'}`}
                            >
                              <Icon name={isFollowing ? 'UserMinusIcon' : 'UserPlusIcon'} size={14} />
                              {isFollowing ? 'Abonné' : 'Suivre'}
                            </button>
                            <Link href="/messagerie" className="flex items-center gap-2 px-4 py-2 border border-[#C8C3B0] rounded-xl text-sm font-600 text-[#5C6B5E] hover:text-[#1C2620] transition-all">
                              <Icon name="ChatBubbleLeftIcon" size={14} /> Message
                            </Link>
                          </>
                        )}
                      </div>
                    </div>

                    {profile.bio && <p className="text-sm text-[#5C6B5E] mb-4 leading-relaxed">{profile.bio}</p>}

                    {/* Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Trust Score', value: profile.trust_score ?? 50, icon: '🛡️' },
                        { label: 'Points fidélité', value: profile.loyalty_points ?? 0, icon: '⭐' },
                        { label: 'Abonnés', value: followersCount, icon: '👥' },
                        { label: 'Abonnements', value: followingCount, icon: '🔔' },
                      ].map((stat) => (
                        <div key={stat.label} className="bg-white/60 rounded-xl p-3 text-center">
                          <p className="text-lg">{stat.icon}</p>
                          <p className="font-display font-700 text-[#1C2620] text-lg">{stat.value.toLocaleString()}</p>
                          <p className="text-[10px] text-[#5C6B5E]">{stat.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Trust Score + Level Cards */}
          {profile && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-[#1C2620] rounded-2xl p-5">
                <p className="text-[10px] font-mono text-white/40 tracking-[0.2em] uppercase mb-3">Trust Score</p>
                <div className="flex items-center gap-4">
                  <div className="relative flex-shrink-0">
                    <svg width={64} height={64} className="-rotate-90">
                      <circle cx={32} cy={32} r={26} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={4} />
                      <circle cx={32} cy={32} r={26} fill="none" stroke="#E4501C" strokeWidth={4}
                        strokeDasharray={2 * Math.PI * 26}
                        strokeDashoffset={2 * Math.PI * 26 * (1 - (profile.trust_score ?? 50) / 100)}
                        strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-mono font-700 text-white text-base">{profile.trust_score ?? 50}</span>
                    </div>
                  </div>
                  <div>
                    <p className="font-display font-700 text-white text-sm">
                      {(profile.trust_score ?? 50) >= 80 ? 'Confirmé 🏔️' : (profile.trust_score ?? 50) >= 60 ? 'Fiable ✅' : 'Débutant 🌱'}
                    </p>
                    <p className="text-white/40 text-xs mt-1">Score de confiance</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-5">
                <p className="text-[10px] font-mono text-[#5C6B5E] tracking-[0.2em] uppercase mb-3">Niveau fidélité</p>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{levelCfg.icon}</span>
                  <div>
                    <p className={`font-display font-700 text-lg ${levelCfg.color}`}>{profile.loyalty_level}</p>
                    <p className="text-xs text-[#5C6B5E]">{profile.loyalty_points?.toLocaleString() ?? 0} pts</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-5">
                <p className="text-[10px] font-mono text-[#5C6B5E] tracking-[0.2em] uppercase mb-3">Activité</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center">
                    <p className="font-display font-700 text-[#1C2620] text-xl">{carnets.length}</p>
                    <p className="text-[10px] text-[#5C6B5E]">Carnets</p>
                  </div>
                  <div className="text-center">
                    <p className="font-display font-700 text-[#1C2620] text-xl">{badges.length}</p>
                    <p className="text-[10px] text-[#5C6B5E]">Badges</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          {profile && (
            <div className="mb-6">
              <div className="flex items-center gap-0 overflow-x-auto border-b border-[#C8C3B0] scrollbar-hide">
                {PROFILE_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-600 border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-[#E4501C] text-[#E4501C]' : 'border-transparent text-[#5C6B5E] hover:text-[#1C2620]'}`}
                  >
                    <Icon name={tab.icon} size={14} />
                    {tab.label}
                    {tab.count !== undefined && tab.count > 0 && (
                      <span className={`text-[10px] font-700 px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-[#E4501C]/10 text-[#E4501C]' : 'bg-[#C8C3B0]/50 text-[#5C6B5E]'}`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="mt-6 mb-8">
                {/* Publications */}
                {activeTab === 'publications' && (
                  <div className="space-y-3">
                    {posts.length === 0 ? (
                      <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-8 text-center text-[#5C6B5E]">
                        <p className="text-3xl mb-2">💬</p>
                        <p className="text-sm">Aucune publication pour l&apos;instant</p>
                      </div>
                    ) : (
                      posts.map((post) => {
                        const typeCfg = POST_TYPE_CFG[post.post_type] ?? POST_TYPE_CFG.post;
                        return (
                          <div key={post.id} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full ${typeCfg.color}`}>{typeCfg.emoji} {typeCfg.label}</span>
                              <span className="text-[10px] text-[#5C6B5E]">{new Date(post.created_at).toLocaleDateString('fr-FR')}</span>
                            </div>
                            <p className="text-sm text-[#1C2620] leading-relaxed mb-3">{post.content}</p>
                            <div className="flex items-center gap-4 text-xs text-[#5C6B5E]">
                              <span className="flex items-center gap-1"><Icon name="HeartIcon" size={12} /> {post.likes_count}</span>
                              <span className="flex items-center gap-1"><Icon name="ChatBubbleLeftIcon" size={12} /> {post.comments_count}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Carnets */}
                {activeTab === 'carnets' && (
                  <div>
                    {carnets.length === 0 ? (
                      <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-8 text-center text-[#5C6B5E]">
                        <p className="text-3xl mb-2">🗺️</p>
                        <p className="text-sm">Aucun carnet public pour l&apos;instant</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {carnets.map((carnet) => {
                          const durationDays = carnet.start_date && carnet.end_date
                            ? Math.ceil((new Date(carnet.end_date).getTime() - new Date(carnet.start_date).getTime()) / 86400000)
                            : null;
                          return (
                            <Link
                              key={carnet.id}
                              href={`/carnets/${carnet.id}`}
                              className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl overflow-hidden hover:shadow-lg hover:border-[#E4501C]/30 transition-all text-left group"
                            >
                              <div className="relative h-40 overflow-hidden bg-[#C8C3B0]">
                                {carnet.cover_image ? (
                                  <Image src={carnet.cover_image} alt={carnet.cover_image_alt || carnet.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-4xl">🗺️</div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                                <div className="absolute top-2 left-2 flex gap-1">
                                  {carnet.verified && <span className="text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-700">✓</span>}
                                </div>
                                <div className="absolute bottom-3 left-3 right-3">
                                  <p className="text-[10px] text-white/60 font-mono">{carnet.destination}{durationDays ? ` · ${durationDays}j` : ''}</p>
                                  <p className="font-display font-700 text-white text-sm leading-tight line-clamp-1">{carnet.title}</p>
                                </div>
                              </div>
                              <div className="p-3 flex items-center justify-between">
                                <div className="flex items-center gap-3 text-xs text-[#5C6B5E]">
                                  <span className="flex items-center gap-1"><Icon name="HeartIcon" size={11} /> {carnet.likes_count}</span>
                                  <span className="flex items-center gap-1"><Icon name="ChatBubbleLeftIcon" size={11} /> {carnet.comments_count}</span>
                                </div>
                                <span className="font-mono font-700 text-[#E4501C] text-sm">{carnet.route_rating}/10</span>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Groupes */}
                {activeTab === 'groupes' && (
                  <div>
                    {groups.length === 0 ? (
                      <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-8 text-center text-[#5C6B5E]">
                        <p className="text-3xl mb-2">🗺️</p>
                        <p className="text-sm mb-4">Aucun groupe de voyage pour l&apos;instant</p>
                        {isOwnProfile && (
                          <div className="flex gap-3 justify-center flex-wrap">
                            <Link href="/groupes" className="inline-flex items-center gap-2 px-4 py-2 bg-[#E4501C] text-white rounded-xl text-sm font-600 hover:bg-[#E4501C]/90 transition-colors">
                              <Icon name="PlusIcon" size={14} /> Créer un groupe
                            </Link>
                            <Link href="/groupes?tab=decouvrir" className="inline-flex items-center gap-2 px-4 py-2 border border-[#C8C3B0] text-[#5C6B5E] rounded-xl text-sm font-600 hover:text-[#1C2620] transition-colors">
                              <Icon name="MagnifyingGlassIcon" size={14} /> Découvrir
                            </Link>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {groups.map((group) => {
                            const themeEmoji: Record<string, string> = { Trek: '🏔️', 'Van Life': '🚐', Randonnée: '🥾', Expédition: '🧭', 'Tour du monde': '🌍', Plage: '🏖️', Ski: '⛷️', Vélo: '🚴', Moto: '🏍️', Autre: '🎒' };
                            return (
                              <Link
                                key={group.id}
                                href={`/groupe?group=${group.id}`}
                                className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4 hover:shadow-md hover:border-[#E4501C]/30 transition-all flex items-start gap-4"
                              >
                                <div className="w-12 h-12 rounded-xl bg-[#1C2620] flex items-center justify-center text-2xl flex-shrink-0">
                                  {themeEmoji[group.theme] || '🎒'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-display font-700 text-[#1C2620] text-sm truncate">{group.name}</p>
                                  <p className="text-xs text-[#5C6B5E] flex items-center gap-1 mt-0.5">
                                    <Icon name="MapPinIcon" size={10} /> {group.destination}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    {group.my_role && (
                                      <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full ${group.my_role === 'organizer' ? 'bg-amber-100 text-amber-700' : group.my_role === 'co_organizer' ? 'bg-blue-100 text-blue-700' : 'bg-[#E7E3D6] text-[#5C6B5E]'}`}>
                                        {group.my_role === 'organizer' ? '👑 Organisateur' : group.my_role === 'co_organizer' ? '🛡️ Co-org' : '👤 Membre'}
                                      </span>
                                    )}
                                    <span className="text-[10px] text-[#5C6B5E]">{group.member_count} membres</span>
                                    <span className="text-[10px] font-mono text-[#E4501C] font-700">{group.optimization_score}/100</span>
                                  </div>
                                  {group.departure_date && (
                                    <p className="text-[10px] text-[#5C6B5E] mt-1 flex items-center gap-1">
                                      <Icon name="CalendarIcon" size={9} />
                                      {new Date(group.departure_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
                                  )}
                                </div>
                                <Icon name="ChevronRightIcon" size={14} className="text-[#5C6B5E] flex-shrink-0 mt-1" />
                              </Link>
                            );
                          })}
                        </div>
                        {isOwnProfile && (
                          <div className="flex gap-3 pt-2 flex-wrap">
                            <Link href="/groupes" className="flex items-center gap-2 px-4 py-2 bg-[#E4501C] text-white rounded-xl text-sm font-600 hover:bg-[#E4501C]/90 transition-colors">
                              <Icon name="PlusIcon" size={14} /> Gérer mes groupes
                            </Link>
                            <Link href="/groupes?tab=decouvrir" className="flex items-center gap-2 px-4 py-2 border border-[#C8C3B0] text-[#5C6B5E] rounded-xl text-sm font-600 hover:text-[#1C2620] transition-colors">
                              <Icon name="MagnifyingGlassIcon" size={14} /> Découvrir
                            </Link>
                            <Link href="/communaute?tab=groupes" className="flex items-center gap-2 px-4 py-2 border border-[#C8C3B0] text-[#5C6B5E] rounded-xl text-sm font-600 hover:text-[#1C2620] transition-colors">
                              <Icon name="UsersIcon" size={14} /> Communauté
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Clubs */}
                {activeTab === 'clubs' && (
                  <div>
                    {clubs.length === 0 ? (
                      <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-8 text-center text-[#5C6B5E]">
                        <p className="text-3xl mb-2">🏕️</p>
                        <p className="text-sm">Aucun club rejoint pour l&apos;instant</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {clubs.map((membership) => (
                          <Link
                            key={membership.id}
                            href={`/clubs/${membership.club_id}`}
                            className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4 hover:shadow-md hover:border-[#E4501C]/30 transition-all flex items-center gap-4"
                          >
                            <div className="w-12 h-12 rounded-xl bg-[#1C2620] flex items-center justify-center text-2xl flex-shrink-0">
                              {membership.club?.emoji ?? '🏕️'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-display font-700 text-[#1C2620] text-sm truncate">{membership.club?.name ?? 'Club'}</p>
                              <p className="text-xs text-[#5C6B5E]">{membership.club?.category}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full ${membership.role === 'admin' ? 'bg-amber-100 text-amber-700' : membership.role === 'moderator' ? 'bg-blue-100 text-blue-700' : 'bg-[#E7E3D6] text-[#5C6B5E]'}`}>
                                  {membership.role === 'admin' ? '👑 Admin' : membership.role === 'moderator' ? '🛡️ Modo' : '👤 Membre'}
                                </span>
                                <span className="text-[10px] text-[#5C6B5E]">{membership.club?.members_count ?? 0} membres</span>
                              </div>
                            </div>
                            <Icon name="ChevronRightIcon" size={14} className="text-[#5C6B5E] flex-shrink-0" />
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Événements */}
                {activeTab === 'evenements' && (
                  <div>
                    {events.length === 0 ? (
                      <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-8 text-center text-[#5C6B5E]">
                        <p className="text-3xl mb-2">📅</p>
                        <p className="text-sm">Aucun événement inscrit pour l&apos;instant</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {events.map((participation) => {
                          const ev = participation.event;
                          if (!ev) return null;
                          return (
                            <Link
                              key={participation.id}
                              href="/evenements"
                              className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4 hover:shadow-md hover:border-[#E4501C]/30 transition-all"
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-12 h-12 rounded-xl bg-[#1C2620] flex items-center justify-center text-2xl flex-shrink-0">
                                  {ev.emoji ?? '🏕️'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-display font-700 text-[#1C2620] text-sm line-clamp-1">{ev.title}</p>
                                  <p className="text-xs text-[#5C6B5E] flex items-center gap-1 mt-0.5">
                                    <Icon name="MapPinIcon" size={10} /> {ev.location}
                                  </p>
                                  {ev.event_date && (
                                    <p className="text-xs text-[#5C6B5E] flex items-center gap-1 mt-0.5">
                                      <Icon name="CalendarDaysIcon" size={10} />
                                      {new Date(ev.event_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </p>
                                  )}
                                  <span className={`inline-block mt-1 text-[10px] font-600 px-2 py-0.5 rounded-full ${ev.status === 'upcoming' ? 'bg-emerald-100 text-emerald-700' : ev.status === 'full' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                    {ev.status === 'upcoming' ? '✓ Inscrit' : ev.status === 'full' ? 'Complet' : 'Passé'}
                                  </span>
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Badges */}
                {activeTab === 'badges' && (
                  <div>
                    {badges.length === 0 ? (
                      <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-8 text-center text-[#5C6B5E]">
                        <p className="text-3xl mb-2">🏆</p>
                        <p className="text-sm">Aucun badge obtenu pour l&apos;instant</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {badges.map((badge) => (
                          <div key={badge.id} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4 text-center hover:shadow-md transition-shadow">
                            <span className="text-4xl block mb-2">{badge.icon}</span>
                            <p className="font-600 text-xs text-[#1C2620] mb-1">{badge.name}</p>
                            <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full ${RARITY_CFG[badge.rarity] ?? RARITY_CFG['Commun']}`}>
                              {badge.rarity}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
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
