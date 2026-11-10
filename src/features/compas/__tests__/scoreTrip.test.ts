import { describe, expect, it } from 'vitest';
import { aggregate, F0_CHECKS, GRILLE, scoreTrip, type Expected, type TripScore, type TripSnapshot } from '../engine/score';

const CHAMONIX = { lat: 45.92, lon: 6.87 };

function step(day: number, over: Partial<TripSnapshot['steps'][number]> = {}): TripSnapshot['steps'][number] {
  return {
    day_number: day,
    title: `Jour ${day} · Étape ${day}`,
    description: 'Montée puis crête.',
    latitude: CHAMONIX.lat + 0.03 * (day - 1),
    longitude: CHAMONIX.lon + 0.03 * (day - 1),
    distance_km: 12,
    elevation_gain_m: 800,
    start_time: '08:00',
    accommodation_name: day < 3 ? `Refuge ${day}` : null,
    transport_mode: 'foot',
    metadata: { distance: { source: 'osrm' }, startTime: { source: 'dit' } },
    ...over,
  };
}

function complete(): TripSnapshot {
  const item = (n: number, over: Partial<TripSnapshot['items'][number]> = {}): TripSnapshot['items'][number] => ({
    item_name: `Objet ${n}`,
    category: 'sac',
    is_vital: n === 1,
    source: 'compas-auto',
    inventory_item_id: n <= 2 ? `inv-${n}` : null,
    shop_product_id: null,
    ...over,
  });
  const exp = (title: string, category: string, amount: number, source: string) => ({
    title,
    amount,
    currency: 'EUR',
    category,
    is_planned: true,
    metadata: { autofill: 'run-1', source, basis: 'test' },
  });
  return {
    trip: {
      id: 't1',
      title: 'Tour',
      destination_name: 'Chamonix',
      destination_country_code: 'FR',
      start_date: '2026-07-10',
      end_date: '2026-07-12',
      party_size: 2,
      primary_activity: 'hiking',
      estimated_budget: 600,
      budget_currency: 'EUR',
      metadata: {
        compas: {
          planned_days: 3,
          anchor: { name: 'Chamonix', ...CHAMONIX, countryCode: 'FR' },
          autofill: { runId: 'run-1', notes: [], papers: { countryCode: 'FR' } },
        },
      },
    },
    steps: [step(1), step(2), step(3)],
    items: [1, 2, 3, 4, 5].map((n) => item(n)),
    expenses: [
      exp('Train aller-retour × 2', 'transport', 100, 'estimation'),
      exp('Nuits en refuge', 'hébergement', 150, 'base'),
      exp('Repas · 3 jour(s) × 2', 'nourriture', 120, 'estimation'),
      exp('Assurance', 'divers', 50, 'estimation'),
    ],
  };
}

function empty(): TripSnapshot {
  return {
    trip: {
      id: 'e',
      title: null,
      destination_name: null,
      destination_country_code: null,
      start_date: null,
      end_date: null,
      party_size: null,
      primary_activity: null,
      estimated_budget: null,
      budget_currency: null,
      metadata: null,
    },
    steps: [],
    items: [],
    expenses: [],
  };
}

const EXPECTED: Expected = {
  pays: 'FR',
  lieu: { nom: 'Chamonix', lat: CHAMONIX.lat, lon: CHAMONIX.lon, rayonKm: 30 },
  jours: 3,
  heures: null,
  personnes: 2,
  enfants: null,
  activite: 'hiking',
  mois: 7,
  issue: 'pret',
};

const failing = (s: TripScore['faisabilite']) => s.criteres.filter((c) => !c.ok).map((c) => c.id);
const withMeta = (snap: TripSnapshot, compas: Record<string, unknown>): TripSnapshot => ({
  ...snap,
  trip: { ...snap.trip, metadata: { compas: { ...(snap.trip.metadata as { compas: object }).compas, ...compas } } },
});

