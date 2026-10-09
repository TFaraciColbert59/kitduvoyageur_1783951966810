/** Plan 2.9 : erreurs serveur gardées sans donnée personnelle, jamais bloquantes. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ rows: [] as unknown[], fail: false as false | 'insert' | 'client' }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: () =>
    h.fail === 'client'
      ? null
      : {
          from: () => ({
            insert: async (row: unknown) => {
              if (h.fail === 'insert') return { error: { code: '42501' } };
              h.rows.push(row);
              return { error: null };
            },
          }),
        },
}));

import { appErrorRow, reportServerError } from '@/lib/observability/appErrors';

beforeEach(() => {
  h.rows = [];
  h.fail = false;
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('ligne d’erreur', () => {
  it('ni e-mail, ni identifiant, ni adresse IP ; message tronqué à 300', () => {
    const err = new Error(
      `échec pour tony@example.com trip 11111111-1111-4111-8111-111111111111 depuis 203.0.113.7 ${'x'.repeat(400)}`
    );
    const row = appErrorRow('compas.compasInterpretAction', err);
    expect(row.message).not.toContain('tony@example.com');
    expect(row.message).not.toContain('11111111-1111-4111-8111-111111111111');
    expect(row.message).not.toContain('203.0.113.7');
    expect(row.message.length).toBeLessThanOrEqual(300);
    expect(row.scope).toBe('compas.compasInterpretAction');
  });

  it('code : celui de l’erreur s’il existe, sinon son nom', () => {
    expect(appErrorRow('s', Object.assign(new Error('x'), { code: 'PGRST116' })).code).toBe('PGRST116');
    expect(appErrorRow('s', new TypeError('x')).code).toBe('TypeError');
    expect(appErrorRow('s', 'texte').code).toBeNull();
  });
});

describe('enregistrement', () => {
  it('écrit la ligne rédigée', async () => {
    await reportServerError('compas.test', new Error('boum'));
    expect(h.rows).toEqual([{ scope: 'compas.test', code: 'Error', message: 'boum' }]);
  });

  it('table ou clé indisponible : jamais d’exception', async () => {
    h.fail = 'insert';
    await expect(reportServerError('compas.test', new Error('boum'))).resolves.toBeUndefined();
    h.fail = 'client';
    await expect(reportServerError('compas.test', new Error('boum'))).resolves.toBeUndefined();
  });
});
