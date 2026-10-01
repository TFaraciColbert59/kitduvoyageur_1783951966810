import { describe, expect, it } from 'vitest';
import { buildCompasModel, formatDateRange, type CompasInput, type CompasItemInput } from '../engine/compasModel';
import { sunTimes } from '../engine/sun';

function item(partial: Partial<CompasItemInput> & { id: string; name: string }): CompasItemInput {
  return {
    category: null,
    quantity: 1,
    weightGrams: null,
    isPacked: false,
    isVital: false,
    isWorn: false,
    isConsumable: false,
    ownership: 'personal',
    ownerId: null,
    inventoryItemId: null,
    shopProductId: null,
    condition: null,
    reason: null,
    purchaseState: null,
    ...partial,
  };
}

function baseInput(overrides: Partial<CompasInput> = {}): CompasInput {
  return {
    trip: {
      id: 't1',
      slug: 'trek-3-vallees',
      title: 'Trek des 3 Vallées',
      destinationName: 'Pyrénées',
      startDate: '2026-10-12',
      endDate: '2026-10-15',
      primaryActivity: 'hiking',
      estimatedBudget: 1000,
      budgetCurrency: 'EUR',
      partySize: 2,
      ownerId: 'u1',
    },
    steps: [
      { id: 's1', dayNumber: 1, orderIndex: 0, title: 'Gavarnie', locationName: 'Gavarnie', lat: 42.73, lon: -0.01, distanceKm: 12.4, elevationGainM: 900, elevationLossM: 300, accommodationName: null, transportMode: 'foot', startTime: null },
      { id: 's2', dayNumber: 2, orderIndex: 0, title: 'Refuge', locationName: 'Refuge', lat: 42.7, lon: 0.02, distanceKm: 10, elevationGainM: 700, elevationLossM: 800, accommodationName: 'Refuge', transportMode: 'foot', startTime: null },
    ],
    items: [],
    members: [
      { userId: 'u1', name: 'Tony', avatarUrl: null, role: 'owner', maxCarryKg: 14, flatSpeedKmh: 4.6, experienceLevel: null, calibrationLevel: null },
      { userId: 'u2', name: 'Léa', avatarUrl: null, role: 'member', maxCarryKg: null, flatSpeedKmh: null, experienceLevel: null, calibrationLevel: null },
    ],
    expenses: [],
    inventory: [],
    bookings: [],
    weather: [],
    routeDurationMin: null,
    routeHasGeometry: false,
    waterPointsCount: null,
    viewerId: 'u1',
    now: new Date('2026-09-30T12:00:00Z'),
    timeZone: 'Europe/Paris',
    ...overrides,
  };
}

