import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '../../../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const tokens = read('styles/tokens.css');
const shared = read('styles/communaute-v2.css');
const shell = read('styles/communaute-v2-shell.css');
const create = read('features/community/v2/create/create-v2.css');

function rule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return '';
  return css.slice(start, css.indexOf('}', start) + 1);
}

describe('finition — contraste, cibles, ombre, fidélité du tiroir', () => {
  it('l’ombre de l’île est à base d’encre (jamais rgba(0,0,0))', () => {
    const line = tokens.split('\n').find((entry) => entry.includes('--cv2-island-shadow:')) ?? '';
    expect(line).toContain('rgba(11, 31, 23');
    expect(line).not.toContain('rgba(0, 0, 0');
  });

  it('les libellés portent une plaque claire (AA sur fond sombre du verre)', () => {
    expect(tokens).toContain('--cv2-label-plate:');
    expect(shared).toMatch(/\.lkdv-cv2-sheet \.lkdv-cv2-field-label,\s*\.lkdv-cv2-sheet \.lkdv-cv2-eyebrow \{[^}]*background: var\(--cv2-label-plate\)/);
  });

  it('le focus clavier ne force aucun rayon dans le tiroir (N12)', () => {
    const block = rule(shell, '.lkdv-cv2-sheet :focus-visible');
    expect(block).toContain('outline: 2px solid');
    expect(block).not.toContain('border-radius');
  });

  it('segments, lien secondaire, « + » et tri portent une zone tactile de 44 px', () => {
    expect(shared).toMatch(/\.lkdv-cv2-seg > button::after[\s\S]*?min-width: var\(--lkv-touch-min\);[\s\S]*?min-height: var\(--lkv-touch-min\)/);
    expect(shell).toMatch(/\.lkdv-sort-btn::after \{[^}]*inset: -7px/);
  });

  it('Supprimer un média : cible de 44 × 44 px', () => {
    const block = rule(create, '.lkdv-cv2c-medialist-del');
    expect(block).toContain('width: 44px');
    expect(block).toContain('height: 44px');
  });

  it('coque : tiroir à y = 48, capsule en verre « bar-glass » (flou 7 px)', () => {
    expect(shell).toContain('+ 48px);');
    expect(shell).toContain('--cv2-bar-glass-blur: blur(7px) saturate(1.9) brightness(1.07)');
    expect(shell).toMatch(/\.lkdv-cv2-capsule\.lkdv-capsule \{[^}]*background-image: var\(--cv2-bar-glass-bg\)/);
  });

  it('le volet ne défile jamais à l’horizontale (overflow-x: clip)', () => {
    expect(rule(shell, '.lkdv-cv2-pane')).toContain('overflow-x: clip');
  });

  it('animations des nouveautés : transform et opacity seulement', () => {
    const swipe = rule(create, '.lkdv-cv2c-day-panel');
    expect(swipe).toContain('touch-action: pan-y');
    expect(swipe).not.toMatch(/transition:[^;]*(width|height|margin|left|top)/);
  });
});
