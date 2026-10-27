#!/usr/bin/env node
/**
 * ICON NAME INVARIANT
 * ===================
 * Verifies that statically-written icon names resolve against the canonical
 * icon registry (`src/components/ui/Icon/registry.ts`).
 *
 * - Semantic kebab-case names must exist in `ANIMATED_ICON_NAMES` or the PNG pack.
 * - PascalCase Heroicon-style names (`FooIcon`) are accepted as "unverified
 *   legacy" because they resolve through the Heroicons fallback at runtime.
 * - Unknown lowercase / kebab names fail.
 *
 * Usage: node scripts/verify/icon-names.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const src = path.join(root, 'src');
const registryPath = path.join(src, 'components', 'ui', 'Icon', 'registry.ts');

if (!fs.existsSync(registryPath)) {
  console.error(`✗ Icon registry introuvable : ${path.relative(root, registryPath)}`);
  process.exit(1);
}

const registry = fs.readFileSync(registryPath, 'utf8');

const pngKeys = new Set();
for (const m of registry.matchAll(/^\s*([A-Za-z0-9_]+):\s*'[^']+\.png',/gm)) {
  pngKeys.add(m[1]);
}

const animatedMatch = registry.match(/ANIMATED_ICON_NAMES\s*=\s*\[([\s\S]*?)\]\s*as const/);
const animatedNames = new Set();
if (animatedMatch) {
  for (const m of animatedMatch[1].matchAll(/'([^']+)'/g)) {
    animatedNames.add(m[1]);
  }
}

const generatedPath = path.join(src, 'components', 'ui', 'Icon', 'registry.generated.ts');
const svgNames = new Set();
if (fs.existsSync(generatedPath)) {
  const generated = fs.readFileSync(generatedPath, 'utf8');
  for (const m of generated.matchAll(/'([^']+)'/g)) {
    svgNames.add(m[1]);
  }
}

// LKDV V2 is the first resolver at runtime; validate its real asset targets too.
const lkdvRegistry = fs.readFileSync(path.join(src, 'components/ui/Icon/lkdv.registry.ts'), 'utf8');
const lkdvNames = new Set(JSON.parse(lkdvRegistry.match(/new Set(?:<[^>]+>)?\((\[[^;]+\])\)/)[1]));
const lkdvAliases = JSON.parse(lkdvRegistry.match(/const ALIASES[^=]*=\s*({[\s\S]*?});/)[1]);
function resolvesLKDV(name) {
  const token = name.replace(/(IconSolid|SolidIcon|Icon)$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/[_ ]/g, '-').toLowerCase();
  const asset = lkdvNames.has(token.replace(/-/g, '_')) ? token.replace(/-/g, '_') : lkdvAliases[token];
  return lkdvNames.has(asset) && fs.existsSync(path.join(root, 'public/icons/lkdv', `${asset}.svg`));
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(tsx|ts)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function resolves(name) {
  if (resolvesLKDV(name)) return 'lkdv';
  if (animatedNames.has(name)) return 'animated';
  if (svgNames.has(name)) return 'svg';
  if (pngKeys.has(name) || pngKeys.has(`${name}Icon`) || pngKeys.has(`${name}SolidIcon`)) return 'pack';
  if (/^[A-Z][A-Za-z0-9]*(Icon|IconSolid|SolidIcon)$/.test(name)) return 'hero-legacy';
  return null;
}

const usageRe = /<(?:Icon|AppIcon|LkvIcon)\b[^>]*?\bname\s*=\s*(?:"([^"]+)"|'([^']+)')/g;
const canonicalImportRe =
  /components\/ui\/(?:AppIcon|LkvIcon|Icon)\b|from\s+['"]\.\/(?:AppIcon|LkvIcon)['"]/;

const failures = [];
const legacy = new Set();
let total = 0;

for (const file of walk(src)) {
  const content = fs.readFileSync(file, 'utf8');
  if (!canonicalImportRe.test(content)) continue;
  for (const m of content.matchAll(usageRe)) {
    const name = m[1] ?? m[2];
    if (!name) continue;
    total++;
    const kind = resolves(name);
    if (kind === 'hero-legacy') {
      legacy.add(name);
    } else if (!kind) {
      const line = content.slice(0, m.index).split(/\r?\n/).length;
      failures.push(`${path.relative(root, file)}:${line} → "${name}"`);
    }
  }
}


/**
 * Les expressions `name={...}` : le trou aveugle du verificateur.
 *
 * `usageRe` ne voyait que les LITTERAUX (`name="map-pin"`). Un nom fourni par
 * une expression — `name={a ? 'x' : 'y'}`, `name={v ?? 'defaut'}` — passait
 * donc sans JAMAIS etre regarde, quel que soit son contenu. C'est la meme
 * cecite que celle d'un `onClick={() => {}}` : la ligne est presente, le
 * verificateur ne peut pas la voir, et le build passe.
 *
 * On extrait donc les litteraux EN POSITION VALEUR. Les operandes de
 * comparaison (`x === 'success'`) ne sont PAS des noms d'icones : ils sont
 * retires avant extraction, sinon chaque ternaire de notificationControllers
 * fournirait un faux positif.
 */
