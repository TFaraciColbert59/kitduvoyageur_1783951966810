'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Flame, Target, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui';
import MaProgressionView from './MaProgressionView';
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
  variant?: 'card' | 'drawer';
}

/**
 * Cache mémoire court, module-level : évite le double appel systématique
 * profil + classement quand la carte est montée deux fois sur le même écran
 * (CollectifMenu, PossessionMenu, SortieMenu) et absorbe les remontages
 * rapprochés. Limites assumées : par instance JS (onglet), non partagé entre
 * onglets/worktrees, perdu au rechargement ; aucune lib partagée n'est ajoutée
 * pour ce besoin (TTL 60 s aligné sur le `Cache-Control` des routes).
 */
const RESPONSE_CACHE_TTL_MS = 60_000;
interface MemoryCacheEntry {
  expiresAt: number;
  payload: unknown;
}
const memoryResponseCache = new Map<string, MemoryCacheEntry>();
const inflightRequests = new Map<string, Promise<unknown>>();

async function fetchJsonCached(url: string): Promise<unknown> {
  const cached = memoryResponseCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.payload;

  const inflight = inflightRequests.get(url);
  if (inflight) return inflight;

  const request = fetch(url, { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      memoryResponseCache.set(url, {
        expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS,
        payload,
      });
      return payload;
    })
    .finally(() => {
      inflightRequests.delete(url);
    });

  inflightRequests.set(url, request);
  return request;
}

interface ProfilePayload {
  success?: boolean;
  profile?: UserProgressionProfile;
}

interface LeaderboardPayload {
  success?: boolean;
  leaderboard?: TerritorialLeaderboard;
}

/**
 * Carte de progression compacte de la racine Aventures (`/hub`).
 *
 * Honnêteté : lit uniquement `/api/progression` (profil canonique) et, pour le
 * rang, `/api/progression/leaderboard` (RPC réelle). Aucun chiffre n'est
 * inventé : `hasData=false` → état vide explicite, rang/défi absents → masqués.
 * La carte reste silencieuse (non montée) si l'API ne répond pas.
 */
export function ProgressionCompactCard({
  className = '',
  variant = 'card',
}: ProgressionCompactCardProps) {
  const [state, setState] = useState<ProgressionCompactState>({
    status: 'hidden',
    profile: null,
    rank: null,
  });

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const payload = (await fetchJsonCached('/api/progression')) as ProfilePayload | null;
        const profile = payload?.success ? (payload.profile ?? null) : null;
        if (!profile || !alive) return;

        let rank =
          typeof profile.leaderboardRank === 'number' && profile.leaderboardRank > 0
            ? profile.leaderboardRank
            : null;

        // `leaderboardRank` n'est pas encore projeté par le profil : le rang
        // réel vient de la même RPC que Ma progression (filtre ville). On ne
        // sollicite le classement que si un profil avec données existe : un
        // compte sans progression n'a rien à classer.
        if (rank === null && profile.hasData) {
          try {
            const leaderboardPayload = (await fetchJsonCached(
              '/api/progression/leaderboard?filter=city&limit=1'
            )) as LeaderboardPayload | null;
            const leaderboard = leaderboardPayload?.success
              ? (leaderboardPayload.leaderboard ?? null)
              : null;
            if (
              leaderboard &&
              typeof leaderboard.rank === 'number' &&
              leaderboard.rank > 0
            ) {
              rank = leaderboard.rank;
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

  if (variant === 'drawer') {
    return (
      <div className={className}>
        <MaProgressionView compact presentation="drawer" />
      </div>
    );
  }

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
        href="/compte#progression"
        className="block min-h-[44px] rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] backdrop-blur-[var(--blur-md)] px-3.5 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-focus-ring)]"
      >
        <span className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset text-[var(--lkv-primary)]"
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
              <Badge tone="stone" className="gap-1 text-[10px] font-mono font-bold">
                <Flame size={11} aria-hidden="true" />
                {seasonPoints.toLocaleString('fr-FR')} pts saison
              </Badge>
            )}
            {rank !== null && (
              <Badge tone="stone" className="gap-1 text-[10px] font-mono font-bold">
                <Trophy size={11} aria-hidden="true" />
                Rang #{rank}
              </Badge>
            )}
            {challenge !== null && (
              <Badge tone="stone" className="min-w-0 gap-1 text-[10px] font-mono font-bold">
                <Target size={11} className="shrink-0" aria-hidden="true" />
                <span className="truncate">{challenge.title}</span>
              </Badge>
            )}
          </span>
        )}
      </Link>
    </section>
  );
}

export default ProgressionCompactCard;
