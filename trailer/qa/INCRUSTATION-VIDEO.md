# INCRUSTATION-VIDEO — vraies captures de l'app dans les vidéos Flow (ours v3, 14/11)

Outils : `tools/incrustation/incruste.py` (suivi + incrustation), `tools/incrustation/preuves.py` (planches + mesures), réglages `tools/incrustation/plans.json`, coins par image `tools/incrustation/suivi/<source>.json` (brut, lissé, niveau du vert, qualité de chaque bord), mesures `tools/incrustation/suivi/mesures.json`. Sorties `flow/clips/incrustes/<source>` (ignoré par git, 106 Mo) : même nom, même nombre d'images que la source (vérifié par ffprobe pour les 11 fichiers), H.264 CRF 10 yuv420p, sans son, étiquettes de couleur de la source (BT.601 plage TV) ; hors des plages traitées (images montées ± 8), images d'origine réencodées, toujours vertes. Aucune capture refaite : seules les 18 de `assets/screens/` servent, sans aucun libellé ajouté.

Commandes : `python3 tools/incrustation/incruste.py [p07.mp4 …]` puis `python3 tools/incrustation/preuves.py [p07.mp4 …]` (ffmpeg dans le PATH).

## Méthode

1. **Suivi** : score de vert s = g − max(r, b). Pour chacun des 4 bords, profils perpendiculaires au bord prévu (pas de 0,5 px), sortie du vert la plus extérieure à mi-niveau, en sous-pixel ; on écarte 10 à 20 % du bord près des coins arrondis. Droite par moindres carrés totaux avec rejet itératif (doigts, encoche). Coins = intersections. Départ : image précédente décalée du déplacement du centre du vert (caméra à l'épaule de P36). Bord masqué (pouce, main) : une occlusion ne fait que rentrer le bord ; si la droite n'est pas parallèle au bord opposé, elle prend sa direction et se pose sur le quart de points le plus extérieur (P07, P16, P51). P31 : proportions de l'écran tenues (rapport médian des images propres) en déplaçant le bord court caché par la main ; P12 : bas de l'écran caché par la main pendant tout le geste, posé sur les côtés au rapport mesuré avant l'arrivée de la main (2,232, n°16–24), le haut restant mesuré. P17 : coins bas hors champ posés à y = 1700 sur les côtés prolongés. Valeurs isolées rejetées (écart > 2,5 px à la médiane sur 5 images), puis ajustement quadratique local symétrique (fenêtre 7, P16 : 13, P36 : aucun lissage car la secousse est réelle).
2. **Incrustation** : homographie de la capture (préréduite en Lanczos, sur-échantillonnage ×2). Ensuite flou de mise au point (0,4 à 0,8 px), flou de mouvement (sous-images le long de la trajectoire des coins, obturateur 180°), gain, teinte et noir de scène par plan (nuit : gain 0,78 à 0,82, teinte feu pour P48/P49, bleutée pour P51), ombrage du vert repris (ombre du pouce, dégradé), reflet de vitre fixe dans le monde (glisse quand le téléphone bouge) et grain mesuré sur le vert (plancher 0,003). Alpha = vert de la source dans l'écran suivi élargi de 3 px : doigts, cadre, encoche (P16) restent devant. Démélange : part de vert × alpha retirée, puis débordement limité à g ≤ (r + b)/2 dans un rayon de 10 px. P16 : les 4 croix noires imprimées sur le vert sont recouvertes par des disques forcés.
3. **Contenu vivant** (uniquement des glissements et fondus entre captures réelles) : P07 E01a → E01b glissé vers le haut au 1er balayage (n°16–19), retour E01b → E01a au 2e (n°40–43) ; P09 E01a → E01b (photo du lac) au pouce qui se pose (fondu n°81–83) ; P12 E02a → E02b au toucher de l'index (fondu n°31–32) ; P13 E03, P15 E04 ; P16 E05a → E05b (fondu n°24–27) ; P48 E09 ; P49 E12, dont le bas (« Créer le carnet ») est sous le pouce.

## Plans

| Plan | Source (images montées) | Capture(s) et raison | Coins : déplacement moyen / max (px/image) | Tremblement (dérivée seconde) moyen / max | Vert pur restant | Hors zone : écart moyen (p99,9) | Verdict |
|---|---|---|---|---|---|---|---|
| P07 | p07 8–49 | E01a ↔ E01b, le carnet Sorapis « d'un autre voyageur », réagit aux 2 balayages | 0,84 / 1,84 | 0,18 / 0,76 | 0 | 2,1 (7) | propre |
| P09 | p07 80–89 | E01a → E01b au pouce : la photo du lac apparaît | 0,94 / 1,85 | 0,11 / 0,39 | 0 | 2,2 (7) | propre (liseré clair au bord du pouce) |
| P12 | p12 24–44 | E02a → E02b : « Où veux-tu aller ? » vide, puis « Les Dolomites, 4 jours à 4 » | 1,74 / 3,77 | 0,55 / 1,33 | 0 | 2,2 (7) | acceptable |
| P13 | p13 20–40 | E03 « Avec d'autres · 4 personnes » | 0,99 / 2,03 | 0,22 / 0,61 | 0 | 2,0 (6) | propre |
| P15 | p13 98–108 | E04 Cortina d'Ampezzo, carte topo réelle | 0,62 / 0,98 | 0,15 / 0,34 | 0 | 2,1 (6) | propre |
| P16 | p16 8–38 | E05a → E05b, tournée à 180° pour que Léa la lise | 0,51 / 1,18 | 0,23 / 0,75 | 0 | 2,1 (7) | acceptable |
| P17 | p17 16–26 | E06, tournée à 180° : le bas de l'écran (« Commander · 5 pièces · 471 € ») est au bord visible, sous le pouce | 0,54 / 2,61 | 0,22 / 1,03 | 0 | 1,9 (6) | faible (géométrie extrapolée) |
| P25 | p25 14–24 | E07 Explorer, « Suivi en cours » 0:04 | 1,69 / 2,91 | 0,33 / 0,67 | 0 | 2,0 (7) | propre |
| P29 | p29 20–40 | E08 6,4 km, tracé | 2,88 / 5,34 | 0,41 / 1,26 | 0 | 2,0 (7) | propre |
| P31 | p31 45–65 | E09 couchée (haut de l'appli à gauche) | 2,27 / 4,26 | 0,54 / 1,42 | 0 | 2,2 (7) | acceptable (écran petit) |
| P36 | p36 1–11 | E10 en course | 18,2 / 33,3 (secousse réelle) | 8,0 / 19,8 (idem) | 0 | 2,1 (7) | acceptable |
| P48 | p48-2 34–65 | E09 : la photo du lac dans son carnet (qa/P48-ECRAN.md) | 0,33 / 1,40 | 0,19 / 1,16 | 0 | 2,1 (8) | propre |
| P49 | p48-2 20–29 | E12 « Public · 4 voyageurs », pouce sur « Créer le carnet » | 1,37 / 3,87 | 0,52 / 1,22 | 0 | 2,1 (7) | acceptable |
| P51 | p51 12–43 | E13 « Carnet de la semaine » | 1,57 / 3,11 | 0,41 / 1,13 | 0 | 2,1 (7) | propre |

- **Vert restant** : 0 pixel de vert pur (g > r + 90, g > b + 90, g > 180) dans le téléphone entier (écran suivi élargi de 40 px), sur toutes les images montées des 14 plans. Part de pixels au score de vert > ½ niveau dans l'écran : 0,0 partout. Première version de la mesure : elle ne regardait que l'intérieur de l'écran suivi et a laissé passer, sur P12, une bande verte sous un bas d'écran mal posé (n°29–44). L'erreur a été vue à la relecture des bandes, corrigée (rapport imposé), la mesure a été élargie et tout a été remesuré.
- **Hors zone** (écran suivi élargi de 30 px) : écart moyen source/sortie de 1,9 à 2,2 niveaux sur 255, p99,9 ≤ 8. Sur les images non traitées (réencodage seul), l'écart moyen est de 1,4 à 1,5 (max 17 à 26). Le reste vient du réencodage CRF 10 de toute l'image, pas d'une retouche : le code n'écrit que dans la boîte de l'écran élargie de 24 px.
- **Tremblement** : la dérivée seconde des coins lissés (accélération) reste ≤ 1,4 px partout, sauf P36. Sur P36, la secousse de la caméra à l'épaule est réelle et suivie image par image, sans lissage (écart brut/lissé = 0).

## Recadrages de la v3 (build-ours.mjs, champ `recadrage`)

- P09 : ×1,3 centré (950, 540), écran entier (haut à environ 60 px du bord).
- P15 : ×1,3 centré (1080, 495).
- P49 : ×1,45 centré (1180, 535).

Mise à l'échelle Lanczos en RGB 4:4:4 : à ×1,3–1,45, la netteté baisse un peu, mais les bords de l'écran restent nets sur `qa/snapshots/ours-v3/`.

## Preuves (`qa/snapshots/incrustation-video/`, 42 JPEG ≤ 400 Ko)

Pour chaque plan `pNN` : `pNN-avant-apres.jpg` (6 images avec leur numéro source), `pNN-zoom.jpg` (pleine résolution, début, geste et fin) et `pNN-bande.jpg` (une image sur 2 autour du geste). Je les ai toutes regardées.

## Ce qui reste faible (franchement)

- **P17** : la reprise p17 ne montre que le haut du téléphone en perspective, et les deux coins du bas sont hors champ. Les coins sont extrapolés (bas posé à y = 1700), donc l'échelle en profondeur est un choix et non une mesure. La capture est tournée à 180° (la manche vient du haut, le bord visible est le bas du téléphone) : le texte apparaît à l'envers pour le spectateur, ce qui est cohérent avec la prise. Le pouce couvre la pastille « Commander », dont on ne voit que les bouts (« Comma… », « …71 € »). Deux options : garder ainsi (on lit « elle appuie sur le bouton vert »), ou raccourcir P17 à 6 images avant l'appui.
- **P16** : la capture tournée (vœu de la relecture) laisse l'encoche réelle du téléphone sur le bas de l'appli, ce qui est géométriquement juste mais inhabituel. Le téléphone ne mesure qu'environ 110 × 200 px : les libellés sont illisibles et seuls le sac et les cartes se reconnaissent.
- **P07** : l'app réelle ne défile pas (fiche fixe). Le « défilement » est donc un glissement plein écran entre E01a et E01b. Au milieu du glissement, on voit la barre d'onglets d'E01a au-dessus de l'en-tête d'E01b (4 images).
- **P09** : il n'existe pas de grande photo du lac en plein écran (aucune visionneuse dans l'app). Au tap, on passe à E01b, où la photo est une vignette d'environ 30 % de la largeur.
- **P49** : le lever du pouce (n°29) est la dernière image du plan. Le changement d'état E12 → E09 se fait à n°31–32, hors du plan (il sert à P48), donc aucun changement n'est visible pendant P49. L'ordre du récit reste E09 (P48) puis E12 (P49), comme dans qa/P48-ECRAN.md.
- **Liserés** : un fin bord clair ou jaunâtre subsiste sur les pouces flous en mouvement (P09 n°80–81, P49 n°27–29), visible seulement à l'arrêt sur image.
- **Lumière** : gain et teinte sont réglés à l'œil sur des images fixes. L'écran n'éclaire pas les mains (pas de lueur ajoutée).
- **P31** et **P36** : l'écran est petit (P31) ou flou de bougé (P36), donc les libellés sont illisibles par nature.
- **Non jugé en mouvement** : je n'ai vu que des planches et des bandes, pas le film à vitesse réelle. Le « nage / ne nage pas » repose sur les bandes une image sur 2 et sur les mesures.
