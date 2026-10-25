import { describe, expect, it } from 'vitest';
import { nearestAirportIn, type AirportRow } from '../engine/airports';
import { distanceKm } from '../engine/places';
import { RAIL_SCALE_NOTE, TR_FARE_CHECK, railScaleFor, trainOutlook, trainTrip } from '../engine/rail';
import { planTravelLeg, travelOrigin, type CarRouteResult, type TravelDeps, type TravelLegInput, type TravelPoint } from '../engine/travel';

/** Quelques villes (centre-ville, au centième de degré). */
const P = {
  vienne: { lat: 48.21, lon: 16.37 },
  prague: { lat: 50.08, lon: 14.44 },
  varsovie: { lat: 52.23, lon: 21.01 },
  cracovie: { lat: 50.06, lon: 19.94 },
  dublin: { lat: 53.35, lon: -6.26 },
  cork: { lat: 51.9, lon: -8.47 },
  londres: { lat: 51.51, lon: -0.13 },
  helsinki: { lat: 60.17, lon: 24.94 },
  tampere: { lat: 61.5, lon: 23.76 },
  stockholm: { lat: 59.33, lon: 18.07 },
  athenes: { lat: 37.98, lon: 23.73 },
  thessalonique: { lat: 40.64, lon: 22.94 },
  heraklion: { lat: 35.34, lon: 25.13 },
  santorin: { lat: 36.42, lon: 25.43 },
  tokyo: { lat: 35.68, lon: 139.69 },
  osaka: { lat: 34.69, lon: 135.5 },
  naha: { lat: 26.21, lon: 127.68 },
  seoul: { lat: 37.57, lon: 126.98 },
  busan: { lat: 35.18, lon: 129.08 },
  jeju: { lat: 33.5, lon: 126.53 },
  pekin: { lat: 39.9, lon: 116.4 },
  shanghai: { lat: 31.23, lon: 121.47 },
  delhi: { lat: 28.61, lon: 77.21 },
  agra: { lat: 27.18, lon: 78.02 },
  mumbai: { lat: 19.08, lon: 72.88 },
  boston: { lat: 42.36, lon: -71.06 },
  newYork: { lat: 40.71, lon: -74.0 },
  washington: { lat: 38.9, lon: -77.04 },
  losAngeles: { lat: 34.05, lon: -118.24 },
  denver: { lat: 39.74, lon: -104.99 },
  sanFrancisco: { lat: 37.77, lon: -122.42 },
  seattle: { lat: 47.61, lon: -122.33 },
  vancouver: { lat: 49.28, lon: -123.12 },
  chicago: { lat: 41.88, lon: -87.63 },
  detroit: { lat: 42.33, lon: -83.05 },
  toronto: { lat: 43.65, lon: -79.38 },
  montreal: { lat: 45.5, lon: -73.57 },
};
type City = keyof typeof P;

/** Un trajet de A à B : la route mesurée vaut ici 1,25 fois le vol d'oiseau (sans île). */
function trip(a: City, b: City, ca: string, cb: string, days = 5, roadFactor = 1.25) {
  const straightKm = distanceKm(P[a], P[b]);
  return trainTrip({ fromCountry: ca, toCountry: cb, straightKm, roadKm: straightKm * roadFactor, days, from: P[a], to: P[b] });
}

