/**
 * Explorer v2 — Zero-Flicker 3D Map Collision, Spatial Hash, Soft Repulsion & Spring Physics.
 *
 * Pure CPU-side layout & spring-damper solver for floating 3D diorama objects:
 * - O(N) 64×64px Spatial Hash Grid for screen-space neighbor queries.
 * - Priority hierarchy (Selected > Vital Safety > Social/Pokédex > Summits > Spots).
 * - Soft spring-damped repulsion nudge (clamped ±26 px) so close high-priority objects
 *   separate gracefully instead of stacking or popping abruptly.
 * - Dual-threshold hysteresis (enter >= 48 px, exit < 32 px) + continuous `visibilityAlpha`
 *   interpolation (0 → 1) so panning/zooming NEVER causes binary visibility flicker.
 * - Underdamped Hooke spring-damper for pop-in overshoot, tap leap, and Disney squash-and-stretch.
 */

export interface Collision3DCandidate {
  id: string;
  anchorX: number;
  anchorY: number;
  priority: number;
  selected: boolean;
  inBounds: boolean;
}

export interface Spring3DState {
  /** Smoothed screen offset from soft repulsion (px). */
  offsetX: number;
  offsetY: number;
  /** Continuous visibility alpha (0..1) — prevents binary flicker. */
  alpha: number;
  /** Hysteresis latch: true if currently admitted as visible. */
  admitted: boolean;
  /** Elastic spawn-in scale (0 → 1.15 → 1.0). */
  spawnScale: number;
  spawnVel: number;
  /** Vertical tap-jump spring impulse. */
  jumpY: number;
  jumpVel: number;
  /** Disney squash-and-stretch deformation (recovers smoothly to 1,1,1). */
  squashX: number;
  squashY: number;
  squashZ: number;
  /** Celebratory spin burst velocity (rad/s) decaying back to idle spin. */
  spinBoost: number;
  /** Hover proximity lift (0..1). */
  hoverLift: number;
}

export interface SolvedCollision3D {
  id: string;
  renderX: number;
  renderY: number;
  alpha: number;
  admitted: boolean;
  state: Spring3DState;
}

export const SPATIAL_CELL_PX = 64;
export const HYSTERESIS_ENTER_PX = 46;
export const HYSTERESIS_EXIT_PX = 31;
export const MAX_SOFT_REPULSION_PX = 26;

export function createInitialSpring3DState(reducedMotion = false): Spring3DState {
  return {
    offsetX: 0,
    offsetY: 0,
    alpha: reducedMotion ? 1 : 0,
    admitted: true,
    spawnScale: reducedMotion ? 1 : 0.05,
    spawnVel: reducedMotion ? 0 : 4.2,
    jumpY: 0,
    jumpVel: 0,
    squashX: 1,
    squashY: 1,
    squashZ: 1,
    spinBoost: 0,
    hoverLift: 0,
  };
}

/**
 * Triggers a juicy Neopolis tap impulse (squash-and-stretch + upward leap + spin burst).
 */
export function triggerTapJuice(state: Spring3DState, reducedMotion = false): void {
  if (reducedMotion) return;
  state.jumpVel = 5.4;
  state.squashX = 1.36;
  state.squashY = 0.66;
  state.squashZ = 1.36;
  state.spinBoost = 7.2;
}

/**
 * Advances all spring-damper physics for one object over `dtSec` (clamped <= 0.05 s for stability).
 */
