'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ChevronRight, Flame, Target, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import MaProgressionView from './MaProgressionView';
import { progressionProfileQuery, progressionCityRankQuery } from '@/features/progression/client/progressionQuery';

interface ProgressionCompactCardProps {
  className?: string;
  variant?: 'card' | 'drawer';
}

/**
 * Carte de progression compacte de la racine Aventures (`/hub`).
 *
 * Honnêteté : lit uniquement `/api/progression` (profil canonique) et, pour le
 * rang, `/api/progression/leaderboard` (RPC réelle). Aucun chiffre n'est
 * inventé : `hasData=false` → état vide explicite, rang/défi absents → masqués.
 * Chargement et erreur restent visibles, sans les confondre avec un solde nul.
 */
export function ProgressionCompactCard({
  className = '',
  variant = 'card',
}: ProgressionCompactCardProps) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const enabled = variant !== 'drawer' && !authLoading && userId !== null;
  const profileQuery = useQuery({ ...progressionProfileQuery(userId ?? ''), enabled });
  const ownedProfile = enabled && profileQuery.data?.userId === userId ? profileQuery.data : null;
  const canonicalRank = ownedProfile?.leaderboardRank;
  const rankQuery = useQuery({
    ...progressionCityRankQuery(userId ?? ''),
    enabled: enabled && !!ownedProfile?.hasData && !(typeof canonicalRank === 'number' && canonicalRank > 0),
  });

  if (variant === 'drawer') {
    return (
      <div className={className}>
        <MaProgressionView compact presentation="drawer" />
      </div>
    );
  }

  // The query key and payload both identify the owner; no previous-account data.
  if (!ownedProfile || profileQuery.isError) {
    const isError = enabled && profileQuery.isError;
    const isGuest = !authLoading && !userId;
    return (
      <section
        aria-label="Progression"
        aria-busy={!isError && !isGuest}
        className={className}
        style={{ borderRadius: 16, padding: 14, border: '1px solid var(--lkv-border-subtle)', background: 'var(--lkv-surface-card)', color: 'var(--lkv-text-primary)' }}
      >
        <span style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--lkv-text-muted)' }}>Ma progression</span>
        <p role={isError ? 'alert' : 'status'} style={{ margin: '6px 0', fontSize: 14 }}>
          {isError ? 'Progression indisponible. Vos points ne peuvent pas être chargés.' : isGuest ? 'Connectez-vous pour retrouver votre progression.' : 'Chargement de votre progression…'}
        </p>
        {isError && (
          <button
            type="button"
            onClick={() => void profileQuery.refetch()}
            className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--lkv-focus-ring)]"
            style={{ minWidth: 44, minHeight: 44, padding: '8px 12px', borderRadius: 12, border: '1px solid var(--lkv-border)', background: 'var(--lkv-surface-muted)', color: 'var(--lkv-text-primary)', fontWeight: 600 }}
          >Réessayer</button>
        )}
        {isGuest && <Link href="/compte" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, color: 'var(--lkv-text-primary)' }}>Mon compte</Link>}
      </section>
    );
  }

  const profile = ownedProfile;
  const rank = typeof canonicalRank === 'number' && canonicalRank > 0
    ? canonicalRank
    : rankQuery.isError ? null : (rankQuery.data ?? null);
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
        className="block min-h-[44px] rounded-2xl border border-[color:var(--lkv-border-subtle)] bg-[color:var(--lkv-surface-card)] px-3.5 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-focus-ring)]"
      >
        <span className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[color:var(--lkv-border-subtle)] bg-[color:var(--lkv-surface-muted)] text-[color:var(--lkv-text-primary)]"
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
