'use client';

import React, { useCallback, useMemo, useState } from 'react';
import type {
  DataLevel,
  EffortMultipliers,
  EffortQuantileInterval,
  EffortRiskAssessment,
  EffortShapleyContributions,
  Evidence,
} from '@/features/adventure-intelligence/schemas/effort.schema';
import { DrawerButton, DrawerToggle, OverlaySheet } from './OverlaySheet';

export type EffortSubDrawerKind =
  | 'effort-why'
  | 'effort-group'
  | 'effort-fatigue'
  | 'effort-privacy'
  | 'effort-expert';

export type EffortUiState = 'idle' | 'loading' | 'ready' | 'saving' | 'error' | 'offline';

export type ConsentPurposeKey =
  | 'personal_scoring'
  | 'wearable_sync'
  | 'group_simulation'
  | 'anonymized_calibration';

export const EFFORT_CSS_VARS: React.CSSProperties = {
  '--good': '#3D7A52',
  '--warn': '#B98A2E',
  '--bad': '#A8443A',
  '--tint': '#17402C',
} as React.CSSProperties;

/**
 * Retour haptique léger optionnel (10 ms), protégé contre l'absence d'API
 * navigateur et désactivé si l'utilisateur préfère réduire les animations.
 */
export function haptic(durationMs = 10): void {
  try {
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(durationMs);
    }
  } catch {
    // Aucun support haptique dans cet environnement.
  }
}

export function formatDataLevelLabel(level?: DataLevel | null): string {
  if (level === 'socle') return 'Niveau de données : Socle';
  if (level === 'cardio') return 'Niveau de données : Cardio';
  if (level === 'complet') return 'Niveau de données : Complet';
  return 'Niveau de données : non évalué';
}

export function formatDataLevelShort(level?: DataLevel | null): string {
  if (level === 'socle') return 'Socle';
  if (level === 'cardio') return 'Cardio';
  if (level === 'complet') return 'Complet';
  return 'non évalué';
}

/**
 * Formate une valeur numérique ou retourne « — » si elle est absente.
 * Ne remplace jamais une valeur absente par « 0 ».
 */
export function formatEffortValue(
  value: number | null | undefined,
  options?: { decimals?: number; suffix?: string; signed?: boolean }
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  const decimals = options?.decimals ?? 0;
  const absFormatted = Math.abs(value).toFixed(decimals).replace('.', ',');
  const sign =
    value < 0 ? '-' : options?.signed && value > 0 ? '+' : '';
  const suffix = options?.suffix ? ` ${options.suffix}` : '';
  return `${sign}${absFormatted}${suffix}`;
}

export function formatEffortInterval(
  interval?: EffortQuantileInterval | null,
  suffix = '%'
): string {
  if (
    !interval ||
    !Number.isFinite(interval.p10) ||
    !Number.isFinite(interval.p90)
  ) {
    return '—';
  }
  const p10 = Math.round(interval.p10);
  const p90 = Math.round(interval.p90);
  return `[${p10} ${suffix} – ${p90} ${suffix}]`;
}

export function formatPreventiveRiskMessage(risque?: EffortRiskAssessment | null): string {
  if (!risque) return 'non évalué';
  if (risque.factors && risque.factors.length > 0) {
    return risque.factors.join(' · ');
  }
  if (risque.level === 'critical' || risque.level === 'high') {
    return 'Vigilance refroidissement et visibilité : pause coupe-vent et marge horaire conseillées.';
  }
  if (risque.level === 'moderate') {
    return 'Vigilance terrain : pauses régulières, hydratation et coupe-vent en fond de sac conseillés.';
  }
  return 'Conditions stables : équipement standard de randonnée et hydratation régulière conseillés.';
}

export function formatTechniciteLabel(technicite?: number | null): string {
  if (technicite === null || technicite === undefined || !Number.isFinite(technicite)) {
    return 'non évalué';
  }
  const clamped = Math.max(1, Math.min(5, Math.round(technicite)));
  const descriptions: Record<number, string> = {
    1: '1 / 5 · Sentier roulant et régulier',
    2: '2 / 5 · Sentier de montagne balisé',
    3: '3 / 5 · Sentier soutenu avec passages pierreux',
    4: '4 / 5 · Terrain alpin exigeant, appuis attentifs',
    5: '5 / 5 · Itinéraire très technique et exposé',
  };
  return descriptions[clamped] ?? `${clamped} / 5`;
}

export interface EffortElevationSegment {
  segmentId: number;
  label: string;
  distanceKm: number | null;
  altitudeM: number | null;
  slopePct: number | null;
  surface: string;
  intensityTone: 'good' | 'warn' | 'bad';
  intensityLabel: 'Modéré' | 'Soutenu' | 'Exigeant';
}

export interface EffortOutingSummary {
  title?: string;
  dateLabel?: string;
  scoreVersion?: string;
  snapshotHash?: string | null;
  iea?: number | null;
  erp?: number | null;
  eFlatKm?: number | null;
  rawDose?: number | null;
  interval?: EffortQuantileInterval | null;
  technicite?: number | null;
  risque?: EffortRiskAssessment | null;
  dataLevel?: DataLevel | null;
  actionPhrase?: string | null;
  shapley?: EffortShapleyContributions | null;
  multipliers?: EffortMultipliers | null;
  elevationSegments?: EffortElevationSegment[];
  evidence?: Array<Evidence<unknown>>;
}

export interface EffortPlannedOutingSummary extends EffortOutingSummary {
  departureLabel?: string;
  twilightMarginLabel?: string;
}

export interface EffortHeatmapCell {
  segmentId: number;
  segmentLabel: string;
  tone: 'good' | 'warn' | 'bad';
  /** Libellé textuel explicite obligatoire dans chaque cellule (WCAG 1.4.11). */
  textLabel: string;
}

export interface EffortHeatmapMemberRow {
  /** Libellé anonyme ou pseudonyme sans donnée biométrique individuelle. */
  memberLabel: string;
  cells: EffortHeatmapCell[];
}

export interface EffortGroupDrawerData {
  mode: 'regroupement' | 'compact';
  memberCount: number | null;
  groupPaceKmH: number | null;
  collectiveIea: number | null;
  collectiveTechnicite: number | null;
  actionPhrase: string | null;
  twilightMarginMin: number | null;
  twilightMarginIntervalMin?: { p10: number; p50: number; p90: number } | null;
  regroupWaitMin: number | null;
  coolingAlertRegroupement: string | null;
  coolingAlertCompact: string | null;
  pauseEveryMinutes: number | null;
  redistributionTransfers: number | null;
  redistributionWeightKg: number | null;
  cohesionLabel: string | null;
  heatmapRows: EffortHeatmapMemberRow[];
}

export interface EffortFatigueDrawerData {
  status: 'available' | 'unavailable';
  formLabel: string | null;
  fitnessCtl: number | null;
  fatigueAtl: number | null;
  formTsb: number | null;
  weeklyLoad: number | null;
  activeDaysCount: number | null;
  descriptiveGuidance: string | null;
  progressionHref?: string;
}

export interface EffortConsentItem {
  purpose: ConsentPurposeKey;
  title: string;
  description: string;
  granted: boolean;
  updatedAt?: string | null;
}

export interface EffortPrivacyDrawerData {
  dataLevel: DataLevel | null;
  evidence: Array<Evidence<unknown>>;
  consents: EffortConsentItem[];
}

export interface EffortAblationRow {
  id: string;
  label: string;
  iea: number | null;
  deltaPts: number | null;
}

export interface EffortExpertRawSegmentRow {
  segmentId: number;
  distanceM: number | null;
  altitudeM: number | null;
  slopePct: number | null;
  surface: string;
  eta: number | null;
  powerW: number | null;
  doseDeff: number | null;
}

