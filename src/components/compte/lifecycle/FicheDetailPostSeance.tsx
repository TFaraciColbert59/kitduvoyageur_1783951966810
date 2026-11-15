'use client';

/**
 * Lot A02 — fiche détaillée post-séance (K5.04, K5.10, S1.17, S1.20, S1.23, S2.01).
 *
 * Affiche uniquement des mesures réelles : un canal absent est « Non mesuré »,
 * une altitude absente est « — ». Le profil est construit depuis la géométrie
 * du contrat, jamais depuis une valeur inventée.
 */

import React, { useMemo } from 'react';
import {
  ArrowLeft,
  Images,
  MapPin,
  Pencil,
  RotateCcw,
  Scissors,
  SlidersHorizontal,
  Trash2,
  Zap,
} from 'lucide-react';
import type {
  ActivityDerivedStats,
  LifecycleActivityRecord,
  LifecycleRevision,
  SensorChannelSummary,
} from '@/features/compte/lifecycle';
import {
  channelStatusLabel,
  correctionMethodLabel,
  formatChannel,
  formatDateTime,
  formatDistanceKm,
  formatDuration,
  formatElevation,
  formatPace,
  formatSpeed,
  formatSplitPace,
  recordReasonLabel,
  sportLabel,
  tagLabel,
  visibilityLabel,
} from './format';
import { buildTraceGeometry, hasGeometryChanges } from './trace';
import { Chip, Notice, Section, Sheet, Stat, StatGrid } from './primitives';
import type { LifecycleSubDrawer, UiNotice } from './types';

const REVISION_LABELS: Readonly<Record<LifecycleRevision['kind'], string>> = {
  initial: 'Création',
  metadata_edit: 'Métadonnées',
  sport_and_tags_edit: 'Sport et tags',
  quick_edit_sync: 'Édition rapide',
  media_edit: 'Médias',
  crop: 'Recadrage',
  split: 'Fractionnement',
  gps_spike_smoothing: 'Pics GPS',
  distance_elevation_correction: 'Correction D+',
  revert_transformation: 'Annulation',
  soft_delete: 'Corbeille',
  restore: 'Restauration',
};

function Sensor({
  label,
  channel,
  unit,
}: {
  label: string;
  channel: SensorChannelSummary;
  unit: string;
}) {
  return (
    <div className="lkv-life__sensor">
      <b>
        {label} <Chip>{channelStatusLabel(channel)}</Chip>
      </b>
      <small>
        {channel.status === 'unavailable' ? 'Aucune mesure' : formatChannel(channel, unit)}
      </small>
    </div>
  );
}

export interface FicheDetailPostSeanceProps {
  record: LifecycleActivityRecord;
  busy?: boolean;
  loading?: boolean;
  notice?: UiNotice | null;
  onClose: () => void;
  onAction: (action: LifecycleSubDrawer) => void;
  onRestoreGeometry?: () => void;
  onRevertCorrection?: () => void;
}

