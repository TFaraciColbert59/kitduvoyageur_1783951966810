import crypto from 'crypto';
import type { Crew, CrewRole } from '../types/crew.types';

export interface InvitePayload {
  crewId: string;
  inviterId: string;
  role?: CrewRole;
  expiresInHours?: number;
}

export interface VerifiedInvite {
  crewId: string;
  inviterId: string;
  role: CrewRole;
  expiresAt: number;
}

const DEFAULT_SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || 'lkdv-default-crew-secret-2026';

/**
 * Génère un jeton d'invitation signé avec horodatage d'expiration (HMAC-SHA256).
 */
export function createInviteToken(
  payload: InvitePayload,
  secretKey = DEFAULT_SECRET
): string {
  const expiresInHours = payload.expiresInHours ?? 72;
  const expiresAt = Date.now() + expiresInHours * 60 * 60 * 1000;
  const role = payload.role || 'member';

  const dataString = `${payload.crewId}|${payload.inviterId}|${role}|${expiresAt}`;
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(dataString)
    .digest('hex');

  const fullPayload = `${dataString}|${signature}`;
  return Buffer.from(fullPayload).toString('base64url');
}

/**
 * Vérifie et décode un jeton d'invitation signé.
 * Retourne null si le jeton est altéré ou expiré.
 */
export function verifyInviteToken(
  token: string,
  secretKey = DEFAULT_SECRET
): VerifiedInvite | null {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf-8');
    const parts = raw.split('|');
    if (parts.length !== 5) return null;

    const [crewId, inviterId, role, expiresAtStr, signature] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt)) return null;

    // Vérification de la date d'expiration
    if (Date.now() > expiresAt) {
      return null;
    }

    // Vérification HMAC
    const expectedData = `${crewId}|${inviterId}|${role}|${expiresAtStr}`;
    const expectedSig = crypto
      .createHmac('sha256', secretKey)
      .update(expectedData)
      .digest('hex');

    if (signature !== expectedSig) {
      return null;
    }

    return {
      crewId,
      inviterId,
      role: role as CrewRole,
      expiresAt,
    };
  } catch {
    return null;
  }
}

export type JoinValidationError = 'AUTH_REQUIRED' | 'CREW_FULL' | 'ALREADY_MEMBER';

export interface JoinAttemptContext {
  crew: Pick<Crew, 'id' | 'max_members'>;
  currentMemberCount: number;
  isAlreadyMember: boolean;
  currentUserId?: string | null;
}

/**
 * Valide les prérequis pour rejoindre un équipage avec consentement.
 */
export function validateJoinAttempt(context: JoinAttemptContext): {
  allowed: boolean;
  error?: JoinValidationError;
} {
  const { crew, currentMemberCount, isAlreadyMember, currentUserId } = context;

  if (!currentUserId) {
    return { allowed: false, error: 'AUTH_REQUIRED' };
  }

  if (isAlreadyMember) {
    return { allowed: false, error: 'ALREADY_MEMBER' };
  }

  if (currentMemberCount >= crew.max_members) {
    return { allowed: false, error: 'CREW_FULL' };
  }

  return { allowed: true };
}
