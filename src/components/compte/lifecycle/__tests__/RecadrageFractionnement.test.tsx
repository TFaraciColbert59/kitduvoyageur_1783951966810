// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RecadrageFractionnement } from '../RecadrageFractionnement';
import { makeRecord } from './fixtures';

afterEach(cleanup);

const noopRestore = vi.fn(async () => ({ ok: true as const }));

describe('A02 — recadrage et fractionnement avec aperçu', () => {
  it('affiche l’aperçu avant/après et applique les bornes exactes', async () => {
    const record = makeRecord();
    const onApplyCrop = vi.fn(async () => ({ ok: true as const }));
    render(
      <RecadrageFractionnement
        record={record}
        onApplyCrop={onApplyCrop}
        onApplySplit={vi.fn()}
        onRestoreOriginal={noopRestore}
      />
    );

    fireEvent.change(screen.getByLabelText('Début conservé'), {
      target: { value: '0.4' },
    });

    expect(screen.getAllByText('Avant').length).toBe(1);
    expect(screen.getAllByText('Après').length).toBe(1);
    expect(screen.getByText(/Retiré :/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Appliquer le recadrage/ }));
    await waitFor(() => expect(onApplyCrop).toHaveBeenCalledTimes(1));
    expect(onApplyCrop.mock.calls[0][0]).toMatchObject({
      startIndex: 2,
      endIndex: 5,
      operationId: expect.any(String),
    });
  });

  it('fractionne avec aperçu des tronçons et titres facultatifs', async () => {
    const record = makeRecord();
    const onApplySplit = vi.fn(async () => ({ ok: true as const }));
    render(
      <RecadrageFractionnement
        record={record}
        onApplyCrop={vi.fn()}
        onApplySplit={onApplySplit}
        onRestoreOriginal={noopRestore}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Fractionner' }));
    expect(screen.getByText('Aperçu des tronçons')).toBeTruthy();
    expect(screen.getAllByText('Tronçon').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('Titre du tronçon 1 (facultatif)'), {
      target: { value: 'Montée' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Fractionner en 2 parties/ }));
    await waitFor(() => expect(onApplySplit).toHaveBeenCalledTimes(1));
    expect(onApplySplit.mock.calls[0][0]).toMatchObject({
      splitIndices: [2],
      operationId: expect.any(String),
      partTitles: ['Montée'],
    });
  });

  it('ne propose pas de restauration quand la trace est intacte', () => {
    render(
      <RecadrageFractionnement
        record={makeRecord()}
        onApplyCrop={vi.fn()}
        onApplySplit={vi.fn()}
        onRestoreOriginal={noopRestore}
      />
    );
    expect(screen.queryByRole('button', { name: /Restaurer la trace d’origine/ })).toBeNull();
  });

  it('restaure la trace d’origine après un recadrage', async () => {
    const base = makeRecord();
    const onRestoreOriginal = vi.fn(async () => ({ ok: true as const }));
    render(
      <RecadrageFractionnement
        record={makeRecord({ points: base.points.slice(1), originalPoints: base.points })}
        onApplyCrop={vi.fn()}
        onApplySplit={vi.fn()}
        onRestoreOriginal={onRestoreOriginal}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Restaurer la trace d’origine/ }));
    await waitFor(() => expect(onRestoreOriginal).toHaveBeenCalledTimes(1));
  });

  it('explique l’impossibilité de recadrer une trace trop courte', () => {
    const short = makeRecord();
    render(
      <RecadrageFractionnement
        record={makeRecord({ points: short.points.slice(0, 2) })}
        onApplyCrop={vi.fn()}
        onApplySplit={vi.fn()}
        onRestoreOriginal={noopRestore}
      />
    );
    expect(screen.getByText(/moins de trois points GPS/)).toBeTruthy();
  });
});
