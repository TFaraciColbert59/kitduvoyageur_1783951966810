'use client';

import React, { useEffect, useState } from 'react';
import {
  Check,
  Download,
  Eye,
  Fingerprint,
  Pencil,
  Share2,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { ActionPill } from '@/components/ui/ActionPill';
import type {
  OutingDetail,
  OutingImportProvenance,
  OutingVisibility,
} from '@/features/compte/server/sorties';
import type { OutingMetricKey } from '@/features/compte/domain/metricVisibility';
import { estimateAvoidedCarbon } from '@/features/offers';
import type { ActivityEventMatch, GroupActivityCluster } from '@/features/clubs';
import { OutingMetricSettings } from './OutingMetricSettings';
import { OutingLaps } from './OutingLaps';
import { OutingMetrics } from './OutingMetrics';
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

const IMPORT_SOURCE_LABEL: Record<OutingImportProvenance['source'], string> = {
  fit: 'FIT',
  tcx: 'TCX',
  gpx: 'GPX',
};

function formatSourceBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes >= 1024 * 1024) return `${formatNumber(bytes / (1024 * 1024))} Mo`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} ko`;
  return `${bytes} o`;
}

function formatImportDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

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
  const [matchedEvents, setMatchedEvents] = useState<ActivityEventMatch[]>([]);
  const [groupClusters, setGroupClusters] = useState<GroupActivityCluster[]>([]);
  const [matchEventsById, setMatchEventsById] = useState<Record<string, { title: string; sport: string }>>({});
  const [matchMemberNames, setMatchMemberNames] = useState<Record<string, string>>({});

  useEffect(() => {
    setTitle(detail.title);
    setNotes(detail.notes);
    setVisibility(detail.visibility);
    setEditing(false);
  }, [detail.id, detail.title, detail.notes, detail.visibility]);

  useEffect(() => {
    let active = true;
    fetch(`/api/clubs/matching?activityId=${encodeURIComponent(detail.id)}`, {
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) return;
        const payload = (await res.json()) as {
          data?: {
            matches?: ActivityEventMatch[];
            clusters?: GroupActivityCluster[];
            eventsById?: Record<string, { title: string; sport: string }>;
            memberNames?: Record<string, string>;
          };
        };
        if (!active || !payload?.data) return;
        setMatchedEvents((payload.data.matches ?? []).filter((m) => !m.detachedAt));
        setGroupClusters(payload.data.clusters ?? []);
        setMatchEventsById(payload.data.eventsById ?? {});
        setMatchMemberNames(payload.data.memberNames ?? {});
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [detail.id]);

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
  // Double garde : le serveur ne renvoie la provenance qu'au propriétaire, et
  // l'interface ne l'affiche pas si un rôle de lecture non propriétaire arrive
  // un jour à la recevoir.
  const provenance = detail.canEdit ? detail.provenance : null;
  const distanceAuthorized =
    detail.canEdit || outingMetricVisible(detail, 'distance');
  const avoidedCarbon = estimateAvoidedCarbon({
    sport: detail.sport,
    distanceKm: detail.km,
    authorized: distanceAuthorized,
    titleOrTags: `${detail.title} ${detail.notes}`,
  });

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
            {provenance ? (
              <span className="lkdv-sortie-badge">
                <Fingerprint size={12} aria-hidden="true" /> Import{' '}
                {IMPORT_SOURCE_LABEL[provenance.source]}
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
      {avoidedCarbon.eligible && avoidedCarbon.kgCo2Avoided !== null ? (
        <section
          className="lkdv-sortie-section lkdv-sortie-carbon"
          aria-label="Estimation de carbone évité"
        >
          <header>
            <b>Carbone évité</b>
            <span>
              −
              {new Intl.NumberFormat('fr-FR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }).format(avoidedCarbon.kgCo2Avoided)}{' '}
              kg CO2e
            </span>
          </header>
          <p className="lkdv-sortie-proof">
            {avoidedCarbon.assumptions} {avoidedCarbon.scope}
          </p>
        </section>
      ) : null}
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
              <option value="private">Moi uniquement (Privé)</option>
              <option value="followers">Mes abonnés</option>
              <option value="public">Public</option>
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

      {matchedEvents.length > 0 || groupClusters.length > 0 ? (
        <section className="lkdv-sortie-section" data-testid="outing-club-matching">
          <header>
            <b>Sorties club & groupe</b>
            <span>{matchedEvents.length > 0 ? 'Appariement auto' : 'Détection groupe'}</span>
          </header>
          {matchedEvents.map((match) => {
            const meta = matchEventsById[match.eventId];
            return (
              <div
                key={match.id}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
              >
                <p className="lkdv-sortie-proof" style={{ margin: 0 }}>
                  Sortie club rattachée : <b>{meta?.title ?? match.eventId.slice(0, 8)}</b>
                </p>
                {detail.canEdit ? (
                  <ActionPill
                    label="Détacher"
                    icon={<X />}
                    onClick={async () => {
                      const res = await fetch('/api/clubs/matching', {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'detach', matchId: match.id }),
                      });
                      if (res.ok) {
                        setMatchedEvents((prev) => prev.filter((item) => item.id !== match.id));
                      }
                    }}
                  />
                ) : null}
              </div>
            );
          })}
          {groupClusters.map((cluster) => (
            <p key={cluster.id} className="lkdv-sortie-proof">
              Activité en groupe détectée ({cluster.participantUserIds.length} participants) :{' '}
              {cluster.participantUserIds
                .map((uid) => matchMemberNames[uid] ?? uid.slice(0, 8))
                .join(', ')}
            </p>
          ))}
        </section>
      ) : null}

      {provenance ? (
        <section className="lkdv-sortie-section" data-testid="outing-provenance">
          <header>
            <b>Provenance de l’import</b>
            <span>Import privé</span>
          </header>
          <div className="lkdv-sortie-grid">
            <div>
              <small>Format</small>
              <b>{IMPORT_SOURCE_LABEL[provenance.source]}</b>
            </div>
            <div>
              <small>Taille source</small>
              <b>{formatSourceBytes(provenance.byteLength)}</b>
            </div>
            <div>
              <small>Importé le</small>
              <b>{formatImportDate(provenance.importedAt)}</b>
            </div>
          </div>
          <p
            className="lkdv-sortie-proof"
            style={{ overflowWrap: 'anywhere' }}
            title={provenance.fileName ?? undefined}
          >
            {provenance.fileName
              ? `Fichier : ${provenance.fileName}`
              : 'Nom du fichier non renseigné.'}
          </p>
          <p className="lkdv-sortie-proof">
            Empreinte du fichier :{' '}
            <span
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                overflowWrap: 'anywhere',
              }}
            >
              {provenance.fingerprint.slice(0, 22)}…
            </span>
          </p>
        </section>
      ) : null}

      {provenance && (provenance.source === 'fit' || provenance.source === 'tcx') ? (
        detail.laps == null ? (
          <section className="lkdv-sortie-section" data-testid="outing-laps-unavailable">
            <header>
              <b>Tours du fichier</b>
              <span>Indisponibles</span>
            </header>
            <p className="lkdv-sortie-proof">
              La persistance des tours n’est pas encore disponible ou la lecture a échoué.
              La sortie reste entièrement lisible ; aucun tour n’est inventé.
            </p>
          </section>
        ) : detail.laps.length === 0 ? (
          <section className="lkdv-sortie-section" data-testid="outing-laps-empty">
            <header>
              <b>Tours du fichier</b>
              <span>Aucun tour conservé</span>
            </header>
            <p className="lkdv-sortie-proof">
              Aucun tour n’est enregistré pour cet import. Les imports antérieurs à la
              persistance des tours ne peuvent pas être complétés rétroactivement.
            </p>
          </section>
        ) : (
          <OutingLaps laps={detail.laps} />
        )
      ) : null}

      {provenance && (provenance.source === 'fit' || provenance.source === 'tcx') ? (
        <OutingMetrics summary={detail.summary ?? null} samples={detail.samples ?? null} />
      ) : null}

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
