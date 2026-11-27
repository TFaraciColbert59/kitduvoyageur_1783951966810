import {
  MercatorCoordinate,
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MapLibreMap,
} from 'maplibre-gl';
import * as THREE from 'three';
import { prefersReducedMotion } from '@/components/map/engine/camera';
import {
  CLUB_DEFAULT_TERRAIN_EXAGGERATION,
  CLUB_GLOBE_SWITCH_ZOOM,
} from './createClub3DStyle';

export interface ClubThreePillarPoint {
  id: string;
  lng: number;
  lat: number;
  ele: number;
  color: string;
  heightM?: number;
}

export interface ClubThreePillarsController {
  layer: CustomLayerInterface;
  setPillars: (points: ClubThreePillarPoint[]) => void;
  setEnabled: (enabled: boolean) => void;
  isEnabled: () => boolean;
  dispose: () => void;
}

interface PillarMeshEntry {
  point: ClubThreePillarPoint;
  group: THREE.Group;
  haloMat: THREE.MeshBasicMaterial;
  ringMat: THREE.MeshBasicMaterial;
}

/**
 * Couche `Three.js` légère (`CustomLayerInterface`) élevant de fines colonnes
 * lumineuses translucides 3D au-dessus des points du *Story Bloom*.
 * Respecte `prefersReducedMotion()` et se désactive proprement sans fuite WebGL.
 */
