# Préparateur `/compas` — état (source de vérité unique)

> Une seule ligne droite : demande libre → compréhension → lieu → itinéraire → données →
> kit / budget / conseils → résultat final. Rien de P3 tant que P0/P1 ne passent pas P2.
> « Fait » = prouvé de bout en bout sur la preview et contrôlé en base, pas « le code compile ».

Mis à jour : 8 octobre 2026 (midi). **La PR #72 est en production** depuis 12 h 01 UTC
(`972a14d`, koosmoweb.fr), après la PR #73 (CI de `main` de nouveau verte). Suite sur la
branche `claude/optimistic-albattani-i06ge7` (PR #74).

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
| P1.1 | Référentiel géographique local : lieux habités, massifs / parcs, lieux importants, randonnées mondiales, refuges | **Plan chiffré écrit** : `REFERENTIEL-GEO.md`. Base à 424 Mo sur 500 (offre gratuite). `places_geo` (294 Mo) : import alphabétique arrêté après les pays en A–C (Chine 85 112 lieux, France 692), **aucun lieu rattaché à sa région** (`admin_region_id` nul partout : la lecture par région des pages Pays ne trouve rien). **Bloqué** : la migration qui retire 9 index en double ou jamais lus (−70 Mo) n'atteint pas la base (l'outil de migration attend une confirmation de Tony, 8 oct. midi) ; sans elle, l'import des lieux habités (~55 Mo) porterait la base vers 480 Mo |
| P1.2 | Activités, POI, météo | Partiel (MET Norway, NASA POWER, POI Overpass) |

## P2 — Validation

| Jeu | Dernier résultat |
|---|---|
| 10 parcours de zone (7 octobre) | 9 sur lieux réels ; 2 défauts (Rome, Vosges), 3 partiels (Vercors, Jura, canoë) |
| 20 parcours réels | À rejouer après P0 |
| 50 demandes entièrement nouvelles | En ligne (7 oct.) : 47/50 prêtes au premier passage, 15 défauts corrigés à la racine pendant le test, 17 rejouées : toutes préparées (2 bloquées par la limite de fréquence, rejouées) |
| Passage du 7 oct. 19 h 17 – 20 h 30 (preview `ce534c0`, lu en base) | 38 voyages : 36 préparés, 1 en attente de la limite de fréquence, 1 sans dates (raquettes). Défauts relevés → corrigés la nuit, reprouvés le 8 (lignes ci-dessous) |
| Production, 8 oct. 12 h 05 (`972a14d`, lu en base) | Descente de la Dordogne en canoë, 3 jours : prête en 42 s, Lanzac → Sainte-Mondane → Domme → Allas-les-Mines, conseils au tutoiement. Défaut lu en base : parcours de 36,1 km pour 54,1 km d'eau (premier jour non compté) → corrigé (PR #74) |
| Passages du 7 oct. 21 h et du 8 oct. 5 h 39 – 7 h 06 (preview PR #72, lus en base) | 31 voyages, dont 26 au premier passage : 25 préparés ; Ardennes (21 h 11) défait aussitôt puis bloqué par la limite de fréquence, et un écran resté en attente sur un lancement en double (données écrites) → **deux causes corrigées**. **Prouvés** : papiers, train, Jura, Beaufortain, Mercantour, Dolomites, Vercors en janvier, Cévennes, Malaga, Dordogne en canoë, tutoiement (Bruges reprouvé à 6 h 27). Tarn et Ardèche en canoë reprouvés à 6 h 47, « West Clare » à 7 h 04 (Shannon). Ouverts : Kalymnos, Patagonie, Sardaigne, journée lointaine |

## P3 — Après stabilisation (gelé)

Réservations réelles (Travelpayouts, RouteStack, Viator), équipe / social, bouteille à la mer,
hors ligne, affiliation, animations, polish de maquette et desktop. Accessibilité : close pour
l'instant.

## Blocages (8 octobre)

- Réseau ouvert : la preview, Photon et Supabase répondent depuis le conteneur ; Overpass reste instable depuis ici (miroirs en 500/504).
- Vercel : connecteur reconnecté par Tony le 8 oct. (déploiements, journaux et variables lisibles).
- Réservations (P3, gelé) : **RouteStack en direct sur le site de production** (8 oct., 12 h 03, mode `live`) : hôtels à Annecy (Logis Hôtel Annecy Nord, Hotel du Midi…), Lisbonne (Sheraton…) et Paris ; vols Genève → Lisbonne (3 offres dès 128,93 USD, 12 s). **Villes en français prouvées sur la preview de la PR #74** (8 oct., 12 h 31) : vol Paris → Lisbonne (PAR → LIS, dès 47,07 USD), Genève → Londres (GVA → LON : Gatwick, Luton), Nice → Lyon (NCE → LYS), voiture à Lisbonne (3 offres). Aéroport de la ville d'après la réponse de RouteStack (« All Airports » d'abord, jamais une gare), nom anglais d'OpenStreetMap en secours. Un vol peut prendre jusqu'à 29 s.
- Supabase : la migration de suppression d'index (−70 Mo) attend la confirmation de Tony ; l'import des lieux habités attend cette place.

## Décisions en vigueur

- **Mandat (Tony, 8 octobre)** : carte blanche. Claude mène le chantier seul : migrations, corrections de tests, fusion des PR quand la CI est verte, déploiements Vercel (connecteur reconnecté sur l'équipe `tonyfaracip-3325s-projects`). Chaque étape reste prouvée en ligne et contrôlée en base, et dite dans ce fichier.

- IA production : **NVIDIA NIM direct** (décision de Tony du 7 octobre au soir, remplace le passage à OpenRouter).
- Cartes : services OSM gratuits + **Geoapify free tier** en secours (clé fournie, variable `GEOAPIFY_API_KEY` à poser sur Vercel) ; pas d'abonnement à 59 $ pour l'instant.
- Référentiel géographique : **offre gratuite Supabase** (décision de Tony du 8 octobre), référentiel compact `geo_places` (~300 Mo au final, `places_geo` retiré), feu vert donné par le mandat. Ordre : index inutiles retirés, puis `geo_places` et import des lieux habités, voir `REFERENTIEL-GEO.md`.
- Réservations : branchées après la stabilisation du moteur.

Détail : `AUDIT-2026-10-07.md` (architecture), `AUDIT-DONNEES-2026-10-07.md` (sources), `REFERENTIEL-GEO.md` (plan chiffré P1.1).
