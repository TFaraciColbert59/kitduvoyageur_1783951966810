import 'server-only';

/**
 * Résolution unique des identifiants fournisseurs (D-07, PROMPT §12.1C).
 *
 * Invariant central : les deux jeux de clés (sandbox + production) coexistent
 * dans l'environnement. Un unique sélecteur de mode choisit la paire à lire.
 * On ne remplace jamais une valeur par une autre, et on ne retombe JAMAIS sur
 * le sandbox quand le mode live est demandé — cela serait un incident
 * commercial (réserver en test en croyant être en production).
 *
 * Le module n'expose jamais la valeur d'un secret : uniquement sa présence,
 * sous forme de booléen, et le nom des variables attendues.
 */

export type ProviderCredentialId = 'routestack' | 'viator';
export type ProviderCredentialMode = 'sandbox' | 'live' | 'disabled';
export type ProviderCredentialSlot = 'sandbox' | 'full';
export type ProviderCredentialSource = 'canonical' | 'legacy';

export type ProviderCredentialReason =
  | null
  | 'credentials_missing'
  | 'credentials_incomplete'
  | 'credentials_invalid';

export interface ResolvedProviderCredentials {
  provider: ProviderCredentialId;
  /** Mode effectif. `disabled` = aucune paire exploitable. */
  mode: ProviderCredentialMode;
  /** Slot demandé par le sélecteur de mode. */
  slot: ProviderCredentialSlot;
  /** Contrat canonique lu, ou repli sur les variables historiques. */
  source: ProviderCredentialSource;
  apiKey: string | null;
  /** Secret HMAC — RouteStack uniquement. */
  secret: string | null;
  baseUrl: string | null;
  /**
   * Verrou de réservation. Viator : `VIATOR_MODE=full` ET
   * `VIATOR_BOOKING_ENABLED=true` ET clé Full présente (triple verrou, D-07).
   * RouteStack : toujours `false` — le checkout passe par `get-payment-url`.
   */
  bookingEnabled: boolean;
  /** Raison du `disabled`, ou `null` si la configuration est exploitable. */
  reason: ProviderCredentialReason;
  /** Message prêt à logger. Ne contient que des noms de variables. */
  message: string;
}

export type ProviderCredentialEnv = Record<string, string | undefined>;

const ROUTESTACK_DEFAULT_BASE_URL = 'https://mcp.routestack.ai';
const VIATOR_SANDBOX_DEFAULT_BASE_URL = 'https://api.sandbox.viator.com/partner';
const VIATOR_FULL_DEFAULT_BASE_URL = 'https://api.viator.com/partner';

function trimmed(value: string | undefined): string | null {
  const next = value?.trim();
  return next ? next : null;
}

function boolEnv(value: string | undefined): boolean {
  const next = value?.trim().toLowerCase();
  return next === '1' || next === 'true' || next === 'yes' || next === 'on';
}

/** Un mode live ne s'atteint que par une demande explicite et positive. */
function readCanonicalSlot(
  raw: string | undefined,
  liveAliases: readonly string[]
): ProviderCredentialSlot {
  const requested = trimmed(raw)?.toLowerCase();
  if (!requested) return 'sandbox';
  if (liveAliases.includes(requested)) return 'full';
  // Toute valeur inconnue retombe sur sandbox : jamais de mode permissif par défaut.
  return 'sandbox';
}

function disabled(
  provider: ProviderCredentialId,
  slot: ProviderCredentialSlot,
  source: ProviderCredentialSource,
  reason: Exclude<ProviderCredentialReason, null>,
  message: string
): ResolvedProviderCredentials {
  return {
    provider,
    mode: 'disabled',
    slot,
    source,
    apiKey: null,
    secret: null,
    baseUrl: null,
    bookingEnabled: false,
    reason,
    message,
  };
}

