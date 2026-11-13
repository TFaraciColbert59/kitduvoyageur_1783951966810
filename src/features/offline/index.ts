/**
 * Lot N02 — Point d'entrée public du module `src/features/offline/`.
 *
 * Couvre :
 * - K4.14 : Sélection, estimation et téléchargement de régions prédéfinies durables
 * - K4.15 : Sélecteur d'emprise libre, zones multiples, limites visibles & retour drawer parent
 * - K4.16 : Couverture téléchargée sur la carte (GeoJSON), déduplication de tuiles & plafond de zoom
 * - K4.17 : Photos, POI à venir et données de navigation dans le paquet hors ligne
 * - K4.19 : Raccourcis Android (App Shortcuts) et recherche Spotlight iOS hors ligne
 * - Pont de lecture de tuiles, parcours et graphe de routage pour le guidage hors ligne (N01 <-> N02)
 */

export * from './types';
export * from './integrity';
export * from './packManager';
export * from './regionsAndCoverage';
export * from './poiAndNavigationBridge';
export * from './nativeShortcuts';
