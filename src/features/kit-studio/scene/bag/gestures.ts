/**
 * src/features/kit-studio/scene/bag/gestures.ts
 *Bounded 3D orbit/zoom gesture controller with 4-case drawer conflict resolution (Lot L5-3 / C-10 / C-12).
 *
 * Conflict rules (C-12):
 * 1. Gesture originating on a drawer, HUD control, or interactive UI element is ignored by the 3D scene.
 * 2. While a drawer drag/Pager swipe is active (`isUiGestureActive()`), 3D gestures are suppressed/cancelled.
 * 3. Transition from 1-finger orbit to 2-finger pinch-zoom re-anchors pinch baseline without azimuth jump.
 * 4. `pointercancel` / `blur` / `visibilitychange` purges all tracked pointers (zero stuck finger).
 *
 * Orbit invariants (C-10 / C-11):
 * - Zero roll (`rollRad === 0`, horizon strictly level).
 * - Elevation clamped to `[-60°, +60°]` AND above ground plane (`y >= 0.04m`).
 * - Distance clamped to `[minSafeDistanceM, maxSafeDistanceM]`.
 */

import { clampCameraPose, DEFAULT_BAG_BBOX } from '../camera/framing';
import type { BoundingBoxM, CameraPose } from '../camera/intents';

export interface PointerSample {
  pointerId: number;
  x: number;
  y: number;
}

export interface GestureControllerOptions {
  getPose: () => CameraPose;
  getBBox?: () => BoundingBoxM;
  isUiGestureActive?: () => boolean;
  onPoseGesture: (nextPose: CameraPose) => void;
  orbitSensitivity?: number;
  zoomSensitivity?: number;
}

const UI_SURFACE_SELECTOR =
  '[data-studio-ui="true"], [data-drawer-surface="true"], .hub-camp-drawer-overlay, .lkv-ds-shell, button, a, input, select, textarea, [role="dialog"], [role="tablist"]';

export function isEventInsideStudioUi(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== 'function') {
    return false;
  }
  return Boolean((target as Element).closest(UI_SURFACE_SELECTOR));
}

export class BagGestureController {
  private pointers = new Map<number, PointerSample>();
  private lastOrbitCenter: { x: number; y: number } | null = null;
  private lastPinchDistance: number | null = null;
  private readonly options: GestureControllerOptions;

  constructor(options: GestureControllerOptions) {
    this.options = options;
  }

  getActivePointerCount(): number {
    return this.pointers.size;
  }

  cancelAll(): void {
    this.pointers.clear();
    this.lastOrbitCenter = null;
    this.lastPinchDistance = null;
  }

  handlePointerDown(ev: {
    pointerId: number;
    clientX: number;
    clientY: number;
    target?: EventTarget | null;
    button?: number;
  }): boolean {
    // Only primary mouse button or touch/pen
    if (typeof ev.button === 'number' && ev.button !== 0) {
      return false;
    }
    // Conflit #1 : le geste démarre sur un tiroir ou bouton UI -> appartient au tiroir
    if (isEventInsideStudioUi(ev.target ?? null)) {
      return false;
    }
    // Conflit #2 : un tiroir est déjà en cours de glissement -> la scène s'efface
    if (this.options.isUiGestureActive?.()) {
      this.cancelAll();
      return false;
    }

    this.pointers.set(ev.pointerId, {
      pointerId: ev.pointerId,
      x: ev.clientX,
      y: ev.clientY,
    });

    this.reanchorBaselines();
    // Déclenche immédiatement la prise de contrôle MANUAL (< 1 frame, C-06)
    const current = this.options.getPose();
    const bbox = this.options.getBBox?.() ?? DEFAULT_BAG_BBOX;
    this.options.onPoseGesture(clampCameraPose(current, bbox));
    return true;
  }

