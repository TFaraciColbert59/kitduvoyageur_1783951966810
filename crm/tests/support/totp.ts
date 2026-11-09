import { createHmac } from 'node:crypto';

/**
 * TOTP RFC 6238 (HMAC-SHA1, 6 chiffres, pas de 30 s) pour l'enrôlement et la
 * connexion à double authentification du compte de test.
 *
 * Aucune dépendance : le code du test ne doit pas dépendre d'un paquet qui
 * pourrait changer les codes sans qu'on le voie.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Décode un secret base32 (RFC 4648, sans padding), casse et espaces tolérés. */
export function base32Decode(secret: string): Buffer {
  const clean = secret.replace(/[\s-]/g, '').toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error(`Secret TOTP invalide : caractère « ${char} » hors base32.`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Code à 6 chiffres pour un instant donné (par défaut, maintenant). */
export function totpCode(secret: string, at: number = Date.now(), stepSeconds = 30): string {
  const key = base32Decode(secret);
  const counter = Math.floor(at / 1000 / stepSeconds);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x1_0000_0000), 0);
  buffer.writeUInt32BE(counter % 0x1_0000_0000, 4);
  const digest = createHmac('sha1', key).update(buffer).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

/** Code précédent, utile si le test démarre à la charnière d'un pas de 30 s. */
export function totpCodes(secret: string, at: number = Date.now()): string[] {
  return [totpCode(secret, at), totpCode(secret, at - 30_000)];
}
