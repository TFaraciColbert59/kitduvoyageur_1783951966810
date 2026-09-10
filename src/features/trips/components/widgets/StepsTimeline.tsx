'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { MapPin, MoonStar, Mountain, Route } from 'lucide-react';
import type { TripPhase } from '../../engine/temporalPhaseEngine';
import type { TripStep } from '../../types/trip.types';

export interface StepsTimelineProps {
  steps: TripStep[];
  dayIndex: number;
  phase: TripPhase;
}

/** 3 copies empilées : copie du milieu affichée au départ, saut modulo sur le scroll. */
const LOOP_COPIES = 3;

function fmtKm(km: number | null): string {
  if (!km || km <= 0) return '';
  return `${(Math.round(km * 10) / 10).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;
}

function fmtMeters(m: number | null, unit = 'm'): string {
  if (!m || m <= 0) return '';
  return `${m.toLocaleString('fr-FR')} ${unit}`;
}

/**
 * Widget `steps-timeline` — déroulé des étapes du jour (boucle circulaire).
 * La carte « Point de départ » ouvre la boucle, suivie des étapes du jour
 * courant ; le conteneur rend le contenu en boucle infinie (3 copies, saut
 * modulo sans animation — respect de prefers-reduced-motion).
 */
export function StepsTimeline({ steps, dayIndex, phase }: StepsTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);

  const ordered = useMemo(
    () => [...steps].sort((a, b) => a.day_number - b.day_number || a.order_index - b.order_index),
    [steps]
  );

  const startStep = useMemo(
    () =>
      ordered.find((s) => s.day_number === 1 && s.order_index === 0) ??
      ordered.find((s) => s.latitude != null && s.longitude != null) ??
      ordered[0],
    [ordered]
  );

  const totals = useMemo(() => {
    const km = ordered.reduce((sum, s) => sum + (Number(s.distance_km) || 0), 0);
    const dPlus = ordered.reduce((sum, s) => sum + (Number(s.elevation_gain_m) || 0), 0);
    const dLoss = ordered.reduce((sum, s) => sum + (Number(s.elevation_loss_m) || 0), 0);
    return { km, dPlus, dLoss, hasAny: km > 0 || dPlus > 0 };
  }, [ordered]);

  const availableDays = ordered.length > 0 ? Math.max(...ordered.map((s) => s.day_number)) : 0;
  const clampedDay = availableDays > 0 ? Math.min(Math.max(1, dayIndex), availableDays) : 1;
  const daySteps = ordered.filter((s) => s.day_number === clampedDay);

  const phasePill =
    phase === 'live' ? `Jour ${clampedDay} · en direct` : phase === 'recount' ? `Carnet · J${clampedDay}` : `Départ · J${clampedDay}`;

  // Boucle : ancre le scroll sur la copie du milieu, puis saut modulo d'une
  // copie quand on approche des bornes (ajustement instantané, jamais smooth).
  useEffect(() => {
    const el = scrollRef.current;
    const copy = copyRef.current;
    if (!el || !copy) return;
    if (el.scrollHeight <= el.clientHeight) return;
    el.scrollTop = copy.offsetHeight;
  }, [ordered, clampedDay]);

  const handleScroll = () => {
    const el = scrollRef.current;
    const copy = copyRef.current;
    if (!el || !copy) return;
    const h = copy.offsetHeight;
    if (h <= 0) return;
    if (el.scrollTop > h * 1.5) el.scrollTop -= h;
    else if (el.scrollTop < h * 0.5) el.scrollTop += h;
  };

  return (
    <div className="glass flex h-full min-h-0 flex-col p-3.5 space-y-2.5 rounded-2xl border border-white/70 shadow-xs font-sans">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-xs text-[var(--lkv-primary)] flex items-center gap-1.5">
          <Route size={13} aria-hidden="true" />
          Déroulé du jour
        </h3>
        <span className="glass-pill text-[9.5px] font-bold text-[var(--lkv-text-primary)]">
          {phasePill}
        </span>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto no-scrollbar scroll-auto"
        aria-label="Déroulé des étapes du voyage"
      >
        {Array.from({ length: LOOP_COPIES }, (_, copyIndex) => (
          <div key={copyIndex} ref={copyIndex === 1 ? copyRef : undefined} className="space-y-2 pb-2">
            {startStep ? (
              <Link
                href="/hub/itineraire"
                className="glass rounded-2xl border-2 border-[var(--lkv-primary)]/35 bg-white/85 p-3 space-y-1.5 block hover:bg-white transition-colors cursor-pointer"
                aria-label={`Point de départ : ${startStep.location_name ?? startStep.title}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="glass-pill text-[9px] font-bold text-[var(--lkv-primary)] flex items-center gap-1">
                    <MapPin size={10} aria-hidden="true" />
                    Point de départ
                  </span>
                  <span className="glass-pill text-[9px] font-bold text-[var(--lkv-text-muted)] tabular-nums">
                    J{startStep.day_number}
                  </span>
                </div>
                <div className="text-xs font-bold text-[var(--lkv-text-primary)] leading-snug">
                  {startStep.title}
                </div>
                {startStep.location_name && (
                  <div className="text-[11px] text-[var(--lkv-text-secondary)] flex items-center gap-1">
                    <MapPin size={11} aria-hidden="true" />
                    {startStep.location_name}
                  </div>
                )}
                {totals.hasAny && (
                  <div className="text-[11px] text-[var(--lkv-text-secondary)] flex flex-wrap items-center gap-x-2.5 gap-y-0.5 tabular-nums pt-0.5 border-t border-[var(--lkv-primary)]/10">
                    {totals.km > 0 && (
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Route size={11} aria-hidden="true" />
                        {fmtKm(totals.km)}
                      </span>
                    )}
                    {totals.dPlus > 0 && (
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Mountain size={11} aria-hidden="true" />
                        +{fmtMeters(totals.dPlus)}
                      </span>
                    )}
                    {totals.dLoss > 0 && (
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Mountain size={11} className="rotate-180" aria-hidden="true" />
                        −{fmtMeters(totals.dLoss)}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ) : null}

            {daySteps.length > 0 ? (
              daySteps.map((step) => (
                <Link
                  key={`${copyIndex}-${step.id}`}
                  href="/hub/itineraire"
                  className="glass rounded-2xl border border-white/70 p-3 space-y-1.5 block hover:bg-white/80 transition-colors cursor-pointer"
                  aria-label={`Étape ${step.order_index + 1} du jour ${step.day_number} : ${step.title}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="glass-pill text-[9px] font-bold text-[var(--lkv-text-primary)] tabular-nums">
                      J{step.day_number} · {step.order_index + 1}
                    </span>
                    {step.accommodation_name && (
                      <span className="text-[10px] text-[var(--lkv-text-muted)] flex items-center gap-1 min-w-0 truncate">
                        <MoonStar size={10} aria-hidden="true" />
                        {step.accommodation_name}
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-bold text-[var(--lkv-text-primary)] leading-snug">
                    {step.title}
                  </div>
                  {step.location_name && (
                    <div className="text-[11px] text-[var(--lkv-text-secondary)] flex items-center gap-1">
                      <MapPin size={11} aria-hidden="true" />
                      {step.location_name}
                    </div>
                  )}
                  {(step.distance_km || step.elevation_gain_m) && (
                    <div className="text-[11px] text-[var(--lkv-text-muted)] flex items-center gap-2 tabular-nums">
                      {fmtKm(step.distance_km) && (
                        <span className="flex items-center gap-1">
                          <Route size={11} aria-hidden="true" />
                          {fmtKm(step.distance_km)}
                        </span>
                      )}
                      {Number(step.elevation_gain_m) > 0 && (
                        <span className="flex items-center gap-1">
                          <Mountain size={11} aria-hidden="true" />
                          +{fmtMeters(step.elevation_gain_m)}
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              ))
            ) : (
              <div className="glass rounded-2xl border border-white/70 p-4 space-y-1 text-center">
                <p className="text-xs font-bold text-[var(--lkv-text-primary)]">
                  Aucune étape pour le jour {clampedDay}
                </p>
                <p className="text-[11px] text-[var(--lkv-text-secondary)]">
                  La suite du déroulé apparaît dès qu&apos;une étape est planifiée.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default StepsTimeline;
