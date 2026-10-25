// Compas — lecture d'un passage de validation en ligne (voir validate-online.mjs).
// Usage : node scripts/compas/analyse-run.mjs <dossier> [--titre "texte"] [--journal]
// Résume results.jsonl (prêtes, interrompues, erreurs, durées) et, avec --journal,
// ajoute le bilan à docs/compas/phase7/JOURNAL-TESTS.md pour boucler : test → constat → correction → rejeu.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--'));
if (!dir) {
  console.error('Usage : node scripts/compas/analyse-run.mjs <dossier> [--titre "texte"] [--journal]');
  process.exit(2);
}
const titleIdx = args.indexOf('--titre');
const title = titleIdx >= 0 ? args[titleIdx + 1] : path.basename(dir);
const file = path.join(dir, 'results.jsonl');
const rows = fs
  .readFileSync(file, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const state = (r) =>
  r.error ? 'erreur' : /Ton aventure est prête/.test(r.head ?? '') ? 'prête' : 'interrompue';
const secs = rows.filter((r) => !r.error).map((r) => r.seconds).sort((a, b) => a - b);
const pct = (p) => (secs.length ? secs[Math.min(secs.length - 1, Math.floor(p * secs.length))] : 0);
const count = (s) => rows.filter((r) => state(r) === s).length;
const summaryOf = (r) => (r.head?.match(/Budget[^\n]*/)?.[0] ?? '').slice(0, 120);

const lines = [];
lines.push(`### ${title}`);
lines.push('');
lines.push(
  `${rows.length} demande(s) : **${count('prête')} prêtes**, ${count('interrompue')} interrompues, ${count('erreur')} en erreur. ` +
    `Durée médiane ${pct(0.5)} s, p90 ${pct(0.9)} s, max ${secs[secs.length - 1] ?? 0} s.`
);
lines.push('');
lines.push('| # | État | s | Demande | Synthèse / erreur |');
lines.push('|---|------|---|---------|-------------------|');
for (const r of rows) {
  const detail = r.error ? r.error.replace(/\|/g, '/').slice(0, 140) : summaryOf(r);
  lines.push(`| ${r.i} | ${state(r)} | ${r.seconds} | ${r.say.replace(/\|/g, '/')} | ${detail} |`);
}
lines.push('');
const text = lines.join('\n');
console.log(text);

if (args.includes('--journal')) {
  const j = 'docs/compas/phase7/JOURNAL-TESTS.md';
  if (!fs.existsSync(j)) {
    fs.writeFileSync(
      j,
      '# Journal des tests du Compas\n\nBoucle : **test → constat → cause → correction → rejeu**. Chaque passage est ajouté ici avec sa date ; les constats ouverts vont dans `CONSTATS.md`.\n\n'
    );
  }
  fs.appendFileSync(j, `\n## ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC\n\n${text}\n`);
  console.info('Journal mis à jour :', j);
}
