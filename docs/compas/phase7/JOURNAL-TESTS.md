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

## 2026-11-26 — Passage local (conteneur de la session, ni aperçu ni production)

Plus de production ni d'aperçu (Tony, 26 nov. : « On a pas de prod que du local »). L'appli est construite depuis `main` (`d52a0064` ; `FAST_BUILD=1`, car `main` a 31 erreurs de types) et servie par `next start` dans le conteneur, sur la base Supabase partagée, avec les seules clés publiques. Conditions dégradées : IA éteinte ; pas de clé de service, donc référentiel des lieux et cache partagé en écriture indisponibles ; pas de Geoapify ni de LocationIQ. Photon a répondu 503 par moments, Overpass (private.coffee) a expiré plus de 100 fois. **Les itinéraires en pâtissent et ne sont pas notés ici ; la lecture de la phrase et la résolution de la destination n'en dépendent pas.** Le lanceur est adapté à l'écran v5 et crée une session d'essai anonyme ; les deux jeux tournent en parallèle, une session chacun. Notation : `score-run.mjs` contre `attendus.json` (pays, zone de l'ancre, durée). Les zones ont été resserrées ce jour pour FE05, MO11, MO17, MO18, MO24 et MO26, car le pays seul laissait passer ces écarts.

| Passage | Build | Phrases | Prêtes | Lieux justes | Avec la durée | Écarts (constats) |
|---|---|---|---|---|---|---|
| France/Europe | `main` (port 4028) | 50 | 50 | 49 (98 %) | 49 | FE05 « la Loire à vélo » → le département (C-028) |
| Monde | `main` (port 4028) | 50 | 49 | 44 (88 %) | 44 | MO04 création annulée par la base (C-027) ; MO11 Rocheuses, MO18 Cusco, MO24 Mendoza, MO26 Atacama loin de l'endroit visé (C-031) ; MO17 Basse-Svanétie (C-029) |
| Rejeux ciblés | corrigé (port 4029) | 10 (11 passages) | 10 | 10 | 10 | FE05, MO04, MO11, MO17, MO18, MO24, MO26, MO32 (C-025), MO35, MO41 (C-024 ; le 1er passage a révélé C-030, rejoué ensuite) |
| France/Europe, non-régression | corrigé (port 4029) | 50 | (en cours) | | | |
| Monde, non-régression | corrigé (port 4029) | 50 | (en cours) | | | |

Lecture hors ligne des 100 phrases (`parseIntentRules`, avant correction) : 99 durées justes (n°32 en chinois : C-025) et un lieu mal découpé (n°41 « Cape Town solo » : C-024).

Écarts vus mais non corrigés : sans IA, un sentier nommé (Kungsleden, Laugavegur, West Highland Way) se ramène au pays quand la phrase dit le pays (comportement prévu, annoncé). Les Alpes en ski donnent l'Italie, les Pyrénées et le Pays basque l'Espagne (C-006, décidé). C-026 : une ancre instable quand Photon refuse, à surveiller.
