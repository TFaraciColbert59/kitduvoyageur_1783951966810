'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Flame, Target, Trophy } from 'lucide-react';
import type {
  TerritorialLeaderboard,
  UserProgressionProfile,
} from '@/features/progression/domain/types';

interface ProgressionCompactState {
  /** `hidden` tant que la donnée n'est pas chargée (ou si l'API est indisponible). */
  status: 'hidden' | 'ready';
  profile: UserProgressionProfile | null;
  /** Rang réel : `leaderboardRank` du profil, sinon rang RPC du classement ville. */
  rank: number | null;
}

interface ProgressionCompactCardProps {
  className?: string;
}

/**
 * Carte de progression compacte de la racine Aventures (`/hub`).
 *
 * Honnêteté : lit uniquement `/api/progression` (profil canonique) et, pour le
 * rang, `/api/progression/leaderboard` (RPC réelle). Aucun chiffre n'est
 * inventé : `hasData=false` → état vide explicite, rang/défi absents → masqués.
 * La carte reste silencieuse (non montée) si l'API ne répond pas.
 */
export function ProgressionCompactCard({ className = '' }: ProgressionCompactCardProps) {
  const [state, setState] = useState<ProgressionCompactState>({
    status: 'hidden',
    profile: null,
    rank: null,
  });

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const response = await fetch('/api/progression', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = await response.json();
        const profile: UserProgressionProfile | null = payload?.success
          ? (payload.profile as UserProgressionProfile)
          : null;
        if (!profile || !alive) return;

        let rank =
          typeof profile.leaderboardRank === 'number' && profile.leaderboardRank > 0
            ? profile.leaderboardRank
            : null;

        // `leaderboardRank` n'est pas encore projeté par le profil : le rang
        // réel vient de la même RPC que Ma progression (filtre ville).
        if (rank === null) {
          try {
            const leaderboardResponse = await fetch(
              '/api/progression/leaderboard?filter=city&limit=1',
              { cache: 'no-store' }
            );
            if (leaderboardResponse.ok) {
              const leaderboardPayload = await leaderboardResponse.json();
              const leaderboard: TerritorialLeaderboard | null = leaderboardPayload?.success
                ? (leaderboardPayload.leaderboard as TerritorialLeaderboard)
                : null;
              if (
                leaderboard &&
                typeof leaderboard.rank === 'number' &&
                leaderboard.rank > 0
              ) {
                rank = leaderboard.rank;
              }
            }
          } catch {
            // Rang indisponible : aucun rang affiché, jamais inventé.
          }
        }

        if (alive) setState({ status: 'ready', profile, rank });
      } catch {
        // API indisponible : la carte reste démontée.
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  if (state.status !== 'ready' || !state.profile) return null;

  const { profile, rank } = state;
  const hasData = profile.hasData;
  const seasonPoints = profile.points.seasonId !== null ? profile.points.season : null;
  const challenge = profile.challenge;
  const levelLine = hasData
    ? `Niveau ${profile.level.level}${profile.level.title ? ` · ${profile.level.title}` : ''}`
    : 'Aucune progression enregistrée';

  return (
    <section aria-label="Progression" className={className}>
      <Link
        href="/progression"
        className="glass interactive block min-h-[44px] rounded-2xl border border-white/70 px-3.5 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
      >
        <span className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/70 bg-white/70 text-[var(--lkv-primary)]"
          >
            <Trophy size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lkv-text-muted)]">
              Ma progression
            </span>
            <span className="block truncate text-sm font-bold text-[var(--lkv-text-primary)]">
              {levelLine}
            </span>
            {!hasData && (
              <span className="mt-0.5 block text-xs text-[var(--lkv-text-secondary)]">
                Vos points démarreront avec votre première activité validée.
              </span>
            )}
          </span>
          <ChevronRight
            size={16}
            className="shrink-0 text-[var(--lkv-text-muted)]"
            aria-hidden="true"
          />
        </span>

        {hasData && (seasonPoints !== null || rank !== null || challenge !== null) && (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {seasonPoints !== null && (
              <span className="glass-pill inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[var(--lkv-text-secondary)]">
                <Flame size={11} aria-hidden="true" />
                {seasonPoints.toLocaleString('fr-FR')} pts saison
              </span>
            )}
            {rank !== null && (
              <span className="glass-pill inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[var(--lkv-text-secondary)]">
                <Trophy size={11} aria-hidden="true" />
                Rang #{rank}
              </span>
            )}
            {challenge !== null && (
              <span className="glass-pill inline-flex min-w-0 items-center gap-1 text-[10px] font-mono font-bold text-[var(--lkv-text-secondary)]">
                <Target size={11} className="shrink-0" aria-hidden="true" />
                <span className="truncate">{challenge.title}</span>
              </span>
            )}
          </span>
        )}
      </Link>
    </section>
  );
}

export default ProgressionCompactCard;
