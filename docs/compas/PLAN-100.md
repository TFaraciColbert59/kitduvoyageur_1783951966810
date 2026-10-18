# Compas — plan vers 100 % (chantier mené par Claude, budget 0 €)

> **Mandat de Tony (8 octobre 2026)** : carte blanche complète, Claude est le patron du
> chantier. **Une seule règle : budget 0 €.** Ce fichier est le plan et la liste des
> tâches ; `ETAT.md` reste le tableau de bord (où on en est, preuves) ;
> `AUDIT-LANCEMENT-MONDIAL-2026-10-08.md` donne les constats détaillés.

## Règles du chantier

1. **0 €** : aucune offre payante. On n'utilise que des services gratuits **dont les
   conditions permettent l'usage commercial**, dans leurs limites de débit, avec leurs
   attributions. Ce que le site ne peut pas obtenir gratuitement, il le calcule lui-même
   (référentiel local, règles) ou l'annonce honnêtement (« estimation », « non évalué »).
2. **Rien d'inventé** : un lieu, un prix, une date viennent d'une source ou d'un calcul
   dit ; sinon « non renseigné ».
3. **« Fait » = prouvé** sur la preview puis en production, et contrôlé en base.
4. Une PR par lot, CI verte, revue Codex traitée, fusion, vérification en production.
5. Règles fixes du dépôt : Vercel seul pour le web, Capacitor seul pour le mobile, jetons
   `--lkv-*`, jamais `#E4501C`, RLS sur toute table, `zod` sur toute entrée.

Légende : `[x]` fait (preuve) · `[ ]` à faire · `[~]` en cours · `🔒` bloqué (raison) ·
`⚖️` décision de Tony.

## Tableau de bord

| Volet | Aujourd'hui | Cible | Phases |
|---|---|---|---|
| Socle (services, hébergement, base) | 63 % (27/43) | 100 % | 1 |
| Fiabilité et sécurité | 81 % (39/48) | 100 % | 2 |
| Données (référentiel géographique) | 54 % (7/13) | 100 % | 3 |
| Moteur (itinéraire, budget, papiers, kit, temps) | 75 % (27/36) | 100 % | 4 |
| Interface, accessibilité, légal (français) | 86 % (24/28) | 100 % | 5 |
| Monde (langues, formats, voyageur non français) | 0 % (0/12, 9 en cours) | 100 % | 6 |
| Validation et lancement | 0 % (0/8) | 100 % | 7 |
| Après stabilisation (P3) | — | 100 % | 8 |
| Dette et hygiène | 33 % (2/6) | 100 % | 9 |

Mesuré le 18 octobre (même méthode que le 13 : cases `- [x]` sur cases du volet, une grande case compte
comme une petite). **Global : 65 %** (126/194, hors phase 0 faite et phase 8 gelée) ; 77 % en comptant
pour moitié les cases en cours. Le 13 octobre : 63 % (123/194). Synchronisation du 18 oct. : chaque case
ouverte relue contre le code, la CI et les commits ; n'est cochée que ce qui a une preuve (fichier, test,
commit, mesure) ; ce qui est codé mais éteint ou non prouvé passe en `[~]`, jamais en `[x]`.

**100 % veut dire** : chaque case de ce fichier est cochée avec sa preuve, la phase 7
passe (jeux de validation en production, contrôlés en base) et aucun constat
« bloquant » ou « important » de l'audit du 8 octobre ne reste ouvert.

---

## Phase 0 — Fait (8 octobre)

- [x] PR #72, #73, #74, #75 en production (CI verte, revues Codex traitées).
- [x] RouteStack en direct : hôtels, vols, voitures ; villes en français (Paris → PAR,
      Lisbonne → LIS, Londres → LON), prouvé sur le site.
- [x] Descente en canoë : premier jour compté et tracé (54 km), prouvé en base.
- [x] Quota IA par personne appliqué en base, prouvé en production.
- [x] Faille d'invitation (lecteur → éditeur) fermée en base.
- [x] Noms non latins : clé de cache propre à chacun.
- [x] Mention « © OpenStreetMap » de la carte repositionnée.
- [x] 9 index inutiles supprimés (Tony, SQL Editor) : **base de 424 à 353 Mo**.
- [x] Audit de lancement mondial écrit.

---

## Phase 1 — Socle à 0 € (services, hébergement, base)

### 1.1 Base Supabase gratuite (500 Mo, pas de sauvegarde)

- [~] **Budget de place** écrit et suivi : cible ≤ 400 Mo en régime (marge de 100 Mo).
      Suivi dans `ops_daily_reports` (8 oct. : 371 Mo, dont `places_geo` 232 Mo).
- [~] **Plafonds des caches** : `cap_shared_caches` (1 000 trajets, 25 000 lieux), purges
      `purge_geo_cache` / `purge_route_cache` (119 trajets tous expirés, jamais purgés),
      des journaux et des kits à la corbeille (`purge_expired_trash_kits`, sans session,
      car `cleanup_expired_trash_kits` en exige une), planifiées en base (`pg_cron`,
      `docs/compas/SAUVEGARDES.md`).
      🔒 Suppressions : `20261008190000_base_scheduled_purges.sql` (corrigée le 12 oct. : la purge de
      la file `progression` y était planifiée deux fois) à lancer par Tony dans
      le SQL Editor. Preuve : taille stable sur 7 jours.
- [x] **Tracé dans `trips.metadata`** : 600 points au plus pour tout le voyage
      (`MAX_TRACK_POINTS`, ~12 Ko ; 150 par tronçon avant), réécrit à chaque
      préparation (8 oct. : 23 Ko au plus, 3 Ko en moyenne).
- [x] **Retrait de `places_geo`** (232 Mo) : plus aucun lecteur depuis le lot E (pages
      Pays sur `geo_places`). 🔒 Tony : `drop table public.places_geo;` dans le SQL
      Editor. Preuve : base ≤ 250 Mo avant import des lots 3.3 à 3.7. **Fait par Tony** :
      constaté en base le 17 oct. (`ETAT.md`, commit `3c7eb353` : base à 228-229 Mo sur 250),
      puis import de `geo_pois` (112 400 points) le 18 oct. ; plus aucune lecture dans `src/`
      (seul un commentaire de `src/lib/geodata.ts` la nomme).
- [~] **Sauvegardes gratuites** : `.github/workflows/db-backup.yml`, chaque nuit,
      `pg_dump` (`public` + `auth` + `marketplace_private`, hors caches et référentiels
      réimportables), chiffré
      AES-256, artefact 7 jours ; restauration écrite (`docs/compas/SAUVEGARDES.md`).
      🔒 Tony : secrets GitHub `SUPABASE_DB_URL` et `BACKUP_PASSPHRASE`. Preuve : un
      artefact, une restauration réussie sur une base de test.
- [~] **Rapport quotidien** en base : `ops_daily_report()` chaque nuit à 4 h 07 UTC
      (`pg_cron`), table `ops_daily_reports` (taille, caches, compteurs, essais,
      préparations réussies / échouées de la veille). Depuis le 8 oct., les préparations
      se comptent sur un journal (`ops_preparation_events`, une ligne par issue, écrite
      par le serveur) : l'ancien compte (dernière issue de chaque voyage) ignorait les
      relances. **Alertes** (lot L, migration `20261009093721`) : colonnes `app_errors`
      et `alerts` (base > 430 Mio, plus de 10 % d'échecs sur 10 préparations au moins,
      50 erreurs serveur) ; les jours d'avant restent « non renseignés ». Prouvé en base
      le 9 oct. : le 8 oct. lève « plus de 10 % de préparations échouées » (7 réussies,
      4 échouées) ; base à 429,3 Mio, juste sous le seuil. Reste : être prévenu sans
      lire la table (notification gratuite).
- [ ] **Pause pour inactivité** (7 jours sans requête) : le trafic et les tâches de nuit
      gardent le projet actif. Preuve : aucune pause en 14 jours.
- [~] Aucune des 15 routes `/api/cron/*` du site n'est planifiée (ni `vercel.json`, ni
      tâche GitHub ; 8 oct.) : les brancher sur `pg_cron` + `pg_net` ou les retirer
      (hors Compas, phase 9). **Lot Z3** : code et tests faits : un seul cron Vercel quotidien
      (`/api/cron/daily`, 03:00 UTC ; Hobby : un tir par jour, ±59 min, page des limites relue le
      12 oct.) enchaîne 13 des 16 routes réelles (Bearer `CRON_SECRET` en temps constant, une tâche
      qui échoue n'arrête pas les autres, budget 270 s) ; `process-ai-jobs` et
      `refresh-country-guides` restent à la main (IA : décision de Tony), de même que
      `finalize-kit-attributions` (retirée après revue : la reprise d'un crédit déjà versé est bornée
      au solde restant alors que le registre débite le tout, et le webhook Stripe avale l'erreur de
      `reverse_kit_attribution_by_session` ; à corriger avant de verser automatiquement)
      (`dailyRegistry.test.ts`,
      `dailyRealRoutes.test.ts`, `dailyDispatcher.test.ts`, `auth.test.ts`, `route.test.ts`).
      ⚠️ **ACTIF SEULEMENT quand Tony crée `CRON_SECRET`** dans les variables Vercel (absent le
      12 oct. : la route répond 401, rien ne tourne). Preuve attendue : un tir dans Réglages › Cron
      Jobs, réponse 200 avec le résumé. **Après revue (PR #91)** : une tâche qui dépasse son délai
      (90 s) ne peut pas être interrompue : le répartiteur n'en lance plus d'autre (suite sautée
      `after_timeout`, jamais deux tâches en même temps) ; les tâches non épinglées partent d'un rang
      décalé chaque jour (`rotation` = numéro du jour) pour qu'une queue de liste ne soit pas sautée à
      vie, la vie privée (5 tâches) reste épinglée en tête ; `process-adventure-events` enchaîne jusqu'à
      20 lots tant qu'ils sont pleins (sans rejouer un échec transitoire dans le même tir), les refus
      forgés (`actor_mismatch`, `missing_actor_id`) sont terminaux d'emblée, et la migration
      `20261012100000_adventure_events_claim_lease.sql` donne un bail de 15 min aux lignes
      `processing` (une purge RGPD coupée est reprise) et sert `consent.revoked` d'abord (**appliquée en
      production le 12 oct.**, version `20261012142746`). Limites : l'expiration des positions live (TTL 15 min) n'est purgée qu'une fois par
      jour (vérifier que chaque lecteur filtre sur `expires_at`) ; les 13 routes enchaînées gardent
      leur comparaison de Bearer.

### 1.2 Hébergement Vercel

- [x] ⚖️ **Décision de Tony (8 oct.) : Hobby pour l'instant, Stripe reste éteint.**
      Passer en Pro (20 $/mois) le jour où le site vend.
- [ ] ⚖️ **Offre Hobby et usage commercial** (vérifié le 8 oct., `SERVICES-GRATUITS.md`) :
      « Hobby teams are restricted to non-commercial personal use only » ; sont
      commerciaux « any method of requesting or processing payment » et un site dont
      l'affiliation est le but premier. Sanction : fonction coupée 30 jours ou
      déploiement en pause (503). À 0 €, deux voies seulement : (a) désactiver en
      production ce qui est commercial (paiement, liens d'affiliation) tant que l'offre
      est Hobby ; (b) accepter le risque. **Recommandation : (a)**, par un drapeau
      d'environnement, sans supprimer le code. Décision de Tony attendue ; en attendant,
      rien n'est changé.
- [x] Offre réelle du compte : **Hobby très probable** (aucune facture sur l'équipe,
      `costs_not_found`, 8 oct.) ; à confirmer par Tony dans le tableau de bord.
- [x] **Aucune clé Stripe en production** (variables Vercel lues sans leurs valeurs,
      8 oct.) : aucun paiement n'est traité aujourd'hui. Tant que l'offre est Hobby,
      Stripe reste éteint ; l'allumer impose l'offre Pro (20 $/mois).
- [x] **Durée des fonctions** : rester ≤ 300 s (maximum Hobby) ; préparation découpée en
      étapes reprenables (2.6) pour ne jamais dépendre d'une seule fonction longue. **Lot Z3** :
      `maxDuration` ≤ 300 gardé par un test statique, cohérent avec `CLAIM_MS` (290 s)
      (`functionDuration.test.ts`).
- [~] **Coût de calcul** : supprimer le rafraîchissement complet de page toutes les 4 s
      (2.8) ; mettre en cache les données de page (météo 30 min, altitudes 30 j). **Lot Z3** :
      suivi de préparation à intervalle croissant, arrêté quand l'onglet est caché, hors ligne, la
      préparation finie ou l'écran quitté, une seule requête en vol (`outcomePoll.test.ts`,
      `compasScreen.test.tsx`). Le cache des données de page (météo 30 min, altitudes 30 j) était
      déjà là (lots H et L).
- [x] **Région des fonctions** : `vercel.json` → `cdg1` (Paris). Les fonctions
      tournaient à `iad1` (Washington) alors que la base est à Paris (`eu-west-3`), comme
      Geoapify, Photon, Valhalla et MET Norway : chaque requête traversait l'Atlantique.
      L'offre Hobby permet une région au choix (déploiement d'aperçu : `regions:
      ["cdg1"]`). Mesures du 9 oct., depuis un client aux États-Unis : route lisant la
      base (`/api/compas/sources`) 0,32 s à Paris contre 0,5 à 0,8 s à `iad1` ; page
      statique 0,1 s plus lente (le client est loin de Paris) ; préparation des Bauges,
      cache chaud, un essai chacun : 40 s (Paris) contre 35 s (`iad1`), itinéraires
      différents, non concluant (services externes et IA dominent). **Production, 9 oct.
      4 h 15 (`ee7ae6f`, Paris), cache chaud : 5 préparations sur 5 réussies, médiane
      25 s** (Bauges 25 et 25 s, Vercors 27 s, Dolomites 45 s, Patagonie 23 s) ; même
      demande des Bauges à `iad1` la veille : 35 s.

### 1.3 Recherche de lieux (géocodage) sans serveur de démonstration

- [~] **Référentiel local d'abord** (phase 3) : destination, villages, refuges, lieux
      naturels lus dans `geo_places` ; réseau seulement en secours.
      **17 oct.** (`11b56d5a`) : le lieu saisi est cherché d'abord dans `geo_places`
      (`server/geoPlaces.ts`, fonction `geo_places_search`, migration `20261017140000`,
      `geoPlaceSearch.test.ts`, `geoPlaceSearchServer.test.ts`, `placeSearchReferential.test.ts`)
      derrière `COMPAS_GEO_PLACES_SEARCH` (**éteint**) ; villages d'une zone déjà lus d'abord
      dans le référentiel (3.2). Reste : allumer et prouver ; refuges (3.4) et lieux naturels
      (3.3) idem derrière leurs interrupteurs.
- [x] **Geoapify gratuit** (3 000 crédits/jour, « we do not restrict » l'usage
      commercial) : **« Powered by Geoapify »** dans les mentions légales ; lieux d'une
      zone ramenés de 500 à 200 (10 crédits) ; **compteur de crédits du jour en base**
      (`take_api_credits`, lot F) commun au géocodage, aux lieux et au routage, arrêt à
      2 700 ; le routage a en plus son plafond de 1 500, au coût réel (un crédit par
      tranche de 500 km). Preuve en production (8 oct., 23 h 20) : `api_credit_days`
      passe de 1 à 4 crédits Geoapify et de 0 à 3 crédits de routage sur une préparation.
- [~] **LocationIQ gratuit** (5 000 req/jour, commercial avec lien visible) : compte
      créé par Tony (8 oct.) ; avec `LOCATIONIQ_API_KEY`, **tous les appels Nominatim du
      Compas passent par LocationIQ** (même moteur, `src/features/compas/server/locationIq.ts`,
      2 req/s) ; « Search by LocationIQ.com » cliquable dans les mentions légales.
      **Prouvé en production le 8 oct.** : `/api/compas/sources` → `locationiq: true` ;
      préparation réelle (Bauges, 41 s) réussie après la bascule.
- [x] **Photon public** (pas de clause commerciale, « usage raisonnable ») : après le
      référentiel (lot E) ; User-Agent `koosmoweb.fr` ; **trois requêtes par seconde pour
      tout le site** (`siteSlot`, compteur en base, lot F) ; cache 30 j.
