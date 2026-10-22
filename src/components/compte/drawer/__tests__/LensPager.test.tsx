// @vitest-environment jsdom
import React, { useRef, useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LensPager } from '../LensPager';

/**
 * jsdom n'implémente pas PointerEvent : polyfill minimal pour piloter les
 * coordonnées et `pointerId` du swipe.
 */
class PointerEventPolyfill extends window.MouseEvent {
  pointerId: number;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
  }
}

function Harness({ count = 3 }: { count?: number }) {
  const [index, setIndex] = useState(0);
  const flowRef = useRef<HTMLDivElement>(null);
  return (
    <div>
      <div className="flow" role="tablist" ref={flowRef} aria-label="Lentilles test">
        <span className="sel-lens" aria-hidden="true" />
        {Array.from({ length: count }, (_, lensIndex) => (
          <button
            key={lensIndex}
            type="button"
            role="tab"
            aria-selected={lensIndex === index}
            className={lensIndex === index ? 'cur' : ''}
          >
            Lentille {lensIndex}
          </button>
        ))}
      </div>
      <LensPager
        index={index}
        count={count}
        onIndexChange={setIndex}
        flowRef={flowRef}
        label="Piste de test"
      >
        {Array.from({ length: count }, (_, lensIndex) => (
          <div key={lensIndex}>Pane {lensIndex}</div>
        ))}
      </LensPager>
    </div>
  );
}

function ScrollHarness() {
  const [index, setIndex] = useState(0);
  return (
    <LensPager index={index} count={3} onIndexChange={setIndex} label="Piste avec scroller">
      <div>
        <div data-hscroll="true" data-testid="hscroll">
          <button type="button">Action interne</button>
        </div>
        Pane 0
      </div>
      <div>Pane 1</div>
      <div>Pane 2</div>
    </LensPager>
  );
}

const pager = () => document.querySelector('.lkdv-lens-pager') as HTMLElement;
const lensIndex = () => pager().getAttribute('data-lens-index');

function swipe(startX: number, startY: number, endX: number, endY: number) {
  const element = pager();
  fireEvent.pointerDown(element, {
    pointerId: 1,
    button: 0,
    clientX: startX,
    clientY: startY,
  });
  fireEvent.pointerMove(element, {
    pointerId: 1,
    clientX: endX,
    clientY: endY,
  });
  fireEvent.pointerUp(element, {
    pointerId: 1,
    clientX: endX,
    clientY: endY,
  });
}

beforeEach(() => {
  (window as unknown as { PointerEvent: typeof PointerEvent }).PointerEvent =
    PointerEventPolyfill as unknown as typeof PointerEvent;
});

afterEach(cleanup);

describe('LensPager — seuil, verrou d’axe et snap', () => {
  it('ignore un déplacement sous le seuil de 24 px', () => {
    render(<Harness />);
    swipe(200, 100, 180, 101);
    expect(lensIndex()).toBe('0');
    expect(document.querySelector('.flow [role=tab][aria-selected=true]')?.textContent).toBe(
      'Lentille 0'
    );
  });

  it('passe à la lentille suivante au-delà de 24 px et resynchronise .flow', () => {
    render(<Harness />);
    swipe(200, 100, 168, 102);
    expect(lensIndex()).toBe('1');
    expect(document.querySelector('.flow [role=tab][aria-selected=true]')?.textContent).toBe(
      'Lentille 1'
    );
    expect(document.querySelector('.lkdv-lens-track')?.getAttribute('style')).toContain(
      'translateX(calc(-100% + 0px))'
    );
  });

  it('verrouille l’axe : un geste vertical ne change pas de lentille', () => {
    render(<Harness />);
    swipe(200, 100, 150, 260);
    expect(lensIndex()).toBe('0');
  });

  it('termine le geste quand le pointerup arrive hors de la piste', () => {
    render(<Harness />);
    const element = pager();
    fireEvent.pointerDown(element, {
      pointerId: 7,
      button: 0,
      clientX: 200,
      clientY: 100,
    });
    fireEvent.pointerMove(element, {
      pointerId: 7,
      clientX: 150,
      clientY: 102,
    });
    expect(element.getAttribute('data-dragging')).toBe('true');
    fireEvent.pointerUp(document.body, {
      pointerId: 7,
      clientX: 150,
      clientY: 102,
    });
    expect(element.getAttribute('data-dragging')).toBe('false');
    expect(lensIndex()).toBe('1');
  });

  it('remet dragging à false sur pointercancel sans changer de lentille', () => {
    render(<Harness />);
    const element = pager();
    fireEvent.pointerDown(element, {
      pointerId: 3,
      button: 0,
      clientX: 200,
      clientY: 100,
    });
    fireEvent.pointerMove(element, {
      pointerId: 3,
      clientX: 150,
      clientY: 102,
    });
    expect(element.getAttribute('data-dragging')).toBe('true');
    fireEvent.pointerCancel(element, { pointerId: 3, clientX: 150, clientY: 102 });
    expect(element.getAttribute('data-dragging')).toBe('false');
    expect(lensIndex()).toBe('0');
  });

  it('reste pilotable au clavier ←/→', () => {
    render(<Harness />);
    const element = pager();
    element.focus();
    fireEvent.keyDown(element, { key: 'ArrowRight' });
    expect(lensIndex()).toBe('1');
    fireEvent.keyDown(element, { key: 'ArrowLeft' });
    expect(lensIndex()).toBe('0');
    expect(screen.getByRole('group', { name: 'Piste de test' })).toBeTruthy();
  });
});

