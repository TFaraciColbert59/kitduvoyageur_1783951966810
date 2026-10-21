import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Garde d'animation (PLAN-100 phase 8) : le Compas n'anime que `transform` et `opacity`
 * (GPU, 60 fps) et chaque animation a une sortie sous `prefers-reduced-motion: reduce`.
 */
const css = ['compas.css', 'motion.css']
  .map((f) => readFileSync(join(process.cwd(), 'src/features/compas', f), 'utf8'))
  .join('\n')
  .replace(
  /\/\*[\s\S]*?\*\//g,
  ''
);

function keyframes(): Array<{ name: string; props: Set<string> }> {
  const out: Array<{ name: string; props: Set<string> }> = [];
  const re = /@keyframes\s+([\w-]+)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    let depth = 1;
    let i = re.lastIndex;
    const start = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      if (css[i] === '}') depth -= 1;
      i += 1;
    }
    const body = css.slice(start, i - 1);
    const props = new Set<string>();
    for (const d of body.matchAll(/([a-z-]+)\s*:/g)) props.add(d[1]);
    out.push({ name: m[1], props });
  }
  return out;
}

function reducedMotionBlocks(): string {
  const parts: string[] = [];
  const re = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    let depth = 1;
    let i = re.lastIndex;
    const start = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      if (css[i] === '}') depth -= 1;
      i += 1;
    }
    parts.push(css.slice(start, i - 1));
  }
  return parts.join('\n');
}

describe('animations du Compas', () => {
  const ALLOWED = new Set(['transform', 'opacity', 'animation-timing-function']);
  it('chaque @keyframes ne touche que transform et opacité', () => {
    const bad = keyframes()
      .map((k) => ({ name: k.name, extra: [...k.props].filter((p) => !ALLOWED.has(p)) }))
      .filter((k) => k.extra.length > 0);
    expect(bad).toEqual([]);
  });
  it('chaque animation nommée est coupée sous prefers-reduced-motion', () => {
    const reduced = reducedMotionBlocks();
    // une animation posée seulement sous `no-preference` n'existe pas en mouvement réduit
    const gated = css.replace(/@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{[\s\S]*?\n\}/g, '');
    const users = [...gated.matchAll(/([^{}]+)\{[^{}]*animation:\s*(cp-[\w-]+)/g)];
    expect(users.length).toBeGreaterThan(0);
    const uncovered = users
      .map((u) => u[1].trim().split(',').pop()!.trim())
      .filter((sel) => !reduced.includes(sel));
    expect(uncovered).toEqual([]);
  });
});
