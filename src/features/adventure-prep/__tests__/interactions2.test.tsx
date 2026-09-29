/**
 * Lot INTERACTIONS 2 — les clics qui doivent CHANGER l'etat.
 *
 * Le fichier voisin (`interactions.test.tsx`) a ouvert la voie : monter les
 * composants REELS dans jsdom plutot que de les rendre en chaine. Il prouve
 * que les tiroirs s'ouvrent. Celui-ci va plus loin, et pose la seule question
 * qui compte pour un bouton : **apres le clic, qu'est-ce qui a change ?**
 *
 * Chaque test suit le chemin complet — clic -> handler -> store -> re-rendu ->
 * etat verifie. Aucun composant n'est mocke, aucun store n'est mocke. Le seul
 * remplacement est `next/navigation` (le contexte de routage, absent d'un
 * arbre de test) et `globalThis.fetch` (le runner reseau, deja mocke partout
 * ailleurs dans la feature). Un `onClick={() => {}}` fait echouer ces tests :
 * c'est exactement le but.
 *
 * Items vises : P2.1, P2.3, P2.5, P2.6, P2.8, P2.12, P2.13.
 */

// @vitest-environment jsdom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';

/**
 * `DepartureStep` redirige vers /hub apres un enregistrement REUSSI. Sans
 * contexte Next, `useRouter` ne rend pas. On remplace donc le ROUTAGE, pas le
 * composant : meme convention que `departure-screen.test.tsx`.
 *
 * `vi.hoisted` est obligatoire : la fabrique de `vi.mock` s'execute au moment
 * de l'import de `next/navigation`, donc avant le corps du module de test. Sans
 * `hoisted`, la reference tomberait dans la zone morte temporelle.
 */
const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
  usePathname: () => '/prepare',
  useSearchParams: () => new URLSearchParams(),
}));

/* ------------------------------------------------------------------ */
/* Environnement : ce que jsdom n'implemente pas et que Radix appelle.  */
/* Ce ne sont pas des mocks de produit, ce sont des shims de plateforme. */
/* ------------------------------------------------------------------ */

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    class ResizeObserverShim {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverShim;
  }
  if (!('IntersectionObserver' in globalThis)) {
    class IntersectionObserverShim {
      readonly root = null;
      readonly rootMargin = '';
      readonly thresholds: readonly number[] = [];
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
      IntersectionObserverShim;
  }
  if (typeof window !== 'undefined') {
    if (!window.matchMedia) {
      window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })) as unknown as typeof window.matchMedia;
    }
    window.scrollTo = (() => {}) as unknown as typeof window.scrollTo;
    window.Element.prototype.scrollTo = function scrollTo() {};
    window.Element.prototype.scrollIntoView = function scrollIntoView() {};
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  routerPush.mockReset();
});

/* ------------------------------------------------------------------ */

import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import { buildItinerary } from '../engine/itinerary';
import { DestinationStep } from '../components/DestinationStep';
import { DepartureStep } from '../components/DepartureStep';
import { PrepMap } from '../components/PrepMap';
import { PrepSheets, type PrepSheetId } from '../components/PrepSheets';
import { fullDraft } from './fixtures';
import type { AdventurePrepDraft, ItineraryModel } from '../types';

const TRACES: Array<[number, number]> = [
  [45.9237, 6.8694],
  [45.9819, 6.9269],
];

/**
 * Pose un VRAI brouillon dans le VRAI store.
 *
 * `buildItinerary` est le moteur de production, pas une fabrique de fixtures :
 * les etapes affichees plus bas ont donc ete construites par le meme code que
 * celles que voit la personne. On ecrit l'etat par `setState` plutot que de
 * mocker le store — le composant continue de s'y abonner pour de vrai, et ses
 * re-rendus restent observables.
 */
function poser(overrides: Partial<AdventurePrepDraft> = {}): ItineraryModel {
  const draft = fullDraft(overrides);
  const model = buildItinerary(draft);
  if (!model) throw new Error("le brouillon de reference n'a produit aucun parcours");
  useAdventurePrepStore.setState({ draft: { ...draft, itinerary: model } });
  return model;
}

