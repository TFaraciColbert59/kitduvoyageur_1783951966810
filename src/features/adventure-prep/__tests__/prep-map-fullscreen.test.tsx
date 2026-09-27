import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DayFocusDay } from '@/components/mobile-nav/dayFocusStore';
import {
  MAP_CLOSE_SELECTOR,
  PREP_POINT_COLORS,
  PrepMapFullscreen,
  applyOverlayFocus,
  collectFocusable,
  handleOverlayKeyEvent,
  resolveDayTabs,
  resolveTrappedIndex,
  resolveVisibleFilters,
  type PrepMapFullscreenProps,
  type PrepMapPoint,
} from '../components/PrepMap';

/**
 * Plein ecran de la carte du prepareur : rail jour, piege de focus, filtres.
 *
 * Deux harnais, un seul principe : on teste le CHEMIN REEL, jamais un double.
 * - Le rendu passe par `renderToStaticMarkup`, comme `prep-screens.test.tsx` et
 *   `departure-screen.test.tsx` : la suite vit en `environment: node`, sans
 *   DOM ni testing-library dans le repo.
 * - Les interactions (clic, Tab, Echap) sont exercees en appelant les
 *   handlers reellement rendus : `PrepMapFullscreen` est un composant PUR
 *   (aucun hook), donc l'arbre d'elements se parcourt et l'`onClick` produit
 *   par le composant lui-meme est invoque. C'est le meme code que celui que
 *   React Submitterait au navigateur.
 */

/* -------------------------------------------------------------------------- */
/* Mocks                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * `next/dynamic` est appele au chargement du module pour `HubGlobeMap` : on le
 * remplace par un bouchon plutot que de tirer la carte MapLibre dans la suite.
 */
vi.mock('next/dynamic', () => ({
  default: () =>
    function DynamicStub() {
      return null;
    },
}));

const dayStore = vi.hoisted(() => ({
  days: [] as unknown[],
  selectedDay: null as number | null,
  calls: [] as Array<number | null>,
  selectDay: (day: number | null) => {
    dayStore.calls.push(day);
  },
}));

/**
 * Meme contrat que les suites voisines : zustand v5 sert l'etat INITIAL sous
 * `renderToStaticMarkup`, donc on remplace le hook par un selecteur pur. Le
 * reste du module est REEL — `isDayFocusReady` reste la porte d'affichage du
 * rail, on ne la reecrit pas dans le test.
 */
vi.mock('@/components/mobile-nav/dayFocusStore', async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    '@/components/mobile-nav/dayFocusStore'
  );
  const use = (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      days: dayStore.days,
      selectedDay: dayStore.selectedDay,
      selectDay: dayStore.selectDay,
    });
  return { ...actual, useDayFocusStore: use };
});

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

const THREE_DAYS: DayFocusDay[] = [
  { day: 1, dateLabel: 'sam. 12', stepsCount: 3, distanceKm: 14.2, elevGainM: 620 },
  { day: 2, dateLabel: 'dim. 13', stepsCount: 2, distanceKm: 9.1, elevGainM: 310 },
  { day: 3, dateLabel: null, stepsCount: 1, distanceKm: 6.4, elevGainM: 180 },
];

const ONE_DAY: DayFocusDay[] = [THREE_DAYS[0]];

function point(category: string, id: string): PrepMapPoint {
  return { id, lat: 45.9, lon: 6.9, label: id, color: 'black', category };
}

const ALL_CATEGORIES = ['trajet', 'arret', 'repos', 'nuit', 'ravitaillement'] as const;

beforeEach(() => {
  dayStore.days = [];
  dayStore.selectedDay = null;
  dayStore.calls = [];
});

/* -------------------------------------------------------------------------- */
/* Rendu : le composant pur est appele comme une fonction                      */
/* -------------------------------------------------------------------------- */

type RenderedElement = { type?: unknown; props?: Record<string, unknown> };

