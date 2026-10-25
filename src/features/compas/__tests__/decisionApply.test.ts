import { describe, expect, it } from 'vitest';
import { buildCompasModel, type CompasKitLine, type CompasMemberLoad } from '../engine/compasModel';
import { balanceCarriers, planDecisionApply, summarize } from '../engine/decisionApply';
import { STOVE, TENT, U1, U2, baseTrip, compasInput, item } from './helpers/compasData';

/*
 * « Prochaine décision, appliquer » : le moteur dit si la décision est un calcul sûr
 * (répartir le commun sans porteur) ; toute décision qui demande un choix ou engage de
 * l'argent reste à « Voir ». La répartition est déterministe et équilibrée.
 */

const line = (id: string, name: string, grams: number | null, quantity = 1): CompasKitLine => ({
  id,
  name,
  category: null,
  weightGrams: grams,
  quantity,
  packed: false,
  vital: false,
  kind: 'base',
  shared: true,
  ownerId: null,
  inventoryItemId: null,
  lent: false,
  status: 'owned',
  reason: null,
  shopProductId: null,
  purchaseState: null,
  condition: null,
});

const load = (userId: string, name: string, capacityKg: number | null, carriedGrams = 0): CompasMemberLoad => ({
  userId,
  name,
  avatarUrl: null,
  role: null,
  carriedGrams,
  capacityKg,
  flatSpeedKmh: null,
  experienceLevel: null,
  calibrationLevel: null,
  ratio: null,
  sharedItemIds: [],
});

const carriers = (a: ReturnType<typeof balanceCarriers>) => Object.fromEntries(a.map((x) => [x.itemId, x.carrierId]));

describe('balanceCarriers', () => {
  it('les plus lourds d’abord, chacun chez celui dont le sac serait le moins chargé après coup (rapporté à la capacité)', () => {
    // Tony 14 kg, Léa 12 kg : la tente (1,7 kg) chez Tony (12,3 % contre 14,3 %), le réchaud chez Léa.
    const out = balanceCarriers(
      [line('stove', 'Réchaud', 400), line('tent', 'Tente', 1720)],
      [load('tony', 'Tony', 14), load('lea', 'Léa', 12)]
    );
    expect(out.map((a) => a.itemId)).toEqual(['tent', 'stove']);
    expect(carriers(out)).toEqual({ tent: 'tony', stove: 'lea' });
  });

  it('la charge déjà portée compte : celui qui porte déjà beaucoup reçoit moins', () => {
    const out = balanceCarriers(
      [line('a', 'A', 1000), line('b', 'B', 1000)],
      [load('tony', 'Tony', 14, 9000), load('lea', 'Léa', 12, 1000)]
    );
    expect(carriers(out)).toEqual({ a: 'lea', b: 'lea' });
  });

  it('une capacité inconnue : on compare les grammes, jamais une capacité devinée', () => {
    // Léa 12 kg, Tony inconnu : en grammes, la tente va au premier (égalité), le réchaud à l'autre.
    const out = balanceCarriers(
      [line('tent', 'Tente', 1720), line('stove', 'Réchaud', 400), line('pot', 'Popote', 600)],
      [load('tony', 'Tony', null), load('lea', 'Léa', 12)]
    );
    expect(carriers(out)).toEqual({ tent: 'tony', pot: 'lea', stove: 'lea' });
  });

  it('égalité : le moins d’objets confiés dans la passe, puis l’ordre de l’équipe', () => {
    const out = balanceCarriers(
      [line('a', 'A', null), line('b', 'B', null), line('c', 'C', null)],
      [load('tony', 'Tony', null), load('lea', 'Léa', null)]
    );
    expect(out.map((a) => a.carrierId)).toEqual(['tony', 'lea', 'tony']);
  });

  it('même poids : l’ordre alphabétique du nom (puis de l’identifiant) tranche, pas l’ordre d’arrivée', () => {
    const team = [load('tony', 'Tony', null), load('lea', 'Léa', null)];
    const byName = balanceCarriers([line('b', 'Bravo', 500), line('a', 'Alpha', 500)], team);
    expect(carriers(byName)).toEqual({ a: 'tony', b: 'lea' });
    const byId = balanceCarriers([line('2', 'Même nom', 500), line('1', 'Même nom', 500)], team);
    expect(carriers(byId)).toEqual({ '1': 'tony', '2': 'lea' });
  });

  it('la quantité compte dans le poids', () => {
    const out = balanceCarriers([line('a', 'A', 300, 4), line('b', 'B', 1000)], [load('tony', 'Tony', 10), load('lea', 'Léa', 10)]);
    expect(out[0]).toMatchObject({ itemId: 'a', grams: 1200 });
  });

  it('déterministe : l’ordre d’entrée ne change pas la répartition', () => {
    const lines = [line('a', 'Alpha', 500), line('b', 'Bravo', 500), line('c', 'Charlie', 500), line('d', 'Delta', 900)];
    const team = [load('tony', 'Tony', 14), load('lea', 'Léa', 12)];
    const forward = carriers(balanceCarriers(lines, team));
    const reversed = carriers(balanceCarriers([...lines].reverse(), team));
    expect(reversed).toEqual(forward);
  });

  it('chaque objet est confié une fois, personne n’est oublié, aucun porteur hors de l’équipe', () => {
    const lines = Array.from({ length: 7 }, (_, i) => line(`i${i}`, `Objet ${i}`, 100 * (i + 1)));
    const out = balanceCarriers(lines, [load('a', 'A', 10), load('b', 'B', 10), load('c', 'C', 10)]);
    expect(out.map((x) => x.itemId).sort()).toEqual(lines.map((l) => l.id).sort());
    expect(new Set(out.map((x) => x.carrierId))).toEqual(new Set(['a', 'b', 'c']));
  });

  it('personne dans l’équipe : rien à répartir', () => {
    expect(balanceCarriers([line('a', 'A', 100)], [])).toEqual([]);
  });
});

