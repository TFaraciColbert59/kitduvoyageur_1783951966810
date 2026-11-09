'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AlignLeft } from 'lucide-react';
import type {
  CarnetDay,
  CarnetEtapeDay,
  CarnetMomentItem,
  CarnetNightItem,
} from '@/features/carnet/detail/types';
import { CarnetPostGrid } from './CarnetPostGrid';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { formatDayLabel, formatDuration, formatElevation, formatKm } from '@/features/carnet/detail/format';
import styles from './CarnetDaySwipeView.module.css';

export interface CarnetDaySwipeViewProps {
  days: CarnetDay[];
  etapes: CarnetEtapeDay[];
  activeDay: number; // 0 = Résumé, 1..n = Jour 1..n
  onDayChange: (dayNumber: number, dir?: number) => void;
  moments: CarnetMomentItem[];
  onSelectMoment: (moment: CarnetMomentItem, index: number) => void;
  onPeekMoment?: (moment: CarnetMomentItem) => void;
  isEditing?: boolean;
  onAddMoment?: () => void;
  /** Moments épinglés (coche dorée sur la tuile). */
  pinnedIds?: ReadonlySet<string>;
  /** Nuits réelles du carnet (`detail.nights`) : seule source de l'altitude d'une nuit. */
  nights?: CarnetNightItem[];
  /** Couverture du carnet, repli quand le jour ne porte aucun moment photo. */
  coverImage?: string | null;
  /** Voyageurs réels (`detail.participants`). */
  travellers?: number;
  /** Totaux réels du carnet, ceux de la rangée de statistiques de la carte. */
  distanceKm?: number | null;
  elevationM?: number | null;
}

const SWIPE_THRESHOLD = 60;

const DAY_LONG_LABEL = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** « lun. 13 juil. » — la date d'un jour ; `null` quand elle n'existe pas. */
function formatFullDayLabel(date: string | null): string | null {
  if (!date) return null;
  // `2026-07-13` : midi UTC, pour qu'aucun fuseau ne décale la date.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00Z` : date;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : DAY_LONG_LABEL.format(parsed);
}

/** `3 moments`, `1 voyageur`, `2 jours`. Un compte réel, jamais un zéro décoratif. */
function counted(count: number, one: string, many: string): string {
  return `${count} ${count > 1 ? many : one}`;
}

/** `+2 410 m` quand l'altitude existe, `null` sinon. */
function signedElevation(meters: number | null): string | null {
  const label = meters === null ? null : formatElevation(meters);
  return label ? `+${label}` : null;
}

const cx = (...names: Array<string | false | null | undefined>): string =>
  names.filter(Boolean).join(' ');

/**
 * Ce qu'un jour montre : l'étape déclarée commande la ligne (from → to, km, D+,
 * durée) et chaque champ absent retombe sur la valeur mesurée du jour (`buildDays`).
 * Aucune valeur n'est inventée : un champ vide reste `null` et s'affiche `—`.
 */
interface DayView {
  dayNumber: number;
  date: string | null;
  from: string | null;
  to: string | null;
  distanceKm: number | null;
  elevationM: number | null;
  durationS: number | null;
  durationText: string | null;
  weather: string | null;
  moments: CarnetMomentItem[];
}

function buildDayViews({
  days,
  etapes,
  moments,
}: {
  days: CarnetDay[];
  etapes: CarnetEtapeDay[];
  moments: CarnetMomentItem[];
}): DayView[] {
  const source: Array<{ dayNumber: number; day: CarnetDay | null }> =
    days.length > 0
      ? days.map((day) => ({ dayNumber: day.dayNumber ?? day.index, day }))
      : etapes.map((etape) => ({ dayNumber: etape.dayNumber, day: null }));

  return [...source]
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map(({ dayNumber, day }) => {
      const etape = etapes.find((e) => e.dayNumber === dayNumber) ?? null;
      // Le jour dérivé porte ses propres moments ; une étape sans jour dérivé
      // se rabat sur la liste réelle des moments du carnet.
      const dayMoments = day ? day.moments : moments.filter((m) => m.dayNumber === dayNumber);
      const places = [
        ...new Set(dayMoments.map((m) => m.place?.trim()).filter((p): p is string => Boolean(p))),
      ];

      return {
        dayNumber,
        date: day?.date ?? null,
        from: etape?.from ?? places[0] ?? null,
        to: etape?.to ?? (places.length > 1 ? places[places.length - 1] : null),
        distanceKm: etape?.distanceKm ?? day?.distanceKm ?? null,
        elevationM: etape?.elevationM ?? day?.elevationM ?? null,
        durationS: day?.durationS ?? null,
        durationText: etape?.durationText ?? null,
        weather: etape?.weather ?? null,
        moments: dayMoments,
      };
    });
}