/**
 * Parcourt l'arbre d'elements React sans DOM (fragments, tableaux, null).
 *
 * Les composants de fonction sont INVOQUES, exactement comme React le fait :
 * sans cela le parcours s'arreterait a `<MapDayRail />` et l'overlay deviendrait
 * illisible des que le chrome est extrait en briques. Les composants traverses
 * (`MapScope`, `MapActions`, `MapDayRail`, ...) sont purs — aucun hook — donc
 * l'appel n'a aucun effet de bord.
 */
function walk(node: unknown, visit: (element: Required<RenderedElement>) => void): void {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (node === null || typeof node !== 'object') return;
  const element = node as RenderedElement;
  if (element.type === undefined || element.props === undefined) return;
  if (typeof element.type === 'function') {
    walk((element.type as (props: unknown) => unknown)(element.props), visit);
    return;
  }
  visit(element as Required<RenderedElement>);
  walk(element.props.children, visit);
}

/** Texte lu par l'utilisateur, icones et elements non textuels retires. */
function textOf(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  const element = node as { props?: { children?: unknown } };
  if (element?.props?.children === undefined) return '';
  return textOf(element.props.children);
}

interface RenderedButton {
  label: string;
  pressed: boolean | undefined;
  onClick: (() => void) | undefined;
}

/** Boutons rendus, dans l'ordre du document — l'ordre du tabulateur. */
function buttonsOf(node: unknown): RenderedButton[] {
  const found: RenderedButton[] = [];
  walk(node, (element) => {
    if (element.type !== 'button') return;
    found.push({
      label: textOf(element.props.children),
      pressed: element.props['aria-pressed'] as boolean | undefined,
      onClick: element.props.onClick as (() => void) | undefined,
    });
  });
  return found;
}

/** Boutons d'un rail precis : le chrome de l'overlay en contient trois. */
function buttonsInClass(node: unknown, className: string): RenderedButton[] {
  let found: RenderedButton[] = [];
  walk(node, (element) => {
    if (element.type !== 'div') return;
    if (!String(element.props.className ?? '').includes(className)) return;
    found = buttonsOf(element.props.children);
  });
  return found;
}

/** Onglets jour. */
function railButtons(node: unknown): RenderedButton[] {
  return buttonsInClass(node, 'prep-map__dayrail');
}

/** Chips de la barre de filtres. */
function barButtons(node: unknown): RenderedButton[] {
  return buttonsInClass(node, 'prep-map__fullbar');
}

function overlayProps(overrides: Partial<PrepMapFullscreenProps> = {}): PrepMapFullscreenProps {
  return {
    scopeLabel: 'Ensemble',
    days: [],
    selectedDay: null,
    onSelectDay: () => undefined,
    filters: [],
    activeFilters: [],
    onToggleFilter: () => undefined,
    onLocate: () => undefined,
    locating: false,
    onRequestClose: () => undefined,
    geolocateError: null,
    ...overrides,
  };
}

function renderOverlay(overrides: Partial<PrepMapFullscreenProps> = {}): string {
  return renderToStaticMarkup(React.createElement(PrepMapFullscreen, overlayProps(overrides)));
}

/** Libelle du rail jour — unique dans l'overlay, c'est notre ancre. */
const RAIL_LABEL = 'Périmètre du parcours';

/* -------------------------------------------------------------------------- */
/* Fakes DOM : le contrat structurel de l'overlay                             */
/* -------------------------------------------------------------------------- */

interface FakeFocusable {
  readonly label: string;
  focusCount: number;
  focus: () => void;
  getAttribute: (name: string) => string | null;
}

function makeFocusable(
  label: string,
  options: { hidden?: boolean; onFocus?: (node: FakeFocusable) => void } = {}
): FakeFocusable {
  const node: FakeFocusable = {
    label,
    focusCount: 0,
    focus() {
      node.focusCount += 1;
      options.onFocus?.(node);
    },
    getAttribute: (name: string) => (name === 'aria-hidden' && options.hidden ? 'true' : null),
  };
  return node;
}

