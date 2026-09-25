import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

/**
 * P5 — DIRECTION VISUELLE (spec 2026-09-19 §6)
 *
 * Verrouille la palette clair/sombre, les échelles (espacements, rayons,
 * typographie), les états sombres complets et le câblage honnête du mode
 * sombre (prefers-color-scheme + classe .dark). Les valeurs exactes viennent
 * du dossier de lancement « Direction visuelle mobile ».
 */

const tokens = readFileSync('src/styles/tokens.css', 'utf8');
const tailwind = readFileSync('src/styles/tailwind.css', 'utf8');
const liquidGlass = readFileSync('src/styles/liquid-glass.css', 'utf8');
const layout = readFileSync('src/app/layout.tsx', 'utf8');
const home = readFileSync('src/app/page.tsx', 'utf8');
const momentMap = readFileSync('src/features/hub/components/mobile/MomentMapCard.tsx', 'utf8');
const mobileCompte = readFileSync('src/components/compte/MobileCompteV2.tsx', 'utf8');
const infoChips = readFileSync('src/features/hub/components/mobile/InfoChipsRow.tsx', 'utf8');
const weather = readFileSync('src/features/hub/components/weather/WeatherStrip.tsx', 'utf8');
const material = readFileSync('src/app/materiel/page.tsx', 'utf8');
const boutique = readFileSync('src/app/boutique/page.tsx', 'utf8');
const community = readFileSync('src/components/communaute/MobileCommunityHeader.tsx', 'utf8');
const sortieMenu = readFileSync('src/features/hub/components/menu/SortieMenu.tsx', 'utf8');
const tabs = readFileSync('src/components/ui/Tabs.tsx', 'utf8');
const pageHeader = readFileSync('src/components/ui/PageHeader.tsx', 'utf8');
const navigationPlateau = readFileSync('src/components/mobile-nav/navigation/NavigationPlateau.tsx', 'utf8');
const interactiveMap = readFileSync('src/components/map/InteractiveMap.tsx', 'utf8');
const trailLayer = readFileSync('src/components/explorer/TrailLayer.tsx', 'utf8');
const carteClient = readFileSync('src/app/carte-interactive/CarteClient.tsx', 'utf8');
const explorerMap = readFileSync('src/components/explorer/ExplorerMap.tsx', 'utf8');

