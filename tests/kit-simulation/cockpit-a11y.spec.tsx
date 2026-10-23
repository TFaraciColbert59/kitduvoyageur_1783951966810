// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

// KIT-005A — Contrat accessible et comportemental du cockpit en ISOLATION
// (sans montage dans une page de production : décision produit encore ouverte).
// Vérifie E14 (annulation des réponses périmées), E15 (statut explicite),
// l'absence de fausse action d'acquisition et les garanties d'accessibilité
// posées par le dossier §18.

import { SimulationCockpit } from '@/features/kit-simulation/SimulationCockpit';
import type { SimulationRequest } from '@/features/kit-simulation/schema';
import type { Result } from '@/features/kit-simulation/core';

const initialInput = {
  mode: 'balanced',
  accommodation: 'hotel',
  cooking: false,
  naturalWater: false,
  minTempC: null,
  minimumPadR: null,
  coldMarginC: 3,
  budgetCents: 50000,
  maxPackWeightG: 10000,
  packVolumeMl: 50000,
  consumablesG: 1000,
} satisfies SimulationRequest;

function snapshot(marker: string, packWeightG: number | null): Result & { generatedAt: string } {
  return {
    version: `lkdv-simulation-${marker}`,
    items: [
      {
        option: {
          id: 'o1',
          spec: {
            productId: '00000000-0000-4000-8000-000000000001',
            slot: 'pack',
            name: 'Sac fixture',
            weightG: 1200,
            volumeMl: 30000,
            comfortC: null,
            rValue: null,
            verified: true,
          },
          source: 'owned',
          priceCents: 0,
          currency: 'EUR',
          availableUnits: 1,
          validUntil: '2031-01-01T00:00:00Z',
          measuredWeightG: null,
          worn: false,
        },
        quantity: 1,
      },
    ],
    missing: [],
    warnings: ['Estimation de préparation, jamais une validation médicale ni une garantie de sécurité.'],
    costCents: 0,
    baseWeightG: 1200,
    wornWeightG: 0,
    consumablesWeightG: 0,
    knownPackWeightG: 1200,
    packWeightG,
    volumeMl: 30000,
    coverage: 'complete',
    constraintStatus: 'within_preferences',
    search: { algorithm: 'bounded-beam-v1', exhaustive: false, beamWidth: 64 },
    generatedAt: '2026-10-18T12:00:00Z',
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function responseWith(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

beforeEach(() => {
  vi.stubGlobal('crypto', { randomUUID: () => '00000000-0000-4000-8000-000000000000' });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('état initial : avertissement, cibles explicites, aucune action financière factice', () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  render(<SimulationCockpit initialInput={initialInput} />);

  expect(screen.getByRole('heading', { name: 'Votre préparation, expliquée' })).toBeTruthy();
  expect(screen.getByText(/Aucune garantie médicale ou de sécurité/)).toBeTruthy();
  expect(screen.getByRole('status').textContent).toBe('Choisissez un objectif pour lancer le calcul.');
  expect(screen.getByRole('group', { name: 'Objectif d’optimisation' })).toBeTruthy();

  const buttons = screen.getAllByRole('button');
  expect(buttons.map((b) => b.textContent)).toEqual(['Budget', 'Équilibré', 'Poids']);
  expect(buttons.every((b) => b.getAttribute('type') === 'button')).toBe(true);
  expect(screen.getByRole('button', { name: 'Équilibré' }).getAttribute('aria-pressed')).toBe('true');

  // Dossier §18 : pas de faux sélecteur d'acquisition, pas de bouton « Louer/Acheter ».
  expect(screen.queryByRole('combobox')).toBeNull();
  expect(screen.queryByRole('button', { name: /acheter|louer|prêter/i })).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
});

it('calcul en cours : aria-busy et annonce aria-live, requête idempotente', async () => {
  const pending = deferred<Response>();
  const fetcher = vi.fn().mockReturnValue(pending.promise);
  vi.stubGlobal('fetch', fetcher);
  render(<SimulationCockpit initialInput={initialInput} />);

  fireEvent.click(screen.getByRole('button', { name: 'Budget' }));

  const section = screen.getByRole('heading', { name: 'Votre préparation, expliquée' }).closest('section');
  expect(section?.getAttribute('aria-busy')).toBe('true');
  expect(screen.getByRole('status').textContent).toBe('Calcul en cours…');

  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/kit-simulation');
  expect(init.method).toBe('POST');
  const headers = init.headers as Record<string, string>;
  expect(headers['Idempotency-Key']).toBe('00000000-0000-4000-8000-000000000000');
  expect(JSON.parse(String(init.body))).toMatchObject({ mode: 'eco' });

  pending.resolve(responseWith(snapshot('1.0.0', 1200)));
  await screen.findByText(/Charge au dos : 1\.20 kg/);
  expect(section?.getAttribute('aria-busy')).toBe('false');
  expect(screen.getByText('Sac fixture')).toBeTruthy();
  expect(screen.getByText(/Version lkdv-simulation-1\.0\.0/)).toBeTruthy();
  expect(screen.getByText(/slots renseignés/)).toBeTruthy();
});

it('réponse périmée ignorée : seul le dernier objectif choisi s’affiche (E14)', async () => {
  const first = deferred<Response>();
  const second = deferred<Response>();
  const fetcher = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  vi.stubGlobal('fetch', fetcher);
  render(<SimulationCockpit initialInput={initialInput} />);

  fireEvent.click(screen.getByRole('button', { name: 'Budget' }));
  fireEvent.click(screen.getByRole('button', { name: 'Poids' }));
  expect(fetcher).toHaveBeenCalledTimes(2);

  // Le premier calcul répond APRÈS l'annulation : il doit être ignoré.
  first.resolve(responseWith(snapshot('perime', 9000)));
  await Promise.resolve();
  expect(screen.queryByText(/Version lkdv-simulation-perime/)).toBeNull();

  second.resolve(responseWith(snapshot('final', 800)));
  await screen.findByText(/Version lkdv-simulation-final/);
  expect(screen.queryByText(/Version lkdv-simulation-perime/)).toBeNull();
  expect(screen.getByText(/Charge au dos : 0\.80 kg/)).toBeTruthy();
});

it('erreur : avertissement visible et résultat précédent conservé comme périmé', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(responseWith(snapshot('1.0.0', 1200)))
    .mockResolvedValueOnce(responseWith({ error: 'SIMULATION_UNAVAILABLE' }, false, 503));
  vi.stubGlobal('fetch', fetcher);
  render(<SimulationCockpit initialInput={initialInput} />);

  fireEvent.click(screen.getByRole('button', { name: 'Budget' }));
  await screen.findByText(/Version lkdv-simulation-1\.0\.0/);

  fireEvent.click(screen.getByRole('button', { name: 'Poids' }));
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain('Calcul indisponible (503)');
  expect(screen.getByText(/Résultat précédent, à actualiser/)).toBeTruthy();
  // Le résultat précédent reste lisible, marqué périmé — jamais présenté comme neuf.
  expect(screen.getByText(/Version lkdv-simulation-1\.0\.0/)).toBeTruthy();
  await waitFor(() => {
    const section = screen.getByRole('heading', { name: 'Votre préparation, expliquée' }).closest('section');
    expect(section?.getAttribute('aria-busy')).toBe('false');
  });
});

it('poids inconnu : jamais de barre de progression factice (E15)', async () => {
  const fetcher = vi.fn().mockResolvedValue(responseWith(snapshot('1.0.0', null)));
  vi.stubGlobal('fetch', fetcher);
  render(<SimulationCockpit initialInput={initialInput} />);

  fireEvent.click(screen.getByRole('button', { name: 'Équilibré' }));
  await screen.findByText(/Charge au dos : inconnue/);
  expect(document.querySelector('progress')).toBeNull();
  expect(screen.getByText(/Préférence : 10\.0 kg/)).toBeTruthy();
});
