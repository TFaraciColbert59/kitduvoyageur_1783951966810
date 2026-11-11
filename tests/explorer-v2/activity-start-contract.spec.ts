import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_START_SPORTS,
  MAX_ROUTE_ID,
  STARTABLE_VARIANTS,
  buildStartActivityRpcBody,
  isCanonicalRouteId,
  normalizeRouteId,
  parseActivityStartBody,
  parseStartActivityRpcResult,
} from '@/features/explorer-v2/server/activityStart';
import { SPORT_FAMILIES, startAvailability } from '@/features/explorer-v2/sheet/sportSelection';
import type { Sport } from '@/features/explorer-v2/state/types';

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';

const READY = { locationPermission: 'granted' as const, gpsAvailable: true };

const BASE_SPORTS: Sport[] = [
  'course',
  'rando',
  'velo',
  'kayak',
  'trail',
  'ski',
  'escalade',
  'famille',
  'bivouac',
];

const ALL_VARIANTS = SPORT_FAMILIES.flatMap((family) => family.variants);
const BLOCKED_VARIANT = ALL_VARIANTS.find(
  (variant) => !startAvailability(variant, READY).startable
);

describe('explorer-v2 · contrat serveur de démarrage (S1.02, K6.15)', () => {
  it('conserve exactement les neuf sports historiques', () => {
    expect([...ACTIVITY_START_SPORTS].sort()).toEqual([...BASE_SPORTS].sort());
  });

  it('accepte chaque variante réellement démarrable avec son sport', () => {
    for (const variant of ALL_VARIANTS) {
      if (!startAvailability(variant, READY).startable) continue;
      const parsed = parseActivityStartBody({
        clientSessionId: CLIENT_ID,
        sport: variant.sport,
        variantId: variant.id,
      });
      expect(parsed.ok, variant.id).toBe(true);
      if (parsed.ok) {
        expect(parsed.value.variantId).toBe(variant.id);
        expect(parsed.value.sport).toBe(variant.sport);
        expect(STARTABLE_VARIANTS.has(variant.id)).toBe(true);
      }
    }
  });

  it('refuse une variante bloquée par la pile de capture', () => {
    expect(BLOCKED_VARIANT).toBeTruthy();
    if (!BLOCKED_VARIANT) return;
    const parsed = parseActivityStartBody({
      clientSessionId: CLIENT_ID,
      sport: BLOCKED_VARIANT.sport,
      variantId: BLOCKED_VARIANT.id,
    });
    expect(parsed).toEqual({
      ok: false,
      code: 'variant_unavailable',
      error: 'variante non démarrable',
    });
  });

  it('refuse une variante inconnue ou rattachée à un autre sport', () => {
    expect(
      parseActivityStartBody({
        clientSessionId: CLIENT_ID,
        sport: 'rando',
        variantId: 'rando-inexistante',
      })
    ).toEqual({ ok: false, code: 'unknown_variant', error: 'variante inconnue' });

    expect(
      parseActivityStartBody({
        clientSessionId: CLIENT_ID,
        sport: 'course',
        variantId: 'rando-journee',
      })
    ).toEqual({
      ok: false,
      code: 'variant_sport_mismatch',
      error: 'variante incompatible avec le sport',
    });
  });

  it('refuse un sport hors des neuf identifiants historiques', () => {
    expect(
      parseActivityStartBody({
        clientSessionId: CLIENT_ID,
        sport: 'golf',
      })
    ).toEqual({ ok: false, code: 'unknown_sport', error: 'sport inconnu' });
  });

  it('refuse les clés inconnues, dont un acteur fourni par le client', () => {
    expect(
      parseActivityStartBody({
        clientSessionId: CLIENT_ID,
        sport: 'rando',
        userId: SESSION_ID,
      })
    ).toEqual({ ok: false, code: 'invalid_body', error: 'démarrage invalide' });

    expect(
      parseActivityStartBody({
        clientSessionId: CLIENT_ID,
        sport: 'rando',
        sessionId: SESSION_ID,
      })
    ).toEqual({ ok: false, code: 'invalid_body', error: 'démarrage invalide' });
  });

  it('borne clientSessionId', () => {
    expect(parseActivityStartBody({ clientSessionId: 'pas-un-uuid', sport: 'rando' })).toEqual({
      ok: false,
      code: 'invalid_body',
      error: 'démarrage invalide',
    });
  });

  it('accepte les identifiants bigint du dépôt, nombres sûrs ou chaînes exactes', () => {
    // 1790027540898 est l'identifiant à 13 chiffres manipulé par la migration
    // 20261003090000 ; il dépasse largement la borne integer 2^31-1.
    const cases: Array<string | number> = [
      1790027540898,
      '1790027540898',
      Number.MAX_SAFE_INTEGER,
      String(Number.MAX_SAFE_INTEGER),
      MAX_ROUTE_ID,
      '9007199254740993',
    ];

    for (const routeId of cases) {
      const parsed = parseActivityStartBody({
        clientSessionId: CLIENT_ID,
        sport: 'rando',
        routeId,
      });
      expect(parsed.ok, String(routeId)).toBe(true);
      if (parsed.ok) expect(parsed.value.routeId).toBe(String(routeId));
    }
  });

  it('refuse les nombres non sûrs et les chaînes non canoniques sans arrondi', () => {
    const invalid: unknown[] = [
      0,
      -1,
      1.5,
      Number.MAX_SAFE_INTEGER + 1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      '0',
      '00',
      '01',
      '1.0',
      '1e3',
      ' 42',
      '42 ',
      '+42',
      '-42',
      '9223372036854775808',
      '99999999999999999999',
      'abc',
      '',
    ];

    for (const routeId of invalid) {
      expect(
        parseActivityStartBody({ clientSessionId: CLIENT_ID, sport: 'rando', routeId }),
        String(routeId)
      ).toEqual({ ok: false, code: 'invalid_body', error: 'démarrage invalide' });
    }

    // Un nombre au-delà de 2^53-1 est déjà arrondi par JavaScript : on le
    // refuse au lieu de transmettre un identifiant faux.
    expect(normalizeRouteId(Number.MAX_SAFE_INTEGER + 1)).toEqual({ ok: false });
    expect(normalizeRouteId('9007199254740993')).toEqual({
      ok: true,
      value: '9007199254740993',
    });
    expect(isCanonicalRouteId(MAX_ROUTE_ID)).toBe(true);
    expect(isCanonicalRouteId('9223372036854775808')).toBe(false);
  });

  it('normalise l’absence de variante et d’itinéraire en null', () => {
    expect(parseActivityStartBody({ clientSessionId: CLIENT_ID, sport: 'rando' })).toEqual({
      ok: true,
      value: {
        clientSessionId: CLIENT_ID,
        sport: 'rando',
        variantId: null,
        routeId: null,
      },
    });
  });

  it('construit le corps RPC sans acteur client', () => {
    expect(
      buildStartActivityRpcBody({
        clientSessionId: CLIENT_ID,
        sport: 'rando',
        variantId: 'rando-journee',
        routeId: '1790027540898',
      })
    ).toEqual({
      p_client_session_id: CLIENT_ID,
      p_sport: 'rando',
      p_variant_id: 'rando-journee',
      p_route_id: '1790027540898',
    });
  });

  it('lit le rejeu comme la même séance, avec created=false', () => {
    const result = parseStartActivityRpcResult({
      ok: true,
      created: false,
      sessionId: SESSION_ID,
      clientSessionId: CLIENT_ID,
      sport: 'rando',
      variantId: 'rando-journee',
      routeId: 42,
      startedAt: '2026-11-11T15:00:00+00:00',
      sessionStatus: 'live',
    });
    expect(result).toEqual({
      ok: true,
      session: {
        created: false,
        sessionId: SESSION_ID,
        clientSessionId: CLIENT_ID,
        sport: 'rando',
        variantId: 'rando-journee',
        routeId: '42',
        startedAt: '2026-11-11T15:00:00+00:00',
        sessionStatus: 'live',
      },
    });
  });

  it('normalise la réponse bigint en chaîne et refuse une réponse non sûre', () => {
    const exact = parseStartActivityRpcResult({
      ok: true,
      created: true,
      sessionId: SESSION_ID,
      clientSessionId: CLIENT_ID,
      sport: 'rando',
      variantId: 'rando-journee',
      routeId: '9007199254740993',
      startedAt: '2026-11-11T15:00:00+00:00',
      sessionStatus: 'live',
    });
    expect(exact).toMatchObject({ ok: true, session: { routeId: '9007199254740993' } });

    expect(
      parseStartActivityRpcResult({
        ok: true,
        created: true,
        sessionId: SESSION_ID,
        clientSessionId: CLIENT_ID,
        sport: 'rando',
        variantId: null,
        routeId: Number.MAX_SAFE_INTEGER + 1,
        startedAt: '2026-11-11T15:00:00+00:00',
        sessionStatus: 'live',
      })
    ).toEqual({ ok: false, reason: 'invalid_response' });
  });

  it('distingue un conflit de contenu d’une réponse invalide', () => {
    expect(parseStartActivityRpcResult({ ok: false, reason: 'payload_mismatch' })).toEqual({
      ok: false,
      reason: 'payload_mismatch',
    });

    expect(parseStartActivityRpcResult({ ok: false, reason: 'autre' })).toEqual({
      ok: false,
      reason: 'invalid_response',
    });

    expect(
      parseStartActivityRpcResult({
        ok: true,
        created: true,
        sessionId: SESSION_ID,
        clientSessionId: CLIENT_ID,
        sport: 'golf',
        variantId: null,
        routeId: null,
        startedAt: '2026-11-11T15:00:00+00:00',
        sessionStatus: 'live',
      })
    ).toEqual({ ok: false, reason: 'invalid_response' });

    expect(parseStartActivityRpcResult(null)).toEqual({
      ok: false,
      reason: 'invalid_response',
    });
  });
});
