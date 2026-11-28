/**
 * Explorer v2 — Three.js Neopolis-Style Floating 3D Diorama Overlay Renderer.
 *
 * Renders true hardware-accelerated Three.js (`three@0.186.0`) procedural 3D models
 * floating above MapLibre's 3D topographic terrain on a dedicated, isolated transparent
 * WebGL overlay canvas synced 1:1 with `map.project([lng, lat])`, `map.getPitch()`,
 * and `map.getZoom()`.
 *
 * Motion, Collision & VFX Architecture:
 * - Zero-flicker O(N) spatial-hash collision avoidance (`collision3D.ts`) with soft
 *   spring-damped repulsion (±26 px), priority hierarchy, dual-threshold hysteresis,
 *   and continuous visibility alpha fade (zero binary pop/flicker on pan or zoom).
 * - Underdamped Hooke spring physics: elastic pop-in overshoot, pointer hover magnetic
 *   lift, Disney squash-and-stretch + upward leap + celebratory spin burst on tap.
 * - Zero-GC pooled 3D WebGL impact VFX: dual isometric expanding ground shockwave rings
 *   and 24 sparkling 3D octahedron particles anchored to real world coordinates.
 * - Living archetype micro-animations: drifting chalet chimney smoke, orbiting aqua
 *   droplet, counter-rotating Pokédex gold orbital ring, flickering fire core, swaying
 *   message bottle, and pulsing summit halo.
 * - Mesh diffing: unchanged item sets keep live WebGL meshes & spring states intact.
 * - Deterministic GPU pause & clear on `GPS_ACTIVE`/`SOS` and full disposal on unmount.
 */

import type { Map as MapLibreMap } from 'maplibre-gl';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  solve3DCollisions,
  priorityFor3DEntity,
  triggerTapJuice,
  type Collision3DCandidate,
  type Spring3DState,
} from './collision3D';
import {
  createExplorerGlbRegistry,
  type ExplorerGlbRegistry,
} from './glbModelRegistry';
import { categoryPriorityBonus } from '../data/spatialLoader';
import {
  adaptiveCollisionSpacing,
  resolve3DVisualProfile,
  type Lod3DMode,
} from './lod3D';

export type Floating3DEntityKind =
  | 'summit'
  | 'saddle'
  | 'viewpoint'
  | 'water'
  | 'spring'
  | 'refuge'
  | 'wilderness_hut'
  | 'shelter'
  | 'bivouac'
  | 'trailhead'
  | 'parking'
  | 'bus_stop'
  | 'train_station'
  | 'village'
  | 'city'
  | 'bike_shop'
  | 'bike_repair'
  | 'ebike_charging'
  | 'saved_place'
  | 'pokedex'
  | 'pokedex_flora'
  | 'pokedex_bird'
  | 'pokedex_mammal'
  | 'pokedex_fungi'
  | 'pokedex_insect'
  | 'pokedex_aqua'
  | 'carnet'
  | 'bottle'
  | 'club'
  | 'club_event'
  | 'story'
  | 'friend'
  | 'fire'
  | 'flood'
  | 'seismic'
  | 'danger'
  | 'safety_report'
  | 'live_beacon'
  | 'rescue'
  | 'aircraft'
  | 'spot';

export interface Normalize3DEntityExtra {
  iconicTaxon?: string | null;
  kingdom?: string | null;
  category?: string | null;
}

export interface Floating3DItem {
  id: string;
  kind: Floating3DEntityKind;
  lng: number;
  lat: number;
  eleM?: number | null;
  label?: string;
  headingDeg?: number | null;
  selected?: boolean;
  sourceCategory: 'pin' | 'carnet' | 'bottle' | 'club' | 'story' | 'friend' | 'pokedex' | 'hazard';
  properties?: Record<string, unknown>;
}

