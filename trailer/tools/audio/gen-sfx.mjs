#!/usr/bin/env node
// Banque d'effets GÉNÉRÉS (synthèse par bruit filtré, graine fixe) → assets/audio/sfx/<nom>.wav
// WAV 48 kHz, 24 bits, mono, crête échantillon à −3 dBFS, rognés.
// Usage : node tools/audio/gen-sfx.mjs            (tous)
//         node tools/audio/gen-sfx.mjs whoosh-court-a impact-sourd-a   (quelques-uns)
// Chaque recette est décrite ici même : c'est « la commande exacte » citée dans SOURCES.md.
import { join } from 'node:path';
import { SFX_DIR, SR, readMono } from './lib.mjs';
import {
  add, brown, expDecay, fadeIn, fadeOut, len, mulEnv, normalizePeak, pink, rng, scale, sine, svf, swell, white, writeWav,
} from './synth.mjs';

const exp = (a, b) => (u) => a * Math.pow(b / a, u); // balayage exponentiel de a à b

// Whoosh : bruit rose en passe-bande balayé, enveloppe en cloche dont le sommet est `peak`.
function whoosh({ dur, seed, f0, f1, q = 1.2, peak = 0.6, rise = 2.2, fall = 1.6, air = 0.25 }) {
  const n = len(dur);
  const body = svf(pink(n, seed), 'bp', exp(f0, f1), q);
  const hiss = svf(white(n, seed + 7), 'hp', exp(f0 * 3, f1 * 2), 0.7);
  const x = add(body, hiss, 0, air);
  return fadeOut(mulEnv(x, swell(peak, rise, fall)), 15);
}

// Impact sourd : sinus qui plonge (120 → 38 Hz) + bruit grave filtré, décroissance exponentielle.
function impactSourd({ dur, seed, f0 = 120, f1 = 38, tau = 0.25, noise = 0.5 }) {
  const n = len(dur);
  const tone = mulEnv(sine(n, f0, f1, 0.35), expDecay(tau, 0.003));
  const thump = mulEnv(svf(brown(n, seed), 'lp', exp(900, 120), 0.8), expDecay(tau * 0.35, 0.001));
  return fadeOut(add(tone, thump, 0, noise * 4), 30);
}

// Impact sec : transitoire claqué (bruit passe-haut très court) + corps médium.
function impactSec({ dur, seed, body = 190, tau = 0.06 }) {
  const n = len(dur);
  const crack = mulEnv(svf(white(n, seed), 'hp', 1800, 0.8), expDecay(0.012, 0.0005));
  const knock = mulEnv(svf(white(n, seed + 3), 'bp', body, 4), expDecay(tau, 0.001));
  const low = mulEnv(sine(n, body * 0.55, body * 0.4, 0.5), expDecay(tau * 1.4, 0.002));
  return fadeOut(add(add(crack, knock, 0, 3), low, 0, 0.5), 20);
}

// Crash (masquage des raccords) : bruit passe-haut à longue traîne, léger battement.
function crash({ dur, seed, tau = 0.7, f = 3500 }) {
  const n = len(dur);
  const x = svf(white(n, seed), 'hp', exp(f, f * 1.6), 0.7);
  const shimmer = svf(white(n, seed + 11), 'bp', exp(7000, 9000), 3);
  return fadeOut(mulEnv(add(x, shimmer, 0, 0.6), expDecay(tau, 0.002)), 60);
}

// Clac : deux transitoires plastiques rapprochés (ouverture/verrouillage de boucle).
function clac({ seed, gap = 0.011, f = 2600 }) {
  const n = len(0.16), x = new Float32Array(n);
  const click = (s, g, ff) => mulEnv(svf(white(len(0.05), s), 'bp', ff, 2.5), expDecay(0.006, 0.0003)).map((v) => v * g);
  add(x, click(seed, 0.6, f * 0.8), 0);
  add(x, click(seed + 1, 1.0, f), len(gap));
  add(x, mulEnv(svf(white(len(0.05), seed + 2), 'bp', 420, 3), expDecay(0.01, 0.0005)), len(gap), 1.2);
  return fadeOut(x, 10);
}

