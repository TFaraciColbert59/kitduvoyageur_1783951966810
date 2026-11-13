import { describe, expect, it } from 'vitest';
import { BEFORE_DEPARTURE, REFUGE_BOOK_LEAD_DAYS, resaPlan, type ResaLine, type ResaPlanInput } from '../engine/resaPlan';
import { activitiesSearchUrl, carRentalUrl, objectSearchUrl } from '../engine/deepLinks';
import { carRentalPerDay, entryFees, insurance, priceLevel } from '../engine/costs';
import { engineT } from '../engine/engineI18n';

/**
 * « À prévoir » liste TOUT ce qu'il faut réserver pour CE type de voyage (trajet et nuits mis à part, qui
 * ont leur propre modèle) : papiers, assurance, transfert, location, forfait, permis, guide, activités.
 * Règle dure : un prix n'existe que si un barème versionné du dépôt le donne ; sinon « Prix sur le site ».
 */

const base: ResaPlanInput = {
  activity: null,
  destinationCountry: 'FR',
  originCountry: 'FR',
  start: '2026-08-10',
  end: '2026-08-14',
  days: 5,
  party: 2,
  maxAltitudeM: null,
  approach: 'car',
  nationality: 'FR',
  entry: null,
  namedTrail: null,
  base: 'Zakopane',
  hub: null,
  nights: null,
};

const plan = (over: Partial<ResaPlanInput>): ResaLine[] => resaPlan({ ...base, ...over });
const keys = (lines: ResaLine[]) => lines.map((l) => l.key);
const line = (lines: ResaLine[], key: string) => {
  const hit = lines.find((l) => l.key === key);
  if (!hit) throw new Error(`ligne « ${key} » absente : ${keys(lines).join(', ')}`);
  return hit;
};

/** Les sept projets de la demande : chacun avec ses lignes attendues, dans l'ordre où l'on s'en occupe. */
const PROJECTS: Array<{ name: string; input: Partial<ResaPlanInput>; expected: string[] }> = [
  {
    name: 'rando Tatras 5 j depuis Paris (avion, refuges)',
    input: { activity: 'hiking', destinationCountry: 'PL', days: 5, approach: 'flight', hub: 'Kraków John Paul II International Airport', base: 'Zakopane', nights: 'refuge', entry: { kind: 'libre_circulation', maxStayDays: null, stayWindow: null, verified: '2026-10-10' } },
    expected: ['insurance', 'transfer', 'refuges'],
  },
  {
    name: 'road trip Islande 10 j (avion + voiture de location)',
    input: { activity: 'roadtrip', destinationCountry: 'IS', start: '2026-07-01', end: '2026-07-10', days: 10, approach: 'flight', hub: 'Keflavík International Airport', base: 'Reykjavik' },
    expected: ['insurance', 'rental-car'],
  },
  {
    name: 'week-end ski Chamonix (train)',
    input: { activity: 'ski', destinationCountry: 'FR', start: '2027-01-15', end: '2027-01-17', days: 3, approach: 'train', base: 'Chamonix' },
    expected: ['transfer', 'rental-gear', 'lift-pass'],
  },
  {
    name: 'trek Népal 3 semaines (visa, altitude, permis à vérifier)',
    input: { activity: 'trekking', destinationCountry: 'NP', start: '2026-10-05', end: '2026-10-25', days: 21, approach: 'flight', hub: 'Tribhuvan International Airport', base: 'Katmandou', maxAltitudeM: 5400, entry: { kind: 'visa_arrivee', maxStayDays: 90, stayWindow: null, verified: '2026-10-07' } },
    expected: ['visa', 'insurance', 'transfer', 'permit'],
  },
  {
    name: 'kayak Suède (avion, embarcation)',
    input: { activity: 'water', destinationCountry: 'SE', days: 7, approach: 'flight', hub: 'Stockholm Arlanda Airport', base: 'Stockholm', entry: { kind: 'libre_circulation', maxStayDays: null, stayWindow: null, verified: '2026-10-10' } },
    expected: ['insurance', 'transfer', 'rental-boat'],
  },
  {
    name: 'city-trip Lisbonne en train (activités sur place)',
    input: { activity: 'citytrip', destinationCountry: 'PT', days: 4, approach: 'train', base: 'Lisbonne' },
    expected: ['insurance', 'transfer', 'activities'],
  },
  {
    name: 'rando à la journée en France en voiture (rien de superflu)',
    input: { activity: 'hiking', destinationCountry: 'FR', days: 1, approach: 'car', base: 'Vercors' },
    expected: [],
  },
];

