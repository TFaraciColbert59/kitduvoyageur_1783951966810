import { describe, expect, it } from 'vitest';
import {
  activitiesSearchUrl,
  addDaysIso,
  bookingSearchUrl,
  carRentalUrl,
  flightSearchUrl,
  mapsDirectionsUrl,
  objectSearchUrl,
  safeWebsite,
  stayDeepLink,
  transportDeepLink,
  webSearchUrl,
} from '../engine/deepLinks';

// Liens de RECHERCHE profonds (point 4 de l'audit Résa 13/11) : directs, https, sans clé ni identifiant d'affiliation.

describe('addDaysIso / dates', () => {
  it('ajoute des jours à une date ISO réelle, rien pour une date illisible', () => {
    expect(addDaysIso('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysIso('2026-02-30', 1)).toBeNull();
    expect(addDaysIso(null, 1)).toBeNull();
    expect(addDaysIso('demain', 1)).toBeNull();
  });
});

describe('bookingSearchUrl', () => {
  it('lieu, dates et voyageurs préremplis, tout passe par encodeURIComponent', () => {
    expect(bookingSearchUrl({ place: 'Saint-Jean-de-Luz & Biarritz', checkIn: '2026-11-03', checkOut: '2026-11-05', adults: 4 })).toBe(
      'https://www.booking.com/searchresults.html?ss=Saint-Jean-de-Luz%20%26%20Biarritz&checkin=2026-11-03&checkout=2026-11-05&group_adults=4'
    );
  });
  it('sans dates ni groupe connus : seulement le lieu, jamais un paramètre inventé', () => {
    expect(bookingSearchUrl({ place: 'Rencurel', checkIn: null, checkOut: null, adults: null })).toBe('https://www.booking.com/searchresults.html?ss=Rencurel');
    // Une seule des deux dates, ou une arrivée après le départ : aucune des deux.
    expect(bookingSearchUrl({ place: 'Rencurel', checkIn: '2026-11-03', checkOut: null, adults: 2 })).toBe('https://www.booking.com/searchresults.html?ss=Rencurel&group_adults=2');
    expect(bookingSearchUrl({ place: 'Rencurel', checkIn: '2026-11-05', checkOut: '2026-11-03', adults: 0 })).toBe('https://www.booking.com/searchresults.html?ss=Rencurel');
  });
  it('sans lieu : pas de lien', () => {
    expect(bookingSearchUrl({ place: '  ', checkIn: '2026-11-03', checkOut: '2026-11-04', adults: 2 })).toBeNull();
    expect(bookingSearchUrl({ place: null, checkIn: null, checkOut: null, adults: null })).toBeNull();
  });
});

describe('webSearchUrl et site du lieu', () => {
  it('nom + localité + « réservation », encodé', () => {
    expect(webSearchUrl({ name: 'Refuge de la Molière', place: 'Rencurel' })).toBe('https://duckduckgo.com/?q=Refuge%20de%20la%20Moli%C3%A8re%20Rencurel%20r%C3%A9servation');
  });
  it('la localité déjà dans le nom n’est pas répétée ; le mot est celui de la langue', () => {
    expect(webSearchUrl({ name: 'Camping de Rencurel', place: 'Rencurel', keyword: 'booking' })).toBe('https://duckduckgo.com/?q=Camping%20de%20Rencurel%20booking');
  });
  it('seul un site https est gardé', () => {
    expect(safeWebsite('https://refuge.example/molière')).toBe('https://refuge.example/molière');
    expect(safeWebsite('http://refuge.example')).toBeNull();
    expect(safeWebsite('javascript:alert(1)')).toBeNull();
    expect(safeWebsite('www.refuge.example')).toBeNull();
    expect(safeWebsite(null)).toBeNull();
  });
});

describe('stayDeepLink', () => {
  const base = { name: 'Gîte du Royans', place: 'Rencurel', website: null, checkIn: '2026-11-03', checkOut: '2026-11-04', adults: 4 };
  it('hébergement marchand : recherche Booking sur le lieu de l’étape', () => {
    expect(stayDeepLink({ ...base, kind: 'hebergement' })).toBe('https://www.booking.com/searchresults.html?ss=Rencurel&checkin=2026-11-03&checkout=2026-11-04&group_adults=4');
  });
  it('refuge ou camping : le site du lieu s’il est connu, sinon une recherche web', () => {
    expect(stayDeepLink({ ...base, kind: 'refuge', website: 'https://refuge.example' })).toBe('https://refuge.example');
    expect(stayDeepLink({ ...base, kind: 'camping', name: 'Camping des Écouges' })).toBe('https://duckduckgo.com/?q=Camping%20des%20%C3%89couges%20Rencurel%20r%C3%A9servation');
  });
  it('un bivouac ne se réserve pas : pas de lien', () => {
    expect(stayDeepLink({ ...base, kind: 'bivouac' })).toBeNull();
  });
});

describe('transport', () => {
  it('avion : Google Flights avec départ, arrivée et dates', () => {
    expect(flightSearchUrl({ origin: 'Lyon', destination: 'Reykjavik', depart: '2026-11-03', back: '2026-11-10' })).toBe(
      'https://www.google.com/travel/flights?q=Flights%20from%20Lyon%20to%20Reykjavik%20on%202026-11-03%20through%202026-11-10'
    );
    expect(flightSearchUrl({ origin: 'Lyon', destination: 'Reykjavik', depart: '2026-11-03', back: null })).toBe(
      'https://www.google.com/travel/flights?q=Flights%20from%20Lyon%20to%20Reykjavik%20on%202026-11-03'
    );
    expect(flightSearchUrl({ origin: null, destination: 'Reykjavik', depart: null, back: null })).toBe('https://www.google.com/travel/flights?q=Flights%20to%20Reykjavik');
    expect(flightSearchUrl({ origin: 'Lyon', destination: null, depart: null, back: null })).toBeNull();
  });
  it('train : itinéraire en transports en commun ; voiture : itinéraire en voiture', () => {
    expect(mapsDirectionsUrl({ origin: 'Lyon', destination: 'Saint-Marcellin', mode: 'transit' })).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=Lyon&destination=Saint-Marcellin&travelmode=transit'
    );
    expect(transportDeepLink({ mode: 'car', origin: 'Lyon', destination: 'Vercors (Isère)', depart: null, back: null })).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=Lyon&destination=Vercors%20(Is%C3%A8re)&travelmode=driving'
    );
    expect(transportDeepLink({ mode: 'train', origin: null, destination: 'Vercors', depart: null, back: null })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=Vercors&travelmode=transit'
    );
  });
  it('sans destination, ni à pied ni covoiturage : pas de lien inventé', () => {
    expect(transportDeepLink({ mode: 'train', origin: 'Lyon', destination: null, depart: null, back: null })).toBeNull();
    expect(transportDeepLink({ mode: 'foot', origin: 'Lyon', destination: 'Vercors', depart: null, back: null })).toBeNull();
    expect(transportDeepLink({ mode: 'carpool', origin: 'Lyon', destination: 'Vercors', depart: null, back: null })).toBeNull();
  });
  it('aucun lien ne porte de clé, de compte ou d’identifiant d’affiliation', () => {
    const all = [
      bookingSearchUrl({ place: 'Rencurel', checkIn: '2026-11-03', checkOut: '2026-11-04', adults: 2 }),
      transportDeepLink({ mode: 'flight', origin: 'Lyon', destination: 'Rome', depart: '2026-11-03', back: '2026-11-08' }),
      transportDeepLink({ mode: 'bus', origin: 'Lyon', destination: 'Rome', depart: null, back: null }),
    ];
    for (const url of all) {
      expect(url).toMatch(/^https:\/\/(www\.booking\.com|www\.google\.com)\//);
      expect(url).not.toMatch(/aid=|affiliate|partner|key=|token|label=/i);
    }
  });
});

describe('activitiesSearchUrl / carRentalUrl / objectSearchUrl (plan « À prévoir » complet)', () => {
  it('activités : recherche GetYourGuide sur le lieu, encodée ; sans lieu, rien', () => {
    expect(activitiesSearchUrl('Lisbonne')).toBe('https://www.getyourguide.com/s/?q=Lisbonne');
    expect(activitiesSearchUrl('Saint-Jean & co')).toBe('https://www.getyourguide.com/s/?q=Saint-Jean%20%26%20co');
    expect(activitiesSearchUrl('  ')).toBeNull();
    expect(activitiesSearchUrl(null)).toBeNull();
  });
  it('location de voiture : page d’accueil sans paramètre (aucun format profond fiable), jamais d’affiliation', () => {
    expect(carRentalUrl()).toBe('https://www.rentalcars.com/');
  });
  it('objet + lieu : recherche web préremplie, le lieu n’est pas répété s’il est déjà dans l’objet', () => {
    expect(objectSearchUrl('location vélo', 'Chamonix')).toBe('https://duckduckgo.com/?q=location%20v%C3%A9lo%20Chamonix');
    expect(objectSearchUrl('location vélo Chamonix', 'Chamonix')).toBe('https://duckduckgo.com/?q=location%20v%C3%A9lo%20Chamonix');
    expect(objectSearchUrl('forfait ski', null)).toBe('https://duckduckgo.com/?q=forfait%20ski');
    expect(objectSearchUrl('', 'Chamonix')).toBeNull();
  });
});
