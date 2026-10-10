import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import TABLE from '../data/entryRequirements.json';
import META from '../data/entryRequirements.meta.json';
import {
  EXPECTED_CREDIT_SUFFIX,
  REQUIREMENTS,
  buildEntryRequirements,
} from '../../../../scripts/compas/build-entry-requirements.mjs';

/**
 * Table passeport × destination (PLAN-100 4.2) : le script qui la génère depuis
 * travelrequirements.info (CC BY 4.0) et le fichier versionné. Les lignes de
 * test sont de vraies lignes du jeu v1.3.0 ; le test du fichier généré
 * vérifie qu'elles s'y retrouvent au chiffre près.
 */
const HEADER =
  'destination_slug,destination_iso2,destination_name,passport_code,passport_name,requirement,max_stay_days,extendable_days,visa_type_ids,stay_window_basis,stay_window_days,source_url,source_last_verified,source_level';

/** Vraies lignes de visa-matrix.csv (v1.3.0). */
const LINES = {
  FR_US: 'united-states,US,United States,FR,France,eta,90,,esta,,,https://www.dhs.gov/visa-waiver-program,2026-10-03,row',
  FR_VN:
    'vietnam,VN,Vietnam,FR,France,visa-free,45,,,,,https://baochinhphu.vn/mien-thi-thuc-nhap-canh-viet-nam-cho-cong-dan-12-nuoc-102250307195144569.htm,2026-10-07,row',
  FR_PT:
    'portugal,PT,Portugal,FR,France,freedom-of-movement,,,,rolling,180,https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32004L0038,2026-10-08,row',
  DE_PT:
    'portugal,PT,Portugal,DE,Germany,freedom-of-movement,,,,rolling,180,https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32004L0038,2026-10-08,row',
  US_TR:
    'turkey,TR,Turkey,US,United States,visa-free,90,,,rolling,180,https://www.mfa.gov.tr/visa-information-for-foreigners.en.mfa,2026-10-03,row',
  FR_NP:
    'nepal,NP,Nepal,FR,France,visa-on-arrival,,,voa-15 voa-30 voa-90 evisa-15 evisa-30 evisa-90,,,https://immigration.gov.np/eta-visa-nepal,2026-10-03,policy',
  DE_NP:
    'nepal,NP,Nepal,DE,Germany,visa-on-arrival,,,voa-15 voa-30 voa-90 evisa-15 evisa-30 evisa-90,,,https://immigration.gov.np/eta-visa-nepal,2026-10-03,policy',
  FR_IR: 'iran,IR,Iran,FR,France,embassy-visa,,,,,,https://evisa.mfa.ir/en/,2026-10-09,policy',
  HK_CN:
    'china,CN,China,HK,Hong Kong,travel-permit,,,,,,https://www.gov.cn/flfg/2012-06/30/content_2174944.htm,2026-10-07,row',
  IR_US:
    'united-states,US,United States,IR,Iran,banned,,,,,,https://www.govinfo.gov/content/pkg/FR-2025-12-19/html/2025-23570.htm,2026-10-03,row',
} as const;

const INDEX = {
  version: '1.3.0',
  license: { spdx: 'CC-BY-4.0' },
  attribution: {
    required: true,
    citation:
      'TravelRequirements.info — Entry Requirements Dataset v1.3.0, AXG Sp. z o.o., https://travelrequirements.info/data/ (CC BY 4.0)',
  },
  coverage: { destinations: 5, passports: 5, matrixRows: 6 },
};
const csv = (...rows: string[]) => [HEADER, ...rows].join('\n');
const BASIC = csv(LINES.FR_US, LINES.FR_VN, LINES.FR_PT, LINES.DE_PT, LINES.US_TR, LINES.FR_NP, LINES.DE_NP);
const BASIC_INDEX = { ...INDEX, coverage: { destinations: 5, passports: 3, matrixRows: 7 } };
const OPTS = { fetched: '2026-10-10' };
type Built = { table: Record<string, Array<Array<string | number | null>>>; meta: Record<string, unknown> };
const build = (text: string, index: unknown = BASIC_INDEX) =>
  buildEntryRequirements(text, index, OPTS) as unknown as Built;

