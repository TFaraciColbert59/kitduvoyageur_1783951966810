// @vitest-environment jsdom
// P4 — tests de non-régression de la dette de la revue indépendante T22 (docs/kit-studio/REVIEW.md).
// Un test par point fermé ; les points déjà conformes dans l'arbre (T23) sont verrouillés ici.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ACESFilmicToneMapping, Group, Mesh, PCFShadowMap } from 'three';
import type { Material } from 'three';
import { canAddModule } from '../domain/attach';
import { cog, cogState } from '../domain/balance';
import { COLORWAYS, ITEMS, MODULE_IDS } from '../domain/catalog';
import { formatEuro } from '../domain/format';
import { setBag } from '../domain/packing';
import { modOn, setMod } from '../domain/parts';
import { createInitialState } from '../domain/state';
import { studioData } from '../domain/studioData';
import { toCents, totals } from '../domain/totals';
import type { ExtraItem, KitState } from '../domain/types';
import { createThumbnailEngine, THUMB_PRIORITY } from '../scene/thumbnails';
import type { ItemThumbSpec, ThumbnailEngine, ThumbnailEngineOptions, ThumbRendererLike } from '../scene/thumbnails';
import { useKitStore } from '../store/kitStore';
import { BagSheet } from '../ui/sheets/BagSheet';
import { BilanSheet } from '../ui/sheets/BilanSheet';
import { BalanceChart } from '../ui/sheets/BalanceChart';
import { ItemSheet } from '../ui/sheets/ItemSheet';
import { OrderSheet, useControlledPage } from '../ui/sheets/OrderSheet';
import { optionCards } from '../ui/cards/cardsData';

const NBSP = '\u00a0';
const ROOT = join(__dirname, '../../../..');
const KS = join(ROOT, 'src/features/kit-studio');
const read = (p: string): string => readFileSync(join(KS, p), 'utf8');

/** Échappe un sélecteur CSS pour l'utiliser dans une RegExp. */
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Corps d'une ou plusieurs règles CSS d'un sélecteur exact (le contenu entre accolades). */
function cssRules(css: string, selector: string): string[] {
  const re = new RegExp(`${escapeRe(selector)}\\s*\\{([^}]*)\\}`, 'g');
  return [...css.matchAll(re)].map((m) => m[1]);
}

const item = (id: string) => {
  const it = ITEMS.find((x) => x.id === id);
  if (!it) throw new Error(id);
  return it;
};

