'use client';

/**
 * Lecture tolérante de l'enveloppe admin `{ok,data,correlationId}`.
 * Accepte aussi les payloads pré-enveloppe (compat ascendante).
 */

/** Extrait `data` de l'enveloppe (ou le payload legacy tel quel). */
export function unwrapData<T>(j: unknown): T | null {
  if (!j || typeof j !== 'object') return null;
  const o = j as Record<string, unknown>;
  if ('data' in o) return (o.data ?? null) as T | null;
  return o as T;
}

/** Message d'erreur lisible : `{error:{message}}` nouveau, `{error:string}` legacy. */
export function errorMessage(j: unknown, fallback: string): string {
  if (j && typeof j === 'object') {
    const e = (j as Record<string, unknown>).error;
    if (typeof e === 'string' && e) return e;
    if (e && typeof e === 'object') {
      const m = (e as Record<string, unknown>).message;
      if (typeof m === 'string' && m) return m;
    }
  }
  return fallback;
}
