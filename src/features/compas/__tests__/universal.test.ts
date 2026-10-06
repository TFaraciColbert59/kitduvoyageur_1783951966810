import { describe, expect, it } from 'vitest';
import { parseIntentRules, planApplication, groundingIssue } from '../engine/intent';
import { extractIntentJson } from '@/lib/ai/features/compasIntent';
import { approachMode, keepRuleForActivity, movesFromSteps, nightsPrefFor, sanitizeAdvice, sanitizeStages, stagePlaceName } from '../engine/autofill';
import { destinationRadiusKm, maxLegKm, parseNominatim, parsePhoton, pickDestination, pickPlace } from '../engine/places';

const TODAY = '2026-10-02';
const current = {
  startDate: null,
  endDate: null,
  days: null,
  shortHours: null,
  preferences: { pace: 'normal' as const, nights: null, avoid: [], wishes: [] },
  hasRoute: false,
};

describe('Dis-le : destination et durée sans date', () => {
  it('« 20 jours au Népal en trek à 2 » → destination, durée seule, trek, 2 personnes', () => {
    const a = parseIntentRules('20 jours au Népal en trek à 2', TODAY);
    expect(a).toContainEqual({ type: 'set_destination', place: 'Népal' });
    expect(a).toContainEqual({ type: 'set_duration', days: 20, hours: null });
    expect(a).toContainEqual({ type: 'set_party_size', count: 2 });
    const ops = planApplication(a, current);
    expect(ops[0]).toEqual({ op: 'destination', place: 'Népal' });
    expect(ops).toContainEqual({ op: 'span', days: 20 });
    expect(ops.some((o) => o.op === 'dates')).toBe(false);
  });

  it('la durée retenue sans départ est gardée quand le départ arrive seul', () => {
    const ops = planApplication([{ type: 'set_dates', start: '2026-11-01', end: null }], {
      ...current,
      plannedDays: 20,
    });
    expect(ops).toContainEqual({
      op: 'dates',
      startDate: '2026-11-01',
      endDate: '2026-11-20',
      durationHours: null,
      resplit: false,
    });
  });

  it('en Islande, à Chamonix, dans le Vercors ; jamais un mois ni un nombre', () => {
    expect(parseIntentRules('une semaine en Islande', TODAY)).toContainEqual({ type: 'set_destination', place: 'Islande' });
    expect(parseIntentRules('3 jours à Chamonix pour 4', TODAY)).toContainEqual({ type: 'set_destination', place: 'Chamonix' });
    expect(parseIntentRules('rando dans le Vercors', TODAY)).toContainEqual({ type: 'set_destination', place: 'Vercors' });
    expect(parseIntentRules('5 jours en avril à 3', TODAY).some((x) => x.type === 'set_destination')).toBe(false);
  });

  it('une destination inventée par l’IA est refusée', () => {
    expect(groundingIssue({ type: 'set_destination', place: 'Pérou' }, '20 jours au Népal')).not.toBeNull();
    expect(groundingIssue({ type: 'set_destination', place: 'Népal' }, '20 jours au Népal')).toBeNull();
  });
});

describe('itinéraire proposé', () => {
  it('un jour manquant reprend le lieu de la veille ; hors limites écarté ; move inconnu → aucun', () => {
    const st = sanitizeStages(
      {
        stages: [
          { day: 1, place: 'Katmandou', move: 'vol' },
          { day: 2, place: 'Lukla', move: 'vol', note: 'vol court' },
          { day: 4, place: 'Namche Bazar', move: 'téléportation' },
          { day: 9, place: 'Ailleurs' },
        ],
      },
      4
    );
    expect(st.map((s) => [s.day, s.place, s.move])).toEqual([
      [1, 'Katmandou', 'vol'],
      [2, 'Lukla', 'vol'],
      [3, 'Lukla', 'aucun'],
      [4, 'Namche Bazar', 'aucun'],
    ]);
    expect(sanitizeStages({ nope: true }, 3)).toEqual([]);
    // Format compact de l'IA : [jour, lieu, move, note]
    expect(
      sanitizeStages({ stages: [[1, 'Reykjavik', 'vol', ''], [2, 'Vík', 'voiture', 'falaises']] }, 2).map(
        (s) => [s.place, s.move, s.note]
      )
    ).toEqual([
      ['Reykjavik', 'vol', null],
      ['Vík', 'voiture', 'falaises'],
    ]);
  });
});

