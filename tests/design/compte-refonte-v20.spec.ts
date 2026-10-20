import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

describe('Compte iOS 27 v20 — finitions, gestes et post plein cadre', () => {
  const source = read('src/components/compte/CompteLiquidGlassV8.tsx');
  const runtime = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
  const start = source.indexOf('Compte iOS 27 v20');
  const v20 = source.slice(start, source.indexOf('`;', start));

  it('1. Les drawers ont une marge intérieure et un bas dégagé', () => {
    expect(start).toBeGreaterThan(-1);
    expect(v20).toMatch(/\.phone \.sheet\s*\{[^}]*padding:\s*0 16px calc\(20px \+ env\(safe-area-inset-bottom/);
    expect(v20).toMatch(/\.phone \.sheet \.sh-b\s*\{[^}]*padding:\s*4px 2px 24px/);
  });

  it('2. Ouverture 720 ms et fermeture 560 ms', () => {
    expect(v20).toMatch(/transition:\s*transform \.72s cubic-bezier\(\.16,1,\.3,1\)/);
    expect(runtime).toContain('transform .56s cubic-bezier(.16,1,.3,1)');
    expect(v20).toMatch(/\.sheet\.anim-in \.sh-b > \*\s*\{[^}]*sheetRowIn \.45s/);
  });

  it('3. La grille et les sorties se glissent', () => {
    expect(runtime).toContain('bindIgSwipe');
    expect(runtime).toContain('ig-swipe-view');
    expect(runtime).toContain('SWIPE_MIN');
    expect(v20).toMatch(/@keyframes igSwipeInLeft/);
    expect(v20).toMatch(/@keyframes igSwipeInRight/);
  });

  it('4. Le profil n’a plus de pagination', () => {
    expect(runtime).toMatch(/sh\.k === ['"]step['"][\s\S]{0,300}noFooter/);
  });

  it('5. Le curseur du sélecteur se soulève et suit le doigt', () => {
    expect(v20).toMatch(/\.phone \.sheet \.sel-lens\s*\{[^}]*scale\(1\.16\)/);
    expect(v20).toMatch(/overflow:\s*visible/);
    expect(runtime).toMatch(/press\.i\s*=|nearest/);
    expect(runtime).toContain('pointermove');
  });

  it('6. Le post est une photo plein cadre sans barre de commentaire', () => {
    expect(runtime).not.toContain('pmi-comment-bar');
    expect(runtime).not.toContain('pmi-caption-pill');
    expect(runtime).toContain('pmi-post-actions');
    expect(runtime).toContain('pmi-author');
    expect(v20).toMatch(/\.pmi-media\s*\{[^}]*inset:\s*0/);
    expect(v20).toMatch(/\.pmi-post-btn\s*\{[^}]*width:\s*34px/);
  });

  it('7. Le post ne garde que l’auteur, le menu et les actions', () => {
    const post = runtime.slice(runtime.indexOf('modalEl.innerHTML = `'), runtime.indexOf('const scrollEl = modalEl'));
    expect(post).not.toContain('Empreinte vérifiée');
    expect(post).not.toContain('pmi-comment-bar');
    expect(post).toContain('pmi-author');
    expect(post).toContain('pmi-post-actions');
  });

  it('8. Les commentaires ont la forme Instagram et notre matière', () => {
    const comments = runtime.slice(runtime.indexOf('post_comments: () =>'), runtime.indexOf('note: () =>'));
    expect(comments).toContain('footer:');
    expect(comments).toContain('pmi-comments-list');
    expect(comments).toContain('pmi-comment-composer');
    expect(comments).toContain('submitPostComment');
    expect(v20).toMatch(/\.pmi-comment-row\s*\{/);
  });

  it('9. Le bouton commentaire ouvre le drawer, le post n’a pas de champ', () => {
    const post = runtime.slice(runtime.indexOf('modalEl.innerHTML = `'), runtime.indexOf('const scrollEl = modalEl'));
    expect(post).toContain('openPostComments');
    expect(post).not.toContain('pmi_comment_input');
    expect(post).not.toContain('submitComment');
  });

  it('10. Invariant /compas', () => {
    expect(execSync('git diff --name-only origin/main -- src/app/compas src/features/compas', { encoding: 'utf8' }).trim()).toBe('');
    expect(execSync('git status --porcelain -- src/app/compas src/features/compas', { encoding: 'utf8' }).trim()).toBe('');
  });
});
