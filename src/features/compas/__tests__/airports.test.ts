import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { nearestAirportIn, type AirportRow } from '../engine/airports';
import { nearestAirport } from '../server/airports';
import AIRPORTS from '../data/airports.json';
import META from '../data/airports.meta.json';
import { buildAirports, parseCsvLine } from '../../../../scripts/compas/build-airports.mjs';

/** Lignes réelles d'OurAirports, telles que dans le fichier versionné (un test le vérifie). */
const ROWS: AirportRow[] = [
  ['AHO', 'Alghero-Fertilia Airport', 40.632, 8.291, 'IT', 'M'],
  ['CAG', 'Cagliari Elmas Airport', 39.251, 9.054, 'IT', 'L'],
  ['CMF', 'Chambéry Aix les Bains airport', 45.638, 5.88, 'FR', 'M'],
  ['GVA', 'Geneva International Airport', 46.238, 6.109, 'CH', 'L'],
  ['LYS', 'Lyon Saint-Exupéry Airport', 45.726, 5.09, 'FR', 'L'],
  ['OLB', 'Olbia Costa Smeralda Airport', 40.899, 9.518, 'IT', 'L'],
];

/** Autres lignes réelles, pour les frontières : Corse, Suisse, Italie du nord. */
const BORDER_EXTRA: AirportRow[] = [
  ['BRN', 'Bern Airport', 46.913, 7.499, 'CH', 'M'],
  ['FSC', 'Figari Sud-Corse Airport', 41.502, 9.097, 'FR', 'L'],
  ['LUG', 'Lugano Airport', 46.004, 8.911, 'CH', 'M'],
  ['MXP', 'Milan Malpensa International Airport', 45.631, 8.728, 'IT', 'L'],
  ['TRN', 'Turin Airport', 45.201, 7.65, 'IT', 'L'],
  ['ZRH', 'Zürich Airport', 47.458, 8.548, 'CH', 'L'],
];
/** Les six lignes plus celles-ci, triées par code comme le fichier. */
const BORDER_ROWS: AirportRow[] = [...ROWS, ...BORDER_EXTRA].sort((a, b) => (a[0] < b[0] ? -1 : 1));

/** Fidji, de part et d'autre de l'antiméridien (180°). */
const FIJI: AirportRow[] = [
  ['LBS', 'Labasa Airport', -16.467, 179.34, 'FJ', 'M'],
  ['NAN', 'Nadi International Airport', -17.762, 177.438, 'FJ', 'L'],
  ['SUV', 'Nausori International Airport', -18.044, 178.561, 'FJ', 'L'],
];

