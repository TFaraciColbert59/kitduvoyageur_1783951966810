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

- [ ] **Budget de place** écrit et suivi : cible ≤ 400 Mo en régime (marge de 100 Mo).
      Preuve : requête de taille dans le rapport quotidien (1.1.6).
- [ ] **Plafonds des caches** : `geo_cache` (par type : place, reverse, leg, stages) et
      `route_cache` bornés en nombre de lignes et en taille ; purge planifiée (cron
      `pg_cron` gratuit ou GitHub Actions) ; `purge_route_cache` réellement appelée.
      Preuve : taille stable sur 7 jours.
- [ ] **Tracé dans `trips.metadata`** : géométrie simplifiée plafonnée (≤ 300 points par
      voyage) ; ancien tracé effacé à la réadaptation.
- [ ] **Retrait de `places_geo`** (232 Mo) une fois les pages Pays branchées sur
      `geo_places` (3.8). Preuve : base ≤ 250 Mo avant import des lots 3.3 à 3.7.
- [ ] **Sauvegardes gratuites** : GitHub Actions planifié (quotidien) → `pg_dump`
      (schéma + données hors caches) chiffré, conservé en artefact 30 jours ; procédure de
      restauration écrite et testée une fois sur une base locale. Preuve : un artefact par
      jour, une restauration réussie.
- [ ] **Rapport quotidien** (GitHub Actions, gratuit) : taille de la base, lignes des
      caches, préparations du jour (réussies / échouées), erreurs ; une issue GitHub
      ouverte si un seuil est franchi (base > 430 Mo, échecs > 10 %).
- [ ] **Pause pour inactivité** (7 jours sans requête) : le rapport quotidien suffit à
      garder le projet actif. Preuve : aucune pause en 14 jours.

### 1.2 Hébergement Vercel

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
- [ ] **Région des fonctions** : tester `cdg1` (Paris, proche de Supabase eu-west-3) ;
      mesurer avant/après. Preuve : temps de préparation médian.

### 1.3 Recherche de lieux (géocodage) sans serveur de démonstration

- [ ] **Référentiel local d'abord** (phase 3) : destination, villages, refuges, lieux
      naturels lus dans `geo_places` ; réseau seulement en secours.
- [ ] **Geoapify gratuit** (3 000 crédits/jour, « we do not restrict » l'usage
      commercial) en premier secours : **attribution « Powered by Geoapify »** affichée ;
      `limit=500` ramené au nécessaire ; compteur de crédits du jour en base (géocodage
      et routage ensemble), arrêt à 2 700. Preuve : compteur, attribution visible.
- [ ] **LocationIQ gratuit** (5 000 req/jour, commercial avec lien visible) en second
      secours ; « Search by LocationIQ.com » dans les mentions. Compte à créer par Tony.
- [ ] **Photon public** (pas de clause commerciale, « usage raisonnable ») : dernier
      recours seulement ; User-Agent `koosmoweb.fr` + contact ; rythme global limité
      (jeton en base) ; cache 30 j.
- [ ] **Nominatim public retiré du trafic courant** (« periodic requests from apps are
      considered bulk geocoding ») : département d'un point = `admin_regions_geo` ;
      `officialAlerts` et le reste passent par le référentiel ou Geoapify.
- [ ] Positions envoyées arrondies à 0,01° (RGPD, 2.10).

### 1.4 Points autour des étapes (Overpass)

- [ ] **Fin de la course à 5 instances** ; plus aucun miroir russe ; retrait
      d'overpass-api.de, `lz4`, kumi.systems (non autorisés ou non vérifiés).
- [ ] Un seul fournisseur autorisé en commercial : **private.coffee** (« including
      commercial use », pas de limite, éviter les requêtes simultanées), après les avoir
      prévenus (support@private.coffee) ; requêtes en série, jamais en parallèle.
- [ ] Refuges, campings, eau, sommets lus d'abord dans le référentiel (3.4) ; Overpass
      seulement pour une zone absente.

### 1.5 Calcul d'itinéraire (routage)

- [ ] **Retrait du serveur de démonstration OSRM** (« non-commercial use-cases »,
      vérifié), de `routing.openstreetmap.de` et de `brouter.de` (conditions introuvables).
- [x] Conditions vérifiées (8 oct.) : aucune offre de routage gratuite n'accorde par
      écrit l'usage commercial ; Geoapify (« not restricted ») et Valhalla FOSSGIS
      (« open to the public », identification demandée) sont les seules utilisables ;
      OpenRouteService flou (à demander : enquiry@openrouteservice.org).
