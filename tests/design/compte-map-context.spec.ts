import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

describe('Compte — carte contexte, calques réels et setvis', () => {
  const runtime = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
  const declaration = read(
    'src/components/compte/compte-liquid-glass-v8-runtime.d.ts'
  );

  it('associe un calque réel à chacun des cinq slots', () => {
    expect(runtime).toContain('mapContextLayers');
    expect(runtime).toContain("vitrine: ['empreinte']");
    expect(runtime).toContain("kit: ['lignees']");
    expect(runtime).toContain("prets: ['traces']");
    expect(runtime).toContain("souvenirs: ['carnets']");
    expect(runtime).toContain("communaute: ['lignees']");
    // Les calques nommés sont ceux de l'état S.map réellement rendu par drawMap().
    expect(runtime).toContain(
      'map: { style: 0, empreinte: 1, traces: 1, carnets: 1, lignees: 1'
    );
    expect(runtime).toContain('MAP_CONTEXT_LAYER_KEYS');
    // Le tracé `prets` est décoratif, pas une circulation réelle de matériel.
    expect(runtime).toContain('tracé décoratif à coordonnées fixes');
  });

  it('active les calques du slot puis restaure l’état précédent', () => {
    expect(runtime).toContain('applyMapContextLayers');
    expect(runtime).toContain('restoreMapContextLayers');
    expect(runtime).toContain('mapContextLayerSnapshot');
    // Une seule photographie à l'entrée : changer de slot ne l'écrase pas.
    expect(runtime).toContain(
      'if (!mapContextLayerSnapshot) mapContextLayerSnapshot = captureMapLayers();'
    );
    expect(runtime).toContain('applyMapContextLayers(slot);');
    expect(runtime).toMatch(
      /if \(!isSlotDrawer\) \{\s*restoreMapContextLayers\(\);/
    );
    // Seules les clés de contexte sont photographiées/restaurées.
    expect(runtime).toContain(
      'const MAP_LAYER_KEYS = [...MAP_CONTEXT_LAYER_KEYS];'
    );
    expect(runtime).toContain(
      'MAP_LAYER_KEYS.forEach(k => { S.map[k] = mapContextLayerSnapshot[k]; });'
    );
    // Cycle de vie : snapshot remis à zéro à l'init et au cleanup du montage.
    expect(runtime).toMatch(
      /let mapContextLayerSnapshot = null;\s*\n\s*try \{/
    );
    expect(runtime).toMatch(
      /return \(\) => \{\s*\/\* Cycle de vie[\s\S]*?mapContextLayerSnapshot = null;/
    );
    // Le rendu du calque lignées est ouvert au contexte kit/communaute.
    expect(runtime).toContain('ctxWantsLignees');
  });

  it('appelle le contexte carte depuis les trois branches de renderSheet', () => {
    const callSites = runtime.match(/applyMapContext\(\);/g) ?? [];
    expect(callSites).toHaveLength(3);
    // Branche fermée.
    expect(runtime).toMatch(
      /if \(!S\.sh\) \{[\s\S]*?applyMapContext\(\);/
    );
    // Branche drawer Profil v2 (slot ouvert).
    expect(runtime).toMatch(
      /if \(sh\.k === "step" && S\.step === 0\) \{[\s\S]*?applyMapContext\(\);/
    );
    // Branche autre tiroir / feuille standard.
    expect(runtime).toMatch(
      /applyMapContext\(\);\s*const Dd = defs\(\);/
    );
  });

  it('expose setvis exact et conserve cyclevis pour la rétrocompatibilité', () => {
    expect(runtime).toContain('resolveSetVis');
    expect(runtime).toContain('applySetVis');
    expect(runtime).toContain('if (a === "setvis")');
    expect(runtime).toContain('const target = applySetVis(S.vis, v);');
    // Valeur inconnue rejetée avant tout effet de bord.
    expect(runtime).toMatch(
      /if \(target == null\) return;\s*const fromMenu = !!G\.role;/
    );
    expect(runtime).toContain('if (S.vis === target) return;');
    // Menu historique : délai de morphing conservé ; drawer : application immédiate.
    expect(runtime).toContain('if (fromMenu) setTimeout(() => doMut("vis", target), 260);');
    expect(runtime).toContain('else doMut("vis", target, meta);');
    // `cyclevis` reste l'action historique du menu trois états.
    expect(runtime).toContain(
      "cyclevis: () => { doMut('vis', (S.vis + 1) % 3); }"
    );
    // Le contrat est déclaré pour les consommateurs TypeScript.
    expect(declaration).toContain(
      'export declare function resolveSetVis(value: unknown): number | null;'
    );
    expect(declaration).toContain(
      'export declare function applySetVis(current: number, value: unknown): number | null;'
    );
  });

  it('valide setvis de façon idempotente et rejette les valeurs inconnues', async () => {
    const runtimeModule = (await import(
      '../../src/components/compte/compte-liquid-glass-v8-runtime.js'
    )) as unknown as {
      resolveSetVis?: (value: unknown) => number | null;
      applySetVis?: (current: number, value: unknown) => number | null;
    };

    expect(typeof runtimeModule.resolveSetVis).toBe('function');
    expect(typeof runtimeModule.applySetVis).toBe('function');
    const resolveSetVis = runtimeModule.resolveSetVis as (
      value: unknown
    ) => number | null;
    const applySetVis = runtimeModule.applySetVis as (
      current: number,
      value: unknown
    ) => number | null;

    // Contrat public exact.
    expect(resolveSetVis('public')).toBe(2);
    expect(resolveSetVis('prive')).toBe(0);

    // Index historiques du menu de visibilité : dataset.v arrive en chaîne.
    expect(resolveSetVis('0')).toBe(0);
    expect(resolveSetVis('1')).toBe(1);
    expect(resolveSetVis('2')).toBe(2);

    // Toute valeur inconnue est rejetée (null), sans cible par défaut.
    for (const unknown of [
      'publique',
      'privée',
      'PRIVE',
      'Public',
      '',
      '  ',
      '3',
      3,
      -1,
      NaN,
      null,
      undefined,
      {},
      [],
    ]) {
      expect(resolveSetVis(unknown)).toBeNull();
      expect(applySetVis(2, unknown)).toBeNull();
    }

    // Idempotence réelle : deux applications identiques ne changent plus rien.
    const publicOnce = applySetVis(1, 'public');
    expect(publicOnce).toBe(2);
    const publicTwice = applySetVis(publicOnce as number, 'public');
    expect(publicTwice).toBe(publicOnce);
    expect(applySetVis(publicTwice as number, 'public')).toBe(publicTwice);

    const priveOnce = applySetVis(2, 'prive');
    expect(priveOnce).toBe(0);
    expect(applySetVis(priveOnce as number, 'prive')).toBe(priveOnce);

    // Une valeur inconnue laisse l'état courant à l'appelant (aucune mutation).
    expect(applySetVis(2, 'inconnue')).toBeNull();
  });
});
