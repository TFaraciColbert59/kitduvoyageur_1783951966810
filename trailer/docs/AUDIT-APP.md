# AUDIT-APP — le trailer 60 s face à l'app réelle

Audit en lecture seule, 2026-11-10. APP = `/home/user/kitduvoyageur_1783951966810`. Verdicts : EXISTE / PARTIEL / ABSENT. Les chemins sont relatifs à APP.

Constat d'ensemble : le CLAUDE.md décrit une BottomTabBar « Accueil · Explorer · Boutique… » et un cockpit `/randonnee-active`. Le code a changé (registre à 5 destinations, route cockpit absente). Les preuves ci-dessous font foi.

## 1. Tableau des verdicts

| # | Élément | Verdict | Preuve | Ce que l'app montre vraiment |
|---|---|---|---|---|
| 1 | Voyage par une phrase (Compas) | EXISTE | `src/app/compas/page.tsx:10-11,57` (v5 par défaut) ; `src/features/compas/v5/V5Start.tsx:88-93` ; `src/lib/i18n/translations/compas-v5.fr.ts:673-686` | Titre « Où veux-tu aller ? », champ d'une phrase (placeholder « Le Vercors, 3 jours à 4 »), bouton rond flèche droite (`V5Icon right`, libellé « C'est parti »), 3 idées en puces (pictos people, person, peak). Pas de pilule IA ni d'avatar « L » dans la barre. Ancien écran : bouton `sparkles`. |
| 1b | Préparation visible (`CompasPrep` / îlot) | PARTIEL | `src/features/compas/v5/Island.tsx:43-110` ; `compas-v5.fr.ts:657-672` ; `src/features/compas/components/CompasPrep.tsx:14-23` | Îlot dynamique à 3 phases : « Je lis ta phrase… » (15 %), « Je trace l'itinéraire… » (45 %), « Nuits, trajet, sac et budget… » (78 %), puis « Ton aventure est prête » + bouton Voir. Spinner et pourcentage seuls, aucune brique cochée une à une. Ancien `CompasPrep` : 4 lignes à puces cochées (`Icon check`). Pas de météo dans la préparation. |
| 2 | Hub du groupe | PARTIEL | `src/app/hub/[section]/page.tsx` ; `src/lib/hub/hubRedirects.ts:29-33` (`/groupes` vers `/hub/groupe`) ; `src/features/hub/components/HubOverviewCollectif.tsx:36-52` ; `src/features/hub/components/CampMap.tsx` | Route `/hub` et `/hub/groupe`. Hero du groupe (titre, « N membre(s) », invitations en attente), 3 cartes Groupe / Invitations / Voyages liés (icônes lucide Users, MailPlus, Map), carte MapLibre « Camp de base ». Aucun anneau de progression, aucune rangée d'avatars. |
| 3 | Bouteille à la mer | EXISTE | `src/components/pays/BouteilleALaMer.tsx:21,456-489,585-627` ; montée dans `src/components/pays/PaysCommunauteView.tsx:33` et `MobileCountryDetailView.tsx:522` ; version Compas `src/features/compas/server/bottleActions.ts:11-25` | Carte verte « Bouteille à la mer » avec pastille ambre pulsante, titre « Partez en {pays} avec d'autres voyageurs », bouton « Lancer bouteille à la mer » (icône message-square), liste « Les bouteilles retrouvées dans la mer (N) » (2 max). Seuil de confiance : 65 pour lancer, 50 plancher, affichés « /100 ». Pas de dessin de bouteille ni de globe animé. Table `travel_groups` (visibility public), `group_members`. |
| 4a | Profil appris par personne | PARTIEL | `src/features/compas/engine/compasModel.ts:120-134,228-242` ; `src/features/compas/server/traveller.ts:20-21` ; `src/features/identity/orientation.ts:1-30` | Profil de membre appris : charge max (kg), allure à plat (km/h), niveau d'expérience, provenance `learned/estimated/average`. Orientation privée : terrain, autonomie, priorité, expérience (`user_orientation`, prérempli et annoncé). Pas de taille de vêtement, pas de « dort mal au froid », pas de régime alimentaire (cherché : aucun champ). |
| 4b | « Kits éprouvés » / « gardé par X voyageurs sur 10 » | PARTIEL | `src/components/kits/ProductLineageCard.tsx:15,42` ; `src/components/kits/LineageDiscovery.tsx:29` ; `src/app/api/kits/discovery/route.ts:11` | Phrase exacte « gardé par N voyageur(s) sur 10 » dans un encart « présent dans N lignées ». Ces deux composants ne sont importés nulle part ailleurs (code non monté). La fiche kit du Kit Studio montre « Lignée » (`kit-studio/ui/strings.ts:~140`). Pas de « 10 petits points dont 8 pleins » vérifié. |
| 5 | 4 modes prêt / occasion / location / achat | PARTIEL | `src/features/community/card/create/kit/types.ts:4-10` ; `src/features/compas/engine/acquire.ts:12,17` ; `src/features/compas/v5/model/sac.ts:139-153` ; `src/features/compas/v5/v5.css:443-461` | Quatre modes existent mais dispersés : création de kit communautaire `inventory/achat/location/occasion/pret` ; Compas « Emprunter · Louer · Acheter » (occasion = produit de la boutique, pas un mode). Pastille d'état Compas v5 : « Je l'ai » vert forest (`--v5-good`), « à acheter » ambre (`--v5-amber`), « à emprunter » bleu ciel (`--v5-info`). Kit Studio : « En prêt », « À acheter », « À louer ». Aucune palette unique sage / ambre / bleu / stone par mode. |
| 6a | Prêts entre membres | EXISTE | `supabase/migrations/20260825000000_materiel_rebuild.sql:221-240` (`materiel_loans`) ; `supabase/migrations/20261022104000_loan_pending_and_dispute.sql:5-8` ; `src/components/compte/drawer/cards/LoanCard.tsx:19,71-78` ; `src/components/compte/drawer/slots/LoansSlot.tsx:17` | Onglets Je prête / J'emprunte / Confiance. Statuts : en_attente, en_cours, en_retard, rendu, litige, annule. Actions : accepter, refuser, relancer, rendre, noter, litige. |
| 6b | Double confirmation remise + retour | ABSENT | `supabase/migrations/20261022106000_loan_release_with_new_statuses.sql`, `…104000_loan_pending_and_dispute.sql` | Aucun champ de confirmation prêteur et emprunteur. Seul le consentement de l'emprunteur (en_attente vers en_cours) et un « rendre » à bascule de statut existent. Les « deux téléphones qui se touchent » ne correspondent à aucune fonction (le runtime Compte cite QR + NameDrop pour le profil, pas pour les prêts). |
| 6c | Indice de confiance | PARTIEL | `src/components/compte/overlay/DetailDrawers.tsx:99-110` ; `src/components/compte/drawer/slots/LoansSlot.tsx:130-170` ; `src/components/compte/overlay/compte-overlay.css:75` | Feuille « Indice de confiance » : score « N/100 » (`user_profiles.trust_score`), jauge LINÉAIRE (barre, `trust-detail-gauge`), badge « Profil vérifié / non vérifié », 3 stats : prêts actifs, taux de retour à temps (%), note moyenne /5. Pas d'anneau, pas de « 12 prêts rendus » ni de rangée de coches. Texte « Agrégat de tes prêts, sans classement ». |
| 7 | Points et 4 compétences | PARTIEL | `src/features/progression/server/progressionDto.ts:105-127` ; `docs/progression/2.0/economie.md:58,128,142-158` | 4 axes réels : Explorer (picto `compass`), Se préparer (`shield`), Partager (`book-open`), S'entraider (`heart`). Les chiffres « +25 / +40 / +60 » sont introuvables dans le code et l'économie (recherche `\+(25\|40\|60)`). Les XP sont répartis entre les compétences ; la proposition « Économie 2.0 » ne finance pas de nouvelles émissions (« émission fermée en v1 », `producerHooks.ts:143`). Les pictos du storyboard (sac, plume, poignée de main) ne sont pas ceux de l'app. |
| 8a | Balise satellite (inReach, etc.) | ABSENT | recherche `inreach\|garmin\|balise\|satellite\|bluetooth\|ble` dans `src`, `supabase` | Aucune intégration. Seules occurrences : un objet fictif « Garmin inReach Mini 2 » dans les données de démo `src/hooks/useUserKits.ts:68`, un produit seed `src/app/api/seed/route.ts:356`, des crédits de tuiles Esri/Garmin. |
| 8b | Montre connectée | ABSENT | idem ; `src/features/kit-studio/domain/catalog.ts:1207` | Seulement un objet de catalogue « Montre GPS » (`id: 'watch'`), un équipement du kit. Aucune synchronisation de trace ni de distance. |
| 8c | Batterie partagée au groupe | ABSENT | `src/features/hiking/controllers/HikingController.ts:620` ; `src/features/hiking/components/DesktopTopBar.tsx:11,27,142` ; `src/app/api/adventure/[id]/cockpit/route.ts:32,113` ; `src/app/api/explorer/v2/sos/route.ts:11` | Seule existe la batterie du TÉLÉPHONE (`navigator.getBattery`), envoyée avec le SOS et le cockpit, jamais visible par le groupe. « Batterie 10 000 mAh » est un objet de catalogue Kit Studio (`catalog.ts:1161`, pictogramme `battery`). |
| 9a | Hors ligne : carte | EXISTE | `src/features/explorer-v2/offline/{queue,zone}.ts` ; `src/features/compas/offline/{tilePlan,snapshot,OfflineTrips}.tsx` ; `src/components/mobile-nav/OfflineBanner.tsx:18-19` | Zones hors ligne de l'Explorer, voyage hors ligne du Compas (tuiles plus instantané). Bandeau « Hors ligne — contenu en cache disponible » (picto `wifi-off`). |
| 9b | Positions du groupe en direct | EXISTE | `supabase/migrations/20260913200000_tribu_live_sessions.sql` ; `…210000_tribu_live_positions.sql:10-18` ; `src/features/tribu/components/LiveSharePanel.tsx:28,57,118` ; montée dans `HubGroupeCockpit.tsx:208` | Panneau « Position live » dans le Hub groupe : durées 2 h / 8 h / 24 h, bouton « Partager ma position / Arrêter », texte « N membres sur la carte ». Session explicite, 72 h max, une seule position par membre, aucun historique, lecture réservée aux membres. Rien d'en rapport avec le hors réseau (le partage passe par le réseau mobile). |
| 10 | Cockpit de randonnée | PARTIEL (route absente) | `src/features/hiking/components/HikingCockpitPage.tsx:301-347,400,460` ; aucune `src/app/randonnee-active` ; `HikingCockpitPage` non importé ailleurs ; `/terrain` redirige vers `/hub` (`src/lib/hub/hubRedirects.ts:33`) | Le composant existe (distance « 0.0 KM · +NNNm », D+, prochain POI, bandeau écart / météo, pause / reprise, batterie du téléphone `NN %`). Aucune route ne le monte : `/randonnee-active` n'existe pas. Seuls `MobileNavWrapper.tsx:45` et le hub le citent. À traiter comme non atteignable. |
| 11 | Alerte météo + itinéraire recalculé | PARTIEL | `src/features/compas/components/MeteoalarmNotice.tsx`, `WorldAlertNotice.tsx` ; `src/features/compas/v5/drawers/meteo.tsx` ; `CompasRisks.tsx:7-12` | Alertes officielles et tiroir météo dans le Compas. Aucun recalcul automatique de l'itinéraire (aucun code reroute). Le tracé du lendemain qui se redessine seul est inventé. |
| 12a | Carnet photos + récit | EXISTE | `src/app/carnets/[id]/page.tsx` ; `src/components/carnet/v2/{CarnetScreenV2,CarnetDaySwipeView,CarnetDrawerV2}.tsx` ; tables `carnets`, `carnet_moments` | Carnet par jours (vue swipe), fiche carnet avec tracé sur carte. Pas de texte qui s'écrit tout seul. |
| 12b | Publication au fil + signet | EXISTE | `src/app/communaute/page.tsx` ; `src/features/community/v2/explore/CommunityExploreSheetV2.tsx:498` ; `ExploreIcons.tsx:26-27,107-108` ; `supabase/migrations/20261013080000_social_state_persistence.sql:21` (`post_saves`) | Fil Communauté, barre de stories, action « Enregistrer » avec signet vide puis plein (path `M7 4h10v16l-5-3.5L7 20z`). |
| 13 | Voyageur solo, position à des proches | ABSENT | `LiveSharePanel` (groupe uniquement) | Le partage de position passe par `group_live_sessions` (un groupe et ses membres). Aucun partage à des « proches » hors groupe. Le SOS (`/api/explorer/v2/sos`) envoie position et batterie en urgence, pas un suivi. |
| 14 | Activité courte (footing), pause / reprise | PARTIEL | `HikingCockpitPage.tsx:262-264` ; `src/features/compas/engine/intent.ts` | « Footing » n'est qu'un mot reconnu par le Compas. Pas de mode footing en direct. Pause / reprise existent dans le cockpit non monté. |
| 15 | Clubs, sorties, inscrits | EXISTE | `src/app/clubs/[id]/page.tsx` ; `src/app/sorties/[id]/EventDetailClient.tsx:205,251-265,380` ; `supabase/migrations/20261022111000_club_event_rsvp_members_only.sql` (`club_event_participants`) | Page club (hero, onglets), page sortie « N / max inscrits », bouton « Inscrit ✓ — annuler ». Pas de peloton de 12 avatars cochés. Kilométrage « 42 km » non spécifique. |

