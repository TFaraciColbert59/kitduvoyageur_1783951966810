#!/usr/bin/env node
// Banque d'effets GÉNÉRÉS (synthèse par bruit filtré, graine fixe) → assets/audio/sfx/<nom>.wav
// WAV 48 kHz, 24 bits, mono, crête échantillon à −3 dBFS, rognés.
// Usage : node tools/audio/gen-sfx.mjs            (tous)
//         node tools/audio/gen-sfx.mjs whoosh-court-a impact-sourd-a   (quelques-uns)
// Chaque recette est décrite ici même : c'est « la commande exacte » citée dans SOURCES.md.
import { join } from 'node:path';
import { SFX_DIR, SR } from './lib.mjs';
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
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv.slice(2);
  const names = only.length ? only : Object.keys(RECIPES);
  for (const name of names) {
    if (!RECIPES[name]) { console.error(`✗ recette inconnue : ${name}`); process.exit(1); }
    const x = normalizePeak(RECIPES[name](), -3);
    writeWav(join(SFX_DIR, `${name}.wav`), x);
    console.log(`✓ ${name}.wav  ${(x.length / SR).toFixed(3)} s`);
  }
}
