import { describe, expect, it } from 'vitest';
import {
  addDaysIso,
  buildAgendaDays,
  buildEventIcs,
  characterCount,
  crestSeed,
  daysBetweenIso,
  errorSummaryLabel,
  eventIcsFilename,
  foldWithIndexMap,
  formatCountFr,
  formatDateFull,
  formatDateShort,
  formatDateStamp,
  formatDateTimeFull,
  formatDays,
  formatDistanceKm,
  formatElevationM,
  formatInt,
  formatKm,
  formatPluralFr,
  formatRelativeTime,
  formatTime,
  formatWeightG,
  groupEventsByAgenda,
  highlightParts,
  initialsFromName,
  parisIsoDate,
  searchTerms,
  todayIso,
  tripDays,
} from '../format';

const NOW = new Date('2026-11-08T10:00:00+01:00');

describe('format — nombres et unités', () => {
  it('formate les entiers et décimaux en fr-FR', () => {
    expect(formatInt(1234)).toBe('1 234');
    expect(formatInt(null)).toBe('—');
    expect(formatKm(62.4)).toBe('62,4 km');
    expect(formatKm(62)).toBe('62 km');
    expect(formatKm(null)).toBe('—');
    expect(formatDistanceKm(12.04)).toBe('12 km');
    expect(formatElevationM(1620)).toBe('+1 620 m');
    expect(formatElevationM(null)).toBe('—');
    expect(formatDays(4)).toBe('4 j');
    expect(formatWeightG(850)).toBe('850 g');
    expect(formatWeightG(4200)).toBe('4,2 kg');
    expect(formatWeightG(1000)).toBe('1 kg');
    expect(formatWeightG(-1)).toBe('—');
  });

  it('accorde les pluriels à la française (0 et 1 au singulier)', () => {
    expect(formatPluralFr(0, 'membre')).toBe('membre');
    expect(formatPluralFr(1, 'membre')).toBe('membre');
    expect(formatPluralFr(2, 'membre')).toBe('membres');
    expect(formatCountFr(0, 'membre')).toBe('0 membre');
    expect(formatCountFr(3, 'membre')).toBe('3 membres');
  });
});

describe('format — dates Paris', () => {
  it('lit la date en entier', () => {
    expect(formatDateFull('2026-11-14T09:00:00+01:00', { now: NOW })).toBe('samedi 14 novembre');
    expect(formatDateFull('2025-01-02T09:00:00+01:00', { now: NOW })).toBe('jeudi 2 janvier 2025');
    expect(formatDateFull(null)).toBe('Date non renseignée');
  });

  it('formate les dates courtes et cartouches', () => {
    expect(formatDateShort('2026-11-08T12:00:00+01:00', { now: NOW })).toBe('8 nov.');
    expect(formatDateStamp('2026-11-14T09:00:00+01:00')).toEqual({ day: '14', month: 'NOV', year: '2026' });
    expect(formatTime('2026-11-14T08:00:00+01:00')).toBe('08:00');
    expect(formatDateTimeFull('2026-11-14T08:00:00+01:00')).toBe('samedi 14 novembre · 08:00');
  });

  it('formate le relatif', () => {
    expect(formatRelativeTime('2026-11-08T09:59:40+01:00', NOW)).toBe("à l'instant");
    expect(formatRelativeTime('2026-11-08T09:30:00+01:00', NOW)).toBe('il y a 30 min');
    expect(formatRelativeTime('2026-11-08T06:00:00+01:00', NOW)).toBe('il y a 4 h');
    expect(formatRelativeTime('2026-11-07T06:00:00+01:00', NOW)).toBe('hier');
    expect(formatRelativeTime('2026-11-05T06:00:00+01:00', NOW)).toBe('il y a 3 j');
  });

  it('calcule dates ISO, jours et carte agenda', () => {
    expect(todayIso(NOW)).toBe('2026-11-08');
    expect(addDaysIso('2026-11-08', 6)).toBe('2026-11-14');
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
    expect(daysBetweenIso('2026-11-08', '2026-11-11')).toBe(3);
    expect(tripDays('2026-11-08', '2026-11-11')).toBe(4);
    expect(tripDays(null, '2026-11-11')).toBeNull();
    expect(parisIsoDate('2026-11-08T23:30:00Z')).toBe('2026-11-09');
    const days = buildAgendaDays({ '2026-11-14': 2 }, '2026-11-08', 3);
    expect(days.map((d) => d.iso)).toEqual(['2026-11-08', '2026-11-09', '2026-11-10']);
    expect(days[0]?.isToday).toBe(true);
    expect(days[2]?.isWeekend).toBe(false);
  });
});