## 2. Écrans de la rafale 0:46–0:47 (route et composant)

| Écran du storyboard | Route | Composant | Verdict |
|---|---|---|---|
| Carte des sentiers | `/carte-interactive` et `/explorer` | `src/app/carte-interactive/CarteClient.tsx` ; `src/features/explorer-v2/ExplorerV2.tsx` (`map/MapStage.tsx`) | EXISTE |
| Globe des pays | `/explorer` (niveaux monde 0 à 1) ; fiches `/pays/[code]` | `MapStage.tsx:92,182,483` (`setProjection globe`) ; `src/app/pays/[code]/CountryDetailClient.tsx` | EXISTE (globe MapLibre dans l'Explorer ; la page Pays est une fiche, pas un globe) |
| Capsule d'étapes du Compas | `/compas` | `src/features/compas/engine/compasModel.ts:27-33` : Où (map), Nous (users), Résa (ticket), Verdict (shield-check), Kit (backpack) ; écran v5 `compas/v5/CompasV5Screen.tsx`, tiroirs `v5/drawers` (nous, prevoir, sac, budget, meteo, verifs, day) | EXISTE |
| Fiche d'un objet | `/kit-studio` | `src/features/kit-studio/ui/sheets/ItemSheet.tsx` (champs Poids, Volume, Rangement, État, Sorties ; badges « En prêt », « À acheter », « À louer ») | EXISTE |
| Fil de messages du groupe | `/messagerie` | `src/components/messaging/MessagesScreen.tsx:96-99` (filtres Toutes / Directs / Groupes / Demandes) | EXISTE |
| Sortie de club | `/sorties/[id]` ; `/clubs/[id]` | `EventDetailClient.tsx` ; `ClubFeaturedEventCard.tsx` | EXISTE |
| Profil et « saison » | `/compte`, `/profil/[id]` | `src/components/compte/MobileCompteV2.tsx` ; `CompteLiquidGlassV8.tsx` ; progression `src/components/progression/MaProgressionView.tsx` (saison, niveaux) | PARTIEL (pas d'écran « saison » dédié identifié) |
| Kit en 3D (Kit Studio) | `/kit-studio` | `src/app/kit-studio/page.tsx` ; `KitStudioClient.tsx`. Règle maillages réels : `scene/itemAssets.ts:17` (`ITEM_GLB_BY_ID` vide), modules M09 à M14 « Visuel à venir » (CLAUDE.md) | PARTIEL : seuls les sacs en .glb publiés s'affichent. Aucun objet individuel n'est dessiné en 3D, pas de grille de 38 silhouettes. |

## 3. Navigation mobile (BottomTabBar)

Source : `src/components/mobile-nav/destinationRegistry.ts:40-100` ; rendu `src/components/mobile-nav/FloatingLiquidTabBar.tsx` (barre flottante, icône seule, nom dans `aria-label`).

| Ordre | Libellé FR | `iconName` | Route |
|---|---|---|---|
| 1 | Hub | `home` | `/hub` |
| 2 | Explorer | `compass` | `/explorer` |
| 3 | Communauté | `users` | `/communaute` |
| 4 | Messages | `send` | `/messagerie` |
| 5 | Compte | `user-circle` | `/compte` |

Le storyboard (« Hub · Explorer · Communauté · Messages · Compte ») est correct. Le Compas, `/terrain` et `/pays` n'ont pas d'onglet propre : le Compas est sous Hub, Pays sous Explorer. Pas d'onglet Boutique (le CLAUDE.md est périmé sur ce point). La barre n'affiche pas de texte : le trailer doit montrer des icônes seules.

## 4. Icônes : `public/icons/sf/` (jeu de glyphes à trait fin type lucide)

Fichiers présents (noms seulement) : alert-circle, alert-triangle, archive-restore, archive, arrow-down, arrow-left, arrow-right-left, arrow-right, arrow-up-right, arrow-up, award, backpack, banknote, battery, bed-double, bell-off, bell-ring, bell, bike, book-open, bookmark, building, building2, bus, calendar-check, calendar-days, calendar-plus, calendar, car, check-check, check-circle, check-circle2, check-square, check, chevron-down, chevron-left, chevron-right, chevron-up, chevrons-up-down, circle, clipboard-list, clock, cloud-drizzle, cloud-fog, cloud-lightning, cloud-off, cloud-rain-wind, cloud-rain, cloud-snow, cloud-sun, cloud, coins, compass, copy, credit-card, crown, download, droplet, droplets, edit2, edit3, ellipsis, euro, external-link, eye-off, eye, file-check, file-text, filter, flag, flame, flask-conical, footprints, globe, grip-vertical, hand-coins, handshake, heart-pulse, heart, help-circle, home, image-off, image-plus, info, key-round, layers, leaf, link, lock, log-out, mail-plus, mail, map-pin, map, message-square-plus, message-square, mic, minus, moon-star, moon, more-horizontal, more-vertical, mountain, navigation, package, paperclip, pause, pencil, phone-call, phone, pin, plane, play, plus, printer, radio, recycle, refresh-cw, reply, rotate-ccw, route, scale, search, send, share2, shield-alert, shield-check, shield, ship, shirt, shopping-bag, shopping-cart, siren, smile, sparkles, square, star, sun, sunrise, sunset, tag, tent, thermometer, ticket, train, trash2, trending-down, trending-up, unlock, user-minus, user-plus, user, users, weight, wifi-off, wifi, wind, x-circle, x, zap (plus LICENSE.txt).

| Picto demandé | Fichier le plus proche |
|---|---|
| épingle | `pin.svg` ou `map-pin.svg` |
| van | ABSENT (le plus proche : `car.svg`, `bus.svg`) |
| calendrier | `calendar.svg` ou `calendar-days.svg` |
| personnes / avatars | `users.svg`, `user.svg` |
| envoyer (flèche) | `send.svg` |
| route | `route.svg` |
| météo : soleil / nuage / pluie / vent | `sun.svg` / `cloud.svg` / `cloud-rain.svg` / `wind.svg` (aussi `cloud-sun`, `cloud-snow`) |
| lune | `moon.svg`, `moon-star.svg` |
| sac à dos | `backpack.svg` |
| coche | `check.svg`, `check-circle.svg` |
| flocon | ABSENT (le plus proche : `cloud-snow.svg`) |
| appareil photo | ABSENT (le plus proche : `image-plus.svg`) |
| lever de soleil | `sunrise.svg` |
| pousse / feuille | `leaf.svg` |
| chaussure | ABSENT (le plus proche : `footprints.svg`, empreintes de pas) |
| poignée de main | `handshake.svg` |
| boucle / recyclage (occasion) | `recycle.svg` (`refresh-cw.svg` en secours) |
| étiquette (achat) | `tag.svg` |
| satellite / antenne | ABSENT (le plus proche : `radio.svg`) |
| montre | ABSENT |
| batterie | `battery.svg` |
| réseau barré | `wifi-off.svg` (`cloud-off.svg`) |
| source chaude | ABSENT (le plus proche : `droplets.svg`, `thermometer.svg`) |
| tente | `tent.svg` |
| pagaie / kayak | ABSENT (le plus proche : `ship.svg`) |
| train | `train.svg` |
| accessibilité (fauteuil) | ABSENT |
| signet | `bookmark.svg` |
| bouteille | ABSENT (le plus proche : `droplet.svg`) |
| vélo | `bike.svg` |
| course à pied | ABSENT (le plus proche : `footprints.svg`) |
| boussole | `compass.svg` |
| plume | ABSENT (le plus proche : `pencil.svg`, `edit3.svg`) |
| pause | `pause.svg` |
| lecture | `play.svg` |
| feu | `flame.svg` |

Les pictos du Compas v5 sont un autre jeu (tracés SVG inline, `src/features/compas/v5/ui/icons.tsx`) qui contient entre autres : tent, train, bus, plane, car, bed, stove, jacket, route, hike, peak, sun, rain, snow, wind, cloudsun, drop, thermo, bag, cart, euro.

## 5. À retirer ou remplacer dans le trailer (absent de l'app)

- **Balise satellite** (0:26, 0:33, kit de Nora) : aucune intégration. Retirer le geste de « position partagée hors réseau » ou le cadrer comme vision, avec un carton de démo.
- **Montre connectée** (0:26 « 14,2 km », carnet alimenté par la montre) : absente. Retirer.
- **Batterie visible par le groupe, 82 %** (0:26) : absente. Garder seulement l'objet « batterie 10 000 mAh » comme objet du kit (il existe au catalogue), sans jauge partagée.
- **Hors réseau avec 4 avatars vivants** (0:27) : le partage de position existe (Position live, groupe, 2 h à 24 h) mais passe par le réseau. Remplacer par « carte hors ligne téléchargée » plus bandeau « Hors ligne » (`wifi-off`).
- **Double confirmation remise et retour, deux téléphones qui se touchent** (0:25, 0:44) : absente. Remplacer par une carte de prêt avec statut « En cours » puis « Rendu » et une note.
- **Anneau de confiance rempli à 96, 12 coches, +4 points à 0:44** : l'app montre une jauge linéaire sur 100 avec trois stats. Redessiner en barre, et ne pas montrer de gain de score après retour (le score change, mais l'app ne l'anime pas).
- **Barres de compétences « boussole, sac, plume, poignée de main » avec « +25 / +40 / +60 »** (0:25, 0:38, 0:40, 0:44) : les chiffres n'existent pas. Remplacer par les 4 axes réels (Explorer `compass`, Se préparer `shield`, Partager `book-open`, S'entraider `heart`) sans chiffres de gain.
- **Route du lendemain redessinée toute seule** (0:29) : absent. Montrer une alerte météo (picto vent ambre, `MeteoalarmNotice`) sans recalcul.
- **Cockpit de randonnée en direct, trace live, source chaude, POI** (0:28, 0:38) : le composant n'est pas monté (aucune route). Ne montrer que ce qui est réel (carte, tracé d'un voyage, météo), ou le présenter comme à venir.
- **Footing suivi en direct avec pause puis lecture** (0:36 à 0:38) : pas de mode footing. Remplacer par la carte d'un voyage ou un carnet.
- **Partage de position de Nora à 2 proches** (0:33) : absent (le partage est limité au groupe). Remplacer par « Position live » dans un groupe.
- **Profil appris « flocon, appareil photo, pousse, chaussure », tailles S, M, L, régime** (0:16) : l'app apprend charge max, allure, niveau d'expérience, et préremplit depuis l'orientation. Remplacer par ces trois chips.
- **Pastilles de mode d'acquisition « toujours la même couleur » sage / ambre / bleu / stone** (0:19 à 0:21) : pas de palette unique. Utiliser les teintes d'état du Compas (vert forest, ambre, bleu ciel) ou annoncer la palette comme une licence de design.
- **Bouteille de verre « LKDV » moulée sur un océan** (0:14) : c'est une métaphore (l'app montre une carte et un bouton). Acceptable comme image si le plan suivant montre la vraie carte « Bouteille à la mer ».
- **« 6 / 38 » vers « 38 / 38 » objets, 38 silhouettes** (0:10, 0:18 à 0:21) : aucun écran de ce type. Le Kit Studio n'affiche aucun objet en 3D (`ITEM_GLB_BY_ID` vide) ; utiliser le bilan et les cartes à pictogramme plat.
- **Le carnet qui s'écrit seul** (0:30) : pas de génération visible. Garder le carnet par jours avec photos.
- **Chiffres « 1 322 km », « 9 étapes », « 98 % » du budget, « 88 vers 91 »** : valeurs de démonstration sans équivalent à l'écran.

