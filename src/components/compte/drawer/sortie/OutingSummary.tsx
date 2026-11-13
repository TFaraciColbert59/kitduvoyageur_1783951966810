'use client';

import React, { useEffect, useState } from 'react';
import { Check, Download, Eye, Pencil, Share2, ShieldCheck, Trash2, X } from 'lucide-react';
import { ActionPill } from '@/components/ui/ActionPill';
import type { OutingDetail, OutingVisibility } from '@/features/compte/server/sorties';
import type { OutingMetricKey } from '@/features/compte/domain/metricVisibility';
import { OutingMetricSettings } from './OutingMetricSettings';
import {
  ElevationProfile,
  TraceMap,
  formatDate,
  formatDuration,
  formatNumber,
  hasVisibleTrace,
  metricDisplay,
  outingMetricVisible,
  traceUnavailableState,
  visibleTraceSegments,
} from './shared';

export interface OutingSummaryProps {
  detail: OutingDetail;
  saving: boolean;
  onSave: (patch: { title: string; notes: string; visibility: OutingVisibility }) => void;
  onSaveMetrics: (keys: OutingMetricKey[]) => void;
  onResetMetrics: () => void;
  onShare: () => void;
  onExport: () => void;
  onDelete: () => void;
}

const STATUS_LABEL: Record<OutingDetail['status'], string> = {
  planned: 'À venir',
  ongoing: 'En cours',
  done: 'Terminée',
};

