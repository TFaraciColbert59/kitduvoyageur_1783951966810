'use client';

import React, { useEffect, useState } from 'react';
import {
  Area,
  ComposedChart,
  Line,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Flame,
  Heart,
  Mountain,
  Sliders,
  Zap,
} from 'lucide-react';
import type { ZoneTimeResult } from '../../../metrics/activityMetrics';
import type {
  SummaryExpertAnalysisResult,
  SummaryZoneThresholds,
} from '../summaryAnalysisEngine';
import { formatDurationShort, HonestyBadge } from './panelFormatters';

export interface PhysioLoadPanelProps {
  readonly analysis: SummaryExpertAnalysisResult;
  readonly thresholds: SummaryZoneThresholds;
  readonly onUpdateThresholds: (next: Partial<SummaryZoneThresholds>) => void;
}

const ZONE_COLORS = ['#64748b', '#0e8f5b', '#d97706', '#ea580c', '#dc2626'];

function ZoneStackedCard({
  title,
  result,
  quality,
}: {
  readonly title: string;
  readonly result: ZoneTimeResult | null;
  readonly quality: 'measured' | 'estimated' | 'unavailable';
}) {
  if (!result || result.status === 'unavailable' || !result.zones || result.zones.length === 0) {
    return (
      <div className="xp20-exp-subbox">
        <div className="xp20-exp-card-head">
          <span className="xp20-exp-subbox-title">{title}</span>
          <HonestyBadge quality="unavailable" />
        </div>
        <p className="xp20-exp-note">Signal insuffisant pour distribuer le temps par zone.</p>
      </div>
    );
  }

  const coveragePct =
    result.window.durationS > 0
      ? Math.min(100, Math.round((result.window.sampledS / result.window.durationS) * 100))
      : 0;
  const totalInZoneS = result.zones.reduce((acc, z) => acc + z.seconds, 0);

  return (
    <div className="xp20-exp-subbox">
      <div className="xp20-exp-card-head">
        <span className="xp20-exp-subbox-title">{title}</span>
        <div className="flex items-center gap-1.5">
          <span className="xp20-exp-micro-muted">Couv. {coveragePct} %</span>
          <HonestyBadge quality={quality} />
        </div>
      </div>

      {/* Stacked horizontal bar */}
      <div className="xp20-exp-stacked-bar" aria-label={`Répartition ${title}`}>
        {result.zones.map((zone, idx) => {
          const pct = totalInZoneS > 0 ? (zone.seconds / totalInZoneS) * 100 : 0;
          if (pct <= 0.5) return null;
          return (
            <span
              key={zone.zoneId}
              style={{
                width: `${pct}%`,
                background: ZONE_COLORS[idx % ZONE_COLORS.length],
              }}
              title={`${zone.label}: ${Math.round(pct)} %`}
            />
          );
        })}
      </div>

      <div className="xp20-exp-zone-legend">
        {result.zones.map((zone, idx) => {
          const sec = Math.round(zone.seconds);
          const pct = Math.round(zone.shareOfInZone * 100);
          return (
            <div key={zone.zoneId} className="xp20-exp-zone-row">
              <span className="xp20-exp-zone-name">
                <i style={{ background: ZONE_COLORS[idx % ZONE_COLORS.length] }} />
                {zone.label}
              </span>
              <strong>
                {formatDurationShort(sec)} <small>({pct} %)</small>
              </strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PhysioLoadPanel({
  analysis,
  thresholds,
  onUpdateThresholds,
}: PhysioLoadPanelProps) {
  const { telemetry, cycling, loadProjection, lcda } = analysis;
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftFcMax, setDraftFcMax] = useState(String(thresholds.fcMax));
  const [draftFcRest, setDraftFcRest] = useState(String(thresholds.fcRest));
  const [draftFtp, setDraftFtp] = useState(String(thresholds.ftpW));
  const [draftVma, setDraftVma] = useState(String(thresholds.vmaKmh));
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (!editorOpen) {
      setDraftFcMax(String(thresholds.fcMax));
      setDraftFcRest(String(thresholds.fcRest));
      setDraftFtp(String(thresholds.ftpW));
      setDraftVma(String(thresholds.vmaKmh));
    }
  }, [editorOpen, thresholds]);

  const handleSaveThresholds = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateThresholds({
      fcMax: Number(draftFcMax) || thresholds.fcMax,
      fcRest: Number(draftFcRest) || thresholds.fcRest,
      ftpW: Number(draftFtp) || thresholds.ftpW,
      vmaKmh: Number(draftVma) || thresholds.vmaKmh,
    });
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2000);
  };

  const mmpChartData = telemetry.powerAnalysis.curve.points.map((p) => ({
    label: p.label,
    watts: p.watts,
  }));

  const radarData = cycling.powerSkills.skills.map((s) => ({
    axis: s.label,
    score: s.score ?? 0,
  }));

  const tlBefore = loadProjection.trainingLoadBefore;
  const tlAfter = loadProjection.trainingLoadAfter;
  const rdAfter = loadProjection.readinessAfter;
  const tlSeries = tlAfter.series.slice(-56).map((pt) => ({
    day: pt.dateKey.slice(5),
    ctl: pt.fitnessCtl,
    atl: pt.fatigueAtl,
    tsb: pt.formTsb,
  }));

  return (
    <div className="xp20-exp-stack" data-testid="xp20-exp-panel-physio">
      {/* 1. Inline Collapsible Zone Thresholds Editor (Option 1 approved) */}
      <section className="xp20-exp-card">
        <button
          type="button"
          className="xp20-exp-collapse-trigger"
          data-testid="xp20-exp-thresholds-toggle"
          aria-expanded={editorOpen}
          onClick={() => setEditorOpen((v) => !v)}
        >
          <div className="xp20-exp-card-title">
            <Sliders size={14} aria-hidden="true" />
            <span>
              Seuils physio · FC {thresholds.fcRest}–{thresholds.fcMax} · FTP {thresholds.ftpW} W ·
              VMA {thresholds.vmaKmh} km/h
            </span>
          </div>
          {editorOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {editorOpen ? (
          <form
            className="xp20-exp-thresholds-form"
            data-testid="xp20-exp-thresholds-form"
            onSubmit={handleSaveThresholds}
          >
            <div className="xp20-exp-thresholds-grid">
              <label className="xp20-exp-input-group">
                <span>FC max (bpm)</span>
                <input
                  type="number"
                  min={120}
                  max={230}
                  value={draftFcMax}
                  onChange={(e) => setDraftFcMax(e.target.value)}
                />
              </label>
              <label className="xp20-exp-input-group">
                <span>FC repos (bpm)</span>
                <input
                  type="number"
                  min={30}
                  max={110}
                  value={draftFcRest}
                  onChange={(e) => setDraftFcRest(e.target.value)}
                />
              </label>
              <label className="xp20-exp-input-group">
                <span>FTP (W)</span>
                <input
                  type="number"
                  min={60}
                  max={600}
                  value={draftFtp}
                  onChange={(e) => setDraftFtp(e.target.value)}
                />
              </label>
              <label className="xp20-exp-input-group">
                <span>VMA (km/h)</span>
                <input
                  type="number"
                  step="0.5"
                  min={6}
                  max={26}
                  value={draftVma}
                  onChange={(e) => setDraftVma(e.target.value)}
                />
              </label>
            </div>
            <button
              type="submit"
              className="xp20-exp-save-thresholds-btn"
              data-testid="xp20-exp-thresholds-save"
            >
              {savedNotice ? 'Seuils enregistrés · Zones recalculées' : 'Recalculer et enregistrer les seuils'}
            </button>
          </form>
        ) : null}
      </section>

      {/* 2. Stacked Zones (FC / Allure / Puissance) */}
      <section className="xp20-exp-card">
        <div className="xp20-exp-card-head">
          <div className="xp20-exp-card-title">
            <Heart size={14} aria-hidden="true" />
            <span>Distribution des zones d’intensité</span>
          </div>
        </div>
        <div className="xp20-exp-stack-tight">
          <ZoneStackedCard
            title="Zones Fréquence Cardiaque"
            result={telemetry.hrZones}
            quality={telemetry.hrZones ? 'measured' : 'unavailable'}
          />
          <ZoneStackedCard
            title="Zones Allure / Vitesse"
            result={telemetry.paceZones}
            quality={telemetry.paceZones ? 'measured' : 'unavailable'}
          />
          {telemetry.powerZones ? (
            <ZoneStackedCard
              title="Zones Puissance"
              result={telemetry.powerZones}
              quality={telemetry.powerAnalysis.quality === 'measured' ? 'measured' : 'estimated'}
            />
          ) : null}
        </div>
      </section>

      {/* 3. Cycling Power Block (Moy, Max, NP, IF, VI, MMP Curve, FTP, RadarChart Power Skills) */}
      {telemetry.powerAnalysis.status === 'available' ? (
        <section className="xp20-exp-card" data-testid="xp20-exp-power-card">
          <div className="xp20-exp-card-head">
            <div className="xp20-exp-card-title">
              <Zap size={14} aria-hidden="true" />
              <span>Puissance Vélo &amp; Power Skills</span>
            </div>
            <HonestyBadge
              quality={telemetry.powerAnalysis.quality === 'measured' ? 'measured' : 'estimated'}
              label={
                telemetry.powerAnalysis.quality === 'measured'
                  ? 'Mesurée (capteur)'
                  : 'Estimée (physique)'
              }
            />
          </div>

          <div className="xp20-exp-kpi-grid-3">
            <div className="xp20-exp-kpi-box">
              <span>Moy / Max</span>
              <strong>
                {telemetry.powerAnalysis.averageW ?? '—'} / {telemetry.powerAnalysis.maxW ?? '—'} W
              </strong>
            </div>
            <div className="xp20-exp-kpi-box">
              <span>NP (Normalisée)</span>
              <strong>{telemetry.powerAnalysis.normalizedW ?? '—'} W</strong>
            </div>
            <div className="xp20-exp-kpi-box">
              <span>IF / VI</span>
              <strong>
                {cycling.intensityFactor ?? '—'} / {cycling.variabilityIndex ?? '—'}
              </strong>
            </div>
            <div className="xp20-exp-kpi-box">
              <span>FTP estimée</span>
              <strong>
                {telemetry.powerAnalysis.estimatedFtp.ftpW !== null
                  ? `${telemetry.powerAnalysis.estimatedFtp.ftpW} W`
                  : `${thresholds.ftpW} W (seuil)`}
              </strong>
            </div>
            <div className="xp20-exp-kpi-box">
              <span>TSS puissance</span>
              <strong>{cycling.estimatedTss !== null ? `${cycling.estimatedTss} UA` : '—'}</strong>
            </div>
            <div className="xp20-exp-kpi-box">
              <span>Profil cycliste</span>
              <strong>{cycling.powerSkills.profile ?? 'En cours'}</strong>
            </div>
          </div>

          {mmpChartData.length >= 2 ? (
            <div className="xp20-exp-subbox">
              <span className="xp20-exp-subbox-title">Courbe de puissance record (MMP 5 s → 1 h)</span>
              <div className="xp20-exp-chart-box">
                <ResponsiveContainer width="100%" height={150}>
                  <ComposedChart data={mmpChartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} unit=" W" />
                    <Tooltip formatter={(v) => [`${String(v ?? 0)} W`, 'MMP']} />
                    <Area
                      type="monotone"
                      dataKey="watts"
                      stroke="#7c3aed"
                      fill="#7c3aed"
                      fillOpacity={0.18}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}

          {cycling.powerSkills.status === 'available' ? (
            <div className="xp20-exp-subbox">
              <span className="xp20-exp-subbox-title">Radar 4 axes Power Skills</span>
              <div className="xp20-exp-chart-box">
                <ResponsiveContainer width="100%" height={180}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="var(--xp-hud-border, rgba(23,64,44,0.18))" />
                    <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11 }} />
                    <Radar
                      dataKey="score"
                      stroke="#7c3aed"
                      fill="#7c3aed"
                      fillOpacity={0.28}
                      isAnimationActive={false}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <p className="xp20-exp-note">{cycling.powerSkills.summary}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* 4. Charge & Form Projection Before -> After (CTL/ATL/TSB + ACWR + DOMS + Acclimatization) */}
      <section className="xp20-exp-card">
        <div className="xp20-exp-card-head">
          <div className="xp20-exp-card-title">
            <Flame size={14} aria-hidden="true" />
            <span>Charge &amp; Forme (Avant → Après la sortie)</span>
          </div>
          <span className="xp20-exp-pill-strong">{tlAfter.formLabel}</span>
        </div>

        <div className="xp20-exp-bench-grid">
          <div className="xp20-exp-kpi-box">
            <span>Fitness CTL (42 j)</span>
            <strong>
              {tlBefore.fitnessCtl ?? 0} → {tlAfter.fitnessCtl ?? 0}
            </strong>
            <small>
              {loadProjection.deltaCtl !== null
                ? `${loadProjection.deltaCtl >= 0 ? '+' : ''}${loadProjection.deltaCtl}`
                : '—'}
            </small>
          </div>
          <div className="xp20-exp-kpi-box">
            <span>Fatigue ATL (7 j)</span>
            <strong>
              {tlBefore.fatigueAtl ?? 0} → {tlAfter.fatigueAtl ?? 0}
            </strong>
            <small>
              {loadProjection.deltaAtl !== null
                ? `${loadProjection.deltaAtl >= 0 ? '+' : ''}${loadProjection.deltaAtl}`
                : '—'}
            </small>
          </div>
          <div className="xp20-exp-kpi-box">
            <span>Forme TSB</span>
            <strong>
              {loadProjection.projectedTsbBefore ?? tlBefore.formTsb ?? 0} →{' '}
              {loadProjection.projectedTsbAfter ?? tlAfter.formTsb ?? 0}
            </strong>
            <small>
              {loadProjection.deltaTsb !== null
                ? `${loadProjection.deltaTsb >= 0 ? '+' : ''}${loadProjection.deltaTsb}`
                : '—'}
            </small>
          </div>
        </div>

        {tlSeries.length >= 2 ? (
          <div className="xp20-exp-chart-box">
            <ResponsiveContainer width="100%" height={164}>
              <ComposedChart data={tlSeries} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fontSize: 9.5 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="tsb"
                  name="Forme (TSB)"
                  stroke="#0e8f5b"
                  fill="#0e8f5b"
                  fillOpacity={0.14}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="ctl"
                  name="Fitness (CTL)"
                  stroke="#0284c7"
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="atl"
                  name="Fatigue (ATL)"
                  stroke="#dc2626"
                  dot={false}
                  strokeWidth={1.8}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : null}

        {/* Readiness, ACWR, 96h Debt, DOMS, Altitude Acclimatization, IEC */}
        <div className="xp20-exp-kpi-grid-3 mt-2">
          <div className="xp20-exp-kpi-box">
            <span>EWMA ACWR</span>
            <strong>
              {rdAfter.acwr.dampedRatio !== null ? rdAfter.acwr.dampedRatio.toFixed(2) : '—'}
            </strong>
            <small>{rdAfter.acwr.zone}</small>
          </div>
          <div className="xp20-exp-kpi-box">
            <span>Dette métab. 96 h</span>
            <strong>{rdAfter.recoveryDebt96h} / 100</strong>
          </div>
          <div className="xp20-exp-kpi-box">
            <span>Pic DOMS (18–48 h)</span>
            <strong>{rdAfter.eccentricDomsScore} / 100</strong>
          </div>
          <div className="xp20-exp-kpi-box">
            <span>
              <Mountain size={10} className="inline mr-0.5" />
              Acclim. 21 j
            </span>
            <strong>{rdAfter.altitudeAcclimatization.ceilingM} m</strong>
          </div>
          <div className="xp20-exp-kpi-box">
            <span>Efficacité card. IEC</span>
            <strong>
              {lcda.output?.iec !== null && lcda.output?.iec !== undefined
                ? lcda.output.iec.toFixed(2)
                : '—'}
            </strong>
          </div>
          <div className="xp20-exp-kpi-box">
            <span>Disponibilité</span>
            <strong>{rdAfter.score !== null ? `${rdAfter.score}/100` : 'Démarrage'}</strong>
          </div>
        </div>
        <p className="xp20-exp-note">{rdAfter.summaryFr}</p>
      </section>

      {/* 5. Explicit Load Scales Transparency Table */}
      <section className="xp20-exp-card">
        <div className="xp20-exp-card-head">
          <div className="xp20-exp-card-title">
            <Activity size={14} aria-hidden="true" />
            <span>Échelles de charge (transparence des modèles)</span>
          </div>
        </div>
        <div className="xp20-exp-sensor-list">
          <div className="xp20-exp-sensor-row">
            <div>
              <strong>Charge canonique LKDV</strong>
              <span>Niveau utilisé : {loadProjection.canonicalTierLabelFr}</span>
            </div>
            <span className="xp20-exp-pill-strong">
              {Math.round(loadProjection.canonicalLoad.loadUnits)} UA
            </span>
          </div>
          <div className="xp20-exp-sensor-row">
            <div>
              <strong>Foster sRPE (minutes × RPE {analysis.rpe})</strong>
              <span>Charge subjective brute</span>
            </div>
            <strong>{loadProjection.fosterAu} AU</strong>
          </div>
          <div className="xp20-exp-sensor-row">
            <div>
              <strong>
                {loadProjection.physiologyXp.formula === 'trimp_banister'
                  ? 'Banister TRIMP (FC)'
                  : 'Modèle physiologique (sRPE)'}
              </strong>
              <span>+{loadProjection.physiologyXp.xpEarned} XP calculés</span>
            </div>
            <strong>{loadProjection.physiologyXp.trainingLoadScore} pts</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