export function stepSpring3DState(
  state: Spring3DState,
  dtSec: number,
  options: { admitted: boolean; hovered: boolean; reducedMotion: boolean },
): void {
  const dt = Math.min(0.05, Math.max(0.001, dtSec));

  if (options.reducedMotion) {
    state.alpha = options.admitted ? 1 : 0;
    state.spawnScale = options.admitted ? 1 : 0;
    state.spawnVel = 0;
    state.jumpY = 0;
    state.jumpVel = 0;
    state.squashX = 1;
    state.squashY = 1;
    state.squashZ = 1;
    state.spinBoost = 0;
    state.hoverLift = options.hovered ? 1 : 0;
    return;
  }

  // 1. Smooth visibility alpha fade (zero binary flicker)
  const targetAlpha = options.admitted ? 1 : 0;
  const fadeRate = options.admitted ? 9.5 : 12.0;
  state.alpha += (targetAlpha - state.alpha) * Math.min(1, fadeRate * dt);
  if (Math.abs(targetAlpha - state.alpha) < 0.005) state.alpha = targetAlpha;

  // 2. Underdamped spring for elastic pop-in scale (overshoots ~1.14 then settles at 1.0)
  const targetScale = options.admitted ? 1 : 0.25;
  const stiffness = 210;
  const damping = 16;
  const accScale = (targetScale - state.spawnScale) * stiffness - state.spawnVel * damping;
  state.spawnVel += accScale * dt;
  state.spawnScale = Math.max(0, state.spawnScale + state.spawnVel * dt);

  // 3. Tap jump spring (returns to 0 with snappy bounce)
  const accJump = -state.jumpY * 145 - state.jumpVel * 11.5;
  state.jumpVel += accJump * dt;
  state.jumpY += state.jumpVel * dt;
  if (Math.abs(state.jumpY) < 0.002 && Math.abs(state.jumpVel) < 0.01) {
    state.jumpY = 0;
    state.jumpVel = 0;
  }

  // 4. Disney squash-and-stretch recovery toward (1, 1, 1)
  const squashLerp = Math.min(1, 13 * dt);
  state.squashX += (1 - state.squashX) * squashLerp;
  state.squashY += (1 - state.squashY) * squashLerp;
  state.squashZ += (1 - state.squashZ) * squashLerp;

  // 5. Spin boost exponential decay
  state.spinBoost *= Math.exp(-4.8 * dt);
  if (state.spinBoost < 0.01) state.spinBoost = 0;

  // 6. Smooth hover magnetic lift
  const targetHover = options.hovered ? 1 : 0;
  state.hoverLift += (targetHover - state.hoverLift) * Math.min(1, 14 * dt);
}

/**
 * Computes priority score for deterministic collision resolution.
 */
export function priorityFor3DEntity(kind: string, selected: boolean, distToCenterSq: number): number {
  if (selected) return 10_000;
  let base = 60;
  switch (kind) {
    case 'rescue':
    case 'danger':
    case 'fire':
    case 'flood':
    case 'seismic':
      base = 140;
      break;
    case 'refuge':
    case 'wilderness_hut':
    case 'shelter':
    case 'water':
    case 'spring':
    case 'bivouac':
      base = 120;
      break;
    case 'carnet':
    case 'bottle':
    case 'club':
    case 'club_event':
    case 'story':
    case 'friend':
    case 'saved_place':
    case 'pokedex':
    case 'pokedex_flora':
    case 'pokedex_bird':
    case 'pokedex_mammal':
    case 'pokedex_fungi':
    case 'pokedex_insect':
    case 'pokedex_aqua':
      base = 110;
      break;
    case 'summit':
    case 'saddle':
    case 'viewpoint':
      base = 95;
      break;
    case 'trailhead':
    case 'bike_shop':
    case 'bike_repair':
    case 'ebike_charging':
    case 'train_station':
    case 'bus_stop':
    case 'parking':
    case 'village':
    case 'city':
      base = 78;
      break;
    default:
      base = 65;
      break;
  }
  // Small proximity tie-breaker (closer to viewport center wins)
  return base - Math.min(25, distToCenterSq * 20);
}

/**
 * Runs one frame of O(N) spatial-hash collision resolution with soft spring repulsion
 * and dual-threshold hysteresis across all 3D candidates.
 */
