/** Phase 4 — types internes du pipeline (non exposés au reste de l'app). */

export interface NormalizeResult<T> {
  items: T[];
  errors: string[];
}
