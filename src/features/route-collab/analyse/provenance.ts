/**
 * Source et fraîcheur de chaque donnée de l'onglet Analyser (7.9).
 * Règle « rien d'inventé » : une valeur affichée porte sa source et sa date (ou « date inconnue »),
 * jamais l'un sans l'autre. Les composants posent `data-source` et `data-source-at` ; un test balaie l'onglet.
 */
export interface Provenance {
  /** Nom lisible de la source (« MET Norway », « Calcul LKDV · tracé »). */
  readonly source: string;
  /** Date ISO de la donnée (relevé, calcul, observation) ; `null` quand la source ne la donne pas. */
  readonly at: string | null;
}

export const UNKNOWN_DATE = 'date inconnue';

export const SOURCE_PLAN = 'Calcul LKDV · tracé du plan';
export const SOURCE_EFFORT = 'Moteur d’effort LKDV (effort-score-v1)';
export const SOURCE_DIFFICULTY = 'Difficulté LKDV (lkdv-route-difficulty/1)';
export const SOURCE_SUN = 'Calcul astronomique NOAA';
export const SOURCE_WEATHER = 'MET Norway (CC BY 4.0)';

export function isIsoDate(value: string | null | undefined): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

/** Attributs posés sur chaque valeur affichée. */
export function dataSourceAttrs(p: Provenance): { 'data-source': string; 'data-source-at': string } {
  return {
    'data-source': p.source,
    'data-source-at': isIsoDate(p.at) ? p.at : UNKNOWN_DATE,
  };
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

/** « 22/11/2026 » ou « date inconnue ». */
export function formatProvenanceDate(at: string | null | undefined): string {
  return isIsoDate(at) ? dateFmt.format(new Date(at)) : UNKNOWN_DATE;
}

/** « MET Norway · 22/11/2026 » : la ligne de source visible en vue experte. */
export function provenanceLine(p: Provenance): string {
  return `${p.source} · ${formatProvenanceDate(p.at)}`;
}
