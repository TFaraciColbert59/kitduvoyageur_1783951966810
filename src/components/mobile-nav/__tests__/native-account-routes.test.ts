import { describe, expect, it } from 'vitest';
import { getNativeGlassDestination } from '../nativeAccountRoutes';

describe('iOS native Liquid Glass — Community + Account route ownership', () => {
  it.each([
    '/communaute', '/communaute/abc', '/communaute/abc/commentaires',
    '/communaute-pro', '/communaute-pro/equipe',
    '/clubs', '/clubs/club-id', '/carnets', '/carnets/123', '/carnets/nouveau',
    '/entraide', '/entraide/reponse', '/createurs', '/experts',
    '/evenements', '/evenements/evenement', '/feed',
  ])('highlights Communauté at %s', (path) => {
    expect(getNativeGlassDestination(path)).toBe('community');
  });

  it.each([
    '/compte', '/compte/parametres', '/compte/abonnements', '/compte/commandes',
    '/profil', '/profil/123', '/progression', '/progression/mes-points',
  ])('highlights Compte at %s', (path) => {
    expect(getNativeGlassDestination(path)).toBe('me');
  });

  it.each([
    '/hub', '/groupes', '/voyages', '/explorer', '/messagerie', '/prepare',
    '/connexion', '/connexion/mot-de-passe', '/inscription', '/checkout',
    '/checkout/resultat', '/communaute/publier', '/communaute/publier/photos',
    '/nouveau-groupe', '/communautes', '/compte-fake', '/', null,
  ])('retains web/no-tab presentation at %s', (path) => {
    expect(getNativeGlassDestination(path)).toBeNull();
  });
});
