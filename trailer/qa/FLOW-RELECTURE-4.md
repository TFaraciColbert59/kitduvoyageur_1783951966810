# Relecture des prises Flow, série 4 : P10 et les reprises P17, P28, P37, P48+P49

Relu le 14/11/2026 par qa-critic. Vidéos : `/Users/fr168256/Projets/LKDV/lkdv/trailer/flow/clips/plans/`. Extractions : `/Users/fr168256/Projets/LKDV/lkdv/trailer/qa/tmp/flow/relecture-4/` (noté `R4/`). Numéros d'image : base 0, ceux du fichier, à 24 i/s. L'image n°0 n'est jamais utilisée.

Règle : un défaut visible à vitesse réelle élimine le passage ; un défaut visible seulement à l'arrêt sur image est noté sans éliminer.

Mesures (ffprobe, `-count_frames`) : p10 119 i. · p17-2 72 i. · p28-2 119 i. · p37-2 119 i. · p48-2 119 i. Toutes en 1920×1080, 24/1.

## Synthèse

| Plan | Prise à monter | Image d'entrée | Images propres à partir de là | Défaut restant | Note | Verdict |
|---|---|---|---|---|---|---|
| P10 | **p10** (nouvelle) | 30 (sortie 71) | 89 (30 à 118) | texture de roche « vermiculée » à l'arrêt ; le sommet ne grossit pas (normal à cette distance) | 8,5 | GARDER |
| P17 | **p17** (ancienne) | 16 (sortie 27, appui n°26) | 12 (16 à 27) | cadrage différent d'img43, coins bas hors champ, trace sur le vert dès n°28 | 6 (p17-2 : 5) | GARDER AVEC RÉSERVE |
| P28 | **p28-2** (nouvelle) | 32 (sortie 52) | 87 (32 à 118) | ciel bleu sur n°1–20 (à exclure) ; fond = une seule tour avant que les Tre Cime n'apparaissent (n°54+) | 8 | GARDER |
| P37 | **p37-2** (nouvelle), **accélérée ×2,4** | 3 (sortie 52, réception n°13) | 55 (3 à 57) | vol au ralenti (≈ ×3 à ×4) s'il est monté en temps réel ; petit saut pieds groupés n°24–34 | 7,5 | GARDER AVEC RÉSERVE |
| P48 | **p48-2** (nouvelle) | 34 (sortie 65) | 85 (34 à 118), écran sans pouce | **bonnet et couverture toujours là** (rupture avec P47) | 6,5 | GARDER AVEC RÉSERVE, reprise utile seulement avec un nouvel import d'img37 |
| P49 | **p48-2** (nouvelle) | 20 (sortie 30) | 11 (20 à 30) | pas de vrai tap : le pouce est posé dès n°1 et se relève n°27–31 | 6 | GARDER AVEC RÉSERVE |

Constat transversal (mesuré) : pour P17 et P48, la première image de la reprise est presque identique à celle de la première prise (PSNR entre les n°1 : p17/p17-2 = 39,5 dB, p48/p48-2 = 31,5 dB). Flow est reparti de **la même image de départ retouchée**, pas d'img43 et d'img37 d'origine. Changer le prompt ne peut donc pas corriger ce qui est déjà dans la première image : il faut réimporter le PNG d'origine comme nouvel élément.

Commande : `ffmpeg -i p48.mp4 -i p48-2.mp4 -filter_complex "[0:v]select='eq(n\,1)'[a];[1:v]select='eq(n\,1)'[b];[a][b]psnr" -frames:v 1 -f null -`

## Fiches

