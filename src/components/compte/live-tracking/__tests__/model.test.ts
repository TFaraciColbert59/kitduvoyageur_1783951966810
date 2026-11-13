import { describe, expect, it } from 'vitest';

import {
  FRESHNESS_LABEL,
  GUEST_FAIL_COPY,
  MAX_SHARE_MINUTES,
  MIN_SHARE_MINUTES,
  SHARE_LINK_LABEL,
  formatAge,
  formatCoordinate,
  formatDuration,
  formatRemaining,
  isValidContactDestination,
  isValidEmail,
  isValidPhone,
  isValidShareDuration,
  maskDestination,
} from '../model';

describe('P02 UI — modèle de présentation', () => {
  it('borne la durée de partage entre 5 minutes et 72 heures', () => {
    expect(isValidShareDuration(MIN_SHARE_MINUTES)).toBe(true);
    expect(isValidShareDuration(MAX_SHARE_MINUTES)).toBe(true);
    expect(isValidShareDuration(MIN_SHARE_MINUTES - 1)).toBe(false);
    expect(isValidShareDuration(MAX_SHARE_MINUTES + 1)).toBe(false);
    expect(isValidShareDuration(60.5)).toBe(false);
    expect(isValidShareDuration(Number.NaN)).toBe(false);
  });

  it('formate les durées et les échéances sans inventer de secondes', () => {
    expect(formatDuration(30)).toBe('30 min');
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(90)).toBe('1 h 30 min');
    expect(formatDuration(24 * 60)).toBe('1 j');
    expect(formatDuration(26 * 60)).toBe('1 j 2 h');
    expect(formatDuration(Number.NaN)).toBe('—');

    const now = Date.UTC(2026, 10, 13, 10, 0, 0);
    expect(formatRemaining(null, now)).toBe('Sans échéance');
    expect(formatRemaining(new Date(now - 1).toISOString(), now)).toBe('Terminé');
    expect(formatRemaining(new Date(now + 90 * 60_000).toISOString(), now)).toBe('1 h 30 min');
  });

  it('rend l’âge d’une position lisible et stable', () => {
    expect(formatAge(null)).toBe('Aucune position');
    expect(formatAge(2)).toBe('à l’instant');
    expect(formatAge(42)).toBe('il y a 42 s');
    expect(formatAge(120)).toBe('il y a 2 min');
    expect(formatAge(3 * 3600)).toBe('il y a 3 h');
  });

  it('formate les coordonnées avec 5 décimales et gère l’absence de valeur', () => {
    expect(formatCoordinate(45.188529)).toBe('45.18853');
    expect(formatCoordinate(-5.724524)).toBe('-5.72452');
    expect(formatCoordinate(Number.NaN)).toBe('—');
  });

  it('valide les destinations de contact sans accepter de saisie vide', () => {
    expect(isValidEmail('camille@exemple.fr')).toBe(true);
    expect(isValidEmail('camille@exemple')).toBe(false);
    expect(isValidPhone('+33 6 12 34 56 78')).toBe(true);
    expect(isValidPhone('06')).toBe(false);
    expect(isValidContactDestination('sms', '+33612345678')).toBe(true);
    expect(isValidContactDestination('email', 'nope')).toBe(false);
    expect(isValidContactDestination('push', 'ab')).toBe(false);
    expect(isValidContactDestination('in_app', '')).toBe(false);
  });

  it('masque les destinataires dans les listes', () => {
    expect(maskDestination('email', 'camille@exemple.fr')).toBe('ca•••@exemple.fr');
    expect(maskDestination('sms', '+33612345678')).toContain('5678');
    expect(maskDestination('sms', '+33612345678')).not.toContain('612345');
    expect(maskDestination('push', 'abcdef')).toBe('••••••');
    expect(maskDestination('push', 'push-token-1234')).toBe('pu••••34');
  });

  it('couvre tous les états de lien et toutes les causes fail-closed', () => {
    expect(Object.keys(SHARE_LINK_LABEL).sort()).toEqual(
      ['active', 'expired', 'revoked', 'session_ended'].sort()
    );
    expect(Object.keys(GUEST_FAIL_COPY).sort()).toEqual(
      ['expired', 'invalid_token', 'privacy_denied', 'revoked', 'session_ended'].sort()
    );
    expect(Object.keys(FRESHNESS_LABEL).sort()).toEqual(['live', 'offline', 'stale'].sort());
  });
});