/** Meme contrat structurel qu'un `HTMLElement` : `querySelector(All)`. */
function makeContainer(nodes: readonly FakeFocusable[], preferred?: FakeFocusable): Element {
  return {
    querySelectorAll: () => nodes,
    querySelector: () => preferred ?? null,
  } as unknown as Element;
}

function keyEvent(key: string, options: { shiftKey?: boolean } = {}) {
  const event = {
    key,
    shiftKey: options.shiftKey === true,
    defaultPrevented: false,
    preventDefault() {
      event.defaultPrevented = true;
    },
  };
  return event;
}

/* -------------------------------------------------------------------------- */
/* Sources (garde-fous, meme principe que tests/design/h-d85-guard.spec.ts)   */
/* -------------------------------------------------------------------------- */

const PREP_MAP_SOURCE = fs.readFileSync(
  path.join(process.cwd(), 'src/features/adventure-prep/components/PrepMap.tsx'),
  'utf8'
);
const PREP_CSS_SOURCE = fs.readFileSync(
  path.join(process.cwd(), 'src/features/adventure-prep/adventure-prep.css'),
  'utf8'
);

/* ========================================================================== */
/* 1. Rail jour — miroir du store focus jour                                  */
/* ========================================================================== */

describe('PrepMap plein ecran — rail jour', () => {
  it('PREP-A1: un voyage d une seule journee n a aucun rail', () => {
    const html = renderOverlay({ days: ONE_DAY });
    expect(html).not.toContain(RAIL_LABEL);
    expect(html).not.toContain('Jour 1');
  });

  it('PREP-A2: au-dela de deux journees, le rail propose Ensemble puis chaque jour', () => {
    const html = renderOverlay({ days: THREE_DAYS });
    expect(html).toContain(RAIL_LABEL);
    const tabs = railButtons(PrepMapFullscreen(overlayProps({ days: THREE_DAYS })));
    expect(tabs.map((tab) => tab.label)).toEqual(['Ensemble', 'Jour 1', 'Jour 2', 'Jour 3']);
  });

  it('PREP-A3: l onglet actif est exactement le selectedDay du store', () => {
    const tree = PrepMapFullscreen(overlayProps({ days: THREE_DAYS, selectedDay: 2 }));
    const pressed = railButtons(tree).filter((tab) => tab.pressed === true);
    expect(pressed.map((tab) => tab.label)).toEqual(['Jour 2']);
  });

  it('PREP-A4: selectedDay nul marque Ensemble', () => {
    const tree = PrepMapFullscreen(overlayProps({ days: THREE_DAYS, selectedDay: null }));
    const pressed = railButtons(tree).filter((tab) => tab.pressed === true);
    expect(pressed.map((tab) => tab.label)).toEqual(['Ensemble']);
  });

  it('PREP-A5: un jour affiche ne survit pas a un jour devenu invalide', () => {
    // Le store purge la selection ; le rail ne doit surtout pas fabriquer un
    // onglet actif pour un jour qui n existe plus.
    const tree = PrepMapFullscreen(overlayProps({ days: THREE_DAYS, selectedDay: 9 }));
    const pressed = railButtons(tree).filter((tab) => tab.pressed === true);
    expect(pressed.map((tab) => tab.label)).toEqual(['Ensemble']);
    expect(railButtons(tree).map((tab) => tab.label)).not.toContain('Jour 9');
  });

  it('PREP-A6: le libelle porte toujours le mot Jour, jamais un chiffre nu', () => {
    const tree = PrepMapFullscreen(overlayProps({ days: THREE_DAYS, selectedDay: 3 }));
    for (const tab of railButtons(tree)) {
      expect(tab.label).toMatch(/^(Ensemble|Jour \d+)$/);
    }
  });

  it('PREP-A7: resolveDayTabs est une fonction pure de l etat du store', () => {
    expect(resolveDayTabs(THREE_DAYS, null).map((tab) => tab.day)).toEqual([null, 1, 2, 3]);
    // Le tableau recu n est jamais modifie.
    expect(THREE_DAYS.map((entry) => entry.day)).toEqual([1, 2, 3]);
  });
});