export function FicheDetailPostSeance({
  record,
  busy = false,
  loading = false,
  notice = null,
  onClose,
  onAction,
  onRestoreGeometry,
  onRevertCorrection,
}: FicheDetailPostSeanceProps) {
  const stats: ActivityDerivedStats = record.stats;
  const geometry = useMemo(() => buildTraceGeometry(record.points, 340, 104), [record.points]);
  const canRestoreGeometry = useMemo(() => hasGeometryChanges(record), [record]);
  const visibleSplits = stats.splitsKm.slice(0, 8);
  const hiddenSplits = Math.max(0, stats.splitsKm.length - visibleSplits.length);
  const lastRevisions = record.revisions.slice(-4).reverse();
  const hasInvalidation =
    !record.recordsEligibility.eligible || record.recordsEligibility.invalidatedRecords;

  return (
    <Sheet
      title={record.title}
      subtitle={`${sportLabel(record.sport)} · ${formatDateTime(record.startedAt)}`}
      onClose={onClose}
      footer={
        <div className="lkv-life__actions">
          <button
            type="button"
            className="lkv-life__btn"
            onClick={() => onAction('edit_metadata_media')}
            disabled={busy}
          >
            <Pencil size={15} aria-hidden="true" /> Modifier
          </button>
          <button
            type="button"
            className="lkv-life__btn"
            onClick={() => onAction('crop_split')}
            disabled={busy}
          >
            <Scissors size={15} aria-hidden="true" /> Recadrer
          </button>
          <button
            type="button"
            className="lkv-life__btn"
            onClick={() => onAction('correct_distance_elevation')}
            disabled={busy}
          >
            <SlidersHorizontal size={15} aria-hidden="true" /> Corriger
          </button>
          <button
            type="button"
            className="lkv-life__btn"
            data-variant="danger"
            onClick={() => onAction('delete_restore')}
            disabled={busy}
          >
            <Trash2 size={15} aria-hidden="true" /> Supprimer
          </button>
        </div>
      }
    >
      <div data-testid="fiche-detail">
        <div className="lkv-life__chips" aria-label="Contexte de la séance">
          <Chip tone="accent">{sportLabel(record.sport)}</Chip>
          <Chip>{visibilityLabel(record.visibility)}</Chip>
          <Chip>{record.provenance.label}</Chip>
          {record.tags.map((tag) => (
            <Chip key={tag}>{tagLabel(tag)}</Chip>
          ))}
          {record.splitPartIndex !== null ? <Chip>Partie {record.splitPartIndex}</Chip> : null}
        </div>

        {record.quickEditState.visible ? (
          <Notice tone="info">
            Synchronisée récemment.{' '}
            <button
              type="button"
              className="lkv-life__btn"
              data-variant="ghost"
              onClick={() => onAction('quick_edit_sync')}
            >
              Vérifier le titre, le sport et les tags
            </button>
          </Notice>
        ) : null}

        {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

        <section className="lkv-life__hero" aria-label="Résumé de la séance">
          <div>
            <span>Distance</span>
            <strong>{formatDistanceKm(stats.distanceKm)}</strong>
          </div>
          <div>
            <span>Dénivelé +</span>
            <strong>{formatElevation(stats.elevationGainM)}</strong>
          </div>
          <div>
            <span>En mouvement</span>
            <strong>{formatDuration(stats.movingTimeS)}</strong>
          </div>
        </section>

        <Section title="Temps et allure" hint={`${stats.pauseCount} pause(s)`}>
          <StatGrid>
            <Stat label="Temps écoulé" value={formatDuration(stats.elapsedTimeS)} />
            <Stat label="Pauses" value={formatDuration(stats.pauseTimeS)} />
            <Stat label="Allure moyenne" value={formatPace(stats.avgPaceSecondsPerKm)} />
            <Stat label="Vitesse max" value={formatSpeed(stats.maxSpeedKmh)} />
            <Stat label="Vitesse moyenne" value={formatSpeed(stats.avgSpeedKmh)} />
            <Stat label="Pics GPS écartés" value={String(stats.spikeCount)} />
          </StatGrid>
        </Section>

        <Section title="Dénivelé" hint={`${formatElevation(stats.elevationLossM)} de D−`}>
          <StatGrid>
            <Stat label="D+" value={formatElevation(stats.elevationGainM)} />
            <Stat label="D−" value={formatElevation(stats.elevationLossM)} />
            <Stat label="Altitude min." value={formatElevation(stats.minAltitudeM)} />
            <Stat label="Altitude max." value={formatElevation(stats.maxAltitudeM)} />
          </StatGrid>
          {geometry.path ? (
            <svg
              className="lkv-life__profile"
              viewBox="0 0 340 104"
              preserveAspectRatio="none"
              role="img"
              aria-label={
                geometry.hasElevation
                  ? `Profil altimétrique de ${formatElevation(geometry.minElevationM)} à ${formatElevation(geometry.maxElevationM)}`
                  : 'Tracé de la séance, altitude non mesurée'
              }
            >
              {geometry.hasElevation ? <path className="area" d={geometry.area} /> : null}
              <path className="line" d={geometry.path} />
            </svg>
          ) : loading ? (
            <div className="lkv-life__empty" role="status">
              <strong>Chargement de la trace…</strong>
              La fiche s’affiche dès que la géométrie complète est disponible.
            </div>
          ) : (
            <div className="lkv-life__empty">
              <strong>Trace absente</strong>
              Aucun point GPS n’est enregistré pour cette séance.
            </div>
          )}
        </Section>

        <Section title="Capteurs" hint="Jamais extrapolés">
          <div className="lkv-life__sensors">
            <Sensor label="Cardio" channel={stats.heartRate} unit="bpm" />
            <Sensor label="Cadence" channel={stats.cadence} unit="rpm" />
            <Sensor label="Puissance" channel={stats.power} unit="W" />
          </div>
        </Section>

        <Section
          title="Découpe kilométrique"
          hint={hiddenSplits > 0 ? `+${hiddenSplits} km` : undefined}
        >
          {visibleSplits.length === 0 ? (
            <p className="lkv-life__hint">Aucune découpe mesurée sur cette séance.</p>
          ) : (
            <table className="lkv-life__split-table">
              <caption className="lkv-life__sr">Découpe kilométrique</caption>
              <thead>
                <tr>
                  <th scope="col">Km</th>
                  <th scope="col">Allure</th>
                  <th scope="col">Distance</th>
                </tr>
              </thead>
              <tbody>
                {visibleSplits.map((split) => (
                  <tr key={split.index} data-partial={!split.completed}>
                    <td>{split.index}</td>
                    <td>{formatSplitPace(split.distanceM, split.movingS)}</td>
                    <td>
                      {formatDistanceKm(split.distanceM / 1000)}
                      {!split.completed ? ' · partiel' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Lieu et matériel">
          <StatGrid>
            <Stat label="Lieu" value={record.placeLabel ?? record.routeName ?? '—'} />
            <Stat label="Massif" value={record.massif ?? '—'} />
            <Stat label="Kit" value={record.kitId ? 'Rattaché' : '—'} />
            <Stat
              label="Matériel"
              value={record.gearIds.length > 0 ? `${record.gearIds.length} objet(s)` : '—'}
            />
            <Stat label="Photos" value={record.media.length > 0 ? `${record.media.length}` : '—'} />
            <Stat label="Provenance" value={record.provenance.label} />
          </StatGrid>
        </Section>

        {record.media.length > 0 ? (
          <Section title="Médias" hint={`${record.media.length} élément(s)`}>
            <div className="lkv-life__media">
              {record.media.map((item) => (
                <figure key={item.id}>
                  {item.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- média signé fourni par le serveur
                    <img src={item.url} alt={item.caption ?? 'Photo de séance'} loading="lazy" />
                  ) : (
                    <div role="img" aria-label={item.caption ?? 'Média sans aperçu'}>
                      <Images size={18} aria-hidden="true" />
                    </div>
                  )}
                  <figcaption>{item.caption ?? 'Sans légende'}</figcaption>
                </figure>
              ))}
            </div>
          </Section>
        ) : null}

        <Section title="Corrections et records">
          <p className="lkv-life__hint">
            {correctionMethodLabel(
              record.correctionState.distanceMethod,
              record.correctionState.elevationMethod
            )}
            {record.correctionState.appliedAt
              ? ` · appliquée le ${formatDateTime(record.correctionState.appliedAt)}`
              : ''}
          </p>
          {hasInvalidation ? (
            <Notice tone="warning">
              <span>
                {record.recordsEligibility.reasons.length > 0
                  ? record.recordsEligibility.reasons.map(recordReasonLabel).join(' ')
                  : 'Les records automatiques sont invalidés pour cette séance.'}
              </span>
            </Notice>
          ) : (
            <Notice tone="ok">Séance éligible aux records automatiques.</Notice>
          )}
          <div className="lkv-life__actions" style={{ marginTop: 10 }}>
            {record.correctionState.previousSnapshot && onRevertCorrection ? (
              <button
                type="button"
                className="lkv-life__btn"
                onClick={onRevertCorrection}
                disabled={busy}
              >
                <RotateCcw size={15} aria-hidden="true" /> Annuler la correction
              </button>
            ) : null}
            {canRestoreGeometry && onRestoreGeometry ? (
              <button
                type="button"
                className="lkv-life__btn"
                onClick={onRestoreGeometry}
                disabled={busy}
              >
                <ArrowLeft size={15} aria-hidden="true" /> Restaurer la trace d’origine
              </button>
            ) : null}
          </div>
        </Section>

        <Section title="Révisions" hint={`${record.revision} révision(s)`}>
          <ol className="lkv-life__revisions">
            {lastRevisions.map((revision) => (
              <li key={`${revision.revision}-${revision.kind}`}>
                <b>r{revision.revision}</b>
                <span>
                  {REVISION_LABELS[revision.kind]} · {formatDateTime(revision.createdAt)}
                  <br />
                  {revision.summary}
                </span>
              </li>
            ))}
          </ol>
          {record.lastProjectionEvent ? (
            <p className="lkv-life__hint" style={{ marginTop: 8 }}>
              Dernier recalcul des totaux : {record.lastProjectionEvent.kind} ·{' '}
              {formatDateTime(record.lastProjectionEvent.createdAt)}
            </p>
          ) : null}
        </Section>

        <Section title="Repères">
          <StatGrid>
            <Stat label="Départ" value={formatDateTime(record.startedAt)} />
            <Stat label="Fin" value={formatDateTime(record.endedAt)} />
            <Stat
              label="Trace"
              value={`${record.points.length} pts`}
              hint={
                record.originalPoints.length !== record.points.length
                  ? `orig. ${record.originalPoints.length}`
                  : undefined
              }
            />
          </StatGrid>
        </Section>

        <div className="lkv-life__actions" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="lkv-life__btn"
            data-variant="ghost"
            onClick={() => onAction('edit_sport_tags')}
            disabled={busy}
          >
            <Zap size={15} aria-hidden="true" /> Sport et tags
          </button>
          <button
            type="button"
            className="lkv-life__btn"
            data-variant="ghost"
            onClick={() => onAction('edit_metadata_media')}
            disabled={busy}
          >
            <MapPin size={15} aria-hidden="true" /> Titre et visibilité
          </button>
        </div>

        {loading ? (
          <p className="lkv-life__hint" role="status">
            Chargement de la trace…
          </p>
        ) : busy ? (
          <p className="lkv-life__hint" role="status">
            Enregistrement…
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}
