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

// ── Montage v3 (qa/MUSIQUE-V3.md) ───────────────────────────────────────────────────────────────
// Film à 24 i/s. Musique seule, sans effet. Silence, vrai début du morceau en fondu doux, montée, drop 1,
// pont (respiration), reprise + drop 2, respiration + roulement, impact final à 58,000 s, queue qui s'éteint.
// Grille MESURÉE sur ce MP3 (pas celle de storm-ii.beats.json, quantifiée à 10 ms et arrondie à 136,9 BPM) :
//   période = intercorrélation de l'enveloppe des drops 1 et 2 (32 mesures d'écart) → 0,437965 s (136,997 BPM) ;
//   phase   = médiane de l'attaque (50 % de montée, 30–150 Hz) de 128 grosses caisses des drops → m40 = 71,4914 s.
export const V3 = {
  fps: 24,
  beat: 0.437965,
  m40: 71.4914,
  hit: 58.0,         // premier temps de m72 (drop 2 du morceau) posé sur le logo
  xf: 0.025,         // fondu enchaîné (quart de sinus) à chaque raccord
  guard: 0.008,      // le fondu finit 8 ms avant le temps (aucune attaque entamée)
  fadeIn: 2.0,       // fondu d'entrée (courbe cubique) sur le tout début du morceau
  release: 0.12,     // relâchement de l'impact final avant la queue
  tailDecay: 3.0,    // queue : décroissance exponentielle (−100 dB en 3 s, soit −20 dB/0,6 s)
  tailCut: 59.92,    // sécurité : fondu de 80 ms à zéro, fini à 60,000 s
};
export const v3Bar = (n, beat = 1) => V3.m40 + ((n - 40) * 4 + (beat - 1)) * V3.beat;
export const MONTAGE_V3 = join(AUDIO_DIR, 'storm-ii-montage-60s-v3.wav');
export const MIX_V3 = join(QA_DIR, 'mix-v3.wav');
export const BEATS_V3 = join(QA_DIR, 'mix-v3.beats.json');

// Segments du morceau, dans l'ordre du film. `bars` = [première mesure, dernière mesure] du morceau ; `beats` = longueur.
// Placement à rebours depuis l'impact : le 5e temps du segment G (m72 temps 1) tombe à V3.hit.
export function montageV3Segments() {
  const T = V3.beat;
  const G = V3.hit - 4 * T;              // m71.1
  const E = G - 48 * T;                  // m68.1 (m68–m79, 12 mesures continues)
  const D = E - 32 * T;                  // m56.1 (m56–m63, 8 mesures)
  const B = D - 24 * T;                  // m38.1 (m38–m43, 6 mesures)
  const A0 = B - v3Bar(5);               // le 0 du morceau
  const H = V3.hit + T;                  // m88 temps 2
  return [
    { id: 'A', section: 'intro', label: 'Vrai début du morceau (intro, phrases et trous), fondu doux', bars: [-1, 4], song: [0, v3Bar(5)], film: [A0, B] },
    { id: 'B', section: 'montee+drop1', label: 'Montée m38–m39 puis drop 1 m40–m43 (continu)', bars: [38, 43], song: [v3Bar(38), v3Bar(44)], film: [B, D] },
    { id: 'D', section: 'respiration', label: 'Pont m56–m63 (sans grave, mélodie ; remontée du grave sur m63)', bars: [56, 63], song: [v3Bar(56), v3Bar(64)], film: [D, E] },
    { id: 'E', section: 'reprise+drop2', label: 'Reprise m68–m71 (respiration + roulement) puis drop 2 m72–m79 (continu)', bars: [68, 79], song: [v3Bar(68), v3Bar(80)], film: [E, G] },
    { id: 'G', section: 'pre-impact', label: 'Respiration + roulement m71, impact m72 temps 1 (logo)', bars: [71, 72], song: [v3Bar(71), v3Bar(72, 2)], film: [G, H] },
    { id: 'H', section: 'queue', label: 'Queue : nappe de l\'outro m88 (dès le temps 2), éteinte en exponentielle', bars: [88, 89], song: [v3Bar(88, 2), v3Bar(88, 2) + (60 - H)], film: [H, 60] },
  ];
}

