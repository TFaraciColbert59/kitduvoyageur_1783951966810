/**
 * Banc de fidélité — substitut hermétique de Supabase côté SERVEUR Next.
 *
 * Chargé par `NODE_OPTIONS=--require …` au démarrage de `next start` : il
 * intercepte `fetch` vers `https://fixture.supabase.co` (PostgREST + GoTrue) et
 * Open-Meteo, et répond depuis les données ci-dessous. Aucune requête ne sort ;
 * rien dans l'application n'est modifié. Le côté NAVIGATEUR est simulé par
 * `page.route` (tests/e2e/communaute-v2.fixtures.ts), pas par ce fichier.
 *
 * Données : carnet « Tour des Écrins » (contenu de la maquette
 * handoff/carnet-v2/annexes/maquette-fiche-carnet.html : 4 jours, 17 / 18,4 /
 * 22 / 15 km, trois voyageurs, kit et verdicts, 4 nuits).
 */
'use strict';

const HOST = 'fixture.supabase.co';
const CARNET_ID = '749e9e8c-9540-5a73-8b6c-6ab07264f62f';
const EMPTY_ID = '00000000-0000-4000-8000-00000000e0e0';
const GROUPE_ID = '5a0f0b2e-3c1d-4f6a-9a2e-0d4c1b7e8f01';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const CREW = [
  { id: OWNER_ID, full_name: 'Camille Rey', handle: 'camille', role: 'owner' },
  { id: '22222222-2222-4222-8222-222222222201', full_name: 'Léo Barbier', handle: 'leo', role: 'contributor' },
  { id: '22222222-2222-4222-8222-222222222202', full_name: 'Inès Morel', handle: 'ines', role: 'contributor' },
];

const DAYS = [
  { n: 1, from: 'La Bérarde', to: 'Refuge du Pigeonnier', km: 17, dp: 1240, txt: '6 h 40', date: '2026-07-13', t: 11, w: 'éclaircies', pts: [[6.2916, 44.9455], [6.3010, 44.9561], [6.3128, 44.9622], [6.3250, 44.9710], [6.3351, 44.9786], [6.3440, 44.9862]], alt: [1738, 1850, 2020, 2150, 2520, 2410] },
  { n: 2, from: 'Refuge du Pigeonnier', to: 'Vallouise', km: 18.4, dp: 1080, txt: '7 h 10', date: '2026-07-14', t: 14, w: 'éclaircies', pts: [[6.3440, 44.9862], [6.3702, 44.9700], [6.4012, 44.9402], [6.4410, 44.9080], [6.4730, 44.8830], [6.4930, 44.8589]], alt: [2410, 2425, 2050, 1620, 1290, 1160] },
  { n: 3, from: 'Vallouise', to: 'Lac de la Muzelle', km: 22, dp: 1340, txt: '8 h 20', date: '2026-07-15', t: 16, w: 'grand soleil', pts: [[6.4930, 44.8589], [6.4601, 44.9020], [6.4112, 44.9498], [6.3702, 44.9934], [6.3481, 45.0301], [6.3321, 45.0522]], alt: [1160, 1580, 2230, 2520, 2250, 2105] },
  { n: 4, from: 'Lac de la Muzelle', to: 'La Bérarde', km: 15, dp: 860, txt: '5 h 50', date: '2026-07-16', t: 12, w: 'nuageux', pts: [[6.3321, 45.0522], [6.3012, 45.0211], [6.2802, 44.9900], [6.2701, 44.9690], [6.2766, 44.9540], [6.2916, 44.9455]], alt: [2105, 2580, 1700, 1750, 1738, 1738] },
];

