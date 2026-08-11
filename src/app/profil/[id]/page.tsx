'use client';

import React, { useState, useEffect, useMemo } from 'react';

import { useParams } from 'next/navigation';
import Header from '@/components/Header';


import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import Footer from '@/components/Footer';


interface Profile {
  id: string; full_name: string; avatar_url: string; trust_score: number; loyalty_points: number;
  loyalty_level: string; bio: string; location: string; xp: number; level: number; created_at: string;
}
interface Post { id: string; content: string; post_type: string; likes_count: number; comments_count: number; created_at: string; }
interface Carnet { id: string; title: string; destination: string; description: string; cover_image: string; cover_image_alt: string; start_date: string | null; end_date: string | null; weather: string; route_rating: number; visibility: string; tags: string[]; likes_count: number; comments_count: number; favorites_count: number; views_count: number; verified: boolean; is_collaborative: boolean; created_at: string; }
interface Badge { id: string; name: string; icon: string; rarity: string; }
interface ClubMembership { id: string; club_id: string; role: string; joined_at: string; club?: { name: string; emoji: string; category: string; members_count: number; type: string }; }
interface EventParticipation { id: string; event_id: string; event?: { title: string; emoji: string; event_date: string; location: string; type: string; status: string }; }
interface UserGroup { id: string; name: string; destination: string; theme: string; departure_date: string | null; return_date: string | null; visibility: string; group_level: number; optimization_score: number; my_role?: string; member_count?: number; }

const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1600&q=80',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&q=80',
  'https://images.unsplash.com/photo-1551632811-561732d1e306?w=1600&q=80',
];

