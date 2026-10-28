#!/usr/bin/env node
/**
 * seed_compte_demo_complet.mjs — compte démo « Léa Fontaine » prêt à tout essayer.
 *
 * Objectif : rendre chaque lentille du drawer Profil (/compte) réellement
 * utilisable, sans inventer de schéma :
 *   Vitrine     : stats, massifs, passeport, trophées, republications
 *   Kit         : 6 kits cohérents, matériel, liens sorties
 *   Prêts       : prêts et emprunts, retards, retours, notes, confiance
 *   Souvenirs   : timeline, passeport, albums, stories
 *   Communauté  : défis avec progression, clubs, cordée (compagnons réels)
 *   Compte      : commandes, notifications, réglages, partage
 *   Carte       : itinéraires, massifs, carnets, POI, kits
 *
 * Le script est idempotent : UUID déterministes + upserts ciblés. Il ne purge
 * jamais les données existantes du compte ; seuls les items des 6 kits retenus
 * sont remplacés pour supprimer les doublons de seed.
 *
 * Usage :
 *   node scripts/seed/seed_compte_demo_complet.mjs
 *   node scripts/seed/seed_compte_demo_complet.mjs --dry-run
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const ENV_FILE = resolve(ROOT, '.env.local');
const DRY_RUN = process.argv.includes('--dry-run');

function loadEnv(file) {
  let raw = '';
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, key, value] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = value.replace(/^["']|["']$/g, '');
  }
}

loadEnv(ENV_FILE);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis');
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_ID = 'd5451f35-db9f-4575-9114-6d3b79550bbc';
const DEMO_EMAIL = process.env.LKDV_DEMO_EMAIL;
const DEMO_PASSWORD = process.env.LKDV_DEMO_PASSWORD;
if (!DEMO_EMAIL || !DEMO_PASSWORD) {
  throw new Error('LKDV_DEMO_EMAIL et LKDV_DEMO_PASSWORD sont requis pour le compte de test');
}

const COMPANIONS = {
  marie: '3612c45b-d3d7-4e3c-921f-686953ee69e9',
  thomas: '485fc864-6b5f-4417-8755-be6d806d4175',
  sophie: 'ce296ba3-cf7e-489a-9e43-6b72567e4d59',
  lucas: '2b963f49-0725-4dd3-8e49-b6c63884d250',
  camille: 'b431d26e-5d6a-4b0a-8f02-e356bf66e748',
  antoine: '870e373d-28af-413d-a53e-154dc480f629',
  julie: '4bb56d7e-2371-4589-8e0f-e8a4274b5b03',
  maxime: '44545b16-e32d-4340-a790-9275b4cecb02',
};

const SESSIONS = {
  mulets: '1d42af5e-5a84-55a1-8784-1f3826c6a708',
  lacBlanc: '5ca62823-995f-561f-9bbc-cbf7f9c90216',
  gr20: 'fd21c252-7a03-577a-b665-3d8fe632d9b4',
  fagnes: 'beef901b-1e84-5edb-b909-e233fb40e111',
  ferrata: '2e39db81-466f-5f16-b1d1-1825374d5073',
  lille: '1600ed21-f289-5afd-af6e-6b4fe43e319b',
  vercors: 'f97f18ca-e2a9-5c9c-bc53-7f912caddb56',
  basque: '29a10175-68ff-5a6e-8263-2233a445e1aa',
  altaVia: '4ef732a9-cf5f-52d2-aa38-07e0ae69f91d',
  jura: '006b953d-2eb4-50c9-97c7-4818722bc467',
  annecy: '9d669a38-f4ce-5af9-a741-792f7563f40a',
  montAiguille: 'c81d25e2-a5f7-53a9-9f46-2e7aca60ff9f',
  mormal: '38641525-5756-5f3c-add9-c4e5d799b2e1',
  paysBasque: '42b0b085-61b5-5b60-ae35-270541b0edbf',
  grandBallon: 'cab186ca-5f28-5d43-a35e-3cbb91cbdf60',
  bivouacVercors: 'ec2a8e8a-3c06-55ca-8c4a-a6ee5c83abf2',
  opale: 'edc04c5a-6ad0-5e86-aeda-7f295cb9b949',
  tmb: 'e3dbc935-9bfe-5fbc-bd98-8a017d3cf404',
};

const CARNETS = {
  fagnes: '0fdd76cf-c6fa-5bf2-bf1a-360219b2a83c',
  gr20: 'a18a5e0b-aded-595b-9483-f2329cc88a79',
  lille: '5be2d6fd-0b78-5cfa-80a0-120ee5c53b49',
  vercors: '6c532f88-640d-524b-bb5e-6fa05ea62054',
  basque: '7ba1bf79-6916-509e-9906-5135359fd134',
  ferrata: '489aee92-659d-57aa-967d-9ac6fb650e49',
  jura: '4fdfa9bc-a72f-54dc-9077-a42766e05e1c',
  altaVia: '9deab9dd-398d-5ea6-a33c-0d1f54044c16',
  islande: '9ba890ca-e071-5ab8-8624-6bd8a471a6c1',
  tmb: '749e9e8c-9540-5a73-8b6c-6ab07264f62f',
};

const KITS = {
  ultralight: 'cd495250-3448-5c60-8115-7ae9fa2b3e3c',
  hiver: 'a773ccdc-24d4-569e-89e5-56a8eb76e5d7',
  famille: '69bdd8c3-51cb-5fa5-bcb3-7b009e688edd',
  jura: '790abaec-f968-48f2-942b-51d615f4d2c5',
  gr20: '88c13764-ad10-4cc9-888f-76122dad11d5',
  bivouac: '58c7d842-8068-492d-8968-cadb621a920a',
};

const TRASHED_KITS = [
  '0936f584-8df4-4bd2-90b2-ab5efc535b8d',
  '53fde12c-b2e4-494f-aac9-ba51c9e8698c',
  'a3036a0a-cefd-4c56-a8b9-efcf51811b25',
];

function uid(prefix, n) {
  return `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

const now = new Date();
const iso = (offsetDays = 0) =>
  new Date(now.getTime() + offsetDays * 86_400_000).toISOString();
const day = (offsetDays = 0) => iso(offsetDays).slice(0, 10);

async function run(label, query) {
  const { data, error } = await query;
  if (error) throw new Error(`${label} — ${error.message}`);
  return data;
}

async function maybe(label, query) {
  const { data, error } = await query;
  if (error) throw new Error(`${label} — ${error.message}`);
  return data;
}

const summary = [];
function note(line) {
  summary.push(line);
  console.log(`  ✓ ${line}`);
}

// ── 1. Routes de démonstration (massifs réels) ───────────────────────────────
const ROUTES = [
  { id: 9900000000001, name: 'Traversée des Grands Mulets', region: 'mont blanc' },
  { id: 9900000000002, name: 'Lac Blanc — lever de soleil', region: 'mont blanc' },
  { id: 9900000000003, name: 'Tour du Mont-Blanc — reconnaissance', region: 'mont blanc' },
  { id: 9900000000004, name: 'Tour du Vercors — crêtes', region: 'vercors' },
  { id: 9900000000005, name: 'Mont Aiguille — approche', region: 'vercors' },
  { id: 9900000000006, name: 'Bivouac Vercors — nuit étoilée', region: 'vercors' },
  { id: 9900000000007, name: 'GR20 — étape 5', region: 'corse' },
  { id: 9900000000008, name: 'Jura gravel — boucle', region: 'jura bernois' },
  { id: 9900000000009, name: "Lac d'Annecy — tour en trail", region: 'bauges' },
  { id: 9900000000010, name: 'Grand Ballon — sortie hiver', region: 'vosges' },
];

const SESSION_ROUTE = {
  [SESSIONS.mulets]: ROUTES[0].id,
  [SESSIONS.lacBlanc]: ROUTES[1].id,
  [SESSIONS.tmb]: ROUTES[2].id,
  [SESSIONS.vercors]: ROUTES[3].id,
  [SESSIONS.montAiguille]: ROUTES[4].id,
  [SESSIONS.bivouacVercors]: ROUTES[5].id,
  [SESSIONS.gr20]: ROUTES[6].id,
  [SESSIONS.jura]: ROUTES[7].id,
  [SESSIONS.annecy]: ROUTES[8].id,
  [SESSIONS.grandBallon]: ROUTES[9].id,
};

const SESSION_CARNET = {
  [SESSIONS.mulets]: CARNETS.tmb,
  [SESSIONS.lacBlanc]: CARNETS.tmb,
  [SESSIONS.gr20]: CARNETS.gr20,
  [SESSIONS.fagnes]: CARNETS.fagnes,
  [SESSIONS.ferrata]: CARNETS.ferrata,
  [SESSIONS.lille]: CARNETS.lille,
  [SESSIONS.vercors]: CARNETS.vercors,
  [SESSIONS.basque]: CARNETS.basque,
  [SESSIONS.altaVia]: CARNETS.altaVia,
  [SESSIONS.jura]: CARNETS.jura,
  [SESSIONS.montAiguille]: CARNETS.vercors,
  [SESSIONS.paysBasque]: CARNETS.basque,
  [SESSIONS.bivouacVercors]: CARNETS.vercors,
  [SESSIONS.tmb]: CARNETS.tmb,
};

const SESSION_KIT = {
  [SESSIONS.mulets]: KITS.hiver,
  [SESSIONS.lacBlanc]: KITS.ultralight,
  [SESSIONS.gr20]: KITS.gr20,
  [SESSIONS.fagnes]: KITS.hiver,
  [SESSIONS.ferrata]: KITS.ultralight,
  [SESSIONS.lille]: KITS.famille,
  [SESSIONS.vercors]: KITS.ultralight,
  [SESSIONS.basque]: KITS.ultralight,
  [SESSIONS.altaVia]: KITS.gr20,
  [SESSIONS.jura]: KITS.jura,
  [SESSIONS.annecy]: KITS.ultralight,
  [SESSIONS.montAiguille]: KITS.ultralight,
  [SESSIONS.mormal]: KITS.ultralight,
  [SESSIONS.paysBasque]: KITS.ultralight,
  [SESSIONS.grandBallon]: KITS.hiver,
  [SESSIONS.bivouacVercors]: KITS.bivouac,
  [SESSIONS.opale]: KITS.ultralight,
  [SESSIONS.tmb]: KITS.gr20,
};

const SESSION_VISIBILITY = {
  [SESSIONS.mulets]: 'collective_anonymized',
  [SESSIONS.lacBlanc]: 'collective_anonymized',
  [SESSIONS.gr20]: 'collective_anonymized',
  [SESSIONS.vercors]: 'collective_anonymized',
  [SESSIONS.jura]: 'collective_anonymized',
  [SESSIONS.annecy]: 'collective_anonymized',
  [SESSIONS.bivouacVercors]: 'collective_anonymized',
  [SESSIONS.tmb]: 'collective_anonymized',
};

const SESSION_META = {
  [SESSIONS.mulets]: {
    maxAlt: 3200,
    notes: 'Départ avant l’aube depuis les Houches. Neige ferme jusqu’au refuge, puis brouillard au col. La trace est propre, les crampons ont servi.',
  },
  [SESSIONS.lacBlanc]: {
    maxAlt: 2352,
    notes: 'Montée dans le noir pour le lever de soleil. Le lac était encore gelé sur sa moitié. Thé chaud au refuge avant la descente.',
  },
  [SESSIONS.gr20]: {
    maxAlt: 1840,
    notes: 'Étape courte mais technique. Les chaînes étaient sèches, le sac léger a fait la différence dans les blocs.',
  },
  [SESSIONS.fagnes]: {
    maxAlt: 694,
    notes: 'Bivouac sous la bruine, réveil dans la brume. La tourbière est magnifique quand le soleil perce.',
  },
  [SESSIONS.ferrata]: {
    maxAlt: 2180,
    notes: 'Via ferrata Tridentina avec Thomas. Le pont suspendu reste impressionnant, sortie très bien encadrée.',
  },
  [SESSIONS.lille]: {
    maxAlt: 32,
    notes: 'Boucle urbaine le long de la Deûle, au lever du jour. Bon test pour le kit famille et les chaussures de trail.',
  },
  [SESSIONS.vercors]: {
    maxAlt: 2280,
    notes: 'Crêtes du Vercors en autonomie. Vue sur le Mont Aiguille, bivouac au col avec un vent soutenu.',
  },
  [SESSIONS.basque]: {
    maxAlt: 520,
    notes: 'Sentier du littoral entre Saint-Jean-de-Luz et Hendaye. Houle magnifique, sentier glissant par endroits.',
  },
  [SESSIONS.altaVia]: {
    maxAlt: 2460,
    notes: 'Étape 3 de l’Alta Via 1. Passages équipés, neige résiduelle dans les couloirs nord. Bâtons indispensables.',
  },
  [SESSIONS.jura]: {
    maxAlt: 1180,
    notes: 'Boucle gravel de 85 km. Les chemins forestiers étaient parfaits après la pluie de la veille.',
  },
  [SESSIONS.annecy]: {
    maxAlt: 920,
    notes: 'Tour du lac en trail, départ tôt pour éviter la foule. Les portions forestières du Semnoz sont superbes.',
  },
  [SESSIONS.montAiguille]: {
    maxAlt: 1980,
    notes: 'Approche du Mont Aiguille depuis le col de l’Aigle. Vue nette sur les falaises, retour sous les nuages.',
  },
  [SESSIONS.mormal]: {
    maxAlt: 195,
    notes: 'Reprise tranquille en forêt de Mormal. Sept kilomètres pour retrouver le rythme, jambes lourdes mais sourire.',
  },
  [SESSIONS.paysBasque]: {
    maxAlt: 860,
    notes: 'Crêtes basques dans le brouillard, puis éclaircie au col. Les vaches ont occupé le sentier une bonne partie de la montée.',
  },
  [SESSIONS.grandBallon]: {
    maxAlt: 1424,
    notes: 'Sortie hiver sur le Grand Ballon. Verglas sur les derniers mètres, crampons légers suffisants.',
  },
  [SESSIONS.bivouacVercors]: {
    maxAlt: 1650,
    notes: 'Nuit étoilée au-dessus de la brume. Tente sous les pins, réveil à -2 °C, duvet bien dimensionné.',
  },
  [SESSIONS.opale]: {
    maxAlt: 68,
    notes: 'Wissant sous un ciel de traîne. Grande marée, sentier des dunes balisé, retour par la plage.',
  },
  [SESSIONS.tmb]: {
    maxAlt: 2580,
    notes: 'Reconnaissance du Tour du Mont-Blanc en trois jours. Col du Bonhomme sous la neige, refuges encore ouverts.',
  },
};

const SESSION_POIS = {
  [SESSIONS.mulets]: [
    { label: 'Refuge des Grands Mulets', index: 2, day: 1 },
    { label: 'Col du Dôme', index: 8, day: 1 },
  ],
  [SESSIONS.lacBlanc]: [
    { label: 'Lac Blanc', index: 4, day: 1 },
    { label: 'Refuge du Lac Blanc', index: 5, day: 1 },
  ],
  [SESSIONS.gr20]: [{ label: 'Bergerie de Vaccaghja', index: 3, day: 1 }],
  [SESSIONS.fagnes]: [{ label: 'Signal de Botrange', index: 4, day: 1 }],
  [SESSIONS.vercors]: [{ label: 'Col de la Croix', index: 6, day: 1 }],
  [SESSIONS.altaVia]: [{ label: 'Rifugio Coldai', index: 5, day: 1 }],
  [SESSIONS.jura]: [{ label: 'Crêt de la Neige', index: 7, day: 1 }],
  [SESSIONS.annecy]: [{ label: 'Col de la Forclaz', index: 6, day: 1 }],
};

/** Tracés synthétiques mais cohérents : chaque boucle reste dans son massif. */
const TRACK_SHAPES = {
  [SESSIONS.mulets]: { lat: 45.918, lng: 6.87, radius: 0.032, phase: 0.4 },
  [SESSIONS.lacBlanc]: { lat: 45.982, lng: 6.89, radius: 0.022, phase: 1.2 },
  [SESSIONS.gr20]: { lat: 42.36, lng: 9.02, radius: 0.055, phase: 2.1 },
  [SESSIONS.fagnes]: { lat: 50.6, lng: 6.08, radius: 0.045, phase: 0.8 },
  [SESSIONS.ferrata]: { lat: 46.54, lng: 11.96, radius: 0.025, phase: 1.7 },
  [SESSIONS.lille]: { lat: 50.63, lng: 3.06, radius: 0.035, phase: 0.2 },
  [SESSIONS.vercors]: { lat: 44.95, lng: 5.45, radius: 0.06, phase: 2.6 },
  [SESSIONS.basque]: { lat: 43.38, lng: -1.66, radius: 0.035, phase: 1.1 },
  [SESSIONS.altaVia]: { lat: 46.5, lng: 12.02, radius: 0.06, phase: 0.6 },
  [SESSIONS.jura]: { lat: 47.2, lng: 7.2, radius: 0.1, phase: 2.2 },
  [SESSIONS.annecy]: { lat: 45.82, lng: 6.18, radius: 0.05, phase: 1.5 },
  [SESSIONS.montAiguille]: { lat: 44.84, lng: 5.55, radius: 0.03, phase: 2.9 },
  [SESSIONS.mormal]: { lat: 50.3, lng: 3.75, radius: 0.025, phase: 0.9 },
  [SESSIONS.paysBasque]: { lat: 43.15, lng: -1.35, radius: 0.06, phase: 1.8 },
  [SESSIONS.grandBallon]: { lat: 47.9, lng: 7.1, radius: 0.035, phase: 0.3 },
  [SESSIONS.bivouacVercors]: { lat: 44.92, lng: 5.45, radius: 0.035, phase: 2.4 },
  [SESSIONS.opale]: { lat: 50.89, lng: 1.66, radius: 0.025, phase: 1.4 },
  [SESSIONS.tmb]: { lat: 45.86, lng: 6.85, radius: 0.07, phase: 0.7 },
};

