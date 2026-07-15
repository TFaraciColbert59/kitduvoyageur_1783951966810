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

function GroupesPage() {
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
    const { data: memberData } = await supabase
      .from('group_members')
      .select('group_id, role')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (!memberData?.length) { setMyGroups([]); return; }

    const groupIds = memberData.map(m => m.group_id);
    const { data: groups } = await supabase
      .from('travel_groups')
      .select('*, owner:user_profiles!travel_groups_owner_id_fkey(full_name, avatar_url)')
      .in('id', groupIds)
      .order('created_at', { ascending: false });

    const enriched = await Promise.all((groups || []).map(async (g) => {
      const { count } = await supabase
        .from('group_members').select('*', { count: 'exact', head: true })
        .eq('group_id', g.id).eq('status', 'active');
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
      const { count } = await supabase
        .from('group_members').select('*', { count: 'exact', head: true })
        .eq('group_id', g.id).eq('status', 'active');
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
      const { data: group, error } = await supabase
        .from('travel_groups')
        .insert({
          name: createForm.name, description: createForm.description,
          destination: createForm.destination, theme: createForm.theme,
          visibility: createForm.visibility,
          departure_date: createForm.departure_date || null,
          return_date: createForm.return_date || null,
          budget_target: parseFloat(createForm.budget_target) || 0,
          max_members: parseInt(createForm.max_members) || 20,
          owner_id: user.id,
        })
        .select().single();
      if (error) throw error;
      await supabase.from('group_members').insert({
        group_id: group.id, user_id: user.id, role: 'organizer', status: 'active',
      });
      toast('Groupe créé !', 'success');
      setShowCreateModal(false);
      setCreateForm({ name: '', description: '', destination: '', theme: 'Trek', visibility: 'public', departure_date: '', return_date: '', budget_target: '', max_members: '20' });
      await loadMyGroups();
      setActiveTab('mes-groupes');
      router.push(`/groupe?group=${group.id}`);
    } catch (err: any) {
      toast(err.message || 'Erreur', 'error');
    } finally {
      setCreating(false);
    }
  }

  async function handleEditGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!editingGroup) return;
    try {
      const { error } = await supabase.from('travel_groups').update({
        name: createForm.name, description: createForm.description,
        destination: createForm.destination, theme: createForm.theme,
        visibility: createForm.visibility,
        departure_date: createForm.departure_date || null,
        return_date: createForm.return_date || null,
        budget_target: parseFloat(createForm.budget_target) || 0,
        max_members: parseInt(createForm.max_members) || 20,
      }).eq('id', editingGroup.id);
      if (error) throw error;
      toast('Groupe modifié !', 'success');
      setShowEditModal(false);
      setEditingGroup(null);
      await Promise.all([loadMyGroups(), loadPublicGroups()]);
    } catch (err: any) {
      toast(err.message || 'Erreur', 'error');
    }
  }

  async function handleJoinGroup(groupId: string) {
    if (!user) { toast('Connectez-vous pour rejoindre un groupe', 'error'); return; }
    setJoining(groupId);
    try {
      const { error } = await supabase.from('group_members').insert({
        group_id: groupId, user_id: user.id, role: 'member', status: 'active',
      });
      if (error && error.code !== '23505') throw error;
      toast('Vous avez rejoint le groupe !', 'success');
      await Promise.all([loadMyGroups(), loadPublicGroups()]);
      router.push(`/groupe?group=${groupId}`);
    } catch (err: any) {
      toast(err.message || 'Erreur', 'error');
    } finally {
      setJoining(null);
    }
  }

  async function handleLeaveGroup(groupId: string) {
    if (!user) return;
    try {
      await supabase.from('group_members').delete()
        .eq('group_id', groupId).eq('user_id', user.id);
      toast('Vous avez quitté le groupe', 'success');
      await loadMyGroups();
    } catch (err: any) {
      toast(err.message || 'Erreur', 'error');
    }
  }

  async function handleJoinByCode() {
    if (!user) { toast('Connectez-vous pour rejoindre un groupe', 'error'); return; }
    if (!joinCode.trim()) return;
    setJoiningByCode(true);
    try {
      const { data: group } = await supabase
        .from('travel_groups').select('*')
        .eq('invite_code', joinCode.trim().toUpperCase()).maybeSingle();
      if (!group) { toast('Code invalide', 'error'); return; }
      const { error } = await supabase.from('group_members').insert({
        group_id: group.id, user_id: user.id, role: 'member', status: 'active',
      });
      if (error && error.code !== '23505') throw error;
      toast(`Vous avez rejoint "${group.name}" !`, 'success');
      setJoinCode('');
      await loadMyGroups();
      router.push(`/groupe?group=${group.id}`);
    } catch (err: any) {
      toast(err.message || 'Erreur', 'error');
    } finally {
      setJoiningByCode(false);
    }
  }

  function openEditModal(group: TravelGroup) {
    setEditingGroup(group);
    setCreateForm({
      name: group.name, description: group.description || '',
      destination: group.destination, theme: group.theme,
      visibility: group.visibility,
      departure_date: group.departure_date?.split('T')[0] || '',
      return_date: group.return_date?.split('T')[0] || '',
      budget_target: group.budget_target?.toString() || '',
      max_members: group.max_members?.toString() || '20',
    });
    setShowEditModal(true);
  }

  const filteredPublic = publicGroups.filter(g => {
    const matchSearch = !search || g.name.toLowerCase().includes(search.toLowerCase()) || g.destination.toLowerCase().includes(search.toLowerCase());
    const matchTheme = selectedTheme === 'Tous' || g.theme === selectedTheme;
    const notMember = !myGroups.find(mg => mg.id === g.id);
    return matchSearch && matchTheme && notMember;
  });

  const GroupCard = ({ group, isMine }: { group: TravelGroup; isMine: boolean }) => (
    <div className="topo-card p-5 flex flex-col hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{THEME_EMOJI[group.theme] || '🎒'}</span>
            <h3 className="font-display font-700 text-sm text-foreground truncate" style={{ fontFamily: 'var(--font-display)' }}>{group.name}</h3>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon name="MapPinIcon" size={11} variant="outline" />
            <span className="truncate">{group.destination}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{group.theme}</span>
          {isMine && group.my_role && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-600 ${group.my_role === 'organizer' ? 'bg-amber-100 text-amber-700' : group.my_role === 'co_organizer' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
              {group.my_role === 'organizer' ? '👑 Organisateur' : group.my_role === 'co_organizer' ? '🛡️ Co-org' : '👤 Membre'}
            </span>
          )}
        </div>
      </div>

      {group.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{group.description}</p>
      )}

      {group.departure_date && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
          <Icon name="CalendarIcon" size={11} variant="outline" />
          <span>{new Date(group.departure_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          {group.return_date && <><span>→</span><span>{new Date(group.return_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span></>}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center p-2 bg-background rounded-lg border border-border">
          <div className="font-mono text-sm font-700 text-foreground">{group.member_count || 0}</div>
          <div className="text-[10px] text-muted-foreground">membres</div>
        </div>
        <div className="text-center p-2 bg-background rounded-lg border border-border">
          <div className="font-mono text-sm font-700 text-foreground">{group.budget_target > 0 ? `${group.budget_target}€` : '—'}</div>
          <div className="text-[10px] text-muted-foreground">budget</div>
        </div>
        <div className="text-center p-2 bg-background rounded-lg border border-border">
          <div className="font-mono text-sm font-700 text-primary">{group.optimization_score}</div>
          <div className="text-[10px] text-muted-foreground">score</div>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
          <span>Places</span><span>{group.member_count || 0}/{group.max_members}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(((group.member_count || 0) / group.max_members) * 100, 100)}%` }} />
        </div>
      </div>

      {!isMine && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
          <Icon name="UserIcon" size={11} variant="outline" />
          <span>Par {(group.owner as any)?.full_name || 'Anonyme'}</span>
        </div>
      )}

      <div className="flex gap-2 mt-auto">
        <Link
          href={`/groupe?group=${group.id}`}
          className="flex-1 text-center border border-border text-foreground py-2 px-3 text-xs rounded-lg hover:border-primary hover:text-primary transition-colors font-medium"
        >
          Ouvrir
        </Link>
        {isMine ? (
          <>
            {(group.my_role === 'organizer' || group.my_role === 'co_organizer') && (
              <button
                onClick={() => openEditModal(group)}
                className="border border-border text-muted-foreground py-2 px-3 text-xs rounded-lg hover:border-primary hover:text-primary transition-colors"
                title="Modifier"
              >
                <Icon name="PencilIcon" size={12} variant="outline" />
              </button>
            )}
            {group.my_role !== 'organizer' && (
              <button
                onClick={() => handleLeaveGroup(group.id)}
                className="border border-red-200 text-red-500 py-2 px-3 text-xs rounded-lg hover:bg-red-50 transition-colors"
                title="Quitter"
              >
                <Icon name="ArrowRightOnRectangleIcon" size={12} variant="outline" />
              </button>
            )}
          </>
        ) : (
          (group.member_count || 0) < group.max_members ? (
            <button
              onClick={() => handleJoinGroup(group.id)}
              disabled={joining === group.id}
              className="flex-1 btn-primary py-2 px-3 text-xs justify-center"
            >
              {joining === group.id ? '...' : 'Rejoindre'}
            </button>
          ) : (
            <span className="flex-1 text-center bg-muted text-muted-foreground py-2 px-3 text-xs rounded-lg">Complet</span>
          )
        )}
      </div>
    </div>
  );

  const GroupForm = ({ onSubmit, submitLabel }: { onSubmit: (e: React.FormEvent) => void; submitLabel: string }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Nom du groupe *</label>
          <input required value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" placeholder="Trek Himalaya 2026" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Destination *</label>
          <input required value={createForm.destination} onChange={e => setCreateForm({ ...createForm, destination: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" placeholder="Nepal — Everest Base Camp" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Description</label>
          <textarea value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} rows={2} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors resize-none" placeholder="Décrivez votre aventure..." />
        </div>
        <div>
          <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Thème</label>
          <select value={createForm.theme} onChange={e => setCreateForm({ ...createForm, theme: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors">
            {THEMES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Visibilité</label>
          <select value={createForm.visibility} onChange={e => setCreateForm({ ...createForm, visibility: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors">
            <option value="public">🌍 Public</option>
            <option value="private">🔒 Privé</option>
            <option value="invite_only">🔗 Sur invitation</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Date de départ</label>
          <input type="date" value={createForm.departure_date} onChange={e => setCreateForm({ ...createForm, departure_date: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" />
        </div>
        <div>
          <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Date de retour</label>
          <input type="date" value={createForm.return_date} onChange={e => setCreateForm({ ...createForm, return_date: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" />
        </div>
        <div>
          <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Budget (€)</label>
          <input type="number" value={createForm.budget_target} onChange={e => setCreateForm({ ...createForm, budget_target: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" placeholder="2500" />
        </div>
        <div>
          <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Max membres</label>
          <input type="number" min={2} max={50} value={createForm.max_members} onChange={e => setCreateForm({ ...createForm, max_members: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" />
        </div>
      </div>
      <button type="submit" disabled={creating} className="btn-primary w-full justify-center py-3 mt-2">
        {creating ? 'En cours...' : submitLabel}
      </button>
    </form>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {/* Hero */}
      <section className="pt-20 bg-dark-bg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <p className="font-mono text-xs text-primary tracking-widest uppercase mb-2">GROUPES DE VOYAGE</p>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="font-display font-800 text-3xl md:text-4xl text-white tracking-tight" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                Voyagez ensemble
              </h1>
              <p className="text-white/60 text-sm mt-1">Créez ou rejoignez des groupes pour des aventures collaboratives</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <div className="flex gap-1">
                <input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleJoinByCode()}
                  placeholder="Code d'invitation"
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-primary w-36"
                />
                <button onClick={handleJoinByCode} disabled={joiningByCode} className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm px-3 py-2 rounded-lg transition-colors whitespace-nowrap">
                  {joiningByCode ? '...' : 'Rejoindre'}
                </button>
              </div>
              <button
                onClick={() => { setShowCreateModal(true); setCreateForm({ name: '', description: '', destination: '', theme: 'Trek', visibility: 'public', departure_date: '', return_date: '', budget_target: '', max_members: '20' }); }}
                className="btn-primary py-2 px-4 text-sm flex items-center gap-2"
              >
                <Icon name="PlusIcon" size={14} variant="outline" />
                Créer un groupe
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-6 mt-6 pt-6 border-t border-white/10">
            <div><div className="font-mono text-xl font-700 text-white">{myGroups.length}</div><div className="text-xs text-white/40">Mes groupes</div></div>
            <div><div className="font-mono text-xl font-700 text-white">{publicGroups.length}</div><div className="text-xs text-white/40">Groupes publics</div></div>
            <div><div className="font-mono text-xl font-700 text-white">{new Set(publicGroups.map(g => g.destination)).size}</div><div className="text-xs text-white/40">Destinations</div></div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="border-b border-border bg-card sticky top-16 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-0">
            {([
              { id: 'mes-groupes', label: 'Mes groupes', icon: 'UserGroupIcon', count: myGroups.length },
              { id: 'decouvrir', label: 'Découvrir', icon: 'MagnifyingGlassIcon', count: filteredPublic.length },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-600 border-b-2 transition-all ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                <Icon name={tab.icon} size={14} variant="outline" />
                {tab.label}
                <span className={`text-[10px] font-700 px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{tab.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* MES GROUPES */}
            {activeTab === 'mes-groupes' && (
              <div>
                {!user ? (
                  <div className="text-center py-16 bg-card rounded-2xl border border-border">
                    <span className="text-5xl block mb-4">🔐</span>
                    <h3 className="font-display font-700 text-lg text-foreground mb-2">Connectez-vous</h3>
                    <p className="text-sm text-muted-foreground mb-4">Créez un compte pour rejoindre et créer des groupes de voyage</p>
                    <Link href="/connexion" className="btn-primary py-2 px-5 text-sm inline-flex items-center gap-2">
                      <Icon name="UserIcon" size={14} variant="outline" /> Se connecter
                    </Link>
                  </div>
                ) : myGroups.length === 0 ? (
                  <div className="text-center py-16 bg-card rounded-2xl border border-border">
                    <span className="text-5xl block mb-4">🗺️</span>
                    <h3 className="font-display font-700 text-lg text-foreground mb-2">Aucun groupe pour l&apos;instant</h3>
                    <p className="text-sm text-muted-foreground mb-6">Créez votre premier groupe ou rejoignez-en un avec un code d&apos;invitation</p>
                    <div className="flex gap-3 justify-center flex-wrap">
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="btn-primary py-2 px-5 text-sm inline-flex items-center gap-2"
                      >
                        <Icon name="PlusIcon" size={14} variant="outline" /> Créer un groupe
                      </button>
                      <button
                        onClick={() => setActiveTab('decouvrir')}
                        className="border border-border text-foreground py-2 px-5 text-sm rounded-lg hover:border-primary transition-colors inline-flex items-center gap-2"
                      >
                        <Icon name="MagnifyingGlassIcon" size={14} variant="outline" /> Découvrir des groupes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {myGroups.map(group => (
                      <GroupCard key={group.id} group={group} isMine={true} />
                    ))}
                    {/* Create new card */}
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="topo-card p-5 flex flex-col items-center justify-center gap-3 border-dashed hover:border-primary hover:text-primary transition-colors min-h-[200px] text-muted-foreground"
                    >
                      <div className="w-12 h-12 rounded-full border-2 border-dashed border-current flex items-center justify-center">
                        <Icon name="PlusIcon" size={20} variant="outline" />
                      </div>
                      <span className="text-sm font-600">Créer un nouveau groupe</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* DÉCOUVRIR */}
            {activeTab === 'decouvrir' && (
              <div>
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                  <div className="relative flex-1">
                    <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" variant="outline" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Rechercher par nom ou destination..."
                      className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {['Tous', ...THEMES].map(theme => (
                      <button
                        key={theme}
                        onClick={() => setSelectedTheme(theme)}
                        className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all ${selectedTheme === theme ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}
                      >
                        {theme !== 'Tous' && THEME_EMOJI[theme] ? `${THEME_EMOJI[theme]} ` : ''}{theme}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredPublic.length === 0 ? (
                  <div className="text-center py-16 bg-card rounded-2xl border border-border">
                    <Icon name="UserGroupIcon" size={48} className="text-muted-foreground mx-auto mb-4" variant="outline" />
                    <h3 className="font-display font-700 text-lg text-foreground mb-2">Aucun groupe trouvé</h3>
                    <p className="text-sm text-muted-foreground mb-4">Soyez le premier à créer un groupe pour cette destination !</p>
                    <button onClick={() => setShowCreateModal(true)} className="btn-primary py-2 px-4 text-sm inline-flex items-center gap-2">
                      <Icon name="PlusIcon" size={14} variant="outline" /> Créer un groupe
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredPublic.map(group => (
                      <GroupCard key={group.id} group={group} isMine={false} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-border w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-700 text-lg text-foreground">Créer un groupe de voyage</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 text-muted-foreground hover:text-foreground">
                <Icon name="XMarkIcon" size={18} variant="outline" />
              </button>
            </div>
            <GroupForm onSubmit={handleCreateGroup} submitLabel="Créer le groupe" />
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && editingGroup && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-border w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-700 text-lg text-foreground">Modifier le groupe</h3>
              <button onClick={() => { setShowEditModal(false); setEditingGroup(null); }} className="p-1 text-muted-foreground hover:text-foreground">
                <Icon name="XMarkIcon" size={18} variant="outline" />
              </button>
            </div>
            {editingGroup.invite_code && (
              <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-3">
                <Icon name="LinkIcon" size={14} className="text-primary flex-shrink-0" variant="outline" />
                <div>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Code d&apos;invitation</p>
                  <p className="font-mono font-700 text-primary text-sm tracking-widest">{editingGroup.invite_code}</p>
                </div>
              </div>
            )}
            <GroupForm onSubmit={handleEditGroup} submitLabel="Enregistrer les modifications" />
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

export default function GroupesPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <GroupesPage />
    </Suspense>
  );
}