describe('format — agenda', () => {
  it('groupe ce week-end / semaine prochaine / plus tard', () => {
    const events = [
      { eventDate: '2026-11-14', id: 'a' },
      { eventDate: '2026-11-16', id: 'b' },
      { eventDate: '2026-12-24', id: 'c' },
      { eventDate: null, id: 'd' },
    ];
    const groups = groupEventsByAgenda(events, NOW);
    expect(groups.map((g) => g.label)).toEqual(['Ce week-end', 'La semaine prochaine', 'Plus tard']);
    expect(groups[0]?.items.map((e) => e.id)).toEqual(['a']);
    expect(groups[1]?.items.map((e) => e.id)).toEqual(['b']);
    expect(groups[2]?.items.map((e) => e.id)).toEqual(['c', 'd']);
  });
});

describe('format — surlignage tolérant aux accents', () => {
  it('replie en conservant la table des index', () => {
    const { folded, map } = foldWithIndexMap('Chamonix, Écrins');
    expect(folded).toBe('chamonix, ecrins');
    expect(map).toHaveLength(folded.length);
    expect(map[0]).toBe(0);
  });

  it('surligne un terme simple, accents et casse ignorés', () => {
    const parts = highlightParts('Chamonix, Écrins', ['ecrins']);
    expect(parts.filter((p) => p.match).map((p) => p.text)).toEqual(['Écrins']);
  });

  it('surligne plusieurs occurrences et gère l’absence', () => {
    const parts = highlightParts('lac blanc et lac noir', ['lac']);
    expect(parts.filter((p) => p.match)).toHaveLength(2);
    expect(highlightParts('aucun', ['zzz'])).toEqual([{ text: 'aucun', match: false }]);
  });

  it('extrait les termes utiles', () => {
    expect(searchTerms('  le  Lac, blanc ')).toEqual(['Lac', 'blanc']);
    expect(searchTerms('a')).toEqual([]);
  });
});

describe('format — divers', () => {
  it('calcule les initiales et les graines', () => {
    expect(initialsFromName('Camille Durand')).toBe('CD');
    expect(initialsFromName('@tony')).toBe('TO');
    expect(initialsFromName('Ton')).toBe('TO');
    expect(initialsFromName('')).toBe('?');
    expect(crestSeed('id-1', 'La Cordée')).toBe(crestSeed('id-1', 'La Cordée'));
    expect(crestSeed('id-1')).not.toBe(crestSeed('id-2'));
  });

  it('produit un .ics valide', () => {
    const ics = buildEventIcs({
      id: 'evt-1',
      title: 'Lac Blanc au lever du jour',
      startsAt: '2026-11-14T07:00:00+01:00',
      eventDate: '2026-11-14',
      location: 'Chamonix',
      meetingPoint: 'Parking de la Flégère',
      description: 'Sortie facile',
    });
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(ics).toContain('UID:evt-1@lekitduvoyageur');
    expect(ics).toContain('DTSTART:20261114T060000Z');
    expect(ics).toContain('SUMMARY:Lac Blanc au lever du jour');
    expect(ics).toContain('LOCATION:Chamonix — Parking de la Flégère');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(eventIcsFilename('Lac Blanc au lever du jour')).toBe('lkdv-sortie-lac-blanc-au-lever-du-jour.ics');
  });

  it('compte les caractères et le compteur d’erreurs', () => {
    expect(characterCount('abc', 10)).toEqual({ count: 3, max: 10, near: false });
    expect(characterCount('abcdefghij', 10).near).toBe(true);
    expect(errorSummaryLabel(0)).toBe('');
    expect(errorSummaryLabel(1)).toBe('1 champ à corriger');
    expect(errorSummaryLabel(2)).toBe('2 champs à corriger');
  });
});
