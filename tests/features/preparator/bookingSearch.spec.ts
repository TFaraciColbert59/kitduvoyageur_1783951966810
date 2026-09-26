import { describe, expect, it } from 'vitest';
import { buildBookingRequest } from '@/features/preparator/engine/bookingSearch';

const context = {
  origin: 'Paris',
  destination: 'Lyon',
  startDate: '2027-04-10',
  endDate: '2027-04-12',
  travelers: 2,
};

describe('buildBookingRequest', () => {
  it('construit une recherche d’hôtel valide', () => {
    expect(buildBookingRequest('hotel', context).request).toMatchObject({
      vertical: 'hotel',
      destination: 'Lyon',
      checkIn: '2027-04-10',
      checkOut: '2027-04-12',
      travelers: 2,
    });
  });

  it(' refuse les dates incohérentes et les champs manquants', () => {
    expect(buildBookingRequest('hotel', { ...context, endDate: '2027-04-09' }).error).toBeTruthy();
    expect(buildBookingRequest('flight', { ...context, origin: '' }).error).toBeTruthy();
    expect(buildBookingRequest('activity', { ...context, startDate: '' }).error).toBeTruthy();
  });

  it('convertit les dates voiture en timestamps ISO', () => {
    const result = buildBookingRequest('car', context);
    expect(result.error).toBeNull();
    expect(result.request).toMatchObject({ vertical: 'car', pickupAt: expect.any(String), dropoffAt: expect.any(String) });
    if (result.request?.vertical === 'car') {
      expect(new Date(result.request.dropoffAt).getTime()).toBeGreaterThan(new Date(result.request.pickupAt).getTime());
    }
  });
});
