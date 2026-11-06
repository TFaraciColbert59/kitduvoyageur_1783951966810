// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createDeck } from '../domain/deck';
import type { Deck } from '../domain/deck';
import { createInitialState } from '../domain/state';
import type { KitState } from '../domain/types';
import { DeckSheet } from '../ui/sheets/DeckSheet';

afterEach(cleanup);

interface HarnessProps {
  kind: 'fill' | 'debrief';
  onQuit?: () => void;
  onState?: (s: KitState) => void;
}

function Harness({ kind, onQuit = () => {}, onState = () => {} }: HarnessProps) {
  const [s] = useState(() => createInitialState('tmb'));
  const [deck, setDeck] = useState<Deck>(() => createDeck(s, kind));
  return <DeckSheet state={s} deck={deck} onDeck={setDeck} onState={onState} onQuit={onQuit} />;
}

const progress = (c: HTMLElement) => (c.querySelector('.ks-dk-prog i') as HTMLElement).style.width;
const size = (kind: 'fill' | 'debrief') => createDeck(createInitialState('tmb'), kind).list.length;

describe('DeckSheet', () => {
  it('les boutons Oui et Non font avancer', () => {
    const { container } = render(<Harness kind="fill" />);
    expect(progress(container)).toBe('0%');
    fireEvent.click(screen.getByRole('button', { name: /^Dedans/ }));
    const w1 = parseFloat(progress(container));
    expect(w1).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /^Plus tard/ }));
    expect(parseFloat(progress(container))).toBeGreaterThan(w1);
  });

  it('les flèches avancent jusqu’à la fin, résumé affiché', () => {
    const { container } = render(<Harness kind="fill" />);
    const n = size('fill');
    for (let i = 0; i < n; i++) {
      fireEvent.keyDown(screen.getByRole('group'), { key: i % 2 ? 'ArrowLeft' : 'ArrowRight' });
    }
    expect(screen.getByText('Sac rempli')).toBeTruthy();
    expect(progress(container)).toBe('100%');
    expect(screen.getByRole('button', { name: 'Terminer' })).toBeTruthy();
  });

  it('débrief : Alléger met à jour l’état puis quitte', () => {
    const onState = vi.fn();
    const onQuit = vi.fn();
    render(<Harness kind="debrief" onState={onState} onQuit={onQuit} />);
    const n = size('debrief');
    for (let i = 0; i < n; i++) fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowLeft' });
    fireEvent.click(screen.getByRole('button', { name: /^Alléger le kit/ }));
    expect(onState).toHaveBeenCalledTimes(1);
    expect(onQuit).toHaveBeenCalledTimes(1);
  });

  it('Échap quitte', () => {
    const onQuit = vi.fn();
    render(<Harness kind="fill" onQuit={onQuit} />);
    fireEvent.keyDown(screen.getByRole('group'), { key: 'Escape' });
    expect(onQuit).toHaveBeenCalled();
  });
});
