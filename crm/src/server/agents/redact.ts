import 'server-only';

/**
 * Réduction des sorties d’outil avant de les donner au modèle.
 *
 * Défense en profondeur (en plus de l’allowlist) : même si une commande
 * renvoyait par erreur un document d’identité, une orientation ou des
 * coordonnées, ces clés ne quittent jamais le serveur vers NIM.
 */
const FORBIDDEN_KEYS = new Set([
  'trip_documents',
  'trip_document',
  'documents',
  'document',
  'docs',
  'passport',
  'id_card',
  'identity_document',
  'user_orientation',
  'orientation',
  'private_messages',
  'messages_private',
  'positions',
  'position',
  'coordinates',
  'coordonnees',
  'latitude',
  'longitude',
  'lat',
  'lng',
  'gps',
  'medical',
  'health',
  'health_data',
  'sante'
]);

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE = /(?:\+?\d[\s.-]?){10,15}/g;

const MAX_DEPTH = 6;

export function redactForModel(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[profondeur maximale]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value.replace(EMAIL, '[e-mail masqué]').replace(PHONE, '[téléphone masqué]').slice(0, 4000);
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((entry) => redactForModel(entry, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
        out[key] = '[masqué]';
        continue;
      }
      out[key] = redactForModel(entry, depth + 1);
    }
    return out;
  }
  return String(value);
}
