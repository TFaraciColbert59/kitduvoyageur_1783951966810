import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { knownRegion } from '../engine/knownRegions';
import { parseIntentRules } from '../engine/intent';
import { understandRequest } from '../engine/request';
import { canonicalCountryName, canonicalPlaceName, splitPlaceCountry } from '../engine/countryNames';
import { looseRank, parseGeoapify, plausibleLooseMatch, resemblesQuery, subPlaceQueries, type CompasPlace } from '../engine/places';
import { createFakeDb, type FakeDb } from '../v5/__tests__/fakeDb';
import { makeData, makeInput } from '../v5/__tests__/fixtures';
import { isResaBooked, isResaSkipped, mergeResa, parseResa } from '../v5/engine/resaStatus';
import { firstPlace, nightCards, reservationSteps, resaLinesFor, safeUrl, selectedTransport, transportViews, type ReservationContext } from '../v5/model/prevoir';
import { resaPlan, type ResaPlanInput } from '../engine/resaPlan';
import { flightAirports } from '../engine/travel';
import { parseAirports, transportOptions } from '../v5/engine/transportOptions';
import { placeOfDay, stepPlace } from '../v5/model/trip';
import { FR_T } from '../components/compasTypes';
import { EMPTY_EXTRAS, type V5Extras, type V5StayOption, type V5TransportOption } from '../v5/types';
import { compasV5SetResaStatusAction } from '../v5/server/choiceActions';
import { planItinerary, planningZoneKm, type AreaPlace } from '../engine/itinerary';
import { baseStayState, buildObjectivesQuery, mergeObjectives, objectivesFromHuts, parseObjectives, pickDayObjectives, pickStayBase, type DayObjective } from '../engine/dayObjectives';
import { readItinerary, thinItinerary } from '../server/autofillState';

