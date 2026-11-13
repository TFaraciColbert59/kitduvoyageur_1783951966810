import { createHash, randomBytes } from 'crypto';
import { inspectProviderCredentials, PARTNER_CONNECTOR_DEFINITIONS } from './registry';
import type {
  ConnectorConsentEvaluation,
  ConnectorConsentPurpose,
  ConnectorConsentSnapshot,
  ConnectorEnvReader,
  ConnectorUsageScope,
  OAuthAuthorizationRequestInput,
  OAuthAuthorizationResult,
  OAuthTokenExchangeResult,
  OAuthTransportAdapter,
  PartnerProviderId,
  PkceChallengePair,
  RevokeConnectionResult,
} from './types';

function toBase64Url(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

/**
 * Génère une paire PKCE (RFC 7636) S256 réelle.
 */
export function createPkceChallengePair(seedVerifier?: string): PkceChallengePair {
  const codeVerifier = seedVerifier && seedVerifier.length >= 43
    ? seedVerifier
    : toBase64Url(randomBytes(32));
  const digest = createHash('sha256').update(codeVerifier, 'ascii').digest();
  const codeChallenge = toBase64Url(digest);

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256',
  };
}

/**
 * Vérifie les consentements P01 (S6.16) avant toute synchronisation entrante ou sortante.
 * Invariants :
 * - La finalité `external_readiness` (ou l'usage `health_metrics`) est bloquée en Phase 1 (`purpose_disabled_phase1`).
 * - Si le fournisseur a été révoqué (`revokedAt !== null`), toute opération est immédiatement refusée (`provider_revoked`).
 * - Si les finalités requises par le connecteur ne sont pas accordées, refus (`purpose_missing`).
 * - Si la portée d'usage (`route_export`, `activity_import`, `live_sync`, etc.) n'est pas autorisée, refus (`scope_not_granted`).
 */
export function evaluateConnectorConsent(
  snapshot: ConnectorConsentSnapshot,
  providerId: PartnerProviderId,
  requestedUsage: ConnectorUsageScope,
  additionalPurposes: readonly ConnectorConsentPurpose[] = []
): ConnectorConsentEvaluation {
  const def = PARTNER_CONNECTOR_DEFINITIONS[providerId];
  const allPurposes = Array.from(new Set([...def.requiredPurposes, ...additionalPurposes]));

  if (requestedUsage === 'health_metrics' || allPurposes.includes('external_readiness')) {
    return {
      allowed: false,
      status: 'purpose_disabled_phase1',
      missingPurposes: ['external_readiness'],
      reason:
        'La finalité « Données de santé » (external_readiness) est désactivée par le contrat P01 S6.16 : aucune donnée de santé ne peut être synchronisée.',
    };
  }

  const grant = snapshot.providers[providerId];
  if (grant?.revokedAt) {
    return {
      allowed: false,
      status: 'provider_revoked',
      missingPurposes: [],
      reason: `Le consentement pour ${def.label} a été révoqué le ${grant.revokedAt}.`,
    };
  }

  const missingPurposes = allPurposes.filter((purpose) => snapshot.purposes[purpose] !== true);
  if (missingPurposes.length > 0) {
    return {
      allowed: false,
      status: 'purpose_missing',
      missingPurposes,
      reason: `Finalités RGPD manquantes (${missingPurposes.join(', ')}) pour utiliser ${def.label}.`,
    };
  }

  if (!grant || !grant.connected) {
    return {
      allowed: false,
      status: 'provider_not_connected',
      missingPurposes: [],
      reason: `Le fournisseur ${def.label} n'est pas connecté pour cet utilisateur.`,
    };
  }

  if (!grant.allowedScopes.includes(requestedUsage)) {
    return {
      allowed: false,
      status: 'scope_not_granted',
      missingPurposes: [],
      reason: `L'usage « ${requestedUsage} » n'est pas autorisé dans les permissions ${def.label}.`,
    };
  }

  return {
    allowed: true,
    status: 'granted',
    missingPurposes: [],
    reason: `Consentement valide pour ${def.label} (${requestedUsage}).`,
  };
}

