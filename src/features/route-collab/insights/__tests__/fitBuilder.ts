/** Construit un petit fichier FIT valide en mémoire (tests de 5.9) : en-tête, définitions, messages `record`, CRC. */

export interface FitRecordInput {
  readonly lat?: number;
  readonly lon?: number;
  readonly alt?: number;
  readonly enhancedAlt?: number;
  /** Secondes depuis l'époque FIT (1989-12-31). */
  readonly ts?: number;
}

export const semi = (deg: number): number => Math.round((deg * 2 ** 31) / 180);

function crc16(bytes: readonly number[]): number {
  const table = [0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001, 0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400];
  let crc = 0;
  for (const b of bytes) {
    let tmp = table[crc & 0xf];
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ table[b & 0xf];
    tmp = table[crc & 0xf];
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ table[(b >> 4) & 0xf];
  }
  return crc;
}

function u16(v: number, little: boolean): number[] {
  return little ? [v & 0xff, (v >> 8) & 0xff] : [(v >> 8) & 0xff, v & 0xff];
}
function u32(v: number, little: boolean): number[] {
  const n = v >>> 0;
  const b = [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
  return little ? b : b.reverse();
}

export function buildFit(opts: {
  records: readonly FitRecordInput[];
  bigEndian?: boolean;
  headerSize?: 12 | 14;
  /** Ajoute un message `file_id` (global 0) avec un champ développeur de 2 octets avant les records. */
  withNoise?: boolean;
  /** Passe en temps compressé pour les records après le premier (en-tête 0x80 | local<<5 | décalage). */
  compressed?: boolean;
}): Uint8Array {
  const little = !opts.bigEndian;
  const body: number[] = [];
  if (opts.withNoise) {
    // file_id : local 1, global 0, champs type(0, enum) et manufacturer(1, uint16)
    body.push(0x61, 0, little ? 0 : 1, ...u16(0, little), 2, 0, 1, 0, 1, 2, 4, 1, 0, 2, 0);
    body.push(0x01, 4, ...u16(1, little), 0xaa, 0xbb);
  }
  // record : local 0, global 20 ; timestamp(253,uint32z=6 base 0x86), lat(0,sint32=0x85), lon(1), alt(2,uint16=0x84), enhanced(78,uint32=0x86)
  body.push(0x40, 0, little ? 0 : 1, ...u16(20, little), 5, 253, 4, 0x86, 0, 4, 0x85, 1, 4, 0x85, 2, 2, 0x84, 78, 4, 0x86);
  const INVALID32 = 0x7fffffff;
  opts.records.forEach((r, i) => {
    const compressed = opts.compressed && i > 0 && r.ts != null;
    if (compressed) {
      // Définition sans timestamp pour le type local 1, puis en-tête compressé.
      if (i === 1) body.push(0x41, 0, little ? 0 : 1, ...u16(20, little), 4, 0, 4, 0x85, 1, 4, 0x85, 2, 2, 0x84, 78, 4, 0x86);
      body.push(0x80 | (1 << 5) | ((r.ts as number) & 0x1f));
    } else {
      body.push(0x00);
      body.push(...u32(r.ts ?? 0xffffffff, little));
    }
    body.push(...u32(r.lat == null ? INVALID32 : semi(r.lat), little));
    body.push(...u32(r.lon == null ? INVALID32 : semi(r.lon), little));
    body.push(...u16(r.alt == null ? 0xffff : Math.round((r.alt + 500) * 5), little));
    body.push(...u32(r.enhancedAlt == null ? 0xffffffff : Math.round((r.enhancedAlt + 500) * 5), little));
  });
  const headerSize = opts.headerSize ?? 14;
  const header = [headerSize, 0x20, ...u16(2100, true), ...u32(body.length, true), 0x2e, 0x46, 0x49, 0x54];
  if (headerSize === 14) header.push(...u16(crc16(header), true));
  const all = [...header, ...body];
  all.push(...u16(crc16(all), true));
  return Uint8Array.from(all);
}