export function OutingSummary({
  detail,
  saving,
  onSave,
  onSaveMetrics,
  onResetMetrics,
  onShare,
  onExport,
  onDelete,
}: OutingSummaryProps) {
  const [editing, setEditing] = useState(false);
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [title, setTitle] = useState(detail.title);
  const [notes, setNotes] = useState(detail.notes);
  const [visibility, setVisibility] = useState<OutingVisibility>(detail.visibility);
  const [coverFailed, setCoverFailed] = useState(false);

  useEffect(() => {
    setTitle(detail.title);
    setNotes(detail.notes);
    setVisibility(detail.visibility);
    setEditing(false);
  }, [detail.id, detail.title, detail.notes, detail.visibility]);

  useEffect(() => {
    setMetricsOpen(false);
  }, [detail.id]);

  const companions = detail.participants.filter((person) => !person.isOwner);
  const showCover = Boolean(detail.coverUrl) && !coverFailed;
  const context = companions.map((person) => person.name).slice(0, 3).join(', ');
  const segments = visibleTraceSegments(detail);
  const hasTrace = hasVisibleTrace(detail);
  const traceState = traceUnavailableState(detail);
  const metricsHidden = detail.metricsMasked && !detail.canEdit;
  const maxAltitudeM = detail.maxAlt;

  return (
    <div className="lkdv-sortie-summary">
      <div className={`lkdv-sortie-hero ${showCover ? 'has-photo' : ''}`}>
        {showCover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={detail.coverUrl ?? ''}
            alt=""
            className="lkdv-sortie-hero-img"
            onError={() => setCoverFailed(true)}
          />
        ) : (
          <TraceMap segments={segments} className="lkdv-sortie-hero-map" />
        )}
        <div className="lkdv-sortie-hero-scrim" aria-hidden="true" />
        {!editing ? (
          <div className="lkdv-sortie-hero-tools lkdv-apill-row">
            <ActionPill tone="primary" label="Partager" icon={<Share2 />} onClick={onShare} />
            {detail.canEdit ? <ActionPill label="Modifier" icon={<Pencil />} onClick={() => setEditing(true)} /> : null}
            <ActionPill
              label={!hasTrace ? traceState.title : 'Télécharger le GPX'}
              icon={<Download />}
              onClick={onExport}
              disabled={!hasTrace}
            />
          </div>
        ) : null}
        <div className="lkdv-sortie-hero-body">
          <div className="lkdv-sortie-hero-badges">
            {detail.verified ? (
              <span className="lkdv-sortie-badge proof">
                <ShieldCheck size={12} aria-hidden="true" /> Empreinte vérifiée
              </span>
            ) : null}
            <span className={`lkdv-sortie-badge state ${detail.status}`}>{STATUS_LABEL[detail.status]}</span>
          </div>
          <h2>{detail.title}</h2>
          <p>
            {formatDate(detail.date)}
            {detail.massif ? ` · ${detail.massif}` : ''}
          </p>
          {context ? <p className="lkdv-sortie-hero-with">avec {context}</p> : null}
        </div>
      </div>

      <div className="lkdv-sortie-tiles">
        <div>
          <small>Distance</small>
          <b>{metricDisplay(detail, 'distance', detail.km, (value) => `${formatNumber(value)} km`)}</b>
        </div>
        <div>
          <small>Dénivelé</small>
          <b>{metricDisplay(detail, 'elevationGain', detail.dplus, (value) => `+${formatNumber(value)} m`)}</b>
        </div>
        <div>
          <small>Alt. max</small>
          <b>{metricDisplay(detail, 'maxAltitude', detail.maxAlt, (value) => `${formatNumber(value)} m`)}</b>
        </div>
        <div>
          <small>Durée</small>
          <b>{metricDisplay(detail, 'duration', detail.durationS, (value) => formatDuration(value))}</b>
        </div>
      </div>
      {metricsHidden ? (
        <p className="lkdv-sortie-notes">
          Certaines métriques d’effort ne sont pas partagées par le propriétaire.
        </p>
      ) : null}

      {detail.canEdit ? (
        <section className="lkdv-sortie-section">
          <header>
            <b>Métriques partagées</b>
            <span>
              {detail.shareMetricsConfigured ? 'Réglage enregistré' : 'Socle par défaut'}
            </span>
          </header>
          {metricsOpen ? (
            <OutingMetricSettings
              detail={detail}
              saving={saving}
              onSave={onSaveMetrics}
              onReset={onResetMetrics}
              onClose={() => setMetricsOpen(false)}
            />
          ) : (
            <>
              <p className="lkdv-sortie-proof">
                Choisis, métrique par métrique, ce que les personnes avec qui tu
                partages cette sortie peuvent voir.
              </p>
              <div className="lkdv-apill-row">
                <ActionPill
                  label="Choisir les métriques partagées"
                  icon={<Eye />}
                  text="Choisir"
                  onClick={() => setMetricsOpen(true)}
                />
              </div>
            </>
          )}
        </section>
      ) : null}

      {editing ? (
        <form
          className="lkdv-sortie-edit"
          onSubmit={(event) => {
            event.preventDefault();
            onSave({ title: title.trim(), notes, visibility });
          }}
        >
          <label>
            <span>Titre</span>
            <input
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Titre de la sortie"
              required
            />
          </label>
          <label>
            <span>Récit</span>
            <textarea
              value={notes}
              maxLength={2000}
              rows={3}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Deux ou trois phrases sur cette sortie…"
            />
          </label>
          <label>
            <span>Visibilité</span>
            <select value={visibility} onChange={(event) => setVisibility(event.target.value as OutingVisibility)}>
              <option value="private">Privé</option>
              <option value="collective_anonymized">Collectif anonymisé</option>
            </select>
          </label>
          <div className="lkdv-sortie-edit-actions lkdv-apill-row">
            <ActionPill label="Annuler" icon={<X />} onClick={() => setEditing(false)} />
            <ActionPill type="submit" tone="primary" label="Enregistrer" icon={<Check />} busy={saving} disabled={!title.trim()} />
          </div>
        </form>
      ) : (
        detail.notes ? <p className="lkdv-sortie-notes">{detail.notes}</p> : null
      )}

      <section className="lkdv-sortie-section">
        <header>
          <b>Profil altimétrique</b>
          <span>
            {!outingMetricVisible(detail, 'elevation')
              ? 'Non partagé'
              : outingMetricVisible(detail, 'maxAltitude') &&
                  typeof maxAltitudeM === 'number' &&
                  Number.isFinite(maxAltitudeM)
                ? `${formatNumber(maxAltitudeM)} m au plus haut`
                : 'Profil partagé'}
          </span>
        </header>
        {outingMetricVisible(detail, 'elevation') ? (
          <ElevationProfile segments={segments} />
        ) : (
          <div className="lkdv-sortie-trace-empty">Profil altimétrique non partagé</div>
        )}
      </section>

      <section className="lkdv-sortie-section">
        <header>
          <b>Preuve terrain</b>
          <span>{detail.verified ? 'Trace GPS présente' : 'Sans trace GPS'}</span>
        </header>
      </section>

      {detail.canEdit ? (
        <section className="lkdv-sortie-danger">
          {confirmDelete ? (
            <>
              <p>Supprimer la sortie et tout son contenu ?</p>
              <div className="lkdv-sortie-edit-actions lkdv-apill-row">
                <ActionPill label="Annuler" icon={<X />} onClick={() => setConfirmDelete(false)} />
                <ActionPill tone="danger" label="Supprimer" icon={<Trash2 />} onClick={onDelete} />
              </div>
            </>
          ) : (
            <button type="button" className="lkdv-sortie-danger-link" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} aria-hidden="true" /> Supprimer cette sortie
            </button>
          )}
        </section>
      ) : null}
    </div>
  );
}

export default OutingSummary;
