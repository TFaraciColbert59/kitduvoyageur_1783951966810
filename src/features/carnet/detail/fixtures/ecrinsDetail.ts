/**
 * Fiche « Tour des Écrins » pleine : le jeu de données de la maquette
 * (`handoff/carnet-v2/annexes/maquette-fiche-carnet.html`, `DAYS`, `M0`,
 * `ITEMS`, `CREW`) exprimé dans le contrat réel `CarnetDetail`.
 *
 * Sert à deux choses seulement : les tests Vitest/Playwright (une fiche pleine
 * est comparable à la maquette pleine) et le banc `/dev/carnet-v2`
 * (introuvable hors `next dev`). Ce n'est pas une donnée de production.
 *
 * Géométrie : les tracés schématiques de la maquette (400×240) sont projetés
 * sur le massif des Écrins ; les altitudes viennent des profils de la maquette,
 * interpolés le long de chaque jour.
 */
import type {
  CarnetBudgetItem,
  CarnetDay,
  CarnetDayPoint,
  CarnetDetail,
  CarnetEtapeDay,
  CarnetKitItemRow,
  CarnetMomentItem,
  CarnetNightItem,
  CarnetParticipant,
  ElevationPoint,
  KitVerdictType,
} from '../types';
import type { MomentMeta, MomentType } from '../momentTypes';

type Pt = [number, number];

interface DaySpec {
  n: number;
  from: string;
  to: string;
  km: number;
  dp: number;
  min: number;
  date: string;
  weather: string;
  pts: Pt[];
  alt: number[];
  note: string;
  night: { type: CarnetNightItem['type']; name: string; alt: number; info: string } | null;
  expenses: Array<[string, string, number]>;
  likes: number;
}

const DAY_SPECS: DaySpec[] = [
  {
    n: 1,
    from: 'La Bérarde',
    to: 'Refuge du Pigeonnier',
    km: 17,
    dp: 1240,
    min: 400,
    date: '2026-07-13',
    weather: 'Éclaircies · 11 °C',
    pts: [[30, 205], [60, 188], [85, 194], [110, 170], [135, 160], [150, 140]],
    alt: [1738, 1850, 2020, 1960, 2150, 2330, 2260, 2450, 2520, 2410],
    note: 'Départ tranquille, le vallon sent le mélèze.',
    night: { type: 'refuge', name: 'Refuge du Pigeonnier', alt: 2410, info: 'Demi-pension, dortoir de 12' },
    expenses: [['Casse-croûte', 'Repas', 14], ['Navette La Bérarde', 'Transport', 36], ['Demi-pension × 3', 'Hébergement', 174]],
    likes: 31,
  },
  {
    n: 2,
    from: 'Refuge du Pigeonnier',
    to: 'Vallouise',
    km: 18.4,
    dp: 1080,
    min: 430,
    date: '2026-07-14',
    weather: 'Éclaircies · 14 °C',
    pts: [[150, 140], [175, 120], [190, 135], [215, 118], [240, 128], [255, 105]],
    alt: [2410, 2300, 2425, 2250, 2050, 1850, 1620, 1420, 1290, 1160],
    note: 'Le berger nous a montré le passage à gué.',
    night: { type: 'gite', name: 'Gîte des Claux, Vallouise', alt: 1160, info: 'Chambre de 3, douche chaude' },
    expenses: [['Courses et pique-nique', 'Repas', 56], ['Gîte × 3', 'Hébergement', 156]],
    likes: 42,
  },
  {
    n: 3,
    from: 'Vallouise',
    to: 'Lac de la Muzelle',
    km: 22,
    dp: 1340,
    min: 500,
    date: '2026-07-15',
    weather: 'Grand soleil · 16 °C',
    pts: [[255, 105], [280, 90], [300, 100], [320, 75], [340, 62], [335, 40]],
    alt: [1160, 1300, 1580, 1910, 2230, 2520, 2390, 2250, 2160, 2105],
    note: 'Brume au départ, bivouac au-dessus des nuages.',
    night: { type: 'bivouac', name: 'Bivouac au Lac de la Muzelle', alt: 2105, info: 'Tente, pas de feu, eau du lac filtrée' },
    expenses: [['Ravitaillement', 'Repas', 31], ['Recharge du réchaud', 'Matériel', 15], ['Redevance bivouac', 'Hébergement', 22]],
    likes: 38,
  },
  {
    n: 4,
    from: 'Lac de la Muzelle',
    to: 'La Bérarde',
    km: 15,
    dp: 860,
    min: 350,
    date: '2026-07-16',
    weather: 'Nuageux · 12 °C',
    pts: [[335, 40], [300, 26], [255, 42], [210, 26], [160, 44], [110, 62], [70, 100], [45, 150], [34, 196]],
    alt: [2105, 2350, 2580, 2400, 2150, 1900, 1700, 1850, 1750, 1738],
    note: 'Dernière ligne droite vers La Bérarde.',
    night: null,
    expenses: [['Repas au refuge', 'Repas', 26], ['Train et navette retour', 'Transport', 54]],
    likes: 17,
  },
];

