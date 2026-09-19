'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Award, ChevronDown, Gift, Target, Trophy } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { createClient } from '@/lib/supabase/client';
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

/** Raisons honnêtes d'indisponibilité renvoyées par la RPC de classement. */
const LEADERBOARD_REASONS: Record<string, string> = {
  flag_off: 'fonctionnalité localisation désactivée',
  no_private_attachment: 'aucun rattachement privé enregistré',
  rpc_unavailable: 'service de classement indisponible',
};

const GAIN_TYPE_LABELS: Record<string, string> = {
  like: 'Like reçu',
  comment: 'Commentaire',
  post: 'Publication',
  carnet: 'Carnet publié',
  message: 'Message de groupe',
  referral: 'Parrainage',
  admin: 'Attribution manuelle',
  PROGRESSION_AWARD: 'Progression',
  hike_session: 'Session de randonnée',
  trail_prep: 'Sentier préparé',
  kit_report: 'Débrief de kit',
  place_review: 'Avis de lieu',
};

interface EarnedDistinction {
  id: string;
  name: string;
  icon: string | null;
  earnedAt: string | null;
}

interface GainRow {
  id: string;
  points: number;
  label: string;
  createdAt: string;
}

type ClientDataStatus = 'loading' | 'ready' | 'unavailable';

interface DistinctionsState {
  status: ClientDataStatus;
  items: EarnedDistinction[];
}

interface GainsState {
  status: ClientDataStatus;
  items: GainRow[];
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function reasonLabel(reason: string | null | undefined): string {
  if (!reason) return 'indisponible';
  return LEADERBOARD_REASONS[reason] ?? 'indisponible';
}

function gainLabel(type: string): string {
  if (!type) return 'Gain';
  return GAIN_TYPE_LABELS[type] ?? type.replace(/_/g, ' ');
}

/** Section détaillée repliée par défaut (divulgation progressive accessible). */
function ProgressionSection({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details className="glass group rounded-3xl border border-white/70 shadow-sm">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 rounded-3xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)] sm:p-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block font-display text-base font-bold text-[var(--lkv-text-primary)]">
            {title}
          </span>
          <span className="mt-0.5 block text-xs text-[var(--lkv-text-secondary)]">
            {summary}
          </span>
        </span>
        <ChevronDown
          size={16}
          className="shrink-0 text-[var(--lkv-text-muted)] transition-transform group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </summary>
      <div className="border-t border-black/5 p-4 pt-3 sm:p-5 sm:pt-3">{children}</div>
    </details>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/80 bg-white/60 px-3 py-2">
      <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--lkv-text-muted)]">
        {label}
      </span>
      <span className="font-mono text-lg font-extrabold tabular-nums text-[var(--lkv-primary)]">
        {value}
      </span>
    </div>
  );
}

function SummaryChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 max-w-full items-center gap-2 rounded-2xl border border-white/80 bg-white/60 px-3 py-2">
      <span className="shrink-0 text-[var(--lkv-secondary)]" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--lkv-text-muted)]">
          {label}
        </span>
        <span className="block truncate text-xs font-bold text-[var(--lkv-text-primary)]">
          {value}
        </span>
      </span>
    </div>
  );
}

