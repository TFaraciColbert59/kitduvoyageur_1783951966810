# Ouverture « nébuleuse → système solaire → Terre → ville → fenêtre de Léa » — cosmos-vfx

14/11/2026, **troisième passe**. C'est la section « cosmos » du film, dans le projet d'essai autonome `trailer/ouverture-lab/` :
- 1920×1080, **24 i/s**, **126 images (5,25 s)** ;
- calée sur la musique **v4** (`qa/mix-v4.wav`) ;
- elle coupe sur P06 à l'image 126.

Rien n'est modifié dans `trailer/film/`, rien n'est commité par moi.

## Ce qui change dans cette passe

- **Son dès l'image 0** : la nébuleuse est pleine et en mouvement dès la première image. Le prélude ne dure que 0,83 s ; l'avancée de caméra y est plus rapide.
- **Le Soleil s'allume sur l'image 32**, l'attaque mesurée à 1,324 s.
- **On n'arrive plus dans les Dolomites mais sur la ville et la fenêtre de Léa** (trame P03–P05). Chaîne de plaques emboîtées, une seule caméra :
  1. **img01**, l'orbite ;
  2. **img03**, la stratosphère et la mer de nuages ;
  3. **img04**, le nuage qui se déchire sur la ville ;
  4. **img05**, les toits à l'heure bleue, avec la fenêtre éclairée au centre.

  La poussée part **dès T_TERRE** et accélère jusqu'à la vitre. La lumière chaude de la fenêtre envahit le cadre sur les 3 dernières images, pour couper sur Léa (P06, lampe chaude à droite).
- **Corrections de la passe 2** :
  - les nuages proches « boules » et la colonne blanche sont remplacés par des **nuages en coordonnées log-polaires autour du point de fuite** : lambeaux étirés dans le sens de la chute, nappe pleine pour la traversée, trouée qui s'ouvre sur la ville, brume des toits. Au point de fuite, la nappe est pleine : pas d'« étoile » de convergence ;
  - les couloirs de poussière ont des bords plus doux, modulés et fondus dans le gaz. Le premier plan absorbe vers le violet, plus vers le brun ;
  - la symétrie du prolongement en miroir de la plaque est cassée : au-delà du bord, l'échantillon est déformé par du bruit, avec un fondu sur 420 px ;
  - **aucun fondu enchaîné lisible entre plaques**. Chaque relais est caché :

    | Relais | Images | Caché par |
    |---|---|---|
    | img01 → img03 | ≈ 59–73 | voile d'entrée dans l'atmosphère et lambeaux qui filent |
    | img03 → img04 | ≈ 80–92 | traversée de nuage plein cadre, cœur à 84 |
    | img04 → img05 | ≈ 100–106 | flou de zoom (8 échantillons) et brume des toits |

## Calage musical (v4)

Repères lus dans `qa/MUSIQUE-V4.md` et `qa/mix-v4.beats.json` :
- son dès l'image 0 ;
- attaques de l'intro (champ `intro`), en images : **32**, 35, 58, **84**, **107**, **117**, 138 ;
- section `cosmos` = images 0–126 ; P06 commence à 126.

```js
window.LKDV_OUVERTURE = { T_CREATION: 20, T_SOLEIL: 32, T_TERRE: 44, T_NUAGES: 76, T_VILLE: 96, T_FENETRE: 126, DUREE: 126, FPS: 24 };
```

**Ce que j'ai calé ou déplacé, et où** :
- `T_SOLEIL = 32` tombe exactement sur l'attaque 32 : le pic de l'éclair est sur l'image 32.
- `T_CREATION 20`, `T_TERRE 44`, `T_NUAGES 76` et `T_VILLE 96` n'ont **aucune attaque à moins de 3 images** : je les laisse aux valeurs du brief. Les plus proches sont 58 (à 14 images de 44) et 84 (à 8 images de 76).
- J'ai mis les **trois changements d'état internes** de la descente **exactement sur les autres attaques**. Ce sont des fractions entre les repères CONFIG, donc ils suivent un recalage :

  | Changement d'état | Formule | Image (attaque) |
  |---|---|---|
  | Cœur de la traversée du nuage (`TCLOUD`) | `T_NUAGES + 0,4·(T_VILLE − T_NUAGES)` | **84** (3,502 s, 3e phrase) |
  | On passe sur les toits, img05 à l'échelle 1 (`T5`) | `T_VILLE + 0,367·(T_FENETRE − T_VILLE)` | **107** (4,442 s) |
  | La lueur de la fenêtre grandit (`TVITRE`) | `T_VILLE + 0,7·(T_FENETRE − T_VILLE)` | **117** (4,880 s) |