/**
 * Une trace de démonstration lisible : boucle douce autour d'un point réel,
 * 80 points horodatés et un profil altimétrique qui atteint le sommet à mi-
 * parcours. Le but est de montrer la carte, le dénivelé et le GPX sans
 * fabriquer de coordonnées à travers toute l'Europe.
 */
function buildDemoTrack(session, shape) {
  const points = 80;
  const started = Date.parse(session.started_at);
  const ended = Date.parse(session.ended_at);
  const startMs = Number.isFinite(started) ? started : Date.now() - 4 * 3600_000;
  const endMs = Number.isFinite(ended) && ended > startMs ? ended : startMs + 4 * 3600_000;
  const gain = Number(session.elevation_gain_m || 0);
  const peak = Number(session.max_altitude_m || 0) || Math.max(400, gain + 350);
  const startElev = Math.max(40, peak - gain);
  const lngScale = shape.radius / Math.cos((shape.lat * Math.PI) / 180);
  const coordinates = [];
  const timed = [];

  for (let index = 0; index < points; index += 1) {
    const t = (index / (points - 1)) * Math.PI * 2;
    const wobble = 1 + 0.14 * Math.sin(3 * t + shape.phase) + 0.05 * Math.sin(7 * t);
    const lat = shape.lat + shape.radius * wobble * Math.sin(t);
    const lng = shape.lng + lngScale * wobble * Math.cos(t);
    const elevation = Math.round(startElev + gain * (0.5 - 0.5 * Math.cos(t)));
    const timestamp = new Date(startMs + ((endMs - startMs) * index) / (points - 1)).toISOString();
    coordinates.push([Number(lng.toFixed(5)), Number(lat.toFixed(5))]);
    timed.push({
      lat: Number(lat.toFixed(5)),
      lng: Number(lng.toFixed(5)),
      timestamp,
      elevationM: elevation,
    });
  }

  return {
    positions_geojson: { type: 'LineString', coordinates },
    positions_timed: timed,
    max_altitude_m: Math.max(...timed.map((point) => point.elevationM)),
  };
}