export default function MaProgressionView({ initialProfile, compact = false }: MaProgressionViewProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [profile, setProfile] = useState<UserProgressionProfile | null>(initialProfile || null);
  const [selectedFilter, setSelectedFilter] = useState<TerritoryFilter>('city');
  const [leaderboard, setLeaderboard] = useState<TerritorialLeaderboard | null>(null);
  const [leaderboardUnavailable, setLeaderboardUnavailable] = useState(false);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [distinctions, setDistinctions] = useState<DistinctionsState>({
    status: 'loading',
    items: [],
  });
  const [gains, setGains] = useState<GainsState>({ status: 'loading', items: [] });

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
    let alive = true;
    setLoadingLeaderboard(true);
    setLeaderboardUnavailable(false);
    fetch(`/api/progression/leaderboard?filter=${selectedFilter}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`leaderboard_${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!alive) return;
        if (data.success && data.leaderboard) {
          setLeaderboard(data.leaderboard);
        } else {
          setLeaderboardUnavailable(true);
        }
      })
      .catch((err) => {
        if (!alive) return;
        console.error('Erreur chargement classement:', err);
        setLeaderboardUnavailable(true);
      })
      .finally(() => {
        if (alive) setLoadingLeaderboard(false);
      });
    return () => {
      alive = false;
    };
  }, [selectedFilter]);

  // Distinctions (badges historiques réels) + historique de gains (ledger réel).
  // Lecture client sous RLS (le propriétaire uniquement) — zéro donnée simulée.
  useEffect(() => {
    let alive = true;
    const supabase = createClient();

    async function loadAccountData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (alive) {
            setDistinctions({ status: 'unavailable', items: [] });
            setGains({ status: 'unavailable', items: [] });
          }
          return;
        }

        const [badgesRes, gainsRes] = await Promise.all([
          supabase
            .from('user_badges')
            .select('badge_id, earned_at, badges(name, icon)')
            .eq('user_id', user.id)
            .order('earned_at', { ascending: false })
            .limit(12),
          supabase
            .from('reward_transactions')
            .select('id, points, transaction_type, created_at')
            .eq('user_id', user.id)
            .gt('points', 0)
            .order('created_at', { ascending: false })
            .limit(8),
        ]);
        if (!alive) return;

        if (badgesRes.error) {
          setDistinctions({ status: 'unavailable', items: [] });
        } else {
          // Le client Supabase non typé expose l'embed `badges` tantôt en objet,
          // tantôt en tableau (relation many-to-one) — on normalise les deux.
          const rows = (badgesRes.data ?? []) as unknown as Array<{
            badge_id: string;
            earned_at: string | null;
            badges:
              | { name: string | null; icon: string | null }
              | Array<{ name: string | null; icon: string | null }>
              | null;
          }>;
          setDistinctions({
            status: 'ready',
            items: rows.map((row) => {
              const badge = Array.isArray(row.badges) ? (row.badges[0] ?? null) : row.badges;
              return {
                id: row.badge_id,
                name: badge?.name?.trim() || 'Distinction',
                icon: badge?.icon?.trim() || null,
                earnedAt: row.earned_at,
              };
            }),
          });
        }

        if (gainsRes.error) {
          setGains({ status: 'unavailable', items: [] });
        } else {
          const rows = (gainsRes.data ?? []) as Array<{
            id: string;
            points: number;
            transaction_type: string;
            created_at: string;
          }>;
          setGains({
            status: 'ready',
            items: rows.map((row) => ({
              id: row.id,
              points: Math.max(0, Math.floor(Number(row.points) || 0)),
              label: gainLabel(row.transaction_type),
              createdAt: row.created_at,
            })),
          });
        }
      } catch (err) {
        console.error('Erreur chargement distinctions/gains:', err);
        if (alive) {
          setDistinctions({ status: 'unavailable', items: [] });
          setGains({ status: 'unavailable', items: [] });
        }
      }
    }

    loadAccountData();
    return () => {
      alive = false;
    };
  }, []);

  const handleFilterChange = (filter: TerritoryFilter) => {
    triggerHaptic('selection');
    setSelectedFilter(filter);
  };

  if (!profile) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
        <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[var(--lkv-primary)] border-t-transparent motion-reduce:animate-none" />
        <p className="text-sm font-semibold text-[var(--lkv-text-primary)]">
          Calcul de votre cordée LKDV...
        </p>
      </div>
    );
  }

  const hasData = profile.hasData;
  const rank =
    typeof leaderboard?.rank === 'number' && leaderboard.rank > 0
      ? leaderboard.rank
      : typeof profile.leaderboardRank === 'number' && profile.leaderboardRank > 0
        ? profile.leaderboardRank
        : null;
  const challenge = profile.challenge;
  const seasonPoints = profile.points.seasonId !== null ? profile.points.season : null;
  const usableBalance = profile.usableBalance;
  const filterLabel =
    TERRITORY_FILTERS.find((filter) => filter.id === selectedFilter)?.label ?? selectedFilter;
  const challengePct =
    challenge && challenge.targetProgress > 0
      ? Math.min(100, Math.round((challenge.currentProgress / challenge.targetProgress) * 100))
      : null;

  const skillsList: { key: SkillType; data: typeof profile.skills.explorer }[] = [
    { key: 'explorer', data: profile.skills.explorer },
    { key: 'preparer', data: profile.skills.preparer },
    { key: 'partager', data: profile.skills.partager },
    { key: 'entraider', data: profile.skills.entraider },
  ];

  return (
    <div
      className={`w-full space-y-4 font-sans text-[var(--lkv-text-primary)] ${compact ? '' : 'sm:space-y-5'}`}
    >
      {/* ── (a) EN-TÊTE COMPACT : Points cumulés, points de saison, niveau + titre ── */}
      <section className="glass relative overflow-hidden rounded-3xl border border-white/70 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white/75 text-xl shadow-sm">
              {hasData ? (
                profile.level.level >= 10 ? (
                  '👑'
                ) : profile.level.level >= 7 ? (
                  '🧗'
                ) : profile.level.level >= 4 ? (
                  '⛰️'
                ) : (
                  '🌱'
                )
              ) : (
                '🧭'
              )}
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-display text-xl font-extrabold tracking-tight text-[var(--lkv-text-primary)] sm:text-2xl">
                {hasData
                  ? profile.level.title ?? `Niveau ${profile.level.level}`
                  : 'Ma progression'}
              </h1>
              <p className="text-xs font-medium text-[var(--lkv-text-secondary)]">
                {hasData ? `Niveau ${profile.level.level}` : 'Aucune progression enregistrée'}
                {hasData && profile.displayName ? ` · ${profile.displayName}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatBlock
              label="Points LKDV cumulés"
              value={hasData ? profile.points.lifetime.toLocaleString('fr-FR') : '—'}
            />
            <StatBlock
              label="Points de saison"
              value={seasonPoints !== null ? seasonPoints.toLocaleString('fr-FR') : '—'}
            />
          </div>
        </div>

        {hasData ? (
          <div className="mt-4 border-t border-black/5 pt-3">
            <div className="mb-1.5 flex items-center justify-between text-xs font-medium">
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
              className="h-2.5 w-full overflow-hidden rounded-full border border-white/60 bg-black/5 p-0.5"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--lkv-primary)] to-[var(--lkv-secondary)] transition-all duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${Math.max(4, profile.level.progressPct)}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-[var(--lkv-text-muted)]">
              <span>{profile.points.lifetime.toLocaleString('fr-FR')} pts</span>
              <span>
                {profile.level.nextLevelPoints
                  ? `${profile.level.nextLevelPoints.toLocaleString('fr-FR')} pts`
                  : '—'}
              </span>
            </div>
          </div>
        ) : (
          <p className="mt-3 rounded-2xl border border-white/80 bg-white/60 p-3 text-xs leading-relaxed text-[var(--lkv-text-secondary)]">
            Vos points et votre niveau apparaîtront après votre première activité validée :
            session de randonnée traitée, avis de lieu publié, débrief de kit ou carnet partagé.
          </p>
        )}
      </section>

      {/* ── (b) RÉSUMÉ : 4 compétences courtes, rang, défi, solde utilisable ── */}
      <section
        aria-labelledby="progression-resume"
        className="glass rounded-3xl border border-white/70 p-4 shadow-sm sm:p-5"
      >
        <h2 id="progression-resume" className="sr-only">
          Résumé de progression
        </h2>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {skillsList.map(({ key, data }) => (
            <div
              key={key}
              className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/60 px-3 py-2.5"
            >
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--lkv-primary)] shadow-sm"
              >
                <Icon name={data.icon} size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-bold text-[var(--lkv-text-primary)]">
                    {data.label}
                  </span>
                  <span className="font-mono text-xs font-bold text-[var(--lkv-primary)]">
                    {hasData ? `${data.pct}%` : '—'}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={hasData ? data.pct : 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Compétence ${data.label}`}
                  className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/5"
                >
                  <div
                    className="h-full rounded-full bg-[var(--lkv-primary)] transition-all duration-500 motion-reduce:transition-none"
                    style={{ width: `${hasData ? Math.max(3, data.pct) : 0}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {(rank !== null || challenge !== null || usableBalance !== null) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {rank !== null && (
              <SummaryChip
                icon={<Trophy size={15} />}
                label={`Rang · ${filterLabel}`}
                value={`#${rank}`}
              />
            )}
            {challenge !== null && (
              <SummaryChip
                icon={<Target size={15} />}
                label="Prochain défi"
                value={
                  challengePct !== null
                    ? `${challenge.title} · ${challenge.currentProgress}/${challenge.targetProgress} ${challenge.unit}`
                    : challenge.title
                }
              />
            )}
            {usableBalance !== null && (
              <SummaryChip
                icon={<Gift size={15} />}
                label="Solde utilisable (récompenses uniquement)"
                value={`${usableBalance.toLocaleString('fr-FR')} pts`}
              />
            )}
          </div>
        )}

        {!hasData &&
          rank === null &&
          challenge === null &&
          usableBalance === null && (
            <p className="mt-3 text-xs text-[var(--lkv-text-secondary)]">
              Aucun rang, défi ou solde à afficher pour le moment.
            </p>
          )}
      </section>

      {/* ── (c) SECTIONS DÉTAILLÉES — repliées par défaut ── */}

      <ProgressionSection
        title="Classement territorial"
        summary={
          leaderboard
            ? `${leaderboard.totalParticipants} participant${leaderboard.totalParticipants > 1 ? 's' : ''} · ${filterLabel}`
            : '5 filtres : 1 km, ville, région, pays, monde'
        }
      >
        <div
          role="tablist"
          aria-label="Filtres de classement territorial"
          className="glass-capsule-bar no-scrollbar mb-4 overflow-x-auto p-1"
        >
          <div className="flex min-w-max items-center gap-1">
            {TERRITORY_FILTERS.map((f) => {
              const isSelected = selectedFilter === f.id;
              return (
                <button
                  key={f.id}
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => handleFilterChange(f.id)}
                  className={`glass-capsule-segment !min-h-[44px] cursor-pointer px-3.5 text-xs font-bold transition-all ${
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

        {leaderboardUnavailable && (
          <p className="mb-4 rounded-2xl border border-white/80 bg-white/60 p-3 text-xs text-[var(--lkv-text-secondary)]">
            Classement momentanément indisponible. Réessayez dans un instant.
          </p>
        )}

        {leaderboard?.seasonUnavailable && (
          <p className="mb-4 rounded-2xl border border-white/80 bg-white/60 p-3 text-xs text-[var(--lkv-text-secondary)]">
            Aucune saison active : le classement de saison n’est pas disponible.
          </p>
        )}

        {leaderboard?.territoryMissing && (
          <p className="mb-4 rounded-2xl border border-white/80 bg-white/60 p-3 text-xs text-[var(--lkv-text-secondary)]">
            Aucun territoire déclaré pour ce filtre. Déclarez votre commune pour rejoindre le
            classement.
          </p>
        )}

        {leaderboard?.localUnavailable && (
          <p className="mb-4 rounded-2xl border border-white/80 bg-white/60 p-3 text-xs text-[var(--lkv-text-secondary)]">
            Classement à 1 km indisponible : {reasonLabel(leaderboard.reason)}.
          </p>
        )}

        {leaderboard?.communityForming && !leaderboard.territoryMissing && (
          <div className="mb-4 space-y-2 rounded-2xl border border-white/80 bg-white/70 p-4 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--lkv-primary)]/10 text-lg text-[var(--lkv-primary)]">
              🌱
            </div>
            <h4 className="text-sm font-bold text-[var(--lkv-text-primary)]">
              Communauté en formation dans cette zone
            </h4>
            <p className="mx-auto max-w-md text-xs leading-relaxed text-[var(--lkv-text-muted)]">
              Il y a actuellement moins de {leaderboard.minParticipants} explorateurs actifs dans ce
              périmètre. Élargissez votre vue ou soyez le premier à poser votre trace.
            </p>
          </div>
        )}

        <div className="space-y-2">
          {loadingLeaderboard ? (
            <div className="py-6 text-center text-xs font-medium text-[var(--lkv-text-muted)]">
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
                  className={`flex items-center justify-between rounded-2xl border p-3 transition-all ${
                    isCurrentUser
                      ? 'border-[var(--lkv-primary)] bg-white/95 shadow-sm ring-1 ring-[var(--lkv-primary)]/20'
                      : 'border-white/70 bg-white/55 hover:bg-white/75'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white bg-white/90 font-mono text-xs font-bold shadow-sm">
                      {medal ?? `#${entry.rank}`}
                    </div>
                    <div className="min-w-0">
                      <span
                        className={`block truncate text-xs font-bold ${
                          isCurrentUser
                            ? 'text-[var(--lkv-primary)]'
                            : 'text-[var(--lkv-text-primary)]'
                        }`}
                      >
                        {entry.alias ?? '—'} {isCurrentUser ? '(Vous)' : ''}
                      </span>
                      <span className="block text-[10.5px] text-[var(--lkv-text-muted)]">
                        {entry.level !== null ? `Niv. ${entry.level}` : 'Niveau —'}
                        {entry.levelTitle ? ` · ${entry.levelTitle}` : ''}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="block font-mono text-xs font-extrabold text-[var(--lkv-primary)] sm:text-sm">
                      {entry.seasonPoints.toLocaleString('fr-FR')} pts
                    </span>
                    <span className="font-mono text-[9.5px] text-[var(--lkv-text-muted)]">
                      saison en cours
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            !leaderboardUnavailable && (
              <div className="py-5 text-center text-xs italic text-[var(--lkv-text-muted)]">
                Aucun participant pour ce filtre actuellement.
              </div>
            )
          )}
        </div>
      </ProgressionSection>

      <ProgressionSection
        title="Défis"
        summary={
          challenge
            ? `Défi en cours · +${challenge.pointsReward} pts`
            : 'Aucun défi en cours'
        }
      >
        {challenge ? (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-[var(--lkv-text-primary)]">
                {challenge.title}
              </h3>
              <span className="glass-pill text-[10px] font-mono font-bold text-[var(--lkv-primary)]">
                +{challenge.pointsReward} pts
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[var(--lkv-text-secondary)]">
              {challenge.description}
            </p>
            <div className="mt-3 flex items-center justify-between font-mono text-xs text-[var(--lkv-text-muted)]">
              <span>
                {challenge.currentProgress}/{challenge.targetProgress} {challenge.unit}
              </span>
              {challengePct !== null && <span>{challengePct}%</span>}
            </div>
            <div
              role="progressbar"
              aria-valuenow={challengePct ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Avancement du défi"
              className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-black/5"
            >
              <div
                className="h-full rounded-full bg-[var(--lkv-primary)] transition-all duration-500 motion-reduce:transition-none"
                style={{ width: `${Math.max(3, challengePct ?? 0)}%` }}
              />
            </div>
            {challenge.isCompleted && (
              <p className="mt-2 text-xs font-semibold text-[var(--lkv-primary)]">
                Objectif atteint.
              </p>
            )}
            {/* Le remplacement 1/semaine n'est pas disponible : la route
                /api/progression/challenge/replace répond 501 (non implémentée P3).
                Aucun bouton factice n'est affiché tant qu'elle ne répond pas. */}
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-[var(--lkv-text-secondary)]">
            Aucun défi en cours. Les défis sont attribués avec la saison et progressent à partir
            de vos événements validés — aucune sanction d’absence.
          </p>
        )}
      </ProgressionSection>

      <ProgressionSection
        title="Distinctions"
        summary={
          distinctions.status === 'ready'
            ? distinctions.items.length > 0
              ? `${distinctions.items.length} distinction${distinctions.items.length > 1 ? 's' : ''} obtenue${distinctions.items.length > 1 ? 's' : ''}`
              : 'Aucune distinction obtenue'
            : 'Vos badges obtenus'
        }
      >
        {distinctions.status === 'loading' && (
          <p className="text-xs text-[var(--lkv-text-muted)]">Chargement des distinctions...</p>
        )}
        {distinctions.status === 'unavailable' && (
          <p className="text-xs text-[var(--lkv-text-secondary)]">
            Distinctions indisponibles pour le moment.
          </p>
        )}
        {distinctions.status === 'ready' && distinctions.items.length === 0 && (
          <p className="text-xs leading-relaxed text-[var(--lkv-text-secondary)]">
            Aucune distinction obtenue pour le moment. Vos badges historiques apparaîtront ici
            dès qu’ils seront attribués.
          </p>
        )}
        {distinctions.status === 'ready' && distinctions.items.length > 0 && (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {distinctions.items.map((distinction) => {
              const earnedLabel = formatDate(distinction.earnedAt);
              return (
                <li
                  key={distinction.id}
                  className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/60 p-3"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-sm"
                  >
                    {distinction.icon ?? <Award size={16} className="text-[var(--lkv-secondary)]" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-[var(--lkv-text-primary)]">
                      {distinction.name}
                    </span>
                    <span className="block text-[10.5px] text-[var(--lkv-text-muted)]">
                      {earnedLabel ? `Obtenue le ${earnedLabel}` : 'Obtenue'}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </ProgressionSection>

      <ProgressionSection
        title="Historique de gains"
        summary={
          gains.status === 'ready'
            ? gains.items.length > 0
              ? `${gains.items.length} gain${gains.items.length > 1 ? 's' : ''} récent${gains.items.length > 1 ? 's' : ''}`
              : 'Aucun gain enregistré'
            : 'Vos derniers gains validés'
        }
      >
        {gains.status === 'loading' && (
          <p className="text-xs text-[var(--lkv-text-muted)]">Chargement de l’historique...</p>
        )}
        {gains.status === 'unavailable' && (
          <p className="text-xs text-[var(--lkv-text-secondary)]">
            Historique indisponible pour le moment.
          </p>
        )}
        {gains.status === 'ready' && gains.items.length === 0 && (
          <p className="text-xs leading-relaxed text-[var(--lkv-text-secondary)]">
            Aucun gain enregistré pour le moment. Les points sont crédités après validation
            serveur de vos actions.
          </p>
        )}
        {gains.status === 'ready' && gains.items.length > 0 && (
          <ul className="divide-y divide-black/5">
            {gains.items.map((gain) => {
              const dateLabel = formatDate(gain.createdAt);
              return (
                <li key={gain.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-[var(--lkv-text-primary)]">
                      {gain.label}
                    </span>
                    {dateLabel && (
                      <span className="block text-[10.5px] text-[var(--lkv-text-muted)]">
                        {dateLabel}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-xs font-extrabold text-[var(--lkv-primary)]">
                    +{gain.points.toLocaleString('fr-FR')} pts
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <Link
          href="/recompenses"
          className="mt-3 inline-flex min-h-[44px] items-center text-xs font-bold text-[var(--lkv-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
        >
          Voir tout dans Récompenses →
        </Link>
      </ProgressionSection>

      {/* Liens économiques distincts : récompenses utilisables et fidélité historique. */}
      <section aria-label="Récompenses et fidélité" className="flex flex-wrap gap-2">
        <Link href="/recompenses" className="glass-capsule-btn secondary">
          <Gift size={14} aria-hidden="true" />
          <span>Récompenses</span>
        </Link>
        <Link href="/fidelite" className="glass-capsule-btn secondary">
          <Award size={14} aria-hidden="true" />
          <span>Fidélité</span>
        </Link>
      </section>
    </div>
  );
}