describe('scoreTrip — voyage complet construit à la main', () => {
  const s = scoreTrip(complete(), EXPECTED);
  it('justesse 100 (6 critères)', () => {
    expect(s.justesse).toMatchObject({ note: 100, tenus: 6, total: 6 });
  });
  it('complétude 100 (21 critères : prêt, étapes, 12 par jour, 2 nuits, trajet, postes, total, sac, papiers)', () => {
    expect(s.completude).toMatchObject({ note: 100, tenus: 21, total: 21 });
    expect(s.completude.nonMesurables).toEqual(['météo (calculée à la lecture)', 'risques (calculés à la lecture)']);
  });
  it('faisabilité 100 (8 contrôles applicables)', () => {
    expect(s.faisabilite).toMatchObject({ note: 100, tenus: 8, total: 8 });
    expect(s.grille).toEqual(GRILLE);
    expect(GRILLE).toEqual({ justesse: 'J0', completude: 'C0', faisabilite: 'F0', precision: 'P0' });
  });
  it('précision 66 : moyenne des familles (étapes 100, dépenses 25, réglages 100, sac 40)', () => {
    // 3 distances mesurées + 1 dépense « base » + dates + groupe + 2 objets reliés ; 3 estimations, 3 objets génériques.
    expect(s.precision).toMatchObject({ note: 66, tenus: 8, total: 14 });
    expect(s.precision.familles).toEqual({
      etapes: { tenus: 3, total: 3 },
      depenses: { tenus: 1, total: 4 },
      reglages: { tenus: 2, total: 2 },
      sac: { tenus: 2, total: 5 },
    });
  });
  it('est pur : deux appels, même résultat', () => {
    expect(scoreTrip(complete(), EXPECTED)).toEqual(s);
  });
});

describe('scoreTrip — voyage vide', () => {
  const s = scoreTrip(empty(), null);
  it('justesse non mesurée : total 0, note null', () => {
    expect(s.justesse).toMatchObject({ note: null, total: 0, nonMesurables: ['demande attendue absente'] });
  });
  it('complétude 0, jamais 100', () => {
    expect(s.completude.note).toBe(0);
    expect(s.completude.tenus).toBe(0);
  });
  it('faisabilité sans critère applicable : null', () => {
    expect(s.faisabilite).toMatchObject({ note: null, total: 0 });
  });
  it('précision : seul le groupe par défaut compte, 0', () => {
    expect(s.precision).toMatchObject({ note: 0, total: 1 });
  });
  it('aucun axe à 100', () => {
    for (const a of [s.justesse, s.completude, s.faisabilite, s.precision]) expect(a.note).not.toBe(100);
  });
  it('metadata illisible ne lève rien', () => {
    const snap = empty();
    snap.trip.metadata = { compas: 'x', route_id: [] } as unknown as Record<string, unknown>;
    expect(() => scoreTrip(snap, EXPECTED)).not.toThrow();
    snap.trip.metadata = { compas: { anchor: { lat: null, lon: '' }, autofill: [] } };
    expect(() => scoreTrip(snap, EXPECTED)).not.toThrow();
  });
});

