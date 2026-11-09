'use client';

import React, { useRef } from 'react';
import { Plus } from 'lucide-react';
import type { CarnetMomentItem } from '@/features/carnet/detail/types';
import { isMomentType, type MomentType } from '@/features/carnet/detail/momentTypes';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import {
  CarnetMomentTileBody,
  CarnetTilePinned,
  CarnetTileTypeBadge,
  tileAriaLabel,
} from './CarnetMomentTile';

/** Appui long d'une tuile : aperçu (maquette, 460 ms). */
export const TILE_LONG_PRESS_MS = 460;
/** Au-delà de ce déplacement (px) le geste est un défilement, pas un appui long. */
const LONG_PRESS_SLOP = 8;

export interface CarnetPostGridProps {
  moments: CarnetMomentItem[];
  onSelect: (moment: CarnetMomentItem, index: number) => void;
  onPeek?: (moment: CarnetMomentItem) => void;
  isEditing?: boolean;
  onAddMoment?: () => void;
  /** Moments épinglés (coche dorée en haut à gauche). */
  pinnedIds?: ReadonlySet<string>;
  /** Texte de l'état vide (aucun moment ce jour-là). */
  emptyLabel?: string;
}

export function CarnetPostGrid({
  moments,
  onSelect,
  onPeek,
  isEditing = false,
  onAddMoment,
  pinnedIds,
  emptyLabel = 'Aucun moment partagé pour cette journée.',
}: CarnetPostGridProps) {
  const { haptic } = useHapticFeedback();
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressOriginRef = useRef<{ x: number; y: number } | null>(null);
  const didLongPressRef = useRef(false);

  const clearPress = () => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = null;
    pressOriginRef.current = null;
  };

  const firePeek = (moment: CarnetMomentItem) => {
    didLongPressRef.current = true;
    haptic('medium');
    onPeek?.(moment);
  };

  const handlePointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    moment: CarnetMomentItem
  ) => {
    // Le déclencheur garde le focus : Peek & Pop le restitue à la fermeture.
    event.currentTarget.focus({ preventScroll: true });
    didLongPressRef.current = false;
    clearPress();
    if (!onPeek) return;
    pressOriginRef.current = { x: event.clientX, y: event.clientY };
    pressTimerRef.current = setTimeout(() => {
      pressTimerRef.current = null;
      firePeek(moment);
    }, TILE_LONG_PRESS_MS);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const origin = pressOriginRef.current;
    if (!origin) return;
    if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > LONG_PRESS_SLOP) {
      clearPress();
    }
  };

  const handleClick = (moment: CarnetMomentItem, index: number) => {
    clearPress();
    // L'appui long a déjà ouvert l'aperçu : le relâchement ne doit pas ouvrir le post.
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }
    haptic('light');
    onSelect(moment, index);
  };

  if (moments.length === 0 && !isEditing) {
    return (
      <p className="lkdv-ig-grid-empty" role="status">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="lkdv-ig-grid-wrap">
      <div className="lkdv-ig-grid" role="group" aria-label="Moments du carnet" data-testid="carnet-grid">
        {moments.map((moment, idx) => {
          const type: MomentType | null = isMomentType(moment.type) ? moment.type : null;
          const pinned = pinnedIds?.has(moment.id) ?? false;
          return (
            <button
              key={moment.id}
              type="button"
              className="lkdv-ig-tile"
              data-moment-id={moment.id}
              data-type={type ?? undefined}
              aria-label={tileAriaLabel(moment, type, pinned)}
              onPointerDown={(event) => handlePointerDown(event, moment)}
              onPointerMove={handlePointerMove}
              onPointerUp={clearPress}
              onPointerCancel={clearPress}
              onPointerLeave={clearPress}
              onContextMenu={(event) => {
                if (!onPeek) return;
                event.preventDefault();
                clearPress();
                firePeek(moment);
              }}
              onClick={() => handleClick(moment, idx)}
            >
              <CarnetMomentTileBody moment={moment} type={type} />
              {pinned ? <CarnetTilePinned /> : null}
              <CarnetTileTypeBadge type={type} />
              {moment.time ? <span className="lkdv-ig-tile-h">{moment.time}</span> : null}
            </button>
          );
        })}

        {isEditing && onAddMoment ? (
          <button
            type="button"
            className="lkdv-ig-tile lkdv-ig-tile-add"
            onClick={onAddMoment}
            aria-label="Ajouter un moment"
          >
            <Plus size={22} strokeWidth={1.8} aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}
