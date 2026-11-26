// Outils de couleur partagés par build-lut, measure et leurs tests.
// Espace de travail : sRGB encodé (0..1) en entrée et en sortie, Oklab pour la teinte et la saturation,
// CIELAB D65 pour les écarts (ΔE2000). Aucune dépendance.

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

export const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const linearToSrgb = (c) => {
  if (c <= 0) return 0;
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
};

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}
export const rgbToHex = (rgb) =>
  '#' + rgb.map((v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();

// --- Oklab (Björn Ottosson) ---
export function linearToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
export function oklabToLinear([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
export const srgbToOklab = (rgb) => linearToOklab(rgb.map(srgbToLinear));
export const oklabToSrgb = (lab) => oklabToLinear(lab).map(linearToSrgb);
export function oklabToLch([L, a, b]) {
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return [L, Math.hypot(a, b), h];
}
export function lchToOklab([L, C, h]) {
  const r = (h * Math.PI) / 180;
  return [L, C * Math.cos(r), C * Math.sin(r)];
}
export const hueDiff = (a, b) => {
  let d = a - b;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
};
// Fenêtre de teinte en cosinus surélevé : 1 au centre, 0 au-delà de halfWidth.
export const hueWindow = (h, center, halfWidth) => {
  const d = Math.abs(hueDiff(h, center));
  return d >= halfWidth ? 0 : 0.5 * (1 + Math.cos((Math.PI * d) / halfWidth));
};

// Luminance relative (Rec.709) d'un sRGB encodé, renvoyée en valeur encodée (0..1) pour les seuils visuels.
export const displayLuma = ([r, g, b]) => linearToSrgb(0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b));

// --- CIELAB D65 et ΔE2000 ---
export function srgbToLab(rgb) {
  const [r, g, b] = rgb.map(srgbToLinear);
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export function deltaE2000(lab1, lab2) {
  const [L1, a1, b1] = lab1, [L2, a2, b2] = lab2;
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  const Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const hp = (b, a) => { if (b === 0 && a === 0) return 0; const h = Math.atan2(b, a) / rad; return h < 0 ? h + 360 : h; };
  const h1p = hp(b1, a1p), h2p = hp(b2, a2p);
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lmp = (L1 + L2) / 2, Cmp = (C1p + C2p) / 2;
  let hmp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hmp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
    else hmp = (h1p + h2p) / 2;
  }
  const T = 1 - 0.17 * Math.cos((hmp - 30) * rad) + 0.24 * Math.cos(2 * hmp * rad) + 0.32 * Math.cos((3 * hmp + 6) * rad) - 0.2 * Math.cos((4 * hmp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hmp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lmp - 50) ** 2) / Math.sqrt(20 + (Lmp - 50) ** 2);
  const Sc = 1 + 0.045 * Cmp, Sh = 1 + 0.015 * Cmp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}

// --- Application d'une LUT 3D (interpolation trilinéaire), table en ordre .cube (R le plus rapide) ---
export function sampleLut(table, size, [r, g, b]) {
  const n = size - 1;
  const fr = clamp01(r) * n, fg = clamp01(g) * n, fb = clamp01(b) * n;
  const r0 = Math.min(Math.floor(fr), n - 1), g0 = Math.min(Math.floor(fg), n - 1), b0 = Math.min(Math.floor(fb), n - 1);
  const dr = fr - r0, dg = fg - g0, db = fb - b0;
  const at = (ri, gi, bi) => 3 * (ri + size * (gi + size * bi));
  const out = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const c = (ri, gi, bi) => table[at(ri, gi, bi) + k];
    const c00 = c(r0, g0, b0) * (1 - dr) + c(r0 + 1, g0, b0) * dr;
    const c10 = c(r0, g0 + 1, b0) * (1 - dr) + c(r0 + 1, g0 + 1, b0) * dr;
    const c01 = c(r0, g0, b0 + 1) * (1 - dr) + c(r0 + 1, g0, b0 + 1) * dr;
    const c11 = c(r0, g0 + 1, b0 + 1) * (1 - dr) + c(r0 + 1, g0 + 1, b0 + 1) * dr;
    out[k] = (c00 * (1 - dg) + c10 * dg) * (1 - db) + (c01 * (1 - dg) + c11 * dg) * db;
  }
  return out;
}

export function parseCube(text) {
  let size = 0;
  const vals = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('TITLE') || t.startsWith('DOMAIN')) continue;
    if (t.startsWith('LUT_3D_SIZE')) { size = Number(t.split(/\s+/)[1]); continue; }
    const p = t.split(/\s+/).map(Number);
    if (p.length === 3 && p.every(Number.isFinite)) vals.push(...p);
  }
  if (!size || vals.length !== size ** 3 * 3) throw new Error(`cube invalide : taille ${size}, ${vals.length / 3} entrées`);
  return { size, table: Float64Array.from(vals) };
}
