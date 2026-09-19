'use client';

import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import {
  UserProgressionProfile,
  TerritorialLeaderboard,
  TerritoryFilter,
  SkillType,
} from '@/features/progression/domain/types';

interface MaProgressionViewProps {
  initialProfile?: UserProgressionProfile;
  compact?: boolean;
}

const TERRITORY_FILTERS: { id: TerritoryFilter; label: string; icon: string }[] = [
  { id: 'around_me', label: '1 km', icon: 'map-pin' },
  { id: 'city', label: 'Ville', icon: 'navigation' },
  { id: 'region', label: 'Région', icon: 'map' },
  { id: 'country', label: 'Pays', icon: 'flag' },
  { id: 'world', label: 'Monde', icon: 'globe' },
];

export default function MaProgressionView({ initialProfile, compact = false }: MaProgressionViewProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [profile, setProfile] = useState<UserProgressionProfile | null>(initialProfile || null);
  const [selectedFilter, setSelectedFilter] = useState<TerritoryFilter>('city');
  const [leaderboard, setLeaderboard] = useState<TerritorialLeaderboard | null>(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Charger le profil si non fourni en SSR
  useEffect(() => {
    if (!profile) {
      fetch('/api/progression')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.profile) {
            setProfile(data.profile);
          }
        })
        .catch((err) => console.error('Erreur chargement progression:', err));
    }
  }, [profile]);

  // Charger le classement selon le filtre
  useEffect(() => {
    setLoadingLeaderboard(true);
    fetch(`/api/progression/leaderboard?filter=${selectedFilter}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.leaderboard) {
          setLeaderboard(data.leaderboard);
        }
      })
      .catch((err) => console.error('Erreur chargement classement:', err))
      .finally(() => setLoadingLeaderboard(false));
  }, [selectedFilter]);

  const handleFilterChange = (filter: TerritoryFilter) => {
    triggerHaptic('selection');
    setSelectedFilter(filter);
  };

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-[320px]">
        <div className="w-8 h-8 border-2 border-[var(--lkv-primary)] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-semibold text-[var(--lkv-text-primary)]">Calcul de votre cordée LKDV...</p>
      </div>
    );
  }

  const skillsList: { key: SkillType; data: typeof profile.skills.explorer }[] = [
    { key: 'explorer', data: profile.skills.explorer },
    { key: 'preparer', data: profile.skills.preparer },
    { key: 'partager', data: profile.skills.partager },
    { key: 'entraider', data: profile.skills.entraider },
  ];

  return (
    <div className={`w-full font-sans text-[var(--lkv-text-primary)] ${compact ? 'space-y-4' : 'space-y-6'}`}>
      {/* ── 1. HERO CARD : PROFIL VOYAGEUR & POINTS PERMANENTS ── */}
      <section className="glass rounded-3xl p-5 sm:p-6 shadow-sm border border-white/70 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-white/75 border border-white/80 flex items-center justify-center text-2xl shadow-xs shrink-0">
              {profile.level.level >= 10 ? '👑' : profile.level.level >= 7 ? '🧗' : profile.level.level >= 4 ? '⛰️' : '🌱'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-display font-extrabold text-[var(--lkv-text-primary)] tracking-tight">
                  {profile.level.title ?? '—'}
                </h1>
                <span className="glass-pill text-[10px] font-mono font-bold text-[var(--lkv-text-secondary)]">
                  Niveau {profile.level.level}
                </span>
              </div>
              <p className="text-xs text-[var(--lkv-text-secondary)] font-medium mt-0.5">
                {profile.displayName ?? '—'} · {profile.territory?.cityName ?? '—'}
              </p>
            </div>
          </div>

          {/* Points LKDV & Rang de Saison */}
          <div className="flex items-center gap-3 sm:text-right shrink-0">
            <div className="p-2.5 rounded-2xl bg-white/60 border border-white/80 flex-1 sm:flex-initial">
              <span className="block text-[10px] font-mono uppercase tracking-wider text-[var(--lkv-text-muted)] font-bold">
                Points LKDV à vie
              </span>
              <span className="text-xl font-extrabold text-[var(--lkv-primary)] font-mono">
                {profile.points.lifetime.toLocaleString('fr-FR')}
              </span>
            </div>

            <div className="p-2.5 rounded-2xl bg-white/60 border border-white/80 flex-1 sm:flex-initial">
              <span className="block text-[10px] font-mono uppercase tracking-wider text-[var(--lkv-text-muted)] font-bold">
                Rang saison
              </span>
              <span className="text-xl font-extrabold text-[var(--lkv-primary)] font-mono">
                #{profile.leaderboardRank ?? '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Barre de palier vers niveau suivant */}
        <div className="mt-5 pt-4 border-t border-black/5">
          <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
            <span className="text-[var(--lkv-text-secondary)]">
              {profile.level.nextLevelPoints
                ? `Progression vers le niveau ${profile.level.level + 1}`
                : profile.level.title
                  ? 'Sommet atteint · Niveau maximum'
                  : 'Seuils de niveau indisponibles'}
            </span>
            <span className="font-mono font-bold text-[var(--lkv-text-primary)]">
              {profile.level.progressPct}%
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={profile.level.progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progression du niveau"
            className="w-full h-3 rounded-full bg-black/5 overflow-hidden p-0.5 border border-white/60"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#17402C] to-[#365233] transition-all duration-500 ease-out"
              style={{ width: `${Math.max(4, profile.level.progressPct)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-[var(--lkv-text-muted)] mt-1 font-mono">
            <span>{profile.points.lifetime} pts</span>
            <span>{profile.level.nextLevelPoints ? `${profile.level.nextLevelPoints} pts` : '—'}</span>
          </div>
        </div>
      </section>

      {/* ── 2. LES 4 COMPÉTENCES TRANSVERSES (Explorer, Préparer, Partager, Entraider) ── */}
      <section className="glass rounded-3xl p-5 sm:p-6 shadow-sm border border-white/70">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-display font-bold text-[var(--lkv-text-primary)]">
              Vos 4 compétences de cordée
            </h2>
            <p className="text-xs text-[var(--lkv-text-secondary)] mt-0.5">
              Chaque action sur LKDV nourrit une ou plusieurs compétences selon sa valeur réelle.
            </p>
          </div>
          <span className="glass-pill text-[10px] font-mono font-bold text-[var(--lkv-text-primary)] shrink-0">
            Ventilation 100%
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {skillsList.map(({ key, data }) => (
            <div
              key={key}
              className="p-3.5 rounded-2xl bg-white/60 border border-white/80 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-[var(--lkv-primary)] shadow-2xs">
                    <Icon name={data.icon} size={15} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[var(--lkv-text-primary)] leading-none">
                      {data.label}
                    </h3>
                    <span className="text-[10px] text-[var(--lkv-text-muted)] font-mono">
                      {data.points} pts LKDV
                    </span>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-[var(--lkv-primary)]">
                  {data.pct}%
                </span>
              </div>

              <div
                role="progressbar"
                aria-valuenow={data.pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Compétence ${data.label}`}
                className="w-full h-2 rounded-full bg-black/5 overflow-hidden"
              >
                <div
                  className="h-full rounded-full bg-[#17402C] transition-all duration-500"
                  style={{ width: `${Math.max(3, data.pct)}%` }}
                />
              </div>

              <p className="text-[10.5px] text-[var(--lkv-text-muted)] mt-2 line-clamp-1">
                {data.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3. PROCHAIN DÉFI ACTIF ── */}
      {profile.challenge && (
        <section className="glass rounded-3xl p-5 sm:p-6 shadow-sm border border-white/70">
          <div className="flex items-center justify-between mb-3">
            <span className="glass-pill text-[9.5px] font-mono font-bold uppercase tracking-widest text-[var(--lkv-text-secondary)]">
              🎯 Prochain défi d’expédition
            </span>
            <span className="glass-pill text-[10px] font-mono font-bold text-[var(--lkv-primary)]">
              +{profile.challenge.pointsReward} pts
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-display font-bold text-[var(--lkv-text-primary)]">
                {profile.challenge.title}
              </h3>
              <p className="text-xs text-[var(--lkv-text-secondary)] leading-relaxed max-w-lg">
                {profile.challenge.description}
              </p>
            </div>

            <span className="text-[11px] text-[var(--lkv-text-muted)] font-mono shrink-0">
              {profile.challenge.currentProgress}/{profile.challenge.targetProgress} {profile.challenge.unit}
            </span>
          </div>
        </section>
      )}

      {/* ── 4. CLASSEMENTS TERRITORIAUX (5 Filtres : 1 km, ville, région, pays, monde) ── */}
      <section className="glass rounded-3xl p-5 sm:p-6 shadow-sm border border-white/70">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-display font-bold text-[var(--lkv-text-primary)]">
                Classement territorial
              </h2>
            </div>
            <p className="text-xs text-[var(--lkv-text-secondary)] mt-0.5">
              Classement sur la saison en cours, selon votre territoire déclaré.
            </p>
          </div>
        </div>

        {/* Sélecteur horizontal des 5 filtres territoriaux */}
        <div
          role="tablist"
          aria-label="Filtres de classement territorial"
          className="glass-capsule-bar overflow-x-auto no-scrollbar p-1 mb-5"
        >
          <div className="flex items-center gap-1 min-w-max">
            {TERRITORY_FILTERS.map((f) => {
              const isSelected = selectedFilter === f.id;
              return (
                <button
                  key={f.id}
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => handleFilterChange(f.id)}
                  className={`glass-capsule-segment !min-h-[44px] px-3.5 text-xs font-bold transition-all cursor-pointer ${
                    isSelected ? 'active text-white' : 'text-[var(--lkv-text-secondary)]'
                  }`}
                >
                  <Icon name={f.icon} size={13} />
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* État : Communauté en formation (< 5 participants) */}
        {leaderboard?.communityForming && (
          <div className="p-4 sm:p-5 rounded-2xl bg-white/70 border border-white/80 text-center mb-5 space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-[#17402C]/10 text-[#17402C] flex items-center justify-center mx-auto text-lg">
              🌱
            </div>
            <h4 className="text-sm font-bold text-[var(--lkv-text-primary)]">
              Communauté en formation dans cette zone
            </h4>
            <p className="text-xs text-[var(--lkv-text-muted)] max-w-md mx-auto leading-relaxed">
              Il y a actuellement moins de {leaderboard.minParticipants} explorateurs actifs dans ce périmètre.
              Soyez le premier à poser votre trace ou élargissez votre vue !
            </p>
          </div>
        )}

        {/* Liste des participants du classement */}
        <div className="space-y-2">
          {loadingLeaderboard ? (
            <div className="py-8 text-center text-xs text-[var(--lkv-text-muted)] font-medium">
              Chargement du classement...
            </div>
          ) : leaderboard?.rows && leaderboard.rows.length > 0 ? (
            leaderboard.rows.map((entry) => {
              const isCurrentUser = entry.isCurrentUser;
              const medal =
                entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : null;

              return (
                <div
                  key={`${selectedFilter}-${entry.rank}`}
                  className={`flex items-center justify-between p-3 sm:p-3.5 rounded-2xl transition-all border ${
                    isCurrentUser
                      ? 'bg-white/95 border-[var(--lkv-primary)] shadow-sm ring-1 ring-[var(--lkv-primary)]/20'
                      : 'bg-white/55 border-white/70 hover:bg-white/75'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Rang ou Médaille */}
                    <div className="w-8 h-8 rounded-xl bg-white/90 border border-white flex items-center justify-center text-xs font-bold font-mono shrink-0 shadow-2xs">
                      {medal ?? `#${entry.rank}`}
                    </div>

                    {/* Infos du voyageur */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs font-bold truncate ${isCurrentUser ? 'text-[var(--lkv-primary)]' : 'text-[var(--lkv-text-primary)]'}`}>
                          {entry.alias ?? '—'} {isCurrentUser ? '(Vous)' : ''}
                        </span>
                      </div>
                      <span className="text-[10.5px] text-[var(--lkv-text-muted)] block">
                        {entry.level !== null ? `Niv. ${entry.level}` : 'Niveau —'}
                        {entry.levelTitle ? ` · ${entry.levelTitle}` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Points de saison */}
                  <div className="text-right shrink-0">
                    <span className="text-xs sm:text-sm font-extrabold font-mono text-[var(--lkv-primary)] block">
                      {entry.seasonPoints.toLocaleString('fr-FR')} pts
                    </span>
                    <span className="text-[9.5px] text-[var(--lkv-text-muted)] font-mono">
                      saison en cours
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-6 text-center text-xs text-[var(--lkv-text-muted)] italic">
              Aucun participant pour ce filtre actuellement.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
