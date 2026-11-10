import { describe, expect, it } from 'vitest';
import {
  briefPaths,
  briefSchema,
  emptyBrief,
  emptyValue,
  getValue,
  withValue,
  type Brief,
  type BriefPath,
  type BriefSource,
  type BriefValue,
} from '../engine/brief/schema';
import { mergeBrief, type MergeInput } from '../engine/brief/merge';

const val = <T>(
  value: T,
  source: BriefSource,
  confidence = 0.9,
  evidence: string | null = null,
  locked = false,
  prive = false
): BriefValue<unknown> => ({ value, source, confidence, evidence, locked, prive });

const priv = (value: unknown, source: 'profil' | 'historique', confidence = 0.7) =>
  val(value, source, confidence, null, false, true);

const said = (value: unknown, evidence: string, confidence = 0.9) => val(value, 'dit', confidence, evidence);

function brief(entries: Partial<Record<BriefPath, BriefValue<unknown>>>): Brief {
  let b = emptyBrief();
  for (const [p, v] of Object.entries(entries)) b = withValue(b, p as BriefPath, v as BriefValue<unknown>);
  return b;
}

const base: MergeInput = {
  phrase: '',
  stored: null,
  rules: null,
  ai: null,
  profile: null,
  history: null,
  defaults: null,
};
const run = (o: Partial<MergeInput>) => mergeBrief({ ...base, ...o });
const get = (b: Brief, p: BriefPath) => getValue(b, p);

const PHRASE = 'Randonnée à Annecy pendant 3 jours avec ma famille';

describe('mergeBrief — entrées vides', () => {
  it('R8 : tout null donne le Brief vide', () => {
    const r = run({});
    expect(r.brief).toEqual(emptyBrief());
    expect(r.disagreements).toEqual([]);
    expect(r.dropped).toEqual([]);
  });

  it('une valeur à null ne participe jamais', () => {
    const rules = brief({ 'quand.jours': val(null, 'dit', 0.9, '3 jours') });
    const r = run({ phrase: PHRASE, rules, defaults: brief({ 'quand.jours': val(null, 'defaut', 0.3) }) });
    expect(get(r.brief, 'quand.jours')).toEqual(emptyValue());
  });
});

describe('mergeBrief — preuve (R2)', () => {
  it("R1 : l'IA qui cite un passage absent est écartée et la valeur des règles reste", () => {
    const rules = brief({ 'quand.jours': said(3, '3 jours') });
    const ai = brief({ 'quand.jours': said(5, '5 jours') });
    const r = run({ phrase: PHRASE, rules, ai });
    const v = get(r.brief, 'quand.jours');
    expect(v.value).toBe(3);
    expect(v.confidence).toBe(0.9);
    expect(r.disagreements).toEqual([]);
    expect(r.dropped).toEqual([{ path: 'quand.jours', reason: 'preuve_absente_de_la_phrase', origin: 'ai' }]);
  });

  it('une valeur dite sans preuve (règles) est écartée avec son origine et retombe sur la source suivante', () => {
    const rules = brief({ 'quand.jours': val(3, 'dit', 0.9, null) });
    const defaults = brief({ 'quand.jours': val(2, 'defaut', 0.3) });
    const r = run({ phrase: PHRASE, rules, defaults });
    expect(get(r.brief, 'quand.jours').value).toBe(2);
    expect(get(r.brief, 'quand.jours').source).toBe('defaut');
    expect(r.dropped).toEqual([{ path: 'quand.jours', reason: 'dit_sans_preuve', origin: 'rules' }]);
  });

  it('la preuve est comparée sans casse ni espaces superflus', () => {
    const rules = brief({ 'ou.destination': said('Annecy', '  ANNECY ') });
    const r = run({ phrase: PHRASE, rules });
    expect(get(r.brief, 'ou.destination').value).toBe('Annecy');
    expect(r.dropped).toEqual([]);
  });
});

