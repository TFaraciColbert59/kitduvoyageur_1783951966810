/**
 * Carte vivante v5 : ce que la vue courante affiche (niveau de détail, points utiles retenus, libellés,
 * décalage des nuits possibles). PUR : la carte lui prête sa projection ; rien ici ne touche MapLibre ni le DOM.
 * Recalculé à la fin d'un mouvement, jamais pendant : les marqueurs suivent la carte sans repasser par React.
 */
import {
  lodOf,
  placeAlternatives,
  placeLabels,
  placeNameOf,
  selectPoiMarkers,
  type Bounds,
  type LabelCandidate,
  type LabelPlacement,
  type Lod,
  type PoiCandidate,
  type Rect,
  type TripGeometry,
} from './mapModel';

export interface ViewNight {
  day: number;
  chosen: { id: string; lat: number; lon: number } | null;
  alternatives: ReadonlyArray<{ id: string; lat: number; lon: number }>;
}

export interface ViewInput {
  zoom: number;
  size: { width: number; height: number };
  /** Zone visible, pour écarter ce qui est hors champ. */
  viewport: Bounds | null;
  project: (lat: number, lon: number) => { x: number; y: number };
  geometry: TripGeometry;
  /** Calque « Étapes » : pastilles et libellés. */
  showSteps: boolean;
  /** Calque des nuits : photos et nuits possibles. */
  showNights: boolean;
  nights: readonly ViewNight[];
  /** Jour ouvert : ses nuits possibles sont affichées. */
  openDay: number | null;
  /** Points utiles déjà filtrés par calque. */
  pois: readonly PoiCandidate[];
  /** Point dont la bulle est ouverte : toujours gardé. */
  keepPoi: string | null;
}

export interface MapView {
  lod: Lod;
  poiIds: string[];
  labels: LabelPlacement[];
  /** Décalage d'écran des nuits possibles du jour ouvert, par `${jour}:${id}`. */
  alts: Record<string, { offsetX: number; offsetY: number }>;
  /** Empreinte : sert à ne rien redessiner quand rien n'a changé. */
  key: string;
}

const PIN_RADIUS = 14;
const NIGHT_BOX = { halfW: 34, up: 30, down: 40 };
const ALT_RADIUS = 20;

const around = (p: { x: number; y: number }, r: number): Rect => ({ x: p.x - r, y: p.y - r, w: r * 2, h: r * 2 });

export function computeMapView(i: ViewInput): MapView {
  const lod = lodOf(i.zoom);
  const finite = (p: { x: number; y: number }) => Number.isFinite(p.x) && Number.isFinite(p.y);

  // Ce qui occupe déjà la carte : pastilles d'étape, nuits retenues et possibles.
  const pins: Array<{ id: string; x: number; y: number; text: string; priority: number }> = [];
  if (i.showSteps) {
    if (i.geometry.origin) {
      const p = i.project(i.geometry.origin.lat, i.geometry.origin.lon);
      if (finite(p)) pins.push({ id: 'origin', ...p, text: placeNameOf(i.geometry.origin.title), priority: 5 });
    }
    for (const s of i.geometry.stages) {
      const p = i.project(s.lat, s.lon);
      if (finite(p)) pins.push({ id: `day:${s.day}`, ...p, text: placeNameOf(s.title), priority: s.day === i.openDay ? 10 : 1 });
    }
  }
  const obstacles: Rect[] = pins.map((p) => around(p, PIN_RADIUS));

  const anchors: Array<{ x: number; y: number }> = [];
  const altCandidates: Array<{ id: string; x: number; y: number }> = [];
  if (i.showNights) {
    for (const n of i.nights) {
      if (n.chosen) {
        const p = i.project(n.chosen.lat, n.chosen.lon);
        if (finite(p)) {
          obstacles.push({ x: p.x - NIGHT_BOX.halfW, y: p.y - NIGHT_BOX.up, w: NIGHT_BOX.halfW * 2, h: NIGHT_BOX.up + NIGHT_BOX.down });
          if (n.day === i.openDay) anchors.push(p);
        }
      }
      if (n.day === i.openDay) {
        for (const a of n.alternatives) {
          const p = i.project(a.lat, a.lon);
          if (finite(p)) altCandidates.push({ id: `${n.day}:${a.id}`, x: p.x, y: p.y });
        }
      }
    }
  }
  const pinAnchors = i.openDay != null ? pins.filter((p) => p.id === `day:${i.openDay}`) : [];
  const altPlacements = placeAlternatives([...anchors, ...pinAnchors], altCandidates);
  const alts: MapView['alts'] = {};
  altPlacements.forEach((p, k) => {
    alts[p.id] = { offsetX: p.offsetX, offsetY: p.offsetY };
    const base = altCandidates[k];
    obstacles.push(around({ x: base.x + p.offsetX, y: base.y + p.offsetY }, ALT_RADIUS));
  });

  const pois = selectPoiMarkers(i.pois, {
    lod,
    viewport: i.viewport,
    project: i.project,
    obstacles,
    keep: i.keepPoi ? new Set([i.keepPoi]) : undefined,
  });
  for (const p of pois) {
    const xy = i.project(p.lat, p.lon);
    if (finite(xy)) obstacles.push(around(xy, 18));
  }

  const candidates: LabelCandidate[] = lod === 'low' ? [] : pins.map((p) => ({ id: p.id, x: p.x, y: p.y, text: p.text, priority: p.priority, radius: PIN_RADIUS }));
  const labels = placeLabels(candidates, { width: i.size.width, height: i.size.height, obstacles });

  const poiIds = pois.map((p) => p.id);
  const key = JSON.stringify([lod, poiIds, labels.map((l) => [l.id, l.side]), alts]);
  return { lod, poiIds, labels, alts, key };
}
