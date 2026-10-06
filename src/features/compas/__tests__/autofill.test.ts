import { describe, expect, it } from 'vitest';
import {
  budgetLines,
  budgetTotal,
  estimateCarTrip,
  estimateMeals,
  gearForNights,
  planNights,
  keepRuleForNights,
  needFromRule,
  sameNeed,
  sanitizeAdvice,
  sourceGear,
} from '../engine/autofill';

const base = { pref: null, autonomy: null, priority: null, maxAltitudeM: null } as const;

describe('planNights', () => {
  it('la préférence déclarée gagne ; refuge sans refuge connu → hébergement, dit pourquoi', () => {
    expect(planNights({ ...base, nights: 2, pref: 'bivouac', refugeNear: [] }).map((n) => n.type)).toEqual([
      'bivouac',
      'bivouac',
    ]);
    const r = planNights({ ...base, nights: 2, pref: 'refuge', refugeNear: [true, false] });
    expect(r.map((n) => n.type)).toEqual(['refuge', 'hebergement']);
    expect(r[1].reason).toMatch(/aucun refuge/);
  });

  it('profil : budget → bivouac ; confort → refuge ; itinérance → un refuge toutes les 3 nuits', () => {
    expect(planNights({ ...base, nights: 1, priority: 'budget', refugeNear: [true] })[0].type).toBe('bivouac');
    expect(planNights({ ...base, nights: 1, priority: 'confort', refugeNear: [true] })[0].type).toBe('refuge');
    expect(
      planNights({ ...base, nights: 4, autonomy: 'itinerance_longue', refugeNear: [true, true, true, true] }).map(
        (n) => n.type
      )
    ).toEqual(['bivouac', 'bivouac', 'refuge', 'bivouac']);
    expect(
      planNights({ ...base, nights: 3, autonomy: 'bivouac_1_2', refugeNear: [false, false, false] }).map((n) => n.type)
    ).toEqual(['bivouac', 'bivouac', 'hebergement']);
  });

  it('aucune nuit pour une sortie à la journée', () => {
    expect(planNights({ ...base, nights: 0, refugeNear: [] })).toEqual([]);
  });
});

describe('estimateCarTrip', () => {
  it('aller-retour mesuré, une voiture pour 4, carburant explicite', () => {
    const t = estimateCarTrip({ oneWayKm: 100, oneWayMin: 75, partySize: 5 })!;
    expect(t.cars).toBe(2);
    expect(t.roundTripKm).toBe(200);
    expect(t.fuelEur).toBe(Math.round(((200 * 6.5) / 100) * 1.8 * 2));
    expect(t.basis).toMatch(/péages non comptés/);
  });
  it('pas de trajet sans distance mesurée', () => {
    expect(estimateCarTrip({ oneWayKm: 0, oneWayMin: 0, partySize: 2 })).toBeNull();
  });
});

describe('sourceGear', () => {
  const needs = gearForNights(['bivouac', 'refuge']);
  it('inventaire, puis prêt, puis location au jour, puis achat ; rien en double', () => {
    const picks = sourceGear(needs, {
      tripItemNames: ['Popote titane'],
      inventory: [
        { id: 'i1', name: 'Tente MSR Hubba 2', isLent: false },
        { id: 'i2', name: 'Matelas gonflable', isLent: true },
      ],
      borrowed: [{ inventoryItemId: 'b1', name: 'Sac de couchage Cumulus', lender: 'Léa' }],
      shop: [
        { id: 's1', name: 'Matelas autogonflant', mode: 'location', priceEur: null, pricePerDay: 3 },
        { id: 's2', name: 'Réchaud gaz compact', mode: 'achat', priceEur: 29.9, pricePerDay: null },
      ],
      days: 3,
    });
    const by = Object.fromEntries(picks.map((p) => [p.need.key, p]));
    expect(by.tent.source).toBe('inventaire');
    expect(by['sleeping-bag'].source).toBe('pret');
    expect(by.mattress).toMatchObject({ source: 'location', costEur: 9, shopProductId: 's1' });
    expect(by.stove).toMatchObject({ source: 'achat', costEur: 29.9 });
    expect(by.pot).toBeUndefined();
    expect(by.liner.source).toBe('a_trouver');
  });
});