describe('complétude — détails', () => {
  it('même heure partout sans source : non tenue (heure par défaut)', () => {
    const snap = complete();
    snap.steps = snap.steps.map((st) => ({ ...st, start_time: '09:00', metadata: { distance: { source: 'osrm' } } }));
    expect(scoreTrip(snap, null).completude).toMatchObject({ tenus: 18, total: 21 });
    snap.steps = snap.steps.map((st) => ({ ...st, metadata: { startTime: { source: 'defaut' } } }));
    expect(scoreTrip(snap, null).completude.criteres.filter((c) => c.id.endsWith('-heure') && c.ok)).toHaveLength(0);
  });
  it("l'heure de départ absente fait perdre 3 critères sur 21", () => {
    const snap = complete();
    snap.steps = snap.steps.map((st) => ({ ...st, start_time: null }));
    expect(scoreTrip(snap, null).completude).toMatchObject({ tenus: 18, total: 21, note: 86 });
  });
  it('sortie à la journée : aucune nuit', () => {
    const snap = complete();
    snap.trip.end_date = snap.trip.start_date;
    snap.steps = [step(1)];
    const ids = scoreTrip(snap, null).completude.criteres.map((c) => c.id);
    expect(ids.some((i) => i.startsWith('nuit-'))).toBe(false);
    expect(ids.filter((i) => i.startsWith('jour-1-'))).toHaveLength(4);
  });
  it('bivouac choisi : les nuits sont tenues sans hébergement', () => {
    const snap = withMeta(complete(), { prefs: { nights: 'bivouac' } });
    snap.steps = snap.steps.map((st) => ({ ...st, accommodation_name: null }));
    const nuits = scoreTrip(snap, null).completude.criteres.filter((c) => c.id.startsWith('nuit-'));
    expect(nuits).toHaveLength(2);
    expect(nuits.every((c) => c.ok)).toBe(true);
  });
  it('nuit sans hébergement ni bivouac : manquée', () => {
    const snap = complete();
    snap.steps[0].accommodation_name = '  ';
    const c = scoreTrip(snap, null).completude.criteres.find((x) => x.id === 'nuit-1');
    expect(c?.ok).toBe(false);
  });
  it("le trajet d'approche se lit sur la catégorie transport + « aller-retour »", () => {
    const snap = complete();
    snap.expenses[0] = { ...snap.expenses[0], title: 'Transports sur place (2 trajets)' };
    expect(scoreTrip(snap, null).completude.criteres.find((x) => x.id === 'trajet-aller-retour')?.ok).toBe(false);
  });
  it('budget : moins de 3 postes distincts = manqué', () => {
    const snap = complete();
    snap.expenses = snap.expenses.slice(0, 2);
    expect(scoreTrip(snap, null).completude.criteres.find((x) => x.id === 'budget-postes')?.ok).toBe(false);
  });
  it('sac : 5 objets mais aucun indispensable = manqué', () => {
    const snap = complete();
    snap.items = snap.items.map((i) => ({ ...i, is_vital: false }));
    expect(scoreTrip(snap, null).completude.criteres.find((x) => x.id === 'sac')?.ok).toBe(false);
  });
});

