import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import type { Locale } from '@/lib/i18n/locale';
import {
  ACTION_TO_PATHS,
  CONFIDENCE_RULES_DEDUCED,
  SETTING_NAMES,
  actionsToBrief,
  briefToPreferences,
  briefToTripContextInput,
  settingsToBrief,
  unconsumedPaths,
} from '../engine/brief/adapters';
import {
  SENSITIVE_PATHS,
  briefIssues,
  briefPaths,
  briefSchema,
  derive,
  emptyBrief,
  emptyValue,
  evidenceInPhrase,
  getValue,
  isStorable,
  lockValue,
  withValue,
  type Brief,
  type BriefPath,
  type BriefValue,
} from '../engine/brief/schema';
import {
  intentActionSchema,
  parseIntentRules,
  planApplication,
  type ApplyCurrent,
  type CompasIntentAction,
} from '../engine/intent';
import { buildTripContext, type TripContextInput } from '../engine/tripContext';

const TODAY = '2026-11-10';

const NEUTRAL: TripContextInput = {
  startDate: null,
  endDate: null,
  plannedDays: null,
  partySize: null,
  destinationName: null,
  activity: null,
  durationHours: null,
};

/** Variables renseignées d'un Brief, sous la forme `chemin → [valeur, source]`. */
function filled(brief: Brief): Record<string, [unknown, string]> {
  const out: Record<string, [unknown, string]> = {};
  for (const p of briefPaths()) {
    const v = getValue(brief, p);
    if (v.value != null) out[p] = [v.value, v.source];
  }
  return out;
}

const run = (actions: CompasIntentAction[], phrase: string) => actionsToBrief(actions, phrase);

/* ---------- Les 30 phrases du jeu d'or (6 par langue, espacées dans la liste) ---------- */

interface Demande {
  id: string;
  phrase: string;
  langue: Locale;
  attendu: { jours: number | null; heures: number | null; personnes: number | null; activite: string | null };
}

const IDS_PAR_LANGUE: Record<Locale, string[]> = {
  fr: ['D004', 'D018', 'D115', 'D170', 'D241', 'D291'],
  en: ['D031', 'D042', 'D130', 'D190', 'D250', 'D294'],
  es: ['D053', 'D061', 'D119', 'D196', 'D238', 'D283'],
  de: ['D070', 'D078', 'D125', 'D180', 'D235', 'D256'],
  it: ['D086', 'D094', 'D120', 'D175', 'D254', 'D285'],
};

const GOLD: Demande[] = (
  JSON.parse(readFileSync(path.join(process.cwd(), 'docs/compas/v6/demandes-or.json'), 'utf8')) as { demandes: Demande[] }
).demandes;
const byId = new Map(GOLD.map((d) => [d.id, d]));
const pick = (lang: Locale) =>
  IDS_PAR_LANGUE[lang].map((id) => {
    const d = byId.get(id);
    if (!d) throw new Error(`demande ${id} absente du jeu d'or`);
    return d;
  });
const ALL_30 = (Object.keys(IDS_PAR_LANGUE) as Locale[]).flatMap(pick);

/** Le chemin actuel : `planApplication` (intent.ts) sur les actions, comme `validateActions` les filtre. */
function currentPath(actions: CompasIntentAction[], base: TripContextInput, current: ApplyCurrent): TripContextInput {
  const dates = actions.find((a) => a.type === 'set_dates');
  const kept = actions.filter(
    (a) => !(a.type === 'set_duration' && dates?.type === 'set_dates' && dates.end && a.hours == null)
  );
  const input: TripContextInput = { ...base };
  let party = false;
  let activity = false;
  let destination = false;
  for (const op of planApplication(kept, current)) {
    if (op.op === 'dates') {
      input.startDate = op.startDate;
      input.endDate = op.endDate;
      input.durationHours = op.durationHours;
    } else if (op.op === 'span') input.plannedDays = op.days;
    else if (op.op === 'party' && !party) {
      input.partySize = op.partySize;
      party = true;
    } else if (op.op === 'activity' && !activity) {
      input.activity = op.activity;
      activity = true;
    } else if (op.op === 'destination' && !destination) {
      input.destinationName = op.place;
      destination = true;
    }
  }
  return input;
}

const EMPTY_CURRENT: ApplyCurrent = {
  startDate: null,
  endDate: null,
  days: null,
  shortHours: null,
  plannedDays: null,
  preferences: { pace: 'normal', nights: null, avoid: [], wishes: [] },
  hasRoute: false,
};

function equivalent(d: Demande, base: TripContextInput, current: ApplyCurrent) {
  const actions = parseIntentRules(d.phrase, TODAY, d.langue);
  const { brief } = actionsToBrief(actions, d.phrase);
  const now = buildTripContext(currentPath(actions, base, current));
  const next = buildTripContext(briefToTripContextInput(brief, base));
  const pick2 = (c: ReturnType<typeof buildTripContext>) => ({
    days: c.days,
    nights: c.nights,
    dated: c.dated,
    startDate: c.startDate,
    endDate: c.endDate,
    hours: c.hours,
    party: c.party,
    activity: c.activity,
    destination: c.destination.name,
  });
  return { id: d.id, now: pick2(now), next: pick2(next) };
}

/* =============================================================================================== */

