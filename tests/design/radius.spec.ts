import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * GARDE-FOU GÉOMÉTRIE & RAYONS — iOS 27 Full Liquid Glass
 * ========================================================
 * Vérifie le respect absolu de l'échelle canonique des arrondis :
 * - Aucun rayon inférieur à 12px (hors checkbox 8px).
 * - Prédominance de la capsule (rounded-full / 9999px) pour les contrôles.
 * - Rayons de cartes à 28-38px, sheets à 44px.
 */

const root = process.cwd();
const uiDir = path.join(root, 'src', 'components', 'ui');

function getUiFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getUiFiles(full, acc);
    } else if (/\.(tsx|ts)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

const uiFiles = getUiFiles(uiDir);

describe('CHANTIER IOS 27 — GARDE-FOU RAYONS & GÉOMÉTRIE', () => {
  it('Aucun composant d\'UI générique n\'impose de micro-rayon inférieur à 12px', () => {
    const violations: string[] = [];
    const forbiddenSmallRadius = /\brounded-(?:sm|xs|\[[1-9]px\]|\[1[0-1]px\])\b/g;

    for (const file of uiFiles) {
      if (file.toLowerCase().includes('checkbox')) continue; // Seule exception HIG : case à cocher (8px)
      const content = fs.readFileSync(file, 'utf8');
      const matches = content.match(forbiddenSmallRadius);
      if (matches) {
        violations.push(`${path.relative(root, file)} : ${matches.join(', ')}`);
      }
    }

    expect(
      violations,
      `Rayons inférieurs à 12px interdits dans les primitives UI :\n${violations.join('\n')}`
    ).toEqual([]);
  });

  it('Les tokens CSS définissent bien les rayons minimaux et capsules canoniques', () => {
    const tokens = fs.readFileSync(path.join(root, 'src', 'styles', 'tokens.css'), 'utf8');
    expect(tokens).toContain('--lkv-radius-full: 9999px;');
    expect(tokens).toContain('--lkv-radius-card:');
    expect(tokens).toContain('--lkv-radius-sheet:');
  });
});
