// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import RuleSimulator from '@/features/progression/components/RuleSimulator';

/**
 * T42 — RuleSimulator (admin) : rapport projeté affiché, erreur honnête,
 * requête envoyée avec l'échantillon saisi. Aucun accès réseau réel.
 */

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const REPORT = {
  success: true,
  report: {
    version: '2.0',
    totalProjectedXp: 400,
    refused: 2,
    lines: [
      { action: 'hike_session_processed', count: 10, projectedXp: 400, refusals: 0 },
      { action: 'inconnu', count: 2, projectedXp: 0, refusals: 2, reason: 'action_non_publiee' },
    ],
  },
};

describe('T42 — RuleSimulator (admin)', () => {
  it('affiche le rapport projeté (XP, refus, motif) et envoie l’échantillon', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => REPORT,
    } as Response);

    render(<RuleSimulator />);
    fireEvent.change(screen.getByLabelText(/nombre de faits/i), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /simuler/i }));

    await waitFor(() => expect(screen.getAllByText(/400/).length).toBeGreaterThan(0));
    expect(screen.getByText(/action_non_publiee/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/progression/simulate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ samples: [{ action: 'hike_session_processed', count: 10 }] }),
      })
    );
  });

  it('affiche une erreur honnête quand la route refuse (jamais un faux rapport)', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Accès interdit : administrateurs uniquement' }),
    } as Response);

    render(<RuleSimulator />);
    fireEvent.click(screen.getByRole('button', { name: /simuler/i }));

    await waitFor(() =>
      expect(screen.getByText(/Accès interdit : administrateurs uniquement/)).toBeTruthy()
    );
    expect(screen.queryByText(/Rapport projeté/)).toBeNull();
  });
});
