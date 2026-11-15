'use client';

import React, { useState } from 'react';
import { Flag, Scale } from 'lucide-react';
import {
  contestEffortExclusion,
  flagSegmentEffort,
  type EffortFlagCategory,
  type EffortFlagRecord,
  type EffortReviewRecord,
  type SegmentEffort,
  type SegmentDefinition,
} from '@/features/segments';
import { FLAG_LABELS, formatClock } from './format';

const FLAG_OPTIONS = Object.keys(FLAG_LABELS) as EffortFlagCategory[];

export interface SegmentEffortFlagFormProps {
  segment: SegmentDefinition;
  effort: SegmentEffort;
  viewerUserId: string;
  existingFlags: EffortFlagRecord[];
  reporterFlagsLastHour?: number;
  busy?: boolean;
  onFlag?: (input: { category: EffortFlagCategory; comment: string }) => void;
  onContest?: (input: { justification: string }) => void;
}

function fallbackReview(effort: SegmentEffort, flagsCount: number): EffortReviewRecord {
  return {
    effortId: effort.effortId,
    segmentId: effort.segmentId,
    ownerUserId: effort.userId,
    machineReasons: effort.exclusionReasons.filter((reason) => reason !== 'flagged_by_community'),
    communityFlagsCount: flagsCount,
    status:
      effort.status === 'excluded'
        ? 'excluded'
        : effort.status === 'under_review'
          ? 'under_review'
          : 'valid',
    redactedSummary: {
      elapsedDurationS: effort.elapsedDurationS,
      avgSpeedKmh: effort.avgSpeedKmh,
      maxSpeedKmh: effort.maxSpeedKmh,
      sport: effort.sport,
    },
  };
}

/** S4.12 — signalement d'un temps suspect et contestation par son propriétaire. */
export function SegmentEffortFlagForm({
  segment,
  effort,
  viewerUserId,
  existingFlags,
  reporterFlagsLastHour = 0,
  busy = false,
  onFlag,
  onContest,
}: SegmentEffortFlagFormProps) {
  const [category, setCategory] = useState<EffortFlagCategory>('motorized_vehicle');
  const [comment, setComment] = useState('');
  const [justification, setJustification] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [contestError, setContestError] = useState<string | null>(null);

  const isOwnEffort = effort.userId === viewerUserId;

  function handleFlag(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const result = flagSegmentEffort({
      effort,
      existingFlags,
      reporterUserId: viewerUserId,
      reporterFlagsLastHour,
      category,
      comment,
    });
    if (!result.accepted) {
      setError(
        result.reason === 'self_flag_not_allowed'
          ? 'Vous ne pouvez pas signaler votre propre effort.'
          : result.reason === 'duplicate_reporter'
            ? 'Vous avez déjà signalé cet effort.'
            : result.reason === 'rate_limit_exceeded'
              ? 'Trop de signalements en une heure.'
              : 'Le commentaire doit contenir au moins 3 caractères.'
      );
      return;
    }
    onFlag?.({ category, comment: comment.trim() });
    setComment('');
  }

  function handleContest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setContestError(null);
    const result = contestEffortExclusion({
      effort,
      reviewRecord: fallbackReview(effort, existingFlags.length),
      requesterUserId: viewerUserId,
      justification,
    });
    if (!result.allowed) {
      setContestError(
        justification.trim().length < 5
          ? 'Expliquez votre contestation en au moins 5 caractères.'
          : 'Cette exclusion ne peut pas être contestée (trace incomplète, mauvais sens ou activité manuelle).'
      );
      return;
    }
    onContest?.({ justification: justification.trim() });
    setJustification('');
  }

  return (
    <section className="lkdv-seg-flag" aria-labelledby="segment-flag-title">
      <header>
        <div>
          <p className="lkdv-seg-eyebrow">S4.12 · Effort</p>
          <h3 id="segment-flag-title">
            {isOwnEffort ? 'Contester cet effort' : 'Signaler un temps suspect'}
          </h3>
        </div>
        <span className={`lkdv-seg-badge${effort.status === 'valid' ? ' verified' : ' danger'}`}>
          {effort.status === 'valid' ? 'Validé' : effort.status}
        </span>
      </header>

      <dl className="lkdv-seg-effort-facts">
        <div>
          <dt>Temps</dt>
          <dd>{formatClock(effort.elapsedDurationS)}</dd>
        </div>
        <div>
          <dt>Vitesse moy.</dt>
          <dd>{effort.avgSpeedKmh.toFixed(1)} km/h</dd>
        </div>
        <div>
          <dt>Vitesse max</dt>
          <dd>{effort.maxSpeedKmh.toFixed(1)} km/h</dd>
        </div>
        <div>
          <dt>GPS</dt>
          <dd>{Math.round(effort.gpsQuality * 100)} %</dd>
        </div>
      </dl>

      {isOwnEffort ? (
        <form className="lkdv-seg-flag-form" onSubmit={handleContest}>
          <label>
            <span>Votre contestation</span>
            <textarea
              rows={3}
              minLength={5}
              maxLength={1000}
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              placeholder="Expliquez pourquoi ce temps est valide…"
              required
            />
          </label>
          {contestError ? (
            <p className="lkdv-seg-error" role="alert">
              {contestError}
            </p>
          ) : null}
          <button type="submit" className="lkdv-seg-btn primary" disabled={busy}>
            <Scale size={16} aria-hidden="true" />
            {busy ? 'Envoi…' : 'Contester l’exclusion'}
          </button>
        </form>
      ) : (
        <form className="lkdv-seg-flag-form" onSubmit={handleFlag}>
          <label>
            <span>Motif</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as EffortFlagCategory)}
            >
              {FLAG_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {FLAG_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Commentaire</span>
            <textarea
              rows={3}
              minLength={3}
              maxLength={500}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Ce que vous avez observé…"
              required
            />
          </label>
          {error ? (
            <p className="lkdv-seg-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="lkdv-seg-btn primary" disabled={busy}>
            <Flag size={16} aria-hidden="true" />
            {busy ? 'Envoi…' : 'Signaler l’effort'}
          </button>
        </form>
      )}

      <p className="lkdv-seg-form-hint">
        Segment {segment.name} · aucune coordonnée GPS brute d’autrui n’est affichée.
      </p>
    </section>
  );
}

export default SegmentEffortFlagForm;
