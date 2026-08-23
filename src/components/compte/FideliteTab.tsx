'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { UserProfile } from '@/lib/mock/compte-marceline';
import { newId } from '@/lib/uuid';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface RewardAccount {
  available_points: number;
  pending_points: number;
  invalid_points: number;
  lifetime_points: number;
  eligible_points: number;
  earned_this_period: number;
  redeemed_points: number;
  available_cash: number;
  pending_cash: number;
  status: 'active' | 'suspended' | 'limited' | 'suspect';
}

interface RewardTransaction {
  id: string;
  points: number;
  transaction_type: string;
  created_at: string;
  metadata?: any;
}

interface RewardWithdrawal {
  id: string;
  amount: number;
  status: 'pending' | 'under_review' | 'approved' | 'processing' | 'paid' | 'rejected';
  payment_provider: string;
  payment_reference?: string;
  rejection_reason?: string;
  requested_at: string;
}

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

interface FideliteTabProps {
  profile?: UserProfile;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function formatDateFull(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateShort(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function translateTxType(type: string) {
  const types: Record<string, string> = {
    LIKE_REWARD: 'Gain pour Like',
    COMMENT_REWARD: 'Gain pour Commentaire',
    POST_REWARD: 'Gain pour Publication',
    JOURNAL_REWARD: 'Gain pour Carnet',
    GROUP_REWARD: 'Gain pour Activité de Groupe',
    QUALITY_BONUS: 'Bonus de Qualité',
    FRAUD_REVERSAL: 'Annulation (Spam / Abus)',
    ADMIN_ADJUSTMENT: 'Ajustement Administrateur',
    REDEMPTION: 'Points convertis en Cash',
    EXPIRATION: 'Points expirés',
    REFERRAL_REWARD: 'Bonus Parrainage',
    badge_unlock: 'Déblocage de Badge'
  };
  return types[type] || type;
}

function translateWithdrawalStatus(status: string) {
  const states: Record<string, string> = {
    pending: 'En attente',
    under_review: 'En cours d\'examen',
    approved: 'Approuvé',
    processing: 'En cours de virement',
    paid: 'Payé',
    rejected: 'Refusé'
  };
  return states[status] || status;
}

function getStatusBadgeStyle(status: string) {
  switch (status) {
    case 'paid':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'rejected':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'approved':
    case 'processing':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'pending':
    case 'under_review':
    default:
      return 'bg-amber-50 text-amber-700 border-amber-200';
  }
}

function getRarityColor(rarity: string) {
  switch (rarity?.toLowerCase()) {
    case 'légendaire': return 'text-purple-600';
    case 'épique': return 'text-blue-600';
    case 'rare': return 'text-[#17402C]';
    default: return 'text-[#9CA89E]';
  }
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function FideliteTab({ profile: initialProfile }: FideliteTabProps) {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');
  const [profileData, setProfileData] = useState<any>(initialProfile || null);

  // Rewards Economy States
  const [account, setAccount] = useState<RewardAccount | null>(null);
  const [transactions, setTransactions] = useState<RewardTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<RewardWithdrawal[]>([]);
  const [config, setConfig] = useState<Record<string, string>>({
    cashout_min_threshold: '20.00'
  });

  // Gamification & Badges States
  const [badgesProgress, setBadgesProgress] = useState<BadgeProgress[]>([]);
  const [badgeFilter, setBadgeFilter] = useState<'all' | 'earned' | 'locked'>('all');
  const [showAllBadgesModal, setShowAllBadgesModal] = useState(false);
  const [modalFilter, setModalFilter] = useState<'all' | 'unlocked' | 'in_progress' | 'locked'>('all');

  // Withdrawal Form States
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [paymentProvider, setPaymentProvider] = useState<'bank_transfer' | 'paypal'>('bank_transfer');
  const [iban, setIban] = useState('');
  const [bic, setBic] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);

  // Global Toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Generate unique idempotency key
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => {
    return typeof window !== 'undefined' ? newId() : '';
  });

  // ─────────────────────────────────────────────
  // Data Fetching
  // ─────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setWithdrawError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      // 1. Fetch user reward account
      const { data: raData } = await supabase
        .from('reward_accounts')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (raData) {
        setAccount(raData);
      } else {
        // Default initialized state if no account row yet
        setAccount({
          available_points: 0,
          pending_points: 0,
          invalid_points: 0,
          lifetime_points: 0,
          eligible_points: 0,
          earned_this_period: 0,
          redeemed_points: 0,
          available_cash: 0,
          pending_cash: 0,
          status: 'active'
        });
      }

      // 2. Fetch user profile (trust score, loyalty points)
      const { data: pData } = await supabase
        .from('user_profiles')
        .select('id, full_name, trust_score, loyalty_points, created_at')
        .eq('id', user.id)
        .maybeSingle();

      if (pData) {
        setProfileData(pData);
      }

      // 3. Fetch reward config
      const { data: cData } = await supabase
        .from('reward_config')
        .select('key, value');

      if (cData && Array.isArray(cData)) {
        const configMap = cData.reduce((acc: any, row: any) => {
          acc[row.key] = row.value;
          return acc;
        }, {});
        setConfig(prev => ({ ...prev, ...configMap }));
      }

      // 4. Fetch reward transactions
      const { data: tData } = await supabase
        .from('reward_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      setTransactions(tData || []);

      // 5. Fetch withdrawals
      const { data: wData } = await supabase
        .from('reward_withdrawals')
        .select('*')
        .eq('user_id', user.id)
        .order('requested_at', { ascending: false })
        .limit(10);

      setWithdrawals(wData || []);

      // 6. Fetch Badges
      let progressList: BadgeProgress[] = [];
      try {
        const { data: badgesRes, error: badgesErr } = await supabase.rpc('get_user_badges_progress', { p_user_id: user.id });
        if (!badgesErr && Array.isArray(badgesRes) && badgesRes.length > 0) {
          progressList = badgesRes as BadgeProgress[];
        } else {
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
      } catch {
        // Silently fallback
      }

      if (progressList.length === 0) {
        progressList = [
          { id: 'b1', name: 'Premier Pas', slug: 'premier-pas', description: 'Rejoindre la communauté Kit du Voyageur', icon: '🎒', category: 'Départ', rarity: 'Commun', points_reward: 50, requirement_type: 'inscription', requirement_value: 1, current_value: 1, percentage: 100, is_unlocked: true, earned_at: new Date().toISOString() },
          { id: 'b2', name: 'Explorateur Alpin', slug: 'explorateur-alpin', description: 'Randonner au-dessus de 2000m de dénivelé', icon: '🏔️', category: 'Montagne', rarity: 'Rare', points_reward: 150, requirement_type: 'dénivelé', requirement_value: 2000, current_value: 1450, percentage: 72, is_unlocked: false, earned_at: null },
          { id: 'b3', name: 'Bivouac Étoilé', slug: 'bivouac-etoile', description: 'Publier 3 récits de bivouac en pleine nature', icon: '🏕️', category: 'Camping', rarity: 'Épique', points_reward: 250, requirement_type: 'récits', requirement_value: 3, current_value: 1, percentage: 33, is_unlocked: false, earned_at: null },
          { id: 'b4', name: 'Ami des Refuges', slug: 'ami-des-refuges', description: 'Rejoindre 2 clubs d\'expédition', icon: '🏡', category: 'Communauté', rarity: 'Commun', points_reward: 100, requirement_type: 'clubs', requirement_value: 2, current_value: 2, percentage: 100, is_unlocked: true, earned_at: new Date().toISOString() },
        ];
      }

      setBadgesProgress(progressList);

    } catch (err: any) {
      console.error('FideliteTab fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─────────────────────────────────────────────
  // Withdrawal Submission
  // ─────────────────────────────────────────────
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !account) return;

    const amountNum = parseFloat(withdrawAmount);
    const minThreshold = parseFloat(config.cashout_min_threshold || '20.00');

    if (isNaN(amountNum) || amountNum <= 0) {
      setWithdrawError('Veuillez saisir un montant valide.');
      return;
    }

    if (amountNum < minThreshold) {
      setWithdrawError(`Le montant minimum de retrait est de ${minThreshold.toFixed(2)} €.`);
      return;
    }

    if (amountNum > account.available_cash) {
      setWithdrawError('Solde disponible insuffisant pour ce montant.');
      return;
    }

    setSubmittingWithdraw(true);
    setWithdrawError(null);
    setWithdrawSuccess(null);

    const metadata: Record<string, string> = {};
    if (paymentProvider === 'bank_transfer') {
      metadata.iban = iban.replace(/\s+/g, '').toUpperCase();
      metadata.bic = bic.replace(/\s+/g, '').toUpperCase();
      if (!metadata.iban || !metadata.bic) {
        setWithdrawError('Veuillez renseigner vos coordonnées bancaires (IBAN et BIC).');
        setSubmittingWithdraw(false);
        return;
      }
    } else if (paymentProvider === 'paypal') {
      metadata.paypal_email = paypalEmail.trim();
      if (!metadata.paypal_email || !metadata.paypal_email.includes('@')) {
        setWithdrawError('Veuillez spécifier une adresse email Paypal valide.');
        setSubmittingWithdraw(false);
        return;
      }
    }

    try {
      const response = await fetch('/api/rewards/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNum,
          payment_provider: paymentProvider,
          idempotency_key: idempotencyKey,
          metadata
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Erreur lors de la demande de virement.');
      }

      setWithdrawSuccess(`Votre demande de virement de ${amountNum.toFixed(2)} € a bien été enregistrée et sera traitée sous 5 jours ouvrés.`);
      showToast(`Demande de virement de ${amountNum.toFixed(2)} € envoyée !`);
      setWithdrawAmount('');
      setIban('');
      setBic('');
      setPaypalEmail('');
      setIdempotencyKey(newId());

      // Refresh real balances
      await fetchData();
    } catch (err: any) {
      setWithdrawError(err.message || 'Une erreur est survenue.');
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  // ─────────────────────────────────────────────
  // Derived Computations
  // ─────────────────────────────────────────────
  const currentPoints = account?.eligible_points || profileData?.loyalty_points || 0;
  const availableCash = account?.available_cash ?? 0;
  const pendingCash = account?.pending_cash ?? 0;
  const minThreshold = parseFloat(config.cashout_min_threshold || '20.00');

  const trustScore = profileData?.trust_score ?? 65;
  const getTrustLabel = (score: number) => {
    if (score >= 80) return 'Excellente (Créateur)';
    if (score >= 65) return 'Très bonne (Reconnu)';
    if (score >= 50) return 'Bonne (Actif)';
    if (score >= 35) return 'Moyenne (Nouveau)';
    return 'Limitée';
  };

  const unlockedBadges = badgesProgress.filter(b => b.is_unlocked);
  const totalBadges = badgesProgress.length;

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
  const pointsToNext = Math.max(0, currentLevel.max - currentPoints);

  const filteredBadges = useMemo(() => {
    if (badgeFilter === 'earned') return badgesProgress.filter(b => b.is_unlocked);
    if (badgeFilter === 'locked') return badgesProgress.filter(b => !b.is_unlocked);
    return badgesProgress;
  }, [badgesProgress, badgeFilter]);

  // ─────────────────────────────────────────────
  // Badge Modal
  // ─────────────────────────────────────────────
  const renderBadgeModal = () => {
    if (!showAllBadgesModal) return null;

    let modalBadges = badgesProgress;
    if (modalFilter === 'unlocked') modalBadges = badgesProgress.filter(b => b.is_unlocked);
    if (modalFilter === 'in_progress') modalBadges = badgesProgress.filter(b => !b.is_unlocked && b.percentage > 0);
    if (modalFilter === 'locked') modalBadges = badgesProgress.filter(b => !b.is_unlocked && b.percentage === 0);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#1C2620]/50 backdrop-blur-sm animate-fade-in">
        <div className="bg-[#F5F3ED] rounded-[1rem] w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden border border-[#E8E4D8]">
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

          <div className="px-6 py-4 bg-[#FAFAF7] border-b border-[#E8E4D8] flex gap-2 overflow-x-auto hide-scrollbar">
            <button onClick={() => setModalFilter('all')} className={`px-4 py-2 rounded-full text-xs font-700 whitespace-nowrap transition-colors ${modalFilter === 'all' ? 'bg-[#1C2620] text-white' : 'bg-white border border-[#E8E4D8] text-[#5C6B5E] hover:border-[#C8C3B0]'}`}>Tous les badges</button>
            <button onClick={() => setModalFilter('unlocked')} className={`px-4 py-2 rounded-full text-xs font-700 whitespace-nowrap transition-colors ${modalFilter === 'unlocked' ? 'bg-emerald-600 text-white' : 'bg-white border border-[#E8E4D8] text-[#5C6B5E] hover:border-[#C8C3B0]'}`}>Débloqués ✅</button>
            <button onClick={() => setModalFilter('in_progress')} className={`px-4 py-2 rounded-full text-xs font-700 whitespace-nowrap transition-colors ${modalFilter === 'in_progress' ? 'bg-amber-500 text-white' : 'bg-white border border-[#E8E4D8] text-[#5C6B5E] hover:border-[#C8C3B0]'}`}>En cours 🔄</button>
            <button onClick={() => setModalFilter('locked')} className={`px-4 py-2 rounded-full text-xs font-700 whitespace-nowrap transition-colors ${modalFilter === 'locked' ? 'bg-[#9CA89E] text-white' : 'bg-white border border-[#E8E4D8] text-[#5C6B5E] hover:border-[#C8C3B0]'}`}>Verrouillés 🔒</button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-[#F5F3ED]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {modalBadges.map(badge => (
                <div key={badge.id} className="bg-white rounded-2xl p-5 border border-[#E8E4D8] flex gap-4 items-start shadow-sm">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl ${badge.is_unlocked ? 'bg-[#F9F7EF] border border-[#E8E4D8]' : 'bg-[#FAFAF7] opacity-50 grayscale'}`}>
                    {badge.is_unlocked ? '🏆' : '🔒'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-700 text-[#1C2620] text-sm truncate">{badge.name}</h4>
                      <span className={`text-[10px] font-mono tracking-wide px-2 py-0.5 rounded-full bg-[#FAFAF7] border border-[#E8E4D8] ${getRarityColor(badge.rarity)}`}>{badge.rarity}</span>
                    </div>
                    <p className="text-xs text-[#9CA89E] mb-3 line-clamp-2">{badge.description}</p>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-semibold text-[#5C6B5E]">
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

                    <div className="mt-3 pt-2.5 border-t border-[#E8E4D8] flex justify-between items-center text-[10px] font-bold">
                      {badge.is_unlocked ? (
                        <span className="text-emerald-600">✅ Débloqué</span>
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
                <div className="col-span-1 md:col-span-2 py-12 text-center text-sm text-[#9CA89E]">
                  Aucun badge ne correspond à ce filtre.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading && !account) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-44 bg-white border border-[#E8E4D8] rounded-[1rem]" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="h-28 bg-white border border-[#E8E4D8] rounded-2xl" />
          <div className="h-28 bg-white border border-[#E8E4D8] rounded-2xl" />
          <div className="h-28 bg-white border border-[#E8E4D8] rounded-2xl" />
          <div className="h-28 bg-white border border-[#E8E4D8] rounded-2xl" />
        </div>
        <div className="h-96 bg-white border border-[#E8E4D8] rounded-[1rem]" />
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative pb-20 font-sans">

        {/* ════════════════ MAIN COLUMN ════════════════ */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* ── Header ── */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold tracking-wider uppercase bg-[#17402C]/10 text-[#17402C] border border-[#17402C]/20 rounded-full">
                  Partage de Valeur LKDV
                </span>
              </div>
              <h2 className="font-display font-900 text-3xl text-[#1C2620] tracking-tight">
                Gains <em className="font-serif font-normal not-italic text-[#5C6B5E]">& Récompenses</em>
              </h2>
              <p className="text-xs text-[#6B7A72] mt-1 max-w-xl">
                Gagnez des points grâce à vos carnets, likes et participations, et convertissez vos points en argent réel par virement bancaire ou PayPal.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button 
                onClick={() => {
                  const withdrawSection = document.getElementById('retrait-section');
                  withdrawSection?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#1C2620] hover:bg-[#2A3830] text-white rounded-full text-xs font-bold transition-all shadow-md"
              >
                <Icon name="CurrencyEuroIcon" size={15} />
                Demander un virement
              </button>
            </div>
          </div>

          {/* ── 4 Stats Grid ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#FBFAF6] border border-[#E8E4D8] rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] font-mono tracking-wider text-[#6B7A72] uppercase">Points actifs</p>
              <p className="text-2xl font-display font-900 text-[#1C2620] mt-1">
                {currentPoints} <span className="text-xs font-normal font-mono text-[#9CA89E]">PTS</span>
              </p>
              <p className="text-[10px] text-[#5C6B5E] mt-0.5">Niveau {currentLevel.num} · {currentLevel.name}</p>
            </div>

            <div className="bg-[#FBFAF6] border border-[#E8E4D8] rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] font-mono tracking-wider text-[#6B7A72] uppercase">Indice Confiance</p>
              <p className="text-sm font-bold text-[#17402C] mt-2 truncate">
                {getTrustLabel(trustScore)}
              </p>
              <p className="text-[10px] text-[#6B7A72] mt-0.5">Score : {trustScore}/100</p>
            </div>

            <div className="bg-[#FBFAF6] border border-emerald-300/60 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="absolute right-2 top-2 text-emerald-900/10 text-3xl font-bold">€</div>
              <p className="text-[10px] font-mono tracking-wider text-[#17402C] uppercase font-bold">Solde Disponible</p>
              <p className="text-2xl font-display font-900 text-[#17402C] mt-1">
                {availableCash.toFixed(2)} €
              </p>
              <p className="text-[10px] text-emerald-700 mt-0.5">Prêt au virement</p>
            </div>

            <div className="bg-[#FBFAF6] border border-[#E8E4D8] rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] font-mono tracking-wider text-[#6B7A72] uppercase">En cours de virement</p>
              <p className="text-2xl font-display font-900 text-[#1C2620]/70 mt-1">
                {pendingCash.toFixed(2)} €
              </p>
              <p className="text-[10px] text-[#9CA89E] mt-0.5">Traitement sous 5j</p>
            </div>
          </div>

          {/* ── Hero Card (Progression Niveau) ── */}
          <div className="bg-[#2A3B32] rounded-[24px] p-6 sm:p-8 text-white relative overflow-hidden flex flex-col sm:flex-row items-center gap-8 shadow-lg">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#3B5245] rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3 pointer-events-none opacity-50" />
            
            {/* Left: Circle Gauge */}
            <div className="relative w-36 h-36 flex-shrink-0">
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
                <span className="text-[9px] font-mono tracking-widest text-[#A7D3A6] mb-0.5">NIVEAU</span>
                <span className="font-display font-900 text-3xl leading-none mb-0.5">{currentLevel.num}</span>
                <span className="font-display font-700 text-base text-white">{currentPoints}</span>
                <span className="text-[8px] text-[#A7D3A6]/70">/ {currentLevel.max} pts</span>
              </div>
            </div>

            {/* Middle: Text */}
            <div className="flex-1 relative z-10 text-center sm:text-left">
              <p className="text-[10px] font-mono tracking-widest text-[#A7D3A6] uppercase mb-1">
                Statut Voyageur — {currentLevel.name}
              </p>
              <h3 className="font-display font-700 text-2xl text-white mb-2">
                {progressPercent} % vers <em className="font-serif font-normal not-italic text-[#A7D3A6]">{nextLevel?.name || 'Palier Maximum'}</em>.
              </h3>
              <p className="text-xs text-white/75 leading-relaxed max-w-md mx-auto sm:mx-0">
                {pointsToNext > 0 
                  ? `Encore ${pointsToNext} points à cumuler pour atteindre le niveau ${nextLevel?.num} et multiplier vos avantages de rémunération.`
                  : `Félicitations, vous avez atteint le rang ultime des Ambassadeurs !`
                }
              </p>
            </div>

            {/* Right: Badges Stat */}
            <div className="flex-shrink-0 relative z-10 bg-[#3B5245]/60 backdrop-blur-md rounded-2xl p-4 text-center border border-white/10 min-w-[120px]">
              <p className="text-[9px] font-mono tracking-widest uppercase text-white/70 mb-1">Badges Débloqués</p>
              <p className="font-display font-900 text-2xl text-white">{unlockedBadges.length} <span className="text-xs font-normal text-white/50">/ {totalBadges}</span></p>
            </div>
          </div>

          {/* ── CASH-OUT WITHDRAWAL SECTION ── */}
          <div id="retrait-section" className="bg-[#FBFAF6] border border-[#E8E4D8] rounded-[1rem] p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E8E4D8] pb-4 gap-2">
              <div>
                <h3 className="font-display font-900 text-[#1C2620] text-lg flex items-center gap-2">
                  <Icon name="CurrencyEuroIcon" size={20} className="text-[#17402C]" />
                  Demande de virement de vos gains
                </h3>
                <p className="text-xs text-[#6B7A72] mt-0.5">
                  Convertissez vos points en cash et recevez votre argent directement sur votre compte bancaire ou PayPal.
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-[#9CA89E] uppercase block">Disponible</span>
                <span className="font-display font-900 text-xl text-[#17402C]">{availableCash.toFixed(2)} €</span>
              </div>
            </div>

            {withdrawError && (
              <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex gap-2 items-center">
                <span className="text-base">⚠️</span>
                <span>{withdrawError}</span>
              </div>
            )}

            {withdrawSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex gap-2 items-center">
                <span className="text-base">✅</span>
                <span>{withdrawSuccess}</span>
              </div>
            )}

            <form onSubmit={handleWithdrawSubmit} className="space-y-5">
              <div>
                <label htmlFor="amount" className="block text-xs font-bold text-[#1C2620] mb-1.5 uppercase tracking-wider">
                  Montant à retirer (€)
                </label>
                <div className="relative rounded-xl shadow-sm max-w-md">
                  <input
                    type="number"
                    step="0.01"
                    name="amount"
                    id="amount"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="block w-full rounded-xl border border-[#E8E4D8] pl-4 pr-14 py-3 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#17402C] focus:border-[#17402C] bg-white"
                    placeholder={`Min. ${minThreshold.toFixed(2)}`}
                    required
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-xs text-[#6B7A72] font-mono font-bold">
                    EUR (€)
                  </div>
                </div>
                <p className="text-[10px] text-[#6B7A72] mt-1.5">
                  Seuil minimum de retrait : <strong>{minThreshold.toFixed(2)} €</strong> · Vos points sont débités instantanément lors de la validation.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1C2620] mb-1.5 uppercase tracking-wider">
                  Mode de versement
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                  <button
                    type="button"
                    onClick={() => setPaymentProvider('bank_transfer')}
                    className={`flex items-center gap-3 p-3.5 border rounded-xl transition-all text-left ${
                      paymentProvider === 'bank_transfer'
                        ? 'border-[#17402C] bg-[#17402C]/10 text-[#17402C] font-bold shadow-sm'
                        : 'border-[#E8E4D8] bg-white text-[#6B7A72] hover:bg-[#FAFAF7]'
                    }`}
                  >
                    <span className="text-xl">🏦</span>
                    <div>
                      <p className="text-xs font-bold">Virement Bancaire (SEPA)</p>
                      <p className="text-[10px] text-[#6B7A72] font-normal">RIB / IBAN européen</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentProvider('paypal')}
                    className={`flex items-center gap-3 p-3.5 border rounded-xl transition-all text-left ${
                      paymentProvider === 'paypal'
                        ? 'border-[#17402C] bg-[#17402C]/10 text-[#17402C] font-bold shadow-sm'
                        : 'border-[#E8E4D8] bg-white text-[#6B7A72] hover:bg-[#FAFAF7]'
                    }`}
                  >
                    <span className="text-xl">💳</span>
                    <div>
                      <p className="text-xs font-bold">PayPal</p>
                      <p className="text-[10px] text-[#6B7A72] font-normal">Virement direct par email</p>
                    </div>
                  </button>
                </div>
              </div>

              {paymentProvider === 'bank_transfer' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-5 rounded-2xl border border-[#E8E4D8]">
                  <div>
                    <label htmlFor="iban" className="block text-[11px] text-[#1C2620] mb-1 font-bold">
                      IBAN
                    </label>
                    <input
                      type="text"
                      id="iban"
                      value={iban}
                      onChange={(e) => setIban(e.target.value)}
                      placeholder="FR76 3000 6000 0123 4567 8901 234"
                      className="block w-full rounded-lg border border-[#E8E4D8] text-xs px-3 py-2.5 text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#17402C] bg-[#FAFAF7]"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="bic" className="block text-[11px] text-[#1C2620] mb-1 font-bold">
                      BIC / SWIFT
                    </label>
                    <input
                      type="text"
                      id="bic"
                      value={bic}
                      onChange={(e) => setBic(e.target.value)}
                      placeholder="BNPAFRPPXXX"
                      className="block w-full rounded-lg border border-[#E8E4D8] text-xs px-3 py-2.5 text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#17402C] bg-[#FAFAF7]"
                      required
                    />
                  </div>
                </div>
              )}

              {paymentProvider === 'paypal' && (
                <div className="bg-white p-5 rounded-2xl border border-[#E8E4D8]">
                  <label htmlFor="paypalEmail" className="block text-[11px] text-[#1C2620] mb-1 font-bold">
                    Adresse email du compte PayPal
                  </label>
                  <input
                    type="email"
                    id="paypalEmail"
                    value={paypalEmail}
                    onChange={(e) => setPaypalEmail(e.target.value)}
                    placeholder="votre-email@domaine.com"
                    className="block w-full max-w-md rounded-lg border border-[#E8E4D8] text-xs px-3 py-2.5 text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#17402C] bg-[#FAFAF7]"
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={submittingWithdraw || availableCash < minThreshold}
                className="px-8 py-3.5 bg-[#1C2620] text-white rounded-full text-xs font-extrabold hover:bg-[#2A3830] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
              >
                {submittingWithdraw ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Enregistrement de la demande...
                  </>
                ) : (
                  <>
                    <Icon name="ArrowRightIcon" size={14} />
                    Confirmer la demande de virement
                  </>
                )}
              </button>
            </form>
          </div>

          {/* ── DEMANDES DE VIREMENTS & HISTORIQUE DES POINTS ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Withdrawals Table */}
            <div className="bg-[#FBFAF6] border border-[#E8E4D8] rounded-[1rem] p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-800 text-[#1C2620] text-sm flex items-center gap-1.5">
                  <Icon name="CurrencyEuroIcon" size={16} className="text-[#17402C]" />
                  Demandes de virements
                </h3>
                <span className="text-[10px] font-mono text-[#9CA89E] uppercase">{withdrawals.length} demandes</span>
              </div>

              <div className="overflow-hidden border border-[#E8E4D8] rounded-2xl bg-white max-h-80 overflow-y-auto">
                {withdrawals.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#9CA89E]">
                    Aucune demande de virement pour le moment.
                  </div>
                ) : (
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-[#FAFAF7] border-b border-[#E8E4D8] text-[#6B7A72] uppercase font-mono text-[9px] tracking-wider">
                        <th className="p-3">Montant</th>
                        <th className="p-3">Méthode</th>
                        <th className="p-3 text-center">Statut</th>
                        <th className="p-3 text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E4D8]">
                      {withdrawals.map((w) => (
                        <tr key={w.id} className="hover:bg-[#FAFAF7]/60">
                          <td className="p-3 font-bold text-[#1C2620]">{w.amount.toFixed(2)} €</td>
                          <td className="p-3 text-[#6B7A72] font-mono text-[10px]">
                            {w.payment_provider === 'bank_transfer' ? 'Banque' : 'PayPal'}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${getStatusBadgeStyle(w.status)}`}>
                              {translateWithdrawalStatus(w.status)}
                            </span>
                          </td>
                          <td className="p-3 text-right text-[#9CA89E] font-mono text-[10px]">
                            {formatDateShort(w.requested_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Points Transactions Ledger */}
            <div className="bg-[#FBFAF6] border border-[#E8E4D8] rounded-[1rem] p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-800 text-[#1C2620] text-sm flex items-center gap-1.5">
                  <Icon name="ClipboardDocumentListIcon" size={16} className="text-[#17402C]" />
                  Historique des gains de points
                </h3>
                <span className="text-[10px] font-mono text-[#9CA89E] uppercase">{transactions.length} entrées</span>
              </div>

              <div className="overflow-hidden border border-[#E8E4D8] rounded-2xl bg-white max-h-80 overflow-y-auto">
                {transactions.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#9CA89E]">
                    Aucune transaction de points enregistrée.
                  </div>
                ) : (
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-[#FAFAF7] border-b border-[#E8E4D8] text-[#6B7A72] uppercase font-mono text-[9px] tracking-wider">
                        <th className="p-3">Type</th>
                        <th className="p-3 text-right">Points</th>
                        <th className="p-3 text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E4D8]">
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-[#FAFAF7]/60">
                          <td className="p-3 text-[#1C2620] font-semibold">{translateTxType(tx.transaction_type)}</td>
                          <td className={`p-3 text-right font-mono font-bold ${tx.points >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {tx.points >= 0 ? `+${tx.points}` : tx.points} PTS
                          </td>
                          <td className="p-3 text-right text-[#9CA89E] font-mono text-[10px]">
                            {formatDateShort(tx.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

          </div>

          {/* ── Vos Badges de Voyageur ── */}
          <div className="bg-[#FBFAF6] border border-[#E8E4D8] rounded-[1rem] p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h3 className="font-display font-800 text-xl text-[#1C2620]">
                  Vos <em className="font-serif font-normal not-italic text-[#5C6B5E]">badges & exploits</em>
                </h3>
                <p className="text-xs text-[#6B7A72] mt-0.5">
                  {unlockedBadges.length} badges gagnés sur {totalBadges}. Chaque étape débloque des points d'activité.
                </p>
              </div>
              <div className="flex items-center bg-[#EDEAE0] p-1 rounded-full text-xs font-semibold flex-shrink-0">
                <button onClick={() => setBadgeFilter('all')} className={`px-3.5 py-1 rounded-full transition-all ${badgeFilter === 'all' ? 'bg-white shadow-sm text-[#1C2620]' : 'text-[#6B7A72] hover:text-[#1C2620]'}`}>Tous ({totalBadges})</button>
                <button onClick={() => setBadgeFilter('earned')} className={`px-3.5 py-1 rounded-full transition-all ${badgeFilter === 'earned' ? 'bg-white shadow-sm text-[#1C2620]' : 'text-[#6B7A72] hover:text-[#1C2620]'}`}>Gagnés ({unlockedBadges.length})</button>
                <button onClick={() => setBadgeFilter('locked')} className={`px-3.5 py-1 rounded-full transition-all ${badgeFilter === 'locked' ? 'bg-white shadow-sm text-[#1C2620]' : 'text-[#6B7A72] hover:text-[#1C2620]'}`}>À débloquer</button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {filteredBadges.slice(0, 12).map((badge) => (
                <div 
                  key={badge.id}
                  className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all ${
                    badge.is_unlocked 
                      ? 'bg-white border-[#E8E4D8] shadow-sm hover:border-[#C8C3B0]' 
                      : 'bg-[#FAFAF7] border-dashed border-[#E8E4D8] opacity-60 grayscale'
                  }`}
                >
                  <span className="text-2xl mb-1.5">{badge.is_unlocked ? '🏆' : '🔒'}</span>
                  <span className="text-[11px] font-bold text-[#1C2620] text-center leading-tight mb-1 truncate w-full">{badge.name}</span>
                  <span className={`text-[9px] font-mono tracking-wide ${getRarityColor(badge.rarity)}`}>
                    +{badge.points_reward} pts
                  </span>
                </div>
              ))}
            </div>
            
            <div className="text-center pt-2">
              <button 
                onClick={() => setShowAllBadgesModal(true)}
                className="px-6 py-2 border border-[#C8C3B0] text-[#5C6B5E] hover:text-[#1C2620] hover:border-[#1C2620] rounded-full text-xs font-bold transition-all"
              >
                Voir tous les {totalBadges} badges en détail
              </button>
            </div>
          </div>

        </div>

        {/* ════════════════ SIDEBAR ════════════════ */}
        <div className="lg:col-span-4 space-y-6">

          {/* ── Échelle des niveaux ── */}
          <div className="bg-white border border-[#E8E4D8] rounded-[1rem] p-6 shadow-sm">
            <h4 className="font-display font-800 text-[#1C2620] text-base mb-1">
              Échelle <em className="font-serif font-normal not-italic text-[#5C6B5E]">des niveaux</em>
            </h4>
            <p className="text-[11px] text-[#6B7A72] mb-5 leading-relaxed">
              Le chemin depuis Curieux jusqu&apos;à Ambassadeur.
            </p>

            <div className="space-y-3">
              {levels.map((lvl) => {
                const isCurrent = lvl.num === currentLevel.num;
                const isPassed = currentPoints >= lvl.max;
                
                return (
                  <div key={lvl.num} className={`flex items-start gap-3.5 p-3 rounded-2xl transition-colors ${isCurrent ? 'bg-[#2A3B32] text-white shadow-md' : isPassed ? 'opacity-65 bg-[#FAFAF7]' : 'bg-white border border-[#E8E4D8]'}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-display font-800 text-xs flex-shrink-0 ${
                      isCurrent ? 'bg-[#3B5245] text-[#A7D3A6]' : isPassed ? 'bg-[#EDEAE0] text-[#5C6B5E]' : 'bg-white border border-[#E8E4D8] text-[#9CA89E]'
                    }`}>
                      {lvl.num}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <p className={`font-bold text-xs ${isCurrent ? 'text-white' : 'text-[#1C2620]'}`}>{lvl.name}</p>
                        <span className={`text-[10px] font-mono ${isCurrent ? 'text-[#A7D3A6]' : 'text-[#9CA89E]'}`}>
                          {lvl.min === 4000 ? '4 000+ pts' : `${lvl.min} - ${lvl.max} pts`}
                        </span>
                      </div>
                      {isCurrent && pointsToNext > 0 && (
                        <p className="text-[11px] text-[#A7D3A6] mt-1 italic leading-tight">
                          Encore {pointsToNext} pts → niveau {nextLevel?.num}
                        </p>
                      )}
                      {isPassed && (
                        <p className="text-[10px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
                          <Icon name="CheckIcon" size={11} />
                          Niveau atteint
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Guide & Règles de rémunération ── */}
          <div className="bg-white border border-[#E8E4D8] rounded-[1rem] p-6 shadow-sm space-y-4">
            <h4 className="font-display font-800 text-[#1C2620] text-base flex items-center gap-1.5">
              <Icon name="BookOpenIcon" size={18} className="text-[#17402C]" />
              Règles et Fonctionnement
            </h4>
            <div className="text-[11px] text-[#6B7A72] space-y-3 leading-relaxed">
              <p>
                <strong className="text-[#1C2620]">1. Économie Solvable :</strong> La valeur du point est adossée aux revenus réels générés par la plateforme. Plus la communauté grandit, plus le pool de récompenses distribué augmente.
              </p>
              <p>
                <strong className="text-[#1C2620]">2. Qualité du Contenu :</strong> Les carnets détaillés, photos et commentaires utiles reçoivent des multiplicateurs de points. Les messages génériques (&quot;super&quot;, &quot;cool&quot;) sont filtrés.
              </p>
              <p>
                <strong className="text-[#1C2620]">3. Délais de Virement :</strong> Les virements sont vérifiés et émis par notre équipe sous 5 jours ouvrés par virement SEPA ou PayPal.
              </p>
            </div>
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
    </>
  );
}
