/**
 * E10 — « Ajuster », « Étapes », « Ajouter » : trois boutons, trois vraies feuilles.
 *
 * La note de l'item etait exacte : le code existait, la preuve n'existait pas.
 * Ces tests montent l'ecran REEL dans jsdom, avec le VRAI store et le VRAI
 * routeur de feuilles, puis cliquent. Le chemin complet est exerce — clic ->
 * `onOpenSheet` -> `PrepSheets` -> dialogue monte dans le document — parce
 * qu'une assertion sur un spy ne prouverait que le rappel.
 *
 * Un `onClick={() => {}}` fait echouer ces tests : c'est le but. Le temoin
 * `E10-00` verifie meme que le harnais DETECTE un bouton mort, pour que les
 * trois suivants ne puissent pas passer pour rien.
 *
 * Le compte est verrouille aussi : six CTA sur une carte etaient le symptome
 * L3.6, et « Remplacer » a ete RETIRE (E9) plutot que cable en faux. Trois
 * boutons dans la rangee, tous actifs — voila ce que ces tests prouvent.
 */
// @vitest-environment jsdom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import { useDayFocusStore } from '@/components/mobile-nav/dayFocusStore';
import { buildItinerary } from '../engine/itinerary';
import { ItineraryStepScreen } from '../components/ItineraryStep';
import { PrepSheets, type PrepSheetId } from '../components/PrepSheets';
import { fullDraft } from './fixtures';
import type { AdventurePrepDraft, ItineraryModel } from '../types';

/* ------------------------------------------------------------------ */
/* Plateforme : ce que jsdom n'implemente pas et que les feuilles       */
/* appellent. Ce ne sont pas des mocks de produit, ce sont des shims.    */
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

/**
 * Pose un VRAI brouillon et son VRAI parcours dans le VRAI store.
 *
 * `buildItinerary` est le moteur de production : les etapes affichees ont donc
 * ete construites par le meme code que celles que voit la personne. Aucun
 * composant ni store n'est mocke — seul le DOM manquant a ete complete.
 */
function poser(overrides: Partial<AdventurePrepDraft> = {}): ItineraryModel {
  const draft = fullDraft(overrides);
  const model = buildItinerary(draft);
  if (!model) throw new Error("le brouillon de reference n'a produit aucun parcours");
  useAdventurePrepStore.setState({ draft: { ...draft, itinerary: model } });
  return model;
}

function dialogue(): HTMLElement | null {
  return document.body.querySelector('[role="dialog"]');
}

/**
 * L'ecran et son routeur de feuilles, RELIES comme en production.
 *
 * Sans ce lien, un `onOpenSheet={() => {}}` passerait tous les tests : le spy
 * recevrait l'identifiant et rien ne s'ouvrirait. Ici le clic remonte jusqu'au
 * `Sheet` de Radix, et le dialogue doit exister dans le document.
 */
/**
 * L ecran et son routeur de feuilles, RELIES.
 *
 * Le routeur est monte et `onOpenSheet` lui est transmis : sans cela le
 * harnais ne pourrait voir aucune feuille, et un bouton parfaitement
 * branche y echouerait. Un faux harnais ne doit pas condamner une
 * capacite reelle.
 */
function Ecran({ onOpen }: { onOpen: (id: PrepSheetId) => void }): React.ReactElement {
  const [sheet, setSheet] = useState<PrepSheetId | null>(null);
  const [stepId, setStepId] = useState<string | null>(etapeAffichee());
  const router = (id: PrepSheetId, cible?: string | null) => {
    onOpen(id);
    setSheet(id);
    setStepId(cible ?? etapeAffichee());
  };
  return (
    <>
      <ItineraryStepScreen onOpenSheet={router} />
      <PrepSheets
        sheet={sheet}
        onClose={() => setSheet(null)}
        focusStepId={stepId}
        replaceStepId={stepId}
        onOpenSheet={router}
      />
    </>
  );
}

