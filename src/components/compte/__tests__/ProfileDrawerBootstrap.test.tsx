// @vitest-environment jsdom
/**
 * Intégration réelle du drawer Profil sur `/compte`.
 *
 * Surface montée : `CompteLiquidGlassV8` tel quel — runtime vanilla, hôte
 * React (`ProfileDrawerHost`), coquille (`SlotShell`) et slots réels. Aucun
 * composant du drawer n'est remplacé : le test exerce le vrai chemin
 * `__lkdvOpenSlot` → `renderSheet` → `__lkdvMountSlot` → hôte.
 *
 * Seams mockés (aucun ne remplace la logique testée) :
 * - `@/contexts/AuthContext` : jsdom n'a pas de session Supabase ; le test
 *   fournit directement le `user` que le provider réel hydraterait. C'est le
 *   seam « session », pas le chemin bootstrap.
 * - `@/lib/supabase/client` : la première hydratation du profil interroge
 *   Supabase. Le client est remplacé par des requêtes vides résolues, pour
 *   laisser le test atteindre `/api/compte/bootstrap` sans réseau.
 * - `next/navigation` / `next/link` : pas d'App Router ni de contexte de
 *   navigation dans jsdom ; le routeur est un objet stable (un routeur
 *   recréé à chaque rendu relancerait l'effet de montage).
 * - `maplibre-gl` : jsdom n'a ni WebGL ni canvas ; la carte est décorative et
 *   hors du drawer. Le stub ne fournit que le strict nécessaire au runtime.
 * - `HTMLCanvasElement` : shim jsdom pour éviter les erreurs « Not
 *   implemented » de `getContext`/`toDataURL` (aucun comportement applicatif).
 *
 * Le réseau est le seul vrai mock de comportement : `fetch` route uniquement
 * `/api/compte/bootstrap` ; tout le reste répond `ok:false` pour que le host
 * retombe proprement sur ses valeurs vides.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() },
  signOut: vi.fn(async () => {}),
  auth: {
    user: { id: 'owner-1', email: 'owner@lkdv.test' } as { id: string; email: string } | null,
    loading: false,
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => mocks.router,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === 'string' ? href : '#'} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('maplibre-gl', () => ({
  Map: class {
    on = vi.fn();
    once = vi.fn();
    remove = vi.fn();
    addControl = vi.fn();
    getCanvas = () => document.createElement('canvas');
  },
  setWorkerUrl: vi.fn(),
  MercatorCoordinate: { fromLngLat: vi.fn() },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mocks.auth.user,
    loading: mocks.auth.loading,
    signOut: mocks.signOut,
  }),
}));

/** Requête Supabase vide, résolue : le host ne lit que `.data` / `.count`. */
function emptyQuery(result: unknown) {
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order', 'limit']) {
    query[method] = () => query;
  }
  query.maybeSingle = () => Promise.resolve(result);
  query.single = () => Promise.resolve(result);
  query.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return query;
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => emptyQuery({ data: null, error: null, count: 0 }),
  }),
}));

import { CompteLiquidGlassV8 } from '../CompteLiquidGlassV8';

const BOOTSTRAP_PAYLOAD = {
  authenticated: true,
  profile: { handle: 'owner', name: 'Propriétaire LKDV', avatarUrl: null },
  stats: {
    km: 137,
    dplus: 4567,
    outings: 5,
    nights: 4,
    massifs: 3,
    countries: 2,
  },
  stamps: [],
  reposts: [],
  badges: [],
  kits: [],
  gearItems: [],
  loans: [],
  trust: null,
  visibility: { profile: 'public', invited: false },
};

const BOOTSTRAP_ERROR = {
  authenticated: false,
  error: 'bootstrap_unavailable',
};

function okResponse(json: unknown) {
  return { ok: true, status: 200, json: async () => json };
}

let bootstrapCalls = 0;
let bootstrapAnswer: () => Promise<unknown>;

