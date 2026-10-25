import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
  resolveMaskFile,
  resolvePackFile,
  PNG_ICON_MAP,
  SVG_MASK_ICON_NAMES,
} from '@/components/ui/Icon/registry';
import { HERO_OUTLINE, HERO_SOLID } from '@/components/ui/Icon/heroicons.generated';

const REPO_ROOT = process.cwd();
const ICONS_DIR = path.join(REPO_ROOT, 'public', 'icons');
const SRC_DIR = path.join(REPO_ROOT, 'src');

/**
 * Noms « Heroicons » que le code **et** les données Supabase (badges
 * `badge_id` -> `iconMap` de `queries-compte.ts`) demandent, mais qui
 * n'existent pas dans `@heroicons/react`. Sans alias elles retombaient
 * sur le placeholder ✦. Régression à verrouiller.
 */
const DATA_DRIVEN_LEGACY_NAMES = ['GlobeIcon', 'LeafIcon', 'LockIcon', 'MountainIcon'] as const;

function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listSourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Noms passés statiquement à `<Icon name="..." />` dans tout `src/`. */
function collectUsedIconNames(): Set<string> {
  const names = new Set<string>();
  const pattern = /\bname=(?:"([A-Za-z][A-Za-z0-9]*)"|'([A-Za-z][A-Za-z0-9]*)'|\{"([A-Za-z][A-Za-z0-9]*)"\})/g;
  for (const file of listSourceFiles(SRC_DIR)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(pattern)) {
      const name = match[1] ?? match[2] ?? match[3];
      if (name && /(Icon|IconSolid|SolidIcon)$/.test(name)) names.add(name);
    }
  }
  return names;
}

/** Même logique de suffixe que `Icon.tsx` : `HeartIconSolid` -> `HeartIcon`. */
function stripSolidSuffix(name: string): string {
  return name.replace(/IconSolid$/, 'Icon').replace(/SolidIcon$/, 'Icon');
}

describe('Design system — résolution des glyphes (P5)', () => {
  let usedNames: Set<string>;
  let realHeroicons: Record<string, unknown> | null = null;

  beforeAll(async () => {
    usedNames = collectUsedIconNames();
    // Import différé : vérifie que le pack généré ne cible que des exports
    // réellement fournis par `@heroicons/react` (pas d'import fantôme).
    realHeroicons = (await import('@heroicons/react/24/outline')) as Record<string, unknown>;
  });

  it('TEST-ICON-RESOLVE-01: les noms pilotés par les données base résolvent vers un glyphe SF', () => {
    const expected: Record<string, string> = {
      GlobeIcon: 'globe',
      LeafIcon: 'leaf',
      LockIcon: 'lock',
      MountainIcon: 'mountain',
    };
    for (const name of DATA_DRIVEN_LEGACY_NAMES) {
      expect(resolveMaskFile(name), `${name} doit résoudre vers un masque`).toBe(`sf/${expected[name]}.svg`);
    }
  });

  it('TEST-ICON-RESOLVE-02: chaque fichier cible des alias existe sur le disque', () => {
    for (const name of DATA_DRIVEN_LEGACY_NAMES) {
      const mask = resolveMaskFile(name) as string;
      expect(SVG_MASK_ICON_NAMES.has(mask.replace('sf/', '').replace('.svg', ''))).toBe(true);
      expect(fs.existsSync(path.join(ICONS_DIR, mask)), `${mask} absent de public/icons`).toBe(true);
    }
  });

  it('TEST-ICON-RESOLVE-03: le pack PNG garde la priorité sur le pack SVG', () => {
    expect(resolvePackFile('HomeIcon')).toBe('Home.png');
    expect(resolveMaskFile('HomeIcon')).toBe('Home.png');
    expect(resolvePackFile('ChevronDownIcon')).toBe('V Arrow Down.png');
    // le suffixe implicite fonctionne aussi
    expect(resolvePackFile('Home')).toBe('Home.png');
  });

  it('TEST-ICON-RESOLVE-04: les tokens kebab SF résolvent, outline et solid', () => {
    expect(resolveMaskFile('compass')).toBe('sf/compass.svg');
    expect(resolveMaskFile('compass', 'solid')).toBe('sf/compass.svg');
    expect(resolveMaskFile('inconnu-xyz')).toBeUndefined();
  });

  it('TEST-ICON-RESOLVE-05: toutes les entrées du pack PNG pointent un fichier existant', () => {
    const missing = Object.entries(PNG_ICON_MAP)
      .filter(([, file]) => !fs.existsSync(path.join(ICONS_DIR, file)))
      .map(([name, file]) => `${name} -> ${file}`);
    expect(missing).toEqual([]);
  });

  it('TEST-ICON-RESOLVE-06: aucun nom d\'icône utilisé dans src/ ne tombe sur le placeholder', () => {
    expect(usedNames.size).toBeGreaterThan(50);
    const unresolved = [...usedNames]
      .filter((name) => {
        const mask = resolveMaskFile(name, 'outline') ?? resolveMaskFile(name, 'solid');
        const base = stripSolidSuffix(name);
        const hero = HERO_OUTLINE[name] ?? HERO_SOLID[name] ?? HERO_OUTLINE[base] ?? HERO_SOLID[base];
        return !mask && !hero;
      })
      .sort();
    expect(unresolved).toEqual([]);
  });

  it('TEST-ICON-RESOLVE-07: la table Heroicons générée reste élaguée (garde-fou anti-régression bundle)', () => {
    const outlineKeys = Object.keys(HERO_OUTLINE);
    const solidKeys = Object.keys(HERO_SOLID);
    expect(outlineKeys.length).toBeGreaterThan(0);
    // 650 modules / 71,7 Ko gzip ont été remplacés par ~42 modules / 20,1 Ko.
    expect(outlineKeys.length).toBeLessThanOrEqual(64);
    expect(solidKeys.sort()).toEqual(outlineKeys.sort());
  });

  it('TEST-ICON-RESOLVE-08: la table générée ne contient que des exports Heroicons réels', () => {
    expect(realHeroicons).not.toBeNull();
    const unknown = Object.keys(HERO_OUTLINE).filter((key) => !(key in (realHeroicons as object)));
    expect(unknown).toEqual([]);
  });

  it('TEST-ICON-RESOLVE-09: la table générée couvre tous les Heroicons utilisés dans src/', () => {
    const needed = [...usedNames]
      .filter((name) => name in (realHeroicons as object) || stripSolidSuffix(name) in (realHeroicons as object))
      .filter((name) => !resolveMaskFile(name, 'outline') && !resolveMaskFile(name, 'solid'));
    const missing = needed.filter((name) => {
      const base = stripSolidSuffix(name);
      return !HERO_OUTLINE[name] && !HERO_SOLID[name] && !HERO_OUTLINE[base] && !HERO_SOLID[base];
    });
    expect(missing).toEqual([]);
  });
});