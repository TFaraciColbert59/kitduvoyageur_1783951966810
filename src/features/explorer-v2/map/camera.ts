import type { Map as MapLibreMap, LngLatBoundsLike } from 'maplibre-gl';
import type { Level } from '../state/types';

/**
 * Chorégraphie caméra de l'Explorer v2 (04_CARTE.md §3).
 *
 * Six mouvements, tous interrompus par le premier geste utilisateur (`movestart`
 * d'origine utilisateur géré par MapLibre : tout `flyTo`/`easeTo` en cours est
 * annulé dès que le doigt touche la carte).
 *
 * Avec `prefers-reduced-motion` : `jumpTo` immédiat, aucune trajectoire.
 * Le `padding` intègre toujours la hauteur du tiroir et de l'Island.
 */

export const LEVEL_ZOOM: Record<Level, number> = { 0: 1.6, 1: 4.8, 2: 7.2, 3: 12 };

export const FLY_DURATION_MS = 1050;
export const REVEAL_EASE_MS = 980;
export const FOLLOW_EASE_MS = 580;
export const OVERVIEW_MS = 680;
export const ORBIT_TURN_S = 40;

/**
 * Courbe cinématique quintique douce (départ soyeux, glisse longue sans à-coup à l'arrivée).
 * Strictement bornée dans [0, 1] comme exigé par MapLibre.
 */
export function easeCinematicOut(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - x, 4);
}

/**
 * Courbe cinématique en S (accélération gracieuse + longue décélération douce pour les vols longs).
 */
export function easeCinematicInOut(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Applique la physique d'inertie ultra-douce Explorer (glisse soyeuse type Apple Maps / iOS natif
 * et zoom molette/trackpad progressif sans paliers brusques).
 */
export function applyExplorerSilkyPhysics(map: MapLibreMap): void {
  try {
    map.dragPan?.enable?.({
      linearity: 0.12,
      maxSpeed: 2800,
      deceleration: 920,
    });
  } catch {
    /* fallback défaut */
  }
  try {
    map.scrollZoom?.setWheelZoomRate?.(1 / 230);
    map.scrollZoom?.setZoomRate?.(1 / 92);
  } catch {
    /* ignore */
  }
  try {
    map.touchZoomRotate?.enable?.();
    map.touchPitch?.enable?.();
    map.doubleClickZoom?.enable?.();
  } catch {
    /* ignore */
  }
}

/**
 * Hauteur réelle occupée en bas par le tiroir Explorer selon son cran (`peek` / `mid` / `full`).
 * Correspond exactement au CSS de `.xp20-drawer` (`peek`: 82px + 76px nav, `mid`: 56dvh, `full`: 86dvh).
 */
export function effectiveDrawerOcclusionPx(
  detent: 'peek' | 'low' | 'mid' | 'full',
  viewportHeightPx = 844,
): number {
  const vh = Math.max(480, Number.isFinite(viewportHeightPx) ? viewportHeightPx : 844);
  if (detent === 'full') return Math.round(vh * 0.86);
  if (detent === 'mid') return Math.round(vh * 0.56);
  if (detent === 'low') return Math.round(vh * 0.34);
  return 164;
}

/**
 * Calcule le rectangle visible exact de la carte au-dessus du tiroir et le point
 * d'ancrage écran idéal pour qu'un objet 3D flottant apparaisse plein centre.
 */
export function visibleMapFrame(
  viewportWidthPx: number,
  viewportHeightPx: number,
  sheetHeightPx: number,
): { top: number; bottom: number; centerX: number; centerY: number } {
  const vw = Math.max(320, Number.isFinite(viewportWidthPx) ? viewportWidthPx : 390);
  const vh = Math.max(420, Number.isFinite(viewportHeightPx) ? viewportHeightPx : 844);
  const top = 64;
  const maxSafeSheet = Math.max(96, Math.round(vh * 0.64));
  const clampedSheet = Math.min(Math.max(96, Math.round(sheetHeightPx)), maxSafeSheet);
  const bottom = Math.max(top + 110, vh - clampedSheet);
  return {
    top,
    bottom,
    centerX: Math.round(vw * 0.5),
    // Ancre sol à 58% de la fenêtre visible pour que le modèle 3D flottant (~26 px au-dessus)
    // trône pile au centre optique entre le chrome haut et le bord supérieur du tiroir.
    centerY: Math.round(top + (bottom - top) * 0.58),
  };
}

