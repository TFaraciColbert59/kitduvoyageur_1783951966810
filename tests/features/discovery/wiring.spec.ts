import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), 'utf8');

/**
 * Wiring des blocs partenaire et des volets sur la fiche pays.
 * Depuis la refonte, la coquille est `PaysGlassV8` et les vues détaillées
 * (qui portent `DiscoverySection`) sont montées dans le premier écran du
 * premier volet du drawer via `CountryDetailClient`. Ces assertions protègent
 * ce câblage.
 */
describe('wiring des sections Pays', () => {
  it('enrichit Destinations, Activités, Gastronomie et ajoute Hébergements', () => {
    expect(read('src/components/pays/PaysDestinationsView.tsx')).toContain('category="attractions"');
    expect(read('src/components/pays/PaysActivitesView.tsx')).toContain('category="attractions"');
    expect(read('src/components/pays/PaysGastronomieView.tsx')).toContain('category="restaurants"');
    expect(read('src/components/pays/PaysHebergementsView.tsx')).toContain('category="hotels"');
    expect(read('src/components/pays/PaysHebergementsView.tsx')).toContain('limit={4}');
  });

  it('branche les vues détaillées dans le premier écran du premier volet', () => {
    const client = read('src/app/pays/[code]/CountryDetailClient.tsx');
    expect(client).toContain('PaysHebergementsView');
    expect(client).toContain("case 'hebergements'");
    expect(client).toContain('PaysGlassV8');
    expect(client).toContain('renderDetails');
    const glass = read('src/components/pays/PaysGlassV8.tsx');
    expect(glass).toContain('renderDetails?.(section)');
    expect(glass).toContain('LensPager');
    expect(glass).toContain('PaysRegionGrid');
    expect(glass).toContain('PaysCarnetFeed');
    expect(glass).toContain('hideTitle');
    expect(glass).toContain('formatAreaShort');
    for (const tab of ['fiche', 'carnets', 'groupes', 'bouteille', 'historique']) {
      expect(glass).toContain(`id: '${tab}'`);
    }
  });

  it('garde les onglets Gastronomie et Hébergements dans le plateau mobile', () => {
    const plateau = read('src/components/mobile-nav/navigation/NavigationPlateau.tsx');
    expect(plateau).toContain("{ id: 'gastronomie', label: 'Gastronomie' }");
    expect(plateau).toContain("{ id: 'hebergements', label: 'Hébergements' }");
  });
});
