import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Garde de câblage : les quatre surfaces de profil passent par l'appel commun
 * et n'écrivent plus directement dans `user_follows`. Les lectures d'état
 * initial restent locales (RLS), seules les mutations sont verrouillées.
 */
const SURFACES = [
  '../../../../components/profile/PublicProfileV2.tsx',
  '../../../../components/profile/PublicMobileProfileView.tsx',
  '../../../../components/compte/CompteLiquidGlassV8.tsx',
  '../../../../components/compte/overlay/DetailDrawers.tsx',
] as const;

const DIRECT_WRITE = /from\(['"]user_follows['"]\)[\s\S]{0,180}?\.(insert|upsert|update|delete)\(/;

describe('câblage du suivi sur le contrat API', () => {
  for (const relative of SURFACES) {
    it(`${relative.split('/').pop()} utilise l’appel commun sans écriture directe`, () => {
      const source = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
      expect(source).toContain("from '@/features/compte/client/followClient'");
      expect(source).toContain('setFollow(');
      expect(source).not.toMatch(DIRECT_WRITE);
    });
  }
});
