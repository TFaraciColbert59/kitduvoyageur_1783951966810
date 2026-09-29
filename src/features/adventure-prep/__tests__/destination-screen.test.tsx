import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DestinationStep } from '../components/DestinationStep';
import { fullDraft, draftWithoutItineraryInput, CHAMONIX, ARGENTIERE } from './fixtures';
import type { AdventurePrepDraft } from '../types';

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
  return renderToStaticMarkup(React.createElement(DestinationStep, { onOpenSheet: noop }));
}

function visible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x2F;/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}
describe('Écran 10 — le bandeau titre a ete retire', () => {
  // Le bloc « On part où ? » + promesse + pastilles d'activite et de
  // preferences a ete supprime de l'ecran : il se superposait au contenu et
  // prenait la place des decisions reelles. Ces tests verrouillent son
  // absence, pour qu'un retour involontaire soit visible.
  it('D10-01: le titre ne rend plus aucun texte', () => {
    const text = visible(render(fullDraft()));
    expect(text).not.toContain('On part où');
  });

  it('D10-02: la promesse n est plus annoncee', () => {
    expect(visible(render(fullDraft()))).not.toContain('Trois réponses suffisent');
  });
});

describe('Écran 10 — les trois blocs', () => {
  it('D10-03: parcours, date et participants sont les trois decisions', () => {
    const text = visible(render(fullDraft()));
    expect(text).toContain('Départ');
    expect(text).toContain('Arrivée');
    expect(text).toContain('Date');
    expect(text).toContain('Durée estimée');
    expect(text).toContain('Participants');
  });

  it('D10-04: la date et le temps sont deux cellules distinctes', () => {
    const html = render(fullDraft());
    expect(html).toContain('prep-cell');
    // Deux cellules séparées : le titre de la cellule durée existe seul.
    expect(visible(html)).toContain('Durée estimée');
  });

  it('D10-05: le lieu affiche sa commune puis son détail', () => {
    const draft = fullDraft({
      route: {
        origin: {
          id: 't',
          name: 'Trélon, Place Jean Jaurès',
          country: 'France',
          lat: 50.2,
          lon: 3.8,
        },
        destination: ARGENTIERE,
        shape: 'aller_simple',
      },
    });
    const text = visible(render(draft));
    expect(text).toContain('Trélon');
    expect(text).toContain('Place Jean Jaurès');
  });
});

describe('Écran 10 — la forme se déduit, elle ne se choisit pas', () => {
  it('D10-06: aucune bascule boucle / aller simple n’est proposée', () => {
    const text = visible(render(fullDraft()));
    expect(text).not.toContain('Boucle');
    expect(text).not.toContain('Aller simple');
    expect(render(fullDraft())).not.toContain('aria-pressed="true"');
  });

  it('D10-06b: l’invite libre de l’IA ouvre l’écran, en haut', () => {
    const html = render(fullDraft());
    expect(html).toContain('prep-brief__input');
    expect(html.indexOf('prep-brief__input')).toBeLessThan(html.indexOf('prep-block__row'));
  });

  it('D10-08: le bouton d’inversion reste atteignable en aller simple', () => {
    expect(render(fullDraft())).toContain('Inverser départ et arrivée');
  });

  it('D10-09: sans arrivée, l’arrivée reste offerte et modifiable', () => {
    const draft = fullDraft({ route: { origin: CHAMONIX, destination: null, shape: 'boucle' } });
    const text = visible(render(draft));
    // Aucune inversion possible, mais l’utilisateur peut toujours designer
    // une arrivee : c est lui qui tranche, pas une bascule imposee.
    expect(text).not.toContain('Inverser départ et arrivée');
    expect(text).toContain('Arrivée');
    expect(text).toContain('À vérifier');
  });

  it('D10-09b: la carte de zone ne fait plus partie de l’étape 1', () => {
    expect(render(fullDraft())).not.toContain('scopeLabel="Zone"');
  });
});

describe('Écran 10 — participants', () => {
  it('D10-10: les initiales connues sont affichées', () => {
    const draft = fullDraft({
      group: {
        mode: 'groupe',
        adults: 4,
        children: 0,
        hasPets: false,
        knownMembers: ['Camille', 'Léo', 'Inès', 'Karim'],
      },
    });
    const html = render(draft);
    expect(html).toContain('C');
    expect(html).toContain('L');
    expect(html).toContain('I');
    expect(html).toContain('K');
  });

  it('D10-11: un effectif inconnu affiche « +N », jamais un prénom inventé', () => {
    const draft = fullDraft({
      group: { mode: 'groupe', adults: 3, children: 0, hasPets: false, knownMembers: [] },
    });
    expect(visible(render(draft))).toContain('+3');
  });

  it('D10-12: l’effectif total est annoncé en toutes lettres', () => {
    const draft = fullDraft({
      group: { mode: 'groupe', adults: 4, children: 0, hasPets: false, knownMembers: [] },
    });
    expect(visible(render(draft))).toContain('4 adultes');
  });
});

