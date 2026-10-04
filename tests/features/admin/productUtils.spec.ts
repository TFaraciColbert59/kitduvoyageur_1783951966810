import { describe, expect, it } from 'vitest';

import {
  buildProductsCsv,
  formatPriceEur,
  slugify,
  type ShopProduct,
} from '@/features/admin/productUtils';

describe('slugify', () => {
  it('replie les accents et normalise les espaces', () => {
    expect(slugify('Équipement du Sac')).toBe('equipement-du-sac');
  });

  it('supprime la ponctuation et condense les tirets', () => {
    expect(slugify('  Sac  à dos — 65L ! ')).toBe('sac-a-dos-65l');
  });

  it('retourne une chaîne vide pour une entrée vide', () => {
    expect(slugify('')).toBe('');
  });
});

const product = (overrides: Partial<ShopProduct> = {}): ShopProduct => ({
  id: 'p1',
  product_id: 'p1',
  slug: 'sac-test',
  name: 'Sac "Alpin" ; édition',
  brand: 'LKDV',
  model: '',
  category: 'Sacs',
  category_main: 'Sacs',
  category_sub: '',
  price_eur: 129.9,
  weight_g: 1200,
  weight_grams: 1200,
  dimensions: '',
  materials: '',
  warranty: '',
  description_why: '',
  advantages_array: [],
  disadvantages_array: [],
  available_europe: true,
  available_usa: false,
  score_kdv: 85,
  essentiality: 'Recommandé',
  cabin_compatible: false,
  image: '',
  image_alt: '',
  rating: 5,
  review_count: 0,
  available: true,
  is_active: true,
  deleted_at: null,
  stock: 7,
  transaction_type: 'achat',
  created_at: '',
  updated_at: '',
  ...overrides,
});

describe('buildProductsCsv', () => {
  it('émet un BOM + en-tête FR + lignes échappées', () => {
    const csv = buildProductsCsv([product()]);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.split('\n');
    expect(lines[0].replace(/^﻿/, '')).toBe('slug;name;brand;price_eur;stock;is_active;category');
    expect(lines[1]).toContain('"Sac ""Alpin"" ; édition"');
    expect(lines[1]).toContain('129.9');
  });
});

describe('formatPriceEur', () => {
  it('formate en euros FR', () => {
    expect(formatPriceEur(129.9)).toContain('€');
  });
});