describe('LensPager — scrollers horizontaux internes', () => {
  it('laisse le geste au scroller et restaure touch-action après pointerup', () => {
    render(<ScrollHarness />);
    const element = pager();
    const scroller = screen.getByTestId('hscroll');
    expect(element.style.touchAction).not.toBe('auto');

    fireEvent.pointerDown(scroller, {
      pointerId: 5,
      button: 0,
      clientX: 220,
      clientY: 120,
    });

    expect(element.style.touchAction).toBe('auto');
    expect(element.getAttribute('data-dragging')).toBe('false');

    fireEvent.pointerMove(scroller, {
      pointerId: 5,
      clientX: 120,
      clientY: 122,
    });
    expect(element.getAttribute('data-dragging')).toBe('false');
    expect(lensIndex()).toBe('0');

    fireEvent.pointerUp(scroller, {
      pointerId: 5,
      clientX: 120,
      clientY: 122,
    });
    expect(element.style.touchAction).toBe('');
    expect(lensIndex()).toBe('0');
  });

  it('détecte le scroller depuis un enfant interactif', () => {
    render(<ScrollHarness />);
    const element = pager();
    const button = screen.getByRole('button', { name: 'Action interne' });

    fireEvent.pointerDown(button, {
      pointerId: 8,
      button: 0,
      clientX: 220,
      clientY: 120,
    });

    expect(element.style.touchAction).toBe('auto');
    expect(element.getAttribute('data-dragging')).toBe('false');
  });

  it('restaure touch-action sur pointercancel', () => {
    render(<ScrollHarness />);
    const element = pager();
    const scroller = screen.getByTestId('hscroll');

    fireEvent.pointerDown(scroller, {
      pointerId: 6,
      button: 0,
      clientX: 220,
      clientY: 120,
    });
    expect(element.style.touchAction).toBe('auto');

    fireEvent.pointerCancel(scroller, {
      pointerId: 6,
      clientX: 220,
      clientY: 120,
    });
    expect(element.style.touchAction).toBe('');
  });

  it('restaure touch-action sur lostpointercapture', () => {
    render(<ScrollHarness />);
    const element = pager();
    const scroller = screen.getByTestId('hscroll');

    fireEvent.pointerDown(scroller, {
      pointerId: 9,
      button: 0,
      clientX: 220,
      clientY: 120,
    });
    expect(element.style.touchAction).toBe('auto');

    fireEvent(element, new Event('lostpointercapture', { bubbles: true }));
    expect(element.style.touchAction).toBe('');
  });

  it('démarre toujours le swipe hors d’un scroller', () => {
    render(<ScrollHarness />);
    const element = pager();

    fireEvent.pointerDown(element, {
      pointerId: 10,
      button: 0,
      clientX: 200,
      clientY: 100,
    });

    expect(element.style.touchAction).toBeFalsy();
    expect(element.getAttribute('data-dragging')).toBe('true');
  });
});