const KIT_ITEMS = {
  [KITS.ultralight]: [
    ['Sac à dos Osprey Exos 38', 'Sacs & Portage', 1000, 'vital'],
    ['Tente MSR Hubba 1P', 'Couchage & Tentes', 900, 'vital'],
    ['Duvet Cumulus X-Lite 200', 'Couchage & Tentes', 430, 'vital'],
    ['Matelas Therm-a-Rest NeoAir XLite', 'Couchage & Tentes', 340, 'vital'],
    ['Réchaud MSR PocketRocket 2', 'Cuisine & Réchauds', 73, 'recommended'],
    ['Popote Toaks 650 ml', 'Cuisine & Réchauds', 72, 'recommended'],
    ['Filtre à eau Sawyer Mini', 'Eau & Filtres', 65, 'vital'],
    ['Frontale Petzl Actik Core', 'Lampes & Éclairage', 75, 'recommended'],
    ['Trousse de secours', 'Sécurité & Soins', 180, 'vital'],
    ["Veste imperméable Arc'teryx", 'Vêtements & Vestes', 310, 'vital'],
    ['Gourde souple 1 L', 'Eau & Filtres', 60, 'recommended'],
  ],
  [KITS.hiver]: [
    ['Sac à dos Osprey Kestrel 48', 'Sacs & Portage', 1600, 'vital'],
    ['Tente Hilleberg Akto', 'Couchage & Tentes', 1700, 'vital'],
    ['Duvet Cumulus Alaska 1100', 'Couchage & Tentes', 1100, 'vital'],
    ['Matelas Exped DownMat 7', 'Couchage & Tentes', 680, 'vital'],
    ['Réchaud Primus OmniLite', 'Cuisine & Réchauds', 450, 'recommended'],
    ['Popote MSR 1,5 L', 'Cuisine & Réchauds', 250, 'recommended'],
    ['Frontale Petzl Nao RL', 'Lampes & Éclairage', 150, 'vital'],
    ['Crampons Kahtoola', 'Sécurité & Soins', 650, 'vital'],
    ['Trousse de secours hiver', 'Sécurité & Soins', 450, 'vital'],
    ['Veste Patagonia Fitz Roy', 'Vêtements & Vestes', 600, 'vital'],
  ],
  [KITS.gr20]: [
    ['Sac Salomon XA 25', 'Sacs & Portage', 700, 'vital'],
    ['Tente The North Face Assault 2', 'Couchage & Tentes', 1200, 'vital'],
    ['Duvet Valandré 400', 'Couchage & Tentes', 650, 'vital'],
    ['Matelas Therm-a-Rest Z Lite', 'Couchage & Tentes', 410, 'vital'],
    ['Réchaud BRS 3000T', 'Cuisine & Réchauds', 25, 'recommended'],
    ['Popote Toaks 750 ml', 'Cuisine & Réchauds', 95, 'recommended'],
    ['Filtre Katadyn BeFree', 'Eau & Filtres', 63, 'vital'],
    ['Bâtons Black Diamond Distance Carbon', 'Sacs & Portage', 340, 'recommended'],
    ['Veste imperméable Montbell', 'Vêtements & Vestes', 210, 'vital'],
    ['Trousse de secours', 'Sécurité & Soins', 220, 'vital'],
  ],
  [KITS.jura]: [
    ['Sac gravel Apidura 14 L', 'Sacs & Portage', 900, 'vital'],
    ['Tente Big Agnes Copper Spur 1', 'Couchage & Tentes', 1000, 'vital'],
    ['Duvet Cumulus 300', 'Couchage & Tentes', 550, 'vital'],
    ['Matelas Therm-a-Rest NeoAir', 'Couchage & Tentes', 340, 'vital'],
    ['Réchaud MSR PocketRocket 2', 'Cuisine & Réchauds', 73, 'recommended'],
    ['Trousse de réparation vélo', 'Sécurité & Soins', 450, 'vital'],
    ['Veste pluie ultralight', 'Vêtements & Vestes', 280, 'vital'],
    ['Frontale Petzl Bindi', 'Lampes & Éclairage', 35, 'recommended'],
  ],
  [KITS.famille]: [
    ['Sac à dos 30 L', 'Sacs & Portage', 900, 'vital'],
    ['Tente Quechua 2 places', 'Couchage & Tentes', 1800, 'vital'],
    ['Duvet 2 places', 'Couchage & Tentes', 1200, 'vital'],
    ['Matelas 2 places', 'Couchage & Tentes', 800, 'recommended'],
    ['Réchaud Campingaz', 'Cuisine & Réchauds', 500, 'recommended'],
    ['Set de vaisselle outdoor', 'Cuisine & Réchauds', 400, 'recommended'],
  ],
  [KITS.bivouac]: [
    ['Sac à dos 45 L', 'Sacs & Portage', 1400, 'vital'],
    ['Tarp MSR Thru-Hiker', 'Couchage & Tentes', 700, 'vital'],
    ['Duvet 0 °C', 'Couchage & Tentes', 900, 'vital'],
    ['Matelas gonflable', 'Couchage & Tentes', 450, 'vital'],
    ['Réchaud à gaz', 'Cuisine & Réchauds', 300, 'recommended'],
    ['Frontale Petzl Actik', 'Lampes & Éclairage', 75, 'recommended'],
    ['Trousse de secours', 'Sécurité & Soins', 300, 'vital'],
    ['Gourde 2 L', 'Eau & Filtres', 120, 'recommended'],
  ],
};

