// Outils communs du son du trailer LKDV (sound-designer).
// Aucune dépendance hors Node 22 et FFmpeg (mesuré avec FFmpeg 6.1.1).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const TRAILER = resolve(HERE, '..', '..');
export const AUDIO_DIR = join(TRAILER, 'assets', 'audio');
export const SFX_DIR = join(AUDIO_DIR, 'sfx');
export const QA_DIR = join(TRAILER, 'qa');
export const QA_TMP = join(QA_DIR, 'tmp');
export const MP3 = join(AUDIO_DIR, 'storm-ii.mp3');
export const MONTAGE = join(AUDIO_DIR, 'storm-ii-montage-60s.wav');
export const SUBST_MONTAGE = join(QA_TMP, 'montage-SUBSTITUT.wav');

export const FPS = 60;
export const TOTAL_FRAMES = 3600;
export const SR = 48000;
export const DURATION = 60;

// Tableau « Montage de 60 s » de MUSIQUE.md : [début film, fin film, début morceau].
export const MONTAGE_MAP = [
  { film: [0.0, 5.41], song: 66.085, label: 'Fin de la montée' },
  { film: [5.41, 33.48], song: 71.495, label: 'Drop 1 (16 mesures)' },
  { film: [33.48, 47.47], song: 141.565, label: 'Drop 2, 8 dernières mesures' },
  { film: [47.47, 51.0], song: 155.555, label: 'Outro, 2 mesures' },
  { film: [51.0, 58.0], song: 120.545, label: 'Montée vers le drop 2, 4 mesures' },
  { film: [58.0, 60.0], song: 127.545, label: 'Impact du drop 2 (logo)' },
];
// Les cinq raccords (secondes du film) et l'image de la trame qui leur correspond.
export const JOINS = [
  { t: 5.41, frame: 325, name: 'drop 1', priority: false },
  { t: 33.48, frame: 2009, name: 'drop 2', priority: true },
  { t: 47.47, frame: 2848, name: 'outro', priority: false },
  { t: 51.0, frame: 3060, name: 'montée', priority: true },
  { t: 58.0, frame: 3480, name: 'impact final', priority: false },
];

// Commande de MUSIQUE.md, à l'identique (filtre complexe).
export const MONTAGE_FILTER =
  '[0]atrim=66.085:71.495,asetpts=PTS-STARTPTS,afade=t=in:d=0.25,afade=t=out:st=5.405:d=0.005[a];' +
  '[0]atrim=71.495:99.565,asetpts=PTS-STARTPTS,afade=t=in:d=0.005,afade=t=out:st=28.065:d=0.005[b];' +
  '[0]atrim=141.565:155.555,asetpts=PTS-STARTPTS,afade=t=in:d=0.005,afade=t=out:st=13.985:d=0.005[c];' +
  '[0]atrim=155.555:159.085,asetpts=PTS-STARTPTS,afade=t=in:d=0.005,afade=t=out:st=3.525:d=0.005[d];' +
  '[0]atrim=120.545:127.545,asetpts=PTS-STARTPTS,afade=t=in:d=0.005,afade=t=out:st=6.995:d=0.005[e];' +
  '[0]atrim=127.545:129.545,asetpts=PTS-STARTPTS,afade=t=in:d=0.005,afade=t=out:st=1.2:d=0.8[f];' +
  '[a][b][c][d][e][f]concat=n=6:v=0:a=1,apad=whole_dur=60,atrim=0:60[o]';

