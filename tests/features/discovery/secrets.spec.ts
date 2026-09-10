import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), 'utf8');

describe('hygiène des secrets Tripadvisor', () => {
  it('.env.local n’est pas versionné (gitignore + index git)', () => {
    const gitignore = read('.gitignore');
    expect(gitignore).toMatch(/\.env\.local/);
    expect(gitignore).toMatch(/\.env\*\.local/);

    let tracked = '';
    try {
      tracked = execSync('git ls-files -- .env.local', { cwd: root }).toString().trim();
    } catch {
      // git indisponible dans l'environnement de test — le contrôle gitignore suffit.
    }
    expect(tracked).toBe('');
  });

  it('aucune variable NEXT_PUBLIC_TRIPADVISOR n’existe dans le code', () => {
    const files = [
      'src/features/discovery/providers/tripadvisor/tripadvisorClient.ts',
      'src/features/discovery/providers/tripadvisor-terra/terraClient.ts',
      'src/features/discovery/providers/tripadvisorProvider.ts',
      'src/features/discovery/services/discoveryService.ts',
      'src/app/api/discovery/search/route.ts',
      'src/features/discovery/constants.ts',
    ];
    for (const file of files) {
      expect(read(file)).not.toContain('NEXT_PUBLIC_TRIPADVISOR');
    }
  });

  it('le client et le service sont marqués server-only', () => {
    expect(read('src/features/discovery/providers/tripadvisor/tripadvisorClient.ts')).toContain(
      "import 'server-only'"
    );
    expect(read('src/features/discovery/providers/tripadvisor-terra/terraClient.ts')).toContain(
      "import 'server-only'"
    );
    expect(read('src/features/discovery/providers/tripadvisorProvider.ts')).toContain(
      "import 'server-only'"
    );
    expect(read('src/features/discovery/services/discoveryService.ts')).toContain(
      "import 'server-only'"
    );
  });
});