- Je ne cale rien sur 35 (trop près de 32) ni sur 58 (au milieu de la poussée vers la Terre).
- `DUREE` ↔ `data-duration` : passés à 5,25 s, vérifiés par `node tools/verifie-duree.mjs` et par le contrôle à l'exécution (un écart fait échouer `check`).

**Test de recalage** (fait, puis valeurs remises) : `24 / 35 / 50 / 84 / 104` (fin à 126), soit l'éclair sur l'attaque 35 et tout décalé. Les 126 images se rendent, le pic d'éclair passe sur 35 (0,611), rien ne casse (`planche-recalage-24-35-50-84-104.png`). Luminance de 0,187 à 0,636, au plus 6,6 % de pixels au-dessus de 0,9, aucun noir pur.

## Technique (ce qui s'ajoute)

- **Échelle d'img01** : `ln K` est interpolé de façon monotone (Fritsch–Carlson) par les repères T_TERRE → T_NUAGES → T_VILLE → T5 → T_FENETRE. K va de 1 à 1 944 ; la vitesse monte de 0,035 à environ 0,25 par image. L'agrandissement final est tel que la fenêtre (40×62 px dans img05) remplit le cadre.
- **Plaques emboîtées** : chacune est agrandie autour d'un point visé fixé au point de fuite :
  - img01 : les Alpes ;
  - img03 : un trou dans la mer de nuages ;
  - img04 : un îlot de toits ;
  - img05 : la fenêtre (959, 536).

  Rapports d'agrandissement : 3,2 × 3 × 4,5. Chaque plaque a un bord fondu de 240 px ; le ciel d'img03 est masqué pour ne pas apparaître dans la surface.