// Raccords v3 (temps du film) : le temps où le segment suivant reprend la grille.
export function joinsV3() {
  const s = montageV3Segments();
  return s.slice(1).map((seg, i) => ({ t: seg.film[0], from: s[i].id, to: seg.id,
    songOut: s[i].song[1], songIn: seg.song[0], frame24: seg.film[0] * V3.fps }));
}

// Graphe FFmpeg du montage v3 (48 kHz, flottant). Chaque segment commence `guard + xf` avant son temps d'entrée
// (fondu d'entrée quart de sinus) ; le précédent s'arrête `guard` avant (fondu de sortie sur la même fenêtre).
export function montageV3Filter() {
  const segs = montageV3Segments();
  const parts = [], labels = [];
  const pre = V3.guard + V3.xf;
  const smp = (t) => Math.round(t * SR);
  segs.forEach((s, i) => {
    const first = i === 0, last = i === segs.length - 1;
    const preIn = first ? 0 : (s.id === 'H' ? V3.guard + V3.release : pre);
    const songA = s.song[0] - preIn, filmA = s.film[0] - preIn;
    const next = segs[i + 1];
    const filmB = last ? 60 : s.film[1] - V3.guard;
    const len = filmB - filmA;
    const songB = songA + len;
    const f = [`[m${i}]atrim=start_sample=${smp(songA)}:end_sample=${smp(songB)},asetpts=PTS-STARTPTS`];
    if (first) f.push(`afade=t=in:st=0:d=${V3.fadeIn}:curve=cub`);
    else f.push(`afade=t=in:st=0:d=${(preIn - V3.guard).toFixed(6)}:curve=qsin`);
    if (!last) {
      const fo = next.id === 'H' ? V3.release : V3.xf;
      f.push(`afade=t=out:st=${(len - fo).toFixed(6)}:d=${fo}:curve=qsin`);
    } else {
      f.push(`afade=t=out:st=${(s.film[0] - filmA).toFixed(6)}:d=${V3.tailDecay}:curve=exp`);
      f.push(`afade=t=out:st=${(V3.tailCut - filmA).toFixed(6)}:d=${(60 - V3.tailCut).toFixed(6)}:curve=qsin`);
    }
    f.push(`adelay=delays=${smp(filmA)}S:all=1[s${i}]`);
    parts.push(f.join(','));
    labels.push(`[s${i}]`);
  });
  const split = `[0]aresample=${SR},aformat=sample_fmts=fltp:channel_layouts=stereo,asplit=${segs.length}${segs.map((_, i) => `[m${i}]`).join('')}`;
  return `${split};${parts.join(';')};${labels.join('')}amix=inputs=${segs.length}:normalize=0:duration=longest,apad=whole_dur=60,atrim=end_sample=${SR * 60}[o]`;
}

// ── Montage v4 (qa/MUSIQUE-V4.md) ───────────────────────────────────────────────────────────────
// Le film commande : grille du film = grille du morceau (V3.beat), mesure 1 du film à l'image 0, 33 mesures + logo.
// Chaque segment : film [a, b] ← morceau (film + off). `join` décrit l'entrée du segment :
//   'beat' : fondu de V3.xf fini V3.guard avant le temps a (comme v3) ; 'gap' : fondu de 40 ms centré sur a (coupe
//   dans un « trou » de l'intro, réverbération seule des deux côtés) ; 'release' : relâchement de l'impact (v3).
export const V4 = { hit: 33 * 4 * V3.beat, gapXf: 0.04, sun: 32 / 24 }; // hit = mesure 34 du film (57,811 s) ; sun = image 32
export const filmBar = (n, beat = 1) => ((n - 1) * 4 + (beat - 1)) * V3.beat; // mesure n du film (1 = image 0)
export const MONTAGE_V4 = join(AUDIO_DIR, 'storm-ii-montage-60s-v4.wav');
export const HABILLAGE_V4_RAW = join(QA_TMP, 'habillage-v4-brut.wav');
export const MIX_V4 = join(QA_DIR, 'mix-v4.wav');
export const MIX_V4_MUSIQUE = join(QA_DIR, 'mix-v4-musique.wav');
export const MIX_V4_HABILLAGE = join(QA_DIR, 'mix-v4-habillage.wav');
export const BEATS_V4 = join(QA_DIR, 'mix-v4.beats.json');

