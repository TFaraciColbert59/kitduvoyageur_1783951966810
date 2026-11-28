'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Pause, Play } from 'lucide-react';
import { useExplorerStore } from '@/features/explorer-v2/state/store';

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatDist(meters: number): string {
  const m = Math.max(0, Number.isFinite(meters) ? meters : 0);
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2).replace('.', ',')} km`;
}

/**
 * Capsule flottante globale « Sortie en cours » visible sur toutes les pages hors /explorer
 * pour permettre de naviguer librement dans l'app (Communauté, Carnets, Hub, Compas, Messagerie…)
 * tout en gardant un retour 1-tap vers la carte GPS active.
 */
export default function ActiveOutingGlobalPill() {
  const pathname = usePathname();
  const activity = useExplorerStore((s) => s.activity);
  const updateActivity = useExplorerStore((s) => s.updateActivity);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const visible = Boolean(activity) && pathname !== '/explorer';

  useEffect(() => {
    if (!visible || activity?.paused) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [visible, activity?.paused]);

  if (!visible || !activity) return null;

  const elapsedS =
    activity.movingS > 0
      ? activity.movingS
      : Math.max(0, Math.floor((nowMs - activity.startedAt) / 1000));
  const label = activity.selection?.variantLabel || activity.sport || 'Sortie';

  return (
    <aside
      aria-label="Sortie GPS en cours"
      className="fixed left-1/2 -translate-x-1/2"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 78px)',
        zIndex: 48,
        width: 'min(368px, calc(100vw - 24px))',
      }}
    >
      <div
        className="flex items-center justify-between gap-2 rounded-full px-2.5 py-1.5"
        style={{
          background: 'linear-gradient(180deg, rgba(23, 64, 44, 0.94) 0%, rgba(16, 46, 32, 0.94) 100%)',
          border: '0.5px solid rgba(255, 255, 255, 0.22)',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 12px 30px rgba(15, 28, 22, 0.28)',
          color: '#FBFAF6',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <Link
          href="/explorer"
          className="flex min-w-0 flex-1 items-center gap-2 pl-1.5 text-left no-underline"
          style={{ color: '#FBFAF6' }}
        >
          <span
            aria-hidden="true"
            className="shrink-0 rounded-full"
            style={{
              width: 8,
              height: 8,
              background: activity.paused ? '#F59E0B' : '#34D399',
              boxShadow: activity.paused ? 'none' : '0 0 0 4px rgba(52, 211, 153, 0.24)',
            }}
          />
          <span className="truncate text-[12.5px] font-extrabold">{label}</span>
          <span className="shrink-0 text-[12px] font-bold opacity-90">
            {formatDist(activity.distanceM)}
          </span>
          <span className="shrink-0 text-[12px] font-semibold opacity-75">
            {formatClock(elapsedS)}
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => updateActivity({ paused: !activity.paused, autoPaused: false })}
            aria-label={activity.paused ? 'Reprendre la sortie' : 'Mettre en pause la sortie'}
            className="grid place-items-center rounded-full active:scale-90 transition-transform"
            style={{
              width: 30,
              height: 30,
              border: '0.5px solid rgba(255, 255, 255, 0.22)',
              background: 'rgba(255, 255, 255, 0.12)',
              color: '#FBFAF6',
              cursor: 'pointer',
            }}
          >
            {activity.paused ? <Play size={13} fill="currentColor" /> : <Pause size={13} />}
          </button>

          <Link
            href="/explorer"
            className="inline-flex h-[30px] items-center gap-1 rounded-full px-3 text-[11.5px] font-extrabold no-underline active:scale-95 transition-transform"
            style={{
              background: '#FBFAF6',
              color: '#17402C',
            }}
          >
            <Compass size={13} aria-hidden="true" />
            <span>Carte</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
