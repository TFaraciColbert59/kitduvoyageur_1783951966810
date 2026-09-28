import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrepMap } from '../components/PrepMap';

/**
 * D6 - la pastille d'un repere recouvre le bouton « Recentrer ».
 *
 * MESURE AVANT CORRECTIF (393x852, parcours reellement genere, preuve
 * `proof/D6-00-avant.png` et `D6-02-scrollee.png`) :
 *
 *   carte            y 646 -> 778   (132 px de haut)
 *   commandes        y 658 -> 754   (colonne : 2 boutons de 44 px + 8 de gap)
 *   bouton Recentrer y 710 -> 754   x 249 -> 361
 *   pastille Gouter  y 720 -> 760   x 217 -> 366
 *   RECOUVREMENT     112 px x 34 px
 *
 * Et au repos, sans defiler, `elementsFromPoint` au centre de « Recentrer »
 * renvoie le BOUTON DU PIED DE PAGE : la commande est morte ET invisible.
 *
 * CAUSE RACINE, pas un effet de surface : `.hub-globe-poi-rail` est ancre a
 * `top: calc(var(--safe-top) + 4.5rem)`, soit 72 px, une valeur concue pour
 * une carte pleine page. Dans une carte compacte de 132 px elle tombe
 * exactement dans la bande des commandes (12 -> 108) et son `z-index: 5`
 * depasse celui des commandes (`3`) : la pastille vole le clic.
 *
 * Ces tests verrouillent le CONTRAT qui rend la geometrie possible, parce que
 * `jsdom` ne calcule aucune mise en page. La preuve geometrique reste la
 * mesure navigateur.
 */

vi.mock('../store/useAdventurePrepStore', () => {
  const use = ((selector: (store: unknown) => unknown) => selector({ draft: null })) as unknown as {
    getState: () => unknown;
  };
  use.getState = () => ({ draft: null });
  return { useAdventurePrepStore: use };
});

const CSS = readFileSync(
  join(process.cwd(), 'src/features/adventure-prep/adventure-prep.css'),
  'utf8'
);

/** Le bloc CSS qui vise la carte compacte, hors plein ecran. */
function compacte(): string {
  const start = CSS.indexOf('.prep-map:not(.prep-map--full)');
  expect(start, 'la carte compacte doit avoir son propre bloc CSS').toBeGreaterThan(-1);
  const suite = CSS.slice(start, start + 4000);
  const fin = suite.indexOf('@media');
  return fin === -1 ? suite : suite.slice(0, fin);
}

function rendre(): string {
  return renderToStaticMarkup(
    React.createElement(PrepMap, {
      name: 'Chamonix',
      routeCoords: [
        [45.9237, 6.8694],
        [45.87, 6.8],
      ],
      points: [],
      scopeLabel: 'Ensemble',
    })
  );
}

describe('D6 - la carte compacte ne se recouvre pas elle-meme', () => {
  it('D6-1 les commandes compactes sont sur UNE bande, pas empilees en hauteur', () => {
    const bloc = compacte();
    expect(bloc).toMatch(new RegExp('[.]prep-map__controls[^{]*[{][^}]*flex-direction:[ ]*row'));
  });

  it('D6-2 le rail de pastilles est ancre en BAS de la carte compacte', () => {
    const bloc = compacte();
    // `top: auto` + `bottom:` : la regle `safe-top + 4.5rem` du hub ne peut
    // plus placer le rail dans la bande des commandes.
    expect(bloc).toMatch(new RegExp('[.]hub-globe-poi-rail[^{]*[{][^}]*top:[ ]*auto'));
    expect(bloc).toMatch(new RegExp('[.]hub-globe-poi-rail[^{]*[{][^}]*bottom:[ ]*[0-9]'));
  });

  it('D6-3 les commandes passent DEVANT le rail : un clic ne peut pas etre vole', () => {
    const bloc = compacte();
    const z = bloc.match(new RegExp('[.]prep-map__controls[^{]*[{][^}]*z-index:[ ]*([0-9]+)'));
    expect(z, 'les commandes compactes doivent fixer leur z-index').not.toBeNull();
    expect(Number(z?.[1])).toBeGreaterThanOrEqual(6);
  });

  it('D6-4 les deux commandes compactes existent, chacune avec un nom audible', () => {
    const html = rendre();
    expect(html).toContain('Agrandir la carte');
    expect(html).toContain('Recentrer sur le parcours');
  });

  it('D6-6 la surface de la carte est collee a la fenetre visible', () => {
    // Sans cela `bottom: 10px` se resout contre une boite de 320 px dans une
    // fenetre de 132 px, et le rail sort de la carte, coupe par overflow.
    expect(compacte()).toMatch(new RegExp('[.]hub-globe-map[^{]*[{][^}]*position:[ ]*absolute'));
    expect(compacte()).toMatch(new RegExp('[.]hub-globe-map[^{]*[{][^}]*inset:[ ]*0'));
    // `min-height: 0` est indispensable : `min-height` bat `height`, donc
    // sans lui le `min-height: 20rem` du hub (320 px) gardait la surface plus
    // haute que la fenetre. Ce test etait VERT sans cette assertion, alors que
    // le rail sortait toujours de la carte : c est ce rajout qui l attrape.
    expect(compacte()).toMatch(new RegExp('[.]hub-globe-map[^{]*[{][^}]*min-height:[ ]*0'));
  });

  it('D6-5 la carte compacte garde son libelle de perimetre', () => {
    const html = rendre();
    expect(html).toContain('prep-map__scope');
    expect(html).toContain('Ensemble');
  });
});
