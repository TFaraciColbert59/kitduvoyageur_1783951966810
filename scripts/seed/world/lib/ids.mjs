// UUID v5 déterministes : le même monde rejoué produit exactement les mêmes IDs.
import { createHash } from 'node:crypto';

// Namespace propre au Monde LKDV (ne pas changer sans invalider le manifeste).
export const WORLD_NAMESPACE = 'b7e1f0a2-4c3d-5e6f-8a9b-0c1d2e3f4a5b';

function uuidToBytes(uuid) {
  const hex = uuid.replace(/-/g, '');
  if (hex.length !== 32) throw new Error(`UUID invalide: ${uuid}`);
  return Buffer.from(hex, 'hex');
}

export function uuidv5(name, namespace = WORLD_NAMESPACE) {
  const ns = uuidToBytes(namespace);
  const hash = createHash('sha1')
    .update(Buffer.concat([ns, Buffer.from(String(name), 'utf8')]))
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const id = (name) => uuidv5(name);

export function personaId(key) {
  return uuidv5(`persona:${key}`);
}

export function entityId(entity, key) {
  return uuidv5(`${entity}:${key}`);
}

// Identifiant court lisible pour les slugs et handles.
export function slugify(input) {
  return String(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function handleFor(persona) {
  const first = persona.first ?? persona.firstName ?? 'voyageur';
  const last = persona.last ?? persona.lastName ?? 'lkdv';
  return `${slugify(first)}.${slugify(last)}`;
}
