import { describe, expect, it } from 'vitest';
import {
  approachLineKind,
  pickCarpoolLink,
  transportOptions,
  type PlannedTransportLine,
  type TransportInput,
} from '../engine/transportOptions';

const line = (title: string, amount: number, basis: string | null = null, choice: string | null = null): PlannedTransportLine => ({
  title,
  amount,
  basis,
  choice,
});

const base: TransportInput = { lines: [], chosen: null, party: 4, originName: null, carFree: false, carpoolLink: null };
const ids = (o: ReturnType<typeof transportOptions>) => o.map((x) => x.id);

describe('approachLineKind', () => {
  it('reconnaît les lignes du trajet d’approche écrites par la préparation', () => {
    expect(approachLineKind(line('Carburant aller-retour (412 km)', 70))).toBe('car-fuel');
    expect(approachLineKind(line('Carburant aller-retour', 70))).toBe('car-fuel');
    expect(approachLineKind(line('Train aller-retour × 4', 240))).toBe('train');
    expect(approachLineKind(line('Vol aller-retour × 2', 560))).toBe('flight');
    expect(approachLineKind(line('Vignette suisse · 40 jours', 45))).toBe('toll');
  });

  it('ignore ce qui n’est pas le trajet d’approche', () => {
    expect(approachLineKind(line('Carburant sur place (120 km)', 20))).toBeNull();
    expect(approachLineKind(line('Location de voiture · 3 jour(s)', 150))).toBeNull();
    expect(approachLineKind(line('Transports sur place (2 trajets)', 40))).toBeNull();
    expect(approachLineKind(line('Courses', 10))).toBeNull();
  });

  it('une ligne écrite par un choix de l’écran v5 se reconnaît à sa marque', () => {
    expect(approachLineKind(line('Trajet', 90, null, 'train'))).toBe('train');
    expect(approachLineKind(line('Trajet', 90, null, 'car'))).toBe('car-fuel');
  });
});

describe('transportOptions', () => {
  it('sans ligne chiffrée : covoiturage sans prix et « à pied », rien d’inventé', () => {
    const out = transportOptions(base);
    expect(ids(out)).toEqual(['carpool', 'foot']);
    expect(out[0]).toMatchObject({ amountEur: null, url: null, partner: null, source: 'aucun tarif relevé' });
    expect(out[1]).toMatchObject({ amountEur: 0, perPerson: false });
  });

  it('voiture : carburant plus vignette, total du groupe, avec la base du budget', () => {
    const out = transportOptions({
      ...base,
      originName: 'Lyon',
      lines: [
        line('Carburant aller-retour (412 km)', 70, 'itinéraire routier mesuré · 6,5 L/100 km · Euro-super 95 à 1,80 €/L'),
        line('Vignette suisse · 40 jours', 45.5, 'vignette officielle'),
        line('Carburant sur place (120 km)', 20, 'x'),
      ],
    });
    const car = out.find((o) => o.id === 'car')!;
    expect(car).toMatchObject({ amountEur: 115.5, perPerson: false, label: 'Voiture' });
    expect(car.source).toContain('itinéraire routier mesuré');
    expect(car.detail).toContain('Depuis Lyon');
    expect(car.detail).toContain('vignette');
  });

  it('sans voiture : aucune option voiture, même avec une ligne de carburant', () => {
    const out = transportOptions({ ...base, carFree: true, lines: [line('Carburant aller-retour', 70)] });
    expect(ids(out)).not.toContain('car');
  });

  it('train et avion : par personne, selon le nombre de personnes du titre', () => {
    const out = transportOptions({
      ...base,
      party: 2,
      lines: [line('Train aller-retour × 4', 240, 'barème Compas 2026-10 · train'), line('Vol aller-retour × 3', 600)],
    });
    expect(out.find((o) => o.id === 'train')).toMatchObject({ amountEur: 60, perPerson: true, source: 'barème Compas 2026-10 · train' });
    expect(out.find((o) => o.id === 'flight')).toMatchObject({ amountEur: 200, perPerson: true, source: 'budget prévu du Compas' });
  });

  it('un titre sans nombre de personnes : on divise par la taille actuelle du groupe', () => {
    const out = transportOptions({ ...base, party: 3, lines: [line('Train aller-retour', 90)] });
    expect(out.find((o) => o.id === 'train')!.amountEur).toBe(30);
  });

  it('ignore les montants illisibles', () => {
    const out = transportOptions({ ...base, lines: [line('Train aller-retour × 2', Number.NaN), line('Vol aller-retour × 2', -5)] });
    expect(ids(out)).toEqual(['carpool', 'foot']);
  });

  it('covoiturage : le lien partenaire existant, sans prix', () => {
    const out = transportOptions({ ...base, carpoolLink: { url: '/go/covoiturage', partner: 'BlaBlaCar' } });
    expect(out[0]).toMatchObject({ id: 'carpool', url: '/go/covoiturage', partner: 'BlaBlaCar', amountEur: null });
    const unnamed = transportOptions({ ...base, carpoolLink: { url: '/go/x', partner: null } });
    expect(unnamed[0].partner).toBe('partenaire');
  });

  it('un choix dont la ligne a été retirée reste proposé, tel qu’il a été chiffré', () => {
    const out = transportOptions({
      ...base,
      chosen: { id: 'train', amountEur: 60, perPerson: true, source: 'barème Compas 2026-10' },
    });
    expect(out.find((o) => o.id === 'train')).toMatchObject({ amountEur: 60, perPerson: true, source: 'barème Compas 2026-10' });
    // Le covoiturage et « à pied » ne sont pas dupliqués par le choix.
    expect(ids(transportOptions({ ...base, chosen: { id: 'foot', amountEur: 0, perPerson: false, source: 'x' } }))).toEqual(['carpool', 'foot']);
  });

  it('un choix qui a sa ligne n’est pas doublé', () => {
    const out = transportOptions({
      ...base,
      lines: [line('Train aller-retour × 4', 240)],
      chosen: { id: 'train', amountEur: 60, perPerson: true, source: 'x' },
    });
    expect(ids(out).filter((i) => i === 'train')).toHaveLength(1);
  });

  it('une source très longue est tronquée', () => {
    const out = transportOptions({ ...base, lines: [line('Carburant aller-retour', 10, 'x'.repeat(900))] });
    expect(out.find((o) => o.id === 'car')!.source.length).toBeLessThanOrEqual(280);
  });
});

describe('pickCarpoolLink', () => {
  it('ne retient qu’un lien de covoiturage', () => {
    const links = [
      { label: 'Hôtels à Grenoble', partner: 'Booking', url: '/go/hotels' },
      { label: 'Covoiturage Lyon - Grenoble', partner: 'BlaBlaCar', url: '/go/blabla' },
    ];
    expect(pickCarpoolLink(links)).toEqual({ url: '/go/blabla', partner: 'BlaBlaCar' });
    expect(pickCarpoolLink([links[0]])).toBeNull();
    expect(pickCarpoolLink([])).toBeNull();
  });
});
