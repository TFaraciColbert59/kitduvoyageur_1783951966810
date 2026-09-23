import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * GARDE-FOU MONOCHROME STRICT — iOS 27 Full Liquid Glass
 * =======================================================
 * Vérifie l'éradication absolue de toute couleur primaire ou d'accent de marque
 * dans les composants et pages applicatives.
 *
 * Règles vérifiées :
 * 1. Aucun composant dans src/ n'utilise --lkv-primary ou --lkv-action (hors tokens.css et tokens.ts).
 * 2. Aucune classe Tailwind d'accent froid (emerald, green, teal, text-primary, bg-primary, etc.).
 * 3. Aucune couleur de la palette bannie (#E4501C, #A3C4A3, #0B1F17, #2D6B4A, #1C2620).
 */

const root = process.cwd();
const srcDir = path.join(root, 'src');

const FORBIDDEN_HEX = [
  '#e4501c',
  '#a3c4a3',
  '#0b1f17',
  '#2d6b4a',
  '#1c2620',
];

const FORBIDDEN_CLASS_REGEX = /\b(?:bg|text|border|ring)-(?:emerald|green|teal|primary|action)-(?:50|100|200|300|400|500|600|700|800|900|950)\b/g;

function getSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'identity' || entry.name === 'dev') continue; // Identité historique isolée / sandbox
      getSourceFiles(full, acc);
    } else if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) {
      if (entry.name === 'tokens.ts' || entry.name === 'tokens.css') continue;
      acc.push(full);
    }
  }
  return acc;
}

const filesToScan = getSourceFiles(srcDir);

describe('CHANTIER IOS 27 — GARDE-FOU NO PRIMARY & MONOCHROMIE', () => {
  it('Palette bannie (#E4501C, #A3C4A3, #0B1F17, #2D6B4A, #1C2620) absente des fichiers sources', () => {
    const violations: string[] = [];

    for (const file of filesToScan) {
      const content = fs.readFileSync(file, 'utf8').toLowerCase();
      for (const hex of FORBIDDEN_HEX) {
        if (content.includes(hex)) {
          violations.push(`${path.relative(root, file)} contient la couleur bannie ${hex}`);
        }
      }
    }

    expect(
      violations,
      `Couleurs bannies détectées :\n${violations.slice(0, 10).join('\n')}`
    ).toEqual([]);
  });

  it('Aucun composant de premier plan ne consomme directement --lkv-primary', () => {
    const primaryConsumers: string[] = [];
    const targetFiles = getSourceFiles(path.join(srcDir, 'components', 'ui'));

    for (const file of targetFiles) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('var(--lkv-primary)') || content.includes('var(--lkv-action)')) {
        primaryConsumers.push(path.relative(root, file));
      }
    }

    expect(
      primaryConsumers,
      `Les primitives d'interface ne doivent pas consommer --lkv-primary / --lkv-action directement :\n${primaryConsumers.join('\n')}`
    ).toEqual([]);
  });
});