describe('P5 — direction visuelle : palette', () => {
  it('palette claire exacte (fond, surface, textes, action, accent)', () => {
    expect(tokens).toContain('--lkv-surface: #F5F7F3;');
    expect(tokens).toContain('--lkv-surface-card: #FFFFFF;');
    expect(tokens).toContain('--lkv-text-primary: #172B24;');
    expect(tokens).toContain('--lkv-text-secondary: #56665D;');
    expect(tokens).toContain('--lkv-action: #226148;');
    expect(tokens).toContain('--lkv-primary-subtle: #D3EBD9;');
  });

  it('le vert forêt de marque (#17402C) reste disponible pour les titres', () => {
    expect(tokens).toContain('--lkv-primary: #17402C;');
  });

  it('palette sombre complète : fond, surface, texte et tous les états', () => {
    const dark = tokens.slice(tokens.indexOf('.dark {'));
    expect(dark).toContain('--lkv-surface: #101C17;');
    expect(dark).toContain('--lkv-surface-card: #1B2D24;');
    expect(dark).toContain('--lkv-text-primary: #F1F5F1;');
    // États complétés, pas seulement l'inversion du fond.
    expect(dark).toContain('--lkv-action:');
    expect(dark).toContain('--lkv-border:');
    expect(dark).toContain('--lkv-field-bg:');
    expect(dark).toContain('--lkv-field-border:');
    expect(dark).toContain('--lkv-hover-surface:');
    expect(dark).toContain('--lkv-focus-ring:');
    expect(dark).toContain('--lkv-disabled-bg:');
    expect(dark).toContain('--lkv-disabled-text:');
    expect(dark).toContain('--glass-text:');
    expect(dark).toContain('--glass-border:');
    expect(dark).toContain('--btn-tint:');
    expect(dark).toContain('--btn-content:');
    expect(dark).toContain('--card-tint:');
    expect(dark).toContain('--card-content:');
    expect(dark).toContain('color-scheme: dark;');
  });

  it('le verre clair utilise un contenu sombre (pas de texte blanc inversé)', () => {
    expect(tokens).toContain('--glass-text-secondary: rgba(23, 43, 36, 0.74);');
    expect(tokens).toContain('--card-content: var(--lkv-text-primary);');
    expect(tokens).toContain('--btn-on-solid: var(--lkv-on-action);');
  });

  it('donne aux surfaces cartes et sous-cartes un fond adaptatif mesurable', () => {
    expect(tokens).toContain('--lkv-success: #3D6038;');
    expect(liquidGlass).toContain('.glass-sub-card {');
    expect(liquidGlass).toContain('background: var(--card-tint);');
    expect(liquidGlass).toContain('--glass-tint: var(--card-tint-solid);');
  });

  it('stabilise les surfaces mobiles et les textes de compte sur les deux thèmes', () => {
    expect(mobileCompte).toContain('bg-[color:var(--card-tint-strong)]');
    expect(mobileCompte).not.toContain('bg-white/75');
    expect(mobileCompte).toContain('text-[color:var(--lkv-text-secondary)]');
    expect(infoChips).toContain('bg-[color:var(--glass-bg-medium)]');
    expect(infoChips).not.toContain('bg-white/70');
    expect(infoChips).not.toContain('opacity-70');
  });

  it('utilise une encre primaire pour les citations de carnet sur fond clair', () => {
    expect(mobileCompte).toContain('italic leading-snug text-[color:var(--lkv-text-primary)]');
    expect(mobileCompte).not.toContain('italic leading-snug text-[color:var(--lkv-text-inverted)]');
  });

  it('garde les tabs du compte dans leur largeur mobile et rend le badge lisible', () => {
    expect(tabs).toContain('text-[length:var(--lkv-text-caption-2)]');
    expect(tabs).toContain('px-1');
    expect(tabs).toContain('min-w-[var(--lkv-touch-min)]');
    expect(mobileCompte).toContain('lkv-rim-btn text-[color:var(--lkv-text-primary)] font-semibold');
    expect(mobileCompte).toContain('aria-hidden="true"');
  });

  it('sépare les onglets défilants des actions de vue sur mobile', () => {
    expect(mobileCompte).toContain('hidden min-[360px]:flex items-center gap-0.5');
    expect(mobileCompte).toContain('size="md"');
    expect(mobileCompte).toContain('flex items-center justify-between gap-1');
    expect((mobileCompte.match(/aria-label="Vue Grille"/g) || []).length).toBe(1);
  });

  it('réserve le header du compte sur les petits écrans', () => {
    expect(mobileCompte).toContain('min-w-0 max-w-[132px] sm:max-w-none');
    expect(mobileCompte).toContain('<span className="truncate">{handleName}</span>');
  });

  it('renforce les petites surfaces textuelles des écrans clés', () => {
    expect(home).not.toContain('text-[var(--lkv-text-muted)] font-semibold mb-0.5');
    expect(weather).toContain('bg-[color:var(--card-tint-solid)]');
    expect(material).toContain('text-[var(--lkv-text-primary)]');
    expect(boutique).toContain('text-[color:var(--lkv-text-primary)]');
    expect(community).toContain('text-[color:var(--lkv-text-primary)]');
    expect(sortieMenu).toContain('bg-[color:var(--card-tint-solid)]');
    expect(mobileCompte).toContain('bg-[color:var(--lkv-forest-950)]');
    expect(tokens).toContain('background: var(--card-tint-solid) !important;');
  });

  it('expose des encre sémantiques lisibles sur les surfaces primaires et sombres', () => {
    expect(tokens).toContain('--lkv-app-bg-fallback: #F5F7F3;');
    expect(tokens).toContain('--lkv-on-primary: #FFFFFF;');
    expect(tokens).toContain('--lkv-on-primary-muted: #E7F0E8;');
    expect(tokens).toContain('--lkv-on-dark: #FFFFFF;');
    expect(tokens).toContain('--lkv-on-dark-muted: #E7F0E8;');
    expect(tokens).toContain('--lkv-text-muted: #46584D;');
    expect(tokens).toContain('--card-tint: rgb(255 255 255 / calc(0.90 + 0.08 * var(--glass-intensity, 0.5)));');
    expect(tokens).toContain('--card-tint-strong: rgb(255 255 255 / calc(0.95 + 0.04 * var(--glass-intensity, 0.5)));');
  });

  it('adapt les sections d’accueil transparentes aux deux thèmes', () => {
    expect(home).toContain('text-[var(--lkv-text-primary)]');
    expect(home).toContain('text-[var(--lkv-text-secondary)]');
    expect(home).toContain('text-[var(--lkv-text-primary)] text-sm max-w-sm uppercase font-mono');
    expect(home).toContain('bg-[var(--lkv-primary)] lg:right-1/2');
    expect(home).not.toContain('bg-[radial-gradient(ellipse_at_center');
    expect(home).not.toContain('bg-gradient-to-t from-black/80 via-black/20 to-transparent');
    expect(home).not.toContain('className="text-4xl md:text-5xl font-semibold text-[var(--stone-50)] leading-[1.1] mb-16"');
    expect(home).not.toContain('text-[var(--lkv-forest-100)] text-sm max-w-sm');
  });

  it('compacte le hero d’accueil pour garder la réservation visible', () => {
     expect(home).toContain('pt-10 min-[360px]:pt-16 sm:pt-32');
     expect(home).toContain('pt-0 min-[360px]:pt-4');
     expect(home).toContain('text-4xl min-[360px]:text-5xl');
     expect(home).toContain('gap-3 mb-6 min-[360px]:gap-4 min-[360px]:mb-8');
     expect(home).toContain('mb-8 sm:mb-14');
     expect(home).toContain('mb-2 sm:mb-4');
     expect(home).toContain('mb-4 sm:mb-10');
     expect(home).toContain('p-4 sm:p-6');
     expect(home).toContain('mb-2 sm:mb-6');
     expect(home).toContain('mb-4 sm:mb-6');
     expect(home).toContain('mb-4 sm:mb-8');

  });

  it('compacte la surface Matériel avant la navigation mobile', () => {
    expect(material).toContain('space-y-2 sm:space-y-4 font-sans');
    expect(material).toContain('px-3.5 pb-24 pt-2 font-sans');
    expect(material).toContain('space-y-1 sm:space-y-2');
    expect(material).toContain('mt-0 sm:mt-4');
    expect(material).toContain('Section as="div" title="Accès" className="pt-8 md:pt-0"');
  });

  it('renforce les libellés des statistiques du compte', () => {
    expect(mobileCompte).not.toMatch(/text-\[11px\][^>]*text-\[color:var\(--lkv-text-muted\)\][^>]*>\s*Voyages/);
  });

  it('applique l’encre sémantique aux liens d’attribution Leaflet', () => {
    expect(tokens).toMatch(/\.leaflet-control-attribution a\s*\{\s*color: var\(--lkv-text-primary\) !important;\s*\}/);
  });

  it('écarte l’attribution Leaflet du contrôle de zoom sur mobile', () => {
    expect(tokens).toMatch(/@media \(max-width: 767px\)[\s\S]*\.leaflet-bottom\.leaflet-right[\s\S]*bottom: calc\(var\(--content-pb, 88px\) \+ 48px\) !important;[\s\S]*left: 12px !important;[\s\S]*\.leaflet-bottom\.leaflet-right \.leaflet-control-attribution[\s\S]*float: none !important;/);
  });

  it('réserve l’espace nécessaire avant la navigation sur Matériel', () => {
    expect(material).toContain('space-y-4 font-sans');
  });

  it('renforce le sous-titre des en-têtes de page', () => {
    expect(pageHeader).toMatch(/mt-\[var\(--space-1\)\][^>]*text-\[color:var\(--lkv-text-primary\)\]/);
  });

  it('stabilise les contrastes de la navigation et des marqueurs cartographiques', () => {
    expect(navigationPlateau).toContain("background: 'var(--g1-bg)'");
    expect(interactiveMap).toContain("bgColor = '#0C4A6E'");
    expect(trailLayer).toContain("bgColor = '#0C4A6E'");
    expect(carteClient).toContain('hasBottomNav={true}');
  });

  it('isole le nombre des clusters de son emoji décoratif', () => {
    expect(interactiveMap).toContain('style="position: absolute; left: 2px;');
    expect(interactiveMap).toContain('<span>${count}</span>');
    expect(trailLayer).toContain('style="position: absolute; left: 2px;');
    expect(trailLayer).toContain('<span>${count}</span>');
  });

  it('déplace le sélecteur de fond de carte au-dessus de l’attribution', () => {
    expect(interactiveMap).toContain('bottom-[calc(var(--map-control-bottom)+88px)]');
  });

  it('initialise les contrôles cartographiques en mode mobile avant peinture', () => {
    expect(explorerMap).toContain("useState(() => typeof window !== 'undefined' && window.innerWidth < 768)");
  });

  it('rend les pastilles de la carte mesurables', () => {
    expect(momentMap).toContain('bg-[var(--lkv-forest-950)]');
    expect(momentMap).toContain('text-[var(--lkv-on-dark)]');
    expect(momentMap).not.toContain('bg-black/35');
    expect(momentMap).not.toContain('bg-gradient-to-b from-black/40 via-black/0 to-black/5');
  });
});