describe('l’Europe entière, par règles de réseau et de distance', () => {
  it('Vienne → Prague : deux pays reliés, barème moyen des deux pays, dit « estimation »', () => {
    const t = trip('vienne', 'prague', 'AT', 'CZ')!;
    expect(t).not.toBeNull();
    expect(t.network).toBe('europe');
    // Ce que le réseau le moins rapide autorise : 80 km/h en moyenne, 1,3 fois le vol d'oiseau.
    expect(t.railKm).toBe(Math.round(distanceKm(P.vienne, P.prague) * 1.3));
    expect(t.minutesOneWay).toBe(Math.round((t.railKm / 80) * 60 + 30));
    // 0,13 € du km (Autriche) et 0,13 × 0,7 (République tchèque) : la moyenne.
    expect(t.eurRoundTrip).toBe(2 * Math.max(Math.round((30 + 21) / 2), Math.round(t.railKm * ((0.13 + 0.13 * 0.7) / 2))));
    expect(t.priceSource).toBe('estimation');
    expect(t.basis).toContain('estimation');
    expect(t.basis).toContain('Résa · Trajets');
  });

  it('Cracovie → Varsovie (260 km) : le barème de la Pologne seule', () => {
    const t = trip('cracovie', 'varsovie', 'PL', 'PL')!;
    expect(t.network).toBe('europe');
    expect(t.eurRoundTrip).toBe(2 * Math.max(Math.round(Math.max(8, 30 * 0.65)), Math.round(t.railKm * 0.13 * 0.65)));
  });

  it('les pays sans liaison continue restent seuls : Irlande, Finlande, Baltes', () => {
    const dub = distanceKm(P.dublin, P.cork);
    expect(trainTrip({ fromCountry: 'IE', toCountry: 'IE', straightKm: dub, roadKm: dub * 1.2, days: 5, from: P.dublin, to: P.cork })).not.toBeNull();
    // Dublin → Londres : la mer (Belfast est au Royaume-Uni, mais Londres n'est pas au bout du rail).
    const dl = distanceKm(P.dublin, P.londres);
    expect(trainTrip({ fromCountry: 'IE', toCountry: 'GB', straightKm: dl, roadKm: dl * 1.2, days: 9 })).toBeNull();
    // Helsinki → Stockholm : le rail ne passe pas le golfe de Botnie.
    const hs = distanceKm(P.helsinki, P.stockholm);
    expect(trainTrip({ fromCountry: 'FI', toCountry: 'SE', straightKm: hs, roadKm: hs * 1.3, days: 9 })).toBeNull();
    // Mais à l'intérieur de la Finlande, le train existe (Helsinki → Tampere, 160 km).
    const ht = distanceKm(P.helsinki, P.tampere);
    expect(trainTrip({ fromCountry: 'FI', toCountry: 'FI', straightKm: ht, roadKm: ht * 1.2, days: 5 })).not.toBeNull();
  });

  it('les îles grecques, Madère et Bornholm n’ont pas de train depuis le continent', () => {
    const at = distanceKm(P.athenes, P.heraklion);
    const base = { fromCountry: 'GR', toCountry: 'GR', straightKm: at, roadKm: at * 1.2, days: 5 };
    expect(trainTrip({ ...base, to: P.heraklion })).toBeNull();
    expect(trainTrip({ ...base, to: P.santorin })).toBeNull();
    // Le continent grec, lui, se rejoint en train.
    const gt = distanceKm(P.athenes, P.thessalonique);
    expect(trainTrip({ fromCountry: 'GR', toCountry: 'GR', straightKm: gt, roadKm: gt * 1.2, days: 5, to: P.thessalonique })).not.toBeNull();
    expect(trainTrip({ ...base, fromCountry: 'PT', toCountry: 'PT', to: { lat: 32.65, lon: -16.9 } })).toBeNull();
    expect(trainTrip({ ...base, fromCountry: 'DK', toCountry: 'DK', to: { lat: 55.1, lon: 14.9 } })).toBeNull();
  });

  it('une île au départ compte aussi (Corse → Paris)', () => {
    expect(
      trainTrip({ fromCountry: 'FR', toCountry: 'FR', straightKm: 700, roadKm: 900, days: 5, from: { lat: 41.92, lon: 8.74 }, to: { lat: 48.86, lon: 2.35 } })
    ).toBeNull();
  });

  it('pas de train compté là où le réseau n’est pas connu ou pas lisible : Maroc, Brésil, Australie, Ukraine, Albanie', () => {
    for (const cc of ['MA', 'BR', 'AU', 'RU', 'UA', 'BY', 'MD', 'AL', 'XK'])
      expect(trainTrip({ fromCountry: cc, toCountry: cc, straightKm: 400, roadKm: 480, days: 5 })).toBeNull();
  });
});

