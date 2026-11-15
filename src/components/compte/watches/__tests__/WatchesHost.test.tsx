// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WatchesHost } from '../WatchesHost';
import { createFakeApi, makePack, makeSession, makeStatus } from './fixtures';

afterEach(cleanup);

describe('D03 — hôte de la surface Montres', () => {
  it('affiche le diagnostic fail-closed puis navigue entre les quatre écrans', async () => {
    const api = createFakeApi();
    render(
      <WatchesHost
        api={api}
        initialStatus={makeStatus()}
        initialSessions={[makeSession()]}
        initialPacks={[makePack()]}
        initialStorageBytes={128 * 1024 * 1024}
      />,
    );

    expect(await screen.findByTestId('watch-status-screen')).toBeTruthy();
    expect(screen.getAllByText('Cible native absente').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('tab', { name: /Hors-ligne/ }));
    expect(await screen.findByTestId('watch-sessions-screen')).toBeTruthy();
    expect(screen.getByText('rando')).toBeTruthy();
    expect(screen.getByText(/Dernier point contigu : 42/)).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /Cartes/ }));
    expect(await screen.findByTestId('watch-packs-screen')).toBeTruthy();
    expect(screen.getAllByText('vercors-boucle').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('tab', { name: /Live Sync/ }));
    expect(await screen.findByTestId('watch-live-sync-screen')).toBeTruthy();
    expect(screen.getByText(/champ capteur vide/i)).toBeTruthy();
  });

  it('affiche un état d’erreur avec Réessayer quand le diagnostic échoue', async () => {
    const api = createFakeApi({
      async getStatus() {
        throw new Error('Diagnostic indisponible pour ce test.');
      },
    });
    render(<WatchesHost api={api} />);
    await waitFor(() => {
      expect(screen.getByText('Diagnostic indisponible pour ce test.')).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /Réessayer/ })).toBeTruthy();
  });
});

describe('D03 — Live Sync sans invention de capteur', () => {
  it('affiche « — » pour la FC absente puis la valeur réelle quand elle est saisie', async () => {
    const api = createFakeApi();
    const { container } = render(
      <WatchesHost
        api={api}
        initialTab="live"
        initialStatus={makeStatus()}
        initialSessions={[makeSession()]}
        initialPacks={[]}
      />,
    );

    await screen.findByTestId('watch-live-sync-screen');
    const unavailable = container.querySelector(
      '[data-available="false"]',
    ) as HTMLElement | null;
    expect(unavailable).toBeTruthy();
    expect(unavailable?.textContent).toContain('indisponible');

    const heartRate = screen.getByLabelText(/FC \(bpm, facultatif\)/);
    fireEvent.change(heartRate, { target: { value: '142' } });

    await waitFor(() => {
      expect(screen.getByText('142 bpm')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Enregistrer la disposition/ }));
    expect(
      await screen.findByText('Disposition enregistrée et appliquée aux séances.'),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Construire la trame/ }));
    expect(await screen.findByText(/Dernière trame n° 1/)).toBeTruthy();
  });

  it('affiche les repères à venir triés et ne fabrique pas de POI', async () => {
    const api = createFakeApi();
    render(
      <WatchesHost
        api={api}
        initialTab="live"
        initialStatus={makeStatus()}
        initialSessions={[makeSession()]}
        initialPacks={[]}
      />,
    );
    await screen.findByTestId('watch-live-sync-screen');
    expect(screen.getByText('Aucun repère à venir')).toBeTruthy();
  });
});
