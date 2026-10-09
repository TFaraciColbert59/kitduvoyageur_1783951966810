# Préparateur `/compas` — état (source de vérité unique)

> Une seule ligne droite : demande libre → compréhension → lieu → itinéraire → données →
> kit / budget / conseils → résultat final. Rien de P3 tant que P0/P1 ne passent pas P2.
> « Fait » = prouvé de bout en bout sur la preview et contrôlé en base, pas « le code compile ».

Mis à jour : 9 octobre 2026. **En production** (koosmoweb.fr) : lot A (PR #76,
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
Lot L (PR suivante, plan `docs/superpowers/plans/2026-10-09-compas-lot-l.md`, mené par
sous-agents avec revue de chaque tâche et revue finale) : MET Norway par un seul point
(20 req/s, rien avant `Expires`), limites sur la destination et la phrase, erreurs
serveur du Compas en base sans donnée personnelle (`app_errors`) et alertes du rapport
quotidien, cookies de session `Lax`. Migration appliquée ; le rapport du 8 oct. lève
« plus de 10 % de préparations échouées » (4 sur 11).

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
