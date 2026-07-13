'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Challenge {
  id: string;
  title: string;
  description: string;
  xp: number;
  category: string;
  difficulty: 'Facile' | 'Moyen' | 'Difficile' | 'Légendaire';
  total: number;
  deadline: string;
  active: boolean;
  progress?: number;
  completed?: boolean;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'Commun' | 'Rare' | 'Épique' | 'Légendaire';
  holders_count: number;
  earned?: boolean;
  earned_at?: string;
}

interface LeaderboardEntry {
  rank: number;
  username: string;
  level: string;
  xp: number;
  badges: number;
  expeditions: number;
  isCurrentUser?: boolean;
}

const RARITY_STYLES: Record<string, string> = {
  'Commun': 'border-white/20 bg-white/5',
  'Rare': 'border-blue-400/30 bg-blue-500/5',
  'Épique': 'border-purple-400/30 bg-purple-500/5',
  'Légendaire': 'border-amber-400/30 bg-amber-400/5',
};

const RARITY_TEXT: Record<string, string> = {
  'Commun': 'text-white/40',
  'Rare': 'text-blue-400',
  'Épique': 'text-purple-400',
  'Légendaire': 'text-amber-400',
};

const DIFFICULTY_STYLES: Record<string, string> = {
  'Facile': 'bg-green-500/10 text-green-400',
  'Moyen': 'bg-amber-400/10 text-amber-400',
  'Difficile': 'bg-red-500/10 text-red-400',
  'Légendaire': 'bg-purple-500/10 text-purple-400',
};

