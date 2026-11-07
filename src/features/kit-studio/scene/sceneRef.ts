// Pont entre la scène three.js et l'interface : la scène est créée par SceneView, les cartes du tiroir
// ont besoin de projeter une zone à l'écran (vol de la carte), d'éclairer la cible du glisser et de synchroniser
// les attachements de modules 3D.
// Aucun état React : une simple référence vivante et un système d'écouteurs légers.
import type { KitScene } from './createScene';

let current: KitScene | null = null;
const listeners = new Set<() => void>();

export const setScene = (scene: KitScene | null): void => {
  current = scene;
  notifySceneUpdate();
};

export const getScene = (): KitScene | null => current;

export const subscribeScene = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const notifySceneUpdate = (): void => {
  listeners.forEach((l) => l());
};
