/**
 * Appui long sur la carte — reconnaissance du geste.
 *
 * Poser un point de passage ne doit jamais se confondre avec un deplacement de
 * carte : le meme doigt qui glisse sert a recadrer le trace. Ce module ne fait
 * que qualifier le geste et la validite de l arme ; c est `PrepMap` qui
 * arme l appui long, puis qui recoit la coordonnee reelle du clic MapLibre.
 *
 * Pourquoi deux etats et pas un seul : la carte ne livre une coordonnee qu au
 * moment du clic, c est a dire APRES le relachement. Il faut donc se
 * souvenir qu un appui long vient d avoir lieu pour pouvoir attribuer ce clic
 * a un point de passage — et.expired cet armement assez vite pour qu un tap
 * ulterieur ne_pose rien au mauvais endroit.
 */

import { describe, expect, it } from 'vitest';
import { isLongPress, armedStillValid, LONG_PRESS_MS, LONG_PRESS_SLOP_PX } from '../engine/mapLongPress';

describe('LONG-01 — Un appui tenu pose un point', () => {
  it('LONG-01: un doigt immobile assez longtemps est un appui long', () => {
    expect(isLongPress(900, 2)).toBe(true);
  });

  it('LONG-02: un tap bref ne pose rien', () => {
    expect(isLongPress(120, 1)).toBe(false);
  });

  it('LONG-03: le seuil est atteignable par un geste reel', () => {
    expect(isLongPress(LONG_PRESS_MS, 0)).toBe(true);
    expect(isLongPress(LONG_PRESS_MS - 1, 0)).toBe(false);
  });

  it('LONG-04: glisser reste un deplacement, meme long', () => {
    expect(isLongPress(2000, LONG_PRESS_SLOP_PX + 1)).toBe(false);
  });

  it('LONG-05: la tolerance de tremblement est accordee', () => {
    expect(isLongPress(900, LONG_PRESS_SLOP_PX)).toBe(true);
  });

  it('LONG-06: une duree ou un deplacement invalide ne qualifie rien', () => {
    expect(isLongPress(-500, 0)).toBe(false);
    expect(isLongPress(Number.NaN, 0)).toBe(false);
    expect(isLongPress(900, Number.NaN)).toBe(false);
  });
});

describe('LONG-07 — L arme ne doit pas trainer jusqu au tap suivant', () => {
  it('LONG-07: le clic immediatement apres l appui long compte', () => {
    expect(armedStillValid(1000, 1000)).toBe(true);
  });

  it('LONG-08: un clic tardif ne consomme plus l arme', () => {
    expect(armedStillValid(1000, 4000)).toBe(false);
  });

  it('LONG-09: une horloge qui recule ne reste pas armee', () => {
    expect(armedStillValid(4000, 1000)).toBe(false);
  });
});
