import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AdventurePrepShell,
  PREP_SERVER_ONLINE,
  PrepOfflineNotice,
  readPrepNetwork,
  readPrepNetworkOnServer,
  useOfflinePrep,
  type AdventurePrepShellProps,
} from '../components/AdventurePrepShell';
import {
  OFFLINE_ACTION,
  offlineReadiness,
  type OfflineReadinessInput,
} from '../engine/resilience';
import { buildItinerary } from '../engine/itinerary';
import { fullDraft } from './fixtures';
import type { AdventurePrepDraft, ItineraryModel, PrepStepId } from '../types';

/**
 * Meme harnais que prep-screens.test.tsx : sous `renderToStaticMarkup`, zustand
 * v5 sert l'etat INITIAL et `setState` n'a aucun effet. Le module du store est
 * donc remplace par un selecteur pur, et `next/navigation` par un `useRouter`
 * sans contexte applicatif — le composant est reellement execute, seules les
 * sources exterieures changent.
 */
const state = vi.hoisted(() => ({
  current: null as { draft: AdventurePrepDraft; goToStep: (id: PrepStepId) => void } | null,
}));

vi.mock('../store/useAdventurePrepStore', () => {
  type Store = { draft: AdventurePrepDraft; goToStep: (id: PrepStepId) => void };
  const use = ((selector: (store: Store) => unknown) =>
    selector(state.current as Store)) as unknown as { getState: () => unknown };
  use.getState = () => state.current;
  return { useAdventurePrepStore: use };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined }),
}));

const noop = () => undefined;

function model(): ItineraryModel {
  const built = buildItinerary(fullDraft());
  if (!built) throw new Error('modele attendu');
  return built;
}

/** Ce que l'utilisateur LIT, balises et attributs retires. */
function visible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Empêche une fuite de globale : `navigator` existe sous Node 24, et c'est
 * justement ce que l'on doit pouvoir rendre hostile pour prouver que le rendu
 * serveur ne le lit pas.
 */
