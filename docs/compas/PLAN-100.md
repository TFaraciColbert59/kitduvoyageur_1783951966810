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
| Socle (services, hébergement, base) | 20 % | 100 % | 1 |
| Fiabilité et sécurité | 45 % | 100 % | 2 |
| Données (référentiel géographique) | 15 % | 100 % | 3 |
| Moteur (itinéraire, budget, papiers, kit, temps) | 45 % | 100 % | 4 |
| Interface, accessibilité, légal (français) | 75 % | 100 % | 5 |
| Monde (langues, formats, voyageur non français) | 10 % | 100 % | 6 |
| Validation et lancement | 30 % | 100 % | 7 |
| Après stabilisation (P3) | — | 100 % | 8 |
| Dette et hygiène | — | 100 % | 9 |

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
      🔒 Suppressions : `20261008190000_base_scheduled_purges.sql` à lancer par Tony dans
      le SQL Editor. Preuve : taille stable sur 7 jours.
- [x] **Tracé dans `trips.metadata`** : 600 points au plus pour tout le voyage
      (`MAX_TRACK_POINTS`, ~12 Ko ; 150 par tronçon avant), réécrit à chaque
      préparation (8 oct. : 23 Ko au plus, 3 Ko en moyenne).
- [~] **Retrait de `places_geo`** (232 Mo) : plus aucun lecteur depuis le lot E (pages
      Pays sur `geo_places`). 🔒 Tony : `drop table public.places_geo;` dans le SQL
      Editor. Preuve : base ≤ 250 Mo avant import des lots 3.3 à 3.7.
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
- [ ] Aucune des 15 routes `/api/cron/*` du site n'est planifiée (ni `vercel.json`, ni
      tâche GitHub ; 8 oct.) : les brancher sur `pg_cron` + `pg_net` ou les retirer
      (hors Compas, phase 9).

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
- [ ] **Durée des fonctions** : rester ≤ 300 s (maximum Hobby) ; préparation découpée en
      étapes reprenables (2.6) pour ne jamais dépendre d'une seule fonction longue.
- [ ] **Coût de calcul** : supprimer le rafraîchissement complet de page toutes les 4 s
      (2.8) ; mettre en cache les données de page (météo 30 min, altitudes 30 j).
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

- [ ] **Référentiel local d'abord** (phase 3) : destination, villages, refuges, lieux
      naturels lus dans `geo_places` ; réseau seulement en secours.
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
- [~] **Nominatim public retiré du trafic courant** (« periodic requests from apps are
      considered bulk geocoding ») : remplacé par LocationIQ dans le Compas dès que la
      clé est lue (lot B). Reste : `officialAlerts` et les modules hors Compas.
- [x] Positions envoyées arrondies à 0,01° (RGPD, 2.10) : `coarsePosition` dès l'entrée
      de la préparation (lot F).

### 1.4 Points autour des étapes (Overpass)

- [~] **Fin de la course à 5 instances** dans le Compas (`stagePoiLookup.ts`, lot B) :
      private.coffee seul, une requête à la fois, test de garde
      (`overpassEndpoints.test.ts`). Reste hors Compas : `lib/queries/amenities.ts`
      (Partir librement), `explorer-osm/adapters/overpassAdapter.ts`,
      `trips/connectors/realDataConnectors.ts`.
- [ ] Un seul fournisseur autorisé en commercial : **private.coffee** (« including
      commercial use », pas de limite, éviter les requêtes simultanées), après les avoir
      prévenus (support@private.coffee) ; requêtes en série, jamais en parallèle.