export interface ExplorerThree3DController {
  attach: (map: MapLibreMap, canvas: HTMLCanvasElement) => void;
  setItems: (items: Floating3DItem[]) => void;
  setSelectedId: (id: string | null) => void;
  setActiveCategory: (category: string | null) => void;
  setMoving: (moving: boolean) => void;
  setEnabled: (enabled: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
  setSafeBounds: (topPx: number, bottomPx: number) => void;
  setPointerScreenPos: (x: number | null, y: number | null) => void;
  onPendingGlbChange: (cb: (count: number) => void) => () => void;
  triggerSelectionJuice: (id: string) => void;
  getScreenPos: (id: string) => { x: number; y: number } | null;
  pickAtPoint: (x: number, y: number, hitRadiusPx?: number) => Floating3DItem | null;
  dispose: () => void;
}

export const EXPLORER_3D_LAYER_ID = 'xp-three-floating-world';
export const MAX_FLOATING_3D_ITEMS = 32;
const MIN_3D_RENDER_ZOOM = 3.2;
const SHOCKWAVE_POOL_SIZE = 6;
const SPARK_POOL_SIZE = 24;

function matchSpecific3DToken(token: string): Floating3DEntityKind | null {
  switch (token) {
    // Relief & Panorama
    case 'peak':
    case 'summit':
    case 'mountain':
    case 'volcano':
      return 'summit';
    case 'saddle':
    case 'pass':
    case 'col':
      return 'saddle';
    case 'viewpoint':
    case 'belvedere':
    case 'panorama':
      return 'viewpoint';

    // Eau & Hydrologie
    case 'water':
    case 'drinking_water':
    case 'fountain':
    case 'water_point':
      return 'water';
    case 'spring':
    case 'waterfall':
    case 'glacier':
    case 'lake':
      return 'spring';

    // Refuges, Cabanes, Abris & Bivouac
    case 'refuge':
    case 'alpine_hut':
    case 'mountain_hut':
      return 'refuge';
    case 'wilderness_hut':
    case 'cabin':
    case 'bothy':
      return 'wilderness_hut';
    case 'shelter':
    case 'lean_to':
    case 'weather_shelter':
      return 'shelter';
    case 'bivouac':
    case 'camp':
    case 'campsite':
    case 'camp_site':
      return 'bivouac';

    // Accès, Sentiers, Mobilité & Villes
    case 'trailhead':
    case 'guidepost':
    case 'information':
    case 'trail':
    case 'access':
      return 'trailhead';
    case 'parking':
    case 'bicycle_parking':
      return 'parking';
    case 'bus_stop':
    case 'bus_station':
      return 'bus_stop';
    case 'train_station':
    case 'station':
    case 'halt':
    case 'tram_stop':
    case 'cable_car':
    case 'gondola':
      return 'train_station';
    case 'village':
    case 'hamlet':
    case 'isolated_dwelling':
    case 'locality':
    case 'place':
      return 'village';
    case 'city':
    case 'town':
    case 'suburb':
    case 'municipality':
      return 'city';

    // Vélo / VTT & Favoris
    case 'bike_shop':
    case 'bicycle_shop':
    case 'bicycle_rental':
    case 'shop':
      return 'bike_shop';
    case 'bike_repair':
    case 'bicycle_repair_station':
    case 'repair':
      return 'bike_repair';
    case 'ebike_charging':
    case 'charging_station':
    case 'charging':
      return 'ebike_charging';
    case 'saved_place':
    case 'favorite':
    case 'highlight':
    case 'bookmark':
      return 'saved_place';

    // Pokédex direct
    case 'pokedex_flora':
      return 'pokedex_flora';
    case 'pokedex_bird':
      return 'pokedex_bird';
    case 'pokedex_mammal':
      return 'pokedex_mammal';
    case 'pokedex_fungi':
      return 'pokedex_fungi';
    case 'pokedex_insect':
      return 'pokedex_insect';
    case 'pokedex_aqua':
      return 'pokedex_aqua';

    // Communauté & Social
    case 'carnet':
      return 'carnet';
    case 'bottle':
      return 'bottle';
    case 'club':
      return 'club';
    case 'club_event':
    case 'event':
    case 'outing':
      return 'club_event';
    case 'story':
      return 'story';
    case 'friend':
      return 'friend';

    // Risques & Secours
    case 'fire':
    case 'wildfire':
      return 'fire';
    case 'flood':
    case 'hydro':
      return 'flood';
    case 'seismic':
    case 'quake':
    case 'earthquake':
      return 'seismic';
    case 'rescue':
    case 'medical':
    case 'hospital':
    case 'mountain_rescue':
    case 'emergency':
      return 'rescue';
    case 'safety_report':
    case 'report':
    case 'signalement':
      return 'safety_report';
    case 'live_beacon':
    case 'beacon':
    case 'balise':
      return 'live_beacon';
    case 'danger':
    case 'hazard':
    case 'warning':
      return 'danger';
    case 'aircraft':
    case 'airspace':
      return 'aircraft';
    default:
      return null;
  }
}

/**
 * Normalizes any POI kind, `geo_pois.subtype`, `geo_places.kind`, `bike-pois.category`,
 * Pokédex `iconicTaxon`/`kingdom`, social or hazard kind into a canonical 3D model archetype.
 */
export function normalize3DEntityKind(
  rawKind: string | null | undefined,
  rawSubtype?: string | null,
  extra?: Normalize3DEntityExtra,
): Floating3DEntityKind {
  const k = (rawKind ?? '').trim().toLowerCase();
  const sub = (rawSubtype ?? extra?.category ?? '').trim().toLowerCase();

  // Pokédex taxonomic specialization
  if (k === 'pokedex' || k === 'species' || sub === 'pokedex') {
    const taxon = (extra?.iconicTaxon ?? '').trim().toLowerCase();
    const kingdom = (extra?.kingdom ?? '').trim().toLowerCase();
    if (taxon === 'aves' || taxon === 'bird') return 'pokedex_bird';
    if (taxon === 'mammalia' || taxon === 'mammal') return 'pokedex_mammal';
    if (taxon === 'fungi' || kingdom === 'fungi') return 'pokedex_fungi';
    if (taxon === 'insecta' || taxon === 'arachnida' || taxon === 'insect') return 'pokedex_insect';
    if (
      taxon === 'amphibia' ||
      taxon === 'reptilia' ||
      taxon === 'actinopterygii' ||
      taxon === 'mollusca' ||
      taxon === 'aqua'
    ) {
      return 'pokedex_aqua';
    }
    if (taxon === 'plantae' || kingdom === 'flore' || kingdom === 'plantae') return 'pokedex_flora';
    if (kingdom === 'faune' || kingdom === 'animalia') return 'pokedex_mammal';
    return 'pokedex';
  }

  // Prefer granular subtype / category over broad bucket kind (e.g. `access` + `train_station`)
  if (sub) {
    const subMatch = matchSpecific3DToken(sub);
    if (subMatch) return subMatch;
  }

  if (k) {
    const kindMatch = matchSpecific3DToken(k);
    if (kindMatch) return kindMatch;
  }

  return 'spot';
}

/**
 * Zoom-adaptive physical reference scale (kept exported for telemetry & unit tests).
 */
export function floating3DScaleMetersForZoom(zoom: number): number {
  const clamped = Math.max(4.4, Math.min(17.5, Number.isFinite(zoom) ? zoom : 12));
  const metersPerPxAtEq = 156_543.03392 / Math.pow(2, clamped);
  return Math.max(2.2, metersPerPxAtEq * 16.5);
}

export function accentColorForKind(kind: Floating3DEntityKind): number {
  switch (kind) {
    case 'summit':
      return 0x17402c;
    case 'saddle':
      return 0x475569;
    case 'viewpoint':
      return 0x0284c7;
    case 'water':
    case 'flood':
      return 0x0ea5e9;
    case 'spring':
      return 0x06b6d4;
    case 'refuge':
      return 0xc27838;
    case 'wilderness_hut':
      return 0x92400e;
    case 'shelter':
      return 0x78716c;
    case 'bivouac':
    case 'carnet':
      return 0xd97706;
    case 'trailhead':
      return 0x16a34a;
    case 'parking':
      return 0x2563eb;
    case 'bus_stop':
      return 0xf59e0b;
    case 'train_station':
      return 0x64748b;
    case 'village':
      return 0xb45309;
    case 'city':
      return 0x334155;
    case 'bike_shop':
      return 0x059669;
    case 'bike_repair':
      return 0x4f46e5;
    case 'ebike_charging':
      return 0x10b981;
    case 'saved_place':
      return 0xeab308;
    case 'bottle':
      return 0x0f766e;
    case 'club':
      return 0x17402c;
    case 'club_event':
      return 0xea580c;
    case 'story':
      return 0xec4899;
    case 'friend':
      return 0x14b8a6;
    case 'pokedex':
    case 'pokedex_flora':
      return 0x10b981;
    case 'pokedex_bird':
      return 0x0284c7;
    case 'pokedex_mammal':
      return 0xb45309;
    case 'pokedex_fungi':
      return 0xdc2626;
    case 'pokedex_insect':
      return 0xd97706;
    case 'pokedex_aqua':
      return 0x0891b2;
    case 'fire':
    case 'danger':
    case 'safety_report':
      return 0xef4444;
    case 'live_beacon':
      return 0x10b981;
    case 'rescue':
      return 0xdc2626;
    case 'seismic':
      return 0xf59e0b;
    case 'aircraft':
      return 0x6366f1;
    default:
      return 0x24583d;
  }
}

export function accentHexFor3DKind(kind: Floating3DEntityKind): string {
  return `#${accentColorForKind(kind).toString(16).padStart(6, '0')}`;
}

interface MeshEntry {
  item: Floating3DItem;
  root: THREE.Group;
  body: THREE.Group;
  /** Lightweight 12-triangle shared beacon mesh shown at wide/peripheral LOD. */
  beacon: THREE.Mesh;
  shadow: THREE.Mesh;
  ring: THREE.Mesh;
  phase: number;
  extraSpinRad: number;
  animatedParts: THREE.Object3D[];
  usesGlb: boolean;
  glbRequested: boolean;
  currentLod: Lod3DMode;
  /** Per-entry owned procedural resources disposed cleanly on incremental removal. */
  ownedGeos: THREE.BufferGeometry[];
  ownedMats: THREE.Material[];
  /** Soft fade-out latch before removing an entry from the WebGL scene. */
  exiting: boolean;
  /** Center-outward stagger delay (seconds) for silky arrival waves. */
  appearDelaySec: number;
}

interface ShockwaveVfx {
  active: boolean;
  lng: number;
  lat: number;
  life: number;
  maxLife: number;
  delay: number;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
}

interface Spark3DVfx {
  active: boolean;
  lng: number;
  lat: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
}

interface SharedAssets {
  shadowTexture: THREE.CanvasTexture | null;
  shadowGeo: THREE.CircleGeometry;
  ringGeo: THREE.RingGeometry;
  shockwaveGeo: THREE.RingGeometry;
  sparkGeo: THREE.OctahedronGeometry;
  beaconGeo: THREE.OctahedronGeometry;
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
}

function createRadialShadowTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.06,
    size / 2,
    size / 2,
    size * 0.48,
  );
  grad.addColorStop(0, 'rgba(14, 26, 22, 0.72)');
  grad.addColorStop(0.52, 'rgba(14, 26, 22, 0.36)');
  grad.addColorStop(1, 'rgba(14, 26, 22, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds a multi-part Neopolis-style miniature 3D diorama model in standard Three.js space
 * (+Y = up, +Z = toward camera). Model height is ~2.2 units for uniform screen-pixel sizing.
 * Interactive sub-parts carry `userData.animRole` for living 60 FPS micro-animations.
 */
function buildProcedural3DModel(
  kind: Floating3DEntityKind,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T,
): { group: THREE.Group; animatedParts: THREE.Object3D[] } {
  const g = new THREE.Group();
  const animatedParts: THREE.Object3D[] = [];

  const markAnimated = <T extends THREE.Object3D>(obj: T, role: string): T => {
    obj.userData.animRole = role;
    animatedParts.push(obj);
    return obj;
  };

  const mat = (
    color: number,
    roughness = 0.26,
    metalness = 0.1,
    emissive = 0x000000,
    opacity = 1,
  ) =>
    trackMat(
      new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness,
        emissive,
        emissiveIntensity: emissive ? 0.28 : 0,
        flatShading: true,
        side: THREE.DoubleSide,
        transparent: opacity < 1,
        opacity,
      }),
    );

  // Subtle crisp white/emerald diorama plinth under buildings & camps
  const addPedestal = (coreColor: number) => {
    const outer = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.82, 0.92, 0.18, 18)),
      mat(0xffffff, 0.22, 0.04),
    );
    outer.position.y = 0.09;
    g.add(outer);

    const inner = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.68, 0.68, 0.22, 18)),
      mat(coreColor, 0.3, 0.1),
    );
    inner.position.y = 0.12;
    g.add(inner);
  };

  if (kind === 'summit') {
    const mainPeak = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.95, 1.85, 6)),
      mat(0x1f5c3e, 0.34, 0.06),
    );
    mainPeak.position.y = 1.02;
    g.add(mainPeak);

    const sidePeak = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.58, 1.2, 5)),
      mat(0x2f7550, 0.38, 0.05),
    );
    sidePeak.position.set(0.52, 0.7, 0.24);
    g.add(sidePeak);

    const snowCap = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.44, 0.82, 6)),
      mat(0xffffff, 0.18, 0.04, 0xdbeafe),
    );
    snowCap.position.y = 1.56;
    g.add(snowCap);

    const goldRing = markAnimated(
      new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(0.92, 0.08, 8, 24)).rotateX(Math.PI / 2),
        mat(0xe9c46a, 0.2, 0.6),
      ),
      'gold-halo',
    );
    goldRing.position.y = 0.18;
    g.add(goldRing);
    return { group: g, animatedParts };
  }

  if (kind === 'water' || kind === 'flood') {
    const bulb = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.68, 16, 12)),
      mat(0x0ea5e9, 0.12, 0.2, 0x0284c7),
    );
    bulb.position.y = 0.85;
    g.add(bulb);

    const tip = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.62, 1.1, 16)),
      mat(0x38bdf8, 0.12, 0.2, 0x0ea5e9),
    );
    tip.position.y = 1.58;
    g.add(tip);

    const ring = markAnimated(
      new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(0.92, 0.075, 8, 24)).rotateX(Math.PI / 2),
        mat(0xffffff, 0.16, 0.14),
      ),
      'orbit-ring',
    );
    ring.position.y = 0.72;
    ring.rotation.z = 0.28;
    g.add(ring);

    const miniDrop = markAnimated(
      new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(0.18, 10, 8)),
        mat(0xbae6fd, 0.1, 0.2, 0x38bdf8),
      ),
      'orbit-drop',
    );
    miniDrop.position.set(0.92, 0.85, 0);
    g.add(miniDrop);
    return { group: g, animatedParts };
  }

  if (kind === 'refuge') {
    addPedestal(0x17402c);

    const walls = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(1.14, 0.82, 0.94)),
      mat(0xd99b5e, 0.48, 0.02),
    );
    walls.position.y = 0.62;
    g.add(walls);

    const roof = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(1.04, 0.82, 4)).rotateY(Math.PI / 4),
      mat(0xa83814, 0.36, 0.06),
    );
    roof.scale.set(1.06, 1, 0.92);
    roof.position.y = 1.44;
    g.add(roof);

    const chimney = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.22, 0.5, 0.22)),
      mat(0x64748b, 0.55, 0.05),
    );
    chimney.position.set(0.32, 1.46, -0.16);
    g.add(chimney);

    // Living micro-animation: soft alpine chimney smoke puff drifting upward
    const smoke = markAnimated(
      new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(0.16, 8, 6)),
        mat(0xf8fafc, 0.8, 0, 0x000000, 0.68),
      ),
      'smoke',
    );
    smoke.position.set(0.32, 1.82, -0.16);
    g.add(smoke);

    const win = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.34, 0.34, 0.08)),
      mat(0xfef08a, 0.15, 0.05, 0xfacc15),
    );
    win.position.set(0, 0.66, 0.48);
    g.add(win);
    return { group: g, animatedParts };
  }

  if (kind === 'bivouac') {
    addPedestal(0x2d6a4f);
    const tent = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.92, 1.25, 3)),
      mat(0xea8c1e, 0.42, 0.04),
    );
    tent.position.y = 0.84;
    g.add(tent);

    const ember = markAnimated(
      new THREE.Mesh(
        trackGeo(new THREE.OctahedronGeometry(0.28, 0)),
        mat(0xfbbf24, 0.18, 0.08, 0xf97316),
      ),
      'flame-core',
    );
    ember.position.set(0.68, 0.42, 0.45);
    g.add(ember);
    return { group: g, animatedParts };
  }

  if (kind === 'carnet') {
    const book = new THREE.Group();
    const coverBack = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(1.16, 1.48, 0.14)),
      mat(0xc86a08, 0.34, 0.14),
    );
    coverBack.position.z = -0.16;
    book.add(coverBack);

    const pages = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(1.04, 1.38, 0.24)),
      mat(0xfffbeb, 0.45, 0.02),
    );
    book.add(pages);

    const coverFront = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(1.16, 1.48, 0.14)),
      mat(0xea8c1e, 0.28, 0.16),
    );
    coverFront.position.z = 0.16;
    book.add(coverFront);

    const spine = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.24, 1.5, 0.48)),
      mat(0x17402c, 0.32, 0.12),
    );
    spine.position.x = -0.5;
    book.add(spine);

    const clasp = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.38, 0.38, 0.08)).rotateZ(Math.PI / 4),
      mat(0xfacc15, 0.18, 0.58),
    );
    clasp.position.set(0.1, 0.06, 0.24);
    book.add(clasp);

    book.position.y = 1.15;
    book.rotation.z = -0.2;
    book.rotation.x = -0.18;
    g.add(book);
    return { group: g, animatedParts };
  }

  if (kind === 'bottle') {
    const bottle = markAnimated(new THREE.Group(), 'bottle-sway');
    const glassBody = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.54, 0.56, 1.18, 16)),
      mat(0x14b8a6, 0.1, 0.18, 0x0f766e, 0.88),
    );
    glassBody.position.y = 0.72;
    bottle.add(glassBody);

    const scroll = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.24, 0.24, 0.8, 12)),
      mat(0xfef3c7, 0.48, 0.02),
    );
    scroll.position.y = 0.76;
    bottle.add(scroll);

    const neck = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.22, 0.32, 0.44, 14)),
      mat(0x0f766e, 0.14, 0.16),
    );
    neck.position.y = 1.48;
    bottle.add(neck);

    const cork = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.19, 0.17, 0.26, 12)),
      mat(0xb45309, 0.62, 0.02),
    );
    cork.position.y = 1.82;
    bottle.add(cork);

    bottle.rotation.z = -0.3;
    bottle.position.y = 0.18;
    g.add(bottle);
    return { group: g, animatedParts };
  }

  if (kind === 'club') {
    const rim = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.92, 0.92, 0.24, 6)).rotateX(Math.PI / 2),
      mat(0xe9c46a, 0.22, 0.52),
    );
    rim.position.y = 1.12;
    g.add(rim);

    const shield = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.75, 0.75, 0.3, 6)).rotateX(Math.PI / 2),
      mat(0x17402c, 0.28, 0.12),
    );
    shield.position.y = 1.12;
    g.add(shield);

    const peak = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.38, 0.56, 4)),
      mat(0xffffff, 0.2, 0.08),
    );
    peak.position.set(0, 1.14, 0.18);
    g.add(peak);
    return { group: g, animatedParts };
  }

  if (kind === 'story') {
    const frame = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(1.22, 1.44, 0.22)),
      mat(0xffffff, 0.2, 0.06),
    );
    frame.position.y = 1.1;
    frame.rotation.z = -0.12;
    g.add(frame);

    const screen = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.98, 1.02, 0.26)),
      mat(0xec4899, 0.18, 0.16, 0xdb2777),
    );
    screen.position.set(0, 1.16, 0);
    screen.rotation.z = -0.12;
    g.add(screen);

    const play = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.28, 0.38, 3)).rotateZ(-Math.PI / 2),
      mat(0xffffff, 0.18, 0.1),
    );
    play.position.set(0.05, 1.16, 0.18);
    g.add(play);
    return { group: g, animatedParts };
  }

  if (kind === 'pokedex') {
    const gem = new THREE.Mesh(
      trackGeo(new THREE.OctahedronGeometry(0.78, 0)),
      mat(0x10b981, 0.14, 0.22, 0x059669),
    );
    gem.scale.set(0.9, 1.28, 0.9);
    gem.position.y = 1.16;
    g.add(gem);

    const orbit = markAnimated(
      new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(0.98, 0.075, 8, 24)).rotateX(Math.PI / 2.6),
        mat(0xfacc15, 0.2, 0.56),
      ),
      'orbit-ring',
    );
    orbit.position.y = 1.1;
    orbit.rotation.z = 0.4;
    g.add(orbit);
    return { group: g, animatedParts };
  }

  if (kind === 'fire') {
    const outer = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.78, 1.78, 7)),
      mat(0xef4444, 0.22, 0.08, 0xdc2626),
    );
    outer.position.y = 1.05;
    g.add(outer);

    const inner = markAnimated(
      new THREE.Mesh(
        trackGeo(new THREE.OctahedronGeometry(0.48, 0)),
        mat(0xfbbf24, 0.18, 0.1, 0xf59e0b),
      ),
      'flame-core',
    );
    inner.position.y = 0.72;
    g.add(inner);
    return { group: g, animatedParts };
  }

  if (kind === 'live_beacon') {
    const body = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.42, 0.52, 0.95, 16)),
      mat(0xfbfaf6, 0.35, 0.08),
    );
    body.position.y = 0.5;
    const orb = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.32, 16, 16)),
      mat(0x34d399, 0.2, 0.15, 0x059669),
    );
    orb.position.y = 1.32;
    g.add(body, orb);
    animatedParts.push({ mesh: orb, role: 'pulse', baseY: 1.32 });
    return { group: g, animatedParts };
  }

  if (kind === 'danger' || kind === 'safety_report' || kind === 'seismic') {
    const beacon = new THREE.Mesh(
      trackGeo(new THREE.OctahedronGeometry(0.76, 0)),
      mat(kind === 'seismic' ? 0xf59e0b : 0xdc2626, 0.22, 0.16, 0x991b1b),
    );
    beacon.position.y = 1.08;
    g.add(beacon);

    const ring = markAnimated(
      new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(0.92, 0.08, 8, 20)).rotateX(Math.PI / 2),
        mat(0xffffff, 0.2, 0.12),
      ),
      'orbit-ring',
    );
    ring.position.y = 1.08;
    g.add(ring);
    return { group: g, animatedParts };
  }

  if (kind === 'aircraft') {
    const fuselage = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.15, 0.2, 1.48, 10)).rotateX(Math.PI / 2),
      mat(0x6366f1, 0.22, 0.2),
    );
    fuselage.position.y = 1.25;
    g.add(fuselage);

    const wings = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(1.7, 0.09, 0.34)),
      mat(0xffffff, 0.2, 0.12),
    );
    wings.position.set(0, 1.28, -0.05);
    g.add(wings);

    const tail = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.66, 0.08, 0.2)),
      mat(0x818cf8, 0.22, 0.15),
    );
    tail.position.set(0, 1.34, 0.56);
    g.add(tail);
    return { group: g, animatedParts };
  }

  // Default ('spot', 'viewpoint', 'friend'): Neopolis Chunky Beveled 3D Medallion Coin
  const coinColor = kind === 'friend' ? 0x14b8a6 : kind === 'viewpoint' ? 0x1f5c3e : 0x17402c;
  const goldRim = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.84, 0.84, 0.24, 20)).rotateX(Math.PI / 2),
    mat(0xe9c46a, 0.2, 0.58),
  );
  goldRim.position.y = 1.08;
  g.add(goldRim);

  const face = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.68, 0.68, 0.29, 20)).rotateX(Math.PI / 2),
    mat(coinColor, 0.26, 0.14),
  );
  face.position.y = 1.08;
  g.add(face);

  const star = new THREE.Mesh(
    trackGeo(new THREE.OctahedronGeometry(0.32, 0)),
    mat(0xffffff, 0.16, 0.2),
  );
  star.position.set(0, 1.08, 0.16);
  g.add(star);
  return { group: g, animatedParts };
}

