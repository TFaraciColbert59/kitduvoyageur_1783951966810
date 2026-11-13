'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  FileCheck2,
  FileUp,
  Fingerprint,
  Loader2,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { ActionPill } from '@/components/ui/ActionPill';
import { useAuth } from '@/contexts/AuthContext';
import {
  TRACE_IMPORT_LIMITS,
  TraceImportError,
  buildHikeSessionImportPayload,
  buildTraceImportPreview,
  parseTraceFile,
  traceLapsHaveMetrics,
  lapIntensityLabel,
  lapTriggerLabel,
  type NormalizedTraceImport,
  type TraceImportErrorCode,
  type TraceImportIssueCode,
  type TraceImportLapSummary,
  type TraceImportPreview,
} from '@/features/hiking/import';
import { DrawerAuthRequired } from '../shell/DrawerAuthRequired';
import { DRAWER_SHELL_CSS } from '../shell/DrawerShell';
import { TraceMap, formatDuration, formatNumber } from './shared';

type Phase = 'idle' | 'reading' | 'ready' | 'saving' | 'saved';

interface ImportFailure {
  title: string;
  message: string;
  code?: string;
}

interface SavedState {
  sessionId: string;
  existing: boolean;
  title: string;
}

const ERROR_LABELS: Record<TraceImportErrorCode, string> = {
  'invalid-input': 'Format non reconnu',
  'file-too-large': 'Fichier trop volumineux',
  'too-many-points': 'Trop de points',
  'too-many-laps': 'Trop de tours',
  'xml-too-deep': 'Structure trop profonde',
  'invalid-xml': 'XML illisible',
  'external-entity-forbidden': 'Entité externe refusée',
  'not-tcx': 'Ce n’est pas un TCX',
  'unsupported-version': 'Version TCX non prise en charge',
  'no-activity': 'Aucune activité',
  'multiple-activities': 'Plusieurs activités',
  'invalid-structure': 'Structure incohérente',
  'not-fit': 'Ce n’est pas un FIT',
  'fit-integrity': 'FIT incomplet ou corrompu',
  'not-activity': 'Ce FIT n’est pas une activité',
  'too-many-messages': 'Trop de messages FIT',
  'unsupported-feature': 'Fonction non prise en charge',
};

const ISSUE_LABELS: Record<TraceImportIssueCode, string> = {
  'invalid-coordinate': 'coordonnée ignorée',
  'invalid-number': 'nombre ignoré',
  'invalid-time': 'heure ignorée',
  'invalid-time-offset': 'fuseau ignoré',
  'unqualified-time': 'heure sans fuseau',
  'mixed-time-zones': 'fuseaux mélangés',
  'time-out-of-order': 'horodatages désordonnés',
  'missing-position': 'position absente',
  'empty-point': 'point vide',
  'empty-lap': 'tour vide',
  'ignored-section': 'section ignorée',
  'unsupported-feature': 'fonction non prise en charge',
  truncated: 'fichier tronqué',
  'issue-limit': 'liste d’alertes bornée',
};

const METRIC_LABELS: Record<string, string> = {
  time: 'Temps',
  position: 'GPS',
  altitude: 'Altitude',
  distance: 'Distance',
  speed: 'Vitesse',
  heartRate: 'FC',
  cadence: 'Cadence',
  power: 'Puissance',
  temperature: 'Température',
};

function clip(value: string | null | undefined, max = 80): string {
  const text = (value ?? '').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 o';
  if (bytes >= 1024 * 1024) return `${formatNumber(bytes / (1024 * 1024))} Mo`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} ko`;
  return `${bytes} o`;
}

function formatFileDate(trace: NormalizedTraceImport): string {
  const raw = trace.provenance.startedAt ?? trace.provenance.startedAtLocal;
  if (!raw) return 'Date inconnue';
  if (trace.provenance.timeBasis === 'utc') {
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      }).format(date);
    }
  }
  return raw
    .replace('T', ' ')
    .replace(/\.\d+$/, '')
    .slice(0, 19);
}

function formatLapStart(lap: TraceImportLapSummary): string | null {
  const raw = lap.startedAt ?? lap.startedAtLocal;
  if (!raw) return null;
  if (lap.startedAt) {
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    }
  }
  const local = raw.replace('T', ' ').slice(11, 16);
  return local || null;
}

function formatLapDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')} min`;
  if (minutes > 0) return `${minutes} min ${String(rest).padStart(2, '0')} s`;
  return `${rest} s`;
}

