import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

/**
 * La carte du Compte n'est plus dessinée par le runtime vanilla : elle est
 * portée par l'îlot React `CompteMap`. Ces gardes vérifient le câblage réel
 * (worker, readiness, sources, états) et l'absence de retour à la maquette.
 */
describe('Compte — carte vivante React', () => {
  const v8Source = read('src/components/compte/CompteLiquidGlassV8.tsx');
  const runtimeSource = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
  const mapSource = read('src/components/compte/map/CompteMap.tsx');
  const css = read('src/components/compte/map/compte-map.css');
  const mapData = read('src/features/compte/map/server/loadCompteMap.ts');

  it('monte l’îlot carte dans le nœud historique du Compte', () => {
    expect(v8Source).toContain('maplibre-compte-canvas');
    expect(v8Source).toContain('CompteMap');
    expect(v8Source).toContain('useCompteMapContext');
    expect(v8Source).not.toContain('window as any).maplibregl = maplibregl');
  });

  it('configure le worker et attend style.load, jamais load', () => {
    expect(mapSource).toContain("setWorkerUrl('/maplibre/maplibre-gl-worker.mjs')");
    expect(mapSource).toContain("instance.on('style.load'");
    expect(mapSource).not.toContain("instance.on('load'");
    expect(mapSource).toContain('ResizeObserver');
    expect(mapSource).toContain('instance.resize()');
  });

  it('ajoute les sources et calques réels du compte', () => {
    expect(mapSource).toContain("'compte-tracks'");
    expect(mapSource).toContain("'compte-track-starts'");
    expect(mapSource).toContain("'compte-track-ends'");
    expect(mapSource).toContain("'compte-carnets'");
    expect(mapSource).toContain("'compte-pois'");
    expect(mapData).toContain('simplifyTrack');
    expect(mapData).toContain('parsePositions');
    expect(mapSource).not.toContain('compte-tmb-track');
    expect(mapSource).not.toContain('Tour du Mont-Blanc');
  });

  it('conserve le contexte des drawers via un pont explicite', () => {
    expect(runtimeSource).toContain('__lkdvCompteMapContext');
    expect(runtimeSource).toContain('currentMapContext');
    expect(runtimeSource).toContain('notifyMapContext');
    expect(runtimeSource).toContain('__lkdvCompteMapState');
    expect(runtimeSource).not.toContain('function setup3DMap()');
  });

  it('applique la recette de verre de la barre du bas', () => {
    expect(css).toContain('rgba(255, 255, 255, 0.486)');
    expect(css).toContain('rgba(255, 255, 255, 0.325)');
    expect(css).toContain('rgba(255, 255, 255, 0.404)');
    expect(css).toContain('blur(4px) saturate(1.9) brightness(1.07)');
    expect(css).toContain('height: 28px');
    expect(css).toContain('border-radius: 999px');
  });

  it('couvre les états invité, vide, erreur, neutral et fallback', () => {
    expect(mapSource).toContain('kind="guest"');
    expect(mapSource).toContain('kind="empty"');
    expect(mapSource).toContain('kind="error"');
    expect(mapSource).toContain('kind="neutral"');
    expect(mapSource).toContain('CompteMapFallback');
    expect(mapSource).toContain('data-map-ready');
    expect(mapSource).toContain('data-map-empty');
  });

  it('respecte les cibles 44 px et reduced motion', () => {
    expect(css).toContain('width: 44px');
    expect(css).toContain('height: 44px');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('ne fabrique aucun marqueur de démonstration', () => {
    expect(mapSource).not.toContain('Massif du Mont-Blanc');
    expect(mapSource).not.toContain('Lac Blanc');
    expect(mapSource).not.toContain('Néouvielle');
  });
});
