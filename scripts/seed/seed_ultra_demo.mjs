#!/usr/bin/env node
/**
 * seed_ultra_demo.mjs
 *
 * Enricht le compte démo LKDV (demo@lkdv.app) pour qu'il soit crédible sur
 * /hub, /explorer et /progression : profil, progression (ledger + projection),
 * badges, territoires, et un voyage hiking complet (itinéraire réel dérivé de
 * la géométrie PostGIS de la route 371, POI, matériel, dépenses, documents,
 * checkpoints, carnet, checklist, équipier).
 *
 * Garanties :
 *  - idempotent  : UUID déterministes + upsert sur clé stable, aucun DELETE global ;
 *  - pas de purge: les 5 voyages existants du compte démo sont conservés ;
 *  - préflight  : chaque table/colonome est vérifié avant la moindre écriture,
 *                  sinon échec explicite (aucune insertion à l'aveugle) ;
 *  - secret     : SUPABASE_SERVICE_ROLE_KEY n'est jamais journalisée ;
 *  - sortie     : un unique résumé de compteurs en fin d'exécution.
 *
 * Usage :
 *   node scripts/seed/seed_ultra_demo.mjs            # écrit (idempotent)
 *   node scripts/seed/seed_ultra_demo.mjs --dry-run  # lectures + préflight only
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const ENV_FILE = resolve(ROOT, '.env.local');

// ─── Identité du compte démo (épinglé) ────────────────────────────────────────
const DEMO_EMAIL = 'demo@lkdv.app';
const DEMO_UID_PINNED = 'd5451f35-db9f-4575-9114-6d3b79550bbc';
const DEMO_PASSWORD = 'DemoPass!2026';
const DEMO_FULL_NAME = 'Léa Fontaine';
const DEMO_AVATAR =
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80&auto=format&fit=crop';

// ─── Territoire du démo (Lille) ───────────────────────────────────────────────
const HOME = {
  city_name: 'Lille',
  city_code: '59350',
  region_code: '32',
  region_name: 'Hauts-de-France',
  department_code: '59',
  country_code: 'FR',
  postal_code: '59000',
  lat: 50.62925,
  lng: 3.05726,
};

// ─── Voyage démo (route 371 = Boucle Fagnes et Val Joly) ──────────────────────
const ROUTE_ID = 371;
const TRIP_SLUG = 'demo-boucle-fagnes-val-joly-4j';
const TRIP_DAYS = 4;
const STEP_COUNT = 12; // 3 segments par journée
const ROUTE_DURATION_H = 22.9;
const ROUTE_D_PLUS_M = 511;
const DOC_PLACEHOLDER_URL =
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

// ─── Progression ─────────────────────────────────────────────────────────────
const ACTIVE_CHALLENGE = { id: 'chal_exp_02', progress: 2 };
const REWARD_BALANCE_TARGET = 2480;
const REWARD_LIFETIME_TARGET = 3120;
const REWARD_ELIGIBLE_TARGET = 2980;
const REWARD_EARNED_TARGET = 1640;

// ─── Équipage enrichi (leaderboards territoriaux) ────────────────────────────
const CREW = [
  { email: 'marie.dupont@email.fr', season: 4200, dLat: 0.011, dLng: -0.014 },
  { email: 'thomas.martin@email.fr', season: 3100, dLat: -0.019, dLng: 0.008 },
  { email: 'sophie.bernard@email.fr', season: 2450, dLat: 0.024, dLng: 0.021 },
  { email: 'lucas.petit@email.fr', season: 1800, dLat: -0.008, dLng: -0.026 },
  { email: 'camille.leroy@email.fr', season: 1250, dLat: 0.031, dLng: -0.006 },
  { email: 'antoine.moreau@email.fr', season: 980, dLat: -0.027, dLng: 0.017 },
  { email: 'julie.simon@email.fr', season: 640, dLat: 0.016, dLng: 0.029 },
  { email: 'maxime.garcia@email.fr', season: 420, dLat: -0.012, dLng: -0.033 },
];

const DRY = process.argv.includes('--dry-run') || process.env.SEED_DRY_RUN === '1';

// UUID déterministes : <8 hex>-0000-4000-8000-<12 digits>
const ID_PREFIX = {
  trip: '0b1f4c0d',
  step: '0b1f4c10',
  poi: '0b1f4c11',
  item: '0b1f4c12',
  expense: '0b1f4c13',
  document: '0b1f4c14',
  checkpoint: '0b1f4c15',
  note: '0b1f4c16',
  checklist: '0b1f4c17',
  member: '0b1f4c18',
  tx: '0b1f4c19',
  badge: '0b1f4c1a',
  collaborator: '0b1f4c1b',
  plan: '0b1f4c1c',
  version: '0b1f4c1d',
  decision: '0b1f4c1e',
  prediction: '0b1f4c1f',
};
const detId = (kind, n) => `${ID_PREFIX[kind]}-0000-4000-8000-${String(n).padStart(12, '0')}`;

const LEVEL_LADDER = [
  [20000, 10, 'Gardien des Horizons'],
  [14000, 9, 'Légende des Sentiers'],
  [9000, 8, "Maître d'Expédition"],
  [5500, 7, 'Guide de Cordée'],
  [3000, 6, 'Pionnier des Crêtes'],
  [1500, 5, 'Navigateur Alpin'],
  [700, 4, 'Éclaireur des Cimes'],
  [300, 3, 'Arpenteur des Bois'],
  [100, 2, 'Marcheur Averti'],
  [0, 1, 'Randonneur Curieux'],
];
const SKILLS = ['explorer', 'preparer', 'partager', 'entraider'];

function fail(message) {
  const err = new Error(message);
  err.expected = true;
  throw err;
}

// ─── Environnement (jamais de valeur secrète journalisée) ────────────────────
function loadEnvFile() {
  let raw;
  try {
    raw = readFileSync(ENV_FILE, 'utf8');
  } catch {
    return [];
  }
  const loaded = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
    loaded.push(key);
  }
  return loaded;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) fail(`Variable d'environnement manquante : ${name} (absente du processus et de .env.local)`);
  return value;
}

// ─── Maths / dates ───────────────────────────────────────────────────────────
const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;

function haversineKm([lng1, lat1], [lng2, lat2]) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Répartit `total` (entier) selon des poids, reste au plus grand résidu. */
function distributeInt(total, weights) {
  const raw = weights.map((w) => total * w);
  const base = raw.map((v) => Math.floor(v));
  let rest = total - base.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; rest > 0; k++, rest--) base[order[k % order.length].i] += 1;
  return base;
}

/** Ventilation déterministe explorer/preparer/partager/entraider (cf. award_progression_gain). */
function allocate(points, weights) {
  const parts = distributeInt(points, weights);
  return SKILLS.map((skill, i) => ({ skill, weight: weights[i], points: parts[i] }));
}

function levelFor(lifetimePoints) {
  const [level, title] = LEVEL_LADDER.find(([min]) => lifetimePoints >= min).slice(1);
  return { level, title };
}

const DAY_MS = 86400000;
const iso = (ms) => new Date(ms).toISOString();
const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);
const dateOnly = (date) => date.toISOString().slice(0, 10);

// ─── Géométrie PostGIS / GeoJSON ─────────────────────────────────────────────
/**
 * Normalise une géométrie PostGIS servie par PostgREST en liste de points [lng, lat].
 * Accepte l'objet GeoJSON nu (`{ type: 'MultiLineString', coordinates: [...] }`),
 * ainsi qu'un Point / LineString / MultiPoint / Polygon / MultiPolygon et un
 * éventuel wrapper Feature / FeatureCollection.
 */
function geomToPoints(geom) {
  let g = geom;
  if (g && typeof g === 'object') {
    if (g.type === 'Feature') g = g.geometry;
    else if (g.type === 'FeatureCollection') {
      g = (g.features || []).map((f) => f && f.geometry).find(Boolean);
    }
  }
  if (!g || typeof g !== 'object' || !Array.isArray(g.coordinates)) return [];
  const isPair = (p) =>
    Array.isArray(p) && p.length >= 2 && Number.isFinite(+p[0]) && Number.isFinite(+p[1]);
  const c = g.coordinates;
  switch (g.type) {
    case 'Point':
      return isPair(c) ? [[+c[0], +c[1]]] : [];
    case 'MultiPoint':
    case 'LineString':
      return c.filter(isPair);
    case 'MultiLineString':
      return c.flat().filter(isPair);
    case 'Polygon':
      return (c[0] || []).filter(isPair);
    case 'MultiPolygon':
      return c.flatMap((poly) => poly[0] || []).filter(isPair);
    case 'GeometryCollection':
      return (g.geometries || []).flatMap(geomToPoints);
    default:
      return c.flat(3).filter(isPair);
  }
}

