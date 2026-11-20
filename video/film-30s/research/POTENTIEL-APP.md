# LKDV — potentiel réel de l'application (recherche pour le film de 30 s)

Établi le 17/11/2026 à partir du code (`main`, commit `6171d481a`), des fichiers de données du dépôt, de la base de production Supabase `icxyvwzfjbflcbqukpfz` (lecture seule, comptes agrégés uniquement) et de la liste des variables d'environnement du projet Vercel `kitduvoyageur-1783951966810` (noms seulement, aucune valeur lue).

Légende d'état utilisée partout :
- **[PROD]** visible en production aujourd'hui ;
- **[CLÉ]** code présent, clé ou secret absent en production (variable inexistante sur Vercel) ;
- **[DRAPEAU]** code présent, interrupteur éteint en production ;
- **[NON BRANCHÉ]** code présent, aucun écran ne l'appelle ;
- **[DÉMO]** données de démonstration, pas d'usage réel.

---

## 0. En une minute

| Mesure | Valeur | Source |
|---|---:|---|
| Pages (routes `page.tsx`) | **45** | `find src/app -name page.tsx` (hors test) |
| Redirections actives (anciennes routes fondues) | 64 | `src/constants/routeRegistry.json` (`active`) |
| Routes API | **371** (213 GET, 213 POST, 26 PATCH, 35 DELETE, 3 PUT) | `src/app/api/**/route.ts` |
| Actions serveur (`'use server'`) | **160** fonctions dans 49 fichiers | `grep "use server"` |
| Modules métier | **58** dossiers | `src/features/*` |
| Composants / fichiers TS | 1 233 `.tsx` + 2 165 `.ts` (hors tests) ; 859 fichiers de test | `find src` |
| Tables en production | **365** tables, 7 vues matérialisées, 20 vues, 376 fonctions SQL propres, 913 règles RLS, 364 tables sous RLS | `information_schema`, `pg_policies` |
| Migrations | 466 fichiers, 396 tables distinctes créées au fil de l'eau | `supabase/migrations/` |
| Contrôles interactifs du seul Compas | **302** inventoriés (86,4 % vérifiés par assertion) | `docs/compas/phase7/COUVERTURE.md`, `tests/e2e-compas-full/coverage-registry.json` (320 entrées) |
| Fonctionnalités distinctes visibles par un utilisateur | **≈ 212** (compte détaillé § 1) | inventaire ci-dessous |

**Verdict honnête sur « plus de 300 fonctionnalités »** : au grain « une fonctionnalité = une capacité qu'un utilisateur peut voir et utiliser », je compte **212** fonctionnalités visibles en production, plus **≈ 60** présentes dans le code mais éteintes, sans clé ou non branchées : **≈ 270 au total**, donc **moins de 300**. Le chiffre de 300 n'est dépassé que si l'on compte au grain technique : 302 contrôles dans le seul Compas, 371 routes API, 531 opérations serveur (371 routes + 160 actions). Formulation défendable pour le film : « **plus de 200 fonctionnalités, plus de 500 opérations serveur** ». « 300 fonctionnalités » n'est pas défendable au grain utilisateur.

---

## 1. Inventaire des fonctionnalités (compté et sourcé)

### Méthode
1. Liste des pages (`src/app/**/page.tsx`), des redirections (`routeRegistry.json`) et des cinq destinations de la barre (`src/components/mobile-nav/destinationRegistry.ts` : **Hub · Explorer · Communauté · Messages · Compte**).
2. Pour chaque domaine, lecture des registres et catalogues qui pilotent l'interface (sections du hub, activités, sports, tiroirs, feuilles, cartes, panneaux), puis des composants montés par ces écrans.
3. Une ligne = une capacité qu'un utilisateur reconnaît (« suivre une activité en direct », « recevoir un avis MeteoAlarm »). Les variantes d'une même capacité (17 activités, 29 sports…) comptent **une** fois ; elles servent au § 2.
4. Une route API sans appel littéral depuis l'interface n'est pas comptée comme visible. Test outillé : sur 371 routes, **227** sont appelées par un chemin littéral depuis l'interface ; 37 sont techniques (cron, webhooks, OAuth, dev, admin) ; le reste (≈ 107) passe soit par un chemin construit (ex. `liveTrackingApi.ts` : `const base = '/api/live-tracking'`), soit n'est appelé par aucun écran (ex. `api/media-sharing/flyover`, `api/planning/*`, `api/booking/search`, `api/affiliate/travelpayouts`).
5. État de production vérifié contre la table `public.feature_flags` et la liste des variables Vercel (production).

### A. Compas — préparation (`/compas`, `src/features/compas/`) — 34 visibles
- A01 Phrase libre → une aventure créée (`compasCreateTripAction`, `server/compasActions.ts`) [PROD, essai anonyme 5/h]
- A02 Préparation visible pas à pas (îlot dynamique `v5/Island.tsx`, `components/CompasPrep.tsx`) [PROD]
- A03 Compréhension par règles, sans IA, de 15 réglages dits dans la phrase : dates, durée, groupe, budget (devise, par personne), rythme, nuits, activité, destination, départ, nuits dehors, poids max du sac, sans voiture, distance, niveau, terrain (`engine/intent.ts`, schéma `intentActionSchema`) [PROD]
- A04 Relecture par IA NVIDIA Nemotron (`src/lib/ai/providers/nvidia.ts`) avec repli annoncé [PROD, `NVIDIA_API_KEY` présent]
- A05 « Dis-le » : une phrase modifie le voyage, annulable (`v5/useDisLe.ts`) [PROD]
- A06 Recherche mondiale du lieu (Photon → Nominatim, `server/placeSearch.ts`, `adventure-prep/geocodeService.ts`) [PROD]
- A07 Pays dit dans la phrase gagne (« Tatras, Pologne ») (`engine/saidCountry.ts`) [PROD]
- A08 Sentier nommé (GR20 sud, TMB, Laugavegur…) : étapes proposées par le modèle « expert », vérifiées sur la carte (`engine/intent.ts isNamedTrail`, `server/trailDestination.ts`) [PROD]
- A09 Itinéraire jour par jour sur lieux réels de la zone (`engine/itinerary.ts`, `server/stagePoiLookup.ts` + `geo_places_in_box`) [PROD]
- A10 Carte vivante MapLibre : tracé par jour, étapes, alternatives, calques (`v5/map/LiveMap.tsx`) [PROD]
- A11 Nuits proposées depuis OpenStreetMap + photos Wikimedia Commons avec auteur et licence (`compasV5ExtrasAction`) [PROD, Overpass souvent indisponible]
- A12 Éditeur d'itinéraire (`components/RouteEditor.tsx`) [PROD]
- A13 Heure de passage à chaque étape (`engine/passage.ts`) [PROD]
- A14 Lever / coucher du soleil (`engine/sun.ts`) [PROD]
- A15 Acclimatation en altitude (`engine/acclimatisation.ts`) [PROD]
- A16 Trajet pour venir : train par règle, voiture, avion, aéroports (3 244, `data/airports.json`, `engine/rail.ts`, `engine/travel.ts`) [PROD ; calcul Geoapify [CLÉ], repli Valhalla/BRouter sans clé]
- A17 Mode « sans voiture » (`engine/carFree.ts`) [PROD]
- A18 Budget sourcé : carburant (Weekly Oil Bulletin), péages et vignettes, repas (Banque mondiale ICP 2021), devises (Frankfurter/BCE) (`engine/costs.ts`, `fuel.ts`, `tolls.ts`, `icp.ts`, `currency.ts`, tiroir `v5/drawers/budget.tsx`) [PROD]
- A19 Dépenses de groupe partagées (tiroir Nous/Budget, `v5/drawers/nous.tsx`) [PROD]
- A20 Papiers d'entrée selon passeport × destination (39 601 couples, `data/entryRequirements.json`, `server/entryRequirements.ts`) [PROD]
- A21 Prises et tension par pays (228 pays, `data/mainsElectricity.json`, `engine/plugs.ts`) [PROD]
- A22 Alertes météo officielles MeteoAlarm (Europe) (`components/MeteoalarmNotice.tsx`) [PROD] ; NWS / ECCC hors Europe [DRAPEAU `COMPAS_ALERTS_WORLD`]
- A23 Météo MET Norway + normales NASA POWER (`server/weather.ts`, `engine/metno.ts`, tiroir `meteo.tsx`) [PROD]
- A24 Risques en trois barres par axe, jamais une note unique (`engine/riskBars.ts`, `components/CompasRisks.tsx`) [PROD]
- A25 Danger et conseils de terrain (`engine/danger.ts`, `engine/advice.ts`) [PROD]
- A26 Points d'eau et rivières sur le trajet (`engine/water.ts`, `engine/river.ts`) [PROD via OSM ; table `geo_pois` [DRAPEAU `COMPAS_GEO_POIS`]]
- A27 Kit calculé (règles `engine/kitRules.ts`, tiroir Sac `v5/drawers/sac.tsx`) [PROD]
- A28 « À prévoir » / réservations à faire (`v5/drawers/prevoir.tsx`, `server/resaActions.ts`) [PROD]
- A29 Vérifications avant départ (`v5/drawers/verifs.tsx`) [PROD]
- A30 Verdict expliqué + veille (`engine/verdictExplain.ts`, `engine/watch.ts`) [PROD]
- A31 Équipe : invitations, membres, rôles (`components/TripInvitations.tsx`, `CompasMembers.tsx`, `server/invitationActions.ts`) [PROD]
- A32 Bouteille à la mer : annonce publique pour trouver des compagnons, candidatures acceptées ou refusées (`server/bottleActions.ts`, `CompasSheets.tsx`) [PROD, 26 groupes en base]
- A33 Historique d'un objet du kit (`components/CompasItemHistory.tsx`) [PROD]
- A34 Hors ligne du Compas (`features/compas/offline/`) [PROD]
- Non comptés visibles : grands itinéraires, massifs, parcs, sites d'escalade/ski, recherche `geo_places` dans le Compas [DRAPEAU `COMPAS_GEO_*`] ; langues EN/ES/DE/IT [DRAPEAU `NEXT_PUBLIC_I18N_*_ENABLED`, prod = français seul].