describe('faisabilité F0 — un cas fautif par contrôle, et lui seul', () => {
  it('F0_CHECKS liste les 8 contrôles', () => {
    expect(F0_CHECKS.map((c) => c.id)).toEqual(['F0-01', 'F0-02', 'F0-03', 'F0-04', 'F0-05', 'F0-06', 'F0-07', 'F0-08']);
  });
  it('F0-01 : coordonnées manquantes (F0-03 et F0-05 ne peuvent pas tourner : échec « donnée manquante »)', () => {
    const snap = complete();
    snap.steps[1].latitude = null;
    const f = scoreTrip(snap, null).faisabilite;
    expect(failing(f)).toEqual(['F0-01', 'F0-03', 'F0-05']);
    expect(f.criteres.find((c) => c.id === 'F0-03')?.detail).toContain('donnée manquante');
    expect(f.criteres.find((c) => c.id === 'F0-05')?.detail).toContain('donnée manquante');
  });
  it('voyage prêt sans aucune étape : F0-01 et F0-02 échouent ; non préparé : sans objet', () => {
    const snap = complete();
    snap.steps = [];
    const f = scoreTrip(snap, null).faisabilite;
    expect(failing(f)).toEqual(['F0-01', 'F0-02']);
    expect(f.criteres[0].detail).toContain('donnée manquante');
    const brouillon = { ...snap, trip: { ...snap.trip, metadata: { compas: { planned_days: 3 } } } };
    expect(scoreTrip(brouillon, null).faisabilite.criteres.some((c) => c.id === 'F0-01')).toBe(false);
  });
  it('F0-04 : journée de marche sans distance = échec « donnée manquante » (ancienne faiblesse : ignorée)', () => {
    const snap = complete();
    snap.steps[1].distance_km = null;
    const f = scoreTrip(snap, null).faisabilite;
    expect(failing(f)).toEqual(['F0-04']);
    expect(f.criteres.find((c) => c.id === 'F0-04')?.detail).toContain('donnée manquante');
  });
  it('sans objet structurel : pas de budget cible, F0-07 hors total', () => {
    const snap = complete();
    snap.trip.estimated_budget = null;
    expect(scoreTrip(snap, null).faisabilite.total).toBe(7);
  });
  it('F0-02 : jour en double (et jour manquant)', () => {
    const snap = complete();
    snap.steps[2].day_number = 2;
    expect(failing(scoreTrip(snap, null).faisabilite)).toEqual(['F0-02']);
  });
  it('F0-03 : saut de 230 km à pied entre deux jours', () => {
    const snap = complete();
    snap.steps[2].latitude = 48;
    snap.steps[2].longitude = 6.9;
    expect(failing(scoreTrip(snap, null).faisabilite)).toEqual(['F0-03']);
  });
  it('F0-03 : le même saut en train reste plausible', () => {
    const snap = complete();
    snap.steps[2].latitude = 48;
    snap.steps[2].longitude = 6.9;
    snap.steps[2].transport_mode = 'train';
    expect(failing(scoreTrip(snap, null).faisabilite)).toEqual([]);
  });
  it('F0-04 : 50 km à pied dans la journée', () => {
    const snap = complete();
    snap.steps[1].distance_km = 50;
    expect(failing(scoreTrip(snap, null).faisabilite)).toEqual(['F0-04']);
  });
  it('F0-04 : 2 500 m de dénivelé à pied', () => {
    const snap = complete();
    snap.steps[0].elevation_gain_m = 2500;
    expect(failing(scoreTrip(snap, null).faisabilite)).toEqual(['F0-04']);
  });
  it("F0-05 : étapes à plus de 1 500 km de l'ancre", () => {
    const snap = withMeta(complete(), { anchor: { name: 'Ailleurs', lat: 0, lon: 0 } });
    expect(failing(scoreTrip(snap, null).faisabilite)).toEqual(['F0-05']);
  });
  it('F0-06 : dépense prévue à 0 €', () => {
    const snap = complete();
    snap.expenses[3].amount = 0;
    expect(failing(scoreTrip(snap, null).faisabilite)).toEqual(['F0-06']);
  });
  it('F0-06 : dépense sans devise', () => {
    const snap = complete();
    snap.expenses[3].currency = null;
    expect(failing(scoreTrip(snap, null).faisabilite)).toEqual(['F0-06']);
  });
  it('F0-07 : dépenses (420) au-dessus du budget (100)', () => {
    const snap = complete();
    snap.trip.estimated_budget = 100;
    expect(failing(scoreTrip(snap, null).faisabilite)).toEqual(['F0-07']);
  });
  it('F0-07 : inapplicable sans budget', () => {
    const snap = complete();
    snap.trip.estimated_budget = null;
    const f = scoreTrip(snap, null).faisabilite;
    expect(f.criteres.some((c) => c.id === 'F0-07')).toBe(false);
    expect(f.note).toBe(100);
  });
  it('F0-08 : fin avant début', () => {
    const snap = complete();
    snap.trip.end_date = '2026-07-09';
    expect(failing(scoreTrip(snap, null).faisabilite)).toEqual(['F0-08']);
  });
  it('F0-08 : durée datée (3) différente de la durée retenue (5)', () => {
    const snap = withMeta(complete(), { planned_days: 5 });
    expect(failing(scoreTrip(snap, null).faisabilite)).toEqual(['F0-08']);
  });
});

