// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
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

describe('PostGlassPanel — gestes', () => {
  afterEach(cleanup);

  it('commentaires : glisser vers la droite ramène à la photo', () => {
    const { onClose, swipe } = setup('comments');
    swipe(80);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('commentaires : glisser vers la gauche ne fait rien (bord)', () => {
    const { onClose, swipe } = setup('comments');
    swipe(-80);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('partage : glisser vers la gauche ramène à la photo', () => {
    const { onClose, swipe } = setup('share');
    swipe(-80);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('le geste reste dans le panneau : la carte ne le relit pas', () => {
    const { onParentDown, swipe } = setup('comments');
    swipe(80);
    expect(onParentDown).not.toHaveBeenCalled();
  });
});