// Sonnette « ding-dong » : deux notes de cloche (partiels légèrement inharmoniques), décroissance lente.
function sonnette({ seed, notes = [659.25, 523.25], step = 0.55, tau = 0.9 }) {
  const n = len(step + 1.9), x = new Float32Array(n);
  const partials = [[1, 1], [2.01, 0.45], [2.76, 0.25], [4.07, 0.12], [5.43, 0.05]];
  notes.forEach((f, k) => {
    const m = len(1.9);
    const tone = new Float32Array(m);
    for (const [ratio, amp] of partials) add(tone, mulEnv(sine(m, f * ratio, f * ratio, 1, rng(seed + k)() * 6), expDecay(tau / ratio ** 0.5, 0.002)), 0, amp);
    add(x, tone, len(k * step));
  });
  return fadeOut(x, 80);
}

// Souffle / respiration : bruit rose passe-bande doux, enveloppe d'inspiration.
function souffle({ dur, seed, f = 900, peak = 0.55 }) {
  const n = len(dur);
  const x = svf(pink(n, seed), 'bp', (u) => f * (0.8 + 0.4 * u), 0.9);
  return fadeOut(fadeIn(mulEnv(x, swell(peak, 1.6, 1.4)), 20), 40);
}

// Vent d'altitude : bruit brun + rafales en passe-bande modulé lentement.
function vent({ dur, seed, f = 520 }) {
  const n = len(dur);
  const r = rng(seed);
  const p1 = r() * 6, p2 = r() * 6;
  const gust = (u) => f * (1 + 0.45 * Math.sin(2 * Math.PI * (u * 1.3) + p1) + 0.25 * Math.sin(2 * Math.PI * (u * 3.1) + p2));
  const x = add(svf(pink(n, seed), 'bp', gust, 3.5), svf(brown(n, seed + 5), 'lp', 300, 0.7), 0, 0.6);
  return fadeOut(fadeIn(mulEnv(x, (u) => 0.75 + 0.25 * Math.sin(2 * Math.PI * u * 0.9 + p2)), 250), 400);
}

// Crépitement de feu : grondement grave + craquements aléatoires résonants.
function feu({ dur, seed, density = 38 }) {
  const n = len(dur), x = svf(brown(n, seed), 'lp', 260, 0.7).map((v) => v * 0.35);
  const r = rng(seed + 9);
  const count = Math.round(density * dur);
  for (let k = 0; k < count; k++) {
    const at = Math.floor(r() * n), g = 0.2 + r() * (r() < 0.12 ? 1.6 : 0.6);
    const pop = mulEnv(svf(white(len(0.03), seed + 100 + k), 'bp', 1200 + r() * 3800, 3 + r() * 5), expDecay(0.002 + r() * 0.006, 0.0002));
    add(x, pop, at, g);
  }
  return fadeOut(fadeIn(x, 120), 250);
}

// Pluie sur une vitre : gouttes denses très courtes + chuintement passe-haut.
function pluie({ dur, seed, density = 260 }) {
  const n = len(dur), x = svf(pink(n, seed), 'hp', 2500, 0.7).map((v) => v * 0.35);
  const r = rng(seed + 4);
  for (let k = 0; k < Math.round(density * dur); k++) {
    const drop = mulEnv(svf(white(len(0.012), seed + 300 + k), 'bp', 2000 + r() * 5000, 4), expDecay(0.0015, 0.0002));
    add(x, drop, Math.floor(r() * n), 0.15 + r() * 0.5);
  }
  return fadeOut(fadeIn(x, 150), 300);
}