describe('actionsToBrief — une variante d\'action, une table', () => {
  it('la table couvre exactement les variantes de intentActionSchema', () => {
    const variants = intentActionSchema.options.map((o) => (o.shape.type as unknown as { value: string }).value).sort();
    expect(Object.keys(ACTION_TO_PATHS).sort()).toEqual(variants);
    expect(variants).toHaveLength(19);
  });

  it('chaque variable de la table existe dans le schéma du Brief', () => {
    const known = new Set<string>(briefPaths());
    for (const paths of Object.values(ACTION_TO_PATHS)) for (const p of paths) expect(known.has(p)).toBe(true);
  });

  it('set_dates : jour dit → dateDebut et dateFin dits, mois dit', () => {
    const phrase = 'Randonnée du 12 au 15 août dans les Vosges';
    const { brief, unmapped } = run([{ type: 'set_dates', start: '2027-08-12', end: '2027-08-15' }], phrase);
    expect(unmapped).toEqual([]);
    expect(getValue(brief, 'quand.dateDebut')).toMatchObject({ value: '2027-08-12', source: 'dit', evidence: 'du 12 au 15 août' });
    expect(getValue(brief, 'quand.dateFin')).toMatchObject({ value: '2027-08-15', source: 'dit', evidence: 'du 12 au 15 août' });
    expect(getValue(brief, 'quand.mois')).toMatchObject({ value: 8, source: 'dit' });
    expect(briefIssues(brief, phrase, 'regles')).toEqual([]);
  });

  it('set_dates : un mois seul ne dit pas le jour → date déduite, mois dit', () => {
    const phrase = 'Trek en Islande en août';
    const { brief } = run([{ type: 'set_dates', start: '2027-08-01', end: null }], phrase);
    expect(getValue(brief, 'quand.dateDebut')).toMatchObject({ value: '2027-08-01', source: 'deduit', evidence: null });
    expect(getValue(brief, 'quand.mois')).toMatchObject({ value: 8, source: 'dit', evidence: 'août' });
  });

  it('set_dates : date relative (« ce week-end ») → tout déduit, aucun passage inventé', () => {
    const phrase = 'Sortie ce week-end';
    const { brief } = run([{ type: 'set_dates', start: '2026-11-14', end: null }], phrase);
    expect(getValue(brief, 'quand.dateDebut')).toMatchObject({ source: 'deduit', evidence: null });
    expect(getValue(brief, 'quand.mois')).toMatchObject({ value: 11, source: 'deduit', evidence: null });
  });

  it('set_duration : « 2 semaines » → 14 jours dits ; « 3 heures » → heures dites', () => {
    const w = run([{ type: 'set_duration', days: 14, hours: null }], '2 semaines à vélo au Vietnam');
    expect(getValue(w.brief, 'quand.jours')).toMatchObject({ value: 14, source: 'dit', evidence: '2 semaines' });
    const h = run([{ type: 'set_duration', days: null, hours: 3 }], 'balade de 3 heures autour du lac');
    expect(getValue(h.brief, 'quand.heures')).toMatchObject({ value: 3, source: 'dit', evidence: '3 heures' });
    expect(getValue(h.brief, 'quand.jours').value).toBeNull();
  });

  it('set_duration : durée vague (atLeast) → déduite, jamais dite', () => {
    const { brief } = run([{ type: 'set_duration', days: 2, hours: null, atLeast: true }], 'quelques jours en Corse');
    expect(getValue(brief, 'quand.jours')).toMatchObject({ value: 2, source: 'deduit', evidence: null });
  });

  it('set_duration : un nombre qui ne correspond pas au passage reste déduit', () => {
    // La phrase dit 5 jours ; l'action en porte 9 (venue d'ailleurs) : aucun passage n'est inventé.
    const { brief } = run([{ type: 'set_duration', days: 9, hours: null }], 'Rando 5 jours dans le Vercors');
    expect(getValue(brief, 'quand.jours')).toMatchObject({ value: 9, source: 'deduit', evidence: null });
  });

  it('set_party_size : « à 4 », « avec 5 amis » (6), composition (« 2 adultes et 3 enfants »)', () => {
    expect(getValue(run([{ type: 'set_party_size', count: 4 }], 'Rando à 4 dans les Alpes').brief, 'qui.personnes')).toMatchObject({
      value: 4,
      source: 'dit',
      evidence: 'à 4',
    });
    expect(
      getValue(run([{ type: 'set_party_size', count: 6 }], 'Rando avec 5 amis en Corse').brief, 'qui.personnes')
    ).toMatchObject({ value: 6, source: 'dit', evidence: 'avec 5 amis' });
    expect(
      getValue(run([{ type: 'set_party_size', count: 5 }], 'Ski, on est 2 adultes et 3 enfants').brief, 'qui.personnes')
    ).toMatchObject({ value: 5, source: 'dit', evidence: '2 adultes et 3 enfants' });
  });

  it('set_party_size : « en famille » ne dit aucun nombre → déduit', () => {
    const { brief } = run([{ type: 'set_party_size', count: 4 }], 'Week-end en famille dans le Jura');
    expect(getValue(brief, 'qui.personnes')).toMatchObject({ value: 4, source: 'deduit', evidence: null });
  });

  it('set_budget : montant, devise et « par personne » dits', () => {
    const phrase = 'Budget 2 000 € par personne pour la Grèce';
    const { brief, unmapped } = run([{ type: 'set_budget', amount: 2000, currency: 'EUR', perPerson: true }], phrase);
    expect(unmapped).toEqual([]);
    expect(getValue(brief, 'budget.enveloppe')).toMatchObject({ value: 2000, source: 'dit', evidence: '2 000 €' });
    expect(getValue(brief, 'budget.devise')).toMatchObject({ value: 'EUR', source: 'dit' });
    expect(getValue(brief, 'budget.base')).toMatchObject({ value: 'par_personne', source: 'dit', evidence: 'par personne' });
    expect(briefIssues(brief, phrase, 'regles')).toEqual([]);
  });

  it('set_budget : montant converti par le serveur (`said`) → déduit, pas dit', () => {
    const { brief } = run(
      [{ type: 'set_budget', amount: 1850, currency: 'EUR', said: { amount: 2000, currency: 'USD', date: '2026-11-10', source: 'x' } }],
      'Budget 2000 $ pour le Pérou'
    );
    expect(getValue(brief, 'budget.enveloppe')).toMatchObject({ value: 1850, source: 'deduit', evidence: null });
  });

  it('set_pace : le mot du rythme est le passage ; sans mot (enfants) → déduit', () => {
    expect(getValue(run([{ type: 'set_pace', pace: 'tranquille' }], 'Balade tranquille au lac').brief, 'effort.rythme')).toMatchObject({
      value: 'tranquille',
      source: 'dit',
      evidence: 'tranquille',
    });
    expect(getValue(run([{ type: 'set_pace', pace: 'tranquille' }], 'Balade avec les enfants').brief, 'effort.rythme')).toMatchObject({
      source: 'deduit',
      evidence: null,
    });
  });

  it('set_nights : bivouac, refuge et hébergement → nuits.type', () => {
    expect(getValue(run([{ type: 'set_nights', nights: 'bivouac' }], 'trek en bivouac').brief, 'nuits.type')).toMatchObject({
      value: 'bivouac',
      source: 'dit',
      evidence: 'bivouac',
    });
    expect(getValue(run([{ type: 'set_nights', nights: 'refuge' }], 'nuit en refuge').brief, 'nuits.type').value).toBe('refuge');
    const h = run([{ type: 'set_nights', nights: 'hebergement' }], 'week-end en hôtel');
    expect(getValue(h.brief, 'nuits.type')).toMatchObject({ value: 'hebergement', source: 'dit', evidence: 'hôtel' });
    expect(h.unmapped).toEqual([]);
  });

  it('un réglage nuits : hébergement lu par les règles n\'est pas perdu (Brief → préférences)', () => {
    const phrase = 'Week-end dans le Vercors, nuit en gîte';
    const actions = parseIntentRules(phrase, TODAY, 'fr');
    expect(actions).toContainEqual({ type: 'set_nights', nights: 'hebergement' });
    const { brief, unmapped } = actionsToBrief(actions, phrase);
    expect(unmapped).not.toContain('set_nights:hebergement');
    expect(getValue(brief, 'nuits.type')).toMatchObject({ value: 'hebergement', source: 'dit', evidence: 'gîte' });
    expect(briefToPreferences(brief).nights).toBe('hebergement');
    expect(unconsumedPaths(brief)).not.toContain('nuits.type');
  });

  it('set_activity : le mot de l\'activité est le passage', () => {
    expect(getValue(run([{ type: 'set_activity', activity: 'trekking' }], 'Trek en Islande').brief, 'projet.activite')).toMatchObject({
      value: 'trekking',
      source: 'dit',
      evidence: 'Trek',
    });
  });

  it('avoid : liste de noms, passage = le nom dans la phrase', () => {
    const phrase = 'Rando 3 jours sans bivouac';
    const { brief } = run([{ type: 'avoid', label: 'bivouac' }], phrase);
    expect(getValue(brief, 'ou.aEviter')).toMatchObject({ value: ['bivouac'], source: 'dit', evidence: 'bivouac' });
  });

  it('wish : plusieurs envies → un passage qui les couvre toutes ; une envie absente → déduit', () => {
    const phrase = 'Thaïlande avec Koh Lanta et Koh Phi Phi';
    const ok = run(
      [
        { type: 'wish', label: 'Koh Lanta' },
        { type: 'wish', label: 'Koh Phi Phi' },
      ],
      phrase
    );
    expect(getValue(ok.brief, 'ou.envies')).toMatchObject({
      value: ['Koh Lanta', 'Koh Phi Phi'],
      source: 'dit',
      evidence: 'Koh Lanta et Koh Phi Phi',
    });
    const ko = run(
      [
        { type: 'wish', label: 'Koh Lanta' },
        { type: 'wish', label: 'Chemin de Saint-Jacques' },
      ],
      phrase
    );
    expect(getValue(ko.brief, 'ou.envies')).toMatchObject({ source: 'deduit', evidence: null });
  });

  it('add_item → materiel.possedeDit (la quantité n\'a pas de variable)', () => {
    const { brief } = run([{ type: 'add_item', name: 'tente', quantity: 1 }], "J'emporte ma tente");
    expect(getValue(brief, 'materiel.possedeDit')).toMatchObject({ value: ['tente'], source: 'dit', evidence: 'tente' });
  });

  it('search_route : aucune variable → unmapped, Brief inchangé', () => {
    const { brief, unmapped } = run([{ type: 'search_route', query: 'Haut Atlas' }], 'bivouac dans le Haut Atlas');
    expect(unmapped).toEqual(['search_route']);
    expect(filled(brief)).toEqual({});
  });

  it('set_destination : le nom dit est le passage (sans casse ni accents) ; un nom absent → déduit', () => {
    const said = run([{ type: 'set_destination', place: 'Ecrins' }], 'ski de rando dans les Écrins');
    expect(getValue(said.brief, 'ou.destination')).toMatchObject({ value: 'Ecrins', source: 'dit', evidence: 'Écrins' });
    const added = run([{ type: 'set_destination', place: 'Hué, Viêt Nam' }], 'Hanoï à Hué en novembre');
    expect(getValue(added.brief, 'ou.destination')).toMatchObject({ source: 'deduit', evidence: null });
  });

  it('set_destination avec sentier → projet.itineraireNomme (« GR 34 » lu GR34)', () => {
    const { brief } = run([{ type: 'set_destination', place: 'Bretagne', trail: 'GR34' }], 'GR 34 en 8 jours');
    expect(getValue(brief, 'projet.itineraireNomme')).toMatchObject({ value: 'GR34', source: 'dit', evidence: 'GR 34' });
    expect(getValue(brief, 'ou.destination')).toMatchObject({ value: 'Bretagne', source: 'deduit' });
  });

  it('set_origin → ou.depart ; le nom long (`longer`) n\'entre pas', () => {
    const { brief } = run([{ type: 'set_origin', place: 'Lyon', longer: 'Lyon la Part-Dieu' }], 'Rando depuis Lyon');
    expect(getValue(brief, 'ou.depart')).toMatchObject({ value: 'Lyon', source: 'dit', evidence: 'Lyon' });
    expect(JSON.stringify(brief)).not.toContain('Part-Dieu');
  });

  it('set_outdoor_nights → nuits.nuitsDehors, passage = nombre + nuits', () => {
    const { brief } = run([{ type: 'set_outdoor_nights', nights: 3 }], '3 nuits sous tente en Ardèche');
    expect(getValue(brief, 'nuits.nuitsDehors')).toMatchObject({ value: 3, source: 'dit', evidence: '3 nuits sous tente' });
  });

  it('set_max_pack → materiel.poidsViseKg', () => {
    const { brief } = run([{ type: 'set_max_pack', kg: 8 }], 'Sac de 8 kg maximum');
    expect(getValue(brief, 'materiel.poidsViseKg')).toMatchObject({ value: 8, source: 'dit', evidence: '8 kg' });
  });

  it('set_car_free → transport.sansVoiture', () => {
    const { brief } = run([{ type: 'set_car_free' }], 'Week-end sans voiture dans le Vercors');
    expect(getValue(brief, 'transport.sansVoiture')).toMatchObject({ value: true, source: 'dit', evidence: 'sans voiture' });
  });

  it('set_distance : « par jour » → effort.kmParJour ; sinon effort.kmTotal', () => {
    const day = run([{ type: 'set_distance', km: 15 }], '3 nuits sous tente, 15 km par jour');
    expect(getValue(day.brief, 'effort.kmParJour')).toMatchObject({ value: 15, source: 'dit', evidence: '15 km par jour' });
    expect(getValue(day.brief, 'effort.kmTotal').value).toBeNull();
    const total = run([{ type: 'set_distance', km: 20 }], 'trail de 20 km');
    expect(getValue(total.brief, 'effort.kmTotal')).toMatchObject({ value: 20, source: 'dit', evidence: '20 km' });
  });

  it('set_level → qui.niveau', () => {
    const { brief } = run([{ type: 'set_level', level: 'debut' }], 'Rando pour débutants');
    expect(getValue(brief, 'qui.niveau')).toMatchObject({ value: 'debut', source: 'dit', evidence: 'débutants' });
  });

  it('set_terrain → effort.terrain', () => {
    const { brief } = run([{ type: 'set_terrain', terrain: 'montagne' }], 'Séjour en montagne');
    expect(getValue(brief, 'effort.terrain')).toMatchObject({ value: 'montagne', source: 'dit', evidence: 'montagne' });
  });

  it('une action ne remplit que les variables de sa ligne dans la table', () => {
    const cases: Array<[CompasIntentAction, string]> = [
      [{ type: 'set_dates', start: '2027-08-12', end: '2027-08-15' }, 'du 12 au 15 août'],
      [{ type: 'set_duration', days: 5, hours: null }, '5 jours'],
      [{ type: 'set_party_size', count: 4 }, 'à 4'],
      [{ type: 'set_budget', amount: 800, currency: 'EUR' }, '800 €'],
      [{ type: 'set_pace', pace: 'soutenu' }, 'rythme soutenu'],
      [{ type: 'set_nights', nights: 'refuge' }, 'en refuge'],
      [{ type: 'set_activity', activity: 'cycling' }, 'à vélo'],
      [{ type: 'avoid', label: 'foule' }, 'sans foule'],
      [{ type: 'wish', label: 'lac' }, 'un lac'],
      [{ type: 'add_item', name: 'tente', quantity: 1 }, 'ma tente'],
      [{ type: 'set_destination', place: 'Vercors', trail: 'GR91' }, 'Vercors GR 91'],
      [{ type: 'set_origin', place: 'Lyon' }, 'depuis Lyon'],
      [{ type: 'set_outdoor_nights', nights: 2 }, '2 nuits dehors'],
      [{ type: 'set_max_pack', kg: 9 }, '9 kg'],
      [{ type: 'set_car_free' }, 'sans voiture'],
      [{ type: 'set_distance', km: 20 }, '20 km'],
      [{ type: 'set_level', level: 'aguerri' }, 'aguerri'],
      [{ type: 'set_terrain', terrain: 'sentier' }, 'sentier'],
    ];
    for (const [action, phrase] of cases) {
      const { brief } = run([action], phrase);
      const allowed = new Set<string>(ACTION_TO_PATHS[action.type]);
      for (const p of Object.keys(filled(brief))) expect(allowed.has(p), `${action.type} → ${p}`).toBe(true);
      expect(Object.keys(filled(brief)).length, action.type).toBeGreaterThan(0);
    }
  });

  it('valeur hors bornes du schéma → unmapped (pas de Brief invalide)', () => {
    const { brief, unmapped } = run([{ type: 'set_party_size', count: 50 }], 'à 50 pour un séminaire');
    expect(unmapped).toEqual(['set_party_size:hors_bornes']);
    expect(getValue(brief, 'qui.personnes').value).toBeNull();
    expect(briefSchema.safeParse(brief).success).toBe(true);
  });

  it('aucune action → Brief vide, rien de non mappé', () => {
    const r = run([], 'Quelque part, un jour');
    expect(r.unmapped).toEqual([]);
    expect(r.brief).toEqual(emptyBrief());
  });

  it('la première lecture gagne quand une variable est lue deux fois (comme planApplication)', () => {
    const { brief } = run(
      [
        { type: 'set_party_size', count: 2 },
        { type: 'set_party_size', count: 5 },
      ],
      'à 2'
    );
    expect(getValue(brief, 'qui.personnes').value).toBe(2);
  });

  it('un déduit porte la confiance 0,7, sans passage, ni verrou, ni marque privée', () => {
    const { brief } = run([{ type: 'set_party_size', count: 3 }], 'Week-end en famille');
    expect(getValue(brief, 'qui.personnes')).toEqual({
      value: 3,
      source: 'deduit',
      confidence: CONFIDENCE_RULES_DEDUCED,
      evidence: null,
      locked: false,
      prive: false,
    });
    expect(CONFIDENCE_RULES_DEDUCED).toBe(0.7);
  });

  it('pur et déterministe : même entrée, même sortie, entrées intactes', () => {
    const actions: CompasIntentAction[] = [
      { type: 'set_dates', start: '2027-08-01', end: null },
      { type: 'set_duration', days: 14, hours: null },
      { type: 'wish', label: 'Koh Lanta' },
    ];
    const snapshot = JSON.stringify(actions);
    const a = run(actions, '2 semaines à Koh Lanta en août');
    const b = run(actions, '2 semaines à Koh Lanta en août');
    expect(a).toEqual(b);
    expect(JSON.stringify(actions)).toBe(snapshot);
  });
});

