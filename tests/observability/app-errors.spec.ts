/** Plan 2.9 : erreurs serveur gardées sans donnée personnelle, jamais bloquantes. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ rows: [] as unknown[], fail: false as false | 'insert' | 'client' | 'hang' }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: () =>
    h.fail === 'client'
      ? null
      : {
          from: () => ({
            insert: async (row: unknown) => {
              if (h.fail === 'hang') return new Promise<never>(() => undefined);
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

afterEach(() => {
  vi.useRealTimers();
});

const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;

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

describe('ligne d’erreur : identifiants et adresses collés à un mot', () => {
  const UUID = '11111111-1111-4111-8111-111111111111';

  it.each([`trip_${UUID}`, `trip-${UUID}x`, `id=${UUID}`, `(${UUID})`, UUID.toUpperCase()])(
    'identifiant retiré : %s',
    (text) => {
      const { message } = appErrorRow('s', new Error(`échec ${text} fin`));
      expect(message.toLowerCase()).not.toContain(UUID);
      expect(message).toContain('[id]');
    }
  );

  it('adresse IPv4 collée à un mot (_) retirée', () => {
    expect(appErrorRow('s', new Error('ip_203.0.113.7 fin')).message).not.toContain('203.0.113.7');
  });

  it.each([
    '2001:db8::1',
    '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
    'fe80::1',
    '::1',
    '::ffff:203.0.113.7',
    '2001:DB8::ABCD',
  ])('adresse IPv6 retirée : %s', (addr) => {
    const { message } = appErrorRow('s', new Error(`depuis ${addr} puis fin`));
    expect(message).not.toContain(addr);
    expect(message).not.toContain('203.0.113.7');
    expect(message).toContain('[ip]');
    expect(message).toContain('puis fin');
  });

  it('une heure ordinaire reste lisible', () => {
    expect(appErrorRow('s', new Error('départ à 12:30')).message).toBe('départ à 12:30');
    expect(appErrorRow('s', new Error('à 12:30:45 [id] fin')).message).toBe('à 12:30:45 [id] fin');
    expect(appErrorRow('s', new Error('Erreur: échec de la requête')).message).toBe('Erreur: échec de la requête');
  });
});

describe('ligne d’erreur : caractères', () => {
  it('troncature par points de code : jamais de demi-paire de substitution', () => {
    const { message } = appErrorRow('s', new Error('🏔'.repeat(400)));
    expect(Array.from(message)).toHaveLength(300);
    expect(message).not.toMatch(LONE_SURROGATE);
  });

  it('demi-paire isolée dans le texte d’origine : retirée', () => {
    const { message } = appErrorRow('s', new Error('a\ud83cb\udc00c'));
    expect(message).toBe('abc');
  });

  it('caractères de contrôle retirés (Postgres refuse \\u0000)', () => {
    expect(appErrorRow('s', new Error('a\u0000b')).message).toBe('ab');
    expect(appErrorRow('s', new Error('a\u001fb\u007fc\td\ne')).message).toBe('abc\td\ne');
  });

  it('un caractère de contrôle ne contourne pas la rédaction', () => {
    expect(appErrorRow('s', new Error('to\u0000ny@example.com')).message).not.toContain('@example.com');
  });

  it('message vide après nettoyage : « erreur »', () => {
    expect(appErrorRow('s', new Error('\u0000')).message).toBe('erreur');
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

  it('insertion qui ne répond jamais : rend la main après 2 s, sans exception', async () => {
    vi.useFakeTimers();
    h.fail = 'hang';
    let done = false;
    const p = reportServerError('compas.test', new Error('boum')).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(1999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toBeUndefined();
    expect(done).toBe(true);
  });

  it('insertion réussie : le minuteur est annulé', async () => {
    vi.useFakeTimers();
    await reportServerError('compas.test', new Error('boum'));
    expect(h.rows).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('migration app_errors', () => {
  const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261009090000_app_errors.sql'), 'utf8');

  it('alertes ajoutées par array_append (|| avec un texte lirait un tableau)', () => {
    expect(sql.match(/array_append\(v_alerts/g)).toHaveLength(3);
    expect(sql).not.toMatch(/v_alerts\s*\|\|/);
  });
});
