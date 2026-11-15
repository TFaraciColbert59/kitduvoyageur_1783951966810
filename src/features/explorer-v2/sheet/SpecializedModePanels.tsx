'use client';

/**
 * Lot A01 / A03 — Panneaux spécialisés Explorer v2 :
 *  - S1.12 : Bascule et choix des activités Rééducation (conditionnel)
 *  - S1.10 : Configuration bassin & compteur longueurs piscine / eau libre
 *  - S1.09 : Saisie console indoor (distance, puissance, cadence) sans GPS
 *  - S1.11 : Compteur de descentes / D− (ski alpin, snowboard, ski de rando)
 *  - K6.05 / S3.27 : Export GPX / TCX d'un itinéraire dans le drawer Parcours
 */

import React from 'react';
import { XpEmpty, XpEyebrow, XpMetrics, XpRow, XpRows } from './blocks';
import { useExplorerStore } from '../state/store';
import type { ActivityState, Sport, SportSelection } from '../state/types';
import {
  REHAB_VARIANTS,
  startAvailability,
  toSportSelection,
  type SportStartContext,
} from './sportSelection';
import { computeSwimPace, validatePoolConfig } from '../activity/modes/swimActivity';
import {
  isRehabModeEnabled,
  setRehabModeEnabled,
  REHAB_BODY_ZONES,
} from '../activity/modes/rehabActivity';
import {
  getActivityModeDefinition,
  toServerPersistenceMapping,
} from '../activity/modes/catalog';
import { formatDistance, formatElevation } from './context';

const POOL_LENGTH_STORAGE_KEY = 'lkdv:explorer-v2:pool-length-m';

export function readStoredPoolLengthM(): number {
  if (typeof window === 'undefined') return 25;
  try {
    const raw = window.localStorage.getItem(POOL_LENGTH_STORAGE_KEY);
    if (!raw) return 25;
    const parsed = Number(raw);
    const check = validatePoolConfig({ poolLength: parsed, poolUnit: 'm' });
    return check.ok ? check.value.poolLengthM : 25;
  } catch {
    return 25;
  }
}

export function writeStoredPoolLengthM(lengthM: number): number {
  const check = validatePoolConfig({ poolLength: lengthM, poolUnit: 'm' });
  const safe = check.ok ? check.value.poolLengthM : 25;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(POOL_LENGTH_STORAGE_KEY, String(safe));
    } catch {
      // Stockage indisponible : on conserve en mémoire pour la session.
    }
  }
  return safe;
}

/**
 * S1.10 — Choix de la longueur de bassin avant le départ en piscine.
 */
export function PoolSwimStartConfig({ variantId }: { variantId: string | null }) {
  const [poolLengthM, setPoolLengthM] = React.useState<number>(() => readStoredPoolLengthM());
  const [customRaw, setCustomRaw] = React.useState<string>(() => String(readStoredPoolLengthM()));
  if (variantId !== 'natation-piscine') return null;

  const applyLength = (next: number) => {
    const valid = writeStoredPoolLengthM(next);
    setPoolLengthM(valid);
    setCustomRaw(String(valid));
  };

  return (
    <div style={{ margin: '10px 0' }} data-testid="pool-swim-start-config">
      <XpEyebrow>Bassin · Natation piscine</XpEyebrow>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {[25, 50].map((preset) => (
          <button
            key={preset}
            type="button"
            className="xp-chip"
            aria-pressed={poolLengthM === preset}
            onClick={() => applyLength(preset)}
            style={
              poolLengthM === preset
                ? { background: 'var(--xp-inkbtn)', color: '#fff' }
                : undefined
            }
          >
            Bassin {preset} m
          </button>
        ))}
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span>Perso (m)</span>
          <input
            type="number"
            min={10}
            max={100}
            value={customRaw}
            aria-label="Longueur de bassin personnalisée en mètres"
            onChange={(e) => {
              setCustomRaw(e.target.value);
              const val = Number(e.target.value);
              if (Number.isFinite(val) && val >= 10 && val <= 100) {
                const valid = writeStoredPoolLengthM(val);
                setPoolLengthM(valid);
              }
            }}
            style={{
              width: 64,
              padding: '4px 8px',
              borderRadius: 8,
              border: '1px solid rgba(23,43,36,0.2)',
              fontSize: 12,
            }}
          />
        </label>
      </div>
    </div>
  );
}

