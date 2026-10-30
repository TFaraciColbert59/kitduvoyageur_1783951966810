/**
 * Aides pures des formulaires de création : mots-clés, dates rapides, météo
 * lisible, répartition du poids d'un kit et essentiels manquants. Aucune
 * dépendance au DOM : tout est testé à part.
 */

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/* ---------------------------------------------------------------- Mots-clés */

export const HASHTAG_POOL = [
  'randonnee',
  'bivouac',
  'montagne',
  'trail',
  'refuge',
  'lac',
  'sommet',
  'foret',
  'leverdesoleil',
  'grandeitinerance',
  'materiel',
  'ultraleger',
] as const;

/** Mots-clés pas encore présents dans le texte (au plus `max`). */
export function suggestHashtags(text: string, pool: readonly string[] = HASHTAG_POOL, max = 6): string[] {
  const present = new Set((normalize(text).match(/#[a-z0-9_]+/g) ?? []).map((tag) => tag.slice(1)));
  return pool.filter((tag) => !present.has(tag)).slice(0, max);
}

/** Ajoute `#tag` à la fin du texte, séparé par un espace. */
export function appendTag(text: string, tag: string): string {
  const trimmed = text.replace(/\s+$/, '');
  return `${trimmed}${trimmed ? ' ' : ''}#${tag}`;
}

/** Ajoute une phrase sur une nouvelle ligne, sans la doubler. */
export function appendSentence(text: string, sentence: string): string {
  if (normalize(text).includes(normalize(sentence))) return text;
  const trimmed = text.replace(/\s+$/, '');
  return trimmed ? `${trimmed}\n${sentence}` : sentence;
}

/* ------------------------------------------------------------ Dates rapides */

const iso = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

/** Aujourd'hui, demain, samedi et dimanche prochains (sans doublon). */
export function quickDates(now = new Date()): Array<{ id: string; label: string }> {
  const day = (offset: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12);
  const untilSaturday = (6 - now.getDay() + 7) % 7;
  const untilSunday = (7 - now.getDay()) % 7;
  const candidates = [
    { date: day(0), label: 'Aujourd’hui' },
    { date: day(1), label: 'Demain' },
    { date: day(untilSaturday), label: 'Samedi' },
    { date: day(untilSunday), label: 'Dimanche' },
  ];
  const seen = new Set<string>();
  const out: Array<{ id: string; label: string }> = [];
  for (const candidate of candidates) {
    const id = iso(candidate.date);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label: candidate.label });
  }
  return out;
}

/** « sam. 2 nov. » */
export function shortDay(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
}

/* ------------------------------------------------------------------- Météo */

/** Code météo OMS (forme Open-Meteo, servie par MET Norway) → libellé court. */
export function weatherLabel(code: number | null | undefined): string {
  if (code === null || code === undefined || !Number.isFinite(code)) return 'Météo inconnue';
  if (code === 0) return 'Ensoleillé';
  if (code <= 2) return 'Éclaircies';
  if (code === 3) return 'Couvert';
  if (code === 45 || code === 48) return 'Brouillard';
  if (code >= 51 && code <= 57) return 'Bruine';
  if (code >= 61 && code <= 67) return 'Pluie';
  if (code >= 71 && code <= 77) return 'Neige';
  if (code >= 80 && code <= 82) return 'Averses';
  if (code === 85 || code === 86) return 'Averses de neige';
  if (code >= 95) return 'Orage';
  return 'Variable';
}

export interface DailyForecast {
  time: string[];
  weather_code?: Array<number | null>;
  temperature_2m_max?: Array<number | null>;
  temperature_2m_min?: Array<number | null>;
  precipitation_probability_max?: Array<number | null>;
}

export interface DayForecast {
  label: string;
  min: number | null;
  max: number | null;
  rain: number | null;
}

/** Prévision du jour demandé, ou `null` s'il est hors de la fenêtre de prévision. */
export function forecastFor(daily: DailyForecast | null | undefined, date: string): DayForecast | null {
  if (!daily || !Array.isArray(daily.time)) return null;
  const index = daily.time.indexOf(date);
  if (index < 0) return null;
  const round = (value: number | null | undefined) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;
  return {
    label: weatherLabel(daily.weather_code?.[index]),
    min: round(daily.temperature_2m_min?.[index]),
    max: round(daily.temperature_2m_max?.[index]),
    rain: round(daily.precipitation_probability_max?.[index]),
  };
}

/* --------------------------------------------------------------------- Kit */

export interface WeighedItem {
  name: string;
  category: string | null;
  weightG: number | null;
}

/** Poids par catégorie (connu seulement), du plus lourd au plus léger. */
export function weightByCategory(items: readonly WeighedItem[]): Array<{ category: string; weightG: number; share: number }> {
  const totals = new Map<string, number>();
  let all = 0;
  for (const item of items) {
    const weight = item.weightG && item.weightG > 0 ? item.weightG : 0;
    if (!weight) continue;
    const category = item.category?.trim() || 'Divers';
    totals.set(category, (totals.get(category) ?? 0) + weight);
    all += weight;
  }
  return [...totals.entries()]
    .map(([category, weightG]) => ({ category, weightG, share: all ? weightG / all : 0 }))
    .sort((a, b) => b.weightG - a.weightG);
}

const ESSENTIALS: ReadonlyArray<{ label: string; match: RegExp; seasons?: readonly string[] }> = [
  { label: 'Abri', match: /tente|abri|tarp|hamac|bivy/ },
  { label: 'Couchage', match: /couchage|duvet|matelas|matelas|quilt/ },
  { label: 'Eau', match: /\beau\b|gourde|filtre|poche a eau|bidon|flasque/ },
  { label: 'Éclairage', match: /eclairage|frontale|lampe/ },
  { label: 'Premiers secours', match: /secours|pharmacie|trousse|soin/ },
  { label: 'Navigation', match: /navigation|carte|boussole|gps|altimetre/ },
  { label: 'Vêtements chauds', match: /doudoune|polaire|veste|gants|bonnet|chaud/, seasons: ['hiver', 'automne', 'toute_saison'] },
  { label: 'Protection solaire', match: /solaire|creme|lunettes|casquette|chapeau/, seasons: ['ete', 'printemps'] },
];

/** Essentiels non couverts par le kit (catégorie ou nom), selon la saison. */
export function missingEssentials(items: readonly WeighedItem[], season: string): string[] {
  const haystack = items.map((item) => normalize(`${item.category ?? ''} ${item.name}`));
  return ESSENTIALS.filter((essential) => !essential.seasons || essential.seasons.includes(season))
    .filter((essential) => !haystack.some((text) => essential.match.test(text)))
    .map((essential) => essential.label);
}

/** « 850 g », « 4,2 kg ». */
export function formatWeight(grams: number): string {
  if (!Number.isFinite(grams) || grams <= 0) return '0 g';
  return grams < 1000 ? `${Math.round(grams)} g` : `${(grams / 1000).toFixed(1).replace('.', ',')} kg`;
}

/* -------------------------------------------------------------------- Club */

export const CLUB_SPIRIT_TEMPLATES = [
  'Débutants bienvenus, on avance au rythme du groupe.',
  'Sorties le week-end, une fois par mois au moins.',
  'Bienveillance et entraide avant la performance.',
  'On partage le matériel et le covoiturage.',
  'Niveau sportif : sorties longues et dénivelé.',
] as const;