describe('venir jusqu’au départ', () => {
  it('route en dessous de 900 km, avion au-delà, rien sur place', () => {
    expect(approachMode({ straightKm: 0.2 })).toBe('sur_place');
    expect(approachMode({ straightKm: 650 })).toBe('route');
    expect(approachMode({ straightKm: 7000 })).toBe('avion');
  });
});

describe('chiffrage du spécialiste', () => {
  it('vol, formalités et assurance bornés ; un chiffre absurde est ignoré', () => {
    const a = sanitizeAdvice({
      flight_eur_per_person: 780,
      entry_fees_eur_per_person: 95,
      entry_fees_detail: 'Visa 30 jours, permis TIMS et parc Sagarmatha',
      insurance_eur_per_person: 9000,
      local_transport_eur_per_person: 120,
    });
    expect(a.flightPerPerson).toBe(780);
    expect(a.entryFeesPerPerson).toBe(95);
    expect(a.entryFeesDetail).toMatch(/TIMS/);
    expect(a.insurancePerPerson).toBeNull();
    expect(a.localTransportPerPerson).toBe(120);
  });
});

describe('carte (Photon)', () => {
  const payload = {
    features: [
      {
        properties: { name: 'Népal', countrycode: 'NP', country: 'Népal', type: 'country', extent: [80.05, 30.44, 88.2, 26.34] },
        geometry: { coordinates: [84, 28.38] },
      },
      { properties: { name: 'Namche Bazar', countrycode: 'NP', type: 'city' }, geometry: { coordinates: [86.71, 27.8] } },
      { properties: { name: 'Namche', countrycode: 'IN', type: 'city' }, geometry: { coordinates: [77, 20] } },
    ],
  };
  it('lit nom, position, code pays ISO et emprise', () => {
    const p = parsePhoton(payload);
    expect(p[0]).toMatchObject({ name: 'Népal', countryCode: 'NP', kind: 'country' });
    expect(destinationRadiusKm(p[0])).toBeGreaterThan(400);
  });
  it('parmi le possible, la pertinence de la carte gagne sur le plus proche homonyme', () => {
    const near = { lat: 27.7, lon: 85.3 };
    const list = parsePhoton({
      features: [
        { properties: { name: 'Syabrubesi', countrycode: 'NP', osm_key: 'place', osm_value: 'village' }, geometry: { coordinates: [85.34, 28.16] } },
        { properties: { name: 'Syabrubesi', countrycode: 'NP', osm_key: 'place', osm_value: 'neighbourhood' }, geometry: { coordinates: [85.31, 27.73] } },
        { properties: { name: 'Syabrubesi Lodge', countrycode: 'NP', osm_key: 'tourism', osm_value: 'hotel' }, geometry: { coordinates: [85.3, 27.71] } },
      ],
    });
    expect(pickPlace(list, { near, maxKm: 700 })?.lat).toBe(28.16);
  });

  it('le lieu qui porte le nom passe devant un village au nom voisin (Glen Coe ≠ Corby Glen)', () => {
    const list = parsePhoton({
      features: [
        { properties: { name: 'Glen Coe', countrycode: 'GB', osm_key: 'natural', osm_value: 'valley', type: 'other' }, geometry: { coordinates: [-5.02, 56.67] } },
        { properties: { name: 'Corby Glen', countrycode: 'GB', osm_key: 'place', osm_value: 'village' }, geometry: { coordinates: [-0.52, 52.81] } },
        { properties: { name: 'Glen', countrycode: 'GB', osm_key: 'place', osm_value: 'village' }, geometry: { coordinates: [-6.71, 54.85] } },
      ],
    });
    const fortWilliam = { lat: 56.82, lon: -5.11 };
    expect(pickPlace(list, { countryCode: 'GB', near: fortWilliam, maxKm: 700, query: 'Glen Coe' })?.lat).toBe(56.67);
    // Nom traduit par la carte : aucun nom exact, la pertinence décide.
    const skye = parsePhoton({
      features: [
        { properties: { name: 'Île de Skye', countrycode: 'GB', osm_key: 'place', osm_value: 'island' }, geometry: { coordinates: [-6.3, 57.36] } },
        { properties: { name: 'Skye Village', countrycode: 'GB', osm_key: 'place', osm_value: 'village' }, geometry: { coordinates: [-4, 55] } },
        { properties: { name: 'Isle Of Skye Quarry', countrycode: 'GB', osm_key: 'natural', osm_value: 'scrub' }, geometry: { coordinates: [-1.58, 53.49] } },
      ],
    });
    expect(pickPlace(skye, { near: fortWilliam, maxKm: 700, query: 'Isle of Skye' })?.name).toBe('Île de Skye');
    // Nom plus long accepté pour une localité seulement.
    const chamonix = parsePhoton({
      features: [
        { properties: { name: 'Chamonix Lodge', countrycode: 'FR', osm_key: 'tourism', osm_value: 'hotel' }, geometry: { coordinates: [6.0, 45.0] } },
        { properties: { name: 'Chamonix-Mont-Blanc', countrycode: 'FR', osm_key: 'place', osm_value: 'town' }, geometry: { coordinates: [6.87, 45.92] } },
      ],
    });
    expect(pickPlace(chamonix, { query: 'Chamonix' })?.name).toBe('Chamonix-Mont-Blanc');
    // Rien en commun avec le nom demandé : pas d'étape plutôt qu'un lieu au hasard.
    const random = parsePhoton({
      features: [{ properties: { name: 'Warwick', countrycode: 'GB', osm_key: 'place', osm_value: 'town' }, geometry: { coordinates: [-1.5, 52.3] } }],
    });
    expect(pickPlace(random, { query: 'Departure lounge' })).toBeNull();
  });

  it('une étape doit être dans le pays et près de la destination', () => {
    const p = parsePhoton(payload);
    expect(pickPlace(p.slice(1), { countryCode: 'NP', near: { lat: 28.38, lon: 84 }, maxKm: 600 })?.name).toBe('Namche Bazar');
    expect(pickPlace(p.slice(1), { countryCode: 'NP', near: { lat: 28.38, lon: 84 }, maxKm: 50 })).toBeNull();
  });
});

