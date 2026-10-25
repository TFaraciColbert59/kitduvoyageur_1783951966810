import { describe, it, expect } from 'vitest';
import { parseKitCsv } from '@/features/trips/domain/kitCatalogImport';

const HEADER = [
  'Produit',
  'Marge estimée (%)',
  'Situation / Besoin couvert',
  'Catégorie',
  'Justification',
  'Marque',
  'Priorité',
  'Dimensions',
  'Prix vente conseillé (€)',
  'Prix achat (€ HT)',
  'SKU / Réf BigBuy',
  'Note vérification',
  'Disponibilité',
  'Potentiel bundle',
  '#',
  'Sous-catégorie',
  'URL BigBuy',
  'Poids',
];

interface RowInput {
  name: string;
  margin?: string;
  situation?: string;
  category: string;
  justification?: string;
  brand: string;
  priority: string;
  dimensions?: string;
  sell?: string;
  cost?: string;
  sku: string;
  subcategory?: string;
  url?: string;
  weight?: string;
  num: string;
}

function row(input: RowInput): string[] {
  return [
    input.name,
    input.margin ?? '50',
    input.situation ?? '',
    input.category,
    input.justification ?? 'Justification',
    input.brand,
    input.priority,
    input.dimensions ?? '',
    input.sell ?? '',
    input.cost ?? '',
    input.sku,
    '✅ URL vérifiée BigBuy',
    '✅ Disponible',
    'Kit Test',
    input.num,
    input.subcategory ?? 'Divers',
    input.url ?? `https://www.bigbuy.eu/fr/shop/product/test_${input.sku}`,
    input.weight ?? '100 g',
  ];
}

const FIXTURE: string[][] = [
  HEADER,
  row({
    name: 'Lampe Frontale LED Rechargeable Black Diamond Spot 400',
    category: 'Éclairage',
    brand: 'Black Diamond',
    priority: '⭐⭐⭐ Indispensable',
    sell: '75',
    cost: '38',
    margin: '49',
    sku: '1051281',
    weight: '90 g',
    num: '1',
  }),
  row({
    name: 'Lampe Frontale Doublon Optionnel',
    category: 'Éclairage',
    brand: 'Black Diamond',
    priority: '⭐ Optionnel',
    sell: '12',
    cost: '6',
    sku: '1051281',
    weight: '200 g',
    num: '2',
  }),
  row({
    name: 'Bâton Trekking Aktive Télescopique 135 cm',
    category: 'Équipement du sac',
    brand: 'BigBuy Outdoor',
    priority: '⭐⭐ Recommandé',
    sell: '35',
    cost: '15',
    sku: '1300701',
    weight: '500 g/paire',
    num: '3',
  }),
  row({
    name: 'Bâton de Marche Télescopique Aluminium Aktive 135 cm',
    category: 'Équipement du sac',
    brand: 'BigBuy Outdoor',
    priority: '⭐⭐⭐ Indispensable',
    sell: '35',
    cost: '15',
    sku: '1300701',
    weight: '250 g/unité',
    num: '13',
  }),
  row({
    name: 'Tente Abri Camping – Catégorie BigBuy',
    category: 'Bivouac / Sommeil',
    brand: 'BigBuy Outdoor',
    priority: '⭐⭐⭐ Indispensable',
    sell: '65',
    cost: '30',
    sku: '1091707',
    weight: '1.5-2 kg',
    num: '14',
  }),
  row({
    name: 'Porte-Bébé Randonnée – Catégorie BigBuy',
    category: 'Randonée Famille',
    brand: 'BigBuy Outdoor',
    priority: '⭐⭐ Recommandé',
    sell: '75',
    cost: '35',
    sku: '1035428',
    weight: '1.2 kg',
    num: '51',
  }),
  row({
    name: 'Lanterne LED pour la Tête TM Electron',
    category: 'Éclairage',
    brand: 'TM Electron',
    priority: '⭐⭐ Recommandé',
    sell: '18',
    cost: '8',
    sku: '776399',
    weight: 'Léger',
    num: '52',
  }),
  row({
    name: 'Poncho Imperméable Pluie – Catégorie BigBuy',
    category: 'Vêtements / Protection',
    brand: 'BigBuy Outdoor',
    priority: '⭐⭐⭐ Indispensable',
    sell: '12',
    cost: '5',
    sku: 'Voir catégorie',
    weight: '150 g',
    num: '53',
  }),
];

