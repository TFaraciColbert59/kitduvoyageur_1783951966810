# Découpage à 24 i/s — émotion, musique, plans

> **La version en vigueur est la v6, en bas de ce document (15/11/2026).** Elle remplace la répartition des plans et les frontières de section de la v5 ci-dessous, après les retours de Tony sur le film complet. Le principe (la musique suit les émotions, le drop est pour la montagne) ne change pas.

## v5 (14/11/2026)

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

---

# v6 (15/11/2026) — après les retours de Tony sur le film complet

## Ce que Tony a dit (mot pour mot)

« la musique est trés mal découpé et monté, c'est pas fluide, doux epic typiquement lors du passage par dessus le lac ou quand on les voix en haut des dolomite de loin avec le panorama immense. trop de repetition aussi, fait un prompt ultra complet pour généré la nebuleuse avec google la création du systeme solaire et de la etrre de mannière beaucoup plus fluide epic cinematique impressionnat coloré lumineux nette réaliste. au debut sur son telephone avant de passer en drone par dessus le lac on voit pas quelle regarde ce post, il faut réglé ça et on doit plonger dedans comme on a plonger au debut en sortant des nuage on est transporté dans l'image. on doit avoir une scéne de 1-2 second par amis au debut au lieu des 3 d'un coup tous dans des situation différentes au moment ou ils disent oui. il y'a des son parasite des scene qui se balade. elle recoit le sac dans un beau packaging moderne avec différents modules etc et la petit coup de motion design avec le sac qui s'assemble en 3D genre vue de composer active et dynamique on voix les modules si accrocher et les elements de l'inventaire s'y mettre de dedans. »

## Ce que ça change

1. **Musique** : le montage v4 est refusé (pas fluide, pas « doux épique » sur le lac ni sur le panorama des Dolomites, trop de répétitions). À refaire avec très peu de raccords, de longs passages continus du morceau, aucune matière utilisée deux fois. Tony choisit à l'oreille entre plusieurs montages.
2. **Sons parasites** : les effets sonores v5 (ambiances synthétiques) sont retirés. Musique seule, plus au maximum quelques accents si Tony les valide.
3. **Ouverture** : générée par Tony dans Flow (prompt dans `flow/TOURNAGE-3.md`), à la place de l'ouverture en code si elle est meilleure.
4. **Le téléphone avant le lac** : on doit voir que Léa regarde la photo du lac (grande sur l'écran), puis **plonger dans l'écran** : la photo remplit le cadre et devient le survol. Même sensation que la plongée de l'ouverture.
5. **Les trois amis** : un plan par ami (Sami, Inès, Tom), 1 à 2 s chacun, dans trois situations différentes, au lieu du triptyque.
6. **Le colis** : un beau packaging moderne, le sac et ses modules ; puis un moment de motion design où **le sac s'assemble en 3D** (les vrais modèles `.glb` du Kit Studio : les modules s'accrochent, les objets de l'inventaire entrent dedans).

## Nouvelle structure

Même grille (136,997 BPM, mesure = 1,75186 s = 42,04 images, 33 mesures puis le logo). La préparation gagne deux mesures : **le drop passe de 24,5 s à 28,0 s**. Elles sont reprises au coureur et à la cycliste (une mesure) et au bivouac (une mesure).

| Mesures | Temps (s) | Section | Ce qu'on doit ressentir | Musique voulue |
|---|---|---|---|---|
| 1–3 | 0–5,26 | **Cosmos** : nébuleuse, création, Terre, plongée jusqu'à la fenêtre | Émerveillement, vertige | Le début du morceau, présent dès la première image |
| 4–7 | 5,26–12,26 | **Déclic** : Léa à sa fenêtre, la photo du lac sur son téléphone, on plonge dedans, le lac | Intimité, puis on est emporté | Doux, ample, qui s'ouvre sur le lac |
| 8–13 | 12,26–22,77 | **Décision** : elle se lève, prépare, chaque ami dit oui, le kit, le colis, le sac s'assemble | L'excitation qui monte | La montée, en continu |
| 14–16 | 22,77–28,03 | **Départ** : la boucle, l'escalier, le train, les retrouvailles, les premiers pas | L'élan | La fin de la montée, sans raccord jusqu'au drop |
| 17–21 | 28,03–36,79 | **Montagne** : Seceda, la main tendue, Tre Cime, Sorapis | Le souffle coupé : **ample, épique, pas agressif** | Le grand moment du morceau |
| 22–27 | 36,79–47,30 | **Coureur puis cycliste** | Adrénaline, liberté | L'énergie pleine |
| 28–30 | 47,30–52,56 | **Bivouac** | Chaleur, tendresse | L'apaisement |
| 31–33 | 52,56–57,81 | **Final** : Noah, la remontée, les tracés | L'espoir | Une montée qui n'a pas déjà servi |
| impact | 57,81–60,00 | **Logo** | La signature | Un coup, puis sa queue |

## Répartition des plans (en temps de musique)

| Section | Plans et durées (1 temps = 0,44 s) | Total |
|---|---|---|
| Cosmos | ouverture (générée ou en code), jusqu'à la fenêtre | 12 |
| Déclic | P06 : 5 · P07 : 4 (elle défile, s'arrête sur le post, la photo du lac s'ouvre en grand) · P08 : 1 (l'œil) · **P09 : 2 (on plonge dans l'écran)** · P10 : 4 (le lac) | 16 |
| Décision | P11 : 2 · P12 : 2 · P13 : 2 · **Sami : 3 · Inès : 3 · Tom : 3** · P16 : 2 · P17 : 1 · **P18 : 3 (le colis)** · **le sac s'assemble en 3D : 3** | 24 |
| Départ | P20 : 1 · P21 : 2 · P22 : 2 · P23 : 4 · P24 : 2 · P25 : 1 | 12 |
| Montagne | P26 : 4 (le drop) · P28 : 2 · P27 : 4 · P29 : 2 · P30 : 4 · P31 : 2 · P32 : 2 | 20 |
| Coureur | P33 : 2 · P34 : 1 · P35 : 2 · P37 : 2 · P38 : 4 · P39 : 2 | 13 |
| Cycliste | P40 : 3 · P42 : 3 · P43 : 3 · P44 : 2 | 11 |
| Bivouac | P46 : 2 · P47 : 4 · P48 : 3 (elle publie dans ce plan) · P50 : 3 | 12 |
| Final | P51 : 3 · P52 : 4 · P53 : 5 | 12 |
| Logo | P54, de l'impact à 60,000 s | — |

Total : 132 temps = 33 mesures. Plans retirés par rapport à la v5 : P14 (le triptyque, remplacé par trois plans), P15, P19 (remplacé par l'assemblage 3D), P36, P41, P45, P49 (fondu dans P48).

Images de coupe des sections (temps × 10,511 images) : déclic 126 · décision 294 · départ 547 · **drop 673** · coureur 883 · bivouac 1135 · final 1261 · logo 1387. Les valeurs exactes viendront du fichier de temps de la nouvelle musique.

## Ce qui est repris de la relecture critique (`qa/REVIEW-V6.md`)

- Les plans du drop (P26, P27, P30) bougent trop peu : plages plus longues accélérées et poussée plus franche, et nouvelles prises demandées à Tony (`flow/REPRISES-2.md`).
- La remontée finale (P52) est refaite de nuit, en un seul mouvement, depuis la vitre du bus.
- P37 sans dédoublement, P44 sur une plage plus vivante.
- La nébuleuse reste pleine de couleurs : c'est la demande de Tony.