function resolveRouteStack(env: ProviderCredentialEnv): ResolvedProviderCredentials {
  const canonicalMode = trimmed(env.ROUTESTACK_MODE);

  // --- Contrat canonique : selected uniquement si ROUTESTACK_MODE est pose ---
  if (canonicalMode) {
    const slot = readCanonicalSlot(canonicalMode, ['production', 'full', 'live']);
    const prefix = slot === 'full' ? 'ROUTESTACK_FULL' : 'ROUTESTACK_SANDBOX';
    const apiKey = trimmed(env[`${prefix}_API_KEY`]);
    const secret = trimmed(env[`${prefix}_PARTNER_SECRET`]);
    const baseUrl = trimmed(env[`${prefix}_BASE_URL`]);

    if (!apiKey) {
      const other = slot === 'full' ? 'ROUTESTACK_SANDBOX_API_KEY' : 'ROUTESTACK_FULL_API_KEY';
      const otherPresent = Boolean(trimmed(env[other]));
      return disabled(
        'routestack',
        slot,
        'canonical',
        otherPresent ? 'credentials_incomplete' : 'credentials_missing',
        otherPresent
          ? `ROUTESTACK_MODE=${slot === 'full' ? 'production' : 'sandbox'} exige ${prefix}_API_KEY ; seule ${other} est presente. Repli refuse : demander un mode sans sa cle serait un incident commercial.`
          : `ROUTESTACK_MODE=${slot === 'full' ? 'production' : 'sandbox'} exige ${prefix}_API_KEY, absente.`
      );
    }

    return {
      provider: 'routestack',
      mode: slot === 'full' ? 'live' : 'sandbox',
      slot,
      source: 'canonical',
      apiKey,
      secret,
      baseUrl: baseUrl ?? ROUTESTACK_DEFAULT_BASE_URL,
      // Le checkout RouteStack passe par get-payment-url : pas de verrou externe.
      bookingEnabled: false,
      reason: null,
      message: `RouteStack ${slot === 'full' ? 'live' : 'sandbox'} actif.`,
    };
  }

  // --- Repli retrocompatible : contrat historique, inchange ---
  const legacyKey = trimmed(env.ROUTESTACK_API_KEY);
  if (!legacyKey) {
    return disabled(
      'routestack',
      'sandbox',
      'legacy',
      'credentials_missing',
      'Ni ROUTESTACK_MODE + ROUTESTACK_SANDBOX_API_KEY, ni ROUTESTACK_API_KEY ne sont definis.'
    );
  }
  const legacyMode = trimmed(env.ROUTESTACK_BOOKING_MODE)?.toLowerCase();
  const wantsLive = legacyMode === 'live' || legacyMode === 'full';
  const live = wantsLive && boolEnv(env.ROUTESTACK_LIVE_ENABLED);
  if (wantsLive && !live) {
    return disabled(
      'routestack',
      'full',
      'legacy',
      'credentials_incomplete',
      'ROUTESTACK_BOOKING_MODE demande le live mais ROUTESTACK_LIVE_ENABLED n est pas a true.'
    );
  }
  return {
    provider: 'routestack',
    mode: live ? 'live' : 'sandbox',
    slot: live ? 'full' : 'sandbox',
    source: 'legacy',
    apiKey: legacyKey,
    secret: trimmed(env.ROUTESTACK_API_SECRET),
    baseUrl: trimmed(env.ROUTESTACK_MCP_URL) ?? ROUTESTACK_DEFAULT_BASE_URL,
    bookingEnabled: false,
    reason: null,
    message: `RouteStack ${live ? 'live' : 'sandbox'} actif (contrat historique).`,
  };
}

