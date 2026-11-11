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
const STORIES_ID = '00000000-0000-4000-8000-0000000051f0';
const LOADING_ID = '00000000-0000-4000-8000-0000000010ad';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const CREW = [
  { id: OWNER_ID, full_name: 'Camille Rey', handle: 'camille', role: 'owner' },
  { id: '22222222-2222-4222-8222-222222222201', full_name: 'Léo Barbier', handle: 'leo', role: 'contributor' },
  { id: '22222222-2222-4222-8222-222222222202', full_name: 'Inès Morel', handle: 'ines', role: 'contributor' },
];

/* ── Hub /carnets : jeux de données du hub (en route / préparation / rentré) ──
   Le hub lit les tables sous RLS côté serveur ; ces lignes ne touchent pas la
   fiche « Tour des Écrins » (scénarios existants) et servent la recette du hub
   (carnets-hub.spec.ts) et les captures de `docs/audit/carnets-hub-2026-11-11/`.
   Les dates sont calculées autour du jour réel pour que les phases dérivées
   (préparation / en route / rentré) soient toujours justes. */
const HUB_AUTHOR_A = '33333333-3333-4333-8333-333333333301';
const HUB_AUTHOR_B = '33333333-3333-4333-8333-333333333302';
/** Auteur fantôme des alias de scénarios (chargement / stories) : ils ne doivent
    apparaître dans aucun filtre du hub (ni Monde, ni Suivis, ni Les miens). */
const ALIAS_AUTHOR = '44444444-4444-4444-8444-444444444401';
const HUB_EN_ROUTE_ID = '00000000-0000-4000-8000-00000000a001';
const HUB_EN_ROUTE_PHOTOS_ID = '00000000-0000-4000-8000-00000000a002';
const HUB_PREPARATION_ID = '00000000-0000-4000-8000-00000000a003';
const HUB_RENTRE_ID = '00000000-0000-4000-8000-00000000a004';
const HUB_RENTRE_NO_PHOTO_ID = '00000000-0000-4000-8000-00000000a005';
const HUB_MINE_ID = '00000000-0000-4000-8000-00000000a006';

