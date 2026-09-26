import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const navigationSurface = readFileSync(
  'src/components/mobile-nav/navigation/NavigationSurface.tsx',
  'utf8',
);
const webNavigationBar = readFileSync(
  'src/components/mobile-nav/navigation/WebNavigationBar.tsx',
  'utf8',
);
const tabItem = readFileSync('src/components/mobile-nav/navigation/TabItem.tsx', 'utf8');
const hubLiquid = readFileSync('src/features/hub/components/hub-liquid.css', 'utf8');
const sectionCarousel = readFileSync(
  'src/features/hub/components/mobile/SectionCarousel.tsx',
  'utf8',
);
const infoChipsRow = readFileSync(
  'src/features/hub/components/mobile/InfoChipsRow.tsx',
  'utf8',
);
const nextActionCard = readFileSync(
  'src/features/hub/components/menu/NextActionCard.tsx',
  'utf8',
);
const hubShell = readFileSync('src/features/hub/components/HubShell.tsx', 'utf8');
const mobileAdventureHub = readFileSync(
  'src/features/hub/components/mobile/MobileAdventureHub.tsx',
  'utf8',
);
const hubEdgeDrawer = readFileSync(
  'src/features/hub/components/mobile/HubEdgeDrawer.tsx',
  'utf8',
);
const sortieMenu = readFileSync(
  'src/features/hub/components/menu/SortieMenu.tsx',
  'utf8',
);
const possessionMenu = readFileSync(
  'src/features/hub/components/menu/PossessionMenu.tsx',
  'utf8',
);
const collectifMenu = readFileSync(
  'src/features/hub/components/menu/CollectifMenu.tsx',
  'utf8',
);
const sortieMoment = readFileSync(
  'src/features/hub/components/mobile/moments/SortieMoment.tsx',
  'utf8',
);
const hubAdventureData = readFileSync(
  'src/features/hub/server/getHubAdventureData.ts',
  'utf8',
);
const momentMapCard = readFileSync(
  'src/features/hub/components/mobile/MomentMapCard.tsx',
  'utf8',
);
const hubGlobeMap = existsSync('src/features/hub/components/mobile/HubGlobeMap.tsx')
  ? readFileSync('src/features/hub/components/mobile/HubGlobeMap.tsx', 'utf8')
  : '';
const maProgressionView = readFileSync(
  'src/components/progression/MaProgressionView.tsx',
  'utf8',
);
const progressionCompactCard = readFileSync(
  'src/components/progression/ProgressionCompactCard.tsx',
  'utf8',
);