export interface EffortExpertDrawerData {
  scoreVersion: string;
  snapshotHash: string | null;
  iea: number | null;
  erp: number | null;
  eFlatKm: number | null;
  rawDose: number | null;
  multipliers: EffortMultipliers | null;
  ablations: EffortAblationRow[];
  rawSegments: EffortExpertRawSegmentRow[];
}

export interface EffortSharedStateProps {
  state?: EffortUiState;
  diagnosticId?: string | null;
  errorMessage?: string | null;
  cachedAt?: string | null;
  onRetry?: () => void;
}

const DEFAULT_CONSENT_DEFINITIONS: ReadonlyArray<{
  purpose: ConsentPurposeKey;
  title: string;
  description: string;
}> = [
  {
    purpose: 'personal_scoring',
    title: 'Calcul personnel d’effort (IEA & ERP)',
    description:
      'Autorise le calcul bioénergétique de tes sorties à partir de la trace, du sac et de tes paramètres personnels.',
  },
  {
    purpose: 'wearable_sync',
    title: 'Synchronisation capteurs & montres (Cardio)',
    description:
      'Active la fusion bayésienne avec la fréquence cardiaque observée pour affiner la fourchette [P10–P90].',
  },
  {
    purpose: 'group_simulation',
    title: 'Simulation collective de sortie de groupe',
    description:
      'Inclut ton profil d’allure dans l’estimation collective du groupe, sans jamais exposer tes données biométriques.',
  },
  {
    purpose: 'anonymized_calibration',
    title: 'Calibration anonymisée des sentiers',
    description:
      'Contribue aux temps de passage agrégés sur les tronçons publics après filtrage d’anonymat.',
  },
];

const EVIDENCE_KIND_LABELS: Record<Evidence<unknown>['kind'], string> = {
  measured: 'Mesuré',
  derived: 'Dérivé',
  imputed: 'Imputé',
  declared: 'Déclaré',
};

export function formatTimestampFr(iso?: string | null): string {
  if (!iso) return '—';
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(parsed));
}

/**
 * Composant transversal de gestion des 6 états d'interface :
 * `idle`, `loading`, `ready`, `saving`, `error`, `offline`.
 */
