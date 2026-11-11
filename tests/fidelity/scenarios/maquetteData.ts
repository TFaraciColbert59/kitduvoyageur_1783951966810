/**
 * Jeu de données EXACT de la maquette Communauté v2 (`maquette-communaute.html`,
 * `LKD.CLUBS` L1853 et `LKD.SORTIES` L1869), rendu sous la forme des RPC que consomme l'app
 * (`community_clubs_feed`, `community_events_feed`, `/api/weather`).
 *
 * Pourquoi : le banc compare une structure, pas deux jeux d'exemple différents. Les fixtures
 * de recette (`docs/audit/.../integration/fixtures.mjs`) servent les tests e2e (noms, états et
 * identifiants y sont figés) : on ne les modifie pas, le scénario remplace seulement la réponse
 * de la RPC (voir `Scenario.app.rpc`).
 *
 * Horloge figée du banc : 2026-11-08 14:00 (Europe/Paris). `dOff` de la maquette = décalage en
 * jours depuis le 8 novembre 2026.
 */

const NOW = Date.parse('2026-11-08T14:00:00+01:00');
const HOUR = 3_600_000;

function isoDay(dOff: number): string {
  // 2026-11-08 + dOff, calendrier civil (pas de changement d'heure en novembre après le 25/10).
  return new Date(Date.UTC(2026, 10, 8 + dOff)).toISOString().slice(0, 10);
}

const PEOPLE: Record<string, string> = {
  C: 'Camille D.',
  L: 'Léo M.',
  I: 'Inès R.',
  M: 'Marc B.',
  J: 'Julie F.',
  A: 'Antoine P.',
  N: 'Nora S.',
  T: 'Théo G.',
};

/** Format « personnes » des RPC : `total` (toutes) + `avatars` (3 premières). */
function people(letters: string[]) {
  return {
    total: letters.length,
    avatars: letters.slice(0, 3).map((letter, index) => ({
      id: `00000000-0000-4000-8000-0000000000${letter.charCodeAt(0).toString(16)}${index}`,
      name: PEOPLE[letter],
      avatar: null,
    })),
  };
}

interface MaquetteClub {
  id: string;
  slug: string;
  n: string;
  act: 'rando' | 'ski' | 'velo' | 'escalade' | 'trail';
  place: string;
  members: number;
  valid: boolean;
  near: number;
  /** Âge de la dernière publication, en heures (« il y a 2 h » = 2, « hier » = 30…). */
  lastH: number;
  sm: number;
  friends: string[];
  member?: boolean;
}

/** Ordre de la maquette (L1853), état d'adhésion : `k2` et `k8` membres (`member:true`), aucun en attente. */
const MAQUETTE_CLUBS: MaquetteClub[] = [
  { id: 'k1', slug: 'cordee-du-vercors', n: 'La Cordée du Vercors', act: 'rando', place: 'Grenoble', members: 312, valid: false, near: 4, lastH: 2, sm: 5, friends: ['M', 'J', 'A'] },
  { id: 'k2', slug: 'ski-de-rando-alpes', n: 'Ski de rando Alpes', act: 'ski', place: 'Chamonix', members: 1280, valid: true, near: 8, lastH: 30, sm: 9, friends: ['L', 'C'], member: true },
  { id: 'k3', slug: 'velo-gravel-lyon', n: 'Gravel Lyon', act: 'velo', place: 'Lyon', members: 540, valid: false, near: 110, lastH: 3 * 24 + 2, sm: 3, friends: [] },
  { id: 'k4', slug: 'grimpeurs-fontainebleau', n: 'Blocs de Fontainebleau', act: 'escalade', place: 'Fontainebleau', members: 96, valid: true, near: 420, lastH: 8 * 24, sm: 1, friends: ['T'] },
  { id: 'k5', slug: 'trail-des-aravis', n: 'Trail des Aravis', act: 'trail', place: 'Annecy', members: 221, valid: false, near: 35, lastH: 5, sm: 6, friends: ['N', 'M'] },
  { id: 'k6', slug: 'alpinisme-ecrins', n: 'Alpinistes des Écrins', act: 'rando', place: 'Briançon', members: 176, valid: true, near: 60, lastH: 2 * 24 + 2, sm: 2, friends: ['C'] },
  { id: 'k7', slug: 'rando-bretagne', n: 'GR34 entre amis', act: 'rando', place: 'Rennes', members: 64, valid: false, near: 980, lastH: 4 * 24 + 2, sm: 2, friends: [] },
  { id: 'k8', slug: 'velo-route-pyrenees', n: 'Cols des Pyrénées', act: 'velo', place: 'Pau', members: 402, valid: false, near: 700, lastH: 6, sm: 7, friends: ['I'], member: true },
];

