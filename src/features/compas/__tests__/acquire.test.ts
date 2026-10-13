import { describe, expect, it } from 'vitest';
import {
  RENTAL_BOOKING_PATH,
  acquireOverview,
  honestPurchaseState,
  isCartable,
  priceText,
  productsFor,
  rentalTotal,
  weightDelta,
  type AcquireProduct,
} from '../engine/acquire';
import {
  buildItemHistory,
  dayText,
  inventoryFacts,
  type RawLoan,
  type RawOrder,
  type RawPastTrip,
} from '../engine/itemHistory';

/** Espaces insécables de l'Intl français → espaces simples, pour comparer le texte. */
const n = (t: string) => t.replace(/\s/g, ' ');

const P = (p: Partial<AcquireProduct> & { id: string }): AcquireProduct => ({
  mode: 'achat',
  weightG: null,
  priceEur: null,
  pricePerDay: null,
  ...p,
});

describe('panier : seul un achat ou une occasion avec un prix et une fiche y entre (lot AH)', () => {
  const cart = (mode: AcquireProduct['mode'], priceEur: number | null, slug: string | null = 'fiche') => ({
    mode,
    priceEur,
    slug,
  });

  it('achat, occasion et mode absent (= achat) avec prix et fiche : oui', () => {
    expect(isCartable(cart('achat', 39))).toBe(true);
    expect(isCartable(cart('occasion', 22))).toBe(true);
    expect(isCartable(cart(null, 39))).toBe(true);
    expect(isCartable(cart('achat', 0))).toBe(true);
  });

  it('une location n’y entre jamais, même avec un prix d’achat renseigné', () => {
    expect(isCartable(cart('location', null))).toBe(false);
    expect(isCartable(cart('location', 120))).toBe(false);
  });

  it('une enchère, un produit sans prix, sans fiche ou au prix illisible : non', () => {
    expect(isCartable(cart('enchere', 50))).toBe(false);
    expect(isCartable(cart('achat', null))).toBe(false);
    expect(isCartable(cart('achat', 39, null))).toBe(false);
    expect(isCartable(cart('achat', 39, ''))).toBe(false);
    expect(isCartable(cart('achat', Number.NaN))).toBe(false);
    expect(isCartable(cart('achat', -5))).toBe(false);
  });

  it('la liste « Acheter » et la règle du panier disent la même chose des modes', () => {
    const shop = [P({ id: 'a', mode: 'achat', priceEur: 5 }), P({ id: 'l', mode: 'location', pricePerDay: 6 }), P({ id: 'o', mode: 'occasion', priceEur: 5 })];
    for (const p of productsFor(shop, 'acheter')) expect(isCartable({ ...p, slug: 's' })).toBe(true);
    for (const p of productsFor(shop, 'louer')) expect(isCartable({ ...p, slug: 's' })).toBe(false);
  });

  it('« au panier » écrit pour une location se lit « à acquérir » ; le reste est lu tel qu’écrit', () => {
    const rental = cart('location', null);
    expect(honestPurchaseState('in_cart', rental)).toBe('needed');
    expect(honestPurchaseState('in_cart', cart('achat', 39))).toBe('in_cart');
    expect(honestPurchaseState('shipping', rental)).toBe('shipping');
    expect(honestPurchaseState('needed', rental)).toBe('needed');
    expect(honestPurchaseState(null, rental)).toBeNull();
    // Produit inconnu (hors du catalogue lu) : l'état écrit est gardé.
    expect(honestPurchaseState('in_cart', undefined)).toBe('in_cart');
    expect(honestPurchaseState('in_cart', null)).toBe('in_cart');
  });

  it('la réservation d’une location se fait sur la page Location', () => {
    expect(RENTAL_BOOKING_PATH).toBe('/location');
  });
});