describe('îles sans train depuis le continent, route mesurée comprise (1,2 à 1,4 fois le vol d’oiseau)', () => {
  type Pt = { lat: number; lon: number };
  const ATHENES = P.athenes;
  const THESSALONIQUE = P.thessalonique;
  const ZAGREB: Pt = { lat: 45.81, lon: 15.98 };
  const TARTU: Pt = { lat: 58.38, lon: 26.72 };
  const TALLINN: Pt = { lat: 59.44, lon: 24.75 };
  const GLASGOW: Pt = { lat: 55.86, lon: -4.25 };
  const MADRID: Pt = { lat: 40.42, lon: -3.7 };

  /** Un trajet du continent à une île, route mesurée à `factor` fois le vol d’oiseau, 4 jours. */
  function reach(from: Pt, to: Pt, cc: string, factor: number) {
    const straightKm = distanceKm(from, to);
    const base = { fromCountry: cc, toCountry: cc, straightKm, roadKm: straightKm * factor, days: 4 };
    // Sans coordonnées d’arrivée aucune île n’est connue : le train serait compté. C’est la règle
    // « île » seule qui l’écarte, pas la distance ni la durée.
    expect(trainTrip(base), `contrôle de ${JSON.stringify(to)}`).not.toBeNull();
    return trainTrip({ ...base, from, to });
  }

  const islands: Array<[string, Pt, Pt, string]> = [
    // Îles Ioniennes
    ['Céphalonie (Argostoli)', ATHENES, { lat: 38.18, lon: 20.49 }, 'GR'],
    ['Ithaque (Vathy)', ATHENES, { lat: 38.37, lon: 20.72 }, 'GR'],
    ['Zante', ATHENES, { lat: 37.78, lon: 20.9 }, 'GR'],
    ['Leucade', ATHENES, { lat: 38.83, lon: 20.71 }, 'GR'],
    ['Paxos', ATHENES, { lat: 39.2, lon: 20.18 }, 'GR'],
    ['Cythère', THESSALONIQUE, { lat: 36.26, lon: 22.99 }, 'GR'],
    // Égée du Nord et de l’Est
    ['Lesbos (Mytilène)', ATHENES, { lat: 39.11, lon: 26.55 }, 'GR'],
    ['Lemnos', ATHENES, { lat: 39.87, lon: 25.07 }, 'GR'],
    ['Chios', ATHENES, { lat: 38.37, lon: 26.14 }, 'GR'],
    ['Samos', ATHENES, { lat: 37.75, lon: 26.98 }, 'GR'],
    ['Ikaria', ATHENES, { lat: 37.62, lon: 26.17 }, 'GR'],
    ['Thasos', ATHENES, { lat: 40.78, lon: 24.71 }, 'GR'],
    ['Samothrace', ATHENES, { lat: 40.48, lon: 25.52 }, 'GR'],
    ['Skiathos', THESSALONIQUE, { lat: 39.16, lon: 23.49 }, 'GR'],
    ['Skopelos', THESSALONIQUE, { lat: 39.12, lon: 23.73 }, 'GR'],
    ['Skyros', THESSALONIQUE, { lat: 38.9, lon: 24.57 }, 'GR'],
    // Dodécanèse
    ['Kos', ATHENES, { lat: 36.89, lon: 27.29 }, 'GR'],
    ['Patmos', ATHENES, { lat: 37.31, lon: 26.55 }, 'GR'],
    ['Léros', ATHENES, { lat: 37.15, lon: 26.85 }, 'GR'],
    ['Karpathos', ATHENES, { lat: 35.51, lon: 27.21 }, 'GR'],
    ['Symi', ATHENES, { lat: 36.61, lon: 27.84 }, 'GR'],
    // Îles dalmates
    ['Hvar', ZAGREB, { lat: 43.17, lon: 16.44 }, 'HR'],
    ['Brač (Supetar)', ZAGREB, { lat: 43.38, lon: 16.56 }, 'HR'],
    ['Brač (Bol)', ZAGREB, { lat: 43.26, lon: 16.65 }, 'HR'],
    ['Šolta', ZAGREB, { lat: 43.39, lon: 16.3 }, 'HR'],
    ['Vis', ZAGREB, { lat: 43.06, lon: 16.18 }, 'HR'],
    ['Korčula', ZAGREB, { lat: 42.96, lon: 17.13 }, 'HR'],
    ['Lastovo', ZAGREB, { lat: 42.75, lon: 16.89 }, 'HR'],
    ['Mljet', ZAGREB, { lat: 42.75, lon: 17.5 }, 'HR'],
    // Estonie
    ['Saaremaa (Kuressaare)', TARTU, { lat: 58.25, lon: 22.49 }, 'EE'],
    ['Muhu', TARTU, { lat: 58.58, lon: 23.2 }, 'EE'],
    ['Hiiumaa (Kärdla)', TARTU, { lat: 59.0, lon: 22.75 }, 'EE'],
    // Irlande du Nord, Ceuta, Melilla
    ['Belfast', GLASGOW, { lat: 54.6, lon: -5.93 }, 'GB'],
    ['Derry', GLASGOW, { lat: 54.99, lon: -7.32 }, 'GB'],
    ['Londres → Belfast', P.londres, { lat: 54.6, lon: -5.93 }, 'GB'],
    ['Ceuta', MADRID, { lat: 35.89, lon: -5.31 }, 'ES'],
    ['Melilla', MADRID, { lat: 35.29, lon: -2.94 }, 'ES'],
  ];

  it.each(islands)('%s : pas de train', (_name, from, to, cc) => {
    for (const factor of [1.2, 1.3, 1.4]) expect(reach(from, to, cc, factor)).toBeNull();
  });

  it('le continent voisin, lui, se rejoint toujours en train', () => {
    const mainland: Array<[string, Pt, Pt, string]> = [
      ['Athènes → Patras', ATHENES, { lat: 38.25, lon: 21.73 }, 'GR'],
      ['Athènes → Volos', ATHENES, { lat: 39.36, lon: 22.94 }, 'GR'],
      ['Athènes → Préveza', ATHENES, { lat: 38.96, lon: 20.75 }, 'GR'],
      ['Athènes → Igoumenitsa', ATHENES, { lat: 39.5, lon: 20.27 }, 'GR'],
      ['Athènes → Alexandroupoli', ATHENES, { lat: 40.85, lon: 25.87 }, 'GR'],
      ['Zagreb → Split', ZAGREB, { lat: 43.51, lon: 16.44 }, 'HR'],
      ['Zagreb → Šibenik', ZAGREB, { lat: 43.73, lon: 15.89 }, 'HR'],
      ['Zagreb → Zadar', ZAGREB, { lat: 44.12, lon: 15.23 }, 'HR'],
      ['Tallinn → Tartu', TALLINN, TARTU, 'EE'],
      ['Londres → Glasgow', P.londres, GLASGOW, 'GB'],
      ['Madrid → Algésiras', MADRID, { lat: 36.13, lon: -5.45 }, 'ES'],
    ];
    for (const [name, from, to, cc] of mainland) {
      const straightKm = distanceKm(from, to);
      expect(
        trainTrip({ fromCountry: cc, toCountry: cc, straightKm, roadKm: straightKm * 1.3, days: 5, from, to }),
        name
      ).not.toBeNull();
    }
  });
});

