import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * PLAN-100 phase 9 — actions GitHub sur Node 20 (déprécié).
 * Chaque workflow déclare, dans son bloc `env:` de premier niveau,
 * FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true : les actions JavaScript (checkout,
 * setup-node, upload-artifact…) tournent alors sur Node 24 sans toucher aux SHA
 * épinglés. Le garde échoue dès qu'un workflow (nouveau ou existant) l'oublie.
 */
const workflowsDir = path.join(process.cwd(), '.github', 'workflows');
const KEY = 'FORCE_JAVASCRIPT_ACTIONS_TO_NODE24';

const files = readdirSync(workflowsDir)
  .filter((name) => /\.ya?ml$/.test(name))
  .sort();

/** Lignes du bloc `env:` de premier niveau (colonne 0), ou null s'il n'existe pas. */
function topLevelEnvBlock(source: string): string[] | null {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => /^env:\s*(#.*)?$/.test(line));
  if (start === -1) return null;
  const block: string[] = [];
  for (const line of lines.slice(start + 1)) {
    // Le bloc s'arrête à la prochaine clé de premier niveau (colonne 0, hors commentaire).
    if (/^\S/.test(line) && !line.startsWith('#')) break;
    block.push(line);
  }
  return block;
}

describe('workflows GitHub : actions JavaScript forcées sur Node 24', () => {
  it('trouve les workflows du dépôt', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} déclare ${KEY}: true dans son env de premier niveau`, () => {
      const source = readFileSync(path.join(workflowsDir, file), 'utf8');
      const block = topLevelEnvBlock(source);
      expect(block, `${file} n'a pas de bloc env: de premier niveau`).not.toBeNull();
      const declared = (block ?? []).some((line) =>
        new RegExp(`^\\s+${KEY}:\\s*['"]?true['"]?\\s*(#.*)?$`).test(line)
      );
      expect(declared, `${file} : ${KEY}: true manquant dans env:`).toBe(true);
    });
  }

  it('le garde détecte un workflow sans la clé (contrôle négatif)', () => {
    expect(topLevelEnvBlock('name: x\non: push\njobs:\n  a:\n    env:\n      A: 1\n')).toBeNull();
    expect(topLevelEnvBlock('env:\n  OTHER: 1\n\njobs:\n  a: {}\n')?.join('\n')).not.toContain(KEY);
    expect(topLevelEnvBlock(`env:\n  ${KEY}: true\n\njobs:\n  a: {}\n`)?.join('\n')).toContain(KEY);
  });
});
