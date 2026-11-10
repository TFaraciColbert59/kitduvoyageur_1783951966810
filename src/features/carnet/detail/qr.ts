/**
 * Encodeur QR minimal (mode octets, correction d'erreur L, versions 1 à 10,
 * soit 271 octets au plus) : le QR de l'onglet « Partage » encode l'URL du
 * carnet, sans dépendance ni appel réseau. Algorithme de la norme ISO/IEC 18004
 * (même découpage que l'implémentation de référence de Nayuki, domaine public).
 */

const ECC_PER_BLOCK = [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18];
const NUM_BLOCKS = [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4];
export const QR_MAX_VERSION = 10;

function rawModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

const dataCodewords = (ver: number): number =>
  Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver];

/** Capacité en octets d'une version (mode octets, en-tête déduit). */
export function qrCapacityBytes(ver: number): number {
  const headerBits = 4 + (ver >= 10 ? 16 : 8);
  return Math.floor((dataCodewords(ver) * 8 - headerBits) / 8);
}

// ── Reed-Solomon sur GF(256), polynôme 0x11D ────────────────────────────

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < result.length; j += 1) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] ^= gfMul(coef, factor);
    });
  }
  return result;
}

function buildCodewords(bytes: number[], ver: number): number[] {
  const bits: number[] = [];
  const push = (value: number, len: number) => {
    for (let i = len - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, ver >= 10 ? 16 : 8);
  bytes.forEach((b) => push(b, 8));
  const capacityBits = dataCodewords(ver) * 8;
  push(0, Math.min(4, capacityBits - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  }
  for (let pad = 0xec; data.length < dataCodewords(ver); pad ^= 0xec ^ 0x11) data.push(pad);

  const blocks = NUM_BLOCKS[ver];
  const ecc = ECC_PER_BLOCK[ver];
  const rawCodewords = Math.floor(rawModules(ver) / 8);
  const shortBlocks = blocks - (rawCodewords % blocks);
  const shortLen = Math.floor(rawCodewords / blocks);
  const divisor = rsDivisor(ecc);
  const parts: Array<{ data: number[]; ecc: number[] }> = [];
  for (let i = 0, k = 0; i < blocks; i += 1) {
    const len = shortLen - ecc + (i < shortBlocks ? 0 : 1);
    const block = data.slice(k, k + len);
    k += len;
    parts.push({ data: block, ecc: rsRemainder(block, divisor) });
  }
  const out: number[] = [];
  const maxData = Math.max(...parts.map((p) => p.data.length));
  for (let i = 0; i < maxData; i += 1) parts.forEach((p) => i < p.data.length && out.push(p.data[i]));
  for (let i = 0; i < ecc; i += 1) parts.forEach((p) => out.push(p.ecc[i]));
  return out;
}

// ── Matrice ─────────────────────────────────────────────────────────────

function alignPositions(ver: number): number[] {
  if (ver === 1) return [];
  const num = Math.floor(ver / 7) + 2;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (num * 2 - 2)) * 2;
  const result = [6];
  for (let pos = ver * 4 + 10; result.length < num; pos -= step) result.splice(1, 0, pos);
  return result;
}

const bit = (x: number, i: number): boolean => ((x >>> i) & 1) !== 0;

/** Reste BCH : `rounds` décalages, report du polynôme quand le bit `shift` est posé. */
function bch(value: number, poly: number, shift: number, rounds: number): number {
  let rem = value;
  for (let i = 0; i < rounds; i += 1) rem = (rem << 1) ^ ((rem >>> shift) * poly);
  return rem;
}

type Grid = boolean[][];

function emptyGrid(size: number): Grid {
  return Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
}

function drawFunctionPatterns(modules: Grid, reserved: Grid, ver: number): void {
  const size = modules.length;
  const set = (x: number, y: number, dark: boolean) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y][x] = dark;
    reserved[y][x] = true;
  };
  for (let i = 0; i < size; i += 1) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        set(cx + dx, cy + dy, dist !== 2 && dist !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  const pos = alignPositions(ver);
  pos.forEach((px, i) =>
    pos.forEach((py, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) set(px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    })
  );
  drawFormat(modules, reserved, 0);
  if (ver >= 7) {
    const bits = (ver << 12) | bch(ver, 0x1f25, 11, 12);
    for (let i = 0; i < 18; i += 1) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, bit(bits, i));
      set(b, a, bit(bits, i));
    }
  }
}

