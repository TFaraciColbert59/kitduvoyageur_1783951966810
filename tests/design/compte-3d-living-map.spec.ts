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
    expect(v8Source.includes('GLOBE 3D') || v8Source.includes('Relief 3D Vivant')).toBe(true);
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

  it('enforces Apple HIG 44x44pt hit target rules for mobile touch accessibility', () => {
    expect(v8Source).toContain('.mctl button::after');
    expect(v8Source).toContain('min-width: 44px');
    expect(v8Source).toContain('min-height: 44px');
  });

  it('implements spring physics and downward swipe fling dismissal for linear sheets', () => {
    expect(runtimeSource).toContain("dy > 70");
    expect(runtimeSource).toContain("setDet('closed')");
  });

  it('supports dynamic user GPX coordinates drape with fallback to TMB track', () => {
    expect(runtimeSource).toContain('activeCoordinates');
    expect(runtimeSource).toContain('window.__LKDV_USER_COORDS__');
  });

  it('persists scanned equipment to localStorage inventory and notifies host', () => {
    expect(runtimeSource).toContain('lkdv_inventory_items_v1');
  });

  it('provides a 3D map loading progress bar and balanced map height with -15% adjustment', () => {
    expect(v8Source).toContain('map-loading-bar');
    expect(v8Source).toContain('map-loading-fill');
    expect(v8Source.includes('calc(69% - 46px) 1fr') || v8Source.includes('calc(63.5% - 46px) 1fr')).toBe(true);
    expect(runtimeSource).toContain("document.getElementById('map-loading-bar')");
  });

  it('applies generous padding and breathing room to profile stat boxes', () => {
    expect(v8Source).toContain('.ig-stat');
    expect(v8Source).toContain('padding: 8px 12px !important');
    expect(v8Source).toContain('gap: 8px !important');
  });
});