- [ ] Ordre : cache partagé (`geo_cache` leg, 90 j) → **Geoapify Routing** (crédits du
      jour) → **Valhalla FOSSGIS** avec `X-Client-Id` (annonce faite sur GitHub
      Discussions) → **estimation annoncée** (distance à vol d'oiseau × coefficient du
      terrain, marquée « estimation »). Preuve : aucune étape sans distance, chaque
      distance dit sa source.
- [ ] User-Agent sur tous les appels de routage.

### 1.6 Fond de carte

- [ ] Retirer les fonds non autorisés en commercial : Esri sans clé
      (`server.arcgisonline.com`, 10 usages), OSM France (« site sans but lucratif »,
      10 usages), OpenTopoMap (conditions non vérifiées).
- [ ] Fond standard : **OpenFreeMap** (vecteur, sans clé ni limite, commercial
      autorisé) via MapLibre (ou extension MapLibre de Leaflet) ; attribution
      « OpenFreeMap © OpenMapTiles Data from OpenStreetMap ». Prévoir un repli : il peut
      s'arrêter sans préavis.
- [ ] Relief et satellite : **ArcGIS Location Platform** gratuit (2 M tuiles et
      1 000 sessions par mois, commercial autorisé avec clé ; coupé au-delà) ; clé
      restreinte au domaine ; « Powered by Esri » + crédits ; compteur de sessions.
      Compte à créer par Tony.

### 1.7 IA à 0 €

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
- [ ] Drapeau `COMPAS_AI` (on/off) lu partout où l'IA est appelée ; Compas testé de bout
      en bout avec l'IA éteinte (jeu de validation P2 rejoué sans IA).
- [ ] Compréhension de la phrase sans IA (4.10) : parseur par règles au niveau du parseur
      actuel avec l'IA.
- [ ] Conseils par règles (4.12) pour que l'absence d'IA ne retire rien d'essentiel.
- [ ] Plafond global quotidien d'appels IA (en plus du plafond par personne) ; refus
      en cas d'erreur du quota pour les appels lourds (fail-closed).
- [ ] Cache des réponses IA identiques (même demande, même jour).

### 1.8 Météo et données ouvertes

- [ ] MET Norway (CC BY 4.0, commercial autorisé) : User-Agent `koosmoweb.fr` +
      courriel de contact (sinon 403) ; 20 req/s pour toute l'application ; respect de
      `Expires` ; cache 30 min (déjà) ; crédit + lien CC BY.
- [ ] NASA POWER (« no restrictions », citation demandée) : clé de cache par mois (et
      non par jour) pour partager le cache.
- [ ] Meteoalarm : conditions à vérifier ; attribution.
- [ ] Taux de change : **Frankfurter v2** (sans clé ni quota, 223 devises ; « Source:
      ECB statistics. » pour les taux BCE), secours **fawazahmed0** (CC0) ; cache 12 h.
- [ ] Carburant : bulletin pétrolier de l'UE (CC BY 4.0) pour l'UE-27 ; ailleurs barème
      versionné et daté, affiché comme « estimation » (aucune source mondiale gratuite).

---

## Phase 2 — Fiabilité et sécurité

### 2.1 Caches partagés

- [~] **`POST /api/route/cache` fermé au public** : écriture signée HMAC par le serveur
      (`src/lib/routeCacheSignature.ts`), 5 000 points au plus par tronçon ; sur la
      branche (42c7e16), preuve en production après fusion.
- [x] Test : une écriture sans signature est refusée (403), rien n'entre en base
      (`tests/routing/route-signature.spec.ts`, I4-CACHE-01b).

### 2.2 Limite de fréquence et abus