describe('selon l’activité', () => {
  it('séjour culturel : ni bâtons ni sifflet ; road trip : pas de tente ; trek : tout', () => {
    expect(keepRuleForActivity('trekking-poles', 'cultural')).toBe(false);
    expect(keepRuleForActivity('first-aid', 'cultural')).toBe(true);
    expect(keepRuleForActivity('tent-2p', 'roadtrip')).toBe(false);
    expect(keepRuleForActivity('headlamp', 'roadtrip')).toBe(true);
    expect(keepRuleForActivity('crampons', 'trekking')).toBe(true);
  });
  it('culturel ou road trip : sous un toit sauf préférence dite', () => {
    expect(nightsPrefFor('cultural', null)).toBe('hebergement');
    expect(nightsPrefFor('roadtrip', 'bivouac')).toBe('bivouac');
    expect(nightsPrefFor('trekking', null)).toBeNull();
  });
});

describe('carte de secours (Nominatim)', () => {
  it('même forme que Photon : code pays, lieu habité, emprise réordonnée', () => {
    const [p] = parseNominatim([
      {
        name: 'Villard-de-Lans',
        lat: '45.07',
        lon: '5.55',
        addresstype: 'village',
        type: 'administrative',
        boundingbox: ['45.01', '45.12', '5.49', '5.62'],
        address: { country_code: 'fr', country: 'France' },
      },
    ]);
    expect(p).toMatchObject({ name: 'Villard-de-Lans', countryCode: 'FR', settlement: true, extent: [5.49, 45.12, 5.62, 45.01] });
  });
});

describe('Préremplissage : étapes déjà en place', () => {
  it('lit le moyen de transport enregistré de chaque étape', () => {
    const moves = movesFromSteps([
      { day_number: 1, title: 'Reykjavik', transport_mode: 'plane' },
      { day_number: 2, title: 'Vík', transport_mode: 'car' },
      { day_number: 3, title: 'Heimaey', transport_mode: 'boat' },
      { day_number: 4, title: 'Sentier', transport_mode: null },
    ]);
    expect(moves.map((m) => m.move)).toEqual(['vol', 'voiture', 'bateau', 'aucun']);
    expect(moves[2]).toEqual({ day: 3, name: 'Heimaey', move: 'bateau' });
  });
});

