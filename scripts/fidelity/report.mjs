#!/usr/bin/env node
/**
 * Banc de fidélité — rapport.
 *
 * Lit `tests/fidelity/out/<projet>/<scénario>.json` (écrits par
 * `tests/fidelity/fidelity.spec.ts`), puis :
 *   1. écrit la section « Scores (banc de fidélité) » de `docs/claude/FINITION-SUIVI.md` ;
 *   2. écrit la galerie `tests/fidelity/out/galerie.html` (app | maquette | diff).
 *
 * Usage : node scripts/fidelity/report.mjs [--no-doc]
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'tests/fidelity/out');
const DOC = join(ROOT, 'docs/claude/FINITION-SUIVI.md');
const SECTION = '## Scores (banc de fidélité)';
const NO_DOC = process.argv.includes('--no-doc');

if (!existsSync(OUT)) {
  console.error('Aucune sortie : lancer d’abord `npx playwright test --config=tests/fidelity/fidelity.config.ts`.');
  process.exit(1);
}

/** @type {Array<Record<string, any>>} */
const results = [];
for (const project of readdirSync(OUT, { withFileTypes: true })) {
  if (!project.isDirectory()) continue;
  for (const file of readdirSync(join(OUT, project.name))) {
    if (file.endsWith('.json')) results.push(JSON.parse(readFileSync(join(OUT, project.name, file), 'utf8')));
  }
}
if (!results.length) {
  console.error('Aucun résultat JSON.');
  process.exit(1);
}

/**
 * Sombre : si la capture de la maquette est (quasi) identique (< 3 % de pixels) en clair et en
 * sombre, la maquette n'a pas de rendu sombre pour cet écran. Le chiffre sombre
 * compare alors l'app sombre à une référence claire : il est signalé, jamais
 * compté comme une conformité ni comme une régression.
 */
function maquetteSansSombre(r) {
  if (!r.project.endsWith('-sombre') || !r.files) return false;
  const clair = r.project.replace('-sombre', '-clair');
  const a = join(OUT, clair, r.files.maquette);
  const b = join(OUT, r.project, r.files.maquette);
  if (!existsSync(a) || !existsSync(b)) return false;
  const pa = PNG.sync.read(readFileSync(a));
  const pb = PNG.sync.read(readFileSync(b));
  if (pa.width !== pb.width || pa.height !== pb.height) return false;
  const diff = pixelmatch(pa.data, pb.data, null, pa.width, pa.height, { threshold: 0.1, includeAA: false });
  return diff / (pa.width * pa.height) < 0.03;
}
for (const r of results) r.maquetteSansSombre = maquetteSansSombre(r);

const pct = (r, digits = 1) => `${(r * 100).toFixed(digits).replace('.', ',')} %`;
const projects = [...new Set(results.map((r) => r.project))].sort((a, b) => {
  const wa = Number(a.split('x')[0]);
  const wb = Number(b.split('x')[0]);
  return wa - wb || a.localeCompare(b);
});
const scenarioIds = [];
for (const r of results) if (!scenarioIds.includes(r.scenario)) scenarioIds.push(r.scenario);
const byKey = new Map(results.map((r) => [`${r.scenario}|${r.project}`, r]));
const meta = (id) => results.find((r) => r.scenario === id);
const projectLabel = (p) => p.replace('-clair', ' clair').replace('-sombre', ' sombre');

function cell(r) {
  if (!r) return '—';
  if (r.status === 'non-atteignable') return 'non atteignable';
  if (r.status === 'erreur') return 'erreur';
  const ok = r.status === 'ok' ? ' ✓' : '';
  const flag = r.maquetteSansSombre ? ' †' : '';
  return `${pct(r.pixel.ratio)} · ${r.measures.ok}/${r.measures.total}${ok}${flag}`;
}