describe('resaPlan · les sept projets', () => {
  it.each(PROJECTS)('$name', ({ input, expected }) => {
    expect(keys(plan(input))).toEqual(expected);
  });

  it('chaque ligne porte une clé unique, un titre, un « pourquoi », un moment et un lien https', () => {
    for (const { input } of PROJECTS) {
      const lines = plan(input);
      expect(new Set(keys(lines)).size).toBe(lines.length);
      for (const l of lines) {
        expect(l.title.length).toBeGreaterThan(3);
        expect(l.why.length).toBeGreaterThan(3);
        expect(l.when === BEFORE_DEPARTURE || /^\d{4}-\d{2}-\d{2}$/.test(l.when)).toBe(true);
        if (l.url) expect(l.url).toMatch(/^https:\/\//);
        expect(l.key).toMatch(/^[a-z][a-z0-9-]{0,39}$/);
      }
    }
  });
});

describe('resaPlan · transfert', () => {
  it('avion : « Rejoindre <base> depuis <aéroport> », lien Google Maps en transports en commun aéroport → base', () => {
    const l = line(plan({ activity: 'hiking', destinationCountry: 'PL', approach: 'flight', hub: 'Kraków John Paul II International Airport', base: 'Zakopane' }), 'transfer');
    expect(l.kind).toBe('transfer');
    expect(l.title).toBe('Rejoindre Zakopane depuis Kraków John Paul II International Airport');
    expect(l.when).toBe('2026-08-10');
    expect(l.url).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=Krak%C3%B3w%20John%20Paul%20II%20International%20Airport&destination=Zakopane&travelmode=transit'
    );
    expect(l.price).toBeUndefined();
  });
  it('train : depuis « la gare » quand aucune gare n’est connue ; aéroport inconnu : « l’aéroport », jamais un nom inventé', () => {
    expect(line(plan({ approach: 'train', base: 'Lisbonne', destinationCountry: 'PT' }), 'transfer').title).toBe('Rejoindre Lisbonne depuis la gare');
    expect(line(plan({ approach: 'flight', base: 'Chamonix' }), 'transfer').title).toBe('Rejoindre Chamonix depuis l’aéroport');
  });
  it('voiture, covoiturage, à pied, trajet inconnu : aucun transfert', () => {
    for (const approach of ['car', 'carpool', 'foot', null] as const) expect(keys(plan({ approach }))).not.toContain('transfer');
  });
  it('sans base connue : pas de lien, la ligne reste (le lieu se précise)', () => {
    const l = line(plan({ approach: 'flight', base: null }), 'transfer');
    expect(l.url).toBeNull();
  });
  it('le transfert tombe quand une voiture de location est prise : on la récupère à l’arrivée', () => {
    const lines = plan({ activity: 'roadtrip', approach: 'flight', destinationCountry: 'IS' });
    expect(keys(lines)).toContain('rental-car');
    expect(keys(lines)).not.toContain('transfer');
  });
});

describe('resaPlan · location', () => {
  it('road trip arrivé en avion : voiture de location aux dates du voyage, prix du barème versionné du dépôt', () => {
    const lines = plan({ activity: 'roadtrip', destinationCountry: 'IS', start: '2026-07-01', end: '2026-07-10', days: 10, party: 3, approach: 'flight' });
    const l = line(lines, 'rental-car');
    expect(l.kind).toBe('rental');
    expect(l.when).toBe('2026-07-01');
    expect(l.price).toEqual({
      amount: carRentalPerDay(priceLevel('IS').level) * 10,
      currency: 'EUR',
      basis: expect.stringContaining('barème Compas'),
      per: 'group',
    });
    expect(l.url).toBe(carRentalUrl());
    expect(l.url).toBe('https://www.rentalcars.com/');
  });
  it('road trip : deux voitures pour cinq personnes (le barème de l’autofill : quatre places)', () => {
    const l = line(plan({ activity: 'roadtrip', destinationCountry: 'IS', days: 10, party: 5, approach: 'flight' }), 'rental-car');
    expect(l.price?.amount).toBe(carRentalPerDay(priceLevel('IS').level) * 10 * 2);
  });
  it('road trip arrivé en voiture : rien à louer ; sans voiture voulue (carFree) : rien non plus', () => {
    expect(keys(plan({ activity: 'roadtrip', approach: 'car' }))).not.toContain('rental-car');
    expect(keys(plan({ activity: 'roadtrip', approach: 'flight', carFree: true }))).not.toContain('rental-car');
  });
  it('sans durée connue : la location est listée sans prix', () => {
    const l = line(plan({ activity: 'roadtrip', approach: 'flight', days: null, start: null, end: null }), 'rental-car');
    expect(l.price).toBeUndefined();
    expect(l.when).toBe(BEFORE_DEPARTURE);
  });
  it('vélo : location seulement si l’on arrive sans voiture, jamais de prix inventé', () => {
    const l = line(plan({ activity: 'cycling', approach: 'train' }), 'rental-bike');
    expect(l.kind).toBe('rental');
    expect(l.price).toBeUndefined();
    expect(l.url).toBe(objectSearchUrl('location vélo', 'Zakopane'));
    expect(keys(plan({ activity: 'cycling', approach: 'car' }))).not.toContain('rental-bike');
  });
  it('kayak, canoë, eau : location d’embarcation', () => {
    const l = line(plan({ activity: 'water', approach: 'car' }), 'rental-boat');
    expect(l.kind).toBe('rental');
    expect(l.price).toBeUndefined();
  });
  it('ski : forfait de remontées ET location de matériel, sans prix (aucun barème)', () => {
    const lines = plan({ activity: 'ski', approach: 'train', base: 'Chamonix' });
    const pass = line(lines, 'lift-pass');
    const gear = line(lines, 'rental-gear');
    expect(pass.kind).toBe('pass');
    expect(gear.kind).toBe('rental');
    expect(pass.price).toBeUndefined();
    expect(gear.price).toBeUndefined();
    expect(pass.url).toBe(objectSearchUrl('forfait remontées mécaniques', 'Chamonix'));
  });
  it('escalade, via ferrata, alpinisme : location de matériel ; guide conseillé seulement au-dessus du seuil d’engagement du moteur', () => {
    expect(keys(plan({ activity: 'climbing' }))).toEqual(['rental-gear']);
    expect(keys(plan({ activity: 'mountaineering', technicalLevel: 'ok' }))).toEqual(['rental-gear']);
    expect(keys(plan({ activity: 'mountaineering', technicalLevel: 'non_evalue' }))).toEqual(['rental-gear']);
    const engaged = plan({ activity: 'mountaineering', technicalLevel: 'vigilance' });
    expect(keys(engaged)).toEqual(['rental-gear', 'guide']);
    expect(line(engaged, 'guide').kind).toBe('guide');
    expect(keys(plan({ activity: 'climbing', technicalLevel: 'bloque' }))).toContain('guide');
  });
});

