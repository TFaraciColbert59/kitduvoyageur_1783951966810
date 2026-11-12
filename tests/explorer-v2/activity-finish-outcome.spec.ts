import { describe, expect, it } from 'vitest';
import {
  readFinishOutcome,
  shouldKeepFinishInQueue,
} from '@/features/explorer-v2/activity/finishOutcome';

const SUMMARY_ID = '33333333-3333-4333-8333-333333333333';

describe('explorer-v2 · lecture de la réponse de fin', () => {
  it('distingue saved, duplicate et already_finished', () => {
    expect(readFinishOutcome(200, { status: 'saved', summaryId: SUMMARY_ID })).toEqual({
      state: 'saved',
      retryable: false,
      terminal: true,
      summaryId: SUMMARY_ID,
    });
    expect(readFinishOutcome(200, { status: 'duplicate', summaryId: SUMMARY_ID })).toEqual({
      state: 'saved',
      retryable: false,
      terminal: true,
      summaryId: SUMMARY_ID,
    });
    expect(readFinishOutcome(200, { status: 'already_finished', summaryId: SUMMARY_ID })).toEqual({
      state: 'already_finished',
      retryable: false,
      terminal: true,
      summaryId: SUMMARY_ID,
    });
    expect(readFinishOutcome(200, { status: 'already_finished', summaryId: null })).toEqual({
      state: 'already_finished_without_summary',
      retryable: false,
      terminal: true,
      summaryId: null,
    });
    // Une séance close sans résumé reste distincte d'une sortie enregistrée.
    expect(readFinishOutcome(200, { status: 'already_finished' })).toEqual({
      state: 'already_finished_without_summary',
      retryable: false,
      terminal: true,
      summaryId: null,
    });
  });

  it('ne retire que les erreurs réellement définitives (400 et 409)', () => {
    expect(readFinishOutcome(400, { error: 'sessionId invalide' })).toEqual({
      state: 'failed',
      retryable: false,
      terminal: true,
      summaryId: null,
    });
    expect(readFinishOutcome(409, { code: 'idempotency_conflict' })).toEqual({
      state: 'conflict',
      retryable: false,
      terminal: true,
      summaryId: null,
    });
  });

  it('conserve en file une session expirée (401)', () => {
    const outcome = readFinishOutcome(401, { error: 'authentification requise' });

    expect(outcome).toEqual({
      state: 'unauthenticated',
      retryable: false,
      terminal: false,
      summaryId: null,
    });
    // Non rejouable automatiquement, mais jamais jeté : la reconnexion le rejoue.
    expect(shouldKeepFinishInQueue(outcome)).toBe(true);
  });

  it('conserve en file les refus RLS et les erreurs de déploiement', () => {
    for (const status of [403, 404, 405, 422]) {
      const outcome = readFinishOutcome(status, { error: 'refusé' });
      expect(outcome, String(status)).toEqual({
        state: 'failed',
        retryable: true,
        terminal: false,
        summaryId: null,
      });
      expect(shouldKeepFinishInQueue(outcome), String(status)).toBe(true);
    }
  });

  it('retente un serveur indisponible, un timeout, un débit ou une réponse illisible', () => {
    const cases: Array<[number, unknown]> = [
      [503, { error: 'indisponible' }],
      [408, { error: 'timeout' }],
      [429, { error: 'trop de requêtes' }],
      [200, { status: 'saved', summaryId: null }],
      [200, { status: 'already_finished', summaryId: 'pas-un-uuid' }],
      [200, 'pas-un-objet'],
    ];

    for (const [status, payload] of cases) {
      const outcome = readFinishOutcome(status, payload);
      expect(outcome, `${status} ${JSON.stringify(payload)}`).toEqual({
        state: 'failed',
        retryable: true,
        terminal: false,
        summaryId: null,
      });
      expect(shouldKeepFinishInQueue(outcome)).toBe(true);
    }
  });
});