/** Polyligne + distances cumulées (km) le long du tracé. */
function buildPolyline(points) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + haversineKm(points[i - 1], points[i]));
  }
  return { points, cum, totalKm: cum[cum.length - 1] };
}

/** Sélectionne `count` sommets régulièrement répartis le long du tracé. */
function pickEvenVertices(poly, count) {
  const { points, cum, totalKm } = poly;
  if (!points.length) return [];
  if (totalKm <= 0) return points.slice(0, count).map((p, i) => ({ index: i, point: p, cumKm: 0 }));
  const picked = [];
  let cursor = 0;
  for (let k = 0; k < count; k++) {
    const target = (totalKm * k) / count;
    while (cursor < cum.length - 1 && cum[cursor] < target) cursor += 1;
    const index = Math.min(cursor, points.length - 1);
    picked.push({ index, point: points[index], cumKm: cum[index] });
  }
  return picked;
}

// ─── Client + helpers d'écriture ─────────────────────────────────────────────
let sb = null;
const stats = new Map();
const notes = [];

function note(key, n = 1) {
  stats.set(key, (stats.get(key) || 0) + n);
}
function flag(message) {
  notes.push(message);
}

function createServiceClient() {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** Upsert instrumenté : en dry-run, rien n'est écrit mais le compteur est anticipé. */
async function write(table, rows, { onConflict, label } = {}) {
  const payload = Array.isArray(rows) ? rows : [rows];
  const key = label || table;
  if (!payload.length) {
    note(key, 0);
    return [];
  }
  if (DRY) {
    note(key, payload.length);
    return payload;
  }
  const query = sb.from(table);
  // PostgREST doit renvoyer une colonne reellement presente. Plusieurs tables
  // de progression sont clees par user_id et n'ont aucune colonne id ; on
  // retourne donc la premiere cle de conflit au lieu de supposer `id`.
  const returnColumn = String(onConflict || Object.keys(payload[0])[0]).split(',')[0];
  const { data, error } = onConflict
    ? await query.upsert(payload, { onConflict }).select(returnColumn)
    : await query.upsert(payload).select(returnColumn);
  if (error) fail(`Écriture impossible sur ${table} : ${error.message}`);
  note(key, payload.length);
  return data || payload;
}

async function readOne(table, columns, filter) {
  const cols = Array.isArray(columns) ? columns.join(',') : columns;
  const { data, error } = await sb.from(table).select(cols).match(filter).maybeSingle();
  if (error) fail(`Lecture ${table} impossible : ${error.message}`);
  return data;
}

async function readMany(table, columns, filter) {
  let query = sb.from(table).select(Array.isArray(columns) ? columns.join(',') : columns);
  if (typeof filter === 'function') {
    query = filter(query);
  } else {
    for (const [col, value] of Object.entries(filter || {})) {
      query = query.eq(col, value);
    }
  }
  const { data, error } = await query;
  if (error) fail(`Lecture ${table} impossible : ${error.message}`);
  return data || [];
}

// ─── Préflight schéma ───────────────────────────────────────────────────────
const SCHEMA = {
  user_profiles: ['id', 'email', 'full_name', 'avatar_url', 'bio', 'location', 'website', 'trust_score', 'loyalty_points', 'loyalty_level', 'xp', 'level'],
  user_progression: ['user_id', 'lifetime_points', 'season_points', 'level', 'level_title', 'skill_explorer_points', 'skill_preparer_points', 'skill_partager_points', 'skill_entraider_points', 'city_name', 'department_code', 'region_name', 'country_code', 'postal_code', 'lat_approx', 'lng_approx', 'territory_lock_until', 'current_season_id', 'current_challenge_id', 'challenge_progress', 'updated_at'],
  user_season_progress: ['user_id', 'season_id', 'season_points', 'skill_explorer_points', 'skill_preparer_points', 'skill_partager_points', 'skill_entraider_points', 'updated_at'],
  user_territory: ['user_id', 'country_code', 'city_code', 'region_code', 'city_name', 'source', 'updated_at'],
  user_territory_private: ['user_id', 'lat', 'lng', 'accuracy_m', 'consent_at', 'locked_until', 'updated_at'],
  reward_accounts: ['user_id', 'available_points', 'lifetime_points', 'eligible_points', 'earned_this_period', 'status', 'updated_at'],
  reward_transactions: ['id', 'user_id', 'points', 'transaction_type', 'reference_type', 'metadata', 'idempotency_key', 'effective_at', 'created_at', 'season_id', 'rules_version', 'skill_allocations', 'counts_for_progression', 'affects_balance'],
  progression_outbox: ['reward_transaction_id', 'status', 'processed_at'],
  progression_seasons: ['id', 'starts_at', 'ends_at', 'status'],
  progression_challenges: ['id', 'title', 'skill', 'points_reward', 'target_progress', 'unit'],
  badges: ['id', 'name', 'description', 'icon', 'rarity'],
  user_badges: ['id', 'user_id', 'badge_id', 'earned_at'],
  hiking_routes: ['id', 'name', 'ref', 'network', 'distance_km', 'geom'],
  trail_pois: ['id', 'name', 'category', 'geom'],
  trips: ['id', 'slug', 'title', 'description', 'destination_country_code', 'destination_name', 'start_date', 'end_date', 'status', 'visibility', 'difficulty', 'primary_activity', 'estimated_budget', 'budget_currency', 'cover_image_url', 'user_id', 'metadata', 'updated_at'],
  trip_steps: ['id', 'trip_id', 'day_number', 'order_index', 'title', 'description', 'location_name', 'latitude', 'longitude', 'accommodation_name', 'transport_mode', 'distance_km', 'elevation_gain_m', 'elevation_loss_m', 'start_time', 'source', 'metadata'],
  trip_pois: ['id', 'trip_id', 'step_id', 'name', 'category', 'latitude', 'longitude', 'notes', 'visited', 'osm_id', 'source', 'metadata'],
  trip_items: ['id', 'trip_id', 'item_name', 'category', 'quantity', 'weight_grams', 'is_packed', 'status'],
  trip_expenses: ['id', 'trip_id', 'payer_id', 'title', 'amount', 'currency', 'category', 'expense_date', 'split_type', 'metadata'],
  trip_documents: ['id', 'trip_id', 'user_id', 'title', 'category', 'file_url', 'file_name', 'file_size_bytes', 'mime_type', 'expires_at', 'notes'],
  trip_safety_checkpoints: ['id', 'trip_id', 'label', 'scheduled_at', 'checked_at', 'contact_phone', 'contact_name', 'status', 'notes'],
  trip_notes: ['id', 'trip_id', 'author_id', 'title', 'content', 'day_number', 'is_pinned'],
  trip_checklist_items: ['id', 'trip_id', 'label', 'due_offset_days', 'done', 'done_at', 'position'],
  trip_collaborators: ['id', 'trip_id', 'user_id', 'role'],
  trip_member_profiles: ['trip_id', 'user_id', 'consented_at', 'flat_speed_kmh', 'ascent_speed_m_per_h', 'descent_speed_m_per_h', 'pack_weight_kg', 'max_carry_kg', 'experience_level', 'limitations', 'is_child'],
  adventure_plans: ['id', 'owner_id', 'trip_id', 'title', 'intent', 'status', 'current_version', 'confidence', 'monitoring_rules', 'created_at', 'updated_at'],
  adventure_plan_versions: ['id', 'plan_id', 'version', 'snapshot', 'reason', 'generated_by', 'confidence', 'created_at'],
  adventure_plan_decisions: ['id', 'plan_id', 'decision_type', 'proposal', 'impact', 'requires_confirmation', 'status', 'created_at'],
  route_predictions: ['id', 'user_id', 'plan_id', 'route_id', 'strategy', 'eta_p50', 'eta_p90', 'total_duration_p50_s', 'total_duration_p90_s', 'pace_p25_min_per_km', 'pace_p50_min_per_km', 'pace_p75_min_per_km', 'pauses_s', 'personal_difficulty', 'max_fatigue', 'turnaround_time', 'critical_segment_ids', 'warnings', 'confidence', 'model_version', 'computed_at'],
};

async function preflight() {
  const problems = [];
  for (const [table, columns] of Object.entries(SCHEMA)) {
    const { error } = await sb.from(table).select(columns.join(',')).limit(1);
    if (error) problems.push(`${table} → ${error.message}`);
  }
  if (problems.length) {
    fail(
      'Schéma de base incompatible, aucune écriture effectuée :\n  - ' + problems.join('\n  - '),
    );
  }
  note('tables vérifiées', Object.keys(SCHEMA).length);
}

// ─── Compte auth ─────────────────────────────────────────────────────────────
async function ensureDemoUser() {
  const byId = await sb.auth.admin.getUserById(DEMO_UID_PINNED);
  let user = byId.data?.user || null;
  if (!user) {
    const { data, error } = await sb.auth.admin.listUsers({ perPage: 1000 });
    if (error) fail(`Lecture auth.users impossible : ${error.message}`);
    user = (data?.users || []).find((u) => (u.email || '').toLowerCase() === DEMO_EMAIL) || null;
  }
  if (!user) {
    if (DRY) return { id: DEMO_UID_PINNED, created: false, pinned: true };
    const { data, error } = await sb.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: DEMO_FULL_NAME, avatar_url: DEMO_AVATAR },
    });
    if (error) fail(`Création du compte ${DEMO_EMAIL} impossible : ${error.message}`);
    note('compte auth créé', 1);
    return { id: data.user.id, created: true, pinned: data.user.id === DEMO_UID_PINNED };
  }
  if ((user.email || '').toLowerCase() !== DEMO_EMAIL) {
    fail(
      `Le compte ${DEMO_UID_PINNED} utilise l'adresse ${user.email} et non ${DEMO_EMAIL} : refusing de le modifier.`,
    );
  }
  if (!DRY) {
    const { error } = await sb.auth.admin.updateUserById(user.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: DEMO_FULL_NAME, avatar_url: DEMO_AVATAR },
    });
    if (error) fail(`Mise à jour du compte ${DEMO_EMAIL} impossible : ${error.message}`);
  }
  note('compte auth vérifié', 1);
  return { id: user.id, created: false, pinned: user.id === DEMO_UID_PINNED };
}

