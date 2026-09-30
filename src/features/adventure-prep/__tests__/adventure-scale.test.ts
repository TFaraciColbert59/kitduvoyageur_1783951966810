import { describe, it, expect } from 'vitest';
import { resolveAdventureScale, scaleProfile } from '../engine/adventureScale';
import { fullDraft } from './fixtures';

const withCalendar = (durationDays: number | null) =>
  ({ ...fullDraft().calendar, durationDays });

describe('Chantier — une aventure, à toutes les échelles', () => {
  it('SC-01: une course d’une heure est une sortie, sans nuitées ni budget', () => {
    const draft = fullDraft({
      activities: { primary: 'course', extra: [], nights: [] },
      calendar: withCalendar(null),
      group: { ...fullDraft().group, mode: 'solo', adults: 1 },
    });
    const profile = scaleProfile(draft);
    expect(profile.scale).toBe('sortie');
    expect(profile.sections).toEqual(['parcours', 'conditions', 'essentiels']);
    expect(profile.questions).toContain('heure_retour');
    expect(profile.showDayRail).toBe(false);
    expect(profile.generation).toBe('direct');
  });

  it('SC-02: une randonnée à la journée prépare eau, repas et sac', () => {
    const draft = fullDraft({
      activities: { primary: 'rando-journee', extra: [], nights: [] },
      calendar: withCalendar(1),
    });
    const profile = scaleProfile(draft);
    expect(profile.scale).toBe('journee');
    expect(profile.sections).toContain('eau_repas');
  });

  it('SC-03: trois jours avec bivouac sont une itinérance avec nuitées', () => {
    const draft = fullDraft({
      activities: { primary: 'rando-refuge', extra: [], nights: ['bivouac'] },
      calendar: withCalendar(3),
    });
    const profile = scaleProfile(draft);
    expect(profile.scale).toBe('itinerance');
    expect(profile.sections).toContain('nuitees');
    expect(profile.showDayRail).toBe(true);
  });

  it('SC-04: un mois est un voyage : ossature puis jours, rail par semaine, tendance météo', () => {
    const draft = fullDraft({
      activities: { primary: 'city-break', extra: ['course', 'plongee-autonome'], nights: [] },
      calendar: withCalendar(30),
    });
    const profile = scaleProfile(draft);
    expect(profile.scale).toBe('voyage');
    expect(profile.generation).toBe('ossature_puis_jours');
    expect(profile.initialDetailedDays).toBe(3);
    expect(profile.groupDaysByWeek).toBe(true);
    expect(profile.weatherMode).toBe('prevision_puis_tendance');
    expect(profile.sections).toEqual(expect.arrayContaining(['transports', 'reservations', 'documents']));
  });

  it('SC-05: une sortie courte en terrain engagé exige sac complet et hors ligne', () => {
    const draft = fullDraft({
      activities: { primary: 'alpinisme', extra: [], nights: [] },
      calendar: withCalendar(null),
      group: { ...fullDraft().group, adults: 1 },
    });
    const profile = scaleProfile(draft);
    expect(profile.engagedTerrain).toBe(true);
    expect(profile.sections).toEqual(expect.arrayContaining(['sac', 'hors_ligne']));
    expect(profile.sections).not.toContain('essentiels');
  });

  it('SC-06: un séjour de voyage de deux jours reste un voyage', () => {
    const draft = fullDraft({
      activities: { primary: 'city-break', extra: [], nights: [] },
      calendar: withCalendar(2),
    });
    expect(resolveAdventureScale(draft)).toBe('voyage');
  });
});
