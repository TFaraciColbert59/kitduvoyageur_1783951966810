import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');
const ALLOWED = new Set([
  join(ROOT, 'components/social-kit/LikeIcon.tsx'),
  // Registre d'icônes animées (même tracé que le cœur lucide).
  join(ROOT, 'components/icons/heart.tsx'),
]);
// Surfaces gelées (Compas) ou de démonstration : hors périmètre.
const SKIP = [join(ROOT, 'features/compas'), join(ROOT, 'components/dev'), join(ROOT, 'app/compas')];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      walk(full, out);
    } else if (/\.tsx$/.test(name)) out.push(full);
  }
  return out;
}

describe('cœur « j’aime » unique', () => {
  const files = walk(ROOT).filter((f) => !ALLOWED.has(f) && !SKIP.some((s) => f.startsWith(s)));

  it('aucun <Heart> lucide direct hors social-kit', () => {
    const offenders = files.filter((f) => /<Heart\b/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('aucun cœur SVG maison (chemin du cœur lucide ou « M12 21.35l-1.45 »)', () => {
    const offenders = files.filter((f) => /M12 21\.35l-1\.45-1\.32|M19 14c1\.49-1\.46/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
