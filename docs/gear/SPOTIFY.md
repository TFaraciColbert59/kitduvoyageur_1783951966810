# D04 · S6.08 — Spotify pendant l'enregistrement

Statut au 2026-11-11 : **fonction indisponible, assumée et affichée**. Aucun
jeton Spotify n'est créé, aucun SDK n'est installé, aucune lecture n'est
simulée.

## Ce qui est livré

- `src/features/gear/audio/spotify.ts` : contrat de capacité
  (`readSpotifyAvailability`, `AudioControlPort`) et messages d'état.
- `src/features/gear/audio/ActivityAudioControl.tsx` : bouton `⋯` dans la
  pilule d'activité, sous-drawer « Audio de la sortie », fermeture par Échap
  ou bouton, focus rendu au déclencheur.
- `src/features/gear/audio/__tests__/` : vérifie l'absence de jeton, l'absence
  d'adaptateur et le rendu indisponible.

## Pourquoi c'est indisponible

| Élément requis | État dans le dépôt |
|---|---|
| Identifiant client Spotify public | Absent (`NEXT_PUBLIC_SPOTIFY_CLIENT_ID` non défini) |
| Route OAuth de retour + stockage serveur du refresh token | Absente |
| SDK / API de lecture (Web Playback SDK ou API Web) | Absent, aucune dépendance `spotify` |
| Compte Spotify Premium relié | Inconnu, aucun lien de compte |

`readSpotifyAvailability` renvoie donc :

- `oauth_not_configured` sans identifiant client ;
- `not_linked` avec identifiant mais sans compte lié ;
- `sdk_missing` avec compte lié, car `createSpotifyAudioPort()` renvoie
  toujours `null` dans ce lot.

L'interface affiche le message correspondant et laisse les commandes de
lecture désactivées. Le texte précise que l'enregistrement GPS et la trace
continuent : le panneau ne touche pas à la séance.

## Conditions pour activer la fonction

1. Fournir un identifiant client public et une route de retour OAuth.
2. Stocker le refresh token côté serveur, chiffré, jamais dans le client.
3. Implémenter `AudioControlPort` avec le Web Playback SDK ou l'API Web, en
   respectant les scopes Spotify et l'abonnement Premium.
4. Ajouter un test d'intégration sur appareil réel ; une capture navigateur ne
   prouve pas un service natif en arrière-plan.
5. Vérifier que la lecture n'interrompt ni le GPS ni la remontée des points.

Tant que ces conditions ne sont pas réunies, la fonction reste déclarée
indisponible. Aucun fallback ne fabrique un faux état de lecture.

## Notes d'intégration

- Le bouton est monté dans `ActivityPill` (`src/features/explorer-v2/chrome/BottomBar.tsx`).
  `ExplorerV2.tsx` et `SheetContent.tsx` ne sont pas modifiés.
- Aucun appel réseau n'est effectué à l'ouverture du panneau.
- `process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID` est la seule variable lue côté
  client ; elle n'est pas ajoutée à `.env.example` (fichier protégé).
