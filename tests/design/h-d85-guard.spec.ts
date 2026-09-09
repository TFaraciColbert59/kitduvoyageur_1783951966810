import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * H1.3 — GARDE-FOU H-D85 (extension de Y-D80 au périmètre hub).
 *
 * Périmètre : tout fichier .ts/.tsx sous
 *   src/features/hub/**, src/app/hub/**, src/components/mobile-nav/**
 * 14 règles ; chaque violation reportée fichier:ligne:extrait.
 *
 * Règles 1-12 = Y-D80 reprises. R2 : l'allowlist = #fff/#000 + les hexes de
 * src/styles/tokens.css et tailwind.config.js (H-AUTO-8 : tokens.css est la
 * source unique de vérité des valeurs brutes — tout autre hex est une dérive).
 * Règle 13 : une seule source de sections (aucun littéral /hub/ hors registre).
 * Règle 14 : toute nature de section passe par le registre (aucun littéral de
 * segment/id hub hors moteur, registre, tests et garde-fou).
 *
 * Dette legacy documentée : RULE_EXEMPTIONS (composants terrain pré-D1,
 * burn-down obligatoire en H3/H5 lors de l'absorption dans le HubShell).
 */

interface Violation {
  file: string;
  line: number;
  extract: string;
  rule: string;
}

const ROOT = process.cwd();
const SCOPE_DIRS = ['src/features/hub', 'src/app/hub', 'src/components/mobile-nav'];

/** Hexes canoniques = valeurs brutes déclarées dans tokens.css + tailwind.config.js. */
function canonicalHex(): Set<string> {
  const found = new Set(['#ffffff', '#fff', '#000000', '#000']);
  for (const f of ['src/styles/tokens.css', 'tailwind.config.js']) {
    const full = path.join(ROOT, f);
    if (!fs.existsSync(full)) continue;
    const content = fs.readFileSync(full, 'utf8');
    for (const m of content.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      found.add(m[0].toLowerCase());
    }
  }
  return found;
}

const ALLOWLIST_HEX = canonicalHex();

/** Dette documentée par règle — chaque entrée = fichiers à assainir à la phase
 *  indiquée (burn-down obligatoire, jamais d'ajout sans entrée H_DECISIONS).
 *  R5/R8 n'ont PAS d'exemption : leurs faux positifs sont corrigés dans le
 *  garde-fou lui-même (cause racine, H1.3). */
const RULE_EXEMPTIONS: Record<string, { files: string[]; burnDown: string }> = {
  // Composants terrain pré-D1 — BURNÉ H5-commit3 (tous supprimés, absorption D1 soldée).
  R1: {
    files: [],
    burnDown: 'soldé H5 (suppression vues legacy)',
  },
  // BURNÉ H5-commit3 : vues legacy supprimées (voir ci-dessus).
  R2hub: {
    files: [],
    burnDown: 'soldé H5 (suppression vues legacy)',
  },
  // Shell mobile-nav (hex hors tokens) — H5/H6.
  // BottomTabBar BURNÉ H5-commit1 (#5C6B5E → var).
  R2nav: {
    files: [
      'src/components/mobile-nav/CopilotFAB.tsx',
      'src/components/mobile-nav/InstallPrompt.tsx',
      'src/components/mobile-nav/MobileDrawer.tsx',
      'src/components/mobile-nav/MobileHomeRedirect.tsx',
      'src/components/mobile-nav/MobileProfilePage.tsx',
      'src/components/mobile-nav/NaviguerButton.tsx',
    ],
    burnDown: 'H5 (refonte BottomTabBar + délestage sheets) / H6 (coquille mobile)',
  },
  // matchPaths littéraux du tab bar actuel — H5.
  // BURNÉ H5-commit2 : plus aucun littéral /voyages/ dans BottomTabBar.
  R11: {
    files: [],
    burnDown: 'soldé H5 (délestage upper extensions)',
  },
};

function exempted(rule: string, file: string): boolean {
  const direct = RULE_EXEMPTIONS[rule];
  if (direct && direct.files.map(norm).includes(norm(file))) return true;
  if (rule === 'R2') {
    for (const key of ['R2hub', 'R2nav']) {
      if (RULE_EXEMPTIONS[key].files.map(norm).includes(norm(file))) return true;
    }
  }
  return false;
}

