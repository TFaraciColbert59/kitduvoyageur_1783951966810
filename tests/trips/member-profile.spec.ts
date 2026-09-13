import { describe, it, expect } from 'vitest';
import {
  deriveMemberInput,
  type DerivedMemberInput,
  type FieldSource,
} from '@/features/trips/domain/memberProfile';

const SOURCE_VALUES: FieldSource[] = ['learned', 'estimated', 'average'];

const FIELD_KEYS = [
  'flatSpeedKmH',
  'ascentSpeedMPerHour',
  'descentSpeedMPerHour',
  'packWeightKg',
  'maxCarryKg',
  'experienceLevel',
  'limitations',
  'isChild',
].sort();

function expectExhaustiveSources(out: DerivedMemberInput): void {
  expect(Object.keys(out.sources).sort()).toEqual(FIELD_KEYS);
  for (const value of Object.values(out.sources)) {
    expect(SOURCE_VALUES).toContain(value);
  }
}

describe('deriveMemberInput — appris > estimé > moyenne (Task 16)', () => {
  it('profil calibré contextualization → vitesses apprises (learned)', () => {
    const out = deriveMemberInput({
      performanceProfile: {
        flat_speed_kmh: 5.4,
        ascent_speed_m_per_h: 430,
        descent_speed_m_per_h: 640,
        calibration_level: 'contextualization',
        sample_count: 24,
      },
    });

    expect(out.flatSpeedKmH).toBe(5.4);
    expect(out.ascentSpeedMPerHour).toBe(430);
    expect(out.descentSpeedMPerHour).toBe(640);
    expect(out.sources.flatSpeedKmH).toBe('learned');
    expect(out.sources.ascentSpeedMPerHour).toBe('learned');
    expect(out.sources.descentSpeedMPerHour).toBe('learned');
    expectExhaustiveSources(out);
  });

  it('profil calibré partiel → champ manquant en moyenne, les autres appris', () => {
    const out = deriveMemberInput({
      performanceProfile: {
        flat_speed_kmh: 5.2,
        ascent_speed_m_per_h: null,
        descent_speed_m_per_h: 610,
        calibration_level: 'contextualization',
        sample_count: 21,
      },
    });

    expect(out.flatSpeedKmH).toBe(5.2);
    expect(out.sources.flatSpeedKmH).toBe('learned');
    expect(out.ascentSpeedMPerHour).toBe(300);
    expect(out.sources.ascentSpeedMPerHour).toBe('average');
    expect(out.descentSpeedMPerHour).toBe(610);
    expect(out.sources.descentSpeedMPerHour).toBe('learned');
  });

  it('profil non calibré → aucune valeur apprise même si des vitesses existent', () => {
    for (const calibrationLevel of ['cold', 'calibration', 'personalization']) {
      const out = deriveMemberInput({
        performanceProfile: {
          flat_speed_kmh: 6,
          ascent_speed_m_per_h: 500,
          descent_speed_m_per_h: 700,
          calibration_level: calibrationLevel,
          sample_count: 12,
        },
      });

      expect(out.flatSpeedKmH).toBe(4);
      expect(out.ascentSpeedMPerHour).toBe(300);
      expect(out.descentSpeedMPerHour).toBe(500);
      expect(Object.values(out.sources)).not.toContain('learned');
      expectExhaustiveSources(out);
    }
  });

  it('calibration_level absent → moyenne même avec un sample_count élevé', () => {
    const out = deriveMemberInput({
      performanceProfile: {
        flat_speed_kmh: 5.8,
        ascent_speed_m_per_h: 480,
        descent_speed_m_per_h: 680,
        sample_count: 40,
      },
    });

    expect(out.flatSpeedKmH).toBe(4);
    expect(Object.values(out.sources)).not.toContain('learned');
  });

  it('orientation présente → expérience estimée + portage estimé (jamais le poids réel)', () => {
    const out = deriveMemberInput({
      orientation: { experience: 'regulier', terrain: 'montagne', autonomy: 'bivouac_1_2' },
    });

    expect(out.experienceLevel).toBe('intermediate');
    expect(out.sources.experienceLevel).toBe('estimated');
    expect(out.packWeightKg).toBe(12.6);
    expect(out.sources.packWeightKg).toBe('estimated');
    expect(out.maxCarryKg).toBe(14);
    expect(out.sources.maxCarryKg).toBe('estimated');
    expect(out.limitations).toBeNull();
    expect(out.sources.limitations).toBe('average');
    expectExhaustiveSources(out);
  });

  it('mapping expérience : debut → beginner, aguerri → advanced, inconnu → moyenne', () => {
    const debut = deriveMemberInput({ orientation: { experience: 'debut' } });
    expect(debut.experienceLevel).toBe('beginner');
    expect(debut.sources.experienceLevel).toBe('estimated');

    const aguerri = deriveMemberInput({ orientation: { experience: 'aguerri' } });
    expect(aguerri.experienceLevel).toBe('advanced');
    expect(aguerri.sources.experienceLevel).toBe('estimated');

    const inconnu = deriveMemberInput({ orientation: { experience: 'trakkeur' } });
    expect(inconnu.experienceLevel).toBe('intermediate');
    expect(inconnu.sources.experienceLevel).toBe('average');
  });

  it('profil calibré + orientation → vitesses apprises et expérience estimée (mixte)', () => {
    const out = deriveMemberInput({
      performanceProfile: {
        flat_speed_kmh: 5.1,
        ascent_speed_m_per_h: 410,
        descent_speed_m_per_h: 590,
        calibration_level: 'contextualization',
        sample_count: 25,
      },
      orientation: { experience: 'aguerri' },
    });

    expect(out.flatSpeedKmH).toBe(5.1);
    expect(out.sources.flatSpeedKmH).toBe('learned');
    expect(out.experienceLevel).toBe('advanced');
    expect(out.sources.experienceLevel).toBe('estimated');
    expect(out.packWeightKg).toBe(12.6);
    expect(out.sources.packWeightKg).toBe('estimated');
  });

  it('tout vide → moyennes intégrales (4 / 300 / 500, intermediate, 70 kg de base)', () => {
    const out = deriveMemberInput({});

    expect(out.flatSpeedKmH).toBe(4);
    expect(out.ascentSpeedMPerHour).toBe(300);
    expect(out.descentSpeedMPerHour).toBe(500);
    expect(out.experienceLevel).toBe('intermediate');
    expect(out.packWeightKg).toBe(12.6);
    expect(out.maxCarryKg).toBe(14);
    expect(out.limitations).toBeNull();
    expect(out.isChild).toBe(false);
    expect(Object.values(out.sources)).toEqual([
      'average',
      'average',
      'average',
      'average',
      'average',
      'average',
      'average',
      'average',
    ]);
    expectExhaustiveSources(out);
  });

  it('orientation vide (objet sans valeur) → moyennes, pas estimées', () => {
    const out = deriveMemberInput({ orientation: { experience: null, terrain: '', autonomy: null } });

    expect(out.experienceLevel).toBe('intermediate');
    expect(out.sources.experienceLevel).toBe('average');
    expect(out.sources.packWeightKg).toBe('average');
    expect(out.sources.maxCarryKg).toBe('average');
  });

  it('isChild transmis tel quel', () => {
    const child = deriveMemberInput({ isChild: true });
    expect(child.isChild).toBe(true);
    expect(child.sources.isChild).toBe('estimated');

    const explicitAdult = deriveMemberInput({ isChild: false });
    expect(explicitAdult.isChild).toBe(false);
    expect(explicitAdult.sources.isChild).toBe('estimated');

    const absent = deriveMemberInput({});
    expect(absent.isChild).toBe(false);
    expect(absent.sources.isChild).toBe('average');
  });

  it('sources exhaustives dans tous les cas (clés et valeurs du domaine)', () => {
    const raws = [
      {},
      { isChild: true },
      { orientation: { experience: 'regulier' } },
      { performanceProfile: { flat_speed_kmh: 5, calibration_level: 'contextualization', sample_count: 30 } },
      {
        performanceProfile: { flat_speed_kmh: 5, calibration_level: 'cold', sample_count: 1 },
        orientation: { terrain: 'sentier' },
      },
    ];

    for (const raw of raws) {
      expectExhaustiveSources(deriveMemberInput(raw));
    }
  });
});
