# Interconnexion de /compas/itineraire avec LKDV (P4 et catégorie 10) — état du 23/11/2026

## Règle de vérité : un seul tracé par voyage (P4, 10.1)
- Un espace d'itinéraire PUBLIÉ pour un voyage gagne. `trips.metadata.compas.routeDraft` n'en est alors qu'une copie dérivée
  (`engine = lkdv-route-collab/published`), reprise par `planRouteDraftSync` (`route-collab/publishedSync.ts`, pur, testé).
- Sans espace publié, le `routeDraft` du Compas reste la source ; la lecture inverse est `compasDraft.ts`.
- Jamais de perte silencieuse : un tracé enregistré dans l'éditeur du Compas APRÈS la publication n'est pas écrasé
  (`editor_newer`) ; la prochaine publication reprend la main. Idempotent (même version = aucune réécriture).
- Un seul écrivain : `writeTripRouteDraft` (`compas/server/routeDraftWrite.ts`), appelé par `compasSaveRouteDraftAction`
  (éditeur), par `getCompasData` (reprise à l'ouverture du Compas) et par `POST /api/itineraire/sync-draft` (à appeler
  après une publication ; droit d'édition du voyage exigé).
- L'éditeur du Compas propose « Ouvrir dans l'itinéraire » (`CompasOuFlows.tsx`, `RouteEditor.tsx`).

## Ponts serveur (tous sous RLS, zod, `force-dynamic`)
| Point | Fonction / route | Remarques |
|---|---|---|
| 10.3 HUB | `getPublishedRouteSummaryForTrip` ; `PublishedRouteCard` (`/hub/itineraire`) ; `CockpitData.publishedRoute` | lecture de la version PUBLIÉE, jamais du brouillon |
| 10.4 Explorer | `POST /api/itineraire/from-explorer` ; `explorer-v2/server/prepareWithTrack.ts` | tracé relu côté serveur, brouillon par `compasCreateTripAction` si besoin, provenance `explorer_route` ; une version publiée existante n'est pas remplacée |
| 10.5 Clubs | `clubRouteFromPublished`, `rsvpGrantsRouteEdit` (`integrations.ts`) ; `server/clubRoute.ts` | voir écart ci-dessous |
| 10.6 Budget | `POST /api/itineraire/budget-sync` ; `budgetSync.ts` | lignes « prévues » des seules nuits qui ont un repère de prix ; clé stable, idempotent, lignes retouchées jamais écrasées ; transports et achats : rien de chiffré dans l'espace, rien écrit |
| 10.7 Vérifs | `server/sharedChecks.ts` (`getSharedChecks`) | mêmes sources que les tiroirs Météo/Vérifs du Compas v5 : `getCompasWeather`, `getOfficialAlerts`, `assessDanger`. À brancher dans l'onglet Analyser (autre périmètre) en lui passant les jours lus sous RLS |
| 10.8 Allure | `server/paceProfile.ts` (`getPaceProfileForUser`) | lit `user_performance_profiles` (propriétaire seulement) ; profil à froid ou vide = `null` |
| 10.9 Communauté | `POST /api/itineraire/share-community` ; `communityShare.ts` | version publiée assainie par `shareSanitize.ts` (zone de départ masquée), ligne décimée à 150 points, RPC `create_community_post` ; propriétaire de l'espace seulement |
| 10.10 Admin | `GET/POST /api/admin/moderation` ; `server/adminModeration.ts` ; section Modération et Audit de `app/admin/page.tsx` | `is_moderateur()` ; file `moderation_queue` + journal `admin_audit_log` |

## Écarts connus (à ne pas masquer)
- 10.5 : la RPC `publish_club_event_route` n'accepte qu'un `route_id` du catalogue (`hiking_routes`). Reprendre la version
  publiée d'un espace dans une sortie demande une RPC dédiée (migration, hors périmètre). L'instantané Clubs est prêt et testé ;
  s'inscrire (RSVP) n'a aucun droit d'édition (`rsvpGrantsRouteEdit() === false`).
- 10.8 : `user_performance_profiles` est lu, mais rien en production n'appelle `buildUserProfile` (aucun adaptateur Supabase du
  `ProfileBuildClient`) : les sorties terminées produisent des observations (cron `process-hike-sessions`, avec consentement) sans
  recalcul du profil. Le profil reste donc « à froid » tant que ce déclencheur n'existe pas (chantier adventure-intelligence).
- 10.10 : les commentaires (`route_comments`) et les liens partagés (`route_workspaces`) ne sont lisibles que par les membres (RLS) ;
  la fonction `admin_list_route_moderation` est PROPOSÉE dans `MIGRATION-PROPOSEE-ADMIN.sql` (non appliquée). Sans elle, ces deux
  sources sont déclarées « non disponibles ». Une décision est consignée (file + journal) mais ne masque/supprime/révoque pas
  encore le contenu (`enforced: false`).
- Les appels `sync-draft` et `budget-sync` après publication sont à câbler dans les composants de l'atelier (hors de ce périmètre).