describe('Turquie et Caucase : un réseau par pays, sans voisin', () => {
  const ANKARA = { lat: 39.93, lon: 32.86 };
  const ISTANBUL = { lat: 41.01, lon: 28.98 };
  const TBILISSI = { lat: 41.72, lon: 44.79 };
  const BATOUMI = { lat: 41.64, lon: 41.63 };
  const EREVAN = { lat: 40.18, lon: 44.51 };
  const GUMRI = { lat: 40.79, lon: 43.85 };
  const BAKOU = { lat: 40.41, lon: 49.87 };
  const GANDJA = { lat: 40.68, lon: 46.36 };
  const SOFIA = { lat: 42.7, lon: 23.32 };
  const go = (from: { lat: number; lon: number }, to: { lat: number; lon: number }, ca: string, cb: string, days = 5) => {
    const straightKm = distanceKm(from, to);
    return trainTrip({ fromCountry: ca, toCountry: cb, straightKm, roadKm: straightKm * 1.3, days, from, to });
  };

  it('Ankara → Istanbul : YHT, barème recoupé sur la grille de 2026 (de l’ordre de 18 € l’aller)', () => {
    const t = go(ANKARA, ISTANBUL, 'TR', 'TR')!;
    expect(t.network).toBe('turquie');
    expect(t.railKm).toBe(Math.round(distanceKm(ANKARA, ISTANBUL) * 1.45));
    expect(t.minutesOneWay).toBe(Math.round((t.railKm / 95) * 60 + 30));
    expect(t.eurRoundTrip).toBe(2 * Math.max(8, Math.round(t.railKm * 0.03)));
    expect(t.priceSource).toBe('estimation');
    // Le barème reste dans l'écart de la grille lue (0,027 à 0,033 € du km).
    const perKm = TR_FARE_CHECK.fares.map((f) => f.tryOneWay / TR_FARE_CHECK.eurTry / f.railKm);
    expect(Math.min(...perKm)).toBeLessThanOrEqual(0.03);
    expect(Math.max(...perKm)).toBeGreaterThanOrEqual(0.03);
    expect(TR_FARE_CHECK.source).toMatch(/^https:/);
  });

  it('Tbilissi → Batoumi, Bakou → Gandja : chacun chez soi ; Erevan → Gumri (100 km) reste sous le seuil', () => {
    expect(go(TBILISSI, BATOUMI, 'GE', 'GE')?.network).toBe('caucase');
    expect(go(EREVAN, GUMRI, 'AM', 'AM')).toBeNull();
    expect(go(BAKOU, GANDJA, 'AZ', 'AZ')?.network).toBe('caucase');
  });

  it('jamais vers un voisin : Istanbul → Sofia, Tbilissi → Erevan, Tbilissi → Bakou', () => {
    expect(go(ISTANBUL, SOFIA, 'TR', 'BG', 9)).toBeNull();
    expect(go(TBILISSI, EREVAN, 'GE', 'AM', 9)).toBeNull();
    expect(go(TBILISSI, BAKOU, 'GE', 'AZ', 9)).toBeNull();
  });

  it('Gökçeada n’a pas de train', () => {
    expect(go(ANKARA, { lat: 40.2, lon: 25.9 }, 'TR', 'TR', 9)).toBeNull();
  });
});

