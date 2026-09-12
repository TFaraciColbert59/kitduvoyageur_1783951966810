/**
 * Phase 10 — Corrélation de bout en bout.
 *
 * Contrat d'entrée : tout appelant PEUT fournir un `correlation_id` existant
 *   - en en-tête `x-correlation-id` (transport), ou
 *   - dans le corps (`correlationId`, continuité de chaîne Phase 2/3).
 * Priorité : corps > en-tête > génération. Une valeur invalide (non-UUID) est
 * refusée SANS être journalisée telle quelle (elle peut contenir du PII) et un
 * identifiant neuf est généré : jamais d'identifiant inventé à partir d'une
 * entrée douteuse, jamais de requête cassée pour un en-tête mal formé.
 *
 * Module pur (aucune dépendance Next) : testable et utilisable routes, server
 * actions et workers.
 */

/** En-tête HTTP canonique de corrélation (transport). */
export const CORRELATION_ID_HEADER = 'x-correlation-id';

/** UUID canonique (toutes versions, casse indifférente). */
export const CORRELATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Origine d'un `correlation_id` résolu. */
export type CorrelationSource = 'body' | 'header' | 'generated';

export interface CorrelationResolution {
  /** Identifiant toujours valide (UUID) — jamais null. */
  correlationId: string;
  /** D'où provient l'identifiant retenu. */
  source: CorrelationSource;
  /** Un `correlationId` de corps non-UUID a été refusé (pas sa valeur). */
  bodyRejected: boolean;
  /** Un en-tête `x-correlation-id` non-UUID a été refusé (pas sa valeur). */
  headerRejected: boolean;
}

/** Vrai si la valeur est un UUID de corrélation valide. */
export function isCorrelationId(value: unknown): value is string {
  return typeof value === 'string' && CORRELATION_ID_PATTERN.test(value);
}

/** Retourne l'identifiant valide ou `null` (ne jette jamais). */
export function sanitizeCorrelationId(value: unknown): string | null {
  return isCorrelationId(value) ? value : null;
}

/**
 * Lecture défensive d'un en-tête : accepte `Headers`, `NextRequest` ou tout
 * objet exposant `headers.get`. Ne lève jamais.
 */
export interface HeaderReader {
  headers: { get(name: string): string | null };
}

export function readCorrelationId(source: HeaderReader | null | undefined): string | null {
  try {
    return sanitizeCorrelationId(source?.headers?.get(CORRELATION_ID_HEADER) ?? null);
  } catch {
    return null;
  }
}

/** Générateur UUID par défaut (Web Crypto, présent Node 18+ et navigateurs). */
function defaultGenerate(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Repli mathématique : ne sert qu'en environnement sans Web Crypto.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

/**
 * Résout le `correlation_id` d'une requête : corps (chaîne) > en-tête
 * (transport) > génération. Les entrées invalides sont signalées par les
 * booléens `*Rejected` sans jamais être recopiées.
 */
export function resolveCorrelationId(input: {
  header?: unknown;
  body?: unknown;
  generate?: () => string;
}): CorrelationResolution {
  const generate = input.generate ?? defaultGenerate;
  const bodyId = sanitizeCorrelationId(input.body);
  if (bodyId) {
    return { correlationId: bodyId, source: 'body', bodyRejected: false, headerRejected: false };
  }
  const headerId = sanitizeCorrelationId(input.header);
  if (headerId) {
    return {
      correlationId: headerId,
      source: 'header',
      bodyRejected: input.body != null,
      headerRejected: false,
    };
  }
  return {
    correlationId: generate(),
    source: 'generated',
    bodyRejected: input.body != null,
    headerRejected: input.header != null,
  };
}

/** En-têtes de réponse à renvoyer au client pour poursuivre la chaîne. */
export function correlationResponseHeaders(correlationId: string): Record<string, string> {
  return { [CORRELATION_ID_HEADER]: correlationId };
}
