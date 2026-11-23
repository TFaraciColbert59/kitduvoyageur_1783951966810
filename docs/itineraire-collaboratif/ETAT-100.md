# /compas/itineraire — état vérifié des 4 prérequis et des 100 améliorations

Écrit le 23/11/2026 à partir du code de la branche `claude/nifty-hopper-w9gui9` (HEAD `fabcc3a9f`), pas des déclarations. Mis à jour le 23/11/2026 (second passage, sans migration) : 4.5, 6.4, 6.9, 10.2 passent à Fait, 10.8 de Non fait à Partiel ; 4.1, 10.9 restent Partiel avec leur reste à faire réécrit. Mis à jour le 23/11/2026 (suites, migration `20261123130000_route_collab_followups.sql` écrite, validée sur PostgreSQL local, à appliquer) : 4.1, 7.6, 10.5, 10.6, 10.8, 10.10 passent à Fait. Plan source : « LKDV · /compas/itineraire — 100 améliorations utiles » (22/11/2026).

Règle de classement. **Fait** : code branché dans l'interface ou le serveur, avec au moins un test. **Partiel** : une partie manque, la raison est écrite. **Non fait** : rien n'atteint l'utilisateur, la raison est écrite. Un module pur non branché dans l'écran vaut Partiel, sauf quand plus rien ne l'appelle du tout (Non fait). Les tests SQL de `supabase/tests/database/` n'ont pas été rejoués ici (pas de base) ; le banc Playwright non plus.

## 1. Synthèse

| Catégorie | Fait | Partiel | Non fait |
| --- | --- | --- | --- |
| 1 Entrée et premier écran | 9 | 1 | 0 |
| 2 Carte | 7 | 3 | 0 |
| 3 Pilule et îlot | 10 | 0 | 0 |
| 4 Tiroir principal | 8 | 2 | 0 |
| 5 Tracer | 9 | 1 | 0 |
| 6 Étapes et nuits | 10 | 0 | 0 |
| 7 Analyser | 10 | 0 | 0 |
| 8 Équipe | 7 | 3 | 0 |
| 9 Départ, sac et carnet | 8 | 2 | 0 |
| 10 Interconnexion LKDV | 9 | 1 | 0 |
| **Total sur 100** | **87** | **13** | **0** |

### Les 4 prérequis

| # | Statut | Constat dans le code |
| --- | --- | --- |
| P1 Store Supabase | **Fait dans le code, jamais exécuté contre une vraie base** | `store/supabaseStore.ts` (1 169 lignes) appelle les 8 RPC de la migration (`create_route_workspace_tx`, `apply_route_operation_tx`, `publish_route_revision_tx`, `write_route_workspace_part_tx`, `set_route_member_tx`, `manage_route_share_link_tx`, `get_shared_route_workspace_tx`, `get_route_external_view_tx`). Les 14 routes `/api/routes/[id]/*` et `/api/routes/workspaces` passent par `getRouteCollabStore()` ; `history` et `import` ne touchent pas l'espace. Supabase est choisi hors Vitest quand l'URL et la clé anon existent ; repli explicite `ROUTE_COLLAB_STORE=memory`. `serverStore.ts` (fichier JSON de `os.tmpdir()`) reste le store des tests et du repli. Test : `supabaseStore.test.ts` (35 cas, client simulé). |
| P2 Migration | **Appliquée en production le 23/11/2026** (éditeur SQL, md5 du fichier 0cc297dc778c572165f1c57571914919) | `20261118120000_route_collab_20_10.sql` : 11 tables, toutes en RLS ; seule `get_shared_route_workspace_tx` est exécutable par anon ; toutes les fonctions SECURITY DEFINER ont un search_path ; colonnes ajoutées à `hike_sessions` et `carnets` ; vue `hike_sessions_participant` étendue (34 colonnes, données intactes : 142 sorties, 93 carnets, 65 voyages) ; policies `route_realtime_read`/`route_realtime_write` sur `realtime.messages`. Retour arrière : `migrations_down/`. Test RLS : 191 assertions (Postgres local). Conseillers : aucun avis nouveau inattendu. Exécutée hors CLI : non inscrite dans `supabase_migrations.schema_migrations`. |
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
8. Après la production : brancher le point Non fait (10.5 clubs), et corriger les écarts restants de la section 4. Hors page, chantier `adventure-intelligence` : recalculer le profil de performance après chaque sortie (10.8).

## 3. Les 100 lignes

### 1 · Entrée et premier écran