- [x] **Nominatim public retiré du trafic courant** (« periodic requests from apps are
      considered bulk geocoding ») : remplacé par LocationIQ dans le Compas dès que la
      clé est lue (lot B). **Lot AA** : `nominatimJson` (`compas/server/locationIq.ts`) est le
      seul client (Compas, `officialAlerts`, `adventure-prep/geocodeService.ts`) : LocationIQ avec
      clé, une requête à la fois ; sans clé, Nominatim public en repli de développement, dit dans
      le code (`locationIq.test.ts`). Limite : les champs `region` et `ISO3166-2-lvl6` de LocationIQ
      ne sont pas vérifiés hors ligne (repli : le cadre de la métropole décide), à contrôler avec la
      vraie clé ; Photon reste sans créneau du site (`amenities`, `geocodeService`).
- [x] Positions envoyées arrondies à 0,01° (RGPD, 2.10) : `coarsePosition` dès l'entrée
      de la préparation (lot F).

### 1.4 Points autour des étapes (Overpass)

- [x] **Fin de la course à 5 instances** dans le Compas (`stagePoiLookup.ts`, lot B) :
      private.coffee seul, une requête à la fois, test de garde
      (`overpassEndpoints.test.ts`). **Lot AA** : même règle dans tout le site par une file
      commune (`src/lib/overpass.ts`, `serializeOverpass`) : `amenities.ts` (Partir librement),
      l'adaptateur de l'explorateur OSM, `realDataConnectors.ts` ; le garde couvre tout `src/`
      (`overpass.test.ts`, `overpassAdapter.test.ts`, `overpassWaterSerial.spec.ts`). Limite dite :
      la file est par instance Vercel.
- [ ] Un seul fournisseur autorisé en commercial : **private.coffee** (« including
      commercial use », pas de limite, éviter les requêtes simultanées), après les avoir
      prévenus (support@private.coffee) ; requêtes en série, jamais en parallèle.
- [~] Refuges, campings, eau, sommets lus d'abord dans le référentiel (3.4) ; Overpass
      seulement pour une zone absente. Code fait : `stagePoiLookup.ts` lit `geo_pois`
      (`server/geoPois.ts`, `geoPois.test.ts`) avant Overpass derrière `COMPAS_GEO_POIS`
      (**éteint**) ; `geo_pois` rempli pour les Alpes (71 tuiles sur 72, 18 oct., `ETAT.md`).
      Reste : sommets (non importés), France, allumage et preuve.

### 1.5 Calcul d'itinéraire (routage)

- [x] **Retrait du serveur de démonstration OSRM** (« non-commercial use-cases »,
      vérifié), de `routing.openstreetmap.de` et de `brouter.de` (conditions introuvables) :
      plus aucun appel (lot D, `routingService.ts`). Leurs mesures déjà en cache gardent
      leur nom ; la route du cache n'accepte plus de nouvelle écriture à leur nom.
- [x] Conditions vérifiées (8 oct.) : aucune offre de routage gratuite n'accorde par
      écrit l'usage commercial ; Geoapify (« not restricted ») et Valhalla FOSSGIS
      (« open to the public », identification demandée) sont les seules utilisables ;
      OpenRouteService flou (à demander : enquiry@openrouteservice.org).
- [~] Ordre : cache (mémoire, `route_cache`, et `geo_cache` « leg v3 » 30 j) →
      **Geoapify Routing** (`hike` / `bicycle` / `drive`, plafond du site 1 500 crédits
      par jour sur les 3 000 partagés, un crédit par tranche de 500 km) → **Valhalla FOSSGIS** sur panne, avec
      `X-Client-Id: koosmoweb.fr` → **estimation annoncée** (vol d'oiseau × 1,4 à pied,
      × 1,3 à vélo ou sur route, « ≈ … km (estimée) » à l'écran, phrase dans l'étape et
      note de préparation). Chaque étape garde sa source (`trip_steps.metadata.distance`).
      Le dénivelé d'une journée à pied ou à vélo, que seul BRouter donnait, se lit sur le
      relief (Terrain Tiles) le long du tracé. **Prouvé sur l'aperçu (PR #79, 8 oct.)** :
      Chamonix → Les Houches à pied 7,4 km / 1 h 51, à vélo 7,3 km, en voiture 8,05 km
      (source Geoapify, arrivée dans la tolérance) ; refuge des Grands Mulets atteint à
      pied (14,9 km, arrivée à 18 m : seul BRouter y arrivait), sommet du Mont Blanc
      28,0 km ; trek de 3 jours dans le Vercors préparé en 41 s, jours 2 et 3 mesurés par
      Geoapify (17,5 km / D+ 756 m, 10,8 km / D+ 623 m lus sur le relief), source gardée
      dans l'étape. Reste : l'annonce sur GitHub Discussions de Valhalla (Tony).
- [x] User-Agent sur tous les appels de routage (Geoapify et Valhalla).

### 1.6 Fond de carte

