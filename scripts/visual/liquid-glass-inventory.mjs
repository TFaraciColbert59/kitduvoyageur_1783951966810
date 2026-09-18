import { readdir, readFile, mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const phase = process.argv[2] ?? 'after';
if (!/^[a-z0-9-]+$/.test(phase)) throw new Error('Invalid inventory phase');
const output = path.join(root, 'docs/visual/liquid-glass', `inventory-${phase}.json`);
if (phase === 'before') {
  try { await access(output); throw new Error('Baseline already exists; use another phase.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory()
    ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]))).flat().sort();
}
const files = (await walk(path.join(root, 'src'))).filter((file) => /\.(tsx?|css)$/.test(file));
const rules = [
  ['canonical-component', 'canonical', /<(?:GlassCard|GlassSubCard|ProductGlassCard|GlassModal|GlassDrawer|GlassSheet)\b/g],
  ['canonical-css-adapter', 'canonical', /\bclassName\s*=.*\bglass(?:[\s"'`}]|$)/g],
  ['secondary-surface', 'canonical', /\bglass-sub-card\b/g],
  ['local-backdrop', 'legacy', /\b(?:backdrop-blur[\w[\].%-]*|backdropFilter|WebkitBackdropFilter)\b/g],
  ['css-backdrop', 'exception-review', /(?:-webkit-)?backdrop-filter\s*:/g],
  ['competing-engine', 'legacy', /\bLiquidGlassCard\b|\bpremium-card\b|\binteractive-card\b/g],
  ['route-material', 'legacy', /\.hub-rail.*\.glass|data-lkv-material-theme|\bglass-pure\b/g],
  ['country-surface', 'exception-review', /\.(?:high-card|act-card|gast-card|prat-card|weather-card|safe-card|dest-card|m-stats-card|m-dest-card|m-prat-card)\b/g],
  ['overlay-candidate', 'exception-review', /<[A-Za-z][A-Za-z0-9]*(?:Modal|Sheet|Drawer|Panel)\b/g],
];
const relative = (file) => path.relative(root, file).replaceAll('\\', '/');
const candidates = (await Promise.all(files.map(async (absolute) => {
  const source = await readFile(absolute, 'utf8');
  return source.split(/\r?\n/).flatMap((context, index) => rules.flatMap(([kind, classification, pattern]) =>
    [...context.matchAll(pattern)].map((match) => ({ file: relative(absolute), line: index + 1,
      column: match.index + 1, kind, classification, match: match[0], context: context.trim() }))));
}))).flat();
const routes = files.filter((file) => relative(file).startsWith('src/app/') && file.endsWith(`${path.sep}page.tsx`))
  .map((file) => ({ route: `/${relative(file).replace(/^src\/app\//, '').replace(/(?:^|\/)page\.tsx$/, '')}`, file: relative(file) }));
const states = files.filter((file) => /[\\/](loading|error|not-found)\.tsx$/.test(file))
  .map((file) => ({ file: relative(file), state: path.basename(file, '.tsx') }));
const summary = { scannedFiles: files.length, routes: routes.length, states: states.length,
  candidateFiles: new Set(candidates.map((entry) => entry.file)).size,
  classifications: Object.fromEntries(['canonical', 'legacy', 'exception-review'].map((key) =>
    [key, candidates.filter((entry) => entry.classification === key).length])) };
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), phase,
  methodology: 'Static line candidates; overlapping categories include comments, definitions and potentially unpublished components. canonical means shared adapter, not absence of overrides. exception-review is not an approved exception. Runtime states, contrast and performance require browser review.',
  summary, routes, states, stylesheets: files.filter((file) => file.endsWith('.css')).map(relative), candidates }, null, 2)}\n`);
console.log(JSON.stringify({ output: relative(output), ...summary }, null, 2));
