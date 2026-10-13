import { describe, it, expect } from 'vitest';
import {
  EARN_ACTIONS,
  parseSpendBody,
  parseEarnBody,
  parseRefundBody,
  parseRedeemBody,
} from '@/features/loyalty/validation';

describe('Phase 1 — validation des corps loyalty (jamais de points client)', () => {
  describe('parseSpendBody', () => {
    it('accepte une dépense conforme', () => {
      expect(
        parseSpendBody({
          points: 100,
          reason: 'Article offert',
          sourceId: 'cart_free_apply:item-1',
        })
      ).toEqual({
        ok: true,
        value: { points: 100, reason: 'Article offert', sourceId: 'cart_free_apply:item-1' },
      });
    });

    it('applique le motif par défaut quand reason est absent', () => {
      expect(parseSpendBody({ points: 50, sourceId: 'cart_free_apply:item_2' })).toEqual({
        ok: true,
        value: { points: 50, reason: 'Dépense', sourceId: 'cart_free_apply:item_2' },
      });
    });

    it('refuse points = 0', () => {
      expect(parseSpendBody({ points: 0, sourceId: 'cart_free_apply:x' })).toEqual({
        ok: false,
        error: 'invalid_points',
      });
    });

    it('refuse points négatif', () => {
      expect(parseSpendBody({ points: -10, sourceId: 'cart_free_apply:x' })).toEqual({
        ok: false,
        error: 'invalid_points',
      });
    });

    it('refuse points flottant', () => {
      expect(parseSpendBody({ points: 10.5, sourceId: 'cart_free_apply:x' })).toEqual({
        ok: false,
        error: 'invalid_points',
      });
    });

    it('refuse points fourni en chaîne', () => {
      expect(parseSpendBody({ points: '100', sourceId: 'cart_free_apply:x' })).toEqual({
        ok: false,
        error: 'invalid_points',
      });
    });

    it('refuse points au-delà du plafond 1 000 000', () => {
      expect(parseSpendBody({ points: 1_000_001, sourceId: 'cart_free_apply:x' })).toEqual({
        ok: false,
        error: 'invalid_points',
      });
    });

    it('accepte la borne haute 1 000 000', () => {
      expect(parseSpendBody({ points: 1_000_000, sourceId: 'cart_free_apply:x' })).toMatchObject({
        ok: true,
      });
    });

    it('refuse un entier non sûr', () => {
      expect(
        parseSpendBody({ points: Number.MAX_SAFE_INTEGER + 2, sourceId: 'cart_free_apply:x' })
      ).toEqual({ ok: false, error: 'invalid_points' });
    });

    it('refuse un sourceId sans le préfixe cart_free_apply:', () => {
      expect(parseSpendBody({ points: 10, sourceId: 'item-1' })).toEqual({
        ok: false,
        error: 'invalid_source',
      });
    });

    it('refuse un sourceId à suffixe trop long (> 100)', () => {
      expect(
        parseSpendBody({ points: 10, sourceId: `cart_free_apply:${'a'.repeat(101)}` })
      ).toEqual({ ok: false, error: 'invalid_source' });
    });

    it('accepte un suffixe de 100 caractères', () => {
      const suffix = 'a'.repeat(100);
      expect(parseSpendBody({ points: 10, sourceId: `cart_free_apply:${suffix}` })).toEqual({
        ok: true,
        value: { points: 10, reason: 'Dépense', sourceId: `cart_free_apply:${suffix}` },
      });
    });

    it('refuse un motif > 200 caractères', () => {
      expect(
        parseSpendBody({ points: 10, reason: 'x'.repeat(201), sourceId: 'cart_free_apply:x' })
      ).toEqual({ ok: false, error: 'invalid_reason' });
    });

    it('refuse un motif non textuel', () => {
      expect(
        parseSpendBody({ points: 10, reason: 42, sourceId: 'cart_free_apply:x' })
      ).toEqual({ ok: false, error: 'invalid_reason' });
    });

    it('refuse un corps non objet', () => {
      expect(parseSpendBody(null)).toEqual({ ok: false, error: 'invalid_body' });
    });
  });

  describe('parseEarnBody', () => {
    it('expose le barème serveur rapport_expedition = 75', () => {
      expect(EARN_ACTIONS.rapport_expedition).toEqual({ points: 75, sourcePrefix: 'rapport' });
    });

    it('ignore les points client et stocke la source préfixée', () => {
      expect(
        parseEarnBody({ action: 'rapport_expedition', points: 9999, sourceId: 'report_42' })
      ).toEqual({
        ok: true,
        value: { action: 'rapport_expedition', points: 75, sourceId: 'rapport:report_42' },
      });
    });

    it('refuse une action inconnue', () => {
      expect(parseEarnBody({ action: 'gain_magique', sourceId: 'x' })).toEqual({
        ok: false,
        error: 'invalid_action',
      });
    });

    it('refuse un sourceId absent ou invalide', () => {
      expect(parseEarnBody({ action: 'rapport_expedition', sourceId: '' })).toEqual({
        ok: false,
        error: 'invalid_source',
      });
      expect(parseEarnBody({ action: 'rapport_expedition', sourceId: 'a b' })).toEqual({
        ok: false,
        error: 'invalid_source',
      });
    });

    it('refuse un sourceId trop long (> 100)', () => {
      expect(
        parseEarnBody({ action: 'rapport_expedition', sourceId: 'a'.repeat(101) })
      ).toEqual({ ok: false, error: 'invalid_source' });
    });

    it('refuse un corps non objet', () => {
      expect(parseEarnBody('rapport_expedition')).toEqual({ ok: false, error: 'invalid_body' });
    });
  });

  describe('parseRefundBody', () => {
    it('accepte un cartItemId conforme', () => {
      expect(parseRefundBody({ cartItemId: 'item_42:abc' })).toEqual({
        ok: true,
        value: { cartItemId: 'item_42:abc' },
      });
    });

    it('refuse un cartItemId vide', () => {
      expect(parseRefundBody({ cartItemId: '' })).toEqual({
        ok: false,
        error: 'invalid_cart_item',
      });
    });

    it('refuse un cartItemId trop long (> 120)', () => {
      expect(parseRefundBody({ cartItemId: 'a'.repeat(121) })).toEqual({
        ok: false,
        error: 'invalid_cart_item',
      });
    });

    it('refuse un cartItemId avec espace', () => {
      expect(parseRefundBody({ cartItemId: 'item 1' })).toEqual({
        ok: false,
        error: 'invalid_cart_item',
      });
    });
  });

  describe('parseRedeemBody', () => {
    it('accepte un UUID quelle que soit la casse', () => {
      const uuid = 'A1B2C3D4-E5F6-4A7B-8C9D-0E1F2A3B4C5D';
      expect(parseRedeemBody({ rewardId: uuid })).toEqual({
        ok: true,
        value: { rewardId: uuid },
      });
    });

    it('refuse un identifiant non UUID', () => {
      expect(parseRedeemBody({ rewardId: 'reward-1' })).toEqual({
        ok: false,
        error: 'invalid_reward',
      });
    });

    it('refuse un UUID tronqué', () => {
      expect(parseRedeemBody({ rewardId: 'a1b2c3d4-e5f6-4a7b-8c9d' })).toEqual({
        ok: false,
        error: 'invalid_reward',
      });
    });

    it('refuse un corps non objet', () => {
      expect(parseRedeemBody(undefined)).toEqual({ ok: false, error: 'invalid_body' });
    });
  });
});