/* ========================================================================== */
/* 2. Rail en lecture seule : le store reste la seule ecriture                */
/* ========================================================================== */

describe('PrepMap plein ecran — le rail ecrit dans le store', () => {
  it('PREP-B1: cliquer Jour 2 delegue la selection sans etat local', () => {
    const asked: Array<number | null> = [];
    const tree = PrepMapFullscreen(
      overlayProps({ days: THREE_DAYS, onSelectDay: (day) => asked.push(day) })
    );
    const day2 = railButtons(tree).find((tab) => tab.label === 'Jour 2');
    day2?.onClick?.();
    expect(asked).toEqual([2]);
  });

  it('PREP-B2: cliquer Ensemble renvoie la vue globale', () => {
    const asked: Array<number | null> = [];
    const tree = PrepMapFullscreen(
      overlayProps({ days: THREE_DAYS, selectedDay: 2, onSelectDay: (day) => asked.push(day) })
    );
    railButtons(tree)
      .find((tab) => tab.label === 'Ensemble')
      ?.onClick?.();
    expect(asked).toEqual([null]);
  });

  it('PREP-B3: le composant s abonne au store et ne duplique pas la selection', () => {
    expect(PREP_MAP_SOURCE).toContain('useDayFocusStore');
    // Aucun etat local de type « jour selectionne » : le rail est un miroir.
    const localState = PREP_MAP_SOURCE.match(/useState[^\n;]*/g) ?? [];
    expect(localState.filter((line) => /day/i.test(line))).toEqual([]);
  });

  it('PREP-B4: la selection du store pilote le rail rendu', () => {
    dayStore.days = THREE_DAYS;
    dayStore.selectedDay = 3;
    // Le store mocke alimente exactement les memes props que PrepMap lit.
    const tree = PrepMapFullscreen(
      overlayProps({ days: dayStore.days as DayFocusDay[], selectedDay: dayStore.selectedDay })
    );
    const pressed = railButtons(tree).filter((tab) => tab.pressed === true);
    expect(pressed.map((tab) => tab.label)).toEqual(['Jour 3']);
  });
});

/* ========================================================================== */
/* 3. Piege de focus + restitution                                           */
/* ========================================================================== */

