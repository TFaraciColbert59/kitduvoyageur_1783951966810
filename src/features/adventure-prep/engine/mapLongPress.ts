/**
 * Appui long sur la carte — reconnaissance du geste.
 *
 * Poser un point de passage ne doit jamais se confondre avec un deplacement de
 * carte : le meme doigt qui glisse sert a recadrer le trace. Ce module ne fait
 * que qualifier le geste et la validite de l arme ; c est `PrepMap` qui arme
 * l appui long, puis qui recoit la coordonnee reelle du clic MapLibre.
 *
 * Pourquoi un armement separe : la carte ne livre une coordonnee qu au moment
 * du clic, donc APRES le relachement du doigt. Il faut se souvenir qu un appui
 * long vient d avoir lieu pour attribuer ce clic a un point de passage — et
 * expirer cet armement assez vite pour qu un tap ulterieur ne pose rien au
 * mauvais endroit.
 */

/** Duree de maintien au-dela de laquelle le geste devient un appui long. */
export const LONG_PRESS_MS = 550;

/**
 * Deplacement tolere pendant le maintien, en pixels CSS.
 *
 * Un doigt qui tremble de quelques pixels n est pas un deplacement de carte ;
 * au-dela, l utilisateur est en train de recadrer, et un point de passage
 * poser par surprise au milieu du gesture serait le pire des deux mondes.
 */
export const LONG_PRESS_SLOP_PX = 10;

/**
 * Delai pendant lequel l arme reste valable apres l appui long.
 *
 * Couvre le temps entre le relachement et l emission du clic par MapLibre.
 * Au-dela, l arme est consideraee perimee : un tap survenu entre-temps ne
 * doit pas transformer la carte.
 */
export const ARMED_TTL_MS = 1200;

/**
 * Le geste est-il un appui long ?
 *
 * `durationMs` = tempsEcoule depuis le contact, `movedPx` = ecart maximum
 * parcouru depuis le point de departure. Une valeur non finie ne qualifie rien :
 * une duree NaN ne doit pas valoir « appui long ».
 */
export function isLongPress(durationMs: number, movedPx: number): boolean {
  if (!Number.isFinite(durationMs) || !Number.isFinite(movedPx)) return false;
  if (durationMs < LONG_PRESS_MS) return false;
  return movedPx <= LONG_PRESS_SLOP_PX;
}

/**
 * L arme d un appui long est-elle encore valable au moment du clic ?
 *
 * Une horloge qui a recule (onglet suspendu, `performance.now` discontinu)
 * donne un delta negatif : on la traite comme perimee plutot que de laisser
 * une arme promise pour toujours.
 */
export function armedStillValid(armedAt: number, now: number): boolean {
  if (!Number.isFinite(armedAt) || !Number.isFinite(now)) return false;
  const elapsed = now - armedAt;
  return elapsed >= 0 && elapsed < ARMED_TTL_MS;
}
