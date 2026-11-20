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
  ArrowRight,
  BedDouble,
  ChevronRight,
  CloudSun,
  Compass,
  Flag,
  Home,
  Moon,
  Mountain,
  Tent,
} from 'lucide-react';
import type {
  CarnetDetail,
  CarnetEtapeDay,
  CarnetNightItem,
} from '@/features/carnet/detail/types';
import { elevationProfileGain } from '@/features/carnet/detail/elevationProfile';
import { CarnetAltitude } from './CarnetAltitude';
import { AnimatedNumber, StaggerCard, StaggerList } from './CarnetDrawerMotion';

interface CarnetRouteDrawerBodyProps {
  detail: CarnetDetail;
  lensId: string;
  onSelectEtape: (etape: CarnetEtapeDay) => void;
  onSelectNight: (night: CarnetNightItem) => void;
}

function nightIcon(type: CarnetNightItem['type']) {
  switch (type) {
    case 'refuge':
      return <Home size={16} aria-hidden="true" />;
    case 'bivouac':
    case 'camping':
      return <Tent size={16} aria-hidden="true" />;
    case 'gite':
    case 'hotel':
      return <BedDouble size={16} aria-hidden="true" />;
    default:
      return <Moon size={16} aria-hidden="true" />;
  }
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
      gain: Math.round(gain),
      distKm: Number(totalDist.toFixed(1)),
    };
  }, [detail.elevationProfile]);

  if (lensId === 'etapes') {
    if (detail.etapes.length === 0) {
      return (
        <div className="lkdv-carnet-empty-card">
          <Flag size={22} aria-hidden="true" />
          <b>Aucune étape renseignée</b>
          <p>Le roadbook jour par jour apparaîtra ici dès qu’une étape sera ajoutée.</p>
        </div>
      );
    }

    return (
      <StaggerList className="lkdv-carnet-cards-col">
        {detail.etapes.map((e) => (
          <StaggerCard
            key={e.id}
            asButton
            className="lkdv-carnet-roadbook-card"
            onClick={() => onSelectEtape(e)}
          >
            <div className="lkdv-carnet-roadbook-top">
              <span className="lkdv-carnet-day-badge">J{e.dayNumber}</span>
              <div className="lkdv-carnet-roadbook-title">
                <b>{e.label || `Jour ${e.dayNumber}`}</b>
                {e.from || e.to ? (
                  <small className="lkdv-carnet-roadbook-route">
                    <span>{e.from || 'Départ'}</span>
                    <ArrowRight size={11} aria-hidden="true" />
                    <span>{e.to || 'Arrivée'}</span>
                  </small>
                ) : null}
              </div>
              <ChevronRight size={15} className="lkdv-carnet-chevron" />
            </div>

            <div className="lkdv-carnet-roadbook-pills">
              {e.distanceKm ? (
                <span className="lkdv-carnet-metric-pill">
                  {Number(e.distanceKm).toFixed(1)} km
                </span>
              ) : null}
              {e.elevationM ? (
                <span className="lkdv-carnet-metric-pill">+{Math.round(e.elevationM)} m</span>
              ) : null}
              {e.durationText ? (
                <span className="lkdv-carnet-metric-pill">{e.durationText}</span>
              ) : null}
              {e.overnight ? (
                <span className="lkdv-carnet-metric-pill is-night">
                  <Moon size={10} /> {e.overnight}
                </span>
              ) : null}
            </div>
          </StaggerCard>
        ))}
      </StaggerList>
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
            <div style={{ width: '100%', height: 175 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={elevationData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="carnetAltFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1b4332" stopOpacity={0.35} />
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
                    strokeWidth={2}
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
          <p>Les refuges, bivouacs et gîtes de la sortie s’afficheront ici.</p>
        </div>
      );
    }

    return (
      <StaggerList className="lkdv-carnet-cards-col">
        {nights.map((n) => (
          <StaggerCard
            key={n.id}
            asButton
            className="lkdv-carnet-night-card"
            onClick={() => onSelectNight(n)}
          >
            <span className="lkdv-carnet-night-ico">{nightIcon(n.type)}</span>
            <div className="lkdv-carnet-night-info">
              <div className="lkdv-carnet-night-meta">
                <span className="lkdv-carnet-chip-dark">J{n.dayNumber}</span>
                <span className="lkdv-carnet-chip-soft">{NIGHT_TYPE_LABELS[n.type]}</span>
                {n.altitudeM ? (
                  <span className="lkdv-carnet-chip-soft">{n.altitudeM} m</span>
                ) : null}
              </div>
              <b>{n.name}</b>
              {n.infos ? <p>{n.infos}</p> : null}
            </div>
            <ChevronRight size={15} className="lkdv-carnet-chevron" />
          </StaggerCard>
        ))}
      </StaggerList>
    );
  }

  // lensId === 'meteo'
  const weatherEtapes = detail.etapes.filter((e) => Boolean(e.weather?.trim()));
  if (weatherEtapes.length === 0) {
    return (
      <div className="lkdv-carnet-empty-card">
        <CloudSun size={22} aria-hidden="true" />
        <b>Bulletin météo non renseigné</b>
        <p>Les conditions rencontrées chaque jour apparaîtront ici dès qu’elles seront saisies.</p>
      </div>
    );
  }

  return (
    <StaggerList className="lkdv-carnet-cards-col">
      {weatherEtapes.map((e) => (
        <StaggerCard key={e.id} className="lkdv-carnet-weather-card">
          <span className="lkdv-carnet-weather-ico">
            <CloudSun size={18} aria-hidden="true" />
          </span>
          <div className="lkdv-carnet-weather-body">
            <div className="lkdv-carnet-weather-head">
              <b>Jour {e.dayNumber}</b>
              {e.label ? <small>{e.label}</small> : null}
            </div>
            <p>{e.weather}</p>
          </div>
          <Compass size={14} className="lkdv-carnet-chevron" />
        </StaggerCard>
      ))}
    </StaggerList>
  );
}