describe('resaPlan · refuges et sentier nommé', () => {
  it('trek en refuge : « Réserver les refuges à l’avance » avec une date limite, pas un prix', () => {
    const l = line(plan({ activity: 'trekking', nights: 'refuge', start: '2026-08-10' }), 'refuges');
    expect(l.kind).toBe('permit');
    expect(l.title).toBe('Réserver les refuges à l’avance');
    expect(l.bookBy).toBe('2026-06-11'); // 60 jours avant le départ
    expect(REFUGE_BOOK_LEAD_DAYS).toBe(60);
    expect(l.price).toBeUndefined();
  });
  it('sentier nommé : même ligne, même sans « refuge » dit', () => {
    expect(keys(plan({ activity: 'trekking', namedTrail: 'GR20', nights: null }))).toContain('refuges');
  });
  it('date limite déjà passée ou départ inconnu : la ligne reste, sans date limite inventée', () => {
    expect(line(plan({ activity: 'trekking', nights: 'refuge', start: '2026-08-10', today: '2026-07-20' }), 'refuges').bookBy).toBeUndefined();
    expect(line(plan({ activity: 'trekking', nights: 'refuge', start: null, end: null }), 'refuges').bookBy).toBeUndefined();
  });
  it('bivouac ou nuits en hébergement : pas de réservation de refuge', () => {
    expect(keys(plan({ activity: 'trekking', nights: 'bivouac' }))).not.toContain('refuges');
    expect(keys(plan({ activity: 'hiking', nights: 'hebergement' }))).not.toContain('refuges');
  });
});

