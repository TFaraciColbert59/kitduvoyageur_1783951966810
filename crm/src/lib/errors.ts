/**
 * Erreurs du CRM : un code stable, une phrase française, un statut HTTP.
 * Règle : aucun code PostgreSQL, aucune pile, aucun SQL ne sort de la route.
 * La base lève `raise exception '<phrase>' using hint='<marker>'` : on traduit
 * sur le `hint` (contrat backend/base-de-donnees), jamais sur le message.
 */

export type ApiErrorCode =
  | 'unauthenticated'
  | 'mfa_required'
  | 'not_allowed'
  | 'agent_not_allowed'
  | 'staff_only'
  | 'role_too_low'
  | 'agent_cannot_validate'
  | 'self_approval'
  | 'solo_required'
  | 'invalid_body'
  | 'invalid_json'
  | 'invalid_params'
  | 'unknown_command'
  | 'domain_pending'
  | 'command_disabled'
  | 'reason_required'
  | 'request_pending'
  | 'not_pending'
  | 'request_expired'
  | 'fingerprint_mismatch'
  | 'conflict'
  | 'not_found'
  | 'rpc_failed'
  | 'rate_limited'
  | 'agent_stopped'
  | 'agent_paused'
  | 'undo_expired'
  | 'undo_not_allowed'
  | 'agent_token_missing'
  | 'agent_token_invalid'
  | 'agent_unknown'
  | 'agent_token_unavailable'
  | 'tool_not_allowed'
  | 'tool_argument_invalid'
  | 'brick_disabled'
  | 'stripe_unavailable'
  | 'stripe_test_only'
  | 'email_unavailable'
  | 'cron_secret_missing'
  | 'cron_secret_invalid'
  | 'external_failed'
  | 'method_not_allowed'
  | 'payload_too_large'
  | 'server_error';

/** Phrase affichée à l'écran. Toujours en français, jamais technique. */
const MESSAGES: Record<ApiErrorCode, string> = {
  unauthenticated: 'Votre session a expiré. Reconnectez-vous.',
  mfa_required: 'La double authentification est obligatoire pour cette action.',
  not_allowed: 'Votre rôle ne permet pas cette action.',
  agent_not_allowed: 'Cet agent n’a pas le droit de lancer cette commande.',
  staff_only: 'Cette action est réservée à l’équipe.',
  role_too_low: 'Votre rôle est insuffisant pour cette action.',
  agent_cannot_validate: 'Un agent ne valide jamais une demande : une personne décide.',
  self_approval: 'Vous ne pouvez pas valider votre propre demande hors mode solo.',
  solo_required: 'Cette action en deux temps n’est possible qu’en mode solo.',
  invalid_body: 'La requête est mal formée.',
  invalid_json: 'Le contenu envoyé n’est pas du JSON valide.',
  invalid_params: 'Les informations transmises ne sont pas valides.',
  unknown_command: 'Cette commande n’existe pas.',
  domain_pending: 'Cette commande est enregistrée mais son effet métier n’est pas encore branché. Rien n’a été appliqué.',
  command_disabled: 'Cette commande est désactivée par un réglage.',
  reason_required: 'Un motif est obligatoire pour cette action.',
  request_pending: 'Cette action attend la validation d’une seconde personne.',
  not_pending: 'Cette demande n’est plus en attente.',
  request_expired: 'Cette demande a expiré : elle ne peut plus être validée.',
  fingerprint_mismatch: 'Les paramètres ont changé depuis la demande : elle ne peut plus être validée.',
  conflict: 'L’élément a changé entre-temps. Rechargez puis réessayez.',
  rpc_failed: 'La base n’a pas pu répondre. Réessayez dans un instant.',
  not_found: 'L’élément demandé n’existe pas ou n’est plus accessible.',
  rate_limited: 'Trop de requêtes. Réessayez dans un instant.',
  agent_stopped: 'Cet agent est arrêté.',
  agent_paused: 'Cet agent est en pause.',
  undo_expired: 'Le délai d’annulation de 10 secondes est écoulé.',
  undo_not_allowed: 'Cette action ne peut pas être annulée.',
  agent_token_missing: 'Jeton d’agent absent.',
  agent_token_invalid: 'Jeton d’agent invalide ou expiré.',
  agent_unknown: 'Cet agent n’est pas reconnu.',
  agent_token_unavailable: 'Le jeton de service de l’agent est indisponible. Agent refusé par prudence.',
  tool_not_allowed: 'Cet outil n’est pas dans la liste autorisée de l’agent.',
  tool_argument_invalid: 'Les arguments de l’outil ne sont pas valides.',
  brick_disabled: 'Cette brique est désactivée faute de configuration.',
  stripe_unavailable: 'Stripe n’est pas configuré : le remboursement reste à faire par une personne dans Stripe.',
  stripe_test_only: 'Le CRM refuse toute clé Stripe de production. Seul le mode test est autorisé ici.',
  email_unavailable: 'L’e-mail n’est pas configuré : l’alerte reste dans le CRM.',
  cron_secret_missing: 'Le secret des tâches planifiées est absent : tâche refusée.',
  cron_secret_invalid: 'Jeton de tâche planifiée absent ou invalide.',
  external_failed: 'L’appel externe a échoué. Aucun second envoi ne sera fait automatiquement : réessayez à la main.',
  method_not_allowed: 'Méthode non autorisée.',
  payload_too_large: 'La requête est trop volumineuse.',
  server_error: 'Une erreur interne est survenue. L’incident est journalisé.'
};