function deferredBootstrap() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise<unknown>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  bootstrapCalls = 0;
  bootstrapAnswer = () => new Promise(() => {});
  vi.stubGlobal('fetch', (input: unknown) => {
    const url = String(input);
    if (url.includes('/api/compte/bootstrap')) {
      bootstrapCalls += 1;
      return bootstrapAnswer();
    }
    return Promise.resolve({ ok: false, status: 404, json: async () => null });
  });

  // jsdom n'implémente pas les opérations canvas utilisées par le runtime.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((type: string) => {
    if (type !== '2d') return null;
    return {
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: () => {},
      getImageData: (_x: number, _y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
      }),
      drawImage: () => {},
    } as unknown as CanvasRenderingContext2D;
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (window as any).__lkdvMountSlot;
  delete (window as any).__lkdvUnmountSlot;
  delete (window as any).__lkdvOpenSlot;
  delete (window as any).__lkdvCompteAct;
});

async function renderCompte(initialTab?: string) {
  const view = render(<CompteLiquidGlassV8 initialTab={initialTab} />);
  await waitFor(() => expect(typeof (window as any).__lkdvOpenSlot).toBe('function'));
  return view;
}

async function openDrawer(slot = 'vitrine') {
  await act(async () => {
    (window as any).__lkdvOpenSlot(slot);
  });
}

function shell() {
  return document.querySelector('.lkdv-slot-shell') as HTMLElement | null;
}

function ownerEntries() {
  return {
    invitations: screen.queryByRole('button', { name: 'Gérer les invitations' }),
  };
}

describe('Compte — bootstrap du drawer Profil', () => {
  it("n'affiche aucune entrée propriétaire tant que le bootstrap n'a pas répondu", async () => {
    const boot = deferredBootstrap();
    bootstrapAnswer = () => boot.promise;

    await renderCompte();
    await openDrawer();

    await waitFor(() => expect(bootstrapCalls).toBe(1));
    await waitFor(() => expect(shell()).not.toBeNull());

    expect(shell()?.getAttribute('data-viewer')).toBe('visitor');
    expect(shell()?.getAttribute('data-state')).toBe('loading');
    const entries = ownerEntries();
    expect(entries.invitations).toBeNull();
  });

  it('après un bootstrap authentifié : entrées propriétaire et payload réel dans les slots', async () => {
    const boot = deferredBootstrap();
    bootstrapAnswer = () => boot.promise;

    await renderCompte();
    await openDrawer();
    await waitFor(() => expect(bootstrapCalls).toBe(1));
    await waitFor(() => expect(shell()?.getAttribute('data-viewer')).toBe('visitor'));

    await act(async () => {
      boot.resolve(okResponse(BOOTSTRAP_PAYLOAD));
    });

    await waitFor(() => expect(shell()?.getAttribute('data-viewer')).toBe('owner'));
    expect(shell()?.getAttribute('data-state')).toBe('ready');
    expect(ownerEntries().invitations).not.toBeNull();

    // Les slots rendent bien le payload du bootstrap, pas les données démo.
    await waitFor(() => expect(screen.getByText('137 km')).toBeTruthy());
  });

  it("affiche une erreur honnête et un nouvel essai quand le bootstrap échoue", async () => {
    bootstrapAnswer = () => Promise.resolve(okResponse(BOOTSTRAP_ERROR));

    await renderCompte();
    await openDrawer();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Impossible de charger ce profil.');
    expect(alert.textContent).not.toBe('');

    const entries = ownerEntries();
    expect(entries.invitations).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(bootstrapCalls).toBe(2));
    // L'état d'erreur reste honnête après un nouvel échec.
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it("ne suit pas le deep link ?tab=clubs avant la résolution du bootstrap", async () => {
    const boot = deferredBootstrap();
    bootstrapAnswer = () => boot.promise;

    await renderCompte('clubs');
    await waitFor(() => expect(bootstrapCalls).toBe(1));

    // Le runtime n'a pas encore monté #lkdv-slot-root : le drawer reste fermé.
    expect(document.getElementById('lkdv-slot-root')).toBeNull();
    expect(shell()).toBeNull();

    await act(async () => {
      boot.resolve(okResponse(BOOTSTRAP_PAYLOAD));
    });

    await waitFor(() => expect(shell()?.getAttribute('data-slot')).toBe('communaute'));
    expect(shell()?.getAttribute('data-viewer')).toBe('owner');
  });
});
