import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import TABLE from '../data/entryRequirements.json';
import {
  ENTRY_KINDS,
  describeEntry,
  entryFor,
  entryRequirementIn,
  frenchDay,
  needsFormalities,
  type EntryKind,
  type EntryRequirement,
  type EntryTable,
} from '../engine/entry';
import { entryRequirement } from '../server/entryRequirements';

/**
 * Table passeport × destination (PLAN-100 4.2) : la recherche pure, les mots du
 * Compas pour chaque exigence, et le fichier réel de travelrequirements.info v1.3.0
 * (CC BY 4.0). Les lignes de référence sont de vraies lignes du jeu.
 */
const SMALL: EntryTable = {
  NP: [['visa-on-arrival', null, null, '2026-10-03', 'DE FR']],
  PT: [['freedom-of-movement', null, 'rolling-180', '2026-10-08', 'DE FR']],
  TR: [['visa-free', 90, 'rolling-180', '2026-10-03', 'FR US']],
  US: [
    ['banned', null, null, '2026-10-03', 'IR'],
    ['eta', 90, null, '2026-10-03', 'AF FR'],
  ],
};

describe('entryRequirementIn — la recherche pure', () => {
  it('trouve le groupe qui porte le passeport, avec séjour, fenêtre et date', () => {
    expect(entryRequirementIn(SMALL, 'FR', 'TR')).toEqual({
      kind: 'sans_visa',
      maxStayDays: 90,
      stayWindow: 'rolling-180',
      verified: '2026-10-03',
    });
    expect(entryRequirementIn(SMALL, 'FR', 'NP')).toEqual({
      kind: 'visa_arrivee',
      maxStayDays: null,
      stayWindow: null,
      verified: '2026-10-03',
    });
    expect(entryRequirementIn(SMALL, 'IR', 'US')?.kind).toBe('interdit');
    expect(entryRequirementIn(SMALL, 'AF', 'US')?.kind).toBe('autorisation');
  });

  it('passeport ou destination absents : null, jamais une valeur devinée', () => {
    expect(entryRequirementIn(SMALL, 'JP', 'TR')).toBeNull();
    expect(entryRequirementIn(SMALL, 'FR', 'JP')).toBeNull();
    expect(entryRequirementIn(SMALL, 'FR', 'US')?.kind).toBe('autorisation');
  });

  it('un code entier : « AA » n’est pas trouvé dans « AF AM », ni « F » dans « FR »', () => {
    const t: EntryTable = { ZZ: [['visa-free', null, null, '2026-10-01', 'AF AM FR']] };
    expect(entryRequirementIn(t, 'AA', 'ZZ')).toBeNull();
    expect(entryRequirementIn(t, 'FA', 'ZZ')).toBeNull();
    expect(entryRequirementIn(t, 'F', 'ZZ')).toBeNull();
    expect(entryRequirementIn(t, 'MF', 'ZZ')).toBeNull();
    expect(entryRequirementIn(t, 'AF', 'ZZ')?.kind).toBe('sans_visa');
  });

  it('entrées invalides : null (la casse est tolérée, pas les autres formes)', () => {
    expect(entryRequirementIn(SMALL, null, 'TR')).toBeNull();
    expect(entryRequirementIn(SMALL, 'FR', undefined)).toBeNull();
    expect(entryRequirementIn(SMALL, '', 'TR')).toBeNull();
    expect(entryRequirementIn(SMALL, 'FRA', 'TR')).toBeNull();
    expect(entryRequirementIn(SMALL, 'F R', 'TR')).toBeNull();
    expect(entryRequirementIn(SMALL, 'FR TR', 'TR')).toBeNull();
    expect(entryRequirementIn(SMALL, 'fr', 'tr')?.kind).toBe('sans_visa');
    expect(entryRequirementIn(SMALL, ' FR ', ' TR ')?.kind).toBe('sans_visa');
    // Pas de piège de prototype.
    expect(entryRequirementIn(SMALL, 'FR', '__proto__')).toBeNull();
    expect(entryRequirementIn(SMALL, 'FR', 'CONSTRUCTOR')).toBeNull();
  });

  it('une exigence inconnue de ce code (jeu plus récent), un séjour ou une date mal formés : null', () => {
    const bad = (g: unknown[]) => entryRequirementIn({ ZZ: [g as never] }, 'FR', 'ZZ');
    expect(bad(['visa-gratuit', 30, null, '2026-10-01', 'FR'])).toBeNull();
    expect(bad(['visa-free', -3, null, '2026-10-01', 'FR'])).toBeNull();
    expect(bad(['visa-free', 1.5, null, '2026-10-01', 'FR'])).toBeNull();
    expect(bad(['visa-free', 30, null, 'hier', 'FR'])).toBeNull();
    expect(bad(['visa-free', 30, null, '2026-10-01', 'FR'])?.kind).toBe('sans_visa');
  });

  it('les neuf exigences du jeu ont chacune un mot du Compas', () => {
    expect(ENTRY_KINDS).toEqual({
      'freedom-of-movement': 'libre_circulation',
      'visa-free': 'sans_visa',
      'visa-on-arrival': 'visa_arrivee',
      evisa: 'e_visa',
      eta: 'autorisation',
      'embassy-visa': 'visa_a_demander',
      'travel-permit': 'permis',
      banned: 'interdit',
      unconfirmed: 'non_confirme',
    });
  });
});

