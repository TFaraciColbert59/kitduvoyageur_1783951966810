// Gestes sur la scène (SPEC-3D, SPEC-PRODUIT §Interactions ; maquette Kit_Studio_v2.html l.1519-1590).
// PointerEvent sur le canvas (`touch-action: none`) :
//   1 doigt : glisser horizontal = orbite (la caméra parcourt les zones), vertical = inclinaison,
//             vertical vers le bas sur un objet = soulever l'objet (il suit le doigt, hors du sac) ;
//   2 doigts : pincement = pièces séparées ; double toucher = recentrer ; toucher = onPick ; appui long = onLongPress.
// Clavier : flèches gauche/droite = orbite (zone précédente/suivante), haut/bas = inclinaison, + / − = pièces séparées.
// Les gestes ne modifient jamais l'état de l'application : ils pilotent la caméra (CameraRig) et appellent les
// rappels fournis. Aucune dépendance à three : la scène branche son propre pick/soulevé via GestureTarget.
import type { PartNameId, ZoneId } from '../domain/catalog';
import type { CameraRig } from './camera';
import { TILT_MAX } from './camera';
import { clamp } from './math';

export type ScenePick =
  | { readonly kind: 'item'; readonly id: string }
  /** Pièce du sac touchée en mode Apparence (`id` : 'body', 'lid', … ou 'webbing'). */
  | { readonly kind: 'part'; readonly id: PartNameId; readonly zone: ZoneId }
  /** Zone du sac touchée en mode Gestion. */
  | { readonly kind: 'zone'; readonly id: ZoneId };

export interface LiftEvent {
  readonly phase: 'start' | 'move' | 'end';
  readonly id: string;
  /** Le doigt est assez bas (au-dessus du tiroir) : relâcher range l'objet dans le tiroir. */
  readonly armed: boolean;
  readonly x: number;
  readonly y: number;
}

export type HapticKind = 'light' | 'sel' | 'med';

export interface GestureCallbacks {
  /** Toucher sur un objet, un fantôme, une zone ou une pièce du sac. */
  onPick?(pick: ScenePick): void;
  /** Toucher dans le vide (hors sac et objets). */
  onBackground?(): void;
  /** Appui long sur un objet, un fantôme ou le sac. */
  onLongPress?(pick: ScenePick): void;
  /** Survol d'une zone du sac à la souris (null : plus aucune). */
  onZoneHover?(zone: ZoneId | null): void;
  /** Pièces séparées ouvertes ou refermées par un geste. */
  onExplodedChange?(exploded: boolean): void;
  /** Objet soulevé : suit le doigt ; `end` avec `armed` demande à l'interface de le ranger ailleurs. */
  onLift?(event: LiftEvent): void;
  onHaptic?(kind: HapticKind): void;
}

/** Ce que les gestes ont besoin de la scène. */
export interface GestureTarget {
  readonly rig: Pick<CameraRig,
    'position' | 'scrub' | 'release' | 'setTilt' | 'tilt' | 'goZone' | 'targetIndex' | 'recenter' | 'setExploded' | 'explodedTarget'>;
  /** Pick en coordonnées client (px). */
  pick(clientX: number, clientY: number): ScenePick | null;
  canLift(id: string): boolean;
  liftBegin(id: string): boolean;
  liftMove(clientX: number, clientY: number): void;
  liftEnd(keep: boolean): void;
  /** Quelque chose a changé : (re)lance la boucle de rendu. */
  invalidate(): void;
}

export interface GestureOptions {
  readonly callbacks?: GestureCallbacks;
  /** Ordonnée (px client) au-dessus de laquelle un objet soulevé est « armé » (haut du tiroir). Défaut : dy > 140. */
  readonly armY?: () => number;
}

export interface Gestures {
  dispose(): void;
}

const MOVE_THRESHOLD = 9;
const LONG_PRESS_MS = 480;
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_PX = 44;
const SINGLE_TAP_DELAY_MS = 300;
const TILT_RANGE_PX = 320;
const LIFT_ARM_DY = 140;
const PINCH_GAIN = 1.6;
const EXPLODED_SNAP = 0.45;
const KEY_TILT = 0.08;

type Mode = 'pending' | 'orbit' | 'tilt' | 'lift' | 'pinch' | 'done';

interface Gesture {
  mode: Mode;
  sx: number;
  sy: number;
  s0: number;
  pk: ScenePick | null;
  samples: { t: number; x: number }[];
  d0: number;
  e0: number;
  liftId: string;
  armed: boolean;
}

const now = (): number => (typeof performance === 'undefined' ? Date.now() : performance.now());