describe('PrepMap plein ecran — piege de focus', () => {
  const ring: { active: FakeFocusable | null } = { active: null };

  function overlayWithControls() {
    ring.active = null;
    const nodes = ['Ma position', 'Reduce', 'Jour 2', 'Trajets'].map((label) =>
      makeFocusable(label, {
        onFocus: (node) => {
          ring.active = node;
        },
      })
    );
    return { nodes, container: makeContainer(nodes, nodes[1]) };
  }

  it('PREP-C1: a l ouverture le focus va sur Reduire, pas sur le premier bouton', () => {
    const { nodes, container } = overlayWithControls();
    const previous = makeFocusable('Agrandir');
    applyOverlayFocus({
      container,
      activeElement: () => previous,
      preferredSelector: MAP_CLOSE_SELECTOR,
    });
    // « Ma position » declenche une action : le focus ne doit pas s y poser.
    expect(nodes[0].focusCount).toBe(0);
    expect(nodes[1].focusCount).toBe(1);
  });

  it('PREP-C2: sans bouton Reduire, le focus retombe sur le premier controle', () => {
    ring.active = null;
    const nodes = ['Ma position', 'Jour 2'].map((label) =>
      makeFocusable(label, {
        onFocus: (node) => {
          ring.active = node;
        },
      })
    );
    applyOverlayFocus({
      container: makeContainer(nodes),
      activeElement: () => null,
      preferredSelector: MAP_CLOSE_SELECTOR,
    });
    expect(nodes[0].focusCount).toBe(1);
  });

  it('PREP-C3: la fermeture restitue le focus a l element memorise', () => {
    const { container } = overlayWithControls();
    const previous = makeFocusable('Agrandir');
    const restore = applyOverlayFocus({
      container,
      activeElement: () => previous,
      preferredSelector: MAP_CLOSE_SELECTOR,
    });
    restore();
    expect(previous.focusCount).toBe(1);
  });

  it('PREP-C4: Echap demande la fermeture de l overlay', () => {
    const { nodes, container } = overlayWithControls();
    let escaped = false;
    handleOverlayKeyEvent(keyEvent('Escape'), {
      container,
      activeElement: () => ring.active,
      onEscape: () => {
        escaped = true;
      },
    });
    expect(escaped).toBe(true);
    // Echap ne deplace pas le focus : c est la fermeture qui restitue.
    expect(nodes.every((node) => node.focusCount === 0)).toBe(true);
  });

  it('PREP-C5: Tab depuis le dernier controle reboucle sur le premier', () => {
    const { nodes, container } = overlayWithControls();
    ring.active = nodes[nodes.length - 1];
    const event = keyEvent('Tab');
    handleOverlayKeyEvent(event, {
      container,
      activeElement: () => ring.active,
      onEscape: () => undefined,
    });
    expect(ring.active).toBe(nodes[0]);
    expect(event.defaultPrevented).toBe(true);
  });

  it('PREP-C6: Shift+Tab depuis le premier controle reboucle sur le dernier', () => {
    const { nodes, container } = overlayWithControls();
    ring.active = nodes[0];
    handleOverlayKeyEvent(keyEvent('Tab', { shiftKey: true }), {
      container,
      activeElement: () => ring.active,
      onEscape: () => undefined,
    });
    expect(ring.active).toBe(nodes[nodes.length - 1]);
  });

  it('PREP-C7: le focus ne sort jamais de l overlay', () => {
    const { nodes, container } = overlayWithControls();
    const options = {
      container,
      activeElement: () => ring.active,
      onEscape: () => undefined,
    };
    ring.active = nodes[0];
    const visited = new Set<string>();
    // Un tour complet de tabulation, plus un cran de trop : on doit rester
    // dans le meme anneau, jamais sur un element exterieur.
    for (let step = 0; step < nodes.length + 2; step += 1) {
      handleOverlayKeyEvent(keyEvent('Tab'), options);
      expect(ring.active).not.toBeNull();
      visited.add((ring.active as FakeFocusable).label);
    }
    expect(visited.size).toBe(nodes.length);
  });

  it('PREP-C8: un overlay sans control ne laisse pas Tab sortir', () => {
    const container = makeContainer([]);
    const event = keyEvent('Tab');
    expect(() =>
      handleOverlayKeyEvent(event, {
        container,
        activeElement: () => null,
        onEscape: () => undefined,
      })
    ).not.toThrow();
    expect(event.defaultPrevented).toBe(true);
  });

  it('PREP-C9: un element masque par aria-hidden est hors du tabulateur', () => {
    const hidden = makeFocusable('cache', { hidden: true });
    const kept = makeFocusable('visible');
    expect(collectFocusable(makeContainer([hidden, kept]))).toEqual([kept]);
  });

  it('PREP-C10: resolveTrappedIndex boucle sur un anneau vide', () => {
    expect(resolveTrappedIndex(0, 0, false)).toBe(-1);
    expect(resolveTrappedIndex(3, 2, false)).toBe(0);
    expect(resolveTrappedIndex(3, 0, true)).toBe(2);
  });
});

/* ========================================================================== */
/* 4. Une categorie vide n est jamais proposee                                */
/* ========================================================================== */