- [ ] Refuges, campings, eau, sommets lus d'abord dans le référentiel (3.4) ; Overpass
      seulement pour une zone absente.

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
- [ ] Fond standard : **OpenFreeMap** (vecteur, sans clé ni limite, commercial
      autorisé) via MapLibre (ou extension MapLibre de Leaflet) ; attribution
      « OpenFreeMap © OpenMapTiles Data from OpenStreetMap ». Prévoir un repli : il peut
      s'arrêter sans préavis.
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
- [ ] Meteoalarm : conditions à vérifier ; attribution.
- [x] Taux de change : **Frankfurter v2** (`/v2/rates`, 104 banques centrales, 223
      devises ; vérifié le 8 oct. : VND, ARS, KES, XPF servis), secours **currency-api**
      (CC0) ; cache 12 h ; la source est dite à côté du montant ; mentions : « Source:
      ECB statistics. » et currency-api. Tests `currency.test.ts`. ⚠️ Un voyage
      n'enregistre encore que six devises (enum `trip_budget_currency`) et le Compas le
      crée en euros (retour Codex sur #82) : la conversion dans la devise du pays de
      destination est à faire en 4.2.
- [ ] Carburant : bulletin pétrolier de l'UE (CC BY 4.0) pour l'UE-27 ; ailleurs barème
      versionné et daté, affiché comme « estimation » (aucune source mondiale gratuite).

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
- [ ] Garder son essai : lier un e-mail à la session anonyme (« manual linking » à
      allumer dans Supabase) au lieu de créer un nouveau compte qui perd le voyage.
- [x] `DemoLoginButton.tsx` retiré (mot de passe du compte démo en clair, **encore
      valable** le 8 oct.) ; plus aucune exclusion du scan de secrets.
- [x] `scripts/compas/validate-online.mjs` : « Essayer sans compte » dès qu'il existe,
      sinon « Connexion démo ».

### 2.4 Données et droits

- [x] Liens d'invitation invisibles des simples lecteurs (8 oct.).
- [ ] Tests pgTAP : `trip_invitations`, `geo_cache`, `route_cache`, `trips`,
      `trip_steps` (lecteur, éditeur, anonyme) ; CI `database-gates` activée.
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
- [ ] Revue des policies « public » restantes (conseiller Supabase `get_advisors`).

### 2.5 Quota IA

- [x] Quota par personne appliqué (8 oct.).
- [x] Palier : la préparation est comptée en `heavy` comme le prévoit sa fiche
      (`quotaTier`), tout en gardant le modèle rapide (réponse longue, temps compté).
      Test TEST-ASK-04b.
- [ ] Plafond global et fail-closed (1.7).

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

- [~] Position GPS arrondie (≈ 1 km) avant tout envoi à un tiers : fait pour la
      préparation du Compas (lot F). Reste : jamais enregistrée au mètre ailleurs ; base
      d'un séjour sans lieu dit = commune, pas le point GPS.
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

- [ ] CSP appliquée (plus seulement `Report-Only`) après une semaine de rapports propres.
- [x] Cookies `SameSite` revus (lot L) : session Supabase en `Lax` côté navigateur et
      côté serveur (essai sans compte, retour OAuth, rafraîchissements) — elle était en
      `None` partout ; le site envoie `X-Frame-Options: DENY`, `None` ne servait à
      rien. Les autres cookies (`lkdv_kit_ref`, aventure active, langue) étaient déjà
      `Lax`.

### 2.12 Tests

- [ ] Tests d'autorisation réels de `requireEditor` (sans simulation).
- [ ] Test du contournement de la limite (2.2) et de la coupure (2.6).
- [ ] **E2E Compas bloquant en CI** (préparation simulée, sans réseau externe).
- [ ] Plus aucun test unitaire qui appelle un serveur public (comme P024-09, corrigé).

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

- [ ] GeoNames classes T et L + OSM `boundary=national_park/protected_area` (emprise
      rectangulaire), import par lot hors Vercel.

### 3.4 Refuges, cabanes, campings, points d'eau

- [ ] OSM `tourism=alpine_hut/wilderness_hut/camp_site`, `amenity=drinking_water`,
      import par pays (Overpass hors Vercel, en série, une fois par mois).

### 3.5 Escalade et ski

- [ ] OSM `climbing=crag/area`, `landuse=winter_sports`, stations ; corrige Kalymnos
      (Masouri), Dolomites (via ferrata).

### 3.6 Rivières navigables

- [ ] OSM `waterway=river` avec `canoe=*`/`whitewater=*` (tracé simplifié) ; noms
      « Río », « River », « Fluss »… reconnus.

### 3.7 Grands itinéraires

- [ ] OSM `route=hiking` réseaux `iwn`/`nwn` (GR20, TMB, Kungsleden, JMT, Annapurna) :
      tracé simplifié et étapes ; « GR34 » et voisins sans liste en dur.

### 3.8 Pages Pays et retrait de `places_geo`

- [x] Pages Pays lues dans `geo_places` (par pays ; `fetchPlacesByCountry`), en
      production depuis `f5b5ac9` (France, Italie, Népal : 200).
- [ ] Suppression de `places_geo` (−232 Mo), via SQL Editor si le connecteur refuse.

### 3.9 Mise à jour

- [ ] GitHub Actions mensuel : réimport idempotent (upsert sur identifiant source),
      retrait des lieux absents deux fois de suite ; attributions GeoNames et ODbL.

---

## Phase 4 — Moteur

### 4.1 Contexte voyageur

- [ ] Profil : nationalité, pays de résidence, devise, langue, fuseau, domicile (ville) ;
      demandé une fois, modifiable dans `/compte` ; les réglages du compte (unités,
      devise, fuseau) enfin lus.
- [ ] Sans profil : rien d'affirmé qui dépende de la nationalité.

### 4.2 Papiers, prises, change

- [ ] Table passeport × destination tirée de **travelrequirements.info v1.3.0**
      (CC BY 4.0, commercial autorisé, crédit exact de l'éditeur), versionnée dans le
      code. Les jeux dérivés de Passport Index sont exclus (recherche académique
      seulement).
- [ ] Budget aussi dans la devise du pays de destination (taux Frankfurter v2, 223
      devises, déjà branché) : aujourd'hui seulement si la devise du voyage est l'une des
      six de l'enum `trip_budget_currency`, et le Compas ne la change jamais.
- [ ] Prises et change selon le pays de résidence ; « France Diplomatie » pour les
      Français seulement, le service officiel du pays sinon.
- [ ] `keepAiNote` ne retire plus les conseils justes pour un non-Français.
- [ ] Mise à jour des barèmes périmés (ESTA, exemption Vietnam) avec date de vérification.
- [x] Note de papiers jamais perdue par la troncature : l'essentiel (papiers, sécurité)
      passe avant les notes de préparation et les suggestions de l'IA (`orderNotes`, 8
      notes), lot K.

### 4.3 Origine du voyage

- [ ] Origine = ville dite (« depuis Lyon »), domicile du profil ou GPS ; **jamais la
      France par défaut** ; sans origine, le trajet n'est pas chiffré (dit à l'écran).
