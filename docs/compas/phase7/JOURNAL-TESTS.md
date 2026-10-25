# Journal des tests du Compas

Boucle : **test → constat → cause → correction → rejeu**. Chaque passage est ajouté ici avec sa date ; les constats ouverts vont dans `CONSTATS.md`.


## 2026-10-18 20:25 UTC

### Passage 0 — « 5 jours dans les Alpes faire des randonnées » (aperçu 6p4jp5ff0)

1 demande(s) : **1 prêtes**, 0 interrompues, 0 en erreur. Durée médiane 26 s, p90 26 s, max 26 s.

| # | État | s | Demande | Synthèse / erreur |
|---|------|---|---------|-------------------|
| 1 | prête | 26 | 5 jours dans les Alpes faire des randonnées | Budget 388 € · 4 hébergements · 111 km de route (depuis ta position) · 14 objets au kit |

## 2026-10-18 20:19 → 2026-10-19 05:27 UTC — Passage 1 (jeu France/Europe, lu en base le 19 oct.)

Source : `public.trips` et `public.ops_preparation_events` (Supabase), pas le journal du lanceur (perdu avec la session). 47 préparations `ok`, **0 échec** ; 47 voyages créés (dont 17 reprises « Randonnée · Vercors » du banc de fumée). Phrases du jeu couvertes : environ 33 sur 50 ; le jeu monde n'a pas démarré.

Défauts vus en lisant les voyages contre les phrases : C-001 (groupe « avec … »), C-002 (saison), C-003 (lieu belge pour les Highlands), C-006 (pays des massifs transfrontaliers). Corrigés dans le code (C-001 à C-003) ; rejeu au passage 2.

## 2026-10-19 17:13 → 2026-10-20 05:00 UTC — Passages 2 à 4 (rejeux et jeu monde)

Source de vérité : `public.trips` (Supabase), lu après chaque passage ; le journal du lanceur ne dit que « prête » ou « interrompue ».

| Passage | Aperçu (commit) | Phrases | Prêtes | Voyages justes | Constats |
|---|---|---|---|---|---|
| 2 (rejeu) | `9gsrib57l` (`950684aa`) | 25 | 24 | 24 | C-001, C-002, C-003 fermés ; C-008 (Gran Paradiso) ouvert |
| Monde, 1er jeu | `9gsrib57l` | 50 | 39 sur 50 (arrêté à 39 pour lecture) | 29 | C-014, C-015, C-016 ouverts |
| 3 (rejeu) | `ebhp01ix7` (`96f8ae1c`) | 13 | 13 | 13 | C-008, C-010, C-011, C-013, C-014 fermés |
| France/Europe, jeu complet | `o3g9gcxvb` (`5780b139`) | 50 | 48 | 44 | C-017 (Photon limité), C-011 rouvert |
| Monde, jeu complet | `dh0vocelu` (`66033a9a`) | 50 | 45 | 39 (environ 78 %) | C-019 |
| 4 (rejeu monde) | `ajnbdom0w` (`5fbd27a6`) | 11 | 11 | 9 | C-020 (Machu Picchu, chinois) |

« Voyages justes » : lieu, pays et durée conformes à la phrase, lus en base (ancre, `destination_country_code`, dates). Une préparation « prête » sans lieu ou au mauvais endroit ne compte pas.

Mesure finale (sur le dernier aperçu) : voir l'entrée suivante.

## 2026-10-20 — Jeux définitifs et passage 5

| Passage | Aperçu (commit) | Phrases | Prêtes | Lieux justes (lus en base) | Reste |
|---|---|---|---|---|---|
| Monde définitif | `9cs3qiyjb` (`239a0fb4`) | 50 | 50 | 48 sur 50, 47 avec la durée | Machu Picchu (cache de repli), « 东京三天自由行 » sans lieu, « 5 дней » lu 3 jours |
| France/Europe définitif | `9cs3qiyjb` | 50 | 50 | 48 sur 50 | « Naples » (France) et « Strasbourg et Colmar » (une rue), cache de repli |
| 5 (rejeu ciblé) | `ndfe1ja5o` (`97bdf227`) | 5 | 5 | 4 sur 5 | Machu Picchu, Naples, Strasbourg, Lofoten corrigés ; Tatras en Slovaquie (C-012) |

Quatre lieux sont justes mais leur pays est discutable (massifs transfrontaliers : Pyrénées, Alpes en ski, Pays basque, Tatras) : C-006 et C-012, décision de produit.

Mesure sur le dernier aperçu : monde 48 sur 50 (96 %), France/Europe 50 sur 50 après le passage 5 pour les deux phrases rejouées ; pas de passage complet unique sur le dernier build. Durée : médiane 30 s, p90 42 s, max 47 s (France/Europe).


## 2026-10-21 — Jeux « def2 » (aperçu `7njuahwqp`, build `7db6bdc1`)

| Passage | Phrases | Prêtes | Lieux justes (lus en base) | Reste |
|---|---|---|---|---|
| Monde def2 | 50 | 50 | 49 sur 50 (98 %) | « Himalaya indien Ladakh » rangé sur un hôtel (« I T Himalaya ») |
| France/Europe def2 | 50 | 50 | 46 sur 50 (92 %) | Lofoten (un chantier naval), Highlands écossais (une rivière du Québec), Sierra Nevada (États-Unis malgré « en Espagne »), « Naples et Pompéi » (un quartier de Pompéi) ; Tatras réduit à « Pologne » |

Cause commune (constat **C-023**) : le remplissage (`autofillActions`) relisait `destination_name` avec `lookupDestination` seul, sans la résolution de « Où » (pays dit, régions célèbres, référentiel). Corrigé au commit `c8946c18` : même `resolvePlaceByName` ; table fermée étendue (Highlands, Ladakh). Rejeu à faire sur un aperçu portant `c8946c18` ou plus récent.

Banc d'écran def2 : 234 / 303 contrôles vérifiés (77,2 %), 5 scénarios en échec (Équipe : une personne de plus/de moins ; « Quand » : note du calendrier ; « Tout préparer pour moi » ; deux délais de création d'aventure à 90 s). Les trois premiers sont des attentes dépendantes de la météo ou de la charge ; rejoués sur l'aperçu `q0yaqrgb4` (`8140d409`) : résultat dans l'entrée suivante.