async function seedProfile(userId) {
  await write(
    'user_profiles',
    {
      id: userId,
      email: DEMO_EMAIL,
      full_name: DEMO_FULL_NAME,
      avatar_url: DEMO_AVATAR,
      bio: `Compte de démonstration LKDV. ${HOME.city_name} → Ardennes & Hautes Fagnes : itineraires, tests de matériel et carnets partagés.`,
      location: `${HOME.postal_code} ${HOME.city_name}, France`,
      website: 'https://lkdv.app/explorer',
      trust_score: 92,
      loyalty_points: 1850,
      loyalty_level: 'Ambassadeur',
      xp: 9400,
      level: 8,
      updated_at: iso(Date.now()),
    },
    { onConflict: 'id', label: 'profil' },
  );
}

async function seedTerritory(userId) {
  const now = Date.now();
  const lock = iso(now + 180 * DAY_MS);
  await write(
    'user_territory',
    {
      user_id: userId,
      country_code: HOME.country_code,
      city_code: HOME.city_code,
      region_code: HOME.region_code,
      city_name: HOME.city_name,
      source: 'manual',
      updated_at: iso(now),
    },
    { onConflict: 'user_id', label: 'territoire' },
  );
  await write(
    'user_territory_private',
    {
      user_id: userId,
      lat: HOME.lat,
      lng: HOME.lng,
      accuracy_m: 25,
      consent_at: iso(now - 30 * DAY_MS),
      locked_until: lock,
      updated_at: iso(now),
    },
    { onConflict: 'user_id', label: 'territoire privé' },
  );
  return lock;
}

// ─── Ledger de progression ───────────────────────────────────────────────────
/**
 * 15 gains déterministes. Les 3 premiers sont antérieurs à la saison courante
 * (lifetime uniquement), les 12 suivants sont répartis dans la saison active.
 * Total : 9 400 points → niveau 8 « Maître d'Expédition ».
 */
const LEDGER = [
  { points: 1500, w: [0.6, 0.2, 0.1, 0.1], when: { before: 24 }, source: 'hike_session', explanation: 'Retrace GPS de 120 km validés · Avesnois' },
  { points: 1200, w: [0.7, 0.15, 0.1, 0.05], when: { before: 17 }, source: 'hike_session', explanation: 'Session longue validée · Hautes Fagnes' },
  { points: 950, w: [0.65, 0.2, 0.1, 0.05], when: { before: 10 }, source: 'carnet', explanation: 'Carnet d’expédition publié · Val Joly' },
  { points: 800, w: [0.1, 0.6, 0.2, 0.1], when: { at: 0.04 }, source: 'kit', explanation: 'Kit complet optimisé sous 11,4 kg' },
  { points: 700, w: [0.55, 0.2, 0.15, 0.1], when: { at: 0.12 }, source: 'trip', explanation: '3 waypoints validés en altitude' },
  { points: 650, w: [0.2, 0.15, 0.55, 0.1], when: { at: 0.2 }, source: 'carnet', explanation: 'Guide terrain partagé sur la boucle' },
  { points: 600, w: [0.2, 0.15, 0.15, 0.5], when: { at: 0.28 }, source: 'community', explanation: 'Accueil de 4 nouveaux membres' },
  { points: 550, w: [0.6, 0.25, 0.1, 0.05], when: { at: 0.36 }, source: 'trip', explanation: 'Boucle Fagnes et Val Joly tracée et validée' },
  { points: 500, w: [0.25, 0.6, 0.1, 0.05], when: { at: 0.44 }, source: 'kit', explanation: 'Checklist sécurité J-7 complétée' },
  { points: 450, w: [0.2, 0.15, 0.55, 0.1], when: { at: 0.52 }, source: 'carnet', explanation: 'Galerie « Photographe Aventurier » publiée' },
  { points: 400, w: [0.2, 0.15, 0.15, 0.5], when: { at: 0.6 }, source: 'community', explanation: 'Prêt de matériel à un membre du club' },
  { points: 350, w: [0.6, 0.25, 0.1, 0.05], when: { at: 0.68 }, source: 'trip', explanation: 'Waypoint du lac de Robertville validé' },
  { points: 300, w: [0.3, 0.55, 0.1, 0.05], when: { at: 0.76 }, source: 'kit', explanation: 'Audit bivouac & sécurité' },
  { points: 250, w: [0.2, 0.15, 0.6, 0.05], when: { at: 0.86 }, source: 'carnet', explanation: 'Témoignage de refuge partagé' },
  { points: 200, w: [0.2, 0.15, 0.15, 0.5], when: { at: 0.95 }, source: 'community', explanation: 'Accueil d’un premier marcheur en montagne' },
];

function scheduleLedger(season) {
  const start = Date.parse(season.starts_at);
  const end = Math.min(Date.now(), Date.parse(season.ends_at));
  const span = Math.max(end - start, DAY_MS);
  return LEDGER.map((entry) => {
    const at = entry.when.before
      ? start - entry.when.before * DAY_MS
      : start + entry.when.at * span;
    return { ...entry, at: Math.min(at, Date.now() - 60000) };
  });
}