describe('summarize', () => {
  it('par porteur : le nombre d’objets, et le poids seulement quand il est connu', () => {
    expect(
      summarize([
        { itemId: 'a', itemName: 'Tente', carrierId: 'x', carrierName: 'Tony', grams: 1720 },
        { itemId: 'b', itemName: 'Popote', carrierId: 'x', carrierName: 'Tony', grams: 600 },
        { itemId: 'c', itemName: 'Réchaud', carrierId: 'y', carrierName: 'Léa', grams: 0 },
      ])
    ).toBe('Tony : 2 objets, 2,3 kg · Léa : 1 objet');
  });
});

describe('planDecisionApply', () => {
  const shared = [
    item({ id: TENT, name: 'Tente 2P', ownership: 'shared', weightGrams: 1720, isPacked: true }),
    item({ id: STOVE, name: 'Réchaud', ownership: 'shared', weightGrams: 400, isPacked: true }),
  ];
  const model = (over: Parameters<typeof compasInput>[0] = {}) => buildCompasModel(compasInput({ items: shared, ...over }));

  it('matériel commun sans porteur et au moins deux personnes : un plan, avec ce qui sera fait', () => {
    const m = model();
    expect(m.nextDecision?.flow).toBe('sacs');
    const plan = planDecisionApply(m, true);
    expect(plan?.kind).toBe('carriers');
    expect(plan?.label).toBe('Répartir le matériel commun');
    expect(plan?.assignments.map((a) => [a.itemId, a.carrierId])).toEqual([
      [TENT, U1],
      [STOVE, U2],
    ]);
    expect(plan?.summary).toBe('Tony : 1 objet, 1,7 kg · Léa : 1 objet, 400 g');
  });

  it('lecture seule : pas d’« Appliquer »', () => {
    expect(planDecisionApply(model(), false)).toBeNull();
  });

  it('aucune décision : rien', () => {
    expect(planDecisionApply(model({ items: [] }), true)).toBeNull();
  });

  it('une décision qui demande un choix ou engage de l’argent n’a jamais d’« Appliquer »', () => {
    const base = model();
    const flows = [
      ['quand', 'ou'],
      ['parcours', 'ou'],
      ['manques', 'kit'],
      ['choix', 'resa'],
      ['budget', 'nous'],
    ] as const;
    for (const [flow, step] of flows) {
      const m = { ...base, nextDecision: { step, flow, label: 'x', detail: 'y' } };
      expect(planDecisionApply(m, true), flow).toBeNull();
    }
    // Les vrais cas du moteur : dates, objet vital, réservations en attente.
    expect(planDecisionApply(model({ trip: { ...baseTrip, startDate: null, endDate: null } }), true)).toBeNull();
    expect(planDecisionApply(model({ items: [item({ id: TENT, name: 'Sac', isVital: true })] }), true)).toBeNull();
  });

  it('seul dans l’équipe : rien à répartir', () => {
    const solo = buildCompasModel(
      compasInput({ items: shared, members: compasInput().members.slice(0, 1) })
    );
    // La décision « sacs » n'existe que pour au moins deux personnes ; ce garde-fou vaut aussi pour un modèle forgé.
    const forged = { ...solo, nextDecision: { step: 'kit' as const, flow: 'sacs', label: 'x', detail: 'y' } };
    expect(planDecisionApply(forged, true)).toBeNull();
  });

  it('plus rien sans porteur : rien', () => {
    const m = model();
    const forged = { ...m, crew: { ...m.crew, unassignedShared: [] } };
    expect(planDecisionApply(forged, true)).toBeNull();
  });
});