const IMAGES = {
  alps: '/assets/images/detail-hero.jpg',
  forest: '/assets/images/forest-1.jpg',
  meadow: '/assets/images/community-morning.jpg',
  lake: '/assets/images/lake-1.jpg',
  ridge: '/assets/images/adventure-hiking.jpg',
  dusk: '/assets/images/adventure-bivouac.jpg',
} as const;

type Ph = keyof typeof IMAGES;

interface MomentSpec {
  id: string;
  day: number;
  time: string;
  type: MomentType;
  place: string;
  by: 'C' | 'L' | 'I';
  ph?: Ph;
  caption?: string;
  meta?: MomentMeta;
}

const MOMENT_SPECS: MomentSpec[] = [
  { id: 'm01', day: 1, time: '07:10', type: 'photo', place: 'La Bérarde · 1 738 m', by: 'L', ph: 'alps' },
  { id: 'm02', day: 1, time: '08:20', type: 'photo', place: 'Forêt de mélèzes', by: 'L', ph: 'forest' },
  { id: 'm03', day: 1, time: '09:05', type: 'species', place: 'Vallon du Chardon', by: 'C', caption: 'Bouquetin des Alpes', meta: { latin: 'Capra ibex' } },
  { id: 'm04', day: 1, time: '11:30', type: 'kit', place: 'Plan de Lanchâtra', by: 'C', caption: 'Bâtons carbone', meta: { itemId: 'batons' } },
  { id: 'm05', day: 1, time: '11:40', type: 'photo', place: 'Pause au Plan de Lanchâtra', by: 'L', ph: 'meadow' },
  { id: 'm06', day: 1, time: '13:20', type: 'spend', place: 'Plan de Lanchâtra', by: 'L', caption: 'Casse-croûte', meta: { amountEur: 14, category: 'Repas' } },
  { id: 'm07', day: 1, time: '16:45', type: 'voice', place: 'Refuge du Pigeonnier', by: 'C', caption: 'Arrivés, ça souffle.', meta: { durationLabel: '0:42' } },
  { id: 'm08', day: 2, time: '07:42', type: 'photo', place: 'Aube sur la moraine', by: 'L', ph: 'ridge' },
  { id: 'm09', day: 2, time: '09:45', type: 'voice', place: 'Col de l’Eychauda', by: 'I', caption: 'On est au col.', meta: { durationLabel: '0:38' } },
  { id: 'm10', day: 2, time: '11:02', type: 'kit', place: 'Lac de l’Eychauda', by: 'I', caption: 'Filtre à eau', meta: { itemId: 'filtre' } },
  { id: 'm11', day: 2, time: '11:20', type: 'photo', place: 'Lac de l’Eychauda', by: 'L', ph: 'lake' },
  { id: 'm12', day: 2, time: '12:30', type: 'spend', place: 'Pré de l’Alp', by: 'L', caption: 'Pique-nique pour trois', meta: { amountEur: 38, category: 'Repas' } },
  { id: 'm13', day: 2, time: '13:50', type: 'video', place: 'Torrent de l’Eychauda', by: 'C', ph: 'lake', meta: { durationLabel: '0:24' } },
  { id: 'm14', day: 2, time: '14:20', type: 'meet', place: 'Vallouise', by: 'C', caption: 'Le berger nous a montré le passage à gué.', meta: { who: 'Marc, berger' } },
  { id: 'm15', day: 3, time: '06:50', type: 'text', place: 'Vallouise', by: 'L', caption: 'Brume dans la vallée, on part tôt. Léo a mal au talon.' },
  { id: 'm16', day: 3, time: '09:30', type: 'species', place: 'Chalet des Prés', by: 'I', caption: 'Edelweiss', meta: { latin: 'Leontopodium nivale' } },
  { id: 'm17', day: 3, time: '11:40', type: 'inc', place: 'Passage du couloir', by: 'C', caption: 'Chute de pierres dans le couloir. Personne touché, détour de vingt minutes.' },
  { id: 'm18', day: 3, time: '13:40', type: 'photo', place: 'Arête de la Muzelle', by: 'L', ph: 'ridge' },
  { id: 'm19', day: 3, time: '14:10', type: 'kit', place: 'Col de la Muzelle', by: 'I', caption: 'Guêtres', meta: { itemId: 'guetres' } },
  { id: 'm20', day: 3, time: '15:20', type: 'video', place: 'Lac de la Muzelle', by: 'L', ph: 'dusk', meta: { durationLabel: '0:31' } },
  { id: 'm21', day: 3, time: '20:30', type: 'photo', place: 'Bivouac au crépuscule', by: 'L', ph: 'dusk' },
  { id: 'm22', day: 4, time: '07:20', type: 'photo', place: 'Lac de la Muzelle', by: 'C', ph: 'meadow' },
  { id: 'm23', day: 4, time: '08:45', type: 'photo', place: 'Dernier col', by: 'L', ph: 'alps' },
  { id: 'm24', day: 4, time: '09:30', type: 'species', place: 'Col des Clots', by: 'L', caption: 'Chocard à bec jaune', meta: { latin: 'Pyrrhocorax graculus' } },
  { id: 'm25', day: 4, time: '10:20', type: 'meet', place: 'Chalet-refuge du Chardon', by: 'C', caption: 'Prenez le sentier haut, l’autre est coupé.', meta: { who: 'La gardienne du chalet' } },
  { id: 'm26', day: 4, time: '10:40', type: 'spend', place: 'Chalet-refuge du Chardon', by: 'I', caption: 'Repas au refuge', meta: { amountEur: 26, category: 'Repas' } },
  { id: 'm27', day: 4, time: '11:10', type: 'kit', place: 'Pont de la Pierre', by: 'L', caption: 'Réchaud', meta: { itemId: 'rechaud' } },
  { id: 'm28', day: 4, time: '11:55', type: 'photo', place: 'Descente en forêt', by: 'L', ph: 'forest' },
];

