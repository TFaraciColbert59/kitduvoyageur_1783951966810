import { describe, expect, it } from 'vitest';
import { readFinishOutcome } from '@/features/explorer-v2/activity/finishOutcome';

const SUMMARY_ID = '33333333-3333-4333-8333-333333333333';

describe('explorer-v2 · lecture de la réponse de fin', () => {
  it('distingue saved, duplicate et already_finished', () => {
    expect(readFinishOutcome(200, { status: 'saved', summaryId: SUMMARY_ID })).toEqual({
      state: 'saved',
      retryable: false,
      summaryId: SUMMARY_ID,
    });
    expect(readFinishOutcome(200, { status: 'duplicate', summaryId: SUMMARY_ID })).toEqual({
      state: 'saved',
      retryable: false,
      summaryId: SUMMARY_ID,
    });
    expect(readFinishOutcome(200, { status: 'already_finished', summaryId: SUMMARY_ID })).toEqual({
      state: 'already_finished',
      retryable: false,
      summaryId: SUMMARY_ID,
    });
    expect(readFinishOutcome(200, { status: 'already_finished', summaryId: null })).toEqual({
      state: 'already_finished_without_summary',
      retryable: false,
      summaryId: null,
    });
    // Une séance close sans résumé reste distincte d'une sortie enregistrée.
    expect(readFinishOutcome(200, { status: 'already_finished' })).toEqual({
      state: 'already_finished_without_summary',
      retryable: false,
      summaryId: null,
    });
  });

  it('ne remet pas en file une erreur définitive', () => {
    expect(readFinishOutcome(400, { error: 'sessionId invalide' })).toEqual({
      state: 'failed',
      retryable: false,
      summaryId: null,
    });
    expect(readFinishOutcome(401, { error: 'authentification requise' })).toEqual({
      state: 'unauthenticated',
      retryable: false,
      summaryId: null,
    });
    expect(readFinishOutcome(409, { code: 'idempotency_conflict' })).toEqual({
      state: 'conflict',
      retryable: false,
      summaryId: null,
    });
  });

  it('retente un serveur indisponible ou une réponse illisible', () => {
    expect(readFinishOutcome(503, { error: 'indisponible' })).toEqual({
      state: 'failed',
      retryable: true,
      summaryId: null,
    });
    // Timeout et limite de débit sont transitoires, pas définitifs.
    expect(readFinishOutcome(408, { error: 'timeout' })).toEqual({
      state: 'failed',
      retryable: true,
      summaryId: null,
    });
    expect(readFinishOutcome(429, { error: 'trop de requêtes' })).toEqual({
      state: 'failed',
      retryable: true,
      summaryId: null,
    });
    expect(readFinishOutcome(200, { status: 'saved', summaryId: null })).toEqual({
      state: 'failed',
      retryable: true,
      summaryId: null,
    });
    expect(readFinishOutcome(200, { status: 'already_finished', summaryId: 'pas-un-uuid' })).toEqual({
      state: 'failed',
      retryable: true,
      summaryId: null,
    });
  });
});
