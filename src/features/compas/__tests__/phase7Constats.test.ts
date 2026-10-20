import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { understandRequest } from '../engine/request';
import { plausibleLooseMatch, resemblesQuery, subPlaceQueries, type CompasPlace } from '../engine/places';

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