function drawFormat(modules: Grid, reserved: Grid, mask: number): void {
  const size = modules.length;
  const data = (0b01 << 3) | mask; // niveau L = 01
  const bits = ((data << 10) | bch(data, 0x537, 9, 10)) ^ 0x5412;
  const set = (x: number, y: number, dark: boolean) => {
    modules[y][x] = dark;
    reserved[y][x] = true;
  };
  for (let i = 0; i <= 5; i += 1) set(8, i, bit(bits, i));
  set(8, 7, bit(bits, 6));
  set(8, 8, bit(bits, 7));
  set(7, 8, bit(bits, 8));
  for (let i = 9; i < 15; i += 1) set(14 - i, 8, bit(bits, i));
  for (let i = 0; i < 8; i += 1) set(size - 1 - i, 8, bit(bits, i));
  for (let i = 8; i < 15; i += 1) set(8, size - 15 + i, bit(bits, i));
  set(8, size - 8, true);
}

function drawCodewords(modules: Grid, reserved: Grid, codewords: number[]): void {
  const size = modules.length;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!reserved[y][x] && i < codewords.length * 8) {
          modules[y][x] = bit(codewords[i >>> 3], 7 - (i & 7));
          i += 1;
        }
      }
    }
  }
}

const MASKS: Array<(x: number, y: number) => boolean> = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function penalty(modules: Grid): number {
  const size = modules.length;
  let score = 0;
  const lines: boolean[][] = [];
  for (let i = 0; i < size; i += 1) {
    lines.push(modules[i]);
    lines.push(modules.map((row) => row[i]));
  }
  for (const line of lines) {
    let run = 1;
    for (let i = 1; i < size; i += 1) {
      if (line[i] === line[i - 1]) {
        run += 1;
        if (run === 5) score += 3;
        else if (run > 5) score += 1;
      } else run = 1;
    }
    const str = line.map((d) => (d ? '1' : '0')).join('');
    const finderLike = /(?:00001011101|10111010000)/g;
    score += 40 * (str.match(finderLike)?.length ?? 0);
  }
  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const c = modules[y][x];
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) score += 3;
    }
  }
  const dark = modules.reduce((n, row) => n + row.filter(Boolean).length, 0);
  const total = size * size;
  score += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
  return score;
}

/** Matrice du QR (`true` = module sombre), ou `null` si le texte dépasse la capacité. */
export function encodeQr(text: string): boolean[][] | null {
  const bytes = Array.from(new TextEncoder().encode(text));
  let ver = 1;
  while (ver <= QR_MAX_VERSION && qrCapacityBytes(ver) < bytes.length) ver += 1;
  if (ver > QR_MAX_VERSION) return null;
  const size = ver * 4 + 17;
  const base = emptyGrid(size);
  const reserved = emptyGrid(size);
  drawFunctionPatterns(base, reserved, ver);
  drawCodewords(base, reserved, buildCodewords(bytes, ver));

  let best: Grid | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    const grid = base.map((row) => row.slice());
    const res = reserved.map((row) => row.slice());
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (!reserved[y][x] && MASKS[mask](x, y)) grid[y][x] = !grid[y][x];
      }
    }
    drawFormat(grid, res, mask);
    const score = penalty(grid);
    if (score < bestScore) {
      bestScore = score;
      best = grid;
    }
  }
  return best;
}

/** Tracé SVG d'une matrice (un seul `<path>`, zone de silence comprise). */
export function qrPath(matrix: boolean[][], quiet = 1): { d: string; size: number } {
  const size = matrix.length + quiet * 2;
  let d = '';
  matrix.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    })
  );
  return { d, size };
}
