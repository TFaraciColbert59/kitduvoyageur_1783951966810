// PRNG déterministe : les mêmes personas produisent le même graphe social.
import { createHash } from 'node:crypto';

export function hashSeed(input) {
  const h = createHash('sha256').update(String(input)).digest();
  return h.readUInt32LE(0);
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRandom(seedInput) {
  const rnd = mulberry32(hashSeed(seedInput));
  return {
    next: rnd,
    int(min, max) {
      return Math.floor(rnd() * (max - min + 1)) + min;
    },
    pick(arr) {
      return arr[Math.floor(rnd() * arr.length)];
    },
    pickMany(arr, n) {
      const copy = [...arr];
      const out = [];
      while (copy.length && out.length < n) {
        out.push(copy.splice(Math.floor(rnd() * copy.length), 1)[0]);
      }
      return out;
    },
    chance(p) {
      return rnd() < p;
    },
    shuffle(arr) {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}
