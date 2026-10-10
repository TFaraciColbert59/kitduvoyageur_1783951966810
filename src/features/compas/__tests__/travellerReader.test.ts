import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { readTraveller, readTravellerState } from '../server/traveller';
import { UNKNOWN_TRAVELLER } from '../engine/traveller';

const COLUMNS =
  'nationality, residence_country, currency, language, time_zone, home_name, home_lat, home_lon, home_country';

/** Faux client : garde chaque lecture (table, colonnes, filtre) et rend `result`. */
function fake(result: { data: unknown; error: unknown } | Error) {
  const reads: Array<{ table: string; columns: string; column: string; value: string }> = [];
  const supabase = {
    from: vi.fn((table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: string) => ({
          maybeSingle: async () => {
            reads.push({ table, columns, column, value });
            if (result instanceof Error) throw result;
            return result;
          },
        }),
      }),
    })),
  };
  return { supabase, reads };
}

const ROW = {
  nationality: 'FR',
  residence_country: 'FR',
  currency: 'EUR',
  language: 'fr',
  time_zone: 'Europe/Paris',
  home_name: 'Lyon',
  home_lat: 45.76,
  home_lon: 4.83,
  home_country: 'FR',
};

describe('lecteur du profil voyageur (sa ligne, par la RLS)', () => {
  it('sans personne : tout inconnu, jamais demandé, aucune requête', async () => {
    const { supabase } = fake({ data: ROW, error: null });
    expect(await readTravellerState(supabase as never, null)).toEqual({ asked: false, traveller: UNKNOWN_TRAVELLER });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('sa ligne : les neuf colonnes, filtrée sur la personne', async () => {
    const { supabase, reads } = fake({ data: ROW, error: null });
    const state = await readTravellerState(supabase as never, 'u1');
    expect(reads).toEqual([{ table: 'user_traveller', columns: COLUMNS, column: 'user_id', value: 'u1' }]);
    expect(state).toEqual({
      asked: true,
      traveller: {
        nationality: 'FR',
        residenceCountry: 'FR',
        currency: 'EUR',
        language: 'fr',
        timeZone: 'Europe/Paris',
        home: { name: 'Lyon', lat: 45.76, lon: 4.83, countryCode: 'FR' },
      },
    });
    expect(await readTraveller(supabase as never, 'u1')).toEqual(state.traveller);
  });

  it('aucune ligne : jamais demandé, tout inconnu', async () => {
    const { supabase } = fake({ data: null, error: null });
    expect(await readTravellerState(supabase as never, 'u1')).toEqual({ asked: false, traveller: UNKNOWN_TRAVELLER });
  });

  it('ligne vide (« Passer ») : demandé, tout inconnu', async () => {
    const empty = Object.fromEntries(Object.keys(ROW).map((k) => [k, null]));
    const { supabase } = fake({ data: empty, error: null });
    expect(await readTravellerState(supabase as never, 'u1')).toEqual({ asked: true, traveller: UNKNOWN_TRAVELLER });
  });

  it('lecture en échec ou en panne : on ne redemande pas, tout reste inconnu, et c\'est dit (jamais un formulaire vide)', async () => {
    const failed = fake({ data: null, error: { message: 'refusé' } });
    expect(await readTravellerState(failed.supabase as never, 'u1')).toEqual({ asked: true, traveller: UNKNOWN_TRAVELLER, failed: true });
    const broken = fake(new Error('réseau'));
    expect(await readTravellerState(broken.supabase as never, 'u1')).toEqual({ asked: true, traveller: UNKNOWN_TRAVELLER, failed: true });
  });
});
