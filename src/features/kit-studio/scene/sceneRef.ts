// Pont entre la scène three.js et l'interface : la scène est créée par SceneView, les cartes du tiroir
// ont besoin de projeter une zone à l'écran (vol de la carte) et d'éclairer la cible du glisser.
// Aucun état React : une simple référence vivante, nulle hors montage de la scène.
import type { KitScene } from './createScene';

let current: KitScene | null = null;

export const setScene = (scene: KitScene | null): void => {
  current = scene;
};

export const getScene = (): KitScene | null => current;
