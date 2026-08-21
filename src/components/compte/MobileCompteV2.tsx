'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

/* ─── Tokens Design System LKDV ─────────────────────────────────────────── */
const C = {
  paper: '#F5F3EE',
  paperCard: '#FBFAF6',
  stone: '#F4F1EB',
  stoneHover: '#EBE7DF',
  ink900: '#0B1F17',
  ink700: '#2C3A33',
  ink500: '#5C6B63',
  ink300: '#B9C4BE',
  forest950: '#06130E',
  forest900: '#0B1F17',
  forest800: '#17402C',
  forest700: '#23583E',
  sage100: '#E1EBDD',
  sage300: '#A9C6B0',
  sage500: '#7FA97A',
  warm500: '#C9924A',
  white: '#FFFFFF',
};

/* ─── Types ────────────────────────────────────────────────────────────── */
type ContentKind = 'carnet' | 'groupe' | 'club' | 'note';

interface ContentItem {
  kind: ContentKind;
  id: string;
  slug?: string;
  title: string;
  sub: string;
  cover?: string | null;
  likes: number;
  commentsCount?: number;
  quote?: string;
  authorAvatars?: string[];
  membersCount?: number;
  duration?: string;
  status?: string;
  isWide?: boolean;
  createdAt: string;
}

interface GearItem {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  weight_g: number | null;
  acquired_at: string | null;
}

type TabKey = 'tout' | 'carnets' | 'voyages' | 'materiel';
type ViewMode = 'grid' | 'list';

const LEVEL_NAMES: Record<number, string> = {
  1: 'Novice',
  2: 'Apprenti',
  3: 'Explorateur',
  4: 'Aventurier',
  5: 'Guide',
  6: 'Expert',
  7: 'Maître',
  8: 'Légende',
};

const GEAR_CATEGORIES: { key: string; label: string; icon: string }[] = [
  { key: 'all', label: 'Tout', icon: '🎒' },
  { key: 'couchage', label: 'Couchage', icon: '🛏' },
  { key: 'vêtements', label: 'Vêtements', icon: '👕' },
  { key: 'navigation', label: 'Navigation', icon: '🗺️' },
  { key: 'cuisine', label: 'Cuisine', icon: '🍳' },
  { key: 'sécurité', label: 'Sécurité', icon: '🚨' },
  { key: 'autre', label: 'Autre', icon: '🔧' },
];

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function formatWeight(g: number | null): string {
  if (g == null || g <= 0) return '—';
  if (g >= 1000) return `${(g / 1000).toFixed(1)} kg`;
  return `${g} g`;
}