describe('Spécialiste : formats de réponse observés avec Nemotron 3.5 Lightning', () => {
  const show = (raw: unknown, days: number) =>
    sanitizeStages(raw, days).map((st) => `${st.day}:${st.place}:${st.move}`);

  it('clé demandée, clés françaises, tableau nu', () => {
    expect(show({ stages: [[1, 'Reykjavik', 'vol', ''], [2, 'Vík', 'voiture', '']] }, 2)).toEqual([
      '1:Reykjavik:vol',
      '2:Vík:voiture',
    ]);
    expect(
      show({ jours: [{ jour: 1, lieu: 'Reykjavik', move: 'aucun' }, { jour: 2, lieu: 'Vík', transport: 'Voiture' }] }, 2)
    ).toEqual(['1:Reykjavik:aucun', '2:Vík:voiture']);
    expect(show([{ day: 1, place: 'Ajaccio', move: 'à pied' }], 1)).toEqual(['1:Ajaccio:marche']);
  });

  it('objet indexé par jour, avec une case de trop ou imbriqué', () => {
    expect(show({ '1': ['Kathmandu', 'bus station', 'aucun', 'arrivée'], '2': ['Godavari', 'voiture', 'bus', ''] }, 2)).toEqual([
      '1:Kathmandu:aucun',
      '2:Godavari:voiture',
    ]);
    expect(
      show({ day1: { stages: [[1, 'Ajaccio', 'vol', 'arrivée']] }, day2: { stages: [[1, 'Vizzavona', 'train', '']] } }, 2)
    ).toEqual(['1:Ajaccio:vol', '2:Vizzavona:train']);
  });

  it('plusieurs objets à la suite, une ligne par jour, deviennent un seul objet', () => {
    const text = '{"1":["Ajaccio", "aucun", "arrivee"]}\n{"2":["Corte", "bus", ""]}\n{"3":["Vizzavona", "marche", ""]}';
    expect(show(extractIntentJson(text), 3)).toEqual(['1:Ajaccio:aucun', '2:Corte:bus', '3:Vizzavona:marche']);
  });

  it('un objet suivi de prose reste un seul objet', () => {
    expect(extractIntentJson('```json\n{"a":1}\n```\nVoilà.')).toEqual({ a: 1 });
    expect(extractIntentJson('pas de json')).toBeNull();
  });
});

