'use client';

import Link from 'next/link';
import React from 'react';

import type {
  Threshold,
  ThresholdKind,
  ThresholdOrigin,
  ThresholdUnit,
  ZoneBand,
  ZoneBasis,
  ZoneMetric,
  ZoneSet,
  ZoneUnit,
} from '../metrics/activityMetrics';
import { createZoneSet } from '../metrics/zoneConfiguration';
import { useExplorerStore } from '../state/store';
import { XpChips, XpEmpty, XpEyebrow, XpRow, XpRows } from './blocks';
import styles from './ZoneSettingsPanel.module.css';

/**
 * Réglages sportifs S2.10–S2.12.
 *
 * Ce panneau ne fabrique aucune zone, aucun seuil, aucune échelle et aucune
 * date d'effet. Il ne propose donc aucun préréglage : l'utilisateur saisit
 * lui-même ses bornes et son seuil, ou laisse le seuil à `null` quand la base
 * absolue le permet. La validation finale reste celle de `createZoneSet` et de
 * la RPC serveur ; le panneau ne fait qu'envoyer le contrat existant.
 *
 * Les unités affichées sont les unités canoniques du contrat (bpm, W, s/km,
 * %), indépendamment des unités d'affichage de l'Explorer. Aucune conversion
 * implicite n'est faite avant l'enregistrement.
 */

const METRIC_OPTIONS: Array<{ id: ZoneMetric; label: string }> = [
  { id: 'heartRate', label: 'Cardio' },
  { id: 'power', label: 'Puissance' },
  { id: 'pace', label: 'Allure' },
];

const BASIS_OPTIONS: Array<{ id: ZoneBasis; label: string }> = [
  { id: 'absolute', label: 'Valeurs absolues' },
  { id: 'percentOfThreshold', label: '% du seuil' },
];

const METRIC_LABEL: Record<ZoneMetric, string> = {
  heartRate: 'Cardio',
  power: 'Puissance',
  pace: 'Allure',
};

const METRIC_DESCRIPTION: Record<ZoneMetric, string> = {
  heartRate: 'Fréquence cardiaque en battements par minute (bpm).',
  power: 'Puissance en watts (W).',
  pace: 'Allure en secondes par kilomètre (s/km), saisie en min:sec.',
};

const BASIS_LABEL: Record<ZoneBasis, string> = {
  absolute: 'Valeurs absolues',
  percentOfThreshold: '% du seuil',
};

const CANONICAL_THRESHOLD_UNIT: Record<ZoneMetric, ThresholdUnit> = {
  heartRate: 'bpm',
  power: 'watts',
  pace: 'secondsPerKm',
};

const ABSOLUTE_ZONE_UNIT: Record<ZoneMetric, ZoneUnit> = {
  heartRate: 'bpm',
  power: 'watts',
  pace: 'secondsPerKm',
};

const THRESHOLD_KIND_LABEL: Record<ThresholdKind, string> = {
  maxHeartRate: 'FC max',
  lactateThreshold: 'Seuil lactique',
  ftp: 'FTP',
  paceThreshold: 'Allure de seuil',
  custom: 'Seuil personnalisé',
};

const THRESHOLD_KIND_OPTIONS: Record<ZoneMetric, readonly ThresholdKind[]> = {
  heartRate: ['maxHeartRate', 'lactateThreshold', 'custom'],
  power: ['ftp'],
  pace: ['paceThreshold'],
};

const THRESHOLD_ORIGIN_LABEL: Record<ThresholdOrigin, string> = {
  manual: 'Saisi manuellement',
  device: 'Lu sur un appareil',
  tested: 'Test déclaré',
  estimated: 'Estimé',
};

const THRESHOLD_ORIGIN_OPTIONS: readonly ThresholdOrigin[] = [
  'manual',
  'device',
  'tested',
  'estimated',
];

const MAX_BANDS = 20;

interface BandDraft {
  key: string;
  id: string;
  label: string;
  lower: string;
  upper: string;
  open: boolean;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'unauthenticated' | 'conflict';

type ListStatus = 'loading' | 'ready' | 'unauthenticated' | 'error';

interface SaveResponse {
  readonly created?: boolean;
  readonly error?: string;
  readonly errors?: readonly string[];
}

interface ListResponse {
  readonly configs?: unknown;
}

function parseDecimal(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized.length === 0) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePaceSeconds(value: string): number | null {
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  if (normalized.includes(':')) {
    const parts = normalized.split(':');
    if (parts.length !== 2) return null;
    const minutes = Number(parts[0]);
    const seconds = Number(parts[1]);
    if (!Number.isInteger(minutes) || minutes < 0) return null;
    if (!Number.isFinite(seconds) || seconds < 0 || seconds >= 60) return null;
    return minutes * 60 + seconds;
  }
  return parseDecimal(normalized);
}

function parseZoneValue(value: string, metric: ZoneMetric, basis: ZoneBasis): number | null {
  if (metric === 'pace' && basis === 'absolute') return parsePaceSeconds(value);
  return parseDecimal(value);
}

function parseThresholdValue(value: string, metric: ZoneMetric): number | null {
  if (metric === 'pace') return parsePaceSeconds(value);
  return parseDecimal(value);
}

function formatPaceSeconds(value: number): string {
  const rounded = Math.max(0, Math.round(value));
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value);
}