/** Fichiers autorisés à écrire des littéraux /hub/ (règle 13). */
const RULE13_ALLOWLIST = [
  'src/features/hub/registry/hubSectionRegistry.ts',
  // H-AUTO-41 : isHubSurfacePathname teste la RACINE /hub (entrée du hub,
  // pas une URL de section) pour décider si le switcher est monté.
  'src/features/hub/context/adventureLists.ts',
];

/** Fichiers autorisés à nommer des segments/ids hub en littéral (règle 14). */
const RULE14_ALLOWLIST = [
  'src/features/hub/engine/hubProfileEngine.ts',
  'src/features/hub/registry/hubSectionRegistry.ts',
  'src/features/hub/registry/hubWidgetRegistry.ts',
  // Catalogue central des widgets du hub universel (registre de même niveau).
  'src/features/hub/registry/widgetCatalog.ts',
  // Couche logique pure du sélecteur (fallbacks typés HubSectionId, testés) — même niveau que le moteur.
  'src/features/hub/context/adventureLists.ts',
  // Présentation des widgets (mapping widget→section via hubSectionHref typé, zéro littéral d'URL — R13 intacte).
  'src/features/hub/components/HubWidgets.tsx',
  // Dispatcher de route /hub/[section] (mapping id→composant centralisé et typé — l'unique endroit sanctionné).
  'src/app/hub/[section]/page.tsx',
  // Cartes du MENU hub (mapping carte→section via hubSectionHref typé, zéro littéral d'URL — R13 intacte).
  'src/features/hub/components/menu/CollectifMenu.tsx',
  'src/features/hub/components/menu/PossessionMenu.tsx',
  'tests/design/h-d85-guard.spec.ts',
];

/** Segments/ids propriétaires du hub (ni voyage, ni génériques). */
const HUB_LITERALS = [
  'inventaire',
  'disponibilite',
  'voyages-lies',
  'invitations-apercu',
  'presence-groupe',
  'entrer-voyage',
  'stock-apercu',
  'alertes-materiel',
  'dispo-apercu',
  'prochain-depart',
];

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

function scanLine(regex: RegExp, file: string, content: string, rule: string, out: Violation[]): void {
  const lines = content.split(/\r?\n/);
  const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
  for (let i = 0; i < lines.length; i++) {
    const rx = new RegExp(regex.source, flags);
    const matches = Array.from(lines[i].matchAll(rx));
    for (const _m of matches) {
      out.push({ file, line: i + 1, extract: lines[i].trim().slice(0, 140), rule });
    }
  }
}

function scanAll(rule: string, regex: RegExp, out: Violation[]): void {
  for (const dir of SCOPE_DIRS) {
    walk(dir, (content, file) => {
      if (exempted(rule, file)) return;
      scanLine(regex, file, content, rule, out);
    });
  }
}

function fmt(violations: Violation[]): string {
  return (
    violations
      .slice(0, 40)
      .map((v) => `${v.rule} ${v.file}:${v.line} → ${v.extract}`)
      .join('\n') + (violations.length > 40 ? `\n… +${violations.length - 40} autres` : '')
  );
}

