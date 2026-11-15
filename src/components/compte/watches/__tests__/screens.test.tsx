// @vitest-environment jsdom
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  inspectWatchNativeTargets,
  resolveWatchPlatformCapabilities,
  type WatchNavigationFieldKey,
} from '@/features/watches';
import { WatchStatusScreen } from '../WatchStatusScreen';
import { WatchSessionsScreen } from '../WatchSessionsScreen';
import { WatchPacksScreen } from '../WatchPacksScreen';
import { WatchCustomFieldsEditor } from '../WatchCustomFieldsEditor';
import {
  createFakeApi,
  makeDevice,
  makePack,
  makeSession,
  makeStatus,
} from './fixtures';

afterEach(cleanup);

describe('D03 — écran diagnostic', () => {
  it('affiche explicitement la cible native absente et les trois plateformes', () => {
    render(<WatchStatusScreen status={makeStatus()} />);
    expect(screen.getAllByText('Cible native absente').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Apple Watch').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Wear OS').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Galaxy Watch').length).toBeGreaterThan(0);
    expect(screen.getByText(/Cible native absente :/)).toBeTruthy();
    const grid = screen.getByTestId('watch-capability-grid');
    expect(grid.querySelectorAll('[data-state="native_target_unavailable"]').length).toBe(8);
  });

  it('résout les capacités d’une montre déclarée quand les cibles natives sont présentes', () => {
    const diagnostic = inspectWatchNativeTargets({
      xcodeWatchKitTargetPresent: true,
      wearOsGradleModulePresent: true,
      runtimeBridgeInjected: true,
      nowIso: '2026-11-13T10:00:00.000Z',
    });
    const profile = makeDevice();
    const capabilities = resolveWatchPlatformCapabilities(profile, diagnostic);
    const status = makeStatus({
      status: 'available',
      diagnostic,
      capabilities,
      devices: [{ profile, capabilities }],
    });

    render(<WatchStatusScreen status={status} />);
    expect(screen.getByText('Compagnon disponible')).toBeTruthy();
    expect(screen.getByText('Apple Watch Ultra 2')).toBeTruthy();
    expect(screen.getByText('Indéterminé')).toBeTruthy();
    expect(screen.getByText(/HealthKit ne permet pas de distinguer/)).toBeTruthy();
  });
});

describe('D03 — écran file hors ligne', () => {
  it('montre une séance rapprochée et ses compteurs de doublons', () => {
    render(
      <WatchSessionsScreen
        sessions={[makeSession({ duplicatePointsIgnored: 2 })]}
        onRefresh={() => {}}
      />,
    );
    expect(screen.getByTestId('watch-session-card')).toBeTruthy();
    expect(screen.getByText('rando')).toBeTruthy();
    expect(screen.getByText(/doublons ignorés : 2 point/)).toBeTruthy();
    expect(screen.getByText(/Identifiant canonique/)).toBeTruthy();
  });

  it('ne fabrique aucune séance quand la file est vide', () => {
    render(<WatchSessionsScreen sessions={[]} />);
    expect(screen.getByText('Aucune séance montre reçue')).toBeTruthy();
    expect(screen.queryByTestId('watch-session-card')).toBeNull();
  });
});

describe('D03 — écran paquets hors ligne', () => {
  it('affiche l’état vérifié, les capacités et permet de vérifier', () => {
    const onVerify = vi.fn(async () => {});
    render(
      <WatchPacksScreen
        packs={[makePack()]}
        availableStorageBytes={128 * 1024 * 1024}
        onVerify={onVerify}
        onRemove={async () => {}}
      />,
    );

    expect(screen.getByTestId('watch-pack-card')).toBeTruthy();
    expect(screen.getByText('vercors-boucle')).toBeTruthy();
    expect(screen.getAllByText('Disponible').length).toBeGreaterThan(0);
    expect(screen.getByText(/Recherche locale/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Vérifier/ }));
    expect(onVerify).toHaveBeenCalledWith('pack-1', 'checksum-ok');
  });

  it('désactive la vérification tant que tous les blocs ne sont pas reçus', () => {
    const pack = makePack({
      status: 'transferring',
      ackedChunkIndex: 0,
      totalChunks: 4,
      transferredBytes: 1024,
    });
    render(<WatchPacksScreen packs={[pack]} availableStorageBytes={0} onVerify={async () => {}} />);
    const button = screen.getByRole('button', { name: /Vérifier/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});

function EditorHarness() {
  const [pages, setPages] = useState<WatchNavigationFieldKey[][]>([
    ['distance_total_m'],
  ]);
  return (
    <WatchCustomFieldsEditor pages={pages} maxSlotsPerPage={2} onChange={setPages} />
  );
}

describe('D03 — éditeur de champs', () => {
  it('ajoute un champ puis une page sans dépasser la limite', () => {
    render(<EditorHarness />);
    const select = screen.getByLabelText(/Ajouter un champ à la page 1/);
    fireEvent.change(select, { target: { value: 'heart_rate_bpm' } });
    expect(screen.getByText('2/2 champs')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Ajouter une page/ }));
    expect(screen.getByText('Page 2')).toBeTruthy();
  });
});

describe('D03 — client API', () => {
  it('expose les mêmes libellés que le contrat et ne remplace pas une erreur par un succès', async () => {
    const api = createFakeApi();
    const status = await api.getStatus();
    expect(status.ficheIds).toEqual(['K6.09', 'K6.10', 'K6.11', 'S6.01', 'S6.02']);

    const failing = createFakeApi({
      async listPacks() {
        throw new Error('Panne de lecture.');
      },
    });
    await expect(failing.listPacks()).rejects.toThrow('Panne de lecture.');
  });
});
