#!/usr/bin/env node
/**
 * Banc de parité Kit Studio — bundle `THREE` global pour three 0.186.
 *
 * Pourquoi : `tests/kit-studio/parity.spec.ts` intercepte le script CDN de la maquette
 * (`https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js`) et l'injecte localement.
 * Or three a supprimé `build/three.min.js` (bundle UMD) à partir de r150 : le dépôt est en
 * `three@0.186.0`, seuls `three.module.js` / `three.core.js` sont livrés. La maquette attend
 * un script classique qui expose `window.THREE`, d'où ce bundle IIFE (`--global-name=THREE`).
 *
 * Sortie : `test-results/kit-studio/three.iife.js` (répertoire ignoré par git ; le fichier est
 * reconstruit à la demande par le banc s'il est absent, et régénérable par `node scripts/kit-studio/build-three-iife.mjs`).
 *
 * Usage : node scripts/kit-studio/build-three-iife.mjs [--minify|--no-minify]
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ENTRY = path.join(ROOT, 'node_modules/three/build/three.module.js');
const OUT = path.join(ROOT, 'test-results/kit-studio/three.iife.js');
const MINIFY = !process.argv.includes('--no-minify');

if (!fs.existsSync(ENTRY)) {
  console.error(`[three-iife] introuvable : ${ENTRY} (npm ci fait ?)`);
  process.exit(1);
}

// esbuild n'est pas une dépendance directe du dépôt : il est présent dans node_modules via
// Next/Vite. On le résout depuis la racine pour ne pas dépendre du cwd.
const require = createRequire(path.join(ROOT, 'package.json'));
let esbuild;
try {
  esbuild = require('esbuild');
} catch {
  console.error('[three-iife] esbuild introuvable dans node_modules (attendu via Next/Vite).');
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });

const result = await esbuild.build({
  entryPoints: [ENTRY],
  outfile: OUT,
  bundle: true,
  format: 'iife',
  globalName: 'THREE',
  platform: 'browser',
  target: ['es2020'],
  minify: MINIFY,
  legalComments: 'none',
  metafile: true,
  logLevel: 'warning',
});

const code = fs.readFileSync(OUT, 'utf8');
const bytes = Buffer.byteLength(code);
const rev = /REVISION\s*=\s*['"]([^'"]+)['"]/.exec(code)?.[1] ?? 'inconnue';

// Contrôle hors navigateur : le script est un classique, il doit déclarer `THREE` en global
// et exposer au moins WebGLRenderer/Scene/Vector3. On l'évalue dans un contexte vm nu
// (three n'accède au DOM qu'à la construction du renderer, pas à l'import).
import vm from 'node:vm';
const sandbox = { console, globalThis: undefined };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'three.iife.js' });
const T = sandbox.THREE;
const required = ['WebGLRenderer', 'Scene', 'PerspectiveCamera', 'Vector3', 'Color', 'MathUtils'];
const missing = required.filter((k) => typeof T?.[k] === 'undefined');
if (!T || missing.length) {
  console.error(`[three-iife] bundle invalide : THREE=${typeof T}, manquants=${missing.join(',') || '-'}`);
  process.exit(1);
}

console.log(`[three-iife] entrée   : ${path.relative(ROOT, ENTRY)}`);
console.log(`[three-iife] sortie   : ${path.relative(ROOT, OUT)} (${bytes} octets, minify=${MINIFY})`);
console.log(`[three-iife] global   : THREE.REVISION=${T.REVISION} (entête=${rev})`);
console.log(`[three-iife] exports  : ${Object.keys(T).length} clés, contrôlées: ${required.join(', ')} — OK`);
console.log(`[three-iife] esbuild  : ${esbuild.version}`);
