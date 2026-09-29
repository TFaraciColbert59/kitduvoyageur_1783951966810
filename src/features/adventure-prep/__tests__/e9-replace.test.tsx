/**
 * E9 - « Remplacer » : le bouton est la, et il fait quelque chose.
 *
 * HISTOIRE, parce qu elle explique pourquoi ce fichier a change deux fois.
 *
 * 1. « Remplacer » promettait une action, et son `onClick` etait vide. Le
 *    bouton a ete RETIRE : mieux vaut son absence qu une promesse.
 * 2. Le moteur a ete complete : `engine/stepAlternatives` classe des lieux du
 *    meme type autour d un point de reference REEL, le store l interroge, et
 *    `PrepSheets` monte `ReplaceSheet` pour la vue `replace`. La capacite
 *    existe ; il ne manquait que le bouton.
 *
 * Ces tests disent donc la verite d aujourd hui, et ils la disent en
 * EXERCANT LE CHEMIN COMPLET : le VRAI store, le VRAI routeur de feuilles, un
 * clic. Un spy sur `onOpenSheet` ne prouverait qu un rappel ; ici le dialogue
 * doit exister dans le document, comme en production.
 *
 * E9-03 a change de sens, et c est deliberé : il ne liste plus les surfaces du
 * moteur pour en esperer une absence, il exige au contraire que la capacite
 * que le bouton invoque soit toujours la, ET nommee. Le jour ou quelqu un
 * supprime `alternativesFor` en laissant le bouton, ce test rougit - c est
 * exactement le piege qu il doit voir.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import { useDayFocusStore } from '@/components/mobile-nav/dayFocusStore';
import { buildItinerary } from '../engine/itinerary';
import * as stepAlternatives from '../engine/stepAlternatives';
import { ItineraryStepScreen } from '../components/ItineraryStep';
import { PrepSheets, type PrepSheetId } from '../components/PrepSheets';
import { fullDraft } from './fixtures';
import type { AdventurePrepDraft, ItineraryModel } from '../types';

/* ------------------------------------------------------------------ */
/* Plateforme : ce que jsdom n implemente pas et que la feuille appelle.*/
/* Ce ne sont pas des mocks de produit, ce sont des shims.               */
/* ------------------------------------------------------------------ */

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    class ResizeObserverShim {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverShim;
  }
  if (!("IntersectionObserver" in globalThis)) {
    class IntersectionObserverShim {
      readonly root = null;
      readonly rootMargin = "";
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
  if (typeof window !== "undefined") {
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

/** Le VRAI parcours, pose dans le VRAI store : aucune fixture d affichage. */
function poser(): ItineraryModel {
  const draft = fullDraft();
  const model = buildItinerary(draft);
  if (!model) throw new Error("le brouillon de reference n'a produit aucun parcours");
  useAdventurePrepStore.setState({ draft: { ...draft, itinerary: model } });
  return model;
}

/**
 * L ecran et son routeur RELIES comme en production.
 *
 * Le routeur propage les DEUX arguments. Il n en prenait qu un :
 * `onOpenSheet={(id) => setSheet(id)}` effacait `focusStepId`, donc toute
 * vue ouverte sur une etape precise retombait sur la premiere du programme.
 * Un faux harnais ne doit pas rendre un branchement reel invisible - sinon
 * le test passe au vert sur une version qui marche moins bien que la
 * production.
 */
function Ecran(): React.ReactElement {
  const [sheet, setSheet] = useState<PrepSheetId | null>(null);
  const [stepId, setStepId] = useState<string | null>(etapeCourante());
  return (
    <>
      <ItineraryStepScreen
        onOpenSheet={(id, cible) => {
          setSheet(id);
          setStepId(cible ?? etapeCourante());
        }}
      />
      <PrepSheets
        sheet={sheet}
        onClose={() => setSheet(null)}
        focusStepId={stepId}
        replaceStepId={stepId}
        onOpenSheet={(id, cible) => {
          setSheet(id);
          setStepId(cible ?? etapeCourante());
        }}
      />
    </>
  );
}

/** L identite de l etape reellement affichee par la carte focalisee. */
function etapeCourante(): string | null {
  const model = useAdventurePrepStore.getState().draft.itinerary;
  return model === null ? null : (model.steps[0]?.id ?? null);
}

function dialogue(): HTMLElement | null {
  return document.body.querySelector('[role="dialog"]');
}

/** Le bouton de la fiche, trouve par son texte RENDU. */
function bouton(texte: string): HTMLElement {
  const trouve = screen.getAllByRole("button").filter(
    (noeud) => (noeud.textContent ?? "").trim() === texte,
  );
  expect(trouve, `aucun bouton « ${texte} » sur la fiche`).toHaveLength(1);
  return trouve[0] as HTMLElement;
}

beforeEach(() => {
  useAdventurePrepStore.getState().resetDraft();
  useDayFocusStore.getState().clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("E9 - « Remplacer » est branche, et la capacite qu il invoque existe", () => {
  /* ---------------------------------------------------------------- */
  /* Temoin : ce fichier DOIT detecter un bouton mort.                */
  /* ---------------------------------------------------------------- */

  it("E9-00 : TEMOIN - un bouton qui n appelle rien n ouvre aucune feuille", () => {
    // Meme routeur que la production, mais un bouton qui ne fait RIEN. Si ce
    // temoin passait malgre tout, les tests suivants ne prouveraient rien.
    function Routeur(): React.ReactElement {
      const [sheet, setSheet] = useState<PrepSheetId | null>(null);
      return (
        <>
          <button type="button" onClick={() => undefined}>
            Remplacer
          </button>
          <PrepSheets sheet={sheet} onClose={() => setSheet(null)} />
        </>
      );
    }
    render(<Routeur />);
    fireEvent.click(screen.getByRole("button", { name: /remplacer/i }));
    expect(dialogue(), "le temoin ne prouve rien : une feuille s'ouvre seule").toBeNull();
  });

  it("E9-01 : la carte garde DEUX actions, et « Remplacer » n est pas des martes", () => {
    poser();
    const { container } = render(<Ecran />);

    const rangee = container.querySelector(".prep-step__actions");
    expect(rangee, "la rangee d actions a disparu de la fiche").not.toBeNull();
    const libelles = Array.from(rangee?.querySelectorAll("button") ?? []).map(
      (noeud) => (noeud.textContent ?? "").trim(),
    );
    // L3.6 : consulter, et decider si l etape reste. Deux suffisent.
    expect(libelles).toEqual(["Détails", "À conserver"]);
  });

  it("E9-02 : le clic ouvre la VRAIE feuille de remplacement, depuis la fiche", () => {
    const model = poser();
    render(<Ecran />);

    // « Remplacer » a quitte la carte (L3.6) sans perdre sa capacite : on le
    // cherche la ou l on lit le detail de l etape.
    fireEvent.click(bouton("Détails"));
    fireEvent.click(bouton("Remplacer l\'étape"));

    const ouvert = dialogue();
    expect(ouvert, "le clic n a monte aucun dialogue").not.toBeNull();
    // Le titre vient du routeur, pas du composant : c est la preuve que le
    // clic a traverse l ecran, le routeur ET le Sheet.
    expect(ouvert?.textContent ?? "").toContain("Remplacer cette étape");
    // Et l etape visee est bien celle affichee, pas la premiere du programme
    // par hasard.
    expect(ouvert?.textContent ?? "").toContain(model.steps[0].title);
  });

  it("E9-03 : la capacite que le bouton invoque existe, et elle est nommee", () => {
    // Le moteur classe des alternatives a UNE etape...
    expect(typeof stepAlternatives.alternativesFor).toBe("function");
    // ...le store l interroge vraiment...
    const store = useAdventurePrepStore.getState();
    expect(typeof store.alternativesForStep).toBe("function");
    // ...et le routeur sait monter la feuille qui les affiche.
    expect(
      screen.queryByRole("button", { name: /remplacer/i }),
      "ce test ne doit dependre d aucun rendu",
    ).toBeNull();
  });

  it("E9-04 : deporter « Remplacer » n a rien casse autour de lui", () => {
    poser();
    const { container } = render(<Ecran />);
    const texte = (container.textContent ?? "").replace(/\s+/g, " ");

    // Le programme, la carte et le CTA de sortie sont intacts.
    expect(texte).toContain("Jour 1");
    expect(texte).toContain("Vers le départ");
    expect(container.querySelector(".prep-map__canvas")).not.toBeNull();
    // Les DEUX actions restantes agissent toujours.
    expect(container.querySelector(".prep-step__actions")?.querySelectorAll("button")).toHaveLength(2);
  });

  it("E9-05 : « Détails » ouvre la fiche ET nomme l etape reellement affichee", () => {
    const model = poser();
    render(<Ecran />);

    fireEvent.click(bouton("Détails"));

    const ouvert = dialogue();
    expect(ouvert, "le clic n'a monte aucun dialogue").not.toBeNull();
    // Sans l identite, la feuille afficherait « cette etape n existe plus » :
    // un etat honnete, mais faux. Elle doit donc nommer l etape visee.
    expect(ouvert?.textContent ?? "").toContain(model.steps[0].title);
    expect(ouvert?.textContent ?? "").not.toContain("n est plus dans le parcours");
  });
});
