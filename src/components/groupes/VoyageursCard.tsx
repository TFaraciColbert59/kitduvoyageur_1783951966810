import React, { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { useToast } from '@/contexts/ToastContext';

interface Traveler {
  id: string;
  name: string;
  role: string;
  status?: string;
  progress: number;
  user_id?: string;
}

interface VoyageursCardProps {
  travelers: Traveler[];
  groupId?: string;
  onRefresh?: () => void;
  user?: any;
  members?: any[];
  group?: any;
  isOrganizer?: boolean;
}

export default function VoyageursCard({ travelers, groupId, onRefresh, user, members, group, isOrganizer }: VoyageursCardProps) {
  const supabase = createClient();
  const { toast } = useToast();
  const [showManageModal, setShowManageModal] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  // Member management (organizer)
  const [pendingMembers, setPendingMembers] = useState<any[]>([]);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<any[]>([]);
  const [memberSearchBusy, setMemberSearchBusy] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  const loadPendingMembers = async () => {
    if (!groupId) return;
    const { data } = await supabase
      .from('group_members')
      .select('id, user_id, status, invited_by, profile:user_profiles!group_members_user_id_fkey(full_name, avatar_url)')
      .eq('group_id', groupId)
      .eq('status', 'pending');
    setPendingMembers((data as any[]) ?? []);
  };

  const openManage = () => {
    setShowManageModal(true);
    setMemberQuery('');
    setMemberResults([]);
    if (isOrganizer) loadPendingMembers();
  };

  const searchMembers = async (q: string) => {
    setMemberQuery(q);
    if (!q.trim()) { setMemberResults([]); return; }
    if (!isOrganizer || !user) return;
    setMemberSearchBusy(true);
    const { data } = await supabase
      .from('user_profiles')
      .select('id, full_name, avatar_url')
      .or(`full_name.ilike.${q.trim().replace(/'/g, "''")}`)
      .limit(8);
    const currentIds = new Set((members || []).map((m: any) => m.user_id));
    setMemberResults((data ?? []).filter((p: any) => !currentIds.has(p.id)));
    setMemberSearchBusy(false);
  };

  const addMember = async (profile: any) => {
    if (!groupId || !user) return;
    setAddingId(profile.id);
    const { error } = await supabase.from('group_members').insert({
      group_id: groupId,
      user_id: profile.id,
      role: 'member',
      status: 'pending',
      invited_by: user.id,
    });
    if (error) { toast("Erreur lors de l'invitation : " + error.message, 'error'); }
    else {
      toast(`${profile.full_name || 'Ce membre'} a été invité`, 'success');
      setMemberQuery('');
      setMemberResults([]);
      await loadPendingMembers();
    }
    setAddingId(null);
  };

  const acceptPending = async (id: string, userId: string) => {
    setLoadingId(id);
    await supabase.from('group_members').update({ status: 'active', invited_by: null }).eq('id', id);
    setLoadingId(null);
    toast('Membre ajouté au groupe', 'success');
    await loadPendingMembers();
    if (onRefresh) onRefresh();
  };

  const removePending = async (id: string) => {
    if (!confirm('Retirer cette invitation ?')) return;
    setLoadingId(id);
    await supabase.from('group_members').delete().eq('id', id);
    setLoadingId(null);
    toast('Invitation retirée', 'success');
    await loadPendingMembers();
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!groupId || !isOrganizer) return;
    if (!confirm('Êtes-vous sûr de vouloir retirer ce membre du groupe ?')) return;
    
    setLoadingId(memberId);
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('id', memberId);
      
    if (!error && onRefresh) onRefresh();
    setLoadingId(null);
  };

  const handleChangeRole = async (memberId: string, currentRole: string) => {
    if (!groupId || !isOrganizer) return;
    const newRole = currentRole === 'organizer' ? 'member' : 'organizer';
    
    setLoadingId(memberId);
    const { error } = await supabase
      .from('group_members')
      .update({ role: newRole })
      .eq('id', memberId);
      
    if (!error && onRefresh) onRefresh();
    setLoadingId(null);
  };

  const handleLeaveGroup = async () => {
    if (!groupId || !user) return;
    const myMembership = members?.find((m: any) => m.user_id === user.id);
    if (!myMembership) return;
    if (!confirm('Voulez-vous quitter ce groupe ? Vous pourrez rejoindre un autre groupe sans aucune pénalité.')) return;

    setLoadingId(myMembership.id);
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('id', myMembership.id)
      .eq('user_id', user.id);

    if (!error) {
      toast('Vous avez quitté le groupe.', 'info');
      if (onRefresh) onRefresh();
    }
    setLoadingId(null);
  };

  const handleJoinByCode = async () => {
    if (!user) { toast('Connectez-vous pour rejoindre', 'error'); return; }
    if (!joinCode.trim()) return;
    
    setJoining(true);
    try {
      const { data: targetGroup } = await supabase
        .from('travel_groups')
        .select('*')
        .eq('invite_code', joinCode.trim().toUpperCase())
        .maybeSingle();
        
      if (!targetGroup) {
        toast('Code invalide', 'error');
        setJoining(false);
        return;
      }
      
      const { error } = await supabase.from('group_members').insert({
        group_id: targetGroup.id,
        user_id: user.id,
        role: 'member',
        status: 'active'
      });
      
      if (error && error.code === '42501') {
        toast('Ce groupe est privé — une invitation de l’organisateur est requise.', 'error');
        setJoining(false);
        return;
      }
      if (error && error.code !== '23505') throw error;
      
      toast(`Vous avez rejoint "${targetGroup.name}" !`, 'success');
      setJoinCode('');
      if (targetGroup.id === groupId && onRefresh) onRefresh();
    } catch (err: any) {
      toast(err.message || 'Erreur', 'error');
    }
    setJoining(false);
  };

  return (
    <div className="glass p-3.5 transition-all duration-300 space-y-2.5">
      <div className="flex justify-between items-center">
        <h2 className="font-display font-bold text-xs text-[#17402C]">
          Voyageurs ({travelers.length})
        </h2>
        {isOrganizer && (
          <button 
            onClick={openManage}
            className="glass-capsule-btn py-0.5 px-2 text-[10px] font-bold"
          >
            <span className="relative z-10">Gérer →</span>
          </button>
        )}
      </div>
      
      <div className="space-y-1.5">
        {travelers.slice(0, 3).map(t => (
          <div key={t.id} className="flex items-center gap-2 glass-sub-card p-2 rounded-xl">
            <Link href={t.user_id ? `/profil/${t.user_id}` : '#'} className="relative shrink-0">
              <div className="w-6 h-6 rounded-full bg-[#17402C]/10 flex items-center justify-center text-[#17402C] font-bold text-[10px]">
                {t.name.charAt(0)}
              </div>
            </Link>
            
            <div className="flex-1 min-w-0">
              <span className="font-sans font-bold text-xs text-[#17402C] truncate block leading-tight">
                {t.name}
              </span>
            </div>
            
            {t.status ? (
              <span className="glass-pill text-[9px] py-0.2 px-1.5 shrink-0">
                {t.status}
              </span>
            ) : (
              <span className="text-[9px] font-mono font-bold text-[#17402C] shrink-0">
                {t.progress}%
              </span>
            )}
          </div>
        ))}
        {travelers.length > 3 && (
          <button onClick={openManage} className="text-[10px] text-[#5C6B5E] font-medium text-center w-full block hover:underline pt-0.5">
            + {travelers.length - 3} autre{travelers.length - 3 > 1 ? 's' : ''} voyageur{travelers.length - 3 > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {group?.invite_code && (
        <div className="flex items-center justify-between p-2 glass-sub-card rounded-xl text-[10px] text-[#5C6B5E] border-t border-[#17402C]/10">
          <span>Code invitation :</span>
          <strong className="font-mono text-[#17402C] font-bold tracking-widest">{group.invite_code}</strong>
        </div>
      )}

      {/* Modal de gestion (Admin Only) */}
      {showManageModal && isOrganizer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-6 max-w-md w-full relative">
            <button 
              onClick={() => setShowManageModal(false)}
              className="glass-capsule-btn p-2 absolute top-6 right-6"
            >
              <Icon name="XMarkIcon" size={18} className="relative z-10" />
            </button>
            <h2 className="font-display font-bold text-xl text-[#17402C] mb-4">Gérer les <span className="font-serif italic font-normal text-[#17402C]">membres</span></h2>
            
            <div className="mb-4 p-3 glass-sub-card rounded-xl">
              <p className="text-xs font-bold text-[#17402C] mb-2">Code d'invitation secret :</p>
              <div className="flex gap-2">
                <input type="text" readOnly value={group?.invite_code || ''} className="glass-input flex-1 font-mono tracking-widest font-bold text-xs text-[#17402C] text-center min-h-[36px]" />
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(group?.invite_code || '');
                    toast('Code copié !', 'success');
                  }}
                  className="glass-capsule-btn primary px-4 text-xs font-bold"
                >
                  <span className="relative z-10">Copier</span>
                </button>
              </div>
            </div>

            <div className="space-y-2 mb-4 max-h-52 overflow-y-auto pr-1">
              {members?.map(m => {
                const name = m.user_profiles ? (m.user_profiles.full_name || m.user_profiles.first_name || 'Membre') : 'Utilisateur';
                const isMe = m.user_id === user?.id;
                
                return (
                <div key={m.id} className="flex items-center justify-between p-2.5 glass-sub-card rounded-xl">
                  <div>
                    {m.user_id ? (
                      <Link href={`/profil/${m.user_id}`} className="text-xs font-bold text-[#17402C] hover:underline">
                        {name} {isMe && '(Vous)'}
                      </Link>
                    ) : (
                      <p className="text-xs font-bold text-[#17402C]">{name} {isMe && '(Vous)'}</p>
                    )}
                    <p className="text-[10px] text-[#5C6B5E]">{m.role === 'organizer' ? 'Organisateur' : 'Membre'}</p>
                  </div>
                  {!isMe && (
                    <div className="flex gap-1.5">
                      <button 
                        onClick={() => handleChangeRole(m.id, m.role)}
                        disabled={loadingId === m.id}
                        className="glass-capsule-btn py-1 px-2 text-[10px] font-semibold disabled:opacity-50"
                      >
                        <span className="relative z-10">{m.role === 'organizer' ? 'Rétrograder' : 'Promouvoir'}</span>
                      </button>
                      <button 
                        onClick={() => handleRemoveMember(m.id)}
                        disabled={loadingId === m.id}
                        className="glass-capsule-btn py-1 px-2 text-[10px] font-semibold text-red-600 disabled:opacity-50"
                      >
                        <span className="relative z-10">{loadingId === m.id ? '...' : 'Retirer'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )})}
            </div>

            {/* Inviter un membre */}
            {isOrganizer && (
              <div className="mb-4">
                <p className="text-xs font-bold text-[#17402C] mb-2">Inviter un membre</p>
                <div className="relative">
                  <input
                    type="text"
                    value={memberQuery}
                    onChange={e => searchMembers(e.target.value)}
                    placeholder="Rechercher par nom..."
                    className="glass-input w-full text-xs min-h-[36px]"
                  />
                  {memberSearchBusy && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-[#17402C] border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
                {memberResults.length > 0 && (
                  <div className="mt-2 space-y-1 max-h-36 overflow-y-auto">
                    {memberResults.map(p => (
                      <div key={p.id} className="flex items-center justify-between glass-sub-card p-2 rounded-xl">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-[#17402C]/10 flex items-center justify-center text-[10px] font-bold text-[#17402C] shrink-0">
                            {p.full_name?.charAt(0) || '?'}
                          </div>
                          <span className="text-xs font-semibold text-[#17402C] truncate">{p.full_name}</span>
                        </div>
                        <button
                          onClick={() => addMember(p)}
                          disabled={addingId === p.id}
                          className="glass-capsule-btn primary py-1 px-2.5 text-[10px] font-bold disabled:opacity-50 shrink-0"
                        >
                          <span className="relative z-10">{addingId === p.id ? '...' : '+ Inviter'}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button 
              onClick={() => setShowManageModal(false)}
              className="w-full glass-capsule-btn primary py-2.5 text-xs font-bold"
            >
              <span className="relative z-10">Terminé</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
