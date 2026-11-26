#!/usr/bin/env node
// Piste d'effets v5 : tools/audio/sfx-cues-v5.json → qa/tmp/effets-v5-brut.wav (60,000 s, 48 kHz, stéréo, flottant 32 bits,
// avant le gain commun du mixage) + rapport qa/tmp/sfx-v5-placements.json.
// Placement : voir le « $comment » du JSON (pic au milieu de l'image du geste, ambiances coupées sur leur plan, whooshes
// qui finissent sur la coupe). Chaque son : passe-haut (champ passeHaut, filtre à variables d'état 12 dB/oct), fondus de
// quelques ms, panoramique à puissance constante. Le passe-bas 18 kHz est appliqué au mixage (build-mix.mjs --v5).
// Niveau « sous la musique » : pondération K (BS.1770, 48 kHz), énergie G + D, comparée à celle du montage musical v4
// sur la même fenêtre (400 ms centrées sur le pic d'un son ponctuel ; toute la durée posée sinon). Chaque son est mesuré seul.
// Usage : node tools/audio/build-sfx-v5.mjs              (gains figés du JSON)
//         node tools/audio/build-sfx-v5.mjs --calibrer   (recalcule gainDb depuis sousMusiqueDb et réécrit le JSON)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { HERE, MONTAGE_V4, QA_TMP, SFX_DIR, SR, readMono } from './lib.mjs';
import { svf, writeWav } from './synth.mjs';
import { peakOf } from './build-sfx.mjs';

export const CUES_V5 = join(HERE, 'sfx-cues-v5.json');
export const EFFETS_V5_RAW = join(QA_TMP, 'effets-v5-brut.wav');
export const PLACEMENTS_V5 = join(QA_TMP, 'sfx-v5-placements.json');
const FPS = 24, N = SR * 60;
// Plafond de crête échantillon d'un effet posé, avant le gain commun du mixage (≈ −5,8 dB) : un son très court (réception,
// clac) mesuré sur 400 ms demanderait un gain qui le ferait dépasser la musique de plusieurs dB en crête et casser la
// crête vraie du mix. Le gain retenu est le plus petit des deux ; le JSON garde l'écart visé, le rapport l'écart obtenu.
export const CRETE_MAX_DBFS = -1;

export function readStereo(file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '2', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(String(r.stderr));
  const b = r.stdout, x = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
  const L = new Float32Array(x.length / 2), R = new Float32Array(x.length / 2);
  for (let i = 0; i < L.length; i++) { L[i] = x[2 * i]; R[i] = x[2 * i + 1]; }
  return [L, R];
}

// Pondération K (BS.1770-4, coefficients à 48 kHz).
function biquad(x, b, a) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
export const kWeight = (x) => biquad(biquad(x, [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]),
  [1, -2, 1], [1, -1.99004745483398, 0.99007225036621]);
// Niveau K (LUFS-like, sans portes) de [a, b) échantillons sur des canaux déjà pondérés.
export function kLevel(chs, a, b) {
  a = Math.max(0, Math.round(a)); b = Math.min(chs[0].length, Math.round(b));
  let s = 0;
  for (const c of chs) for (let i = a; i < b; i++) s += c[i] * c[i];
  return -0.691 + 10 * Math.log10(s / Math.max(1, b - a) || 1e-20);
}

// Plans du film (qa/OURS-V4.md, colonne « Images du film ») : par défaut, aucun son ne commence avant la coupe de son plan.
export function shotsV4() {
  const md = readFileSync(join(HERE, '..', '..', 'qa', 'OURS-V4.md'), 'utf8');
  return [...md.matchAll(/^\| (COSMOS|P\d\d) \| ([^|]+) \| (\d+)–(\d+) \|/gm)].map((m) => ({ plan: m[1], section: m[2].trim(), a: Number(m[3]), b: Number(m[4]) }));
}
const SHOTS = shotsV4();
const shotStart = (f) => (SHOTS.find((s) => f >= s.a && f <= s.b) ?? { a: 0 }).a;

const envDb = (pts, frame) => {
  if (!pts) return 0;
  if (frame <= pts[0][0]) return pts[0][1];
  for (let k = 0; k < pts.length - 1; k++) {
    const [f0, d0] = pts[k], [f1, d1] = pts[k + 1];
    if (frame <= f1) return d0 + (d1 - d0) * (frame - f0) / (f1 - f0);
  }
  return pts.at(-1)[1];
};