- [ ] Action « depuis X » dans la compréhension de la phrase.
- [ ] Aéroport le plus proche de l'origine et de la destination (OurAirports, CC0).

### 4.4 Trajets

- [ ] Train hors des 10 pays (Europe entière, Japon, Corée, Chine, Inde, Amérique du
      Nord) par règles de distance et de réseau ; barème par pays.
- [ ] Préférence « sans voiture » ; transports en commun quand la zone en a.
- [ ] Journée à plus de 3 h de trajet signalée (Mercantour depuis Annecy).

### 4.5 Itinéraire

- [ ] Échelle d'un pays **sans noms de l'IA** : bases multiples choisies dans le
      référentiel (rang, notoriété) ; chemin `planBase` multi-bases réellement atteint.
- [ ] Espaces sauvages : densité de lieux adaptée (refuges, campings, bivouac annoncé).
- [ ] Acclimatation en alpinisme (paliers d'altitude).
- [ ] Grands itinéraires suivis sur leur tracé (3.7).
- [ ] Grandes îles (Sardaigne) : randonnée à pied, pas en voiture d'étape en étape.
- [ ] Défauts ouverts : Kalymnos, Patagonie (nuits sur un lac), « Mòguru/Mogoro », TMB.
- [ ] Emprises qui traversent l'antiméridien (Fidji).

### 4.6 Budget

- [ ] Calcul en euros, **affichage dans la devise du voyageur** (taux gratuit, 1.8).
- [ ] Carburant par pays (table versionnée, date) ; péages là où ils comptent.
- [ ] Assurance et repas par région ; libellés « indice de prix du pays » (plus
      « prix français »).

### 4.7 Temps

- [x] « Aujourd'hui » au fuseau du voyageur (navigateur) partout (serveur, calendrier,
      `CompasStart`). Lot M : fuseau du navigateur envoyé au serveur (repli Paris), météo
      datée au fuseau de la destination (`zone.test.ts`, `compasWeather.test.ts`).
