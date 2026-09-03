import { describe, it, expect } from 'vitest';
import {
  buildStripeCheckoutMetadata,
  parseMetadataItems,
  STRIPE_METADATA_LIMIT_CHARS,
} from '@/features/checkout/stripeMetadata';

describe('checkout Stripe — metadata de session (Lot 3)', () => {
  describe('buildStripeCheckoutMetadata', () => {
    it('pose user_id quand l’utilisateur est connecté', () => {
      const plan = buildStripeCheckoutMetadata('user-123', [
        { id: 'p1', name: 'Sac 40L', quantity: 1 },
      ]);
      expect(plan.metadata.user_id).toBe('user-123');
      expect(plan.needsIntent).toBe(false);
    });

    it('sérialise les items validés serveur dans metadata.items', () => {
      const plan = buildStripeCheckoutMetadata('user-123', [
        { id: 'p1', name: 'Sac 40L', quantity: 2 },
        { id: 'p2', name: 'Tente', quantity: 1 },
      ]);
      expect(JSON.parse(plan.metadata.items)).toEqual([
        { id: 'p1', name: 'Sac 40L', quantity: 2 },
        { id: 'p2', name: 'Tente', quantity: 1 },
      ]);
    });

    it('panier court : inline (pas d’intent)', () => {
      const plan = buildStripeCheckoutMetadata('u', [
        { id: 'p1', name: 'Sac', quantity: 1 },
      ]);
      expect(plan.needsIntent).toBe(false);
      expect(plan.intentPayload).toBeNull();
    });

    it('panier trop long (limite Stripe 500) : bascule sur checkout_intents', () => {
      const items = Array.from({ length: 40 }, (_, i) => ({
        id: `p${i}`,
        name: `Produit avec un nom très long pour dépasser la limite de métadonnées n°${i}`,
        quantity: 1,
      }));
      const plan = buildStripeCheckoutMetadata('u', items);
      expect(plan.needsIntent).toBe(true);
      expect(plan.intentPayload).toEqual(items);
      expect(plan.metadata.items).toBeUndefined();
      expect(plan.metadata.intent_id).toBeTruthy();
    });

    it('sans utilisateur : pas de user_id (commande guest tracée par session)', () => {
      const plan = buildStripeCheckoutMetadata(null, [
        { id: 'p1', name: 'Sac', quantity: 1 },
      ]);
      expect(plan.metadata.user_id).toBeUndefined();
    });
  });

  describe('parseMetadataItems', () => {
    it('parse un JSON d’items valide', () => {
      expect(parseMetadataItems('[{"id":"p1","name":"Sac","quantity":1}]')).toEqual([
        { id: 'p1', name: 'Sac', quantity: 1 },
      ]);
    });
    it('retourne [] sur JSON invalide (fallback propre)', () => {
      expect(parseMetadataItems('not-json')).toEqual([]);
      expect(parseMetadataItems(undefined)).toEqual([]);
      expect(parseMetadataItems(null)).toEqual([]);
    });
    it('retourne [] si ce n’est pas un tableau', () => {
      expect(parseMetadataItems('{"id":"p1"}')).toEqual([]);
    });
  });

  it('la limite interne reste sous le plafond Stripe de 500 caractères', () => {
    expect(STRIPE_METADATA_LIMIT_CHARS).toBeLessThanOrEqual(480);
  });
});