/** Clé de tri « activité » de la maquette (`lastTs`) : publication la plus récente d'abord. */
const CLUB_ORDER = ['k1', 'k5', 'k8', 'k2', 'k6', 'k3', 'k7', 'k4'];

const CLUB_CATEGORY: Record<MaquetteClub['act'], string> = {
  rando: 'rando',
  ski: 'ski-rando',
  velo: 'velo',
  escalade: 'escalade',
  trail: 'trail',
};

export const MAQUETTE_CLUB_ROWS = CLUB_ORDER.map((id, rank) => {
  const c = MAQUETTE_CLUBS.find((club) => club.id === id) as MaquetteClub;
  return {
    id: `b0000000-0000-4000-8000-0000000000${id.slice(1).padStart(2, '0')}`,
    slug: c.slug,
    name: c.n,
    emoji: null,
    // `valid` = adhésion sur validation : cadenas (et libellé « Demander à rejoindre »).
    privacy: c.valid ? 'closed' : 'open',
    cover_image: null,
    cover_color: null,
    category: CLUB_CATEGORY[c.act],
    activities: [CLUB_CATEGORY[c.act]],
    location_label: c.place,
    members_count: c.members,
    is_verified: c.valid,
    my_status: c.member ? 'member' : 'none',
    events_this_month: c.sm,
    last_post_at: new Date(NOW - c.lastH * HOUR).toISOString(),
    friends: people(c.friends),
    lat: 45 + rank / 10,
    lng: 5,
    distance_km: c.near,
    sort_key: 100 - rank,
  };
});

interface MaquetteSortie {
  id: string;
  t: string;
  dOff: number;
  hh: string;
  act: 'rando' | 'ski' | 'velo' | 'escalade' | 'trail';
  level: 'Facile' | 'Moyen' | 'Difficile';
  km: number;
  dp: number;
  dur: number;
  cap: number;
  taken: number;
  wl: boolean;
  place: string;
  friends: string[];
  near: number;
  w: 'sun' | 'partly' | 'cloud' | 'rain' | 'snow';
  tmin: number;
  tmax: number;
  past?: boolean;
  /** `s2` : l'utilisateur est inscrit (`SORTIES.forEach(... s.reg = 'in')`). */
  reg?: 'in';
}

/** Ordre de la maquette (L1869). */
const MAQUETTE_SORTIES: MaquetteSortie[] = [
  { id: 's1', t: 'Lac Blanc au lever du jour', dOff: 6, hh: '06:30', act: 'rando', level: 'Facile', km: 9.8, dp: 710, dur: 5, cap: 12, taken: 9, wl: true, place: 'Chamonix', friends: ['L', 'M'], near: 6, w: 'partly', tmin: -3, tmax: 4 },
  { id: 's2', t: 'Sortie ski de rando : col des Aiguilles', dOff: 7, hh: '07:00', act: 'ski', level: 'Difficile', km: 14, dp: 1350, dur: 7, cap: 8, taken: 8, wl: true, place: 'Saint-Véran', friends: ['C'], near: 30, w: 'snow', tmin: -9, tmax: -2, reg: 'in' },
  { id: 's3', t: 'Footing de la Bastille', dOff: 1, hh: '18:30', act: 'trail', level: 'Facile', km: 7, dp: 260, dur: 1.5, cap: 20, taken: 6, wl: false, place: 'Grenoble', friends: [], near: 3, w: 'cloud', tmin: 4, tmax: 9 },
  { id: 's4', t: 'Gravel des monts du Lyonnais', dOff: 9, hh: '09:00', act: 'velo', level: 'Moyen', km: 72, dp: 1100, dur: 5, cap: 15, taken: 11, wl: true, place: 'Lyon', friends: ['T'], near: 110, w: 'sun', tmin: 6, tmax: 13 },
  { id: 's5', t: 'Bivouac du Beaufortain', dOff: 13, hh: '08:00', act: 'rando', level: 'Moyen', km: 22, dp: 1500, dur: 9, cap: 6, taken: 3, wl: false, place: 'Beaufort', friends: ['M', 'J'], near: 64, w: 'rain', tmin: 1, tmax: 7 },
  { id: 's6', t: 'Grande traversée de Belledonne', dOff: 20, hh: '06:00', act: 'rando', level: 'Difficile', km: 31, dp: 2200, dur: 11, cap: 10, taken: 4, wl: true, place: 'Belledonne', friends: [], near: 45, w: 'sun', tmin: 0, tmax: 6 },
  { id: 's7', t: 'Bloc débutants à Bas Cuvier', dOff: 3, hh: '10:00', act: 'escalade', level: 'Facile', km: 2, dp: 80, dur: 3, cap: 10, taken: 5, wl: false, place: 'Fontainebleau', friends: [], near: 420, w: 'cloud', tmin: 5, tmax: 10 },
  { id: 's8', t: 'Lac Blanc, sortie d’automne', dOff: -12, hh: '07:00', act: 'rando', level: 'Facile', km: 10, dp: 700, dur: 5, cap: 12, taken: 12, wl: false, place: 'Chamonix', friends: ['L'], near: 6, w: 'sun', tmin: 2, tmax: 8, past: true },
];