describe('buildCompasModel', () => {
  it('additionne le parcours réel sans rien inventer', () => {
    const m = buildCompasModel(baseInput());
    expect(m.route.distanceKm).toBe(22.4);
    expect(m.route.elevationGainM).toBe(1600);
    expect(m.route.coords).toHaveLength(2);
    expect(m.dates.days).toBe(4);
    expect(m.dates.label).toBe('12–15 oct.');
  });

  it('pondère la préparation par les objets vitaux', () => {
    const m = buildCompasModel(
      baseInput({
        items: [
          item({ id: 'a', name: 'Frontale', isVital: true, isPacked: true, weightGrams: 90 }),
          item({ id: 'b', name: 'Bâtons', isPacked: false, weightGrams: 480 }),
        ],
      }),
    );
    // vital emballé = 2 sur 3
    expect(m.kit.packedPct).toBe(67);
    expect(m.kit.baseGrams).toBe(570);
  });

  it('signale un vital manquant comme prochaine décision et bloque le verdict', () => {
    const m = buildCompasModel(
      baseInput({ items: [item({ id: 'a', name: 'Sac de couchage', isVital: true, reason: 'Nuit à −3 °C' })] }),
    );
    expect(m.kit.vitalMissing).toHaveLength(1);
    expect(m.verdict.level).toBe('bloque');
    expect(m.nextDecision?.step).toBe('kit');
    expect(m.nextDecision?.label).toBe('Trouver : sac de couchage');
  });

  it('un objet de l’inventaire prêté devient « à récupérer »', () => {
    const m = buildCompasModel(
      baseInput({
        items: [item({ id: 'a', name: 'Frontale', isVital: true, inventoryItemId: 'p1' })],
        inventory: [{ id: 'p1', name: 'Frontale', brand: 'Petzl', category: 'Sécurité', weightG: 80, condition: 'bon', isLent: true, maintenanceDueAt: null, expiryDate: null, quantity: 1 }],
      }),
    );
    expect(m.kit.lines[0].status).toBe('lent');
    expect(m.kit.lines[0].weightGrams).toBe(80);
    expect(m.nextDecision?.label).toBe('Récupérer : frontale');
  });

  it('un vital déjà dans le panier passe après ceux sans solution, puis devient « Commander »', () => {
    const both = buildCompasModel(
      baseInput({
        items: [
          item({ id: 'a', name: 'Sac de couchage', isVital: true, purchaseState: 'in_cart', shopProductId: 'x' }),
          item({ id: 'b', name: 'Frontale', isVital: true }),
        ],
      }),
    );
    expect(both.nextDecision?.label).toBe('Trouver : frontale');
    const one = buildCompasModel(
      baseInput({ items: [item({ id: 'a', name: 'Sac de couchage', isVital: true, purchaseState: 'in_cart', shopProductId: 'x' })] }),
    );
    expect(one.nextDecision?.label).toBe('Commander : sac de couchage');
    expect(one.verdict.level).toBe('bloque');
  });

  it('répartit le commun par porteur et garde les objets sans porteur visibles', () => {
    const m = buildCompasModel(
      baseInput({
        items: [
          item({ id: 't', name: 'Tente 2P', ownership: 'shared', ownerId: 'u2', weightGrams: 1720, isPacked: true }),
          item({ id: 'r', name: 'Réchaud', ownership: 'shared', ownerId: null, weightGrams: 310, isPacked: true }),
          item({ id: 'v', name: 'Veste', isWorn: true, weightGrams: 390, isPacked: true }),
        ],
      }),
    );
    const lea = m.crew.loads.find((l) => l.userId === 'u2');
    expect(lea?.carriedGrams).toBe(1720);
    expect(lea?.ratio).toBeNull(); // capacité jamais renseignée : pas de ratio inventé
    expect(m.crew.unassignedShared.map((l) => l.id)).toEqual(['r']);
    expect(m.kit.wornGrams).toBe(390);
  });

  it('reste honnête sans dates ni tracé', () => {
    const m = buildCompasModel(baseInput({ trip: { ...baseInput().trip, startDate: null, endDate: null }, steps: [] }));
    expect(m.dates.label).toBe('Dates à choisir');
    expect(m.daylight).toBeNull();
    expect(m.verdict.level).toBe('incomplet');
    expect(m.nextDecision?.step).toBe('ou');
  });

  it('budget : dépassement détecté sur les dépenses réelles', () => {
    const m = buildCompasModel(
      baseInput({
        expenses: [
          { id: 'e1', title: 'Refuge', amount: 600, category: 'Hébergement', isPlanned: true, payerId: 'u1', splitType: 'equal' },
          { id: 'e2', title: 'Train', amount: 500, category: 'Transport', isPlanned: false, payerId: 'u1', splitType: 'equal' },
        ],
      }),
    );
    expect(m.budget.overTarget).toBe(true);
    expect(m.budget.perPerson).toBe(550);
    expect(m.budget.byCategory[0]).toEqual({ category: 'Hébergement', amount: 600 });
  });
});

describe('sunTimes', () => {
  it('Gavarnie, 12 octobre : lever vers 06:05 UTC, coucher vers 17:25 UTC', () => {
    const t = sunTimes(42.73, -0.01, new Date('2026-10-12T12:00:00Z'));
    expect(t.sunriseUtcMin).not.toBeNull();
    expect(Math.abs((t.sunriseUtcMin ?? 0) - 365)).toBeLessThan(15);
    expect(Math.abs((t.sunsetUtcMin ?? 0) - 1045)).toBeLessThan(15);
  });
});

describe('formatDateRange', () => {
  it('formate une plage sur deux mois', () => {
    expect(formatDateRange('2026-10-30', '2026-11-02')).toBe('30 oct. – 2 nov.');
  });
});