describe('location : le total ne se calcule que sur des jours DATÉS et un prix lu', () => {
  it('prix par jour × jours du voyage', () => {
    expect(rentalTotal(6, 5)).toBe(30);
    expect(rentalTotal(6.5, 3)).toBe(19.5);
    expect(rentalTotal(0, 4)).toBe(0);
  });

  it('durée non datée, nulle, fractionnaire ou prix absent : null, jamais un zéro', () => {
    expect(rentalTotal(6, null)).toBeNull();
    expect(rentalTotal(6, 0)).toBeNull();
    expect(rentalTotal(6, 2.5)).toBeNull();
    expect(rentalTotal(null, 5)).toBeNull();
    expect(rentalTotal(-1, 5)).toBeNull();
    expect(rentalTotal(Number.NaN, 5)).toBeNull();
  });

  it('la ligne de prix dit ce qui manque', () => {
    expect(n(priceText(P({ id: 'a', mode: 'location', pricePerDay: 6 }), 5))).toBe('6 € / jour · 5 jours = 30 €');
    expect(n(priceText(P({ id: 'a', mode: 'location', pricePerDay: 6 }), null))).toBe('6 € / jour · durée du voyage non datée');
    expect(priceText(P({ id: 'a', mode: 'location' }), 5)).toBe('prix non renseigné');
    expect(n(priceText(P({ id: 'b', priceEur: 39 }), 5))).toBe('39 €');
    expect(priceText(P({ id: 'b' }), 5)).toBe('prix non renseigné');
  });
});

describe('écart de poids avec l’objet prévu', () => {
  it('plus léger, plus lourd, identique', () => {
    expect(weightDelta(410, 85)).toMatchObject({ grams: -325, tone: 'good' });
    expect(weightDelta(410, 85)?.text).toBe('−325 g par rapport à l’objet prévu');
    expect(weightDelta(480, 1500)?.text).toBe('+1 kg par rapport à l’objet prévu');
    expect(weightDelta(100, 100)).toMatchObject({ grams: 0, tone: 'same' });
  });

  it('un poids absent ou nul : pas d’écart inventé', () => {
    expect(weightDelta(null, 85)).toBeNull();
    expect(weightDelta(410, null)).toBeNull();
    expect(weightDelta(0, 85)).toBeNull();
  });
});

describe('une phrase par mode', () => {
  const shop = [
    P({ id: 'l1', mode: 'location', pricePerDay: 6 }),
    P({ id: 'l2', mode: 'location', pricePerDay: 4 }),
    P({ id: 'a1', priceEur: 39 }),
    P({ id: 'a2', priceEur: 22, mode: 'occasion' }),
    P({ id: 'e1', mode: 'enchere', priceEur: 1 }),
  ];

  it('productsFor : locations d’un côté, achats et occasions de l’autre, enchères nulle part', () => {
    expect(productsFor(shop, 'louer').map((p) => p.id)).toEqual(['l1', 'l2']);
    expect(productsFor(shop, 'acheter').map((p) => p.id)).toEqual(['a1', 'a2']);
  });

  it('dès quel prix, pour combien de jours', () => {
    const o = acquireOverview({ shop, teammates: 2, days: 5 });
    expect(n(o.louer)).toBe('2 locations en boutique, dès 20 € pour 5 jours.');
    expect(n(o.acheter)).toBe('2 produits en boutique, dès 22 €.');
    expect(o.emprunter).toContain('2 personnes dans l’équipe');
    expect(o.emprunter).toContain('n’est pas visible ici');
  });

  it('jours non datés : le prix par jour, et on le dit', () => {
    expect(n(acquireOverview({ shop, teammates: 0, days: null }).louer)).toBe(
      '2 locations en boutique, dès 4 € par jour (durée du voyage non datée).'
    );
  });

  it('boutique vide ou sans prix : rien d’inventé', () => {
    const o = acquireOverview({ shop: [], teammates: 0, days: 5 });
    expect(o.louer).toBe('Aucune location en boutique pour l’instant.');
    expect(o.acheter).toBe('Aucun produit en boutique pour l’instant.');
    expect(o.emprunter).toBe('Personne d’autre dans l’équipe pour l’instant.');
    expect(acquireOverview({ shop: [P({ id: 'x' })], teammates: 1, days: 5 }).acheter).toBe(
      '1 produit en boutique (prix non renseignés).'
    );
  });
});

