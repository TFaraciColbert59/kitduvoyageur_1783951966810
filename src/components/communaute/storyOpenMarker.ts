/**
 * Marqueur global « une story est ouverte ».
 *
 * Contrat unique : tant qu'au moins une visionneuse de story est montée (React
 * `StoriesViewer`, lecture ET composition, ou visionneuse héritée du Compte),
 * `<html>` et `<body>` portent `data-story-open="true"`. Une seule règle CSS
 * globale (`floating-liquid-tabbar.css`) masque alors toutes les barres basses :
 * aucune liste d'éléments figée à l'ouverture, aucune dépendance à `:has()` ni à
 * l'`aria-label` de la visionneuse.
 *
 * Compteur de références : plusieurs instances peuvent coexister ; le marqueur
 * n'est retiré qu'à la dernière. Le démontage brutal passe par le nettoyage de
 * l'effet React (ou `release()` côté runtime hérité).
 *
 * Barre native iOS (UIKit, Capacitor) : le CSS ne l'atteint pas, et `NavigationBar`
 * ne rend alors AUCUNE barre web. Seul l'événement `lkdv-toggle-bottom-bar`
 * (NavigationBar.tsx -> plugin `LKDVAccountTabBar.setVisible`) la masque. On
 * l'émet donc seulement quand `isIOS()` (Capacitor.getPlatform() === 'ios', faux
 * sur le web et Android). Sur le web l'événement n'est pas émis : le CSS suffit
 * et l'événement rendrait la barre à un autre demandeur.
 *
 * Pas de « dernier écrivant gagne » : l'événement n'a pas de compteur. Ce module
 * écoute les événements des AUTRES demandeurs (tiroir carte, Explorer, Kit
 * Studio, composition de story) et en retient l'état. À la dernière fermeture, il
 * ne lève le masquage que si aucun autre demandeur ne le garde ; si un autre
 * demandeur lève le masquage pendant qu'une story est ouverte, il le rétablit.
 */
import { isIOS } from '@/lib/native/platform';

const ATTR = 'storyOpen';
let holders = 0;

function setMarker(on: boolean): void {
  if (typeof document === 'undefined') return;
  for (const node of [document.documentElement, document.body]) {
    if (!node) continue;
    if (on) node.dataset[ATTR] = 'true';
    else delete node.dataset[ATTR];
  }
}

const EVENT = 'lkdv-toggle-bottom-bar';
/** Vrai pendant NOS émissions (elles ne comptent pas comme un autre demandeur). */
let emitting = false;
/** Dernier état demandé par un autre demandeur (true = barre gardée masquée). */
let externalHide = false;

function emit(hide: boolean): void {
  emitting = true;
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { hide } }));
  } finally {
    emitting = false;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener(EVENT, (event) => {
    if (emitting) return;
    const hide = (event as CustomEvent<{ hide?: boolean }>).detail?.hide;
    if (typeof hide !== 'boolean') return;
    externalHide = hide;
    // Un autre demandeur lève le masquage alors qu'une story est ouverte : on
    // le rétablit après les autres écouteurs (micro-tâche).
    if (!hide && holders > 0 && isIOS()) {
      queueMicrotask(() => {
        if (holders > 0) emit(true);
      });
    }
  });
}

function notifyNativeBar(hide: boolean): void {
  if (typeof window === 'undefined' || !isIOS()) return;
  // Fermeture : ne lever le masquage que si aucun autre demandeur ne le garde.
  if (!hide && externalHide) return;
  emit(hide);
}

/** Pose le marqueur ; renvoie la fonction de libération (idempotente). */
export function acquireStoryOpen(): () => void {
  if (typeof document === 'undefined') return () => undefined;
  holders += 1;
  if (holders === 1) {
    setMarker(true);
    notifyNativeBar(true);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders = Math.max(0, holders - 1);
    if (holders === 0) {
      setMarker(false);
      notifyNativeBar(false);
    }
  };
}

/** Nombre de visionneuses actuellement montées (diagnostic et tests). */
export function storyOpenHolders(): number {
  return holders;
}
