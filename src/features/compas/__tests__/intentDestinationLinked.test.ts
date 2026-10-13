import { describe, expect, it } from 'vitest';
import {
  intentActionSchema,
  linkedDestinationOf,
  linkedOriginOf,
  mergeActions,
  parseIntentRules,
  settleLinkedDestination,
  settleLinkedOrigin,
  validateActions,
  type CompasIntentAction,
  type IntentContext,
} from '../engine/intent';

/**
 * « à Bourg en Bresse », « à La Roche sur Yon », « à Neuilly sur Seine » : même arbitrage pour la
 * destination que pour le départ (`originInterpret.test.ts`, `intentOrigin.test.ts`). Le nom court
 * reste lu, le nom long est proposé à côté ; la carte tranche (`settleLinkedDestination`).
 */
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
const rules = (text: string) => parseIntentRules(text, TODAY);
const destination = (text: string) => rules(text).find((a) => a.type === 'set_destination');
const destinations = (list: readonly CompasIntentAction[]) =>
  list.filter((a) => a.type === 'set_destination');

describe('« à Bourg en Bresse » : « en » et « sur » peuvent faire partie du nom de la destination', () => {
  it('le nom court reste la destination, le nom long est proposé à côté', () => {
    expect(destination('rando 3 jours à Bourg en Bresse')).toEqual({
      type: 'set_destination',
      place: 'Bourg',
      longer: 'Bourg en Bresse',
    });
    expect(destination('week-end à Neuilly sur Seine')).toEqual({
      type: 'set_destination',
      place: 'Neuilly',
      longer: 'Neuilly sur Seine',
    });
    expect(destination('rando à Aix en Provence pour 3 jours')).toEqual({
      type: 'set_destination',
      place: 'Aix',
      longer: 'Aix en Provence',
    });
  });

  it('l’article tombé avec la préposition revient dans le nom long (« à La Roche sur Yon »)', () => {
    expect(destination('rando à La Roche sur Yon 3 jours')).toMatchObject({
      longer: 'La Roche sur Yon',
    });
    expect(destination('rando à la Roche sur Yon 3 jours')).toMatchObject({
      longer: 'La Roche sur Yon',
    });
    expect(destination('rando dans le Puy en Velay')).toMatchObject({ longer: 'Le Puy en Velay' });
  });

  it('« sur le », « sur la » décrivent un lieu : pas de nom long (contrairement au départ)', () => {
    expect(destination('randonnée 5 jours en Corse sur le Mare a Mare')).toEqual({
      type: 'set_destination',
      place: 'Corse',
    });
    expect(destination('rando en Dordogne sur la Vézère')).not.toHaveProperty('longer');
    expect(destination('rando a annecy sur le lac')).not.toHaveProperty('longer');
    expect(destination('randoo en corse sur le mare a mare')).not.toHaveProperty('longer');
    // Le départ, lui, garde « L'Isle sur la Sorgue » (originInterpret.test.ts).
    expect(rules('rando depuis L’Isle sur la Sorgue')).toContainEqual({
      type: 'set_origin',
      place: 'L’Isle',
      longer: 'L’Isle sur la Sorgue',
    });
  });

  it('tapé en minuscules, avec les mêmes garde-fous', () => {
    expect(destination('rando 3 jours a bourg en bresse')).toEqual({
      type: 'set_destination',
      place: 'Bourg',
      longer: 'Bourg en bresse',
    });
    expect(destination('rando a neuilly sur seine')).toMatchObject({
      place: 'Neuilly',
      longer: 'Neuilly sur seine',
    });
    expect(destination('rando dans la roche sur yon')).toMatchObject({
      place: 'Roche',
      longer: 'La Roche sur yon',
    });
  });

  it.each([
    'week-end à Lyon en train',
    'week-end à Lyon en voiture',
    'rando en Corse en juin',
    'rando en Corse en Juin',
    'rando à Annecy en famille',
    'rando à Lyon sur 3 jours',
    'trek en Corse',
    'rando à Annecy',
    'randoo 3 jours dans les vosges en juin',
    'rando dans les vosges pour 3 jours',
    'randoo a annecy en famille',
  ])('« %s » : pas de nom long à proposer', (text) => {
    expect(destination(text)).not.toHaveProperty('longer');
  });

  it('« et » liste deux lieux, il n’ouvre pas de nom long pour une destination', () => {
    expect(destination('week-end à Lyon et Grenoble')).not.toHaveProperty('longer');
    expect(destination('rando au Maroc et en Espagne')).not.toHaveProperty('longer');
    expect(destination('randoo dans les vosges et le jura')).not.toHaveProperty('longer');
  });

  it('« depuis Lyon en Corse » se lit comme avant : départ Lyon (nom long proposé), destination Corse', () => {
    const a = rules('5 jours depuis Lyon en Corse');
    expect(a).toContainEqual({ type: 'set_origin', place: 'Lyon', longer: 'Lyon en Corse' });
    expect(a).toContainEqual({ type: 'set_destination', place: 'Corse' });
    expect(linkedDestinationOf(a)).toBeNull();
  });

  it('« depuis Bourg en Bresse » : le bout du nom reste une destination possible, sans nom long', () => {
    const a = rules('rando 3 jours depuis Bourg en Bresse');
    expect(a).toContainEqual({ type: 'set_origin', place: 'Bourg', longer: 'Bourg en Bresse' });
    expect(a).toContainEqual({ type: 'set_destination', place: 'Bresse' });
    expect(linkedDestinationOf(a)).toBeNull();
  });

  it('un départ et une destination à nom long dans la même phrase : chacun garde le sien', () => {
    const a = rules('depuis Bourg en Bresse à Aix en Provence');
    expect(linkedOriginOf(a)).toEqual({ place: 'Bourg', longer: 'Bourg en Bresse' });
    expect(linkedDestinationOf(a)).toEqual({ place: 'Aix', longer: 'Aix en Provence' });
  });

  it('un départ sans nom long ne gêne pas : « depuis Lyon à Bourg en Bresse »', () => {
    const a = rules('depuis Lyon à Bourg en Bresse');
    expect(a).toContainEqual({ type: 'set_origin', place: 'Lyon' });
    expect(linkedDestinationOf(a)).toEqual({ place: 'Bourg', longer: 'Bourg en Bresse' });
  });

  it('schéma : le nom long de la destination est facultatif, de 1 à 80 caractères', () => {
    const ok = { type: 'set_destination', place: 'Bourg', longer: 'Bourg en Bresse' };
    expect(intentActionSchema.safeParse(ok).success).toBe(true);
    expect(intentActionSchema.safeParse({ type: 'set_destination', place: 'Bourg' }).success).toBe(
      true
    );
    expect(intentActionSchema.safeParse({ ...ok, longer: 'x'.repeat(81) }).success).toBe(false);
    expect(intentActionSchema.safeParse({ ...ok, longer: '  ' }).success).toBe(false);
  });
});