- [x] Retirer les fonds non autorisés en commercial : moteur commun
      (`components/map/engine/createMapStyle.ts` : carte du Compas, Explorer, globe Pays),
      lot B ; **cartes Leaflet** (Explorer historique, carte interactive, carnet, hub,
      départ, groupes) sur `leafletTiles` (mêmes fonds ArcGIS avec clé), lot J. Plusieurs
      n'affichaient aucun crédit (`attributionControl: false`) : crédit visible et
      **complet** partout, chaque fournisseur de données nommé (revue Codex : un crédit
      court oubliait TomTom, Garmin…, et Leaflet n'a pas de crédit repliable). **Hors
      ligne** : plus aucune tuile téléchargée en masse (OSM France et OpenTopoMap
      l'interdisent, ArcGIS ne le permet que par ses kits) ; le tracé et les points
      restent sur l'appareil, l'écran le dit, et la place affichée est la leur.
      Module mort `lib/offline/tiles.ts` (OpenTopoMap) retiré. Garde
      `tests/map/leafletTiles.spec.ts` : aucune URL de fond non autorisée hors du repli
      de développement.
- [~] Fond standard : **OpenFreeMap** (vecteur, sans clé ni limite, commercial
      autorisé) via MapLibre (ou extension MapLibre de Leaflet) ; attribution
      « OpenFreeMap © OpenMapTiles Data from OpenStreetMap ». Prévoir un repli : il peut
      s'arrêter sans préavis. **17 oct.** (`2d6468d0`) : fond « Clair » de
      `UnifiedExplorerMap` sur OpenFreeMap avec repli ArcGIS (`components/map/engine/standardBase.ts`,
      `tests/map/standardBase.spec.ts`, crédit dans `DataSources.tsx`) derrière
      `NEXT_PUBLIC_MAP_STANDARD` (défaut `arcgis` : **éteint**). Reste : allumer, vérifier le
      rendu et le repli en production ; cartes Leaflet non concernées.
- [~] Relief, standard et satellite : **ArcGIS Location Platform** gratuit (2 M tuiles
      et 1 000 sessions par mois, commercial autorisé avec clé ; coupé au-delà) ; compte
      et clé créés par Tony (8 oct.) ; `arcgis/outdoor` (relief), `open/osm-style`
      (standard), `World_Imagery` (satellite) ; « Powered by Esri » sur la carte (mention
      complète dépliable) et dans les mentions. **Prouvé en production le 8 oct.** :
      10 tuiles `static-map-tiles-api.arcgis.com` en 200 sur `/explorer`, plus aucune
      tuile sans clé. Reste : compteur de sessions.

### 1.7 IA à 0 €

- [x] ⚖️ **Décision de Tony (8 oct.) : IA NVIDIA gardée allumée.** Le Compas garde
      quand même un chemin complet sans IA (repli si la clé gratuite est coupée).
- [ ] ⚖️ **Licence** (vérifié le 8 oct.) : l'essai NVIDIA ne couvre pas la production
      (« any non-testing activity including activity serving real end-users » exige une
      licence AI Enterprise). **Aucune IA gratuite n'est utilisable en production
      commerciale pour des utilisateurs européens** : Gemini gratuit interdit dans
      l'EEE et entraîne sur les requêtes ; Mistral Experiment, OpenRouter, Hugging Face,
      Cerebras = essai ou quotas symboliques ; Groq « not for consumer use » ;
      Cloudflare exclu par la règle du dépôt. À 0 €, voie conforme : **le Compas
      fonctionne entièrement sans IA** (règles pour la phrase, l'itinéraire, le budget,
      les conseils) ; l'IA reste allumée pour les tests (aucun vrai utilisateur
      aujourd'hui) et s'éteint par drapeau pour le lancement, sauf décision contraire de
      Tony.
- [x] Drapeau **`AI_MODE=off`** lu dans `askAI`, le point d'entrée unique de l'IA (lot F) :
      chaque usage rend son repli par règles, raison « ia_eteinte » dite à l'écran.
      **Prouvé de bout en bout le 9 oct.** (lot K, aperçu `edf1b5b`, `AI_MODE=off` posé
      pour cette seule branche) : 6 demandes sur 6 préparées en 15 à 16 s (contre 17 à 34 s
      avec l'IA), **aucune ligne dans `ai_usage_daily`** pour ces comptes ; lu en base :
      « dans 3 semaines » → départ le 30 oct., « 1,500 € » → enveloppe de 1 500 €,
      « 2000 $ » → 1 785 € au taux du jour, « 2 adultes et 3 enfants » → 5, « à
      vingt-deux » → 22, conseils des règles en tête (112 en solo, BERA en Vanoise en
      février, lâchers de barrage sur l'Ardèche). Défauts relevés pendant le passage et
      corrigés : date de l'IA qui l'emportait sur le calcul des règles (le 23 au lieu du
      30 oct.), « week-end de la Toussaint » posé le dimanche, note « pas arrivée à temps »
      quand l'IA est éteinte. Reste sans IA : itinéraire à l'échelle d'un pays (Écosse :
      une étape par jour sur le pays, dit comme tel ; 4.5).
- [x] Compréhension de la phrase sans IA (4.10), lot K : voir 4.10.
- [x] Conseils par règles (4.11), lot K : l'absence d'IA ne retire rien d'essentiel.
- [x] Plafond global quotidien d'appels IA (`AI_DAILY_CAP`, 2 000 par défaut, en plus du
      plafond par personne) ; compteur en panne = refus (fail-closed), lot F.
- [x] Cache des réponses IA identiques (même demande, même jour) : « Dis-le »
      (`compas-intent`) et explication du verdict (`compas-verdict`) gardées un jour ; la
      date du jour, les dates du voyage et les faits font partie de la demande, donc de
      la clé. Une réponse en cache ne consomme ni quota ni appel. La préparation reste
      sans cache (chaque voyage est unique).

### 1.8 Météo et données ouvertes

- [x] MET Norway (CC BY 4.0, commercial autorisé) : User-Agent unique du site
      (`src/lib/userAgent.ts`, `kitduvoyageur/1.0 (…; +https://koosmoweb.fr)`) sur MET
      Norway, Nominatim, Photon, Overpass, Valhalla : des appels annonçaient encore
      `lekitduvoyageur.fr` ou `kitduvoyageur.fr`, qui ne sont pas nos domaines ; crédit
      et lien CC BY 4.0 dans les mentions. **Lot L** : un seul point d'accès
      (`src/lib/weather/metnoRequest.ts`), un seul User-Agent et une seule URL par point
      (une entrée de cache partagée ; deux auparavant, Compas et le reste), 20 départs
      par seconde au plus par instance, cache de 45 min (`Expires` mesuré à ~32 min le
      9 oct.) : rien n'est redemandé avant `Expires`.
- [x] NASA POWER (« no restrictions », citation demandée) : fenêtre de la tendance
      calée sur des mois entiers (`trendWindow`), la même URL sert tout le mois au lieu
      d'une de plus chaque jour ; citation du projet POWER dans les mentions. Test
      `trendWindow.test.ts`.
- [x] Meteoalarm : conditions à vérifier ; attribution. **Lot U** : conditions (§ 5, Style
      Guide v1.0, profil CAP v2.0) relues mot pour mot le 11 oct. 2026 et citées avec lien et
      date ; attribution affichée avec chaque alerte et dans les mentions légales
      (`meteoalarmFeeds.test.ts`). ⚠️ À faire par Tony : s'enregistrer comme redistributeur
      Meteoalarm et demander si le trafic pose problème (aucune fréquence d'appel chiffrée ;
      cache de 5 min par instance).
- [x] Taux de change : **Frankfurter v2** (`/v2/rates`, 104 banques centrales, 223
      devises ; vérifié le 8 oct. : VND, ARS, KES, XPF servis), secours **currency-api**
      (CC0) ; cache 12 h ; la source est dite à côté du montant ; mentions : « Source:
      ECB statistics. » et currency-api. Tests `currency.test.ts`. ⚠️ Un voyage
      n'enregistre encore que six devises (enum `trip_budget_currency`) et le Compas le
      crée en euros (retour Codex sur #82) : la conversion dans la devise du pays de
      destination est à faire en 4.2.
- [x] Carburant : bulletin pétrolier de l'UE (CC BY 4.0) pour l'UE-27 ; ailleurs barème
      versionné et daté, affiché comme « estimation » (aucune source mondiale gratuite).
      **Lot W** : Euro-super 95 TTC des 27 pays (prix du 5 oct. 2026, lu par
      `scripts/compas/build-fuel-prices.mjs`) ; hors UE, estimation à fourchette (moyenne
      pondérée UE-27 2,01 €/L, de 1,34 à 2,61 €/L), jamais un prix pays inventé
      (`fuel.test.ts`, `autofill.test.ts`, `dataCredits.test.tsx`). Les lignes déjà écrites
      gardent l'ancien 1,80 €/L jusqu'à un nouveau « Tout préparer ». Le nom du classeur du
      bulletin porte 2026-09-21, sa cellule A2 le 5 oct. : la date lue est retenue.

---

## Phase 2 — Fiabilité et sécurité

### 2.1 Caches partagés

- [x] **`POST /api/route/cache` fermé au public** : écriture signée HMAC par le serveur
      (`src/lib/routeCacheSignature.ts`), 5 000 points au plus par tronçon. PR #76 ;
      **prouvé en production le 8 oct.** : écriture non signée → 403
      `signature_expected` ; trajet mesuré par `/api/route` écrit (signé) dans
      `route_cache`.
- [x] Test : une écriture sans signature est refusée (403), rien n'entre en base
      (`tests/routing/route-signature.spec.ts`, I4-CACHE-01b).

### 2.2 Limite de fréquence et abus

- [x] **Limite distribuée gratuite** : fenêtre fixe en base (`rate_limit_consume`,
      table non journalisée, clés hachées, exécutable par le seul rôle de service ;
      migration `20261008164423`) au lieu de la mémoire par instance, pour **toutes**
      les routes limitées (Upstash reste prioritaire s'il est un jour configuré).
      **Prouvé en production le 8 oct.** : une préparation réelle = 10 fenêtres en base
      (essai, lancement, site…). Les appels internes signés (`/api/route` → cache) ne
      passent plus par le compteur par adresse (sortie Vercel commune, revue Codex).
- [x] **Contournement par `autofill_pending` fermé** : une reprise (phase « rest »)
      a sa propre limite par personne (12 / 10 min) et pour le site (240 / h) ;
      réécrire l'état ne relance plus rien sans compter (`autofillLimits.test.ts`).
      L'état reste dans `trips.metadata` (son déplacement relève de 2.7).
- [x] Plafond global : 120 lancements par heure pour tout le site, message propre.
- [x] Limite sur `compasSetDestinationAction` (20 lieux par 10 min et par personne,
      jamais pour effacer ou annuler) et `compasInterpretAction` (30 phrases par
      10 min) ; les autres actions qui appellent la carte ou l'IA étaient déjà limitées
      (lot L, `actionLimits.test.ts`).
- [x] Message juste quand la limite est atteinte (plus « déjà lancée plusieurs fois ») :
      personne, site, ou compteur indisponible, chacun dit.
- [~] Protection des inscriptions et des sessions anonymes contre les comptes en série :
      **hCaptcha gratuit** invisible (`src/lib/captcha/hcaptcha.ts`, sans dépendance) ;
      jeton joint à la connexion, l'inscription (deux pages), l'essai sans compte et le
      mot de passe oublié (lot B), défi en français. **Éteint pendant le chantier** :
      prouvé sur l'aperçu le 8 oct. (un navigateur automatique reçoit un défi visuel),
      donc une fois imposé, plus aucune vérification automatique en production ne
      pourrait se connecter. Interrupteur `NEXT_PUBLIC_AUTH_CAPTCHA=on` (Vercel) ;
      **allumé au lancement (phase 7)** en même temps que la protection de Supabase
      (Authentication → Bot and Abuse Protection → hCaptcha, clé secrète). D'ici là :
      limite d'IP de Supabase Auth (30 sessions anonymes/heure), nos limites (5 essais
      par heure et par adresse, 300 par jour pour le site) et la purge à 7 jours.
      BotID de Vercel sur les actions coûteuses : à faire.
- [x] `compasExplainVerdictAction` appelle l'IA sans `enforceRateLimit` : bornée par le
      seul quota IA par personne (lot O). **Lot R** : comptée par personne (`compas-verdict`,
      10 par 10 min, fermée) avant la lecture du voyage et l'appel IA ; refus dit
      (`verdictLimit.test.ts`).
- [x] Clés par adresse (essai sans compte, routes `/api` publiques) lues sur le premier
      `x-forwarded-for` : sûres sur Vercel (en-tête réécrit) seulement (lot O). **Lot R** :
      une seule lecture (`src/lib/rate-limit/clientIp.ts`) : `x-vercel-forwarded-for` sur
      Vercel, sinon la première adresse publique de `x-forwarded-for` en partant de la
      droite (relais privés sautés, ports retirés), sinon `x-real-ip`, sinon `inconnue` ;
      reprise sur l'essai, la connexion démo, `/api/discovery/search`, `/api/pays/[code]`,
      `/api/checkout`, `/go/[slug]` ; un test de garde casse si une route relit ces en-têtes
      (`clientIp.test.ts`, `clientIpUsage.test.ts`). Limite : sur Vercel, ne se vérifie
      qu'en production ; les IPv6 ne sont pas regroupées par /64.

### 2.3 Connexion démo

- [x] **Essai sans compte** (sessions anonymes Supabase, gratuites) à la place du compte
      démo partagé : bouton « Essayer sans compte » sur `/connexion`, compté par
      adresse (5/h) et pour le site (300/jour) ; la connexion démo se ferme d'elle-même
      dès que Supabase ouvre les connexions anonymes (`/auth/v1/settings`, relu toutes
      les 5 min). En base (`20261008165901`, appliquée le 8 oct.) : profil sans e-mail
      (`<id>@essai.invalid`), 38 politiques restrictives « rien de public ni de social
      depuis un essai », invitations refusées avec un message clair.
      **Prouvé en production le 8 oct.** : « Essayer sans compte » → compte anonyme,
      profil `…@essai.invalid` « Voyageur à l'essai », voyage « Randonnée · Vercors »
      préparé en 65 s (3 étapes, 253 €, 13 objets) ; une session anonyme qui écrit
      dans `community_posts`, `trip_invitations` ou `messages` reçoit 403 (RLS).
- [x] Tony (8 oct.) : purge lancée dans le SQL Editor (`purge_anonymous_users`, tâche
      `pg_cron` « purge-essais-anonymes » chaque nuit à 3 h 17, migration
      `20261008180000` inscrite) ; **Allow anonymous sign-ins** allumé.
- [x] Compte démo fermé : mot de passe remplacé par une valeur aléatoire tirée en
      base (personne ne la connaît) ; l'ancien mot de passe, publié dans le code,
      est refusé (8 oct.). Reste : retirer `DEMO_LOGIN_*` de Vercel (Tony, sans
      urgence : le bouton démo ne s'affiche plus).
- [ ] Captcha hCaptcha sur l'essai et l'inscription (compte gratuit à créer par Tony).
- [x] Mot de passe oublié (constat du lot AE) : le lien du courriel menait à `/connexion?code=…`, que rien
      n'échangeait. **Lot AF** : `redirectTo` = `/auth/callback?next=/connexion/nouveau-mot-de-passe` (garde
      `safeNextPath`), nouvelle page `/connexion/nouveau-mot-de-passe` (zod 8 à 72 caractères, `updateUser`
      côté serveur avec limite de débit) ; lien expiré → `?lien=echec`. 🔒 Tony : autoriser
      `<domaine de production>/auth/callback**` dans Supabase (Authentication → URL Configuration → Redirect
      URLs), puis un essai réel.
- [~] Garder son essai : lier un e-mail à la session anonyme (« manual linking » à
      allumer dans Supabase) au lieu de créer un nouveau compte qui perd le voyage. **Lot AE** :
      e-mail lié à la session (`updateUser({ email })`), mot de passe après confirmation (exigé par
      Supabase), page `/compte/garder-mon-essai`, ligne dans le Compas, lien depuis `/compte/voyageur` ;
      derrière `NEXT_PUBLIC_KEEP_TRIAL=on` (éteint par défaut), refus dits sans détail technique ; aucune
      migration (le trigger `on_auth_user_email_set` et la purge des seuls comptes anonymes existaient).
      Faille corrigée au passage : `/auth/callback?next=//autre.site` sortait du site. 🔒 Tony : Supabase
      « Allow manual linking », SMTP personnalisé (celui par défaut n'écrit qu'aux membres de
      l'organisation), `/auth/callback` autorisé, puis l'interrupteur ; preuve en production.
- [x] `DemoLoginButton.tsx` retiré (mot de passe du compte démo en clair, **encore
      valable** le 8 oct.) ; plus aucune exclusion du scan de secrets.
- [x] `scripts/compas/validate-online.mjs` : « Essayer sans compte » dès qu'il existe,
      sinon « Connexion démo ».

### 2.4 Données et droits

- [x] Liens d'invitation invisibles des simples lecteurs (8 oct.).
- [~] Tests pgTAP : `trip_invitations`, `geo_cache`, `route_cache`, `trips`,
      `trip_steps` (lecteur, éditeur, anonyme) ; CI `database-gates` activée. **Lot AB** : 154 assertions
      (`supabase/tests/database/compas_*_rls.test.sql` : propriétaire, éditeur, lecteur, étranger, anonyme) ;
      `database-gates` autonome sur un PostgreSQL 17 jetable (`.github/actions/ephemeral-postgres`,
      `scripts/db/ci/*`) : 66 suites, 1 320 assertions vertes en local sur 3 rejeux ; il était `skipped` faute
      de la variable `LKDV_DB_TESTS_ENABLED` et du secret de base distante, jamais créés. Une mutation des
      policies passe inaperçue (`trip_steps` WITH CHECK, masquée par la policy SELECT). Reste : un premier
      vert sur GitHub, puis le rendre requis sur `main`.
- [~] Revue de toutes les fonctions `SECURITY DEFINER` (search_path, droits `EXECUTE`) :
      conseiller Supabase lu le 8 oct. (31 fonctions ouvertes à `anon`, 67 à
      `authenticated`). **Deux failles fermées** (`20261008225921`) :
      `claim_reward_points` (n'importe qui créditait des points à n'importe quel compte)
      et `log_materiel_history` (historique écrit au nom d'un autre), réservées à la clé de
      service. Revue rejouée fonction par fonction le 8 oct. (`20261008231512`) : la
      migration du 21 septembre était bien passée, mais neuf fonctions avaient retrouvé
      `EXECUTE` pour PUBLIC. Refermées : `request_withdrawal`, `record_hike_gear_usage`,
      `toggle_community_post_like`, `get_user_badges_progress` (session requise, chacune
      vérifie `auth.uid()`) ; `get_comparable_sales`, `get_occasion_listing_for_product`,
      `get_hiking_routes_geojson`, `get_trail_pois_geojson`, `refresh_user_field_signature`
      (une session d'essai relançait à volonté une vue matérialisée) réservées au serveur ;
      7 fonctions trigger retirées à tous ; 2 `search_path` verrouillés (vérifié : mêmes
      résultats). Ouvertes à `anon` : 29 → 14 (droits de voyage et de groupe utilisés
      par les policies, drapeaux, données publiques, 3 PostGIS). ⚖️ Reste : vue `public_profiles` (nom, ville, bio et
      points de chaque compte lisibles sans connexion), décision de Tony.
- [x] Revue des policies « public » restantes (conseiller Supabase `get_advisors`, relu le 12 oct.) :
      aucune table exposée sans RLS hors `spatial_ref_sys` (table système de PostGIS, non modifiable) ;
      30 tables sous RLS sans policy = lisibles par le serveur seul (voulu) ; 6 vues matérialisées
      lisibles par session (`kit_trust_scores`, `kit_item_survival*`, densités de l'atlas) = agrégats
      publics voulus, lus par `/api/kits/*` et l'atlas ; `legacy_loyalty_level_for` : `search_path`
      verrouillé (`20261012143322`). Restent : vue `public_profiles` (⚖️ Tony, 2.4 ci-dessus) ;
      protection des mots de passe divulgués (HaveIBeenPwned) réservée aux offres payantes de Supabase.

### 2.5 Quota IA

- [x] Quota par personne appliqué (8 oct.).
- [x] Palier : la préparation est comptée en `heavy` comme le prévoit sa fiche
      (`quotaTier`), tout en gardant le modèle rapide (réponse longue, temps compté).
      Test TEST-ASK-04b.
- [x] Plafond global et fail-closed (1.7). **Lot AE** : plafond du site (`AI_DAILY_CAP`, 2 000 par
      jour) compté par jour UTC ; en production, compteur illisible ou seulement en mémoire = IA coupée,
      quota par personne fermé sur erreur (il s'ouvrait) ; cause `compteur_illisible` dite à la place de
      « quota épuisé » ; le Compas continue par règles (`siteCap.spec.ts`).
### 2.6 Préparation durable

- [x] Étapes écrites et **tracées au fil de l'eau** (aussi en passe unique) : dès
      l'itinéraire écrit, il est inscrit comme en attente et le reste est pris
      (`withStepsWritten`, `server/autofillState.ts`) ; une coupure ne laisse plus
      d'étapes orphelines, « Annuler » les retrouve toutes.
- [x] Budget interne vérifié dans la boucle de recherche des étapes : recherches de
      secours (pays voisin, autres noms, commune) seulement s'il reste 90 s (passe
      unique) ; lieux dits arrêtés 5 s avant l'échéance de la recherche.
- [x] Reprise idempotente après coupure : une passe unique relancée reprend
      l'itinéraire en attente (`resumableRun`) au lieu d'en écrire un second ; pendant
      la préparation, la prise du reste fait attendre une relance ; une attente
      coupée est dite « coupée », plus « en cours ». Tests `autofillState.test.ts`
      (coupure simulée après l'itinéraire : annulation, reprise, prise, expiration).
- [x] Commentaires « 60 s » mis à jour (300 s ; 48 s par phase gardés et expliqués).
- [x] Prise `steps` jamais rendue sur les sorties anticipées (« Dis-moi où tu pars »,
      « Itinéraire non enregistré », `catch`) : une relance attend jusqu'à 290 s (lot O).
      **Lot R** : `compasAutofillAction` suit la prise prise par CETTE exécution et la
      rend sur toute sortie qui ne l'a pas rendue par son écriture de fin, jamais celle
      d'une autre préparation (`autofillCut.test.ts`).
- [x] « Annuler » garde `autofill_claim` : juste après, une relance attend jusqu'à 290 s
      (lot O). **Lot R** : `compasUndoAutofillAction` retire aussi les prises
      (`autofillCut.test.ts`). Limite : « Annuler » ne distingue pas une préparation
      vivante d'une préparation coupée depuis moins de 290 s ; l'interface ne le propose
      qu'après une préparation finie.
- [x] « Arrêter » pendant l'application des réglages : `stopped.current` n'est vérifié
      qu'après la compréhension de la phrase ; un appui pendant `runOps` est écrasé par
      `setPrep({stage:'itinerary'})` et le panneau reste bloqué (`CompasScreen`,
      pré-existant, relevé au lot N). **Lot R** : relu après chaque `runOps` et la
      suppression de la phrase, avant `setPrep` ; la phrase reste sur le voyage,
      « Reprendre » la rejoue (`compasScreen.test.tsx`).

### 2.7 Écritures concurrentes

- [x] Écritures de `trips.metadata` conditionnées (`updateTripMetadata`) : écriture
      seulement si `updated_at` n'a pas bougé depuis la lecture (le trigger
      `trg_trips_updated_at` le remet à `now()` à chaque mise à jour, par n'importe quel
      chemin), sinon relecture et patch rejoué (4 essais) ; refus sans course (droits)
      rendu aussitôt. Les 18 écritures du Compas y passent, `patchTripMetadata` retiré.
      Sans migration. Tests `tripMetadata.test.ts` (écriture concurrente gardée,
      colonnes jointes, rien à écrire, droits, course sans fin, filtre propriétaire).

### 2.8 Attente de la préparation

- [x] Plus de rendu complet toutes les 4 s : la relecture de l'issue rend aussi un
      repère du voyage (`updated_at` et nombre d'étapes) ; la page n'est relue que s'il
      a changé (étapes écrites, tracé, issue). Tests : repère (autofillStart), une seule
      relecture pour un voyage inchangé (compasScreen).

### 2.9 Observabilité à 0 €

- [x] Table `app_errors` (lot L) : chaque erreur des actions serveur du Compas (42
      blocs : préparation, phrase, destination, équipe, Résa, bouteille, points),
      rédigée (ni e-mail, ni jeton, ni identifiant, ni adresse IP, ni coordonnée à
      3 décimales ou plus), tronquée à 300 caractères, 60 lignes par minute et par
      instance au plus, enregistrement borné à 2 s ; lisible par la seule clé de service
      (RLS, aucun droit pour `anon` ni `authenticated`, vérifié en base). Comptée par le
      rapport quotidien (1.1). 🔒 Purge à 30 jours : `20261009100000_app_errors_purge.sql`
      à lancer par Tony.
- [x] `src/app/compas/error.tsx` (aucun message interne, référence `digest` des
      journaux Vercel, « Réessayer » relit le serveur) et `loading.tsx` ;
      `global-error.tsx` ne dit plus « l'équipe a été notifiée ».
- [x] Erreurs internes jamais affichées : l'échec du calcul d'itinéraire dit « erreur de
      calcul » (le message va au journal) ; la recherche partenaire ne montre plus que
      le code et le statut (message brut, cause et échec Viator au journal).

### 2.10 RGPD

- [x] Position GPS arrondie (≈ 1 km) avant tout envoi à un tiers : fait pour la
      préparation du Compas (lot F). **Lot AA** : arrondie dès l'appareil ; la base d'un séjour
      sans lieu dit est la commune (`engine/privacy.ts` `positionBase`, `placeLookup.ts`
      `lookupCommune`), le point arrondi n'est gardé que si la carte ne nomme aucune commune
      (`positionBase.test.ts`) ; politique de confidentialité mise à jour. Hors périmètre, à
      revoir : les publications de la communauté gardent une position à 4 décimales (≈ 11 m,
      publiée) ; messages de clubs et de groupes, tribu, hub, Explorer, Partir librement et
      cockpit (partage voulu ou traces de randonnée).
- [~] Explication de la demande de position : pendant la préparation (le navigateur
      la demande au lancement), « sert au trajet d'approche, arrondie à environ 1 km,
      sans elle le trajet reste à préciser » ; refuser ne bloque rien (déjà le cas).
      Reste : origine demandée en texte (4.3).
- [x] Politique de confidentialité à jour, **une seule version** (`PrivacyPolicySections`,
      rendue par les vues mobile et ordinateur, qui se contredisaient) : chaque
      prestataire appelé par le code, ce qu'il reçoit et où (Supabase, Vercel, NVIDIA et
      OpenRouter, Gemini, Photon, LocationIQ, Geoapify, FOSSGIS, Overpass, Esri, MET
      Norway, NASA POWER, Terrain Tiles, RouteStack, Viator, hCaptcha, Google Analytics) ;
      bases légales ; date de mise à jour.
- [~] Durées de conservation écrites : essai sans compte 7 jours sans usage (purge
      nocturne en production) ; caches 1 h à 30 jours (récits de sentiers 1 an) ;
      statistiques 90 jours ; compte + 3 ans. 🔒 Effacement effectif des caches et
      journaux expirés : migration `20261008190000` à lancer par Tony.
- [x] Compteurs anti-abus : la clé (identifiant ou adresse IP) n'est stockée qu'en
      HMAC-SHA-256 avec la clé de service (un SHA-256 seul d'une IPv4 se retrouvait en
      essayant les 2³² adresses). Test `rate-limit.spec.ts`.

### 2.11 En-têtes et cookies

- [~] CSP appliquée (plus seulement `Report-Only`) après une semaine de rapports propres. **Lot AE** :
      les rapports partaient vers `/api/telemetry/hub`, qui les refusait (400/401) : aucune semaine
      n'existait. `/api/csp-report` les range dans `app_errors` (portée `csp`, directive, hôte bloqué, début
      du chemin ; 60 par 10 min et par adresse, 2 000 par jour) ; `csp_report_summary(7)` et colonne
      `csp_reports` du rapport quotidien (appliquée en production le 13 oct. ; dans le dépôt : `20261013004818_hotfix.sql`, la version du registre de production).
      Reste : une semaine lue, puis le mode appliqué.
- [x] Cookies `SameSite` revus (lot L) : session Supabase en `Lax` côté navigateur et
      côté serveur (essai sans compte, retour OAuth, rafraîchissements) — elle était en
      `None` partout ; le site envoie `X-Frame-Options: DENY`, `None` ne servait à
      rien. Les autres cookies (`lkdv_kit_ref`, aventure active, langue) étaient déjà
      `Lax`.

### 2.12 Tests

- [x] Tests d'autorisation réels de `requireEditor` (sans simulation). **Lot Z4** :
      `requireEditorAuthorization.test.ts` (34 tests, helper `tripRls.ts`) : `requireEditor` et
      `compasSetBudgetAction` s'exécutent pour de vrai ; propriétaire, co-propriétaire, éditeur et
      propriétaire en essai passent ; lecteur, étranger (voyage privé, public, non répertorié), essai
      étranger, voyage inexistant et sans session sont refusés sans écriture ; quatre mutations de
      `requireEditor` font échouer les tests. ⚠️ Le client en mémoire ne rejoue pas la RLS : elle est
      portée à la main depuis `20260904050000_trips_core.sql` (un bloc de tests garde ce portage
      fidèle) ; les rôles et politiques PostgreSQL restent à éprouver par pgTAP (2.4).
- [x] Test du contournement de la limite (2.2) et de la coupure (2.6) (lot O) :
      `limitBypass.test.ts` (14 tests, session et compteur en base réels : clé HMAC de la
      session, voyage, lieu, texte ou slug sans effet, compteur en panne ou muet → refus)
      a trouvé un **contournement réel, fermé** : une préparation en phase « rest » sans
      itinéraire en attente échappait à la limite des lancements ; `autofillCut.test.ts`
      (6 tests : coupure, reprise sans étape en double, « Annuler », « Arrêter »).
- [~] **E2E Compas bloquant en CI** (préparation simulée, sans réseau externe). **Lot AB** :
      `playwright.compas.config.ts`, `tests/e2e/compas/*` : Où → Préparer → résultat sur le Next de
      production inchangé (aucun code de test dans `src/`), PostgREST réel (binaire épinglé par sha256) sur la
      base du dépôt donc vraie RLS, GoTrue simulé, services tiers rejoués depuis des réponses réelles
      enregistrées (un appel imprévu fait échouer) ; 2/2 verts × 3 en local (≈ 25 s) ; job `e2e-compas`.
      Reste : un premier vert sur GitHub, puis le rendre requis sur `main`.
- [x] Plus aucun test unitaire qui appelle un serveur public (comme P024-09, corrigé)
      (lot O) : garde imposé à chaque fichier (`tests/setup/no-network.ts` dans
      `setupFiles` : fetch, http, https, net, tls, WebSocket ; un appel rattrapé par le code
      fait aussi échouer le test), 8 fichiers corrigés (Overpass, MET Norway, Terrain Tiles
      simulés), preuve `tests/config/no-network.spec.ts`.

---

## Phase 3 — Données : référentiel géographique local (P1.1)

### 3.1 Table et accès

- [x] Migration `geo_places` (`20261008190319`) : identifiant GeoNames, nom, nature
      (ville, bourg, village, hameau), pays, région (code admin1), latitude, longitude,
      altitude, population, fuseau horaire, date de mise à jour ; compacte (sans
      géométrie PostGIS ni trigrammes) : index point GiST et pays × population (≥ 1 000).
      Lecture publique, écriture par la clé de service seule.
- [x] RPC `geo_places_in_box(w, s, e, n, kinds, limit)` : 20 ms pour le Vercors (357
      lieux). [ ] `geo_places_search(q, cc, limit)` (noms français : `alternateNamesV2`)
      reste à faire ; la recherche de destination passe encore par Photon, LocationIQ
      et Geoapify.
- [x] Budget mesuré : 367 747 lieux, 74 Mo ; base de 354 à 428 Mo. 🔒 Retrait de
      `places_geo` (−232 Mo) par Tony maintenant que les pages Pays lisent `geo_places`.

### 3.2 Import des lieux habités

- [x] Import du 8 octobre : GeoNames `cities500` (CC BY 4.0, 246 pays) + tous les lieux
      habités de France (80 299), Suisse, Italie et Autriche ; préparation locale
      (`scripts/geo/prep_geo_places.py`), écriture par une fonction Supabase temporaire
      protégée par un secret à usage unique, désactivée ensuite (410). Réimport mensuel :
      tâche GitHub Actions à brancher sur `SUPABASE_DB_URL` (secret de Tony).
- [x] `lookupAreaPlaces` lit le référentiel d'abord ; Photon n'est demandé que pour les
      refuges et campings (absents de GeoNames), ou pour compléter une zone maigre hors
      des pays détaillés. Pages Pays (`fetchPlacesByCountry`) sur `geo_places` ;
      `places_geo` n'est plus lu nulle part (lecteurs morts retirés). Preuve en ligne : préparations Vercors, Dolomites,
      Patagonie (journal « Référentiel N », sans « Photon » pour les lieux habités) ;
      **production** (8 oct., 23 h 20, `f5b5ac9`) : Bauges, 263 lieux sur 374 tirés du
      référentiel (cache `area:v3`), préparation prête en 48 s.

### 3.3 Massifs, parcs, régions naturelles

- [~] GeoNames classes T et L + OSM `boundary=national_park/protected_area` (emprise
      rectangulaire), import par lot hors Vercel.
      **Lot AK (OSM seulement, prêt, rien en base)** : `geo_areas` (migration `20261017132000_geo_areas.sql`),
      `engine/geoAreas.ts` (parcs nationaux, espaces protégés de classe 1 à 6, réserves nommées ; emprise et centre,
      `normalizeAreaName`, `pickArea`, 18 tests), `scripts/geo/import_geo_areas.ts`, lecteur `server/geoAreas.ts`
      derrière `COMPAS_GEO_AREAS` (éteint). **Branchement fait (non prouvé, tables vides)** : `lookupNatural` lit d'abord `referentialArea` (avant les massifs).
      **Reste** : fonctions `finish_tile`, import (essai `--dry-run` : Overpass accepte-t-il `wr` ?), allumer `COMPAS_GEO_AREAS`,
      **Massifs GeoNames (lot AL)** : table `geo_massifs` (appliquée en base le 17 oct., sans emprise : GeoNames donne un point), `engine/geoMassifs.ts`
      (MTS, HLLS, PLAT, UPLD, PEN, MT nommé « massif », RGN), `scripts/geo/import_geo_massifs.ts` (`--file` ou `--country`, essai par défaut),
      lecteur derrière `COMPAS_GEO_MASSIFS` (éteint), branché dans `lookupMassif` (emprise nulle : rayon par défaut de 60 km). **Reste** : essai réel
      `--country FR --dry-run` pour mesurer les volumes (HLLS et RGN mondiaux inconnus), import, allumer l'interrupteur ; `RGN` et `PEN` stockés mais
      branchés nulle part.

### 3.4 Refuges, cabanes, campings, points d'eau

- [~] OSM `tourism=alpine_hut/wilderness_hut/camp_site`, `amenity=drinking_water`,
      import par pays (Overpass hors Vercel, en série, une fois par mois). **Import Alpes du 18 oct.**
      (`ETAT.md`, commit `c9f416b6`) : 112 400 points, 71 tuiles sur 72 (tuile lon 16 / lat 47 en 500
      sur Overpass) ; France non lancée ; `COMPAS_GEO_POIS` toujours éteint. **Lot AG (prêt, rien en base à l'époque)** :
      table `geo_pois` (migration `20261014090500_geo_pois.sql`, lecture serveur seule), script
      `scripts/geo/import_geo_pois.ts` (Overpass private.coffee par tuiles, en série, upsert idempotent,
      `--dry-run`) : refuges, cabanes, campings, abris de montagne, eau potable, sources (OSM, ODbL). Mesuré
      sur un quart du Vercors : 1 250 lignes, 0,25 Mo (210 octets par ligne) ; Alpes ≤ 72 000 lignes
      ≤ 14,4 Mo, France ≤ 48 600 lignes ≤ 9,7 Mo : la base passerait à ≈ 223 Mo après le retrait de
      `places_geo`, sous la cible de 250 Mo. Lu avant Overpass derrière `COMPAS_GEO_POIS` (éteint). Constats :
      OSM n'a pas de balise « gardé » (champ non importé) ; private.coffee a répondu 504 à 3 requêtes sur 7
      et sa base OSM date du 15 juillet ; `geo_places` est en lecture publique, contraire à la règle ODbL de
      `SERVICES-GRATUITS.md` (à revoir). 🔒 Tony, dans l'ordre : retrait de `places_geo` ; migration et secret
      `SUPABASE_DB_URL` ; prévenir support@private.coffee ; import `vercors`, `alpes`, `france` ; puis
      `GEO_POIS_IMPORT=on` et `COMPAS_GEO_POIS=1` dans Vercel.

### 3.5 Escalade et ski

- [~] OSM `climbing=crag/area`, `landuse=winter_sports`, stations ; corrige Kalymnos
      (Masouri), Dolomites (via ferrata).
      **Lot AI (prêt, rien en base)** : `geo_sites` (migration `20261017130000_geo_sites.sql`, rejouée deux fois dans
      une base jetable), `engine/geoSites.ts` (crags, zones d'escalade, via ferrata, domaines et gares de remontée ;
      `densestSite` pour Kalymnos, `sitesAround` pour les via ferrata, 17 tests), `scripts/geo/import_geo_sites.ts`,
      lecteur `server/geoSites.ts` derrière `COMPAS_GEO_SITES` (éteint). **Branchement fait (non prouvé, tables vides)** : base d'escalade (`climbingBase`, Masouri attendu) et via ferrata autour
      des étapes (catégorie `via_ferrata`) ; **ski branché** (lot AM : base au pied du domaine skiable le plus dense, gares de remontée proposées, jamais comme lieu de nuit ; rayons de 5 km choisis, non mesurés). **Reste** : fonctions `finish_tile`, import (Kalymnos :
      `--bbox 26.75,36.75,27.25,37.25 --tile 0.25`, hors zones nommées), preuve sur « escalade à Kalymnos » (Masouri,
      pas Myrties) et « via ferrata dans les Dolomites ».

### 3.6 Rivières navigables

- [~] OSM `waterway=river` avec `canoe=*`/`whitewater=*` (tracé simplifié) ; noms
      « Río », « River », « Fluss »… reconnus.
      **Lot AJ (prêt, rien en base)** : `geo_rivers` (migration `20261017131000_geo_rivers.sql`), `engine/geoRivers.ts`
      (relations nommées et tronçons avec canoë ou eau vive, noms « Río », « River », « Fluss » ramenés à une clé,
      `pickRiver`, 18 tests), `scripts/geo/import_geo_rivers.ts`, lecteur `server/geoRivers.ts` derrière
      `COMPAS_GEO_RIVERS` (éteint). **Branchement fait (non prouvé, tables vides)** : `lookupRiver` et le chemin canoë d'`autofillActions.ts` lisent d'abord
      le référentiel (emprise de la rivière pour `riverQuery`). **Reste** : fonctions `finish_tile` (SQL Editor), import, allumer
      `COMPAS_GEO_RIVERS`, preuve sur « Le Tarn », « la Dordogne », « Río Colorado » ; canoë/difficulté OSM non utilisés ; garde-fou
      de pays pour les homonymes.

### 3.7 Grands itinéraires

- [~] OSM `route=hiking` réseaux `iwn`/`nwn` (GR20, TMB, Kungsleden, JMT, Annapurna) :
      tracé simplifié et étapes ; « GR34 » et voisins sans liste en dur.
      **Lot AH (prêt, rien en base)** : table `geo_trails` (migration `20261017120000_geo_trails.sql`, lecture
      serveur seule : une ligne par relation, référence normalisée, nom, centre et emprise, jamais le tracé),
      `engine/geoTrails.ts` (requête Overpass, lecture, `trailRefIn`, `pickTrail`, 14 tests), script
      `scripts/geo/import_geo_trails.ts` (mêmes zones, grille et options que `import_geo_pois.ts`), lecteur
      `server/geoTrails.ts` derrière `COMPAS_GEO_TRAILS` (éteint). **Branchement fait (non prouvé, tables vides)** : `server/trailDestination.ts` dans `compasSetDestinationAction`
      (destination au centre du tracé, emprise, pays par géocodage inverse), repli exact sur `trailRegion`. **Reste** : importer,
      allumer `COMPAS_GEO_TRAILS`, prouver sur « GR 7 » et « TMB » ; **Champ `trail` sur `set_destination` fait** (lot AN) : « GR34 en 8 jours » garde Bretagne et l'envie GR34 et porte la référence jusqu'au
      serveur ; un code absent de `FAMOUS_TRAILS` (« GR7 ») ne produit toujours aucune destination par les règles (changerait le comportement éteint).

### 3.8 Pages Pays et retrait de `places_geo`

- [x] Pages Pays lues dans `geo_places` (par pays ; `fetchPlacesByCountry`), en
      production depuis `f5b5ac9` (France, Italie, Népal : 200).
- [x] Suppression de `places_geo` (−232 Mo), via SQL Editor si le connecteur refuse.
      Faite par Tony ; constatée en base le 17 oct. (`ETAT.md`, `3c7eb353`), voir 1.1.

### 3.9 Mise à jour

- [~] GitHub Actions mensuel : réimport idempotent (upsert sur identifiant source),
      retrait des lieux absents deux fois de suite ; attributions GeoNames et ODbL. **Lot AG** :
      `.github/workflows/geo-pois-monthly.yml` (le 5 du mois, reprises les 12 et 19), inerte sans le secret
      `SUPABASE_DB_URL` et la variable `GEO_POIS_IMPORT=on`. **18 oct.** : `geo-places-monthly.yml`
      (le 1er du mois, concurrence partagée), inerte sans `SUPABASE_DB_URL` ni `GEO_PLACES_IMPORT=on` ;
      `import_geo_places.ts` lit les dumps GeoNames lui-même (`--cache-dir`, essai par défaut, `--apply`,
      `--max-db-mb`), une ligne inchangée n'est pas réécrite. Rien en base. Reste : retrait des lieux
      absents deux fois de suite pour `geo_places` (aucune colonne « vu le » aujourd'hui).

---

## Phase 4 — Moteur

### 4.1 Contexte voyageur

- [x] Profil : nationalité, pays de résidence, devise, langue, fuseau, domicile (ville) ;
      demandé une fois, modifiable dans `/compte` ; les réglages du compte (unités,
      devise, fuseau) enfin lus. Lot P : table privée `user_traveller` (RLS de la personne
      seule, aucun droit pour anon, essai sans compte refusé, domicile à 0,01° par la base),
      question posée une fois dans le Compas vide (« Passer » range une ligne vide) et page
      `/compte/voyageur` (bureau et téléphone). Aucun réglage du compte n'existait côté
      serveur (devise et fuseau de `/compte` restaient dans le navigateur, jamais relus) :
      ils passent au profil, le fuseau sert de repli à « aujourd'hui » ; unités : 6.3
      (`traveller.test.ts`, `travellerActions.test.ts`, `travellerCard.test.tsx`, sonde
      `scripts/verify/user_traveller_rls_probe.sql`).
- [x] Sans profil : rien d'affirmé qui dépende de la nationalité. Lot P : papiers,
      formalités, prises, change et consignes de l'IA lisent le profil ; sans nationalité
      connue, une ligne « à vérifier auprès du service officiel de ton pays », ni France
      Diplomatie, ni formalités chiffrées, ni « adaptateur à prévoir » (`papers.test.ts`,
      `nationalityPrompt.test.ts`, `travel.test.ts`).
- [x] Nationalité française lisible dans les papiers d'un voyage partagé : la base de la dépense
      « Formalités » (« ressortissant français ») et les notes de papiers rangées sur le voyage
      laissent deviner la nationalité aux collaborateurs (et à tous pour un voyage public) ;
      les rendre à l'affichage pour la seule personne concernée (lot Q, avec la table
      passeport × destination). **Relecture de la PR #90** : la ligne « Papiers » tirée de la table
      (qui identifiait un passeport rare, 506 des 1 271 groupes n'en contiennent qu'un) n'est plus
      JAMAIS rangée sur le voyage : seule la ligne neutre l'est, plus le pays et le départ ; la
      ligne du passeport du LECTEUR est rendue à la lecture par `getCompasData` (profil du lecteur
      authentifié, jamais celui du propriétaire) ; verrou testé par mutation
      (`papersPrivacy.test.ts`, `traveller_privacy.mjs`). **Reste** : (a) la dépense « Formalités »
      (existence = nationalité française ; demande de la rendre à la lecture, dépense virtuelle par
      lecteur) ; (b) fuites voisines : ligne « Prises » (selon `frenchDevices`) et conseils de change
      gardés par l'IA (selon la devise du lanceur) rangés sur le voyage, même remède (ligne neutre
      rangée, rendue à la lecture) ; (c) voyages DÉJÀ préparés : leur ancienne ligne reste dans
      `trips.metadata` jusqu'à une relance (l'écran ne la montre plus) ; rattrapage = SQL de données,
      non écrit.

### 4.2 Papiers, prises, change

      **Lot Z1** : reste (a) à (c) traité : la dépense « Formalités » n'est plus rangée (ni dans
      `trip_expenses`, ni dans `autofill_result`, ni dans le total) ; elle est calculée à la lecture pour
      le LECTEUR (`readerFormalities` : `entryFor`, `entryFees`, seulement si la table dit visa ou
      autorisation et lecteur de nationalité française) et affichée à part du budget (« non compté dans
      le total du voyage ») ; la ligne « Prises » et les conseils de l'IA ne se rangent plus que neutres ;
      la consigne envoyée à l'IA est unique et sans nationalité ; verrou étendu (`abroadCosts`,
      `formalitiesBasis`, `frenchDevices`, `keepAiNote`…) avec contrôle par mutation sur les vrais
      fichiers (`formalities.test.ts`, `papersPrivacy.test.ts`, `travellerPrivacy.test.ts`).
      **Rattrapage des voyages déjà préparés** : `supabase/maintenance/lot_z1_vie_privee_rattrapage.sql`
      (ÉCRIT et rejoué sur un PostgreSQL 16 jetable, NON APPLIQUÉ : à passer par Tony dans le SQL Editor,
      sur une copie d'abord, étapes A puis B puis A). Limite : le domicile du profil reste un fait du
      voyage choisi par le lanceur ; un voyage d'avant sans faits rangés dont le départ était dans le pays
      peut montrer « Formalités » à tort à un lecteur français (cas rare).
      **Après relecture (PR #91)** : (1) `isStoredFormalities` (`engine/storedFormalities.ts`) reconnaît
      toute dépense « Formalités : » signée par une préparation, PRÉVUE et jamais retouchée, quelle que
      soit sa base ; une ligne réglée ou retouchée reste comptée, dans le Compas comme dans `/voyages`
      (même filtre dans `loadFullTripDetails`) ; (2) le SQL de rattrapage ne SUPPRIME que ces lignes
      (prévues, `updated_at` au plus 5 s après `autofill.at` et après `created_at`), NEUTRALISE la base des
      autres, vide l'enveloppe (`estimated_budget` NULL) quand les formalités en étaient tout le montant,
      et sa reconnaissance suit celle du code (plus de filtre sur le texte de la base : seulement « pas
      déjà neutre », pour rester rejouable) ; rejoué sur un PostgreSQL 16 jetable avec la reconnaissance
      d'avant (base « ressortissant français ») : le prédicat élargi à toute base n'a pas été rejoué sur
      une base ; (3) quand le départ vient du domicile, l'IA ne reçoit plus ni km, ni minutes, ni vol, ni
      train, ni voiture de location (« Voyage à l'étranger : inconnu », `travelFactsForAi`) et les textes
      rangés n'en portent plus ; (4) `abroad` est inconnu pour tout lecteur autre que le lanceur quand il
      découle du domicile ou de la position (`abroadFrom`, `launchedBy`, `abroadForReader`) ; (5) la carte
      « Formalités d'entrée pour toi » montre le montant PAR PERSONNE ; (6) `usedAi` ne vaut vrai que si
      une note ou une étape vient de l'IA ; (7) les minuteurs de relance de `CompasScreen` sont annulés
      au démontage. **Limites** : un voyage préparé avant ce correctif n'a pas `abroadFrom` (il garde
      l'ancien comportement : `abroad` appliqué à tous) ; `summary.transport` (km, minutes) reste dans
      `autofill_result` pour le résumé du lanceur ; les montants du budget (carburant, vol, train) restent
      proportionnels à la distance, et la présence de « Assurance » ou « Location de voiture » découle
      encore de `abroad`.
- [x] Table passeport × destination tirée de **travelrequirements.info v1.3.0**
      (CC BY 4.0, commercial autorisé, crédit exact de l'éditeur), versionnée dans le
      code. Les jeux dérivés de Passport Index sont exclus (recherche académique
      seulement). **Lot T** : `scripts/compas/build-entry-requirements.mjs` (liste fermée
      des exigences, toute valeur inconnue fait échouer) → `data/entryRequirements.json`
      (174 Ko, 39 601 lignes) + `.meta.json` (version, licence, dates de vérification,
      sha256) ; `engine/entry.ts` + module serveur seul ; la ligne « Papiers » vient de la
      table quand une ligne existe (datée), sinon les règles d'avant ; « Formalités »
      chiffrée seulement si la table dit qu'un visa ou une autorisation est requis(e) ;
      crédit exact dans les mentions légales (`entryRequirementsBuild.test.ts`,
      `entry.test.ts`, `papers.test.ts`, `autofillPapers.test.ts`, `dataCredits.test.tsx`).
      Pas de barème de frais par nationalité (la table ne porte aucun montant).
- [x] Budget aussi dans la devise du pays de destination (taux Frankfurter v2, 223
      devises, déjà branché) : aujourd'hui seulement si la devise du voyage est l'une des
      six de l'enum `trip_budget_currency`, et le Compas ne la change jamais. **Lot W** :
      devise du pays d'après la liste ISO 4217 n° 1 de SIX (246 pays, publiée le 17 sept.
      2026, `scripts/compas/build-country-currencies.mjs`), conversion AFFICHÉE avec taux,
      date et source, rien de stocké (enum non touché, aucune migration) (`countryCurrencies.test.ts`,
      `budgetFx.test.ts`, `compasScreen.test.tsx`). ⚠️ Le fichier SIX ne porte aucun texte de
      licence : crédité dans les mentions légales, licence à confirmer par Tony.
- [x] Prises et change selon le pays de résidence ; « France Diplomatie » pour les
      Français seulement, le service officiel du pays sinon. Lot P : France Diplomatie et
      « adaptateur à prévoir » seulement pour une nationalité ou une résidence françaises
      connues ; ailleurs le type de prise du pays, un fait. **Lot Z1** : la ligne « Prises »
      ne range plus que le fait du pays ; celle du lecteur (`frenchDevices(lecteur)`) est rendue
      à la lecture (`papers.test.ts`, `papersPrivacy.test.ts`). **Pas fait** : prises d'une
      résidence hors de France pour d'autres pays que les 10 de `PLUGS` (table des prises par
      pays) et ligne de change calculée à la lecture avec la devise du lecteur : le conseil de
      change de l'IA est maintenant écarté en zone euro pour tous (régression assumée du choix neutre).
      **Lot AC** : prises, tension et fréquence de 228 pays (`data/mainsElectricity.json`, script
      `scripts/compas/build-mains-electricity.mjs`) tirées de Wikipédia « Mains electricity by country »
      (révision 1379647853 du 11 oct. 2026, CC BY-SA 4.0, crédit dans les mentions ; le site « World
      Plugs » de la CEI, illisible le 12 oct., a été retiré en septembre 2026) ; « adaptateur à prévoir »
      calculé à la lecture selon la résidence de n'importe quel lecteur ; lignes « Courant » et
      « Change » (devise dite, sinon celle de la résidence) rendues à la lecture seulement, verrou de
      vie privée étendu (`scripts/verify/traveller_privacy.mjs`). Reste : 20 territoires non renseignés ;
      la table ne dit pas qu'un type est rare (C à Singapour, en Malaisie) ; ⚖️ licence CC BY-SA du
      fichier dérivé (partage à l'identique) à valider par Tony.
- [x] `keepAiNote` ne retire plus les conseils justes pour un non-Français. Lot P : le change
      est gardé pour une devise connue autre que l'euro, les prises quand la règle ne sait
      pas ; les papiers restent à la règle (`papers.test.ts`). **Lot T** : les papiers sont
      décidés par la règle pour toute nationalité connue, via la table (Allemand, Américain :
      `papers.test.ts`, « keepAiNote — un non-Français garde ses conseils justes »).
- [x] Mise à jour des barèmes périmés (ESTA, exemption Vietnam) avec date de vérification.
      **Lot T** : Vietnam (sans visa 45 jours pour un Français, e-visa retiré), Rwanda (visa
      à l'arrivée gratuit 30 jours, 50 € retiré), Laos (détail neutre), ESTA (40 $ depuis le
      30 septembre 2025, soit ~35 €) ; la ligne « Papiers » et la base de « Formalités »
      portent la date de vérification de la table (`costs.test.ts`, `autofillPapers.test.ts`).
      ⚠️ Montant ESTA lu sur des sites citant CBP : cbp.gov n'était pas joignable depuis le
      bac à sable ; à reconfirmer, conversion ~1,15 $/€.
- [x] Note de papiers jamais perdue par la troncature : l'essentiel (papiers, sécurité)
      passe avant les notes de préparation et les suggestions de l'IA (`orderNotes`, 8
      notes), lot K.
- [x] Hypothèses « voyageur français » encore en place, jusqu'au profil (4.1), à ne pas
      confondre avec le départ, qui ne vaut plus la France par défaut (4.3) : le prompt
      système de l'IA (`src/lib/ai/features/compasAutofill.ts`, règles 8a et 8b ; la 8a
      écrit « une personne qui part de France ») et le barème `entryFees` (« voyageur
      français », `engine/costs.ts`). Lot P : 8a neutre sans nationalité française connue,
      plus jamais « part de France » ; règle 11 de l'itinéraire sans « voyageur français » ;
      `entryFees` réservé aux ressortissants français (`nationalityPrompt.test.ts`,
      `travel.test.ts`).

### 4.3 Origine du voyage

- [x] Origine = ville dite (« depuis Lyon »), domicile du profil ou GPS ; **jamais la
      France par défaut** ; sans origine, le trajet n'est pas chiffré (dit à l'écran).
      Lot N : départ dit (`metadata.compas.origin`) > GPS > aucun ; plus de Paris ni de
      « depuis la France » ; sans départ, rien de chiffré et « Trajet non chiffré : point de
      départ inconnu » (`travel.test.ts`). Lot P : domicile du profil après le départ dit et
      avant la position, rangé à 0,01° et cherché une seule fois, à l'enregistrement ;
      « (depuis ton domicile) » et une note, jamais le nom du domicile sur le voyage ni pour
      l'IA (`travelHome.test.ts`).
- [x] Action « depuis X » dans la compréhension de la phrase. Lot N : `set_origin` lu par les
      règles (« depuis », « au départ de », « en partant de », « on part de », « je pars
      de », « nous partons de »), jamais pris pour la destination, appliqué par la même
      recherche que la destination (`intentOrigin.test.ts`, `originInterpret.test.ts`,
      `originAction.test.ts`).
      Sans lieu dit, la préparation se fait autour du départ dit (avant la position), et la
      lecture sans majuscule se limite à « depuis » et « au départ de » (un faux départ
      serait appliqué sans validation au démarrage). Départ dit visible et effaçable : la carte
      Où affiche « Départ dit : Lyon · le trajet d'approche se chiffre depuis là » et, pour un
      éditeur, « Effacer le départ » (`compasSetOriginAction` avec `place: null`) ; « Annuler »
      le rétablit tel que rangé (`restore`, sans nouvelle recherche) ; un lecteur le voit sans
      bouton (`OriginLine` dans `CompasCards.tsx`, `departureUi.test.tsx`).
      « en » et « sur » dans le nom (« Bourg en Bresse », « La Roche sur Yon », « Neuilly sur
      Seine ») : le nom court reste le départ, le nom long est confirmé par la carte
      seulement s'il existe tel quel, sinon « depuis Lyon en Corse » donne départ Lyon et
      destination Corse (`settleLinkedOrigin`, `originInterpret.test.ts`). **Pas fait : le
      même découpage pour une destination** (« à Bourg en Bresse » se lit « Bourg ») et la
      ligne « Lieu » de l'aperçu de `CompasStart`, qui lit encore « Bresse » avant l'envoi.
- [x] Aéroport le plus proche de l'origine et de la destination (OurAirports, CC0). Lot N :
      3 244 aéroports desservis (domaine public), un aéroport moyen compte 1,6 fois sa
      distance, vol d'aéroport à aéroport (« LYS → CAG », `airports.test.ts`, `travel.test.ts`).

### 4.4 Trajets

- [~] Train hors des 10 pays (Europe entière, Japon, Corée, Chine, Inde, Amérique du
      Nord) par règles de distance et de réseau ; barème par pays. **Lot X** : Europe 32 pays
      (10 d'origine, PT DK SE NO PL CZ SK HU SI HR RO BG RS GR ME MK BA ; IE FI EE LV LT en train
      intérieur seulement), JP, KR, CN, IN, 12 corridors Amtrak/VIA ; tout est « estimation »
      datée 2026-10 (aucune source gratuite) (`railWorld.test.ts`). **Lot X2** : Turquie (YHT et
      express, réseau seul, barème 0,03 €/km recoupé sur la grille YHT d'août 2026 rapportée par la
      presse, `TR_FARE_CHECK`, TCDD injoignable le 2026-10-17), Géorgie, Arménie, Azerbaïdjan (un
      réseau par pays) ; Chypre, Malte, Islande : « aucune ligne de train de voyageurs » dit (pays du
      domicile jamais nommé) ; Gökçeada et Bozcaada en îles. **Écartés à dessein, rien affirmé** :
      UA, RU, BY, MD (guerre, frontières, réseau illisible d'ici), AL (voyageurs suspendus), XK (une
      ligne, deux ou trois trains par jour). **Reste** : trains longue distance d'Amérique du Nord non
      comptés (et dit) ; prix hors Turquie non vérifiés contre une source libre ; liaisons
      Istanbul–Sofia et Tbilissi–Bakou non comptées.
- [x] Préférence « sans voiture » ; transports en commun quand la zone en a. **Lot X** : phrase
      comprise (`set_car_free`), réglage à l'écran, trajet par train/bus, aucun carburant ni
      location, « transports en commun » dit seulement quand une gare est lue autour des étapes,
      sinon « non évalué » (`carFree.test.ts`, `carFreeTransit.test.ts`, `carFreeAutofill.test.ts`,
      `compasScreen.test.tsx`). Le test d'`intent.test.ts` qui prenait « sans voiture » pour un
      « avoid » utilise maintenant « sans foule ».
- [x] Journée à plus de 3 h de trajet signalée (Mercantour depuis Annecy). Lot N : route
      mesurée, train, ou temps estimé pour une sortie ; « 3 h 24 de trajet aller pour une
      seule journée : prévois une nuit sur place ou choisis plus près. » (`dayTrip.test.ts`).

### 4.5 Itinéraire

- [~] Échelle d'un pays **sans noms de l'IA** : bases multiples choisies dans le
      référentiel (rang, notoriété) ; chemin `planBase` multi-bases réellement atteint.
      **Lot R2** : `engine/countryBases.ts` (`pickCountryBases` : chaîne de bases par programmation
      dynamique, optimum exact et déterministe ; chaque lieu noté par la nature que l'activité préfère
      et le log de la population ; pas entre un minimum et un maximum tirés du barème de l'activité ;
      toujours le long de l'axe du pays, jamais de retour en arrière ; 2 à 6 bases ; changement de base
      « en véhicule », converti en bus pour « sans voiture »). L'IA passe d'abord comme avant et garde
      son chemin quand ses étapes sont retrouvées sur la carte (le test prouve que la carte du pays
      n'est alors pas lue) ; IA éteinte, muette ou sans lieu retrouvé : `countryStages` lit la carte du
      pays (`lookupAreaPlaces`, 800 lieux les plus peuplés) et planifie en bases multiples
      (`countryBases.test.ts`, `countryBasesAutofill.test.ts` via `compasAutofillAction`, une
      soixantaine de mutations tuées). **Reste** : routage entre bases testé avec un routeur simulé
      (pas contre Geoapify ou Valhalla) ; plafond de 6 bases, poids de régularité 0,1 et pool de 300
      lieux = constantes documentées non sourcées ; `CLAUDE.md` dit « exception IA » : vrai seulement
      quand l'IA répond.
- [x] Espaces sauvages : densité de lieux adaptée (refuges, campings, bivouac annoncé).
      **Lot Y** : `isWildZone` ; la recherche descend aux hameaux et campings (seconde demande
      seulement dans ce cas) ; campings permis sauf toit ou refuge voulu ; bivouacs CALCULÉS entre
      deux lieux réels (jusqu'à 3 journées, « Bivouac entre A et B (2/3) », sans `placeId`, note qui
      annonce emplacement à choisir et règles à vérifier), jamais au-delà ni avec « hébergement »
      (`wildAreas.test.ts`).
- [~] Acclimatation en alpinisme (paliers d'altitude). **Lot Y** : `engine/acclimatisation.ts`
      (au-dessus de 2 500 m, pas plus de 500 m de dénivelé de COUCHAGE par jour, une nuit de repos
      après 3 nuits ; source citée, formulation prudente, jamais un diagnostic) ; le planificateur à
      pied exclut le saut > 500 m tant qu'un lieu plus doux existe, la note de l'écran contrôle les
      nuits posées (`acclimatisation.test.ts`). **Reste** : alpinisme sur base (sommets non
      étapes), altitude des étapes = plancher et non mesure.
- [ ] Grands itinéraires suivis sur leur tracé (3.7).
- [x] Grandes îles (Sardaigne) : randonnée à pied, pas en voiture d'étape en étape. **Lot R2** :
      `engine/islands.ts` (`isIslandAnchor`, `isLargeIsland`, `pickIslandZone`) : une île est reconnue par
      sa nature ou par l'étiquette OSM `place=island` rangée avec l'ancre (Photon range une île sous
      « other ») ; à pied ou à vélo, la zone est celle où les lieux habités à altitude dépassent le
      plus la médiane de l'île, rayon ≤ 48 km, centrée sur eux (relief inconnu : centre de l'île, dit) ;
      un lieu dit sur l'île prime ; la porte `scaleKm > PLANNED_MAX_KM` n'envoie plus l'île à l'IA
      (`islands.test.ts`, Sardaigne simulée à pied : toutes les étapes à moins de 48 km, à pied,
      sans appel IA pour l'itinéraire). **Limites** : une île enregistrée avant ce changement n'a pas
      l'étiquette (ancien chemin) ; GR20 / traversées sur île = traversée courte dans la zone (grands
      itinéraires 3.7 non suivis) ; activités ni à pied ni à vélo : chemin d'un pays ; aucun nom de
      massif écrit sans donnée.
- [~] Défauts ouverts : Kalymnos, Patagonie (nuits sur un lac), « Mòguru/Mogoro », TMB.
      **Lot Y** : « Mòguru/Mogoro » (une étape garde le nom proposé quand la carte l'écrit en deux
      langues, `bilingualNames.test.ts`) et « Canal de Beagle » (un détroit, une baie, un canal ou la
      mer ne sont jamais le lieu d'une nuit, `sleepPlaces.test.ts`) corrigés. **Reste** : Kalymnos
      (données OSM d'escalade non importées, 3.x), Patagonie « Lago de los Tres » (échelle pays confiée
      à l'IA), TMB (tracé des grands itinéraires, 3.7).
- [x] Emprises qui traversent l'antiméridien (Fidji). **Lot Y** : tout calcul de longitude de
      l'emprise gère la coupure à ±180° (`engine/longitude.ts`) ; le serveur du référentiel lit deux
      boîtes valides et les fusionne au lieu de passer ouest > est au `box` de Postgres ; profil
      d'altitude, part de recul, tracé de rivière, refuges à 3 km et étendue d'une emprise coupée
      (`antimeridian.test.ts`, `antimeridianServer.test.ts`).

### 4.6 Budget

- [x] Calcul en euros, **affichage dans la devise du voyageur** (taux gratuit, 1.8).
      **Lot W** : « ≈ 930 CHF · 1 € = 0,93 CHF · taux du 9 octobre 2026 · Frankfurter » dans la
      carte Nous et le tiroir Budget ; taux introuvable = « indisponible » (`budgetFx.test.ts`,
      `budgetFxServer.test.ts`, `compasScreen.test.tsx`).
- [~] Carburant par pays (table versionnée, date) ; péages là où ils comptent. **Lot W** :
      carburant par pays de l'UE-27 daté (voir 1.8). **Lot R2** : vignettes chiffrées
      (`engine/tolls.ts`, table datée où chaque ligne porte source https, jour de lecture et période) :
      CH 40 CHF annuelle (ch.ch, OFDF) ; AT 9,60 / 12,80 / 32 / 106,80 € (oesterreich.gv.at ; ASFINAG
      illisible depuis le poste) ; CZ 230 / 300 / 480 / 2 570 CZK (edalnice.gov.cz, depuis le 1er janv.
      2026) ; SK 8,10 / 10,80 / 17,10 / 90 € (eznamka.sk) ; SI 16 € hebdomadaire, 32 € mensuelle (Uradni
      list RS 46/2025 ; DARS illisible) ; HU D1 5 550 / 6 900 / 11 170 Ft (PDF NÚSZ, 1er janv. 2026) ;
      toutes lues le 12 oct. 2026. Ligne « Vignette … » pour le pays de DESTINATION seulement, une par
      voiture, la moins chère qui couvre les jours, taux de change dit, sinon note « conversion
      indisponible » ; table non appliquée quand le voyage commence après le dernier jour couvert ;
      **vie privée** : pour un départ tiré du domicile ou de la position, « à l'étranger » est traité
      comme inconnu (la présence de la ligne ne dit pas où habite le lanceur, `abroadForVignette`)
      (`tolls.test.ts`). **Péages au km** : jamais ajoutés au budget (le routage ne donne pas les km
      d'autoroute), dits dans la base « péages non comptés (pourquoi ; barème du pays) » : FR 11,1 c€/km
      TTC (ART : 9,27 c€ HT/km au 1er févr. 2024 + TVA 20 %), IT 7,9 / 9,3 c€/km TTC plaine / montagne
      (Autostrade per l'Italia, classe A, 1er janv. 2026). **Reste** : ES, PT, HR, GR non chiffrés (aucun
      barème moyen au km lu à une source officielle) ; chiffrer les péages au km exige les km d'autoroute à
      péage du routeur (piste : détail du trajet chez Geoapify / Valhalla) ; pays de départ et pays
      traversés non comptés ; barème FR de février 2024 (hausses 2025 et 2026 non lues) ; SI à revérifier
      sur dars.si ; SI annuelle et HU annuelle écartées (période non confirmée) ; gazole et 6,5 L/100 km
      inchangés.
      **Lot AC** : ES chiffré pour les seules autoroutes de la SEITT (8,3 / 9,3 c€/km HT + TVA 21 %,
      BOE-A-2025-25961, tarifs 2025 ; TVA BOE-A-1992-28740 art. 90), dit dans la base, jamais ajouté au
      budget ; PT (IMT, Brisa), HR (HAC) et GR lus le 12 oct. : aucun barème moyen au km, non chiffrés
      avec la raison datée.
- [~] Assurance et repas par région ; libellés « indice de prix du pays » (plus
      « prix français »). **Lot W** : libellés faits (« indice de prix du pays : Pérou 45
      (France = 100) », `costs.test.ts`). **Lot R2** : repas en autonomie (bivouac, journée sans nuit) au
      niveau de prix de l'ALIMENTATION de l'ICP 2021 de la Banque mondiale (170 pays, CC BY 4.0,
      « The World Bank: ICP 2021 », lu le 12 oct. 2026 ; `engine/icp.ts`, `icpPriceLevels.json`,
      `scripts/compas/build-icp-price-levels.mjs`), repli sur le barème pour un pays absent
      (`icpFood.test.ts`) ; la série « Restaurants et hôtels » est écartée (prix des résidents, plus de
      20 % sous le barème dans 87 pays sur 170). **À valider en P2** : le budget « Repas » change pour
      bivouac et journées sans nuit. **Reste** : assurance (forfait 2 / 3 / 4,5 € par jour) sans découpage
      régional sourcé ; repas au restaurant et au refuge au barème France × indice du pays.

### 4.7 Temps

- [x] « Aujourd'hui » au fuseau du voyageur (navigateur) partout (serveur, calendrier,
      `CompasStart`). Lot M : fuseau du navigateur envoyé au serveur (repli Paris), météo
      datée au fuseau de la destination (`zone.test.ts`, `compasWeather.test.ts`) ;
      « Quand » accepte le plus tôt des deux jours (voyageur, destination)
      (`compasScreen.test.tsx`).
- [x] Lever et coucher du soleil au fuseau de la destination (`tz-lookup`) au-delà de la
      prévision ; départ conseillé juste. Lot M : « heure locale », départ à l'aube si 7 h
      ne suffit pas (même quand l'aube ne suffit pas non plus : le moins de nuit),
      « HH:MM » enfin lu ; frontale et « X de marche pour Y de jour » au-delà de la
      prévision par le calcul astronomique (`sun.test.ts`, `weather.test.ts`,
      `danger.test.ts`, `kitRules.test.ts`).
      Limite connue : un seul fuseau par voyage, celui de la première étape placée.
- [x] Hiver selon l'hémisphère ; saison sèche des tropiques hors table (Brésil, nord de
      l'Australie, Caraïbes, Afrique de l'Ouest, Guyane, Mayotte). Lot M : la table n'est
      pas complétée à la main (aucune ligne inventée) ; hors table, mois le plus sec des
      normales NASA POWER 2001-2020 au point retenu, aucune période en désert (moins de
      0,5 mm/jour en moyenne) (`period.test.ts`, `powerNormals.test.ts`, `metno.test.ts`) ;
      hiver décalé de six mois au sud, jamais sous les tropiques (`projectContext.test.ts`).

### 4.8 Kit

- [x] Règles fondées sur les normales climatiques (NASA POWER) : froid sans altitude,
      pluie, mousson, chaleur. **Lot S** : `kitClimateRules.test.ts`, `kitClimate.test.ts`,
      `climateNormals.test.ts`, `kitContext.test.ts`, `kitWiring.test.ts`.
- [x] Tropiques : moustiques, eau (filtre/pastilles), soleil ; filtre à eau selon la
      source, pas seulement l'altitude. **Lot S** : `kitTropics.test.ts`. Le conseil
      moustiques est décidé par le point le plus bas du tracé, pas par des lieux hauts seuls.
- [x] Altitudes de secours sans liste de pays en dur. **Lot S** : lues sur le relief
      (Terrain Tiles) sous les lieux du voyage, comme un plancher (`altitudeFrom: 'lieux'`) :
      haut, il déclenche les règles fermes (« jusqu'à X m, le parcours peut monter plus
      haut »), bas, il ne lève pas la formulation prudente (`kitAltitude.test.ts`,
      `kitWiring.test.ts`). Limite : le module Voyages historique (`src/features/trips`) ne
      pose pas ce plancher ; `PILOT_ELEVATIONS` (tracés nommés, pas des pays) reste en place.

### 4.9 Alertes officielles

- [~] Meteoalarm pour toute l'Europe ; ailleurs, « non couvert » dit clairement (déjà) ;
      sources gratuites hors Europe recherchées. **Lot U** : 33 services nationaux lus
      (flux JSON par pays), chaque alerte nomme son service, son heure d'émission, sa période
      et reprend son texte officiel avec lien et avertissement (`meteoalarmFeeds.test.ts`,
      `danger.test.ts`, `compasScreen.test.tsx`). **Reste** : Royaume-Uni, Luxembourg, Malte,
      Moldavie, Macédoine du Nord et Slovaquie ont un flux vide (dits « non couverts », jamais un
      faux « aucune alerte ») ; hors contours (9 pays) et France, la zone n'est reconnue que par
      le nom exact d'une unité administrative, sinon « zone non rapprochée » ; sources hors
      Europe (NWS, ECCC, JMA) recherchées, non branchées. **17 oct.** (`bc23f12c`, `3a3319a8`) :
      NWS (États-Unis) et ECCC (Canada) branchés derrière `COMPAS_ALERTS_WORLD` (**éteint**),
      mentions légales faites (`worldAlerts.test.ts`, `worldAlertsServer.test.ts`). Reste : JMA et
      autres pays hors Europe, allumage et preuve.

### 4.10 Compréhension de la demande

- [x] Lot K (`engine/intentWords.ts`, `intentWords.test.ts`) : nombres en lettres
      composés ou grands (« dix-huit » lu 8 avant, « trois cents », « une dizaine de »),
      montants (« 1,500 € » lu 1,50 € avant, « 3k€ ») et devise dite (« 2000 $ »,
      « £800 », « CHF », « 50 000 ISK ») convertie au taux du jour dans la devise du
      voyage, montant dit et taux gardés dans le libellé ; « dans 3 semaines » (un
      départ, plus une durée de 21 jours), semaine et mois prochains, jours fériés
      (jamais une destination : « à Noël en Laponie »), « 12/11 au 15/11 », ISO, mois
      avant le jour en anglais ; « famille de 5 », adultes + enfants. L'ancrage de l'IA
      suit les mêmes lectures (18 est dans « dix-huit », 8 n'y est plus).
- [~] Reste : dates numériques selon la langue de la personne (phase 6) ; montant « par
      personne » multiplié par le groupe ; « quelques jours ». Les deux derniers sont faits
      (lot AC, ci-dessous) ; « 10/12 » en anglais reste volontairement non compris (`8096e30a`).

### 4.11 Notes et conseils

      **Lot AC** : « 50 € par personne » multiplié par le groupe (taille de la phrase, sinon du voyage,
      sinon précision demandée) ; « quelques jours » lu « au moins 2 jours » (3 pour des nuits, 14 pour
      des semaines), dit « à préciser », jamais un chiffre de l'IA (`intent.ts`, `intentWords.ts`,
      `request.ts`). Reste : dates numériques selon la langue (phase 6) ; montants par jour, nuit ou
      semaine lus comme avant.
- [x] Lot K (`engine/advice.ts`, `advice.test.ts`) : altitude (au-dessus de 2 500 m),
      avalanches en hiver selon l'hémisphère (BERA en France), orages d'été en montagne,
      sortie seul·e (112 seulement là où il répond), refuges à réserver, règles du bivouac
      à vérifier (sans horaire inventé), rivière ; trois au plus, le plus grave d'abord.
      L'IA ne donne plus que des « Suggestion de l'IA (facultatif) », jamais une redite
      d'une règle. Eau (filtre selon la source, tropiques) : lot S, `kitTropics.test.ts`.

---

## Phase 5 — Interface, accessibilité, légal (français)

### 5.1 États

- [x] Squelette de chargement et page d'erreur propres au Compas (2.9). **Lot V** :
      `CompasSkeleton` (même grille que l'écran vide réel, mesuré à l'identique à 393 × 852,
      `role="status"`, opacité seule, immobile avec `prefers-reduced-motion`) ; `error.tsx`
      dans la langue du Compas, tutoyé, `role="alert"`, focus sur le titre, « Réessayer »,
      référence `digest` sans message interne (`compasStates.test.tsx`).

### 5.2 Accessibilité (WCAG 2.2 AA)

- [x] Focus piégé dans les tiroirs et rendu à l'élément d'origine. Lot Q
      (`components/focusTrap.ts`, `CompasSheet.tsx`, `__tests__/a11yFocus.test.tsx`) :
      Tab et Maj+Tab bouclent dans le tiroir (le « Annuler » de l'îlot reste atteignable),
      Échap ferme, le focus revient au déclencheur, y compris après deux tiroirs empilés,
      sans voler un focus que la page a posé ailleurs.
- [x] `KitRow` : plus de bouton dans un bouton ; Espace géré. Lot Q (`CompasCards.tsx`,
      `compas.css` `.cp-row__main`, `compasScreen.test.tsx` « KitRow : une ligne, un bouton ») :
      la ligne n'est plus un `role="button"` qui contient des boutons ; sa commande
      principale est un vrai `<button>` (Entrée et Espace natifs), voisine de « Emballer »
      et « Retirer » ; toucher, appui long et glissement sont inchangés.
- [x] Calendrier des conditions : qualité dite en texte, pas seulement en couleur. Lot Q
      (`CompasOuFlows.tsx` `QUALITY_SHAPE`, `compas.css`, `compasScreen.test.tsx`
      « Calendrier des conditions ») : chaque jour porte une forme propre à sa qualité (● ◆ ▲
      pleine pour la prévision, ○ ◇ △ creuse pour la tendance) en plus de la couleur et du
      libellé complet ; la légende nomme les formes ; chaque heure de « Heure par heure »
      dit sa qualité et ses raisons en texte (lecteur d'écran) et porte la même forme.
- [x] Pastilles d'alerte des étapes annoncées au lecteur d'écran. Lot Q (`CompasScreen.tsx`
      `alertText`, `compasScreen.test.tsx` « Pastilles d'alerte des étapes ») : le nom du
      bouton d'étape dit la cause (« Kit, alerte : objet vital à trouver », « Où, alerte :
      dates à choisir »…), la pastille reste décorative et l'icône n'annonce plus le nom du
      glyphe.
- [x] Tailles de texte en `rem` ; lignes qui s'agrandissent au lieu de tronquer. Lot Q
      (`compas.css`, `TripInvitations.tsx`, verrou `__tests__/textScale.test.ts`) : les 99
      `font-size` et les `line-height` en px passent en rem ; `--cp-row-h` vaut 3 rem et les
      lignes, pastilles, boutons de tiroir, champs et cases de calendrier ont une hauteur
      MINIMALE (plus de hauteur fixe qui rogne) ; nom, détail, raison, titre de tiroir,
      valeurs « Voici ce que j'ai compris » passent à la ligne au lieu d'être tronqués par
      « … » (les nombres courts gardent une ligne) ; `PagedList` mesure déjà la ligne la plus
      haute. Les px qui restent dimensionnent des icônes, vignettes et surfaces, pas du texte.
- [x] « Annuler » : délai réglable ou plus long ; erreurs en `role="alert"`. Lot Q
      (`CompasScreen.tsx` `armToast`/`holdToast`, `CompasSheets.tsx`, `compasScreen.test.tsx`
      « Annuler : délai assez long et réglable ») : « Annuler », les erreurs et les détails
      restent 15 s (6 s avant), réglables à 8 / 15 / 30 s dans « Affichage » et gardés sur
      l'appareil ; le délai est suspendu tant que l'annonce a le pointeur ou le focus ; une
      erreur d'action est un `role="alert"` (le reste un `status`), de même que les six
      erreurs de chargement des tiroirs.
- [x] Informations portées par `title` doublées en texte ; `forced-colors`. Lot Q
      (`compasScreen.test.tsx` « Ce que porte un `title` est aussi dit », `a11yStart.test.tsx`,
      `forcedColors.test.ts`) : description des activités, exemple de « Dis-le », raison des
      étapes grisées, note des axes de danger, nuits sans hébergement, équipe, calques
      « aucun » et raccourci de « Annuler » sont lus (aria-describedby, aria-label, texte
      masqué) et non plus seulement au survol ; l'onglet précédent nomme sa destination.
      `compas.css` : bloc `@media (forced-colors: active)` (verre plein et bordé, états
      choisis en Highlight, barres, lentille, interrupteurs, icônes en masque préservées,
      focus), couleurs système seulement.
- [ ] Test réel VoiceOver et TalkBack. 🔒 Impossible en session : il faut un iPhone et un
      Android réels, parcourus à la main par une personne (cinq étapes, un tiroir de
      chaque, une annonce « Annuler » et une erreur).
- [x] CI axe étendue à tous les tiroirs. Lot Q (`compasScreen.test.tsx` « axe-core :
      l'écran et chacun des tiroirs ») : `axe-core` (déjà présent avec `@axe-core/playwright`)
      balaie en jsdom, à chaque `npm test` de la CI, les cinq étapes de l'écran, les 26
      parcours de tiroir (`STEP_FLOWS`), la fiche d'objet, Porteur, Emprunter / Louer /
      Acheter, Ajouter au kit et le sac d'un membre, règles WCAG 2 A/AA et 2.1/2.2 :
      zéro violation. Un témoin vérifie que le balayage détecte bien un défaut (l'ancien
      `KitRow` fait échouer trois parcours). Reste : le contraste de couleur, que jsdom ne
      mesure pas, et qui reste couvert dans le navigateur par `npm run test:a11y`
      (Playwright, `tests/a11y/e2e`) sur l'aperçu.

### 5.3 Légal visible

- [x] Attributions complètes et cliquables : section « Sources des données et
      licences » des mentions légales (OpenStreetMap, Esri, Photon, LocationIQ, Geoapify,
      Overpass, MET Norway, NASA POWER), lot B. **Lot U** : Terrain Tiles, GeoNames,
      Meteoalarm, BCE ajoutés avec la licence relue à la source (11 oct.) et un lien
      cliquable ; « Powered by Geoapify » seulement là où ses résultats s'affichent
      (retiré des points « Sur place », gardé près des distances) ; chaque service crédité
      est réellement employé (`dataSources.test.tsx`, `compasScreen.test.tsx`).
- [x] Mention IA au démarrage, sur les conseils et sur toute étape proposée par l'IA
      (AI Act art. 50). **Lot Z2** : démarrage de la préparation, étapes `aiProposed`, conseils,
      « Dis-le », explication du verdict ; muette si `AI_MODE=off` (`aiNotice.test.tsx`,
      `autofillAiMark.test.ts`, `compasScreen.test.tsx`, axe-core).
- [x] Mention d'affiliation dans la recherche d'hébergement en direct ; placée avant la
      liste dans Parcours. **Lot Z2** : divulgation avant les offres (ordre du DOM), `rel="sponsored
      nofollow"` sur chaque lien sortant d'offre (`compasScreen.test.tsx`).
- [~] Politique de confidentialité et mentions légales (2.10) : hébergeur corrigé
      (Vercel et non Netlify ; base à Paris et non Francfort), NVIDIA, services de carte et
      hCaptcha ajoutés aux destinataires (lot B). **Lot Z2** : destinataires relus dans le code
      (OpenRouter retiré, Nominatim, Overpass, unpkg ajoutés), profil voyageur privé, section IA,
      essai de 7 jours, et « rien du profil n'est envoyé à l'IA » (`privacyPolicy.test.tsx`). Reste :
      l'identité de l'éditeur (Tony).
- [ ] ⚖️ **Identité de l'éditeur à fournir par Tony** : les mentions légales affichent
      une société d'exemple (« 1 Rue de la Paix », SIRET 123 456 789). Obligatoire (LCEN)
      avant toute ouverture au public ; Claude n'invente rien ici.

### 5.4 Mobile (Capacitor)

- [x] Barre d'état lisible sur le paysage clair du Compas. **Lot V** : thème de la barre
      selon la route (`statusBarThemeForPath`) : texte sombre sur fond crème sur `/compas`,
      thème d'avant ailleurs, à l'arrivée, à l'entrée et à la sortie (`statusBar.test.ts`,
      `statusBarBootstrap.test.tsx`). Prouve les appels au plugin, pas le rendu natif.
- [x] Texte de la demande de position juste (Info.plist, Android). **Lot V** :
      `NSLocationWhenInUseUsageDescription` en français, avec le pourquoi et les limites
      réelles (app ouverte seulement, jamais en arrière-plan, arrondie à ~1 km dans le
      Compas) ; Android : `ACCESS_FINE_LOCATION` et `ACCESS_COARSE_LOCATION` seulement,
      aucune position en arrière-plan (`nativePermissions.test.ts`).
- [x] Zones sûres vérifiées sur iPhone à encoche (capture 393 × 852). **Lot V** : le Compas
      utilisait déjà `viewport-fit=cover` et `env(safe-area-inset-*)` ; Playwright chromium
      393 × 852 × 3 avec encoche imposée (haut 59, bas 34 ; paysage côtés 59), capture
      `docs/compas/preuves/compas-393x852-zones-sures.jpg`
      (`scripts/e2e/compas-safe-area.spec.ts`, `safeArea.test.ts`). Chromium, pas un iPhone
      réel : rendu natif, dialogue de permission, VoiceOver et TalkBack restent à faire sur
      appareil.

### 5.5 Écarts avec la maquette (`ECARTS_MAQUETTE.md`)

- [x] Îlot « prochaine décision, appliquer ». **Lot R2** : capsule en verre au-dessus de la barre
      d'onglets (`CompasDecision.tsx`). « Voir » ouvre l'étape ; « Appliquer » seulement quand le moteur dit
      que la décision est un calcul sûr et défaisable (`engine/decisionApply.ts`) : « Répartir le matériel
      commun » (charge rapportée à la capacité, plus lourds d'abord), via `compasSetCarrierAction`,
      « Annuler » / Ctrl+Z, retour arrière si un appel échoue. Dates, parcours, produit, réservations,
      budget : « Voir » seulement. Cibles ≥ 2,75 rem, `aria-live="polite"`, hors de l'ordre de tabulation
      quand un tiroir est ouvert, mouvement réduit respecté (`ecartsMaquetteUi.test.tsx`, axe-core, 17
      mutations tuées). Rendu réel et contrastes non mesurés (pas de navigateur) : à contrôler sur appareil.
- [x] Heure de passage à chaque étape (Quand). **Lot R2** : `engine/passage.ts` (pur) : départ du jour +
      temps pour atteindre l'étape (DIN 33466 +15 % à pied ; vitesse type vélo / course / trail / eau ;
      sinon aucune), arrondi à 5 min, passage de nuit dit en texte (lever et coucher de la prévision, sinon
      calcul astronomique). Sans départ, distance ou allure : « non renseigné » et la raison, jamais
      d'heure par défaut (18 mutations tuées). Heure de départ enregistrée : `compasSetDepartureTimeAction`
      (session, éditeur, zod « HH:MM ») la range dans `metadata.compas.departure_time`, pour chaque jour du
      voyage ; `compasPlan` la relit (`CompasData.departureTime`, toute autre forme ignorée). Dans « Quand »,
      « Si tu pars à » part de l'heure enregistrée ; une heure tapée reste une simulation jusqu'à
      « Enregistrer cette heure » ; « Effacer l'heure enregistrée » la retire ; « Annuler » rétablit l'heure
      d'avant. Une heure notée sur une étape reste prioritaire. Jamais d'heure par défaut
      (`departureTime.test.ts`, `departureUi.test.tsx`). **Reste** : une heure différente par jour ; road trip, ski, escalade, alpinisme, ville, plage, van n'ont
      aucune allure, donc aucune heure.
- [x] Niveau et présence des membres ; rôles (dans la règle `/hub`) ; charge par membre. **Lot AD** :
      membres en lecture (rôle, niveau, charge portée, invitations en attente ; renvoi vers `/hub/groupe`,
      `CompasMembers.tsx`, `engine/crewView.ts`) ; un profil posé en moyenne de population n'est plus pris
      pour celui de la personne (allure et niveau vides, portage dit « repère moyen »). Reste : présence
      « en ligne » (aucune source en base).
- [x] L'onglet « Qui » du Compas gère encore invitations, rôles et retraits : contraire à la règle « le Hub
      seul gère le groupe ». À ramener en lecture avec renvoi vers `/hub/groupe` (relevé par le lot AD).
      **Lot AF** : lecture seule (membres, rôles, invitations en attente), « Ajouter quelqu'un » mène au Hub ;
      7 actions serveur sans appelant supprimées. Reste à trancher : `compasAnswerApplicantAction` (réponse à
      une « bouteille à la mer ») ajoute encore un membre depuis le Compas.
- [x] Manques : Emprunter · Louer · Acheter complet ; appui long : fiche, historique. **Lot AD** :
      `engine/acquire.ts`, `CompasItemHistory.tsx`, `server/itemHistoryActions.ts` (session, zod ; prêts,
      voyages passés et commandes lus sous RLS : prêteur ou emprunteur, voyages lisibles, ses commandes).
- [x] Carte : style des pastilles et de l'encart ; fonds Relief et Satellite gratuits. **Lot AD** :
      pastilles départ / arrivée / numéros, encart, fonds Relief, Clair et Satellite par ArcGIS Location
      Platform (même branchement que `/explorer`, `engine/mapStyle.ts`, `CompasMap.tsx`).
- [x] Risques : barres par risque, sources datées. **Lot R2** : `engine/riskBars.ts`, trois barres
      (physique, technique, conjoncturel) à quatre niveaux écrits (faible · modéré · élevé · non évalué),
      sans score ; « non évalué » = barre vide hachurée, jamais « faible » ; source et date par barre
      (« Source : MET Norway · 12 oct. 2026 ») ; `assessDanger` renvoie `evidence` (sources lues)
      (20 + 9 mutations tuées). **Reste** : avalanche et altitude (le moteur n'en tire aucun signal de
      danger, seulement des conseils), cotation du terrain (l'axe Technique reste « en partie »), une barre
      par signal (le détail reste dans « Signaux du verdict »).

### 5.6 Bureau et tablette

- [x] Mise en page à partir de 768 px (tiroirs latéraux, carte large), sans casser le
      mobile. **Lot AD** : spec Chromium `scripts/e2e/compas-bureau.spec.ts` (7/7, 0 débordement,
      0 erreur console) sur la page de laboratoire `/dev/compas` (servie en développement seulement,
      garde testée) ; captures 390×844, 768×1024 et 1280×800 dans `docs/compas/preuves/`. Reste : un
      vrai appareil, et l'écran complet capturé sur la route réelle (exige session et base).

### 5.7 Documentation

- [x] `DESIGN_REFERENCE.md` : thème sombre (contradiction) corrigé : thème clair seul sur `/compas`
      (`CompasLightTheme`), le verre sombre ne reste qu'à `/partir-librement` (vérifié le 12 oct.).
- [ ] `ETAT.md`, `REFERENTIEL-GEO.md`, ce plan : à jour à chaque PR.

---

## Phase 6 — Monde (langues, formats, voyageur non français)

### 6.1 Langues de l'interface

- [~] Brancher le Compas sur `src/lib/i18n` (FR, EN) ; outil de couverture étendu à
      `src/features`.
- [~] Extraction des ~1 000 textes de l'interface et des 188 messages serveur.
      **Mesure du 18 oct.** (`npm run i18n:compas`) : composants du Compas **0 chaîne française en
      dur** ; actions serveur traduites (`ca5132c6`, `33bbfbac`, `fb541a4b` : `compasActions`,
      `autofillActions`, bouteille, Résa, invitations, profil, historique, points ;
      `serverText.test.ts`, `autofillServerText.test.ts`) ; textes du moteur en partie (`fcdad1b8` :
      période, contexte, formats, veille, conseils, kit ; `engineI18n.test.ts`). L'outil compte
      encore 156 chaînes dans `server/` (dont journaux, consignes IA et données rangées, gardés
      en français à dessein) et 770 dans `engine/` (`tolls`, `autofill`, `compasModel`, `travel`…).
- [ ] Textes enregistrés en base (titres, budget, notes, kit) remplacés par des clés et
      paramètres, rendus à l'affichage.
- [~] Pluriels et décimales par `Intl` ; `<html lang>` juste. `<html lang={locale}>` posé par
      `src/app/layout.tsx` (cookie puis `Accept-Language`) ; pluriels serveur par
      `Intl.PluralRules` (`serverText.ts`). Reste : pluriels de l'interface relus partout, preuve
      sur l'aperçu.
- [ ] Langues suivantes : ES, DE, IT (ordre selon la demande mesurée).
      **Lots 1 à 4 faits (17 oct., EN désactivé tant que `NEXT_PUBLIC_I18N_EN_ENABLED` n'est pas à 1)** : espace de noms `compas`,
      ~1 000 clés FR/EN (lot 1 : entrée et préparation ; lot 2 : étapes, activités, lignes « compris », tiroirs Où ; lot 3 : écran,
      cartes et 19 petits composants ; lot 4 : `CompasSheets`), français identique au caractère près, test de couverture
      (`tests/i18n/compas-coverage.spec.ts`, `npm run i18n:compas`). **Reste** : messages serveur (~400 chaînes : `compasActions`,
      `autofillActions`), textes générés par le moteur (budget, kit, conseils, `tolls`, `travel`… ~900 chaînes, dont du lexique
      d'analyse qui n'est pas de l'interface), textes rangés en base (clés à la place du texte), analyse des phrases en anglais,
      ES/DE/IT, dates numériques selon la langue, unités impériales.
      **ES, DE, IT (18 oct.)** : dictionnaires complets (`es.ts`, `de.ts`, `it.ts` + `compas*.es|de|it.ts`, même
      découpage que l'anglais), registre usted / Sie / Lei, éteints par défaut (un drapeau par langue :
      `NEXT_PUBLIC_I18N_ES_ENABLED`, `…_DE_…`, `…_IT_…`, indépendants de l'anglais ; une langue éteinte n'est
      jamais reprise du cookie). Test `tests/i18n/compas-locales.spec.ts` (parité des clés, placeholders, aucun
      français ni anglais résiduel, typographie, tutoiement). L'IA n'écrit pas encore ces langues (6.2) : en
      ES/DE/IT, ni conseils de l'IA ni explication du verdict, notes d'étapes de l'IA non gardées.

### 6.2 IA et règles multilingues

- [~] Consignes de l'IA dans la langue du voyageur ; `repairAccents`, `tutoyer`,
      `keepAiNote` par langue (ou désactivés hors français).
      **Fait (17 oct., FR/EN)** : langue = celle de l'INTERFACE (`getRequestLocale`, `src/lib/i18n/serverLocale.ts`),
      jamais la nationalité ; `fr` tant que l'anglais n'est pas activé. Conseils de la préparation : consigne anglaise
      à part et sans argument (`buildCompasAutofillSystemEn`, verrou 12 de `traveller_privacy.mjs` intact) ;
      itinéraire : note en anglais, codes de déplacement inchangés ; verdict : consigne et garde-fous anglais
      (nombres « 1,200.5 », unités, score, réassurance). `repairAccents` et `tutoyer` en français seulement ; en
      anglais, un conseil rendu en français est écarté (`voiceFor`). `keepAiNote` et `repeatsRule` voient les motifs
      des deux langues ; mention « AI suggestion (optional) ». Cache IA : la langue entre dans la clé (clé française
      inchangée). Tests : `aiLocale.test.ts`. **Reste** : ES/DE/IT ; libellé de destination (« nom usuel en
      français ») ; les conseils rangés sur le voyage sont écrits dans la langue du lanceur (relève de 6.1 : clés
      à la place du texte) ; raisons de refus du verdict encore en français (messages serveur, 6.1).
- [~] Compréhension de la phrase en EN, ES, DE, IT (corpus de 50 phrases par langue).
      **EN fait** (`8096e30a`, `engine/intentEn.ts`) : corpus de 50 phrases
      (`__tests__/fixtures/request-en.json`, `requestEn.test.ts`, 184/184 champs) ; « 10/12 » et
      « with the kids » volontairement non compris. ES, DE, IT : en cours ailleurs, rien ici.

### 6.3 Formats et unités

- [~] Dates, nombres, devises par `Intl` avec la locale du voyageur ; semaine selon la
      région.
      **Fait (17 oct.)** : `src/lib/i18n/region.ts` (région d'une balise, premier jour de la semaine et unités par
      région, tables CLDR, déterministes) et `src/lib/i18n/measure.ts` (distance, altitude, poids, température, date
      numérique selon langue et région ; en français métrique, sortie identique à `engine/format`). Tests :
      `tests/i18n/region-measure.spec.ts`. **Reste** : brancher ces formateurs dans les écrans (tiroirs, carte,
      verdict, météo) et les calendriers (ordre des jours) ; la région n'est connue que par la balise (`en` → US).
- [~] Unités impériales de bout en bout (km/mi, m/ft, °C/°F, kg/lb).
      Formateurs prêts (réglage explicite de la personne prioritaire sur la région). **18 oct.**
      (`6c5554ac`, `units.test.tsx`, `tests/i18n/units-exact.spec.ts`) : l'affichage du Compas (carte,
      cartes Où et Kit, tiroirs, météo, tracé, eau, parcours, détail du jour) passe en mi / ft / lb / °F
      selon le réglage du compte (`lib/i18n/unitSetting.ts`, lu dans le navigateur) ou la région de la
      langue. **Reste** : réglage `unitSystem` rangé côté serveur (il reste dans le navigateur) ; textes
      calculés par le moteur et rangés en base toujours en métrique.

### 6.4 Contenu

- [~] Recherche de lieux dans la langue du voyageur (Photon, Nominatim, Geoapify,
      référentiel : noms par langue).
      **Fait (18 oct.)** : langue = `getRequestLocale()` (interface). Recherche, inverse, autres noms
      (`placeLookup`), lieux d'une zone de l'itinéraire (`lookupAreaPlaces` : Photon `lang`, Overpass
      `name:<langue>` puis nom local, Geoapify Places `lang`), `/api/geocode` (`geocodeService` :
      Photon `lang`, Nominatim `accept-language` hors français ; en-tête `Vary`), pays du référentiel
      par `Intl`. Clés de cache : française d'avant à l'identique, préfixée par la langue sinon
      (`mapLanguage.ts`). Écritures non latines : `engine/nameKey.ts` (`matchKey` : clé latine d'avant
      inchangée dès qu'elle existe, sinon l'écriture d'origine repliée, sans translittération) dans
      `pickDestination`, `samePlaceName`, `aliasMatches`, `homonymsFarApart`, `mergeReferential`.
      Matrice avant/après (654 cas) : aucune différence sur une entrée latine. Tests :
      `placeLanguageAreas`, `placeScripts`, `geocode-language`. **Reste** : noms par langue dans
      `geo_places` (colonne et import `alternateNamesV2`, la RPC ne lit que l'alphabet latin) ;
      Photon public limité à fr/en/de (sinon noms locaux) ; référentiels `geo_pois`/`geo_sites`/
      `geo_trails` importés avec `name:fr` d'abord ; étapes rangées sur le voyage dans la langue du
      lanceur ; `pickPlace` et `stageTitleFor` gardent la clé latine (repli par écriture d'origine
      voulu).
- [~] Textes natifs traduits (iOS `.lproj`, Android `values-xx`). **17 oct.** (`2a405c27`,
      `nativeLocalizations.test.ts`) : `fr.lproj` / `en.lproj` `InfoPlist.strings`, `values-fr` /
      `values-en`. **18 oct.** : `es.lproj` / `de.lproj` / `it.lproj` et `values-es` / `values-de` /
      `values-it`, mêmes clés, registre usted / Sie / Lei, nom de l'app inchangé (une marque)
      (`nativeLocalizations.test.ts`). Reste : **les cinq `.lproj` iOS ne sont pas référencés par le
      projet Xcode, donc non embarqués** : à ajouter par Tony dans Xcode (glisser `InfoPlist.strings`
      dans le groupe App, « Localize… », cocher fr / en / es / de / it ; Xcode met à jour
      `project.pbxproj` et `knownRegions`, jamais modifié à la main ici) ; textes relus par une
      personne de chaque langue ; affichage vérifié sur un iPhone et un Android réels.
- [~] Mentions légales et d'affiliation par région (FTC, CMA). **18 oct.**
      (`engine/disclosureRegion.ts`, `disclosure-region.spec.ts`, `AFFILIATION-REGIONS.md`) :
      `<AffiliateDisclosure />` choisit son texte selon la région (France et UE : mention
      d'origine, au caractère près pour la France ; États-Unis : lien financier dit en tête ;
      Royaume-Uni : « Ad » dès l'étiquette ; ailleurs : mention actuelle), clés fr/en/es/de/it,
      `rel="sponsored nofollow"` inchangé. Rien d'allumé. **Reste** : relecture par un juriste
      (formulations prudentes, non validées) ; région réelle de la personne (seule la langue
      décide aujourd'hui) ; mentions légales par région.

---

## Phase 7 — Validation et lancement

- [ ] Jeu « 20 parcours réels » rejoué en production, contrôlé en base.
- [ ] Jeu « 50 demandes nouvelles » (France et Europe) en production.
- [ ] Jeu « 50 demandes monde » : hors Europe, hémisphère sud, écritures non latines,
      voyageurs non français, sans GPS.
- [ ] Charge simulée : 1 000 préparations/jour dans les quotas gratuits (Geoapify,
      Photon, routage, MET Norway, Supabase) ; marge mesurée.
- [ ] Bêta : 10 vrais voyageurs, retours lus en base ; taux de réussite ≥ 97 %.
- [ ] Au lancement, dans cet ordre : protection hCaptcha allumée dans Supabase (clé
      secrète), puis `NEXT_PUBLIC_AUTH_CAPTCHA=on` dans Vercel et redéploiement ;
      vérifier une connexion, une inscription et un essai à la main.
- [ ] Critère de lancement francophone : phases 1, 2, 3.2, 4.1 à 4.7, 5 terminées.
- [ ] Critère de lancement mondial : phase 6 terminée, jeu « monde » ≥ 95 %.

---

## Phase 8 — Après stabilisation (P3, gelé jusqu'au passage de la phase 7)

- [ ] Réservations : RouteStack et Viator dans le parcours (recherche ; jamais de
      paiement sans geste explicite) ; Travelpayouts.
- [ ] Équipe et social (dans la règle `/hub`), bouteille à la mer.
- [ ] Hors ligne : préparation lisible et carte en cache sur l'appareil.
- [ ] Affiliation complète (divulgations, suivi conforme RGPD).
- [ ] Animations (`prefers-reduced-motion`) et finitions de la maquette.
- [ ] ⚖️ Applications sur les stores : Apple (99 $/an) et Google (25 $) sont payants ;
      à 0 €, **application web installable (PWA)** à la place ; le code Capacitor reste
      prêt.

---

## Phase 9 — Dette et hygiène

- [x] `eslint.ignoreDuringBuilds` remis à `false` (CLAUDE.md) après nettoyage du lint. **Lot Z4** :
      mesure du 12 oct. (`npx eslint .`, 2 967 fichiers) : 45 erreurs (no-this-alias 17, display-name 9,
      no-children-prop 9…) et 8 699 avertissements (no-unused-expressions 6 172, no-unused-vars 1 211,
      no-console 925…) : réglage inchangé tant qu'il reste des erreurs.
      **17-18 oct.** : erreurs corrigées (`ecab6a14`, `efa94c75`, `d0097da4`) ; `next.config.mjs` porte
      `ignoreDuringBuilds: false` ; `npx eslint . --quiet` relancé le 18 oct. sur la branche
      `claude/compas-p1-referentiel` : **0 erreur** (code de sortie 0). Les avertissements restent
      (réduction règle par règle, non planifiée).
- [~] Fichiers non formatés par Prettier (`track.ts`, `routeStackBookingProvider.ts`,
      `routingService.ts`…) reformatés dans une PR dédiée. **Lot Z4** : les trois fichiers cités
      sont formatés (commit dédié, `prettier --check` vert) ; le « … » reste à lister.
- [~] Actions GitHub sur Node 20 (déprécié) mises à jour. **Sur cette branche** (`1b3772c5`) :
      les 7 workflows utilisent `checkout` v5, `setup-node` v5, `upload-artifact` v6,
      `download-artifact` v7 (Node 24), épinglés par SHA. **Sur `main` (relu le 18 oct.)** : seul
      `geo-referentials-import.yml` (#109) est en v5 ; `ci`, `db-backup`, `geo-pois-monthly`, `ios`,
      `ios-testflight`, `lighthouse-ci`, `visual-regression` restent en v4 (dont des `@v4` non
      épinglés). Reste : fusion dans `main`, puis un premier run vert de chaque workflow.
- [~] Historique des migrations aligné dépôt ↔ base (versions divergentes du 4 octobre).
      **18 oct.** : `docs/compas/MIGRATIONS-ALIGNEMENT.md` (écarts connus d'après le dépôt seul : les
      cinq versions du 4 oct. réintégrées en `*_hotfix.sql` par `2867f02a` ; fantôme `20261005090000`
      sans SQL ni document ; doublons `20261012100000` / `20261012142746_hotfix` et `20261013040000` /
      `20261012143322_hotfix` ; versions au registre des migrations du 14 et du 17 oct. non relevées ;
      purges et `user_traveller` d'état inconnu) et outil en lecture seule
      `scripts/db/migrations-alignment.mjs` (`tests/ops/migrationsAlignment.spec.ts`). 🔒 Tony : export
      du registre, comparaison, puis procédure du document. Rien n'a été renommé sans le registre.
- [~] `visual-tests` : finir sous 25 min (aujourd'hui annulé à chaque fois) ou le
      découper. **Cause (18 oct.)** : un seul job, 180 tests en série (1 worker, 4 projets, une
      reprise par échec) après le build. Mesuré sur GitHub (run `39123292831`) : build 2 min 18,
      projet `desktop-chrome` seul 16 min 29, annulé à 25 min au milieu du 2ᵉ projet. Mesuré en
      local (build de production, même commande) : **46,1 min** pour la suite entière, dont 95
      échecs : les captures de référence ne correspondent plus (ex. `/pays/fr` rend aujourd'hui
      « Cette page n'existe pas », 94 % de pixels différents), les projets `iphone-14-pro-chromium`
      et `iphone-393-chromium` n'ont **aucune** référence (fichiers nommés `iphone-14-pro`), et
      `preparer-live` vise une page servie en dev seulement (404 sur un build). **Fait** : build une
      fois (artefact `.next`), un job par projet en parallèle (25 min chacun) ; `preparer-live` sauté
      quand la page répond 404 ; `iphone-393-chromium` limité à `community-social` (seule spec qui
      lit 393 px) : 140 tests au lieu de 180. **Mesuré en local après** : `desktop-chrome` 16,8 min
      (le plus long), `iphone-393-chromium` 25 s ; avant, par projet : desktop 17,8, iPad 12,3,
      iPhone 430 6,0 min. **Estimé, non mesuré sur GitHub** : ≈ 3 min de build + ≈ 1,5 min de mise
      en place + ≈ 17 min pour le plus long projet, soit ≈ 21 min de bout en bout, sous le délai de
      chaque job. **Reste** : le workflow restera rouge tant que les références ne sont pas refaites
      (🔒 Tony : relire les écrans, puis `workflow_dispatch` avec `update_snapshots`, un artefact par
      projet) ; premier run réel à mesurer.
- [x] Code mort et fichiers d'exemple retirés (DemoLoginButton, CSS sombre du Compas).
      **Lot Z4** : `DemoLoginButton` était déjà supprimé (verrou `audit-scripts-static`) ; les 13
      règles `.dark` du CSS du Compas sont retirées (thème clair intact, `lightOnly.test.ts`) ;
      `demoLogin.ts` n'est PAS mort (la page de connexion l'appelle) : gardé.

---

## Décisions de Tony (⚖️)

| # | Sujet | Recommandation de Claude (0 €) | Décision |
|---|---|---|---|
| 1 | Vercel Hobby et usage commercial (Stripe = commercial, vérifié) | Couper paiement et affiliation en production par drapeau tant que l'offre est Hobby | **Hobby pour l'instant, Stripe éteint** (8 oct.) |
| 2 | IA en production (aucune offre gratuite conforme, vérifié) | Compas complet sans IA ; IA éteinte pour les vrais utilisateurs | **IA NVIDIA gardée allumée** (8 oct.) ; repli sans IA maintenu |
| 5 | Comptes gratuits (sans carte) : Geoapify, LocationIQ, ArcGIS Location Platform, hCaptcha | Tony les crée et pose les clés dans Vercel lui-même | **Faits** (8 oct.) ; branchement par Claude |
| 6 | Essai sans compte : purge (SQL Editor) puis « Allow anonymous sign-ins » | Oui : ferme le compte démo partagé (2.3) | **Fait** (8 oct.), prouvé en production |
| 3 | Applications sur les stores | PWA à la place (0 €) | à venir |
| 4 | Cible de lancement | Francophone d'abord (phase 7), puis monde (phase 6) | à venir |

## Ordre d'exécution

1. Phase 1.1 (base : sauvegardes, plafonds) et 2.1 à 2.3 (failles ouvertes) — d'abord ce
   qui peut casser ou fuir.
2. Phase 3.1 et 3.2 (référentiel, lieux habités) puis 1.3 à 1.5 (sortie des serveurs de
   démonstration).
3. Phase 2.4 à 2.12 (fiabilité), 4.7 (temps), 4.3 (origine), 4.1 et 4.2 (voyageur).
4. Phases 3.3 à 3.9, 4.4 à 4.11, 5.
5. Phase 7 (lancement francophone), puis 6 (monde), puis 8 et 9.