- [x] Lever et coucher du soleil au fuseau de la destination (`tz-lookup`) au-delà de la
      prévision ; départ conseillé juste. Lot M : « heure locale », départ à l'aube si 7 h
      ne suffit pas, « HH:MM » enfin lu (`sun.test.ts`, `weather.test.ts`, `danger.test.ts`).
      Limite connue : un seul fuseau par voyage, celui de la première étape placée.
- [x] Hiver selon l'hémisphère ; saison sèche des tropiques hors table (Brésil, nord de
      l'Australie, Caraïbes, Afrique de l'Ouest, Guyane, Mayotte). Lot M : la table n'est
      pas complétée à la main (aucune ligne inventée) ; hors table, mois le plus sec des
      normales NASA POWER 2001-2020 au point retenu (`period.test.ts`,
      `powerNormals.test.ts`, `metno.test.ts`) ; hiver décalé de six mois au sud
      (`projectContext.test.ts`).

### 4.8 Kit

- [ ] Règles fondées sur les normales climatiques (NASA POWER) : froid sans altitude,
      pluie, mousson, chaleur.
- [ ] Tropiques : moustiques, eau (filtre/pastilles), soleil ; filtre à eau selon la
      source, pas seulement l'altitude.
- [ ] Altitudes de secours sans liste de pays en dur.

### 4.9 Alertes officielles

- [ ] Meteoalarm pour toute l'Europe ; ailleurs, « non couvert » dit clairement (déjà) ;
      sources gratuites hors Europe recherchées.

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
- [ ] Reste : dates numériques selon la langue de la personne (phase 6) ; montant « par
      personne » multiplié par le groupe ; « quelques jours ».

### 4.11 Notes et conseils

- [x] Lot K (`engine/advice.ts`, `advice.test.ts`) : altitude (au-dessus de 2 500 m),
      avalanches en hiver selon l'hémisphère (BERA en France), orages d'été en montagne,
      sortie seul·e (112 seulement là où il répond), refuges à réserver, règles du bivouac
      à vérifier (sans horaire inventé), rivière ; trois au plus, le plus grave d'abord.
      L'IA ne donne plus que des « Suggestion de l'IA (facultatif) », jamais une redite
      d'une règle. Reste : eau (filtre selon la source, tropiques), avec 4.8.

---

## Phase 5 — Interface, accessibilité, légal (français)

### 5.1 États

- [ ] Squelette de chargement et page d'erreur propres au Compas (2.9).

### 5.2 Accessibilité (WCAG 2.2 AA)

- [ ] Focus piégé dans les tiroirs et rendu à l'élément d'origine.
- [ ] `KitRow` : plus de bouton dans un bouton ; Espace géré.
- [ ] Calendrier des conditions : qualité dite en texte, pas seulement en couleur.
- [ ] Pastilles d'alerte des étapes annoncées au lecteur d'écran.
- [ ] Tailles de texte en `rem` ; lignes qui s'agrandissent au lieu de tronquer.
- [ ] « Annuler » : délai réglable ou plus long ; erreurs en `role="alert"`.
- [ ] Informations portées par `title` doublées en texte ; `forced-colors`.
- [ ] Test réel VoiceOver et TalkBack ; CI axe étendue à tous les tiroirs.

### 5.3 Légal visible

- [~] Attributions complètes et cliquables : section « Sources des données et
      licences » des mentions légales (OpenStreetMap, Esri, Photon, LocationIQ, Geoapify,
      Overpass, MET Norway, NASA POWER), lot B. Reste : Terrain Tiles, GeoNames,
      Meteoalarm, BCE ; « Powered by Geoapify » là où ses résultats s'affichent.
- [~] Mention IA au démarrage, sur les conseils et sur toute étape proposée par l'IA
      (AI Act art. 50).