describe('mergeBrief — verrou', () => {
  it("une valeur verrouillée gagne contre un 'dit' entrant, telle quelle", () => {
    const locked = val(7, 'dit', 1, null, true);
    const stored = brief({ 'quand.jours': locked });
    const rules = brief({ 'quand.jours': said(3, '3 jours') });
    const r = run({ phrase: PHRASE, stored, rules });
    expect(get(r.brief, 'quand.jours')).toEqual(locked);
  });

  it('une valeur verrouillée gagne aussi contre profil, historique et défaut', () => {
    const locked = val('Lyon', 'defaut', 1, null, true);
    const stored = brief({ 'ou.depart': locked });
    const r = run({
      stored,
      profile: brief({ 'ou.depart': priv('Paris', 'profil') }),
      history: brief({ 'ou.depart': priv('Nice', 'historique') }),
      defaults: brief({ 'ou.depart': val('Metz', 'defaut') }),
    });
    expect(get(r.brief, 'ou.depart')).toEqual(locked);
  });

  it('une valeur rangée non verrouillée ne compte pas (elle est recalculée)', () => {
    const stored = brief({ 'quand.jours': said(9, '9 jours') });
    const r = run({ phrase: PHRASE, stored, rules: brief({ 'quand.jours': said(3, '3 jours') }) });
    expect(get(r.brief, 'quand.jours').value).toBe(3);
    expect(get(run({ stored }).brief, 'quand.jours')).toEqual(emptyValue());
  });

  it('une valeur verrouillée à null ne bloque pas les autres sources', () => {
    const stored = brief({ 'quand.jours': val(null, 'dit', 0, null, true) });
    const r = run({ phrase: PHRASE, stored, rules: brief({ 'quand.jours': said(3, '3 jours') }) });
    expect(get(r.brief, 'quand.jours').value).toBe(3);
  });
});