function formatThresholdValue(value: number, unit: ThresholdUnit): string {
  if (unit === 'secondsPerKm') return `${formatPaceSeconds(value)} /km`;
  if (unit === 'bpm') return `${formatNumber(value)} bpm`;
  return `${formatNumber(value)} W`;
}

function formatBandValue(value: number | null, unit: ZoneUnit): string {
  if (value === null) return '∞';
  if (unit === 'percent') return `${formatNumber(value)} %`;
  if (unit === 'secondsPerKm') return `${formatPaceSeconds(value)} /km`;
  if (unit === 'bpm') return `${formatNumber(value)} bpm`;
  return `${formatNumber(value)} W`;
}

function formatDateTime(ms: number): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

function zoneUnit(metric: ZoneMetric, basis: ZoneBasis): ZoneUnit {
  return basis === 'percentOfThreshold' ? 'percent' : ABSOLUTE_ZONE_UNIT[metric];
}

function thresholdUnit(metric: ZoneMetric): ThresholdUnit {
  return CANONICAL_THRESHOLD_UNIT[metric];
}

function zoneUnitShort(metric: ZoneMetric, basis: ZoneBasis): string {
  if (basis === 'percentOfThreshold') return '%';
  if (metric === 'pace') return 's/km';
  if (metric === 'heartRate') return 'bpm';
  return 'W';
}

function zoneUnitLabel(unit: ZoneUnit): string {
  if (unit === 'percent') return '%';
  if (unit === 'secondsPerKm') return 's/km';
  if (unit === 'bpm') return 'bpm';
  return 'W';
}

function thresholdInputUnit(metric: ZoneMetric): string {
  if (metric === 'pace') return 'min:sec /km';
  if (metric === 'heartRate') return 'bpm';
  return 'W';
}