describe('P5 — échelles espacements, rayons et typographie', () => {
  it('échelle espacements 4/8/12/16/24/32 disponible + marge écran 16', () => {
    for (const [name, value] of [
      ['--space-1', '4px'],
      ['--space-2', '8px'],
      ['--space-3', '12px'],
      ['--space-4', '16px'],
      ['--space-6', '24px'],
      ['--space-8', '32px'],
    ] as const) {
      expect(tokens, `${name} doit valoir ${value}`).toContain(`${name}: ${value};`);
    }
    expect(tokens).toContain('--lkv-screen-margin: 16px;');
    expect(tailwind).toContain('.lkv-screen-x');
  });

  it('rayons Phase 3 : cartes 28, feuilles 36, contrôles 18, nav 32', () => {
    expect(tokens).toContain('--lkv-radius-md: 18px;');
    expect(tokens).toContain('--lkv-radius-lg: 24px;');
    expect(tokens).toContain('--lkv-radius-card: 28px;');
    expect(tokens).toContain('--lkv-radius-sheet: 36px;');
    expect(tokens).toContain('--lkv-radius-nav: 32px;');
    expect(tokens).toContain('--lkv-radius-concentric:');
  });

  it('typographie Phase 2 : échelle Dynamic Type iOS (body 17, large title 34)', () => {
    expect(tokens).toContain('--lkv-text-body: 1.0625rem;');
    expect(tokens).toContain('--lkv-text-body-sm: 0.9375rem;');
    expect(tokens).toContain('--lkv-text-title-sm: 1.375rem;');
    expect(tokens).toContain('--lkv-text-title-lg: 2.125rem;');
    expect(tokens).toContain('--lkv-font-numeric: tabular-nums;');
    expect(tailwind).toContain('.text-lkv-body');
    expect(tailwind).toContain('.text-lkv-title-lg');
  });

  it('SF Pro (système) pour toute l\'UI, Manrope conservée pour la marque', () => {
    expect(tokens).toContain("--font-display: -apple-system, BlinkMacSystemFont, 'SF Pro Display'");
    expect(tokens).toContain("--font-brand: 'Manrope'");
    expect(tokens).toContain("--font-sans: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto");
  });
});

