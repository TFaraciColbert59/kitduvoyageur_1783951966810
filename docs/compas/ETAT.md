# Préparateur `/compas` — état (source de vérité unique)

> Une seule ligne droite : demande libre → compréhension → lieu → itinéraire → données →
> kit / budget / conseils → résultat final. Rien de P3 tant que P0/P1 ne passent pas P2.
> « Fait » = prouvé de bout en bout sur la preview et contrôlé en base, pas « le code compile ».

Mis à jour : 7 octobre 2026 (soir, après le test des 50 demandes).

## P0 — Moteur fiable

| # | Sujet | État | Preuve / reste |
|---|---|---|---|
| P0.1 | Préparation en une seule passe (300 s) | **Fait** (preuve preview) | Travail en arrière-plan (`after`), l'écran relit l'issue toutes les 4 s : plus de requête longue coupée par le réseau. Deux préparations simultanées gérées. 50 demandes : de 12 s à 4 min 40 s (20 jours de trek) |
| P0.2 | Compréhension de la demande et résolution du lieu | Partiel | 50/50 lues correctement hors ligne. En ligne corrigés : plein air → lieu naturel (Chartreuse massif, Loire fleuve, Calanques parc), pays entier (États-Unis Ouest), « nuits dehors » inventées par l'IA. Reste : vérifier Jura/Calanques après la limite de fréquence |
| P0.3 | Itinéraire déterministe | Partiel | Lieux réels (Photon → Overpass + Geoapify), hauteurs pour marche et ski (relief zoom 10 sur grande zone), départ d'une ville dite, journée dans un massif → village. Reste : traversées longues (Alpes 20 j : bus au milieu, l'IA décide), tour de région à vélo (Bretagne), échelle d'un pays (l'IA nomme, la carte vérifie) |
| P0.4 | Dates et trajets | Partiel | Route plafonnée selon la durée (week-end ≤ 450 km, sinon avion). Reste : train, choix d'aéroport |
| P0.5 | Budget et conseils | Partiel | Kit d'une sortie de quelques heures allégé ; le budget ne compte que le matériel indispensable. Reste : conseils IA parfois faux (passeport Portugal), niveaux de prix tous pays |
| P0.6 | Fallbacks propres | Partiel | Geoapify actif (clé sur Vercel) ; la note d'un repli dit ce que chaque carte a répondu ; limite de fréquence affichée comme une attente. Reste : résultat complet garanti |
| P0.7 | IA production : NVIDIA NIM direct (Nemotron 3.5 Lightning) | Fait | Décision de Tony (7 oct., soir) : on reste sur NVIDIA ; le passage OpenRouter est annulé |
| — | Contexte du voyage unique (`buildTripContext`) | **Fait** | `engine/tripContext.ts`, testé |
| — | Fiabilité (prises atomiques, écritures vérifiées, annulation, arrondis) | **Fait** | Testé |
| — | Phrase de départ persistée | **Fait** | — |
| — | Écran « Où » = la demande + préparation visible | **Fait** (à valider en P2) | `CompasStart`, `CompasPrep` |

## P1 — Données

| # | Sujet | État |
|---|---|---|
| P1.1 | Référentiel géographique local : lieux habités, massifs / parcs, lieux importants, randonnées mondiales, refuges | Plan chiffré à présenter avant toute migration |
| P1.2 | Activités, POI, météo | Partiel (MET Norway, NASA POWER, POI Overpass) |

## P2 — Validation

| Jeu | Dernier résultat |
|---|---|
| 10 parcours de zone (7 octobre) | 9 sur lieux réels ; 2 défauts (Rome, Vosges), 3 partiels (Vercors, Jura, canoë) |
| 20 parcours réels | À rejouer après P0 |
| 50 demandes entièrement nouvelles | En ligne (7 oct.) : 47/50 prêtes au premier passage, 15 défauts corrigés à la racine pendant le test, 17 rejouées : toutes préparées (2 bloquées par la limite de fréquence, rejouées) |

## P3 — Après stabilisation (gelé)

Réservations réelles (Travelpayouts, RouteStack, Viator), équipe / social, bouteille à la mer,
hors ligne, affiliation, animations, polish de maquette et desktop. Accessibilité : close pour
l'instant.

## Décisions en vigueur

- IA production : **NVIDIA NIM direct** (décision de Tony du 7 octobre au soir, remplace le passage à OpenRouter).
- Cartes : services OSM gratuits + **Geoapify free tier** en secours (clé fournie, variable `GEOAPIFY_API_KEY` à poser sur Vercel) ; pas d'abonnement à 59 $ pour l'instant.
- Référentiel géographique : accord de principe ; **aucune migration avant le plan chiffré** (taille DB, volumes filtrés, mise à jour, espace final).
- Réservations : branchées après la stabilisation du moteur.

Détail : `AUDIT-2026-10-07.md` (architecture), `AUDIT-DONNEES-2026-10-07.md` (sources).