async function seedProgression(userId, season) {
  const scheduled = scheduleLedger(season);
  const transactions = scheduled.map((entry, i) => ({
    id: detId('tx', i + 1),
    user_id: userId,
    points: entry.points,
    transaction_type: 'PROGRESSION_AWARD',
    reference_type: entry.source,
    metadata: {
      action_type: 'gain',
      explanation: entry.explanation,
      source_type: entry.source,
      seeded_by: 'seed_ultra_demo',
    },
    idempotency_key: `seed:ultra-demo:${String(i + 1).padStart(2, '0')}`,
    effective_at: iso(entry.at),
    created_at: iso(entry.at),
    // Les entrées antérieures à la saison ne lui sont pas rattachées : sinon
    // la projection les compterait dans les points de saison.
    season_id: entry.when.before ? null : season.id,
    rules_version: 'v1',
    skill_allocations: allocate(entry.points, entry.w),
    counts_for_progression: true,
    affects_balance: false,
  }));
  await write('reward_transactions', transactions, { onConflict: 'id', label: 'ledger' });

  // Le trigger AFTER INSERT a mis ces lignes dans progression_outbox : on les
  // neutralise, sinon le cron rejouerait les gains une seconde fois.
  const ids = transactions.map((t) => t.id);
  if (!DRY) {
    const { error } = await sb
      .from('progression_outbox')
      .update({ status: 'processed', processed_at: iso(Date.now()), last_error: null })
      .in('reward_transaction_id', ids)
      .eq('status', 'pending');
    if (error) fail(`Neutralisation progression_outbox impossible : ${error.message}`);
  }
  note('outbox neutralisée', ids.length);

  // Projection : somme de tout le ledger marquant la progression (pas seulement
  // les lignes de ce seed), donc cohérente avec l'historique déjà présent.
  const dbRows = await readMany(
    'reward_transactions',
    ['id', 'points', 'season_id', 'skill_allocations', 'counts_for_progression'],
    (q) => q.eq('user_id', userId).eq('counts_for_progression', true),
  );
  // En dry-run rien n'est persisté : on complète la projection avec le ledger
  // en mémoire (hors lignes déjà présentes) pour refléter ce que produirait
  // l'écriture, sans jamais doubler un déjà-seedé.
  const seedIdSet = new Set(ids);
  const rows = DRY
    ? [...dbRows.filter((r) => !seedIdSet.has(r.id)), ...transactions]
    : dbRows;
  const projection = { lifetime: 0, season: 0, skills: { explorer: 0, preparer: 0, partager: 0, entraider: 0 } };
  const seasonSkills = { explorer: 0, preparer: 0, partager: 0, entraider: 0 };
  for (const row of rows) {
    projection.lifetime += row.points || 0;
    const inSeason = row.season_id === season.id;
    if (inSeason) projection.season += row.points || 0;
    for (const alloc of row.skill_allocations || []) {
      if (!(alloc.skill in projection.skills)) continue;
      projection.skills[alloc.skill] += alloc.points || 0;
      if (inSeason) seasonSkills[alloc.skill] += alloc.points || 0;
    }
  }
  const { level, title } = levelFor(projection.lifetime);
  const territoryLock = await seedTerritory(userId);
  await write(
    'user_progression',
    {
      user_id: userId,
      lifetime_points: projection.lifetime,
      season_points: projection.season,
      level,
      level_title: title,
      skill_explorer_points: projection.skills.explorer,
      skill_preparer_points: projection.skills.preparer,
      skill_partager_points: projection.skills.partager,
      skill_entraider_points: projection.skills.entraider,
      city_name: HOME.city_name,
      department_code: HOME.department_code,
      region_name: HOME.region_name,
      country_code: HOME.country_code,
      postal_code: HOME.postal_code,
      lat_approx: HOME.lat,
      lng_approx: HOME.lng,
      territory_lock_until: territoryLock,
      current_season_id: season.id,
      current_challenge_id: ACTIVE_CHALLENGE.id,
      challenge_progress: ACTIVE_CHALLENGE.progress,
      updated_at: iso(Date.now()),
    },
    { onConflict: 'user_id', label: 'progression' },
  );
  await write(
    'user_season_progress',
    {
      user_id: userId,
      season_id: season.id,
      season_points: projection.season,
      skill_explorer_points: seasonSkills.explorer,
      skill_preparer_points: seasonSkills.preparer,
      skill_partager_points: seasonSkills.partager,
      skill_entraider_points: seasonSkills.entraider,
      updated_at: iso(Date.now()),
    },
    { onConflict: 'user_id,season_id', label: 'progression saison' },
  );
  return { ...projection, level, title };
}

async function seedRewardAccount(userId) {
  const current = await readOne('reward_accounts', ['available_points', 'lifetime_points', 'eligible_points', 'earned_this_period'], { user_id: userId });
  const max = (a, b) => Math.max(Number(a || 0), b);
  await write(
    'reward_accounts',
    {
      user_id: userId,
      available_points: max(current?.available_points, REWARD_BALANCE_TARGET),
      lifetime_points: max(current?.lifetime_points, REWARD_LIFETIME_TARGET),
      eligible_points: max(current?.eligible_points, REWARD_ELIGIBLE_TARGET),
      earned_this_period: max(current?.earned_this_period, REWARD_EARNED_TARGET),
      status: 'active',
      updated_at: iso(Date.now()),
    },
    { onConflict: 'user_id', label: 'compte récompenses' },
  );
}

// ─── Badges ──────────────────────────────────────────────────────────────────
const WANTED_BADGES = [
  'Explorateur', 'Pionnier', 'Nomade Numérique', 'Photographe Aventurier',
  'Ultra-léger', 'Mentor', 'Ambassadeur', 'Éco-Voyageur', 'Kit Master', 'Solidaire',
];

async function seedBadges(userId) {
  const catalog = await readMany('badges', ['id', 'name', 'icon', 'rarity'], (q) => q.order('name'));
  const byName = new Map();
  for (const badge of catalog) {
    if (!byName.has(badge.name)) byName.set(badge.name, badge);
  }
  const missing = WANTED_BADGES.filter((name) => !byName.has(name));
  if (missing.length) {
    const created = missing.map((name, i) => ({
      id: detId('badge', i + 1),
      name,
      description: `Badge démo « ${name} » ajouté par seed_ultra_demo.`,
      icon: '🏅',
      rarity: 'Commun',
    }));
    await write('badges', created, { onConflict: 'id', label: 'badges catalogue' });
    created.forEach((badge) => byName.set(badge.name, badge));
  }
  const now = Date.now();
  const rows = WANTED_BADGES.map((name, i) => ({
    id: detId('badge', 100 + i),
    user_id: userId,
    badge_id: byName.get(name).id,
    earned_at: iso(now - (WANTED_BADGES.length - i) * 9 * DAY_MS),
  }));
  await write('user_badges', rows, { onConflict: 'user_id,badge_id', label: 'badges utilisateur' });
  return rows.length;
}

// ─── Voyage démo : itinéraire réel dérivé de la géométrie de la route ─────────
const DAY_PLANS = [
  { code: 'J1', title: 'Départ de la boucle et première montée', labels: ['Départ & montée initiale', 'Plateau de la Croix Fraine', 'Bord des tourbières'], terrain: ['piste forestière', 'sentier balisé', 'chaussée pavée'] },
  { code: 'J2', title: 'Plateau des Hautes Fagnes', labels: ['Sources du plateau', 'Sentier des fagnes', 'Descente boisée vers le Val Joly'], terrain: ['sentier humide', 'traversée de tourbières', 'descente en forêt'] },
  { code: 'J3', title: 'Lacs et sapinières du Val Joly', labels: ['Lac & tourbières du Val Joly', 'Sapinières du Val Joly', 'Remontée vers la boucle'], terrain: ['tourbière', 'sapinière', 'remontée en lacets'] },
  { code: 'J4', title: 'Tourbières de Faumont et fermeture', labels: ['Tourbières de Faumont', 'Route de Faumont', 'Retour & fermeture de la boucle'], terrain: ['sentier de crête', 'chaussée pavée', 'plat final'] },
];
const D_PLUS_W = [0.1, 0.12, 0.09, 0.11, 0.08, 0.1, 0.12, 0.09, 0.06, 0.05, 0.04, 0.04];
const D_MINUS_W = [0.06, 0.07, 0.1, 0.06, 0.12, 0.08, 0.05, 0.1, 0.12, 0.08, 0.08, 0.08];
const STEP_NOTES = [
  'Départ matinal pour garder la lumière rasante sur le premier faux-plat.',
  'Section très reposante, idéale pour rattraper le retard du matin.',
  'Pause café face à la tourbière, prévoir une source d’eau filtrée.',
  'Terrain légèrement spongieux : guêtres recommandées.',
  'Point de vue le plus dégagé de la première moitié de la boucle.',
  'Descente rapide mais glissante si la pluie tombe.',
  'Journée la plus longue, à garder un cœur léger.',
  'Sapinières denses : le signal est absorbé, on déconnecte.',
  'Sections plus ouvertes, avec du vent seul.',
  'Fin de journée calme, on arrive avant la fermeture des gîtes.',
  'Itinéraire pavé, la dernière montée est optionnelle.',
  'Retour au point de départ : boucle de 91 km bouclée.',
];