describe('P5 — câblage du mode sombre et topographie', () => {
  it('layout.tsx initialise le thème depuis la préférence système ou le choix stocké', () => {
    expect(layout).toContain("colorScheme: 'light dark'");
    expect(layout).toContain("localStorage.getItem('lkdv_theme')");
    expect(layout).toContain("matchMedia('(prefers-color-scheme: dark)')");
    expect(layout).toContain("classList.add('dark')");
    expect(layout).toContain("classList.remove('dark')");
    expect(layout).toContain("setAttribute('data-theme'");
  });

  it('tailwind.css mappe le clair sur les tokens et ne fige plus de couleurs .dark', () => {
    expect(tailwind).toContain('--background: var(--lkv-surface);');
    expect(tailwind).toContain('--foreground: var(--lkv-text-primary);');
    expect(tailwind).toContain('--primary: var(--lkv-action);');
    expect(tailwind).toContain('color-scheme: light;');
    expect(tailwind).toContain('color-scheme: dark;');
  });

  it('background LKDV Phase 3 : toile unique portrait/paysage + voile', () => {
    expect(tokens).toContain('--lkv-app-bg-image-portrait:');
    expect(tokens).toContain('--lkv-app-bg-image-landscape:');
    expect(tokens).toContain('--lkv-app-bg-scrim:');
    expect(tailwind).toContain('var(--lkv-app-bg-image-portrait)');
    expect(tailwind).toContain('@media (min-aspect-ratio: 1 / 1)');
    expect(tailwind).toContain('var(--lkv-app-bg-image-landscape)');
  });
});
