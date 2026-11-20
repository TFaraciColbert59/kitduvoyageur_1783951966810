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
import { CloudSun, Flag, Moon, Mountain } from 'lucide-react';
import type {
  CarnetDetail,
  CarnetEtapeDay,
  CarnetNightItem,
} from '@/features/carnet/detail/types';
import { elevationProfileGain } from '@/features/carnet/detail/elevationProfile';
import { CarnetAltitude } from './CarnetAltitude';
import { AnimatedNumber } from './CarnetDrawerMotion';
import {
  CarnetHorizontalTimeline,
  type HorizontalTimelineDayGroup,
} from './CarnetHorizontalTimeline';

interface CarnetRouteDrawerBodyProps {
  detail: CarnetDetail;
  lensId: string;
  onSelectEtape: (etape: CarnetEtapeDay) => void;
  onSelectNight: (night: CarnetNightItem) => void;
}

const NIGHT_TYPE_LABELS: Record<CarnetNightItem['type'], string> = {
  refuge: 'Refuge',
  bivouac: 'Bivouac',
  gite: 'Gîte',
  hotel: 'Hôtel',
  camping: 'Camping',
  autre: 'Étape nuit',
};

export function CarnetRouteDrawerBody({
  detail,
  lensId,
  onSelectEtape,
  onSelectNight,
}: CarnetRouteDrawerBodyProps) {
  const elevationData = useMemo(() => {
    const pts = detail.elevationProfile ?? [];
    if (pts.length === 0) return [];
    const step = Math.max(1, Math.floor(pts.length / 48));
    const sampled = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
    return sampled.map((p) => ({
      km: Number(p.distanceKm.toFixed(1)),
      alt: Math.round(p.elevationM),
    }));
  }, [detail.elevationProfile]);

  const elevationStats = useMemo(() => {
    const pts = detail.elevationProfile ?? [];
    if (pts.length < 2) return null;
    let maxAlt = -Infinity;
    for (const p of pts) {
      if (p.elevationM > maxAlt) maxAlt = p.elevationM;
    }
    const gain = elevationProfileGain(pts);
    const totalDist = pts[pts.length - 1]?.distanceKm ?? 0;
    return {
      maxAlt: Number.isFinite(maxAlt) ? Math.round(maxAlt) : null,
      gain: Math.round(gain ?? 0),
      distKm: Number(totalDist.toFixed(1)),
    };
  }, [detail.elevationProfile]);

  if (lensId === 'etapes') {
    if (detail.etapes.length === 0) {
      return (
        <div className="lkdv-carnet-empty-card">
          <Flag size={22} aria-hidden="true" />
          <b>Aucune étape renseignée</b>
          <p>Le roadbook jour par jour apparaîtra ici sur la frise horizontale.</p>
        </div>
      );
    }

    const groups: HorizontalTimelineDayGroup[] = detail.etapes.map((e) => ({
      day: e.dayNumber,
      meta: e.weather ? e.weather.split('·')[0].trim() : undefined,
      events: [
        {
          id: `et-${e.id}`,
          day: e.dayNumber,
          kind: 'perf',
          badge: `Étape J${e.dayNumber}`,
          timeLabel: e.durationText || `J${e.dayNumber}`,
          title: e.from && e.to ? `${e.from} → ${e.to}` : e.label,
          subtitle: [
            e.distanceKm ? `${Number(e.distanceKm).toFixed(1)} km` : null,
            e.elevationM ? `+${Math.round(e.elevationM)} m` : null,
            e.note,
          ]
            .filter(Boolean)
            .join(' · '),
          onClick: () => onSelectEtape(e),
        },
      ],
    }));

    return (
      <CarnetHorizontalTimeline
        groups={groups}
        ariaLabel="Frise horizontale des étapes"
      />
    );
  }

  if (lensId === 'altitude') {
    const canObserveResize = typeof ResizeObserver !== 'undefined';

    if (elevationData.length < 2) {
      return (
        <div className="lkdv-carnet-empty-card">
          <Mountain size={22} aria-hidden="true" />
          <b>Profil altimétrique indisponible</b>
          <p>Ajoutez une trace GPX pour afficher la courbe de dénivelé.</p>
        </div>
      );
    }

    const totalPts = elevationData.length;
    const lowCount = elevationData.filter((p) => p.alt < 1500).length;
    const midCount = elevationData.filter((p) => p.alt >= 1500 && p.alt < 2200).length;
    const highCount = elevationData.filter((p) => p.alt >= 2200).length;
    const bands = [
      { label: '< 1 500 m', pct: Math.round((lowCount / totalPts) * 100), color: '#52b788' },
      { label: '1 500 – 2 200 m', pct: Math.round((midCount / totalPts) * 100), color: '#2d6a4f' },
      { label: '> 2 200 m', pct: Math.round((highCount / totalPts) * 100), color: '#1b4332' },
    ];

    return (
      <div className="lkdv-carnet-drawer-pane">
        {elevationStats ? (
          <div className="lkdv-carnet-kpi-grid-3">
            <div className="lkdv-carnet-kpi-mini">
              <small>Point haut</small>
              <b>
                <AnimatedNumber value={elevationStats.maxAlt} suffix=" m" />
              </b>
            </div>
            <div className="lkdv-carnet-kpi-mini">
              <small>D+ profil</small>
              <b>
                <AnimatedNumber value={elevationStats.gain} prefix="+" suffix=" m" />
              </b>
            </div>
            <div className="lkdv-carnet-kpi-mini">
              <small>Distance</small>
              <b>
                <AnimatedNumber
                  value={elevationStats.distKm}
                  suffix=" km"
                  maximumFractionDigits={1}
                />
              </b>
            </div>
          </div>
        ) : null}

        <div className="lkdv-carnet-chart-card">
          <span className="lkdv-carnet-kit-eyebrow">Courbe d’altitude (m)</span>
          {canObserveResize ? (
            <div style={{ width: '100%', height: 155 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={elevationData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="carnetAltFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1b4332" stopOpacity={0.38} />
                      <stop offset="95%" stopColor="#1b4332" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="km"
                    tick={{ fontSize: 10, fill: '#56665d' }}
                    tickFormatter={(v) => `${v} km`}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#56665d' }}
                    axisLine={false}
                    tickLine={false}
                    domain={['dataMin - 80', 'dataMax + 80']}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid rgba(27, 67, 50, 0.14)',
                      background: 'rgba(255, 255, 255, 0.94)',
                      fontSize: '12px',
                    }}
                    formatter={(val) => [`${val} m`, 'Altitude']}
                    labelFormatter={(km) => `Km ${km}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="alt"
                    stroke="#1b4332"
                    strokeWidth={2.2}
                    fill="url(#carnetAltFill)"
                    isAnimationActive
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <CarnetAltitude
              points={detail.elevationProfile ?? []}
              elevationM={detail.elevationM}
            />
          )}
        </div>

        <div className="lkdv-carnet-chart-card">
          <span className="lkdv-carnet-kit-eyebrow">Répartition par tranche d’altitude</span>
          <div className="lkdv-carnet-kit-bars">
            {bands.map((b) => (
              <div key={b.label} className="lkdv-carnet-kit-bar-row">
                <span className="lkdv-carnet-kit-bar-label">{b.label}</span>
                <div className="lkdv-carnet-kit-bar-track">
                  <div
                    className="lkdv-carnet-kit-bar-fill"
                    style={{ width: `${Math.max(4, b.pct)}%`, background: b.color }}
                  />
                </div>
                <span className="lkdv-carnet-kit-bar-val">{b.pct} %</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (lensId === 'nuits') {
    const nights = detail.nights ?? [];
    if (nights.length === 0) {
      return (
        <div className="lkdv-carnet-empty-card">
          <Moon size={22} aria-hidden="true" />
          <b>Aucun hébergement renseigné</b>
          <p>Les refuges, bivouacs et gîtes défileront ici par jour.</p>
        </div>
      );
    }

    const groups: HorizontalTimelineDayGroup[] = nights.map((n) => ({
      day: n.dayNumber,
      events: [
        {
          id: `night-${n.id}`,
          day: n.dayNumber,
          kind: 'night',
          badge: NIGHT_TYPE_LABELS[n.type],
          timeLabel: n.altitudeM ? `${n.altitudeM} m` : `J${n.dayNumber}`,
          title: n.name,
          subtitle: n.infos || undefined,
          onClick: () => onSelectNight(n),
        },
      ],
    }));

    return (
      <CarnetHorizontalTimeline
        groups={groups}
        ariaLabel="Frise horizontale des hébergements"
      />
    );
  }

  // lensId === 'meteo'
  const weatherEtapes = detail.etapes.filter((e) => Boolean(e.weather?.trim()));
  if (weatherEtapes.length === 0) {
    return (
      <div className="lkdv-carnet-empty-card">
        <CloudSun size={22} aria-hidden="true" />
        <b>Bulletin météo non renseigné</b>
        <p>Les conditions rencontrées chaque jour défileront ici sur la frise.</p>
      </div>
    );
  }

  const weatherGroups: HorizontalTimelineDayGroup[] = weatherEtapes.map((e) => ({
    day: e.dayNumber,
    events: [
      {
        id: `meteo-${e.id}`,
        day: e.dayNumber,
        kind: 'meteo',
        badge: 'Météo',
        timeLabel: `Jour ${e.dayNumber}`,
        title: e.label || `Jour ${e.dayNumber}`,
        subtitle: e.weather || undefined,
        onClick: () => onSelectEtape(e),
      },
    ],
  }));

  return (
    <CarnetHorizontalTimeline
      groups={weatherGroups}
      ariaLabel="Frise horizontale météo"
    />
  );
}