const usageExprRe = /<(?:Icon|AppIcon|LkvIcon)\b[^>]*?\bname\s*=\s*\{([^}]*)\}/g;
const COMPARISON = /(['"])(?:(?!\1).)*\1\s*(?:===|!==|==|!=)|(?:===|!==|==|!=)\s*(['"])(?:(?!\2).)*\2/g;

for (const file of walk(src)) {
  const content = fs.readFileSync(file, 'utf8');
  if (!canonicalImportRe.test(content)) continue;
  for (const m of content.matchAll(usageExprRe)) {
    const line = content.slice(0, m.index).split(/\r?\n/).length;
    const valueSide = m[1].replace(COMPARISON, ' ');
    for (const lit of valueSide.matchAll(/'([^']+)'|"([^"]+)"/g)) {
      const name = lit[1] ?? lit[2];
      if (!name) continue;
      total++;
      const kind = resolves(name);
      if (kind === 'hero-legacy') {
        legacy.add(name);
      } else if (!kind) {
        failures.push(`${path.relative(root, file)}:${line} → "${name}" (dans name={...})`);
      }
    }
  }
}
/**
 * Les structures de données `icon: 'nom'` — deuxième angle mort.
 * `POST_TYPES` du composeur portait `icon: 'camera'`, un glyphe inexistant :
 * six avertissements runtime (« No glyph resolved ») sans qu'aucun
 * vérificateur statique ne bronche. On contrôle désormais les littéraux en
 * position valeur derrière une clé `icon:`. Les valeurs non ASCII (émojis)
 * relèvent d'un autre registre et sont ignorées.
 */
const dataIconRe = /\bicon\s*:\s*'([^']+)'|\bicon\s*:\s*"([^"]+)"/g;

for (const file of walk(src)) {
  const content = fs.readFileSync(file, 'utf8');
  if (!canonicalImportRe.test(content)) continue;
  for (const m of content.matchAll(dataIconRe)) {
    const name = m[1] ?? m[2];
    if (!name) continue;
    if (/[^\x00-\x7F]/.test(name)) continue;
    total++;
    const kind = resolves(name);
    if (kind === 'hero-legacy') {
      legacy.add(name);
    } else if (!kind) {
      const line = content.slice(0, m.index).split(/\r?\n/).length;
      failures.push(`${path.relative(root, file)}:${line} → "${name}" (dans icon:)`);
    }
  }
}
console.log(`=== VÉRIFICATION DES NOMS D'ICÔNES (${total} usages statiques) ===`);
console.log(`  registry: ${pngKeys.size} glyphes pack, ${svgNames.size} SF-style, ${animatedNames.size} animés`);
if (legacy.size > 0) {
  console.log(`  ${legacy.size} nom(s) Heroicon non vérifiables statiquement (tolérés)`);
}

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} nom(s) d'icône non résolu(s) :`);
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}

console.log('\n✓ Tous les noms d\'icônes statiques sont résolus.');