/* =============================================================================================== */

describe('actionsToBrief — les 30 phrases du jeu d\'or, avec le vrai parseIntentRules', () => {
  it('le jeu compte au moins 5 phrases par langue (6 retenues), 30 en tout', () => {
    for (const lang of Object.keys(IDS_PAR_LANGUE) as Locale[]) {
      const items = pick(lang);
      expect(items.length).toBeGreaterThanOrEqual(5);
      for (const d of items) expect(d.langue).toBe(lang);
    }
    expect(ALL_30).toHaveLength(30);
  });

  for (const lang of Object.keys(IDS_PAR_LANGUE) as Locale[]) {
    it(`${lang} : briefIssues(brief, phrase, 'regles') ne remarque rien, le Brief est conforme au schéma`, () => {
      for (const d of pick(lang)) {
        const actions = parseIntentRules(d.phrase, TODAY, d.langue);
        const { brief } = actionsToBrief(actions, d.phrase);
        expect({ id: d.id, issues: briefIssues(brief, d.phrase, 'regles') }).toEqual({ id: d.id, issues: [] });
        expect({ id: d.id, ok: briefSchema.safeParse(brief).success }).toEqual({ id: d.id, ok: true });
      }
    });
  }

  it('toute valeur dite a son passage dans la phrase ; toute valeur déduite n\'en a pas', () => {
    for (const d of ALL_30) {
      const { brief } = actionsToBrief(parseIntentRules(d.phrase, TODAY, d.langue), d.phrase);
      for (const p of briefPaths()) {
        const v = getValue(brief, p);
        if (v.value == null) continue;
        if (v.source === 'dit') expect(evidenceInPhrase(v.evidence, d.phrase), `${d.id} ${p}`).toBe(true);
        else {
          expect(v.source, `${d.id} ${p}`).toBe('deduit');
          expect(v.evidence, `${d.id} ${p}`).toBeNull();
          expect(v.confidence, `${d.id} ${p}`).toBe(0.7);
        }
        expect(v.locked).toBe(false);
        expect(v.prive).toBe(false);
      }
    }
  });

  it('les règles ont lu quelque chose pour au moins 25 des 30 phrases (la mesure n\'est pas vide)', () => {
    const lu = ALL_30.filter((d) => parseIntentRules(d.phrase, TODAY, d.langue).length > 0);
    expect(lu.length).toBeGreaterThanOrEqual(25);
  });
});