describe('aéroport d’un lieu (choix pur)', () => {
  it('Lyon : Saint-Exupéry, 20 km', () => {
    expect(nearestAirportIn(ROWS, 45.76, 4.84)).toEqual({
      iata: 'LYS',
      name: 'Lyon Saint-Exupéry Airport',
      km: 20,
      country: 'FR',
      lat: 45.726,
      lon: 5.09,
    });
  });

  it('un aéroport moyen tout près gagne (Chambéry), un grand un peu plus loin aussi (Annecy → Genève, avec ces six lignes)', () => {
    expect(nearestAirportIn(ROWS, 45.57, 5.92)?.iata).toBe('CMF');
    // Annecy, avec ces seules lignes (le fichier complet y a son propre aéroport, NCY) :
    // Chambéry à 35 km (moyen, compte 56), Genève à 38 km (grand) → Genève.
    expect(nearestAirportIn(ROWS, 45.9, 6.13)).toMatchObject({ iata: 'GVA', km: 38 });
  });

  it('Sardaigne : Cagliari depuis le centre de l’île, Olbia depuis Nuoro, Alghero sur place', () => {
    expect(nearestAirportIn(ROWS, 40.08, 9.03)).toMatchObject({ iata: 'CAG', km: 92 });
    expect(nearestAirportIn(ROWS, 40.32, 9.33)).toMatchObject({ iata: 'OLB', km: 66 });
    expect(nearestAirportIn(ROWS, 40.56, 8.32)?.iata).toBe('AHO');
  });

  it('rien à moins de 300 km (ou du rayon demandé) : null', () => {
    expect(nearestAirportIn(ROWS, 40, -40)).toBeNull();
    expect(nearestAirportIn(ROWS, 45.76, 4.84, { maxKm: 10 })).toBeNull();
    expect(nearestAirportIn(ROWS, Number.NaN, 4.84)).toBeNull();
    expect(nearestAirportIn([], 45.76, 4.84)).toBeNull();
  });

  it('rayon : un maxKm qui n’est pas un nombre fini vaut le rayon par défaut, zéro ou négatif ne trouve rien', () => {
    for (const maxKm of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      // Le rayon ne saute pas en silence : plein Atlantique, toujours rien.
      expect(nearestAirportIn(ROWS, 40, -40, { maxKm })).toBeNull();
      expect(nearestAirportIn(ROWS, 45.76, 4.84, { maxKm })?.iata).toBe('LYS');
    }
    expect(nearestAirportIn(ROWS, 45.76, 4.84, { maxKm: 0 })).toBeNull();
    // Même posé exactement sur l'aéroport (0 km), un rayon nul ne trouve rien.
    expect(nearestAirportIn(ROWS, 45.726, 5.09, { maxKm: 0 })).toBeNull();
    expect(nearestAirportIn(ROWS, 45.76, 4.84, { maxKm: -5 })).toBeNull();
  });

  it('égalité de score : la première ligne gagne (le fichier est trié par code)', () => {
    // Lignes fictives, seulement pour fabriquer l'égalité exacte.
    const a: AirportRow = ['AAA', 'Premier', 10, 10, 'XX', 'L'];
    const b: AirportRow = ['BBB', 'Second', 10, 10, 'XX', 'L'];
    expect(nearestAirportIn([a, b], 10.2, 10.1)?.iata).toBe('AAA');
    expect(nearestAirportIn([b, a], 10.2, 10.1)?.iata).toBe('BBB');
    expect(nearestAirportIn([a, b], 10.2, 10.1, { country: 'XX' })?.iata).toBe('AAA');
  });

  it('de part et d’autre de l’antiméridien (Taveuni, Fidji) : Labasa, la distance passe par 180°', () => {
    expect(nearestAirportIn(FIJI, -16.85, 179.95)).toMatchObject({ iata: 'LBS', km: 78 });
    expect(nearestAirportIn(FIJI, -16.85, -179.95)).toMatchObject({ iata: 'LBS', km: 87 });
  });
});