const resaDb = vi.hoisted(() => ({ db: null as unknown as FakeDb, denied: false }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/observability/appErrors', () => ({ reportServerError: vi.fn(async () => undefined) }));
vi.mock('../server/compasServer', async (orig) => {
  const real = await orig<typeof import('../server/compasServer')>();
  return {
    ...real,
    requireEditor: vi.fn(async (tripId: string) => {
      if (resaDb.denied) return { error: 'Seuls les organisateurs et éditeurs peuvent modifier le kit.' };
      const trip = resaDb.db.tables.trips.find((t) => t.id === tripId);
      if (!trip) return { error: 'Voyage introuvable ou non autorisé.' };
      return { supabase: resaDb.db.client, userId: 'u1', trip, anonymous: false };
    }),
  };
});

// Constats de la phase 7 (docs/compas/phase7/CONSTATS.md) : chaque test rejoue la phrase du jeu qui a révélé le défaut.
const TODAY = '2026-10-19';
const line = (r: ReturnType<typeof understandRequest>, key: string) => r.lines.find((l) => l.key === key);

describe('C-001 · le groupe dit par « avec … » est compris', () => {
  it('« avec mon couple » → 2 personnes', () => {
    const r = understandRequest('2 semaines en Sardaigne en juillet avec mon couple', TODAY);
    expect(line(r, 'groupe')).toMatchObject({ value: '2 personnes', state: 'compris' });
  });
  it('« avec 2 enfants » → moi et 2 enfants', () => {
    const r = understandRequest('week-end à Annecy avec 2 enfants', TODAY);
    expect(line(r, 'groupe')).toMatchObject({ value: '3 personnes', state: 'compris' });
  });
  it('« avec ma femme et 2 enfants » → 4', () => {
    const r = understandRequest('3 jours dans le Vercors avec ma femme et 2 enfants', TODAY);
    expect(line(r, 'groupe')).toMatchObject({ value: '4 personnes' });
  });
  it('sans nombre sûr (« avec des amis », « avec mon sac »), le groupe reste non compris', () => {
    expect(line(understandRequest('3 jours dans le Vercors avec des amis', TODAY), 'groupe')?.state).toBe('defaut');
    expect(line(understandRequest('3 jours dans le Vercors avec mon sac de 10 kg', TODAY), 'groupe')?.state).toBe('defaut');
  });
  it('un nombre dit ailleurs prime (« à 4 avec des amis »)', () => {
    expect(line(understandRequest('3 jours dans le Vercors à 4 avec des amis', TODAY), 'groupe')).toMatchObject({ value: '4 personnes' });
  });
});

describe('C-002 · la saison dite place le départ', () => {
  it('« week-end à Chamonix en hiver » ne part pas en octobre', () => {
    const r = understandRequest('un week-end à Chamonix en hiver', TODAY);
    expect(line(r, 'quand')?.value).toMatch(/déc\./);
  });
  it('la saison en cours ne change pas le départ (automne, dit en octobre)', () => {
    const a = understandRequest('un week-end à Annecy', TODAY);
    const b = understandRequest('un week-end à Annecy en automne', TODAY);
    expect(line(b, 'quand')?.value).toBe(line(a, 'quand')?.value);
  });
  it('un mois dit l’emporte sur la saison', () => {
    const r = understandRequest('week-end à Chamonix en février, en hiver', TODAY);
    expect(line(r, 'quand')?.value).toMatch(/févr\./);
  });
});

describe('C-003 · un lieu qui ne ressemble pas à la demande est refusé', () => {
  it('« Highlanders écossais » n’est pas « Highlands écossais »', () => {
    expect(resemblesQuery({ name: 'Highlanders écossais' }, 'Highlands écossais')).toBe(false);
  });
  it('même nom ou nom plus long accepté', () => {
    expect(resemblesQuery({ name: 'Chamonix-Mont-Blanc' }, 'Chamonix')).toBe(true);
    expect(resemblesQuery({ name: 'Annecy' }, 'Annecy')).toBe(true);
  });
  it('C-008 · même lieu dit dans une autre langue (Gran Paradiso)', () => {
    expect(resemblesQuery({ name: 'Parco Nazionale Gran Paradiso' }, 'Parc national du Gran Paradiso')).toBe(true);
    expect(resemblesQuery({ name: 'Highlanders écossais' }, 'Highlands écossais')).toBe(false);
  });
});

describe('C-005 · le crédit de la carte ne passe pas par-dessus un tiroir', () => {
  it('.cp-map crée son propre contexte d’empilement', () => {
    const css = readFileSync('src/features/compas/compas.css', 'utf8');
    const block = /^\.cp-map \{([^}]*)\}/m.exec(css)?.[1] ?? '';
    expect(block).toMatch(/isolation:\s*isolate/);
  });
  it('D-32 · le crédit est sous le panneau des calques', () => {
    const css = readFileSync('src/features/compas/compas.css', 'utf8');
    expect(css).toMatch(/\.cp-map \.leaflet-bottom\.leaflet-right \{\s*z-index: 3 !important/);
  });
  it('D-31 · le panneau des calques défile au-dessus de la barre d’onglets', () => {
    const css = readFileSync('src/features/compas/compas.css', 'utf8');
    const block = /^\.cp-mopts \{([^}]*)\}/m.exec(css)?.[1] ?? '';
    expect(block).toMatch(/max-height:[^;]*--cp-nav-clear/);
    expect(block).toMatch(/overflow-y:\s*auto/);
  });
});

describe("C-010 · un nom propre composé garde son « d'… » (Côte d'Opale)", () => {
  it("« Côte d'Opale » n'est pas coupé à « Côte »", () => {
    const r = understandRequest("week-end sur les sentiers de la Côte d'Opale", TODAY);
    expect(line(r, 'lieu')?.value).toBe("Côte d'Opale");
  });
  it("« Cap d'Agde » aussi", () => {
    expect(line(understandRequest("un week-end vélo au Cap d'Agde", TODAY), 'lieu')?.value).toBe("Cap d'Agde");
  });
});

describe('C-013 · « semaine de … » sans nombre est une semaine', () => {
  it('« semaine de surf au Pays basque » → 7 jours', () => {
    const r = understandRequest('semaine de surf au Pays basque', TODAY);
    expect(line(r, 'quand')?.value).toMatch(/7 jours/);
    expect(line(r, 'quand')?.state).toBe('compris');
  });
  it('« semaine prochaine » reste un départ', () => {
    const r = understandRequest('rando dans le Vercors la semaine prochaine', TODAY);
    expect(line(r, 'quand')?.value).not.toMatch(/7 jours/);
  });
});

describe('C-014 · le dernier recours accepte un vrai lieu qui partage un mot, pas un lieu-dit', () => {
  const place = (name: string, kind: string, landmark = false) => ({ name, kind, landmark, lat: 0, lon: 0 }) as unknown as CompasPlace;
  it('« Canada Rocheuses » → « Montagnes Rocheuses » (lieu naturel connu)', () => {
    expect(plausibleLooseMatch(place('Montagnes Rocheuses', 'other', true), 'Canada Rocheuses')).toBe(true);
  });
  it('« Australie Tasmanie » → « Tasmanie »', () => {
    expect(plausibleLooseMatch(place('Tasmanie', 'state'), 'Australie Tasmanie')).toBe(true);
  });
  it('un panneau ou un commerce n’est jamais le lieu (Highlanders écossais)', () => {
    expect(plausibleLooseMatch(place('Highlanders écossais', 'house'), 'Highlands écossais')).toBe(false);
    expect(plausibleLooseMatch(place('Merzouga Desert Camp', 'house'), 'Maroc, désert de Merzouga')).toBe(false);
  });
});

describe('C-014 · une demande « pays + région » est essayée par morceaux', () => {
  it('« Argentine Mendoza » → Mendoza d’abord', () => {
    expect(subPlaceQueries('Argentine Mendoza')[0]).toBe('Mendoza');
  });
  it('« Jordanie Petra et Wadi Rum » → les lieux, pas « et »', () => {
    const q = subPlaceQueries('Jordanie Petra et Wadi Rum');
    expect(q).toContain('Wadi Rum');
    expect(q).toContain('Petra');
    expect(q.every((p) => !/^(et|de)|(et|de)$/i.test(p))).toBe(true);
  });
  it('un seul mot : rien à essayer', () => {
    expect(subPlaceQueries('Mendoza')).toEqual([]);
  });
});

describe('C-016 · le lieu en tête de phrase, suivi de la durée, est lu', () => {
  const lieu = (say: string) => line(understandRequest(say, TODAY), 'lieu');
  it.each([
    ['Bali 8 jours en juillet', 'Bali'],
    ['Vietnam 14 jours du nord au sud', 'Vietnam'],
    ['Madagascar 15 jours', 'Madagascar'],
    ['Kyoto weekend in November', 'Kyoto'],
    ['Corée du Sud 10 jours en octobre', 'Corée du Sud'],
    ['Californie parcs nationaux road trip 12 jours', 'Californie'],
    ['Lima 4 jours avec 2 enfants', 'Lima'],
  ])('« %s » → %s', (say, expected) => {
    expect(lieu(say)).toMatchObject({ value: expected, state: 'compris' });
  });
  it('un mot d’activité ou d’ouverture en tête n’est pas un lieu', () => {
    expect(lieu('Rando 3 jours')?.state).not.toBe('compris');
    expect(lieu('Bonjour 3 jours de trek')?.state).not.toBe('compris');
    expect(lieu('Trek 5 jours en Corse')?.value).toBe('Corse');
  });
});

describe("C-011 · Geoapify : le lieu le plus important d'abord", () => {
  it("« Naples » : la ville d'Italie passe devant un hameau français", () => {
    const row = (name: string, cc: string, importance: number, result_type: string) => ({
      name, lat: 1, lon: 1, country_code: cc, country: cc, result_type, rank: { importance },
    });
    const places = parseGeoapify({ results: [row('Naples', 'fr', 0.2, 'suburb'), row('Naples', 'it', 0.77, 'city')] });
    expect(places.map((p) => p.countryCode)).toEqual(['IT', 'FR']);
  });
});

describe('C-009 · le Camino est lu (Navarre), pas un lieu d’Équateur', () => {
  it('« Camino 10 jours depuis Saint-Jean-Pied-de-Port »', () => {
    const r = understandRequest('Camino 10 jours depuis Saint-Jean-Pied-de-Port', TODAY);
    expect(line(r, 'lieu')).toMatchObject({ value: 'Navarre', state: 'compris' });
  });
});

describe('C-015 · un nom à une lettre près est le même lieu (Alps / Alpes)', () => {
  it('« Alps » → « Alpes », « Highlands » ≠ « Highlanders »', () => {
    expect(resemblesQuery({ name: 'Alpes' }, 'Alps')).toBe(true);
    expect(resemblesQuery({ name: 'Highlanders écossais' }, 'Highlands écossais')).toBe(false);
  });
});

describe('C-019 · un nom étranger va au bon lieu (Sicilia, Peru, Tokio) et non à un homonyme', () => {
  const place = (name: string, kind: string, extra: Partial<CompasPlace> = {}) =>
    ({ name, kind, lat: 0, lon: 0, landmark: false, settlement: false, ...extra }) as unknown as CompasPlace;
  it('« Sicilia » → « Sicile » (région), pas le quartier du Mexique', () => {
    const sicile = place('Sicile', 'state', { landmark: true });
    const quartier = place('Sicilia', 'district', { settlement: true });
    expect(plausibleLooseMatch(sicile, 'Sicilia')).toBe(true);
    expect(looseRank(sicile)).toBeLessThan(looseRank(quartier));
  });
  it('« Peru » → « Pérou » (pays), avant une ville des États-Unis', () => {
    const perou = place('Pérou', 'country');
    expect(plausibleLooseMatch(perou, 'Peru')).toBe(true);
    expect(looseRank(perou)).toBeLessThan(looseRank(place('Peru', 'city', { settlement: true })));
  });
  it('« Tokio » → « Tokyo »', () => {
    expect(plausibleLooseMatch(place('Tokyo', 'city', { settlement: true }), 'Tokio')).toBe(true);
  });
  it('un lieu-dit ne l’emporte jamais (Highlanders écossais)', () => {
    expect(plausibleLooseMatch(place('Highlanders écossais', 'house'), 'Highlands écossais')).toBe(false);
  });
});

describe('C-015 · un pays dit dans une autre langue est cherché sous son nom français', () => {
  it.each([
    ['Peru', 'Pérou'],
    ['Perú', 'Pérou'],
    ['Грузии', 'Géorgie'],
    ['日本', 'Japon'],
    ['Germany', 'Allemagne'],
    ['Deutschland', 'Allemagne'],
    ['Pérou', 'Pérou'],
  ])('« %s » → %s', (said, fr) => {
    expect(canonicalCountryName(said)).toBe(fr);
  });
  it('pas un pays, ou ambigu : rien', () => {
    expect(canonicalCountryName('Lima')).toBeNull();
    expect(canonicalCountryName('Georgia')).toBeNull();
    expect(canonicalCountryName('Vercors')).toBeNull();
  });
});

describe('C-015 · une région connue seulement en écriture locale (Svaneti)', () => {
  it('« სვანეთი » est la région « Svaneti » ; une rue en écriture locale ne l’est pas', () => {
    const place = (name: string, kind: string, extra: Record<string, unknown> = {}) => ({ name, kind, lat: 0, lon: 0, landmark: false, settlement: false, ...extra }) as unknown as CompasPlace;
    expect(plausibleLooseMatch(place('სვანეთი', 'other', { landmark: true }), 'Svaneti')).toBe(true);
    expect(plausibleLooseMatch(place('სვანეთი', 'street'), 'Svaneti')).toBe(false);
  });
});

describe('C-015 · régions et villes courantes dites dans une autre langue', () => {
  it.each([
    ['Südtirol', 'Haut-Adige'],
    ['Toskana', 'Toscane'],
    ['Tokio', 'Tokyo'],
    ['Alps', 'Alpes'],
    ['Sicilia', 'Sicile'],
    ['Peru', 'Pérou'],
  ])('« %s » → %s', (said, fr) => {
    expect(canonicalPlaceName(said)).toBe(fr);
  });
  it('un lieu inconnu : rien', () => {
    expect(canonicalPlaceName('Vercors')).toBeNull();
  });
});

describe('C-012 · le pays dit dans la phrase se joint au lieu', () => {
  const lieu = (say: string) => line(understandRequest(say, TODAY), 'lieu')?.value;
  it.each([
    ['trek 4 jours dans les Tatras en Pologne', 'Tatras, Pologne'],
    ['5 jours en Norvège, Lofoten, en juin', 'Lofoten, Norvège'],
    ['3 jours dans la Sierra Nevada en Espagne', 'Sierra Nevada, Espagne'],
  ])('« %s » → %s', (say, expected) => {
    expect(lieu(say)).toBe(expected);
  });
  it('un lieu seul, ou un pays, ne reçoit rien', () => {
    expect(lieu('3 jours en Corse')).toBe('Corse');
    expect(lieu('10 jours au Japon')).toBe('Japon');
  });
  it('« Tatras, Pologne » se coupe en lieu et pays', () => {
    expect(splitPlaceCountry('Tatras, Pologne')).toMatchObject({ place: 'Tatras', country: 'Pologne', code: 'PL' });
    expect(splitPlaceCountry('Paris, France')).toMatchObject({ place: 'Paris', code: 'FR' });
    expect(splitPlaceCountry('Tatras')).toBeNull();
    expect(splitPlaceCountry('Japon, Tokyo')).toBeNull();
  });
});

describe('C-015 · une phrase en chinois donne son lieu', () => {
  it('« 东京三天自由行 » → 东京, cherché sous « Tokyo »', () => {
    const r = understandRequest('东京三天自由行', TODAY);
    expect(line(r, 'lieu')).toMatchObject({ value: '东京', state: 'compris' });
    expect(canonicalPlaceName('东京')).toBe('Tokyo');
  });
});

describe('C-020 · une durée en russe', () => {
  it('« 5 дней в Грузии в сентябре » → 5 jours', () => {
    expect(line(understandRequest('5 дней в Грузии в сентябре', TODAY), 'quand')?.value).toMatch(/5 jours/);
  });
});

describe('O-04 · le départ dit est annoncé et lu (« départ de Lyon », « depuis Lyon »)', () => {
  const depart = (say: string) => line(understandRequest(say, TODAY), 'depart');
  it('« une randonnée à Chamonix depuis Lyon » annonce le départ Lyon et garde Chamonix', () => {
    const r = understandRequest('une randonnée à Chamonix depuis Lyon', TODAY);
    expect(line(r, 'depart')).toMatchObject({ value: 'Lyon', state: 'compris' });
    expect(line(r, 'lieu')?.value).toBe('Chamonix');
  });
  it('« départ de Lyon » est un départ, jamais une destination', () => {
    const r = understandRequest('départ de Lyon', TODAY);
    expect(line(r, 'depart')?.value).toBe('Lyon');
    expect(line(r, 'lieu')?.state).not.toBe('compris');
  });
  it('« départ du 5 mai » n’est pas un lieu de départ', () => {
    expect(depart('rando 3 jours dans le Vercors, départ du 5 mai')).toBeUndefined();
  });
});

describe('D-31 · le pied du panneau des calques reste atteignable', () => {
  it('« Carte nue » et « Tout afficher » sont collés au bas du panneau', () => {
    const css = readFileSync('src/features/compas/compas.css', 'utf8');
    const block = /^\.cp-mopts__f \{([^}]*)\}/m.exec(css)?.[1] ?? '';
    expect(block).toMatch(/position:\s*sticky/);
    expect(block).toMatch(/bottom:/);
  });
});

