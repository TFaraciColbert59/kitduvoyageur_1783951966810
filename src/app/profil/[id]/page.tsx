'use client';

import React, { useState, useEffect, useMemo } from 'react';

import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import NewFooterSection from '@/app/components/home/NewFooterSection';

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

interface Badge {
  id: string;
  name: string;
  icon: string;
  rarity: string;
}

interface GearItem {
  id: string;
  name: string;
  category: string;
  weight_g: number;
  brand: string;
  condition: string;
}

type ProfileTab = 'aventures' | 'photos' | 'recommandations';

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

// Simple SVG world map dots for visited countries
function WorldMapDots({ countries }: { countries: string[] }) {
  const dots = [
    { x: 48, y: 38, code: 'FR', label: 'France' },
    { x: 52, y: 35, code: 'NO', label: 'Norvège' },
    { x: 55, y: 42, code: 'IT', label: 'Italie' },
    { x: 60, y: 50, code: 'MA', label: 'Maroc' },
    { x: 72, y: 38, code: 'NP', label: 'Népal' },
    { x: 80, y: 42, code: 'JP', label: 'Japon' },
    { x: 25, y: 45, code: 'CA', label: 'Canada' },
    { x: 20, y: 55, code: 'MX', label: 'Mexique' },
    { x: 30, y: 60, code: 'PE', label: 'Pérou' },
    { x: 35, y: 65, code: 'CL', label: 'Chili' },
    { x: 58, y: 55, code: 'TZ', label: 'Tanzanie' },
    { x: 85, y: 70, code: 'NZ', label: 'N.-Zélande' },
  ];
  return (
    <div className="relative w-full" style={{ paddingBottom: '50%' }}>
      <div className="absolute inset-0 rounded-xl overflow-hidden" style={{ background: '#1C2620' }}>
        <svg viewBox="0 0 100 50" className="w-full h-full opacity-20">
          <rect width="100" height="50" fill="none" />
          {/* Simplified continent shapes */}
          <ellipse cx="48" cy="38" rx="8" ry="6" fill="#4A6741" opacity="0.6" />
          <ellipse cx="60" cy="50" rx="6" ry="4" fill="#4A6741" opacity="0.5" />
          <ellipse cx="72" cy="40" rx="10" ry="7" fill="#4A6741" opacity="0.5" />
          <ellipse cx="25" cy="42" rx="7" ry="9" fill="#4A6741" opacity="0.5" />
          <ellipse cx="30" cy="60" rx="4" ry="7" fill="#4A6741" opacity="0.4" />
          <ellipse cx="85" cy="68" rx="4" ry="3" fill="#4A6741" opacity="0.4" />
        </svg>
        {dots.map((dot) => {
          const visited = countries.includes(dot.code);
          return (
            <div
              key={dot.code}
              className="absolute group"
              style={{ left: `${dot.x}%`, top: `${dot.y}%`, transform: 'translate(-50%, -50%)' }}
            >
              <div
                className={`w-2 h-2 rounded-full transition-all ${visited ? 'bg-[#E4501C] shadow-[0_0_6px_rgba(228,80,28,0.8)]' : 'bg-white/20'}`}
              />
              {visited && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-[#E4501C] text-white text-[8px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {dot.label}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ProfilDetailPage() {
  const params = useParams();
  const profileId = params?.id as string;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [carnets, setCarnets] = useState<Carnet[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [gearItems, setGearItems] = useState<GearItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>('aventures');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [selectedCarnet, setSelectedCarnet] = useState<Carnet | null>(null);
  const [posts, setPosts] = useState<{ id: string; post_type: string; content: string; created_at: string; likes_count: number; comments_count: number }[]>([]);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!profileId) return;
    const load = async () => {
      setLoading(true);
      const [profileRes, carnetsRes, badgesRes, gearRes] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', profileId).single(),
        supabase.from('carnets').select('*').eq('author_id', profileId).eq('visibility', 'public').order('created_at', { ascending: false }).limit(8),
        supabase.from('user_badges').select('badge_id, badge:badges(id, name, icon, rarity)').eq('user_id', profileId).limit(9),
        supabase.from('gear_items').select('id, name, category, weight_g, brand, condition').eq('user_id', profileId).limit(4),
      ]);
      setProfile(profileRes.data ?? null);
      setCarnets((carnetsRes.data ?? []) as Carnet[]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setBadges(((badgesRes.data ?? []) as any[]).map((b) => b.badge).filter(Boolean));
      setGearItems((gearRes.data ?? []) as GearItem[]);
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
    if (!user) return;
    if (isFollowing) {
      await supabase.from('user_follows').delete().eq('follower_id', user.id).eq('following_id', profileId);
      setIsFollowing(false);
      setFollowersCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from('user_follows').insert({ follower_id: user.id, following_id: profileId });
      setIsFollowing(true);
      setFollowersCount((c) => c + 1);
    }
  };

  const isOwnProfile = user?.id === profileId;
  const initials = profile?.full_name ? profile.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : '?';
  const levelCfg = LEVEL_CFG[profile?.loyalty_level ?? ''] ?? { icon: '🥾' };
  const heroImg = HERO_IMAGES[0];

  const displayCarnets = carnets.length > 0 ? carnets : MOCK_ADVENTURES.map(a => ({
    id: a.id, title: a.title, destination: a.subtitle, description: '', cover_image: a.src, cover_image_alt: a.alt,
    start_date: null, end_date: null, weather: '', route_rating: 8, visibility: 'public', tags: [],
    likes_count: 0, comments_count: 0, favorites_count: 0, views_count: 0, verified: false, is_collaborative: false, created_at: '',
  }));

  const displayBadges = badges.length > 0
    ? MOCK_BADGES.map((mb, i) => ({ ...mb, unlocked: i < badges.length }))
    : MOCK_BADGES;

  const displayKit = gearItems.length > 0
    ? gearItems.map((g) => ({ id: g.id, name: g.name, detail: g.brand || g.condition, weight: g.weight_g ? `${g.weight_g} g` : '—', src: MOCK_KIT[0].src, alt: `Équipement ${g.name}` }))
    : MOCK_KIT;

  const TABS: { id: ProfileTab; label: string; count: number }[] = [
    { id: 'aventures', label: 'Aventures', count: displayCarnets.length },
    { id: 'photos', label: 'Photos', count: PHOTO_JOURNAL.length },
    { id: 'recommandations', label: 'Recommandations', count: 46 },
  ];

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: '#F5F2EC' }}>
        <Header />
        <div className="pt-20 flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-[#1C2620] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#F5F2EC', fontFamily: 'var(--font-sans)' }}>
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
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#4A6741] rounded-full border-2 border-white flex items-center justify-center">
                <Icon name="CheckIcon" size={10} className="text-white" />
              </div>
            </div>
            <div className="pb-1">
              <p className="text-xs text-[#7A7A6E]">
                {profile?.location ?? 'Chartreuse'} · Membre depuis {profile?.created_at ? new Date(profile.created_at).getFullYear() : 2019}
              </p>
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

      <NewFooterSection />
    </div>
  );
}
