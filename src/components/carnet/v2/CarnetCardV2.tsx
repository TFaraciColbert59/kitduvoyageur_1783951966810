'use client';

import React, { useMemo } from 'react';
import type { CarnetDetail, CarnetMomentItem } from '@/features/carnet/detail/types';
import { CarnetDaySwipeView } from './CarnetDaySwipeView';
import { Check, ChevronRight, Radio } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface CarnetCardV2Props {
  detail: CarnetDetail;
  activeDay: number;
  onDayChange: (day: number, dir?: number) => void;
  onOpenDrawerSlot: (
    slot: 'fil' | 'route' | 'sac' | 'chiffres' | 'equipage',
    lensIndex?: number
  ) => void;
  onOpenStories: () => void;
  onSelectMoment: (moment: CarnetMomentItem, index: number) => void;
  onPeekMoment?: (moment: CarnetMomentItem) => void;
  isEditing?: boolean;
  onAddMoment?: () => void;
}

export function CarnetCardV2({
  detail,
  activeDay,
  onDayChange,
  onOpenDrawerSlot,
  onOpenStories,
  onSelectMoment,
  onPeekMoment,
  isEditing = false,
  onAddMoment,
}: CarnetCardV2Props) {
  const { haptic } = useHapticFeedback();

  // Filter moments for the active day (if 0, show all moments)
  const currentMoments = useMemo(() => {
    if (activeDay === 0) {
      return detail.moments;
    }
    return detail.moments.filter((m) => m.dayNumber === activeDay);
  }, [activeDay, detail.moments]);

  const daysCount = detail.days.length || detail.etapes.length || 1;
  const distanceFormatted = detail.distanceKm ? `${Math.round(detail.distanceKm)}` : '—';
  const elevationFormatted = detail.elevationM ? `+${Math.round(detail.elevationM)}` : '—';

  /**
   * Statut réel du carnet : la date décide, pas une étiquette décorative.
   * Aucune date inventée ; sans dates, pas de pilule de statut.
   */
  const liveStatus = useMemo(() => {
    if (!detail.liveSharing) return null;
    const start = detail.startDate ? new Date(`${detail.startDate}T12:00:00`) : null;
    const end = detail.endDate ? new Date(`${detail.endDate}T12:00:00`) : null;
    if (!start || Number.isNaN(start.getTime())) return null;
    const now = new Date();
    const dayMs = 86_400_000;
    if (now < start) {
      return {
        state: 'upcoming' as const,
        label: `Départ le ${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`,
      };
    }
    const finished = end && !Number.isNaN(end.getTime()) ? now > end : false;
    if (finished) return { state: 'done' as const, label: `Terminé · ${daysCount} jours` };
    const dayNumber = Math.max(
      1,
      Math.min(daysCount, Math.floor((now.getTime() - start.getTime()) / dayMs) + 1)
    );
    return { state: 'live' as const, label: `En route · J${dayNumber} sur ${daysCount}` };
  }, [daysCount, detail.endDate, detail.liveSharing, detail.startDate]);

  const summaryLine = [
    detail.distanceKm ? `${distanceFormatted} km` : null,
    detail.elevationM ? `+${Math.round(detail.elevationM)} m` : null,
    detail.moments.length ? `${detail.moments.length} moments` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // Highlight stories pills (up to 5 items)
  const highlights = useMemo(() => {
    const list = [];
    // Include participants as highlights
    for (const p of detail.participants.slice(0, 3)) {
      list.push({
        id: `crew-${p.userId || p.name}`,
        title: (p.name || 'Voyageur').split(' ')[0],
        image: p.avatarUrl || detail.coverImage,
      });
    }
    // Include key photos
    for (const m of detail.photoMoments.slice(0, 5 - list.length)) {
      list.push({
        id: `moment-${m.id}`,
        title: m.caption || `J${m.dayNumber}`,
        image: m.imageUrl || detail.coverImage,
      });
    }
    return list;
  }, [detail.coverImage, detail.participants, detail.photoMoments]);

  return (
    <div className="lkdv-carnet-card" id="card" role="region" aria-label="En-tête du carnet">
      <div className="lkdv-carnet-card-scroll" id="cardscroll">
        <div className="lkdv-ig-header">
          <button
            type="button"
            className={`lkdv-ig-avi-wrap ${detail.liveSharing ? 'live' : ''}`}
            onClick={() => {
              haptic('light');
              onOpenStories();
            }}
            aria-label={`Ouvrir les stories du carnet${detail.liveSharing ? ', en route' : ''}`}
          >
            <span className="lkdv-ig-avi">
              {detail.coverImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={detail.coverImage} alt={detail.title} loading="lazy" decoding="async" />
              ) : null}
            </span>
            <span className="seal" aria-hidden="true">
              <Check size={11} strokeWidth={2.5} />
            </span>
          </button>

          <div className="lkdv-ig-stats" role="group" aria-label="Statistiques principales">
            <button
              type="button"
              className="lkdv-ig-stat"
              onClick={() => {
                haptic('light');
                onOpenDrawerSlot('route', 0);
              }}
              aria-label={`${daysCount} jours de randonnée`}
            >
              <b>{daysCount}</b>
              <span>jours</span>
            </button>

            <button
              type="button"
              className="lkdv-ig-stat"
              onClick={() => {
                haptic('light');
                onOpenDrawerSlot('chiffres', 0);
              }}
              aria-label={`${distanceFormatted} kilomètres parcourus`}
            >
              <b>{distanceFormatted}</b>
              <span>km</span>
            </button>

            <button
              type="button"
              className="lkdv-ig-stat"
              onClick={() => {
                haptic('light');
                onOpenDrawerSlot('chiffres', 1);
              }}
              aria-label={`${elevationFormatted} mètres de dénivelé positif`}
            >
              <b>{elevationFormatted}</b>
              <span>D+ m</span>
            </button>
          </div>
        </div>

        <div className="lkdv-ig-bio">
          <span className="lkdv-ig-name">{detail.title}</span>
          <span className="lkdv-ig-handle-sub">
            {[
              detail.destination,
              detail.dateRange,
              detail.author ? `par ${detail.author.name}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>

        <div className="lkdv-ig-actions">
          {liveStatus ? (
            <span className="lkdv-ig-live" data-state={liveStatus.state}>
              <Radio size={13} aria-hidden="true" />
              <span>{liveStatus.label}</span>
            </span>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="lkdv-ig-open"
            onClick={() => {
              haptic('light');
              onOpenDrawerSlot('fil');
            }}
          >
            <span>Ouvrir le carnet</span>
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>

        {highlights.length > 0 ? (
          <div className="lkdv-ig-hl-row" role="group" aria-label="Sélection à la une">
            {highlights.map((hl) => (
              <button
                key={hl.id}
                type="button"
                className="lkdv-ig-hl"
                onClick={() => {
                  haptic('light');
                  onOpenStories();
                }}
                aria-label={`Voir ${hl.title}`}
              >
                <div className="lkdv-ig-hl-ring">
                  <div className="lkdv-ig-hl-thumb">
                    {hl.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={hl.image} alt="" loading="lazy" decoding="async" />
                    ) : null}
                  </div>
                </div>
                <span className="lkdv-ig-hl-label">{hl.title}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="lkdv-ig-summary">
          <div className="lkdv-ig-summary-row">
            <button
              type="button"
              className="lkdv-ig-summary-chip"
              aria-pressed={activeDay === 0}
              onClick={() => {
                if (activeDay !== 0) {
                  haptic('selection');
                  onDayChange(0);
                }
              }}
            >
              Tout
            </button>
            <b>
              {daysCount} jours · {detail.participants.length || 1} voyageur
              {(detail.participants.length || 1) > 1 ? 's' : ''}
            </b>
          </div>
          {summaryLine ? <span className="lkdv-ig-summary-stats">{summaryLine}</span> : null}
        </div>

        <CarnetDaySwipeView
          days={detail.days}
          etapes={detail.etapes}
          activeDay={activeDay}
          onDayChange={onDayChange}
          moments={currentMoments}
          onSelectMoment={onSelectMoment}
          onPeekMoment={onPeekMoment}
          isEditing={isEditing}
          onAddMoment={onAddMoment}
        />
      </div>
    </div>
  );
}