/**
 * Le chevauchement du libelle et de la valeur est un bug de GEOMETRIE, pas de
 * donnee : il se produit quand la valeur est longue (« 3 personnes · 1
 * adulte ») et que le libelle garde sa largeur intrinsique. Aucun navigateur
 * ne peut etre observe ici — `renderToStaticMarkup` ne fait pas de mise en
 * page — on verifie donc que la regle anti-chevauchement est portee par le
 * TSX lui-meme, sous forme de style inline, et qu elle tient quelle que soit
 * la longueur du libelle.
 */
describe('Écran 10 — libellé et valeur ne se chevauchent jamais', () => {
  function labelStyle(html: string): string {
    const tag = html.match(/<span class="prep-block__label"([^>]*)>/);
    return tag?.[1] ?? '';
  }

  function stackStyle(html: string): string {
    const tag = html.match(/<span class="prep-block__stack"([^>]*)>/);
    return tag?.[1] ?? '';
  }

  it('D10-30: le libellé se tronque, il ne déborde jamais sur la valeur', () => {
    const style = labelStyle(render(fullDraft()));
    expect(style).toContain('min-width:0');
    expect(style).toContain('white-space:nowrap');
    expect(style).toContain('overflow:hidden');
    expect(style).toContain('text-overflow:ellipsis');
  });

  it('D10-31: le libellé peut céder la place, la valeur garde la sienne', () => {
    const label = labelStyle(render(fullDraft()));
    const stack = stackStyle(render(fullDraft()));
    // Le libellé est le seul element autorise a reduire. La valeur est portee
    // par la pile, ecartee de la reduction : c elle qui porte la largeur du
    // « 3 personnes · 1 adulte ».
    expect(label).toMatch(/flex:0 1 auto/);
    expect(stack).toMatch(/flex:0 0 auto/);
  });

  it('D10-32: un libellé très long ne peut pas non plus pousser la valeur', () => {
    // Ecran 12 : « Destination ou hébergement de base » est le libellé le plus
    // long du produit. C est lui qui chevauchait la valeur « À vérifier ».
    const draft = fullDraft({
      activities: { primary: 'city-break', extra: [], nights: [] },
      route: { origin: null, destination: ARGENTIERE, shape: 'boucle' },
    });
    const html = render(draft);
    expect(visible(html)).toContain('Destination ou hébergement de base');
    expect(labelStyle(html)).toContain('min-width:0');
  });

  it('D10-33: les avatars ne rognent pas la place de la valeur', () => {
    // Le groupe d avatars est un enfant de plus dans la meme ligne flex : sans
    // `flex: 0 0 auto` il recupere la largeur que la valeur laisse.
    const draft = fullDraft({
      group: {
        mode: 'groupe',
        adults: 3,
        children: 1,
        hasPets: false,
        knownMembers: ['Camille', 'Léo'],
      },
    });
    const html = render(draft);
    const avatars = html.match(/<span class="prep-avatars"([^>]*)>/);
    expect(avatars?.[1] ?? '').toContain('flex:0 0 auto');
  });
});

describe('Écran 10 — ce qu’il reste à saisir', () => {
  it('D10-13: la ligne de manque est absente quand tout est rempli', () => {
    expect(visible(render(fullDraft()))).not.toContain('Il manque');
  });

  it('D10-14: elle nomme exactement ce qui BLOQUE, et rien d autre', () => {
    // AN7 avait corrige cette assertion en gardant « temps disponible » dans
    // les bloqueurs. D1 le retire a son tour : sans date ET sans duree, et avec
    // le depart propose par la geolocalisation, il ne reste aucun obstacle.
    const base = fullDraft();
    const sansDateNiDuree = fullDraft({
      calendar: {
        startDate: null,
        durationDays: null,
        durationIsSuggested: false,
        startDateIsSuggested: false,
        returnDate: null,
      },
    });
    const complet = visible(render(sansDateNiDuree));
    expect(complet).not.toContain('Il manque');
    expect(complet).toContain('L’IA complètera : date, temps disponible');

    // Le seul bloqueur restant, lui, se nomme — et n’annonce aucun complement.
    const sansDepart = fullDraft({ route: { ...base.route, origin: null } });
    const bloque = visible(render(sansDepart));
    expect(bloque).toContain('Il manque : lieu de départ');
    expect(bloque).not.toContain('L’IA complètera');
  });

  it('D10-15: le bouton reste bloqué tant qu’un champ bloquant manque', () => {
    // « disabled » vit aussi dans les classes Tailwind du bouton
    // (disabled:pointer-events-none) : chercher le mot dans tout le markup
    // revient donc a prouver une classe, pas un bouton mort. Meme correctif
    // que E02-18 — on retire les classes, on ne lit plus que l ATTRIBUT.
    const bloque = (markup: string) => markup.replace(/class="[^"]*"/g, '').includes('disabled');

    const base = fullDraft();
    const sansDepart = draftWithoutItineraryInput({ route: { ...base.route, origin: null } });
    expect(bloque(render(sansDepart))).toBe(true);
    // L inverse, sur le meme ecran : des que le depart est la, plus rien ne
    // bloque. Sans cette contre-mesure, le test passerait avec un gate mort.
    // « Partir librement » fournit l intention que le catalogue n a pas fournie.
    expect(bloque(render(draftWithoutItineraryInput({ pickerDismissed: true })))).toBe(false);
    // Sans intention — ni activite choisie, ni « Partir librement » — le
    // catalogue est encore ouvert et le parcours n a pas de sujet. D2-04
    // verifie que ce cas-la reste bloque sur les quatre profils.
    expect(bloque(render(draftWithoutItineraryInput()))).toBe(true);
  });
});

