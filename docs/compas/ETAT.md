# Préparateur `/compas` — état (source de vérité unique)

> Une seule ligne droite : demande libre → compréhension → lieu → itinéraire → données →
> kit / budget / conseils → résultat final. Rien de P3 tant que P0/P1 ne passent pas P2.
> « Fait » = prouvé de bout en bout sur la preview et contrôlé en base, pas « le code compile ».

Mis à jour : 7 octobre 2026.

## P0 — Moteur fiable

| # | Sujet | État | Preuve / reste |
|---|---|---|---|
| P0.1 | Préparation en une seule passe (300 s) | **En cours** | Avant : deux appels de 60 s, coupures |
| P0.2 | Compréhension de la demande et résolution du lieu | Partiel | Homonymes (Mont Rose) et « Pyrénées catalanes » corrigés et vérifiés ; reste : massif ou département selon l'activité (Vosges), sorties sans lieu, demandes floues (« activité cet après-midi ») |
| P0.3 | Itinéraire déterministe | Partiel | Lieux réels (Photon), traversée / boucle / base, zone ajustée ; vérifié Vercors, Annecy, Bretagne, Pyrénées catalanes, Mont Rose. Reste : régression ville sans activité (Rome), descente de rivière (canoë), plaine au lieu du massif, échelle d'un pays |
| P0.4 | Dates et trajets | Partiel | Période proposée, route mesurée ou vol estimé ; à revérifier sur P2 |
| P0.5 | Budget et conseils | Partiel | Barèmes par pays dans le code ; reste : niveau de prix tous pays, visas tous pays, conseils par règles |
| P0.6 | Fallbacks propres | Partiel | Raison d'un repli écrite dans les notes ; reste : résultat complet garanti, secours Geoapify |
| P0.7 | IA production : OpenRouter + Nemotron 3.5 Lightning | À faire | Aujourd'hui NVIDIA NIM direct (offre d'évaluation) |
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
| 50 demandes entièrement nouvelles | À faire |

## P3 — Après stabilisation (gelé)

Réservations réelles (Travelpayouts, RouteStack, Viator), équipe / social, bouteille à la mer,
hors ligne, affiliation, animations, polish de maquette et desktop. Accessibilité : close pour
l'instant.

## Décisions en vigueur

- IA production : **OpenRouter + Nemotron 3.5 Lightning (payant)**. L'ancienne décision « NVIDIA direct sans OpenRouter » est abandonnée.
- Cartes : services OSM gratuits + **Geoapify free tier** en secours ; pas d'abonnement à 59 $ pour l'instant.
- Référentiel géographique : accord de principe ; **aucune migration avant le plan chiffré** (taille DB, volumes filtrés, mise à jour, espace final).
- Réservations : branchées après la stabilisation du moteur.

Détail : `AUDIT-2026-10-07.md` (architecture), `AUDIT-DONNEES-2026-10-07.md` (sources).
