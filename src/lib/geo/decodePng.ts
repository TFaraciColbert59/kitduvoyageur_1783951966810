import pako from 'pako';

export interface DecodedPngRgba {
  data: Uint8Array;
  width: number;
  height: number;
  channels: 4;
}

function readU32BE(buf: Uint8Array, offset: number): number {
  return (
    ((buf[offset] << 24) |
      (buf[offset + 1] << 16) |
      (buf[offset + 2] << 8) |
      buf[offset + 3]) >>>
    0
  );
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Pure Web-standard / typed-array PNG → RGBA decoder using `pako.inflate`.
 * Zero Node `zlib`/`Buffer`/C++ `sharp` dependencies — runs identically on
 * Cloudflare Workers (`workerd`), Edge runtimes, Browsers, and Node.js.
 * Supports 8-bit Truecolor (RGB, colorType 2) and Truecolor+Alpha (RGBA, colorType 6)
 * non-interlaced PNGs (standard format of AWS Terrarium elevation tiles).
 */
export function decodePngRgba(input: ArrayBuffer | Uint8Array): DecodedPngRgba {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (
    bytes.length < 33 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    throw new Error('Invalid PNG signature');
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks: Uint8Array[] = [];
  let totalIdatLen = 0;

  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = readU32BE(bytes, offset);
    const t0 = bytes[offset + 4];
    const t1 = bytes[offset + 5];
    const t2 = bytes[offset + 6];
    const t3 = bytes[offset + 7];
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) break;

    // 'IHDR'
    if (t0 === 73 && t1 === 72 && t2 === 68 && t3 === 82) {
      width = readU32BE(bytes, dataStart);
      height = readU32BE(bytes, dataStart + 4);
      bitDepth = bytes[dataStart + 8];
      colorType = bytes[dataStart + 9];
      interlace = bytes[dataStart + 12];
    } else if (t0 === 73 && t1 === 68 && t2 === 65 && t3 === 84) {
      // 'IDAT'
      const slice = bytes.subarray(dataStart, dataEnd);
      idatChunks.push(slice);
      totalIdatLen += slice.length;
    } else if (t0 === 73 && t1 === 69 && t2 === 78 && t3 === 68) {
      // 'IEND'
      break;
    }

    offset = dataEnd + 4;
  }

  if (width <= 0 || height <= 0 || bitDepth !== 8 || interlace !== 0) {
    throw new Error(`Unsupported PNG header (${width}x${height} depth=${bitDepth} interlace=${interlace})`);
  }

  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : colorType === 4 ? 2 : 0;
  if (bpp === 0) {
    throw new Error(`Unsupported PNG colorType=${colorType}`);
  }

  const compressed = new Uint8Array(totalIdatLen);
  let pos = 0;
  for (const chunk of idatChunks) {
    compressed.set(chunk, pos);
    pos += chunk.length;
  }

  const raw = pako.inflate(compressed);
  const stride = width * bpp;
  const recon = new Uint8Array(height * stride);

  for (let y = 0; y < height; y++) {
    const rowInStart = y * (stride + 1);
    const filter = raw[rowInStart];
    const rowOutStart = y * stride;
    const prevOutStart = (y - 1) * stride;

    for (let x = 0; x < stride; x++) {
      const val = raw[rowInStart + 1 + x];
      const left = x >= bpp ? recon[rowOutStart + x - bpp] : 0;
      const up = y > 0 ? recon[prevOutStart + x] : 0;
      const upLeft = y > 0 && x >= bpp ? recon[prevOutStart + x - bpp] : 0;

      let out = val;
      if (filter === 1) {
        out = (val + left) & 0xff;
      } else if (filter === 2) {
        out = (val + up) & 0xff;
      } else if (filter === 3) {
        out = (val + ((left + up) >> 1)) & 0xff;
      } else if (filter === 4) {
        out = (val + paethPredictor(left, up, upLeft)) & 0xff;
      }
      recon[rowOutStart + x] = out;
    }
  }

  if (bpp === 4) {
    return { data: recon, width, height, channels: 4 };
  }

  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0, j = 0; i < width * height; i++, j += 4) {
    if (bpp === 3) {
      const k = i * 3;
      rgba[j] = recon[k];
      rgba[j + 1] = recon[k + 1];
      rgba[j + 2] = recon[k + 2];
      rgba[j + 3] = 255;
    } else if (bpp === 2) {
      const k = i * 2;
      rgba[j] = recon[k];
      rgba[j + 1] = recon[k];
      rgba[j + 2] = recon[k];
      rgba[j + 3] = recon[k + 1];
    } else {
      const g = recon[i];
      rgba[j] = g;
      rgba[j + 1] = g;
      rgba[j + 2] = g;
      rgba[j + 3] = 255;
    }
  }

  return { data: rgba, width, height, channels: 4 };
}