// Place un effet à gain 0 dB : { s0, L, R, peakSec, span:[a,b] } (échantillons du film).
export function placeCue(c) {
  const load = (f) => {
    let x = Float32Array.from(readMono(join(SFX_DIR, f)));
    if (c.passeHaut) x = svf(x, 'hp', c.passeHaut, 0.7);
    if (c.depuis) x = x.subarray(Math.round(c.depuis * SR));
    if (c.garder) x = Float32Array.from(x.subarray(0, Math.round(c.garder * SR)));
    return x;
  };
  let a = load(c.fichier);
  let b = c.fichierD ? load(c.fichierD) : null;
  let start;
  // picEntre : [a, b] s, fenêtre du fichier où chercher le pic (fichier à plusieurs pas : on cale le premier).
  const pk = c.picEntre ? peakOf(a, Math.round(c.picEntre[0] * SR), Math.round(c.picEntre[1] * SR)) : peakOf(a);
  if (c.align === 'peak') start = (c.image + 0.5) / FPS - pk / SR;
  else if (c.align === 'end') start = c.image / FPS - a.length / SR;
  else start = c.image / FPS;
  let s0 = Math.round(start * SR);
  const minS = Math.round((c.pasAvant ?? (c.align === 'end' ? 0 : shotStart(c.image))) / FPS * SR);
  const headMs = c.fonduEntreeMs ?? 5;
  let head = 0;
  if (s0 < minS && c.align !== 'end') { head = minS - s0; }
  if (c.align === 'end' && s0 < 0) head = -s0;
  const endS = c.jusqua != null ? Math.round(c.jusqua / FPS * SR) : Infinity;
  const cut = (x) => {
    if (!x) return x;
    x = Float32Array.from(x.subarray(head, Math.max(head, Math.min(x.length, endS - s0))));
    const fi = Math.min(x.length, Math.round(headMs / 1000 * SR));
    for (let i = 0; i < fi; i++) x[i] *= i / fi;
    const fo = Math.min(x.length, Math.round((c.fonduSortieMs ?? 5) / 1000 * SR));
    for (let i = 0; i < fo; i++) x[x.length - 1 - i] *= i / fo;
    return x;
  };
  a = cut(a); b = cut(b);
  s0 += head;
  const n = a.length, L = new Float32Array(n), R = new Float32Array(n);
  const pan = (p) => { const t = (p + 1) * Math.PI / 4; return [Math.SQRT2 * Math.cos(t), Math.SQRT2 * Math.sin(t)]; };
  const [aL, aR] = pan(b ? -(c.largeur ?? 0.8) : (c.pan ?? 0));
  const [bL, bR] = b ? pan(c.largeur ?? 0.8) : [0, 0];
  for (let i = 0; i < n; i++) {
    const g = c.enveloppe ? Math.pow(10, envDb(c.enveloppe, (s0 + i) / SR * FPS) / 20) : 1;
    const vb = b ? (b[i] ?? 0) : 0;
    L[i] = (a[i] * aL + vb * bL) * g; R[i] = (a[i] * aR + vb * bR) * g;
  }
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) mono[i] = 0.5 * (L[i] + R[i]);
  const pw = c.picEntre ? [Math.max(0, Math.round((start + c.picEntre[0]) * SR) - s0), Math.round((start + c.picEntre[1]) * SR) - s0] : [0, n];
  const peakSec = (s0 + peakOf(mono, pw[0], pw[1])) / SR;
  return { s0, L, R, peakSec, span: [s0, s0 + n] };
}

