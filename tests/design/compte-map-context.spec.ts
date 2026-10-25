import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

describe('Compte — carte contexte, calques réels et setvis', () => {
  const runtime = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
  const modesSource = read('src/features/compte/map/modes.ts');
  const declaration = read(
    'src/components/compte/compte-liquid-glass-v8-runtime.d.ts'
  );

  it('associe un contexte réel à chacun des cinq slots', async () => {
    const modes = await import('../../src/features/compte/map/modes');
    for (const slot of ['vitrine', 'kit', 'prets', 'souvenirs', 'communaute'] as const) {
      expect(
        modes.resolveSheetMode({
          kind: 'step',
          step: 0,
          slot,
          detent: 'card',
          outingId: null,
        })
      ).toBe(slot);
    }
    expect(runtime).toContain('slotIdOf(S.slot)');
  });

  it('ne montre aucun calque de données pour Prêts, Compte et Réseau', async () => {
    const { mapModeConfig } = await import('../../src/features/compte/map/modes');
    for (const mode of ['prets', 'compte', 'reseau'] as const) {
      const config = mapModeConfig(mode);
      expect(config.layers.tracks).toBe('none');
      expect(config.layers.massifs).toBe(false);
      expect(config.dimmed).toBe(true);
    }
    expect(modesSource).toContain("if (sheet.kind === 'account_drawer') return 'compte'");
  });

  it('émet le contexte carte depuis le runtime vers l’îlot React', () => {
    expect(runtime).toContain('function currentMapContext()');
    expect(runtime).toContain('function notifyMapContext()');
    expect(runtime).toContain('window.__lkdvCompteMapContext');
    expect(runtime).toContain('window.__lkdvCompteMapState = context');
    expect(runtime).toContain('notifyMapContext();');
    expect(runtime).toContain('window.__lkdvSetSlot');
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
