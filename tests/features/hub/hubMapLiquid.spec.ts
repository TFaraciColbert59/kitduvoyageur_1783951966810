import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const globeMap = readFileSync(
  path.join(ROOT, 'src/features/hub/components/mobile/HubGlobeMap.tsx'),
  'utf8'
);
const momentMapCard = readFileSync(
  path.join(ROOT, 'src/features/hub/components/mobile/MomentMapCard.tsx'),
  'utf8'
);
const unifiedExplorerMap = readFileSync(
  path.join(ROOT, 'src/components/map/UnifiedExplorerMap.tsx'),
  'utf8'
);
const hubLiquid = readFileSync(
  path.join(ROOT, 'src/features/hub/components/hub-liquid.css'),
  'utf8'
);
const sharedPath = path.join(
  ROOT,
  'src/features/hub/components/mobile/hub-map-liquid.css'
);
const shared = existsSync(sharedPath) ? readFileSync(sharedPath, 'utf8') : '';

describe('HubGlobeMap — feuille Liquid Glass partagée', () => {
  it('HubGlobeMap importe la feuille des POI et du tooltip', () => {
    expect(globeMap).toContain("import './hub-map-liquid.css'");
  });

  it('la feuille partagée couvre le rail, la popup et le tooltip', () => {
    expect(shared).toContain('.hub-globe-map {');
    expect(shared).toContain('.hub-globe-poi-chip {');
    expect(shared).toContain('.hub-globe-map .maplibregl-popup.hub-map-poi-popup');
    expect(shared).toContain('.hub-map-poi-tooltip {');
    expect(shared).toContain('.hub-map-rail-control {');
  });

  it('hub-liquid.css ne duplique plus les styles POI partagés', () => {
    expect(hubLiquid).not.toContain('.hub-globe-poi-chip');
    expect(hubLiquid).not.toContain('.hub-map-poi-tooltip');
    expect(hubLiquid).not.toContain('.hub-globe-map {');
  });

  it('définit une ombre rgba locale pour rester valide hors de /hub', () => {
    expect(shared).toMatch(/\.hub-globe-map\s*\{[\s\S]*?--hub-glass-shadow:/);
    expect(shared).toContain('rgba(208, 208, 208, 0.9)');
  });

  it('la feuille partagée conserve un repli opaque en prefers-reduced-transparency', () => {
    expect(shared).toContain('prefers-reduced-transparency: reduce');
    expect(shared).toContain('prefers-contrast: more');
    expect(shared).toContain('.hub-map-poi-tooltip__badge');
  });
});

describe('Hub — carte compacte et interactions globe', () => {
  it('ne confine plus les contrôles interactifs dans un contexte z-0', () => {
    expect(momentMapCard).toContain('<div className="absolute inset-0">');
    expect(momentMapCard).not.toContain('absolute inset-0 z-0');
    expect(momentMapCard).toContain('pointer-events-none relative z-20');
  });

  it('place le rail globe compact en rangée entre les poignées Points et État', () => {
    expect(unifiedExplorerMap).toContain("data-atlas-globe-rail={compact ? 'compact' : undefined}");
    expect(unifiedExplorerMap).toMatch(
      /const rightControlsPosition = compact\s*\?\s*'right-\[68px\] top-\[calc\(var\(--safe-top\)\+112px\)\]'/
    );
    expect(unifiedExplorerMap).toContain(
      "flex ${compact ? 'flex-row' : 'flex-col'} gap-2 ${rightControlsPosition}"
    );
    expect(unifiedExplorerMap).toContain('h-6 w-px self-center bg-white/30');
    expect(unifiedExplorerMap).toContain('${bottomControlsOffset} right-14 md:right-3');
    expect(unifiedExplorerMap).toMatch(
      /\{!compact\s*&&\s*\(\s*<div[^>]*data-atlas-primary-cta="mobile"/
    );
  });

  it('place l’attribution sous le rail compact pour éviter tout recouvrement', () => {
    expect(unifiedExplorerMap).toMatch(
      /const attributionPosition = compact\s*\?\s*'right-3 top-\[calc\(var\(--safe-top\)\+174px\)\]'/
    );
  });

  it('active la rotation et le pitch nécessaires au globe MapLibre', () => {
    expect(unifiedExplorerMap).toContain('dragRotate: true');
    expect(unifiedExplorerMap).toContain('pitchWithRotate: true');
    expect(unifiedExplorerMap).toContain('syncGlobeInteractionHandlers');
  });
});