describe('resaPlan · papiers, assurance, permis', () => {
  it('destination hors du pays d’origine : assurance voyage au barème du dépôt (par personne, altitude comprise)', () => {
    const l = line(plan({ destinationCountry: 'PT', days: 4, maxAltitudeM: null }), 'insurance');
    expect(l.kind).toBe('insurance');
    expect(l.when).toBe(BEFORE_DEPARTURE);
    expect(l.price).toEqual({ amount: insurance(4, { abroad: true, altitudeM: null }), currency: 'EUR', basis: expect.stringContaining('barème Compas'), per: 'person' });
    const high = line(plan({ destinationCountry: 'NP', days: 21, maxAltitudeM: 5400 }), 'insurance');
    expect(high.price?.amount).toBe(insurance(21, { abroad: true, altitudeM: 5400 }));
    expect(high.price!.amount).toBeGreaterThan(insurance(21, { abroad: true, altitudeM: null }));
  });
  it('même pays, ou origine inconnue sans indice : aucune assurance affirmée', () => {
    expect(keys(plan({ destinationCountry: 'FR', originCountry: 'FR' }))).not.toContain('insurance');
    expect(keys(plan({ destinationCountry: 'PT', originCountry: null }))).not.toContain('insurance');
    // Le serveur sait parfois « à l’étranger » sans le pays de départ (départ du lanceur).
    expect(keys(plan({ destinationCountry: 'PT', originCountry: null, abroad: true }))).toContain('insurance');
  });
  it('visa ou autorisation requis (table passeport × destination) : ligne « visa », prix du barème pour un Français', () => {
    const l = line(plan({ destinationCountry: 'NP', entry: { kind: 'e_visa', maxStayDays: 90, stayWindow: null, verified: '2026-10-07' }, party: 2 }), 'visa');
    expect(l.kind).toBe('visa');
    expect(l.when).toBe(BEFORE_DEPARTURE);
    expect(l.price).toEqual({ amount: entryFees('NP')!.eur, currency: 'EUR', basis: expect.stringContaining('barème Compas'), per: 'person' });
  });
  it('autre nationalité ou nationalité inconnue : la ligne reste, jamais de prix (le barème est celui d’un ressortissant français)', () => {
    const entry = { kind: 'visa_a_demander' as const, maxStayDays: null, stayWindow: null, verified: '2026-10-07' };
    expect(line(plan({ destinationCountry: 'IN', nationality: 'DE', entry }), 'visa').price).toBeUndefined();
    expect(line(plan({ destinationCountry: 'IN', nationality: null, entry }), 'visa').price).toBeUndefined();
  });
  it('sans visa, libre circulation, entrée non confirmée : pas de ligne visa', () => {
    for (const kind of ['sans_visa', 'libre_circulation', 'non_confirme'] as const)
      expect(keys(plan({ destinationCountry: 'PT', entry: { kind, maxStayDays: 90, stayWindow: null, verified: '2026-10-07' } }))).not.toContain('visa');
  });
  it('aucun permis chiffré ni inventé : une ligne générique « Vérifier s’il faut un permis d’accès » pour la montagne hors Europe', () => {
    const l = line(plan({ activity: 'trekking', destinationCountry: 'NP' }), 'permit');
    expect(l.kind).toBe('permit');
    expect(l.title).toBe('Vérifier s’il faut un permis d’accès');
    expect(l.price).toBeUndefined();
    expect(l.url).toBe(objectSearchUrl('permis d’accès randonnée', 'Zakopane'));
    expect(l.url).toMatch(/^https:\/\/duckduckgo\.com\/\?q=/);
    // Europe : pas de ligne ; activité qui n’est pas de la montagne : pas de ligne.
    expect(keys(plan({ activity: 'trekking', destinationCountry: 'PL' }))).not.toContain('permit');
    expect(keys(plan({ activity: 'citytrip', destinationCountry: 'NP' }))).not.toContain('permit');
  });
});

describe('resaPlan · activités sur place', () => {
  it('ville ou plage : recherche d’activités sur la destination (GetYourGuide), sans identifiant d’affiliation', () => {
    for (const activity of ['citytrip', 'beach']) {
      const l = line(plan({ activity, base: 'Lisbonne', destinationCountry: 'PT' }), 'activities');
      expect(l.kind).toBe('activity');
      expect(l.url).toBe('https://www.getyourguide.com/s/?q=Lisbonne');
      expect(l.url).toBe(activitiesSearchUrl('Lisbonne'));
      expect(l.price).toBeUndefined();
    }
    expect(keys(plan({ activity: 'hiking' }))).not.toContain('activities');
  });
});

describe('resaPlan · ordre et prix', () => {
  it('dans l’ordre où l’on s’en occupe : papiers, assurance, transfert, location, forfait/permis, guide, activités', () => {
    const lines = plan({
      activity: 'ski',
      destinationCountry: 'NP',
      approach: 'flight',
      entry: { kind: 'e_visa', maxStayDays: 90, stayWindow: null, verified: '2026-10-07' },
      nights: 'refuge',
      technicalLevel: 'vigilance',
    });
    const order = keys(lines);
    expect(order).toEqual(['visa', 'insurance', 'transfer', 'rental-gear', 'lift-pass', 'refuges', 'permit']);
  });
  it('un prix n’existe que s’il vient d’un barème versionné : tout le reste est sans prix', () => {
    const projects = PROJECTS.flatMap((p) => plan(p.input));
    const priced = projects.filter((l) => l.price).map((l) => l.key);
    expect(new Set(priced)).toEqual(new Set(['insurance', 'rental-car', 'visa']));
    for (const l of projects.filter((x) => x.price)) expect(l.price!.basis).toMatch(/barème Compas \d{4}-\d{2}/);
  });
  it('déterministe : même entrée, même sortie', () => {
    for (const { input } of PROJECTS) expect(plan(input)).toEqual(plan(input));
  });
  it('textes dans la langue demandée (anglais)', () => {
    const l = line(resaPlan({ ...base, approach: 'flight', base: 'Chamonix', activity: 'ski', t: engineT('en') }), 'transfer');
    expect(l.title).toBe('Get to Chamonix from the airport');
  });
});