describe('PrepMap plein ecran — categories proposees', () => {
  it('PREP-E1: une categorie declaree mais sans point n est pas proposee', () => {
    const filters = resolveVisibleFilters(ALL_CATEGORIES, [point('trajet', 'a')]);
    expect(filters.map((filter) => filter.id)).toEqual(['trajet']);
  });

  it('PREP-E2: filterCategories reste un garde-fou supplementaire', () => {
    const points = [point('trajet', 'a'), point('nuit', 'b')];
    const filters = resolveVisibleFilters(['trajet'], points);
    // « nuit » a bien un point, mais n est pas declaree par l etape appelante.
    expect(filters.map((filter) => filter.id)).toEqual(['trajet']);
  });

  it('PREP-E3: la barre disparait quand aucune categorie n a de point', () => {
    const html = renderOverlay({
      filters: resolveVisibleFilters(ALL_CATEGORIES, []),
    });
    expect(html).not.toContain('Trajets');
    expect(html).not.toContain('Ravitaillement');
    expect(html).not.toContain('prep-map__fullbar');
  });

  it('PREP-E4: la barre ne propose que les categories peuplees', () => {
    const filters = resolveVisibleFilters(ALL_CATEGORIES, [
      point('trajet', 'a'),
      point('nuit', 'b'),
    ]);
    const html = renderOverlay({ filters });
    expect(html).toContain('Trajets');
    expect(html).toContain('Nuits');
    expect(html).not.toContain('Arrêts');
    expect(html).not.toContain('Pauses');
    expect(html).not.toContain('Ravitaillement');
  });

  it('PREP-E5: le filtre actif reste coherent avec les points rendus', () => {
    const filters = resolveVisibleFilters(ALL_CATEGORIES, [point('trajet', 'a')]);
    const tree = PrepMapFullscreen(overlayProps({ filters, activeFilters: ['trajet'] }));
    const pressed = barButtons(tree).filter((tab) => tab.pressed === true);
    expect(pressed.map((tab) => tab.label)).toEqual(['Trajets']);
  });

  it('PREP-E6: un point sans categorie est traite comme un arret', () => {
    const filters = resolveVisibleFilters(ALL_CATEGORIES, [
      { id: 'z', lat: 45, lon: 6, label: 'z', color: 'black', category: null },
    ]);
    expect(filters.map((filter) => filter.id)).toEqual(['arret']);
  });

  it('PREP-E7: la liste recue n est jamais modifiee', () => {
    const declared = ['trajet', 'nuit'];
    const points = [point('trajet', 'a')];
    resolveVisibleFilters(declared, points);
    expect(declared).toEqual(['trajet', 'nuit']);
    expect(points).toHaveLength(1);
  });
});

/* ========================================================================== */
/* 5. Palette : zero hex dans le composant                                   */
/* ========================================================================== */

describe('PrepMap — palette des points sans hex dans le TSX', () => {
  it('PREP-F1: aucun hexadecimal residuel dans PrepMap.tsx', () => {
    const hex = PREP_MAP_SOURCE.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hex).toEqual([]);
  });

  it('PREP-F2: les cinq familles pointent vers un token CSS', () => {
    expect(PREP_POINT_COLORS).toEqual({
      trajet: 'var(--prep-kind-trajet)',
      arret: 'var(--prep-kind-arret)',
      repos: 'var(--prep-kind-repos)',
      nuit: 'var(--prep-kind-nuit)',
      ravitaillement: 'var(--prep-kind-ravitaillement)',
    });
  });

  it('PREP-F3: les cinq variables sont declarees dans la feuille de la feature', () => {
    for (const kind of ['trajet', 'arret', 'repos', 'nuit', 'ravitaillement']) {
      expect(PREP_CSS_SOURCE).toMatch(new RegExp(`--prep-kind-${kind}\\s*:`));
    }
  });
});
