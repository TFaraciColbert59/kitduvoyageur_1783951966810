import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function collectRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...collectRouteFiles(p));
    else if (e === 'route.ts') out.push(p);
  }
  return out;
}

/**
 * Garde d'architecture : aucune route `/api/admin/*` ne doit contourner
 * `requireAdmin()` via service_role pour la BASE (`.from()`).
 * Exceptions documentées : `service.storage` (bucket `product-images`,
 * sans policy authenticated-write — usage serveur post-autorisation :
 * `upload/route.ts`, `images/[imageId]/route.ts`).
 * Seul `src/server/admin/audit.ts` utilise `getServiceSupabase()` pour la base.
 */
describe('no direct sensitive write', () => {
  it('aucune route admin ne lit/écrit la base via service_role', () => {
    const files = collectRouteFiles(join('src', 'app', 'api', 'admin'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      expect(src, `${f} :: getServiceSupabase().from interdit`).not.toMatch(
        /getServiceSupabase\(\)\.from\(/
      );
      expect(src, `${f} :: retour-ligne .from interdit`).not.toMatch(
        /getServiceSupabase\(\)\s*\n\s*\.from\(/
      );
      // Alias : `const s = getServiceSupabase(); ... s.from(...)`.
      // `s.storage.from(...)` (bucket, post-autorisation) reste autorisé.
      const alias = src.match(/(?:const|let|var)\s+(\w+)\s*=\s*getServiceSupabase\(\)/);
      if (alias) {
        const uses = [...src.matchAll(new RegExp(`${alias[1]}\\.(storage\\.)?from\\(`, 'g'))];
        for (const u of uses) {
          expect(u[0], `${f} :: ${alias[1]}.from interdit (storage seul autorisé)`).toMatch(
            /\.storage\.from\($/
          );
        }
      }
    }
  });

  it('toutes les routes admin appellent requireAdmin', () => {
    const files = collectRouteFiles(join('src', 'app', 'api', 'admin'));
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).toMatch(/requireAdmin\(/);
    }
  });
});
