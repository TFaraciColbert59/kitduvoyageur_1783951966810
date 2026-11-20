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
import { Route, Timer, TrendingUp, Wallet } from 'lucide-react';
import type { CarnetDetail } from '@/features/carnet/detail/types';
import { AnimatedNumber, CARNET_SPRING, StaggerCard, StaggerList } from './CarnetDrawerMotion';

const CHART_COLORS = ['#1b4332', '#2d6a4f', '#40916c', '#52b788', '#74c69d'] as const;

interface CarnetChiffresDrawerBodyProps {
  detail: CarnetDetail;
  lensId: string;
}

export function CarnetChiffresDrawerBody({ detail, lensId }: CarnetChiffresDrawerBodyProps) {
  const canObserveResize = typeof ResizeObserver !== 'undefined';

  const dayMetrics = useMemo(() => {
    if (detail.days.length > 0) {
      return detail.days.map((d) => ({
        label: `J${d.index}`,
        km: d.distanceKm ? Number(d.distanceKm.toFixed(1)) : 0,
        elev: d.elevationM ? Math.round(d.elevationM) : 0,
        hours: d.durationS ? Number((d.durationS / 3600).toFixed(1)) : 0,
      }));
    }
    return detail.etapes.map((e) => ({
      label: `J${e.dayNumber}`,
      km: e.distanceKm ? Number(e.distanceKm.toFixed(1)) : 0,
      elev: e.elevationM ? Math.round(e.elevationM) : 0,
      hours: 0,
    }));
  }, [detail.days, detail.etapes]);

  if (lensId === 'distance') {
    const totalKm = detail.distanceKm ? Math.round(detail.distanceKm) : null;
    const daysCount = Math.max(1, dayMetrics.length || detail.days.length);
    const avgKm = detail.distanceKm ? Number((detail.distanceKm / daysCount).toFixed(1)) : null;
    const maxDay = dayMetrics.reduce(
      (best, cur) => (cur.km > best.km ? cur : best),
      { label: '—', km: 0 },
    );

    return (
      <StaggerList className="lkdv-carnet-drawer-pane">
        <StaggerCard className="lkdv-carnet-kpi-hero">
          <div className="lkdv-carnet-kpi-hero-top">
            <span className="lkdv-carnet-kpi-ico">
              <Route size={16} aria-hidden="true" />
            </span>
            <span className="lkdv-carnet-kit-eyebrow">Distance totale</span>
          </div>
          <div className="lkdv-carnet-kpi-hero-val">
            <AnimatedNumber value={totalKm} suffix=" km" />
          </div>
          <div className="lkdv-carnet-kpi-subrow">
            <span>
              Moyenne : <b>{avgKm !== null ? `${avgKm} km/j` : '—'}</b>
            </span>
            {maxDay.km > 0 ? (
              <span>
                Record : <b>{maxDay.label} ({maxDay.km} km)</b>
              </span>
            ) : null}
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
    const totalElev = detail.elevationM ? Math.round(detail.elevationM) : null;
    const daysCount = Math.max(1, dayMetrics.length || detail.days.length);
    const avgElev = detail.elevationM ? Math.round(detail.elevationM / daysCount) : null;
    const maxDay = dayMetrics.reduce(
      (best, cur) => (cur.elev > best.elev ? cur : best),
      { label: '—', elev: 0 },
    );

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
            <AnimatedNumber value={totalElev} prefix="+" suffix=" m" />
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
    const daysCount = detail.days.length || detail.etapes.length || 1;
    const totalHours = dayMetrics.reduce((s, d) => s + d.hours, 0);
    const maxHours = Math.max(1, ...dayMetrics.map((d) => d.hours));

    return (
      <StaggerList className="lkdv-carnet-drawer-pane">
        <StaggerCard className="lkdv-carnet-kpi-hero">
          <div className="lkdv-carnet-kpi-hero-top">
            <span className="lkdv-carnet-kpi-ico">
              <Timer size={16} aria-hidden="true" />
            </span>
            <span className="lkdv-carnet-kit-eyebrow">Durée d’expédition</span>
          </div>
          <div className="lkdv-carnet-kpi-hero-val">
            <AnimatedNumber value={daysCount} suffix={daysCount > 1 ? ' jours' : ' jour'} />
          </div>
          <div className="lkdv-carnet-kpi-subrow">
            <span>
              Temps actif mesuré :{' '}
              <b>{totalHours > 0 ? `${totalHours.toFixed(1)} h` : 'Non chronométré'}</b>
            </span>
          </div>
        </StaggerCard>

        {dayMetrics.some((d) => d.hours > 0) ? (
          <StaggerCard className="lkdv-carnet-chart-card">
            <span className="lkdv-carnet-kit-eyebrow">Effort par journée</span>
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
                  <span className="lkdv-carnet-kit-bar-val">{d.hours} h</span>
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
    const currency = detail.budget.currency ?? '€';
    const total =
      typeof detail.budget.total === 'number'
        ? detail.budget.total
        : typeof detail.budget.totalCents === 'number'
          ? Math.round(detail.budget.totalCents / 100)
          : 0;
    const participantCount = Math.max(1, detail.participants.length);
    const perPerson =
      typeof detail.budget.perPersonCents === 'number'
        ? Math.round(detail.budget.perPersonCents / 100)
        : Math.round(total / participantCount);

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
              Dépenses : <b>{detail.budget.items.length}</b>
            </span>
          </div>
        </StaggerCard>

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
                    width={82}
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
      <BarChart size={22} aria-hidden="true" />
      <b>Aucune donnée disponible</b>
      <p>Les statistiques apparaîtront dès que les données de sortie seront enregistrées.</p>
    </div>
  );
}
