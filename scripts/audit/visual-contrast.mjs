#!/usr/bin/env node
/**
 * Audit de contraste WCAG 2.2 — direction visuelle LKDV (P5, spec 2026-09-19 §6).
 *
 * Lit les valeurs réellement déclarées dans src/styles/tokens.css
 * (blocs `:root` clair + bloc `.dark`), compose les couches rgba sur leur fond
 * (contraste « sur le rendu composé », spec §6) et ÉCHOUE (code 1) si :
 *   - texte courant < 4,5:1
 *   - grand texte / éléments non textuels < 3:1
 *
 * Usage : node scripts/audit/visual-contrast.mjs [--json]
 * Aucune dépendance externe.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('../../', import.meta.url)).replace(/[\\/]$/, '');
const TOKENS_PATH = join(ROOT, 'src', 'styles', 'tokens.css');
const JSON_OUTPUT = process.argv.includes('--json');

const css = readFileSync(TOKENS_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Extrait les déclarations d'un sélecteur exact (tous les blocs correspondants fusionnés). */
function parseSelectorBlocks(selector) {
  const map = {};
  const blockRe = /([^{}]+)\{([^{}]*)\}/g;
  for (const block of css.matchAll(blockRe)) {
    const selectors = block[1].split(',').map((s) => s.trim());
    if (!selectors.includes(selector)) continue;
    for (const decl of block[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      map[decl[1]] = decl[2].trim();
    }
  }
  return map;
}

const lightTokens = parseSelectorBlocks(':root');
const darkTokens = parseSelectorBlocks('.dark');

function rawToken(name, mode) {
  const key = name.startsWith('--') ? name : `--${name}`;
  const primary = mode === 'dark' ? darkTokens : lightTokens;
  const fallback = lightTokens;
  const value = primary[key] ?? fallback[key];
  if (!value) throw new Error(`Token introuvable : ${key} (${mode})`);
  return value;
}

/** Résout les var() imbriqués. */
function resolveValue(name, mode, seen = new Set()) {
  const raw = rawToken(name, mode);
  const varMatch = raw.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  if (!varMatch) return raw;
  if (seen.has(varMatch[1])) throw new Error(`Cycle de var() sur ${varMatch[1]}`);
  seen.add(varMatch[1]);
  return resolveValue(varMatch[1], mode, seen);
}

function parseColor(value, label) {
  const hex = value.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hex) {
    const h = hex[1];
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: 1,
    };
  }
  const rgba = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/);
  if (rgba) {
    return { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: rgba[4] === undefined ? 1 : +rgba[4] };
  }
  throw new Error(`Couleur non parsable pour ${label} : « ${value} »`);
}

function tokenColor(name, mode) {
  return parseColor(resolveValue(name, mode), `--${name} (${mode})`);
}

/** Compose `top` (éventuellement alpha) sur `bottom` (opaque attendu). */
function composite(top, bottom) {
  if (top.a >= 1) return { ...top, a: 1 };
  return {
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  };
}