describe('Hub — rendu Liquid Glass iOS 27', () => {
  it('la navigation du Hub monte une vraie surface de réfraction', () => {
    expect(navigationSurface).toContain("import LiquidGlass from '@/components/glass/LiquidGlass'");
    expect(navigationSurface).toContain('opticalNavigation?: boolean');
    expect(navigationSurface).toContain('priority="control"');
    expect(navigationSurface).toContain('className="lkv-nav-refraction"');
    expect(webNavigationBar).toContain('isHubSurfacePathname(pathname)');
    expect(webNavigationBar).toContain('opticalNavigation={opticalNavigation}');
  });

  it('la sélection active est une petite lentille interne et non une capsule opaque', () => {
    expect(tabItem).toContain('className="lkv-nav-active-lens"');
    expect(tabItem).not.toContain("background: 'var(--g2-bg)'");
  });

  it('ne force plus tous les matériaux du Hub en blanc laiteux', () => {
    expect(hubLiquid).not.toContain(
      'body:has(.hub-liquid-root) :is(.glass, .lkv-glass, .glass-sub-card, .lkv-material-bar),',
    );
    expect(hubLiquid).toContain('.lkv-nav-refraction');
    expect(hubLiquid).toContain('.hub-section-control');
    expect(hubLiquid).toContain('.hub-chip-control');
    expect(hubLiquid).toContain('.hub-content-material');
    expect(hubLiquid).toContain('prefers-reduced-transparency');
  });

  it('distingue les contrôles optiques des grandes surfaces de contenu', () => {
    expect(sectionCarousel).toContain('hub-section-control');
    expect(infoChipsRow).toContain('hub-chip-control');
    expect(nextActionCard).toContain('hub-control-material');
  });

  it('garde les surfaces de contenu reellement transmissives', () => {
    // Un voile blanc superieur a 0.08 sur les grandes surfaces relit comme un
    // aplat laiteux et masque la photo : c est le bug visuel a ne pas
    // reinstaurer. On verifie les opacites declarees dans le CSS.
    const surfaceBlock = hubLiquid.slice(
      hubLiquid.indexOf('.hub-content-material {'),
      hubLiquid.indexOf('.hub-content-material :is(button'),
    );
    // On ne verifie que les fonds : une bordure ou un inset a 0.26 est une
    // signature de verre fine, pas un voile laiteux.
    const backgroundDecl = surfaceBlock.match(/background:[^;]+;/g)?.join(' ') ?? '';
    const alphas = [...backgroundDecl.matchAll(/rgba\(\d+, \d+, \d+, ([\d.]+)\)/g)].map(
      (m) => Number(m[1]),
    );
    expect(alphas.length).toBeGreaterThan(0);
    for (const alpha of alphas) {
      expect(alpha).toBeLessThanOrEqual(0.55);
    }

    // Le voile global de page doit rester residuel.
    const scrim = hubLiquid.match(/--lkv-app-bg-scrim: rgba\([^)]*?([\d.]+)\)/);
    expect(scrim).not.toBeNull();
    expect(Number(scrim?.[1])).toBeLessThanOrEqual(0.05);
  });

  it('compense la transparence par un halo texte plutot que par un voile', () => {
    // Sur un verre transmissif, le texte n a plus de fond porteur : il faut un
    // halo, sinon il lave sur le ciel clair de la photo de fond.
    // Le materiau est le quasi-noir #101010 d Apple, donc le texte est blanc.
    expect(hubLiquid).toContain('--hub-smoke: rgba(16, 16, 16, 0.3)');
    expect(hubLiquid).toMatch(/text-shadow:[^;]*rgba\(0, 0, 0/);
  });

  it('reproduit la recette Fill + Shadow du kit iOS 27 sur tous les materiaux', () => {
    // Base #101010, voile blanc 4 % en plus-lighter, rim 4 couches.
    expect(hubLiquid).toContain('--hub-glass-base: #101010');
    expect(hubLiquid).toContain(
      'linear-gradient(0deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.04))',
    );
    expect(hubLiquid).toContain('background-blend-mode: luminosity, plus-lighter');
    expect(hubLiquid).toContain('1.25px 0 0 -0.75px var(--hub-glass-rim-soft)');
    expect(hubLiquid).toContain('0 0 0 0.5px var(--hub-glass-rim)');
    expect(hubLiquid).toContain('0 8px 15px rgba(0, 0, 0, 0.02)');

    // Chaque materiau du Hub doit porter la recette, pas un vert forestier.
    // Les selecteurs sont ancres en debut de ligne pour attraper la
    // *definition* du materiau, pas sa mention dans un selecteur groupe.
    for (const selector of [
      '.hub-content-material',
      '.hub-control-material',
      '.hub-section-control',
      '.hub-chip-control',
      '.hub-control-lens',
      '.hub-liquid-action',
    ]) {
      const anchor = new RegExp('^' + selector.replace('.', '\\.') + ' \\{', 'm');
      const match = anchor.exec(hubLiquid);
      expect(match, selector).not.toBeNull();
      const block = hubLiquid.slice(match!.index, match!.index + 900);
      expect(block, selector).toContain('box-shadow: var(--hub-glass-shadow) !important;');
      expect(block, selector).not.toMatch(/rgba\(11, 27, 20|rgba\(20, 43, 33/);
    }
  });

  it('aligne la barre de navigation sur la recette Apple', () => {
    // La teinte du composant ne doit plus etre forestiere.
    expect(navigationSurface).toContain('glassTint="rgba(16, 16, 16, 0.14)"');
    expect(navigationSurface).not.toContain('rgba(16, 38, 28, 0.4)');
    expect(navigationSurface).toContain('shadow="0 8px 15px rgba(0, 0, 0, 0.02)"');
    // Symbols : blanc plein actif, #D9D9D9 inactif.
    expect(tabItem).toContain("'var(--hub-label-primary)'");
    expect(tabItem).toContain("'var(--hub-symbol)'");
  });

  it('verrou de transmission : aucun materiau du Hub ne depasse 0.34 d opacite', () => {
    // Le verre natif est un filtre : sous 0.34 d alpha, la photo traverse
    // reellement la barre comme les cartes. C est le cahier des charge
    // « beaucoup plus translucide » ; on verifie chaque bloc de materiau.
    for (const selector of [
      '.hub-content-material',
      '.hub-control-material',
      '.hub-section-control',
      '.hub-chip-control',
      '.hub-control-lens',
      '.hub-liquid-action',
    ]) {
      const re = new RegExp('^' + selector.replace('.', '\\.') + ' \\{', 'm');
      const match = re.exec(hubLiquid);
      expect(match, selector).not.toBeNull();
      const block = hubLiquid.slice(match!.index, match!.index + 900);
      const bg = block.match(/background:[^;]+;/g)?.join(' ') ?? '';
      const alphas = [...bg.matchAll(/rgba\(\d+, \d+, \d+, ([\d.]+)\)/g)].map(
        (m) => Number(m[1]),
      );
      for (const alpha of alphas) {
        expect(alpha, selector).toBeLessThanOrEqual(0.34);
      }
    }
    // La barre de navigation suit la meme densite.
    const bar = hubLiquid.slice(
      hubLiquid.indexOf(".lkv-material-bar,"),
      hubLiquid.indexOf('.lkv-material-bar::before'),
    );
    const barAlphas = [...bar.matchAll(/rgba\(16, 16, 16, ([\d.]+)\)/g)].map(
      (m) => Number(m[1]),
    );
    expect(barAlphas.length).toBeGreaterThan(0);
    for (const alpha of barAlphas) {
      expect(alpha).toBeLessThanOrEqual(0.3);
    }
  });

  it('applique le blanc Apple et ses trois niveaux de vibrancy', () => {
    // Blanc pur pour le label primaire, meme #FFFFFF en opacite reduite pour
    // les niveaux secondary et tertiary.
    expect(hubLiquid).toContain('--hub-white: #ffffff');
    expect(hubLiquid).toContain('--hub-white-secondary: rgba(255, 255, 255, 0.71)');
    expect(hubLiquid).toContain('--hub-white-tertiary: rgba(255, 255, 255, 0.5)');
    expect(hubLiquid).toContain('color: var(--hub-white) !important');
  });
});


describe('Hub — tiroirs lateraux mobile', () => {
  it('supprime le titre et le sous-titre de la page sur le hub', () => {
    expect(hubShell).not.toContain('<header');
    expect(hubShell).not.toContain('Le Kit du Voyageur');
    expect(hubShell).not.toContain('Mon aventure');
  });

  it('reduit le cockpit aventure en tiroir cockpit sur le bord droit', () => {
    expect(hubShell).toContain('<HubEdgeDrawer kind="cockpit" slot="bottom"');
    expect(hubShell).not.toContain('icon={Compass}');
    expect(hubEdgeDrawer).toContain("cockpit: { icon: Compass");
  });

  it('reduit l etat et la progression en deux tiroirs sans casser la frontiere RSC', () => {
    // MobileAdventureHub doit rester un Server Component : les tuiles portent
    // des references de composants lucide, incompatibles avec un prop de
    // fonction traverse vers un Client Component.
    expect(mobileAdventureHub.trimStart().startsWith("'use client'")).toBe(false);
    expect(mobileAdventureHub).toContain('<HubEdgeDrawer kind="status" slot="top"');
    expect(mobileAdventureHub).toContain('<HubEdgeDrawer kind="progression" slot="mid"');
    expect(mobileAdventureHub).not.toContain('icon={');
  });

  it('resout les icones des poignees dans le composant client via KIND_META', () => {
    expect(hubEdgeDrawer).toContain('const KIND_META');
    expect(hubEdgeDrawer).toContain("status: { icon: CircleCheckBig");
    expect(hubEdgeDrawer).toContain("progression: { icon: Trophy");
    expect(hubEdgeDrawer).toContain('kind: HubEdgeKind;');
  });

  it('supprime la barre de progression du flux mobile', () => {
    // La barre de preparation reste reservee au bloc desktop lg:flex.
    expect(sortieMenu).not.toContain('rail={<ActivityPreparationStatus/>}');
    expect(sortieMenu).toContain('statusSlot={');
    expect(sortieMenu).toContain('progressionSlot={<ProgressionCompactCard variant="drawer" />}');
    expect(possessionMenu).toContain('progressionSlot={<ProgressionCompactCard variant="drawer" />}');
    expect(collectifMenu).toContain('progressionSlot={<ProgressionCompactCard variant="drawer" />}');
  });

  it('style les trois poignees et le panneau avec le meme materiau de verre', () => {
    expect(hubLiquid).toContain('.hub-edge-trigger {');
    expect(hubLiquid).toContain('.hub-edge-trigger--top { top: 32%; }');
    expect(hubLiquid).toContain('.hub-edge-trigger--mid { top: 50%; }');
    expect(hubLiquid).toContain('.hub-edge-trigger--bottom { top: 68%; }');
    expect(hubLiquid).toContain('.hub-edge-panel__surface');
    expect(hubLiquid).toContain('backdrop-filter: blur(30px) saturate(200%)');
  });

  it('condense la progression dans le tiroir et supprime la page dediee', () => {
    expect(mobileAdventureHub).toContain('progressionSlot ??');
    expect(progressionCompactCard).toContain("variant?: 'card' | 'drawer'");
    expect(progressionCompactCard).toContain('presentation="drawer"');
    expect(maProgressionView).toContain("presentation?: 'page' | 'drawer'");
    expect(maProgressionView).toContain("presentation === 'drawer'");
    expect(existsSync('src/app/progression/route.ts')).toBe(true);
    expect(existsSync('src/app/progression/page.tsx')).toBe(false);
  });

  it('utilise le moteur cartographique unifie d Explorer sur la carte du hub', () => {
    expect(momentMapCard).not.toContain('Agrandir la carte');
    expect(momentMapCard).not.toContain('aria-haspopup="dialog"');
    expect(momentMapCard).toContain('<HubGlobeMap');
    expect(hubGlobeMap).toContain("import('@/components/map/UnifiedExplorerMap')");
    expect(hubGlobeMap).toContain('selectedTrail={selectedTrail}');
    expect(hubGlobeMap).toContain('pois={unifiedPois}');
    expect(hubGlobeMap).toContain('compact');
    expect(hubGlobeMap).toContain('onPoiClick');
  });

  it('laisse les gestes de la carte reaching le canvas sans bloquer le panneau', () => {
    expect(momentMapCard).toContain('pointer-events-none relative z-20');
    expect(momentMapCard).toContain('hub-map-card__panel pointer-events-auto');
    expect(hubLiquid).toMatch(/\.hub-globe-map__loading,\s*\.hub-globe-map__empty \{[^}]*pointer-events: none;/);
    expect(hubLiquid).toMatch(/\.hub-globe-poi-rail \{[^}]*pointer-events: none;/);
    expect(hubLiquid).toMatch(/\.hub-globe-poi-chip \{[^}]*pointer-events: auto;/);
  });

  it('charge la vraie geometrie et expose tous les POI du voyage sur le globe', () => {
    expect(hubAdventureData).toContain("supabase.rpc('get_route_geojson', { p_route_id: numericId })");
    expect(hubAdventureData).not.toContain("select('id, name, distance_km, geom')");
    expect(hubAdventureData).toContain('routeGeojson');
    expect(sortieMoment).toContain('routeGeojson={hiking?.routeGeojson ?? null}');
    expect(hubGlobeMap).toContain('routeGeojson?: Record<string, unknown> | null');
    expect(hubGlobeMap).toContain('sanitizeGeoJSON(routeGeojson)');
    expect(hubGlobeMap).not.toContain('unifiedPois.slice(0, 6)');
    expect(momentMapCard).toContain('routeGeojson?: Record<string, unknown> | null');
  });

  it('retire le materiau derriere les icones de tuiles', () => {
    expect(sectionCarousel).toContain('hub-tile-glyph');
    expect(sectionCarousel).not.toMatch(/hub-tile-glyph[^\n]*hub-control-lens/);
    expect(hubLiquid).toMatch(/\.hub-tile-glyph \{[^}]*background: none;/);
  });

});
