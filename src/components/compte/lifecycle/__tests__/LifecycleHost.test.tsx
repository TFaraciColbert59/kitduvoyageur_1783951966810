// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LifecycleHost } from '../LifecycleHost';
import type { LifecycleApi, LifecycleListResponse } from '../api';
import { makeRecord } from './fixtures';

beforeEach(() => {
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});

afterEach(cleanup);

function buildApi(record = makeRecord()) {
  const deleted = {
    ...record,
    lifecycleStatus: 'deleted' as const,
    deletedAt: new Date().toISOString(),
    purgeAfter: new Date(Date.now() + 25 * 86_400_000).toISOString(),
  };
  const list = vi.fn(
    async (params?: {
      q?: string;
      trash?: boolean;
      requestSeq?: number;
    }): Promise<LifecycleListResponse> => {
      const items = params?.trash ? [deleted] : [record];
      return {
        items,
        totalMatched: items.length,
        expiredDeletedCount: 0,
        requestSeq: params?.requestSeq ?? 1,
      };
    }
  );
  const api: LifecycleApi = {
    list,
    get: vi.fn(async () => record),
    updateMetadata: vi.fn(async () => ({ record })),
    updateMedia: vi.fn(async () => ({ record })),
    quickEdit: vi.fn(async () => ({ record })),
    previewCrop: vi.fn(async () => ({ preview: {} as never, record: null })),
    crop: vi.fn(async () => ({ preview: {} as never, record })),
    restoreGeometry: vi.fn(async () => ({ record })),
    split: vi.fn(async () => ({
      parentRecord: record,
      parts: [record],
      projectionEvent: {} as never,
      idempotentReplay: false,
    })),
    correct: vi.fn(async () => ({ record })),
    smoothGps: vi.fn(async () => ({ record, spikesRemoved: 1 })),
    revertCorrection: vi.fn(async () => ({ record })),
    trash: vi.fn(async () => ({ record: deleted })),
    restore: vi.fn(async () => ({ record })),
  };
  return { api, list, record, deleted };
}

describe('A02 — hôte de la surface cycle de vie', () => {
  it('charge la liste puis ouvre la fiche détaillée', async () => {
    const { api, record } = buildApi();
    render(<LifecycleHost userId="user-1" api={api} />);

    const row = await screen.findByTestId(`life-row-${record.id}`);
    fireEvent.click(row);

    await waitFor(() => expect(api.get).toHaveBeenCalledWith(record.id));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getAllByText('Traversée du Vercors').length).toBeGreaterThan(0);
  });

  it('met une séance à la corbeille après confirmation explicite', async () => {
    const { api, record } = buildApi();
    render(<LifecycleHost userId="user-1" api={api} />);

    fireEvent.click(await screen.findByTestId(`life-row-${record.id}`));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: /Supprimer/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Mettre à la corbeille/ }));

    await waitFor(() => expect(api.trash).toHaveBeenCalledWith(record.id));
    await waitFor(() => expect(screen.queryByTestId(`life-row-${record.id}`)).toBeNull());
  });

  it('transmet la recherche au serveur après le délai de frappe', async () => {
    const { api } = buildApi();
    render(<LifecycleHost userId="user-1" api={api} />);
    await screen.findByRole('searchbox', { name: /Rechercher dans l’historique/ });

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'kayak' } });
    await waitFor(
      () =>
        expect(api.list).toHaveBeenCalledWith(
          expect.objectContaining({ q: 'kayak', trash: false })
        ),
      { timeout: 2000 }
    );
  });

  it('ouvre la corbeille et restaure une séance sans la réafficher', async () => {
    const { api, deleted } = buildApi();
    render(<LifecycleHost userId="user-1" api={api} />);
    await screen.findByRole('button', { name: /Corbeille/ });

    fireEvent.click(screen.getByRole('button', { name: /Corbeille/ }));
    await screen.findByText('Corbeille des séances');
    fireEvent.click(
      await screen.findByRole('button', { name: `Restaurer ${deleted.title}` }, { timeout: 2000 })
    );

    await waitFor(() => expect(api.restore).toHaveBeenCalledWith(deleted.id));
    await waitFor(() => expect(screen.queryByTestId(`corbeille-item-${deleted.id}`)).toBeNull());
  });
});