function startTimes() {
  return ['07:30:00', '08:00:00', '08:30:00', '07:45:00', '08:15:00', '08:45:00', '08:00:00', '08:30:00', '09:00:00', '08:15:00', '08:45:00', '09:15:00'];
}

async function loadRoute() {
  const { data, error } = await sb
    .from('hiking_routes')
    .select('id, name, ref, network, distance_km, geom')
    .eq('id', ROUTE_ID)
    .maybeSingle();
  if (error) fail(`Lecture hiking_routes impossible : ${error.message}`);
  if (!data) fail(`La route ${ROUTE_ID} est absente de hiking_routes : nothing to anchor the itinerary on.`);
  const points = geomToPoints(data.geom);
  if (points.length < STEP_COUNT) {
    fail(`Géométrie de la route ${ROUTE_ID} inexploitable (${points.length} points) : le tracé ne peut pas être dérivé.`);
  }
  const poly = buildPolyline(points);
  const picked = pickEvenVertices(poly, STEP_COUNT);
  const deviation = ((poly.totalKm - Number(data.distance_km || poly.totalKm)) / Number(data.distance_km || poly.totalKm)) * 100;
  if (Math.abs(deviation) > 5) {
    flag(`distance polyligne ${poly.totalKm.toFixed(2)} km vs official ${data.distance_km} km (${deviation.toFixed(1)} % d'écart)`);
  }
  return { route: data, poly, picked, deviation };
}

/** Segments le long du tracé (pas de corde) remis à l'échelle de distance_km. */
function stepDistances(poly, picked, routeKm) {
  const raw = [];
  for (let i = 1; i < picked.length; i++) {
    raw.push(poly.cum[picked[i].index] - poly.cum[picked[i - 1].index]);
  }
  // Segment de fermeture : du dernier point retenu jusqu'au point de départ
  // (la route est une boucle, poly.cum[picked[0].index] === 0).
  raw.push(poly.totalKm - poly.cum[picked[picked.length - 1].index]);
  const total = raw.reduce((a, b) => a + b, 0) || 1;
  return raw.map((d) => Number(((d * routeKm) / total).toFixed(2)));
}

async function loadRoutePois() {
  const { data, error } = await sb.rpc('get_route_pois', { p_route_id: ROUTE_ID, p_radius_m: 1500 });
  if (error || !data || !data.length) {
    if (error) flag(`get_route_pois indisponible (${error?.message || 'aucun POI'}) : POI de démonstration sur la géométrie`);
    return [];
  }
  const details = await readMany('trail_pois', ['id', 'name', 'category', 'geom'], (q) => q.in('id', data.map((p) => p.id)));
  const byId = new Map(details.map((d) => [d.id, d]));
  return data
    .map((poi) => {
      const detail = byId.get(poi.id);
      const coords = geomToPoints(detail?.geom)[0];
      if (!coords || !detail?.name) return null;
      return { name: detail.name, category: detail.category, lngLat: coords, osmId: String(detail.id) };
    })
    .filter(Boolean);
}

const POI_CATEGORY_LABELS = {
  refuge: 'refuge', camping: 'camping', water: 'source', peak: 'sommet',
  viewpoint: 'point de vue', waterfall: 'cascade', monument: 'monument',
};

function buildPois(pois, picked, distanceKm) {
  const rows = [];
  const push = (poi, index) => {
    const stepIndex = Math.min(picked.length - 1, index);
    rows.push({
      id: detId('poi', rows.length + 1),
      name: poi.name,
      category: POI_CATEGORY_LABELS[poi.category] || 'point d’intérêt',
      latitude: Number(poi.lngLat[1].toFixed(6)),
      longitude: Number(poi.lngLat[0].toFixed(6)),
      notes: poi.notes,
      visited: false,
      osm_id: poi.osmId || null,
      source: poi.source,
      step_id: detId('step', stepIndex + 1),
      metadata: { route_id: ROUTE_ID, distance_km_at_poi: Number(distanceKm[stepIndex] || 0).toFixed(2) },
    });
  };
  for (const poi of pois) {
    let nearest = 0;
    let best = Infinity;
    picked.forEach((p, i) => {
      const d = haversineKm(p.point, poi.lngLat);
      if (d < best) { best = d; nearest = i; }
    });
    push({ ...poi, notes: `Repère sur le tracé · ${Math.round(haversineKm(picked[nearest].point, poi.lngLat) * 1000)} m du sentier`, source: 'osm' }, nearest);
  }
  // Points de vue complémentaires : coordonnées réelles sur la géométrie.
  const fractions = [0.12, 0.3, 0.47, 0.63, 0.8, 0.92];
  fractions.forEach((f, k) => {
    const idx = Math.min(picked.length - 1, Math.round(f * (picked.length - 1)));
    push({
      name: `Point de vue J${Math.floor(idx / 3) + 1}.${(idx % 3) + 1}`,
      category: 'viewpoint',
      lngLat: picked[idx].point,
      notes: 'Belvédère Balcon des Fagnes : Stopalkzlf panorama sur les tourbières.',
      source: 'demo',
    }, idx);
  });
  return rows;
}

async function seedTrip(userId) {
  const { route, poly, picked, deviation } = await loadRoute();
  const routeKm = Number(route.distance_km || poly.totalKm);
  const distances = stepDistances(poly, picked, routeKm);
  const dPlus = distributeInt(ROUTE_D_PLUS_M, D_PLUS_W);
  const dMinus = distributeInt(ROUTE_D_PLUS_M, D_MINUS_W);
  const times = startTimes();
  const tripId = detId('trip', 1);

  // Garde-fou : un seul voyage par (user_id, metadata.route_id) — index unique
  // uniq_trips_user_route_active sur la base.
  const clash = await readMany('trips', ['id', 'slug'], (q) =>
    q.eq('user_id', userId).contains('metadata', { route_id: ROUTE_ID }),
  );
  if (clash.some((t) => t.id !== tripId)) {
    fail(`Un autre voyage du compte démo porte déjà route_id=${ROUTE_ID} (${clash.map((t) => t.slug).join(', ')}) : la contrainte uniq_trips_user_route_active bloquerait l'écriture.`);
  }
  const slugClash = await readMany('trips', ['id'], { slug: TRIP_SLUG });
  if (slugClash.some((t) => t.id !== tripId)) fail(`Le slug ${TRIP_SLUG} est déjà utilisé par un autre voyage.`);

  const start = addDays(new Date(), 7);
  const end = addDays(start, TRIP_DAYS - 1);
  const expenses = buildExpenses(userId, start);
  await write(
    'trips',
    {
      id: tripId,
      slug: TRIP_SLUG,
      title: 'Boucle Fagnes et Val Joly',
      description: `Boucle de ${routeKm.toFixed(1)} km et ${ROUTE_DURATION_H} h de marche autour du plateau des Hautes Fagnes, partagée entre tourbières, sources et sapinières du Val Joly. Itinéraire dérivé du tracé officiel ${route.ref || 'AV-F'} (${routeKm.toFixed(2)} km, D+ ${ROUTE_D_PLUS_M} m) et découpé en ${TRIP_DAYS} journées.`,
      destination_country_code: 'BE',
      destination_name: 'Hautes Fagnes & Val Joly (Ardennes, Belgique)',
      start_date: dateOnly(start),
      end_date: dateOnly(end),
      status: 'planned',
      visibility: 'unlisted',
      difficulty: 'moderate',
      primary_activity: 'hiking',
      estimated_budget: Number(expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)),
      budget_currency: 'EUR',
      cover_image_url: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1200&q=80&auto=format&fit=crop',
      user_id: userId,
      metadata: {
        route_id: ROUTE_ID,
        route_name: route.name,
        route_ref: route.ref,
        distance_km: routeKm,
        duration_h: ROUTE_DURATION_H,
        elevation_gain_m: ROUTE_D_PLUS_M,
        geometry_source: 'hiking_routes.geom',
        geometry_deviation_pct: Number(deviation.toFixed(2)),
        steps_count: STEP_COUNT,
        seeded_by: 'seed_ultra_demo',
      },
      updated_at: iso(Date.now()),
    },
    { onConflict: 'id', label: 'voyage' },
  );

  let cum = 0;
  const steps = picked.map((p, i) => {
    cum = Number((cum + distances[i]).toFixed(2));
    const day = Math.floor(i / (STEP_COUNT / TRIP_DAYS));
    const plan = DAY_PLANS[day];
    const isLastOfDay = i % (STEP_COUNT / TRIP_DAYS) === STEP_COUNT / TRIP_DAYS - 1;
    return {
      id: detId('step', i + 1),
      trip_id: tripId,
      day_number: day + 1,
      order_index: i,
      title: `${plan.code} · ${plan.labels[i % plan.labels.length]}`,
      description: `${distances[i].toFixed(1)} km · D+ ${dPlus[i]} m / D- ${dMinus[i]} m · ${plan.terrain[i % plan.terrain.length]}. ${STEP_NOTES[i]}`,
      location_name: nearestPoiName(p, poisCache) || null,
      latitude: Number(p.point[1].toFixed(6)),
      longitude: Number(p.point[0].toFixed(6)),
      accommodation_name: isLastOfDay && day < TRIP_DAYS - 1 ? ['Gîte des Fagnes', 'Refuge de Faumont', 'Auberge du Val Joly'][day % 3] : null,
      transport_mode: 'foot',
      distance_km: distances[i],
      elevation_gain_m: dPlus[i],
      elevation_loss_m: dMinus[i],
      start_time: times[i],
      source: 'hiking_routes.geom',
      metadata: { route_id: ROUTE_ID, progress_pct: Number(((p.cumKm / poly.totalKm) * 100).toFixed(1)), cum_km: Number(p.cumKm.toFixed(2)) },
    };
  });
  await write('trip_steps', steps, { onConflict: 'id', label: 'étapes' });
  return { tripId, routeKm, start, end, steps, distances, dPlus, dMinus, picked, route };
}