/** État TMB avec une pièce prévue à l'achat (149 €) et une à la location (25 €/j × 6 j). */
function withPlanned(): KitState {
  const s0 = createInitialState('tmb');
  const extras = [
    { ...item('hat'), id: 'p4-shop', g: 100, L: 1, planned: 'shop', eur: 149 },
    { ...item('hat'), id: 'p4-rent', g: 200, L: 2, planned: 'rent', day: 25 },
  ] as unknown as ExtraItem[];
  const k = s0.kits.tmb;
  return {
    ...s0,
    extraItems: extras,
    kits: { ...s0.kits, tmb: { ...k, packed: { ...k.packed, main: [...k.packed.main, 'p4-shop', 'p4-rent'] } } },
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/* ───────────── 1. totals.ts : centimes exposés, plus de ×100 manuel ───────────── */

describe('P4.1 — totaux en centimes (REVIEW totals.ts:151)', () => {
  it('totals() expose buyCents/rentCents : une seule conversion, arrondie une fois', () => {
    const t = totals(withPlanned());
    expect([t.buy, t.rent]).toEqual([149, 150]);
    expect([t.buyCents, t.rentCents]).toEqual([14900, 15000]);
    // Valeur vide : 0 centime, jamais NaN.
    const z = totals(createInitialState());
    expect([z.buy, z.buyCents, z.rent, z.rentCents]).toEqual([0, 0, 0, 0]);
  });

  it('toCents est la seule conversion euros → centimes (arrondi au centime)', () => {
    expect(toCents(149)).toBe(14900);
    expect(toCents(24.999)).toBe(2500);
    expect(toCents(0)).toBe(0);
  });

  it('BilanSheet affiche 149 €, pas 14 900 € (site d’affichage BilanSheet.tsx)', () => {
    render(<BilanSheet state={withPlanned()} page={3} onPage={() => {}} onAction={() => {}} onBack={() => {}} />);
    const p = [...document.querySelectorAll('p.ks-bl-t13')].find((el) => el.textContent?.includes('À acheter'));
    expect(p?.textContent).toContain(`À acheter${NBSP}: 149${NBSP}€`);
    expect(p?.textContent).toContain(`À louer${NBSP}: 150${NBSP}€`);
    expect(p?.textContent).not.toContain('14 900');
    expect(p?.textContent).not.toContain('15 000');
  });

  it('ItemSheet affiche le prix de l’objet planifié, pas ×100 (site ItemSheet.tsx)', () => {
    render(<ItemSheet state={withPlanned()} itemId="p4-shop" page={0} onPage={() => {}} onAction={() => {}} onBack={() => {}} />);
    expect(document.body.textContent).toContain(`Boutique LKDV · 149${NBSP}€`);
    expect(document.body.textContent).not.toContain('14 900');
    cleanup();
    render(<ItemSheet state={withPlanned()} itemId="p4-rent" page={0} onPage={() => {}} onAction={() => {}} onBack={() => {}} />);
    expect(document.body.textContent).toContain(`Location entre membres · 25${NBSP}€ par jour`);
  });

  it('ItemSheet page Histoire : prix d’achat en euros converti une fois (site ItemSheet.tsx:213)', () => {
    const s0 = createInitialState('tmb');
    const priced = { ...item('hat'), id: 'p4-price', price: 149 } as unknown as ExtraItem;
    const s: KitState = { ...s0, extraItems: [...s0.extraItems, priced] };
    render(<ItemSheet state={s} itemId="p4-price" page={1} onPage={() => {}} onAction={() => {}} onBack={() => {}} />);
    expect(document.body.textContent).toContain(`149${NBSP}€`);
    expect(document.body.textContent).not.toContain('14 900');
  });

  it('BagSheet affiche le prix d’une pièce à commander, pas ×100 (site BagSheet.tsx:63)', () => {
    const s = createInitialState();
    const bag = s.kits.tmb.bag;
    const c = s.config[bag];
    const sauge = { ...s, config: { ...s.config, [bag]: { ...c, body: { ...c.body, col: COLORWAYS.sauge.body } } } };
    render(<BagSheet state={sauge} onChange={() => {}} />);
    expect(document.body.textContent).toContain(`À commander · 149${NBSP}€`);
    expect(document.body.textContent).not.toContain('14 900');
  });

  it('cardsData affiche le supplément d’un module en euros, pas ×100 (site cardsData.ts:121)', () => {
    const cards = optionCards(createInitialState(), 'all', 'mod');
    const paid = cards.filter((c) => (MODULE_IDS as readonly string[]).includes(c.id) && c.sub.startsWith('+'));
    expect(paid.length).toBeGreaterThan(0);
    for (const c of paid) {
      const mod = studioData().one.mods[c.id as (typeof MODULE_IDS)[number]];
      expect(c.sub).toBe(`+${formatEuro(toCents(mod.eur))}`);
    }
  });
});

/* ───────────── 2. balance.ts : cog() sans NaN ───────────── */

describe('P4.2 — cog() ne divise jamais par un poids nul (REVIEW balance.ts:34)', () => {
  it('reste fini sur tous les kits et tous les jours', () => {
    for (const kit of ['tmb', 'vercors', 'cabine'] as const) {
      const s = createInitialState(kit);
      for (let d = 1; d <= s.kits[kit].days; d++) {
        const c = cog({ ...s, day: d });
        expect([Number.isFinite(c.x), Number.isFinite(c.y), Number.isFinite(c.z)]).toEqual([true, true, true]);
      }
    }
  });

  it('sac sans pièce pesée (masse nulle) : retour {0,0,0}, jamais NaN', async () => {
    // Le catalogue livré pèse toujours ≥ 900 g (aucun état réel ne donne M = 0) : on simule la
    // précondition de la revue en neutralisant bagWeight, pour verrouiller la garde `!(M > 0)`.
    vi.resetModules();
    vi.doMock('../domain/totals', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../domain/totals')>();
      return { ...actual, bagWeight: () => 0 };
    });
    const { cog: guardedCog } = await import('../domain/balance');
    const { createInitialState: fresh } = await import('../domain/state');
    const base = fresh('tmb');
    const k = base.kits.tmb;
    const empty: KitState = {
      ...base,
      kits: { ...base.kits, tmb: { ...k, packed: { worn: [], lid: [], main: [], front: [], sides: [], hip: [], back: [] } } },
    };
    const c = guardedCog(empty);
    expect(c).toEqual({ x: 0, y: 0, z: 0 });
    expect(Number.isNaN(c.x) || Number.isNaN(c.y) || Number.isNaN(c.z)).toBe(false);
    vi.doUnmock('../domain/totals');
    vi.resetModules();
  });

  it('BalanceChart (SVG) ne reçoit jamais NaN, même pour un centre de gravité nul', () => {
    const verdict = cogState({ x: 0, y: 0, z: 0 });
    const html = renderToStaticMarkup(<BalanceChart cog={{ x: 0, y: 0, z: 0 }} verdict={verdict} />);
    expect(html).not.toContain('NaN');
    expect(html).toContain('<svg');
    const real = cog(createInitialState('tmb'));
    const realHtml = renderToStaticMarkup(<BalanceChart cog={real} verdict={cogState(real)} />);
    expect(realHtml).not.toContain('NaN');
  });
});

/* ───────────── 3. CSS : cible tactile des capsules ≥ 44 px (même à 5 éléments) ───────────── */

describe('P4.3 — cible tactile des capsules (REVIEW kit-studio.css:365-368)', () => {
  const css = read('ui/kit-studio.css');

  it('une seule règle ::after, centrée, et elle n’écrase plus left: 50% (pas d’inset -10px 0)', () => {
    const rules = cssRules(css, '.ks-caps button::after');
    expect(rules).toHaveLength(1);
    expect(rules[0]).toContain('left: 50%');
    expect(rules[0]).toContain('transform: translate(-50%, -50%)');
    expect(rules[0]).toContain('width: max(44px, var(--bw, 44px))');
    expect(rules[0]).toContain('height: 44px');
    expect(css).not.toContain('inset: -10px 0');
  });

  it('5 éléments (--bw = 38 px) : la largeur de cible reste max(44, 38) = 44 px', () => {
    // Capsule.tsx réduit le visuel à 38 px au-delà de 4 éléments ; la zone de toucher doit compenser.
    expect(read('ui/Drawer/Capsule.tsx')).toMatch(/items\.length > 4\s*\?\s*38\s*:\s*44/);
    const widthRule = cssRules(css, '.ks-caps button::after')[0].match(/width:\s*max\((\d+)px,\s*var\(--bw,\s*(\d+)px\)\)/);
    expect(widthRule).not.toBeNull();
    const [, floor, fallback] = widthRule!;
    expect(Math.max(Number(floor), 38)).toBeGreaterThanOrEqual(44);
    expect(Number(floor)).toBe(44);
    expect(Math.max(Number(floor), Number(fallback))).toBe(44);
    // jsdom ne calcule aucune géométrie (clientWidth = 0, pas de moteur CSS) : une mesure de layout
    // réelle n'est pas fiable ici. Le test verrouille donc la règle qui garantit les 44 px ;
    // la mesure pixel est couverte par le banc Playwright WebKit (tests/e2e-kit-studio).
  });
});

/* ───────────── 8. CSS : cible tactile du Grabber flottant ≥ 44 px ───────────── */

describe('P4.8 — cible tactile du Grabber (REVIEW Grab.tsx:66-75)', () => {
  const css = read('ui/kit-studio.css');

  it('le bouton visuel fait 30 px de haut mais son ::after étend la cible à 44 px', () => {
    const button = cssRules(css, '.ks-grabber')[0];
    expect(button).toContain('height: 30px');
    const hit = cssRules(css, '.ks-grabber::after')[0];
    expect(hit).toContain('height: 44px');
    expect(hit).toContain('top: 50%');
    expect(hit).toContain('transform: translateY(-50%)');
    const heightPx = Number(hit.match(/height:\s*(\d+)px/)![1]);
    expect(heightPx).toBeGreaterThanOrEqual(44);
    expect(read('ui/Drawer/Grab.tsx')).toMatch(/className="ks-grabber"/);
  });
});

/* ───────────── 4. thumbnails.ts : un seul dispose par matériau ───────────── */

interface FakeRenderer extends ThumbRendererLike {
  renders: number;
  disposed: boolean;
}

describe('P4.4 — cleanup() des vignettes ne libère chaque matériau qu’une fois (REVIEW thumbnails.ts:394-401)', () => {
  let engine: ThumbnailEngine | null = null;
  const materials: Material[] = [];
  const disposeCount = new Map<Material, number>();

  beforeEach(() => {
    materials.length = 0;
    disposeCount.clear();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const rendererFactory = (canvas: HTMLCanvasElement): FakeRenderer => {
      const r: FakeRenderer = {
        domElement: canvas,
        shadowMap: { enabled: false, type: PCFShadowMap },
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 1,
        outputColorSpace: 'srgb',
        capabilities: { getMaxAnisotropy: () => 4 },
        renders: 0,
        disposed: false,
        setPixelRatio() {},
        setSize() {},
        setClearColor() {},
        render() { r.renders += 1; },
        dispose() { r.disposed = true; },
      };
      return r;
    };
    const options: ThumbnailEngineOptions = {
      rendererFactory,
      encode: () => Promise.resolve(new Blob(['png'], { type: 'image/png' })),
      createUrl: () => 'blob:p4',
      revokeUrl: () => {},
      schedule: (run) => { queueMicrotask(run); return () => {}; },
      builders: {
        i: (spec, res) => {
          const g = new Group();
          // Deux maillages, deux matériaux privés : chacun ne doit être disposé qu'une fois.
          for (const y of [-0.2, 0.2]) {
            const mat = res.material(spec.color);
            const mesh = new Mesh(res.roundedBox(0.5, 0.3, 0.3, 0.05, 3), mat);
            mesh.position.y = y;
            materials.push(mat);
            mat.addEventListener('dispose', () => {
              disposeCount.set(mat, (disposeCount.get(mat) ?? 0) + 1);
            });
            g.add(mesh);
          }
          return g;
        },
      },
    };
    engine = createThumbnailEngine(options);
  });

  afterEach(() => {
    engine?.dispose();
    engine = null;
  });

  it('un seul dispose par matériau après le rendu (traverse suffit, pas de boucle mats)', async () => {
    const spec: ItemThumbSpec = { kind: 'i', id: 'p4', shape: 'bag', glyph: 'cube', color: 'rgb(1, 2, 3)', liters: 1, planned: false };
    engine!.request('i:p4:bag', { spec, priority: THUMB_PRIORITY.visible });
    await vi.waitFor(() => expect(materials.length).toBe(2));
    await vi.waitFor(() => expect(disposeCount.get(materials[0]) ?? 0).toBe(1));
    expect([...disposeCount.values()]).toEqual([1, 1]);
    for (const mat of materials) expect(disposeCount.get(mat)).toBe(1);
  });
});

/* ───────────── 5. Thumb / registerThumbBuilders : enregistrement idempotent ───────────── */

describe('P4.5 — registerThumbBuilders() idempotent (REVIEW Thumb.tsx:23-24)', () => {
  it('deux appels n’enregistrent chaque constructeur qu’une fois (garde de module)', async () => {
    vi.resetModules();
    const registerBuilder = vi.fn();
    vi.doMock('../scene/thumbnails', () => ({ registerBuilder }));
    const mod = await import('../scene/thumbBuilders');
    mod.registerThumbBuilders();
    mod.registerThumbBuilders();
    mod.registerThumbBuilders();
    expect(registerBuilder).toHaveBeenCalledTimes(3);
    expect(registerBuilder.mock.calls.map((c) => c[0])).toEqual(['i', 'b', 'm']);
    vi.doUnmock('../scene/thumbnails');
    vi.resetModules();
  });
});

/* ───────────── 6. kitStore.toggleModule : 'noop' distinct de 'points' ───────────── */

describe('P4.6 — toggleModule distingue noop de points (REVIEW kitStore.ts:144)', () => {
  /** État où au moins un module est éteint faute de points d'attache (même montage que sheets.order). */
  function fullAttach(): { state: KitState; blocked: ModuleId2 } {
    let s = setBag(createInitialState(), 'b28').state;
    for (const m of MODULE_IDS) s = setMod(s, m, false);
    for (const m of MODULE_IDS) if (canAddModule(s, m)) s = setMod(s, m, true);
    const blocked = MODULE_IDS.find((m) => !modOn(s, m) && !canAddModule(s, m));
    if (!blocked) throw new Error('aucun module refusé : le jeu de données a changé');
    return { state: s, blocked };
  }
  type ModuleId2 = (typeof MODULE_IDS)[number];

  beforeEach(() => {
    vi.useFakeTimers();
    useKitStore.setState({ kit: createInitialState(), hydrated: false, undoStack: [], canUndo: false });
  });
  afterEach(async () => {
    await useKitStore.getState().flush();
    vi.useRealTimers();
  });

  it('module déjà dans l’état visé : reason « noop », pas « points »', () => {
    const kit = useKitStore.getState().kit;
    const on = MODULE_IDS.find((m) => modOn(kit, m));
    expect(on).toBeDefined();
    const r = useKitStore.getState().toggleModule(on!, true);
    expect(r).toEqual({ ok: false, reason: 'noop' });
    // État inchangé : aucune sauvegarde ni entrée d'annulation n'est déclenchée.
    expect(useKitStore.getState().kit).toBe(kit);
    expect(useKitStore.getState().canUndo).toBe(false);
  });

  it('points d’attache insuffisants : reason « points »', () => {
    const { state, blocked } = fullAttach();
    useKitStore.setState({ kit: state });
    const r = useKitStore.getState().toggleModule(blocked, true);
    expect(r).toEqual({ ok: false, reason: 'points' });
    expect(useKitStore.getState().kit).toBe(state);
  });

  it('module disponible : bascule effective, pas de reason', () => {
    const kit = useKitStore.getState().kit;
    const on = MODULE_IDS.find((m) => modOn(kit, m));
    expect(on).toBeDefined();
    expect(useKitStore.getState().toggleModule(on!, false)).toEqual({ ok: true });
    expect(modOn(useKitStore.getState().kit, on!)).toBe(false);
    expect(useKitStore.getState().toggleModule(on!, true)).toEqual({ ok: true });
    expect(modOn(useKitStore.getState().kit, on!)).toBe(true);
  });
});

/* ───────────── 7. OrderSheet : plus de doublon état local / prop page ───────────── */

describe('P4.7 — OrderSheet contrôlé : pas de divergence page/état local (REVIEW OrderSheet.tsx:97-99)', () => {
  it('non contrôlé : l’état local porte la page et notifie l’appelant', () => {
    const onPageChange = vi.fn();
    const { result } = renderHook(() => useControlledPage(undefined, onPageChange));
    expect(result.current[0]).toBe(0);
    act(() => { result.current[1](2); });
    expect(result.current[0]).toBe(2);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('contrôlé : la prop pilote toujours la page, l’état local ne diverge pas', () => {
    const onPageChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ page }: { page: number | undefined }) => useControlledPage(page, onPageChange),
      { initialProps: { page: 1 as number | undefined } },
    );
    expect(result.current[0]).toBe(1);
    act(() => { result.current[1](0); });
    // L'ancien doublon `own` gardait 0 : la page affichée repartait de l'état local en cas de
    // désynchronisation. Ici la prop gagne, toujours.
    expect(result.current[0]).toBe(1);
    expect(onPageChange).toHaveBeenCalledWith(0);
    rerender({ page: 2 });
    expect(result.current[0]).toBe(2);
    rerender({ page: undefined });
    // Le local n'a pas été pollué par la phase contrôlée : il vaut la page initiale, pas 0.
    expect(result.current[0]).toBe(1);
  });

  it('OrderSheet passe la page contrôlée au Pager (aucun état local ne la remplace)', () => {
    const scrollTo = vi.fn();
    const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
    const hadScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo');
    const hadWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, writable: true, value: scrollTo });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 320 });
    try {
      render(<OrderSheet state={createInitialState()} onConfirmOrder={() => {}} page={1} onPageChange={() => {}} />);
      expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 320 }));
    } finally {
      if (hadScrollTo) Object.defineProperty(HTMLElement.prototype, 'scrollTo', hadScrollTo);
      else Reflect.deleteProperty(proto, 'scrollTo');
      if (hadWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', hadWidth);
      else Reflect.deleteProperty(proto, 'clientWidth');
    }
  });
});

