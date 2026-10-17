import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * PLAN-100 6.1 : messages des actions serveur du Compas dans la langue de la requête.
 * Le français reste au caractère près celui d'avant ; l'anglais vient du dictionnaire ;
 * un texte qui n'est pas une clé du Compas (message d'un autre module) passe tel quel.
 */
const h = vi.hoisted(() => ({ locale: 'fr' as 'fr' | 'en', user: null as null | { id: string } }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/i18n/serverLocale', () => ({ getRequestLocale: async () => h.locale }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: h.user } }) } }),
}));

import {
  actionError,
  isServerKey,
  serverIssue,
  serverMessage,
  serverPlural,
  serverText,
} from '../server/serverText';
import { requireEditor } from '../server/compasServer';
import {
  compasSetActivityAction,
  compasSetDatesAction,
  compasSetOriginAction,
} from '../server/compasActions';

const TRIP = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  h.locale = 'fr';
  h.user = null;
});

describe('serverMessage — dictionnaire compas.server', () => {
  it('français identique à l’ancien texte en dur', () => {
    expect(serverMessage('fr', 'compas.server.common.invalidRequest')).toBe('Requête invalide');
    expect(serverMessage('fr', 'compas.server.place.notFound', { place: 'Lyon' })).toBe(
      '« Lyon » introuvable sur la carte.'
    );
  });

  it('anglais naturel, données dans les emplacements', () => {
    expect(serverMessage('en', 'compas.server.common.invalidRequest')).toBe('Invalid request');
    expect(serverMessage('en', 'compas.server.place.notFound', { place: 'Lyon' })).toBe(
      '“Lyon” wasn’t found on the map.'
    );
  });

  it('pluriel par Intl.PluralRules, nombre formaté', () => {
    const one = 'compas.server.carrier.stuckVerifiedOne' as const;
    const other = 'compas.server.carrier.stuckVerifiedOther' as const;
    expect(serverPlural('fr', 1, one, other)).toBe(
      'La répartition a échoué et n’a pas pu être entièrement annulée : 1 objet a gardé son nouveau porteur. Vérifie le kit.'
    );
    expect(serverPlural('fr', 3, one, other)).toContain('3 objets ont gardé leur nouveau porteur');
    expect(serverPlural('en', 1, one, other)).toContain('1 item kept its new carrier');
    expect(serverPlural('en', 3, one, other)).toContain('3 items kept their new carrier');
  });
});

describe('serverIssue — message de validation (zod)', () => {
  it('une clé du Compas est traduite, un texte libre reste tel quel (repli français)', () => {
    expect(isServerKey('compas.server.dates.endBeforeStart')).toBe(true);
    expect(isServerKey('compas.server.inexistant')).toBe(false);
    expect(
      serverIssue('en', 'compas.server.dates.endBeforeStart', 'compas.server.dates.invalid')
    ).toBe('The end must come after the start.');
    expect(serverIssue('en', 'Texte d’un autre module', 'compas.server.dates.invalid')).toBe(
      'Texte d’un autre module'
    );
    expect(serverIssue('en', undefined, 'compas.server.dates.invalid')).toBe('Invalid dates');
  });
});

describe('langue de la requête', () => {
  it('serverText et actionError suivent getRequestLocale', async () => {
    expect(await serverText('compas.server.common.serverError')).toBe('Erreur serveur');
    h.locale = 'en';
    expect(await serverText('compas.server.common.serverError')).toBe('Server error');
    expect(await actionError('compas.server.activity.invalid')).toEqual({
      success: false,
      error: 'Invalid activity',
    });
  });

  it('requireEditor : refus dans la langue de la personne', async () => {
    expect(await requireEditor(TRIP)).toEqual({ error: 'Connecte-toi pour modifier le voyage.' });
    h.locale = 'en';
    expect(await requireEditor(TRIP)).toEqual({ error: 'Sign in to edit the trip.' });
  });

  it('une action renvoie son erreur en français par défaut, en anglais si demandé', async () => {
    const bad = { tripId: TRIP, tripSlug: 'rando', activity: 'nope' } as never;
    expect(await compasSetActivityAction(bad)).toEqual({
      success: false,
      error: 'Activité invalide',
    });
    h.locale = 'en';
    expect(await compasSetActivityAction(bad)).toEqual({
      success: false,
      error: 'Invalid activity',
    });
  });

  it('message de validation zod traduit (dates à l’envers)', async () => {
    const input = {
      tripId: TRIP,
      tripSlug: 'rando',
      startDate: '2026-07-10',
      endDate: '2026-07-01',
      durationHours: null,
    };
    expect(await compasSetDatesAction(input)).toEqual({
      success: false,
      error: 'La fin doit suivre le début.',
    });
    h.locale = 'en';
    expect(await compasSetDatesAction(input)).toEqual({
      success: false,
      error: 'The end must come after the start.',
    });
  });

  it('refus venu de requireEditor, traduit à la source', async () => {
    h.locale = 'en';
    const res = await compasSetOriginAction({
      tripId: TRIP,
      tripSlug: 'rando',
      place: null,
    } as never);
    expect(res).toEqual({ success: false, error: 'Sign in to edit the trip.' });
  });
});
