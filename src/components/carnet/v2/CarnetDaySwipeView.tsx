'use client';

import React, { useRef, useState, useCallback } from 'react';
import type { CarnetDay, CarnetMomentItem, CarnetEtapeDay } from '@/features/carnet/detail/types';
import { CarnetPostGrid } from './CarnetPostGrid';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

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
}

const SWIPE_THRESHOLD = 60;

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
}: CarnetDaySwipeViewProps) {
  const { haptic } = useHapticFeedback();
  const [dragX, setDragX] = useState(0);
  const [animClass, setAnimClass] = useState<string>('');
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const isSwipingRef = useRef(false);

  const maxDay = days.length > 0 ? Math.max(...days.map((d) => d.dayNumber ?? d.index)) : 0;
  const currentEtape = etapes.find((e) => e.dayNumber === activeDay);

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
  const dayOptions = [
    { label: 'R', value: 0, fullLabel: 'Résumé' },
    ...days.map((d) => {
      const num = d.dayNumber ?? d.index;
      return {
        label: `J${num}`,
        value: num,
        fullLabel: `Jour ${num}`,
      };
    }),
  ];

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
        {activeDay === 0 ? null : (
          <div className="lkdv-day-banner">
            <div className="lkdv-day-banner-header">
              <b>{currentEtape?.label || `Jour ${activeDay}`}</b>
              <span>
                {[
                  currentEtape?.distanceKm ? `${currentEtape.distanceKm} km` : null,
                  currentEtape?.elevationM ? `+${currentEtape.elevationM} m` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
            {currentEtape?.from && currentEtape?.to ? (
              <div className="lkdv-day-banner-text">
                De {currentEtape.from} à {currentEtape.to}
              </div>
            ) : null}
            {currentEtape?.note ? (
              <div className="lkdv-day-banner-text" style={{ marginTop: '2px', fontStyle: 'italic' }}>
                « {currentEtape.note} »
              </div>
            ) : null}
          </div>
        )}

        <CarnetPostGrid
          moments={moments}
          onSelect={onSelectMoment}
          onPeek={onPeekMoment}
          isEditing={isEditing}
          onAddMoment={onAddMoment}
        />
      </div>

      {/* Floating Day Selector (Mini Capsule 30px) */}
      <div className="lkdv-tabs-float">
        <div
          className="lkdv-day-capsule"
          role="tablist"
          aria-label="Sélection du jour"
          style={{ width: `${dayOptions.length * 36 + 6}px` }}
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
      </div>
    </div>
  );
}
