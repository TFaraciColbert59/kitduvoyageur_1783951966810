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

/**
 * Fixtures de lecture Supabase : seules `public_profiles`, `user_follows` et
 * `follow_requests` portent des lignes. Toutes les autres tables répondent
 * vide, comme le bootstrap du host l'attend.
 */
const supabaseState = vi.hoisted(() => ({
  rows: {} as Record<string, Array<Record<string, unknown>>>,
  errors: {} as Record<string, unknown>,
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

/**
 * Requête Supabase générique : filtres `.eq`, puis `limit` / `maybeSingle`.
 * Les lignes viennent de `supabaseState.rows[table]`, ce qui permet de
 * prouver la lecture de l'état de suivi sans simuler PostgREST.
 */
function tableQuery(table: string) {
  const filters: Array<[string, unknown]> = [];
  const matching = () =>
    (supabaseState.rows[table] ?? []).filter((row) =>
      filters.every(([column, value]) => row[column] === value)
    );
  const result = () => {
    if (supabaseState.errors[table]) {
      return { data: null, error: supabaseState.errors[table], count: null };
    }
    const rows = matching();
    return { data: rows, error: null, count: rows.length };
  };
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order']) {
    query[method] = (...args: unknown[]) => {
      if (method === 'eq') filters.push([String(args[0]), args[1]]);
      return query;
    };
  }
  query.limit = () => Promise.resolve(result());
  query.maybeSingle = () =>
    supabaseState.errors[table]
      ? Promise.resolve({ data: null, error: supabaseState.errors[table] })
      : Promise.resolve({ data: matching()[0] ?? null, error: null });
  query.single = () =>
    supabaseState.errors[table]
      ? Promise.resolve({ data: null, error: supabaseState.errors[table] })
      : Promise.resolve({ data: matching()[0] ?? null, error: null });
  query.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(result()).then(onFulfilled, onRejected);
  return query;
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => tableQuery(table),
    auth: {
      getUser: async () => ({
        data: { user: mocks.auth.user ? { id: mocks.auth.user.id } : null },
        error: null,
      }),
    },
  }),
}));

import { setMyTripsAuthUser } from '@/features/trips/client/fetchMyTrips';
import { followButtonLabel } from '../compte-liquid-glass-v8-runtime';
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
let bootstrapInits: RequestInit[] = [];
let followCalls: Array<{ url: string; init?: RequestInit }> = [];
let followAnswer: () => Promise<unknown>;