function newToken(): string {
  const cryptoApi = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function newConfigId(metric: ZoneMetric): string {
  return `zone-${metric}-${newToken()}`.slice(0, 64);
}

function newConfigVersion(nowMs: number): string {
  return new Date(nowMs).toISOString().replace(/[:.]/g, '-');
}

function humanizeError(code: string): string {
  const labels: Record<string, string> = {
    ui_metric: 'Choisis une métrique.',
    ui_basis: 'Choisis une base de zones.',
    ui_discipline: 'Renseigne une discipline (minuscules, chiffres, tirets).',
    ui_effective_from: 'Renseigne une date et une heure d’effet valides.',
    ui_threshold_kind: 'Choisis le type de seuil.',
    ui_threshold_origin: 'Choisis l’origine du seuil.',
    ui_threshold_value: 'Saisis une valeur de seuil strictement positive.',
    ui_threshold_measured_at: 'Renseigne une date de mesure valide.',
    ui_threshold_required: 'Un seuil est obligatoire pour des zones en pourcentage.',
    ui_bands_empty: 'Ajoute au moins une zone.',
    zone_set_id: 'Identifiant de configuration invalide.',
    zone_set_id_format: 'Identifiant de configuration invalide.',
    zone_set_version: 'Version de configuration invalide.',
    zone_set_version_format: 'Version de configuration invalide.',
    zone_set_discipline: 'Discipline invalide.',
    zone_set_discipline_format: 'Discipline invalide.',
    zone_set_metric: 'Métrique invalide.',
    zone_set_basis: 'Base de zones invalide.',
    zone_set_unit: 'Unité incompatible avec la métrique et la base.',
    zone_set_threshold: 'Seuil invalide.',
    zone_set_threshold_required: 'Un seuil est obligatoire pour des zones en pourcentage.',
    zone_set_effective_from: 'Date d’effet invalide.',
    zone_set_recorded_at: 'Date d’enregistrement invalide.',
    zone_set_bands: 'Ajoute au moins une zone.',
    zone_set_bands_limit: 'Le nombre de zones dépasse la limite de 20.',
    threshold_kind: 'Type de seuil invalide.',
    threshold_value: 'Valeur de seuil invalide.',
    threshold_unit: 'Unité de seuil invalide.',
    threshold_origin: 'Origine de seuil invalide.',
    threshold_measured_at: 'Date de mesure du seuil invalide.',
    threshold_kind_for_metric: 'Ce type de seuil ne correspond pas à la métrique.',
    threshold_unit_for_metric: 'Cette unité de seuil ne correspond pas à la métrique.',
    zone_config_threshold_explicit: 'Le seuil doit être renseigné ou explicitement absent.',
    zone_config_unit_explicit: 'L’unité doit être renseignée explicitement.',
  };

  const direct = labels[code];
  if (direct) return direct;

  if (code.startsWith('zone_config_missing_')) {
    return 'Un champ obligatoire manque dans la configuration.';
  }
  if (code.startsWith('zone_config_unknown_')) {
    return 'La configuration contient un champ inconnu.';
  }
  if (code.startsWith('threshold_missing_')) {
    return 'Le seuil est incomplet.';
  }
  if (code.startsWith('threshold_unknown_')) {
    return 'Le seuil contient un champ inconnu.';
  }

  const band = /^zone_band_(\d+)_(.+)$/.exec(code);
  if (band) {
    const index = Number(band[1]) + 1;
    const reason = band[2];
    const detail: Record<string, string> = {
      id: 'identifiant invalide',
      id_format: 'identifiant invalide',
      label: 'libellé manquant',
      label_length: 'libellé trop long',
      lower: 'borne basse invalide',
      upper: 'borne haute invalide',
      range: 'intervalle inversé',
      overlap: 'chevauchement avec la zone précédente',
      order: 'zones non ordonnées',
      open_not_last: 'zone ouverte non terminale',
      after_open: 'zone après une zone ouverte',
      absent: 'zone absente',
    };
    return `Zone ${index} : ${detail[reason] ?? 'valeur invalide'}.`;
  }

  const draftBand = /^ui_band_(\d+)_(.+)$/.exec(code);
  if (draftBand) {
    const index = Number(draftBand[1]) + 1;
    const reason = draftBand[2];
    const detail: Record<string, string> = {
      label: 'libellé requis',
      lower: 'borne basse requise',
      upper: 'borne haute requise (ou coche « sans borne haute »)',
    };
    return `Zone ${index} : ${detail[reason] ?? 'valeur invalide'}.`;
  }

  return `Configuration refusée (${code}).`;
}

function newBand(seq: number): BandDraft {
  return {
    key: `band-${seq}`,
    id: `zone-${seq}`,
    label: '',
    lower: '',
    upper: '',
    open: false,
  };
}

/** Entrée unique dans le tiroir de départ, sans toucher aux autres drawers. */
export function ZoneSettingsEntry() {
  const setSheet = useExplorerStore((state) => state.setSheet);
  const setTab = useExplorerStore((state) => state.setTab);
  return (
    <>
      <XpEyebrow>Mesures &amp; zones</XpEyebrow>
      <XpRows>
        <XpRow
          icon="gauge"
          title="Zones et seuils"
          sub="Cardio, allure, puissance · privé"
          badge={{ label: 'Réglages', tone: 'muted' }}
          onClick={() => {
            setTab(0);
            setSheet('zoneSettings', 'full');
          }}
        />
      </XpRows>
    </>
  );
}

function ConfigRow({ config }: { config: ZoneSet }) {
  const threshold = config.threshold;
  return (
    <div className={styles.config}>
      <div className={styles.configTitle}>
        {METRIC_LABEL[config.metric]} · {config.discipline} · version {config.version}
      </div>
      <div className={styles.configSub}>
        {config.bands.length} zone{config.bands.length > 1 ? 's' : ''} · {BASIS_LABEL[config.basis]} ·{' '}
        {zoneUnitLabel(config.unit)}
        {threshold
          ? ` · ${THRESHOLD_KIND_LABEL[threshold.kind]} ${formatThresholdValue(
              threshold.value,
              threshold.unit,
            )} (${THRESHOLD_ORIGIN_LABEL[threshold.origin]})`
          : ' · sans seuil'}
      </div>
      <div className={styles.configSub}>
        Effet {formatDateTime(config.effectiveFromMs)} · enregistrée{' '}
        {formatDateTime(config.recordedAtMs)}
      </div>
      <div className={styles.configBands}>
        {config.bands
          .map(
            (band) =>
              `${band.label} [${formatBandValue(band.lower, config.unit)} – ${formatBandValue(
                band.upper,
                config.unit,
              )})`,
          )
          .join(' · ')}
      </div>
    </div>
  );
}

export function ZoneSettingsPanel({
  displayUnits = 'metric',
}: {
  displayUnits?: 'metric' | 'imperial';
}) {
  const [metric, setMetric] = React.useState<ZoneMetric | null>(null);
  const [basis, setBasis] = React.useState<ZoneBasis | null>(null);
  const [discipline, setDiscipline] = React.useState('');
  const [thresholdEnabled, setThresholdEnabled] = React.useState(false);
  const [thresholdKind, setThresholdKind] = React.useState<ThresholdKind | ''>('');
  const [thresholdValue, setThresholdValue] = React.useState('');
  const [thresholdOrigin, setThresholdOrigin] = React.useState<ThresholdOrigin | ''>('');
  const [measuredKnown, setMeasuredKnown] = React.useState(false);
  const [measuredAt, setMeasuredAt] = React.useState('');
  const [effectiveFrom, setEffectiveFrom] = React.useState('');
  const [bands, setBands] = React.useState<BandDraft[]>([]);
  const [dirty, setDirty] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>('idle');
  const [saveErrors, setSaveErrors] = React.useState<readonly string[]>([]);
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null);

  const [configs, setConfigs] = React.useState<readonly ZoneSet[]>([]);
  const [listStatus, setListStatus] = React.useState<ListStatus>('loading');
  const [listMessage, setListMessage] = React.useState<string | null>(null);
  const [reloadSeq, setReloadSeq] = React.useState(0);

  const bandSeq = React.useRef(0);
  const pendingDraft = React.useRef<{
    id: string;
    version: string;
    recordedAtMs: number;
  } | null>(null);

  const touch = React.useCallback(() => {
    pendingDraft.current = null;
    setDirty(true);
    setSaveStatus('idle');
    setSaveErrors([]);
    setSaveMessage(null);
  }, []);

  const chooseMetric = React.useCallback(
    (next: ZoneMetric) => {
      if (next === metric) return;
      setMetric(next);
      setBasis(null);
      setThresholdEnabled(false);
      setThresholdKind('');
      setThresholdValue('');
      setThresholdOrigin('');
      setMeasuredKnown(false);
      setMeasuredAt('');
      setBands([]);
      pendingDraft.current = null;
      setDirty(true);
      setSaveStatus('idle');
      setSaveErrors([]);
      setSaveMessage(null);
    },
    [metric],
  );

  const chooseBasis = React.useCallback(
    (next: ZoneBasis) => {
      if (next === basis) return;
      setBasis(next);
      setBands([]);
      setThresholdValue('');
      setThresholdKind('');
      setThresholdOrigin('');
      setMeasuredKnown(false);
      setMeasuredAt('');
      setThresholdEnabled(next === 'percentOfThreshold');
      pendingDraft.current = null;
      setDirty(true);
      setSaveStatus('idle');
      setSaveErrors([]);
      setSaveMessage(null);
    },
    [basis],
  );

  const addBand = React.useCallback(() => {
    setBands((previous) => {
      if (previous.length >= MAX_BANDS) return previous;
      // Ajouter une zone après une zone ouverte la referme : aucune borne
      // haute n'est inventée, l'utilisateur devra la saisir.
      const closed = previous.map((band, index) =>
        index === previous.length - 1 && band.open ? { ...band, open: false } : band,
      );
      bandSeq.current += 1;
      return [...closed, newBand(bandSeq.current)];
    });
    touch();
  }, [touch]);

  const updateBand = React.useCallback(
    (key: string, patch: Partial<BandDraft>) => {
      setBands((previous) =>
        previous.map((band) => (band.key === key ? { ...band, ...patch } : band)),
      );
      touch();
    },
    [touch],
  );

  const removeBand = React.useCallback(
    (key: string) => {
      setBands((previous) => previous.filter((band) => band.key !== key));
      touch();
    },
    [touch],
  );

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setListStatus('loading');
    setListMessage(null);

    const params = new URLSearchParams({ limit: '20' });
    if (metric !== null) params.set('metric', metric);

    fetch(`/api/explorer/v2/metrics/zones?${params.toString()}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as ListResponse | null;
        if (!active) return;
        if (response.status === 401) {
          setConfigs([]);
          setListStatus('unauthenticated');
          return;
        }
        if (!response.ok) {
          setConfigs([]);
          setListStatus('error');
          setListMessage(
            response.status === 503
              ? 'Le service de configuration est indisponible.'
              : 'Les configurations n’ont pas pu être lues.',
          );
          return;
        }
        if (!payload || !Array.isArray(payload.configs)) {
          setConfigs([]);
          setListStatus('error');
          setListMessage('La réponse du service ne respecte pas le contrat.');
          return;
        }
        setConfigs(payload.configs as ZoneSet[]);
        setListStatus('ready');
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setConfigs([]);
        setListStatus('error');
        setListMessage('Les configurations n’ont pas pu être lues.');
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [metric, reloadSeq]);

  const handleSave = async () => {
    if (!metric || !basis) {
      setSaveStatus('error');
      setSaveErrors([!metric ? 'ui_metric' : 'ui_basis']);
      return;
    }

    const errors: string[] = [];
    const selectedMetric = metric;
    const selectedBasis = basis;
    const trimmedDiscipline = discipline.trim();
    if (trimmedDiscipline.length === 0) errors.push('ui_discipline');

    const effectiveFromMs = effectiveFrom.length > 0 ? new Date(effectiveFrom).getTime() : Number.NaN;
    if (!Number.isFinite(effectiveFromMs)) errors.push('ui_effective_from');

    let threshold: Threshold | null = null;
    if (thresholdEnabled) {
      if (!thresholdKind) errors.push('ui_threshold_kind');
      if (!thresholdOrigin) errors.push('ui_threshold_origin');

      const parsedThreshold = parseThresholdValue(thresholdValue, selectedMetric);
      if (parsedThreshold === null || parsedThreshold <= 0) errors.push('ui_threshold_value');

      let measuredAtMs: number | null = null;
      if (measuredKnown) {
        if (measuredAt.length === 0) {
          errors.push('ui_threshold_measured_at');
        } else {
          const parsedMeasuredAt = new Date(`${measuredAt}T00:00:00`).getTime();
          if (Number.isFinite(parsedMeasuredAt)) measuredAtMs = parsedMeasuredAt;
          else errors.push('ui_threshold_measured_at');
        }
      }

      if (
        thresholdKind !== '' &&
        thresholdOrigin !== '' &&
        parsedThreshold !== null &&
        parsedThreshold > 0
      ) {
        threshold = {
          kind: thresholdKind,
          value: parsedThreshold,
          unit: thresholdUnit(selectedMetric),
          origin: thresholdOrigin,
          measuredAtMs,
        };
      }
    }

    if (selectedBasis === 'percentOfThreshold' && threshold === null) {
      errors.push('ui_threshold_required');
    }

    const builtBands: ZoneBand[] = [];
    if (bands.length === 0) errors.push('ui_bands_empty');
    bands.forEach((band, index) => {
      if (band.label.trim().length === 0) errors.push(`ui_band_${index}_label`);
      const lower = parseZoneValue(band.lower, selectedMetric, selectedBasis);
      if (lower === null) errors.push(`ui_band_${index}_lower`);
      const upper = band.open ? null : parseZoneValue(band.upper, selectedMetric, selectedBasis);
      if (!band.open && upper === null) errors.push(`ui_band_${index}_upper`);
      if (lower !== null && (band.open || upper !== null)) {
        builtBands.push({
          id: band.id,
          label: band.label.trim(),
          lower,
          upper,
        });
      }
    });

    if (errors.length > 0) {
      setSaveStatus('error');
      setSaveErrors(errors);
      setSaveMessage(null);
      return;
    }

    const nowMs = Date.now();
    const draft = pendingDraft.current ?? {
      id: newConfigId(selectedMetric),
      version: newConfigVersion(nowMs),
      recordedAtMs: nowMs,
    };
    pendingDraft.current = draft;

    const checked = createZoneSet({
      id: draft.id,
      version: draft.version,
      discipline: trimmedDiscipline,
      metric: selectedMetric,
      basis: selectedBasis,
      unit: zoneUnit(selectedMetric, selectedBasis),
      threshold,
      effectiveFromMs,
      recordedAtMs: draft.recordedAtMs,
      bands: builtBands,
    });

    if (!checked.ok) {
      setSaveStatus('error');
      setSaveErrors(checked.errors);
      setSaveMessage(null);
      return;
    }

    setSaveStatus('saving');
    setSaveErrors([]);
    setSaveMessage(null);

    try {
      const response = await fetch('/api/explorer/v2/metrics/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checked.zoneSet),
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as SaveResponse | null;

      if (response.status === 401) {
        setSaveStatus('unauthenticated');
        return;
      }
      if (response.status === 409) {
        pendingDraft.current = null;
        setSaveStatus('conflict');
        setSaveMessage(
          'Cet identifiant existe déjà avec un autre contenu. Aucune donnée n’a été écrasée ; recharge la page avant de réessayer.',
        );
        return;
      }
      if (!response.ok) {
        setSaveStatus('error');
        setSaveErrors(payload?.errors ?? []);
        setSaveMessage(
          response.status === 503
            ? 'Le service est indisponible. La configuration n’a pas été enregistrée.'
            : 'La configuration n’a pas été enregistrée.',
        );
        return;
      }
      if (!payload || typeof payload.created !== 'boolean') {
        setSaveStatus('error');
        setSaveErrors([]);
        setSaveMessage(
          'La réponse du service ne respecte pas le contrat. La configuration n’est pas confirmée.',
        );
        return;
      }

      pendingDraft.current = null;
      setDirty(false);
      setSaveStatus('saved');
      setSaveErrors([]);
      setSaveMessage(
        payload?.created === false
          ? 'Cette configuration existait déjà : aucun doublon n’a été créé.'
          : 'Configuration enregistrée. Elle ne modifie aucune séance passée.',
      );
      setReloadSeq((value) => value + 1);
    } catch {
      setSaveStatus('error');
      setSaveErrors([]);
      setSaveMessage('Réseau indisponible. La configuration n’a pas été enregistrée.');
    }
  };

  const isPaceAbsolute = metric === 'pace' && basis === 'absolute';
  const canSave = dirty && saveStatus !== 'saving';

  return (
    <div className={styles.panel}>
      <p className={styles.lead}>
        Ces réglages sont privés, datés et versionnés. Une correction crée une nouvelle
        configuration : l’ancienne reste lisible pour les séances passées.
      </p>
      <p className={styles.note}>
        Aucune zone, aucun seuil et aucune date d’effet ne sont préremplis. Configurer des zones
        ne crée aucune mesure : le tracker actuel ne transporte pas encore de série cardio ou
        puissance, et l’allure vient des vitesses GPS.
      </p>
      {displayUnits === 'imperial' ? (
        <p className={styles.note}>
          Unités d’affichage actuelles : impériales. Ces réglages restent enregistrés en unités
          canoniques (bpm, W, s/km) et ne sont pas convertis.
        </p>
      ) : (
        <p className={styles.note}>
          Unités d’affichage actuelles : métriques. Les réglages restent en unités canoniques
          (bpm, W, s/km).
        </p>
      )}

      <fieldset className={styles.formFieldset} disabled={saveStatus === 'saving'}>
        <legend className={styles.srOnly}>Configuration des zones et seuils</legend>
        <section className={styles.section} aria-labelledby="zone-settings-metric">
        <h3 id="zone-settings-metric" className={styles.heading}>
          1 · Métrique
        </h3>
        <XpChips
          items={METRIC_OPTIONS}
          value={metric ?? ''}
          onChange={(id) => chooseMetric(id as ZoneMetric)}
          ariaLabel="Métrique des zones"
        />
        {metric ? (
          <p className={styles.help}>
            {METRIC_DESCRIPTION[metric]} Aucune plage physiologique n’est imposée par l’écran.
          </p>
        ) : (
          <p className={styles.help}>Choisis la métrique à configurer.</p>
        )}
      </section>

      {metric ? (
        <section className={styles.section} aria-labelledby="zone-settings-basis">
          <h3 id="zone-settings-basis" className={styles.heading}>
            2 · Base et unité
          </h3>
          <XpChips
            items={BASIS_OPTIONS}
            value={basis ?? ''}
            onChange={(id) => chooseBasis(id as ZoneBasis)}
            ariaLabel="Base des zones"
          />
          {basis ? (
            <p className={styles.help}>
              Unité enregistrée : <b>{zoneUnitShort(metric, basis)}</b>.{' '}
              {basis === 'percentOfThreshold'
                ? metric === 'pace'
                  ? 'Le pourcentage porte sur la vitesse de seuil (seuil / allure), pas sur le temps au kilomètre.'
                  : 'Le pourcentage porte sur le seuil fourni.'
                : 'Les bornes sont comparées directement aux mesures.'}{' '}
              Changer de base efface les zones et le seuil saisis.
            </p>
          ) : (
            <p className={styles.help}>Choisis une base : valeurs absolues ou pourcentage du seuil.</p>
          )}
        </section>
      ) : null}

      {metric && basis ? (
        <>
          <section className={styles.section} aria-labelledby="zone-settings-threshold">
            <h3 id="zone-settings-threshold" className={styles.heading}>
              3 · Seuil {basis === 'percentOfThreshold' ? '(obligatoire)' : '(facultatif)'}
            </h3>
            <p className={styles.help}>
              {basis === 'percentOfThreshold'
                ? 'Un seuil est obligatoire pour des zones en pourcentage. Aucune valeur n’est déduite d’une autre.'
                : 'Tu peux laisser vide : les bornes restent absolues. Un seuil fourni reste une provenance documentaire et ne déplace aucune borne.'}
            </p>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={thresholdEnabled}
                disabled={basis === 'percentOfThreshold'}
                onChange={(event) => {
                  setThresholdEnabled(event.target.checked);
                  if (!event.target.checked) {
                    setThresholdKind('');
                    setThresholdValue('');
                    setThresholdOrigin('');
                    setMeasuredKnown(false);
                    setMeasuredAt('');
                  }
                  touch();
                }}
              />
              <span>
                {basis === 'percentOfThreshold'
                  ? 'Seuil renseigné (requis pour cette base)'
                  : 'Renseigner un seuil'}
              </span>
            </label>

            {thresholdEnabled ? (
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Type de seuil</span>
                  <select
                    className={styles.input}
                    value={thresholdKind}
                    onChange={(event) => {
                      setThresholdKind(event.target.value as ThresholdKind | '');
                      touch();
                    }}
                  >
                    <option value="">Choisir…</option>
                    {THRESHOLD_KIND_OPTIONS[metric].map((kind) => (
                      <option key={kind} value={kind}>
                        {THRESHOLD_KIND_LABEL[kind]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className={styles.row2}>
                  <label className={styles.field}>
                    <span>Valeur ({thresholdInputUnit(metric)})</span>
                    <input
                      className={styles.input}
                      type="text"
                      inputMode={metric === 'pace' ? 'text' : 'decimal'}
                      value={thresholdValue}
                      placeholder={metric === 'pace' ? '5:30' : 'Valeur'}
                      onChange={(event) => {
                        setThresholdValue(event.target.value);
                        touch();
                      }}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Origine</span>
                    <select
                      className={styles.input}
                      value={thresholdOrigin}
                      onChange={(event) => {
                        setThresholdOrigin(event.target.value as ThresholdOrigin | '');
                        touch();
                      }}
                    >
                      <option value="">Choisir…</option>
                      {THRESHOLD_ORIGIN_OPTIONS.map((origin) => (
                        <option key={origin} value={origin}>
                          {THRESHOLD_ORIGIN_LABEL[origin]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={measuredKnown}
                    onChange={(event) => {
                      setMeasuredKnown(event.target.checked);
                      if (!event.target.checked) setMeasuredAt('');
                      touch();
                    }}
                  />
                  <span>Date de mesure connue</span>
                </label>
                {measuredKnown ? (
                  <label className={styles.field}>
                    <span>Date de mesure</span>
                    <input
                      className={styles.input}
                      type="date"
                      value={measuredAt}
                      onChange={(event) => {
                        setMeasuredAt(event.target.value);
                        touch();
                      }}
                    />
                  </label>
                ) : (
                  <p className={styles.help}>
                    Aucune date de mesure : le seuil est enregistré comme saisi, pas comme mesuré
                    aujourd’hui.
                  </p>
                )}
              </div>
            ) : (
              <p className={styles.help}>
                Aucun seuil ne sera enregistré : la valeur <code>null</code> est explicite.
              </p>
            )}
          </section>

          <section className={styles.section} aria-labelledby="zone-settings-bands">
            <div className={styles.sectionHead}>
              <h3 id="zone-settings-bands" className={styles.heading}>
                4 · Zones
              </h3>
              <span className={styles.counter}>
                {bands.length}/{MAX_BANDS}
              </span>
            </div>
            <p className={styles.help}>
              Chaque zone est un intervalle demi-ouvert [basse, haute). Une zone ouverte n’a pas de
              borne haute et doit être la dernière. Les trous sont permis et ne sont jamais
              comblés.
            </p>

            {bands.length === 0 ? (
              <XpEmpty
                title="Aucune zone"
                hint="Ajoute une zone, puis saisis ses bornes. Aucune borne n’est préremplie."
              />
            ) : (
              <div className={styles.bands}>
                {bands.map((band, index) => {
                  const last = index === bands.length - 1;
                  return (
                    <div className={styles.band} key={band.key}>
                      <div className={styles.bandHead}>
                        <span className={styles.bandIndex}>
                          Zone {index + 1}
                          {last ? ' · dernière' : ''}
                        </span>
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={() => removeBand(band.key)}
                          aria-label={`Supprimer la zone ${index + 1}`}
                        >
                          ✕
                        </button>
                      </div>
                      <label className={styles.field}>
                        <span>Libellé</span>
                        <input
                          className={styles.input}
                          type="text"
                          value={band.label}
                          maxLength={80}
                          placeholder="Ex. Endurance"
                          onChange={(event) =>
                            updateBand(band.key, { label: event.target.value })
                          }
                        />
                      </label>
                      <div className={styles.row2}>
                        <label className={styles.field}>
                          <span>Borne basse ({zoneUnitShort(metric, basis)})</span>
                          <input
                            className={styles.input}
                            type="text"
                            inputMode={isPaceAbsolute ? 'text' : 'decimal'}
                            value={band.lower}
                            placeholder={isPaceAbsolute ? '5:30' : 'Valeur'}
                            onChange={(event) =>
                              updateBand(band.key, { lower: event.target.value })
                            }
                          />
                        </label>
                        <label className={styles.field}>
                          <span>Borne haute ({zoneUnitShort(metric, basis)})</span>
                          <input
                            className={styles.input}
                            type="text"
                            inputMode={isPaceAbsolute ? 'text' : 'decimal'}
                            value={band.upper}
                            disabled={last && band.open}
                            placeholder={last && band.open ? 'Sans borne' : 'Valeur'}
                            onChange={(event) =>
                              updateBand(band.key, { upper: event.target.value })
                            }
                          />
                        </label>
                      </div>
                      {last ? (
                        <label className={styles.check}>
                          <input
                            type="checkbox"
                            checked={band.open}
                            onChange={(event) =>
                              updateBand(band.key, { open: event.target.checked })
                            }
                          />
                          <span>Sans borne haute (zone ouverte)</span>
                        </label>
                      ) : null}
                      {isPaceAbsolute ? (
                        <p className={styles.help}>
                          Saisis mm:ss ou des secondes par km (5:30 = 330 s/km).
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              className="xp-secondary"
              onClick={addBand}
              disabled={bands.length >= MAX_BANDS}
            >
              Ajouter une zone
            </button>
          </section>

          <section className={styles.section} aria-labelledby="zone-settings-effective">
            <h3 id="zone-settings-effective" className={styles.heading}>
              5 · Date d’effet
            </h3>
            <label className={styles.field}>
              <span>À partir de quand cette configuration classe-t-elle les séances ?</span>
              <input
                className={styles.input}
                type="datetime-local"
                value={effectiveFrom}
                onChange={(event) => {
                  setEffectiveFrom(event.target.value);
                  touch();
                }}
              />
            </label>
            <p className={styles.help}>
              Date et heure locales. Une configuration future ne s’applique pas aux séances
              passées. La date d’enregistrement est celle de l’envoi ; elle ne remplace jamais la
              date d’effet.
            </p>
          </section>

          <label className={styles.field}>
            <span>Discipline</span>
            <input
              className={styles.input}
              type="text"
              value={discipline}
              maxLength={32}
              placeholder="course, rando-journee, velo…"
              onChange={(event) => {
                setDiscipline(event.target.value);
                touch();
              }}
            />
            <span className={styles.help}>
              Minuscules, chiffres, tirets et soulignés. Cette valeur reste libre : le contrat ne
              fixe pas de liste fermée de disciplines.
            </span>
          </label>

          <button
            type="button"
            className="xp-primary"
            onClick={handleSave}
            disabled={!canSave}
          >
            {saveStatus === 'saving' ? 'Enregistrement…' : 'Enregistrer cette configuration'}
          </button>

          {saveStatus === 'saved' && saveMessage ? (
            <p className={styles.success} role="status">
              {saveMessage}
            </p>
          ) : null}
          {saveStatus === 'unauthenticated' ? (
            <div className={styles.error} role="alert">
              <b>Connexion requise</b>
              <p>
                Les configurations sont privées et liées à ton compte.{' '}
                <Link className={styles.link} href="/connexion?redirect=/explorer">
                  Se connecter
                </Link>
              </p>
            </div>
          ) : null}
          {saveStatus === 'conflict' && saveMessage ? (
            <div className={styles.error} role="alert">
              <b>Conflit d’identifiant</b>
              <p>{saveMessage}</p>
            </div>
          ) : null}
          {saveStatus === 'error' ? (
            <div className={styles.error} role="alert">
              <b>Configuration non enregistrée</b>
              {saveMessage ? <p>{saveMessage}</p> : null}
              {saveErrors.length > 0 ? (
                <ul className={styles.errorList}>
                  {saveErrors.map((error, index) => (
                    <li key={`${error}-${index}`}>{humanizeError(error)}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
      </fieldset>

      <section className={styles.section} aria-labelledby="zone-settings-list">
        <div className={styles.sectionHead}>
          <h3 id="zone-settings-list" className={styles.heading}>
            Configurations enregistrées
          </h3>
          <button
            type="button"
            className={styles.smallButton}
            onClick={() => setReloadSeq((value) => value + 1)}
          >
            Recharger
          </button>
        </div>
        <p className={styles.help}>
          Lecture seule : une correction crée une nouvelle configuration datée. Les 20 dernières
          configurations de ton compte sont lues ; aucune ligne d’un autre utilisateur n’est
          exposée.
        </p>
        {listStatus === 'loading' ? (
          <p className={styles.help} role="status">
            Chargement…
          </p>
        ) : null}
        {listStatus === 'unauthenticated' ? (
          <XpEmpty
            title="Connexion requise"
            hint="Connecte-toi pour voir et enregistrer tes zones et seuils."
            action={
              <Link className={styles.link} href="/connexion?redirect=/explorer">
                Se connecter
              </Link>
            }
          />
        ) : null}
        {listStatus === 'error' ? (
          <div className={styles.error} role="alert">
            <b>Lecture impossible</b>
            <p>{listMessage ?? 'Les configurations n’ont pas pu être lues.'}</p>
            <button
              type="button"
              className={styles.smallButton}
              onClick={() => setReloadSeq((value) => value + 1)}
            >
              Réessayer
            </button>
          </div>
        ) : null}
        {listStatus === 'ready' && configs.length === 0 ? (
          <XpEmpty
            title="Aucune configuration"
            hint="Aucune valeur n’est créée par défaut. Commence par choisir une métrique et une base."
          />
        ) : null}
        {listStatus === 'ready' && configs.length > 0 ? (
          <div className={styles.configList}>
            {configs.map((config) => (
              <ConfigRow key={config.id} config={config} />
            ))}
          </div>
        ) : null}
      </section>

      <XpEyebrow>Limites capteurs</XpEyebrow>
      <ul className={styles.limits}>
        <li className={styles.limit}>
          <div className={styles.limitHead}>
            <b>Cardio · bpm</b>
            <span className={styles.limitBadge}>non branché</span>
          </div>
          <p>Le tracker actuel ne transporte pas de série cardio. Sans série fournie, le temps en zone reste indisponible.</p>
        </li>
        <li className={styles.limit}>
          <div className={styles.limitHead}>
            <b>Puissance · W</b>
            <span className={styles.limitBadge}>non branché</span>
          </div>
          <p>Aucun capteur de puissance n’alimente le tracker. Sans série fournie, le temps en zone reste indisponible.</p>
        </li>
        <li className={styles.limit}>
          <div className={styles.limitHead}>
            <b>Allure · s/km</b>
            <span className={styles.limitBadge}>GPS</span>
          </div>
          <p>Une vitesse nulle n’a pas d’allure finie : elle reste hors zone, jamais classée à l’infini.</p>
        </li>
      </ul>
      <p className={styles.note}>
        La couverture de séance (<code>maxHoldMs</code>) reste une règle du calcul, pas un seuil
        physiologique : elle n’est pas enregistrée dans cette configuration.
      </p>

      <XpEyebrow>Unités</XpEyebrow>
      <dl className={styles.units}>
        <div>
          <dt>Cardio</dt>
          <dd>bpm</dd>
        </div>
        <div>
          <dt>Puissance</dt>
          <dd>W</dd>
        </div>
        <div>
          <dt>Allure</dt>
          <dd>s/km · saisie mm:ss</dd>
        </div>
        <div>
          <dt>Pourcentage</dt>
          <dd>% du seuil</dd>
        </div>
      </dl>
      <p className={styles.note}>
        Pour l’allure, le pourcentage porte sur la vitesse de seuil : une allure plus rapide donne
        un pourcentage plus grand, et non un pourcentage du temps au kilomètre.
      </p>

      <XpEyebrow>Ressenti et effort relatif</XpEyebrow>
      <p className={styles.note}>
        Le ressenti (RPE) reste déclaré par séance et n’est pas enregistré ici. L’effort relatif
        LKDV n’est pas calculé sans pondérations fournies et n’est jamais présenté comme l’effort
        relatif d’un autre service.
      </p>
    </div>
  );
}