const KIT_META = {
  [KITS.ultralight]: {
    name: 'Ultralight week-end',
    description: 'Le kit 3 saisons pour partir léger en week-end : 3,5 kg pesés, tout le confort essentiel.',
    season: 'automne',
    weight: 3105,
    public: true,
    favorite: true,
    generation: 2,
    proven: 18,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80',
  },
  [KITS.hiver]: {
    name: 'Hiver & bivouac',
    description: 'Kit hiver pour bivouac sous 0 °C : tente 4 saisons, duvet 1100 g et réchaud tous carburants.',
    season: 'hiver',
    weight: 7540,
    public: true,
    favorite: true,
    generation: 3,
    proven: 11,
    image: 'https://images.unsplash.com/photo-1483347756197-71ef80e95f73?auto=format&fit=crop&w=800&q=80',
  },
  [KITS.gr20]: {
    name: 'GR20 léger',
    description: 'Kit multi-jours pour la haute route corse : 3,9 kg, tente 2 places et filtration.',
    season: 'ete',
    weight: 3963,
    public: true,
    favorite: true,
    generation: 2,
    proven: 9,
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80',
  },
  [KITS.jura]: {
    name: 'Trek Jura 2 jours',
    description: 'Bikepacking gravel et bivouac : 3,6 kg répartis entre sacoches et portage.',
    season: 'ete',
    weight: 3628,
    public: true,
    favorite: false,
    generation: 1,
    proven: 6,
    image: 'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&w=800&q=80',
  },
  [KITS.famille]: {
    name: 'Famille & terrasse',
    description: 'Sorties tranquilles et pique-nique : tente 2 places, réchaud et vaisselle pour deux.',
    season: 'toute_saison',
    weight: 5600,
    public: true,
    favorite: false,
    generation: 1,
    proven: 4,
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80',
  },
  [KITS.bivouac]: {
    name: 'Bivouac Vercors',
    description: 'Tarp, duvet 0 °C et réchaud : le kit minimal pour une nuit étoilée sur les plateaux.',
    season: 'toute_saison',
    weight: 4245,
    public: true,
    favorite: false,
    generation: 1,
    proven: 7,
    image: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=800&q=80',
  },
};

const CARNET_META = {
  [CARNETS.fagnes]: {
    tags: ['Belgique', 'bivouac', 'tourbière', 'brouillard'],
    weather: 'Bruine puis éclaircie',
    rating: 4.3,
    km: 14,
    dplus: 180,
    nights: 1,
    travellers: 2,
    from: 'Eupen',
    to: 'Signal de Botrange',
  },
  [CARNETS.gr20]: {
    tags: ['Corse', 'GR20', 'haute route', 'refuges'],
    weather: 'Ciel dégagé, vent de nord',
    rating: 4.8,
    km: 120,
    dplus: 6800,
    nights: 7,
    travellers: 2,
    from: 'Calenzana',
    to: 'Conca',
  },
  [CARNETS.lille]: {
    tags: ['Lille', 'ville', 'Deûle', 'week-end'],
    weather: 'Ensoleillé',
    rating: 4.1,
    km: 18,
    dplus: 40,
    nights: 1,
    travellers: 2,
    from: 'Lille',
    to: 'Lille',
  },
  [CARNETS.vercors]: {
    tags: ['Vercors', 'crêtes', 'bivouac', 'autonomie'],
    weather: 'Soleil puis vent fort',
    rating: 4.7,
    km: 55,
    dplus: 2800,
    nights: 2,
    travellers: 3,
    from: 'Villard-de-Lans',
    to: 'Corrençon-en-Vercors',
  },
  [CARNETS.basque]: {
    tags: ['Pays basque', 'littoral', 'hors saison', 'GR8'],
    weather: 'Houle et éclaircies',
    rating: 4.6,
    km: 60,
    dplus: 2200,
    nights: 4,
    travellers: 2,
    from: 'Saint-Jean-Pied-de-Port',
    to: 'Hendaye',
  },
  [CARNETS.ferrata]: {
    tags: ['Dolomites', 'via ferrata', 'sécurité', 'première fois'],
    weather: 'Ensoleillé',
    rating: 4.4,
    km: 8,
    dplus: 780,
    nights: 1,
    travellers: 2,
    from: "Cortina d'Ampezzo",
    to: "Cortina d'Ampezzo",
  },
  [CARNETS.jura]: {
    tags: ['Jura', 'gravel', 'bikepacking', 'forêt'],
    weather: 'Pluie fine puis sec',
    rating: 4.2,
    km: 180,
    dplus: 2400,
    nights: 3,
    travellers: 2,
    from: 'Saint-Claude',
    to: 'Saint-Claude',
  },
  [CARNETS.altaVia]: {
    tags: ['Dolomites', 'Alta Via 1', 'refuges', 'altitude'],
    weather: 'Neige résiduelle',
    rating: 4.9,
    km: 72,
    dplus: 4200,
    nights: 6,
    travellers: 2,
    from: 'Lago di Braies',
    to: 'Belluno',
  },
  [CARNETS.islande]: {
    tags: ['Islande', 'F208', 'Hautes Terres', 'expédition'],
    weather: 'Vent, pluie, éclaircies',
    rating: 4.8,
    km: 180,
    dplus: 1800,
    nights: 10,
    travellers: 3,
    from: 'Landmannalaugar',
    to: 'Þórsmörk',
  },
  [CARNETS.tmb]: {
    tags: ['Mont-Blanc', 'TMB', 'autonomie', 'trois pays'],
    weather: 'Neige au col du Bonhomme',
    rating: 5,
    km: 170,
    dplus: 10000,
    nights: 9,
    travellers: 2,
    from: 'Chamonix-Mont-Blanc',
    to: 'Chamonix-Mont-Blanc',
  },
};

const COMPANION_SESSIONS = [
  {
    id: uid('c0de1001', 1),
    user_id: COMPANIONS.marie,
    route_id: ROUTES[0].id,
    title: 'Grands Mulets — la même trace',
    started_at: '2026-10-20T05:20:00.000Z',
    ended_at: '2026-10-20T14:10:00.000Z',
    distance_km: 17,
    duration_seconds: 31800,
    elevation_gain_m: 1420,
    carnet_id: CARNETS.tmb,
  },
  {
    id: uid('c0de1002', 1),
    user_id: COMPANIONS.thomas,
    route_id: ROUTES[0].id,
    title: 'Grands Mulets — cordée du matin',
    started_at: '2026-10-20T05:05:00.000Z',
    ended_at: '2026-10-20T13:40:00.000Z',
    distance_km: 17,
    duration_seconds: 30900,
    elevation_gain_m: 1420,
    carnet_id: CARNETS.tmb,
  },
  {
    id: uid('c0de1003', 1),
    user_id: COMPANIONS.sophie,
    route_id: ROUTES[3].id,
    title: 'Crêtes du Vercors — avec Léa',
    started_at: '2026-09-27T06:30:00.000Z',
    ended_at: '2026-09-27T15:20:00.000Z',
    distance_km: 22,
    duration_seconds: 31800,
    elevation_gain_m: 1120,
    carnet_id: CARNETS.vercors,
  },
  {
    id: uid('c0de1004', 1),
    user_id: COMPANIONS.lucas,
    route_id: ROUTES[6].id,
    title: 'GR20 étape 5 — ensemble',
    started_at: '2026-10-13T04:35:00.000Z',
    ended_at: '2026-10-13T12:45:00.000Z',
    distance_km: 18,
    duration_seconds: 29400,
    elevation_gain_m: 1240,
    carnet_id: CARNETS.gr20,
  },
  {
    id: uid('c0de1005', 1),
    user_id: COMPANIONS.julie,
    route_id: ROUTES[2].id,
    title: 'Tour du Mont-Blanc — reconnaissance',
    started_at: '2026-07-02T05:00:00.000Z',
    ended_at: '2026-07-02T15:00:00.000Z',
    distance_km: 19,
    duration_seconds: 36000,
    elevation_gain_m: 980,
    carnet_id: CARNETS.tmb,
  },
];

const PARTICIPANTS = {
  [SESSIONS.mulets]: [COMPANIONS.marie, COMPANIONS.thomas],
  [SESSIONS.lacBlanc]: [COMPANIONS.sophie],
  [SESSIONS.gr20]: [COMPANIONS.lucas],
  [SESSIONS.fagnes]: [COMPANIONS.marie, COMPANIONS.julie],
  [SESSIONS.ferrata]: [COMPANIONS.thomas],
  [SESSIONS.lille]: [COMPANIONS.camille],
  [SESSIONS.vercors]: [COMPANIONS.sophie, COMPANIONS.antoine],
  [SESSIONS.basque]: [COMPANIONS.maxime],
  [SESSIONS.altaVia]: [COMPANIONS.julie],
  [SESSIONS.jura]: [COMPANIONS.lucas],
  [SESSIONS.annecy]: [COMPANIONS.camille],
  [SESSIONS.montAiguille]: [COMPANIONS.antoine],
  [SESSIONS.mormal]: [COMPANIONS.marie],
  [SESSIONS.paysBasque]: [COMPANIONS.maxime],
  [SESSIONS.grandBallon]: [COMPANIONS.camille, COMPANIONS.thomas],
  [SESSIONS.bivouacVercors]: [COMPANIONS.julie, COMPANIONS.sophie],
  [SESSIONS.opale]: [COMPANIONS.thomas],
  [SESSIONS.tmb]: [COMPANIONS.marie, COMPANIONS.sophie],
};

