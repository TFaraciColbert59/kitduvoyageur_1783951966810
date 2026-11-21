import { describe, expect, it } from 'vitest';
import {
  evaluateSourceFreshness,
  HUB_GEO_CATALOG,
  resolveAffectedDomains,
} from '@/features/hub/cockpit/geoCatalog';

describe('geoCatalog and incremental domain orchestration (P03/P08)', () => {
  it('classifies fresh, stale, unavailable and unconfigured geo sources honestly', () => {
    const now = Date.parse('2026-11-21T12:00:00Z');
    const fresh = evaluateSourceFreshness('met_norway', { temp: 12 }, '2026-11-21T11:30:00Z', now);
    expect(fresh.status).toBe('fresh');

    const stale = evaluateSourceFreshness('met_norway', { temp: 12 }, '2026-11-21T09:00:00Z', now);
    expect(stale.status).toBe('stale');

    const unconfigured = evaluateSourceFreshness('nasa_firms', null, null, now, true);
    expect(unconfigured.status).toBe('unconfigured');

    const unavailable = evaluateSourceFreshness('official_weather_alerts', null, null, now, false);
    expect(unavailable.status).toBe('unavailable');
    expect(HUB_GEO_CATALOG.osm_postgis_poi.caveat).toContain('potabilité');
  });

  it('invalidates only dependent domains per business event (P08-02)', () => {
    expect(resolveAffectedDomains('expense_recorded')).toEqual(['budget']);
    expect(resolveAffectedDomains('kit_toggled')).toEqual(['kit']);
    expect(resolveAffectedDomains('moment_created')).toEqual(['carnet']);
    expect(resolveAffectedDomains('member_changed')).toEqual(['groupe', 'budget', 'kit']);
  });
});
