'use client';

import React, { useState } from 'react';
import {
  CloudSun,
  Download,
  Droplets,
  FileJson,
  Flame,
  HeartPulse,
  Leaf,
  Sun,
  Wind,
  Wrench,
} from 'lucide-react';
import type { SummaryExpertAnalysisResult } from '../summaryAnalysisEngine';
import { formatClockLocal, HonestyBadge } from './panelFormatters';

export interface EnvironmentRecoveryPanelProps {
  readonly analysis: SummaryExpertAnalysisResult;
  readonly onExportEnhancedGpx: () => void;
  readonly onExportFitManifest: () => void;
}

const THERMAL_LABELS: Record<string, string> = {
  cold_extreme: 'Froid extrême',
  cold: 'Froid',
  comfortable: 'Confortable',
  warm: 'Chaud',
  heat_extreme: 'Chaleur extrême',
  unknown: 'Non mesurée',
};

export function EnvironmentRecoveryPanel({
  analysis,
  onExportEnhancedGpx,
  onExportFitManifest,
}: EnvironmentRecoveryPanelProps) {
  const {
    telemetry,
    lcda,
    daylight,
    daylightMarginMin,
    ridgeWind,
    thermalStress,
    hydrationLiters,
    recoveryProgram,
    recoveryTimeline,
    equipmentEco,
  } = analysis;

  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  const handleGpxClick = () => {
    onExportEnhancedGpx();
    setExportFeedback('GPX 1.1 enrichi téléchargé');
    window.setTimeout(() => setExportFeedback(null), 2400);
  };

  const handleFitClick = () => {
    onExportFitManifest();
    setExportFeedback('Manifeste FIT JSON téléchargé');
    window.setTimeout(() => setExportFeedback(null), 2400);
  };

  const energy = telemetry.energyAndSteps;

  return (
    <div className="xp20-exp-stack" data-testid="xp20-exp-panel-env">
      {/* 1. Energy, Hydration, Sweat Rate, MAWD, Steps */}
      <section className="xp20-exp-card">
        <div className="xp20-exp-card-head">
          <div className="xp20-exp-card-title">
            <Flame size={14} aria-hidden="true" />
            <span>Bilan énergétique &amp; hydratation</span>
          </div>
          <HonestyBadge quality={energy.caloriesQuality} />
        </div>

        <div className="xp20-exp-kpi-grid-3">
          <div className="xp20-exp-kpi-box">
            <span>Calories</span>
            <strong>{energy.caloriesKcal !== null ? `${energy.caloriesKcal} kcal` : '—'}</strong>
          </div>
          <div className="xp20-exp-kpi-box">
            <span>Énergie métab.</span>
            <strong>
              {lcda.output
                ? `${Math.round(lcda.output.metabolicEnergyKj)} kJ`
                : energy.caloriesKcal !== null
                  ? `${Math.round(energy.caloriesKcal * 4.184)} kJ`
                  : '—'}
            </strong>
          </div>
          <div className="xp20-exp-kpi-box">
            <span>
              <Droplets size={10} className="inline mr-0.5" />
              Hydratation
            </span>
            <strong>{hydrationLiters.toFixed(1)} L</strong>
          </div>
          <div className="xp20-exp-kpi-box">
            <span>Sudation est.</span>
            <strong>
              {lcda.output ? `${lcda.output.sweatRateLh.toFixed(2)} L/h` : '—'}
            </strong>
          </div>
          <div className="xp20-exp-kpi-box">
            <span>MAWD max</span>
            <strong>
              {lcda.output ? `${lcda.output.mawdHours.toFixed(1)} h` : '—'}
            </strong>
          </div>
          <div className="xp20-exp-kpi-box">
            <span>Pas</span>
            <strong>{energy.steps !== null ? energy.steps.toLocaleString('fr-FR') : 'Non capté'}</strong>
          </div>
        </div>
        <p className="xp20-exp-note">{energy.caloriesNote}</p>
      </section>

      {/* 2. Offline NOAA Daylight & Weather / Thermal Stress */}
      <section className="xp20-exp-card">
        <div className="xp20-exp-card-head">
          <div className="xp20-exp-card-title">
            <Sun size={14} aria-hidden="true" />
            <span>Soleil NOAA (100 % offline) &amp; Météo</span>
          </div>
          <HonestyBadge quality="measured" label="NOAA offline" />
        </div>

        {daylight ? (
          <div className="xp20-exp-kpi-grid-3">
            <div className="xp20-exp-kpi-box">
              <span>Lever / Coucher</span>
              <strong>
                {formatClockLocal(daylight.sunriseMs)} · {formatClockLocal(daylight.sunsetMs)}
              </strong>
            </div>
            <div className="xp20-exp-kpi-box">
              <span>Crépuscule civil</span>
              <strong>{formatClockLocal(daylight.civilDuskMs)}</strong>
            </div>
            <div className="xp20-exp-kpi-box">
              <span>Marge jour / nuit</span>
              <strong>
                {daylightMarginMin !== null
                  ? daylightMarginMin >= 0
                    ? `+${daylightMarginMin} min`
                    : `${daylightMarginMin} min (nuit)`
                  : `${daylight.daylightHours} h jour`}
              </strong>
            </div>
          </div>
        ) : (
          <p className="xp20-exp-note">
            Coordonnées absentes : calcul astronomique NOAA indisponible.
          </p>
        )}

        <div className="xp20-exp-bench-grid mt-2">
          <div className="xp20-exp-kpi-box">
            <span>
              <CloudSun size={10} className="inline mr-0.5" />
              Stress thermique
            </span>
            <strong>{THERMAL_LABELS[thermalStress.level] ?? '—'}</strong>
            <small>
              {thermalStress.apparentTempC !== null ? `Ressenti ${thermalStress.apparentTempC} °C` : 'Sans météo'}
            </small>
          </div>
          <div className="xp20-exp-kpi-box">
            <span>
              <Wind size={10} className="inline mr-0.5" />
              Vent crête eff.
            </span>
            <strong>{ridgeWind ? `${ridgeWind.effectiveWindKmh} km/h` : '—'}</strong>
            <small>{ridgeWind ? `Rafales ${ridgeWind.effectiveGustKmh} km/h` : 'Non mesuré'}</small>
          </div>
          <div className="xp20-exp-kpi-box">
            <span>Facteur eau</span>
            <strong>×{thermalStress.hydrationMultiplier.toFixed(2)}</strong>
          </div>
        </div>
        {thermalStress.advisoryFr ? (
          <p className="xp20-exp-note">{thermalStress.advisoryFr}</p>
        ) : null}
      </section>

      {/* 3. Recovery Protocol 0-6h / 24h / 48h */}
      <section className="xp20-exp-card">
        <div className="xp20-exp-card-head">
          <div className="xp20-exp-card-title">
            <HeartPulse size={14} aria-hidden="true" />
            <span>Protocole récupération 0–48 h</span>
          </div>
          <span className="xp20-exp-micro-muted">{recoveryProgram.title}</span>
        </div>

        <div className="xp20-exp-timeline">
          {recoveryTimeline.map((step) => (
            <div key={step.windowLabel} className="xp20-exp-timeline-item">
              <div className="xp20-exp-timeline-head">
                <span className="xp20-exp-pill-strong">{step.windowLabel}</span>
                <strong>{step.focus}</strong>
              </div>
              <ul className="xp20-exp-timeline-list">
                {step.actions.map((act) => (
                  <li key={act}>{act}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="xp20-exp-disclaimer">{recoveryProgram.disclaimer}</p>
      </section>

      {/* 4. Equipment Wear & CO2 */}
      <section className="xp20-exp-card">
        <div className="xp20-exp-card-head">
          <div className="xp20-exp-card-title">
            <Wrench size={14} aria-hidden="true" />
            <span>Usure matériel &amp; Empreinte</span>
          </div>
          {equipmentEco.estimatedGearWearPct !== null ? (
            <span className="xp20-exp-micro-muted">+{equipmentEco.estimatedGearWearPct} % cycle</span>
          ) : null}
        </div>
        <p className="xp20-exp-note">{equipmentEco.wearHintFr}</p>
        {equipmentEco.co2Applicable && equipmentEco.co2SavedKg !== null ? (
          <div className="xp20-exp-eco-inline">
            <Leaf size={13} aria-hidden="true" />
            <span>
              <strong>{equipmentEco.co2SavedKg.toFixed(2)} kg CO₂</strong> évités par rapport à un trajet voiture thermique.
            </span>
          </div>
        ) : null}
      </section>

      {/* 5. Expert Exports (GPX 1.1 Enhanced + FIT Manifest JSON) */}
      <section className="xp20-exp-card">
        <div className="xp20-exp-card-head">
          <div className="xp20-exp-card-title">
            <Download size={14} aria-hidden="true" />
            <span>Exports télémétriques experts</span>
          </div>
          {exportFeedback ? (
            <span className="xp20-exp-tone-pill is-good" data-testid="xp20-exp-export-feedback">
              {exportFeedback}
            </span>
          ) : null}
        </div>
        <div className="xp20-exp-export-row">
          <button
            type="button"
            className="xp20-exp-export-btn"
            data-testid="xp20-exp-export-gpx-btn"
            onClick={handleGpxClick}
          >
            <Download size={14} aria-hidden="true" />
            <span>GPX 1.1 enrichi (FC/Cad/W)</span>
          </button>
          <button
            type="button"
            className="xp20-exp-export-btn is-secondary"
            data-testid="xp20-exp-export-fit-btn"
            onClick={handleFitClick}
          >
            <FileJson size={14} aria-hidden="true" />
            <span>Manifeste FIT JSON</span>
          </button>
        </div>
      </section>
    </div>
  );
}