// ── Montage v2 (qa/SON-AUDIT.md) ────────────────────────────────────────────────────────────────
// Mêmes repères image que v1. Changements : (1) les passages continus du morceau (5,41 / 47,47 / 58,00 s)
// ne sont plus coupés (plus de micro-fondus qui creusaient l'attaque des drops) ; (2) 31,69 s (P31) :
// la dernière mesure du drop 1 est remplacée par la respiration + le roulement du morceau (m71), pour
// qu'un vrai drop tombe à 33,48 s ; (3) 51,00 s (P49) : l'outro enchaîne sur la fin du pont (m62–m63,
// sans grave), le grave revient à 54,51 s (P52, remontée) avec m70–m71, puis le drop 2 à 58,00 s.
// Chaque segment : film [a, b], `kick` = attaque grave mesurée (s du morceau) posée à `at` (s du film) ;
// fondus enchaînés en quart de sinus de 12 ms, finis ≥ 15 ms avant l'attaque suivante de chaque côté.
export const MONTAGE_V2 = join(AUDIO_DIR, 'storm-ii-montage-60s-v2.wav');
export const XF_V2 = 0.012;
export const MONTAGE_V2_SEGMENTS = [
  { film: [0, 31.665], offset: 66.085, fadeIn: 0.25, label: 'Fin de la montée + drop 1 m40–m54 (continu, comme v1)' },
  { film: [31.653, 33.402], offset: 94.106, label: 'Respiration + roulement m71 (attaque 125,789 → film 31,683 = image 1901)' },
  { film: [33.39, 50.963], offset: 108.085, fadeIn: 0.045, label: 'Drop 2 m80–m87 + outro m88–m89 (continu, comme v1) ; entrée en fondu de 45 ms sur la fin de m79 (creux naturel avant m80) pour ne laisser aucun silence entre le roulement et le drop' },
  { film: [50.951, 54.471], offset: 59.033, label: 'Fin du pont m62–m63 (attaque 110,023 → film 50,990)' },
  { film: [54.459, 60], offset: 69.545, fadeOut: 0.8, label: 'Reprise m70–m71 + drop 2 m72 à 58,00 s (continu, comme v1)' },
];
export const JOINS_V2 = [
  { t: 31.665, frame: 1901, name: 'pré-drop (P31)', priority: true },
  { t: 33.402, frame: 2009, name: 'drop 2', priority: true },
  { t: 50.963, frame: 3060, name: 'outro → pont', priority: true },
  { t: 54.471, frame: 3271, name: 'pont → reprise', priority: true },
];
export function montageV2Filter() {
  const parts = [], labels = [];
  const n = MONTAGE_V2_SEGMENTS.length;
  MONTAGE_V2_SEGMENTS.forEach((s, i) => {
    const [a, b] = s.film;
    const fi = s.fadeIn ?? XF_V2, fo = s.fadeOut ?? XF_V2;
    const len = b - a;
    const delay = Math.round(a * SR);
    parts.push(`[m${i}]atrim=start=${(s.offset + a).toFixed(6)}:end=${(s.offset + b).toFixed(6)},asetpts=PTS-STARTPTS,` +
      `afade=t=in:d=${fi}:curve=qsin,afade=t=out:st=${(len - fo).toFixed(6)}:d=${fo}:curve=qsin,adelay=delays=${delay}S:all=1[s${i}]`);
    labels.push(`[s${i}]`);
  });
  const split = `[0]aresample=${SR},aformat=sample_fmts=fltp:channel_layouts=stereo,asplit=${n}${MONTAGE_V2_SEGMENTS.map((_, i) => `[m${i}]`).join('')}`;
  return `${split};${parts.join(';')};${labels.join('')}amix=inputs=${n}:normalize=0:duration=longest,apad=whole_dur=60,atrim=0:60[o]`;
}

export function run(cmd, args, { allowFail = false, input } = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28, input });
  if (r.status !== 0 && !allowFail) {
    throw new Error(`${cmd} ${args.join(' ')}\n${(r.stderr || '').slice(-3000)}`);
  }
  return r;
}

export function ffmpegVersion() {
  const r = run('ffmpeg', ['-version']);
  return r.stdout.split('\n')[0].replace(/ Copyright.*/, '');
}

export function probe(file) {
  const r = run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]);
  const j = JSON.parse(r.stdout);
  const a = j.streams.find((s) => s.codec_type === 'audio');
  return {
    sampleRate: Number(a.sample_rate),
    channels: a.channels,
    codec: a.codec_name,
    bits: a.bits_per_raw_sample ? Number(a.bits_per_raw_sample) : a.bits_per_sample,
    samples: a.duration_ts != null ? Number(a.duration_ts) : null,
    duration: Number(a.duration ?? j.format.duration),
  };
}

// Mono flottant 32 bits, à SR Hz, optionnellement une fenêtre [start, start+dur].
export function readMono(file, { start, dur, sr = SR } = {}) {
  const args = ['-v', 'error'];
  if (start != null) args.push('-ss', String(start));
  if (dur != null) args.push('-t', String(dur));
  // Stéréo → mono en (G + D) / 2 (niveau par canal conservé), pas le −3 dB × 2 par défaut de FFmpeg.
  const mono = probe(file).channels === 2 ? ['-af', 'pan=mono|c0=0.5*c0+0.5*c1'] : ['-ac', '1'];
  args.push('-i', file, ...mono, '-ar', String(sr), '-f', 'f32le', '-');
  const r = spawnSync('ffmpeg', args, { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(String(r.stderr).slice(-2000));
  const b = r.stdout;
  return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
}

// Mesure EBU R128 : intégré (LUFS), LRA, crête vraie (dBTP), et le journal M/S toutes les 100 ms.
export function loudness(file, { log = false } = {}) {
  const r = run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-filter_complex',
    `ebur128=peak=true${log ? ':framelog=info' : ''}`, '-f', 'null', '-'], { allowFail: false });
  const err = r.stderr;
  const sum = err.slice(err.lastIndexOf('Summary:'));
  const num = (re) => { const m = sum.match(re); return m ? Number(m[1]) : null; };
  const out = {
    integrated: num(/I:\s+(-?[\d.]+|-inf) LUFS/),
    lra: num(/LRA:\s+(-?[\d.]+) LU/),
    truePeak: num(/Peak:\s+(-?[\d.]+|-inf) dBFS/),
  };
  if (log) {
    out.frames = [];
    for (const line of err.split('\n')) {
      const m = line.match(/t:\s*([\d.]+)\s+TARGET:.*?M:\s*(-?[\d.]+|-inf)\s+S:\s*(-?[\d.]+|-inf)/);
      if (m) out.frames.push({ t: Number(m[1]), M: Number(m[2]), S: Number(m[3]) });
    }
  }
  return out;
}

