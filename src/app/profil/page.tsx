'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  cover_image: string;
  cover_image_alt: string;
  start_date: string | null;
  created_at: string;
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

const HERO_IMG = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&q=80';

const PHOTO_JOURNAL = [
  { src: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80', alt: 'Randonneur au sommet des montagnes au coucher du soleil' },
  { src: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=80', alt: 'Vue aérienne de forêt de pins dans la brume matinale' },
  { src: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=80', alt: 'Bivouac sous un ciel étoilé en montagne' },
  { src: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', alt: 'Lac de montagne aux eaux turquoise entouré de sommets' },
  { src: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=600&q=80', alt: 'Tente de camping installée sur un plateau rocheux' },
];

const MOCK_KIT = [
  { id: '1', name: 'Sac 45 L', detail: 'Vert forêt · 3 ans d\'usage', weight: '1,4 kg', src: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=80&q=80', alt: 'Sac à dos de randonnée vert 45 litres' },
  { id: '2', name: 'Duvet 3 saisons', detail: '-10 °C', weight: '920 g', src: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=80&q=80', alt: 'Duvet de camping trois saisons compressé' },
  { id: '3', name: 'Veste 3 couches', detail: 'Forêt · 2 ans', weight: '480 g', src: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=80&q=80', alt: 'Veste imperméable trois couches verte' },
  { id: '4', name: 'Gourde titane', detail: '1 L · rouge', weight: '188 g', src: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=80&q=80', alt: 'Gourde en titane rouge de 1 litre' },
];

const MOCK_BADGES = [
  { id: '1', name: 'Sommet 3000', icon: '⛰️', unlocked: true, desc: 'Or · 2 ans' },
  { id: '2', name: '10 bivouacs', icon: '🏕️', unlocked: true, desc: 'Argent · 2 ans' },
  { id: '3', name: 'Écolo', icon: '🌿', unlocked: true, desc: 'Commun · 2 ans' },
  { id: '4', name: 'Guide', icon: '🧭', unlocked: true, desc: 'Or · Kit' },
  { id: '5', name: 'Boussole', icon: '🔵', unlocked: true, desc: 'Commun · Orienteur' },
  { id: '6', name: '6 h/jour', icon: '⏱️', unlocked: true, desc: 'Argent · Marcheur' },
  { id: '7', name: 'Verrouillé', icon: '🔒', unlocked: false, desc: '—' },
  { id: '8', name: 'Verrouillé', icon: '🔒', unlocked: false, desc: '—' },
  { id: '9', name: 'Verrouillé', icon: '🔒', unlocked: false, desc: '—' },
];

const MOCK_ADVENTURES = [
  { id: '1', title: 'Cabane du Grand Vaneau', destination: '3 nuits · Chartreuse · 27,4 km', cover_image: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=80', cover_image_alt: 'Cabane en bois dans une forêt de pins brumeuse', start_date: '2026-08-14', created_at: '' },
  { id: '2', title: 'Bivouac étoilé · Vercors', destination: '2 nuits · Plateau haut · 18,6 km', cover_image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=80', cover_image_alt: 'Tente sous un ciel étoilé dans le Vercors', start_date: '2026-08-02', created_at: '' },
  { id: '3', title: 'Traversée des Écrins', destination: '6 jours · Alpes · 62 km', cover_image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80', cover_image_alt: 'Traversée des massifs des Écrins en été', start_date: '2026-07-01', created_at: '' },
  { id: '4', title: 'Kayak · Serre-Ponçon', destination: '1 jour · Hautes-Alpes · 14 km', cover_image: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', cover_image_alt: 'Kayak sur le lac de Serre-Ponçon', start_date: '2026-06-15', created_at: '' },
];

function WorldMapDots() {
  const dots = [
    { x: 48, y: 38, visited: true, label: 'France' },
    { x: 52, y: 32, visited: true, label: 'Norvège' },
    { x: 55, y: 42, visited: true, label: 'Italie' },
    { x: 60, y: 50, visited: true, label: 'Maroc' },
    { x: 72, y: 38, visited: true, label: 'Népal' },
    { x: 80, y: 42, visited: true, label: 'Japon' },
    { x: 25, y: 45, visited: false, label: 'Canada' },
    { x: 30, y: 60, visited: false, label: 'Pérou' },
    { x: 58, y: 55, visited: true, label: 'Tanzanie' },
    { x: 85, y: 70, visited: false, label: 'N.-Zélande' },
  ];
  return (
    <div className="relative w-full" style={{ paddingBottom: '48%' }}>
      <div className="absolute inset-0 rounded-xl overflow-hidden" style={{ background: '#1C2620' }}>
        <svg viewBox="0 0 100 48" className="w-full h-full opacity-15">
          <ellipse cx="48" cy="38" rx="8" ry="6" fill="#4A6741" />
          <ellipse cx="60" cy="48" rx="6" ry="4" fill="#4A6741" />
          <ellipse cx="72" cy="38" rx="10" ry="7" fill="#4A6741" />
          <ellipse cx="25" cy="40" rx="7" ry="9" fill="#4A6741" />
          <ellipse cx="30" cy="58" rx="4" ry="7" fill="#4A6741" />
          <ellipse cx="85" cy="66" rx="4" ry="3" fill="#4A6741" />
        </svg>
        {dots.map((dot, i) => (
          <div key={i} className="absolute group" style={{ left: `${dot.x}%`, top: `${dot.y}%`, transform: 'translate(-50%, -50%)' }}>
            <div className={`w-2 h-2 rounded-full transition-all ${dot.visited ? 'bg-[#E4501C] shadow-[0_0_6px_rgba(228,80,28,0.8)]' : 'bg-white/15'}`} />
            {dot.visited && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-[#E4501C] text-white text-[8px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {dot.label}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProfilPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [carnets, setCarnets] = useState<Carnet[]>([]);
  const [gearItems, setGearItems] = useState<GearItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>('aventures');
  const [followersCount, setFollowersCount] = useState(0);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const load = async () => {
      setLoading(true);
      const [profileRes, carnetsRes, gearRes] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', user.id).single(),
        supabase.from('carnets').select('id, title, destination, cover_image, cover_image_alt, start_date, created_at').eq('author_id', user.id).order('created_at', { ascending: false }).limit(4),
        supabase.from('gear_items').select('id, name, category, weight_g, brand, condition').eq('user_id', user.id).limit(4),
      ]);
      setProfile(profileRes.data ?? null);
      setCarnets((carnetsRes.data ?? []) as Carnet[]);
      setGearItems((gearRes.data ?? []) as GearItem[]);
      const { count } = await supabase.from('user_follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id);
      setFollowersCount(count ?? 0);
      setLoading(false);
    };
    load();
  }, [user, supabase]);

  const initials = profile?.full_name ? profile.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : (user?.email?.[0]?.toUpperCase() ?? '?');
  const displayCarnets = carnets.length > 0 ? carnets : MOCK_ADVENTURES;
  const displayKit = gearItems.length > 0
    ? gearItems.map((g) => ({ id: g.id, name: g.name, detail: g.brand || g.condition, weight: g.weight_g ? `${g.weight_g} g` : '—', src: MOCK_KIT[0].src, alt: `Équipement ${g.name}` }))
    : MOCK_KIT;

  const TABS: { id: ProfileTab; label: string; count: number }[] = [
    { id: 'aventures', label: 'Aventures', count: displayCarnets.length },
    { id: 'photos', label: 'Photos', count: PHOTO_JOURNAL.length },
    { id: 'recommandations', label: 'Recommandations', count: 46 },
  ];

  if (!user) {
    return (
      <div className="min-h-screen" style={{ background: '#F5F2EC' }}>
        <Header />
        <div className="pt-32 text-center px-4">
          <h1 className="text-3xl font-bold text-[#1C2620] mb-4">Votre profil</h1>
          <p className="text-[#7A7A6E] mb-6">Connectez-vous pour accéder à votre profil.</p>
          <Link href="/connexion" className="inline-flex items-center gap-2 bg-[#1C2620] text-white px-6 py-3 rounded-full font-semibold text-sm hover:bg-[#1C2620]/80 transition-all">
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

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

      {/* ── HERO PLEIN ÉCRAN ── */}
      <div className="relative h-[50vh] min-h-[320px] overflow-hidden">
        <Image src={HERO_IMG} alt="Paysage de montagne — votre profil voyageur" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70" />
        <div className="absolute top-24 left-6 md:left-10">
          <span className="text-[10px] font-mono tracking-[0.2em] uppercase bg-[#E4501C]/90 text-white px-3 py-1.5 rounded-full backdrop-blur-sm">
            + {profile?.loyalty_level ?? 'Explorateur'} · {profile?.location ?? 'France'}
          </span>
        </div>
        <div className="absolute bottom-8 left-6 md:left-10 right-6">
          <h1 className="text-4xl md:text-6xl font-bold text-white leading-none tracking-tight">
            {profile?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'Mon'}{' '}
            <em className="font-light italic" style={{ fontFamily: 'Georgia, serif' }}>
              {profile?.full_name?.split(' ').slice(1).join(' ') ?? 'Profil'}
            </em>
          </h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-8">
        {/* ── AVATAR + ACTIONS ── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-12 mb-8 relative z-10">
          <div className="flex items-end gap-4">
            <div className="relative flex-shrink-0">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt={`Photo de profil de ${profile.full_name}`} className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-xl" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-[#1C2620] flex items-center justify-center text-2xl font-bold text-white border-4 border-white shadow-xl">
                  {initials}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#4A6741] rounded-full border-2 border-white flex items-center justify-center">
                <Icon name="CheckIcon" size={10} className="text-white" />
              </div>
            </div>
            <div className="pb-1">
              <p className="text-xs text-[#7A7A6E]">
                {profile?.location ?? 'France'} · Membre depuis {profile?.created_at ? new Date(profile.created_at).getFullYear() : new Date().getFullYear()}
              </p>
            </div>
          </div>
          <div className="flex gap-2 pb-1">
            <Link href="/compte" className="flex items-center gap-2 px-5 py-2.5 bg-[#1C2620] text-white rounded-full text-sm font-semibold hover:bg-[#1C2620]/80 transition-all">
              <Icon name="PencilIcon" size={14} className="text-white" /> Modifier le profil
            </Link>
            <Link href="/messagerie" className="flex items-center gap-2 px-5 py-2.5 border border-[#C8C3B0] rounded-full text-sm font-semibold text-[#1C2620] hover:border-[#1C2620] transition-all">
              <Icon name="ChatBubbleLeftIcon" size={14} /> Message
            </Link>
          </div>
        </div>

        {/* ── STATS ── */}
        <div className="flex flex-wrap gap-8 mb-8 pb-6 border-b border-[#E8E4DA]">
          {[
            { value: '32', label: 'sommets', sub: 'explorés' },
            { value: '1 240', label: 'km', sub: 'parcourus' },
            { value: '18', label: 'refuges', sub: 'recommandés' },
            { value: String(followersCount || 214), label: 'voyageurs', sub: 'reçus' },
            { value: '4,9', label: '★', sub: 'note moyenne' },
          ].map((s) => (
            <div key={s.label} className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[#1C2620]">{s.value}</span>
              <div>
                <span className="text-sm font-semibold text-[#1C2620]">{s.label}</span>
                <p className="text-[10px] text-[#7A7A6E] uppercase tracking-wider leading-none mt-0.5">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── LAYOUT 2 COLONNES ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          {/* Colonne gauche */}
          <div className="lg:col-span-2 space-y-10">

            {/* ONGLETS */}
            <div>
              <div className="flex gap-1 mb-6 border-b border-[#E8E4DA]">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2.5 text-sm font-medium transition-all relative ${activeTab === tab.id ? 'text-[#1C2620]' : 'text-[#7A7A6E] hover:text-[#1C2620]'}`}
                  >
                    {tab.label}
                    <span className="ml-1.5 text-xs text-[#7A7A6E]">· {tab.count}</span>
                    {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1C2620] rounded-full" />}
                  </button>
                ))}
              </div>

              {activeTab === 'aventures' && (
                <div>
                  <div className="flex items-baseline justify-between mb-4">
                    <h2 className="text-xl font-bold text-[#1C2620]">
                      Aventures <em className="font-light italic" style={{ fontFamily: 'Georgia, serif' }}>récentes.</em>
                    </h2>
                    <Link href="/carnets" className="text-xs text-[#7A7A6E] hover:text-[#1C2620]">Voir tout · {displayCarnets.length} →</Link>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {displayCarnets.slice(0, 4).map((c) => (
                      <Link key={c.id} href="/carnets" className="group relative rounded-2xl overflow-hidden aspect-[4/3] block">
                        <Image src={c.cover_image || MOCK_ADVENTURES[0].cover_image} alt={c.cover_image_alt || c.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        {c.start_date && (
                          <span className="absolute top-3 left-3 text-[10px] font-mono text-white/80 bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full">
                            {new Date(c.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                        <div className="absolute bottom-3 left-3 right-3">
                          <p className="font-bold text-white text-sm leading-tight">{c.title}</p>
                          <p className="text-white/60 text-[10px] mt-0.5">{c.destination}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'photos' && (
                <div>
                  <div className="flex items-baseline justify-between mb-4">
                    <h2 className="text-xl font-bold text-[#1C2620]">Journal <em className="font-light italic" style={{ fontFamily: 'Georgia, serif' }}>photo.</em></h2>
                    <span className="text-xs text-[#7A7A6E]">+ 214 photos →</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {PHOTO_JOURNAL.map((p, i) => (
                      <div key={i} className={`relative rounded-xl overflow-hidden ${i === 0 ? 'col-span-2 row-span-2' : ''} aspect-square`}>
                        <Image src={p.src} alt={p.alt} fill className="object-cover hover:scale-105 transition-transform duration-500 cursor-pointer" />
                        {i === PHOTO_JOURNAL.length - 1 && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="text-white text-sm font-semibold">+ 214 photos</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'recommandations' && (
                <div>
                  <div className="flex items-baseline justify-between mb-4">
                    <h2 className="text-xl font-bold text-[#1C2620]">Recommandations <em className="font-light italic" style={{ fontFamily: 'Georgia, serif' }}>refuges.</em></h2>
                  </div>
                  <div className="space-y-3">
                    {['Grand Vaneau · Chartreuse', 'Bellefont · Vercors', 'Refuge de la Selle · Écrins', 'Cabane de Pré Peyret · Chartreuse'].map((r, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-[#E8E4DA] hover:border-[#1C2620]/20 transition-all">
                        <div className="w-10 h-10 rounded-xl bg-[#1C2620]/5 flex items-center justify-center flex-shrink-0">
                          <Icon name="HomeIcon" size={18} className="text-[#1C2620]" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-[#1C2620]">{r}</p>
                          <div className="flex items-center gap-0.5 mt-0.5">
                            {[1,2,3,4,5].map((s) => <span key={s} className="text-[#E4501C] text-xs">★</span>)}
                          </div>
                        </div>
                        <Icon name="ArrowRightIcon" size={14} className="text-[#7A7A6E]" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* CARTE MONDE */}
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-lg font-bold text-[#1C2620]">
                  Là où <em className="font-light italic" style={{ fontFamily: 'Georgia, serif' }}>vous êtes passé.</em>
                </h2>
                <span className="text-xs text-[#7A7A6E]">12 pays · 4 continents</span>
              </div>
              <div className="rounded-2xl overflow-hidden border border-[#E8E4DA]">
                <WorldMapDots />
                <div className="bg-[#1C2620] px-5 py-3 flex flex-wrap gap-6">
                  {[
                    { label: 'Pays visités', value: '12 pays' },
                    { label: 'Ce trimestre', value: 'Chartreuse · Vercors' },
                    { label: 'Prochain', value: 'Écrins · Sept.' },
                  ].map((item) => (
                    <div key={item.label}>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">{item.label}</p>
                      <p className="text-white font-bold text-sm">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* JOURNAL PHOTO */}
            <div>
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-xl font-bold text-[#1C2620]">Journal <em className="font-light italic" style={{ fontFamily: 'Georgia, serif' }}>photo.</em></h2>
                <Link href="/carnets" className="text-xs text-[#4A6741] hover:text-[#1C2620]">Voir le journal complet →</Link>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 relative rounded-2xl overflow-hidden" style={{ aspectRatio: '1' }}>
                  <Image src={PHOTO_JOURNAL[0].src} alt={PHOTO_JOURNAL[0].alt} fill className="object-cover hover:scale-105 transition-transform duration-500 cursor-pointer" />
                </div>
                {PHOTO_JOURNAL.slice(1, 3).map((p, i) => (
                  <div key={i} className="relative rounded-2xl overflow-hidden aspect-square">
                    <Image src={p.src} alt={p.alt} fill className="object-cover hover:scale-105 transition-transform duration-500 cursor-pointer" />
                  </div>
                ))}
                {PHOTO_JOURNAL.slice(3).map((p, i) => (
                  <div key={i} className="relative rounded-2xl overflow-hidden aspect-square">
                    <Image src={p.src} alt={p.alt} fill className="object-cover hover:scale-105 transition-transform duration-500 cursor-pointer" />
                    {i === PHOTO_JOURNAL.slice(3).length - 1 && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-2xl">
                        <span className="text-white text-xs font-semibold">+ 214 photos</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Colonne droite */}
          <div className="space-y-6">
            {/* À propos */}
            <div className="bg-white rounded-2xl border border-[#E8E4DA] p-5">
              <p className="text-[10px] font-mono text-[#7A7A6E] uppercase tracking-[0.2em] mb-3">À propos</p>
              <blockquote className="text-sm text-[#1C2620] leading-relaxed italic mb-4" style={{ fontFamily: 'Georgia, serif' }}>
                &ldquo;{profile?.bio ?? 'Je garde deux refuges dans la Chartreuse depuis douze ans. Le silence est mon métier.'}&rdquo;
              </blockquote>
              <div className="space-y-2 text-xs">
                {[
                  { label: 'Rôle', value: profile?.loyalty_level ?? 'Gardienne partenaire' },
                  { label: 'Refuges', value: 'Grand Vaneau, Bellefont' },
                  { label: 'Discipline', value: 'Rando, ski de rando' },
                  { label: 'Langues', value: 'Français, anglais, italien' },
                  { label: 'Répond en', value: '< 1 h' },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between gap-2">
                    <span className="text-[#7A7A6E]">{row.label}</span>
                    <span className="text-[#1C2620] font-medium text-right">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* BADGES */}
            <div className="bg-white rounded-2xl border border-[#E8E4DA] p-5">
              <p className="text-[10px] font-mono text-[#7A7A6E] uppercase tracking-[0.2em] mb-4">Badges · {MOCK_BADGES.filter(b => b.unlocked).length} débloqués</p>
              <div className="grid grid-cols-3 gap-3">
                {MOCK_BADGES.map((badge) => (
                  <div key={badge.id} className={`flex flex-col items-center gap-1 p-2 rounded-xl ${badge.unlocked ? 'bg-[#F5F2EC]' : 'bg-[#F5F2EC]/50 opacity-40'}`}>
                    <span className="text-xl">{badge.icon}</span>
                    <p className="text-[9px] font-semibold text-[#1C2620] text-center leading-tight">{badge.name}</p>
                    <p className="text-[8px] text-[#7A7A6E]">{badge.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* SON KIT */}
            <div className="bg-white rounded-2xl border border-[#E8E4DA] p-5">
              <div className="flex items-baseline justify-between mb-4">
                <p className="text-[10px] font-mono text-[#7A7A6E] uppercase tracking-[0.2em]">Mon kit · {displayKit.length} pièces</p>
                <Link href="/inventaire" className="text-[10px] text-[#4A6741] hover:text-[#1C2620]">Voir →</Link>
              </div>
              <div className="space-y-3">
                {displayKit.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-[#F5F2EC]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.src} alt={item.alt} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#1C2620] truncate">{item.name}</p>
                      <p className="text-[10px] text-[#7A7A6E] truncate">{item.detail}</p>
                    </div>
                    <span className="text-[10px] font-mono text-[#7A7A6E] flex-shrink-0">{item.weight}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <NewFooterSection />
    </div>
  );
}