describe('destination à nom long : ce que la carte a tranché', () => {
  it('nom long confirmé : il devient la destination', () => {
    const actions = rules('rando 3 jours à Bourg en Bresse');
    const link = linkedDestinationOf(actions);
    expect(link).toEqual({ place: 'Bourg', longer: 'Bourg en Bresse' });
    const settled = settleLinkedDestination(actions, link, true);
    expect(destinations(settled)).toEqual([{ type: 'set_destination', place: 'Bourg en Bresse' }]);
  });

  it('nom long inconnu de la carte : la destination est le nom court, comme avant', () => {
    const actions = rules('rando 3 jours à Bourg en Bresse');
    const settled = settleLinkedDestination(actions, linkedDestinationOf(actions), false);
    expect(destinations(settled)).toEqual([{ type: 'set_destination', place: 'Bourg' }]);
  });

  it.each(['La Roche sur Yon', 'Neuilly sur Seine'])(
    '« %s » confirmé : le nom long, sans « longer »',
    (long) => {
      const actions = rules(`week-end à ${long}`);
      const settled = settleLinkedDestination(actions, linkedDestinationOf(actions), true);
      expect(destinations(settled)).toEqual([{ type: 'set_destination', place: long }]);
      expect(settled.some((a) => 'longer' in a)).toBe(false);
    }
  );

  it('le nom long ne sort jamais, confirmé ou non', () => {
    const actions = rules('rando à Aix en Provence');
    for (const accepted of [true, false])
      expect(
        settleLinkedDestination(actions, linkedDestinationOf(actions), accepted).some(
          (a) => 'longer' in a
        )
      ).toBe(false);
  });

  it('l’IA qui reprend le nom court devient le nom long confirmé ; une autre destination ne bouge pas', () => {
    const link = { place: 'Bourg', longer: 'Bourg en Bresse' };
    expect(
      settleLinkedDestination([{ type: 'set_destination', place: 'Bourg' }], link, true)
    ).toEqual([{ type: 'set_destination', place: 'Bourg en Bresse' }]);
    expect(
      settleLinkedDestination([{ type: 'set_destination', place: 'Corse' }], link, true)
    ).toEqual([{ type: 'set_destination', place: 'Corse' }]);
    expect(
      settleLinkedDestination([{ type: 'set_destination', place: 'Bourg' }], link, false)
    ).toEqual([{ type: 'set_destination', place: 'Bourg' }]);
  });

  it('le départ et le reste passent tels quels', () => {
    const others: CompasIntentAction[] = [
      { type: 'set_origin', place: 'Bourg', longer: 'Bourg en Bresse' },
      { type: 'set_party_size', count: 4 },
    ];
    expect(
      settleLinkedDestination(others, { place: 'Aix', longer: 'Aix en Provence' }, true)
    ).toEqual(others);
    expect(settleLinkedDestination(others, null, false)).toEqual(others);
  });

  it('sans nom long, rien ne bouge', () => {
    const plain = rules('rando à Annecy');
    expect(linkedDestinationOf(plain)).toBeNull();
    expect(settleLinkedDestination(plain, null, false)).toEqual(plain);
  });

  it('départ puis destination, chacun tranché à part : toutes les combinaisons', () => {
    const actions = rules('depuis Bourg en Bresse à Aix en Provence');
    const origin = linkedOriginOf(actions);
    const dest = linkedDestinationOf(actions);
    const read = (originKnown: boolean, destKnown: boolean) =>
      settleLinkedDestination(settleLinkedOrigin(actions, origin, originKnown), dest, destKnown);
    const places = (list: readonly CompasIntentAction[]) =>
      list.flatMap((a) =>
        a.type === 'set_origin' || a.type === 'set_destination' ? [[a.type, a.place]] : []
      );
    expect(places(read(true, true))).toEqual([
      ['set_origin', 'Bourg en Bresse'],
      ['set_destination', 'Aix en Provence'],
    ]);
    expect(places(read(true, false))).toEqual([
      ['set_origin', 'Bourg en Bresse'],
      ['set_destination', 'Aix'],
    ]);
    expect(places(read(false, true))).toEqual([
      ['set_origin', 'Bourg'],
      ['set_destination', 'Aix en Provence'],
    ]);
    expect(places(read(false, false))).toEqual([
      ['set_origin', 'Bourg'],
      ['set_destination', 'Aix'],
    ]);
  });

  it('proposée à l’écran, la destination confirmée a son nom long pour libellé', () => {
    const actions = rules('rando 3 jours à Bourg en Bresse');
    const settled = settleLinkedDestination(actions, linkedDestinationOf(actions), true);
    const proposals = validateActions(
      mergeActions([], settled).map((m) => ({ action: m.action, source: m.source })),
      ctx
    );
    expect(proposals.find((p) => p.action.type === 'set_destination')).toMatchObject({
      ok: true,
      label: expect.stringContaining('Bourg en Bresse'),
    });
  });
});
