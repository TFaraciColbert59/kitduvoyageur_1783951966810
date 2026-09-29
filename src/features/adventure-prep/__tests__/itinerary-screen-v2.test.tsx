/**
 * Etape 2 — ce que l'utilisateur voit reellement une fois le parcours construit.
 *
 * Ces tests portent sur le MARQUAGE rendu, pas sur l intention : une
 * etape presente dans le DOM mais masquee par `display:none` est une etape que
 * l'utilisateur ne voit pas. C est exactement le defaut que ces tests
 * empechent de revenir.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Le fichier de test vit dans `<feature>/__tests__/` : deux remontees
 * suffisent a retrouver la racine du feature, sans chemin fige en dur.
 */
function racineFeature(): string {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ItineraryStepScreen } from '../components/ItineraryStep';
import { buildItinerary } from '../engine/itinerary';
import { fullDraft } from './fixtures';
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

const noop = () => undefined;

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

function builtDraft(
  over: Partial<AdventurePrepDraft> = {},
  mutate: (model: ItineraryModel) => ItineraryModel = (model) => model,
): AdventurePrepDraft {
  const draft = fullDraft(over);
  const model = buildItinerary(draft);
  if (!model) throw new Error('fixture : le brouillon de base doit etre construisible');
  return { ...draft, itinerary: mutate(model) };
}

const RAVENI: DayWeather = {
  date: '2026-07-11',
  tMaxC: 24,
  tMinC: 11,
  precipMm: 0,
  precipProbPct: 20,
  windMaxKmh: 14,
  code: 2,
  label: 'Partiellement nuageux',
};

describe('IT2 — Le programme du jour est reellement visible', () => {
  it('IT2-01: aucune etape du programme n est masquee', () => {
    state.current = { draft: builtDraft() };
    const html = renderToStaticMarkup(React.createElement(ItineraryStepScreen, { onOpenSheet: noop }));
    // Une etape rendue puis masquee par un style n est pas une etape vue :
    // c est le piege exact que ce test ferme.
    expect(html).not.toContain('display:none');
  });

  it('IT2-02: les etapes du jour sont listees avec leur titre', () => {
    state.current = { draft: builtDraft() };
    const model = buildItinerary(state.current.draft)!;
    const text = visible(renderToStaticMarkup(React.createElement(ItineraryStepScreen, { onOpenSheet: noop })));
    const first = model.steps[0];
    expect(first).toBeDefined();
    expect(text).toContain(first.title);
  });

  it('IT2-03: le titre de chaque etape du jour passe, pas seulement le premier', () => {
    state.current = { draft: builtDraft() };
    const model = buildItinerary(state.current.draft)!;
    const text = visible(renderToStaticMarkup(React.createElement(ItineraryStepScreen, { onOpenSheet: noop })));
    for (const step of model.steps.filter((s) => s.day === 1)) {
      expect(text).toContain(step.title);
    }
  });
});

describe('IT2 — La meteo du jour, quand elle existe', () => {
  it('IT2-10: la meteo mesuree du premier jour est affichee', () => {
    state.current = {
      draft: builtDraft({}, (model) => ({ ...model, weather: [RAVENI, null, null] })),
    };
    const text = visible(renderToStaticMarkup(React.createElement(ItineraryStepScreen, { onOpenSheet: noop })));
    expect(text).toContain(RAVENI.label);
  });

  it('IT2-11: chaque jour affiche SAIN meteo, jamais celle d un autre', () => {
    state.current = {
      draft: builtDraft({}, (model) => ({ ...model, weather: [null, RAVENI, null] })),
    };
    const text = visible(renderToStaticMarkup(React.createElement(ItineraryStepScreen, { onOpenSheet: noop })));
    // Vue Ensemble : le programme montre tous les jours, donc Jour 2 affiche sa
    // meteo reelle. Ce qui est interdit, c est que Jour 1 emprunte celle du Jour 2.
    expect(text).toContain('Jour 1 Météo indisponible');
    expect(text).toContain(`Jour 2 ${RAVENI.label}`);
  });

  it('IT2-12: sans meteo, l ecran le dit au lieu de laisser un vide', () => {
    state.current = { draft: builtDraft() };
    const text = visible(renderToStaticMarkup(React.createElement(ItineraryStepScreen, { onOpenSheet: noop })));
    expect(text).toContain('Météo indisponible');
  });

  it('IT2-13: une meteo sans temperature n affiche pas de degree', () => {
    state.current = {
      draft: builtDraft(
        {},
        (model) => ({
          ...model,
          weather: [{ ...RAVENI, tMaxC: null, tMinC: null, precipProbPct: null }, null, null],
        }),
      ),
    };
    const text = visible(renderToStaticMarkup(React.createElement(ItineraryStepScreen, { onOpenSheet: noop })));
    expect(text).toContain(RAVENI.label);
    expect(text).not.toMatch(/\d+\s*°/);
  });
});