// Attaques MESURÉES dans le MP3 qui fixent l'intro (montée du RMS 5 ms la plus raide, voir MUSIQUE-V4.md § 1).
export const V4_INTRO = {
  noteM0: 1.431,      // note de m0 temps 1 (première phrase) : ouvre le film
  phrase2: 3.900,     // début de la 2e phrase après un trou (+17,8 dB en 20 ms) : allumage du Soleil
  phrase3: 7.076,     // début de la 3e phrase (+12,4 dB)
};

export function montageV4Segments() {
  const T = V3.beat, hit = filmBar(34);
  const at = (songT, filmT) => songT - filmT; // décalage morceau − film
  const sun = V4.sun;
  return [
    { id: 'I1', section: 'cosmos', label: 'Intro : note de m0 (1re phrase), dès l\'image 0', film: [0, 1.05], off: at(V4_INTRO.noteM0 - 0.016, 0), bars: 'm0', join: 'start' },
    { id: 'I2', section: 'cosmos', label: 'Intro : fin du trou 1 puis 2e phrase, attaque sur le Soleil (image 32)', film: [1.05, 3.2], off: at(V4_INTRO.phrase2, sun), bars: 'm1–m2', join: 'gap' },
    { id: 'I3', section: 'cosmos', label: 'Intro : fin du trou 2 puis 3e phrase (sur le 9e temps du film)', film: [3.2, filmBar(4, 2)], off: at(V4_INTRO.phrase3, 8 * T), bars: 'm3–m4', join: 'gap' },
    { id: 'M1', section: 'declic', label: 'Début de la montée : m5 (trou), 4e phrase au temps 2, m6–m8 (le grave entre sur m8 = mesure 7 du film)', film: [filmBar(4, 2), filmBar(8)], off: at(v3Bar(5, 2), filmBar(4, 2)), bars: 'm5–m8', join: 'gap' },
    { id: 'M2', section: 'decision', label: 'Fin de la montée m33–m39 puis drop 1 m40–m44 (continu)', film: [filmBar(8), filmBar(20)], off: at(v3Bar(33), filmBar(8)), bars: 'm33–m44', join: 'beat' },
    { id: 'D2', section: 'coureur-cycliste', label: 'Drop 2, 7 dernières mesures m81–m87, puis outro m88–m91 (continu)', film: [filmBar(20), filmBar(31)], off: at(v3Bar(81), filmBar(20)), bars: 'm81–m91', join: 'beat' },
    { id: 'R', section: 'final', label: 'Reprise m69–m71 (roulement dans m71) puis impact m72 temps 1', film: [filmBar(31), hit + T], off: at(v3Bar(69), filmBar(31)), bars: 'm69–m72', join: 'beat' },
    { id: 'Q', section: 'logo', label: 'Queue : nappe de l\'outro m88 dès le temps 2, décroissance exponentielle', film: [hit + T, 60], off: at(v3Bar(88, 2), hit + T), bars: 'm88', join: 'release' },
  ];
}

// Gains par section (dB, film), interpolés linéairement en amplitude entre deux points (transitions d'un temps).
export function gainPointsV4() {
  const T = V3.beat, hit = filmBar(34);
  return [
    [0, 5], [filmBar(4), 5], [filmBar(4, 2), 1.5],               // intro relevée ; début de montée un peu relevé
    [filmBar(8), 1.5], [filmBar(8, 2), 1],                       // fin de montée : presque nature (le niveau monte seul)
    [filmBar(15) - T, 1], [filmBar(15) - 0.01, 0],               // drops : nature
    [filmBar(27), 0], [filmBar(27, 2), 3],                       // bivouac relevé
    [filmBar(31) - 0.035, 3], [filmBar(31) - 0.008, -2],         // reprise un peu sous les drops…
    [hit - 0.02, -2], [hit - 0.004, 1], [60, 1],                 // … pour que l'impact ressorte
  ];
}
function gainExprV4() {
  const pts = gainPointsV4().map(([t, d]) => [t, Math.pow(10, d / 20)]);
  let e = pts.at(-1)[1].toFixed(6);
  for (let i = pts.length - 2; i >= 0; i--) {
    const [t0, g0] = pts[i], [t1, g1] = pts[i + 1];
    const seg = t1 - t0 < 1e-9 ? g1.toFixed(6) : `${g0.toFixed(6)}+(${(g1 - g0).toFixed(6)})*(t-${t0.toFixed(6)})/${(t1 - t0).toFixed(6)}`;
    e = `if(lt(t,${t1.toFixed(6)}),${seg},${e})`;
  }
  return `if(lt(t,0),${pts[0][1].toFixed(6)},${e})`;
}