function itemsSignature(items: readonly Floating3DItem[]): string {
  return items
    .map((it) => `${it.id}:${it.kind}:${it.lng.toFixed(5)}:${it.lat.toFixed(5)}`)
    .join('|');
}

/**
 * Creates the Explorer Three.js 3D Floating Diorama Overlay Controller.
 */
export function createExplorerThree3DLayer(): ExplorerThree3DController {
  let mapRef: MapLibreMap | null = null;
  let canvasRef: HTMLCanvasElement | null = null;
  let camera: THREE.OrthographicCamera | null = null;
  let scene: THREE.Scene | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let envRT: THREE.WebGLRenderTarget | null = null;
  let glbRegistry: ExplorerGlbRegistry | null = null;
  let assets: SharedAssets | null = null;
  let entries: MeshEntry[] = [];
  let currentItems: Floating3DItem[] = [];
  let currentSignature = '';
  let selectedId: string | null = null;
  let activeCategory: string | null = 'explorer';
  let isMoving = false;
  let currentDpr = 0;
  let enabled = true;
  let reducedMotion = false;
  let safeTopPx = 58;
  let safeBottomPx = 760;
  let pointerX: number | null = null;
  let pointerY: number | null = null;
  let rafId = 0;
  let needsImmediateFrame = false;
  let lastWidth = 0;
  let lastHeight = 0;
  let lastRenderMs = 0;
  let phaseCursor = 0;
  let resizeObserver: ResizeObserver | null = null;
  let unsubscribeGlbPending: (() => void) | null = null;
  const pendingGlbListeners = new Set<(count: number) => void>();

  const isMobileLike =
    typeof window !== 'undefined' &&
    (window.innerWidth <= 560 ||
      (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches));
  const maxActive3DItems = isMobileLike ? 18 : MAX_FLOATING_3D_ITEMS;

  // Persistent per-object spring & hysteresis state (survives mesh updates for zero flicker!)
  const springStates = new Map<string, Spring3DState>();
  const screenCache = new Map<
    string,
    { x: number; y: number; groundY: number; item: Floating3DItem }
  >();
  const shockwaves: ShockwaveVfx[] = [];
  const sparks3D: Spark3DVfx[] = [];
  const startMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const stopLoop = () => {
    if (rafId && typeof window !== 'undefined') {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };

  const syncCanvasSize = () => {
    if (!canvasRef || !renderer || !camera) return;
    const w = canvasRef.clientWidth || window.innerWidth || 390;
    const h = canvasRef.clientHeight || window.innerHeight || 844;
    // Stable mobile-safe DPR cap: NEVER reallocate the WebGL framebuffer on movestart/moveend!
    const nativeDpr = window.devicePixelRatio || 1;
    const targetDpr = isMobileLike || w <= 560 ? Math.min(1.25, nativeDpr) : Math.min(1.75, nativeDpr);
    if (w === lastWidth && h === lastHeight && Math.abs(targetDpr - currentDpr) < 0.01) return;
    lastWidth = w;
    lastHeight = h;
    currentDpr = targetDpr;
    renderer.setPixelRatio(targetDpr);
    renderer.setSize(w, h, false);
    camera.left = 0;
    camera.right = w;
    camera.top = 0;
    camera.bottom = -h;
    camera.near = -1000;
    camera.far = 1000;
    camera.updateProjectionMatrix();
  };

  const spawn3DImpactVfx = (lng: number, lat: number, colorHex: number) => {
    if (reducedMotion || !enabled) return;

    // 1. Dual staggered 3D isometric ground shockwave rings
    let spawnedRings = 0;
    for (let i = 0; i < shockwaves.length && spawnedRings < 2; i += 1) {
      const sw = shockwaves[i];
      if (!sw.active) {
        sw.active = true;
        sw.lng = lng;
        sw.lat = lat;
        sw.life = 0;
        sw.maxLife = spawnedRings === 0 ? 0.68 : 0.82;
        sw.delay = spawnedRings === 0 ? 0 : 0.1;
        sw.mat.color.setHex(spawnedRings === 0 ? colorHex : 0xe9c46a);
        sw.mat.opacity = 0;
        sw.mesh.visible = false;
        spawnedRings += 1;
      }
    }

    // 2. 10 sparkling 3D octahedron burst particles erupting upward
    let spawnedSparks = 0;
    for (let i = 0; i < sparks3D.length && spawnedSparks < 10; i += 1) {
      const sp = sparks3D[i];
      if (!sp.active) {
        const angle = (spawnedSparks / 10) * Math.PI * 2 + Math.random() * 0.4;
        const speed = 2.6 + Math.random() * 2.4;
        sp.active = true;
        sp.lng = lng;
        sp.lat = lat;
        sp.offsetX = 0;
        sp.offsetY = 0.8;
        sp.offsetZ = 0;
        sp.vx = Math.cos(angle) * speed;
        sp.vy = 4.2 + Math.random() * 2.6;
        sp.vz = Math.sin(angle) * speed * 0.6;
        sp.life = 0;
        sp.maxLife = 0.52 + Math.random() * 0.25;
        sp.mat.color.setHex(spawnedSparks % 2 === 0 ? 0xfacc15 : colorHex);
        sp.mat.opacity = 1;
        sp.mesh.visible = true;
        spawnedSparks += 1;
      }
    }
  };

  const animateLivingParts = (entry: MeshEntry, elapsedSec: number) => {
    if (reducedMotion || entry.animatedParts.length === 0) return;
    const p = entry.phase;
    for (let i = 0; i < entry.animatedParts.length; i += 1) {
      const part = entry.animatedParts[i];
      const role = part.userData.animRole;
      if (role === 'smoke') {
        const cycle = (elapsedSec * 0.55 + p) % 1;
        part.position.y = 1.78 + cycle * 0.72;
        part.position.x = 0.32 + Math.sin(cycle * Math.PI * 2) * 0.12;
        const s = 0.7 + cycle * 0.75;
        part.scale.set(s, s, s);
        const m = (part as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (m) m.opacity = Math.sin(cycle * Math.PI) * 0.62;
      } else if (role === 'orbit-drop') {
        const a = elapsedSec * 2.4 + p;
        part.position.set(Math.cos(a) * 0.94, 0.82 + Math.sin(a * 2) * 0.14, Math.sin(a) * 0.94);
      } else if (role === 'orbit-ring') {
        part.rotation.y = -elapsedSec * 1.45 - p;
        part.rotation.z = 0.35 + Math.sin(elapsedSec * 1.8 + p) * 0.14;
      } else if (role === 'flame-core') {
        const flick = 0.88 + Math.sin(elapsedSec * 11 + p * 3) * 0.16;
        part.scale.set(flick, 0.92 + Math.cos(elapsedSec * 9 + p) * 0.18, flick);
      } else if (role === 'bottle-sway') {
        part.rotation.z = -0.28 + Math.sin(elapsedSec * 1.9 + p) * 0.12;
      } else if (role === 'gold-halo') {
        const pulse = 0.96 + Math.sin(elapsedSec * 2.6 + p) * 0.08;
        part.scale.set(pulse, pulse, pulse);
      }
    }
  };

  const renderFrame = (nowMs: number) => {
    if (!renderer || !scene || !camera || !mapRef || !canvasRef) return;
    syncCanvasSize();

    const dtSec =
      lastRenderMs > 0 ? Math.min(0.05, Math.max(0.001, (nowMs - lastRenderMs) / 1000)) : 0.016;
    lastRenderMs = nowMs;

    if (!enabled || (entries.length === 0 && shockwaves.every((s) => !s.active)) || mapRef.getZoom() < MIN_3D_RENDER_ZOOM) {
      renderer.clear();
      screenCache.clear();
      return;
    }

    const w = lastWidth || 390;
    const h = lastHeight || 844;
    const zNow = mapRef.getZoom();
    const pitchRad = ((mapRef.getPitch() || 0) * Math.PI) / 180;
    const modelTiltX = 0.24 + Math.min(0.42, pitchRad * 0.45);
    const elapsedSec = (nowMs - startMs) / 1000;
    const basePxUnit = zNow >= 13 ? 19.5 : zNow >= 10.5 ? 17.5 : zNow >= 7 ? 15.5 : 13.5;

    // 1. Identify hovered 3D object from pointer screen coordinates (magnetic hover lift)
    let hoveredId: string | null = null;
    if (pointerX !== null && pointerY !== null) {
      let bestDistSq = 34 * 34;
      for (const cached of screenCache.values()) {
        const dx = cached.x - pointerX;
        const dy = cached.y - pointerY;
        const dSq = dx * dx + dy * dy;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          hoveredId = cached.item.id;
        }
      }
    }

    // 2. Project all 3D entries and assemble collision candidates
    const entryById = new Map<string, MeshEntry>();
    const distNormById = new Map<string, number>();
    const candidates: Collision3DCandidate[] = [];
    const centerScreenX = w * 0.5;
    const centerScreenY = (safeTopPx + safeBottomPx) * 0.5;
    const halfSpan = Math.max(1, Math.hypot(w * 0.5, h * 0.5));

    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      const { item } = entry;
      entryById.set(item.id, entry);
      const isSelected = !entry.exiting && (item.id === selectedId || Boolean(item.selected));

      if (entry.appearDelaySec > 0 && !reducedMotion) {
        entry.appearDelaySec = Math.max(0, entry.appearDelaySec - dtSec);
      }

      let pt: { x: number; y: number } | null = null;
      try {
        pt = mapRef.project([item.lng, item.lat]);
      } catch {
        pt = null;
      }

      const inBounds =
        !entry.exiting &&
        entry.appearDelaySec <= 0 &&
        Boolean(
          pt &&
            Number.isFinite(pt.x) &&
            Number.isFinite(pt.y) &&
            pt.x >= -26 &&
            pt.x <= w + 26 &&
            pt.y >= safeTopPx &&
            pt.y <= safeBottomPx,
        );

      const ax = pt && Number.isFinite(pt.x) ? pt.x : -9999;
      const ay = pt && Number.isFinite(pt.y) ? pt.y : -9999;
      const distCenterSq = inBounds
        ? ((ax - centerScreenX) ** 2 + (ay - centerScreenY) ** 2) / (halfSpan * halfSpan)
        : 2;
      distNormById.set(item.id, Math.min(1, Math.sqrt(Math.max(0, distCenterSq))));

      candidates.push({
        id: item.id,
        anchorX: ax,
        anchorY: ay,
        priority:
          priorityFor3DEntity(item.kind, isSelected, distCenterSq) +
          categoryPriorityBonus(item.kind, activeCategory),
        selected: isSelected,
        inBounds,
      });
    }

    // 3. Solve O(N) spatial-hash collision with zoom-adaptive breathing room
    const spacing = adaptiveCollisionSpacing(zNow);
    const solvedList = solve3DCollisions(candidates, springStates, dtSec, {
      hoveredId,
      reducedMotion,
      enterPx: spacing.enterPx,
      exitPx: spacing.exitPx,
    });

    screenCache.clear();
    let hasRetiredEntries = false;

    for (let i = 0; i < solvedList.length; i += 1) {
      const solved = solvedList[i];
      const entry = entryById.get(solved.id);
      if (!entry) continue;
      const { item, root, body, beacon, shadow, ring, phase } = entry;
      const st = solved.state;
      const isSelected = !entry.exiting && (item.id === selectedId || Boolean(item.selected));
      const isHovered = hoveredId === item.id;

      if (st.alpha < 0.02 || st.spawnScale < 0.02) {
        root.visible = false;
        if (entry.exiting) {
          hasRetiredEntries = true;
        }
        continue;
      }

      root.visible = true;

      // Resolve zoom/tier/distance visual LOD profile
      const profile = resolve3DVisualProfile(item.kind, zNow, {
        selected: isSelected,
        hovered: isHovered,
        distCenterNorm: distNormById.get(item.id) ?? 0.35,
        activeCategory,
      });
      entry.currentLod = profile.lodMode;

      const useBeacon = profile.lodMode === 'beacon';
      body.visible = !useBeacon;
      beacon.visible = useBeacon;

      // Lazy-stream Meshy GLB ONLY when settled (never stutter an active pan/pinch with Draco WASM!)
      if (!isMoving && !useBeacon && !entry.usesGlb && !entry.glbRequested && glbRegistry) {
        entry.glbRequested = true;
        const cached = glbRegistry.createInstance(item.kind);
        if (cached) {
          entry.root.remove(entry.body);
          entry.body = cached;
          entry.animatedParts = [];
          entry.usesGlb = true;
          entry.root.add(cached);
        } else {
          glbRegistry.requestModel(item.kind, () => swapReadyGlbForKind(item.kind));
        }
      }

      // Calibrated visual hierarchy + depth perspective + elastic spring scale + hover bloom
      const depthRatio = Math.max(0, Math.min(1, solved.renderY / Math.max(1, h)));
      const visibilityScale = st.spawnScale * (0.68 + 0.32 * st.alpha);
      const hoverScale = 1 + st.hoverLift * 0.13;
      const pxScale =
        basePxUnit *
        profile.scaleMultiplier *
        (0.9 + depthRatio * 0.22) *
        hoverScale *
        visibilityScale;

      const zOrder =
        -200 +
        depthRatio * 400 +
        (isSelected ? 160 : profile.tier === 1 ? 35 : profile.tier === 2 ? 12 : 0) +
        st.hoverLift * 40;
      root.position.set(solved.renderX, -solved.renderY, zOrder);
      root.scale.set(pxScale, pxScale, pxScale);

      // Levitation sine wave + hover lift + tap jump spring (calmer on compact/beacon LOD)
      const waveAmp = profile.lodMode === 'full' ? 0.24 : 0.14;
      const wave = reducedMotion ? 0.5 : (Math.sin(elapsedSec * 2.0 + phase) + 1) * 0.5;
      const liftY =
        (isSelected ? 0.42 : profile.lodMode === 'beacon' ? 0.36 : 0.2) +
        wave * waveAmp +
        st.hoverLift * 0.24 +
        Math.max(-0.15, st.jumpY * 0.55);

      const activeVisual = useBeacon ? beacon : entry.body;
      activeVisual.position.y = liftY;
      activeVisual.scale.set(st.squashX, st.squashY, st.squashZ);
      activeVisual.rotation.x = useBeacon ? 0.25 : modelTiltX;

      // Calm motion profile: gentle diorama sway for architecture/vehicles vs turntable for collectibles
      if (st.spinBoost > 0.01 && !reducedMotion) {
        entry.extraSpinRad += st.spinBoost * dtSec;
      }
      if (reducedMotion) {
        activeVisual.rotation.y = 0;
      } else if (profile.motionStyle === 'static' && typeof item.headingDeg === 'number') {
        activeVisual.rotation.y = -(item.headingDeg * Math.PI) / 180;
      } else if (profile.motionStyle === 'gentle-sway' && !useBeacon) {
        activeVisual.rotation.y =
          Math.sin(elapsedSec * 0.85 + phase) * 0.22 + entry.extraSpinRad;
      } else {
        activeVisual.rotation.y = elapsedSec * 0.68 + phase + entry.extraSpinRad;
      }

      // Living archetype micro-animations only on full-LOD procedural models
      if (profile.lodMode === 'full' && !entry.usesGlb) {
        animateLivingParts(entry, elapsedSec);
      }

      // Soft ground shadow (always grounds the floating 3D object cleanly)
      const heightAtten = Math.min(0.42, wave * 0.18 + st.hoverLift * 0.14 + Math.max(0, st.jumpY) * 0.22);
      const shadowScale = Math.max(0.42, (useBeacon ? 0.72 : 1.02) - heightAtten);
      shadow.scale.set(shadowScale, shadowScale * 0.42, 1);
      shadow.position.set(0, -0.05, -0.6);
      const shadowMat = shadow.material as THREE.MeshBasicMaterial;
      shadowMat.opacity = (assets?.shadowTexture ? (useBeacon ? 0.62 : 0.88) : 0.32) * st.alpha;

      // Clean ground ring: shown ONLY on selected, hovered, or hero landmarks (eliminates visual clutter!)
      ring.visible = profile.showRing;
      if (profile.showRing) {
        const ringMat = ring.material as THREE.MeshBasicMaterial;
        ringMat.opacity =
          (isSelected ? 0.94 : 0.32 + (1 - wave) * 0.14 + st.hoverLift * 0.34) * st.alpha;
        const ringScale = isSelected ? 1.22 + wave * 0.14 : 0.94 + st.hoverLift * 0.18;
        ring.scale.set(ringScale, ringScale * 0.42, 1);
        ring.position.set(0, -0.04, -0.55);
      }

      // Cache floating body center AND ground anchor for full-silhouette capsule hit-testing
      if (!entry.exiting && solved.admitted && st.alpha > 0.35) {
        screenCache.set(item.id, {
          x: solved.renderX,
          y: solved.renderY - pxScale * 1.12,
          groundY: solved.renderY,
          item,
        });
      }
    }

    // Cleanly detach & dispose entries that finished fading out (zero scene rebuild!)
    if (hasRetiredEntries) {
      const remaining: MeshEntry[] = [];
      for (const entry of entries) {
        const st = springStates.get(entry.item.id);
        if (entry.exiting && (!st || st.alpha < 0.025 || st.spawnScale < 0.025)) {
          disposeEntry(entry);
          springStates.delete(entry.item.id);
        } else {
          remaining.push(entry);
        }
      }
      entries = remaining;
    }

    // 4. Advance & render pooled 3D ground shockwave rings
    for (let i = 0; i < shockwaves.length; i += 1) {
      const sw = shockwaves[i];
      if (!sw.active) continue;
      if (sw.delay > 0) {
        sw.delay -= dtSec;
        continue;
      }
      sw.life += dtSec;
      if (sw.life >= sw.maxLife) {
        sw.active = false;
        sw.mesh.visible = false;
        continue;
      }
      let pt: { x: number; y: number } | null = null;
      try {
        pt = mapRef.project([sw.lng, sw.lat]);
      } catch {
        pt = null;
      }
      if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) {
        sw.mesh.visible = false;
        continue;
      }
      const t = sw.life / sw.maxLife;
      const eased = 1 - Math.pow(1 - t, 3);
      const radiusPx = basePxUnit * (0.95 + eased * 2.95);
      sw.mesh.visible = true;
      sw.mesh.position.set(pt.x, -pt.y, 180);
      sw.mesh.scale.set(radiusPx, radiusPx * 0.42, 1);
      sw.mat.opacity = (1 - t) * (1 - t) * 0.92;
    }

    // 5. Advance & render pooled 3D octahedron burst sparkles
    for (let i = 0; i < sparks3D.length; i += 1) {
      const sp = sparks3D[i];
      if (!sp.active) continue;
      sp.life += dtSec;
      if (sp.life >= sp.maxLife) {
        sp.active = false;
        sp.mesh.visible = false;
        continue;
      }
      sp.vy -= 11.5 * dtSec;
      sp.offsetX += sp.vx * dtSec;
      sp.offsetY += sp.vy * dtSec;
      sp.offsetZ += sp.vz * dtSec;

      let pt: { x: number; y: number } | null = null;
      try {
        pt = mapRef.project([sp.lng, sp.lat]);
      } catch {
        pt = null;
      }
      if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) {
        sp.mesh.visible = false;
        continue;
      }
      const t = sp.life / sp.maxLife;
      const s = basePxUnit * (1 - t * 0.78);
      sp.mesh.visible = true;
      sp.mesh.position.set(
        pt.x + sp.offsetX * basePxUnit * 0.85,
        -pt.y + sp.offsetY * basePxUnit * 0.85,
        240 + sp.offsetZ * 10,
      );
      sp.mesh.scale.set(s, s, s);
      sp.mesh.rotation.x += 5.2 * dtSec;
      sp.mesh.rotation.y += 6.8 * dtSec;
      sp.mat.opacity = Math.max(0, (1 - t) * 0.95);
    }

    renderer.render(scene, camera);
  };

  const hasActiveBurstOrTransition = (): boolean => {
    if (isMoving || needsImmediateFrame) return true;
    for (let i = 0; i < shockwaves.length; i += 1) {
      if (shockwaves[i].active) return true;
    }
    for (let i = 0; i < sparks3D.length; i += 1) {
      if (sparks3D[i].active) return true;
    }
    for (let i = 0; i < entries.length; i += 1) {
      if (entries[i].exiting || entries[i].appearDelaySec > 0) return true;
    }
    return false;
  };

  const ensureLoop = () => {
    if (typeof window === 'undefined') return;
    if (rafId || !renderer || !mapRef || !enabled || entries.length === 0) return;

    const tick = (nowMs: number) => {
      rafId = 0;
      if (!renderer || !mapRef || !enabled || entries.length === 0) return;
      if (typeof document === 'undefined' || !document.hidden) {
        // Full 60 FPS during pans, transitions & tap VFX; calm ~24 FPS while settled so mobile stays cool!
        const minIntervalMs = hasActiveBurstOrTransition() ? 0 : isMobileLike ? 42 : 28;
        if (minIntervalMs === 0 || lastRenderMs === 0 || nowMs - lastRenderMs >= minIntervalMs) {
          needsImmediateFrame = false;
          renderFrame(nowMs);
        }
      }
      if (!reducedMotion || needsImmediateFrame) {
        rafId = window.requestAnimationFrame(tick);
      }
    };
    rafId = window.requestAnimationFrame(tick);
  };

  // Single coalesced rAF scheduler: NEVER render synchronously 4x inside MapLibre's move/zoom/pitch/rotate events!
  const onMapMove = () => {
    if (!renderer || !mapRef || !enabled) return;
    needsImmediateFrame = true;
    if (!rafId && typeof window !== 'undefined') {
      ensureLoop();
    }
  };

  const disposeEntry = (entry: MeshEntry) => {
    scene?.remove(entry.root);
    for (const geo of entry.ownedGeos) geo.dispose();
    for (const mat of entry.ownedMats) mat.dispose();
    entry.ownedGeos.length = 0;
    entry.ownedMats.length = 0;
  };

  const clearMeshes = () => {
    screenCache.clear();
    for (const entry of entries) {
      disposeEntry(entry);
    }
    if (assets) {
      for (const geo of assets.geometries) geo.dispose();
      for (const mat of assets.materials) mat.dispose();
      assets.geometries = [];
      assets.materials = [];
    }
    entries = [];
    currentSignature = '';
  };

  const createEntry = (item: Floating3DItem, staggerIndex: number): MeshEntry => {
    const ownedGeos: THREE.BufferGeometry[] = [];
    const ownedMats: THREE.Material[] = [];
    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      ownedGeos.push(g);
      return g;
    };
    const trackMat = <T extends THREE.Material>(m: T): T => {
      ownedMats.push(m);
      return m;
    };

    const root = new THREE.Group();
    const accent = accentColorForKind(item.kind);

    const shadowMat = trackMat(
      new THREE.MeshBasicMaterial({
        map: assets?.shadowTexture ?? undefined,
        color: assets?.shadowTexture ? 0xffffff : 0x0f1c18,
        transparent: true,
        opacity: assets?.shadowTexture ? 0.92 : 0.34,
        depthWrite: false,
      }),
    );
    const shadow = new THREE.Mesh(assets!.shadowGeo, shadowMat);
    root.add(shadow);

    const ringMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: item.id === selectedId || item.selected ? 0.92 : 0.38,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    const ring = new THREE.Mesh(assets!.ringGeo, ringMat);
    root.add(ring);

    const beaconMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: accent,
        roughness: 0.24,
        metalness: 0.18,
        emissive: accent,
        emissiveIntensity: 0.2,
        flatShading: true,
      }),
    );
    const beacon = new THREE.Mesh(assets!.beaconGeo, beaconMat);
    beacon.scale.set(0.82, 1.22, 0.82);
    beacon.visible = false;
    root.add(beacon);

    const zNow = mapRef?.getZoom?.() ?? 12;
    const initialProfile = resolve3DVisualProfile(item.kind, zNow, {
      selected: item.id === selectedId || Boolean(item.selected),
      activeCategory,
    });

    const glbInstance = glbRegistry?.createInstance(item.kind) ?? null;
    let body: THREE.Group;
    let animatedParts: THREE.Object3D[] = [];
    let usesGlb = false;
    let glbRequested = false;

    if (glbInstance) {
      body = glbInstance;
      usesGlb = true;
      glbRequested = true;
    } else {
      const built = buildProcedural3DModel(item.kind, trackGeo, trackMat);
      body = built.group;
      animatedParts = built.animatedParts;
      // Only fetch GLB immediately if already in `full` or `compact` LOD; beacon-LOD waits until zoomed in
      if (initialProfile.lodMode !== 'beacon') {
        glbRequested = true;
        glbRegistry?.requestModel(item.kind, () => swapReadyGlbForKind(item.kind));
      }
    }
    root.add(body);

    scene!.add(root);
    const phase = (phaseCursor * 0.77) % (Math.PI * 2);
    phaseCursor += 1;

    return {
      item,
      root,
      body,
      beacon,
      shadow,
      ring,
      phase,
      extraSpinRad: 0,
      animatedParts,
      usesGlb,
      glbRequested,
      currentLod: initialProfile.lodMode,
      ownedGeos,
      ownedMats,
      exiting: false,
      appearDelaySec: reducedMotion ? 0 : Math.min(0.24, staggerIndex * 0.03),
    };
  };

  const swapReadyGlbForKind = (kind: Floating3DEntityKind) => {
    if (!glbRegistry) return;
    let swapped = false;
    for (const entry of entries) {
      if (entry.item.kind !== kind || entry.usesGlb || entry.exiting) continue;
      const glbInstance = glbRegistry.createInstance(kind);
      if (!glbInstance) continue;
      glbInstance.position.copy(entry.body.position);
      glbInstance.rotation.copy(entry.body.rotation);
      glbInstance.scale.copy(entry.body.scale);
      entry.root.remove(entry.body);
      entry.body = glbInstance;
      entry.animatedParts = [];
      entry.usesGlb = true;
      entry.root.add(glbInstance);
      // Gentle elastic micro-bloom when the real Meshy GLB takes over
      const st = springStates.get(entry.item.id);
      if (st && !reducedMotion) {
        st.spawnScale = Math.min(st.spawnScale, 0.86);
        st.spawnVel = Math.max(st.spawnVel, 2.2);
      }
      swapped = true;
    }
    if (swapped) {
      onMapMove();
    }
  };

  /**
   * Incremental per-ID scene diffing:
   * - Unchanged entries keep their live Three.js mesh, animation phase & spring state (0 flicker!)
   * - Exiting entries smoothly fade to alpha=0 before being detached & disposed
   * - Entering entries pop in with a soft center-outward stagger wave
   */
  const syncEntries = () => {
    if (!scene || !assets) return;
    if (!enabled) {
      clearMeshes();
      stopLoop();
      renderer?.clear();
      return;
    }

    const capped = currentItems.slice(0, maxActive3DItems);
    if (capped.length === 0 && entries.length === 0) {
      stopLoop();
      renderer?.clear();
      return;
    }

    const existingById = new Map<string, MeshEntry>();
    for (const entry of entries) {
      existingById.set(entry.item.id, entry);
    }

    const nextActiveIds = new Set<string>();
    let addedCount = 0;

    for (let i = 0; i < capped.length; i += 1) {
      const item = capped[i];
      if (!Number.isFinite(item.lng) || !Number.isFinite(item.lat)) continue;
      nextActiveIds.add(item.id);

      const existing = existingById.get(item.id);
      if (existing && existing.item.kind === item.kind) {
        // Keep live WebGL mesh & spring intact; cancel any pending exit fade!
        existing.item = item;
        existing.exiting = false;
        const ringMat = existing.ring.material as THREE.MeshBasicMaterial;
        ringMat.color.setHex(accentColorForKind(item.kind));
      } else {
        if (existing) {
          // Kind changed for same ID -> replace cleanly
          disposeEntry(existing);
          const idx = entries.indexOf(existing);
          if (idx >= 0) entries.splice(idx, 1);
        }
        const created = createEntry(item, addedCount);
        addedCount += 1;
        entries.push(created);
      }
    }

    // Mark departed entries as exiting (fade out gracefully over ~200ms) or remove immediately in reducedMotion
    if (reducedMotion) {
      const kept: MeshEntry[] = [];
      for (const entry of entries) {
        if (!nextActiveIds.has(entry.item.id)) {
          disposeEntry(entry);
          springStates.delete(entry.item.id);
        } else {
          kept.push(entry);
        }
      }
      entries = kept;
    } else {
      for (const entry of entries) {
        if (!nextActiveIds.has(entry.item.id)) {
          entry.exiting = true;
        }
      }
    }

    currentSignature = itemsSignature(capped);
    renderFrame(typeof performance !== 'undefined' ? performance.now() : Date.now());
    ensureLoop();
  };

  return {
    attach(map: MapLibreMap, canvas: HTMLCanvasElement) {
      mapRef = map;
      canvasRef = canvas;

      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(0, 390, 0, -844, -1000, 1000);
      camera.position.set(0, 0, 500);

      // Neopolis sunlit 3-point diorama lighting: warm top-left key + bright sky fill + cool rim
      const hemi = new THREE.HemisphereLight(0xf8fcff, 0x3f5e4d, 1.48);
      scene.add(hemi);

      const keyLight = new THREE.DirectionalLight(0xfff6e0, 1.82);
      keyLight.position.set(-140, 220, 260);
      scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight(0xbbe6ff, 0.8);
      rimLight.position.set(180, -80, 180);
      scene.add(rimLight);

      assets = {
        shadowTexture: createRadialShadowTexture(),
        shadowGeo: new THREE.CircleGeometry(1.18, 28),
        ringGeo: new THREE.RingGeometry(0.92, 1.18, 28),
        shockwaveGeo: new THREE.RingGeometry(0.86, 1.08, 32),
        sparkGeo: new THREE.OctahedronGeometry(0.24, 0),
        beaconGeo: new THREE.OctahedronGeometry(0.66, 0),
        geometries: [],
        materials: [],
      };

      // Pre-allocate pooled 3D shockwave rings & sparkle burst meshes (zero GC at runtime)
      for (let i = 0; i < SHOCKWAVE_POOL_SIZE; i += 1) {
        const mat = new THREE.MeshBasicMaterial({
          color: 0x17402c,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(assets.shockwaveGeo, mat);
        mesh.visible = false;
        scene.add(mesh);
        shockwaves.push({
          active: false,
          lng: 0,
          lat: 0,
          life: 0,
          maxLife: 0.7,
          delay: 0,
          mesh,
          mat,
        });
      }

      for (let i = 0; i < SPARK_POOL_SIZE; i += 1) {
        const mat = new THREE.MeshBasicMaterial({
          color: 0xfacc15,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(assets.sparkGeo, mat);
        mesh.visible = false;
        scene.add(mesh);
        sparks3D.push({
          active: false,
          lng: 0,
          lat: 0,
          offsetX: 0,
          offsetY: 0,
          offsetZ: 0,
          vx: 0,
          vy: 0,
          vz: 0,
          life: 0,
          maxLife: 0.6,
          mesh,
          mat,
        });
      }

      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        // Disabling MSAA on mobile cuts GPU fillrate cost by ~2.5x while staying crisp on high-DPI screens
        antialias: !isMobileLike,
        powerPreference: 'high-performance',
      });
      renderer.setClearColor(0x000000, 0);
      renderer.autoClear = true;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.14;

      // Subtle studio IBL environment so Meshy PBR materials (gold, glass, clay, timber) pop vibrantly
      try {
        const pmrem = new THREE.PMREMGenerator(renderer);
        envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
        scene.environment = envRT.texture;
        pmrem.dispose();
      } catch {
        envRT = null;
      }

      glbRegistry = createExplorerGlbRegistry();
      unsubscribeGlbPending = glbRegistry.onPendingChange((count) => {
        for (const listener of pendingGlbListeners) listener(count);
      });
      glbRegistry.preloadCoreModels();

      syncCanvasSize();
      map.on('move', onMapMove);
      map.on('zoom', onMapMove);
      map.on('pitch', onMapMove);
      map.on('rotate', onMapMove);

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          syncCanvasSize();
          onMapMove();
        });
        resizeObserver.observe(canvas);
      }

      syncEntries();
    },

    setItems(items: Floating3DItem[]) {
      const capped = items.slice(0, maxActive3DItems);
      const nextSig = itemsSignature(capped);
      currentItems = capped;

      // Fast path: identical active set -> update metadata in place, zero scene churn!
      if (
        nextSig === currentSignature &&
        entries.length === capped.length &&
        entries.every((e) => !e.exiting)
      ) {
        for (let i = 0; i < capped.length; i += 1) {
          entries[i].item = capped[i];
        }
        return;
      }

      syncEntries();
    },

    setSelectedId(nextId: string | null) {
      if (selectedId === nextId) return;
      selectedId = nextId;
      if (nextId) {
        const st = springStates.get(nextId);
        if (st) triggerTapJuice(st, reducedMotion);
        const match = entries.find((e) => e.item.id === nextId);
        if (match) {
          spawn3DImpactVfx(match.item.lng, match.item.lat, accentColorForKind(match.item.kind));
        }
      }
      onMapMove();
    },

    setActiveCategory(nextCategory: string | null) {
      if (activeCategory === nextCategory) return;
      activeCategory = nextCategory;
      onMapMove();
    },

    setMoving(moving: boolean) {
      if (isMoving === moving) return;
      isMoving = moving;
      // Pause heavy Draco GLB decodes while actively panning; never resize WebGL framebuffer!
      glbRegistry?.setPaused(moving);
      if (moving) {
        onMapMove();
      }
    },

    setEnabled(next: boolean) {
      if (enabled === next) return;
      enabled = next;
      syncEntries();
    },

    setReducedMotion(next: boolean) {
      reducedMotion = next;
      if (next) stopLoop();
      else ensureLoop();
    },

    setSafeBounds(topPx: number, bottomPx: number) {
      safeTopPx = Math.max(40, topPx);
      safeBottomPx = Math.max(safeTopPx + 40, bottomPx);
    },

    setPointerScreenPos(x: number | null, y: number | null) {
      pointerX = x;
      pointerY = y;
    },

    onPendingGlbChange(cb: (count: number) => void) {
      pendingGlbListeners.add(cb);
      if (glbRegistry) cb(glbRegistry.getPendingCount());
      return () => {
        pendingGlbListeners.delete(cb);
      };
    },

    triggerSelectionJuice(id: string) {
      const st = springStates.get(id);
      if (st) {
        triggerTapJuice(st, reducedMotion);
      }
      const match = entries.find((e) => e.item.id === id);
      if (match) {
        spawn3DImpactVfx(match.item.lng, match.item.lat, accentColorForKind(match.item.kind));
      }
    },

    getScreenPos(id: string) {
      const hit = screenCache.get(id);
      return hit ? { x: hit.x, y: hit.y } : null;
    },

    pickAtPoint(x: number, y: number, hitRadiusPx = 44): Floating3DItem | null {
      let best: Floating3DItem | null = null;
      let bestDistSq = hitRadiusPx * hitRadiusPx;
      for (const entry of screenCache.values()) {
        // Capsule distance along vertical segment from floating body top (`entry.y`) to ground ring (`entry.groundY`)
        const dx = entry.x - x;
        const clampedY = Math.max(entry.y, Math.min(entry.groundY, y));
        const dy = clampedY - y;
        const dSq = dx * dx + dy * dy;
        if (dSq <= bestDistSq) {
          bestDistSq = dSq;
          best = entry.item;
        }
      }
      return best;
    },

    dispose() {
      stopLoop();
      resizeObserver?.disconnect();
      resizeObserver = null;
      if (mapRef) {
        mapRef.off('move', onMapMove);
        mapRef.off('zoom', onMapMove);
        mapRef.off('pitch', onMapMove);
        mapRef.off('rotate', onMapMove);
      }
      clearMeshes();
      unsubscribeGlbPending?.();
      unsubscribeGlbPending = null;
      pendingGlbListeners.clear();
      glbRegistry?.dispose();
      glbRegistry = null;
      if (scene) scene.environment = null;
      envRT?.dispose();
      envRT = null;
      for (const sw of shockwaves) {
        scene?.remove(sw.mesh);
        sw.mat.dispose();
      }
      shockwaves.length = 0;
      for (const sp of sparks3D) {
        scene?.remove(sp.mesh);
        sp.mat.dispose();
      }
      sparks3D.length = 0;
      springStates.clear();
      assets?.shadowTexture?.dispose();
      assets?.shadowGeo.dispose();
      assets?.ringGeo.dispose();
      assets?.shockwaveGeo.dispose();
      assets?.sparkGeo.dispose();
      assets?.beaconGeo.dispose();
      assets = null;
      renderer?.dispose();
      renderer = null;
      scene = null;
      camera = null;
      canvasRef = null;
      mapRef = null;
    },
  };
}