/* =============================================================================================== */

describe('briefToTripContextInput — équivalence avec le chemin actuel (porte 1, AI_MODE=off)', () => {
  const EXISTING_BASE: TripContextInput = {
    startDate: '2027-03-05',
    endDate: '2027-03-09',
    plannedDays: null,
    partySize: 3,
    memberCount: 2,
    destinationName: 'Vercors',
    countryCode: 'FR',
    anchor: { name: 'Villard', lat: 45.07, lon: 5.55 },
    activity: 'hiking',
    durationHours: null,
  };
  const EXISTING_CURRENT: ApplyCurrent = {
    ...EMPTY_CURRENT,
    startDate: '2027-03-05',
    endDate: '2027-03-09',
    days: 5,
  };

  for (const lang of Object.keys(IDS_PAR_LANGUE) as Locale[]) {
    it(`${lang} : mêmes jours, heures, groupe, activité, destination que le chemin actuel (voyage vide)`, () => {
      for (const d of pick(lang)) {
        const r = equivalent(d, NEUTRAL, EMPTY_CURRENT);
        expect(r.next, d.id).toEqual(r.now);
      }
    });

    it(`${lang} : idem sur un voyage déjà daté (la base garde ce que les règles ne disent pas)`, () => {
      for (const d of pick(lang)) {
        const r = equivalent(d, EXISTING_BASE, EXISTING_CURRENT);
        expect(r.next, d.id).toEqual(r.now);
      }
    });
  }

  it('les champs de l\'entrée correspondent aux champs des actions elles-mêmes', () => {
    for (const d of ALL_30) {
      const actions = parseIntentRules(d.phrase, TODAY, d.langue);
      const { brief } = actionsToBrief(actions, d.phrase);
      const input = briefToTripContextInput(brief, NEUTRAL);
      const party = actions.find((a) => a.type === 'set_party_size');
      const activity = actions.find((a) => a.type === 'set_activity');
      const dest = actions.find((a) => a.type === 'set_destination');
      const duration = actions.find((a) => a.type === 'set_duration');
      expect(input.partySize, d.id).toBe(party?.type === 'set_party_size' ? party.count : null);
      expect(input.activity, d.id).toBe(activity?.type === 'set_activity' ? activity.activity : null);
      expect(input.destinationName, d.id).toBe(dest?.type === 'set_destination' ? dest.place : null);
      expect(input.durationHours ?? null, d.id).toBe(duration?.type === 'set_duration' ? duration.hours : null);
    }
  });

  it('Brief vide : la base revient intacte', () => {
    expect(briefToTripContextInput(emptyBrief(), EXISTING_BASE)).toEqual(EXISTING_BASE);
  });

  it('ce que le Brief ne porte pas (ancre, pays, membres) reste celui de la base', () => {
    const { brief } = run([{ type: 'set_destination', place: 'Chartreuse' }], 'Rando en Chartreuse');
    const input = briefToTripContextInput(brief, EXISTING_BASE);
    expect(input.destinationName).toBe('Chartreuse');
    expect(input.anchor).toEqual(EXISTING_BASE.anchor);
    expect(input.countryCode).toBe('FR');
    expect(input.memberCount).toBe(2);
    expect(input.partySize).toBe(3);
  });

  it('dates dites (début et fin) : elles font les jours, avant la durée en jours', () => {
    let b = emptyBrief();
    b = withValue(b, 'quand.dateDebut', lockValue('2027-05-10'));
    b = withValue(b, 'quand.dateFin', lockValue('2027-05-12'));
    b = withValue(b, 'quand.jours', lockValue(9));
    const input = briefToTripContextInput(b, NEUTRAL);
    expect(buildTripContext(input).days).toBe(3);
    expect(unconsumedPaths(b)).toContain('quand.jours');
  });

  it('début + durée en jours : fin calculée ; plafond 30 si dite, 60 si réglée par la personne', () => {
    const said = run(
      [
        { type: 'set_dates', start: '2027-05-01', end: null },
        { type: 'set_duration', days: 45, hours: null },
      ],
      '45 jours en mai'
    );
    expect(buildTripContext(briefToTripContextInput(said.brief, NEUTRAL)).days).toBe(30);
    let b = emptyBrief();
    b = withValue(b, 'quand.dateDebut', lockValue('2027-05-01'));
    b = withValue(b, 'quand.jours', lockValue(45));
    expect(buildTripContext(briefToTripContextInput(b, NEUTRAL)).days).toBe(45);
  });

  it('durée sans début : durée retenue (plannedDays), pas de dates inventées', () => {
    const { brief } = run([{ type: 'set_duration', days: 20, hours: null }], '20 jours en Islande');
    const input = briefToTripContextInput(brief, NEUTRAL);
    expect(input.plannedDays).toBe(20);
    expect(input.startDate).toBeNull();
    expect(buildTripContext(input).days).toBe(20);
  });

  it('heures : la sortie tient dans le jour de début', () => {
    const { brief } = run(
      [
        { type: 'set_dates', start: '2026-11-10', end: null },
        { type: 'set_duration', days: null, hours: 2 },
      ],
      'footing de 2 heures'
    );
    const ctx = buildTripContext(briefToTripContextInput(brief, NEUTRAL));
    expect(ctx.hours).toBe(2);
    expect(ctx.days).toBe(1);
    expect(ctx.endDate).toBe(ctx.startDate);
  });

  it('début seul, sans durée : garde la durée de la base (un jour à défaut)', () => {
    const { brief } = run([{ type: 'set_dates', start: '2027-06-01', end: null }], 'en juin');
    expect(buildTripContext(briefToTripContextInput(brief, NEUTRAL)).days).toBe(1);
    expect(buildTripContext(briefToTripContextInput(brief, EXISTING_BASE)).days).toBe(5);
  });

  it('une date qui passe le motif du schéma sans exister au calendrier est ignorée, sans exception', () => {
    let b = withValue(emptyBrief(), 'quand.dateDebut', lockValue('2027-02-31'));
    b = withValue(b, 'quand.jours', lockValue(3));
    expect(() => briefToTripContextInput(b, NEUTRAL)).not.toThrow();
    const input = briefToTripContextInput(b, NEUTRAL);
    expect(input.startDate).toBeNull();
    expect(input.plannedDays).toBe(3);
    expect(unconsumedPaths(b)).toEqual(['quand.dateDebut']);
  });

  it('pur : la base et le Brief ne sont pas modifiés', () => {
    const { brief } = run([{ type: 'set_party_size', count: 4 }], 'à 4');
    const b1 = JSON.stringify(brief);
    const b2 = JSON.stringify(EXISTING_BASE);
    briefToTripContextInput(brief, EXISTING_BASE);
    expect(JSON.stringify(brief)).toBe(b1);
    expect(JSON.stringify(EXISTING_BASE)).toBe(b2);
  });
});