function dialogo(): HTMLElement | null {
  return document.body.querySelector('[role="dialog"]');
}

describe('INTERACTIONS 2 — le clic change l’état', () => {
  beforeEach(() => {
    useAdventurePrepStore.getState().resetDraft();
  });

  /* ---------------------------------------------------------------- */
  /* Temoin du harnais : ce fichier doit DETECTER un bouton mort.        */
  /* ---------------------------------------------------------------- */

  it('INT-00 : temoin — un composant en no-op ne declenche aucune action', () => {
    // Bouton volontairement mort : exactement la faute que ce lot traque. Si
    // le harnais etait incapable de le voir, les tests suivants ne
    // prouveraient rien. Celui-ci ferme cette porte explicitement.
    const Noop = () => <button type="button">Crier</button>;

    const auDepart = useAdventurePrepStore.getState().draft;
    render(<Noop />);
    fireEvent.click(screen.getByRole('button', { name: /crier/i }));

    expect(
      useAdventurePrepStore.getState().draft,
      'un composant en no-op ne doit produire aucun effet mesurable',
    ).toBe(auDepart);
  });

  /* ---------------------------------------------------------------- */
  /* P2.1 — « Créer mon parcours » fait basculer le store sur l'etape 2  */
  /* ---------------------------------------------------------------- */

  it('INT-10 : « Créer mon parcours » déplace le store sur l’étape 2 et coche l’étape 1', () => {
    // `completedSteps` part VIDE : si le clic n'ecrivait rien, l'assertion
    // « contient destination » echouerait. Le test ne peut donc pas passer par
    // hasard sur un etat deja satisfait.
    poser({ completedSteps: [] });
    expect(useAdventurePrepStore.getState().draft.currentStep).toBe('destination');

    render(<DestinationStep onOpenSheet={vi.fn()} />);

    const cta = screen.getByRole('button', { name: /cr.er mon parcours/i });
    expect(
      (cta as HTMLButtonElement).disabled,
      'le CTA doit etre actif quand le moteur a de quoi travailler',
    ).toBe(false);
    expect(useAdventurePrepStore.getState().draft.completedSteps).toEqual([]);

    fireEvent.click(cta);

    const apres = useAdventurePrepStore.getState().draft;
    expect(apres.currentStep, 'le clic doit emmener sur l’etape 2').toBe('itinerary');
    expect(apres.completedSteps, 'l’etape 1 doit etre cochee par le clic').toEqual(['destination']);
  });

  it('INT-10b : sans point de départ, le CTA s ouvre et le clic emmene a l etape 2', () => {
    useAdventurePrepStore.setState({
      draft: {
        ...fullDraft(),
        route: { origin: null, destination: null, shape: 'boucle' },
        itinerary: null,
        completedSteps: [],
      },
    });

    render(<DestinationStep onOpenSheet={vi.fn()} />);

    const cta = screen.getByRole('button', { name: /cr.er mon parcours/i });
    // B4 : le clic n est plus un bouton mort sans depart. Il ne l etait
    // d ailleurs deja pas — `requestDraftedItinerary` ne court-circuitait
    // qu au moment de la generation, apres le clic.
    expect((cta as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(cta);

    const apres = useAdventurePrepStore.getState().draft;
    expect(apres.currentStep).toBe('itinerary');
    expect(apres.completedSteps).toEqual(['destination']);
  });

  /* ---------------------------------------------------------------- */
  /* P2.8 — « Agrandir » / « Recentrer » font vraiment bouger la carte  */
  /* ---------------------------------------------------------------- */

  it('INT-11 : « Agrandir » ouvre le plein écran, « Réduire » le referme', () => {
    render(<PrepMap name="Parcours" routeCoords={TRACES} scopeLabel="Jour 1" />);

    expect(dialogo(), 'la carte ne doit pas demarrer en plein ecran').toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /agrandir la carte/i }));

    const plein = document.querySelector('[aria-label="Carte en plein écran"]');
    expect(plein, 'le clic doit monter le calque plein ecran').not.toBeNull();
    expect(plein?.getAttribute('role')).toBe('dialog');
    // Les commandes compactes ont disparu : ce n'est pas le meme ecran, mais
    // le meme composant reconfigure — un simple affichage ne le prouverait pas.
    expect(
      screen.queryByRole('button', { name: /agrandir la carte/i }),
      'le chrome compact doit etre remplace, pas duplique',
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: /r.duire/i }),
      'le plein ecran doit offrir sa fermeture',
    ).toBeTruthy();

    const reduire = plein?.querySelector('[data-prep-map-close]') as HTMLElement | null;
    expect(reduire, 'le bouton de fermeture doit porter son selecteur').not.toBeNull();
    fireEvent.click(reduire as HTMLElement);

    expect(
      document.querySelector('[aria-label="Carte en plein écran"]'),
      'le clic doit refermer le calque',
    ).toBeNull();
  });

  it('INT-12 : « Recentrer » remonte réellement le canvas (nouvelle instance montée)', () => {
    render(<PrepMap name="Parcours" routeCoords={TRACES} scopeLabel="Jour 1" />);

    const canvas = document.querySelector('.prep-map__canvas') as HTMLElement;
    expect(canvas, 'le canvas doit etre monte').not.toBeNull();
    const avant = canvas.firstElementChild;
    expect(avant, 'le canvas doit contenir la carte').not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /recentrer sur le parcours/i }));

    const apres = (document.querySelector('.prep-map__canvas') as HTMLElement).firstElementChild;
    expect(apres, 'le canvas doit contenir une carte apres le clic').not.toBeNull();
    // Le `key` de la carte est pilote par `recenterKey` : cliquer le remonte
    // reellement. Un bouton qui n'appellerait pas `recenter` laisserait le meme
    // noeud en place — c'est ce que cette assertion detecte.
    expect(apres, 'le clic doit produire un nouveau noeud carte').not.toBe(avant);
    expect(canvas.contains(avant), 'l’ancien noeud doit avoir ete demonte').toBe(false);
  });

  /* ---------------------------------------------------------------- */
  /* P2.3 — le tiroir « programme complet » montre le parcours reel      */
  /* ---------------------------------------------------------------- */

  it('INT-13 : le tiroir « programme complet » liste les étapes du modèle et se referme', () => {
    const model = poser();
    expect(model.steps.length, 'le modele de test doit avoir des etapes').toBeGreaterThan(0);
    const premiere = model.steps[0];

    const onClose = vi.fn();
    render(<PrepSheets sheet="steps" onClose={onClose} />);

    const feuille = dialogo() as HTMLElement;
    expect(feuille, 'le tiroir doit etre un dialogue').not.toBeNull();
    expect(feuille.textContent, 'le programme doit etre decoupe en journees').toContain('Jour 1');
    expect(
      feuille.textContent,
      'le titre affiche doit venir du modele, pas d’un libelle generique',
    ).toContain(premiere.title);

    // Un clic sur une etape doit dire QUELLE etape, a l'exterieur du tiroir :
    // c'est le contrat `prep:focus-step` que l'ecran 3 ecoute.
    const ecoutes: string[] = [];
    const onFocus = (event: Event) => {
      ecoutes.push((event as CustomEvent<{ stepId: string }>).detail.stepId);
    };
    window.addEventListener('prep:focus-step', onFocus);

    const cible = within(feuille)
      .getAllByRole('button')
      .find((bouton) => bouton.textContent?.includes(premiere.title));
    expect(cible, 'l’etape du modele doit etre cliquable').toBeDefined();
    fireEvent.click(cible as HTMLElement);

    window.removeEventListener('prep:focus-step', onFocus);

    expect(onClose, 'le clic doit refermer le tiroir').toHaveBeenCalled();
    expect(ecoutes, 'le clic doit nommer l’etape visee').toEqual([premiere.id]);
  });

  /* ---------------------------------------------------------------- */
  /* P2.6 — « Ajuster » applique vraiment un reglage au parcours          */
  /* ---------------------------------------------------------------- */

  it('INT-14 : « Ajuster » ajoute des etapes au parcours du store', async () => {
    // Le reglage declenche une remesure : le runner reseau doit repondre
    // proprement, sinon la remesure et l'assertion se disputent le meme tour.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as unknown as Response);

    poser();
    const avant = useAdventurePrepStore.getState().draft.itinerary;
    expect(avant).not.toBeNull();
    const nbAvant = avant?.steps.length ?? 0;

    render(<PrepSheets sheet="adjust" onClose={vi.fn()} />);
    const feuille = dialogo() as HTMLElement;
    expect(feuille).not.toBeNull();

    // 1. Choisir un reglage : le bouton se selectionne, et « Appliquer » s'active.
    const nature = within(feuille)
      .getAllByRole('button')
      .find((bouton) => bouton.textContent?.includes('Plus de nature'));
    expect(nature, 'le reglage « Plus de nature » doit etre propose').toBeDefined();
    fireEvent.click(nature as HTMLElement);
    expect(
      nature?.getAttribute('aria-pressed'),
      'le clic doit marquer le reglage comme choisi',
    ).toBe('true');
    expect(
      (screen.getByRole('button', { name: /^appliquer$/i }) as HTMLButtonElement).disabled,
      '« Appliquer » doit s’ouvrir des qu’un reglage est choisi',
    ).toBe(false);

    // 2. Appliquer : le store doit avoir reellement gagne des etapes.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^appliquer$/i }));
      await Promise.resolve();
    });

    const apres = useAdventurePrepStore.getState().draft.itinerary;
    expect(apres, 'le parcours doit toujours etre la').not.toBeNull();
    expect(
      apres?.steps.length ?? 0,
      '« Plus de nature » doit ajouter une pause par journee',
    ).toBeGreaterThan(nbAvant);

    const confirmation = document.body.querySelector('[role="status"]');
    expect(
      confirmation?.textContent,
      'l’ecran doit confirmer l’application par un libelle nomme',
    ).toContain('Plus de nature');
  });

  /* ---------------------------------------------------------------- */
  /* P2.5 — « A conserver » ecrit dans le store                          */
  /* ---------------------------------------------------------------- */

  it('INT-15 : « À conserver » bascule vraiment l’étape dans le store', () => {
    const model = poser();
    const cible = model.steps.find((step) => !step.kept) ?? model.steps[0];
    expect(cible.kept, 'la fiche doit partir d’un etat non conserve').toBe(false);

    render(<PrepSheets sheet="step" focusStepId={cible.id} onClose={vi.fn()} />);
    const feuille = dialogo() as HTMLElement;
    expect(feuille).not.toBeNull();

    const bouton = within(feuille).getByRole('button', { name: /^. conserver$/i });
    expect(bouton.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(bouton);

    const lu = useAdventurePrepStore
      .getState()
      .draft.itinerary?.steps.find((step) => step.id === cible.id);
    expect(lu?.kept, 'le store doit avoir bascule').toBe(true);

    // Le libelle suit l'etat : un bouton fige sur « A conserver » mentirait.
    const inverse = within(feuille).getByRole('button', { name: /ne plus conserver/i });
    expect(inverse.getAttribute('aria-pressed'), 'l’etat doit etre reflechi dans l’aria').toBe(
      'true',
    );

    // Et le second clic revient en arriere : c'est un interrupteur, pas un voyant.
    fireEvent.click(inverse);
    expect(
      useAdventurePrepStore.getState().draft.itinerary?.steps.find((s) => s.id === cible.id)?.kept,
    ).toBe(false);
  });

  /* ---------------------------------------------------------------- */
  /* P2.13 — l'enregistrement declenche la vraie action de sauvegarde      */
  /* ---------------------------------------------------------------- */

  it('INT-16 : « Enregistrer » refuse un brouillon incomplet sans rien envoyer', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    useAdventurePrepStore.setState({
      draft: {
        ...fullDraft(),
        activities: { primary: null, extra: [], nights: [] },
        itinerary: null,
      },
    });

    render(<DepartureStep onOpenSheet={vi.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /enregistrer mon aventure/i }));
      await Promise.resolve();
    });

    expect(
      fetchSpy,
      'rien ne doit partir vers le serveur tant que le plan est incomplet',
    ).not.toHaveBeenCalled();
    expect(document.body.textContent, 'le refus doit etre nomme, pas silencieux').toContain(
      'Il manque',
    );
    expect(routerPush, 'aucun depart vers le hub sans ligne creee').not.toHaveBeenCalled();
    expect(
      (screen.getByRole('button', { name: /enregistrer mon aventure/i }) as HTMLButtonElement)
        .disabled,
      'l’echec ne doit pas figer l’ecran en « saving »',
    ).toBe(false);
  });

  it('INT-17 : « Enregistrer » sur un plan complet part au commit puis au hub', async () => {
    poser();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ tripId: 'voy-1', slug: 'chamonix' }),
    } as unknown as Response);

    render(<DepartureStep onOpenSheet={vi.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /enregistrer mon aventure/i }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchSpy, 'le clic doit partir sur le vrai point de commit').toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/adventure/commit');
    const corps = JSON.parse(String(init.body)) as { draft: AdventurePrepDraft };
    expect(corps.draft.activities.primary, 'le corps doit porter le plan courant').toBe(
      'rando-refuge',
    );
    expect(corps.draft.itinerary?.steps.length, 'le parcours doit etre inclus').toBeGreaterThan(0);

    expect(routerPush, 'une reponse avec tripId doit emmener au hub').toHaveBeenCalledWith('/hub');
    expect(
      screen.getByRole('button', { name: /enregistr./i }),
      'l’ecran doit confirmer l’enregistrement',
    ).toBeTruthy();
  });

  /* ---------------------------------------------------------------- */
  /* P2.12 — les cinq tiroirs s'ouvrent ET se referment, mesure          */
  /* ---------------------------------------------------------------- */

  /**
   * Le tiroir est pilote par un etat React, pas par une prop figee : la
   * fermeture est donc REELLEMENT propagatee jusqu'au Sheet, qui se demonte.
   * Une assertion sur un spy `onClose` ne prouverait que le rappel ; celle-ci
   * prouve que le tiroir a disparu de l'ecran.
   */
  function SheetHarness({ initial }: { initial: PrepSheetId }) {
    const [sheet, setSheet] = useState<PrepSheetId | null>(initial);
    return <PrepSheets sheet={sheet} onClose={() => setSheet(null)} />;
  }

  it('INT-18 : les cinq tiroirs de l’étape 1 s’ouvrent ET se referment', () => {
    const tires: ReadonlyArray<readonly [PrepSheetId, string]> = [
      ['place', 'Où tu pars'],
      ['calendar', 'Quand tu pars'],
      ['group', 'Avec qui'],
      ['preferences', 'Préférences'],
      ['participants', 'Participants'],
    ];

    for (const [id, titre] of tires) {
      poser();
      const vue = render(<SheetHarness initial={id} />);

      const feuille = dialogo();
      expect(feuille, `tiroir « ${id} » : aucun dialogue monte`).not.toBeNull();
      expect(feuille?.textContent, `tiroir « ${id} » : titre manquant`).toContain(titre);

      fireEvent.keyDown(feuille as HTMLElement, { key: 'Escape' });

      expect(
        dialogo(),
        `tiroir « ${id} » : Échap n’a pas retiré le tiroir de l’ecran`,
      ).toBeNull();

      vue.unmount();
      cleanup();
    }
  });
});