describe('D-32 · le canevas de la carte est une couche à part', () => {
  it('.cp-map__canvas a un z-index propre, sous le panneau des calques', () => {
    const css = readFileSync('src/features/compas/compas.css', 'utf8');
    const block = /^\.cp-map__canvas \{([^}]*)\}/m.exec(css)?.[1] ?? '';
    expect(block).toMatch(/z-index:\s*0/);
  });
});

describe('4.10 · dates numériques selon la langue', () => {
  const dates = (say: string, loc: 'fr' | 'en' | 'es' | 'de' | 'it') =>
    parseIntentRules(say, TODAY, loc).filter((a) => a.type === 'set_dates');
  it('jour/mois en français, espagnol, italien, allemand', () => {
    for (const [say, loc] of [['trek du 12/11 au 15/11', 'fr'], ['ruta del 12/11 al 15/11', 'es'], ['trekking dal 12/11 al 15/11', 'it'], ['Wanderung 12.11. bis 15.11.', 'de']] as const)
      expect(dates(say, loc)).toEqual([{ type: 'set_dates', start: '2026-11-12', end: '2026-11-15' }]);
  });
  it('mois/jour en anglais quand il n’y a qu’un sens, rien quand il y en a deux', () => {
    expect(dates('trek 11/25 to 11/28', 'en')).toEqual([{ type: 'set_dates', start: '2026-11-25', end: '2026-11-28' }]);
    expect(dates('hike 10/12', 'en')).toEqual([]);
  });
});

describe('C-019 · un mot en commun ne suffit pas pour une ville ou un lieu-dit', () => {
  const place = (name: string, kind: string, extra: Record<string, unknown> = {}) =>
    ({ name, kind, lat: 0, lon: 0, landmark: false, settlement: false, ...extra }) as unknown as CompasPlace;
  it('« Lakanal-Strasbourg » (un lycée) n’est pas « Strasbourg »', () => {
    expect(plausibleLooseMatch(place('Lakanal-Strasbourg', 'city', { settlement: true }), 'Strasbourg')).toBe(false);
    expect(plausibleLooseMatch(place('Strasbourg', 'city', { settlement: true }), 'Strasbourg')).toBe(true);
  });
});

