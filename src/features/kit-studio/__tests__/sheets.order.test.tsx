// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { canAddModule } from '../domain/attach';
import { COLORWAYS, MODULE_IDS } from '../domain/catalog';
import type { ModuleId } from '../domain/catalog';
import { orderTotalCents, toOrder } from '../domain/order';
import { setBag } from '../domain/packing';
import { modOn, setMod } from '../domain/parts';
import { createInitialState, currentKit } from '../domain/state';
import type { KitState } from '../domain/types';
import { OrderButton } from '../ui/OrderButton';
import { BagSheet } from '../ui/sheets/BagSheet';
import { OrderSheet } from '../ui/sheets/OrderSheet';

afterEach(cleanup);

/** Corps passé en sauge : une seule pièce à commander. */
function withSageBody(s: KitState): KitState {
  const bag = currentKit(s).bag;
  const c = s.config[bag];
  return { ...s, config: { ...s.config, [bag]: { ...c, body: { ...c.body, col: COLORWAYS.sauge.body } } } };
}

/** État où au moins un module est éteint faute de points d'attache. */
function fullAttach(): { state: KitState; blocked: ModuleId } {
  let s = setBag(createInitialState(), 'b28').state; // corps de 6 points : trop court pour tous les modules
  for (const m of MODULE_IDS) s = setMod(s, m, false);
  for (const m of MODULE_IDS) if (canAddModule(s, m)) s = setMod(s, m, true);
  const blocked = MODULE_IDS.find((m) => !modOn(s, m) && !canAddModule(s, m));
  if (!blocked) throw new Error('aucun module refusé : le jeu de données a changé');
  return { state: s, blocked };
}

describe('OrderButton', () => {
  it('état initial : tout est à toi', () => {
    render(<OrderButton state={createInitialState()} onClick={() => {}} />);
    expect(screen.getByRole('button').textContent).toBe('Tout est à toi · voir la configuration');
  });

  it('corps en sauge : « Commander · 1 pièce · 149 € » (espace insécable)', () => {
    const s = withSageBody(createInitialState());
    expect(toOrder(s)).toEqual(['corps:b42']);
    const onClick = vi.fn();
    render(<OrderButton state={s} onClick={onClick} />);
    const b = screen.getByRole('button');
    expect(b.textContent).toBe('Commander · 1 pièce · 149 €');
    fireEvent.click(b);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('OrderSheet', () => {
  it('affiche les lignes, leurs états et le total exact', () => {
    const s = withSageBody(createInitialState());
    expect(orderTotalCents(s)).toBe(14900);
    render(<OrderSheet state={s} onConfirmOrder={() => {}} />);
    expect(screen.getAllByText('Ta configuration').length).toBeGreaterThan(0);
    expect(screen.getAllByText('À toi').length).toBeGreaterThanOrEqual(2);
    // Testing Library normalise l'espace insécable ; le texte exact est vérifié sur textContent.
    const price = screen.getByText(/À commander · 149\s€/);
    expect(price.textContent).toBe('À commander · 149 €');
    expect(screen.getByText('1 pièce à commander')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Précommander · 149\s€/ })).toBeTruthy();
  });

  it('rien à commander : explication, pas de bouton de validation', () => {
    render(<OrderSheet state={createInitialState()} onConfirmOrder={() => {}} />);
    expect(screen.getByText('Rien à commander')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Précommander/ })).toBeNull();
  });

  it('la validation passe par la précommande puis appelle onConfirmOrder (sans paiement)', () => {
    const s = withSageBody(createInitialState());
    const onConfirm = vi.fn();
    render(<OrderSheet state={s} onConfirmOrder={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: /Précommander/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la précommande' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const next = onConfirm.mock.calls[0][0] as KitState;
    expect(next.order['corps:b42']).toBe('sauge');
    expect(toOrder(next)).toEqual([]);
  });

  it('hors ligne : validation désactivée et expliquée', () => {
    const s = withSageBody(createInitialState());
    const onConfirm = vi.fn();
    render(<OrderSheet state={s} onConfirmOrder={onConfirm} offline />);
    const b = screen.getByRole('button', { name: /Précommander/ });
    expect((b as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toMatch(/Hors ligne/);
    fireEvent.click(b);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('BagSheet', () => {
  it('module refusé faute de points : message dans la feuille, état inchangé', () => {
    const { state, blocked } = fullAttach();
    const onChange = vi.fn();
    render(<BagSheet state={state} onChange={onChange} />);
    const sw = screen.getAllByRole('switch').find((el) => el.getAttribute('aria-disabled') === 'true');
    expect(sw).toBeTruthy();
    fireEvent.click(sw as HTMLElement);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/Plus de points d’attache libres/);
    expect(modOn(state, blocked)).toBe(false);
  });

  it('module avec place : onChange reçoit un nouvel état', () => {
    let s = createInitialState();
    s = setMod(s, 'flask', false);
    const onChange = vi.fn();
    render(<BagSheet state={s} onChange={onChange} />);
    const sw = screen.getAllByRole('switch').find((el) => !(el as HTMLInputElement).checked && el.getAttribute('aria-disabled') !== 'true');
    expect(sw).toBeTruthy();
    fireEvent.click(sw as HTMLElement);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).not.toBe(s);
  });
});

describe('aucune bordure colorée', () => {
  it('ni style en ligne de bordure, ni règle CSS de bordure colorée, ni hex / rgba(0,0,0)', () => {
    const s = withSageBody(createInitialState());
    const { container } = render(
      <>
        <OrderButton state={s} onClick={() => {}} />
        <OrderSheet state={s} onConfirmOrder={() => {}} />
        <BagSheet state={s} onChange={() => {}} />
      </>,
    );
    for (const el of Array.from(container.querySelectorAll('[style]'))) {
      expect(el.getAttribute('style') ?? '').not.toMatch(/border|outline/i);
    }
    const css = readFileSync(join(__dirname, '../ui/sheets/sheets.css'), 'utf8');
    expect(css).not.toMatch(/border(-[a-z]+)*\s*:\s*[^;]*(green|orange|blue|red|#|rgb)/i);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/rgba\(\s*0\s*,\s*0\s*,\s*0/);
  });
});
