'use client';

import React, { useMemo, useState } from 'react';

import type {
  ChallengeMetric,
  ChallengeParticipantProgress,
  ClubChallenge,
  ClubChallengeSummary,
} from '@/features/clubs';
import {
  challengeProgress,
  formatEventDate,
  formatMetricValue,
  METRIC_LABELS,
  scopeLabel,
} from './model';
import styles from './g02.module.css';

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

const METRICS: ChallengeMetric[] = ['distance_m', 'duration_s', 'elevation_gain_m', 'activities_count'];

export interface ClubChallengeCreateInput {
  title: string;
  description: string;
  sport: string | null;
  metric: ChallengeMetric;
  targetValue: number;
  startsAt: string;
  endsAt: string;
  badgeTitle: string;
  badgeIcon: string;
}

export interface ClubChallengesPanelProps {
  summaries: readonly ClubChallengeSummary[];
  progress?: readonly ChallengeParticipantProgress[];
  currentUserId: string | null;
  nowIso: string;
  canCreate?: boolean;
  loading?: boolean;
  error?: string | null;
  onJoin: (challenge: ClubChallenge) => Promise<void> | void;
  onCreate?: (input: ClubChallengeCreateInput) => Promise<void> | void;
  onRetry?: () => void;
}

function challengeWindow(challenge: ClubChallenge, nowIso: string): 'upcoming' | 'active' | 'ended' {
  const now = Date.parse(nowIso);
  if (Date.parse(challenge.startsAt) > now) return 'upcoming';
  if (Date.parse(challenge.endsAt) < now) return 'ended';
  return 'active';
}

/**
 * Défis individuels et de club : progression consolidée, badge et inscription.
 * Le total vient de `computeClubChallengeSummary` (contrat) ; l’écran ne
 * recalcule que la part personnelle, à partir des activités déjà validées.
 */
