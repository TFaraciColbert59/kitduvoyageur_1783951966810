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

