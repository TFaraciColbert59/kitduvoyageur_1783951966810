import type { CompasActivity } from './intent';
import type { NightType } from './autofill';

/**
 * Compas — conseils essentiels par règles (plan 4.11, fonction pure).
 *
 * Ce qui touche à la sécurité ne dépend pas de l'IA : altitude, avalanches,
 * orages, sortie en solitaire, refuges, bivouac, rivière. Chaque conseil est
 * vrai partout où il s'applique et n'invente aucune obligation (pas de permis,
 * pas d'horaire précis) : le détail local reste à vérifier sur place, et le
 * conseil le dit. L'IA n'ajoute ensuite que des suggestions facultatives,
 * présentées comme telles (`aiSuggestion`).
 */

export interface AdviceInput {
  activity: CompasActivity | string;
  /** Type de chaque nuit du voyage. */
  nights: NightType[];
  /** Altitude maximale mesurée sur l'itinéraire (m), si connue. */
  maxAltitudeM: number | null;
  party: number;
  /** Date de départ (AAAA-MM-JJ), si choisie. */
  startDate: string | null;
  /** Latitude du lieu : l'hiver dépend de l'hémisphère. */
  lat: number | null;
  /** Code pays ISO 3166-1 alpha-2 de la destination, si connu. */
  countryCode: string | null;
}

/** Pays où le 112 répond (Union européenne, EEE, Suisse, Royaume-Uni). */
const NUMBER_112 = new Set(
  'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO CH GB AD MC SM VA'.split(' ')
);

const OUTDOOR = new Set(['hiking', 'trekking', 'bivouac', 'bushcraft', 'mountaineering', 'climbing', 'ski', 'trail', 'running', 'cycling', 'water', 'mixed']);
const MOUNTAIN_SPORT = new Set(['hiking', 'trekking', 'bivouac', 'mountaineering', 'climbing', 'trail', 'running', 'mixed']);

type Season = 'hiver' | 'ete' | 'autre' | null;

/** Saison au lieu du voyage (hémisphère sud : saisons inversées). */
function seasonAt(startDate: string | null, lat: number | null): Season {
  if (!startDate) return null;
  const m = Number(startDate.slice(5, 7));
  const north = lat == null || lat >= 0;
  const winter = north ? m === 12 || m <= 4 : m >= 6 && m <= 10;
  const summer = north ? m >= 6 && m <= 9 : m === 12 || m <= 3;
  return winter ? 'hiver' : summer ? 'ete' : 'autre';
}

/** Au plus `max` conseils, du plus grave au plus courant. */
export function essentialAdvice(input: AdviceInput, max = 3): string[] {
  const out: string[] = [];
  const alt = input.maxAltitudeM ?? 0;
  const season = seasonAt(input.startDate, input.lat);
  const mountain = alt >= 1500 || input.activity === 'mountaineering' || input.activity === 'ski';

  if (alt >= 2500)
    out.push(
      'Au-dessus de 2 500 m, monte progressivement et bois souvent ; mal de tête, nausée ou essoufflement au repos : redescends.'
    );
  if (mountain && season === 'hiver')
    out.push(
      input.countryCode === 'FR'
        ? 'Montagne en hiver : lis le bulletin d’estimation du risque d’avalanche (BERA, Météo-France) la veille et le matin du départ.'
        : 'Montagne en hiver : lis le bulletin d’avalanche du massif la veille et le matin du départ.'
    );
  if (input.activity === 'water')
    out.push('Rivière : gilet attaché en permanence ; vérifie le niveau de l’eau et les lâchers de barrage en amont avant d’embarquer.');
  if (input.party === 1 && OUTDOOR.has(input.activity))
    out.push(
      input.countryCode && NUMBER_112.has(input.countryCode)
        ? 'Seul·e : laisse ton itinéraire et ton heure de retour à un proche. Urgence : 112.'
        : 'Seul·e : laisse ton itinéraire et ton heure de retour à un proche, et note le numéro d’urgence du pays avant de partir.'
    );
  if (mountain && season === 'ete' && MOUNTAIN_SPORT.has(input.activity))
    out.push('En montagne l’été, les orages éclatent souvent l’après-midi : pars tôt et sois redescendu·e des crêtes avant.');
  if (input.nights.includes('refuge'))
    out.push('Réserve tes nuits en refuge à l’avance (souvent complets en saison) et préviens le gardien si tu annules.');
  if (input.nights.includes('bivouac'))
    out.push(
      'Bivouac : vérifie les règles du lieu ; dans les parcs nationaux et les réserves, il est souvent limité (horaires, distance à la route) ou interdit.'
    );
  return out.slice(0, max);
}

/** Thèmes déjà couverts par un conseil des règles : l'IA ne les redit pas. */
const TOPICS: Array<[RegExp, RegExp]> = [
  [/2 500 m/, /\b(altitude|acclimat|paliers?|mal (aigu )?des montagnes)/i],
  [/avalanche/, /\b(avalanche|bera)\b/i],
  [/orages/, /\borages?\b/i],
  [/refuge/, /\brefuges?\b.*\b(r[ée]serv|complet)|\br[ée]serv\w*\b.*\brefuges?\b/i],
  [/Bivouac/, /\bbivouac/i],
  [/Rivière/, /\b(gilet|l[âa]chers?|niveau de l.eau)\b/i],
  [/Seul·e/, /\b(seul|solo|proche|112)\b/i],
];

/** Un conseil de l'IA qui redit un conseil des règles est écarté. */
export function repeatsRule(aiNote: string, rules: string[]): boolean {
  return TOPICS.some(([rule, ai]) => rules.some((r) => rule.test(r)) && ai.test(aiNote));
}

/** Préfixe d'un conseil de l'IA : facultatif et signalé comme venant de l'IA (AI Act, art. 50). */
export const AI_SUGGESTION_PREFIX = 'Suggestion de l’IA (facultatif) : ';

export function aiSuggestion(note: string): string {
  const body = note.trim();
  return `${AI_SUGGESTION_PREFIX}${body.charAt(0).toLocaleLowerCase('fr')}${body.slice(1)}`;
}

/** Nombre de notes gardées pour l'écran. */
export const MAX_NOTES = 8;

/**
 * Ordre des notes : l'essentiel d'abord (papiers, sécurité), puis ce que la
 * préparation a fait, enfin les suggestions de l'IA. La troncature ne fait
 * donc jamais tomber un conseil essentiel (plan 4.2 : note de papiers perdue
 * au-delà de 6 notes).
 */
export function orderNotes(essential: string[], process: string[], ai: string[], max = MAX_NOTES): string[] {
  return [...new Set([...essential, ...process, ...ai])].slice(0, max);
}
