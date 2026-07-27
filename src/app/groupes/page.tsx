'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import CreateGroupWizardModal from '@/components/groupes/CreateGroupWizardModal';

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

const inputCls = "w-full bg-white border border-[#C8C3B0] rounded-xl px-3 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#E4501C]/30 focus:border-[#E4501C]/40 transition-colors";
const labelCls = "block text-[10px] font-mono text-[#5C6B5E] uppercase tracking-[0.15em] mb-1.5";

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
  const [search, setSearch] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('Tous');
  const [joining, setJoining] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [joiningByCode, setJoiningByCode] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TravelGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '', description: '', destination: '', theme: 'Trek',
    visibility: 'public', departure_date: '', return_date: '',
    budget_target: '', max_members: '20',
  });

  const loadMyGroups = useCallback(async () => {
    if (!user) { setMyGroups([]); return; }
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
  }, [user, supabase]);

  const loadPublicGroups = useCallback(async () => {
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
    setPublicGroups(enriched);
  }, [supabase]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([loadMyGroups(), loadPublicGroups()]);
      setLoading(false);
    };
    load();
  }, [loadMyGroups, loadPublicGroups]);

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { toast('Connectez-vous pour créer un groupe', 'error'); return; }
    setCreating(true);
    try {
      const { data: group, error } = await supabase.from('travel_groups').insert({
        name: createForm.name, description: createForm.description, destination: createForm.destination,
        theme: createForm.theme, visibility: createForm.visibility,
        departure_date: createForm.departure_date || null, return_date: createForm.return_date || null,
        budget_target: parseFloat(createForm.budget_target) || 0, max_members: parseInt(createForm.max_members) || 20, owner_id: user.id,
      }).select().single();
      if (error) throw error;
      await supabase.from('group_members').insert({ group_id: group.id, user_id: user.id, role: 'organizer', status: 'active' });
      toast('Groupe créé !', 'success');
      setShowCreateModal(false);
      setCreateForm({ name: '', description: '', destination: '', theme: 'Trek', visibility: 'public', departure_date: '', return_date: '', budget_target: '', max_members: '20' });
      await loadMyGroups();
      setActiveTab('mes-groupes');
      router.push(`/groupe?group=${group.id}`);
    } catch (err: unknown) { toast((err as Error).message || 'Erreur', 'error'); }
    finally { setCreating(false); }
  }

  async function handleEditGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!editingGroup) return;
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
  }

  async function handleJoinGroup(groupId: string) {
    if (!user) { toast('Connectez-vous pour rejoindre un groupe', 'error'); return; }
    setJoining(groupId);
    try {
      const { error } = await supabase.from('group_members').insert({ group_id: groupId, user_id: user.id, role: 'member', status: 'active' });
      if (error && error.code !== '23505') throw error;
      toast('Vous avez rejoint le groupe !', 'success');
      await Promise.all([loadMyGroups(), loadPublicGroups()]);
      router.push(`/groupe?group=${groupId}`);
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

  async function handleJoinByCode() {
    if (!user) { toast('Connectez-vous pour rejoindre un groupe', 'error'); return; }
    if (!joinCode.trim()) return;
    setJoiningByCode(true);
    try {
      const { data: group } = await supabase.from('travel_groups').select('*').eq('invite_code', joinCode.trim().toUpperCase()).maybeSingle();
      if (!group) { toast('Code invalide', 'error'); return; }
      const { error } = await supabase.from('group_members').insert({ group_id: group.id, user_id: user.id, role: 'member', status: 'active' });
      if (error && error.code !== '23505') throw error;
      toast(`Vous avez rejoint "${group.name}" !`, 'success');
      setJoinCode('');
      await loadMyGroups();
      router.push(`/groupe?group=${group.id}`);
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
      <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl overflow-hidden hover:shadow-md hover:border-[#E4501C]/30 transition-all group">
        {/* Header */}
        <div className="bg-[#1C2620] p-4 relative">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-2xl flex-shrink-0">
                {THEME_EMOJI[group.theme] || '🎒'}
              </div>
              <div>
                <h3 className="font-display font-700 text-white text-base leading-tight">{group.name}</h3>
                <p className="text-white/50 text-xs flex items-center gap-1 mt-0.5">
                  <Icon name="MapPinIcon" size={10} /> {group.destination}
                </p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="font-mono font-700 text-[#E4501C] text-lg">{group.optimization_score}</div>
              <div className="text-[10px] text-white/40">score</div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/70">{group.theme}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-600 ${group.visibility === 'public' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
              {group.visibility === 'public' ? '🌍 Public' : group.visibility === 'private' ? '🔒 Privé' : '🔗 Invitation'}
            </span>
            <span className="text-[10px] text-white/40">Niv. {group.group_level}</span>
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          {group.description && <p className="text-xs text-[#5C6B5E] mb-3 line-clamp-2">{group.description}</p>}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center p-2 bg-white/60 rounded-xl border border-[#C8C3B0]/50">
              <p className="font-mono font-700 text-[#1C2620] text-sm">{group.member_count || 0}</p>
              <p className="text-[10px] text-[#5C6B5E]">membres</p>
            </div>
            <div className="text-center p-2 bg-white/60 rounded-xl border border-[#C8C3B0]/50">
              <p className="font-mono font-700 text-[#1C2620] text-sm">{group.budget_target > 0 ? `${group.budget_target}€` : '—'}</p>
              <p className="text-[10px] text-[#5C6B5E]">budget</p>
            </div>
            <div className="text-center p-2 bg-white/60 rounded-xl border border-[#C8C3B0]/50">
              <p className="font-mono font-700 text-[#1C2620] text-sm">{group.max_members}</p>
              <p className="text-[10px] text-[#5C6B5E]">max</p>
            </div>
          </div>
          {group.departure_date && (
            <p className="text-[10px] text-[#5C6B5E] flex items-center gap-1 mb-3">
              <Icon name="CalendarIcon" size={10} />
              {new Date(group.departure_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              {group.return_date && ` → ${new Date(group.return_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`}
            </p>
          )}
          {group.owner && (
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-[#C8C3B0]/50">
              <div className="w-5 h-5 rounded-full bg-[#E4501C]/20 flex items-center justify-center text-[10px] font-700 text-[#E4501C]">
                {group.owner.full_name?.[0] || '?'}
              </div>
              <span className="text-[10px] text-[#5C6B5E]">Organisé par <span className="font-600 text-[#1C2620]">{group.owner.full_name}</span></span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {showActions ? (
              <>
                <Link href={`/groupe?group=${group.id}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#E4501C] hover:bg-[#E4501C]/90 text-white rounded-xl text-xs font-700 transition-colors">
                  <Icon name="ArrowRightIcon" size={12} /> Ouvrir
                </Link>
                {myRole && (
                  <span className={`px-2.5 py-2 rounded-xl text-[10px] font-600 ${myRole === 'organizer' ? 'bg-amber-100 text-amber-700' : myRole === 'co_organizer' ? 'bg-blue-100 text-blue-700' : 'bg-[#E7E3D6] text-[#5C6B5E]'}`}>
                    {myRole === 'organizer' ? '👑' : myRole === 'co_organizer' ? '🛡️' : '👤'}
                  </span>
                )}
                {(isOwner || myRole === 'organizer') && (
                  <button onClick={() => openEditModal(group)} className="p-2 border border-[#C8C3B0] text-[#5C6B5E] rounded-xl hover:border-[#E4501C]/40 hover:text-[#E4501C] transition-colors">
                    <Icon name="PencilIcon" size={12} />
                  </button>
                )}
                {myRole && myRole !== 'organizer' && (
                  <button onClick={() => handleLeaveGroup(group.id)} className="p-2 border border-[#C8C3B0] text-[#5C6B5E] rounded-xl hover:border-red-300 hover:text-red-500 transition-colors">
                    <Icon name="ArrowRightOnRectangleIcon" size={12} />
                  </button>
                )}
                {isOwner && (
                  <button onClick={() => handleDeleteGroup(group.id)} className="p-2 border border-[#C8C3B0] text-[#5C6B5E] rounded-xl hover:border-red-300 hover:text-red-500 transition-colors">
                    <Icon name="TrashIcon" size={12} />
                  </button>
                )}
              </>
            ) : alreadyMember ? (
              <Link href={`/groupe?group=${group.id}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#1C2620] hover:bg-[#1C2620]/80 text-white rounded-xl text-xs font-700 transition-colors">
                <Icon name="ArrowRightIcon" size={12} /> Déjà membre — Ouvrir
              </Link>
            ) : (
              <>
                <button
                  onClick={() => handleJoinGroup(group.id)}
                  disabled={joining === group.id || (group.member_count || 0) >= group.max_members}
                  className="flex-1 py-2 bg-[#E4501C] hover:bg-[#E4501C]/90 text-white rounded-xl text-xs font-700 transition-colors disabled:opacity-50"
                >
                  {joining === group.id ? 'Rejoindre...' : (group.member_count || 0) >= group.max_members ? 'Complet' : 'Rejoindre'}
                </button>
                <Link href={`/groupe?group=${group.id}`} className="p-2 border border-[#C8C3B0] text-[#5C6B5E] rounded-xl hover:border-[#1C2620]/30 hover:text-[#1C2620] transition-colors">
                  <Icon name="EyeIcon" size={12} />
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F5F2E8]">
      <Header />

      {/* Hero */}
      <section className="bg-[#1C2620] pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-[10px] font-mono text-[#E4501C] tracking-[0.2em] uppercase mb-2">Groupes de voyage</p>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="font-display font-800 text-2xl md:text-3xl text-white tracking-tight">Voyager ensemble</h1>
              <p className="text-white/50 text-sm mt-1">Créez ou rejoignez des groupes de voyage collaboratifs</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Code d'invitation"
                className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#E4501C]/60 w-36"
                onKeyDown={e => e.key === 'Enter' && handleJoinByCode()}
              />
              <button onClick={handleJoinByCode} disabled={joiningByCode} className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm px-3 py-2 rounded-xl transition-colors">
                {joiningByCode ? '...' : 'Rejoindre'}
              </button>
              <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 bg-[#E4501C] hover:bg-[#E4501C]/90 text-white text-sm px-4 py-2 rounded-xl transition-colors font-600">
                <Icon name="PlusIcon" size={14} /> Créer un groupe
              </button>
            </div>
          </div>

          {/* Quick links */}
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <Link href="/communaute" className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white rounded-xl text-xs font-600 transition-colors">
              <Icon name="UsersIcon" size={12} /> Communauté
            </Link>
            <Link href="/carnets" className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white rounded-xl text-xs font-600 transition-colors">
              <Icon name="BookOpenIcon" size={12} /> Carnets
            </Link>
            {user && (
              <Link href={`/profil/${user.id}`} className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white rounded-xl text-xs font-600 transition-colors">
                <Icon name="UserCircleIcon" size={12} /> Mon profil
              </Link>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-0.5">
            {[
              { id: 'mes-groupes', label: `Mes groupes${myGroups.length > 0 ? ` (${myGroups.length})` : ''}`, icon: 'UserGroupIcon' },
              { id: 'decouvrir', label: 'Découvrir', icon: 'MagnifyingGlassIcon' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as MainTab)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl text-sm font-600 transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-[#F5F2E8] text-[#1C2620]' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
              >
                <Icon name={tab.icon} size={14} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl h-64 animate-pulse" />)}
          </div>
        ) : activeTab === 'mes-groupes' ? (
          <div>
            {!user ? (
              <div className="text-center py-16">
                <p className="text-5xl mb-4">🗺️</p>
                <h2 className="font-display font-700 text-xl text-[#1C2620] mb-2">Connectez-vous pour voir vos groupes</h2>
                <p className="text-sm text-[#5C6B5E] mb-6">Créez ou rejoignez des groupes de voyage collaboratifs</p>
                <Link href="/connexion" className="inline-flex items-center gap-2 px-6 py-3 bg-[#E4501C] text-white rounded-xl font-700 hover:bg-[#E4501C]/90 transition-colors">
                  <Icon name="ArrowRightOnRectangleIcon" size={14} /> Se connecter
                </Link>
              </div>
            ) : myGroups.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-5xl mb-4">🗺️</p>
                <h2 className="font-display font-700 text-xl text-[#1C2620] mb-2">Vous n&apos;avez pas encore de groupe</h2>
                <p className="text-sm text-[#5C6B5E] mb-6">Créez votre premier groupe ou rejoignez-en un avec un code d&apos;invitation</p>
                <div className="flex gap-3 justify-center flex-wrap">
                  <button onClick={() => setShowCreateModal(true)} className="inline-flex items-center gap-2 px-6 py-3 bg-[#E4501C] text-white rounded-xl font-700 hover:bg-[#E4501C]/90 transition-colors">
                    <Icon name="PlusIcon" size={14} /> Créer un groupe
                  </button>
                  <button onClick={() => setActiveTab('decouvrir')} className="inline-flex items-center gap-2 px-6 py-3 border border-[#C8C3B0] text-[#5C6B5E] rounded-xl font-600 hover:text-[#1C2620] transition-colors">
                    <Icon name="MagnifyingGlassIcon" size={14} /> Découvrir des groupes
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <p className="text-sm text-[#5C6B5E]">{myGroups.length} groupe{myGroups.length > 1 ? 's' : ''}</p>
                  <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 bg-[#E4501C] hover:bg-[#E4501C]/90 text-white text-sm px-4 py-2 rounded-xl transition-colors font-600">
                    <Icon name="PlusIcon" size={14} /> Nouveau groupe
                  </button>
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
                <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5C6B5E]" />
                <input
                  className="w-full bg-[#EDEAE0] border border-[#C8C3B0] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#E4501C]/30"
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
                    className={`px-3 py-2 rounded-xl text-xs font-600 border whitespace-nowrap transition-all ${selectedTheme === theme ? 'bg-[#1C2620] text-white border-[#1C2620]' : 'border-[#C8C3B0] text-[#5C6B5E] hover:border-[#1C2620]/30'}`}
                  >
                    {theme !== 'Tous' ? `${THEME_EMOJI[theme]} ` : ''}{theme}
                  </button>
                ))}
              </div>
            </div>

            {filteredPublic.length === 0 ? (
              <div className="text-center py-16 text-[#5C6B5E]">
                <p className="text-4xl mb-3">🔍</p>
                <p className="font-display font-700 text-[#1C2620] text-lg mb-1">Aucun groupe trouvé</p>
                <p className="text-sm">{search ? `Aucun résultat pour "${search}"` : 'Aucun groupe public disponible'}</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-[#5C6B5E] mb-4">{filteredPublic.length} groupe{filteredPublic.length > 1 ? 's' : ''} public{filteredPublic.length > 1 ? 's' : ''}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredPublic.map(group => <GroupCard key={group.id} group={group} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Group Wizard Modal */}
      <CreateGroupWizardModal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)}
        onSuccess={async (newId) => {
          await loadMyGroups();
          router.push(`/groupes/${newId}`);
        }}
      />

      {/* Edit Group Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-700 text-lg text-[#1C2620]">Modifier le groupe</h3>
              <button onClick={() => { setShowEditModal(false); setEditingGroup(null); }} className="p-2 rounded-xl hover:bg-[#C8C3B0]/40 transition-colors"><Icon name="XMarkIcon" size={18} /></button>
            </div>
            {editingGroup?.invite_code && (
              <div className="mb-4 p-3 bg-[#E4501C]/5 border border-[#E4501C]/20 rounded-xl flex items-center gap-3">
                <Icon name="LinkIcon" size={14} className="text-[#E4501C] flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-wider">Code d&apos;invitation</p>
                  <p className="font-mono font-700 text-[#E4501C] text-sm tracking-widest">{editingGroup.invite_code}</p>
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
              <button type="submit" disabled={creating} className="w-full py-3 bg-[#E4501C] hover:bg-[#E4501C]/90 text-white rounded-xl font-700 transition-colors disabled:opacity-50">
                {creating ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

export default function GroupesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F2E8] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#E4501C] border-t-transparent rounded-full animate-spin" /></div>}>
      <GroupesPageInner />
    </Suspense>
  );
}