/* =============================================================================================== */

describe('settingsToBrief — les réglages posés entrent verrouillés', () => {
  const ALL = {
    startDate: '2027-05-10',
    endDate: '2027-05-14',
    plannedDays: 5,
    durationHours: 3,
    partySize: 4,
    activity: 'trekking',
    destinationName: 'Queyras',
    preferences: {
      pace: 'soutenu',
      nights: 'refuge',
      avoid: ['foule'],
      wishes: ['lac'],
      level: 'aguerri',
      autonomy: 'bivouac_1_2',
      priority: 'budget',
      terrain: 'montagne',
      maxPackKg: 9,
      outdoorNights: 2,
      targetKm: 18,
      carFree: true,
    },
  } as const;
  const input = (touched: string[]) => ({
    ...ALL,
    preferences: { ...ALL.preferences, avoid: [...ALL.preferences.avoid], wishes: [...ALL.preferences.wishes] },
    touched: new Set(touched),
  });

  it('rien de touché → Brief vide : le moteur recalcule tout', () => {
    expect(settingsToBrief(input([]))).toEqual(emptyBrief());
  });

  it('seuls les réglages touchés entrent, par lockValue (dit, confiance 1, verrouillé, public)', () => {
    const brief = settingsToBrief(input(['partySize', 'pace']));
    expect(Object.keys(filled(brief)).sort()).toEqual(['effort.rythme', 'qui.personnes']);
    expect(getValue(brief, 'qui.personnes')).toEqual(lockValue(4));
    expect(getValue(brief, 'effort.rythme')).toEqual(lockValue('soutenu'));
  });

  it('les 19 réglages touchés → 19 variables verrouillées, aucune sensible, tout rangeable', () => {
    const brief = settingsToBrief(input([...SETTING_NAMES]));
    const f = filled(brief);
    expect(Object.keys(f)).toHaveLength(SETTING_NAMES.length);
    for (const p of briefPaths()) {
      const v = getValue(brief, p);
      if (v.value != null) {
        expect(v.locked).toBe(true);
        expect(v.prive).toBe(false);
        expect(SENSITIVE_PATHS.has(p)).toBe(false);
      }
    }
    expect(isStorable(brief)).toBe(true);
    expect(briefSchema.safeParse(brief).success).toBe(true);
  });

  it('valeurs illisibles ou hors bornes : absentes, jamais devinées', () => {
    const brief = settingsToBrief({
      startDate: 'demain',
      endDate: null,
      plannedDays: 'beaucoup',
      durationHours: 40,
      partySize: 99,
      activity: 'pilotage',
      destinationName: '   ',
      preferences: { pace: 'normal', nights: null, avoid: [], wishes: [] },
      touched: new Set(SETTING_NAMES),
    });
    expect(Object.keys(filled(brief))).toEqual(['effort.rythme']);
  });

  it('nuits « hébergement » : entre telle quelle, verrouillée, et ressort des préférences', () => {
    const brief = settingsToBrief({
      ...input(['nights']),
      preferences: { pace: 'normal', nights: 'hebergement', avoid: [], wishes: [] },
    });
    expect(getValue(brief, 'nuits.type')).toEqual(lockValue('hebergement'));
    expect(briefToPreferences(brief).nights).toBe('hebergement');
  });

  it('aller-retour : réglages → Brief → préférences rend les mêmes préférences', () => {
    const brief = settingsToBrief(input([...SETTING_NAMES]));
    expect(briefToPreferences(brief)).toEqual({
      pace: 'soutenu',
      nights: 'refuge',
      level: 'aguerri',
      autonomy: 'bivouac_1_2',
      priority: 'budget',
      terrain: 'montagne',
      maxPackKg: 9,
      outdoorNights: 2,
      targetKm: 18,
      carFree: true,
      wishes: ['lac'],
      avoid: ['foule'],
    });
  });

  it('aller-retour : réglages → Brief → entrée de contexte rend les mêmes dates, groupe, activité, destination', () => {
    const brief = settingsToBrief(input([...SETTING_NAMES]));
    const ctx = buildTripContext(briefToTripContextInput(brief, NEUTRAL));
    expect(ctx.startDate).toBe('2027-05-10');
    expect(ctx.endDate).toBe('2027-05-10'); // les heures dites (3 h) tiennent dans le jour de début
    expect(ctx.hours).toBe(3);
    expect(ctx.party).toBe(4);
    expect(ctx.activity).toBe('trekking');
    expect(ctx.destination.name).toBe('Queyras');
  });
});

