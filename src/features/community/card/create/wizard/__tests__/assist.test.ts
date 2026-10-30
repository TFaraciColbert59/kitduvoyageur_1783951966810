import { describe, expect, it } from 'vitest';
import {
  appendSentence,
  appendTag,
  forecastFor,
  formatWeight,
  missingEssentials,
  quickDates,
  shortDay,
  suggestHashtags,
  weatherLabel,
  weightByCategory,
} from '../assist';

describe('assist — mots-clés et phrases', () => {
  it('ne propose pas un mot-clé déjà écrit (accents et casse ignorés)', () => {
    const tags = suggestHashtags('Super nuit #Bivouac au #lac', ['bivouac', 'lac', 'refuge']);
    expect(tags).toEqual(['refuge']);
  });
  it('ajoute un mot-clé et une phrase proprement', () => {
    expect(appendTag('Belle journée  ', 'refuge')).toBe('Belle journée #refuge');
    expect(appendTag('', 'refuge')).toBe('#refuge');
    expect(appendSentence('Hello', 'On part tôt.')).toBe('Hello\nOn part tôt.');
    expect(appendSentence('Hello\nOn part tôt.', 'On part tôt.')).toBe('Hello\nOn part tôt.');
  });
});

describe('assist — dates rapides', () => {
  it('un jeudi : aujourd’hui, demain, samedi, dimanche', () => {
    const thursday = new Date(2026, 9, 29, 10); // jeudi 29 octobre 2026
    expect(quickDates(thursday)).toEqual([
      { id: '2026-10-29', label: 'Aujourd’hui' },
      { id: '2026-10-30', label: 'Demain' },
      { id: '2026-10-31', label: 'Samedi' },
      { id: '2026-11-01', label: 'Dimanche' },
    ]);
  });
  it('un samedi : pas de doublon', () => {
    const saturday = new Date(2026, 9, 31, 10);
    const ids = quickDates(saturday).map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['2026-10-31', '2026-11-01']);
  });
  it('écrit une date courte lisible', () => {
    expect(shortDay('2026-10-31')).toMatch(/sam/);
    expect(shortDay('pas une date')).toBe('');
  });
});

describe('assist — météo', () => {
  it('traduit les codes OMS', () => {
    expect(weatherLabel(0)).toBe('Ensoleillé');
    expect(weatherLabel(63)).toBe('Pluie');
    expect(weatherLabel(95)).toBe('Orage');
    expect(weatherLabel(null)).toBe('Météo inconnue');
  });
  it('lit le jour demandé, rien hors fenêtre', () => {
    const daily = { time: ['2026-10-31', '2026-11-01'], weather_code: [0, 61], temperature_2m_min: [2.4, 4], temperature_2m_max: [12.6, 9], precipitation_probability_max: [5, 80] };
    expect(forecastFor(daily, '2026-11-01')).toEqual({ label: 'Pluie', min: 4, max: 9, rain: 80 });
    expect(forecastFor(daily, '2026-12-25')).toBeNull();
  });
});

describe('assist — kit', () => {
  const items = [
    { name: 'Tente Nammatj', category: 'Abri', weightG: 2400 },
    { name: 'Sac Osprey', category: 'Portage', weightG: 1900 },
    { name: 'Frontale Petzl', category: 'Éclairage', weightG: 85 },
    { name: 'Gourde', category: null, weightG: null },
  ];
  it('répartit le poids connu par catégorie', () => {
    const rows = weightByCategory(items);
    expect(rows[0]).toMatchObject({ category: 'Abri', weightG: 2400 });
    expect(rows.reduce((sum, row) => sum + row.share, 0)).toBeCloseTo(1, 6);
  });
  it('liste les essentiels manquants selon la saison', () => {
    const winter = missingEssentials(items, 'hiver');
    expect(winter).toContain('Couchage');
    expect(winter).toContain('Vêtements chauds');
    expect(winter).not.toContain('Abri');
    expect(winter).not.toContain('Éclairage');
    expect(winter).not.toContain('Eau');
    expect(missingEssentials(items, 'ete')).toContain('Protection solaire');
  });
  it('formate le poids', () => {
    expect(formatWeight(850)).toBe('850 g');
    expect(formatWeight(4210)).toBe('4,2 kg');
  });
});