function channelLuminance(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color) {
  const { r, g, b } = composite(color, { r: 0, g: 0, b: 0, a: 1 });
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

function contrastRatio(colorA, colorB) {
  const [hi, lo] = [relativeLuminance(colorA), relativeLuminance(colorB)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Paires de la direction. `fg` / `bg` sont des noms de tokens (sans --).
 * `over` compose un fond semi-transparent sur son support (verre, frontières rgba).
 */
const PAIRS = [
  // ── Mode clair — fond #F5F7F3 / surface #FFFFFF / texte #172B24 ──────────
  { mode: 'light', label: 'Texte principal / fond', fg: 'lkv-text-primary', bg: 'lkv-surface', min: 4.5 },
  { mode: 'light', label: 'Texte principal / carte', fg: 'lkv-text-primary', bg: 'lkv-surface-card', min: 4.5 },
  { mode: 'light', label: 'Texte secondaire / fond', fg: 'lkv-text-secondary', bg: 'lkv-surface', min: 4.5 },
  { mode: 'light', label: 'Texte secondaire / carte', fg: 'lkv-text-secondary', bg: 'lkv-surface-card', min: 4.5 },
  { mode: 'light', label: 'Texte discret / fond', fg: 'lkv-text-muted', bg: 'lkv-surface', min: 4.5 },
  { mode: 'light', label: 'Texte subtil / fond', fg: 'lkv-text-subtle', bg: 'lkv-surface', min: 4.5 },
  { mode: 'light', label: 'Action (texte/icône) / fond', fg: 'lkv-action', bg: 'lkv-surface', min: 4.5 },
  { mode: 'light', label: 'Action (texte/icône) / carte', fg: 'lkv-action', bg: 'lkv-surface-card', min: 4.5 },
  { mode: 'light', label: 'Texte sur action', fg: 'lkv-on-action', bg: 'lkv-action', min: 4.5 },
  { mode: 'light', label: 'Texte / accent doux', fg: 'lkv-text-primary', bg: 'lkv-primary-subtle', min: 4.5 },
  { mode: 'light', label: 'Danger / fond danger', fg: 'lkv-danger', bg: 'lkv-danger-bg', min: 4.5 },
  { mode: 'light', label: 'Avertissement / fond avertissement', fg: 'lkv-warning-dark', bg: 'lkv-warning-bg', min: 4.5 },
  { mode: 'light', label: 'Info / fond info', fg: 'lkv-info', bg: 'lkv-info-bg', min: 4.5 },
  { mode: 'light', label: 'Succès / fond succès (UI)', fg: 'lkv-success', bg: 'lkv-success-bg', min: 3 },
  { mode: 'light', label: 'Carte : contenu / verre clair composé', fg: 'card-content', bg: 'card-tint', over: 'lkv-surface', min: 4.5 },
  { mode: 'light', label: 'Carte : texte secondaire / verre composé', fg: 'glass-text-secondary', bg: 'card-tint', over: 'lkv-surface', min: 4.5 },
  { mode: 'light', label: 'Bouton verre : contenu / verre composé', fg: 'btn-content', bg: 'btn-tint', over: 'lkv-surface', min: 4.5 },
  { mode: 'light', label: 'Bouton plein : contenu / action', fg: 'btn-on-solid', bg: 'btn-tint-solid', min: 4.5 },
  { mode: 'light', label: 'Frontière forte / fond (UI)', fg: 'lkv-border-strong', bg: 'lkv-surface', min: 3, ui: true },
  { mode: 'light', label: 'Frontière forte / carte (UI)', fg: 'lkv-border-strong', bg: 'lkv-surface-card', min: 3, ui: true },
  { mode: 'light', label: 'Focus (action) / fond (UI)', fg: 'lkv-action', bg: 'lkv-surface', min: 3, ui: true },

  // ── Mode sombre — fond #101C17 / surface #1B2D24 / texte #F1F5F1 ─────────
  { mode: 'dark', label: 'Texte principal / fond', fg: 'lkv-text-primary', bg: 'lkv-surface', min: 4.5 },
  { mode: 'dark', label: 'Texte principal / carte', fg: 'lkv-text-primary', bg: 'lkv-surface-card', min: 4.5 },
  { mode: 'dark', label: 'Texte secondaire / fond', fg: 'lkv-text-secondary', bg: 'lkv-surface', min: 4.5 },
  { mode: 'dark', label: 'Texte secondaire / carte', fg: 'lkv-text-secondary', bg: 'lkv-surface-card', min: 4.5 },
  { mode: 'dark', label: 'Texte discret / fond', fg: 'lkv-text-muted', bg: 'lkv-surface', min: 4.5 },
  { mode: 'dark', label: 'Texte subtil / fond', fg: 'lkv-text-subtle', bg: 'lkv-surface', min: 4.5 },
  { mode: 'dark', label: 'Action (texte/icône) / fond', fg: 'lkv-action', bg: 'lkv-surface', min: 4.5 },
  { mode: 'dark', label: 'Action (texte/icône) / carte', fg: 'lkv-action', bg: 'lkv-surface-card', min: 4.5 },
  { mode: 'dark', label: 'Texte sur action', fg: 'lkv-on-action', bg: 'lkv-action', min: 4.5 },
  { mode: 'dark', label: 'Texte / accent doux', fg: 'lkv-text-primary', bg: 'lkv-primary-subtle', min: 4.5 },
  { mode: 'dark', label: 'Danger / fond danger', fg: 'lkv-danger', bg: 'lkv-danger-bg', min: 4.5 },
  { mode: 'dark', label: 'Avertissement / fond avertissement', fg: 'lkv-warning-dark', bg: 'lkv-warning-bg', min: 4.5 },
  { mode: 'dark', label: 'Info / fond info', fg: 'lkv-info', bg: 'lkv-info-bg', min: 4.5 },
  { mode: 'dark', label: 'Succès / fond succès (UI)', fg: 'lkv-success', bg: 'lkv-success-bg', min: 3 },
  { mode: 'dark', label: 'Carte : contenu / verre sombre composé', fg: 'card-content', bg: 'card-tint', over: 'lkv-surface', min: 4.5 },
  { mode: 'dark', label: 'Carte : texte secondaire / verre composé', fg: 'glass-text-secondary', bg: 'card-tint', over: 'lkv-surface', min: 4.5 },
  { mode: 'dark', label: 'Bouton verre : contenu / verre composé', fg: 'btn-content', bg: 'btn-tint', over: 'lkv-surface', min: 4.5 },
  { mode: 'dark', label: 'Bouton plein : contenu / action', fg: 'btn-on-solid', bg: 'btn-tint-solid', min: 4.5 },
  { mode: 'dark', label: 'Frontière forte / fond (UI)', fg: 'lkv-border-strong', bg: 'lkv-surface', min: 3, ui: true },
  { mode: 'dark', label: 'Frontière forte / carte (UI)', fg: 'lkv-border-strong', bg: 'lkv-surface-card', min: 3, ui: true },
  { mode: 'dark', label: 'Focus (action) / fond (UI)', fg: 'lkv-action', bg: 'lkv-surface', min: 3, ui: true },
];

const results = [];
let failures = 0;

for (const pair of PAIRS) {
  const fgRaw = tokenColor(pair.fg, pair.mode);
  const bgBase = tokenColor(pair.bg, pair.mode);
  const bg = pair.over ? composite(bgBase, tokenColor(pair.over, pair.mode)) : bgBase;
  const fg = composite(fgRaw, bg);
  const ratio = contrastRatio(fg, bg);
  const pass = ratio >= pair.min;
  if (!pass) failures++;
  results.push({
    mode: pair.mode,
    label: pair.label,
    pair: `${pair.fg} / ${pair.bg}${pair.over ? ` over ${pair.over}` : ''}`,
    ratio: Math.round(ratio * 100) / 100,
    min: pair.min,
    kind: pair.ui ? 'UI' : 'texte',
    pass,
  });
}

if (JSON_OUTPUT) {
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), results, failures }, null, 2));
} else {
  console.log('\n=== LKDV — Audit de contraste WCAG (direction P5 §6) ===');
  console.log(`Source : ${TOKENS_PATH}`);
  let currentMode = null;
  for (const r of results) {
    if (r.mode !== currentMode) {
      currentMode = r.mode;
      console.log(`\n── ${currentMode === 'light' ? 'Clair' : 'Sombre'} ──`);
    }
    const verdict = r.pass ? 'PASS' : 'FAIL';
    console.log(
      `${verdict}  ${String(r.ratio).padStart(6)}:1  (min ${r.min}:1, ${r.kind})  ${r.label}  [${r.pair}]`
    );
  }
  console.log(`\nRésultat : ${results.length - failures}/${results.length} paires conformes.`);
  if (failures > 0) {
    console.error(`\n${failures} paire(s) sous le seuil WCAG — corriger les tokens.`);
  } else {
    console.log('Toutes les paires mesurées respectent les seuils (4,5:1 texte, 3:1 UI).');
  }
}

process.exit(failures > 0 ? 1 : 0);