const WEATHER_LABEL: Record<MaquetteSortie['w'], string> = {
  sun: 'Ensoleillé',
  partly: 'Éclaircies',
  cloud: 'Nuageux',
  rain: 'Pluie',
  snow: 'Neige',
};
const WEATHER_CODE: Record<MaquetteSortie['w'], number> = { sun: 0, partly: 2, cloud: 3, rain: 61, snow: 71 };

/** Latitude propre à chaque sortie : la route `/api/weather` du banc retrouve la sortie par sa latitude. */
const eventLat = (index: number) => Number((44 + index * 0.1).toFixed(4));

export const MAQUETTE_EVENT_ROWS = MAQUETTE_SORTIES.map((s, index) => {
  const start = `${isoDay(s.dOff)}T${s.hh}:00+01:00`;
  const end = new Date(Date.parse(start) + s.dur * HOUR);
  const full = s.taken >= s.cap;
  return {
    id: `e0000000-0000-4000-8000-0000000000${s.id.slice(1).padStart(2, '0')}`,
    title: s.t,
    activity: s.act,
    emoji: null,
    organizer_id: '22222222-2222-4222-8222-222222222222',
    organizer_name: 'Organisateur',
    organizer_avatar: null,
    event_date: isoDay(s.dOff),
    starts_at: start,
    ends_at: end.toISOString(),
    location: s.place,
    meeting_point: null,
    level: s.level.toLowerCase(),
    route_distance_km: s.km,
    elevation_gain_m: s.dp,
    max_participants: s.cap,
    current_participants: s.taken,
    spots_left: Math.max(0, s.cap - s.taken),
    waitlist_enabled: s.wl,
    status: s.past ? 'completed' : full ? 'full' : 'upcoming',
    cover_image: null,
    my_status: s.reg === 'in' ? 'registered' : 'none',
    friends: people(s.friends),
    lat: eventLat(index),
    lng: 5,
    distance_km: s.near,
    // Tri de la maquette : date croissante.
    sort_key: 1_000_000 + s.dOff,
  };
}).sort((a, b) => Number(a.sort_key) - Number(b.sort_key));

/** `/api/weather` : prévision du jour J de la maquette (`WX_L`, `tmin`/`tmax`), clé = latitude à 4 décimales. */
export const MAQUETTE_WEATHER_BY_LAT: Record<string, { label: string; code: number; tMaxC: number; tMinC: number }> = Object.fromEntries(
  MAQUETTE_SORTIES.map((s, index) => [eventLat(index).toFixed(4), { label: WEATHER_LABEL[s.w], code: WEATHER_CODE[s.w], tMaxC: s.tmax, tMinC: s.tmin }]),
);

/** Agenda de la maquette (`cnt(i)` : sorties à venir par jour, 14 jours depuis le 8 novembre) : lignes de `community_events_agenda`. */
export const MAQUETTE_AGENDA_ROWS = Array.from({ length: 14 }, (_, index) => ({
  day: isoDay(index),
  events_count: MAQUETTE_SORTIES.filter((s) => !s.past && s.dOff === index).length,
}));