export function joinsV4() {
  const s = montageV4Segments();
  return s.slice(1).map((seg, i) => ({ t: seg.film[0], from: s[i].id, to: seg.id, kind: seg.join,
    songOut: seg.film[0] + s[i].off, songIn: seg.film[0] + seg.off }));
}

export function montageV4Filter() {
  const segs = montageV4Segments();
  const smp = (t) => Math.round(t * SR);
  const parts = [], labels = [];
  segs.forEach((s, i) => {
    const next = segs[i + 1];
    // fenêtre d'entrée [filmA, s.film[0] (+…)] et de sortie, selon le type de raccord
    let filmA, fin;
    if (s.join === 'start') { filmA = 0; fin = 0.010; }
    else if (s.join === 'gap') { filmA = s.film[0] - V4.gapXf / 2; fin = V4.gapXf; }
    else if (s.join === 'release') { filmA = s.film[0] - V3.guard - V3.release; fin = V3.release; }
    else { filmA = s.film[0] - V3.guard - V3.xf; fin = V3.xf; }
    let filmB, fout;
    if (!next) { filmB = 60; fout = null; }
    else if (next.join === 'gap') { filmB = s.film[1] + V4.gapXf / 2; fout = V4.gapXf; }
    else if (next.join === 'release') { filmB = s.film[1] - V3.guard; fout = V3.release; }
    else { filmB = s.film[1] - V3.guard; fout = V3.xf; }
    const len = filmB - filmA;
    const songA = filmA + s.off;
    const f = [`[m${i}]atrim=start_sample=${smp(songA)}:end_sample=${smp(songA) + smp(len)},asetpts=PTS-STARTPTS`,
      `afade=t=in:st=0:d=${fin.toFixed(6)}:curve=${s.join === 'start' ? 'tri' : 'qsin'}`];
    if (fout) f.push(`afade=t=out:st=${(len - fout).toFixed(6)}:d=${fout.toFixed(6)}:curve=qsin`);
    else {
      f.push(`afade=t=out:st=${(s.film[0] - filmA).toFixed(6)}:d=${V3.tailDecay}:curve=exp`);
      f.push(`afade=t=out:st=${(V3.tailCut - filmA).toFixed(6)}:d=${(60 - V3.tailCut).toFixed(6)}:curve=qsin`);
    }
    f.push(`adelay=delays=${smp(filmA)}S:all=1[s${i}]`);
    parts.push(f.join(','));
    labels.push(`[s${i}]`);
  });
  const split = `[0]aresample=${SR},aformat=sample_fmts=fltp:channel_layouts=stereo,asplit=${segs.length}${segs.map((_, i) => `[m${i}]`).join('')}`;
  return `${split};${parts.join(';')};${labels.join('')}amix=inputs=${segs.length}:normalize=0:duration=longest,apad=whole_dur=60,atrim=end_sample=${SR * 60},` +
    `asetnsamples=n=48,volume=eval=frame:volume='${gainExprV4()}'[o]`;
}

// Habillage v4 : trois sons de la banque, et rien d'autre. `at` = film (s) où commence le fichier ; gain en dB.
export function habillageV4Cues() {
  return [
    { file: 'souffle-cosmos.wav', at: 0, gainDb: -10, cause: 'Nébuleuse → Soleil : souffle grave qui monte de l\'image 0 à l\'allumage' },
    { file: 'impact-soleil.wav', at: V4.sun - 0.002, gainDb: -4, cause: 'Allumage du Soleil (image 32), sur l\'attaque de la 2e phrase' },
    { file: 'impact-logo.wav', at: filmBar(34) - 0.002, gainDb: -1, cause: 'Logo : coup du logo sous m72 temps 1, queue éteinte avant 60 s' },
  ];
}

