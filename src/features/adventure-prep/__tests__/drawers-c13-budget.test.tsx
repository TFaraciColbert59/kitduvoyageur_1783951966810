// @vitest-environment jsdom

/**
 * C13 - Le budget : trois pilules de verre, et une valeur qui PARTOUT.
 *
 * Ce que le tiroir affichait avant : un `ChipRow` de trois mots (« Economique /
 * Moderé / Confort ») qui ne disait rien du budget et ne proposait rien. Aucun
 * montant, aucun palier par defaut designé, et surtout aucune preuve que le
 * choix arrivait quelque part.
 *
 * Ce que ce fichier prouve, en trois morceaux :
 *   1. les trois pastilles existent, portent le vocabulaire du cahier des
 *      charges (Rat / Confort / Luxe), et une SEULE d'entre elles est
 *      pressee — celle que le brouillon porte ;
 *   2. elles sont bien du verre : la classe est lue dans la feuille de style
 *      reelle du depot, pas dans un attribut pose pour l'occasion. Un renommage
 *      de classe casse ce test ;
 *   3. cliquer un palier ecrit dans le store, et ce que le store porte part
 *      ensuite dans les DEUX charges utiles reelles de la generation : le
 *      `text` de `buildAdventureGenerateRequest` et le corps envoye au
 *      modele par `requestDraftedItinerary`.
 *
 * Regle de preuve : le test 03 lit le corps REEL envoye au modele. Une
 * implementation qui n'afficherait que l'etiquette (le choix neializerait pas
 * la generation) passe les tests 01 et 02 et echoue ici.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// On observe l'appel REEL au fournisseur : c'est le seul endroit ou la valeur
// choisie peut disparaitre en chemin sans que rien d'autre ne la montre.
const appelsIA: { system: string; prompt: string }[] = [];
vi.mock('@/lib/ai/askAI', () => ({
  askAI: vi.fn(async (req: { system: string; prompt: string }) => {
    appelsIA.push({ system: req.system, prompt: req.prompt });
    return { text: '', degraded: true, provider: 'fallback', failureReason: 'provider_indisponible' };
  }),
}));
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

beforeAll(() => {
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
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  appelsIA.length = 0;
});

import { PreferencesSheet } from '../components/PrepSetupSheets';
import { BUDGET_TIERS, DEFAULT_BUDGET_TIER } from '../engine/budgetTiers';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import { buildAdventureGenerateRequest } from '../adventureRequest';
import { requestDraftedItinerary } from '../engine/aiItinerary';
import { buildTripCommit } from '../tripCommit';
import type { PlaceRef } from '../types';

const CSS = readFileSync(join(__dirname, '..', 'adventure-prep.css'), 'utf8');

/** Retire les commentaires CSS sans motif : le helper lit la feuille telle
 *  quelle, et un motif construit a la main a deja casse une fois. */
function sansCommentaire(texte: string): string {
  const morceaux: string[] = [];
  let reste = texte;
  for (;;) {
    const debut = reste.indexOf('/*');
    if (debut === -1) break;
    const fin = reste.indexOf('*/', debut + 2);
    if (fin === -1) break;
    morceaux.push(reste.slice(0, debut));
    reste = reste.slice(fin + 2);
  }
  morceaux.push(reste);
  return morceaux.join(' ');
}

/** Le corps CSS de tous les blocs d un selecteur donne, commentaires retires. */
function bloc(selector: string): string {
  // Lecture par balayage : le selecteur cherche ici contient des crochets et
  // des apostrophes, et un motif construit a la main matcherait autre chose que
  // la regle visee. On suppose seulement que le corps d une regle ne contient
  // ni accolade ni commentaire imbrique.
  const cible = '.' + selector;
  const morceaux: string[] = [];
  let curseur = 0;
  for (;;) {
    const at = CSS.indexOf(cible, curseur);
    if (at === -1) break;
    const suite = CSS.slice(at + cible.length);
    const ouverture = suite.indexOf('{');
    const fermeture = suite.indexOf('}');
    if (ouverture === -1 || fermeture === -1 || fermeture < ouverture) break;
    morceaux.push(suite.slice(ouverture + 1, fermeture));
    curseur = at + cible.length;
  }
  return sansCommentaire(morceaux.join(' '))
    .split(String.fromCharCode(10))
    .map((ligne) => ligne.trim())
    .filter(Boolean)
    .join(' ');
}

