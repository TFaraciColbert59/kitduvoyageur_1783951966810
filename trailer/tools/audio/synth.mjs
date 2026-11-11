// Synthèse déterministe par bruit filtré (graine fixe), pour la banque d'effets et le lit de substitution.
// Pas d'horloge, pas d'aléatoire non graine : deux exécutions donnent des fichiers identiques.
import { spawnSync } from 'node:child_process';
import { SR } from './lib.mjs';

export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export const len = (sec) => Math.round(sec * SR);

export function white(n, seed) {
  const r = rng(seed), x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = r() * 2 - 1;
  return x;
}

// Bruit rose (filtre de Paul Kellet).
export function pink(n, seed) {
  const w = white(n, seed), x = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const v = w[i];
    b0 = 0.99886 * b0 + v * 0.0555179; b1 = 0.99332 * b1 + v * 0.0750759;
    b2 = 0.969 * b2 + v * 0.153852; b3 = 0.8665 * b3 + v * 0.3104856;
    b4 = 0.55 * b4 + v * 0.5329522; b5 = -0.7616 * b5 - v * 0.016898;
    x[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + v * 0.5362) * 0.11; b6 = v * 0.115926;
  }
  return x;
}

// Bruit brun (intégration fuyante).
export function brown(n, seed) {
  const w = white(n, seed), x = new Float32Array(n);
  let y = 0;
  for (let i = 0; i < n; i++) { y = (y + 0.02 * w[i]) / 1.002; x[i] = y * 3.5; }
  return x;
}

// Filtre à variables d'état (Chamberlin), fréquence et Q éventuellement variables dans le temps.
// mode : 'lp' | 'bp' | 'hp'. freq(t) et q(t) : nombres ou fonctions de t (0..1, position relative).
export function svf(x, mode, freq, q = 0.7) {
  const n = x.length, y = new Float32Array(n);
  let low = 0, band = 0;
  const F = typeof freq === 'function' ? freq : () => freq;
  const Q = typeof q === 'function' ? q : () => q;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const fc = Math.min(SR / 6.5, Math.max(20, F(u)));
    const f = 2 * Math.sin((Math.PI * fc) / SR);
    const damp = 1 / Math.max(0.5, Q(u));
    // deux passes pour la stabilité aux fréquences hautes
    for (let k = 0; k < 2; k++) {
      low += 0.5 * f * band;
      const high = x[i] - low - damp * band;
      band += 0.5 * f * high;
      if (k === 1) y[i] = mode === 'lp' ? low : mode === 'bp' ? band : high;
    }
  }
  return y;
}

export function mulEnv(x, env) {
  const n = x.length;
  for (let i = 0; i < n; i++) x[i] *= env(i / n, i / SR);
  return x;
}

// Enveloppe montée/descente : attaque jusqu'à `peak` (0..1), puis descente avec `curve`.
export const swell = (peak, rise = 2, fall = 2) => (u) =>
  u < peak ? Math.pow(u / peak, rise) : Math.pow(Math.max(0, 1 - (u - peak) / (1 - peak)), fall);
export const expDecay = (tau, attack = 0.002) => (_u, t) =>
  (t < attack ? t / attack : 1) * Math.exp(-(t - attack) / tau);

export function sine(n, f0, f1 = f0, curve = 1, phase = 0) {
  const x = new Float32Array(n);
  let ph = phase;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const f = f0 + (f1 - f0) * Math.pow(u, curve);
    ph += (2 * Math.PI * f) / SR;
    x[i] = Math.sin(ph);
  }
  return x;
}

export function add(dst, src, at = 0, gain = 1) {
  for (let i = 0; i < src.length && at + i < dst.length; i++) if (at + i >= 0) dst[at + i] += src[i] * gain;
  return dst;
}

export function scale(x, g) { for (let i = 0; i < x.length; i++) x[i] *= g; return x; }

export function normalizePeak(x, dbfs = -3) {
  let p = 0;
  for (let i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i]));
  return scale(x, p > 0 ? Math.pow(10, dbfs / 20) / p : 1);
}

// Fondu linéaire de sortie (ms) pour un rognage propre.
export function fadeOut(x, ms = 10) {
  const k = Math.min(x.length, Math.round((SR * ms) / 1000));
  for (let i = 0; i < k; i++) x[x.length - 1 - i] *= i / k;
  return x;
}
export function fadeIn(x, ms = 2) {
  const k = Math.min(x.length, Math.round((SR * ms) / 1000));
  for (let i = 0; i < k; i++) x[i] *= i / k;
  return x;
}

// Écrit un WAV PCM 24 bits à SR Hz, mono ou entrelacé, par FFmpeg (f32le sur l'entrée standard).
export function writeWav(path, data, { channels = 1, rate = SR, codec = 'pcm_s24le' } = {}) {
  const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(rate), '-ac', String(channels),
    '-i', '-', '-c:a', codec, path], { input: buf, maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(String(r.stderr));
}
