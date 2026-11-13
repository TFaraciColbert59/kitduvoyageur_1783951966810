import { describe, expect, it } from 'vitest';
import {
  channelStatusLabel,
  correctionMethodLabel,
  formatChannel,
  formatDistanceKm,
  formatDuration,
  formatElevation,
  formatPace,
  formatRemainingDays,
  formatSpeed,
  formatSplitPace,
  recordReasonLabel,
  sportLabel,
  visibilityLabel,
} from '../format';

describe('A02 — formatage honnête de la fiche', () => {
  it('affiche « — » pour une valeur absente et 0 comme mesure explicite', () => {
    expect(formatDistanceKm(null)).toBe('—');
    expect(formatElevation(undefined)).toBe('—');
    expect(formatSpeed(null)).toBe('—');
    expect(formatPace(null)).toBe('—');
    expect(formatDistanceKm(0)).toBe('0 m');
    expect(formatElevation(0)).toBe('0 m');
    expect(formatSpeed(0)).toBe('0 km/h');
  });

  it('formate distances, durées et allures en français', () => {
    expect(formatDistanceKm(0.85)).toBe('850 m');
    expect(formatDistanceKm(12.34)).toMatch(/12,3 km/);
    expect(formatDuration(32)).toBe('32 s');
    expect(formatDuration(48 * 60)).toBe('48 min');
    expect(formatDuration(2 * 3600 + 4 * 60)).toBe('2 h 04');
    expect(formatPace(330)).toBe('5:30 /km');
    expect(formatSplitPace(1000, 300)).toBe('5:00 /km');
    expect(formatSplitPace(0, 300)).toBe('—');
  });

  it('borne les jours restants et ne rend jamais un négatif', () => {
    expect(formatRemainingDays(-5000)).toBe('moins d’un jour');
    expect(formatRemainingDays(0)).toBe('moins d’un jour');
    expect(formatRemainingDays(86_400_000)).toBe('1 jour');
    expect(formatRemainingDays(2 * 86_400_000)).toBe('2 jours');
    expect(formatRemainingDays(null)).toBe('—');
  });

  it('rend les canaux capteurs avec leur statut réel', () => {
    expect(
      formatChannel({
        status: 'unavailable',
        avg: null,
        max: null,
        min: null,
        sampleCount: 0,
        gapCount: 0,
      })
    ).toBe('Non mesuré');
    expect(
      channelStatusLabel({
        status: 'partial',
        avg: 140,
        max: 165,
        min: 90,
        sampleCount: 50,
        gapCount: 2,
      })
    ).toBe('Partiel');
    expect(
      formatChannel({
        status: 'measured',
        avg: 140,
        max: 165,
        min: 90,
        sampleCount: 50,
        gapCount: 0,
      })
    ).toContain('moy. 140');
  });

  it('nomme les sports, tags et méthodes de correction', () => {
    expect(sportLabel('rando')).toBe('Randonnée');
    expect(sportLabel(null)).toBe('—');
    expect(visibilityLabel('collective_anonymized')).toContain('Partagée');
    expect(correctionMethodLabel('raw', 'threshold_smoothing')).toContain('Lissage');
    expect(recordReasonLabel('cropped_trace')).toContain('recadrée');
    expect(recordReasonLabel('inconnu')).toBe('inconnu');
  });
});