/** Métriques réellement présentes dans le tour, sans valeur inventée. */
function lapMetrics(lap: TraceImportLapSummary): string[] {
  const parts: string[] = [];
  if (lap.distanceM !== null) parts.push(`${formatNumber(lap.distanceM / 1000)} km`);
  if (lap.elapsedSeconds !== null) parts.push(formatLapDuration(lap.elapsedSeconds));
  if (lap.averageSpeedMps !== null) {
    parts.push(`moy. ${formatNumber(lap.averageSpeedMps * 3.6)} km/h`);
  }
  if (lap.maxSpeedMps !== null) {
    parts.push(`max ${formatNumber(lap.maxSpeedMps * 3.6)} km/h`);
  }
  if (lap.averageHeartRateBpm !== null || lap.maxHeartRateBpm !== null) {
    const average = lap.averageHeartRateBpm !== null
      ? `${formatNumber(lap.averageHeartRateBpm)} bpm`
      : null;
    const max = lap.maxHeartRateBpm !== null
      ? `max ${formatNumber(lap.maxHeartRateBpm)} bpm`
      : null;
    parts.push([average, max].filter(Boolean).join(' / '));
  }
  if (lap.averageCadenceRpm !== null) {
    parts.push(`${formatNumber(lap.averageCadenceRpm)} tr/min`);
  } else if (lap.averageCadenceSpm !== null) {
    parts.push(`${formatNumber(lap.averageCadenceSpm)} pas/min`);
  }
  if (lap.maxPowerW !== null) parts.push(`max ${formatNumber(lap.maxPowerW)} W`);
  if (lap.caloriesKcal !== null) parts.push(`${formatNumber(lap.caloriesKcal)} kcal`);
  return parts;
}

function timeBasisLabel(basis: NormalizedTraceImport['provenance']['timeBasis']): string {
  if (basis === 'utc') return 'Heure UTC';
  if (basis === 'local') return 'Heure locale du fichier';
  if (basis === 'mixed') return 'Fuseaux mélangés';
  return 'Aucune heure';
}

function asImportFailure(error: unknown): ImportFailure {
  if (error instanceof TraceImportError) {
    return {
      title: ERROR_LABELS[error.code] ?? 'Import impossible',
      message: clip(error.message, 240),
      code: error.code,
    };
  }
  return {
    title: 'Lecture impossible',
    message: clip(error instanceof Error ? error.message : 'Le fichier n’a pas pu être lu.', 240),
  };
}

function traceMapPoints(trace: NormalizedTraceImport) {
  return trace.points
    .filter((point) => point.latitudeDeg != null && point.longitudeDeg != null)
    .map((point) => ({
      lat: point.latitudeDeg as number,
      lng: point.longitudeDeg as number,
      elevationM: point.altitudeM,
      timestamp: point.recordedAt,
    }));
}

function runtimeOutingFromImport(
  payload: NonNullable<ReturnType<typeof buildHikeSessionImportPayload>>,
  sessionId: string
) {
  const date = new Date(payload.startedAt);
  return {
    id: sessionId,
    realId: sessionId,
    title: payload.title,
    mass: 'Sortie importée',
    date: Number.isNaN(date.getTime())
      ? 'Sortie'
      : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date),
    startedAt: payload.startedAt,
    endedAt: payload.endedAt,
    km: payload.distanceKm,
    dplus: payload.elevationGainM ?? 0,
    maxAlt: payload.maxAltitudeM,
    status: 'done',
    proven: payload.positionsTimed.length > 1,
    comp: [] as string[],
    photos: [] as string[],
    coverImage: null,
    kit: null,
  };
}

function mergeRuntimeOuting(outing: ReturnType<typeof runtimeOutingFromImport>) {
  const runtime = window as unknown as {
    __lkdvGetState?: () => { OUTINGS?: Array<Record<string, unknown>> } | null;
  };
  const current = runtime.__lkdvGetState?.()?.OUTINGS;
  if (!Array.isArray(current)) return;
  // Mutation directe du tableau du runtime : `__lkdvHydrateCompte` déclenche
  // `renderSheet()`, qui démonterait ce drawer et perdrait l'état « Sortie
  // enregistrée ». Le prochain `igtab` / refresh relira la liste à jour.
  const withoutSame = current.filter(
    (item) => item.realId !== outing.realId && item.id !== outing.id
  );
  current.splice(0, current.length, outing, ...withoutSame);
}

/**
 * Drawer d'import FIT/TCX du Compte.
 *
 * Le fichier est lu localement (ArrayBuffer), analysé par le parseur partagé,
 * puis seulement la trace dérivée peut être envoyée vers le mécanisme de
 * persistance existant (`hike_sessions` via /api/hike-sessions). L'original
 * n'est jamais téléversé ici.
 */
