import { describe, expect, it } from 'vitest';
import {
  filterEonetWildfires,
  parseMeteoAlarmAtom,
} from '@/features/hub/cockpit/officialAlertsServer';

describe('officialAlertsServer (P03-19 MeteoAlarm & P03-20 NASA EONET)', () => {
  it('parses MeteoAlarm CAP/Atom entries cleanly', () => {
    const xml = `
      <feed>
        <entry>
          <id>urn:oid:2.49.0.0.250.0.1</id>
          <title>Orange Wind Warning issued for Haute-Savoie</title>
          <cap:event>Wind</cap:event>
          <cap:severity>Severe</cap:severity>
          <cap:areaDesc>Haute-Savoie</cap:areaDesc>
          <cap:expires>2026-11-22T06:00:00Z</cap:expires>
        </entry>
      </feed>
    `;
    const alerts = parseMeteoAlarmAtom(xml);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      event: 'Wind',
      severity: 'Severe',
      area: 'Haute-Savoie',
      source: 'MeteoAlarm (CAP 1.2)',
    });
  });

  it('filters NASA EONET wildfires by haversine distance around trip point', () => {
    const sample = {
      events: [
        {
          id: 'EONET_1',
          title: 'Feu proche Chamonix',
          geometry: [{ date: '2026-11-21T08:00:00Z', coordinates: [6.90, 45.95] }],
        },
        {
          id: 'EONET_2',
          title: 'Feu Californie',
          geometry: [{ date: '2026-11-21T08:00:00Z', coordinates: [-119.5, 37.2] }],
        },
      ],
    };
    const nearby = filterEonetWildfires(sample, 45.92, 6.86, 50);
    expect(nearby).toHaveLength(1);
    expect(nearby[0].id).toBe('EONET_1');
    expect(nearby[0].distanceKm).toBeLessThan(10);
  });
});