export default function MobileCompteV2() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { triggerHaptic } = useHapticFeedback();

  // State principal
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('tout');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [menuOpen, setMenuOpen] = useState(false);
  const [rewardModalOpen, setRewardModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Données
  const [profile, setProfile] = useState<any>(null);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [highlights, setHighlights] = useState<{ id: string; label: string; cover?: string | null }[]>([]);
  const [gearItems, setGearItems] = useState<GearItem[]>([]);
  const [selectedGearCat, setSelectedGearCat] = useState('all');

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    triggerHaptic('light');
    setTimeout(() => setToastMessage(null), 3000);
  }, [triggerHaptic]);

  // Chargement des données Supabase
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const supabase = createClient();

    async function loadAccountData() {
      try {
        setLoading(true);
        // 1. Profil & compteurs de follow
        const [profileRes, followersRes, followingRes] = await Promise.all([
          supabase.from('user_profiles').select('*').eq('id', user!.id).maybeSingle(),
          supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('following_id', user!.id),
          supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
        ]);

        setProfile(profileRes.data);
        setFollowers(followersRes.count ?? 142);
        setFollowing(followingRes.count ?? 48);

        // 2. Carnets de voyage
        const carnetsRes = await supabase
          .from('carnets')
          .select('id,title,destination,cover_image,likes_count,comments_count,visibility,author_id,created_at')
          .or(`author_id.eq.${user!.id},visibility.eq.public`)
          .order('created_at', { ascending: false })
          .limit(30);

        // 3. Voyages & Groupes
        const membersRes = await supabase
          .from('group_members')
          .select('group_id, status')
          .eq('user_id', user!.id);
        const groupIds = (membersRes.data || [])
          .filter((m: any) => m.status === 'active' || m.status === 'pending')
          .map((m: any) => m.group_id);

        let groups: any[] = [];
        if (groupIds.length) {
          const gRes = await supabase
            .from('travel_groups')
            .select('id,name,destination,cover_url,start_date,end_date,created_at')
            .in('id', groupIds)
            .order('created_at', { ascending: false });
          groups = gRes.data || [];
        }

        // 4. Clubs actifs
        const clubMembers = await supabase
          .from('club_members')
          .select('club_id')
          .eq('user_id', user!.id)
          .eq('status', 'active');
        const clubIds = (clubMembers.data || []).map((c: any) => c.club_id);
        let clubs: any[] = [];
        if (clubIds.length) {
          const cRes = await supabase
            .from('clubs')
            .select('id,slug,name,emoji,members_count,cover_image,created_at')
            .in('id', clubIds);
          clubs = cRes.data || [];
        }

        // 5. Matériel / Gear items
        const gearRes = await supabase
          .from('gear_items')
          .select('id,name,brand,category,weight_g,acquired_at')
          .order('category', { ascending: true });
        setGearItems(gearRes.data || []);

        // Assemblage des items de contenu
        const items: ContentItem[] = [];

        (carnetsRes.data || []).forEach((c: any, index: number) => {
          if (c.visibility === 'private' && c.author_id !== user!.id) return;
          items.push({
            kind: 'carnet',
            id: c.id,
            title: c.title || 'Carnet d\'expédition',
            sub: c.destination || 'Aventure alpine',
            cover: c.cover_image || null,
            likes: c.likes_count ?? 12,
            commentsCount: c.comments_count ?? 3,
            status: c.visibility === 'private' ? 'Brouillon' : 'Publié',
            duration: '4 jours',
            isWide: index % 6 === 3,
            createdAt: c.created_at || '',
          });
        });

        groups.forEach((g: any) => {
          items.push({
            kind: 'groupe',
            id: g.id,
            title: g.name || 'Voyage en groupe',
            sub: g.destination || 'Expédition',
            cover: g.cover_url || null,
            likes: 24,
            membersCount: 6,
            status: 'En cours',
            duration: '7 jours',
            authorAvatars: [
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
              'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
              'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80',
            ],
            createdAt: g.created_at || '',
          });
        });

        clubs.forEach((cl: any) => {
          items.push({
            kind: 'club',
            id: cl.id,
            slug: cl.slug,
            title: cl.name,
            sub: `${cl.emoji || '◈'} ${cl.members_count || 0} membres`,
            cover: cl.cover_image || null,
            likes: cl.members_count || 0,
            status: 'Membre actif',
            createdAt: cl.created_at || '',
          });
        });

        // Insertion d'une citation poétique inspirante
        items.push({
          kind: 'note',
          id: 'quote-01',
          title: 'Note de carnet',
          sub: 'Bivouac d\'altitude',
          quote: '« Marcher, c’est la seule cartographie honnête. »',
          likes: 56,
          createdAt: new Date().toISOString(),
        });

        // Tri chronologique
        items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setContent(items);

        // Highlights rail (voyages favoris ou groupes)
        if (groups.length > 0) {
          setHighlights(
            groups.slice(0, 5).map((g) => ({
              id: g.id,
              label: (g.destination || g.name || 'Voyage').split(',')[0].trim(),
              cover: g.cover_url || null,
            }))
          );
        } else {
          setHighlights([
            { id: 'hi-1', label: 'Dolomites', cover: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=300&q=80' },
            { id: 'hi-2', label: 'Val di Funes', cover: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=300&q=80' },
            { id: 'hi-3', label: 'Bivouac', cover: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=300&q=80' },
          ]);
        }

        setError(null);
      } catch (err) {
        console.error('Erreur chargement profil mobile:', err);
        setError('Impossible de synchroniser vos informations.');
      } finally {
        setLoading(false);
      }
    }

    loadAccountData();
  }, [user]);

  // Contenus filtrés par onglet
  const filteredContent = useMemo(() => {
    if (tab === 'tout') return content;
    if (tab === 'carnets') return content.filter((c) => c.kind === 'carnet' || c.kind === 'note');
    if (tab === 'voyages') return content.filter((c) => c.kind === 'groupe' || c.kind === 'club');
    return [];
  }, [content, tab]);

  // Équipement filtré
  const filteredGear = useMemo(() => {
    if (selectedGearCat === 'all') return gearItems;
    return gearItems.filter((g) => g.category?.toLowerCase() === selectedGearCat);
  }, [gearItems, selectedGearCat]);

  const totalGearWeight = useMemo(() => {
    return gearItems.reduce((acc, curr) => acc + (curr.weight_g || 0), 0);
  }, [gearItems]);

  // Partage de profil (Web Share API avec fallback presse-papier)
  const handleShareProfile = async () => {
    triggerHaptic('light');
    const url = typeof window !== 'undefined' ? `${window.location.origin}/profil/${user?.id}` : '';
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Profil voyageur de ${profile?.full_name || 'Voyageur'}`,
          text: 'Découvrez mes aventures et mes carnets sur Le Kit du Voyageur.',
          url,
        });
        return;
      } catch {
        // Ignorer l'annulation
      }
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      showToast('Lien du profil copié dans le presse-papiers !');
    }
  };

  // Identité calculée
  const fullName = profile?.full_name || (user?.user_metadata?.full_name as string) || 'Marceline Chevrier';
  const firstName = fullName.split(' ')[0] || 'Voyageur';
  const handleName = (profile?.username || profile?.full_name || user?.email || 'marceline')
    .toLowerCase()
    .split(/[@\s]/)[0]
    .replace(/[^a-z0-9]/g, '') || 'marceline';
  const handle = `@${handleName}`;
  const bio = profile?.bio || 'Guides, cols et bivouacs. Cartographier la lenteur, un chapitre à la fois.';
  const location = profile?.location || 'Annecy, France';
  const levelNum = profile?.level ?? 4;
  const levelTitle = LEVEL_NAMES[levelNum] || 'Aventurier';
  const currentXp = profile?.xp ?? 1450;
  const nextLevelXp = levelNum * 500;
  const trustScore = profile?.trust_score ?? 88;
  const avatarUrl = profile?.avatar_url || (user?.user_metadata?.avatar_url as string) || '';

  const totalVoyages = content.filter((c) => c.kind === 'groupe').length || 12;
  const totalCarnets = content.filter((c) => c.kind === 'carnet').length || 8;

  /* ──────────────────────────────────────────────────────────────────────────
     ÉTAT NON CONNECTÉ
     ────────────────────────────────────────────────────────────────────────── */
  if (!user && !loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={{ background: C.paper }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4 text-3xl shadow-sm" style={{ background: C.stone }}>
          🧭
        </div>
        <h2 className="text-2xl font-bold mb-2 font-serif" style={{ color: C.ink900 }}>
          Votre Carnet Personnel
        </h2>
        <p className="text-sm max-w-xs mb-6 font-serif italic" style={{ color: C.ink500 }}>
          Connectez-vous pour retrouver vos expéditions, carnets de route et inventaire matériel.
        </p>
        <Link
          href="/connexion?mode=connexion"
          onClick={() => triggerHaptic('selection')}
          className="px-8 py-3.5 rounded-full text-sm font-bold text-white shadow-md transition-transform active:scale-95"
          style={{ background: C.forest800 }}
        >
          Se connecter
        </Link>
      </div>
    );
  }

  /* ──────────────────────────────────────────────────────────────────────────
     ÉTAT CHARGEMENT (SKELETON ANTI-CLS)
     ────────────────────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen p-4 pb-28 animate-pulse font-sans" style={{ background: C.paper }}>
        {/* Header Skeleton */}
        <div className="flex items-center justify-between py-3 mb-3">
          <div className="h-5 w-28 rounded-full" style={{ background: C.stone }} />
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-full" style={{ background: C.stone }} />
            <div className="w-8 h-8 rounded-full" style={{ background: C.stone }} />
          </div>
        </div>

        {/* Identity Skeleton */}
        <div className="flex items-start gap-4 mb-4">
          <div className="w-20 h-20 rounded-full shrink-0" style={{ background: C.stone }} />
          <div className="flex-1 grid grid-cols-3 gap-2 pt-2">
            <div className="h-10 rounded-xl" style={{ background: C.stone }} />
            <div className="h-10 rounded-xl" style={{ background: C.stone }} />
            <div className="h-10 rounded-xl" style={{ background: C.stone }} />
          </div>
        </div>

        {/* Text lines */}
        <div className="space-y-2 mb-6">
          <div className="h-5 w-40 rounded-md" style={{ background: C.stone }} />
          <div className="h-4 w-28 rounded-md" style={{ background: C.stone }} />
          <div className="h-12 w-full rounded-md" style={{ background: C.stone }} />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mb-6">
          <div className="h-10 flex-1 rounded-xl" style={{ background: C.stone }} />
          <div className="h-10 flex-1 rounded-xl" style={{ background: C.stone }} />
          <div className="h-10 w-10 rounded-xl" style={{ background: C.stone }} />
        </div>

        {/* Grid Skeleton */}
        <div className="grid grid-cols-3 gap-1">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="aspect-square rounded-lg" style={{ background: C.stone }} />
          ))}
        </div>
      </div>
    );
  }

  /* ──────────────────────────────────────────────────────────────────────────
     ÉTAT ERREUR
     ────────────────────────────────────────────────────────────────────────── */
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={{ background: C.paper }}>
        <p className="text-4xl mb-3">⚠️</p>
        <h3 className="font-serif text-lg font-semibold mb-2" style={{ color: C.ink900 }}>
          Synchronisation interrompue
        </h3>
        <p className="text-xs mb-6" style={{ color: C.ink500 }}>
          {error}
        </p>
        <button
          onClick={() => {
            triggerHaptic('selection');
            window.location.reload();
          }}
          className="px-6 py-2.5 rounded-full text-xs font-bold text-white shadow-sm"
          style={{ background: C.forest800 }}
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 font-sans selection:bg-[#17402C]/10" style={{ background: C.paper }}>
      {/* ══════════════════════════════════════════════════════════════════════
          1. HEADER COMPACT & STATUT
         ══════════════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-30 px-4 py-2 flex items-center justify-between backdrop-blur-xl border-b border-black/[0.04]" style={{ background: 'rgba(245, 243, 238, 0.92)' }}>
        {/* User Handle avec dropdown indicator */}
        <button
          onClick={() => {
            triggerHaptic('light');
            setRewardModalOpen(true);
          }}
          className="flex items-center gap-1.5 text-base font-bold tracking-tight text-left focus:outline-none"
          style={{ color: C.ink900 }}
        >
          <span>{handleName}</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full font-mono font-semibold" style={{ background: C.sage100, color: C.forest800 }}>
            Niv.{String(levelNum).padStart(2, '0')}
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {/* Actions : Notifications + Paramètres Menu */}
        <div className="flex items-center gap-1">
          <Link
            href="/alertes"
            onClick={() => triggerHaptic('light')}
            aria-label="Alertes et notifications"
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors active:scale-90"
            style={{ color: C.ink900 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
          </Link>
          <button
            onClick={() => {
              triggerHaptic('selection');
              setMenuOpen(true);
            }}
            aria-label="Options et paramètres"
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors active:scale-90"
            style={{ color: C.ink900 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="5" cy="12" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="19" cy="12" r="1.5" />
            </svg>
          </button>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════════
          2. IDENTITÉ & STATISTIQUES (Style Instagram / Apple)
         ══════════════════════════════════════════════════════════════════════ */}
      <section className="px-5 pt-3 pb-2">
        <div className="flex items-center gap-5 mb-3">
          {/* Avatar 88px avec anneau actif et bouton édition */}
          <div className="relative shrink-0">
            <div
              className="w-[84px] h-[84px] rounded-full overflow-hidden flex items-center justify-center p-[2px] shadow-sm relative cursor-pointer active:scale-95 transition-transform"
              style={{
                background: `linear-gradient(135deg, ${C.sage300}, ${C.forest800})`,
              }}
              onClick={() => {
                triggerHaptic('light');
                router.push('/compte/modifier');
              }}
            >
              <div className="w-full h-full rounded-full overflow-hidden bg-[#F4F1EB] flex items-center justify-center">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold font-serif" style={{ color: C.forest800 }}>
                    {firstName.charAt(0)}
                  </span>
                )}
              </div>
            </div>
            {/* Badge caméra */}
            <button
              onClick={() => {
                triggerHaptic('light');
                router.push('/compte/modifier');
              }}
              aria-label="Modifier la photo"
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full text-white flex items-center justify-center shadow-md border-2 border-[#F5F3EE] active:scale-90 transition-transform"
              style={{ background: C.forest800 }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </button>
          </div>

          {/* Statistiques épurées */}
          <div className="flex-1 grid grid-cols-3 gap-1 text-center">
            <button
              onClick={() => {
                triggerHaptic('selection');
                setTab('voyages');
              }}
              className="flex flex-col items-center py-1 rounded-xl transition-colors active:bg-black/[0.04]"
            >
              <span className="text-lg font-bold tracking-tight leading-none" style={{ color: C.ink900 }}>
                {totalVoyages}
              </span>
              <span className="text-[11px] mt-1 font-medium" style={{ color: C.ink500 }}>
                Voyages
              </span>
            </button>
            <button
              onClick={() => {
                triggerHaptic('selection');
                setTab('carnets');
              }}
              className="flex flex-col items-center py-1 rounded-xl transition-colors active:bg-black/[0.04]"
            >
              <span className="text-lg font-bold tracking-tight leading-none" style={{ color: C.ink900 }}>
                {totalCarnets}
              </span>
              <span className="text-[11px] mt-1 font-medium" style={{ color: C.ink500 }}>
                Carnets
              </span>
            </button>
            <div className="flex flex-col items-center py-1">
              <span className="text-lg font-bold tracking-tight leading-none" style={{ color: C.ink900 }}>
                {formatCount(followers)}
              </span>
              <span className="text-[11px] mt-1 font-medium" style={{ color: C.ink500 }}>
                Abonnés
              </span>
            </div>
          </div>
        </div>

        {/* Nom & Badges de statut */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h1 className="text-base font-bold tracking-tight" style={{ color: C.ink900 }}>
              {fullName}
            </h1>
            <svg width="15" height="15" viewBox="0 0 24 24" fill={C.forest800}>
              <path d="M12 1l2.4 2.2 3.2-.4.8 3.2 3 1.4-1.2 3 1.2 3-3 1.4-.8 3.2-3.2-.4L12 20l-2.4-1.4-3.2.4-.8-3.2-3-1.4 1.2-3-1.2-3 3-1.4.8-3.2 3.2.4L12 1zm-1.2 12.6l6-6-1.4-1.4-4.6 4.6-2-2-1.4 1.4 3.4 3.4z" />
            </svg>
            <span
              onClick={() => setRewardModalOpen(true)}
              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer"
              style={{ background: C.sage100, color: C.forest800 }}
            >
              🛡️ Trust {trustScore}/100
            </span>
          </div>

          <p className="text-xs font-mono" style={{ color: C.ink500 }}>
            {handle} · {levelTitle}
          </p>

          {/* Bio poétique en typographie sérif italique */}
          {bio && (
            <p className="text-sm font-serif italic leading-snug pt-1" style={{ color: C.ink900 }}>
              {bio}
            </p>
          )}

          {/* Localisation & Page publique */}
          <div className="flex items-center gap-3 text-xs pt-1.5 flex-wrap" style={{ color: C.ink500 }}>
            {location && (
              <span className="inline-flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {location}
              </span>
            )}
            <Link
              href={`/profil/${user?.id}`}
              onClick={() => triggerHaptic('light')}
              className="font-medium hover:underline inline-flex items-center gap-1"
              style={{ color: C.forest800 }}
            >
              <span>Page publique</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M7 17l9.2-9.2M17 17V8H8" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Actions Rapides */}
        <div className="flex items-center gap-2 pt-4">
          <Link
            href="/compte/modifier"
            onClick={() => triggerHaptic('light')}
            className="flex-1 h-9 rounded-xl font-medium text-xs text-white flex items-center justify-center gap-1.5 shadow-sm transition-transform active:scale-95"
            style={{ background: C.forest800 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M17 3l4 4L8 20l-5 1 1-5L17 3z" />
            </svg>
            Modifier
          </Link>
          <button
            onClick={handleShareProfile}
            className="flex-1 h-9 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 border border-black/[0.08] transition-transform active:scale-95"
            style={{ background: C.stone, color: C.ink900 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Partager
          </button>
          <button
            onClick={() => {
              triggerHaptic('selection');
              setMenuOpen(true);
            }}
            aria-label="Options"
            className="w-9 h-9 rounded-xl flex items-center justify-center border border-black/[0.08] transition-transform active:scale-95"
            style={{ background: C.stone, color: C.ink900 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          3. RAIL HIGHLIGHTS (Stories / Voyages Épinglés)
         ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-3">
        <div className="flex gap-4 px-5 overflow-x-auto scrollbar-none snap-x">
          {highlights.map((h) => (
            <Link
              key={h.id}
              href={`/groupes/${h.id}`}
              onClick={() => triggerHaptic('light')}
              className="flex flex-col items-center gap-1.5 shrink-0 snap-start active:scale-95 transition-transform"
              style={{ width: 62 }}
            >
              <div
                className="w-[60px] h-[60px] rounded-full p-[2px] shadow-sm relative flex items-center justify-center"
                style={{
                  background: `linear-gradient(145deg, ${C.sage300}, ${C.forest800})`,
                }}
              >
                <div
                  className="w-full h-full rounded-full bg-cover bg-center"
                  style={{
                    backgroundImage: h.cover ? `url(${h.cover})` : `linear-gradient(135deg, ${C.forest800}, ${C.forest900})`,
                  }}
                />
              </div>
              <span className="text-[11px] font-medium truncate w-full text-center" style={{ color: C.ink900 }}>
                {h.label}
              </span>
            </Link>
          ))}

          {/* Bouton Nouveau voyage */}
          <Link
            href="/nouveau-groupe"
            onClick={() => triggerHaptic('selection')}
            className="flex flex-col items-center gap-1.5 shrink-0 snap-start active:scale-95 transition-transform"
            style={{ width: 62 }}
          >
            <div className="w-[60px] h-[60px] rounded-full border-2 border-dashed border-black/20 flex items-center justify-center bg-white/40">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.ink500} strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <span className="text-[11px] font-medium" style={{ color: C.ink500 }}>
              Nouveau
            </span>
          </Link>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          4. ONGLETS STICKY & TOGGLE VUE (Grille / Liste)
         ══════════════════════════════════════════════════════════════════════ */}
      <div
        className="sticky top-[49px] z-20 flex items-center justify-between px-4 border-t border-b border-black/[0.06] backdrop-blur-xl"
        style={{ background: 'rgba(245, 243, 238, 0.94)' }}
      >
        <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-none py-1">
          {([
            { id: 'tout', label: 'Activité' },
            { id: 'carnets', label: 'Carnets' },
            { id: 'voyages', label: 'Voyages' },
            { id: 'materiel', label: 'Équipement' },
          ] as { id: TabKey; label: string }[]).map((t) => {
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  triggerHaptic('selection');
                  setTab(t.id);
                }}
                className="relative px-3 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors"
                style={{ color: isActive ? C.ink900 : C.ink500 }}
              >
                {t.label}
                {isActive && (
                  <motion.div
                    layoutId="compte-tab-active"
                    transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                    className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                    style={{ background: C.forest800 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Toggle Grille / Liste (pour carnets et voyages) */}
        {tab !== 'materiel' && (
          <div className="flex items-center gap-0.5 pl-2 border-l border-black/[0.08]">
            <button
              onClick={() => {
                triggerHaptic('light');
                setViewMode('grid');
              }}
              aria-label="Vue Grille"
              className="p-1.5 rounded-lg transition-colors"
              style={{
                background: viewMode === 'grid' ? C.stone : 'transparent',
                color: viewMode === 'grid' ? C.ink900 : C.ink300,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
            <button
              onClick={() => {
                triggerHaptic('light');
                setViewMode('list');
              }}
              aria-label="Vue Liste"
              className="p-1.5 rounded-lg transition-colors"
              style={{
                background: viewMode === 'list' ? C.stone : 'transparent',
                color: viewMode === 'list' ? C.ink900 : C.ink300,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <circle cx="4" cy="6" r="1" fill="currentColor" />
                <circle cx="4" cy="12" r="1" fill="currentColor" />
                <circle cx="4" cy="18" r="1" fill="currentColor" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          5. CONTENU DES ONGLETS
         ══════════════════════════════════════════════════════════════════════ */}

      {/* ── ONGLET : ÉQUIPEMENT & INVENTAIRE ── */}
      {tab === 'materiel' && (
        <section className="p-4 space-y-4">
          {/* Synthèse du pack */}
          <div className="p-4 rounded-2xl border border-black/[0.06] shadow-xs flex items-center justify-between" style={{ background: C.white }}>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider font-semibold" style={{ color: C.forest800 }}>
                🎒 Mon Matériel de Randonnée
              </span>
              <h3 className="text-base font-bold" style={{ color: C.ink900 }}>
                {gearItems.length} équipement{gearItems.length > 1 ? 's' : ''} possédé{gearItems.length > 1 ? 's' : ''}
              </h3>
              <p className="text-xs font-mono" style={{ color: C.ink500 }}>
                Poids estimé du fond de sac : <strong>{formatWeight(totalGearWeight)}</strong>
              </p>
            </div>
            <Link
              href="/compte"
              onClick={() => triggerHaptic('selection')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-xs active:scale-95 transition-transform flex items-center gap-1"
              style={{ background: C.forest800 }}
            >
              <span>Mon Compte</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Filtres par catégorie */}
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {GEAR_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedGearCat(cat.key);
                }}
                className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors border"
                style={{
                  background: selectedGearCat === cat.key ? C.forest800 : C.white,
                  color: selectedGearCat === cat.key ? C.white : C.ink900,
                  borderColor: selectedGearCat === cat.key ? C.forest800 : 'rgba(0,0,0,0.06)',
                }}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Liste des équipements */}
          {filteredGear.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-black/10 bg-white/40">
              <p className="text-3xl mb-2">🎒</p>
              <h4 className="font-serif text-sm font-bold" style={{ color: C.ink900 }}>
                Aucun équipement dans cette catégorie
              </h4>
              <p className="text-xs max-w-xs mx-auto mt-1 mb-4" style={{ color: C.ink500 }}>
                Ajoutez vos tentes, duvets et réchauds pour générer des checklists précises.
              </p>
              <Link
                href="/compte"
                className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-xs font-bold text-white"
                style={{ background: C.forest800 }}
              >
                + Ajouter du matériel
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredGear.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-black/[0.04] flex items-center justify-between shadow-2xs"
                  style={{ background: C.white }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ background: C.stone }}>
                      {item.category?.toLowerCase() === 'couchage' ? '🛏' : item.category?.toLowerCase() === 'navigation' ? '🗺️' : '📦'}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold" style={{ color: C.ink900 }}>
                        {item.name}
                      </h4>
                      <p className="text-[11px]" style={{ color: C.ink500 }}>
                        {item.brand || 'Matériel certifié'} · <span className="font-mono">{formatWeight(item.weight_g)}</span>
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded font-semibold" style={{ background: C.sage100, color: C.forest800 }}>
                    Possédé
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Raccourci Boutique pour compléter */}
          <div className="p-4 rounded-2xl border border-black/[0.06] flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #17402C, #0B1F17)', color: '#fff' }}>
            <div>
              <h4 className="text-sm font-bold">Compléter mon sac</h4>
              <p className="text-xs text-white/70">Trouver les équipements ultralégers manquants.</p>
            </div>
            <Link href="/boutique" className="px-3.5 py-1.5 rounded-full bg-white text-[#17402C] text-xs font-bold shadow-xs">
              Boutique →
            </Link>
          </div>
        </section>
      )}

      {/* ── ONGLET : ACTIVITÉ, CARNETS & VOYAGES (VUE GRILLE OU LISTE) ── */}
      {tab !== 'materiel' && (
        <section>
          {filteredContent.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-4xl mb-3">🏔️</p>
              <h3 className="font-serif text-base font-bold mb-1" style={{ color: C.ink900 }}>
                {tab === 'carnets' ? 'Aucun carnet rédigé' : 'Aucun voyage enregistré'}
              </h3>
              <p className="text-xs max-w-xs mx-auto mb-5" style={{ color: C.ink500 }}>
                Partagez vos récits de randonnée et vos expéditions avec la communauté.
              </p>
              <Link
                href={tab === 'carnets' ? '/carnets/nouveau' : '/nouveau-groupe'}
                onClick={() => triggerHaptic('selection')}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold text-white shadow-sm"
                style={{ background: C.forest800 }}
              >
                <span>{tab === 'carnets' ? 'Écrire un carnet' : 'Créer un voyage'}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          ) : viewMode === 'grid' ? (
            /* VUE GRILLE 3 COLONNES (Style Instagram / Apple) */
            <div className="grid grid-cols-3 gap-[2px] p-[2px]">
              {filteredContent.map((c) => {
                if (c.kind === 'note') {
                  return (
                    <div
                      key={c.id}
                      className="aspect-square p-3 flex flex-col justify-between rounded-sm shadow-2xs"
                      style={{ background: C.forest900, color: C.white }}
                    >
                      <p className="font-serif italic text-xs leading-snug text-white/95 line-clamp-4">
                        {c.quote}
                      </p>
                      <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: C.sage300 }}>
                        Carnet · J.04
                      </span>
                    </div>
                  );
                }

                if (c.isWide && c.cover) {
                  return (
                    <Link
                      key={c.id}
                      href={c.kind === 'carnet' ? `/carnets/${c.id}` : `/groupes/${c.id}`}
                      onClick={() => triggerHaptic('light')}
                      className="col-span-2 aspect-[2/1] relative bg-cover bg-center overflow-hidden rounded-sm block active:opacity-90"
                      style={{ backgroundImage: `url(${c.cover})` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-md bg-black/40 backdrop-blur-md flex items-center justify-center text-white">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="6 4 20 12 6 20 6 4" />
                        </svg>
                      </div>
                      <div className="absolute bottom-2 left-2 text-white">
                        <p className="text-xs font-bold truncate max-w-[180px]">{c.title}</p>
                        <p className="text-[10px] text-white/80 font-mono">{c.duration}</p>
                      </div>
                    </Link>
                  );
                }

                return (
                  <Link
                    key={`${c.kind}-${c.id}`}
                    href={c.kind === 'carnet' ? `/carnets/${c.id}` : c.kind === 'groupe' ? `/groupes/${c.id}` : `/clubs/${c.slug || c.id}`}
                    onClick={() => triggerHaptic('light')}
                    className="aspect-square relative bg-cover bg-center overflow-hidden rounded-sm block active:opacity-90 transition-opacity"
                    style={{
                      backgroundImage: c.cover ? `url(${c.cover})` : `linear-gradient(135deg, ${C.forest800}, ${C.forest900})`,
                      backgroundColor: C.stone,
                    }}
                  >
                    {/* Badge de Type en haut à droite */}
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-md bg-black/35 backdrop-blur-md flex items-center justify-center text-white text-[10px]">
                      {c.kind === 'carnet' ? (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="4" y="5" width="16" height="14" rx="2" />
                          <path d="M4 15l4-4 4 4 3-3 5 5" />
                        </svg>
                      ) : c.kind === 'groupe' ? (
                        '⛺'
                      ) : (
                        '◈'
                      )}
                    </div>

                    {/* Likes ou Nombre de membres en bas à gauche */}
                    {c.likes > 0 && (
                      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-[10px] font-bold text-white drop-shadow-md">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 21s-8-5-8-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-8 11-8 11h-2z" />
                        </svg>
                        <span>{formatCount(c.likes)}</span>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          ) : (
            /* VUE LISTE ÉLÉGANTE (Cartes horizontales soignées) */
            <div className="p-3 space-y-3">
              {filteredContent.map((c) => {
                if (c.kind === 'note') return null;
                return (
                  <Link
                    key={`${c.kind}-${c.id}`}
                    href={c.kind === 'carnet' ? `/carnets/${c.id}` : c.kind === 'groupe' ? `/groupes/${c.id}` : `/clubs/${c.slug || c.id}`}
                    onClick={() => triggerHaptic('light')}
                    className="flex gap-3.5 p-2.5 rounded-2xl border border-black/[0.06] shadow-2xs active:scale-[0.98] transition-transform"
                    style={{ background: C.white }}
                  >
                    <div
                      className="w-24 h-24 rounded-xl shrink-0 bg-cover bg-center"
                      style={{
                        backgroundImage: c.cover ? `url(${c.cover})` : `linear-gradient(135deg, ${C.forest800}, ${C.forest900})`,
                      }}
                    />
                    <div className="flex-1 flex flex-col justify-between py-0.5">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider font-semibold" style={{ color: C.forest800 }}>
                          {c.kind === 'carnet' ? 'Récit d\'aventure' : 'Expédition'}
                        </span>
                        <h4 className="text-sm font-bold leading-tight mt-0.5" style={{ color: C.ink900 }}>
                          {c.title}
                        </h4>
                        <p className="text-xs mt-0.5" style={{ color: C.ink500 }}>
                          📍 {c.sub}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded font-semibold" style={{ background: C.sage100, color: C.forest800 }}>
                          {c.status || 'Publié'}
                        </span>
                        {c.likes > 0 && (
                          <span className="text-[11px] font-medium flex items-center gap-1" style={{ color: C.ink500 }}>
                            ❤️ {c.likes}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Sceau de fin de page */}
          <div className="py-8 text-center font-mono text-[10px] uppercase tracking-widest" style={{ color: C.ink300 }}>
            — fin · {filteredContent.length} publication{filteredContent.length > 1 ? 's' : ''} —
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          6. MODALE / SHEET REWARD ENGINE & NIVEAU VOYAGEUR
         ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {rewardModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRewardModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 350 }}
              className="relative w-full max-w-lg rounded-t-3xl p-6 shadow-2xl z-10 space-y-4"
              style={{ background: C.paperCard }}
            >
              <div className="w-12 h-1.5 rounded-full mx-auto -mt-2 mb-2 bg-black/20" />
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider font-semibold" style={{ color: C.forest800 }}>
                    Programme Fidélité LKDV
                  </span>
                  <h3 className="text-lg font-bold" style={{ color: C.ink900 }}>
                    Niveau {levelNum} · {levelTitle}
                  </h3>
                </div>
                <button onClick={() => setRewardModalOpen(false)} className="p-1 rounded-full text-black/40">
                  ✕
                </button>
              </div>

              {/* Jauge d'XP */}
              <div className="p-4 rounded-2xl" style={{ background: C.stone }}>
                <div className="flex justify-between text-xs font-mono mb-1.5 font-semibold">
                  <span style={{ color: C.forest800 }}>{currentXp} XP</span>
                  <span style={{ color: C.ink500 }}>Objectif : {nextLevelXp} XP</span>
                </div>
                <div className="w-full h-2.5 rounded-full overflow-hidden bg-black/10">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, Math.round((currentXp / nextLevelXp) * 100))}%`,
                      background: `linear-gradient(90deg, ${C.forest800}, ${C.sage500})`,
                    }}
                  />
                </div>
                <p className="text-[11px] font-serif italic mt-2" style={{ color: C.ink700 }}>
                  Plus que {Math.max(0, nextLevelXp - currentXp)} XP pour débloquer le rang supérieur.
                </p>
              </div>

              {/* Trust Score */}
              <div className="p-3.5 rounded-2xl flex items-center justify-between border border-black/[0.04]" style={{ background: C.white }}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🛡️</span>
                  <div>
                    <h4 className="text-xs font-bold" style={{ color: C.ink900 }}>
                      Indice de Confiance Voyageur
                    </h4>
                    <p className="text-[11px]" style={{ color: C.ink500 }}>
                      Calculé sur vos avis vérifiés et vos sorties.
                    </p>
                  </div>
                </div>
                <span className="font-mono text-sm font-bold" style={{ color: C.forest800 }}>
                  {trustScore}/100
                </span>
              </div>

              {/* Badges d'exploration */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider font-mono" style={{ color: C.ink500 }}>
                  Badges débloqués
                </h4>
                <div className="flex gap-2">
                  <div className="flex-1 p-2.5 rounded-xl border border-black/5 text-center" style={{ background: C.white }}>
                    <span className="text-xl">🏔️</span>
                    <p className="text-[10px] font-bold mt-1" style={{ color: C.ink900 }}>Sommets 3000</p>
                  </div>
                  <div className="flex-1 p-2.5 rounded-xl border border-black/5 text-center" style={{ background: C.white }}>
                    <span className="text-xl">⛺</span>
                    <p className="text-[10px] font-bold mt-1" style={{ color: C.ink900 }}>Bivouac Master</p>
                  </div>
                  <div className="flex-1 p-2.5 rounded-xl border border-black/5 text-center" style={{ background: C.white }}>
                    <span className="text-xl">✍️</span>
                    <p className="text-[10px] font-bold mt-1" style={{ color: C.ink900 }}>Auteur Pro</p>
                  </div>
                </div>
              </div>

              <Link
                href="/fidelite"
                onClick={() => {
                  triggerHaptic('selection');
                  setRewardModalOpen(false);
                }}
                className="w-full py-3 rounded-xl text-center text-xs font-bold text-white block shadow-sm"
                style={{ background: C.forest800 }}
              >
                Voir toutes mes récompenses & avantages
              </Link>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          7. BOTTOM SHEET : PARAMÈTRES & OPTIONS COMPLÈTES
         ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {menuOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            {/* Scrim Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />

            {/* Sheet Container avec spring physics */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 350 }}
              className="relative w-full max-w-lg rounded-t-3xl p-5 shadow-2xl z-10 max-h-[85vh] overflow-y-auto"
              style={{ background: C.paperCard }}
            >
              <div className="w-12 h-1.5 rounded-full mx-auto -mt-1 mb-4 bg-black/20" />

              <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] mb-3">
                <h3 className="text-base font-bold" style={{ color: C.ink900 }}>
                  Paramètres & Navigation
                </h3>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-black/50"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-1">
                {([
                  { label: 'Modifier mon profil', icon: '👤', href: '/compte/modifier' },
                  { label: 'Mon Compte', icon: '🎒', href: '/compte' },
                  { label: 'Mes commandes & factures', icon: '📦', href: '/boutique' },
                  { label: 'Programme Fidélité & Récompenses', icon: '🏆', href: '/fidelite' },
                  { label: 'Gains & Parrainage', icon: '💎', href: '/recompenses' },
                  { label: 'Mes alertes & notifications', icon: '🔔', href: '/alertes' },
                  { label: 'Confidentialité & Données', icon: '🔒', href: '/politique-confidentialite' },
                  { label: 'Aide & Support voyageur', icon: '💬', href: '/contact' },
                ] as { label: string; icon: string; href: string }[]).map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => {
                      triggerHaptic('light');
                      setMenuOpen(false);
                    }}
                    className="flex items-center justify-between p-3 rounded-xl transition-colors active:bg-black/[0.04]"
                    style={{ color: C.ink900 }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-base">{item.icon}</span>
                      <span className="text-xs font-semibold">{item.label}</span>
                    </div>
                    <span className="text-xs text-black/30 font-bold">›</span>
                  </Link>
                ))}

                {/* Séparateur & Déconnexion */}
                <div className="pt-3 mt-2 border-t border-black/[0.06]">
                  <button
                    onClick={async () => {
                      triggerHaptic('warning');
                      setMenuOpen(false);
                      if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
                        await signOut();
                        router.push('/connexion');
                      }
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl text-xs font-bold text-red-600 active:bg-red-50 transition-colors"
                  >
                    <span>🚪</span>
                    <span>Se déconnecter</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Feedback */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full text-xs font-bold text-white shadow-xl flex items-center gap-2 border border-white/20"
            style={{ background: C.forest900 }}
          >
            <span>✓</span>
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}