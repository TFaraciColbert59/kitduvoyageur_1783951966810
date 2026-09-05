import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAffiliateLinks,
  getAffiliateLinkBySlug,
  logAffiliateClick,
  recordAffiliateConversion,
} from '@/lib/queries-affiliation';

// Mock server-only
vi.mock('server-only', () => ({}));

const createMockChain = (data: any = []) => {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error: null }),
    then: (resolve: any) => resolve({ data, error: null }),
  };
  return chain;
};

let mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

describe('queries-affiliation (Service Layer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retrieves active affiliate links filtered by country', async () => {
    const dummyLinks = [
      {
        id: 'link-1',
        slug: 'booking-chamonix',
        partner_id: 'partner-1',
        category: 'hotel',
        country_code: 'FR',
        title: 'Hôtels à Chamonix',
        destination_name: 'Chamonix',
        target_url: 'https://www.booking.com/city/fr/chamonix.html',
        tracking_params: { marker: '123' },
        is_active: true,
        created_at: '2026-09-05T00:00:00Z',
        updated_at: '2026-09-05T00:00:00Z',
        partner: {
          id: 'partner-1',
          slug: 'booking',
          name: 'Booking.com',
          network: 'travelpayouts',
          website_url: 'https://www.booking.com',
          commission_rate_desc: '4%',
          is_active: true,
          created_at: '2026-09-05T00:00:00Z',
        },
      },
    ];

    mockFrom.mockReturnValue(createMockChain(dummyLinks));

    const links = await getAffiliateLinks({ countryCode: 'FR' });

    expect(mockFrom).toHaveBeenCalledWith('affiliate_links');
    expect(links).toHaveLength(1);
    expect(links[0]?.title).toBe('Hôtels à Chamonix');
    expect(links[0]?.partner?.name).toBe('Booking.com');
  });

  it('retrieves an active affiliate link by slug', async () => {
    const dummyLink = {
      id: 'link-2',
      slug: 'aviasales-peru',
      partner_id: 'partner-2',
      category: 'flight',
      country_code: 'PE',
      title: 'Vols vers Lima & Cusco',
      destination_name: 'Cusco',
      target_url: 'https://www.aviasales.com/search/PARCUZ1',
      tracking_params: { marker: '123' },
      is_active: true,
      created_at: '2026-09-05T00:00:00Z',
      updated_at: '2026-09-05T00:00:00Z',
      partner: {
        id: 'partner-2',
        slug: 'aviasales',
        name: 'Aviasales',
        network: 'travelpayouts',
        website_url: 'https://www.aviasales.com',
        commission_rate_desc: '1.2%',
        is_active: true,
        created_at: '2026-09-05T00:00:00Z',
      },
    };

    mockFrom.mockReturnValue(createMockChain([dummyLink]));

    const link = await getAffiliateLinkBySlug('aviasales-peru');

    expect(mockFrom).toHaveBeenCalledWith('affiliate_links');
    expect(link).not.toBeNull();
    expect(link?.slug).toBe('aviasales-peru');
  });

  it('logs affiliate click with RGPD session hashing and returns a clickId', async () => {
    const mockClickReturn = {
      id: 'click-12345',
    };

    mockFrom.mockReturnValue(createMockChain([mockClickReturn]));

    const result = await logAffiliateClick('link-1', {
      userId: 'user-abc',
      tripId: 'trip-xyz',
      ip: '192.168.1.50',
      userAgent: 'Mozilla/5.0 Safari',
    });

    expect(mockFrom).toHaveBeenCalledWith('affiliate_clicks');
    expect(result.clickId).toBe('click-12345');
  });

  it('records affiliate conversion via postback payload', async () => {
    const mockPartner = { id: 'partner-1', slug: 'booking' };
    const mockConversionReturn = {
      id: 'conv-999',
      partner_id: 'partner-1',
      external_sub_id: 'TP-SUB-777',
      amount_cents: 1250,
      currency: 'EUR',
      status: 'confirmed',
      payload: {},
      created_at: '2026-09-05T10:00:00Z',
      updated_at: '2026-09-05T10:00:00Z',
    };

    mockFrom.mockImplementation((tableName: string) => {
      if (tableName === 'affiliate_partners') {
        return createMockChain([mockPartner]);
      }
      return createMockChain([mockConversionReturn]);
    });

    const conversion = await recordAffiliateConversion({
      partner_slug: 'booking',
      sub_id: 'TP-SUB-777',
      amount_cents: 1250,
      currency: 'EUR',
      status: 'confirmed',
    });

    expect(mockFrom).toHaveBeenCalledWith('affiliate_partners');
    expect(mockFrom).toHaveBeenCalledWith('affiliate_conversions');
    expect(conversion).not.toBeNull();
    expect(conversion?.id).toBe('conv-999');
    expect(conversion?.amount_cents).toBe(1250);
  });
});
