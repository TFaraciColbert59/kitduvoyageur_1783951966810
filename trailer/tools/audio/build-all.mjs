#!/usr/bin/env node
// Une commande pour tout refaire.
//   node tools/audio/build-all.mjs              → exige assets/audio/storm-ii.mp3 : montage réel, raccords réels,
//                                                 sfx-v1.wav calé sur le vrai lit, qa/mix-v1.wav
//   node tools/audio/build-all.mjs --v2         → montage v2 (qa/SON-AUDIT.md), qa/sfx-v2.wav, qa/mix-v2.wav (mix-v1 intact)
//   node tools/audio/build-all.mjs --v3         → montage v3 (qa/MUSIQUE-V3.md), musique seule : qa/mix-v3.wav, qa/mix-v3.beats.json,
//                                                 contrôles et planches (qa/tmp/audit-v3.json, qa/snapshots/musique-v3/) ; --no-audit pour sauter les contrôles
//   node tools/audio/build-all.mjs --v4         → montage v4 (qa/MUSIQUE-V4.md) + habillage (3 sons) : qa/mix-v4.wav, qa/mix-v4-musique.wav,
//                                                 qa/mix-v4-habillage.wav, qa/mix-v4.beats.json, contrôles et planches (musique-v4/) ; --no-audit
//   node tools/audio/build-all.mjs --v5         → effets v5 (qa/SON-V5.md) sur la musique et l'habillage v4 : qa/mix-v5.wav, qa/mix-v5-musique.wav,
//                                                 qa/mix-v5-habillage.wav, qa/mix-v5-effets.wav, essais AAC, planches (son-v5/) ; --no-audit
//                                                 Films : node tools/audio/mux-ours-v5.mjs
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
} else if (process.argv.includes('--v5')) {
  step('Banque v5 : sons générés (graines fixes) et dérivés des prises Kenney', 'gen-sfx.mjs', ['--v5']);
  step('Habillage v4 : sons générés', 'gen-sfx.mjs', ['souffle-cosmos', 'impact-soleil', 'impact-logo']);
  step('Montage musical v4 (inchangé)', 'build-montage.mjs', ['--v4']);
  step('Piste d\'habillage v4 (inchangée)', 'build-habillage-v4.mjs');
  step('Piste d\'effets v5 (tools/audio/sfx-cues-v5.json, gains figés)', 'build-sfx-v5.mjs');
  step('Mastering v5 (−14 LUFS, musique + habillage + effets, pistes séparées, essais AAC)', 'build-mix.mjs', ['--v5']);
  if (!process.argv.includes('--no-audit')) {
    console.log('\n── Planches v5 (python3 + numpy + Pillow)');
    const r = spawnSync('python3', [join(HERE, 'planche-v5.py')], { stdio: ['ignore', 'inherit', 'inherit'] });
    if (r.status !== 0) { console.error('✗ planche-v5.py en échec'); process.exit(r.status || 1); }
  }
} else if (process.argv.includes('--v4')) {
  step('Habillage v4 : sons générés (banque versionnée, graines fixes)', 'gen-sfx.mjs', ['souffle-cosmos', 'impact-soleil', 'impact-logo']);
  step('Montage musical v4 (qa/MUSIQUE-V4.md)', 'build-montage.mjs', ['--v4']);
  step('Piste d\'habillage v4', 'build-habillage-v4.mjs');
  step('Mastering v4 (−14 LUFS, musique + habillage, pistes séparées)', 'build-mix.mjs', ['--v4']);
  step('Grille v4 (qa/mix-v4.beats.json)', 'beats-v4.mjs');
  if (!process.argv.includes('--no-audit')) {
    console.log('\n── Contrôles et planches v4 (python3 + numpy + Pillow)');
    const r = spawnSync('python3', [join(HERE, 'audit-v3.py'), '--v4'], { stdio: ['ignore', 'ignore', 'inherit'] });
    if (r.status !== 0) { console.error('✗ audit-v3.py --v4 en échec'); process.exit(r.status || 1); }
    console.log('✓ qa/tmp/audit-v4.json, qa/snapshots/musique-v4/, champs « mesures » et « intro » de qa/mix-v4.beats.json');
  }
} else if (process.argv.includes('--v3')) {
  step('Montage musical v3 (qa/MUSIQUE-V3.md)', 'build-montage.mjs', ['--v3']);
  step('Mastering v3 (−14 LUFS, sans effet)', 'build-mix.mjs', ['--v3']);
  step('Grille v3 (qa/mix-v3.beats.json)', 'beats-v3.mjs');
  if (!process.argv.includes('--no-audit')) {
    console.log('\n── Contrôles et planches v3 (python3 + numpy + Pillow)');
    const r = spawnSync('python3', [join(HERE, 'audit-v3.py')], { stdio: ['ignore', 'ignore', 'inherit'] });
    if (r.status !== 0) { console.error('✗ audit-v3.py en échec'); process.exit(r.status || 1); }
    console.log('✓ qa/tmp/audit-v3.json, qa/snapshots/musique-v3/, champ « mesures » de qa/mix-v3.beats.json');
  }
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
