# Trailer LKDV 60 s — Conventions communes des agents

Contrat partagé par tous les agents du chantier. La référence créative reste `TRAME-60s.md` (v4.1). En cas de conflit entre ce fichier et un brief, le brief gagne ; entre ce fichier et la trame, la trame gagne.

## Temps

- 60 i/s, 3 600 images, 1920×1080. Les **images** de la trame font foi ; une seconde vaut `image / 60` (ne jamais repartir des secondes arrondies du tableau).
- Plans nommés `p01` … `p54` (minuscules dans les fichiers et les identifiants, `P01` dans les textes).
- Aucune coupe ne bouge sans accord de l'orchestrateur. Aucun plan de plus de 120 images.
- Repères : drop 1 image 325 (5,41 s) · drop 2 image 2009 (33,48 s) · outro image 2848 (47,47 s) · montée image 3060 (51,00 s) · impact final image 3480 (58,00 s).

## Arborescence et propriété des fichiers

Chaque agent n'écrit que dans son périmètre. Lire ailleurs est libre.

| Dossier | Contenu | Propriétaire |
|---|---|---|
| `film/` | LE projet HyperFrames maître 16:9 : `index.html`, `shots.json` (source unique du minutage), `compositions/pNN.html` | squelette : `trailer-chore`, puis `landscape-director` |
| `film/lib/fx/`, `fx-lab/` | bibliothèque de transitions, scènes p52–p54, halo du logo ; `fx-lab/` est le projet d'essai, avec la même arborescence relative que `film/` | `cosmos-vfx` |
| `film/lib/phone/`, `phone-lab/`, `tools/phone/`, `tools/badge/`, `tools/capture/`, `assets/screens/`, `SCREENS.md` | incrustation des téléphones, écusson du sac, captures E1–E13 | `ui-builder` |
| `tools/audio/`, `assets/audio/` | montage musical, banque d'effets (`assets/audio/sfx/` + `SOURCES.md`), piste d'effets, mixage | `sound-designer` |
| `tools/timeline/` | génération du squelette, synchronisation des images | `trailer-chore` |
| `tools/reception/` | contrôle des images reçues | `trailer-chore` |
| `tools/grade/`, `grade-lab/`, `film/assets/luts/`, `film/crops.json` | LUT commune, recadrages 9:16 | `landscape-director` |
| `qa/` | rapports (`*.md`), preuves (`qa/snapshots/<chantier>/*.jpg`) | chacun dans son sous-dossier ; `qa-critic` pour les relectures |
| `assets/footage/` | images de Tony (`img01.png` …), jamais modifiées ni supprimées | Tony |

- Dans une composition, les chemins sont relatifs au projet : `assets/...`, `lib/...`, jamais de `/` initial ni de chemin qui sort du projet.
- Tous les identifiants d'une scène sont préfixés par son nom (`#p53-traces`), pour rester uniques une fois assemblés.
- Une scène testée dans un projet d'essai doit pouvoir être copiée telle quelle dans `film/` (mêmes chemins relatifs, même identifiant de scène que son hôte).

## Ce qui est versionné, ce qui ne l'est pas

- Jamais dans git : musique (`*.mp3`, `*.wav` du montage ou d'un mix), tout rendu qui contient la musique, vidéos de travail (`qa/*.mp4`), `.hyperframes/`, échantillons téléchargés pour essais (`grade-lab/samples/`), `.glb` HD.
- Versionnés : code, scripts, compositions, rapports, effets sonores **CC0 ou générés** (courts, avec leur provenance), captures de l'app, preuves en JPEG de moins de 400 Ko chacune.
- Aucun secret dans un fichier. Le jeton de l'aperçu Vercel se passe par la variable d'environnement `VERCEL_SHARE`, jamais écrit sur le disque.

## Couleurs

Forest `#17402C` · Sage `#5B7F55` · Stone `#FAF8F5` · encre `#0B1F17`. Interdits : `#E4501C`, `#1C2620`, noir pur en aplat. Les plans au sol gardent leurs couleurs réelles.

## Règles de l'image

- Aucun texte hors des écrans de téléphone (les cartes provisoires du squelette sont un outil de travail, elles disparaissent avec les images). Aucun HUD flottant. Logo net uniquement de 58 à 60 s.
- Tout ce qui se voit est une fonction du temps : aléatoire à graine, pas d'horloge, pas de réseau à l'exécution.

## Machine partagée

- 4 cœurs pour tous les agents en même temps : rendus avec `--workers 2`, qualité `draft` pour le travail, pas de rendu complet inutile.
- Ne tue pas un processus que tu n'as pas lancé. Ne lance pas `hyperframes clean`. Ne supprime jamais un dossier `.hyperframes`.
- Chromium et Playwright sont préinstallés : jamais de `playwright install`.

## Git

- Les agents **ne commitent pas et ne poussent pas** : l'orchestrateur le fait, après les portes.
- Pas de `git stash`, pas de `git checkout` d'un autre état, pas de `git clean`. Regex écrites avec l'outil Edit.

## Portes avant de rendre la main

`npx hyperframes lint` puis `npx hyperframes check --json` (0 erreur ; `validate` est un alias déprécié de `check`), puis des snapshots **regardés**. Les scripts ont un test ou une preuve d'exécution. Les chiffres rapportés viennent d'une commande lancée, avec sa sortie.

## Compte rendu

En français, 25 lignes au plus : fichiers créés ou modifiés, commandes de contrôle et leur résultat, chemins des preuves, ce qui est faible, non vérifié ou reporté, dit franchement.
