'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge, Button, Card, Chip, EmptyState, ErrorState, ListItem, LoadingState, Skeleton, Tabs, type BadgeTone } from '@/components/ui';

interface LoyaltyLevel {
  name: string;
  minPoints: number;
  color: string;
  bg: string;
  tone: BadgeTone;
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
  { name: 'Explorateur', minPoints: 0, color: 'text-[color:var(--lkv-text-secondary)]', bg: 'bg-[color:var(--glass-bg-medium)] border backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset border-[color:var(--glass-border)]', tone: 'stone', badge: '🥾', perks: ['Accès au programme de fidélité', 'Newsletter exclusive'] },
  { name: 'Aventurier', minPoints: 500, color: 'text-[color:var(--lkv-success)]', bg: 'bg-[color:var(--lkv-success-bg)] border-[color:var(--lkv-success)]', tone: 'sage', badge: '🏕️', perks: ['5% de réduction sur les kits', 'Accès prioritaire aux ventes flash', 'Badge profil'] },
  { name: 'Randonneur Expert', minPoints: 1500, color: 'text-[color:var(--lkv-info)]', bg: 'bg-[color:var(--lkv-info-bg)] border-[color:var(--lkv-info)]', tone: 'info', badge: '🧗', perks: ['10% de réduction permanente', 'Livraison gratuite', 'Accès bêta nouvelles fonctionnalités'] },
  { name: 'Guide de Montagne', minPoints: 3500, color: 'text-[color:var(--sage-700)]', bg: 'bg-[color:var(--sage-50)] border-[color:var(--sage-300)]', tone: 'sage', badge: '🏔️', perks: ['15% de réduction', 'Accès partenaires exclusifs', 'Consultation équipement gratuite', 'Invitation événements'] },
  { name: 'Légende du Voyage', minPoints: 7500, color: 'text-[color:var(--lkv-warning-dark)]', bg: 'bg-[color:var(--lkv-warning-bg)] border-[color:var(--lkv-warning)]', tone: 'warn', badge: '🌍', perks: ['20% de réduction', 'Accès VIP toutes fonctionnalités', 'Cadeaux anniversaire', 'Partenariats exclusifs', 'Profil vérifié'] },
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
      console.error('Error loading loyalty data:', err);
      setError('Impossible de charger les données de fidélité.');
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  const [error, setError] = useState<string | null>(null);

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