describe('describeEntry — ce que la table dit, en français', () => {
  const req = (kind: EntryKind, maxStayDays: number | null = null, stayWindow: string | null = null): EntryRequirement => ({
    kind,
    maxStayDays,
    stayWindow,
    verified: '2026-10-03',
  });

  it('sans visa : le séjour et sa façon de se compter', () => {
    expect(describeEntry(req('sans_visa', 90))).toBe('passeport valide, sans visa jusqu’à 90 jours');
    expect(describeEntry(req('sans_visa', 90, 'rolling-180'))).toBe(
      'passeport valide, sans visa jusqu’à 90 jours par période de 180 jours'
    );
    expect(describeEntry(req('sans_visa', 90, 'per-12-months-from-first-entry'))).toBe(
      'passeport valide, sans visa jusqu’à 90 jours sur 12 mois à partir de la première entrée'
    );
    expect(describeEntry(req('sans_visa', 1))).toBe('passeport valide, sans visa jusqu’à 1 jour');
    expect(describeEntry(req('sans_visa'))).toBe('passeport valide, sans visa');
  });

  it('visa à l’arrivée, e-visa, autorisation électronique, visa à demander, permis', () => {
    expect(describeEntry(req('visa_arrivee'))).toBe('passeport valide, visa à l’arrivée');
    expect(describeEntry(req('visa_arrivee', 30))).toBe('passeport valide, visa à l’arrivée, séjour jusqu’à 30 jours');
    expect(describeEntry(req('e_visa', 30))).toBe(
      'passeport valide, e-visa à demander en ligne avant le départ, séjour jusqu’à 30 jours'
    );
    expect(describeEntry(req('autorisation', 180, 'per-entry'))).toBe(
      'passeport valide, autorisation électronique (ETA/ESTA) à obtenir avant le départ, séjour jusqu’à 180 jours par entrée'
    );
    expect(describeEntry(req('visa_a_demander'))).toBe(
      'passeport valide, visa à demander avant le départ (ambassade ou consulat)'
    );
    expect(describeEntry(req('permis'))).toBe('passeport valide, permis d’entrée spécifique à obtenir avant le départ');
  });

  it('libre circulation et entrée interdite ; « non confirmé » ne dit rien', () => {
    expect(describeEntry(req('libre_circulation', null, 'rolling-180'))).toBe('libre circulation, sans visa');
    expect(describeEntry(req('interdit'))).toBe('entrée interdite aux détenteurs de ton passeport');
    expect(describeEntry(req('non_confirme'))).toBeNull();
  });

  it('une fenêtre inconnue n’est pas inventée', () => {
    expect(describeEntry(req('sans_visa', 30, 'calendar-year'))).toBe('passeport valide, sans visa jusqu’à 30 jours');
  });

  it('la date de vérification en français', () => {
    expect(frenchDay('2026-10-07')).toBe('7 octobre 2026');
    expect(frenchDay('2026-10-01')).toBe('1er octobre 2026');
    expect(frenchDay('2026-12-31')).toBe('31 décembre 2026');
    expect(frenchDay('2026-02-28')).toBe('28 février 2026');
    expect(frenchDay('pas une date')).toBeNull();
    expect(frenchDay('2026-13-01')).toBeNull();
    expect(frenchDay('2026-02-30')).toBeNull();
  });

  it('formalités payantes : visa ou autorisation requis, pas sans visa, pas « non confirmé »', () => {
    const paid = (['visa_arrivee', 'e_visa', 'autorisation', 'visa_a_demander'] as EntryKind[]).filter(needsFormalities);
    expect(paid).toEqual(['visa_arrivee', 'e_visa', 'autorisation', 'visa_a_demander']);
    for (const k of ['sans_visa', 'libre_circulation', 'non_confirme', 'interdit', 'permis'] as EntryKind[])
      expect(needsFormalities(k), k).toBe(false);
  });
});

