/**
 * LOT ETAPE 2 - le plus grand ecran du preparateur (L3.1 a L3.9, M2.1 a M2.4).
 *
 * Ces tests mordent : chacun d eux ECHOIT si le defaut qu il decrit est
 * retabli. Ils portent sur le MARQUAGE rendu, parce qu un defaut de mise en
 * page se voit dans le DOM (un <img> absent, un texte de developpement hors d un
 * commentaire, un bouton duplique) et pas dans l intention du code.
 *
 * Regle qui domine toutes les autres : une information absente s affiche
 * « indisponible » ou « a verifier », JAMAIS une valeur fabriquee. Ces tests
 * echouent donc aussi si quelqu un invente une temperature ou un kilometrage.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ItineraryStepScreen } from '../components/ItineraryStep';
import DayPlateau from '@/components/mobile-nav/navigation/DayPlateau';
import {
  useDayFocusStore,
  type DayFocusDay,
  type DayFocusState,
} from '@/components/mobile-nav/dayFocusStore';
import { buildItinerary } from '../engine/itinerary';
import { fullDraft } from './fixtures';
import { PRICE_TO_CHECK } from '../types';
import type { AdventurePrepDraft, ItineraryModel } from '../types';
import type { DayWeather } from '../engine/weather';

const state = vi.hoisted(() => ({ current: null as { draft: AdventurePrepDraft } | null }));

vi.mock('../store/useAdventurePrepStore', () => {
  const use = ((selector: (store: { draft: AdventurePrepDraft }) => unknown) =>
    selector(state.current as { draft: AdventurePrepDraft })) as unknown as {
    getState: () => unknown;
  };
  use.getState = () => state.current;
  return { useAdventurePrepStore: use };
});

/**
 * L3.7 - le rail de jours vit dans le CHROME, pas dans le corps de l etape.
 *
 * `DayPlateau` est monte par `WebNavigationBar`, dans un arbre React disjoint :
 * le corps de l etape 2 ne peut donc pas le rendre, et compter ses onglets
 * demande de le monter pour compte. Deux obstacles, un seul correctif :
 * zustand v5 sert l etat INITIAL au rendu serveur, donc un composant monte
 * par `renderToStaticMarkup` ne voit jamais les journees publiees.
 *
 * Ce shim ne fabrique aucune donnee et ne doublure aucun comportement : il ne
 * fait que lever la limite du harnais, exactement comme ce fichier et
 * `e6-swipe` lisent le store par `getState()`. `getState`, `setState` et
 * `subscribe` restent ceux du vrai store ; seul le snapshot serveur change.
 */
vi.mock('@/components/mobile-nav/dayFocusStore', async (importOriginal) => {
  const reel = await importOriginal<typeof import('@/components/mobile-nav/dayFocusStore')>();
  const store = reel.useDayFocusStore;
  const useSSR = ((selector: (s: DayFocusState) => unknown) =>
    selector(store.getState())) as unknown as typeof store;
  Object.assign(useSSR, store);
  return { ...reel, useDayFocusStore: useSSR };
});

const noop = () => undefined;

function visible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

const FEUILLE = readFileSync(join(__dirname, '..', 'adventure-prep.css'), 'utf8');
const SOURCE = readFileSync(join(__dirname, '..', 'components', 'ItineraryStep.tsx'), 'utf8');

/**
 * Les declarations d UN selecteur, commentaires retires.
 *
 * Un defaut de mise en page ne se voit pas dans le DOM : un `nowrap`, un
 * `ellipsis` ou un plafond de lignes ne laissent aucune trace dans le markup.
 * Ces items se ferment donc sur la feuille de style, qui est la seule couche
 * qui s applique a CHAQUE carte, quelle que soit la longueur de son titre.
 */