/** Statut HTTP associé. */
const STATUS: Record<ApiErrorCode, number> = {
  unauthenticated: 401,
  mfa_required: 403,
  not_allowed: 403,
  agent_not_allowed: 403,
  staff_only: 403,
  role_too_low: 403,
  agent_cannot_validate: 403,
  self_approval: 403,
  solo_required: 403,
  invalid_body: 400,
  invalid_json: 400,
  invalid_params: 422,
  unknown_command: 400,
  domain_pending: 409,
  command_disabled: 409,
  reason_required: 400,
  request_pending: 409,
  not_pending: 409,
  request_expired: 410,
  fingerprint_mismatch: 409,
  conflict: 409,
  rpc_failed: 500,
  not_found: 404,
  rate_limited: 429,
  agent_stopped: 409,
  agent_paused: 409,
  undo_expired: 410,
  undo_not_allowed: 409,
  agent_token_missing: 401,
  agent_token_invalid: 401,
  agent_unknown: 401,
  agent_token_unavailable: 503,
  tool_not_allowed: 403,
  tool_argument_invalid: 422,
  brick_disabled: 503,
  stripe_unavailable: 503,
  stripe_test_only: 403,
  email_unavailable: 503,
  cron_secret_missing: 401,
  cron_secret_invalid: 401,
  external_failed: 502,
  method_not_allowed: 405,
  payload_too_large: 413,
  server_error: 500
};

export const API_ERROR_CODES = Object.keys(MESSAGES) as ApiErrorCode[];

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  /** Détails sûrs (chemins de champs, pas de valeur sensible). */
  readonly issues?: { path: string; message: string }[];

  constructor(code: ApiErrorCode, issues?: { path: string; message: string }[]) {
    super(MESSAGES[code]);
    this.name = 'ApiError';
    this.code = code;
    this.status = STATUS[code];
    this.issues = issues;
  }
}

