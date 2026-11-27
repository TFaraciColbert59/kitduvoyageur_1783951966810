import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const envPath = path.join(rootDir, '.env.local');

const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const DATABASE_URL = env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL in .env.local');
  process.exit(1);
}

const CLUB_SLUG = 'cordee-des-alpes';
const DEMO_USER_ID = '9c0b1015-21a5-40cc-b670-f14d55ad4a0c';
const USER_AGENT = 'LeKitDuVoyageur/1.0 (+https://lekitduvoyageur.fr)';

/**
 * 18 vrais itinéraires alpins issus d'OpenStreetMap / Waymarked Trails
 * (GR, GRP, randonnées d'altitude, trail, VTT, vélo de montagne, lacs & bivouacs).
 */
const REAL_ALPINE_OUTINGS = [
  {
    api: 'hiking',
    osmRelationId: 19541366,
    titleBase: 'Lac Blanc — Balcon des Aiguilles Rouges',
    location: 'Chamonix · Mont-Blanc',
    meetingPoint: 'Téléphérique de la Flégère · Les Praz',
    region: 'mont blanc',
    sport: 'Randonnée',
    format: 'trail_outing',
    surfaceType: 'trail',
    daysOffset: 0.05, // LIVE aujourd'hui
    maxParticipants: 16,
    participantsCount: 13,
    difficulty: 'Modérée',
    season: 'Juin à Octobre',
    description:
      'Sortie club sur le vrai sentier balisé OSM vers le Lac Blanc (2 352 m) face aux Drus et à la Mer de Glace. Brief météo et matériel sur le salon du club.',
  },
  {
    api: 'mtb',
    osmRelationId: 19544726,
    titleBase: 'Chamonix – Argentière · Petit Balcon Nord VTT',
    location: 'Chamonix · Mont-Blanc',
    meetingPoint: 'Parking du Grépon · Chamonix',
    region: 'mont blanc',
    sport: 'VTT',
    format: 'social_ride',
    surfaceType: 'trail',
    daysOffset: 2,
    maxParticipants: 14,
    participantsCount: 11,
    difficulty: 'Modérée',
    season: 'Mai à Octobre',
    description:
      'Parcours VTT balisé officiel FFC/OSM reliant Chamonix à Argentière en sous-bois face aux glaciers. Casque et kit réparation obligatoires.',
  },
  {
    api: 'hiking',
    osmRelationId: 15523007,
    titleBase: 'Boucle du Mont Veyrier — Panorama Lac d’Annecy',
    location: 'Annecy-le-Vieux · Aravis',
    meetingPoint: 'Col des Contrebandiers · Annecy',
    region: 'aravis',
    sport: 'Trail',
    format: 'training',
    surfaceType: 'trail',
    daysOffset: 4,
    maxParticipants: 20,
    participantsCount: 16,
    difficulty: 'Modérée',
    season: 'Avril à Novembre',
    description:
      'Sortie trail rythme sur les crêtes du Mont Veyrier et du Mont Baron surplombant tout le lac d’Annecy. Deux groupes d’allure encadrés.',
  },
  {
    api: 'hiking',
    osmRelationId: 2795159,
    titleBase: 'Boucle du Plateau du Parmelan',
    location: 'Villaz · Aravis',
    meetingPoint: 'Chalet de l’Anglettaz · Dingy-Saint-Clair',
    region: 'aravis',
    sport: 'Randonnée',
    format: 'trail_outing',
    surfaceType: 'trail',
    daysOffset: 7,
    maxParticipants: 18,
    participantsCount: 14,
    difficulty: 'Modérée',
    season: 'Mai à Octobre',
    description:
      'Boucle calcaire emblématique du massif des Bornes-Aravis avec traversée des lapiaz du Parmelan et vue 360° sur le Mont-Blanc.',
  },
  {
    api: 'hiking',
    osmRelationId: 18253010,
    titleBase: 'Boucle d’Ailefroide — Vallouise Écrins',
    location: 'Ailefroide · Écrins',
    meetingPoint: 'Refuge d’Ailefroide · Pelvoux',
    region: 'ecrins',
    sport: 'Alpinisme',
    format: 'trail_outing',
    surfaceType: 'trail',
    daysOffset: 10,
    maxParticipants: 12,
    participantsCount: 9,
    difficulty: 'Difficile',
    season: 'Juin à Septembre',
    description:
      'Approche alpine et reconnaissance haute montagne autour d’Ailefroide au cœur du Parc National des Écrins. Encadrement par les guides du club.',
  },
  {
    api: 'hiking',
    osmRelationId: 19527067,
    titleBase: 'La Brèche Pacave depuis La Grave',
    location: 'La Grave · Écrins',
    meetingPoint: 'Gare du Téléphérique de La Meije · La Grave',
    region: 'ecrins',
    sport: 'Alpinisme',
    format: 'trail_outing',
    surfaceType: 'trail',
    daysOffset: 14,
    maxParticipants: 10,
    participantsCount: 8,
    difficulty: 'Difficile',
    season: 'Juin à Septembre',
    description:
      'Itinéraire d’altitude face aux glaciers de la Meije via le sentier balisé CA17. Prévoir crampons légers en début de saison et coupe-vent.',
  },
  {
    api: 'hiking',
    osmRelationId: 4140968,
    titleBase: 'Pas de l’Aiguille — Hauts Plateaux du Vercors',
    location: 'Chichilianne · Vercors',
    meetingPoint: 'Parking de Richardière · Chichilianne',
    region: 'vercors',
    sport: 'Randonnée',
    format: 'trail_outing',
    surfaceType: 'trail',
    daysOffset: 18,
    maxParticipants: 18,
    participantsCount: 15,
    difficulty: 'Modérée',
    season: 'Mai à Octobre',
    description:
      'Montée mythique vers les Hauts Plateaux du Vercors face au Mont Aiguille, sur la trace officielle OSM du Pas de l’Aiguille.',
  },
  {
    api: 'hiking',
    osmRelationId: 18892679,
    titleBase: 'Tour des Lacs des Sept Laux — Bivouac Belledonne',
    location: 'Allevard · Belledonne',
    meetingPoint: 'Station du Pleynet · Les Sept Laux',
    region: 'belledonne',
    sport: 'Bivouac',
    format: 'trail_outing',
    surfaceType: 'trail',
    daysOffset: 23,
    maxParticipants: 14,
    participantsCount: 11,
    difficulty: 'Difficile',
    season: 'Juillet à Septembre',
    description:
      'Itinérance de 2 jours en autonomie sur le vrai tracé du Tour des Lacs des Sept Laux : lacs glaciaires d’altitude, bivouac réglementé et zéro déchet.',
  },
  {
    api: 'hiking',
    osmRelationId: 377905,
    titleBase: 'GR 55 La Vanoise — Traversée des Glaciers',
    location: 'Pralognan · Vanoise',
    meetingPoint: 'Val Claret · Tignes / Pralognan-la-Vanoise',
    region: 'vanoise',
    sport: 'Trekking',
    format: 'trail_outing',
    surfaceType: 'trail',
    daysOffset: 29,
    maxParticipants: 14,
    participantsCount: 10,
    difficulty: 'Difficile',
    season: 'Juillet à Septembre',
    description:
      'Grande Randonnée nationale GR 55 au cœur du Parc National de la Vanoise, entre Tignes, le Col de la Vanoise et Modane sous la Grande Casse.',
  },
  {
    api: 'cycling',
    osmRelationId: 17837731,
    titleBase: 'Circuit de Leschaux — Lac d’Annecy & Bauges',
    location: 'Annecy · Lac d’Annecy',
    meetingPoint: 'Port des Marquisats · Lac d’Annecy',
    region: 'aravis',
    sport: 'Vélo',
    format: 'social_ride',
    surfaceType: 'road',
    daysOffset: 34,
    maxParticipants: 20,
    participantsCount: 14,
    difficulty: 'Modérée',
    season: 'Avril à Octobre',
    description:
      'Boucle cyclo officielle autour du Lac d’Annecy et du Col de Leschaux dans les Bauges. Départ groupé depuis les rives navigables du lac.',
  },
  // --- SORTIES TERMINÉES (historique récent vérifié + corrélation Pokédex & stats) ---
  {
    api: 'hiking',
    osmRelationId: 14379010,
    titleBase: 'Croix de Pralognan — Balcon de Vanoise',
    location: 'Pralognan · Vanoise',
    meetingPoint: 'Centre village · Pralognan-la-Vanoise',
    region: 'vanoise',
    sport: 'Trail',
    format: 'training',
    surfaceType: 'trail',
    daysOffset: -4,
    maxParticipants: 16,
    participantsCount: 15,
    difficulty: 'Modérée',
    season: 'Mai à Octobre',
    description:
      'Sortie trail nerveuse sur le sentier balisé de la Croix de Pralognan avec vue directe sur l’Aiguille de la Vanoise et les glaciers.',
  },
  {
    api: 'hiking',
    osmRelationId: 13611430,
    titleBase: 'Boucle du Pigeonnier — Cirque du Gioberney',
    location: 'Valgaudemar · Écrins',
    meetingPoint: 'Chalet-Hôtel du Gioberney · La Chapelle-en-Valgaudemar',
    region: 'ecrins',
    sport: 'Randonnée',
    format: 'trail_outing',
    surfaceType: 'trail',
    daysOffset: -9,
    maxParticipants: 16,
    participantsCount: 16,
    difficulty: 'Modérée',
    season: 'Juin à Octobre',
    description:
      'Boucle grandiose dans le cirque glaciaire du Gioberney jusqu’au refuge du Pigeonnier face aux Rouies et au Sirac.',
  },
  {
    api: 'hiking',
    osmRelationId: 2903649,
    titleBase: 'Tour des Petites Roches — Balcon de Chartreuse',
    location: 'Saint-Hilaire · Chartreuse',
    meetingPoint: 'Plateau des Petites Roches · Saint-Hilaire-du-Touvet',
    region: 'chartreuse',
    sport: 'Trail',
    format: 'training',
    surfaceType: 'trail',
    daysOffset: -15,
    maxParticipants: 18,
    participantsCount: 17,
    difficulty: 'Modérée',
    season: 'Avril à Novembre',
    description:
      'Sortie trail club sur les balcons de Chartreuse au-dessus de la vallée du Grésivaudan face à toute la chaîne de Belledonne.',
  },
  {
    api: 'hiking',
    osmRelationId: 2795160,
    titleBase: 'GRP Tour du Lac d’Annecy — Crêtes & Rives',
    location: 'Annecy · Lac d’Annecy',
    meetingPoint: 'Pont des Amours · Annecy',
    region: 'aravis',
    sport: 'Trekking',
    format: 'trail_outing',
    surfaceType: 'trail',
    daysOffset: -22,
    maxParticipants: 14,
    participantsCount: 13,
    difficulty: 'Difficile',
    season: 'Mai à Octobre',
    description:
      'Grande Randonnée de Pays (GRP TLA) sur les balcons et sommets qui encerclent le lac navigable d’Annecy : Semnoz, Taillefer, Tournette et Veyrier.',
  },
  {
    api: 'hiking',
    osmRelationId: 11376368,
    titleBase: 'Tour du Mont Thabor — Vallée de la Clarée',
    location: 'Névache · Clarée',
    meetingPoint: 'Parking de Laval · Haute Clarée',
    region: 'claree',
    sport: 'Trekking',
    format: 'trail_outing',
    surfaceType: 'trail',
    daysOffset: -31,
    maxParticipants: 14,
    participantsCount: 12,
    difficulty: 'Difficile',
    season: 'Juillet à Septembre',
    description:
      'Trekking itinérant en refuge autour du Mont Thabor (3 178 m) entre Haute Clarée, Vallée Étroite et Maurienne.',
  },
  {
    api: 'hiking',
    osmRelationId: 16101643,
    titleBase: 'GR 57 — Tour de la Haute Vallée de la Clarée',
    location: 'Névache · Briançonnais',
    meetingPoint: 'Ville Haute · Névache',
    region: 'claree',
    sport: 'Trekking',
    format: 'trail_outing',
    surfaceType: 'trail',
    daysOffset: -42,
    maxParticipants: 12,
    participantsCount: 11,
    difficulty: 'Difficile',
    season: 'Juillet à Septembre',
    description:
      'Grande Randonnée GR 57 dans les alpages, cols frontaliers et lacs d’altitude de la vallée préservée de la Clarée.',
  },
  {
    api: 'hiking',
    osmRelationId: 9711201,
    titleBase: 'GR 58 — Tour du Queyras',
    location: 'Ceillac · Queyras',
    meetingPoint: 'Place du Village · Ceillac',
    region: 'queyras',
    sport: 'Trekking',
    format: 'trail_outing',
    surfaceType: 'trail',
    daysOffset: -54,
    maxParticipants: 14,
    participantsCount: 14,
    difficulty: 'Difficile',
    season: 'Juin à Septembre',
    description:
      'Boucle mythique du GR 58 à travers le Parc Naturel Régional du Queyras : Saint-Véran, Col Agnel, Vallée du Guil et lacs miroir.',
  },
  {
    api: 'hiking',
    osmRelationId: 16527402,
    titleBase: 'Tour des Aiguilles d’Arves — Haute Maurienne',
    location: 'Valloire · Maurienne',
    meetingPoint: 'Bonnenuit · Valloire',
    region: 'maurienne',
    sport: 'Alpinisme',
    format: 'trail_outing',
    surfaceType: 'trail',
    daysOffset: -63,
    maxParticipants: 12,
    participantsCount: 10,
    difficulty: 'Difficile',
    season: 'Juillet à Septembre',
    description:
      'Grande boucle alpine autour des trois pointes emblématiques des Aiguilles d’Arves entre Savoie et Hautes-Alpes.',
  },
];

