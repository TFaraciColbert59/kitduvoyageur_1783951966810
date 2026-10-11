/**
 * Plan 100, 1.2 « Durée des fonctions » — rester ≤ 300 s, le maximum d'une
 * fonction Vercel Hobby (https://vercel.com/docs/functions/limitations#max-duration,
 * page lue le 11 oct. 2026 : « Hobby 300s default and maximum »).
 *
 * Garde statique :
 *   - aucun `export const maxDuration` du dépôt ne dépasse 300, et chacun est un
 *     nombre écrit en toutes lettres (pas une expression que ce test ne lirait pas) ;
 *   - `vercel.json` et `next.config.mjs` ne forcent aucune durée au-delà ;
 *   - les routes lourdes déclarent leur durée au lieu de dépendre du défaut ;
 *   - `CLAIM_MS` (prise d'une phase de préparation, 290 s) tient dans la durée de
 *     la page Compas qui héberge les actions de préparation : une prise ne
 *     survit pas à la fonction qui la tient.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { CLAIM_MS } from '@/features/compas/server/autofillState';

const ROOT = path.resolve(__dirname, '../../../..');
const HOBBY_MAX_S = 300;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const rel = (file: string) => path.relative(ROOT, file).split(path.sep).join('/');

interface Declaration {
  file: string;
  raw: string;
  seconds: number;
}

function declarations(): Declaration[] {
  const found: Declaration[] = [];
  for (const file of sourceFiles(path.join(ROOT, 'src'))) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/export\s+const\s+maxDuration\s*(?::\s*number\s*)?=\s*([^;\n]+)/g)) {
      const raw = match[1].trim();
      found.push({ file: rel(file), raw, seconds: /^\d[\d_]*$/.test(raw) ? Number(raw.replace(/_/g, '')) : Number.NaN });
    }
  }
  return found;
}

function declared(file: string): number {
  const found = declarations().find((d) => d.file === file);
  return found ? found.seconds : Number.NaN;
}

describe('maxDuration — jamais au-delà de 300 s (Hobby)', () => {
  const all = declarations();

  it('le dépôt déclare des durées (le test lit bien les routes)', () => {
    expect(all.length).toBeGreaterThanOrEqual(15);
  });

  it('chaque `export const maxDuration` est un nombre lisible, entre 1 et 300', () => {
    for (const d of all) {
      expect(Number.isFinite(d.seconds), `${d.file} : « ${d.raw} » n’est pas un nombre écrit en toutes lettres`).toBe(true);
      expect(d.seconds, d.file).toBeGreaterThanOrEqual(1);
      expect(d.seconds, `${d.file} dépasse le maximum Hobby`).toBeLessThanOrEqual(HOBBY_MAX_S);
    }
  });

  it('seuls des fichiers de segment Next (route, page, layout) la déclarent', () => {
    for (const d of all) {
      expect(d.file, d.file).toMatch(/\/(route|page|layout)\.tsx?$/);
    }
  });

  it('vercel.json et next.config.mjs ne forcent aucune durée au-delà de 300 s', () => {
    const vercel = JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')) as {
      functions?: Record<string, { maxDuration?: number }>;
    };
    for (const [pattern, setting] of Object.entries(vercel.functions ?? {})) {
      expect(setting.maxDuration ?? 0, pattern).toBeLessThanOrEqual(HOBBY_MAX_S);
    }
    const next = readFileSync(path.join(ROOT, 'next.config.mjs'), 'utf8');
    for (const match of next.matchAll(/maxDuration\s*:\s*(\d[\d_]*)/g)) {
      expect(Number(match[1].replace(/_/g, ''))).toBeLessThanOrEqual(HOBBY_MAX_S);
    }
  });
});

describe('maxDuration — les routes lourdes la déclarent', () => {
  // Traitements longs (IA, lots de sessions, agrégats) ou préparation en une passe.
  const HEAVY = [
    'src/app/compas/page.tsx',
    'src/app/api/cron/daily/route.ts',
    'src/app/api/cron/process-ai-jobs/route.ts',
    'src/app/api/cron/refresh-country-guides/route.ts',
    'src/app/api/cron/process-hike-sessions/route.ts',
    'src/app/api/cron/aggregate-segments/route.ts',
    'src/app/api/trip-assistant/route.ts',
    'src/app/api/kit-report/generate/route.ts',
  ];

  it.each(HEAVY)('%s déclare une durée ≤ 300 s', (file) => {
    const seconds = declared(file);
    expect(Number.isFinite(seconds), `${file} ne déclare pas maxDuration`).toBe(true);
    expect(seconds).toBeLessThanOrEqual(HOBBY_MAX_S);
  });
});

describe('maxDuration et CLAIM_MS', () => {
  const page = declared('src/app/compas/page.tsx');

  it('la page Compas, qui héberge la préparation, déclare la durée maximale Hobby', () => {
    expect(page).toBe(HOBBY_MAX_S);
  });

  it('une prise de phase ne survit pas à la fonction qui la tient (CLAIM_MS ≤ durée) et la suit de près (≤ 30 s d’écart)', () => {
    expect(CLAIM_MS).toBeLessThanOrEqual(page * 1000);
    expect(page * 1000 - CLAIM_MS).toBeLessThanOrEqual(30_000);
  });

  it('seule la page Compas héberge les actions de préparation (donc seule sa durée compte)', () => {
    const importers: string[] = [];
    for (const file of sourceFiles(path.join(ROOT, 'src'))) {
      if (/features\/compas\/server\//.test(rel(file))) continue;
      if (/from\s+['"][^'"]*autofillActions['"]/.test(readFileSync(file, 'utf8'))) importers.push(rel(file));
    }
    expect(importers.length).toBeGreaterThan(0);
    for (const file of importers) expect(file).toMatch(/^src\/features\/compas\/components\//);

    const hosts: string[] = [];
    for (const file of sourceFiles(path.join(ROOT, 'src'))) {
      if (!/^src\/app\//.test(rel(file))) continue;
      if (/components\/CompasScreen['"]/.test(readFileSync(file, 'utf8'))) hosts.push(rel(file));
    }
    expect(hosts).toEqual(['src/app/compas/page.tsx']);
  });
});