function surfaceTable(surface) {
  const ids = scenarioIds.filter((id) => meta(id).surface === surface);
  const head = `| Écran · état (rôle) | ${projects.map(projectLabel).join(' | ')} |`;
  const sep = `| --- | ${projects.map(() => '---').join(' | ')} |`;
  const rows = ids.map((id) => {
    const m = meta(id);
    return `| ${m.ecran} · ${m.etat} (${m.role}) | ${projects.map((p) => cell(byKey.get(`${id}|${p}`))).join(' | ')} |`;
  });
  return [head, sep, ...rows].join('\n');
}

const measured = results.filter((r) => r.pixel && !r.maquetteSansSombre);
const sansSombre = results.filter((r) => r.pixel && r.maquetteSansSombre);
const count = (status) => results.filter((r) => r.status === status).length;
const meanRatio = measured.reduce((s, r) => s + r.pixel.ratio, 0) / (measured.length || 1);
const totalMeasures = measured.reduce((s, r) => s + r.measures.total, 0);
const okMeasures = measured.reduce((s, r) => s + r.measures.ok, 0);
const pixelOk = measured.filter((r) => r.pixel.ok).length;

/** Écarts triés par surface de différence (pixels différents). */
const worst = [...measured].sort((a, b) => b.pixel.diffPixels - a.pixel.diffPixels);
function failingMeasures(r, limit = 3) {
  return r.measures.results
    .filter((m) => !m.ok)
    .sort((a, b) => (b.delta ?? 99) - (a.delta ?? 99))
    .slice(0, limit)
    .map((m) => `${m.id} · ${m.prop} : app ${m.app ?? '∅'} / maquette ${m.maquette ?? '∅'}`)
    .join(' ; ');
}
function hotspots(r) {
  return r.pixel.hotspots.length ? r.pixel.hotspots.slice(0, 3).map((h) => `y ${h.y}–${h.y + h.h} (${pct(h.ratio, 0)})`).join(', ') : '—';
}
const worstRows = worst.slice(0, 25).map(
  (r, i) =>
    `| ${i + 1} | ${r.scenario} | ${projectLabel(r.project)} | ${r.pixel.diffPixels.toLocaleString('fr-FR')} px (${pct(r.pixel.ratio)}) | ${hotspots(r)} | ${r.pixel.appFrame.w}×${r.pixel.appFrame.h} / ${r.pixel.maquetteFrame.w}×${r.pixel.maquetteFrame.h} | ${failingMeasures(r) || '—'} |`,
);

/** Mesures en échec regroupées : même élément et même propriété sur plusieurs scénarios. */
const groups = new Map();
for (const r of measured) {
  for (const m of r.measures.results) {
    if (m.ok) continue;
    const label = `${r.surface === 'carnet' ? 'Carnet' : 'Communauté'} · ${m.id}`;
    const key = `${label}|${m.prop}`;
    const g = groups.get(key) ?? { id: label, prop: m.prop, n: 0, example: m };
    g.n += 1;
    groups.set(key, g);
  }
}
const recurring = [...groups.values()].sort((a, b) => b.n - a.n).slice(0, 20);
const recurringRows = recurring.map((g) => `| ${g.id} | ${g.prop} | ${g.n} | ${g.example.app ?? '∅'} | ${g.example.maquette ?? '∅'} |`);

const unreachable = results.filter((r) => r.status === 'non-atteignable' || r.status === 'erreur');
const unreachableByScenario = new Map();
for (const r of unreachable) {
  const entry = unreachableByScenario.get(r.scenario) ?? { reason: r.reason ?? '', projects: [] };
  entry.projects.push(projectLabel(r.project));
  unreachableByScenario.set(r.scenario, entry);
}
const unreachableRows = [...unreachableByScenario.entries()].map(
  ([id, e]) => `| ${id} | ${e.projects.join(', ')} | non atteignable : ${e.reason.replace(/\|/g, '/').slice(0, 280)} |`,
);

