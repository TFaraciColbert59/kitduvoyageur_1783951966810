import { describe, expect, it } from 'vitest';
import {
  canTrack,
  isPermissionDecided,
  permissionFromGeolocationError,
  LOCATION_PURPOSE,
  PERMISSION_LABELS,
  type LocationPermission,
} from '../engine/location';

const ALL: readonly LocationPermission[] = ['inconnue', 'accordee', 'refusee', 'indisponible'];

describe('location — usage et autorisation (A11)', () => {
  it('LOC-01: chaque etat a un libelle lisible', () => {
    for (const state of ALL) {
      expect(PERMISSION_LABELS[state].length).toBeGreaterThan(0);
    }
  });

  it('LOC-02: seul « accordee » autorise l’enregistrement d’une trace', () => {
    expect(canTrack('accordee')).toBe(true);
    expect(canTrack('inconnue')).toBe(false);
    expect(canTrack('refusee')).toBe(false);
    expect(canTrack('indisponible')).toBe(false);
  });

  it('LOC-03: un refus ou une panne ne bloquent JAMAIS le départ', () => {
    // Le refus est un etat affiche, pas un blocage : on peut partir sans trace.
    expect(canTrack('refusee')).toBe(false);
    expect(canTrack('indisponible')).toBe(false);
  });

  it('LOC-04: l’usage est expliqué AVANT la demande, en clair', () => {
    expect(LOCATION_PURPOSE).toMatch(/trace/i);
    expect(LOCATION_PURPOSE).toMatch(/arrêter|arrêter le suivi/i);
    expect(LOCATION_PURPOSE).toMatch(/rien n’est envoyé|partage/i);
  });

  it('LOC-05: l’usage ne promet aucun partage', () => {
    expect(LOCATION_PURPOSE).not.toMatch(/partagé avec|communiqué à|tiers/i);
  });

  it('LOC-06: un refus explicite est distingué d’une panne de GPS', () => {
    // 1 = PERMISSION_DENIED. 2/3 = signal indisponible ou délai dépassé :
    // ce n'est pas l'utilisateur qui a dit non, on ne l'affiche pas ainsi.
    expect(permissionFromGeolocationError(1)).toBe('refusee');
    expect(permissionFromGeolocationError(2)).toBe('inconnue');
    expect(permissionFromGeolocationError(3)).toBe('inconnue');
    expect(permissionFromGeolocationError(null)).toBe('indisponible');
  });

  it('LOC-07: seule une decision de l’utilisateur est « décidée »', () => {
    expect(isPermissionDecided('accordee')).toBe(true);
    expect(isPermissionDecided('refusee')).toBe(true);
    expect(isPermissionDecided('inconnue')).toBe(false);
    expect(isPermissionDecided('indisponible')).toBe(false);
  });
});
