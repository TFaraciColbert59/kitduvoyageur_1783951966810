import 'server-only';
import { apiError } from '../../lib/errors';

/**
 * Jeton court d'agent MCP (10 min), signé HS256 avec `AGENT_TOKEN_SIGNING`.
 * Aucune dépendance externe : Web Crypto uniquement.
 *
 * Le jeton porte l'identité du compte de service (`sub` = auth_user_id). Les
 * droits restent appliqués en base par `admin.agent_authorize` +
 * `admin.run_command_as`, jamais par ce jeton.
 */
export type AgentTokenClaims = {
  sub: string;
  ag?: string;
  pol?: string;
  iat: number;
  exp: number;
  iss: 'lkdv-control';
  aud: 'lkdv-mcp';
};

const encoder = new TextEncoder();
const ISSUER = 'lkdv-control';
const AUDIENCE = 'lkdv-mcp';
const DEFAULT_TTL_SECONDS = 600;

function secret(): string {
  const value = process.env.AGENT_TOKEN_SIGNING;
  if (!value || value.length < 32) throw apiError('agent_token_unavailable');
  return value;
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  try {
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify'
  ]);
}

/** Durée de vie par défaut, bornée à 15 min. */
export function agentTokenTtl(): number {
  const raw = Number(process.env.AGENT_TOKEN_TTL_SECONDS ?? DEFAULT_TTL_SECONDS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TTL_SECONDS;
  return Math.min(Math.max(Math.floor(raw), 60), 900);
}

export async function signAgentToken(input: { sub: string; agentId?: string; pole?: string; ttlSeconds?: number }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims: AgentTokenClaims = {
    sub: input.sub,
    ...(input.agentId ? { ag: input.agentId } : {}),
    ...(input.pole ? { pol: input.pole } : {}),
    iat: now,
    exp: now + (input.ttlSeconds ?? agentTokenTtl()),
    iss: ISSUER,
    aud: AUDIENCE
  };
  const header = base64url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = base64url(encoder.encode(JSON.stringify(claims)));
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(), encoder.encode(`${header}.${payload}`));
  return `${header}.${payload}.${base64url(new Uint8Array(signature))}`;
}

export async function verifyAgentToken(token: string): Promise<AgentTokenClaims> {
  const parts = token.split('.');
  if (parts.length !== 3) throw apiError('agent_token_invalid');
  const [header, payload, signature] = parts as [string, string, string];

  const headerBytes = fromBase64url(header);
  const payloadBytes = fromBase64url(payload);
  const signatureBytes = fromBase64url(signature);
  if (!headerBytes || !payloadBytes || !signatureBytes) throw apiError('agent_token_invalid');

  let parsedHeader: { alg?: string; typ?: string };
  try {
    parsedHeader = JSON.parse(new TextDecoder().decode(headerBytes)) as { alg?: string; typ?: string };
  } catch {
    throw apiError('agent_token_invalid');
  }
  if (parsedHeader.alg !== 'HS256') throw apiError('agent_token_invalid');

  const valid = await crypto.subtle.verify('HMAC', await hmacKey(), signatureBytes as unknown as BufferSource, encoder.encode(`${header}.${payload}`));
  if (!valid) throw apiError('agent_token_invalid');

  let claims: Partial<AgentTokenClaims>;
  try {
    claims = JSON.parse(new TextDecoder().decode(payloadBytes)) as Partial<AgentTokenClaims>;
  } catch {
    throw apiError('agent_token_invalid');
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    typeof claims.sub !== 'string' ||
    claims.sub.length < 8 ||
    typeof claims.exp !== 'number' ||
    typeof claims.iat !== 'number' ||
    claims.exp <= now ||
    claims.iat > now + 60 ||
    claims.iss !== ISSUER ||
    claims.aud !== AUDIENCE
  ) {
    throw apiError('agent_token_invalid');
  }

  return claims as AgentTokenClaims;
}