const NIGHTS = [
  { jour_numero: 1, nom: 'Refuge du Pigeonnier', type: 'refuge', altitude_m: 2410, infos: 'Demi-pension, dortoir de 12', lat: 44.9862, lng: 6.344 },
  { jour_numero: 2, nom: 'Gîte des Claux, Vallouise', type: 'gite', altitude_m: 1160, infos: 'Chambre de 3, douche chaude', lat: 44.8589, lng: 6.4930 },
  { jour_numero: 3, nom: 'Bivouac au Lac de la Muzelle', type: 'bivouac', altitude_m: 2105, infos: 'Tente, pas de feu, eau du lac filtrée', lat: 45.0522, lng: 6.3321 },
].map((n, i) => ({ id: `n-${i + 1}`, map_refuge_id: null, ...n }));

const MOMENTS = [
  [1, '07:10', 'La Bérarde · 1 738 m', 'Camille', 'Départ tranquille, le vallon sent le mélèze.'],
  [1, '11:30', 'Plan de Lanchâtra', 'Camille', 'Pause casse-croûte au Plan de Lanchâtra.'],
  [1, '16:45', 'Refuge du Pigeonnier', 'Camille', 'Arrivés, ça souffle.'],
  [2, '09:45', 'Col de l’Eychauda', 'Inès', 'On est au col.'],
  [2, '14:20', 'Vallouise', 'Camille', 'Le berger nous a montré le passage à gué.'],
  [3, '06:50', 'Vallouise', 'Léo', 'Brume dans la vallée, on part tôt. Léo a mal au talon.'],
  [3, '11:40', 'Passage du couloir', 'Camille', 'Chute de pierres dans le couloir. Personne touché, détour de vingt minutes.'],
  [4, '10:20', 'Chalet-refuge du Chardon', 'Camille', 'Prenez le sentier haut, l’autre est coupé.'],
].map((m, i) => ({
  id: `m-${i + 1}`, jour_numero: m[0], heure: m[1], lieu: m[2], auteur_nom: m[3], citation: m[4], image_url: null,
  created_at: `2026-07-1${2 + m[0]}T${m[1]}:00+02:00`,
}));

const KIT = [
  ['Sac 45 L', 'Portage', 1150, 'essentiel'], ['Bâtons carbone', 'Portage', 440, 'essentiel'], ['Tente 2 places', 'Abri', 1380, 'defaillant'],
  ['Duvet 0 °C', 'Abri', 780, 'utile'], ['Matelas isolant', 'Abri', 420, 'utile'], ['Réchaud', 'Cuisine', 360, 'jamais_servi'],
  ['Popote', 'Cuisine', 210, 'utile'], ['Veste imperméable', 'Vêtements', 320, 'utile'], ['Polaire', 'Vêtements', 280, 'essentiel'],
  ['Frontale', 'Électronique', 85, 'essentiel'], ['Batterie externe', 'Électronique', 240, 'utile'], ['Filtre à eau', 'Sécurité', 65, 'utile'],
  ['Trousse de secours', 'Sécurité', 290, 'jamais_servi'],
].map((k, i) => ({
  id: `k-${i + 1}`, nom: k[0], detail: k[1], poids_g: k[2], couleur_tag: null, sort_order: i, verdict: k[3],
  verdict_note: k[3] === 'defaillant' ? 'fermeture cassée' : null, jours_utilises: [1, 2, 3, 4].slice(0, 1 + (i % 4)),
}));

function sessionFor(day) {
  const start = `${day.date}T06:30:00+02:00`;
  const t0 = Date.parse(start);
  const total = day.pts.length - 1;
  return {
    id: `s-${day.n}`, carnet_id: CARNET_ID, distance_km: day.km, elevation_gain_m: day.dp,
    duration_seconds: Math.round(day.km * 1500), started_at: start,
    positions_geojson: { type: 'LineString', coordinates: day.pts },
    positions_timed: day.pts.map((p, i) => ({
      lng: p[0], lat: p[1], timestamp: new Date(t0 + (i / total) * day.km * 1500 * 1000).toISOString(), elevationM: day.alt[i],
    })),
  };
}

