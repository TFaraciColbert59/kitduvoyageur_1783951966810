import { describe, expect, it } from 'vitest';
import { paceMemberFromProfile, paceProfileFromRow } from '../paceProfile';
import { groupPace } from '../insights/pace';

describe('Profil de performance → allure (10.8)', () => {
  it('un profil à froid ou sans échantillon n\'est pas une mesure : null', () => {
    expect(paceProfileFromRow({ flat_speed_kmh: 4.5, ascent_speed_m_per_h: 400, calibration_level: 'cold', sample_count: 0 })).toBeNull();
    expect(paceProfileFromRow({ flat_speed_kmh: 4.5, ascent_speed_m_per_h: 400, calibration_level: 'calibration', sample_count: 0 })).toBeNull();
    expect(paceProfileFromRow(null)).toBeNull();
  });

  it('rejette les valeurs aberrantes', () => {
    expect(paceProfileFromRow({ flat_speed_kmh: 90, ascent_speed_m_per_h: 400, calibration_level: 'calibration', sample_count: 5 })).toBeNull();
    expect(paceProfileFromRow({ flat_speed_kmh: '', ascent_speed_m_per_h: null, calibration_level: 'calibration', sample_count: 5 })).toBeNull();
  });

  it('lit un profil appris (numeric renvoyé en chaîne par Postgres) et alimente l\'allure du groupe', () => {
    const profile = paceProfileFromRow({ flat_speed_kmh: '4.23', ascent_speed_m_per_h: '380', calibration_level: 'personalization', sample_count: 12 });
    expect(profile).toEqual({ flatSpeedKmh: 4.2, ascentMPerHour: 380, calibrationLevel: 'personalization', sampleCount: 12 });
    const pace = groupPace([paceMemberFromProfile('u1', 'Alice', profile!)]);
    expect(JSON.stringify(pace)).toContain('4.2');
  });
});
