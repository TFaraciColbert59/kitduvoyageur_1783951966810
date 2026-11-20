'use client';

import { m, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { momentHour } from './day';
import type { CockpitData } from './model';
import styles from './cockpit.module.css';

const HOURS = Array.from({ length: 24 }, (_, index) => index);

function Tick({ hour, count, x, onOpen }: {
  hour: number; count: number; x: MotionValue<number>; onOpen: (hour: number, opener: HTMLButtonElement) => void;
}) {
  const reduced = useReducedMotion();
  const rotation = useTransform(x, [(hour - 2) * 34, hour * 34, (hour + 2) * 34], [-36, 0, 36]);
  const label = `${String(hour).padStart(2, '0')}h`;
  return <m.button type="button" className={styles.hourTick} data-hour={hour}
    aria-label={`${label}, ${count} moment${count === 1 ? '' : 's'}`}
    style={reduced ? undefined : { rotateY: rotation }}
    onClick={event => onOpen(hour, event.currentTarget)}>
    <span>{label}</span>
    <span className={styles.hourDots} aria-hidden="true">
      {Array.from({ length: Math.min(3, count) }, (_, index) => <i key={index} />)}
      {count > 3 && <small>+${count - 3}</small>}
    </span>
  </m.button>;
}

export function CarnetClock({ moments, focusHour, onOpen }: {
  moments: NonNullable<CockpitData['carnet']>['moments'];
  focusHour: number;
  onOpen: (hour: number, opener: HTMLButtonElement) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const { scrollX } = useScroll({ container: track });
  const counts = new Map<number, number>();
  for (const moment of moments) {
    const hour = momentHour(moment.time);
    if (hour !== null) counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }

  useEffect(() => {
    const node = track.current;
    const tick = node?.querySelector<HTMLElement>(`[data-hour="${focusHour}"]`);
    if (node && tick) node.scrollLeft = tick.offsetLeft - (node.clientWidth - tick.offsetWidth) / 2;
  }, [focusHour]);

  return <div className={styles.hourWheel}>
    <div ref={track} role="group" aria-label="Moments par heure" className={styles.hourTrack}>
      {HOURS.map(hour => <Tick key={hour} hour={hour} count={counts.get(hour) ?? 0} x={scrollX} onOpen={onOpen} />)}
    </div>
  </div>;
}