const TABLES = {
  carnets: [{
    id: CARNET_ID, author_id: OWNER_ID, title: 'Tour des Écrins', destination: 'Écrins, Hautes-Alpes',
    description: 'Boucle depuis La Bérarde, quatre jours, refuge, gîte et bivouac.',
    cover_image: null, cover_image_alt: null, start_date: '2026-07-13', end_date: '2026-07-16',
    visibility: 'public', verified: true, likes_count: 128, comments_count: 14, views_count: 940,
    distance_km: 72.4, denivele_m: 4520, groupe_id: GROUPE_ID, lieu_depart: 'La Bérarde', lieu_arrivee: 'La Bérarde',
    country_iso: 'FR', trip_id: null, live_sharing: false,
  }],
  public_profiles: CREW.map((c) => ({ id: c.id, full_name: c.full_name, handle: c.handle, avatar_url: null, trust_score: 0.8, bio: null, location: null, website: null, loyalty_points: 0, loyalty_level: null, xp: 0, level: 1, created_at: '2026-01-01T00:00:00Z' })),
  hike_sessions: DAYS.map(sessionFor),
  groupe_etapes: DAYS.map((d, i) => ({
    id: `e-${d.n}`, groupe_id: GROUPE_ID, jour_numero: d.n, ordre: i, date_etape: d.date, lieu_depart: d.from, lieu_arrivee: d.to,
    recit: `Jour ${d.n} : ${d.from} → ${d.to}.`, distance_km: d.km, denivele_m: d.dp, duree_texte: d.txt, meteo: d.w, temperature_c: d.t,
  })),
  groupe_hebergements: NIGHTS.map((n) => ({
    id: `h-${n.jour_numero}`, groupe_id: GROUPE_ID, apres_jour_numero: n.jour_numero, nom: n.nom, prix_cents: 5800, prix_note: null,
    altitude_m: n.altitude_m, note: n.infos, hote: null, type_hebergement: n.type,
  })),
  carnet_moments: MOMENTS.map((m) => ({ ...m, carnet_id: CARNET_ID })),
  carnet_kit_items: KIT.map((k) => ({ ...k, carnet_id: CARNET_ID })),
  carnet_likes: CREW.slice(1).map((c, i) => ({ carnet_id: CARNET_ID, user_id: c.id, reaction: i ? 'heart' : 'like', created_at: `2026-07-2${i}T08:00:00Z` })),
  carnet_comments: [],
  carnet_collaborators: CREW.map((c, i) => ({ carnet_id: CARNET_ID, user_id: c.id, role: c.role, created_at: `2026-07-01T0${i}:00:00Z` })),
  hike_session_participants: [],
  carnet_nights: NIGHTS.map((n) => ({ ...n, carnet_id: CARNET_ID })),
  carnet_day_likes: [{ carnet_id: CARNET_ID, jour_numero: 1, user_id: CREW[1].id }, { carnet_id: CARNET_ID, jour_numero: 2, user_id: CREW[2].id }],
  carnet_day_comments: [],
  carnet_moment_likes: [],
  carnet_moment_comments: [],
  carnet_moment_saves: [],
  carnet_live_positions: [],
  carnet_favorites: [],
  trip_expenses: [],
};

/* Second carnet, sans étape, moment, kit ni sortie : état « vide » de la fiche. */
TABLES.carnets.push({
  ...TABLES.carnets[0], id: EMPTY_ID, title: 'Mon premier carnet', destination: null, description: null,
  start_date: null, end_date: null, likes_count: 0, comments_count: 0, views_count: 0, distance_km: null,
  denivele_m: null, groupe_id: null, lieu_depart: null, lieu_arrivee: null, verified: false,
});

/* ── mini PostgREST ─────────────────────────────────────────────────────── */