function deferredBootstrap() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise<unknown>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function deferredFollow() {
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
  supabaseState.rows = {};
  supabaseState.errors = {};
  bootstrapCalls = 0;
  bootstrapInits = [];
  followCalls = [];
  bootstrapAnswer = () => new Promise(() => {});
  followAnswer = () => Promise.resolve(okResponse({ status: 'following' }));
  vi.stubGlobal('fetch', (input: unknown, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/api/compte/bootstrap')) {
      bootstrapCalls += 1;
      bootstrapInits.push(init ?? {});
      return bootstrapAnswer();
    }
    if (url.includes('/api/compte/reseau/follow')) {
      followCalls.push({ url, init });
      return followAnswer();
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

  it('demande le bootstrap sans cache navigateur', async () => {
    bootstrapAnswer = () => Promise.resolve(okResponse(BOOTSTRAP_PAYLOAD));

    await renderCompte();
    await waitFor(() => expect(bootstrapCalls).toBe(1));

    expect(bootstrapInits[0]).toMatchObject({ cache: 'no-store' });
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

describe('Compte — pont de suivi runtime', () => {
  const runtimeState = () => (window as any).__lkdvGetState?.();

  beforeEach(() => {
    supabaseState.rows.public_profiles = [{ id: 'target-1', handle: 'alice' }];
    supabaseState.rows.user_follows = [];
    supabaseState.rows.follow_requests = [
      { requester_id: 'owner-1', target_id: 'target-1', status: 'pending' },
    ];
  });

  it('le runtime envoie bien { handle, followed } au pont puis à l’API', async () => {
    await renderCompte();
    await act(async () => {
      (window as any).__lkdvHydrateCompte({ followStates: { alice: 'none' } });
    });

    act(() => {
      (window as any).EXA.toggleFollowUser('alice');
    });

    await waitFor(() => expect(followCalls).toHaveLength(1));
    expect(followCalls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(followCalls[0].init?.body))).toEqual({ userId: 'target-1' });
    await waitFor(() => expect(runtimeState().followStates.alice).toBe('following'));
    expect(runtimeState().followPending.alice).toBeUndefined();
  });

  it('consomme { handle, followed } et appelle l’API avec la cible résolue', async () => {
    await renderCompte();
    let result: any;
    await act(async () => {
      result = await (window as any).__lkdvOnAction(
        'toggleFollowUser',
        { handle: 'alice', followed: true },
        runtimeState().S
      );
    });

    expect(followCalls).toHaveLength(1);
    expect(followCalls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(followCalls[0].init?.body))).toEqual({ userId: 'target-1' });
    expect(result).toMatchObject({ ok: true, status: 'following', state: 'following' });
    expect(runtimeState().followStates.alice).toBe('following');
  });

  it('rend la demande visible quand l’API répond requested', async () => {
    followAnswer = () => Promise.resolve(okResponse({ status: 'requested' }));
    await renderCompte();
    let result: any;
    await act(async () => {
      result = await (window as any).__lkdvOnAction(
        'toggleFollowUser',
        { handle: 'alice', followed: true },
        runtimeState().S
      );
    });

    expect(result).toMatchObject({ ok: true, status: 'requested', state: 'requested' });
    expect(runtimeState().followStates.alice).toBe('requested');
    expect(followButtonLabel(runtimeState().followStates.alice)).toBe('Demande envoyée');
  });

  it('restaure l’état confirmé avec hydrate après un échec de l’API', async () => {
    await renderCompte();
    await act(async () => {
      (window as any).__lkdvHydrateCompte({
        followStates: { alice: 'requested' },
      });
    });
    followAnswer = () =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: async () => ({ error: 'follow_failed' }),
      });

    let result: any;
    await act(async () => {
      result = await (window as any).__lkdvOnAction(
        'toggleFollowUser',
        { handle: 'alice', followed: false },
        runtimeState().S
      );
    });

    expect(followCalls[0].init?.method).toBe('DELETE');
    expect(result).toMatchObject({
      ok: false,
      code: 'follow_failed',
      state: 'requested',
      restored: true,
    });
    expect(runtimeState().followStates.alice).toBe('requested');
    expect(runtimeState().followPending.alice).toBeUndefined();
  });

  it('retourne un échec explicite quand le vrai hydrate est absent', async () => {
    await renderCompte();
    delete (window as any).__lkdvHydrateCompte;
    followAnswer = () =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: async () => ({ error: 'follow_failed' }),
      });

    let result: any;
    await act(async () => {
      result = await (window as any).__lkdvOnAction(
        'toggleFollowUser',
        { handle: 'alice', followed: true },
        runtimeState().S
      );
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'follow_failed',
      restored: false,
    });
  });

  it('désactive les doubles clics pendant la requête', async () => {
    const pending = deferredFollow();
    followAnswer = () => pending.promise;
    await renderCompte();

    let first!: Promise<unknown>;
    act(() => {
      first = (window as any).__lkdvOnAction(
        'toggleFollowUser',
        { handle: 'alice', followed: true },
        runtimeState().S
      );
    });
    const second = await (window as any).__lkdvOnAction(
      'toggleFollowUser',
      { handle: 'alice', followed: true },
      runtimeState().S
    );

    expect(second).toMatchObject({ ok: false, code: 'in_flight', restored: false });
    await act(async () => pending.resolve(okResponse({ status: 'following' })));
    await act(async () => {
      await first;
    });
    expect(followCalls).toHaveLength(1);
  });

  it('applique le retour explicite du pont quand le vrai hydrate manque', async () => {
    await renderCompte();
    delete (window as any).__lkdvHydrateCompte;
    followAnswer = () =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: async () => ({ error: 'follow_failed' }),
      });

    act(() => {
      (window as any).EXA.toggleFollowUser('alice');
    });

    await waitFor(() => {
      expect(runtimeState().followStates.alice).toBe('requested');
      expect(runtimeState().followPending.alice).toBeUndefined();
    });
  });

  it('hydrate une demande sortante au chargement, avant toute action', async () => {
    bootstrapAnswer = () =>
      Promise.resolve(
        okResponse({
          ...BOOTSTRAP_PAYLOAD,
          followers: [
            {
              id: 'target-1',
              n: 'Alice',
              ps: 'alice',
              i: 'A',
              sub: 'Voyageuse',
              img: '',
            },
          ],
          followStates: { alice: 'requested' },
        })
      );

    await renderCompte();
    await waitFor(() => expect(bootstrapCalls).toBe(1));
    await waitFor(() => expect(runtimeState().followStates.alice).toBe('requested'));
    expect(runtimeState().followPending.alice).toBeUndefined();
    expect(followCalls).toHaveLength(0);

    await act(async () => {
      (window as any).__lkdvCompteAct('igtab', 2);
      (window as any).__lkdvCompteAct('toggleReseau', 'followers');
    });
    expect(document.body.textContent).toContain('Demande envoyée');
  });

  it('affiche le message d’erreur du pont et restaure le fallback', async () => {
    // Aucune demande pending : le rollback doit retomber sur l'état confirmé
    // d'avant la bascule, pas sur une demande supposée.
    supabaseState.rows.follow_requests = [];
    await renderCompte();
    await act(async () => {
      (window as any).__lkdvHydrateCompte({ followStates: { alice: 'none' } });
    });
    followAnswer = () =>
      Promise.resolve({
        ok: false,
        status: 409,
        json: async () => ({
          error: 'Cette demande de suivi est déjà close.',
          code: 'follow_request_closed',
        }),
      });

    act(() => {
      (window as any).EXA.toggleFollowUser('alice');
    });

    await waitFor(() =>
      expect(document.getElementById('island')?.textContent).toContain(
        'Cette demande de suivi est déjà close.'
      )
    );
    expect(document.getElementById('island')?.textContent).toContain('Suivi impossible');
    expect(followCalls).toHaveLength(1);
    expect(runtimeState().followStates.alice).toBe('none');
    expect(runtimeState().followPending.alice).toBeUndefined();
    expect(document.getElementById('live-status')?.textContent).toContain(
      'Cette demande de suivi est déjà close.'
    );
  });

  it('nettoie la bascule quand le pont hôte est absent', async () => {
    await renderCompte();
    await act(async () => {
      (window as any).__lkdvHydrateCompte({ followStates: { alice: 'none' } });
    });
    delete (window as any).__lkdvOnAction;

    act(() => {
      (window as any).EXA.toggleFollowUser('alice');
    });

    await waitFor(() => expect(runtimeState().followPending.alice).toBeUndefined());
    expect(runtimeState().followStates.alice).toBe('none');
    expect(followCalls).toHaveLength(0);
    expect(document.getElementById('island')?.textContent).toContain(
      'Le suivi est momentanément indisponible.'
    );
  });

  it('refuse une cible privée absente de la vue publique sans appeler l’API', async () => {
    // `public_profiles` n'expose pas un profil privé sans invitation acceptée :
    // le pont doit s'arrêter avant toute mutation.
    supabaseState.rows.public_profiles = [];
    await renderCompte();

    let result: any;
    await act(async () => {
      result = await (window as any).__lkdvOnAction(
        'toggleFollowUser',
        { handle: 'alice', followed: true },
        runtimeState().S
      );
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'target_not_found',
      state: 'none',
      restored: true,
      message: 'Ce profil n’est plus disponible.',
    });
    expect(followCalls).toHaveLength(0);
    expect(runtimeState().followStates.alice).toBe('none');
  });

  it('ne laisse pas un bootstrap parti avant l’action écraser l’état confirmé', async () => {
    const boot = deferredBootstrap();
    bootstrapAnswer = () => boot.promise;
    followAnswer = () => Promise.resolve(okResponse({ status: 'requested' }));

    await renderCompte();
    await waitFor(() => expect(bootstrapCalls).toBe(1));

    let result: any;
    await act(async () => {
      result = await (window as any).__lkdvOnAction(
        'toggleFollowUser',
        { handle: 'alice', followed: true },
        runtimeState().S
      );
    });
    expect(result).toMatchObject({ ok: true, state: 'requested' });
    expect(runtimeState().followStates.alice).toBe('requested');

    // Snapshot parti avant la demande : il ne connaît pas encore `requested`.
    await act(async () => {
      boot.resolve(
        okResponse({
          ...BOOTSTRAP_PAYLOAD,
          profile: { ...BOOTSTRAP_PAYLOAD.profile, name: 'Snapshot différé' },
          followers: [],
          following: [],
          tribu: [],
          followStates: {},
        })
      );
    });

    await waitFor(() => expect(bootstrapCalls).toBe(1));
    // Le reste du bootstrap est bien appliqué : seul l'état de suivi local,
    // plus récent que le snapshot, est préservé.
    expect(runtimeState().S.profile.name).toBe('Snapshot différé');
    expect(runtimeState().followStates.alice).toBe('requested');
    expect(followButtonLabel(runtimeState().followStates.alice)).toBe('Demande envoyée');
    expect(runtimeState().followPending.alice).toBeUndefined();
  });

  it('remplace les états sur un payload complet : {} efface requested', async () => {
    await renderCompte();
    await act(async () => {
      (window as any).__lkdvHydrateCompte({ followStates: { alice: 'requested' } });
    });
    expect(runtimeState().followStates.alice).toBe('requested');

    await act(async () => {
      (window as any).__lkdvHydrateCompte({ replace: true, followStates: {} });
    });

    expect(runtimeState().followStates.alice).toBeUndefined();
    expect(followButtonLabel(runtimeState().followStates.alice)).toBe('Suivre');
  });

  it('conserve les états connus et le signale quand la lecture est partielle', async () => {
    const boot = deferredBootstrap();
    bootstrapAnswer = () => boot.promise;

    await renderCompte();
    await waitFor(() => expect(bootstrapCalls).toBe(1));
    await act(async () => {
      (window as any).__lkdvHydrateCompte({ followStates: { alice: 'requested' } });
    });

    await act(async () => {
      boot.resolve(
        okResponse({
          ...BOOTSTRAP_PAYLOAD,
          followStates: {},
          followStatesUnavailable: true,
        })
      );
    });

    await waitFor(() =>
      expect(document.getElementById('island')?.textContent).toContain(
        'État de suivi indisponible'
      )
    );
    expect(runtimeState().followStates.alice).toBe('requested');
  });

  it('conserve l’état connu quand le payload ne porte pas followStates', async () => {
    const boot = deferredBootstrap();
    bootstrapAnswer = () => boot.promise;

    await renderCompte();
    await waitFor(() => expect(bootstrapCalls).toBe(1));
    await act(async () => {
      (window as any).__lkdvHydrateCompte({ followStates: { alice: 'requested' } });
    });

    // Ancienne instance serveur ou payload partiel : l'absence du champ ne
    // doit pas être interprétée comme un ensemble vide.
    await act(async () => {
      boot.resolve(
        okResponse({
          ...BOOTSTRAP_PAYLOAD,
          profile: { ...BOOTSTRAP_PAYLOAD.profile, name: 'Payload sans états' },
          followers: [],
          following: [],
          tribu: [],
        })
      );
    });

    await waitFor(() => expect(runtimeState().S.profile.name).toBe('Payload sans états'));
    expect(runtimeState().followStates.alice).toBe('requested');
    expect(followButtonLabel(runtimeState().followStates.alice)).toBe('Demande envoyée');
  });

  it('conserve compteurs et listes quand les relations deviennent indisponibles', async () => {
    // Premier bootstrap réussi : les compteurs et les deux listes sont posés.
    bootstrapAnswer = () =>
      Promise.resolve(
        okResponse({
          ...BOOTSTRAP_PAYLOAD,
          profile: {
            ...BOOTSTRAP_PAYLOAD.profile,
            name: 'Relations disponibles',
            followersCount: 7,
            followingCount: 4,
          },
          followers: [{ id: 'f1', handle: 'alice', full_name: 'Alice' }],
          following: [{ id: 'f2', handle: 'bruno', full_name: 'Bruno' }],
          tribu: [{ id: 'f2', handle: 'bruno', full_name: 'Bruno' }],
          followStates: { alice: 'requested' },
        })
      );

    await renderCompte();
    await waitFor(() => expect(bootstrapCalls).toBe(1));
    await waitFor(() => expect(runtimeState().followers).toHaveLength(1));
    expect(runtimeState().following).toHaveLength(1);

    // Rafraîchissement partiel : seules les listes échouent, les états restent
    // une lecture distincte et doivent continuer à s'appliquer.
    supabaseState.errors.user_follows = { message: 'relations indisponibles' };
    bootstrapAnswer = () =>
      Promise.resolve(
        okResponse({
          ...BOOTSTRAP_PAYLOAD,
          profile: { ...BOOTSTRAP_PAYLOAD.profile, name: 'Relations indisponibles' },
          followers: [],
          following: [],
          tribu: [],
          followListsUnavailable: true,
          followStates: { alice: 'following' },
        })
      );

    await act(async () => {
      window.dispatchEvent(new Event('lkdv:highlights-changed'));
    });
    await waitFor(() => expect(bootstrapCalls).toBe(2));
    await waitFor(() =>
      expect(runtimeState().S.profile.name).toBe('Relations indisponibles')
    );

    // Les compteurs et les listes connus ne sont pas remplacés par des zéros.
    expect(runtimeState().S.profile.followersCount).toBe(7);
    expect(runtimeState().S.profile.followingCount).toBe(4);
    expect(runtimeState().followers).toHaveLength(1);
    expect(runtimeState().following).toHaveLength(1);
    expect(runtimeState().followStates.alice).toBe('following');

    expect(document.getElementById('island')?.textContent).toContain(
      'Listes d’abonnés indisponibles'
    );
  });

  it('applique indépendamment la liste encore lisible lors d’un bootstrap partiel', async () => {
    bootstrapAnswer = () =>
      Promise.resolve(
        okResponse({
          ...BOOTSTRAP_PAYLOAD,
          profile: {
            ...BOOTSTRAP_PAYLOAD.profile,
            followersCount: 7,
            followingCount: 4,
          },
          followers: [{ id: 'f1', handle: 'alice', full_name: 'Alice' }],
          following: [{ id: 'f2', handle: 'bruno', full_name: 'Bruno' }],
          tribu: [{ id: 'f2', handle: 'bruno', full_name: 'Bruno' }],
        })
      );

    await renderCompte();
    await waitFor(() => expect(bootstrapCalls).toBe(1));
    await waitFor(() => expect(runtimeState().followers).toHaveLength(1));

    // Abonnés KO, suivis OK : la moitié valide doit être appliquée, l'autre
    // moitié conservée. Un indicateur global unique jetterait les deux.
    supabaseState.errors.user_follows = { message: 'compteurs indisponibles' };
    bootstrapAnswer = () =>
      Promise.resolve(
        okResponse({
          ...BOOTSTRAP_PAYLOAD,
          profile: { ...BOOTSTRAP_PAYLOAD.profile, followingCount: 1 },
          followers: [],
          following: [{ id: 'f3', handle: 'chloe', full_name: 'Chloé' }],
          tribu: [{ id: 'f3', handle: 'chloe', full_name: 'Chloé' }],
          followersUnavailable: true,
          followingUnavailable: false,
          followListsUnavailable: true,
        })
      );

    await act(async () => {
      window.dispatchEvent(new Event('lkdv:highlights-changed'));
    });
    await waitFor(() => expect(bootstrapCalls).toBe(2));

    await waitFor(() =>
      expect(runtimeState().following.map((entry: any) => entry.id)).toEqual(['f3'])
    );
    expect(runtimeState().followers.map((entry: any) => entry.id)).toEqual(['f1']);
    expect(runtimeState().S.profile.followersCount).toBe(7);
    expect(runtimeState().S.profile.followingCount).toBe(1);
  });

  it('préserve listes et compteurs après un échec puis « Réessayer »', async () => {
    bootstrapAnswer = () =>
      Promise.resolve(
        okResponse({
          ...BOOTSTRAP_PAYLOAD,
          profile: {
            ...BOOTSTRAP_PAYLOAD.profile,
            followersCount: 7,
            followingCount: 4,
          },
          followers: [{ id: 'f1', handle: 'alice', full_name: 'Alice' }],
          following: [{ id: 'f2', handle: 'bruno', full_name: 'Bruno' }],
          tribu: [{ id: 'f2', handle: 'bruno', full_name: 'Bruno' }],
        })
      );

    await renderCompte();
    await waitFor(() => expect(bootstrapCalls).toBe(1));
    await waitFor(() => expect(runtimeState().followers).toHaveLength(1));

    // Deuxième synchronisation en échec : le ref de payload est remis à null.
    supabaseState.errors.user_follows = { message: 'relations indisponibles' };
    bootstrapAnswer = () =>
      Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
    await act(async () => {
      window.dispatchEvent(new Event('lkdv:highlights-changed'));
    });
    await waitFor(() => expect(bootstrapCalls).toBe(2));

    // « Réessayer » depuis le drawer en erreur, puis succès partiel : les
    // listes connues ne doivent pas avoir été vidées avant la nouvelle lecture.
    await openDrawer();
    const retry = await screen.findByRole('button', { name: 'Réessayer' });
    bootstrapAnswer = () =>
      Promise.resolve(
        okResponse({
          ...BOOTSTRAP_PAYLOAD,
          profile: { ...BOOTSTRAP_PAYLOAD.profile, name: 'Après réessai' },
          followers: [],
          following: [],
          tribu: [],
          followListsUnavailable: true,
        })
      );
    fireEvent.click(retry);
    await waitFor(() => expect(bootstrapCalls).toBe(3));
    await waitFor(() => expect(runtimeState().S.profile.name).toBe('Après réessai'));

    expect(runtimeState().S.profile.followersCount).toBe(7);
    expect(runtimeState().S.profile.followingCount).toBe(4);
    expect(runtimeState().followers).toHaveLength(1);
    expect(runtimeState().following).toHaveLength(1);
  });

  it('ignore les zéros d’un ancien payload social partiel', async () => {
    bootstrapAnswer = () =>
      Promise.resolve(
        okResponse({
          ...BOOTSTRAP_PAYLOAD,
          profile: {
            ...BOOTSTRAP_PAYLOAD.profile,
            followersCount: 7,
            followingCount: 4,
          },
          followers: [{ id: 'f1', handle: 'alice', full_name: 'Alice' }],
          following: [{ id: 'f2', handle: 'bruno', full_name: 'Bruno' }],
          tribu: [{ id: 'f2', handle: 'bruno', full_name: 'Bruno' }],
        })
      );

    await renderCompte();
    await waitFor(() => expect(bootstrapCalls).toBe(1));
    await waitFor(() => expect(runtimeState().following).toHaveLength(1));

    // Ancienne instance serveur : pas de `followListsUnavailable`, mais un
    // échec d'états et des compteurs/listes à zéro. Ces zéros ne doivent pas
    // écraser un état connu plus fiable.
    supabaseState.errors.user_follows = { message: 'relations indisponibles' };
    bootstrapAnswer = () =>
      Promise.resolve(
        okResponse({
          ...BOOTSTRAP_PAYLOAD,
          profile: {
            ...BOOTSTRAP_PAYLOAD.profile,
            followersCount: 0,
            followingCount: 0,
          },
          followers: [],
          following: [],
          tribu: [],
          followStates: {},
          followStatesUnavailable: true,
        })
      );

    await act(async () => {
      window.dispatchEvent(new Event('lkdv:highlights-changed'));
    });
    await waitFor(() => expect(bootstrapCalls).toBe(2));
    await waitFor(() =>
      expect(document.getElementById('island')?.textContent).toContain(
        'État de suivi indisponible'
      )
    );

    expect(runtimeState().S.profile.followersCount).toBe(7);
    expect(runtimeState().S.profile.followingCount).toBe(4);
    expect(runtimeState().followers).toHaveLength(1);
    expect(runtimeState().following).toHaveLength(1);
  });

  it('préserve le profil connu quand sa lecture est indisponible', async () => {
    bootstrapAnswer = () =>
      Promise.resolve(
        okResponse({
          ...BOOTSTRAP_PAYLOAD,
          profile: {
            ...BOOTSTRAP_PAYLOAD.profile,
            name: 'Propriétaire LKDV',
            handle: 'owner',
          },
        })
      );

    await renderCompte();
    await waitFor(() => expect(bootstrapCalls).toBe(1));
    await waitFor(() => expect(runtimeState().S.profile.name).toBe('Propriétaire LKDV'));
    expect(runtimeState().S.profile.handle).toBe('owner');

    // Profil illisible : ni « Voyageur » ni handle générique ne doivent
    // remplacer l'identité déjà connue.
    bootstrapAnswer = () =>
      Promise.resolve(
        okResponse({
          authenticated: true,
          profileUnavailable: true,
          stats: BOOTSTRAP_PAYLOAD.stats,
          followers: [],
          following: [],
          tribu: [],
          followStates: {},
        })
      );

    await act(async () => {
      window.dispatchEvent(new Event('lkdv:highlights-changed'));
    });
    await waitFor(() => expect(bootstrapCalls).toBe(2));

    expect(runtimeState().S.profile.name).toBe('Propriétaire LKDV');
    expect(runtimeState().S.profile.handle).toBe('owner');
  });
});