export function solve3DCollisions(
  candidates: readonly Collision3DCandidate[],
  stateMap: Map<string, Spring3DState>,
  dtSec: number,
  options: {
    hoveredId?: string | null;
    reducedMotion?: boolean;
    enterPx?: number;
    exitPx?: number;
  } = {},
): SolvedCollision3D[] {
  const dt = Math.min(0.05, Math.max(0.001, dtSec));
  const reducedMotion = Boolean(options.reducedMotion);
  const hoveredId = options.hoveredId ?? null;
  const enterPx = options.enterPx ?? HYSTERESIS_ENTER_PX;
  const exitPx = options.exitPx ?? HYSTERESIS_EXIT_PX;

  // Sort strictly by descending priority so important objects never yield to lower-priority ones
  const sorted = [...candidates].sort((a, b) => b.priority - a.priority);

  // Spatial hash buckets of admitted placements
  const grid = new Map<string, Array<{ x: number; y: number }>>();
  const results: SolvedCollision3D[] = [];

  const insertPlaced = (x: number, y: number) => {
    const cx = Math.floor(x / SPATIAL_CELL_PX);
    const cy = Math.floor(y / SPATIAL_CELL_PX);
    const key = `${cx}:${cy}`;
    const bucket = grid.get(key);
    if (bucket) bucket.push({ x, y });
    else grid.set(key, [{ x, y }]);
  };

  const getNeighbors = (x: number, y: number): Array<{ x: number; y: number }> => {
    const cx = Math.floor(x / SPATIAL_CELL_PX);
    const cy = Math.floor(y / SPATIAL_CELL_PX);
    const out: Array<{ x: number; y: number }> = [];
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const bucket = grid.get(`${cx + dx}:${cy + dy}`);
        if (bucket) {
          for (const p of bucket) out.push(p);
        }
      }
    }
    return out;
  };

  const offsetLerp = reducedMotion ? 1 : Math.min(1, 14 * dt);

  for (const cand of sorted) {
    let st = stateMap.get(cand.id);
    if (!st) {
      st = createInitialSpring3DState(reducedMotion);
      stateMap.set(cand.id, st);
    }

    if (!cand.inBounds) {
      st.admitted = false;
      stepSpring3DState(st, dt, {
        admitted: false,
        hovered: false,
        reducedMotion,
      });
      results.push({
        id: cand.id,
        renderX: cand.anchorX + st.offsetX,
        renderY: cand.anchorY + st.offsetY,
        alpha: st.alpha,
        admitted: false,
        state: st,
      });
      continue;
    }

    let targetOffsetX = 0;
    let targetOffsetY = 0;
    let admitted = true;

    if (!cand.selected) {
      const neighbors = getNeighbors(cand.anchorX, cand.anchorY);
      let minDist = Infinity;
      let pushX = 0;
      let pushY = 0;

      for (const nb of neighbors) {
        const dx = cand.anchorX - nb.x;
        const dy = cand.anchorY - nb.y;
        const d = Math.hypot(dx, dy);
        if (d < minDist) minDist = d;

        // Soft repulsion zone: gently separate close objects within ±MAX_SOFT_REPULSION_PX
        if (d < enterPx && d > 0.001) {
          const strength = (enterPx - d) / enterPx;
          pushX += (dx / d) * strength * MAX_SOFT_REPULSION_PX;
          pushY += (dy / d) * strength * MAX_SOFT_REPULSION_PX;
        }
      }

      // Clamp soft repulsion vector so objects always stay visibly tied to their real geo anchor
      const pushLen = Math.hypot(pushX, pushY);
      if (pushLen > MAX_SOFT_REPULSION_PX) {
        const scale = MAX_SOFT_REPULSION_PX / pushLen;
        pushX *= scale;
        pushY *= scale;
      }

      // Check post-repulsion clearance against dual hysteresis thresholds
      const nudgedX = cand.anchorX + pushX;
      const nudgedY = cand.anchorY + pushY;
      let postMinDist = Infinity;
      for (const nb of neighbors) {
        const d = Math.hypot(nudgedX - nb.x, nudgedY - nb.y);
        if (d < postMinDist) postMinDist = d;
      }

      // Hysteresis: already-visible items hold until < exitPx; hidden items wait until >= enterPx
      const threshold = st.admitted ? exitPx : enterPx;
      if (postMinDist < threshold && minDist < threshold) {
        admitted = false;
      } else {
        targetOffsetX = pushX;
        targetOffsetY = pushY;
      }
    }

    st.admitted = admitted;
    st.offsetX += (targetOffsetX - st.offsetX) * offsetLerp;
    st.offsetY += (targetOffsetY - st.offsetY) * offsetLerp;

    const renderX = cand.anchorX + st.offsetX;
    const renderY = cand.anchorY + st.offsetY;

    if (admitted) {
      insertPlaced(renderX, renderY);
    }

    stepSpring3DState(st, dt, {
      admitted,
      hovered: hoveredId === cand.id,
      reducedMotion,
    });

    results.push({
      id: cand.id,
      renderX,
      renderY,
      alpha: st.alpha,
      admitted,
      state: st,
    });
  }

  return results;
}