describe('mergeBrief — règles et IA sur une valeur dite', () => {
  it('accord : valeur des règles, confiance 0,95, preuve des règles', () => {
    const rules = brief({ 'ou.destination': said('Annecy', 'Annecy', 0.7) });
    const ai = brief({ 'ou.destination': said('annecy ', 'annecy', 0.99) });
    const r = run({ phrase: PHRASE, rules, ai });
    const v = get(r.brief, 'ou.destination');
    expect(v).toEqual({
      value: 'Annecy',
      source: 'dit',
      confidence: 0.95,
      evidence: 'Annecy',
      locked: false,
      prive: false,
    });
    expect(r.disagreements).toEqual([]);
  });

  it("accord sur un texte : insensible à la casse et aux accents", () => {
    const phrase = 'week-end à Évian';
    const rules = brief({ 'ou.destination': said('Evian', 'Évian') });
    const ai = brief({ 'ou.destination': said('ÉVIAN', 'Évian') });
    const r = run({ phrase, rules, ai });
    expect(get(r.brief, 'ou.destination').confidence).toBe(0.95);
    expect(r.disagreements).toEqual([]);
  });

  it('désaccord sur quand.jours : les règles gagnent (nombre), confiance 0,6', () => {
    const phrase = 'Annecy pendant 3 jours ou quatre jours';
    const rules = brief({ 'quand.jours': said(3, '3 jours') });
    const ai = brief({ 'quand.jours': said(4, 'quatre jours') });
    const r = run({ phrase, rules, ai });
    const v = get(r.brief, 'quand.jours');
    expect(v.value).toBe(3);
    expect(v.confidence).toBe(0.6);
    expect(v.evidence).toBe('3 jours');
    expect(r.disagreements).toEqual([{ path: 'quand.jours', rules: 3, ai: 4, kept: 'rules' }]);
  });

  it("désaccord sur ou.destination : l'IA gagne (texte), confiance 0,6", () => {
    const rules = brief({ 'ou.destination': said('Annecy', 'Annecy') });
    const ai = brief({ 'ou.destination': said("Lac d'Annecy", "Lac d'Annecy") });
    const r = run({ phrase: "Randonnée au Lac d'Annecy", rules, ai });
    const v = get(r.brief, 'ou.destination');
    expect(v.value).toBe("Lac d'Annecy");
    expect(v.confidence).toBe(0.6);
    expect(r.disagreements).toEqual([
      { path: 'ou.destination', rules: 'Annecy', ai: "Lac d'Annecy", kept: 'ai' },
    ]);
  });

  it("d : une date de l'IA seule est écartée (jamais de date venue de l'IA)", () => {
    const phrase = 'départ le 1er décembre';
    const ai = brief({ 'quand.dateDebut': said('2026-12-01', '1er décembre') });
    const r = run({ phrase, ai });
    expect(get(r.brief, 'quand.dateDebut')).toEqual(emptyValue());
    expect(r.dropped).toEqual([{ path: 'quand.dateDebut', reason: 'date_non_confirmee', origin: 'ai' }]);
  });

  it("d : une date de l'IA en désaccord avec celle des règles : les règles restent, sans désaccord", () => {
    const phrase = 'départ le 1er décembre';
    const rules = brief({ 'quand.dateFin': said('2026-12-01', '1er décembre') });
    const ai = brief({ 'quand.dateFin': said('2026-12-02', '1er décembre') });
    const r = run({ phrase, rules, ai });
    expect(get(r.brief, 'quand.dateFin')).toMatchObject({ value: '2026-12-01', confidence: 0.9 });
    expect(r.disagreements).toEqual([]);
  });

  it("d : une date peut venir d'une surcouche (défaut) ou d'un verrou", () => {
    const d = run({ defaults: brief({ 'quand.dateDebut': val('2026-12-01', 'defaut', 0.3) }) });
    expect(get(d.brief, 'quand.dateDebut').value).toBe('2026-12-01');
    const l = run({ stored: brief({ 'quand.dateDebut': val('2026-12-05', 'dit', 1, null, true) }) });
    expect(get(l.brief, 'quand.dateDebut').value).toBe('2026-12-05');
  });

  it("e : un nombre de l'IA que son passage ne porte pas est écarté ; les règles restent seules, sans désaccord", () => {
    const phrase = 'week-end en famille';
    const rules = brief({ 'qui.personnes': said(3, 'en famille', 0.7) });
    const ai = brief({ 'qui.personnes': said(4, 'en famille') });
    const r = run({ phrase, rules, ai });
    expect(get(r.brief, 'qui.personnes')).toMatchObject({ value: 3, confidence: 0.7 });
    expect(r.disagreements).toEqual([]);
    expect(r.dropped).toEqual([{ path: 'qui.personnes', reason: 'valeur_absente_du_passage', origin: 'ai' }]);
  });

  it('désaccord sur un nombre non entier (heures) : les règles gagnent', () => {
    const phrase = 'une sortie de 2 heures ou 2,5 heures';
    const rules = brief({ 'quand.heures': said(2, '2 heures') });
    const ai = brief({ 'quand.heures': said(2.5, '2,5 heures') });
    const r = run({ phrase, rules, ai });
    expect(get(r.brief, 'quand.heures').value).toBe(2);
    expect(r.disagreements[0].kept).toBe('rules');
  });

  it('une seule des deux présente : gardée avec sa confiance (règles)', () => {
    const r = run({ phrase: PHRASE, rules: brief({ 'quand.jours': said(3, '3 jours', 0.93) }) });
    expect(get(r.brief, 'quand.jours').confidence).toBe(0.93);
    expect(r.disagreements).toEqual([]);
  });

  it("IA seule : confiance bornée à 0,85 ; sous le plafond elle reste intacte", () => {
    const high = run({ phrase: PHRASE, ai: brief({ 'quand.jours': said(3, '3 jours', 0.99) }) });
    expect(get(high.brief, 'quand.jours').confidence).toBe(0.85);
    const low = run({ phrase: PHRASE, ai: brief({ 'quand.jours': said(3, '3 jours', 0.5) }) });
    expect(get(low.brief, 'quand.jours').confidence).toBe(0.5);
  });

  it('tableau ou.envies égal : accord 0,95 ; différent : IA gagne avec désaccord', () => {
    const phrase = 'je veux des lacs et des cascades';
    const rules = brief({ 'ou.envies': said(['lacs', 'cascades'], 'lacs et des cascades') });
    const same = run({ phrase, rules, ai: brief({ 'ou.envies': said(['Lacs', 'Cascades'], 'lacs et des cascades') }) });
    expect(get(same.brief, 'ou.envies').value).toEqual(['lacs', 'cascades']);
    expect(get(same.brief, 'ou.envies').confidence).toBe(0.95);
    const diff = run({ phrase, rules, ai: brief({ 'ou.envies': said(['lacs'], 'des lacs') }) });
    expect(get(diff.brief, 'ou.envies').value).toEqual(['lacs']);
    expect(get(diff.brief, 'ou.envies').confidence).toBe(0.6);
    expect(diff.disagreements).toEqual([
      { path: 'ou.envies', rules: ['lacs', 'cascades'], ai: ['lacs'], kept: 'ai' },
    ]);
  });

  it("un tableau dans un autre ordre est un désaccord", () => {
    const phrase = 'des lacs et des cascades';
    const rules = brief({ 'ou.envies': said(['lacs', 'cascades'], 'lacs et des cascades') });
    const ai = brief({ 'ou.envies': said(['cascades', 'lacs'], 'lacs et des cascades') });
    expect(run({ phrase, rules, ai }).disagreements).toHaveLength(1);
  });
});

