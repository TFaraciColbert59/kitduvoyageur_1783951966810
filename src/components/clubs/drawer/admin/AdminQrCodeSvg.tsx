'use client';

import React, { useMemo } from 'react';

/**
 * Autonomous zero-dependency QR Code (ISO/IEC 18004, Byte mode, ECC Level L)
 * Supports Versions 1..8 (up to 192 UTF-8 bytes) for scannable invite links.
 */

// [totalCodewords, dataCodewords, ecCodewordsPerBlock, numBlocks] for ECC Level L, V1..V8
const VERSION_SPEC: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 0, 0, 0], // placeholder 0
  [26, 19, 7, 1],
  [44, 34, 10, 1],
  [70, 55, 15, 1],
  [100, 80, 20, 1],
  [134, 108, 26, 1],
  [172, 136, 18, 2],
  [196, 156, 20, 2],
  [242, 194, 24, 2],
];

const ALIGNMENT_POS: ReadonlyArray<readonly number[]> = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(deg: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < deg; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsComputeEcc(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGeneratorPoly(ecLen);
  const res = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ res[0];
    res.copyWithin(0, 1);
    res[ecLen - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecLen; j++) {
        res[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return res;
}

export function encodeQrMatrix(text: string): { size: number; modules: Uint8Array } {
  const bytes = new TextEncoder().encode(text);
  let version = 1;
  while (version <= 8 && bytes.length + 2 > VERSION_SPEC[version][1]) {
    version++;
  }
  if (version > 8) version = 8;

  const [, dataCap, ecPerBlock, numBlocks] = VERSION_SPEC[version];
  const maxBytes = Math.min(bytes.length, dataCap - 2);

  // Build bit stream: mode=0100 (4 bits), count (8 bits for V1..V9), data, terminator, padding
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  pushBits(0b0100, 4);
  pushBits(maxBytes, 8);
  for (let i = 0; i < maxBytes; i++) pushBits(bytes[i], 8);
  pushBits(0, Math.min(4, dataCap * 8 - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const dataBytes = new Uint8Array(dataCap);
  for (let i = 0; i < bits.length / 8; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i * 8 + j];
    dataBytes[i] = b;
  }
  const padBytes = [0xec, 0x11];
  for (let i = bits.length / 8, p = 0; i < dataCap; i++, p++) {
    dataBytes[i] = padBytes[p & 1];
  }

  // Split into blocks & compute ECC
  const blockSize = Math.floor(dataCap / numBlocks);
  const extraBlocks = dataCap % numBlocks;
  const dataBlocks: Uint8Array[] = [];
  const eccBlocks: Uint8Array[] = [];
  let offset = 0;
  for (let b = 0; b < numBlocks; b++) {
    const len = blockSize + (b >= numBlocks - extraBlocks ? 1 : 0);
    const slice = dataBytes.subarray(offset, offset + len);
    dataBlocks.push(slice);
    eccBlocks.push(rsComputeEcc(slice, ecPerBlock));
    offset += len;
  }

  const interleaved: number[] = [];
  const maxBlockLen = blockSize + (extraBlocks > 0 ? 1 : 0);
  for (let i = 0; i < maxBlockLen; i++) {
    for (let b = 0; b < numBlocks; b++) {
      if (i < dataBlocks[b].length) interleaved.push(dataBlocks[b][i]);
    }
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (let b = 0; b < numBlocks; b++) {
      interleaved.push(eccBlocks[b][i]);
    }
  }

  const size = version * 4 + 17;
  const modules = new Uint8Array(size * size);
  const isFunc = new Uint8Array(size * size);
  const setFunc = (r: number, c: number, dark: boolean) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    modules[r * size + c] = dark ? 1 : 0;
    isFunc[r * size + c] = 1;
  };

  // Finder patterns + separators
  const drawFinder = (r0: number, c0: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = r0 + dr;
        const c = c0 + dc;
        if (r < 0 || c < 0 || r >= size || c >= size) continue;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inCenter = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFunc(r, c, inOuter && (onBorder || inCenter));
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Alignment patterns
  const align = ALIGNMENT_POS[version];
  for (const r0 of align) {
    for (const c0 of align) {
      if (isFunc[r0 * size + c0]) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setFunc(r0 + dr, c0 + dc, dark);
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0;
    if (!isFunc[6 * size + i]) setFunc(6, i, dark);
    if (!isFunc[i * size + 6]) setFunc(i, 6, dark);
  }

  // Dark module
  setFunc(size - 8, 8, true);

  // Reserve format info
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      setFunc(8, i, false);
      setFunc(i, 8, false);
    }
  }
  for (let i = 0; i < 8; i++) {
    setFunc(8, size - 1 - i, false);
    setFunc(size - 1 - i, 8, false);
  }
  setFunc(size - 8, 8, true);

  // Version info (18-bit BCH) required for V7..V8 before placing data bits
  if (version >= 7) {
    const VERSION_BITS: Record<number, number> = {
      7: 0x07c94,
      8: 0x085bc,
    };
    const verBits = VERSION_BITS[version];
    for (let i = 0; i < 18; i++) {
      const bit = ((verBits >>> i) & 1) === 1;
      const a = Math.floor(i / 3);
      const b = size - 11 + (i % 3);
      setFunc(a, b, bit);
      setFunc(b, a, bit);
    }
  }

  // Place data bits (zigzag) + mask 0 ((r + c) % 2 === 0)
  let bitIdx = 0;
  const totalBits = interleaved.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        const upward = ((right + 1) & 2) === 0;
        const r = upward ? size - 1 - vert : vert;
        if (isFunc[r * size + c]) continue;
        let bit = false;
        if (bitIdx < totalBits) {
          bit = ((interleaved[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1) === 1;
          bitIdx++;
        }
        const mask = (r + c) % 2 === 0;
        modules[r * size + c] = bit !== mask ? 1 : 0;
      }
    }
  }

  // Format info for ECC L (01) + Mask 0 (000) => 5-bit data 01000 => 15-bit BCH ^ 0x5412 = 0x77c4
  // ISO/IEC 18004: bit 14 (MSB) at (8,0)/(size-1,8), bit 0 (LSB) at (0,8)/(8,size-1)
  const formatBits = 0x77c4;
  for (let b = 0; b <= 5; b++) {
    setFunc(b, 8, ((formatBits >>> b) & 1) === 1);
  }
  setFunc(7, 8, ((formatBits >>> 6) & 1) === 1);
  setFunc(8, 8, ((formatBits >>> 7) & 1) === 1);
  setFunc(8, 7, ((formatBits >>> 8) & 1) === 1);
  for (let b = 9; b <= 14; b++) {
    setFunc(8, 14 - b, ((formatBits >>> b) & 1) === 1);
  }
  for (let b = 0; b <= 7; b++) {
    setFunc(8, size - 1 - b, ((formatBits >>> b) & 1) === 1);
  }
  for (let b = 8; b <= 14; b++) {
    setFunc(size - 15 + b, 8, ((formatBits >>> b) & 1) === 1);
  }

  return { size, modules };
}

export interface AdminQrCodeSvgProps {
  value: string;
  size?: number;
  color?: string;
}

export function AdminQrCodeSvg({
  value,
  size = 132,
  color = '#17402c',
}: AdminQrCodeSvgProps) {
  const { gridSize, pathData } = useMemo(() => {
    const { size: n, modules } = encodeQrMatrix(value);
    const parts: string[] = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (modules[r * n + c]) {
          parts.push(`M${c},${r}h1v1h-1z`);
        }
      }
    }
    return { gridSize: n, pathData: parts.join('') };
  }, [value]);

  const quiet = 3;
  const viewSize = gridSize + quiet * 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`-${quiet} -${quiet} ${viewSize} ${viewSize}`}
      role="img"
      aria-label="QR code d’invitation du club"
      shapeRendering="crispEdges"
      style={{
        display: 'block',
        borderRadius: 12,
        background: '#ffffff',
        padding: 4,
        boxShadow: 'inset 0 0 0 0.5px rgba(23, 64, 44, 0.14)',
      }}
    >
      <path d={pathData} fill={color} />
    </svg>
  );
}
