/**
 * Décodeur FIT minimal (5.9) : pur, sans dépendance, sans réseau, déterministe.
 *
 * Il lit l'en-tête (12 ou 14 octets), les définitions de messages (little/big endian, champs développeur
 * sautés) et les messages de données, puis ne retient que les messages `record` (numéro global 20) : position
 * (semicircles → degrés), altitude (`enhanced_altitude`, sinon `altitude`) et horodatage. Les en-têtes de
 * temps compressé sont suivis. La CRC n'est pas recalculée (ignorée), mais la taille déclarée est contrôlée :
 * un fichier coupé ou incohérent est refusé avec une raison, jamais lu à moitié.
 *
 * Un `record` sans position (GPS perdu, séance en salle) n'est pas un point de tracé : il est compté dans
 * `skippedPoints`, jamais inventé. Les mesures de capteur (fréquence cardiaque, puissance) ne sont pas lues.
 */

export interface FitPoint {
  readonly lat: number;
  readonly lon: number;
  readonly ele?: number;
  readonly time?: string;
}

export type FitDecodeResult =
  | {
      readonly ok: true;
      readonly points: readonly FitPoint[];
      /** Messages `record` sans position valide, écartés. */
      readonly skippedPoints: number;
      readonly protocolVersion: number;
    }
  | { readonly ok: false; readonly code: 'invalid_content' | 'no_points'; readonly message: string };

const FIT_EPOCH_SECONDS = 631_065_600;
/** Les horodatages FIT sous cette valeur sont relatifs (pas une date) : ignorés. */
const FIT_MIN_ABSOLUTE_TIMESTAMP = 0x1000_0000;
const GLOBAL_RECORD = 20;
const SEMICIRCLE_TO_DEG = 180 / 2 ** 31;

const F_TIMESTAMP = 253;
const F_LAT = 0;
const F_LON = 1;
const F_ALTITUDE = 2;
const F_ENHANCED_ALTITUDE = 78;

const corrupt = (message: string): FitDecodeResult => ({ ok: false, code: 'invalid_content', message });

interface FieldDef {
  readonly num: number;
  readonly size: number;
  /** Type de base FIT (5 bits bas de l'octet de type). */
  readonly base: number;
}

interface MessageDef {
  readonly little: boolean;
  readonly global: number;
  readonly fields: readonly FieldDef[];
  readonly devBytes: number;
  readonly totalSize: number;
}

/** Taille des types de base FIT (index = numéro de type). */
const BASE_SIZE: Readonly<Record<number, number>> = {
  0: 1, 1: 1, 2: 1, 3: 2, 4: 2, 5: 4, 6: 4, 7: 1, 8: 4, 9: 8, 10: 1, 11: 2, 12: 4, 13: 1, 14: 8, 15: 8, 16: 8,
};

/** Entier d'un champ, ou `null` si la valeur est « invalide » au sens FIT (tous les bits à 1) ou non entière. */
function readInt(view: DataView, at: number, field: FieldDef, little: boolean): number | null {
  if (field.size !== BASE_SIZE[field.base]) return null;
  switch (field.base) {
    case 1: {
      const v = view.getInt8(at);
      return v === 0x7f ? null : v;
    }
    case 0:
    case 2:
    case 13: {
      const v = view.getUint8(at);
      return v === 0xff ? null : v;
    }
    case 3: {
      const v = view.getInt16(at, little);
      return v === 0x7fff ? null : v;
    }
    case 4: {
      const v = view.getUint16(at, little);
      return v === 0xffff ? null : v;
    }
    case 5: {
      const v = view.getInt32(at, little);
      return v === 0x7fff_ffff ? null : v;
    }
    case 6: {
      const v = view.getUint32(at, little);
      return v === 0xffff_ffff ? null : v;
    }
    default:
      return null;
  }
}

