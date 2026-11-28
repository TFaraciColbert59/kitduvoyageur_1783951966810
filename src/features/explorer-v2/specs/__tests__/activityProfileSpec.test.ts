import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ActivityProfileSpecSchema } from '../activityProfileSpec.schema';
import {
  computeCommuteCo2Grams,
  computeMinettiGapMultiplier,
  formatPrimarySpeedMetric,
  isKnownActivitySlugOrAlias,
  listActivityProfiles,
  resolveActivityProfile,
} from '../resolveActivityProfile';
import { V1_ACTIVITY_PROFILES } from '../v1Profiles.seed';

describe('Lot 01 — ActivityProfileSpec declarative contract & 95 CSV aliases', () => {
  it('validates all 13 V1 profiles strictly against ActivityProfileSpecSchema', () => {
    expect(V1_ACTIVITY_PROFILES).toHaveLength(13);
    for (const profile of V1_ACTIVITY_PROFILES) {
      const parsed = ActivityProfileSpecSchema.safeParse(profile);
      if (!parsed.success) {
        throw new Error(`Profile ${profile.identity.slugId} failed validation: ${parsed.error.message}`);
      }
      expect(parsed.success).toBe(true);
    }
  });

  it('resolves every single one of the 95 activity IDs from docs/explorer-v2/CATALOGUE_ACTIVITES_ET_METRIQUES.csv', () => {
    const csvPath = path.resolve(process.cwd(), 'docs/explorer-v2/CATALOGUE_ACTIVITES_ET_METRIQUES.csv');
    const lines = fs.readFileSync(csvPath, 'utf8').trim().split(/\r?\n/).slice(1);
    expect(lines.length).toBe(95);

    for (const line of lines) {
      const id = line.split(',')[0]!.trim();
      expect(isKnownActivitySlugOrAlias(id), `CSV slug "${id}" must be mapped`).toBe(true);
      const resolved = resolveActivityProfile(id);
      expect(resolved.identity.slugId).toBeTruthy();
    }
  });

  it('enforces anti-km/h formatting for running & trail, VAM for mountaineering, km/h for cycling', () => {
    const run = resolveActivityProfile('course-route');
    expect(run.identity.slugId).toBe('running');
    const runFmt = formatPrimarySpeedMetric(run, { distanceM: 10_000, movingS: 3_000 });
    expect(runFmt.unitLabel).toBe('min/km');
    expect(runFmt.valueText).toBe('5:00');

    const trail = resolveActivityProfile('trail-10k');
    expect(trail.identity.slugId).toBe('trail_running');
    const trailFmt = formatPrimarySpeedMetric(trail, { distanceM: 10_000, movingS: 3_600 });
    expect(trailFmt.unitLabel).toBe('min/km');
    expect(trailFmt.valueText).toBe('6:00');

    const alpi = resolveActivityProfile('alpinisme');
    expect(alpi.algorithms.autoPause.lockDisabledBySafety).toBe(true);
    const alpiFmt = formatPrimarySpeedMetric(alpi, { distanceM: 4_000, movingS: 3_600, elevGainM: 650 });
    expect(alpiFmt.unitLabel).toBe('m/h');
    expect(alpiFmt.valueText).toBe('650');

    const road = resolveActivityProfile('velo-route');
    const roadFmt = formatPrimarySpeedMetric(road, { distanceM: 30_000, movingS: 3_600 });
    expect(roadFmt.unitLabel).toBe('km/h');
    expect(roadFmt.valueText).toBe('30,0');
  });

  it('enforces dual EPZ and private visibility on bike_commute and calculates ADEME CO2 savings', () => {
    const commute = resolveActivityProfile('velo-velotaf');
    expect(commute.identity.slugId).toBe('bike_commute');
    expect(commute.privacyAndCompliance.epzMode).toBe('dual_home_work');
    expect(commute.privacyAndCompliance.defaultVisibility).toBe('private');
    expect(computeCommuteCo2Grams(10_000)).toBe(1920);
  });

  it('computes Minetti GAP multiplier accurately and clamps extreme grades', () => {
    expect(computeMinettiGapMultiplier(0)).toBeCloseTo(1.0, 2);
    expect(computeMinettiGapMultiplier(10)).toBeCloseTo(1.658, 2);
    expect(computeMinettiGapMultiplier(15)).toBeCloseTo(2.06, 2);
    expect(computeMinettiGapMultiplier(80, -35, 35)).toBe(computeMinettiGapMultiplier(35, -35, 35));
  });

  it('lists active V1 profiles cleanly by wave', () => {
    expect(listActivityProfiles({ wave: 'V1_SOCLE' })).toHaveLength(13);
  });
});