describe('mergeBrief — priorité des sources', () => {
  const profile = brief({ 'qui.niveau': priv('debut', 'profil') });
  const history = brief({ 'qui.niveau': priv('aguerri', 'historique', 0.8) });
  const defaults = brief({ 'qui.niveau': val('regulier', 'defaut', 0.3) });

  it('profil devant historique devant défaut', () => {
    expect(get(run({ profile, history, defaults }).brief, 'qui.niveau').source).toBe('profil');
    expect(get(run({ history, defaults }).brief, 'qui.niveau').source).toBe('historique');
    expect(get(run({ defaults }).brief, 'qui.niveau').source).toBe('defaut');
  });

  it("un 'dit' passe devant le profil", () => {
    const phrase = 'je suis aguerri';
    const rules = brief({ 'qui.niveau': said('aguerri', 'aguerri') });
    const v = get(run({ phrase, rules, profile, history, defaults }).brief, 'qui.niveau');
    expect(v.source).toBe('dit');
    expect(v.value).toBe('aguerri');
  });

  it("un 'deduit' ne passe jamais devant profil ni historique, mais devant le défaut", () => {
    const rules = brief({ 'qui.niveau': val('regulier', 'deduit', 0.5) });
    expect(get(run({ rules, history, defaults }).brief, 'qui.niveau').source).toBe('historique');
    expect(get(run({ rules, profile, defaults }).brief, 'qui.niveau').source).toBe('profil');
    expect(get(run({ rules, defaults }).brief, 'qui.niveau').source).toBe('deduit');
  });

  it("un 'deduit' ne passe pas devant un 'dit' d'un autre lecteur, sans désaccord journalisé", () => {
    const phrase = 'quelques jours à Annecy';
    const rules = brief({ 'ou.destination': said('Annecy', 'Annecy') });
    const ai = brief({ 'ou.destination': val('Lyon', 'deduit', 0.7) });
    const r = run({ phrase, rules, ai });
    expect(get(r.brief, 'ou.destination').value).toBe('Annecy');
    expect(r.disagreements).toEqual([]);
  });

  it("'deduit' règles et IA : même arbitrage (accord 0,95, désaccord numérique aux règles)", () => {
    const agree = run({
      rules: brief({ 'effort.rythme': val('tranquille', 'deduit', 0.5) }),
      ai: brief({ 'effort.rythme': val('Tranquille', 'deduit', 0.6) }),
    });
    expect(get(agree.brief, 'effort.rythme')).toMatchObject({ source: 'deduit', confidence: 0.95, evidence: null });
    const clash = run({
      rules: brief({ 'effort.kmParJour': val(12, 'deduit', 0.5) }),
      ai: brief({ 'effort.kmParJour': val(18, 'deduit', 0.6) }),
    });
    expect(get(clash.brief, 'effort.kmParJour')).toMatchObject({ value: 12, confidence: 0.6 });
    expect(clash.disagreements).toEqual([{ path: 'effort.kmParJour', rules: 12, ai: 18, kept: 'rules' }]);
  });
});