// Rails : grondement + paires de chocs de bogie (« ta-dam ») toutes les `period` s.
function rails({ dur, seed, period = 0.62 }) {
  const n = len(dur), x = svf(brown(n, seed), 'lp', 180, 0.8).map((v) => v * 0.8);
  add(x, svf(pink(n, seed + 1), 'bp', 900, 1.2), 0, 0.12);
  for (let t = 0.08, k = 0; t < dur - 0.2; t += period, k++) {
    for (const dt of [0, 0.105]) {
      const hit = mulEnv(add(svf(white(len(0.12), seed + 40 + k), 'bp', 650, 2), svf(white(len(0.12), seed + 80 + k), 'lp', 220, 1), 0, 2), expDecay(0.025, 0.001));
      add(x, hit, len(t + dt), 0.9);
    }
  }
  return fadeOut(fadeIn(x, 150), 250);
}

// Gravillons sous une roue : grains denses passe-haut, nuage qui gonfle puis retombe.
function gravillons({ dur, seed, density = 520, peak = 0.3 }) {
  const n = len(dur), x = new Float32Array(n);
  const r = rng(seed + 6);
  add(x, svf(pink(n, seed), 'bp', 1800, 0.8), 0, 0.25);
  for (let k = 0; k < Math.round(density * dur); k++) {
    const grain = mulEnv(svf(white(len(0.01), seed + 500 + k), 'bp', 2500 + r() * 6000, 3), expDecay(0.0012, 0.0001));
    add(x, grain, Math.floor(r() * n), 0.2 + r() * 0.8);
  }
  return fadeOut(mulEnv(x, swell(peak, 0.8, 1.5)), 30);
}

// Déclic d'appareil photo (téléphone) : deux clics de volet à 70 ms.
function declic({ seed }) {
  const n = len(0.18), x = new Float32Array(n);
  const c = (s, f, g) => mulEnv(svf(white(len(0.04), s), 'bp', f, 2), expDecay(0.004, 0.0002)).map((v) => v * g);
  add(x, c(seed, 3200, 1), 0);
  add(x, c(seed + 1, 2400, 0.7), len(0.07));
  return fadeOut(x, 10);
}

// Notification discrète : deux tics brefs (pas de mélodie : la règle « pas de carillon » est tenue).
function notification({ seed }) {
  const n = len(0.22), x = new Float32Array(n);
  const tic = (s) => mulEnv(svf(white(len(0.05), s), 'bp', 4200, 6), expDecay(0.008, 0.0005));
  add(x, tic(seed), 0); add(x, tic(seed + 1), len(0.1), 0.8);
  return fadeOut(x, 10);
}

// Éclaboussure de torrent : gerbe de bruit passe-bande + gouttes qui retombent.
function eclaboussure({ dur, seed }) {
  const n = len(dur);
  const x = mulEnv(svf(pink(n, seed), 'bp', exp(700, 3500), 1.1), swell(0.12, 0.7, 2.2));
  const r = rng(seed + 2);
  for (let k = 0; k < 70; k++) {
    const t = 0.1 + Math.pow(r(), 0.7) * (dur - 0.3);
    const d = mulEnv(svf(white(len(0.02), seed + 700 + k), 'bp', 1500 + r() * 4000, 5), expDecay(0.004, 0.0003));
    add(x, d, len(t), 0.4 * (1 - t / dur));
  }
  return fadeOut(x, 60);
}

// Montée (riser) : bruit dont le passe-bande et le niveau montent, sommet à la toute fin.
function riser({ dur, seed }) {
  const n = len(dur);
  const x = add(svf(pink(n, seed), 'bp', exp(250, 7000), (u) => 1 + 4 * u), svf(white(n, seed + 1), 'hp', exp(2000, 9000), 0.7), 0, 0.35);
  mulEnv(x, (u) => Math.pow(u, 2.4));
  return fadeOut(fadeIn(x, 50), 8);
}

