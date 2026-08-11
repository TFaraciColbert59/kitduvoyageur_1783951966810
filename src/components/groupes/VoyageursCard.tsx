import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { useToast } from '@/contexts/ToastContext';

interface Traveler {
  id: string;
  name: string;
  role: string;
  status?: string;
  progress: number;
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

  const handleRemoveMember = async (memberId: string) => {
    if (!groupId || !isOrganizer) return;
    if (!confirm('Êtes-vous sûr de vouloir retirer ce membre du groupe ?')) return;
    
    setLoadingId(memberId);
    const { error } = await supabase
      .from('groupe_membres')
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
      .from('groupe_membres')
      .update({ role: newRole })
      .eq('id', memberId);
      
    if (!error && onRefresh) onRefresh();
    setLoadingId(null);
  };

  const handleJoinByCode = async () => {
    if (!user) { toast('Connectez-vous pour rejoindre', 'error'); return; }
    if (!joinCode.trim()) return;
    
    setJoining(true);
    try {
      const { data: targetGroup } = await supabase
        .from('groupes')
        .select('*')
        .eq('invite_code', joinCode.trim().toUpperCase())
        .maybeSingle();
        
      if (!targetGroup) {
        toast('Code invalide', 'error');
        setJoining(false);
        return;
      }
      
      const { error } = await supabase.from('groupe_membres').insert({
        group_id: targetGroup.id,
        user_id: user.id,
        role: 'member',
        status: 'active'
      });
      
      if (error && error.code !== '23505') throw error;
      
      toast(`Vous avez rejoint "${targetGroup.name}" !`, 'success');
      setJoinCode('');
      // If we joined the CURRENT group, refresh
      if (targetGroup.id === groupId && onRefresh) onRefresh();
      // Or maybe redirect if different
    } catch (err: any) {
      toast(err.message || 'Erreur', 'error');
    }
    setJoining(false);
  };

