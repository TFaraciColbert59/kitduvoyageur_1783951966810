'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface LoyaltyLevel {
  name: string;
  minPoints: number;
  color: string;
  bg: string;
  perks: string[];
  badge: string;
}

interface Reward {
  id: string;
  title: string;
  description: string;
  points_cost: number;
  category: string;
  value: string;
  available: boolean;
  image: string;
  alt: string;
  expires_at?: string;
}

interface PointsHistory {
  id: string;
  action: string;
  points: number;
  type: 'earned' | 'spent';
  created_at: string;
}

const LEVELS: LoyaltyLevel[] = [
  { name: 'Explorateur', minPoints: 0, color: 'text-stone-600', bg: 'bg-stone-100 border-stone-300', badge: '🥾', perks: ['Accès au programme de fidélité', 'Newsletter exclusive'] },
  { name: 'Aventurier', minPoints: 500, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-300', badge: '🏕️', perks: ['5% de réduction sur les kits', 'Accès prioritaire aux ventes flash', 'Badge profil'] },
  { name: 'Randonneur Expert', minPoints: 1500, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-300', badge: '🧗', perks: ['10% de réduction permanente', 'Livraison gratuite', 'Accès bêta nouvelles fonctionnalités'] },
  { name: 'Guide de Montagne', minPoints: 3500, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-300', badge: '🏔️', perks: ['15% de réduction', 'Accès partenaires exclusifs', 'Consultation équipement gratuite', 'Invitation événements'] },
  { name: 'Légende du Voyage', minPoints: 7500, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-300', badge: '🌍', perks: ['20% de réduction', 'Accès VIP toutes fonctionnalités', 'Cadeaux anniversaire', 'Partenariats exclusifs', 'Profil vérifié'] },
];

const EARN_ACTIONS = [
  { icon: '🛒', action: 'Achat', points: '1 point / 1€ dépensé' },
  { icon: '⭐', action: 'Avis produit', points: '+50 points' },
  { icon: '🤝', action: 'Parrainage', points: '+200 points' },
  { icon: '📤', action: 'Kit partagé', points: '+100 points' },
  { icon: '📸', action: 'Photo voyage', points: '+75 points' },
  { icon: '🎂', action: 'Anniversaire', points: '+150 points' },
];

export default function FidelitePage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'rewards' | 'history' | 'earn'>('overview');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [history, setHistory] = useState<PointsHistory[]>([]);
  const [userPoints, setUserPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [redeemedIds, setRedeemedIds] = useState<string[]>([]);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rewardsData } = await supabase.from('loyalty_rewards').select('*').eq('available', true).order('points_cost');
      setRewards(rewardsData ?? []);

      if (user) {
        const { data: profile } = await supabase.from('user_profiles').select('loyalty_points').eq('id', user.id).single();
        setUserPoints(profile?.loyalty_points ?? 0);

        const { data: historyData } = await supabase.from('loyalty_history').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
        setHistory(historyData ?? []);

        const { data: redemptions } = await supabase.from('loyalty_redemptions').select('reward_id').eq('user_id', user.id);
        setRedeemedIds(redemptions?.map((r) => r.reward_id) ?? []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const currentLevel = LEVELS.reduce((acc, level) => userPoints >= level.minPoints ? level : acc, LEVELS[0]);
  const nextLevel = LEVELS.find((l) => l.minPoints > userPoints);
  const progressToNext = nextLevel ? (userPoints - currentLevel.minPoints) / (nextLevel.minPoints - currentLevel.minPoints) * 100 : 100;

  const filteredRewards = rewards.filter((r) => filterCategory === 'all' || r.category === filterCategory);

  const formatPoints = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  };

  const handleRedeem = async (reward: Reward) => {
    if (!user || userPoints < reward.points_cost || redeemedIds.includes(reward.id)) return;
    setRedeemingId(reward.id);
    try {
      const newPoints = userPoints - reward.points_cost;
      await supabase.from('user_profiles').update({
        loyalty_points: newPoints,
        loyalty_level: LEVELS.reduce((acc, l) => newPoints >= l.minPoints ? l : acc, LEVELS[0]).name,
      }).eq('id', user.id);

      await supabase.from('loyalty_redemptions').insert({ user_id: user.id, reward_id: reward.id, points_spent: reward.points_cost });

      await supabase.from('loyalty_history').insert({ user_id: user.id, action: `Récompense échangée: ${reward.title}`, points: -reward.points_cost, type: 'spent' });

      setUserPoints(newPoints);
      setRedeemedIds((prev) => [...prev, reward.id]);
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setRedeemingId(null);
    }
  };

  const pageContent = (isMobile: boolean) => {
    const s = (mobile: any, desktop: any) => isMobile ? mobile : desktop;

    return (
      <>
        <section className={s('', 'bg-dark-bg text-white py-12 px-4 relative overflow-hidden')} style={s({ background: '#0B1F17', color: '#fff', padding: '20px', borderRadius: '12px', marginBottom: '16px' }, {})}>
          <div className={s('', 'absolute inset-0 opacity-5')}>
            {!isMobile && Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="absolute text-4xl" style={{ left: `${i * 17 % 100}%`, top: `${i * 23 % 100}%`, transform: 'rotate(15deg)' }}>⭐</div>
            ))}
          </div>
          <div className={s('', 'max-w-7xl mx-auto relative')}>
            <div className={s('', 'flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6')}>
              <div>
                <div className={s('flex items-center gap-2 mb-2', 'flex items-center gap-3 mb-3')}>
                  <div className={s('w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center', 'w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center')}>
                    <Icon name="StarIcon" size={s(16, 22)} variant="solid" className="text-amber-400" />
                  </div>
                  <div>
                    <p className={s('text-[9px] font-mono text-amber-400/80 tracking-widest uppercase', 'text-xs font-mono text-amber-400/80 tracking-widest uppercase')}>Phase 3 · Programme Fidélité</p>
                    <h1 className={s('text-lg font-display font-800 tracking-tight', 'text-2xl font-display font-800 tracking-tight')}>Programme Voyageur</h1>
                  </div>
                </div>
                <p className={s('text-xs text-white/60 max-w-xs', 'text-white/60 text-sm max-w-lg')}>Gagnez des points à chaque achat, partagez vos aventures et débloquez des récompenses exclusives.</p>
              </div>

              <div className={s('w-full mt-3', 'bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 rounded-2xl p-5 min-w-64')}>
                <div className={s('flex items-center justify-between mb-2', 'flex items-center justify-between mb-2')}>
                  <span className={s('text-[10px] text-white/60 uppercase tracking-wider font-mono', 'text-xs text-white/60 uppercase tracking-wider font-mono')}>Vos points</span>
                  <span className={s('text-xl', 'text-2xl')}>{currentLevel.badge}</span>
                </div>
                {!user ? (
                  <p className={s('text-xs text-white/60', 'text-white/60 text-sm')}>Connectez-vous pour voir vos points</p>
                ) : loading ? (
                  <div className={s('h-8 bg-white/10 rounded animate-pulse', 'h-10 bg-white/10 rounded animate-pulse')} />
                ) : (
                  <>
                    <p className={s('text-2xl font-display font-800 text-amber-400', 'text-4xl font-display font-800 text-amber-400')}>{formatPoints(userPoints)}</p>
                    <p className={s('text-xs text-white/70 mt-0.5', 'text-sm text-white/70 mt-1')}>{currentLevel.name}</p>
                    {nextLevel && (
                      <div className={s('mt-2', 'mt-3')}>
                        <div className={s('flex justify-between text-[10px] text-white/50 mb-0.5', 'flex justify-between text-xs text-white/50 mb-1')}>
                          <span>{formatPoints(userPoints)} pts</span>
                          <span>{formatPoints(nextLevel.minPoints)} pts</span>
                        </div>
                        <div className={s('h-1 bg-white/10 rounded-full overflow-hidden', 'h-1.5 bg-white/10 rounded-full overflow-hidden')}>
                          <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${progressToNext}%` }} />
                        </div>
                        <p className={s('text-[10px] text-white/50 mt-0.5', 'text-xs text-white/50 mt-1')}>{formatPoints(nextLevel.minPoints - userPoints)} pts pour {nextLevel.name}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className={s('', 'max-w-7xl mx-auto px-4 py-8')}>
          {/* Tabs */}
          <div className={s('flex gap-1 mb-4 overflow-x-auto scrollbar-hide', 'flex gap-2 mb-6 border-b border-border pb-4 overflow-x-auto scrollbar-hide')}>
            {[
              { id: 'overview', label: "Vue d'ensemble", icon: 'HomeIcon' },
              { id: 'rewards', label: 'Récompenses', icon: 'GiftIcon' },
              { id: 'history', label: 'Historique', icon: 'ClockIcon' },
              { id: 'earn', label: 'Gagner des points', icon: 'PlusCircleIcon' },
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={s(
                  `flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${activeTab === tab.id ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground bg-card'}`,
                  `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`
                )}>
                <Icon name={tab.icon as string} size={isMobile ? 14 : 16} variant="outline" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className={s('space-y-4', 'space-y-6')}>
              <div className={s('bg-card rounded-xl border border-border p-4', 'bg-card rounded-2xl border border-border p-6')}>
                <h2 className={s('text-base font-display font-700 mb-4', 'text-lg font-display font-700 mb-5')}>Niveaux voyageur</h2>
                <div className="relative">
                  <div className={s('absolute top-4 left-4 right-4 h-0.5 bg-border', 'absolute top-6 left-6 right-6 h-0.5 bg-border')} />
                  <div className={s('absolute top-4 left-4 h-0.5 bg-primary transition-all', 'absolute top-6 left-6 h-0.5 bg-primary transition-all')} style={{ width: `${LEVELS.findIndex((l) => l.name === currentLevel.name) / (LEVELS.length - 1) * 100}%` }} />
                  <div className={s('flex justify-between relative', 'flex justify-between relative')}>
                    {LEVELS.map((level) => {
                      const isUnlocked = userPoints >= level.minPoints;
                      const isCurrent = level.name === currentLevel.name;
                      return (
                        <div key={level.name} className={s('flex flex-col items-center gap-1 w-16', 'flex flex-col items-center gap-2 w-24')}>
                          <div className={s(`w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 transition-all ${isCurrent ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20 scale-110' : isUnlocked ? 'border-emerald-400 bg-emerald-50' : 'border-border bg-card opacity-40'}`, `w-12 h-12 rounded-full flex items-center justify-center text-xl border-2 transition-all ${isCurrent ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20 scale-110' : isUnlocked ? 'border-emerald-400 bg-emerald-50' : 'border-border bg-card opacity-40'}`)}>
                            {level.badge}
                          </div>
                          <div className="text-center">
                            <p className={s(`text-[9px] font-semibold ${isCurrent ? 'text-primary' : isUnlocked ? 'text-foreground' : 'text-muted-foreground'}`, `text-xs font-semibold ${isCurrent ? 'text-primary' : isUnlocked ? 'text-foreground' : 'text-muted-foreground'}`)}>{level.name}</p>
                            <p className={s('text-[9px] text-muted-foreground font-mono', 'text-xs text-muted-foreground font-mono')}>{formatPoints(level.minPoints)} pts</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className={s('grid grid-cols-1 gap-3', 'grid grid-cols-1 md:grid-cols-2 gap-4')}>
                <div className={s(`rounded-xl border p-4 ${currentLevel.bg}`, `rounded-xl border p-5 ${currentLevel.bg}`)}>
                  <div className={s('flex items-center gap-2 mb-2', 'flex items-center gap-3 mb-3')}>
                    <span className={s('text-2xl', 'text-3xl')}>{currentLevel.badge}</span>
                    <div>
                      <p className={s('text-[10px] text-muted-foreground', 'text-xs text-muted-foreground')}>Niveau actuel</p>
                      <h3 className={s(`font-display font-700 text-base ${currentLevel.color}`, `font-display font-700 text-lg ${currentLevel.color}`)}>{currentLevel.name}</h3>
                    </div>
                  </div>
                  <ul className={s('space-y-1', 'space-y-1.5')}>
                    {currentLevel.perks.map((perk) => (
                      <li key={perk} className={s('flex items-center gap-1.5 text-xs', 'flex items-center gap-2 text-sm')}>
                        <Icon name="CheckCircleIcon" size={s(14, 16)} variant="solid" className="text-emerald-500 flex-shrink-0" />
                        {perk}
                      </li>
                    ))}
                  </ul>
                </div>
                {nextLevel && (
                  <div className={s('rounded-xl border border-border bg-card p-4 opacity-70', 'rounded-xl border border-border bg-card p-5 opacity-70')}>
                    <div className={s('flex items-center gap-2 mb-2', 'flex items-center gap-3 mb-3')}>
                      <span className={s('text-2xl grayscale', 'text-3xl grayscale')}>{nextLevel.badge}</span>
                      <div>
                        <p className={s('text-[10px] text-muted-foreground', 'text-xs text-muted-foreground')}>Prochain niveau</p>
                        <h3 className={s('font-display font-700 text-base text-muted-foreground', 'font-display font-700 text-lg text-muted-foreground')}>{nextLevel.name}</h3>
                        <p className={s('text-[10px] text-primary font-mono', 'text-xs text-primary font-mono')}>{formatPoints(nextLevel.minPoints - userPoints)} pts manquants</p>
                      </div>
                    </div>
                    <ul className={s('space-y-1', 'space-y-1.5')}>
                      {nextLevel.perks.map((perk) => (
                        <li key={perk} className={s('flex items-center gap-1.5 text-xs text-muted-foreground', 'flex items-center gap-2 text-sm text-muted-foreground')}>
                          <Icon name="LockClosedIcon" size={s(12, 14)} variant="outline" className="flex-shrink-0" />
                          {perk}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className={s('grid grid-cols-2 gap-2', 'grid grid-cols-2 sm:grid-cols-4 gap-3')}>
                {[
                  { label: 'Points gagnés', value: formatPoints(history.filter((h) => h.type === 'earned').reduce((s, h) => s + h.points, 0)), icon: 'ArrowTrendingUpIcon', color: 'text-emerald-600' },
                  { label: 'Points dépensés', value: formatPoints(Math.abs(history.filter((h) => h.type === 'spent').reduce((s, h) => s + h.points, 0))), icon: 'GiftIcon', color: 'text-primary' },
                  { label: 'Récompenses', value: String(redeemedIds.length), icon: 'TrophyIcon', color: 'text-amber-600' },
                  { label: 'Solde actuel', value: formatPoints(userPoints), icon: 'StarIcon', color: 'text-blue-600' },
                ].map((stat) => (
                  <div key={stat.label} className={s('bg-card rounded-xl border border-border p-3', 'bg-card rounded-xl border border-border p-4')}>
                    <Icon name={stat.icon as string} size={s(16, 20)} variant="outline" className={`${stat.color} mb-1`} />
                    <p className={s('text-base font-display font-700', 'text-xl font-display font-700')}>{stat.value}</p>
                    <p className={s('text-[10px] text-muted-foreground', 'text-xs text-muted-foreground')}>{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rewards Tab */}
          {activeTab === 'rewards' && (
            <div>
              <div className={s('flex flex-wrap gap-1.5 mb-4', 'flex flex-wrap gap-2 mb-5')}>
                {[
                  { id: 'all', label: 'Toutes' },
                  { id: 'discount', label: '🏷️ Réductions' },
                  { id: 'shipping', label: '📦 Livraison' },
                  { id: 'gear', label: '🎒 Matériel' },
                  { id: 'experience', label: '🌟 Expériences' },
                  { id: 'partner', label: '🤝 Partenaires' },
                ].map((cat) => (
                  <button key={cat.id} onClick={() => setFilterCategory(cat.id)}
                    className={s(
                      `px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${filterCategory === cat.id ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`,
                      `px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filterCategory === cat.id ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`
                    )}>
                    {cat.label}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className={s('grid grid-cols-1 gap-3', 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4')}>
                  {[1, 2, 3].map((i) => <div key={i} className={s('h-48 rounded-xl bg-muted animate-pulse', 'h-64 rounded-xl bg-muted animate-pulse')} />)}
                </div>
              ) : (
                <div className={s('grid grid-cols-1 gap-3', 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4')}>
                  {filteredRewards.map((reward) => {
                    const canAfford = userPoints >= reward.points_cost;
                    const isRedeemed = redeemedIds.includes(reward.id);
                    const isRedeeming = redeemingId === reward.id;
                    return (
                      <div key={reward.id} className={s(`bg-card rounded-xl border overflow-hidden transition-all ${isRedeemed ? 'border-emerald-300 opacity-70' : canAfford ? 'border-border hover:border-primary/40' : 'border-border opacity-60'}`, `bg-card rounded-xl border overflow-hidden transition-all ${isRedeemed ? 'border-emerald-300 opacity-70' : canAfford ? 'border-border hover:border-primary/40 hover:shadow-md' : 'border-border opacity-60'}`)}>
                        <div className={s('relative h-28 overflow-hidden', 'relative h-36 overflow-hidden')}>
                          <img src={reward.image} alt={reward.alt} className="w-full h-full object-cover" />
                          <div className={s('absolute top-1.5 right-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-lg font-mono', 'absolute top-2 right-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-lg font-mono')}>
                            {formatPoints(reward.points_cost)} pts
                          </div>
                          {reward.expires_at && (
                            <div className={s('absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-lg', 'absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-lg')}>
                              Expire le {formatDate(reward.expires_at)}
                            </div>
                          )}
                        </div>
                        <div className={s('p-3', 'p-4')}>
                          <h3 className={s('font-semibold text-xs mb-0.5', 'font-semibold text-sm mb-1')}>{reward.title}</h3>
                          <p className={s('text-[10px] text-muted-foreground mb-2 leading-relaxed', 'text-xs text-muted-foreground mb-3 leading-relaxed')}>{reward.description}</p>
                          <div className={s('flex items-center justify-between', 'flex items-center justify-between')}>
                            <span className={s('text-[10px] font-mono font-bold text-primary', 'text-xs font-mono font-bold text-primary')}>Valeur: {reward.value}</span>
                            <button
                              onClick={() => handleRedeem(reward)}
                              disabled={!canAfford || isRedeemed || isRedeeming || !user}
                              className={s(
                                `px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${isRedeemed ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : isRedeeming ? 'bg-primary/50 text-white' : canAfford && user ? 'bg-primary text-white hover:opacity-90' : 'bg-muted text-muted-foreground cursor-not-allowed'}`,
                                `px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isRedeemed ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : isRedeeming ? 'bg-primary/50 text-white' : canAfford && user ? 'bg-primary text-white hover:opacity-90' : 'bg-muted text-muted-foreground cursor-not-allowed'}`
                              )}>
                              {isRedeemed ? '✅ Obtenu' : isRedeeming ? '⏳...' : !user ? 'Connectez-vous' : canAfford ? 'Échanger' : 'Points insuffisants'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className={s('space-y-1.5', 'max-w-2xl space-y-2')}>
              {!user ? (
                <p className={s('text-center py-6 text-muted-foreground text-xs', 'text-center py-8 text-muted-foreground')}>Connectez-vous pour voir votre historique.</p>
              ) : loading ? (
                <div className={s('space-y-1.5', 'space-y-2')}>{[1, 2, 3].map((i) => <div key={i} className={s('h-10 rounded-xl bg-muted animate-pulse', 'h-14 rounded-xl bg-muted animate-pulse')} />)}</div>
              ) : history.length === 0 ? (
                <p className={s('text-center py-6 text-muted-foreground text-xs', 'text-center py-8 text-muted-foreground')}>Aucun historique de points pour l&apos;instant.</p>
              ) : (
                history.map((entry) => (
                  <div key={entry.id} className={s('flex items-center gap-2 p-2.5 bg-card rounded-xl border border-border', 'flex items-center gap-3 p-3 bg-card rounded-xl border border-border')}>
                    <div className={s(`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${entry.type === 'earned' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`, `w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${entry.type === 'earned' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`)}>
                      <Icon name={entry.type === 'earned' ? 'ArrowTrendingUpIcon' : 'ArrowTrendingDownIcon'} size={s(12, 16)} variant="outline" className={entry.type === 'earned' ? 'text-emerald-600' : 'text-red-500'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={s('text-xs font-medium truncate', 'text-sm font-medium truncate')}>{entry.action}</p>
                      <p className={s('text-[10px] text-muted-foreground', 'text-xs text-muted-foreground')}>{formatDate(entry.created_at)}</p>
                    </div>
                    <span className={s(`text-xs font-mono font-bold flex-shrink-0 ${entry.type === 'earned' ? 'text-emerald-600' : 'text-red-500'}`, `text-sm font-mono font-bold flex-shrink-0 ${entry.type === 'earned' ? 'text-emerald-600' : 'text-red-500'}`)}>
                      {entry.type === 'earned' ? '+' : ''}{entry.points} pts
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Earn Tab */}
          {activeTab === 'earn' && (
            <div className={s('space-y-4', 'space-y-6')}>
              <div className={s('grid grid-cols-1 gap-2', 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4')}>
                {EARN_ACTIONS.map((action) => (
                  <div key={action.action} className={s('bg-card rounded-xl border border-border p-3 flex items-center gap-2', 'bg-card rounded-xl border border-border p-4 flex items-center gap-3')}>
                    <span className={s('text-2xl', 'text-3xl')}>{action.icon}</span>
                    <div>
                      <p className={s('font-semibold text-xs', 'font-semibold text-sm')}>{action.action}</p>
                      <p className={s('text-[10px] text-primary font-mono font-semibold', 'text-xs text-primary font-mono font-semibold')}>{action.points}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className={s('bg-gradient-to-br from-secondary to-secondary/80 rounded-xl p-4 text-secondary-foreground', 'bg-gradient-to-br from-secondary to-secondary/80 rounded-2xl p-6 text-secondary-foreground')}>
                <h3 className={s('font-display font-700 text-base mb-1', 'font-display font-700 text-lg mb-2')}>🤝 Parrainez un ami</h3>
                <p className={s('text-xs opacity-80 mb-3', 'text-sm opacity-80 mb-4')}>Invitez un ami à rejoindre Kit du Voyageur et gagnez 200 points chacun dès son premier achat.</p>
                <div className={s('flex gap-1.5', 'flex gap-2')}>
                  <div className={s('flex-1 bg-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono', 'flex-1 bg-white/10 rounded-lg px-3 py-2 text-sm font-mono')}>
                    KDV-REF-{user?.id?.slice(0, 8).toUpperCase() ?? 'XXXXXXXX'}
                  </div>
                  <button
                    onClick={() => {
                      const code = `KDV-REF-${user?.id?.slice(0, 8).toUpperCase() ?? 'XXXXXXXX'}`;
                      navigator.clipboard?.writeText(code);
                    }}
                    className={s('px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium transition-colors', 'px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors')}>
                    Copier
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  const desktopContent = (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20">
        {pageContent(false)}
      </main>
      <Footer />
    </div>
  );

  const mobileContent = (
    <div style={{ padding: '16px' }}>
      {pageContent(true)}
    </div>
  );

  return (
    <>
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
        {desktopContent}
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          {mobileContent}
        </MobilePageShell>
        
      </div>
    </>
  );
}

export const dynamic = 'force-dynamic';