// Impact final : sous-grave long + crash, pour le logo (image 3480).
function impactFinal({ seed }) {
  const n = len(2.6);
  const x = impactSourd({ dur: 2.6, seed, f0: 95, f1: 30, tau: 0.7, noise: 0.6 });
  add(x, scale(crash({ dur: 2.6, seed: seed + 50, tau: 0.9, f: 2500 }), 0.35), 0);
  return fadeOut(x.subarray(0, n), 200);
}

// ── Habillage v4 (qa/MUSIQUE-V4.md) : trois sons, et rien d'autre ─────────────────────────────────
// Souffle cosmique : grondement brun très grave + souffle rose dont le passe-bande et le niveau montent,
// sommet à la toute fin (il s'arrête net, 30 ms, sur l'allumage du Soleil).
function souffleCosmos({ dur, seed }) {
  const n = len(dur);
  const rumble = svf(brown(n, seed), 'lp', exp(70, 260), 0.8);
  const air = svf(pink(n, seed + 1), 'bp', exp(160, 1400), (u) => 0.8 + 1.6 * u);
  const x = add(rumble, air, 0, 0.45);
  mulEnv(x, (u) => 0.18 + 0.82 * Math.pow(u, 2.2));
  return fadeOut(fadeIn(x, 40), 30);
}

// Allumage du Soleil : coup sourd (110 → 40 Hz) + éclat aigu qui s'ouvre et s'éteint (bruit passe-haut balayé).
function impactSoleil({ dur, seed }) {
  const n = len(dur);
  const x = impactSourd({ dur, seed, f0: 110, f1: 40, tau: 0.3, noise: 0.35 });
  const glow = mulEnv(svf(white(n, seed + 20), 'hp', exp(6500, 2500), 0.7), expDecay(0.45, 0.004));
  add(x, glow, 0, 0.3);
  return fadeOut(x, 250);
}

// Coup du logo : sous-grave long (90 → 28 Hz) + corps + crash ; queue de 2,1 s qui descend sous −60 dB.
function impactLogo({ dur, seed }) {
  const n = len(dur);
  const x = impactSourd({ dur, seed, f0: 90, f1: 28, tau: 0.42, noise: 0.7 });
  add(x, crash({ dur, seed: seed + 50, tau: 0.42, f: 2600 }), 0, 0.4);
  mulEnv(x, (u) => (u < 0.7 ? 1 : Math.pow(1 - (u - 0.7) / 0.3, 2)));
  return fadeOut(x, 30);
}

// ── Effets v5 (qa/SON-V5.md) : gestes, matières, ambiances et raccords doux du film à 24 i/s ──────────────
// Règle de timbre : rien de « bip », rien de brillant. Les sons sont mats (passe-bas ≤ 7 kHz dans la recette),
// les ambiances existent en paires gauche/droite (graines différentes, donc décorrélées) pour une stéréo large.
const lpf = (x, f) => svf(x, 'lp', f, 0.7);
const hpf = (x, f) => svf(x, 'hp', f, 0.7);
const grain = (seed, dur, f, q, tau) => mulEnv(svf(white(len(dur), seed), 'bp', f, q), expDecay(tau, 0.0002));

// Tap du pouce sur la vitre d'un téléphone : petit choc de pulpe (corps 260–380 Hz) et un tic très bas en niveau.
function tapPouce({ seed, body = 320, tick = 2200, tickGain = 0.22 }) {
  const n = len(0.09), x = new Float32Array(n);
  add(x, mulEnv(svf(white(n, seed), 'bp', body, 2.2), expDecay(0.010, 0.0008)), 0, 1);
  add(x, mulEnv(sine(n, body * 0.62, body * 0.5, 1), expDecay(0.012, 0.001)), 0, 0.35);
  add(x, grain(seed + 1, 0.03, tick, 1.5, 0.0025), 0, tickGain);
  return fadeOut(lpf(x, 5000), 12);
}

