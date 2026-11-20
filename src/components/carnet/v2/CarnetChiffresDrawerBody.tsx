'use client';

import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { motion } from 'framer-motion';
import { Copy, Flame, Route, Timer, TrendingUp, Users, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import type { CarnetDetail } from '@/features/carnet/detail/types';
import { AnimatedNumber, CARNET_SPRING, StaggerCard, StaggerList } from './CarnetDrawerMotion';

const CHART_COLORS = ['#1b4332', '#2d6a4f', '#40916c', '#52b788', '#74c69d'] as const;

function parseDurationHours(text?: string | null): number {
  if (!text) return 0;
  const hMatch = text.match(/(\d+)\s*h/i);
  const mMatch = text.match(/h\s*(\d+)/i);
  const h = hMatch ? Number(hMatch[1]) : 0;
  const m = mMatch ? Number(mMatch[1]) : 0;
  return Number((h + m / 60).toFixed(2));
}

function formatHoursLabel(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m} min`;
  return m > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

interface CarnetChiffresDrawerBodyProps {
  detail: CarnetDetail;
  lensId: string;
}

export function CarnetChiffresDrawerBody({ detail, lensId }: CarnetChiffresDrawerBodyProps) {
  const canObserveResize = typeof ResizeObserver !== 'undefined';
  const [distFocus, setDistFocus] = useState<'km' | 'effortKm' | 'density' | 'speed'>('km');
  const [elevFocus, setElevFocus] = useState<'elev' | 'vam' | 'eiffel'>('elev');
  const [timeFocus, setTimeFocus] = useState<'hours' | 'kcal' | 'pace'>('hours');

  const dayMetrics = useMemo(() => {
    const dayNums = new Set<number>();
    for (const d of detail.days) dayNums.add(d.dayNumber ?? d.index);
    for (const e of detail.etapes) dayNums.add(e.dayNumber);
    const sorted = Array.from(dayNums).sort((a, b) => a - b);

    return sorted.map((num) => {
      const d = detail.days.find((x) => (x.dayNumber ?? x.index) === num);
      const e = detail.etapes.find((x) => x.dayNumber === num);
      const km = e?.distanceKm ?? d?.distanceKm ?? 0;
      const elev = e?.elevationM ?? d?.elevationM ?? 0;
      const hours = d?.durationS
        ? Number((d.durationS / 3600).toFixed(2))
        : parseDurationHours(e?.durationText);
      const effortKm = Math.round(km + elev / 100);
      return {
        label: `J${num}`,
        km: Number(km.toFixed(1)),
        elev: Math.round(elev),
        hours,
        effortKm,
      };
    });
  }, [detail.days, detail.etapes]);

  const totalHours = useMemo(
    () => dayMetrics.reduce((s, d) => s + d.hours, 0),
    [dayMetrics],
  );
  const totalKm = useMemo(() => {
    const sumSteps = dayMetrics.reduce((s, d) => s + d.km, 0);
    return detail.distanceKm && detail.distanceKm > 0 ? detail.distanceKm : sumSteps;
  }, [dayMetrics, detail.distanceKm]);
  const totalElev = useMemo(() => {
    const sumSteps = dayMetrics.reduce((s, d) => s + d.elev, 0);
    return detail.elevationM && detail.elevationM > 0 ? detail.elevationM : sumSteps;
  }, [dayMetrics, detail.elevationM]);

  const cumulativeMetrics = useMemo(() => {
    let cumKm = 0;
    let cumElev = 0;
    let cumHours = 0;
    return dayMetrics.map((d) => {
      cumKm += d.km;
      cumElev += d.elev;
      cumHours += d.hours;
      return {
        ...d,
        cumKm: Number(cumKm.toFixed(1)),
        cumElev: Math.round(cumElev),
        cumHours: Number(cumHours.toFixed(2)),
        timeLabel: cumHours > 0 ? formatHoursLabel(cumHours) : d.label,
        density: d.km > 0 ? Math.round(d.elev / d.km) : 0,
        speed: d.hours > 0 ? Number((d.km / d.hours).toFixed(1)) : 0,
        vam: d.hours > 0 ? Math.round(d.elev / d.hours) : 0,
        eiffel: Number((d.elev / 330).toFixed(1)),
        kcal: Math.round(d.hours * 520),
        pace: d.hours > 0 ? Number((d.km / d.hours).toFixed(1)) : 0,
      };
    });
  }, [dayMetrics]);

  const copySummary = () => {
    const lines = [
      `${detail.title}`,
      `Distance : ${Math.round(totalKm)} km · D+ : +${Math.round(totalElev)} m`,
      totalHours > 0 ? `Temps de marche : ${formatHoursLabel(totalHours)}` : null,
      detail.kit.totalWeightG
        ? `Sac : ${(detail.kit.totalWeightG / 1000).toFixed(1)} kg`
        : null,
    ].filter(Boolean);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(lines.join(' · '));
      toast.success('Bilan d’expédition copié');
    }
  };

  if (lensId === 'distance') {
    const daysCount = Math.max(1, dayMetrics.length || detail.days.length);
    const avgKm = totalKm > 0 ? Number((totalKm / daysCount).toFixed(1)) : null;
    const maxDay = dayMetrics.reduce(
      (best, cur) => (cur.km > best.km ? cur : best),
      { label: '—', km: 0 },
    );
    const effortTotal = Math.round(totalKm + totalElev / 100);
    const density = totalKm > 0 ? Math.round(totalElev / totalKm) : 0;

    return (
      <StaggerList className="lkdv-carnet-drawer-pane">
        <StaggerCard className="lkdv-carnet-kpi-hero">
          <div
            className="lkdv-carnet-kpi-hero-top"
            style={{ justifyContent: 'space-between', width: '100%' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="lkdv-carnet-kpi-ico">
                <Route size={16} aria-hidden="true" />
              </span>
              <span className="lkdv-carnet-kit-eyebrow">Distance totale</span>
            </div>
            <button
              type="button"
              className="lkdv-carnet-btn-soft"
              style={{ height: 28, padding: '0 10px', fontSize: 11 }}
              onClick={copySummary}
            >
              <Copy size={11} />
              <span>Copier bilan</span>
            </button>
          </div>
          <div className="lkdv-carnet-kpi-hero-val">
            <AnimatedNumber value={Math.round(totalKm)} suffix=" km" />
          </div>
          <div className="lkdv-carnet-kpi-subrow">
            <span>
              Moyenne : <b>{avgKm !== null ? `${avgKm} km/j` : '—'}</b>
            </span>
            {maxDay.km > 0 ? (
              <span>
                Étape reine : <b>{maxDay.label} ({maxDay.km} km)</b>
              </span>
            ) : null}
          </div>
          {cumulativeMetrics.some((d) => d.cumKm > 0) && canObserveResize ? (
            <div style={{ width: '100%', height: 96, marginTop: 8 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cumulativeMetrics} margin={{ top: 4, right: 6, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="carnetDistGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1b4332" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#1b4332" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="timeLabel" tick={{ fontSize: 10, fill: '#56665d' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#56665d' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid rgba(27,67,50,.14)', background: 'rgba(255,255,255,.95)', fontSize: '11.5px' }}
                    formatter={(v) => [`${v} km`, 'Cumul']}
                  />
                  <Area type="monotone" dataKey="cumKm" stroke="#1b4332" strokeWidth={2} fill="url(#carnetDistGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </StaggerCard>

        <StaggerCard className="lkdv-carnet-kpi-grid-3">
          {([
            ['effortKm', 'Km-effort', <AnimatedNumber key="e" value={effortTotal} suffix=" km" />],
            ['density', 'Dénivelé / km', <AnimatedNumber key="d" value={density} prefix="+" suffix=" m/km" />],
            ['speed', 'Allure moy.', totalHours > 0 ? `${(totalKm / totalHours).toFixed(1)} km/h` : '—'],
          ] as const).map(([key, label, val]) => {
            const active = distFocus === key;
            return (
              <button
                key={key}
                type="button"
                className="lkdv-carnet-kpi-mini"
                aria-pressed={active}
                onClick={() => setDistFocus(active ? 'km' : key)}
                style={{
                  textAlign: 'left',
                  cursor: 'pointer',
                  border: active ? '1.5px solid #1b4332' : undefined,
                  background: active ? 'rgba(27, 67, 50, 0.06)' : undefined,
                }}
              >
                <small>{label}</small>
                <b>{val}</b>
              </button>
            );
          })}
        </StaggerCard>

        {cumulativeMetrics.some((d) => d.km > 0) && canObserveResize ? (
          <StaggerCard className="lkdv-carnet-chart-card">
            <span className="lkdv-carnet-kit-eyebrow" style={{ marginBottom: 6, display: 'block' }}>
              {distFocus === 'effortKm'
                ? 'Km-effort par journée'
                : distFocus === 'density'
                  ? 'Dénivelé / km par étape (m/km)'
                  : distFocus === 'speed'
                    ? 'Allure moyenne par étape (km/h)'
                    : 'Distance par journée (km)'}
            </span>
            <div style={{ width: '100%', height: 150 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cumulativeMetrics} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#56665d' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#56665d' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid rgba(27, 67, 50, 0.14)',
                      background: 'rgba(255, 255, 255, 0.94)',
                      fontSize: '12px',
                    }}
                    formatter={(v) => [
                      distFocus === 'density'
                        ? `+${v} m/km`
                        : distFocus === 'speed'
                          ? `${v} km/h`
                          : `${v} km`,
                      distFocus === 'effortKm' ? 'Km-effort' : distFocus === 'density' ? 'D+/km' : distFocus === 'speed' ? 'Allure' : 'Distance',
                    ]}
                  />
                  <Bar dataKey={distFocus} radius={[8, 8, 0, 0]} barSize={22}>
                    {cumulativeMetrics.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </StaggerCard>
        ) : null}
      </StaggerList>
    );
  }

  if (lensId === 'denivele') {
    const daysCount = Math.max(1, dayMetrics.length || detail.days.length);
    const avgElev = totalElev > 0 ? Math.round(totalElev / daysCount) : null;
    const maxDay = dayMetrics.reduce(
      (best, cur) => (cur.elev > best.elev ? cur : best),
      { label: '—', elev: 0 },
    );
    const vam = totalHours > 0 ? Math.round(totalElev / totalHours) : null;
    const eiffel = Number((totalElev / 330).toFixed(1));

    return (
      <StaggerList className="lkdv-carnet-drawer-pane">
        <StaggerCard className="lkdv-carnet-kpi-hero">
          <div className="lkdv-carnet-kpi-hero-top">
            <span className="lkdv-carnet-kpi-ico">
              <TrendingUp size={16} aria-hidden="true" />
            </span>
            <span className="lkdv-carnet-kit-eyebrow">Dénivelé positif</span>
          </div>
          <div className="lkdv-carnet-kpi-hero-val">
            <AnimatedNumber value={Math.round(totalElev)} prefix="+" suffix=" m" />
          </div>
          <div className="lkdv-carnet-kpi-subrow">
            <span>
              Moyenne : <b>{avgElev !== null ? `+${avgElev} m/j` : '—'}</b>
            </span>
            {maxDay.elev > 0 ? (
              <span>
                Plus forte étape : <b>{maxDay.label} (+{maxDay.elev} m)</b>
              </span>
            ) : null}
          </div>
          {cumulativeMetrics.some((d) => d.cumElev > 0) && canObserveResize ? (
            <div style={{ width: '100%', height: 96, marginTop: 8 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cumulativeMetrics} margin={{ top: 4, right: 6, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="carnetElevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2d6a4f" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#2d6a4f" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="timeLabel" tick={{ fontSize: 10, fill: '#56665d' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#56665d' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid rgba(27,67,50,.14)', background: 'rgba(255,255,255,.95)', fontSize: '11.5px' }}
                    formatter={(v) => [`+${v} m`, 'D+ cumulé']}
                  />
                  <Area type="monotone" dataKey="cumElev" stroke="#2d6a4f" strokeWidth={2} fill="url(#carnetElevGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </StaggerCard>

        <StaggerCard className="lkdv-carnet-kpi-grid-3">
          {([
            ['vam', 'Vitesse asc.', vam ? `${vam} m/h` : '—'],
            ['eiffel', 'Tours Eiffel', `${eiffel} ×`],
            ['elev', 'Jours actifs', `${daysCount} j`],
          ] as const).map(([key, label, val]) => {
            const active = elevFocus === key;
            return (
              <button
                key={key}
                type="button"
                className="lkdv-carnet-kpi-mini"
                aria-pressed={active}
                onClick={() => setElevFocus(key)}
                style={{
                  textAlign: 'left',
                  cursor: 'pointer',
                  border: active ? '1.5px solid #1b4332' : undefined,
                  background: active ? 'rgba(27, 67, 50, 0.06)' : undefined,
                }}
              >
                <small>{label}</small>
                <b>{val}</b>
              </button>
            );
          })}
        </StaggerCard>

        {cumulativeMetrics.some((d) => d.elev > 0) && canObserveResize ? (
          <StaggerCard className="lkdv-carnet-chart-card">
            <span className="lkdv-carnet-kit-eyebrow" style={{ marginBottom: 6, display: 'block' }}>
              {elevFocus === 'vam'
                ? 'Vitesse ascensionnelle par étape (m/h)'
                : elevFocus === 'eiffel'
                  ? 'Équivalent Tours Eiffel par étape'
                  : 'Dénivelé par journée (m)'}
            </span>
            <div style={{ width: '100%', height: 150 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cumulativeMetrics} margin={{ top: 8, right: 6, left: -16, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#56665d' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#56665d' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid rgba(27, 67, 50, 0.14)',
                      background: 'rgba(255, 255, 255, 0.94)',
                      fontSize: '12px',
                    }}
                    formatter={(v) => [
                      elevFocus === 'vam' ? `${v} m/h` : elevFocus === 'eiffel' ? `${v} ×` : `+${v} m`,
                      elevFocus === 'vam' ? 'VAM' : elevFocus === 'eiffel' ? 'Tours Eiffel' : 'D+',
                    ]}
                  />
                  <Bar dataKey={elevFocus} radius={[8, 8, 0, 0]} barSize={22}>
                    {cumulativeMetrics.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </StaggerCard>
        ) : null}
      </StaggerList>
    );
  }

  if (lensId === 'duree') {
    const daysCount = Math.max(1, dayMetrics.length || detail.days.length);
    const maxHours = Math.max(1, ...dayMetrics.map((d) => d.hours));
    const avgHours = totalHours > 0 ? totalHours / daysCount : 0;
    const estCalories = totalHours > 0 ? Math.round(totalHours * 520) : 0;

    return (
      <StaggerList className="lkdv-carnet-drawer-pane">
        <StaggerCard className="lkdv-carnet-kpi-hero">
          <div className="lkdv-carnet-kpi-hero-top">
            <span className="lkdv-carnet-kpi-ico">
              <Timer size={16} aria-hidden="true" />
            </span>
            <span className="lkdv-carnet-kit-eyebrow">Durée & Rythme</span>
          </div>
          <div className="lkdv-carnet-kpi-hero-val">
            {totalHours > 0 ? (
              <span>{formatHoursLabel(totalHours)}</span>
            ) : (
              <AnimatedNumber value={daysCount} suffix={daysCount > 1 ? ' jours' : ' jour'} />
            )}
          </div>
          <div className="lkdv-carnet-kpi-subrow">
            <span>
              Étapes : <b>{daysCount} jours</b>
            </span>
            {avgHours > 0 ? (
              <span>
                Moyenne : <b>{formatHoursLabel(avgHours)}/j</b>
              </span>
            ) : null}
          </div>
          {cumulativeMetrics.some((d) => d.cumHours > 0) && canObserveResize ? (
            <div style={{ width: '100%', height: 96, marginTop: 8 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cumulativeMetrics} margin={{ top: 4, right: 6, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="carnetTimeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#40916c" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#40916c" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#56665d' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#56665d' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid rgba(27,67,50,.14)', background: 'rgba(255,255,255,.95)', fontSize: '11.5px' }}
                    formatter={(v) => [formatHoursLabel(Number(v)), 'Temps cumulé']}
                  />
                  <Area type="monotone" dataKey="cumHours" stroke="#40916c" strokeWidth={2} fill="url(#carnetTimeGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </StaggerCard>

        {estCalories > 0 ? (
          <StaggerCard className="lkdv-carnet-kpi-grid-3">
            {([
              ['kcal', 'Énergie est.', <AnimatedNumber key="k" value={estCalories} suffix=" kcal" />],
              ['pace', 'Allure', `${(totalKm / totalHours).toFixed(1)} km/h`],
              ['hours', 'Plus longue', formatHoursLabel(maxHours)],
            ] as const).map(([key, label, val]) => {
              const active = timeFocus === key;
              return (
                <button
                  key={key}
                  type="button"
                  className="lkdv-carnet-kpi-mini"
                  aria-pressed={active}
                  onClick={() => setTimeFocus(key)}
                  style={{
                    textAlign: 'left',
                    cursor: 'pointer',
                    border: active ? '1.5px solid #1b4332' : undefined,
                    background: active ? 'rgba(27, 67, 50, 0.06)' : undefined,
                  }}
                >
                  <small>{label}</small>
                  <b>{val}</b>
                </button>
              );
            })}
          </StaggerCard>
        ) : null}

        {cumulativeMetrics.some((d) => d.hours > 0) ? (
          <StaggerCard className="lkdv-carnet-chart-card">
            <span className="lkdv-carnet-kit-eyebrow" style={{ marginBottom: 10, display: 'block' }}>
              {timeFocus === 'kcal'
                ? 'Énergie estimée par étape (kcal)'
                : timeFocus === 'pace'
                  ? 'Allure par étape (km/h)'
                  : 'Temps de marche par étape'}
            </span>
            <div className="lkdv-carnet-kit-bars">
              {cumulativeMetrics.map((d, idx) => {
                const rawVal = timeFocus === 'kcal' ? d.kcal : timeFocus === 'pace' ? d.pace : d.hours;
                const maxVal = Math.max(
                  1,
                  ...cumulativeMetrics.map((m) =>
                    timeFocus === 'kcal' ? m.kcal : timeFocus === 'pace' ? m.pace : m.hours,
                  ),
                );
                const labelVal =
                  timeFocus === 'kcal'
                    ? `${d.kcal} kcal`
                    : timeFocus === 'pace'
                      ? `${d.pace} km/h`
                      : formatHoursLabel(d.hours);
                return (
                  <div key={d.label} className="lkdv-carnet-kit-bar-row">
                    <span className="lkdv-carnet-kit-bar-label">{d.label}</span>
                    <div className="lkdv-carnet-kit-bar-track">
                      <motion.div
                        className="lkdv-carnet-kit-bar-fill"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.max(8, Math.round((rawVal / maxVal) * 100))}%`,
                        }}
                        transition={CARNET_SPRING}
                        style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }}
                      />
                    </div>
                    <span className="lkdv-carnet-kit-bar-val">{labelVal}</span>
                  </div>
                );
              })}
            </div>
          </StaggerCard>
        ) : null}
      </StaggerList>
    );
  }

  // lensId === 'budget'
  if (detail.budget) {
    const currency = detail.budget.currency === 'EUR' ? '€' : detail.budget.currency ?? '€';
    const total =
      typeof detail.budget.total === 'number'
        ? detail.budget.total
        : typeof detail.budget.totalCents === 'number'
          ? Math.round(detail.budget.totalCents / 100)
          : 0;
    const participantCount = Math.max(1, detail.participants.length);
    const daysCount = Math.max(1, dayMetrics.length || detail.days.length);
    const perPerson =
      typeof detail.budget.perPersonCents === 'number'
        ? Math.round(detail.budget.perPersonCents / 100)
        : Math.round(total / participantCount);
    const perDay = Math.round(total / daysCount);

    // Balance per participant (Tricount style)
    const paidByUser = new Map<string, number>();
    for (const item of detail.budget.items) {
      const uid = item.paidByUserId ?? detail.author?.id ?? 'author';
      const amt =
        typeof item.amount === 'number'
          ? item.amount
          : typeof item.amountCents === 'number'
            ? item.amountCents / 100
            : 0;
      paidByUser.set(uid, (paidByUser.get(uid) ?? 0) + amt);
    }

    const balances = detail.participants.map((p) => {
      const paid = Math.round(paidByUser.get(p.userId) ?? 0);
      const net = Math.round(paid - perPerson);
      return {
        userId: p.userId,
        name: p.name?.split(' ')[0] || p.handle || 'Voyageur',
        paid,
        net,
      };
    });

    const byCategory = Array.from(
      detail.budget.items.reduce((acc, item) => {
        const cat = item.category?.trim() || 'Autre';
        const amt =
          typeof item.amount === 'number'
            ? item.amount
            : typeof item.amountCents === 'number'
              ? item.amountCents / 100
              : 0;
        acc.set(cat, (acc.get(cat) ?? 0) + amt);
        return acc;
      }, new Map<string, number>()),
    ).map(([name, amount]) => ({ name, amount: Math.round(amount) }));

    return (
      <StaggerList className="lkdv-carnet-drawer-pane">
        <StaggerCard className="lkdv-carnet-kpi-hero">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 140px', minWidth: 0 }}>
              <div className="lkdv-carnet-kpi-hero-top">
                <span className="lkdv-carnet-kpi-ico">
                  <Wallet size={16} aria-hidden="true" />
                </span>
                <span className="lkdv-carnet-kit-eyebrow">Budget total</span>
              </div>
              <div className="lkdv-carnet-kpi-hero-val">
                <AnimatedNumber value={total} suffix={` ${currency}`} />
              </div>
              <div className="lkdv-carnet-kpi-subrow">
                <span>
                  Par pers. : <b>{perPerson} {currency}</b>
                </span>
                <span>
                  Par jour : <b>{perDay} {currency}/j</b>
                </span>
              </div>
            </div>
            {byCategory.length > 0 && canObserveResize ? (
              <div style={{ flex: '1 1 160px', minWidth: 150, height: Math.max(86, byCategory.length * 24) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={byCategory}
                    layout="vertical"
                    margin={{ top: 2, right: 10, left: 0, bottom: 0 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={78}
                      tick={{ fontSize: 10.5, fill: '#111827' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip formatter={(v) => [`${v} ${currency}`, 'Montant']} />
                    <Bar dataKey="amount" radius={[0, 6, 6, 0]} barSize={12}>
                      {byCategory.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </div>
        </StaggerCard>

        {balances.length > 1 ? (
          <StaggerCard className="lkdv-carnet-chart-card">
            <span className="lkdv-carnet-kit-eyebrow">
              <Users size={11} style={{ display: 'inline', marginRight: 4 }} />
              Équilibre du groupe
            </span>
            <div className="lkdv-carnet-cards-col">
              {balances.map((b) => (
                <div key={b.userId} className="lkdv-carnet-budget-row">
                  <div>
                    <b>{b.name}</b>
                    <small>Avancé : {b.paid} {currency}</small>
                  </div>
                  <b style={{ color: b.net >= 0 ? '#15803d' : '#b45309' }}>
                    {b.net >= 0 ? `+${b.net}` : b.net} {currency}
                  </b>
                </div>
              ))}
            </div>
          </StaggerCard>
        ) : null}

        <div className="lkdv-carnet-cards-col">
          {detail.budget.items.map((item) => {
            const amt =
              typeof item.amount === 'number'
                ? item.amount
                : typeof item.amountCents === 'number'
                  ? item.amountCents / 100
                  : 0;
            return (
              <StaggerCard key={item.id} className="lkdv-carnet-budget-row">
                <div>
                  <b>{item.label}</b>
                  {item.category ? <small>{item.category}</small> : null}
                </div>
                <b>
                  {Math.round(amt)} {currency}
                </b>
              </StaggerCard>
            );
          })}
        </div>
      </StaggerList>
    );
  }

  return (
    <div className="lkdv-carnet-empty-card">
      <Flame size={22} aria-hidden="true" />
      <b>Aucune donnée disponible</b>
      <p>Les statistiques apparaîtront dès que les données de sortie seront enregistrées.</p>
    </div>
  );
}