/* ───────────── 9. Checklist accessibilité à jour de l'arbre ───────────── */

describe('P4.9 — docs/kit-studio/A11Y-CHECKLIST.md reflète l’arbre courant', () => {
  const doc = readFileSync(join(ROOT, 'docs/kit-studio/A11Y-CHECKLIST.md'), 'utf8');

  it('les constats périmés de la revue ne sont plus écrits', () => {
    expect(doc).not.toMatch(/pillLabel\(\) existe dans `strings\.ts` mais n['’]est pas branché/);
    expect(doc).not.toMatch(/aucun composant ne la consomme/);
    expect(doc).not.toMatch(/déclare que cartes/);
  });

  it('pillLabel et le libellé 3D sont déclarés branchés', () => {
    expect(doc).toMatch(/pillLabel/);
    expect(doc).toMatch(/branché/);
    expect(doc).toMatch(/S\.a11y\.bag3d/);
    expect(doc).toMatch(/SceneView\.tsx:49/);
  });

  it('toutes les références fichier:ligne pointent vers un fichier existant et une ligne réelle', () => {
    const refs = [...doc.matchAll(/`([\w./-]+\.(?:tsx?|css)):(\d+)(?:-(\d+))?`/g)];
    expect(refs.length).toBeGreaterThan(20);
    for (const m of refs) {
      const rel = m[1];
      const lastLine = Number(m[3] ?? m[2]);
      const base = rel.startsWith('src/') || rel.startsWith('tests/') ? ROOT : KS;
      const file = join(base, rel);
      expect(existsSync(file), `référence absente : ${rel}`).toBe(true);
      const lines = readFileSync(file, 'utf8').split('\n').length;
      expect(lines, `référence hors fichier : ${rel}:${lastLine}`).toBeGreaterThanOrEqual(lastLine);
    }
  });
});