export function createClubThreePillarsLayer(
  id = 'club-three-pillars',
): ClubThreePillarsController {
  let mapRef: MapLibreMap | null = null;
  let camera: THREE.Camera | null = null;
  let scene: THREE.Scene | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let sharedBeamGeo: THREE.CylinderGeometry | null = null;
  let sharedCoreGeo: THREE.CylinderGeometry | null = null;
  let sharedRingGeo: THREE.RingGeometry | null = null;
  let entries: PillarMeshEntry[] = [];
  let currentPoints: ClubThreePillarPoint[] = [];
  let enabled = true;
  const startMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const clearMeshes = () => {
    if (!scene) {
      entries = [];
      return;
    }
    for (const entry of entries) {
      scene.remove(entry.group);
      entry.haloMat.dispose();
      entry.ringMat.dispose();
      for (const child of entry.group.children) {
        const mesh = child as THREE.Mesh;
        if (mesh.material && mesh.material !== entry.haloMat && mesh.material !== entry.ringMat) {
          if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
          else mesh.material.dispose();
        }
      }
    }
    entries = [];
  };

  const rebuildMeshes = () => {
    clearMeshes();
    if (!scene || !sharedBeamGeo || !sharedCoreGeo || !sharedRingGeo) return;
    if (!enabled || currentPoints.length === 0) return;

    for (const pt of currentPoints) {
      const group = new THREE.Group();
      const threeColor = new THREE.Color(pt.color || '#f5c451');

      const haloMat = new THREE.MeshBasicMaterial({
        color: threeColor,
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const ringMat = new THREE.MeshBasicMaterial({
        color: threeColor,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const height = pt.heightM ?? 165;
      const beam = new THREE.Mesh(sharedBeamGeo, haloMat);
      beam.scale.set(1, 1, height);
      beam.position.set(0, 0, height * 0.5);

      const core = new THREE.Mesh(sharedCoreGeo, coreMat);
      core.scale.set(1, 1, height);
      core.position.set(0, 0, height * 0.5);

      const capRing = new THREE.Mesh(sharedRingGeo, ringMat);
      capRing.position.set(0, 0, height + 2);

      group.add(beam);
      group.add(core);
      group.add(capRing);
      scene.add(group);

      entries.push({ point: pt, group, haloMat, ringMat });
    }
  };

  const layer: CustomLayerInterface = {
    id,
    type: 'custom',
    renderingMode: '3d',
    onAdd(map, gl) {
      mapRef = map;
      camera = new THREE.Camera();
      scene = new THREE.Scene();

      // Cylindres de hauteur unitaire (1 m) orientés sur +Z (altitude MapLibre)
      sharedBeamGeo = new THREE.CylinderGeometry(3.2, 8.5, 1, 14, 1, true);
      sharedBeamGeo.rotateX(Math.PI / 2);

      sharedCoreGeo = new THREE.CylinderGeometry(1.1, 2.2, 1, 10, 1, true);
      sharedCoreGeo.rotateX(Math.PI / 2);

      sharedRingGeo = new THREE.RingGeometry(6, 13, 20);

      renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });
      renderer.autoClear = false;
      rebuildMeshes();
    },
    render(_gl, options: CustomRenderMethodInput) {
      if (!enabled || !mapRef || !renderer || !scene || !camera || entries.length === 0) return;
      if (mapRef.getZoom() < CLUB_GLOBE_SWITCH_ZOOM) return;

      const reduced = prefersReducedMotion();
      const elapsedSec = ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMs) / 1000;
      const terrainActive = Boolean(mapRef.getTerrain());
      const exag = terrainActive ? CLUB_DEFAULT_TERRAIN_EXAGGERATION : 1;

      const projectionMatrix = new THREE.Matrix4().fromArray(
        Array.from(options.modelViewProjectionMatrix),
      );
      const modelMatrix = new THREE.Matrix4();
      const scaleVec = new THREE.Vector3();

      renderer.resetState();

      for (let i = 0; i < entries.length; i += 1) {
        const entry = entries[i];
        const { point, group, haloMat, ringMat } = entry;
        const queriedEle = mapRef.queryTerrainElevation?.([point.lng, point.lat]);
        const groundEle =
          typeof queriedEle === 'number' && Number.isFinite(queriedEle)
            ? queriedEle
            : point.ele * exag;

        const merc = MercatorCoordinate.fromLngLat([point.lng, point.lat], groundEle);
        const sc = merc.meterInMercatorCoordinateUnits();

        if (!reduced) {
          const pulse = 0.72 + 0.28 * Math.sin(elapsedSec * 2.4 + i * 0.9);
          haloMat.opacity = 0.22 + 0.16 * pulse;
          ringMat.opacity = 0.55 + 0.35 * pulse;
        } else {
          haloMat.opacity = 0.3;
          ringMat.opacity = 0.78;
        }

        // Positionne le groupe à l'échelle métrique locale
        group.visible = true;
        for (const other of entries) {
          if (other !== entry) other.group.visible = false;
        }

        scaleVec.set(sc, -sc, sc);
        modelMatrix.makeTranslation(merc.x, merc.y, merc.z).scale(scaleVec);
        camera.projectionMatrix.copy(projectionMatrix).multiply(modelMatrix);

        renderer.render(scene, camera);
      }

      for (const entry of entries) entry.group.visible = true;
    },
    onRemove() {
      clearMeshes();
      sharedBeamGeo?.dispose();
      sharedCoreGeo?.dispose();
      sharedRingGeo?.dispose();
      sharedBeamGeo = null;
      sharedCoreGeo = null;
      sharedRingGeo = null;
      renderer?.dispose();
      renderer = null;
      scene = null;
      camera = null;
      mapRef = null;
    },
  };

  return {
    layer,
    setPillars(points: ClubThreePillarPoint[]) {
      currentPoints = points.slice(0, 18);
      rebuildMeshes();
      mapRef?.triggerRepaint();
    },
    setEnabled(next: boolean) {
      enabled = next;
      rebuildMeshes();
      mapRef?.triggerRepaint();
    },
    isEnabled() {
      return enabled;
    },
    dispose() {
      clearMeshes();
      sharedBeamGeo?.dispose();
      sharedCoreGeo?.dispose();
      sharedRingGeo?.dispose();
      renderer?.dispose();
      sharedBeamGeo = null;
      sharedCoreGeo = null;
      sharedRingGeo = null;
      renderer = null;
      scene = null;
      camera = null;
      mapRef = null;
    },
  };
}