export function ClubChallengesPanel({
  summaries,
  progress = [],
  currentUserId,
  nowIso,
  canCreate = false,
  loading = false,
  error = null,
  onJoin,
  onCreate,
  onRetry,
}: ClubChallengesPanelProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<ClubChallengeCreateInput>({
    title: '',
    description: '',
    sport: null,
    metric: 'distance_m',
    targetValue: 50_000,
    startsAt: nowIso.slice(0, 10),
    endsAt: new Date(Date.parse(nowIso) + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    badgeTitle: '',
    badgeIcon: '🏅',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const myProgressByChallenge = useMemo(() => {
    const map = new Map<string, ChallengeParticipantProgress>();
    if (!currentUserId) return map;
    for (const entry of progress) {
      if (entry.userId === currentUserId) map.set(entry.challengeId, entry);
    }
    return map;
  }, [currentUserId, progress]);

  const join = async (challenge: ClubChallenge) => {
    setPendingId(challenge.id);
    try {
      await onJoin(challenge);
    } finally {
      setPendingId(null);
    }
  };

  const submitCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (!form.title.trim()) {
      setFormError('Le titre du défi est requis.');
      return;
    }
    if (!Number.isFinite(form.targetValue) || form.targetValue <= 0) {
      setFormError('L’objectif doit être strictement positif.');
      return;
    }
    if (Date.parse(form.endsAt) <= Date.parse(form.startsAt)) {
      setFormError('La fin doit être postérieure au début.');
      return;
    }
    if (!onCreate) return;
    setPendingId('create');
    try {
      await onCreate({
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        sport: form.sport?.trim() || null,
        badgeTitle: form.badgeTitle.trim() || form.title.trim(),
        startsAt: `${form.startsAt}T00:00:00.000Z`,
        endsAt: `${form.endsAt}T23:59:59.000Z`,
      });
      setCreateOpen(false);
    } catch (createError) {
      setFormError(createError instanceof Error ? createError.message : 'Création impossible.');
    } finally {
      setPendingId(null);
    }
  };

  if (loading) {
    return (
      <section className={styles.screen} aria-busy="true" aria-label="Chargement des défis">
        <div className={styles.skeleton} />
        <div className={styles.skeleton} />
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.screen}>
        <div className={styles.alert} role="alert">
          <span aria-hidden="true">⚠</span>
          <div className={styles.grow}>
            <strong>Les défis n’ont pas pu être chargés.</strong>
            <p className={styles.tiny}>{error}</p>
            {onRetry ? (
              <button type="button" className={cx(styles.button, styles.small)} onClick={onRetry}>
                Réessayer
              </button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.screen} aria-label="Défis du club">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>Défis · progression</p>
          <h2 className={styles.title}>Défis en cours</h2>
          <p className={styles.subtitle}>
            Un défi de club additionne les activités validées de ses membres ; un défi individuel
            attribue son badge au premier objectif atteint.
          </p>
        </div>
        {canCreate && onCreate ? (
          <button
            type="button"
            className={cx(styles.button, styles.small, styles.primary)}
            onClick={() => setCreateOpen((open) => !open)}
            aria-expanded={createOpen}
          >
            {createOpen ? 'Fermer' : 'Créer un défi'}
          </button>
        ) : null}
      </div>

      {createOpen && canCreate && onCreate ? (
        <form className={styles.card} onSubmit={(event) => void submitCreate(event)}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>Nouveau défi</h3>
          </div>
          <div className={styles.formRow}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="g02-challenge-title">
                Titre
              </label>
              <input
                id="g02-challenge-title"
                className={styles.input}
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="g02-challenge-sport">
                Sport (facultatif)
              </label>
              <input
                id="g02-challenge-sport"
                className={styles.input}
                value={form.sport ?? ''}
                onChange={(event) => setForm((current) => ({ ...current, sport: event.target.value }))}
              />
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="g02-challenge-description">
              Description
            </label>
            <textarea
              id="g02-challenge-description"
              className={styles.textarea}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
          </div>
          <div className={styles.formRow}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="g02-challenge-metric">
                Métrique
              </label>
              <select
                id="g02-challenge-metric"
                className={styles.select}
                value={form.metric}
                onChange={(event) =>
                  setForm((current) => ({ ...current, metric: event.target.value as ChallengeMetric }))
                }
              >
                {METRICS.map((metric) => (
                  <option key={metric} value={metric}>
                    {METRIC_LABELS[metric]}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="g02-challenge-target">
                Objectif ({form.metric === 'duration_s' ? 'secondes' : form.metric === 'activities_count' ? 'sorties' : form.metric === 'distance_m' ? 'mètres' : 'mètres D+'})
              </label>
              <input
                id="g02-challenge-target"
                className={styles.input}
                inputMode="numeric"
                value={form.targetValue}
                onChange={(event) =>
                  setForm((current) => ({ ...current, targetValue: Number(event.target.value) }))
                }
              />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="g02-challenge-start">
                Début
              </label>
              <input
                id="g02-challenge-start"
                className={styles.input}
                type="date"
                value={form.startsAt}
                onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="g02-challenge-end">
                Fin
              </label>
              <input
                id="g02-challenge-end"
                className={styles.input}
                type="date"
                value={form.endsAt}
                onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))}
              />
            </div>
          </div>
          {formError ? (
            <p className={styles.tiny} role="alert" style={{ color: 'var(--lkv-danger-dark)' }}>
              {formError}
            </p>
          ) : null}
          <div>
            <button type="submit" className={cx(styles.button, styles.primary)} disabled={pendingId === 'create'}>
              {pendingId === 'create' ? 'Création…' : 'Créer le défi'}
            </button>
          </div>
        </form>
      ) : null}

      {summaries.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Aucun défi pour le moment</p>
          <p className={styles.emptyHint}>
            Un administrateur peut lancer un défi de distance, de durée, de dénivelé ou de sorties.
          </p>
        </div>
      ) : (
        <ul className={styles.list}>
          {summaries.map((summary) => {
            const { challenge } = summary;
            const state = challengeWindow(challenge, nowIso);
            const view = challengeProgress(challenge, summary.totalProgressValue);
            const mine = myProgressByChallenge.get(challenge.id);
            const busy = pendingId === challenge.id;
            return (
              <li key={challenge.id}>
                <article className={styles.card} aria-label={challenge.title}>
                  <div className={styles.cardHeader}>
                    <div>
                      <div className={styles.wrap}>
                        <span className={styles.badge}>{scopeLabel(challenge.scope)}</span>
                        <span className={styles.badge}>{challenge.sport ?? 'Tous sports'}</span>
                        <span className={styles.badge}>{METRIC_LABELS[challenge.metric]}</span>
                        {state === 'ended' ? <span className={styles.badge}>Terminé</span> : null}
                        {summary.isCompleted ? (
                          <span className={cx(styles.badge, styles.badgeSage)}>
                            {summary.badgeAwarded?.icon ?? '🏅'} Badge obtenu
                          </span>
                        ) : null}
                      </div>
                      <h3 className={styles.cardTitle} style={{ marginTop: 6 }}>
                        {challenge.title}
                      </h3>
                      <p className={styles.cardMeta}>{challenge.description}</p>
                    </div>
                    <span className={styles.badge}>
                      {summary.participantsCount} participant{summary.participantsCount > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div
                    className={styles.progressTrack}
                    role="progressbar"
                    aria-label={`${view.pct} % de l’objectif`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={view.pct}
                  >
                    <div className={styles.progressBar} style={{ width: `${view.pct}%` }} />
                  </div>
                  <div className={styles.progressMeta}>
                    <span>
                      {view.totalLabel} / {view.targetLabel}
                    </span>
                    <span>{view.remainingLabel}</span>
                  </div>

                  <div className={styles.rowBetween}>
                    <p className={styles.tiny} style={{ margin: 0 }}>
                      {formatEventDate(challenge.startsAt)} → {formatEventDate(challenge.endsAt)}
                      {mine
                        ? ` · votre part : ${formatMetricValue(challenge.metric, mine.currentValue)}`
                        : ''}
                      {mine?.badge ? ` · badge ${mine.badge.title}` : ''}
                    </p>
                    {state !== 'ended' && !mine ? (
                      <button
                        type="button"
                        className={cx(styles.button, styles.small, styles.primary)}
                        disabled={busy}
                        onClick={() => void join(challenge)}
                      >
                        {busy ? 'Inscription…' : 'Rejoindre le défi'}
                      </button>
                    ) : null}
                    {state === 'ended' && !summary.isCompleted ? (
                      <span className={styles.badge}>Objectif non atteint</span>
                    ) : null}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default ClubChallengesPanel;
