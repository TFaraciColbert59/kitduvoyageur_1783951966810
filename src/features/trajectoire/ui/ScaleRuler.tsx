'use client';

import * as React from 'react';

import { GlassSurface } from '@/components/glass/GlassSurface';
import { describeDuration } from '@/features/trajectoire/domain/derive';
import { H_MAX, H_MIN } from '@/features/trajectoire/domain/scaleAxis';
import { RULER_TICKS, rulerKeyAction, tFromPointer, tickPercent } from './rulerMath';

import './trajectoire.css';

export interface ScaleRulerProps {
  /** Position sur l'axe logarithmique, 0-1. */
  t: number;
  hours: number;
  zoneLabel: string;
  onChange: (t: number) => void;
  /** Étiquette de groupe, lue par les lecteurs d'écran. */
  label?: string;
}

/**
 * ScaleRuler — le seul nouveau primitif autorisé par le dossier.
 *
 * Curseur d'échelle logarithmique 1 h → 720 h, conforme WAI-ARIA slider :
 * `role="slider"` avec valuemin/valuemax/valuenow/valuetext, navigation
 * clavier complète (flèches, Home, End, Page Up/Down), cible tactile ≥ 44 px
 * et mouvement désactivé sous `prefers-reduced-motion`.
 */
export function ScaleRuler({
  t,
  hours,
  zoneLabel,
  onChange,
  label = "Curseur d'échelle de l'aventure, de 1 heure à 1 mois",
}: ScaleRulerProps) {
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const draggingRef = React.useRef(false);
  const percent = Math.min(100, Math.max(0, t * 100));

  const handlePointer = React.useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      onChange(tFromPointer(clientX, rect.left, rect.width));
    },
    [onChange]
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    handlePointer(event.clientX);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    handlePointer(event.clientX);
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const action = rulerKeyAction(event.key, t);
    if (action.type === 'none') return;
    // On garde le focus : le curseur reste atteignable au clavier.
    event.preventDefault();
    onChange(action.t);
  };

  return (
    <GlassSurface as="div" level="G1" className="tj-ruler">
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        className="tj-ruler__track"
        aria-label={label}
        aria-valuemin={H_MIN}
        aria-valuemax={H_MAX}
        aria-valuenow={hours}
        aria-valuetext={`${describeDuration(hours)}, ${zoneLabel}`}
        aria-orientation="horizontal"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={handleKeyDown}
      >
        <div className="tj-ruler__fill" style={{ width: `${percent}%` }} />
        <div className="tj-ruler__thumb" style={{ left: `${percent}%` }} aria-hidden="true">
          <span className="tj-ruler__thumb-glyph" />
        </div>
      </div>

      <div className="tj-ruler__ticks" aria-hidden="true">
        {RULER_TICKS.map((tick) => (
          <span
            key={tick.hours}
            className="tj-ruler__tick"
            style={{ left: `${tickPercent(tick.hours)}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>
    </GlassSurface>
  );
}

export default ScaleRuler;