| # | Amélioration | Statut | Preuve | Reste à faire |
| --- | --- | --- | --- | --- |
| 1.1 | Rattachée à un voyage | Fait | `entry.ts`, `attach.ts`, `server/loadTripEntry.ts`, `server/listAttachableTrips.ts` (voyages modifiables lus sous RLS : propriétaire ou éditeur), `start/AttachTripScreen.tsx`, `RouteCollabPageClient.tsx` (phase `attach`), `app/compas/itineraire/page.tsx` ; `attachTrip.test.tsx` (9 cas), `entry.test.ts`, `loadTripEntry.test.ts` | Sans `?trip=`, une personne connectée voit « Rattacher à un voyage » : ses voyages (ceux qui ont déjà un tracé sont dits et seront ouverts) et « Nouveau voyage » (`compasCreateTripAction`, qui renvoie désormais aussi `id`) ; le choix ré-étiquette le brouillon de l'appareil (`guestDraft`, provenance gardée) puis ouvre `?trip=<id>`. « Continuer sans voyage » reste possible et la pastille « Rattacher » le re-propose. Visiteur : il trace, le rattachement lui est proposé à la reconnexion (le brouillon est repris). Non rejoué : le parcours dans un navigateur réel. |
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
| 2.1 | Une seule carte pour LKDV | Fait | Noyau partagé `src/components/map/engine/liveMapCore.ts` (chargement MapLibre, options et physique du Compas, style, bail `WebGLArbiter` titulaire `route-map`, perte de contexte), utilisé par `compas/v5/map/LiveMap.tsx` (comportement inchangé : 559 tests `compas/v5` verts) ET par `RouteCollabMap.tsx` (plus aucun `new maplibre.Map` propre) ; toutes les interactions de l'itinéraire gardées (toucher, appui long, glisser, curseur profil, cadrage selon le tiroir, position en direct, calques) ; `liveMapCore.test.ts`, `routeMapInteractions.test.tsx` ; capture `shots/partiels-carte/1-mid.png` (carte réelle, tracé, tiroir) | — |
| 2.2 | Toucher = point, appui long = menu | Fait | `mapGesture.ts`, `map/PointRoleMenu.tsx` ; `mapGesture.test.ts`, `routeMapInteractions.test.tsx` | Test d'appui long rendu déterministe le 23/11 (minuteurs simulés, voir section 5). |
| 2.3 | Insertion au bon endroit | Fait | `pointInsertion.ts`, `RouteCollabMap.tsx` (`insertionThresholdM`) ; `pointInsertion.test.ts` | |
| 2.4 | Glisser la ligne, halo du chemin visé | Fait | `routePreview.ts` (Valhalla `snap=1`), `RouteCollabMap.tsx` ; `routePreview.test.ts` | |
| 2.5 | Une couleur par jour, lentilles | Fait | Chaque chip J1/J2… de la pilule porte une pastille de la couleur de son jour (`pillModel.dayColorToken`, même jeton et même `dayColorIndex` que le tracé) ; la légende des jours sur la carte et les lentilles Pente/Surface restent en vue experte ; `chromeModels.test.ts`, `routeMapInteractions.test.tsx` (2.5). Pas de capture des chips : le découpage en jours n'a pas pu être produit en local (recherche d'hébergements réseau bloquée), preuve par test jsdom. | — |
| 2.6 | Profil et carte liés | Fait | `profileLink.ts`, `map/ProfileReadoutLine.tsx`, `AnalyserTab.tsx` ; `profileLink.test.ts` | |
| 2.7 | Calques selon le sport, source et date | Fait | `mapLayers.ts` (`describePoiProvenance`), `MapOverlays.tsx` ; `mapLayers.test.ts` | |
| 2.8 | Cadrage qui suit le tiroir | Fait | `mapFraming.ts`, `map/useSheetHeight.ts` ; `mapFraming.test.ts` | |
| 2.9 | Position en direct | Fait | `liveTrack.ts`, `map/useLivePosition.ts` ; `liveTrack.test.ts` | |
| 2.10 | Carte hors ligne | Fait | `offlineTiles.ts` : corridor du tracé (tampon 1 km), zooms 10 à 15 (la source s'arrête au 14, le 15 agrandit le 14), taille estimée annoncée avant (`TilePackBlock` dans Départ et « Hors ligne, Activité & Carnet »), plafond 60 Mo avec message (zooms fins retirés, ou pas de fond), cache neuf puis promotion, copie précédente jamais cassée (échec, coupure, plafond < zoom 12) ; fournisseur OpenFreeMap (le fond courant OSM France/ArcGIS/Esri ne peut pas être préchargé : politique OSM, forfait ArcGIS, usage non commercial Esri) ; service worker `public/sw-route-tiles.js` (chargé par `sw-v18.js`, caches protégés de la purge) ; hors ligne la carte pose ce fond sous le tracé ; `offlineTiles.test.ts` (13 tests dont service worker en bac à sable), `tests/map/standardBase.spec.ts` ; captures `tuiles-1-annonce.png`, `tuiles-2-telecharge.png` (20 tuiles, 5,3 Mo réels), `tuiles-3-hors-ligne.png` (fond vectoriel lu dans la copie) | Le service worker n'est enregistré qu'en production : hors ligne, la lecture par le worker n'a été vue qu'en test (bac à sable) et par une émulation Playwright de la copie ; à rejouer sur l'aperçu. L'estimation de taille est approximative (±50 % selon la densité) : la taille réelle est affichée après. |

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
| 4.1 | Interrupteur Simple / Expert | **Fait** (migration écrite, à appliquer) | `workspace/expertMode.ts` (lecture du compte au premier rendu, écriture à la bascule, `localStorage` en repli), `uiPrefs.ts`, `server/uiPrefs.ts`, `/api/itineraire/prefs` (GET/PUT, zod, clé unique `routeViewMode`), table `user_ui_prefs` (RLS `auth.uid()` en select/insert/update, aucune vue publique) dans `20261123130000_route_collab_followups.sql` ; `app/api/itineraire/prefs/__tests__/route.test.ts`, `expertModeSync.test.tsx`, test SQL `route_collab_followups.test.sql` | Tant que la migration n'est pas appliquée, l'écriture au compte échoue en silence et le réglage reste local (comportement d'avant). Les colonnes `notification_prefs` et `sport_profile_prefs` ne sont pas utilisées (autre sens, la seconde est exposée par `public_profiles`). La lecture se fait au premier rendu du client, pas au chargement serveur de `page.tsx` : un premier affichage « simple » peut précéder le réglage du compte sur un appareil neuf. |
| 4.2 | Primitives du Compas v5 | Fait | Coquille `compas/v5/ui/SheetShell.tsx` (poignée, verre `.v5-sheet`, capsule, titre, croix, Échap/Tab/focus en options) utilisée par `V5Sheet` (DOM inchangé) ET par `chrome/RouteSheet.tsx`, le tiroir de l'itinéraire, qui remplace `ExplorerSheet` (trois hauteurs aperçu / moitié / plein, `sheetDetents.ts`, poignée « Ajuster la hauteur du tiroir », espaceur de pied mobile `.rcw-sheet-body`, `data-testid` conservés) ; `routeSheetShell.test.tsx`, `routeCollabChrome.test.tsx` ; captures `1-mid.png`, `2-full.png`, `3-peek.png` | — |
| 4.3 | Trois hauteurs nettes | Fait | `RouteCollabWorkspace.tsx` (`detent`) ; `routeCollabChrome.test.tsx` (« aperçu, moitié par défaut, plein ») | |
| 4.4 | Tuiles chiffrées en tête | Fait | `ui/MetricTiles.tsx`, `chrome/SheetSummary.tsx`, `ui/figures.ts` ; `figures.test.ts` | |
| 4.5 | Inconnu jamais affiché comme zéro | Fait | `ui/figures.ts`, `SectionDrawer.tsx`, `components/workspace/metrics.ts` (`formatStageKm`, `distanceKnown`) ; `routeAnalysis.ts` : D+ et D− totaux seulement si tous les tronçons les connaissent, durée seulement si toutes les durées sont connues (sinon Naismith avec D+ connu, sinon inconnue), IBP, calories et niveau d'effort `null` (« Non évalué » dans `RouteAnalysisVisuals.tsx`), pente approchée seulement avec D+ et D− connus, `distanceKnown` ; `integrations.ts` : `elevationGainM` `null` si un D+ manque, poids du sac `null` avec `kitUnweightedCount`, distance prévue `null` sans tronçon ; `figures.test.ts`, `unknownNotZero.test.ts` | Restent hors périmètre : `minDistanceToTrackM` renvoie 0 pour un tracé vide, et `computeTechnicalTerrainStats` retombe sur un point fixe quand aucun tracé n'existe (lever et coucher du soleil). |
| 4.6 | Deux niveaux au plus | Fait | `useRouteLevels.ts` : une entrée d'historique par niveau ouvert (`history.pushState`, même adresse), `popstate` ferme le niveau le plus haut, un niveau fermé autrement dépile ; le tiroir ouvert à l'arrivée n'est pas un piège ; sortie de page par changement de route : historique non touché ; `levels.ts`, `routeLevelsHistory.test.tsx` (9 tests) ; en dev réel : sous-tiroir ouvert puis retour navigateur = sous-tiroir fermé, tiroir et page gardés (`5-sous-tiroir.png`, `6-apres-retour.png`) | — |
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
| 5.9 | Formats et GPX validé | Fait | `insights/fit.ts` (décodeur FIT minimal, pur, sans dépendance), `insights/formats.ts` (`parseTrackFile` accepte `ArrayBuffer`, format `fit`), `trackIo.ts`, `useTrackTools.ts` et `StartScreen.tsx` (lecture binaire des `.fit`) ; `insights/__tests__/fit.test.ts` (fichiers FIT construits dans `fitBuilder.ts`), `trackIo.test.ts`, `formats.test.ts` ; GPX, KML, TCX, GeoJSON inchangés, export complet ou par étape (`?stageId=`), `validateGpx11` | FIT lu : en-tête 12/14 octets, little/big endian, définitions, champs développeur sautés, temps compressé, `record` (semicircles → degrés, `enhanced_altitude` sinon `altitude`, horodatage), CRC ignorée mais taille contrôlée ; fichier coupé, signature absente ou message sans définition refusés avec leur raison ; `record` sans GPS compté, jamais inventé. Limite : seules les positions, l'altitude et l'heure sont lues (pas de capteurs) ; non éprouvé sur des fichiers réels de montres (un décodeur complet existe aussi dans `hiking/import/fit.ts`, avec CRC et sessions, utilisé par l'import de sorties). |
| 5.10 | Historique lisible | Fait | `versionTimeline.ts`, `track/VersionTimeline.tsx` ; `versionTimeline.test.ts` | |

### 6 · Étapes et nuits

| # | Amélioration | Statut | Preuve | Reste à faire |
| --- | --- | --- | --- | --- |
| 6.1 | Découpage proposé et expliqué | Fait | `insights/stageSplit.ts`, `stages/SplitAssistant.tsx` (seuils modifiables) ; `stageSplit.test.ts` | |
| 6.2 | Déplacer une coupure en glissant | Fait | `profileCuts.ts`, `stages/ProfileCuts.tsx` (glisser sur le profil) ; `trackStagesUi.test.tsx` | Pas de glisser de la coupure sur la carte (le profil suffit à la ligne). |
| 6.3 | Nuits réelles uniquement | Fait | `nights.ts` (`rankStayOptions`), `stages/NightPicker.tsx` (prix « repère du barème ») ; `dayReading.test.ts`, `placesClient.test.ts` | |
| 6.4 | Allure du groupe | Fait | `dayReading.ts`, `insights/pace.ts` (`fromProfile`, `origin`), `stages/PaceSetting.tsx`, `stages/usePace.tsx` ; `app/compas/itineraire/page.tsx` lit `getPaceContextForUser` (`server/paceProfile.ts`), `RouteCollabPageClient` → `RouteCollabWorkspace` monte `RoutePaceProvider` ; méthode dite : « d'après tes sorties » (profil), « allure standard Naismith … (allure du groupe non renseignée) » (profil absent ou à froid) ; `paceWiring.test.tsx`, `paceContextServer.test.ts`, `paceProfile.test.ts`, `pace.test.ts`, `dayReading.test.ts` | Seule l'allure de la personne connectée est lue (RLS : propriétaire seulement) ; les autres membres sont dits « sans allure renseignée », ou saisis à la main (appareil). Le recalcul du profil après chaque sortie n'est pas de cette page : chantier `adventure-intelligence` (`buildUserProfile`). La copie hors ligne (`RouteCollabOfflineClient`) n'a pas de profil : allure standard. |
| 6.5 | Heure de départ, coucher du soleil | Fait | `stages/DayParts.tsx`, `insights/daylight.ts` ; `daylight.test.ts` | |
| 6.6 | Eau et ravitaillement par jour | Fait | `insights/water.ts`, `DayParts.tsx` ; `water.test.ts` | |
| 6.7 | Jour de repos, étape courte | Fait | `stages/DayTools.tsx`, `insert_rest_day` ; `trackStagesUi.test.tsx` | |
| 6.8 | Dates et fuseau locaux | Fait | `dayReading.ts`, `insights/daylight.ts` ; `dayReading.test.ts` (changement d'heure) | |
| 6.9 | Même tiroir « Jour » que le Compas v5 | Fait | `stages/DayView.tsx` reprend la structure de `compas/v5/drawers/day.tsx` avec les primitives de `v5/ui/primitives.tsx` : bandeau `v5-hero` (`Pic`) et flèches `v5-rbtn v5-lg` (≥ 44 px), ligne « A → B · Jour N » (`v5-meta`), trois chiffres `v5-stats3`, « Ce soir » (`Cap`, `Grp`, `Li`, `MBtn`), puis ce que l'itinéraire ajoute (arrivée et coucher, eau, repli) ; `trackStagesUi.test.tsx` (« 6.9 ») | Écarts assumés : pas de photo du lieu (l'itinéraire n'en a pas, le pictogramme tient lieu, rien n'est inventé) ni de ligne météo vers le tiroir Météo (la météo est dans Analyser). Le Compas n'est pas modifié. |
| 6.10 | Repli prévu | Fait | `insights/bailout.ts`, `DayParts.tsx` ; `bailout.test.ts` | |

### 7 · Analyser

| # | Amélioration | Statut | Preuve | Reste à faire |
| --- | --- | --- | --- | --- |
| 7.1 | Moteur d'effort branché | Fait | `analyse/effort.ts` (`computeEffortScore`, `predictRoute`, `buildGroupPlan`, `usablePerformanceProfile`) ; le profil de performance de la personne (`usePerformanceProfile`) est transmis à `predictRoute` quand il est appris et fiable (hors « à froid », confiance ≥ 0,5) ; `AnalyseBlocks.tsx` dit la base du temps (`effort-time-basis` : « d'après tes sorties (N) » ou « allure standard : raison ») ; `analysis.test.ts`, `paceWiring.test.tsx` | La prédiction personnalisée est celle de la personne connectée ; la prédiction de groupe prend l'allure des membres connue (la sienne) et l'allure standard pour les autres, dite à l'écran. |
| 7.2 | Difficulté expliquée | Fait | `analyse/difficulty.ts` (`routes/analysis/difficulty`), « Pourquoi ? » ; `analysis.test.ts` | |
| 7.3 | Profil interactif | Fait | `analyse/segments.ts`, `RouteAnalysisVisuals.tsx`, `ProfileReadoutLine` ; `analyserTab.test.tsx` | |
| 7.4 | Météo par lieu et créneau | Fait | `/api/itineraire/analyse`, `analyse/passageWeather.ts` ; `analyserTab.test.tsx` | |
| 7.5 | Eau en trois niveaux | Fait | `insights/water.ts`, `AnalyseBlocks.tsx` ; `water.test.ts` | |
| 7.6 | Alertes officielles datées | **Fait** | `analyse/alerts.ts` (`alertsFromWorld`, message d'interrupteur éteint), `analyse/gdacs.ts` (pur), `server/gdacsAlerts.ts` (flux GDACS public sans clé, cache 5 min, délai 8 s), route d'analyse (`world`, `official.worldSwitch`), Meteoalarm / NWS / ECCC par `getOfficialAlerts` (service partagé avec le Compas, non dupliqué), feux `fire.ts` ; `gdacs.test.ts`, `gdacsServer.test.ts`, `analyse/route.test.ts`, fixture réelle GDACS du 23/11/2026 | Chaque alerte porte source, date de relevé et fin de validité. Un échec réseau dit « indisponible », jamais « rien à signaler ». **Réglages du serveur, à la main de Tony** : NWS (États-Unis) et ECCC (Canada) ne sont lus que si `COMPAS_ALERTS_WORLD` est posé (éteint par défaut : l'écran le dit) ; FIRMS exige `NASA_FIRMS_MAP_KEY` (absente : l'écran dit « source feux actifs non configurée »). GDACS situe un événement par son point de référence (rayon par type d'aléa), pas par son emprise : dit à l'écran ; sécheresses et niveau Vert non demandés. |
| 7.7 | Surfaces en pourcentage | Fait | `insights/surfaces.ts`, `AnalyseBlocks.tsx` ; `surfaces.test.ts` | |
| 7.8 | Lumière du jour | Fait | `insights/daylight.ts`, `AnalyseBlocks.tsx` ; `daylight.test.ts` | |
| 7.9 | Source et fraîcheur partout | Fait | `analyse/provenance.ts`, `Sourced.tsx` (`data-source`, `data-source-at`) ; `analyserTab.test.tsx` | |
| 7.10 | Synthèse en trois lignes | Fait | `insights/summary.ts`, `AnalyseBlocks.tsx` ; `analyserTab.test.tsx` | |

### 8 · Équipe

| # | Amélioration | Statut | Preuve | Reste à faire |
| --- | --- | --- | --- | --- |
| 8.1 | Invitations du voyage réutilisées | Fait | Migration (lecture de `trip_collaborators` dans les droits), `set_route_member_tx`, `team.ts` ; `teamModel.test.ts`, `teamStore.test.ts` | |
| 8.2 | Trois droits en vue simple | Fait | `team.ts`, `tabs/EquipeTab.tsx` ; `teamUi.test.tsx` | |
| 8.3 | Une étape confiée | Fait | `team.ts`, `RoutePill.tsx` (avatar), `EquipeTab.tsx`, `store/supabaseStore.ts` (`updateMemberRoleOrRevoke` passe `p_stage_scope_ids` : `null` = portée inchangée, `[]` = vidée) ; `teamStore.test.ts`, `supabaseStore.test.ts` (« membres : … p_stage_scope_ids ») | La migration appliquée le 23/11 a `p_stage_scope_ids` : le 501 n'existe plus (plus aucun code 501 dans le store Supabase). Non rejoué : l'appel contre la vraie base (client simulé). |
| 8.4 | Présence légère | Fait | `team.ts` (`presenceByStage`), `RoutePill.tsx` ; `teamModel.test.ts` | |
| 8.5 | Conflit compréhensible | Fait | `workspace/Banners.tsx`, `team.ts` ; `teamUi.test.tsx` | |
| 8.6 | Propositions avant / après | Fait | `subdrawers/ProposalsDrawer.tsx`, `supabaseStore.ts` (`createWorkspaceProposal`, vote, décision) ; `teamUi.test.tsx` | |
| 8.7 | Commentaires attachés au terrain | Fait | `ProposalsDrawer.tsx` (`relocate-*`), `/api/routes/[id]/comments/[commentId]/relocate` ; `teamStore.test.ts` | |
| 8.8 | Temps réel par Broadcast | Fait | `realtime.ts` (`client.channel('route:<id>', { config: { private: true, broadcast: { self: false } } })`), `useRouteRealtime.ts` (jamais `postgres_changes`) ; `realtime.test.ts` (ouverture du canal avec `private: true`, repli sur l'interrogation) | Canal privé : les policies `realtime.messages` de la migration appliquée limitent `route:<uuid>` aux lecteurs de l'espace. Non rejoué : une connexion Realtime réelle et la RLS Realtime (le client est simulé). |
| 8.9 | Lien de lecture révocable | Fait | `subdrawers/SharingDrawer.tsx`, `manage_route_share_link_tx`, `shareSanitize.ts` (zone de départ masquée), 48 h par défaut ; `shareSanitize.test.ts` | |
| 8.10 | Partager une étape dans la messagerie | Fait | `messageLink.ts` (`toStageMessageMeta`, `shareableConversations`), `stages/ShareStageToChat.tsx` (bouton « Envoyer ce jour dans la messagerie » dans le tiroir du jour, `DayView.tsx`), `messagingService.getConversations` / `sendMessage` (type `trail`), `messaging/components/TrailCard.tsx` (carte cliquable à la réception) ; `shareStageToChat.test.tsx` | Sélecteur : seules les conversations de la personne (adhésions, actives, non archivées, hors démonstration). Pas de bouton pour un visiteur, un itinéraire non enregistré ou un lien de lecture ; le jeton d'un lien de lecture n'est jamais joint ; la carte n'ouvre l'itinéraire que pour qui peut déjà le lire (`?workspaceId=&jour=`). Un échec d'envoi est dit, jamais présenté comme envoyé. Non rejoué : l'insertion contre la vraie base. |

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
| 9.8 | Démarrer l'activité depuis la version | Fait | `depart/activityHandoff.ts` (`parseHandoff`, `followedVersionLabel`), `DepartBlocks.tsx` (`cockpit-link` → `/randonnee-active?tripId=`), `hiking/controllers/HikingController.ts` (la passation est lue au départ, gardée dans l'état et le brouillon de sortie), `hiking/services/HikeSessionService.ts` (`saveSession` envoie `routeWorkspaceId`, `routeRevisionId`, `kitSnapshot`), `hiking/components/HikingCockpitPage.tsx` + `FollowedVersionBadge.tsx` (« Version vN suivie · n objets du sac »), `app/api/hike-sessions/routeLink.ts` ; `saveSessionRouteLink.test.ts`, `FollowedVersionBadge.test.tsx`, `departTab.test.tsx` | Les colonnes existent en base depuis le 23/11 ; le repli sans elles (`isMissingColumnError`) reste en sécurité. La version doit appartenir à un espace lisible par la personne (RLS) sinon le lien est ignoré. Non rejoué : une sortie réelle de bout en bout (le contrôleur n'a pas de test propre, le GPS n'est pas simulé). |
| 9.9 | Carnet plan contre réel | Fait | `depart/carnetCompare.ts`, `depart/PlanVsActual.tsx` (monté dans `OfflineCarnetDrawer`) ; `departTab.test.tsx` | |
| 9.10 | « Reprendre cette sortie » | Fait | `useRouteWorkspaceState.ts` (`handleDuplicateFromCarnet` crée l'espace par `persistWorkspaceToServer`, provenance `activity_replay`, même voyage, puis ouvre `?workspaceId=&trip=` ; repli local dit avec sa raison), `carnetReplay.ts`, `server/loadCarnetReplay.ts` (carnet lu par `getCarnetDetail`, donc sous RLS et avec les masques du lecteur ; voyage rendu au seul propriétaire), `app/compas/itineraire/page.tsx` (`?from=carnet&carnetId=`), `insights/deepLinks.ts` (`buildCarnetReplayHref`), `components/carnet/v2/CarnetDrawerV2.tsx` (« Reprendre le tracé » et « Reprendre dans le Compas » ouvrent `/compas/itineraire?from=carnet&carnetId=…` au lieu de `/compas?nouvelle=1`) ; `departTab.test.tsx`, `carnetReplay.test.tsx`, `loadCarnetReplay.test.ts` | Sans voyage connu, la personne connectée choisit le voyage (1.1) avec le tracé repris gardé. `trip=` est facultatif dans le lien du carnet : le voyage est retrouvé depuis le carnet quand la personne en est propriétaire. Un voyage qui a déjà un tracé n'est pas écrasé : la reprise crée un autre espace. Les tests `src/components/carnet` échouent déjà au HEAD de la branche avant ces changements (39 cas, vérifié en rétablissant `CarnetDrawerV2.tsx`). |

### 10 · Interconnexion avec LKDV

| # | Amélioration | Statut | Preuve | Reste à faire |
| --- | --- | --- | --- | --- |
| 10.1 | Un seul tracé par voyage | Fait | `compas/server/routeDraftWrite.ts` (écrivain unique), `publishedSync.ts`, `getCompasData.ts` ; `publishedSync.test.ts`, `compasDraft.test.ts` | L'éditeur du Compas reste, la version publiée gagne. |
| 10.2 | Entrée depuis le Compas | Fait | `CompasOuFlows.tsx` (`compas-open-itinerary`, `router.push`), `RouteEditor.tsx` (`compas-editor-open-itinerary`, lien) ; `compas/__tests__/openItinerary.test.tsx` : les deux mènent à `/compas/itineraire?trip=<id>` | L'entrée est dans le tiroir Parcours hérité, pas dans un tiroir v5 dédié. |
| 10.3 | Le HUB lit la version publiée | Fait | `hub/components/itinerary/PublishedRouteCard.tsx`, `app/hub/[section]/page.tsx`, `hub/cockpit/loadCockpit.ts`, `integrations.ts` ; `cockpit-complete-domain.test.ts`, `integrationsAndFeatures.test.ts` | |
| 10.4 | Explorer mène ici | Fait | `explorer-v2/server/prepareWithTrack.ts`, `/api/itineraire/from-explorer`, `SheetContent.tsx` ; `prepareWithTrack.test.ts` | |
| 10.5 | Clubs | **Partiel** (code et migration écrits ; en production, attend les migrations clubs `20261119*`) | RPC `publish_club_event_route_from_workspace` (SECURITY DEFINER, `search_path` vide, `EXECUTE` à `authenticated` seulement), `server/clubRoute.ts` (`publishWorkspaceToClubEvent`, `listOrganizerClubEvents`), `/api/itineraire/club-route`, `depart/ClubRouteBlock.tsx` (onglet Départ, « Proposer à la sortie du club ») ; lecture : `app/sorties/[id]/readClubRouteProposal.ts` + `ClubEventRouteProposal.tsx` (mention « Proposé depuis l'itinéraire · version N », tracé lu par `get_club_event_route_trace` ou, à défaut, dans `trace` sous RLS, mêmes gestes Adopter / Garder), `ClubEventDetail.tsx`, HUB (`loadCockpit.ts`, `clubRouteSources.ts`, ligne « Révisions de parcours club ») ; tests : `readClubRouteProposal.test.ts`, `ClubEventRouteProposal.test.tsx`, `ClubEventDetail.test.tsx`, `clubRouteSources.test.ts`, `clubsBridge.test.ts`, SQL `route_collab_followups.test.sql` (65, schéma de production) et `route_collab_followups_clubs_full.test.sql` (16, socle 20261119* appliqué) | La section clubs de `20261123130000` est CONDITIONNELLE (bloc `DO` : socle absent = NOTICE, rien créé) et écrite pour le schéma RÉEL de production (révisions sans `canonical_revision_id` / `route_name`, pas de `cancelled_at`, pas de décisions) : la RPC insère par `jsonb_populate_record` et notifie les inscrits (`club_event_registrations`, via `notify_activity`). Validée sur PostgreSQL local dans les deux mondes (schéma de production, puis dépôt complet avec 20261119*) : application, test, retour arrière (définitions restaurées à l'identique, vérifié par empreinte), rejeu. Droit exigé : organisateur de la sortie (ou modérateur du club) ET propriétaire de l'espace ou co-organisateur à publication déléguée. Version PUBLIÉE seule ; sortie ni `club_only` ni `private` : zone de départ privée masquée (500 m au moins). **Reste** : en production, `save_event_route_state`, `get_club_event_route_trace` et `get_trip_club_route_updates` n'existent pas encore ; la proposition est donc publiée et lisible sous RLS (tracé affiché sur la fiche), mais l'adoption et la ligne du HUB n'apparaissent qu'après application de `20261119204829` / `20261119205238` ; la migration `20261123130000` reprend alors leurs définitions (filtre `trace` inclus) si elle passe après, sinon à rejouer. La RLS de lecture des révisions en production est celle de G02 (membre du club) tant que `can_read_event_route` n'est pas là. |
| 10.6 | Budget | **Fait** | `budgetSync.ts` (nuits, transports, achats), `server/budgetSync.ts`, `/api/itineraire/budget-sync`, op `set_stage_transports` (types, moteur, permissions, annulation, zod), action kit `set_purchase`, `stages/StageTransports.tsx` (tiroir Jour), champ « Achat prévu » du tiroir Sac ; `budgetSync.test.ts`, `transportsPurchases.test.ts`, `stageTransports.test.tsx` | Une ligne `trip_expenses` n'existe que pour un montant SAISI (total du groupe, jamais multiplié ni estimé) ; « à estimer » n'écrit rien. Clés stables, idempotent, une ligne retouchée à la main n'est jamais écrasée. Devise du sac : euro seulement dans l'écran (le schéma accepte EUR, USD, GBP, CHF, CAD, JPY). Types additifs : les anciens espaces se lisent inchangés. Sans migration. |
| 10.7 | Météo et Vérifs partagées | Fait | `server/sharedChecks.ts` (mêmes `getCompasWeather`, `getOfficialAlerts`, `assessDanger`), route d'analyse ; `sharedChecksModel.test.ts` | |
| 10.8 | Page Compte, profil de performance | **Fait** | Lecture : `server/paceProfile.ts`, `RoutePaceProvider` (durées 6.4, temps 7.1). Recalcul : `adventure-intelligence/server/recomputeProfileAfterSession.ts` (adaptateur Supabase de `ProfileBuildClient`, `buildUserProfile`), branché dans `app/api/cron/process-hike-sessions` après chaque session `processed` ; `tests/adventure-intelligence/recompute-profile-after-session.spec.ts`, `process-hike-sessions/__tests__/route.test.ts` | Consentement revérifié (`hasPersonalScoringConsent`, échec = refus), idempotent (upsert sur `(user_id, activity_type)` et `(profile_id, model_version)`, rien si le profil est plus récent que la dernière observation), borné (500 observations, une reconstruction par personne et par exécution, 5 sessions par lot), non bloquant. Aucune lecture de l'allure des autres membres (RLS). Le profil ne change qu'après le passage du cron. |
| 10.9 | Communauté et carnets | Fait | `communityShare.ts` (`toCommunityPostPayload`, `toCarnetPayload`, `toStoryRow`), `server/shareToCommunity.ts` (`publishRouteToCommunity` avec cibles post, story, carnet ; `myClubsForShare`), `/api/itineraire/share-community` (POST zod avec `targets`, GET des clubs de la personne), `subdrawers/CommunityPublish.tsx` (cases post / story 24 h / carnet, audience abonnés, public ou « Mon club » si membre actif) ; `communityShare.test.ts`, `shareToCommunity.test.ts` (7 cas), `communityPublish.test.tsx` | Flux existants : RPC `create_community_post` et `create_carnet_v2`, insertion `post_stories` sous sa RLS (story texte : titre et distance, sans lieu). Propriétaire seulement (`route.manage_privacy`), version publiée seulement, zone de départ masquée (`shareSanitize.ts`) ; ni `start_lat/lng`, ni nuits, ni voyage, ni sac. Carnet créé d'abord, post et story liés à lui. Audience club : membre actif exigé (ici, puis en SQL / RLS) ; un carnet n'a pas d'audience club, il reste privé. Échec partiel dit cible par cible, relance idempotente (`client_request_id` suffixé). Non rejoué : les RPC et la RLS contre la vraie base. |
| 10.10 | System Admin | **Fait** (migration écrite, à appliquer) | RPC `admin_list_route_moderation` (durcie : `is_moderateur()`, `search_path` vide, commentaires lus dans `state_snapshot`, jamais de jeton) et `admin_apply_route_moderation` (masquer ou supprimer un commentaire, révoquer un lien, retirer une trace publique `route_collab` ; effet + ligne `admin_audit_log` `REJECT` dans la même transaction), `server/adminModeration.ts`, `/api/admin/moderation` (`enforced: true`), section de `app/admin/page.tsx` ; `moderationModel.test.ts`, `admin/moderation/__tests__/route.test.ts`, test SQL | `moderation_queue` n'est PAS utilisée (en production c'est la file des annonces de la place de marché : autres colonnes) : le statut d'un élément est la dernière ligne de `admin_audit_log` (`apres.statut`), le rejet journalise `action = REJECT`, `apres = {statut: rejete, enforced}` ; approuver / signaler n'écrivent que dans ce journal. La proposition `MIGRATION-PROPOSEE-ADMIN.sql` est supprimée (intégrée). Corrigée à l'intégration : elle lisait `route_comments`, table jamais alimentée. « Masquer » remplace le texte (non réversible), « Supprimer » retire l'élément ; retirer une trace supprime la publication. Validée sur PostgreSQL local avec le schéma de production (application, test, retour arrière, rejeu). Sans migration, la lecture des commentaires et liens reste « indisponible » et un rejet échoue (jamais présenté comme appliqué). |

## 4. Écarts entre les déclarations et le code

- **4.1** : déclaré mémorisé « par compte » dans le plan ; le code mémorise sur l'appareil, faute de colonne de préférences générale (voir la ligne 4.1). Reste Partiel, migration nécessaire.
- **1.1** : non annoncé comme partiel ; la page s'ouvre sans voyage et garde un brouillon local.
- **6.4, 7.1, 10.8** : corrigé le 23/11 : `server/paceProfile.ts` est lu par la page et `RoutePaceProvider` est monté. Le recalcul du profil après chaque sortie reste hors de la page (10.8 Partiel).
- **10.5** : annoncé « migration nécessaire » ; en plus, le pont serveur n'est appelé par aucune route ni écran. Non fait.
- **5.9** : FIT absent (refusé volontairement). **2.10** : tuiles non empaquetées. Aucun de ces deux points n'était annoncé tel quel. Corrigés le 23/11 : **6.9** (structure du tiroir reprise), **10.9** (bouton), **10.2** (test), **4.5** (conversions en 0 supprimées).
- **9.8** : le service `HikeSessionService.ts` est bien modifié (seul l'écran du cockpit ne l'est pas).
- **P3** : la branche n'a plus de retard sur `main` ; elle est poussée mais non fusionnée.
- **P2** : appliquée en production le 23/11/2026 ; vérifications en base faites (tables, RLS, droits anon, vue, realtime).
- Confirmés conformes aux déclarations : 2.1, 2.5, 4.2, 4.6, 7.6, 8.3 (501, `p_stage_scope_ids` absent de la migration), 8.8, 8.10, 9.10, 10.6, 10.10.

## 5. Contrôles de la branche (lancés le 23/11/2026)

- `npx tsc --noEmit -p . 2>&1 | grep -c "error TS"` : **19** erreurs, toutes préexistantes (`components/carnet/v2` ×6, `components/clubs/drawer` ×4, `KitProductSheetV2` ×2, `HubCockpit` ×7). Aucune dans `route-collab`.
- `npx vitest run src/features/route-collab src/app/api src/features/compas src/features/hub src/features/explorer-v2 src/features/hiking` : **399 fichiers, 6 341 tests ; 396 fichiers et 6 338 tests passent, 3 échecs**.
  - `compas/__tests__/overpassEndpoints.test.ts` : préexistant sur `main`.
  - `explorer-v2/__tests__/n01-n02-wiring.test.tsx` : préexistant sur `main`.
  - `route-collab/__tests__/routeMapInteractions.test.tsx` (2.2, menu d'appui long) : échec de délai sous charge. **Corrigé le 23/11** : l'appui long utilise des minuteurs et une horloge simulés (`vi.useFakeTimers` sur `setTimeout`, `clearTimeout`, `Date`, aucune attente réelle) ; une durée écoulée trop courte (300 ms au lieu de 500) fait échouer le test, donc la vérification reste entière ; 15/15 seul et vert dans la suite complète trois fois de suite.
- Non rejoués : tests SQL RLS, Playwright (`tests/e2e/route-collab-20-10.spec.ts`), `npm run lint`, `next build`.

### Contrôles du second passage (23/11/2026, sans migration, `supabase/**` non touché)

- `npx tsc --noEmit -p . | grep -c "error TS"` : **19** (les mêmes, préexistantes : `components/carnet`, `components/clubs`, `KitProductSheetV2`, `HubCockpit`) ; aucune dans `route-collab`, `app/compas/itineraire` ni les nouveaux tests.
- `npx vitest run src/features/route-collab src/app/api src/features/compas src/features/hub src/features/explorer-v2` ×3 : **389 fichiers, 6 203 tests ; 387 fichiers et 6 201 tests passent, 2 échecs identiques à chaque passage, tous deux préexistants** (`compas/__tests__/overpassEndpoints.test.ts`, `explorer-v2/__tests__/n01-n02-wiring.test.tsx`). `routeMapInteractions` vert les 3 fois.
- Nouveaux tests : `paceWiring.test.tsx`, `paceContextServer.test.ts`, `communityPublish.test.tsx`, `unknownNotZero.test.ts`, `compas/__tests__/openItinerary.test.tsx`, plus un cas « 6.9 » dans `trackStagesUi.test.tsx`.
- `npx eslint` sur les fichiers modifiés ou ajoutés : 0 erreur. Non rejoués : `next build`, Playwright, `npm run lint` complet.