/**
 * S1.12 — Activation du mode Rééducation dans Explorer -> choix du sport.
 * Conditionnel : les variantes rééducation ne s'affichent que si activées.
 */
export function RehabModeSection({
  startContext,
  onStartSport,
}: {
  startContext: SportStartContext;
  onStartSport?: (sport: Sport, selection?: SportSelection) => void;
}) {
  const [enabled, setEnabled] = React.useState<boolean>(() => isRehabModeEnabled());

  const toggle = () => {
    const next = !enabled;
    setRehabModeEnabled(next);
    setEnabled(next);
  };

  return (
    <div style={{ marginTop: 10 }} data-testid="rehab-mode-section">
      <XpEyebrow>Mode rééducation</XpEyebrow>
      <XpRows>
        <XpRow
          icon="heart"
          title="Afficher les séances Rééducation"
          sub={
            enabled
              ? 'Activé · mobilité, marche thérapeutique, vélo doux et balnéothérapie.'
              : 'Masqué par défaut · active ce mode pour suivre une rééducation.'
          }
          trailing={
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label="Activer le mode rééducation"
              onClick={toggle}
              className="xp-chip"
              style={enabled ? { background: 'var(--xp-inkbtn)', color: '#fff' } : undefined}
            >
              {enabled ? 'Activé' : 'Activer'}
            </button>
          }
        />
        {enabled
          ? REHAB_VARIANTS.map((variant) => {
              const availability = startAvailability(variant, startContext);
              const mapping = toServerPersistenceMapping(variant.id);
              const selection =
                mapping?.selection ??
                toSportSelection(
                  {
                    sport: variant.sport,
                    label: 'Rééducation',
                    icon: 'heart',
                    description: 'Rééducation et reprise progressive',
                    variants: REHAB_VARIANTS,
                  },
                  variant,
                );
              const def = getActivityModeDefinition(variant.id);
              return (
                <XpRow
                  key={variant.id}
                  icon="heart"
                  title={variant.label}
                  sub={
                    variant.requiresGps
                      ? 'GPS tolérant (marche lente)'
                      : 'Sans GPS · durée et zone/douleur optionnelles'
                  }
                  badge={{
                    label: availability.startable ? 'Prêt' : 'Indisponible',
                    tone: availability.startable ? 'good' : 'muted',
                  }}
                  disabled={!availability.startable || !onStartSport}
                  onClick={
                    availability.startable && onStartSport
                      ? () => onStartSport(def?.baseSport ?? variant.sport, selection)
                      : undefined
                  }
                />
              );
            })
          : null}
      </XpRows>
    </div>
  );
}

/**
 * Contrôles et métriques en direct propres aux modes S1.09 / S1.10 / S1.11 / S1.12.
 */