describe('Chypre, Malte, Islande : aucune ligne de voyageurs, et le dire', () => {
  it('Reykjavik → Akureyri : pas de train, annoncé', () => {
    const out = trainOutlook({ fromCountry: 'IS', toCountry: 'IS', straightKm: 250, roadKm: 390, days: 5 });
    expect(out.trip).toBeNull();
    expect(out.notice).toBe('Islande : aucune ligne de train de voyageurs, aucun train n’est compté.');
  });

  it('Paris → Chypre, Malte : le pays d’arrivée est nommé', () => {
    for (const [cc, name] of [
      ['CY', 'Chypre'],
      ['MT', 'Malte'],
    ]) {
      const out = trainOutlook({ fromCountry: 'FR', toCountry: cc, straightKm: 1700, roadKm: 2500, days: 9 });
      expect(out.trip).toBeNull();
      expect(out.notice).toMatch(new RegExp(`^${name} : aucune ligne`));
    }
  });

  it('départ du domicile dans un de ces pays : le pays n’est pas nommé', () => {
    const out = trainOutlook({ fromCountry: 'MT', toCountry: 'IT', straightKm: 600, roadKm: 900, days: 9, homeDeparture: true });
    expect(out.notice).toMatch(/^Le pays de départ : aucune ligne/);
    expect(out.notice).not.toMatch(/Malte/);
  });
});