### B. Explorer — carte, sentiers, activité (`/explorer`, `src/features/explorer-v2/`) — 32 visibles
- B01 Globe 3D → pays → région → sentier (4 niveaux, projection globe puis mercator, `map/MapStage.tsx` l. 158, 305) [PROD]
- B02 Relief 3D (AWS Terrain Tiles, `raster-dem`, `geo/dem.ts`) [PROD]
- B03 Fond vectoriel OpenFreeMap + imagerie Esri World Imagery (`MapStage.tsx` l. 250, 392) [PROD]
- B04 Pente colorée et profil d'altitude (`map/slope.ts`, `sheet/ElevationProfile.tsx`) [PROD]
- B05 Recherche de lieux et de sentiers (`search/`, `api/explorer/v2/search`) [PROD]
- B06 Suggestions d'itinéraires par sport (`routeSuggestions.ts`) [PROD]
- B07 Boucle générée (`api/explorer/v2/routes/loop`) [PROD]
- B08 Planificateur d'itinéraire (`sheet/RoutePlannerPanel.tsx`) [PROD]
- B09 Itinérance multi-jours (`sheet/MultiDaySheetPanel.tsx`) [PROD]
- B10 Lieux enregistrés (`savedPlaces.ts`) [PROD]
- B11 Points d'intérêt vélo, surfaces, incendies (`api/explorer/v2/bike-pois`, `surfaces`, `fires`) [PROD ; incendies NASA FIRMS [CLÉ `NASA_FIRMS_MAP_KEY`]]
- B12 Météo au point (MET Norway, `api/explorer/v2/weather`) [PROD]
- B13 Signalements terrain (danger, fermeture, balisage, obstacle, eau) + confirmation (`sheet/LayersExtensions.tsx`, `api/explorer/v2/reports*`) [PROD]
- B14 Calques communautaires par période (7 j, 30 j, 90 j, année) (`LayersExtensions.tsx`) [PROD]
- B15 Choix parmi 29 sports en 9 familles (`sheet/sportSelection.ts`) [PROD]
- B16 Démarrage d'activité avec compte à rebours (`activity/Countdown.tsx`, `api/explorer/v2/activity/start`) [PROD]
- B17 Suivi GPS : distance, durée, allure, dénivelé (`activity/tracker.ts`, `useGpsTracker.ts`) [PROD]
- B18 Allure ajustée à la pente (`activity/slopeAdjustedPace.ts`, `sheet/SlopeAdjustedPace.tsx`) [PROD]
- B19 Splits / tours (`activity/splits.ts`) [PROD]
- B20 Alerte hors itinéraire (`activity/offRoute.ts`) [PROD]
- B21 Guidage pas à pas (`guidance/ui/TurnByTurnBanner.tsx`) [PROD]
- B22 Bouton SOS avec compte à rebours puis appel du numéro d'urgence du pays (`chrome/SosButton.tsx`, `activity/sosCall.ts`) [PROD — compose réellement]
- B23 Balise : lien de suivi en direct, contacts de sécurité, montre (`components/ExplorerLiveTrackingPanel.tsx`) [PROD]
- B24 Journal photo en direct pendant l'activité (`sheet/LiveMediaCapture.tsx`, stockage local seulement) [PROD]
- B25 Modes spécialisés : intérieur, ski, natation, rééducation, saisie manuelle (15 modes, `activity/modes/catalog.ts`) [PROD]
- B26 Musculation : carte musculaire, 10 programmes guidés, import/export (`strength/MuscleMapSvg.tsx`, `guidedPrograms.ts`) [PROD]
- B27 Zones cardio / puissance, courbe de puissance (`metrics/powerCurve.ts`, `sheet/ZoneSettingsPanel.tsx`) [PROD]
- B28 Résumé et télémétrie de fin d'activité (`sheet/SummaryTelemetryPanel.tsx`, `activity/finishOutcome.ts`) [PROD]
- B29 Communauté du sentier (`sheet/TrailCommunityPanel.tsx`) [PROD]
- B30 Zone hors ligne (`offline/zone.ts`, `offline/queue.ts`) [PROD]
- B31 Segments en direct et classements (`components/ExplorerLiveSegmentsPanel.tsx`, `api/live-segments`) [PROD ; légende locale [DRAPEAU `local_leaderboard_active`]]
- B32 Topo nationale IGN Plan v2 (`map/nationalTopo.ts`) [PROD]

### C. Terrain, suivi, sécurité (`/live/[token]`, `/compte/suivi-en-direct`, `src/features/live-tracking/`) — 8 visibles
- C01 Page invitée de suivi en direct sans compte (`src/app/live/[token]/page.tsx`, `GuestLiveView.tsx`) [PROD]
- C02 Liens de partage révocables (`api/live-tracking/share-links`) [PROD]
- C03 Contacts de sécurité (`api/live-tracking/safety-contacts`) [PROD]
- C04 État montre pendant le suivi (`WatchLiveStatus.tsx`) [PROD, sans montre réelle connectée]
- C05 Écran « Suivi en direct » du compte (`src/app/compte/suivi-en-direct/page.tsx`) [PROD, aucun lien entrant trouvé hors middleware]
- C06 Zones de confidentialité sur les traces (`api/compte/privacy-zones`, `PrivacyZonesSheet.tsx`) [PROD]
- C07 Confidentialité de trace par sortie (`api/compte/sorties/[id]/trace-privacy`) [PROD]
- C08 Arrivée « en direct » dans le voyage (`hub/components/live/LiveArrivalReveal`) [PROD]
- Non comptés : Terrain Live collectif [DRAPEAU `terrain_live`] ; détection automatique de terrain [DRAPEAU].