export function attachGestures(canvas: HTMLCanvasElement, target: GestureTarget, options: GestureOptions = {}): Gestures {
  const cb = options.callbacks ?? {};
  const rig = target.rig;
  const pointers = new Map<number, { x: number; y: number }>();
  let g: Gesture | null = null;
  let longPress: ReturnType<typeof setTimeout> | null = null;
  let tapTimer: ReturnType<typeof setTimeout> | null = null;
  let wheelTimer: ReturnType<typeof setTimeout> | null = null;
  let lastTap = { t: 0, x: 0, y: 0, delayed: false };
  let hover: ZoneId | null = null;
  /** Dernier état « séparé » annoncé à l'interface. */
  let notified = false;
  const prevTouchAction = canvas.style.touchAction || '';
  const prevTabIndex = canvas.getAttribute('tabindex');

  canvas.style.touchAction = 'none';
  if (prevTabIndex === null) canvas.tabIndex = 0;

  const width = (): number => canvas.clientWidth || canvas.ownerDocument.defaultView?.innerWidth || 400;
  /** Pas d'une zone en px : un glissement d'autant fait passer à la zone suivante. */
  const step = (): number => clamp(width() * 0.36, 110, 210);
  const clearLongPress = (): void => { if (longPress !== null) { clearTimeout(longPress); longPress = null; } };
  const clearTap = (): void => { if (tapTimer !== null) { clearTimeout(tapTimer); tapTimer = null; } };
  const clearWheel = (): void => { if (wheelTimer !== null) { clearTimeout(wheelTimer); wheelTimer = null; } };
  const haptic = (k: HapticKind): void => { cb.onHaptic?.(k); };

  const setExploded = (v: number, notify: boolean): void => {
    rig.setExploded(v);
    const is = rig.explodedTarget() > 0.5;
    if (notify && is !== notified) { notified = is; haptic('sel'); cb.onExplodedChange?.(is); }
    target.invalidate();
  };

  function onDown(e: PointerEvent): void {
    try { canvas.setPointerCapture(e.pointerId); } catch { /* non supporté (tests) ou pointeur déjà relâché */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    clearLongPress();
    if (pointers.size === 2) {
      if (g?.mode === 'lift') endLift(false, e.clientX, e.clientY);
      const [a, b] = [...pointers.values()];
      notified = rig.explodedTarget() > 0.5;
      g = {
        mode: 'pinch', sx: 0, sy: 0, s0: 0, pk: null, samples: [], liftId: '', armed: false,
        d0: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), e0: rig.explodedTarget(),
      };
      return;
    }
    if (pointers.size > 2) return;
    const pk = target.pick(e.clientX, e.clientY);
    g = {
      mode: 'pending', sx: e.clientX, sy: e.clientY, s0: rig.position(), pk, samples: [{ t: now(), x: e.clientX }],
      d0: 0, e0: 0, liftId: '', armed: false,
    };
    const started = g;
    longPress = setTimeout(() => {
      longPress = null;
      if (g !== started || started.mode !== 'pending') return;
      if (started.pk) { started.mode = 'done'; haptic('med'); cb.onLongPress?.(started.pk); }
    }, LONG_PRESS_MS);
  }

  function endLift(keep: boolean, x: number, y: number): void {
    if (!g || g.mode !== 'lift') return;
    const id = g.liftId;
    const armed = g.armed && keep;
    target.liftEnd(armed);
    cb.onLift?.({ phase: 'end', id, armed, x, y });
    g.mode = 'done';
    target.invalidate();
  }

  function onMove(e: PointerEvent): void {
    if (!pointers.has(e.pointerId)) {
      // Survol à la souris : zone du sac sous le curseur.
      if (e.pointerType === 'mouse' && pointers.size === 0 && cb.onZoneHover) {
        const pk = target.pick(e.clientX, e.clientY);
        const z = pk && (pk.kind === 'zone' || pk.kind === 'part') ? (pk.kind === 'zone' ? pk.id : pk.zone) : null;
        if (z !== hover) { hover = z; cb.onZoneHover(z); }
      }
      return;
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!g) return;
    if (g.mode === 'pinch') {
      if (pointers.size < 2) return;
      const [a, b] = [...pointers.values()];
      const v = clamp(g.e0 + (Math.hypot(a.x - b.x, a.y - b.y) / g.d0 - 1) * PINCH_GAIN, 0, 1);
      setExploded(v, true);
      return;
    }
    const dx = e.clientX - g.sx;
    const dy = e.clientY - g.sy;
    if (g.mode === 'pending') {
      if (Math.hypot(dx, dy) < MOVE_THRESHOLD) return;
      clearLongPress();
      if (Math.abs(dx) > Math.abs(dy)) g.mode = 'orbit';
      else if (g.pk?.kind === 'item' && dy > 0 && target.canLift(g.pk.id) && target.liftBegin(g.pk.id)) {
        g.mode = 'lift';
        g.liftId = g.pk.id;
        haptic('light');
        cb.onLift?.({ phase: 'start', id: g.liftId, armed: false, x: e.clientX, y: e.clientY });
      } else g.mode = 'tilt';
    }
    switch (g.mode) {
      case 'orbit': {
        rig.scrub(g.s0 - dx / step());
        g.samples.push({ t: now(), x: e.clientX });
        if (g.samples.length > 6) g.samples.shift();
        target.invalidate();
        break;
      }
      case 'tilt':
        rig.setTilt(clamp(dy / TILT_RANGE_PX, -TILT_MAX, TILT_MAX));
        target.invalidate();
        break;
      case 'lift': {
        target.liftMove(e.clientX, e.clientY);
        const armY = options.armY?.();
        const armed = armY !== undefined ? e.clientY > armY - 24 || dy > LIFT_ARM_DY : dy > LIFT_ARM_DY;
        if (armed !== g.armed) { g.armed = armed; if (armed) haptic('sel'); }
        cb.onLift?.({ phase: 'move', id: g.liftId, armed, x: e.clientX, y: e.clientY });
        target.invalidate();
        break;
      }
      default:
    }
  }

  function tap(gesture: Gesture, x: number, y: number): void {
    const t = now();
    const pk = gesture.pk;
    // Double toucher dans le vide ou sur le sac : recentrer.
    if (lastTap.delayed && t - lastTap.t < DOUBLE_TAP_MS && Math.hypot(x - lastTap.x, y - lastTap.y) < DOUBLE_TAP_PX) {
      clearTap();
      lastTap = { t: 0, x: 0, y: 0, delayed: false };
      rig.recenter();
      haptic('light');
      target.invalidate();
      return;
    }
    if (pk && pk.kind === 'item') {
      lastTap = { t: 0, x: 0, y: 0, delayed: false };
      cb.onPick?.(pk);
      return;
    }
    lastTap = { t, x, y, delayed: true };
    clearTap();
    // Court délai : un second toucher le transforme en « recentrer » au lieu d'une sélection.
    tapTimer = setTimeout(() => {
      tapTimer = null;
      if (rig.explodedTarget() > 0.5) { notified = true; setExploded(0, true); haptic('light'); return; }
      if (pk) cb.onPick?.(pk); else cb.onBackground?.();
    }, SINGLE_TAP_DELAY_MS);
  }

  function finish(e: PointerEvent, cancelled: boolean): void {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    clearLongPress();
    const gesture = g;
    if (!gesture) return;
    if (gesture.mode === 'pinch') {
      if (pointers.size === 0) {
        setExploded(rig.explodedTarget() > EXPLODED_SNAP ? 1 : 0, false);
        const on = rig.explodedTarget() > 0.5;
        haptic('light');
        if (on !== notified) { notified = on; cb.onExplodedChange?.(on); }
        g = null;
      }
      return;
    }
    if (pointers.size > 0) return;
    switch (gesture.mode) {
      case 'pending':
        if (!cancelled) tap(gesture, e.clientX, e.clientY);
        break;
      case 'orbit': {
        const sm = gesture.samples;
        let v = 0;
        if (!cancelled && sm.length > 1) {
          const dt = (sm[sm.length - 1].t - sm[0].t) / 1000;
          if (dt > 0) v = -(sm[sm.length - 1].x - sm[0].x) / step() / dt;
        }
        rig.release(v);
        break;
      }
      case 'tilt':
        rig.setTilt(0);
        break;
      case 'lift':
        endLift(!cancelled, e.clientX, e.clientY);
        break;
      default:
    }
    g = null;
    target.invalidate();
  }

  const onUp = (e: PointerEvent): void => { finish(e, false); };
  const onCancel = (e: PointerEvent): void => { finish(e, true); };

  function onWheel(e: WheelEvent): void {
    e.preventDefault();
    clearWheel();
    if (e.ctrlKey) {
      // Pincement du pavé tactile : pièces séparées.
      notified = rig.explodedTarget() > 0.5;
      setExploded(rig.explodedTarget() - e.deltaY * 0.012, true);
      wheelTimer = setTimeout(() => { wheelTimer = null; setExploded(rig.explodedTarget() > EXPLODED_SNAP ? 1 : 0, false); }, 180);
      return;
    }
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    rig.scrub(rig.position() + d / (step() * 1.4));
    target.invalidate();
    wheelTimer = setTimeout(() => { wheelTimer = null; rig.release(0); target.invalidate(); }, 140);
  }

  function onKey(e: KeyboardEvent): void {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    switch (e.key) {
      case 'ArrowRight': rig.goZone(rig.targetIndex() + 1); break;
      case 'ArrowLeft': rig.goZone(rig.targetIndex() - 1); break;
      case 'ArrowUp': rig.setTilt(rig.tilt() - KEY_TILT); break;
      case 'ArrowDown': rig.setTilt(rig.tilt() + KEY_TILT); break;
      case '+': case '=': notified = rig.explodedTarget() > 0.5; setExploded(1, true); break;
      case '-': case '_': notified = rig.explodedTarget() > 0.5; setExploded(0, true); break;
      default: return;
    }
    e.preventDefault();
    target.invalidate();
  }

  const onContext = (e: Event): void => { e.preventDefault(); };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  canvas.addEventListener('contextmenu', onContext);
  canvas.addEventListener('gesturestart', onContext);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKey);

  return {
    dispose() {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('contextmenu', onContext);
      canvas.removeEventListener('gesturestart', onContext);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('keydown', onKey);
      clearLongPress();
      clearTap();
      clearWheel();
      if (g?.mode === 'lift') target.liftEnd(false);
      g = null;
      pointers.clear();
      canvas.style.touchAction = prevTouchAction;
      if (prevTabIndex === null) canvas.removeAttribute('tabindex');
    },
  };
}
