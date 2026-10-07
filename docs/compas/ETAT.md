# Préparateur `/compas` — état (source de vérité unique)

> Une seule ligne droite : demande libre → compréhension → lieu → itinéraire → données →
> kit / budget / conseils → résultat final. Rien de P3 tant que P0/P1 ne passent pas P2.
> « Fait » = prouvé de bout en bout sur la preview et contrôlé en base, pas « le code compile ».

Mis à jour : 7 octobre 2026 (nuit, reprise après le passage en ligne de 19 h 17 – 20 h 30).
Les correctifs de la nuit sont sur la branche `claude/optimistic-albattani-i06ge7`, **pas encore
prouvés en ligne** (conteneur sans accès à la preview ni aux services de carte, voir « Blocages »).

## P0 — Moteur fiable

| # | Sujet | État | Preuve / reste |
|---|---|---|---|
| P0.1 | Préparation en une seule passe (300 s) | **Fait** (preuve preview) | Travail en arrière-plan (`after`), l'écran relit l'issue toutes les 4 s : plus de requête longue coupée par le réseau. Deux préparations simultanées gérées. 50 demandes : de 12 s à 4 min 40 s (20 jours de trek) |
| P0.2 | Compréhension de la demande et résolution du lieu | Partiel | 50/50 lues correctement hors ligne. En ligne corrigés : plein air → lieu naturel (Chartreuse massif, Loire fleuve, Calanques parc), pays entier (États-Unis Ouest), « nuits dehors » inventées par l'IA. Nuit du 7 : « GR34 » donné comme lieu par l'IA (étapes dans l'Indre) → région du sentier ; GR65, GR70 ajoutés. Reste : vérifier Jura/Calanques ; « raquettes Vercors en janvier » arrêté après la destination, dates non posées (cause non trouvée sans journaux) |
| P0.3 | Itinéraire déterministe | Partiel | Lieux réels (Photon → Overpass + Geoapify), hauteurs pour marche et ski (relief zoom 10 sur grande zone), départ d'une ville dite, journée dans un massif → village. Nuit du 7 : traversée plus longue que l'emprise (Jura à vélo, 2 jours bloqués) → elle en sort ou revient ; village de départ au cœur du massif (Beaufort, plus Albertville) ; noms communs (« shanty ») et circonscriptions écartés ; un même lieu, un seul nom (Malaga / Málaga). Reste : base d'un grand massif (Dolomites → Brugnàch, Kalymnos → Vathýs), descente de rivière en canoë, vrai tracé des grands itinéraires (TMB), échelle d'un pays (l'IA nomme : Patagonie 8 lieux introuvables, Islande en zigzag, 7 nuits à Chiang Rai), randonnée dans une grande île (Sardaigne : Cagliari → Alghero) |
| P0.4 | Dates et trajets | Partiel | Route plafonnée selon la durée (week-end ≤ 450 km, sinon avion). Nuit du 7 : **train** en Europe de l'Ouest (150 à 1 200 km, trajet tenant dans le voyage, île écartée par la route mesurée) avant l'avion (Ardennes, Mercantour). Reste : choix d'aéroport |
| P0.5 | Budget et conseils | Partiel | Kit d'une sortie de quelques heures allégé ; le budget ne compte que le matériel indispensable. Nuit du 7 : **papiers, change et prises par règles** (l'IA écrivait « passeport obligatoire » pour l'Italie, la Grèce, la Belgique, l'Irlande et même la Dordogne) ; niveaux de prix pour tous les pays de l'ONU ; l'IA tutoie. Reste : les autres conseils restent du texte libre de l'IA |
| P0.6 | Fallbacks propres | Partiel | Geoapify actif (clé sur Vercel) ; la note d'un repli dit ce que chaque carte a répondu ; limite de fréquence affichée comme une attente. Reste : résultat complet garanti |
| P0.7 | IA production : NVIDIA NIM direct (Nemotron 3.5 Lightning) | Fait | Décision de Tony (7 oct., soir) : on reste sur NVIDIA ; le passage OpenRouter est annulé |
| — | Contexte du voyage unique (`buildTripContext`) | **Fait** | `engine/tripContext.ts`, testé |
| — | Fiabilité (prises atomiques, écritures vérifiées, annulation, arrondis) | **Fait** | Testé |
| — | Phrase de départ persistée | **Fait** | — |
| — | Écran « Où » = la demande + préparation visible | **Fait** (à valider en P2) | `CompasStart`, `CompasPrep` |

## P1 — Données

| # | Sujet | État |
|---|---|---|
| P1.1 | Référentiel géographique local : lieux habités, massifs / parcs, lieux importants, randonnées mondiales, refuges | **Plan chiffré écrit** : `REFERENTIEL-GEO.md`. Base à 423 Mo sur 500 (offre gratuite) ; `places_geo` (294 Mo) importé à moitié et inutilisé par le Compas. Décisions attendues de Tony |
| P1.2 | Activités, POI, météo | Partiel (MET Norway, NASA POWER, POI Overpass) |

## P2 — Validation

| Jeu | Dernier résultat |
|---|---|
| 10 parcours de zone (7 octobre) | 9 sur lieux réels ; 2 défauts (Rome, Vosges), 3 partiels (Vercors, Jura, canoë) |
| 20 parcours réels | À rejouer après P0 |
| 50 demandes entièrement nouvelles | En ligne (7 oct.) : 47/50 prêtes au premier passage, 15 défauts corrigés à la racine pendant le test, 17 rejouées : toutes préparées (2 bloquées par la limite de fréquence, rejouées) |
| Passage du 7 oct. 19 h 17 – 20 h 30 (preview `ce534c0`, lu en base) | 38 voyages : 36 préparés, 1 en attente de la limite de fréquence, 1 sans dates (raquettes). Défauts relevés : papiers faux (7 voyages), GR34 dans l'Indre, « shanty », « West Clare Municipal District », Albertville « au cœur », Jura bloqué 2 jours, Malaga / Málaga, avion pour les Ardennes et le Mercantour → **corrigés la nuit, à reprouver en ligne** ; base Dolomites et Kalymnos, canoë Dordogne, TMB, échelle d'un pays → ouverts (P0.3, P1.1) |

## P3 — Après stabilisation (gelé)

Réservations réelles (Travelpayouts, RouteStack, Viator), équipe / social, bouteille à la mer,
hors ligne, affiliation, animations, polish de maquette et desktop. Accessibilité : close pour
l'instant.

## Blocages (nuit du 7 octobre)

- Le conteneur cloud n'atteint ni la preview (`*.vercel.app`), ni Supabase en direct, ni NVIDIA, Photon, Overpass, MET Norway, Geoapify : à ouvrir dans les réglages réseau de l'environnement (accès complet, ou ces domaines).
- Vercel refuse l'accès au projet (403 sur `tonyfaracip-3325s-projects`) : ni déploiements, ni journaux.
- Supabase reste lisible (outil MCP) : les passages en ligne se contrôlent en base.

## Décisions en vigueur

- IA production : **NVIDIA NIM direct** (décision de Tony du 7 octobre au soir, remplace le passage à OpenRouter).
- Cartes : services OSM gratuits + **Geoapify free tier** en secours (clé fournie, variable `GEOAPIFY_API_KEY` à poser sur Vercel) ; pas d'abonnement à 59 $ pour l'instant.
- Référentiel géographique : accord de principe ; **aucune migration avant le plan chiffré** (taille DB, volumes filtrés, mise à jour, espace final).
- Réservations : branchées après la stabilisation du moteur.

Détail : `AUDIT-2026-10-07.md` (architecture), `AUDIT-DONNEES-2026-10-07.md` (sources), `REFERENTIEL-GEO.md` (plan chiffré P1.1).
