/**
 * Phase 6 — Coffre local chiffré (WebCrypto AES-GCM 256).
 *
 * Objectif : ne jamais laisser en clair, au repos sur l'appareil, les données
 * sensibles hors-ligne (brouillon de session GPS, contenus de carnet mis en
 * file). Le coffre :
 *
 * - chiffre en AES-GCM 256 via `crypto.subtle` (IV aléatoire 96 bits) ;
 * - persiste la clé dans IndexedDB sous forme de `CryptoKey` **non
 *   extractible** (`extractable: false`) : la clé ne peut pas être lue par le
 *   JavaScript applicatif, seuls `encrypt`/`decrypt` l'utilisent ;
 * - ne prétend PAS chiffrer quand WebCrypto ou IndexedDB manquent : l'appelant
 *   reçoit `null` et doit alors choisir explicitement un repli documenté.
 *
 * Le format d'enveloppe est versionné (`__lkdv_vault: 1`) pour permettre une
 * migration de schéma sans casser les lectures.
 */

/** Nom de la base IndexedDB des clés (jamais les données). */
export const LOCAL_VAULT_DB_NAME = 'lkdv-local-vault';
/** Object store des clés. */
export const LOCAL_VAULT_STORE_NAME = 'keys';
/** Identifiant de la clé AES-GCM du coffre. */
export const LOCAL_VAULT_KEY_ID = 'aes-gcm-256';
/** Marqueur d'enveloppe chiffrée. */
export const LOCAL_VAULT_ENVELOPE_KEY = '__lkdv_vault';
/** Version du format d'enveloppe. */
export const LOCAL_VAULT_ENVELOPE_VERSION = 1;

export interface LocalVaultEnvelope {
  __lkdv_vault: typeof LOCAL_VAULT_ENVELOPE_VERSION;
  /** IV AES-GCM, base64. */
  iv: string;
  /** Texte chiffré (AES-GCM), base64. */
  data: string;
}

/** Persistance de la clé (IndexedDB en navigateur, mémoire en test). */
export interface LocalVaultKeyStore {
  getKey(): Promise<CryptoKey | null>;
  setKey(key: CryptoKey): Promise<void>;
}

export interface LocalVaultDeps {
  cryptoImpl?: Crypto;
  keyStore?: LocalVaultKeyStore;
}

export interface LocalVault {
  getKey(): Promise<CryptoKey>;
  encryptJson(value: unknown): Promise<LocalVaultEnvelope>;
  decryptJson<T = unknown>(envelope: LocalVaultEnvelope | string): Promise<T>;
}

/** Enveloppe valide (version 1, champs base64 non vides). */
export function isLocalVaultEnvelope(value: unknown): value is LocalVaultEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    record[LOCAL_VAULT_ENVELOPE_KEY] === LOCAL_VAULT_ENVELOPE_VERSION &&
    typeof record.iv === 'string' &&
    record.iv.length > 0 &&
    typeof record.data === 'string' &&
    record.data.length > 0
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** Message d'erreur explicite quand WebCrypto est indisponible. */
export const LOCAL_VAULT_UNAVAILABLE_ERROR = 'local_vault_webcrypto_indisponible';

/** Coffre construit sur un `Crypto` injecté et un `KeyStore` injecté. */
export function createLocalVault(deps: LocalVaultDeps = {}): LocalVault {
  const cryptoImpl = deps.cryptoImpl ?? globalThis.crypto;
  if (!cryptoImpl?.subtle) {
    throw new Error(LOCAL_VAULT_UNAVAILABLE_ERROR);
  }
  const keyStore = deps.keyStore ?? createIndexedDbKeyStore();
  let keyPromise: Promise<CryptoKey> | null = null;

  async function getKey(): Promise<CryptoKey> {
    if (!keyPromise) {
      keyPromise = (async () => {
        const existing = await keyStore.getKey();
        if (existing) return existing;
        const generated = (await cryptoImpl.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        )) as CryptoKey;
        await keyStore.setKey(generated);
        return generated;
      })();
    }
    return keyPromise;
  }

  return {
    getKey,

    async encryptJson(value) {
      const key = await getKey();
      const iv = cryptoImpl.getRandomValues(new Uint8Array(12));
      const plaintext = new TextEncoder().encode(JSON.stringify(value));
      const ciphertext = await cryptoImpl.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        plaintext as unknown as BufferSource
      );
      return {
        [LOCAL_VAULT_ENVELOPE_KEY]: LOCAL_VAULT_ENVELOPE_VERSION,
        iv: bytesToBase64(iv),
        data: bytesToBase64(new Uint8Array(ciphertext)),
      };
    },

    async decryptJson<T = unknown>(envelope: LocalVaultEnvelope | string): Promise<T> {
      const parsed: unknown = typeof envelope === 'string' ? JSON.parse(envelope) : envelope;
      if (!isLocalVaultEnvelope(parsed)) {
        throw new Error('local_vault_enveloppe_invalide');
      }
      const key = await getKey();
      const plaintext = await cryptoImpl.subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToBytes(parsed.iv) as unknown as BufferSource },
        key,
        base64ToBytes(parsed.data) as unknown as BufferSource
      );
      return JSON.parse(new TextDecoder().decode(plaintext)) as T;
    },
  };
}