const KUDOS = {
  [SESSIONS.lacBlanc]: [COMPANIONS.marie, COMPANIONS.thomas, COMPANIONS.sophie, COMPANIONS.lucas, COMPANIONS.antoine],
  [SESSIONS.mormal]: [COMPANIONS.marie, COMPANIONS.camille, COMPANIONS.julie],
  [SESSIONS.paysBasque]: [COMPANIONS.maxime, COMPANIONS.sophie, COMPANIONS.thomas],
  [SESSIONS.opale]: [COMPANIONS.thomas, COMPANIONS.camille, COMPANIONS.marie, COMPANIONS.julie],
};

const COMMENTS = [
  {
    id: uid('c0de8001', 1),
    session_id: SESSIONS.lacBlanc,
    user_id: COMPANIONS.sophie,
    body: 'Ce lever de soleil est incroyable. Tu as mis combien de temps depuis le col ?',
    created_at: iso(-5),
  },
  {
    id: uid('c0de8001', 2),
    session_id: SESSIONS.lacBlanc,
    user_id: COMPANIONS.thomas,
    body: 'Le coin est magique tôt le matin. Bravo pour la montée dans le noir.',
    created_at: iso(-4),
  },
  {
    id: uid('c0de8001', 3),
    session_id: SESSIONS.lille,
    user_id: COMPANIONS.camille,
    body: 'On refait la boucle ensemble à la prochaine éclaircie ?',
    created_at: iso(-3),
  },
  {
    id: uid('c0de8001', 4),
    session_id: SESSIONS.lille,
    user_id: COMPANIONS.marie,
    body: 'Jolie lumière sur la Deûle, ça donne envie de ressortir les chaussures.',
    created_at: iso(-3),
  },
  {
    id: uid('c0de8001', 5),
    session_id: SESSIONS.bivouacVercors,
    user_id: COMPANIONS.julie,
    body: 'La nuit devait être magnifique. Tu avais quel duvet ?',
    created_at: iso(-2),
  },
  {
    id: uid('c0de8001', 6),
    session_id: SESSIONS.bivouacVercors,
    user_id: COMPANIONS.sophie,
    body: 'On a croisé ta trace le lendemain, le plateau était sous la brume.',
    created_at: iso(-2),
  },
  {
    id: uid('c0de8001', 7),
    session_id: SESSIONS.opale,
    user_id: COMPANIONS.thomas,
    body: 'Wissant par grande marée, toujours un bon souvenir. La photo des dunes est superbe.',
    created_at: iso(-1),
  },
  {
    id: uid('c0de8001', 8),
    session_id: SESSIONS.opale,
    user_id: COMPANIONS.camille,
    body: 'Il faut qu’on y aille ensemble, je ne connais pas ce sentier.',
    created_at: iso(-1),
  },
];

const BADGES = [
  { id: '6953cb22-f079-4516-a8fe-ec8c52bf045c', date: '2025-02-10T09:00:00.000Z' },
  { id: '48b6acd3-1624-458c-b092-c2be13413dc5', date: '2026-10-12T18:00:00.000Z' },
  { id: 'bbad690e-4515-432d-a38a-cd55cd9709b1', date: '2026-10-18T17:00:00.000Z' },
  { id: '4d2ff4cb-1840-4b0d-a918-51334ce83c3b', date: '2026-09-30T12:00:00.000Z' },
  { id: '66572fc0-c1b5-430f-9b65-daa4be472ab3', date: '2026-08-21T12:00:00.000Z' },
];

const USER_CHALLENGES = [
  { challenge_id: '043e2eb2-6565-488c-9ef7-3a7489738960', progress: 7, completed: false },
  { challenge_id: '1df35e11-2311-4a2f-ae77-d0d4741410fb', progress: 10, completed: true },
  { challenge_id: '91205fec-f950-48ef-94c5-b521a374d81d', progress: 1, completed: true },
  { challenge_id: '069de796-2287-43a0-ba3d-ab3ce2134bee', progress: 1, completed: true },
  { challenge_id: '4c95b550-121f-4add-8f5e-ba074d4f20cd', progress: 6, completed: false },
  { challenge_id: '2262805c-124d-46c2-be0b-0cb87ad031f8', progress: 3, completed: false },
  { challenge_id: 'bfbd76d5-5a43-4a32-ab7f-16cd68832a30', progress: 2, completed: false },
  { challenge_id: '3cc2198b-9dea-4c95-95ea-0468e86ea2d2', progress: 2, completed: false },
  { challenge_id: 'a9ff369e-fd4e-49d2-b63a-91f22243f9b9', progress: 4, completed: false },
  { challenge_id: 'a0c7a326-f7f6-4df2-b7b1-5da7213714e9', progress: 1, completed: true },
  { challenge_id: 'a12723be-d409-4942-a87f-455c727cec80', progress: 3, completed: false },
];

const NOTIFICATIONS = [
  {
    id: uid('c0de5001', 1),
    type: 'post_liked',
    group: 'social',
    actor_id: COMPANIONS.marie,
    title: 'Marie a aimé ta sortie',
    message: '« Lac Blanc — lever de soleil » · 13 km',
    link: '/compte?tab=souvenirs',
    read: false,
    created_at: iso(-0.05),
  },
  {
    id: uid('c0de5001', 2),
    type: 'carnet_commented',
    group: 'social',
    actor_id: COMPANIONS.thomas,
    title: 'Thomas a commenté ton carnet',
    message: '« Le coin est magique tôt le matin. »',
    link: `/carnets/${CARNETS.tmb}`,
    read: false,
    created_at: iso(-0.12),
  },
  {
    id: uid('c0de5001', 3),
    type: 'new_follower',
    group: 'social',
    actor_id: COMPANIONS.sophie,
    title: 'Sophie te suit',
    message: 'Tu as un nouvel abonné dans ta cordée.',
    link: `/profil/${COMPANIONS.sophie}`,
    read: false,
    created_at: iso(-0.2),
  },
  {
    id: uid('c0de5001', 4),
    type: 'loan_request',
    group: 'loans',
    actor_id: COMPANIONS.lucas,
    title: 'Lucas souhaite emprunter ton GPS',
    message: 'Demande de prêt · retour prévu le 30 octobre',
    link: '/compte?tab=prets',
    read: false,
    created_at: iso(-0.28),
  },
  {
    id: uid('c0de5001', 5),
    type: 'loan_due',
    group: 'loans',
    title: 'Un prêt arrive à échéance',
    message: 'La réserve d’eau 2 L devait être rendue le 5 septembre.',
    link: '/compte?tab=prets',
    read: false,
    created_at: iso(-0.36),
  },
  {
    id: uid('c0de5001', 6),
    type: 'order_shipped',
    group: 'orders',
    title: 'Ta commande a été expédiée',
    message: 'LKDV-2026-05107 · Colissimo',
    link: '/compte?tab=commandes',
    read: true,
    created_at: iso(-0.44),
  },
  {
    id: uid('c0de5001', 7),
    type: 'badge_earned',
    group: 'system',
    title: 'Nouveau trophée : Photographe Aventurier',
    message: 'Tu as partagé plus de 20 photos vérifiées.',
    link: '/compte?tab=vitrine',
    read: true,
    created_at: iso(-0.52),
  },
  {
    id: uid('c0de5001', 8),
    type: 'challenge_completed',
    group: 'system',
    title: 'Défi terminé : Réseau social',
    message: '10 interactions dans ta cordée · +250 XP',
    link: '/compte?tab=communaute',
    read: true,
    created_at: iso(-0.6),
  },
  {
    id: uid('c0de5001', 9),
    type: 'group_invite',
    group: 'social',
    actor_id: COMPANIONS.camille,
    title: 'Camille t’invite dans un club',
    message: 'Photo Nature & Voyage · sortie à l’aube samedi',
    link: '/clubs',
    read: true,
    created_at: iso(-0.7),
  },
  {
    id: uid('c0de5001', 10),
    type: 'system_update',
    group: 'system',
    title: 'Ton passeport s’est enrichi',
    message: '6 massifs validés · 2 pays visités',
    link: '/compte?tab=souvenirs',
    read: true,
    created_at: iso(-0.8),
  },
];

const STORIES = [
  {
    id: uid('c0de6001', 1),
    caption: 'Dernier jour dans les Dolomites',
    image_url:
      'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?auto=format&fit=crop&w=1080&q=80',
  },
  {
    id: uid('c0de6001', 2),
    caption: 'Bivouac Vercors, nuit claire',
    image_url:
      'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1080&q=80',
  },
  {
    id: uid('c0de6001', 3),
    caption: 'Le lac avant le soleil',
    image_url:
      'https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?auto=format&fit=crop&w=1080&q=80',
  },
];

