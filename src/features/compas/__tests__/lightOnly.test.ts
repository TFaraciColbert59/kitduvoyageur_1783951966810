import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * Lot Z4, PLAN-100 phase 9 — le Compas est clair uniquement.
 *
 * `/compas` force le thème clair (script d'initialisation du layout, puis
 * `CompasLightTheme`) : une règle `.dark …` ou `[data-theme='dark'] …` de
 * `compas.css` ne peut donc jamais s'appliquer. Ce verrou empêche qu'elle
 * revienne en code mort, et garde la preuve que le thème clair est bien forcé.
 */

const read = (rel: string) => readFileSync(join(__dirname, '..', '..', '..', '..', rel), 'utf8');
const CSS = read('src/features/compas/compas.css').replace(/\/\*[\s\S]*?\*\//g, ' ');

describe('Compas : thème clair uniquement', () => {
  it('compas.css ne contient aucune règle réservée au thème sombre', () => {
    // `.dark .x` et `[data-theme='dark'] .x` (ancêtre sombre) : jamais atteignables.
    expect(CSS).not.toMatch(/(^|[\s,{}])\.dark(\s|\.|\[|:|,)/);
    expect(CSS).not.toMatch(/\[data-theme=['"]dark['"]\](?!\))/);
  });

  it('seules les gardes « pas sombre » du verre de la barre d’onglets subsistent', () => {
    // `:root:not([data-theme='dark'])` / `html[…]:not([data-theme='dark'])` protègent la
    // barre d'onglets partagée avec la création (`.prep-material-compas`, qui a un thème
    // sombre) : ce ne sont pas des règles sombres, on ne les retire pas.
    const mentions = CSS.match(/data-theme=['"]dark['"]/g) ?? [];
    const guarded = CSS.match(/:not\(\[data-theme=['"]dark['"]\]\)/g) ?? [];
    expect(mentions.length).toBe(guarded.length);
  });

  it('le thème clair est forcé sur /compas (script du layout et composant)', () => {
    const layout = read('src/app/layout.tsx');
    expect(layout).toContain('compas(');
    expect(layout).toContain('location.pathname))isDark=false');
    const theme = read('src/features/compas/components/CompasLightTheme.tsx');
    expect(theme).toContain('apply(false)');
    for (const page of ['page.tsx', 'loading.tsx', 'error.tsx']) {
      expect(read(`src/app/compas/${page}`)).toContain('<CompasLightTheme />');
    }
  });
});