// --- Mercator EPSG:3857 -> WGS84 [lng, lat] ---
function mercatorToLngLat(x, y) {
  const lng = (x / 20037508.34) * 180;
  const lat = (Math.atan(Math.exp((y / 20037508.34) * Math.PI)) * 360) / Math.PI - 90;
  return [Number(lng.toFixed(5)), Number(lat.toFixed(5))];
}

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Extrait récursivement les segments de coordonnées WGS84 depuis la structure `route`
 * de Waymarked Trails (`main`, `linear`, `split`, `base`).
 */
function extractWaymarkedSegments(routeObj) {
  const segments = [];
  const visit = (node) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (node.route_type === 'base' && node.geometry?.type === 'LineString' && Array.isArray(node.geometry.coordinates)) {
      let coords = node.geometry.coordinates.map(([x, y]) => mercatorToLngLat(x, y));
      if (node.direction === -1) coords = coords.reverse();
      if (coords.length >= 2) segments.push(coords);
      return;
    }
    if (Array.isArray(node.main)) visit(node.main);
    if (Array.isArray(node.ways)) visit(node.ways);
    if (Array.isArray(node.forward) && node.forward.length > 0) {
      visit(node.forward);
    } else if (Array.isArray(node.backward) && node.backward.length > 0) {
      visit(node.backward);
    }
  };
  visit(routeObj);

  // Merge contiguous segments whose endpoints touch (< 80 m)
  const merged = [];
  for (const seg of segments) {
    if (merged.length === 0) {
      merged.push([...seg]);
      continue;
    }
    const prev = merged[merged.length - 1];
    const lastPt = prev[prev.length - 1];
    const firstPt = seg[0];
    if (haversineKm(lastPt, firstPt) < 0.08) {
      prev.push(...seg.slice(1));
    } else if (haversineKm(lastPt, seg[seg.length - 1]) < 0.08) {
      const rev = [...seg].reverse();
      prev.push(...rev.slice(1));
    } else {
      merged.push([...seg]);
    }
  }
  return merged;
}

