'use client';

import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Flame,
  Gauge,
  Mountain,
  Sun,
  Sunrise,
  Sunset,
  Wind,
  Droplets,
  Thermometer,
} from 'lucide-react';
import type { LiveWeatherInfo, TechnicalTerrainStats } from '../routeAnalysis';

export interface ElevationChartSample {
  km?: number;
  distanceKm?: number;
  elevationM: number | null;
}

export function ElevationAreaChart({
  samples,
  minEleM,
  avgEleM,
  maxEleM,
  onHoverRatio,
}: {
  samples: readonly ElevationChartSample[];
  minEleM: number | null;
  avgEleM: number | null;
  maxEleM: number | null;
  onHoverRatio?: (ratio: number | null) => void;
}) {
  const data = useMemo(
    () =>
      samples
        .filter((s): s is ElevationChartSample & { elevationM: number } => typeof s.elevationM === 'number' && Number.isFinite(s.elevationM))
        .map((s, idx) => ({
          km: Number(((s.km ?? s.distanceKm ?? idx * 0.1) as number).toFixed(1)),
          alt: Math.round(s.elevationM),
        })),
    [samples],
  );

  if (data.length < 2) {
    return (
      <div className="rcw-visual-card rcw-visual-card--empty" data-testid="elevation-profile">
        <Mountain size={18} aria-hidden="true" />
        <span>Altitude indisponible sur ce tracé</span>
      </div>
    );
  }

  return (
    <div className="rcw-visual-card" data-testid="elevation-profile">
      <div className="rcw-visual-head">
        <span className="rcw-visual-title">
          <Mountain size={14} aria-hidden="true" />
          Profil altimétrique
        </span>
        <div className="rcw-pill-cluster">
          <span className="rcw-mini-pill">Min {minEleM ?? '—'} m</span>
          <span className="rcw-mini-pill">Moy {avgEleM ?? '—'} m</span>
          <span className="rcw-mini-pill rcw-mini-pill--strong">Max {maxEleM ?? '—'} m</span>
        </div>
      </div>

      <div
        className="rcw-chart-box"
        onMouseLeave={() => onHoverRatio?.(null)}
      >
        {typeof ResizeObserver !== 'undefined' ? (
          <ResponsiveContainer width="100%" height={128}>
            <AreaChart
              data={data}
              margin={{ top: 6, right: 6, left: -24, bottom: 0 }}
              onMouseMove={(state) => {
                const idx = typeof state?.activeTooltipIndex === 'number' ? state.activeTooltipIndex : null;
                if (idx != null && data.length > 1) {
                  onHoverRatio?.(idx / (data.length - 1));
                }
              }}
            >
              <defs>
                <linearGradient id="rcwElevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#17402c" stopOpacity={0.34} />
                  <stop offset="100%" stopColor="#17402c" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="km"
                tick={{ fontSize: 10, fill: '#6c796f' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}k`}
                minTickGap={22}
              />
              <YAxis
                domain={['dataMin - 20', 'dataMax + 20']}
                tick={{ fontSize: 10, fill: '#6c796f' }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                formatter={(value) => [`${value} m`, 'Alt.']}
                labelFormatter={(km) => `${km} km`}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid rgba(16, 40, 26, 0.12)',
                  background: 'rgba(255,255,255,0.95)',
                  fontSize: 12,
                  padding: '4px 9px',
                }}
              />
              <Area
                type="monotone"
                dataKey="alt"
                stroke="#17402c"
                strokeWidth={2}
                fill="url(#rcwElevGrad)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <AreaChart width={320} height={128} data={data} margin={{ top: 6, right: 6, left: -24, bottom: 0 }}>
            <Area type="monotone" dataKey="alt" stroke="#17402c" strokeWidth={2} fill="rgba(23,64,44,0.18)" isAnimationActive={false} />
          </AreaChart>
        )}
      </div>
    </div>
  );
}

export function EffortRadialGauge({ stats }: { stats: TechnicalTerrainStats }) {
  const ibp = stats.ibpEstimate ?? 0;
  const pct = Math.max(0, Math.min(1, ibp / 120));
  const r = 42;
  const halfCirc = Math.PI * r;
  const dashOffset = halfCirc * (1 - pct);
  const toneColor =
    ibp < 25
      ? '#1d7a47'
      : ibp < 50
        ? '#2d8a5e'
        : ibp < 75
          ? '#d97706'
          : '#c2410c';

  return (
    <div className="rcw-visual-card rcw-effort-card">
      <div className="rcw-effort-gauge-wrap">
        <svg viewBox="0 0 110 64" className="rcw-effort-svg" aria-label={`Indice IBP ${ibp}`}>
          <path
            d="M 13 54 A 42 42 0 0 1 97 54"
            fill="none"
            stroke="rgba(16,40,26,0.1)"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <path
            d="M 13 54 A 42 42 0 0 1 97 54"
            fill="none"
            stroke={toneColor}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={halfCirc}
            strokeDashoffset={dashOffset}
          />
          <text x="55" y="42" textAnchor="middle" className="rcw-gauge-value">
            {stats.ibpEstimate ?? '—'}
          </text>
          <text x="55" y="55" textAnchor="middle" className="rcw-gauge-label">
            IBP
          </text>
        </svg>
        <span className="rcw-effort-badge" style={{ color: toneColor }}>
          {stats.effortLevel}
        </span>
      </div>

      <div className="rcw-effort-kpis">
        <div className="rcw-kpi-tile">
          <Gauge size={14} aria-hidden="true" />
          <div>
            <strong>{stats.avgSpeedKmh != null ? `${stats.avgSpeedKmh} km/h` : '—'}</strong>
            <span>Allure moy.</span>
          </div>
        </div>
        <div className="rcw-kpi-tile">
          <Mountain size={14} aria-hidden="true" />
          <div>
            <strong>{stats.maxClimbSlopePct != null ? `${stats.maxClimbSlopePct}%` : '—'}</strong>
            <span>Pente max +</span>
          </div>
        </div>
        <div className="rcw-kpi-tile">
          <Flame size={14} aria-hidden="true" />
          <div>
            <strong>
              {stats.estimatedCaloriesKcal != null ? `${stats.estimatedCaloriesKcal} kcal` : '—'}
            </strong>
            <span>Énergie</span>
          </div>
        </div>
        <div className="rcw-kpi-tile">
          <Mountain size={14} aria-hidden="true" />
          <div>
            <strong>{stats.maxDescentSlopePct != null ? `-${stats.maxDescentSlopePct}%` : '—'}</strong>
            <span>Descente max</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SlopeStackedVisual({ stats }: { stats: TechnicalTerrainStats }) {
  if (!stats.slopeBuckets.hasSlopeData) return null;
  const segments = [
    { key: 'flat', label: '< 5 %', pct: stats.slopeBuckets.flatPct, color: '#228751' },
    { key: 'mod', label: '5–10 %', pct: stats.slopeBuckets.moderatePct, color: '#2c76b3' },
    { key: 'sust', label: '10–15 %', pct: stats.slopeBuckets.sustainedPct, color: '#d97706' },
    { key: 'steep', label: '> 15 %', pct: stats.slopeBuckets.steepPct, color: '#c2410c' },
  ].filter((s) => s.pct > 0);

  return (
    <div className="rcw-visual-card" data-testid="slope-distribution-card">
      <div className="rcw-visual-head">
        <span className="rcw-visual-title">Répartition des pentes</span>
      </div>
      <div className="rcw-stacked-bar" role="img" aria-label="Répartition des pentes">
        {segments.map((s) => (
          <div
            key={s.key}
            className="rcw-stacked-seg"
            style={{ width: `${s.pct}%`, background: s.color }}
            title={`${s.label} : ${s.pct}%`}
          />
        ))}
      </div>
      <div className="rcw-swatch-legend">
        {segments.map((s) => (
          <span key={s.key} className="rcw-swatch-item">
            <i style={{ background: s.color }} />
            <span>{s.label}</span>
            <strong>{s.pct}%</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

const SURFACE_COLORS: Record<string, string> = {
  trail: '#1d7a47',
  unpaved: '#9c6f3e',
  paved: '#5c6b73',
  rock: '#78716c',
  unknown: '#9ca3af',
};

export function SurfaceStackedVisual({
  stats,
  sectionsCount,
  warningsCount,
}: {
  stats: TechnicalTerrainStats;
  sectionsCount: number;
  warningsCount: number;
}) {
  return (
    <div className="rcw-visual-card" data-testid="surface-breakdown-card">
      <div className="rcw-visual-head">
        <span className="rcw-visual-title">Sols & surfaces</span>
        <span className="rcw-sub-note">
          {sectionsCount} tronçon(s) · {warningsCount} alerte(s)
        </span>
      </div>
      <div className="rcw-stacked-bar" role="img" aria-label="Sols et surfaces">
        {stats.surfaces.map((s) => (
          <div
            key={s.key}
            className="rcw-stacked-seg"
            style={{ width: `${s.pct}%`, background: SURFACE_COLORS[s.key] ?? '#9ca3af' }}
            title={`${s.label} : ${s.pct}%`}
          />
        ))}
      </div>
      <div className="rcw-swatch-legend">
        {stats.surfaces.map((s) => (
          <span key={s.key} className="rcw-swatch-item">
            <i style={{ background: SURFACE_COLORS[s.key] ?? '#9ca3af' }} />
            <span>{s.label}</span>
            <strong>{s.pct}%</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

export function SunDaylightArc({ stats }: { stats: TechnicalTerrainStats }) {
  return (
    <div className="rcw-visual-card rcw-sun-card">
      <div className="rcw-visual-head">
        <span className="rcw-visual-title">
          <Sun size={14} aria-hidden="true" />
          {stats.ecologicalZone}
        </span>
      </div>
      <div className="rcw-sun-arc-row">
        <div className="rcw-sun-point">
          <Sunrise size={15} aria-hidden="true" />
          <strong>{stats.sunriseLocal}</strong>
          <span>Lever</span>
        </div>
        <svg viewBox="0 0 120 42" className="rcw-sun-svg" aria-hidden="true">
          <path
            d="M 10 36 A 50 32 0 0 1 110 36"
            fill="none"
            stroke="rgba(217, 119, 6, 0.25)"
            strokeWidth="3"
            strokeDasharray="4 4"
          />
          <path
            d="M 10 36 A 50 32 0 0 1 82 10"
            fill="none"
            stroke="#d97706"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="82" cy="10" r="4.5" fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
        </svg>
        <div className="rcw-sun-point">
          <Sunset size={15} aria-hidden="true" />
          <strong>{stats.sunsetLocal}</strong>
          <span>Coucher</span>
        </div>
      </div>
      <div className="rcw-sun-foot">{stats.daylightLabel}</div>
    </div>
  );
}

export function WeatherForecastChart({
  weather,
  loading,
}: {
  weather: LiveWeatherInfo | null;
  loading: boolean;
}) {
  if (!weather) {
    return (
      <div className="rcw-visual-card rcw-visual-card--empty">
        <Thermometer size={18} aria-hidden="true" />
        <span>{loading ? 'Chargement météo en cours…' : 'Météo indisponible hors ligne'}</span>
      </div>
    );
  }

  const chartData = weather.hourlyPreview.map((h) => ({
    time: h.time,
    temp: h.tempC ?? 0,
    rain: h.rainProbPct ?? 0,
  }));

  return (
    <div className="rcw-visual-card">
      <div className="rcw-weather-hero">
        <div>
          <div className="rcw-weather-temp">
            {weather.temperatureC != null ? `${weather.temperatureC}°` : '—'}
          </div>
          <div className="rcw-weather-cond">{weather.conditionLabel}</div>
        </div>
        <div className="rcw-weather-pills">
          <span className="rcw-mini-pill">
            <Thermometer size={12} /> Ressenti {weather.windChillC ?? '—'}°
          </span>
          <span className="rcw-mini-pill">
            <Wind size={12} /> {weather.windKph ?? '—'} km/h
          </span>
          <span className="rcw-mini-pill">
            <Droplets size={12} /> {weather.humidityPct ?? '—'}%
          </span>
        </div>
      </div>

      {chartData.length >= 2 && typeof ResizeObserver !== 'undefined' ? (
        <div className="rcw-chart-box rcw-chart-box--sm">
          <ResponsiveContainer width="100%" height={92}>
            <AreaChart data={chartData} margin={{ top: 6, right: 6, left: -26, bottom: 0 }}>
              <defs>
                <linearGradient id="rcwTempGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2c76b3" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="#2c76b3" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#6c796f' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#6c796f' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                formatter={(v, name) => [name === 'temp' ? `${v}°C` : `${v}%`, name === 'temp' ? 'Temp.' : 'Pluie']}
                contentStyle={{ borderRadius: 10, fontSize: 11, padding: '3px 8px' }}
              />
              <Area
                type="monotone"
                dataKey="temp"
                stroke="#2c76b3"
                strokeWidth={2}
                fill="url(#rcwTempGrad)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  );
}

export function ReadinessRadialRing({
  scorePct,
  label,
  sublabel,
}: {
  scorePct: number;
  label: string;
  sublabel: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(scorePct)));
  const r = 34;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - clamped / 100);
  const stroke = clamped >= 80 ? '#1d7a47' : clamped >= 50 ? '#d97706' : '#6c796f';

  return (
    <div className="rcw-readiness-card">
      <svg viewBox="0 0 88 88" className="rcw-readiness-svg" aria-label={`Préparation ${clamped}%`}>
        <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(16,40,26,0.09)" strokeWidth="7" />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 44 44)"
        />
        <text x="44" y="48" textAnchor="middle" className="rcw-ring-pct">
          {clamped}%
        </text>
      </svg>
      <div className="rcw-readiness-text">
        <strong>{label}</strong>
        <span>{sublabel}</span>
      </div>
    </div>
  );
}
