import { describe, expect, it } from 'vitest';
import {
  actionLabel,
  groundingIssue,
  intentActionSchema,
  mergeActions,
  parseIntentRules,
  validateActions,
  type IntentContext,
} from '../engine/intent';
import { buildCompasIntentSystem, parseCompasIntentOutput } from '@/lib/ai/features/compasIntent';

// Vendredi 9 octobre 2026.
const TODAY = '2026-10-09';
const ctx: IntentContext = {
  today: TODAY,
  startDate: null,
  endDate: null,
  engaged: 0,
  currency: 'EUR',
  avoid: [],
  wishes: [],
};
/** Départ et destination lus par les règles, dans l'ordre. */
const places = (text: string) =>
  parseIntentRules(text, TODAY).filter((a) => a.type === 'set_origin' || a.type === 'set_destination');

describe('« depuis X » : le lieu de départ, jamais la destination', () => {
  it('« rando 3 jours dans le Vercors depuis Lyon » : destination Vercors, départ Lyon', () => {
    const a = parseIntentRules('rando 3 jours dans le Vercors depuis Lyon', TODAY);
    expect(a).toContainEqual({ type: 'set_destination', place: 'Vercors' });
    expect(a).toContainEqual({ type: 'set_origin', place: 'Lyon' });
    expect(a).not.toContainEqual({ type: 'set_destination', place: 'Lyon' });
    expect(a).not.toContainEqual({ type: 'set_destination', place: 'Vercors depuis Lyon' });
    expect(a).toContainEqual({ type: 'search_route', query: 'Vercors' });
  });

  it('« au départ de Genève » → départ Genève, aucune destination', () => {
    expect(places('au départ de Genève')).toEqual([{ type: 'set_origin', place: 'Genève' }]);
  });

  it('le dernier recours ne prend plus le lieu de départ pour la destination', () => {
    expect(places('rando 3 jours depuis Lyon')).toEqual([{ type: 'set_origin', place: 'Lyon' }]);
    expect(places('ski 2 jours depuis Lyon avec Paul')).toEqual([{ type: 'set_origin', place: 'Lyon' }]);
  });

  it('les quatre tournures, l’article et l’élision', () => {
    expect(places('trek 5 jours en Sardaigne au départ de Lyon')).toEqual([
      { type: 'set_origin', place: 'Lyon' },
      { type: 'set_destination', place: 'Sardaigne' },
    ]);
    expect(places('week-end en Corse en partant de Marseille')).toEqual([
      { type: 'set_origin', place: 'Marseille' },
      { type: 'set_destination', place: 'Corse' },
    ]);
    expect(places('on part de Grenoble pour 2 jours dans le Vercors')).toEqual([
      { type: 'set_origin', place: 'Grenoble' },
      { type: 'set_destination', place: 'Vercors' },
    ]);
    expect(places("rando dans le Vercors au départ d'Annecy")).toEqual([
      { type: 'set_origin', place: 'Annecy' },
      { type: 'set_destination', place: 'Vercors' },
    ]);
    expect(places('trek en Islande depuis la Suisse')).toEqual([
      { type: 'set_origin', place: 'Suisse' },
      { type: 'set_destination', place: 'Islande' },
    ]);
    expect(places('rando au départ du Grand-Bornand')).toEqual([{ type: 'set_origin', place: 'Grand-Bornand' }]);
    expect(places('depuis Lyon, 3 jours en Ardèche')).toEqual([
      { type: 'set_origin', place: 'Lyon' },
      { type: 'set_destination', place: 'Ardèche' },
    ]);
  });

  it('phrase tapée sans majuscule : « depuis lyon » ; « depuis longtemps » n’est pas un lieu', () => {
    expect(places('rando 3 jours dans le vercors depuis lyon')).toEqual([
      { type: 'set_origin', place: 'Lyon' },
      { type: 'set_destination', place: 'Vercors' },
    ]);
    expect(places('rando dans les vosges depuis longtemps')).toEqual([
      { type: 'set_destination', place: 'Vosges' },
    ]);
  });

  it('CONTRE-EXEMPLES : « depuis 3 ans », « depuis Noël » ne sont pas des départs', () => {
    expect(places('depuis 3 ans je rêve du Népal')).toEqual([{ type: 'set_destination', place: 'Népal' }]);
    expect(places('rando depuis Noël')).toEqual([]);
  });

  it('un nom qui commence comme un mois reste un lieu (« Marseille », « Octon »), un mois non', () => {
    expect(places('week-end à Marseille')).toEqual([{ type: 'set_destination', place: 'Marseille' }]);
    expect(places('trek à Octon')).toEqual([{ type: 'set_destination', place: 'Octon' }]);
    expect(places('5 jours en avril à 3')).toEqual([]);
  });
});

describe('l’action set_origin', () => {
  it('schéma : un nom de 1 à 80 caractères', () => {
    expect(intentActionSchema.safeParse({ type: 'set_origin', place: 'Lyon' }).success).toBe(true);
    expect(intentActionSchema.safeParse({ type: 'set_origin', place: ' ' }).success).toBe(false);
    expect(intentActionSchema.safeParse({ type: 'set_origin', place: 'x'.repeat(81) }).success).toBe(false);
  });

  it('libellé « Départ : X », proposé tel quel', () => {
    expect(actionLabel({ type: 'set_origin', place: 'Lyon' })).toBe('Départ : Lyon');
    const [p] = validateActions([{ action: { type: 'set_origin', place: 'Genève' }, source: 'regles' }], ctx);
    expect(p).toMatchObject({ ok: true, label: 'Départ : Genève', reason: null });
  });

  it('ancrage : un départ absent de la phrase est refusé', () => {
    expect(groundingIssue({ type: 'set_origin', place: 'Lyon' }, 'rando depuis Lyon')).toBeNull();
    expect(groundingIssue({ type: 'set_origin', place: 'Paris' }, 'rando depuis Lyon')).toBe('Lieu absent de ta phrase');
  });

  it('l’IA ne fait pas du lieu de départ dit la destination', () => {
    const rules = parseIntentRules('rando 3 jours depuis Lyon', TODAY);
    const merged = mergeActions([{ type: 'set_destination', place: 'Lyon' }], rules).map((m) => m.action);
    expect(merged).not.toContainEqual({ type: 'set_destination', place: 'Lyon' });
    expect(merged).toContainEqual({ type: 'set_origin', place: 'Lyon' });
  });
});

describe('contrat de l’IA', () => {
  it('liste set_origin et dit que « depuis Lyon » est un départ', () => {
    const system = buildCompasIntentSystem();
    expect(system).toContain('{"type": "set_origin", "place":');
    expect(system).toMatch(/« depuis Lyon ».*= set_origin/);
    expect(parseCompasIntentOutput({ actions: [{ type: 'set_origin', place: 'Lyon' }] })).toEqual([
      { type: 'set_origin', place: 'Lyon' },
    ]);
  });
});
