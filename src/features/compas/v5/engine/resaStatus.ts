/**
 * Compas v5 : « J'ai réservé » rangé par élément (fonctions pures).
 *
 * Le statut vit dans `trips.metadata.compas.resa[<clé>] = { status, at }`. Clés stables : `night:<jour>`
 * pour la nuit d'un jour, `transport` pour le trajet d'approche, `extra:<ligne>` pour les autres lignes du
 * plan (`engine/resaPlan.ts` : assurance, location, forfait…). Lecture défensive : une valeur illisible
 * est ignorée, jamais devinée ; un élément sans entrée est « à faire ». `skipped` : « Pas besoin », la
 * ligne est masquée.
 */

export type ResaStatus = 'booked' | 'todo' | 'skipped';

export interface ResaRecord {
  status: ResaStatus;
  /** Instant de l'écriture (ISO). */
  at: string;
}

/** `night:1` à `night:60`, `transport`, ou `extra:<ligne>` (minuscules, chiffres, tirets, 40 caractères au plus). */
export const RESA_KEY = /^(?:night:(?:[1-9]|[1-5]\d|60)|transport|extra:[a-z][a-z0-9-]{0,39})$/;

export const nightKey = (day: number): string => `night:${day}`;
export const TRANSPORT_KEY = 'transport';
export const extraKey = (line: string): string => `extra:${line}`;

const STATUSES: readonly ResaStatus[] = ['booked', 'todo', 'skipped'];

export const isResaKey = (key: unknown): key is string => typeof key === 'string' && RESA_KEY.test(key);

/** Le statut rangé sur le voyage, lu avec prudence (les éditeurs d'un voyage peuvent écrire `metadata`). */
export function parseResa(raw: unknown): Record<string, ResaRecord> {
  const out: Record<string, ResaRecord> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isResaKey(key) || !value || typeof value !== 'object' || Array.isArray(value)) continue;
    const v = value as Record<string, unknown>;
    if (typeof v.status !== 'string' || !STATUSES.includes(v.status as ResaStatus)) continue;
    out[key] = { status: v.status as ResaStatus, at: typeof v.at === 'string' ? v.at.slice(0, 40) : '' };
  }
  return out;
}

type Statuses = Readonly<Record<string, ResaStatus | ResaRecord>>;

const statusOf = (v: ResaStatus | ResaRecord | undefined): ResaStatus | null => (v == null ? null : typeof v === 'string' ? v : v.status);

/** Cet élément est-il noté comme réservé ? */
export const isResaBooked = (resa: Statuses | null | undefined, key: string): boolean => statusOf(resa?.[key]) === 'booked';

/** Cet élément est-il noté « pas besoin » (ligne masquée) ? */
export const isResaSkipped = (resa: Statuses | null | undefined, key: string): boolean => statusOf(resa?.[key]) === 'skipped';

/**
 * Statuts rangés + gestes faits sur cet écran (mise à jour optimiste) : `null` retire l'entrée, un statut la remplace.
 * Rendu : le statut de chaque élément qui en a un.
 */
export function mergeResa(base: Statuses | null | undefined, overlay: Readonly<Record<string, ResaStatus | null>>): Record<string, ResaStatus> {
  const out: Record<string, ResaStatus> = {};
  for (const [key, value] of Object.entries(base ?? {})) {
    const s = statusOf(value);
    if (s) out[key] = s;
  }
  for (const [key, value] of Object.entries(overlay)) {
    if (value) out[key] = value;
    else delete out[key];
  }
  return out;
}
