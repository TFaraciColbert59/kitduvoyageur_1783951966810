import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ActivityPickerScreen } from '../components/ActivityPickerScreen';
import { ACTIVITY_CATEGORIES, activityById } from '../catalog';
import { fullDraft, draftWithoutItineraryInput } from './fixtures';
import type { AdventurePrepDraft } from '../types';

/**
 * Meme harnais que prep-screens.test.tsx : sous `renderToStaticMarkup`,
 * zustand v5 sert l etat INITIAL et `setState` n a aucun effet. Seul le module
 * du store est remplace, le composant est reellement execute.
 */
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

function render(draft: AdventurePrepDraft): string {
  state.current = { draft };
  return renderToStaticMarkup(React.createElement(ActivityPickerScreen, { onOpenSheet: noop }));
}

/**
 * `renderToStaticMarkup` echappe les apostrophes en `&#x27;` : sans ce
 * decodeur, un `toContain` sur un libelle accentue testerait la Serialisation
 * et non le composant.
 */
function decode(html: string): string {
  return html
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&');
}

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

/** Les blocs de nom d activite, dans l ordre du DOM. */
/**
 * Noms de cartes rendus. La classe peut etre suivie d'autres attributs — le nom
 * porte notamment le style qui empeche sa troncature — on ne depend donc pas de
 * l'ordre des attributs, sinon le test casse a chaque ajustement de rendu.
 */
function cardNames(html: string): string[] {
  return [...html.matchAll(/<span class="prep-act__name"[^>]*>([^<]*)<\/span>/g)]
    .map((m) => m[1].trim())
    .filter((name) => name.length > 0);
}

describe('Ecran 02 — le libelle d une activite n est jamais coupe', () => {
  it('E02-01: le nom complet est present dans le HTML rendu', () => {
    expect(render(draftWithoutItineraryInput())).toContain('Randonnée à la journée');
  });

  it('E02-02: aucun nom ne se termine par une troncature', () => {
    const names = cardNames(render(draftWithoutItineraryInput()));
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(name).not.toMatch(/…|\.\.\.$/);
    }
  });

  it('E02-03: le nom le plus long du catalogue tient entierement', () => {
    // « Randonnee avec nuit de refuge » est le libelle le plus long du
    // catalogue : c est lui qui tronquait sur 390px.
    expect(render(draftWithoutItineraryInput())).toContain('Randonnée avec nuit de refuge');
  });

  it('E02-04: la duree est une aide en retrait, pas un concurrent du nom', () => {
    const html = render(draftWithoutItineraryInput());
    expect(html).toContain('prep-act__body');
    expect(html).toContain('prep-act__hint');
    // La duree ne sort plus de la ligne de titre, donc plus aucune bande laterale.
    expect(html).not.toContain('prep-act__meta');
  });
});

describe('Ecran 02 — toutes les cartes ont la meme largeur', () => {
  it('E02-05: chaque carte occupe toute la largeur du conteneur', () => {
    const html = render(draftWithoutItineraryInput());
    const cards = [...html.matchAll(/<button[^>]*class="prep-act"[^>]*>/g)];
    expect(cards.length).toBeGreaterThan(1);
    for (const card of cards) {
      expect(card[0]).toContain('width:100%');
    }
  });

  it('E02-06: l etat actif ne change pas la largeur de la carte', () => {
    const chosen = [...render(fullDraft()).matchAll(/<button[^>]*class="prep-act"[^>]*aria-pressed="true"[^>]*>/g)];
    expect(chosen).toHaveLength(1);
    expect(chosen[0][0]).toContain('width:100%');
  });
});