describe('Destination nommée : la ville que tout le monde entend, pas un homonyme', () => {
  const place = (name: string, type: string, cc: string, key = 'place') => ({
    type: 'Feature',
    geometry: { coordinates: [0, 0] },
    properties: { name, osm_key: key, osm_value: type, type, countrycode: cc },
  });

  it('« Chamonix » → Chamonix-Mont-Blanc (France), pas la ferme d’Afrique du Sud', () => {
    // Réponse Photon réelle (2026-10-05), dans son ordre.
    const found = parsePhoton({
      features: [
        place('Chamonix-Mont-Blanc', 'city', 'FR'),
        place('Chamonix', 'locality', 'ZA'),
        place('Chamonix', 'district', 'FR'),
        place('Chamonix', 'locality', 'US', 'landuse'),
      ],
    });
    expect(pickDestination(found, 'Chamonix')).toMatchObject({ name: 'Chamonix-Mont-Blanc', countryCode: 'FR' });
  });

  it('« Vietnam » → le pays « Viêt Nam », jamais le Vietnam Veterans Memorial de Washington', () => {
    const memorial = place('Vietnam Veterans Memorial', 'memorial', 'US', 'historic');
    const country = place('Viêt Nam', 'country', 'VN');
    expect(pickDestination(parsePhoton({ features: [memorial, country] }), 'Vietnam')).toMatchObject({ countryCode: 'VN' });
    expect(pickDestination(parsePhoton({ features: [memorial] }), 'Vietnam')).toBeNull();
  });

  it('jamais un lieu-dit ni un bâtiment ; rien plutôt qu’un faux', () => {
    const found = parsePhoton({ features: [place('Chamonix', 'locality', 'ZA'), place('Chamonix', 'house', 'JP')] });
    expect(pickDestination(found, 'Chamonix')).toBeNull();
    expect(pickDestination(parsePhoton({ features: [place('Moabit', 'district', 'DE')] }), 'Moab')).toBeNull();
  });

  it('« Mont Blanc » → le sommet (type « other » chez Photon), une ferme du même nom jamais', () => {
    const peak = {
      type: 'Feature',
      geometry: { coordinates: [6.87, 45.83] },
      properties: { name: 'Mont Blanc', osm_key: 'natural', osm_value: 'peak', type: 'other', countrycode: 'FR' },
    };
    const farm = {
      type: 'Feature',
      geometry: { coordinates: [0, 0] },
      properties: { name: 'Mont Blanc', osm_key: 'place', osm_value: 'farm', type: 'other', countrycode: 'ZA' },
    };
    expect(pickDestination(parsePhoton({ features: [farm, peak] }), 'Mont-Blanc')).toMatchObject({ lat: 45.83 });
    expect(pickDestination(parsePhoton({ features: [farm] }), 'Mont Blanc')).toBeNull();
  });

  it('« Puerto Natales » n’est pas « Puerto Madryn » : mot générique, et nom exact seulement en mode strict', () => {
    const ar = parsePhoton({
      features: [
        { properties: { name: 'Puerto Madryn', countrycode: 'AR', osm_key: 'place', osm_value: 'city' }, geometry: { coordinates: [-65.04, -42.77] } },
      ],
    });
    const patagonie = { lat: -46.15, lon: -70.47 };
    expect(pickPlace(ar, { near: patagonie, maxKm: 1500, query: 'Puerto Natales' })).toBeNull();
    const cl = parsePhoton({
      features: [
        { properties: { name: 'Glaciar Grey', countrycode: 'CL', osm_key: 'natural', osm_value: 'glacier' }, geometry: { coordinates: [-73.38, -50.86] } },
      ],
    });
    const natales = { lat: -51.73, lon: -72.5 };
    expect(pickPlace(cl, { near: natales, maxKm: 250, query: 'Grey Glacier', strict: true })).toBeNull();
    expect(pickPlace(cl, { near: natales, maxKm: 250, query: 'Grey Glacier' })?.name).toBe('Glaciar Grey');
  });

  it('première étape jusqu’à 400 km de la destination lue sur la carte (« Loire » → Orléans)', () => {
    expect(maxLegKm('bus', true, 60)).toBe(400);
    expect(maxLegKm('vol', true, 1500)).toBe(1500);
    expect(maxLegKm('marche', false, 60)).toBe(40);
  });

  it('nom exact gardé dans l’ordre de la carte (Banff Canada avant Banff Écosse)', () => {
    const found = parsePhoton({ features: [place('Banff', 'city', 'CA'), place('Banff', 'city', 'GB')] });
    expect(pickDestination(found, 'banff')?.countryCode).toBe('CA');
  });
});

describe('Étapes : noms transcrits, écritures locales, tronçons (essais aléatoires, Népal)', () => {
  const near = { lat: 28.38, lon: 84 };
  it('« Kathmandu » retrouve « Katmandou »', () => {
    const list = parsePhoton({
      features: [
        { properties: { name: 'Katmandou', countrycode: 'NP', osm_key: 'place', osm_value: 'city' }, geometry: { coordinates: [85.32, 27.71] } },
      ],
    });
    expect(pickPlace(list, { countryCode: 'NP', near, maxKm: 400, query: 'Kathmandu', strict: true })?.name).toBe('Katmandou');
  });
  it('une localité connue seulement dans son écriture est gardée hors du mode strict', () => {
    const list = parsePhoton({
      features: [
        { properties: { name: 'स्याफ्रु बेसी', countrycode: 'NP', osm_key: 'place', osm_value: 'hamlet' }, geometry: { coordinates: [85.34, 28.16] } },
      ],
    });
    expect(pickPlace(list, { countryCode: 'NP', near, maxKm: 400, query: 'Syabru Besi', strict: true })).toBeNull();
    expect(pickPlace(list, { countryCode: 'NP', near, maxKm: 400, query: 'Syabru Besi' })?.lat).toBe(28.16);
    // Jamais un nom latin sans rapport.
    const other = parsePhoton({
      features: [{ properties: { name: 'Pokhara', countrycode: 'NP', osm_key: 'place', osm_value: 'city' }, geometry: { coordinates: [83.98, 28.21] } }],
    });
    expect(pickPlace(other, { countryCode: 'NP', near, maxKm: 400, query: 'Syabru Besi' })).toBeNull();
  });
  it.each([
    ['Syabru Besi to Gatlang', 'Gatlang'],
    ['Chamonix → Argentière', 'Argentière'],
    ['de Zermatt à Täsch', 'Täsch'],
    ['Saint-Jean-Pied-de-Port', 'Saint-Jean-Pied-de-Port'],
    ['Torre a Mare', 'Torre a Mare'],
  ])('tronçon « %s » → étape du soir « %s »', (raw, want) => {
    expect(stagePlaceName(raw)).toBe(want);
  });
});

