import { describe, expect, it } from 'vitest';
import {
  addCartLineSchema,
  cartIdempotencyKeySchema,
  sanitizeCartMetadata,
  updateCartLineSchema,
} from '@/features/cart/schemas/cartSchemas';
import { CART_MAX_QUANTITY_PER_LINE } from '@/features/cart/cartTypes';

const UUID_REF = '22222222-2222-4222-8222-222222222222';

describe('cartSchemas — ajout', () => {
  it('applique la quantité par défaut', () => {
    const parsed = addCartLineSchema.parse({ kind: 'product', refId: UUID_REF });
    expect(parsed.quantity).toBe(1);
  });

  it('refuse un kind inconnu', () => {
    expect(addCartLineSchema.safeParse({ kind: 'hotel', refId: UUID_REF }).success).toBe(false);
  });

  it('refuse une référence non UUID', () => {
    expect(addCartLineSchema.safeParse({ kind: 'product', refId: 'slug-produit' }).success).toBe(false);
  });

  it.each([0, -1, CART_MAX_QUANTITY_PER_LINE + 1, 1.5])(
    'refuse une quantité hors bornes (%s)',
    (quantity) => {
      expect(addCartLineSchema.safeParse({ kind: 'product', refId: UUID_REF, quantity }).success).toBe(
        false
      );
    }
  );

  it('refuse une clé inconnue dans le corps', () => {
    expect(
      addCartLineSchema.safeParse({ kind: 'product', refId: UUID_REF, unitPriceEur: 0 }).success
    ).toBe(false);
  });

  it('refuse une clé d\'idempotence injectable', () => {
    expect(addCartLineSchema.safeParse({ kind: 'product', refId: UUID_REF, idempotencyKey: 'x' }).success).toBe(
      false
    );
    expect(
      addCartLineSchema.safeParse({
        kind: 'product',
        refId: UUID_REF,
        idempotencyKey: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      }).success
    ).toBe(true);
  });
});

describe('cartSchemas — mise à jour', () => {
  it('exige au moins un champ', () => {
    expect(updateCartLineSchema.safeParse({}).success).toBe(false);
    expect(updateCartLineSchema.safeParse({ quantity: 2 }).success).toBe(true);
    expect(updateCartLineSchema.safeParse({ metadata: { title: 'Titre' } }).success).toBe(true);
  });

  it('refuse une quantité nulle', () => {
    expect(updateCartLineSchema.safeParse({ quantity: 0 }).success).toBe(false);
  });
});

describe('sanitizeCartMetadata — allowlist stricte', () => {
  it('conserve les champs d\'affichage produit', () => {
    const metadata = sanitizeCartMetadata('product', {
      title: 'Parapluie',
      slug: 'parapluie-pliant',
      image: 'https://images.unsplash.com/photo-1',
      weightG: 320,
    });
    expect(metadata).toEqual({
      title: 'Parapluie',
      slug: 'parapluie-pliant',
      image: 'https://images.unsplash.com/photo-1',
      weightG: 320,
    });
  });

  it('supprime toute clé hors allowlist (token, apiKey, provider brut)', () => {
    const metadata = sanitizeCartMetadata('product', {
      title: 'Parapluie',
      token: 'sb_secret_value',
      apiKey: 'sk_live_1234',
      nested: { deep: true },
    });
    expect(metadata).toEqual({ title: 'Parapluie' });
  });

  it('refuse une URL javascript: sur un deeplink de réservation', () => {
    const metadata = sanitizeCartMetadata('booking', {
      title: 'Hôtel',
      deeplink: 'javascript:alert(document.cookie)',
    });
    expect(metadata).toEqual({ title: 'Hôtel' });
  });

  it('conserve un deeplink https et le statut de réservation', () => {
    const metadata = sanitizeCartMetadata('booking', {
      title: 'Hôtel',
      deeplink: 'https://www.routestack.com/offre/1',
      status: 'pending',
      vertical: 'hotel',
      requiresRevalidation: true,
    });
    expect(metadata).toEqual({
      title: 'Hôtel',
      deeplink: 'https://www.routestack.com/offre/1',
      status: 'pending',
      vertical: 'hotel',
      requiresRevalidation: true,
    });
  });

  it('renvoie un objet vide pour une entrée inexploitable', () => {
    expect(sanitizeCartMetadata('product', null)).toEqual({});
    expect(sanitizeCartMetadata('product', 'nope')).toEqual({});
    expect(sanitizeCartMetadata('product', { title: { nested: 1 } })).toEqual({});
  });

  it('n\'expose pas un prix imposé par le client', () => {
    expect(sanitizeCartMetadata('product', { title: 'X', unitPriceEur: 1 })).toEqual({ title: 'X' });
  });
});

describe('cartIdempotencyKeySchema', () => {
  it('accepte un jeton opaque et refuse les caractères de contrôle', () => {
    expect(cartIdempotencyKeySchema.safeParse('order-1712:abc.def').success).toBe(true);
    expect(cartIdempotencyKeySchema.safeParse('clé avec espace').success).toBe(false);
    expect(cartIdempotencyKeySchema.safeParse('court').success).toBe(false);
  });
});