describe('justesse', () => {
  it('lieu à 10 km : tenu', () => {
    const snap = withMeta(complete(), { anchor: { name: 'x', lat: CHAMONIX.lat + 0.09, lon: CHAMONIX.lon } });
    expect(scoreTrip(snap, EXPECTED).justesse.criteres.find((c) => c.id === 'lieu')?.ok).toBe(true);
  });
  it('lieu à 500 km : raté', () => {
    const snap = withMeta(complete(), { anchor: { name: 'x', lat: 49.4, lon: 2.1 } });
    const c = scoreTrip(snap, EXPECTED).justesse.criteres.find((x) => x.id === 'lieu');
    expect(c?.ok).toBe(false);
    expect(scoreTrip(snap, EXPECTED).justesse.note).toBe(83);
  });
  it('mauvais pays : raté', () => {
    const snap = complete();
    snap.trip.destination_country_code = 'IT';
    expect(scoreTrip(snap, EXPECTED).justesse.criteres.find((c) => c.id === 'pays')?.ok).toBe(false);
  });
  it("pays : repli sur le code de l'ancre", () => {
    const snap = complete();
    snap.trip.destination_country_code = null;
    expect(scoreTrip(snap, EXPECTED).justesse.criteres.find((c) => c.id === 'pays')?.ok).toBe(true);
  });
  it('attendu null : le critère est ignoré', () => {
    const exp: Expected = { ...EXPECTED, pays: null, lieu: null, mois: null, personnes: null };
    const j = scoreTrip(complete(), exp).justesse;
    expect(j.criteres.map((c) => c.id)).toEqual(['jours', 'activite']);
  });
  it('tous les attendus null : total 0, note null', () => {
    const exp: Expected = { pays: null, lieu: null, jours: null, heures: null, personnes: null, enfants: null, activite: null, mois: null, issue: 'pret' };
    expect(scoreTrip(complete(), exp).justesse).toMatchObject({ note: null, total: 0 });
  });
  it('heures : tolérance de 0,5 h', () => {
    const exp: Expected = { ...EXPECTED, pays: null, lieu: null, jours: 1, heures: 2, personnes: null, activite: null, mois: null };
    const snap = complete();
    snap.trip.start_date = null;
    snap.trip.end_date = null;
    snap.trip.metadata = { compas: { planned_days: 1, duration_h: 2.4 } };
    expect(scoreTrip(snap, exp).justesse).toMatchObject({ note: 100, total: 2 });
    snap.trip.metadata = { compas: { planned_days: 1, duration_h: 3 } };
    expect(scoreTrip(snap, exp).justesse.criteres.find((c) => c.id === 'heures')?.ok).toBe(false);
  });
  it('mois et personnes faux : ratés', () => {
    const snap = complete();
    snap.trip.start_date = '2026-08-10';
    snap.trip.end_date = '2026-08-12';
    snap.trip.party_size = 4;
    const ko = scoreTrip(snap, EXPECTED).justesse.criteres.filter((c) => !c.ok).map((c) => c.id);
    expect(ko.sort()).toEqual(['mois', 'personnes']);
  });
  it("enfants : non mesurable, jamais compté (rangés nulle part en base)", () => {
    const j = scoreTrip(complete(), { ...EXPECTED, enfants: 2 }).justesse;
    expect(j.nonMesurables).toEqual(['enfants']);
    expect(j.total).toBe(6);
  });
  it("issue « precision » : voyage prêt sans note = raté", () => {
    const exp: Expected = { ...EXPECTED, pays: null, lieu: null, jours: null, personnes: null, activite: null, mois: null, issue: 'precision' };
    const j = scoreTrip(complete(), exp).justesse;
    expect(j.criteres).toHaveLength(1);
    expect(j.criteres[0]).toMatchObject({ id: 'signale-le-manque', ok: false });
  });
  it("issue « precision » : voyage prêt avec notes = tenu ; sans voyage prêt = tenu", () => {
    const exp: Expected = { ...EXPECTED, pays: null, lieu: null, jours: null, personnes: null, activite: null, mois: null, issue: 'precision' };
    const noted = withMeta(complete(), { autofill: { runId: 'r', notes: ['Dates contradictoires.'] } });
    expect(scoreTrip(noted, exp).justesse.criteres[0].ok).toBe(true);
    expect(scoreTrip(empty(), exp).justesse.criteres[0].ok).toBe(true);
  });
  it('issue « precision » : les autres champs non null restent notés', () => {
    const j = scoreTrip(complete(), { ...EXPECTED, issue: 'precision' }).justesse;
    expect(j.total).toBe(7);
  });
});