let poisCache = [];
function nearestPoiName(picked, pois) {
  let best = null;
  let bestDist = 1.5;
  for (const poi of pois) {
    const d = haversineKm(picked.point, poi.lngLat);
    if (d < bestDist) { bestDist = d; best = poi.name; }
  }
  return best;
}

function buildExpenses(userId, start) {
  const raw = [
    { title: 'Train Lille → Liège (aller-retour)', amount: 78.4, category: 'transport', offset: -21 },
    { title: 'Gîtes 3 nuits · Plateau des Fagnes', amount: 186.0, category: 'hebergement', offset: -18 },
    { title: 'Courses pour 4 jours', amount: 112.65, category: 'nourriture', offset: -4 },
    { title: 'Carburant gare ↔ gîtes', amount: 58.2, category: 'transport', offset: -3 },
    { title: 'Assurance annulation montagne', amount: 42.0, category: 'assurance', offset: -12 },
    { title: 'Carte de réduction weekends', amount: 34.9, category: 'activite', offset: -9 },
  ];
  return raw.map((e, i) => ({
    id: detId('expense', i + 1),
    trip_id: detId('trip', 1),
    payer_id: userId,
    title: e.title,
    amount: e.amount,
    currency: 'EUR',
    category: e.category,
    expense_date: dateOnly(addDays(start, e.offset)),
    split_type: 'equal',
    metadata: { seeded_by: 'seed_ultra_demo' },
  }));
}

function buildItems() {
  const raw = [
    { name: 'Sac à dos trekking 45 L', category: 'sac', g: 1450, packed: true, status: 'packed' },
    { name: 'Tente 2 places géodésique', category: 'couchage', g: 2100, packed: true, status: 'packed' },
    { name: 'Sac de couchage −5 °C', category: 'couchage', g: 1150, packed: true, status: 'packed' },
    { name: 'Matelas autogonflable', category: 'couchage', g: 480, packed: true, status: 'packed' },
    { name: 'Bâtons de marche aluminium', category: 'marche', g: 590, packed: true, status: 'packed' },
    { name: 'Chaussures de rando GTX', category: 'chaussures', g: 980, packed: true, status: 'packed' },
    { name: 'Batterie externe 20 000 mAh', category: 'electronique', g: 355, packed: true, status: 'packed' },
    { name: 'Frontale + pile de rechange', category: 'electronique', g: 210, packed: true, status: 'packed' },
    { name: 'Carte IGN TOP75 + boussole', category: 'navigation', g: 180, packed: true, status: 'packed' },
    { name: "Gourde 1,5 L + filtration", category: 'eau', g: 165, packed: true, status: 'packed' },
    { name: 'Couteau multifonction', category: 'cuisine', g: 95, packed: true, status: 'packed' },
    { name: 'Réchaud + combustible', category: 'cuisine', g: 410, packed: false, status: 'needed' },
    { name: 'Trousse de secours', category: 'securite', g: 320, packed: false, status: 'needed' },
    { name: 'Crème solaire SPF50', category: 'hygiene', g: 200, packed: false, status: 'needed' },
    { name: 'Gants et bonnet', category: 'vetement', g: 130, packed: false, status: 'optional' },
  ];
  return raw.map((it, i) => ({
    id: detId('item', i + 1),
    trip_id: detId('trip', 1),
    item_name: it.name,
    category: it.category,
    quantity: 1,
    weight_grams: it.g,
    is_packed: it.packed,
    status: it.status,
  }));
}

function buildDocuments(userId, start) {
  const raw = [
    { title: 'Assurance montagne — attestation', category: 'insurance', name: 'assurance-montagne.pdf', expires: 180, notes: 'Contrat annuel, couverture annulation et rapatriement.' },
    { title: 'Réservation gîtes — Hautes Fagnes', category: 'booking', name: 'reservation-gites.pdf', expires: null, notes: '3 nuits, clef digitale à J-1.' },
    { title: 'Billet de train Lille–Liège', category: 'ticket', name: 'billet-train.pdf', expires: null, notes: 'Aller le jour 1, retour le jour 4.' },
  ];
  return raw.map((d, i) => ({
    id: detId('document', i + 1),
    trip_id: detId('trip', 1),
    user_id: userId,
    title: d.title,
    category: d.category,
    file_url: DOC_PLACEHOLDER_URL,
    file_name: d.name,
    file_size_bytes: 132144,
    mime_type: 'application/pdf',
    expires_at: d.expires ? dateOnly(addDays(start, d.expires)) : null,
    notes: `${d.notes} (fichier de démonstration seedé).`,
  }));
}

function buildCheckpoints(start) {
  const raw = [
    { label: 'Checklist météo & orages', at: -1, time: '18:00:00', status: 'pending', notes: 'Annuler si orages > 40 kJ/kg forecast sur le plateau.' },
    { label: 'Départ — message de position à la session', at: 0, time: '07:15:00', status: 'pending', notes: 'SMS à Claire + partage du GPX.' },
    { label: 'Confirmation gîte · Route de Faumont', at: 1, time: '19:30:00', status: 'checked', notes: 'Gîte OK, dîne served à 20 h.' },
    { label: 'Alerte météo · fagnes verglaçantes', at: 2, time: '18:45:00', status: 'pending', notes: 'Gants et frontale obligatoires au lever.' },
  ];
  return raw.map((c, i) => {
    const at = new Date(addDays(start, c.at));
    at.setUTCHours(+c.time.slice(0, 2), +c.time.slice(3, 5), 0, 0);
    return {
      id: detId('checkpoint', i + 1),
      trip_id: detId('trip', 1),
      label: c.label,
      scheduled_at: at.toISOString(),
      checked_at: c.status === 'checked' ? iso(at.getTime() + 12 * 60000) : null,
      contact_phone: '+33 6 12 34 56 78',
      contact_name: 'Claire Fontaine',
      status: c.status,
      notes: c.notes,
    };
  });
}