describe('indice de pays (frontières, mers)', () => {
  const SANTA_TERESA = { lat: 41.239, lon: 9.19 };
  const ZERMATT = { lat: 46.02, lon: 7.749 };
  const GOLFE_DE_CAGLIARI = { lat: 38.7, lon: 9.2 };

  it('Santa Teresa Gallura : sans indice Figari (Corse, 30 km), avec « IT » Olbia (47 km)', () => {
    expect(nearestAirportIn(BORDER_ROWS, SANTA_TERESA.lat, SANTA_TERESA.lon)).toMatchObject({ iata: 'FSC', country: 'FR', km: 30 });
    expect(nearestAirportIn(BORDER_ROWS, SANTA_TERESA.lat, SANTA_TERESA.lon, { country: 'IT' })).toMatchObject({
      iata: 'OLB',
      country: 'IT',
      km: 47,
    });
  });

  it('Zermatt : sans indice Malpensa (Italie, 87 km), avec « CH » Genève (grand) plutôt que Lugano (moyen, plus près)', () => {
    expect(nearestAirportIn(BORDER_ROWS, ZERMATT.lat, ZERMATT.lon)).toMatchObject({ iata: 'MXP', country: 'IT', km: 87 });
    // Lugano est à 90 km mais moyen (compte 144) ; Genève à 129 km, grand.
    expect(nearestAirportIn(BORDER_ROWS, ZERMATT.lat, ZERMATT.lon, { country: 'CH' })).toMatchObject({
      iata: 'GVA',
      country: 'CH',
      km: 129,
    });
  });

  it('minuscules acceptées ; null, vide ou espaces : pas d’indice', () => {
    expect(nearestAirportIn(BORDER_ROWS, SANTA_TERESA.lat, SANTA_TERESA.lon, { country: 'it' })?.iata).toBe('OLB');
    expect(nearestAirportIn(BORDER_ROWS, SANTA_TERESA.lat, SANTA_TERESA.lon, { country: ' It ' })?.iata).toBe('OLB');
    for (const country of [null, undefined, '', '  ']) {
      expect(nearestAirportIn(BORDER_ROWS, SANTA_TERESA.lat, SANTA_TERESA.lon, { country })?.iata).toBe('FSC');
    }
  });

  it('aucun aéroport du pays dans le rayon : on revient au comportement sans indice', () => {
    // Golfe de Cagliari : Figari est à 312 km, hors des 300 km → Cagliari malgré « FR ».
    const sans = nearestAirportIn(BORDER_ROWS, GOLFE_DE_CAGLIARI.lat, GOLFE_DE_CAGLIARI.lon);
    expect(sans).toMatchObject({ iata: 'CAG', km: 63 });
    expect(nearestAirportIn(BORDER_ROWS, GOLFE_DE_CAGLIARI.lat, GOLFE_DE_CAGLIARI.lon, { country: 'FR' })).toEqual(sans);
    // Un pays sans aucune ligne : pareil. Et rien du tout reste null.
    expect(nearestAirportIn(BORDER_ROWS, SANTA_TERESA.lat, SANTA_TERESA.lon, { country: 'JP' })?.iata).toBe('FSC');
    expect(nearestAirportIn(BORDER_ROWS, 40, -40, { country: 'FR' })).toBeNull();
  });

  it('l’indice suit le rayon demandé : à 350 km Figari redevient « du pays » ; à 40 km ou 60 km on retrouve le bon choix', () => {
    expect(nearestAirportIn(BORDER_ROWS, GOLFE_DE_CAGLIARI.lat, GOLFE_DE_CAGLIARI.lon, { country: 'FR', maxKm: 350 })).toMatchObject({
      iata: 'FSC',
      km: 312,
    });
    // Rayon de 40 km : aucun aéroport italien à portée de Santa Teresa → l'indice est ignoré, Figari ; à 60 km Olbia est à portée.
    expect(nearestAirportIn(BORDER_ROWS, SANTA_TERESA.lat, SANTA_TERESA.lon, { country: 'IT', maxKm: 40 })?.iata).toBe('FSC');
    expect(nearestAirportIn(BORDER_ROWS, SANTA_TERESA.lat, SANTA_TERESA.lon, { country: 'IT', maxKm: 60 })?.iata).toBe('OLB');
  });
});