describe('C-012 · régions célèbres mal rangées par la carte (Lofoten, Tatras)', () => {
  it('« Lofoten » est aux Lofoten, en Norvège', () => {
    expect(knownRegion('Lofoten', 'NO')).toMatchObject({ countryCode: 'NO', country: 'Norvège' });
    expect(knownRegion('Lofoten', null)?.lat).toBeGreaterThan(68);
  });
  it('« Tatras » : le pays dit choisit le côté ; sans pays, rien (deux pays)', () => {
    expect(knownRegion('Tatras', 'PL')).toMatchObject({ countryCode: 'PL', name: 'Tatras' });
    expect(knownRegion('Tatras', 'SK')?.countryCode).toBe('SK');
    expect(knownRegion('Tatras', null)).toBeNull();
  });
  it('un lieu inconnu : rien', () => {
    expect(knownRegion('Vercors', null)).toBeNull();
  });
});

describe('C-022 · lecture hors ligne de 115 formulations : défauts trouvés puis figés', () => {
  const lieu = (say: string) => line(understandRequest(say, '2026-10-21'), 'lieu');
  const quand = (say: string) => line(understandRequest(say, '2026-10-21'), 'quand')?.value ?? '';
  it('« ascension » (course en montagne) n’est pas le jeudi de l’Ascension', () => {
    expect(quand('mont blanc ascension 2 jours en août')).toMatch(/août/);
    expect(quand('week-end du pont de l’Ascension à Lyon')).not.toMatch(/août/);
  });
  it('« marchés de Noël » n’est pas le 25 décembre', () => {
    expect(quand('Strasbourg marchés de Noël 3 jours en décembre')).toMatch(/1 déc\./);
    expect(lieu('Strasbourg marchés de Noël 3 jours en décembre')?.value).toBe('Strasbourg');
  });
  it('un lieu tapé en minuscules, et deux villes reliées par « et »', () => {
    expect(lieu('paris 3 jours en famille')).toMatchObject({ value: 'Paris', state: 'compris' });
    expect(lieu('Rome et Florence 6 jours en avril')).toMatchObject({ value: 'Rome et Florence', state: 'compris' });
  });
  it('le code d’un sentier n’est pas dans le nom du lieu', () => {
    expect(lieu('randonnée Corse GR20 nord 7 jours')?.value).toBe('Corse');
  });
  it('« au soleil » n’est pas un lieu', () => {
    expect(lieu('2 semaines au soleil en octobre pas trop cher')?.state).toBe('a_trouver');
  });
  it('« mont blanc ascension » : le mot d’activité n’est pas le lieu', () => {
    expect(lieu('mont blanc ascension 2 jours en août')?.value).toBe('Mont Blanc');
  });
});

describe('C-023 · jeux def2 : régions que la carte range sur un homonyme', () => {
  it('« Highlands écossais » (et non la Rivière des Écossais du Québec) et « Himalaya indien Ladakh » (et non un hôtel)', () => {
    expect(knownRegion('Highlands écossais', null)).toMatchObject({ countryCode: 'GB', name: 'Highlands écossais' });
    expect(knownRegion('Himalaya indien Ladakh', null)).toMatchObject({ countryCode: 'IN', name: 'Ladakh' });
  });
});

