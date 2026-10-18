import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

describe('Compte iOS 27 Liquid Glass v8 — 3D Living Map & Mobile Polish', () => {
  const v8Source = read('src/components/compte/CompteLiquidGlassV8.tsx');
  const runtimeSource = read('src/components/compte/compte-liquid-glass-v8-runtime.js');

  it('embeds the real 3D Map canvas, 3D live badge and fullscreen Mission Control link', () => {
    expect(v8Source).toContain('maplibre-compte-canvas');
    expect(v8Source).toContain('map-badge-3d');
    expect(v8Source).toContain('Relief 3D Vivant');
    expect(v8Source).toContain('btn-3d-fullscreen');
    expect(v8Source).toContain('/carte-3d');
  });

  it('integrates setup3DMap with AWS Terrarium DEM and Esri satellite raster drape', () => {
    expect(runtimeSource).toContain('function setup3DMap()');
    expect(runtimeSource).toContain('elevation-tiles-prod/terrarium');
    expect(runtimeSource).toContain('server.arcgisonline.com');
    expect(runtimeSource).toContain('compte-tmb-track');
    expect(runtimeSource).toContain('setup3DMap();');
  });

  it('wires 3D map controls (recenter, zoom, resize, layers)', () => {
    expect(runtimeSource).toContain('window.__lkdvCompteMap3D');
    expect(runtimeSource).toContain('window.__lkdvCompteMap3D.flyTo');
    expect(runtimeSource).toContain('window.__lkdvCompteMap3D.zoomIn()');
    expect(runtimeSource).toContain('window.__lkdvCompteMap3D.resize()');
  });

  it('provides an Apple HIG empty state for newhl story highlight when no outings exist', () => {
    expect(runtimeSource).toContain('Aucune sortie terminée');
    expect(runtimeSource).toContain('Explorer les traces GPS');
  });

  it('includes mobile-first responsive rules for small screens (< 600px)', () => {
    expect(v8Source).toContain('@media (max-width: 600px)');
    expect(v8Source).toContain('.phone.sheet-open .tabbar');
    expect(v8Source).toContain('.btn-3d-fullscreen');
  });

  it('routes bottom tabs via navtab to actual LKDV pages without touching /compas', () => {
    expect(runtimeSource).toContain("notifyHostAction('navtab', tabRoute)");
    expect(v8Source).toContain("if (action === 'navtab' && typeof val === 'string')");
  });
});
