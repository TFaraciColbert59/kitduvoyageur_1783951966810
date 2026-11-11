import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  BRIEF_SCHEMA_VERSION,
  briefForStorage,
  briefIssues,
  briefPaths,
  briefSchema,
  dropInvalid,
  emptyBrief,
  emptyValue,
  evidenceInPhrase,
  getValue,
  derive,
  isStorable,
  SENSITIVE_PATHS,
  unmarkedPrivate,
  lockValue,
  valueInEvidence,
  parseStoredBrief,
  withValue,
  type BriefValue,
} from '../engine/brief/schema';
import { V6_OFF, v6Flags } from '../engine/v6Flags';

const said = <T>(value: T, evidence: string): BriefValue<T> => ({
  value,
  source: 'dit',
  confidence: 0.9,
  evidence,
  locked: false,
  prive: false,
});

describe('Brief — forme', () => {
  it('le Brief vide est conforme au schéma et chaque variable est absente', () => {
    const b = emptyBrief();
    expect(briefSchema.safeParse(b).success).toBe(true);
    for (const p of briefPaths()) expect(getValue(b, p)).toEqual(emptyValue());
  });

  it('compte onze blocs et au moins 70 variables, toutes distinctes', () => {
    const paths = briefPaths();
    expect(Object.keys(briefSchema.shape)).toHaveLength(11);
    expect(paths.length).toBeGreaterThanOrEqual(70);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("R1 : aucune variable n'est une coordonnée", () => {
    for (const p of briefPaths()) expect(p).not.toMatch(/\.(lat|lon|lng|latitude|longitude|coord)/i);
  });

  it('refuse une clé inconnue, une source inconnue, une confiance hors bornes', () => {
    const b = emptyBrief();
    expect(briefSchema.safeParse({ ...b, autre: {} }).success).toBe(false);
    expect(
      briefSchema.safeParse(withValue(b, 'quand.jours', { ...emptyValue(), source: 'ia' as never })).success
    ).toBe(false);
    expect(briefSchema.safeParse(withValue(b, 'quand.jours', { ...emptyValue(), confidence: 1.2 })).success).toBe(
      false
    );
  });

  it('refuse une valeur hors domaine (61 jours, activité inconnue, heure invalide)', () => {
    const b = emptyBrief();
    expect(briefSchema.safeParse(withValue(b, 'quand.jours', said(61, '61 jours'))).success).toBe(false);
    expect(briefSchema.safeParse(withValue(b, 'projet.activite', said('plongee', 'plongée'))).success).toBe(false);
    expect(briefSchema.safeParse(withValue(b, 'quand.heureDepart', said('25:00', '25h'))).success).toBe(false);
    expect(briefSchema.safeParse(withValue(b, 'quand.jours', said(5, '5 jours'))).success).toBe(true);
  });

  it('se convertit en schéma JSON (sortie contrainte de l’extraction)', () => {
    const json = z.toJSONSchema(briefSchema) as { type?: string; properties?: Record<string, unknown> };
    expect(json.type).toBe('object');
    expect(Object.keys(json.properties ?? {})).toHaveLength(11);
  });

  it('withValue ne modifie pas le Brief d’entrée', () => {
    const b = emptyBrief();
    const c = withValue(b, 'qui.personnes', said(3, 'à trois'));
    expect(getValue(b, 'qui.personnes').value).toBeNull();
    expect(getValue(c, 'qui.personnes').value).toBe(3);
  });
});

describe('Brief — règle R2 (la valeur dite cite la phrase)', () => {
  const phrase = 'Rando de 5 jours dans le Vercors à l’automne, avec mes 2 enfants';

  it('retrouve un passage malgré la casse, les apostrophes et les espaces insécables', () => {
    expect(evidenceInPhrase("à l'automne", phrase)).toBe(true);
    expect(evidenceInPhrase('5  JOURS', phrase)).toBe(true);
    expect(evidenceInPhrase('mes 2 enfants', phrase)).toBe(true);
  });

  it('refuse un passage absent, vide ou paraphrasé', () => {
    expect(evidenceInPhrase('cinq jours', phrase)).toBe(false);
    expect(evidenceInPhrase('', phrase)).toBe(false);
    expect(evidenceInPhrase(null, phrase)).toBe(false);
    expect(evidenceInPhrase('en automne', phrase)).toBe(false);
  });

  it('signale une valeur dite sans preuve, ou dont la preuve n’est pas dans la phrase', () => {
    let b = withValue(emptyBrief(), 'quand.jours', said(5, '5 jours'));
    b = withValue(b, 'qui.enfants', { ...said(2, ''), evidence: null });
    b = withValue(b, 'ou.destination', said('Chartreuse', 'en Chartreuse'));
    expect(briefIssues(b, phrase)).toEqual([
      { path: 'ou.destination', reason: 'preuve_absente_de_la_phrase' },
      { path: 'qui.enfants', reason: 'dit_sans_preuve' },
    ]);
  });

  it('signale une preuve portée par une valeur qui n’est pas dite', () => {
    const b = withValue(emptyBrief(), 'quand.mois', {
      value: 9,
      source: 'deduit',
      confidence: 0.7,
      evidence: 'automne',
      locked: false,
      prive: false,
    });
    expect(briefIssues(b, phrase, 'regles')).toEqual([{ path: 'quand.mois', reason: 'preuve_sur_source_non_dite' }]);
  });

  it('un lecteur de phrase ne verrouille rien et ne se dit ni profil ni défaut', () => {
    let b = withValue(emptyBrief(), 'quand.jours', { ...said(7, '7 jours'), locked: true });
    b = withValue(b, 'qui.niveau', { value: 'aguerri', source: 'profil', confidence: 0.9, evidence: null, locked: false, prive: true });
    b = withValue(b, 'effort.rythme', { value: 'soutenu', source: 'defaut', confidence: 0.3, evidence: null, locked: false, prive: false });
    for (const origin of ['regles', 'ia'] as const)
      expect(briefIssues(b, 'rando 7 jours', origin)).toEqual([
        { path: 'quand.jours', reason: 'verrou_interdit' },
        { path: 'qui.niveau', reason: 'source_interdite' },
        { path: 'effort.rythme', reason: 'source_interdite' },
      ]);
  });

  it('dropInvalid rend la valeur fautive « absente » et garde les autres', () => {
    let b = withValue(emptyBrief(), 'quand.jours', said(5, '5 jours'));
    b = withValue(b, 'ou.destination', said('Chartreuse', 'en Chartreuse'));
    const { brief, dropped } = dropInvalid(b, phrase);
    expect(dropped.map((d) => d.path)).toEqual(['ou.destination']);
    expect(getValue(brief, 'ou.destination')).toEqual(emptyValue());
    expect(getValue(brief, 'quand.jours').value).toBe(5);
    expect(briefIssues(brief, phrase)).toEqual([]);
  });
});

describe('Brief — la valeur sort-elle du passage ? (extraction IA)', () => {
  it('un nombre doit être dans le passage, en chiffres ou en lettres', () => {
    expect(valueInEvidence('quand.jours', 5, '5 jours')).toBe('oui');
    expect(valueInEvidence('quand.jours', 5, 'cinq jours')).toBe('oui');
    expect(valueInEvidence('quand.jours', 5, 'fünf Tage')).toBe('oui');
    expect(valueInEvidence('qui.personnes', 2, 'zu zweit')).toBe('oui');
    expect(valueInEvidence('quand.heures', 1.5, '1,5 h')).toBe('oui');
    expect(valueInEvidence('qui.personnes', 4, 'en famille')).toBe('non');
    expect(valueInEvidence('quand.jours', 3, 'un long week-end')).toBe('non');
    expect(valueInEvidence('quand.jours', 5, '15 jours')).toBe('non');
  });

  it('lit les chiffres pleine chasse (NFKC)', () => {
    expect(evidenceInPhrase('５日間', '北海道で５日間のハイキング')).toBe(true);
    expect(valueInEvidence('quand.jours', 5, '５日間')).toBe('oui');
  });

  it('refuse un passage d’un seul signe (toujours retrouvé en japonais ou en chinois)', () => {
    expect(evidenceInPhrase('日', '北海道で５日間のハイキング')).toBe(false);
    expect(evidenceInPhrase('a', 'rando a Annecy')).toBe(false);
  });

  it('un nom doit figurer tel quel dans le passage', () => {
    expect(valueInEvidence('ou.destination', 'Vercors', 'dans le Vercors')).toBe('oui');
    expect(valueInEvidence('ou.destination', 'Chartreuse', 'dans le Vercors')).toBe('non');
    expect(valueInEvidence('ou.envies', ['lacs', 'refuges'], 'des lacs et des refuges')).toBe('oui');
    expect(valueInEvidence('ou.envies', ['lacs', 'glaciers'], 'des lacs et des refuges')).toBe('non');
  });

  it('un choix dans une liste est une lecture : le passage suffit', () => {
    expect(valueInEvidence('projet.activite', 'hiking', 'rando')).toBe('oui');
    expect(valueInEvidence('qui.peurDuVide', true, 'j’ai le vertige')).toBe('oui');
  });

  it('l’IA ne fournit pas une date, ni un nombre absent du passage ; les règles calculent les leurs', () => {
    const phrase = 'en famille le week-end prochain';
    let b = withValue(emptyBrief(), 'quand.dateDebut', said('2026-11-14', 'le week-end prochain'));
    b = withValue(b, 'qui.personnes', said(4, 'en famille'));
    expect(briefIssues(b, phrase, 'ia')).toEqual([
      { path: 'quand.dateDebut', reason: 'date_non_confirmee' },
      { path: 'qui.personnes', reason: 'valeur_absente_du_passage' },
    ]);
    expect(briefIssues(b, phrase, 'regles')).toEqual([]);
    expect(getValue(dropInvalid(b, phrase, 'ia').brief, 'quand.dateDebut')).toEqual(emptyValue());
  });
});

describe('Brief — contournements fermés (seconde relecture)', () => {
  const phrase = 'rando dans le Vercors le week-end prochain, en famille';
  const deduced = <T>(value: T): BriefValue<T> => ({ value, source: 'deduit', confidence: 0.7, evidence: null, locked: false, prive: false });

  it('l’IA ne fait pas passer une date en la disant « déduite »', () => {
    const b = withValue(emptyBrief(), 'quand.dateDebut', deduced('2027-01-01'));
    expect(briefIssues(b, phrase, 'ia')).toEqual([{ path: 'quand.dateDebut', reason: 'date_non_confirmee' }]);
    expect(briefIssues(b, phrase, 'regles')).toEqual([]);
  });

  it('l’IA ne fait pas passer un nombre, une liste de nombres ou une heure en les disant « déduits »', () => {
    let b = withValue(emptyBrief(), 'qui.personnes', deduced(4));
    b = withValue(b, 'qui.agesEnfants', deduced([6, 9]));
    b = withValue(b, 'quand.heureDepart', deduced('08:00'));
    b = withValue(b, 'quand.saison', deduced('automne' as const));
    expect(briefIssues(b, phrase, 'ia').map((i) => [i.path, i.reason])).toEqual([
      ['quand.heureDepart', 'deduction_chiffree_interdite'],
      ['qui.personnes', 'deduction_chiffree_interdite'],
      ['qui.agesEnfants', 'deduction_chiffree_interdite'],
    ]);
  });

  it('un nombre en lettres est un mot entier : « septembre » ne dit pas 7, « seulement » ne dit pas 1', () => {
    expect(valueInEvidence('quand.jours', 7, 'en septembre')).toBe('non');
    expect(valueInEvidence('quand.jours', 9, 'en novembre')).toBe('non');
    expect(valueInEvidence('qui.personnes', 1, 'seulement le matin')).toBe('non');
    expect(valueInEvidence('qui.personnes', 1, 'une semaine')).toBe('non');
    expect(valueInEvidence('qui.personnes', 1, 'toute seule')).toBe('oui');
  });

  it('un seul nombre par passage : « 2 adultes et 3 enfants » ne prouve ni 2 ni 3', () => {
    expect(valueInEvidence('qui.enfants', 2, '2 adultes et 3 enfants')).toBe('non');
    expect(valueInEvidence('qui.enfants', 3, '2 adultes et 3 enfants')).toBe('non');
    expect(valueInEvidence('qui.enfants', 3, '3 enfants')).toBe('oui');
    expect(valueInEvidence('qui.agesEnfants', [6, 9], 'mes enfants de 6 et 9 ans')).toBe('oui');
    expect(valueInEvidence('qui.agesEnfants', [6, 8], 'mes enfants de 6 et 9 ans')).toBe('non');
  });

  it('citer toute la phrase ne prouve pas un nombre', () => {
    const long = 'je voudrais partir marcher 5 jours quelque part de beau avec des amis et dormir en refuge';
    expect(valueInEvidence('quand.jours', 5, long)).toBe('non');
  });

  it('un nom d’un seul signe ne prouve rien', () => {
    expect(valueInEvidence('ou.destination', 'a', 'à la mer')).toBe('non');
  });

  it('un mois se dit par son nom, dans les cinq langues ; « le mois prochain » ne le dit pas', () => {
    expect(valueInEvidence('quand.mois', 4, 'fin avril')).toBe('oui');
    expect(valueInEvidence('quand.mois', 8, 'im August')).toBe('oui');
    expect(valueInEvidence('quand.mois', 6, 'a giugno')).toBe('oui');
    expect(valueInEvidence('quand.mois', 1, 'en enero')).toBe('oui');
    expect(valueInEvidence('quand.mois', 3, 'in March')).toBe('oui');
    expect(valueInEvidence('quand.mois', 5, 'fin avril')).toBe('non');
    expect(valueInEvidence('quand.mois', 12, 'le mois prochain')).toBe('non');
    expect(valueInEvidence('quand.mois', 4, 'entre avril et juin')).toBe('non');
  });

  it('une déduction hérite de la confidentialité de ses entrées', () => {
    const home: BriefValue<string> = { value: 'CH', source: 'profil', confidence: 0.9, evidence: null, locked: false, prive: true };
    const dest = said('Chamonix', 'à Chamonix');
    expect(derive('CHF', [home, dest])).toMatchObject({ source: 'deduit', prive: true, evidence: null, locked: false });
    expect(derive('EUR', [dest]).prive).toBe(false);
    expect(derive('x', [dest, home], 0.95).confidence).toBe(0.9);
    const b = withValue(emptyBrief(), 'budget.devise', derive('CHF', [home]));
    expect(getValue(briefForStorage(b), 'budget.devise')).toEqual(emptyValue());
  });
});

describe('Brief — règle R5 (rien de privé sur le voyage partagé)', () => {
  const priv = (source: 'profil' | 'historique'): BriefValue<number> => ({
    value: 4.2,
    source,
    confidence: 0.8,
    evidence: null,
    locked: false,
    prive: true,
  });

  it('retire les valeurs de profil et d’historique avant écriture', () => {
    let b = withValue(emptyBrief(), 'qui.allureKmH', priv('historique'));
    b = withValue(b, 'qui.deniveleParHeure', { ...priv('profil'), value: 400 });
    b = withValue(b, 'quand.jours', said(5, '5 jours'));
    expect(isStorable(b)).toBe(false);
    const stored = briefForStorage(b);
    expect(isStorable(stored)).toBe(true);
    expect(getValue(stored, 'qui.allureKmH')).toEqual(emptyValue());
    expect(getValue(stored, 'qui.deniveleParHeure')).toEqual(emptyValue());
    expect(getValue(stored, 'quand.jours').value).toBe(5);
    expect(JSON.stringify(stored)).not.toMatch(/"(profil|historique)"/);
  });

  it('retire aussi une valeur DÉDUITE du profil (devise tirée du pays de résidence)', () => {
    const b = withValue(emptyBrief(), 'budget.devise', {
      value: 'CHF',
      source: 'deduit',
      confidence: 0.7,
      evidence: null,
      locked: false,
      prive: true,
    });
    expect(isStorable(b)).toBe(false);
    expect(getValue(briefForStorage(b), 'budget.devise')).toEqual(emptyValue());
  });

  it('un verrou ne fait pas passer une valeur privée : seul lockValue la rend rangeable', () => {
    const forced = withValue(emptyBrief(), 'qui.allureKmH', { ...priv('profil'), locked: true });
    expect(getValue(briefForStorage(forced), 'qui.allureKmH')).toEqual(emptyValue());
    const chosen = withValue(emptyBrief(), 'qui.allureKmH', lockValue(4.2));
    expect(isStorable(chosen)).toBe(true);
    expect(getValue(briefForStorage(chosen), 'qui.allureKmH')).toEqual({
      value: 4.2,
      source: 'dit',
      confidence: 1,
      evidence: null,
      locked: true,
      prive: false,
    });
  });

  it('ne range aucun passage de la phrase, même sur une valeur nulle', () => {
    let b = withValue(emptyBrief(), 'qui.animal', said('chien' as const, 'avec mon chien, depuis mon accident'));
    b = withValue(b, 'qui.poussette', { ...emptyValue(), evidence: 'j’ai une prothèse' });
    expect(isStorable(b)).toBe(false);
    const stored = briefForStorage(b);
    expect(isStorable(stored)).toBe(true);
    expect(getValue(stored, 'qui.animal')).toMatchObject({ value: 'chien', source: 'dit', evidence: null });
    expect(getValue(stored, 'qui.poussette')).toEqual(emptyValue());
    expect(JSON.stringify(stored)).not.toMatch(/accident|prothèse/);
  });

  it('ne range jamais une variable sensible (santé, conviction), même posée par la personne', () => {
    expect([...SENSITIVE_PATHS].sort()).toEqual(
      ['qui.malDesTransports', 'qui.mobiliteReduite', 'qui.peurDuVide', 'repas.allergies', 'repas.regime'].sort()
    );
    let b = withValue(emptyBrief(), 'repas.regime', said('halal' as const, 'je mange halal'));
    b = withValue(b, 'qui.peurDuVide', lockValue(true));
    b = withValue(b, 'repas.allergies', said(['arachide'], 'allergique à l’arachide'));
    expect(isStorable(b)).toBe(false);
    const stored = briefForStorage(b);
    for (const p of ['repas.regime', 'qui.peurDuVide', 'repas.allergies'] as const)
      expect(getValue(stored, p)).toEqual(emptyValue());
    expect(JSON.stringify(stored)).not.toMatch(/halal|arachide/);
  });

  it('repère une surcouche privée qui ne porte pas la marque « prive »', () => {
    const b = withValue(emptyBrief(), 'qui.allureKmH', { ...priv('historique'), prive: false });
    expect(unmarkedPrivate(b)).toEqual(['qui.allureKmH']);
    expect(unmarkedPrivate(withValue(emptyBrief(), 'qui.allureKmH', priv('historique')))).toEqual([]);
  });

  it('une version inconnue ou un jsonb abîmé rend « pas de Brief »', () => {
    const b = emptyBrief();
    expect(parseStoredBrief(b, BRIEF_SCHEMA_VERSION)).toEqual(b);
    expect(parseStoredBrief(b, BRIEF_SCHEMA_VERSION + 1)).toBeNull();
    expect(parseStoredBrief({ projet: {} }, BRIEF_SCHEMA_VERSION)).toBeNull();
    expect(parseStoredBrief(null, BRIEF_SCHEMA_VERSION)).toBeNull();
  });
});

describe('Interrupteurs v6', () => {
  it('tout est éteint par défaut, et pour toute valeur autre que « 1 »', () => {
    expect(v6Flags({})).toEqual(V6_OFF);
    expect(v6Flags({ COMPAS_V6_BRIEF: 'true', COMPAS_V6_CHECKS: '0', COMPAS_V6_GRAPH: ' 1' })).toEqual(V6_OFF);
  });

  it('un maillon reste éteint tant que son prérequis l’est', () => {
    expect(v6Flags({ COMPAS_V6_ARCHETYPES: '1', COMPAS_V6_GRAPH: '1', COMPAS_V6_PLANNER: '1' })).toEqual(V6_OFF);
    expect(v6Flags({ COMPAS_V6_BRIEF: '1', COMPAS_V6_ARCHETYPES: '1', COMPAS_V6_PLANNER: '1' }).planner).toBe(false);
  });

  it('s’allume un à un', () => {
    expect(v6Flags({ COMPAS_V6_BRIEF: '1' })).toEqual({ ...V6_OFF, brief: true });
    expect(v6Flags({ COMPAS_V6_CHECKS: '1' })).toEqual(V6_OFF);
    expect(v6Flags({ COMPAS_V6_BRIEF: '1', COMPAS_V6_CHECKS: '1' })).toEqual({ ...V6_OFF, brief: true, checks: true });
    expect(
      v6Flags({
        COMPAS_V6_BRIEF: '1',
        COMPAS_V6_ARCHETYPES: '1',
        COMPAS_V6_CHECKS: '1',
        COMPAS_V6_PLANNER: '1',
        COMPAS_V6_GRAPH: '1',
      })
    ).toEqual({ brief: true, archetypes: true, checks: true, planner: true, graph: true });
  });
});