export default function GamificationPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'defis' | 'badges' | 'classement'>('defis');
  const [showEarned, setShowEarned] = useState(false);
  const [userXP, setUserXP] = useState(0);
  const [userLevel, setUserLevel] = useState(1);
  const [userBadgesCount, setUserBadgesCount] = useState(0);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load challenges
      const { data: challengesData } = await supabase.from('challenges').select('*').eq('active', true).order('xp', { ascending: false });

      // Load badges
      const { data: badgesData } = await supabase.from('badges').select('*').order('holders_count', { ascending: false });

      let userChallengesMap: Record<string, { progress: number; completed: boolean }> = {};
      let earnedBadgeIds: Set<string> = new Set();

      if (user) {
        // Load user profile for XP
        const { data: profile } = await supabase.from('user_profiles').select('xp, level').eq('id', user.id).single();
        setUserXP(profile?.xp ?? 0);
        setUserLevel(profile?.level ?? 1);

        // Load user challenges
        const { data: userChallenges } = await supabase.from('user_challenges').select('*').eq('user_id', user.id);
        userChallengesMap = Object.fromEntries((userChallenges ?? []).map((uc) => [uc.challenge_id, { progress: uc.progress, completed: uc.completed }]));

        // Load user badges
        const { data: userBadges } = await supabase.from('user_badges').select('badge_id, earned_at').eq('user_id', user.id);
        earnedBadgeIds = new Set((userBadges ?? []).map((ub) => ub.badge_id));
        setUserBadgesCount(earnedBadgeIds.size);
      }

      setChallenges((challengesData ?? []).map((c) => ({
        ...c,
        progress: userChallengesMap[c.id]?.progress ?? 0,
        completed: userChallengesMap[c.id]?.completed ?? false,
      })));

      setBadges((badgesData ?? []).map((b) => ({
        ...b,
        earned: earnedBadgeIds.has(b.id),
      })));

      // Build leaderboard from user_profiles
      const { data: topUsers } = await supabase
        .from('user_profiles')
        .select('id, full_name, xp, level, loyalty_level')
        .order('xp', { ascending: false })
        .limit(10);

      const lb: LeaderboardEntry[] = (topUsers ?? []).map((u, i) => ({
        rank: i + 1,
        username: u.full_name || 'Anonyme',
        level: u.loyalty_level || 'Explorateur',
        xp: u.xp ?? 0,
        badges: 0,
        expeditions: 0,
        isCurrentUser: u.id === user?.id,
      }));
      setLeaderboard(lb);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase, user]);

  useEffect(() => { loadData(); }, [loadData]);

  const nextLevelXP = (userLevel + 1) * 5000;
  const currentLevelXP = userLevel * 5000;
  const progress = userXP > 0 ? Math.min(((userXP - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100, 100) : 0;

  const filteredBadges = showEarned ? badges.filter((b) => b.earned) : badges;
  const completedChallenges = challenges.filter((c) => c.completed).length;

  return (
    <div className="min-h-screen bg-dark-bg text-white">
      <Header />

      <main className="pt-20">
        {/* Hero */}
        <section className="relative overflow-hidden py-14 px-4">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/8 via-dark-bg to-amber-400/5 pointer-events-none" />
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-mono mb-6" style={{ fontFamily: 'var(--font-mono)' }}>
              <Icon name="TrophyIcon" size={12} variant="outline" />
              PHASE 5 — GAMIFICATION AVANCÉE
            </div>
            <h1 className="font-display font-800 text-4xl sm:text-5xl text-white mb-4 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Chaque expédition<br />
              <span className="text-purple-400">mérite sa récompense</span>
            </h1>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Défis d&apos;expédition, badges exclusifs et classements communautaires. Progressez, partagez, inspirez.
            </p>
          </div>
        </section>

        {/* User XP Card */}
        <section className="px-4 pb-8">
          <div className="max-w-5xl mx-auto">
            <div className="bg-gradient-to-r from-purple-500/10 to-amber-400/5 border border-purple-500/20 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-amber-400 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                    {user ? (user.email?.[0] ?? 'U').toUpperCase() : '?'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-700 text-white text-lg" style={{ fontFamily: 'var(--font-display)' }}>
                        {user ? 'Vous' : 'Visiteur'}
                      </span>
                      <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full border border-purple-500/30">
                        Niveau {userLevel}
                      </span>
                    </div>
                    <p className="text-white/40 text-sm">{userBadgesCount} badges · {completedChallenges} défis complétés</p>
                  </div>
                </div>
                <div className="flex-1 w-full sm:w-auto">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white/40">Niveau actuel</span>
                    <span className="text-xs text-white/60 font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
                      {userXP.toLocaleString()} / {nextLevelXP.toLocaleString()} XP
                    </span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-3">
                    <div className="bg-gradient-to-r from-purple-500 to-amber-400 h-3 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-purple-400">Niveau {userLevel}</span>
                    <span className="text-xs text-amber-400">Niveau {userLevel + 1} →</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  {[
                    { label: 'XP Total', value: userXP.toLocaleString() },
                    { label: 'Badges', value: userBadgesCount.toString() },
                    { label: 'Défis', value: `${completedChallenges}/${challenges.length}` },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <div className="font-display font-700 text-white text-lg" style={{ fontFamily: 'var(--font-display)' }}>{stat.value}</div>
                      <div className="text-xs text-white/40">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <section className="px-4 pb-4">
          <div className="max-w-5xl mx-auto">
            <div className="flex gap-1 bg-card border border-border rounded-xl p-1 w-fit">
              {(['defis', 'badges', 'classement'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-purple-500 text-white' : 'text-white/50 hover:text-white'}`}
                >
                  {tab === 'defis' ? '🎯 Défis' : tab === 'badges' ? '🏅 Badges' : '🏆 Classement'}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-16">
          <div className="max-w-5xl mx-auto">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 rounded-2xl bg-white/5 animate-pulse" />)}
              </div>
            ) : (
              <>
                {/* DÉFIS */}
                {activeTab === 'defis' && (
                  <div className="space-y-4">
                    {challenges.length === 0 ? (
                      <div className="text-center py-12 text-white/40">
                        <Icon name="TrophyIcon" size={40} className="mx-auto mb-3 opacity-30" />
                        <p>Aucun défi disponible pour l&apos;instant</p>
                      </div>
                    ) : (
                      challenges.map((challenge) => {
                        const pct = challenge.total > 0 ? Math.min(((challenge.progress ?? 0) / challenge.total) * 100, 100) : 0;
                        return (
                          <div key={challenge.id} className={`border rounded-2xl p-5 transition-all ${challenge.completed ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/10 bg-white/3 hover:border-white/20'}`}>
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-display font-700 text-white text-base" style={{ fontFamily: 'var(--font-display)' }}>{challenge.title}</h3>
                                  {challenge.completed && <Icon name="CheckBadgeIcon" size={16} className="text-emerald-400 flex-shrink-0" />}
                                </div>
                                <p className="text-white/50 text-sm">{challenge.description}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="font-mono font-700 text-amber-400 text-lg" style={{ fontFamily: 'var(--font-mono)' }}>+{challenge.xp} XP</div>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${DIFFICULTY_STYLES[challenge.difficulty]}`}>{challenge.difficulty}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 bg-white/10 rounded-full h-2">
                                <div className={`h-2 rounded-full transition-all ${challenge.completed ? 'bg-emerald-400' : 'bg-purple-400'}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-white/40 font-mono flex-shrink-0" style={{ fontFamily: 'var(--font-mono)' }}>
                                {challenge.progress ?? 0}/{challenge.total}
                              </span>
                            </div>
                            {challenge.deadline && (
                              <p className="text-xs text-white/30 mt-2">⏰ Jusqu&apos;au {challenge.deadline}</p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* BADGES */}
                {activeTab === 'badges' && (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="font-display font-700 text-xl text-white" style={{ fontFamily: 'var(--font-display)' }}>
                        {filteredBadges.length} badge{filteredBadges.length !== 1 ? 's' : ''}
                      </h2>
                      <button
                        onClick={() => setShowEarned(!showEarned)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${showEarned ? 'bg-purple-500 text-white' : 'border border-white/20 text-white/60 hover:text-white'}`}
                      >
                        {showEarned ? 'Tous les badges' : 'Mes badges'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {filteredBadges.map((badge) => (
                        <div key={badge.id} className={`border rounded-2xl p-4 text-center transition-all ${badge.earned ? RARITY_STYLES[badge.rarity] : 'border-white/5 bg-white/2 opacity-40'}`}>
                          <div className="text-4xl mb-2">{badge.icon}</div>
                          <h3 className="font-display font-700 text-white text-sm mb-1" style={{ fontFamily: 'var(--font-display)' }}>{badge.name}</h3>
                          <p className="text-white/40 text-xs mb-2">{badge.description}</p>
                          <span className={`text-[10px] font-mono ${RARITY_TEXT[badge.rarity]}`} style={{ fontFamily: 'var(--font-mono)' }}>{badge.rarity}</span>
                          <p className="text-white/20 text-[10px] mt-1">{badge.holders_count.toLocaleString()} détenteurs</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CLASSEMENT */}
                {activeTab === 'classement' && (
                  <div>
                    <h2 className="font-display font-700 text-xl text-white mb-6" style={{ fontFamily: 'var(--font-display)' }}>Classement mondial</h2>
                    {leaderboard.length === 0 ? (
                      <div className="text-center py-12 text-white/40">
                        <Icon name="TrophyIcon" size={40} className="mx-auto mb-3 opacity-30" />
                        <p>Aucun classement disponible</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {leaderboard.map((entry) => (
                          <div key={entry.rank} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${entry.isCurrentUser ? 'border-purple-500/40 bg-purple-500/10' : 'border-white/10 bg-white/3'}`}>
                            <div className={`font-mono text-lg font-700 w-8 text-center flex-shrink-0 ${entry.rank <= 3 ? ['text-amber-400', 'text-slate-300', 'text-amber-700'][entry.rank - 1] : 'text-white/40'}`} style={{ fontFamily: 'var(--font-mono)' }}>
                              #{entry.rank}
                            </div>
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-amber-400 flex items-center justify-center text-white text-sm font-700 flex-shrink-0">
                              {entry.username[0]?.toUpperCase() ?? '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-display font-700 text-white text-sm" style={{ fontFamily: 'var(--font-display)' }}>
                                {entry.username} {entry.isCurrentUser && <span className="text-purple-400">(vous)</span>}
                              </div>
                              <div className="text-xs text-white/40">{entry.level}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono font-700 text-amber-400 text-sm" style={{ fontFamily: 'var(--font-mono)' }}>{entry.xp.toLocaleString()} XP</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
