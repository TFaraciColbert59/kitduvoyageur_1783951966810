// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StageTransports, parseAmount } from '../components/workspace/stages/StageTransports';
import { stage } from '../insights/__tests__/fixtures';

describe('Transports de la journée (10.6)', () => {
  afterEach(cleanup);

  it('parseAmount : vide = « à estimer » (null), virgule acceptée, texte refusé', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount(' 42,5 ')).toBe(42.5);
    expect(parseAmount('12')).toBe(12);
    expect(parseAmount('abc')).toBe('invalid');
    expect(parseAmount('-3')).toBe('invalid');
    expect(parseAmount('1.234')).toBe('invalid');
  });

  it('ajoute un transport sans montant (à estimer) puis l’enregistre avec la version de l’étape', () => {
    const run = vi.fn();
    const st = stage('st-1', 1, 'a', 'b');
    render(<StageTransports stage={st} canEdit runOperation={run} />);
    fireEvent.click(screen.getByText('Ajouter un transport'));
    fireEvent.click(screen.getByTestId('save-transports'));
    expect(run).toHaveBeenCalledTimes(1);
    const [op, versions] = run.mock.calls[0];
    expect(op).toMatchObject({ type: 'set_stage_transports', stageId: 'st-1', transports: [{ direction: 'aller', mode: 'train', amount: null, currency: 'EUR' }] });
    expect(versions).toEqual({ 'st-1': 1 });
  });

  it('un montant saisi part tel quel ; un montant invalide bloque l’enregistrement', () => {
    const run = vi.fn();
    render(<StageTransports stage={stage('st-1', 1, 'a', 'b')} canEdit runOperation={run} />);
    fireEvent.click(screen.getByText('Ajouter un transport'));
    const input = screen.getByLabelText(/Montant total pour le groupe/);
    fireEvent.change(input, { target: { value: 'beaucoup' } });
    expect((screen.getByTestId('save-transports') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: '38,40' } });
    fireEvent.click(screen.getByTestId('save-transports'));
    expect(run.mock.calls[0][0].transports[0].amount).toBe(38.4);
  });

  it('lecture seule : rien à saisir sans transport, aucun bouton d’écriture avec', () => {
    const { container, unmount } = render(<StageTransports stage={stage('st-1', 1, 'a', 'b')} canEdit={false} runOperation={vi.fn()} />);
    expect(container.querySelector('[data-testid="stage-transports"]')).toBeNull();
    unmount();
    render(<StageTransports stage={stage('st-1', 1, 'a', 'b', { transports: [{ id: 't', direction: 'retour', mode: 'bus', amount: 9, currency: 'EUR' }] })} canEdit={false} runOperation={vi.fn()} />);
    expect(screen.queryByTestId('save-transports')).toBeNull();
    expect((screen.getByLabelText(/Montant total/) as HTMLInputElement).value).toBe('9');
  });
});