describe('kitCatalogImport — parseKitCsv', () => {
  const parsed = parseKitCsv(FIXTURE);

  it('ignore l’en-tête (BOM toléré) et produit les colonnes exactes', () => {
    expect(parsed.products).toHaveLength(6);
    const headlamp = parsed.products.find((p) => p.sku === '1051281');
    expect(headlamp).toMatchObject({
      name: 'Lampe Frontale LED Rechargeable Black Diamond Spot 400',
      brand: 'Black Diamond',
      category: 'Éclairage',
      subcategory: 'Divers',
      priority: 'indispensable',
      weightGrams: 90,
      sellPriceEur: 75,
      costPriceEur: 38,
      marginPct: 49,
    });
    expect(headlamp?.url).toContain('_1051281');
  });

  it('déduplique par SKU : priorité la plus forte puis # le plus bas', () => {
    expect(parsed.report.duplicates.sort()).toEqual(['1051281', '1300701']);

    const winner = parsed.products.find((p) => p.sku === '1300701');
    expect(winner?.name).toBe('Bâton de Marche Télescopique Aluminium Aktive 135 cm');
    expect(winner?.priority).toBe('indispensable');
    expect(winner?.weightGrams).toBe(250);

    // Aucune fusion d’URL : seul le gagnant est conservé.
    expect(winner?.url).toContain('_1300701');
  });

  it('normalise les poids (g, kg, g/unité, g/paire) et signale les non numériques', () => {
    const bySku = new Map(parsed.products.map((p) => [p.sku, p]));
    expect(bySku.get('1035428')?.weightGrams).toBe(1200);
    expect(bySku.get('1091707')?.weightGrams).toBeNull();
    expect(bySku.get('776399')?.weightGrams).toBeNull();
    expect(parsed.report.nonNumericWeights).toEqual(['1.5-2 kg', 'Léger']);
  });

  it('corrige la catégorie « Randonée Famille » et la signale', () => {
    const family = parsed.products.find((p) => p.sku === '1035428');
    expect(family?.category).toBe('Randonnée Famille');
    expect(parsed.report.categoryFixes).toEqual(['Randonée Famille → Randonnée Famille']);
  });

  it('génère un slug kebab ascii-safe suffixé par le SKU', () => {
    const bySku = new Map(parsed.products.map((p) => [p.sku, p]));
    expect(bySku.get('1051281')?.slug).toBe(
      'lampe-frontale-led-rechargeable-black-diamond-spot-400-1051281'
    );
    expect(bySku.get('1035428')?.slug).toBe('porte-bebe-randonnee-categorie-bigbuy-1035428');
    expect(bySku.get('Voir catégorie')?.slug).toBe(
      'poncho-impermeable-pluie-categorie-bigbuy-voir-categorie'
    );
    for (const product of parsed.products) {
      expect(product.slug).toMatch(/^[a-z0-9-]+$/);
      expect(product.slug).not.toMatch(/--/);
    }
  });

  it('accepte un tableau sans en-tête (colonnes positionnelles)', () => {
    const withoutHeader = parseKitCsv(FIXTURE.slice(1));
    expect(withoutHeader.products).toHaveLength(parsed.products.length);
    expect(withoutHeader.products[0].sku).toBe('1051281');
  });

  it('est déterministe', () => {
    expect(JSON.stringify(parseKitCsv(FIXTURE))).toBe(JSON.stringify(parseKitCsv(FIXTURE)));
  });
});
