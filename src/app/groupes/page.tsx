'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import LkvIcon from '@/components/ui/LkvIcon';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import MobileGroupesHub from '@/components/groupes/MobileGroupesHub';
import CompteBackground from '@/components/compte/CompteBackground';
import CommunityHubNav from '@/components/social/CommunityHubNav';
import { BackgroundVideo } from '@/components/materiel/BackgroundVideo';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

interface TravelGroup {
  id: string;
  name: string;
  description: string;
  destination: string;
  theme: string;
  visibility: string;
  invite_code: string;
  max_members: number;
  departure_date: string | null;
  return_date: string | null;
  budget_target: number;
  group_level: number;
  optimization_score: number;
  owner_id: string;
  created_at: string;
  member_count?: number;
  my_role?: string;
  owner?: { full_name: string; avatar_url?: string } | null;
}

const THEMES = ['Trek', 'Van Life', 'Randonnée', 'Expédition', 'Tour du monde', 'Plage', 'Ski', 'Vélo', 'Moto', 'Autre'];
const THEME_EMOJI: Record<string, string> = {
  Trek: '🏔️', 'Van Life': '🚐', Randonnée: '🥾', Expédition: '🧭', 'Tour du monde': '🌍',
  Plage: '🏖️', Ski: '⛷️', Vélo: '🚴', Moto: '🏍️', Autre: '🎒',
};

type MainTab = 'mes-groupes' | 'decouvrir';

const inputCls = "glass-input w-full text-sm text-[#17402C] focus:outline-none";
const labelCls = "block text-[10px] font-mono text-[#5C6B5E] uppercase tracking-[0.15em] mb-1.5 font-bold";

