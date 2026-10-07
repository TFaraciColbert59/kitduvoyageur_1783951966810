/**
 * La demande (« Où ») : une phrase libre — le principal — et des précisions
 * facultatives. Ce module dit, à la frappe, « voici ce que j'ai compris »
 * (règles du Compas, sans IA ni réseau) et compose la phrase envoyée à la
 * préparation : précisions ajoutées à la fin, durée par défaut annoncée.
 */

import { parseIntentRules, type CompasActivity, type CompasIntentAction } from './intent';
import { activityLabel, daysBetweenIso } from './format';
import { formatDateRange } from './compasModel';

export interface RequestPrecisions {
  activity?: CompasActivity | null;
  days?: number | null;
  party?: number | null;
}

export type RequestLineState = 'compris' | 'precise' | 'defaut' | 'a_trouver';

export interface RequestLine {
  key: 'activite' | 'lieu' | 'quand' | 'groupe' | 'nuits' | 'envies' | 'budget';
  label: string;
  value: string;
  state: RequestLineState;
}

export interface UnderstoodRequest {
  lines: RequestLine[];
  activity: CompasActivity;
  /** Phrase complète envoyée à la préparation (précisions et durée par défaut incluses). */
  say: string;
  /** Rien à préparer : ni phrase, ni activité choisie. */
  empty: boolean;
}

/** Durée retenue quand la demande n'en dit rien (annoncée, modifiable). */
export function defaultDays(activity: CompasActivity | null): number {
  switch (activity) {
    case 'running':
    case 'trail':
      return 1;
    case 'hiking':
    case 'bivouac':
    case 'bushcraft':
      return 2;
    case 'climbing':
    case 'mountaineering':
    case 'citytrip':
    case 'mixed':
      return 3;
    case 'cycling':
    case 'water':
      return 4;
    case 'ski':
      return 6;
    default:
      return 7;
  }
}

const NIGHTS: Record<string, string> = {
  bivouac: 'Bivouac',
  refuge: 'Refuges',
  hebergement: 'Hébergement',
  mixte: 'Nuits mixtes',
};

function first<T extends CompasIntentAction['type']>(
  actions: CompasIntentAction[],
  type: T
): Extract<CompasIntentAction, { type: T }> | undefined {
  return actions.find((a) => a.type === type) as Extract<CompasIntentAction, { type: T }> | undefined;
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export function understandRequest(text: string, today: string, p: RequestPrecisions = {}): UnderstoodRequest {
  const phrase = text.replace(/\s+/g, ' ').trim().slice(0, 240);
  const actions = phrase ? parseIntentRules(phrase, today) : [];
  const lines: RequestLine[] = [];

  const parsedActivity = first(actions, 'set_activity')?.activity ?? null;
  const activity: CompasActivity = p.activity ?? parsedActivity ?? 'mixed';
  lines.push({
    key: 'activite',
    label: 'Activité',
    value: activityLabel(activity) ?? 'Aventure',
    state: p.activity ? 'precise' : parsedActivity ? 'compris' : 'defaut',
  });

  const dest = first(actions, 'set_destination')?.place ?? first(actions, 'search_route')?.query ?? null;
  lines.push({
    key: 'lieu',
    label: 'Lieu',
    value: dest ?? (phrase ? 'Je le cherche dans ta phrase' : 'Dis où tu pars'),
    state: dest ? 'compris' : 'a_trouver',
  });

  const dates = first(actions, 'set_dates');
  const duration = first(actions, 'set_duration');
  let quand: RequestLine;
  let addDays: number | null = null;
  if (p.days) {
    quand = { key: 'quand', label: 'Durée', value: plural(p.days, 'jour', 'jours'), state: 'precise' };
    addDays = p.days;
  } else if (dates) {
    const days = dates.end ? daysBetweenIso(dates.start, dates.end) + 1 : null;
    quand = {
      key: 'quand',
      label: 'Quand',
      value: `${formatDateRange(dates.start, dates.end)}${days ? ` · ${plural(days, 'jour', 'jours')}` : ''}${duration?.hours ? ` · ${duration.hours} h` : ''}`,
      state: 'compris',
    };
  } else if (duration?.days || duration?.hours) {
    quand = {
      key: 'quand',
      label: 'Durée',
      value: duration.days ? plural(duration.days, 'jour', 'jours') : `${String(duration.hours).replace('.', ',')} h`,
      state: 'compris',
    };
  } else {
    const d = defaultDays(activity);
    quand = {
      key: 'quand',
      label: 'Durée',
      value: `${plural(d, 'jour', 'jours')} par défaut · date choisie au mieux`,
      state: 'defaut',
    };
    addDays = d;
  }
  lines.push(quand);

  const party = first(actions, 'set_party_size')?.count ?? null;
  lines.push({
    key: 'groupe',
    label: 'Groupe',
    value: p.party ? plural(p.party, 'personne', 'personnes') : party ? plural(party, 'personne', 'personnes') : 'Seul·e (par défaut)',
    state: p.party ? 'precise' : party ? 'compris' : 'defaut',
  });

  const nights = first(actions, 'set_nights')?.nights ?? null;
  if (nights) lines.push({ key: 'nuits', label: 'Nuits', value: NIGHTS[nights] ?? nights, state: 'compris' });

  const wishes = actions.filter((a): a is Extract<CompasIntentAction, { type: 'wish' }> => a.type === 'wish').map((a) => a.label);
  if (wishes.length) lines.push({ key: 'envies', label: 'Envies', value: wishes.join(' · '), state: 'compris' });

  const budget = first(actions, 'set_budget')?.amount ?? null;
  if (budget) lines.push({ key: 'budget', label: 'Budget', value: `${Math.round(budget).toLocaleString('fr-FR')} €`, state: 'compris' });

  // Précisions ajoutées en fin de phrase, dans la langue que les règles comprennent.
  const extra: string[] = [];
  if (addDays) extra.push(plural(addDays, 'jour', 'jours'));
  if (p.party && p.party !== party) extra.push(`à ${p.party}`);
  const say = [phrase, ...extra].filter(Boolean).join(' · ');

  return { lines, activity, say, empty: !phrase && !p.activity };
}
