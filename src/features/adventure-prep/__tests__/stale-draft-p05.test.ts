import { describe, it, expect } from 'vitest';
import { staleDraftNotice, todayCivilIso } from '../engine/staleDraft';
import { emptyDraft } from '../engine/emptyDraft';
import type { AdventurePrepDraft, CalendarBlock } from '../types';

const AVANT = '2026-09-28';

const calendar = (startDate: string | null): CalendarBlock => ({
  startDate,
  durationDays: 1,
  durationIsSuggested: false,
  startDateIsSuggested: false,
  returnDate: startDate,
});

const draftWith = (startDate: string | null): AdventurePrepDraft => ({
  ...emptyDraft(),
  calendar: calendar(startDate),
});

describe('staleDraftNotice', () => {
  it('ne signale rien quand aucune date n a ete choisie', () => {
    expect(staleDraftNotice(draftWith(null), AVANT)).toBeNull();
  });

  it('ne signale rien le jour meme', () => {
    expect(staleDraftNotice(draftWith(AVANT), AVANT)).toBeNull();
  });

  it('ne signale rien sur une date a venir', () => {
    expect(staleDraftNotice(draftWith('2026-10-15'), AVANT)).toBeNull();
  });

  it('signale un brouillon dont la date de depart est passee', () => {
    const notice = staleDraftNotice(draftWith('2026-09-21'), AVANT);
    expect(notice).not.toBeNull();
    expect(notice?.startDate).toBe('2026-09-21');
    expect(notice?.daysAgo).toBe(7);
  });

  it('compte un jour de retard pour la veille', () => {
    expect(staleDraftNotice(draftWith('2026-09-27'), AVANT)?.daysAgo).toBe(1);
  });

  it('compte le retard sur plusieurs mois sans deriver', () => {
    expect(staleDraftNotice(draftWith('2026-06-01'), AVANT)?.daysAgo).toBe(119);
  });

  it('ignore une date illisible plutot que d inventer une alerte', () => {
    expect(staleDraftNotice(draftWith('demain'), AVANT)).toBeNull();
    expect(staleDraftNotice(draftWith(''), AVANT)).toBeNull();
    expect(staleDraftNotice(draftWith('2026-13-45'), AVANT)).toBeNull();
  });

  it('ignore une date qui n existe pas au calendrier', () => {
    expect(staleDraftNotice(draftWith('2026-02-31'), AVANT)).toBeNull();
    expect(staleDraftNotice(draftWith('2026-04-31'), AVANT)).toBeNull();
  });

  it('ignore une date du jour illisible plutot que de lever', () => {
    expect(staleDraftNotice(draftWith('2026-09-21'), 'hier')).toBeNull();
  });

  it('ne mute jamais le brouillon d origine', () => {
    const draft = draftWith('2026-09-21');
    const before = JSON.stringify(draft);
    staleDraftNotice(draft, AVANT);
    expect(JSON.stringify(draft)).toBe(before);
  });

  it('renvoie un objet nouveau a chaque appel, jamais partage', () => {
    const draft = draftWith('2026-09-21');
    const a = staleDraftNotice(draft, AVANT);
    const b = staleDraftNotice(draft, AVANT);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('todayCivilIso', () => {
  it('donne la date civile locale, jamais la date UTC', () => {
    // 00h30 le 28 a Paris : en UTC, il peut encore etre le 27. C est
    // exactement le piege que D8 a fait interdire pour les dates de voyage.
    const minuitLocal = new Date(2026, 8, 28, 0, 30, 0);
    expect(todayCivilIso(minuitLocal)).toBe('2026-09-28');
  });

  it('complete le mois et le jour sur deux chiffres', () => {
    expect(todayCivilIso(new Date(2026, 0, 5, 12, 0, 0))).toBe('2026-01-05');
  });

  it('refuse une date illisible plutot que d inventer un jour', () => {
    expect(todayCivilIso(new Date('nope'))).toBeNull();
  });
});