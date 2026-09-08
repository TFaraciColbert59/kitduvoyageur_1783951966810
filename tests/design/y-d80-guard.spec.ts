import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Y1.5 — GARDE-FOU Y-D80 (extension de X-D70 au chantier Y).
 *
 * Périmètre : tout fichier .ts/.tsx sous
 *   src/features/trips/**, src/app/voyages/**, src/app/groupes/**,
 *   src/app/ai-configurator/**
 * 12 règles ; chaque violation reportée fichier:ligne:extrait.
 *
 * Règles 1-7 = X-D70 reprises. Règles 8-12 = ajoutées (unification.md §5.2).
 * Ce test est ROUGE à sa création (violations connues inventoriées dans
 * docs/Y_VIOLATIONS.md, corrigées en Y3.5) puis devient la porte G3 du chantier.
 */

interface Violation {
  file: string;
  line: number;
  extract: string;
  rule: string;
}

const ROOT = process.cwd();
const SCOPE_DIRS = [
  'src/features/trips',
  'src/app/voyages',
  'src/app/groupes',
  'src/app/ai-configurator',
];

const ALLOWLIST_HEX = new Set(['#ffffff', '#fff', '#000000', '#000']);

/** Fichiers autorisés à contenir des littéraux /voyages/... (rule 11). */
const RULE11_ALLOWLIST = [
  'src/features/trips/registry/tripSectionRegistry.ts',
  'src/features/trips/registry/tripPaths.ts',
];

/** Normalise un chemin relatif en séparateurs '/' (indépendant de l'OS). */
function norm(file: string): string {
  return file.split('\\').join('/');
}

function collectFiles(dir: string, acc: string[] = []): string[] {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return acc;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(p, acc);
    else if (/\.(ts|tsx)$/.test(entry.name)) acc.push(p);
  }
  return acc;
}

function walk(dir: string, visit: (content: string, file: string) => void): void {
  for (const file of collectFiles(dir)) {
    visit(fs.readFileSync(path.join(ROOT, file), 'utf8'), file);
  }
}

/** Exécute un regex par ligne et collecte les violations. */
function scanLine(regex: RegExp, file: string, content: string, rule: string, out: Violation[]): void {
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(regex);
    if (m) {
      out.push({ file, line: i + 1, extract: lines[i].trim().slice(0, 140), rule });
    }
  }
}

function scanAll(rule: string, regex: RegExp, out: Violation[]): void {
  for (const dir of SCOPE_DIRS) {
    walk(dir, (content, file) => scanLine(regex, file, content, rule, out));
  }
}

function fmt(violations: Violation[]): string {
  return violations
    .slice(0, 40)
    .map((v) => `${v.rule} ${v.file}:${v.line} → ${v.extract}`)
    .join('\n') + (violations.length > 40 ? `\n… +${violations.length - 40} autres` : '');
}

