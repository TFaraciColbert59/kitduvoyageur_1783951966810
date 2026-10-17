import { describe, expect, it, vi } from 'vitest';

/**
 * « GR34 en 8 jours » : la compréhension remplace le code par la région (« Bretagne »)
 * pour que le sentier reste une envie. La référence du sentier voyage maintenant à côté,
 * dans un champ `trail` de la proposition de destination, jusqu'à l'action serveur
 * (référentiel `geo_trails`). Le lieu proposé et les envies ne changent pas.
 */
vi.mock('@/app/voyages/kit-actions', () => ({ addCustomTripItemAction: vi.fn() }));
vi.mock('../server/compasActions', () => ({
  compasSetActivityAction: vi.fn(),
  compasSetBudgetAction: vi.fn(),
  compasSetDatesAction: vi.fn(),
  compasSetPartySizeAction: vi.fn(),
  compasSetPreferencesAction: vi.fn(),
  compasSetDestinationAction: vi.fn(async () => ({ success: true })),
  compasSetOriginAction: vi.fn(),
  compasSetSpanAction: vi.fn(),
}));

import {
  intentActionSchema,
  mergeActions,
  parseIntentRules,
  planApplication,
  validateActions,
  type ApplyCurrent,
  type CompasIntentAction,
} from '../engine/intent';
import { runOps } from '../components/compasApply';
import type { CompasCtl } from '../components/compasTypes';
import { compasSetDestinationAction } from '../server/compasActions';

const TODAY = '2026-10-17';
const destinationOf = (actions: CompasIntentAction[]) =>
  actions.find((a) => a.type === 'set_destination');
const ctx = {
  today: TODAY,
  startDate: null,
  endDate: null,
  engaged: 0,
  currency: 'EUR',
  avoid: [],
  wishes: [],
  partySize: null,
};
const current: ApplyCurrent = {
  startDate: null,
  endDate: null,
  days: null,
  shortHours: null,
  preferences: { pace: 'normal', nights: null, avoid: [], wishes: [] },
  hasRoute: false,
};

describe('référence du sentier portée par la proposition de destination', () => {
  it('« GR34 en 8 jours » : région Bretagne en repli ET référence GR34', () => {
    expect(destinationOf(parseIntentRules('GR34 en 8 jours', TODAY))).toEqual({
      type: 'set_destination',
      place: 'Bretagne',
      trail: 'GR34',
    });
    expect(destinationOf(parseIntentRules('le gr 34 en 8 jours', TODAY))).toMatchObject({
      place: 'Bretagne',
      trail: 'GR34',
    });
  });

  it('phrase sans code de sentier : pas de champ trail', () => {
    for (const text of [
      'trek 5 jours dans le Vercors',
      '10 jours en Norvège dans les fjords',
      'Tour du Mont-Blanc en 10 jours',
    ]) {
      const dest = destinationOf(parseIntentRules(text, TODAY));
      expect(dest).toBeDefined();
      expect(dest).not.toHaveProperty('trail');
    }
  });

  it('« GR5 » n’est pas « GR50 »', () => {
    expect(destinationOf(parseIntentRules('le GR5 en 10 jours', TODAY))).toEqual({
      type: 'set_destination',
      place: 'Alpes',
      trail: 'GR5',
    });
    // Le GR50 n'est pas un sentier célèbre : ni destination ni référence, comme avant.
    expect(destinationOf(parseIntentRules('GR50 en 6 jours', TODAY))).toBeUndefined();
  });

  it('un lieu dit en toutes lettres ne prend pas la référence du sentier qui suit', () => {
    expect(destinationOf(parseIntentRules('randonnée en Corse sur le GR20', TODAY))).toEqual({
      type: 'set_destination',
      place: 'Corse',
    });
  });

  it('l’envie « GR34 » reste rangée : le lieu proposé reste la région', () => {
    const rules = parseIntentRules('GR34 en 8 jours', TODAY);
    const merged = mergeActions(
      [
        { type: 'set_destination', place: 'GR34' },
        { type: 'wish', label: 'GR34' },
      ],
      rules
    );
    expect(destinationOf(merged.map((m) => m.action))).toEqual({
      type: 'set_destination',
      place: 'Bretagne',
      trail: 'GR34',
    });
    const proposals = validateActions(merged, ctx);
    expect(proposals.find((p) => p.action.type === 'wish')).toMatchObject({
      label: 'Envie : GR34',
      ok: true,
    });
    expect(proposals.find((p) => p.action.type === 'set_destination')).toMatchObject({
      label: 'Destination : Bretagne',
      ok: true,
    });
  });

  it('la référence de l’IA n’est jamais reprise : seule celle lue dans la phrase compte', () => {
    const merged = mergeActions([{ type: 'set_destination', place: 'Corse', trail: 'GR20' }], []);
    expect(merged[0].action).toEqual({ type: 'set_destination', place: 'Corse' });
    // Une autre destination que celle des règles ne prend pas leur référence.
    const other = mergeActions(
      [{ type: 'set_destination', place: 'Pyrénées' }],
      parseIntentRules('GR34 en 8 jours', TODAY)
    );
    expect(destinationOf(other.map((m) => m.action))).toEqual({
      type: 'set_destination',
      place: 'Pyrénées',
    });
  });

  it('schéma : référence normalisée seulement (jamais une phrase)', () => {
    expect(
      intentActionSchema.safeParse({ type: 'set_destination', place: 'Bretagne', trail: 'GR34' })
        .success
    ).toBe(true);
    expect(
      intentActionSchema.safeParse({ type: 'set_destination', place: 'Bretagne', trail: 'gr 34' })
        .success
    ).toBe(false);
  });

  it('plan d’application puis action serveur : la référence suit la destination', async () => {
    const ops = planApplication(parseIntentRules('GR34 en 8 jours', TODAY), current);
    expect(ops[0]).toEqual({ op: 'destination', place: 'Bretagne', trail: 'GR34' });
    const ctl = { data: { model: { tripId: 't', slug: 's' } } } as unknown as CompasCtl;
    await runOps(ctl, [ops[0]]);
    expect(compasSetDestinationAction).toHaveBeenLastCalledWith({
      tripId: 't',
      tripSlug: 's',
      place: 'Bretagne',
      trail: 'GR34',
    });
    // Sans référence : l'appel d'avant, inchangé.
    await runOps(ctl, [{ op: 'destination', place: 'Vercors' }]);
    expect(compasSetDestinationAction).toHaveBeenLastCalledWith({
      tripId: 't',
      tripSlug: 's',
      place: 'Vercors',
    });
  });
});
