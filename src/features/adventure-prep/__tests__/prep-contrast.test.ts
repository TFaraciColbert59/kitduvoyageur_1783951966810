import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'adventure-prep.css'),
  'utf8',
);

interface Rule {
  selector: string;
  body: string;
}

function prepRules(): Rule[] {
  return [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .map((m) => ({ selector: m[1].trim(), body: m[2] }))
    .filter((r) => r.selector.split(',').every((s) => s.startsWith('.prep-')));
}

function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of body.split(';')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    out.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
  }
  return out;
}

describe('les surfaces du preparateur restent lisibles en theme sombre', () => {
  it('aucune surface trainant de blanc ne porte un texte blanc', () => {
    // Regression mesuree en navigateur : la note melangeait sa surface avec
    // #fff alors que le texte restait blanc (theme sombre) -> ratio ~1.05,
    // texte invisible. Une surface claire impose une encre foncee.
    const offenders = prepRules()
      .filter(({ body }) => {
        const d = declarations(body);
        const bg = d.get('background-color') ?? d.get('background') ?? '';
        const color = d.get('color') ?? '';
        return bg.includes('#fff') && /^var\(--lkv-text-/.test(color);
      })
      .map((r) => r.selector);
    expect(offenders).toEqual([]);
  });

  it('la note ne melange pas sa surface avec du blanc', () => {
    const note = prepRules().find((r) => r.selector === '.prep-note');
    expect(note?.body ?? '').not.toMatch(/#fff/);
  });

  it("la note d'avertissement ne melange pas sa surface avec du blanc", () => {
    const warn = prepRules().find((r) => r.selector === ".prep-note[data-tone='warn']");
    expect(warn?.body ?? '').not.toMatch(/#fff/);
  });
});