export function CarnetDaySwipeView({
  days,
  etapes,
  activeDay,
  onDayChange,
  moments,
  onSelectMoment,
  onPeekMoment,
  isEditing = false,
  onAddMoment,
  pinnedIds,
  nights,
  coverImage = null,
  travellers = 1,
  distanceKm = null,
  elevationM = null,
}: CarnetDaySwipeViewProps) {
  const { haptic } = useHapticFeedback();
  const [dragX, setDragX] = useState(0);
  const [animClass, setAnimClass] = useState<string>('');
  const [cardHost, setCardHost] = useState<HTMLElement | null>(null);

  // Le sélecteur flotte sur la CARTE (maquette `.ig-tabs-float`), pas dans le
  // flux du jour : sinon il défile avec la grille et se fait rogner.
  useEffect(() => {
    setCardHost(document.getElementById('card'));
  }, []);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const isSwipingRef = useRef(false);

  const dayViews = useMemo(
    () => buildDayViews({ days, etapes, moments }),
    [days, etapes, moments]
  );
  const maxDay = dayViews.reduce((max, day) => Math.max(max, day.dayNumber), 0);
  const currentDay = dayViews.find((day) => day.dayNumber === activeDay) ?? null;

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    isSwipingRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (startXRef.current === null || startYRef.current === null) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    // Detect horizontal intent
    if (!isSwipingRef.current && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      isSwipingRef.current = true;
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // optional
      }
    }

    if (isSwipingRef.current) {
      // Resistance at bounds
      const blocked = (dx > 0 && activeDay === 0) || (dx < 0 && activeDay >= maxDay);
      setDragX(dx * (blocked ? 0.2 : 0.5));
    }
  };

  const changeDayWithAnimation = useCallback(
    (targetDay: number, dir: number) => {
      setAnimClass(dir > 0 ? 'out-left' : 'out-right');
      haptic('selection');
      setTimeout(() => {
        onDayChange(targetDay, dir);
        setDragX(0);
        setAnimClass(dir > 0 ? 'in-right' : 'in-left');
        setTimeout(() => setAnimClass(''), 340);
      }, 160);
    },
    [onDayChange, haptic]
  );

  const handlePointerUp = (e: React.PointerEvent) => {
    if (startXRef.current === null) return;
    const dx = e.clientX - startXRef.current;
    startXRef.current = null;
    startYRef.current = null;

    if (isSwipingRef.current) {
      isSwipingRef.current = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        // optional
      }

      if (dx < -SWIPE_THRESHOLD && activeDay < maxDay) {
        changeDayWithAnimation(activeDay + 1, 1);
        return;
      } else if (dx > SWIPE_THRESHOLD && activeDay > 0) {
        changeDayWithAnimation(activeDay - 1, -1);
        return;
      }
    }

    // Settle back
    setDragX(0);
  };

  // Day options for the floating selector: 0 (Résumé), 1..maxDay
  const dayOptions: Array<{ label: React.ReactNode; value: number; fullLabel: string }> = [
    {
      label: <AlignLeft size={14} strokeWidth={1.9} aria-hidden="true" />,
      value: 0,
      fullLabel: 'Résumé de tout le carnet',
    },
    ...dayViews.map((day) => ({
      label: `J${day.dayNumber}`,
      value: day.dayNumber,
      fullLabel: `Jour ${day.dayNumber}`,
    })),
  ];

  /* ---- Résumé : en-tête « Tout » + totaux réels du carnet ---------------- */
  const daysCount = days.length || etapes.length;
  const distanceLabel = formatKm(distanceKm);
  const elevationLabel = signedElevation(elevationM);
  const resumeMeta = [
    distanceLabel ?? '—',
    elevationLabel ?? '—',
    counted(moments.length, 'moment', 'moments'),
  ].join(' · ');

  /* ---- Jour n : en-tête de l'étape + grille 3 colonnes ------------------- */
  const dayNumber = activeDay;
  const dayTitle =
    [currentDay?.from, currentDay?.to].filter(Boolean).join(' → ') || `Jour ${dayNumber}`;
  const dayMeta = [
    formatFullDayLabel(currentDay?.date ?? null),
    currentDay?.durationText ?? formatDuration(currentDay?.durationS ?? null),
    formatKm(currentDay?.distanceKm ?? null),
    signedElevation(currentDay?.elevationM ?? null),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div style={{ position: 'relative' }}>
      <div
        className={`lkdv-day-swipe-view ${animClass}`}
        style={{ transform: dragX ? `translateX(${dragX}px)` : undefined }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {activeDay === 0 ? (
          <>
            <div className={cx(styles.dayhead)} aria-live="polite">
              <span className={cx(styles.dayheadBadge)}>Tout</span>
              <div className={cx(styles.dayheadText)}>
                <b className={cx(styles.dayheadTitle)}>
                  {daysCount > 0 ? counted(daysCount, 'jour', 'jours') : '—'} ·{' '}
                  {counted(travellers, 'voyageur', 'voyageurs')}
                </b>
                <span className={cx(styles.dayheadMeta)}>{resumeMeta}</span>
              </div>
            </div>

            {dayViews.length > 0 ? (
              <div className={cx(styles.vlist)} role="group" aria-label="Jours du carnet">
                {dayViews.map((day) => {
                  const number = day.dayNumber;
                  const image =
                    day.moments.find((moment) => moment.imageUrl)?.imageUrl ?? coverImage;
                  const dateLabel = formatDayLabel(day.date);
                  const nightAltitude =
                    nights?.find(
                      (night) => night.dayNumber === number && night.altitudeM !== null
                    )?.altitudeM ?? null;
                  const altLabel =
                    nightAltitude === null
                      ? null
                      : (formatElevation(nightAltitude) ?? `${Math.round(nightAltitude)} m`);
                  const title =
                    [day.from, day.to].filter(Boolean).join(' → ') || `Jour ${number}`;
                  const cardMeta = [
                    formatKm(day.distanceKm) ?? '—',
                    signedElevation(day.elevationM) ?? '—',
                    counted(day.moments.length, 'moment', 'moments'),
                  ].join(' · ');

                  return (
                    <button
                      key={number}
                      type="button"
                      className={cx(styles.voyageCard)}
                      aria-label={
                        day.from && day.to
                          ? `Ouvrir le jour ${number} : ${day.from} vers ${day.to}`
                          : `Ouvrir le jour ${number}`
                      }
                      onClick={() => {
                        haptic('selection');
                        onDayChange(number);
                      }}
                    >
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          className={cx(styles.voyageImage)}
                          src={image}
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                      ) : null}
                      <span className={cx(styles.voyagePillDay)}>
                        {dateLabel ? `J${number} · ${dateLabel}` : `J${number}`}
                      </span>
                      {altLabel ? (
                        <span className={cx(styles.voyagePillAlt)}>{altLabel}</span>
                      ) : null}
                      <span className={cx(styles.voyageInfo)}>
                        <b className={cx(styles.voyageTitle)}>{title}</b>
                        <span className={cx(styles.voyageMeta)}>{cardMeta}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className={cx(styles.empty)}>Aucun jour à afficher pour l’instant.</p>
            )}
          </>
        ) : (
          <>
            <div className={cx(styles.dayhead)} aria-live="polite">
              <span className={cx(styles.dayheadBadge)}>J{dayNumber}</span>
              <div className={cx(styles.dayheadText)}>
                <b className={cx(styles.dayheadTitle)}>{dayTitle}</b>
                {dayMeta ? <span className={cx(styles.dayheadMeta)}>{dayMeta}</span> : null}
              </div>
              {currentDay?.weather ? (
                <span className={cx(styles.dayheadWeather)}>{currentDay.weather}</span>
              ) : null}
            </div>

            <CarnetPostGrid
              moments={moments}
              onSelect={onSelectMoment}
              onPeek={onPeekMoment}
              isEditing={isEditing}
              onAddMoment={onAddMoment}
              pinnedIds={pinnedIds}
            />
          </>
        )}
      </div>

      {/* Floating Day Selector (Mini Capsule 30px), ancré à la carte */}
      {cardHost
        ? createPortal(
            <div className="lkdv-tabs-float">
              <div
                className="lkdv-day-capsule"
                role="tablist"
                aria-label="Jour affiché"
                aria-orientation="horizontal"
                style={{ width: `${dayOptions.length * 36 + 6}px` }}
                onKeyDown={(event) => {
                  const tabs = Array.from(
                    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                  );
                  const at = tabs.indexOf(document.activeElement as HTMLButtonElement);
                  if (at < 0) return;
                  let next: number | null = null;
                  if (event.key === 'ArrowRight') next = (at + 1) % tabs.length;
                  else if (event.key === 'ArrowLeft') next = (at - 1 + tabs.length) % tabs.length;
                  else if (event.key === 'Home') next = 0;
                  else if (event.key === 'End') next = tabs.length - 1;
                  if (next === null) return;
                  event.preventDefault();
                  event.stopPropagation();
                  tabs[next].focus();
                }}
              >
                <span
                  className="lkdv-day-capsule-lens"
                  style={{
                    width: `${(dayOptions.length * 36) / dayOptions.length}px`,
                    transform: `translateX(${activeDay * 36}px)`,
                  }}
                />
                {dayOptions.map((opt) => {
                  const isSelected = activeDay === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="tab"
                      className="lkdv-day-capsule-btn"
                      aria-selected={isSelected}
                      tabIndex={isSelected ? 0 : -1}
                      aria-label={opt.fullLabel}
                      onClick={() => {
                        if (activeDay !== opt.value) {
                          changeDayWithAnimation(opt.value, opt.value > activeDay ? 1 : -1);
                        }
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>,
            cardHost
          )
        : null}
    </div>
  );
}
