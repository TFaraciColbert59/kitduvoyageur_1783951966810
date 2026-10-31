import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('socle de post partagé', () => {
  it('utilise le fond et le verre exacts du Compte', () => {
    const css = read('src/features/posts/ui/post-system.css');
    expect(css).toContain('--account-canvas-image');
    expect(css).toContain('account-bg.webp');
    expect(css).toContain('rgba(255, 255, 255, 0.486)');
    expect(css).toContain('rgba(255, 255, 255, 0.384)');
    expect(css).toContain('blur(25.2px) saturate(1.8) brightness(1.05)');
    expect(css).toContain('top: var(--post-panel-top, 64px)');
  });

  it('mesure le header et commence 8 px sous lui', () => {
    const panel = read('src/features/posts/ui/PostGlassPanel.tsx');
    expect(panel).toContain('headerRect.bottom - articleRect.top + 8');
    expect(panel).toContain('--post-panel-top');
    // Partage ← photo → commentaires : le geste inverse ramène à la photo.
    expect(panel).toContain("const towardPhoto = side === 'comments' ? dx > 0 : dx < 0;");
  });

  it('le fil garde le header au-dessus du panneau', () => {
    const post = read('src/features/community/feed/CommunityFeedPost.tsx');
    expect(post).toContain('PostGlassPanel');
    expect(post).toContain('headerRef');
    expect(post).toContain('className="lkdv-feed-post-top"');
    const css = read('src/styles/community-feed.css');
    expect(css).toContain('.lkdv-feed-header');
    expect(css).toContain('background: transparent !important');
  });

  it('le post Compte reprend la même feuille de verre', () => {
    const drawer = read('src/components/compte/overlay/PostSheet.tsx');
    expect(drawer).toContain('lkdv-post-glass-sheet');
    const css = read('src/features/posts/ui/post-system.css');
    expect(css).toContain('.lkdv-post-glass-sheet');
  });
});
