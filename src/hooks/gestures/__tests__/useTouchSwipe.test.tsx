// @vitest-environment jsdom
import React, { useRef } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTouchSwipe, type TouchSwipeOptions } from '../useTouchSwipe';

afterEach(() => cleanup());

function Surface(props: TouchSwipeOptions) {
  const ref = useRef<HTMLDivElement | null>(null);
  useTouchSwipe(ref, props);
  return (
    <div ref={ref} data-testid="surface">
      <button type="button" data-testid="btn">bouton</button>
      <input data-testid="field" />
    </div>
  );
}

/** Événement touch brut (aucun événement pointer : cas iOS où pointercancel coupe le geste). */
function touch(el: Element, type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel', x: number, y: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const point = { clientX: x, clientY: y, identifier: 1, target: el };
  Object.defineProperty(event, 'touches', { value: type === 'touchend' || type === 'touchcancel' ? [] : [point] });
  Object.defineProperty(event, 'changedTouches', { value: [point] });
  el.dispatchEvent(event);
}

/** Geste de pouce : départ, plusieurs déplacements avec dérive verticale, relâchement. */
function swipe(el: Element, from: [number, number], to: [number, number], drift = 0) {
  touch(el, 'touchstart', from[0], from[1]);
  for (let i = 1; i <= 8; i += 1) {
    const t = i / 8;
    touch(el, 'touchmove', from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t + Math.sin(t * Math.PI) * drift);
  }
  touch(el, 'touchend', to[0], to[1]);
}

describe('useTouchSwipe — balayage tactile fiable sur iPhone', () => {
  it('balayage à gauche et à droite, même avec une forte dérive verticale du pouce', () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const { getByTestId } = render(<Surface onSwipeLeft={onSwipeLeft} onSwipeRight={onSwipeRight} />);
    const surface = getByTestId('surface');
    swipe(surface, [300, 200], [100, 215], 40);
    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    swipe(surface, [100, 200], [300, 190], 40);
    expect(onSwipeRight).toHaveBeenCalledTimes(1);
  });

  it('un seul déclenchement par doigt posé', () => {
    const onSwipeLeft = vi.fn();
    const { getByTestId } = render(<Surface onSwipeLeft={onSwipeLeft} />);
    swipe(getByTestId('surface'), [380, 200], [20, 200]);
    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
  });

  it('un geste sous le seuil (30 px) ne déclenche rien', () => {
    const onSwipeLeft = vi.fn();
    const { getByTestId } = render(<Surface onSwipeLeft={onSwipeLeft} />);
    swipe(getByTestId('surface'), [200, 200], [170, 200]);
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('glissement vers le bas : ferme au-delà de 80 px et plus vertical qu\'horizontal', () => {
    const onSwipeDown = vi.fn();
    const { getByTestId } = render(<Surface onSwipeDown={onSwipeDown} />);
    swipe(getByTestId('surface'), [200, 100], [215, 260]);
    expect(onSwipeDown).toHaveBeenCalledTimes(1);
  });

  it('un geste surtout diagonal n\'est ni un balayage ni une fermeture', () => {
    const onSwipeLeft = vi.fn();
    const onSwipeDown = vi.fn();
    const { getByTestId } = render(<Surface onSwipeLeft={onSwipeLeft} onSwipeDown={onSwipeDown} />);
    swipe(getByTestId('surface'), [300, 100], [180, 220]);
    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeDown).not.toHaveBeenCalled();
  });

  it('le balayage peut démarrer sur un bouton ; un champ de saisie est ignoré', () => {
    const onSwipeLeft = vi.fn();
    const ignore = (target: EventTarget | null) => Boolean((target as HTMLElement | null)?.closest?.('input'));
    const { getByTestId } = render(<Surface onSwipeLeft={onSwipeLeft} ignore={ignore} />);
    swipe(getByTestId('btn'), [300, 200], [100, 200]);
    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    swipe(getByTestId('field'), [300, 200], [100, 200]);
    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
  });

  it('désactivé : aucun geste suivi ; touchcancel oublie le doigt', () => {
    const onSwipeLeft = vi.fn();
    const { getByTestId, rerender } = render(<Surface onSwipeLeft={onSwipeLeft} enabled={false} />);
    swipe(getByTestId('surface'), [300, 200], [100, 200]);
    expect(onSwipeLeft).not.toHaveBeenCalled();
    rerender(<Surface onSwipeLeft={onSwipeLeft} />);
    const s = getByTestId('surface');
    touch(s, 'touchstart', 300, 200);
    touch(s, 'touchcancel', 300, 200);
    touch(s, 'touchmove', 100, 200);
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });
});
