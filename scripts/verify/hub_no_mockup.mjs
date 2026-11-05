#!/usr/bin/env node
/**
 * ANTI-MOCKUP BUILD GATE (Lot L2-4 / ADR-006)
 * ============================================
 * Casse le build (exit code 1) si un artefact de la maquette vanilla Compte
 * s'infiltre dans src/features/hub ou src/features/kit-studio.
 *
 * Pur Node.js sans dépendance envers ripgrep.
 * Exécution : node scripts/verify/hub_no_mockup.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const TARGET_DIRS = [
  path.join(root, 'src', 'features', 'hub'),
  path.join(root, 'src', 'features', 'kit-studio'),
];

const FORBIDDEN_PATTERNS = [
  { label: 'global window.__lkdv', regex: /__lkdv/ },
  { label: 'maquette COMPTE_V8_HTML', regex: /COMPTE_V8_HTML/ },
  { label: 'simulateur frame .pwrap', regex: /\.pwrap/ },
  { label: 'largeur fixe 390px', regex: /390px/ },
  { label: 'hauteur fixe 844px', regex: /844px/ },
  { label: 'horloge fake 9:41', regex: /["']9:41["']/ },
  { label: 'mock Relief 3D', regex: /Relief 3D/ },
  { label: 'mock GLOBE 3D', regex: /GLOBE 3D/ },
  { label: 'notes maquette aside', regex: /class=["']notes["']/ },
  { label: 'fake followers Instagram', regex: /1\s*080\s*followers/ },
  { label: 'fake suivis Instagram', regex: /339\s*suivi/ },
];

let violations = 0;

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const { label, regex } of FORBIDDEN_PATTERNS) {
      if (regex.test(line)) {
        console.error(
          `✗ [MOCKUP LEAK] ${path.relative(root, filePath)}:${index + 1} ` +
          `contient '${label}' :\n    ${line.trim()}`
        );
        violations++;
      }
    }
  });
}

function scanDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (/\.(tsx?|jsx?|mjs|css|json)$/.test(entry.name)) {
      scanFile(fullPath);
    }
  }
}

console.log('=== VÉRIFICATION ANTI-MAQUETTE HUB & STUDIO (L2-4) ===\n');
for (const dir of TARGET_DIRS) {
  scanDir(dir);
}

if (violations > 0) {
  console.error(`\n✗ ÉCHEC : ${violations} violation(s) de maquette détectée(s) dans le HUB/Studio.`);
  process.exit(1);
}

console.log('✓ SUCCÈS : Aucune contamination de maquette dans src/features/hub ou kit-studio.\n');
process.exit(0);
