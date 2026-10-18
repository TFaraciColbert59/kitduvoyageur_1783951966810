/**
 * La demande (« Où ») : une phrase libre — le principal — et des précisions
 * facultatives. Ce module dit, à la frappe, « voici ce que j'ai compris »
 * (règles du Compas, sans IA ni réseau) et compose la phrase envoyée à la
 * préparation : précisions ajoutées à la fin, durée par défaut annoncée.
 * Les lignes sont dans la locale passée (`'fr'` par défaut, dictionnaire
 * `compas.understood.*`) ; la phrase `say` reste en français : c'est le
 * protocole relu par `precisionActions` et par la préparation.
 */

import { COMPAS_ACTIVITIES, parseIntentRules, type CompasActivity, type CompasIntentAction } from './intent';
import { vagueSpan } from './intentWords';
import { daysBetweenIso } from './format';
import { activityName, compasFormat, compasT, countText } from './compasI18n';
import type { Locale } from '@/lib/i18n/locale';

export interface RequestPrecisions {
  activity?: CompasActivity | null;
  days?: number | null;
  party?: number | null;
}

export type RequestLineState = 'compris' | 'precise' | 'defaut' | 'a_trouver';

export interface RequestLine {
  key: 'activite' | 'lieu' | 'quand' | 'groupe' | 'nuits' | 'envies' | 'budget' | 'deplacements'; // i18n-ok: identifiants techniques
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

const NIGHTS = {
  bivouac: 'compas.understood.nightsBivouac',
  refuge: 'compas.understood.nightsRefuge',
  hebergement: 'compas.understood.nightsLodging',
  mixte: 'compas.understood.nightsMixed',
} as const;

function first<T extends CompasIntentAction['type']>(
  actions: CompasIntentAction[],
  type: T
): Extract<CompasIntentAction, { type: T }> | undefined {
  return actions.find((a) => a.type === type) as Extract<CompasIntentAction, { type: T }> | undefined;
}

/** Forme française fixe des précisions de `say` (relue par `precisionActions`), jamais traduite. */
const sayDays = (n: number) => `${n} ${n > 1 ? 'jours' : 'jour'}`; // i18n-ok: protocole de say

export function understandRequest(
  text: string,
  today: string,
  p: RequestPrecisions = {},
  locale: Locale = 'fr'
): UnderstoodRequest {
  const t = compasT(locale);
  const f = compasFormat(locale);
  const plural = (n: number, kind: 'days' | 'people') =>
    kind === 'days'
      ? countText(t, locale, n, 'compas.start.daysOne', 'compas.start.daysOther')
      : countText(t, locale, n, 'compas.start.peopleOne', 'compas.start.peopleOther');
  const hoursText = (h: number) => t('compas.understood.hours', { hours: f.decimal(h, 2) });
  const phrase = text.replace(/\s+/g, ' ').trim().slice(0, 240);
  const actions = phrase ? parseIntentRules(phrase, today, locale) : [];
  const lines: RequestLine[] = [];

  const parsedActivity = first(actions, 'set_activity')?.activity ?? null;
  const activity: CompasActivity = p.activity ?? parsedActivity ?? 'mixed';
  lines.push({
    key: 'activite',
    label: t('compas.understood.activity'),
    value: activityName(activity, locale) ?? t('compas.understood.adventure'),
    state: p.activity ? 'precise' : parsedActivity ? 'compris' : 'defaut',
  });

  const dest = first(actions, 'set_destination')?.place ?? first(actions, 'search_route')?.query ?? null;
  lines.push({
    key: 'lieu', // i18n-ok: identifiant technique
    label: t('compas.understood.place'),
    value: dest ?? (phrase ? t('compas.understood.placeSearching') : t('compas.understood.placeAsk')),
    state: dest ? 'compris' : 'a_trouver',
  });

  const dates = first(actions, 'set_dates');
  const duration = first(actions, 'set_duration');
  let quand: RequestLine;
  let addDays: number | null = null;
  if (p.days) {
    quand = { key: 'quand', label: t('compas.understood.duration'), value: plural(p.days, 'days'), state: 'precise' }; // i18n-ok: clé technique
    addDays = p.days;
  } else if (dates) {
    const days = dates.end ? daysBetweenIso(dates.start, dates.end) + 1 : null;
    quand = {
      key: 'quand', // i18n-ok: identifiant technique
      label: t('compas.understood.when'),
      // Départ seul et durée dite (« 10 jours en avril », « un week-end ») : les deux.
      value: `${f.dateRange(dates.start, dates.end)}${days ? ` · ${plural(days, 'days')}` : duration?.days ? ` · ${duration.atLeast ? t('compas.understood.atLeast', { days: plural(duration.days, 'days') }) : plural(duration.days, 'days')}${duration.atLeast ? ` (${t('compas.understood.vagueHint')})` : ''}` : ''}${duration?.hours ? ` · ${hoursText(duration.hours)}` : ''}`,
      state: duration?.atLeast && !days ? 'defaut' : 'compris',
    };
  } else if (duration?.atLeast && duration.days) {
    // « quelques jours » : aucun nombre n'est dit. Le Compas annonce la borne sûre du pluriel, « au moins », et demande
    // de préciser (la durée réellement voulue se choisit sous « Préciser »).
    quand = {
      key: 'quand', // i18n-ok: identifiant technique
      label: t('compas.understood.duration'),
      value: t('compas.understood.vagueDuration', {
        days: plural(duration.days, 'days'),
        said: vagueSpan(phrase.toLowerCase())?.said ?? t('compas.understood.vagueFallback'),
      }),
      state: 'defaut',
    };
  } else if (duration?.days || duration?.hours) {
    quand = {
      key: 'quand', // i18n-ok: identifiant technique
      label: t('compas.understood.duration'),
      value: duration.days ? plural(duration.days, 'days') : hoursText(duration.hours ?? 0),
      state: 'compris',
    };
  } else {
    const d = defaultDays(activity);
    quand = {
      key: 'quand', // i18n-ok: identifiant technique
      label: t('compas.understood.duration'),
      value: t('compas.understood.defaultDuration', { days: plural(d, 'days') }),
      state: 'defaut',
    };
    addDays = d;
  }
  lines.push(quand);

  const party = first(actions, 'set_party_size')?.count ?? null;
  lines.push({
    key: 'groupe', // i18n-ok: identifiant technique
    label: t('compas.understood.group'),
    value: p.party ? plural(p.party, 'people') : party ? plural(party, 'people') : t('compas.understood.solo'),
    state: p.party ? 'precise' : party ? 'compris' : 'defaut',
  });

  const nights = first(actions, 'set_nights')?.nights ?? null;
  const nightsKey = nights ? NIGHTS[nights as keyof typeof NIGHTS] : undefined;
  if (nights) lines.push({ key: 'nuits', label: t('compas.understood.nights'), value: nightsKey ? t(nightsKey) : nights, state: 'compris' }); // i18n-ok: clé technique

  const wishes = actions.filter((a): a is Extract<CompasIntentAction, { type: 'wish' }> => a.type === 'wish').map((a) => a.label);
  if (wishes.length) lines.push({ key: 'envies', label: t('compas.understood.wishes'), value: wishes.join(' · '), state: 'compris' }); // i18n-ok: clé technique

  if (first(actions, 'set_car_free'))
    lines.push({ key: 'deplacements', label: t('compas.understood.transport'), value: t('compas.understood.carFree'), state: 'compris' });

  const budget = first(actions, 'set_budget');
  if (budget) {
    // Tel que dit (« 2 000 $ ») : la conversion se fait à l'application, au taux du jour.
    const each = f.money(Math.round(budget.amount), budget.currency ?? 'EUR');
    // « 50 € par personne » : multiplié par le groupe (précisé, sinon dit dans la phrase), calcul montré.
    const people = p.party ?? party ?? null;
    lines.push({
      key: 'budget', // i18n-ok: identifiant technique
      label: t('compas.understood.budget'),
      value: !budget.perPerson
        ? each
        : people
          ? t('compas.understood.budgetPerPersonTotal', {
              total: f.money(Math.round(budget.amount * people), budget.currency ?? 'EUR'),
              each,
              people: plural(people, 'people'),
            })
          : t('compas.understood.budgetPerPersonAsk', { each }),
      state: 'compris',
    });
  }

  // Précisions ajoutées en fin de phrase, sous une forme fixe que la lecture
  // fait passer avant la phrase (`precisionActions`).
  const extra: string[] = [];
  if (addDays) extra.push(sayDays(addDays));
  if (p.party && p.party !== party) extra.push(`à ${p.party}`); // i18n-ok: protocole de say
  if (p.activity && p.activity !== parsedActivity) extra.push(`activité : ${p.activity}`); // i18n-ok: protocole de say
  const say = [phrase, ...extra].filter(Boolean).join(' · ');

  return { lines, activity, say, empty: !phrase && !p.activity };
}

/**
 * Précisions en fin de phrase (« · 5 jours · à 2 · activité : trekking ») :
 * elles priment sur la phrase et sur l'IA. Sans cela, « 3 jours … à 4 »
 * suivi des précisions 5 jours, 2 personnes donnait 3 jours à 4 (la première
 * durée lue l'emportait).
 */
export function precisionActions(say: string): CompasIntentAction[] {
  const parts = say.split(' · ');
  const out: CompasIntentAction[] = [];
  for (let i = parts.length - 1; i >= 1; i -= 1) {
    const seg = parts[i].trim();
    const d = /^(\d{1,3}) jours?$/.exec(seg);
    const g = /^à (\d{1,3})$/.exec(seg);
    const a = /^activité : ([a-z]+)$/.exec(seg);
    if (d && !out.some((x) => x.type === 'set_duration')) out.push({ type: 'set_duration', days: Number(d[1]), hours: null });
    else if (g && !out.some((x) => x.type === 'set_party_size')) out.push({ type: 'set_party_size', count: Number(g[1]) });
    else if (a && (COMPAS_ACTIVITIES as readonly string[]).includes(a[1]) && !out.some((x) => x.type === 'set_activity'))
      out.push({ type: 'set_activity', activity: a[1] as CompasActivity });
    else break;
  }
  return out.reverse();
}