### P10 · p10.mp4 · le lac devient réel · GARDER · 8,5/10
1. **Demande remplie.** Survol au ras de l'eau : l'horizon du lac reste vers 55 % de la hauteur, donc la caméra est à 1 ou 2 m au-dessus de l'eau. Les pierres claires passent sous l'objectif (une grappe entre au centre n°43 et sort par le bas n°55, soit environ 12 images) : la vitesse se lit, sans ralenti (mouvement médian 4,38). **Personne**, pas de bateau ni d'animal, sur les 119 images (`R4/p10_tout.jpg`, une image sur 6). Le sommet garde sa forme. Il ne grossit pas : c'est juste, à 2 km de distance et sur 5 s.
2. **Défauts.** Le soleil apparaît entre les mélèzes à partir de n°7 et reste au même endroit (`R4/p10_soleil_1-23.jpg`) : c'est un effet de parallaxe crédible, pas un saut. Sur n°1–20, l'eau garde le flou de filé d'img09 (traînées laiteuses) ; à vitesse réelle, cela se lit comme de la vitesse. À l'arrêt sur image, la roche et les éboulis ont la texture « vermiculée » de l'agrandissement 1080p (`R4/p10_f060.jpg`), comme sur P38, P40 et P50 : il faut l'adoucir à l'étalonnage. Luminance de la moitié haute stable (140–153).
3. **À monter** : la nouvelle (seule prise).
4. **Passage** : n°30 à 71 (42 images, 1,25–2,96 s). Il contient le soleil déjà installé et les pierres les plus proches (n°43–67). Toute la prise est propre de 1 à 118 : on peut décaler librement pour caler le raccord avec P08.
5. Raccord avec P08 (lac dans la pupille) et P11 : non vérifié en lecture enchaînée, seulement sur images fixes. Couleur turquoise et lumière rasante cohérentes.

### P17 · p17-2.mp4 · le pouce sur « Commander » · la reprise n'a rien corrigé · monter p17 · 6/10
1. **Cadrage : non corrigé.** Dès n°0, c'est le même cadrage que p17 : téléphone en perspective, bord bas et **deux coins bas hors champ**, pouce qui vient du haut (`R4/p17-2_n0n1.jpg`, `R4/p17-2_planche.jpg`). Les n°1 des deux prises sont presque identiques (39,5 dB) : Flow est reparti de son image recadrée, pas d'img43.
   **Trace sur le vert : pire.** Un cône clair part sous le pouce **dès n°14**, et il est net de n°26 à 34 (`R4/p17-2_appui_10-34.jpg`). Sur p17, elle n'apparaissait qu'à n°28 (`R4/p17_appui_14-32.jpg`).
   **Appui : toujours mou.** Le pouce se pose au bord haut de l'écran (ombre la plus dense vers n°12), glisse un peu vers la droite, puis se relève de n°29 à 37. Il n'y a pas d'enfoncement net.
2. **Nouveaux défauts** : aucun sur la main (taches de rousseur, ongle, manche crème stables). Il ne reste que n°1 à 13 sans trace, soit 13 images, autant que p17, avec un appui moins lisible.
3. **À monter : p17 (ancienne).**
4. **Passage** : p17 n°16 à 27 (12 images), appui n°26, coupe avant la trace (n°28). Incrustation avec les deux coins du haut et les bords latéraux prolongés.
5. GARDER AVEC RÉSERVE (p17). **Ne pas relancer avec le même élément** : changer le prompt n'y fera rien. Le seul essai qui a une chance consiste à réimporter `img43.png` d'origine sous un autre nom (par exemple `img43-orig.png`), à vérifier dans l'aperçu que le téléphone entier et ses quatre coins sont dans le cadre, puis à relancer le prompt de REPRISES-1 §5 tel quel. Le plan ne dure qu'un temps : c'est facultatif.

### P28 · p28-2.mp4 · la main tendue · GARDER · 8/10
1. **Le ciel est corrigé, à partir de n°28.** Mesure : teinte moyenne du tiers haut (1920×360), écart bleu − rouge (`ffmpeg … crop=1920:360:0:0,scale=1:1:flags=area`).