describe('fichier généré (OurAirports)', () => {
  const rows = AIRPORTS as unknown as unknown[];

  it('les lignes de test sont celles du fichier, au chiffre près', () => {
    const byCode = new Map(rows.map((r) => [(r as AirportRow)[0], r]));
    for (const fixture of [...ROWS, ...BORDER_EXTRA, ...FIJI]) expect(byCode.get(fixture[0])).toEqual(fixture);
  });

  it('un code IATA ne revient jamais', () => {
    const codes = rows.map((r) => (r as AirportRow)[0]);
    const doubles = codes.filter((c, i) => codes.indexOf(c) !== i);
    expect(doubles).toEqual([]);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('une ligne [iata, nom, lat, lon, pays, L|M] par aéroport, triée par code', () => {
    expect(rows.length).toBe(META.count);
    expect(rows.length).toBeGreaterThan(3000);
    for (const r of rows) {
      expect(Array.isArray(r) && r.length === 6).toBe(true);
      const [iata, name, lat, lon, country, size] = r as unknown[];
      expect(iata).toMatch(/^[A-Z0-9]{3}$/);
      expect(typeof name === 'string' && name.length > 0).toBe(true);
      expect(typeof lat === 'number' && Math.abs(lat) <= 90).toBe(true);
      expect(typeof lon === 'number' && Math.abs(lon) <= 180).toBe(true);
      expect(country).toMatch(/^[A-Z0-9]{2}$/);
      expect(size === 'L' || size === 'M').toBe(true);
    }
    const codes = rows.map((r) => (r as AirportRow)[0]);
    expect([...codes].sort()).toEqual(codes);
  });

  it('contient Lyon, Paris-Charles de Gaulle et Olbia', () => {
    const byCode = new Map(rows.map((r) => [(r as AirportRow)[0], r as AirportRow]));
    expect(byCode.get('LYS')).toEqual(['LYS', expect.stringMatching(/Lyon/), expect.closeTo(45.726, 1), expect.closeTo(5.09, 1), 'FR', 'L']);
    expect(byCode.get('CDG')).toEqual(['CDG', expect.stringMatching(/Charles de Gaulle/), expect.closeTo(49.009, 1), expect.closeTo(2.554, 1), 'FR', 'L']);
    expect(byCode.get('OLB')).toEqual(['OLB', expect.stringMatching(/Olbia/), expect.closeTo(40.899, 1), expect.closeTo(9.518, 1), 'IT', expect.stringMatching(/^[LM]$/)]);
  });

  it('source, licence et date dites', () => {
    expect(META).toEqual({
      source: 'OurAirports',
      url: 'https://davidmegginson.github.io/ourairports-data/airports.csv',
      licence: 'Public Domain',
      fetched: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      count: rows.length,
    });
  });
});

describe('script de génération', () => {
  it('garde les aéroports desservis, grands ou moyens, avec un code IATA ; lit les guillemets', () => {
    const csv = [
      '"id","ident","type","name","latitude_deg","longitude_deg","elevation_ft","continent","iso_country","iso_region","municipality","scheduled_service","icao_code","iata_code","gps_code","local_code","home_link","wikipedia_link","keywords"',
      '4137,"LFLL","large_airport","Lyon Saint-Exupéry Airport",45.725996,5.090139,821,"EU","FR","FR-ARA","Colombier-Saugnieu, Rhône","yes","LFLL","LYS","LFLL",,,,',
      '4131,"LFLB","medium_airport","Chambéry ""Aix"" les Bains airport",45.6381,5.88023,779,"EU","FR","FR-ARA","Chambéry","yes","LFLB","CMF","LFLB",,,,',
      '1,"XSML","small_airport","Petit terrain",45,5,0,"EU","FR","FR-ARA","Nulle part","yes",,"XSM",,,,,',
      '2,"XNOS","large_airport","Sans vols réguliers",46,6,0,"EU","FR","FR-ARA","Ailleurs","no",,"XNO",,,,,',
      '3,"XNOI","medium_airport","Sans code IATA",47,7,0,"EU","FR","FR-ARA","Là","yes",,,,,,,',
    ].join('\n');
    expect(buildAirports(csv)).toEqual([
      ['CMF', 'Chambéry "Aix" les Bains airport', 45.638, 5.88, 'FR', 'M'],
      ['LYS', 'Lyon Saint-Exupéry Airport', 45.726, 5.09, 'FR', 'L'],
    ]);
  });

  it('lit un fichier Windows : BOM UTF-8, fins de ligne CRLF, saut de ligne dans un champ entre guillemets', () => {
    const header =
      '﻿"id","ident","type","name","latitude_deg","longitude_deg","elevation_ft","continent","iso_country","iso_region","municipality","scheduled_service","icao_code","iata_code","gps_code","local_code","home_link","wikipedia_link","keywords"';
    const csv = [
      header,
      // Le champ « municipality » (avant « scheduled_service » et « iata_code ») contient un saut de ligne.
      '4137,"LFLL","large_airport","Lyon Saint-Exupéry Airport",45.725996,5.090139,821,"EU","FR","FR-ARA","Colombier-Saugnieu,\nRhône","yes","LFLL","LYS","LFLL",,,,',
      '4131,"LFLB","medium_airport","Chambéry Aix les Bains airport",45.6381,5.88023,779,"EU","FR","FR-ARA","Voglans,\r\nSavoie","yes","LFLB","CMF","LFLB",,,"un mot,\ndeux mots"',
      '',
    ].join('\r\n');
    expect(buildAirports(csv)).toEqual([
      ['CMF', 'Chambéry Aix les Bains airport', 45.638, 5.88, 'FR', 'M'],
      ['LYS', 'Lyon Saint-Exupéry Airport', 45.726, 5.09, 'FR', 'L'],
    ]);
  });

  it('un fichier vide ou sans en-tête dit clairement ce qui ne va pas', () => {
    for (const csv of ['', '\n\r\n', '﻿']) {
      expect(() => buildAirports(csv)).toThrow('CSV OurAirports vide ou sans en-tête');
    }
    expect(() => buildAirports('"id","name"\n1,"x"')).toThrow('Colonne absente du CSV : type');
  });

  it('parseCsvLine : guillemets doublés, virgule dans un champ, champs vides', () => {
    expect(parseCsvLine('1,"a, ""b""",,"c"')).toEqual(['1', 'a, "b"', '', 'c']);
  });
});

describe('recherche côté serveur', () => {
  it('Lyon → LYS ; Sardaigne → Cagliari ou Olbia ; plein Atlantique → aucun', () => {
    expect(nearestAirport(45.76, 4.84)?.iata).toBe('LYS');
    expect(['CAG', 'OLB']).toContain(nearestAirport(40.08, 9.03)?.iata);
    expect(nearestAirport(40, -40)).toBeNull();
  });

  it('indice de pays sur le vrai fichier : Santa Teresa Gallura → Olbia (et non Figari), Zermatt → un aéroport suisse', () => {
    expect(nearestAirport(41.239, 9.19)?.iata).toBe('FSC');
    expect(nearestAirport(41.239, 9.19, { country: 'IT' })?.iata).toBe('OLB');
    expect(nearestAirport(41.239, 9.19, { country: null })?.iata).toBe('FSC');
    expect(nearestAirport(46.02, 7.749)?.iata).toBe('MXP');
    expect(nearestAirport(46.02, 7.749, { country: 'CH' })?.country).toBe('CH');
    // Le rayon par défaut vaut toujours : pas d'aéroport suisse à moins de 300 km de la Corse.
    expect(nearestAirport(41.239, 9.19, { country: 'CH' })?.iata).toBe('FSC');
  });

  it('Taveuni (Fidji, sur l’antiméridien) : un aéroport fidjien des deux côtés de 180°', () => {
    expect(nearestAirport(-16.85, 179.95)?.country).toBe('FJ');
    expect(nearestAirport(-16.85, -179.95)?.country).toBe('FJ');
  });
});

describe('le fichier des aéroports ne part jamais dans le navigateur', () => {
  const SRC = path.resolve(__dirname, '..', '..', '..');
  const AIRPORTS_JSON = path.join(SRC, 'features', 'compas', 'data', 'airports.json');
  const AIRPORTS_SERVER = path.join(SRC, 'features', 'compas', 'server', 'airports.ts');
  const directive = (code: string, d: string) =>
    new RegExp(`^(?:\\s|//[^\\n]*\\n|/\\*[\\s\\S]*?\\*/)*['"]${d}['"]`).test(code);
  const files = (dir: string, out: string[] = []): string[] => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '__tests__') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) files(p, out);
      else if (/\.(tsx?|jsx?|mjs)$/.test(e.name)) out.push(p);
    }
    return out;
  };
  const resolve = (from: string, spec: string): string | null => {
    const base = spec.startsWith('@/') ? path.join(SRC, spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(from), spec) : null;
    if (!base) return null;
    for (const ext of ['', '.ts', '.tsx', '.js', '.mjs', '.json', '/index.ts', '/index.tsx', '/index.js']) {
      const p = base + ext;
      if (existsSync(p) && statSync(p).isFile()) return p;
    }
    return null;
  };
  // Imports de valeur (un `import type` est effacé à la compilation).
  const IMPORT = /(?:^|\n)\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

  it('server/airports.ts commence par import "server-only"', () => {
    expect(readFileSync(AIRPORTS_SERVER, 'utf8')).toMatch(/^import 'server-only';/);
  });

  it('aucun composant client (ni ce qu’il importe) n’atteint le fichier ni sa recherche', () => {
    const all = files(SRC);
    const roots = all.filter((f) => directive(readFileSync(f, 'utf8'), 'use client'));
    expect(roots.length).toBeGreaterThan(10);
    const seen = new Set<string>();
    const stack = [...roots];
    while (stack.length) {
      const f = stack.pop() as string;
      if (seen.has(f)) continue;
      seen.add(f);
      if (f.endsWith('.json')) continue;
      const code = readFileSync(f, 'utf8');
      // Une action serveur reste sur le serveur : le navigateur n'en reçoit qu'une référence.
      if (!roots.includes(f) && directive(code, 'use server')) continue;
      for (const m of code.matchAll(IMPORT)) {
        const next = resolve(f, m[1] ?? m[2]);
        if (next && !seen.has(next)) stack.push(next);
      }
    }
    expect(seen.has(AIRPORTS_JSON)).toBe(false);
    expect(seen.has(AIRPORTS_SERVER)).toBe(false);
  });

  it('seul server/airports.ts importe le fichier', () => {
    const importers = files(SRC).filter((f) => /data\/airports\.json['"]/.test(readFileSync(f, 'utf8')));
    expect(importers).toEqual([AIRPORTS_SERVER]);
  });
});
