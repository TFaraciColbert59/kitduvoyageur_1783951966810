/**
 * Journalisation client (P9-09).
 *
 * Règle produit : une erreur journalisée ne doit jamais contenir de coordonnées
 * précises, ni d'identifiant de session, ni de jeton. On arrondit les positions
 * au degré (≈ 100 km) et on retire les clés sensibles.
 */

const SENSITIVE_KEYS =
  /^(lat|lng|latitude|longitude|position|coords|token|access_token|authorization|email|phone|sessionid|session_id|user_id)$/i;

/** Arrondit une coordonnée au degré : jamais de position exploitable en log. */
export function blurCoordinate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

export function sanitizeLogContext(input: unknown, depth = 0): unknown {
  if (depth > 3) return '[tronqué]';
  if (input === null || input === undefined) return input;
  if (typeof input === 'number' || typeof input === 'boolean') return input;
  if (typeof input === 'string') return input.slice(0, 200);
  if (Array.isArray(input)) return input.slice(0, 10).map((item) => sanitizeLogContext(item, depth + 1));
  if (typeof input === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.test(key)) {
        output[key] = typeof value === 'number' ? blurCoordinate(value) : '[masqué]';
        continue;
      }
      output[key] = sanitizeLogContext(value, depth + 1);
    }
    return output;
  }
  return '[non sérialisable]';
}

/** Journalise une erreur client nettoyée. */
export function logClientError(message: string, context?: unknown): void {
  const payload = {
    message: message.slice(0, 300),
    context: sanitizeLogContext(context),
    at: new Date().toISOString(),
  };
  console.error('[explorer-v2]', JSON.stringify(payload));
}