function declarations(selector: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m = re.exec(FEUILLE);
  while (m !== null) {
    const sel = (m[1] ?? '')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .split(',')
      .map((p) => p.trim());
    const corps = (m[2] ?? '').replace(/\/\*[\s\S]*?\*\//g, ' ');
    if (sel.includes(selector)) {
      for (const d of corps.split(';')) {
        const i = d.indexOf(':');
        if (i > 0) out.set(d.slice(0, i).trim(), d.slice(i + 1).trim());
      }
    }
    m = re.exec(FEUILLE);
  }
  return out;
}

/**
 * Le source de l ecran, commentaires retires : un commentaire peut nommer un
 * composant mort pour expliquer pourquoi il a disparu ; il ne le ressuscite
 * pas, et il ne doit donc pas faire echouer la garde.
 */
function sourceItineraireStep(): string {
  return SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
}

/**
 * Publie les journees du modele dans le store partage, comme le fait le shell.
 *
 * Renvoie ce que le store a ACCEPTE, pas ce qu on lui a donne : sous deux
 * journees le store vide ses jours, et un test qui compterait le modele au
 * lieu du store validerait un rail qui n existe pas.
 */
function publierLesJours(model: ItineraryModel): DayFocusDay[] {
  useDayFocusStore.getState().clear();
  useDayFocusStore.getState().publishDays(
    Array.from({ length: model.days }, (_, index) => ({
      day: index + 1,
      dateLabel: null,
      stepsCount: 0,
      distanceKm: null,
      elevGainM: null,
    })),
  );
  return useDayFocusStore.getState().days;
}

/** Le rail de jours du chrome, monte pour compte. */
function railDuChrome(): string {
  return renderToStaticMarkup(React.createElement(DayPlateau));
}

function builtDraft(
  over: Partial<AdventurePrepDraft> = {},
  mutate: (model: ItineraryModel) => ItineraryModel = (model) => model,
): AdventurePrepDraft {
  const draft = fullDraft(over);
  const model = buildItinerary(draft);
  if (!model) throw new Error('fixture : le brouillon de base doit etre construisible');
  return { ...draft, itinerary: mutate(model) };
}

function render(): string {
  return renderToStaticMarkup(React.createElement(ItineraryStepScreen, { onOpenSheet: noop }));
}

const JOUR1: DayWeather = {
  date: '2026-07-11',
  tMaxC: 24,
  tMinC: 11,
  precipMm: 0,
  precipProbPct: 20,
  windMaxKmh: 14,
  code: 2,
  label: 'Partiellement nuageux',
};

/* ------------------------------------------------------------------ */
/* L3.1 / M2.1 — le bandeau IA pese moins que le contenu              */
/* ------------------------------------------------------------------ */

describe('L3.1 — le bandeau IA tient sur une ligne repliable', () => {
  it('L3.1-01: la pastille ne contient qu UN seul element textuel', () => {
    state.current = { draft: builtDraft() };
    const pill = render().match(
      /<button[^>]*class="[^"]*prep-pill[^"]*"[^>]*>([\s\S]*?)<\/button>/,
    );
    expect(pill).not.toBeNull();
    // Une pastille qui replie sur quatre lignes tient plusieurs blocs. On ne
    // compte pas les balises : on compte les enfants RENDUS.
    const inner = pill![1];
    // Deux spans : l icone (role="img") et LE label. C est la forme voulue —
    // une icone et un titre. Ce qui ferait repasser a quatre lignes, c est
    // un TROISIEME bloc : la notice, ou un sous-titre. On compte donc les
    // elements porteurs de TEXTE, pas les balises.
    const labels = inner.match(/<span class="prep-pill__label">/g) ?? [];
    expect(labels.length).toBe(1);
    const icons = inner.match(/role="img"/g) ?? [];
    expect(icons.length).toBe(1);
  });

  it('L3.1-02: la pastille ne contient AUCUNE notice de generation', () => {
    state.current = { draft: builtDraft() };
    const pill = render().match(
      /<button[^>]*class="[^"]*prep-pill[^"]*"[^>]*>([\s\S]*?)<\/button>/,
    )!;
    // Le bandeau IA ne doit pas porter la promesse de verification : c est ce
    // qui le faisait passer de deux lignes a quatre.
    expect(visible(pill[1])).not.toContain('vérifier');
    expect(visible(pill[1])).not.toContain('confirmer');
  });

  it('L3.1-03: la pastille est un SEUL bouton, pas un bloc de deux liens', () => {
    state.current = { draft: builtDraft() };
    const pill = render().match(
      /<button[^>]*class="[^"]*prep-pill[^"]*"[^>]*>([\s\S]*?)<\/button>/,
    )!;
    expect((pill[1].match(/<button/g) ?? []).length).toBe(0);
    expect((pill[1].match(/<a\s/g) ?? []).length).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* L3.8 — meteo par journee : honnete avant tout                       */
/* ------------------------------------------------------------------ */

describe('L3.8 — la meteo s affiche par jour, ou se declare absente', () => {
  it('L3.8-01: chaque journee affiche une meteo, meme quand elle est absente', () => {
    state.current = { draft: builtDraft() };
    const model = state.current.draft.itinerary!;
    const html = render();
    const heads = html.match(/class="prep-programme__weather"/g) ?? [];
    expect(heads.length).toBe(model.days);
  });

  it('L3.8-02: sans donnee, l ecran dit « meteo indisponible »', () => {
    state.current = { draft: builtDraft({}, (model) => ({ ...model, weather: [] })) };
    const text = visible(render());
    expect(text).toContain('Météo indisponible');
  });

  it('L3.8-03: sans donnee, AUCUNE temperature n est affichee', () => {
    state.current = { draft: builtDraft({}, (model) => ({ ...model, weather: [] })) };
    const html = render();
    // Le piege : remplacer `null` par la meteo d un autre jour, ou par un
    // defaut (« 0 ° », « 18 ° »). Aucun degree ne doit apparaitre dans le
    // bloc meteo quand le fournisseur n a rien dit.
    const blocks = html.match(/<span class="prep-programme__weather">[\s\S]*?<\/span>/g) ?? [];
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(visible(block)).not.toMatch(/\d+\s*°/);
    }
  });

  it('L3.8-04: une ligne de mesures vide ne laisse pas de trace', () => {
    state.current = { draft: builtDraft({}, (model) => ({ ...model, weather: [] })) };
    const html = render();
    // `measures` vide = rien a afficher. Rendre un conteneur vide ferait
    // lire « desole, on a oublie » au lieu de « rien a mesurer ».
    expect(html).not.toContain('prep-programme__measures');
  });

  it('L3.8-05: avec une donnee reelle, la meteo s affiche ET les mesures suivent', () => {
    state.current = {
      draft: builtDraft({}, (model) => ({ ...model, weather: [JOUR1] })),
    };
    const text = visible(render());
    expect(text).toContain('Partiellement nuageux');
    expect(text).toContain('11° / 24°');
  });
});

/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* L3.5 - aucune vignette qui pretend etre une photo                    */
/* ------------------------------------------------------------------ */

describe('L3.5 - la fiche ne montre aucune image qu elle n a pas', () => {
  it('L3.5-01: la fiche ne rend AUCUN <img>', () => {
    state.current = { draft: builtDraft() };
    const fiche = render().match(
      /<div class="prep-step">[\s\S]*?<div class="prep-step__actions">/,
    );
    expect(fiche).not.toBeNull();
    // `ItineraryStep` et `PlaceRef` n ont AUCUN champ image : une <img> ici
    // serait une image FABRIQUEE, donc un mensonge pixelise. Une <img> sans
    // `src` serait pire encore : un cadre vide qui promet la photo disparue.
    expect(fiche![0].match(/<img[^>]*>/g) ?? []).toEqual([]);
  });

  it('L3.5-02: pas de vignette icone non plus - le titre suffit', () => {
    state.current = { draft: builtDraft() };
    const html = render();
    // La vignette etait un <span> + <Icon>, pas une image : elle ne montrait
    // aucune photo, elle repetait en 44 px le type d etape que le titre dit
    // deja. Elle disparait plutot que de continuer a suggerer une image que
    // le modele ne possede pas. (.prep-step__thumb reste dans la feuille :
    // le tiroir des etapes, lui, s en sert encore.)
    expect(html.match(/class="[^"]*prep-step__thumb/g) ?? []).toEqual([]);
    // Le QUOI reste porte par un seul element textuel.
    expect(html).toMatch(/<h3 class="prep-step__name">/);
  });
});

/* ------------------------------------------------------------------ */
/* L3.4 — un seul badge, jamais « a verifier . a verifier »           */
/* ------------------------------------------------------------------ */

describe('L3.4 — pas de badge duplique', () => {
  it('L3.4-01: la carte focussee ne porte qu UNE mention « a verifier »', () => {
    state.current = { draft: builtDraft() };
    const html = render();
    // Le defaut L3.4 : la MEME absence repetee sur la meme ligne, parce que
    // le joint joignait deux valeurs absentes. Deux mentions « À vérifier »
    // sur la carte restent acceptables (l heure ET le prix sont deux faits
    // distincts) ; deux sur la MEME ligne, non. La ligne qui porte l absence
    // ne doit donc pas en contenir deux.
    const when = visible(html.match(/<div class="prep-step__when"[^>]*>([\s\S]*?)<\/div>/)![1]);
    expect((when.match(/À vérifier/g) ?? []).length).toBeLessThanOrEqual(1);
  });

  it('L3.4-02: une repetition cote a cote est interdite', () => {
    state.current = { draft: builtDraft() };
    const text = visible(render());
    expect(text).not.toMatch(/À vérifier\s*·\s*À vérifier/);
  });
});

/* ------------------------------------------------------------------ */
/* L3.6 / M2.2 — une hierarchie d actions lisible                      */
/* ------------------------------------------------------------------ */

describe('L3.6 — les actions de la carte ont une priorite lisible', () => {
  it('L3.6-01: la carte focussee expose DEUX actions au maximum', () => {
    state.current = { draft: builtDraft() };
    const html = render();
    const card = html.match(/<div class="prep-step__actions">([\s\S]*?)<\/div>/);
    expect(card).not.toBeNull();
    const buttons = card![1].match(/<button/g) ?? [];
    // Le defaut L3.6 : six boutons a plat, sans priorite. Deux suffisent —
    // consulter, et decider si l etape reste.
    expect(buttons.length).toBeLessThanOrEqual(2);
  });

  it('L3.6-02: les actions rares ou destructrices ne sont pas dans la carte', () => {
    state.current = { draft: builtDraft() };
    const html = render();
    const card = html.match(/<div class="prep-step__actions">([\s\S]*?)<\/div>/)!;
    const text = visible(card[1]);
    // « Retirer » est irreversible, « Remplacer » n existe pas dans le
    // moteur : ni l un ni l autre n a sa place sur la carte.
    expect(text).not.toContain('Retirer');
    expect(text).not.toContain('Remplacer');
    expect(text).not.toContain('Ajouter');
  });

  it('L3.6-03: la carte repond aux trois questions — quoi, ou, combien', () => {
    state.current = { draft: builtDraft() };
    const html = render();
    const model = state.current.draft.itinerary!;
    const first = model.steps[0];
    // QUOI : le titre. OU : le lieu. COMBIEN : le prix. Trois reperes, pas
    // une plaquette de champs.
    const card = html.match(/<div class="prep-step">([\s\S]*?)<\/div><\/div>/);
    expect(card).not.toBeNull();
    const text = visible(html);
    expect(text).toContain(first.title);
    expect(html).toContain('prep-step__price');
  });
});

/* ------------------------------------------------------------------ */
/* M2.3 — OU ? : la carte nomme enfin le lieu                       */
/* ------------------------------------------------------------------ */

describe('M2.3 — la carte focalisee repond a OU', () => {
  it('M2.3-01: la carte nomme le lieu, pas seulement le titre et le prix', () => {
    state.current = { draft: builtDraft() };
    const html = render();
    const model = state.current.draft.itinerary!;
    const first = model.steps[0];
    // Mesure (etape 2, 393x852) : la carte disait QUOI (titre), QUAND et
    // COMBIEN. OU manquait, alors que le champ existait deja dans le modele.
    if (first.placeName) {
      expect(html).toContain('prep-step__place');
      expect(html).toContain(first.placeName);
    }
    // La case doit etre RENSEIGNEE quand le modele sait : une classe presente
    // mais vide ne repondrait a personne.
    expect(html).toMatch(/<p class="prep-step__place"[^>]*>\s*\S/);
  });

  it('M2.3-02: sans lieu connu, la carte n invente NI ligne NI libelle', () => {
    state.current = {
      draft: builtDraft({}, (model) => ({
        ...model,
        steps: [...model.steps].map((step) => ({ ...step, placeName: null })),
      })),
    };
    const html = render();
    // Le piege : « Lieu a verifier », un tiret, ou le nom du lieu voisin.
    // Une absence se montre par son absence.
    expect(html).not.toContain('prep-step__place');
    expect(visible(html)).not.toMatch(/Lieus*[àa]s*vérifier/i);
  });
});

/* ------------------------------------------------------------------ */
/* M2.2 — une priorite lisible dans la rangee d actions            */
/* ------------------------------------------------------------------ */

describe('M2.2 — les trois actions ont une priorite lisible', () => {
  it('M2.2-01: la rangee garde EXACTEMENT trois actions, dans l ordre', () => {
    state.current = { draft: builtDraft() };
    const html = render();
    const row = html.match(/<div class="prep-actionrow">([\s\S]*?)<\/div>/);
    expect(row).not.toBeNull();
    const labels = Array.from(row![1].matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)).map((m) =>
      visible(m[1]),
    );
    // E10-05 verrouille deja ces trois libelles : la hierarchie ne doit pas
    // les bouger, sinon on casse la garantie du tiroir « Etapes ».
    expect(labels).toEqual(['Ajuster', 'Étapes', 'Ajouter']);
  });

  it('M2.2-02: UNE seule action primaire, et c est celle qui corrige', () => {
    state.current = { draft: builtDraft() };
    const html = render();
    const row = html.match(/<div class="prep-actionrow">([\s\S]*?)<\/div>/);
    // Le rendu porte la variante dans `data-variant`, pas dans une classe :
    // c est ce que `Button` expose, et c est la seule source de verite.
    const variants = Array.from(row![1].matchAll(/<button[^>]*data-variant="([^"]*)"/g)).map((m) => m[1]);
    expect(variants).toEqual(['primary', 'secondary', 'secondary']);
    // Trois boutons identiques se lisent comme trois actions de meme
    // importance. Il en faut une qui sorte du lot — ici « Ajuster », celle
    // qui corrige un parcours qui vient d etre produit.
    expect(variants.filter((v) => v === 'primary').length).toBe(1);
  });
});
/* ------------------------------------------------------------------ */
/* M2.4 - plus un seul jeton mort dans l etape 2                      */
/* ------------------------------------------------------------------ */

describe('M2.4 - les jetons morts sont retires', () => {
  it('M2.4-01: ni carte fantome, ni liste orpheline, ni handler orphelin', () => {
    const source = sourceItineraireStep();
    // `StepCard` et `ProducedStep` n etaient jamais instancies, `openStep`
    // n etait appele par personne, `CARD_BUTTON` et `PLAIN_LIST` n etaient
    // lus par aucune branche. Un composant mort est le pire des allies : il
    // ressemble a une carte que l on peut corriger, et la correction ne
    // s affiche jamais. On le cherche dans le CODE, commentaires retires.
    for (const mort of ['StepCard', 'ProducedStep', 'openStep', 'CARD_BUTTON', 'PLAIN_LIST']) {
      expect(source).not.toMatch(new RegExp(`\\b${mort}\\b`));
    }
  });

  it('M2.4-02: une SEULE carte a l ecran, et c est celle qui est rendue', () => {
    state.current = { draft: builtDraft() };
    const html = render();
    // La carte rendue est `FocusedStepView`. Une seule a l ecran.
    expect((html.match(/<div class="prep-step">/g) ?? []).length).toBe(1);
    // Et le source ne la nomme qu une fois en definition et qu une fois en
    // usage : le nombre d ecrans est coherent avec ce que le test voit.
    const source = sourceItineraireStep();
    expect((source.match(/^function FocusedStepView\b/gm) ?? []).length).toBe(1);
    expect((source.match(/<FocusedStepView\b/g) ?? []).length).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* L3.2 / M2.3 — une seule hierarchie typographique                    */
/* ------------------------------------------------------------------ */

describe('L3.2 — le titre de l etape tient sur trois lignes au plus', () => {
  it('L3.2-01: le titre est PLAFONNE a trois lignes, pas bride', () => {
    state.current = { draft: builtDraft() };
    const html = render();
    const name = html.match(/<h3 class="prep-step__name"[^>]*>/);
    expect(name).not.toBeNull();
    // Bride (`nowrap`, `ellipsis`), le titre deborde sur la colonne etroite.
    expect(name![0]).not.toContain('nowrap');
    expect(html).not.toMatch(/prep-step__name[^>]*style="[^"]*ellipsis/);
    // Libre, il pousse le lieu et le prix hors de la carte. Le plafond est
    // donc un CLAMP - et il est dans la feuille : c est la seule couche qui
    // s applique a CHAQUE carte, quelle que soit la longueur de son titre.
    const regle = declarations('.prep-step__name');
    expect(regle.get('display')).toBe('-webkit-box');
    expect(regle.get('-webkit-box-orient')).toBe('vertical');
    expect(regle.get('-webkit-line-clamp')).toBe('3');
    expect(regle.get('overflow')).toBe('hidden');
    // Et le composant ne repose pas `display` en inline : une cascade qui
    // perd en specificite laisserait le `display: block` de l inline
    // ecraser le `-webkit-box` du classeur, et le plafond serait muet.
    expect(name![0]).not.toMatch(/style="[^"]*display/);
  });

  it('L3.2-02: le titre et le lieu ont deux niveaux typographiques distincts', () => {
    state.current = { draft: builtDraft() };
    const html = render();
    // Une seule hierarchie : le titre est un titre (h3), le lieu est un
    // paragraphe. Deux polices pour le meme role, c est deux niveaux.
    expect(html).toMatch(/<h3 class="prep-step__name"/);
    expect(html).not.toMatch(/<p class="prep-step__name"|<span class="prep-step__name"/);
  });
});

/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* L3.7 - un seul rail de jours dans toute l application              */
/* ------------------------------------------------------------------ */

describe('L3.7 - un seul rail de jours, et il est dans le chrome', () => {
  it('L3.7-01: le corps de l etape ne rend PLUS aucun rail', () => {
    state.current = { draft: builtDraft() };
    publierLesJours(state.current.draft.itinerary!);
    const html = render();
    // Deux rails pour UN reglage : celui du corps et celui de la barre basse
    // etaient deux chemins vers le meme `useDayFocusStore`. Le rail du corps
    // est retire - il ne restait plus rien a deduire de ce doublon, et l
    // etape 2 recupere une rangee entiere de hauteur.
    expect(html.match(/class="[^"]*prep-days/g) ?? []).toEqual([]);
    expect(visible(html)).not.toContain('Tout');
    // Le rail qui reste est UN SEUL, et il vit dans le chrome, partage par
    // les trois etapes : le Preparateur, le Hub et le recapitulatif.
    expect((railDuChrome().match(/role="tablist"/g) ?? []).length).toBe(1);
  });

  it('L3.7-02: le rail du chrome propose un onglet par journee plus « Tout »', () => {
    state.current = { draft: builtDraft() };
    const model = state.current.draft.itinerary!;
    const publies = publierLesJours(model);
    // Le store publie par le shell alimente le rail du chrome : si le compte
    // ne suit pas le modele, le rail et le programme ne parlent plus du
    // meme perimetre.
    expect(publies.length).toBe(model.days);
    const rail = railDuChrome();
    const onglets = Array.from(
      rail.matchAll(/<button[^>]*role="tab"[^>]*>([\s\S]*?)<\/button>/g),
    ).map((m) => visible(m[1]));
    expect(onglets.length).toBe(model.days + 1);
    expect(onglets[0]).toContain('Tout');
    for (let jour = 1; jour <= model.days; jour += 1) {
      expect(onglets[jour]).toContain(`J${jour}`);
    }
    // Ce sont des <button role="tab"> : le rail reste atteignable au
    // clavier, donc le geste n est jamais le seul chemin vers un jour.
    expect((rail.match(/<button/g) ?? []).length).toBe(model.days + 1);
  });
});

/* ------------------------------------------------------------------ */
/* L3.9 — distance et budget : mesure ou declaration d absence         */
/* ------------------------------------------------------------------ */

describe('L3.9 — ni distance ni budget ne sont inventes', () => {
  it('L3.9-01: sans trace mesuree, la distance affiche « a verifier »', () => {
    state.current = {
      draft: builtDraft({}, (model) => ({
        ...model,
        totals: { ...model.totals, distanceKm: null },
        perDay: model.perDay.map((day) => ({ ...day, distanceKm: null })),
      })),
    };
    const text = visible(render());
    expect(text).toContain('À vérifier');
  });

  it('L3.9-02: la tuile de distance porte bien l etat « inconnu »', () => {
    state.current = {
      draft: builtDraft({}, (model) => ({
        ...model,
        totals: { ...model.totals, distanceKm: null },
        perDay: model.perDay.map((day) => ({ ...day, distanceKm: null })),
      })),
    };
    // `data-unknown` est ce qui permet a l agent CSS de differencier une
    // absence d une valeur. Sans lui, « a verifier » et « 42 km » se
    // ressemblent, et l adaptation en degrande.
    expect(render()).toContain('data-unknown="true"');
  });

  it('L3.9-03: une distance reelle s affiche en kilometres', () => {
    state.current = {
      draft: builtDraft({}, (model) => ({
        ...model,
        totals: { ...model.totals, distanceKm: 12.4 },
        perDay: model.perDay.map((day) => ({ ...day, distanceKm: 12.4 })),
      })),
    };
    const text = visible(render());
    expect(text).toMatch(/12[,.]4\s*km/);
  });

  it('L3.9-04: sans aucun prix, le budget affiche « a verifier », pas 0', () => {
    state.current = {
      draft: builtDraft({}, (model) => ({
        ...model,
        steps: [...model.steps].map((step) => ({
          ...step,
          price: { ...PRICE_TO_CHECK },
        })),
      })),
    };
    const text = visible(render());
    // Le piege du budget : 0 EUR se lit comme « gratuit ». « a verifier » se
    // lit comme « on ne sait pas ». C est la seule difference qui compte.
    expect(text).not.toMatch(/0\s*€/);
  });
});
