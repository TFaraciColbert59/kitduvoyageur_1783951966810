import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { LEGACY_REDIRECTS, resolveLegacyRedirect } from '@/lib/hub/hubRedirects';

/**
 * Fusion des configurateurs — le preparateur de voyage est l'UNIQUE point
 * d'entree : plus aucune page "configurateur". Cet onglet verifie que
 * /preparer porte l'onglet equipement et que tous les anciens chemins
 * tombent dessus.
 */

const ROOT = process.cwd();
const KIT_TAB = '/preparer?tab=equipement';

describe('Fusion des configurateurs — /preparer est l unique point de vente', () => {
  it('FUS-1: /rapport-kit et /ai-configurator ouvrent l onglet equipement du preparateur', () => {
    const expected = { destination: '/preparer', setParams: { tab: 'equipement' } };
    expect(resolveLegacyRedirect('/rapport-kit')).toEqual(expected);
    expect(resolveLegacyRedirect('/ai-configurator')).toEqual(expected);
  });

  it('FUS-2: /configurateur (next.config) pointe vers le preparateur', () => {
    const config = fs.readFileSync(path.join(ROOT, 'next.config.mjs'), 'utf8');
    const block = config.slice(config.indexOf("'/configurateur'"));
    const destination = block.match(/destination:\s*'([^']+)'/)?.[1];
    expect(destination).toBe(KIT_TAB);
  });

  it('FUS-3: le middleware couvre /ai-configurator (le redirect doit tirer)', () => {
    const middleware = fs.readFileSync(path.join(ROOT, 'src', 'middleware.ts'), 'utf8');
    const matcher = middleware.match(/matcher:\s*\[([\s\S]*?)\n\s*\]/);
    expect(matcher).not.toBeNull();
    expect(matcher![1]).toContain("'/ai-configurator'");
    expect(matcher![1]).toContain("'/rapport-kit'");
  });

  it('FUS-4: /preparer lit ?tab=equipement et ouvre l onglet sans page intermediaire', () => {
    const page = fs.readFileSync(path.join(ROOT, 'src', 'app', 'preparer', 'page.tsx'), 'utf8');
    expect(page).toContain("tab === 'equipement'");
    expect(page).toContain('initialTab={initialTab}');
  });

  it('FUS-5: PreparatorView porte l onglet equipement charge a la demande', () => {
    const view = fs.readFileSync(
      path.join(ROOT, 'src', 'features', 'preparator', 'components', 'PreparatorView.tsx'),
      'utf8',
    );
    // Onglet declare
    expect(view).toContain("'checklist' | 'equipement'");
    expect(view).toContain("{ id: 'equipement', label: 'Équipement'");
    // Wizard charge en lazy (ssr: false) : jamais au premier rendu
    expect(view).toMatch(/KitConfiguratorWizard = dynamicImport\([\s\S]*?ssr: false/);
    // Contexte derive du voyage actif (application directe, pas une config generique)
    expect(view).toContain('tripContext={tripContext}');
    expect(view).toContain('activity: trip.primary_activity');
    expect(view).toContain('onApplied={() => router.refresh()}');
  });

  it('FUS-6: plus aucun lien applicatif vers /ai-configurator (hors shim, middleware, robots)', () => {
    const whitelist = new Set([
      'src/app/ai-configurator/page.tsx',
      'src/middleware.ts',
      'src/lib/hub/hubRedirects.ts',
      'src/app/robots.ts',
    ]);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        const rel = path.relative(ROOT, p).split('\\').join('/');
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
          walk(p);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;
        if (whitelist.has(rel)) continue;
        // L'import du composant (brique interne du preparateur) est legit ;\n        // tout lien utilisateur vers /ai-configurator ne l'est plus.\n        const source = fs.readFileSync(p, 'utf8');\n        const links = source\n          .split('\n')\n          .filter((line) => line.includes('/ai-configurator'))\n          .filter((line) => !line.includes('components/KitConfiguratorWizard'));\n        if (links.length > 0) offenders.push(rel + ' -> ' + links[0].trim());
      }
    };
    walk(path.join(ROOT, 'src'));
    expect(offenders).toEqual([]);
  });

  it('FUS-7: la table legacy ne contient plus de destination configurateur', () => {
    for (const destination of Object.values(LEGACY_REDIRECTS)) {
      expect(destination).not.toBe('/ai-configurator');
    }
  });
});
