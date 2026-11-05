/**
 * src/features/kit-studio/scene/camera/intents.ts
 * Pure camera state & intent definitions (Lot L5-1).
 * ZERO imports from React, Three.js, or DOM.
 */

export const ALL_CAMERA_STATES = [
  'OVERVIEW',
  'FOCUS_PART',
  'OPENING',
  'INSIDE',
  'CLOSING',
  'MANUAL',
  'REDUCED',
  'DEGRADED',
] as const;

export type CameraStateId = (typeof ALL_CAMERA_STATES)[number];

export enum CameraActorPriority {
  REST = 10,
  PART_FOCUS = 20,
  DRAWER_LIFECYCLE = 30,
  RECENTER = 40,
  GLOBAL_NAV = 50,
  USER_GESTURE = 100,
}

export type Vec3Tuple = [number, number, number];

export interface BoundingBoxM {
  w: number;
  h: number;
  d: number;
}

export interface CameraPose {
  target: Vec3Tuple;
  azimuthRad: number;
  elevationRad: number;
  distanceM: number;
  rollRad: 0;
}

export type CameraIntent =
  | {
      kind: 'user-gesture';
      azimuthRad: number;
      elevationRad: number;
      distanceM: number;
      timestampMs?: number;
    }
  | {
      kind: 'recenter';
      timestampMs?: number;
    }
  | {
      kind: 'focus-part';
      partId: string;
      anchor?: Vec3Tuple;
      normal?: Vec3Tuple;
      timestampMs?: number;
    }
  | {
      kind: 'open-and-place';
      slotId?: string | null;
      isInteriorSlot?: boolean;
      hasVisual?: boolean;
      timestampMs?: number;
    }
  | {
      kind: 'close-bag';
      timestampMs?: number;
    }
  | {
      kind: 'set-reduced-motion';
      enabled: boolean;
      timestampMs?: number;
    }
  | {
      kind: 'degrade';
      reason: string;
      timestampMs?: number;
    };

export function getIntentPriority(intent: CameraIntent): CameraActorPriority {
  switch (intent.kind) {
    case 'user-gesture':
      return CameraActorPriority.USER_GESTURE;
    case 'degrade':
      return CameraActorPriority.GLOBAL_NAV;
    case 'recenter':
      return CameraActorPriority.RECENTER;
    case 'open-and-place':
    case 'close-bag':
    case 'set-reduced-motion':
      return CameraActorPriority.DRAWER_LIFECYCLE;
    case 'focus-part':
      return CameraActorPriority.PART_FOCUS;
  }
}
