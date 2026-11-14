#!/usr/bin/env node
// Une commande pour tout refaire.
//   node tools/audio/build-all.mjs              → exige assets/audio/storm-ii.mp3 : montage réel, raccords réels,
//                                                 sfx-v1.wav calé sur le vrai lit, qa/mix-v1.wav
//   node tools/audio/build-all.mjs --v2         → montage v2 (qa/SON-AUDIT.md), qa/sfx-v2.wav, qa/mix-v2.wav (mix-v1 intact)
//   node tools/audio/build-all.mjs --substitut  → même chaîne sur le lit de SUBSTITUTION (qa/tmp/), qa/mix-v1-SUBSTITUT.wav
// La banque d'effets (assets/audio/sfx/) est versionnée : elle n'est régénérée qu'avec --regen-sfx.
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { HERE, MONTAGE, MONTAGE_V2, MP3, QA_DIR, QA_TMP, SUBST_MONTAGE } from './lib.mjs';

const subst = process.argv.includes('--substitut');
mkdirSync(QA_TMP, { recursive: true });
const step = (label, script, args = []) => {
  console.log(`\n── ${label}`);
  const r = spawnSync('node', [join(HERE, script), ...args], { stdio: 'inherit' });
  if (r.status !== 0) { console.error(`✗ étape « ${label} » en échec (code ${r.status})`); process.exit(r.status || 1); }
};

if (!subst && !existsSync(MP3)) {
  console.error(`✗ MP3 absent : ${MP3}\n  Déposez storm-ii.mp3 (fourni par Tony, jamais téléchargé), puis relancez cette commande.\n  Essai de la chaîne sans la musique : node tools/audio/build-all.mjs --substitut`);
  process.exit(2);
}
if (process.argv.includes('--regen-sfx')) step('Banque d\'effets générés', 'gen-sfx.mjs');
step('Tableau coupe/temps (sans le MP3)', 'cut-beat-table.mjs', ['--json', join(QA_TMP, 'cut-beat.json')]);
if (subst) {
  step('Lit de SUBSTITUTION (faux morceau → vraie commande de montage)', 'make-substitute.mjs');
  step('Raccords (SUBSTITUT)', 'check-joins.mjs', ['--input', SUBST_MONTAGE, '--label', 'SUBSTITUT', '--json', join(QA_TMP, 'joins-SUBSTITUT.json')]);
  step("Piste d'effets", 'build-sfx.mjs', ['--bed', SUBST_MONTAGE]);
  step('Mixage (SUBSTITUT)', 'build-mix.mjs', ['--substitut']);
} else if (process.argv.includes('--v2')) {
  step('Montage musical v2 (qa/SON-AUDIT.md)', 'build-montage.mjs', ['--v2']);
  step("Piste d'effets v2", 'build-sfx.mjs', ['--bed', MONTAGE_V2, '--out', join(QA_DIR, 'sfx-v2.wav'), '--report', join(QA_TMP, 'sfx-placements-v2.json'), '--cues', join(HERE, 'sfx-cues-v2.json')]);
  step('Mixage v2', 'build-mix.mjs', ['--v2']);
} else {
  step('Montage musical réel', 'build-montage.mjs');
  step('Raccords (RÉEL)', 'check-joins.mjs', ['--input', MONTAGE, '--label', 'REEL', '--json', join(QA_TMP, 'joins-REEL.json')]);
  step("Piste d'effets", 'build-sfx.mjs', ['--bed', MONTAGE]);
  step('Mixage (RÉEL)', 'build-mix.mjs');
}
console.log(`\n✓ Terminé. Rapports chiffrés dans ${QA_TMP} ; mixage dans ${QA_DIR}. Mesuré, non écouté.`);
