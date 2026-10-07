/**
 * Meilleure période quand aucune date n'est donnée.
 *
 * Règles prudentes et explicables (saison, hémisphère, latitude, altitude,
 * activité, fréquentation), jamais une prévision. Les tropiques dépendent
 * d'une saison sèche locale : connue par pays (table), sinon aucune période
 * plutôt qu'une fausse certitude. La période retenue est toujours affichée et
 * modifiable (« Quand »).
 */

export interface PeriodInput {
  activity: string | null;
  lat: number | null;
  /** Code pays ISO (tropiques : saison sèche connue par pays). */
  countryCode?: string | null;
  /** Altitude maximale connue (m), si mesurée. */
  maxAltitudeM?: number | null;
  /** Aujourd'hui (AAAA-MM-JJ). */
  today: string;
  days: number;
}

export interface BestPeriod {
  /** 1-12 */
  month: number;
  start: string;
  end: string;
  why: string;
}

const MONTH_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

export function monthName(m: number): string {
  return MONTH_FR[(m - 1 + 12) % 12];
}

/** Mois conseillé dans l'hémisphère nord (le sud est décalé de six mois). */
function northernMonth(input: PeriodInput): { month: number; why: string } | null {
  const act = input.activity ?? '';
  const lat = Math.abs(input.lat ?? 45);
  const high = (input.maxAltitudeM ?? 0) >= 1800;
  if (act === 'ski') return { month: 2, why: 'enneigement le plus sûr, jours qui rallongent' };
  if (act === 'beach') return { month: 6, why: 'mer déjà chaude, moins de monde qu’en juillet-août' };
  if (act === 'citytrip' || act === 'cultural')
    return { month: 5, why: 'températures douces, avant l’affluence de l’été' };
  if (act === 'water') return { month: 7, why: 'eau la plus chaude, rivières encore en eau' };
  if (lat >= 58) return { month: 7, why: 'sentiers déneigés, jours les plus longs' };
  if (act === 'mountaineering') return { month: 7, why: 'conditions de glacier les plus stables' };
  if (high || lat >= 50) return { month: 9, why: 'sentiers déneigés, moins de monde qu’en août' };
  if (lat <= 38) return { month: 4, why: 'avant la chaleur de l’été' };
  return { month: 6, why: 'journées longues et douces, avant l’affluence de l’été' };
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function addDays(isoDate: string, n: number): string {
  const t = Date.parse(`${isoDate}T12:00:00Z`) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Prochaine occurrence du mois conseillé (au moins 3 semaines devant, pour
 * avoir le temps de préparer), départ le 1er samedi du mois.
 */
/**
 * Tropiques : la saison sèche, pays par pays (sources : climats généraux,
 * conseillée par les offices de tourisme), le mois le plus sûr au cœur de
 * cette saison. Un pays absent de la table : aucune période plutôt qu'une
 * fausse certitude.
 */
const TROPICAL_DRY: Record<string, { month: number; why: string }> = {
  PE: { month: 6, why: 'saison sèche dans les Andes (mai à septembre)' },
  BO: { month: 6, why: 'saison sèche dans les Andes (mai à septembre)' },
  EC: { month: 7, why: 'saison sèche dans les Andes (juin à septembre)' },
  CO: { month: 1, why: 'saison sèche (décembre à mars)' },
  VN: { month: 3, why: 'sec et doux au nord, saison sèche au sud' },
  TH: { month: 1, why: 'saison sèche et fraîche (novembre à février)' },
  KH: { month: 1, why: 'saison sèche et fraîche (novembre à février)' },
  LA: { month: 1, why: 'saison sèche et fraîche (novembre à février)' },
  MM: { month: 1, why: 'saison sèche et fraîche (novembre à février)' },
  IN: { month: 12, why: 'saison sèche et fraîche (novembre à mars)' },
  LK: { month: 2, why: 'saison sèche sur le sud et l’ouest (décembre à avril)' },
  PH: { month: 2, why: 'saison sèche (décembre à mai)' },
  ID: { month: 7, why: 'saison sèche (mai à septembre)' },
  KE: { month: 8, why: 'grande saison sèche (juin à octobre)' },
  TZ: { month: 8, why: 'grande saison sèche (juin à octobre)' },
  UG: { month: 7, why: 'saison sèche (juin à août)' },
  RW: { month: 7, why: 'saison sèche (juin à septembre)' },
  MG: { month: 9, why: 'saison sèche (avril à novembre)' },
  MX: { month: 2, why: 'saison sèche (novembre à avril)' },
  CR: { month: 2, why: 'saison sèche (décembre à avril)' },
  GT: { month: 2, why: 'saison sèche (novembre à avril)' },
  BZ: { month: 2, why: 'saison sèche (décembre à avril)' },
  NI: { month: 2, why: 'saison sèche (décembre à avril)' },
  PA: { month: 2, why: 'saison sèche (janvier à avril)' },
  CU: { month: 3, why: 'saison sèche, avant les cyclones' },
  DO: { month: 3, why: 'saison sèche, avant les cyclones' },
  JM: { month: 3, why: 'saison sèche, avant les cyclones' },
  SN: { month: 1, why: 'saison sèche et moins chaude' },
  ET: { month: 11, why: 'saison sèche qui commence, paysages encore verts' },
  RE: { month: 10, why: 'saison sèche et fraîche, idéale pour marcher' },
  MU: { month: 10, why: 'saison sèche et douce' },
  PF: { month: 7, why: 'saison sèche (mai à octobre)' },
  OM: { month: 12, why: 'hiver doux, avant la chaleur' },
};

export function bestPeriod(input: PeriodInput): BestPeriod | null {
  const tropical = input.lat != null && Math.abs(input.lat) < 23.5 && input.activity !== 'ski';
  const dry = tropical ? TROPICAL_DRY[(input.countryCode ?? '').toUpperCase()] : null;
  if (tropical && !dry) return null;
  const north = dry ? null : northernMonth(input);
  if (!dry && !north) return null;
  const south = (input.lat ?? 45) < 0;
  // La saison sèche est déjà donnée dans le calendrier du pays (pas de décalage austral).
  const month = dry ? dry.month : south ? ((north!.month + 5) % 12) + 1 : north!.month;
  const minStart = addDays(input.today, 21);
  let year = Number(input.today.slice(0, 4));
  let start = iso(year, month, 1);
  for (let i = 0; i < 2; i += 1) {
    const first = Date.parse(`${start}T12:00:00Z`);
    const dow = new Date(first).getUTCDay();
    start = addDays(start, (6 - dow + 7) % 7);
    // Un samedi plus tard dans le même mois (jusqu'au 22) plutôt qu'un an d'attente.
    while (start < minStart && Number(start.slice(8, 10)) <= 15) start = addDays(start, 7);
    if (start >= minStart) break;
    year += 1;
    start = iso(year, month, 1);
  }
  return {
    month,
    start,
    end: addDays(start, Math.max(1, input.days) - 1),
    why: dry ? dry.why : north!.why,
  };
}
