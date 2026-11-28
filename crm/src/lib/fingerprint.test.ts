import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { canonicalize, fingerprint } from './fingerprint';

/**
 * Couche 2 : empreinte des valeurs d'une demande de validation (EX-COM-03).
 * Deux demandes différentes ne doivent jamais produire la même empreinte ; la même
 * demande rejouée doit produire exactement la même, quel que soit l'ordre des clés.
 */

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

describe('canonicalize', () => {
  it('ordonne les clés et supprime les indéfinis', () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalize({ b: 1, a: undefined })).toBe('{"b":1}');
    expect(canonicalize({ a: [{ z: 0, a: 1 }] })).toBe('{"a":[{"a":1,"z":0}]}');
  });

  it('garde les types JSON distincts', () => {
    expect(canonicalize(1)).toBe('1');
    expect(canonicalize('1')).toBe('"1"');
    expect(canonicalize(true)).toBe('true');
    expect(canonicalize(null)).toBe('null');
    expect(canonicalize('null')).toBe('"null"');
    expect(canonicalize(0)).not.toBe(canonicalize(false));
  });

  it('respecte l’ordre des tableaux (une liste n’est pas un ensemble)', () => {
    expect(canonicalize([1, 2])).not.toBe(canonicalize([2, 1]));
    expect(canonicalize(['a', 'b'])).toBe('["a","b"]');
  });

  it('échappe les guillemets sans ambiguïté', () => {
    expect(canonicalize('x"y')).toBe('"x\\"y"');
    expect(canonicalize({ k: 'a"b' })).toBe('{"k":"a\\"b"}');
  });
});

describe('fingerprint', () => {
  it('produit un SHA-256 hexadécimal de 64 caractères', async () => {
    const value = await fingerprint({ command: 'order_refund', params: { order_id: 'o-1', amount_cents: 1200 } });
    expect(value).toMatch(/^[0-9a-f]{64}$/);
    expect(value).toBe(sha256(canonicalize({ command: 'order_refund', params: { order_id: 'o-1', amount_cents: 1200 } })));
  });

  it('est stable quand l’ordre des clés change, y compris imbriquées', async () => {
    const a = await fingerprint({ amount_cents: 1200, command: 'order_refund', params: { reason: 'faulty', order_id: 'o-1' } });
    const b = await fingerprint({ command: 'order_refund', params: { order_id: 'o-1', reason: 'faulty' }, amount_cents: 1200 });
    expect(a).toBe(b);
  });

  it('change dès qu’une valeur, un type ou une liste change', async () => {
    const base = { command: 'post_hide', params: { post_id: 'p-1', reason: 'spam' } };
    const variants = [
      { ...base, params: { ...base.params, reason: 'spam ' } },
      { ...base, params: { ...base.params, post_id: 'p-2' } },
      { ...base, params: { ...base.params, reason: 'SPAM' } },
      { ...base, command: 'post_remove' },
      { ...base, params: { ...base.params, reason: 'spam', extra: 0 } }
    ];
    const thumbprint = await fingerprint(base);
    for (const variant of variants) {
      expect(await fingerprint(variant)).not.toBe(thumbprint);
    }
  });

  it('distingue un nombre d’une chaîne et une absence d’un zéro', async () => {
    expect(await fingerprint({ amount_cents: 1000 })).not.toBe(await fingerprint({ amount_cents: '1000' }));
    expect(await fingerprint({ amount_cents: 0 })).not.toBe(await fingerprint({}));
    expect(await fingerprint({ reason: null })).not.toBe(await fingerprint({}));
    expect(await fingerprint({ reason: null })).not.toBe(await fingerprint({ reason: 'null' }));
  });

  it('est déterministe entre deux calculs successifs', async () => {
    const value = { command: 'member_ban', params: { user_id: 'u-1', days: 30 } };
    expect(await fingerprint(value)).toBe(await fingerprint(value));
  });
});
