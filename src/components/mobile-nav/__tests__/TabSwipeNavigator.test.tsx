// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';

const nav = vi.hoisted(() => ({ pathname: '/communaute', push: vi.fn(), prefetch: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push, prefetch: nav.prefetch }),
}));

import TabSwipeNavigator from '../TabSwipeNavigator';

/** jsdom n'a pas de Touch : un Event porte la liste `touches` lue par le geste. */
function touch(target: Element, type: string, x: number, y: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const points = type === 'touchend' ? [] : [{ clientX: x, clientY: y }];
  Object.defineProperty(event, 'touches', { value: points });
  target.dispatchEvent(event);
  return event;
}

function swipe(target: Element, dx: number, dy = 0) {
  touch(target, 'touchstart', 200, 300);
  const steps = 8;
  for (let i = 1; i <= steps; i += 1) touch(target, 'touchmove', 200 + (dx * i) / steps, 300 + (dy * i) / steps);
  touch(target, 'touchend', 200 + dx, 300 + dy);
  act(() => {
    vi.advanceTimersByTime(400);
  });
}

function mount() {
  const utils = render(
    <>
      <TabSwipeNavigator />
      <div data-page-root="">
        <p id="free">contenu</p>
        <div data-no-tab-swipe="">
          <p id="owned">carrousel</p>
        </div>
      </div>
    </>,
  );
  const page = utils.container.querySelector('[data-page-root]') as HTMLElement;
  return {
    page,
    free: utils.container.querySelector('#free') as HTMLElement,
    owned: utils.container.querySelector('#owned') as HTMLElement,
  };
}

describe('TabSwipeNavigator — passage d’onglet au doigt', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    nav.pathname = '/communaute';
    nav.push.mockReset();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    document.querySelectorAll('.lkdv-tab-swipe-card').forEach((card) => card.remove());
  });

  it('glisser vers la droite ouvre l’onglet de gauche', () => {
    const { free } = mount();
    swipe(free, 220);
    expect(nav.push).toHaveBeenCalledWith('/explorer');
  });

  it('glisser vers la gauche ouvre l’onglet de droite', () => {
    const { free } = mount();
    swipe(free, -220);
    expect(nav.push).toHaveBeenCalledWith('/messagerie');
  });

  it('la page suit le doigt en carte arrondie pendant le geste', () => {
    const { free, page } = mount();
    touch(free, 'touchstart', 200, 300);
    touch(free, 'touchmove', 230, 301);
    touch(free, 'touchmove', 290, 302);
    expect(page.style.transform).toBe('translate3d(90px, 0, 0)');
    expect(page.style.clipPath).toContain('round');
    expect(document.querySelector('.lkdv-tab-swipe-card')).not.toBeNull();
  });

  it('un petit glissement revient sans changer de page', () => {
    const { free, page } = mount();
    swipe(free, 25);
    expect(nav.push).not.toHaveBeenCalled();
    expect(page.style.transform).toBe('');
    expect(document.querySelector('.lkdv-tab-swipe-card')).toBeNull();
  });

  it('un geste vertical reste au défilement', () => {
    const { free } = mount();
    swipe(free, 40, 220);
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('ne prend jamais le geste d’un élément qui a le sien', () => {
    const { owned } = mount();
    swipe(owned, 220);
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('premier onglet : aucune page à gauche, la carte revient', () => {
    nav.pathname = '/hub';
    const { free } = mount();
    swipe(free, 220);
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('hors des pages racines des onglets, rien ne bouge', () => {
    nav.pathname = '/communaute/club/abc';
    const { free, page } = mount();
    swipe(free, 220);
    expect(nav.push).not.toHaveBeenCalled();
    expect(page.style.transform).toBe('');
  });
});
