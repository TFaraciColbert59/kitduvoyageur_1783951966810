/**
 * Langage visuel unique du tracé en messagerie : aperçu avant envoi, tiroir
 * d'ouverture (cartes MapLibre sur fond satellite) et vignette de bulle
 * (SVG sur fond forêt sombre). Un trait clair très lisible, bordé de forest,
 * avec un départ creux et une arrivée pleine. Aucune couleur orange.
 */
export const TRACE_STYLE = {
  /** Trait principal. */
  line: '#FFFFFF',
  lineWidth: 4,
  /** Liseré (forest) qui sépare le trait du fond. */
  casing: '#17402C',
  casingWidth: 8,
  /** Départ : disque clair cerclé forest. */
  startFill: '#FFFFFF',
  startRing: '#17402C',
  /** Arrivée : disque forest cerclé de clair. */
  endFill: '#17402C',
  endRing: '#FFFFFF',
  markerRadius: 6.5,
  markerRingWidth: 3,
  /** Fond des vignettes SVG (dégradé forest → encre). */
  thumbFrom: '#1E4A35',
  thumbTo: '#172B24',
} as const;