export function apiError(code: ApiErrorCode, issues?: { path: string; message: string }[]): ApiError {
  return new ApiError(code, issues);
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

export function messageFor(code: ApiErrorCode): string {
  return MESSAGES[code];
}

export function statusFor(code: ApiErrorCode): number {
  return STATUS[code];
}

/** Marqueurs levés par la base (`hint`). Toute autre valeur est ignorée. */
const HINT_MARKERS: readonly ApiErrorCode[] = [
  'not_allowed',
  'mfa_required',
  'agent_not_allowed',
  'agent_cannot_validate',
  'staff_only',
  'role_too_low',
  'reason_required',
  'invalid_params',
  'unknown_command',
  'domain_pending',
  'not_found',
  'conflict',
  'fingerprint_mismatch',
  'not_pending',
  'request_expired',
  'self_approval',
  'undo_expired',
  'undo_not_allowed',
  'rate_limited',
  'agent_stopped',
  'agent_paused',
  'solo_required',
  'command_disabled'
];

/** Traduit un `hint` PostgreSQL en code métier ; renvoie null si inconnu. */
export function codeFromHint(hint: unknown): ApiErrorCode | null {
  if (typeof hint !== 'string') return null;
  const cleaned = hint.trim().toLowerCase();
  return (HINT_MARKERS as readonly string[]).includes(cleaned) ? (cleaned as ApiErrorCode) : null;
}

type DbErrorLike = {
  code?: string | null;
  message?: string | null;
  hint?: string | null;
  details?: string | null;
};

/** Traduction d'une erreur PostgREST/Postgres. Ne lit jamais le message pour un code métier. */
export function translateDbError(error: unknown): ApiError {
  if (isApiError(error)) return error;
  const err = (error ?? {}) as DbErrorLike;
  const fromHint = codeFromHint(err.hint);
  if (fromHint) return apiError(fromHint);

  switch (err.code) {
    case '42501':
      return apiError('not_allowed');
    case 'PGRST116':
      return apiError('not_found');
    case 'P0002':
      return apiError('not_found');
    case '22023':
      return apiError('invalid_params');
    case '53400':
      return apiError('rate_limited');
    case '40001':
      return apiError('conflict');
    case '0A000':
      return apiError('unknown_command');
    case 'PGRST301':
      return apiError('unauthenticated');
    default:
      return apiError('server_error');
  }
}

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    request_ref: string;
    issues?: { path: string; message: string }[];
  };
  request_ref: string;
};

/** Corps JSON renvoyé au navigateur ou au client MCP. */
export function errorBody(error: ApiError, requestRef: string): ApiErrorBody {
  return {
    error: {
      code: error.code,
      message: error.message,
      request_ref: requestRef,
      ...(error.issues && error.issues.length ? { issues: error.issues } : {})
    },
    request_ref: requestRef
  };
}

const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const STRIPE_PATTERN = /(sk|pk|rk)_(test|live)_[A-Za-z0-9]+/g;
const SUPABASE_PATTERN = /sb_[a-z]+_[A-Za-z0-9_-]{8,}/g;
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Masque secrets et données personnelles avant tout journal. */
export function redact(text: string): string {
  return text
    .replace(JWT_PATTERN, '[jeton masqué]')
    .replace(BEARER_PATTERN, 'Bearer [masqué]')
    .replace(STRIPE_PATTERN, '[clé stripe masquée]')
    .replace(SUPABASE_PATTERN, '[clé supabase masquée]')
    .replace(EMAIL_PATTERN, '[e-mail masqué]');
}

export type ServerLog = {
  level: 'info' | 'warn' | 'error';
  scope: 'crm';
  event: string;
  request_ref?: string;
  code?: ApiErrorCode;
  pg_code?: string | null;
  hint?: string | null;
  message?: string;
  duration_ms?: number;
};

/**
 * Journal serveur structuré, sans secret ni donnée personnelle.
 * Jamais de `console.log` du message brut : uniquement la version masquée.
 */
export function logServer(entry: ServerLog): void {
  const payload = {
    ...entry,
    message: entry.message ? redact(String(entry.message)).slice(0, 500) : undefined
  };
  const line = JSON.stringify(payload);
  if (entry.level === 'error') console.error(line);
  else if (entry.level === 'warn') console.warn(line);
  else console.info(line);
}

/** Journalise une erreur inconnue sans exposer de contenu brut. */
export function logUnknownError(event: string, error: unknown, requestRef?: string): void {
  const err = (error ?? {}) as DbErrorLike;
  logServer({
    level: 'error',
    scope: 'crm',
    event,
    request_ref: requestRef,
    code: isApiError(error) ? error.code : undefined,
    pg_code: typeof err.code === 'string' ? err.code : null,
    hint: typeof err.hint === 'string' ? err.hint : null,
    message: typeof err.message === 'string' ? err.message : String(error)
  });
}