describe('mergeBrief — vie privée (prive)', () => {
  it('a : profil et historique sortent avec prive true, même si l\'entrée disait false', () => {
    const r = run({
      profile: brief({ 'qui.niveau': val('debut', 'profil', 0.7, null, false, false) }),
      history: brief({ 'qui.allureKmH': val(4, 'historique', 0.7, null, false, false) }),
    });
    expect(get(r.brief, 'qui.niveau').prive).toBe(true);
    expect(get(r.brief, 'qui.allureKmH').prive).toBe(true);
  });

  it('a : les valeurs des défauts et des règles gardent le prive de leur entrée', () => {
    const r = run({
      phrase: PHRASE,
      rules: brief({
        'quand.jours': said(3, '3 jours'),
        'effort.rythme': val('tranquille', 'deduit', 0.5, null, false, true),
      }),
      defaults: brief({
        'budget.devise': val('EUR', 'defaut', 0.3),
        'effort.kmParJour': val(12, 'defaut', 0.3, null, false, true),
      }),
    });
    expect(get(r.brief, 'quand.jours').prive).toBe(false);
    expect(get(r.brief, 'effort.rythme').prive).toBe(true);
    expect(get(r.brief, 'budget.devise').prive).toBe(false);
    expect(get(r.brief, 'effort.kmParJour').prive).toBe(true);
  });

  it('c : accord règles / IA : prive est le OU logique des deux', () => {
    const mk = (a: boolean, b: boolean) =>
      get(
        run({
          rules: brief({ 'effort.rythme': val('tranquille', 'deduit', 0.5, null, false, a) }),
          ai: brief({ 'effort.rythme': val('tranquille', 'deduit', 0.5, null, false, b) }),
        }).brief,
        'effort.rythme'
      ).prive;
    expect(mk(false, false)).toBe(false);
    expect(mk(true, false)).toBe(true);
    expect(mk(false, true)).toBe(true);
    expect(mk(true, true)).toBe(true);
  });

  it('b : une valeur verrouillée prive ou de source profil/historique est ignorée', () => {
    const defaults = brief({ 'qui.niveau': val('regulier', 'defaut', 0.3) });
    const a = run({ stored: brief({ 'qui.niveau': val('debut', 'dit', 1, null, true, true) }), defaults });
    expect(get(a.brief, 'qui.niveau')).toMatchObject({ value: 'regulier', source: 'defaut', locked: false });
    const b = run({ stored: brief({ 'qui.niveau': val('debut', 'profil', 1, null, true, true) }), defaults });
    expect(get(b.brief, 'qui.niveau').value).toBe('regulier');
    const c = run({ stored: brief({ 'qui.niveau': val('debut', 'historique', 1, null, true, false) }), defaults });
    expect(get(c.brief, 'qui.niveau').value).toBe('regulier');
  });

  it('une valeur verrouillée publique garde prive false', () => {
    const r = run({ stored: brief({ 'qui.niveau': val('debut', 'dit', 1, null, true, false) }) });
    expect(get(r.brief, 'qui.niveau')).toMatchObject({ locked: true, prive: false });
  });
});

