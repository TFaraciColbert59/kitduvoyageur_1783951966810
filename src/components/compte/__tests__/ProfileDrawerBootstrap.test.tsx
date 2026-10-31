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

vi.mock('@/components/compte/map/CompteMap', () => ({
  CompteMap: () => null,
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

import { setMyTripsAuthUser } from '@/features/trips/client/fetchMyTrips';
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
  mocks.auth.user = { id: 'owner-1', email: 'owner@lkdv.test' };
  mocks.auth.loading = false;
  mocks.router.push.mockClear();
  setMyTripsAuthUser('owner-1', true);
  localStorage.clear();
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
    expect(ownerEntries().invitations).toBeNull();

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


describe('Compte — isolation entre identités', () => {
  const current = () => (window as any).__lkdvGetState?.().S;
  async function switchAccount(view: ReturnType<typeof render>, id: string | null) {
    mocks.auth.user = id ? { id, email: `${id}@lkdv.test` } : null;
    setMyTripsAuthUser(id);
    await act(async () => view.rerender(<CompteLiquidGlassV8 />));
  }

  it('ignore le bootstrap de A résolu après le passage à B', async () => {
    const pending = deferredBootstrap();
    bootstrapAnswer = () => pending.promise;
    const view = await renderCompte();
    await waitFor(() => expect(bootstrapCalls).toBe(1));
    bootstrapAnswer = () => Promise.resolve(okResponse({ ...BOOTSTRAP_PAYLOAD, profile: { handle: 'compte-b' } }));
    await switchAccount(view, 'owner-2');
    await waitFor(() => expect(current()?.profile.handle).toBe('compte-b'));
    await act(async () => pending.resolve(okResponse({ ...BOOTSTRAP_PAYLOAD, profile: { handle: 'compte-a' } })));
    expect(current()?.profile.handle).toBe('compte-b');
  });

  it('ignore aussi le JSON de A si le changement survient après les en-têtes', async () => {
    const body = deferredBootstrap();
    bootstrapAnswer = () => Promise.resolve({ ok: true, json: () => body.promise });
    const view = await renderCompte();
    await waitFor(() => expect(bootstrapCalls).toBe(1));
    bootstrapAnswer = () => Promise.resolve(okResponse({ ...BOOTSTRAP_PAYLOAD, profile: { handle: 'compte-b' } }));
    await switchAccount(view, 'owner-2');
    await waitFor(() => expect(current()?.profile.handle).toBe('compte-b'));
    await act(async () => body.resolve({ ...BOOTSTRAP_PAYLOAD, profile: { handle: 'compte-a' } }));
    expect(current()?.profile.handle).toBe('compte-b');
  });

  it('invalide une ancienne recherche catalogue et son callback', async () => {
    const view = await renderCompte();
    const answer = deferredBootstrap();
    const callback = vi.fn();
    const fetchMock = vi.fn(() => answer.promise);
    vi.stubGlobal('fetch', fetchMock);
    const oldLookup = (window as any).__lkdvScanLookup;
    const task = oldLookup('sac A', callback);
    await switchAccount(view, 'owner-2');
    await act(async () => answer.resolve(okResponse({ items: [{ id: 'a', name: 'Sac A' }] })));
    await task;
    expect(callback).not.toHaveBeenCalled();
  });

  it('ne télécharge pas un export de A reçu après passage à B', async () => {
    const view = await renderCompte();
    const body = deferredBootstrap();
    const download = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: download });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: () => body.promise })));
    let task: Promise<void>;
    act(() => { task = (window as any).__lkdvOnAction('export', 'full', current()); });
    await switchAccount(view, 'owner-2');
    await act(async () => body.resolve('{"private":"A"}'));
    await task!;
    expect(download).not.toHaveBeenCalled();
    delete (URL as any).createObjectURL;
  });

  it('ne réadopte pas les données locales historiques sans propriétaire', async () => {
    localStorage.setItem('lkdv_device_medical_vault_v1', JSON.stringify({ emergencyContact: 'PRIVATE_A' }));
    localStorage.setItem('lkdv_compte_v8_state_v1', JSON.stringify({ traveller: { home: 'PRIVATE_A' } }));
    await renderCompte();
    expect(JSON.stringify(current())).not.toContain('PRIVATE_A');
  });

  it('les mutations locales de A ne sont pas restaurées chez B', async () => {
    const view = await renderCompte();
    localStorage.setItem('lkdv_compte_v8_state_v1:owner-1', JSON.stringify({ traveller: { home: 'PRIVATE_A' } }));
    await switchAccount(view, 'owner-2');
    expect(JSON.stringify(current())).not.toContain('PRIVATE_A');
    expect(localStorage.getItem('lkdv_compte_v8_state_v1:owner-1')).toContain('PRIVATE_A');
  });

  it('une fermeture différée de A ne ferme pas le drawer de B', async () => {
    const view = await renderCompte();
    await openDrawer();
    await act(async () => (window as any).__lkdvCompteAct('close'));
    await switchAccount(view, 'owner-2');
    await openDrawer();
    await act(async () => new Promise(resolve => setTimeout(resolve, 650)));
    expect(document.getElementById('sw')?.getAttribute('data-det')).not.toBe('closed');
    expect(document.getElementById('lkdv-slot-root')).not.toBeNull();
  });

  it('reconstruit également une nouvelle session du même utilisateur', async () => {
    const view = await renderCompte();
    const previousOpen = (window as any).__lkdvOpenSlot;
    setMyTripsAuthUser('owner-1', true);
    await act(async () => view.rerender(<CompteLiquidGlassV8 />));
    expect((window as any).__lkdvOpenSlot).not.toBe(previousOpen);
    await openDrawer();
    expect(document.getElementById('lkdv-slot-root')).not.toBeNull();
  });

  it('un ancien handler ne peut pas ouvrir un drawer du nouveau compte', async () => {
    const view = await renderCompte();
    const oldOpen = (window as any).__lkdvOpenSlot;
    await switchAccount(view, 'owner-2');
    await act(async () => oldOpen('vitrine'));
    expect(document.getElementById('lkdv-slot-root')).toBeNull();
  });

  it('un ancien démontage de slot de A ne retire pas le portail de B', async () => {
    const view = await renderCompte();
    const oldUnmount = (window as any).__lkdvUnmountSlot;
    await switchAccount(view, 'owner-2');
    await openDrawer();
    const portal = shell();
    expect(portal).not.toBeNull();
    await act(async () => oldUnmount());
    expect(shell()).toBe(portal);
  });

  it('un ancien démontage de drawer de A ne retire pas le portail de B', async () => {
    const view = await renderCompte();
    const oldUnmount = (window as any).__lkdvUnmountDrawer;
    await switchAccount(view, 'owner-2');
    const root = document.getElementById('sheet');
    await act(async () => (window as any).__lkdvMountDrawer(root, 'pending', {}));
    expect(root?.textContent).toContain('Chargement…');
    await act(async () => oldUnmount());
    expect(root?.textContent).toContain('Chargement…');
  });

  it('un ancien lecteur de données de A ne retourne plus son état privé', async () => {
    const view = await renderCompte();
    const oldGetState = (window as any).__lkdvGetState;
    expect(oldGetState()).not.toBeNull();
    await switchAccount(view, 'owner-2');
    expect(oldGetState()).toBeNull();
    expect(current()).toBeTruthy();
  });

  it('un ancien callout carte de A ne transmet pas son outing au compte B', async () => {
    const view = await renderCompte();
    const oldOpenOuting = window.__lkdvCompteMapOpenOuting!;
    await switchAccount(view, 'owner-2');
    const currentAct = vi.fn();
    (window as any).__lkdvCompteAct = currentAct;
    await act(async () => oldOpenOuting('private-outing-a'));
    expect(currentAct).not.toHaveBeenCalled();
    await act(async () => window.__lkdvCompteMapOpenOuting?.('outing-b'));
    expect(currentAct).toHaveBeenCalledWith('openOutingDrawer', 'outing-b');
  });

  it('une ancienne action EXA de A ne ferme pas la publication ouverte chez B', async () => {
    const view = await renderCompte();
    const oldClose = (window as any).EXA.closePostModal;
    await switchAccount(view, 'owner-2');
    const modal = document.getElementById('post_modal_instagram')!;
    modal.classList.add('open');
    await act(async () => oldClose());
    expect(modal.classList.contains('open')).toBe(true);
    await act(async () => (window as any).EXA.closePostModal());
    expect(modal.classList.contains('open')).toBe(false);
  });

  it('une ancienne action EXA de A ne lit pas les champs médicaux de B', async () => {
    const view = await renderCompte();
    const oldSave = (window as any).EXA.vaultsave;
    await switchAccount(view, 'owner-2');
    const field = document.createElement('input');
    field.id = 'vf_doc';
    field.value = 'PRIVATE_DOCTOR_B';
    document.getElementById('sheet')!.appendChild(field);
    await act(async () => oldSave());
    expect(localStorage.getItem('lkdv_device_medical_vault_v1:owner-1')).toBeNull();
    expect(localStorage.getItem('lkdv_device_medical_vault_v1:owner-2')).toBeNull();
    await act(async () => (window as any).EXA.vaultsave());
    expect(localStorage.getItem('lkdv_device_medical_vault_v1:owner-2')).toContain('PRIVATE_DOCTOR_B');
  });

  it('la touche Échap fonctionne sans référence globale à un autre compte', async () => {
    const view = await renderCompte();
    expect(() => fireEvent.keyDown(document, { key: 'Escape' })).not.toThrow();
    await switchAccount(view, 'owner-2');
    await act(async () => (window as any).__lkdvHydrateCompte({ replace: true, carnets: [{ id: 'b-post', title: 'B', visibility: 'public' }] }));
    // Exercise the runtime modal fallback rather than the React overlay seam.
    delete (window as any).__lkdvOpenPost;
    (window as any).__lkdvLegacyPostModal = true;
    await act(async () => (window as any).EXA.openPostModal('b-post'));
    const modal = document.getElementById('post_modal_instagram')!;
    expect(modal.classList.contains('open')).toBe(true);
    await act(async () => fireEvent.keyDown(document, { key: 'Escape' }));
    expect(modal.classList.contains('open')).toBe(false);
    delete (window as any).__lkdvLegacyPostModal;
  });

  it('sans hôte React monté, le runtime attend le post du fil au lieu d’ouvrir l’ancien modal superposé', async () => {
    await renderCompte();
    delete (window as any).__lkdvOpenPost;
    delete (window as any).__lkdvLegacyPostModal;
    const opened = vi.fn();
    await act(async () => (window as any).EXA.openPostModal('c-post'));
    expect(document.getElementById('post_modal_instagram')?.classList.contains('open')).toBe(false);
    (window as any).__lkdvOpenPost = opened;
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 300)); });
    expect(opened).toHaveBeenCalledWith('c-post');
  });

  it('une déconnexion tardive de A ne redirige pas B', async () => {
    const logout = deferredBootstrap();
    mocks.signOut.mockImplementationOnce(() => logout.promise as Promise<void>);
    const view = await renderCompte();
    let task: Promise<void>;
    act(() => { task = (window as any).__lkdvOnAction('signout', null, current()); });
    await switchAccount(view, 'owner-2');
    await act(async () => logout.resolve(undefined));
    await task!;
    expect(mocks.router.push).not.toHaveBeenCalledWith('/connexion');
  });

  it('redirige la déconnexion seulement quand auth confirme une session nulle', async () => {
    const view = await renderCompte();
    await act(async () => (window as any).__lkdvOnAction('signout', null, current()));
    expect(mocks.router.push).not.toHaveBeenCalledWith('/connexion');
    await switchAccount(view, null);
    expect(mocks.router.push).toHaveBeenCalledWith('/connexion');
  });
});
