# Préparateur `/compas` — état (source de vérité unique)

> Une seule ligne droite : demande libre → compréhension → lieu → itinéraire → données →
> kit / budget / conseils → résultat final. Rien de P3 tant que P0/P1 ne passent pas P2.
> « Fait » = prouvé de bout en bout sur la preview et contrôlé en base, pas « le code compile ».

Mis à jour : 10 octobre 2026. **En production** (koosmoweb.fr) : lot A (PR #76,
sécurité), lot B (PR #77, clés gratuites), lot C (PR #78, `195a47f` : rapport quotidien,
sauvegarde, purges), lot D (PR #79, `153ddfc` : routage Geoapify puis Valhalla, estimation
annoncée, OSRM démo et BRouter retirés), lots E et F (PR #80, `f5b5ac9` : référentiel des
lieux habités ; interrupteur et plafond IA, crédits Geoapify comptés en base, rythme
Photon, position arrondie). Prouvés en production à 23 h 20 : Bauges, 3 jours, prêt en
48 s, 263 lieux sur 374 tirés du référentiel, distances Geoapify avec dénivelé du relief
(19,5 km et 1 302 m D+), crédits du jour comptés en base. Lot G (PR #81, `cdffeee` :
pages d'erreur honnêtes, droits des fonctions refermés en base, préparation comptée en
heavy). Lots H et I (PR #82, `ee7ae6f` : préparation durable, écritures de `metadata`
sans écrasement, relecture économe, fonctions à Paris, User-Agent du site, change Frankfurter
v2, cache IA d'un jour, politique de confidentialité unique et exacte, clés anti-abus en
HMAC, demande de position expliquée). Prouvés en production le 9 oct. à 4 h 15 :
5 préparations sur 5 (médiane 25 s, contre 35 s à Washington pour les Bauges), aucune
attente ni prise laissée en base, compteurs en empreinte, politique et mentions servies. Constat du 9 oct. :
Overpass private.coffee répond souvent 500 (points autour des étapes dégradés) ; le
référentiel des refuges et points d'eau (3.4) retirera cette dépendance. Plan à 0 € et cases
à cocher : `PLAN-100.md`. Branche de travail `claude/optimistic-albattani-i06ge7`.
Lots J et K (PR #83) : cartes Leaflet sur les fonds ArcGIS avec crédit complet, hors ligne
sans tuiles téléchargées ; demande comprise et conseils essentiels **sans IA** (nombres en
lettres, montants et devises, dates relatives, jours fériés, groupe ; altitude, avalanches,
solo, refuges, bivouac, rivière), suggestions de l'IA dites facultatives. Prouvé sur
l'aperçu le 9 oct. avec `AI_MODE=off` : 6/6 préparées en 15 s, aucun appel IA en base.
Lot L (PR #84, `ba5166e`, plan `docs/superpowers/plans/2026-10-09-compas-lot-l.md`, mené par
sous-agents avec revue de chaque tâche et revue finale) : MET Norway par un seul point
(20 req/s, rien avant `Expires`), limites sur la destination et la phrase, erreurs
serveur du Compas en base sans donnée personnelle (`app_errors`) et alertes du rapport
quotidien, cookies de session `Lax`. Migration appliquée ; le rapport du 8 oct. lève
« plus de 10 % de préparations échouées » (4 sur 11). Prouvé en production le 9 oct. à 13 h 45 : cookie de session `SameSite=Lax; Secure`
après « Essayer sans compte », `/compas` ouvert sans redirection, météo MET servie, aucune erreur
serveur en base ; base à 429,4 Mio.

Lot M (plan `docs/superpowers/plans/2026-10-09-compas-lot-m.md`, PLAN-100 4.7) : « aujourd'hui » au fuseau du navigateur, soleil et départ au fuseau de la destination, hiver selon l'hémisphère, saison sèche des tropiques hors table par les normales NASA POWER. Prouvé sur l'aperçu les 9 et 10 oct. (relu en base) : « demain » dit à 23 h 44 UTC donne le 11 oct. pour un voyageur à Paris et le 10 oct. pour un voyageur à Los Angeles ; Chapada Diamantina (Brésil, absent de la table) → « août, mois le plus sec selon les normales 2001-2020 (NASA POWER) » ; Patagonie → « décembre » (été austral). Fusionné dans la PR #86 avec le lot O (garde réseau des tests unitaires ; contournement de limite corrigé : une préparation en phase `rest` sans itinéraire en attente comptait comme reprise).
Lot N (plan `docs/superpowers/plans/2026-10-09-compas-lot-n.md`, PLAN-100 4.3 et 4.4) : « depuis Lyon » compris et rangé sur le voyage, trajet depuis le départ dit puis la position, jamais la France par défaut (sinon non chiffré, dit à l'écran), vol d'aéroport à aéroport (OurAirports, 3 244 aéroports), journée à plus de 3 h de trajet aller signalée ; tests verts, **prouvé sur l'aperçu le 10 octobre (lu en base, 0 erreur serveur)** : « 3 jours dans le Vercors depuis Lyon » range le départ Lyon (45,76 / 4,83, source « dit ») et garde le Vercors pour destination ; « 5 jours en Sardaigne depuis Lyon » chiffre « vol aller-retour depuis Lyon, LYS → CAG (…), environ 790 km » (180 €) ; « rando 3 jours depuis Grenoble » prépare autour de Grenoble avec la note « Lieu non précisé : préparé autour de Grenoble, ton point de départ » ; « à la journée dans le Mercantour depuis Annecy » signale « 4 h 41 de trajet aller pour une seule journée » ; « 5 jours en Sardaigne » sans position ni « depuis » : aucune ligne de vol, aucun défaut France, note « Point de départ inconnu : écris « depuis Lyon »… ». Noms à préposition (relecture Codex) : « rando 3 jours depuis Bourg en Bresse » range le départ « Bourg-en-Bresse » sans destination parasite, « 5 jours depuis Lyon en Corse » garde départ Lyon et destination Corse (la carte tranche, `settleLinkedOrigin`). **En production** (PR #87, `3b96d58`, alias `kitduvoyageur-1783951966810-ruddy.vercel.app`), relu en base le 10 oct. : « 5 jours en Sardaigne depuis Lyon » → départ Lyon, « vol aller-retour depuis Lyon, LYS → CAG (…), environ 790 km » ; « rando 3 jours depuis Bourg en Bresse » → départ « Bourg-en-Bresse », sans destination parasite ; 0 erreur serveur (`app_errors`).
Lot P (plan `docs/superpowers/plans/2026-10-10-compas-lot-p.md`, PLAN-100 4.1 et 4.3) : profil voyageur privé (`user_traveller` : RLS de la personne seule, aucun droit pour anon, essai sans compte refusé) demandé une fois dans le Compas vide (« Passer » toujours visible) et modifiable dans `/compte/voyageur` ; trajet depuis le domicile du profil après le départ dit et avant la position, sans jamais ranger le nom du domicile sur le voyage ; sans nationalité connue, plus aucune règle « voyageur français » (papiers renvoyés au service officiel du pays, ni France Diplomatie, ni formalités chiffrées, consignes de l'IA neutres) ; verrou de vie privée au build ; tests verts. **Migration `20261010100000_user_traveller.sql` à passer par Tony dans l'éditeur SQL** (le 10 oct., `apply_migration` et tout DDL par le connecteur expirent à 60 s alors que les lectures répondent ; table absente en production, le Compas la traite alors comme « tout inconnu » et la page `/compte/voyageur` dit que le profil ne peut pas être lu), puis sonde `scripts/verify/user_traveller_rls_probe.sql` (attendu : « 16 contrôles passés ») et preuve sur l'aperçu.

Lot Q : accessibilité 5.2 (PLAN-100, WCAG 2.2 AA), dans la PR groupée des lots Q à V : focus piégé dans les tiroirs et rendu au déclencheur, `KitRow` sans bouton dans un bouton, qualité des conditions dite en texte et en forme, pastilles d'alerte des étapes annoncées, texte en rem et lignes qui s'agrandissent, « Annuler » 15 s réglable (8 / 15 / 30 s) et erreurs en `role="alert"`, info-bulles doublées en texte, styles `forced-colors`, axe-core sur l'écran et les 26 parcours de tiroir (zéro violation, jsdom). **Reste ouvert** : test réel VoiceOver et TalkBack (appareils réels), contraste de couleur mesuré dans le navigateur (`npm run test:a11y`), et les noms de glyphes lus par les lecteurs d'écran dans les lignes du Compas (l'`Icon` partagé annonce son nom par défaut ; corrigé seulement sur les étapes).

Lot R : fiabilité 2.2 / 2.6 faits : verdict compté par personne ; clé par adresse = saut ajouté par notre proxy (une seule lecture, test de garde) ; prise de phase rendue sur les sorties anticipées et par « Annuler » ; « Arrêter » relu pendant l'application des réglages. Aucune migration. Limites : sur Vercel la clé par adresse ne se vérifie qu'en production, IPv6 non regroupées par /64.

Lot T : table passeport × destination (travelrequirements.info v1.3.0, CC BY 4.0, 39 601 lignes, 174 Ko, serveur seulement) branchée dans « Papiers » (ligne datée, repli sur les règles) ; « Formalités » chiffrées seulement si visa requis ; ESTA, Vietnam, Rwanda recalés (montant ESTA à reconfirmer sur cbp.gov) ; crédit dans les mentions légales. Reste : prises/change hors France, frais par nationalité, preuve en production.

Lot V : mobile 5.4 / états 5.1 : barre d'état du Compas lisible (thème par route, texte sombre), texte de position iOS honnête et permissions Android minimales verrouillées par test, zones sûres prouvées (chromium 393 × 852 + capture, pas d'iPhone réel), squelette et erreur propres au Compas. Reste : appareil réel (barre, dialogue de permission, VoiceOver, TalkBack) ; `Info.plist` sans `NSCameraUsageDescription` ni `NSPhotoLibraryUsageDescription` : latent (`src/lib/native/camera.ts` n'a aucun appelant aujourd'hui), mais iOS plantera à la première ouverture de la caméra le jour où un écran l'utilise ; à ajouter avec ce premier appelant.

Lot S : kit 4.8 terminé : règles sur les normales NASA POWER (froid, pluie, mousson, chaleur), tropiques (moustiques, eau filtre/pastilles, soleil), altitudes de secours lues sur le relief comme un plancher, sans table de pays ; un conseil de sécurité n'est jamais muet, formulation prudente si l'altitude n'est pas établie.

Lot U : alertes officielles Meteoalarm pour 33 pays d'Europe (service national, heure d'émission, période, texte officiel, lien et avertissement avec chaque alerte), conditions relues le 11 oct. ; attributions Terrain Tiles, GeoNames, Meteoalarm, BCE et « Powered by Geoapify » à l'écran. 4.9 reste partielle : 6 pays à flux vide, zones reconnues par le nom exact, hors Europe non branché. **À faire par Tony** : s'enregistrer comme redistributeur Meteoalarm (meteoalarm@geosphere.at) et demander si le trafic pose problème.

Lot W : budget 4.6 : budget affiché aussi dans la devise du voyageur et du pays (taux, date, source dits ; rien stocké ; ISO 4217 SIX, licence à confirmer) ; carburant UE-27 daté (bulletin UE CC BY 4.0) + estimation à fourchette hors UE ; libellé « indice de prix du pays ». Reste : péages, assurance et repas par région.

Lot X : trajets 4.4 : train par règles (Europe 32 pays, JP, KR, CN, IN, corridors Amtrak/VIA, barème par pays daté 2026-10, tout « estimation ») ; « sans voiture » (phrase, réglage, trajet, bus entre étapes, budget, « transports en commun » seulement si gare lue sinon « non évalué »). Non prouvé en préview/prod.

Lot Y : itinéraire 4.5 : antiméridien (Fidji), espaces sauvages (campings, bivouac calculé entre deux lieux réels, annoncé), paliers d'altitude de couchage à pied (UIAA, prudents), « Mòguru/Mogoro » et « Canal de Beagle » corrigés. Restent ouverts (données ou réseau) : Sardaigne, Kalymnos, lac, TMB, alpinisme sur base, échelle d'un pays sans l'IA.

Relecture indépendante de la PR #90 (Opus, Codex hors quota) : corrigés avant fusion : alertes émises à la même seconde (niveau le plus sévère), outre-mer lu dans le flux France (faux « aucune alerte »), Veille honnête sur le statut et nommant le service, contour illisible = zone non testée ; kit : moustiques d'un tracé qui descend, plafond de conseils de sécurité, altitude « trace » réservée aux vrais tracés ; « Annuler » refuse une préparation vivante ; clé IPv6 = /64 ; **la ligne « Papiers » par nationalité n'est plus rangée sur le voyage** (vie privée). Limites connues : plafond global de l'essai décompté avant le captcha ; dépense « Formalités », ligne « Prises » et conseils de change laissent encore deviner résidence ou nationalité aux collaborateurs ; voyages déjà préparés gardent l'ancienne ligne en base jusqu'à une relance.

Relecture finale (Opus) de la PR #90, corrigée avant fusion : bivouac calculé jamais en dernière étape ni sans pouvoir atteindre le lieu réel, jamais pour une préférence « refuge » (3 nuits de bivouac d'affilée au plus : écart assumé avec la borne « 3 journées de marche »), règle d'acclimatation qui ne compte que les nuits de montée, « sans voiture » qui ne déborde plus sur « auto-stop » ni sur une voiture prise, pas de train vers les îles grecques, dalmates, estoniennes, l'Irlande du Nord, Ceuta et Melilla, le pays du domicile n'est plus nommé dans les bases rangées, une prise ou un `restAt` daté du futur ne bloque plus « Annuler », `readMeteoalarm` transmet son horloge (les tests dépendaient de l'heure). Limites restantes : la planification d'acclimatation compte encore toute nuit > 2 500 m comme montée (une nuit de repos de trop, jamais un faux avertissement) ; conseils IA et ligne « Prises » rangés selon le profil du lanceur ; le prompt de l'IA reçoit « nationalité française » (lot P) ; voyages déjà préparés : rattrapage SQL de données à écrire.

Lot Z1 : vie privée restante du profil voyageur : « Prises », conseils de l'IA (règles et consigne sans profil, nationalité jamais envoyée) et dépense « Formalités » ne dépendent plus du lanceur : seules des lignes neutres sont rangées, chaque lecteur reçoit la sienne à la lecture ; verrou étendu (mutation) ; **SQL de rattrapage des voyages déjà préparés écrit (`supabase/maintenance/lot_z1_vie_privee_rattrapage.sql`), non appliqué : à passer par Tony.** Après relecture de la PR #91 : seules les formalités prévues et intactes sont supprimées (les autres sont neutralisées), l'enveloppe est vidée si besoin, rien du domicile (km, minutes, « à l'étranger ») ne part plus à l'IA ni ne reste dans les textes rangés, et `abroad` n'est plus révélé aux collaborateurs.

Lot Z2 : légal 5.3 : mention IA (démarrage, étapes `aiProposed`, conseils, verdict ; muette si `AI_MODE=off`), divulgation d'affiliation avant les offres d'hébergement, politique de confidentialité relue au code (rien du profil n'est envoyé à l'IA). Identité de l'éditeur : à Tony.

Lot Z3 : infra à 0 € : 1 cron Vercel quotidien (`/api/cron/daily`, 03:00 UTC) enchaîne 13 des 16 routes cron (rotation quotidienne hors vie privée, rien de concurrent après un délai dépassé ; `finalize-kit-attributions` à la main) ; suivi de préparation à intervalle croissant (plus de rafraîchissement fixe toutes les 4 s) ; `maxDuration` ≤ 300 gardé par test. **ACTIF seulement quand Tony crée `CRON_SECRET` dans Vercel (absent le 12 oct. : la route répond 401).** Migration `20261012100000_adventure_events_claim_lease.sql` (bail de 15 min sur la file d'événements RGPD, `consent.revoked` d'abord) à passer par Tony dans l'éditeur SQL.

Lot Z4 : hygiène : CSS sombre du Compas retiré, 3 fichiers formatés, tests d'autorisation réels de `requireEditor` (34 tests ; la RLS est portée à la main, pgTAP reste à faire). Mesure eslint : 45 erreurs, 8 699 avertissements : `ignoreDuringBuilds` inchangé.

**À faire par Tony** (rien d'autre ne bloque) :
1. SQL Editor : `supabase/migrations/20261008190000_base_scheduled_purges.sql` (purges
   planifiées), puis `20261009100000_app_errors_purge.sql`, puis
   `drop table public.places_geo;` (−232 Mo, plus aucun lecteur). **Urgent** : la base
   est à 429,3 Mio le 9 oct., l'alerte du rapport se lève à 430.
2. GitHub → Settings → Secrets → Actions : `SUPABASE_DB_URL` (Session pooler) et
   `BACKUP_PASSPHRASE` (sauvegarde chiffrée de la nuit, `SAUVEGARDES.md`).
3. Identité légale réelle pour les mentions légales ; retirer `DEMO_LOGIN_*` de Vercel.
4. Valhalla FOSSGIS : un mot sur GitHub Discussions (identification demandée).
5. Au lancement : protection hCaptcha dans Supabase + `NEXT_PUBLIC_AUTH_CAPTCHA=on` ;
   Authentication → « Leaked password protection » activée.
6. Décision : la vue `public_profiles` montre sans connexion le nom, la ville, la bio et
   les points de chaque compte. Proposition : la réserver aux comptes connectés et n'y
   laisser que le pseudonyme et l'avatar (`PLAN-100.md`, 2.4).

## P0 — Moteur fiable

| # | Sujet | État | Preuve / reste |
|---|---|---|---|
| P0.1 | Préparation en une seule passe (300 s) | **Fait** (preuve preview) | Travail en arrière-plan (`after`), l'écran relit l'issue toutes les 4 s. 8 oct. : « Arrêter » arrête aussi le serveur (retour Codex) ; une préparation n'est plus relancée parce qu'elle a elle-même retenu un lieu naturel (Ardennes), ni écrasée par un lancement en double juste après sa réussite (écran bloqué) |
| P0.2 | Compréhension de la demande et résolution du lieu | Partiel | 50/50 lues correctement hors ligne. En ligne corrigés : plein air → lieu naturel (Chartreuse massif, Loire fleuve, Calanques parc), pays entier (États-Unis Ouest), « nuits dehors » inventées par l'IA ; « GR34 » → région du sentier (GR65, GR70 ajoutés). 8 oct. : **raquettes Vercors en janvier prouvé en ligne** (dates posées, base Gresse-en-Vercors) ; les précisions choisies (durée, groupe, activité) priment sur la phrase et l'IA (retour Codex) ; sur l'eau, la rivière homonyme cherchée avec son article (« Le Tarn ») |
| P0.3 | Itinéraire déterministe | Partiel | Lieux réels (Photon → Overpass + Geoapify), hauteurs pour marche et ski, départ d'une ville dite. **Prouvés en ligne le 8 oct.** : Jura à vélo (5 lieux distincts), Beaufortain (parcours du catalogue), journée Mercantour (départ Saint-Étienne-de-Tinée « au cœur »), Dolomites (base Pecol, village d'altitude, plus Brugnàch), Cévennes (boucle Portes → Concoules → Génolhac), Malaga en un seul nom, **descentes de rivière en canoë** : Dordogne (54 km en 3 jours, Sainte-Mondane → Domme → Allas-les-Mines), Tarn (46 km, Brousse-le-Château → Trébas → Ambialet, après avoir cherché « Le Tarn » sous son article), Ardèche (34 km en 2 jours, Balazuc → Sampzon), un soir au bord de l'eau ; un repli dit sa cause. Irlande : plus de « West Clare Municipal District » (reprouvé à 7 h 04 : Shannon). Reste : Kalymnos (base Vathýs, sans données de falaises), échelle d'un pays (Patagonie : nuits au « Lago de los Tres », « Canal de Beagle »), randonnée dans une grande île (Sardaigne en voiture d'étape en étape, « Mòguru/Mogoro »), vrai tracé des grands itinéraires (TMB) |
| P0.4 | Dates et trajets | Partiel | Route plafonnée selon la durée. **Train prouvé en ligne** (Ardennes, environ 6 h ; Mercantour) ; Sardaigne en avion (plus en train). Départ au nom de la commune (plus « Chantier Hotel de Ville »). Reste : journée à plus de 3 h de trajet non signalée (Mercantour depuis Annecy : train 2 × 3 h 20 pour une journée, gare absente à Saint-Étienne-de-Tinée), choix d'aéroport |
| P0.5 | Budget et conseils | Partiel | **Papiers, change et prises par règles, prouvés en ligne** (Italie, Espagne, Grèce, Belgique : carte d'identité ; Irlande : adaptateur G ; Argentine : passeport). Niveaux de prix pour tous les pays de l'ONU. Conseils de l'IA : accents et **tutoiement par règle** (Bruges vouvoyait encore : impératifs mis au tutoiement, un conseil qui vouvoie est écarté) ; chaque journée dit son moyen (pagaie ≠ randonnée). Reste : les autres conseils restent du texte libre de l'IA |
| P0.6 | Fallbacks propres | Partiel | Geoapify actif (clé sur Vercel) ; la note d'un repli dit ce que chaque carte a répondu ; limite de fréquence affichée comme une attente. Reste : résultat complet garanti |
| P0.7 | IA production : NVIDIA NIM direct (Nemotron 3.5 Lightning) | Fait | Décision de Tony (7 oct., soir) : on reste sur NVIDIA ; le passage OpenRouter est annulé |
| — | Contexte du voyage unique (`buildTripContext`) | **Fait** | `engine/tripContext.ts`, testé |
| — | Fiabilité (prises atomiques, écritures vérifiées, annulation, arrondis) | **Fait** | Testé |
| — | Phrase de départ persistée | **Fait** | — |
| — | Écran « Où » = la demande + préparation visible | **Fait** (à valider en P2) | `CompasStart`, `CompasPrep` |

## P1 — Données

| # | Sujet | État |
|---|---|---|
| P1.1 | Référentiel géographique local : lieux habités, massifs / parcs, lieux importants, randonnées mondiales, refuges | **Lieux habités faits (8 oct., soir)** : `geo_places` (367 747 lieux GeoNames : cities500 pour 246 pays, tous les lieux habités de France, Suisse, Italie, Autriche ; 74 Mo, base à 428 Mo), lue d'abord par `lookupAreaPlaces` et les pages Pays ; Vercors : 357 lieux en 20 ms. `places_geo` n'est plus lu (retrait par Tony). Reste : massifs et parcs, refuges, escalade, rivières, grands itinéraires (`PLAN-100.md`, 3.3 à 3.7) ; noms français pour la recherche |
| P1.2 | Activités, POI, météo | Partiel (MET Norway, NASA POWER, POI Overpass) |

## P2 — Validation

| Jeu | Dernier résultat |
|---|---|
| 10 parcours de zone (7 octobre) | 9 sur lieux réels ; 2 défauts (Rome, Vosges), 3 partiels (Vercors, Jura, canoë) |
| 20 parcours réels | À rejouer après P0 |
| 50 demandes entièrement nouvelles | En ligne (7 oct.) : 47/50 prêtes au premier passage, 15 défauts corrigés à la racine pendant le test, 17 rejouées : toutes préparées (2 bloquées par la limite de fréquence, rejouées) |
| Passage du 7 oct. 19 h 17 – 20 h 30 (preview `ce534c0`, lu en base) | 38 voyages : 36 préparés, 1 en attente de la limite de fréquence, 1 sans dates (raquettes). Défauts relevés → corrigés la nuit, reprouvés le 8 (lignes ci-dessous) |
| Production, 8 oct. 12 h 05 (`972a14d`, lu en base) | Descente de la Dordogne en canoë, 3 jours : prête en 42 s, Lanzac → Sainte-Mondane → Domme → Allas-les-Mines, conseils au tutoiement. Défaut lu en base : parcours de 36,1 km pour 54,1 km d'eau (premier jour non compté) → corrigé (PR #74, en production) |
| Passages du 7 oct. 21 h et du 8 oct. 5 h 39 – 7 h 06 (preview PR #72, lus en base) | 31 voyages, dont 26 au premier passage : 25 préparés ; Ardennes (21 h 11) défait aussitôt puis bloqué par la limite de fréquence, et un écran resté en attente sur un lancement en double (données écrites) → **deux causes corrigées**. **Prouvés** : papiers, train, Jura, Beaufortain, Mercantour, Dolomites, Vercors en janvier, Cévennes, Malaga, Dordogne en canoë, tutoiement (Bruges reprouvé à 6 h 27). Tarn et Ardèche en canoë reprouvés à 6 h 47, « West Clare » à 7 h 04 (Shannon). Ouverts : Kalymnos, Patagonie, Sardaigne, journée lointaine |

## P3 — Après stabilisation (gelé)

Réservations réelles (Travelpayouts, RouteStack, Viator), équipe / social, bouteille à la mer,
hors ligne, affiliation, animations, polish de maquette et desktop. Accessibilité : close pour
l'instant.

## Lancement mondial (audit du 8 octobre)

`AUDIT-LANCEMENT-MONDIAL-2026-10-08.md` : **≈ 35 % prêt pour le monde, ≈ 50 % pour un
lancement francophone** (≈ 65 % après passage aux offres payantes). 97 % des
préparations réussies en production (151/156), mais aucun vrai utilisateur encore.
Corrigé pendant l'audit : quota IA jamais appliqué (appliqué et prouvé en production),
lien d'invitation lisible par un simple lecteur (appliqué en base), noms non latins
partageant une clé de cache, mention OpenStreetMap sans position. Bloquants restants :
services gratuits interdits en commercial, Supabase gratuit, écriture publique du cache
d'itinéraires, limite de fréquence non distribuée, connexion démo ouverte, voyageur
supposé français (papiers, départ, fuseau, langue). Décisions attendues de Tony : cible,
budget, offre Vercel, IA, démo.

## Blocages (8 octobre)

- Réseau ouvert : la preview, Photon et Supabase répondent depuis le conteneur ; Overpass reste instable depuis ici (miroirs en 500/504).
- Vercel : connecteur reconnecté par Tony le 8 oct. (déploiements, journaux et variables lisibles).
- Réservations (P3, gelé) : **RouteStack en direct sur le site de production** (8 oct., 12 h 03, mode `live`) : hôtels à Annecy (Logis Hôtel Annecy Nord, Hotel du Midi…), Lisbonne (Sheraton…) et Paris ; vols Genève → Lisbonne (3 offres dès 128,93 USD, 12 s). **Villes en français en production** (PR #74, `8d5aac4`, reprouvées sur le site le 8 oct. à 12 h 49) : vol Paris → Lisbonne (PAR → LIS, dès 47,07 USD), Genève → Londres (GVA → LON : Gatwick, Luton), Nice → Lyon (NCE → LYS), voiture à Lisbonne (3 offres). Aéroport de la ville d'après la réponse de RouteStack (« All Airports » d'abord, jamais une gare), nom anglais d'OpenStreetMap en secours. Un vol peut prendre jusqu'à 29 s.
- Supabase : le connecteur de la session refuse toute suppression (DROP) ; ces opérations passent par le SQL Editor (Tony).

## Décisions en vigueur

- **Budget 0 € (Tony, 8 octobre, après-midi)** : carte blanche complète, Claude est le
  patron du chantier ; seule règle : **aucune dépense**. Plan et tâches :
  **`PLAN-100.md`** (phases, sous-phases, preuves attendues).
- **Mandat (Tony, 8 octobre)** : carte blanche. Claude mène le chantier seul : migrations, corrections de tests, fusion des PR quand la CI est verte, déploiements Vercel (connecteur reconnecté sur l'équipe `tonyfaracip-3325s-projects`). Chaque étape reste prouvée en ligne et contrôlée en base, et dite dans ce fichier.

- IA production : **NVIDIA NIM direct** (décision de Tony du 7 octobre au soir, remplace le passage à OpenRouter).
- Cartes et routage : comptes gratuits de Tony (Geoapify, LocationIQ, ArcGIS, hCaptcha ; clés dans Vercel). Routage : Geoapify puis Valhalla FOSSGIS ; plus aucun serveur de démonstration (OSRM, BRouter retirés, lot D).
- Référentiel géographique : **offre gratuite Supabase** (décision de Tony du 8 octobre), référentiel compact `geo_places` (~300 Mo au final, `places_geo` retiré), feu vert donné par le mandat. Ordre : index inutiles retirés, puis `geo_places` et import des lieux habités, voir `REFERENTIEL-GEO.md`.
- Réservations : branchées après la stabilisation du moteur.

Détail : `AUDIT-2026-10-07.md` (architecture), `AUDIT-DONNEES-2026-10-07.md` (sources), `REFERENTIEL-GEO.md` (plan chiffré P1.1).
