/**
 * C9 — Tiroir « Quand » : heure de depart + duree.
 *
 * Un seul des deux termes etait livre : la duree, oui ; l'heure, non. Aucun
 * champ dans `CalendarBlock`, aucune saisie, et la route de commit ne pouvait
 * donc rien deposer.
 *
 * Ce fichier ferme le second terme. La regle de l'heure est ecrite UNE seule
 * fois, dans `types.ts` — le store l'applique a la saisie, la route
 * l'applique a la validation et a l'ecriture. Les deux series le verifient la,
 * sur les memes contre-exemples.
 *
 * Chaque test porte son CONTRE-EXEMPLE : sans lui, supprimer la regle ferait
 * passer la suite a vide.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useAdventurePrepStore, normalizeClockTime } from '../store/useAdventurePrepStore';
import { avecHeureDeDepart, HEURE_RE } from '../types';
import { fullDraft } from './fixtures';
import type { AdventurePrepDraft } from '../types';

const store = () => useAdventurePrepStore.getState();

/** Depot d'un calendrier sur un brouillon neuf, comme le fait l'ecran. */
function chargerCalendar(overrides: Partial<AdventurePrepDraft> = {}) {
  store().startNewAdventure();
  store().setCalendar(fullDraft(overrides).calendar);
}

describe('C9-1 — l’heure de depart existe dans le modele et se saisit', () => {
  beforeEach(() => chargerCalendar());

  it('C9-1a: le champ existe, et il est vide tant que personne ne saisit', () => {
    // CONTRE-EXEMPLE : aucune heure ne doit exister sans saisie.
    expect(fullDraft().calendar.startTime).toBeUndefined();
    expect(store().draft.calendar.startTime).toBeNull();
  });

  it('C9-1b: une heure saisie se lit telle quelle dans le draft', () => {
    store().setCalendarStartTime('08:30');
    expect(store().draft.calendar.startTime).toBe('08:30');
  });

  it('C9-1c: l’heure ne remplace ni la date ni la duree ni le retour', () => {
    const avant = store().draft.calendar;
    store().setCalendarStartTime('08:30');
    const apres = store().draft.calendar;
    expect(apres.startDate).toBe(avant.startDate);
    expect(apres.durationDays).toBe(avant.durationDays);
    expect(apres.returnDate).toBe(avant.returnDate);
  });

  it('C9-1d: effacer l’heure ne touche que l’heure', () => {
    store().setCalendarStartTime('08:30');
    store().setCalendarStartTime(null);
    expect(store().draft.calendar.startTime).toBeNull();
    expect(store().draft.calendar.durationDays).toBe(3);
  });
});

describe('C9-2 — seule une heure reelle est acceptee', () => {
  beforeEach(() => chargerCalendar());

  it('C9-2a: le leading zero est impose en sortie', () => {
    expect(normalizeClockTime('8:05')).toBe('08:05');
    expect(normalizeClockTime('23:59')).toBe('23:59');
    expect(normalizeClockTime('00:00')).toBe('00:00');
  });

  it('C9-2b: CONTRE-EXEMPLE — une forme fausse ne devient jamais une heure', () => {
    // Chaque cas est un contresens : le store ne doit RIEN en deduire.
    for (const faux of ['', '   ', 'abc', '8', '25:00', '12:60', '12:5', '-1:00', '08:30:00']) {
      expect(normalizeClockTime(faux)).toBeNull();
    }
    expect(normalizeClockTime(null)).toBeNull();
    expect(normalizeClockTime(undefined)).toBeNull();
  });

  it('C9-2c: une saisie hors forme vide le champ, elle ne l approche pas', () => {
    store().setCalendarStartTime('08:30');
    store().setCalendarStartTime('25:00');
    expect(store().draft.calendar.startTime).toBeNull();
  });

  it('C9-2d: HEURE_RE et normalizeClockTime ne se contredisent pas', () => {
    // La route valide avec HEURE_RE, le store ecrit avec normalizeClockTime :
    // si les deux divergeaient, une valeur pourrait passer l'une et pas l'autre.
    for (const bonne of ['00:00', '08:30', '9:05', '23:59']) {
      const n = normalizeClockTime(bonne);
      expect(n).not.toBeNull();
      expect(HEURE_RE.test(n as string)).toBe(true);
    }
    for (const mauvaise of ['24:00', '7:5', '', 'abc']) {
      const n = normalizeClockTime(mauvaise);
      if (n !== null) expect(HEURE_RE.test(n)).toBe(true);
    }
  });
});

describe('C9-3 — la route ne depose que ce qui a ete saisi', () => {
  it('C9-3a: une heure valide rejoint la metadata du voyage', () => {
    expect(avecHeureDeDepart({ prep: { days: 3 } }, '08:30').prep).toEqual({
      days: 3,
      startTime: '08:30',
    });
  });

  it('C9-3b: CONTRE-EXEMPLE — sans saisie, AUCUNE cle n est posee', () => {
    const meta = avecHeureDeDepart({ prep: { days: 3 } }, null);
    expect(meta.prep).toEqual({ days: 3 });
    // Pas meme un `startTime: null` : une cle posee se lirait comme un fait.
    expect(Object.prototype.hasOwnProperty.call(meta.prep as object, 'startTime')).toBe(false);
  });

  it('C9-3c: une heure hors forme n’entre pas non plus', () => {
    expect(avecHeureDeDepart({ prep: { days: 3 } }, '25:00').prep).toEqual({ days: 3 });
  });

  it('C9-3d: les autres cles de metadata sont conservees', () => {
    const meta = avecHeureDeDepart({ autre: 'garder', prep: { days: 2 } }, '06:00');
    expect(meta.autre).toBe('garder');
    expect(meta.prep).toEqual({ days: 2, startTime: '06:00' });
  });

  it('C9-3e: un `prep` qui n’est pas un objet n’empoisonne pas l’écriture', () => {
    expect(avecHeureDeDepart({ prep: 'parasite' }, '07:00').prep).toEqual({ startTime: '07:00' });
    expect(avecHeureDeDepart({ prep: [1, 2] }, '07:00').prep).toEqual({ startTime: '07:00' });
  });
});

describe('C9-4 — de la saisie a l’ecriture, sans detour', () => {
  it('C9-4a: une heure saisie aboutit a la metadata du voyage', () => {
    chargerCalendar();
    store().setCalendarStartTime('08:30');
    const saisi = store().draft.calendar.startTime;
    expect(avecHeureDeDepart({ prep: { days: 3 } }, saisi).prep).toMatchObject({
      startTime: '08:30',
    });
  });

  it('C9-4b: une heure jamais saisie n’aboutit a rien', () => {
    chargerCalendar();
    const jamais = store().draft.calendar.startTime;
    const meta = avecHeureDeDepart({ prep: { days: 3 } }, jamais);
    expect(Object.prototype.hasOwnProperty.call(meta.prep as object, 'startTime')).toBe(false);
  });
});