/* =============================================================================================== */

describe('briefToPreferences', () => {
  const lockedBrief = (entries: Array<[BriefPath, unknown]>): Brief =>
    entries.reduce((b, [p, v]) => withValue(b, p, lockValue(v)), emptyBrief());

  it('Brief vide → aucune préférence', () => {
    expect(briefToPreferences(emptyBrief())).toEqual({});
  });

  it('les douze correspondances', () => {
    const prefs = briefToPreferences(
      lockedBrief([
        ['effort.rythme', 'tranquille'],
        ['nuits.type', 'gite'],
        ['qui.niveau', 'regulier'],
        ['nuits.autonomie', 'itinerance_longue'],
        ['budget.priorite', 'prix'],
        ['effort.terrain', 'hors_sentier'],
        ['materiel.poidsViseKg', 7.5],
        ['nuits.nuitsDehors', 4],
        ['effort.kmTotal', 40],
        ['transport.sansVoiture', true],
        ['ou.envies', ['lac', 'crêtes']],
        ['ou.aEviter', ['foule']],
      ])
    );
    expect(prefs).toEqual({
      pace: 'tranquille',
      nights: 'hebergement',
      level: 'regulier',
      autonomy: 'itinerance_longue',
      priority: 'budget',
      terrain: 'hors_sentier',
      maxPackKg: 7.5,
      outdoorNights: 4,
      targetKm: 40,
      carFree: true,
      wishes: ['lac', 'crêtes'],
      avoid: ['foule'],
    });
  });

  it('le résultat est lu tel quel par readCompasMeta (mêmes valeurs acceptées)', async () => {
    const { readCompasMeta } = await import('../engine/meta');
    const prefs = briefToPreferences(
      lockedBrief([
        ['effort.rythme', 'soutenu'],
        ['nuits.type', 'bivouac'],
        ['qui.niveau', 'aguerri'],
        ['nuits.autonomie', 'journee'],
        ['budget.priorite', 'securite'],
        ['effort.terrain', 'sentier'],
        ['materiel.poidsViseKg', 10],
        ['nuits.nuitsDehors', 2],
        ['effort.kmParJour', 22],
        ['transport.sansVoiture', true],
        ['ou.envies', ['lac']],
        ['ou.aEviter', ['foule']],
      ])
    );
    const read = readCompasMeta({ compas: { prefs } }).preferences;
    expect(read).toEqual({
      pace: 'soutenu',
      nights: 'bivouac',
      avoid: ['foule'],
      wishes: ['lac'],
      level: 'aguerri',
      autonomy: 'journee',
      priority: 'securite',
      terrain: 'sentier',
      maxPackKg: 10,
      outdoorNights: 2,
      targetKm: 22,
      carFree: true,
    });
  });

  it('kmParJour passe devant kmTotal (le moteur lit la distance par jour)', () => {
    const prefs = briefToPreferences(
      lockedBrief([
        ['effort.kmParJour', 15],
        ['effort.kmTotal', 80],
      ])
    );
    expect(prefs.targetKm).toBe(15);
  });

  it('valeurs sans équivalent laissées de côté : camping, véhicule, priorité « temps », sans voiture = non', () => {
    const prefs = briefToPreferences(
      lockedBrief([
        ['nuits.type', 'camping'],
        ['budget.priorite', 'temps'],
        ['transport.sansVoiture', false],
        ['ou.envies', []],
      ])
    );
    expect(prefs).toEqual({});
    expect(briefToPreferences(lockedBrief([['nuits.type', 'vehicule']]))).toEqual({});
  });

  it('PRIVÉ : allure d\'historique, devise déduite du profil et régime ne laissent aucune trace', () => {
    let b = emptyBrief();
    // Allure d'historique : privée, « soutenu » ne doit jamais sortir.
    b = withValue(b, 'effort.rythme', { value: 'soutenu', source: 'historique', confidence: 0.8, evidence: null, locked: false, prive: true });
    // Niveau déduit de cette allure : hérite de la marque (derive).
    b = withValue(b, 'qui.niveau', derive('aguerri', [getValue(b, 'effort.rythme')]));
    // Devise déduite du pays de résidence (profil) : privée par héritage.
    const residence: BriefValue<unknown> = { value: 'CH', source: 'profil', confidence: 0.9, evidence: null, locked: false, prive: true };
    b = withValue(b, 'budget.devise', derive('CHF', [residence]));
    // Régime et allergies, dits dans la phrase : sensibles, jamais rangés.
    b = withValue(b, 'repas.regime', { value: 'vegan', source: 'dit', confidence: 0.9, evidence: 'je suis vegan', locked: false, prive: false });
    b = withValue(b, 'repas.allergies', { value: ['arachides'], source: 'dit', confidence: 0.9, evidence: 'allergique aux arachides', locked: false, prive: false });
    // Envies venues du profil : privées.
    b = withValue(b, 'ou.envies', { value: ['spa'], source: 'profil', confidence: 0.6, evidence: null, locked: false, prive: true });
    // Une valeur publique, pour prouver que la sortie n'est pas vide pour de mauvaises raisons.
    b = withValue(b, 'materiel.poidsViseKg', { value: 8, source: 'dit', confidence: 0.9, evidence: 'sac de 8 kg', locked: false, prive: false });

    const prefs = briefToPreferences(b);
    expect(prefs).toEqual({ maxPackKg: 8 });
    const json = JSON.stringify(prefs);
    for (const trace of ['soutenu', 'aguerri', 'CHF', 'CH', 'vegan', 'arachides', 'spa', 'historique', 'profil', 'sac de 8 kg'])
      expect(json).not.toContain(trace);
  });

  it('SENSIBLE : une variable sensible verrouillée par la personne ne sort pas non plus', () => {
    const prefs = briefToPreferences(
      lockedBrief([
        ['qui.peurDuVide', true],
        ['qui.malDesTransports', true],
        ['qui.mobiliteReduite', true],
        ['repas.regime', 'halal'],
        ['repas.allergies', ['gluten']],
        ['effort.rythme', 'tranquille'],
      ])
    );
    expect(prefs).toEqual({ pace: 'tranquille' });
  });

  it('aucun passage de la phrase n\'est repris (evidence jamais dans la sortie)', () => {
    const phrase = 'avec ma fille de 4 ans qui a peur, 3 nuits sous tente, sac de 8 kg';
    const actions: CompasIntentAction[] = [
      { type: 'set_outdoor_nights', nights: 3 },
      { type: 'set_max_pack', kg: 8 },
    ];
    const { brief } = actionsToBrief(actions, phrase);
    expect(Object.values(filled(brief)).length).toBe(2);
    const json = JSON.stringify(briefToPreferences(brief));
    expect(json).toBe('{"maxPackKg":8,"outdoorNights":3}');
  });

  it('pur : le Brief d\'entrée n\'est pas modifié', () => {
    const b = lockedBrief([['ou.envies', ['lac']]]);
    const snapshot = JSON.stringify(b);
    briefToPreferences(b);
    expect(JSON.stringify(b)).toBe(snapshot);
  });

  it('sur les 30 phrases : préférences = ce que planApplication aurait rangé (hors hébergement)', () => {
    for (const d of ALL_30) {
      const actions = parseIntentRules(d.phrase, TODAY, d.langue);
      const prefs = briefToPreferences(actionsToBrief(actions, d.phrase).brief);
      const ops = planApplication(actions, EMPTY_CURRENT);
      const op = ops.find((o) => o.op === 'prefs');
      const expected = op && op.op === 'prefs' ? op.preferences : null;
      if (!expected) {
        expect(prefs, d.id).toEqual({});
        continue;
      }
      if (expected.nights != null) expect(prefs.nights, d.id).toBe(expected.nights);
      expect(prefs.wishes ?? [], d.id).toEqual(expected.wishes);
      expect(prefs.avoid ?? [], d.id).toEqual(expected.avoid);
      if (actions.some((a) => a.type === 'set_pace')) expect(prefs.pace, d.id).toBe(expected.pace);
    }
  });
});