const generated = new Date().toISOString().slice(0, 10);
const section = `${SECTION}

Banc : \`tests/fidelity/\` (config \`fidelity.config.ts\`, scénarios \`scenarios/{communaute,carnet}.ts\`). Passage du ${generated}. Projets joués : ${projects.map(projectLabel).join(', ')}. Pas encore joués : 360×780, 430×932, 768×1024.

Lancer : \`bash tests/fidelity/build.sh\` (un seul build, mode fixtures), puis \`npx playwright test --config=tests/fidelity/fidelity.config.ts\`, puis \`node scripts/fidelity/report.mjs\` (réécrit cette section et \`tests/fidelity/out/galerie.html\`). Variables : \`FIDELITY_SIZES\`, \`FIDELITY_THEMES\`, \`FIDELITY_ONLY\`, \`FIDELITY_STRICT=1\` (un écart fait échouer le test).

† = la maquette n'a pas de rendu sombre pour cet écran (capture quasi identique en clair et en sombre : moins de 3 % de pixels changent) : le chiffre compare l'app sombre à une référence claire, il n'est pas une mesure de fidélité.

Lecture : chaque cellule = **part de pixels différents** (diff pixelmatch seuil 0,1, hors masques ; objectif ≤ 2,0 %) · **mesures DOM conformes / mesurées** (±1 px, couleurs exactes). ✓ = pixels et mesures conformes. Aucune cellule n'est ✓ si un écart subsiste.

### Synthèse

| Indicateur | Valeur |
| --- | --- |
| Scénarios × projets joués | ${results.length} (${count('ok')} conformes, ${count('ecart')} avec écart, ${count('non-atteignable')} non atteignables, ${count('erreur')} en erreur) |
| Dont sombre sans référence (†) | ${sansSombre.length} : la maquette ne change pas en sombre (moins de 3 % de pixels), ces cellules sont exclues des moyennes ci-dessous |
| Pixels ≤ 2 % de différence | ${pixelOk} / ${measured.length} |
| Différence pixel moyenne | ${pct(meanRatio)} |
| Mesures DOM conformes | ${okMeasures} / ${totalMeasures} (${pct(okMeasures / (totalMeasures || 1))}) |

Réserves de méthode (écarts de **banc**, pas de l'app) : (1) les jeux de données diffèrent (fixtures de l'app contre contenu d'exemple de la maquette) : textes, couvertures, avatars, carte et profil d'altitude sont masqués et listés dans le JSON de chaque scénario (\`masques\`), mais les fonds de carte-jour (illustration de la maquette contre aplat de l'app sans photo) restent comptés ; (2) à partir de 768 px, la maquette montre un téléphone 390 px dans un cadre, l'app une colonne centrée plus large : la comparaison se fait sur l'intersection des deux cadres depuis leur coin haut-gauche, et la différence de taille de cadre est lisible dans la colonne « cadres » ; (3) le visiteur du carnet est une session anonyme (identifiant sans ligne de collaborateur).

### Communauté v2

${surfaceTable('communaute')}

### Fiche Carnet v2

${surfaceTable('carnet')}

### Écarts triés par surface de différence (25 premiers)

| # | Scénario | Projet | Pixels différents | Bandes les plus différentes | Cadres app / maquette | Mesures en échec (3 plus grosses) |
| --- | --- | --- | --- | --- | --- | --- |
${worstRows.join('\n')}

### Écarts de mesure récurrents

| Élément | Propriété | Occurrences | Valeur app (exemple) | Valeur maquette (exemple) |
| --- | --- | --- | --- | --- |
${recurringRows.join('\n') || '| — | — | 0 | — | — |'}

### Non atteignable (raison écrite, rien d'inventé)

| Scénario | Projets | Raison |
| --- | --- | --- |
${unreachableRows.join('\n') || '| — | — | — |'}

Galerie côte à côte (app | maquette | carte de diff) : \`tests/fidelity/out/galerie.html\` (ignorée par git ; régénérée par le rapport).

`;

