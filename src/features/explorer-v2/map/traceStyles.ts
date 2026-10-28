/**
 * Styles de tracés de l'Explorer v2 (04_CARTE.md §2).
 *
 * Source unique des 13 styles. `MapStage` les traduit en expressions
 * MapLibre (`match` sur la propriété `style` de chaque tracé), ce qui évite
 * 13 couches distinctes et garde un seul rendu cohérent.
 */

export type TraceStyleId =
  | 'itineraire'
  | 'parcouru'
  | 'position'
  | 'sens'
  | 'gr'
  | 'pr'
  | 'variante'
  | 'ami'
  | 'eau'
  | 'neige'
  | 'danger'
  | 'survol'
  | 'pente';

export interface TraceStyle {
  id: TraceStyleId;
  /** Couleur de la ligne. */
  color: string;
  width: number;
  /** Contour blanc sous la ligne (lisibilité sur relief). */
  casing: string | null;
  casingWidth: number;
  dash?: [number, number];
  opacity: number;
  /** Ordre de dessin : plus petit = au-dessus. */
  order: number;
}

export const TRACE_STYLES: Record<TraceStyleId, TraceStyle> = {
  // « Itinéraire prévu » : casing blanc 7 px + ligne 4 px, toujours au-dessus.
  itineraire: { id: 'itineraire', color: '#17402C', width: 4, casing: '#FFFFFF', casingWidth: 7, opacity: 1, order: 0 },
  parcouru: { id: 'parcouru', color: '#C9D3CC', width: 4, casing: null, casingWidth: 0, opacity: 1, order: 1 },
  position: { id: 'position', color: '#17402C', width: 2.4, casing: '#FFFFFF', casingWidth: 9, opacity: 1, order: 0 },
  sens: { id: 'sens', color: '#FFFFFF', width: 2, casing: null, casingWidth: 0, opacity: 1, order: 0 },
  gr: { id: 'gr', color: '#C0392B', width: 3.4, casing: '#FFFFFF', casingWidth: 6, dash: [2, 1.4], opacity: 1, order: 2 },
  pr: { id: 'pr', color: '#E0B33A', width: 3.4, casing: '#FFFFFF', casingWidth: 6, dash: [2, 1.4], opacity: 1, order: 2 },
  variante: { id: 'variante', color: '#5B7F55', width: 2.6, casing: null, casingWidth: 0, dash: [1.2, 1], opacity: 1, order: 3 },
  ami: { id: 'ami', color: '#5B7F55', width: 3, casing: null, casingWidth: 0, opacity: 0.7, order: 3 },
  eau: { id: 'eau', color: '#2F6F78', width: 3.4, casing: '#FFFFFF', casingWidth: 6, opacity: 1, order: 2 },
  neige: { id: 'neige', color: '#7FB3C8', width: 3, casing: null, casingWidth: 0, dash: [0.6, 1.4], opacity: 1, order: 2 },
  danger: { id: 'danger', color: '#A8443A', width: 3.6, casing: null, casingWidth: 0, dash: [1.6, 1.1], opacity: 1, order: 1 },
  survol: { id: 'survol', color: '#E9C46A', width: 4.4, casing: '#FFFFFF', casingWidth: 7, opacity: 1, order: 0 },
  pente: { id: 'pente', color: '#7FA27A', width: 4, casing: null, casingWidth: 0, opacity: 1, order: 2 },
};

/** Style de tracé déduit du réseau OSM d'un itinéraire. */
export function traceStyleForRoute(network: string | null | undefined): TraceStyleId {
  switch ((network ?? '').toLowerCase()) {
    case 'iwn':
    case 'nwn':
      return 'gr';
    case 'rwn':
      return 'pr';
    case 'lwn':
      return 'variante';
    default:
      return 'itineraire';
  }
}

/** Expression MapLibre de couleur pour la couche `xp-routes`. */
export const TRACE_COLOR_EXPRESSION: unknown = [
  'match',
  ['get', 'style'],
  'gr',
  TRACE_STYLES.gr.color,
  'pr',
  TRACE_STYLES.pr.color,
  'variante',
  TRACE_STYLES.variante.color,
  'ami',
  TRACE_STYLES.ami.color,
  'eau',
  TRACE_STYLES.eau.color,
  'neige',
  TRACE_STYLES.neige.color,
  'danger',
  TRACE_STYLES.danger.color,
  'survol',
  TRACE_STYLES.survol.color,
  TRACE_STYLES.itineraire.color,
];

/** Expression MapLibre d'épaisseur. */
export const TRACE_WIDTH_EXPRESSION: unknown = [
  'match',
  ['get', 'style'],
  'gr',
  TRACE_STYLES.gr.width,
  'pr',
  TRACE_STYLES.pr.width,
  'variante',
  TRACE_STYLES.variante.width,
  'eau',
  TRACE_STYLES.eau.width,
  'neige',
  TRACE_STYLES.neige.width,
  'danger',
  TRACE_STYLES.danger.width,
  'survol',
  TRACE_STYLES.survol.width,
  TRACE_STYLES.itineraire.width,
];

/** Expression MapLibre de pointillé (vide = ligne pleine). */
export const TRACE_DASH_EXPRESSION: unknown = [
  'match',
  ['get', 'style'],
  'gr',
  ['literal', TRACE_STYLES.gr.dash],
  'pr',
  ['literal', TRACE_STYLES.pr.dash],
  'variante',
  ['literal', TRACE_STYLES.variante.dash],
  'neige',
  ['literal', TRACE_STYLES.neige.dash],
  'danger',
  ['literal', TRACE_STYLES.danger.dash],
  ['literal', [1, 0]],
];
