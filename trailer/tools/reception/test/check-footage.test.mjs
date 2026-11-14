// node --test tools/reception/test/
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parsePrompts, nameKey, matchFiles, renameCommand, analyseFolder, renderMarkdown, DEFAULTS } from '../check-footage.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(HERE, '..', 'fixtures');
const parsed = parsePrompts(fs.readFileSync(DEFAULTS.prompts, 'utf8'));
let propre, defauts, attendu;

before(async () => {
  execFileSync(process.execPath, [path.join(HERE, '..', 'make-fixtures.mjs')], { stdio: 'ignore' });
  attendu = JSON.parse(fs.readFileSync(path.join(FIX, 'attendu.json'), 'utf8'));
  propre = await analyseFolder(path.join(FIX, 'propre'));
  defauts = await analyseFolder(path.join(FIX, 'defauts'));
});

test('prompts : 51 images, img21 facultative, 11 plans de téléphone, 7 fiches', () => {
  assert.equal(parsed.images.length, 51);
  assert.deepEqual(parsed.images.filter((i) => i.optional).map((i) => i.id), ['img21']);
  assert.ok(!parsed.images.some((i) => i.id === 'img35'));
  for (const id of ['img09b', 'img35a', 'img35b']) assert.ok(parsed.images.some((i) => i.id === id), id);
  assert.deepEqual(parsed.images.filter((i) => i.phone).map((i) => i.id).sort(),
    ['img07', 'img18', 'img22', 'img27', 'img37', 'img38', 'img40', 'img41', 'img42', 'img43', 'img46']);
  assert.deepEqual(parsed.images.filter((i) => i.twoCorners).map((i) => i.id), ['img43']);
  assert.deepEqual(parsed.fiches.filter((f) => !f.optional).map((f) => f.file),
    ['F1-lea.png', 'F2-sami.png', 'F3-ines.png', 'F4-tom.png', 'F5-malik.png', 'F6-clara.png', 'F7-noah.png']);
  const im = (id) => parsed.images.find((i) => i.id === id);
  assert.deepEqual(im('img34').characters, ['F6', 'F1', 'F2', 'F3', 'F4']);
  assert.deepEqual(im('img22').characters, ['F1']);
  assert.ok(im('img16').bag && im('img06').ville && im('img36').night && im('img35a').silhouettes);
});

test('noms presque justes : reconnus et renommage exact proposé', () => {
  const cases = {
    'IMG07.PNG': 'img7', 'img7.png': 'img7', 'img_07.png': 'img7', 'IMG 07.png': 'img7', 'image-07.png': 'img7',
    'img07 (1).png': 'img7', 'img07_v2.png': 'img7', 'Copie de img07.png': 'img7', 'img07.jpg': 'img7',
    'img35-a.png': 'img35a', 'img35B.png': 'img35b', 'img 35 b.png': 'img35b', 'img9b.png': 'img9b',
    'F1_Léa.png': 'f1', 'f1.png': 'f1', 'fiche F3 ines.png': 'f3', 'lea.png': 'f1', 'Noah.png': 'f7',
    'F1-lea-ville.png': 'f1v', 'léa ville.png': 'f1v',
    'ChatGPT Image 11 nov. 2026, 14_03_22.png': null, 'IMG_0735.png': 'img735',
  };
  for (const [f, k] of Object.entries(cases)) assert.equal(nameKey(f), k, f);
  const expected = [...parsed.images.map((i) => ({ id: i.id, file: `${i.id}.png` })), ...parsed.fiches.map((f) => ({ id: f.id, file: f.file }))];
  const m = matchFiles(['IMG07.PNG', 'img07 (1).png', 'img9.png', 'img09.png', 'img35.png', 'F1_Léa.png', 'Thumbs.db', 'notes.txt'], expected);
  assert.equal(m.assigned.get('img07').file, 'IMG07.PNG');
  assert.equal(m.assigned.get('img09').file, 'img09.png'); // le nom exact gagne
  assert.deepEqual(m.duplicates.map((d) => d.file).sort(), ['img07 (1).png', 'img9.png']);
  assert.equal(m.assigned.get('F1').file, 'F1_Léa.png');
  assert.deepEqual(m.unexpected.sort(), ['img35.png', 'notes.txt']);
  assert.match(m.hints['img35.png'], /img35a/);
  assert.equal(renameCommand('assets/footage', 'img7.png', 'img07.png'), 'Rename-Item -LiteralPath "assets/footage/img7.png" -NewName "img07.png"');
  assert.match(renameCommand('assets/footage', 'IMG07.png', 'img07.png'), /_tmp_img07\.png.*-NewName "img07\.png"$/);
});

test('lot propre : chaque image reçue passe (aucun défaut, aucune alerte)', (t) => {
  const present = propre.entries.filter((e) => e.present);
  const flagged = present.filter((e) => e.issues.length);
  t.diagnostic(`lot propre : ${present.length - flagged.length}/${present.length} images sans défaut ni alerte`);
  for (const e of flagged) t.diagnostic(`faux positif ${e.id} : ${e.issues.map((i) => i.text).join(' | ')}`);
  assert.equal(present.length, 13);
  assert.deepEqual(flagged.map((e) => e.id), []);
  assert.ok(propre.entries.find((e) => e.id === 'img40').notes.some((n) => /blanc/.test(n)), 'écran blanc de repli accepté');
  assert.equal(propre.pairs.every((p) => !p.issues?.length), true);
});

test('lot défauts : chaque défaut attendu est détecté', (t) => {
  let hit = 0, total = 0, extra = 0;
  for (const [id, codes] of Object.entries(attendu.defauts)) {
    const e = defauts.entries.find((x) => x.id === id);
    const got = new Set(e.issues.map((i) => i.code));
    for (const c of codes) { total++; if (got.has(c)) hit++; else t.diagnostic(`NON détecté : ${id} ${c}`); }
    for (const c of got) if (!codes.includes(c)) { extra++; t.diagnostic(`signalement en plus : ${id} ${c}`); }
  }
  t.diagnostic(`lot défauts : ${hit}/${total} défauts détectés, ${extra} signalement(s) non prévu(s)`);
  assert.equal(hit, total);
  assert.deepEqual(defauts.summary.unexpected.sort(), [...attendu.unexpected].sort());
  // chaque défaut porte une phrase de correction ou une action
  for (const e of defauts.entries) for (const i of e.issues) assert.ok(i.action || i.phrases.length, `${e.id} ${i.code} sans phrase`);
  // phrase « Texte ou logo » reprise mot pour mot
  const txt = defauts.entries.find((e) => e.id === 'img05').issues.find((i) => i.code === 'text');
  assert.equal(txt.phrases[0].text, parsed.phrases['Texte ou logo']);
  assert.equal(defauts.summary.exitCode, 1);
});

test('dossier absent : 50 + 7 manquantes, img21 facultative, code 2', async () => {
  const dir = path.join(os.tmpdir(), `reception-vide-${process.pid}`);
  const r = await analyseFolder(dir);
  assert.equal(r.summary.missingRequired.length, 57);
  assert.deepEqual(r.summary.missingOptional.sort(), ['F1v', 'img21']);
  assert.equal(r.summary.exitCode, 2);
  const md = renderMarkdown(r);
  assert.equal((md.match(/^- \*\*img\d+[ab]?\*\* .*— manquante/gm) ?? []).length, 51);
});
