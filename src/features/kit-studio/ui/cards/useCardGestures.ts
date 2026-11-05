'use client';
// Gestes des cartes (maquette v2 l.1600-1621) : glisser vers le haut = vol vers le sac (Contenu) ;
// appui long = essai sur le sac (Apparence). Le toucher simple reste un `click` ordinaire.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

export interface LiftInfo {
  readonly id: string;
  readonly kind: string;
  readonly x: number;
  readonly y: number;
  readonly armed: boolean;
}

export interface GestureOptions {
  mode: 'content' | 'appearance';
  /** Rail : sa position haute fixe le seuil d'armement. */
  getRail: () => HTMLElement | null;
  liftable: (kind: string, id: string) => boolean;
  onLiftStart: (kind: string, id: string) => void;
  onArmChange: (armed: boolean) => void;
  /** Relâché : `armed` = au-dessus du rail. */
  onDrop: (kind: string, id: string, armed: boolean, x: number, y: number) => void;
  onLiftCancel: () => void;
  /** Appui long : applique l'essai ; false = refusé. */
  onTryStart: (id: string) => boolean;
  /** Relâché : `keep` faux si glissé vers le haut (annuler l'essai). */
  onTryEnd: (id: string, keep: boolean) => void;
}

const MOVE_PX = 8;
const LONG_MS = 380;
const ARM_MARGIN = 36;
const CANCEL_UP = 40;
const CLICK_GUARD_MS = 150;

interface Down {
  el: HTMLElement;
  id: string;
  kind: string;
  sx: number;
  sy: number;
  pid: number;
  mode: 'pending' | 'lift' | 'try';
  armed: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

export function useCardGestures(options: GestureOptions) {
  const opt = useRef(options);
  useEffect(() => {
    opt.current = options;
  });
  const down = useRef<Down | null>(null);
  const guard = useRef(false);
  const [lift, setLift] = useState<LiftInfo | null>(null);
  const [trying, setTrying] = useState<string | null>(null);

  const swallowClick = () => {
    guard.current = true;
    setTimeout(() => {
      guard.current = false;
    }, CLICK_GUARD_MS);
  };

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-card]');
    if (!el) return;
    const id = el.dataset.cardId ?? '';
    const kind = el.dataset.card ?? '';
    const d: Down = { el, id, kind, sx: e.clientX, sy: e.clientY, pid: e.pointerId, mode: 'pending', armed: false, timer: null };
    if (opt.current.mode === 'appearance' && kind === 'opt') {
      d.timer = setTimeout(() => {
        const cur = down.current;
        if (!cur || cur !== d || d.mode !== 'pending') return;
        d.mode = 'try';
        if (opt.current.onTryStart(id)) setTrying(id);
        else d.mode = 'pending';
      }, LONG_MS);
    }
    down.current = d;
  }, []);

  useEffect(() => {
    const clear = (d: Down) => {
      if (d.timer) clearTimeout(d.timer);
    };
    const move = (e: PointerEvent) => {
      const d = down.current;
      if (!d || e.pointerId !== d.pid) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (d.mode === 'pending') {
        if (Math.hypot(dx, dy) < MOVE_PX) return;
        if (opt.current.mode === 'content' && dy < -MOVE_PX && Math.abs(dy) > Math.abs(dx) * 1.1 && opt.current.liftable(d.kind, d.id)) {
          clear(d);
          d.mode = 'lift';
          try {
            d.el.setPointerCapture(d.pid);
          } catch {
            /* capture indisponible : le glisser continue sur window */
          }
          opt.current.onLiftStart(d.kind, d.id);
        } else {
          clear(d);
          down.current = null;
          return;
        }
      }
      if (d.mode === 'lift') {
        const top = opt.current.getRail()?.getBoundingClientRect().top ?? 0;
        const armed = e.clientY < top - ARM_MARGIN;
        if (armed !== d.armed) {
          d.armed = armed;
          opt.current.onArmChange(armed);
        }
        setLift({ id: d.id, kind: d.kind, x: e.clientX, y: e.clientY, armed });
      }
    };
    const up = (e: PointerEvent) => {
      const d = down.current;
      if (!d || e.pointerId !== d.pid) return;
      down.current = null;
      clear(d);
      if (d.mode === 'lift') {
        swallowClick();
        setLift(null);
        opt.current.onDrop(d.kind, d.id, d.armed, e.clientX, e.clientY);
      } else if (d.mode === 'try') {
        swallowClick();
        setTrying(null);
        opt.current.onTryEnd(d.id, !(d.sy - e.clientY > CANCEL_UP));
      }
    };
    const cancel = (e: PointerEvent) => {
      const d = down.current;
      if (!d || e.pointerId !== d.pid) return;
      down.current = null;
      clear(d);
      if (d.mode === 'lift') {
        setLift(null);
        opt.current.onLiftCancel();
      } else if (d.mode === 'try') {
        setTrying(null);
        opt.current.onTryEnd(d.id, true);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, []);

  /** Vrai si le `click` qui suit un glisser ou un appui long doit être ignoré. */
  const consumeClick = useCallback(() => guard.current, []);

  return { onPointerDown, lift, trying, consumeClick };
}
