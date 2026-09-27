export const BOOKING_PROVIDER_ERROR_CODES = {
  validation: 'validation',
  config: 'config',
  auth: 'auth',
  quota: 'quota',
  timeout: 'timeout',
  upstream: 'upstream',
  unavailable: 'unavailable',
  not_found: 'not_found',
  unknown: 'unknown',
} as const;

export type BookingProviderErrorCode =
  (typeof BOOKING_PROVIDER_ERROR_CODES)[keyof typeof BOOKING_PROVIDER_ERROR_CODES];

export class BookingProviderError extends Error {
  readonly code: BookingProviderErrorCode;
  readonly provider?: string;
  readonly retryable: boolean;
  readonly status?: number;
  /** Non énumérable : la cause ne doit jamais fuiter dans une réponse publique. */
  override readonly cause?: unknown;

  constructor(params: {
    code: BookingProviderErrorCode;
    message: string;
    provider?: string;
    retryable?: boolean;
    status?: number;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = 'BookingProviderError';
    this.code = params.code;
    this.provider = params.provider;
    this.retryable = params.retryable ?? false;
    this.status = params.status;
    if (params.cause !== undefined) {
      Object.defineProperty(this, 'cause', {
        value: params.cause,
        enumerable: false,
        configurable: true,
        writable: false,
      });
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      provider: this.provider,
      retryable: this.retryable,
      ...(this.status !== undefined ? { status: this.status } : {}),
      message: this.message,
    };
  }
}

function readNumericStatus(value: unknown, depth = 0): number | undefined {
  if (depth > 3 || !value || typeof value !== 'object') return undefined;
  if (Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ['status', 'statusCode', 'responseStatus']) {
    const candidate = record[key];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
  }
  for (const key of ['cause', 'error', 'response', 'data']) {
    const nested = readNumericStatus(record[key], depth + 1);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

function statusToCode(status: number): BookingProviderErrorCode {
  if (status === 400 || status === 422) return BOOKING_PROVIDER_ERROR_CODES.validation;
  if (status === 401 || status === 403) return BOOKING_PROVIDER_ERROR_CODES.auth;
  // 402 = compte solvable mais credits epuises : un quota, pas une panne.
  if (status === 402) return BOOKING_PROVIDER_ERROR_CODES.quota;
  if (status === 404) return BOOKING_PROVIDER_ERROR_CODES.not_found;
  if (status === 408 || status === 504) return BOOKING_PROVIDER_ERROR_CODES.timeout;
  if (status === 429) return BOOKING_PROVIDER_ERROR_CODES.quota;
  if (status >= 500) return BOOKING_PROVIDER_ERROR_CODES.upstream;
  return BOOKING_PROVIDER_ERROR_CODES.unknown;
}

export function normalizeBookingProviderError(
  error: unknown,
  provider: string
): BookingProviderError {
  if (error instanceof BookingProviderError) return error;
  const status = readNumericStatus(error);
  if (status && Number.isFinite(status)) {
    const code = statusToCode(status);
    return new BookingProviderError({
      code,
      provider,
      status,
      retryable:
        code === BOOKING_PROVIDER_ERROR_CODES.quota ||
        code === BOOKING_PROVIDER_ERROR_CODES.upstream ||
        code === BOOKING_PROVIDER_ERROR_CODES.timeout,
      message:
        code === BOOKING_PROVIDER_ERROR_CODES.quota
          ? 'Quota fournisseur dépassé.'
          : code === BOOKING_PROVIDER_ERROR_CODES.auth
            ? 'Authentification fournisseur refusée.'
            : 'Le fournisseur de réservation est indisponible.',
      cause: error,
    });
  }
  return new BookingProviderError({
    code: BOOKING_PROVIDER_ERROR_CODES.upstream,
    provider,
    retryable: true,
    message: 'Le fournisseur de réservation est indisponible.',
    cause: error,
  });
}