// Crête échantillon (dBFS) et RMS d'un tableau.
export function peakDb(x) {
  let p = 0;
  for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v > p) p = v; }
  return 20 * Math.log10(p || 1e-12);
}
export function rmsDb(x) {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return 10 * Math.log10(s / Math.max(1, x.length) || 1e-24);
}

// Instant du pic d'un fichier : maximum de l'enveloppe RMS sur 5 ms (s depuis le début du fichier).
export function peakTime(file) {
  const x = readMono(file);
  const win = Math.round(SR * 0.005);
  let best = -1, bestI = 0;
  for (let i = 0; i + win <= x.length; i += win) {
    let s = 0;
    for (let k = i; k < i + win; k++) s += x[k] * x[k];
    if (s > best) { best = s; bestI = i; }
  }
  return (bestI + win / 2) / SR;
}

// FFT radix 2 en place (re, im de longueur 2^n).
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

// Spectre de puissance moyen (fenêtres de Hann de 4096, recouvrement 50 %).
export function powerSpectrum(x, n = 4096) {
  const acc = new Float64Array(n / 2);
  const hann = new Float64Array(n).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  let count = 0;
  for (let s = 0; s + n <= x.length; s += n / 2) {
    const re = new Float64Array(n), im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = x[s + i] * hann[i];
    fft(re, im);
    for (let k = 0; k < n / 2; k++) acc[k] += re[k] * re[k] + im[k] * im[k];
    count++;
  }
  for (let k = 0; k < n / 2; k++) acc[k] /= Math.max(1, count);
  return { power: acc, binHz: SR / n };
}

export function spectralFeatures(x) {
  const { power, binHz } = powerSpectrum(x);
  let tot = 0, wsum = 0, lo = 0, mid = 0, hi = 0;
  const chroma = new Float64Array(12);
  for (let k = 1; k < power.length; k++) {
    const f = k * binHz, p = power[k];
    tot += p; wsum += p * f;
    if (f < 250) lo += p; else if (f < 4000) mid += p; else hi += p;
    if (f >= 55 && f <= 5000) {
      const pc = ((Math.round(12 * Math.log2(f / 440)) % 12) + 12 + 9) % 12; // 0 = do
      chroma[pc] += p;
    }
  }
  const db = (v) => 10 * Math.log10(v || 1e-24);
  const cs = chroma.reduce((a, b) => a + b, 0) || 1;
  return {
    centroidHz: wsum / (tot || 1),
    bandsDb: { grave: db(lo), medium: db(mid), aigu: db(hi) },
    chroma: Array.from(chroma, (v) => v / cs),
  };
}

export function cosineDistance(a, b) {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return 1 - d / (Math.sqrt(na * nb) || 1);
}

// Temps du morceau → temps du film, d'après MONTAGE_MAP.
export function songToFilm(t) {
  for (const seg of MONTAGE_MAP) {
    const len = seg.film[1] - seg.film[0];
    if (t >= seg.song - 1e-9 && t < seg.song + len - 1e-9) return seg.film[0] + (t - seg.song);
  }
  return null;
}

export function loadBeats() {
  const j = JSON.parse(readFileSync(join(AUDIO_DIR, 'storm-ii.beats.json'), 'utf8'));
  const beats = [];
  j.beatTimes.forEach((t, i) => {
    const f = songToFilm(t);
    if (f != null) beats.push({ index: i, song: t, film: f, downbeat: i % 4 === 3 });
  });
  beats.sort((a, b) => a.film - b.film);
  return { bpm: j.bpm, count: j.count, beats };
}

// Les 54 plans de TRAME-60s.md : { id, start, end, action, raccord }.
export function loadShots() {
  const md = readFileSync(join(TRAILER, 'TRAME-60s.md'), 'utf8');
  const shots = [];
  for (const line of md.split('\n')) {
    const m = line.match(/^\| (P\d\d) \| [^|]+ \| (\d+)–(\d+) \| ([^|]*)\| ([^|]*)\| ([^|]*)\| ([^|]*)\|/);
    if (m) shots.push({ id: m[1], start: Number(m[2]), end: Number(m[3]), source: m[4].trim(), cadre: m[5].trim(), action: m[6].trim(), raccord: m[7].trim() });
  }
  return shots;
}

export function requireFile(path, what) {
  if (!existsSync(path)) {
    console.error(`✗ ${what} introuvable : ${path}`);
    process.exit(2);
  }
}

export const fmt = (v, d = 2) => (v == null || !isFinite(v) ? '—' : v.toFixed(d).replace('.', ','));