  const pageContent = (
    <>
      {error && !loading && (
        <Card className="mx-auto mb-[var(--space-6)] max-w-7xl p-[var(--space-8)]">
          <ErrorState
            title="Impossible de charger la fidélité"
            message={error}
            onRetry={() => loadData()}
          />
        </Card>
      )}
      {!error && (
        <>
          <section className="relative overflow-hidden bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset px-[var(--space-4)] py-[var(--space-12)] text-[color:var(--lkv-text-primary)]">
            <div className="relative z-[var(--z-sticky)] mx-auto max-w-7xl">
              <div className="flex flex-col items-start justify-between gap-[var(--space-6)] lg:flex-row lg:items-center">
                <div>
                  <div className="mb-[var(--space-3)] flex items-center gap-[var(--space-3)]">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[var(--lkv-radius-md)] bg-[color:var(--lkv-warning-bg)]">
                      <Icon name="StarIcon" size={22} variant="solid" className="text-[color:var(--lkv-warning)]" />
                    </div>
                    <div>
                      <p className="font-mono text-[length:var(--lkv-text-caption)] uppercase tracking-[var(--tracking-wide)] text-[color:var(--lkv-warning)]">Phase 3 · Programme Fidélité</p>
                      <h1 className="font-display text-[length:var(--lkv-text-title-sm)] font-extrabold tracking-[var(--lkv-tracking-title)]">Programme Voyageur</h1>
                    </div>
                  </div>
                  <p className="max-w-lg text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-inverted)] opacity-60">Gagnez des points à chaque achat, partagez vos aventures et débloquez des récompenses exclusives.</p>
                </div>

                <Card tone="warn" className="w-full min-w-64 p-[var(--space-5)] lg:w-auto">
                  <div className="mb-[var(--space-2)] flex items-center justify-between">
                    <span className="font-mono text-[length:var(--lkv-text-caption)] uppercase tracking-[var(--tracking-wide)] text-[color:var(--lkv-warning-dark)]">Vos points</span>
                    <span className="text-[length:var(--lkv-text-title-sm)]">{currentLevel.badge}</span>
                  </div>
                  {!user ? (
                    <p className="text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-warning-dark)]">Connectez-vous pour voir vos points</p>
                  ) : loading ? (
                    <Skeleton className="h-10 w-32" />
                  ) : (
                    <>
                      <p className="font-display text-[length:var(--lkv-text-title-xl)] font-extrabold text-[color:var(--lkv-warning-dark)]">{formatPoints(userPoints)}</p>
                      <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-warning-dark)]">{currentLevel.name}</p>
                      {nextLevel && (
                        <div className="mt-[var(--space-3)]">
                          <div className="mb-[var(--space-1)] flex justify-between text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-warning-dark)]">
                            <span>{formatPoints(userPoints)} pts</span>
                            <span>{formatPoints(nextLevel.minPoints)} pts</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--lkv-border)]">
                            <div className="h-full rounded-full bg-[color:var(--lkv-warning)] transition-all" style={{ width: `${progressToNext}%` }} />
                          </div>
                          <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-warning-dark)]">{formatPoints(nextLevel.minPoints - userPoints)} pts pour {nextLevel.name}</p>
                        </div>
                      )}
                    </>
                  )}
                </Card>
              </div>
            </div>
          </section>

          <div className="mx-auto max-w-7xl px-[var(--space-4)] py-[var(--space-8)]">
            {/* Tabs */}
            <Tabs
              options={[
                { id: 'overview', label: "Vue d'ensemble", icon: <Icon name="HomeIcon" size={16} variant="outline" /> },
                { id: 'rewards', label: 'Récompenses', icon: <Icon name="GiftIcon" size={16} variant="outline" /> },
                { id: 'history', label: 'Historique', icon: <Icon name="ClockIcon" size={16} variant="outline" /> },
                { id: 'earn', label: 'Gagner des points', icon: <Icon name="PlusCircleIcon" size={16} variant="outline" /> },
              ]}
              value={activeTab}
              onChange={(id) => setActiveTab(id as typeof activeTab)}
              variant="scrollable"
              ariaLabel="Sections fidélité"
              className="mb-[var(--space-4)]"
            />

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-[var(--space-4)] md:space-y-[var(--space-6)]">
                <Card className="p-[var(--space-4)] md:p-[var(--space-6)]">
                  <h2 className="mb-[var(--space-4)] font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)] md:mb-[var(--space-5)]">Niveaux voyageur</h2>
                  <div className="relative">
                    <div className="absolute left-[var(--space-4)] right-[var(--space-4)] top-4 h-0.5 bg-[color:var(--lkv-border)] md:left-[var(--space-6)] md:right-[var(--space-6)] md:top-6" />
                    <div
                      className="absolute left-[var(--space-4)] top-4 h-0.5 bg-[color:var(--lkv-primary)] transition-all md:left-[var(--space-6)] md:top-6"
                      style={{ width: `${LEVELS.findIndex((l) => l.name === currentLevel.name) / (LEVELS.length - 1) * 100}%` }}
                    />
                    <div className="relative flex justify-between">
                      {LEVELS.map((level) => {
                        const isUnlocked = userPoints >= level.minPoints;
                        const isCurrent = level.name === currentLevel.name;
                        return (
                          <div key={level.name} className="flex w-16 flex-col items-center gap-[var(--space-1)] md:w-24 md:gap-[var(--space-2)]">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-[length:var(--lkv-text-body-sm)] transition-all md:h-12 md:w-12 md:text-[length:var(--lkv-text-headline)] ${isCurrent ? 'scale-110 border-[color:var(--lkv-primary)] bg-[color:var(--lkv-primary-subtle)]' : isUnlocked ? 'border-[color:var(--lkv-success)] bg-[color:var(--lkv-success-bg)]' : 'border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn opacity-40'}`}>
                              {level.badge}
                            </div>
                            <div className="text-center">
                              <p className={`text-[length:var(--lkv-text-caption-2)] font-semibold md:text-[length:var(--lkv-text-caption)] ${isCurrent ? 'text-[color:var(--lkv-primary)]' : isUnlocked ? 'text-[color:var(--lkv-text-primary)]' : 'text-[color:var(--lkv-text-muted)]'}`}>{level.name}</p>
                              <p className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{formatPoints(level.minPoints)} pts</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>

                <div className="grid grid-cols-1 gap-[var(--space-3)] md:grid-cols-2 md:gap-[var(--space-4)]">
                  <div className={`rounded-[var(--lkv-radius-card)] border p-[var(--space-4)] md:p-[var(--space-5)] ${currentLevel.bg}`}>
                    <div className="mb-[var(--space-2)] flex items-center gap-[var(--space-2)] md:mb-[var(--space-3)] md:gap-[var(--space-3)]">
                      <span className="text-[length:var(--lkv-text-title-sm)] md:text-[length:var(--lkv-text-title-xl)]">{currentLevel.badge}</span>
                      <div>
                        <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)] md:text-[length:var(--lkv-text-caption)]">Niveau actuel</p>
                        <h3 className={`font-display text-[length:var(--lkv-text-headline)] font-bold md:text-[length:var(--lkv-text-title-sm)] ${currentLevel.color}`}>{currentLevel.name}</h3>
                      </div>
                    </div>
                    <ul className="space-y-[var(--space-1)] md:space-y-[var(--space-2)]">
                      {currentLevel.perks.map((perk) => (
                        <li key={perk} className="flex items-center gap-[var(--space-1)] text-[length:var(--lkv-text-caption)] md:gap-[var(--space-2)] md:text-[length:var(--lkv-text-body-sm)]">
                          <Icon name="CheckCircleIcon" size={14} variant="solid" className="flex-shrink-0 text-[color:var(--lkv-success)]" />
                          {perk}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {nextLevel && (
                    <Card className="p-[var(--space-4)] opacity-70 md:p-[var(--space-5)]">
                      <div className="mb-[var(--space-2)] flex items-center gap-[var(--space-2)] md:mb-[var(--space-3)] md:gap-[var(--space-3)]">
                        <span className="text-[length:var(--lkv-text-title-sm)] grayscale md:text-[length:var(--lkv-text-title-xl)]">{nextLevel.badge}</span>
                        <div>
                          <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)] md:text-[length:var(--lkv-text-caption)]">Prochain niveau</p>
                          <h3 className="font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-muted)] md:text-[length:var(--lkv-text-title-sm)]">{nextLevel.name}</h3>
                          <p className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-primary)] md:text-[length:var(--lkv-text-caption)]">{formatPoints(nextLevel.minPoints - userPoints)} pts manquants</p>
                        </div>
                      </div>
                      <ul className="space-y-[var(--space-1)] md:space-y-[var(--space-2)]">
                        {nextLevel.perks.map((perk) => (
                          <li key={perk} className="flex items-center gap-[var(--space-1)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)] md:gap-[var(--space-2)] md:text-[length:var(--lkv-text-body-sm)]">
                            <Icon name="LockClosedIcon" size={12} variant="outline" className="flex-shrink-0" />
                            {perk}
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-[var(--space-2)] sm:grid-cols-4 md:gap-[var(--space-3)]">
                  {[
                    { label: 'Points gagnés', value: formatPoints(history.filter((h) => h.type === 'earned').reduce((s, h) => s + h.points, 0)), icon: 'ArrowTrendingUpIcon', color: 'text-[color:var(--lkv-success)]' },
                    { label: 'Points dépensés', value: formatPoints(Math.abs(history.filter((h) => h.type === 'spent').reduce((s, h) => s + h.points, 0))), icon: 'GiftIcon', color: 'text-[color:var(--lkv-primary)]' },
                    { label: 'Récompenses', value: String(redeemedIds.length), icon: 'TrophyIcon', color: 'text-[color:var(--lkv-warning-dark)]' },
                    { label: 'Solde actuel', value: formatPoints(userPoints), icon: 'StarIcon', color: 'text-[color:var(--lkv-info)]' },
                  ].map((stat) => (
                    <Card key={stat.label} className="p-[var(--space-3)] md:p-[var(--space-4)]">
                      <Icon name={stat.icon as string} size={16} variant="outline" className={`mb-[var(--space-1)] ${stat.color}`} />
                      <p className="font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)] md:text-[length:var(--lkv-text-title-sm)]">{stat.value}</p>
                      <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)] md:text-[length:var(--lkv-text-caption)]">{stat.label}</p>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Rewards Tab */}
            {activeTab === 'rewards' && (
              <div>
                <div className="mb-[var(--space-4)] flex flex-wrap gap-[var(--space-1)] md:mb-[var(--space-5)] md:gap-[var(--space-2)]">
                  {[
                    { id: 'all', label: 'Toutes' },
                    { id: 'discount', label: '🏷️ Réductions' },
                    { id: 'shipping', label: '📦 Livraison' },
                    { id: 'gear', label: '🎒 Matériel' },
                    { id: 'experience', label: '🌟 Expériences' },
                    { id: 'partner', label: '🤝 Partenaires' },
                  ].map((cat) => (
                    <Chip key={cat.id} selected={filterCategory === cat.id} onClick={() => setFilterCategory(cat.id)}>
                      {cat.label}
                    </Chip>
                  ))}
                </div>

                {loading ? (
                  <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2 lg:grid-cols-3 md:gap-[var(--space-4)]">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-[var(--lkv-radius-lg)] md:h-64" />)}
                  </div>
                ) : filteredRewards.length === 0 ? (
                  <EmptyState
                    icon={<Icon name="GiftIcon" size={32} variant="outline" />}
                    title="Aucune récompense disponible"
                    description="Les récompenses de cette catégorie arrivent bientôt."
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2 lg:grid-cols-3 md:gap-[var(--space-4)]">
                    {filteredRewards.map((reward) => {
                      const canAfford = userPoints >= reward.points_cost;
                      const isRedeemed = redeemedIds.includes(reward.id);
                      const isRedeeming = redeemingId === reward.id;
                      return (
                        <Card
                          key={reward.id}
                          className={`overflow-hidden p-0 transition-all ${isRedeemed ? 'border-[color:var(--lkv-success)] opacity-70' : canAfford ? 'hover:border-[color:var(--lkv-primary)]' : 'opacity-60'}`}
                        >
                          <div className="relative h-28 overflow-hidden md:h-36">
                            <img src={reward.image} alt={reward.alt} className="h-full w-full object-cover" />
                            <div className="absolute right-[var(--space-2)] top-[var(--space-2)]">
                              <Badge tone="warn" className="font-mono font-bold">
                                {formatPoints(reward.points_cost)} pts
                              </Badge>
                            </div>
                            {reward.expires_at && (
                              <div className="absolute bottom-[var(--space-2)] left-[var(--space-2)]">
                                <Badge tone="stone" className="bg-[color:var(--lkv-overlay-scrim)] text-[color:var(--lkv-text-inverted)]">
                                  Expire le {formatDate(reward.expires_at)}
                                </Badge>
                              </div>
                            )}
                          </div>
                          <div className="p-[var(--space-3)] md:p-[var(--space-4)]">
                            <h3 className="mb-0.5 text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)] md:mb-[var(--space-1)] md:text-[length:var(--lkv-text-body-sm)]">{reward.title}</h3>
                            <p className="mb-[var(--space-2)] text-[length:var(--lkv-text-caption-2)] leading-[var(--leading-relaxed)] text-[color:var(--lkv-text-muted)] md:mb-[var(--space-3)] md:text-[length:var(--lkv-text-caption)]">{reward.description}</p>
                            <div className="flex items-center justify-between gap-[var(--space-2)]">
                              <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-primary)] md:text-[length:var(--lkv-text-caption)]">Valeur: {reward.value}</span>
                              <Button
                                size="sm"
                                variant={canAfford && user && !isRedeemed && !isRedeeming ? 'primary' : 'secondary'}
                                onClick={() => handleRedeem(reward)}
                                disabled={!canAfford || isRedeemed || isRedeeming || !user}
                              >
                                {isRedeemed ? '✅ Obtenu' : isRedeeming ? '⏳...' : !user ? 'Connectez-vous' : canAfford ? 'Échanger' : 'Points insuffisants'}
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="max-w-2xl space-y-[var(--space-2)]">
                {!user ? (
                  <p className="py-[var(--space-8)] text-center text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-muted)]">Connectez-vous pour voir votre historique.</p>
                ) : loading ? (
                  <LoadingState label="Chargement de l'historique…" compact />
                ) : history.length === 0 ? (
                  <p className="py-[var(--space-8)] text-center text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-muted)]">Aucun historique de points pour l&apos;instant.</p>
                ) : (
                  history.map((entry) => (
                    <ListItem
                      key={entry.id}
                      as="div"
                      leading={
                        <span className={`flex h-8 w-8 items-center justify-center rounded-full border ${entry.type === 'earned' ? 'border-[color:var(--lkv-success)] bg-[color:var(--lkv-success-bg)] text-[color:var(--lkv-success)]' : 'border-[color:var(--lkv-danger)] bg-[color:var(--lkv-danger-bg)] text-[color:var(--lkv-danger)]'}`}>
                          <Icon name={entry.type === 'earned' ? 'ArrowTrendingUpIcon' : 'ArrowTrendingDownIcon'} size={16} variant="outline" />
                        </span>
                      }
                      title={entry.action}
                      subtitle={formatDate(entry.created_at)}
                      trailing={
                        <span className={`font-mono text-[length:var(--lkv-text-body-sm)] font-bold ${entry.type === 'earned' ? 'text-[color:var(--lkv-success)]' : 'text-[color:var(--lkv-danger)]'}`}>
                          {entry.type === 'earned' ? '+' : ''}{entry.points} pts
                        </span>
                      }
                    />
                  ))
                )}
              </div>
            )}

            {/* Earn Tab */}
            {activeTab === 'earn' && (
              <div className="space-y-[var(--space-4)] md:space-y-[var(--space-6)]">
                <div className="grid grid-cols-1 gap-[var(--space-2)] sm:grid-cols-2 lg:grid-cols-3 md:gap-[var(--space-4)]">
                  {EARN_ACTIONS.map((action) => (
                    <Card key={action.action} className="flex items-center gap-[var(--space-2)] p-[var(--space-3)] md:gap-[var(--space-3)] md:p-[var(--space-4)]">
                      <span className="text-[length:var(--lkv-text-title-sm)] md:text-[length:var(--lkv-text-title-xl)]">{action.icon}</span>
                      <div>
                        <p className="text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)] md:text-[length:var(--lkv-text-body-sm)]">{action.action}</p>
                        <p className="font-mono text-[length:var(--lkv-text-caption-2)] font-semibold text-[color:var(--lkv-primary)] md:text-[length:var(--lkv-text-caption)]">{action.points}</p>
                      </div>
                    </Card>
                  ))}
                </div>
                <Card className="bg-[color:var(--lkv-secondary)] p-[var(--space-4)] text-[color:var(--lkv-text-inverted)] md:p-[var(--space-6)]">
                  <h3 className="mb-[var(--space-1)] font-display text-[length:var(--lkv-text-headline)] font-bold md:mb-[var(--space-2)] md:text-[length:var(--lkv-text-title-sm)]">🤝 Parrainez un ami</h3>
                  <p className="mb-[var(--space-3)] text-[length:var(--lkv-text-caption)] opacity-80 md:mb-[var(--space-4)] md:text-[length:var(--lkv-text-body-sm)]">Invitez un ami à rejoindre Kit du Voyageur et gagnez 200 points chacun dès son premier achat.</p>
                  <div className="flex gap-[var(--space-1)] md:gap-[var(--space-2)]">
                    <div className="flex-1 rounded-[var(--lkv-radius-md)] bg-white/10 px-[var(--space-3)] py-[var(--space-2)] font-mono text-[length:var(--lkv-text-caption)] md:text-[length:var(--lkv-text-body-sm)]">
                      KDV-REF-{user?.id?.slice(0, 8).toUpperCase() ?? 'XXXXXXXX'}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        const code = `KDV-REF-${user?.id?.slice(0, 8).toUpperCase() ?? 'XXXXXXXX'}`;
                        navigator.clipboard?.writeText(code);
                      }}
                    >
                      Copier
                    </Button>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );

  return (
    <>
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-transparent">
          <Header />
          <main className="pt-20">
            {pageContent}
          </main>
          <Footer />
        </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          {pageContent}
        </MobilePageShell>
      </div>
    </>
  );
}

export const dynamic = 'force-dynamic';
