import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { knownRegion } from '../engine/knownRegions';
import { parseIntentRules } from '../engine/intent';
import { understandRequest } from '../engine/request';
import { canonicalCountryName, canonicalPlaceName, splitPlaceCountry } from '../engine/countryNames';
import { looseRank, parseGeoapify, plausibleLooseMatch, resemblesQuery, subPlaceQueries, type CompasPlace } from '../engine/places';

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