describe('Géocodage inverse de secours (Nominatim)', () => {
  it('la commune du point sert de nom de départ', () => {
    const [p] = parseNominatim([
      {
        lat: '45.8992',
        lon: '6.1294',
        name: 'Chantier Hotel de Ville',
        addresstype: 'construction',
        address: { city: 'Annecy', country: 'France', country_code: 'fr' },
      },
    ]);
    expect(p).toMatchObject({ locality: 'Annecy', countryCode: 'FR' });
  });
});

describe('Phrases tirées au hasard (20 parcours) : lecture sans IA', () => {
  const read = (t: string) => {
    const a = parseIntentRules(t, TODAY);
    const one = <K extends string>(k: K) => a.find((x) => x.type === k) as Record<string, unknown> | undefined;
    return {
      dest: one('set_destination')?.place,
      act: one('set_activity')?.activity,
      route: one('search_route')?.query,
      wishes: a.filter((x) => x.type === 'wish').map((x) => (x as { label: string }).label),
    };
  };

  it('« sur la », « autour du lac de », « traversée des », « in the » ouvrent une destination', () => {
    expect(read('canoë 3 jours sur la Dordogne')).toMatchObject({ dest: 'Dordogne', act: 'water' });
    expect(read('week-end à vélo autour du lac d’Annecy').dest).toBe('Lac d’Annecy');
    expect(read('traversée des Pyrénées 15 jours')).toMatchObject({ dest: 'Pyrénées', act: 'trekking' });
    expect(read('Hiking 5 days in the Swiss Alps')).toMatchObject({ dest: 'Swiss Alps', act: 'hiking' });
  });
  it('un nom commun de lieu suivi d’un nom propre compte (« calanques de Marseille »)', () => {
    expect(read('randonnée 3h dans les calanques de Marseille')).toMatchObject({
      dest: 'Calanques de Marseille',
      route: 'Calanques de Marseille',
    });
    // Un nom commun seul n'est pas un lieu.
    expect(read('rando dans les bois demain').dest).toBeUndefined();
  });
  it('« pays dans l’endroit » : le pays est la destination, l’endroit une envie et une recherche', () => {
    expect(read('7 jours de rando au Maroc dans l’Atlas')).toMatchObject({ dest: 'Maroc', route: 'Atlas', wishes: ['Atlas'] });
    expect(read('road trip 10 jours aux États-Unis dans l’Utah')).toMatchObject({ dest: 'États-Unis', act: 'roadtrip' });
    expect(read('une semaine en Grèce dans les Cyclades')).toMatchObject({ dest: 'Grèce', wishes: ['Cyclades'] });
  });
  it('un jour de la semaine ne colle pas au lieu', () => {
    expect(read('trail de 30 km dans le Jura dimanche')).toMatchObject({ dest: 'Jura', route: 'Jura', act: 'trail' });
  });
  it('un code de sentier n’est pas une destination ; GR, chemin de l’Inca, bivouac seul', () => {
    expect(read('6 jours sur le GR20 en Corse')).toMatchObject({ dest: 'Corse', act: 'trekking' });
    expect(read('5 jours au Pérou sur le chemin de l’Inca')).toMatchObject({ dest: 'Pérou', act: 'trekking', wishes: ['chemin de l’Inca'] });
    expect(read('6 jours sur le GR20 en Corse').wishes).toEqual(['GR20']);
    expect(read('7 jours sur le Tour du Mont-Blanc').wishes).toEqual(['Tour du Mont-Blanc']);
    // « sur la route » sans nom propre : rien.
    expect(read('3 jours sur la route en Bretagne').wishes).toEqual([]);
    expect(read('bivouac 1 nuit dans le Vercors')).toMatchObject({ dest: 'Vercors', act: 'bivouac' });
    // Une rando avec bivouac reste une rando.
    expect(read('rando 2 jours avec bivouac dans le Vercors').act).toBe('hiking');
  });
});

