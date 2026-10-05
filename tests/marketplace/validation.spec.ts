import { describe, it, expect } from 'vitest';
import {
  listingSchema,
  requestSchema,
  actionSchema,
  reviewSchema,
} from '@/features/marketplace/domain/validation';
describe('marketplace input boundary', () => {
  it('rejects ownership and private-field injection', () => {
    expect(
      listingSchema.safeParse({
        item_id: 'b2cff5d6-37fc-43d5-bf6f-7d8dacb89922',
        description: 'Public description',
        public_location: 'Paris',
        price_cents: 100,
        user_id: 'attacker',
      }).success
    ).toBe(false);
  });
  it('requires integer cents and explicit public fields', () => {
    expect(
      listingSchema.safeParse({
        item_id: 'b2cff5d6-37fc-43d5-bf6f-7d8dacb89922',
        description: '',
        public_location: '',
        price_cents: 0.1,
      }).success
    ).toBe(false);
  });
  it('rejects reversed dates and invalid actions', () => {
    expect(
      requestSchema.safeParse({
        listing_id: 'b2cff5d6-37fc-43d5-bf6f-7d8dacb89922',
        start_date: '2026-10-06',
        end_date: '2026-10-05',
      }).success
    ).toBe(false);
    expect(actionSchema.safeParse({ action: 'pay' }).success).toBe(false);
  });
  it('limits reviews', () => {
    expect(
      reviewSchema.safeParse({
        transaction_id: 'b2cff5d6-37fc-43d5-bf6f-7d8dacb89922',
        rating: 6,
        comment: 'a',
      }).success
    ).toBe(false);
  });
});
