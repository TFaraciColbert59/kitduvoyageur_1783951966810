import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { LKDV_ICON_NAMES } from '@/components/ui/LKDVIcon';
import { LKDV_ALIASES, isLKDVIconName, normalizeIconName, resolveLKDVIcon } from '@/components/ui/lkdvAliases';

const ROOT = process.cwd();
const ICONS_DIR = path.join(ROOT, 'public', 'icons', 'lkdv');
const GREEN = '#00542B';

describe('Base d’icônes LKDV V2 — unique source de pictogrammes', () => {
  it('ICON-01: 238 clés, chacune servie par un SVG (et aucun SVG hors liste)', () => {
    const files = fs.readdirSync(ICONS_DIR).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)).sort();
    expect(LKDV_ICON_NAMES).toHaveLength(238);
    expect(new Set(LKDV_ICON_NAMES).size).toBe(238);
    expect(files).toEqual([...LKDV_ICON_NAMES].sort());
  });

  it('ICON-02: chaque SVG est un vert unique #00542B, sans dégradé, ombre, opacité ni fond', () => {
    for (const name of LKDV_ICON_NAMES) {
      const svg = fs.readFileSync(path.join(ICONS_DIR, `${name}.svg`), 'utf8');
      const colors = new Set((svg.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map((c) => c.toUpperCase()));
      expect([...colors], name).toEqual([GREEN]);
      expect(svg, name).toContain('fill="none"');
      expect(svg, name).toContain('viewBox="0 0 100 100"');
      expect(svg, name).not.toMatch(/<image|<style|<filter|<mask|<clipPath|(?:linear|radial)Gradient|opacity/i);
    }
  });

  it('ICON-03: l’inventaire CSV fourni correspond aux clés', () => {
    const csv = fs.readFileSync(path.join(ROOT, 'docs/design-system/lkdv-v2/inventaire.csv'), 'utf8');
    const keys = new Set(csv.split(/\r?\n/).slice(1).filter(Boolean).map((l) => l.split(',')[2]));
    expect([...keys].sort()).toEqual([...LKDV_ICON_NAMES].sort());
  });

  it('ICON-04: la table d’alias ne pointe que vers des clés existantes', () => {
    for (const [legacy, key] of Object.entries(LKDV_ALIASES)) expect(isLKDVIconName(key), `${legacy} → ${key}`).toBe(true);
  });

  it('ICON-05: les anciens noms (lucide, Heroicons, kebab) se résolvent vers la base V2', () => {
    expect(resolveLKDVIcon('Users')).toBe('communaute');
    expect(resolveLKDVIcon('MapPinIcon')).toBe('point_interet');
    expect(resolveLKDVIcon('HeartIconSolid')).toBe('favoris');
    expect(resolveLKDVIcon('check-circle2')).toBe('valider');
    expect(resolveLKDVIcon('globe')).toBe('monde');
    expect(resolveLKDVIcon('monde')).toBe('monde');
    expect(resolveLKDVIcon('sac_a_dos')).toBeUndefined();
    expect(resolveLKDVIcon('UnknownForTestingIcon')).toBeUndefined();
    expect(normalizeIconName('RotateCCWIcon')).toBe('rotate-ccw');
  });

  it('ICON-06: aucune autre bibliothèque d’icônes, aucun ancien pack (verify:icons)', () => {
    const out = execFileSync('node', ['scripts/verify/icon-names.mjs'], { cwd: ROOT, encoding: 'utf8' });
    expect(out).toContain('✓ Icônes');
  });

  it('ICON-07: les dépendances d’icônes tierces ont disparu du package', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const forbidden of ['lucide-react', '@heroicons/react', '@phosphor-icons/core', 'react-icons', '@tabler/icons-react']) {
      expect(all[forbidden], forbidden).toBeUndefined();
    }
  });
});