describe('Nom d’étape : jamais un nom qui n’existe pas', () => {
  it('garde le nom proposé s’il est sur la carte, sinon prend celui de la carte', async () => {
    const { stageTitleFor } = await import('../engine/places');
    expect(stageTitleFor('Chamonix', 'Chamonix-Mont-Blanc')).toBe('Chamonix');
    expect(stageTitleFor('Bielsa', 'Bielsa')).toBe('Bielsa');
    expect(stageTitleFor("Villar-d'Arnave", "Villar-d'Arène")).toBe("Villar-d'Arène");
    expect(stageTitleFor('Kathmandu', 'Katmandou')).toBe('Katmandou');
    expect(stageTitleFor('Imlil', null)).toBe('Imlil');
    expect(stageTitleFor('Springdale repos', 'Springdale')).toBe('Springdale');
    expect(stageTitleFor('Retour Salt Lake City', 'Salt Lake City')).toBe('Salt Lake City');
  });
});

describe('Homonymes : la ville avant la maison isolée', () => {
  const f = (name: string, value: string, type: string, lon: number, lat: number) => ({
    type: 'Feature',
    geometry: { coordinates: [lon, lat] },
    properties: { name, osm_key: 'place', osm_value: value, type, countrycode: 'PE' },
  });
  it('« Cusco » → Cuzco la ville (-13,5), jamais la maison isolée du nord du Pérou', () => {
    // Réponse Photon réelle (2026-10-06), dans son ordre.
    const found = parsePhoton({
      features: [
        f('Cusco', 'state', 'state', -72.5, -12.5),
        f('Cusco', 'region', 'county', -71.99, -13.55),
        f('Cusco', 'isolated_dwelling', 'locality', -79.78, -4.58),
        f('Cusco Puquio', 'hamlet', 'district', -71.76, -15.18),
        f('Cusco Riogo', 'hamlet', 'district', -71.76, -15.18),
        f('Cuzco', 'city', 'district', -71.98, -13.52),
      ],
    });
    expect(pickPlace(found, { query: 'Cusco', maxKm: 1500, near: { lat: -9.2, lon: -75 } })).toMatchObject({ lat: -13.52 });
    const pisac = parsePhoton({
      features: [f('Pisaca', 'hamlet', 'district', -71.5, -14.1), f('Pisac', 'town', 'district', -71.85, -13.42)],
    });
    expect(pickPlace(pisac, { query: 'Pisac', maxKm: 1500 })).toMatchObject({ name: 'Pisac' });
    // Sans la ville (« Cusco, Pérou ») : la province du même nom, jamais la maison isolée ni un hameau « Cusco Riogo ».
    const noCity = parsePhoton({
      features: [
        f('Cusco', 'region', 'county', -71.99, -13.55),
        f('Cusco', 'isolated_dwelling', 'locality', -79.78, -4.58),
        f('Cusco Riogo', 'hamlet', 'district', -71.76, -15.18),
      ],
    });
    expect(pickPlace(noCity, { query: 'Cusco', maxKm: 1500 })).toMatchObject({ lat: -13.55 });
    const hotel = {
      type: 'Feature',
      geometry: { coordinates: [-72.04, -13.33] },
      properties: { name: 'Madre Tierra Resort Sacred Valley', osm_key: 'tourism', osm_value: 'hotel', type: 'house', countrycode: 'PE' },
    };
    expect(pickPlace(parsePhoton({ features: [hotel] }), { query: 'Sacred Valley', maxKm: 1500 })).toBeNull();
  });
  it('« Chamonix » : le bourg Chamonix-Mont-Blanc avant un hameau « Chamonix »', () => {
    const fr = (name: string, value: string, lat: number) => ({
      type: 'Feature',
      geometry: { coordinates: [6.8, lat] },
      properties: { name, osm_key: 'place', osm_value: value, type: 'district', countrycode: 'FR' },
    });
    const found = parsePhoton({ features: [fr('Chamonix', 'hamlet', 46.03), fr('Chamonix-Mont-Blanc', 'town', 45.92)] });
    expect(pickPlace(found, { query: 'Chamonix', maxKm: 500 })).toMatchObject({ name: 'Chamonix-Mont-Blanc' });
  });
});