describe('script de génération : la table compacte', () => {
  it('groupe, par destination, les passeports qui ont la même exigence, séjour, fenêtre et date', () => {
    const { table } = build(BASIC);
    expect(table).toEqual({
      NP: [['visa-on-arrival', null, null, '2026-10-03', 'DE FR']],
      PT: [['freedom-of-movement', null, 'rolling-180', '2026-10-08', 'DE FR']],
      TR: [['visa-free', 90, 'rolling-180', '2026-10-03', 'US']],
      US: [['eta', 90, null, '2026-10-03', 'FR']],
      VN: [['visa-free', 45, null, '2026-10-07', 'FR']],
    });
  });

  it('sépare ce qui diffère (date de vérification, séjour), trie, et garde « non confirmé » et les cas rares', () => {
    const text = csv(
      LINES.FR_IR,
      LINES.HK_CN,
      LINES.IR_US,
      'iran,IR,Iran,DE,Germany,embassy-visa,,,,,,https://evisa.mfa.ir/en/,2026-10-02,policy',
      'iran,IR,Iran,BE,Belgium,embassy-visa,30,,,,,https://evisa.mfa.ir/en/,2026-10-09,policy',
      'iran,IR,Iran,AT,Austria,unconfirmed,,,,,,https://evisa.mfa.ir/en/,2026-10-09,policy',
      'iran,IR,Iran,NL,Netherlands,embassy-visa,,,,,,https://evisa.mfa.ir/en/,2026-10-09,policy'
    );
    const { table } = build(text, { ...INDEX, coverage: { destinations: 3, passports: 7, matrixRows: 7 } });
    expect(table.CN).toEqual([['travel-permit', null, null, '2026-10-07', 'HK']]);
    expect(table.US).toEqual([['banned', null, null, '2026-10-03', 'IR']]);
    expect(table.IR).toEqual([
      ['embassy-visa', null, null, '2026-10-02', 'DE'],
      ['embassy-visa', null, null, '2026-10-09', 'FR NL'],
      ['embassy-visa', 30, null, '2026-10-09', 'BE'],
      ['unconfirmed', null, null, '2026-10-09', 'AT'],
    ]);
  });

  it('les trois façons de compter un séjour : glissant, depuis la première entrée, par entrée', () => {
    const text = csv(
      'x,AA,X,BB,B,visa-free,90,,,rolling,180,u,2026-10-01,row',
      'x,AA,X,CC,C,visa-free,180,,,rolling,365,u,2026-10-01,row',
      'x,AA,X,DD,D,visa-free,90,,,per-12-months-from-first-entry,365,u,2026-10-01,row',
      'x,AA,X,EE,E,eta,90,,,per-entry,,u,2026-10-01,row'
    );
    const { table } = build(text, { ...INDEX, coverage: { destinations: 1, passports: 4, matrixRows: 4 } });
    expect(table.AA.map((g: unknown[]) => [g[0], g[1], g[2], g[4]])).toEqual([
      ['eta', 90, 'per-entry', 'EE'],
      ['visa-free', 90, 'per-12-months-from-first-entry', 'DD'],
      ['visa-free', 90, 'rolling-180', 'BB'],
      ['visa-free', 180, 'rolling-365', 'CC'],
    ]);
  });

  it('les métadonnées disent source, version, licence, crédit, dates, nombre de lignes et empreinte du CSV', () => {
    const { meta } = buildEntryRequirements(BASIC, BASIC_INDEX, { fetched: '2026-10-10', sha256: 'ab'.repeat(32) });
    expect(meta).toEqual({
      source: 'TravelRequirements.info — Entry Requirements Dataset',
      version: '1.3.0',
      url: 'https://travelrequirements.info/data/',
      licence: 'CC BY 4.0',
      credit:
        'TravelRequirements.info — Entry Requirements Dataset v1.3.0, AXG Sp. z o.o., https://travelrequirements.info/data/ (CC BY 4.0)',
      fetched: '2026-10-10',
      verifiedMin: '2026-10-03',
      verifiedMax: '2026-10-08',
      rows: 7,
      destinations: 5,
      passports: 3,
      sha256: 'ab'.repeat(32),
    });
  });

  it('sans empreinte donnée, elle est calculée sur le texte du CSV', () => {
    const { meta } = build(BASIC);
    expect(meta.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(build(BASIC).meta.sha256).toBe(meta.sha256);
    expect(build(`${BASIC}\n`).meta.sha256).not.toBe(meta.sha256);
  });

  it('lit un fichier Windows : BOM UTF-8, fins de ligne CRLF, ligne vide finale', () => {
    const windows = `﻿${BASIC.replace(/\n/g, '\r\n')}\r\n`;
    expect(build(windows).table).toEqual(build(BASIC).table);
  });
});

describe('script de génération : les données du jeu sont non fiables', () => {
  const one = (row: string) =>
    build(csv(row), { ...INDEX, coverage: { destinations: 1, passports: 1, matrixRows: 1 } });
  const base = LINES.FR_VN;

  it('une exigence hors de la liste fermée fait échouer, avec sa ligne', () => {
    expect(() => one(base.replace('visa-free', 'visa-gratuit'))).toThrow(/requirement inconnu.*visa-gratuit.*ligne 2/);
    expect(() => one(base.replace('visa-free', ''))).toThrow(/requirement inconnu/);
    // Même casse : « Visa-Free » n'est pas « visa-free ».
    expect(() => one(base.replace('visa-free', 'Visa-Free'))).toThrow(/requirement inconnu/);
  });

  it('la liste fermée est celle du schéma publié (neuf valeurs)', () => {
    expect([...REQUIREMENTS].sort()).toEqual(
      ['banned', 'embassy-visa', 'eta', 'evisa', 'freedom-of-movement', 'travel-permit', 'unconfirmed', 'visa-free', 'visa-on-arrival'].sort()
    );
  });

  it('une colonne absente, un fichier vide ou sans en-tête disent ce qui ne va pas', () => {
    expect(() => build('')).toThrow('CSV vide ou sans en-tête');
    expect(() => build('\n\r\n')).toThrow('CSV vide ou sans en-tête');
    expect(() => build(`${HEADER.replace('requirement', 'exigence')}\n${base}`)).toThrow('Colonne absente du CSV : requirement');
    expect(() => build(`${HEADER.replace(',source_level', '')}\n${base}`)).toThrow('Colonne absente du CSV : source_level');
  });

  it('un pays ou un passeport qui n’est pas un code à deux lettres majuscules', () => {
    expect(() => one(base.replace(',VN,', ',vn,'))).toThrow(/destination_iso2.*ligne 2/);
    expect(() => one(base.replace(',FR,France,', ',FRA,France,'))).toThrow(/passport_code.*ligne 2/);
    expect(() => one(base.replace(',VN,', ',V1,'))).toThrow(/destination_iso2/);
  });

  it('un séjour, une fenêtre ou une date mal formés', () => {
    expect(() => one(base.replace(',45,', ',quarante,'))).toThrow(/max_stay_days/);
    expect(() => one(base.replace(',45,', ',-5,'))).toThrow(/max_stay_days/);
    expect(() => one(base.replace(',45,', ',0,'))).toThrow(/max_stay_days/);
    expect(() => one(base.replace(',45,', ',99999,'))).toThrow(/max_stay_days/);
    expect(() => one(base.replace(',45,,,,,', ',45,,,tous-les-jours,180,'))).toThrow(/stay_window_basis/);
    expect(() => one(base.replace(',45,,,,,', ',45,,,rolling,abc,'))).toThrow(/stay_window_days/);
    expect(() => one(base.replace(',45,,,,,', ',45,,,rolling,,'))).toThrow(/stay_window_days/);
    expect(() => one(base.replace('2026-10-07', '7 octobre'))).toThrow(/source_last_verified/);
    expect(() => one(base.replace('2026-10-07', '2026-02-30'))).toThrow(/source_last_verified/);
    expect(() => one(base.replace('2026-10-07', ''))).toThrow(/source_last_verified/);
  });

  it('un niveau de source inconnu', () => {
    expect(() => one(base.replace(',row', ',rumeur'))).toThrow(/source_level/);
  });

  it('une ligne trop courte ou trop longue (champ coupé ou virgule en trop)', () => {
    expect(() => one(base.slice(0, base.lastIndexOf(',')))).toThrow(/colonnes.*ligne 2/);
    expect(() => one(`${base},extra`)).toThrow(/colonnes.*ligne 2/);
  });

  it('un même couple destination × passeport deux fois', () => {
    expect(() => build(csv(base, base), { ...INDEX, coverage: { destinations: 1, passports: 1, matrixRows: 2 } })).toThrow(
      /VN × FR.*deux fois/
    );
  });

  it('un texte libre piégé (nom, adresse) n’entre jamais dans la table ni dans les métadonnées', () => {
    const trap = 'vietnam,VN,"<script>alert(1)</script>, Vietnam",FR,"=HYPERLINK(""http://x"")",visa-free,45,,,,,javascript:alert(1),2026-10-07,row';
    const { table, meta } = one(trap);
    expect(JSON.stringify(table)).not.toMatch(/script|HYPERLINK|javascript/);
    expect(JSON.stringify(meta)).not.toMatch(/script|HYPERLINK|javascript/);
    expect(table).toEqual({ VN: [['visa-free', 45, null, '2026-10-07', 'FR']] });
  });
});

describe('script de génération : licence, crédit et couverture du manifeste', () => {
  it('refuse une licence qui n’est pas CC BY 4.0 (jamais un jeu dérivé de Passport Index)', () => {
    expect(() => build(BASIC, { ...BASIC_INDEX, license: { spdx: 'CC-BY-NC-4.0' } })).toThrow(/licence/i);
    expect(() => build(BASIC, { ...BASIC_INDEX, license: { spdx: 'MIT' } })).toThrow(/licence/i);
    expect(() => build(BASIC, { ...BASIC_INDEX, license: undefined })).toThrow(/licence/i);
  });

  it('refuse un crédit qui n’est pas celui de l’éditeur pour cette version', () => {
    const attribution = (citation: string) => ({ ...BASIC_INDEX, attribution: { required: true, citation } });
    expect(() => build(BASIC, attribution('TravelRequirements.info (CC BY 4.0)'))).toThrow(/crédit/i);
    expect(() =>
      build(BASIC, attribution(INDEX.attribution.citation.replace('v1.3.0', 'v1.4.0')))
    ).toThrow(/crédit/i);
    expect(() => build(BASIC, { ...BASIC_INDEX, attribution: undefined })).toThrow(/crédit/i);
    expect(EXPECTED_CREDIT_SUFFIX).toBe(', AXG Sp. z o.o., https://travelrequirements.info/data/ (CC BY 4.0)');
  });

  it('refuse une version absente et une couverture qui ne correspond pas au CSV (fichier tronqué)', () => {
    expect(() => build(BASIC, { ...BASIC_INDEX, version: undefined })).toThrow(/version/i);
    expect(() => build(BASIC, { ...BASIC_INDEX, coverage: { ...BASIC_INDEX.coverage, matrixRows: 39601 } })).toThrow(
      /7 lignes.*39601/
    );
    expect(() => build(BASIC, { ...BASIC_INDEX, coverage: { ...BASIC_INDEX.coverage, destinations: 199 } })).toThrow(/destinations/);
    expect(() => build(BASIC, { ...BASIC_INDEX, coverage: undefined })).toThrow(/couverture/i);
    expect(() => buildEntryRequirements(BASIC, undefined, OPTS)).toThrow(/manifeste/i);
  });

  it('refuse une date du jour mal formée', () => {
    expect(() => buildEntryRequirements(BASIC, BASIC_INDEX, { fetched: 'hier' })).toThrow(/fetched/);
  });
});

describe('fichier généré (travelrequirements.info v1.3.0)', () => {
  const SRC = path.resolve(__dirname, '..', 'data');
  const cells = Object.entries(TABLE as Record<string, unknown[][]>).flatMap(([dest, groups]) =>
    groups.flatMap((g) =>
      String(g[4])
        .split(' ')
        .map((passport) => ({ dest, passport, req: g[0], stay: g[1], window: g[2], verified: g[3] }))
    )
  );
  const cell = (passport: string, dest: string) => cells.find((c) => c.passport === passport && c.dest === dest);

  it('les lignes de test sont celles du fichier, au chiffre près', () => {
    expect(cell('FR', 'US')).toMatchObject({ req: 'eta', stay: 90, window: null, verified: '2026-10-03' });
    expect(cell('FR', 'VN')).toMatchObject({ req: 'visa-free', stay: 45, window: null, verified: '2026-10-07' });
    expect(cell('FR', 'PT')).toMatchObject({ req: 'freedom-of-movement', stay: null, window: 'rolling-180', verified: '2026-10-08' });
    expect(cell('DE', 'PT')).toMatchObject({ req: 'freedom-of-movement', window: 'rolling-180' });
    expect(cell('US', 'TR')).toMatchObject({ req: 'visa-free', stay: 90, window: 'rolling-180', verified: '2026-10-03' });
    expect(cell('FR', 'NP')).toMatchObject({ req: 'visa-on-arrival', stay: null, verified: '2026-10-03' });
    expect(cell('FR', 'IR')).toMatchObject({ req: 'embassy-visa', verified: '2026-10-09' });
    expect(cell('HK', 'CN')).toMatchObject({ req: 'travel-permit' });
    expect(cell('IR', 'US')).toMatchObject({ req: 'banned' });
  });

  it('autant de cellules que de lignes du CSV, sans doublon, et le total des métadonnées', () => {
    expect(cells.length).toBe(META.rows);
    expect(cells.length).toBe(39601);
    expect(new Set(cells.map((c) => `${c.dest}>${c.passport}`)).size).toBe(cells.length);
    expect(Object.keys(TABLE).length).toBe(META.destinations);
    expect(new Set(cells.map((c) => c.passport)).size).toBe(META.passports);
  });

  it('chaque groupe : [exigence connue, séjour entier ou null, fenêtre connue ou null, date, passeports triés]', () => {
    const windows = /^(?:rolling-\d{2,3}|per-12-months-from-first-entry|per-entry)$/;
    for (const [dest, groups] of Object.entries(TABLE as Record<string, unknown[][]>)) {
      expect(dest).toMatch(/^[A-Z]{2}$/);
      for (const g of groups) {
        expect(g.length).toBe(5);
        expect(REQUIREMENTS).toContain(g[0]);
        expect(g[1] === null || (Number.isInteger(g[1]) && (g[1] as number) > 0 && (g[1] as number) <= 3650)).toBe(true);
        expect(g[2] === null || windows.test(g[2] as string)).toBe(true);
        expect(g[3]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        const passports = String(g[4]).split(' ');
        expect(passports.every((p) => /^[A-Z]{2}$/.test(p))).toBe(true);
        expect([...passports].sort()).toEqual(passports);
      }
    }
  });

  it('compacte : quelques centaines de Ko au plus, et rien qui ne soit pas validé (ni nom, ni adresse)', () => {
    const size = statSync(path.join(SRC, 'entryRequirements.json')).size;
    expect(size).toBeLessThan(300_000);
    const raw = readFileSync(path.join(SRC, 'entryRequirements.json'), 'utf8');
    expect(raw).not.toMatch(/https?:|<|>/);
  });

  it('source, licence, crédit exact de l’éditeur, dates et empreinte dits', () => {
    expect(META).toEqual({
      source: 'TravelRequirements.info — Entry Requirements Dataset',
      version: '1.3.0',
      url: 'https://travelrequirements.info/data/',
      licence: 'CC BY 4.0',
      credit:
        'TravelRequirements.info — Entry Requirements Dataset v1.3.0, AXG Sp. z o.o., https://travelrequirements.info/data/ (CC BY 4.0)',
      fetched: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      verifiedMin: '2026-08-26',
      verifiedMax: '2026-10-10',
      rows: 39601,
      destinations: 199,
      passports: 199,
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const dates = cells.map((c) => c.verified as string).sort();
    expect(dates[0]).toBe(META.verifiedMin);
    expect(dates[dates.length - 1]).toBe(META.verifiedMax);
  });
});