export function decodeFit(input: ArrayBuffer | ArrayBufferView): FitDecodeResult {
  const bytes =
    input instanceof ArrayBuffer
      ? new Uint8Array(input)
      : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  if (bytes.length < 12) return corrupt('Fichier FIT incomplet : l’en-tête est illisible.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerSize = bytes[0];
  if (headerSize !== 12 && headerSize !== 14) return corrupt('Ce fichier n’est pas un FIT valide (en-tête inattendu).');
  if (String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) !== '.FIT') {
    return corrupt('Ce fichier n’est pas un FIT : la signature « .FIT » est absente.');
  }
  const protocolVersion = bytes[1];
  if (protocolVersion >> 4 > 2) return corrupt('Version du protocole FIT non prise en charge.');
  const dataSize = view.getUint32(4, true);
  const dataEnd = headerSize + dataSize;
  // Taille contrôlée : les données déclarées et leur CRC finale (2 octets) doivent être présentes.
  if (dataSize === 0) return corrupt('Fichier FIT vide : aucune donnée après l’en-tête.');
  if (bytes.length < dataEnd + 2) {
    return corrupt('Fichier FIT incomplet ou corrompu : sa taille est inférieure à celle que l’en-tête annonce.');
  }

  const defs = new Map<number, MessageDef>();
  const points: FitPoint[] = [];
  let skipped = 0;
  let lastTimestamp: number | null = null;
  let pos = headerSize;

  while (pos < dataEnd) {
    const h = bytes[pos];
    pos += 1;
    if ((h & 0x80) !== 0) {
      // Message de données à temps compressé : type local sur 2 bits, décalage de temps sur 5 bits.
      const local = (h >> 5) & 0x03;
      const def = defs.get(local);
      if (!def) return corrupt('Fichier FIT corrompu : un message de données précède sa définition.');
      if (pos + def.totalSize > dataEnd) return corrupt('Fichier FIT corrompu : message de données tronqué.');
      let ts: number | null = null;
      if (lastTimestamp != null) {
        const offset = h & 0x1f;
        ts = (lastTimestamp & ~0x1f) + offset;
        if (offset < (lastTimestamp & 0x1f)) ts += 0x20;
        lastTimestamp = ts;
      }
      const rec = readData(view, pos, def, ts);
      pos += def.totalSize;
      if (rec.timestamp != null) lastTimestamp = rec.timestamp;
      if (rec.point) points.push(rec.point);
      else if (rec.isRecord) skipped += 1;
      continue;
    }
    const local = h & 0x0f;
    if ((h & 0x40) !== 0) {
      const hasDev = (h & 0x20) !== 0;
      if (pos + 5 > dataEnd) return corrupt('Fichier FIT corrompu : définition de message tronquée.');
      const little = bytes[pos + 1] === 0;
      if (bytes[pos + 1] > 1) return corrupt('Fichier FIT corrompu : architecture de définition inconnue.');
      const global = view.getUint16(pos + 2, little);
      const n = bytes[pos + 4];
      pos += 5;
      if (pos + n * 3 > dataEnd) return corrupt('Fichier FIT corrompu : définition de message tronquée.');
      const fields: FieldDef[] = [];
      let total = 0;
      for (let i = 0; i < n; i += 1) {
        const size = bytes[pos + 1];
        fields.push({ num: bytes[pos], size, base: bytes[pos + 2] & 0x1f });
        total += size;
        pos += 3;
      }
      let devBytes = 0;
      if (hasDev) {
        if (pos >= dataEnd) return corrupt('Fichier FIT corrompu : définition développeur tronquée.');
        const dn = bytes[pos];
        pos += 1;
        if (pos + dn * 3 > dataEnd) return corrupt('Fichier FIT corrompu : définition développeur tronquée.');
        for (let i = 0; i < dn; i += 1) {
          devBytes += bytes[pos + 1];
          pos += 3;
        }
      }
      defs.set(local, { little, global, fields, devBytes, totalSize: total + devBytes });
      continue;
    }
    const def = defs.get(local);
    if (!def) return corrupt('Fichier FIT corrompu : un message de données précède sa définition.');
    if (pos + def.totalSize > dataEnd) return corrupt('Fichier FIT corrompu : message de données tronqué.');
    const rec = readData(view, pos, def, null);
    pos += def.totalSize;
    if (rec.timestamp != null) lastTimestamp = rec.timestamp;
    if (rec.point) points.push(rec.point);
    else if (rec.isRecord) skipped += 1;
  }

  if (points.length === 0) {
    return {
      ok: false,
      code: 'no_points',
      message: 'Ce fichier FIT ne contient aucune position GPS (séance en salle ou GPS coupé).',
    };
  }
  return { ok: true, points, skippedPoints: skipped, protocolVersion };
}

interface DataRead {
  /** Horodatage FIT du message (champ 253 ou temps compressé), pour suivre les en-têtes compressés. */
  readonly timestamp: number | null;
  readonly isRecord: boolean;
  /** Point de tracé : `null` pour un `record` sans position valide. */
  readonly point: FitPoint | null;
}

function readData(view: DataView, start: number, def: MessageDef, compressedTs: number | null): DataRead {
  const isRecord = def.global === GLOBAL_RECORD;
  let at = start;
  let ts: number | null = compressedTs;
  let latRaw: number | null = null;
  let lonRaw: number | null = null;
  let alt: number | null = null;
  let enhanced: number | null = null;
  for (const f of def.fields) {
    if (f.num === F_TIMESTAMP) ts = readInt(view, at, f, def.little) ?? ts;
    else if (isRecord && f.num === F_LAT) latRaw = readInt(view, at, f, def.little);
    else if (isRecord && f.num === F_LON) lonRaw = readInt(view, at, f, def.little);
    else if (isRecord && f.num === F_ALTITUDE) alt = readInt(view, at, f, def.little);
    else if (isRecord && f.num === F_ENHANCED_ALTITUDE) enhanced = readInt(view, at, f, def.little);
    at += f.size;
  }
  if (!isRecord || latRaw == null || lonRaw == null) return { timestamp: ts, isRecord, point: null };
  const lat = latRaw * SEMICIRCLE_TO_DEG;
  const lon = lonRaw * SEMICIRCLE_TO_DEG;
  if (!(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) return { timestamp: ts, isRecord, point: null };
  const rawEle = enhanced ?? alt;
  const ele = rawEle == null ? undefined : Math.round((rawEle / 5 - 500) * 10) / 10;
  const absolute = ts != null && ts >= FIT_MIN_ABSOLUTE_TIMESTAMP ? ts : null;
  return {
    timestamp: ts,
    isRecord,
    point: {
      lat: Math.round(lat * 1e7) / 1e7,
      lon: Math.round(lon * 1e7) / 1e7,
      ...(ele !== undefined ? { ele } : {}),
      ...(absolute != null ? { time: new Date((absolute + FIT_EPOCH_SECONDS) * 1000).toISOString() } : {}),
    },
  };
}