describe('Japon, Corée, Chine, Inde : un réseau par pays, jamais d’un pays à l’autre', () => {
  it('Tokyo → Osaka : Shinkansen, 170 km/h en moyenne, le train passe avant la voiture', () => {
    const t = trip('tokyo', 'osaka', 'JP', 'JP', 3)!;
    expect(t.network).toBe('japon');
    expect(t.preferred).toBe(true);
    expect(t.railKm).toBe(Math.round(distanceKm(P.tokyo, P.osaka) * 1.2));
    expect(t.minutesOneWay).toBe(Math.round((t.railKm / 170) * 60 + 30));
    expect(t.eurRoundTrip).toBe(2 * Math.round(t.railKm * 0.17));
    expect(t.priceSource).toBe('estimation');
  });

  it('Séoul → Busan : KTX', () => {
    const t = trip('seoul', 'busan', 'KR', 'KR', 3)!;
    expect(t.network).toBe('coree');
    expect(t.minutesOneWay).toBe(Math.round((t.railKm / 150) * 60 + 30));
    expect(t.eurRoundTrip).toBe(2 * Math.round(t.railKm * 0.1));
  });

  it('Pékin → Shanghai : grande vitesse, admise à partir de 4 jours seulement', () => {
    const t = trip('pekin', 'shanghai', 'CN', 'CN', 5)!;
    expect(t.network).toBe('chine');
    expect(t.minutesOneWay).toBe(Math.round((t.railKm / 200) * 60 + 30));
    expect(trip('pekin', 'shanghai', 'CN', 'CN', 3)).toBeNull();
  });

  it('Delhi → Agra : train express lent (60 km/h), prix très bas ; Delhi → Bombay : trop long pour un séjour', () => {
    const t = trip('delhi', 'agra', 'IN', 'IN', 3)!;
    expect(t.network).toBe('inde');
    expect(t.minutesOneWay).toBe(Math.round((t.railKm / 60) * 60 + 30));
    expect(t.eurRoundTrip).toBe(2 * Math.max(4, Math.round(t.railKm * 0.03)));
    expect(trip('delhi', 'mumbai', 'IN', 'IN', 9)).toBeNull();
  });

  it('jamais d’un réseau à l’autre : Japon → Corée, Chine → Inde', () => {
    expect(trainTrip({ fromCountry: 'JP', toCountry: 'KR', straightKm: 900, roadKm: 1000, days: 9 })).toBeNull();
    expect(trainTrip({ fromCountry: 'CN', toCountry: 'IN', straightKm: 900, roadKm: 1000, days: 9 })).toBeNull();
    expect(trainTrip({ fromCountry: 'JP', toCountry: 'FR', straightKm: 900, roadKm: 1000, days: 9 })).toBeNull();
  });

  it('Okinawa, Jeju et les îles de l’Inde n’ont pas de train depuis le continent', () => {
    const base = { straightKm: 800, roadKm: 900, days: 9 };
    expect(trainTrip({ ...base, fromCountry: 'JP', toCountry: 'JP', to: P.naha })).toBeNull();
    expect(trainTrip({ ...base, fromCountry: 'KR', toCountry: 'KR', to: P.jeju })).toBeNull();
    expect(trainTrip({ ...base, fromCountry: 'IN', toCountry: 'IN', to: { lat: 11.67, lon: 92.74 } })).toBeNull();
  });
});