describe('entryFor — quand la table est consultée', () => {
  const find = (p: string, d: string) => entryRequirementIn(SMALL, p, d);

  it('nationalité connue, frontière à passer : la table répond', () => {
    expect(entryFor(find, 'FR', 'TR', true)?.kind).toBe('sans_visa');
    // Départ inconnu : frontière probable, la table répond.
    expect(entryFor(find, 'FR', 'TR', null)?.kind).toBe('sans_visa');
  });

  it('jamais sans nationalité, sans pays, dans son propre pays ni quand on est déjà sur place', () => {
    expect(entryFor(find, null, 'TR', true)).toBeNull();
    expect(entryFor(find, 'FR', null, true)).toBeNull();
    expect(entryFor(find, 'FR', 'TR', false)).toBeNull();
    expect(entryFor(find, 'TR', 'TR', true)).toBeNull();
    expect(entryFor(find, 'tr', ' TR ', null)).toBeNull();
  });
});

describe('le fichier réel (travelrequirements.info v1.3.0)', () => {
  it('lignes de référence, au chiffre près', () => {
    expect(entryRequirement('FR', 'US')).toEqual({ kind: 'autorisation', maxStayDays: 90, stayWindow: null, verified: '2026-10-03' });
    expect(entryRequirement('FR', 'VN')).toEqual({ kind: 'sans_visa', maxStayDays: 45, stayWindow: null, verified: '2026-10-07' });
    expect(entryRequirement('FR', 'TR')).toEqual({ kind: 'sans_visa', maxStayDays: 90, stayWindow: 'rolling-180', verified: '2026-10-03' });
    expect(entryRequirement('FR', 'NP')).toMatchObject({ kind: 'visa_arrivee', maxStayDays: null });
    expect(entryRequirement('FR', 'IN')).toMatchObject({ kind: 'e_visa' });
    expect(entryRequirement('FR', 'IR')).toMatchObject({ kind: 'visa_a_demander', verified: '2026-10-09' });
    expect(entryRequirement('DE', 'PT')).toMatchObject({ kind: 'libre_circulation', stayWindow: 'rolling-180' });
    expect(entryRequirement('US', 'TR')).toMatchObject({ kind: 'sans_visa', maxStayDays: 90 });
    expect(entryRequirement('HK', 'CN')).toMatchObject({ kind: 'permis' });
    expect(entryRequirement('IR', 'US')).toMatchObject({ kind: 'interdit' });
    expect(entryRequirement('FR', 'AF')).toMatchObject({ kind: 'non_confirme' });
  });

  it('territoires et pays hors du jeu, entrées vides : null', () => {
    for (const cc of ['RE', 'GP', 'GI', 'FO', 'ZZ', 'FRA', '']) expect(entryRequirement('FR', cc), cc).toBeNull();
    expect(entryRequirement(null, 'US')).toBeNull();
    expect(entryRequirement('FR', null)).toBeNull();
  });

  it('chaque cellule du fichier a un mot du Compas (aucune exigence orpheline)', () => {
    let cells = 0;
    for (const groups of Object.values(TABLE as Record<string, unknown[][]>))
      for (const g of groups) {
        expect(Object.keys(ENTRY_KINDS), String(g[0])).toContain(g[0]);
        cells += String(g[4]).split(' ').length;
      }
    expect(cells).toBe(39601);
  });

  it('la France et ses voisins : libre circulation ou sans visa, jamais un visa à demander', () => {
    for (const cc of ['PT', 'ES', 'IT', 'DE', 'BE', 'CH', 'NO', 'IS', 'IE', 'GR'])
      expect(entryRequirement('FR', cc)?.kind, cc).toBe('libre_circulation');
    for (const cc of ['AD', 'MC', 'AL', 'RS', 'ME', 'MK', 'BA'])
      expect(entryRequirement('FR', cc)?.kind, cc).toBe('sans_visa');
  });
});

describe('le fichier de la table ne part jamais dans le navigateur', () => {
  const SRC = path.resolve(__dirname, '..', '..', '..');
  const TABLE_JSON = path.join(SRC, 'features', 'compas', 'data', 'entryRequirements.json');
  const TABLE_SERVER = path.join(SRC, 'features', 'compas', 'server', 'entryRequirements.ts');
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

  it('server/entryRequirements.ts commence par import "server-only"', () => {
    expect(readFileSync(TABLE_SERVER, 'utf8')).toMatch(/^import 'server-only';/);
  });

  it('aucun composant client (ni ce qu’il importe) n’atteint le fichier ni sa recherche', () => {
    const roots = files(SRC).filter((f) => directive(readFileSync(f, 'utf8'), 'use client'));
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
    expect(seen.has(TABLE_JSON)).toBe(false);
    expect(seen.has(TABLE_SERVER)).toBe(false);
  });

  it('seul server/entryRequirements.ts importe le fichier', () => {
    const importers = files(SRC).filter((f) => /data\/entryRequirements\.json['"]/.test(readFileSync(f, 'utf8')));
    expect(importers).toEqual([TABLE_SERVER]);
  });
});