const PILLS = (): HTMLButtonElement[] =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('button.prep-budget__pill'));

/**
 * Le tiroir est monte en abonne au store, pas avec un instantane.
 * `getState()` renvoie un OBJET fige : le composant rerendrait sur un draft
 * que personne ne tient a jour, et l'assertion « la pastille pressee a suivi »
 * testerait le harnais, pas le tiroir.
 */
function SheetFromStore() {
  const state = useAdventurePrepStore();
  return <PreferencesSheet draft={state.draft} actions={state} onClose={() => {}} />;
}

function renderSheet() {
  return render(<SheetFromStore />);
}

describe('C13 - le budget est trois pilules de verre, et la valeur choisie part dans la generation', () => {
  it('C13-01 : trois pilules, le vocabulaire de la checklist, une seule pressee', () => {
    useAdventurePrepStore.getState().resetDraft();
    renderSheet();

    const pills = PILLS();
    expect(pills.map((p) => p.textContent?.trim())).toEqual(['Rat', 'Confort', 'Luxe']);

    const presses = pills.filter((p) => p.getAttribute('aria-pressed') === 'true');
    expect(presses, 'exactement un palier est choisi').toHaveLength(1);
    // La pastille pressee est celle que le brouillon porte : l'ecran ne se
    // contente pas d'afficher trois mots, il affiche l'etat reel.
    expect(presses[0]?.dataset.budgetTier).toBe(
      useAdventurePrepStore.getState().draft.preferences.budgetLevel,
    );
  });

  it('C13-02 : la pastille de verre est du verre dans la feuille reelle', () => {
    const pill = bloc('prep-budget__pill');
    expect(pill, '.prep-budget__pill est introuvable dans la feuille').not.toBe('');
    // Le verre se prouve par sa matiere, pas par son nom de classe.
    expect(pill).toMatch(/backdrop-filter:\s*blur\(/);
    expect(pill).toMatch(/box-shadow:\s*var\(--prep-glass-material\)/);
    expect(pill).toMatch(/border-radius:\s*var\(--prep-radius-pill\)/);
    // L'etat choisi se lit sur la pastille, pas sur un parent invisible.
    expect(bloc("prep-budget__pill[aria-pressed='true']")).not.toBe('');
  });

  it('C13-03 : le tiroir nomme le palier que la base propose, et le store le porte', () => {
    useAdventurePrepStore.getState().resetDraft();
    renderSheet();

    const defaut = document.querySelector<HTMLButtonElement>(
      ".prep-budget__pill[data-default='true']",
    );
    expect(defaut, 'le tiroir doit nommer le palier qu il propose').not.toBeNull();
    // La promesse de l'ecran doit etre tenue par l'etat reel du brouillon neuf :
    // annoncer un defaut que la base ne pose pas serait une donnee inventee.
    expect(defaut?.dataset.budgetTier).toBe(DEFAULT_BUDGET_TIER);
    expect(useAdventurePrepStore.getState().draft.preferences.budgetLevel).toBe(DEFAULT_BUDGET_TIER);
    expect(document.body.textContent ?? '').toContain('palier proposé par défaut');
  });

  it('C13-04 : cliquer un palier ecrit dans le store', () => {
    useAdventurePrepStore.getState().resetDraft();
    renderSheet();

    const luxe = PILLS().find((p) => p.textContent?.trim() === 'Luxe');
    expect(luxe).toBeDefined();
    fireEvent.click(luxe as HTMLButtonElement);

    expect(useAdventurePrepStore.getState().draft.preferences.budgetLevel).toBe('confort');
    // L'etat a change a l'ecran aussi : la pastille pressee a suivi.
    expect(luxe?.getAttribute('aria-pressed')).toBe('true');
  });

  it('C13-05 : le palier choisi part dans la charge utile de generation', () => {
    useAdventurePrepStore.getState().resetDraft();
    renderSheet();

    const avant = buildAdventureGenerateRequest(
      useAdventurePrepStore.getState().draft,
    ).text;
    expect(avant).toContain('budget modéré');

    fireEvent.click(PILLS().find((p) => p.textContent?.trim() === 'Rat') as HTMLButtonElement);

    const apres = buildAdventureGenerateRequest(
      useAdventurePrepStore.getState().draft,
    ).text;
    expect(apres, 'le budget choisi doit changer le texte envoye a la generation').not.toBe(avant);
    expect(apres).toContain('budget économique');
    expect(apres).not.toContain('budget modéré');
  });

  it('C13-06 : le palier choisi part dans le commit enregistre en base', () => {
    useAdventurePrepStore.getState().resetDraft();
    renderSheet();
    fireEvent.click(PILLS().find((p) => p.textContent?.trim() === 'Luxe') as HTMLButtonElement);

    const commit = buildTripCommit(useAdventurePrepStore.getState().draft);
    const meta = commit.trip.metadata as { prep?: { budgetLevel?: string } };
    expect(meta.prep?.budgetLevel, 'le budget doit etre persiste avec l aventure').toBe('confort');
  });

  it('C13-07 : le palier choisi part dans le corps reellement envoye au modele', async () => {
    useAdventurePrepStore.getState().resetDraft();
    // Sans depart choisi, le moteur ne part pas : on lui donne un lieu REEL
    // (les coordonnees de Chamonix, celles du geocodeur) pour qu'il appelle.
    const origin: PlaceRef = {
      id: 'osm:relation/2988767',
      name: 'Chamonix-Mont-Blanc',
      country: 'France',
      lat: 45.9237,
      lon: 6.8694,
    };
    const state = useAdventurePrepStore.getState();
    act(() => {
      state.setRoute({ ...state.draft.route, origin, shape: 'boucle' });
    });

    renderSheet();
    fireEvent.click(PILLS().find((p) => p.textContent?.trim() === 'Luxe') as HTMLButtonElement);

    // Le modele se tait : ce test observe la REQUETE, pas sa reponse. Le
    // fournisseur est donc double, pas simule par `fetch` : on veut le prompt
    // tel que le moteur l'a construit, mot pour mot.
    await requestDraftedItinerary(
      useAdventurePrepStore.getState().draft,
      new AbortController().signal,
      [],
    );

    expect(appelsIA, 'le moteur doit appeler le fournisseur').not.toHaveLength(0);
    const corps = appelsIA.map((appel) => [appel.system, appel.prompt].join(' ')).join(' ');
    // Le motif tolerate l espace insecable : `frenchTypography` en glisse un
    // avant les deux-points (U+00A0), sinon le prompt ne respecte pas la
    // typographie francaise. Une assertion au mot bete echouerait sur la
    // typographie, pas sur la propagation.
    expect(corps, 'le prompt doit porter le budget choisi').toMatch(/budget\s*:\s*confort/);
    // Et pas le palier propose par defaut : la preuve que la valeur voyage.
    expect(corps, 'le prompt ne doit pas porter le palier par defaut').not.toMatch(/budget\s*:\s*modere/);
  });

  it('C13-08 : les trois paliers viennent du vocabulaire, pas d une liste du composant', () => {
    expect(BUDGET_TIERS.map((t) => t.label)).toEqual(['Rat', 'Confort', 'Luxe']);
    expect(BUDGET_TIERS.map((t) => t.id)).toEqual(['economique', 'modere', 'confort']);
  });
});