/**
 * Perimetre de ces tests : le rendu STATIQUE uniquement. Or
 * `renderToStaticMarkup` lit le snapshot initial des stores : impossible
 * d y reproduire une selection de jour, qui vit dans `dayFocusStore`. La vue
 * « Jour N » est donc verifiee cote moteur (`day-navigation.test.ts`, meme
 * chemin de decision `resolveActiveDay` + `measureScope` + `metricsFor`) et
 * dans le navigateur. Ces tests verrouillent ce qu ils peuvent voir, sans
 * pretendre couvrir ce qu ils ne voient pas.
 */
describe('IT2 — Les mesures affichees ne sont pas des chassis', () => {
  it('IT2-20: en vue Ensemble, la distance affichee est celle du parcours complet', () => {
    state.current = {
      draft: builtDraft({}, (model) => ({
        ...model,
        totals: { ...model.totals, distanceKm: 42.7 },
      })),
    };
    const text = visible(renderToStaticMarkup(React.createElement(ItineraryStepScreen, { onOpenSheet: noop })));
    expect(text).toContain('42,7');
  });

  it('IT2-21: une distance non mesuree affiche « à vérifier », jamais 0 km', () => {
    state.current = {
      draft: builtDraft({}, (model) => ({
        ...model,
        perDay: model.perDay.map((totals, index) =>
          index === 0 ? { ...totals, distanceKm: null } : totals,
        ),
      })),
    };
    const text = visible(renderToStaticMarkup(React.createElement(ItineraryStepScreen, { onOpenSheet: noop })));
    expect(text).not.toMatch(/0\s*km/);
    expect(text).toContain('À vérifier');
  });

  it('IT2-22: la carte annonce la pose d un point de passage', () => {
    state.current = { draft: builtDraft() };
    const html = renderToStaticMarkup(React.createElement(ItineraryStepScreen, { onOpenSheet: noop }));
    expect(html).toContain('point de passage');
  });
});

/* ================================================================== */
/* E8 / M4.3 - la carte d etape ne montre QUE ce qu elle a reellement.  */
/*                                                                    */
/* Le design est sans appel : « image reelle, ou RIEN du tout ». Un    */
/* placeholder n est pas une image absente, c est une image qui       */
/*mente - et une icone vert pale dans une pastille de 44 px est      */
/* l element le plus lumineux d une carte qui, elle, ne veut rien     */
/* dire.                                                               */
/*                                                                    */
/* Ce test ne verifie donc pas UNE vignette, il verifie l absence de   */
/* toute vignette : la seule maniere honnete de rendre une image       */
/* qu on n a pas, c est de ne pas la rendre.                          */
/* ================================================================== */