export function LiveSpecializedPanel({ activity }: { activity: ActivityState }) {
  const variantId = activity.selection?.variantId ?? '';
  const isPoolSwim = variantId === 'natation-piscine';
  const isOpenWaterSwim = variantId === 'natation-eau-libre';
  const isSki =
    variantId === 'ski-alpin' || variantId === 'snowboard' || variantId === 'ski-rando';
  const isIndoor =
    activity.selection?.environment === 'indoor' && !isPoolSwim;
  const isRehab = variantId.startsWith('rehab-');

  const [consoleDistInput, setConsoleDistInput] = React.useState('');
  const [consolePowerInput, setConsolePowerInput] = React.useState('');
  const [consoleCadenceInput, setConsoleCadenceInput] = React.useState('');

  if (!isPoolSwim && !isOpenWaterSwim && !isSki && !isIndoor && !isRehab) {
    return null;
  }

  const updateActivity = (patch: Partial<ActivityState>) => {
    useExplorerStore.setState((state) =>
      state.activity ? { activity: { ...state.activity, ...patch } } : {},
    );
  };

  if (isPoolSwim) {
    const poolLengthM = activity.poolLengthM ?? readStoredPoolLengthM();
    const lengths = activity.poolLengthsCount ?? 0;
    const distanceM = lengths * poolLengthM;
    const pace100 = computeSwimPace(distanceM, activity.movingS);
    return (
      <div style={{ marginTop: 10 }} data-testid="live-pool-swim-panel">
        <XpEyebrow>Natation en piscine · {poolLengthM} m</XpEyebrow>
        <XpMetrics
          items={[
            { label: 'Longueurs', value: String(lengths) },
            { label: 'Distance', value: `${Math.round(distanceM)} m` },
            { label: 'Allure /100m', value: pace100.pacePer100m.formatted ?? '—' },
          ]}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="xp-primary"
            disabled={activity.paused}
            onClick={() => {
              const nextLengths = lengths + 1;
              const nextDistanceM = nextLengths * poolLengthM;
              updateActivity({
                poolLengthM,
                poolLengthsCount: nextLengths,
                distanceM: nextDistanceM,
                elevGainM: 0,
              });
            }}
          >
            + 1 longueur ({poolLengthM} m)
          </button>
          <button
            type="button"
            className="xp-secondary"
            disabled={activity.paused || lengths === 0}
            onClick={() => {
              const nextLengths = Math.max(0, lengths - 1);
              updateActivity({
                poolLengthM,
                poolLengthsCount: nextLengths,
                distanceM: nextLengths * poolLengthM,
                elevGainM: 0,
              });
            }}
          >
            − 1
          </button>
        </div>
      </div>
    );
  }

  if (isOpenWaterSwim) {
    const pace100 = computeSwimPace(activity.distanceM, activity.movingS);
    return (
      <div style={{ marginTop: 10 }} data-testid="live-openwater-swim-panel">
        <XpEyebrow>Natation eau libre</XpEyebrow>
        <XpMetrics
          items={[
            { label: 'Distance', value: formatDistance(activity.distanceM / 1000) },
            { label: 'Allure /100m', value: pace100.pacePer100m.formatted ?? '—' },
            { label: 'D+', value: '0 m (eau libre)' },
          ]}
        />
      </div>
    );
  }

  if (isSki) {
    return (
      <div style={{ marginTop: 10 }} data-testid="live-ski-panel">
        <XpEyebrow>
          {variantId === 'snowboard'
            ? 'Snowboard · descentes'
            : variantId === 'ski-rando'
              ? 'Ski de randonnée'
              : 'Ski alpin · hors remontées'}
        </XpEyebrow>
        <XpMetrics
          items={[
            { label: 'Descentes', value: String(activity.skiRunsCount ?? 0) },
            { label: 'D− descente', value: formatElevation(activity.skiDescentM ?? 0) ?? '0 m' },
            {
              label: variantId === 'ski-rando' ? 'D+ rando' : 'Remontées',
              value:
                variantId === 'ski-rando'
                  ? `${Math.round(activity.elevGainM)} m`
                  : 'Exclues du D+',
            },
          ]}
        />
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10 }} data-testid="live-indoor-rehab-panel">
      {isIndoor ? (
        <>
          <XpEyebrow>Console indoor · sans GPS</XpEyebrow>
          <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--xp-mut)' }}>
            Saisis uniquement les mesures réelles affichées sur ta console ; aucune donnée n’est
            estimée automatiquement.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="number"
              min={0}
              placeholder="Distance (m)"
              aria-label="Distance console en mètres"
              value={consoleDistInput}
              onChange={(e) => setConsoleDistInput(e.target.value)}
              style={{ width: 110, padding: '6px 8px', borderRadius: 8, fontSize: 12 }}
            />
            <input
              type="number"
              min={0}
              placeholder="Puissance (W)"
              aria-label="Puissance console en watts"
              value={consolePowerInput}
              onChange={(e) => setConsolePowerInput(e.target.value)}
              style={{ width: 105, padding: '6px 8px', borderRadius: 8, fontSize: 12 }}
            />
            <input
              type="number"
              min={0}
              placeholder="Cadence (rpm)"
              aria-label="Cadence console en tours par minute"
              value={consoleCadenceInput}
              onChange={(e) => setConsoleCadenceInput(e.target.value)}
              style={{ width: 110, padding: '6px 8px', borderRadius: 8, fontSize: 12 }}
            />
            <button
              type="button"
              className="xp-chip"
              onClick={() => {
                const dist = Number(consoleDistInput);
                const power = Number(consolePowerInput);
                const cad = Number(consoleCadenceInput);
                updateActivity({
                  ...(Number.isFinite(dist) && dist > 0
                    ? { distanceM: dist, indoorConsoleDistanceM: dist }
                    : {}),
                  ...(Number.isFinite(power) && power > 0 ? { indoorConsolePowerW: power } : {}),
                  ...(Number.isFinite(cad) && cad > 0 ? { indoorConsoleCadenceRpm: cad } : {}),
                });
              }}
            >
              Appliquer
            </button>
          </div>
        </>
      ) : null}

      {isRehab ? (
        <div style={{ marginTop: 10 }}>
          <XpEyebrow>Suivi rééducation</XpEyebrow>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select
              aria-label="Zone corporelle de rééducation"
              value={activity.rehabBodyZone ?? ''}
              onChange={(e) => updateActivity({ rehabBodyZone: e.target.value || null })}
              style={{ padding: '6px 8px', borderRadius: 8, fontSize: 12 }}
            >
              <option value="">Zone (optionnel)</option>
              {REHAB_BODY_ZONES.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Niveau de douleur ressenti"
              value={activity.rehabPainLevel ?? ''}
              onChange={(e) =>
                updateActivity({
                  rehabPainLevel: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              style={{ padding: '6px 8px', borderRadius: 8, fontSize: 12 }}
            >
              <option value="">Douleur /10 (optionnel)</option>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((lvl) => (
                <option key={lvl} value={lvl}>
                  Douleur {lvl}/10
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Résumé spécifique fin de séance pour modes A01 (S1.09–S1.12).
 */
export function SummarySpecializedPanel({ summary }: { summary: ActivityState }) {
  const variantId = summary.selection?.variantId ?? '';
  if (variantId === 'natation-piscine') {
    const poolM = summary.poolLengthM ?? 25;
    const lengths = summary.poolLengthsCount ?? 0;
    const pace = computeSwimPace(summary.distanceM, summary.movingS);
    return (
      <XpRows>
        <XpRow
          icon="route"
          title={`${lengths} longueurs · bassin ${poolM} m`}
          sub={`Allure ${pace.pacePer100m.formatted ?? 'indisponible'}`}
        />
      </XpRows>
    );
  }
  if (variantId === 'ski-alpin' || variantId === 'snowboard' || variantId === 'ski-rando') {
    return (
      <XpRows>
        <XpRow
          icon="mtn"
          title={`${summary.skiRunsCount ?? 0} descente(s) détectée(s)`}
          sub={`D− ${Math.round(summary.skiDescentM ?? 0)} m · remontées exclues`}
        />
      </XpRows>
    );
  }
  if (summary.rehabBodyZone || summary.rehabPainLevel !== undefined) {
    return (
      <XpRows>
        <XpRow
          icon="heart"
          title="Rééducation"
          sub={[
            summary.rehabBodyZone ? `Zone : ${summary.rehabBodyZone}` : null,
            summary.rehabPainLevel !== null && summary.rehabPainLevel !== undefined
              ? `Douleur : ${summary.rehabPainLevel}/10`
              : null,
          ]
            .filter(Boolean)
            .join(' · ') || 'Séance enregistrée'}
        />
      </XpRows>
    );
  }
  return null;
}

/**
 * K6.05 / S3.27 — Export GPX et TCX d'un itinéraire OSM dans le drawer Parcours.
 */
export function RouteExportButtons({
  routeId,
  routeName,
}: {
  routeId: string | number;
  routeName?: string | null;
}) {
  const [downloading, setDownloading] = React.useState<'gpx' | 'tcx' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const download = async (format: 'gpx' | 'tcx') => {
    setError(null);
    setDownloading(format);
    try {
      const cleanId = String(routeId).replace(/^osm:relation:/, '');
      const url = `/api/explorer/osm/route/${encodeURIComponent(cleanId)}/export?format=${format}`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? `Export ${format.toUpperCase()} indisponible.`);
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeName = (routeName ?? `parcours-${cleanId}`)
        .replace(/[^a-z0-9-_]+/gi, '-')
        .slice(0, 60);
      link.href = objectUrl;
      link.download = `${safeName || 'parcours'}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError(`Impossible de télécharger le fichier ${format.toUpperCase()}.`);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div style={{ marginTop: 10 }} data-testid="route-export-actions">
      <XpEyebrow>Exporter l’itinéraire</XpEyebrow>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="xp-secondary"
          disabled={downloading !== null}
          onClick={() => void download('gpx')}
        >
          {downloading === 'gpx' ? 'Préparation GPX…' : 'Exporter en GPX'}
        </button>
        <button
          type="button"
          className="xp-secondary"
          disabled={downloading !== null}
          onClick={() => void download('tcx')}
        >
          {downloading === 'tcx' ? 'Préparation TCX…' : 'Exporter en TCX'}
        </button>
      </div>
      {error ? (
        <XpEmpty title="Export impossible" hint={error} />
      ) : null}
    </div>
  );
}