- [~] **Limite distribuée gratuite** : fenêtre fixe en base (`rate_limit_consume`,
      table non journalisée, clés hachées, exécutable par le seul rôle de service ;
      migration `20261008164423` appliquée et vérifiée le 8 oct.) au lieu de la
      mémoire par instance, pour **toutes** les routes limitées (Upstash reste
      prioritaire s'il est un jour configuré). Preuve en production après fusion.
- [~] **Contournement par `autofill_pending` fermé** : une reprise (phase « rest »)
      a sa propre limite par personne (12 / 10 min) ; réécrire l'état ne relance plus
      rien sans compter (test `autofillLimits.test.ts`). L'état reste dans
      `trips.metadata` (son déplacement relève de 2.7, écritures concurrentes).
- [~] Plafond global : 120 préparations par heure pour tout le site, message propre.
- [ ] Limite sur `compasSetDestinationAction` et les actions qui appellent la carte.
- [~] Message juste quand la limite est atteinte (plus « déjà lancée plusieurs fois ») :
      personne, site, ou compteur indisponible, chacun dit.
- [ ] Protection des inscriptions et des sessions anonymes contre les comptes en série :
      **hCaptcha gratuit** branché sur Supabase Auth (Turnstile exclu : Cloudflare) ;
      BotID basique de Vercel sur les actions coûteuses ; limite d'IP de Supabase Auth
      (30 sessions anonymes/heure par défaut) gardée.

### 2.3 Connexion démo

- [~] **Essai sans compte** (sessions anonymes Supabase, gratuites) à la place du compte
      démo partagé : bouton « Essayer sans compte » sur `/connexion`, compté par
      adresse (5/h) et pour le site (300/jour) ; la connexion démo se ferme d'elle-même
      dès que Supabase ouvre les connexions anonymes (`/auth/v1/settings`, relu toutes
      les 5 min). En base (`20261008165901`, appliquée le 8 oct.) : profil sans e-mail
      (`<id>@essai.invalid`), 38 politiques restrictives « rien de public ni de social
      depuis un essai », invitations refusées avec un message clair.
- [ ] 🔒 **Tony, dans Supabase** (rien d'autre ne l'ouvre) : (1) lancer
      `20261008180000_anonymous_trial_purge.sql` dans le SQL Editor (purge des essais
      inactifs depuis 7 jours, chaque nuit, `pg_cron`) ; (2) Authentication → Sign In /
      Providers → **Allow anonymous sign-ins**. Puis Claude prouve l'essai en
      production et retire le compte démo (mot de passe remplacé par une valeur
      aléatoire tirée en base, variables `DEMO_LOGIN_*` à retirer).
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
- [ ] Revue de toutes les fonctions `SECURITY DEFINER` (search_path, droits `EXECUTE`).
- [ ] Revue des policies « public » restantes (conseiller Supabase `get_advisors`).

### 2.5 Quota IA

- [x] Quota par personne appliqué (8 oct.).
- [ ] Palier : la préparation est comptée en `heavy` (aujourd'hui `fast`) comme le
      prévoit sa fiche.
- [ ] Plafond global et fail-closed (1.7).

### 2.6 Préparation durable

- [ ] Étapes écrites et **tracées au fil de l'eau** (aussi en phase `all`) : une
      coupure ne laisse plus d'étapes orphelines ; « Annuler » les retrouve toutes.
- [ ] Budget interne vérifié dans la boucle de recherche des étapes.
- [ ] Reprise idempotente après coupure (même plan, pas de doublon). Preuve : test de
      coupure simulée à chaque phase.
- [ ] Commentaires « 60 s » mis à jour (300 s).

### 2.7 Écritures concurrentes

- [ ] `patchTripMetadata` atomique (RPC `jsonb` côté SQL) : la préparation et les
      gestes de l'équipe ne s'écrasent plus.

### 2.8 Attente de la préparation

- [ ] Plus de rendu complet toutes les 4 s : Supabase Realtime (gratuit) ou attente
      à intervalle croissant + rafraîchissement seulement si `updated_at` change.

### 2.9 Observabilité à 0 €

- [ ] Table `app_errors` (erreurs serveur du Compas, sans donnée personnelle) + rapport
      quotidien (1.1) ; ou Sentry offre gratuite si ses conditions le permettent.
- [ ] `src/app/compas/error.tsx` et `loading.tsx` ; `global-error.tsx` ne dit plus
      « l'équipe a été notifiée » sans que ce soit vrai.
- [ ] Erreurs internes jamais affichées dans les notes (`autofillActions.ts`).

### 2.10 RGPD

- [ ] Position GPS arrondie (≈ 1 km) avant tout envoi à un tiers ; jamais enregistrée au
      mètre ; base d'un séjour sans lieu dit = commune, pas le point GPS.
- [ ] Explication avant la demande de position (pourquoi, ce qui est envoyé) ; refus
      possible sans perdre la préparation (origine demandée en texte, 4.3).
- [ ] Politique de confidentialité à jour : Vercel, Supabase, NVIDIA (si gardé),
      Photon/Nominatim/Geoapify, MET Norway, RouteStack, Viator ; une seule version.
- [ ] Durées de conservation écrites (caches, voyages anonymes, journaux).

### 2.11 En-têtes et cookies

- [ ] CSP appliquée (plus seulement `Report-Only`) après une semaine de rapports propres.
- [ ] Cookies `SameSite` revus.

### 2.12 Tests

- [ ] Tests d'autorisation réels de `requireEditor` (sans simulation).
- [ ] Test du contournement de la limite (2.2) et de la coupure (2.6).
- [ ] **E2E Compas bloquant en CI** (préparation simulée, sans réseau externe).
- [ ] Plus aucun test unitaire qui appelle un serveur public (comme P024-09, corrigé).

---

## Phase 3 — Données : référentiel géographique local (P1.1)

### 3.1 Table et accès

- [ ] Migration `geo_places` (source, identifiant source, nom, nom français, nom anglais,
      nature, pays, région, latitude, longitude, altitude, population, rang, emprise,
      date de mise à jour) ; 3 index ; lecture publique, écriture `service_role`.
- [ ] RPC `geo_places_in_bbox(w, s, e, n, kinds, limit)` et
      `geo_places_search(q, cc, limit)` (nom normalisé, trigrammes bornés).
- [ ] Budget de place par lot mesuré avant et après chaque import.

### 3.2 Import des lieux habités

- [ ] Script d'import (Node, exécuté par GitHub Actions, gratuit) : GeoNames `cities500`
      (CC BY 4.0) + tous les lieux habités de France et des pays alpins ; noms français
      et anglais (`alternateNamesV2`) ; région rattachée.
- [ ] Brancher `lookupAreaPlaces` et la recherche de destination sur la table, Photon en
      secours. Preuve : préparations Vercors, Dolomites, Patagonie sans appel Photon pour
      la zone.

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

- [ ] Pages Pays lues dans `geo_places` (par région et par pays).
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
- [ ] Prises et change selon le pays de résidence ; « France Diplomatie » pour les
      Français seulement, le service officiel du pays sinon.
- [ ] `keepAiNote` ne retire plus les conseils justes pour un non-Français.
- [ ] Mise à jour des barèmes périmés (ESTA, exemption Vietnam) avec date de vérification.
- [ ] Note de papiers jamais perdue par la troncature à 6 notes.

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

- [ ] « Aujourd'hui » au fuseau du voyageur (navigateur) partout (serveur, calendrier,
      `CompasStart`).
- [ ] Lever et coucher du soleil au fuseau de la destination (`tz-lookup`) au-delà de la
      prévision ; départ conseillé juste.
- [ ] Hiver selon l'hémisphère ; table des saisons sèches complétée (Brésil, nord de
      l'Australie, Caraïbes, Afrique de l'Ouest, Guyane, Mayotte).

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