describe('justesse — précisions T0.4', () => {
  const only = (over: Partial<Expected>): Expected => ({
    pays: null, lieu: null, jours: null, heures: null, personnes: null, enfants: null, activite: null, mois: null, issue: 'pret', ...over,
  });
  it('joursTolerance : ±1 tenu, ±2 raté, défaut 0', () => {
    const snap = complete(); // 3 jours
    const ok = (e: Partial<Expected>) => scoreTrip(snap, only(e)).justesse.criteres[0].ok;
    expect(ok({ jours: 4, joursTolerance: 1 })).toBe(true);
    expect(ok({ jours: 5, joursTolerance: 1 })).toBe(false);
    expect(ok({ jours: 4 })).toBe(false);
    expect(ok({ jours: 5, joursTolerance: 2 })).toBe(true);
  });
  it('personnes = 1 : tenu avec party_size 1 ou nul ; autre valeur : égalité stricte', () => {
    const snap = complete();
    const ok = (p: number | null, att: number) => {
      snap.trip.party_size = p;
      return scoreTrip(snap, only({ personnes: att })).justesse.criteres[0].ok;
    };
    expect(ok(1, 1)).toBe(true);
    expect(ok(null, 1)).toBe(true);
    expect(ok(2, 1)).toBe(false);
    expect(ok(null, 2)).toBe(false);
    expect(ok(3, 2)).toBe(false);
  });
  it('enfants = 0 : ni tenu ni total ; enfants ≥ 1 : non mesurable', () => {
    const j0 = scoreTrip(complete(), only({ enfants: 0 })).justesse;
    expect(j0).toMatchObject({ total: 0, tenus: 0, note: null, nonMesurables: [] });
    expect(scoreTrip(complete(), only({ enfants: 1 })).justesse.nonMesurables).toEqual(['enfants']);
  });
  it('pays : outre-mer et FR équivalents dans les deux sens, dit dans le détail', () => {
    const snap = complete();
    snap.trip.destination_country_code = 'FR';
    const a = scoreTrip(snap, only({ pays: 'RE' })).justesse.criteres[0];
    expect(a.ok).toBe(true);
    expect(a.detail).toContain('équivalents');
    snap.trip.destination_country_code = 'GP';
    expect(scoreTrip(snap, only({ pays: 'FR' })).justesse.criteres[0].ok).toBe(true);
    expect(scoreTrip(snap, only({ pays: 'IT' })).justesse.criteres[0].ok).toBe(false);
    expect(scoreTrip(snap, only({ pays: 'DE' })).justesse.criteres[0].ok).toBe(false);
  });
});

