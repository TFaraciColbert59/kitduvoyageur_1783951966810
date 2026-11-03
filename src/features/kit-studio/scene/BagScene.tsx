'use client';

/**
 * src/features/kit-studio/scene/BagScene.tsx
 * Interactive Three.js 3D backpack viewport under WebGLArbiter (Lot L5-3).
 *
 * Invariants:
 * - Zero literal hex colors (uses CSS custom properties & rgb(...) values).
 * - Single WebGL context via WebGLArbiter.acquire('bag-scene') (C-04).
 * - Canvas & WebGLRenderer persist across part customizations & badge/item mutations (D-05).
 * - Pauses RAF render loop when hidden, offscreen, or covered by opaque drawer (C-17).
 * - Disposes all Three.js geometries, materials, and renderer cleanly on unmount (C-16).
 * - Persistent >= 44px "Recentrer le sac" control in all states (C-09, G-01).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import * as THREE from 'three';
import { WebGLArbiter } from '@/features/hub/webgl/WebGLArbiter';
import type {
  BagCapabilities,
  KitConfiguration,
  PartId,
  SlotState,
} from '../state/types';
import { loadBagAsset, type LoadedBagScene } from './bag/loader';
import { applyAllCustomizations, resolveTokenToThreeColor } from './bag/materials';
import {
  getPartLabel,
  manifestSlotsToSlotStates,
  type BagManifest,
} from './bag/parts';
import { sphericalPoseToPosition } from './camera/framing';
import type { BoundingBoxM, CameraIntent, CameraStateId } from './camera/intents';
import { CameraStateMachine } from './camera/machine';
import { BagGestureController } from './gestures';
import { QualityGovernor } from './quality';

export interface BadgeCatalogMeta {
  id: string;
  label: string;
  kind: 'trophy' | 'patch';
  colorToken?: string;
}

export interface BagSceneProps {
  config: KitConfiguration;
  focusedPartId?: PartId | null;
  activeDrawerOpen?: boolean;
  isCoveredByOpaqueSheet?: boolean;
  isUiGestureActive?: () => boolean;
  badgeCatalog?: ReadonlyMap<string, BadgeCatalogMeta>;
  readOnly?: boolean;
  onSelectPart?: (partId: PartId) => void;
  onManifestLoaded?: (manifest: BagManifest, slots: SlotState[], capabilities: BagCapabilities) => void;
  onDegraded?: (reason: string) => void;
  externalIntent?: { nonce: number; intent: CameraIntent } | null;
}

export function BagScene({
  config,
  focusedPartId = null,
  isCoveredByOpaqueSheet = false,
  isUiGestureActive,
  badgeCatalog,
  onSelectPart,
  onManifestLoaded,
  onDegraded,
  externalIntent,
}: BagSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const loadedBagRef = useRef<LoadedBagScene | null>(null);
  const lidBaseTransformRef = useRef<
    Map<PartId, { pos: THREE.Vector3; quat: THREE.Quaternion }>
  >(new Map());
  const overlayGroupRef = useRef<THREE.Group | null>(null);

  const cameraMachineRef = useRef<CameraStateMachine | null>(null);
  if (!cameraMachineRef.current) {
    const prefersReduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    cameraMachineRef.current = new CameraStateMachine({
      reducedMotion: prefersReduced,
    });
  }

  const qualityRef = useRef<QualityGovernor>(new QualityGovernor());
  const bboxRef = useRef<BoundingBoxM>({ w: 0.36, h: 0.68, d: 0.28 });

  const [cameraState, setCameraState] = useState<CameraStateId>(() =>
    cameraMachineRef.current!.getSnapshot().state
  );
  const [bagLabel, setBagLabel] = useState<string>('Sac à dos');
  const [isVisibleInViewport, setIsVisibleInViewport] = useState<boolean>(true);
  const [isDocumentVisible, setIsDocumentVisible] = useState<boolean>(true);
  const [canvasEpoch, setCanvasEpoch] = useState<number>(0);
  const [restoreNonce, setRestoreNonce] = useState<number>(0);
  const [renderPaused, setRenderPaused] = useState<boolean>(false);

  const syncCameraToThree = useCallback(() => {
    const cam = cameraRef.current;
    const machine = cameraMachineRef.current;
    if (!cam || !machine) return;

    const snap = machine.getSnapshot();
    const [cx, cy, cz] = sphericalPoseToPosition(snap.currentPose);
    cam.position.set(cx, cy, cz);
    cam.up.set(0, 1, 0); // C-10: zero roll, horizon strictly level
    cam.lookAt(
      snap.currentPose.target[0],
      snap.currentPose.target[1],
      snap.currentPose.target[2]
    );

    const bag = loadedBagRef.current;
    if (bag) {
      const interiorMesh = bag.parts.get('interior');
      if (interiorMesh) {
        interiorMesh.visible = snap.bagOpen || snap.lidAngleRad > 0.06;
      }

      for (const [partId, hinge] of bag.hinges.entries()) {
        const mesh = bag.parts.get(partId);
        const base = lidBaseTransformRef.current.get(partId);
        if (!mesh || !base) continue;

        const pivot = new THREE.Vector3(hinge.pivot[0], hinge.pivot[1], hinge.pivot[2]);
        const axis = new THREE.Vector3(hinge.axis[0], hinge.axis[1], hinge.axis[2]).normalize();
        const rotQuat = new THREE.Quaternion().setFromAxisAngle(axis, -snap.lidAngleRad);

        const offset = base.pos.clone().sub(pivot).applyQuaternion(rotQuat);
        mesh.position.copy(pivot).add(offset);
        mesh.quaternion.copy(rotQuat).multiply(base.quat);
      }
    }
  }, []);

  // 1. Écoute prefers-reduced-motion & batterie faible (D-24)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => {
      const snap = cameraMachineRef.current?.dispatch({
        kind: 'set-reduced-motion',
        enabled: mq.matches,
        timestampMs: performance.now(),
      });
      if (snap) setCameraState(snap.state);
    };
    mq.addEventListener?.('change', onChange);

    if (typeof (navigator as any).getBattery === 'function') {
      (navigator as any)
        .getBattery()
        .then((bat: any) => {
          const updateBattery = () => {
            qualityRef.current.setBatteryStatus({
              level: typeof bat.level === 'number' ? bat.level : 1,
              charging: Boolean(bat.charging),
            });
          };
          updateBattery();
          bat.addEventListener?.('levelchange', updateBattery);
          bat.addEventListener?.('chargingchange', updateBattery);
        })
        .catch(() => {});
    }

    return () => {
      mq.removeEventListener?.('change', onChange);
    };
  }, []);

  // 2. Détection visibilité onglet & hors-écran (C-17)
  useEffect(() => {
    const arbiter = WebGLArbiter.getInstance();
    const onVis = () => {
      const visible = document.visibilityState !== 'hidden';
      setIsDocumentVisible(visible);
      arbiter.setPaused(!visible, { releaseAfterTimeout: !visible });
    };
    document.addEventListener('visibilitychange', onVis);

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined' && containerRef.current) {
      io = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry) {
            setIsVisibleInViewport(entry.isIntersecting);
          }
        },
        { threshold: 0.01 }
      );
      io.observe(containerRef.current);
    }

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      io?.disconnect();
    };
  }, []);

  // 3. Initialisation unique du contexte WebGL Three.js sous WebGLArbiter (C-04, C-16, C-18, D-05)
  useEffect(() => {
    const arbiter = WebGLArbiter.getInstance();
    if (arbiter.isContextDegraded()) {
      onDegraded?.('Accélération 3D suspendue sur cet appareil');
      return;
    }

    let cancelled = false;
    let unregisterRelease: (() => void) | null = null;
    let unregisterRestore: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const disposeOverlayGroup = (group: THREE.Group | null) => {
      if (!group) return;
      group.traverse((child: any) => {
        if (child.isMesh) {
          child.geometry?.dispose?.();
          if (Array.isArray(child.material)) {
            child.material.forEach((m: any) => m.dispose?.());
          } else {
            child.material?.dispose?.();
          }
        }
      });
      group.clear();
    };

    const cleanupRenderer = () => {
      if (loadedBagRef.current) {
        loadedBagRef.current.dispose();
        loadedBagRef.current = null;
      }
      disposeOverlayGroup(overlayGroupRef.current);
      overlayGroupRef.current = null;

      if (sceneRef.current) {
        sceneRef.current.clear();
        sceneRef.current = null;
      }
      if (rendererRef.current) {
        try {
          const dom = rendererRef.current.domElement;
          rendererRef.current.dispose();
          dom?.parentNode?.removeChild(dom);
        } catch {
          // ignore cleanup errors
        }
        rendererRef.current = null;
      }
      cameraRef.current = null;
    };

    async function bootWebGL() {
      await arbiter.acquire('bag-scene');
      if (cancelled || !canvasHostRef.current) return;

      unregisterRelease = arbiter.registerReleaseHandler('bag-scene', () => {
        cleanupRenderer();
      });

      unregisterRestore = arbiter.registerRestoreHandler('bag-scene', () => {
        if (cancelled) return false;
        cleanupRenderer();
        setRestoreNonce((n) => n + 1);
        return true;
      });

      try {
        const host = canvasHostRef.current;
        const width = Math.max(240, host.clientWidth || 360);
        const height = Math.max(240, host.clientHeight || 420);

        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        });
        const dpr = qualityRef.current.resolveEffectiveDpr(window.devicePixelRatio || 1);
        renderer.setPixelRatio(dpr);
        renderer.setSize(width, height, false);
        renderer.shadowMap.enabled = qualityRef.current.getProfile().shadowsEnabled;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        const canvas = renderer.domElement;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';
        canvas.style.touchAction = 'none';
        canvas.setAttribute('data-testid', 'kit-studio-webgl-canvas');

        canvas.addEventListener('webglcontextlost', (ev) => {
          ev.preventDefault();
          const willRestore = arbiter.triggerContextLost();
          if (!willRestore) {
            onDegraded?.('Contexte graphique libéré par le système');
          }
        });
        canvas.addEventListener('webglcontextrestored', () => {
          arbiter.notifyContextRestored();
        });

        host.innerHTML = '';
        host.appendChild(canvas);

        const scene = new THREE.Scene();

        // Éclairage 3 points doux naturel (zéro littéral hex : couleurs via setRGB)
        const hemi = new THREE.HemisphereLight(
          new THREE.Color().setRGB(0.96, 0.97, 0.95),
          new THREE.Color().setRGB(0.22, 0.28, 0.24),
          1.15
        );
        scene.add(hemi);

        const keyLight = new THREE.DirectionalLight(
          new THREE.Color().setRGB(1.0, 0.98, 0.94),
          1.35
        );
        keyLight.position.set(1.4, 2.2, 1.8);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 512;
        keyLight.shadow.mapSize.height = 512;
        scene.add(keyLight);

        const rimLight = new THREE.DirectionalLight(
          new THREE.Color().setRGB(0.82, 0.91, 0.86),
          0.55
        );
        rimLight.position.set(-1.5, 1.1, -1.4);
        scene.add(rimLight);

        // Sol d'atelier discret
        const floorGeo = new THREE.CircleGeometry(0.62, 36);
        floorGeo.rotateX(-Math.PI / 2);
        const floorMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color().setRGB(0.86, 0.89, 0.85),
          roughness: 0.96,
          metalness: 0.0,
          transparent: true,
          opacity: 0.55,
        });
        const floorMesh = new THREE.Mesh(floorGeo, floorMat);
        floorMesh.position.set(0, -0.002, 0);
        floorMesh.receiveShadow = true;
        floorMesh.name = 'studio-floor';
        scene.add(floorMesh);

        const overlayGroup = new THREE.Group();
        overlayGroup.name = 'bag-overlays';
        scene.add(overlayGroup);

        const camera = new THREE.PerspectiveCamera(40, width / height, 0.05, 18);

        rendererRef.current = renderer;
        sceneRef.current = scene;
        cameraRef.current = camera;
        overlayGroupRef.current = overlayGroup;
        setCanvasEpoch((e) => e + 1);

        syncCameraToThree();
        renderer.render(scene, camera);

        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry || !rendererRef.current || !cameraRef.current) return;
            const w = Math.max(120, entry.contentRect.width);
            const h = Math.max(120, entry.contentRect.height);
            cameraRef.current.aspect = w / h;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setPixelRatio(
              qualityRef.current.resolveEffectiveDpr(window.devicePixelRatio || 1)
            );
            rendererRef.current.setSize(w, h, false);
          });
          resizeObserver.observe(host);
        }
      } catch (err: any) {
        cleanupRenderer();
        onDegraded?.(err?.message || 'WebGL non disponible sur ce navigateur');
      }
    }

    bootWebGL();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      unregisterRelease?.();
      unregisterRestore?.();
      cleanupRenderer();
      arbiter.release('bag-scene');
    };
  }, [onDegraded, restoreNonce, syncCameraToThree]);

  // 4. Chargement du modèle GLB lorsque `config.bag.modelId` change (SANS détruire le canvas, D-05)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || canvasEpoch === 0) return;

    let cancelled = false;

    async function mountBagModel() {
      if (loadedBagRef.current) {
        scene!.remove(loadedBagRef.current.root);
        loadedBagRef.current.dispose();
        loadedBagRef.current = null;
        lidBaseTransformRef.current.clear();
      }

      const result = await loadBagAsset(config.bag.modelId);
      if (cancelled) {
        result.dispose();
        return;
      }

      if (result.status === 'degraded') {
        onDegraded?.(result.reason);
        return;
      }

      loadedBagRef.current = result;
      bboxRef.current = result.manifest.boundingBoxM;
      setBagLabel(result.manifest.label);

      lidBaseTransformRef.current.clear();
      for (const [partId] of result.hinges.entries()) {
        const mesh = result.parts.get(partId);
        if (mesh) {
          lidBaseTransformRef.current.set(partId, {
            pos: mesh.position.clone(),
            quat: mesh.quaternion.clone(),
          });
        }
      }

      const firstHinge = Array.from(result.hinges.values())[0];
      const snap = cameraMachineRef.current!.setBagContext(result.manifest.boundingBoxM, {
        openable: result.capabilities.openable,
        hasInterior: result.capabilities.hasInterior,
        maxHingeAngleRad: firstHinge?.maxAngleRad ?? 1.5,
      });
      setCameraState(snap.state);

      applyAllCustomizations(result.parts, config.bag.parts);
      scene!.add(result.root);
      syncCameraToThree();

      onManifestLoaded?.(
        result.manifest,
        manifestSlotsToSlotStates(result.manifest),
        result.capabilities
      );
    }

    mountBagModel();

    return () => {
      cancelled = true;
    };
    // Intentionnellement déclenché uniquement sur changement de modelId ou réinitialisation canvas (D-05)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.bag.modelId, canvasEpoch]);

  // 5. Personnalisation en place des pièces (D-04, D-05 : zéro rechargement de scène ni de modèle)
  useEffect(() => {
    const bag = loadedBagRef.current;
    if (!bag) return;
    applyAllCustomizations(bag.parts, config.bag.parts);
  }, [config.bag.parts, canvasEpoch]);

  // 6. Rendu 3D des insignes épinglés (trophées métalliques vs patchs textiles, F-09) et objets visuels (C-14)
  useEffect(() => {
    const bag = loadedBagRef.current;
    const overlayGroup = overlayGroupRef.current;
    if (!bag || !overlayGroup) return;

    // Nettoyage propre des anciens maillages d'overlay
    overlayGroup.traverse((child: any) => {
      if (child.isMesh) {
        child.geometry?.dispose?.();
        child.material?.dispose?.();
      }
    });
    overlayGroup.clear();

    // A) Insignes épinglés sur ancres valides (F-09, F-10)
    for (const placed of config.placedBadges) {
      if (!bag.capabilities.badgeAnchors.includes(placed.anchorId)) continue;
      const anchor = bag.anchors.get(placed.anchorId);
      if (!anchor) continue;

      const meta = badgeCatalog?.get(placed.badgeId);
      const isTrophy = meta?.kind === 'trophy' || placed.badgeId.startsWith('trophy');
      const radius = 0.026 * Math.max(0.5, Math.min(3.0, placed.scale || 1));

      // Distinction géométrique & matérielle explicite (F-09) :
      // Trophée = médaillon hexagonal biseauté métallique ; Patch = écusson circulaire textile cousu
      const geo = isTrophy
        ? new THREE.CylinderGeometry(radius, radius * 0.92, 0.006, 6)
        : new THREE.CylinderGeometry(radius, radius, 0.003, 24);
      geo.rotateX(Math.PI / 2);

      const resolvedColor =
        resolveTokenToThreeColor(meta?.colorToken) ??
        (isTrophy
          ? new THREE.Color().setRGB(0.78, 0.61, 0.24)
          : new THREE.Color().setRGB(0.21, 0.44, 0.33));

      const mat = new THREE.MeshStandardMaterial({
        color: resolvedColor,
        roughness: isTrophy ? 0.28 : 0.9,
        metalness: isTrophy ? 0.68 : 0.02,
      });

      const badgeMesh = new THREE.Mesh(geo, mat);
      badgeMesh.name = `placed-badge:${placed.id}`;
      badgeMesh.userData = {
        placedBadgeId: placed.id,
        badgeKind: isTrophy ? 'trophy' : 'patch',
      };

      const normal = new THREE.Vector3(anchor.normal[0], anchor.normal[1], anchor.normal[2]).normalize();
      badgeMesh.position.set(
        anchor.position[0] + normal.x * 0.008,
        anchor.position[1] + normal.y * 0.008,
        anchor.position[2] + normal.z * 0.008
      );
      badgeMesh.lookAt(
        badgeMesh.position.x + normal.x,
        badgeMesh.position.y + normal.y,
        badgeMesh.position.z + normal.z
      );

      overlayGroup.add(badgeMesh);
    }

    // B) Objets possédant une représentation visuelle 3D (C-14 : visual === null -> aucun maillage 3D)
    config.items.forEach((item, index) => {
      if (!item.visual || !item.slotId) return;
      const anchor = bag.anchors.get(item.slotId);
      if (!anchor) return;
      if (item.slotId.startsWith('interior') && !bag.capabilities.hasInterior) return;

      const [sx, sy, sz] = item.visual.scale ?? [0.06, 0.045, 0.06];
      const geo = new THREE.BoxGeometry(sx, sy, sz);
      const col =
        resolveTokenToThreeColor(item.visual.color) ??
        new THREE.Color().setRGB(0.36, 0.5, 0.42);
      const mat = new THREE.MeshStandardMaterial({
        color: col,
        roughness: 0.8,
        metalness: 0.04,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = `item-visual:${item.id}`;
      const stackOffset = ((item.slotOrder ?? index) % 5) * 0.032;
      mesh.position.set(
        anchor.position[0],
        anchor.position[1] + stackOffset,
        anchor.position[2]
      );
      overlayGroup.add(mesh);
    });
  }, [config.placedBadges, config.items, badgeCatalog, canvasEpoch]);

  // 7. Intentions caméra pilotées par la pièce focalisée ou par événement externe
  useEffect(() => {
    const machine = cameraMachineRef.current;
    const bag = loadedBagRef.current;
    if (!machine) return;

    if (focusedPartId) {
      const anchor = bag?.anchors.get(`badge-${focusedPartId}`);
      const snap = machine.dispatch({
        kind: 'focus-part',
        partId: focusedPartId,
        anchor: anchor?.position,
        normal: anchor?.normal,
        timestampMs: performance.now(),
      });
      setCameraState(snap.state);
      syncCameraToThree();
    }
  }, [focusedPartId, syncCameraToThree]);

  useEffect(() => {
    if (!externalIntent || !cameraMachineRef.current) return;
    const snap = cameraMachineRef.current.dispatch({
      ...externalIntent.intent,
      timestampMs: performance.now(),
    });
    setCameraState(snap.state);
    syncCameraToThree();
  }, [externalIntent, syncCameraToThree]);

  // 8. Contrôleur de gestes bornés (C-10, C-12)
  const gestureController = useMemo(
    () =>
      new BagGestureController({
        getPose: () => cameraMachineRef.current!.getSnapshot().currentPose,
        getBBox: () => bboxRef.current,
        isUiGestureActive,
        onPoseGesture: (nextPose) => {
          const snap = cameraMachineRef.current!.dispatch({
            kind: 'user-gesture',
            azimuthRad: nextPose.azimuthRad,
            elevationRad: nextPose.elevationRad,
            distanceM: nextPose.distanceM,
            timestampMs: performance.now(),
          });
          setCameraState(snap.state);
          syncCameraToThree();
        },
      }),
    [isUiGestureActive, syncCameraToThree]
  );

  // 9. Boucle d'animation RAF avec mise en pause automatique hors écran / arrière-plan (C-17, C-19)
  const shouldPauseLoop = !isDocumentVisible || !isVisibleInViewport || isCoveredByOpaqueSheet;

  useEffect(() => {
    setRenderPaused(shouldPauseLoop);
    if (shouldPauseLoop) return;

    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.max(0, now - lastTime);
      lastTime = now;

      const machine = cameraMachineRef.current;
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;

      if (machine && renderer && scene && camera) {
        const prevState = machine.getSnapshot().state;
        const nextSnap = machine.step(dt);
        if (nextSnap.state !== prevState) {
          setCameraState(nextSnap.state);
        }

        syncCameraToThree();
        renderer.render(scene, camera);

        const { degradedStep, profile } = qualityRef.current.recordFrameTime(dt);
        if (degradedStep) {
          renderer.setPixelRatio(
            qualityRef.current.resolveEffectiveDpr(window.devicePixelRatio || 1)
          );
          renderer.shadowMap.enabled = profile.shadowsEnabled;
          if (profile.degradedToList) {
            onDegraded?.('Cadence d’affichage insuffisante : passage en vue Liste');
            return;
          }
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [shouldPauseLoop, onDegraded, syncCameraToThree, canvasEpoch]);

  const handleRecenter = useCallback(() => {
    const machine = cameraMachineRef.current;
    if (!machine) return;
    const snap = machine.dispatch({
      kind: 'recenter',
      timestampMs: performance.now(),
    });
    setCameraState(snap.state);
    syncCameraToThree();
  }, [syncCameraToThree]);

  const handleCanvasTapSelectPart = useCallback(
    (ev: React.MouseEvent<HTMLDivElement>) => {
      if (!onSelectPart || !rendererRef.current || !cameraRef.current || !loadedBagRef.current) {
        return;
      }
      const rect = rendererRef.current.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const ndc = new THREE.Vector2(
        ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        -((ev.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(ndc, cameraRef.current);
      const meshes = Array.from(loadedBagRef.current.parts.values()).filter((m) => m.visible);
      const hits = raycaster.intersectObjects(meshes, false);
      if (hits.length > 0 && hits[0].object.name) {
        onSelectPart(hits[0].object.name);
      }
    },
    [onSelectPart]
  );

  return (
    <div
      ref={containerRef}
      data-testid="kit-studio-bag-scene"
      data-camera-state={cameraState}
      data-canvas-epoch={canvasEpoch}
      data-render-paused={renderPaused ? 'true' : 'false'}
      role="region"
      aria-label={`Scène 3D interactive : ${bagLabel}`}
      className="relative w-full h-full min-h-[280px] select-none overflow-hidden bg-transparent"
      onPointerDown={(e) => {
        gestureController.handlePointerDown({
          pointerId: e.pointerId,
          clientX: e.clientX,
          clientY: e.clientY,
          target: e.target,
          button: e.button,
        });
      }}
      onPointerMove={(e) => {
        gestureController.handlePointerMove({
          pointerId: e.pointerId,
          clientX: e.clientX,
          clientY: e.clientY,
        });
      }}
      onPointerUp={(e) => gestureController.handlePointerUpOrCancel(e.pointerId)}
      onPointerCancel={(e) => gestureController.handlePointerUpOrCancel(e.pointerId)}
      onWheel={(e) => {
        gestureController.handleWheel({
          deltaY: e.deltaY,
          target: e.target,
        });
      }}
      onDoubleClick={handleCanvasTapSelectPart}
    >
      <div ref={canvasHostRef} className="w-full h-full min-h-[280px]" />

      {/* Description textuelle accessible pour lecteur d'écran (G-04) */}
      <div className="sr-only" aria-live="polite">
        {bagLabel}. État caméra : {cameraState}.
        {focusedPartId ? ` Pièce sélectionnée : ${getPartLabel(focusedPartId)}.` : ''}
      </div>

      {/* Bouton persistant « Recentrer le sac » >= 44x44px disponible dans tous les états (C-09, G-01) */}
      <div
        data-studio-ui="true"
        className="absolute top-3 right-3 z-10 flex items-center gap-2"
      >
        <button
          type="button"
          data-testid="studio-recenter-btn"
          onClick={handleRecenter}
          aria-label="Recentrer le sac"
          className="min-h-[44px] min-w-[44px] px-3.5 rounded-full bg-[var(--hub-surface-card)] border border-[var(--hub-border)] text-[var(--hub-primary)] text-xs font-semibold flex items-center gap-1.5 transition-transform active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)]"
          style={{
            boxShadow: '0 4px 16px rgba(11, 31, 23, 0.12)',
          }}
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          <span>Recentrer le sac</span>
        </button>
      </div>
    </div>
  );
}
