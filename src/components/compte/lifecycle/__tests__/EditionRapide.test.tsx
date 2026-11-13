// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditionRapide } from '../EditionRapide';
import { makeRecord } from './fixtures';

afterEach(cleanup);

function pendingRecord() {
  return makeRecord({
    quickEditState: {
      status: 'pending',
      visible: true,
      syncedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 4 * 3_600_000).toISOString(),
      editableFields: ['title', 'visibility', 'sport', 'tags', 'kitId', 'gearIds'],
    },
  });
}

describe('A02 — édition rapide après synchronisation', () => {
  it('envoie uniquement les champs modifiés du contrat', async () => {
    const record = pendingRecord();
    const onSubmit = vi.fn(async () => ({ ok: true as const }));
    render(<EditionRapide record={record} onSubmit={onSubmit} onDismiss={vi.fn()} />);

    const title = screen.getByLabelText('Titre de la séance') as HTMLInputElement;
    fireEvent.change(title, { target: { value: 'Titre ajusté' } });
    fireEvent.click(screen.getByRole('button', { name: /Sortie longue/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      title: 'Titre ajusté',
      sport: 'rando',
      tags: ['sortie_longue'],
      visibility: 'private',
    });
  });

  it('refuse un titre vide sans appeler le serveur', async () => {
    const record = pendingRecord();
    const onSubmit = vi.fn(async () => ({ ok: true as const }));
    render(<EditionRapide record={record} onSubmit={onSubmit} onDismiss={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Titre de la séance'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Le titre ne peut pas être vide.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('propose « Plus tard » sans modifier les données durables', async () => {
    const onDismiss = vi.fn(async () => ({ ok: true as const }));
    render(<EditionRapide record={pendingRecord()} onSubmit={vi.fn()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Plus tard' }));
    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
  });

  it('reste honnête quand aucune édition rapide n’est en attente', () => {
    const base = makeRecord();
    const record = makeRecord({
      quickEditState: {
        ...base.quickEditState,
        status: 'not_applicable',
        visible: false,
        expiresAt: null,
      },
    });
    render(<EditionRapide record={record} onSubmit={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText(/Aucune édition rapide en attente/)).toBeTruthy();
  });
});