- [ ] Nombres en lettres, dates relatives, budgets en devises (« 2000 $ »,
      « 1,500 € »), dates numériques selon la langue.

### 4.11 Notes et conseils

- [ ] Conseils essentiels par règles (sécurité, eau, saison, papiers) ; l'IA n'ajoute que
      du facultatif, signalé comme tel.

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

- [ ] Attributions complètes et cliquables : OpenStreetMap (lien copyright), fond de
      carte retenu (1.6), Geoapify, MET Norway, NASA POWER, Terrain Tiles, GeoNames,
      Meteoalarm, BCE.
- [ ] Mention IA au démarrage, sur les conseils et sur toute étape proposée par l'IA
      (AI Act art. 50).
- [ ] Mention d'affiliation dans la recherche d'hébergement en direct ; placée avant la
      liste dans Parcours.
- [ ] Politique de confidentialité et mentions légales (2.10).

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

| # | Sujet | Recommandation de Claude (0 €) |
|---|---|---|
| 1 | Vercel Hobby et usage commercial (Stripe = commercial, vérifié) | Couper paiement et affiliation en production par drapeau tant que l'offre est Hobby |
| 2 | IA en production (aucune offre gratuite conforme, vérifié) | Compas complet sans IA ; IA éteinte pour les vrais utilisateurs |
| 5 | Comptes gratuits (sans carte) : Geoapify, LocationIQ, ArcGIS Location Platform, hCaptcha | Tony les crée et pose les clés dans Vercel lui-même |
| 6 | Essai sans compte : purge (SQL Editor) puis « Allow anonymous sign-ins » | Oui : ferme le compte démo partagé (2.3) |
| 3 | Applications sur les stores | PWA à la place (0 €) |
| 4 | Cible de lancement | Francophone d'abord (phase 7), puis monde (phase 6) |

## Ordre d'exécution

1. Phase 1.1 (base : sauvegardes, plafonds) et 2.1 à 2.3 (failles ouvertes) — d'abord ce
   qui peut casser ou fuir.
2. Phase 3.1 et 3.2 (référentiel, lieux habités) puis 1.3 à 1.5 (sortie des serveurs de
   démonstration).
3. Phase 2.4 à 2.12 (fiabilité), 4.7 (temps), 4.3 (origine), 4.1 et 4.2 (voyageur).
4. Phases 3.3 à 3.9, 4.4 à 4.11, 5.
5. Phase 7 (lancement francophone), puis 6 (monde), puis 8 et 9.
