import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Un `name:` non cité qui contient « : » rend le fichier YAML invalide : GitHub refuse alors le
 * workflow entier et chaque exécution échoue aussitôt, sans un seul job. Arrivé le 13 octobre
 * (« Gate 5.1 — Messagerie : pièces jointes… » dans `ci.yml`, sur `main` et sur la PR #93).
 */
describe('workflows GitHub — noms d’étapes lisibles en YAML', () => {
  it('aucun nom non cité ne contient « : » ni « # »', () => {
    const dir = path.join(process.cwd(), '.github/workflows');
    const bad: string[] = [];
    for (const file of readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))) {
      readFileSync(path.join(dir, file), 'utf8')
        .split('\n')
        .forEach((line, i) => {
          const m = /^\s*(?:-\s+)?name:\s+(.+)$/.exec(line);
          if (!m) return;
          const value = m[1].trim();
          if (/^['"]/.test(value)) return;
          if (/: |\s#/.test(value)) bad.push(`${file}:${i + 1} ${value}`);
        });
    }
    expect(bad).toEqual([]);
  });
});