/* =============================================================================================== */

describe('unconsumedPaths', () => {
  it('variables que rien ne consomme encore : départ, budget, mois, objets, camping…', () => {
    let b = emptyBrief();
    b = withValue(b, 'ou.depart', lockValue('Lyon'));
    b = withValue(b, 'budget.enveloppe', lockValue(800));
    b = withValue(b, 'quand.mois', lockValue(8));
    b = withValue(b, 'materiel.possedeDit', lockValue(['tente']));
    b = withValue(b, 'nuits.type', lockValue('camping'));
    b = withValue(b, 'budget.priorite', lockValue('temps'));
    b = withValue(b, 'qui.personnes', lockValue(3));
    b = withValue(b, 'effort.rythme', lockValue('normal'));
    expect(unconsumedPaths(b).sort()).toEqual(
      ['budget.enveloppe', 'budget.priorite', 'materiel.possedeDit', 'nuits.type', 'ou.depart', 'quand.mois'].sort()
    );
  });

  it('une valeur privée n\'est pas portée par les préférences : elle est listée', () => {
    const b = withValue(emptyBrief(), 'effort.rythme', {
      value: 'soutenu',
      source: 'historique',
      confidence: 0.8,
      evidence: null,
      locked: false,
      prive: true,
    });
    expect(unconsumedPaths(b)).toEqual(['effort.rythme']);
  });

  it('une variable sensible renseignée est listée (rien ne la consomme)', () => {
    const b = withValue(emptyBrief(), 'repas.regime', lockValue('vegan'));
    expect(unconsumedPaths(b)).toEqual(['repas.regime']);
  });

  it('Brief vide : rien', () => {
    expect(unconsumedPaths(emptyBrief())).toEqual([]);
  });

  it('chaque variable consommée l\'est : retirer l\'une de ces 20 variables change la sortie', () => {
    const consumedSamples: Array<[BriefPath, unknown]> = [
      ['quand.dateDebut', '2027-05-10'],
      ['quand.jours', 4],
      ['quand.heures', 3],
      ['qui.personnes', 3],
      ['projet.activite', 'hiking'],
      ['ou.destination', 'Vercors'],
      ['effort.rythme', 'normal'],
      ['nuits.type', 'refuge'],
      ['qui.niveau', 'debut'],
      ['nuits.autonomie', 'journee'],
      ['budget.priorite', 'confort'],
      ['effort.terrain', 'montagne'],
      ['materiel.poidsViseKg', 8],
      ['nuits.nuitsDehors', 2],
      ['effort.kmParJour', 12],
      ['transport.sansVoiture', true],
      ['ou.envies', ['lac']],
      ['ou.aEviter', ['foule']],
    ];
    for (const [p, v] of consumedSamples) {
      const b = withValue(emptyBrief(), p, lockValue(v));
      expect(unconsumedPaths(b), p).toEqual([]);
    }
    // dateFin n'est consommée qu'avec un début.
    let b = withValue(emptyBrief(), 'quand.dateDebut', lockValue('2027-05-10'));
    b = withValue(b, 'quand.dateFin', lockValue('2027-05-12'));
    expect(unconsumedPaths(b)).toEqual([]);
    expect(unconsumedPaths(withValue(emptyBrief(), 'quand.dateFin', lockValue('2027-05-12')))).toEqual(['quand.dateFin']);
    // kmTotal est consommé seul, pas derrière kmParJour.
    expect(unconsumedPaths(withValue(emptyBrief(), 'effort.kmTotal', lockValue(40)))).toEqual([]);
  });
});

/* =============================================================================================== */

describe('hygiène du module', () => {
  const source = readFileSync(path.join(process.cwd(), 'src/features/compas/engine/brief/adapters.ts'), 'utf8');

  it('pur : ni Date.now, ni horloge, ni hasard', () => {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/Date\.now|new Date\(\)|Math\.random|performance\.now/);
  });

  it('se charge hors Next : ni `server-only`, ni alias `@/`, ni import réseau ou base', () => {
    const imports = [...source.matchAll(/^import[^;]*?from\s+'([^']+)';/gm)].map((m) => m[1]);
    expect(imports.length).toBeGreaterThan(0);
    for (const i of imports) {
      expect(i.startsWith('@/'), i).toBe(false);
      expect(i).not.toMatch(/server-only|supabase|next\//);
      expect(i.startsWith('.'), i).toBe(true);
    }
  });

  it('une valeur absente du Brief n\'écrit rien : emptyValue reste la valeur de repos', () => {
    const b = emptyBrief();
    expect(getValue(b, 'qui.personnes')).toEqual(emptyValue());
    expect(briefToTripContextInput(b, NEUTRAL)).toEqual(NEUTRAL);
  });
});
