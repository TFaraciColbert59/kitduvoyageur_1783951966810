import { describe, it, expect } from 'vitest';
import {
  buildLogRecord,
  createStructuredLogger,
  redact,
  redactFields,
  redactString,
  type StructuredLogRecord,
} from '@/lib/observability/logger';

const EMAIL = 'alice.martin@example.com';
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
// Assemblés à l'exécution : aucune clé (même factice) littérale dans le dépôt —
// la redaction est testée sur la valeur finale, identique à une clé réelle.
const STRIPE = ['sk', 'live', '51H8xYzAbCdEfGhIjKlMnOpQr'].join('_');
const SUPABASE = ['sb', 'secret', 'AbCdEfGhIjKlMnOpQrStUvWx'].join('_');
const PHONE = '+33612345678';

function collect() {
  const records: StructuredLogRecord[] = [];
  const logger = createStructuredLogger({
    service: 'test.service',
    sink: (record) => records.push(record),
    now: () => new Date('2026-09-12T10:00:00.000Z'),
  });
  return { records, logger };
}

describe('Phase 10 — logs structurés et redaction (TEST-P10-LOG)', () => {
  it('TEST-P10-LOG-01: ligne JSON complète (niveau, service, corrélation, latence, statut)', () => {
    const { records, logger } = collect();

    const record = logger.info('adventure.generate.completed', {
      correlation_id: 'a1000000-0000-4000-8000-0000000000aa',
      latency_ms: 42,
      status: 201,
      plan_id: 'a6000000-0000-4000-8000-0000000000ee',
    });

    expect(record).toEqual({
      ts: '2026-09-12T10:00:00.000Z',
      level: 'info',
      service: 'test.service',
      event: 'adventure.generate.completed',
      correlation_id: 'a1000000-0000-4000-8000-0000000000aa',
      latency_ms: 42,
      status: 201,
      plan_id: 'a6000000-0000-4000-8000-0000000000ee',
    });
    expect(JSON.parse(JSON.stringify(records[0]))).toEqual(record);
  });

  it('TEST-P10-LOG-02: un e-mail ne sort jamais tel quel (clé, valeur, imbriqué)', () => {
    const record = buildLogRecord(
      { service: 's', level: 'warn', event: 'e', ts: 't' },
      {
        email: EMAIL,
        message: `échec pour ${EMAIL}`,
        nested: { contact_email: EMAIL, note: 'ok' },
      }
    );

    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain(EMAIL);
    expect(serialized).not.toContain('alice.martin');
    expect(record.email).toBe('[redacted:email]');
    expect(record.nested).toEqual({ contact_email: '[redacted:email]', note: 'ok' });
    expect(String(record.message)).toContain('[redacted:email]');
  });

  it('TEST-P10-LOG-03: tokens et clés ne sortent jamais tel quel', () => {
    const record = buildLogRecord(
      { service: 's', level: 'error', event: 'e', ts: 't' },
      {
        access_token: JWT,
        authorization: `Bearer ${JWT}`,
        stripe_key: STRIPE,
        supabase_key: SUPABASE,
        detail: `clé reçue ${STRIPE} et jeton ${JWT}`,
      }
    );

    const serialized = JSON.stringify(record);
    for (const secret of [JWT, STRIPE, SUPABASE]) {
      expect(serialized).not.toContain(secret);
    }
    expect(record.access_token).toBe('[redacted:secret]');
    expect(record.authorization).toBe('[redacted:secret]');
    expect(record.stripe_key).toBe('[redacted:secret]');
    expect(String(record.detail)).toContain('[redacted:token]');
  });

  it('TEST-P10-LOG-04: coordonnées GPS réduites à ~11 km, PII remplacées', () => {
    const record = buildLogRecord(
      { service: 's', level: 'info', event: 'e', ts: 't' },
      {
        lat: 45.123456,
        lng: '2.987654',
        coordinates: { latitude: 45.987654, longitude: 6.123456 },
        phone: PHONE,
        full_name: 'Alice Martin',
        note: `joindre ${PHONE}`,
      }
    );

    expect(record.lat).toBe(45.1);
    expect(record.lng).toBe(3);
    expect(record.coordinates).toEqual({ latitude: 46, longitude: 6.1 });
    expect(record.phone).toBe('[redacted:pii]');
    expect(record.full_name).toBe('[redacted:pii]');
    expect(String(record.note)).toContain('[redacted:phone]');
    expect(JSON.stringify(record)).not.toContain(PHONE);
  });

  it('TEST-P10-LOG-05: profondeur et tableaux bornés (anti-explosion)', () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: { secret: JWT } } } } } } } };
    const array = Array.from({ length: 120 }, (_, index) => index);

    const record = redact({ deep, array }) as Record<string, unknown>;
    expect((record.array as unknown[]).length).toBe(51);
    expect((record.array as unknown[])[50]).toBe('[truncated]');
    expect(JSON.stringify(record)).not.toContain(JWT);
    expect(JSON.stringify(record)).not.toMatch(/eyJ/);
  });

  it('TEST-P10-LOG-06: niveau minimal filtre les lignes (debug exclu en info)', () => {
    const { records, logger } = collect();

    expect(logger.debug('debug.event')).toBeNull();
    expect(logger.info('info.event')).not.toBeNull();
    expect(logger.warn('warn.event')).not.toBeNull();
    expect(logger.error('error.event')).not.toBeNull();
    expect(records.map((record) => record.level)).toEqual(['info', 'warn', 'error']);
  });

  it('TEST-P10-LOG-07: redactString ne touche pas un texte sain ; redactFields préserve le format', () => {
    expect(redactString('précipitations 12 mm à 2400 m')).toBe('précipitations 12 mm à 2400 m');

    const fields = redactFields({
      correlation_id: 'a1000000-0000-4000-8000-0000000000aa',
      latency_ms: 12,
      status: 200,
      token: JWT,
      commentaire: 'rien à signaler',
    });
    expect(fields.correlation_id).toBe('a1000000-0000-4000-8000-0000000000aa');
    expect(fields.latency_ms).toBe(12);
    expect(fields.status).toBe(200);
    expect(fields.token).toBe('[redacted:secret]');
    expect(fields.commentaire).toBe('rien à signaler');
  });

  it('TEST-P10-LOG-08: une Error est sérialisée sans jeter et son message est rédigé', () => {
    const record = buildLogRecord(
      { service: 's', level: 'error', event: 'e', ts: 't' },
      { error: new Error(`login ${EMAIL} refusé`) }
    );

    expect(record.error).toEqual({
      name: 'Error',
      message: 'login [redacted:email] refusé',
    });
    expect(() => JSON.stringify(record)).not.toThrow();
  });
});