function buildNotes(userId, start) {
  const raw = [
    { title: 'Carnet J1 — la montée des Fagnes', day: 1, pinned: true, content: "Départ 7 h 30, lumière rasante sur la première montée. Le balisage est net jusqu'à la Croix Fraine. On croise deux troupeaux de vache, la source du Coureux est un bon point d'eau." },
    { title: 'Carnet J2 — les tourbières', day: 2, pinned: false, content: 'Plateau des Hautes Fagnes ce matin : brume basse, tourbières saturées, on garde les guêtres. Pause longue à la source du Menu Bois, puis reprise vers le Val Joly.' },
    { title: 'Carnet J3 — Val Joly', day: 3, pinned: false, content: 'Sapinières sombres mais trail très agréable, on refait le plein au camping de Madame Basile. D+ cumulé 260 m, le vent est constant sur les crêtes.' },
    { title: 'Bilan — boucle bouclée', day: 4, pinned: false, content: '91 km bouclés en 4 jours, 511 m de D+, kit de 11,4 kg. Les 3 derniers kilomètres sont pavés, on arrive à temps pour le train. À refaire au printemps en version rapide.' },
  ];
  return raw.map((n, i) => ({
    id: detId('note', i + 1),
    trip_id: detId('trip', 1),
    author_id: userId,
    title: n.title,
    content: n.content,
    day_number: n.day,
    is_pinned: n.pinned,
  }));
}

function buildChecklist() {
  const now = Date.now();
  const raw = [
    { label: 'Réserver les gîtes', due: 30, done: true },
    { label: 'Choisir la variante du tracé', due: 30, done: true },
    { label: 'Vérifier la météo à 7 jours', due: 7, done: true },
    { label: 'Pondérer le kit (poids < 12 kg)', due: 7, done: true },
    { label: 'Télécharger la carte IGN + le GPX', due: 7, done: false },
    { label: 'Prévenir un contact du départ', due: 1, done: true },
    { label: 'Ranger le kit la veille', due: 1, done: false },
    { label: 'Vérifier les piles de la frontale', due: 1, done: false },
  ];
  return raw.map((c, i) => ({
    id: detId('checklist', i + 1),
    trip_id: detId('trip', 1),
    label: c.label,
    due_offset_days: c.due,
    done: c.done,
    done_at: c.done ? iso(now - (raw.length - i) * 2 * DAY_MS) : null,
    position: i,
  }));
}

// ─── Cockpit Aventure (plan, versioning, décisions, prédictions) ──────────────
const ADVENTURE_DECISIONS = [
  {
    type: 'safety_change',
    proposal: 'Avancer le départ J2 vers le Lac du Val Joly (pluie annoncée sur le plateau)',
    impact: ['départ J2 décalé à 06 h 30', 'étape J2 raccourcie de 2,4 km'],
  },
  {
    type: 'group_change',
    proposal: 'Valider la version réduite de l’étape J3 avec Marie (genoux sensibles)',
    impact: ['étape J3 : 8,1 km au lieu de 11,6 km', 'pause déjeuner allongée de 30 min'],
  },
  {
    type: 'location_share',
    proposal: 'Partager la position live avec l’équipier pendant les 24 prochaines heures',
    impact: ['visible uniquement par l’équipier du voyage'],
  },
];

const ADVENTURE_CONFIDENCE = {
  score: 0.84,
  level: 'high',
  sampleCount: 24,
  method: 'historique_demo_v1',
  reasons: ['24 sorties comparables', 'profil terrain cohérent'],
};

function buildAdventurePlan(userId, trip) {
  return {
    id: detId('plan', 1),
    owner_id: userId,
    trip_id: trip.tripId,
    title: 'Boucle Fagnes & Val Joly — 4 jours',
    intent: {
      nature: 'sortie',
      activity: 'hiking',
      start_date: dateOnly(trip.start),
      party_size: 2,
      route_id: ROUTE_ID,
    },
    status: 'active',
    current_version: 1,
    confidence: ADVENTURE_CONFIDENCE,
    monitoring_rules: [
      { type: 'weather', window_h: 12 },
      { type: 'fatigue', threshold: 80 },
    ],
    created_at: iso(trip.start.getTime() - 21 * DAY_MS),
    updated_at: iso(Date.now() - 2 * 3600000),
  };
}

function buildAdventureVersion(plan) {
  return {
    id: detId('version', 1),
    plan_id: plan.id,
    version: 1,
    snapshot: { title: plan.title, nature: 'sortie', route_id: ROUTE_ID, steps: STEP_COUNT },
    reason: 'Plan initial dérivé de l’itinéraire route 371',
    generated_by: 'seed_ultra_demo',
    confidence: ADVENTURE_CONFIDENCE,
    created_at: plan.created_at,
  };
}

function buildAdventureDecisions(plan) {
  return ADVENTURE_DECISIONS.map((decision, index) => ({
    id: detId('decision', index + 1),
    plan_id: plan.id,
    decision_type: decision.type,
    proposal: decision.proposal,
    impact: decision.impact,
    requires_confirmation: true,
    status: 'proposed',
    created_at: iso(Date.now() - (ADVENTURE_DECISIONS.length - index) * 3600000),
  }));
}

/** Prédiction de route « recommandée » dérivée de l'allure du profil démo. */
function buildRoutePrediction(userId, trip) {
  const pace25 = 11.4;
  const pace50 = 12.8;
  const pace75 = 14.6;
  const p50s = Math.round(trip.routeKm * pace50 * 60);
  const p90s = Math.round(trip.routeKm * pace75 * 60);
  const startMs = trip.start.getTime();
  return {
    id: detId('prediction', 1),
    user_id: userId,
    plan_id: detId('plan', 1),
    route_id: ROUTE_ID,
    strategy: 'recommended',
    eta_p50: iso(startMs + p50s * 1000),
    eta_p90: iso(startMs + p90s * 1000),
    total_duration_p50_s: p50s,
    total_duration_p90_s: p90s,
    pace_p25_min_per_km: pace25,
    pace_p50_min_per_km: pace50,
    pace_p75_min_per_km: pace75,
    pauses_s: 3600,
    personal_difficulty: 62,
    max_fatigue: 58,
    turnaround_time: iso(startMs + 11.5 * 3600000),
    critical_segment_ids: [],
    warnings: [],
    confidence: {
      score: 0.78,
      level: 'medium',
      sampleCount: 18,
      method: 'pace_resolver_demo_v1',
      reasons: ['profil démo cohérent'],
    },
    model_version: 'seed-demo-v1',
    computed_at: iso(Date.now() - 3 * 3600000),
  };
}

/** Cockpit réel : plan actif + version + décisions proposées + prédiction persistée. */
async function seedAdventure(userId, trip) {
  const plan = buildAdventurePlan(userId, trip);
  await write('adventure_plans', [plan], { onConflict: 'id', label: 'aventure plan' });
  await write('adventure_plan_versions', [buildAdventureVersion(plan)], {
    onConflict: 'id',
    label: 'aventure version',
  });
  const decisions = buildAdventureDecisions(plan);
  await write('adventure_plan_decisions', decisions, {
    onConflict: 'id',
    label: 'aventure décisions',
  });
  await write('route_predictions', [buildRoutePrediction(userId, trip)], {
    onConflict: 'id',
    label: 'prédiction route',
  });
  return { plan, decisions: decisions.length };
}

