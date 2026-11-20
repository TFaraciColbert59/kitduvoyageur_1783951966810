import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('Performance non-regression gates (Mission Plus Rapide qu’Instagram)', () => {
  it('.lighthouserc.json active des seuils réels (aucun "off", aucun --no-sandbox)', () => {
    const raw = read('.lighthouserc.json');
    expect(raw).not.toContain('--no-sandbox');
    expect(raw).not.toContain('temporary-public-storage');

    const cfg = JSON.parse(raw);
    const assertions = cfg?.ci?.assert?.assertions ?? {};
    expect(Object.keys(assertions).length).toBeGreaterThanOrEqual(8);
    for (const [key, value] of Object.entries(assertions)) {
      const level = Array.isArray(value) ? value[0] : value;
      expect(level, `assertion ${key} ne doit pas être "off"`).not.toBe('off');
    }
    expect(assertions['categories:performance']).toBeDefined();
    expect(assertions['largest-contentful-paint']).toBeDefined();
    expect(assertions['cumulative-layout-shift']).toBeDefined();
    expect(assertions['total-blocking-time']).toBeDefined();
    expect(assertions['server-response-time']).toBeDefined();
  });

  it('Icon.tsx et Icon/index.ts n’importent ni ne réexportent jamais tout lucide-react', () => {
    const iconSrc = read('src/components/ui/Icon/Icon.tsx');
    const indexSrc = read('src/components/ui/Icon/index.ts');
    expect(iconSrc).not.toMatch(/import\s+\*\s+as\s+\w+\s+from\s+['"]lucide-react['"]/);
    expect(indexSrc).not.toMatch(/export\s+\*\s+from\s+['"]lucide-react['"]/);
  });

  it('criticalQuerySnapshot.ts ne tire pas dexie/cacheDB en import statique', () => {
    const src = read('src/lib/storage/criticalQuerySnapshot.ts');
    expect(src).not.toMatch(/^\s*import\s+.*from\s+['"](?:\.\/cacheDB|dexie)['"]/m);
  });

  it('PageTransition.tsx préserve la clé sur les bascules d’onglets (zéro remontage)', () => {
    const src = read('src/components/ui/PageTransition.tsx');
    expect(src).toContain("instant ? 'tab-root' : pathname");
  });

  it('FloatingLiquidTabBar.tsx garde prefetch={false} sur Link et échelonne router.prefetch après load', () => {
    const src = read('src/components/mobile-nav/FloatingLiquidTabBar.tsx');
    expect(src).toContain('prefetch={false}');
    expect(src).toContain('router.prefetch');
  });

  it('AppImage.tsx optimise les hôtes autorisés (dont *.supabase.co) via next/image', () => {
    const src = read('src/components/ui/AppImage.tsx');
    expect(src).toContain('supabase.co');
    expect(src).not.toContain('unoptimized={unoptimized ?? isExternal}');
  });

  it('EventDetailClient.tsx charge PlaceMiniMap en dynamique (MapLibre hors JS initial)', () => {
    const src = read('src/app/sorties/[id]/EventDetailClient.tsx');
    expect(src).not.toMatch(/^\s*import\s+\{[^}]*PlaceMiniMap[^}]*\}\s+from/m);
    expect(src).toContain('dynamic(');
  });

  it('ExplorerV2.tsx charge ExplorerSheetHost et offlineRuntimeStore en dynamique', () => {
    const src = read('src/features/explorer-v2/ExplorerV2.tsx');
    expect(src).toContain("import('./sheet/ExplorerSheetHost')");
    expect(src).toContain("import('@/features/offline/offlineRuntimeStore')");
    expect(src).not.toMatch(/^\s*import\s+\{\s*getOfflineRuntimeStore\s*\}\s+from/m);
  });

  it('MapStage.tsx positionne .xp-pin par translate3d GPU (zéro CLS)', () => {
    const src = read('src/features/explorer-v2/map/MapStage.tsx');
    expect(src).toMatch(/className="xp-pin"[\s\S]{0,200}translate3d\(/);
  });

  it('Capacitor borne le splash screen à <= 1500 ms (cible démarrage à froid < 1,5 s)', () => {
    const capSrc = read('capacitor.config.ts');
    const matchCap = capSrc.match(/launchShowDuration:\s*(\d+)/);
    expect(matchCap).not.toBeNull();
    expect(Number(matchCap?.[1])).toBeLessThanOrEqual(1500);

    const bootSrc = read('src/components/NativeAppBootstrap.tsx');
    const matchBoot = bootSrc.match(/SPLASH_MAX_WAIT_MS\s*=\s*([\d_]+)/);
    expect(matchBoot).not.toBeNull();
    expect(Number(matchBoot?.[1].replace(/_/g, ''))).toBeLessThanOrEqual(1500);
  });
});
