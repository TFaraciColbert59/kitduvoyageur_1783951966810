import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * La zone scrollable de l ecran ne doit jamais glisser horizontalement.
 *
 * Releve du 2026-09-28, viewport 393x852 : `.adventure-prep` mesurait
 * `scrollWidth` 448 pour `clientWidth` 393 — 55 px de debordement lateral.
 * Cause : `.prep-body` declarait `overflow-y: auto` sans jamais nommer
 * l axe X. La spec CSS impose alors `overflow-x: auto` (un axe non `visible`
 * force l autre a ne plus etre `visible`), donc toute la page devenait
 * defilable sur le cote. Conflit direct avec le geste « swipe gauche/droite =
 * jour precedent/suivant », qui doit rester le seul glissement horizontal.
 */

const css = readFileSync(join(__dirname, '..', 'adventure-prep.css'), 'utf8');

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|\\})\\s*${escaped}\\s*(?:,[^{]*)?\\{([^}]*)\\}`, 'm').exec(css);
  if (!match) throw new Error(`selecteur introuvable: ${selector}`);
  return match[1];
}

describe('zone scrollable du preparateur', () => {
  it('neutralise le debordement horizontal', () => {
    expect(rule('.prep-body')).toMatch(/overflow-x:\s*hidden/);
  });

  it('garde le defilement vertical', () => {
    expect(rule('.prep-body')).toMatch(/overflow-y:\s*auto/);
  });

  it('laisse les blocs se retracter pour ne pas depasser la colonne', () => {
    // `flex-shrink: 0` seul empechait le retr ecissement ; sans `min-width: 0`
    // un bloc plus large que la colonne entrainait tout l ecran avec lui.
    expect(rule('.prep-body > *')).toMatch(/min-width:\s*0/);
  });
});
