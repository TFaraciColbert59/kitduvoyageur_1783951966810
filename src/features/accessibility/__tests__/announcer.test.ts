// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  createScreenReaderAnnouncer,
  formatDistanceAriaLabel,
  formatDrawerStateAnnouncement,
  formatElevationAriaLabel,
  formatMapFeatureAriaLabel,
} from '../index';

describe('O02 screen reader announcer & ARIA formatters', () => {
  it('announces polite and assertive messages, deduplicates within window, and cleans up', () => {
    vi.useFakeTimers();
    let clock = 1000;
    const announcer = createScreenReaderAnnouncer({
      document,
      idPrefix: 'test-sr',
      now: () => clock,
    });

    expect(announcer.announce('Itinéraire chargé')).toBe(true);
    const polite = document.getElementById('test-sr-polite');
    expect(polite?.getAttribute('aria-live')).toBe('polite');
    expect(polite?.textContent).toBe('Itinéraire chargé');

    // Duplicate within dedupeWindowMs (400ms) is suppressed
    clock += 100;
    expect(announcer.announce('Itinéraire chargé')).toBe(false);

    // Assertive announcement uses alert region
    clock += 500;
    expect(announcer.announce('Signal GPS perdu', { politeness: 'assertive' })).toBe(true);
    const assertive = document.getElementById('test-sr-assertive');
    expect(assertive?.getAttribute('role')).toBe('alert');
    expect(assertive?.textContent).toBe('Signal GPS perdu');

    // Auto-clear after 5000ms
    vi.advanceTimersByTime(5000);
    expect(polite?.textContent).toBe('');
    expect(assertive?.textContent).toBe('');

    expect(announcer.getHistory()).toHaveLength(2);
    announcer.destroy();
    expect(document.getElementById('test-sr-polite')).toBeNull();
    vi.useRealTimers();
  });

  it('formats VoiceOver/TalkBack labels for distance, elevation, map features and drawers', () => {
    expect(formatDistanceAriaLabel(450)).toBe('450 mètres');
    expect(formatDistanceAriaLabel(3420)).toBe('3,4 kilomètres');
    expect(formatElevationAriaLabel(620)).toBe('620 mètres de dénivelé positif');
    expect(formatElevationAriaLabel(-150)).toBe('150 mètres de dénivelé négatif');
    expect(
      formatMapFeatureAriaLabel({
        name: 'Col du Galibier',
        category: 'Col',
        distanceMeters: 12400,
        elevationGainMeters: 850,
      }),
    ).toBe('Col du Galibier, Col, 12 kilomètres, 850 mètres de dénivelé positif');
    expect(formatDrawerStateAnnouncement('Réglages', true)).toBe('Panneau Réglages ouvert');
    expect(formatDrawerStateAnnouncement('Réglages', false)).toBe('Panneau Réglages fermé');
  });
});
