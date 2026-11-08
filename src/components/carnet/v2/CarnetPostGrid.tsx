'use client';

import React, { useRef } from 'react';
import type { CarnetMomentItem } from '@/features/carnet/detail/types';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface CarnetPostGridProps {
  moments: CarnetMomentItem[];
  onSelect: (moment: CarnetMomentItem, index: number) => void;
  onPeek?: (moment: CarnetMomentItem) => void;
  isEditing?: boolean;
  onAddMoment?: () => void;
}

export function CarnetPostGrid({
  moments,
  onSelect,
  onPeek,
  isEditing = false,
  onAddMoment,
}: CarnetPostGridProps) {
  const { haptic } = useHapticFeedback();
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const didLongPressRef = useRef(false);

  const handlePointerDown = (moment: CarnetMomentItem) => {
    didLongPressRef.current = false;
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);

    pressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      haptic('medium');
      onPeek?.(moment);
    }, 460);
  };

  const handlePointerUp = (moment: CarnetMomentItem, index: number) => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (!didLongPressRef.current) {
      haptic('light');
      onSelect(moment, index);
    }
  };

  const handlePointerCancel = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  if (moments.length === 0 && !isEditing) {
    return (
      <div
        style={{
          padding: '24px 16px',
          textAlign: 'center',
          color: 'var(--label2, #56665D)',
          font: '400 13px var(--font-sans, sans-serif)',
        }}
      >
        Aucun moment partagé pour cette journée.
      </div>
    );
  }

  return (
    <div className="lkdv-ig-grid" role="grid" aria-label="Moments du carnet">
      {moments.map((moment, idx) => {
        const imageUrl = moment.imageUrl;
        const typeLabel =
          moment.type === 'bivouac'
            ? 'Bivouac'
            : moment.type === 'refuge'
              ? 'Refuge'
              : moment.type === 'point_de_vue'
                ? 'Vue'
                : moment.type === 'faune_flore'
                  ? 'Nature'
                  : moment.type === 'rencontre'
                    ? 'Rencontre'
                    : null;

        return (
          <button
            key={moment.id}
            type="button"
            className="lkdv-ig-tile"
            role="gridcell"
            aria-label={`${moment.title || 'Moment'} ${moment.time || ''}`}
            onPointerDown={() => handlePointerDown(moment)}
            onPointerUp={() => handlePointerUp(moment, idx)}
            onPointerCancel={handlePointerCancel}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={moment.title || ''} loading="lazy" decoding="async" />
            ) : (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '8px',
                  background: 'linear-gradient(145deg, #EBF2EC, #D8E5D5)',
                  color: 'var(--tint, #17402C)',
                  textAlign: 'center',
                }}
              >
                <b style={{ fontSize: '11px', lineHeight: 1.2 }}>{moment.title || 'Note'}</b>
                {moment.time ? (
                  <span style={{ fontSize: '9.5px', opacity: 0.8, marginTop: '2px' }}>
                    {moment.time}
                  </span>
                ) : null}
              </div>
            )}
            {typeLabel ? <span className="lkdv-ig-tile-badge">{typeLabel}</span> : null}
          </button>
        );
      })}

      {isEditing && onAddMoment ? (
        <button
          type="button"
          className="lkdv-ig-tile"
          onClick={onAddMoment}
          aria-label="Ajouter un moment"
          style={{
            background: 'rgba(150, 186, 142, 0.35)',
            color: 'var(--tint, #17402C)',
            display: 'grid',
            placeItems: 'center',
            fontSize: '24px',
            fontWeight: 300,
          }}
        >
          +
        </button>
      ) : null}
    </div>
  );
}
