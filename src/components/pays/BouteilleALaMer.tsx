"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import ReportBlockModal, { ReportTarget } from '@/components/ui/ReportBlockModal';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { GlassSheet } from '@/components/ui/GlassSheet';

interface Props {
  countryIso: string;
  countryName: string;
}

export default function BouteilleALaMer({ countryIso, countryName }: Props) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const supabase = createClient();
  
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Create form state
  const [formData, setFormData] = useState({
    name: `Aventure en ${countryName}`,
    description: '',
    departure_date: '',
    return_date: '',
    max_members: 6,
    min_trust_score: 50,
    mixite: 'all',
    isAdult: false,
  });
  const [creating, setCreating] = useState(false);

  // Request & Creator management states
  const [joinLoadingId, setJoinLoadingId] = useState<string | null>(null);
  const [cancelLoadingId, setCancelLoadingId] = useState<string | null>(null);
  const [selectedGroupForManagement, setSelectedGroupForManagement] = useState<any | null>(null);
  const [pendingApplicants, setPendingApplicants] = useState<any[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [processingApplicantId, setProcessingApplicantId] = useState<string | null>(null);

  // Join confirmation modal
  const [joinModalGroup, setJoinModalGroup] = useState<any | null>(null);
  const [joinIsAdult, setJoinIsAdult] = useState(false);
  const [joinAcknowledgeExpenses, setJoinAcknowledgeExpenses] = useState(false);

  // Report/Block modal
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  // Calibrated thresholds from database audit
  const CREATION_THRESHOLD = 65;
  const ABSOLUTE_MIN_TRUST = 50;
  const MAX_ACTIVE_OWNED_GROUPS = 3;
  
  const userTrustScore = profile?.trust_score ?? 50;
  const canCreate = userTrustScore >= CREATION_THRESHOLD;
  const isSuspended = (profile as any)?.is_suspended_groups || !!(profile as any)?.suspended_from_groups_at;

  const fetchGroups = useCallback(async () => {
    if (!countryIso) return;
    const iso = (countryIso || '').toLowerCase();
    
    // Fetch public groups with members, owner and expenses
    const { data: groupsData, error } = await supabase
      .from('travel_groups')
      .select(`
        *,
        owner:user_profiles!travel_groups_owner_id_fkey(id, full_name, avatar_url, trust_score, created_at),
        members:group_members(id, user_id, status, role),
        expenses:group_expenses(amount)
      `)
      .eq('visibility', 'public')
      .ilike('country_iso', iso)
      .order('created_at', { ascending: false })
      .limit(2);
      
    if (!error && groupsData) {
      // Check user blocks if logged in
      let blockedUserIds = new Set<string>();
      if (user) {
        const { data: blocks } = await supabase
          .from('user_blocks')
          .select('blocker_id, blocked_id')
          .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);
        
        blocks?.forEach(b => {
          if (b.blocker_id === user.id) blockedUserIds.add(b.blocked_id);
          if (b.blocked_id === user.id) blockedUserIds.add(b.blocker_id);
        });
      }

      const processedGroups = groupsData
        .filter(g => !blockedUserIds.has(g.owner_id))
        .map(g => {
          // Places calculate ONLY active members
          const activeMembers = g.members?.filter((m: any) => m.status === 'active') || [];
          const pendingMembers = g.members?.filter((m: any) => m.status === 'pending') || [];
          const userMembership = user ? g.members?.find((m: any) => m.user_id === user.id) : null;
          const totalExpenses = (g.expenses || []).reduce((acc: number, cur: any) => acc + (Number(cur.amount) || 0), 0);

          return {
            ...g,
            activeMembersCount: activeMembers.length,
            pendingCount: pendingMembers.length,
            spotsLeft: Math.max(0, (g.max_members || 12) - activeMembers.length),
            userMembershipStatus: userMembership?.status || null,
            userMembershipId: userMembership?.id || null,
            totalExpenses,
          };
        });

      setGroups(processedGroups);
    }
    setLoading(false);
  }, [countryIso, user, supabase]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Load applicants when creator opens management modal
  const loadApplicantsForGroup = async (group: any) => {
    setSelectedGroupForManagement(group);
    setLoadingApplicants(true);
    try {
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          id,
          user_id,
          status,
          joined_at,
          profile:user_profiles!group_members_user_id_fkey(
            id,
            full_name,
            avatar_url,
            trust_score,
            created_at,
            bio
          )
        `)
        .eq('group_id', group.id)
        .eq('status', 'pending');

      if (!error && data) {
        setPendingApplicants(data as any[]);
      }
    } catch (err) {
      console.error("Error loading pending applicants:", err);
    } finally {
      setLoadingApplicants(false);
    }
  };

  // 1. Create Group (Bottle)
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSuspended) return;
    if (!canCreate) {
      alert(`Trust Score insuffisant (${userTrustScore}/${CREATION_THRESHOLD} requis pour lancer une bouteille).`);
      return;
    }
    if (!formData.isAdult) {
      alert("Vous devez confirmer avoir au moins 18 ans pour créer une expédition.");
      return;
    }

    setCreating(true);
    try {
      // 1. Rate Limiting Check (max active owned groups)
      const { count: ownedCount } = await supabase
        .from('travel_groups')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', user.id)
        .eq('visibility', 'public');

      if ((ownedCount || 0) >= MAX_ACTIVE_OWNED_GROUPS) {
        alert(`Limite atteinte : vous avez déjà ${ownedCount} expéditions publiques actives (maximum ${MAX_ACTIVE_OWNED_GROUPS}).`);
        setCreating(false);
        return;
      }

      // 2. Persist age confirmation on user_profiles if needed
      await supabase
        .from('user_profiles')
        .update({ age_confirmed_at: new Date().toISOString() })
        .eq('id', user.id);

      // 3. Create group with enforced floor on min_trust_score
      const enforcedMinScore = Math.max(ABSOLUTE_MIN_TRUST, formData.min_trust_score);
      const { data: newGroup, error: groupErr } = await supabase
        .from('travel_groups')
        .insert({
          name: formData.name,
          description: formData.description || null,
          owner_id: user.id,
          departure_date: formData.departure_date || null,
          return_date: formData.return_date || null,
          max_members: formData.max_members,
          theme: '🌍',
          destination: countryName,
          country_iso: (countryIso || '').toLowerCase(),
          visibility: 'public',
          min_trust_score: enforcedMinScore,
          mixite: formData.mixite || 'all',
        })
        .select()
        .single();

      if (groupErr) throw groupErr;

      // 4. Creator is active organizer
      await supabase.from('group_members').insert({
        group_id: newGroup.id,
        user_id: user.id,
        role: 'organizer',
        status: 'active',
      });

      setShowCreateForm(false);
      setFormData({
        name: `Aventure en ${countryName}`,
        description: '',
        departure_date: '',
        return_date: '',
        max_members: 6,
        min_trust_score: 50,
        mixite: 'all',
        isAdult: false,
      });
      await fetchGroups();
    } catch (error) {
      console.error("Error creating group:", error);
      alert("Une erreur est survenue lors de la création.");
    } finally {
      setCreating(false);
    }
  };

  // 2. Submit Join Request (Pending)
  const handleConfirmJoin = async () => {
    if (!user || !joinModalGroup) return;
    if (isSuspended) {
      alert("Votre compte est actuellement restreint suite à un signalement.");
      return;
    }
    if (!joinIsAdult) {
      alert("Vous devez certifier être majeur(e) (18 ans ou plus).");
      return;
    }
    if (!joinAcknowledgeExpenses) {
      alert("Veuillez accepter les conditions financières avant d'envoyer votre demande.");
      return;
    }

    const group = joinModalGroup;
    setJoinLoadingId(group.id);
    try {
      // 1. Persist age confirmation on user_profiles if needed
      await supabase
        .from('user_profiles')
        .update({ age_confirmed_at: new Date().toISOString() })
        .eq('id', user.id);

      // 2. Insert with status pending
      const { error } = await supabase.from('group_members').insert({
        group_id: group.id,
        user_id: user.id,
        role: 'member',
        status: 'pending',
      });
      
      if (error) {
        if (error.code === '23505') {
          alert("Vous avez déjà une demande en cours sur ce groupe.");
        } else {
          throw error;
        }
      } else {
        // Send notification to group creator
        await supabase.from('notifications').insert({
          user_id: group.owner_id,
          actor_id: user.id,
          related_type: 'travel_group',
          related_id: group.id,
          type: 'group_join_request',
          title: 'Nouvelle demande Bouteille à la mer',
          message: `${profile?.full_name || 'Un voyageur'} souhaite rejoindre votre groupe "${group.name}".`,
          link: `/groupes/${group.id}`,
        });

        alert("Demande envoyée ! Le créateur examinera votre profil et vous recevrez une notification.");
        setJoinModalGroup(null);
        setJoinIsAdult(false);
        setJoinAcknowledgeExpenses(false);
        await fetchGroups();
      }
    } catch (err) {
      console.error(err);
      alert("Une erreur est survenue.");
    } finally {
      setJoinLoadingId(null);
    }
  };

  // 3. Cancel Pending Request (Voluntary departure with 0 penalty)
  const handleCancelRequest = async (group: any) => {
    if (!user || !group.userMembershipId) return;
    if (!confirm("Voulez-vous annuler votre demande de participation ?")) return;

    setCancelLoadingId(group.id);
    try {
      await supabase
        .from('group_members')
        .delete()
        .eq('id', group.userMembershipId)
        .eq('user_id', user.id);

      await fetchGroups();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'annulation.");
    } finally {
      setCancelLoadingId(null);
    }
  };

  // 4. Creator: Accept Applicant
  const handleAcceptApplicant = async (applicant: any) => {
    if (!user || !selectedGroupForManagement) return;
    setProcessingApplicantId(applicant.id);

    try {
      // Re-verify spots left server side
      const { count: activeCount } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', selectedGroupForManagement.id)
        .eq('status', 'active');

      if ((activeCount || 0) >= selectedGroupForManagement.max_members) {
        alert("Action impossible : le groupe a déjà atteint sa capacité maximale de participants actifs.");
        return;
      }

      // Update status to active
      const { error } = await supabase
        .from('group_members')
        .update({ status: 'active' })
        .eq('id', applicant.id);

      if (error) throw error;

      // Notify accepted user
      await supabase.from('notifications').insert({
        user_id: applicant.user_id,
        actor_id: user.id,
        related_type: 'travel_group',
        related_id: selectedGroupForManagement.id,
        type: 'group_join_accepted',
        title: 'Demande acceptée ! 🎉',
        message: `Félicitations ! Vous faites désormais partie de l'équipage pour "${selectedGroupForManagement.name}".`,
        link: `/groupes/${selectedGroupForManagement.id}`,
      });

      // Refresh list
      setPendingApplicants(prev => prev.filter(p => p.id !== applicant.id));
      await fetchGroups();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'acceptation du membre.");
    } finally {
      setProcessingApplicantId(null);
    }
  };

  // 5. Creator: Reject Applicant
  const handleRejectApplicant = async (applicant: any) => {
    if (!user || !selectedGroupForManagement) return;
    if (!confirm(`Refuser la demande de ${applicant.profile?.full_name || 'ce membre'} ?`)) return;

    setProcessingApplicantId(applicant.id);
    try {
      // Set to rejected
      await supabase
        .from('group_members')
        .update({ status: 'rejected' })
        .eq('id', applicant.id);

      // Notify user
      await supabase.from('notifications').insert({
        user_id: applicant.user_id,
        actor_id: user.id,
        related_type: 'travel_group',
        related_id: selectedGroupForManagement.id,
        type: 'group_join_rejected',
        title: 'Demande non retenue',
        message: `Votre demande pour rejoindre "${selectedGroupForManagement.name}" n'a pas été retenue.`,
      });

      setPendingApplicants(prev => prev.filter(p => p.id !== applicant.id));
      await fetchGroups();
    } catch (err) {
      console.error(err);
      alert("Erreur lors du refus.");
    } finally {
      setProcessingApplicantId(null);
    }
  };

  // Format account age helper
  const getAccountAgeLabel = (createdAtStr?: string) => {
    if (!createdAtStr) return 'Nouveau membre';
    const created = new Date(createdAtStr);
    const now = new Date();
    const diffMonths = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (diffMonths <= 0) {
      const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 1 ? 'Créé récemment' : `Membre depuis ${diffDays} j`;
    }
    if (diffMonths < 12) return `Membre depuis ${diffMonths} mois`;
    const years = Math.floor(diffMonths / 12);
    return `Membre depuis ${years} an${years > 1 ? 's' : ''}`;
  };

  if (loading) {
    return (
      <div className="py-6 flex justify-center">
        <div className="w-7 h-7 border-3 border-[#5B7F55]/20 border-t-[#5B7F55] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <GlassCard tone="sage" className="mt-6 p-6 md:p-8 relative">
      {/* Background Decorative */}
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#A6C1A0] rounded-full mix-blend-screen filter blur-[80px] opacity-40 -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-[#C89A3B] rounded-full mix-blend-screen filter blur-[80px] opacity-20 translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
      
      <div className="relative z-10">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-3">
            <span className="glass-pill text-[11px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C89A3B] animate-pulse"></span>
              Bouteille à la mer
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-[#17402C] leading-snug mb-2">
            Partez en {countryName} <em className="font-serif italic text-[#486944] font-normal">avec d'autres voyageurs</em>.
          </h2>
          <p className="text-[#365233] text-sm mb-4 max-w-xl leading-relaxed">
            Rejoignez une expédition ouverte (sur validation du créateur) ou lancez un appel pour trouver des coéquipiers et partager les frais.
          </p>
          
          {isSuspended && (
            <div className="mb-4 p-3 bg-[rgba(168,68,58,0.08)] border border-[rgba(168,68,58,0.30)] rounded-xl text-xs text-[#8A241B]">
              ⚠️ Votre compte est temporairement limité sur la fonctionnalité Bouteille à la mer suite à un signalement. Pour contester ou obtenir de l'aide, contactez notre équipe sur <a href="mailto:contact@lekitduvoyageur.fr" className="underline font-bold text-[#17402C]">contact@lekitduvoyageur.fr</a>.
            </div>
          )}

          {!showCreateForm && (
            <div className="flex flex-wrap items-center gap-3">
              <button 
                onClick={() => {
                  if (!user) router.push('/connexion');
                  else if (isSuspended) alert("Votre compte est actuellement restreint suite à un signalement.");
                  else if (!canCreate) alert(`Votre Trust Score (${userTrustScore}/100) est insuffisant. Le seuil requis est de ${CREATION_THRESHOLD} pour lancer une bouteille.`);
                  else setShowCreateForm(true);
                }}
                className={`px-5 py-2.5 rounded-full font-bold text-xs transition-all flex items-center gap-2 ${
                  !user || (canCreate && !isSuspended)
                    ? 'glass-capsule-btn' 
                    : 'glass-capsule-btn opacity-40 cursor-not-allowed'
                }`}
                title={user && !canCreate ? `Trust score requis : ${CREATION_THRESHOLD}` : ''}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><line x1="12" y1="5" x2="12" y2="15"></line><line x1="8" y1="9" x2="12" y2="5"></line><line x1="16" y1="9" x2="12" y2="5"></line></svg>
                Lancer bouteille à la mer
              </button>
              
              {user && !canCreate && !isSuspended && (
                <span className="text-xs text-[#5B7F55]">
                  Trust score requis : {CREATION_THRESHOLD} (Vous avez {userTrustScore}). <Link href="/compte" className="underline hover:text-[#17402C] transition-colors">Comment l'augmenter ?</Link>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <form onSubmit={handleCreateGroup} className="mt-6 glass-sub-card p-5 md:p-6 max-w-xl animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display font-bold text-base text-[#17402C]">Lancer bouteille à la mer</h3>
              <button type="button" onClick={() => setShowCreateForm(false)} className="w-7 h-7 flex items-center justify-center rounded-full glass-pill text-[#17402C] text-xs hover:bg-white/20">✕</button>
            </div>
            
            <div className="space-y-3.5">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#5A7064] mb-1">Nom de l'expédition</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="glass-input w-full text-sm" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#5A7064] mb-1">Départ prévu</label>
                  <input type="date" value={formData.departure_date} onChange={e => setFormData({...formData, departure_date: e.target.value})} className="glass-input w-full text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#5A7064] mb-1">Retour prévu</label>
                  <input type="date" value={formData.return_date} onChange={e => setFormData({...formData, return_date: e.target.value})} className="glass-input w-full text-sm" />
                </div>
              </div>
              
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#5A7064] mb-1">Message de la bouteille</label>
                <textarea required rows={2} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Quel type de compagnons cherchez-vous ?" className="glass-input w-full text-sm resize-none"></textarea>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#5A7064] mb-1">Places max</label>
                  <input type="number" min={2} max={12} required value={formData.max_members} onChange={e => setFormData({...formData, max_members: parseInt(e.target.value)})} className="glass-input w-full text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#5A7064] mb-1">Trust Score (Min {ABSOLUTE_MIN_TRUST})</label>
                  <input type="number" min={ABSOLUTE_MIN_TRUST} max={100} required value={formData.min_trust_score} onChange={e => setFormData({...formData, min_trust_score: parseInt(e.target.value)})} className="glass-input w-full text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#5A7064] mb-1">Mixité</label>
                  <select
                    value={formData.mixite}
                    onChange={e => setFormData({ ...formData, mixite: e.target.value })}
                    className="glass-input w-full text-xs"
                  >
                    <option value="all" className="bg-[#FBFAF6]">Tous (Mixte)</option>
                    <option value="women_only" className="bg-[#FBFAF6]">Entre femmes 👭</option>
                    <option value="men_only" className="bg-[#FBFAF6]">Entre hommes 👬</option>
                  </select>
                </div>
              </div>

              {/* 18+ Safety confirmation */}
              <div className="pt-2 border-t border-[#E4DED3] space-y-2">
                <label className="flex items-start gap-2 text-xs text-[#365233] cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={formData.isAdult}
                    onChange={e => setFormData({ ...formData, isAdult: e.target.checked })}
                    className="mt-0.5 rounded text-[#5B7F55] accent-[#5B7F55]"
                  />
                  <span>
                    Je certifie sur l'honneur avoir <strong className="text-[#17402C]">18 ans ou plus</strong> et m'engage à respecter la charte de sécurité de la communauté.
                  </span>
                </label>
                <p className="text-[10px] text-[#5A7064] italic leading-tight">
                  Le Kit du Voyageur facilite la mise en relation. L'organisation, les réservations et le déroulement du séjour restent sous la responsabilité exclusive des co-voyageurs.
                </p>
              </div>
              
              <div className="pt-2">
                <button type="submit" disabled={creating} className="glass-capsule-btn w-full font-bold text-xs disabled:opacity-50">
                  {creating ? 'Lancement...' : 'Jeter à la mer'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Existing Bottles List */}
        {!showCreateForm && groups.length > 0 && (
          <div className="mt-6 pt-6 border-t border-[#E4DED3]">
            <h3 className="text-base font-bold mb-4 flex items-center gap-2 text-[#17402C]">
              <span className="w-6 h-6 rounded-full glass-pill flex items-center justify-center text-xs">🌊</span>
              Les bouteilles retrouvées dans la mer ({groups.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 bouteille-list">
              {groups.map((group) => {
                const isOwner = user && user.id === group.owner_id;
                const userStatus = group.userMembershipStatus;
                const canJoinScore = userTrustScore >= group.min_trust_score;
                const canJoinSpots = group.spotsLeft > 0;
                
                return (
                  <div key={group.id} className="glass-sub-card p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <img src={group.owner?.avatar_url || 'https://i.pravatar.cc/150'} className="w-7 h-7 rounded-full border border-white/30 object-cover shrink-0" />
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-[#17402C] truncate">
                              {group.owner?.full_name || 'Voyageur'}
                              {isOwner && <span className="ml-1.5"><Badge tone="sage">Créateur</Badge></span>}
                            </div>
                            <div className="text-[10px] text-[#5A7064] font-mono flex items-center gap-1.5">
                              <span>Trust: <strong className={group.owner?.trust_score >= 80 ? 'text-[#486944]' : 'text-[#17402C]'}>{group.owner?.trust_score || 0}/100</strong></span>
                              {group.mixite === 'women_only' && <span className="text-[#8C6418] font-sans">· 👭 Femmes</span>}
                              {group.mixite === 'men_only' && <span className="text-[#5B7F55] font-sans">· 👬 Hommes</span>}
                            </div>
                          </div>
                        </div>

                        {/* Quick Report Icon */}
                        {!isOwner && user && (
                          <button
                            onClick={() => setReportTarget({ userId: group.owner_id, userName: group.owner?.full_name || 'Créateur', groupId: group.id, groupName: group.name })}
                            className="text-[#5A7064] hover:text-[#A8443A] p-1 text-xs"
                            title="Signaler ou bloquer"
                          >
                            🚩
                          </button>
                        )}
                      </div>
                      
                      <h4 className="font-bold text-sm text-[#17402C] mb-1 truncate">{group.name}</h4>
                      <p className="text-xs text-[#365233] line-clamp-1 mb-2">
                        {group.description || "Aucun message, mais une aventure en vue."}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-[#5A7064]">
                        {group.departure_date && (
                          <span className="glass-pill px-2 py-0.5">Départ : {new Date(group.departure_date).toLocaleDateString()}</span>
                        )}
                        <span className="glass-pill px-2 py-0.5 text-[#8C6418] font-bold">
                          {group.spotsLeft} place{group.spotsLeft > 1 ? 's' : ''} restante{group.spotsLeft > 1 ? 's' : ''}
                        </span>
                        {group.totalExpenses > 0 && (
                          <span className="glass-pill px-2 py-0.5 text-[#486944]">
                            💰 {Math.round(group.totalExpenses)} € engagés
                          </span>
                        )}
                      </div>

                      <div className="text-[9px] text-[#5A7064] mt-1.5 font-sans">
                        * Le trust score reflète l'historique sans signalement, pas une garantie d'adéquation humaine.
                      </div>
                    </div>
                    
                    <div className="sm:w-[140px] flex flex-col items-center sm:items-end justify-center w-full pt-3 sm:pt-0 border-t sm:border-t-0 sm:border-l border-[#E4DED3] sm:pl-3 shrink-0">
                      {isOwner ? (
                        <div className="w-full flex flex-col gap-1.5">
                          <button
                            onClick={() => loadApplicantsForGroup(group)}
                            className="glass-capsule-btn w-full px-2.5 text-xs font-bold relative"
                          >
                            Gérer ({group.pendingCount || 0})
                            {group.pendingCount > 0 && (
                              <span className="absolute -top-1.5 -right-1.5 animate-pulse">
                                <Badge tone="danger">{group.pendingCount}</Badge>
                              </span>
                            )}
                          </button>
                          <button
                            onClick={() => router.push(`/groupes/${group.id}`)}
                            className="w-full py-1.5 text-[11px] text-[#5A7064] hover:text-[#17402C] text-center"
                          >
                            Ouvrir le cockpit →
                          </button>
                        </div>
                      ) : userStatus === 'active' ? (
                        <div className="w-full text-center">
                          <span className="glass-pill px-2.5 py-1 text-[11px] font-bold mb-1.5">
                            ✓ Confirmé
                          </span>
                          <button
                            onClick={() => router.push(`/groupes/${group.id}`)}
                            className="glass-capsule-btn w-full text-xs font-bold"
                          >
                            Accéder au groupe
                          </button>
                        </div>
                      ) : userStatus === 'pending' ? (
                        <div className="w-full text-center space-y-1.5">
                          <div className="text-[10px] text-[#486944] font-mono flex items-center justify-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#C89A3B] animate-pulse"></span>
                            En attente créateur
                          </div>
                          <button
                            onClick={() => handleCancelRequest(group)}
                            disabled={cancelLoadingId === group.id}
                            className="glass-capsule-btn secondary w-full text-[11px] font-semibold"
                          >
                            {cancelLoadingId === group.id ? 'Annulation...' : 'Annuler'}
                          </button>
                        </div>
                      ) : (
                        <div className="w-full">
                          <div className="text-[10px] font-mono font-bold text-[#486944] mb-1.5 text-center sm:text-right">
                            Requis {group.min_trust_score}+
                          </div>
                          
                          <button 
                            onClick={() => {
                              if (!user) router.push('/connexion');
                              else if (isSuspended) alert("Votre compte est actuellement restreint suite à un signalement.");
                              else if (!canJoinScore) alert(`Votre Trust Score (${userTrustScore}) est inférieur au seuil requis (${group.min_trust_score}).`);
                              else {
                                setJoinModalGroup(group);
                                setJoinIsAdult(false);
                                setJoinAcknowledgeExpenses(false);
                              }
                            }}
                            disabled={joinLoadingId === group.id || !canJoinSpots || isSuspended}
                            className={`w-full py-2 px-3 rounded-full text-xs font-bold transition-colors ${
                              !canJoinSpots || isSuspended
                                ? 'glass-capsule-btn opacity-40 cursor-not-allowed'
                                : !user || canJoinScore 
                                  ? 'glass-capsule-btn' 
                                  : 'glass-capsule-btn secondary opacity-60'
                            }`}
                          >
                            {!canJoinSpots ? 'Complet' : 'Demander'}
                          </button>
                          
                          {user && !canJoinScore && canJoinSpots && (
                            <div className="text-[9px] text-center text-[#8C6418] mt-1 opacity-80 leading-tight">
                              Score insuffisant ({userTrustScore})
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL: Demande de rejoindre (avec clauses financières et 18+) ── */}
      {joinModalGroup && (
        <GlassSheet open onOpenChange={(v) => { if (!v) setJoinModalGroup(null); }} title="Rejoindre l'expédition">
          <div className="space-y-3 text-xs text-[#365233] leading-relaxed mb-5">
            <p className="text-xs text-[#486944] font-semibold">{joinModalGroup.name}</p>
            <div className="glass-sub-card p-3 space-y-1">
              <p><strong className="text-[#17402C]">Modèle à validation :</strong> Votre demande sera transmise au créateur du groupe qui examinera votre profil avant acceptation.</p>
              <p className="text-[#5A7064]">Trust Score requis : {joinModalGroup.min_trust_score}/100 (Vous avez {userTrustScore}/100).</p>
              {joinModalGroup.totalExpenses > 0 && (
                <p className="text-[#8C6418] font-semibold pt-1">
                  💳 Dépenses déjà enregistrées sur le groupe : {Math.round(joinModalGroup.totalExpenses)} €
                </p>
              )}
            </div>

            {/* Clause financière claire */}
            <label className="flex items-start gap-2.5 p-3 glass-sub-card cursor-pointer">
              <input
                type="checkbox"
                checked={joinAcknowledgeExpenses}
                onChange={e => setJoinAcknowledgeExpenses(e.target.checked)}
                className="mt-0.5 rounded text-[#5B7F55] accent-[#5B7F55]"
              />
              <span className="text-[#17402C] text-[11px] leading-snug">
                Je comprends que les dépenses déjà engagées ne sont <strong>pas automatiquement remboursées par la plateforme</strong> (LKDV fournit un outil de suivi de répartition, sans compte séquestre).
              </span>
            </label>

            {/* Confirmation majorité */}
            <label className="flex items-start gap-2.5 p-3 glass-sub-card cursor-pointer">
              <input
                type="checkbox"
                checked={joinIsAdult}
                onChange={e => setJoinIsAdult(e.target.checked)}
                className="mt-0.5 rounded text-[#5B7F55] accent-[#5B7F55]"
              />
              <span className="text-[#17402C] text-[11px] leading-snug">
                Je certifie sur l'honneur avoir <strong>18 ans ou plus</strong> et m'engage à voyager dans le respect des autres membres.
              </span>
            </label>

            <p className="text-[10px] text-[#5A7064] italic text-center">
              L'app facilite la mise en relation, l'organisation du séjour reste sous la responsabilité des membres.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setJoinModalGroup(null)}
              className="flex-1 glass-capsule-btn secondary text-xs font-semibold"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleConfirmJoin}
              disabled={!joinIsAdult || !joinAcknowledgeExpenses || joinLoadingId === joinModalGroup.id}
              className="flex-1 glass-capsule-btn text-xs font-bold disabled:opacity-40"
            >
              {joinLoadingId === joinModalGroup.id ? 'Envoi...' : 'Envoyer la demande'}
            </button>
          </div>
        </GlassSheet>
      )}

      {/* ── MODAL: Gestion des candidatures par le créateur ── */}
      {selectedGroupForManagement && (
        <GlassSheet open onOpenChange={(v) => { if (!v) setSelectedGroupForManagement(null); }} title="Demandes en attente">
          <p className="text-xs text-[#5A7064] mb-4">{selectedGroupForManagement.name} · {selectedGroupForManagement.spotsLeft} place(s) restante(s)</p>

          <div className="space-y-3.5 pr-1">
            {loadingApplicants ? (
              <div className="py-8 flex justify-center">
                <div className="w-6 h-6 border-2 border-[#5B7F55]/20 border-t-[#5B7F55] rounded-full animate-spin"></div>
              </div>
            ) : pendingApplicants.length === 0 ? (
              <div className="py-8 text-center text-[#5A7064] text-xs">
                Aucune demande en attente pour le moment sur cette expédition.
              </div>
            ) : (
              pendingApplicants.map((applicant) => {
                const p = applicant.profile;
                const isProcessing = processingApplicantId === applicant.id;

                return (
                  <div key={applicant.id} className="glass-sub-card p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="flex items-start gap-3 min-w-0">
                      <img src={p?.avatar_url || 'https://i.pravatar.cc/150'} className="w-10 h-10 rounded-full border border-white/30 object-cover shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-[#17402C] truncate">{p?.full_name || 'Voyageur'}</div>
                        
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] font-mono text-[#5A7064]">
                          <span className="glass-pill px-2 py-0.5 font-bold">
                            Trust: {p?.trust_score || 50}/100
                          </span>
                          <span>
                            {getAccountAgeLabel(p?.created_at)}
                          </span>
                        </div>

                        {p?.bio && (
                          <p className="text-xs text-[#365233] line-clamp-2 mt-1.5 italic">
                            "{p.bio}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end gap-2 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-[#E4DED3] shrink-0">
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => handleAcceptApplicant(applicant)}
                          disabled={isProcessing || selectedGroupForManagement.spotsLeft <= 0}
                          className="flex-1 sm:flex-initial px-3.5 py-1.5 glass-capsule-btn text-xs font-bold disabled:opacity-40"
                        >
                          Accepter
                        </button>
                        <button
                          onClick={() => handleRejectApplicant(applicant)}
                          disabled={isProcessing}
                          className="flex-1 sm:flex-initial px-3.5 py-1.5 glass-capsule-btn secondary text-xs font-semibold"
                        >
                          Refuser
                        </button>
                      </div>

                      {/* Security action */}
                      <button
                        onClick={() => setReportTarget({ userId: applicant.user_id, userName: p?.full_name || 'Demandeur', groupId: selectedGroupForManagement.id, groupName: selectedGroupForManagement.name })}
                        className="text-[10px] text-[#5A7064] hover:text-[#A8443A] underline transition-colors"
                      >
                        Signaler / Bloquer
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </GlassSheet>
      )}

      </GlassCard>

      {/* ── MODAL: Signalement & Blocage ── */}
      <ReportBlockModal
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        onSuccess={() => {
          setPendingApplicants(prev => prev.filter(a => a.user_id !== reportTarget?.userId));
          fetchGroups();
        }}
      />
    </>
  );
}