function GroupesPageInner() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<MainTab>(() =>
    searchParams?.get('tab') === 'decouvrir' ? 'decouvrir' : 'mes-groupes'
  );
  const [myGroups, setMyGroups] = useState<TravelGroup[]>([]);
  const [publicGroups, setPublicGroups] = useState<TravelGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('Tous');
  const [joining, setJoining] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [joiningByCode, setJoiningByCode] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TravelGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<Array<{ id: string; group_id: string; name: string; owner_id: string }>>([]);
  const [inviteBusy, setInviteBusy] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    name: '', description: '', destination: '', theme: 'Trek',
    visibility: 'public', departure_date: '', return_date: '',
    budget_target: '', max_members: '20',
  });

  const loadMyGroups = useCallback(async () => {
    if (!user) { setMyGroups([]); return; }
    try {
      const { data: memberData } = await supabase.from('group_members').select('group_id, role').eq('user_id', user.id).eq('status', 'active');
      if (!memberData?.length) { setMyGroups([]); return; }
      const groupIds = memberData.map(m => m.group_id);
      const { data: groups } = await supabase
        .from('travel_groups')
        .select('*, owner:user_profiles!travel_groups_owner_id_fkey(full_name, avatar_url)')
        .in('id', groupIds)
        .order('created_at', { ascending: false });
      const enriched = await Promise.all((groups || []).map(async (g) => {
        const { count } = await supabase.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', g.id).eq('status', 'active');
        return { ...g, member_count: count || 0, my_role: memberData.find(m => m.group_id === g.id)?.role };
      }));
      setMyGroups(enriched);
      setError(null);
    } catch (err) {
      console.error('Error loading my groups:', err);
      setError('Impossible de charger vos groupes.');
    }
  }, [user, supabase]);

  const loadPublicGroups = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('travel_groups')
        .select('*, owner:user_profiles!travel_groups_owner_id_fkey(full_name, avatar_url)')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(30);
      const enriched = await Promise.all((data || []).map(async (g) => {
        const { count } = await supabase.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', g.id).eq('status', 'active');
        return { ...g, member_count: count || 0 };
      }));
      setPublicGroups(enriched || []);
      setError(null);
    } catch (err) {
      console.error('Error loading public groups:', err);
      setError('Impossible de charger les groupes publics.');
    }
  }, [supabase]);

  const loadPendingInvites = useCallback(async () => {
    if (!user) { setPendingInvites([]); return; }
    try {
      const { data } = await supabase
        .from('group_members')
        .select('id, group_id, group:travel_groups!group_members_group_id_fkey(name, owner_id)')
        .eq('user_id', user.id)
        .eq('status', 'pending');
      setPendingInvites((data ?? []).map((r: any) => ({ id: r.id, group_id: r.group_id, name: r.group?.name || 'Groupe', owner_id: r.group?.owner_id || '' })));
    } catch (err) {
      console.error('Error loading invites:', err);
    }
  }, [user, supabase]);

  async function handleInvite(groupId: string, accept: boolean) {
    if (!user) return;
    setInviteBusy(groupId);
    try {
      if (accept) {
        await supabase.from('group_members').update({ status: 'active' }).eq('group_id', groupId).eq('user_id', user.id);
        toast('Invitation acceptée, vous faites partie du groupe !', 'success');
      } else {
        await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', user.id);
        toast('Invitation refusée', 'success');
      }
      await Promise.all([loadPendingInvites(), loadMyGroups()]);
    } catch (err: unknown) {
      toast((err as Error).message || 'Erreur', 'error');
    } finally {
      setInviteBusy(null);
    }
  }

  const loadAll = () => Promise.all([loadMyGroups(), loadPublicGroups(), loadPendingInvites()]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await loadAll();
      setLoading(false);
    };
    load();
  }, [loadMyGroups, loadPublicGroups, loadPendingInvites]);

  useEffect(() => {
    const code = searchParams?.get('code');
    if (!code) return;
    const normalized = code.trim().toUpperCase();
    setJoinCode(normalized);
    const t = setTimeout(() => {
      if (user) {
        handleJoinByCode(normalized);
      } else {
        router.push(`/connexion?next=/groupes?code=${encodeURIComponent(normalized)}`);
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, searchParams]);

  async function handleEditGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!editingGroup) return;
    setCreating(true);
    try {
      const { error } = await supabase.from('travel_groups').update({
        name: createForm.name, description: createForm.description, destination: createForm.destination,
        theme: createForm.theme, visibility: createForm.visibility,
        departure_date: createForm.departure_date || null, return_date: createForm.return_date || null,
        budget_target: parseFloat(createForm.budget_target) || 0, max_members: parseInt(createForm.max_members) || 20,
      }).eq('id', editingGroup.id);
      if (error) throw error;
      toast('Groupe modifié !', 'success');
      setShowEditModal(false);
      setEditingGroup(null);
      await Promise.all([loadMyGroups(), loadPublicGroups()]);
    } catch (err: unknown) { toast((err as Error).message || 'Erreur', 'error'); }
    finally { setCreating(false); }
  }

  async function handleJoinGroup(groupId: string) {
    if (!user) { toast('Connectez-vous pour rejoindre un groupe', 'error'); return; }
    setJoining(groupId);
    try {
      const { error } = await supabase.from('group_members').insert({ group_id: groupId, user_id: user.id, role: 'member', status: 'active' });
      if (error && error.code !== '23505') throw error;
      toast('Vous avez rejoint le groupe !', 'success');
      await Promise.all([loadMyGroups(), loadPublicGroups()]);
      router.push(`/groupes/${groupId}`);
    } catch (err: unknown) { toast((err as Error).message || 'Erreur', 'error'); }
    finally { setJoining(null); }
  }

  async function handleLeaveGroup(groupId: string) {
    if (!user) return;
    if (!confirm('Quitter ce groupe ?')) return;
    try {
      await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', user.id);
      toast('Vous avez quitté le groupe', 'success');
      await loadMyGroups();
    } catch (err: unknown) { toast((err as Error).message || 'Erreur', 'error'); }
  }

  async function handleDeleteGroup(groupId: string) {
    if (!confirm('Supprimer définitivement ce groupe ? Cette action est irréversible.')) return;
    try {
      await supabase.from('travel_groups').delete().eq('id', groupId);
      toast('Groupe supprimé', 'success');
      await Promise.all([loadMyGroups(), loadPublicGroups()]);
    } catch (err: unknown) { toast((err as Error).message || 'Erreur', 'error'); }
  }

  async function handleJoinByCode(codeOverride?: string) {
    if (!user) { toast('Connectez-vous pour rejoindre un groupe', 'error'); return; }
    const code = (codeOverride ?? joinCode).trim();
    if (!code) return;
    setJoiningByCode(true);
    try {
      const { data: group } = await supabase.from('travel_groups').select('*').eq('invite_code', code.toUpperCase()).maybeSingle();
      if (!group) { toast('Code invalide', 'error'); return; }
      const { error } = await supabase.from('group_members').insert({ group_id: group.id, user_id: user.id, role: 'member', status: 'active' });
      if (error && error.code === '42501') {
        toast('Ce groupe est privé — une invitation de l’organisateur est requise.', 'error');
        router.push(`/groupes/${group.id}`);
        return;
      }
      if (error && error.code !== '23505') throw error;
      toast(`Vous avez rejoint "${group.name}" !`, 'success');
      setJoinCode('');
      await loadMyGroups();
      router.push(`/groupes/${group.id}`);
    } catch (err: unknown) { toast((err as Error).message || 'Erreur', 'error'); }
    finally { setJoiningByCode(false); }
  }

  function openEditModal(group: TravelGroup) {
    setEditingGroup(group);
    setCreateForm({
      name: group.name, description: group.description || '', destination: group.destination,
      theme: group.theme, visibility: group.visibility,
      departure_date: group.departure_date?.split('T')[0] || '', return_date: group.return_date?.split('T')[0] || '',
      budget_target: group.budget_target?.toString() || '', max_members: group.max_members?.toString() || '20',
    });
    setShowEditModal(true);
  }

  const filteredPublic = publicGroups.filter(g => {
    const matchSearch = !search || g.name.toLowerCase().includes(search.toLowerCase()) || g.destination.toLowerCase().includes(search.toLowerCase());
    const matchTheme = selectedTheme === 'Tous' || g.theme === selectedTheme;
    return matchSearch && matchTheme;
  });

  const isAlreadyMember = (groupId: string) => myGroups.some(g => g.id === groupId);

  const GroupCard = ({ group, showActions = false }: { group: TravelGroup; showActions?: boolean }) => {
    const alreadyMember = isAlreadyMember(group.id);
    const isOwner = user?.id === group.owner_id;
    const myRole = group.my_role;
    return (
      <div className="glass overflow-hidden flex flex-col justify-between transition-all duration-300">
        {/* Header */}
        <div className="p-4 relative bg-gradient-to-r from-[#17402C]/90 to-[#17402C]/70 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl glass-sub-card flex items-center justify-center text-2xl flex-shrink-0">
                {THEME_EMOJI[group.theme] || '🎒'}
              </div>
              <div>
                <h3 className="font-display font-bold text-white text-base leading-tight">{group.name}</h3>
                <p className="text-white/70 text-xs flex items-center gap-1 mt-0.5">
                  <Icon name="MapPinIcon" size={10} className="relative z-10" /> {group.destination}
                </p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="font-mono font-bold text-white text-lg">{group.optimization_score}</div>
              <div className="text-[10px] text-white/60 uppercase font-mono">score</div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="glass-pill">{group.theme}</span>
            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold ${group.visibility === 'public' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
              {group.visibility === 'public' ? '🌍 Public' : group.visibility === 'private' ? '🔒 Privé' : '🔗 Invitation'}
            </span>
            <span className="text-[10px] font-mono text-white/60">Niv. {group.group_level}</span>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
          <div>
            {group.description && <p className="text-xs text-[#5C6B5E] mb-3 line-clamp-2 leading-relaxed">{group.description}</p>}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center p-2 glass-sub-card rounded-xl">
                <p className="font-mono font-bold text-[#17402C] text-sm">{group.member_count || 0}</p>
                <p className="text-[10px] text-[#5C6B5E]">membres</p>
              </div>
              <div className="text-center p-2 glass-sub-card rounded-xl">
                <p className="font-mono font-bold text-[#17402C] text-sm">{group.budget_target > 0 ? `${group.budget_target}€` : '—'}</p>
                <p className="text-[10px] text-[#5C6B5E]">budget</p>
              </div>
              <div className="text-center p-2 glass-sub-card rounded-xl">
                <p className="font-mono font-bold text-[#17402C] text-sm">{group.max_members}</p>
                <p className="text-[10px] text-[#5C6B5E]">max</p>
              </div>
            </div>
            {group.departure_date && (
              <p className="text-[10px] text-[#5C6B5E] flex items-center gap-1 mb-3 font-mono">
                <Icon name="CalendarIcon" size={10} className="relative z-10" />
                {new Date(group.departure_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                {group.return_date && ` → ${new Date(group.return_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`}
              </p>
            )}
            {group.owner && (
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-[#17402C]/10">
                <div className="w-5 h-5 rounded-full bg-[#17402C]/15 flex items-center justify-center text-[10px] font-bold text-[#17402C]">
                  {group.owner.full_name?.[0] || '?'}
                </div>
                <span className="text-[10px] text-[#5C6B5E]">Organisé par <span className="font-semibold text-[#17402C]">{group.owner.full_name}</span></span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            {showActions ? (
              <>
                <Link href={`/groupes/${group.id}`} className="flex-1 glass-capsule-btn primary py-2 text-xs font-bold flex items-center justify-center gap-1.5">
                  <Icon name="ArrowRightIcon" size={12} className="relative z-10" />
                  <span className="relative z-10">Ouvrir</span>
                </Link>
                {myRole && (
                  <span className={`px-2.5 py-2 rounded-xl text-[10px] font-semibold ${myRole === 'organizer' ? 'bg-amber-100/60 text-amber-800' : myRole === 'co_organizer' ? 'bg-blue-100/60 text-blue-800' : 'glass-sub-card text-[#5C6B5E]'}`}>
                    {myRole === 'organizer' ? '👑' : myRole === 'co_organizer' ? '🛡️' : '👤'}
                  </span>
                )}
                {(isOwner || myRole === 'organizer') && (
                  <button onClick={() => openEditModal(group)} className="glass-capsule-btn p-2" title="Modifier">
                    <Icon name="PencilIcon" size={12} className="relative z-10" />
                  </button>
                )}
                {myRole && myRole !== 'organizer' && (
                  <button onClick={() => handleLeaveGroup(group.id)} className="glass-capsule-btn p-2 text-red-600 hover:text-red-700" title="Quitter">
                    <Icon name="ArrowRightOnRectangleIcon" size={12} className="relative z-10" />
                  </button>
                )}
                {isOwner && (
                  <button onClick={() => handleDeleteGroup(group.id)} className="glass-capsule-btn p-2 text-red-600 hover:text-red-700" title="Supprimer">
                    <Icon name="TrashIcon" size={12} className="relative z-10" />
                  </button>
                )}
              </>
            ) : alreadyMember ? (
              <Link href={`/groupes/${group.id}`} className="flex-1 glass-capsule-btn primary py-2 text-xs font-bold flex items-center justify-center gap-1.5">
                <Icon name="ArrowRightIcon" size={12} className="relative z-10" />
                <span className="relative z-10">Déjà membre — Ouvrir</span>
              </Link>
            ) : (
              <>
                <button
                  onClick={() => handleJoinGroup(group.id)}
                  disabled={joining === group.id || (group.member_count || 0) >= group.max_members}
                  className="flex-1 glass-capsule-btn primary py-2 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <span className="relative z-10">
                    {joining === group.id ? 'Rejoindre...' : (group.member_count || 0) >= group.max_members ? 'Complet' : 'Rejoindre'}
                  </span>
                </button>
                <Link href={`/groupes/${group.id}`} className="glass-capsule-btn p-2">
                  <Icon name="EyeIcon" size={12} className="relative z-10" />
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* ── DESKTOP (Non-scrollable outer page 100dvh + CompteBackground + Nav 15/85 à gauche) ── */}
      <div className="hidden md:block">
        <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-transparent font-sans text-[#17402C] relative flex flex-col">
          <CompteBackground />
          <Header />

          {/* MAIN FULLSCREEN GRID (15% Left Nav / 85% Content Area) */}
          <main className="flex-1 min-h-0 overflow-hidden w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-4 flex gap-6">

            {/* NAV GAUCHE (15% / ~220px) */}
            <aside className="w-[220px] shrink-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-4">
              <div className="px-2 py-1">
                <span className="glass-pill px-3 py-1 text-[10px] font-bold tracking-widest uppercase block text-center">
                  🌲 Groupes LKDV
                </span>
              </div>
              <CommunityHubNav
                layoutVariant="vertical"
                activeTab="groupes"
              />
            </aside>

            {/* ZONE CONTENU DROITE (85% / flex-1) - SEULE ZONE SCROLLABLE */}
            <div className="flex-1 min-w-0 h-full overflow-y-auto custom-scrollbar pr-2 space-y-6">

              {/* Hero Header Card */}
              <div className="glass p-6 sm:p-8 relative overflow-hidden">
                <p className="text-[10px] font-mono text-[#5C6B5E] tracking-[0.2em] uppercase mb-2 font-bold">Groupes de voyage</p>
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
                  <div>
                    <h1 className="font-display font-bold text-3xl md:text-4xl text-[#17402C] tracking-tight">Voyager ensemble</h1>
                    <p className="text-[#5C6B5E] text-sm mt-1">Créez ou rejoignez des groupes de voyage collaboratifs</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      value={joinCode}
                      onChange={e => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="Code d'invitation"
                      className="glass-input w-36 py-2 px-3 text-xs uppercase"
                      onKeyDown={e => e.key === 'Enter' && handleJoinByCode()}
                    />
                    <button onClick={() => handleJoinByCode()} disabled={joiningByCode} className="glass-capsule-btn py-2 px-4 text-xs font-bold">
                      <span className="relative z-10">{joiningByCode ? '...' : 'Rejoindre'}</span>
                    </button>
                    <Link href="/nouveau-groupe" className="glass-capsule-btn primary py-2 px-4 text-xs font-bold flex items-center gap-1.5">
                      <Icon name="PlusIcon" size={14} className="relative z-10" />
                      <span className="relative z-10">Créer un groupe</span>
                    </Link>
                  </div>
                </div>

                {/* Quick links */}
                <div className="flex items-center gap-3 mb-6 flex-wrap">
                  <Link href="/communaute" className="glass-capsule-btn py-1.5 px-3 text-xs font-semibold flex items-center gap-1.5">
                    <Icon name="UsersIcon" size={12} className="relative z-10" />
                    <span className="relative z-10">Fil d'actualité</span>
                  </Link>
                  <Link href="/carnets" className="glass-capsule-btn py-1.5 px-3 text-xs font-semibold flex items-center gap-1.5">
                    <Icon name="BookOpenIcon" size={12} className="relative z-10" />
                    <span className="relative z-10">Carnets</span>
                  </Link>
                  <Link href="/clubs" className="glass-capsule-btn py-1.5 px-3 text-xs font-semibold flex items-center gap-1.5">
                    <Icon name="UserGroupIcon" size={12} className="relative z-10" />
                    <span className="relative z-10">Clubs</span>
                  </Link>
                  <Link href="/evenements" className="glass-capsule-btn py-1.5 px-3 text-xs font-semibold flex items-center gap-1.5">
                    <Icon name="CalendarIcon" size={12} className="relative z-10" />
                    <span className="relative z-10">Sorties</span>
                  </Link>
                  {user && (
                    <Link href={`/profil/${user.id}`} className="glass-capsule-btn py-1.5 px-3 text-xs font-semibold flex items-center gap-1.5">
                      <Icon name="UserCircleIcon" size={12} className="relative z-10" />
                      <span className="relative z-10">Mon profil</span>
                    </Link>
                  )}
                </div>

                {/* Tabs Bar */}
                <div className="glass-capsule-bar w-full">
                  {[
                    { id: 'mes-groupes', label: `Mes groupes${myGroups.length > 0 ? ` (${myGroups.length})` : ''}`, icon: 'UserGroupIcon' },
                    { id: 'decouvrir', label: 'Découvrir', icon: 'MagnifyingGlassIcon' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as MainTab)}
                      className={`glass-capsule-segment ${activeTab === tab.id ? 'active' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon name={tab.icon} size={14} className="relative z-10" />
                        <span className="relative z-10">{tab.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Content Stream */}
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => <div key={i} className="glass rounded-2xl h-64 animate-pulse" />)}
                </div>
              ) : error ? (
                <div className="glass text-center py-16 p-8">
                  <p className="text-5xl mb-4">⚠️</p>
                  <h2 className="font-display font-bold text-xl text-[#17402C] mb-2">Erreur de chargement</h2>
                  <p className="text-sm text-[#5C6B5E] mb-6">{error}</p>
                  <button
                    onClick={() => { setError(null); setLoading(true); loadAll().finally(() => setLoading(false)); }}
                    className="glass-capsule-btn primary px-6 py-3 text-xs font-bold"
                  >
                    <span className="relative z-10">Réessayer</span>
                  </button>
                </div>
              ) : activeTab === 'mes-groupes' ? (
                <div>
                  {user && pendingInvites.length > 0 && (
                    <div className="mb-6 p-5 glass rounded-2xl">
                      <div className="flex items-center gap-2 mb-3">
                        <Icon name="EnvelopeOpenIcon" size={16} className="text-[#17402C] relative z-10" />
                        <h3 className="font-display font-bold text-[#17402C]">{pendingInvites.length} invitation{pendingInvites.length > 1 ? 's' : ''} à rejoindre</h3>
                      </div>
                      <div className="space-y-2">
                        {pendingInvites.map(inv => (
                          <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 glass-sub-card rounded-xl">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[#17402C]">{inv.name}</p>
                              <p className="text-xs text-[#5C6B5E]">Vous avez été invité à rejoindre ce groupe.</p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={() => handleInvite(inv.group_id, true)}
                                disabled={inviteBusy === inv.group_id}
                                className="glass-capsule-btn primary px-4 py-2 text-xs font-bold disabled:opacity-50"
                              >
                                <span className="relative z-10">{inviteBusy === inv.group_id ? '...' : 'Accepter'}</span>
                              </button>
                              <button
                                onClick={() => handleInvite(inv.group_id, false)}
                                disabled={inviteBusy === inv.group_id}
                                className="glass-capsule-btn px-4 py-2 text-xs font-semibold text-red-600 disabled:opacity-50"
                              >
                                <span className="relative z-10">Refuser</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {!user ? (
                    <div className="glass text-center py-16 p-8">
                      <p className="text-5xl mb-4">🗺️</p>
                      <h2 className="font-display font-bold text-xl text-[#17402C] mb-2">Connectez-vous pour voir vos groupes</h2>
                      <p className="text-sm text-[#5C6B5E] mb-6">Créez ou rejoignez des groupes de voyage collaboratifs</p>
                      <Link href="/connexion" className="glass-capsule-btn primary px-6 py-3 text-xs font-bold inline-flex items-center gap-2">
                        <Icon name="ArrowRightOnRectangleIcon" size={14} className="relative z-10" />
                        <span className="relative z-10">Se connecter</span>
                      </Link>
                    </div>
                  ) : myGroups.length === 0 ? (
                    <div className="glass text-center py-16 p-8">
                      <p className="text-5xl mb-4">🗺️</p>
                      <h2 className="font-display font-bold text-xl text-[#17402C] mb-2">Vous n&apos;avez pas encore de groupe</h2>
                      <p className="text-sm text-[#5C6B5E] mb-6">Créez votre premier groupe ou rejoignez-en un avec un code d&apos;invitation</p>
                      <div className="flex gap-3 justify-center flex-wrap">
                        <Link href="/nouveau-groupe" className="glass-capsule-btn primary px-6 py-3 text-xs font-bold inline-flex items-center gap-2">
                          <Icon name="PlusIcon" size={14} className="relative z-10" />
                          <span className="relative z-10">Créer un groupe</span>
                        </Link>
                        <button onClick={() => setActiveTab('decouvrir')} className="glass-capsule-btn px-6 py-3 text-xs font-semibold inline-flex items-center gap-2">
                          <Icon name="MagnifyingGlassIcon" size={14} className="relative z-10" />
                          <span className="relative z-10">Découvrir des groupes</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm text-[#5C6B5E] font-medium">{myGroups.length} groupe{myGroups.length > 1 ? 's' : ''}</p>
                        <Link href="/nouveau-groupe" className="glass-capsule-btn primary px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5">
                          <Icon name="PlusIcon" size={14} className="relative z-10" />
                          <span className="relative z-10">Nouveau groupe</span>
                        </Link>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {myGroups.map(group => <GroupCard key={group.id} group={group} showActions />)}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {/* Filters */}
                  <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    <div className="relative flex-1">
                      <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5C6B5E] relative z-10" />
                      <input
                        className="glass-input w-full pl-10 pr-4 py-2.5 text-sm text-[#17402C] focus:outline-none"
                        placeholder="Rechercher par nom ou destination..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {['Tous', ...THEMES].map(theme => (
                        <button
                          key={theme}
                          onClick={() => setSelectedTheme(theme)}
                          className={`glass-pill cursor-pointer whitespace-nowrap ${selectedTheme === theme ? 'bg-[#17402C] text-white' : ''}`}
                        >
                          {theme !== 'Tous' ? `${THEME_EMOJI[theme]} ` : ''}{theme}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filteredPublic.length === 0 ? (
                    <div className="glass text-center py-16 p-8 text-[#5C6B5E]">
                      <p className="text-4xl mb-3">🔍</p>
                      <p className="font-display font-bold text-[#17402C] text-lg mb-1">Aucun groupe trouvé</p>
                      <p className="text-sm">{search ? `Aucun résultat pour "${search}"` : 'Aucun groupe public disponible'}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-[#5C6B5E] mb-4 font-medium">{filteredPublic.length} groupe{filteredPublic.length > 1 ? 's' : ''} public{filteredPublic.length > 1 ? 's' : ''}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredPublic.map(group => <GroupCard key={group.id} group={group} />)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>

        {/* Edit Group Modal */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display font-bold text-lg text-[#17402C]">Modifier le groupe</h3>
                <button onClick={() => { setShowEditModal(false); setEditingGroup(null); }} className="glass-capsule-btn p-2">
                  <Icon name="XMarkIcon" size={18} className="relative z-10" />
                </button>
              </div>
              {editingGroup?.invite_code && (
                <div className="mb-4 p-3 glass-sub-card rounded-xl flex items-center gap-3">
                  <Icon name="LinkIcon" size={14} className="text-[#17402C] flex-shrink-0 relative z-10" />
                  <div>
                    <p className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-wider font-bold">Code d&apos;invitation</p>
                    <p className="font-mono font-bold text-[#17402C] text-sm tracking-widest">{editingGroup.invite_code}</p>
                  </div>
                </div>
              )}
              <form onSubmit={handleEditGroup} className="space-y-4">
                <div><label className={labelCls}>Nom du groupe *</label><input required value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} className={inputCls} placeholder="Trek Himalaya 2026" /></div>
                <div><label className={labelCls}>Destination *</label><input required value={createForm.destination} onChange={e => setCreateForm({ ...createForm, destination: e.target.value })} className={inputCls} placeholder="Nepal - Everest Base Camp" /></div>
                <div><label className={labelCls}>Description</label><textarea value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} rows={2} className={`${inputCls} resize-none`} placeholder="Décrivez votre aventure..." /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>Thème</label><select value={createForm.theme} onChange={e => setCreateForm({ ...createForm, theme: e.target.value })} className={inputCls}>{THEMES.map(t => <option key={t}>{t}</option>)}</select></div>
                  <div><label className={labelCls}>Visibilité</label><select value={createForm.visibility} onChange={e => setCreateForm({ ...createForm, visibility: e.target.value })} className={inputCls}><option value="public">🌍 Public</option><option value="private">🔒 Privé</option><option value="invite_only">🔗 Sur invitation</option></select></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>Départ</label><input type="date" value={createForm.departure_date} onChange={e => setCreateForm({ ...createForm, departure_date: e.target.value })} className={inputCls} /></div>
                  <div><label className={labelCls}>Retour</label><input type="date" value={createForm.return_date} onChange={e => setCreateForm({ ...createForm, return_date: e.target.value })} className={inputCls} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>Budget (€)</label><input type="number" value={createForm.budget_target} onChange={e => setCreateForm({ ...createForm, budget_target: e.target.value })} className={inputCls} placeholder="2500" /></div>
                  <div><label className={labelCls}>Max membres</label><input type="number" min={2} max={50} value={createForm.max_members} onChange={e => setCreateForm({ ...createForm, max_members: e.target.value })} className={inputCls} /></div>
                </div>
                <button type="submit" disabled={creating} className="w-full glass-capsule-btn primary py-3 text-xs font-bold disabled:opacity-50">
                  <span className="relative z-10">{creating ? 'Enregistrement...' : 'Enregistrer'}</span>
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden min-h-screen relative font-sans text-[#17402C]">
        <CompteBackground />
        <MobilePageShell videoBackground={false} background="transparent">
          <MobileGroupesHub
            myGroups={myGroups}
            publicGroups={publicGroups}
            loading={loading}
            user={user}
            onJoinGroup={async (gid) => handleJoinGroup(gid)}
            onOpenCreateModal={() => {
              if (!user) {
                toast('Veuillez vous connecter pour créer un groupe.', 'error');
                router.push('/connexion?next=/nouveau-groupe');
                return;
              }
              router.push('/nouveau-groupe');
            }}
            onOpenJoinByCode={() => {
              const code = window.prompt('Entrez le code d’invitation du groupe :');
              if (code) {
                setJoinCode(code);
                handleJoinByCode(code);
              }
            }}
            onRefresh={async () => {
              await Promise.all([loadMyGroups(), loadPublicGroups()]);
            }}
          />
        </MobilePageShell>
      </div>
    </>
  );
}

export default function GroupesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50 flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#17402C] border-t-transparent rounded-full animate-spin" /></div>}>
      <GroupesPageInner />
    </Suspense>
  );
}
