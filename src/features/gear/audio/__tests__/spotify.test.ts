import { describe, expect, it } from 'vitest';
import {
  audioProviderLabel,
  createSpotifyAudioPort,
  readSpotifyAvailability,
  spotifyUnavailableMessage,
} from '../spotify';

describe('Spotify — capacité réelle', () => {
  it('annonce l’absence de configuration OAuth sans fabriquer de jeton', () => {
    const availability = readSpotifyAvailability({});
    expect(availability.available).toBe(false);
    expect(availability.reason).toBe('oauth_not_configured');
    expect(availability.hasAuthorizedToken).toBe(false);
    expect(availability.canControlPlayback).toBe(false);
    expect(JSON.stringify(availability)).not.toMatch(/access_token|refresh_token|bearer/i);
  });

  it('reste indisponible avec un identifiant client mais sans compte lié', () => {
    const availability = readSpotifyAvailability({ NEXT_PUBLIC_SPOTIFY_CLIENT_ID: 'client-id' });
    expect(availability.available).toBe(false);
    expect(availability.reason).toBe('not_linked');
    expect(availability.hasAuthorizedToken).toBe(false);
  });

  it('reste indisponible avec un compte lié car aucun SDK n’est livré', () => {
    const availability = readSpotifyAvailability(
      { NEXT_PUBLIC_SPOTIFY_CLIENT_ID: 'client-id', SPOTIFY_REDIRECT_URI: 'https://exemple.fr/callback' },
      { linked: true }
    );
    expect(availability.available).toBe(false);
    expect(availability.reason).toBe('sdk_missing');
    expect(availability.hasAuthorizedToken).toBe(false);
  });

  it('ne crée aucun port de lecture', () => {
    expect(createSpotifyAudioPort()).toBeNull();
  });

  it('explique chaque état indisponible en français', () => {
    expect(spotifyUnavailableMessage('oauth_not_configured')).toMatch(/n’est pas configuré/);
    expect(spotifyUnavailableMessage('sdk_missing')).toMatch(/n’est pas installé/);
    expect(spotifyUnavailableMessage('not_linked')).toMatch(/Aucun compte Spotify/);
    expect(spotifyUnavailableMessage(null)).toMatch(/indisponible/);
  });

  it('nomme le fournisseur sans inventer de service', () => {
    expect(audioProviderLabel('spotify')).toBe('Spotify');
    expect(audioProviderLabel('none')).toBe('Aucun fournisseur');
  });
});