describe('Audit Résa 13/11', () => {
  const TRIP = '11111111-1111-4111-8111-111111111111';
  const SLUG = 'vercors-novembre';
  const stay = (p: Partial<V5StayOption> & { id: string; name: string }): V5StayOption => ({
    kind: 'hebergement',
    lat: 45,
    lon: 5.4,
    distanceM: 300,
    elevationM: null,
    price: null,
    photo: null,
    source: 'OpenStreetMap',
    url: null,
    partner: null,
    ...p,
  });
  const gite = stay({ id: 'osm:1', name: 'Gîte du Royans', url: 'https://gites.example/royans' });
  const chambre = stay({ id: 'osm:4', name: 'Chambre Les Coulmes' });
  const refuge = stay({ id: 'osm:2', name: 'Refuge de la Molière', kind: 'refuge' });
  const camping = stay({ id: 'osm:3', name: 'Camping des Écouges', kind: 'camping' });
  const car: V5TransportOption = { id: 'car', label: 'Voiture', detail: null, amountEur: 64, perPerson: false, source: 'barème', url: null, partner: null };
  const train: V5TransportOption = { id: 'train', label: 'Train', detail: null, amountEur: 19, perPerson: true, source: 'SNCF', url: null, partner: null };
  const carpool: V5TransportOption = { id: 'carpool', label: 'Covoiturage', detail: null, amountEur: null, perPerson: false, source: 'aucun tarif', url: '/go/blablacar', partner: 'BlaBlaCar' };
  const foot: V5TransportOption = { id: 'foot', label: 'À pied', detail: null, amountEur: 0, perPerson: false, source: 'ton choix', url: null, partner: null };
  const extrasOf = (nights: V5Extras['nights'], transport: V5TransportOption[] = []): V5Extras => ({ ...EMPTY_EXTRAS, fetchedAt: '2026-10-22T10:00:00Z', nights, transport });
  const unnoted = () => makeData({ steps: makeInput().steps.map((s) => ({ ...s, accommodationName: null })) });
  const ctx: ReservationContext = { people: 4, origin: 'Lyon', destination: 'Vercors', start: '2026-11-03', end: '2026-11-05' };
  const plan = (data: ReturnType<typeof makeData>, extras: V5Extras, chosenTransport: V5TransportOption['id'] | null = null) => {
    const cards = nightCards(data.model, extras);
    return reservationSteps(cards, selectedTransport(transportViews(extras.transport, 4), chosenTransport), ctx);
  };

  describe('1 · les liens internes /go/<slug> sont ouvrables', () => {
    it('safeUrl accepte https et le relais d’affiliation du site, rien d’autre de relatif', () => {
      expect(safeUrl('https://a.example/x')).toBe('https://a.example/x');
      expect(safeUrl('/go/blablacar-fr')).toBe('/go/blablacar-fr');
      expect(safeUrl('/go/')).toBeNull();
      expect(safeUrl('/gone/x')).toBeNull();
      expect(safeUrl('//evil.example/go/x')).toBeNull();
      expect(safeUrl('/go/../admin')).toBeNull();
      expect(safeUrl('/compte')).toBeNull();
      expect(safeUrl('http://a.example')).toBeNull();
      expect(safeUrl('javascript:alert(1)')).toBeNull();
    });
  });

  describe('2 · « J’ai réservé » est écrit, par élément', () => {
    beforeEach(() => {
      resaDb.denied = false;
      resaDb.db = createFakeDb({
        trips: [{ id: TRIP, user_id: 'u1', updated_at: '2026-10-22T09:00:00.000Z', metadata: { route_id: 12, compas: { prefs: { pace: 'tranquille' }, transport: { id: 'car', amountEur: 64, perPerson: false, source: 'x' } } } }],
      });
    });
    const meta = () => resaDb.db.tables.trips[0].metadata as { route_id: number; compas: Record<string, unknown> & { resa?: Record<string, { status: string; at: string }> } };

    it('range le statut sous trips.metadata.compas.resa sans toucher au reste du JSON', async () => {
      const res = await compasV5SetResaStatusAction({ tripId: TRIP, tripSlug: SLUG, key: 'night:2', status: 'booked' });
      expect(res).toEqual({ success: true });
      expect(meta().route_id).toBe(12);
      expect(meta().compas.prefs).toEqual({ pace: 'tranquille' });
      expect(meta().compas.transport).toMatchObject({ id: 'car' });
      expect(meta().compas.resa?.['night:2']).toMatchObject({ status: 'booked' });
      expect(Number.isNaN(Date.parse(meta().compas.resa?.['night:2'].at ?? ''))).toBe(false);
    });

    it('plusieurs éléments d’un coup (nuits regroupées) et le trajet, chacun sous sa clé ; « à faire » les défait', async () => {
      await compasV5SetResaStatusAction({ tripId: TRIP, tripSlug: SLUG, keys: ['night:1', 'night:2'], status: 'booked' });
      await compasV5SetResaStatusAction({ tripId: TRIP, tripSlug: SLUG, key: 'transport', status: 'booked' });
      expect(Object.keys(meta().compas.resa ?? {}).sort()).toEqual(['night:1', 'night:2', 'transport']);
      await compasV5SetResaStatusAction({ tripId: TRIP, tripSlug: SLUG, key: 'night:1', status: 'todo' });
      expect(meta().compas.resa?.['night:1']).toMatchObject({ status: 'todo' });
      expect(meta().compas.resa?.['night:2']).toMatchObject({ status: 'booked' });
    });

    it('lignes du plan complet : `extra:<ligne>` réservé ou « pas besoin » (skipped), relus par parseResa', async () => {
      await compasV5SetResaStatusAction({ tripId: TRIP, tripSlug: SLUG, key: 'extra:insurance', status: 'booked' });
      await compasV5SetResaStatusAction({ tripId: TRIP, tripSlug: SLUG, keys: ['extra:rental-car', 'extra:lift-pass'], status: 'skipped' });
      const resa = parseResa(meta().compas.resa);
      expect(isResaBooked(resa, 'extra:insurance')).toBe(true);
      expect(resa['extra:rental-car']?.status).toBe('skipped');
      expect(resa['extra:lift-pass']?.status).toBe('skipped');
      expect(isResaSkipped(resa, 'extra:rental-car')).toBe(true);
      expect(isResaSkipped(resa, 'extra:insurance')).toBe(false);
      // « Pas besoin » n'est pas « réservé » ; le reste du JSON est intact.
      expect(isResaBooked(resa, 'extra:rental-car')).toBe(false);
      expect(meta().compas.prefs).toEqual({ pace: 'tranquille' });
      // Annuler « pas besoin » : retour à « à faire ».
      await compasV5SetResaStatusAction({ tripId: TRIP, tripSlug: SLUG, key: 'extra:rental-car', status: 'todo' });
      expect(meta().compas.resa?.['extra:rental-car']).toMatchObject({ status: 'todo' });
    });

    it('refuse une clé `extra:` mal formée (casse, espace, trop longue, injection) sans rien écrire', async () => {
      for (const key of ['extra:', 'extra:Insurance', 'extra:a b', 'extra:1abc', `extra:${'a'.repeat(41)}`, 'extra:__proto__', 'extra:a/b', 'extras:insurance'])
        expect((await compasV5SetResaStatusAction({ tripId: TRIP, tripSlug: SLUG, key, status: 'skipped' } as never)).success, key).toBe(false);
      expect(resaDb.db.log).toHaveLength(0);
    });

    it('rejouer le même statut n’écrit rien', async () => {
      await compasV5SetResaStatusAction({ tripId: TRIP, tripSlug: SLUG, key: 'night:1', status: 'booked' });
      const writes = resaDb.db.log.filter((l) => l.table === 'trips').length;
      expect(await compasV5SetResaStatusAction({ tripId: TRIP, tripSlug: SLUG, key: 'night:1', status: 'booked' })).toEqual({ success: true });
      expect(resaDb.db.log.filter((l) => l.table === 'trips')).toHaveLength(writes);
    });

    it('refuse une clé ou un statut inconnu, un lecteur, une écriture refusée', async () => {
      for (const key of ['night:0', 'night:61', 'night:x', 'transport:car', '__proto__', '']) {
        expect((await compasV5SetResaStatusAction({ tripId: TRIP, tripSlug: SLUG, key, status: 'booked' } as never)).success).toBe(false);
      }
      expect((await compasV5SetResaStatusAction({ tripId: TRIP, tripSlug: SLUG, key: 'night:1', status: 'paid' } as never)).success).toBe(false);
      expect(resaDb.db.log).toHaveLength(0);
      resaDb.denied = true;
      expect((await compasV5SetResaStatusAction({ tripId: TRIP, tripSlug: SLUG, key: 'night:1', status: 'booked' })).success).toBe(false);
      resaDb.denied = false;
      resaDb.db.failWrites.add('trips');
      expect((await compasV5SetResaStatusAction({ tripId: TRIP, tripSlug: SLUG, key: 'night:1', status: 'booked' })).success).toBe(false);
      expect(meta().compas.resa).toBeUndefined();
    });

    it('relu au rechargement : le statut vient de la base, pas d’une réservation quelconque du voyage', async () => {
      await compasV5SetResaStatusAction({ tripId: TRIP, tripSlug: SLUG, key: 'night:2', status: 'booked' });
      const resa = parseResa(meta().compas.resa);
      expect(isResaBooked(resa, 'night:2')).toBe(true);
      expect(isResaBooked(resa, 'night:1')).toBe(false);
      expect(isResaBooked(resa, 'transport')).toBe(false);
      // Valeurs illisibles : ignorées, jamais devinées.
      expect(parseResa({ 'night:1': { status: 'paid', at: 'x' }, 'night:99': { status: 'booked', at: 'x' }, transport: 'booked', 'night:3': { status: 'booked', at: '2026-11-01T10:00:00.000Z' } })).toEqual({
        'night:3': { status: 'booked', at: '2026-11-01T10:00:00.000Z' },
      });
      // Mise à jour optimiste côté client, puis retour arrière.
      expect(mergeResa({ 'night:2': 'booked' }, { 'night:1': 'booked', 'night:2': null })).toEqual({ 'night:1': 'booked' });
    });

    it('l’écran ne déduit plus « réservé » d’une réservation confirmée quelconque', () => {
      const screen = readFileSync(new URL('../v5/CompasV5Screen.tsx', import.meta.url), 'utf8');
      expect(screen).not.toContain('bookings.confirmed > 0');
      expect(screen).toContain('isResaBooked(resa, nightKey(d.day))');
      const drawer = readFileSync(new URL('../v5/drawers/prevoir.tsx', import.meta.url), 'utf8');
      expect(drawer).not.toContain('useState<ReadonlySet<string>>');
      expect(drawer).toContain('compasV5SetResaStatusAction');
    });
  });

  describe('3 · le plan de réservation liste tout, dans l’ordre', () => {
    it('sans aucun choix ni option : toutes les nuits, chacune avec un lien de recherche sur son lieu et ses dates', () => {
      const steps = plan(unnoted(), EMPTY_EXTRAS);
      expect(steps.map((s) => s.key)).toEqual(['night:1', 'night:2']);
      expect(steps.every((s) => s.proposed)).toBe(true);
      expect(steps[0].url).toBe('https://www.booking.com/searchresults.html?ss=Rencurel&checkin=2026-11-03&checkout=2026-11-04&group_adults=4');
      expect(steps[1].url).toBe('https://www.booking.com/searchresults.html?ss=Corren%C3%A7on-en-Vercors&checkin=2026-11-04&checkout=2026-11-05&group_adults=4');
    });

    it('le trajet d’approche d’abord, puis chaque nuit par jour ; la mieux classée est la sélection par défaut annoncée', () => {
      const steps = plan(unnoted(), extrasOf({ 1: [gite, chambre], 2: [refuge, camping] }, [car, train, carpool, foot]));
      expect(steps.map((s) => [s.key, s.kind, s.label, s.proposed])).toEqual([
        ['transport', 'transport', 'Voiture', true],
        ['night:1', 'night', 'Gîte du Royans', true],
        ['night:2', 'night', 'Refuge de la Molière', true],
      ]);
      // Le lien du lieu (site officiel) garde la priorité sur une recherche.
      expect(steps[1].url).toBe('https://gites.example/royans');
      expect(steps[1].direct).toBe(false);
      // Refuge sans site connu : recherche web ; voiture : itinéraire en voiture.
      expect(steps[2].url).toBe('https://duckduckgo.com/?q=Refuge%20de%20la%20Moli%C3%A8re%20Corren%C3%A7on-en-Vercors%20r%C3%A9servation');
      expect(steps[2].direct).toBe(true);
      expect(steps[0].url).toBe('https://www.google.com/maps/dir/?api=1&origin=Lyon&destination=Vercors&travelmode=driving');
    });

    it('un choix écrit n’est plus « proposé » ; le trajet choisi remplace celui par défaut', () => {
      const noted = makeData({ steps: makeInput().steps.map((s) => (s.dayNumber === 1 ? { ...s, accommodationName: 'Chambre Les Coulmes' } : s)) });
      const steps = plan(noted, extrasOf({ 1: [gite, chambre], 2: [refuge] }, [car, train]), 'train');
      expect(steps.map((s) => [s.key, s.label, s.proposed])).toEqual([
        ['transport', 'Train', false],
        ['night:1', 'Chambre Les Coulmes', false],
        ['night:2', 'Refuge de la Molière', true],
      ]);
      expect(steps[0].url).toBe('https://www.google.com/maps/dir/?api=1&origin=Lyon&destination=Vercors&travelmode=transit');
    });

    it('un lien affilié /go/… garde la priorité sur la recherche', () => {
      const steps = plan(unnoted(), extrasOf({}, [carpool]), 'carpool');
      expect(steps[0]).toMatchObject({ key: 'transport', url: '/go/blablacar', partner: 'BlaBlaCar', direct: false });
    });

    it('« à pied » ne se réserve pas : aucune ligne de trajet', () => {
      expect(plan(unnoted(), extrasOf({}, [car, foot]), 'foot').map((s) => s.key)).toEqual(['night:1', 'night:2']);
    });

    it('les nuits consécutives au même lieu forment une seule ligne : arrivée = première nuit, départ = dernière nuit + 1', () => {
      const steps = plan(unnoted(), extrasOf({ 1: [gite], 2: [gite] }));
      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({ key: 'night:1', keys: ['night:1', 'night:2'], nights: 2, checkIn: '2026-11-03', checkOut: '2026-11-05' });
      // Deux lieux différents : deux lignes.
      expect(plan(unnoted(), extrasOf({ 1: [gite], 2: [refuge] }))).toHaveLength(2);
    });

    it('un voyage d’un jour et sans trajet n’a rien à réserver', () => {
      const base = makeInput();
      expect(plan(makeData({ steps: [base.steps[0]] }), EMPTY_EXTRAS)).toEqual([]);
    });
  });
});