describe('Amérique du Nord : des corridors seulement, annoncés', () => {
  it('Boston → Washington : le corridor Nord-Est (Amtrak), dit comme tel', () => {
    const t = trip('boston', 'washington', 'US', 'US', 5)!;
    expect(t).not.toBeNull();
    expect(t.network).toBe('amerique-nord');
    expect(t.minutesOneWay).toBe(Math.round((t.railKm / 90) * 60 + 30));
    expect(t.eurRoundTrip).toBe(2 * Math.round(t.railKm * 0.2));
    expect(t.notice).toMatch(/corridor Nord-Est/);
    expect(t.notice).toMatch(/Amtrak/);
    expect(t.notice).toMatch(/quelques corridors/);
    expect(t.priceSource).toBe('estimation');
  });

  it('départ du domicile : le corridor et l’exploitant ne sont pas nommés (ils désigneraient la ville)', () => {
    const from = P.boston;
    const to = P.washington;
    const straightKm = distanceKm(from, to);
    const base = { fromCountry: 'US', toCountry: 'US', straightKm, roadKm: straightKm * 1.25, days: 5, from, to };
    const home = trainOutlook({ ...base, homeDeparture: true }).trip!;
    expect(home.notice).toMatch(/quelques corridors/);
    expect(home.notice).toMatch(/dessert les deux villes/);
    expect(home.notice).not.toMatch(/Nord-Est|Amtrak/);
    // Le reste du trajet est le même.
    expect(home).toEqual({ ...trainOutlook(base).trip!, notice: home.notice });
  });

  it('un corridor traverse la frontière : Seattle → Vancouver', () => {
    expect(trip('seattle', 'vancouver', 'US', 'CA', 5)?.notice).toMatch(/corridor Cascades/);
  });

  it('Toronto → Montréal (VIA Rail) et Chicago → Détroit', () => {
    expect(trip('toronto', 'montreal', 'CA', 'CA', 5)?.notice).toMatch(/VIA Rail/);
    expect(trip('chicago', 'detroit', 'US', 'US', 5)).not.toBeNull();
  });

  it('hors corridor, pas de train, et le dit : Los Angeles → Denver, New York → Chicago', () => {
    for (const [a, b] of [
      ['losAngeles', 'denver'],
      ['newYork', 'chicago'],
    ] as Array<[City, City]>) {
      const straightKm = distanceKm(P[a], P[b]);
      const out = trainOutlook({ fromCountry: 'US', toCountry: 'US', straightKm, roadKm: straightKm * 1.25, days: 9, from: P[a], to: P[b] });
      expect(out.trip).toBeNull();
      expect(out.notice).toMatch(/quelques corridors/);
      expect(out.notice).toMatch(/aucun train n’est compté/);
    }
  });

  it('deux corridors différents ne font pas un trajet : San Francisco → Los Angeles', () => {
    const out = trainOutlook({
      fromCountry: 'US',
      toCountry: 'US',
      straightKm: distanceKm(P.sanFrancisco, P.losAngeles),
      roadKm: 620,
      days: 9,
      from: P.sanFrancisco,
      to: P.losAngeles,
    });
    expect(out.trip).toBeNull();
    expect(out.notice).toMatch(/aucun train n’est compté/);
  });

  it('sans le point de départ, rien n’est affirmé', () => {
    const straightKm = distanceKm(P.boston, P.washington);
    const out = trainOutlook({ fromCountry: 'US', toCountry: 'US', straightKm, roadKm: straightKm * 1.2, days: 9, to: P.washington });
    expect(out.trip).toBeNull();
    expect(out.notice).toMatch(/corridors/);
  });

  it('la durée du séjour compte aussi : Boston → Washington en 3 jours, trop long', () => {
    expect(trip('boston', 'washington', 'US', 'US', 3)).toBeNull();
  });
});

describe('le barème est daté, par pays, et dit « estimation »', () => {
  it('chaque pays du barème porte sa date et sa source', () => {
    for (const cc of ['FR', 'PL', 'TR', 'GE', 'AM', 'AZ', 'JP', 'KR', 'CN', 'IN', 'US', 'CA']) {
      const s = railScaleFor(cc)!;
      expect(s, cc).not.toBeNull();
      expect(s.eurPerKm).toBeGreaterThan(0);
      expect(s.minOneWayEur).toBeGreaterThan(0);
      expect(s.source).toBe('estimation');
      expect(s.date).toBe('2026-10');
    }
    expect(railScaleFor('BR')).toBeNull();
    expect(RAIL_SCALE_NOTE).toMatch(/estimation/);
  });

  it('les dix premiers pays gardent leur barème d’avant (0,13 € du km, 30 € au plus bas)', () => {
    for (const cc of 'FR BE NL LU DE CH IT ES AT GB'.split(' ')) {
      expect(railScaleFor(cc)).toMatchObject({ eurPerKm: 0.13, minOneWayEur: 30 });
    }
  });
});

/* ---------- Dans le trajet d'approche ---------- */

const ROWS: AirportRow[] = [
  ['HND', 'Tokyo Haneda Airport', 35.549, 139.78, 'JP', 'L'],
  ['KIX', 'Kansai International Airport', 34.427, 135.244, 'JP', 'L'],
  ['LAX', 'Los Angeles International Airport', 33.942, -118.408, 'US', 'L'],
  ['DEN', 'Denver International Airport', 39.856, -104.674, 'US', 'L'],
  ['BOS', 'Logan International Airport', 42.366, -71.01, 'US', 'L'],
  ['DCA', 'Ronald Reagan Washington National Airport', 38.852, -77.038, 'US', 'L'],
];

