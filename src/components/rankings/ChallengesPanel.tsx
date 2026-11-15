'use client';

import React, { useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import Icon from '@/components/ui/Icon';
import type { BestEffortGoalProposal } from '@/features/rankings/types';
import type { ChallengeItem, ChallengesPayload } from '@/lib/rankings/types';
import {
  ErrorPanel,
  InlineNotice,
  PanelTitle,
  ProgressBar,
  RankingsCard,
  RankingsEmpty,
  SegmentedControl,
} from './ui';
import { challengeKindLabel, formatDate, formatInteger, formatPct } from './format';
import { useRankingsApi } from './useRankingsApi';

type ChallengeFilter = 'all' | 'active' | 'done';

function challengeStatus(item: ChallengeItem): 'upcoming' | 'active' | 'ended' {
  const now = Date.now();
  if (Date.parse(item.rule.startsAt) > now) return 'upcoming';
  if (Date.parse(item.rule.endsAt) < now) return 'ended';
  return 'active';
}

function formatDurationClock(totalSec: number): string {
  const mins = Math.floor(totalSec / 60);
  const secs = Math.round(totalSec % 60);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h${String(remMins).padStart(2, '0')}m${String(secs).padStart(2, '0')}s`;
  }
  return `${mins}m${String(secs).padStart(2, '0')}s`;
}

export function ChallengesView({
  items,
  bestEffortProposals,
  onMutated,
}: {
  items: ChallengeItem[];
  bestEffortProposals?: BestEffortGoalProposal[];
  onMutated?: () => void;
}) {
  const [filter, setFilter] = useState<ChallengeFilter>('all');
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [sport, setSport] = useState<'all' | 'hiking' | 'trail_running' | 'running' | 'cycling'>('all');
  const [criterion, setCriterion] = useState<'distance_meters' | 'elevation_gain_meters' | 'activity_count'>('distance_meters');
  const [targetValue, setTargetValue] = useState('30000');
  const [invitedHandles, setInvitedHandles] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'done') return items.filter((item) => item.progress?.isCompleted === true);
    if (filter === 'active') {
      return items.filter(
        (item) => challengeStatus(item) === 'active' && item.progress?.isCompleted !== true
      );
    }
    return items;
  }, [filter, items]);

  const handleCreatePrivate = async (event: React.FormEvent) => {
    event.preventDefault();
    const numericTarget = Number(targetValue);
    if (!title.trim() || !Number.isFinite(numericTarget) || numericTarget <= 0) {
      setActionError('Titre et objectif numérique requis.');
      return;
    }
    setSubmitting(true);
    setActionError(null);
    setFeedback(null);
    try {
      const handles = invitedHandles
        .split(/[\s,;]+/)
        .map((h) => h.replace(/^@+/, '').trim())
        .filter(Boolean);
      const res = await fetch('/api/rankings/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_private',
          title: title.trim(),
          sport,
          criterion,
          targetValue: numericTarget,
          invitedHandles: handles,
        }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setActionError(json?.error || 'Impossible de créer ce défi privé.');
        return;
      }
      setTitle('');
      setInvitedHandles('');
      setComposerOpen(false);
      setFeedback('Défi privé créé pour votre groupe d’invités.');
      onMutated?.();
    } catch {
      setActionError('Erreur réseau lors de la création du défi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptBestEffort = async (proposal: BestEffortGoalProposal) => {
    const key = `be:${proposal.sport}:${proposal.distanceMeters}`;
    setBusyId(key);
    setActionError(null);
    setFeedback(null);
    try {
      const res = await fetch('/api/rankings/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accept_best_effort',
          sport: proposal.sport,
          targetDistanceMeters: proposal.distanceMeters,
          targetDurationSec: proposal.proposedTargetDurationSec,
          improvementPct: proposal.improvementPct,
        }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setActionError(json?.error || 'Impossible de fixer cet objectif.');
        return;
      }
      setFeedback('Objectif de meilleur effort ajouté à vos défis.');
      onMutated?.();
    } catch {
      setActionError('Erreur réseau lors de l’enregistrement.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRaceAction = async (raceId: string, action: 'register_race' | 'withdraw_race') => {
    setBusyId(raceId);
    setActionError(null);
    setFeedback(null);
    try {
      const res = await fetch('/api/rankings/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, raceId }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setActionError(json?.error || 'Action impossible sur cette course virtuelle.');
        return;
      }
      setFeedback(
        action === 'register_race'
          ? 'Inscription confirmée sur la course virtuelle.'
          : 'Désinscription enregistrée.'
      );
      onMutated?.();
    } catch {
      setActionError('Erreur réseau.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-[var(--space-4)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PanelTitle
          eyebrow="Défis"
          title="Les défis de la saison"
          description="Chaque progression est une somme d’activités validées, rejouable sans double comptage. Une correction ou un signalement annule le gain."
        />
        {onMutated && (
          <Button
            variant="secondary"
            size="md"
            onClick={() => setComposerOpen((prev) => !prev)}
          >
            <Icon name={composerOpen ? 'x' : 'plus'} size={15} />
            {composerOpen ? 'Fermer' : 'Créer un défi privé'}
          </Button>
        )}
      </div>

      {actionError && (
        <p role="alert" className="rounded-[var(--lkv-radius-tile)] border border-[color:var(--lkv-danger)]/40 bg-[color:var(--lkv-danger)]/10 px-3 py-2 text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-danger)]">
          {actionError}
        </p>
      )}
      {feedback && (
        <p role="status" className="rounded-[var(--lkv-radius-tile)] border border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] px-3 py-2 text-[length:var(--lkv-text-caption)] text-[color:var(--glass-label)]">
          {feedback}
        </p>
      )}

      {composerOpen && (
        <RankingsCard className="p-[var(--space-4)]">
          <form onSubmit={handleCreatePrivate} className="space-y-3" aria-label="Créer un défi privé entre amis">
            <p className="text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--glass-label)]">
              Nouveau défi privé (S5.21)
            </p>
            <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--glass-label-secondary)]">
              Visible uniquement de vous et des comptes explicitement invités.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-[0.08em] text-[color:var(--glass-label-tertiary)]">
                Titre du défi
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex. 30 km en novembre"
                  className="min-h-[44px] rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-field-border)] bg-[color:var(--glass-bg-medium)] px-3 text-[length:var(--lkv-text-footnote)] normal-case text-[color:var(--glass-label)]"
                />
              </label>
              <label className="flex flex-col gap-1 text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-[0.08em] text-[color:var(--glass-label-tertiary)]">
                Invités (@pseudo séparés par virgule)
                <input
                  type="text"
                  value={invitedHandles}
                  onChange={(e) => setInvitedHandles(e.target.value)}
                  placeholder="@claire, @lucas"
                  className="min-h-[44px] rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-field-border)] bg-[color:var(--glass-bg-medium)] px-3 text-[length:var(--lkv-text-footnote)] normal-case text-[color:var(--glass-label)]"
                />
              </label>
              <label className="flex flex-col gap-1 text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-[0.08em] text-[color:var(--glass-label-tertiary)]">
                Sport
                <select
                  value={sport}
                  onChange={(e) => setSport(e.target.value as typeof sport)}
                  className="min-h-[44px] rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-field-border)] bg-[color:var(--glass-bg-medium)] px-3 text-[length:var(--lkv-text-footnote)] normal-case text-[color:var(--glass-label)]"
                >
                  <option value="all">Tous sports</option>
                  <option value="hiking">Randonnée</option>
                  <option value="trail_running">Trail</option>
                  <option value="running">Course à pied</option>
                  <option value="cycling">Vélo</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-[0.08em] text-[color:var(--glass-label-tertiary)]">
                  Critère
                  <select
                    value={criterion}
                    onChange={(e) => setCriterion(e.target.value as typeof criterion)}
                    className="min-h-[44px] rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-field-border)] bg-[color:var(--glass-bg-medium)] px-2 text-[length:var(--lkv-text-footnote)] normal-case text-[color:var(--glass-label)]"
                  >
                    <option value="distance_meters">Distance (m)</option>
                    <option value="elevation_gain_meters">Dénivelé D+ (m)</option>
                    <option value="activity_count">Nb sorties</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-[0.08em] text-[color:var(--glass-label-tertiary)]">
                  Cible
                  <input
                    type="number"
                    min={1}
                    required
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    className="min-h-[44px] rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-field-border)] bg-[color:var(--glass-bg-medium)] px-3 text-[length:var(--lkv-text-footnote)] normal-case text-[color:var(--glass-label)]"
                  />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="submit" variant="primary" size="md" disabled={submitting}>
                {submitting ? 'Création…' : 'Lancer le défi privé'}
              </Button>
            </div>
          </form>
        </RankingsCard>
      )}

      {bestEffortProposals && bestEffortProposals.length > 0 && (
        <RankingsCard className="p-[var(--space-4)]">
          <p className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.12em] text-[color:var(--glass-label-tertiary)]">
            Objectifs de meilleur effort · S5.22
          </p>
          <p className="mt-1 text-[length:var(--lkv-text-footnote)] text-[color:var(--glass-label-secondary)]">
            Propositions calculées uniquement depuis vos records GPS validés (-3 % sur votre meilleur temps).
          </p>
          <ul className="mt-3 space-y-2" aria-label="Propositions de meilleur effort">
            {bestEffortProposals.map((proposal) => {
              const key = `be:${proposal.sport}:${proposal.distanceMeters}`;
              const km = proposal.distanceMeters >= 1000
                ? `${(proposal.distanceMeters / 1000).toFixed(proposal.distanceMeters % 1000 === 0 ? 0 : 1)} km`
                : `${proposal.distanceMeters} m`;
              return (
                <li
                  key={key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--lkv-radius-tile)] border border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--glass-label)]">
                      {km} · viser {formatDurationClock(proposal.proposedTargetDurationSec)}
                    </p>
                    <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--glass-label-secondary)]">
                      Record actuel : {formatDurationClock(proposal.previousBestDurationSec)} ({formatDate(proposal.sourceAchievedAt)})
                    </p>
                  </div>
                  {onMutated && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busyId === key}
                      onClick={() => handleAcceptBestEffort(proposal)}
                    >
                      {busyId === key ? 'Ajout…' : 'Fixer cet objectif'}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </RankingsCard>
      )}

      <SegmentedControl
        label="Filtrer les défis"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: `Tous (${items.length})` },
          { value: 'active', label: 'En cours' },
          { value: 'done', label: 'Terminés' },
        ]}
      />

      {filtered.length === 0 ? (
        <RankingsCard>
          <RankingsEmpty
            icon="flame"
            title={filter === 'done' ? 'Aucun défi terminé' : 'Aucun défi disponible'}
            description={
              filter === 'done'
                ? 'Les défis terminés apparaîtront ici avec leur badge. Un défi non prouvé ne compte pas.'
                : 'Le catalogue de défis est vide pour cette saison. Nous n’inventons pas de défi de démonstration.'
            }
            actionLabel="Explorer"
            actionHref="/explorer"
          />
        </RankingsCard>
      ) : (
        <ul className="space-y-[var(--space-3)]" aria-label="Défis">
          {filtered.map((item) => (
            <li key={`${item.rule.id}:v${item.rule.version}`}>
              <ChallengeCard
                item={item}
                busy={busyId === item.rule.id}
                onRaceAction={onMutated ? handleRaceAction : undefined}
              />
            </li>
          ))}
        </ul>
      )}

      <InlineNotice tone="privacy">
        Un défi dont la grandeur n’est pas fournie par la base reste visible mais
        n’affiche aucune progression. « Non suivi » n’est pas « zéro ».
      </InlineNotice>
    </div>
  );
}

function ChallengeCard({
  item,
  busy,
  onRaceAction,
}: {
  item: ChallengeItem;
  busy?: boolean;
  onRaceAction?: (raceId: string, action: 'register_race' | 'withdraw_race') => void;
}) {
  const status = challengeStatus(item);
  const progress = item.progress;
  const completed = progress?.isCompleted === true;
  const raceResult = item.virtualRaceResult;
  const isRegistered = raceResult?.eligible === true;

  return (
    <RankingsCard className="p-[var(--space-4)]">
      <div className="flex items-start gap-[var(--space-3)]">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] text-[color:var(--glass-label-secondary)]">
          <Icon name={completed ? 'award' : 'flame'} size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--glass-label)]">
              {item.rule.title}
            </h3>
            <span className="rounded-full border border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] px-2 py-0.5 font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.1em] text-[color:var(--glass-label-tertiary)]">
              {challengeKindLabel(item.rule.kind)}
            </span>
            {item.rule.sponsorName && (
              <span className="rounded-full border border-[color:var(--glass-rim)] px-2 py-0.5 font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--glass-label-secondary)]">
                {item.rule.sponsorName}
              </span>
            )}
            {status === 'ended' && !completed && (
              <span className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.1em] text-[color:var(--glass-label-tertiary)]">
                Clôturé
              </span>
            )}
          </div>
          <p className="mt-1 text-[length:var(--lkv-text-footnote)] leading-relaxed text-[color:var(--glass-label-secondary)]">
            {item.rule.description}
          </p>
        </div>
      </div>

      {item.rule.kind === 'virtual_race' && (
        <div className="mt-[var(--space-3)] flex flex-wrap items-center justify-between gap-2 rounded-[var(--lkv-radius-tile)] border border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] px-[var(--space-3)] py-[var(--space-2)]">
          <div className="min-w-0 text-[length:var(--lkv-text-caption)] text-[color:var(--glass-label-secondary)]">
            {item.rule.partnerAvailable === false ? (
              <span>Partenaire temporairement indisponible pour cette course.</span>
            ) : raceResult?.finisherBadgeAwarded && raceResult.bestDurationSec ? (
              <span>Finisher validé · {formatDurationClock(raceResult.bestDurationSec)}</span>
            ) : isRegistered ? (
              <span>Inscrit à la course virtuelle · fenêtre ouverte jusqu’au {formatDate(item.rule.endsAt)}</span>
            ) : (
              <span>Course virtuelle partenaire · inscription requise</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {item.registrationUrl && (
              <a
                href={item.registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[36px] items-center rounded-full border border-[color:var(--glass-rim)] px-3 text-[length:var(--lkv-text-caption-2)] font-semibold text-[color:var(--glass-label)] hover:bg-[color:var(--lkv-hover-surface)]"
              >
                Page partenaire
              </a>
            )}
            {onRaceAction && item.rule.partnerAvailable !== false && (
              <Button
                variant={isRegistered ? 'secondary' : 'primary'}
                size="sm"
                disabled={busy}
                onClick={() =>
                  onRaceAction(item.rule.id, isRegistered ? 'withdraw_race' : 'register_race')
                }
              >
                {busy ? 'Mise à jour…' : isRegistered ? 'Se désinscrire' : 'S’inscrire'}
              </Button>
            )}
          </div>
        </div>
      )}

      {item.trackable && progress ? (
        <div className="mt-[var(--space-3)]">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <p className="text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--glass-label)]">
              {formatInteger(progress.currentValue)} / {formatInteger(progress.targetValue)}{' '}
              {item.rule.unit}
            </p>
            <p className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--glass-label-secondary)]">
              {formatPct(progress.progressPct)}
            </p>
          </div>
          <ProgressBar
            value={progress.currentValue}
            max={Math.max(1, progress.targetValue)}
            label={`Progression du défi ${item.rule.title}`}
          />
          <p className="mt-1 text-[length:var(--lkv-text-caption-2)] text-[color:var(--glass-label-secondary)]">
            {completed
              ? `Terminé le ${formatDate(progress.completedAt)} · ${formatInteger(item.rule.rewardPoints)} points`
              : `Récompense : ${item.rule.rewardTitle} · ${formatInteger(item.rule.rewardPoints)} points`}
          </p>
        </div>
      ) : item.trackable ? (
        <p className="mt-[var(--space-3)] rounded-[var(--lkv-radius-tile)] border border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--glass-label-secondary)]">
          Connectez-vous pour suivre ce défi. Sans session, aucune progression
          personnelle n’est calculée.
        </p>
      ) : (
        <p className="mt-[var(--space-3)] rounded-[var(--lkv-radius-tile)] border border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--glass-label-secondary)]">
          Suivi indisponible : la base ne fournit pas encore la grandeur mesurée pour ce défi.
          Aucune progression n’est affichée.
        </p>
      )}

      {item.leaderboard && item.leaderboard.length > 0 && (
        <div className="mt-[var(--space-3)] border-t border-[color:var(--glass-rim)] pt-[var(--space-2)]">
          <p className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.1em] text-[color:var(--glass-label-tertiary)]">
            Top 3
          </p>
          <ol className="mt-1 space-y-1">
            {item.leaderboard.slice(0, 3).map((entry) => (
              <li
                key={entry.userId}
                className="flex items-center justify-between gap-3 text-[length:var(--lkv-text-caption)] text-[color:var(--glass-label-secondary)]"
              >
                <span className="truncate">
                  {entry.rank}. {entry.displayName}
                  {entry.isCurrentUser ? ' (vous)' : ''}
                </span>
                <span className="shrink-0 font-semibold text-[color:var(--glass-label)]">
                  {formatInteger(entry.metricValue)} {item.rule.unit}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </RankingsCard>
  );
}

export function ChallengesPanel() {
  const { status, data, error, reload } = useRankingsApi<ChallengesPayload>(
    '/api/rankings/challenges'
  );

  return (
    <div className="space-y-[var(--space-4)]">
      {status === 'loading' && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" label="Chargement des défis" />
        </div>
      )}
      {status === 'error' && (
        <RankingsCard>
          <ErrorPanel message={error || 'Défis indisponibles.'} onRetry={reload} />
        </RankingsCard>
      )}
      {status !== 'loading' && data && (
        <ChallengesView
          items={data.items}
          bestEffortProposals={data.bestEffortProposals}
          onMutated={reload}
        />
      )}
    </div>
  );
}

export default ChallengesPanel;
