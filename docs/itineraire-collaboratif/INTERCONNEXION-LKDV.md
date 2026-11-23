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
| 10.5 Clubs | RPC `publish_club_event_route_from_workspace` ; `server/clubRoute.ts` ; `POST/GET /api/itineraire/club-route` ; `depart/ClubRouteBlock.tsx` | migration 20261123130000 (à appliquer) ; organisateur de la sortie ET propriétaire / co-organisateur délégué de l'espace ; version publiée seule, départ privé masqué si la sortie n'est ni `club_only` ni `private` ; idempotent ; s'inscrire (RSVP) n'a aucun droit d'édition |
| 10.6 Budget | `POST /api/itineraire/budget-sync` ; `budgetSync.ts` | lignes « prévues » : nuits au barème, transports saisis par journée (aller / retour, type, montant) et achats prévus du sac ; montant SAISI seulement (« à estimer » n'écrit rien) ; clé stable, idempotent, lignes retouchées jamais écrasées |
| 10.7 Vérifs | `server/sharedChecks.ts` (`getSharedChecks`) | mêmes sources que les tiroirs Météo/Vérifs du Compas v5 : `getCompasWeather`, `getOfficialAlerts`, `assessDanger`. À brancher dans l'onglet Analyser (autre périmètre) en lui passant les jours lus sous RLS |
| 10.8 Allure | `server/paceProfile.ts` (lecture) ; `adventure-intelligence/server/recomputeProfileAfterSession.ts` (recalcul, cron `process-hike-sessions`) | lit `user_performance_profiles` (propriétaire seulement) ; recalculé après chaque session traitée, avec consentement, idempotent et borné ; profil à froid ou vide = `null` |
| 10.9 Communauté | `POST /api/itineraire/share-community` ; `communityShare.ts` | version publiée assainie par `shareSanitize.ts` (zone de départ masquée), ligne décimée à 150 points, RPC `create_community_post` ; propriétaire de l'espace seulement |
| 10.10 Admin | `GET/POST /api/admin/moderation` ; `server/adminModeration.ts` ; RPC `admin_list_route_moderation` et `admin_apply_route_moderation` ; section Modération et Audit de `app/admin/page.tsx` | `is_moderateur()` ; un rejet est APPLIQUÉ (commentaire masqué ou supprimé, lien révoqué, trace retirée) et journalisé dans `admin_audit_log` (`enforced: true`) ; migration 20261123130000 (à appliquer) |

## Écarts connus (à ne pas masquer)
- Migration `20261123130000_route_collab_followups.sql` : écrite et validée sur PostgreSQL local, PAS encore appliquée en production.
  Tant qu'elle ne l'est pas : préférences par compte (4.1) gardées sur l'appareil, proposition à un club (10.5) refusée,
  commentaires et liens de la modération (10.10) « indisponibles ».
- 10.5 : `app/sorties/[id]/page.tsx` et `trip_club_route_updates` filtrent encore `canonical_revision_id IS NOT NULL` ; ils ne lisent pas
  `club_event_route_revisions.trace` (périmètre Clubs). La RPC d'adoption et la lecture du tracé (`get_club_event_route_trace`) l'acceptent déjà.
- 10.10 : « masquer » remplace le texte du commentaire (non réversible) ; la table `route_comments` n'est pas alimentée (les commentaires
  vivent dans `route_workspaces.state_snapshot`).
- Les appels `sync-draft` et `budget-sync` après publication sont à câbler dans les composants de l'atelier (hors de ce périmètre).
