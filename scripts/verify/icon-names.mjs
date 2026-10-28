#!/usr/bin/env node
/**
 * INVARIANT ICÔNES — LKDV V2 est la seule base de pictogrammes
 * ===========================================================
 * Échoue (code 1) si :
 *  - un fichier de `src/` importe une autre bibliothèque d'icônes (lucide, Heroicons, Phosphor,
 *    react-icons, Tabler, Radix icons, Iconoir…) ou les anciens modules `ui/Icon`, `ui/AppIcon`, `ui/LkvIcon` ;
 *  - du code référence les anciens packs (`/icons/sf/…`, PNG de `/icons/`) ;
 *  - un nom écrit en dur (`<LKDVIcon name="…">`, `lkdvIcon('…')`) n'est pas une clé de la base ;
 *  - la liste `LKDV_ICON_NAMES` ne correspond pas exactement aux SVG de `public/icons/lkdv/` ;
 *  - un SVG de la base contient autre chose que le vert unique `#00542B` (dégradé, ombre, transparence, fond).
 *
 * Usage : node scripts/verify/icon-names.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const src = path.join(root, 'src');
const iconsDir = path.join(root, 'public', 'icons', 'lkdv');
const GREEN = '#00542B';

const failures = [];
const fail = (msg) => failures.push(msg);

// --- 1. la liste typée = les fichiers SVG ---------------------------------------------------------
const component = fs.readFileSync(path.join(src, 'components/ui/LKDVIcon.tsx'), 'utf8');
const listBody = component.match(/LKDV_ICON_NAMES = \[([\s\S]*?)\] as const/);
if (!listBody) {
  console.error('✗ LKDV_ICON_NAMES introuvable dans src/components/ui/LKDVIcon.tsx');
  process.exit(1);
}
const names = new Set([...listBody[1].matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]));
const files = new Set(
  fs.existsSync(iconsDir) ? fs.readdirSync(iconsDir).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)) : [],
);
for (const n of names) if (!files.has(n)) fail(`SVG manquant : public/icons/lkdv/${n}.svg`);
for (const f of files) if (!names.has(f)) fail(`SVG hors liste : public/icons/lkdv/${f}.svg (absent de LKDV_ICON_NAMES)`);

// --- 2. chaque SVG : un seul vert, aucun artifice --------------------------------------------------
for (const f of files) {
  const svg = fs.readFileSync(path.join(iconsDir, `${f}.svg`), 'utf8');
  const colors = new Set((svg.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map((c) => c.toUpperCase()));
  if (colors.size !== 1 || !colors.has(GREEN)) fail(`${f}.svg : couleurs ${[...colors].join(', ') || 'aucune'} (attendu ${GREEN} seul)`);
  if (/<image|<style|(?:linear|radial)Gradient|<filter|opacity|<mask|<clipPath/i.test(svg)) fail(`${f}.svg : dégradé, filtre, opacité ou masque interdit`);
  if (!/viewBox="0 0 100 100"/.test(svg)) fail(`${f}.svg : viewBox 0 0 100 100 attendu`);
}

// --- 3. le code -------------------------------------------------------------------------------------
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx?|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const FORBIDDEN_IMPORT =
  /from\s+['"](?:lucide-react|lucide|@heroicons\/[^'"]*|@phosphor-icons\/[^'"]*|react-icons(?:\/[^'"]*)?|@tabler\/icons[^'"]*|@radix-ui\/react-icons|iconoir-react|@fortawesome\/[^'"]*|phosphor-react|feather-icons|react-feather)['"]/;
const REMOVED_MODULE = /from\s+['"](?:@\/components\/ui\/(?:Icon|AppIcon|LkvIcon)(?:\/[^'"]*)?|\.\/(?:Icon|AppIcon|LkvIcon)|@\/components\/icons\/[^'"]*)['"]/;
const OLD_PACK = /\/icons\/sf\/|\/icons\/[A-Za-z0-9 _%-]+\.png/;
const STATIC_NAME = /<LKDVIcon\b[^>]*?\bname\s*=\s*(?:"([^"]+)"|'([^']+)')/g;
const BOUND_NAME = /\blkdvIcon\(\s*'([^']+)'\s*\)/g;

let checked = 0;
for (const file of walk(src)) {
  const rel = path.relative(root, file);
  const text = fs.readFileSync(file, 'utf8');
  const isTest = /__tests__|\.test\.|\.spec\./.test(rel);
  if (/\.tsx?$/.test(file)) {
    if (!isTest && FORBIDDEN_IMPORT.test(text)) fail(`${rel} : import d'une autre bibliothèque d'icônes`);
    if (REMOVED_MODULE.test(text) && !/vi\.mock/.test(text)) fail(`${rel} : import d'un ancien module d'icônes`);
    if (!isTest && OLD_PACK.test(text)) fail(`${rel} : référence à un ancien pack d'icônes (/icons/sf, PNG)`);
    for (const re of [STATIC_NAME, BOUND_NAME]) {
      for (const m of text.matchAll(re)) {
        const name = m[1] ?? m[2];
        checked++;
        if (!names.has(name)) {
          const line = text.slice(0, m.index).split(/\r?\n/).length;
          fail(`${rel}:${line} → "${name}" n'est pas une icône LKDV V2`);
        }
      }
    }
  } else if (OLD_PACK.test(text.replace(/\/\*[\s\S]*?\*\//g, ''))) {
    fail(`${rel} : référence à un ancien pack d'icônes (/icons/sf, PNG)`);
  }
}

if (failures.length) {
  console.error(`✗ Invariant icônes : ${failures.length} écart(s)\n` + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log(`✓ Icônes : ${names.size} SVG LKDV V2 (${GREEN}), ${checked} noms écrits en dur vérifiés, aucune autre bibliothèque.`);