describe('repas, budget, avis IA', () => {
  it('repli par type de nuit, ou montant IA borné', () => {
    expect(estimateMeals({ days: 2, partySize: 2, nights: ['bivouac'], aiPerPersonDay: null }).amount).toBe(
      (16 + 12) * 2
    );
    expect(estimateMeals({ days: 3, partySize: 2, nights: [], aiPerPersonDay: 20 }).amount).toBe(120);
  });
  it('lignes à 0 € écartées, total arrondi', () => {
    const lines = budgetLines([
      { category: 'transport', title: 'Carburant', amount: 41.6, source: 'mesure', basis: '' },
      { category: 'matériel', title: 'Rien', amount: 0, source: 'base', basis: '' },
      null,
    ]);
    expect(lines).toHaveLength(1);
    expect(budgetTotal(lines)).toBe(42);
  });
  it('un chiffre irréaliste de l’IA est ignoré, les notes sont courtes', () => {
    expect(
      sanitizeAdvice({ meals_eur_per_person_day: 900, lodging_eur_per_person_night: '45', notes: ['ok', 'Prévoir la frontale : nuit tombée à 18 h.'] })
    ).toMatchObject({ mealsPerPersonDay: null, lodgingPerPersonNight: 45, notes: ['Prévoir la frontale : nuit tombée à 18 h.'] });
    expect(sanitizeAdvice({ notes: ['appliquer un indice SPF 50+ toutes les 2 h'] }).notes).toEqual([
      'Appliquer un indice SPF 50+ toutes les 2 h',
    ]);
  });
});

describe('règles contextuelles', () => {
  const rule = (name: string, category = 'misc') =>
    needFromRule({ key: name, name, category, priority: 'recommended', reason: 'r' });
  it('le nom entier de l’objet est exigé : pas de crème après-soleil pour une crème solaire', () => {
    const picks = sourceGear([rule('Crème solaire haute protection SPF 50+'), rule('Lampe frontale LED haute autonomie'), rule('Bâtons de trekking télescopiques')], {
      tripItemNames: [],
      inventory: [],
      borrowed: [],
      shop: [
        { id: 'a', name: 'Crème Hydratante / Soin Peau Après-Soleil', mode: 'achat', priceEur: 9, pricePerDay: null },
        { id: 'b', name: 'Lampe Torche LED Portable', mode: 'achat', priceEur: 12, pricePerDay: null },
        { id: 'c', name: 'Bâton Trekking Black Diamond', mode: 'achat', priceEur: 60, pricePerDay: null },
      ],
      days: 2,
    });
    expect(picks.map((p) => p.source)).toEqual(['a_trouver', 'a_trouver', 'achat']);
  });
  it('ce qu’on possède couvre par le nom principal : « Trousse de secours » pour la trousse complète', () => {
    const picks = sourceGear([rule('Trousse de premiers secours complète'), rule('Gourde isotherme / Thermos')], {
      tripItemNames: [],
      inventory: [
        { id: 'i1', name: 'Trousse de secours', isLent: false },
        { id: 'i2', name: 'Gourde 1 L', isLent: false },
      ],
      borrowed: [],
      shop: [],
      days: 1,
    });
    expect(picks.map((p) => [p.source, p.inventoryItemId])).toEqual([
      ['inventaire', 'i1'],
      ['inventaire', 'i2'],
    ]);
  });
  it('sans bivouac, ni tente ni couchage des règles ; la tente des règles = celle du bivouac', () => {
    expect(keepRuleForNights('shelter', ['hebergement'])).toBe(false);
    expect(keepRuleForNights('safety', ['hebergement'])).toBe(true);
    expect(sameNeed(gearForNights(['bivouac'])[0], rule('Tente de randonnée légère 2 personnes', 'shelter'))).toBe(true);
  });
});


describe('inventory lifecycle availability', () => {
  it.each(['vendu', 'a_acheter', 'en_location', 'en_pret'] as const)('does not source unavailable %s gear', (inventoryStatus) => {
    const picks = sourceGear(gearForNights(['bivouac']), {
      tripItemNames: [], inventory: [{id:'item',name:'Tente deux places',isLent:false,inventoryStatus}], borrowed: [], shop: [], days:2,
    });
    expect(picks.find((p) => p.need.key === 'tent')?.source).toBe('a_trouver');
  });
});
