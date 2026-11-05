import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COLORWAYS } from '../domain/catalog';
import { MATERIAL_TOKENS, RAW_MATERIALS, colorwaySwatch, resolveMaterial, type MaterialKey } from '../domain/palette';

const KEYS = Object.keys(RAW_MATERIALS) as MaterialKey[];

describe('resolveMaterial', () => {
  it('résout chaque MaterialKey sans readVar', () => {
    for (const k of KEYS) expect(resolveMaterial(k)).toBe(RAW_MATERIALS[k]);
  });
  it('donne la priorité à readVar quand le token existe et est non vide', () => {
    const k = Object.keys(MATERIAL_TOKENS)[0] as MaterialKey;
    const token = MATERIAL_TOKENS[k] as string;
    expect(resolveMaterial(k, (n) => (n === token ? ' #123456 ' : undefined))).toBe('#123456');
  });
  it('retombe sur la valeur brute si readVar renvoie vide ou undefined', () => {
    const k = Object.keys(MATERIAL_TOKENS)[0] as MaterialKey;
    expect(resolveMaterial(k, () => '')).toBe(RAW_MATERIALS[k]);
    expect(resolveMaterial(k, () => undefined)).toBe(RAW_MATERIALS[k]);
  });
  it('ignore readVar pour une matière sans token', () => {
    const k = KEYS.find((x) => !(x in MATERIAL_TOKENS)) as MaterialKey;
    expect(k).toBeDefined();
    expect(resolveMaterial(k, () => '#000001')).toBe(RAW_MATERIALS[k]);
  });
  it('ne référence que des tokens --lkv-*', () => {
    for (const t of Object.values(MATERIAL_TOKENS)) expect(t).toMatch(/^--lkv-[a-z0-9-]+$/);
  });
});

describe('colorwaySwatch', () => {
  it('résout body/pocket/trim/accent de chaque coloris', () => {
    for (const cw of Object.values(COLORWAYS)) {
      expect(colorwaySwatch(cw)).toEqual({
        body: RAW_MATERIALS[cw.body],
        pocket: RAW_MATERIALS[cw.pocket],
        trim: RAW_MATERIALS[cw.trim],
        accent: RAW_MATERIALS[cw.accent],
      });
    }
  });
});

describe('aucune couleur littérale hors palette', () => {
  const ROOT = fileURLToPath(new URL('../../../', import.meta.url)); // src/
  const dirs = [join(ROOT, 'features/kit-studio'), join(ROOT, 'app/kit-studio')];
  const walk = (d: string): string[] =>
    !existsSync(d)
      ? []
      : readdirSync(d).flatMap((n) => {
          const p = join(d, n);
          return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|css)$/.test(n) ? [p] : [];
        });
  it('pas de #hex ni rgba(0,0,0', () => {
    const bad: string[] = [];
    for (const f of dirs.flatMap(walk)) {
      const rel = relative(ROOT, f).split(sep).join('/');
      if (rel.includes('/__tests__/')) continue;
      if (/\/domain\/palette[^/]*\.ts$/.test(rel)) continue;
      const src = readFileSync(f, 'utf8');
      if (/#[0-9a-fA-F]{3,8}\b/.test(src) || /rgba\(\s*0\s*,\s*0\s*,\s*0/.test(src)) bad.push(rel);
    }
    expect(bad).toEqual([]);
  });
});