### D. Carnets de bord (`/carnets`, `/carnets/[id]`, `src/components/carnet/v2/`) — 14 visibles
- D01 Liste et fiche carnet v2 (`CarnetScreenV2.tsx`) [PROD, `NEXT_PUBLIC_CARNET_V2=true`]
- D02 Lentilles (jours, kit, verdicts…) (`CarnetLenses.tsx`) [PROD]
- D03 Vue jour par jour en glissé (`CarnetDaySwipeView.tsx`) [PROD]
- D04 Profil d'altitude du carnet (`CarnetAltitude.tsx`) [PROD]
- D05 Badge carte et moments (`CarnetMapBadge.tsx`, `CarnetMomentTile.tsx`) [PROD]
- D06 Vidéo du carnet (`CarnetVideo.tsx`) [PROD]
- D07 Kit du carnet avec verdicts par objet : essentiel, utile, jamais servi, défaillant, manquait (`CarnetDrawerV2.tsx` l. 1184) [PROD]
- D08 « Reprendre le kit » / « Reprendre dans mon sac » (`CarnetDrawerV2.tsx` l. 490, 1170 → `kit_forks`) [PROD, 0 reprise en base]
- D09 Création et édition d'un carnet (`CarnetCreateSheet.tsx`, `CarnetEditSheet.tsx`) [PROD]
- D10 Rattachement à une sortie vérifiée (migration `20261115194453_carnet_require_trusted_linked_session.sql`) [PROD]
- D11 Moments forts éditables (`CarnetHighlightEditSheet.tsx`) [PROD]
- D12 Suivi des participants (`CarnetSuivi.tsx`) [PROD]
- D13 Commentaires, j'aime, favoris (tables `carnet_comments`, `carnet_likes`, `carnet_favorites`) [PROD]
- D14 Signalement (`api/carnets/signal`) [PROD]