function downsampleLine(coords, maxPoints) {
  if (coords.length <= maxPoints) return coords;
  const out = [];
  const step = (coords.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i += 1) {
    const idx = Math.min(coords.length - 1, Math.round(i * step));
    out.push(coords[idx]);
  }
  return out;
}

// --- Real DEM Elevation Sampler (AWS Terrain Tiles Terrarium zoom 12) ---
const DEM_TILE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';
const DEM_ZOOM = 12;
const DEM_SIZE = 256;
const tileCache = new Map();

function tileOf(lon, lat, zoom = DEM_ZOOM) {
  const n = 2 ** zoom;
  const latRad = (Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180;
  const fx = ((lon + 180) / 360) * n;
  const fy = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const x = Math.min(n - 1, Math.max(0, Math.floor(fx)));
  const y = Math.min(n - 1, Math.max(0, Math.floor(fy)));
  return {
    x,
    y,
    px: Math.min(DEM_SIZE - 1, Math.floor((fx - x) * DEM_SIZE)),
    py: Math.min(DEM_SIZE - 1, Math.floor((fy - y) * DEM_SIZE)),
  };
}

async function getDemTile(x, y) {
  const key = `${DEM_ZOOM}/${x}/${y}`;
  if (tileCache.has(key)) return tileCache.get(key);
  const p = (async () => {
    const res = await fetch(`${DEM_TILE_URL}/${DEM_ZOOM}/${x}/${y}.png`, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return null;
    const png = Buffer.from(await res.arrayBuffer());
    const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== DEM_SIZE || info.height !== DEM_SIZE || info.channels !== 3) return null;
    return new Uint8Array(data);
  })();
  tileCache.set(key, p);
  return p;
}

async function sampleElevations(coords) {
  const out = [];
  for (const [lng, lat] of coords) {
    const t = tileOf(lng, lat);
    const data = await getDemTile(t.x, t.y);
    if (!data) {
      out.push(null);
      continue;
    }
    const i = (t.py * DEM_SIZE + t.px) * 3;
    const h = data[i] * 256 + data[i + 1] + data[i + 2] / 256 - 32768;
    out.push(h > -500 ? Math.round(h) : null);
  }
  // Fill any single missing pixel from neighbor
  for (let i = 0; i < out.length; i += 1) {
    if (out[i] === null) {
      out[i] = out[i - 1] ?? out.find((v) => v !== null) ?? 1200;
    }
  }
  return out;
}

function computeElevationStats(elevs) {
  let gain = 0;
  let loss = 0;
  let minEle = Infinity;
  let maxEle = -Infinity;
  // Smooth micro-noise (threshold 8 m hysteresis)
  let anchor = elevs[0] ?? 1000;
  for (const e of elevs) {
    if (e < minEle) minEle = e;
    if (e > maxEle) maxEle = e;
    const diff = e - anchor;
    if (diff >= 8) {
      gain += diff;
      anchor = e;
    } else if (diff <= -8) {
      loss += Math.abs(diff);
      anchor = e;
    }
  }
  return {
    gain: Math.round(gain),
    loss: Math.round(loss),
    minEle: Math.round(minEle),
    maxEle: Math.round(maxEle),
  };
}

async function fetchWaymarkedRoute(spec) {
  const url = `https://${spec.api}.waymarkedtrails.org/api/v1/details/relation/${spec.osmRelationId}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error(`Waymarked HTTP ${res.status} for relation ${spec.osmRelationId}`);
  const data = await res.json();
  const segments = extractWaymarkedSegments(data.route);
  if (segments.length === 0) {
    throw new Error(`No geometry segments for relation ${spec.osmRelationId}`);
  }

  // Pick the largest continuous chain for the 3D track polyline (or concatenate all if close)
  const ordered = segments.flat();
  const trace2d = downsampleLine(ordered, 110);
  const elevs = await sampleElevations(trace2d);
  const trace3d = trace2d.map(([lng, lat], idx) => [lng, lat, elevs[idx]]);
  const eleStats = computeElevationStats(elevs);

  // Compute distance from Waymarked length (meters) or Haversine fallback
  let distKm = typeof data.route?.length === 'number' && data.route.length > 0
    ? Number((data.route.length / 1000).toFixed(1))
    : 0;
  if (!distKm) {
    let sum = 0;
    for (const seg of segments) {
      for (let i = 1; i < seg.length; i += 1) sum += haversineKm(seg[i - 1], seg[i]);
    }
    distKm = Number(sum.toFixed(1));
  }

  // Simplify MultiLineString for PostGIS storage (keep crisp geometry <= 1400 total vertices)
  const maxPerSeg = Math.max(20, Math.floor(1200 / segments.length));
  const multiLines = segments.map((seg) => downsampleLine(seg, maxPerSeg));

  const durationHours = Number((distKm / 4.0 + eleStats.gain / 350).toFixed(1));
  const network = data.tags?.network || (data.group === 'INT' ? 'iwn' : data.group === 'NAT' ? 'nwn' : data.group === 'REG' ? 'rwn' : 'lwn');

  return {
    osmRelationId: spec.osmRelationId,
    osmName: data.name || spec.titleBase,
    ref: data.ref || data.tags?.ref || null,
    network,
    distKm,
    durationHours,
    eleStats,
    startLng: trace3d[0][0],
    startLat: trace3d[0][1],
    trace3d,
    multiLineGeoJson: {
      type: 'MultiLineString',
      coordinates: multiLines,
    },
    osmTags: data.tags || {},
  };
}

async function main() {
  const pgClient = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await pgClient.connect();

  try {
    const { rows: clubRows } = await pgClient.query(
      `SELECT id, name, created_by FROM clubs WHERE slug = $1 LIMIT 1`,
      [CLUB_SLUG],
    );
    if (!clubRows.length) throw new Error(`Club '${CLUB_SLUG}' introuvable`);
    const club = clubRows[0];
    console.log(`Club trouvé: ${club.name} (${club.id})`);

    // Load active leaders & members of the club
    const { rows: members } = await pgClient.query(
      `SELECT user_id, role FROM club_members WHERE club_id = $1 AND status = 'active' ORDER BY joined_at ASC LIMIT 200`,
      [club.id],
    );
    const leaders = members.filter(
      (m) => m.user_id === club.created_by || m.role === 'admin' || m.role === 'moderator' || m.role === 'founder',
    );
    const organizerPool = leaders.length > 0 ? leaders.map((m) => m.user_id) : [club.created_by || DEMO_USER_ID];
    const memberPool = members.map((m) => m.user_id);

    // Sync hiking_routes sequence safely above any existing non-demo IDs if needed
    const { rows: seqCheck } = await pgClient.query(
      `SELECT COALESCE(MAX(id), 0) AS max_id FROM hiking_routes WHERE id < 9000000000000`,
    );
    const safeNextSeq = Math.max(Number(seqCheck[0].max_id) + 1, 200000);
    await pgClient.query(`SELECT setval('hiking_routes_id_seq', $1, false)`, [safeNextSeq]);

    // 1. Fetch all 18 REAL routes from OpenStreetMap / Waymarked Trails + AWS Terrain DEM
    console.log(`1. Téléchargement des ${REAL_ALPINE_OUTINGS.length} vraies traces OSM + altitudes DEM...`);
    const hydrated = [];
    for (const spec of REAL_ALPINE_OUTINGS) {
      const route = await fetchWaymarkedRoute(spec);
      console.log(
        `   ✓ [rel:${route.osmRelationId}] ${spec.titleBase} — ${route.distKm} km · +${route.eleStats.gain} m · max ${route.eleStats.maxEle} m (${route.trace3d.length} pts)`,
      );
      hydrated.push({ spec, route });
    }

    // 2. Upsert into hiking_routes + trail_metadata
    console.log('2. Enregistrement des 18 vrais tracés dans hiking_routes & trail_metadata...');
    const routeIdByOsmId = new Map();
    for (const { spec, route } of hydrated) {
      const enrichedTags = {
        ...route.osmTags,
        source: 'waymarkedtrails-osm',
        waymarked_api: spec.api,
        elevation_gain_m: route.eleStats.gain,
        elevation_loss_m: route.eleStats.loss,
        max_elevation_m: route.eleStats.maxEle,
        min_elevation_m: route.eleStats.minEle,
        trace_3d: route.trace3d,
      };

      const { rows: existing } = await pgClient.query(
        `SELECT id FROM hiking_routes WHERE osm_relation_id = $1 LIMIT 1`,
        [route.osmRelationId],
      );

      let routeId;
      if (existing.length > 0) {
        routeId = existing[0].id;
        await pgClient.query(
          `UPDATE hiking_routes
           SET name = $1, ref = $2, network = $3, distance_km = $4,
               geom = ST_SetSRID(ST_GeomFromGeoJSON($5), 4326),
               region = $6, tags = $7::jsonb
           WHERE id = $8`,
          [
            spec.titleBase,
            route.ref,
            route.network,
            route.distKm,
            JSON.stringify(route.multiLineGeoJson),
            spec.region,
            JSON.stringify(enrichedTags),
            routeId,
          ],
        );
      } else {
        const { rows: inserted } = await pgClient.query(
          `INSERT INTO hiking_routes (osm_relation_id, name, ref, network, distance_km, geom, region, tags)
           VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_GeomFromGeoJSON($6), 4326), $7, $8::jsonb)
           RETURNING id`,
          [
            route.osmRelationId,
            spec.titleBase,
            route.ref,
            route.network,
            route.distKm,
            JSON.stringify(route.multiLineGeoJson),
            spec.region,
            JSON.stringify(enrichedTags),
          ],
        );
        routeId = inserted[0].id;
      }

      await pgClient.query(
        `INSERT INTO trail_metadata (
           id, trail_id, difficulty, duration_hours, elevation_gain, elevation_loss,
           max_elevation, min_elevation, terrain_type, family_friendly, season, ai_description
         ) VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (trail_id) DO UPDATE SET
           difficulty = EXCLUDED.difficulty,
           duration_hours = EXCLUDED.duration_hours,
           elevation_gain = EXCLUDED.elevation_gain,
           elevation_loss = EXCLUDED.elevation_loss,
           max_elevation = EXCLUDED.max_elevation,
           min_elevation = EXCLUDED.min_elevation,
           terrain_type = EXCLUDED.terrain_type,
           season = EXCLUDED.season,
           ai_description = EXCLUDED.ai_description`,
        [
          routeId,
          spec.difficulty,
          route.durationHours,
          route.eleStats.gain,
          route.eleStats.loss,
          route.eleStats.maxEle,
          route.eleStats.minEle,
          route.ref?.startsWith('GR') ? 'Grande randonnée balisée' : 'Sentier alpin balisé',
          route.distKm <= 10 && route.eleStats.gain <= 650,
          spec.season,
          spec.description,
        ],
      );

      routeIdByOsmId.set(route.osmRelationId, String(routeId));
    }

    // 3. Delete ALL existing test/fake club_events for cordee-des-alpes
    const { rows: deletedRows } = await pgClient.query(
      `DELETE FROM club_events WHERE club_id = $1 RETURNING id`,
      [club.id],
    );
    console.log(`3. Supprimé ${deletedRows.length} anciennes sorties synthétiques du club '${CLUB_SLUG}'.`);

    // 4. Insert the 18 REAL outings linked to their real hiking_routes
    console.log('4. Insertion des 18 vraies sorties dans club_events...');
    const nowMs = Date.now();
    const insertedEventIds = [];

    for (let i = 0; i < hydrated.length; i += 1) {
      const { spec, route } = hydrated[i];
      const routeId = routeIdByOsmId.get(route.osmRelationId);
      const organizerId = organizerPool[i % organizerPool.length];
      const startsAt = new Date(nowMs + spec.daysOffset * 86_400_000);
      const durationMs = Math.max(4, Math.min(72, Math.round(route.durationHours))) * 3600_000;
      const endsAt = new Date(startsAt.getTime() + durationMs);
      const formattedDplus = route.eleStats.gain.toLocaleString('fr-FR').replace(/\u202f/g, ' ');
      const title = `${spec.titleBase} (${route.distKm} km · +${formattedDplus} m)`;

      const paceGroups = [
        { id: `pg_${i}_1`, label: 'Cordée dynamique', target_pace_label: '4,5–5 km/h · +600 m/h' },
        { id: `pg_${i}_2`, label: 'Allure contemplative', target_pace_label: '3,5 km/h · +400 m/h' },
      ];

      const { rows: evRows } = await pgClient.query(
        `INSERT INTO club_events (
          club_id, organizer_id, title, description, event_date, starts_at, ends_at,
          location, meeting_point, max_participants, participants_count,
          sport, format, visibility, lat, lng, waitlist_enabled, pace_groups,
          route_id, route_revision, surface_type
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'public',$14,$15,true,$16::jsonb,$17,1,$18)
        RETURNING id`,
        [
          club.id,
          organizerId,
          title,
          spec.description,
          startsAt.toISOString(),
          startsAt.toISOString(),
          endsAt.toISOString(),
          spec.location,
          spec.meetingPoint,
          spec.maxParticipants,
          spec.participantsCount,
          spec.sport,
          spec.format,
          route.startLat,
          route.startLng,
          JSON.stringify(paceGroups),
          routeId,
          spec.surfaceType,
        ],
      );
      const eventId = evRows[0].id;
      insertedEventIds.push({ eventId, spec, startsAt, endsAt });

      // Populate club_event_registrations matching participants_count
      const regUsers = new Set();
      if (i % 2 === 0 && DEMO_USER_ID) regUsers.add(DEMO_USER_ID);
      regUsers.add(organizerId);
      for (let k = 0; regUsers.size < spec.participantsCount && k < memberPool.length; k += 1) {
        regUsers.add(memberPool[(i * 11 + k) % memberPool.length]);
      }
      const regArr = Array.from(regUsers);
      for (let rIdx = 0; rIdx < regArr.length; rIdx += 1) {
        const uid = regArr[rIdx];
        const pgId = paceGroups[rIdx % paceGroups.length].id;
        await pgClient.query(
          `INSERT INTO club_event_registrations (event_id, user_id, status, pace_group_id, registered_at, updated_at)
           VALUES ($1, $2, 'registered', $3, now(), now())
           ON CONFLICT DO NOTHING`,
          [eventId, uid, pgId],
        );
      }
    }

    // 5. Recreate 3 realistic volunteer shifts on upcoming outings
    const upcomingEvents = insertedEventIds.filter((e) => e.spec.daysOffset > 0).slice(0, 3);
    const shiftDefs = [
      { title: 'Accueil & pointage cordées', zone: 'Parking départ', cap: 3, instr: 'Vérification matériel sécurité et répartition covoiturage.' },
      { title: 'Serre-file & balisage GPX', zone: 'Arrière du peloton', cap: 2, instr: 'Radio PMR canal 4, fermeture de groupe et lien encadrant.' },
      { title: 'Ravitaillement & point eau', zone: 'Refuge intermédiaire', cap: 2, instr: 'Préparation boissons chaudes et pointage sécurité mi-parcours.' },
    ];
    for (let s = 0; s < upcomingEvents.length; s += 1) {
      const ev = upcomingEvents[s];
      const def = shiftDefs[s];
      await pgClient.query(
        `INSERT INTO club_event_volunteer_shifts (club_id, event_id, title, zone_label, starts_at, ends_at, capacity, instructions, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          club.id,
          ev.eventId,
          def.title,
          def.zone,
          ev.startsAt.toISOString(),
          ev.endsAt.toISOString(),
          def.cap,
          def.instr,
          club.created_by || DEMO_USER_ID,
        ],
      );
    }

    const { rows: verify } = await pgClient.query(
      `SELECT count(*) AS total, count(route_id) AS with_route FROM club_events WHERE club_id = $1`,
      [club.id],
    );
    console.log('✅ REMPLACEMENT TERMINÉ:', verify[0]);
  } finally {
    await pgClient.end();
  }
}

main().catch((err) => {
  console.error('❌ Erreur replace_cordee_real_outings:', err);
  process.exit(1);
});
