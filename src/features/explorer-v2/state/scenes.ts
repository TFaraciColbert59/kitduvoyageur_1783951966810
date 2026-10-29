import type { ExplorerState, Level, Sport } from './types';

/**
 * Scènes nommées = états de la maquette (`maquette/ecrans.json`).
 * Un `?scene=<nom>` (développement et tests uniquement) charge directement
 * l'état complet, ce qui permet la parité visuelle écran par écran.
 *
 * Les coordonnées sont des coordonnées géographiques réelles (aucune donnée
 * inventée) : elles servent de centre de carte, jamais de contenu affiché.
 */

export const CHAMONIX: [number, number] = [6.8694, 45.9237];
export const BREVENT: [number, number] = [6.838, 45.9442];
export const CHESERYS: [number, number] = [6.883, 45.925];
export const LAC_BLANC: [number, number] = [6.8936, 45.9736];
export const GAILLANDS: [number, number] = [6.8498, 45.9068];
export const AIGUILLE_MIDI: [number, number] = [6.8874, 45.8786];
export const MONT_BLANC: [number, number] = [6.8652, 45.8326];
export const NAGANO: [number, number] = [138.1948, 36.6486];
export const TOKYO: [number, number] = [139.6503, 35.6762];
export const LYON: [number, number] = [4.8357, 45.764];

export const LEVEL_ZOOM: Record<Level, number> = { 0: 1.6, 1: 4.8, 2: 7.2, 3: 12 };

export interface ScenePreset extends Partial<ExplorerState> {
  /** Catégorie de repère sélectionné (aucun id réel en base pour certaines). */
  selectionKind?: ExplorerState['selection'];
  sport?: Sport;
}

const base: ExplorerState = {
  level: 0,
  geo: '',
  sheet: 'level',
  detent: 'peek',
  tab: 0,
  mini: 0,
  camera: { type: 'none' },
  profile: null,
  easyMode: false,
  theme: 'light',
  online: true,
  locationPermission: 'prompt',
  orbitPaused: false,
  northUp: true,
  units: 'metric',
  reveal: false,
  background: false,
  center: [2.35, 48.85],
  zoom: 1.6,
};

function scene(patch: Partial<ExplorerState>): ExplorerState {
  return { ...base, ...patch };
}

export const SCENE_NAMES = [
  'bienvenue',
  'monde',
  'pays',
  'region',
  'lieu',
  'sommet',
  'eau',
  'rando',
  'depart',
  'ia',
  'lancer',
  'course',
  'kayak',
  'randolive',
  'monde_jp',
  'japon',
  'nagano',
  'usa',
  'chili',
  'mongolie',
  'refuge',
  'bivouac',
  'vue',
  'danger',
  'acces',
  'ami',
  'velo',
  'ski',
  'escalade',
  'trail',
  'famille',
  'bivlive',
  'noloc',
  'offline',
  'nuit',
  'facile',
  'sos',
  'resume',
  'horstrace',
  'calques',
  'arriere',
] as const;

export type SceneName = (typeof SCENE_NAMES)[number];

function liveScene(sport: Sport, center: [number, number]): ExplorerState {
  return scene({
    level: 3,
    geo: 'FR',
    sheet: 'live',
    detent: 'peek',
    center,
    zoom: 15.5,
    activity: {
      sport,
      sessionId: 'scene',
      startedAt: Date.now() - 42 * 60 * 1000,
      paused: false,
      offRoute: false,
      distanceM: 7300,
      elevGainM: 460,
      movingS: 2400,
    },
    camera: { type: 'follow' },
  });
}

