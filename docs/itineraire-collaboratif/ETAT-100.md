# /compas/itineraire — état vérifié des 4 prérequis et des 100 améliorations

Écrit le 23/11/2026 à partir du code de la branche `claude/nifty-hopper-w9gui9` (HEAD `fabcc3a9f`), pas des déclarations. Plan source : « LKDV · /compas/itineraire — 100 améliorations utiles » (22/11/2026).

Règle de classement. **Fait** : code branché dans l'interface ou le serveur, avec au moins un test. **Partiel** : une partie manque, la raison est écrite. **Non fait** : rien n'atteint l'utilisateur, la raison est écrite. Un module pur non branché dans l'écran vaut Partiel, sauf quand plus rien ne l'appelle du tout (Non fait). Les tests SQL de `supabase/tests/database/` n'ont pas été rejoués ici (pas de base) ; le banc Playwright non plus.

## 1. Synthèse

| Catégorie | Fait | Partiel | Non fait |
| --- | --- | --- | --- |
| 1 Entrée et premier écran | 9 | 1 | 0 |
| 2 Carte | 7 | 3 | 0 |
| 3 Pilule et îlot | 10 | 0 | 0 |
| 4 Tiroir principal | 6 | 4 | 0 |
| 5 Tracer | 9 | 1 | 0 |
| 6 Étapes et nuits | 8 | 2 | 0 |
| 7 Analyser | 9 | 1 | 0 |
| 8 Équipe | 7 | 3 | 0 |
| 9 Départ, sac et carnet | 8 | 2 | 0 |
| 10 Interconnexion LKDV | 4 | 4 | 2 |
| **Total sur 100** | **77** | **21** | **2** |

### Les 4 prérequis