/** Jour Paris (YYYY-MM-DD) décalé de `offset` jours par rapport à maintenant. */
function isoDay(offset) {
  const date = new Date(Date.now() + offset * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(date);
}

/** Horodatage ISO (updated_at) décalé de `minutes` minutes. */
function isoMinutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

const HUB_CARNETS = [
  {
    id: HUB_EN_ROUTE_ID, author_id: HUB_AUTHOR_A, title: 'Crêtes du Queyras, sans se presser',
    destination: 'Queyras, Hautes-Alpes', description: 'Cinq jours de crêtes entre Saint-Véran et Ceillac, deux bivouacs et un refuge.',
    cover_image: '/assets/images/account-bg.webp', cover_image_alt: null,
    start_date: isoDay(-3), end_date: isoDay(5), visibility: 'public', verified: true,
    likes_count: 128, comments_count: 14, views_count: 940, distance_km: 61, denivele_m: 4120,
    groupe_id: null, lieu_depart: 'Saint-Véran', lieu_arrivee: 'Ceillac', country_iso: 'FR',
    trip_id: null, live_sharing: true, nb_nuits: 5, nb_voyageurs: 3,
    created_at: isoMinutesAgo(60 * 24 * 20), updated_at: isoMinutesAgo(60),
    map_points: { trace: [[6.63, 44.7], [6.66, 44.72], [6.7, 44.74], [6.73, 44.77], [6.76, 44.8], [6.78, 44.83]] },
  },
  {
    id: HUB_EN_ROUTE_PHOTOS_ID, author_id: CREW[1].id, title: 'Météores, monastères suspendus',
    destination: 'Météores, Grèce', description: 'La Grèce du Nord à pied, entre pins et monastères.',
    cover_image: null, cover_image_alt: null,
    start_date: isoDay(-2), end_date: isoDay(4), visibility: 'public', verified: false,
    likes_count: 64, comments_count: 5, views_count: 380, distance_km: 38, denivele_m: 1600,
    groupe_id: null, lieu_depart: 'Kalambaka', lieu_arrivee: 'Kastraki', country_iso: 'GR',
    trip_id: null, live_sharing: false, nb_nuits: 3, nb_voyageurs: 2,
    created_at: isoMinutesAgo(60 * 24 * 9), updated_at: isoMinutesAgo(120),
    map_points: null,
  },
  {
    id: HUB_PREPARATION_ID, author_id: HUB_AUTHOR_B, title: 'Cap Nord en autonomie',
    destination: 'Laponie, Norvège', description: 'Préparatifs du raid hivernal : pulka, cartes, abris.',
    cover_image: null, cover_image_alt: null,
    start_date: isoDay(21), end_date: isoDay(33), visibility: 'public', verified: false,
    likes_count: 0, comments_count: 0, views_count: 12, distance_km: null, denivele_m: null,
    groupe_id: null, lieu_depart: null, lieu_arrivee: null, country_iso: 'NO',
    trip_id: null, live_sharing: false, nb_nuits: 11, nb_voyageurs: 1,
    created_at: isoMinutesAgo(60 * 24 * 2), updated_at: isoMinutesAgo(3 * 60),
    map_points: null,
  },
  {
    id: HUB_RENTRE_ID, author_id: HUB_AUTHOR_B, title: 'Sentier des douaniers',
    destination: 'Côtes-d’Armor, Bretagne', description: 'Six jours de GR34 entre lande et granit rose.',
    cover_image: '/assets/images/account-bg.webp', cover_image_alt: null,
    start_date: isoDay(-40), end_date: isoDay(-34), visibility: 'public', verified: true,
    likes_count: 312, comments_count: 21, views_count: 2100, distance_km: 112, denivele_m: 2400,
    groupe_id: null, lieu_depart: 'Perros-Guirec', lieu_arrivee: 'Paimpol', country_iso: 'FR',
    trip_id: null, live_sharing: false, nb_nuits: 6, nb_voyageurs: 2,
    created_at: isoMinutesAgo(60 * 24 * 60), updated_at: isoMinutesAgo(60 * 24),
    map_points: { trace: [[-3.44, 48.81], [-3.4, 48.79], [-3.35, 48.78]] },
  },
  {
    id: HUB_RENTRE_NO_PHOTO_ID, author_id: HUB_AUTHOR_A, title: 'Bivouacs dans les Alpilles',
    destination: null, description: 'Deux nuits sous les étoiles, sans photo : le carnet est resté au papier.',
    cover_image: null, cover_image_alt: null,
    start_date: isoDay(-20), end_date: isoDay(-15), visibility: 'public', verified: false,
    likes_count: 7, comments_count: 1, views_count: 44, distance_km: 24, denivele_m: 780,
    groupe_id: null, lieu_depart: null, lieu_arrivee: null, country_iso: null,
    trip_id: null, live_sharing: false, nb_nuits: 2, nb_voyageurs: 1,
    created_at: isoMinutesAgo(60 * 24 * 30), updated_at: isoMinutesAgo(60 * 24 * 2),
    map_points: null,
  },
  {
    id: HUB_MINE_ID, author_id: OWNER_ID, title: 'Préparatifs du GR20 nord',
    destination: 'Corse, France', description: 'Mon carnet de préparation : étapes, ravitaillements, matériel.',
    cover_image: '/assets/images/account-bg.webp', cover_image_alt: null,
    start_date: isoDay(14), end_date: isoDay(22), visibility: 'public', verified: false,
    likes_count: 3, comments_count: 0, views_count: 25, distance_km: null, denivele_m: null,
    groupe_id: null, lieu_depart: 'Calenzana', lieu_arrivee: 'Vizzavona', country_iso: 'FR',
    trip_id: null, live_sharing: false, nb_nuits: 8, nb_voyageurs: 2,
    created_at: isoMinutesAgo(60 * 24 * 5), updated_at: isoMinutesAgo(4 * 60),
    map_points: null,
  },
];

const HUB_PROFILES = [
  { id: HUB_AUTHOR_A, full_name: 'Nora Chevalier', handle: 'nora', avatar_url: null, trust_score: 0.86, bio: null, location: null, website: null, loyalty_points: 0, loyalty_level: null, xp: 0, level: 1, created_at: '2026-02-01T00:00:00Z' },
  { id: HUB_AUTHOR_B, full_name: 'Bastien Perret', handle: 'bastien', avatar_url: null, trust_score: 0.72, bio: null, location: null, website: null, loyalty_points: 0, loyalty_level: null, xp: 0, level: 1, created_at: '2026-03-01T00:00:00Z' },
  { id: ALIAS_AUTHOR, full_name: 'Archive fixture', handle: 'archive-fixture', avatar_url: null, trust_score: 0.5, bio: null, location: null, website: null, loyalty_points: 0, loyalty_level: null, xp: 0, level: 1, created_at: '2026-01-01T00:00:00Z' },
];

/** Moments : trois photos pour la couverture de repli du carnet sans photo. */
const HUB_MOMENTS = [
  { carnet_id: HUB_EN_ROUTE_PHOTOS_ID, jour_numero: 1, heure: '09:20', lieu: 'Kalambaka', auteur_nom: 'Léo', citation: null, moment_type: 'photo', image_url: '/assets/images/account-bg.webp', created_at: isoMinutesAgo(60 * 40) },
  { carnet_id: HUB_EN_ROUTE_PHOTOS_ID, jour_numero: 1, heure: '15:40', lieu: 'Grand Météore', auteur_nom: 'Léo', citation: null, moment_type: 'photo', image_url: '/assets/images/account-bg.webp', created_at: isoMinutesAgo(60 * 36) },
  { carnet_id: HUB_EN_ROUTE_PHOTOS_ID, jour_numero: 2, heure: '07:05', lieu: 'Kastraki', auteur_nom: 'Zoé', citation: null, moment_type: 'photo', image_url: '/assets/images/account-bg.webp', created_at: isoMinutesAgo(60 * 10) },
  { carnet_id: HUB_EN_ROUTE_ID, jour_numero: 1, heure: '10:10', lieu: 'Saint-Véran', auteur_nom: 'Nora', citation: 'Départ sous la brume.', moment_type: 'text', image_url: null, created_at: isoMinutesAgo(60 * 70) },
];

/** Bords du hub : le lecteur (Camille) suit Nora et Léo, et aime deux carnets. */
const HUB_FOLLOWS = [
  { follower_id: OWNER_ID, following_id: HUB_AUTHOR_A, created_at: '2026-09-01T00:00:00Z' },
  { follower_id: OWNER_ID, following_id: CREW[1].id, created_at: '2026-09-02T00:00:00Z' },
  { follower_id: CREW[1].id, following_id: OWNER_ID, created_at: '2026-09-03T00:00:00Z' },
];
const HUB_LIKES = [
  { carnet_id: HUB_EN_ROUTE_ID, user_id: OWNER_ID, reaction: 'like', created_at: '2026-11-01T08:00:00Z' },
  { carnet_id: HUB_RENTRE_ID, user_id: OWNER_ID, reaction: 'heart', created_at: '2026-11-02T08:00:00Z' },
  { carnet_id: HUB_EN_ROUTE_PHOTOS_ID, user_id: CREW[2].id, reaction: 'like', created_at: '2026-11-03T08:00:00Z' },
  { carnet_id: HUB_PREPARATION_ID, user_id: CREW[2].id, reaction: 'like', created_at: '2026-11-04T08:00:00Z' },
  { carnet_id: HUB_EN_ROUTE_ID, user_id: CREW[2].id, reaction: 'like', created_at: '2026-11-05T08:00:00Z' },
];
const HUB_COLLABORATORS = [
  { carnet_id: HUB_EN_ROUTE_ID, user_id: HUB_AUTHOR_A, role: 'owner', created_at: '2026-10-20T08:00:00Z' },
  { carnet_id: HUB_EN_ROUTE_ID, user_id: CREW[2].id, role: 'contributor', created_at: '2026-10-21T08:00:00Z' },
  { carnet_id: HUB_EN_ROUTE_ID, user_id: CREW[0].id, role: 'contributor', created_at: '2026-10-22T08:00:00Z' },
  { carnet_id: HUB_EN_ROUTE_PHOTOS_ID, user_id: CREW[1].id, role: 'owner', created_at: '2026-10-25T08:00:00Z' },
  { carnet_id: HUB_EN_ROUTE_PHOTOS_ID, user_id: HUB_AUTHOR_A, role: 'contributor', created_at: '2026-10-26T08:00:00Z' },
  { carnet_id: HUB_MINE_ID, user_id: OWNER_ID, role: 'owner', created_at: '2026-11-01T08:00:00Z' },
  { carnet_id: HUB_MINE_ID, user_id: CREW[2].id, role: 'contributor', created_at: '2026-11-02T08:00:00Z' },
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

/* Moments : les 21 moments saisis (M0) et les 7 photos de la galerie de la maquette
   (`M0`, `DAYS[n].gal`), soit 28 moments typés comme dans le tiroir de la maquette. */
const WHO = { C: CREW[0], L: CREW[1], I: CREW[2] };
const M0 = [
  [1, '07:10', 'photo', 'La Bérarde · 1 738 m', 'L', '', null],
  [1, '09:05', 'species', 'Vallon du Chardon', 'C', 'Bouquetin des Alpes', { latin: 'Capra ibex' }],
  [1, '11:30', 'kit', 'Plan de Lanchâtra', 'C', '', { itemId: 'k-batons' }],
  [1, '13:20', 'spend', 'Plan de Lanchâtra', 'L', 'Casse-croûte', { amountEur: 14, category: 'Repas' }],
  [1, '16:45', 'voice', 'Refuge du Pigeonnier', 'C', 'Arrivés, ça souffle.', { durationLabel: '0:42' }],
  [2, '07:42', 'photo', 'Aube sur la moraine', 'L', '', null],
  [2, '09:45', 'voice', 'Col de l’Eychauda', 'I', 'On est au col.', { durationLabel: '0:38' }],
  [2, '11:02', 'kit', 'Lac de l’Eychauda', 'I', '', { itemId: 'k-filtre' }],
  [2, '12:30', 'spend', 'Pré de l’Alp', 'L', 'Pique-nique pour trois', { amountEur: 38, category: 'Repas' }],
  [2, '13:50', 'video', 'Torrent de l’Eychauda', 'C', '', null],
  [2, '14:20', 'meet', 'Vallouise', 'C', 'Le berger nous a montré le passage à gué.', { who: 'Marc, berger' }],
  [3, '06:50', 'text', 'Vallouise', 'L', 'Brume dans la vallée, on part tôt. Léo a mal au talon.', null],
  [3, '09:30', 'species', 'Chalet des Prés', 'I', 'Edelweiss', { latin: 'Leontopodium nivale' }],
  [3, '11:40', 'inc', 'Passage du couloir', 'C', 'Chute de pierres dans le couloir. Personne touché, détour de vingt minutes.', null],
  [3, '14:10', 'kit', 'Col de la Muzelle', 'I', '', { itemId: 'k-guetres' }],
  [3, '15:20', 'video', 'Lac de la Muzelle', 'L', '', null],
  [4, '07:20', 'photo', 'Lac de la Muzelle', 'C', '', null],
  [4, '09:30', 'species', 'Col des Clots', 'L', 'Chocard à bec jaune', { latin: 'Pyrrhocorax graculus' }],
  [4, '10:20', 'meet', 'Chalet-refuge du Chardon', 'C', 'Prenez le sentier haut, l’autre est coupé.', { who: 'La gardienne du chalet' }],
  [4, '10:40', 'spend', 'Chalet-refuge du Chardon', 'I', 'Repas au refuge', { amountEur: 26, category: 'Repas' }],
  [4, '11:10', 'kit', 'Pont de la Pierre', 'L', '', { itemId: 'k-rechaud' }],
  /* photos de la galerie */
  [1, '08:20', 'photo', 'Forêt de mélèzes', 'L', '', null],
  [1, '11:40', 'photo', 'Pause au Plan de Lanchâtra', 'L', '', null],
  [2, '11:20', 'photo', 'Lac de l’Eychauda', 'L', '', null],
  [3, '20:30', 'photo', 'Bivouac au crépuscule', 'L', '', null],
  [3, '13:40', 'photo', 'Arête de la Muzelle', 'L', '', null],
  [4, '08:45', 'photo', 'Dernier col', 'L', '', null],
  [4, '11:55', 'photo', 'Descente en forêt', 'L', '', null],
].sort((x, y) => x[0] - y[0] || x[1].localeCompare(y[1]));
const KIT_NAMES = { 'k-batons': 'Bâtons carbone', 'k-filtre': 'Filtre à eau', 'k-guetres': 'Guêtres', 'k-rechaud': 'Réchaud' };
const MOMENTS = M0.map((m, i) => ({
  id: `m-${i + 1}`, jour_numero: m[0], heure: m[1], lieu: m[3], auteur_nom: WHO[m[4]].full_name.split(' ')[0],
  auteur_id: WHO[m[4]].id, citation: m[2] === 'kit' ? KIT_NAMES[m[6].itemId] : m[5],
  image_url: null, moment_type: m[2], moment_meta: m[6],
  created_at: `2026-07-1${2 + m[0]}T${m[1]}:00+02:00`,
}));

/* Kit : les 14 objets de la maquette (catégorie dans `detail`, verdict, jours d'utilisation). */
const KIT = [
  ['sac', 'Sac 45 L', 'Portage', 1150, 'essentiel', [1, 2, 3, 4]],
  ['batons', 'Bâtons carbone', 'Portage', 440, 'essentiel', [1, 3]],
  ['tente', 'Tente 2 places', 'Abri', 1380, 'defaillant', [3], 'fermeture cassée'],
  ['duvet', 'Duvet 0 °C', 'Abri', 780, 'utile', [3]],
  ['matelas', 'Matelas isolant', 'Abri', 420, 'utile', [3]],
  ['rechaud', 'Réchaud', 'Cuisine', 360, 'jamais_servi', [3, 4]],
  ['popote', 'Popote', 'Cuisine', 210, 'utile', [3]],
  ['veste', 'Veste imperméable', 'Vêtements', 320, 'utile', [2, 4]],
  ['polaire', 'Polaire', 'Vêtements', 280, 'essentiel', [1, 3]],
  ['guetres', 'Guêtres', 'Vêtements', 0, 'manquait', [3], 'à prévoir, environ 180 g'],
  ['frontale', 'Frontale', 'Électronique', 85, 'essentiel', [3]],
  ['batterie', 'Batterie externe', 'Électronique', 240, 'utile', [2]],
  ['filtre', 'Filtre à eau', 'Sécurité', 65, 'utile', [2]],
  ['trousse', 'Trousse de secours', 'Sécurité', 290, 'jamais_servi', [1, 3]],
].map((k, i) => ({
  id: `k-${k[0]}`, nom: k[1], detail: k[2], poids_g: k[3], couleur_tag: null, sort_order: i, verdict: k[4],
  verdict_note: k[6] || null, jours_utilises: k[5],
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
    distance_km: 72.4, denivele_m: 4520, groupe_id: null, lieu_depart: 'Boucle depuis La Bérarde', lieu_arrivee: 'La Bérarde',
    country_iso: 'FR', trip_id: null, live_sharing: true,
    nb_nuits: 4, nb_voyageurs: 3, created_at: '2026-07-01T08:00:00Z', updated_at: '2026-07-17T08:00:00Z',
    map_points: { trace: DAYS.flatMap((d) => d.pts) },
  }, ...HUB_CARNETS],
  public_profiles: [
    ...CREW.map((c) => ({ id: c.id, full_name: c.full_name, handle: c.handle, avatar_url: null, trust_score: 0.8, bio: null, location: null, website: null, loyalty_points: 0, loyalty_level: null, xp: 0, level: 1, created_at: '2026-01-01T00:00:00Z' })),
    ...HUB_PROFILES,
  ],
  user_follows: HUB_FOLLOWS,
  hike_sessions: DAYS.map(sessionFor),
  carnet_etapes: DAYS.map((d, i) => ({
    id: `e-${d.n}`, carnet_id: CARNET_ID, jour_numero: d.n, ordre: i, date_etape: d.date, lieu_depart: d.from, lieu_arrivee: d.to,
    recit: `Jour ${d.n} : ${d.from} → ${d.to}.`, distance_km: d.km, denivele_m: d.dp, duree_texte: d.txt, meteo: d.w, temperature_c: d.t,
  })),
  carnet_moments: [...MOMENTS.map((m) => ({ ...m, carnet_id: CARNET_ID })), ...HUB_MOMENTS],
  carnet_kit_items: KIT.map((k) => ({ ...k, carnet_id: CARNET_ID })),
  carnet_likes: [...CREW.slice(1).map((c, i) => ({ carnet_id: CARNET_ID, user_id: c.id, reaction: i ? 'heart' : 'like', created_at: `2026-07-2${i}T08:00:00Z` })), ...HUB_LIKES],
  carnet_comments: [],
  carnet_collaborators: [...CREW.map((c, i) => ({ carnet_id: CARNET_ID, user_id: c.id, role: c.role, created_at: `2026-07-01T0${i}:00:00Z` })), ...HUB_COLLABORATORS],
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
    if (['select', 'order', 'limit', 'offset', 'or', 'and', 'columns'].includes(key)) continue;
    const value = String(raw);
    const negate = value.startsWith('not.');
    const spec = negate ? value.slice(4) : value;
    const keep = (row) => {
      let match;
      if (spec.startsWith('eq.')) match = String(row[key]) === spec.slice(3);
      else if (spec.startsWith('neq.')) match = String(row[key]) !== spec.slice(4);
      else if (spec.startsWith('in.(')) {
        const set = new Set(spec.slice(4, -1).split(',').map((s) => s.replace(/^"|"$/g, '')));
        match = set.has(String(row[key]));
      } else if (spec === 'is.null') match = row[key] == null;
      else if (spec.startsWith('gte.')) match = row[key] != null && String(row[key]) >= spec.slice(4);
      else if (spec.startsWith('lte.')) match = row[key] != null && String(row[key]) <= spec.slice(4);
      else if (spec.startsWith('gt.')) match = row[key] != null && String(row[key]) > spec.slice(3);
      else if (spec.startsWith('lt.')) match = row[key] != null && String(row[key]) < spec.slice(3);
      else if (spec.startsWith('like.')) {
        const pattern = new RegExp(`^${spec.slice(5).split('%').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`, 'i');
        match = pattern.test(String(row[key] ?? ''));
      } else match = true;
      return negate ? !match : match;
    };
    out = out.filter(keep);
  }
  /* `.or('a.eq.1,b.eq.2')` (filtres de feed) : sous-ensemble eq/in suffisant pour
     les charges du hub (jamais de logique inventée au-delà). */
  const or = params.get('or');
  if (or) {
    const clauses = or.replace(/^\(|\)$/g, '').split(',');
    out = out.filter((row) =>
      clauses.some((clause) => {
        const [col, op, ...rest] = clause.split('.');
        const wanted = rest.join('.');
        if (op === 'eq') return String(row[col]) === wanted;
        if (op === 'in') {
          const set = new Set(wanted.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, '')));
          return set.has(String(row[col]));
        }
        if (op === 'is' && wanted === 'null') return row[col] == null;
        return true;
      })
    );
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

/** Corps JSON d'une requête `init` (string, Buffer/Uint8Array ou objet). */
function bodyJson(init) {
  try {
    const body = init && init.body;
    if (body == null) return {};
    if (typeof body === 'string') return JSON.parse(body);
    if (body instanceof Uint8Array) return JSON.parse(Buffer.from(body).toString('utf8'));
    if (typeof body === 'object') return body;
    return {};
  } catch {
    return {};
  }
}

/** Identité du lecteur (cookie de session synthétique), ou null pour un invité. */
function callerFromAuth(headers) {
  const user = userFromAuth(headers);
  return user && !user.is_anonymous ? user : user;
}

/**
 * `is_carnet_participant(p_carnet)` : le chargeur de fiche (RGPD, non appliqué en
 * prod) demande au serveur si le lecteur participe au carnet avant de lire les
 * positions brutes. Participant = auteur ou ligne de `carnet_collaborators`.
 * Un lecteur anonyme n'est jamais participant.
 */
function isCarnetParticipant(carnetId, headers) {
  const user = callerFromAuth(headers);
  if (!user || user.is_anonymous) return false;
  const carnet = (TABLES.carnets || []).find((row) => row.id === carnetId);
  if (carnet && carnet.author_id === user.id) return true;
  return (TABLES.carnet_collaborators || []).some(
    (row) => row.carnet_id === carnetId && row.user_id === user.id,
  );
}

async function handleSupabase(url, init, headers) {
  if (url.pathname === '/rest/v1/carnets' && url.search.includes(LOADING_ID)) {
    await new Promise((resolve) => setTimeout(resolve, 6000));
  }
  const method = (init.method || 'GET').toUpperCase();
  if (url.pathname.startsWith('/auth/v1/user')) {
    const user = userFromAuth(headers);
    return user ? json(user) : json({ message: 'invalid JWT' }, 401);
  }
  if (url.pathname.startsWith('/auth/v1/')) return json({ message: 'fixture' }, 400);
  if (url.pathname.startsWith('/rest/v1/rpc/')) {
    const rpcName = url.pathname.slice('/rest/v1/rpc/'.length);
    if (rpcName === 'is_carnet_participant') {
      const args = { ...bodyJson(init), ...Object.fromEntries(url.searchParams) };
      return json(isCarnetParticipant(args.p_carnet ?? args.p_carnet_id ?? null, headers), 200);
    }
    return json(null, 200);
  }
  const m = /^\/rest\/v1\/([a-z_]+)$/.exec(url.pathname);
  if (!m) return json({ message: 'fixture: route inconnue' }, 404);
  if (method !== 'GET' && method !== 'HEAD') return json([], 201);
  /* Vue publique des sorties (RGPD, non appliquée en prod) : le visiteur lit
     `hike_sessions_public` ; le fixture sert les mêmes lignes (la vue réelle
     simplifie le tracé, ce que l'écran ne distingue pas). */
  const tableName = m[1] === 'hike_sessions_public' ? 'hike_sessions' : m[1];
  /* Carnet « stories » : mêmes données que le carnet de référence, mais ses photos et vidéos portent une image
     servie par l'app elle-même (aucun réseau) : une story a besoin d'un média, les autres scénarios non
     (leurs cartes restent des illustrations, comme dans la maquette). */
  const aliased = url.search.includes(STORIES_ID);
  const params = new URLSearchParams(url.searchParams);
  if (aliased) for (const [key, value] of params) params.set(key, value.split(STORIES_ID).join(CARNET_ID));
  /* Recette des états vide/erreur du hub (`tests/e2e/carnets-hub.spec.ts`) :
     deux serveurs du MÊME build rejouent le hub avec FIDELITY_HUB_STATE=empty
     ou `error`. Seule la liste des carnets est touchée (les lectures par id de
     la fiche continuent de fonctionner). */
  const hubState = process.env.FIDELITY_HUB_STATE || '';
  if (tableName === 'carnets' && !params.has('id') && (hubState === 'empty' || hubState === 'error')) {
    if (hubState === 'error') {
      return json(
        { code: 'PGRST500', message: 'fixture: erreur simulée de la liste des carnets', details: null, hint: null },
        500,
      );
    }
    return json([]);
  }
  const all = TABLES[tableName] || [];
  let rows = applyFilters(all, params);
  if (aliased && tableName === 'carnets') rows = rows.map((r) => ({ ...r, id: STORIES_ID }));
  if (aliased && tableName === 'carnet_moments') {
    rows = rows.map((r) => (r.moment_type === 'photo' || r.moment_type === 'video' ? { ...r, image_url: '/assets/images/account-bg.webp' } : r));
  }
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
    if (url.hostname === HOST) {
      return await handleSupabase(
        url,
        { method: init.method || (typeof input === 'object' && input.method) || 'GET', body: init.body },
        headers,
      );
    }
    if (url.hostname === 'api.open-meteo.com') return handleElevation(url);
  } catch {
    /* tombe sur le vrai fetch */
  }
  return realFetch(input, init);
};

/* Carnet « chargement » : mêmes données, mais la ligne `carnets` n'arrive qu'après 6 s.
   Les deux alias de scénarios sont privés et portés par un auteur fantôme : ils ne
   doivent apparaître ni dans le Monde, ni dans les Suivis, ni dans « Les miens » du
   hub, sinon les captures du hub montreraient trois fois le même carnet. */
TABLES.carnets.push({ ...TABLES.carnets[0], id: LOADING_ID, visibility: 'private', author_id: ALIAS_AUTHOR });
TABLES.carnets.push({ ...TABLES.carnets[0], id: STORIES_ID, visibility: 'private', author_id: ALIAS_AUTHOR });

module.exports = {
  STORIES_ID, LOADING_ID, CARNET_ID, OWNER_ID, TABLES,
  HUB_EN_ROUTE_ID, HUB_EN_ROUTE_PHOTOS_ID, HUB_PREPARATION_ID, HUB_RENTRE_ID,
  HUB_RENTRE_NO_PHOTO_ID, HUB_MINE_ID, HUB_AUTHOR_A, HUB_AUTHOR_B,
};