describe('mergeBrief — sources mal étiquetées', () => {
  it("profil : une valeur non 'profil' est ignorée ; idem historique et défaut", () => {
    const r = run({
      profile: brief({ 'qui.niveau': val('debut', 'dit', 0.9, 'x') }),
      history: brief({ 'qui.allureKmH': val(4, 'profil', 0.9) }),
      defaults: brief({ 'effort.rythme': val('normal', 'historique', 0.9) }),
    });
    expect(r.brief).toEqual(emptyBrief());
  });

  it("règles et IA : une valeur ni 'dit' ni 'deduit' est ignorée", () => {
    const r = run({
      phrase: PHRASE,
      rules: brief({ 'quand.jours': val(3, 'profil', 0.9) }),
      ai: brief({ 'quand.jours': val(3, 'defaut', 0.9) }),
    });
    expect(get(r.brief, 'quand.jours')).toEqual(emptyValue());
  });
});

describe('mergeBrief — pureté, déterminisme, conformité', () => {
  const phrase = "Randonnée à Annecy pendant 3 jours, peut-être quatre jours, au Lac d'Annecy";
  const input = (): MergeInput => ({
    ...base,
    phrase,
    stored: brief({ 'ou.depart': val('Lyon', 'dit', 1, null, true) }),
    rules: brief({
      'quand.jours': said(3, '3 jours'),
      'ou.destination': said('Annecy', 'Annecy'),
      'effort.rythme': val('normal', 'deduit', 0.4),
    }),
    ai: brief({
      'quand.jours': said(4, 'quatre jours'),
      'ou.destination': said("Lac d'Annecy", "Lac d'Annecy"),
      'projet.activite': said('hiking', 'Randonnée', 0.97),
    }),
    profile: brief({ 'qui.niveau': priv('debut', 'profil') }),
    history: brief({ 'qui.allureKmH': priv(4, 'historique') }),
    defaults: brief({ 'budget.devise': val('EUR', 'defaut', 0.3) }),
  });

  it('le résultat est conforme à briefSchema', () => {
    const r = mergeBrief(input());
    expect(briefSchema.safeParse(r.brief).success).toBe(true);
    expect(briefSchema.safeParse(mergeBrief(base).brief).success).toBe(true);
  });

  it("n'écrase aucune entrée", () => {
    const i = input();
    const copy = structuredClone(i);
    mergeBrief(i);
    expect(i).toEqual(copy);
  });

  it('le résultat ne partage aucune référence avec les entrées', () => {
    const i = input();
    i.rules = brief({ 'ou.envies': said(['lacs'], 'lacs') });
    const r = mergeBrief({ ...i, phrase: 'des lacs' });
    (get(r.brief, 'ou.envies').value as string[]).push('x');
    expect((get(i.rules, 'ou.envies').value as string[]).length).toBe(1);
  });

  it("est déterministe et l'ordre des désaccords suit briefPaths()", () => {
    const a = mergeBrief(input());
    const b = mergeBrief(input());
    expect(a).toEqual(b);
    const order = briefPaths();
    const idx = a.disagreements.map((d) => order.indexOf(d.path));
    expect(idx).toEqual([...idx].sort((x, y) => x - y));
    expect(a.disagreements.map((d) => d.path)).toEqual(['ou.destination', 'quand.jours']);
  });

  it('un Brief complet mêle les sources selon la priorité', () => {
    const r = mergeBrief(input());
    expect(get(r.brief, 'ou.depart').locked).toBe(true);
    expect(get(r.brief, 'projet.activite')).toMatchObject({ source: 'dit', confidence: 0.85 });
    expect(get(r.brief, 'qui.niveau').source).toBe('profil');
    expect(get(r.brief, 'qui.allureKmH').source).toBe('historique');
    expect(get(r.brief, 'effort.rythme').source).toBe('deduit');
    expect(get(r.brief, 'budget.devise').source).toBe('defaut');
  });
});
