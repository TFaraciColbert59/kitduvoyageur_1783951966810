import { describe, expect, it } from 'vitest';
import fixture from './fixtures/gdacs-2026-11-23.json';
import { alertsFromWorld, readAlerts } from '../alerts';
import { gdacsImpactsOnTrack, parseGdacs, worldHazardPayload } from '../gdacs';

// Réponse réelle de GDACS du 23/11/2026 (2 événements) : sécheresse en Afrique (ignorée) et cyclone MURASU (Rouge,
// Inde, valable jusqu'au 03/11/2026 06:00 UTC).
const NOW_DURING = new Date('2026-11-02T12:00:00Z');
const NOW_AFTER = new Date('2026-11-23T12:00:00Z');
const NEAR_CYCLONE = [{ lat: 15.5, lon: 80.4 }, { lat: 15.9, lon: 80.6 }];
const FAR = [{ lat: 45.9, lon: 6.8 }];

describe('GDACS : catastrophes mondiales (7.6)', () => {
  it('lit la réponse réelle : seuls les types utiles en Orange / Rouge, dates UTC explicites', () => {
    const events = parseGdacs(fixture);
    expect(events).not.toBeNull();
    expect(events!.map((e) => e.eventType)).toEqual(['TC']);
    expect(events![0]).toMatchObject({ level: 'rouge', validUntil: '2026-11-03T06:00:00.000Z', observedAt: '2026-11-04T06:01:20.000Z' });
    expect(events![0].url).toMatch(/^https:\/\/www\.gdacs\.org\//);
  });

  it('rapproche un événement en cours du tracé, avec sa distance ; hors de portée : rien', () => {
    const events = parseGdacs(fixture)!;
    const near = gdacsImpactsOnTrack(events, NEAR_CYCLONE, NOW_DURING);
    expect(near).toHaveLength(1);
    expect(near[0].distanceKm).toBeLessThan(60);
    expect(gdacsImpactsOnTrack(events, FAR, NOW_DURING)).toEqual([]);
  });

  it('un événement échu est écarté', () => {
    expect(gdacsImpactsOnTrack(parseGdacs(fixture)!, NEAR_CYCLONE, NOW_AFTER)).toEqual([]);
  });

  it('un flux illisible est « indisponible », jamais « rien à signaler »', () => {
    expect(parseGdacs({ pas: 'un flux' })).toBeNull();
    expect(parseGdacs(null)).toBeNull();
    const down = worldHazardPayload(null, FAR, '2026-11-23T10:00:00Z', NOW_AFTER);
    expect(down.status).toBe('unavailable');
    expect(readAlerts([], null, NOW_AFTER, null, down).gaps.join(' ')).toMatch(/GDACS indisponible/);
    const clear = worldHazardPayload([], FAR, '2026-11-23T10:00:00Z', NOW_AFTER);
    expect(clear.status).toBe('clear');
    expect(readAlerts([], null, NOW_AFTER, null, clear).gaps.join(' ')).not.toMatch(/GDACS/);
  });

  it('chaque alerte porte source, date de relevé et fin de validité ; position dite approximative', () => {
    const payload = worldHazardPayload(parseGdacs(fixture)!, NEAR_CYCLONE, '2026-11-02T12:00:00.000Z', NOW_DURING);
    const [a] = alertsFromWorld(payload, NOW_DURING);
    expect(a).toMatchObject({ kind: 'vigilance', severity: 'critical', expired: false, validUntil: '2026-11-03T06:00:00.000Z' });
    expect(a.source).toMatch(/GDACS/);
    expect(a.detail).toMatch(/approximative/);
    expect(alertsFromWorld(payload, NOW_AFTER)[0].expired).toBe(true);
  });

  it('dit à l’écran que NWS / ECCC sont éteints sur le serveur', () => {
    const off = readAlerts([], null, NOW_AFTER, { status: 'non_couvert', service: null, readAt: null, worldSwitch: 'off', alerts: [] });
    expect(off.gaps.join(' ')).toMatch(/NWS .*désactivée .*COMPAS_ALERTS_WORLD/);
    const on = readAlerts([], null, NOW_AFTER, { status: 'non_couvert', service: null, readAt: null, worldSwitch: 'on', alerts: [] });
    expect(on.gaps.join(' ')).toMatch(/pas de flux utilisable/);
  });

  it('FIRMS sans clé : message explicite (NASA_FIRMS_MAP_KEY)', () => {
    const reading = readAlerts([], { status: 'unavailable', source: null, retrievedAt: null, reason: 'Source feux actifs non configurée (NASA_FIRMS_MAP_KEY requise) : aucun « aucun feu » affiché.', impacts: [] }, NOW_AFTER);
    expect(reading.gaps.join(' ')).toMatch(/NASA_FIRMS_MAP_KEY/);
  });
});
