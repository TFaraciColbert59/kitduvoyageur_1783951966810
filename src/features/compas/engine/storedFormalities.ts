/**
 * Compas — la dépense « Formalités » qu'une préparation D'AVANT le lot Z1 a rangée sur le voyage.
 *
 * VIE PRIVÉE (PLAN-100 4.1) : chiffrée pour un ressortissant français, cette dépense (« Formalités :
 * ESTA (40 $) ») dit la nationalité du lanceur à tous les lecteurs du voyage ; la préparation ne la
 * range plus, la ligne de chaque lecteur est calculée à la lecture (`engine/formalities.ts`). Les
 * voyages déjà préparés la portent encore : l'affichage la retire, jusqu'au rattrapage de la base.
 *
 * Module pur, sans dépendance (la lecture des voyages de `lib/` l'importe aussi, pour que le Compas et
 * `/voyages` comptent la même chose).
 *
 * Ce qui la reconnaît (et seulement cela) :
 *  - son titre commence par « Formalités : » et la préparation l'a signée (`metadata.autofill`, une
 *    dépense saisie à la main n'en a pas), QUELLE QUE SOIT sa base : les préparations successives ont
 *    écrit des bases différentes, filtrer sur l'une d'elles laissait passer les autres ;
 *  - elle est encore PLANIFIÉE (`is_planned`) ;
 *  - elle est INTACTE : personne ne l'a modifiée depuis sa création. Réglée, ou retouchée par la
 *    personne, c'est devenu SA dépense : elle compte comme n'importe quelle autre, dans le Compas
 *    comme dans `/voyages`.
 */

/** Marge entre création et dernière écriture, comme `untouchedSince` (écritures de la même passe). */
const UNTOUCHED_MARGIN_MS = 5_000;

export interface StorableExpense {
  title: string;
  metadata?: Record<string, unknown> | null;
  /** Prévue (vrai) ou déjà réglée. Absent ou faux : réglée, donc jamais retirée. */
  is_planned?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/**
 * Modifiée depuis sa création : les deux dates sont lisibles et la dernière écriture dépasse la marge.
 * Une date absente ou illisible ne prouve rien : la dépense reste « intacte » (l'oublier ferait
 * apparaître la nationalité).
 */
function editedSinceCreation(e: StorableExpense): boolean {
  if (!e.created_at || !e.updated_at) return false;
  const created = Date.parse(e.created_at);
  const updated = Date.parse(e.updated_at);
  return (
    Number.isFinite(created) && Number.isFinite(updated) && updated > created + UNTOUCHED_MARGIN_MS
  );
}

export function isStoredFormalities(expense: StorableExpense): boolean {
  return (
    expense.title.startsWith('Formalités : ') &&
    typeof expense.metadata?.autofill === 'string' &&
    expense.is_planned === true &&
    !editedSinceCreation(expense)
  );
}

/** Les dépenses du voyage sans la ligne « Formalités » rangée par une ancienne préparation. */
export function withoutStoredFormalities<T extends StorableExpense>(expenses: readonly T[]): T[] {
  return expenses.filter((e) => !isStoredFormalities(e));
}
