'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CarnetDetail, CarnetMomentItem } from '@/features/carnet/detail/types';
import type { CarnetHighlight } from '@/features/carnet/detail/highlights';
import { isParticipantRole } from '@/features/carnet/detail/viewerRole';
import { CarnetDaySwipeView } from './CarnetDaySwipeView';
import { BookOpen, Check, ChevronRight, Flag } from 'lucide-react';
import { CarnetArt } from './CarnetArt';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

/** Appui long d'une pastille « À la une » : édition (maquette, 500 ms). */
export const HIGHLIGHT_LONG_PRESS_MS = 500;

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
  /** Sortie du mode modification (bouton « Terminer »). */
  onEndEdit?: () => void;
  /** Pastilles « À la une » (voyageurs et étapes clés). */
  highlights?: CarnetHighlight[];
  onHighlightTap?: (highlight: CarnetHighlight) => void;
  /** Appui long, participant seulement : tiroir d'édition de la pastille. */
  onHighlightEdit?: (highlight: CarnetHighlight) => void;
  pinnedIds?: ReadonlySet<string>;
  /** Visiteur : massif affiché à la place de la position exacte. */
  zoneLabel?: string | null;
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
  onEndEdit,
  highlights = [],
  onHighlightTap,
  onHighlightEdit,
  pinnedIds,
  zoneLabel = null,
}: CarnetCardV2Props) {
  const { haptic } = useHapticFeedback();
  const isParticipant = isParticipantRole(detail.viewerRole);
  const hlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hlLongPressed = useRef(false);
  const clearHlTimer = () => {
    if (hlTimer.current) clearTimeout(hlTimer.current);
    hlTimer.current = null;
  };

  // Filter moments for the active day (if 0, show all moments)
  const currentMoments = useMemo(() => {
    if (activeDay === 0) {
      return detail.moments;
    }
    return detail.moments.filter((m) => m.dayNumber === activeDay);
  }, [activeDay, detail.moments]);

  const daysCount = detail.days.length || detail.etapes.length || 1;
  const daysLabel = `${daysCount} ${daysCount > 1 ? 'jours' : 'jour'}`;
  const distanceFormatted = detail.distanceKm
    ? detail.distanceKm.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
    : '—';
  const elevationFormatted = detail.elevationM
    ? `+${Math.round(detail.elevationM).toLocaleString('fr-FR')}`
    : '—';
  const travellers = Math.max(1, detail.participants.length);
  /* « lieu de départ · mois année · n voyageurs » (spec § 1.2). */
  const subtitle = [
    detail.place.locality ?? detail.destination,
    detail.startDate
      ? new Date(`${detail.startDate}T12:00:00Z`).toLocaleDateString('fr-FR', {
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : null,
    `${travellers} voyageur${travellers > 1 ? 's' : ''}`,
  ]
    .filter(Boolean)
    .join(' · ');

  /**
   * Statut réel du carnet : la date décide, pas une étiquette décorative.
   * Aucune date inventée ; sans dates, pas de pilule de statut.
   */
  /* L'instant est lu côté client après le montage : le serveur et le navigateur
     ne s'accordent pas sur « maintenant », la pilule d'état se pose donc au montage
     (la place est réservée, aucun saut de mise en page). */
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => setNowMs(Date.now()), []);
  const liveStatus = useMemo(() => {
    if (nowMs === null) return null;
    const start = detail.startDate ? new Date(`${detail.startDate}T12:00:00`) : null;
    const end = detail.endDate ? new Date(`${detail.endDate}T12:00:00`) : null;
    if (!start || Number.isNaN(start.getTime())) return null;
    const now = new Date(nowMs);
    const dayMs = 86_400_000;
    /* Les jours se comptent en jours civils : « maintenant » n'a pas à franchir
       midi pour passer au jour suivant, ni à dépasser la minute de fin. */
    const dayOf = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const today = dayOf(now);
    const hasEnd = Boolean(end) && !Number.isNaN((end as Date).getTime());
    if (!detail.liveSharing) {
      /* Sans partage en direct : « Terminé » seulement si la date de fin est passée. */
      return hasEnd && today > dayOf(end as Date)
        ? { state: 'done' as const, label: `Terminé · ${daysLabel}` }
        : null;
    }
    if (today < dayOf(start)) {
      return {
        state: 'upcoming' as const,
        label: `Départ le ${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`,
      };
    }
    const finished = hasEnd ? today > dayOf(end as Date) : false;
    if (finished) return { state: 'done' as const, label: `Terminé · ${daysLabel}` };
    const dayNumber = Math.max(1, Math.min(daysCount, Math.round((today - dayOf(start)) / dayMs) + 1));
    return {
      state: 'live' as const,
      label: `En route · J${dayNumber} sur ${daysCount}${!isParticipant && zoneLabel ? ` · ${zoneLabel}` : ''}`,
    };
  }, [daysCount, daysLabel, detail.endDate, detail.liveSharing, detail.startDate, isParticipant, nowMs, zoneLabel]);

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
              ) : (
                <CarnetArt className="lkdv-ig-avi-art" />
              )}
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
                onOpenDrawerSlot('chiffres', 2);
              }}
              aria-label={`${daysCount} jours de randonnée`}
            >
              <b>{daysCount}</b>
              <span>{daysCount > 1 ? 'jours' : 'jour'}</span>
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
              <span>D+</span>
            </button>
          </div>
        </div>

        <div className="lkdv-ig-bio">
          <span className="lkdv-ig-name">{detail.title}</span>
          <span className="lkdv-ig-handle-sub">
            {subtitle}
          </span>
        </div>

        <div className="lkdv-ig-actions">
          {liveStatus ? (
            <button
              type="button"
              className="lkdv-ig-live"
              data-state={liveStatus.state}
              aria-label={`${liveStatus.label}. Ouvrir le suivi`}
              onClick={() => {
                haptic('light');
                onOpenDrawerSlot('equipage', 2);
              }}
            >
              <span className="lkdv-livedot" aria-hidden="true" />
              <span className="t">{liveStatus.label}</span>
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          ) : (
            <span />
          )}
          {isEditing && isParticipant ? (
            <button
              type="button"
              className="lkdv-ig-open lkdv-ig-end-edit"
              data-testid="end-edit"
              onClick={() => {
                haptic('light');
                onEndEdit?.();
              }}
            >
              <Check size={15} aria-hidden="true" />
              <span>Terminer</span>
            </button>
          ) : (
            <button
              type="button"
              className="lkdv-ig-open"
              onClick={() => {
                haptic('light');
                onOpenDrawerSlot('fil');
              }}
            >
              <BookOpen size={15} aria-hidden="true" />
              <span>Ouvrir le carnet</span>
            </button>
          )}
        </div>

        {highlights.length > 0 ? (
          <div className="lkdv-ig-hl-row" role="list" aria-label="À la une">
            {highlights.map((hl) => (
              <button
                key={hl.id}
                type="button"
                role="listitem"
                className="lkdv-ig-hl"
                data-highlight={hl.id}
                aria-label={`${hl.label}, ${hl.kind === 'crew' ? 'voyageur' : 'étape clé'}${
                  isParticipant ? '. Appui long pour modifier' : ''
                }`}
                onPointerDown={() => {
                  hlLongPressed.current = false;
                  clearHlTimer();
                  if (!isParticipant || !onHighlightEdit) return;
                  hlTimer.current = setTimeout(() => {
                    hlTimer.current = null;
                    hlLongPressed.current = true;
                    haptic('medium');
                    onHighlightEdit(hl);
                  }, HIGHLIGHT_LONG_PRESS_MS);
                }}
                onPointerUp={clearHlTimer}
                onPointerCancel={clearHlTimer}
                onPointerLeave={clearHlTimer}
                onContextMenu={(event) => {
                  event.preventDefault();
                  clearHlTimer();
                  if (isParticipant && onHighlightEdit) {
                    hlLongPressed.current = true;
                    haptic('medium');
                    onHighlightEdit(hl);
                  }
                }}
                onClick={() => {
                  clearHlTimer();
                  if (hlLongPressed.current) {
                    hlLongPressed.current = false;
                    return;
                  }
                  haptic('light');
                  onHighlightTap?.(hl);
                }}
              >
                <span className="lkdv-ig-hl-ring">
                  <i className="lkdv-ig-hl-glyph" aria-hidden="true">
                    {hl.kind === 'crew' ? hl.label.slice(0, 1).toUpperCase() : <Flag size={19} />}
                  </i>
                </span>
                <span className="lkdv-ig-hl-label">{hl.label}</span>
              </button>
            ))}
          </div>
        ) : null}

        <CarnetDaySwipeView
          days={detail.days}
          etapes={detail.etapes}
          activeDay={activeDay}
          onDayChange={onDayChange}
          moments={currentMoments}
          onSelectMoment={onSelectMoment}
          onPeekMoment={onPeekMoment}
          isEditing={isEditing && isParticipant}
          onAddMoment={onAddMoment}
          pinnedIds={pinnedIds}
          nights={detail.nights}
          coverImage={detail.coverImage}
          travellers={detail.participants.length || 1}
          distanceKm={detail.distanceKm}
          elevationM={detail.elevationM}
        />
      </div>
    </div>
  );
}