describe('Aperçu du 14/11', () => {
  // Scénario : « 5 jours de rando dans les Tatras en août à 2 depuis Paris », OpenStreetMap muet.
  // Base : 5 étapes « Jour N · Kościelisko », aucune distance, vol ORY → KRK au budget.
  const TATRAS = makeData(
    {
      trip: { ...makeInput().trip, destinationName: 'Tatras', startDate: '2026-08-10', endDate: '2026-08-14', partySize: 2 },
      steps: [1, 2, 3, 4, 5].map((n) => ({ ...makeInput().steps[0], id: `t${n}`, dayNumber: n, title: `Jour ${n} · Kościelisko`, locationName: 'Kościelisko', distanceKm: null, elevationGainM: null, elevationLossM: null, accommodationName: null })),
    },
    { countryCode: 'pl', originName: 'Paris', originSaid: { name: 'Paris', lat: 48.85, lon: 2.35, countryCode: 'FR' }, readerTravel: { nationality: 'FR', abroad: true, entry: null } }
  );
  const flightLine = (airports?: unknown) => ({ title: 'Vol aller-retour × 2', amount: 300, basis: 'barème · ORY → KRK', choice: null, ...(airports === undefined ? {} : { airports: parseAirports(airports) }) });
  const flightCtx: ReservationContext = { people: 2, origin: 'Paris', destination: 'Tatras', arrival: 'Kościelisko', start: '2026-08-10', end: '2026-08-14' };
  const flightUrl = (airports: unknown, ctx: ReservationContext = flightCtx) => {
    const views = transportViews(transportOptions({ lines: [flightLine(airports)], chosen: null, party: 2, originName: 'Paris', carFree: false, carpoolLink: null }), 2);
    const step = reservationSteps([], selectedTransport(views, 'flight'), ctx).find((x) => x.kind === 'transport');
    return decodeURIComponent(new URL(step?.url ?? 'about:blank').searchParams.get('q') ?? '');
  };

  describe('2 · le lien de vol utilise les aéroports connus', () => {
    it('avec les codes rangés sur la ligne de vol : « Flights from ORY to KRK on … through … »', () => {
      expect(flightUrl({ from: 'ORY', to: 'KRK' })).toBe('Flights from ORY to KRK on 2026-08-10 through 2026-08-14');
    });
    it('sans codes : ville de départ → localité d’arrivée (jamais le nom du massif)', () => {
      expect(flightUrl(undefined)).toBe('Flights from Paris to Kościelisko on 2026-08-10 through 2026-08-14');
      expect(flightUrl(undefined)).not.toContain('Tatras');
    });
    it('sans codes ni localité : le nom du voyage, à défaut', () => {
      expect(flightUrl(undefined, { ...flightCtx, arrival: null })).toBe('Flights from Paris to Tatras on 2026-08-10 through 2026-08-14');
    });
    it('les codes sont lus avec prudence : IATA à trois lettres, deux aéroports distincts, sinon rien', () => {
      expect(parseAirports({ from: ' ory ', to: 'krk' })).toEqual({ from: 'ORY', to: 'KRK' });
      for (const bad of [null, 'ORY', [], { from: 'ORY' }, { from: 'ORY', to: 'ORY' }, { from: 'ORYX', to: 'KRK' }, { from: 'O1Y', to: 'KRK' }, { from: 3, to: 'KRK' }])
        expect(parseAirports(bad)).toBeNull();
    });
    it('transportOptions porte les codes sur l’option « avion » seulement', () => {
      const options = transportOptions({ lines: [flightLine({ from: 'ORY', to: 'KRK' })], chosen: null, party: 2, originName: 'Paris', carFree: false, carpoolLink: null });
      expect(options.find((o) => o.id === 'flight')?.airports).toEqual({ from: 'ORY', to: 'KRK' });
      expect(options.filter((o) => o.id !== 'flight').every((o) => !o.airports)).toBe(true);
    });
    it('rangés à l’écriture : paire IATA depuis les aéroports retenus, jamais depuis le domicile', () => {
      const ory = { iata: 'ORY', name: 'Paris Orly', km: 12, country: 'FR', lat: 48.7, lon: 2.4 };
      const krk = { iata: 'KRK', name: 'Kraków John Paul II', km: 90, country: 'PL', lat: 50.07, lon: 19.78 };
      expect(flightAirports({ from: ory, to: krk }, { source: 'dit' })).toEqual({ from: 'ORY', to: 'KRK' });
      expect(flightAirports({ from: ory, to: krk }, { source: 'domicile' })).toBeNull();
      expect(flightAirports({ from: null, to: krk }, { source: 'dit' })).toBeNull();
      expect(flightAirports(null, { source: 'dit' })).toBeNull();
      const source = readFileSync(new URL('../server/autofillActions.ts', import.meta.url), 'utf8');
      expect(source).toContain('flightAirports(travelLeg.flight, origin)');
      expect(source).toContain('...(l.meta ?? {})');
    });
  });

  describe('3 · le transfert rejoint la localité de la première étape', () => {
    const input: ResaPlanInput = {
      activity: 'hiking',
      destinationCountry: 'PL',
      originCountry: 'FR',
      start: '2026-08-10',
      end: '2026-08-14',
      days: 5,
      party: 2,
      maxAltitudeM: null,
      approach: 'flight',
      nationality: 'FR',
      entry: null,
      namedTrail: null,
      base: 'Tatras',
      hub: 'Kraków John Paul II International Airport',
      nights: null,
    };
    const transfer = (over: Partial<ResaPlanInput>) => resaPlan({ ...input, ...over }).find((l) => l.key === 'transfer');

    it('titre et lien disent « Kościelisko », pas « Tatras »', () => {
      const l = transfer({ arrivalPlace: 'Kościelisko' });
      expect(l?.title).toBe('Rejoindre Kościelisko depuis Kraków John Paul II International Airport');
      expect(decodeURIComponent(l?.url ?? '')).toContain('destination=Kościelisko');
      expect(l?.url).not.toContain('Tatras');
    });
    it('sans localité connue : le nom du voyage, à défaut', () => {
      expect(transfer({ arrivalPlace: null })?.title).toBe('Rejoindre Tatras depuis Kraków John Paul II International Airport');
      expect(transfer({})?.url).toContain('destination=Tatras');
    });
    it('lue du titre de la première étape du voyage (Jour 1 · Kościelisko)', () => {
      expect(firstPlace(TATRAS.model)).toBe('Kościelisko');
      const lines = resaLinesFor({ data: TATRAS, extras: { ...EMPTY_EXTRAS, fetchedAt: '2026-11-14T10:00:00Z', hub: { iata: 'KRK', name: 'Kraków John Paul II International Airport' } }, transport: null, people: 2, t: FR_T, today: '2026-11-14' });
      // Sans trajet retenu ni dit, pas de transfert : on force « avion » par le trajet proposé.
      const views = transportViews(transportOptions({ lines: [flightLine()], chosen: null, party: 2, originName: 'Paris', carFree: false, carpoolLink: null }), 2);
      const withFlight = resaLinesFor({ data: TATRAS, extras: { ...EMPTY_EXTRAS, fetchedAt: '2026-11-14T10:00:00Z', hub: { iata: 'KRK', name: 'Kraków John Paul II International Airport' } }, transport: selectedTransport(views, 'flight'), people: 2, t: FR_T, today: '2026-11-14' });
      expect(lines.find((l) => l.key === 'transfer')).toBeUndefined();
      expect(withFlight.find((l) => l.key === 'transfer')?.title).toContain('Kościelisko');
      expect(withFlight.find((l) => l.key === 'transfer')?.title).not.toContain('Tatras');
    });
  });

  describe('6 · le lieu de l’étape remplace « non renseigné »', () => {
    it('« Jour 3 · Kościelisko » porte un lieu ; « Jour 3 » seul ou « A → B » se lisent proprement', () => {
      expect(stepPlace('Jour 3 · Kościelisko')).toBe('Kościelisko');
      expect(placeOfDay('Jour 3 · Kościelisko')).toBe('Kościelisko');
      expect(placeOfDay('Rencurel → Corrençon-en-Vercors')).toBe('Corrençon-en-Vercors');
      for (const bare of ['Jour 3', 'Day 3', 'Tag 3', 'Día 3', 'Giorno 3', '']) {
        expect(stepPlace(bare), bare).toBeNull();
        expect(placeOfDay(bare), bare).toBeNull();
      }
      expect(placeOfDay('Jour 2 · GR 20')).toBe('GR 20');
    });
  });
});