// ─── Équipage enrichi (classements territoriaux) ─────────────────────────────
async function seedCrew(season) {
  const { data, error } = await sb.auth.admin.listUsers({ perPage: 1000 });
  if (error) fail(`Lecture auth.users impossible : ${error.message}`);
  const byEmail = new Map((data?.users || []).map((u) => [(u.email || '').toLowerCase(), u]));
  const now = Date.now();
  const profiles = [];
  const seasonProgress = [];
  const territories = [];
  const privates = [];
  for (const member of CREW) {
    const user = byEmail.get(member.email);
    if (!user) continue;
    const lifetime = Math.round(member.season * 1.35);
    const { level, title } = levelFor(lifetime);
    const skills = allocate(lifetime, [0.45, 0.25, 0.18, 0.12]);
    profiles.push({
      user_id: user.id,
      lifetime_points: lifetime,
      season_points: member.season,
      level,
      level_title: title,
      skill_explorer_points: skills[0].points,
      skill_preparer_points: skills[1].points,
      skill_partager_points: skills[2].points,
      skill_entraider_points: skills[3].points,
      city_name: HOME.city_name,
      department_code: HOME.department_code,
      region_name: HOME.region_name,
      country_code: HOME.country_code,
      postal_code: HOME.postal_code,
      lat_approx: HOME.lat + member.dLat,
      lng_approx: HOME.lng + member.dLng,
      territory_lock_until: iso(now + 90 * DAY_MS),
      current_season_id: season.id,
      updated_at: iso(now),
    });
    seasonProgress.push({
      user_id: user.id,
      season_id: season.id,
      season_points: member.season,
      skill_explorer_points: skills[0].points,
      skill_preparer_points: skills[1].points,
      skill_partager_points: skills[2].points,
      skill_entraider_points: skills[3].points,
      updated_at: iso(now),
    });
    territories.push({
      user_id: user.id,
      country_code: HOME.country_code,
      city_code: HOME.city_code,
      region_code: HOME.region_code,
      city_name: HOME.city_name,
      source: 'manual',
      updated_at: iso(now),
    });
    privates.push({
      user_id: user.id,
      lat: HOME.lat + member.dLat,
      lng: HOME.lng + member.dLng,
      accuracy_m: 50,
      consent_at: iso(now - 20 * DAY_MS),
      locked_until: iso(now + 90 * DAY_MS),
      updated_at: iso(now),
    });
  }
  if (!profiles.length) {
    flag('équipage enrichi : aucun des 8 comptes communautaires trouvé dans auth.users');
    return 0;
  }
  await write('user_progression', profiles, { onConflict: 'user_id', label: 'progression équipage' });
  await write('user_season_progress', seasonProgress, { onConflict: 'user_id,season_id', label: 'saison équipage' });
  await write('user_territory', territories, { onConflict: 'user_id', label: 'territoire équipage' });
  await write('user_territory_private', privates, { onConflict: 'user_id', label: 'territoire privé équipage' });
  return profiles.length;
}

async function seedCollaborator(tripId, ownerId) {
  const rows = [{ id: detId('collaborator', 1), trip_id: tripId, user_id: ownerId, role: 'owner' }];
  const { data, error } = await sb.auth.admin.listUsers({ perPage: 1000 });
  if (!error) {
    const marie = (data?.users || []).find((u) => (u.email || '').toLowerCase() === 'marie.dupont@email.fr');
    if (marie && marie.id !== ownerId) {
      rows.push({ id: detId('collaborator', 2), trip_id: tripId, user_id: marie.id, role: 'editor' });
    }
  }
  await write('trip_collaborators', rows, { onConflict: 'trip_id,user_id', label: 'collaborateurs' });
  return rows.length;
}

// ─── Résumé ──────────────────────────────────────────────────────────────────
function printSummary(result) {
  const lines = [];
  lines.push('');
  lines.push(DRY ? '=== SEED ULTRA DÉMO — DRY RUN (aucune écriture) ===' : '=== SEED ULTRA DÉMO — RÉSUMÉ ===');
  lines.push('─'.repeat(64));
  lines.push(`mode                     : ${DRY ? 'dry-run' : 'écriture'}`);
  lines.push(`compte                   : ${DEMO_EMAIL}`);
  lines.push(`user_id                  : ${result.userId}${result.pinned ? '' : '  ⚠ diffère de l’id épinglé'}`);
  lines.push(`saison                   : ${result.season.id} (${result.season.name})`);
  lines.push('');
  lines.push('Progression');
  lines.push(`  points vie entière     : ${result.progression.lifetime}`);
  lines.push(`  points saison          : ${result.progression.season}`);
  lines.push(`  niveau                 : ${result.progression.level} · ${result.progression.title}`);
  lines.push(`  explorer/preparer      : ${result.progression.skills.explorer} / ${result.progression.skills.preparer}`);
  lines.push(`  partager/entraider     : ${result.progression.skills.partager} / ${result.progression.skills.entraider}`);
  lines.push(`  badges                 : ${result.badges}`);
  lines.push('');
  lines.push('Voyage');
  lines.push(`  slug                   : ${TRIP_SLUG}`);
  lines.push(`  route                  : ${result.trip.route.name} (#${ROUTE_ID}${result.trip.route.ref ? ` · ${result.trip.route.ref}` : ''})`);
  lines.push(`  distance / D+          : ${result.trip.routeKm.toFixed(2)} km / +${ROUTE_D_PLUS_M} m · ${ROUTE_DURATION_H} h`);
  lines.push(`  dates                  : ${dateOnly(result.trip.start)} → ${dateOnly(result.trip.end)}`);
  lines.push(`  étapes / POI           : ${result.trip.steps.length} / ${result.pois}`);
  lines.push('');
  lines.push('Cockpit aventure');
  lines.push(`  plan                   : ${result.adventure.plan.title} (${result.adventure.plan.status})`);
  lines.push(`  décisions proposées   : ${result.adventure.decisions}`);
  lines.push('');
  lines.push('Compteurs écrits');
  for (const [key, value] of [...stats.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`  ${key.padEnd(24)}: ${value}`);
  }
  if (notes.length) {
    lines.push('');
    lines.push('Notes');
    for (const n of notes) lines.push(`  • ${n}`);
  }
  lines.push('─'.repeat(64));
  console.log(lines.join('\n'));
}

// ─── Point d'entrée ──────────────────────────────────────────────────────────
async function main() {
  loadEnvFile();
  sb = createServiceClient();
  await preflight();

  const account = await ensureDemoUser();
  const userId = account.id;
  if (!account.pinned) flag(`le compte ${DEMO_EMAIL} existe avec l id ${userId} (non épinglé) : le seed a ciblé cet id`);

  const season = await readOne('progression_seasons', ['id', 'name', 'starts_at', 'ends_at', 'status'], { status: 'active' });
  if (!season) fail('Aucune saison active dans progression_seasons : la progression de saison est impossible.');

  await seedProfile(userId);
  const progression = await seedProgression(userId, season);
  await seedRewardAccount(userId);
  const badges = await seedBadges(userId);

  poisCache = await loadRoutePois();
  const trip = await seedTrip(userId);
  const pois = buildPois(poisCache, trip.picked, trip.distances);
  await write('trip_pois', pois.map((p) => ({ ...p, trip_id: trip.tripId })), { onConflict: 'id', label: 'POI' });
  await write('trip_items', buildItems(), { onConflict: 'id', label: 'matériel' });
  await write('trip_expenses', buildExpenses(userId, trip.start), { onConflict: 'id', label: 'dépenses' });
  await write('trip_documents', buildDocuments(userId, trip.start), { onConflict: 'id', label: 'documents' });
  await write('trip_safety_checkpoints', buildCheckpoints(trip.start), { onConflict: 'id', label: 'checkpoints' });
  await write('trip_notes', buildNotes(userId, trip.start), { onConflict: 'id', label: 'carnet' });
  await write('trip_checklist_items', buildChecklist(), { onConflict: 'id', label: 'checklist' });
  await write(
    'trip_member_profiles',
    [{
      trip_id: trip.tripId,
      user_id: userId,
      consented_at: iso(Date.now() - 3 * DAY_MS),
      flat_speed_kmh: 4.2,
      ascent_speed_m_per_h: 500,
      descent_speed_m_per_h: 650,
      pack_weight_kg: 11.4,
      max_carry_kg: 18,
      experience_level: 'Confirmé',
      limitations: 'Genoux sensibles : éviter les descentes prolongées en terrain humide.',
      is_child: false,
    }],
    { onConflict: 'trip_id,user_id', label: 'profil équipier' },
  );
  await seedCollaborator(trip.tripId, userId);
  const adventure = await seedAdventure(userId, trip);

  const crew = await seedCrew(season);

  printSummary({
    userId,
    pinned: account.pinned,
    season,
    progression,
    badges,
    trip,
    pois: pois.length,
    adventure,
    crew,
  });
}

main().catch((err) => {
  console.error('');
  console.error('✗ SEED ULTRA DÉMO ÉCHOUÉ');
  console.error(`  ${err.message}`);
  if (!err.expected && err.stack) console.error(err.stack);
  process.exitCode = 1;
});
