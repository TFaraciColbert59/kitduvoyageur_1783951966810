/**
 * G01 — point d'entrée des contrats et politiques sportives.
 *
 * Les adaptateurs réseau restent explicites :
 * - `feedServer.ts` pour la lecture serveur (S5.01) ;
 * - `activityShareService.ts` pour publier/retirer un partage (K5.20).
 * Ils ne sont pas réexportés ici afin qu'un composant client n'embarque pas
 * accidentellement le client Supabase serveur.
 */

export * from './contracts';
export * from './visibilityPolicy';
export * from './sportStats';
export * from './activityShare';
export * from './activityProjection';
export * from './sportProfile';
export * from './feedPreferences';
export * from './videoPlayback';
export * from './useFeedPreferences';
export * from './useVideoPlayback';
