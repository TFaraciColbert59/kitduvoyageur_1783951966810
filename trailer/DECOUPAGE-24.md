# Découpage à 24 i/s — émotion, musique, plans (v5, 14/11/2026)

Demande de Tony après écoute de la musique v3 : « le son doit commencer dès le début et au bon moment de la musique, faut que ça corresponde et que ça suive avec les émotions à ressentir. Je te demande de devenir humain et de comprendre quelle partie de la musique doit être à quel moment pour quelle image. »

Ce document remplace le minutage de `TRAME-60s.md` (60 i/s, calé sur le montage musical v1). L'histoire, les plans et les règles créatives de la trame restent valables.

## Ce qui n'allait pas

- **Musique v1/v2** : le premier drop tombait à 5,4 s sur Léa qui rêve à sa fenêtre un soir de pluie. Le moment le plus fort de la musique sur le moment le plus intime du film.
- **Musique v3** : rien d'audible avant 1,2 s ; le drop 1 sur des gestes au téléphone ; la respiration du morceau sur les grands plans de montagne ; le drop principal sur le bivouac de nuit.

## Le principe

Le morceau raconte déjà ce que raconte le film : une intro suspendue, une longue montée, une explosion, une reprise, une fin apaisée. On pose chaque partie du morceau sur le moment du film qui a la même émotion, et on coupe le reste.

**Le drop est pour la montagne.** Tout ce qui précède (la fenêtre, l'application, les amis, le sac, le train) est une montée : on attend, on prépare, on retient son souffle. Le drop tombe à l'instant où le drone découvre la crête de Seceda et quatre silhouettes minuscules.

## Grille

136,997 BPM. Un temps = 0,43797 s = 10,51 images. Une mesure = 1,75186 s = 42,04 images. La mesure 1 commence à l'image 0. 33 mesures, puis l'impact et sa queue. Les coupes tombent sur un temps ; les valeurs exactes (image entière la plus proche) viendront de `qa/mix-v4.beats.json`.

## Le film, section par section

| Mesures | Temps (s) | Images | Section | Ce qu'on doit ressentir | Partie du morceau |
|---|---|---|---|---|---|
| 1–3 | 0–5,26 | 0–126 | **Cosmos** : nébuleuse, création du système solaire, Terre, plongée jusqu'à la fenêtre | Émerveillement, vertige | L'intro, audible dès la première image ; une note franche sur l'allumage du Soleil |
| 4–7 | 5,26–12,26 | 126–294 | **Déclic** : Léa à sa fenêtre, le carnet d'un autre, son œil, le lac | Intimité, manque, puis l'étincelle | Le début de la montée, encore dépouillé |
| 8–11 | 12,26–19,27 | 294–463 | **Décision** : elle se lève, prépare, ses amis disent oui, elle commande, le colis, le sac | L'excitation qui monte | La fin de la montée, de plus en plus chargée |
| 12–14 | 19,27–24,53 | 463–589 | **Départ** : la boucle, l'escalier, le train, les retrouvailles, les premiers pas | L'élan, on retient son souffle | Les trois dernières mesures de la montée, avec le crescendo |
| 15–19 | 24,53–33,29 | 589–799 | **Montagne** : Seceda, Tre Cime, la main tendue, Sorapis | Le souffle coupé, la joie | **Drop 1** |
| 20–26 | 33,29–45,55 | 799–1093 | **Coureur puis cycliste** | Adrénaline, puis liberté | **Drop 2**, un cran au-dessus |
| 27–30 | 45,55–52,56 | 1093–1261 | **Bivouac** : la nuit tombe, les rires, elle publie, la Voie lactée | Chaleur, apaisement, tendresse | L'outro, suite naturelle du drop 2 |
| 31–33 | 52,56–57,81 | 1261–1387 | **Final** : Noah dans le bus, la remontée, les tracés | L'espoir, le cycle recommence | La reprise, avec le roulement |
| impact | 57,81–60,00 | 1387–1440 | **Logo** | La signature | Un vrai coup, puis la queue |

## Répartition des plans (en temps de musique)

Durées de départ, à ajuster après relecture des vidéos (on garde les meilleures secondes de chaque prise) sans déplacer les frontières de section.

| Section | Plans et durées en temps (1 temps = 0,44 s) | Total |
|---|---|---|
| Cosmos | ouverture en code (nébuleuse → Terre → plongée → nuage → ville → fenêtre) | 12 |
| Déclic | P06 : 6 · P07 : 4 · P08 : 1 · P09 : 1 · **P10 : 4** (le lac, sur le premier temps de la mesure 7) | 16 |
| Décision | P11 : 2 · P12 : 2 · P13 : 2 · P14 : 2 · P15 : 1 · P16 : 3 · P17 : 1 · P18 : 2 · P19 : 1 | 16 |
| Départ | **P20 : 1** (le clac, sur le premier temps de la mesure 12) · P21 : 2 · P22 : 2 · P23 : 4 · P24 : 2 · P25 : 1 | 12 |
| Montagne | **P26 : 4** (le drop) · P27 : 4 · P28 : 2 · P29 : 2 · P30 : 4 · P31 : 2 · P32 : 2 | 20 |
| Coureur | P33 : 2 · P34 : 1 · P35 : 2 · P36 : 1 · P37 : 2 · P38 : 4 · P39 : 2 | 14 |
| Cycliste | P40 : 3 · P41 : 1 · P42 : 3 · P43 : 3 · P44 : 2 · P45 : 2 | 14 |
| Bivouac | P46 : 3 · P47 : 5 · P48 : 3 · P49 : 1 · P50 : 4 | 16 |
| Final | P51 : 3 · P52 : 4 · P53 : 5 | 12 |
| Logo | P54, de l'impact à 60,000 s | — |

Total : 132 temps = 33 mesures.

Les plans les plus longs : P06 (2,6 s, Léa à sa fenêtre), P47 (2,2 s, les rires au feu). Les impacts sur un seul temps : P08 (l'œil), P09 et P17 (le pouce), P20 (la boucle), P34 (le pied sur la pierre), P36 (le brassard), P41 (la roue), P49 (elle publie).

## Ouverture

À recaler sur la musique v4 : le son existe dès l'image 0, l'allumage du Soleil tombe sur la note que le sound-designer aura placée entre les images 24 et 40, la Terre arrive dans la seconde qui suit, et la plongée se termine sur la fenêtre de Léa à l'image 126 (premier temps de la mesure 4). La deuxième passe de `ouverture-lab` plonge vers les Dolomites : il faudra la faire arriver sur la ville (images img03–img05) pour raccorder avec P06.

## Sons ajoutés à la musique

Trois seulement, en piste séparée, tant que les coupes ne sont pas figées : un souffle grave de l'image 0 à l'allumage du Soleil, un impact sur l'allumage, un impact avec longue queue sous le coup du logo. Les autres effets (clac de la boucle, pas, eau, whooshes de raccord) viendront une fois le montage image validé.