export const SCENES: Record<SceneName, ExplorerState> = {
  bienvenue: scene({ sheet: 'welcome', detent: 'full', zoom: 1.6 }),
  monde: scene({ level: 0, sheet: 'level', detent: 'peek', tab: 0 }),
  pays: scene({
    level: 1,
    geo: 'FR',
    sheet: 'level',
    detent: 'peek',
    tab: 0,
    center: [2.35, 46.6],
    zoom: 4.8,
  }),
  region: scene({
    level: 2,
    geo: 'FR',
    regionId: 'Auvergne-Rhône-Alpes',
    sheet: 'level',
    detent: 'low',
    tab: 0,
    mini: 0,
    center: LYON,
    zoom: 7.2,
  }),
  lieu: scene({
    level: 3,
    geo: 'FR',
    regionId: 'Auvergne-Rhône-Alpes',
    placeId: 'chamonix',
    sheet: 'level',
    detent: 'peek',
    tab: 0,
    mini: 1,
    center: CHAMONIX,
    zoom: 12,
  }),
  sommet: scene({
    level: 3,
    geo: 'FR',
    regionId: 'Auvergne-Rhône-Alpes',
    placeId: 'chamonix',
    selection: { kind: 'summit', id: 'brevent' },
    sheet: 'summit',
    detent: 'mid',
    tab: 0,
    center: BREVENT,
    zoom: 12,
    camera: { type: 'orbit', center: BREVENT },
  }),
  eau: scene({
    level: 3,
    geo: 'FR',
    regionId: 'Auvergne-Rhône-Alpes',
    placeId: 'chamonix',
    selection: { kind: 'water', id: 'cheserys' },
    sheet: 'water',
    detent: 'mid',
    tab: 0,
    center: CHESERYS,
    zoom: 12,
    camera: { type: 'reveal', center: CHESERYS },
  }),
  refuge: scene({
    level: 3,
    geo: 'FR',
    placeId: 'chamonix',
    selection: { kind: 'refuge', id: 'lac-blanc-refuge' },
    sheet: 'refuge',
    detent: 'mid',
    tab: 0,
    center: LAC_BLANC,
    zoom: 12,
    camera: { type: 'reveal', center: LAC_BLANC },
  }),
  bivouac: scene({
    level: 3,
    geo: 'FR',
    placeId: 'chamonix',
    selection: { kind: 'bivouac', id: 'bivouac' },
    sheet: 'bivouac',
    detent: 'mid',
    center: [6.8478, 45.9194],
    zoom: 12,
    camera: { type: 'reveal', center: [6.8478, 45.9194] },
  }),
  vue: scene({
    level: 3,
    geo: 'FR',
    placeId: 'chamonix',
    selection: { kind: 'viewpoint', id: 'belvedere' },
    sheet: 'viewpoint',
    detent: 'mid',
    center: [6.8492, 45.9135],
    zoom: 12,
    camera: { type: 'reveal', center: [6.8492, 45.9135] },
  }),
  danger: scene({
    level: 3,
    geo: 'FR',
    placeId: 'chamonix',
    selection: { kind: 'danger', id: 'neve' },
    sheet: 'danger',
    detent: 'mid',
    center: [6.8836, 45.9302],
    zoom: 12,
    camera: { type: 'reveal', center: [6.8836, 45.9302] },
  }),
  acces: scene({
    level: 3,
    geo: 'FR',
    placeId: 'chamonix',
    selection: { kind: 'access', id: 'acces' },
    sheet: 'access',
    detent: 'low',
    center: [6.8732, 45.9235],
    zoom: 12,
  }),
  ami: scene({
    level: 3,
    geo: 'FR',
    placeId: 'chamonix',
    selection: { kind: 'friend', id: 'ami' },
    sheet: 'friend',
    detent: 'mid',
    center: [6.8936, 45.9736],
    zoom: 12,
  }),
  rando: scene({
    level: 3,
    geo: 'FR',
    placeId: 'chamonix',
    selection: { kind: 'trail', id: 'lac-blanc' },
    sheet: 'trail',
    detent: 'mid',
    tab: 0,
    mini: 0,
    center: CHESERYS,
    zoom: 12,
  }),
  depart: scene({ level: 3, geo: 'FR', placeId: 'chamonix', sheet: 'depart', detent: 'mid', tab: 0, center: CHAMONIX, zoom: 12 }),
  ia: scene({ sheet: 'search', detent: 'full', center: CHAMONIX, zoom: 12 }),
  calques: scene({ level: 3, geo: 'FR', sheet: 'layers', detent: 'mid', center: CHAMONIX, zoom: 12 }),
  offline: scene({ sheet: 'offline', detent: 'mid', center: CHAMONIX, zoom: 12 }),
  lancer: scene({ level: 3, geo: 'FR', sheet: 'start', detent: 'low', tab: 0, center: CHAMONIX, zoom: 12 }),
  course: liveScene('course', CHAMONIX),
  kayak: liveScene('kayak', [6.148, 44.9]),
  randolive: liveScene('rando', CHAMONIX),
  velo: liveScene('velo', [6.8694, 45.8994]),
  ski: liveScene('ski', [6.8694, 45.8994]),
  escalade: liveScene('escalade', [6.8694, 45.8994]),
  trail: liveScene('trail', CHESERYS),
  famille: liveScene('famille', GAILLANDS),
  bivlive: scene({
    ...liveScene('bivouac', [6.8478, 45.9194]),
    theme: 'dark',
  }),
  horstrace: scene({
    ...liveScene('rando', CHAMONIX),
    activity: {
      sport: 'rando',
      sessionId: 'scene',
      startedAt: Date.now() - 90 * 60 * 1000,
      paused: false,
      offRoute: true,
      distanceM: 12400,
      elevGainM: 820,
      movingS: 5400,
    },
  }),
  sos: scene({ ...liveScene('rando', CHAMONIX), sheet: 'sos', detent: 'mid' }),
  resume: scene({
    level: 3,
    geo: 'FR',
    placeId: 'chamonix',
    sheet: 'summary',
    detent: 'full',
    tab: 0,
    center: CHESERYS,
    zoom: 11,
    camera: { type: 'overview' },
  }),
  arriere: scene({ ...liveScene('rando', CHAMONIX), background: true }),
  monde_jp: scene({ level: 0, sheet: 'previewCountry', detent: 'peek', geo: 'JP', center: TOKYO, zoom: 2.4 }),
  japon: scene({ level: 1, geo: 'JP', sheet: 'level', detent: 'peek', tab: 0, center: TOKYO, zoom: 4.8 }),
  nagano: scene({ level: 2, geo: 'JP', regionId: 'Nagano', sheet: 'level', detent: 'low', tab: 0, center: NAGANO, zoom: 7.2 }),
  usa: scene({ level: 1, geo: 'US', sheet: 'level', detent: 'peek', tab: 0, center: [-98.5, 39.8], zoom: 3.6 }),
  chili: scene({ level: 1, geo: 'CL', sheet: 'level', detent: 'peek', tab: 0, center: [-70.6, -33.4], zoom: 4.2 }),
  mongolie: scene({ level: 1, geo: 'MN', sheet: 'level', detent: 'peek', tab: 0, center: [103.8, 46.9], zoom: 4.4 }),
  noloc: scene({ sheet: 'noLocation', detent: 'mid', locationPermission: 'denied' }),
  nuit: scene({ level: 3, geo: 'FR', placeId: 'chamonix', sheet: 'level', detent: 'low', tab: 0, theme: 'dark', center: CHAMONIX, zoom: 12 }),
  facile: scene({ level: 3, geo: 'FR', placeId: 'chamonix', sheet: 'level', detent: 'low', tab: 0, easyMode: true, center: CHAMONIX, zoom: 12 }),
};

export function isSceneName(value: string | null | undefined): value is SceneName {
  return !!value && (SCENE_NAMES as readonly string[]).includes(value);
}

/** `?scene=` n'est accepté qu'en développement et en test. */
export function sceneEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.NEXT_PUBLIC_EXPLORER_SCENES === '1' ||
    // Recette sur build de production (CI) : jamais actif en production réelle.
    process.env.EXPLORER_V2_E2E === '1'
  );
}
