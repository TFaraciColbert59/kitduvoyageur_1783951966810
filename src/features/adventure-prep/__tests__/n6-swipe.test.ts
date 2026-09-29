/**
 * N6 — le balayage de jour : retour haptique et resistance aux bords.
 *
 * La checklist disait « Non verifiable en capture ». C etait vrai tant que la
 * seule facon de regarder un geste etait une image. Un geste se pilote : ce
 * fichier monte le hook reel dans jsdom, lui envoie de vrais payloads de
 * contact, et lit ce que la chaine entiere produit — le store appele, et la
 * vibration declenchee.
 *
 * La chaine n est pas simulee. `useDaySwipe` appelle `useHapticFeedback`, qui
 * appelle `triggerNativeHaptic`, qui retombe — hors natif, donc ici — sur
 * `navigator.vibrate(10)` pour le style `selection`. Le test observe DONC le
 * point d arrive reel, pas un mock : si la chaine change de forme, le test
 * echoue au lieu de continuer de passer.
 *
 * Deux gardes negatives, chacune precedee d un temoin positif dans le meme
 * test : sans ce temoin, « aucune vibration » prouverait seulement que le
 * spy ne fonctionne pas.
 */

// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { TouchEvent } from 'react';

import { useDaySwipe, isInsideMap } from '../hooks/useDaySwipe';
import { dayAfterSwipe, swipeIntent } from '../engine/dayNavigation';

/* ------------------------------------------------------------------ */
/* Pilotage des gestes                                                 */
/* ------------------------------------------------------------------ */

interface Pt {
  readonly clientX: number;
  readonly clientY: number;
}

/** Payload de contact tel que le hook le consomme. */
function contact(
  touches: ArrayLike<Pt>,
  changed: ArrayLike<Pt>,
  target: EventTarget | null = null,
): TouchEvent<Element> {
  return {
    touches: Array.from(touches),
    changedTouches: Array.from(changed),
    target,
  } as unknown as TouchEvent<Element>;
}

/** Balayage horizontal franc, le seul que `swipeIntent` reconnait. */
function swipe(dir: 'suivant' | 'precedent', distance = 120) {
  const dx = dir === 'suivant' ? distance : -distance;
  return {
    start: contact([{ clientX: 200, clientY: 300 }], [{ clientX: 200, clientY: 300 }]),
    end: contact([], [{ clientX: 200 + dx, clientY: 300 }]),
  };
}

type Handlers = ReturnType<typeof useDaySwipe>;

/** Joue un geste complet et rend les jours demandes. */
function play(h: Handlers, gesture: ReturnType<typeof swipe>): void {
  h.onTouchStart(gesture.start);
  h.onTouchMove(gesture.end);
  h.onTouchEnd(gesture.end);
}

/**
 * Monte le hook et renvoie ses gestionnaires.
 *
 * `onSelectDay` est observe par l'appelant : chaque test garde sa propre
 * liste, donc aucun etat ne fuit d'un test a l'autre.
 */