const PHOTO_JOURNAL = [
  { src: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80', alt: 'Randonneur au sommet des montagnes au coucher du soleil' },
  { src: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=80', alt: 'Vue aérienne de forêt de pins dans la brume matinale' },
  { src: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=80', alt: 'Bivouac sous un ciel étoilé en montagne' },
  { src: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', alt: 'Lac de montagne aux eaux turquoise entouré de sommets' },
  { src: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=600&q=80', alt: 'Tente de camping installée sur un plateau rocheux' },
];

const MOCK_BADGES = [
  { id: '1', name: 'Sommet 3000', icon: '⛰️', rarity: 'Or', unlocked: true, desc: '2 ans' },
  { id: '2', name: '10 bivouacs', icon: '🏕️', rarity: 'Argent', unlocked: true, desc: '2 ans' },
  { id: '3', name: 'Écolo', icon: '🌿', rarity: 'Commun', unlocked: true, desc: '2 ans' },
  { id: '4', name: 'Guide', icon: '🧭', rarity: 'Or', unlocked: true, desc: 'Kit' },
  { id: '5', name: 'Boussole', icon: '🔵', rarity: 'Commun', unlocked: true, desc: 'Orienteur' },
  { id: '6', name: '6 h/jour', icon: '⏱️', rarity: 'Argent', unlocked: true, desc: 'Marcheur' },
  { id: '7', name: 'Verrouillé', icon: '🔒', rarity: 'Rare', unlocked: false, desc: '—' },
  { id: '8', name: 'Verrouillé', icon: '🔒', rarity: 'Épique', unlocked: false, desc: '—' },
  { id: '9', name: 'Verrouillé', icon: '🔒', rarity: 'Légendaire', unlocked: false, desc: '—' },
];

const MOCK_KIT = [
  { id: '1', name: 'Sac 45 L', detail: 'Vert forêt · 3 ans d\'usage', weight: '1,4 kg', src: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=80&q=80', alt: 'Sac à dos de randonnée vert 45 litres' },
  { id: '2', name: 'Duvet 3 saisons', detail: '-10 °C', weight: '920 g', src: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=80&q=80', alt: 'Duvet de camping trois saisons compressé' },
  { id: '3', name: 'Veste 3 couches', detail: 'Forêt · 2 ans', weight: '480 g', src: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=80&q=80', alt: 'Veste imperméable trois couches verte' },
  { id: '4', name: 'Gourde titane', detail: '1 L · rouge', weight: '188 g', src: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=80&q=80', alt: 'Gourde en titane rouge de 1 litre' },
];

const MOCK_ADVENTURES = [
  { id: '1', title: 'Cabane du Grand Vaneau', subtitle: '3 nuits · Chartreuse · 27,4 km', date: '14–17 août', src: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=80', alt: 'Cabane en bois dans une forêt de pins brumeuse' },
  { id: '2', title: 'Bivouac étoilé · Vercors', subtitle: '2 nuits · Plateau haut · 18,6 km', date: '2–4 août', src: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=80', alt: 'Tente sous un ciel étoilé dans le Vercors' },
  { id: '3', title: 'Traversée des Écrins', subtitle: '6 jours · Alpes · 62 km', date: 'Juillet', src: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80', alt: 'Traversée des massifs des Écrins en été' },
  { id: '4', title: 'Kayak · Serre-Ponçon', subtitle: '1 jour · Hautes-Alpes · 14 km', date: 'Juin', src: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', alt: 'Kayak sur le lac de Serre-Ponçon' },
];

const POST_TYPE_CFG: Record<string, { color: string; emoji: string; label: string }> = {
  post: { color: 'bg-[#EDEAE0] text-[#5C6B5E]', emoji: '💬', label: 'Post' },
  carnet: { color: 'bg-[#E4501C]/10 text-[#E4501C]', emoji: '📖', label: 'Carnet' },
  photo: { color: 'bg-[#4A6741]/10 text-[#4A6741]', emoji: '📷', label: 'Photo' },
  tip: { color: 'bg-blue-50 text-blue-600', emoji: '💡', label: 'Conseil' },
};

const LEVEL_CFG: Record<string, { icon: string }> = {
  Aventurier: { icon: '🥾' },
  Explorateur: { icon: '🧭' },
  Randonneur: { icon: '⛺' },
  Guide: { icon: '🏔️' },
  Légende: { icon: '🌟' },
};

type ProfileTab = 'publications' | 'carnets' | 'clubs' | 'evenements' | 'badges' | 'groupes';

export default function ProfilPage() {
  const params = useParams();
  const profileId = params?.id as string;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [carnets, setCarnets] = useState<Carnet[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [gearItems, setGearItems] = useState<any[]>([]);
  const [clubs, setClubs] = useState<ClubMembership[]>([]);
  const [events, setEvents] = useState<EventParticipation[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>('publications');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [selectedCarnet, setSelectedCarnet] = useState<Carnet | null>(null);
  const [posts, setPosts] = useState<{ id: string; post_type: string; content: string; created_at: string; likes_count: number; comments_count: number }[]>([]);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const showToast = (message: string) => {
    console.log(message);
  };

  useEffect(() => {
    if (!profileId) return;
    const load = async () => {
      setLoading(true);
      const [profileRes, carnetsRes, badgesRes, gearRes, clubsRes, eventsRes] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', profileId).single(),
        supabase.from('carnets').select('*').eq('author_id', profileId).eq('visibility', 'public').order('created_at', { ascending: false }).limit(8),
        supabase.from('user_badges').select('badge_id, badge:badges(id, name, icon, rarity)').eq('user_id', profileId).limit(9),
        supabase.from('gear_items').select('id, name, category, weight_g, brand, condition').eq('user_id', profileId).limit(4),
        supabase.from('club_members').select('id, club_id, role, joined_at, club:clubs(name, emoji, category, members_count, type)').eq('user_id', profileId).limit(8),
        supabase.from('event_participants').select('id, event_id, event:events(title, emoji, event_date, location, type, status)').eq('user_id', profileId).limit(8),
      ]);
      setProfile(profileRes.data ?? null);
      setCarnets((carnetsRes.data ?? []) as Carnet[]);
      setClubs((clubsRes.data ?? []) as unknown as ClubMembership[]);
      setEvents((eventsRes.data ?? []) as unknown as EventParticipation[]);
      setBadges(((badgesRes.data ?? []) as any[]).map((b) => b.badge).filter(Boolean));
      const { data: memberData } = await supabase.from('groupe_membres').select('group_id, role').eq('user_id', profileId).eq('status', 'active');
      if (memberData?.length) {
        const groupIds = memberData.map(m => m.group_id);
        const { data: groupsData } = await supabase.from('groupes').select('id, name, destination, theme, departure_date, return_date, visibility, group_level, optimization_score').in('id', groupIds).order('created_at', { ascending: false }).limit(8);
        const enriched = await Promise.all((groupsData || []).map(async (g) => {
          const { count } = await supabase.from('groupe_membres').select('*', { count: 'exact', head: true }).eq('group_id', g.id).eq('status', 'active');
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
      if (user) { const { data: followData } = await supabase.from('user_follows').select('id').eq('follower_id', user.id).eq('following_id', profileId).maybeSingle(); setIsFollowing(!!followData); }
      setLoading(false);
    };
    load();
  }, [profileId, supabase, user]);

  const handleFollow = async () => {
    if (!user) return;
    if (isFollowing) {
      await supabase.from('user_follows').delete().eq('follower_id', user.id).eq('following_id', profileId);
      setIsFollowing(false); setFollowersCount((c) => Math.max(0, c - 1)); showToast('Abonnement annulé');
    } else {
      await supabase.from('user_follows').insert({ follower_id: user.id, following_id: profileId });
      setIsFollowing(true); setFollowersCount((c) => c + 1); showToast('Abonné !');
    }
  };

  const isOwnProfile = user?.id === profileId;
  const initials = profile?.full_name ? profile.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : '?';
  const levelCfg = LEVEL_CFG[profile?.loyalty_level ?? ''] ?? { icon: '🥾' };
  const heroImg = HERO_IMAGES[0];

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-[#F5F2E8]">
          <Header />
          <main className="pt-20 pb-24">
            <div className="bg-[#1C2620] h-[40vh] min-h-[300px] w-full relative overflow-hidden">
              <div className="absolute inset-0 opacity-40 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              {profile?.avatar_url ? <Image src={profile.avatar_url} alt="Cover" fill className="object-cover opacity-60 mix-blend-overlay blur-sm" /> : <div className="absolute inset-0 bg-[#17402C]/10" />}
              <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-center">
                <div className="translate-y-1/2">
                  {profile?.avatar_url ? <img src={profile.avatar_url} alt={`Photo de ${profile.full_name}`} className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-[#F5F2E8] shadow-xl" />
                    : <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-[#17402C] flex items-center justify-center text-4xl md:text-5xl font-700 text-white border-4 border-[#F5F2E8] shadow-xl">{initials}</div>}
                </div>
              </div>
            </div>
            <div className="max-w-5xl mx-auto px-4 mt-20 md:mt-24">
              {loading ? <div className="flex flex-col items-center justify-center space-y-4 py-12"><div className="h-10 w-64 bg-[#C8C3B0]/30 rounded animate-pulse" /><div className="h-4 w-48 bg-[#C8C3B0]/30 rounded animate-pulse" /></div>
                : !profile ? <div className="text-center py-12"><p className="text-[#5C6B5E]">Profil introuvable</p></div>
                  : <><div className="text-center mb-12"><h1 className="font-display font-800 text-4xl md:text-5xl text-[#1C2620] mb-3">{profile.full_name}</h1></div></>
              }
            </div>
          </main>
          <Footer />
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div style={{ minHeight: '100dvh', background: '#F5F2E8', padding: '16px' }}>
            {loading ? <p style={{ color: 'rgba(28,38,32,0.5)' }}>Chargement…</p>
              : !profile ? <p style={{ color: 'rgba(28,38,32,0.5)' }}>Profil introuvable</p>
                : <div>
                  <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#1C2620', marginBottom: '4px' }}>{profile.full_name}</h1>
                  <p style={{ fontSize: '13px', color: 'rgba(28,38,32,0.5)', marginBottom: '16px' }}>{profile.location || 'Nomade'} · {levelCfg.icon} {profile.loyalty_level}</p>
                  <p style={{ fontSize: '13px', color: 'rgba(28,38,32,0.7)', marginBottom: '16px', lineHeight: '1.6' }}>{profile.bio || "Ce voyageur n'a pas encore écrit de biographie."}</p>
                </div>
            }
          </div>
        </MobilePageShell>
        
      </div>
    </>
  );
}
