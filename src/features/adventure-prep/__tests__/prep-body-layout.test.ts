import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'adventure-prep.css'),
  'utf8',
);

/** Regles qui interdisent a un enfant de .prep-body d etre ecrase. */
function bodyChildRule(): string {
  const match = css.match(/\.prep-body\s*>\s*\*\s*\{([^}]*)\}/);
  return match ? match[1] : '';
}

describe('la zone scrollable ne peut pas ecraser son contenu', () => {
  it('interdit explicitement le retrecissement des enfants de .prep-body', () => {
    // Regression observee en navigateur : .prep-body est un flex column avec
    // overflow-y auto. Sans flex-shrink: 0, tout bloc plus long que la
    // hauteur libre est comprime a 0px — l'etape devient invisible et
    // aucun bouton n'est cliquable.
    expect(bodyChildRule()).toMatch(/flex-shrink:\s*0/);
  });

  it('laisse la zone corps etre le seul point de defilement', () => {
    const body = css.match(/\.prep-body\s*\{([^}]*)\}/);
    expect(body).not.toBeNull();
    expect(body?.[1]).toMatch(/overflow-y:\s*auto/);
  });
});
