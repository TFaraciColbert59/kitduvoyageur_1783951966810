// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PostGlassPanel } from '../PostGlassPanel';

// jsdom n'a pas PointerEvent : un MouseEvent porte clientX/clientY.
if (typeof window !== 'undefined' && !('PointerEvent' in window)) {
  (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = class extends MouseEvent {};
}

/**
 * Gestes du panneau d'un post : partage ← photo → commentaires.
 * Régression : un glissement dans le panneau basculait vers l'autre panneau
 * au lieu de revenir à la photo, et la carte relisait le même geste.
 */
function setup(side: 'comments' | 'share') {
  const onClose = vi.fn();
  const onParentDown = vi.fn();
  const utils = render(
    <div onPointerDown={onParentDown}>
      <PostGlassPanel side={side} onClose={onClose}>
        <div style={{ height: 200 }}>contenu</div>
      </PostGlassPanel>
    </div>,
  );
  const slot = utils.container.querySelector('.lkdv-post-panel-slot') as HTMLElement;
  const swipe = (dx: number) => {
    fireEvent.pointerDown(slot, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(slot, { clientX: 100 + dx, clientY: 102 });
    fireEvent.pointerUp(slot, { clientX: 100 + dx, clientY: 102 });
  };
  return { onClose, onParentDown, swipe };
}

/** La fermeture est animée (260 ms) : on laisse la sortie se jouer avant d'asserter. */
const finishExit = () => act(() => { vi.advanceTimersByTime(300); });

describe('PostGlassPanel — gestes', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('commentaires : glisser vers la gauche ramène à la photo', () => {
    const { onClose, swipe } = setup('comments');
    swipe(-80);
    finishExit();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('commentaires : glisser vers la droite ne fait rien', () => {
    const { onClose, swipe } = setup('comments');
    swipe(80);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('partage : glisser vers la gauche ramène à la photo', () => {
    const { onClose, swipe } = setup('share');
    swipe(-80);
    finishExit();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('le geste reste dans le panneau : la carte ne le relit pas', () => {
    const { onParentDown, swipe } = setup('comments');
    swipe(-80);
    expect(onParentDown).not.toHaveBeenCalled();
  });

  it('régression iPhone : un balayage qui démarre sur un bouton (liste de partage) ramène à la photo', () => {
    const onClose = vi.fn();
    const onRowClick = vi.fn();
    const { container } = render(
      <PostGlassPanel side="share" onClose={onClose}>
        <button type="button" onClick={onRowClick}>Envoyer à Léa</button>
      </PostGlassPanel>,
    );
    const button = container.querySelector('button') as HTMLElement;
    fireEvent.pointerDown(button, { clientX: 300, clientY: 100 });
    fireEvent.pointerMove(button, { clientX: 220, clientY: 102 });
    fireEvent.pointerUp(button, { clientX: 220, clientY: 102 });
    finishExit();
    expect(onClose).toHaveBeenCalledTimes(1);
    // Le clic qui suit le relâchement ne doit pas envoyer le message.
    fireEvent.click(button);
    expect(onRowClick).not.toHaveBeenCalled();
    // Le clic suivant (vrai tap) fonctionne de nouveau.
    fireEvent.pointerDown(button, { clientX: 300, clientY: 100 });
    fireEvent.pointerUp(button, { clientX: 300, clientY: 100 });
    fireEvent.click(button);
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it('un champ de saisie garde son geste : pas de balayage depuis le champ', () => {
    const onClose = vi.fn();
    const { container } = render(
      <PostGlassPanel side="comments" onClose={onClose}>
        <input aria-label="Commentaire" />
      </PostGlassPanel>,
    );
    const input = container.querySelector('input') as HTMLElement;
    fireEvent.pointerDown(input, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(input, { clientX: 180, clientY: 102 });
    fireEvent.pointerUp(input, { clientX: 180, clientY: 102 });
    finishExit();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('le panneau réserve le geste horizontal (touch-action pan-y)', () => {
    const css = readFileSync(join(process.cwd(), 'src/components/social-kit/social-kit.css'), 'utf8');
    expect(css).toMatch(/\.lkdv-post-panel-slot,\s*\.lkdv-post-panel-slot \*\s*\{\s*touch-action:\s*pan-y;/);
  });

  describe('tactile (événements touch, cas iPhone où pointercancel coupe le geste)', () => {
    function touch(el: Element, type: string, x: number, y: number) {
      const event = new Event(type, { bubbles: true, cancelable: true });
      const point = { clientX: x, clientY: y, identifier: 1, target: el };
      Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : [point] });
      Object.defineProperty(event, 'changedTouches', { value: [point] });
      el.dispatchEvent(event);
    }
    const swipe = (el: Element, from: [number, number], to: [number, number], drift = 25) => {
      touch(el, 'touchstart', from[0], from[1]);
      for (let i = 1; i <= 8; i += 1) {
        const t = i / 8;
        touch(el, 'touchmove', from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t + Math.sin(t * Math.PI) * drift);
      }
      touch(el, 'touchend', to[0], to[1]);
    };

    it('commentaires : balayage à gauche (avec dérive) ramène à la photo', () => {
      const onClose = vi.fn();
      const { container } = render(<PostGlassPanel side="comments" onClose={onClose}><div className="lkdv-post-panel-body">contenu</div></PostGlassPanel>);
      swipe(container.querySelector('.lkdv-post-panel-body') as Element, [300, 200], [100, 205]);
      finishExit();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('partage : balayage à gauche depuis un bouton ramène à la photo', () => {
      const onClose = vi.fn();
      const { container } = render(<PostGlassPanel side="share" onClose={onClose}><button type="button">Envoyer</button></PostGlassPanel>);
      swipe(container.querySelector('button') as Element, [320, 200], [120, 190]);
      finishExit();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    /* Au doigt, les deux sens ramènent à la photo (onSwipeLeft et onSwipeRight ferment
       tous deux le panneau) : l'ancien test attendait l'inverse et était rouge sur main. */
    it('au doigt, l’autre sens ramène aussi à la photo (commentaires : balayage à droite)', () => {
      const onClose = vi.fn();
      const { container } = render(<PostGlassPanel side="comments" onClose={onClose}><div>contenu</div></PostGlassPanel>);
      swipe(container.querySelector('.lkdv-post-panel-slot > div') as Element, [100, 200], [300, 200]);
      finishExit();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('vers le bas ne ferme plus : la fermeture est exclusivement par balayage à gauche', () => {
      const onClose = vi.fn();
      const { container } = render(<PostGlassPanel side="comments" onClose={onClose}><div className="lkdv-post-panel-body">liste</div></PostGlassPanel>);
      const body = container.querySelector('.lkdv-post-panel-body') as HTMLElement;
      Object.defineProperty(body, 'scrollTop', { value: 0, configurable: true });
      swipe(body, [200, 100], [205, 280], 0);
      finishExit();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  it('partage : le panneau commence sous la pastille de l\'auteur', () => {
    const css = readFileSync(join(process.cwd(), 'src/components/social-kit/social-kit.css'), 'utf8');
    expect(css).toMatch(/\.lkdv-post-panel-slot\[data-side="share"\] \.lkdv-post-panel\s*\{[^}]*padding-top:\s*var\(--post-panel-top, 64px\)/);
  });

  describe('commentaires : corps plein cadre sous la pastille, barre de verre flottante', () => {
    const css = readFileSync(join(process.cwd(), 'src/features/posts/ui/post-system.css'), 'utf8');
    const block = (selector: RegExp) => css.match(new RegExp(selector.source + '\\s*\\{([^}]*)\\}'))?.[1] ?? '';

    it('le corps défile sur toute la hauteur (inset 0) avec marge haute = pastille et marge basse = barre', () => {
      const body = block(/\.lkdv-post-panel :is\(\.lkdv-post-panel-body, \.freedom-drawer-content\)/);
      expect(body).toMatch(/position:\s*absolute/);
      expect(body).toMatch(/inset:\s*0/);
      expect(body).toMatch(/padding-top:\s*var\(--post-panel-top, 64px\)/);
      expect(body).toMatch(/padding-bottom:\s*calc\(var\(--post-dock-h, 48px\) \+ var\(--post-dock-bottom\) \+ 12px\)/);
      expect(body).toMatch(/scroll-padding-bottom:/);
    });

    it('le pied est posé par-dessus (absolute, bas, sans border-top) et la capsule est en verre', () => {
      const dock = block(/\.lkdv-post-panel :is\(\.freedom-comments-dock, \.lkdv-post-panel-foot, \.lkdv-comments-gate\)/);
      expect(dock).toMatch(/position:\s*absolute/);
      expect(dock).toMatch(/bottom:\s*var\(--post-dock-bottom\)/);
      expect(dock).toMatch(/border:\s*0/);
      const capsule = block(/\.lkdv-post-panel :is\(\.freedom-comments-composer, \.lkdv-comments-composer\)/);
      expect(capsule).toMatch(/border-radius:\s*9999px/);
      expect(capsule).toMatch(/backdrop-filter:\s*var\(--post-dock-glass-blur\)/);
      expect(css).toMatch(/--bar-glass-bg,/);
      expect(css).toMatch(/prefers-reduced-transparency: reduce/);
    });

    it('le style des réponses de story n\'est pas touché (sélecteurs limités au panneau de post)', () => {
      const added = css.slice(css.lastIndexOf('/*', css.indexOf("Commentaires d'un post"))).replace(/\/\*[\s\S]*?\*\//g, '');
      expect(added).not.toMatch(/story/);
      expect(added).not.toMatch(/^\.lkdv-comments-composer/m);
    });
  });
});