// Boucle de sangle (clip plastique) : glissement des branches, puis le claquement (deux déclics à 6 ms, corps à 1,15 kHz)
// et le petit choc des mains sur la sangle. Pic au claquement (22 ms après le début du fichier).
function clacBoucleC({ seed }) {
  const n = len(0.16), x = new Float32Array(n), snap = len(0.022);
  add(x, mulEnv(svf(white(len(0.03), seed), 'bp', 1800, 1.2), expDecay(0.012, 0.006)), 0, 0.10);
  add(x, grain(seed + 1, 0.04, 3400, 3, 0.0035), snap, 1);
  add(x, mulEnv(svf(white(len(0.08), seed + 2), 'bp', 1150, 6), expDecay(0.012, 0.0003)), snap, 1.6);
  add(x, grain(seed + 3, 0.03, 2600, 4, 0.003), snap + len(0.006), 0.55);
  add(x, mulEnv(sine(len(0.1), 140, 90, 1), expDecay(0.02, 0.001)), snap, 0.18);
  return fadeOut(lpf(x, 7000), 12);
}

// Papier de soie et carton : le sac sort du carton (choc sourd du carton au début), froissements en deux bouffées.
function papierCarton({ dur, seed }) {
  const n = len(dur), x = new Float32Array(n), r = rng(seed + 5);
  const env = (u) => 0.25 + Math.exp(-((u - 0.18) ** 2) / 0.012) + 0.7 * Math.exp(-((u - 0.62) ** 2) / 0.02);
  add(x, mulEnv(svf(pink(n, seed), 'bp', 2400, 0.8), env), 0, 0.10);
  for (let k = 0; k < Math.round(170 * dur); k++) {
    const u = r(), at = Math.floor(u * n), g = env(u) * (0.15 + r() * 0.6);
    add(x, grain(seed + 40 + k, 0.004 + r() * 0.016, 1400 + r() * 4600, 2 + r() * 3, 0.0015 + r() * 0.004), at, g);
  }
  add(x, mulEnv(lpf(brown(len(0.2), seed + 2), 280), expDecay(0.045, 0.002)), len(0.015), 0.9);
  add(x, grain(seed + 3, 0.06, 700, 2, 0.018), len(0.015), 0.35);
  return fadeOut(fadeIn(lpf(x, 6500), 6), 60);
}

// Réverbération de cage d'escalier (Schroeder : 4 peignes + 2 passe-tout), pour les pas de P21.
function cage(x, wet = 0.28, tail = 0.45) {
  const n = x.length + len(tail), dry = new Float32Array(n), y = new Float32Array(n);
  add(dry, x, 0);
  for (const [ms, g] of [[29.7, 0.74], [37.1, 0.72], [41.1, 0.70], [43.7, 0.68]]) {
    const d = len(ms / 1000), c = new Float32Array(n);
    for (let i = 0; i < n; i++) c[i] = dry[i] + (i >= d ? g * c[i - d] : 0);
    add(y, c, 0, 0.25);
  }
  for (const [ms, g] of [[5.0, 0.7], [1.7, 0.7]]) {
    const d = len(ms / 1000), o = new Float32Array(n);
    for (let i = 0; i < n; i++) o[i] = -g * y[i] + (i >= d ? y[i - d] + g * o[i - d] : 0);
    y.set(o);
  }
  const out = new Float32Array(n);
  add(out, dry, 0, 1); add(out, lpf(y, 4500), 0, wet);
  return out;
}
const fromBank = (name) => Float32Array.from(readMono(join(SFX_DIR, `${name}.wav`)));
function pasEscalier({ src }) { return fadeOut(cage(hpf(fromBank(src), 90)), 80); }

