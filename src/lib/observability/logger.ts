/**
 * Phase 10 — Logs structurés (JSON) sans données sensibles.
 *
 * Chaque ligne est un objet JSON : horodatage, niveau, service, événement,
 * `correlation_id`, latence, statut et champs contextuels **rédigés**.
 *
 * Rédaction (avant sérialisation, jamais après) :
 *   - clés sensibles (secret, token, mot de passe, cookie, clé API, session…)
 *     → valeur entièrement remplacée ;
 *   - clés e-mail → remplacées ;
 *   - clés PII (nom, téléphone, adresse…) → remplacées ;
 *   - clés GPS (lat/lng/lon/latitude/longitude/coordonnées) → précision
 *     réduite à 1 décimale (~11 km) : exploitable sans localiser une personne ;
 *   - motifs sensibles dans toute chaîne : e-mails, JWT, `Bearer`, clés Stripe
 *     `sk_/pk_/rk_`, clés Supabase `sb*_`, numéros internationaux `+…`.
 *
 * Le module est pur et sans dépendance (sink injectable) : les tests
 * vérifient qu'un e-mail ou un token ne sort jamais tel quel.
 */

export const REDACTED = '[redacted]';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Clés dont la valeur n'est jamais sérialisée. */
const SECRET_KEY_PATTERN =
  /(pass\s?word|secret|token|api[_-]?key|apikey|authorization|cookie|jwt|bearer|private[_-]?key|service[_-]?role|vapid|signature|stripe[_-]?key|webhook[_-]?(key|secret)|signing[_-]?key|encryption[_-]?key)/i;
const EMAIL_KEY_PATTERN = /e[-_]?mail|mail/i;
const PII_KEY_PATTERN =
  /(phone|t[ée]l[ée]phone|full[_-]?name|first[_-]?name|last[_-]?name|address|adresse|postal|ssn|birth|birthday)/i;
const GPS_KEY_PATTERN = /(^|[_.-])(lat|lng|lon|latitude|longitude|gps|coords?|coordinates?)([_.-]|$)/i;

/** Motifs recherchés dans les valeurs texte (toute clé). */
const EMAIL_VALUE_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const JWT_VALUE_PATTERN = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g;
const BEARER_VALUE_PATTERN = /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const STRIPE_KEY_PATTERN = /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]+/g;
const SUPABASE_KEY_PATTERN = /\bsb[a-z]?_[A-Za-z0-9_-]{16,}/g;
const PHONE_VALUE_PATTERN = /\+[1-9]\d{6,14}\b/g;

/** Garde-fous anti-explosion (structures profondes ou cycliques). */
const MAX_DEPTH = 6;
const MAX_ARRAY_ITEMS = 50;

/** Rédaction d'une chaîne : motifs sensibles remplacés, le reste conservé. */
export function redactString(value: string): string {
  return value
    .replace(EMAIL_VALUE_PATTERN, '[redacted:email]')
    .replace(JWT_VALUE_PATTERN, '[redacted:token]')
    .replace(BEARER_VALUE_PATTERN, 'Bearer [redacted]')
    .replace(STRIPE_KEY_PATTERN, '[redacted:token]')
    .replace(SUPABASE_KEY_PATTERN, '[redacted:token]')
    .replace(PHONE_VALUE_PATTERN, '[redacted:phone]');
}

/** Précision GPS réduite à 1 décimale (nombre uniquement). */
function roundCoordinate(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : value;
}

function redactKeyValue(key: string, value: unknown): unknown {
  if (SECRET_KEY_PATTERN.test(key)) return '[redacted:secret]';
  if (EMAIL_KEY_PATTERN.test(key)) return '[redacted:email]';
  if (PII_KEY_PATTERN.test(key)) return '[redacted:pii]';
  if (GPS_KEY_PATTERN.test(key)) {
    if (typeof value === 'number') return roundCoordinate(value);
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
      return roundCoordinate(Number(value));
    }
  }
  return undefined;
}