## 6. À montrer tel quel (existe)

- **Phrase libre dans le Compas** : champ « Où veux-tu aller ? », puces d'idées, bouton rond flèche.
- **Préparation visible dans l'îlot** : « Je lis ta phrase… », « Je trace l'itinéraire… », « Nuits, trajet, sac et budget… », puis « Ton aventure est prête » (pourcentages 15 / 45 / 78).
- **Capsule d'étapes du Compas** : Où, Nous, Résa, Verdict, Kit (pictos map, users, ticket, shield-check, backpack).
- **Hub** : carte « Camp de base », hero du groupe, cartes Groupe / Invitations / Voyages liés, onglets du hub.
- **Position live du groupe** : « Position live », durées 2 h / 8 h / 24 h, « N membres sur la carte ».
- **Bouteille à la mer** : carte sage, pastille ambre, « Lancer bouteille à la mer », « Requis N+ », seuil de confiance sur 100.
- **Prêts entre membres** : cartes Je prête / J'emprunte, statuts, « Indice de confiance » en jauge sur 100.
- **Acquisition** : Compas « Emprunter · Louer · Acheter » ; Kit Studio « En prêt / À acheter / À louer » ; création de kit avec Achat / Location / Occasion / Prêt.
- **Phrase « gardé par N voyageurs sur 10 »** : texte réel de `ProductLineageCard` (à présenter comme texte, le composant n'est pas encore monté).
- **Compétences** : les 4 axes Explorer, Se préparer, Partager, S'entraider avec leurs pictos.
- **Hors ligne** : zones hors ligne de l'Explorer, voyage hors ligne du Compas, bandeau « Hors ligne ».
- **Carnet, fil Communauté, signet « Enregistrer »**, stories.
- **Clubs et sortie de club** : « N / max inscrits », « Inscrit ✓ ».
- **Explorer avec globe** aux niveaux monde, carte interactive, fiche d'un objet, fil de messages (Toutes / Directs / Groupes / Demandes), profil, Kit Studio (sacs en .glb).
- **Barre de navigation** : Hub (home), Explorer (compass), Communauté (users), Messages (send), Compte (user-circle).

## 7. Les 5 écarts les plus importants

1. **Objets connectés (balise, montre, batterie partagée)** : pilier de 0:26 à 0:27 et de la scène de Nora, sans aucune base dans le code. Seule la batterie du téléphone est lue (SOS, cockpit).
2. **Cockpit de randonnée et footing en direct** : le composant existe mais aucune route ne le mène (`/randonnee-active` absent, `/terrain` redirigé). Trace live, pause / lecture, boucle de Tom et marche de 0:28 n'ont pas d'écran atteignable.
3. **Double confirmation des prêts et anneau de confiance** : l'app a un consentement simple et une jauge linéaire sur 100. Le geste « deux téléphones qui se touchent » et l'anneau à 96 sont inventés.
4. **Points « +25 / +40 / +60 » et barres de compétences** : seuls les 4 axes existent, avec d'autres noms et d'autres pictos ; aucun gain chiffré n'est émis ni animé.
5. **Itinéraire recalculé automatiquement après alerte météo** (0:29) et **grille de 38 objets qui s'allume** (0:18 à 0:21) : ni reroute dans le code, ni écran de ce type (Kit Studio sans objets en 3D, pastilles d'acquisition sans palette unique).
