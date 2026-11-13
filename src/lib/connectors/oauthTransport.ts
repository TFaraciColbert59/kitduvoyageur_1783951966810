import 'server-only';

import type { OAuthTokenTransportResponse, OAuthTransportAdapter } from '@/features/connectors';

/**
 * Transport OAuth serveur réel, fail-closed.
 *
 * Il n'est appelé qu'après vérification des credentials dans le moteur amont.
 * Aucun jeton n'est fabriqué : une réponse sans `access_token` exploitable est
 * une erreur de transport, jamais un succès partiel.
 */
export const fetchOAuthTransport: OAuthTransportAdapter = async (params) => {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    code_verifier: params.codeVerifier,
  });
  if (params.clientSecret) body.set('client_secret', params.clientSecret);

  const response = await fetch(params.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Échange OAuth ${params.providerId} refusé (HTTP ${response.status}).`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const accessToken = typeof payload.access_token === 'string' ? payload.access_token.trim() : '';
  if (!accessToken) {
    throw new Error(`Réponse OAuth ${params.providerId} sans access_token : aucun jeton accepté.`);
  }

  const athlete = payload.athlete;
  const athleteId =
    (typeof athlete === 'object' && athlete !== null && 'id' in athlete
      ? String((athlete as { id?: unknown }).id ?? '')
      : '') ||
    String(payload.external_athlete_id ?? payload.user_id ?? payload.athlete_id ?? '');

  if (!athleteId) {
    throw new Error(`Réponse OAuth ${params.providerId} sans identifiant athlète externe.`);
  }

  const grantedScopes = typeof payload.scope === 'string'
    ? payload.scope.split(/[\s,]+/).filter(Boolean)
    : [];

  const expiresInSeconds =
    typeof payload.expires_in === 'number' && Number.isFinite(payload.expires_in)
      ? Math.max(0, payload.expires_in)
      : 3600;

  return {
    accessToken,
    refreshToken: typeof payload.refresh_token === 'string' ? payload.refresh_token : undefined,
    expiresInSeconds,
    externalAthleteId: athleteId,
    grantedScopes,
  } satisfies OAuthTokenTransportResponse;
};
