import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { travellerPrivacyViolations } from '../../../../scripts/verify/traveller_privacy.mjs';

/**
 * Verrou de vie privée du profil voyageur (PLAN-100 4.1) : le dépôt est conforme,
 * et chaque fuite possible casse le verrou (dépôts factices dans un dossier temporaire).
 */
const roots: string[] = [];
function repo(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lkdv-traveller-'));
  roots.push(root);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

const READ = "import { readTraveller } from '@/features/compas/server/traveller';\n";

describe('verrou de vie privée du profil voyageur', () => {
  it('le dépôt est conforme', () => {
    expect(travellerPrivacyViolations(process.cwd())).toEqual([]);
  });

  it('un composant public qui importe le lecteur casse le verrou', () => {
    expect(travellerPrivacyViolations(repo({ 'src/components/profil/PublicCard.tsx': READ }))).toEqual([
      'lecteur du profil voyageur importé par src/components/profil/PublicCard.tsx',
    ]);
  });

  it('même dans le Compas, un fichier « use client » ne lit jamais le profil', () => {
    const root = repo({ 'src/features/compas/components/Leak.tsx': `'use client';\nimport { readTraveller } from '../server/traveller';\n` });
    expect(travellerPrivacyViolations(root)).toEqual(['lecteur du profil voyageur importé par src/features/compas/components/Leak.tsx']);
  });

  it('le serveur du Compas et les deux pages du profil peuvent le lire', () => {
    const root = repo({
      'src/features/compas/server/autofillActions.ts': `'use server';\nimport { readTraveller } from './traveller';\n`,
      'src/app/compas/page.tsx': READ,
      'src/app/compte/voyageur/page.tsx': `${READ}import TravellerCard from '@/components/identity/TravellerCard';\n`,
      'src/components/identity/TravellerCard.tsx': `'use client';\nimport { saveTravellerAction } from '@/features/compas/server/travellerActions';\n`,
      'src/features/compas/components/CompasStart.tsx': `'use client';\nimport TravellerCard from '@/components/identity/TravellerCard';\n`,
      'src/server/gdprExport.ts': "const t = 'user_traveller';\n",
    });
    expect(travellerPrivacyViolations(root)).toEqual([]);
  });

  it('la table nommée ailleurs, une réexportation des actions, la carte montée ailleurs : refusées', () => {
    const root = repo({
      'src/features/trips/server/joinActivity.ts': "await service.from('user_traveller').select('*');\n",
      'src/components/profil/actions.ts': "export * from '../../features/compas/server/travellerActions';\n",
      'src/app/profil/[id]/page.tsx': "import TravellerCard from '@/components/identity/TravellerCard';\n",
    });
    expect(travellerPrivacyViolations(root)).toEqual([
      'carte du profil voyageur montée dans src/app/profil/[id]/page.tsx',
      'actions du profil voyageur importées par src/components/profil/actions.ts',
      'table user_traveller nommée hors du lecteur : src/features/trips/server/joinActivity.ts',
    ]);
  });

  it('l’IA et les partages ne reçoivent jamais le contexte voyageur brut', () => {
    const root = repo({
      'src/lib/ai/features/compasAutofill.ts': "import type { TravellerContext } from '@/features/compas/engine/traveller';\n",
      'src/app/k/[token]/page.tsx': "import { travellerView } from '@/features/compas/engine/traveller';\n",
    });
    expect(travellerPrivacyViolations(root)).toEqual([
      'contexte voyageur importé par src/app/k/[token]/page.tsx',
      'contexte voyageur importé par src/lib/ai/features/compasAutofill.ts',
    ]);
  });

  it('aucun journal dans le lecteur ni dans les actions', () => {
    const root = repo({ 'src/features/compas/server/travellerActions.ts': "'use server';\nconsole.info('profil', 1);\n" });
    expect(travellerPrivacyViolations(root)).toEqual(['journal interdit dans src/features/compas/server/travellerActions.ts']);
  });

  it('les tests ne comptent pas', () => {
    const root = repo({ 'src/features/compas/__tests__/x.test.ts': READ, 'src/components/x.spec.tsx': READ });
    expect(travellerPrivacyViolations(root)).toEqual([]);
  });
});