### E. Communauté, clubs, sorties, stories, messagerie — 30 visibles
- E01 Fil communautaire v2 (`src/features/community/v2`, `NEXT_PUBLIC_COMMUNAUTE_V2=true`) [PROD]
- E02 Création : publication, carnet, club, kit, sortie, story (`v2/create/CreateSheetV2.tsx`) [PROD]
- E03 Explorer la communauté : carnets, clubs, événements, recherche, autour de moi (`v2/explore/panes/*`, `useNearMe.ts`) [PROD]
- E04 Carte de recherche (`v2/explore/details/SearchMap.tsx`) [PROD]
- E05 Fiche club (`/clubs/[id]`, `ClubDetailView.tsx`) [PROD]
- E06 Salons de club (`api/clubs/[id]/salons`) [PROD]
- E07 Défis et classement de club (`api/clubs/[id]/challenges`, `leaderboard`) [PROD]
- E08 Événements de club, invitations, mise en relation (`api/clubs/[id]/events`, `invites`, `matching`) [PROD]
- E09 Fiche sortie (`/sorties/[id]`, `EventTicket.tsx`) : niveau, distance, dénivelé, point de rendez-vous, liste d'attente, consignes de sécurité, cagnotte (colonnes de `events`) [PROD]
- E10 Stories (`post_stories`, `api/stories/[id]/media`) [PROD] ; stories v2 [DRAPEAU `stories_v2`]
- E11 « Meilleurs amis » des stories (`story_close_friends`) [PROD]
- E12 Reels « Freedom » : son, commentaires, partage, kit attaché (`/communaute/reels`, `features/community/reels/*`) [PROD]
- E13 Publication détaillée (`/communaute/post/[id]`) [PROD]
- E14 J'aime, commentaires, enregistrements, reposts (`post_likes`, `post_comments`, `post_saves`, `api/compte/repost`) [PROD]
- E15 Kit joint à une publication et repris (`feed/PostAttachments.tsx` → `/api/materiel/fork`) [PROD]
- E16 Suivre, abonnés, demandes, cordée (`api/compte/reseau/*`) [PROD]
- E17 Bloquer, masquer, signaler, modérer (`api/compte/reseau/{block,mute,content-mute,report,moderation}`) [PROD]
- E18 Profil public (`/profil/[id]`, `PublicProfileV2.tsx`) [PROD]
- E19 Messagerie : conversations et demandes (`/messagerie`, `MessagesScreen.tsx`) [PROD]
- E20 Messages vocaux (`AudioPlayerBubble.tsx`) [PROD]
- E21 Carte GPX dans un message (`GPXPreviewCard.tsx`, `GpxThumb.tsx`) [PROD]
- E22 Kit partagé dans un message (`messaging/components/KitCard.tsx`) [PROD]
- E23 Transfert de message (`ForwardMessageSheet.tsx`) [PROD]
- E24 Réactions (`message_reactions`) [PROD]
- E25 Groupes de discussion et réglages (`GroupSettingsModal.tsx`) [PROD]
- E26 Pièces jointes (`AttachmentDrawer.tsx`) [PROD]
- E27 Écrire à quelqu'un depuis son profil (`PublicProfileV2.tsx` l. 272 → `/messagerie?to=`) [PROD]
- E28 Notifications in-app (`notifications`, `api/badges/unread`) [PROD] ; push web [CLÉ VAPID] ; e-mail [CLÉ `RESEND_API_KEY`]
- E29 Petites annonces matériel entre membres (`features/marketplace`, `MarketplaceBrowser.tsx`) [PROD, à vérifier à l'écran]
- E30 Aperçu partagé par jeton (`/apercu/[token]`) [PROD]

### F. Kit Studio 3D (`/kit-studio`, `/hub?studio=1`, `src/features/kit-studio/`) — 12 visibles
- F01 Scène 3D three.js du sac réel (maillages `.glb` photogrammétriques, `public/assets/bags/`) [PROD, connexion + kit requis]
- F02 5 corps LKDV ONE 15/25/45/60/80 L (`domain/catalog.ts LKDV_ONE_BAG_IDS`) [PROD]
- F03 4 coloris Forêt, Sauge, Pierre, Nuit (`COLORWAYS`) [PROD]
- F04 15 modules 3D publiés (M01–M08, M13, M15–M20) sur ancres auditées (`public/assets/modules/modules.index.json`, `domain/bagAnchorsTable.ts`) [PROD] ; 5 porteurs M09–M12, M14 « Visuel à venir » (désactivés)
- F05 Compatibilité géométrique module ↔ sac (garde de 15 %, `doesModuleFitBagFace`) [PROD]
- F06 Cartes à gestes (`ui/cards/*`, `useCardGestures.ts`) [PROD]
- F07 Bilan poids / volume / équilibre (`ui/sheets/BilanSheet.tsx`, `BalanceChart.tsx`) [PROD]
- F08 Fiche objet (`ItemSheet.tsx`) [PROD]
- F09 Fiche sac (`BagSheet.tsx`) [PROD]
- F10 Deck de rangement par zone (`DeckSheet.tsx`, `domain/packing.ts`) [PROD]
- F11 Précommande (`OrderSheet.tsx`, `OrderButton.tsx`) [PROD — enregistrement d'un corps LKDV ONE refusé, voir § 6]
- F12 Annuler / hors ligne (`UndoButton.tsx`, `ui/offline.ts`) [PROD]

### G. Matériel, kits, lignées, prêts, boutique — 22 visibles
(`/materiel` et `/boutique` sont redirigées vers `/hub` et `/explorer` : `routeRegistry.json`)
- G01 Inventaire de matériel (`features/materiel/components/inventaire`, `api/materiel/items`) [PROD]
- G02 Transitions d'état d'un objet (stock, prêté, en réparation…) (`api/materiel/items/[id]/transition`, `inventory_status_history`) [PROD]
- G03 Kits : création, édition, historique (`api/materiel/kits*`, `KitBuilder.tsx`) [PROD]
- G04 Modèles de kits à reprendre (`TemplateStore.tsx` → `/api/materiel/fork`) [PROD]
- G05 Prêts entre membres (`LoansSlot.tsx`, `LoanCard.tsx`, `api/compte/loans`, `api/materiel/loans/[id]`) [PROD]
- G06 Disponibilité / calendrier du matériel (`components/disponibilite`, `api/materiel/calendar`) [PROD]
- G07 Alertes matériel (péremption, entretien) (`components/alertes`, `api/materiel/alerts/[id]`) [PROD]
- G08 Oublis (`components/forget`, section `oublis` du hub) [PROD]
- G09 Optimisation du poids (`api/materiel/optimize`) [PROD]
- G10 Export et partage d'inventaire (`api/materiel/export`, `share`) [PROD]
- G11 Kilométrage et usure d'un équipement (`GearMileagePanel.tsx`, `WearGauge.tsx`, `api/gear/[id]/mileage`) [PROD]
- G12 Équipement associé à une sortie (`GearAssociationSheet.tsx`) [PROD]
- G13 Fiche kit partagée (`KitSheetModal.tsx`, `api/kits/[id]/sheet`) [PROD]
- G14 Découverte de lignées (`components/kits/LineageDiscovery.tsx`, `api/kits/discovery`) [PROD, aucune lignée en base]
- G15 Débrief terrain du kit (`features/hiking/components/KitDebriefPanel.tsx` → `api/kits/[id]/field-report`) [PROD, 0 rapport en base]
- G16 Mes parts créateur (`api/kits/my-royalties`) [PROD, 0 attribution]
- G17 Catalogue produits dans les sélecteurs (Compas, hub, création de kit) (`ProductPickerSheetV2.tsx`, `KitProductSuggestions.tsx`) [PROD, 67 produits, 14 marques]
- G18 Panier (`/panier`) [PROD]
- G19 Paiement (`/checkout`, `api/checkout`) [CLÉ `STRIPE_SECRET_KEY` absent : refus « Stripe n'est pas configuré »]
- G20 Commandes et annulation (`OrdersPane.tsx`, `api/orders`) [PROD, 104 commandes [DÉMO], 0 session Stripe]
- G21 Fidélité / crédit boutique / récompenses (`api/loyalty/*`, `api/rewards/*`) [PROD partiel]
- G22 Scan d'objet par photo (`api/materiel/scan`, Gemini) [CLÉ `GEMINI_API_KEY`]

### H. Voyage, hub, groupe, budget, documents (`/hub`, `/hub/[section]`) — 24 visibles
36 sections et widgets déclarés dans `src/features/hub/registry/*.ts` ; regroupés en capacités :
- H01 Hub « camp » de l'aventure active (`HubCampShell.tsx`, drapeau `hub_camp_v1` vrai par défaut) [PROD]
- H02 Globe et carte du parcours (`mobile/HubGlobeMap.tsx`, `HubRouteMap.tsx`) [PROD]
- H03 Vue d'ensemble et métriques du voyage (`overview`, `metriques-voyage`) [PROD]
- H04 Itinéraire et étapes (`itinerary`, `points-passage`, `parcours-apercu`) [PROD]
- H05 Points d'eau du parcours (`points-eau`) [PROD]
- H06 Météo randonnée (`meteo-rando`) [PROD]
- H07 Kit et inventaire du voyage (`kit`, `inventaire`, `gear`, `stock-apercu`) [PROD]
- H08 Checklist (`checklist`, `api/trips/[tripId]/checklist/complete`) [PROD]
- H09 Budget et dettes du groupe (`budget`, `dettes-groupe`, `budgetEngine simplifyDebts`) [PROD]
- H10 Documents de voyage privés (`docs`, `trip_documents`, jamais visibles des tiers) [PROD]
- H11 Réservations (`reservations`) [PROD]
- H12 Sécurité (`safety`, `trip_safety_checkpoints`) [PROD]
- H13 Journal (`journal`, `journal-apercu`) [PROD]
- H14 Moments (`mobile/moments`, `MomentMapCard.tsx`) [PROD]
- H15 Groupe, présence, invitations (`groupe`, `presence-groupe`, `invitations`) [PROD]
- H16 Disponibilités des membres (`disponibilite`, `dispo-apercu`) [PROD]
- H17 Alertes du voyage (`alertes`, `alertes-materiel`) [PROD]
- H18 Départ : cockpit du jour du départ (`depart`, `HubDepartSection.tsx`) [PROD]
- H19 Prochain départ (`prochain-depart`) [PROD]
- H20 Export imprimable (`export`) [PROD]
- H21 Voyages liés (`voyages-lies`, nature « collectif ») [PROD]
- H22 Entrée vers le Kit Studio (8 points d'entrée, `StudioHost.tsx`) [PROD]
- H23 « Partir librement » (`HubFreeDepartureEntry.tsx`) [PROD]
- H24 Ambiance sonore et visuelle du camp (`hub/ambience/sound.ts`, `environment.ts`) [PROD]
- Non comptés : natures « possession », « sortie », « collectif » du hub [DRAPEAU `hub_*_enabled` éteints].

### I. Compte, empreinte, progression (`/compte`, `/profil`) — 26 visibles
- I01 Compte « Liquid Glass v8 » à tiroirs (`CompteLiquidGlassV8.tsx`) [PROD]
- I02 Vitrine (`VitrineSlot.tsx`) [PROD]
- I03 Souvenirs par année (`MemoriesSlot.tsx`, `YearFilter.tsx`) [PROD]
- I04 Sorties : trace, météo, tours, photos, participants, commentaires, kudos (`drawer/sortie/*`) [PROD]
- I05 Courbes synchronisées sur la trace (`SynchronizedTraceCurves.tsx`) [PROD]
- I06 Import de trace GPX (`TraceImportDrawer.tsx`) [PROD]
- I07 Activité manuelle (`ManualActivityDrawer.tsx`, `api/activities/manual`) [PROD]
- I08 Visibilité par sortie et en lot (`OutingAudienceSheet.tsx`, `OutingBulkAudienceSheet.tsx`) [PROD]
- I09 Entraînements : séances instantanées, plans, récupération, lecteur de séance (`drawer/workouts/*`) [PROD]
- I10 Progression : missions, passeport, territoire, défis, trophées, sommets (`drawer/progression/ProgressionDrawer.tsx`, `api/progression/*`, `api/rankings/*`) [PROD]
- I11 Badges et tampons (`BadgeTile.tsx`, `StampTile.tsx`) [PROD]
- I12 Moments forts (`HighlightCard.tsx`, `HighlightEditDrawer.tsx`) [PROD]
- I13 Empreinte terrain publique, sceau déterministe (`components/identity/FieldSeal.tsx`, `UserFieldSignature.tsx`) [PROD, privée par défaut, 10 empreintes en base]
- I14 Orientation privée (prior du Compas, annoncée) (`OrientationCard.tsx`) [PROD]
- I15 Carte personnelle (`api/compte/map`, `CompteMapState.tsx`) [PROD]
- I16 Cartes de chaleur personnelle / communautaire + retrait (`api/heatmaps/*`) [PROD]
- I17 Profil sportif (`api/compte/sport-profile`) [PROD]
- I18 Réseau (`ReseauDrawer.tsx`) [PROD]
- I19 Réglages, notifications, consentements, partage du profil (`drawer/compte/*`) [PROD]
- I20 Parcours de première utilisation (`onboarding/FirstRunJourney.tsx`) [PROD]
- I21 Offres (`api/compte/offers`) [PROD]
- I22 Export RGPD des données (`api/account/export`, `api/user/export`) [PROD]
- I23 Montres : appareils, packs hors ligne, champs d'écran (`/compte/montres`, `WatchesHost.tsx`) [PROD, aucune montre réelle]
- I24 Connecteurs (14 marques, § 7) (`/compte/connecteurs`) [PROD en affichage ; [CLÉ] pour toutes]
- I25 Capteurs / santé (`/compte/sensors`) [PROD affichage ; pas de pont natif HealthKit]
- I26 Activités (cycle de vie, corbeille…) (`/compte/activites`) [PROD partiel ; routes `correction`, `crop`, `split` [NON BRANCHÉ]]

### J. Pro, développeurs, administration — 4 visibles
- J01 Page Pro (offres Guide / Agence / Revendeur) (`src/app/pro/page.tsx`) [PROD, page vitrine statique]
- J02 Console développeurs : clés API scopées, webhooks signés (`/developpeurs`, `api/developer/keys`, `webhooks`) [PROD, hors navigation]
- J03 Administration produits et progression (`/admin`, `/admin/produits`, `/admin/progression`) [PROD, réservé]
- J04 Support / tickets (`api/support/tickets`) [PROD]

### K. Plateformes, hors ligne, transverse — 6 visibles
- K01 Application iOS / Android Capacitor (`capacitor.config.ts`, `ios/`, `android/`, appId `com.lekitduvoyageur.app`) [build CI ; pas dans les stores]
- K02 Live Activity / Dynamic Island iOS (`ios/LkdvWidgetsExtension/LkdvLiveActivityWidget.swift`, `explorer-v2/native/liveActivity.ts`) [natif, build requis]
- K03 PWA + service worker (`src/app/sw.js`) [PROD]
- K04 Bandeau hors ligne et cache (`OfflineBanner`, `useOfflineCache`) [PROD]
- K05 Recherche globale (`SearchOverlay`, `GlobalSearchModal.tsx`) [PROD]
- K06 Accessibilité et mentions de sources (`/accessibilite`, `/mentions-legales` + `DataSources.tsx`) [PROD]

### Total
| Domaine | Visibles [PROD] |
|---|---:|
| A Compas | 34 |
| B Explorer | 32 |
| C Suivi / sécurité | 8 |
| D Carnets | 14 |
| E Communauté / messagerie | 30 |
| F Kit Studio | 12 |
| G Matériel / boutique | 22 |
| H Hub / voyage | 24 |
| I Compte | 26 |
| J Pro / dév | 4 |
| K Plateformes | 6 |
| **Total** | **212** |

Code présent mais non visible en production (non compté ci-dessus) : ≈ 60 capacités, dont les 15 connecteurs actifs, Stripe, l'affiliation (5 partenaires), les guides pays (`src/components/pays/*`, **aucune page ne les monte**), Tripadvisor/Viator/Klook (dans ces guides), survol vidéo 3D (`api/media-sharing/flyover`), planification avancée (`api/planning/*`, 12 routes), Terrain Live, prédiction d'itinéraire v2, profil de performance v2, intelligence collective, NWS/ECCC, grands itinéraires/massifs/sites du Compas, langues EN/ES/DE/IT, push web, e-mails, captcha, scan photo.

---

## 2. Les « millions de possibilités » (calculs sourcés)

| # | Combinatoire | Calcul | Résultat | Source |
|---|---|---|---:|---|
| 1 | Réglages d'un voyage dans le Compas (sans la destination) | 17 activités × 60 durées (1–60 j) × 99 tailles de groupe × 3 rythmes × 4 types de nuits × 3 niveaux × 5 terrains | **18 176 400** | `engine/intent.ts` : `COMPAS_ACTIVITIES`, `set_duration max(60)`, `set_party_size max(99)`, `set_pace`, `set_nights`, `set_level`, `set_terrain` |
| 2 | … × lieux habités du référentiel | 18 176 400 × 367 747 | **≈ 6,7 × 10¹²** (6 684 milliards) | `geo_places` en prod : 367 747 lignes, 246 pays (GeoNames) |
| 3 | … × pays seulement | 18 176 400 × 246 | **≈ 4,47 milliards** | `countries_geo` : 246 |
| 4 | Papiers d'entrée réels | 199 passeports × 199 destinations | **39 601** règles | `src/features/compas/data/entryRequirements.meta.json` (`rows: 39601`) |
| 5 | Sacs Kit Studio réellement affichables (maillages publiés) | par corps : (modules compatibles + vide) par ancre → 15 L : 11 ; 25 L : 12 ; 45 L : 16 ; 60 L : 16 ; 80 L : 16 × 16 = 256 ; somme 311 ; × 4 coloris | **1 244** | `modules.index.json` (15 `.glb`), `bagAnchorsTable.ts` (6 ancres, garde 15 %), `COLORWAYS` (4) ; calcul refait par script |
| 6 | Rangement du sac dans le Studio (théorique) | 39 objets × (7 zones + absent) = 8³⁹ | ≈ 1,7 × 10³⁵ | `ItemId` (39) et `PACK_ZONE_IDS` (7) dans `domain/catalog.ts` |
| 7 | Activités suivables dans l'Explorer | 29 sports (9 familles) + 15 modes spécialisés | 44 façons de bouger | `sheet/sportSelection.ts`, `activity/modes/catalog.ts` |
| 8 | Repères de terrain en base (Alpes) | 113 799 POI dont 86 403 points d'eau potable, 7 819 sources, 6 499 abris, 5 819 campings, 4 592 refuges, 2 145 cabanes | 113 799 | `geo_pois` en prod (emprise 43–49° N, 5–17° E) |
| 9 | Sentiers | 1 181 itinéraires, 8 231 km, 16 régions | 1 181 | `hiking_routes` en prod |
| 10 | Massifs | 774 (FR, CH, IT, AT) | 774 | `geo_massifs` en prod |

À dire honnêtement :
- Les lignes 1 à 3 sont des **combinaisons de réglages acceptées** par le moteur, pas des voyages pré-calculés. Le moteur calcule un itinéraire réel pour chacune, sur les lieux de la zone : c'est ce qui rend le chiffre défendable.
- La ligne 5 est le **vrai** chiffre du Kit Studio aujourd'hui : **1 244 sacs**, pas des millions. Les « millions » du Studio n'existent qu'avec le rangement (ligne 6), qui est théorique.
- Les lignes 8 à 10 sont en base, mais `geo_pois` n'est lu par le Compas que si `COMPAS_GEO_POIS` est allumé (éteint en production). Les sentiers couvrent surtout les Hauts-de-France et les Alpes, pas le monde.

**Phrase défendable pour le film** : « Plus de 18 millions de façons de régler une aventure, sur 367 000 lieux dans 246 pays. »

---

## 3. Chiffres clés réels (production, 17/11/2026)

### À afficher sans réserve (référentiels réels)
| Chiffre | Source |
|---:|---|
| **367 747** lieux habités (villes 5 938, bourgs 35 938, villages 200 234, hameaux 125 637) | `geo_places` |
| **246** pays et territoires | `countries_geo`, `geo_places.country_code` |
| **113 799** repères de montagne, dont **86 403** points d'eau potable et **4 592** refuges gardés | `geo_pois` |
| **39 601** règles d'entrée (passeport × pays) | `entryRequirements.json` |
| **3 244** aéroports | `src/features/compas/data/airports.json` |
| **1 181** sentiers, **8 231 km** | `hiking_routes` |
| **774** massifs | `geo_massifs` |
| **253** fiches pratiques pays | `country_practical` |
| **228** pays : prises et tension ; **246** : devises | `mainsElectricity.json`, `countryCurrencies.json` |
| **365** tables, **913** règles de sécurité RLS | catalogue Postgres |
| **371** routes API, **160** actions serveur, **45** pages | dépôt |
| **14** marques de montres et d'applis sport prévues | `src/features/connectors/registry.ts` |
| **20** modules de sac (15 en 3D), **5** corps, **4** coloris | `modules.index.json`, `catalog.ts` |
| **29** sports, **17** types d'aventure | `sportSelection.ts`, `intent.ts` |

### À NE PAS afficher comme traction (données de démonstration ou quasi vides)
| Table | Valeur | Pourquoi |
|---|---:|---|
| comptes (`auth.users`) | 86, dont 54 adresses de démo/test ; 7 connexions sur 30 jours | pas d'usage public |
| carnets | 86 (tous publics) | comptes de démo |
| publications / stories | 253 / 206 | idem |
| clubs / sorties (`events`) | 38 / 37 | idem |
| voyages (`trips`) | 64 (48 « terminés ») | idem |
| sessions de randonnée | 141 | idem |
| commandes | 104 « payées / livrées », **0** session Stripe | factices |
| kits | 99 ; **0** reprise (`forked_from`), génération max **0** ; `kit_forks` 0 ; `kit_field_reports` 0 | la lignée n'a jamais servi en production |
| produits | 67, 14 marques (dont « BigBuy Beauty », « Nivea », « Intex ») | catalogue de test, marques hors outdoor |
| affiliation | 5 partenaires, 0 programme, 0 clic | non actif |
| préparations Compas | 1 104 événements (`ops_preparation_events`) | surtout des bancs de test |

---

## 4. Les 15 fonctionnalités les plus fortes pour un investisseur

| # | Fonctionnalité | Où | En prod ? | Comment la filmer |
|---|---|---|---|---|
| 1 | **Une phrase → une aventure complète** (lieu, jours, nuits, kit, budget) | `/compas`, `engine/intent.ts`, `compasCreateTripAction` | Oui (essai anonyme 5/h/IP) | Écran de départ vide ; taper « 6 jours de bivouac dans le Vercors à 4 » ; couper sur la carte qui se remplit |
| 2 | **Préparation visible** : l'îlot raconte chaque étape du calcul | `v5/Island.tsx`, `CompasPrep.tsx` | Oui | Plan serré sur l'îlot pendant 3 s |
| 3 | **Carte vivante** : tracé par jour, nuits en photos Commons créditées | `v5/map/LiveMap.tsx`, `compasV5ExtrasAction` | Oui (Overpass parfois absent : refaire la prise) | Glisser d'un jour à l'autre ; ouvrir une nuit |
| 4 | **Papiers d'entrée, prises, alertes officielles, risques en 3 barres** | tiroir Vérifications `v5/drawers/verifs.tsx`, `riskBars.ts`, `MeteoalarmNotice.tsx` | Oui | Ouvrir « Vérifications » sur un voyage hors UE (ex. Géorgie) |
| 5 | **Budget sourcé** (carburant, péages, repas, devises) | tiroir Budget, `costs.ts`, `fuel.ts`, `tolls.ts`, `icp.ts` | Oui | Ouvrir Budget ; montrer une ligne et sa source |
| 6 | **Sentier mythique compris** (GR20 sud, TMB) : étapes vérifiées sur la carte | `isNamedTrail`, `trailDestination.ts` | Oui (IA allumée) | Taper « GR20 sud en 5 jours » |
| 7 | **Globe → pays → région → sentier en 3D** | `/explorer`, `map/MapStage.tsx` | Oui | Zoom continu du globe jusqu'à un sentier alpin avec relief |
| 8 | **Suivi d'activité** : allure ajustée à la pente, hors-piste, guidage | `activity/*`, `guidance/*` | Oui | Démarrer une rando (compte à rebours), montrer les métriques |
| 9 | **Balise + lien invité** : un proche suit en direct sans compte | `ExplorerLiveTrackingPanel.tsx` → `/live/[token]` | Oui | Écran partagé : randonneur à gauche, proche à droite |
| 10 | **SOS** avec compte à rebours et numéro d'urgence du pays | `chrome/SosButton.tsx`, `sosCall.ts` | Oui — **appelle vraiment** en prod | Filmer en local ou avec `window.__xpSimulateSos = true` (voir § 6) |
| 11 | **Kit Studio 3D** : vrai sac photogrammétrique, modules qui se clipsent, bilan poids | `/kit-studio`, `/hub?studio=1` | Oui (connexion + kit) | Tourner le sac au doigt ; ajouter M05 « Grande poche cargo » sur le 60 L ; changer Forêt → Nuit |
| 12 | **Carnet avec verdicts d'objets** (« jamais servi », « défaillant ») et « Reprendre le kit » | `/carnets/[id]`, `CarnetDrawerV2.tsx` | Oui | Ouvrir la lentille Verdicts, puis appuyer « Reprendre le kit » |
| 13 | **Bouteille à la mer** : trouver des compagnons de route, avec seuil de confiance | `server/bottleActions.ts`, tiroir Nous | Oui | Lancer l'annonce depuis « Nous » |
| 14 | **Hub camp** : l'aventure active réunit itinéraire, kit, budget, groupe, papiers | `/hub`, `HubCampShell.tsx`, 36 sections | Oui | Balayer le carrousel de sections |
| 15 | **Messagerie qui partage une trace GPX ou un kit** | `/messagerie`, `GPXPreviewCard.tsx`, `KitCard.tsx` | Oui | Envoyer un GPX : la mini-carte apparaît dans la bulle |

En réserve (fort mais à filmer avec précaution) : reels « Freedom » avec kit attaché (`/communaute/reels`) ; carte musculaire de musculation (`strength/MuscleMapSvg.tsx`) ; Dynamic Island iOS (build natif requis) ; empreinte terrain « sceau » (`FieldSeal.tsx`, 10 empreintes seulement).

---

## 5. Le parcours utilisateur le plus riche (liens vérifiés)

| Étape | Lien vers l'étape suivante | Existe ? | Preuve |
|---|---|---|---|
| 1. Fil Communauté : une publication | publication → carnet | **Oui** | `features/community/sections/CarnetTile.tsx:29` (`/carnets/${id}`), `card/explore/ExplorerCard.tsx:47` |
| 2. Carnet d'un autre voyageur | « Refaire ce voyage » → Compas prérempli | **Non** | aucun bouton ; seul `components/carnet/profile/panes/CarnetKitPane.tsx:48` pointe vers `/compas` sans préremplissage |
| 2 bis. Carnet | « Reprendre le kit » → mon sac | **Oui** | `CarnetDrawerV2.tsx:1170` → `useKitFork` → table `kit_forks` (0 ligne en prod) |
| 3. Compas | phrase → voyage créé (`trips`) | **Oui** | `compasCreateTripAction` |
| 4. Compas → Hub | menu « Plus » → hub du groupe ; le hub lit l'aventure active | **Oui** | `v5/drawers/menu.tsx:68` (`/hub/groupe`), `HubCampShell.tsx` |
| 4 bis. Hub → Compas | « Préparer » | **Oui** | `hubSectionRegistry.ts:156` (`/compas?nouvelle=1`) ; section `preparation` → `/compas?etape=kit` |
| 5. Compas Kit → produit | « Fiche produit » | **Partiel** | `CompasSheets.tsx:339, 454` : le lien mène à `/explorer`, pas à une fiche (les fiches produit sont supprimées) |
| 6. Hub → Kit Studio | `?studio=1`, 8 points d'entrée | **Oui** | `features/hub/components/StudioHost.tsx` |
| 7. Kit Studio → commande | précommande | **Partiel** | `OrderSheet.tsx` ; enregistrement refusé pour les corps LKDV ONE (§ 6) ; Stripe absent |
| 8. Hub → départ → Explorer | itinéraire → « démarrer » | **Oui** | `hub/components/mobile/itinerary/ItineraryMobileExperience.tsx:755` (`/explorer?stage=1`) |
| 9. Explorer → suivi en direct | balise → lien invité | **Oui** | `ExplorerLiveTrackingPanel.tsx:152` (positions), `src/app/live/[token]/page.tsx` |
| 10. Explorer → SOS | bouton SOS | **Oui** | `explorer-v2/chrome/SosButton.tsx` |
| 11. En route → carnet | photo pendant l'activité → carnet | **Partiel** | `sheet/LiveMediaCapture.tsx` garde les médias en mémoire locale ; pas d'envoi direct au carnet |
| 12. Après → carnet publié | création de carnet rattaché à la sortie | **Oui** | `v2/create/CreateSheetV2.tsx` (type carnet), migration `20261115194453_carnet_require_trusted_linked_session.sql` |
| 13. → Bouteille à la mer | depuis le Compas (pas depuis le carnet) | **Oui** | `server/bottleActions.ts` |
| 14. → club / sortie / story | création | **Oui** | `CreateSheetV2.tsx:322-324` (`/clubs/${slug}`, `/sorties/${id}`), `v2/create/story` |
| 15. → messagerie | profil → « Écrire » | **Oui** | `PublicProfileV2.tsx:272` (`/messagerie?to=`) |
| 16. Quelqu'un reprend le kit par une lignée | publication avec kit → reprise | **Oui (code)** | `feed/PostAttachments.tsx:49` → `/api/materiel/fork` ; trigger `handle_kit_lineage` ; **0 reprise et génération max 0 en prod** : à créer avant le tournage |

**Parcours recommandé (réel de bout en bout)** : publication → carnet → « Reprendre le kit » → Compas (une phrase) → hub camp → Kit Studio → départ dans l'Explorer → lien de suivi en direct → carnet publié → messagerie. Les maillons 2, 5, 7 et 11 sont à éviter ou à monter comme une coupe franche.

---

## 6. Limites et défauts à ne pas montrer

| Sujet | Constat | Preuve |
|---|---|---|
| Kit Studio : enregistrement | Le catalogue de la base ne connaît que `chassis`, `corps:b28`, `corps:b42` et 6 modules hérités ; **aucun corps `lkdv-one-*`** : `saveBagConfig` répond « pièce inconnue du catalogue » | `one_pieces` en prod (9 lignes) ; `src/features/kit-studio/server/studioService.ts:64` ; le schéma `studioSchemas.ts:18` n'accepte pas non plus les codes M01–M20 |
| Kit Studio : porteurs | M09 tente, M10 matelas, M11 sac de couchage, M12 casque, M14 skis : « Visuel à venir », désactivés | `modules.index.json` (`origin: procedural`), `ui/cards/cardsData.ts:152` |
| Paiement | `STRIPE_SECRET_KEY` absente : le paiement répond « Stripe n'est pas configuré » | `src/app/api/checkout/route.ts:153-156`, variables Vercel |
| Commandes, comptes, carnets, clubs | données de démonstration (§ 3) | base de production |
| Catalogue produits | 67 produits, marques hors sujet (« BigBuy Beauty », « Nivea », « Francodex », « Intex ») | `products` |
| Lignées de kits | aucune génération, aucune reprise, aucun rapport terrain en prod | `materiel_kits.generation` max 0 ; `kit_forks`, `kit_field_reports` vides |
| Connecteurs montres / sport | les 15 sont en `credentials_missing` : « Identifiants partenaires absents… repli manuel GPX/FIT » | `registry.ts:741-761` ; aucune variable `*_CLIENT_ID` sur Vercel |
| SOS | en production le compte à rebours **ouvre le composeur** vers le 112 (ou numéro du pays) | `sosCall.ts` ; filmer en local ou avec `window.__xpSimulateSos = true` |
| Scènes de démonstration de l'Explorer (`?scene=lac-blanc`…) | désactivées en production | `state/scenes.ts:323-335` (`NEXT_PUBLIC_EXPLORER_SCENES`) |
| Lien « fiche produit » | mène à `/explorer`, pas au produit | `CompasSheets.tsx:339, 454` |
| Guides pays, Tripadvisor, Klook, Viator, bouteille à la mer de la page pays | code orphelin : aucune page ne monte `src/components/pays/*` | `grep "@/components/pays/"` hors du dossier : 0 |
| Langues | production en français seulement | `src/lib/i18n/locale.ts` (drapeaux `NEXT_PUBLIC_I18N_*_ENABLED` absents) |
| Drapeaux éteints | `terrain_live`, `stories_v2`, `collective_intelligence`, `route_prediction_v2`, `performance_profile_v2`, `local_leaderboard_active`, `hub_possession/sortie/collectif_enabled`, `coverage_publication_enabled` | table `public.feature_flags` |
| Référentiels du Compas | grands itinéraires, massifs, parcs, sites, POI, recherche `geo_places` : éteints | `COMPAS_GEO_*` absents sur Vercel |
| Overpass | expire souvent : nuits « indisponibles » | `docs/compas/ETAT.md` (23 oct.) |
| Bancs Compas | 86,4 % des contrôles vérifiés ; constats ouverts (C-006 pays d'un massif transfrontalier, russe et chinois partiels) | `docs/compas/phase7/COUVERTURE.md`, `CONSTATS.md` |
| Notifications | push web et e-mail sans clé (`VAPID_*`, `RESEND_API_KEY`) ; captcha absent | variables Vercel |
| Tâches planifiées | `CRON_SECRET` absent : `/api/cron/daily` refusé | `src/lib/cron/auth.ts`, `vercel.json` |
| Page Pro | tarifs (29 / 89 / 149 €/mois) affichés sans offre branchée | `src/app/pro/page.tsx` |
| Open-Meteo | utilisé pour la météo des sorties du compte ; l'API gratuite est réservée à l'usage non commercial (à vérifier avant de le montrer ou de le créditer) | `src/features/compte/server/weather.ts:121-125` |
| Mobile | pas d'application dans les stores (comptes Apple/Google en attente) | `CLAUDE.md` § 1.8, `docs/kit-studio/JOURNAL.md` (IPA non signée) |
| Plateforme | `cloudflare.config.ts` et `@vinext/cloudflare` présents malgré la règle « Vercel uniquement » | racine du dépôt, `package.json` |

---

## 7. Marques et services tiers réellement intégrés (pour les logos)

**Avertissement pour le film** : un logo de marque laisse croire à un partenariat. Seuls les services marqués **Actif** sont réellement appelés en production. Les connecteurs montres et sport n'ont **aucun identifiant partenaire** : afficher leurs logos comme « intégrés » serait faux, et Garmin, Strava ou Apple encadrent l'usage de leurs logos (« Works with… », « Compatible with… ») à des programmes validés. Pour les données ouvertes (OSM, MET Norway, NASA…), la licence exige une attribution, pas un logo.

### Montres, sport, santé — code présent, **aucun actif en production**
Fichier de preuve commun : `src/features/connectors/registry.ts` (variables requises l. 30-388) ; écran `/compte/connecteurs` ; état calculé l. 741-761 (`credentials_missing`).
| Marque | Variables requises | État prod |
|---|---|---|
| Garmin (Connect + Connect IQ) | `GARMIN_CLIENT_ID`, `GARMIN_CLIENT_SECRET`, `GARMIN_WEBHOOK_SECRET`, `GARMIN_CONNECT_IQ_APP_ID` | [CLÉ] |
| Wahoo | `WAHOO_*` | [CLÉ] |
| COROS | `COROS_*` | [CLÉ] |
| Suunto | `SUUNTO_*` | [CLÉ] |
| Polar | `POLAR_*` | [CLÉ] |
| Hammerhead | `HAMMERHEAD_*` | [CLÉ] |
| Bosch eBike | `BOSCH_EBIKE_*` | [CLÉ] |
| Apple Watch (WorkoutKit) | `APPLE_WORKOUTKIT_BRIDGE_ENABLED` | [DRAPEAU] ; aucun pont HealthKit/WorkoutKit dans `ios/` |
| Samsung Health | `SAMSUNG_HEALTH_*` | [CLÉ] |
| Zwift | `ZWIFT_*` | [CLÉ] |
| Peloton | `PELOTON_*` | [CLÉ] |
| TrainerRoad | `TRAINERROAD_*` | [CLÉ] |
| Rouvy | `ROUVY_*` | [CLÉ] |
| Strava | `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_WEBHOOK_VERIFY_TOKEN` | [CLÉ] |
| Apple Health / Health Connect | `api/sensors/health/*` | [NON BRANCHÉ] côté natif |
| Spotify (contrôle audio d'activité) | `NEXT_PUBLIC_SPOTIFY_CLIENT_ID`, `features/gear/audio/ActivityAudioControl.tsx` | [CLÉ] |

### Cartes, lieux, itinéraires
| Service | Fichier de preuve | État prod |
|---|---|---|
| OpenStreetMap (données) | `DataSources.tsx` l. 50-72 ; Overpass `api/explorer/v2/surfaces/route.ts` | **Actif** (attribution) |
| Photon (Komoot) — géocodage | `features/adventure-prep/geocodeService.ts` (`photon.komoot.io`) | **Actif** |
| Nominatim (OSM) | `geocodeService.ts` | **Actif** (secours) |
| OpenFreeMap / OpenMapTiles | `components/map/engine/standardBase.ts`, `explorer-v2/map/MapStage.tsx:250` | **Actif** dans l'Explorer ; dans les autres cartes derrière `NEXT_PUBLIC_MAP_STANDARD` (défaut ArcGIS) |
| Esri / ArcGIS (World Imagery, World Topo, public) | `components/map/engine/createMapStyle.ts:71,91` ; `MapStage.tsx:392` | **Actif** sans clé (« Powered by Esri ») ; offre ArcGIS Location Platform [CLÉ `NEXT_PUBLIC_ARCGIS_API_KEY`] |
| AWS Terrain Tiles (relief) | `explorer-v2/geo/dem.ts` | **Actif** |
| Natural Earth, Wikidata | `DataSources.tsx` l. 66, 74 | **Actif** (Explorer) |
| Wikimedia Commons (photos des nuits, auteur + licence) | `compasV5ExtrasAction`, `api/explorer/osm/route/[id]` | **Actif** |
| GeoNames (367 747 lieux) | `DataSources.tsx` l. 91 ; `geo_places` | **Actif** |
| OurAirports (3 244) | `data/airports.meta.json` | **Actif** |
| Valhalla FOSSGIS, BRouter — itinéraires | `features/adventure-prep/routingService.ts:86`, `api/route/cache/route.ts` | **Actif** sans clé |
| Geoapify — itinéraires et recherche | `routingService.ts:48`, `server/geoapify.ts` | [CLÉ `GEOAPIFY_API_KEY`] |
| LocationIQ | `server/locationIq.ts` | [CLÉ `LOCATIONIQ_API_KEY`] |
| IGN (Plan IGN v2) | `explorer-v2/map/nationalTopo.ts` | **Actif** (à confirmer à l'écran) |
| Thunderforest | `MapStage.tsx` | [CLÉ] |

### Météo, alertes, données pays
| Service | Fichier de preuve | État prod |
|---|---|---|
| MET Norway (CC BY 4.0) | `api/explorer/v2/weather/route.ts`, `compas/engine/metno.ts` | **Actif** |
| NASA POWER | `compas/server/weather.ts` | **Actif** |
| EUMETNET MeteoAlarm | `compas/components/MeteoalarmNotice.tsx`, `engine/meteoalarmFeeds.ts` | **Actif** |
| NOAA National Weather Service, Environnement Canada | `compas/components/WorldAlertNotice.tsx` | [DRAPEAU `COMPAS_ALERTS_WORLD`] |
| NASA FIRMS (incendies) | `api/explorer/v2/fires` | [CLÉ `NASA_FIRMS_MAP_KEY`] |
| Open-Meteo | `features/compte/server/weather.ts` | **Actif** (licence à vérifier) |
| TravelRequirements.info (papiers d'entrée) | `data/entryRequirements.meta.json` | **Actif** (données embarquées) |
| Frankfurter / BCE, currency-api | `DataSources.tsx` l. 180-187 | **Actif** |
| Commission européenne — Weekly Oil Bulletin | `data/fuelPrices.json` | **Actif** (embarqué) |
| Banque mondiale — ICP 2021 | `data/icpPriceLevels.json` | **Actif** (embarqué) |
| France Diplomatie | `api/pays/[code]/route.ts` | [NON BRANCHÉ] (guides pays orphelins) |

### IA
| Service | Fichier de preuve | État prod |
|---|---|---|
| NVIDIA NIM (Nemotron) | `src/lib/ai/providers/nvidia.ts` ; `NVIDIA_API_KEY` présent | **Actif** |
| Google Gemini (scan photo) | `api/materiel/scan/route.ts` | [CLÉ] |
| OpenRouter | variable `OPENROUTER_API_KEY` présente | non utilisé dans l'app (décision du 07/10, `CLAUDE.md`) |

### Paiement, réservation, affiliation
| Service | Fichier de preuve | État prod |
|---|---|---|
| Stripe | `api/checkout/route.ts`, `api/stripe/webhook`, dépendance `stripe@^17.7.0` | [CLÉ] — inactif |
| Booking.com, Aviasales/WayAway, GetYourGuide, Airalo, Chapka Assurances | table `affiliate_partners` (5 lignes) ; `features/affiliation/` ; `/go/[slug]` | inactif (0 programme, 0 clic) |
| Travelpayouts | `api/affiliate/travelpayouts` | [NON BRANCHÉ] |
| Tripadvisor (Content API, Terra) | `features/discovery/providers/tripadvisor*` ; clés présentes | [NON BRANCHÉ] (écrans pays orphelins) |
| Viator, Klook | `features/discovery/providers/viator`, `KlookCtaBlock.tsx` | [CLÉ] / [NON BRANCHÉ] |

### Plateformes et briques
| Service | Fichier de preuve | État prod |
|---|---|---|
| Vercel (hébergement) | projet `kitduvoyageur-1783951966810` | **Actif** |
| Supabase (PostgreSQL + PostGIS, Auth, RLS) | `@supabase/supabase-js`, projet `icxyvwzfjbflcbqukpfz` | **Actif** |
| Apple iOS / Google Android via Capacitor 8 | `capacitor.config.ts`, `ios/`, `android/`, Live Activity `ios/LkdvWidgetsExtension/` | builds CI, **pas publiés** dans les stores |
| MapLibre GL, Leaflet, three.js | `package.json` | **Actif** (logos libres, optionnels) |
| hCaptcha, Resend (e-mail), Web Push | `app/connexion/page.tsx`, `api/notifications/process` | [CLÉ] |

Logos défendables à l'écran pour « données et briques réelles » : **OpenStreetMap, MET Norway, NASA, MeteoAlarm, Esri, OpenFreeMap, GeoNames, Wikimedia Commons, NVIDIA, Supabase, Vercel**. À ne pas afficher comme intégrations : Garmin, Strava, Suunto, Polar, Wahoo, COROS, Apple Health, Stripe, Booking.com, GetYourGuide, Tripadvisor.
