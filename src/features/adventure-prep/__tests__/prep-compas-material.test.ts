import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

/**
 * La création d'aventure lancée depuis /compas porte le matériau du Compas
 * (prep-compas.css). Ce fichier verrouille les règles qui le rendent sûr :
 * aucune couleur inventée, aucune fuite hors de sa portée, des icônes réelles,
 * et un branchement que seul /compas active.
 */

const ROOT = process.cwd();
const CSS = readFileSync(join(ROOT, 'src/features/adventure-prep/prep-compas.css'), 'utf8');
const SANS_COMMENTAIRES = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

/** Les sélecteurs de chaque règle (hors @media, dont on lit le contenu). */
function selecteurs(css: string): string[] {
  const out: string[] = [];
  const re = /([^{}]+)\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const sel = m[1].trim();
    if (sel.startsWith('@')) continue;
    out.push(...decoupe(sel));
  }
  return out;
}

/** Coupe une liste de sélecteurs sur les virgules de premier niveau. */
function decoupe(liste: string): string[] {
  const parts: string[] = [];
  let profondeur = 0;
  let courant = '';
  for (const c of liste) {
    if (c === '(') profondeur += 1;
    if (c === ')') profondeur -= 1;
    if (c === ',' && profondeur === 0) {
      parts.push(courant.trim());
      courant = '';
    } else {
      courant += c;
    }
  }
  parts.push(courant.trim());
  return parts.filter(Boolean);
}

describe('prep-compas.css — matériau du Compas pour la création', () => {
  it('aucune couleur littérale : tout part des jetons --lkv-*', () => {
    expect(SANS_COMMENTAIRES).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(SANS_COMMENTAIRES).not.toMatch(/\brgba?\(/i);
    expect(SANS_COMMENTAIRES).not.toMatch(/\bhsla?\(/i);
    expect(SANS_COMMENTAIRES.toLowerCase()).not.toContain('e4501c');
  });

  it('aucun jeton dont le nom contient « role »', () => {
    expect(SANS_COMMENTAIRES).not.toMatch(/--[\w-]*role[\w-]*\s*:/i);
  });

  it('chaque règle est limitée à la création Compas, en thème clair', () => {
    const sels = selecteurs(SANS_COMMENTAIRES);
    expect(sels.length, 'garde : la feuille est bien lue').toBeGreaterThan(20);
    for (const sel of sels) {
      expect(sel, `règle hors portée : ${sel}`).toMatch(/\.prep-material-compas/);
      expect(sel, `règle active en thème sombre : ${sel}`).toMatch(
        /^:root:not\(\[data-theme='dark'\]\)/
      );
    }
  });

  it('les icônes de la capsule d’étapes existent dans public/icons/sf', () => {
    const icones = [...SANS_COMMENTAIRES.matchAll(/url\('\/icons\/sf\/([\w-]+)\.svg'\)/g)].map(
      (m) => m[1]
    );
    expect(icones.length).toBe(3);
    for (const nom of icones) {
      expect(existsSync(join(ROOT, 'public/icons/sf', `${nom}.svg`)), nom).toBe(true);
    }
  });

  it('respecte la transparence réduite', () => {
    expect(CSS).toMatch(/@media \(prefers-reduced-transparency: reduce\)/);
  });
});

describe('branchement : seul /compas active le matériau', () => {
  it('la page /compas demande le matériau pour les deux entrées de création', () => {
    const page = readFileSync(join(ROOT, 'src/app/compas/page.tsx'), 'utf8');
    const appels = page.match(/<AdventurePrepScreen[^>]*\/>/g) ?? [];
    expect(appels.length).toBe(2);
    for (const appel of appels) expect(appel).toContain('material="compas"');
  });

  it('sans matériau, l’écran garde le verre sombre ; avec, il pose la classe et le fond', async () => {
    const vi = await import('vitest');
    vi.vi.doMock('@/components/shell/AppShell', () => ({
      default: ({ className, children }: { className?: string; children: React.ReactNode }) =>
        React.createElement('div', { 'data-shell': className }, children),
    }));
    vi.vi.doMock('../components/PrepFlow', () => ({ default: () => null }));
    const { default: AdventurePrepScreen } = await import('../components/AdventurePrepScreen');
    const Screen = AdventurePrepScreen as React.ComponentType<{ material?: 'compas' }>;
    const sombre = renderToStaticMarkup(React.createElement(Screen));
    const compas = renderToStaticMarkup(React.createElement(Screen, { material: 'compas' }));
    expect(sombre).not.toContain('prep-material-compas');
    expect(sombre).not.toContain('cp-bg');
    expect(compas).toContain('app-shell--preparer prep-material-compas');
    expect(compas).toContain('class="cp-bg"');
  });
});
