import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { FOREIGN_AIRPORT_FACTOR, nearestAirportIn, type AirportRow } from '../engine/airports';
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

/** Autres lignes réelles, pour les frontières : Corse, Suisse, Italie du nord, Annecy. */
const BORDER_EXTRA: AirportRow[] = [
  ['BRN', 'Bern Airport', 46.913, 7.499, 'CH', 'M'],
  ['FSC', 'Figari Sud-Corse Airport', 41.502, 9.097, 'FR', 'L'],
  ['LUG', 'Lugano Airport', 46.004, 8.911, 'CH', 'M'],
  ['MXP', 'Milan Malpensa International Airport', 45.631, 8.728, 'IT', 'L'],
  ['NCY', 'Annecy Meythet airport', 45.929, 6.099, 'FR', 'M'],
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

describe('indice de pays (pénalité douce sur les aéroports d’un autre pays)', () => {
  // Lieux réels (centres de commune). Chaque cas a été recalculé sur le fichier versionné.
  const CHAMONIX = { lat: 45.9237, lon: 6.8694 };
  const MORZINE = { lat: 46.1792, lon: 6.7087 };
  const COURMAYEUR = { lat: 45.7967, lon: 6.9689 };
  const ZERMATT = { lat: 46.0207, lon: 7.7491 };
  const SANTA_TERESA = { lat: 41.239, lon: 9.19 };
  const ANNECY = { lat: 45.9, lon: 6.13 };
  const GOLFE_DE_CAGLIARI = { lat: 38.7, lon: 9.2 };
  const pick = (p: { lat: number; lon: number }, opts?: Parameters<typeof nearestAirportIn>[3]) =>
    nearestAirportIn(BORDER_ROWS, p.lat, p.lon, opts);

  it('le facteur est de 1,25', () => {
    expect(FOREIGN_AIRPORT_FACTOR).toBe(1.25);
  });

  it('Chamonix et Morzine (France) gardent Genève : l’aéroport que tout le monde prend ne se perd pas', () => {
    // Chamonix : Genève 68 km (grand, 68 × 1,25 = 85) devant Annecy 60 km (moyen français, 60 × 1,6 = 95).
    expect(pick(CHAMONIX)).toMatchObject({ iata: 'GVA', km: 68 });
    expect(pick(CHAMONIX, { country: 'FR' })).toMatchObject({ iata: 'GVA', country: 'CH', km: 68 });
    // Morzine : Genève 47 km (47 × 1,25 = 58) devant Annecy 55 km (moyen, 87).
    expect(pick(MORZINE, { country: 'FR' })).toMatchObject({ iata: 'GVA', country: 'CH', km: 47 });
  });

  it('Courmayeur : sans indice Genève (83 km), avec « IT » Turin (85 km, le pays du lieu)', () => {
    expect(pick(COURMAYEUR)).toMatchObject({ iata: 'GVA', km: 83 });
    expect(pick(COURMAYEUR, { country: 'IT' })).toMatchObject({ iata: 'TRN', country: 'IT', km: 85 });
  });

  it('LIMITE CONNUE, Zermatt : même avec « CH », Milan (87 km) passe devant Genève (129 km)', () => {
    // 87 × 1,25 = 109 < 129 : le vol d'oiseau ne connaît pas les Alpes (la vallée de Zermatt ne se
    // rejoint pas depuis l'Italie). Le facteur n'y change rien sans casser Chamonix (il faut < 1,40 pour
    // Chamonix, > 1,47 ici). À traiter autrement qu'avec le pays (route), hors de ce lot.
    expect(pick(ZERMATT)).toMatchObject({ iata: 'MXP', km: 87 });
    expect(pick(ZERMATT, { country: 'CH' })).toMatchObject({ iata: 'MXP', country: 'IT', km: 87 });
  });

  it('LIMITE CONNUE, Santa Teresa Gallura : Figari (Corse, grand, 30 km) reste devant Olbia (47 km) même avec « IT »', () => {
    // 30 × 1,25 = 38 < 47. Il faudrait un facteur > 1,54 pour Olbia, ce qui ferait perdre Genève à Chamonix.
    // La mer (le détroit de Bonifacio) n'est pas connue du vol d'oiseau : hors de ce lot.
    expect(pick(SANTA_TERESA)).toMatchObject({ iata: 'FSC', country: 'FR', km: 30 });
    expect(pick(SANTA_TERESA, { country: 'IT' })).toMatchObject({ iata: 'FSC', country: 'FR', km: 30 });
  });

  it('un aéroport du pays déjà le plus proche ne change rien (Annecy → NCY avec « FR »)', () => {
    const sans = pick(ANNECY);
    expect(sans).toMatchObject({ iata: 'NCY', country: 'FR', km: 4 });
    expect(pick(ANNECY, { country: 'FR' })).toEqual(sans);
  });

  it('un indice qui ne correspond à rien d’aussi proche ne change rien : tous les aéroports sont pénalisés pareil', () => {
    const sansGolfe = pick(GOLFE_DE_CAGLIARI);
    expect(sansGolfe).toMatchObject({ iata: 'CAG', km: 63 });
    // Aucun aéroport français à moins de 300 km du golfe (Figari est à 312 km) ; aucun japonais nulle part.
    expect(pick(GOLFE_DE_CAGLIARI, { country: 'FR' })).toEqual(sansGolfe);
    expect(pick(COURMAYEUR, { country: 'JP' })).toEqual(pick(COURMAYEUR));
    expect(pick(SANTA_TERESA, { country: 'JP' })).toEqual(pick(SANTA_TERESA));
    expect(nearestAirportIn(BORDER_ROWS, 40, -40, { country: 'FR' })).toBeNull();
  });

  it('minuscules et espaces acceptés ; null, undefined, vide ou espaces : pas d’indice', () => {
    expect(pick(COURMAYEUR, { country: 'it' })?.iata).toBe('TRN');
    expect(pick(COURMAYEUR, { country: ' It ' })?.iata).toBe('TRN');
    for (const country of [null, undefined, '', '  ']) {
      expect(pick(COURMAYEUR, { country })).toEqual(pick(COURMAYEUR));
      expect(pick(COURMAYEUR, { country })?.iata).toBe('GVA');
    }
  });

  it('la pénalité s’ajoute à celle des aéroports moyens (1,6 × 1,25 = 2)', () => {
    // Lignes fictives : un moyen étranger à 44 km et un grand du pays à 88 km.
    const etrangerMoyen: AirportRow = ['AAA', 'Étranger moyen', 0.4, 0, 'XX', 'M'];
    const localGrand: AirportRow = ['BBB', 'Local grand', -0.79, 0, 'YY', 'L'];
    // Sans indice : 44 × 1,6 = 71 contre 88 → le moyen. Avec « YY » : 44 × 1,6 × 1,25 = 89 contre 88 → le local.
    expect(nearestAirportIn([etrangerMoyen, localGrand], 0, 0)?.iata).toBe('AAA');
    expect(nearestAirportIn([etrangerMoyen, localGrand], 0, 0, { country: 'YY' })?.iata).toBe('BBB');
    expect(nearestAirportIn([etrangerMoyen, localGrand], 0, 0, { country: 'XX' })?.iata).toBe('AAA');
  });

  it('l’indice ne retire personne et ne sort jamais du rayon : un seul aéroport étranger à portée reste choisi', () => {
    // Rayon de 40 km autour de Santa Teresa : seul Figari (étranger pour « IT ») est à portée → lui, pas null.
    expect(pick(SANTA_TERESA, { country: 'IT', maxKm: 40 })).toMatchObject({ iata: 'FSC', km: 30 });
    // Le rayon reste le rayon : rien à 40 km du golfe de Cagliari, avec ou sans indice.
    expect(pick(GOLFE_DE_CAGLIARI, { country: 'FR', maxKm: 40 })).toBeNull();
    expect(pick(GOLFE_DE_CAGLIARI, { country: 'IT', maxKm: 40 })).toBeNull();
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

  it('indice de pays sur le vrai fichier : les Alpes françaises gardent Genève, Courmayeur prend Turin', () => {
    // Chamonix, Morzine : Genève avec ou sans « FR » (Annecy, saisonnier et moyen, ne la remplace pas).
    expect(nearestAirport(45.9237, 6.8694)?.iata).toBe('GVA');
    expect(nearestAirport(45.9237, 6.8694, { country: 'FR' })?.iata).toBe('GVA');
    expect(nearestAirport(46.1792, 6.7087, { country: 'FR' })?.iata).toBe('GVA');
    // Courmayeur : Genève sans indice, Turin (pays du lieu, 85 km) avec « IT ».
    expect(nearestAirport(45.7967, 6.9689)?.iata).toBe('GVA');
    expect(nearestAirport(45.7967, 6.9689, { country: 'IT' })?.iata).toBe('TRN');
    // Briançon : l'indice ne l'envoie pas à Nice (146 km), il garde Turin (86 km) comme sans indice.
    expect(nearestAirport(44.8987, 6.6433)?.iata).toBe('TRN');
    expect(nearestAirport(44.8987, 6.6433, { country: 'FR' })?.iata).toBe('TRN');
    // Annecy : l'aéroport du lieu, avec ou sans indice.
    expect(nearestAirport(45.9, 6.13)?.iata).toBe('NCY');
    expect(nearestAirport(45.9, 6.13, { country: 'FR' })?.iata).toBe('NCY');
  });

  it('limites connues sur le vrai fichier : Zermatt reste Milan avec « CH », Santa Teresa Gallura reste Figari avec « IT »', () => {
    expect(nearestAirport(46.0207, 7.7491, { country: 'CH' })?.iata).toBe('MXP');
    expect(nearestAirport(41.239, 9.19)?.iata).toBe('FSC');
    expect(nearestAirport(41.239, 9.19, { country: 'IT' })?.iata).toBe('FSC');
    expect(nearestAirport(41.239, 9.19, { country: null })?.iata).toBe('FSC');
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