- **Mouvement** : roulis de 0 à 8° sur la Terre, puis jusqu'à 16° (vrille qui s'accélère). Le point visé glisse vers le centre : la chute devient verticale.
- **Fin** : lueur chaude autour de la fenêtre à partir de 107, puis éclat chaud sur 123–125 (mélange vers l'ambre, au plus 78 %).
- Déterminisme : inchangé (fonction pure du numéro d'image).
- `img01`, `img03`, `img04` et `img05` sont copiées dans `ouverture-lab/assets/footage/` (ignoré par git). Si une plaque manque, son relais est sauté (non regardé).

## Contrôles

- `npx hyperframes lint` : **0 erreur, 0 avertissement**.
- `npx hyperframes check --json` : **ok: true**. Lint, runtime, layout, motion, contrast et craft sont à 0/0 ; une info `audio_none` (voulue).
- `node tools/verifie-duree.mjs` : ok (126 images = 5,25 s partout).
- **Identité stricte** : 9 images (0, 10, 32, 44, 60, 84, 100, 120, 125) capturées deux fois dans deux sessions de navigateur sont identiques octet pour octet. Après le dernier correctif, 84, 100, 104, 120 et 125 ont été revérifiées : identiques.
- **Rendu de contrôle** (ffmpeg 6.0) : `ouverture-lab/renders/ouverture-v3.mp4`, h264 1920×1080, 24/1, **126 images, 5,250 s**, `blackdetect` sans aucune plage noire.
  - Y moyen par image : 124–132 sur le prélude ; **pic local 146 sur l'image 32** (98 à 31, 111 à 33) ; 58 au plus sombre (41).
  - La Terre monte régulièrement de 70 à 114. La traversée du nuage culmine à 144 (83–85). Creux de 69 sur la ville (102), puis montée vers la fenêtre jusqu'à 156 (125).
- **Avec musique** : `ouverture-lab/renders/ouverture-v3-musique.mp4`, la vidéo et les **5,256 premières secondes de `qa/mix-v4.wav`** (AAC 256 k).
  - `silencedetect` à −50 dB / 50 ms ne trouve aucun silence : le son est bien là dès l'image 0.
  - Le dossier `renders/` est ignoré par git (vérifié avec `git check-ignore`).

## Mesures (126 images, `qa/snapshots/ouverture/mesures.json`)

**Luminance moyenne.**
- Minimum : **0,197** (image 41, l'espace pendant la plongée).
- Pic de l'éclair : **image 32, 0,596** (31 : 0,378 ; 33 : 0,437), 6,4 % de pixels au-dessus de 0,9 — le maximum de tout le plan.
- Les seules images plus lumineuses en moyenne sont **l'éclat chaud final** : 124 à 0,597 et 125 à 0,641, avec **0 %** de pixels au-dessus de 0,9. C'est un ambre, jamais un blanc plein.
- La traversée du nuage culmine à 0,589 (84), avec 0 % au-dessus de 0,9.

**Noirs et couleurs.** Noir pur : **0 pixel**. `#E4501C` : 0. `#1C2620` : au plus 0,08 %.

**Mouvement image à image** (`mouvement.json`). Différence RVB moyenne (0–255) sur des réductions 480×270 ; le grain seul compte pour environ 1–2.

| Phase | Moyenne (min–max) | Écart première → dernière |
|---|---|---|
| Prélude 0–20 | 10,9 (9,0–13,6) | 39,3 |
| Création 20–44 | 25,7 (6,9–52,3) | 92,9 |
| Terre 44–76 | 10,3 (7,4–12,9) | 57,6 |
| Descente 76–125 | 10,6 (2,5–19,0) | 70,6 |

Le minimum de 2,5 tombe au cœur de la traversée du nuage, quand la nappe est pleine. Pour mémoire, la passe 2 sur l'ancien calage : prélude 10,2, Terre 9,9 ; et en passe 1 : 2,6 et 3,3.

## Preuves (`trailer/qa/snapshots/ouverture/`, non ignoré par git)

- Planches (numéro sous chaque vignette) :
  - `planche-creation.png` : images 18–46 ;
  - `planche-globale.png` : une image sur 4, 0–124 ;
  - `planche-prelude.png` : 0–20, une sur 2 ;
  - `planche-terre.png` : 44–76, une sur 2 ;
  - `planche-descente.png` : 76–124, une sur 2, plus 125 ;
  - `planche-recalage-24-35-50-84-104.png`.
- Pleine taille (JPEG) : `10-prelude.jpg`, `32-eclair-soleil.jpg`, `60-terre.jpg`, `84-traversee-nuage.jpg`, `100-ville.jpg`, `125-derniere-fenetre.jpg`.
- `mesures.json`, `mouvement.json`.
- Les planches PNG à palette font 0,35 à 0,77 Mo, donc au-dessus de la règle « JPEG < 400 Ko ». Le brief demande du PNG.

## Ce qui reste faible ou non vérifié — franchement

- **Rien n'a été regardé en mouvement ni écouté.** La lisibilité de la descente à 24 i/s (img04 → img05 en 6 images, vrille), l'éclair sur la note et l'éclat final contre la coupe sur P06 sont **à juger** dans `ouverture-v3-musique.mp4`.
- **La traversée du nuage (82–92)** est un tunnel radial assez graphique : il évoque le passage en vitesse lumière plus qu'un vrai nuage volumétrique. Sur la planche, les images 86–92 se ressemblent (le mouvement ne passe que par les lambeaux).
- **img04 → img05** : les deux photos n'ont pas le même angle (oblique / à la verticale). Le relais est noyé dans le flou de zoom et la brume, mais en arrêt sur image 100–106 c'est une bouillie bleue avec des points dorés. À 94–98, un peu du ciel bleu de jour d'img03 subsiste en haut de la trouée : le raccord de couleur jour → heure bleue est un peu brusque.
- **Plaques très agrandies** : img05 est agrandie jusqu'à ×45 (la vitre). À partir de 116, ce n'est plus que de la lumière floue — voulu pour l'éclat, mais sans aucun détail de vitre ni de pluie.
- **Image 125 et P06** : l'éclat est un ambre plat (0,64) avec l'ombre de la croisée. Je ne l'ai pas vu enchaîné avec la vidéo de P06 : le raccord de teinte avec la lampe de Léa est probable, pas vérifié.
- **Images 41–43** : 1 ou 2 images de Terre procédurale encore « dessinée », et un motif marbré dans le coin bas gauche à 43 (le miroir déformé).
- **Le test de recalage** a été capturé juste avant le dernier correctif (le centre de la nappe quand la trouée s'ouvre). Seules les images 84 à 125 du jeu par défaut ont été recapturées après ce correctif.
- **Déterminisme vérifié sur ce Mac seulement** (GPU Apple M2).

## À faire ensuite

1. Regarder et écouter `ouverture-lab/renders/ouverture-v3-musique.mp4`, puis le monter bout à bout avec P06.
2. Si c'est validé, intégrer dans `film/` :
   - copier la scène, `lib/ouverture/`, et `img01`, `img03`, `img04`, `img05` ;
   - la scène occupe 0–126, à la place de P01–P05.
3. Rendu final en qualité `delivery` une fois le montage figé.