// ── KeyStore IndexedDB (navigateur) ──────────────────────────────────────────

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexeddb_echec'));
  });
}

function openVaultDatabase(indexedDb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(LOCAL_VAULT_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LOCAL_VAULT_STORE_NAME)) {
        db.createObjectStore(LOCAL_VAULT_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexeddb_ouverture_echec'));
  });
}

/**
 * KeyStore navigateur : la clé non extractible est stockée telle quelle dans
 * IndexedDB (clonage structuré des `CryptoKey` supporté par les navigateurs
 * modernes). Aucun export, aucune sérialisation du matériel de clé.
 */
export function createIndexedDbKeyStore(indexedDb: IDBFactory = globalThis.indexedDB): LocalVaultKeyStore {
  if (!indexedDb) throw new Error('local_vault_indexeddb_indisponible');
  let dbPromise: Promise<IDBDatabase> | null = null;
  const openDb = () => {
    if (!dbPromise) dbPromise = openVaultDatabase(indexedDb);
    return dbPromise;
  };

  return {
    async getKey() {
      const db = await openDb();
      return new Promise<CryptoKey | null>((resolve, reject) => {
        const tx = db.transaction(LOCAL_VAULT_STORE_NAME, 'readonly');
        requestToPromise(tx.objectStore(LOCAL_VAULT_STORE_NAME).get(LOCAL_VAULT_KEY_ID))
          .then((value) =>
            resolve(
              typeof CryptoKey !== 'undefined' && value instanceof CryptoKey ? value : null
            )
          )
          .catch(reject);
      });
    },

    async setKey(key) {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(LOCAL_VAULT_STORE_NAME, 'readwrite');
        tx.objectStore(LOCAL_VAULT_STORE_NAME).put(key, LOCAL_VAULT_KEY_ID);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('indexeddb_ecriture_echec'));
        tx.onabort = () => reject(tx.error ?? new Error('indexeddb_ecriture_abandonnee'));
      });
    },
  };
}

// ── Singleton applicatif ─────────────────────────────────────────────────────

let singleton: LocalVault | null | undefined;
let singletonPromise: Promise<LocalVault | null> | null = null;

/**
 * Coffre de l'application, ou `null` si WebCrypto/IndexedDB manquent. Ne jette
 * jamais : l'appelant décide du repli (et doit le documenter).
 */
export function getLocalVault(): Promise<LocalVault | null> {
  if (singleton !== undefined) return Promise.resolve(singleton);
  if (!singletonPromise) {
    singletonPromise = (async () => {
      try {
        if (typeof globalThis.crypto?.subtle === 'undefined') {
          singleton = null;
          return null;
        }
        if (typeof globalThis.indexedDB === 'undefined') {
          singleton = null;
          return null;
        }
        singleton = createLocalVault({});
        return singleton;
      } catch {
        singleton = null;
        return null;
      }
    })();
  }
  return singletonPromise;
}

/** Réinitialise le singleton (tests). */
export function resetLocalVault(): void {
  singleton = undefined;
  singletonPromise = null;
}

/** Chiffre une valeur JSON, ou `null` si le coffre est indisponible. */
export function encryptLocalJson(value: unknown): Promise<LocalVaultEnvelope | null> {
  return getLocalVault().then((vault) => (vault ? vault.encryptJson(value) : null));
}

/**
 * Déchiffre une enveloppe (ou sa sérialisation), `null` si le coffre est
 * indisponible. Jette si l'enveloppe est valide mais altérée (auth AES-GCM).
 */
export async function decryptLocalJson<T = unknown>(
  envelope: LocalVaultEnvelope | string
): Promise<T | null> {
  const vault = await getLocalVault();
  if (!vault) return null;
  return vault.decryptJson<T>(envelope);
}
