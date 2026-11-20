'use client';

import React, { useMemo } from 'react';
import {
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
        </StaggerCard>

        <StaggerCard className="lkdv-carnet-kpi-grid-3">
          <div className="lkdv-carnet-kpi-mini">
            <small>Km-effort</small>
            <b>
              <AnimatedNumber value={effortTotal} suffix=" km" />
            </b>
          </div>
          <div className="lkdv-carnet-kpi-mini">
            <small>Dénivelé / km</small>
            <b>
              <AnimatedNumber value={density} prefix="+" suffix=" m/km" />
            </b>
          </div>
          <div className="lkdv-carnet-kpi-mini">
            <small>Allure moy.</small>
            <b>
              {totalHours > 0 ? `${(totalKm / totalHours).toFixed(1)} km/h` : '—'}
            </b>
          </div>
        </StaggerCard>

        {dayMetrics.some((d) => d.km > 0) && canObserveResize ? (
          <StaggerCard className="lkdv-carnet-chart-card">
            <span className="lkdv-carnet-kit-eyebrow">Distance par journée (km)</span>
            <div style={{ width: '100%', height: 150 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayMetrics} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}>
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
                    formatter={(v) => [`${v} km`, 'Distance']}
                  />
                  <Bar dataKey="km" radius={[8, 8, 0, 0]} barSize={22}>
                    {dayMetrics.map((_, idx) => (
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
        </StaggerCard>

        <StaggerCard className="lkdv-carnet-kpi-grid-3">
          <div className="lkdv-carnet-kpi-mini">
            <small>Vitesse asc.</small>
            <b>{vam ? `${vam} m/h` : '—'}</b>
          </div>
          <div className="lkdv-carnet-kpi-mini">
            <small>Tours Eiffel</small>
            <b>{eiffel} ×</b>
          </div>
          <div className="lkdv-carnet-kpi-mini">
            <small>Jours actifs</small>
            <b>{daysCount} j</b>
          </div>
        </StaggerCard>

        {dayMetrics.some((d) => d.elev > 0) && canObserveResize ? (
          <StaggerCard className="lkdv-carnet-chart-card">
            <span className="lkdv-carnet-kit-eyebrow">Dénivelé par journée (m)</span>
            <div style={{ width: '100%', height: 150 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayMetrics} margin={{ top: 8, right: 6, left: -16, bottom: 0 }}>
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
                    formatter={(v) => [`+${v} m`, 'D+']}
                  />
                  <Bar dataKey="elev" radius={[8, 8, 0, 0]} barSize={22}>
                    {dayMetrics.map((_, idx) => (
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
        </StaggerCard>

        {estCalories > 0 ? (
          <StaggerCard className="lkdv-carnet-kpi-grid-3">
            <div className="lkdv-carnet-kpi-mini">
              <small>Énergie est.</small>
              <b>
                <AnimatedNumber value={estCalories} suffix=" kcal" />
              </b>
            </div>
            <div className="lkdv-carnet-kpi-mini">
              <small>Allure</small>
              <b>{(totalKm / totalHours).toFixed(1)} km/h</b>
            </div>
            <div className="lkdv-carnet-kpi-mini">
              <small>Plus longue</small>
              <b>{formatHoursLabel(maxHours)}</b>
            </div>
          </StaggerCard>
        ) : null}

        {dayMetrics.some((d) => d.hours > 0) ? (
          <StaggerCard className="lkdv-carnet-chart-card">
            <span className="lkdv-carnet-kit-eyebrow">Temps de marche par étape</span>
            <div className="lkdv-carnet-kit-bars">
              {dayMetrics.map((d, idx) => (
                <div key={d.label} className="lkdv-carnet-kit-bar-row">
                  <span className="lkdv-carnet-kit-bar-label">{d.label}</span>
                  <div className="lkdv-carnet-kit-bar-track">
                    <motion.div
                      className="lkdv-carnet-kit-bar-fill"
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.max(8, Math.round((d.hours / maxHours) * 100))}%`,
                      }}
                      transition={CARNET_SPRING}
                      style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }}
                    />
                  </div>
                  <span className="lkdv-carnet-kit-bar-val">{formatHoursLabel(d.hours)}</span>
                </div>
              ))}
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
              Par personne : <b>{perPerson} {currency}</b>
            </span>
            <span>
              Par jour : <b>{perDay} {currency}/j</b>
            </span>
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

        {byCategory.length > 0 && canObserveResize ? (
          <StaggerCard className="lkdv-carnet-chart-card">
            <span className="lkdv-carnet-kit-eyebrow">Répartition par poste ({currency})</span>
            <div style={{ width: '100%', height: Math.max(90, byCategory.length * 28) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={byCategory}
                  layout="vertical"
                  margin={{ top: 4, right: 14, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={92}
                    tick={{ fontSize: 11, fill: '#111827' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip formatter={(v) => [`${v} ${currency}`, 'Montant']} />
                  <Bar dataKey="amount" radius={[0, 6, 6, 0]} barSize={14}>
                    {byCategory.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
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
