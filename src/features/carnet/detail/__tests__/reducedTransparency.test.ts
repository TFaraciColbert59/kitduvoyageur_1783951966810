import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/*
 * `prefers-reduced-transparency` ne s'émule pas dans Playwright : on garde donc
 * la règle par le CSS lui-même. Garde-fou : toute surface de la fiche carnet qui
 * pose un `backdrop-filter` doit retrouver un fond opaque et pas de flou dans un
 * bloc `@media (prefers-reduced-transparency: reduce)`.
 */

const FILES = ['src/styles/carnet-v2.css', 'src/styles/carnet-v2-lenses.css'].map((f) =>
  readFileSync(resolve(process.cwd(), f), 'utf8')
);

interface Rule {
  selectors: string[];
  body: string;
  atRules: string[];
}

/** Lecteur CSS minimal : règles avec la pile des at-rules qui les contiennent. */
function parse(css: string): Rule[] {
  const rules: Rule[] = [];
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const stack: string[] = [];
  let buffer = '';
  let i = 0;
  const flush = (open: boolean, body = '') => {
    const head = buffer.trim();
    buffer = '';
    if (open) {
      stack.push(head);
      return;
    }
    if (head) {
      rules.push({
        selectors: head.split(',').map((s) => s.trim()),
        body,
        atRules: stack.filter((h) => h.startsWith('@')),
      });
    }
  };
  while (i < clean.length) {
    const ch = clean[i];
    if (ch === '{') {
      const head = buffer.trim();
      if (head.startsWith('@')) {
        flush(true);
        i += 1;
        continue;
      }
      let depth = 1;
      let j = i + 1;
      while (j < clean.length && depth > 0) {
        if (clean[j] === '{') depth += 1;
        else if (clean[j] === '}') depth -= 1;
        j += 1;
      }
      flush(false, clean.slice(i + 1, j - 1));
      i = j;
      continue;
    }
    if (ch === '}') {
      stack.pop();
      buffer = '';
      i += 1;
      continue;
    }
    buffer += ch;
    i += 1;
  }
  return rules;
}

const rules = FILES.flatMap(parse);
const reduced = rules.filter((r) => r.atRules.some((a) => a.includes('prefers-reduced-transparency')));
/** Classe du sujet de la règle : la dernière `.lkdv-*` du sélecteur (l'élément ciblé, pas son ancêtre). */
const baseClass = (selector: string): string | null => {
  const all = [...selector.matchAll(/\.(lkdv-[a-z0-9_-]+)/gi)];
  return all.length > 0 ? all[all.length - 1][1] : null;
};
const reducedText = reduced.map((r) => r.selectors.join(' ')).join(' ');
const blurs = (body: string) => /backdrop-filter\s*:\s*(?!none)[^;]+/i.test(body);

describe('prefers-reduced-transparency (fiche carnet v2)', () => {
  it('le CSS déclare un bloc de repli avec fond opaque et sans flou', () => {
    expect(reduced.length).toBeGreaterThan(0);
    const opaque = reduced.filter(
      (r) => /backdrop-filter\s*:\s*none/i.test(r.body) && /background\s*:\s*var\(--lkv-surface-paper/i.test(r.body)
    );
    expect(opaque.length).toBeGreaterThan(0);
  });

  it('toute surface floutée (backdrop-filter) a son repli opaque', () => {
    const blurred = rules.filter(
      (r) =>
        r.atRules.length === 0 &&
        blurs(r.body) &&
        r.selectors.some((s) => baseClass(s) && !/data-reduce-transparency/.test(s))
    );
    expect(blurred.length).toBeGreaterThan(5);
    const missing = new Set<string>();
    for (const rule of blurred) {
      for (const selector of rule.selectors) {
        const cls = baseClass(selector);
        if (!cls || /data-reduce-transparency/.test(selector)) continue;
        if (!new RegExp(`\\.${cls}(?![a-z0-9_-])`, 'i').test(reducedText)) missing.add(cls);
      }
    }
    expect([...missing].sort()).toEqual([]);
  });
});
