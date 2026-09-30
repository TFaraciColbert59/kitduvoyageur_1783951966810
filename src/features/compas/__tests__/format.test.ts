import { describe, expect, it } from 'vitest';
import {
  activityLabel,
  durationZone,
  formatDuration,
  formatHours,
  formatKg,
  formatKm,
  formatMoney,
  formatWeekday,
  initials,
  paginate,
  rulerPosition,
  weatherLabel,
} from '../engine/format';

describe('formats du Compas', () => {
  it('une valeur absente reste « — », jamais zéro', () => {
    expect(formatKg(null)).toBe('—');
    expect(formatKm(0)).toBe('—');
    expect(formatDuration(undefined)).toBe('—');
    expect(formatMoney(null)).toBe('—');
  });

  it('poids : grammes sous 1 kg, kilos au-delà', () => {
    expect(formatKg(480)).toBe('480 g');
    expect(formatKg(6200)).toBe('6,2 kg');
  });

  it('durées lisibles', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(120)).toBe('2 h');
    expect(formatDuration(325)).toBe('5 h 25');
  });

  it('jour de la semaine en français', () => {
    expect(formatWeekday('2026-10-12')).toBe('lun. 12');
  });

  it('codes météo WMO → icônes du registre', () => {
    expect(weatherLabel(0).icon).toBe('sun');
    expect(weatherLabel(63).label).toBe('Pluie');
    expect(weatherLabel(95).icon).toBe('cloud-lightning');
  });

  it('pagination exacte, jamais de page vide sauf liste vide', () => {
    expect(paginate([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(paginate([], 3)).toEqual([[]]);
    expect(paginate([1], 0)).toEqual([[1]]);
  });

  it('initiales', () => {
    expect(initials('Tony Faraci')).toBe('TF');
    expect(initials('  ')).toBe('?');
  });
});


describe('échelle de durée', () => {
  it('bornes et zones de la maquette', () => {
    expect(rulerPosition(0.25)).toBe(0);
    expect(rulerPosition(720)).toBe(1);
    expect(durationZone(2)).toBe('Sortie');
    expect(durationZone(96)).toBe('Expédition');
    expect(durationZone(400)).toBe('Monde');
    expect(formatHours(96)).toBe('4 j');
    expect(formatHours(5.5)).toBe('5 h 30');
  });
  it('libellé d’activité sans invention', () => {
    expect(activityLabel('hiking')).toBe('Randonnée');
    expect(activityLabel(null)).toBeNull();
    expect(activityLabel('packraft')).toBe('Packraft');
  });
});