/**
 * Rédige récursivement une valeur. Fonction pure : l'entrée n'est pas mutée.
 * Les cycles sont tronqués par la limite de profondeur.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (depth > MAX_DEPTH) return '[truncated]';
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function' || typeof value === 'symbol') return '[unserializable]';
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message) };
  }
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => redact(item, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) items.push('[truncated]');
    return items;
  }
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const replaced = redactKeyValue(key, entry);
      output[key] = replaced === undefined ? redact(entry, depth + 1) : replaced;
    }
    return output;
  }
  return '[unserializable]';
}

/** Champs réservés du format de log — toujours sûrs, jamais rédigés. */
const RESERVED_FIELDS = new Set([
  'ts',
  'level',
  'service',
  'event',
  'correlation_id',
  'latency_ms',
  'status',
]);

/** Rédige un objet de champs, en préservant les champs réservés du format. */
export function redactFields(fields: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(fields)) {
    if (RESERVED_FIELDS.has(key)) {
      output[key] = entry;
      continue;
    }
    const replaced = redactKeyValue(key, entry);
    output[key] = replaced === undefined ? redact(entry) : replaced;
  }
  return output;
}

export interface StructuredLogRecord {
  ts: string;
  level: LogLevel;
  service: string;
  event: string;
  correlation_id?: string | null;
  latency_ms?: number;
  status?: number;
  [key: string]: unknown;
}

export type LogSink = (record: StructuredLogRecord) => void;

/**
 * Sink par défaut : une ligne JSON par événement. Silencieux sous NODE_ENV=test
 * (sauf OBSERVABILITY_LOG=1) pour ne pas polluer les suites de tests ; les
 * tests du logger injectent leur propre sink.
 */
export function defaultLogSink(record: StructuredLogRecord): void {
  if (process.env.NODE_ENV === 'test' && process.env.OBSERVABILITY_LOG !== '1') return;
  const line = JSON.stringify(record);
  if (record.level === 'error') console.error(line);
  else if (record.level === 'warn') console.warn(line);
  else console.info(line);
}

export interface LoggerOptions {
  service: string;
  level?: LogLevel;
  sink?: LogSink;
  /** Horloge injectable (tests). */
  now?: () => Date;
}

export interface StructuredLogger {
  service: string;
  debug(event: string, fields?: Record<string, unknown>): StructuredLogRecord | null;
  info(event: string, fields?: Record<string, unknown>): StructuredLogRecord | null;
  warn(event: string, fields?: Record<string, unknown>): StructuredLogRecord | null;
  error(event: string, fields?: Record<string, unknown>): StructuredLogRecord | null;
}

/** Construit une ligne de log rédigée (pure, testable). */
export function buildLogRecord(
  input: { service: string; level: LogLevel; event: string; ts: string },
  fields: Record<string, unknown> = {}
): StructuredLogRecord {
  const safe = redactFields(fields);
  return {
    ts: input.ts,
    level: input.level,
    service: input.service,
    event: input.event,
    ...safe,
  };
}

/** Crée un logger structuré (JSON) avec niveau minimal et sink injectables. */
export function createStructuredLogger(options: LoggerOptions): StructuredLogger {
  const level = options.level ?? 'info';
  const sink = options.sink ?? defaultLogSink;
  const now = options.now ?? (() => new Date());

  function emit(
    recordLevel: LogLevel,
    event: string,
    fields: Record<string, unknown> = {}
  ): StructuredLogRecord | null {
    if (LEVEL_ORDER[recordLevel] < LEVEL_ORDER[level]) return null;
    const record = buildLogRecord(
      { service: options.service, level: recordLevel, event, ts: now().toISOString() },
      fields
    );
    sink(record);
    return record;
  }

  return {
    service: options.service,
    debug: (event, fields) => emit('debug', event, fields),
    info: (event, fields) => emit('info', event, fields),
    warn: (event, fields) => emit('warn', event, fields),
    error: (event, fields) => emit('error', event, fields),
  };
}
