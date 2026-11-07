// @vitest-environment jsdom
// P4.5 — Thumb : les constructeurs de vignettes ne sont enregistrés qu'une fois par session
// (REVIEW T22 `ui/Thumb.tsx:23-24` : `registerThumbBuilders()` était rappelé à chaque montage de carte).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => {
  const engine = {
    register: () => {},
    request: () => {},
    get: () => null,
    subscribe: () => () => {},
    cancel: () => {},
    revokeAll: () => {},
    dispose: () => {},
    stats: () => ({ renders: 0, queued: 0, cached: 0, available: false, lost: false, resources: { geometries: 0, materials: 0, textures: 0 } }),
  };
  return { engine, registerThumbBuilders: vi.fn(), getThumbnailEngine: vi.fn(() => engine) };
});

vi.mock('../scene/thumbnails', () => ({ getThumbnailEngine: mocks.getThumbnailEngine }));
vi.mock('../scene/thumbBuilders', () => ({ registerThumbBuilders: mocks.registerThumbBuilders }));

import { Thumb } from '../ui/Thumb';
import type { ItemThumbSpec } from '../scene/thumbnails';

const spec: ItemThumbSpec = { kind: 'i', id: 'p4', shape: 'bag', glyph: 'cube', color: 'rgb(1, 2, 3)', liters: 1, planned: false };
const fallback = <span>repli</span>;

afterEach(cleanup);

describe('P4.5 — Thumb : garde d’idempotence au niveau module', () => {
  it('deux montages successifs de carte : un seul registerThumbBuilders', async () => {
    // Deux cartes montées en parallèle demandent deux imports dynamiques concurrents du module mocké ;
    // le second ne se résout pas dans l'environnement Vitest (limite de l'outil, pas du composant).
    // Le scénario de la revue est le rappel à chaque montage : on le rejoue séquentiellement.
    const first = render(<Thumb thumbKey="i:p4" spec={spec} fallback={fallback} />);
    await waitFor(() => expect(mocks.getThumbnailEngine).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.registerThumbBuilders).toHaveBeenCalledTimes(1));

    first.unmount();
    render(<Thumb thumbKey="i:p4b" spec={{ ...spec, id: 'p4b' }} fallback={fallback} />);
    await waitFor(() => expect(mocks.getThumbnailEngine).toHaveBeenCalledTimes(2));
    expect(mocks.registerThumbBuilders).toHaveBeenCalledTimes(1);
  });
});
