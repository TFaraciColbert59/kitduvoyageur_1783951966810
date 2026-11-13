/**
 * Contrats communs des analyseurs de parcours (lot R02 · K2.19–K2.24,
 * S2.03, S3.26).
 *
 * Ces modules sont **purs** : aucune lecture base, aucun appel réseau, aucune
 * dépendance DOM. Ils reçoivent une géométrie, un profil ou une série déjà
 * obtenus ailleurs, et rendent un résultat qui dit toujours ce qui est mesuré,
 * calculé, estimé ou absent. Un analyseur ne fabrique jamais une valeur
 * externe (surface, météo, feu) : l'absence devient un état explicite.
 */

export const ROUTE_ANALYSIS_VERSION = 'lkdv-route-analysis/1';

/**
 * Sports réellement modélisés par les analyseurs. Les alias de l'Explorer
 * (`rando`, `velo`) et ceux de l'éditeur R01 (`marche`, `route`, `gravel`,
 * `vtt`, `enduro`) cohabitent volontairement : la conversion se fait ici, pas
 * dans les composants.
 */
export const ANALYSIS_SPORTS = [
  'marche',
  'rando',
  'famille',
  'bivouac',
  'trail',
  'course',
  'velo',
  'route',
  'gravel',
  'vtt',
  'enduro',
  'ski',
  'kayak',
] as const;

export type AnalysisSport = (typeof ANALYSIS_SPORTS)[number];

export function isAnalysisSport(value: unknown): value is AnalysisSport {
  return typeof value === 'string' && (ANALYSIS_SPORTS as readonly string[]).includes(value);
}

/**
 * Un sport non modélisé n'est jamais remplacé par un défaut silencieux :
 * l'appelant reçoit `unavailable` et peut masquer la fonction.
 */
export type AnalysisStatus = 'available' | 'partial' | 'unavailable';

export interface AnalysisGap {
  readonly code: string;
  readonly message: string;
}

export interface AnalysisWarning {
  readonly code: string;
  readonly message: string;
  readonly severity: 'info' | 'warning';
}

/** Provenance d'une donnée externe : source, date de récupération, licence. */
export interface DataProvenance {
  readonly source: string;
  readonly retrievedAt: string | null;
  readonly validUntil?: string | null;
  readonly license?: string | null;
}

/** Point de tracé avec sa distance cumulée depuis le départ (mètres). */
export interface RouteSample {
  readonly lat: number;
  readonly lon: number;
  readonly distanceM: number;
}

/** Point de profil altimétrique ; `elevationM` nul est un trou, jamais zéro. */
export interface ProfileSample {
  readonly distanceM: number;
  readonly elevationM: number | null;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isFinitePositive(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}
