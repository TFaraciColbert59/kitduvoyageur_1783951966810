import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), 'utf8');

describe('wiring des sections Pays (desktop)', () => {
  it('enrichit Destinations, Activités, Gastronomie et ajoute Hébergements', () => {
    expect(read('src/components/pays/PaysDestinationsView.tsx')).toContain('category="attractions"');
    expect(read('src/components/pays/PaysActivitesView.tsx')).toContain('category="attractions"');
    expect(read('src/components/pays/PaysGastronomieView.tsx')).toContain('category="restaurants"');
    expect(read('src/components/pays/PaysHebergementsView.tsx')).toContain('category="hotels"');
    expect(read('src/components/pays/PaysHebergementsView.tsx')).toContain('limit={4}');
  });

  it('branche la section Hébergements dans la sidebar et la fiche desktop', () => {
    expect(read('src/components/pays/PaysLeftSidebar.tsx')).toContain("'hebergements'");
    expect(read('src/app/pays/[code]/CountryDetailClient.tsx')).toContain('PaysHebergementsView');
    expect(read('src/app/pays/[code]/CountryDetailClient.tsx')).toContain("case 'hebergements'");
  });
});

describe('wiring des sections Pays (mobile)', () => {
  it('ajoute les onglets Gastronomie et Hébergements avec blocs discovery', () => {
    const mobile = read('src/components/pays/MobileCountryDetailView.tsx');
    expect(mobile).toContain("'gastronomie'");
    expect(mobile).toContain("'hebergements'");
    expect(mobile).toContain('DiscoverySection');
    expect(mobile).toContain('category="restaurants"');
    expect(mobile).toContain('category="hotels"');
  });

  it('ajoute les onglets correspondants dans la barre mobile', () => {
    const tabBar = read('src/components/mobile-nav/BottomTabBar.tsx');
    expect(tabBar).toContain("{ id: 'gastronomie', label: 'Gastronomie' }");
    expect(tabBar).toContain("{ id: 'hebergements', label: 'Hébergements' }");
  });
});