const CREW = {
  C: { userId: 'u-camille', name: 'Camille', handle: 'camille', role: 'author' as const },
  L: { userId: 'u-leo', name: 'Léo', handle: 'leo', role: 'collaborator' as const },
  I: { userId: 'u-ines', name: 'Inès', handle: 'ines', role: 'participant' as const },
};

interface ItemSpec {
  id: string;
  name: string;
  cat: string;
  g: number;
  v: KitVerdictType;
  d: number[];
  note?: string;
}

const ITEM_SPECS: ItemSpec[] = [
  { id: 'sac', name: 'Sac 45 L', cat: 'Portage', g: 1150, v: 'essentiel', d: [1, 2, 3, 4] },
  { id: 'batons', name: 'Bâtons carbone', cat: 'Portage', g: 440, v: 'essentiel', d: [1, 3] },
  { id: 'tente', name: 'Tente 2 places', cat: 'Abri', g: 1380, v: 'defaillant', d: [3], note: 'fermeture cassée' },
  { id: 'duvet', name: 'Duvet 0 °C', cat: 'Abri', g: 780, v: 'utile', d: [3] },
  { id: 'matelas', name: 'Matelas isolant', cat: 'Abri', g: 420, v: 'utile', d: [3] },
  { id: 'rechaud', name: 'Réchaud', cat: 'Cuisine', g: 360, v: 'jamais_servi', d: [3, 4] },
  { id: 'popote', name: 'Popote', cat: 'Cuisine', g: 210, v: 'utile', d: [3] },
  { id: 'veste', name: 'Veste imperméable', cat: 'Vêtements', g: 320, v: 'utile', d: [2, 4] },
  { id: 'polaire', name: 'Polaire', cat: 'Vêtements', g: 280, v: 'essentiel', d: [1, 3] },
  { id: 'guetres', name: 'Guêtres', cat: 'Vêtements', g: 0, v: 'manquait', d: [3], note: 'à prévoir, environ 180 g' },
  { id: 'frontale', name: 'Frontale', cat: 'Électronique', g: 85, v: 'essentiel', d: [3] },
  { id: 'batterie', name: 'Batterie externe', cat: 'Électronique', g: 240, v: 'utile', d: [2] },
  { id: 'filtre', name: 'Filtre à eau', cat: 'Sécurité', g: 65, v: 'utile', d: [2] },
  { id: 'trousse', name: 'Trousse de secours', cat: 'Sécurité', g: 290, v: 'jamais_servi', d: [1, 3] },
];