export function TraceImportDrawer() {
  const { user, loading: authLoading } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileBytes, setFileBytes] = useState<number | null>(null);
  const [trace, setTrace] = useState<NormalizedTraceImport | null>(null);
  const [preview, setPreview] = useState<TraceImportPreview | null>(null);
  const [failure, setFailure] = useState<ImportFailure | null>(null);
  const [saved, setSaved] = useState<SavedState | null>(null);

  const mapPoints = useMemo(() => (trace ? traceMapPoints(trace) : []), [trace]);

  const chooseFile = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const reset = useCallback(() => {
    setPhase('idle');
    setFileName(null);
    setFileBytes(null);
    setTrace(null);
    setPreview(null);
    setFailure(null);
    setSaved(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const readFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setFailure(null);
    setSaved(null);
    setTrace(null);
    setPreview(null);
    setFileName(file.name);
    setFileBytes(file.size);

    if (file.size <= 0) {
      setPhase('idle');
      setFailure({
        title: 'Fichier vide',
        message: 'Ce fichier ne contient aucune donnée à lire.',
      });
      return;
    }
    if (file.size > TRACE_IMPORT_LIMITS.maxBytes) {
      setPhase('idle');
      setFailure({
        title: 'Fichier trop volumineux',
        message: `La limite est de ${formatBytes(TRACE_IMPORT_LIMITS.maxBytes)}.`,
        code: 'file-too-large',
      });
      return;
    }

    setPhase('reading');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = parseTraceFile({ bytes, fileName: file.name });
      setTrace(result);
      setPreview(buildTraceImportPreview(result));
      setPhase('ready');
    } catch (error) {
      setPhase('idle');
      setFailure(asImportFailure(error));
    }
  }, []);

  const save = useCallback(async () => {
    if (!trace || !preview || !preview.saveable) return;
    if (!user) {
      setFailure({
        title: 'Connexion requise',
        message: 'Connecte-toi pour enregistrer cette trace dans tes sorties.',
      });
      return;
    }

    const payload = buildHikeSessionImportPayload(trace, preview);
    if (!payload) {
      setFailure({
        title: 'Enregistrement impossible',
        message: 'Les données nécessaires à une sortie fiable sont incomplètes.',
      });
      return;
    }

    setPhase('saving');
    setFailure(null);
    try {
      const response = await fetch('/api/hike-sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => null)) as {
        sessionId?: string | null;
        existing?: boolean;
        isGuest?: boolean;
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error || `http_${response.status}`);
      }
      const sessionId = data?.sessionId ?? null;
      if (data?.isGuest || !sessionId) {
        setPhase('ready');
        setFailure({
          title: 'Connexion requise',
          message: 'La trace reste en aperçu : aucune sortie n’a été écrite.',
        });
        return;
      }

      const savedState: SavedState = {
        sessionId,
        existing: data?.existing === true,
        title: payload.title,
      };
      setSaved(savedState);
      setPhase('saved');
      // Une sortie déjà présente garde son titre et ses données en base : on
      // ne réécrit pas l'état local avec le seul nom du fichier importé.
      if (!savedState.existing) {
        mergeRuntimeOuting(runtimeOutingFromImport(payload, sessionId));
      }
    } catch (error) {
      setPhase('ready');
      setFailure({
        title: 'Enregistrement impossible',
        message: clip(
          error instanceof Error ? error.message : 'La sortie n’a pas pu être créée.',
          240
        ),
      });
    }
  }, [preview, trace, user]);

  const showOutings = useCallback(() => {
    const runtime = window as unknown as {
      __lkdvCompteAct?: (action: string, value?: unknown) => void;
    };
    runtime.__lkdvCompteAct?.('igtab', 1);
    runtime.__lkdvCompteAct?.('closeSheet');
  }, []);

  const openSavedOuting = useCallback(() => {
    if (!saved) return;
    const runtime = window as unknown as {
      __lkdvCompteAct?: (action: string, value?: unknown) => void;
      __lkdvGetState?: () => { OUTINGS?: Array<Record<string, unknown>> } | null;
    };
    const current = runtime.__lkdvGetState?.()?.OUTINGS;
    const present =
      Array.isArray(current) &&
      current.some(
        (item) => item.realId === saved.sessionId || item.id === saved.sessionId
      );
    if (!present || !runtime.__lkdvCompteAct) {
      showOutings();
      return;
    }
    // Réutilise le drawer Sortie existant (`outing_drawer`) : il relira la
    // provenance persistée dans `trace_imports` pour ce propriétaire.
    runtime.__lkdvCompteAct('openOutingDrawer', saved.sessionId);
  }, [saved, showOutings]);

  if (authLoading) {
    return (
      <div
        className="lkdv-trace-import"
        data-testid="trace-import-drawer"
        data-phase="loading"
        aria-busy="true"
      >
        <style dangerouslySetInnerHTML={{ __html: DRAWER_SHELL_CSS + TRACE_IMPORT_CSS }} />
        <div className="lkdv-trace-import-loading">
          <Loader2 size={18} className="lkdv-trace-import-spin" aria-hidden="true" />
          <span>Vérification de la session…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="lkdv-trace-import" data-testid="trace-import-drawer" data-phase={phase}>
      <style dangerouslySetInnerHTML={{ __html: DRAWER_SHELL_CSS + TRACE_IMPORT_CSS }} />

      <header className="lkdv-trace-import-head">
        <div>
          <b>Importer une trace</b>
          <span>FIT ou TCX, lu sur ton appareil</span>
        </div>
        <span className="lkdv-trace-import-badge">
          <ShieldCheck size={12} aria-hidden="true" /> Local
        </span>
      </header>

      {!user ? (
        <DrawerAuthRequired
          title="Connecte-toi pour enregistrer une trace"
          hint="L’aperçu reste disponible hors session ; l’écriture dans tes sorties demande un compte."
        />
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept=".fit,.tcx,application/octet-stream,application/xml,text/xml"
        className="lkdv-trace-import-file"
        aria-label="Choisir un fichier FIT ou TCX"
        onChange={(event) => {
          void readFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />

      <button
        type="button"
        className={`lkdv-trace-import-drop${dragging ? ' is-over' : ''}`}
        aria-busy={phase === 'reading' || undefined}
        disabled={phase === 'saving'}
        onClick={chooseFile}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void readFile(event.dataTransfer.files?.[0]);
        }}
      >
        <span className="lkdv-trace-import-drop-ico" aria-hidden="true">
          {phase === 'reading' ? (
            <Loader2 size={22} className="lkdv-trace-import-spin" />
          ) : (
            <FileUp size={22} />
          )}
        </span>
        <b>{phase === 'reading' ? 'Lecture du fichier…' : 'Choisis un fichier FIT ou TCX'}</b>
        <span>
          Glisse-le ici ou appuie pour parcourir · {formatBytes(TRACE_IMPORT_LIMITS.maxBytes)}{' '}
          maximum
        </span>
        <span className="lkdv-trace-import-privacy">
          Le fichier original ne quitte pas ton appareil.
        </span>
      </button>

      {failure ? (
        <div className="lkdv-trace-import-alert" role="alert">
          <AlertTriangle size={17} aria-hidden="true" />
          <div>
            <b>{failure.title}</b>
            <p>{failure.message}</p>
            {failure.code ? <small>Code : {failure.code}</small> : null}
          </div>
        </div>
      ) : null}

      {saved ? (
        <section className="lkdv-trace-import-saved" role="status" aria-live="polite">
          <span className="lkdv-trace-import-saved-ico" aria-hidden="true">
            <Check size={18} />
          </span>
          <div>
            <b>{saved.existing ? 'Fichier déjà importé' : 'Sortie enregistrée'}</b>
            <p>
              {saved.existing
                ? 'Ce fichier a déjà été importé : la sortie existante est conservée, aucun doublon n’a été créé.'
                : `${saved.title} rejoint tes sorties privées.`}
            </p>
            {trace && trace.laps.length > 0 ? (
              <p>
                {trace.laps.length} tour{trace.laps.length > 1 ? 's' : ''} lu
                {trace.laps.length > 1 ? 's' : ''} dans le fichier · non conservé
                {trace.laps.length > 1 ? 's' : ''} après enregistrement.
              </p>
            ) : null}
          </div>
          <div className="lkdv-trace-import-actions">
            <ActionPill
              tone="primary"
              label="Voir la sortie"
              icon={<MapPin />}
              text="Voir la sortie"
              onClick={openSavedOuting}
            />
            <ActionPill
              label="Voir toutes mes sorties"
              icon={<ArrowRight />}
              text="Mes sorties"
              onClick={showOutings}
            />
            <ActionPill
              label="Importer un autre fichier"
              icon={<RotateCcw />}
              text="Nouveau fichier"
              onClick={reset}
            />
          </div>
        </section>
      ) : null}

      {trace && preview && phase !== 'saved' ? (
        <>
          <section className="lkdv-trace-import-card" aria-label="Aperçu de la trace importée">
            <div className="lkdv-trace-import-file-row">
              <span className="lkdv-trace-import-file-ico" aria-hidden="true">
                <FileCheck2 size={18} />
              </span>
              <div>
                <b title={clip(fileName, 120) || 'Fichier'}>
                  {clip(fileName, 70) || 'Fichier sans nom'}
                </b>
                <span>
                  {trace.provenance.format.toUpperCase()} ·{' '}
                  {formatBytes(fileBytes ?? trace.provenance.byteLength)} ·{' '}
                  {trace.status === 'complete' ? 'complet' : 'tronqué'}
                </span>
              </div>
              <button
                type="button"
                className="lkdv-trace-import-change"
                onClick={chooseFile}
                disabled={phase === 'saving'}
              >
                Changer
              </button>
            </div>

            {trace.status === 'truncated' ? (
              <div className="lkdv-trace-import-warn" role="status">
                <AlertTriangle size={15} aria-hidden="true" />
                <span>
                  La fin annoncée manque. Les enregistrements complets sont affichés, mais
                  l’enregistrement reste désactivé pour ne pas créer une sortie partielle.
                </span>
              </div>
            ) : null}

            <div className="lkdv-trace-import-title">
              <b>{preview.title}</b>
              <span>
                {formatFileDate(trace)} · {clip(trace.provenance.sport, 40) || 'Sport non déclaré'}{' '}
                · {timeBasisLabel(trace.provenance.timeBasis)}
              </span>
            </div>

            {mapPoints.length >= 2 ? (
              <TraceMap points={mapPoints} className="lkdv-trace-import-map" />
            ) : (
              <div className="lkdv-trace-import-no-map">
                <MapPin size={16} aria-hidden="true" /> Aucune coordonnée GPS exploitable
              </div>
            )}

            <div className="lkdv-trace-import-metrics">
              <div>
                <small>Distance</small>
                <b>
                  {preview.distanceM !== null
                    ? `${formatNumber(preview.distanceM / 1000)} km`
                    : '—'}
                </b>
              </div>
              <div>
                <small>Dénivelé</small>
                <b>
                  {preview.elevationGainM !== null
                    ? `+${formatNumber(preview.elevationGainM)} m`
                    : '—'}
                </b>
              </div>
              <div>
                <small>Durée</small>
                <b>{formatDuration(preview.durationSeconds)}</b>
              </div>
              <div>
                <small>Alt. max</small>
                <b>
                  {preview.maxAltitudeM !== null ? `${formatNumber(preview.maxAltitudeM)} m` : '—'}
                </b>
              </div>
            </div>

            <div className="lkdv-trace-import-substats">
              <span>{preview.pointCount} points</span>
              <span>{preview.positionedPointCount} géolocalisés</span>
              <span>
                {preview.lapCount} tour{preview.lapCount > 1 ? 's' : ''}
              </span>
            </div>

            {preview.lapCount > 0 && traceLapsHaveMetrics(preview.laps) ? (
              <details
                className="lkdv-trace-import-details lkdv-trace-import-laps"
                data-testid="trace-import-laps"
              >
                <summary>
                  Tours lus dans le fichier ({preview.lapCount}) · non conservés après
                  enregistrement
                </summary>
                <ul>
                  {preview.laps.map((lap) => {
                    const start = formatLapStart(lap);
                    const trigger = lapTriggerLabel(lap.triggerMethod);
                    const intensity = lapIntensityLabel(lap.intensity);
                    const metrics = lapMetrics(lap);
                    return (
                      <li key={lap.index}>
                        <b>
                          Tour {lap.index + 1}
                          {trigger ? ` · ${trigger}` : ''}
                          {intensity ? ` · ${intensity}` : ''}
                        </b>
                        <span>
                          {metrics.length > 0
                            ? metrics.join(' · ')
                            : 'Aucune métrique de tour dans le fichier.'}
                        </span>
                        <small>
                          {start ? `Départ ${start} · ` : ''}
                          {lap.pointCount} point{lap.pointCount > 1 ? 's' : ''}
                          {lap.trackCount > 1
                            ? ` · ${lap.trackCount} segments`
                            : ''}
                        </small>
                      </li>
                    );
                  })}
                </ul>
                {preview.lapCount > preview.laps.length ? (
                  <p>
                    Et {preview.lapCount - preview.laps.length} autre
                    {preview.lapCount - preview.laps.length > 1 ? 's' : ''} tour
                    {preview.lapCount - preview.laps.length > 1 ? 's' : ''}, non affiché
                    {preview.lapCount - preview.laps.length > 1 ? 's' : ''}.
                  </p>
                ) : null}
                <p>
                  Ces tours sont lus dans le fichier mais aucun contrat persistant ne les
                  stocke : la sortie importée et son détail ne peuvent pas les restituer
                  après enregistrement.
                </p>
              </details>
            ) : null}

            {preview.availableMetrics.length > 0 ? (
              <ul className="lkdv-trace-import-chips" aria-label="Métriques présentes">
                {preview.availableMetrics.map((metric) => (
                  <li key={metric}>{METRIC_LABELS[metric] ?? metric}</li>
                ))}
              </ul>
            ) : null}

            <div className="lkdv-trace-import-provenance">
              <span>
                <Fingerprint size={12} aria-hidden="true" />{' '}
                {trace.provenance.fingerprint.slice(0, 22)}…
              </span>
              {trace.provenance.creator ? (
                <span>Créé par {clip(trace.provenance.creator, 60)}</span>
              ) : null}
              {trace.provenance.productId ? (
                <span>Produit {clip(trace.provenance.productId, 40)}</span>
              ) : null}
              {trace.provenance.serialNumber ? (
                <span>Série {clip(trace.provenance.serialNumber, 40)}</span>
              ) : null}
            </div>

            {trace.issues.length > 0 ? (
              <details className="lkdv-trace-import-details">
                <summary>
                  {trace.issues.length} point{trace.issues.length > 1 ? 's' : ''} à vérifier
                </summary>
                <ul>
                  {trace.issues.slice(0, 8).map((issue, index) => (
                    <li key={`${issue.code}-${index}`}>
                      <b>{ISSUE_LABELS[issue.code] ?? issue.code}</b>
                      <span>{clip(issue.message, 160)}</span>
                      <small>{clip(issue.path, 120)}</small>
                    </li>
                  ))}
                </ul>
                {trace.issues.length > 8 ? (
                  <p>Et {trace.issues.length - 8} autre(s), non affiché(s).</p>
                ) : null}
              </details>
            ) : null}

            {trace.provenance.ignoredSections.length > 0 ? (
              <details className="lkdv-trace-import-details">
                <summary>
                  {trace.provenance.ignoredSections.length} section
                  {trace.provenance.ignoredSections.length > 1 ? 's' : ''} ignorée
                  {trace.provenance.ignoredSections.length > 1 ? 's' : ''}
                </summary>
                <ul>
                  {trace.provenance.ignoredSections.slice(0, 8).map((section, index) => (
                    <li key={`${section.name}-${index}`}>
                      <b title={clip(section.name, 80)}>{clip(section.name, 80)}</b>
                      <span>
                        {section.elementCount} élément{section.elementCount > 1 ? 's' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>

          {preview.blockers.length > 0 ? (
            <div className="lkdv-trace-import-blockers" role="status">
              <b>Enregistrement désactivé</b>
              <ul>
                {preview.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="lkdv-trace-import-actions">
            <ActionPill
              tone="primary"
              label="Enregistrer cette trace dans mes sorties"
              icon={<Upload />}
              text="Enregistrer dans mes sorties"
              busy={phase === 'saving'}
              disabled={!preview.saveable || !user || phase === 'saving'}
              onClick={() => void save()}
            />
            <ActionPill
              label="Choisir un autre fichier"
              icon={<RotateCcw />}
              text="Autre fichier"
              onClick={reset}
              disabled={phase === 'saving'}
            />
          </div>
          <p className="lkdv-trace-import-footnote">
            Seule la trace dérivée (positions, distance, durée) rejoint tes sorties privées. Aucun
            carnet public n’est créé, et l’original reste sur ton appareil.
          </p>
        </>
      ) : null}
    </div>
  );
}

export const TRACE_IMPORT_CSS = `
.lkdv-trace-import{display:flex!important;flex-direction:column!important;flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overscroll-behavior:contain!important;-webkit-overflow-scrolling:touch!important;gap:10px!important;width:100%!important;padding:4px 2px calc(18px + env(safe-area-inset-bottom,0px))!important;box-sizing:border-box!important;color:var(--label)!important;font-family:var(--sf)!important;}
.lkdv-trace-import-head{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:10px!important;padding:0 2px!important;}
.lkdv-trace-import-head>div{display:flex!important;flex-direction:column!important;gap:2px!important;min-width:0!important;}
.lkdv-trace-import-head b{font:650 17px/1.15 var(--sf)!important;letter-spacing:-.02em!important;color:var(--label)!important;}
.lkdv-trace-import-head span{font:500 11.5px/1.3 var(--sf)!important;color:var(--label2)!important;}
.lkdv-trace-import-badge{display:inline-flex!important;align-items:center!important;gap:4px!important;flex:none!important;height:24px!important;padding:0 9px!important;border-radius:999px!important;background:rgba(23,64,44,.1)!important;color:#17402C!important;font:600 10px var(--sf)!important;box-shadow:inset 0 0 0 .5px rgba(23,64,44,.16)!important;}
.lkdv-trace-import-file{display:none!important;}
.lkdv-trace-import-drop{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:5px!important;width:100%!important;min-height:146px!important;padding:18px 16px!important;border:1px dashed rgba(23,64,44,.28)!important;border-radius:20px!important;background:linear-gradient(165deg,rgba(255,255,255,.68),rgba(255,255,255,.38))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.9)!important;color:var(--label)!important;cursor:pointer!important;text-align:center!important;transition:transform .18s ease,border-color .18s ease,background .18s ease!important;}
.lkdv-trace-import-drop.is-over{border-color:#17402C!important;background:rgba(23,64,44,.08)!important;transform:scale(.995)!important;}
.lkdv-trace-import-drop:active{transform:scale(.992)!important;}
.lkdv-trace-import-drop:disabled{opacity:.62!important;cursor:default!important;}
.lkdv-trace-import-drop-ico{display:grid!important;place-items:center!important;width:44px!important;height:44px!important;border-radius:14px!important;background:rgba(23,64,44,.09)!important;color:#17402C!important;margin-bottom:2px!important;}
.lkdv-trace-import-drop b{font:600 13.5px/1.25 var(--sf)!important;color:var(--label)!important;}
.lkdv-trace-import-drop>span:not(.lkdv-trace-import-drop-ico):not(.lkdv-trace-import-privacy){font:500 11px/1.4 var(--sf)!important;color:var(--label2)!important;max-width:280px!important;}
.lkdv-trace-import-privacy{font:500 10px/1.3 var(--sf)!important;color:var(--label3)!important;margin-top:2px!important;}
.lkdv-trace-import-spin{animation:lkdvTraceSpin .9s linear infinite!important;}
@keyframes lkdvTraceSpin{to{transform:rotate(360deg)}}
.lkdv-trace-import-alert{display:flex!important;gap:9px!important;align-items:flex-start!important;padding:11px 12px!important;border-radius:16px!important;background:rgba(179,58,44,.09)!important;box-shadow:inset 0 0 0 .5px rgba(179,58,44,.22)!important;color:#7d2a20!important;}
.lkdv-trace-import-alert>svg{flex:none!important;margin-top:1px!important;}
.lkdv-trace-import-alert b{display:block!important;font:650 12.5px/1.3 var(--sf)!important;}
.lkdv-trace-import-alert p{margin:2px 0 0!important;font:400 11.5px/1.4 var(--sf)!important;}
.lkdv-trace-import-alert small{display:block!important;margin-top:4px!important;font:500 10px var(--sf)!important;opacity:.75!important;}
.lkdv-trace-import-loading{display:flex!important;align-items:center!important;gap:8px!important;padding:24px 8px!important;font:500 12px var(--sf)!important;color:var(--label2)!important;}
.lkdv-trace-import-card{display:flex!important;flex-direction:column!important;gap:9px!important;padding:11px!important;border-radius:20px!important;background:rgba(255,255,255,.5)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 0 0 .5px rgba(23,43,36,.08)!important;}
.lkdv-trace-import-file-row{display:grid!important;grid-template-columns:34px minmax(0,1fr) auto!important;align-items:center!important;gap:8px!important;}
.lkdv-trace-import-file-ico{display:grid!important;place-items:center!important;width:34px!important;height:34px!important;border-radius:11px!important;background:rgba(23,64,44,.08)!important;color:#17402C!important;}
.lkdv-trace-import-file-row>div{display:flex!important;flex-direction:column!important;gap:1px!important;min-width:0!important;}
.lkdv-trace-import-file-row b{font:600 12px/1.25 var(--sf)!important;color:var(--label)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.lkdv-trace-import-file-row span{font:500 10px/1.3 var(--sf)!important;color:var(--label2)!important;}
.lkdv-trace-import-change{height:30px!important;padding:0 10px!important;border:0!important;border-radius:999px!important;background:rgba(255,255,255,.7)!important;color:#17402C!important;font:600 10.5px var(--sf)!important;cursor:pointer!important;box-shadow:inset 0 0 0 .5px rgba(23,43,36,.12)!important;}
.lkdv-trace-import-warn{display:flex!important;align-items:flex-start!important;gap:7px!important;padding:8px 10px!important;border-radius:13px!important;background:rgba(185,138,46,.12)!important;color:#7d5c14!important;font:500 10.5px/1.4 var(--sf)!important;}
.lkdv-trace-import-warn svg{flex:none!important;margin-top:1px!important;}
.lkdv-trace-import-title{display:flex!important;flex-direction:column!important;gap:1px!important;padding:0 2px!important;}
.lkdv-trace-import-title b{font:650 15px/1.2 var(--sf)!important;letter-spacing:-.01em!important;color:var(--label)!important;}
.lkdv-trace-import-title span{font:500 10.5px/1.35 var(--sf)!important;color:var(--label2)!important;}
.lkdv-trace-import-map{width:100%!important;height:176px!important;display:block!important;border-radius:16px!important;background:linear-gradient(160deg,rgba(220,235,217,.72),rgba(245,248,241,.85))!important;box-sizing:border-box!important;padding:12px!important;}
.lkdv-trace-import-no-map{display:flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;min-height:88px!important;border-radius:16px!important;background:rgba(255,255,255,.4)!important;color:var(--label3)!important;font:500 11px var(--sf)!important;}
.lkdv-trace-import-metrics{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:5px!important;}
.lkdv-trace-import-metrics>div{display:flex!important;flex-direction:column!important;gap:1px!important;padding:8px 9px!important;border-radius:13px!important;background:rgba(255,255,255,.58)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.07)!important;min-width:0!important;}
.lkdv-trace-import-metrics small{font:600 9px var(--sf)!important;color:var(--label2)!important;text-transform:uppercase!important;letter-spacing:.05em!important;}
.lkdv-trace-import-metrics b{font:650 13.5px/1.2 var(--sf)!important;color:var(--label)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;font-variant-numeric:tabular-nums!important;}
.lkdv-trace-import-substats{display:flex!important;flex-wrap:wrap!important;gap:4px 10px!important;padding:0 2px!important;font:500 10px var(--sf)!important;color:var(--label3)!important;}
.lkdv-trace-import-chips{list-style:none!important;display:flex!important;flex-wrap:wrap!important;gap:4px!important;margin:0!important;padding:0!important;}
.lkdv-trace-import-chips li{height:22px!important;display:inline-flex!important;align-items:center!important;padding:0 8px!important;border-radius:999px!important;background:rgba(23,64,44,.08)!important;color:#17402C!important;font:600 9.5px var(--sf)!important;}
.lkdv-trace-import-provenance{display:flex!important;flex-wrap:wrap!important;gap:4px 10px!important;padding:2px!important;font:500 9.5px/1.3 var(--sf)!important;color:var(--label3)!important;}
.lkdv-trace-import-provenance span{display:inline-flex!important;align-items:center!important;gap:3px!important;min-width:0!important;overflow-wrap:anywhere!important;}
.lkdv-trace-import-details{padding:7px 9px!important;border-radius:13px!important;background:rgba(255,255,255,.36)!important;box-shadow:inset 0 0 0 .5px rgba(23,43,36,.06)!important;}
.lkdv-trace-import-details summary{cursor:pointer!important;font:600 10.5px/1.3 var(--sf)!important;color:var(--label2)!important;}
.lkdv-trace-import-details ul{list-style:none!important;display:flex!important;flex-direction:column!important;gap:5px!important;margin:7px 0 0!important;padding:0!important;}
.lkdv-trace-import-details li{display:flex!important;flex-direction:column!important;gap:0!important;font:500 10px/1.3 var(--sf)!important;color:var(--label2)!important;}
.lkdv-trace-import-details li b{font:600 10px/1.3 var(--sf)!important;color:var(--label)!important;overflow-wrap:anywhere!important;}
.lkdv-trace-import-details li small{font:500 9px/1.3 var(--sf)!important;color:var(--label3)!important;overflow-wrap:anywhere!important;}
.lkdv-trace-import-laps li span{overflow-wrap:anywhere!important;}
.lkdv-trace-import-laps summary{overflow-wrap:anywhere!important;}
.lkdv-trace-import-details p{margin:7px 0 0!important;font:500 9.5px/1.3 var(--sf)!important;color:var(--label3)!important;}
.lkdv-trace-import-blockers{display:flex!important;flex-direction:column!important;gap:3px!important;padding:9px 11px!important;border-radius:14px!important;background:rgba(185,138,46,.1)!important;box-shadow:inset 0 0 0 .5px rgba(185,138,46,.2)!important;color:#7d5c14!important;}
.lkdv-trace-import-blockers b{font:650 10.5px var(--sf)!important;}
.lkdv-trace-import-blockers ul{list-style:none!important;display:flex!important;flex-direction:column!important;gap:2px!important;margin:2px 0 0!important;padding:0!important;}
.lkdv-trace-import-blockers li{font:500 10px/1.4 var(--sf)!important;padding-left:10px!important;position:relative!important;}
.lkdv-trace-import-blockers li:before{content:'·'!important;position:absolute!important;left:2px!important;}
.lkdv-trace-import-actions{display:flex!important;flex-wrap:wrap!important;gap:7px!important;align-items:center!important;padding:1px 1px 0!important;}
.lkdv-trace-import-saved{display:grid!important;grid-template-columns:34px minmax(0,1fr)!important;gap:8px!important;padding:11px!important;border-radius:18px!important;background:rgba(61,122,82,.1)!important;box-shadow:inset 0 0 0 .5px rgba(61,122,82,.2)!important;color:#17402C!important;}
.lkdv-trace-import-saved-ico{display:grid!important;place-items:center!important;width:34px!important;height:34px!important;border-radius:50%!important;background:#17402C!important;color:#fff!important;}
.lkdv-trace-import-saved b{display:block!important;font:650 12.5px/1.3 var(--sf)!important;}
.lkdv-trace-import-saved p{margin:2px 0 0!important;font:500 10.5px/1.4 var(--sf)!important;color:var(--label2)!important;}
.lkdv-trace-import-saved .lkdv-trace-import-actions{grid-column:1/-1!important;padding-top:3px!important;}
.lkdv-trace-import-footnote{margin:0!important;padding:0 3px!important;font:500 9.5px/1.45 var(--sf)!important;color:var(--label3)!important;}
@media (max-width:370px){.lkdv-trace-import-metrics{grid-template-columns:repeat(2,minmax(0,1fr))!important;}}
@media (prefers-reduced-motion:reduce){.lkdv-trace-import-drop,.lkdv-trace-import-spin{transition:none!important;animation:none!important;}}
`;

export default TraceImportDrawer;
