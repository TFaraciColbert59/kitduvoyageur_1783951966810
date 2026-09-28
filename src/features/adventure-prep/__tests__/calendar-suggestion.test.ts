import { describe, it, expect } from 'vitest';
import { daysFromSuggestedHours, suggestDuration } from '../engine/calendar';
import { draftActions } from '../store/reducer';
import { emptyDraft } from '../engine/emptyDraft';
import { fullDraft } from './fixtures';

describe('daysFromSuggestedHours', () => {
  it('ramene une sortie de moins de 24 h a une journee', () => {
    expect(daysFromSuggestedHours(6)).toBe(1);
    expect(daysFromSuggestedHours(23)).toBe(1);
  });

  it('arrondit au jour superieur pour une duree de plus de 24 h', () => {
    expect(daysFromSuggestedHours(24)).toBe(1);
    expect(daysFromSuggestedHours(25)).toBe(2);
    expect(daysFromSuggestedHours(48)).toBe(2);
    expect(daysFromSuggestedHours(72)).toBe(3);
  });

  it('borne entre 1 et 60 jours et refuse une duree absente', () => {
    expect(daysFromSuggestedHours(0)).toBeNull();
    expect(daysFromSuggestedHours(-4)).toBeNull();
    expect(daysFromSuggestedHours(1)).toBe(1);
    expect(daysFromSuggestedHours(24 * 400)).toBe(60);
  });
});

describe('suggestDuration', () => {
  it('remplit une duree absente d apres l activite principale', () => {
    const draft = emptyDraft();
    const next = suggestDuration(
      { ...draft, activities: { primary: 'rando-journee', extra: [], nights: [] } },
    );
    expect(next.calendar.durationDays).toBe(1);
    expect(next.calendar.durationIsSuggested).toBe(true);
  });

  it('ne touche pas une duree saisie a la main', () => {
    const draft = {
      ...emptyDraft(),
      activities: { primary: 'rando-journee' as const, extra: [], nights: [] },
      calendar: { startDate: null, durationDays: 5, durationIsSuggested: false, startDateIsSuggested: false, returnDate: null },
    };
    expect(suggestDuration(draft).calendar.durationDays).toBe(5);
    expect(suggestDuration(draft).calendar.durationIsSuggested).toBe(false);
  });

  it('recalcule quand la duree courante n etait qu une proposition', () => {
    const draft = {
      ...emptyDraft(),
      activities: { primary: 'rando-journee' as const, extra: [], nights: [] },
      calendar: { startDate: null, durationDays: 1, durationIsSuggested: true, startDateIsSuggested: false, returnDate: null },
    };
    const next = suggestDuration({
      ...draft,
      activities: { primary: 'rando-refuge', extra: [], nights: [] },
    });
    expect(next.calendar.durationDays).toBe(1); // 24 h -> 1 journee
    expect(next.calendar.durationIsSuggested).toBe(true);
  });

  it('conserve la date de retour coherente avec la nouvelle duree', () => {
    const draft = {
      ...emptyDraft(),
      activities: { primary: 'rando-journee' as const, extra: [], nights: [] },
      calendar: {
        startDate: '2026-07-11',
        durationDays: 1,
        durationIsSuggested: true,
        startDateIsSuggested: false,
        returnDate: '2026-07-11',
      },
    };
    const next = suggestDuration({
      ...draft,
      activities: { primary: 'roadtrip', extra: [], nights: [] },
    });
    expect(next.calendar.durationDays).toBe(4);
    expect(next.calendar.returnDate).toBe('2026-07-14');
  });

  it('laisse le calendrier intact sans activite principale', () => {
    const draft = emptyDraft();
    expect(suggestDuration(draft).calendar.durationDays).toBeNull();
  });
});

describe('draftActions.setActivities', () => {
  it('suggestit la duree des la selection, ce qui deverrouille l etape 1', () => {
    const draft = fullDraft({
      activities: { primary: null, extra: [], nights: [] },
      calendar: { startDate: null, durationDays: null, durationIsSuggested: false, startDateIsSuggested: false, returnDate: null },
    });
    const next = draftActions.setActivities(draft, {
      primary: 'rando-journee',
      extra: [],
      nights: [],
    });
    expect(next.calendar.durationDays).toBe(1);
    expect(next.calendar.durationIsSuggested).toBe(true);
  });

  it('ne mute jamais le brouillon d origine', () => {
    const draft = fullDraft({
      activities: { primary: null, extra: [], nights: [] },
      calendar: { startDate: null, durationDays: null, durationIsSuggested: false, startDateIsSuggested: false, returnDate: null },
    });
    const before = JSON.stringify(draft);
    draftActions.setActivities(draft, { primary: 'rando-journee', extra: [], nights: [] });
    expect(JSON.stringify(draft)).toBe(before);
  });
});

