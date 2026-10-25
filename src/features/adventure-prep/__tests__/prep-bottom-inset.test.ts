import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Reservation basse du preparateur — verrou anti-regression du chevauchement.
 *
 * Mesure live (2026-09-28, viewport 393x852, etape 3 « En avant ! ») :
 *   rail de jours  790 -> 852
 *   CTA « Enregistrer mon aventure » recouvre par la barre basse
 *   `--prep-bottom-inset` calcule 68 px au lieu des 108 px requis
 *
 * La cause etait un `--bottom-nav-height` publie uniquement par `AppShell`,
 * dont `/prepare` n'est pas descendant. Deux garde-fous ici :
 *   1. `--prep-bottom-inset` doit TOUJOURS passer par la variable publiee,
 *      jamais par une valeur figee ;
 *   2. la barre doit publier la variable (le greffon est monte par
 *      `WebNavigationBar`, seul endroit qui sait si le rail existe).
 *
 * Meme harnais que `prep-layout-visual.test.ts` : le repo n'a pas de jsdom,
 * la feuille est donc lue comme du texte.
 */

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'adventure-prep.css'),
  'utf8',
);

const webNav = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
    'components',
    'mobile-nav',
    'navigation',
    'WebNavigationBar.tsx',
  ),
  'utf8',
);

const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, ' ');

describe('Reservation basse du preparateur', () => {
  it('INSET-01: --prep-bottom-inset passe par --bottom-nav-height', () => {
    const block = withoutComments
      .split('}')
      .find((chunk) => chunk.includes('--prep-bottom-inset:'));
    expect(block).toBeDefined();
    expect(block).toContain('var(--bottom-nav-height');
  });

  it('INSET-02: aucune hauteur de nav en dur dans la reservation du bas', () => {
    const block = withoutComments
      .split('}')
      .find((chunk) => chunk.includes('--prep-bottom-inset:'));
    // 60 px en dur = la longueur de la barre seule : c est exactement la
    // valeur qui a produit le chevauchement.
    expect(block).not.toMatch(/\b60px\b/);
  });

  it('INSET-03: la barre publie la reservation — le rail existe, la page reserve', () => {
    expect(webNav).toContain('BottomNavReservation');
  });
});