describe('GARDE-FOU H-D85 — module hub (14 règles)', () => {
  it('Règle 1 : 0 classe froide (zinc, gray, slate, amber, emerald, blue, red, orange)', () => {
    const v: Violation[] = [];
    scanAll('R1', /\b(?:bg|text|border|ring|stroke|fill|from|via|to|hover:bg|hover:text|divide)-(?:zinc|gray|slate|amber|emerald|blue|red|orange)-\d+/g, v);
    expect(v, `Violations classes froides :\n${fmt(v)}`).toEqual([]);
  });

  it('Règle 2 : 0 hexadécimal brut hors tokens canoniques (tokens.css + tailwind.config)', () => {
    const v: Violation[] = [];
    for (const dir of SCOPE_DIRS) {
      walk(dir, (content, file) => {
        if (exempted('R2', file)) return;
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const hexMatches = Array.from(lines[i].matchAll(/#[0-9a-fA-F]{3,8}\b/g));
          for (const m of hexMatches) {
            if (!ALLOWLIST_HEX.has(m[0].toLowerCase())) {
              v.push({ file, line: i + 1, extract: lines[i].trim().slice(0, 140), rule: 'R2' });
            }
          }
        }
      });
    }
    expect(v, `Violations hex brutes :\n${fmt(v)}`).toEqual([]);
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

  it('Règle 5 : 0 dialogue natif (alert, confirm, prompt) — hors API PWA deferredPrompt', () => {
    const v: Violation[] = [];
    for (const dir of SCOPE_DIRS) {
      walk(dir, (content, file) => {
        if (exempted('R5', file)) return;
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          // L'API PWA beforeinstallprompt (deferredPrompt.prompt()) n'est pas un dialogue natif.
          if (lines[i].includes('deferredPrompt.prompt(')) continue;
          const rx = /\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/g;
          for (const _m of Array.from(lines[i].matchAll(rx))) {
            v.push({ file, line: i + 1, extract: lines[i].trim().slice(0, 140), rule: 'R5' });
          }
        }
      });
    }
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

  it('Règle 8 : statut réseau unique — source unique dans le hub (commentaires ignorés)', () => {
    const v: Violation[] = [];
    const allowed = ['src/features/hub/stores/useHubStore.ts'];
    for (const dir of SCOPE_DIRS) {
      walk(dir, (content, file) => {
        if (exempted('R8', file)) return;
        if (allowed.map(norm).includes(norm(file))) return;
        // Les commentaires ne sont pas du code (ex. doc de OfflineBanner).
        const code = content
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/(^|\s)\/\/.*$/gm, '$1');
        if (/navigator\.onLine|@capacitor\/network/.test(code)) {
          const lines = code.split(/\r?\n/);
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
        if (exempted('R9', file)) return;
        const count = (content.match(/<h1[\s>]/g) ?? []).length;
        if (count > 1) {
          v.push({ file, line: 0, extract: `${count} occurrences <h1`, rule: 'R9' });
        }
      });
    }
    expect(v, `Violations h1 multiples :\n${fmt(v)}`).toEqual([]);
  });

  it('Règle 10 : pas de <aside hors du layout et des sidebars canoniques du hub', () => {
    const v: Violation[] = [];
    const allowedAside = [
      'src/features/hub/components/HubSidebarLeft.tsx',
      'src/features/hub/components/HubSidebarRight.tsx',
    ];
    walk('src/app/hub', (content, file) => {
      if (norm(file).endsWith('layout.tsx')) return;
      if (/<aside[\s>]/.test(content)) {
        v.push({ file, line: 0, extract: '<aside hors layout.tsx', rule: 'R10' });
      }
    });
    walk('src/features/hub', (content, file) => {
      if (exempted('R10', file)) return;
      if (allowedAside.map(norm).includes(norm(file))) return;
      if (/<aside[\s>]/.test(content)) {
        v.push({ file, line: 0, extract: '<aside hors sidebars canoniques', rule: 'R10' });
      }
    });
    expect(v, `Violations aside :\n${fmt(v)}`).toEqual([]);
  });

  it('Règle 11 : 0 route /voyages/<x> en littéral hors registre voyage', () => {
    const v: Violation[] = [];
    for (const dir of SCOPE_DIRS) {
      walk(dir, (content, file) => {
        if (exempted('R11', file)) return;
        if (norm(file) === 'src/features/hub/registry/hubSectionRegistry.ts') return;
        scanLine(/['"`]\/voyages\/[^'"`]*['"`]/, file, content, 'R11', v);
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

  it('Règle 13 : une seule source de sections — 0 littéral /hub/ hors registre', () => {
    const v: Violation[] = [];
    for (const dir of SCOPE_DIRS) {
      walk(dir, (content, file) => {
        if (exempted('R13', file)) return;
        if (RULE13_ALLOWLIST.map(norm).includes(norm(file))) return;
        if (/tests?\//.test(norm(file))) return;
        scanLine(/['"`]\/hub\/[^'"`]*['"`]/, file, content, 'R13', v);
      });
    }
    expect(v, `Violations source unique sections :\n${fmt(v)}`).toEqual([]);
  });

  it('Règle 14 : toute nature de section passe par le registre — 0 littéral de segment/id hub hors moteur, registre, tests', () => {
    const v: Violation[] = [];
    const literalRx = new RegExp(`['"\`](${HUB_LITERALS.join('|')})['"\`]`, 'g');
    for (const dir of SCOPE_DIRS) {
      walk(dir, (content, file) => {
        if (exempted('R14', file)) return;
        if (RULE14_ALLOWLIST.map(norm).includes(norm(file))) return;
        if (/tests?\//.test(norm(file))) return;
        scanLine(literalRx, file, content, 'R14', v);
      });
    }
    expect(v, `Violations registre obligatoire :\n${fmt(v)}`).toEqual([]);
  });
});