/**
 * Marge qui centre automatiquement la carte et tout objet 3D cliqué exactement
 * au milieu de la zone visible AU-DESSUS du tiroir, sans jamais dépasser le viewport.
 */
export function focusTargetPadding(
  sheetHeightPx: number,
  viewportHeightPx = 844,
): CameraPadding {
  const vh = Math.max(420, Number.isFinite(viewportHeightPx) ? viewportHeightPx : 844);
  const top = 64;
  // Plafonne la marge basse à 64% du viewport pour que top + bottom laisse toujours
  // une fenêtre de cadrage saine (même en cran `full` ou sur petit écran paysage).
  const maxSafeBottom = Math.max(96, Math.round(vh * 0.64));
  const rawBottom = Math.max(96, Math.round(sheetHeightPx) + 14);
  return {
    top,
    bottom: Math.min(rawBottom, maxSafeBottom),
    left: 20,
    right: 20,
  };
}

function approxKmBetween(a: [number, number], b: [number, number]): number {
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

export interface CameraPadding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** Marge haute qui place l'utilisateur au tiers bas de l'écran en suivi. */
export function followPadding(viewportHeight: number, sheetHeight: number): CameraPadding {
  return {
    top: Math.round(viewportHeight * 0.62),
    bottom: Math.round(sheetHeight) + 16,
    left: 24,
    right: 24,
  };
}

/** Marge qui laisse le tracé entièrement visible au-dessus du tiroir (mobile) ou à droite du tiroir latéral (desktop ≥960px). */
export function overviewPadding(viewportWidth: number, sheetHeight: number): CameraPadding {
  if (viewportWidth >= 960) {
    return {
      top: 68,
      bottom: 48,
      left: 444,
      right: 64,
    };
  }
  return {
    top: 96,
    bottom: Math.round(sheetHeight) + 24,
    left: 24,
    right: Math.max(24, Math.round(viewportWidth * 0.06)),
  };
}

/** Zoom de suivi selon la vitesse de déplacement (m/s). */
export function followZoomForSpeed(speedMs: number, level: Level): number {
  if (level !== 3) return LEVEL_ZOOM[level];
  if (speedMs < 1.2) return 15;
  if (speedMs < 2.6) return 15.5;
  if (speedMs < 5.5) return 15;
  if (speedMs < 9) return 14.8;
  return 14.2;
}

/** Plongée entre niveaux : centre = point touché, zoom du niveau avec cadrage au-dessus du tiroir. */
export function flyToLevel(
  map: MapLibreMap,
  center: [number, number],
  level: Level,
  reducedMotion: boolean,
  options: { sheetHeightPx?: number; viewportHeightPx?: number } = {},
): void {
  const padding = focusTargetPadding(options.sheetHeightPx ?? 164, options.viewportHeightPx ?? 844);
  map.flyTo({
    center,
    zoom: LEVEL_ZOOM[level],
    pitch: level >= 3 ? 48 : level === 2 ? 32 : 0,
    padding,
    duration: reducedMotion ? 0 : FLY_DURATION_MS,
    curve: 1.32,
    speed: 1.25,
    easing: easeCinematicInOut,
    essential: true,
  });
}

/**
 * Zoom cinématique au démarrage : depuis la vue Terre entière (globe) vers la
 * position réelle de l'utilisateur en perspective topographique 3D (48°), centré au-dessus du tiroir.
 */
export function cinematicStartupZoom(
  map: MapLibreMap,
  targetCenter: [number, number],
  reducedMotion: boolean,
  options: { sheetHeightPx?: number; viewportHeightPx?: number } = {},
): void {
  const padding = focusTargetPadding(options.sheetHeightPx ?? 164, options.viewportHeightPx ?? 844);
  if (reducedMotion) {
    map.jumpTo({ center: targetCenter, zoom: 12.2, pitch: 48, padding });
    return;
  }
  map.flyTo({
    center: targetCenter,
    zoom: 12.2,
    pitch: 48,
    padding,
    duration: 1150,
    curve: 1.35,
    speed: 1.35,
    easing: easeCinematicOut,
    essential: true,
  });
}

/**
 * Centrage doux sur un point touché de la carte (garde toujours le point visé au centre
 * du cadre visible au-dessus du tiroir, avec compensation automatique du relief 3D).
 */
export function centerAt(
  map: MapLibreMap,
  center: [number, number],
  reducedMotion: boolean,
  options: {
    sheetHeightPx?: number;
    viewportWidthPx?: number;
    viewportHeightPx?: number;
    zoom?: number;
    durationMs?: number;
  } = {},
): void {
  const container = map.getContainer?.();
  const vw = options.viewportWidthPx ?? container?.clientWidth ?? 390;
  const vh = options.viewportHeightPx ?? container?.clientHeight ?? 844;
  const sheetH = options.sheetHeightPx ?? 164;
  const padding = focusTargetPadding(sheetH, vh);
  const frame = visibleMapFrame(vw, vh, sheetH);

  let cancelled = false;
  const cancel = () => {
    cancelled = true;
    map.off('dragstart', cancel);
    map.off('wheel', cancel);
  };
  map.on('dragstart', cancel);
  map.on('wheel', cancel);

  const lockOnce = () => {
    map.off('dragstart', cancel);
    map.off('wheel', cancel);
    if (cancelled) return;
    try {
      const pt = map.project(center);
      if (pt && Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
        const errX = pt.x - frame.centerX;
        const errY = pt.y - frame.centerY;
        const maxPanX = Math.round(vw * 0.65);
        const maxPanY = Math.round(vh * 0.55);
        if (
          Math.hypot(errX, errY) > 12 &&
          Math.abs(errX) <= vw * 1.1 &&
          Math.abs(errY) <= vh * 1.1
        ) {
          map.panBy(
            [
              Math.max(-maxPanX, Math.min(maxPanX, errX)),
              Math.max(-maxPanY, Math.min(maxPanY, errY)),
            ],
            {
              duration: reducedMotion ? 0 : 240,
              easing: easeCinematicOut,
              essential: true,
            },
          );
        }
      }
    } catch {
      /* ignore */
    }
  };

  if (reducedMotion) {
    map.jumpTo({
      center,
      ...(typeof options.zoom === 'number' ? { zoom: options.zoom } : {}),
      padding,
    });
    lockOnce();
    return;
  }
  map.once('moveend', lockOnce);
  map.easeTo({
    center,
    ...(typeof options.zoom === 'number' ? { zoom: options.zoom } : {}),
    padding,
    duration: options.durationMs ?? 560,
    easing: easeCinematicOut,
    essential: true,
  });
}

/**
 * Révélation cinématique d'un élément 3D cliqué (POI, Carnet, Bouteille, Club, Pokédex) :
 * - Cadre automatiquement la cible au centre EXACT de la carte visible AU-DESSUS du tiroir (`padding`)
 * - Saut proche (< 4 km) : glisse `easeTo` soyeuse + perspective 3D 46°
 * - Vol moyen/long (>= 4 km) : arc parabolique `flyTo` (van Wijk) avec décélération cinématique
 * - **Boucle fermée de compensation du relief 3D** : en montagne (ex. sommet 2 285 m ou 4 808 m
 *   avec exagération 1.5x), MapLibre projette la surface 3D plus haut que le niveau de la mer ;
 *   à l'arrivée, on mesure `map.project(center)` et on corrige automatiquement l'écart exact
 *   par `panBy` pour verrouiller le POI 3D plein centre (annulé immédiatement si l'utilisateur glisse).
 */
export function revealAt(
  map: MapLibreMap,
  center: [number, number],
  reducedMotion: boolean,
  options: {
    targetZoom?: number;
    sheetHeightPx?: number;
    viewportWidthPx?: number;
    viewportHeightPx?: number;
    onArrive?: () => void;
  } = {},
): void {
  const container = map.getContainer?.();
  const vw = options.viewportWidthPx ?? container?.clientWidth ?? 390;
  const vh = options.viewportHeightPx ?? container?.clientHeight ?? 844;
  const sheetH = options.sheetHeightPx ?? 420;

  const currentZoom = map.getZoom();
  const desiredZoom = Math.min(
    16.2,
    Math.max(
      options.targetZoom ?? 13.8,
      currentZoom >= 13.5 ? Math.min(15.6, currentZoom + 0.65) : 14.0,
    ),
  );
  const padding = focusTargetPadding(sheetH, vh);
  const frame = visibleMapFrame(vw, vh, sheetH);

  // Arrête proprement toute glisse ou transition de padding en cours pour ne pas entrer en conflit
  try {
    map.stop();
  } catch {
    /* ignore */
  }

  let cancelledByUser = false;
  const onUserInterrupt = () => {
    cancelledByUser = true;
    map.off('dragstart', onUserInterrupt);
    map.off('wheel', onUserInterrupt);
  };
  map.on('dragstart', onUserInterrupt);
  map.on('wheel', onUserInterrupt);

  const cleanupInterrupt = () => {
    map.off('dragstart', onUserInterrupt);
    map.off('wheel', onUserInterrupt);
  };

  // Boucle fermée écran : compense la hauteur réelle du DEM 3D (montagnes/sommets)
  // afin que `map.project(center)` tombe exactement sur `(frame.centerX, frame.centerY)`.
  const lockProjectedCenter = (pass: number) => {
    if (cancelledByUser) {
      cleanupInterrupt();
      return;
    }
    let pt: { x: number; y: number } | null = null;
    try {
      pt = map.project(center);
    } catch {
      pt = null;
    }
    if (pt && Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
      const errX = pt.x - frame.centerX;
      const errY = pt.y - frame.centerY;
      // Garde anti-décrochage perspective : si `map.project(center)` dépasse 1.1x l'écran
      // (sommet passé derrière le plan proche sur une falaise abrupte), on recadre proprement
      // via `easeTo` à pitch réduit (36°) au lieu d'un `panBy` géant.
      if (Math.abs(errX) > vw * 1.1 || Math.abs(errY) > vh * 1.1) {
        if (pass === 0) {
          map.once('moveend', () => lockProjectedCenter(1));
          map.easeTo({
            center,
            zoom: Math.min(desiredZoom, 14.2),
            pitch: 36,
            padding,
            duration: reducedMotion ? 0 : 320,
            easing: easeCinematicOut,
            essential: true,
          });
          return;
        }
        cleanupInterrupt();
        options.onArrive?.();
        return;
      }
      if (Math.hypot(errX, errY) > 10 && pass < 2) {
        const maxPanX = Math.round(vw * 0.65);
        const maxPanY = Math.round(vh * 0.55);
        map.once('moveend', () => lockProjectedCenter(pass + 1));
        map.panBy(
          [
            Math.max(-maxPanX, Math.min(maxPanX, errX)),
            Math.max(-maxPanY, Math.min(maxPanY, errY)),
          ],
          {
            duration: reducedMotion ? 0 : pass === 0 ? 280 : 180,
            easing: easeCinematicOut,
            essential: true,
          },
        );
        return;
      }
    }
    cleanupInterrupt();
    options.onArrive?.();
  };

  if (reducedMotion) {
    map.jumpTo({ center, zoom: desiredZoom, pitch: 46, padding });
    lockProjectedCenter(0);
    return;
  }

  const curr = map.getCenter();
  const distKm = approxKmBetween([curr.lng, curr.lat], center);

  map.once('moveend', () => lockProjectedCenter(0));

  if (distKm < 4) {
    map.easeTo({
      center,
      zoom: desiredZoom,
      pitch: 46,
      padding,
      duration: Math.min(REVEAL_EASE_MS, 820),
      easing: easeCinematicOut,
      essential: true,
    });
    return;
  }

  map.flyTo({
    center,
    zoom: desiredZoom,
    pitch: 46,
    padding,
    duration: Math.min(1650, Math.max(960, Math.round(850 + Math.log10(distKm + 1) * 300))),
    curve: 1.42,
    speed: 1.2,
    easing: easeCinematicInOut,
    essential: true,
  });
}

/** Suivi : cap en haut, pitch 60, zoom selon la vitesse, utilisateur au tiers bas. */
export function followAt(
  map: MapLibreMap,
  position: [number, number],
  headingDeg: number,
  speedMs: number,
  padding: CameraPadding,
  reducedMotion: boolean,
): void {
  map.easeTo({
    center: position,
    bearing: Number.isFinite(headingDeg) ? headingDeg : map.getBearing(),
    pitch: 60,
    zoom: followZoomForSpeed(speedMs, 3),
    padding,
    duration: reducedMotion ? 0 : FOLLOW_EASE_MS,
    essential: true,
  });
}

/** Vue d'ensemble : `fitBounds` sur la trace, pitch 0. */
export function overviewOf(
  map: MapLibreMap,
  bounds: LngLatBoundsLike | null,
  padding: CameraPadding,
  reducedMotion: boolean,
): void {
  if (!bounds) return;
  map.fitBounds(bounds, {
    padding,
    pitch: 0,
    bearing: 0,
    duration: reducedMotion ? 0 : OVERVIEW_MS,
    essential: true,
  });
}

/** Emprise [[ouest, sud], [est, nord]] d'une trace GeoJSON. */
export function boundsOfTrack(geometry: unknown): [[number, number], [number, number]] | null {
  const coordinates = (geometry as { coordinates?: unknown } | null)?.coordinates;
  if (!coordinates) return null;
  let w = 180;
  let s = 90;
  let e = -180;
  let n = -90;
  const walk = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      const [x, y] = value as [number, number];
      w = Math.min(w, x);
      e = Math.max(e, x);
      s = Math.min(s, y);
      n = Math.max(n, y);
      return;
    }
    for (const child of value) walk(child);
  };
  walk(coordinates);
  if (w === 180) return null;
  return [
    [w, s],
    [e, n],
  ];
}

