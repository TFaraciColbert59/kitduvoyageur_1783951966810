// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';

vi.mock('@/hooks/useHapticFeedback', () => ({ useHapticFeedback: () => ({ haptic: hapticMock }) }));
vi.mock('../services/kitRepository', () => ({ load: async () => null, save: async () => {} }));
vi.mock('../ui/Thumb', () => ({ Thumb: ({ fallback }: { fallback: React.ReactNode }) => <span data-testid="thumb">{fallback}</span> }));

import { COLORWAYS, FAMILIES, ITEMS } from '../domain/catalog';
import { candidates } from '../domain/packing';
import { createInitialState } from '../domain/state';
import { useKitStore } from '../store/kitStore';
import { useUiStore } from '../store/uiStore';
import { cardSide } from '../ui/cards/CardRail';
import { CardsView } from '../ui/cards/CardsView';

const hapticMock = vi.hoisted(() => vi.fn());
const CSS = readFileSync(join(__dirname, '../ui/cards/cards.css'), 'utf8');

beforeEach(() => {
  hapticMock.mockClear();
  useKitStore.setState({ kit: createInitialState(), undoStack: [], canUndo: false });
  useUiStore.setState({ mode: 'content', family: null, category: null, part: null, sheet: null });
});
afterEach(cleanup);

const cardsOf = () => Array.from(document.querySelectorAll<HTMLElement>('[data-card]'));

describe('cardSide', () => {
  it('112,7 px à 402 px de large, 122 à 430, plafonné à 560', () => {
    expect(cardSide(402)).toBeCloseTo(112.67, 1);
    expect(cardSide(430)).toBe(122);
    expect(cardSide(1200)).toBe(cardSide(560));
  });
});

describe('rail', () => {
  it('trois cartes exactement visibles, aimantées, défilement horizontal seul', () => {
    render(<CardsView />);
    expect(cardsOf().length).toBeGreaterThan(3);
    expect(CSS).toMatch(/width:\s*calc\(var\(--W\) \* 3 \+ var\(--gap\) \* 2\)/);
    expect(CSS).toMatch(/scroll-snap-type:\s*x mandatory/);
    expect(CSS).toMatch(/scroll-snap-align:\s*start/);
    expect(CSS).toMatch(/touch-action:\s*pan-x/);
    expect(CSS).toMatch(/--W:\s*calc\(\(min\(100vw, 560px\) - 2 \* 12px - 24px - 2 \* 8px\) \/ 3\)/);
    expect(CSS).toMatch(/inset:\s*0 6px 52px 6px/);
    expect(CSS).toMatch(/bottom:\s*9px/);
  });

  it('nom long : classe de limitation à deux lignes', () => {
    render(<CardsView />);
    const long = [...ITEMS].sort((a, b) => b.n.length - a.n.length)[0];
    const b = screen.getAllByText(long.n)[0];
    expect(b.className).toContain('ks-clamp');
    expect(CSS).toMatch(/\.ks-card__cap b \{[^}]*-webkit-line-clamp:\s*2/);
  });
});

describe('sélection', () => {
  it('surface plus claire et pastille ✓, sans bordure ni ombre colorée', () => {
    useUiStore.setState({ mode: 'appearance' });
    render(<CardsView />);
    const on = cardsOf().filter((c) => c.className.includes('ks-card--on'));
    expect(on.length).toBe(1);
    expect(on[0].querySelector('.ks-card__ck')).not.toBeNull();
    expect(on[0].getAttribute('aria-pressed')).toBe('true');
    const rules = CSS.match(/[^{}]+\{[^}]*\}/g) ?? [];
    const sel = rules.find((r) => r.trim().startsWith('.ks-card--on {')) ?? '';
    expect(sel).not.toMatch(/border|outline/);
    // aucune couleur hors encre / blanc / variables dans tout le fichier
    expect(CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(CSS).not.toMatch(/rgba?\(\s*0\s*,\s*0\s*,\s*0/);
    expect(CSS).not.toMatch(/\bborder(-color)?:\s*[^0n;\s]/);
    for (const m of CSS.matchAll(/rgba?\(([^)]*)\)/g)) {
      const v = m[1].replace(/\s+/g, '');
      expect(v.startsWith('23,43,36') || v.startsWith('255,255,255')).toBe(true);
    }
  });
});

describe('familles', () => {
  it('changer de famille filtre les cartes', () => {
    render(<CardsView />);
    const all = cardsOf().length;
    fireEvent.click(screen.getByRole('tab', { name: 'Vêtements' }));
    expect(useUiStore.getState().family).toBe('vetements');
    const expected = candidates(useKitStore.getState().kit, 'bag', 'vetements').length;
    const labels = cardsOf().filter((c) => c.dataset.card === 'item');
    expect(labels.length).toBe(expected);
    expect(labels.length).toBeLessThan(all);
    expect(FAMILIES.some((f) => f.id === 'vetements')).toBe(true);
  });
});

describe('apparence', () => {
  it('liste les coloris, le bouton Commander est sous les cartes, ↺ seulement si annulable', () => {
    useUiStore.setState({ mode: 'appearance', category: 'col' });
    render(<CardsView />);
    for (const cw of Object.values(COLORWAYS)) expect(screen.getByRole('button', { name: new RegExp(`^${cw.n}`) })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Annuler/ })).toBeNull();
    act(() => useKitStore.setState({ canUndo: true }));
    expect(screen.getByRole('button', { name: /Annuler/ })).toBeTruthy();
  });

  it('choisir un coloris écrit dans le store', () => {
    useUiStore.setState({ mode: 'appearance', category: 'col' });
    render(<CardsView />);
    const before = useKitStore.getState().kit;
    fireEvent.click(screen.getByRole('button', { name: /^Nuit/ }));
    expect(useKitStore.getState().kit).not.toBe(before);
    expect(useKitStore.getState().canUndo).toBe(true);
  });
});

describe('zone pleine', () => {
  it('la carte clignote, haptique warning, aucun toast', () => {
    const state = useKitStore.getState().kit;
    useKitStore.setState({ pack: vi.fn(() => ({ state, ok: false, reason: 'full' as const })) });
    render(<CardsView />);
    const card = cardsOf().find((c) => c.dataset.card === 'item') as HTMLElement;
    fireEvent.click(card);
    expect(card.className).toContain('ks-card--blink');
    expect(hapticMock).toHaveBeenCalledWith('warning');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(within(document.body).queryByText(/plein/i)).toBeNull();
  });
});