- [ ] Mention d'affiliation dans la recherche d'hébergement en direct ; placée avant la
      liste dans Parcours.
- [~] Politique de confidentialité et mentions légales (2.10) : hébergeur corrigé
      (Vercel et non Netlify ; base à Paris et non Francfort), NVIDIA, services de carte et
      hCaptcha ajoutés aux destinataires (lot B).
- [ ] ⚖️ **Identité de l'éditeur à fournir par Tony** : les mentions légales affichent
      une société d'exemple (« 1 Rue de la Paix », SIRET 123 456 789). Obligatoire (LCEN)
      avant toute ouverture au public ; Claude n'invente rien ici.

### 5.4 Mobile (Capacitor)

- [ ] Barre d'état lisible sur le paysage clair du Compas.
- [ ] Texte de la demande de position juste (Info.plist, Android).
- [ ] Zones sûres vérifiées sur iPhone à encoche (capture 393 × 852).

### 5.5 Écarts avec la maquette (`ECARTS_MAQUETTE.md`)

- [ ] Îlot « prochaine décision, appliquer ».
- [ ] Heure de passage à chaque étape (Quand).
- [ ] Niveau et présence des membres ; rôles (dans la règle `/hub`) ; charge par membre.
- [ ] Manques : Emprunter · Louer · Acheter complet ; appui long : fiche, historique.
- [ ] Carte : style des pastilles et de l'encart ; fonds Relief et Satellite gratuits.
- [ ] Risques : barres par risque, sources datées.

### 5.6 Bureau et tablette

- [ ] Mise en page à partir de 768 px (tiroirs latéraux, carte large), sans casser le
      mobile.

### 5.7 Documentation

- [ ] `DESIGN_REFERENCE.md` : thème sombre (contradiction) corrigé.
- [ ] `ETAT.md`, `REFERENTIEL-GEO.md`, ce plan : à jour à chaque PR.

---

## Phase 6 — Monde (langues, formats, voyageur non français)

### 6.1 Langues de l'interface

- [ ] Brancher le Compas sur `src/lib/i18n` (FR, EN) ; outil de couverture étendu à
      `src/features`.
- [ ] Extraction des ~1 000 textes de l'interface et des 188 messages serveur.
- [ ] Textes enregistrés en base (titres, budget, notes, kit) remplacés par des clés et
      paramètres, rendus à l'affichage.
- [ ] Pluriels et décimales par `Intl` ; `<html lang>` juste.
- [ ] Langues suivantes : ES, DE, IT (ordre selon la demande mesurée).

### 6.2 IA et règles multilingues

- [ ] Consignes de l'IA dans la langue du voyageur ; `repairAccents`, `tutoyer`,
      `keepAiNote` par langue (ou désactivés hors français).
- [ ] Compréhension de la phrase en EN, ES, DE, IT (corpus de 50 phrases par langue).

### 6.3 Formats et unités

- [ ] Dates, nombres, devises par `Intl` avec la locale du voyageur ; semaine selon la
      région.
- [ ] Unités impériales de bout en bout (km/mi, m/ft, °C/°F, kg/lb).

### 6.4 Contenu

- [ ] Recherche de lieux dans la langue du voyageur (Photon, Nominatim, Geoapify,
      référentiel : noms par langue).
- [ ] Textes natifs traduits (iOS `.lproj`, Android `values-xx`).
- [ ] Mentions légales et d'affiliation par région (FTC, CMA).

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

- [ ] `eslint.ignoreDuringBuilds` remis à `false` (CLAUDE.md) après nettoyage du lint.
- [ ] Fichiers non formatés par Prettier (`track.ts`, `routeStackBookingProvider.ts`,
      `routingService.ts`…) reformatés dans une PR dédiée.
- [ ] Actions GitHub sur Node 20 (déprécié) mises à jour.
- [ ] Historique des migrations aligné dépôt ↔ base (versions divergentes du 4 octobre).
- [ ] `visual-tests` : finir sous 25 min (aujourd'hui annulé à chaque fois) ou le
      découper.
- [ ] Code mort et fichiers d'exemple retirés (DemoLoginButton, CSS sombre du Compas).

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
