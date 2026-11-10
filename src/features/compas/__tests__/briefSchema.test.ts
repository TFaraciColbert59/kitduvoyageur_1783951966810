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

describe('Brief — règle R5 (rien de privé sur le voyage partagé)', () => {
  const priv = (source: 'profil' | 'historique'): BriefValue<number> => ({
    value: 4.2,
    source,
    confidence: 0.8,
    evidence: null,
    locked: false,
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

  it('garde une valeur que la personne a elle-même verrouillée', () => {
    const b = withValue(emptyBrief(), 'qui.allureKmH', { ...priv('profil'), locked: true });
    expect(getValue(briefForStorage(b), 'qui.allureKmH').value).toBe(4.2);
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
    expect(v6Flags({ COMPAS_V6_CHECKS: '1' })).toEqual({ ...V6_OFF, checks: true });
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
