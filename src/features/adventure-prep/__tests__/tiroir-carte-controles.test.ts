/**
 * Tiroir Lieu et carte - L2.9 / L2.10, et le contrat de `MapActions`.
 *
 * MESURE (2026-09-29, navigateur, 393x852, `/prepare?nouvelle=1` puis
 * « Partir librement ») : sur l'etape 1 (« Creations »),
 *
 *   .prep-map     : 0
 *   « Zone »      : absent du texte de l'ecran
 *   « Agrandir »  : absent
 *   « Recentrer » : absent
 *
 * (`qa-local/tiroir/carte-etape1-creations.png`.) L'etape 1 n'a pas de carte du
 * tout : `DestinationStep.tsx` ne rend aucun `PrepMap`. Aucun bouton ne peut
 * donc etre « superpose au contenu » la.
 *
 * L2.9 « le bouton Zone » : il n'existe pas. Le seul « zone » du depot est
 * « Rechercher dans cette zone » de `src/components/map/InteractiveMap.tsx`,
 * une carte legacy que le preparateur n'utilise pas. Le badge de perimetre de
 * la carte du preparateur s'appelle `MapScope` et recoit « Ensemble » ou
 * « Jour N » - jamais « Zone ».
 *
 * L2.10 « Agrandir / Recentrer empiles a droite » : ces deux boutons
 * n'existent que dans `MapCompactActions`, sur la carte INLINE des etapes 2 et
 * 3, ou ils ont une raison d'etre. Et ils ne sont pas empiles : la regle
 * `.prep-map:not(.prep-map--full) .prep-map__controls { flex-direction: row }`
 * vaut (0,3,0) et bat `.prep-map__controls { flex-direction: column }`
 * (0,1,0) ; la carte inline porte `prep-map--inline`, pas `prep-map--full`,
 * donc elle prend bien la range. Ils flottent sur la carte, c'est voulu.
 *
 * Ces deux itemsetaient deja resolus par un autre lot :
 * `l2-etape1-perimetre.test.tsx` les verrouille deja (8/8 verts), avec un
 * contre-exemple qui prouve que la carte du recapitulatif, elle, affiche bien
 * ses deux boutons. Ce fichier ne le remplace pas : il apporte ce qui manque,
 * a savoir la preuve que `MapActions` n'a qu'un seul cote - un
 * consommateur externe possible, aucun.
 *
 * CONTRAT DE SIGNATURE : `MapActions` n'est PAS exporte. Toute evolution de sa
 * signature resterait donc privee a `PrepMap.tsx` et ne pourrait pas casser
 * `ItineraryStep.tsx` (etapes 2 et 3). Le dernier test de ce fichier fait
 * echouer la suite si quelqu'un l'exporte : l'export serait la seule maniere
 * d'introduire une dependance a sa forme.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string): string =>
  readFileSync(path.resolve(__dirname, '..', relative), 'utf8');

const PREP_MAP = read('components/PrepMap.tsx');
const DESTINATION = read('components/DestinationStep.tsx');
const ITINERARY = read('components/ItineraryStep.tsx');
const DEPARTURE = read('components/DepartureStep.tsx');
const CSS = read('adventure-prep.css');

describe('L2.9 - aucun bouton « Zone » sur la carte du preparateur', () => {
  it('l etape 1 ne rend aucune carte', () => {
    // Une carte absente ne peut pas etre recouverte par un bouton.
    expect(DESTINATION).not.toContain('PrepMap');
  });

  it('le perimetre affiche ne s appelle jamais « Zone »', () => {
    // `MapScope` recoit `scopeLabel` ; les deux appelants disent « Ensemble »
    // ou « Jour N ». Si un jour quelqu un passe « Zone », ce test rougit.
    expect(ITINERARY).toMatch(/scopeLabel=\{activeDay === null \? 'Ensemble' : `Jour \$\{activeDay\}`\}/);
    expect(DEPARTURE).toContain('scopeLabel="Ensemble"');
  });

  it('la carte du preparateur ne contient aucun controle nomme « Zone »', () => {
    expect(PREP_MAP).not.toMatch(/>\s*Zone\s*</);
    expect(PREP_MAP).not.toMatch(/aria-label="[^"]*Zone/);
  });

  it('contre-exemple : le seul « zone » du depot est une carte que le preparateur ignore', () => {
    // Si cette sonde etait aveugle, le test d absence ci-dessus ne prouverait
    // rien. Elle trouve : le mot existe, dans un autre composant.
    const legacy = readFileSync(
      path.resolve(__dirname, '..', '..', '..', 'components', 'map', 'InteractiveMap.tsx'),
      'utf8',
    );
    expect(legacy).toContain('Rechercher dans cette zone');
    expect(PREP_MAP).not.toContain('InteractiveMap');
  });
});

describe('L2.10 - les deux boutons de la carte inline sont poses, pas empiles', () => {
  it('il n y a que deux boutons compacts, et chacun a un nom accessible', () => {
    const bloc = PREP_MAP.slice(PREP_MAP.indexOf('function MapCompactActions'), PREP_MAP.indexOf('function MapCompactActions') + 1400);
    expect(bloc).toContain('aria-label="Agrandir la carte"');
    expect(bloc).toContain('aria-label="Recentrer sur le parcours"');
    expect(bloc.match(/<button/g)).toHaveLength(2);
  });

  it('« Agrandir » est le seul bouton que l appelant peut retirer', () => {
    // `hideExpand` retire exactement un bouton : ni « Recentrer », ni la
    // fermeture du plein ecran. Un caller qui le mal regle ne perd donc pas le
    // recentrage, qui est le geste qui rend la carte utilisable.
    const bloc = PREP_MAP.slice(PREP_MAP.indexOf('function MapCompactActions'), PREP_MAP.indexOf('function MapCompactActions') + 1400);
    expect(bloc).toMatch(/\{!hideExpand && \([\s\S]*?Agrandir la carte[\s\S]*?\)\}/);
    expect(bloc).toMatch(/aria-label="Recentrer sur le parcours"/);
  });

  it('sur la carte inline, les boutons sont en range, pas en colonne', () => {
    // La regle (0,3,0) bat la regle (0,1,0) : le `:not()` compte pour un
    // selecteur de classe supplementaire. Sans elle, `column` gagnerait par
    // ordre de source et les deux boutons s empileraient - exactement le
    // symptome « empiles a droite » de l'item L2.10.
    expect(CSS).toMatch(
      /\.prep-map:not\(\.prep-map--full\)\s+\.prep-map__controls\s*\{[^}]*flex-direction:\s*row/,
    );
  });

  it('la carte inline de l etape 2 n est pas la carte plein ecran', () => {
    // C est ce qui fait que `:not(.prep-map--full)` la selectionne.
    expect(ITINERARY).toContain('className="prep-map--inline"');
    expect(PREP_MAP).toContain('prep-map--full');
  });
});

describe('MapActions - aucun consommateur externe possible', () => {
  it('MapActions reste prive a PrepMap.tsx', () => {
    // Ni `export function`, ni `export const`, ni `{ MapActions }` dans un
    // export liste. Une seule ligne suffirait a tout casse.
    expect(PREP_MAP).not.toMatch(/export\s+(function|const|default)\s+MapActions/);
    expect(PREP_MAP).not.toMatch(/export\s*\{[^}]*\bMapActions\b[^}]*\}/);
  });

  it('et pour autant il n est utilise que par ses deux freres internes', () => {
    const usages = [...PREP_MAP.matchAll(/<MapActions>/g)];
    expect(usages).toHaveLength(2);
    // Un : le plein ecran. Un : la carte inline. Rien d'autre.
    const avant = PREP_MAP.slice(0, PREP_MAP.indexOf('function MapActions'));
    expect(avant).not.toContain('MapActions');
  });

  it('contre-exemple : PrepMap, lui, est bien exporte et bien consomme', () => {
    // Sans ce contre-exemple, le test d absence du dessus ne prouverait pas que
    // la sonde sait lire un export : elle ne le distinguerait pas.
    expect(PREP_MAP).toMatch(/export function PrepMap\(/);
    expect(ITINERARY).toContain("import { PrepMap");
    expect(DEPARTURE).toContain("import { PrepMap } from './PrepMap'");
  });

  it('la surface exportee de PrepMap.tsx est celle d aujourd hui', () => {
    // Un inventaire, pas une intention : ajouter une export ne passe pas
    // inapercu, et retirer une export non plus.
    const exports = [...PREP_MAP.matchAll(/^export\s+(?:interface|const|function)\s+(\w+)/gm)].map(
      (m) => m[1],
    );
    expect(exports.sort()).toEqual(
      [
        'MAP_CLOSE_SELECTOR',
        'PREP_POINT_COLORS',
        'PrepMap',
        'PrepMapDayTab',
        'PrepMapFilter',
        'PrepMapFullscreen',
        'PrepMapFullscreenProps',
        'PrepMapPoint',
        'PrepMapProps',
        'OverlayFocusable',
        'OverlayKeyEvent',
        'applyOverlayFocus',
        'collectFocusable',
        'handleOverlayKeyEvent',
        'resolveDayTabs',
        'resolveTrappedIndex',
        'resolveVisibleFilters',
      ].sort(),
    );
  });
});