function cmp(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function applyFilters(rows, params) {
  let out = rows;
  for (const [key, raw] of params) {
    if (['select', 'order', 'limit', 'offset'].includes(key)) continue;
    const value = String(raw);
    if (value.startsWith('eq.')) out = out.filter((r) => String(r[key]) === value.slice(3));
    else if (value.startsWith('in.(')) {
      const set = new Set(value.slice(4, -1).split(',').map((s) => s.replace(/^"|"$/g, '')));
      out = out.filter((r) => set.has(String(r[key])));
    } else if (value === 'is.null') out = out.filter((r) => r[key] == null);
  }
  const order = params.get('order');
  if (order) {
    const specs = order.split(',').map((s) => s.split('.'));
    out = [...out].sort((x, y) => {
      for (const [col, dir] of specs) {
        const c = cmp(x[col], y[col]);
        if (c) return dir === 'desc' ? -c : c;
      }
      return 0;
    });
  }
  const limit = params.get('limit');
  if (limit) out = out.slice(0, Number(limit));
  return out;
}

function json(body, status = 200, headers = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function userFromAuth(headers) {
  const auth = headers.get('authorization') || '';
  const m = /^Bearer fixture\.([a-z-]+)\.([0-9a-f-]{36})$/.exec(auth);
  if (!m) return null;
  return {
    id: m[2], aud: 'authenticated', role: 'authenticated', email: m[1] === 'anonymous' ? null : 'recette@lkdv.test',
    app_metadata: {}, user_metadata: {}, is_anonymous: m[1] === 'anonymous', created_at: '2026-01-01T00:00:00Z',
  };
}

function handleSupabase(url, init, headers) {
  const method = (init.method || 'GET').toUpperCase();
  if (url.pathname.startsWith('/auth/v1/user')) {
    const user = userFromAuth(headers);
    return user ? json(user) : json({ message: 'invalid JWT' }, 401);
  }
  if (url.pathname.startsWith('/auth/v1/')) return json({ message: 'fixture' }, 400);
  if (url.pathname.startsWith('/rest/v1/rpc/')) return json(null, 200);
  const m = /^\/rest\/v1\/([a-z_]+)$/.exec(url.pathname);
  if (!m) return json({ message: 'fixture: route inconnue' }, 404);
  if (method !== 'GET' && method !== 'HEAD') return json([], 201);
  const all = TABLES[m[1]] || [];
  const rows = applyFilters(all, url.searchParams);
  const prefer = headers.get('prefer') || '';
  const range = { 'content-range': `${rows.length ? `0-${rows.length - 1}` : '*'}/${rows.length}` };
  if (method === 'HEAD') return new Response(null, { status: 200, headers: prefer.includes('count') ? range : {} });
  if ((headers.get('accept') || '').includes('vnd.pgrst.object')) {
    if (rows.length !== 1) return json({ code: 'PGRST116', message: 'The result contains 0 rows' }, 406);
    return json(rows[0]);
  }
  return json(rows, 200, prefer.includes('count') ? range : {});
}

function handleElevation(url) {
  const lat = String(url.searchParams.get('latitude') || '').split(',').map(Number);
  const lng = String(url.searchParams.get('longitude') || '').split(',').map(Number);
  return json({ elevation: lat.map((la, i) => Math.round(1200 + 1300 * Math.abs(Math.sin((la - 44.8) * 9 + (lng[i] - 6.2) * 7)))) });
}

const realFetch = globalThis.fetch;
globalThis.fetch = async function fidelityFetch(input, init = {}) {
  try {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw);
    const headers = new Headers(init.headers || (typeof input === 'object' && input.headers) || undefined);
    if (url.hostname === HOST) return handleSupabase(url, { method: init.method || (typeof input === 'object' && input.method) || 'GET' }, headers);
    if (url.hostname === 'api.open-meteo.com') return handleElevation(url);
  } catch {
    /* tombe sur le vrai fetch */
  }
  return realFetch(input, init);
};

module.exports = { CARNET_ID, OWNER_ID, TABLES };
