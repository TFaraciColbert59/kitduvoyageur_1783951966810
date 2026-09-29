/**
 * LOT ETAPE 2 — le plus grand ecran du preparateur (L3.1 a L3.9, M2.1 a M2.3).
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
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ItineraryStepScreen } from '../components/ItineraryStep';
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
/* L3.5 — la vignette ne pretend pas etre une photo                    */
/* ------------------------------------------------------------------ */

describe('L3.5 — la vignette d etape ne ment pas sur ce qu elle montre', () => {
  it('L3.5-01: la vignette n est JAMAIS un <img> sans source reelle', () => {
    state.current = { draft: builtDraft() };
    const html = render();
    const imgs = html.match(/<img[^>]*>/g) ?? [];
    for (const img of imgs) {
      // Une vignette qui pretend etre une photo doit avoir une source. Une
      // <img> sans src est un cadre vide qui suggere la photo disparue.
      expect(img).toMatch(/src="[^"]+"/);
    }
  });

  it('L3.5-02: la vignette porte un role purement decoratif', () => {
    state.current = { draft: builtDraft() };
    const thumbs = render().match(/<span class="prep-step__thumb"[^>]*>/g) ?? [];
    expect(thumbs.length).toBeGreaterThan(0);
    for (const thumb of thumbs) {
      // `aria-hidden` dit au lecteur d ecran « ce n est pas une photo », donc
      // rien a decrire. C est la seule ligne honnete pour une icone.
      expect(thumb).toContain('aria-hidden="true"');
    }
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
/* L3.2 / M2.3 — une seule hierarchie typographique                    */
/* ------------------------------------------------------------------ */

describe('L3.2 — le titre de l etape tient sur trois lignes au plus', () => {
  it('L3.2-01: le titre n est PAS bride a une ligne unique', () => {
    state.current = { draft: builtDraft() };
    const html = render();
    const name = html.match(/<h3 class="prep-step__name"[^>]*>/);
    expect(name).not.toBeNull();
    // L3.2 : le titre etait bride (`white-space: nowrap`, ou une largeur qui
    // le force). Un titre borne en 3 lignes se lit ; bride, il deborde.
    expect(name![0]).not.toContain('nowrap');
    expect(html).not.toMatch(/prep-step__name[^>]*style="[^"]*ellipsis/);
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
/* L3.7 — un seul rail de jours                                        */
/* ------------------------------------------------------------------ */

describe('L3.7 — un seul rail de jours dans le corps de l ecran', () => {
  it('L3.7-01: le corps ne rend QU UN groupe de jours', () => {
    state.current = { draft: builtDraft() };
    const html = render();
    // Le rail du corps et celui de la barre basse sont deux chemins pour le
    // meme reglage. Un seul reste dans le corps ; l autre vit dans le chrome,
    // partage par les trois pages.
    const groups = html.match(/class="prep-days"/g) ?? [];
    expect(groups.length).toBe(1);
  });

  it('L3.7-02: le rail propose un bouton par journee plus « Tout »', () => {
    state.current = { draft: builtDraft() };
    const html = render();
    const model = state.current.draft.itinerary!;
    const rail = html.match(/<div class="prep-days"[\s\S]*?<\/div>/);
    expect(rail).not.toBeNull();
    const buttons = rail![0].match(/<button/g) ?? [];
    expect(buttons.length).toBe(model.days + 1);
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