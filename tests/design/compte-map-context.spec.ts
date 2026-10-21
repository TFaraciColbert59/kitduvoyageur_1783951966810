import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

describe('Compte — carte contexte, calques réels et setvis', () => {
  const runtime = read('src/components/compte/compte-liquid-glass-v8-runtime.js');

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
    // Le retour au mode normal restaure tous les calques (pas seulement celui du slot).
    expect(runtime).toContain(
      'MAP_LAYER_KEYS.forEach(k => { S.map[k] = mapContextLayerSnapshot[k]; });'
    );
    // Le rendu du calque lignées est ouvert au contexte kit/communaute.
    expect(runtime).toContain('ctxWantsLignees');
  });

  it('expose setvis exact et conserve cyclevis pour la rétrocompatibilité', () => {
    expect(runtime).toContain('resolveSetVis');
    expect(runtime).toContain('if (a === "setvis")');
    expect(runtime).toContain('const target = resolveSetVis(v);');
    // Valeur inconnue rejetée avant tout effet de bord.
    expect(runtime).toMatch(
      /if \(target == null\) return;\s*const fromMenu = !!G\.role;/
    );
    expect(runtime).toContain('if (S.vis === target) return;');
    // Menu historique : délai de morphing conservé ; drawer : application immédiate.
    expect(runtime).toContain('if (fromMenu) setTimeout(() => doMut("vis", target), 260);');
    expect(runtime).toContain('else doMut("vis", target);');
    // `cyclevis` reste l'action historique du menu trois états.
    expect(runtime).toContain(
      "cyclevis: () => { doMut('vis', (S.vis + 1) % 3); }"
    );
  });

  it('valide setvis de façon idempotente et rejette les valeurs inconnues', async () => {
    const runtimeModule = (await import(
      '../../src/components/compte/compte-liquid-glass-v8-runtime.js'
    )) as unknown as {
      resolveSetVis?: (value: unknown) => number | null;
    };

    expect(typeof runtimeModule.resolveSetVis).toBe('function');
    const resolveSetVis = runtimeModule.resolveSetVis as (
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
    }

    // Idempotence de la résolution : même entrée, même cible.
    expect(resolveSetVis('public')).toBe(resolveSetVis('public'));
    expect(resolveSetVis('prive')).toBe(resolveSetVis('prive'));
  });
});