describe('historique d’un objet : seulement ce qui est enregistré', () => {
  const loan = (p: Partial<RawLoan> & { id: string }): RawLoan => ({
    status: 'rendu',
    loaned_at: null,
    due_date: null,
    returned_at: null,
    borrower_contact: null,
    ...p,
  });
  const order = (p: Partial<RawOrder> & { id: string }): RawOrder => ({
    order_number: null,
    status: null,
    created_at: null,
    quantity: 1,
    total_price_eur: null,
    transaction_type: 'achat',
    ...p,
  });

  it('rien en base : aucune entrée', () => {
    expect(buildItemHistory({ loans: [], trips: [], orders: [] })).toEqual([]);
  });

  it('prêt : « prêté à » seulement avec un contact écrit, dates et statut en mots', () => {
    const [a, b] = buildItemHistory({
      loans: [
        loan({ id: '1', loaned_at: '2026-08-01', returned_at: '2026-08-10', borrower_contact: ' Marc ' }),
        loan({ id: '2', status: 'en_cours', loaned_at: '2026-09-20', due_date: '2026-10-20' }),
      ],
      trips: [],
      orders: [],
    });
    expect(b.title).toBe('Prêté à Marc');
    expect(b.detail).toBe('1 août 2026 → 10 août 2026 · rendu');
    expect(a.title).toBe('Prêté');
    expect(a.detail).toBe('20 sept. 2026 → 20 oct. 2026 · retour prévu le 20 oct. 2026 · prêt en cours');
    expect(a.tone).toBe('warn');
  });

  it('autres voyages et commandes, du plus récent au plus ancien, les non datés à la fin', () => {
    const trips: RawPastTrip[] = [
      { trip_id: 't1', title: 'Tour du Mont Blanc', start_date: '2026-07-05', end_date: '2026-07-12' },
      { trip_id: 't2', title: null, start_date: null, end_date: null },
    ];
    const entries = buildItemHistory({
      loans: [],
      trips,
      orders: [
        order({ id: 'o1', order_number: 'LKDV-0042', status: 'delivered', created_at: '2026-09-02T10:00:00Z', total_price_eur: 64, quantity: 2 }),
      ],
    });
    expect(entries.map((e) => e.id)).toEqual(['commande-o1', 'voyage-t1', 'voyage-t2']);
    expect(entries[0].title).toBe('Commande LKDV-0042');
    expect(n(entries[0].detail ?? '')).toBe('2 exemplaires · 64 € · livrée');
    expect(entries[1].detail).toBe('5 juil. 2026 → 12 juil. 2026');
    expect(entries[2].title).toBe('Emporté pour « un voyage sans titre »');
    expect(entries[2].detail).toBe('dates non renseignées');
  });

  it('statut inconnu : dit tel quel, jamais traduit au hasard', () => {
    const [e] = buildItemHistory({ loans: [loan({ id: 'x', status: 'archivé' })], trips: [], orders: [] });
    expect(e.detail).toBe('archivé');
  });

  it('faits de l’inventaire : seulement ceux qui existent', () => {
    expect(inventoryFacts({ condition: null, maintenanceDueAt: null, expiryDate: null, isLent: false })).toEqual([]);
    expect(
      inventoryFacts({ condition: 'a_remplacer', maintenanceDueAt: '2026-11-01', expiryDate: '2027-01-15', isLent: true })
    ).toEqual([
      { label: 'État', value: 'a remplacer' },
      { label: 'Entretien dû', value: '1 nov. 2026' },
      { label: 'Péremption', value: '15 janv. 2027' },
      { label: 'Prêt', value: 'prêté en ce moment' },
    ]);
    expect(dayText('pas une date')).toBeNull();
  });
});
