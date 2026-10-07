import { describe, expect, it } from 'vitest';
import {
  carRentalPerDay,
  entryFees,
  flightRoundTrip,
  insurance,
  localTripPerLeg,
  lodgingPerNight,
  mealsPerDay,
  mealsTotal,
  priceLevel,
  refugePerNight,
} from '../engine/costs';

describe('barèmes du Compas', () => {
  it('niveau de prix par pays, annoncé ; pays inconnu = moyenne annoncée', () => {
    expect(priceLevel('FR').level).toBe(1);
    expect(priceLevel('pe', 'Pérou')).toMatchObject({ level: 0.45, known: true });
    expect(priceLevel('PE', 'Pérou').basis).toContain('Pérou ≈ 45 % des prix français');
    expect(priceLevel('XX')).toMatchObject({ level: 0.7, known: false });
    expect(priceLevel(null).basis).toContain('absent du barème');
  });

  it('les pays membres de l’ONU (hors Corée du Nord) sont au barème (plus de niveau moyen par défaut)', () => {
    const un =
      'AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG MK NO OM PK PW PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA SS ES LK SD SR SE CH SY TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VE VN YE ZM ZW';
    const missing = un.split(' ').filter((cc) => !priceLevel(cc).known);
    expect(missing).toEqual([]);
  });

  it('repas selon la nuit et le pays', () => {
    expect(mealsPerDay('hebergement', 1)).toBe(32);
    expect(mealsPerDay('bivouac', 1)).toBe(16);
    expect(mealsPerDay(null, 0.3)).toBe(4);
    // 3 jours : hébergement, refuge, puis journée sans nuit, à deux.
    expect(mealsTotal({ days: 3, party: 2, nights: ['hebergement', 'refuge'], level: 1 })).toBe((32 + 22 + 14) * 2);
  });

  it('nuits, location, trajets : planchers et proportionnalité', () => {
    expect(lodgingPerNight(1)).toBe(45);
    expect(lodgingPerNight(0.1)).toBe(8);
    expect(refugePerNight(1)).toBe(58);
    expect(carRentalPerDay(0.3)).toBe(25);
    expect(localTripPerLeg('bus', 0.35)).toBe(9);
    expect(localTripPerLeg('vol', 0.3)).toBe(54);
  });

  it('vol par tranche de distance', () => {
    expect(flightRoundTrip(800).eur).toBe(180);
    expect(flightRoundTrip(7400).eur).toBe(780);
    expect(flightRoundTrip(15000).eur).toBe(1150);
    expect(flightRoundTrip(7400).basis).toContain('5 000 à 8 000 km');
  });

  it('formalités connues seulement, assurance avec plancher', () => {
    expect(entryFees('np')).toMatchObject({ eur: 45 });
    expect(entryFees('PE')).toBeNull();
    expect(entryFees('BO')).toBeNull();
    expect(insurance(5, { abroad: false, altitudeM: null })).toBe(30);
    expect(insurance(20, { abroad: true, altitudeM: 5400 })).toBe(90);
  });

  it('même voyage → même montant (aucun hasard)', () => {
    const a = mealsTotal({ days: 12, party: 3, nights: Array(11).fill('refuge'), level: priceLevel('NP').level });
    const b = mealsTotal({ days: 12, party: 3, nights: Array(11).fill('refuge'), level: priceLevel('NP').level });
    expect(a).toBe(b);
  });
});