function deps(car: CarRouteResult) {
  const roadCalls: TravelPoint[][] = [];
  const d: TravelDeps = {
    carRoute: async (from, to) => {
      roadCalls.push([from, to]);
      return car;
    },
    walkKm: async () => 0,
    airport: (p, country) => nearestAirportIn(ROWS, p.lat, p.lon, { country }),
  };
  return { d, roadCalls };
}
const input = (over: Partial<TravelLegInput>): TravelLegInput => ({
  origin: null,
  target: P.osaka,
  destination: { name: 'Osaka', countryCode: 'JP' },
  days: 3,
  party: 2,
  transport: true,
  ...over,
});

describe('dans le trajet d’approche', () => {
  it('Tokyo → Osaka en 4 jours : le Shinkansen passe avant la voiture, même quand la route tient dans la durée', async () => {
    // 6 h 20 de route : sous les 10 h d'un séjour de 4 jours, la voiture aurait gagné avant.
    const { d } = deps({ km: 510, minutes: 380, end: null });
    const leg = await planTravelLeg(
      input({ origin: travelOrigin({ name: 'Tokyo', ...P.tokyo, countryCode: 'JP' }, null), days: 4 }),
      d
    );
    expect(leg.transport).toMatchObject({ mode: 'train', departure: 'Tokyo' });
    expect(leg.train?.network).toBe('japon');
    expect(leg.carFuel).toBeNull();
  });

  it('en Europe, la voiture garde sa place tant que la route tient dans la durée (rien ne change)', async () => {
    const { d } = deps({ km: 520, minutes: 330, end: null });
    const leg = await planTravelLeg(
      input({
        origin: travelOrigin({ name: 'Lyon', lat: 45.76, lon: 4.84, countryCode: 'FR' }, null),
        target: { lat: 48.86, lon: 2.35 },
        destination: { name: 'Paris', countryCode: 'FR' },
        days: 5,
      }),
      d
    );
    expect(leg.transport?.mode).toBe('voiture');
  });

  it('Los Angeles → Denver : le vol, et la note dit pourquoi pas de train', async () => {
    const { d } = deps({ km: 1700, minutes: 1000, end: null });
    const leg = await planTravelLeg(
      input({
        origin: travelOrigin({ name: 'Los Angeles', ...P.losAngeles, countryCode: 'US' }, null),
        target: P.denver,
        destination: { name: 'Denver', countryCode: 'US' },
        days: 5,
      }),
      d
    );
    expect(leg.transport).toMatchObject({ mode: 'avion', route: 'LAX → DEN' });
    expect(leg.train).toBeNull();
    expect(leg.notes.filter((n) => /quelques corridors/.test(n))).toHaveLength(1);
  });

  it('une route en voiture aux États-Unis ne dit rien des trains (pas de bruit)', async () => {
    const { d } = deps({ km: 380, minutes: 270, end: null });
    const leg = await planTravelLeg(
      input({
        origin: travelOrigin({ name: 'Denver', ...P.denver, countryCode: 'US' }, null),
        target: { lat: 38.83, lon: -104.82 },
        destination: { name: 'Colorado Springs', countryCode: 'US' },
        days: 3,
      }),
      d
    );
    expect(leg.transport?.mode).toBe('voiture');
    expect(leg.notes).toEqual([]);
  });

  it('Boston → Washington en 5 jours : la voiture tient, le train n’est pas imposé', async () => {
    const { d } = deps({ km: 700, minutes: 450, end: null });
    const leg = await planTravelLeg(
      input({
        origin: travelOrigin({ name: 'Boston', ...P.boston, countryCode: 'US' }, null),
        target: P.washington,
        destination: { name: 'Washington', countryCode: 'US' },
        days: 5,
      }),
      d
    );
    expect(leg.transport?.mode).toBe('voiture');
  });

  it('Boston → Washington en 5 jours, route de 11 h : le train du corridor, avec son annonce', async () => {
    const { d } = deps({ km: 900, minutes: 660, end: null });
    const leg = await planTravelLeg(
      input({
        origin: travelOrigin({ name: 'Boston', ...P.boston, countryCode: 'US' }, null),
        target: P.washington,
        destination: { name: 'Washington', countryCode: 'US' },
        days: 5,
      }),
      d
    );
    expect(leg.transport?.mode).toBe('train');
    expect(leg.notes.some((n) => /corridor Nord-Est/.test(n))).toBe(true);
  });
});