if (!NO_DOC) {
  const doc = readFileSync(DOC, 'utf8');
  const start = doc.indexOf(SECTION);
  if (start === -1) {
    console.error(`Section « ${SECTION} » introuvable dans ${DOC}`);
    process.exit(1);
  }
  const next = doc.indexOf('\n## ', start + SECTION.length);
  const after = next === -1 ? '' : doc.slice(next + 1);
  writeFileSync(DOC, `${doc.slice(0, start)}${section}${after}`);
  console.info(`Section écrite dans ${DOC}`);
}

// ── Galerie HTML ────────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const cards = [...results.filter((r) => r.pixel)]
  .sort((a, b) => b.pixel.ratio - a.pixel.ratio)
  .map((r) => {
    const base = `${r.project}/`;
    return `<section class="card" data-project="${esc(r.project)}" data-surface="${r.surface}">
  <h3>${esc(r.ecran)} · ${esc(r.etat)} <small>(${esc(r.role)})</small></h3>
  <p><code>${esc(r.scenario)}</code> · ${esc(projectLabel(r.project))} · pixels ${pct(r.pixel.ratio)} · mesures ${r.measures.ok}/${r.measures.total}${r.status === 'ok' ? ' · ✓' : ''}${r.maquetteSansSombre ? ' · † maquette sans rendu sombre' : ''}</p>
  <div class="row">
    <figure><img loading="lazy" src="${base}${esc(r.files.app)}" alt="app"><figcaption>app ${r.pixel.appFrame.w}×${r.pixel.appFrame.h}</figcaption></figure>
    <figure><img loading="lazy" src="${base}${esc(r.files.maquette)}" alt="maquette"><figcaption>maquette ${r.pixel.maquetteFrame.w}×${r.pixel.maquetteFrame.h}</figcaption></figure>
    <figure><img loading="lazy" src="${base}${esc(r.files.diff)}" alt="diff"><figcaption>diff (rouge = différent, rose = masque)</figcaption></figure>
  </div>
  <details><summary>Mesures en échec (${r.measures.total - r.measures.ok})</summary><ul>${r.measures.results
    .filter((m) => !m.ok)
    .map((m) => `<li>${esc(m.id)} · ${esc(m.prop)} : app <code>${esc(m.app ?? '∅')}</code> / maquette <code>${esc(m.maquette ?? '∅')}</code>${m.note ? ` (${esc(m.note)})` : ''}</li>`)
    .join('')}</ul></details>
</section>`;
  })
  .join('\n');
const unreachableCards = [...unreachableByScenario.entries()]
  .map(([id, e]) => `<li><code>${esc(id)}</code> (${esc(e.projects.join(', '))}) : non atteignable : ${esc(e.reason)}</li>`)
  .join('');
writeFileSync(
  join(OUT, 'galerie.html'),
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Banc de fidélité — galerie</title>
<style>body{font:14px system-ui;margin:24px;background:#faf8f5;color:#17402c}h3{margin:0}small{font-weight:400;color:#5b7f55}.card{border-top:1px solid #a6c1a0;padding:16px 0}.row{display:flex;gap:12px;align-items:flex-start;overflow-x:auto}figure{margin:0}img{max-height:620px;border:1px solid #a6c1a0;background:#fff}figcaption{font-size:12px;color:#5b7f55}code{background:#ebf2ec;padding:0 4px}</style></head><body>
<h1>Banc de fidélité — app | maquette | diff</h1><p>${results.length} résultats (dont ${sansSombre.length} † sans référence sombre), triés du plus différent au plus proche. Généré le ${generated}.</p>
<h2>Non atteignable</h2><ul>${unreachableCards || '<li>—</li>'}</ul>
${cards}</body></html>`,
);
console.info(`Galerie écrite dans ${join(OUT, 'galerie.html')}`);
