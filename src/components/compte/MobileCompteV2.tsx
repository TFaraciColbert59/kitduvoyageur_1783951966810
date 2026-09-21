'use client';
import { lkvConfirm } from '@/components/ui/dialogs';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import SmartImage from '@/components/ui/SmartImage';
import Icon from '@/components/ui/AppIcon';
import { Button, Card, Chip, EmptyState, ErrorState, IconButton, Sheet, Tabs } from '@/components/ui';
import { calculateLevel } from '@/features/progression/domain/rules';

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
          supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('follower_id', user!.id),
        ]);

        setProfile(profileRes.data);
        setFollowers(followersRes.count ?? 0);
        setFollowing(followingRes.count ?? 0);

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
            .select('id,name,destination,cover_url,departure_date,return_date,created_at')
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

  // Identité calculée (données réelles)
  const fullName = profile?.full_name || (user?.user_metadata?.full_name as string) || (user?.email ? user.email.split('@')[0] : 'Voyageur');
  const firstName = fullName.split(' ')[0] || 'Voyageur';
  const handleName = (profile?.username || profile?.full_name || user?.email || 'voyageur')
    .toLowerCase()
    .split(/[@\s]/)[0]
    .replace(/[^a-z0-9]/g, '') || 'voyageur';
  const handle = `@${handleName}`;
  const bio = profile?.bio || 'Voyageur passionné d’aventure et de grands espaces.';
  const location = profile?.location || '';
  const currentPoints = profile?.lifetime_points ?? profile?.points ?? profile?.xp ?? 0;
  const calculatedLevel = calculateLevel(currentPoints);
  const levelNum = calculatedLevel.level;
  const levelTitle = calculatedLevel.title;
  const nextLevelPoints = calculatedLevel.nextLevelPoints;
  const progressPct = calculatedLevel.progressPct;
  const trustScore = profile?.trust_score ?? 50;
  const avatarUrl = profile?.avatar_url || (user?.user_metadata?.avatar_url as string) || '/assets/images/no_image.png';

  const totalVoyages = content.filter((c) => c.kind === 'groupe').length;
  const totalCarnets = content.filter((c) => c.kind === 'carnet').length;

  /* ──────────────────────────────────────────────────────────────────────────
     ÉTAT NON CONNECTÉ
     ────────────────────────────────────────────────────────────────────────── */
  if (!user && !loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" >
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4 text-3xl bg-[color:var(--lkv-surface-card)]/65" >
          🧭
        </div>
        <h2 className="text-2xl font-display font-bold tracking-tight mb-2 text-[color:var(--lkv-text-primary)]" >
          Votre Carnet Personnel
        </h2>
        <p className="text-sm max-w-xs mb-6 font-serif italic text-[color:var(--lkv-text-muted)]" >
          Connectez-vous pour retrouver vos expéditions, carnets de route et inventaire matériel.
        </p>
        <Link
          href="/connexion?mode=connexion"
          className="inline-flex items-center justify-center gap-[var(--space-2)] min-h-[var(--lkv-touch-min)] rounded-full px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold backdrop-blur-[var(--blur-md)] border border-transparent bg-[color:var(--lkv-action)] text-[color:var(--lkv-on-action)] shadow-elevation-1"
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
      <div className="min-h-screen p-4 pb-28 animate-pulse font-sans" >
        {/* Header Skeleton */}
        <div className="flex items-center justify-between py-3 mb-3">
          <div className="h-5 w-28 rounded-full bg-[color:var(--lkv-surface-card)]/65"  />
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-full bg-[color:var(--lkv-surface-card)]/65"  />
            <div className="w-8 h-8 rounded-full bg-[color:var(--lkv-surface-card)]/65"  />
          </div>
        </div>

        {/* Identity Skeleton */}
        <div className="flex items-start gap-4 mb-4">
          <div className="w-20 h-20 rounded-full shrink-0 bg-[color:var(--lkv-surface-card)]/65"  />
          <div className="flex-1 grid grid-cols-3 gap-2 pt-2">
            <div className="h-10 rounded-xl bg-[color:var(--lkv-surface-card)]/65"  />
            <div className="h-10 rounded-xl bg-[color:var(--lkv-surface-card)]/65"  />
            <div className="h-10 rounded-xl bg-[color:var(--lkv-surface-card)]/65"  />
          </div>
        </div>

        {/* Text lines */}
        <div className="space-y-2 mb-6">
          <div className="h-5 w-40 rounded-md bg-[color:var(--lkv-surface-card)]/65"  />
          <div className="h-4 w-28 rounded-md bg-[color:var(--lkv-surface-card)]/65"  />
          <div className="h-12 w-full rounded-md bg-[color:var(--lkv-surface-card)]/65"  />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mb-6">
          <div className="h-10 flex-1 rounded-xl bg-[color:var(--lkv-surface-card)]/65"  />
          <div className="h-10 flex-1 rounded-xl bg-[color:var(--lkv-surface-card)]/65"  />
          <div className="h-10 w-10 rounded-xl bg-[color:var(--lkv-surface-card)]/65"  />
        </div>

        {/* Grid Skeleton */}
        <div className="grid grid-cols-3 gap-1">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="aspect-square rounded-lg bg-[color:var(--lkv-surface-card)]/65"  />
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
      <div className="min-h-screen flex items-center justify-center p-6">
        <ErrorState
          title="Synchronisation interrompue"
          message={error}
          onRetry={() => {
            triggerHaptic('selection');
            window.location.reload();
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-full font-sans selection:bg-[color:var(--lkv-primary)]/10 bg-transparent">
      {/* ══════════════════════════════════════════════════════════════════════
          1. HEADER COMPACT & STATUT (Frosted Liquid Glass)
         ══════════════════════════════════════════════════════════════════════ */}
      <header className="lkv-material-header sticky top-0 z-[var(--z-sticky)] flex items-center justify-between px-4 pb-2.5 pt-[calc(max(var(--safe-top),10px)+6px)]">
        {/* User Handle avec dropdown indicator */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            triggerHaptic('light');
            setRewardModalOpen(true);
          }}
          className="min-h-0 px-[var(--space-3)] py-[var(--space-1)] text-[length:var(--lkv-text-body-sm)]"
        >
          <span>{handleName}</span>
          <span className="inline-flex items-center justify-center gap-[6px] rounded-full border border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-muted)] px-[var(--space-3)] py-[2px] font-mono text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-primary)]">
            Niv.{String(levelNum).padStart(2, '0')}
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </Button>

        {/* Actions : Notifications + Paramètres Menu */}
        <div className="flex items-center gap-1">
          <Link
            href="/hub/alertes"
            aria-label="Alertes et notifications"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-[color:var(--card-content)] backdrop-blur-[var(--blur-md)]"
          >
            <Icon name="bell" size={18} />
          </Link>
          <IconButton
            variant="glass"
            size="sm"
            aria-label="Options et paramètres"
            onClick={() => {
              triggerHaptic('selection');
              setMenuOpen(true);
            }}
          >
            <Icon name="ellipsis" size={18} aria-hidden="true" />
          </IconButton>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════════
          2. IDENTITÉ & STATISTIQUES (Cockpit Liquid Glass)
         ══════════════════════════════════════════════════════════════════════ */}
      <section className="px-3 pt-3 pb-1">
        <Card variant="featured" className="p-4 sm:p-5">
          <div className="flex items-center gap-4 mb-3">
            {/* Avatar 84px avec anneau actif et bouton édition */}
            <div className="relative shrink-0">
              <div
                className="relative flex h-[78px] w-[78px] cursor-pointer items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[color:var(--sage-300)] to-[color:var(--lkv-primary)] p-[2px] transition-transform active:scale-95"
                onClick={() => {
                  triggerHaptic('light');
                  router.push('/compte/modifier');
                }}
              >
                <div className="w-full h-full rounded-full overflow-hidden bg-white/90 flex items-center justify-center">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold font-serif text-[color:var(--lkv-primary)]" >
                      {firstName.charAt(0)}
                    </span>
                  )}
                </div>
              </div>
              {/* Badge caméra */}
              <IconButton
                variant="glass"
                size="sm"
                aria-label="Modifier la photo"
                onClick={() => {
                  triggerHaptic('light');
                  router.push('/compte/modifier');
                }}
                className="absolute bottom-0 right-0"
              >
                <Icon name="image-plus" size={10} aria-hidden="true" />
              </IconButton>
            </div>

            {/* Statistiques épurées */}
            <div className="flex-1 grid grid-cols-3 gap-1 text-center">
              <Button
                variant="ghost"
                onClick={() => {
                  triggerHaptic('selection');
                  setTab('voyages');
                }}
                className="flex-col gap-0 py-1.5"
              >
                <span className="text-lg font-bold leading-none tracking-tight text-[color:var(--lkv-text-primary)]">
                  {totalVoyages}
                </span>
                <span className="mt-1 text-[11px] font-medium text-[color:var(--lkv-text-muted)]">
                  Voyages
                </span>
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  triggerHaptic('selection');
                  setTab('carnets');
                }}
                className="flex-col gap-0 py-1.5"
              >
                <span className="text-lg font-bold leading-none tracking-tight text-[color:var(--lkv-text-primary)]">
                  {totalCarnets}
                </span>
                <span className="mt-1 text-[11px] font-medium text-[color:var(--lkv-text-muted)]">
                  Carnets
                </span>
              </Button>
              <div className="flex flex-col items-center py-1.5">
                <span className="text-lg font-bold tracking-tight leading-none text-[color:var(--lkv-text-primary)]" >
                  {formatCount(followers)}
                </span>
                <span className="text-[11px] mt-1 font-medium text-[color:var(--lkv-text-muted)]" >
                  Abonnés
                </span>
              </div>
            </div>
          </div>

          {/* Nom & Badges de statut */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-[19px] font-display font-bold tracking-tight text-[color:var(--lkv-text-primary)]" >
                {fullName}
              </h1>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="var(--lkv-primary)">
                <path d="M12 1l2.4 2.2 3.2-.4.8 3.2 3 1.4-1.2 3 1.2 3-3 1.4-.8 3.2-3.2-.4L12 20l-2.4-1.4-3.2.4-.8-3.2-3-1.4 1.2-3-1.2-3 3-1.4.8-3.2 3.2.4L12 1zm-1.2 12.6l6-6-1.4-1.4-4.6 4.6-2-2-1.4 1.4 3.4 3.4z" />
              </svg>
              <Chip
                onClick={() => setRewardModalOpen(true)}
                className="font-mono text-[10px] font-bold"
              >
                🛡️ Trust {trustScore}/100
              </Chip>
            </div>

            <p className="text-xs font-mono text-[color:var(--lkv-text-muted)]" >
              {handle} · {levelTitle}
            </p>

            {/* Bio poétique en typographie sérif italique */}
            {bio && (
              <p className="text-sm font-serif italic leading-snug pt-1 text-[color:var(--lkv-text-primary)]" >
                {bio}
              </p>
            )}

            {/* Localisation & Page publique */}
            <div className="flex items-center gap-3 text-xs pt-1.5 flex-wrap text-[color:var(--lkv-text-muted)]" >
              {location && (
                <span className="inline-flex items-center gap-1 font-medium">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {location}
                </span>
              )}
              <Link
                href={`/profil/${user?.id}`}
                className="font-bold hover:underline inline-flex items-center gap-1 transition-all text-[color:var(--lkv-primary)]"
                
              >
                <span>Page publique</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M7 17l9.2-9.2M17 17V8H8" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Bannière Ma Progression & Classements */}
          <Link
            href="/progression"
            className="mt-3 flex items-center justify-between p-3 rounded-2xl border border-[color:var(--lkv-primary)]/10 bg-white/75 hover:bg-white/95 transition-all active:scale-[0.98] shadow-2xs cursor-pointer min-h-[52px]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[color:var(--lkv-primary)] text-white flex items-center justify-center text-lg shrink-0 shadow-2xs">
                {calculatedLevel.badge || '🏆'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold truncate text-[color:var(--lkv-text-primary)]" >
                    Ma progression & classements
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[color:var(--lkv-primary)]/10 text-[color:var(--lkv-primary)] font-semibold">
                    Niv. {calculatedLevel.level}
                  </span>
                </div>
                <p className="text-[11px] truncate text-[color:var(--lkv-text-muted)]" >
                  {currentPoints.toLocaleString('fr-FR')} Points LKDV · {calculatedLevel.title}
                </p>
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--lkv-primary)" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 ml-1">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>

          {/* Actions Rapides */}
          <div className="flex items-center gap-2 pt-4">
            <Link
              href="/compte/modifier"
              className="inline-flex items-center justify-center gap-[var(--space-2)] min-h-[var(--lkv-touch-min)] rounded-full px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold backdrop-blur-[var(--blur-md)] border border-transparent bg-[color:var(--lkv-action)] text-[color:var(--lkv-on-action)] shadow-elevation-1 flex-1 !py-2.5 text-xs font-bold"
            >
              <Icon name="pencil" size={13} />
              Modifier
            </Link>
            <Button
              variant="secondary"
              fullWidth
              onClick={handleShareProfile}
              icon={<Icon name="share2" size={13} aria-hidden="true" />}
              className="flex-1"
            >
              Partager
            </Button>
            <IconButton
              variant="glass"
              aria-label="Options"
              onClick={() => {
                triggerHaptic('selection');
                setMenuOpen(true);
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </IconButton>
          </div>
        </Card>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          3. RAIL HIGHLIGHTS (Stories / Voyages Épinglés — Frosted Glass Tray)
         ══════════════════════════════════════════════════════════════════════ */}
      <section className="px-3 py-1.5">
        <div className="bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] rounded-3xl p-3">
          <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x">
            {highlights.map((h) => (
              <Link
                key={h.id}
                href={`/groupes/${h.id}`}
                className="flex w-[62px] shrink-0 snap-start flex-col items-center gap-1 transition-transform active:scale-95"
              >
                <div className="relative flex h-[54px] w-[54px] items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[color:var(--sage-300)] to-[color:var(--lkv-primary)] p-[2px]">
                  <div className="w-full h-full rounded-full overflow-hidden border border-white relative">
                    <SmartImage
                      src={h.cover}
                      alt={h.label}
                      fill
                      className="w-full h-full object-cover"
                      fallbackSrc="https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=300&q=80"
                    />
                  </div>
                </div>
                <span className="text-[10px] font-bold truncate w-full text-center text-[color:var(--lkv-text-primary)]" >
                  {h.label}
                </span>
              </Link>
            ))}

            {/* Bouton Nouveau voyage */}
            <Link
              href="/nouveau-groupe"
              className="flex w-[62px] shrink-0 snap-start flex-col items-center gap-1 transition-transform active:scale-95"
            >
              <div className="flex h-[54px] w-[54px] items-center justify-center rounded-full border-2 border-dashed border-[color:var(--lkv-primary)]/30 bg-[color:var(--lkv-surface-card)]/90 backdrop-blur-[var(--blur-md)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--lkv-primary)" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <span className="text-[10px] font-bold text-[color:var(--lkv-primary)]" >
                Nouveau
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          4. ONGLETS FLOTTANTS & TOGGLE VUE (Segmented Capsule Liquid Glass)
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="sticky top-[48px] z-[var(--z-sticky)] px-3 py-1.5">
        <div className="bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] rounded-2xl p-1 flex items-center justify-between gap-1">
          <div className="min-w-0 flex-1">
            <Tabs
              variant="segmented"
              ariaLabel="Sections du compte"
              value={tab}
              onChange={(id) => {
                triggerHaptic('selection');
                setTab(id as TabKey);
              }}
              options={([
                { id: 'tout', label: 'Activité', icon: '⚡' },
                { id: 'carnets', label: 'Carnets', icon: '📖' },
                { id: 'voyages', label: 'Voyages', icon: '⛺' },
                { id: 'materiel', label: 'Équipement', icon: '🎒' },
              ] as { id: TabKey; label: string; icon: string }[]).map((t) => ({
                id: t.id,
                label: t.label,
                icon: <span aria-hidden="true">{t.icon}</span>,
              }))}
            />
          </div>

          {/* Toggle Grille / Liste (pour carnets et voyages) */}
          {tab !== 'materiel' && (
            <div className="flex items-center gap-0.5 border-l border-[color:var(--lkv-primary)]/10 pl-1.5 pr-0.5">
              <IconButton
                variant={viewMode === 'grid' ? 'solid' : 'glass'}
                size="sm"
                aria-label="Vue Grille"
                aria-pressed={viewMode === 'grid'}
                onClick={() => {
                  triggerHaptic('light');
                  setViewMode('grid');
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
              </IconButton>
              <IconButton
                variant={viewMode === 'list' ? 'solid' : 'glass'}
                size="sm"
                aria-label="Vue Liste"
                aria-pressed={viewMode === 'list'}
                onClick={() => {
                  triggerHaptic('light');
                  setViewMode('list');
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <circle cx="4" cy="6" r="1.2" fill="currentColor" />
                  <circle cx="4" cy="12" r="1.2" fill="currentColor" />
                  <circle cx="4" cy="18" r="1.2" fill="currentColor" />
                </svg>
              </IconButton>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          5. CONTENU DES ONGLETS
         ══════════════════════════════════════════════════════════════════════ */}

      {/* ── ONGLET : ÉQUIPEMENT & INVENTAIRE ── */}
      {tab === 'materiel' && (
        <section className="p-3 space-y-3">
          {/* Synthèse du pack */}
          <div className="bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] p-4 rounded-3xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-[color:var(--lkv-primary)]" >
                🎒 Mon Matériel de Randonnée
              </span>
              <h3 className="text-base font-bold text-[color:var(--lkv-text-primary)]" >
                {gearItems.length} équipement{gearItems.length > 1 ? 's' : ''} possédé{gearItems.length > 1 ? 's' : ''}
              </h3>
              <p className="text-xs font-mono text-[color:var(--lkv-text-muted)]" >
                Poids estimé du fond de sac : <strong>{formatWeight(totalGearWeight)}</strong>
              </p>
            </div>
            <Link
              href="/compte"
              className="inline-flex items-center justify-center gap-[var(--space-2)] min-h-[var(--lkv-touch-min)] rounded-full px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold backdrop-blur-[var(--blur-md)] border border-transparent bg-[color:var(--lkv-action)] text-[color:var(--lkv-on-action)] shadow-elevation-1 !py-2 !px-3.5 text-xs font-bold"
            >
              <span>Détails</span>
              <Icon name="arrow-right" size={12} />
            </Link>
          </div>

          {/* Filtres par catégorie */}
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {GEAR_CATEGORIES.map((cat) => (
              <Chip
                key={cat.key}
                selected={selectedGearCat === cat.key}
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedGearCat(cat.key);
                }}
                icon={<span aria-hidden="true">{cat.icon}</span>}
                className="shrink-0"
              >
                {cat.label}
              </Chip>
            ))}
          </div>

          {/* Liste des équipements */}
          {filteredGear.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--lkv-primary)]/20 bg-[color:var(--card-tint-strong)] backdrop-blur-[var(--blur-lg)]">
              <EmptyState
                icon={<span className="text-3xl">🎒</span>}
                title="Aucun équipement dans cette catégorie"
                description="Ajoutez vos tentes, duvets et réchauds pour générer des checklists précises."
                actionLabel="+ Ajouter du matériel"
                actionHref="/compte"
              />
            </div>
          ) : (
            <div className="space-y-2">
              {filteredGear.map((item) => (
                <div
                  key={item.id}
                  className="bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] p-3.5 rounded-2xl flex items-center justify-between transition-all active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-white/90 border border-white shadow-2xs">
                      {item.category?.toLowerCase() === 'couchage' ? '🛏' : item.category?.toLowerCase() === 'navigation' ? '🗺️' : '📦'}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[color:var(--lkv-text-primary)]" >
                        {item.name}
                      </h4>
                      <p className="text-[11px] text-[color:var(--lkv-text-muted)]" >
                        {item.brand || 'Matériel certifié'} · <span className="font-mono">{formatWeight(item.weight_g)}</span>
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center justify-center gap-[6px] rounded-full border border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-muted)] px-[var(--space-3)] py-[2px] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-primary)] bg-forest-50 text-forest-800 border-forest-200">
                    Possédé
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Raccourci Boutique pour compléter */}
          <div className="bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] p-4 rounded-3xl flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-[color:var(--lkv-text-primary)]" >Compléter mon sac</h4>
              <p className="text-xs text-[color:var(--lkv-text-muted)]" >Trouver les équipements ultralégers manquants.</p>
            </div>
            <Link href="/boutique" className="inline-flex items-center justify-center gap-[var(--space-2)] min-h-[var(--lkv-touch-min)] rounded-full px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold backdrop-blur-[var(--blur-md)] border border-transparent bg-[color:var(--lkv-action)] text-[color:var(--lkv-on-action)] shadow-elevation-1 text-xs font-bold">
              Boutique →
            </Link>
          </div>
        </section>
      )}

      {/* ── ONGLET : ACTIVITÉ, CARNETS & VOYAGES (VUE GRILLE OU LISTE) ── */}
      {tab !== 'materiel' && (
        <section>
          {filteredContent.length === 0 ? (
            <div className="m-3 rounded-3xl bg-[color:var(--card-tint-strong)] backdrop-blur-[var(--blur-lg)]">
              <EmptyState
                icon={<span className="text-4xl">🏔️</span>}
                title={tab === 'carnets' ? 'Aucun carnet rédigé' : 'Aucun voyage enregistré'}
                description="Partagez vos récits de randonnée et vos expéditions avec la communauté."
                actionLabel={tab === 'carnets' ? 'Écrire un carnet' : 'Créer un voyage'}
                actionHref={tab === 'carnets' ? '/carnets/nouveau' : '/nouveau-groupe'}
              />
            </div>
          ) : viewMode === 'grid' ? (
            /* VUE GRILLE 3 COLONNES LIQUID GLASS AVEC COINS ARRONDIS */
            <div className="grid grid-cols-3 gap-2.5 p-3">
              {filteredContent.map((c) => {
                if (c.kind === 'note') {
                  return (
                    <div
                      key={c.id}
                      className="flex aspect-square flex-col justify-between rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--lkv-primary)]/90 p-[var(--space-3)] text-[color:var(--lkv-text-inverted)] backdrop-blur-[var(--blur-md)] transition-transform active:scale-95"
                    >
                      <p className="font-serif text-[length:var(--lkv-text-caption)] italic leading-snug text-[color:var(--lkv-text-inverted)]/95 line-clamp-4">
                        {c.quote}
                      </p>
                      <span className="font-mono text-[9px] uppercase tracking-wider text-[color:var(--sage-300)]">
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
                      className="col-span-2 aspect-[2/1] relative bg-cover bg-center overflow-hidden rounded-2xl border border-white/70 shadow-2xs block active:scale-[0.98] transition-all cursor-pointer"
                      style={{ backgroundImage: `url(${c.cover})` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-lg bg-black/40 backdrop-blur-md flex items-center justify-center text-white">
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
                    className="aspect-square relative overflow-hidden rounded-2xl border border-white/70 shadow-2xs block active:scale-95 transition-all cursor-pointer bg-[color:var(--lkv-primary)]/10"
                  >
                    <SmartImage
                      src={c.cover}
                      alt={c.title}
                      fill
                      className="w-full h-full object-cover"
                      fallbackSrc="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&q=80"
                    />

                    {/* Badge de Type en haut à droite */}
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-md bg-black/40 backdrop-blur-md flex items-center justify-center text-white text-[10px] z-[var(--z-dropdown)]">
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
                      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-[10px] font-bold text-white drop-shadow-sm z-[var(--z-dropdown)]">
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
            /* VUE LISTE ÉLÉGANTE (Cartes horizontales Liquid Glass) */
            <div className="p-3 space-y-2.5">
              {filteredContent.map((c) => {
                if (c.kind === 'note') return null;
                return (
                  <Link
                    key={`${c.kind}-${c.id}`}
                    href={c.kind === 'carnet' ? `/carnets/${c.id}` : c.kind === 'groupe' ? `/groupes/${c.id}` : `/clubs/${c.slug || c.id}`}
                    className="bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] flex gap-3.5 p-3 rounded-2xl active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <div className="w-22 h-22 rounded-xl shrink-0 overflow-hidden border border-white/60 shadow-2xs relative bg-[color:var(--lkv-primary)]/10">
                      <SmartImage
                        src={c.cover}
                        alt={c.title}
                        fill
                        className="w-full h-full object-cover"
                        fallbackSrc="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&q=80"
                      />
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-0.5">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-[color:var(--lkv-primary)]" >
                          {c.kind === 'carnet' ? 'Récit d\'aventure' : 'Expédition'}
                        </span>
                        <h4 className="text-sm font-bold leading-tight mt-0.5 text-[color:var(--lkv-text-primary)]" >
                          {c.title}
                        </h4>
                        <p className="text-xs mt-0.5 font-medium text-[color:var(--lkv-text-muted)]" >
                          📍 {c.sub}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="inline-flex items-center justify-center gap-[6px] rounded-full border border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-muted)] px-[var(--space-3)] py-[2px] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-primary)] bg-white/90 border-white">
                          {c.status || 'Publié'}
                        </span>
                        {c.likes > 0 && (
                          <span className="text-[11px] font-bold flex items-center gap-1 text-[color:var(--lkv-text-muted)]" >
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
          <div className="py-8 text-center font-mono text-[10px] uppercase tracking-widest text-[color:var(--lkv-text-subtle)]" >
            — fin · {filteredContent.length} publication{filteredContent.length > 1 ? 's' : ''} —
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          6. SHEET REWARD ENGINE & NIVEAU VOYAGEUR
         ══════════════════════════════════════════════════════════════════════ */}
      <Sheet
        open={rewardModalOpen}
        onOpenChange={setRewardModalOpen}
        title={`Niveau ${levelNum} · ${levelTitle}`}
        description="Programme Fidélité LKDV"
        dragToDismiss
      >
        <div className="space-y-[var(--space-4)]">
          {/* Jauge de Points LKDV */}
          <div className="rounded-[var(--lkv-radius-md)] bg-[color:var(--lkv-surface-muted)] p-[var(--space-4)]">
            <div className="mb-[var(--space-2)] flex justify-between font-mono text-[length:var(--lkv-text-caption)] font-semibold">
              <span className="text-[color:var(--lkv-primary)]">{currentPoints.toLocaleString('fr-FR')} pts LKDV</span>
              <span className="text-[color:var(--lkv-text-muted)]">
                {nextLevelPoints ? `Objectif : ${nextLevelPoints.toLocaleString('fr-FR')} pts` : 'Niveau Max'}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[color:var(--lkv-primary)]/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[color:var(--lkv-primary)] to-[color:var(--lkv-secondary)]"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-[var(--space-2)] font-serif text-[length:var(--lkv-text-caption)] italic text-[color:var(--lkv-text-secondary)]">
              {nextLevelPoints
                ? `Plus que ${Math.max(0, nextLevelPoints - currentPoints).toLocaleString('fr-FR')} points LKDV pour débloquer le rang supérieur.`
                : 'Félicitations, vous avez atteint le niveau maximal de progression permanente !'}
            </p>
          </div>

          {/* Trust Score */}
          <div className="flex items-center justify-between rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-primary)]/10 bg-[color:var(--lkv-surface-card)] p-[var(--space-4)]">
            <div className="flex items-center gap-[var(--space-3)]">
              <span className="text-2xl">🛡️</span>
              <div>
                <h4 className="text-[length:var(--lkv-text-body-sm)] font-bold text-[color:var(--lkv-text-primary)]">
                  Indice de Confiance Voyageur
                </h4>
                <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
                  Calculé sur vos avis vérifiés et vos sorties.
                </p>
              </div>
            </div>
            <span className="font-mono text-[length:var(--lkv-text-body-sm)] font-bold text-[color:var(--lkv-primary)]">
              {trustScore}/100
            </span>
          </div>

          {/* Badges d'exploration */}
          <div className="space-y-[var(--space-2)]">
            <h4 className="font-mono text-[length:var(--lkv-text-caption)] font-bold uppercase tracking-wider text-[color:var(--lkv-text-muted)]">
              Badges débloqués
            </h4>
            <div className="flex gap-[var(--space-2)]">
              <div className="flex-1 rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-primary)]/10 bg-[color:var(--lkv-surface-card)] p-[var(--space-3)] text-center">
                <span className="text-xl">🏔️</span>
                <p className="mt-[var(--space-1)] text-[10px] font-bold text-[color:var(--lkv-text-primary)]">Sommets 3000</p>
              </div>
              <div className="flex-1 rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-primary)]/10 bg-[color:var(--lkv-surface-card)] p-[var(--space-3)] text-center">
                <span className="text-xl">⛺</span>
                <p className="mt-[var(--space-1)] text-[10px] font-bold text-[color:var(--lkv-text-primary)]">Bivouac Master</p>
              </div>
              <div className="flex-1 rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-primary)]/10 bg-[color:var(--lkv-surface-card)] p-[var(--space-3)] text-center">
                <span className="text-xl">✍️</span>
                <p className="mt-[var(--space-1)] text-[10px] font-bold text-[color:var(--lkv-text-primary)]">Auteur Pro</p>
              </div>
            </div>
          </div>

          <Button
            fullWidth
            onClick={() => {
              triggerHaptic('selection');
              setRewardModalOpen(false);
              router.push('/progression');
            }}
          >
            Voir ma progression &amp; les classements
          </Button>
        </div>
      </Sheet>

      {/* ══════════════════════════════════════════════════════════════════════
          7. SHEET : PARAMÈTRES & OPTIONS COMPLÈTES
         ══════════════════════════════════════════════════════════════════════ */}
      <Sheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title="Paramètres & Navigation"
        dragToDismiss
      >
        <div className="space-y-[var(--space-1)]">
          {([
            { label: 'Modifier mon profil', icon: '👤', href: '/compte/modifier' },
            { label: 'Ma progression & classements', icon: '🏆', href: '/progression' },
            { label: 'Mon Compte', icon: '🎒', href: '/compte' },
            { label: 'Mes commandes & factures', icon: '📦', href: '/boutique' },
            { label: 'Programme Fidélité & Récompenses', icon: '✨', href: '/fidelite' },
            { label: 'Gains & Parrainage', icon: '💎', href: '/recompenses' },
            { label: 'Mes alertes & notifications', icon: '🔔', href: '/hub/alertes' },
            { label: 'Confidentialité & Données', icon: '🔒', href: '/politique-confidentialite' },
            { label: 'Aide & Support voyageur', icon: '💬', href: '/contact' },
          ] as { label: string; icon: string; href: string }[]).map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => {
                setMenuOpen(false);
              }}
              className="flex min-h-[var(--lkv-touch-min)] items-center justify-between rounded-[var(--lkv-radius-sm)] p-[var(--space-3)] text-[color:var(--lkv-text-primary)] transition-colors hover:bg-[color:var(--lkv-hover-surface)] active:bg-[color:var(--lkv-primary)]/5"
            >
              <span className="flex items-center gap-[var(--space-3)]">
                <span className="text-base" aria-hidden="true">{item.icon}</span>
                <span className="text-[length:var(--lkv-text-caption)] font-semibold">{item.label}</span>
              </span>
              <span className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-primary)]/30">›</span>
            </Link>
          ))}

          <div className="mt-[var(--space-2)] border-t border-[color:var(--lkv-primary)]/10 pt-[var(--space-3)]">
            <Button
              variant="destructive"
              fullWidth
              icon={<span aria-hidden="true">🚪</span>}
              onClick={async () => {
                triggerHaptic('warning');
                setMenuOpen(false);
                if (await lkvConfirm('Voulez-vous vraiment vous déconnecter ?')) {
                  await signOut();
                  router.push('/connexion');
                }
              }}
            >
              Se déconnecter
            </Button>
          </div>
        </div>
      </Sheet>

      {/* Toast Feedback */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 z-[var(--z-toast)] flex -translate-x-1/2 items-center gap-[var(--space-2)] rounded-full border border-[color:var(--lkv-border)] bg-[color:var(--lkv-primary)] px-[var(--space-4)] py-[10px] text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-inverted)]"
          >
            <span aria-hidden="true">✓</span>
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}