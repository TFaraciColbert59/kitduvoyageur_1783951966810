'use client';
import { useEffect, useState } from 'react';

/** CountdownLive — compte à rebours vers une date cible (client, réactualisé chaque seconde). */
export function CountdownLive({ target }: { target: string | null | undefined }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return;
    let id: NodeJS.Timeout | null = null;
    const start = () => {
      if (!id && !document.hidden) {
        id = setInterval(() => setNow(Date.now()), 1000);
      }
    };
    const stop = () => {
      if (id) {
        clearInterval(id);
        id = null;
      }
    };
    start();
    const handleVisibility = () => {
      if (document.hidden) stop();
      else {
        setNow(Date.now());
        start();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [target]);

  if (!target) return <span>Date à fixer</span>;
  const targetTime = new Date(target).getTime();
  if (isNaN(targetTime)) return <span>Date à fixer</span>;

  const diff = Math.max(0, targetTime - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  if (diff === 0) return <span>Aujourd’hui</span>;
  return (
    <span className="tabular-nums">
      {d > 0 ? `${d} j ` : ''}
      {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}
