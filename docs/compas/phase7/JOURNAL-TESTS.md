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
