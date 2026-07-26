'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import NewFooterSection from '@/app/components/home/NewFooterSection';
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
      // Load rewards
      const { data: rewardsData } = await supabase.from('loyalty_rewards').select('*').eq('available', true).order('points_cost');
      setRewards(rewardsData ?? []);

      if (user) {
        // Load user points
        const { data: profile } = await supabase.from('user_profiles').select('loyalty_points').eq('id', user.id).single();
        setUserPoints(profile?.loyalty_points ?? 0);

        // Load history
        const { data: historyData } = await supabase.from('loyalty_history').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
        setHistory(historyData ?? []);

        // Load redemptions
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
      // Update points
      await supabase.from('user_profiles').update({
        loyalty_points: newPoints,
        loyalty_level: LEVELS.reduce((acc, l) => newPoints >= l.minPoints ? l : acc, LEVELS[0]).name,
      }).eq('id', user.id);

      // Record redemption
      await supabase.from('loyalty_redemptions').insert({ user_id: user.id, reward_id: reward.id, points_spent: reward.points_cost });

      // Record history
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

  return (
    <div className="min-h-screen" style={{ background: '#F5F2EC' }}>
      <Header />
      <main className="pt-20">
        <section className="relative overflow-hidden text-white py-14 px-4" style={{ background: '#1C2620' }}>
          <div className="absolute inset-0 opacity-5">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="absolute text-4xl" style={{ left: `${i * 17 % 100}%`, top: `${i * 23 % 100}%`, transform: 'rotate(15deg)' }}>⭐</div>
            ))}
          </div>
          <div className="max-w-7xl mx-auto relative">
            <nav className="flex items-center gap-2 text-xs font-mono mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
              <a href="/" className="hover:text-white transition-colors">Accueil</a>
              <span>/</span>
              <span style={{ color: '#E4501C' }}>Fidélité</span>
            </nav>
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div>
                <p className="text-xs font-mono tracking-[0.2em] uppercase mb-3" style={{ color: '#4A6741' }}>Programme Fidélité</p>
                <h1 className="font-display text-4xl md:text-5xl text-white mb-3 leading-tight" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 800 }}>
                  Programme<br /><em>Voyageur.</em>
                </h1>
                <p className="text-white/60 text-sm max-w-lg">Gagnez des points à chaque achat, partagez vos aventures et débloquez des récompenses exclusives.</p>
              </div>

              <div className="rounded-2xl p-6 min-w-64" style={{ background: 'linear-gradient(135deg, rgba(228,80,28,0.2), rgba(74,103,65,0.15))', border: '1px solid rgba(228,80,28,0.3)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase tracking-wider font-mono" style={{ color: 'rgba(255,255,255,0.6)' }}>Vos points</span>
                  <span className="text-2xl">{currentLevel.badge}</span>
                </div>
                {!user ? (
                  <p className="text-white/60 text-sm">Connectez-vous pour voir vos points</p>
                ) : loading ? (
                  <div className="h-10 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.1)' }} />
                ) : (
                  <>
                    <p className="text-4xl font-display font-800" style={{ fontFamily: 'var(--font-display)', color: '#E4501C' }}>{formatPoints(userPoints)}</p>
                    <p className="text-sm text-white/70 mt-1">{currentLevel.name}</p>
                    {nextLevel && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-white/50 mb-1">
                          <span>{formatPoints(userPoints)} pts</span>
                          <span>{formatPoints(nextLevel.minPoints)} pts</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${progressToNext}%`, background: '#E4501C' }} />
                        </div>
                        <p className="text-xs text-white/50 mt-1">{formatPoints(nextLevel.minPoints - userPoints)} pts pour {nextLevel.name}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex gap-2 mb-6 pb-4 overflow-x-auto scrollbar-hide" style={{ borderBottom: '1px solid #E8E4DA' }}>
            {[
              { id: 'overview', label: "Vue d'ensemble", icon: 'HomeIcon' },
              { id: 'rewards', label: 'Récompenses', icon: 'GiftIcon' },
              { id: 'history', label: 'Historique', icon: 'ClockIcon' },
              { id: 'earn', label: 'Gagner des points', icon: 'PlusCircleIcon' },
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all"
                style={activeTab === tab.id
                  ? { background: '#1C2620', color: '#fff' }
                  : { color: '#5C6B5E' }
                }>
                <Icon name={tab.icon as string} size={16} variant="outline" />
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="bg-card rounded-2xl border border-border p-6">
                <h2 className="text-lg font-display font-700 mb-5">Niveaux voyageur</h2>
                <div className="relative">
                  <div className="absolute top-6 left-6 right-6 h-0.5 bg-border" />
                  <div className="absolute top-6 left-6 h-0.5 bg-primary transition-all" style={{ width: `${LEVELS.findIndex((l) => l.name === currentLevel.name) / (LEVELS.length - 1) * 100}%` }} />
                  <div className="flex justify-between relative">
                    {LEVELS.map((level) => {
                      const isUnlocked = userPoints >= level.minPoints;
                      const isCurrent = level.name === currentLevel.name;
                      return (
                        <div key={level.name} className="flex flex-col items-center gap-2 w-24">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl border-2 transition-all ${isCurrent ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20 scale-110' : isUnlocked ? 'border-emerald-400 bg-emerald-50' : 'border-border bg-card opacity-40'}`}>
                            {level.badge}
                          </div>
                          <div className="text-center">
                            <p className={`text-xs font-semibold ${isCurrent ? 'text-primary' : isUnlocked ? 'text-foreground' : 'text-muted-foreground'}`}>{level.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{formatPoints(level.minPoints)} pts</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`rounded-xl border p-5 ${currentLevel.bg}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{currentLevel.badge}</span>
                    <div>
                      <p className="text-xs text-muted-foreground">Niveau actuel</p>
                      <h3 className={`font-display font-700 text-lg ${currentLevel.color}`}>{currentLevel.name}</h3>
                    </div>
                  </div>
                  <ul className="space-y-1.5">
                    {currentLevel.perks.map((perk) => (
                      <li key={perk} className="flex items-center gap-2 text-sm">
                        <Icon name="CheckCircleIcon" size={16} variant="solid" className="text-emerald-500 flex-shrink-0" />
                        {perk}
                      </li>
                    ))}
                  </ul>
                </div>
                {nextLevel && (
                  <div className="rounded-xl border border-border bg-card p-5 opacity-70">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-3xl grayscale">{nextLevel.badge}</span>
                      <div>
                        <p className="text-xs text-muted-foreground">Prochain niveau</p>
                        <h3 className="font-display font-700 text-lg text-muted-foreground">{nextLevel.name}</h3>
                        <p className="text-xs text-primary font-mono">{formatPoints(nextLevel.minPoints - userPoints)} pts manquants</p>
                      </div>
                    </div>
                    <ul className="space-y-1.5">
                      {nextLevel.perks.map((perk) => (
                        <li key={perk} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Icon name="LockClosedIcon" size={14} variant="outline" className="flex-shrink-0" />
                          {perk}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Points gagnés', value: formatPoints(history.filter((h) => h.type === 'earned').reduce((s, h) => s + h.points, 0)), icon: 'ArrowTrendingUpIcon', color: 'text-emerald-600' },
                  { label: 'Points dépensés', value: formatPoints(Math.abs(history.filter((h) => h.type === 'spent').reduce((s, h) => s + h.points, 0))), icon: 'GiftIcon', color: 'text-primary' },
                  { label: 'Récompenses', value: String(redeemedIds.length), icon: 'TrophyIcon', color: 'text-amber-600' },
                  { label: 'Solde actuel', value: formatPoints(userPoints), icon: 'StarIcon', color: 'text-blue-600' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-card rounded-xl border border-border p-4">
                    <Icon name={stat.icon as string} size={20} variant="outline" className={`${stat.color} mb-2`} />
                    <p className="text-xl font-display font-700">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'rewards' && (
            <div>
              <div className="flex flex-wrap gap-2 mb-5">
                {[
                  { id: 'all', label: 'Toutes' },
                  { id: 'discount', label: '🏷️ Réductions' },
                  { id: 'shipping', label: '📦 Livraison' },
                  { id: 'gear', label: '🎒 Matériel' },
                  { id: 'experience', label: '🌟 Expériences' },
                  { id: 'partner', label: '🤝 Partenaires' },
                ].map((cat) => (
                  <button key={cat.id} onClick={() => setFilterCategory(cat.id)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filterCategory === cat.id ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}>
                    {cat.label}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => <div key={i} className="h-64 rounded-xl bg-muted animate-pulse" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredRewards.map((reward) => {
                    const canAfford = userPoints >= reward.points_cost;
                    const isRedeemed = redeemedIds.includes(reward.id);
                    const isRedeeming = redeemingId === reward.id;
                    return (
                      <div key={reward.id} className={`bg-card rounded-xl border overflow-hidden transition-all ${isRedeemed ? 'border-emerald-300 opacity-70' : canAfford ? 'border-border hover:border-primary/40 hover:shadow-md' : 'border-border opacity-60'}`}>
                        <div className="relative h-36 overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={reward.image} alt={reward.alt} className="w-full h-full object-cover" />
                          <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-lg font-mono">
                            {formatPoints(reward.points_cost)} pts
                          </div>
                          {reward.expires_at && (
                            <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-lg">
                              Expire le {formatDate(reward.expires_at)}
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <h3 className="font-semibold text-sm mb-1">{reward.title}</h3>
                          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{reward.description}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold text-primary">Valeur: {reward.value}</span>
                            <button
                              onClick={() => handleRedeem(reward)}
                              disabled={!canAfford || isRedeemed || isRedeeming || !user}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isRedeemed ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : isRedeeming ? 'bg-primary/50 text-white' : canAfford && user ? 'bg-primary text-white hover:opacity-90' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
                            >
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

          {activeTab === 'history' && (
            <div className="max-w-2xl space-y-2">
              {!user ? (
                <p className="text-center py-8 text-muted-foreground">Connectez-vous pour voir votre historique.</p>
              ) : loading ? (
                <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}</div>
              ) : history.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Aucun historique de points pour l&apos;instant.</p>
              ) : (
                history.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${entry.type === 'earned' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                      <Icon name={entry.type === 'earned' ? 'ArrowTrendingUpIcon' : 'ArrowTrendingDownIcon'} size={16} variant="outline" className={entry.type === 'earned' ? 'text-emerald-600' : 'text-red-500'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.action}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(entry.created_at)}</p>
                    </div>
                    <span className={`text-sm font-mono font-bold flex-shrink-0 ${entry.type === 'earned' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {entry.type === 'earned' ? '+' : ''}{entry.points} pts
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'earn' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {EARN_ACTIONS.map((action) => (
                  <div key={action.action} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
                    <span className="text-3xl">{action.icon}</span>
                    <div>
                      <p className="font-semibold text-sm">{action.action}</p>
                      <p className="text-xs text-primary font-mono font-semibold">{action.points}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-gradient-to-br from-secondary to-secondary/80 rounded-2xl p-6 text-secondary-foreground">
                <h3 className="font-display font-700 text-lg mb-2">🤝 Parrainez un ami</h3>
                <p className="text-sm opacity-80 mb-4">Invitez un ami à rejoindre Kit du Voyageur et gagnez 200 points chacun dès son premier achat.</p>
                <div className="flex gap-2">
                  <div className="flex-1 bg-white/10 rounded-lg px-3 py-2 text-sm font-mono">
                    KDV-REF-{user?.id?.slice(0, 8).toUpperCase() ?? 'XXXXXXXX'}
                  </div>
                  <button
                    onClick={() => {
                      const code = `KDV-REF-${user?.id?.slice(0, 8).toUpperCase() ?? 'XXXXXXXX'}`;
                      navigator.clipboard?.writeText(code);
                    }}
                    className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                  >
                    Copier
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <NewFooterSection />
    </div>
  );
}

export const dynamic = 'force-dynamic';