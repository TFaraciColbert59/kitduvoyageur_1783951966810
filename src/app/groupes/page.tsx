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

const inputCls = "w-full bg-white border border-[#C8C3B0] rounded-xl px-3 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#17402C]/30 focus:border-[#17402C]/40 transition-colors";
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

  // Auto-join via invite link: /groupes?code=XXXX
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
      <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl overflow-hidden hover:shadow-md hover:border-[#17402C]/30 transition-all group">
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
              <div className="font-mono font-700 text-[#17402C] text-lg">{group.optimization_score}</div>
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
              <div className="w-5 h-5 rounded-full bg-[#17402C]/20 flex items-center justify-center text-[10px] font-700 text-[#17402C]">
                {group.owner.full_name?.[0] || '?'}
              </div>
              <span className="text-[10px] text-[#5C6B5E]">Organisé par <span className="font-600 text-[#1C2620]">{group.owner.full_name}</span></span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {showActions ? (
              <>
                <Link href={`/groupes/${group.id}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#17402C] hover:bg-[#17402C]/90 text-white rounded-xl text-xs font-700 transition-colors">
                  <Icon name="ArrowRightIcon" size={12} /> Ouvrir
                </Link>
                {myRole && (
                  <span className={`px-2.5 py-2 rounded-xl text-[10px] font-600 ${myRole === 'organizer' ? 'bg-amber-100 text-amber-700' : myRole === 'co_organizer' ? 'bg-blue-100 text-blue-700' : 'bg-[#E7E3D6] text-[#5C6B5E]'}`}>
                    {myRole === 'organizer' ? '👑' : myRole === 'co_organizer' ? '🛡️' : '👤'}
                  </span>
                )}
                {(isOwner || myRole === 'organizer') && (
                  <button onClick={() => openEditModal(group)} className="p-2 border border-[#C8C3B0] text-[#5C6B5E] rounded-xl hover:border-[#17402C]/40 hover:text-[#17402C] transition-colors">
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
              <Link href={`/groupes/${group.id}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#1C2620] hover:bg-[#1C2620]/80 text-white rounded-xl text-xs font-700 transition-colors">
                <Icon name="ArrowRightIcon" size={12} /> Déjà membre — Ouvrir
              </Link>
            ) : (
              <>
                <button
                  onClick={() => handleJoinGroup(group.id)}
                  disabled={joining === group.id || (group.member_count || 0) >= group.max_members}
                  className="flex-1 py-2 bg-[#17402C] hover:bg-[#17402C]/90 text-white rounded-xl text-xs font-700 transition-colors disabled:opacity-50"
                >
                  {joining === group.id ? 'Rejoindre...' : (group.member_count || 0) >= group.max_members ? 'Complet' : 'Rejoindre'}
                </button>
                <Link href={`/groupes/${group.id}`} className="p-2 border border-[#C8C3B0] text-[#5C6B5E] rounded-xl hover:border-[#1C2620]/30 hover:text-[#1C2620] transition-colors">
                  <Icon name="EyeIcon" size={12} />
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  /** Mobile group card component */
  const MobileGroupCard = ({ group, showActions = false }: { group: TravelGroup; showActions?: boolean }) => {
    const alreadyMember = isAlreadyMember(group.id);
    const isOwner = user?.id === group.owner_id;
    const myRole = group.my_role;
    return (
      <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(11,31,23,0.06)' }}>
        {/* Header */}
        <div style={{ background: '#0B1F17', padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                {THEME_EMOJI[group.theme] || '🎒'}
              </div>
              <div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: '14px', lineHeight: 1.3 }}>{group.name}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  <LkvIcon name="map-pin" size={10} color="rgba(255,255,255,0.5)" /> {group.destination}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontWeight: 700, color: '#fff', fontSize: '16px' }}>{group.optimization_score}</div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>score</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>{group.theme}</span>
            <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', fontWeight: 600, background: group.visibility === 'public' ? 'rgba(52,211,153,0.2)' : 'rgba(251,191,36,0.2)', color: group.visibility === 'public' ? '#34d399' : '#fbbf24' }}>
              {group.visibility === 'public' ? '🌍 Public' : group.visibility === 'private' ? '🔒 Privé' : '🔗 Invitation'}
            </span>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>Niv. {group.group_level}</span>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '12px' }}>
          {group.description && <p style={{ fontSize: '12px', color: '#6B7A72', marginBottom: '10px', lineHeight: 1.4 }}>{group.description}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '10px' }}>
            {[
              { label: 'membres', value: group.member_count || 0 },
              { label: 'budget', value: group.budget_target > 0 ? `${group.budget_target}€` : '—' },
              { label: 'max', value: group.max_members },
            ].map(stat => (
              <div key={stat.label} style={{ textAlign: 'center', padding: '8px', background: '#F4F1EA', borderRadius: '10px' }}>
                <div style={{ fontWeight: 700, color: '#0B1F17', fontSize: '14px' }}>{stat.value}</div>
                <div style={{ fontSize: '9px', color: '#6B7A72' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {group.departure_date && (
            <p style={{ fontSize: '10px', color: '#6B7A72', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <LkvIcon name="star" size={10} color="#6B7A72" />
              {new Date(group.departure_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              {group.return_date && ` → ${new Date(group.return_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`}
            </p>
          )}

          {group.owner && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid rgba(11,31,23,0.06)' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(23,64,44,0.15)', color: '#17402C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>
                {group.owner.full_name?.[0] || '?'}
              </div>
              <span style={{ fontSize: '10px', color: '#6B7A72' }}>
                Organisé par <span style={{ fontWeight: 600, color: '#0B1F17' }}>{group.owner.full_name}</span>
              </span>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {showActions ? (
              <>
                <Link href={`/groupes/${group.id}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', background: '#17402C', color: '#fff', borderRadius: '10px', fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}>
                  Ouvrir <LkvIcon name="arrow-right" size={12} color="#fff" />
                </Link>
                {isOwner && (
                  <button onClick={() => handleDeleteGroup(group.id)} style={{ padding: '10px', border: '1px solid rgba(11,31,23,0.08)', borderRadius: '10px', background: '#fff', color: '#6B7A72', cursor: 'pointer' }}>
                    <LkvIcon name="close" size={14} />
                  </button>
                )}
              </>
            ) : alreadyMember ? (
              <Link href={`/groupes/${group.id}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', background: '#0B1F17', color: '#fff', borderRadius: '10px', fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}>
                Déjà membre — Ouvrir
              </Link>
            ) : (
              <>
                <button onClick={() => handleJoinGroup(group.id)} disabled={joining === group.id || (group.member_count || 0) >= group.max_members} style={{ flex: 1, padding: '10px', background: '#17402C', color: '#fff', borderRadius: '10px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', opacity: (joining === group.id || (group.member_count || 0) >= group.max_members) ? 0.5 : 1 }}>
                  {joining === group.id ? 'Rejoindre...' : (group.member_count || 0) >= group.max_members ? 'Complet' : 'Rejoindre'}
                </button>
                <Link href={`/groupes/${group.id}`} style={{ padding: '10px', border: '1px solid rgba(11,31,23,0.08)', borderRadius: '10px', background: '#fff', color: '#6B7A72', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
                  <LkvIcon name="search" size={14} />
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
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-[#F5F2E8]">
          <Header />

      {/* Hero */}
      <section className="bg-[#1C2620] pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-[10px] font-mono text-[#17402C] tracking-[0.2em] uppercase mb-2">Groupes de voyage</p>
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
                className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#17402C]/60 w-36"
                onKeyDown={e => e.key === 'Enter' && handleJoinByCode()}
              />
              <button onClick={() => handleJoinByCode()} disabled={joiningByCode} className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm px-3 py-2 rounded-xl transition-colors">
                {joiningByCode ? '...' : 'Rejoindre'}
              </button>
              <Link href="/nouveau-groupe" className="flex items-center gap-2 bg-[#17402C] hover:bg-[#17402C]/90 text-white text-sm px-4 py-2 rounded-xl transition-colors font-600">
                <Icon name="PlusIcon" size={14} /> Créer un groupe
              </Link>
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
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">⚠️</p>
            <h2 className="font-display font-700 text-xl text-[#1C2620] mb-2">Erreur de chargement</h2>
            <p className="text-sm text-[#5C6B5E] mb-6">{error}</p>
            <button
              onClick={() => { setError(null); setLoading(true); loadAll().finally(() => setLoading(false)); }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#17402C] text-white rounded-xl font-700 hover:bg-[#17402C]/90 transition-colors cursor-pointer"
            >
              Réessayer
            </button>
          </div>
        ) : activeTab === 'mes-groupes' ? (
          <div>
            {user && pendingInvites.length > 0 && (
              <div className="mb-6 p-5 bg-[#17402C]/5 border border-[#17402C]/20 rounded-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="EnvelopeOpenIcon" size={16} className="text-[#17402C]" />
                  <h3 className="font-display font-700 text-[#1C2620]">{pendingInvites.length} invitation{pendingInvites.length > 1 ? 's' : ''} à rejoindre</h3>
                </div>
                <div className="space-y-2">
                  {pendingInvites.map(inv => (
                    <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-white rounded-xl border border-[#C8C3B0]">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-600 text-[#1C2620]">{inv.name}</p>
                        <p className="text-xs text-[#5C6B5E]">Vous avez été invité à rejoindre ce groupe.</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleInvite(inv.group_id, true)}
                          disabled={inviteBusy === inv.group_id}
                          className="px-4 py-2 bg-[#17402C] text-white rounded-xl text-xs font-700 enabled:hover:bg-[#17402C]/90 disabled:opacity-50 transition-colors"
                        >
                          {inviteBusy === inv.group_id ? '...' : 'Accepter'}
                        </button>
                        <button
                          onClick={() => handleInvite(inv.group_id, false)}
                          disabled={inviteBusy === inv.group_id}
                          className="px-4 py-2 border border-[#C8C3B0] text-[#5C6B5E] rounded-xl text-xs font-600 enabled:hover:text-red-500 enabled:hover:border-red-300 disabled:opacity-50 transition-colors"
                        >
                          Refuser
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!user ? (
              <div className="text-center py-16">
                <p className="text-5xl mb-4">🗺️</p>
                <h2 className="font-display font-700 text-xl text-[#1C2620] mb-2">Connectez-vous pour voir vos groupes</h2>
                <p className="text-sm text-[#5C6B5E] mb-6">Créez ou rejoignez des groupes de voyage collaboratifs</p>
                <Link href="/connexion" className="inline-flex items-center gap-2 px-6 py-3 bg-[#17402C] text-white rounded-xl font-700 hover:bg-[#17402C]/90 transition-colors">
                  <Icon name="ArrowRightOnRectangleIcon" size={14} /> Se connecter
                </Link>
              </div>
            ) : myGroups.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-5xl mb-4">🗺️</p>
                <h2 className="font-display font-700 text-xl text-[#1C2620] mb-2">Vous n&apos;avez pas encore de groupe</h2>
                <p className="text-sm text-[#5C6B5E] mb-6">Créez votre premier groupe ou rejoignez-en un avec un code d&apos;invitation</p>
                <div className="flex gap-3 justify-center flex-wrap">
                  <Link href="/nouveau-groupe" className="inline-flex items-center gap-2 px-6 py-3 bg-[#17402C] text-white rounded-xl font-700 hover:bg-[#17402C]/90 transition-colors">
                    <Icon name="PlusIcon" size={14} /> Créer un groupe
                  </Link>
                  <button onClick={() => setActiveTab('decouvrir')} className="inline-flex items-center gap-2 px-6 py-3 border border-[#C8C3B0] text-[#5C6B5E] rounded-xl font-600 hover:text-[#1C2620] transition-colors">
                    <Icon name="MagnifyingGlassIcon" size={14} /> Découvrir des groupes
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <p className="text-sm text-[#5C6B5E]">{myGroups.length} groupe{myGroups.length > 1 ? 's' : ''}</p>
                  <Link href="/nouveau-groupe" className="flex items-center gap-2 bg-[#17402C] hover:bg-[#17402C]/90 text-white text-sm px-4 py-2 rounded-xl transition-colors font-600">
                    <Icon name="PlusIcon" size={14} /> Nouveau groupe
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
                <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5C6B5E]" />
                <input
                  className="w-full bg-[#EDEAE0] border border-[#C8C3B0] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#17402C]/30"
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


      {/* Edit Group Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-700 text-lg text-[#1C2620]">Modifier le groupe</h3>
              <button onClick={() => { setShowEditModal(false); setEditingGroup(null); }} className="p-2 rounded-xl hover:bg-[#C8C3B0]/40 transition-colors"><Icon name="XMarkIcon" size={18} /></button>
            </div>
            {editingGroup?.invite_code && (
              <div className="mb-4 p-3 bg-[#17402C]/5 border border-[#17402C]/20 rounded-xl flex items-center gap-3">
                <Icon name="LinkIcon" size={14} className="text-[#17402C] flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-wider">Code d&apos;invitation</p>
                  <p className="font-mono font-700 text-[#17402C] text-sm tracking-widest">{editingGroup.invite_code}</p>
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
              <button type="submit" disabled={creating} className="w-full py-3 bg-[#17402C] hover:bg-[#17402C]/90 text-white rounded-xl font-700 transition-colors disabled:opacity-50">
                {creating ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </form>
          </div>
        </div>
      )}

      <Footer />
        </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell background="#F5F2E8">
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
                handleJoinByCode();
              }
            }}
          />
        </MobilePageShell>
      </div>
    </>
  );
}

export default function GroupesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F2E8] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#17402C] border-t-transparent rounded-full animate-spin" /></div>}>
      <GroupesPageInner />
    </Suspense>
  );
}