// ── Montages v6 A / B / C (qa/MUSIQUE-V6.md) ─────────────────────────────────────────────────────
// Musique seule, aucun effet. Structure DECOUPAGE-24.md « v6 » : même grille, mesure 1 du film à l'image 0, logo en
// mesure 34 (57,811 s). Chaque segment : film [mesure a, mesure b[ ← morceau à partir de `song` (mesure du morceau,
// ou secondes pour l'intro). Raccords : 'beat' = fondu enchaîné de 25 ms fini 8 ms avant le temps (attaque franche) ;
// 'long' = fondu enchaîné à puissance constante (sinus / cosinus) de `xf` s, fini 8 ms avant le temps (matière tenue).
// Le dernier segment dépasse l'impact : décroissance exponentielle dès impact + 0,30 s, zéro à 60,000 s.
// Aucune portion du morceau n'est jouée deux fois (vérifié par beats-v6.mjs, champ `nonRepetition`).
const sec = (s) => ({ sec: s });
export const V6 = {
  A: {
    name: 'continu', idee: 'Le morceau dans son ordre, en trois longs passages : 28 mesures continues de la montée au drop 1, le pont pour le bivouac et l\'espoir, la reprise sur le logo.',
    segs: [
      { id: 'A1', bars: [1, 29], song: 24, label: 'Montée m24–m39 puis drop 1 m40–m51, sans coupe' },
      { id: 'A2', bars: [29, 31], song: 56, join: 'beat', label: 'Pont m56–m57 (le drop s\'arrête comme dans le morceau, m55 → m56)' },
      { id: 'A3', bars: [31, 35], song: 61, join: 'long', xf: 0.4, label: 'Fin du pont m61–m63 (le grave remonte), impact sur m64 (la reprise)' },
    ],
    sections: { cosmos: [1, 3], declic: [4, 7], decision: [8, 13], depart: [14, 16], montagne: [17, 21], 'coureur-cycliste': [22, 28], bivouac: [29, 30], final: [31, 33], logo: [34, 34] },
    gains: [[0, 0], [60, 0]],
  },
  B: {
    name: 'doux épique', idee: 'Le lac et le panorama sur la fin de la montée, la plus ample et la plus tenue du morceau ; le drop 1 n\'arrive qu\'avec le coureur, par l\'enchaînement naturel m39 → m40.',
    segs: [
      { id: 'B1', bars: [1, 29], song: 19, label: 'Montée m19–m39 (panorama sur m35–m39), drop 1 m40–m46 au coureur, sans coupe' },
      { id: 'B2', bars: [29, 31], song: 88, join: 'beat', label: 'Outro m88–m89 (bivouac)' },
      { id: 'B3', bars: [31, 35], song: 61, join: 'long', xf: 0.4, label: 'Fin du pont m61–m63, impact sur m64 (la reprise)' },
    ],
    sections: { cosmos: [1, 3], declic: [4, 7], decision: [8, 13], depart: [14, 16], montagne: [17, 21], 'coureur-cycliste': [22, 28], bivouac: [29, 30], final: [31, 33], logo: [34, 34] },
    gains: [[0, 0], [60, 0]],
  },
  C: {
    name: 'le drop pour le logo', idee: 'Rien ne se répète : la montée jusqu\'à m31, le pont pour le panorama, la reprise pour le coureur, l\'outro pour la nuit, et le drop 1, gardé intact, n\'éclate qu\'une fois, sur le logo.',
    segs: [
      { id: 'C1', bars: [1, 4], song: sec(0.03), label: 'Intro, le vrai début du morceau (2 phrases)' },
      { id: 'C2', bars: [4, 17], song: 19, join: 'long', xf: 0.4, label: 'Montée m19–m31' },
      { id: 'C3', bars: [17, 29], song: 60, join: 'long', xf: 0.3, label: 'Pont m60–m63 (panorama), reprise m64–m71 (coureur, roulement final)' },
      { id: 'C4', bars: [29, 31], song: 88, join: 'beat', label: 'Outro m88–m89 (bivouac)' },
      { id: 'C5', bars: [31, 35], song: 37, join: 'long', xf: 0.4, label: 'Fin de la montée m37–m39, drop 1 (m40) sur le logo' },
    ],
    sections: { cosmos: [1, 3], declic: [4, 7], decision: [8, 13], depart: [14, 16], montagne: [17, 20], 'coureur-cycliste': [21, 28], bivouac: [29, 30], final: [31, 33], logo: [34, 34] },
    gains: [[0, 0], [60, 0]],
  },
};
export const v6Paths = (k) => ({
  montage: join(AUDIO_DIR, `storm-ii-montage-60s-v6${k.toLowerCase()}.wav`),
  mix: join(QA_DIR, `mix-v6${k.toLowerCase()}.wav`),
  beats: join(QA_DIR, `mix-v6${k.toLowerCase()}.beats.json`),
  m4a: join(TRAILER, 'livraison', `LKDV-musique-v6-${k}.m4a`),
});
export function v6Segments(k) {
  return V6[k].segs.map((s) => {
    const film = [filmBar(s.bars[0]), s.bars[1] >= 35 ? 60 : filmBar(s.bars[1])];
    const songStart = typeof s.song === 'number' ? v3Bar(s.song) : s.song.sec;
    return { ...s, film, off: songStart - film[0], join: s.join ?? 'start' };
  });
}
export function joinsV6(k) {
  const s = v6Segments(k);
  return s.slice(1).map((seg, i) => ({ t: seg.film[0], from: s[i].id, to: seg.id, kind: seg.join, xf: seg.join === 'long' ? seg.xf : V3.xf,
    songOut: seg.film[0] + s[i].off, songIn: seg.film[0] + seg.off }));
}
function gainExpr(points) {
  const pts = points.map(([t, d]) => [t, Math.pow(10, d / 20)]);
  let e = pts.at(-1)[1].toFixed(6);
  for (let i = pts.length - 2; i >= 0; i--) {
    const [t0, g0] = pts[i], [t1, g1] = pts[i + 1];
    const seg = t1 - t0 < 1e-9 ? g1.toFixed(6) : `${g0.toFixed(6)}+(${(g1 - g0).toFixed(6)})*(t-${t0.toFixed(6)})/${(t1 - t0).toFixed(6)}`;
    e = `if(lt(t,${t1.toFixed(6)}),${seg},${e})`;
  }
  return e;
}
export const V6_TAIL = { after: 0.30, decay: 2.9, cut: 59.92 };
export function montageV6Filter(k) {
  const segs = v6Segments(k);
  const hit = filmBar(34);
  const smp = (t) => Math.round(t * SR);
  const parts = [], labels = [];
  segs.forEach((s, i) => {
    const next = segs[i + 1];
    const fin = s.join === 'start' ? (typeof s.song === 'number' ? 0.005 : 0.02) : (s.join === 'long' ? s.xf : V3.xf);
    const filmA = s.join === 'start' ? 0 : s.film[0] - V3.guard - fin;
    const fout = next ? (next.join === 'long' ? next.xf : V3.xf) : null;
    const filmB = next ? s.film[1] - V3.guard : 60;
    const len = filmB - filmA;
    const f = [`[m${i}]atrim=start_sample=${smp(filmA + s.off)}:end_sample=${smp(filmA + s.off) + smp(len)},asetpts=PTS-STARTPTS`,
      `afade=t=in:st=0:d=${fin.toFixed(6)}:curve=${s.join === 'start' ? 'tri' : 'qsin'}`];
    if (fout) f.push(`afade=t=out:st=${(len - fout).toFixed(6)}:d=${fout.toFixed(6)}:curve=qsin`);
    else {
      f.push(`afade=t=out:st=${(hit + V6_TAIL.after - filmA).toFixed(6)}:d=${V6_TAIL.decay}:curve=exp`);
      f.push(`afade=t=out:st=${(V6_TAIL.cut - filmA).toFixed(6)}:d=${(60 - V6_TAIL.cut).toFixed(6)}:curve=qsin`);
    }
    f.push(`adelay=delays=${smp(filmA)}S:all=1[s${i}]`);
    parts.push(f.join(','));
    labels.push(`[s${i}]`);
  });
  const split = `[0]aresample=${SR},aformat=sample_fmts=fltp:channel_layouts=stereo,asplit=${segs.length}${segs.map((_, i) => `[m${i}]`).join('')}`;
  return `${split};${parts.join(';')};${labels.join('')}amix=inputs=${segs.length}:normalize=0:duration=longest,apad=whole_dur=60,atrim=end_sample=${SR * 60},` +
    `asetnsamples=n=48,volume=eval=frame:volume='${gainExpr(V6[k].gains)}'[o]`;
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