describe("E8 / M4.3 - la carte d etape n invente aucune image", () => {
  const composant = readFileSync(
    join(racineFeature(), "components", "ItineraryStep.tsx"),
    "utf-8",
  );

  it("E8-01 : le type d etape porte le champ image, et lui SEUL", () => {
    // CE TEST A CHANGE DE CAMP. Il affirmait l absence de tout champ image, et
    // son propre message annoncait le basculement : « ItineraryStep porte
    // desormais un champ image : la source REELLE doit etre branchee ».
    // Elle l est. Wikimedia Commons rend une URL HTTPS, un auteur et une
    // licence par fichier, et `engine/stepImages` refuse tout ce qui en
    // manque. Le champ existe donc, et il se nomme `image`.
    //
    // Ce qui n a PAS change, et que ce test continue de surveiller : le champ
    // est le SEUL, et il n a pas de valeur par defaut. Un `cover` ou un
    // `banner` qui reapparaitrait ici serait un second point d entree, donc
    // une seconde source, donc une seconde question de licence — ouverte
    // celle-la.
    const types = readFileSync(join(racineFeature(), "types.ts"), "utf-8");
    const bloc = types.slice(types.indexOf("export interface ItineraryStep"));
    const champs = bloc.slice(0, bloc.indexOf("\n}")).match(/^\s{2}(\w+)\??:/gm) ?? [];

    expect(
      champs.filter((c) => /image|photo|thumb|cover|banner|media|picture/i.test(c)),
      "ItineraryStep ne doit porter QU UN champ image, nomme image : "
        + "un deuxieme champ serait une deuxieme source, donc une deuxieme "
        + "question de licence",
    ).toEqual(["  image?:"]);

    // `null` par defaut, jamais une image vide : une carte sans photo doit
    // se distinguer d une carte dont la photo n a pas encore arrive.
    expect(types).toMatch(/image\?:\s*StepImage\s*\|\s*null/);
  });

  it("E8-02 : AUCUNE carte d etape ne rend <img> ni vignette", () => {
    // Une <img> sans src serait pire qu un placeholder : un cadre vide qui
    // promet une photo disparue. Aucune image, aucun cadre, aucune vignette.
    //
    // Les DEUX cartes sont couvertes, pas seulement la carte focalisee. La
    // vignette verte passee a l incart livedra dans le TIROIR « Etapes »
    // (PrepItinerarySheets, StepHead), pas dans ItineraryStep : ne lire que
    // ce dernier laissait la surface reellement incitee sans aucune garde. Un
    // placeholder pouvait donc revenir dans le tiroir, en vert pale, sans
    // qu un seul test rougisse.
    const tiroir = readFileSync(
      join(racineFeature(), "components", "PrepItinerarySheets.tsx"),
      "utf-8",
    );
    for (const [nom, source] of [["carte focalisee", composant], ["tiroir Etapes", tiroir]] as const) {
      expect(source.match(/<img/g) ?? [], `${nom} : la carte rend une image`).toEqual([]);
      expect(
        source.match(/prep-step__thumb/g) ?? [],
        `${nom} : la carte rend une vignette — elle tient la place d une photo qu elle n a pas`,
      ).toEqual([]);
    }
  });

  /**
   * E8-03 : le MARQUEUR RENDU ne porte aucune image, sous AUCUNE forme.
   *
   * E8-01/02 lisent le SOURCE : ils attestent une intention, pas un rendu.
   * Or ce codebase ne rend pas une icone en `<svg>` : `Icon` produit un
   * `<span role="img">` porte par un masque CSS. Un placeholder peut donc
   * se loger precisement la ou un grep d'<img>' ne voit rien - et c est
   * exactement la forme de la pastille du tiroir Etapes.
   *
   * La zone ou une vignette se placerait est la TETE de carte (nom, lieu,
   * moment, prix) : les boutons d action, eux, ont le droit de porter des
   * icones. On juge donc le DOM rendu, sur cette zone-la.
   */
  it("E8-03 : le marqueur RENDU ne porte aucune image, sous aucune forme", () => {
    state.current = { draft: builtDraft() };
    const html = renderToStaticMarkup(React.createElement(ItineraryStepScreen, { onOpenSheet: noop }));

    // Si la structure de la carte change, ce test doit le DIRE plutot que de
    // passer au vert sur une extraction vide : une zone non mesuree n est pas
    // une zone conforme.
    const tetes = [...html.matchAll(/<div class="prep-step__head">([\s\S]*?)<div class="prep-step__actions">/g)]
      .map((m) => m[1]);
    expect(
      tetes.length,
      "aucune tete de carte mesuree : la structure a change, E8-03 doit etre reevalue",
    ).toBeGreaterThan(0);

    for (const tete of tetes) {
      expect(tete.match(/<img/g) ?? [], "la carte rend une <img>").toEqual([]);
      expect(tete.match(/data:image/g) ?? [], "la carte rend une image fabriquee en data:").toEqual([]);
      expect(
        tete.match(/mask-image|background-image/g) ?? [],
        "la carte rend une image en masque CSS : c est la forme exacte de l icone-placeholder",
      ).toEqual([]);
      expect(
        tete.match(/role="img"/g) ?? [],
        "la carte rend un role=img : une icone y tient la place d une photo",
      ).toEqual([]);

      const classes = [...tete.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/));
      expect(
        classes.filter((c) => /thumb|photo|picture|vignette|illustration|placeholder|avatar|banner/i.test(c)),
        "la carte porte une classe de vignette",
      ).toEqual([]);
    }
  });

  /**
   * E8-04 : un cadre VIDE est pire qu une absence.
   *
   * Une image manquante s excuse ; un rectangle vide reserves a une photo
   * promet une image qui n arrive jamais, et occupe la place sans rien
   * dire. Le cas est distinct de E8-03 : E8-03 interdit l image, E8-04
   * interdit son emplacement.
   */
  it("E8-04 : la carte ne reserve aucun cadre vide pour une image absente", () => {
    state.current = { draft: builtDraft() };
    const html = renderToStaticMarkup(React.createElement(ItineraryStepScreen, { onOpenSheet: noop }));

    const tetes = [...html.matchAll(/<div class="prep-step__head">([\s\S]*?)<div class="prep-step__actions">/g)]
      .map((m) => m[1]);
    expect(tetes.length, "aucune tete de carte mesuree").toBeGreaterThan(0);

    for (const tete of tetes) {
      const cadres = tete.match(/<div[^>]*>\s*<\/div>/g) ?? [];
      expect(
        cadres.map((c) => c.replace(/\s+/g, ' ')),
        "la carte reserve un cadre vide la ou une photo devrait etre : "
          + "un rectangle sans image promet une image qui n arrive pas",
      ).toEqual([]);
    }
  });
});