// Pied sur la pierre (P34) : la réception Kenney (choc grave) + l'écrasement du gravier sous la semelle (90 ms).
function appuiPierre({ seed }) {
  const n = len(0.35), x = new Float32Array(n), r = rng(seed + 1);
  add(x, fromBank('pied-pierre'), 0, 1);
  for (let k = 0; k < 70; k++) {
    const t = Math.pow(r(), 1.6) * 0.09;
    add(x, grain(seed + 10 + k, 0.012, 1500 + r() * 3500, 3, 0.0015 + r() * 0.002), len(0.004 + t), 0.35 * (1 - t / 0.1));
  }
  add(x, mulEnv(sine(len(0.12), 110, 70, 1), expDecay(0.03, 0.001)), 0, 0.3);
  return fadeOut(lpf(x, 7000), 40);
}

// Réception sur le rocher mouillé (P37) : la même réception Kenney, ralentie ×0,85 (plus lourde), et une gerbe d'eau courte.
function receptionRocher({ seed }) {
  const src = fromBank('pied-pierre'), k = 0.85, m = Math.floor(src.length / k);
  const n = len(0.4), x = new Float32Array(n), r = rng(seed + 2);
  for (let i = 0; i < m; i++) { const p = i * k, a = Math.floor(p), f = p - a; x[i] = src[a] * (1 - f) + (src[a + 1] ?? 0) * f; }
  add(x, mulEnv(svf(pink(len(0.3), seed), 'bp', exp(1200, 3200), 1), expDecay(0.06, 0.003)), len(0.004), 0.22);
  for (let j = 0; j < 25; j++) add(x, grain(seed + 30 + j, 0.015, 1800 + r() * 3500, 5, 0.003), len(0.01 + r() * 0.2), 0.25 * r());
  return fadeOut(lpf(x, 7000), 50);
}

// Torrent : eau qui court (bruit rose large, grondement brun) et bulles (sinus montants très brefs).
function torrent({ dur, seed }) {
  const n = len(dur), r = rng(seed + 3);
  const x = add(svf(pink(n, seed), 'bp', (u) => 1100 + 300 * Math.sin(2 * Math.PI * u * 2.3), 0.6), lpf(brown(n, seed + 1), 380), 0, 0.5);
  for (let k = 0; k < Math.round(140 * dur); k++) {
    const d = 0.008 + r() * 0.022, f0 = 450 + r() * 1700, b = mulEnv(sine(len(d), f0, f0 * 1.5, 1), expDecay(d / 3, 0.0005));
    add(x, b, Math.floor(r() * n), 0.02 + r() * 0.08);
  }
  return fadeOut(fadeIn(lpf(x, 6500), 150), 250);
}

// Vent de crête : souffle d'air en passe-bande à rafales lentes, un sifflement très bas en niveau, peu de grondement.
function ventCrete({ dur, seed, f = 650 }) {
  const n = len(dur), r = rng(seed), p1 = r() * 6, p2 = r() * 6;
  const gust = (u) => f * (1 + 0.35 * Math.sin(2 * Math.PI * u * 0.8 + p1) + 0.15 * Math.sin(2 * Math.PI * u * 2.3 + p2));
  const x = svf(pink(n, seed), 'bp', gust, 2.5);
  add(x, svf(pink(n, seed + 3), 'bp', (u) => gust(u) * 2.2, 8), 0, 0.12);
  add(x, lpf(brown(n, seed + 5), 160), 0, 0.15);
  mulEnv(x, (u) => 0.7 + 0.3 * Math.sin(2 * Math.PI * u * 0.6 + p2));
  return fadeOut(fadeIn(lpf(x, 6000), 300), 400);
}

// Feu de bivouac : flamme (souffle doux), braises qui craquent (claquements brefs résonants), quelques gros claquements.
function feuBivouac({ dur, seed }) {
  const n = len(dur), r = rng(seed + 9);
  const x = add(lpf(brown(n, seed), 220), svf(pink(n, seed + 1), 'bp', 900, 0.8), 0, 0.5).map((v) => v * 0.3);
  for (let k = 0; k < Math.round(22 * dur); k++) {
    const big = r() < 0.06;
    add(x, grain(seed + 100 + k, 0.03, (big ? 700 : 1200) + r() * 3800, big ? 4 : 3 + r() * 4, big ? 0.006 : 0.0015 + r() * 0.004),
      Math.floor(r() * n), big ? 0.9 + r() * 0.5 : 0.15 + r() * 0.55);
  }
  return fadeOut(fadeIn(lpf(x, 7000), 200), 300);
}