/**
 * Survol de trace : la caméra parcourt la trace lissée sur ~200 m, regard
 * 300 m devant, pitch 55°. Durée proportionnelle à la distance, plafonnée à 20 s.
 */
export function flyoverTrack(
  map: MapLibreMap,
  points: Array<[number, number]>,
  reducedMotion: boolean,
  onProgress?: (index: number) => void,
): () => void {
  if (points.length < 2 || reducedMotion) {
    if (points.length >= 2) {
      map.jumpTo({ center: points[0], pitch: 55 });
    }
    return () => undefined;
  }

  const STEP_MS = 260;
  const maxDuration = 20_000;
  const total = Math.min(maxDuration, Math.max(3_000, points.length * STEP_MS));
  const stepMs = total / points.length;
  let index = 0;
  let cancelled = false;

  const tick = () => {
    if (cancelled) return;
    const point = points[index];
    const ahead = points[Math.min(points.length - 1, index + 3)] ?? point;
    const bearing = (Math.atan2(ahead[0] - point[0], ahead[1] - point[1]) * 180) / Math.PI;
    map.easeTo({
      center: point,
      bearing: Number.isFinite(bearing) ? bearing : 0,
      pitch: 55,
      zoom: 14.5,
      duration: stepMs,
      essential: false,
    });
    onProgress?.(index);
    index += 1;
    if (index >= points.length) {
      cancelled = true;
      return;
    }
    timer = window.setTimeout(tick, stepMs);
  };

  let timer = window.setTimeout(tick, 0);
  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}

/** Orbite de sommet : 360° en 40 s, pause au toucher, reprise après 6 s. */
export function orbitController(map: MapLibreMap, enabled: boolean): () => void {
  if (!enabled) return () => undefined;
  let bearing = map.getBearing();
  let paused = false;
  let resumeTimer: number | null = null;

  const interval = window.setInterval(() => {
    if (paused) return;
    bearing += (360 / ORBIT_TURN_S) * 0.1;
    map.rotateTo(bearing, { duration: 100 });
  }, 100);

  const onUserMove = (event: { originalEvent?: unknown }) => {
    if (!event.originalEvent) return;
    paused = true;
    if (resumeTimer) window.clearTimeout(resumeTimer);
    resumeTimer = window.setTimeout(() => {
      paused = false;
    }, 6000);
  };

  map.on('movestart', onUserMove as never);

  return () => {
    window.clearInterval(interval);
    if (resumeTimer) window.clearTimeout(resumeTimer);
    map.off('movestart', onUserMove as never);
  };
}