/** L identite de l etape reellement affichee par la carte focalisee. */
function etapeAffichee(): string | null {
  const model = useAdventurePrepStore.getState().draft.itinerary;
  return model === null ? null : (model.steps[0]?.id ?? null);
}

/**
 * Le bouton de la rangee d'action, trouve par son TEXTE rendu.
 *
 * `Icon` rend un `role="img"` porte par un `aria-label` technique
 * (« clipboard-list ») : le nom accessible du bouton est donc
 * « clipboard-list Étapes », pas « Étapes ». La requete par role reste —
 * la preuve reste qu'un BOUTON expose ce texte — mais la comparaison porte sur
 * le texte rendu, pas sur la concatenation operee par l'icone.
 *
 * Un doublon est une erreur explicite : deux boutons « Ajouter » ne
 * pourraient pas dire lequel on a teste.
 */
function boutonAction(texte: string): HTMLElement {
  const rangee = document.body.querySelector('.prep-actionrow');
  expect(rangee, 'la rangee d’action a disparu de l’ecran').not.toBeNull();
  const boutons = within(rangee as HTMLElement)
    .getAllByRole('button')
    .filter((bouton) => (bouton.textContent ?? '').trim() === texte);
  expect(boutons, `aucun bouton « ${texte} » dans la rangee d’action`).toHaveLength(1);
  return boutons[0] as HTMLElement;
}

/** Le libelle exact du bouton, pour ne pas confondre « Ajouter » et « Ajouter une étape ». */
const BOUTON: Readonly<Record<'adjust' | 'steps' | 'add', string>> = {
  adjust: 'Ajuster',
  steps: 'Étapes',
  add: 'Ajouter',
};

/** Le titre que porte le tiroir une fois ouvert (`TITLES` de `PrepSheets`). */
const TITRE: Readonly<Record<'adjust' | 'steps' | 'add', string>> = {
  adjust: 'Ajuster le parcours',
  steps: 'Le programme complet',
  add: 'Ajouter une étape',
};

