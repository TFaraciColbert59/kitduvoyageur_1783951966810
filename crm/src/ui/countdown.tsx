'use client';

import { useEffect, useState } from 'react';
import { countdownTone, formatRemaining, type CountdownTone } from '../lib/countdown';
import { Chip } from './chip';

const TONE_TO_CHIP: Record<CountdownTone, 'stone' | 'warn' | 'danger' | 'info'> = {
  gris: 'stone',
  orange: 'warn',
  rouge: 'danger',
  fleche: 'info'
};

/**
 * Compte à rebours gris / orange / rouge (`src/lib/countdown.ts`).
 * `initialNow` vient du serveur : le premier rendu est identique des deux côtés,
 * puis l'horloge du navigateur prend le relais seconde par seconde.
 */
export function Countdown({
  dueAt,
  totalMs = null,
  initialNow,
  fallback = 'Délai : non renseigné',
  toneOverride
}: {
  dueAt: string | null;
  totalMs?: number | null;
  initialNow: string;
  fallback?: string;
  toneOverride?: 'stone' | 'warn' | 'danger' | 'info';
}) {
  const [now, setNow] = useState(() => Date.parse(initialNow));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!dueAt) return <Chip tone="stone">{fallback}</Chip>;

  const due = Date.parse(dueAt);
  if (!Number.isFinite(due)) return <Chip tone="stone">{fallback}</Chip>;

  const remaining = due - now;
  const tone = countdownTone(remaining, totalMs);
  return (
    <Chip tone={toneOverride ?? TONE_TO_CHIP[tone]} title={dueAt}>
      {formatRemaining(remaining)}
    </Chip>
  );
}
