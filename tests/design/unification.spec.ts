import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * CHANTIER U — GARDE-FOUS DE GOUVERNANCE (U-D60 → U-D64)
 *
 * Chaque règle du DESIGN_SYSTEM est transformée en test. Ces tests doivent
 * être ROUGES sur l'état initial (la gouvernance n'était pas appliquée),
 * puis VERTS et maintenus verts.
 *
 * - U-D60 : aucune couleur hexadécimale hors `src/styles/tokens.css`
 * - U-D61 : aucune classe froide (zinc/gray/slate/amber/emerald/blue)
 * - U-D62 : aucun rayon `rounded-[Npx]` / ombre `shadow-[...]` littéral hors primitives
 * - U-D63 : aucun dialogue natif (alert/confirm/prompt)
 * - U-D64 : aucune variable CSS déclarée dans 2+ fichiers de style
 */

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const STYLE_FILES = [
  'src/styles/tokens.css',
  'src/styles/liquid-glass.css',
  'src/styles/tailwind.css',
  'src/app/pays/styles/country.css',
  'src/app/pays/styles/earth.css',
  'src/design/tokens.ts',
];
const TOKENS_CSS = 'src/styles/tokens.css';
// Primitives : composants UI canoniques — seuls autorisés à porter
// rayons/ombres littéraux.
const PRIMITIVES_DIR = 'src/components/ui';

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) acc = walk(full, acc);
    else if (/\.(tsx|ts|css|mjs|js)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

function isPrimitive(file: string): boolean {
  return file.startsWith(join(SRC, 'components', 'ui')) || file.startsWith('src/components/ui');
}

function countHex(file: string): number {
  const src = readFileSync(file, 'utf8');
  return (src.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []).length;
}

function coldClasses(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const blob = /className\s*=\s*(?:"([^"]*)"|`([^`]*)`|'([^']*)')/g;
  let cm: RegExpExecArray | null;
  const hits: string[] = [];
  while ((cm = blob.exec(src))) {
    const cls = cm[1] ?? cm[2] ?? cm[3] ?? '';
    const cold = /(?:^|\s)(?:text|bg|border|ring|from|to|via|divide|fill|stroke|outline|accent|shadow)-(zinc|gray|slate|amber|emerald|blue)-(\d{2,3}|\[[^\]]+\])(?=\s|["'`]|$)/g;
    let m: RegExpExecArray | null;
    while ((m = cold.exec(cls))) hits.push(`${file}: ${m[0].trim()}`);
  }
  return hits;
}

function literalRadiusOrShadow(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const hits: string[] = [];
  for (const re of [/rounded-\[\d+px\]/g, /shadow-\[[^\]]+\]/g]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) hits.push(`${file}: ${m[0]}`);
  }
  return hits;
}

function nativeDialog(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const hits: string[] = [];
  const re = /(?:window\.)?(?:alert|confirm|prompt)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    // Ignore les définitions de fonctions (ex: `function confirm(...)`).
    const before = src.slice(Math.max(0, m.index - 12), m.index);
    if (!/(function|=>|\bconst\b|\blet\b|\bvar\b)\s*$/.test(before)) {
      hits.push(`${file}: ${m[0]}`);
    }
  }
  return hits;
}

function duplicateVars(): { var: string; files: string[] }[] {
  const declared = new Map<string, Set<string>>();
  for (const f of STYLE_FILES) {
    if (!exists(f)) continue;
    const src = readFileSync(f, 'utf8');
    const re = /(--[\w-]+)\s*:/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      if (!declared.has(m[1])) declared.set(m[1], new Set());
      declared.get(m[1])!.add(f);
    }
  }
  const dup: { var: string; files: string[] }[] = [];
  for (const [v, files] of declared) {
    if (files.size > 1) dup.push({ var: v, files: [...files] });
  }
  return dup;
}

function exists(p: string): boolean {
  try { return statSync(p).isFile(); } catch { return false; }
}

describe('CHANTIER U — GARDE-FOUS DE GOUVERNANCE', () => {
  const files = walk(SRC)
    .filter((f) => !f.includes('__tests__'))
    .map((f) => f.replace(ROOT + '/', ''))
    .filter((f) => !/(\.next|node_modules|\.d\.ts)/.test(f));

  it('U-D60 : aucune couleur hexadécimale hors tokens.css', () => {
    const bad = files
      .filter((f) => f !== TOKENS_CSS)
      .filter((f) => countHex(f) > 0)
      .map((f) => `${f} (${countHex(f)} hex)`);
    expect(bad, `Hex hors tokens.css dans:\n${bad.join('\n')}`).toEqual([]);
  });

  it('U-D61 : aucune classe froide zinc/gray/slate/amber/emerald/blue', () => {
    const bad: string[] = [];
    for (const f of files) bad.push(...coldClasses(f));
    expect(bad, `Classes froides dans:\n${bad.join('\n')}`).toEqual([]);
  });

  it('U-D62 : aucun rayon/ombre littéral hors primitives', () => {
    const bad: string[] = [];
    for (const f of files) {
      if (isPrimitive(f)) continue;
      bad.push(...literalRadiusOrShadow(f));
    }
    expect(bad, `Rayons/ombres littéraux dans:\n${bad.join('\n')}`).toEqual([]);
  });

  it('U-D63 : aucun dialogue natif (alert/confirm/prompt)', () => {
    const bad: string[] = [];
    for (const f of files) if (!isPrimitive(f)) bad.push(...nativeDialog(f));
    expect(bad, `Dialogues natifs dans:\n${bad.join('\n')}`).toEqual([]);
  });

  it('U-D64 : aucune variable CSS déclarée dans 2+ fichiers de style', () => {
    const dup = duplicateVars();
    const label = dup.map((d) => `${d.var} → ${d.files.join(', ')}`).join('\n');
    expect(dup, `Variables dupliquées:\n${label}`).toEqual([]);
  });
});

export {};