// Pluie entendue de l'intérieur (à travers la vitre) : chuintement feutré, gouttes sur le verre, coulures rares.
function pluieInterieur({ dur, seed }) {
  const n = len(dur), r = rng(seed + 4);
  const x = add(svf(pink(n, seed), 'bp', 1800, 0.5), lpf(pink(n, seed + 1), 500), 0, 0.5).map((v) => v * 0.35);
  for (let k = 0; k < Math.round(90 * dur); k++) {
    const heavy = r() < 0.04;
    add(x, grain(seed + 300 + k, heavy ? 0.03 : 0.012, heavy ? 900 : 1200 + r() * 2800, heavy ? 6 : 3, heavy ? 0.008 : 0.002),
      Math.floor(r() * n), heavy ? 0.5 : 0.1 + r() * 0.4);
  }
  return fadeOut(fadeIn(lpf(x, 5500), 200), 300);
}

// Whoosh doux : bruit rose en passe-bande balayé, presque sans souffle aigu, passe-bas 6 kHz ; sommet à `peak`.
function whooshDoux({ dur, seed, f0, f1, peak = 0.7, rise = 2.0, fall = 2.2 }) {
  const n = len(dur);
  const x = add(svf(pink(n, seed), 'bp', exp(f0, f1), 0.9), svf(white(n, seed + 7), 'bp', exp(f0 * 2.5, f1 * 2.5), 1.2), 0, 0.06);
  return fadeOut(fadeIn(mulEnv(lpf(x, 6000), swell(peak, rise, fall)), 10), 20);
}