const REPOSTS = [
  {
    id: uid('c0de7001', 1),
    content:
      'À lire avant de partir sur le GR20 : la gestion de l’eau et des refuges, testée sur le terrain.',
    sourceIndex: 0,
  },
  {
    id: uid('c0de7001', 2),
    content:
      'Un retour très juste sur le bivouac léger en automne. Le genre de conseil qu’on aurait aimé avoir plus tôt.',
    sourceIndex: 1,
  },
];

async function main() {
  console.log('=== COMPTE DÉMO /COMPTE — ENRICHISSEMENT COMPLET ===\n');
  console.log(`Projet : ${SUPABASE_URL}`);
  console.log(`Compte : ${DEMO_EMAIL} (${DEMO_ID})`);
  console.log(`Mode   : ${DRY_RUN ? 'dry-run, aucune écriture' : 'écriture idempotente'}\n`);

  const authUser = await maybe(
    'lecture du compte auth',
    supabase.auth.admin.getUserById(DEMO_ID)
  );
  if (!authUser?.user) throw new Error(`Compte auth introuvable pour ${DEMO_ID}`);

  if (DRY_RUN) {
    console.log('Préflight OK : compte auth trouvé, schéma accessible.');
    return;
  }

  // ── 2. Mot de passe de démonstration ───────────────────────────────────────
  await run(
    'réinitialisation du mot de passe',
    supabase.auth.admin.updateUserById(DEMO_ID, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        ...(authUser.user.user_metadata || {}),
        full_name: 'Léa Fontaine',
      },
    })
  );
  note('mot de passe du compte de test réinitialisé');

  // Les compagnons de la cordée sont des comptes de démonstration : la vue
  // `public_profiles` exclut `is_demo = true`, ce qui rendait les prêts et la
  // cordée anonymes (« Contact », « un membre »). On les rend visibles comme
  // des membres normaux pour que le compte démo puisse tester le social.
  await run(
    'visibilité des compagnons',
    supabase
      .from('user_profiles')
      .update({ is_demo: false })
      .in('id', Object.values(COMPANIONS))
  );
  note('8 compagnons visibles dans public_profiles');

  // ── 3. Routes et rattachement des sorties ──────────────────────────────────
  await run(
    'upsert des itinéraires de démonstration',
    supabase.from('hiking_routes').upsert(
      ROUTES.map((route) => ({
        id: route.id,
        name: route.name,
        region: route.region,
        network: 'demo',
        tags: { demo: true, source: 'compte-demo' },
      })),
      { onConflict: 'id' }
    )
  );
  note(`${ROUTES.length} itinéraires de démonstration rattachés à 6 massifs`);

  const sessionRows = await run(
    'lecture des sorties',
    supabase
      .from('hike_sessions')
      .select('id,positions_geojson,started_at,ended_at,distance_km,elevation_gain_m,max_altitude_m')
      .eq('user_id', DEMO_ID)
  );
  const positionsById = new Map(sessionRows.map((row) => [row.id, row.positions_geojson]));

  for (const sessionId of Object.keys(SESSION_META)) {
    const patch = {
      route_id: SESSION_ROUTE[sessionId] ?? null,
      kit_id: SESSION_KIT[sessionId] ?? null,
      carnet_id: SESSION_CARNET[sessionId] ?? null,
      visibility: SESSION_VISIBILITY[sessionId] ?? 'private',
      max_altitude_m: SESSION_META[sessionId].maxAlt,
      notes: SESSION_META[sessionId].notes,
    };

    // Trace lisible : remplace les points aléatoires du seed historique par
    // une boucle réelle autour du massif, avec profil altimétrique et POI.
    const shape = TRACK_SHAPES[sessionId];
    if (shape) {
      const row = sessionRows.find((session) => session.id === sessionId);
      if (row) {
        const generated = buildDemoTrack(
          { ...row, max_altitude_m: patch.max_altitude_m },
          shape
        );
        patch.positions_geojson = generated.positions_geojson;
        patch.positions_timed = generated.positions_timed;
        patch.max_altitude_m = generated.max_altitude_m;
      }
    }

    const geo = patch.positions_geojson ?? positionsById.get(sessionId);
    const coords = Array.isArray(geo?.coordinates) ? geo.coordinates : [];
    const pois = SESSION_POIS[sessionId];
    if (pois?.length && coords.length) {
      patch.poi_events = pois
        .map((poi) => {
          const point = coords[Math.min(poi.index, coords.length - 1)];
          if (!Array.isArray(point) || point.length < 2) return null;
          return {
            label: poi.label,
            day: poi.day,
            lng: Number(point[0]),
            lat: Number(point[1]),
          };
        })
        .filter(Boolean);
    }

    await run(
      `mise à jour de la sortie ${sessionId}`,
      supabase.from('hike_sessions').update(patch).eq('id', sessionId).eq('user_id', DEMO_ID)
    );
  }
  note('18 sorties : itinéraires, kits, carnets, visibilité, altitude, notes et POI');

  // ── 4. Kits cohérents ──────────────────────────────────────────────────────
  for (const [kitId, meta] of Object.entries(KIT_META)) {
    const items = KIT_ITEMS[kitId] || [];
    const weight = items.reduce((total, item) => total + item[2], 0);
    await run(
      `mise à jour du kit ${meta.name}`,
      supabase
        .from('materiel_kits')
        .update({
          name: meta.name,
          description: meta.description,
          season: meta.season,
          total_weight_g: weight,
          is_public: meta.public,
          is_favorite: meta.favorite,
          is_trashed: false,
          cover_image_url: meta.image,
          field_proven_count: meta.proven,
          updated_at: new Date().toISOString(),
        })
        .eq('id', kitId)
        .eq('user_id', DEMO_ID)
    );
  }

  await run(
    'archivage des doublons de kits',
    supabase
      .from('materiel_kits')
      .update({ is_trashed: true, is_public: false, updated_at: new Date().toISOString() })
      .in('id', TRASHED_KITS)
      .eq('user_id', DEMO_ID)
  );

  await run(
    'remplacement des items de kits',
    supabase.from('materiel_kit_items').delete().in('kit_id', Object.keys(KIT_META))
  );

  const kitItemRows = [];
  for (const [kitId, items] of Object.entries(KIT_ITEMS)) {
    items.forEach((item, index) => {
      kitItemRows.push({
        id: uid('c0de2001', Object.keys(KIT_META).indexOf(kitId) * 100 + index + 1),
        kit_id: kitId,
        user_id: DEMO_ID,
        name: item[0],
        category: item[1],
        weight_g: item[2],
        quantity: 1,
        is_checked: true,
        condition: 'bon',
        ownership: 'personal',
        priority: item[3],
        is_vital: item[3] === 'vital',
      });
    });
  }
  await run(
    'insertion des items de kits',
    supabase.from('materiel_kit_items').insert(kitItemRows)
  );
  note(`6 kits cohérents, ${kitItemRows.length} items, doublons archivés`);

  // ── 5. Sessions compagnons (cordée réelle) ─────────────────────────────────
  await run(
    'sessions des compagnons',
    supabase.from('hike_sessions').upsert(
      COMPANION_SESSIONS.map((session) => ({
        ...session,
        processing_status: 'processed',
        positions_geojson: null,
        positions_timed: null,
        visibility: 'collective_anonymized',
      })),
      { onConflict: 'id' }
    )
  );
  note(`${COMPANION_SESSIONS.length} sorties compagnons sur les mêmes itinéraires/jours`);

  // ── 6. Participants, kudos, commentaires ──────────────────────────────────
  const participantRows = [];
  for (const [sessionId, users] of Object.entries(PARTICIPANTS)) {
    for (const userId of users) {
      participantRows.push({ session_id: sessionId, user_id: userId, role: 'guest' });
    }
  }
  await run(
    'participants',
    supabase
      .from('hike_session_participants')
      .upsert(participantRows, { onConflict: 'session_id,user_id', ignoreDuplicates: true })
  );

  const kudosRows = [];
  for (const [sessionId, users] of Object.entries(KUDOS)) {
    for (const userId of users) {
      kudosRows.push({ session_id: sessionId, user_id: userId, created_at: iso(-2) });
    }
  }
  await run(
    'kudos',
    supabase
      .from('hike_session_kudos')
      .upsert(kudosRows, { onConflict: 'session_id,user_id', ignoreDuplicates: true })
  );

  await run(
    'commentaires',
    supabase.from('hike_session_comments').upsert(COMMENTS, {
      onConflict: 'id',
      ignoreDuplicates: true,
    })
  );
  note(
    `${participantRows.length} participants, ${kudosRows.length} kudos, ${COMMENTS.length} commentaires`
  );

  // ── 7. Carnets : métadonnées, compteurs, collaborateurs ────────────────────
  for (const [carnetId, meta] of Object.entries(CARNET_META)) {
    await run(
      'mise à jour du carnet',
      supabase
        .from('carnets')
        .update({
          tags: meta.tags,
          weather: meta.weather,
          route_rating: meta.rating,
          distance_km: meta.km,
          denivele_m: meta.dplus,
          nb_nuits: meta.nights,
          nb_voyageurs: meta.travellers,
          lieu_depart: meta.from,
          lieu_arrivee: meta.to,
          updated_at: new Date().toISOString(),
        })
        .eq('id', carnetId)
        .eq('author_id', DEMO_ID)
    );
  }

  const carnetIds = Object.values(CARNETS);
  const [likes, comments, favorites] = await Promise.all([
    maybe(
      'lecture des likes carnets',
      supabase.from('carnet_likes').select('carnet_id').in('carnet_id', carnetIds)
    ),
    maybe(
      'lecture des commentaires carnets',
      supabase.from('carnet_comments').select('carnet_id').in('carnet_id', carnetIds)
    ),
    maybe(
      'lecture des favoris carnets',
      supabase.from('carnet_favorites').select('carnet_id').in('carnet_id', carnetIds)
    ),
  ]);
  const countBy = (rows) =>
    rows.reduce((map, row) => {
      if (row.carnet_id) map.set(row.carnet_id, (map.get(row.carnet_id) || 0) + 1);
      return map;
    }, new Map());
  const likesBy = countBy(likes);
  const commentsBy = countBy(comments);
  const favoritesBy = countBy(favorites);

  let viewBase = 340;
  for (const carnetId of carnetIds) {
    viewBase += 137;
    await run(
      'compteurs du carnet',
      supabase
        .from('carnets')
        .update({
          likes_count: likesBy.get(carnetId) || 0,
          comments_count: commentsBy.get(carnetId) || 0,
          favorites_count: favoritesBy.get(carnetId) || 0,
          views_count: viewBase,
        })
        .eq('id', carnetId)
        .eq('author_id', DEMO_ID)
    );
  }

  await run(
    'collaborateurs du carnet TMB',
    supabase.from('carnet_collaborators').upsert(
      [
        { id: uid('c0de9001', 1), carnet_id: CARNETS.tmb, user_id: COMPANIONS.marie, role: 'contributor' },
        { id: uid('c0de9001', 2), carnet_id: CARNETS.tmb, user_id: COMPANIONS.thomas, role: 'viewer' },
      ],
      { onConflict: 'id', ignoreDuplicates: true }
    )
  );
  await run(
    'carnet TMB collaboratif',
    supabase.from('carnets').update({ is_collaborative: true }).eq('id', CARNETS.tmb)
  );
  note('10 carnets : métadonnées, compteurs réels, 2 collaborateurs TMB');

  // ── 8. Prêts et emprunts ───────────────────────────────────────────────────
  // Objets empruntés : ils appartiennent aux compagnons.
  const BORROWED_ITEMS = [
    {
      id: uid('c0de2002', 1),
      userId: COMPANIONS.marie,
      name: 'Tente Hilleberg Akto',
      brand: 'Hilleberg',
      category: 'Couchage & Tentes',
      weight: 1700,
      price: 62000,
      photo: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=400&q=80',
    },
    {
      id: uid('c0de2002', 2),
      userId: COMPANIONS.thomas,
      name: 'Réchaud Primus OmniLite',
      brand: 'Primus',
      category: 'Cuisine & Réchauds',
      weight: 450,
      price: 18000,
      photo: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=400&q=80',
    },
    {
      id: uid('c0de2002', 3),
      userId: COMPANIONS.sophie,
      name: 'Duvet Cumulus 400',
      brand: 'Cumulus',
      category: 'Couchage & Tentes',
      weight: 650,
      price: 34000,
      photo: 'https://images.unsplash.com/photo-1483347756197-71ef80e95f73?auto=format&fit=crop&w=400&q=80',
    },
    {
      id: uid('c0de2002', 4),
      userId: COMPANIONS.lucas,
      name: 'Bâtons Black Diamond Distance Carbon',
      brand: 'Black Diamond',
      category: 'Sacs & Portage',
      weight: 340,
      price: 15000,
      photo: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=400&q=80',
    },
  ];

  for (const item of BORROWED_ITEMS) {
    const existing = await maybe(
      'lecture objet emprunté',
      supabase.from('product_ownership').select('id,status').eq('id', item.id).maybeSingle()
    );
    if (!existing) {
      await run(
        'création objet emprunté',
        supabase.from('product_ownership').insert({
          id: item.id,
          user_id: item.userId,
          name: item.name,
          brand: item.brand,
          category: item.category,
          weight_g: item.weight,
          price_cents: item.price,
          condition: 'bon',
          photo_url: item.photo,
          status: 'a_preter',
          listing_mode: 'pret',
          quantity: 1,
        })
      );
    }
  }

  async function prepareOwnedForLoan(ownershipId) {
    // Le trigger `inventory_loan_guard` accepte un objet `en_stock` et le passe
    // lui-même en `en_pret`. On ne touche donc pas au statut ici : cela évite de
    // déclencher les triggers marketplace sous le rôle service.
    const row = await maybe(
      'lecture objet prêté',
      supabase.from('product_ownership').select('id,status').eq('id', ownershipId).maybeSingle()
    );
    if (!row) throw new Error(`Objet ${ownershipId} introuvable`);
  }

  async function ensureLoan(loan) {
    const existing = await maybe(
      'lecture prêt',
      supabase
        .from('materiel_loans')
        .select('id,status,returned_at,lender_rating,borrower_rating')
        .eq('id', loan.id)
        .maybeSingle()
    );

    if (!existing) {
      await prepareOwnedForLoan(loan.ownershipId, loan.lenderId);
      await run(
        'création prêt',
        supabase.from('materiel_loans').insert({
          id: loan.id,
          product_ownership_id: loan.ownershipId,
          lender_id: loan.lenderId,
          borrower_id: loan.borrowerId,
          borrower_contact: loan.borrowerContact || null,
          status: 'en_cours',
          loaned_at: loan.loanedAt,
          due_date: loan.dueDate || null,
          returned_at: null,
          lender_rating: null,
          borrower_rating: null,
        })
      );
    }

    if (loan.status === 'rendu') {
      const current = existing || { status: 'en_cours' };
      if (current.status !== 'rendu') {
        await run(
          'retour du prêt',
          supabase
            .from('materiel_loans')
            .update({
              status: 'rendu',
              returned_at: loan.returnedAt || day(-3),
              lender_rating: loan.lenderRating ?? null,
              borrower_rating: loan.borrowerRating ?? null,
            })
            .eq('id', loan.id)
        );
      }
    } else if (loan.status === 'en_retard') {
      const current = existing || { status: 'en_cours' };
      if (current.status !== 'en_retard') {
        await run(
          'retard du prêt',
          supabase.from('materiel_loans').update({ status: 'en_retard' }).eq('id', loan.id)
        );
      }
    }

    await run(
      'notes du prêt',
      supabase
        .from('materiel_loans')
        .update({
          lender_rating: loan.lenderRating ?? null,
          borrower_rating: loan.borrowerRating ?? null,
          borrower_contact: loan.borrowerContact || null,
        })
        .eq('id', loan.id)
        .is('lender_rating', null)
        .is('borrower_rating', null)
    );
  }

  // Prêt existant en retard : rattaché à Marie.
  await run(
    'prêt existant en retard',
    supabase
      .from('materiel_loans')
      .update({
        borrower_contact: 'Marie Dupont',
        status: 'en_retard',
        loaned_at: '2026-08-10',
        due_date: '2026-09-05',
      })
      .eq('id', '1317fb7e-c45c-4932-937d-c3d467a35349')
  );

  // Prêt existant rendu : rattaché à Lucas, noté.
  await run(
    'prêt existant rendu',
    supabase
      .from('materiel_loans')
      .update({
        borrower_contact: 'Lucas Petit',
        status: 'rendu',
        loaned_at: '2026-07-20',
        due_date: '2026-08-18',
        returned_at: '2026-08-17',
        lender_rating: 5,
        borrower_rating: 5,
      })
      .eq('id', 'fb4cf3b1-ae6b-421d-9db2-cdd1d2b0a31f')
  );

  const LOANS = [
    {
      id: uid('c0de3001', 1),
      ownershipId: 'cbc7d69b-b7fd-4f07-825d-54d53d12bdef',
      lenderId: DEMO_ID,
      borrowerId: COMPANIONS.sophie,
      status: 'en_cours',
      loanedAt: day(-8),
      dueDate: day(9),
    },
    {
      id: uid('c0de3001', 2),
      ownershipId: '5cb31062-d39b-43b9-9101-3c4fef28cc54',
      lenderId: DEMO_ID,
      borrowerId: COMPANIONS.thomas,
      status: 'en_cours',
      loanedAt: day(-4),
      dueDate: day(6),
    },
    {
      id: uid('c0de3001', 3),
      ownershipId: 'c6f781d0-44b5-439a-bd17-d37c40d61237',
      lenderId: DEMO_ID,
      borrowerId: COMPANIONS.marie,
      status: 'rendu',
      loanedAt: day(-40),
      dueDate: day(-26),
      returnedAt: day(-28),
      lenderRating: 5,
      borrowerRating: 5,
    },
    {
      id: uid('c0de3001', 4),
      ownershipId: '225f0e36-581a-4f54-9670-a64fe9275167',
      lenderId: DEMO_ID,
      borrowerId: COMPANIONS.julie,
      status: 'en_retard',
      loanedAt: day(-30),
      dueDate: day(-12),
    },
    {
      id: uid('c0de3001', 5),
      ownershipId: BORROWED_ITEMS[0].id,
      lenderId: COMPANIONS.marie,
      borrowerId: DEMO_ID,
      status: 'en_cours',
      loanedAt: day(-6),
      dueDate: day(8),
      borrowerContact: 'Léa Fontaine',
    },
    {
      id: uid('c0de3001', 6),
      ownershipId: BORROWED_ITEMS[1].id,
      lenderId: COMPANIONS.thomas,
      borrowerId: DEMO_ID,
      status: 'rendu',
      loanedAt: day(-55),
      dueDate: day(-45),
      returnedAt: day(-47),
      lenderRating: 5,
      borrowerRating: 5,
      borrowerContact: 'Léa Fontaine',
    },
    {
      id: uid('c0de3001', 7),
      ownershipId: BORROWED_ITEMS[2].id,
      lenderId: COMPANIONS.sophie,
      borrowerId: DEMO_ID,
      status: 'en_cours',
      loanedAt: day(-12),
      dueDate: day(2),
      borrowerContact: 'Léa Fontaine',
    },
    {
      id: uid('c0de3001', 8),
      ownershipId: BORROWED_ITEMS[3].id,
      lenderId: COMPANIONS.lucas,
      borrowerId: DEMO_ID,
      status: 'rendu',
      loanedAt: day(-70),
      dueDate: day(-60),
      returnedAt: day(-61),
      lenderRating: 5,
      borrowerRating: 4,
      borrowerContact: 'Léa Fontaine',
    },
  ];

  for (const loan of LOANS) {
    await ensureLoan(loan);
  }
  note('8 prêts : 4 côté prêteur, 4 côté emprunteur, 2 retours notés, 1 retard');

  // ── 9. Trophées et défis ───────────────────────────────────────────────────
  await run(
    'trophées',
    supabase.from('user_badges').upsert(
      BADGES.map((badge) => ({
        user_id: DEMO_ID,
        badge_id: badge.id,
        earned_at: badge.date,
      })),
      { onConflict: 'user_id,badge_id', ignoreDuplicates: true }
    )
  );

  for (const challenge of USER_CHALLENGES) {
    const existing = await maybe(
      'lecture défi utilisateur',
      supabase
        .from('user_challenges')
        .select('id')
        .eq('user_id', DEMO_ID)
        .eq('challenge_id', challenge.challenge_id)
        .maybeSingle()
    );
    const payload = {
      user_id: DEMO_ID,
      challenge_id: challenge.challenge_id,
      progress: challenge.progress,
      completed: challenge.completed,
      completed_at: challenge.completed ? iso(-7) : null,
    };
    if (existing) {
      await run(
        'mise à jour défi utilisateur',
        supabase.from('user_challenges').update(payload).eq('id', existing.id)
      );
    } else {
      await run(
        'création défi utilisateur',
        supabase.from('user_challenges').insert(payload)
      );
    }
  }

  await run(
    'défi de progression en cours',
    supabase
      .from('user_progression')
      .update({
        current_challenge_id: 'chal_exp_02',
        challenge_progress: 2,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', DEMO_ID)
  );
  note(`${BADGES.length} trophées, 11 défis avec progression, 1 défi de progression en cours`);

  // ── 10. Republications ─────────────────────────────────────────────────────
  const sourcePosts = await maybe(
    'lecture des posts source',
    supabase
      .from('community_posts')
      .select('id,title,content,image_url,author_id,created_at')
      .neq('author_id', DEMO_ID)
      .eq('audience', 'public')
      .not('image_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(3)
  );
  if (sourcePosts.length >= 2) {
    const repostRows = REPOSTS.map((repost, index) => {
      const source = sourcePosts[repost.sourceIndex] || sourcePosts[0];
      return {
        id: repost.id,
        author_id: DEMO_ID,
        title: '',
        content: repost.content,
        image_url: source.image_url || '',
        media_urls: [],
        likes_count: 0,
        comments_count: 0,
        audience: 'public',
        created_at: iso(-1 - index),
        reposted_from_id: source.id,
      };
    });
    await run(
      'republications',
      supabase.from('community_posts').upsert(repostRows, {
        onConflict: 'id',
        ignoreDuplicates: true,
      })
    );
    note(`${repostRows.length} republications visibles dans la Vitrine`);
  }

  // ── 11. Stories et albums ──────────────────────────────────────────────────
  await run(
    'stories actives',
    supabase
      .from('post_stories')
      .update({ expires_at: iso(3) })
      .eq('author_id', DEMO_ID)
  );

  await run(
    'nouvelles stories',
    supabase.from('post_stories').upsert(
      STORIES.map((story) => ({
        id: story.id,
        author_id: DEMO_ID,
        caption: story.caption,
        image_url: story.image_url,
        media_type: 'image',
        visibility: 'public',
        expires_at: iso(3),
        created_at: iso(-0.2),
      })),
      { onConflict: 'id', ignoreDuplicates: true }
    )
  );

  await run(
    'couvertures des albums',
    supabase
      .from('story_highlights')
      .update({ cover_story_id: '4ccb209d-92fc-5789-848c-6814a50a9940' })
      .eq('owner_id', DEMO_ID)
      .eq('title', 'Alpes')
  );
  await run(
    'couvertures des albums',
    supabase
      .from('story_highlights')
      .update({ cover_story_id: '3fba1282-27ee-5f36-be44-0d54035f5586' })
      .eq('owner_id', DEMO_ID)
      .eq('title', 'Islande')
  );
  await run(
    'couvertures des albums',
    supabase
      .from('story_highlights')
      .update({ cover_story_id: 'aa3882eb-4856-5081-a044-48264977b45d' })
      .eq('owner_id', DEMO_ID)
      .eq('title', 'Bivouacs')
  );
  await run(
    'couvertures des albums',
    supabase
      .from('story_highlights')
      .update({ cover_story_id: '27dc3f7a-bd3a-5514-9b6b-d8ca6826bb7d' })
      .eq('owner_id', DEMO_ID)
      .eq('title', 'Dolomites')
  );
  await run(
    'couvertures des albums',
    supabase
      .from('story_highlights')
      .update({ cover_story_id: '3f58566d-2516-5f2a-a222-b3b8f4218df0' })
      .eq('owner_id', DEMO_ID)
      .eq('title', 'Lille')
  );
  note('18 stories actives, 3 nouvelles, 5 albums avec couvertures distinctes');

  // ── 12. Notifications et commandes ─────────────────────────────────────────
  await run(
    'notifications',
    supabase.from('notifications').upsert(
      NOTIFICATIONS.map((notification) => ({
        ...notification,
        user_id: DEMO_ID,
        read_at: notification.read ? notification.created_at : null,
        updated_at: notification.created_at,
      })),
      { onConflict: 'id', ignoreDuplicates: true }
    )
  );

  const shipped = await maybe(
    'lecture commande expédiée',
    supabase
      .from('orders')
      .select('id,order_number,status')
      .eq('user_id', DEMO_ID)
      .eq('status', 'shipped')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  );
  if (shipped) {
    await run(
      'suivi de commande',
      supabase
        .from('orders')
        .update({
          tracking_url: 'https://tracking.laposte.fr/',
          carrier: 'Colissimo',
          estimated_delivery: day(2),
        })
        .eq('id', shipped.id)
    );
  }
  note(`${NOTIFICATIONS.length} notifications récentes, suivi de commande renseigné`);

  // ── 13. Résumé ─────────────────────────────────────────────────────────────
  console.log('\n=== TERMINÉ ===');
  console.log(`Compte   : ${DEMO_EMAIL}`);

  console.log('\nÀ vérifier sur /compte :');
  for (const line of summary) console.log(` • ${line}`);
}

main().catch((error) => {
  console.error('\n✗ Échec du seed :', error.message);
  process.exitCode = 1;
});