| # | Statut | Constat dans le code |
| --- | --- | --- |
| P1 Store Supabase | **Fait dans le code, jamais exécuté contre une vraie base** | `store/supabaseStore.ts` (1 169 lignes) appelle les 8 RPC de la migration (`create_route_workspace_tx`, `apply_route_operation_tx`, `publish_route_revision_tx`, `write_route_workspace_part_tx`, `set_route_member_tx`, `manage_route_share_link_tx`, `get_shared_route_workspace_tx`, `get_route_external_view_tx`). Les 14 routes `/api/routes/[id]/*` et `/api/routes/workspaces` passent par `getRouteCollabStore()` ; `history` et `import` ne touchent pas l'espace. Supabase est choisi hors Vitest quand l'URL et la clé anon existent ; repli explicite `ROUTE_COLLAB_STORE=memory`. `serverStore.ts` (fichier JSON de `os.tmpdir()`) reste le store des tests et du repli. Test : `supabaseStore.test.ts` (35 cas, client simulé). |
| P2 Migration | **Écrite, NON appliquée en production** | `20261118120000_route_collab_20_10.sql` : 11 tables, RPC et RLS ; retour arrière dans `migrations_down/` ; test RLS `route_collab_20_10_rls.test.sql`. Les trois fichiers sont **modifiés mais non commités** (3ᵉ passe de correction en cours : +581 / −294 lignes). Aucune table `route_*` n'est en base. |
| P3 Portage sur main | **Fait pour le code, pas fusionné** | La branche est posée sur le sommet de `main` (merge-base = `1b115a9d7`, 11 commits d'avance, 0 de retard) et poussée (`origin` = HEAD). Elle n'est pas dans `main`. Aucun conflit restant à ce jour. |
| P4 Rattachement | **Fait, avec trois trous** | `?trip=` lu sous RLS (`loadTripEntry.ts`) ; tracé du Compas repris (`compasDraft.ts`) ; écrivain unique `routeDraftWrite.ts` (`writeTripRouteDraft`) et synchronisation `publishedSync.ts` ; bouton d'entrée dans `ParcoursFlow` (`CompasOuFlows.tsx`) et `RouteEditor.tsx` ; le HUB lit la version publiée (`PublishedRouteCard`, `loadCockpit.ts`) ; Explorer mène à la page (`/api/itineraire/from-explorer`). Trous : sans `?trip=` la page reste un brouillon local non rattaché (1.1) ; clubs non branchés (10.5) ; l'éditeur de tracé du Compas existe toujours à côté. |

## 2. Ce qui reste avant la production (dans l'ordre)

1. Terminer la 3ᵉ passe de la migration, commiter les 3 fichiers (migration, retour arrière, test RLS).
2. Rejouer la migration sur une copie, puis le test RLS SQL, puis son retour arrière. Rien n'a été exécuté contre une base dans cette vérification.
3. Écrire un test du store Supabase contre une vraie base (aujourd'hui : client simulé seulement).
4. Ajouter `p_stage_scope_ids` à `set_route_member_tx` (8.3 renvoie 501 en mode Supabase tant que ce n'est pas fait).
5. Mettre la RLS Realtime en place avant d'ouvrir le canal Broadcast (8.8, canal public aujourd'hui).
6. Appliquer la migration en production, relancer les advisors Supabase, puis fusionner la branche dans `main`.
7. Traiter le blocage Vercel : le déploiement de production de `main` échoue déjà par manque de mémoire au build (SIGKILL, OOM). C'est une question d'offre Vercel, donc une décision de Tony (CLAUDE.md §2 point 8). Hors périmètre de cette branche.
8. Après la production : brancher les points Non fait (10.5 clubs, 10.8 profil de performance) et corriger les écarts de la section 4.

## 3. Les 100 lignes

### 1 · Entrée et premier écran

| # | Amélioration | Statut | Preuve | Reste à faire |
| --- | --- | --- | --- | --- |
| 1.1 | Rattachée à un voyage | Partiel | `entry.ts`, `loadTripEntry.ts`, `app/compas/itineraire/page.tsx` ; `entry.test.ts`, `loadTripEntry.test.ts` | Sans `?trip=` (ou sans compte) le brouillon reste local (`guestDraft`, `startPersist.ts`) : la page peut rester un espace flottant. Proposer de choisir ou créer le voyage. |
| 1.2 | Reprendre le tracé du Compas | Fait | `compasDraft.ts`, `RouteCollabPageClient.tsx` ; `compasDraft.test.ts` | |
| 1.3 | Cinq départs en tuiles | Fait | `start/StartScreen.tsx` (`Tiles`) ; `entryFlow.test.tsx` | |
| 1.4 | Phrase libre lue par le moteur du Compas | Fait | `startIntent.ts` (`understandRequest`, `parseIntentRules`) ; `startIntent.test.ts` | |
| 1.5 | Lieu confirmé avant tout tracé | Fait | `StartScreen.tsx` (`start-place-confirm`) ; `startIntent.test.ts`, `entryFlow.test.tsx` | |
| 1.6 | Sport hérité du voyage | Fait | `entry.ts` (`routeSportForActivity`), rangée repliée dans `StartScreen.tsx` ; `entry.test.ts` | |
| 1.7 | Connexion au dernier moment | Fait | `guestDraft.ts` + `compas/engine/pendingDraft.ts`, `EntryChips.tsx` ; `guestDraft.test.ts` | |
| 1.8 | Provenance dès l'import | Fait | `entry.ts` (`provenanceOf`), `map/EntryChips.tsx` ; `entry.test.ts` | |
| 1.9 | Liens profonds `?jour=` `?point=` `?troncon=` | Fait | `insights/deepLinks.ts`, `useRouteWorkspaceState.ts` (l. 507) ; `deepLinks.test.ts`, `entry.test.ts` | |
| 1.10 | Sans WebGL, la liste s'ouvre seule | Fait | `useRouteWorkspaceState.ts` (`detectWebGL`), `ListModeSurface.tsx`, `AddByAddress.tsx` ; `routeCollabUi.test.tsx` | |

### 2 · Carte

| # | Amélioration | Statut | Preuve | Reste à faire |
| --- | --- | --- | --- | --- |
| 2.1 | Une seule carte pour LKDV | Partiel | `RouteCollabMap.tsx` : `WebGLArbiter` (titulaire `route-map`) et style du Compas (`createMapStyle`) ; `routeMapInteractions.test.tsx` | Le composant `LiveMap` du Compas n'est pas repris : la page garde son propre MapLibre. |
| 2.2 | Toucher = point, appui long = menu | Fait | `mapGesture.ts`, `map/PointRoleMenu.tsx` ; `mapGesture.test.ts`, `routeMapInteractions.test.tsx` | Le test d'appui long a échoué une fois sous charge (délai d'attente), 15/15 seul : le fiabiliser. |
| 2.3 | Insertion au bon endroit | Fait | `pointInsertion.ts`, `RouteCollabMap.tsx` (`insertionThresholdM`) ; `pointInsertion.test.ts` | |
| 2.4 | Glisser la ligne, halo du chemin visé | Fait | `routePreview.ts` (Valhalla `snap=1`), `RouteCollabMap.tsx` ; `routePreview.test.ts` | |
| 2.5 | Une couleur par jour, lentilles | Partiel | `mapGeometry.ts`, `map/MapOverlays.tsx` ; `mapGeometry.test.ts` | La légende est sur la carte, pas dans la pilule de jour. |
| 2.6 | Profil et carte liés | Fait | `profileLink.ts`, `map/ProfileReadoutLine.tsx`, `AnalyserTab.tsx` ; `profileLink.test.ts` | |
| 2.7 | Calques selon le sport, source et date | Fait | `mapLayers.ts` (`describePoiProvenance`), `MapOverlays.tsx` ; `mapLayers.test.ts` | |
| 2.8 | Cadrage qui suit le tiroir | Fait | `mapFraming.ts`, `map/useSheetHeight.ts` ; `mapFraming.test.ts` | |
| 2.9 | Position en direct | Fait | `liveTrack.ts`, `map/useLivePosition.ts` ; `liveTrack.test.ts` | |
| 2.10 | Carte hors ligne | Partiel | `RouteCollabMap.tsx`, `MapOverlays.tsx` (badge « Hors ligne · vN »), `offlinePackStore.ts` ; `routeMapInteractions.test.tsx` | Le tracé vient du pack, mais le fond de carte se limite aux tuiles déjà vues : les tuiles ne sont pas empaquetées. |

### 3 · Pilule et îlot

| # | Amélioration | Statut | Preuve | Reste à faire |
| --- | --- | --- | --- | --- |
| 3.1 | Pilule qui parle | Fait | `chrome/RoutePill.tsx`, `chrome/pillModel.ts`, `insights/summary.ts` ; `chromeModels.test.ts` | |
| 3.2 | Sélecteur de jour dans la pilule | Fait | `RoutePill.tsx` (`onDay`) ; `routeCollabChrome.test.tsx` | |
| 3.3 | Îlot du Compas v5 réutilisé | Fait | `chrome/useRouteIsland.ts` (importe `compas/v5/Island`) ; `routeCollabChrome.test.tsx` | |
| 3.4 | « Annuler » sur chaque opération | Fait | `undo.ts`, `chrome/useRouteUndo.ts`, `useOpTracker.ts` ; `undo.test.ts` | |
| 3.5 | Sauvegarde dite honnêtement | Fait | `chrome/saveStatus.ts` ; `chromeModels.test.ts` | |
| 3.6 | Hors ligne et retour du réseau | Fait | `saveStatus.ts`, `chrome/useAutoReplay.ts` ; `chromeModels.test.ts` | |
| 3.7 | Voyant de qualité du tracé | Fait | `insights/summary.ts`, `RoutePill.tsx` (`onLight`) ; `summary.test.ts` | |
| 3.8 | Comptes de faits, jamais de note | Fait | `insights/summary.ts` ; `summary.test.ts` | |
| 3.9 | « Dis-le » avec aperçu | Fait | `sayCommands.ts`, `chrome/SayPanel.tsx` (monté dans `TopStack`) ; `sayCommands.test.ts`, `routeCollabChrome.test.tsx` | |
| 3.10 | Une alerte par publication | Fait | `chrome/publicationAlert.ts`, `useRouteIsland.ts` ; `publishFollowUps.test.tsx` | |

### 4 · Tiroir principal

| # | Amélioration | Statut | Preuve | Reste à faire |
| --- | --- | --- | --- | --- |
| 4.1 | Interrupteur Simple / Expert | Partiel | `workspace/expertMode.ts`, `chrome/ViewModeSwitch.tsx` ; `routeCollabChrome.test.tsx` | Le réglage est mémorisé **sur l'appareil** (`localStorage`), pas par compte, contrairement à la ligne du plan. Non annoncé comme partiel. |
| 4.2 | Primitives du Compas v5 | Partiel | `ui/*` reprend `compas/v5/ui/primitives` et `icons` | Le conteneur reste `ExplorerSheet` (`RouteCollabWorkspace.tsx`), pas `V5Sheet`. |
| 4.3 | Trois hauteurs nettes | Fait | `RouteCollabWorkspace.tsx` (`detent`) ; `routeCollabChrome.test.tsx` (« aperçu, moitié par défaut, plein ») | |
| 4.4 | Tuiles chiffrées en tête | Fait | `ui/MetricTiles.tsx`, `chrome/SheetSummary.tsx`, `ui/figures.ts` ; `figures.test.ts` | |
| 4.5 | Inconnu jamais affiché comme zéro | Partiel | `ui/figures.ts`, `SectionDrawer.tsx` ; `figures.test.ts` | Des endroits convertissent l'inconnu en 0 : `integrations.ts` (`toClubRouteRevisionSnapshot`, D+ inconnu somme 0) et plusieurs formules de `routeAnalysis.ts` (`ascentM ?? 0`). |
| 4.6 | Deux niveaux au plus | Partiel | `chrome/levels.ts`, `useRouteLevels.ts` ; `chromeModels.test.ts` | Échap ferme un niveau ; le retour du navigateur n'est pas branché (aucun `popstate`). |
| 4.7 | Une seule recette de ligne | Fait | `ui/RouteRow.tsx` utilisé dans 14 fichiers ; `routeCollabChrome.test.tsx` | |
| 4.8 | « Inviter » en solo | Fait | `tabs/index.tsx` (`mainTabs(solo)`), `EquipeTab.tsx` ; `routeCollabChrome.test.tsx` | |
| 4.9 | Bureau en trois colonnes | Fait | `chrome/layout.ts` (≥ 1 024 px), `StageColumn.tsx`, `chrome.css` ; `routeCollabChrome.test.tsx` | |
| 4.10 | Code découpé et aux jetons | Fait | `RouteCollabWorkspace.tsx` passe de 4 511 à 237 lignes (un fichier par onglet et sous-tiroir) ; 0 couleur littérale dans les 6 CSS de la page | |

### 5 · Tracer

| # | Amélioration | Statut | Preuve | Reste à faire |
| --- | --- | --- | --- | --- |
| 5.1 | Profil de routage par sport | Fait | `routingProfiles.ts`, `track/ProfilePicker.tsx` (préférence de surface en expert) ; `variantsAndRouting.test.ts` | |
| 5.2 | Forme en un geste, inverser | Fait | `track/ShapeTools.tsx`, `engineTrack.ts` ; `trackOperations.test.ts` | |
| 5.3 | Supprimer un point recoud le tracé | Fait | `track/PointList.tsx`, `useTrackTools.ts` ; `trackOperations.test.ts` | |
| 5.4 | Tronçon à la main « non vérifié » | Fait | `track/SectionTools.tsx` (« Revenir au calcul ») ; `trackStagesUi.test.tsx` | |
| 5.5 | Recalcul jamais écrasé | Fait | `engine.ts` (`computeRoutingFingerprint`), `useTrackTools.ts` ; `variantsAndRouting.test.ts` | |
| 5.6 | Points modifiables depuis la liste | Fait | `pointEdit.ts`, `track/PointEditor.tsx` ; `pointEdit.test.ts` | |
| 5.7 | Couper ou fusionner un tronçon | Fait | `SectionTools.tsx` (`split-middle`, `merge-prev`) ; `trackOperations.test.ts` | |
| 5.8 | Variantes côte à côte | Fait | `variantCompare.ts`, `track/VariantsPanel.tsx` ; `variantsAndRouting.test.ts` | |
| 5.9 | Formats et GPX validé | Partiel | `insights/formats.ts` : GPX, KML, TCX, GeoJSON ; export complet ou par étape (`?stageId=`), `validateGpx11` ; `trackIo.test.ts`, `trackOperations.test.ts` | FIT refusé avec un message (`unsupported_format`), alors que la ligne le demande. |
| 5.10 | Historique lisible | Fait | `versionTimeline.ts`, `track/VersionTimeline.tsx` ; `versionTimeline.test.ts` | |

### 6 · Étapes et nuits

| # | Amélioration | Statut | Preuve | Reste à faire |
| --- | --- | --- | --- | --- |
| 6.1 | Découpage proposé et expliqué | Fait | `insights/stageSplit.ts`, `stages/SplitAssistant.tsx` (seuils modifiables) ; `stageSplit.test.ts` | |
| 6.2 | Déplacer une coupure en glissant | Fait | `profileCuts.ts`, `stages/ProfileCuts.tsx` (glisser sur le profil) ; `trackStagesUi.test.tsx` | Pas de glisser de la coupure sur la carte (le profil suffit à la ligne). |
| 6.3 | Nuits réelles uniquement | Fait | `nights.ts` (`rankStayOptions`), `stages/NightPicker.tsx` (prix « repère du barème ») ; `dayReading.test.ts`, `placesClient.test.ts` | |
| 6.4 | Allure du groupe | Partiel | `dayReading.ts`, `insights/pace.ts`, `stages/PaceSetting.tsx` ; `paceProfile.test.ts`, `pace.test.ts` | `RoutePaceProvider` n'est monté nulle part : aucune allure de membre n'arrive depuis `crewPace` ; seule la saisie à la main du plus lent (appareil) ou l'allure standard. |
| 6.5 | Heure de départ, coucher du soleil | Fait | `stages/DayParts.tsx`, `insights/daylight.ts` ; `daylight.test.ts` | |
| 6.6 | Eau et ravitaillement par jour | Fait | `insights/water.ts`, `DayParts.tsx` ; `water.test.ts` | |
| 6.7 | Jour de repos, étape courte | Fait | `stages/DayTools.tsx`, `insert_rest_day` ; `trackStagesUi.test.tsx` | |
| 6.8 | Dates et fuseau locaux | Fait | `dayReading.ts`, `insights/daylight.ts` ; `dayReading.test.ts` (changement d'heure) | |
| 6.9 | Même tiroir « Jour » que le Compas v5 | Partiel | `stages/DayCard.tsx`, `DayView.tsx` reprennent `Li`, `MBtn`, `V5Icon` | `compas/v5/drawers/day.tsx` n'est pas repris : même recette de ligne, pas le même tiroir. |
| 6.10 | Repli prévu | Fait | `insights/bailout.ts`, `DayParts.tsx` ; `bailout.test.ts` | |

### 7 · Analyser

| # | Amélioration | Statut | Preuve | Reste à faire |
| --- | --- | --- | --- | --- |
| 7.1 | Moteur d'effort branché | Fait | `analyse/effort.ts` (`computeEffortScore`, `predictRoute`, `buildGroupPlan`) ; `analysis.test.ts` | Les allures des membres ne sont pas fournies (voir 6.4) : la prédiction de groupe tourne à l'allure standard, dite à l'écran. |
| 7.2 | Difficulté expliquée | Fait | `analyse/difficulty.ts` (`routes/analysis/difficulty`), « Pourquoi ? » ; `analysis.test.ts` | |
| 7.3 | Profil interactif | Fait | `analyse/segments.ts`, `RouteAnalysisVisuals.tsx`, `ProfileReadoutLine` ; `analyserTab.test.tsx` | |
| 7.4 | Météo par lieu et créneau | Fait | `/api/itineraire/analyse`, `analyse/passageWeather.ts` ; `analyserTab.test.tsx` | |
| 7.5 | Eau en trois niveaux | Fait | `insights/water.ts`, `AnalyseBlocks.tsx` ; `water.test.ts` | |
| 7.6 | Alertes officielles datées | Partiel | `analyse/alerts.ts`, route d'analyse (Meteoalarm via `getOfficialAlerts`, feux `fire.ts`) ; `analysis.test.ts` | Aucune source hors Europe ; FIRMS sans clé : feux indisponibles. |
| 7.7 | Surfaces en pourcentage | Fait | `insights/surfaces.ts`, `AnalyseBlocks.tsx` ; `surfaces.test.ts` | |
| 7.8 | Lumière du jour | Fait | `insights/daylight.ts`, `AnalyseBlocks.tsx` ; `daylight.test.ts` | |
| 7.9 | Source et fraîcheur partout | Fait | `analyse/provenance.ts`, `Sourced.tsx` (`data-source`, `data-source-at`) ; `analyserTab.test.tsx` | |
| 7.10 | Synthèse en trois lignes | Fait | `insights/summary.ts`, `AnalyseBlocks.tsx` ; `analyserTab.test.tsx` | |

### 8 · Équipe

| # | Amélioration | Statut | Preuve | Reste à faire |
| --- | --- | --- | --- | --- |
| 8.1 | Invitations du voyage réutilisées | Fait | Migration (lecture de `trip_collaborators` dans les droits), `set_route_member_tx`, `team.ts` ; `teamModel.test.ts`, `teamStore.test.ts` | |
| 8.2 | Trois droits en vue simple | Fait | `team.ts`, `tabs/EquipeTab.tsx` ; `teamUi.test.tsx` | |
| 8.3 | Une étape confiée | Partiel | `team.ts`, `RoutePill.tsx` (avatar), `EquipeTab.tsx` ; `teamStore.test.ts` | Mode Supabase : renvoie 501 (`supabaseStore.ts` l. 1045), car `set_route_member_tx` n'a pas `p_stage_scope_ids`. Marche en mode mémoire seulement. |
| 8.4 | Présence légère | Fait | `team.ts` (`presenceByStage`), `RoutePill.tsx` ; `teamModel.test.ts` | |
| 8.5 | Conflit compréhensible | Fait | `workspace/Banners.tsx`, `team.ts` ; `teamUi.test.tsx` | |
| 8.6 | Propositions avant / après | Fait | `subdrawers/ProposalsDrawer.tsx`, `supabaseStore.ts` (`createWorkspaceProposal`, vote, décision) ; `teamUi.test.tsx` | |
| 8.7 | Commentaires attachés au terrain | Fait | `ProposalsDrawer.tsx` (`relocate-*`), `/api/routes/[id]/comments/[commentId]/relocate` ; `teamStore.test.ts` | |
| 8.8 | Temps réel par Broadcast | Partiel | `realtime.ts`, `useRouteRealtime.ts` (jamais `postgres_changes`) ; `realtime.test.ts` | Canal public tant que la RLS Realtime n'est pas en place. |
| 8.9 | Lien de lecture révocable | Fait | `subdrawers/SharingDrawer.tsx`, `manage_route_share_link_tx`, `shareSanitize.ts` (zone de départ masquée), 48 h par défaut ; `shareSanitize.test.ts` | |
| 8.10 | Partager une étape dans la messagerie | Partiel | `messageLink.ts`, `messaging/components/TrailCard.tsx` (carte cliquable à la réception) | Pas de bouton d'envoi depuis la page. |

### 9 · Départ, sac et carnet

| # | Amélioration | Statut | Preuve | Reste à faire |
| --- | --- | --- | --- | --- |
| 9.1 | Le vrai sac | Fait | `depart/tripKit.ts` (`trip_items`), `subdrawers/KitDrawer.tsx` ; `depart.test.ts` | |
| 9.2 | Seuls les objets touchés à revérifier | Fait | `tripKit.ts` (`dependsOn`), `KitDrawer.tsx` ; `depart.test.ts` | |
| 9.3 | Matériel commun réparti | Fait | `insights/sharedGear.ts`, `KitDrawer.tsx` ; `sharedGear.test.ts` | |
| 9.4 | Publier avec résumé des changements | Fait | `insights/changeSummary.ts`, `depart/publishSummary.ts`, `DepartTab.tsx` ; `changeSummary.test.ts`, `departTab.test.tsx` | |
| 9.5 | État de chaque participant | Fait | `depart/participants.ts`, `markParticipantPackState` ; `depart.test.ts` | |
| 9.6 | Pack hors ligne fiable | Fait | `depart/packInfo.ts`, `offlinePackStore.ts` ; `depart.test.ts` | |
| 9.7 | Une seule liste de départ | Fait | `DepartBlocks.tsx` (lit et coche la liste du HUB, lien `/hub/checklist`), `departClient.ts` ; `departTab.test.tsx` | |
| 9.8 | Démarrer l'activité depuis la version | Partiel | `depart/activityHandoff.ts`, `HikeSessionService.ts`, `app/api/hike-sessions/routeLink.ts` ; `saveSessionRouteLink.test.ts` | Les colonnes `route_workspace_id`, `route_revision_id`, `kit_snapshot` viennent de la migration non appliquée (repli sans elles). L'écran du cockpit n'est pas modifié. |
| 9.9 | Carnet plan contre réel | Fait | `depart/carnetCompare.ts`, `depart/PlanVsActual.tsx` (monté dans `OfflineCarnetDrawer`) ; `departTab.test.tsx` | |
| 9.10 | « Reprendre cette sortie » | Partiel | `PlanVsActual.tsx`, `OfflineCarnetDrawer.tsx` (`handleDuplicateFromCarnet`) ; `departTab.test.tsx` | Le brouillon repris reste local. Le bouton « Reprendre le tracé » de `CarnetDrawerV2.tsx` envoie toujours vers `/compas?nouvelle=1`, pas vers cette page. |

### 10 · Interconnexion avec LKDV

| # | Amélioration | Statut | Preuve | Reste à faire |
| --- | --- | --- | --- | --- |
| 10.1 | Un seul tracé par voyage | Fait | `compas/server/routeDraftWrite.ts` (écrivain unique), `publishedSync.ts`, `getCompasData.ts` ; `publishedSync.test.ts`, `compasDraft.test.ts` | L'éditeur du Compas reste, la version publiée gagne. |
| 10.2 | Entrée depuis le Compas | Partiel | `CompasOuFlows.tsx` (`compas-open-itinerary`), `RouteEditor.tsx` | Bouton branché mais aucun test ne l'exerce. Entrée dans l'écran hérité, pas dans un tiroir v5. |
| 10.3 | Le HUB lit la version publiée | Fait | `hub/components/itinerary/PublishedRouteCard.tsx`, `app/hub/[section]/page.tsx`, `hub/cockpit/loadCockpit.ts`, `integrations.ts` ; `cockpit-complete-domain.test.ts`, `integrationsAndFeatures.test.ts` | |
| 10.4 | Explorer mène ici | Fait | `explorer-v2/server/prepareWithTrack.ts`, `/api/itineraire/from-explorer`, `SheetContent.tsx` ; `prepareWithTrack.test.ts` | |
| 10.5 | Clubs | Non fait | `server/clubRoute.ts`, `integrations.ts` (`clubRouteFromPublished`) ; `clubsBridge.test.ts` | `clubRoute.ts` n'est appelé par rien. La RPC `publish_club_event_route` n'accepte qu'un `route_id` du catalogue : une RPC dédiée (migration) manque. |
| 10.6 | Budget | Partiel | `server/budgetSync.ts`, `/api/itineraire/budget-sync` (appelé à la publication) ; `budgetSync.test.ts` | Seules les nuits au barème alimentent `trip_expenses` ; ni transports ni achats. |
| 10.7 | Météo et Vérifs partagées | Fait | `server/sharedChecks.ts` (mêmes `getCompasWeather`, `getOfficialAlerts`, `assessDanger`), route d'analyse ; `sharedChecksModel.test.ts` | |
| 10.8 | Page Compte, profil de performance | Non fait | `server/paceProfile.ts`, `paceProfile.ts` ; `paceProfile.test.ts` | `server/paceProfile.ts` n'est importé nulle part et `RoutePaceProvider` n'est jamais monté : le profil n'est ni lu ni recalculé. Aucun effet pour l'utilisateur. |
| 10.9 | Communauté et carnets | Partiel | `communityShare.ts`, `server/shareToCommunity.ts`, `/api/itineraire/share-community` ; `communityShare.test.ts` | API seule : aucun bouton ne l'appelle ; post seulement (ni story ni carnet). |
| 10.10 | System Admin | Partiel | `moderationModel.ts`, `server/adminModeration.ts`, `/api/admin/moderation`, section de `app/admin/page.tsx` ; `moderationModel.test.ts` | Commentaires et liens partagés exigent la migration proposée (`MIGRATION-PROPOSEE-ADMIN.sql`), non appliquée. Les décisions de modération ne sont donc pas appliquées. |

## 4. Écarts entre les déclarations et le code

- **4.1** : déclaré mémorisé « par compte » dans le plan ; le code mémorise sur l'appareil. Absent de la liste des partiels annoncés.
- **1.1** : non annoncé comme partiel ; la page s'ouvre sans voyage et garde un brouillon local.
- **6.4, 7.1, 10.8** : plus grave que « profil jamais recalculé en production » : `server/paceProfile.ts` n'est appelé par aucun fichier et `RoutePaceProvider` n'est monté nulle part. 10.8 passe donc de Partiel (annoncé) à Non fait.
- **10.5** : annoncé « migration nécessaire » ; en plus, le pont serveur n'est appelé par aucune route ni écran. Non fait.
- **5.9** : FIT absent (refusé volontairement). **6.9** : `drawers/day.tsx` non repris. **2.10** : tuiles non empaquetées. **10.9** : aucun bouton. **10.2** : aucun test. **4.5** : les conversions en 0 sont confirmées dans `integrations.ts` et `routeAnalysis.ts`. Aucun de ces points n'était annoncé tel quel.
- **9.8** : le service `HikeSessionService.ts` est bien modifié (seul l'écran du cockpit ne l'est pas).
- **P3** : la branche n'a plus de retard sur `main` ; elle est poussée mais non fusionnée.
- **P2** : la migration et ses deux fichiers associés sont modifiés et non commités dans l'arbre de travail.
- Confirmés conformes aux déclarations : 2.1, 2.5, 4.2, 4.6, 7.6, 8.3 (501, `p_stage_scope_ids` absent de la migration), 8.8, 8.10, 9.10, 10.6, 10.10.

## 5. Contrôles de la branche (lancés le 23/11/2026)

- `npx tsc --noEmit -p . 2>&1 | grep -c "error TS"` : **19** erreurs, toutes préexistantes (`components/carnet/v2` ×6, `components/clubs/drawer` ×4, `KitProductSheetV2` ×2, `HubCockpit` ×7). Aucune dans `route-collab`.
- `npx vitest run src/features/route-collab src/app/api src/features/compas src/features/hub src/features/explorer-v2 src/features/hiking` : **399 fichiers, 6 341 tests ; 396 fichiers et 6 338 tests passent, 3 échecs**.
  - `compas/__tests__/overpassEndpoints.test.ts` : préexistant sur `main`.
  - `explorer-v2/__tests__/n01-n02-wiring.test.tsx` : préexistant sur `main`.
  - `route-collab/__tests__/routeMapInteractions.test.tsx` (2.2, menu d'appui long) : échec de délai sous charge ; relancé seul, **15/15** passent, deux fois. Instable, à fiabiliser.
- Non rejoués : tests SQL RLS, Playwright (`tests/e2e/route-collab-20-10.spec.ts`), `npm run lint`, `next build`.
