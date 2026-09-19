'use client';

import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import {
  UserProgressionProfile,
  LeaderboardResult,
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
  const [leaderboard, setLeaderboard] = useState<LeaderboardResult | null>(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [replacingChallenge, setReplacingChallenge] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [territoryModalOpen, setTerritoryModalOpen] = useState(false);
  const [cityNameInput, setCityNameInput] = useState('');
  const [regionNameInput, setRegionNameInput] = useState('');
  const [postalCodeInput, setPostalCodeInput] = useState('');
  const [updatingTerritory, setUpdatingTerritory] = useState(false);

  // Charger le profil si non fourni en SSR
  useEffect(() => {
    if (!profile) {
      fetch('/api/progression')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.profile) {
            setProfile(data.profile);
            setCityNameInput(data.profile.territory?.cityName || '');
            setRegionNameInput(data.profile.territory?.regionName || '');
            setPostalCodeInput(data.profile.territory?.postalCode || '');
          }
        })
        .catch((err) => console.error('Erreur chargement progression:', err));
    } else {
      setCityNameInput(profile.territory?.cityName || '');
      setRegionNameInput(profile.territory?.regionName || '');
      setPostalCodeInput(profile.territory?.postalCode || '');
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

  const handleReplaceChallenge = async () => {
    if (replacingChallenge) return;
    triggerHaptic('light');
    setReplacingChallenge(true);
    setFeedbackMessage(null);

    try {
      const res = await fetch('/api/progression/challenge/replace', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.challenge && profile) {
        triggerHaptic('success');
        setProfile({
          ...profile,
          currentChallenge: data.challenge,
        });
        setFeedbackMessage('Nouveau défi attribué ! Bon courage sur les sentiers.');
      } else {
        setFeedbackMessage(data.error || 'Impossible de remplacer le défi pour le moment.');
      }
    } catch (_err) {
      setFeedbackMessage('Erreur réseau lors du remplacement de défi.');
    } finally {
      setReplacingChallenge(false);
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
  };

  const handleSaveTerritory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityNameInput || !regionNameInput) return;
    setUpdatingTerritory(true);
    triggerHaptic('selection');

    try {
      const res = await fetch('/api/progression/territory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cityName: cityNameInput,
          regionName: regionNameInput,
          postalCode: postalCodeInput,
        }),
      });
      const data = await res.json();
      if (data.success && profile) {
        triggerHaptic('success');
        setProfile({
          ...profile,
          territory: {
            ...profile.territory,
            cityName: cityNameInput,
            regionName: regionNameInput,
            postalCode: postalCodeInput,
            territoryLockUntil: data.lockUntil,
            canUpdateTerritory: false,
          },
        });
        setTerritoryModalOpen(false);
        setFeedbackMessage('Territoire mis à jour avec succès (verrouillé 30 jours).');
      } else {
        setFeedbackMessage(data.error || 'Échec de la mise à jour.');
      }
    } catch (_e) {
      setFeedbackMessage('Erreur réseau lors de la mise à jour.');
    } finally {
      setUpdatingTerritory(false);
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
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
      {/* Message Toast / Feedback */}
      {feedbackMessage && (
        <div
          role="status"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[1100] px-4 py-2.5 rounded-full glass bg-[#17402C] text-white text-xs font-semibold shadow-lg animate-fade-in"
        >
          {feedbackMessage}
        </div>
      )}

      {/* ── 1. HERO CARD : PROFIL VOYAGEUR & POINTS PERMANENTS ── */}
      <section className="glass rounded-3xl p-5 sm:p-6 shadow-sm border border-white/70 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-white/75 border border-white/80 flex items-center justify-center text-2xl shadow-xs shrink-0">
              {profile.level >= 10 ? '👑' : profile.level >= 7 ? '🧗' : profile.level >= 4 ? '⛰️' : '🌱'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-display font-extrabold text-[var(--lkv-text-primary)] tracking-tight">
                  {profile.levelTitle}
                </h1>
                <span className="glass-pill text-[10px] font-mono font-bold text-[var(--lkv-text-secondary)]">
                  Niveau {profile.level}
                </span>
              </div>
              <p className="text-xs text-[var(--lkv-text-secondary)] font-medium mt-0.5">
                {profile.displayName} · {profile.territory.cityName || 'France'}
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
                {profile.lifetimePoints.toLocaleString('fr-FR')}
              </span>
            </div>

            <div className="p-2.5 rounded-2xl bg-white/60 border border-white/80 flex-1 sm:flex-initial">
              <span className="block text-[10px] font-mono uppercase tracking-wider text-[var(--lkv-text-muted)] font-bold">
                Rang saison
              </span>
              <span className="text-xl font-extrabold text-[var(--lkv-primary)] font-mono">
                #{profile.localRank ?? '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Barre de palier vers niveau suivant */}
        <div className="mt-5 pt-4 border-t border-black/5">
          <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
            <span className="text-[var(--lkv-text-secondary)]">
              {profile.nextLevelPoints
                ? `Progression vers le niveau ${profile.level + 1}`
                : 'Sommet atteint · Niveau maximum'}
            </span>
            <span className="font-mono font-bold text-[var(--lkv-text-primary)]">
              {profile.levelProgressPct}%
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={profile.levelProgressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progression du niveau"
            className="w-full h-3 rounded-full bg-black/5 overflow-hidden p-0.5 border border-white/60"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#17402C] to-[#365233] transition-all duration-500 ease-out"
              style={{ width: `${Math.max(4, profile.levelProgressPct)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-[var(--lkv-text-muted)] mt-1 font-mono">
            <span>{profile.lifetimePoints} pts</span>
            <span>{profile.nextLevelPoints ? `${profile.nextLevelPoints} pts` : '20 000+ pts'}</span>
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

      {/* ── 3. PROCHAIN DÉFI ACTIF (Avec possibilité de remplacement hebdomadaire) ── */}
      {profile.currentChallenge && (
        <section className="glass rounded-3xl p-5 sm:p-6 shadow-sm border border-white/70">
          <div className="flex items-center justify-between mb-3">
            <span className="glass-pill text-[9.5px] font-mono font-bold uppercase tracking-widest text-[var(--lkv-text-secondary)]">
              🎯 Prochain défi d’expédition
            </span>
            <span className="glass-pill text-[10px] font-mono font-bold text-[var(--lkv-primary)]">
              +{profile.currentChallenge.pointsReward} pts
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-display font-bold text-[var(--lkv-text-primary)]">
                {profile.currentChallenge.title}
              </h3>
              <p className="text-xs text-[var(--lkv-text-secondary)] leading-relaxed max-w-lg">
                {profile.currentChallenge.description}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {profile.currentChallenge.canBeReplaced ? (
                <button
                  type="button"
                  onClick={handleReplaceChallenge}
                  disabled={replacingChallenge}
                  className="glass-capsule-btn !min-h-[44px] px-4 text-xs font-semibold text-[var(--lkv-text-secondary)] cursor-pointer active:scale-95 disabled:opacity-50"
                  aria-label="Remplacer ce défi par un autre"
                >
                  <Icon name="refresh-cw" size={13} className={replacingChallenge ? 'animate-spin' : ''} />
                  <span>{replacingChallenge ? 'Remplacement...' : 'Remplacer (1/semaine)'}</span>
                </button>
              ) : (
                <span className="text-[11px] text-[var(--lkv-text-muted)] font-mono italic">
                  Défi verrouillé cette semaine
                </span>
              )}
            </div>
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
              <span className="glass-pill text-[9.5px] font-mono font-bold text-[var(--lkv-text-muted)]">
                {profile.activeSeason.name}
              </span>
            </div>
            <p className="text-xs text-[var(--lkv-text-secondary)] mt-0.5">
              {leaderboard?.territoryLabel || 'Classement local sur les 8 semaines de saison.'}
            </p>
          </div>

          {/* Bouton modifier mon territoire (avec verrou de 30 jours) */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setTerritoryModalOpen(true);
            }}
            className="glass-capsule-btn !min-h-[44px] px-3.5 text-xs font-bold self-start sm:self-auto cursor-pointer active:scale-95"
            aria-label="Modifier mon rattachement territorial"
          >
            <Icon name="map-pin" size={13} />
            <span>Mon territoire</span>
          </button>
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
              Il y a actuellement moins de 5 explorateurs actifs dans ce périmètre.
              Soyez le premier à poser votre trace ou élargissez votre vue !
            </p>
            {leaderboard.suggestedFallbackFilter && (
              <button
                type="button"
                onClick={() => handleFilterChange(leaderboard.suggestedFallbackFilter!)}
                className="glass-capsule-btn primary !min-h-[44px] px-4 text-xs font-bold shadow-xs mt-2 cursor-pointer active:scale-95"
              >
                Voir le classement {leaderboard.suggestedFallbackFilter === 'city' ? 'Ville' : leaderboard.suggestedFallbackFilter === 'region' ? 'Région' : 'National'} →
              </button>
            )}
          </div>
        )}

        {/* Liste des participants du classement */}
        <div className="space-y-2">
          {loadingLeaderboard ? (
            <div className="py-8 text-center text-xs text-[var(--lkv-text-muted)] font-medium">
              Chargement du classement...
            </div>
          ) : leaderboard?.entries && leaderboard.entries.length > 0 ? (
            leaderboard.entries.map((entry) => {
              const isCurrentUser = entry.isCurrentUser;
              const medal =
                entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : null;

              return (
                <div
                  key={entry.userId}
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
                          {entry.displayName} {isCurrentUser ? '(Vous)' : ''}
                        </span>
                        {entry.distinction && (
                          <span className="glass-pill text-[9px] font-mono text-[var(--lkv-text-secondary)]">
                            {entry.distinction}
                          </span>
                        )}
                      </div>
                      <span className="text-[10.5px] text-[var(--lkv-text-muted)] block">
                        Niv. {entry.level} · {entry.levelTitle}
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

      {/* ── 5. MODALE RATTACHEMENT TERRITORIAL (Verrou anti-abus 30 jours) ── */}
      {territoryModalOpen && (
        <div className="fixed inset-0 z-[1200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass rounded-3xl p-6 w-full max-w-md shadow-2xl border border-white/80 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-2 border-b border-black/5">
              <h3 className="font-display font-bold text-lg text-[var(--lkv-text-primary)]">
                Rattachement territorial
              </h3>
              <button
                type="button"
                onClick={() => setTerritoryModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/70 hover:bg-white flex items-center justify-center text-xs cursor-pointer"
                aria-label="Fermer la modale"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[var(--lkv-text-secondary)] leading-relaxed">
              Votre ville et votre région déterminent vos classements locaux. Pour garantir l’équité
              sportive des saisons, tout changement est verrouillé pour une durée de 30 jours.
            </p>

            {profile.territory.territoryLockUntil && !profile.territory.canUpdateTerritory ? (
              <div className="p-3.5 rounded-2xl bg-[var(--lkv-warning-dark)]/10 border border-[var(--lkv-warning-dark)]/30 text-xs text-[var(--lkv-warning-dark)] font-medium">
                ⚠️ Modification temporairement verrouillée jusqu’au{' '}
                {new Date(profile.territory.territoryLockUntil).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}.
              </div>
            ) : (
              <form onSubmit={handleSaveTerritory} className="space-y-3">
                <div>
                  <label htmlFor="city-input" className="block text-xs font-semibold text-[var(--lkv-text-primary)] mb-1">
                    Ville principale
                  </label>
                  <input
                    id="city-input"
                    type="text"
                    value={cityNameInput}
                    onChange={(e) => setCityNameInput(e.target.value)}
                    required
                    placeholder="Ex: Chamonix-Mont-Blanc"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-white/80 border border-white/90 text-xs font-medium text-[var(--lkv-text-primary)] focus:outline-2 focus:outline-[var(--lkv-primary)]"
                  />
                </div>

                <div>
                  <label htmlFor="region-input" className="block text-xs font-semibold text-[var(--lkv-text-primary)] mb-1">
                    Région
                  </label>
                  <input
                    id="region-input"
                    type="text"
                    value={regionNameInput}
                    onChange={(e) => setRegionNameInput(e.target.value)}
                    required
                    placeholder="Ex: Auvergne-Rhône-Alpes"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-white/80 border border-white/90 text-xs font-medium text-[var(--lkv-text-primary)] focus:outline-2 focus:outline-[var(--lkv-primary)]"
                  />
                </div>

                <div>
                  <label htmlFor="postal-input" className="block text-xs font-semibold text-[var(--lkv-text-primary)] mb-1">
                    Code postal (facultatif)
                  </label>
                  <input
                    id="postal-input"
                    type="text"
                    value={postalCodeInput}
                    onChange={(e) => setPostalCodeInput(e.target.value)}
                    placeholder="Ex: 74400"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-white/80 border border-white/90 text-xs font-medium text-[var(--lkv-text-primary)] focus:outline-2 focus:outline-[var(--lkv-primary)]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-black/5">
                  <button
                    type="button"
                    onClick={() => setTerritoryModalOpen(false)}
                    className="glass-capsule-btn !min-h-[44px] px-4 text-xs font-semibold cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={updatingTerritory}
                    className="glass-capsule-btn primary !min-h-[44px] px-5 text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {updatingTerritory ? 'Enregistrement...' : 'Confirmer le rattachement'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
