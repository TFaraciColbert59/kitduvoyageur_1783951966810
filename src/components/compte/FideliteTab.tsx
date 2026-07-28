'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { UserProfile } from '@/lib/mock/compte-marceline';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface BadgeProgress {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  category: string;
  rarity: string;
  points_reward: number;
  requirement_type: string;
  requirement_value: number;
  current_value: number;
  percentage: number;
  is_unlocked: boolean;
  earned_at: string | null;
}

interface LoyaltyHistory {
  id: string;
  action: string;
  points: number;
  type: string;
  created_at: string;
}

interface LoyaltyReward {
  id: string;
  title: string;
  description: string;
  points_cost: number;
  category: string;
  value: string;
  available: boolean;
  image: string;
  alt: string;
}

interface FideliteTabProps {
  profile: UserProfile;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function formatDateShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function formatDateFull(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function getRarityColor(rarity: string) {
  switch (rarity?.toLowerCase()) {
    case 'légendaire': return 'text-purple-600';
    case 'épique': return 'text-blue-600';
    case 'rare': return 'text-[#E4501C]';
    default: return 'text-[#9CA89E]';
  }
}

function getHistoryIconAndColors(type: string, points: number) {
  if (points < 0) return { icon: 'ArrowRightIcon', color: 'text-[#E4501C]', bg: 'bg-red-50' };
  switch (type) {
    case 'badge_unlock': return { icon: 'StarIcon', color: 'text-amber-500', bg: 'bg-amber-50' };
    case 'post_creation': return { icon: 'MapIcon', color: 'text-emerald-600', bg: 'bg-emerald-50' };
    case 'reward_redemption': return { icon: 'ArrowRightIcon', color: 'text-[#E4501C]', bg: 'bg-red-50' };
    default: return { icon: 'SparklesIcon', color: 'text-emerald-600', bg: 'bg-emerald-50' };
  }
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function FideliteTab({ profile }: FideliteTabProps) {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');
  
  // Real DB States
  const [badgesProgress, setBadgesProgress] = useState<BadgeProgress[]>([]);
  const [history, setHistory] = useState<LoyaltyHistory[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [currentPoints, setCurrentPoints] = useState<number>(0);
  
  // UI States
  const [badgeFilter, setBadgeFilter] = useState<'all' | 'earned' | 'locked'>('all');
  const [toast, setToast] = useState<string | null>(null);
  const [showAllBadgesModal, setShowAllBadgesModal] = useState(false);
  const [modalFilter, setModalFilter] = useState<'all' | 'unlocked' | 'in_progress' | 'locked'>('all');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // Data fetching
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Fetch user profile for latest point balance
      const { data: userProfile } = await supabase.from('user_profiles').select('loyalty_points').eq('id', user.id).single();
      setCurrentPoints(userProfile?.loyalty_points || 0);

      // Fetch real badge progress via RPC or fallback table query
      let progressList: BadgeProgress[] = [];
      try {
        const { data: badgesRes, error: badgesErr } = await supabase.rpc('get_user_badges_progress', { p_user_id: user.id });
        if (!badgesErr && Array.isArray(badgesRes) && badgesRes.length > 0) {
          progressList = badgesRes as BadgeProgress[];
        } else {
          // Fallback: Query badges and user_badges directly
          const { data: allBadges } = await supabase.from('badges').select('*');
          const { data: userBadges } = await supabase.from('user_badges').select('badge_id, earned_at').eq('user_id', user.id);
          
          const earnedMap = new Map((userBadges || []).map((ub: any) => [ub.badge_id, ub.earned_at]));

          if (allBadges && allBadges.length > 0) {
            progressList = allBadges.map((b: any) => {
              const isUnlocked = earnedMap.has(b.id);
              return {
                id: b.id,
                name: b.name || b.title || 'Badge',
                slug: b.slug || b.id,
                description: b.description || '',
                icon: b.icon || '🏆',
                category: b.category || 'Général',
                rarity: b.rarity || 'Commun',
                points_reward: b.points_reward || 100,
                requirement_type: b.requirement_type || 'actions',
                requirement_value: b.requirement_value || 5,
                current_value: isUnlocked ? (b.requirement_value || 5) : 0,
                percentage: isUnlocked ? 100 : 0,
                is_unlocked: isUnlocked,
                earned_at: earnedMap.get(b.id) || null,
              };
            });
          }
        }
      } catch (err: any) {
        console.warn('RPC get_user_badges_progress fallback used:', err.message || err);
      }

      // Default fallback badges if database tables are empty
      if (progressList.length === 0) {
        progressList = [
          { id: 'b1', name: 'Premier Pas', slug: 'premier-pas', description: 'Rejoindre la communauté Kit du Voyageur', icon: '🎒', category: 'Départ', rarity: 'Commun', points_reward: 50, requirement_type: 'inscription', requirement_value: 1, current_value: 1, percentage: 100, is_unlocked: true, earned_at: new Date().toISOString() },
          { id: 'b2', name: 'Explorateur Alpin', slug: 'explorateur-alpin', description: 'Randonner au-dessus de 2000m de dénivelé', icon: '🏔️', category: 'Montagne', rarity: 'Rare', points_reward: 150, requirement_type: 'dénivelé', requirement_value: 2000, current_value: 1450, percentage: 72, is_unlocked: false, earned_at: null },
          { id: 'b3', name: 'Bivouac Étoilé', slug: 'bivouac-etoile', description: 'Publier 3 récits de bivouac en pleine nature', icon: '🏕️', category: 'Camping', rarity: 'Épique', points_reward: 250, requirement_type: 'récits', requirement_value: 3, current_value: 1, percentage: 33, is_unlocked: false, earned_at: null },
          { id: 'b4', name: 'Ami des Refuges', slug: 'ami-des-refuges', description: 'Rejoindre 2 clubs d\'expédition', icon: '🏡', category: 'Communauté', rarity: 'Commun', points_reward: 100, requirement_type: 'clubs', requirement_value: 2, current_value: 2, percentage: 100, is_unlocked: true, earned_at: new Date().toISOString() },
        ];
      }

      setBadgesProgress(progressList);

      // Fetch ledger history
      const { data: historyRes } = await supabase
        .from('loyalty_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setHistory(historyRes as LoyaltyHistory[] || []);

      // Fetch active rewards
      const { data: rewardsRes } = await supabase
        .from('loyalty_rewards')
        .select('*')
        .eq('available', true)
        .order('points_cost', { ascending: true });
      setRewards(rewardsRes as LoyaltyReward[] || []);
      
    } catch (err) {
      console.error('FideliteTab fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Derived state
  const unlockedBadges = badgesProgress.filter(b => b.is_unlocked);
  const totalBadges = badgesProgress.length;
  
  // Calculate level based on points
  const levels = [
    { num: 'I', name: 'Curieux', min: 0, max: 200 },
    { num: 'II', name: 'Régulier', min: 200, max: 800 },
    { num: 'III', name: 'Explorateur', min: 800, max: 1500 },
    { num: 'IV', name: 'Guide', min: 1500, max: 4000 },
    { num: 'V', name: 'Ambassadeur', min: 4000, max: 10000 }
  ];
  
  const currentLevelIndex = levels.findIndex(l => currentPoints >= l.min && currentPoints < l.max) !== -1 
    ? levels.findIndex(l => currentPoints >= l.min && currentPoints < l.max) 
    : levels.length - 1;
    
  const currentLevel = levels[currentLevelIndex];
  const nextLevel = levels[currentLevelIndex + 1];
  
  const pointsInCurrentLevel = currentPoints - currentLevel.min;
  const levelRange = currentLevel.max - currentLevel.min;
  const progressPercent = Math.min(100, Math.round((pointsInCurrentLevel / levelRange) * 100));
  const pointsToNext = currentLevel.max - currentPoints;

  // Filtered badges for grid
  const filteredBadges = useMemo(() => {
    let list = badgesProgress;
    if (badgeFilter === 'earned') return list.filter(b => b.is_unlocked);
    if (badgeFilter === 'locked') return list.filter(b => !b.is_unlocked);
    return list;
  }, [badgesProgress, badgeFilter]);

  // Actions
  const handleExchange = async (rewardId: string, cost: number, available: boolean) => {
    if (!available) return;
    if (currentPoints < cost) {
      showToast('Solde insuffisant');
      return;
    }
    
    try {
      const { data, error } = await supabase.rpc('redeem_reward', { p_user_id: userId, p_reward_id: rewardId });
      if (error) {
        showToast(`Erreur : ${error.message}`);
        return;
      }
      showToast(`Récompense échangée avec succès !`);
      
      // Refresh all data dynamically
      fetchData();
    } catch (err: any) {
      showToast(`Erreur : ${err.message || 'Impossible d\'échanger'}`);
    }
  };

  const renderBadgeModal = () => {
    if (!showAllBadgesModal) return null;

    let modalBadges = badgesProgress;
    if (modalFilter === 'unlocked') modalBadges = badgesProgress.filter(b => b.is_unlocked);
    if (modalFilter === 'in_progress') modalBadges = badgesProgress.filter(b => !b.is_unlocked && b.percentage > 0);
    if (modalFilter === 'locked') modalBadges = badgesProgress.filter(b => !b.is_unlocked && b.percentage === 0);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#1C2620]/40 backdrop-blur-sm animate-fade-in">
        <div className="bg-[#F5F3ED] rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-[#E8E4D8] flex items-center justify-between bg-white relative z-10">
            <div>
              <h3 className="font-display font-800 text-2xl text-[#1C2620]">
                Tous les <em className="font-serif font-normal not-italic text-[#5C6B5E]">badges</em>
              </h3>
              <p className="text-xs text-[#9CA89E] mt-1">{unlockedBadges.length} / {totalBadges} débloqués</p>
            </div>
            <button onClick={() => setShowAllBadgesModal(false)} className="p-2 text-[#9CA89E] hover:text-[#1C2620] transition-colors rounded-full hover:bg-black/5">
              <Icon name="XMarkIcon" size={24} />
            </button>
          </div>

          {/* Filters */}
          <div className="px-6 py-4 bg-[#FAFAF7] border-b border-[#E8E4D8] flex gap-2 overflow-x-auto hide-scrollbar">
            <button onClick={() => setModalFilter('all')} className={`px-4 py-2 rounded-full text-xs font-700 whitespace-nowrap transition-colors ${modalFilter === 'all' ? 'bg-[#1C2620] text-white' : 'bg-white border border-[#E8E4D8] text-[#5C6B5E] hover:border-[#C8C3B0]'}`}>Tous les badges</button>
            <button onClick={() => setModalFilter('unlocked')} className={`px-4 py-2 rounded-full text-xs font-700 whitespace-nowrap transition-colors ${modalFilter === 'unlocked' ? 'bg-emerald-600 text-white' : 'bg-white border border-[#E8E4D8] text-[#5C6B5E] hover:border-[#C8C3B0]'}`}>Débloqués ✅</button>
            <button onClick={() => setModalFilter('in_progress')} className={`px-4 py-2 rounded-full text-xs font-700 whitespace-nowrap transition-colors ${modalFilter === 'in_progress' ? 'bg-amber-500 text-white' : 'bg-white border border-[#E8E4D8] text-[#5C6B5E] hover:border-[#C8C3B0]'}`}>En progression 🔄</button>
            <button onClick={() => setModalFilter('locked')} className={`px-4 py-2 rounded-full text-xs font-700 whitespace-nowrap transition-colors ${modalFilter === 'locked' ? 'bg-[#9CA89E] text-white' : 'bg-white border border-[#E8E4D8] text-[#5C6B5E] hover:border-[#C8C3B0]'}`}>Verrouillés 🔒</button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-6 bg-[#F5F3ED]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {modalBadges.map(badge => (
                <div key={badge.id} className="bg-white rounded-2xl p-5 border border-[#E8E4D8] flex gap-5">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 text-3xl ${badge.is_unlocked ? 'bg-[#F9F7EF] border border-[#E8E4D8]' : 'bg-[#FAFAF7] opacity-50 grayscale'}`}>
                    {/* Placeholder emoji logic since icon field might be a name */}
                    {badge.is_unlocked ? '🏆' : '🔒'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-700 text-[#1C2620] truncate">{badge.name}</h4>
                      <span className={`text-[10px] font-mono tracking-wide px-2 py-0.5 rounded-full bg-[#FAFAF7] border border-[#E8E4D8] ${getRarityColor(badge.rarity)}`}>{badge.rarity}</span>
                    </div>
                    <p className="text-xs text-[#9CA89E] mb-3 line-clamp-2">{badge.description || `Objectif : ${badge.requirement_value} ${badge.requirement_type}`}</p>
                    
                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-600 text-[#5C6B5E]">
                        <span>Progression : {badge.current_value} / {badge.requirement_value}</span>
                        <span>{badge.percentage} %</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#EDEAE0] rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${badge.is_unlocked ? 'bg-emerald-500' : badge.percentage > 0 ? 'bg-amber-400' : 'bg-[#C8C3B0]'}`}
                          style={{ width: `${badge.percentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Status Footer */}
                    <div className="mt-3 pt-3 border-t border-[#E8E4D8] flex justify-between items-center text-[10px] font-700">
                      {badge.is_unlocked ? (
                        <span className="text-emerald-600">✅ Débloqué — {formatDateFull(badge.earned_at!)}</span>
                      ) : badge.percentage > 0 ? (
                        <span className="text-amber-600">🔄 En progression</span>
                      ) : (
                        <span className="text-[#9CA89E]">🔒 Verrouillé</span>
                      )}
                      
                      <span className="text-[#1C2620]">+{badge.points_reward} pts</span>
                    </div>
                  </div>
                </div>
              ))}
              
              {modalBadges.length === 0 && (
                <div className="col-span-1 md:col-span-2 py-12 text-center text-[#9CA89E]">
                  Aucun badge ne correspond à ce filtre.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading && totalBadges === 0) {
    return (
      <div className="animate-pulse space-y-8">
        <div className="h-64 bg-white border border-[#E8E4D8] rounded-3xl" />
        <div className="h-96 bg-white border border-[#E8E4D8] rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative pb-20">

      {/* ════════════════ MAIN COLUMN ════════════════ */}
      <div className="lg:col-span-8 space-y-8">
        
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-2">
          <div>
            <h2 className="font-display font-800 text-3xl text-[#1C2620] leading-tight">
              Fidélité <em className="font-serif font-normal not-italic text-[#5C6B5E]">& jalons</em>
            </h2>
            <p className="text-sm text-[#5C6B5E] mt-1">
              {currentPoints} points cumulés · {unlockedBadges.length} badges gagnés sur {totalBadges} · niveau {currentLevel.num}.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button className="px-4 py-2.5 border border-[#C8C3B0] text-[#5C6B5E] hover:text-[#1C2620] hover:border-[#1C2620]/40 rounded-full text-xs font-700 transition-all">
              Historique complet
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-[#1C2620] hover:bg-[#2A3830] text-white rounded-full text-xs font-700 transition-all shadow-md">
              <Icon name="StarIcon" size={14} />
              Échanger
            </button>
          </div>
        </div>

        {/* ── Hero Card (Progress) ── */}
        <div className="bg-[#2A3B32] rounded-[32px] p-8 text-white relative overflow-hidden flex flex-col sm:flex-row items-center gap-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#3B5245] rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3 pointer-events-none opacity-50" />
          
          {/* Left: Circle */}
          <div className="relative w-40 h-40 flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="45" fill="transparent" stroke="#3B5245" strokeWidth="4" />
              <circle 
                cx="50" cy="50" r="45" fill="transparent" stroke="#A7D3A6" strokeWidth="4" 
                strokeDasharray={`${progressPercent * 2.827} 282.7`} 
                strokeLinecap="round" 
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] font-mono tracking-widest text-[#A7D3A6] mb-1">NIVEAU</span>
              <span className="font-display font-800 text-4xl leading-none mb-1">{currentLevel.num}</span>
              <span className="font-display font-700 text-xl text-white">{currentPoints}</span>
              <span className="text-[9px] text-[#A7D3A6]/70">/ {currentLevel.max} pts</span>
            </div>
          </div>

          {/* Middle: Text */}
          <div className="flex-1 relative z-10 text-center sm:text-left">
            <p className="text-[10px] font-mono tracking-widest text-[#A7D3A6] uppercase mb-1">
              Voyageuse - {currentLevel.name}
            </p>
            <h3 className="font-display font-700 text-3xl text-white mb-3">
              {progressPercent} % vers <em className="font-serif font-normal not-italic">{nextLevel?.name || 'Max'}</em>.
            </h3>
            <p className="text-sm text-white/70 leading-relaxed mb-5 max-w-md mx-auto sm:mx-0">
              Encore {pointsToNext} points à gagner pour débloquer le niveau {nextLevel?.num} et l'accès aux avantages {nextLevel?.name}.
            </p>
          </div>

          {/* Right: Stats */}
          <div className="flex flex-row sm:flex-col gap-3 relative z-10 w-full sm:w-auto overflow-x-auto sm:overflow-visible pb-2 sm:pb-0 hide-scrollbar">
            <div className="bg-[#3B5245]/50 backdrop-blur-md rounded-2xl p-4 min-w-[120px] text-center sm:text-right border border-white/5">
              <p className="text-[9px] font-mono tracking-widest uppercase text-white/60 mb-1">Badges débloqués</p>
              <p className="font-display font-700 text-xl text-white">{unlockedBadges.length} <span className="text-xs font-normal text-white/50">/ {totalBadges}</span></p>
            </div>
          </div>
        </div>

        {/* ── Vos Badges ── */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
            <div>
              <h3 className="font-display font-700 text-xl text-[#1C2620]">
                Vos <em className="font-serif font-normal not-italic">badges</em>
              </h3>
              <p className="text-xs text-[#9CA89E] mt-1">
                {unlockedBadges.length} badges gagnés sur {totalBadges}. Chaque badge raconte une étape franchie.
              </p>
            </div>
            <div className="flex items-center bg-[#EDEAE0] p-1 rounded-full text-xs font-600 flex-shrink-0">
              <button onClick={() => setBadgeFilter('all')} className={`px-4 py-1.5 rounded-full transition-all ${badgeFilter === 'all' ? 'bg-white shadow-sm text-[#1C2620]' : 'text-[#9CA89E] hover:text-[#5C6B5E]'}`}>Tous ({totalBadges})</button>
              <button onClick={() => setBadgeFilter('earned')} className={`px-4 py-1.5 rounded-full transition-all ${badgeFilter === 'earned' ? 'bg-white shadow-sm text-[#1C2620]' : 'text-[#9CA89E] hover:text-[#5C6B5E]'}`}>Gagnés ({unlockedBadges.length})</button>
              <button onClick={() => setBadgeFilter('locked')} className={`px-4 py-1.5 rounded-full transition-all ${badgeFilter === 'locked' ? 'bg-white shadow-sm text-[#1C2620]' : 'text-[#9CA89E] hover:text-[#5C6B5E]'}`}>À débloquer</button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {filteredBadges.slice(0, 18).map((badge) => (
              <div 
                key={badge.id}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                  badge.is_unlocked 
                    ? 'bg-[#F9F7EF] border-[#E8E4D8] hover:border-[#C8C3B0] relative overflow-hidden' 
                    : 'bg-[#FAFAF7] border-dashed border-[#E8E4D8] opacity-60 grayscale'
                }`}
              >
                {badge.is_unlocked && (
                  <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                )}
                <span className="text-2xl mb-2">{badge.is_unlocked ? '🏆' : '🔒'}</span>
                <span className="text-[11px] font-700 text-[#1C2620] text-center leading-tight mb-1 truncate w-full">{badge.name}</span>
                <span className={`text-[9px] font-mono tracking-wide ${getRarityColor(badge.rarity)}`}>
                  {badge.percentage} %
                </span>
              </div>
            ))}
          </div>
          
          <div className="mt-5 text-center">
            <button 
              onClick={() => setShowAllBadgesModal(true)}
              className="px-6 py-2.5 border border-[#C8C3B0] text-[#5C6B5E] hover:text-[#1C2620] hover:border-[#1C2620]/40 rounded-full text-xs font-700 transition-all"
            >
              Voir les {totalBadges} badges à débloquer
            </button>
          </div>
        </div>

        {/* ── Historique des points (Ledger) ── */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
            <div>
              <h3 className="font-display font-700 text-xl text-[#1C2620]">
                Historique <em className="font-serif font-normal not-italic">des points</em>
              </h3>
              <p className="text-xs text-[#9CA89E] mt-1">
                Chaque publication, badge et échange laisse une trace indélébile.
              </p>
            </div>
            <p className="text-[10px] font-mono tracking-widest text-[#9CA89E] uppercase">{history.length} transactions</p>
          </div>

          {history.length === 0 ? (
            <div className="bg-white border border-[#E8E4D8] rounded-3xl p-8 text-center text-[#9CA89E] text-sm">
              Aucun historique disponible.
            </div>
          ) : (
            <div className="bg-white border border-[#E8E4D8] rounded-3xl overflow-hidden divide-y divide-[#E8E4D8]">
              {history.slice(0, 10).map((item) => {
                const style = getHistoryIconAndColors(item.type, item.points);
                return (
                  <div key={item.id} className="p-5 flex items-center gap-4 hover:bg-[#FAFAF7] transition-colors">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${style.bg} ${style.color}`}>
                      <Icon name={style.icon as any} size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-600 text-sm text-[#1C2620] truncate">{item.action}</p>
                      <p className="text-xs text-[#9CA89E] font-mono mt-0.5 truncate">{formatDateFull(item.created_at)}</p>
                    </div>
                    <div className={`font-display font-700 text-lg flex-shrink-0 ${item.points < 0 ? 'text-[#E4501C]' : 'text-[#1C2620]'}`}>
                      {item.points > 0 ? '+' : ''}{item.points} <span className="text-[10px] font-mono font-normal">PTS</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Échanger vos points ── */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
            <div>
              <h3 className="font-display font-700 text-xl text-[#1C2620]">
                Échanger <em className="font-serif font-normal not-italic">vos points</em>
              </h3>
              <p className="text-xs text-[#9CA89E] mt-1">
                Vos {currentPoints} points peuvent être échangés de manière sécurisée contre des avantages.
              </p>
            </div>
            <p className="text-[10px] font-mono tracking-widest text-[#9CA89E] uppercase">{rewards.length} récompenses disponibles</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {rewards.map((reward) => (
              <div key={reward.id} className="bg-white border border-[#E8E4D8] rounded-3xl p-6 flex flex-col hover:border-[#C8C3B0] transition-colors">
                <div className="w-10 h-10 rounded-xl bg-[#EDEAE0] text-[#5C6B5E] flex items-center justify-center mb-4">
                  <Icon name={(reward.image || 'StarIcon') as any} size={20} />
                </div>
                <h4 className="font-700 text-[#1C2620] text-sm mb-1">{reward.title}</h4>
                <p className="text-[11px] text-[#9CA89E] leading-relaxed mb-6 flex-1">{reward.description}</p>
                
                <div className="flex items-center justify-between mt-auto">
                  <span className="font-display font-700 text-lg text-[#1C2620]">
                    {reward.points_cost} <span className="text-[10px] font-mono font-normal">PTS</span>
                  </span>
                  <button 
                    onClick={() => handleExchange(reward.id, reward.points_cost, reward.available)}
                    disabled={!reward.available || currentPoints < reward.points_cost}
                    className={`px-4 py-2 rounded-full text-xs font-700 transition-all ${
                      currentPoints >= reward.points_cost && reward.available
                        ? 'bg-[#1C2620] hover:bg-[#2A3830] text-white shadow-md' 
                        : 'bg-[#FAFAF7] text-[#9CA89E] border border-[#E8E4D8] cursor-not-allowed'
                    }`}
                  >
                    {reward.available ? 'Échanger' : 'Verrouillé'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ════════════════ SIDEBAR ════════════════ */}
      <div className="lg:col-span-4 space-y-5">

        {/* ── Règles d'obtention ── */}
        <div className="bg-white border border-[#E8E4D8] rounded-3xl p-6">
          <h4 className="font-display font-700 text-[#1C2620] text-lg mb-1">
            Gagner <em className="font-serif font-normal not-italic">des points</em>
          </h4>
          <p className="text-[11px] text-[#9CA89E] mb-6">
            Votre fidélité et votre activité sont récompensées.
          </p>
          <ul className="space-y-4">
            {[
              { label: 'Achats Boutique', pts: '1€ = 10 pts' },
              { label: 'Débloquer un badge', pts: '+50 à 500 pts' },
              { label: 'Parrainer un ami', pts: '+250 pts' },
            ].map((rule, i) => (
              <li key={i} className="flex items-center justify-between border-b border-[#E8E4D8] pb-3 last:border-0 last:pb-0">
                <span className="text-sm font-600 text-[#1C2620]">{rule.label}</span>
                <span className="text-xs font-mono font-700 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">{rule.pts}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Échelle des niveaux ── */}
        <div className="bg-white border border-[#E8E4D8] rounded-3xl p-6">
          <h4 className="font-display font-700 text-[#1C2620] text-lg mb-1">
            Échelle <em className="font-serif font-normal not-italic">des niveaux</em>
          </h4>
          <p className="text-[11px] text-[#9CA89E] mb-6">
            Le chemin depuis Curieux jusqu'à Ambassadeur.
          </p>

          <div className="space-y-4">
            {levels.map((lvl) => {
              const isCurrent = lvl.num === currentLevel.num;
              const isPassed = currentPoints >= lvl.max;
              
              return (
                <div key={lvl.num} className={`flex items-start gap-4 p-3 rounded-2xl transition-colors ${isCurrent ? 'bg-[#2A3B32] text-white shadow-md' : isPassed ? 'opacity-60' : 'bg-[#FAFAF7] border border-[#E8E4D8]'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-display font-700 text-sm flex-shrink-0 ${
                    isCurrent ? 'bg-[#3B5245] text-[#A7D3A6]' : isPassed ? 'bg-[#EDEAE0] text-[#5C6B5E]' : 'bg-white border border-[#E8E4D8] text-[#9CA89E]'
                  }`}>
                    {lvl.num}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-700 text-sm ${isCurrent ? 'text-white' : 'text-[#1C2620]'}`}>{lvl.name}</p>
                    <p className={`text-[10px] font-mono mt-0.5 ${isCurrent ? 'text-[#A7D3A6]' : 'text-[#9CA89E]'}`}>
                      {lvl.min === 4000 ? '4 000+ pts' : `${lvl.min} - ${lvl.max} pts`}
                    </p>
                    {isCurrent && (
                      <p className="text-xs text-white/70 mt-1 italic leading-tight">
                        Encore {pointsToNext} pts → niveau {nextLevel?.num}
                      </p>
                    )}
                  </div>
                  {isPassed && (
                    <div className="text-emerald-500 text-[10px] font-600 flex items-center gap-1 mt-1">
                      <Icon name="CheckIcon" size={12} />
                      atteint
                    </div>
                  )}
                  {!isPassed && !isCurrent && (
                    <div className="text-[9px] font-mono tracking-widest text-[#9CA89E] uppercase mt-1">
                      {lvl.min === 4000 ? 'Sur invit.' : `-${lvl.min - currentPoints} pts`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
      
      {renderBadgeModal()}

      {/* Global Toast */}
      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] bg-[#1C2620] text-white px-6 py-3 rounded-full text-xs font-extrabold shadow-2xl animate-fade-in-up flex items-center gap-2 border border-white/20">
          <Icon name="CheckIcon" size={14} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
