/**
 * Phase 6 — Coffre local chiffré WebCrypto (TEST-PHASE6-VAULT).
 *
 *   • TEST-PHASE6-VAULT-01 : chiffrement/déchiffrement JSON aller-retour ;
 *   • TEST-PHASE6-VAULT-02 : le stockage ne contient jamais le clair ;
 *   • TEST-PHASE6-VAULT-03 : clé AES-GCM 256 non extractible, générée une fois ;
 *   • TEST-PHASE6-VAULT-04 : une enveloppe altérée est rejetée (auth GCM) ;
 *   • TEST-PHASE6-VAULT-05 : deux coffres partageant la clé se relisent ;
 *   • TEST-PHASE6-VAULT-06 : détection d'enveloppe + indisponibilité explicite.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  LOCAL_VAULT_ENVELOPE_KEY,
  LOCAL_VAULT_ENVELOPE_VERSION,
  createLocalVault,
  getLocalVault,
  isLocalVaultEnvelope,
  resetLocalVault,
  type LocalVaultKeyStore,
} from '@/lib/security/localVault';

class MemoryKeyStore implements LocalVaultKeyStore {
  key: CryptoKey | null = null;
  setCalls = 0;

  async getKey(): Promise<CryptoKey | null> {
    return this.key;
  }

  async setKey(key: CryptoKey): Promise<void> {
    this.key = key;
    this.setCalls += 1;
  }
}

const SNAPSHOT = {
  routeId: 'route-42',
  distanceKm: 12.4,
  positions: [
    { latitude: 45.123456, longitude: 6.654321, timestamp: 1_760_000_000_000 },
    { latitude: 45.223456, longitude: 6.754321, timestamp: 1_760_000_600_000 },
  ],
  note: 'Bivouac au refuge — donnée sensible',
};

afterEach(() => {
  resetLocalVault();
  vi.unstubAllGlobals();
});

describe('Phase 6 — coffre local chiffré (TEST-PHASE6-VAULT)', () => {
  it('TEST-PHASE6-VAULT-01: aller-retour JSON exact', async () => {
    const keyStore = new MemoryKeyStore();
    const vault = createLocalVault({ keyStore });

    const envelope = await vault.encryptJson(SNAPSHOT);
    expect(isLocalVaultEnvelope(envelope)).toBe(true);
    expect(envelope.iv.length).toBeGreaterThan(0);
    expect(envelope.data.length).toBeGreaterThan(0);

    const decrypted = await vault.decryptJson<typeof SNAPSHOT>(envelope);
    expect(decrypted).toEqual(SNAPSHOT);
  });

  it('TEST-PHASE6-VAULT-02: le stockage ne contient jamais le clair', async () => {
    const keyStore = new MemoryKeyStore();
    const vault = createLocalVault({ keyStore });

    const envelope = await vault.encryptJson(SNAPSHOT);
    const stored = JSON.stringify(envelope);

    expect(stored).not.toContain('45.123456');
    expect(stored).not.toContain('refuge');
    expect(stored).not.toContain('route-42');
    expect(stored).toContain(LOCAL_VAULT_ENVELOPE_KEY);
  });

  it('TEST-PHASE6-VAULT-03: clé AES-GCM 256 non extractible, générée une seule fois', async () => {
    const keyStore = new MemoryKeyStore();
    const vault = createLocalVault({ keyStore });

    await vault.encryptJson({ a: 1 });
    await vault.encryptJson({ a: 2 });
    const key = await vault.getKey();

    expect(key.type).toBe('secret');
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });
    expect(key.extractable).toBe(false);
    expect(keyStore.setCalls).toBe(1);
    expect(keyStore.key).toBe(key);
  });

  it('TEST-PHASE6-VAULT-04: enveloppe altérée rejetée (intégrité AES-GCM)', async () => {
    const keyStore = new MemoryKeyStore();
    const vault = createLocalVault({ keyStore });
    const envelope = await vault.encryptJson(SNAPSHOT);

    const tampered = { ...envelope, data: `${envelope.data.slice(0, -4)}AAAA` };
    await expect(vault.decryptJson(tampered)).rejects.toBeTruthy();

    const malformed = { [LOCAL_VAULT_ENVELOPE_KEY]: LOCAL_VAULT_ENVELOPE_VERSION, iv: '', data: 'x' };
    await expect(vault.decryptJson(malformed as never)).rejects.toThrow(
      'local_vault_enveloppe_invalide'
    );
  });

  it('TEST-PHASE6-VAULT-05: deux coffres partageant la clé se relisent', async () => {
    const keyStore = new MemoryKeyStore();
    const first = createLocalVault({ keyStore });
    const envelope = await first.encryptJson(SNAPSHOT);

    // Redémarrage applicatif : nouveau coffre, même KeyStore persistant.
    const second = createLocalVault({ keyStore });
    const decrypted = await second.decryptJson<typeof SNAPSHOT>(envelope);
    expect(decrypted).toEqual(SNAPSHOT);
  });

  it('TEST-PHASE6-VAULT-06: détection d’enveloppe et indisponibilité explicite', async () => {
    expect(
      isLocalVaultEnvelope({
        [LOCAL_VAULT_ENVELOPE_KEY]: LOCAL_VAULT_ENVELOPE_VERSION,
        iv: 'aXY=',
        data: 'ZGF0YQ==',
      })
    ).toBe(true);
    expect(isLocalVaultEnvelope({ [LOCAL_VAULT_ENVELOPE_KEY]: 99, iv: 'a', data: 'b' })).toBe(
      false
    );
    expect(isLocalVaultEnvelope(null)).toBe(false);
    expect(isLocalVaultEnvelope({ positions: [] })).toBe(false);

    // Sans WebCrypto, la construction échoue avec un message explicite.
    expect(() => createLocalVault({ cryptoImpl: {} as Crypto })).toThrow(
      'local_vault_webcrypto_indisponible'
    );

    // Sans IndexedDB, le coffre applicatif est indisponible (jamais un faux coffre).
    resetLocalVault();
    const vault = await getLocalVault();
    expect(vault).toBeNull();
  });
});