  handlePointerMove(ev: {
    pointerId: number;
    clientX: number;
    clientY: number;
  }): boolean {
    if (!this.pointers.has(ev.pointerId)) {
      return false;
    }
    if (this.options.isUiGestureActive?.()) {
      this.cancelAll();
      return false;
    }

    this.pointers.set(ev.pointerId, {
      pointerId: ev.pointerId,
      x: ev.clientX,
      y: ev.clientY,
    });

    const pose = this.options.getPose();
    const bbox = this.options.getBBox?.() ?? DEFAULT_BAG_BBOX;
    const orbitSens = this.options.orbitSensitivity ?? 0.0075;

    if (this.pointers.size === 1) {
      const pt = Array.from(this.pointers.values())[0];
      if (!this.lastOrbitCenter) {
        this.lastOrbitCenter = { x: pt.x, y: pt.y };
        return true;
      }
      const dx = pt.x - this.lastOrbitCenter.x;
      const dy = pt.y - this.lastOrbitCenter.y;
      this.lastOrbitCenter = { x: pt.x, y: pt.y };

      const next = clampCameraPose(
        {
          target: pose.target,
          azimuthRad: pose.azimuthRad - dx * orbitSens,
          elevationRad: pose.elevationRad + dy * orbitSens,
          distanceM: pose.distanceM,
        },
        bbox
      );
      this.options.onPoseGesture(next);
      return true;
    }

    if (this.pointers.size >= 2) {
      // Conflit #3 : Pincement à 2 doigts (zoom fluide sans saut d'orbite)
      const [p1, p2] = Array.from(this.pointers.values());
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const midX = (p1.x + p2.x) * 0.5;
      const midY = (p1.y + p2.y) * 0.5;

      let nextDistanceM = pose.distanceM;
      if (this.lastPinchDistance && this.lastPinchDistance > 4 && dist > 4) {
        const scale = this.lastPinchDistance / dist;
        nextDistanceM = pose.distanceM * scale;
      }

      let nextAzimuth = pose.azimuthRad;
      let nextElevation = pose.elevationRad;
      if (this.lastOrbitCenter) {
        const dx = midX - this.lastOrbitCenter.x;
        const dy = midY - this.lastOrbitCenter.y;
        nextAzimuth -= dx * orbitSens * 0.5;
        nextElevation += dy * orbitSens * 0.5;
      }

      this.lastPinchDistance = dist;
      this.lastOrbitCenter = { x: midX, y: midY };

      const next = clampCameraPose(
        {
          target: pose.target,
          azimuthRad: nextAzimuth,
          elevationRad: nextElevation,
          distanceM: nextDistanceM,
        },
        bbox
      );
      this.options.onPoseGesture(next);
      return true;
    }

    return false;
  }

  handlePointerUpOrCancel(pointerId: number): void {
    // Conflit #4 : retrait propre d'un doigt ou pointercancel système
    this.pointers.delete(pointerId);
    this.reanchorBaselines();
  }

  handleWheel(ev: {
    deltaY: number;
    target?: EventTarget | null;
  }): boolean {
    if (isEventInsideStudioUi(ev.target ?? null) || this.options.isUiGestureActive?.()) {
      return false;
    }
    const pose = this.options.getPose();
    const bbox = this.options.getBBox?.() ?? DEFAULT_BAG_BBOX;
    const zoomSens = this.options.zoomSensitivity ?? 0.0016;
    const factor = Math.exp(Math.max(-0.35, Math.min(0.35, ev.deltaY * zoomSens)));

    const next = clampCameraPose(
      {
        target: pose.target,
        azimuthRad: pose.azimuthRad,
        elevationRad: pose.elevationRad,
        distanceM: pose.distanceM * factor,
      },
      bbox
    );
    this.options.onPoseGesture(next);
    return true;
  }

  private reanchorBaselines(): void {
    if (this.pointers.size === 0) {
      this.lastOrbitCenter = null;
      this.lastPinchDistance = null;
      return;
    }
    if (this.pointers.size === 1) {
      const pt = Array.from(this.pointers.values())[0];
      this.lastOrbitCenter = { x: pt.x, y: pt.y };
      this.lastPinchDistance = null;
      return;
    }
    const [p1, p2] = Array.from(this.pointers.values());
    this.lastOrbitCenter = {
      x: (p1.x + p2.x) * 0.5,
      y: (p1.y + p2.y) * 0.5,
    };
    this.lastPinchDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  }
}
