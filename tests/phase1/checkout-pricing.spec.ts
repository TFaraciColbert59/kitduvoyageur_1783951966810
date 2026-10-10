import { describe, it, expect } from 'vitest';
import {
  computeShipping,
  buildOrderLines,
  parseOrderBody,
} from '@/features/checkout/serverPricing';

const PRODUCTS = new Map([
  ['sac-40l', { id: 'p1', slug: 'sac-40l', name: 'Sac 40L', priceEur: 89.5 }],
  ['tente-2p', { id: 'p2', slug: 'tente-2p', name: 'Tente 2P', priceEur: 129 }],
]);

describe('Phase 1 — tarification commandes côté serveur', () => {
  describe('computeShipping', () => {
    it('standard sous 99 € : 5,9 €', () => {
      expect(computeShipping('standard', 98.99)).toBe(5.9);
    });

    it('standard à 99 € : offerte', () => {
      expect(computeShipping('standard', 99)).toBe(0);
    });

    it('standard au-delà de 99 € : offerte', () => {
      expect(computeShipping('standard', 150)).toBe(0);
    });

    it('express : 9,9 € quel que soit le sous-total', () => {
      expect(computeShipping('express', 0)).toBe(9.9);
      expect(computeShipping('express', 200)).toBe(9.9);
    });

    it('relay : 3,9 €', () => {
      expect(computeShipping('relay', 10)).toBe(3.9);
    });

    it('option inconnue : null', () => {
      expect(computeShipping('drone', 10)).toBeNull();
    });
  });

  describe('buildOrderLines', () => {
    it('résout les prix serveur et calcule le sous-total', () => {
      const result = buildOrderLines(
        [
          { slug: 'sac-40l', quantity: 2 },
          { slug: 'tente-2p', quantity: 1 },
        ],
        PRODUCTS
      );
      expect(result).toEqual({
        ok: true,
        lines: [
          { name: 'Sac 40L', slug: 'sac-40l', quantity: 2, unitPriceEur: 89.5 },
          { name: 'Tente 2P', slug: 'tente-2p', quantity: 1, unitPriceEur: 129 },
        ],
        subtotalEur: 308,
      });
    });

    it('borne le sous-total aux centimes (pas de dérive flottante)', () => {
      const products = new Map([
        ['boussole', { id: 'p3', slug: 'boussole', name: 'Boussole', priceEur: 0.1 }],
      ]);
      const result = buildOrderLines([{ slug: 'boussole', quantity: 3 }], products);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.subtotalEur).toBe(0.3);
    });

    it('refuse un slug inconnu', () => {
      expect(buildOrderLines([{ slug: 'inconnu', quantity: 1 }], PRODUCTS)).toEqual({
        ok: false,
        error: 'unknown_product',
      });
    });

    it('refuse un doublon de slug', () => {
      expect(
        buildOrderLines(
          [
            { slug: 'sac-40l', quantity: 1 },
            { slug: 'sac-40l', quantity: 2 },
          ],
          PRODUCTS
        )
      ).toEqual({ ok: false, error: 'duplicate_product' });
    });

    it('refuse une quantité 0', () => {
      expect(buildOrderLines([{ slug: 'sac-40l', quantity: 0 }], PRODUCTS)).toEqual({
        ok: false,
        error: 'invalid_quantity',
      });
    });

    it('refuse une quantité 1000', () => {
      expect(buildOrderLines([{ slug: 'sac-40l', quantity: 1000 }], PRODUCTS)).toEqual({
        ok: false,
        error: 'invalid_quantity',
      });
    });

    it('refuse une quantité flottante', () => {
      expect(buildOrderLines([{ slug: 'sac-40l', quantity: 1.5 }], PRODUCTS)).toEqual({
        ok: false,
        error: 'invalid_quantity',
      });
    });

    it('refuse une liste vide ou non tableau', () => {
      expect(buildOrderLines([], PRODUCTS)).toEqual({ ok: false, error: 'invalid_items' });
      expect(buildOrderLines(null, PRODUCTS)).toEqual({ ok: false, error: 'invalid_items' });
      expect(buildOrderLines([{ quantity: 1 }], PRODUCTS)).toEqual({
        ok: false,
        error: 'invalid_items',
      });
    });
  });

  describe('parseOrderBody', () => {
    const validShipping = {
      prenom: 'Ada',
      nom: 'Lovelace',
      email: 'ada@example.com',
      adresse: '1 rue du Test',
      codePostal: '75001',
      ville: 'Paris',
    };

    const validBody = {
      items: [{ slug: 'sac-40l', quantity: 1 }],
      shippingOption: 'standard',
      shipping: validShipping,
    };

    it('accepte un corps complet et normalise l’enveloppe', () => {
      const result = parseOrderBody(validBody);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.shippingOption).toBe('standard');
      expect(result.value.shipping).toEqual(validShipping);
      expect(result.value.lines).toHaveLength(1);
      expect(result.value.lines[0]).toMatchObject({ slug: 'sac-40l', quantity: 1 });
      expect(typeof result.value.subtotalEur).toBe('number');
    });

    it('conserve le pays optionnel', () => {
      const result = parseOrderBody({
        ...validBody,
        shipping: { ...validShipping, pays: 'France' },
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.shipping.pays).toBe('France');
    });

    it('refuse une option de livraison inconnue', () => {
      expect(parseOrderBody({ ...validBody, shippingOption: 'drone' })).toEqual({
        ok: false,
        error: 'invalid_shipping',
      });
    });

    it('refuse un email invalide', () => {
      expect(
        parseOrderBody({
          ...validBody,
          shipping: { ...validShipping, email: 'ada[at]example.com' },
        })
      ).toEqual({ ok: false, error: 'invalid_shipping_address' });
    });

    it('refuse un champ d’adresse vide', () => {
      expect(
        parseOrderBody({ ...validBody, shipping: { ...validShipping, ville: '' } })
      ).toEqual({ ok: false, error: 'invalid_shipping_address' });
    });

    it('refuse un champ d’adresse trop long (> 200)', () => {
      expect(
        parseOrderBody({
          ...validBody,
          shipping: { ...validShipping, adresse: 'a'.repeat(201) },
        })
      ).toEqual({ ok: false, error: 'invalid_shipping_address' });
    });

    it('refuse une adresse de livraison absente', () => {
      expect(parseOrderBody({ ...validBody, shipping: undefined })).toEqual({
        ok: false,
        error: 'invalid_shipping_address',
      });
    });

    it('refuse une quantité hors bornes', () => {
      expect(parseOrderBody({ ...validBody, items: [{ slug: 'sac-40l', quantity: 0 }] })).toEqual({
        ok: false,
        error: 'invalid_quantity',
      });
      expect(parseOrderBody({ ...validBody, items: [{ slug: 'sac-40l', quantity: 1000 }] })).toEqual(
        { ok: false, error: 'invalid_quantity' }
      );
    });

    it('refuse un doublon de slug', () => {
      expect(
        parseOrderBody({
          ...validBody,
          items: [
            { slug: 'sac-40l', quantity: 1 },
            { slug: 'sac-40l', quantity: 1 },
          ],
        })
      ).toEqual({ ok: false, error: 'duplicate_product' });
    });

    it('refuse une liste d’articles vide ou non tableau', () => {
      expect(parseOrderBody({ ...validBody, items: [] })).toEqual({
        ok: false,
        error: 'invalid_items',
      });
      expect(parseOrderBody({ ...validBody, items: 'sac' })).toEqual({
        ok: false,
        error: 'invalid_items',
      });
    });

    it('refuse un corps non objet', () => {
      expect(parseOrderBody(null)).toEqual({ ok: false, error: 'invalid_body' });
    });
  });
});
