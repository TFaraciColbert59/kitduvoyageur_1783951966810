'use client';
import { useRef, type PointerEvent as ReactPointerEvent } from 'react';

interface GrabProps {
  /** Décalage vertical du doigt pendant le glissement (null = fin du geste). */
  onDrag?: (dy: number | null) => void;
  onClose: () => void;
  label?: string;
}

/** Poignée du tiroir : zone tactile 18 px, barre 44 x 5. Toucher ou glisser vers le bas ferme. */
export function Grab({ onDrag, onClose, label = 'Fermer le tiroir' }: GrabProps) {
  const drag = useRef<{ sy: number; t: number; on: boolean; id: number } | null>(null);

  const down = (e: ReactPointerEvent<HTMLButtonElement>) => {
    drag.current = { sy: e.clientY, t: performance.now(), on: false, id: e.pointerId };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture indisponible */
    }
  };
  const move = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.sy;
    if (!d.on && Math.abs(dy) > 6) d.on = true;
    if (d.on) onDrag?.(Math.max(0, dy));
  };
  const up = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    onDrag?.(null);
    const dy = e.clientY - d.sy;
    const v = dy / Math.max(1, performance.now() - d.t);
    if (d.on && !(dy > 56 || v > 0.5)) return;
    onClose();
  };
  const cancel = () => {
    if (drag.current) {
      drag.current = null;
      onDrag?.(null);
    }
  };

  return (
    <button
      type="button"
      className="ks-grab"
      aria-label={label}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={cancel}
      // Clavier ou lecteur d'écran : le clic synthétique (detail 0) ferme ; le toucher est géré par pointerup.
      onClick={(e) => {
        if (e.detail === 0) onClose();
      }}
    />
  );
}

/** « Grabber » flottant 140 x 30 : prend le relais quand le tiroir est fermé. */
export function Grabber({ open, onOpen, label = 'Ouvrir le tiroir' }: { open: boolean; onOpen: () => void; label?: string }) {
  return (
    <button
      type="button"
      className="ks-grabber"
      aria-label={label}
      data-hidden={open}
      tabIndex={open ? -1 : 0}
      onClick={onOpen}
    />
  );
}