function withGlobals(detail: Record<string, PropertyDescriptor>, fn: () => void): void {
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, descriptor] of Object.entries(detail)) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, ...descriptor });
  }
  try {
    fn();
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

/**
 * Variante de `withGlobals` qui RENVOIE la valeur : indispensable pour comparer
 * deux rendus, pas seulement pour constater une absence d'exception.
 */
function withResult<T>(detail: Record<string, PropertyDescriptor>, fn: () => T): T {
  let out: T;
  withGlobals(detail, () => {
    out = fn();
  });
  return out!;
}
function readiness(overrides: Partial<OfflineReadinessInput> = {}) {
  return offlineReadiness({ model: model(), online: true, aiEnabled: true, ...overrides });
}

function renderNotice(online: boolean, aiEnabled = true): string {
  return renderToStaticMarkup(
    React.createElement(PrepOfflineNotice, { online, readiness: readiness({ online, aiEnabled }) }),
  );
}

function renderShell(
  props: Partial<AdventurePrepShellProps> = {},
  children: React.ReactNode = null,
): string {
  state.current = { draft: fullDraft({ itinerary: model() }), goToStep: noop };
  // children reste requis par le contrat du shell : ReactNode ne peut pas
  // disparaitre du type, sinon un hote pourrait monter une fiche sans contenu.
  const shellProps: AdventurePrepShellProps = {
    step: 'destination',
    onOpenSheet: noop,
    children,
    ...props,
  };
  return renderToStaticMarkup(React.createElement(AdventurePrepShell, shellProps));
}

const SHELL_SOURCE = readFileSync(
  new URL('../components/AdventurePrepShell.tsx', import.meta.url),
  'utf8',
);
const ENGINE_SOURCE = readFileSync(new URL('../engine/resilience.ts', import.meta.url), 'utf8');

/* ------------------------------------------------------------------ */

describe('offlineReadiness - le parcours reste lisible', () => {
  it('OFF-01: en ligne avec l’assistant, rien n’est signalé indisponible', () => {
    const state = readiness({ online: true, aiEnabled: true });
    expect(state.unavailable).toHaveLength(0);
    expect(state.programReady).toBe(true);
  });

  it('OFF-02: le résumé annonce le nombre d’étapes et ce qui reste lisible', () => {
    const steps = model().steps.length;
    const summary = readiness().summary;
    expect(summary).toContain(String(steps));
    expect(summary).toContain('étapes enregistrées');
    for (const attendu of ['programme', 'carte', 'étapes']) {
      expect(summary).toContain(attendu);
    }
  });

  it('OFF-03: un assistant coupé a une entrée dédiée, avec sa raison', () => {
    const state = readiness({ online: true, aiEnabled: false });
    expect(state.unavailable).toHaveLength(1);
    const [action] = state.unavailable;
    expect(action.id).toBe(OFFLINE_ACTION.itineraireIA);
    expect(action.reason).toMatch(/assistant/i);
    expect(action.reason).toMatch(/pas activé/);
  });

  it('OFF-04: réseau coupé et assistant actif donnent UNE entrée, la bonne', () => {
    const state = readiness({ online: false, aiEnabled: true });
    expect(state.unavailable).toHaveLength(1);
    const [action] = state.unavailable;
    expect(action.id).toBe(OFFLINE_ACTION.itineraireIA);
    expect(action.reason).toMatch(/Sans réseau/);
  });

  it('OFF-05: réseau coupé ET assistant coupé n’en donnent qu’une, mais deux raisons', () => {
    const state = readiness({ online: false, aiEnabled: false });
    expect(state.unavailable).toHaveLength(1);
    expect(state.unavailable[0].reason).toMatch(/Sans réseau/);
    expect(state.unavailable[0].reason).toMatch(/pas activé/);
  });

  it('OFF-06: « pas de réseau » et « assistant coupé » ne partagent pas leur message', () => {
    const sansReseau = readiness({ online: false, aiEnabled: true }).unavailable[0].reason;
    const sansIA = readiness({ online: true, aiEnabled: false }).unavailable[0].reason;
    expect(sansReseau).not.toBe(sansIA);
    expect(sansReseau).not.toContain(sansIA);
    expect(sansIA).not.toContain(sansReseau);
  });

  it('OFF-07: un programme sans étape n’est jamais annoncé prêt', () => {
    const state = offlineReadiness({ model: null, online: true, aiEnabled: true });
    expect(state.programReady).toBe(false);
    expect(state.summary).toContain('Aucune étape enregistrée');
  });

  it('OFF-08: le compte explicite l’emporte, et une valeur absurde vaut zéro', () => {
    expect(readiness({ stepsCount: 3 }).summary).toContain('3 étapes enregistrées');
    expect(readiness({ stepsCount: 1 }).summary).toContain('1 étape enregistrée');
    for (const stepsCount of [-5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(readiness({ stepsCount }).summary).toContain('Aucune étape enregistrée');
    }
  });

  it('OFF-09: chaque appel est immuable — rien n’est jamais réécrit', () => {
    const input: OfflineReadinessInput = { model: model(), online: false, aiEnabled: true };
    const avant = structuredClone(input) as OfflineReadinessInput;
    const premier = offlineReadiness(input);
    const second = offlineReadiness(input);

    expect(input).toEqual(avant);
    expect(premier).not.toBe(second);
    expect(premier.unavailable).not.toBe(second.unavailable);
    expect(premier.summary).toBe(second.summary);
    premier.unavailable.forEach((action, index) => {
      expect(action).not.toBe(second.unavailable[index]);
    });
  });

  it('OFF-10: le moteur est PUR — il ne lit ni window ni navigator', () => {
    const bomb = () => {
      throw new Error('le moteur pur a lu le DOM');
    };
    const hostile: Record<string, PropertyDescriptor> = {
      window: { get: bomb, configurable: true },
      navigator: { get: bomb, configurable: true },
    };

    withGlobals(hostile, () => {
      const state = offlineReadiness({ model: model(), online: false, aiEnabled: false });
      expect(state.unavailable).toHaveLength(1);
    });
  });
});

describe('PrepOfflineNotice - le bandeau annonce, il n’efface rien', () => {
  it('OFF-11: sans degradation reelle, le bandeau ne rend rien du tout', () => {
    expect(renderNotice(true)).toBe('');
    expect(renderShell()).not.toContain('role="status"');
  });

  it('OFF-12: hors ligne, le bandeau s’affiche et le résumé porte le compte d’étapes', () => {
    const html = renderNotice(false);
    const steps = model().steps.length;

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(visible(html)).toContain('Hors ligne');
    expect(visible(html)).toContain(`${steps} étapes enregistrées`);
    // Cette assertion a change de sens le 2026-09-29, et elle avait raison
    // d'echouer. Elle ecrivait « le programme, la carte et les etapes restent » :
    // une enumeration coordonnee qui engageait la carte a l'identique des deux
    // autres, alors que rien ne telecharge de carte depuis le preparateur. Elle
    // verrouillait donc le mensonge. Elle verrouille desormais les deux
    // verites separees : ce qui est local, et la limite reelle de la carte.
    expect(visible(html)).toContain('le programme et les étapes restent sur cet appareil');
    expect(visible(html)).toContain(
      'La carte reste visible uniquement sur les zones déjà consultées en ligne',
    );
  });

  it('OFF-13: assistant coupé seul s’affiche, et le bandeau ne prétend pas hors ligne', () => {
    const html = renderNotice(true, false);
    expect(html).toContain('role="status"');
    expect(visible(html)).toContain('Enrichissement du parcours par l’assistant');
    expect(visible(html)).toContain('n’est pas activé');
    // Le composant officiel ne doit pas annoncer un réseau qui, lui, marche.
    expect(visible(html)).not.toContain('Hors ligne');
  });

  it('OFF-14: chaque indisponibilité réelle a son explication lisible', () => {
    const html = renderNotice(false, false);
    expect(html).toContain('role="status"');
    const text = visible(html);
    expect(text).toContain('Sans réseau');
    expect(text).toContain('n’est pas activé');
  });

  it('OFF-15: le shell branche bien le bandeau sur une degradation reelle', () => {
    const html = renderShell({ aiEnabled: false });
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(visible(html)).toContain('Enrichissement du parcours par l’assistant');
    expect(visible(html)).toContain(model().steps.length + ' étapes enregistrées');
  });
});

describe('Hydratation — jamais de bandeau fantôme', () => {
  it('OFF-16: le HTML serveur est identique avec un navigator hostile', () => {
    const baseline = renderShell();
    const hostile = withResult(
      { navigator: { value: { onLine: false }, configurable: true } },
      () => renderShell(),
    );
    expect(hostile).toBe(baseline);
    expect(hostile).not.toContain('role="status"');
  });

  it('OFF-17: le snapshot serveur est constant, quoi qu’il arrive autour', () => {
    expect(PREP_SERVER_ONLINE).toBe(true);
    expect(readPrepNetworkOnServer()).toBe(true);
    withGlobals({ navigator: { value: { onLine: false }, configurable: true } }, () => {
      expect(readPrepNetworkOnServer()).toBe(true);
    });
  });

  it('OFF-18: le snapshot client, lui, suit la connexion réelle', () => {
    withGlobals(
      { window: { value: { navigator: { onLine: false } }, configurable: true } },
      () => expect(readPrepNetwork()).toBe(false),
    );
    withGlobals(
      { window: { value: { navigator: { onLine: true } }, configurable: true } },
      () => expect(readPrepNetwork()).toBe(true),
    );
    // Node expose `navigator` SANS `onLine` : une information absente ne doit
    // jamais dégrader l’écran.
    withGlobals(
      { window: { value: { navigator: {} }, configurable: true } },
      () => expect(readPrepNetwork()).toBe(true),
    );
    withGlobals({ window: { get: () => undefined, configurable: true } }, () => {
      expect(readPrepNetwork()).toBe(true);
    });
  });
});

/* ------------------------------------------------------------------ */


function Probe() {
  const { unavailable, isUnavailable, reasonFor } = useOfflinePrep();
  return (
    <p data-testid="probe">
      {unavailable.length}/{String(isUnavailable(OFFLINE_ACTION.itineraireIA))}/
      {reasonFor(OFFLINE_ACTION.itineraireIA) ?? 'aucune'}
    </p>
  );
}

describe('Contexte — les enfants n’ont qu’une seule source de vérité', () => {
  it('OFF-19: un enfant lit la même liste et la même raison que le bandeau', () => {
    const html = renderShell({ aiEnabled: false }, <Probe />);
    const attendu = readiness({ online: true, aiEnabled: false });
    expect(html).toContain(`${attendu.unavailable.length}/true/`);
    expect(html).toContain('n’est pas activé');
  });

  it('OFF-20: hors du shell, aucun enfant ne voit d’indisponibilité inventée', () => {
    const html = renderToStaticMarkup(React.createElement(Probe));
    expect(html).toContain('0/false/aucune');
  });
});

/** Le code seul : ces regles portent sur le comportement, pas sur les commentaires. */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
}

/* ------------------------------------------------------------------ */
/* Le bandeau ne doit pas inventer une cause                           */
/* ------------------------------------------------------------------ */

describe('le bandeau nomme la vraie cause — OFF-30 a OFF-32', () => {
  it('OFF-30: un delai ne se presente pas comme un assistant desactive', () => {
    const state = offlineReadiness({
      model: model(),
      online: true,
      aiEnabled: false,
      aiFailure: 'delai_depasse',
    });
    expect(state.unavailable[0]?.reason).toContain('temps');
    expect(state.unavailable[0]?.reason).not.toContain('pas activ');
  });

  it('OFF-31: un quota ne se presente pas comme une panne du service', () => {
    const state = offlineReadiness({
      model: model(),
      online: true,
      aiEnabled: false,
      aiFailure: 'quota_epuise',
    });
    expect(state.unavailable[0]?.reason).toContain('quotas');
  });

  it('OFF-32: sans cause connue, le bandeau ne pretend rien de plus', () => {
    const state = offlineReadiness({ model: model(), online: true, aiEnabled: false });
    expect(state.unavailable[0]?.reason).toContain('pas activ');
  });
});
describe('Règles de code des fichiers', () => {
  it('OFF-21: aucun hex dans le moteur', () => {
    expect(ENGINE_SOURCE).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(ENGINE_SOURCE).not.toMatch(/rgb\(|hsl\(/);
  });

  it('OFF-22: aucune couleur littérale dans le shell', () => {
    expect(SHELL_SOURCE).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(SHELL_SOURCE).not.toMatch(/rgb\(|hsl\(/);
  });

  it('OFF-23: le bandeau ne crée aucun conteneur scrollable', () => {
    expect(SHELL_SOURCE).toContain("flex: '0 0 auto'");
    expect(SHELL_SOURCE).not.toMatch(/overflow:\s*'(auto|scroll)'/);
  });

  it('OFF-24: le bandeau reste sobre — aucune animation, aucun délai', () => {
    // Motif volontairement structurel : un commentaire francais qui PREND le
    // mot « animation » ne doit pas faire echouer la regle.
    const mouvement = /@keyframes|animation(Name|Duration|Delay)?\s*:|transition\s*:|setTimeout\(|setInterval\(/;
    expect(sansCommentaires(SHELL_SOURCE)).not.toMatch(mouvement);
  });
});