export const RECIPES = {
  'whoosh-court-a': () => whoosh({ dur: 0.55, seed: 11, f0: 400, f1: 2600, peak: 0.62 }),
  'whoosh-court-b': () => whoosh({ dur: 0.65, seed: 12, f0: 2800, f1: 500, peak: 0.55, q: 1.5 }),
  'whoosh-court-c': () => whoosh({ dur: 0.5, seed: 13, f0: 700, f1: 4200, peak: 0.7, air: 0.4 }),
  'whoosh-long-a': () => whoosh({ dur: 1.5, seed: 21, f0: 180, f1: 3200, peak: 0.72, rise: 2.6, fall: 1.3, q: 1 }),
  'whoosh-long-b': () => whoosh({ dur: 1.9, seed: 22, f0: 4200, f1: 260, peak: 0.6, rise: 2.4, fall: 1.8, q: 1.3, air: 0.35 }),
  'impact-sourd-a': () => impactSourd({ dur: 0.9, seed: 31 }),
  'impact-sourd-b': () => impactSourd({ dur: 0.8, seed: 32, f0: 140, f1: 45, tau: 0.2 }),
  'impact-sec-a': () => impactSec({ dur: 0.35, seed: 41 }),
  'impact-sec-b': () => impactSec({ dur: 0.35, seed: 42, body: 240, tau: 0.045 }),
  'crash-a': () => crash({ dur: 1.8, seed: 51 }),
  'crash-b': () => crash({ dur: 1.6, seed: 52, tau: 0.55, f: 4200 }),
  'clac-boucle-b': () => clac({ seed: 61 }),
  'sonnette': () => sonnette({ seed: 71 }),
  'souffle-a': () => souffle({ dur: 0.9, seed: 81 }),
  'souffle-b': () => souffle({ dur: 1.1, seed: 82, f: 700, peak: 0.45 }),
  'vent-altitude-a': () => vent({ dur: 3.2, seed: 91 }),
  'vent-altitude-b': () => vent({ dur: 3.2, seed: 92, f: 380 }),
  'feu-crepitement': () => feu({ dur: 2.6, seed: 101 }),
  'pluie-vitre': () => pluie({ dur: 2.4, seed: 111 }),
  'rails-train': () => rails({ dur: 2.2, seed: 121 }),
  'gravillons-a': () => gravillons({ dur: 0.9, seed: 131 }),
  'gravillons-b': () => gravillons({ dur: 0.8, seed: 132, peak: 0.25, density: 600 }),
  'declic-photo': () => declic({ seed: 141 }),
  'notification': () => notification({ seed: 151 }),
  'eclaboussure-torrent': () => eclaboussure({ dur: 1.3, seed: 161 }),
  'montee-riser': () => riser({ dur: 2.9, seed: 171 }),
  'impact-final': () => impactFinal({ seed: 181 }),
  'souffle-cosmos': () => souffleCosmos({ dur: 1.36, seed: 191 }),
  'impact-soleil': () => impactSoleil({ dur: 2.0, seed: 201 }),
  'impact-logo': () => impactLogo({ dur: 2.15, seed: 211 }),
  // v5
  'tap-pouce-a': () => tapPouce({ seed: 301 }),
  'tap-pouce-b': () => tapPouce({ seed: 302, body: 280, tick: 1900, tickGain: 0.18 }),
  'tap-pouce-c': () => tapPouce({ seed: 303, body: 360, tick: 2500, tickGain: 0.26 }),
  'clac-boucle-c': () => clacBoucleC({ seed: 311 }),
  'papier-carton': () => papierCarton({ dur: 0.95, seed: 321 }),
  'pas-escalier-a': () => pasEscalier({ src: 'pas-sentier-a' }),
  'appui-pierre': () => appuiPierre({ seed: 331 }),
  'reception-rocher': () => receptionRocher({ seed: 341 }),
  'torrent-g': () => torrent({ dur: 1.3, seed: 351 }),
  'torrent-d': () => torrent({ dur: 1.3, seed: 352 }),
  'vent-crete-g': () => ventCrete({ dur: 3.8, seed: 361 }),
  'vent-crete-d': () => ventCrete({ dur: 3.8, seed: 362, f: 560 }),
  'feu-bivouac-g': () => feuBivouac({ dur: 7.4, seed: 371 }),
  'feu-bivouac-d': () => feuBivouac({ dur: 7.4, seed: 372 }),
  'pluie-interieur-g': () => pluieInterieur({ dur: 5.6, seed: 381 }),
  'pluie-interieur-d': () => pluieInterieur({ dur: 5.6, seed: 382 }),
  'whoosh-doux-a': () => whooshDoux({ dur: 0.9, seed: 391, f0: 2400, f1: 380, peak: 0.78 }),
  'whoosh-doux-b': () => whooshDoux({ dur: 0.6, seed: 392, f0: 600, f1: 2000, peak: 0.6 }),
  'whoosh-doux-c': () => whooshDoux({ dur: 0.6, seed: 393, f0: 1800, f1: 450, peak: 0.65 }),
  'whoosh-doux-d': () => whooshDoux({ dur: 1.1, seed: 394, f0: 300, f1: 2600, peak: 0.82, rise: 2.4 }),
};
export const V5_SOUNDS = Object.keys(RECIPES).slice(Object.keys(RECIPES).indexOf('tap-pouce-a'));

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv.slice(2);
  // --v5 : les sons ajoutés pour le mix v5 seulement (les dérivés des prises Kenney passent après leur source, intacte).
  const names = only[0] === '--v5' ? V5_SOUNDS : only.length ? only : Object.keys(RECIPES);
  for (const name of names) {
    if (!RECIPES[name]) { console.error(`✗ recette inconnue : ${name}`); process.exit(1); }
    const x = normalizePeak(RECIPES[name](), -3);
    writeWav(join(SFX_DIR, `${name}.wav`), x);
    console.log(`✓ ${name}.wav  ${(x.length / SR).toFixed(3)} s`);
  }
}