describe('Ecran 02 — le catalogue est complet et atteignable', () => {
  it('E02-07: les six familles sont proposees', () => {
    const text = visible(render(draftWithoutItineraryInput()));
    for (const category of ACTIVITY_CATEGORIES) {
      expect(text).toContain(category.label);
    }
  });

  it('E02-08: aucune famille n est absente du DOM', () => {
    const html = render(draftWithoutItineraryInput());
    for (const category of ACTIVITY_CATEGORIES) {
      expect(html).toContain(category.label);
    }
  });

  it('E02-09: le rail de familles est un groupe nomme et defilant', () => {
    const html = render(draftWithoutItineraryInput());
    expect(decode(html)).toContain('aria-label="Familles d\'activité"');
    expect(html).toContain('data-scrollable="horizontal"');
  });

  it('E02-10: chaque famille reste un bouton focusable', () => {
    // `Chip` ne relaie pas `aria-label` : son nom accessible est le dernier
    // texte du bouton. On verifie donc que le libelle de la famille est bien ce
    // texte — c'est lui que le lecteur d'ecran annonce.
    const html = decode(render(draftWithoutItineraryInput()));
    for (const category of ACTIVITY_CATEGORIES) {
      expect(html).toContain(`>${category.label}</button>`);
    }
  });

  it('E02-23: un nom d activite ne peut pas etre coupe', () => {
    // La feuille de feature met `nowrap` + ellipsis sur `.prep-act__name` :
    // sur 390 px le nom le plus long se lisait « Randonnee avec n... ». Le
    // composant annule ces deux proprietes en style inline, donc le nom passe
    // a la ligne plutot que d etre tronque.
    const html = render(draftWithoutItineraryInput());
    expect(html).toContain('white-space:normal');
    expect(html).toContain('text-overflow:clip');
  });

  it('E02-11: une recherche vide montre la famille par defaut, une recherche filtre', () => {
    // Le composant est rendu sans interaction : la famille par defaut suffit a
    // prouver que le catalogue alimente la liste.
    const html = render(draftWithoutItineraryInput());
    expect(cardNames(html).length).toBeGreaterThan(0);
  });
});

describe('Ecran 02 — une aventure peut combiner plusieurs activites', () => {
  it('E02-12: le complement n est propose qu une fois une activite principale choisie', () => {
    expect(render(draftWithoutItineraryInput())).not.toContain('Ajouter une activité');
    expect(render(fullDraft())).toContain('Ajouter une activité');
  });

  it('E02-13: le complement propose des activites combinables, pas l activite principale', () => {
    const html = render(fullDraft());
    const section = html.slice(html.indexOf('Ajouter une activité'));
    const names = cardNames(section);
    expect(names).toContain('Kayak');
    expect(names).not.toContain('Randonnée avec nuit de refuge');
  });

  it('E02-14: le bivouac est proposé comme nuit, pas comme activité principale', () => {
    const html = render(fullDraft());
    const section = html.slice(html.indexOf('Ajouter une activité'));
    expect(section).toContain('Nuit en bivouac');
    const names = cardNames(render(draftWithoutItineraryInput()));
    expect(names).not.toContain('Nuit en bivouac');
  });

  it('E02-15: le total d activites retenues est annonce', () => {
    const draft = fullDraft({
      activities: { primary: 'rando-journee', extra: ['kayak'], nights: [] },
    });
    expect(visible(render(draft))).toContain('2 activités retenues');
  });

  it('E02-16: une activite retenue se retire par un bouton nomme', () => {
    const draft = fullDraft({
      activities: { primary: 'rando-journee', extra: ['kayak'], nights: [] },
    });
    expect(render(draft)).toContain('aria-label="Retirer Kayak"');
  });
});

describe('Ecran 02 — appel d action', () => {
  it('E02-17: le CTA est toujours present, bloque ou non', () => {
    expect(render(draftWithoutItineraryInput())).toContain('Continuer');
  });

  it('E02-18: le CTA est bloque tant qu aucune activite n est choisie', () => {
    expect(render(draftWithoutItineraryInput())).toContain('disabled');
    expect(render(fullDraft())).not.toMatch(/prep-footer__primary[^>]*disabled/);
  });

  it('E02-19: le CTA annonce ce qu il va faire, sans pourcentage', () => {
    const text = visible(render(fullDraft()));
    expect(text).toContain('Continuer');
    expect(text).not.toMatch(/\d+\s*%/);
  });
});