  return (
    <div className="bg-white rounded-[2rem] p-6 border border-[#1C2620]/10 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <h2 className="font-display text-xl text-[#1C2620]">Voyageurs <span className="font-serif italic font-bold">du groupe</span></h2>
        {isOrganizer && (
          <button 
            onClick={() => setShowManageModal(true)}
            className="text-xs font-medium text-[#17402C] hover:underline font-sans"
          >
            Gérer →
          </button>
        )}
      </div>
      
      <p className="text-sm text-[#1C2620]/80 font-sans mb-6">
        {travelers.length} personnes, statut de préparation en un coup d'œil
      </p>
      
      <div className="space-y-4 mb-6">
        {travelers.map(t => (
          <div key={t.id} className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-[#E7E3D6] flex items-center justify-center text-[#1C2620] font-bold text-sm">
                {t.name.charAt(0)}
              </div>
              {t.progress < 100 && t.progress > 0 && (
                <svg className="absolute -inset-1 w-12 h-12 -rotate-90">
                  <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2" fill="none" className="text-[#1C2620]/10" />
                  <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="138" strokeDashoffset={138 - (138 * t.progress) / 100} className="text-[#17402C]" />
                </svg>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-sans font-semibold text-sm text-[#1C2620] truncate">{t.name}</h3>
              <p className="text-xs text-[#1C2620]/50 font-sans truncate">{t.role}</p>
            </div>
            
            {t.status ? (
              <span className={`text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-sm whitespace-nowrap
                ${t.status === 'Prêt' ? 'bg-[#33463C]/10 text-[#33463C]' : 'bg-[#1C2620]/5 text-[#1C2620]/50'}`}>
                {t.status}
              </span>
            ) : (
              <span className="text-[10px] font-mono font-bold text-[#17402C] whitespace-nowrap">
                {t.progress}%
              </span>
            )}
          </div>
        ))}
      </div>
      
      <div className="flex flex-col gap-2">
        {group?.invite_code && (
          <div className="flex items-center gap-2 p-2 bg-[#E7E3D6]/20 rounded-xl border border-[#1C2620]/5 mb-2 text-center text-xs text-[#1C2620]/60">
            <span>Code groupe :</span>
            <strong className="font-mono text-[#1C2620] text-sm tracking-widest">{group.invite_code}</strong>
          </div>
        )}
        
        {!members?.find(m => m.user_id === user?.id) && (
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Code d'invitation"
              className="flex-1 bg-white border border-[#1C2620]/10 rounded-xl px-3 py-2 text-xs text-[#1C2620] focus:outline-none focus:border-[#17402C]/60"
              onKeyDown={e => e.key === 'Enter' && handleJoinByCode()}
            />
            <button 
              onClick={handleJoinByCode} 
              disabled={joining} 
              className="bg-[#1C2620] text-white text-xs px-3 py-2 rounded-xl transition-colors font-semibold"
            >
              {joining ? '...' : 'Rejoindre'}
            </button>
          </div>
        )}

        {isOrganizer && (
          <button 
            onClick={() => setShowManageModal(true)}
            className="w-full py-3 bg-[#E7E3D6]/30 border border-[#1C2620]/10 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold text-[#1C2620] hover:bg-[#E7E3D6]/50 transition-colors"
          >
            <Icon name="UserPlusIcon" size={16} />
            + Inviter un ami
          </button>
        )}
      </div>

      {/* Modal de gestion (Admin Only) */}
      {showManageModal && isOrganizer && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl relative">
            <button 
              onClick={() => setShowManageModal(false)}
              className="absolute top-6 right-6 text-[#1C2620]/50 hover:text-[#1C2620]"
            >
              <Icon name="XMarkIcon" size={24} />
            </button>
            <h2 className="font-display text-2xl text-[#1C2620] mb-4">Gérer les <span className="font-serif italic font-bold">membres</span></h2>
            
            <div className="mb-6 p-4 bg-[#E7E3D6]/30 rounded-xl border border-[#1C2620]/10">
              <p className="text-xs font-semibold text-[#1C2620] mb-2">Code d'invitation secret :</p>
              <div className="flex gap-2">
                <input type="text" readOnly value={group?.invite_code || ''} className="flex-1 bg-white border border-[#1C2620]/10 font-mono tracking-widest font-bold rounded-lg py-2 px-3 text-sm text-[#1C2620] text-center" />
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(group?.invite_code || '');
                    toast('Code copié !', 'success');
                  }}
                  className="px-4 bg-[#33463C] text-white rounded-lg text-xs font-semibold"
                >
                  Copier
                </button>
              </div>
            </div>

            <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {members?.map(m => {
                const name = m.user_profiles ? (m.user_profiles.full_name || m.user_profiles.first_name || 'Membre') : 'Utilisateur';
                const isMe = m.user_id === user?.id;
                
                return (
                <div key={m.id} className="flex items-center justify-between p-3 border border-[#1C2620]/5 rounded-xl">
                  <div>
                    <p className="text-sm font-semibold text-[#1C2620]">{name} {isMe && '(Vous)'}</p>
                    <p className="text-xs text-[#1C2620]/50">{m.role === 'organizer' ? 'Organisateur' : 'Membre'}</p>
                  </div>
                  {!isMe && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleChangeRole(m.id, m.role)}
                        disabled={loadingId === m.id}
                        className="text-xs text-[#1C2620]/50 hover:text-[#1C2620] font-medium hover:underline disabled:opacity-50"
                      >
                        {m.role === 'organizer' ? 'Rétrograder' : 'Promouvoir'}
                      </button>
                      <button 
                        onClick={() => handleRemoveMember(m.id)}
                        disabled={loadingId === m.id}
                        className="text-xs text-red-600 font-medium hover:underline disabled:opacity-50"
                      >
                        {loadingId === m.id ? '...' : 'Retirer'}
                      </button>
                    </div>
                  )}
                </div>
              )})}
            </div>

            <button 
              onClick={() => setShowManageModal(false)}
              className="w-full py-3 bg-[#1C2620] text-white rounded-xl text-sm font-semibold"
            >
              Terminé
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