export function buildSfxV5({ calibrer = false, cuesFile = CUES_V5, out = EFFETS_V5_RAW, report = PLACEMENTS_V5 } = {}) {
  mkdirSync(QA_TMP, { recursive: true });
  const j = JSON.parse(readFileSync(cuesFile, 'utf8'));
  for (const c of j.cues) {
    for (const f of [c.fichier, c.fichierD].filter(Boolean)) if (!existsSync(join(SFX_DIR, f))) throw new Error(`fichier absent : ${f}`);
    if (!c.raison?.trim()) throw new Error(`raison manquante : ${c.id}`);
  }
  const [mL, mR] = readStereo(MONTAGE_V4);
  const mK = [kWeight(mL), kWeight(mR)];
  const L = new Float32Array(N), R = new Float32Array(N);
  const placed = [];
  for (const c of j.cues) {
    const p = placeCue(c);
    const win = c.align === 'peak' ? [p.peakSec * SR - 0.2 * SR, p.peakSec * SR + 0.2 * SR] : p.span;
    const fx0 = kLevel([kWeight(padTo(p.L, p.s0, win)), kWeight(padTo(p.R, p.s0, win))], 0, win[1] - win[0]);
    const mus = kLevel(mK, win[0], win[1]);
    let pk = 0;
    for (const ch of [p.L, p.R]) for (let i = 0; i < ch.length; i++) pk = Math.max(pk, Math.abs(ch[i]));
    const capDb = CRETE_MAX_DBFS - 20 * Math.log10(pk || 1e-9);
    if (calibrer || c.gainDb == null) c.gainDb = Math.round(Math.min(mus - c.sousMusiqueDb - fx0, capDb) * 10) / 10;
    const g = Math.pow(10, c.gainDb / 20);
    for (let i = 0; i < p.L.length && p.s0 + i < N; i++) if (p.s0 + i >= 0) { L[p.s0 + i] += p.L[i] * g; R[p.s0 + i] += p.R[i] * g; }
    placed.push({ id: c.id, plan: c.plan, famille: c.famille, role: c.role, fichier: c.fichier, fichierD: c.fichierD ?? null, image: c.image, align: c.align,
      tempsS: Number((c.align === 'peak' ? (c.image + 0.5) / FPS : c.image / FPS).toFixed(4)),
      debutS: Number((p.s0 / SR).toFixed(4)), finS: Number((p.span[1] / SR).toFixed(4)),
      picS: Number(p.peakSec.toFixed(4)), picImage: Number((p.peakSec * FPS).toFixed(2)),
      ecartImages: c.align === 'peak' ? Number((p.peakSec * FPS - (c.image + 0.5)).toFixed(2)) : null,
      gainDb: c.gainDb, sousMusiqueViseDb: c.sousMusiqueDb, sousMusiqueMesureDb: Number((mus - (fx0 + c.gainDb)).toFixed(1)), musiqueK: Number(mus.toFixed(1)), plafonne: c.gainDb <= capDb + 0.05 && capDb < mus - c.sousMusiqueDb - fx0,
      creteDbfs: Number((20 * Math.log10(pk || 1e-9) + c.gainDb).toFixed(1)) });
  }
  if (calibrer) {
    const txt = JSON.stringify(j, null, 2).replace(/\[\n\s+(-?\d+),\n\s+(-?[\d.]+)\n\s+\]/g, '[$1, $2]');
    writeFileSync(cuesFile, txt + '\n');
  }
  const inter = new Float32Array(2 * N);
  for (let i = 0; i < N; i++) { inter[2 * i] = L[i]; inter[2 * i + 1] = R[i]; }
  writeWav(out, inter, { channels: 2, codec: 'pcm_f32le' });
  writeFileSync(report, JSON.stringify({ out, cues: cuesFile, creux: j.creuxAvantDrop1, placed }, null, 2));
  return { out, placed, creux: j.creuxAvantDrop1 };
}
// Le signal posé, ramené à la fenêtre [a, b) (zéros hors du son).
function padTo(x, s0, [a, b]) {
  a = Math.round(a); b = Math.round(b);
  const y = new Float32Array(b - a);
  for (let i = 0; i < y.length; i++) { const k = a + i - s0; if (k >= 0 && k < x.length) y[i] = x[k]; }
  return y;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = buildSfxV5({ calibrer: process.argv.includes('--calibrer') });
  console.log(`✓ ${r.out} · ${r.placed.length} effets`);
  for (const c of r.placed) console.log(`  ${c.id} ${c.plan.padEnd(10)} image ${String(c.image).padStart(4)} pic ${c.picImage.toFixed(2).padStart(7)} ${c.fichier.padEnd(24)} gain ${c.gainDb.toFixed(1).padStart(6)} dB · ${c.sousMusiqueMesureDb.toFixed(1)} dB sous la musique`);
}