describe('Aperçu du 14/11 — journées vides', () => {
  // « 5 jours de rando dans les Tatras en août à 2 depuis Paris » : ancre {49.20806, 19.94739}, emprise [19.585, 49.284, 20.32, 49.132].
  const place = (id: string, name: string, lat: number, lon: number, kind: AreaPlace['kind'], eleM: number | null, population: number | null = null): AreaPlace => ({ id, name, lat, lon, kind, eleM, population, countryCode: 'PL' });
  const CENTER = { lat: 49.20806, lon: 19.94739 };
  const EXTENT: [number, number, number, number] = [19.585, 49.284, 20.32, 49.132];
  const zoneKm = planningZoneKm({ activity: 'hiking', days: 5, halfExtentKm: 28, settlement: false });
  // Les lieux où dormir que la carte rend pour ce massif : peu, éloignés (Poronin est hors de l'emprise).
  const VILLAGES = [
    place('n1', 'Kościelisko', 49.2806, 19.8206, 'village', 900, 7000),
    place('n2', 'Poronin', 49.3294, 20.0128, 'village', 740, 5000),
    place('n3', 'Murzasichle', 49.2606, 20.0333, 'village', 900, 1500),
    place('n4', 'Zakopane', 49.2992, 19.9496, 'town', 838, 27000),
  ];
  const HUTS = [
    place('h1', 'Hala Gąsienicowa', 49.2437, 20.0023, 'hut', 1500),
    place('h2', 'Morskie Oko', 49.2017, 20.0707, 'hut', 1405),
    place('h3', 'Dolina Pięciu Stawów Polskich', 49.2022, 20.0272, 'hut', 1670),
  ];
  const obj = (id: string, name: string, kind: DayObjective['kind'], lat: number, lon: number, eleM: number | null, notable = false): DayObjective => ({ id, name, kind, lat, lon, eleM, notable });
  const SUMMITS = [
    obj('n11', 'Giewont', 'peak', 49.2514, 19.9344, 1894, true),
    obj('n12', 'Kasprowy Wierch', 'peak', 49.2319, 19.9817, 1987, true),
    obj('n13', 'Nosal', 'peak', 49.2742, 19.9961, 1206),
    obj('n14', 'Czarny Staw Gąsienicowy', 'lake', 49.2339, 20.0049, 1624),
    obj('n15', 'Przełęcz Zawrat', 'pass', 49.2197, 20.0036, 2159),
  ];

  it('reproduit : l’itinéraire de lieu en lieu tient sur un seul lieu où dormir, cinq nuits identiques, mince', () => {
    const plan = planItinerary({ days: 5, activity: 'hiking', center: CENTER, radiusKm: zoneKm, places: VILLAGES.filter((p) => p.name !== 'Zakopane'), shape: null, natural: true, extent: EXTENT, nights: null });
    expect(plan?.shape).toBe('loop');
    expect(plan?.distinct).toBe(1);
    expect(new Set(plan?.stages.map((s) => s.name)).size).toBe(1);
    expect(thinItinerary(plan?.distinct ?? 0, 5, plan?.shape ?? null)).toBe(true);
    // Cause : une randonnée est itinérante pour le profil, mais absente des activités itinérantes du garde `tooFewDistinct`.
    const src = readFileSync(new URL('../server/autofillActions.ts', import.meta.url), 'utf8');
    expect(src).toContain("new Set(['roadtrip', 'vanlife', 'trekking', 'cycling'])");
  });

  it('la base du séjour est le bourg le plus important près du centre, jamais un refuge ni un camping', () => {
    const base = pickStayBase({ places: [...VILLAGES, ...HUTS], center: CENTER, radiusKm: zoneKm, extent: EXTENT });
    expect(base?.name).toBe('Zakopane');
    expect(pickStayBase({ places: HUTS, center: CENTER, radiusKm: zoneKm, extent: EXTENT })).toBeNull();
    expect(pickStayBase({ places: VILLAGES, center: CENTER, radiusKm: zoneKm, startAt: { name: 'Zakopane', lat: 49.2969, lon: 19.95 } })?.name).toBe('Zakopane');
  });

  it('cinq jours = cinq objectifs réels, distincts, avec une distance aller-retour estimée', () => {
    const base = pickStayBase({ places: VILLAGES, center: CENTER, radiusKm: zoneKm, extent: EXTENT });
    if (!base) throw new Error('base attendue');
    const picks = pickDayObjectives({ base, objectives: mergeObjectives([SUMMITS, objectivesFromHuts(HUTS)]), days: 5, activity: 'hiking' });
    expect(picks).toHaveLength(5);
    expect(new Set(picks.map((p) => p.name)).size).toBe(5);
    const known = new Set([...SUMMITS, ...objectivesFromHuts(HUTS)].map((o) => o.name));
    for (const p of picks) {
      expect(known.has(p.name)).toBe(true);
      expect(p.crowKm).toBeGreaterThanOrEqual(1.5);
      expect(p.roundTripKm).toBeCloseTo(p.crowKm * 2 * 1.4, 0);
    }
    // Du plus court au plus long.
    expect(picks.map((p) => p.crowKm)).toEqual([...picks.map((p) => p.crowKm)].sort((a, b) => a - b));
  });

  it('dénivelé minimal : la différence d’altitude, seulement quand les deux altitudes sont connues', () => {
    const base = { lat: 49.2992, lon: 19.9496, eleM: 838 };
    const [giewont] = pickDayObjectives({ base, objectives: [obj('n11', 'Giewont', 'peak', 49.2514, 19.9344, 1894, true)], days: 1, activity: 'hiking' });
    expect(giewont.ascentM).toBe(1060);
    const [noEle] = pickDayObjectives({ base: { ...base, eleM: null }, objectives: [obj('n11', 'Giewont', 'peak', 49.2514, 19.9344, 1894, true)], days: 1, activity: 'hiking' });
    expect(noEle.ascentM).toBeNull();
  });

  it('jamais d’objectif inventé : sans lieu nommé dans la fenêtre, aucune journée n’est remplie', () => {
    const base = { lat: 49.2992, lon: 19.9496, eleM: 838 };
    expect(pickDayObjectives({ base, objectives: [], days: 5, activity: 'hiking' })).toEqual([]);
    // Trop loin pour une journée (Morskie Oko est à plus de 11 km de Zakopane) ou sur la base elle-même.
    expect(pickDayObjectives({ base, objectives: [obj('x', 'Morskie Oko', 'lake', 49.2017, 20.0707, 1395), obj('y', 'Zakopane', 'viewpoint', 49.2993, 19.9497, null)], days: 5, activity: 'hiking' })).toEqual([]);
  });

  it('étiquette : fourni = complet ; carte muette = incomplet faute de source ; carte répondue sans objectif = base seule (jamais « zone pauvre »)', () => {
    expect(baseStayState(5, 5, true)).toBe('complete');
    expect(baseStayState(3, 5, false)).toBe('complete');
    expect(baseStayState(1, 5, false)).toBe('source_silent');
    expect(baseStayState(0, 5, false)).toBe('source_silent');
    expect(baseStayState(1, 5, true)).toBe('base_only');
    expect(baseStayState(0, 5, true)).toBe('base_only');
    expect(baseStayState(0, 1, true)).toBe('base_only');
  });

  it('la requête Overpass : une seule, nommée, plafonnée par nature, autour de la base', () => {
    const q = buildObjectivesQuery({ lat: 49.2992, lon: 19.9496 });
    expect(q).toContain('around:11000,49.29920,19.94960');
    expect(q.match(/out center tags/g)?.length).toBe(7);
    expect(q.match(/\["name"\]/g)?.length).toBe(7);
    const parsed = parseObjectives({
      elements: [
        { type: 'node', id: 1, lat: 49.25, lon: 19.93, tags: { natural: 'peak', name: 'Giewont', ele: '1894', wikidata: 'Q1' } },
        { type: 'node', id: 2, lat: 49.25, lon: 19.93, tags: { natural: 'peak' } },
        { type: 'way', id: 3, center: { lat: 49.2339, lon: 20.0049 }, tags: { natural: 'water', water: 'lake', name: 'Czarny Staw Gąsienicowy' } },
        { type: 'node', id: 4, lat: 49.3, lon: 19.9, tags: { amenity: 'cafe', name: 'Café' } },
      ],
    });
    expect(parsed.map((o) => [o.name, o.kind, o.eleM, o.notable])).toEqual([['Giewont', 'peak', 1894, true], ['Czarny Staw Gąsienicowy', 'lake', null, false]]);
    // Réponse coupée (remarque sans résultat) : rien n'est lu.
    expect(parseObjectives({ elements: [], remark: 'runtime error: timeout' })).toEqual([]);
  });

  it('l’écran : « base seule » a son texte, distinct de « presque aucun lieu » (cinq langues)', () => {
    const src = readFileSync(new URL('../components/useCompasController.ts', import.meta.url), 'utf8');
    expect(src).toContain("res.summary.itinerary === 'base_only'");
    expect(src).toContain("baseOnly ? 'compas.screen.prepPartialBase'");
    for (const l of ['fr', 'en', 'de', 'es', 'it']) {
      const dict = readFileSync(new URL(`../../../lib/i18n/translations/compas-screen.${l}.ts`, import.meta.url), 'utf8');
      expect(dict, l).toContain('prepPartialBase:');
    }
  });

  it('l’état « base seule » est relu depuis les métadonnées ; une valeur inconnue n’est jamais crue', () => {
    expect(readItinerary({ state: 'base_only', places: 1, objectives: 2, sources: ['Objectifs : Overpass 2'] })).toEqual({ state: 'base_only', places: 1, objectives: 2, sources: ['Objectifs : Overpass 2'] });
    expect(readItinerary({ state: 'base', places: 1 })).toBeUndefined();
  });
});