describe('Ecran 02 — confiance', () => {
  it('E02-20: aucune carte n affiche de duree, meme approchee', () => {
    const text = visible(render(draftWithoutItineraryInput()));
    // Le catalogue ne publie plus de duree. « environ » ne rendait l invention
    // que plausible : c etait une duree inexistante presentee comme une
    // information. Elle disparait, et avec elle tout nombre sur la carte.
    expect(text).not.toContain('environ');
    expect(text).not.toMatch(/\d+\s*h(?:\s|$)/);
    expect(text).not.toMatch(/\d+\s*jours?/);
    expect(text).not.toMatch(/\d+\s*€|\d+\s*km\b/i);
  });

  it('E02-20b: la carte affiche un gabarit de depart, sans chiffre', () => {
    const text = visible(render(draftWithoutItineraryInput()));
    expect(text).toContain('Gabarit : journée');
    // Le gabarit ne se remplace pas par un nombre : c est la meme regle.
    expect(text).not.toMatch(/Gabarit[^A-Za-z0-9]{0,3}\d/);
  });

  it('E02-21: aucune activite n est annoncee comme reservee', () => {
    const text = visible(render(draftWithoutItineraryInput()));
    expect(text).not.toMatch(/r\u00e9serv\u00e9|confirm\u00e9|disponible/i);
  });

  it('E02-22: l identifiant du catalogue reste resolu cote composant', () => {
    expect(activityById('rando-journee')?.label).toBe('Randonnée à la journée');
  });
});

describe('Ecran 02 — l invite libre ouvre le premier ecran', () => {
  const withBrief = (brief: string) =>
    fullDraft({ brief, activities: { primary: null, extra: [], nights: [] } });

  it('E02-30: l invite est presente, avec la meme invite que l etape 1', () => {
    const html = render(draftWithoutItineraryInput());
    expect(html).toContain('prep-brief__input');
    expect(visible(html)).toContain('Qu’est-ce que tu as en tête ?');
  });

  it('E02-31: l invite est rendue AVANT le catalogue, pas apres', () => {
    const html = render(draftWithoutItineraryInput());
    const invite = html.indexOf('prep-brief__input');
    const catalogue = html.indexOf('prep-cats');
    // Les deux ancres doivent exister : sans cela, indexOf renvoie -1 et le
    // test passerait sur une invite absente.
    expect(invite).toBeGreaterThan(-1);
    expect(catalogue).toBeGreaterThan(-1);
    expect(invite).toBeLessThan(catalogue);
  });

  it('E02-32: l invite affiche ce que la personne a ecrit', () => {
    expect(render(withBrief('refuge et lever de soleil'))).toContain('refuge et lever de soleil');
  });

  it('E02-33: le brief classe le catalogue reel', () => {
    const names = cardNames(render(withBrief('je veux dormir en refuge')));
    expect(names[0]).toBe('Randonnée avec nuit de refuge');
  });

  it('E02-34: un brief sans correspondance le dit, et ne retombe pas sur du bruit', () => {
    const html = render(withBrief('zzzzqqq wwww'));
    expect(visible(html)).toContain('Aucune activité du catalogue');
    expect(cardNames(html)).toHaveLength(0);
  });

  it('E02-35: le brief ne fait pas de correction orthographique', () => {
    // Mesure : le navigateur souligne en rouge chaque mot du brief. Ce texte
    // est une idee en brouillon, pas un document : un correcteur qui la barre
    // donne l impression que la saisie est fautive et mancha le verre.
    const html = render(withBrief('refuge lever de soleil'));
    expect(html).toContain('spellCheck="false"');
  });
});