describe('Écran 10 — accès aux réglages', () => {
  // La pastille de preferences a disparu avec le bandeau titre. Le seul point
  // d'entree est desormais le bouton du bandeau d'etapes (PrepNav), present
  // sur les trois etapes — c'est ce que D10-16 verifie.
  it('D10-16: la pastille de preferences ne rend plus dans le corps', () => {
    const html = render(fullDraft());
    expect(html).not.toContain('prep-pill--action');
  });

  it('D10-17: le resume des preferences ne se lit plus dans le corps', () => {
    const text = visible(
      render(
        fullDraft({
          preferences: {
            budgetPerPerson: 90,
            budgetLevel: 'modere',
            pace: 'tranquille',
            transport: 'train',
            interests: ['paysage'],
            accessibilityNeeds: [],
          },
        })
      )
    );
    expect(text).not.toContain('Tranquille · Modéré · Train');
  });
});

describe('Écran 10 — carte et appel', () => {
  it('D10-18: la carte a quitte l’etape 1, elle vit dans le tiroir Lieu', () => {
    const html = render(fullDraft());
    expect(html).not.toContain('Zone');
    expect(html).not.toContain('prep-map');
  });

  it('D10-19: l’appel d’action crée le parcours', () => {
    const text = visible(render(fullDraft()));
    expect(text).toContain('Créer mon parcours');
  });

  it('D10-20: une duree suggeree affiche son nombre ET sa provenance', () => {
    // AN6 : cette assertion encodait l autre moitie du defaut. Cacher le
    // nombre derriere la formulation d absence faisait de la cellule une
    // donnee absente, alors qu une proposition REELLE du moteur attendait
    // d etre validee : cul de sac visuel, pas honnetete. Le nombre revient,
    // la pastille dit qui l a propose.
    const html = render(
      fullDraft({
        calendar: {
          startDate: '2026-07-11',
          durationDays: 3,
          durationIsSuggested: true,
          startDateIsSuggested: false,
          returnDate: null,
        },
      })
    );
    expect(html).toContain('3 jours');
    expect(html).toContain('data-suggested="true"');
    // La provenance reste lisible dans le rendu, pas seulement dans le code.
    expect(html).toContain('Durée proposée · modifiable');
  });

  it('D10-20b: une duree reellement choisie reste affichee', () => {
    // Le garde-fou ne doit pas casser le cas reel : une duree saisie par la
    // personne est une information legitime.
    const text = visible(
      render(
        fullDraft({
          calendar: {
            startDate: '2026-07-11',
            durationDays: 3,
            durationIsSuggested: false,
            startDateIsSuggested: false,
            returnDate: null,
          },
        })
      )
    );
    expect(text).toContain('3 jours');
  });

  it('D10-20c: la proposition est signalee sans etre chiffree', () => {
    const text = visible(
      render(
        fullDraft({
          calendar: {
            startDate: '2026-07-11',
            durationDays: 3,
            durationIsSuggested: true,
            startDateIsSuggested: false,
            returnDate: null,
          },
        })
      )
    );
    // La pastille nomme sa SOURCE au lieu de qualifier un manque : c est
    // une aide, pas une donnee absente, et « à préciser » la
    // faisait lire comme telle. P0.15 l a renommee et l a rattachee a la cellule.
    expect(text).toContain('Durée proposée · modifiable');
    expect(text).not.toContain('à préciser');
    expect(text).toContain('modifiable');
  });

  it('D10-21: aucune distance, aucun prix, aucun pourcentage avant calcul', () => {
    const text = visible(render(fullDraft()));
    expect(text).not.toMatch(/\d+\s*%/);
    expect(text).not.toMatch(/\d+\s*€/);
    expect(text).not.toMatch(/\d+\s*km\b/i);
  });

  it('D10-22: pas de safe-area sur la page principale', () => {
    expect(render(fullDraft())).not.toContain('safe-area-inset');
  });

  it('D10-23: la vue principale ne défile pas', () => {
    expect(render(fullDraft())).not.toContain('overflow-y');
  });
});