describe('E10 — les trois boutons d’action ouvrent leur feuille', () => {
  beforeEach(() => {
    useAdventurePrepStore.getState().resetDraft();
    useDayFocusStore.getState().clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  /* ---------------------------------------------------------------- */
  /* Temoin : ce fichier DOIT detecter un bouton mort.                 */
  /* ---------------------------------------------------------------- */

  it('E10-00 : un bouton qui n’appelle rien n’ouvre aucune feuille', () => {
    function Mort(): React.ReactElement {
      return (
        <>
          <button type="button" onClick={() => undefined}>
            Ajuster
          </button>
          <PrepSheets sheet={null} onClose={() => undefined} />
        </>
      );
    }

    render(<Mort />);
    fireEvent.click(screen.getByRole('button', { name: /ajuster/i }));

    expect(
      dialogue(),
      'le harnais ne verrait rien : un onClick mort passerait pour un succes',
    ).toBeNull();
  });

  /* ---------------------------------------------------------------- */
  /* Les trois boutons, un par un.                                     */
  /* ---------------------------------------------------------------- */

  const FEUILLES: ReadonlyArray<readonly ['adjust' | 'steps' | 'add', string]> = [
    ['adjust', 'E10-01'],
    ['steps', 'E10-02'],
    ['add', 'E10-03'],
  ];

  it.each(FEUILLES)('%s : « %s » ouvre le bon tiroir', (feuille, id) => {
    poser();
    const vues: PrepSheetId[] = [];
    render(<Ecran onOpen={(ouverte) => vues.push(ouverte)} />);

    fireEvent.click(boutonAction(BOUTON[feuille]));

    expect(vues, `${id} : le clic doit demander la feuille « ${feuille} »`).toEqual([feuille]);
    const monte = dialogue();
    expect(monte, `${id} : aucun dialogue monte par le clic`).not.toBeNull();
    expect(
      monte?.textContent,
      `${id} : la feuille ouverte n'est pas « ${TITRE[feuille]} »`,
    ).toContain(TITRE[feuille]);
  });

  /* ---------------------------------------------------------------- */
  /* Un tiroir, pas une decoration.                                    */
  /* ---------------------------------------------------------------- */

  it('E10-04 : la feuille se referme, le bouton n’ouvre pas une vue figée', () => {
    poser();
    render(<Ecran onOpen={() => undefined} />);

    fireEvent.click(boutonAction(BOUTON.steps));
    const ouverte = dialogue();
    expect(ouverte, 'la feuille « Étapes » ne s’ouvre pas').not.toBeNull();

    fireEvent.keyDown(ouverte as HTMLElement, { key: 'Escape' });

    expect(dialogue(), 'Échap doit retirer le tiroir de l’ecran').toBeNull();
  });

  /* ---------------------------------------------------------------- */
  /* Le compte : plus de six CTA, et aucun bouton sans effet.           */
  /* ---------------------------------------------------------------- */

  it('E10-05 : la rangée d’action ne contient que ces trois boutons', () => {
    poser();
    render(<Ecran onOpen={() => undefined} />);

    const rangee = document.body.querySelector('.prep-actionrow');
    expect(rangee, 'la rangée d’action a disparu de l’ecran').not.toBeNull();
    const libelles = Array.from(rangee?.querySelectorAll('button') ?? []).map(
      (bouton) => (bouton.textContent ?? '').trim(),
    );

    expect(libelles, 'la rangée d’action ne porte plus exactement les trois CTA').toEqual([
      BOUTON.adjust,
      BOUTON.steps,
      BOUTON.add,
    ]);
  });

  it('E10-06 : « Remplacer » est un bouton VIVANT, pas une promesse', () => {
    // Le contrat a bascule depuis : `engine/stepAlternatives` sait desormais
    // classer des alternatives REELLES, et le bouton est revenu sur la fiche.
    // Ce qui demeure interdit n est donc plus sa PRESENCE, c est son
    // SILENCE : le bouton avait ete retire parce qu il promettait une action
    // que rien ne portait. Ce test exige donc que le clic tienne sa promesse.
    poser();
    const vues: PrepSheetId[] = [];
    render(<Ecran onOpen={(ouverte) => vues.push(ouverte)} />);

    // L3.6 a deplace « Remplacer » de la carte vers la fiche de l etape :
    // trois boutons de meme poids se lisaient comme trois actions de meme
    // importance. La capacite, elle, demeure - et c est elle que ce test
    // verifie. On passe donc par « Détails », comme un utilisateur.
    fireEvent.click(screen.getByRole('button', { name: /^détails$/i }));
    fireEvent.click(screen.getByRole('button', { name: /remplacer l/i }));

    expect(
      vues,
      '« Remplacer » ne demande aucune feuille : le bouton promet une action qu aucun code ne porte',
    // La fiche d abord (« step »), puis le remplacement (« replace »).
    ).toEqual(['step', 'replace']);
    const monte = dialogue();
    expect(monte, '« Remplacer » n ouvre aucun tiroir').not.toBeNull();
    expect(
      monte?.textContent,
      'le tiroir ouvert n est pas celui du remplacement d etape',
    ).toContain('Remplacer cette étape');
  });
});

/* ================================================================== */
/* C9-UI - le tiroir Quand saisit l heure de depart                      */
/*                                                                    */
/* Chaque test porte son CONTRE-EXEMPLE. Le temoin C9-UI-00 verifie   */
/* que le harnais DETECTE un champ deconnecte du store, pour qu aucun   */
/* des suivants ne puisse pas passer pour rien.                        */
/* ================================================================== */

function TiroirQuand(): React.ReactElement {
  return <PrepSheets sheet={"calendar"} onClose={() => undefined} />;
}

describe("C9-UI - le tiroir Quand saisit l heure de depart", () => {
  beforeEach(() => {
    useAdventurePrepStore.getState().resetDraft();
    useDayFocusStore.getState().clear();
    poser();
    render(<TiroirQuand />);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function champHeure(): HTMLInputElement {
    const champ = screen.getByLabelText(/heure de d[ée]part/i);
    expect(champ, "le tiroir Quand ne rend aucun champ « heure de depart »").not.toBeNull();
    return champ as HTMLInputElement;
  }

  it("C9-UI-00 : TEMOIN - le harnais detecte un champ deconnecte du store", () => {
    // CONTRE-EXEMPLE du harnais lui-meme. Si ce test passait, les suivants
    // ne prouveraient rien : il simule exactement le defaut le plus probable
    // (un onChange present mais deconnecte) et exige que l etat bouge.
    useAdventurePrepStore.getState().setCalendarStartTime("08:30");
    render(
      <label>
        Heure de depart temoin
        <input type="time" aria-label="Heure de depart temoin" onChange={() => undefined} />
      </label>,
    );
    fireEvent.change(screen.getByLabelText(/heure de depart temoin/i), {
      target: { value: "09:45" },
    });
    expect(
      useAdventurePrepStore.getState().draft.calendar.startTime,
      "ce test doit ECHOUER si le harnais ne voit pas la deconnexion",
    ).toBe("08:30");
  });

  it("C9-UI-01 : le champ existe, et il est VIDE tant que personne ne saisit", () => {
    // CONTRE-EXEMPLE : un champ affichant deja une heure au montage aurait
    // FABRIQUE une reponse. L absence doit se lire comme une absence.
    expect(champHeure().value, "le champ affiche une heure avant toute saisie").toBe("");
  });

  it("C9-UI-02 : une heure saisie aboutit dans le VRAI store", () => {
    fireEvent.change(champHeure(), { target: { value: "08:30" } });
    expect(
      useAdventurePrepStore.getState().draft.calendar.startTime,
      "la saisie n a pas traverse le champ jusqu au store",
    ).toBe("08:30");
  });

  it("C9-UI-03 : CONTRE-EXEMPLE - effacer le champ ne FABRIQUE aucune heure", () => {
    const champ = champHeure();
    fireEvent.change(champ, { target: { value: "08:30" } });
    expect(useAdventurePrepStore.getState().draft.calendar.startTime).toBe("08:30");

    fireEvent.change(champ, { target: { value: "" } });

    // L absence reste null. Une heure par defaut poserait ici un fait sans
    // reponse derriere elle - exactement ce que C9 doit interdire.
    expect(useAdventurePrepStore.getState().draft.calendar.startTime).toBeNull();
  });

  // L absence est SEMANTIQUE. `CalendarBlock.startTime` est volontairement
  // optionnel - un brouillon enregistre avant l arrivee de l heure n a pas la
  // cle - donc `undefined` et `null` veulent dire la MEME chose : aucune heure
  // repondue. Ce que le contrat interdit, c est une heure FABRIQUEE ; ce que
  // le test lit, c est donc « aucune heure », pas « cle presente ».
  function heureLue(): string | null {
    return useAdventurePrepStore.getState().draft.calendar.startTime ?? null;
  }

  it("C9-UI-04 : CONTRE-EXEMPLE - une heure invalide n est jamais approchee", () => {
    const champ = champHeure();

    for (const mauvaise of ["25:00", "12:60", "23:60", "abc", "8:5", ""]) {
      // Chaque essai REPART d une heure vraie. Sans cette relance, le champ
      // serait deja vide, une saisie hors forme ne produirait aucun
      // changement, et le test passerait sans avoir rien mesure.
      fireEvent.change(champ, { target: { value: "08:30" } });
      expect(heureLue(), "l essai ne part pas d une heure repondue").toBe("08:30");

      fireEvent.change(champ, { target: { value: mauvaise } });

      // Ni la forme tapee, ni un arrondi plausible, ni un reste de la
      // precedente : l absence se relit, et l IA reste libre de choisir.
      expect(heureLue(), `\u00ab ${mauvaise} \u00bb a ete approchee en ${heureLue()}`).toBeNull();
    }
  });

  it("C9-UI-05 : l heure ne touche ni la date, ni la duree, ni le retour", () => {
    const avant = { ...useAdventurePrepStore.getState().draft.calendar };
    fireEvent.change(champHeure(), { target: { value: "06:45" } });

    const apres = useAdventurePrepStore.getState().draft.calendar;
    expect(apres.startDate).toBe(avant.startDate);
    expect(apres.durationDays).toBe(avant.durationDays);
    expect(apres.returnDate).toBe(avant.returnDate);
  });

  it("C9-UI-06 : l heure saisie SURVIT a la validation puis a la relecture", () => {
    fireEvent.change(champHeure(), { target: { value: "07:15" } });
    fireEvent.click(screen.getByRole("button", { name: /^appliquer$/i }));
    // Rouvrir le tiroir, comme le ferait la personne : la valeur doit se
    // relire depuis le store, pas depuis un etat local conserve.
    cleanup();
    render(<TiroirQuand />);
    expect(
      champHeure().value,
      "l heure saisie est perdue : le tiroir se relit sur une autre source",
    ).toBe("07:15");
  });

  it("C9-UI-07 : le champ ne se DOUBLE pas - un seul regime d heure dans le tiroir", () => {
    expect(
      screen.getAllByLabelText(/heure de d[ée]part/i).length,
      "le tiroir Quand rend plusieurs champs d heure : lequel fait foi ?",
    ).toBe(1);
  });

  it("C9-UI-08 : le champ est un horaire, pas un texte libre", () => {
    // Le type natif porte le pavet numerique du systeme et la validation
    // HH:MM : c est ce qui rend une heure de depart saisissable sur mobile.
    expect(champHeure().type, "le champ doit etre un input time").toBe("time");
  });

  it("C9-UI-09 : CONTRE-EXEMPLE - l heure choisie se LIT sur le verre du tiroir", () => {
    // Mesure au navigateur (2026-09-29, 393x852) sur le composant reel : le
    // depositaire herait de `.t1`, dont la couleur est
    // `--lkv-text-primary` (#172B24) - l encre des surfaces CLAIRES du hub.
    // Posee sur la pastille de verre, elle rendait rgb(23, 43, 36) : un
    // quasi-noir sur fond sombre, donc une heure choisie ILLISIBLE, et la
    // pastille devenait l element le plus lumineux d une carte qui ne veut
    // rien dire.
    //
    // Le tiroir ne se lit pas sur le theme de la page : il expose ses propres
    // encres (`--prep-ink-*`), mesurees sur son verre. Une heure repondue est
    // un accent pose, donc `--prep-ink-accent-strong` ; une heure absente est
    // une reponse qui n a pas ete donnee, donc l encre de lecture du tiroir.
    const champ = champHeure();
    // On SAISIT d abord : on mesure l encre d une heure repondue, pas celle
    // d un champ vide. Sans cette saisie le depositaire porterait « A choisir »
    // et le test echouerait pour une autre raison que celle qu il surveille.
    fireEvent.change(champ, { target: { value: "08:30" } });
    expect(useAdventurePrepStore.getState().draft.calendar.startTime).toBe("08:30");

    const pastille = champ.closest(".note") as HTMLElement | null;
    expect(pastille, "le champ n est pose sur aucune pastille de verre").not.toBeNull();

    const depositaire = Array.from(pastille!.querySelectorAll("span")).find(
      (noeud) => noeud.textContent === "08:30",
    );
    expect(depositaire, "le champ n affiche aucune heure saisie").toBeTruthy();

    // La couleur doit venir des JETONS DU TIROIR. On lit l attribut pose :
    // c est le contrat que le composant tient, et il reste vrai meme si la
    // feuille de style change un jour.
    const posee = depositaire!.getAttribute("style") ?? "";
    expect(
      posee,
      "l heure choisie n est pas encree avec l encre du tiroir : elle sort de "
        + "l encre des surfaces claires, donc invisible sur le verre",
    ).toMatch(/color:\s*var\(--prep-ink-accent-strong\)/);
  });

  it("C9-UI-10 : les libelles affiches sont des FRANCAIS, accentues", () => {
    // Mesure au navigateur (2026-09-29) : le champ s affichait « Heure de
    // depart » et « A choisir ». Un libelle sans accent n est pas une faute
    // de frappe : c est le mot lu par la personne, dans une interface dont
    // TOUT le reste est accentue (« Date de d[?]part », « D[?]r[?]e »). Les
    // selecteurs tolerants (`/heure de d[ée]part/i`) acceptent les DEUX
    // formes, donc aucun test ne peut voir cette faute : il faut l interdire
    // explicitement, ou elle revient au premier commit.
    //
    // Le controle est cible : il ne juge que la TETE du champ et son
    // depositaire, pas tout le tiroir - un autre travail peut, lui, legacies
    // des libelles sans accent sans faire echouer ce test.
    const champ = champHeure();
    const pastille = champ.closest(".note") as HTMLElement | null;
    expect(pastille, "le champ n est pose sur aucune pastille de verre").not.toBeNull();

    const depositaire = Array.from(pastille!.querySelectorAll("span")).find(
      (noeud) => noeud.getAttribute("aria-hidden") === "true",
    );
    expect(depositaire, "la pastille n affiche aucune valeur").toBeTruthy();

    // Le `<label>` et le `<input>` sont des FRERES dans le `.field` : React
    // ne les imbrique pas. On le retrouve donc par son `for`, ce qui est
    // d ailleurs ce que fait `champHeure()` pour le trouver.
    const titre = document.querySelector<HTMLElement>('label[for="prep-start-time"]');
    expect(titre, "le champ n est porte par aucun libelle").not.toBeNull();

    // Les chaines qui VIDANGENT la typographie francaise.
    const sansAccents = [
      ["libelle", titre?.textContent ?? ""],
      ["valeur vide", depositaire!.textContent ?? ""],
      ["aide", pastille!.parentElement?.textContent ?? ""],
    ] as const;

    // Une faute d accent ne se voit pas sur une comparaison de chaines : on
    // compare donc le TEXTE RENDU a sa version sans diacritiques, et on exige
    // qu ils soient IDENTIQUES. Ils ne le sont que si la source ne portait
    // aucun accent : « Depart » reste « Depart », « Depart » accentue se
    // distingue de « Depart » nu.
    for (const [quoi, texte] of sansAccents) {
      const brut = texte.replace(/\s+/g, " ").trim();
      const sansDiacritiques = brut.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      // Si la chaine RETIENT ses diacritiques, c est qu elle en porte. La
      // faute d accent se lit donc exactement comme une chaine SANS accents :
      // on peut la nommer, mais pas la detecter par comparaison - deux chaines
      // ne se distinguent que par leur contenu, et le contenu est le meme.
      // D ou le controle qui suit : on interdit explicitement la forme nue
      // de chaque mot de l interface.
      expect(
        { quoi, brut, porteDesAccents: brut !== sansDiacritiques },
        `${quoi} : « ${brut} » - forme sans diacritiques « ${sansDiacritiques} »`,
      ).toMatchObject({ porteDesAccents: true });
    }

    // Et la forme attendue est bien celle qu on veut lire.
    expect(titre?.textContent?.trim()).toBe("Heure de départ");
    expect(depositaire!.textContent?.trim()).toBe("À choisir");
  });
});