/** Projette un point schématique (x,y) de la maquette sur le massif. */
function project([x, y]: Pt): { lat: number; lng: number } {
  return {
    lng: Number((6.2 + ((x - 30) / 310) * 0.4).toFixed(5)),
    lat: Number((45.02 - ((y - 26) / 180) * 0.18).toFixed(5)),
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Échantillonne la polyligne d'un jour en `count` points avec altitude. */
function sampleDay(
  spec: DaySpec,
  count = 18,
): Array<{ lat: number; lng: number; elevationM: number }> {
  const out: Array<{ lat: number; lng: number; elevationM: number }> = [];
  const segs = spec.pts.length - 1;
  for (let i = 0; i < count; i += 1) {
    const f = i / (count - 1);
    const pos = f * segs;
    const s = Math.min(segs - 1, Math.floor(pos));
    const t = pos - s;
    const a = project(spec.pts[s]);
    const b = project(spec.pts[s + 1]);
    const af = f * (spec.alt.length - 1);
    const ai = Math.min(spec.alt.length - 2, Math.floor(af));
    out.push({
      lat: Number(lerp(a.lat, b.lat, t).toFixed(5)),
      lng: Number(lerp(a.lng, b.lng, t).toFixed(5)),
      elevationM: Math.round(lerp(spec.alt[ai], spec.alt[ai + 1], af - ai)),
    });
  }
  return out;
}

export interface EcrinsFixtureOptions {
  /** `visitor` : lecteur connecté non participant (pas de budget, position floue). */
  role?: 'participant' | 'visitor';
  /** Carnet sans aucun moment (états vides). */
  empty?: boolean;
}

export function buildEcrinsDetail(options: EcrinsFixtureOptions = {}): CarnetDetail {
  const role = options.role ?? 'participant';
  const empty = options.empty === true;
  const isParticipant = role === 'participant';

  const participants: CarnetParticipant[] = (['C', 'L', 'I'] as const).map((key) => ({
    userId: CREW[key].userId,
    id: CREW[key].userId,
    name: CREW[key].name,
    handle: CREW[key].handle,
    avatarUrl: null,
    role: CREW[key].role,
  }));

  const moments: CarnetMomentItem[] = empty
    ? []
    : MOMENT_SPECS.map((spec) => ({
        id: spec.id,
        dayNumber: spec.day,
        time: spec.time,
        caption: spec.caption ?? null,
        authorName: CREW[spec.by].name,
        authorId: CREW[spec.by].userId,
        place: spec.place,
        imageUrl: spec.ph ? IMAGES[spec.ph] : null,
        title: spec.place,
        type: spec.type,
        meta: spec.meta ?? null,
      }));

  const sampled = DAY_SPECS.map((spec) => sampleDay(spec));
  const t0 = Date.parse('2026-07-13T06:00:00Z');

  const days: CarnetDay[] = DAY_SPECS.map((spec, index) => {
    const points: CarnetDayPoint[] = sampled[index].map((p, i) => ({
      lat: p.lat,
      lng: p.lng,
      at: new Date(t0 + index * 86_400_000 + i * 20 * 60_000).toISOString(),
    }));
    return {
      index: spec.n,
      dayNumber: spec.n,
      date: spec.date,
      distanceKm: spec.km,
      elevationM: spec.dp,
      durationS: spec.min * 60,
      moments: moments.filter((m) => m.dayNumber === spec.n),
      points,
    };
  });

  const etapes: CarnetEtapeDay[] = DAY_SPECS.map((spec) => ({
    id: `etape-${spec.n}`,
    dayNumber: spec.n,
    label: `JOUR ${spec.n} · ${spec.from} → ${spec.to}`,
    from: spec.from,
    to: spec.to,
    note: spec.note,
    distanceKm: spec.km,
    elevationM: spec.dp,
    durationText: `${Math.floor(spec.min / 60)} h ${String(spec.min % 60).padStart(2, '0')}`,
    weather: spec.weather,
    overnight: spec.night?.name ?? null,
  }));

  const nights: CarnetNightItem[] = DAY_SPECS.flatMap((spec, index) => {
    if (!spec.night) return [];
    const last = sampled[index][sampled[index].length - 1];
    return [
      {
        id: `night-${spec.n}`,
        dayNumber: spec.n,
        name: spec.night.name,
        type: spec.night.type,
        altitudeM: spec.night.alt,
        infos: spec.night.info,
        lat: last.lat,
        lng: last.lng,
        mapRefugeId: null,
      },
    ];
  });

  const elevationProfile: ElevationPoint[] = [];
  let cumulative = 0;
  DAY_SPECS.forEach((spec, index) => {
    const samples = sampled[index];
    samples.forEach((p, i) => {
      elevationProfile.push({
        distanceKm: Number((cumulative + (spec.km * i) / (samples.length - 1)).toFixed(2)),
        elevationM: p.elevationM,
        lat: p.lat,
        lng: p.lng,
      });
    });
    cumulative += spec.km;
  });

  const totalKm = DAY_SPECS.reduce((sum, spec) => sum + spec.km, 0);
  const totalDp = DAY_SPECS.reduce((sum, spec) => sum + spec.dp, 0);

  const kitItems: CarnetKitItemRow[] = ITEM_SPECS.map((item) => ({
    id: item.id,
    name: item.name,
    detail: item.cat,
    weightG: item.g > 0 ? item.g : null,
    color: null,
    verdict: item.v,
    verdictNote: item.note ?? null,
    joursUtilises: item.d,
  }));
  const carried = ITEM_SPECS.filter((item) => item.v !== 'manquait');

  const budgetItems: CarnetBudgetItem[] = DAY_SPECS.flatMap((spec) =>
    spec.expenses.map(([label, category, amount], i) => ({
      id: `b-${spec.n}-${i}`,
      label,
      amount,
      amountCents: amount * 100,
      currency: 'EUR',
      category,
      date: spec.date,
    })),
  );
  const budgetTotal = budgetItems.reduce((sum, item) => sum + (item.amount ?? 0), 0);

  const coordinates = sampled.flatMap((samples) =>
    samples.map((p) => [p.lng, p.lat, p.elevationM]),
  );
  const start = project(DAY_SPECS[0].pts[0]);

  return {
    id: 'carnet-ecrins-fixture',
    title: 'Tour des Écrins',
    destination: 'Boucle depuis La Bérarde',
    description:
      'Quatre jours autour du massif des Écrins, du vallon de la Bérarde au lac de la Muzelle.',
    coverImage: IMAGES.alps,
    coverImageAlt: 'Massif des Écrins',
    startDate: '2026-07-13',
    endDate: '2026-07-16',
    dateRange: '13 — 16 juil. 2026',
    visibility: 'public',
    isPublic: true,
    verified: true,
    isOwner: isParticipant,
    author: {
      id: CREW.C.userId,
      name: 'Camille',
      handle: 'camille',
      avatarUrl: null,
      trustScore: 92,
    },
    participants,
    stats: [
      { key: 'distance', label: 'DISTANCE', value: `${totalKm.toFixed(1)} km` },
      { key: 'elevation', label: 'DÉNIVELÉ +', value: `${totalDp} m` },
      { key: 'days', label: 'JOURS', value: '4' },
    ],
    engagement: { likes: 128, comments: 4, views: 840, liked: false, favorited: false },
    likers: [],
    moments,
    photoMoments: moments.filter((m) => Boolean(m.imageUrl)),
    days,
    etapes,
    summary: { distanceKm: totalKm, elevationM: totalDp, days: 4, moments: moments.length },
    kit: {
      totalWeightG: carried.reduce((sum, item) => sum + item.g, 0),
      items: kitItems,
    },
    trace: { type: 'LineString', coordinates },
    elevationProfile,
    place: {
      country: 'France',
      region: 'Auvergne-Rhône-Alpes',
      locality: 'Massif des Écrins',
      lat: start.lat,
      lng: start.lng,
    },
    distanceKm: totalKm,
    elevationM: totalDp,
    viewerRole: role,
    nights,
    dayReactions: Object.fromEntries(
      DAY_SPECS.map((spec) => [
        spec.n,
        { dayNumber: spec.n, likesCount: spec.likes, commentsCount: 0, userLiked: false },
      ]),
    ),
    momentEngagement: {},
    kitVerdicts: {},
    livePosition: null,
    publicZone: null,
    budget: isParticipant
      ? {
          total: budgetTotal,
          totalCents: budgetTotal * 100,
          currency: 'EUR',
          perPersonCents: Math.round((budgetTotal * 100) / 3),
          items: budgetItems,
        }
      : null,
    liveSharing: true,
  };
}
