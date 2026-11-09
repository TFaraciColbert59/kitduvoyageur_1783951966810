import { describe, expect, it } from 'vitest';
import {
  API_ERROR_CODES,
  ApiError,
  codeFromHint,
  errorBody,
  isApiError,
  messageFor,
  redact,
  statusFor,
  translateDbError
} from './errors';

/**
 * Couche 4 : les erreurs de la base et des routes sont traduites en phrases métier.
 * Règle du CONTRACT : `42501` → phrase métier ; aucun code PostgreSQL, aucune pile,
 * aucun SQL ne sort de la route.
 */

describe('translateDbError — traduction des erreurs Postgres', () => {
  it('traduit 42501 (droits insuffisants) en phrase métier, sans code brut', () => {
    const error = translateDbError({ code: '42501', message: 'permission denied for function run_command' });
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('not_allowed');
    expect(error.status).toBe(403);
    expect(error.message).toBe('Votre rôle ne permet pas cette action.');
    expect(error.message).not.toContain('42501');
    expect(error.message).not.toContain('permission');
    expect(error.message).not.toContain('run_command');
  });

  it('traduit les codes PostgREST connus et retombe sur server_error sinon', () => {
    expect(translateDbError({ code: 'PGRST116' }).code).toBe('not_found');
    expect(translateDbError({ code: 'P0002' }).code).toBe('not_found');
    expect(translateDbError({ code: '22023' }).code).toBe('invalid_params');
    expect(translateDbError({ code: '53400' }).code).toBe('rate_limited');
    expect(translateDbError({ code: '40001' }).code).toBe('conflict');
    expect(translateDbError({ code: '0A000' }).code).toBe('unknown_command');
    expect(translateDbError({ code: 'PGRST301' }).code).toBe('unauthenticated');
    expect(translateDbError({ code: 'XX000' }).code).toBe('server_error');
    expect(translateDbError({}).code).toBe('server_error');
    expect(translateDbError(null).code).toBe('server_error');
  });

  it('donne la priorité au marqueur `hint` levé par la base', () => {
    const error = translateDbError({ code: '42501', hint: 'reason_required' });
    expect(error.code).toBe('reason_required');
    expect(error.message).toBe('Un motif est obligatoire pour cette action.');
    // Un indice inconnu ne change rien : on retombe sur le code.
    expect(translateDbError({ code: '42501', hint: 'pirate' }).code).toBe('not_allowed');
  });

  it('ne traduit que les marqueurs connus, insensibles à la casse et aux espaces', () => {
    expect(codeFromHint('  MFA_Required ')).toBe('mfa_required');
    expect(codeFromHint('solo_required')).toBe('solo_required');
    expect(codeFromHint('DROP TABLE')).toBeNull();
    expect(codeFromHint(42)).toBeNull();
    expect(codeFromHint(null)).toBeNull();
  });

  it('laisse passer une ApiError déjà traduite', () => {
    const original = new ApiError('agent_cannot_validate');
    expect(translateDbError(original)).toBe(original);
    expect(isApiError(original)).toBe(true);
    expect(isApiError(new Error('x'))).toBe(false);
  });
});

describe('catalogue des erreurs', () => {
  it('associe à chaque code une phrase française, un statut HTTP et aucun détail technique', () => {
    expect(API_ERROR_CODES.length).toBeGreaterThan(30);
    for (const code of API_ERROR_CODES) {
      const message = messageFor(code);
      expect(message.length, code).toBeGreaterThan(10);
      expect(message, code).not.toMatch(/pgrst|42501|stack|sql|exception|null|undefined/i);
      const status = statusFor(code);
      expect(status, code).toBeGreaterThanOrEqual(400);
      expect(status, code).toBeLessThan(600);
    }
  });

  it('refuse une auto-validation hors mode solo et une validation par un agent', () => {
    expect(messageFor('self_approval')).toMatch(/solo/i);
    expect(statusFor('self_approval')).toBe(403);
    expect(messageFor('agent_cannot_validate')).toMatch(/agent/i);
    expect(statusFor('agent_cannot_validate')).toBe(403);
  });

  it('rend un corps JSON stable avec code, phrase et référence de requête', () => {
    const body = errorBody(new ApiError('invalid_params', [{ path: 'amount_cents', message: 'Montant positif attendu' }]), 'req-42');
    expect(body.error.code).toBe('invalid_params');
    expect(body.error.message).toBe('Les informations transmises ne sont pas valides.');
    expect(body.error.request_ref).toBe('req-42');
    expect(body.request_ref).toBe('req-42');
    expect(body.error.issues).toEqual([{ path: 'amount_cents', message: 'Montant positif attendu' }]);
    expect(JSON.stringify(body)).not.toMatch(/zod|stack|at \/|SQL/i);
  });
});

describe('redact — masquage avant journal', () => {
  it('masque jetons, clés Stripe, clés Supabase et e-mails', () => {
    const text = [
      'Bearer abc.def.ghi',
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop',
      'sk_test_51Habcdefghijklmnop',
      'sk_live_51Habcdefghijklmnop',
      'sb_secret_abcdefghijklmnop',
      'membre@example.test'
    ].join(' | ');
    const masked = redact(text);
    expect(masked).not.toContain('sk_test_51H');
    expect(masked).not.toContain('sk_live_51H');
    expect(masked).not.toContain('sb_secret_');
    expect(masked).not.toContain('membre@example.test');
    expect(masked).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(masked).toContain('[e-mail masqué]');
  });
});
