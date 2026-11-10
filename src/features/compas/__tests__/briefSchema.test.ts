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
  isStorable,
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
    expect(briefIssues(b, phrase)).toEqual([{ path: 'quand.mois', reason: 'preuve_sur_source_non_dite' }]);
  });

  it('une valeur verrouillée par la personne n’a pas à citer la phrase', () => {
    const b = withValue(emptyBrief(), 'quand.jours', { ...said(7, ''), evidence: null, locked: true });
    expect(briefIssues(b, phrase)).toEqual([]);
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

  it('ne range aucun passage de la phrase', () => {
    const b = withValue(emptyBrief(), 'qui.peurDuVide', said(true, 'j’ai le vertige depuis mon accident'));
    expect(isStorable(b)).toBe(false);
    const stored = briefForStorage(b);
    expect(isStorable(stored)).toBe(true);
    expect(getValue(stored, 'qui.peurDuVide')).toMatchObject({ value: true, source: 'dit', evidence: null });
    expect(JSON.stringify(stored)).not.toContain('accident');
  });

  it('signale une source privée qui ne porte pas la marque « prive »', () => {
    const b = withValue(emptyBrief(), 'qui.allureKmH', { ...priv('historique'), prive: false });
    expect(briefIssues(b, 'x')).toEqual([{ path: 'qui.allureKmH', reason: 'source_privee_non_marquee' }]);
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