describe('GARDE-FOU Y-D80 — module voyage (12 règles)', () => {
  it('Règle 1 : 0 classe froide (zinc, gray, slate, amber, emerald, blue, red, orange)', () => {
    const v: Violation[] = [];
    scanAll('R1', /\b(?:bg|text|border|ring|stroke|fill|from|via|to|hover:bg|hover:text|divide)-(?:zinc|gray|slate|amber|emerald|blue|red|orange)-\d+/g, v);
    expect(v, `Violations classes froides :\n${fmt(v)}`).toEqual([]);
  });

  it('Règle 2 : 0 hexadécimal brut hors blanc/noir pur', () => {
    const v: Violation[] = [];
    scanAll('R2', /#[0-9a-fA-F]{3,8}\b/g, v);
    const bad = v.filter((x) => {
      const hex = x.extract.match(/#[0-9a-fA-F]{3,8}\b/)?.[0]?.toLowerCase() ?? '';
      return !ALLOWLIST_HEX.has(hex);
    });
    expect(bad, `Violations hex brutes :\n${fmt(bad)}`).toEqual([]);
  });

  it('Règle 3 : 0 rayon arbitraire rounded-[Npx]', () => {
    const v: Violation[] = [];
    scanAll('R3', /\brounded-\[\d+px\]/g, v);
    expect(v, `Violations rounded-[Npx] :\n${fmt(v)}`).toEqual([]);
  });

  it('Règle 4 : 0 ombre littérale shadow-[...]', () => {
    const v: Violation[] = [];
    scanAll('R4', /\bshadow-\[[^\]]+\]/g, v);
    expect(v, `Violations shadow-[…] :\n${fmt(v)}`).toEqual([]);
  });

  it('Règle 5 : 0 dialogue natif (alert, confirm, prompt)', () => {
    const v: Violation[] = [];
    scanAll('R5', /\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/g, v);
    expect(v, `Violations dialogues natifs :\n${fmt(v)}`).toEqual([]);
  });

  it('Règle 6 : 0 cible tactile arbitraire < 44px (min-h/min-w)', () => {
    const v: Violation[] = [];
    scanAll('R6', /\bmin-[hw]-\[(?:[0-3]?\d|4[0-3])px\]/g, v);
    expect(v, `Violations cibles < 44px :\n${fmt(v)}`).toEqual([]);
  });

  it('Règle 7 : 0 contrôle natif (<select>/<input>) sans className', () => {
    const v: Violation[] = [];
    scanAll('R7', /<(?:select|input)(?![^>]*className=)[^>]*>/g, v);
    expect(v, `Violations contrôles non stylés :\n${fmt(v)}`).toEqual([]);
  });

  it('Règle 8 : statut réseau unique — navigator.onLine / @capacitor/network seulement dans TripNetworkStatus', () => {
    const v: Violation[] = [];
    const allowed = [
      'src/features/trips/components/TripNetworkStatus.tsx',
      'src/features/trips/offline/networkStatus.ts',
      'src/hooks/useOnlineStatus.ts',
    ];
    for (const dir of SCOPE_DIRS) {
      walk(dir, (content, file) => {
        if (allowed.map(norm).includes(norm(file))) return;
        if (/navigator\.onLine|@capacitor\/network/.test(content)) {
          const lines = content.split(/\r?\n/);
          lines.forEach((l, i) => {
            if (/navigator\.onLine|@capacitor\/network/.test(l)) {
              v.push({ file, line: i + 1, extract: l.trim().slice(0, 140), rule: 'R8' });
            }
          });
        }
      });
    }
    expect(v, `Violations statut réseau multiple :\n${fmt(v)}`).toEqual([]);
  });

  it('Règle 9 : au plus un <h1 par fichier de page ou de section', () => {
    const v: Violation[] = [];
    for (const dir of SCOPE_DIRS) {
      walk(dir, (content, file) => {
        const count = (content.match(/<h1[\s>]/g) ?? []).length;
        if (count > 1) {
          v.push({ file, line: 0, extract: `${count} occurrences <h1`, rule: 'R9' });
        }
      });
    }
    expect(v, `Violations h1 multiples :\n${fmt(v)}`).toEqual([]);
  });

  it('Règle 10 : pas de <aside hors du layout et des deux sidebars canoniques', () => {
    const v: Violation[] = [];
    const allowedAside = [
      'src/features/trips/components/TripSidebarLeft.tsx',
      'src/features/trips/components/TripSidebarRight.tsx',
    ];
    walk('src/app/voyages', (content, file) => {
      if (norm(file).endsWith('layout.tsx')) return;
      if (/<aside[\s>]/.test(content)) {
        v.push({ file, line: 0, extract: '<aside hors layout.tsx', rule: 'R10' });
      }
    });
    walk('src/features/trips', (content, file) => {
      if (allowedAside.map(norm).includes(norm(file))) return;
      if (/<aside[\s>]/.test(content)) {
        v.push({ file, line: 0, extract: '<aside hors sidebars canoniques', rule: 'R10' });
      }
    });
    expect(v, `Violations aside :\n${fmt(v)}`).toEqual([]);
  });

  it('Règle 11 : 0 route /voyages/<x> en littéral hors registre (constructeur typé obligatoire)', () => {
    const v: Violation[] = [];
    for (const dir of SCOPE_DIRS) {
      walk(dir, (content, file) => {
        if (RULE11_ALLOWLIST.includes(norm(file))) return;
        scanLine(/['"`]\/voyages\/[^'"`]*['"`]/, file, content, 'R11', v);
        // template literals construisant un lien section sans passer par le registre
        scanLine(/`\/voyages\/\$\{[^}]+\}\/(?!gpx)[a-z]+/, file, content, 'R11', v);
      });
    }
    expect(v, `Violations routes littérales :\n${fmt(v)}`).toEqual([]);
  });

  it('Règle 12 : 0 window.print (export via action dédiée)', () => {
    const v: Violation[] = [];
    scanAll('R12', /window\.print\s*\(/g, v);
    expect(v, `Violations window.print :\n${fmt(v)}`).toEqual([]);
  });
});