| Image | R G B | B−R |
|---|---|---|
| p27 n°113 (dernière utile) | 149 155 164 | +15 |
| p28-2 n°6 | 114 120 137 | +23 (bleu d'img20) |
| p28-2 n°20 | 153 145 150 | −3 (bascule en cours) |
| p28-2 n°30 / 40 / 50 | 172 155 149 / 144 129 122 / 170 154 148 | −23 / −22 / −22 |
| p28-2 n°75 / 110 | 173 155 147 / 208 186 179 | −26 / −29 |
| p29 n°1 / 20 | 180 167 161 / 178 165 160 | −19 / −18 |
| ancienne p28 n°30 / 40 / 50 | — | +37 / +26 / +33 |

   À partir de n°28, le ciel est rose pêche et stable, **à 3–5 points de P29** (l'ancienne en était à 50 points). P27 est neutre (+15) : il passe du neutre au chaud, ce qui est le sens normal d'un lever de soleil. Sur n°1 à 20, le ciel vire du bleu au rose : **il ne faut pas monter ces images**, car la bascule s'y voit.
2. **Action** : une vraie traction. Elle saisit la main, prend appui, monte le pied (n°36–60), rit ; lui rit aussi (`R4/p28-2_traction_14-60.jpg`). Le visage de la femme est stable de n°20 à 62 : boucles lâchées et queue-de-cheval, plus proche de la Léa de P29 que l'ancienne (`R4/p28-2_visages_20-62.jpg`). Les mains serrées sont propres (`R4/p28-2_f048.jpg`).
   À l'arrêt seulement : sur n°36, la main libre de l'homme n'est qu'une tache floue de mouvement (`R4/p28-2_f036.jpg`) ; à vitesse réelle, cela se lit comme un geste. Sur n°24–50, l'arrière-plan est **une seule grande tour** ; les Tre Cime n'apparaissent qu'à partir de n°54 (P2 : le spectateur ne compte pas les tours en 0,9 s).
3. **À monter : p28-2.**
4. **Passage** : n°32 à 52 (21 images, 1,33–2,17 s), de la prise d'appui au pied posé, avec les deux rires. Images propres de 28 à 118 (91), pour décaler si besoin ; la fin (n°75+) est un plan moyen, debout.
5. GARDER. L'étalonnage ne doit que poser la teinte commune, plus rattraper un ciel bleu.

### P37 · p37-2.mp4 · le saut du torrent · GARDER AVEC RÉSERVE · 7,5/10
1. **Reprise de course : en grande partie corrigée.** Le pied avant se pose sur le gros rocher à **n°13**. Il fait un petit saut pieds groupés pour monter sur le rocher (n°24–34), puis **repart en foulées** (n°36–49) et sort du cadre à droite vers n°55–57 (`R4/p37-2_reception_1-59.jpg`, `R4/p37-2_corps_12-46.jpg`). Il ne remonte plus le rocher accroupi comme dans p37.
   **Ralenti : oui.** L'alerte « mouvement médian 1,2 » vient pour moitié de ce que la caméra est fixe et que n°58 à 118 ne montrent plus que le torrent. Mais la mesure de la position du coureur (différence avec n°110, caméra fixe) donne : centre du corps x = 807 (n°1) → 941 (n°13) → 1 199 (n°22) → 1 544 (n°37) → 1 807 (n°52). Cela fait **11 px/image en vol** et environ 20 px/image ensuite. Avec un corps d'environ 720 px de haut (≈ 1,8 m, soit ≈ 400 px/m), on obtient ≈ 0,7 m/s en vol et ≈ 1,2 m/s ensuite. Un coureur qui saute un torrent va à 3–4 m/s. **Le vol est donc environ 4 fois trop lent**, ce qu'on voit à vitesse réelle. L'ancienne p37 a le même vol lent (estimé sur la planche, car sa caméra suit et la mesure automatique n'y fonctionne pas).
2. **Autres défauts** : le jet d'eau collé au pied arrière (n°15–23) est toujours là, plus fin que dans p37 ; il se lit comme une éclaboussure (`R4/p37-2_f020.jpg`). Le visage, la tenue, les mélèzes et le rocher sont stables. Cadre fixe, comme demandé.
3. **À monter : p37-2.** Elle a une vraie sortie de course et 55 images propres, ce qui permet d'accélérer. p37 n'avait que 21 images, sans marge, et ne pouvait pas être accélérée.
4. **Passage** : n°3 à 52 (50 images) **accélérées ×2,4 → 21 images**. La réception (n°13) tombe à l'image 4 du plan monté. Vitesse obtenue : ≈ 2,9 m/s, crédible. Le saut pieds groupés ne dure plus que 4 images. Si l'on refuse d'accélérer : n°4 à 24 en temps réel, réception à n°13, mais le ralenti du vol se verra.
5. GARDER AVEC RÉSERVE (accélération obligatoire ; à vérifier sur l'eau accélérée, qui pourrait sembler nerveuse — non vu en lecture).

### P48 + P49 · p48-2.mp4 · Léa publie son carnet · la reprise n'a pas corrigé le défaut principal · 6,5/10
1. **Bonnet : NON corrigé.** Dès n°0, Léa porte le **bonnet gris** et la **couverture de laine sur les épaules** (`R4/p48-2_f001.jpg`, `R4/p48-2_f030.jpg`), comme dans p48. Dans p47, Léa (deuxième à gauche) est **tête nue**, en doudoune verte, avec un plaid à carreaux sur les genoux (`R4/p47_planche.jpg`). La rupture P47 → P48 reste visible (P1). Les n°1 de p48 et p48-2 sont presque identiques (31,5 dB) : Flow est reparti de l'image retouchée de la première génération, pas d'img37.
   **Tap : NON corrigé.** Le pouce droit est posé sur le bas de l'écran **dès n°1**, glisse un peu vers le bas à gauche (n°1–21), remonte (n°27–29, flou), puis quitte l'écran par le bord droit (n°31–33). Il n'y a ni toucher ni relâcher net (`R4/p48-2_pouce_1-47.jpg`). Même geste que p48 (`R4/p48_pouce_30-52.jpg`, départ n°38–44).
2. **Ce qui est mieux** : 5 s au lieu de 3. **De n°34 à 118, l'écran vert est libre de tout doigt** (les quatre coins sont visibles, surface 2,8–3,3 %), ce qui rend l'incrustation de P48 beaucoup plus simple. Visage stable sur toute la prise, sourire doux, créole, taches de rousseur (`R4/p48-2_visage.jpg`). Le feu vit, avec des étincelles.
3. **À monter : p48-2 pour les deux plans.** P48 se prend dans la partie sans pouce, P49 dans le départ du pouce.
4. **Passages** :
   - **P48** : n°34 à 65 (32 images), sourire, écran net, sans doigt. 85 images propres disponibles (34 à 118).
   - **P49** : n°20 à 30 (11 images). Il n'existe **aucune image où le pouce touche l'écran** : il y est déjà posé à n°1. Le **relâcher** se situe à **n°29** (le pouce décolle, flou) et le pouce a quitté l'écran à n°31. Il faut caler l'animation du bouton « Publier » sur n°27–28 et le son du tap sur n°28, puis monter P49 en plan plus serré (recadrage ×1,4 sur le téléphone) pour que la reprise du geste après P48 se lise comme un nouveau plan.
5. Verdict : GARDER AVEC RÉSERVE. La rupture de bonnet reste le seul vrai défaut (P1).
   **Reprise : elle n'a de chances qu'en changeant l'image importée, pas le prompt.** Il faut réimporter `img37.png` d'origine comme **nouvel élément** dans Flow (renommé, par exemple `img37-tetenue.png`), et vérifier dans l'aperçu de la première image : pas de bonnet, doudoune verte visible, couverture sur les genoux seulement. Ensuite, relancer avec ce prompt (le tap est déplacé en milieu de plan et décrit comme un aller-retour) :

```
Live-action film shot, cinema camera, 35mm look, fine grain, warm firelight at night. Over-the-shoulder close-up of a woman with bare head, brown hair in a low ponytail, wearing a dark green puffer jacket, blanket only on her lap, phone held upright in her left hand. Her right thumb starts away from the phone, resting on its right edge. She smiles at the screen; after two seconds she brings her right thumb onto the lower part of the screen, presses once quickly, and lifts it straight off. Static camera. The phone screen is a flat solid bright green for the whole shot: no interface, no picture, no text. No hat, no beanie, no blanket on her shoulders at any time. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

   Changements : « bare head… No hat, no beanie… at any time » (à la place de « no hat », qui n'a pas suffi) ; le pouce **part hors de l'écran**, pour que le toucher existe ; le tap est placé « after two seconds », pour laisser à P48 un sourire sans doigt avant. Si l'aperçu montre encore un bonnet, ne pas lancer.
   Contournement sans reprise : garder le bonnet (la bible donne à Léa un bonnet gris la nuit) ; insérer entre P47 et P48 une respiration de 4 à 6 images sur le feu ou les étincelles, pour que l'œil ne compare pas les deux Léa d'un plan à l'autre. Cela atténue la rupture sans la supprimer.

## Ce qui n'a pas été vérifié
- **Lecture à vitesse réelle** : je juge sur des images fixes et des bandes (une image sur 2), je n'ai pas regardé les vidéos en lecture. En particulier : le rendu de P37 accéléré ×2,4 (eau nerveuse ?) et la bascule de ciel de P28 sur n°1–28.
- **Son** des prises : non mesuré, il n'est pas utilisé au montage.
- **Raccords enchaînés** P08 → P10 → P11 et P36 → P37 → P38 : comparés sur images fixes seulement, pas en montage.
- **Vitesse du vol de p37** (ancienne prise) : estimée sur la planche, car sa caméra suit le coureur, ce qui fausse la mesure par différence d'images.
- **Cause du bonnet** (élément Flow retouché ou retouche automatique à chaque génération) : déduite de la quasi-identité des premières images, sans accès à Flow.