export function EffortStateFeedback({
  state = 'ready',
  diagnosticId,
  errorMessage,
  cachedAt,
  onRetry,
}: EffortSharedStateProps) {
  const [copiedDiag, setCopiedDiag] = useState(false);
  const resolvedDiagId = diagnosticId || 'DIAG-EFFORT-V1-001';

  const handleCopyDiag = useCallback(() => {
    haptic();
    try {
      void navigator.clipboard?.writeText?.(resolvedDiagId);
    } catch {
      // Clipboard indisponible en environnement restreint.
    }
    setCopiedDiag(true);
  }, [resolvedDiagId]);

  if (state === 'loading') {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-live="polite"
        data-testid="effort-state-loading"
        className="lkdv-overlay-card"
        style={{
          ...EFFORT_CSS_VARS,
          padding: '14px',
          marginBottom: '10px',
          background: '#FFFFFF',
          color: '#172B24',
        }}
      >
        <span className="sr-only">Chargement de l’analyse d’effort en cours…</span>
        <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: '#172B24' }}>
          Chargement de l’analyse d’effort…
        </p>
        <div
          aria-hidden="true"
          style={{
            height: '10px',
            width: '72%',
            borderRadius: '999px',
            background: 'rgba(23, 64, 44, 0.14)',
            marginBottom: '7px',
          }}
        />
        <div
          aria-hidden="true"
          style={{
            height: '10px',
            width: '48%',
            borderRadius: '999px',
            background: 'rgba(23, 64, 44, 0.10)',
          }}
        />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div
        role="alert"
        aria-live="assertive"
        data-testid="effort-state-error"
        className="lkdv-overlay-card"
        style={{
          ...EFFORT_CSS_VARS,
          padding: '14px',
          marginBottom: '10px',
          background: '#FFF8F7',
          border: '1px solid var(--bad, #A8443A)',
          color: '#172B24',
        }}
      >
        <b style={{ display: 'block', fontSize: '13px', color: '#172B24' }}>
          Analyse d’effort momentanément indisponible
        </b>
        <p style={{ margin: '4px 0 10px', fontSize: '12px', color: '#172B24' }}>
          {errorMessage || 'La récupération des données d’effort a échoué. Aucune valeur n’est extrapolée.'}
        </p>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px',
            marginBottom: onRetry ? '10px' : '0',
          }}
        >
          <code
            data-testid="effort-diagnostic-id"
            style={{
              padding: '4px 8px',
              borderRadius: '8px',
              background: '#FFFFFF',
              border: '1px solid rgba(23, 43, 36, 0.2)',
              fontSize: '11px',
              color: '#172B24',
            }}
          >
            ID diagnostic : {resolvedDiagId}
          </code>
          <DrawerButton
            tone="secondary"
            onClick={handleCopyDiag}
            aria-label={`Copier l’ID diagnostic ${resolvedDiagId}`}
          >
            {copiedDiag ? 'ID copié' : 'Copier l’ID diagnostic'}
          </DrawerButton>
        </div>
        {onRetry ? (
          <DrawerButton
            tone="primary"
            onClick={() => {
              haptic();
              onRetry();
            }}
          >
            Réessayer
          </DrawerButton>
        ) : null}
      </div>
    );
  }

  if (state === 'offline') {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="effort-state-offline"
        className="lkdv-overlay-card"
        style={{
          ...EFFORT_CSS_VARS,
          padding: '10px 12px',
          marginBottom: '10px',
          background: '#FDF6E7',
          border: '1px solid var(--warn, #B98A2E)',
          color: '#172B24',
          fontSize: '12px',
          fontWeight: 600,
        }}
      >
        Hors ligne — dernier cache : {formatTimestampFr(cachedAt)}
      </div>
    );
  }

  if (state === 'saving') {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-live="polite"
        data-testid="effort-state-saving"
        className="lkdv-overlay-card"
        style={{
          ...EFFORT_CSS_VARS,
          padding: '10px 12px',
          marginBottom: '10px',
          background: '#F2F7EE',
          border: '1px solid var(--good, #3D7A52)',
          color: '#172B24',
          fontSize: '12px',
          fontWeight: 600,
        }}
      >
        Enregistrement des préférences d’effort en cours…
      </div>
    );
  }

  if (state === 'idle') {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="effort-state-idle"
        className="lkdv-overlay-card"
        style={{
          ...EFFORT_CSS_VARS,
          padding: '10px 12px',
          marginBottom: '10px',
          background: '#FFFFFF',
          border: '1px solid rgba(23, 43, 36, 0.14)',
          color: '#172B24',
          fontSize: '12px',
        }}
      >
        En attente d’une sortie évaluée — les mesures absentes affichent « — » ou « non évalué ».
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOUS-DRAWER 1 (NIVEAU 1) : POURQUOI CE SCORE ? (`effort-why`)
// ─────────────────────────────────────────────────────────────────────────────

export interface EffortWhyDrawerProps extends EffortSharedStateProps {
  outing?: EffortOutingSummary | null;
  onClose: () => void;
}

interface ShapleyFactorItem {
  id: string;
  label: string;
  deltaPts: number | null;
  description: string;
}

export function EffortWhyDrawer({
  outing,
  state = 'ready',
  diagnosticId,
  errorMessage,
  cachedAt,
  onRetry,
  onClose,
}: EffortWhyDrawerProps) {
  const shapley = outing?.shapley ?? null;

  const sixFactors: ShapleyFactorItem[] = useMemo(() => {
    const hasShapley = shapley !== null && shapley !== undefined;
    const slopeDelta =
      hasShapley &&
      Number.isFinite(shapley.ascent) &&
      Number.isFinite(shapley.descent)
        ? Number((shapley.ascent + shapley.descent).toFixed(1))
        : null;
    return [
      {
        id: 'pente-denivele',
        label: '1. Dénivelé & pente (montée / descente)',
        deltaPts: slopeDelta,
        description: 'Coût gravitaire en montée et sollicitation excentrique en descente.',
      },
      {
        id: 'charge-sac',
        label: '2. Charge portée (sac & équipement)',
        deltaPts: hasShapley && Number.isFinite(shapley.packLoad) ? shapley.packLoad : null,
        description: 'Surcoût métabolique du portage rapporté à la masse corporelle.',
      },
      {
        id: 'terrain-neige',
        label: '3. Terrain & neige (coefficient η)',
        deltaPts:
          hasShapley && Number.isFinite(shapley.surfaceAndSnow)
            ? shapley.surfaceAndSnow
            : null,
        description: 'Rugosité du sol, boue ou enfoncement dans le manteau neigeux.',
      },
      {
        id: 'meteo-vent',
        label: '4. Météo & traînée du vent',
        deltaPts:
          hasShapley && Number.isFinite(shapley.thermalAndWind)
            ? shapley.thermalAndWind
            : null,
        description: 'Contrainte thermique et résistance aérodynamique face au vent.',
      },
      {
        id: 'altitude-hypoxie',
        label: '5. Altitude & pression atmosphérique',
        deltaPts:
          hasShapley && Number.isFinite(shapley.altitude) ? shapley.altitude : null,
        description: 'Réduction de la capacité aérobie disponible avec l’altitude.',
      },
      {
        id: 'duree-fatigue',
        label: '6. Durée & dérive de fatigue cumulée',
        deltaPts:
          hasShapley && Number.isFinite(shapley.fatigue) ? shapley.fatigue : null,
        description: 'Accumulation temporelle de la dose interne sur la sortie.',
      },
    ];
  }, [shapley]);

  const maxAbsScale = useMemo(() => {
    const valid = sixFactors
      .map((item) => (item.deltaPts !== null && Number.isFinite(item.deltaPts) ? Math.abs(item.deltaPts) : 0));
    return Math.max(15, ...valid);
  }, [sixFactors]);

  const segments: EffortElevationSegment[] = useMemo(() => {
    if (outing?.elevationSegments && outing.elevationSegments.length > 0) {
      return outing.elevationSegments;
    }
    return [];
  }, [outing?.elevationSegments]);

  const toneColor = (tone: 'good' | 'warn' | 'bad') => {
    if (tone === 'bad') return 'var(--bad, #A8443A)';
    if (tone === 'warn') return 'var(--warn, #B98A2E)';
    return 'var(--good, #3D7A52)';
  };

  return (
    <OverlaySheet
      title="Pourquoi ce score ?"
      subtitle="6 facteurs Shapley sur échelle signée & profil altimétrique"
      onClose={onClose}
      nested
      className="lkdv-effort-subdrawer"
    >
      <div
        tabIndex={0}
        style={{ ...EFFORT_CSS_VARS, display: 'flex', flexDirection: 'column', gap: '12px', color: '#172B24' }}
      >
        <EffortStateFeedback
          state={state}
          diagnosticId={diagnosticId}
          errorMessage={errorMessage}
          cachedAt={cachedAt}
          onRetry={onRetry}
        />

        {state !== 'loading' && state !== 'error' ? (
          <>
            <section
              aria-labelledby="lkdv-shapley-section-title"
              className="lkdv-overlay-card"
              style={{ padding: '12px', background: '#FFFFFF' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                <h3 id="lkdv-shapley-section-title" style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, color: '#172B24' }}>
                  Attribution additive des 6 facteurs (Shapley)
                </h3>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#172B24' }}>
                  Échelle signée ±{Math.round(maxAbsScale)} pts
                </span>
              </div>
              <p style={{ margin: '0 0 10px', fontSize: '11.5px', color: '#172B24' }}>
                Chaque barre mesure la contribution signée du facteur par rapport à une marche de référence sur terrain plat, sur la même échelle centrée sur zéro.
              </p>

              <div
                data-testid="shapley-bars-list"
                data-scale-min={-maxAbsScale}
                data-scale-max={maxAbsScale}
                style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
              >
                {sixFactors.map((factor) => {
                  const hasVal = factor.deltaPts !== null && Number.isFinite(factor.deltaPts);
                  const val = hasVal ? (factor.deltaPts as number) : 0;
                  const ratioPct = hasVal
                    ? Math.min(50, (Math.abs(val) / maxAbsScale) * 50)
                    : 0;
                  const leftPct = val >= 0 ? 50 : 50 - ratioPct;
                  const barColor =
                    val > 5
                      ? 'var(--bad, #A8443A)'
                      : val > 0
                        ? 'var(--warn, #B98A2E)'
                        : 'var(--good, #3D7A52)';
                  const formattedDelta = hasVal
                    ? `${formatEffortValue(val, { decimals: 1, signed: true })} pts`
                    : '— (non évalué)';

                  return (
                    <div
                      key={factor.id}
                      data-testid={`shapley-factor-${factor.id}`}
                      data-scale-shared={`-${maxAbsScale}:+${maxAbsScale}`}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '12px',
                        background: '#F6F9F4',
                        border: '1px solid rgba(23, 43, 36, 0.1)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                        <b style={{ fontSize: '12px', color: '#172B24' }}>{factor.label}</b>
                        <span
                          data-testid={`shapley-value-${factor.id}`}
                          style={{ fontSize: '12px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#172B24' }}
                        >
                          {formattedDelta}
                        </span>
                      </div>
                      <div
                        role="img"
                        aria-label={`${factor.label} : ${formattedDelta} sur une échelle de -${Math.round(maxAbsScale)} à +${Math.round(maxAbsScale)} points`}
                        style={{
                          position: 'relative',
                          height: '10px',
                          borderRadius: '999px',
                          background: 'rgba(23, 43, 36, 0.12)',
                          margin: '6px 0 4px',
                          overflow: 'hidden',
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            position: 'absolute',
                            left: '50%',
                            top: 0,
                            bottom: 0,
                            width: '1.5px',
                            background: '#172B24',
                          }}
                        />
                        {hasVal ? (
                          <span
                            aria-hidden="true"
                            style={{
                              position: 'absolute',
                              left: `${leftPct}%`,
                              width: `${Math.max(2, ratioPct)}%`,
                              top: '1px',
                              bottom: '1px',
                              borderRadius: '999px',
                              background: barColor,
                            }}
                          />
                        ) : null}
                      </div>
                      <small style={{ display: 'block', fontSize: '11px', color: '#172B24' }}>
                        {factor.description}
                      </small>
                    </div>
                  );
                })}
              </div>
            </section>

            <section
              aria-labelledby="lkdv-elevation-profile-title"
              className="lkdv-overlay-card"
              style={{ padding: '12px', background: '#FFFFFF' }}
            >
              <h3 id="lkdv-elevation-profile-title" style={{ margin: '0 0 6px', fontSize: '13.5px', fontWeight: 700, color: '#172B24' }}>
                Profil altimétrique coloré par intensité d’effort
              </h3>

              {segments.length === 0 ? (
                <p data-testid="elevation-empty" style={{ margin: 0, fontSize: '12px', color: '#172B24' }}>
                  Profil altimétrique : non évalué (—). Aucun tronçon altimétrique disponible pour cette sortie.
                </p>
              ) : (
                <>
                  <svg
                    viewBox="0 0 320 110"
                    role="img"
                    aria-labelledby="lkdv-alt-svg-title lkdv-alt-svg-desc"
                    data-accessibility-layer="true"
                    style={{ width: '100%', height: '110px', display: 'block', background: '#F6F9F4', borderRadius: '12px', marginBottom: '10px' }}
                  >
                    <title id="lkdv-alt-svg-title">Profil altimétrique coloré de la sortie</title>
                    <desc id="lkdv-alt-svg-desc">
                      Représentation par tronçon de l’altitude et de l’intensité bioénergétique avec couche d’accessibilité explicite.
                    </desc>
                    {(() => {
                      const altitudes = segments.map((s) => s.altitudeM ?? 0);
                      const minAlt = Math.min(...altitudes);
                      const maxAlt = Math.max(minAlt + 50, ...altitudes);
                      const stepW = 290 / Math.max(1, segments.length);

                      return (
                        <>
                          {segments.map((seg, index) => {
                            const x = 15 + index * stepW;
                            const alt = seg.altitudeM ?? minAlt;
                            const norm = (alt - minAlt) / Math.max(1, maxAlt - minAlt);
                            const barH = 18 + Math.round(norm * 64);
                            const y = 92 - barH;
                            return (
                              <g key={seg.segmentId}>
                                <rect
                                  x={x + 2}
                                  y={y}
                                  width={Math.max(8, stepW - 4)}
                                  height={barH}
                                  rx={4}
                                  fill={toneColor(seg.intensityTone)}
                                />
                                <text
                                  x={x + stepW / 2}
                                  y={104}
                                  textAnchor="middle"
                                  fontSize="9"
                                  fill="#172B24"
                                >
                                  T{seg.segmentId}
                                </text>
                              </g>
                            );
                          })}
                          <g
                            data-testid="elevation-accessibility-layer"
                            data-accessibility-layer="true"
                            role="group"
                            aria-label="Couche d’accessibilité du profil altimétrique"
                          >
                            {segments.map((seg, index) => {
                              const x = 15 + index * stepW;
                              return (
                                <rect
                                  key={`a11y-${seg.segmentId}`}
                                  x={x}
                                  y={8}
                                  width={Math.max(10, stepW)}
                                  height={88}
                                  fill="transparent"
                                  role="graphics-symbol"
                                  aria-label={`${seg.label} : altitude ${formatEffortValue(seg.altitudeM, { suffix: 'm' })}, pente ${formatEffortValue(seg.slopePct, { decimals: 1, signed: true, suffix: '%' })}, intensité ${seg.intensityLabel}`}
                                />
                              );
                            })}
                          </g>
                        </>
                      );
                    })()}
                  </svg>

                  <div
                    data-testid="elevation-textual-equivalent"
                    role="region"
                    aria-label="Équivalent textuel du profil altimétrique"
                    style={{
                      padding: '10px',
                      borderRadius: '12px',
                      background: '#F6F9F4',
                      border: '1px solid rgba(23, 43, 36, 0.12)',
                    }}
                  >
                    <b style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: '#172B24' }}>
                      Équivalent textuel accessible par tronçon
                    </b>
                    <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11.5px', color: '#172B24', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {segments.map((seg) => (
                        <li key={seg.segmentId}>
                          <b>{seg.label}</b> — Distance : {formatEffortValue(seg.distanceKm, { decimals: 1, suffix: 'km' })} · Altitude : {formatEffortValue(seg.altitudeM, { suffix: 'm' })} · Pente : {formatEffortValue(seg.slopePct, { decimals: 1, signed: true, suffix: '%' })} · Surface : {seg.surface} · Intensité : <b>{seg.intensityLabel}</b>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </section>
          </>
        ) : null}
      </div>
    </OverlaySheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SOUS-DRAWER 2 (NIVEAU 1) : SORTIE DE GROUPE (`effort-group`)
// ─────────────────────────────────────────────────────────────────────────────

export interface EffortGroupDrawerProps extends EffortSharedStateProps {
  groupData?: EffortGroupDrawerData | null;
  onClose: () => void;
}

export function EffortGroupDrawer({
  groupData,
  state = 'ready',
  diagnosticId,
  errorMessage,
  cachedAt,
  onRetry,
  onClose,
}: EffortGroupDrawerProps) {
  const [selectedMode, setSelectedMode] = useState<'regroupement' | 'compact'>(
    groupData?.mode ?? 'regroupement'
  );

  const hasGroup = groupData !== null && groupData !== undefined;

  const activeCoolingAlert = useMemo(() => {
    if (!hasGroup) return 'non évalué';
    if (selectedMode === 'regroupement') {
      return (
        groupData?.coolingAlertRegroupement ||
        'Vigilance refroidissement d’attente : pause estimée aux points de regroupement — veste coupe-vent dès l’arrêt conseillée.'
      );
    }
    return (
      groupData?.coolingAlertCompact ||
      'Mode Compact : allure collective homogène et attente aux cols réduite — maintien thermique régulier.'
    );
  }, [groupData, hasGroup, selectedMode]);

  const twilightDisplay = useMemo(() => {
    if (!hasGroup || groupData?.twilightMarginMin == null || !Number.isFinite(groupData.twilightMarginMin)) {
      return '— (non évalué)';
    }
    const min = Math.round(groupData.twilightMarginMin);
    if (min < 0) {
      return `Débordement crépuscule de ${Math.abs(min)} min — départ avancé et lampes frontales conseillés`;
    }
    const hours = Math.floor(min / 60);
    const rem = min % 60;
    return hours > 0 ? `+${hours} h ${rem} min avant crépuscule` : `+${rem} min avant crépuscule`;
  }, [groupData, hasGroup]);

  return (
    <OverlaySheet
      title="Sortie de groupe"
      subtitle="Allure collective, marge crépuscule & matrice membres × tronçons"
      onClose={onClose}
      nested
      className="lkdv-effort-subdrawer"
    >
      <div
        tabIndex={0}
        style={{ ...EFFORT_CSS_VARS, display: 'flex', flexDirection: 'column', gap: '12px', color: '#172B24' }}
      >
        <EffortStateFeedback
          state={state}
          diagnosticId={diagnosticId}
          errorMessage={errorMessage}
          cachedAt={cachedAt}
          onRetry={onRetry}
        />

        {state !== 'loading' && state !== 'error' ? (
          <>
            <section
              aria-label="Synthèse de sortie de groupe"
              className="lkdv-overlay-card"
              style={{ padding: '12px', background: '#FFFFFF' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                <b style={{ fontSize: '13.5px', color: '#172B24' }}>
                  Discipline de marche ({hasGroup && groupData?.memberCount != null ? `${groupData.memberCount} membres` : '—'})
                </b>
                <div role="group" aria-label="Choix du mode de marche collective" style={{ display: 'flex', gap: '6px' }}>
                  <DrawerButton
                    tone={selectedMode === 'regroupement' ? 'primary' : 'secondary'}
                    aria-pressed={selectedMode === 'regroupement'}
                    onClick={() => {
                      haptic();
                      setSelectedMode('regroupement');
                    }}
                  >
                    Mode Regroupement
                  </DrawerButton>
                  <DrawerButton
                    tone={selectedMode === 'compact' ? 'primary' : 'secondary'}
                    aria-pressed={selectedMode === 'compact'}
                    onClick={() => {
                      haptic();
                      setSelectedMode('compact');
                    }}
                  >
                    Mode Compact
                  </DrawerButton>
                </div>
              </div>

              <div
                data-testid="group-action-phrase"
                style={{
                  padding: '10px',
                  borderRadius: '12px',
                  background: '#F2F7EE',
                  border: '1px solid var(--good, #3D7A52)',
                  marginBottom: '10px',
                  fontSize: '12px',
                  color: '#172B24',
                }}
              >
                <b>Action terrain : </b>
                <span>{hasGroup && groupData?.actionPhrase ? groupData.actionPhrase : 'non évalué'}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', marginBottom: '10px' }}>
                <div style={{ padding: '8px 10px', borderRadius: '10px', background: '#F6F9F4' }}>
                  <span style={{ display: 'block', fontSize: '11px', color: '#172B24' }}>Allure collective</span>
                  <b style={{ fontSize: '14px', color: '#172B24' }}>
                    {formatEffortValue(groupData?.groupPaceKmH, { decimals: 1, suffix: 'km/h' })}
                  </b>
                </div>
                <div style={{ padding: '8px 10px', borderRadius: '10px', background: '#F6F9F4' }}>
                  <span style={{ display: 'block', fontSize: '11px', color: '#172B24' }}>IEA collectif</span>
                  <b style={{ fontSize: '14px', color: '#172B24' }}>
                    {formatEffortValue(groupData?.collectiveIea, { suffix: '%' })}
                  </b>
                </div>
                <div style={{ padding: '8px 10px', borderRadius: '10px', background: '#F6F9F4' }}>
                  <span style={{ display: 'block', fontSize: '11px', color: '#172B24' }}>Marge avant crépuscule</span>
                  <b data-testid="group-twilight-margin" style={{ fontSize: '12.5px', color: '#172B24' }}>
                    {twilightDisplay}
                  </b>
                </div>
                <div style={{ padding: '8px 10px', borderRadius: '10px', background: '#F6F9F4' }}>
                  <span style={{ display: 'block', fontSize: '11px', color: '#172B24' }}>Redistribution sac</span>
                  <b style={{ fontSize: '12.5px', color: '#172B24' }}>
                    {hasGroup && groupData?.redistributionTransfers != null
                      ? groupData.redistributionTransfers === 0
                        ? 'Aucun transfert requis'
                        : `${groupData.redistributionTransfers} transfert(s) · ${formatEffortValue(groupData.redistributionWeightKg, { decimals: 1, suffix: 'kg' })}`
                      : '—'}
                  </b>
                </div>
              </div>

              <div
                role="region"
                aria-label="Vigilance refroidissement d’attente"
                data-testid="group-cooling-alert"
                style={{
                  padding: '10px',
                  borderRadius: '12px',
                  background: '#FDF6E7',
                  border: '1.5px solid var(--warn, #B98A2E)',
                  fontSize: '12px',
                  color: '#172B24',
                }}
              >
                <b>Alerte refroidissement d’attente ({selectedMode === 'regroupement' ? 'Mode Regroupement' : 'Mode Compact'}) : </b>
                <span>{activeCoolingAlert}</span>
              </div>
            </section>

            <section
              aria-labelledby="lkdv-group-heatmap-title"
              className="lkdv-overlay-card"
              style={{ padding: '12px', background: '#FFFFFF' }}
            >
              <h3 id="lkdv-group-heatmap-title" style={{ margin: '0 0 4px', fontSize: '13.5px', fontWeight: 700, color: '#172B24' }}>
                Matrice membres × tronçons (sans donnée biométrique individuelle)
              </h3>
              <p style={{ margin: '0 0 8px', fontSize: '11.5px', color: '#172B24' }}>
                Chaque cellule indique explicitement par un libellé textuel le ressenti relatif d’allure et de pause sur le tronçon (WCAG 1.4.11).
              </p>

              {!hasGroup || !groupData?.heatmapRows || groupData.heatmapRows.length === 0 ? (
                <p data-testid="group-heatmap-empty" style={{ margin: 0, fontSize: '12px', color: '#172B24' }}>
                  Matrice collective : non évalué (—).
                </p>
              ) : (
                <div tabIndex={0} style={{ overflowX: 'auto' }}>
                  <table
                    data-testid="group-heatmap-table"
                    style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', color: '#172B24' }}
                  >
                    <thead>
                      <tr>
                        <th
                          scope="col"
                          style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid rgba(23, 43, 36, 0.2)' }}
                        >
                          Membre
                        </th>
                        {groupData.heatmapRows[0].cells.map((cell) => (
                          <th
                            key={cell.segmentId}
                            scope="col"
                            style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid rgba(23, 43, 36, 0.2)' }}
                          >
                            {cell.segmentLabel}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {groupData.heatmapRows.map((row) => (
                        <tr key={row.memberLabel}>
                          <th
                            scope="row"
                            style={{
                              textAlign: 'left',
                              padding: '7px 8px',
                              borderBottom: '1px solid rgba(23, 43, 36, 0.1)',
                              fontWeight: 700,
                            }}
                          >
                            {row.memberLabel}
                          </th>
                          {row.cells.map((cell) => {
                            const borderColor =
                              cell.tone === 'bad'
                                ? 'var(--bad, #A8443A)'
                                : cell.tone === 'warn'
                                  ? 'var(--warn, #B98A2E)'
                                  : 'var(--good, #3D7A52)';
                            const bgColor =
                              cell.tone === 'bad'
                                ? '#FFF5F4'
                                : cell.tone === 'warn'
                                  ? '#FDF6E7'
                                  : '#F2F7EE';
                            return (
                              <td
                                key={cell.segmentId}
                                data-testid="group-heatmap-cell"
                                data-tone={cell.tone}
                                style={{
                                  padding: '7px 8px',
                                  borderBottom: '1px solid rgba(23, 43, 36, 0.1)',
                                }}
                              >
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '3px 7px',
                                    borderRadius: '8px',
                                    background: bgColor,
                                    border: `1.5px solid ${borderColor}`,
                                    color: '#172B24',
                                    fontWeight: 600,
                                  }}
                                >
                                  {cell.textLabel || 'non évalué'}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </OverlaySheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SOUS-DRAWER 3 (NIVEAU 1) : FORME & FATIGUE (`effort-fatigue`)
// ─────────────────────────────────────────────────────────────────────────────

export interface EffortFatigueDrawerProps extends EffortSharedStateProps {
  fatigueData?: EffortFatigueDrawerData | null;
  onClose: () => void;
}

export function EffortFatigueDrawer({
  fatigueData,
  state = 'ready',
  diagnosticId,
  errorMessage,
  cachedAt,
  onRetry,
  onClose,
}: EffortFatigueDrawerProps) {
  const isAvailable = fatigueData?.status === 'available';

  return (
    <OverlaySheet
      title="Forme & fatigue"
      subtitle="Condition chronique, fatigue récente & lien avec ta charge d’entraînement"
      onClose={onClose}
      nested
      className="lkdv-effort-subdrawer"
    >
      <div
        tabIndex={0}
        style={{ ...EFFORT_CSS_VARS, display: 'flex', flexDirection: 'column', gap: '12px', color: '#172B24' }}
      >
        <EffortStateFeedback
          state={state}
          diagnosticId={diagnosticId}
          errorMessage={errorMessage}
          cachedAt={cachedAt}
          onRetry={onRetry}
        />

        {state !== 'loading' && state !== 'error' ? (
          <section
            aria-labelledby="lkdv-fatigue-section-title"
            className="lkdv-overlay-card"
            style={{ padding: '12px', background: '#FFFFFF' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <h3 id="lkdv-fatigue-section-title" style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, color: '#172B24' }}>
                Équilibre de charge (CTL 42 j / ATL 7 j / TSB)
              </h3>
              <span
                data-testid="fatigue-form-chip"
                style={{
                  padding: '3px 9px',
                  borderRadius: '999px',
                  background: '#F2F7EE',
                  border: '1px solid var(--good, #3D7A52)',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  color: '#172B24',
                }}
              >
                {isAvailable && fatigueData?.formLabel ? fatigueData.formLabel : 'non évalué'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', marginBottom: '10px' }}>
              <div style={{ padding: '8px 10px', borderRadius: '10px', background: '#F6F9F4' }}>
                <span style={{ display: 'block', fontSize: '11px', color: '#172B24' }}>Condition de fond (CTL 42 j)</span>
                <b data-testid="fatigue-ctl" style={{ fontSize: '14px', color: '#172B24' }}>
                  {isAvailable ? formatEffortValue(fatigueData?.fitnessCtl) : '—'}
                </b>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: '10px', background: '#F6F9F4' }}>
                <span style={{ display: 'block', fontSize: '11px', color: '#172B24' }}>Fatigue récente (ATL 7 j)</span>
                <b data-testid="fatigue-atl" style={{ fontSize: '14px', color: '#172B24' }}>
                  {isAvailable ? formatEffortValue(fatigueData?.fatigueAtl) : '—'}
                </b>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: '10px', background: '#F6F9F4' }}>
                <span style={{ display: 'block', fontSize: '11px', color: '#172B24' }}>Équilibre de forme (TSB)</span>
                <b data-testid="fatigue-tsb" style={{ fontSize: '14px', color: '#172B24' }}>
                  {isAvailable ? formatEffortValue(fatigueData?.formTsb, { signed: true }) : '—'}
                </b>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: '10px', background: '#F6F9F4' }}>
                <span style={{ display: 'block', fontSize: '11px', color: '#172B24' }}>Charge 7 derniers jours</span>
                <b data-testid="fatigue-weekly" style={{ fontSize: '14px', color: '#172B24' }}>
                  {isAvailable ? formatEffortValue(fatigueData?.weeklyLoad) : '—'}
                </b>
              </div>
            </div>

            <p data-testid="fatigue-descriptive-guidance" style={{ margin: '0 0 12px', fontSize: '12px', lineHeight: 1.45, color: '#172B24' }}>
              {isAvailable && fatigueData?.descriptiveGuidance
                ? fatigueData.descriptiveGuidance
                : 'Lecture descriptive apaisée : ta disponibilité du jour ajuste l’Effort Relatif Personnel (ERP) par rapport à l’Indice d’Effort Absolu (IEA), sans ratio anxiogène.'}
            </p>

            <a
              href={fatigueData?.progressionHref || '/hub?panel=points'}
              onClick={() => haptic()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: '38px',
                padding: '0 14px',
                borderRadius: '999px',
                background: '#17402C',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Consulter le suivi complet de charge d’entraînement
            </a>
          </section>
        ) : null}
      </div>
    </OverlaySheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SOUS-DRAWER 4 (NIVEAU 1) : DONNÉES, CONFIANCE & VIE PRIVÉE (`effort-privacy`)
// ─────────────────────────────────────────────────────────────────────────────

export interface EffortPrivacyDrawerProps extends EffortSharedStateProps {
  privacyData?: EffortPrivacyDrawerData | null;
  onConsentChange?: (purpose: ConsentPurposeKey, granted: boolean) => void;
  onExportJson?: () => void;
  onDeleteEffortData?: () => void;
  onClose: () => void;
}

export function EffortPrivacyDrawer({
  privacyData,
  state = 'ready',
  diagnosticId,
  errorMessage,
  cachedAt,
  onRetry,
  onConsentChange,
  onExportJson,
  onDeleteEffortData,
  onClose,
}: EffortPrivacyDrawerProps) {
  const initialConsents = useMemo<Record<ConsentPurposeKey, boolean>>(() => {
    const base: Record<ConsentPurposeKey, boolean> = {
      personal_scoring: true,
      wearable_sync: false,
      group_simulation: false,
      anonymized_calibration: false,
    };
    for (const item of privacyData?.consents ?? []) {
      base[item.purpose] = Boolean(item.granted);
    }
    return base;
  }, [privacyData?.consents]);

  const [consentsState, setConsentsState] = useState<Record<ConsentPurposeKey, boolean>>(initialConsents);
  const [pendingRevoke, setPendingRevoke] = useState<ConsentPurposeKey | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [actionStatusMessage, setActionStatusMessage] = useState<string | null>(null);

  const handleToggleRequest = useCallback(
    (purpose: ConsentPurposeKey, nextChecked: boolean) => {
      haptic();
      if (!nextChecked && consentsState[purpose]) {
        // Étape de confirmation explicite obligatoire avant révocation serveur.
        setPendingRevoke(purpose);
        return;
      }
      setPendingRevoke(null);
      setConsentsState((prev) => ({ ...prev, [purpose]: true }));
      onConsentChange?.(purpose, true);
      setActionStatusMessage(`Consentement « ${purpose} » activé.`);
    },
    [consentsState, onConsentChange]
  );

  const confirmRevocation = useCallback(
    (purpose: ConsentPurposeKey) => {
      haptic();
      setConsentsState((prev) => ({ ...prev, [purpose]: false }));
      setPendingRevoke(null);
      onConsentChange?.(purpose, false);
      setActionStatusMessage(`Consentement « ${purpose} » révoqué sur le serveur.`);
    },
    [onConsentChange]
  );

  const handleExport = useCallback(() => {
    haptic();
    onExportJson?.();
    setActionStatusMessage('Export JSON de tes données d’effort prêt.');
  }, [onExportJson]);

  const handleConfirmErase = useCallback(() => {
    haptic();
    setConfirmDeleteOpen(false);
    onDeleteEffortData?.();
    setActionStatusMessage('Demande d’effacement des données d’effort enregistrée.');
  }, [onDeleteEffortData]);

  const evidenceList = privacyData?.evidence ?? [];

  return (
    <OverlaySheet
      title="Données, confiance & vie privée"
      subtitle="Niveau de données, provenance Evidence & consentements RGPD"
      onClose={onClose}
      nested
      className="lkdv-effort-subdrawer"
    >
      <div
        tabIndex={0}
        style={{ ...EFFORT_CSS_VARS, display: 'flex', flexDirection: 'column', gap: '12px', color: '#172B24' }}
      >
        <EffortStateFeedback
          state={state}
          diagnosticId={diagnosticId}
          errorMessage={errorMessage}
          cachedAt={cachedAt}
          onRetry={onRetry}
        />

        {actionStatusMessage ? (
          <div
            role="status"
            aria-live="polite"
            data-testid="privacy-action-status"
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              background: '#F2F7EE',
              border: '1px solid var(--good, #3D7A52)',
              fontSize: '12px',
              fontWeight: 600,
              color: '#172B24',
            }}
          >
            {actionStatusMessage}
          </div>
        ) : null}

        {state !== 'loading' && state !== 'error' ? (
          <>
            <section
              aria-labelledby="lkdv-privacy-datalevel-title"
              className="lkdv-overlay-card"
              style={{ padding: '12px', background: '#FFFFFF' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                <h3 id="lkdv-privacy-datalevel-title" style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, color: '#172B24' }}>
                  Richesse des entrées & équité du score
                </h3>
                <span
                  data-testid="privacy-data-level-badge"
                  style={{
                    padding: '3px 9px',
                    borderRadius: '999px',
                    background: '#F2F7EE',
                    border: '1px solid var(--tint, #17402C)',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: '#172B24',
                  }}
                >
                  {formatDataLevelLabel(privacyData?.dataLevel)}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.45, color: '#172B24' }}>
                Le passage de Complet à Cardio ou Socle ne pénalise jamais la valeur centrale du score : seule la largeur de la fourchette d’incertitude [P10–P90] s’adapte à la précision des capteurs disponibles.
              </p>
            </section>

            <section
              aria-labelledby="lkdv-privacy-evidence-title"
              className="lkdv-overlay-card"
              style={{ padding: '12px', background: '#FFFFFF' }}
            >
              <h3 id="lkdv-privacy-evidence-title" style={{ margin: '0 0 8px', fontSize: '13.5px', fontWeight: 700, color: '#172B24' }}>
                Provenance détaillée (Evidence)
              </h3>
              {evidenceList.length === 0 ? (
                <p data-testid="privacy-evidence-empty" style={{ margin: 0, fontSize: '12px', color: '#172B24' }}>
                  Provenance des entrées : non évalué (—).
                </p>
              ) : (
                <ul
                  data-testid="privacy-evidence-list"
                  style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}
                >
                  {evidenceList.map((item, idx) => (
                    <li
                      key={`${item.source}-${item.unit}-${idx}`}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '10px',
                        background: '#F6F9F4',
                        border: '1px solid rgba(23, 43, 36, 0.1)',
                        fontSize: '11.5px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontWeight: 700 }}>
                        <span>Source : {item.source}</span>
                        <span>{EVIDENCE_KIND_LABELS[item.kind] ?? item.kind}</span>
                      </div>
                      <div style={{ marginTop: '3px', color: '#172B24' }}>
                        Valeur : <b>{item.value === null || item.value === undefined ? '—' : String(item.value)}</b> · Unité : <b>{item.unit}</b> · Qualité : <b>{formatEffortValue(Math.round(item.quality * 100), { suffix: '%' })}</b>
                      </div>
                      <div style={{ marginTop: '2px', fontSize: '11px', color: '#172B24' }}>
                        Licence : <b>{item.licenceSnapshot || '—'}</b> · Horodatage : <b>{formatTimestampFr(item.capturedAt)}</b>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              aria-labelledby="lkdv-privacy-consents-title"
              className="lkdv-overlay-card"
              style={{ padding: '12px', background: '#FFFFFF' }}
            >
              <h3 id="lkdv-privacy-consents-title" style={{ margin: '0 0 8px', fontSize: '13.5px', fontWeight: 700, color: '#172B24' }}>
                4 interrupteurs de consentement granulaire
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {DEFAULT_CONSENT_DEFINITIONS.map((def) => {
                  const checked = Boolean(consentsState[def.purpose]);
                  const isConfirmingRevoke = pendingRevoke === def.purpose;
                  return (
                    <div
                      key={def.purpose}
                      data-testid={`consent-row-${def.purpose}`}
                      style={{
                        padding: '10px',
                        borderRadius: '12px',
                        background: '#F6F9F4',
                        border: '1px solid rgba(23, 43, 36, 0.12)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <b style={{ display: 'block', fontSize: '12.5px', color: '#172B24' }}>
                            {def.title}
                          </b>
                          <small style={{ display: 'block', marginTop: '2px', fontSize: '11px', color: '#172B24' }}>
                            {def.description}
                          </small>
                        </div>
                        <DrawerToggle
                          checked={checked}
                          onChange={(next) => handleToggleRequest(def.purpose, next)}
                          label={def.title}
                        />
                      </div>

                      {isConfirmingRevoke ? (
                        <div
                          role="region"
                          aria-label={`Confirmation de révocation pour ${def.title}`}
                          data-testid={`confirm-revoke-${def.purpose}`}
                          style={{
                            marginTop: '10px',
                            padding: '10px',
                            borderRadius: '10px',
                            background: '#FFF8F7',
                            border: '1px solid var(--bad, #A8443A)',
                          }}
                        >
                          <p style={{ margin: '0 0 8px', fontSize: '11.5px', fontWeight: 600, color: '#172B24' }}>
                            Confirmer la révocation serveur de « {def.title} » ? Ce traitement sera immédiatement suspendu.
                          </p>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <DrawerButton
                              tone="danger"
                              onClick={() => confirmRevocation(def.purpose)}
                            >
                              Confirmer la révocation
                            </DrawerButton>
                            <DrawerButton
                              tone="secondary"
                              onClick={() => {
                                haptic();
                                setPendingRevoke(null);
                              }}
                            >
                              Annuler
                            </DrawerButton>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>

            <section
              aria-label="Droits d’exportation et d’effacement RGPD"
              className="lkdv-overlay-card"
              style={{ padding: '12px', background: '#FFFFFF' }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <DrawerButton tone="secondary" onClick={handleExport}>
                  Exporter mes données (JSON)
                </DrawerButton>
                <DrawerButton
                  tone="danger"
                  onClick={() => {
                    haptic();
                    setConfirmDeleteOpen(true);
                  }}
                >
                  Effacer mes données d&apos;effort
                </DrawerButton>
              </div>

              {confirmDeleteOpen ? (
                <div
                  role="region"
                  aria-label="Confirmation d’effacement des données d’effort"
                  data-testid="confirm-erase-effort-data"
                  style={{
                    marginTop: '10px',
                    padding: '10px',
                    borderRadius: '10px',
                    background: '#FFF8F7',
                    border: '1px solid var(--bad, #A8443A)',
                  }}
                >
                  <p style={{ margin: '0 0 8px', fontSize: '11.5px', fontWeight: 600, color: '#172B24' }}>
                    Confirmer l’effacement définitif de tes scores, observations et paramètres d’effort ?
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <DrawerButton tone="danger" onClick={handleConfirmErase}>
                      Confirmer l’effacement définitif
                    </DrawerButton>
                    <DrawerButton
                      tone="secondary"
                      onClick={() => {
                        haptic();
                        setConfirmDeleteOpen(false);
                      }}
                    >
                      Annuler
                    </DrawerButton>
                  </div>
                </div>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </OverlaySheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SOUS-DRAWER 5 (NIVEAU 2) : MODE EXPERT (`effort-expert`)
// ─────────────────────────────────────────────────────────────────────────────

export interface EffortExpertDrawerProps extends EffortSharedStateProps {
  expertData?: EffortExpertDrawerData | null;
  onClose: () => void;
}

export function EffortExpertDrawer({
  expertData,
  state = 'ready',
  diagnosticId,
  errorMessage,
  cachedAt,
  onRetry,
  onClose,
}: EffortExpertDrawerProps) {
  const [hashCopied, setHashCopied] = useState(false);
  const scoreVersion = expertData?.scoreVersion || 'effort-score-v1';
  const snapshotHash = expertData?.snapshotHash || '—';

  const handleCopyHash = useCallback(() => {
    haptic();
    if (expertData?.snapshotHash) {
      try {
        void navigator.clipboard?.writeText?.(expertData.snapshotHash);
      } catch {
        // Ignoré si clipboard non disponible.
      }
      setHashCopied(true);
    }
  }, [expertData?.snapshotHash]);

  return (
    <OverlaySheet
      title="Mode expert"
      subtitle="Équations bioénergétiques, snapshot immuable & ablations"
      onClose={onClose}
      nested
      className="lkdv-effort-subdrawer"
    >
      <div
        tabIndex={0}
        style={{ ...EFFORT_CSS_VARS, display: 'flex', flexDirection: 'column', gap: '12px', color: '#172B24' }}
      >
        <EffortStateFeedback
          state={state}
          diagnosticId={diagnosticId}
          errorMessage={errorMessage}
          cachedAt={cachedAt}
          onRetry={onRetry}
        />

        {state !== 'loading' && state !== 'error' ? (
          <>
            <section
              aria-labelledby="lkdv-expert-meta-title"
              className="lkdv-overlay-card"
              style={{ padding: '12px', background: '#FFFFFF' }}
            >
              <h3 id="lkdv-expert-meta-title" style={{ margin: '0 0 8px', fontSize: '13.5px', fontWeight: 700, color: '#172B24' }}>
                Version du moteur & empreinte d’immutabilité
              </h3>
              <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <dt style={{ fontWeight: 600 }}>score_version</dt>
                  <dd style={{ margin: 0 }}>
                    <code data-testid="expert-score-version">{scoreVersion}</code>
                  </dd>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <dt style={{ fontWeight: 600 }}>snapshot_hash (SHA-256)</dt>
                  <dd style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                    <code
                      data-testid="expert-snapshot-hash"
                      style={{
                        fontSize: '10.5px',
                        wordBreak: 'break-all',
                        padding: '4px 6px',
                        borderRadius: '6px',
                        background: '#F6F9F4',
                      }}
                    >
                      {snapshotHash}
                    </code>
                    {expertData?.snapshotHash ? (
                      <DrawerButton tone="secondary" onClick={handleCopyHash}>
                        {hashCopied ? 'Hash copié' : 'Copier le hash'}
                      </DrawerButton>
                    ) : null}
                  </dd>
                </div>
              </dl>
            </section>

            <section
              aria-labelledby="lkdv-expert-equations-title"
              className="lkdv-overlay-card"
              style={{ padding: '12px', background: '#FFFFFF' }}
            >
              <h3 id="lkdv-expert-equations-title" style={{ margin: '0 0 8px', fontSize: '13.5px', fontWeight: 700, color: '#172B24' }}>
                Équations bioénergétiques de référence
              </h3>
              <ul
                data-testid="expert-reference-equations"
                style={{ margin: 0, paddingLeft: '16px', fontSize: '11.5px', lineHeight: 1.45, display: 'flex', flexDirection: 'column', gap: '6px' }}
              >
                <li>
                  <b>LCDA (Looney et al., 2019, 2022)</b> : coût métabolique marche, pente et facteur charge sac <code>L_Bp = m_sac / m_corps ∈ [0, 0.70]</code>.
                </li>
                <li>
                  <b>Pandolf (1976)</b> : coefficient d’enfoncement neige <code>η = min(5.0, 1.30 + 0.082 × snowSinkCm)</code>.
                </li>
                <li>
                  <b>Péronnet (1991)</b> : réduction hypoxique de la puissance aérobie maximale <code>f_Hyp(z)</code> via la pression barométrique <code>P_B(Torr)</code>.
                </li>
                <li>
                  <b>Hill</b> : normalisation sigmoïde 0–100 % de la dose interne <code>D_eff</code> (<code>score = 100 × D_eff^1.35 / (180^1.35 + D_eff^1.35)</code>).
                </li>
              </ul>
            </section>

            <section
              aria-labelledby="lkdv-expert-ablations-title"
              className="lkdv-overlay-card"
              style={{ padding: '12px', background: '#FFFFFF' }}
            >
              <h3 id="lkdv-expert-ablations-title" style={{ margin: '0 0 8px', fontSize: '13.5px', fontWeight: 700, color: '#172B24' }}>
                Multiplicateurs & ablations contrefactuelles
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px', marginBottom: '10px', fontSize: '11px' }}>
                <div style={{ padding: '6px 8px', borderRadius: '8px', background: '#F6F9F4' }}>
                  <span>Charge sac</span>
                  <b style={{ display: 'block' }}>{formatEffortValue(expertData?.multipliers?.load, { decimals: 2, suffix: '×' })}</b>
                </div>
                <div style={{ padding: '6px 8px', borderRadius: '8px', background: '#F6F9F4' }}>
                  <span>Terrain η</span>
                  <b style={{ display: 'block' }}>{formatEffortValue(expertData?.multipliers?.terrainEta, { decimals: 2, suffix: '×' })}</b>
                </div>
                <div style={{ padding: '6px 8px', borderRadius: '8px', background: '#F6F9F4' }}>
                  <span>Thermique</span>
                  <b style={{ display: 'block' }}>{formatEffortValue(expertData?.multipliers?.thermal, { decimals: 2, suffix: '×' })}</b>
                </div>
                <div style={{ padding: '6px 8px', borderRadius: '8px', background: '#F6F9F4' }}>
                  <span>Altitude</span>
                  <b style={{ display: 'block' }}>{formatEffortValue(expertData?.multipliers?.altitude, { decimals: 2, suffix: '×' })}</b>
                </div>
                <div style={{ padding: '6px 8px', borderRadius: '8px', background: '#F6F9F4' }}>
                  <span>Fatigue</span>
                  <b style={{ display: 'block' }}>{formatEffortValue(expertData?.multipliers?.fatigue, { decimals: 2, suffix: '×' })}</b>
                </div>
                <div style={{ padding: '6px 8px', borderRadius: '8px', background: '#F6F9F4' }}>
                  <span>Excentrique D-</span>
                  <b style={{ display: 'block' }}>{formatEffortValue(expertData?.multipliers?.descentEccentric, { decimals: 2, suffix: '×' })}</b>
                </div>
              </div>

              {expertData?.ablations && expertData.ablations.length > 0 ? (
                <ul data-testid="expert-ablations-list" style={{ margin: 0, paddingLeft: '16px', fontSize: '11.5px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {expertData.ablations.map((ab) => (
                    <li key={ab.id}>
                      <b>{ab.label}</b> : IEA {formatEffortValue(ab.iea, { decimals: 1, suffix: '%' })} ({formatEffortValue(ab.deltaPts, { decimals: 1, signed: true, suffix: 'pts' })})
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0, fontSize: '11.5px' }}>Ablations contrefactuelles : non évalué (—).</p>
              )}
            </section>

            <section className="lkdv-overlay-card" style={{ padding: '12px', background: '#FFFFFF' }}>
              <figure
                role="group"
                aria-labelledby="lkdv-expert-raw-figcaption"
                data-testid="expert-raw-figure"
                style={{ margin: 0 }}
              >
                <figcaption
                  id="lkdv-expert-raw-figcaption"
                  style={{ marginBottom: '8px', fontSize: '13px', fontWeight: 700, color: '#172B24' }}
                >
                  Tableau brut des paramètres bioénergétiques par tronçon ({scoreVersion})
                </figcaption>
                <div tabIndex={0} style={{ overflowX: 'auto' }}>
                  <table
                    data-testid="expert-raw-table"
                    style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', color: '#172B24' }}
                  >
                    <thead>
                      <tr>
                        <th scope="col" style={{ textAlign: 'left', padding: '5px 6px', borderBottom: '1px solid rgba(23, 43, 36, 0.2)' }}>Tronçon</th>
                        <th scope="col" style={{ textAlign: 'left', padding: '5px 6px', borderBottom: '1px solid rgba(23, 43, 36, 0.2)' }}>Dist. (m)</th>
                        <th scope="col" style={{ textAlign: 'left', padding: '5px 6px', borderBottom: '1px solid rgba(23, 43, 36, 0.2)' }}>Alt. (m)</th>
                        <th scope="col" style={{ textAlign: 'left', padding: '5px 6px', borderBottom: '1px solid rgba(23, 43, 36, 0.2)' }}>Pente (%)</th>
                        <th scope="col" style={{ textAlign: 'left', padding: '5px 6px', borderBottom: '1px solid rgba(23, 43, 36, 0.2)' }}>η</th>
                        <th scope="col" style={{ textAlign: 'left', padding: '5px 6px', borderBottom: '1px solid rgba(23, 43, 36, 0.2)' }}>Puissance (W)</th>
                        <th scope="col" style={{ textAlign: 'left', padding: '5px 6px', borderBottom: '1px solid rgba(23, 43, 36, 0.2)' }}>Dose D_eff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expertData?.rawSegments && expertData.rawSegments.length > 0 ? (
                        expertData.rawSegments.map((seg) => (
                          <tr key={seg.segmentId}>
                            <th scope="row" style={{ textAlign: 'left', padding: '5px 6px', borderBottom: '1px solid rgba(23, 43, 36, 0.1)' }}>
                              #{seg.segmentId} ({seg.surface})
                            </th>
                            <td style={{ padding: '5px 6px', borderBottom: '1px solid rgba(23, 43, 36, 0.1)' }}>{formatEffortValue(seg.distanceM)}</td>
                            <td style={{ padding: '5px 6px', borderBottom: '1px solid rgba(23, 43, 36, 0.1)' }}>{formatEffortValue(seg.altitudeM)}</td>
                            <td style={{ padding: '5px 6px', borderBottom: '1px solid rgba(23, 43, 36, 0.1)' }}>{formatEffortValue(seg.slopePct, { decimals: 1, signed: true })}</td>
                            <td style={{ padding: '5px 6px', borderBottom: '1px solid rgba(23, 43, 36, 0.1)' }}>{formatEffortValue(seg.eta, { decimals: 2 })}</td>
                            <td style={{ padding: '5px 6px', borderBottom: '1px solid rgba(23, 43, 36, 0.1)' }}>{formatEffortValue(seg.powerW)}</td>
                            <td style={{ padding: '5px 6px', borderBottom: '1px solid rgba(23, 43, 36, 0.1)' }}>{formatEffortValue(seg.doseDeff, { decimals: 2 })}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <th scope="row" style={{ textAlign: 'left', padding: '5px 6px' }}>—</th>
                          <td style={{ padding: '5px 6px' }}>—</td>
                          <td style={{ padding: '5px 6px' }}>—</td>
                          <td style={{ padding: '5px 6px' }}>—</td>
                          <td style={{ padding: '5px 6px' }}>—</td>
                          <td style={{ padding: '5px 6px' }}>—</td>
                          <td style={{ padding: '5px 6px' }}>—</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </figure>
            </section>
          </>
        ) : null}
      </div>
    </OverlaySheet>
  );
}
