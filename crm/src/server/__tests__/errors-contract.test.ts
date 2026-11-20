import { describe, expect, it, beforeEach } from 'vitest';
import { API_ERROR_CODES, codeFromHint, messageFor, redact, statusFor, translateDbError } from '../../lib/errors';
import { rateLimit, resetRateLimits } from '../rate-limit';

/**
 * Contrat d'erreurs backend (task-3) : chaque marqueur levé par la base a une
 * phrase française, un statut HTTP, et aucun code PostgreSQL ne sort.
 * Complète `src/lib/errors.test.ts` (rôle testeur) sans l'affaiblir.
 */
const DB_MARKERS = [
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
] as const;

describe('contrat d’erreurs base → route', () => {
  it('traduit chaque marqueur `hint` du contrat db en code métier français', () => {
    for (const marker of DB_MARKERS) {
      const error = translateDbError({ code: 'P0001', hint: marker });
      expect(error.code, marker).toBe(marker);
      expect(error.message.length, marker).toBeGreaterThan(10);
      expect(error.message, marker).not.toMatch(/pgrst|42501|p0001|sql|stack|exception/i);
      expect(error.status, marker).toBeGreaterThanOrEqual(400);
      expect(error.status, marker).toBeLessThan(600);
    }
  });

  it('ne laisse jamais passer un hint inconnu ou un code brut', () => {
    expect(codeFromHint('RAISE EXCEPTION')).toBeNull();
    expect(codeFromHint('not_a_marker')).toBeNull();
    const error = translateDbError({ code: '42501', hint: 'pirate', message: 'permission denied for table users' });
    expect(error.code).toBe('not_allowed');
    expect(error.message).not.toContain('permission');
    expect(error.message).not.toContain('users');
  });

  it('couvre tous les codes exposés par l’API avec un statut 4xx/5xx', () => {
    for (const code of API_ERROR_CODES) {
      expect(statusFor(code)).toBeGreaterThanOrEqual(400);
      expect(messageFor(code)).not.toMatch(/zod|at \/|TypeError/i);
    }
  });
});

describe('redact — avant journal serveur', () => {
  it('masque jetons d’agent, clés Stripe et Supabase', () => {
    const text = redact(
      'Bearer abc.def.ghi sk_test_51Habcdefghijklmno sk_live_51Habcdefghijklmno sb_secret_abcdefghijklmno agent@example.test'
    );
    expect(text).not.toContain('sk_test_');
    expect(text).not.toContain('sk_live_');
    expect(text).not.toContain('sb_secret_');
    expect(text).not.toContain('agent@example.test');
    expect(text).toContain('[e-mail masqué]');
  });
});

describe('rate limit en mémoire', () => {
  beforeEach(() => resetRateLimits());

  it('laisse passer jusqu’à la limite puis refuse', () => {
    for (let i = 0; i < 3; i += 1) rateLimit('test:user', 3);
    expect(() => rateLimit('test:user', 3)).toThrowError(/Trop de requêtes/);
  });

  it('compte par clé (un utilisateur ne bloque pas un autre)', () => {
    rateLimit('a', 1);
    expect(() => rateLimit('b', 1)).not.toThrow();
  });
});