/**
 * Construit une requête d'autorisation OAuth 2.0 + PKCE.
 * Fail-closed strict : si les variables d'environnement du fournisseur manquent,
 * aucune URL factice ni client_id simulé n'est retourné.
 */
export function buildOAuthAuthorizationUrl(
  input: OAuthAuthorizationRequestInput
): OAuthAuthorizationResult {
  const def = PARTNER_CONNECTOR_DEFINITIONS[input.providerId];
  const { configured, missingEnvVars } = inspectProviderCredentials(input.providerId, input.env);

  if (!configured) {
    return {
      ok: false,
      providerId: input.providerId,
      status: 'credentials_missing',
      missingEnvVars,
      error: `Impossible de démarrer OAuth pour ${def.label} : variables d'environnement manquantes (${missingEnvVars.join(', ')}).`,
    };
  }

  if (!def.oauthAuthorizeUrl) {
    return {
      ok: false,
      providerId: input.providerId,
      status: 'unavailable',
      missingEnvVars: [],
      error: `Le connecteur ${def.label} n'expose pas de flux OAuth web direct.`,
    };
  }

  if (!input.redirectUri.startsWith('https://') && !input.redirectUri.startsWith('http://localhost')) {
    return {
      ok: false,
      providerId: input.providerId,
      status: 'invalid_request',
      missingEnvVars: [],
      error: 'redirectUri invalide : HTTPS requis (ou http://localhost en développement isolé).',
    };
  }

  const envSource = input.env ?? (typeof process !== 'undefined' ? process.env : {});
  const clientIdKey = def.requiredEnvVars[0];
  const clientId = envSource[clientIdKey]!.trim();
  const scopes = input.requestedScopes && input.requestedScopes.length > 0
    ? [...input.requestedScopes]
    : [...def.defaultScopes];

  const url = new URL(def.oauthAuthorizeUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('state', input.state);
  url.searchParams.set('code_challenge', input.pkce.codeChallenge);
  url.searchParams.set('code_challenge_method', input.pkce.codeChallengeMethod);
  url.searchParams.set('scope', scopes.join(' '));

  return {
    ok: true,
    providerId: input.providerId,
    authorizationUrl: url.toString(),
    state: input.state,
    codeChallenge: input.pkce.codeChallenge,
    codeChallengeMethod: 'S256',
    scopes,
  };
}

/**
 * Échange un code d'autorisation OAuth contre un jeton partenaire.
 * Invariant strict : aucun jeton n'est jamais inventé ou simulé si les credentials
 * ou le transport serveur sont absents.
 */
export async function exchangeOAuthCodeFailClosed(params: {
  providerId: PartnerProviderId;
  userId: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
  env?: ConnectorEnvReader;
  transport?: OAuthTransportAdapter;
  nowMs?: number;
}): Promise<OAuthTokenExchangeResult> {
  const def = PARTNER_CONNECTOR_DEFINITIONS[params.providerId];
  const { configured, missingEnvVars } = inspectProviderCredentials(params.providerId, params.env);

  if (!configured) {
    return {
      ok: false,
      providerId: params.providerId,
      status: 'credentials_missing',
      missingEnvVars,
      error: `Échange OAuth refusé (fail-closed) : credentials ${def.label} absents (${missingEnvVars.join(', ')}).`,
    };
  }

  if (!def.oauthTokenUrl) {
    return {
      ok: false,
      providerId: params.providerId,
      status: 'unavailable',
      missingEnvVars: [],
      error: `Aucun endpoint token OAuth configuré pour ${def.label}.`,
    };
  }

  if (!params.code || !params.codeVerifier || params.codeVerifier.length < 43) {
    return {
      ok: false,
      providerId: params.providerId,
      status: 'invalid_grant',
      missingEnvVars: [],
      error: 'Code OAuth ou code_verifier PKCE manquant/invalide.',
    };
  }

  if (!params.transport) {
    return {
      ok: false,
      providerId: params.providerId,
      status: 'transport_missing',
      missingEnvVars: [],
      error: `Transport HTTP serveur non fourni pour ${def.label} : aucun jeton OAuth simulé n'est généré.`,
    };
  }

  const envSource = params.env ?? (typeof process !== 'undefined' ? process.env : {});
  const clientId = envSource[def.requiredEnvVars[0]]!.trim();
  const clientSecret = (envSource[def.requiredEnvVars[1]] ?? '').trim();

  try {
    const tokenResponse = await params.transport({
      providerId: params.providerId,
      tokenUrl: def.oauthTokenUrl,
      clientId,
      clientSecret,
      code: params.code,
      codeVerifier: params.codeVerifier,
      redirectUri: params.redirectUri,
    });

    const now = params.nowMs ?? Date.now();
    const expiresAt = new Date(now + tokenResponse.expiresInSeconds * 1000).toISOString();

    return {
      ok: true,
      providerId: params.providerId,
      userId: params.userId,
      externalAthleteId: tokenResponse.externalAthleteId,
      grantedScopes: tokenResponse.grantedScopes,
      expiresAt,
    };
  } catch (err) {
    return {
      ok: false,
      providerId: params.providerId,
      status: 'transport_error',
      missingEnvVars: [],
      error: err instanceof Error ? err.message : 'Erreur transport OAuth partenaire',
    };
  }
}

/**
 * Révoque immédiatement un connecteur partenaire (S6.16 / S6.27 / K6.06).
 * Coupe la collecte et les envois, purge les références de jeton et annule les jobs en attente.
 * La révocation locale réussit toujours immédiatement même si l'appel distant échoue ou si les credentials manquent.
 */
export async function revokePartnerConnection(params: {
  snapshot: ConnectorConsentSnapshot;
  providerId: PartnerProviderId;
  nowIso?: string;
  env?: ConnectorEnvReader;
  cancelPendingJobsForProvider?: (userId: string, providerId: PartnerProviderId) => number;
  remoteRevokeTransport?: (providerId: PartnerProviderId, revokeUrl: string) => Promise<void>;
}): Promise<{
  updatedSnapshot: ConnectorConsentSnapshot;
  result: RevokeConnectionResult;
}> {
  const revokedAt = params.nowIso ?? new Date().toISOString();
  const def = PARTNER_CONNECTOR_DEFINITIONS[params.providerId];
  const { configured } = inspectProviderCredentials(params.providerId, params.env);

  const cancelledPendingJobs = params.cancelPendingJobsForProvider
    ? params.cancelPendingJobsForProvider(params.snapshot.userId, params.providerId)
    : 0;

  let remoteRevocationStatus: RevokeConnectionResult['remoteRevocationStatus'] = 'skipped_no_credentials';
  if (configured && def.oauthRevokeUrl && params.remoteRevokeTransport) {
    try {
      await params.remoteRevokeTransport(params.providerId, def.oauthRevokeUrl);
      remoteRevocationStatus = 'revoked_remotely';
    } catch {
      remoteRevocationStatus = 'remote_failed_local_enforced';
    }
  }

  const existingGrant = params.snapshot.providers[params.providerId];
  const updatedSnapshot: ConnectorConsentSnapshot = {
    ...params.snapshot,
    providers: {
      ...params.snapshot.providers,
      [params.providerId]: {
        providerId: params.providerId,
        connected: false,
        allowedScopes: [],
        grantedAt: existingGrant?.grantedAt ?? null,
        revokedAt,
      },
    },
  };

  return {
    updatedSnapshot,
    result: {
      ok: true,
      providerId: params.providerId,
      userId: params.snapshot.userId,
      newStatus: 'revoked',
      revokedAt,
      cancelledPendingJobs,
      purgedTokenReferences: true,
      remoteRevocationStatus,
    },
  };
}
