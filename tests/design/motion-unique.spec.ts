import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');
// Hub et Compas : hors périmètre. tokens.css / tailwind.css : définitions des jetons.
const SKIP = /features\/hub|components\/hub|app\/hub|features\/compas|app\/compas|lib\/hub|\/dev\/|__tests__|\.test\.|\.spec\.|styles\/tokens\.css|styles\/tailwind\.css/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|css|js)$/.test(name) && !/\.d\.ts$/.test(name)) out.push(full);
  }
  return out;
}
const files = walk(ROOT).filter((f) => !SKIP.test(f));
const rel = (f: string) => f.replace(`${ROOT}/`, 'src/');

describe('mouvement : une seule source', () => {
  it('aucune courbe cubic-bezier écrite à la main (jetons de tokens.css)', () => {
    const offenders = files.filter((f) => /cubic-bezier\(/.test(readFileSync(f, 'utf8'))).map(rel);
    expect(offenders).toEqual([]);
  });

  it('les jetons de mouvement existent dans tokens.css', () => {
    const css = readFileSync(join(ROOT, 'styles/tokens.css'), 'utf8');
    for (const token of ['--motion-ease-standard', '--ease-glass', '--ease-spring', '--lkv-ease', '--motion-ease-accelerate', '--dur-fast', '--dur-med', '--dur-slow']) {
      expect(css).toContain(`${token}:`);
    }
  });
});

describe('gestes : une seule source des seuils', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
  const GESTURE_FILES = [
    'src/features/community/feed/CommunityFeedPost.tsx',
    'src/features/community/feed/CommunityPostMedia.tsx',
    'src/features/posts/ui/PostGlassPanel.tsx',
    'src/components/compte/overlay/PostSheet.tsx',
    'src/components/communaute/StoriesViewer.tsx',
    'src/components/compte/drawer/LensPager.tsx',
    'src/components/carnet/profile/CarnetPages.tsx',
    'src/features/community/reels/FreedomReelItem.tsx',
  ];

  it('posts, panneau, feuille, lentilles, carnet et reels importent leurs seuils de hooks/gestures', () => {
    for (const file of GESTURE_FILES) expect(read(file), file).toContain("from '@/hooks/gestures'");
  });

  it('aucun seuil de balayage / fermeture littéral dans ces fichiers', () => {
    for (const file of GESTURE_FILES) {
      const src = read(file);
      expect(src, `${file} : seuil de balayage`).not.toMatch(/Math\.abs\(dx\)\s*[<>]\s*\d+/);
      expect(src, `${file} : seuil de fermeture`).not.toMatch(/\bdy\s*>\s*(60|70|80|110)\b/);
      expect(src, `${file} : sortie animée`).not.toMatch(/setTimeout\([^)]*,\s*(190|260|300)\)/);
    }
  });
});
