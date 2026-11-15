'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, BellOff, ShieldCheck } from 'lucide-react';
import {
  evaluateSegmentHazardStatus,
  reportSegmentHazard,
  type SegmentDefinition,
  type SegmentHazardCategory,
  type SegmentHazardReport,
  type SubmitSegmentHazardResult,
} from '@/features/segments';
import { HAZARD_LABELS } from './format';

const HAZARD_OPTIONS = Object.keys(HAZARD_LABELS) as SegmentHazardCategory[];

export interface SegmentHazardReportFormProps {
  segment: SegmentDefinition;
  existingReports: SegmentHazardReport[];
  viewerUserId: string;
  reporterReportsLastHour?: number;
  busy?: boolean;
  onReport: (result: SubmitSegmentHazardResult, input: { category: SegmentHazardCategory; description: string }) => void;
  onResolve?: () => void;
}

/** S4.11 — signalement d'un danger, exclusion du classement et arrêt des notifications. */
export function SegmentHazardReportForm({
  segment,
  existingReports,
  viewerUserId,
  reporterReportsLastHour = 0,
  busy = false,
  onReport,
  onResolve,
}: SegmentHazardReportFormProps) {
  const [category, setCategory] = useState<SegmentHazardCategory>('dangerous_road_or_traffic');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const evaluation = useMemo(
    () => evaluateSegmentHazardStatus(segment, existingReports),
    [segment, existingReports]
  );

  const activeReports = existingReports.filter(
    (report) =>
      report.segmentId === segment.id &&
      (report.status === 'active' || report.status === 'pending')
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const result = reportSegmentHazard({
      segment,
      existingReports,
      efforts: [],
      reporterUserId: viewerUserId,
      reporterReportsLastHour,
      category,
      description,
    });

    if (!result.accepted) {
      setError(
        result.rejectionReason === 'rate_limit_exceeded'
          ? 'Trop de signalements en une heure. Réessayez plus tard.'
          : result.rejectionReason === 'duplicate_reporter'
            ? 'Vous avez déjà signalé ce segment.'
            : 'La description doit contenir au moins 5 caractères.'
      );
      return;
    }

    onReport(result, { category, description: description.trim() });
    setDescription('');
  }

  return (
    <section className="lkdv-seg-hazard" aria-labelledby="segment-hazard-title">
      <header>
        <div>
          <p className="lkdv-seg-eyebrow">S4.11 · Sécurité</p>
          <h3 id="segment-hazard-title">Danger sur ce segment</h3>
        </div>
        {evaluation.hazardous ? (
          <span className="lkdv-seg-badge danger">
            <AlertTriangle size={13} aria-hidden="true" /> Danger actif
          </span>
        ) : (
          <span className="lkdv-seg-badge verified">
            <ShieldCheck size={13} aria-hidden="true" /> Aucun danger actif
          </span>
        )}
      </header>

      {evaluation.hazardous ? (
        <div className="lkdv-seg-hazard-banner" role="status">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>{evaluation.safetyBannerMessage}</strong>
            <p>
              <BellOff size={14} aria-hidden="true" /> Les notifications de compétition sont coupées
              et tous les efforts sont retirés du classement public.
            </p>
          </div>
        </div>
      ) : null}

      {activeReports.length > 0 ? (
        <ul className="lkdv-seg-report-list">
          {activeReports.map((report) => (
            <li key={report.reportId}>
              <span>{HAZARD_LABELS[report.category]}</span>
              <p>{report.description}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <form className="lkdv-seg-hazard-form" onSubmit={handleSubmit}>
        <label>
          <span>Nature du danger</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as SegmentHazardCategory)}
          >
            {HAZARD_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {HAZARD_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Description</span>
          <textarea
            rows={3}
            minLength={5}
            maxLength={1000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Décrivez le danger pour les autres pratiquants…"
            required
          />
        </label>
        {error ? (
          <p className="lkdv-seg-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="lkdv-seg-form-actions">
          <button type="submit" className="lkdv-seg-btn primary" disabled={busy}>
            {busy ? 'Envoi…' : 'Signaler le danger'}
          </button>
          {onResolve && segment.hazardous && segment.createdByUserId === viewerUserId ? (
            <button type="button" className="lkdv-seg-btn ghost" onClick={onResolve} disabled={busy}>
              Lever le danger
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

export default SegmentHazardReportForm;
