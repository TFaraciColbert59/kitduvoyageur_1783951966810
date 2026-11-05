// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { zoneOf } from '../domain/state';
import { createInitialState } from '../domain/state';
import { altsFor } from '../domain/swap';
import { BilanSheet } from '../ui/sheets/BilanSheet';
import { ItemSheet } from '../ui/sheets/ItemSheet';

afterEach(cleanup);

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');
const NBSP = ' ';

describe('BilanSheet', () => {
  it('TMB : 10,3 kg (espace insécable) et 4 pages', () => {
    render(<BilanSheet state={createInitialState('tmb')} page={0} onPage={() => {}} onAction={() => {}} onBack={() => {}} />);
    expect(document.querySelector('.ks-bl-big')?.textContent).toBe(`10,3${NBSP}kg`);
    expect(screen.getAllByRole('group').filter((g) => /^Page \d sur 4$/.test(g.getAttribute('aria-label') ?? ''))).toHaveLength(4);
    expect(screen.getAllByRole('tab')).toHaveLength(4);
  });

  it('page Prêt : pourcentage et blocages ; un blocage appelle onAction', () => {
    const onAction = vi.fn();
    render(<BilanSheet state={createInitialState('tmb')} page={3} onPage={() => {}} onAction={onAction} onBack={() => {}} />);
    expect(document.querySelector('.ks-bl-ready .ks-bl-t17')?.textContent).toMatch(new RegExp(`^Prêt à \\d+${NBSP}%$`));
    const rows = document.querySelectorAll('button.ks-bl-row');
    expect(rows.length).toBeGreaterThan(0);
    fireEvent.click(rows[0]);
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'blocker' }));
  });

  it('le curseur de jour renvoie un nouvel état', () => {
    const onAction = vi.fn();
    const s = createInitialState('tmb');
    render(<BilanSheet state={s} page={2} onPage={() => {}} onAction={onAction} onBack={() => {}} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '3' } });
    expect(onAction.mock.calls[0][0].day).toBe(3);
  });
});

describe('ItemSheet', () => {
  const s = createInitialState('tmb');

  it('duvet : 6 mesures, Retirer du sac renvoie l’état sans l’objet', () => {
    const onAction = vi.fn();
    render(<ItemSheet state={s} itemId="sleep0" page={0} onPage={() => {}} onAction={onAction} onBack={() => {}} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    fireEvent.click(screen.getAllByRole('button', { name: 'Retirer du sac' })[0]);
    const next = onAction.mock.calls[0][0];
    expect(zoneOf(next, 'sleep0')).toBeNull();
    expect(zoneOf(s, 'sleep0')).not.toBeNull();
  });

  it('page Échanger : liste les alternatives', () => {
    const alts = altsFor(s, 'sleep0');
    expect(alts.length).toBeGreaterThan(0);
    render(<ItemSheet state={s} itemId="sleep0" page={1} onPage={() => {}} onAction={() => {}} onBack={() => {}} />);
    expect(document.querySelectorAll('button.ks-bl-alt')).toHaveLength(Math.min(6, alts.length));
    expect(within(document.body).getAllByText(alts[0].e.n).length).toBeGreaterThan(0);
  });

  it('objet hors sac : Mettre dans le sac émet une intention', () => {
    const onAction = vi.fn();
    render(<ItemSheet state={s} itemId="sleep-5" page={0} onPage={() => {}} onAction={onAction} onBack={() => {}} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Mettre dans le sac' })[0]);
    expect(onAction).toHaveBeenCalledWith({ type: 'pack', id: 'sleep-5' });
  });
});

describe('gabarit', () => {
  it('pager à marge de 46 px (rien sous la barre basse)', () => {
    expect(read('ui/kit-studio.css')).toMatch(/\.ks-pager\s*\{[^}]*margin-bottom:\s*46px/);
  });
  it('aucune bordure colorée, aucun hex ni rgba noir', () => {
    const css = read('ui/sheets/bilan.css');
    expect(css).not.toMatch(/border(-left|-right|-top|-bottom)?:\s*[^;0]*(solid|var\(--ks-(green|warn))/);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/rgba\(\s*0\s*,\s*0\s*,\s*0/);
    expect(css).not.toMatch(/\boutline\s*:/);
  });
  it('aucun innerHTML', () => {
    for (const f of ['BilanSheet', 'ItemSheet', 'BalanceChart']) expect(read(`ui/sheets/${f}.tsx`)).not.toMatch(/innerHTML/);
  });
});
