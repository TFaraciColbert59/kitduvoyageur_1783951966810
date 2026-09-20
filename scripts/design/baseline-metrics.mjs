#!/usr/bin/env node
/**
 * baseline-metrics.mjs — mesures « avant » de la refonte (Phase 1 → Phase 2).
 *
 * Produit les chiffres exigés par le protocole de validation Phase 2 :
 *   hex, rounded-[...], text-[...], z-[...], styles inline, window.confirm,
 *   implémentations modales concurrentes, bottom bars, headers custom,
 *   composants UI dupliqués, pages desktop/mobile séparées.
 *
 * Usage :
 *   node scripts/design/baseline-metrics.mjs            # tableau Markdown
 *   node scripts/design/baseline-metrics.mjs --json     # JSON
 *   node scripts/design/baseline-metrics.mjs --write    # écrit baseline-metrics.json
 *
 * Ne modifie rien d'autre que le fichier JSON avec --write.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'docs', 'design-system', 'baseline-metrics.json');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const tsFiles = walk(SRC).filter((f) => /\.(ts|tsx)$/.test(f));
const appFiles = walk(path.join(SRC, 'app')).filter((f) => /\.(tsx|ts)$/.test(f));
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');

function countMatches(files, regex) {
  let total = 0;
  const byFile = new Map();
  for (const f of files) {
    const content = fs.readFileSync(f, 'utf8');
    const m = content.match(regex);
    if (m) {
      total += m.length;
      byFile.set(rel(f), m.length);
    }
  }
  return { total, byFile };
}

function filesMatching(files, regex) {
  return files.filter((f) => regex.test(fs.readFileSync(f, 'utf8'))).map(rel);
}

const hex = countMatches(tsFiles, /#[0-9A-Fa-f]{3,8}\b/g);
const rounded = countMatches(tsFiles, /rounded-\[/g);
const textArb = countMatches(tsFiles, /text-\[/g);
const zArb = countMatches(tsFiles, /z-\[/g);
const inlineStyles = countMatches(tsFiles, /style=\{\{/g);
const windowDialogs = countMatches(tsFiles, /window\.(confirm|alert|prompt)\s*\(/g);
const lkvDialogs = countMatches(tsFiles, /\blkv(Confirm|Alert|Prompt)\s*\(/g);

const modalPrimitives = {};
for (const name of ['GlassModal', 'Sheet', 'GlassSheet', 'PremiumBottomSheet', 'GlassDrawer']) {
  // Import exact du module (évite que GlassSheet soit compté comme Sheet).
  modalPrimitives[name] = filesMatching(
    tsFiles,
    new RegExp(`from ['"][^'"]*/${name}['"]`)
  ).length;
}
const roleDialog = filesMatching(tsFiles, /role="dialog"/);

// Implémentations réelles = fichiers dont le nom porte le composant.
const bottomBarFiles = tsFiles
  .filter((f) => /(BottomTabBar|BottomBar|BottomNav|DockBar|MobileNavWrapper)[^/]*\.tsx$/.test(f))
  .map(rel);
const fixedBottom = countMatches(tsFiles, /fixed bottom-0/g);

const headerFiles = filesMatching(appFiles, /<header|sticky top-0/);

const uiFiles = walk(path.join(SRC, 'components', 'ui')).filter((f) => /\.tsx$/.test(f));
const rolePatterns = {
  Card: /Card\.tsx$/,
  Modal: /Modal\.tsx$/,
  Sheet: /Sheet\.tsx$/,
  Header: /Header\.tsx$/,
  Button: /Button\.tsx$/,
  Tabs: /Tabs\.tsx$/,
};
const roleDuplicates = {};
for (const [role, re] of Object.entries(rolePatterns)) {
  const hits = tsFiles.filter((f) => re.test(f)).map(rel);
  roleDuplicates[role] = hits;
}

const dualLayout = filesMatching(
  appFiles,
  /(?=[\s\S]*hidden md:)(?=[\s\S]*md:hidden)/
);

const topHex = [...hex.byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

const metrics = {
  generatedAt: new Date().toISOString(),
  scope: 'src/**/*.{ts,tsx}',
  hardcodedHex: hex.total,
  roundedArbitrary: rounded.total,
  textArbitrary: textArb.total,
  zIndexArbitrary: zArb.total,
  inlineStyles: inlineStyles.total,
  windowConfirmAlertPrompt: windowDialogs.total,
  lkvDialogCalls: lkvDialogs.total,
  modalPrimitiveImporters: modalPrimitives,
  roleDialogFiles: roleDialog.length,
  bottomBarFiles: bottomBarFiles.length,
  fixedBottom0: fixedBottom.total,
  appFilesWithCustomHeader: headerFiles.length,
  uiPrimitiveFiles: uiFiles.length,
  roleDuplicates: Object.fromEntries(
    Object.entries(roleDuplicates).map(([k, v]) => [k, { count: v.length, files: v }])
  ),
  appPagesDualDesktopMobile: dualLayout.length,
  top10FilesByHardcodedHex: topHex,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(metrics, null, 2));
} else {
  console.log('| Mesure | Avant (Phase 1) |');
  console.log('|---|---|');
  console.log(`| Couleurs hex codées en dur (\`src/**/*.{ts,tsx}\`) | ${hex.total} |`);
  console.log(`| \`rounded-[...]\` | ${rounded.total} |`);
  console.log(`| \`text-[...]\` | ${textArb.total} |`);
  console.log(`| \`z-[...]\` | ${zArb.total} |`);
  console.log(`| Styles inline (\`style={{...}}\`) | ${inlineStyles.total} |`);
  console.log(`| \`window.confirm/alert/prompt\` | ${windowDialogs.total} |`);
  console.log(`| Appels \`lkvConfirm/Alert/Prompt\` | ${lkvDialogs.total} |`);
  console.log(`| Importeurs de primitives modales (GlassModal/Sheet/GlassSheet/PremiumBottomSheet/GlassDrawer) | ${Object.values(modalPrimitives).join(' / ')} |`);
  console.log(`| Fichiers avec \`role="dialog"\` | ${roleDialog.length} |`);
  console.log(`| Implémentations bottom bar détectées | ${bottomBarFiles.length} |`);
  console.log(`| \`fixed bottom-0\` | ${fixedBottom.total} |`);
  console.log(`| Pages \`src/app\` avec header custom | ${headerFiles.length} |`);
  console.log(`| Fichiers primitives \`src/components/ui\` | ${uiFiles.length} |`);
  console.log(`| Pages desktop/mobile séparées | ${dualLayout.length} |`);
  for (const [role, v] of Object.entries(roleDuplicates)) {
    console.log(`| Doublons de rôle \`*${role}.tsx\` | ${v.length} |`);
  }
  console.log('\nTop 10 fichiers (hex) :');
  for (const [f, n] of topHex) console.log(`  ${n}\t${f}`);
}

if (process.argv.includes('--write')) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(metrics, null, 2));
  console.log(`\nÉcrit : ${rel(OUT)}`);
}
