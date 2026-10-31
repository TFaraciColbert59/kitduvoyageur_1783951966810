// @vitest-environment jsdom
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  clampCameraPose,
  computeMinSafeDistanceM,
  DEFAULT_BAG_BBOX,
  MIN_GROUND_CLEARANCE_M,
  sphericalPoseToPosition,
} from '../scene/camera/framing';
import { ALL_CAMERA_STATES } from '../scene/camera/intents';
import { CameraStateMachine } from '../scene/camera/machine';
import { BagGestureController } from '../scene/gestures';

describe('CameraStateMachine & Framing (Lot L5-1 / B-07 / C-06..C-14)', () => {
  it('garantit que camera/{intents,framing,machine}.ts sont 100 % purs (zéro import React ou Three.js)', () => {
    const dir = path.join(
      process.cwd(),
      'src',
      'features',
      'kit-studio',
      'scene',
      'camera'
    );
    for (const file of ['intents.ts', 'framing.ts', 'machine.ts']) {
      const src = fs.readFileSync(path.join(dir, file), 'utf8');
      expect(src).not.toMatch(/from\s+['"]three['"]/);
      expect(src).not.toMatch(/from\s+['"]react['"]/);
    }
  });

  it('C-06 : un geste utilisateur interrompt immédiatement (< 1 frame) toute animation en cours vers MANUAL', () => {
    const machine = new CameraStateMachine();
    machine.dispatch({ kind: 'open-and-place', timestampMs: 10 });
    expect(machine.getSnapshot().state).toBe('OPENING');
    expect(machine.getSnapshot().transition).not.toBeNull();

    // Avance de 120 ms au milieu de l'animation
    machine.step(120);
    expect(machine.getSnapshot().state).toBe('OPENING');

    // Geste utilisateur : bascule synchrone immédiate sans attendre la fin du tween
    const snap = machine.dispatch({
      kind: 'user-gesture',
      azimuthRad: 1.1,
      elevationRad: 0.3,
      distanceM: 1.4,
      timestampMs: 130,
    });
    expect(snap.state).toBe('MANUAL');
    expect(snap.transition).toBeNull();
  });

  it('C-07 : 3 ajouts rapides en 300 ms déclenchent exactement 1 seule transition OPENING (zéro file)', () => {
    const machine = new CameraStateMachine();

    machine.dispatch({ kind: 'open-and-place', timestampMs: 0 });
    machine.step(80);
    machine.dispatch({ kind: 'open-and-place', timestampMs: 80 });
    machine.step(100);
    machine.dispatch({ kind: 'open-and-place', timestampMs: 180 });

    const snap = machine.getSnapshot();
    expect(snap.openingCount).toBe(1);
    expect(snap.placementPulseCount).toBe(3);
    expect(snap.state).toBe('OPENING');

    // Achève la montée unique -> INSIDE
    machine.step(500);
    expect(machine.getSnapshot().state).toBe('INSIDE');
    expect(machine.getSnapshot().openingCount).toBe(1);
  });

  it('C-08 : sac déjà ouvert (INSIDE) ne rejoue jamais une 2e séquence OPENING', () => {
    const machine = new CameraStateMachine();
    machine.dispatch({ kind: 'open-and-place', timestampMs: 0 });
    machine.step(600);
    expect(machine.getSnapshot().state).toBe('INSIDE');
    expect(machine.getSnapshot().openingCount).toBe(1);

    // Second ajout alors que le sac est déjà en INSIDE
    const afterSecond = machine.dispatch({ kind: 'open-and-place', timestampMs: 1000 });
    expect(afterSecond.state).toBe('INSIDE');
    expect(afterSecond.openingCount).toBe(1);
    expect(afterSecond.transition).toBeNull();
  });

  it.each(ALL_CAMERA_STATES)(
    'C-09 : « Recentrer » depuis l état %s ramène toujours à OVERVIEW',
    (initialState) => {
      const machine = new CameraStateMachine({ initialState });
      expect(machine.getSnapshot().state).toBe(initialState);

      machine.dispatch({ kind: 'recenter', timestampMs: 500 });
      machine.step(500);

      expect(machine.getSnapshot().state).toBe('OVERVIEW');
      expect(machine.getSnapshot().bagOpen).toBe(false);
      expect(machine.getSnapshot().lidAngleRad).toBe(0);
    }
  );

  it('B-07 : la fermeture d un drawer referme le sac avec la transition CLOSING -> OVERVIEW', () => {
    const machine = new CameraStateMachine();
    machine.dispatch({ kind: 'open-and-place', timestampMs: 0 });
    machine.step(600);
    expect(machine.getSnapshot().state).toBe('INSIDE');

    const closing = machine.dispatch({ kind: 'close-bag', timestampMs: 700 });
    expect(closing.state).toBe('CLOSING');

    const done = machine.step(450);
    expect(done.state).toBe('OVERVIEW');
    expect(done.lidAngleRad).toBe(0);
    expect(done.bagOpen).toBe(false);
  });

  it('C-10 & C-11 : respecte la distance minimale anti-collision, le plan du sol (y >= 0.04m) et le roulis nul', () => {
    const minDist = computeMinSafeDistanceM(DEFAULT_BAG_BBOX);
    const clamped = clampCameraPose(
      {
        target: [0, 0.2, 0],
        azimuthRad: 4.5,
        elevationRad: -1.5, // tenterait de plonger sous le sol
        distanceM: 0.01, // tenterait de traverser le maillage
      },
      DEFAULT_BAG_BBOX
    );

    expect(clamped.distanceM).toBeGreaterThanOrEqual(minDist);
    expect(clamped.rollRad).toBe(0);

    const pos = sphericalPoseToPosition(clamped);
    expect(pos[1]).toBeGreaterThanOrEqual(MIN_GROUND_CLEARANCE_M - 1e-6);
  });

  it('C-13 & C-14 : openable: false ou visual: null ne déclenche aucune ouverture simulée', () => {
    const duffelMachine = new CameraStateMachine({
      capabilities: { openable: false, hasInterior: false },
    });

    const snap = duffelMachine.dispatch({ kind: 'open-and-place', timestampMs: 10 });
    expect(snap.state).toBe('OVERVIEW');
    expect(snap.openingCount).toBe(0);
    expect(snap.lidAngleRad).toBe(0);

    // Objet non représentable (hasVisual: false) sur sac ouvrable fermé : pas d'animation
    const trekkerMachine = new CameraStateMachine({
      capabilities: { openable: true, hasInterior: true },
    });
    const noVisual = trekkerMachine.dispatch({
      kind: 'open-and-place',
      hasVisual: false,
      timestampMs: 20,
    });
    expect(noVisual.state).toBe('OVERVIEW');
    expect(noVisual.openingCount).toBe(0);
  });

  it('C-12 : BagGestureController résout les 4 cas de conflit de gestes entre tiroirs et orbite 3D', () => {
    let pose = clampCameraPose({
      target: [0, 0.34, 0],
      azimuthRad: 0.3,
      elevationRad: 0.2,
      distanceM: 1.2,
    });
    let uiDragging = false;

    const controller = new BagGestureController({
      getPose: () => pose,
      isUiGestureActive: () => uiDragging,
      onPoseGesture: (next) => {
        pose = next;
      },
    });

    // Cas 1 : Geste démarrant sur un tiroir ou bouton UI -> ignoré par la scène 3D
    const drawerEl = document.createElement('div');
    drawerEl.setAttribute('data-drawer-surface', 'true');
    const childBtn = document.createElement('span');
    drawerEl.appendChild(childBtn);

    expect(
      controller.handlePointerDown({
        pointerId: 1,
        clientX: 100,
        clientY: 200,
        target: childBtn,
      })
    ).toBe(false);
    expect(controller.getActivePointerCount()).toBe(0);

    // Cas 2 : Geste sur le canvas interrompu par un glissement actif de tiroir -> annulé proprement
    const canvasEl = document.createElement('canvas');
    expect(
      controller.handlePointerDown({
        pointerId: 2,
        clientX: 150,
        clientY: 150,
        target: canvasEl,
      })
    ).toBe(true);
    expect(controller.getActivePointerCount()).toBe(1);

    uiDragging = true;
    expect(
      controller.handlePointerMove({ pointerId: 2, clientX: 180, clientY: 160 })
    ).toBe(false);
    expect(controller.getActivePointerCount()).toBe(0);
    uiDragging = false;

    // Cas 3 : Orbite 1 doigt -> passage en pincement 2 doigts (zoom) sans saut ni traversée
    controller.handlePointerDown({ pointerId: 10, clientX: 100, clientY: 100, target: canvasEl });
    controller.handlePointerDown({ pointerId: 11, clientX: 200, clientY: 100, target: canvasEl });
    expect(controller.getActivePointerCount()).toBe(2);
    const distBefore = pose.distanceM;
    // Écarte les deux doigts -> rapproche la caméra (zoom in) tout en respectant minDist
    controller.handlePointerMove({ pointerId: 11, clientX: 300, clientY: 100 });
    expect(pose.distanceM).toBeLessThan(distBefore);
    expect(pose.distanceM).toBeGreaterThanOrEqual(computeMinSafeDistanceM(DEFAULT_BAG_BBOX));

    // Cas 4 : pointercancel nettoie tous les doigts actifs (zéro doigt fantôme)
    controller.handlePointerUpOrCancel(10);
    controller.handlePointerUpOrCancel(11);
    expect(controller.getActivePointerCount()).toBe(0);
  });
});
