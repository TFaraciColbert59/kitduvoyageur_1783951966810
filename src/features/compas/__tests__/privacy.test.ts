import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { coarsePosition, positionBase, type BasePlace } from '../engine/privacy';
import { pickCommune, type CompasPlace } from '../engine/places';

describe('position de la personne arrondie (plan 2.10)', () => {
  it('0,01° près, jamais la position exacte', () => {
    expect(coarsePosition({ lat: 45.923712, lon: 6.869349 })).toEqual({ lat: 45.92, lon: 6.87 });
    expect(coarsePosition({ lat: -33.868819, lon: 151.209295 })).toEqual({ lat: -33.87, lon: 151.21 });
  });

  it('pas de position, ou une position illisible : rien', () => {
    expect(coarsePosition(null)).toBeNull();
    expect(coarsePosition({ lat: Number.NaN, lon: 2 })).toBeNull();
  });
});

const place = (over: Partial<CompasPlace> & Pick<CompasPlace, 'name' | 'lat' | 'lon'>): CompasPlace => ({
  countryCode: 'FR',
  country: 'France',
  kind: 'village',
  settlement: true,
  extent: null,
  ...over,
});

describe('la commune d’un point (plan 2.10)', () => {
  const at = { lat: 45.92, lon: 6.87 };
  it('le lieu habité du même nom, le plus proche, à 25 km au plus', () => {
    const list = [
      place({ name: 'Chamonix', lat: 45.9237, lon: 6.8694 }),
      place({ name: 'Chamonix', lat: 48.5, lon: 2.0 }),
      place({ name: 'Chamonix-Mont-Blanc', lat: 45.9, lon: 6.9 }),
    ];
    expect(pickCommune(list, 'Chamonix', 'FR', at)?.lat).toBe(45.9237);
  });
  it('ni un lieu non habité, ni un autre pays, ni un homonyme lointain : null', () => {
    expect(pickCommune([place({ name: 'Chamonix', lat: 45.92, lon: 6.87, settlement: false })], 'Chamonix', 'FR', at)).toBeNull();
    expect(pickCommune([place({ name: 'Chamonix', lat: 45.92, lon: 6.87, countryCode: 'CH' })], 'Chamonix', 'FR', at)).toBeNull();
    expect(pickCommune([place({ name: 'Chamonix', lat: 46.5, lon: 6.87 })], 'Chamonix', 'FR', at)).toBeNull();
    expect(pickCommune([], 'Chamonix', 'FR', at)).toBeNull();
  });
  it('le nom s’écrit comme la carte l’écrit (casse, article)', () => {
    expect(pickCommune([place({ name: 'Les Houches', lat: 45.89, lon: 6.8 })], 'les houches', 'FR', { lat: 45.9, lon: 6.8 })).not.toBeNull();
  });
});

describe('la base d’un séjour sans lieu dit : la commune, pas le point GPS (plan 2.10)', () => {
  const at = { lat: 45.923712, lon: 6.869349 };
  const building: BasePlace = {
    name: 'Chantier Hôtel de Ville',
    lat: 45.92371,
    lon: 6.86936,
    countryCode: 'FR',
    country: 'France',
    locality: 'Chamonix-Mont-Blanc',
    settlement: false,
  };
  const commune: BasePlace = { name: 'Chamonix-Mont-Blanc', lat: 45.9237, lon: 6.8694, countryCode: 'FR', country: 'France', settlement: true };

  it('commune retrouvée : son nom et son centre, ni le bâtiment ni le point', () => {
    const base = positionBase(at, building, commune);
    expect(base).toMatchObject({ name: 'Chamonix-Mont-Blanc', lat: 45.9237, lon: 6.8694, countryCode: 'FR', basis: 'commune' });
    expect(base?.name).not.toContain('Chantier');
  });

  it('la carte répond par la commune elle-même : son centre', () => {
    const village = { ...commune, locality: 'Chamonix-Mont-Blanc' };
    expect(positionBase(at, village, null)).toMatchObject({ name: 'Chamonix-Mont-Blanc', lat: 45.9237, basis: 'commune' });
  });

  it('un quartier n’est pas la commune : sans commune retrouvée, le point arrondi à ~1 km, nommé par la localité', () => {
    const suburb = { ...building, name: 'Les Praz', settlement: true };
    const base = positionBase(at, suburb, null);
    expect(base).toMatchObject({ name: 'Chamonix-Mont-Blanc', lat: 45.92, lon: 6.87, basis: 'approximatif' });
  });

  it('rien sur la carte : « Autour de toi » au point arrondi, jamais plus fin que 0,01°', () => {
    const base = positionBase(at, null, null);
    expect(base).toMatchObject({ name: 'Autour de toi', lat: 45.92, lon: 6.87, countryCode: null, basis: 'approximatif' });
    for (const v of [base?.lat, base?.lon]) expect(Math.round((v as number) * 100) / 100).toBe(v);
  });

  it('position illisible : rien', () => {
    expect(positionBase({ lat: Number.NaN, lon: 2 }, null, null)).toBeNull();
  });
});

describe('garde : la position du navigateur ne sort du Compas qu’arrondie (plan 2.10)', () => {
  const dir = path.join(process.cwd(), 'src', 'features', 'compas');
  const files = (readdirSync(dir, { recursive: true }) as string[])
    .map((f) => f.replace(/\\/g, '/'))
    .filter((f) => /\.tsx?$/.test(f) && !f.startsWith('__tests__/'))
    .map((f) => path.join(dir, f));

  it('chaque lecture de coords.latitude est enveloppée par coarsePosition(...)', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/coords\.latitude/g)) {
        const before = text.slice(Math.max(0, (m.index ?? 0) - 40), m.index);
        if (!/coarsePosition\(\s*\{\s*lat:\s*\w+\.$/.test(before)) offenders.push(`${path.relative(process.cwd(), file)}`);
      }
    }
    expect(offenders).toEqual([]);
    expect(files.some((f) => readFileSync(f, 'utf8').includes('coords.latitude'))).toBe(true);
  });

  it('la base d’un séjour sans lieu dit passe par positionBase (la commune), pas par le point', () => {
    const autofill = readFileSync(path.join(dir, 'server', 'autofillActions.ts'), 'utf8');
    expect(autofill).toMatch(/positionBase\(from,\s*here,\s*commune\)/);
    expect(autofill).not.toMatch(/lat:\s*from\.lat,\s*\n\s*lon:\s*from\.lon,\s*\n\s*countryCode:\s*here/);
  });
});
