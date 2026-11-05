'use client';
import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';

const CIRC = 47.12; // 2 * PI * 7.5

interface PillProps {
  /** Poids total en kg. */
  kg: number;
  /** Remplissage de la bague, 0..1. */
  ratio: number;
  /** Nombre d'alertes (pastille masquée à 0). */
  alerts: number;
  /** Tiroir ouvert : la pilule descend se poser à 2 px au-dessus. */
  open: boolean;
  /** Tiroir dont on mesure la hauteur réelle. */
  dockRef: RefObject<HTMLElement | null>;
  /** Clé de la vue courante : tout changement déclenche un recalcul. */
  viewKey?: string;
  label: string;
  onClick: () => void;
}

/** Décalage vertical : bord bas de la pilule à 2 px du tiroir, à partir des hauteurs mesurées. */
export function pillOffset(innerHeight: number, gb: number, dockH: number, pillH: number, padTop: number) {
  return Math.max(0, Math.round(innerHeight - gb - dockH - 2 - pillH - padTop));
}

/** Pilule du poids : bague de remplissage, kg tabulaire, pastille d'alertes. */
export function Pill({ kg, ratio, alerts, open, dockRef, viewKey, label, onClick }: PillProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const [ity, setIty] = useState(0);

  useLayoutEffect(() => {
    const measure = () => {
      const dock = dockRef.current;
      if (!open || !dock) {
        setIty(0);
        return;
      }
      const gb = parseFloat(getComputedStyle(dock).bottom) || 12;
      const dockH = dock.getBoundingClientRect().height;
      const pillH = btn.current?.getBoundingClientRect().height || 44;
      const padTop = wrap.current ? parseFloat(getComputedStyle(wrap.current).paddingTop) || 0 : 0;
      setIty(pillOffset(window.innerHeight, gb, dockH, pillH, padTop));
    };
    measure();
    window.addEventListener('resize', measure);
    const ro = typeof ResizeObserver === 'function' && dockRef.current ? new ResizeObserver(measure) : null;
    if (ro && dockRef.current) ro.observe(dockRef.current);
    return () => {
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, [open, viewKey, dockRef]);

  const dash = `${(Math.min(1, Math.max(0, ratio)) * CIRC).toFixed(2)} ${CIRC}`;
  return (
    <div ref={wrap} className="ks-top" style={{ '--ks-ity': `${ity}px` } as CSSProperties}>
      <button ref={btn} type="button" className="ks-pill" aria-label={label} onClick={onClick}>
        <svg className="ks-ring" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="7.5" className="ks-ring-bg" />
          <circle cx="10" cy="10" r="7.5" className="ks-ring-fg" style={{ strokeDasharray: dash }} />
        </svg>
        <span className="ks-kg">{kg.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg</span>
        {alerts > 0 && (
          <span className="ks-flag" aria-hidden="true">
            <i />
            <b>{alerts}</b>
          </span>
        )}
      </button>
    </div>
  );
}
