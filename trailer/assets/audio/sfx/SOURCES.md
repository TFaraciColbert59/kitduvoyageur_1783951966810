# Banque d'effets du trailer : provenance et licences

31 fichiers WAV, 48 kHz, 24 bits, mono, crête échantillon à −3,0 dBFS (mesurée avec `volumedetect`, FFmpeg 6.1.1), 7 à 450 Ko chacun, 5,6 Mo en tout. **Uniquement du CC0 ou des sons générés.** Tous ont été mesurés, aucun n'a été écouté.

## Prises réelles CC0 : Kenney (4 fichiers)

Source : les dépôts officiels de Kenney sur GitHub. Le README de chaque dépôt dit : « Assets included in this package (2D sprites, 3D models and sound effects) are CC0 licensed » (https://creativecommons.org/publicdomain/zero/1.0/). Le code de ces dépôts est sous licence MIT, mais les sons sont CC0. Licence lue dans le README de chaque dépôt cloné le 2026-11-11. kenney.nl n'était pas joignable depuis la session (le proxy refuse l'accès), la licence n'a donc pas pu être recoupée sur ce site.

Import : `node tools/audio/import-cc0.mjs <dossier des clones>` (rognage, mono, 48 kHz, crête à −3 dBFS en deux passes ; la commande FFmpeg exacte est affichée à chaque fichier).

| Fichier | Dépôt @ commit | Fichier source | Rognage | Auteur | Licence |
|---|---|---|---|---|---|
| `pas-sentier-a.wav` | https://github.com/KenneyNL/Starter-Kit-FPS @ 185fd2326d74 | `sounds/walking.ogg` | 2,40 s + 0,80 s (deux pas) | Kenney | CC0 1.0 |
| `pas-sentier-b.wav` | idem | `sounds/walking.ogg` | 3,60 s + 0,80 s | Kenney | CC0 1.0 |
| `clac-boucle-a.wav` | idem | `sounds/weapon_change.ogg` | 0,24 s + 0,18 s (le dernier clac seul) | Kenney | CC0 1.0 |
| `pied-pierre.wav` | https://github.com/KenneyNL/Starter-Kit-3D-Platformer @ 3fa8a04b1c01 | `sounds/land.ogg` | 0 + 0,06 s | Kenney | CC0 1.0 |

Le `weapon_change.ogg` d'origine semble atteindre 0 dBFS : sa première passe de normalisation a dû être corrigée. Ce son est peut-être écrêté à la source, il faut l'écouter.

## Sons générés (27 fichiers)

Ils sont faits par synthèse de bruit filtré (rose, blanc ou brun, filtres à variables d'état, enveloppes), avec une graine fixe : deux exécutions donnent des fichiers identiques. Tony a explicitement autorisé cette méthode. Aucun droit de tiers. La recette de chaque son est écrite dans `tools/audio/gen-sfx.mjs` (objet `RECIPES`, avec ses paramètres et sa graine). La commande exacte est `node tools/audio/gen-sfx.mjs <nom>`, ou la même commande sans argument pour tout régénérer. Outils : `tools/audio/synth.mjs`, Node 22, FFmpeg 6.1.1 pour l'écriture du WAV.

| Fichier(s) | Recette (graine) |
|---|---|
| `whoosh-court-a/b/c.wav` | bruit rose en passe-bande balayé (400→2 600, 2 800→500, 700→4 200 Hz) + souffle aigu, enveloppe en cloche (11, 12, 13) |
| `whoosh-long-a/b.wav` | idem, 1,5 et 1,9 s (180→3 200, 4 200→260 Hz) (21, 22) |
| `impact-sourd-a/b.wav` | sinus qui plonge (120→38 Hz) + bruit brun en passe-bas, décroissance exponentielle (31, 32) |
| `impact-sec-a/b.wav` | claquement de bruit en passe-haut + corps à 190 ou 240 Hz (41, 42) |
| `crash-a/b.wav` | bruit en passe-haut à longue traîne, pour masquer les raccords (51, 52) |
| `clac-boucle-b.wav` | deux transitoires plastiques à 11 ms d'écart (61), variante du clac réel |
| `sonnette.wav` | « ding-dong » : deux notes (mi 5, do 5) à partiels de cloche (71). C'est un son tonal synthétisé, à remplacer de préférence par une vraie prise CC0 |
| `souffle-a/b.wav` | bruit rose en passe-bande doux, enveloppe de respiration (81, 82) |
| `vent-altitude-a/b.wav` | bruit rose en passe-bande modulé (rafales) + grondement brun, 3,2 s (91, 92) |
| `feu-crepitement.wav` | grondement brun + craquements résonants aléatoires, 2,6 s (101) |
| `pluie-vitre.wav` | gouttes très brèves et denses + chuintement en passe-haut, 2,4 s (111) |
| `rails-train.wav` | grondement + paires de chocs de bogie toutes les 0,62 s, 2,2 s (121) |
| `gravillons-a/b.wav` | grains denses en passe-haut, en nuage (131, 132) |
| `declic-photo.wav` | deux clics de volet à 70 ms d'écart (141) |
| `notification.wav` | deux tics brefs, sans mélodie (151) ; non placé dans la piste |
| `eclaboussure-torrent.wav` | gerbe de bruit en passe-bande + gouttes qui retombent (161) |
| `montee-riser.wav` | passe-bande et niveau qui montent pendant 2,9 s, pic à la fin (171) |
| `impact-final.wav` | sous-grave long (95→30 Hz) + crash, 2,6 s (181) |

## Sources examinées et écartées

| Source | Motif |
|---|---|
| Effets livrés avec le skill media-use (`audio/assets/sfx/`) | Pixabay Content License (son `CREDITS.md`) : licence libre, mais pas CC0. Rien n'a été copié |
| Meta Open Sound, Oculus Audio Pack (github.com/facebookincubator/Meta-open-sound) | CC BY 4.0 (`corpora/oculus-audio-pack/LICENSE`) : il exige un crédit, ce qui est hors du brief. Seuls les instruments de ce dépôt sont CC0, et ils sont inutiles ici |
| Freesound, OpenGameArt, Wikimedia Commons, kenney.nl, Openverse | Le proxy de la session refuse l'accès (CONNECT 403) le 2026-11-11 |

## Musique

STORM II (GENER8ION) est un **titre commercial**. Il n'est pas versionné et n'est jamais téléchargé par les agents. **Il faut une licence de synchronisation avant toute diffusion publique du trailer ; elle reste à vérifier.**