function mount(options: { current: number | null; days: number; onSelectDay?: (d: number | null) => void; ignore?: (t: EventTarget | null) => boolean }) {
  const onSelectDay = vi.fn();
  const { result, unmount } = renderHook(() =>
    useDaySwipe({ current: options.current, days: options.days, onSelectDay, ignore: options.ignore }),
  );
  return {
    h: result.current,
    onSelectDay,
    unmount,
    // Getter, pas instantane : les appels arrivent APRES le montage.
    get selected(): Array<number | null> {
      return onSelectDay.mock.calls.map((c) => c[0]);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Temoin : la vibration repond vraiment                              */
/* ------------------------------------------------------------------ */

let vibrate: ReturnType<typeof vi.fn>;
let matchMediaOriginal: typeof window.matchMedia;

beforeEach(() => {
  matchMediaOriginal = window.matchMedia;
  // jsdom n'a pas de Vibration API : on l'installe pour pouvoir l'observer.
  // C'est le point d'arrive REEL de `triggerNativeHaptic` en mode web.
  vibrate = vi.fn();
  Object.defineProperty(navigator, 'vibrate', { configurable: true, writable: true, value: vibrate });
  setReducedMotion(false);
});

afterEach(() => {
  window.matchMedia = matchMediaOriginal;
});

/** `triggerNativeHaptic` lit `(prefers-reduced-motion: reduce)` sur matchMedia. */
function setReducedMotion(on: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches: on && /prefers-reduced-motion:\s*reduce/.test(query),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/** Vrai si la chaine complete a bien vibré, style `selection` (web : 10 ms). */
function buzzed(): boolean {
  return vibrate.mock.calls.some((c) => c[0] === 10);
}

describe('N6-a le moteur ne laisse aucune impasse', () => {
  it('N6-01 balayer depuis n importe quel etat change toujours de vue, et reste dans le programme', () => {
    // Le rail est un carrousel FERME : « Ensemble » fait partie de la boucle.
    // On le prouve sur tout l espace d etat, pas sur un cas choisi.
    const visited = new Set<string>();
    for (let days = 2; days <= 14; days += 1) {
      for (let current: number | null = null; current === null || current <= days; current = current === null ? 1 : current + 1) {
        for (const intent of ['suivant', 'precedent'] as const) {
          const next = dayAfterSwipe(current, days, intent);
          const from = current === null ? 'ensemble' : `j${current}`;
          const to = next === null ? 'ensemble' : `j${next}`;

          // 1. jamais un jour hors programme
          expect(next === null || (Number.isInteger(next) && next >= 1 && next <= days)).toBe(true);
          // 2. jamais une impasse : le geste fait TOUJOURS bouger la vue
          expect(next).not.toBe(current);
          visited.add(`${days}|${from}|${intent}|${to}`);
        }
      }
    }
    // Temoin de volume : on ne se contente pas de « des cas », on compte.
    // jours 2..14 => (days + 1) etats (ensemble + chaque jour), 2 sens.
    const expectedStates = Array.from({ length: 13 }, (_, i) => i + 2 + 1).reduce((a, b) => a + b, 0) * 2;
    expect(expectedStates).toBe(234);
    expect(visited.size).toBe(expectedStates);
  });

  it('N6-01b la garde `next === current` du hook est un filet, pas un comportement', () => {
    // Constat mesure, pas une supposition : on a essaye de mordre LA garde
    // `if (next === current) return;` en remontant la vibration avant elle, et
    // le suite est restee VERTE. La raison est ici, et elle est nette.
    //
    // Pour atteindre cette ligne, `onTouchEnd` a deja survecu a deux gardes :
    // `days` entier >= 2, et `intent !== null`. Sur ce domaine — que l on
    // explore en entier — le carrousel FERME fait que `dayAfterSwipe` ne rend
    // JAMAIS `current`. La ligne est donc inatteignable : c est une
    // assurance, pas un chemin. La resistance aux bords reelle est portee par
    // les DEUX gardes d avant, que N6-05, N6-09 et N6-10 mordent vraiment.
    let cases = 0;
    for (let days = 2; days <= 60; days += 1) {
      for (let current: number | null = null; current === null || current <= days; current = current === null ? 1 : current + 1) {
        for (const intent of ['suivant', 'precedent'] as const) {
          cases += 1;
          expect(dayAfterSwipe(current, days, intent)).not.toBe(current);
        }
      }
    }
    // Volume reellement parcourt : le resultat vide n est pas une boucle vide.
    // jours 2..60 => (days + 1) etats (ensemble + chaque jour), fois 2 sens.
    const states = Array.from({ length: 59 }, (_, i) => i + 2 + 1).reduce((a, b) => a + b, 0);
    expect(cases).toBe(states * 2);
    expect(cases).toBe(3776);
  });

  it('N6-02 un geste trop court, trop vertical ou non fini n est pas un balayage', () => {
    // 47 px : juste sous le seuil de 48 px, donc indistinct d un tap.
    expect(swipeIntent(47, 0)).toBeNull();
    // 100 px de travers pour 90 px de haut : diagonale, c est un defilement.
    expect(swipeIntent(100, 90)).toBeNull();
    // Valeurs non finies : ce ne sont pas des gestes.
    expect(swipeIntent(Number.NaN, 0)).toBeNull();
    expect(swipeIntent(120, Number.POSITIVE_INFINITY)).toBeNull();
    // Et le seuil, lui, est franchi : la garde n est pas triviale.
    expect(swipeIntent(48, 0)).toBe('suivant');
    expect(swipeIntent(-48, 0)).toBe('precedent');
  });
});

describe('N6-b le hook Resistance aux bords', () => {
  it('N6-03 n ecrit jamais dans le store un jour qui ne change pas', () => {
    // Tout l espace d etat valide, les deux sens : le store ne doit jamais
    // recevoir une ecriture qui ne bouge rien.
    for (let days = 2; days <= 10; days += 1) {
      for (let current: number | null = null; current === null || current <= days; current = current === null ? 1 : current + 1) {
        for (const dir of ['suivant', 'precedent'] as const) {
          const { h, onSelectDay, unmount } = mount({ current, days });
          play(h, swipe(dir));
          for (const [next] of onSelectDay.mock.calls) expect(next).not.toBe(current);
          expect(onSelectDay).toHaveBeenCalledTimes(1);
          unmount();
        }
      }
    }
  });

  it('N6-04 un jour fantome (programme raccourci) revient a l ensemble, jamais a un jour specimen', () => {
    // Le voyage a ete raccourci entre deux gestes : le jour 7 affiche n existe
    // plus dans un programme de 3 jours. Le geste doit retablir une vue REELLE.
    // `selected` n est PAS destructure : la destructuration appellerait le
    // getter et recopierait un instantane, c est a dire une liste vide.
    const fantome = mount({ current: 7, days: 3 });
    play(fantome.h, swipe('suivant'));
    expect(fantome.selected).toEqual([null]);
    fantome.unmount();

    // Et depuis l ensemble, on ne saute pas pour autant vers un jour hors
    // programme : le geste suivant ouvre le jour 1.
    const back = mount({ current: null, days: 3 });
    play(back.h, swipe('suivant'));
    expect(back.selected).toEqual([1]);
    back.unmount();
  });

  it('N6-05 sous deux journees, ou sans programme, aucun geste ne navigate', () => {
    for (const days of [0, 1, -1, 2.5, Number.NaN]) {
      for (const dir of ['suivant', 'precedent'] as const) {
        const { h, onSelectDay, unmount } = mount({ current: null, days });
        play(h, swipe(dir));
        // Le rail n est pas rendu : aucune navigation ne doit exister derriere.
        expect(onSelectDay).not.toHaveBeenCalled();
        unmount();
      }
    }
  });

  it('N6-06 un geste sur la carte, a deux doigts, ou annule ne navigue pas', () => {
    // La carte a ses propres gestes : elle garde son balayage.
    const map = document.createElement('div');
    map.className = 'prep-map';
    expect(isInsideMap(map)).toBe(true);
    expect(isInsideMap(document.createElement('div'))).toBe(false);

    const onMap = mount({ current: null, days: 5 });
    const g = swipe('suivant');
    onMap.h.onTouchStart(contact(g.start.touches, g.start.changedTouches, map));
    onMap.h.onTouchEnd(contact([], g.end.changedTouches, map));
    expect(onMap.onSelectDay).not.toHaveBeenCalled();
    onMap.unmount();

    // Pincement a deux doigts : memorise rien plutot que memoriser un faux geste.
    const pinch = mount({ current: null, days: 5 });
    pinch.h.onTouchStart(contact([{ clientX: 200, clientY: 300 }, { clientX: 260, clientY: 300 }], []));
    pinch.h.onTouchEnd(contact([], [{ clientX: 320, clientY: 300 }]));
    expect(pinch.onSelectDay).not.toHaveBeenCalled();
    pinch.unmount();

    // Geste annule par le systeme : aucun point de depart ne doit rester.
    const cancelled = mount({ current: null, days: 5 });
    cancelled.h.onTouchStart(g.start);
    cancelled.h.onTouchCancel();
    cancelled.h.onTouchEnd(g.end);
    expect(cancelled.onSelectDay).not.toHaveBeenCalled();
    cancelled.unmount();

    // Scroll vole : geste vertical dominant, pas un balayage de jour.
    const vertical = mount({ current: null, days: 5 });
    vertical.h.onTouchStart(contact([{ clientX: 200, clientY: 300 }], []));
    vertical.h.onTouchEnd(contact([], [{ clientX: 230, clientY: 480 }]));
    expect(vertical.onSelectDay).not.toHaveBeenCalled();
    vertical.unmount();
  });

  it('N6-07 le defilement vertical du programme n est jamais bloque', () => {
    // Le programme est une liste : bloquer le defilement casserait la lecture.
    // Le tri des gestes se fait a la levee, jamais par une annulation.
    const { h, unmount } = mount({ current: null, days: 5 });
    const start = contact([{ clientX: 200, clientY: 300 }], []);
    const preventDefault = vi.fn();
    h.onTouchStart({ ...start, preventDefault } as unknown as TouchEvent<Element>);
    h.onTouchMove({ ...start, preventDefault } as unknown as TouchEvent<Element>);
    expect(preventDefault).not.toHaveBeenCalled();
    unmount();
  });
});

describe('N6-c retour haptique', () => {
  it('N6-08 un balayage effectif vibre, une fois, au moment du changement', () => {
    const { h, onSelectDay, unmount } = mount({ current: null, days: 5 });
    play(h, swipe('suivant'));

    // La chaine complete a ete parcourue : useDaySwipe -> useHapticFeedback ->
    // triggerNativeHaptic -> navigator.vibrate. Le style `selection` vaut 10 ms
    // en repli web.
    expect(buzzed()).toBe(true);
    // Exactement une vibration, exactement une ecriture : un aller-retour.
    expect(vibrate.mock.calls).toEqual([[10]]);
    expect(onSelectDay).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('N6-09 un geste refuse ne vibre pas', () => {
    // Chaque refus porte son temoin dans le meme test : on prouve d abord que
    // la vibration repond, ensuite seulement qu elle ne part pas. Sans ce
    // temoin, « aucune vibration » ne prouverait qu un spy casse.
    const guard = (label: string, days: number, drive: (h: Handlers) => void) => {
      // Temoin positif : meme hook, meme spy, geste valide.
      vibrate.mockClear();
      const witness = mount({ current: null, days: 5 });
      play(witness.h, swipe('suivant'));
      expect(buzzed(), `temoin positif (${label})`).toBe(true);
      witness.unmount();
      vibrate.mockClear();

      // Le refus, lui.
      const { h, onSelectDay, unmount } = mount({ current: null, days });
      drive(h);
      expect(buzzed(), `refus (${label})`).toBe(false);
      expect(onSelectDay, `refus (${label})`).not.toHaveBeenCalled();
      unmount();
    };

    // Moins de deux journees : le rail n est pas rendu, rien ne doit vibrer.
    guard('programme trop court', 1, (h) => play(h, swipe('suivant')));
    guard('aucun programme', 0, (h) => play(h, swipe('suivant')));
    // 20 px : sous le seuil de 48 px, le geste est indistinct d un tap.
    guard('geste sous le seuil', 5, (h) => play(h, swipe('suivant', 20)));
    // Seuil pile atteint, mais vertical : 48 px de travers pour 40 px de haut,
    // dominance 2 non satisfaite.
    guard('geste vertical dominant', 5, (h) => {
      h.onTouchStart(contact([{ clientX: 200, clientY: 300 }], []));
      h.onTouchEnd(contact([], [{ clientX: 248, clientY: 340 }]));
    });
  });

  it('N6-10 un geste interrompu, vertical, ou sur la carte ne vibre pas', () => {
    const cases: Array<[string, (h: Handlers) => void]> = [
      ['geste annule', (h) => {
        const g = swipe('suivant');
        h.onTouchStart(g.start);
        h.onTouchCancel();
        h.onTouchEnd(g.end);
      }],
      ['scroll vertical', (h) => {
        h.onTouchStart(contact([{ clientX: 200, clientY: 300 }], []));
        h.onTouchEnd(contact([], [{ clientX: 210, clientY: 460 }]));
      }],
      ['geste sur la carte', (h) => {
        const map = document.createElement('div');
        map.className = 'prep-map';
        const g = swipe('suivant');
        h.onTouchStart(contact(g.start.touches, g.start.changedTouches, map));
        h.onTouchEnd(contact([], g.end.changedTouches, map));
      }],
      ['pincement a deux doigts', (h) => {
        h.onTouchStart(contact([{ clientX: 200, clientY: 300 }, { clientX: 250, clientY: 300 }], []));
        h.onTouchEnd(contact([], [{ clientX: 330, clientY: 305 }]));
      }],
    ];

    for (const [label, drive] of cases) {
      vibrate.mockClear();
      const { h, unmount } = mount({ current: null, days: 5 });
      drive(h);
      expect(buzzed(), `refus (${label})`).toBe(false);
      unmount();
    }
  });

  it('N6-11 prefers-reduced-motion coupe la vibration mais pas la navigation', () => {
    setReducedMotion(true);
    const { h, onSelectDay, unmount } = mount({ current: null, days: 5 });
    play(h, swipe('suivant'));

    // Le geste reste valide : la navigation, elle, ne depend pas du mouvement.
    expect(onSelectDay).toHaveBeenCalledExactlyOnceWith(1);
    // Mais on ne secoue pas un appareil dont l utilisateur a refuse le
    // mouvement : c est la regle, appliquee dans `triggerNativeHaptic`.
    expect(buzzed()).toBe(false);
    unmount();

    // Temoin : le meme geste, sans le reglage, vibre bien. Sans lui,
    // « aucune vibration » ne prouverait rien.
    setReducedMotion(false);
    const again = mount({ current: null, days: 5 });
    play(again.h, swipe('suivant'));
    expect(buzzed()).toBe(true);
    again.unmount();
  });
});