describe('précision', () => {
  it('distance estimée : pas une donnée réelle', () => {
    const snap = complete();
    snap.steps[0].metadata = { distance: { source: 'estimation' } };
    const p = scoreTrip(snap, null).precision;
    expect(p.criteres.find((c) => c.id === 'distance-etape-1')?.ok).toBe(false);
  });
  it('une distance absente est attendue et non réelle (un jour attendu, une valeur)', () => {
    const snap = complete();
    snap.steps[0].distance_km = null;
    const c = scoreTrip(snap, null).precision.criteres.find((x) => x.id === 'distance-etape-1');
    expect(c).toMatchObject({ ok: false, detail: 'distance absente' });
  });
  it('un jour sans étape pèse comme une valeur non réelle', () => {
    const snap = complete();
    snap.steps = snap.steps.slice(0, 1);
    expect(scoreTrip(snap, null).precision.familles?.etapes).toEqual({ tenus: 1, total: 3 });
  });
  it('dépense de la préparation sans source = non réelle ; saisie à la main = hors mesure', () => {
    const snap = complete();
    snap.expenses[0].metadata = { autofill: 'run-1' };
    snap.expenses[1] = { ...snap.expenses[1], metadata: null };
    expect(scoreTrip(snap, null).precision.familles?.depenses).toEqual({ tenus: 0, total: 3 });
  });
  it("sac : un lien boutique seul n'est pas réel, relier à la boutique ne fait pas monter la note", () => {
    const a = complete();
    const b = complete();
    b.items = b.items.map((i) => (i.inventory_item_id ? i : { ...i, shop_product_id: 'shop-1' }));
    const [pa, pb] = [scoreTrip(a, null).precision, scoreTrip(b, null).precision];
    expect([pb.note, pb.tenus, pb.total]).toEqual([pa.note, pa.tenus, pa.total]);
    expect(scoreTrip(b, null).precision.familles?.sac).toEqual({ tenus: 2, total: 5 });
  });
  it('chaque famille pèse autant : 1 dépense non réelle pèse comme 10 objets', () => {
    const snap = complete();
    snap.expenses = [snap.expenses[0]];
    snap.items = Array.from({ length: 10 }, (_, n) => ({ item_name: `o${n}`, category: null, is_vital: null, source: 'compas-auto', inventory_item_id: `i${n}`, shop_product_id: null }));
    // étapes 100, dépenses 0, réglages 100, sac 100 → 75
    expect(scoreTrip(snap, null).precision.note).toBe(75);
  });
  it("dépense sans « source » (saisie à la main) : hors mesure", () => {
    const snap = complete();
    snap.expenses[0].metadata = null;
    expect(scoreTrip(snap, null).precision.total).toBe(13);
  });
  it('durée sans date : raté', () => {
    const snap = complete();
    snap.trip.start_date = null;
    snap.trip.end_date = null;
    expect(scoreTrip(snap, null).precision.criteres.find((c) => c.id === 'dates')?.ok).toBe(false);
  });
});

describe('aggregate', () => {
  const full = scoreTrip(complete(), EXPECTED);
  const vide = scoreTrip(empty(), null);
  it('moyenne par famille et ligne « tous »', () => {
    const r = aggregate([
      { famille: 'marche', score: full },
      { famille: 'marche', score: vide },
      { famille: 'velo', score: full },
    ]);
    expect(r.marche).toEqual({ n: 2, justesse: 100, completude: 50, faisabilite: 100, precision: 33 });
    expect(r.velo).toEqual({ n: 1, justesse: 100, completude: 100, faisabilite: 100, precision: 66 });
    expect(r.tous).toMatchObject({ n: 3, justesse: 100, completude: 67, faisabilite: 100 });
  });
  it('les notes null ne comptent pas ; aucune note = null', () => {
    const r = aggregate([{ famille: 'ski', score: vide }]);
    expect(r.ski).toMatchObject({ n: 1, justesse: null, faisabilite: null, completude: 0 });
  });
  it('liste vide : « tous » vide', () => {
    expect(aggregate([]).tous).toEqual({ n: 0, justesse: null, completude: null, faisabilite: null, precision: null });
  });
});

describe('Précision — une distance sans source dite', () => {
  it("n'est pas tenue pour réelle", async () => {
    const { scorePrecision } = await import('../engine/score/precision');
    const step = (metadata: Record<string, unknown> | null) => ({
      day_number: 1,
      title: 'Jour 1',
      description: 'x',
      latitude: 45,
      longitude: 6,
      distance_km: 12,
      elevation_gain_m: 300,
      start_time: null,
      accommodation_name: null,
      transport_mode: 'foot',
      metadata,
    });
    const snap = (metadata: Record<string, unknown> | null) => ({
      trip: {
        id: 't',
        title: null,
        destination_name: null,
        destination_country_code: null,
        start_date: null,
        end_date: null,
        party_size: null,
        primary_activity: null,
        estimated_budget: null,
        budget_currency: null,
        metadata: null,
      },
      steps: [step(metadata)],
      items: [],
      expenses: [],
    });
    const of = (m: Record<string, unknown> | null) =>
      scorePrecision(snap(m)).criteres.find((c) => c.id === 'distance-etape-1')?.ok;
    expect(of(null)).toBe(false);
    expect(of({ distance: { source: 'estimation' } })).toBe(false);
    expect(of({ distance: { source: 'brouter' } })).toBe(true);
  });
});