function resolveViator(env: ProviderCredentialEnv): ResolvedProviderCredentials {
  const canonicalMode = trimmed(env.VIATOR_MODE);

  if (canonicalMode) {
    const slot = readCanonicalSlot(canonicalMode, ['full', 'live', 'production']);
    const prefix = slot === 'full' ? 'VIATOR_FULL' : 'VIATOR_SANDBOX';
    const apiKey = trimmed(env[`${prefix}_API_KEY`]);
    const fallbackBase =
      slot === 'full' ? VIATOR_FULL_DEFAULT_BASE_URL : VIATOR_SANDBOX_DEFAULT_BASE_URL;
    const baseUrl = trimmed(env[`${prefix}_API_BASE_URL`]) ?? fallbackBase;

    if (!apiKey) {
      const other = slot === 'full' ? 'VIATOR_SANDBOX_API_KEY' : 'VIATOR_FULL_API_KEY';
      const otherPresent = Boolean(trimmed(env[other]));
      return disabled(
        'viator',
        slot,
        'canonical',
        otherPresent ? 'credentials_incomplete' : 'credentials_missing',
        otherPresent
          ? `VIATOR_MODE=${slot} exige ${prefix}_API_KEY ; seule ${other} est presente. Repli refuse : consulter le sandbox en croyant etre en full invaliderait l attribution des commissions.`
          : `VIATOR_MODE=${slot} exige ${prefix}_API_KEY, absente.`
      );
    }

    // Triple verrou : mode full ET drapeau ET cle full presente.
    const bookingRequested = boolEnv(env.VIATOR_BOOKING_ENABLED);
    const bookingEnabled = slot === 'full' && bookingRequested && Boolean(apiKey);

    return {
      provider: 'viator',
      mode: slot === 'full' ? 'live' : 'sandbox',
      slot,
      source: 'canonical',
      apiKey,
      secret: null,
      baseUrl,
      bookingEnabled,
      reason: null,
      message: `Viator ${slot === 'full' ? 'full' : 'sandbox'} actif, booking ${bookingEnabled ? 'autorise' : 'verrouille'}.`,
    };
  }

  // --- Repli retrocompatible : contrat historique, inchange ---
  const legacyKey = trimmed(env.VIATOR_API_KEY);
  if (!legacyKey) {
    return disabled(
      'viator',
      'sandbox',
      'legacy',
      'credentials_missing',
      'Ni VIATOR_MODE + VIATOR_SANDBOX_API_KEY, ni VIATOR_API_KEY ne sont definis.'
    );
  }
  const legacyMode = trimmed(env.VIATOR_BOOKING_MODE)?.toLowerCase();
  const wantsFull = legacyMode === 'full' || legacyMode === 'live';
  const full = wantsFull && boolEnv(env.VIATOR_BOOKING_FULL_ENABLED);
  if (wantsFull && !full) {
    return disabled(
      'viator',
      'full',
      'legacy',
      'credentials_incomplete',
      'VIATOR_BOOKING_MODE demande le full mais VIATOR_BOOKING_FULL_ENABLED n est pas a true.'
    );
  }
  return {
    provider: 'viator',
    mode: full ? 'live' : 'sandbox',
    slot: full ? 'full' : 'sandbox',
    source: 'legacy',
    apiKey: legacyKey,
    secret: null,
    baseUrl: trimmed(env.VIATOR_API_BASE_URL) ?? VIATOR_SANDBOX_DEFAULT_BASE_URL,
    bookingEnabled: full,
    reason: null,
    message: `Viator ${full ? 'full' : 'sandbox'} actif (contrat historique), booking ${full ? 'autorise' : 'verrouille'}.`,
  };
}

/**
 * Point d'entrée unique. Ne lève jamais : un environnement incomplet produit un
 * état `disabled` explicite, que l'appelant translate en erreur typée au
 * moment d'utiliser le transport. Construire un fournisseur ne doit pas lever.
 */
export function resolveProviderCredentials(
  provider: ProviderCredentialId,
  env: ProviderCredentialEnv = process.env
): ResolvedProviderCredentials {
  return provider === 'routestack' ? resolveRouteStack(env) : resolveViator(env);
}

/** Mode effectif de chaque fournisseur. Ne lève jamais. */
export function getActiveProviderMode(env: ProviderCredentialEnv = process.env): {
  routestack: ProviderCredentialMode;
  viator: ProviderCredentialMode;
} {
  return {
    routestack: resolveProviderCredentials('routestack', env).mode,
    viator: resolveProviderCredentials('viator', env).mode,
  };
}

/**
 * Trace de démarrage (PROMPT §12.1C.5). Uniquement mode + présence en
 * booléen : jamais une valeur, jamais un préfixe de clé.
 */
export function getProviderCredentialSummary(
  env: ProviderCredentialEnv = process.env
): ReadonlyArray<{
  provider: ProviderCredentialId;
  mode: ProviderCredentialMode;
  source: ProviderCredentialSource;
  hasApiKey: boolean;
  hasSecret: boolean;
  hasBaseUrl: boolean;
  bookingEnabled: boolean;
  reason: ProviderCredentialReason;
}> {
  return (['routestack', 'viator'] as const).map((provider) => {
    const resolved = resolveProviderCredentials(provider, env);
    return {
      provider,
      mode: resolved.mode,
      source: resolved.source,
      hasApiKey: Boolean(resolved.apiKey),
      hasSecret: Boolean(resolved.secret),
      hasBaseUrl: Boolean(resolved.baseUrl),
      bookingEnabled: resolved.bookingEnabled,
      reason: resolved.reason,
    };
  });
}