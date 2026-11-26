# Relecture Flow 3 : prises P38 à P51

Relecteur : qa-critic. Date : 2026-11-14. Matière : `flow/clips/plans/pNN.mp4` (1920×1080, 24 i/s), planches `qa/snapshots/flow/pNN.jpg`, extractions pleine taille et bandes agrandies dans `qa/tmp/flow/relecture-3/`.
Durées utiles prises dans `DECOUPAGE-24.md` (1 temps = 0,438 s ≈ 10,5 images).
Numéros d'image comptés à partir de 0 ; t = n / 24.

## Synthèse

| Prise | Verdict | Meilleur passage (s · images) | Besoin du découpage | Durée propre disponible | Défaut principal | Note « vraie prise » |
|---|---|---|---|---|---|---|
| p38 | GARDER AVEC RÉSERVE | 0,50–2,25 s · 12–53 | 4 t = 1,75 s (42 i) | 4,9 s | texture de roche « vermiculée » ajoutée par Flow (absente d'img47) | 7/10 |
| p39 | GARDER | 0,083–0,958 s · 2–22 | 2 t = 0,88 s (21 i) | 4,9 s | lettrage minuscule sur la sacoche et la fourche (invisible à vitesse réelle) | 8,5/10 |
| p40 | GARDER AVEC RÉSERVE | 3,00–4,29 s · 72–103 (ou 1,50–2,79 s · 36–67) | 3 t = 1,31 s (32 i) | 4,9 s | même texture vermiculée sur les versants de droite | 7,5/10 |
| p41 | non retenue (doublon) | — | 1 t = 0,44 s (11 i) | 2,9 s | aucun défaut éliminatoire ; p41-2 plus lisible | 8/10 |
| p41-2 | GARDER | 0,25–0,67 s · 6–16 | 1 t = 0,44 s (11 i) | 2,9 s | — | 8,5/10 |
| p42 | GARDER | 0,083–1,375 s · 2–33 | 3 t = 1,31 s (32 i) | 4,9 s | la forme de la piste dérive après 3 s (hors passage) | 8,5/10 |
| p43 | GARDER | 0,50–1,79 s · 12–43 | 3 t = 1,31 s (32 i) | 4,9 s | drone qui avance et descend plutôt qu'il ne monte (sans gravité) | 8/10 |
| p44 | GARDER AVEC RÉSERVE | 0,083–0,958 s · 2–22 | 2 t = 0,88 s (21 i) | 2,6 s bras levés | elle approche lentement ; bras baissés dès 2,6 s | 8/10 |
| p45 | GARDER | 0,333–1,208 s · 8–29 | 2 t = 0,88 s (21 i) | 2,5 s | — | 8,5/10 |
| p46 | GARDER AVEC RÉSERVE | images 18–86 (0,75–3,58 s), accélérées ×2,15 → 32 images | 3 t = 1,31 s (32 i) | 2,8 s de bascule | la tombée de la nuit dure 2,5 s : il faut accélérer | 8/10 |
| p47 | GARDER AVEC RÉSERVE | 0,042–2,00 s · 1–48 | 5 t = 2,19 s (52 i) | 1,96 s | le chignon d'Inès pousse à partir de 1,96 s (image 47) | 8/10 |
| p48 (P48+P49) | GARDER AVEC RÉSERVE | P48 : 0,042–1,333 s · 1–32 ; P49 : 1,583–2,042 s · 38–49 | 3 t + 1 t = 1,75 s (42 i) | 3,0 s | bonnet et couverture apparus (rupture avec P47) ; pas de tape nette, le pouce glisse puis se lève | 7,5/10 |
| p50 | GARDER AVEC RÉSERVE | images 12–118 (0,50–4,92 s), accélérées ×2,5 → 42 images | 4 t = 1,75 s (42 i) | 5,9 s | recul réel mais très lent ; image très sombre ; filaments vermiculés dans la Voie lactée | 7/10 |
| p51 | GARDER | 0,50–1,79 s · 12–43 | 3 t = 1,31 s (32 i) | 5,9 s | — (écran vert sain, la surface verte augmente seulement parce que la caméra avance) | 8,5/10 |

Bilan : **7 GARDER** (p39, p41-2, p42, p43, p45, p51, plus p41 non retenue mais saine), **7 GARDER AVEC RÉSERVE** (p38, p40, p44, p46, p47, p48, p50), **0 REFAIRE** obligatoire. Une reprise **facultative** (P48) en bas de page.

### Défauts communs à toutes les prises

1. **L'image 0 saute.** Mesure de saut entre images (`ffmpeg … select='gte(scene,0)',metadata=print:key=lavfi.scene_score`) : le plus gros saut de chaque prise est entre l'image 0 et l'image 1 (p39 0,169 ; p41-2 0,154 ; p41 0,132 ; p42 0,121 ; p38 0,095 ; p40 0,091 ; p43 0,077 ; p45 0,067 ; p47 0,046). L'image 0 est l'image fixe, et le mouvement démarre d'un coup à l'image 1. **Ne jamais commencer un plan sur l'image 0.** Tous les passages ci-dessus commencent à l'image 1 ou plus tard. Aucun autre saut au-dessus de 0,06 dans les prises.
2. **Texture « vermiculée » de l'agrandissement 1080p de Flow** sur la roche, les éboulis, les versants boisés et la Voie lactée : des motifs en vers ou en labyrinthe, absents des images sources (comparaison `qa/tmp/flow/relecture-3/p38_texture.jpg` : img47 à gauche, p38 à 2,5 s à droite). La texture reste **stable d'une image à l'autre** (pas de grouillement, voir `p38_paroi.jpg`). Elle se voit donc sur grand écran, pas sur un téléphone. Contournement : un léger adoucissement (flou de 0,5 à 0,8 px ou réduction de bruit) puis le grain commun à l'étalonnage. Si Flow propose de télécharger la version 720p d'origine, comparer avant d'agrandir nous-mêmes. Une reprise donnerait le même défaut.

## Fiches

### p38 · P38 · La paroi de la Tofana ★ · 4,96 s · GARDER AVEC RÉSERVE · 7/10
- On voit la paroi orange et l'éboulis. Le coureur en t-shirt blanc court **vers la gauche** sur le sentier avec sa traînée de poussière, du début à la fin. Positions mesurées dans un cadre fixe : x ≈ 225 → 90 px (zoom ×2) de 0,05 à 1,25 s, puis x ≈ 150 → 72 px de 1,5 à 4,9 s. Il avance tout le temps, ne s'arrête pas et ne disparaît pas.
- 1 et 2 (acteur, corps) : silhouette de 25 à 45 px, foulée lisible au zoom, aucune déformation.
- 3 (mouvement) : vitesse de course crédible. La caméra avance doucement et dérive vers la droite au lieu de reculer comme demandé. Sans gravité : le mouvement est continu.
- 4 (décor) : la paroi reste stable, sans déformation. **Texture vermiculée** très marquée sur la paroi et l'éboulis en pleine taille (défaut commun n° 2). C'est la prise où elle se voit le plus, parce que le plan est fait de roche.
- 6 (première image) : identique à img47.
- 7 (passage) : 0,50–2,25 s (images 12–53, 42 images) pour 1,75 s. Le coureur est bien visible au centre bas, la poussière bien lisible.
- Images regardées : `qa/tmp/flow/relecture-3/p38_0.5.jpg`, `p38_coureur_zoom.jpg`, `p38_coureur_b.jpg`, `p38_paroi.jpg`, `p38_texture.jpg`, `p38_saut.jpg`.

### p39 · P39 · Le salut coureur / cycliste · 4,96 s · GARDER · 8,5/10
- Les deux saluts sont réels (main ouverte à 5 doigts pour lui, main gantée pour elle) et les sourires francs. Elle le dépasse et la caméra la suit vers la droite. Après 3 s, elle s'éloigne de dos sur la piste.
- 1 : visages vivants. Le visage de la cycliste change avec l'angle (rond de face à 0,3 s, plus fin de profil à 2,0 s) mais reste crédible. Sa tresse n'apparaît qu'à partir de 0,8 s, parce qu'elle était cachée de face.
- 2 : mains justes, roues rondes et rayons cohérents, pédalier crédible.
- 3 : vitesse réelle, pas de ralenti.
- 4 : une petite inscription sur la sacoche de cadre et un script sur la fourche, à 2,0 s (invisible à vitesse réelle). Elle porte ses lunettes orange **sur le nez** ici, alors qu'elles sont **sur le casque** en P44 (P2, continuité).
- 7 : 0,083–0,958 s (images 2–22), les deux saluts et le croisement. La matière est largement suffisante.
- Images regardées : `p39_0.3.jpg`, `p39_0.8.jpg`, `p39_2.0.jpg`, `p39_haut.jpg`, `p39_saut.jpg`.

### p40 · P40 · Le gravel au bord du lac doré ★ · 4,96 s · GARDER AVEC RÉSERVE · 7,5/10
- La cycliste roule **vers la droite**. Le drone glisse à sa vitesse et elle reste à peu près au centre. Le lac reflète les sommets.
- 2 et 3 : elle **pédale vraiment** (jambes en positions différentes sur 8 images successives, de 1,833 à 2,125 s, dans `p40_cycliste.jpg`). Elle ne glisse pas.
- 4 : les reflets sont cohérents. Les mélèzes passent derrière elle de 3,25 à 4,0 s avec une vraie parallaxe, sans fusion (`p40_arbre.jpg`). **Texture vermiculée** sur les versants boisés de droite (`p40_crop_mont.png`). Son maillot tire sur le rouge plutôt que sur le bordeaux (P2).
- 6 : identique à img30, puis l'arbre de gauche sort du cadre dès l'image 11.
- 7 : 3,00–4,29 s (images 72–103) pour la parallaxe des mélèzes, ou 1,50–2,79 s (images 36–67) pour un cadre plus dégagé sur le lac.
- Images regardées : `p40_2.0.jpg`, `p40_cycliste.jpg`, `p40_bande.jpg`, `p40_arbre.jpg`, `p40_crop_mont.png`.

### p41 et p41-2 · P41 · La roue dans les gravillons · 3,0 s chacune · **retenir p41-2** · 8 et 8,5/10
- Les deux prises sont propres : la roue tourne vite, les gravillons sont projetés vers la caméra, la poussière est en contre-jour et le pied est sur la pédale.
- p41 : très proche d'img31 (dérive 30,5). Un gros caillou flou passe devant le moyeu à 2,4 s, ce qui est voulu. Les rayons sont presque invisibles, effacés par le flou.
- p41-2 : de 0,25 à 0,7 s, la chaussure appuie sur la pédale en gros plan, les gravillons jaillissent, et on voit les rayons et le disque nets. C'est l'impact le plus lisible pour un plan d'un temps. À 2,4 s, on voit le pied du côté opposé à travers le cadre : c'est cohérent (manivelles opposées), pas un membre en trop.
- 3 : vitesse réelle. Aucune roue à l'envers n'est décelable.
- 7 : p41-2, 0,25–0,67 s (images 6–16).
- Images regardées : `p41_1.0.jpg`, `p41_2.4.jpg`, `p41-2_0.4.jpg`, `p41-2_2.4.jpg`.

### p42 · P42 · L'épingle vue du ciel ★ · 4,96 s · GARDER · 8,5/10
- Vue zénithale de la piste en S dans les mélèzes. La cycliste se penche dans l'épingle et repart **vers le haut à droite**, son ombre derrière elle. La rotation de la caméra est lente.
- 3 : elle avance sur toute la prise (l'épingle recule sous elle entre 2,0 et 4,85 s, dans `p42_cyc.jpg`). Pas de demi-tour, pas de sortie de piste.
- 4 : après 3 s, la boucle sous elle prend une forme nouvelle quand le cadre se découvre. On ne peut pas vérifier si c'est une vraie déformation. C'est hors du passage retenu.
- Saut signalé par la mesure à 1,0 s (0,047) : rien de visible sur les images 22 à 26 (`p42_saut.jpg`).
- 7 : 0,083–1,375 s (images 2–33). On y voit l'épingle complète et l'ombre.
- Images regardées : `p42_1.0.jpg`, `p42_saut.jpg`, `p42_fin.jpg`, `p42_cyc.jpg`.

### p43 · P43 · Les lacets du Passo Giau ★ · 4,96 s · GARDER · 8/10
- Le point bordeaux roule **vers la droite** dans le lacet du milieu de 0,5 à 1,75 s (`p43_trans.jpg`), puis suit la courbe vers le bas. Elle avance tout le temps, ne disparaît pas et ne se dédouble pas (`p43_cyc_zoom.jpg` : pédalage visible).
- 4 : la tour rocheuse et la crête restent stables. La caméra avance et descend légèrement au lieu de monter. Le rocher du premier plan à gauche sort du cadre. L'herbe ondule peu.
- 7 : 0,50–1,79 s (images 12–43).
- Images regardées : `p43_2.0.jpg`, `p43_cyc.jpg`, `p43_cyc2.jpg`, `p43_trans.jpg`, `p43_cyc_zoom.jpg`.

### p44 · P44 · Les bras levés · 4,96 s · GARDER AVEC RÉSERVE · 8/10
- Elle crie et rit, bras levés et soleil derrière le casque, jusqu'à 2,4 s. Elle baisse les bras entre 2,4 et 2,8 s, puis pédale vers la caméra en riant.
- 1 : visage stable sur 8 images (`p44_visage.jpg`). Rire franc, rides et dents crédibles, pas de lissage.
- 2 : gants à 5 doigts. Les mains sont correctes sur toute la montée des bras (`p44_mains.jpg`).
- 3 : **elle approche lentement** (mouvement médian 1,16) : la taille de la silhouette change peu avant 2 s. Ce n'est pas un ralenti flottant, mais l'élan est moins fort que prévu. Les lunettes sur le casque sortent du haut du cadre vers 1,6 s, sans disparition visible (`p44_lunettes.jpg`).
- 7 : 0,083–0,958 s (images 2–22), le cri au sommet.
- Images regardées : `p44_visage.jpg`, `p44_mains.jpg`, `p44_lunettes.jpg`.

### p45 · P45 · Le salut au bivouac · 3,92 s · GARDER · 8,5/10
- La cycliste traverse le premier plan vers la droite en saluant, floue de vitesse. Inès lève la main, Tom sourit et Sami souffle sur le feu. Le groupe s'installe et la flamme vit.
- 1 et 4 : quatre visages stables, personne n'apparaît ni ne disparaît (`p45_0.7.jpg`, `p45_2.6.jpg`). Le marteau de Tom est crédible.
- 7 : 0,333–1,208 s (images 8–29), la traversée et les saluts croisés.
- Continuité (hors prise) : Inès porte une veste vert sauge ici et en P46, mais une doudoune crème en P47, comme le veut la bible (P2).
- Images regardées : `p45_0.7.jpg`, `p45_2.6.jpg`.

### p46 · P46 · La nuit tombe sur le bivouac · 4,96 s · GARDER AVEC RÉSERVE · 8/10
- **La nuit tombe vraiment, et ce n'est pas un fondu.** Luminance moyenne par image (`signalstats YAVG`) : 94 de l'image 0 à 18, puis 91 → 88 → 82 → 77 → 71 → 66 → 59 → 54 → 48 → 41 de l'image 24 à 78, puis 40 stable de l'image 84 à 118. Le ciel rose bleuit, les étoiles puis la Voie lactée apparaissent, et les tentes et le feu brillent davantage. À 2,5 s, il n'y a **aucune double image**. Pendant ce temps, les quatre amis bougent à vitesse réelle (ils boivent, Inès lève sa tasse). On a donc un ciel en accéléré et des gens en temps réel, ce qui passe très bien.
- **Dernière image et img35b** : même cadre, mêmes tentes, sacs, personnes et pics. SSIM 0,66 et PSNR 25,7 dB : les écarts viennent des étoiles et du grain (`p46_fin_vs_img35b.jpg`). On peut donc enchaîner sur un plan tourné à partir d'img35b.
- « Quasi figée » dans l'inventaire : la caméra est fixe, comme demandé. Ce n'est pas un défaut.
- 1 et 4 : visages et tenues stables du début à la fin (`p46_groupe.jpg`).
- 7 : la bascule utile va de l'image 18 à l'image 86 (2,8 s). Le découpage n'accorde que 1,31 s, donc il faut **accélérer ×2,15** (une image sur deux plus quelques images en double, ou un fondu entre images). Dans un plan en accéléré, les gestes plus rapides des personnages paraissent naturels. Sinon, couper à 1,31 s en temps réel ne montrerait que la moitié de la nuit.
- Images regardées : `p46_2.5.jpg`, `p46_last.png`, `p46_fin_vs_img35b.jpg`, `p46_groupe.jpg`.

### p47 · P47 · Rires autour du feu (test « vrais acteurs ») · 3,0 s · GARDER AVEC RÉSERVE · 8/10
J'ai jugé les visages un par un, sur 8 instants entre 0,1 et 2,9 s (`p47_tom.jpg`, `p47_lea.jpg`, `p47_ines.jpg`, `p47_sami.jpg`) :
- **Tom** (doudoune bleu encre, à gauche) : même visage tout du long, de profil. Un sourire qui grandit puis se referme, la barbe de trois jours et les boucles sont stables. Crédible. 9/10.
- **Léa** (doudoune vert forêt) : grand sourire de 0,1 à 0,9 s, puis un rire doux, tête baissée, exactement comme la fiche le demande. Les traits restent les siens. À la fin, le visage paraît un peu plus âgé et plus étroit (dérive légère, visible seulement image par image). 8/10.
- **Inès** (doudoune crème) : vrai éclat de rire tête en arrière, crédible, avec les créoles stables. **Défaut : à partir de 1,96 s (image 47), un grand chignon de tresses pousse sur le haut de la tête** et le visage s'affine (`p47_ines_fin.jpg`, de 1,708 à 2,292 s). On le voit à vitesse réelle si le plan dure jusqu'à 2,2 s ou plus. 6/10 sur toute la prise, 8,5/10 jusqu'à 1,92 s.
- **Sami** (bonnet gris, doudoune sable) : il lève les deux mains et raconte (main à 5 doigts, `p47_mains.jpg`), puis ramène ses mains sur ses genoux en riant. Visage identique, montre au poignet. 9/10.
- Le feu au premier plan vit (flammes plus hautes qu'en img36, gerbes d'étincelles à 0,8–1,1 s). La vapeur monte de la tasse et l'écusson du sac reste un pictogramme de montagne, sans lettres.
- 6 : image 0 identique à img36.
- 7 : 0,042–2,00 s (images 1–48, 48 images = 2,0 s), soit **4 images de moins** que les 52 du découpage. Deux solutions : céder 4 images au plan voisin, ou aller jusqu'à l'image 52 (2,17 s), en acceptant que le chignon commence à pousser sur les 5 dernières images (changement progressif, à peine perceptible à cette vitesse). Je recommande de s'arrêter à l'image 48.
- Verdict sur le test : **oui, on croit à de vrais acteurs** sur les 2 premières secondes. C'est le meilleur plan de groupe de ma partie.
- Images regardées : `p47_0.5.jpg`, `p47_1.3.jpg`, `p47_2.1.jpg`, `p47_2.9.jpg`, plus les bandes ci-dessus.

### p48 · P48 + P49 · Léa publie son carnet · 3,0 s · GARDER AVEC RÉSERVE · 7,5/10
- Plan par-dessus l'épaule : Léa sourit à son téléphone, puis son sourire s'élargit (bouche entrouverte à 2,5 s). Le feu vit à droite.
- **Première image retouchée par Flow** : par rapport à img37, elle porte un **bonnet gris** et une **couverture de laine** sur les épaules, et sa doudoune est cachée (`p48_0.8.jpg` comparé à `assets/footage/img37.png`). La bible (PROMPTS-CHATGPT, jour 1, nuit) donne bien à Léa un bonnet gris et une couverture grise. Mais **en P47, juste avant, Léa n'a ni bonnet ni couverture sur les épaules**. Coupe directe P47 → P48 : un bonnet apparaît. Un spectateur attentif le verra (P1).
- **Le pouce ne tape pas** : de 0,0 à 1,8 s, il reste posé sur le bas de l'écran et glisse vers le bas à gauche (on dirait un défilement). À 1,83–2,0 s, il se lève et quitte l'écran par la droite. Il n'y a pas d'appui net (`p48_pouce_a.jpg`, `p48_pouce_b.jpg`).
- **Écran vert** : aplat net, entier, sans interface. La surface mesurée reste entre 2,76 et 3,2 %. Les deux coins du haut et le coin bas gauche sont toujours visibles. Le coin bas droit est souvent caché par la main droite. Le pouce recouvre le tiers bas de l'écran jusqu'à 1,8 s, ce qui gênera l'incrustation du bouton « Publier » (prévoir de masquer le pouce, rotoscopie légère).
- 1 : profil stable, taches de rousseur et créole, sourire crédible (`p48_visage.jpg`).
- 7 : **P48** sur 0,042–1,333 s (images 1–32, le sourire). **P49** sur 1,583–2,042 s (images 38–49) : le pouce se lève et quitte l'écran, ce qu'on peut lire comme « je viens de valider » si l'animation du bouton est calée sur l'image 41 environ. Au total 42 images pour 42 demandées : c'est juste, mais ça suffit.
- Reprise facultative ci-dessous, seulement si Tony juge la rupture du bonnet trop visible.

### p50 · P50 · Le bivouac sous la Voie lactée ★ · 5,96 s · GARDER AVEC RÉSERVE · 7/10
- **Ce n'est pas un plan fixe déguisé** : en cadre fixe, le campement rapetisse (largeur des tentes d'environ 230 à 160 px entre 0,04 et 5,9 s, soit un recul d'environ 30 %), et la caméra dérive vers la gauche (`p50_camp_b.jpg`). **Le feu vacille** d'une image à l'autre et **un fil de fumée monte** (`p50_camp.jpg`, zoom ×2 sur les images 1 à 6). On voit les quatre silhouettes autour du feu.
- Le ciel ne tourne pas et ne scintille pas en masse : étoiles identiques sur les images 1 à 3 (`p50_ciel.jpg`). En revanche, des **filaments vermiculés** sombres traversent la Voie lactée (défaut commun n° 2).
- L'image est très sombre (YAVG ≈ 30 sur 255, stable). La mesure « figée » vient de l'obscurité et de la lenteur du recul (≈ 5 % par seconde) : sur 1,75 s en temps réel, le recul ne se sentirait presque pas.
- 7 : prendre les images 12–118 (0,5–4,92 s) et **accélérer ×2,5** pour obtenir 42 images. On obtient un recul franc (≈ 25 %). Le feu ne fait que 15 px, donc l'accélération de la flamme ne se verra pas. Autre solution : garder 1,75 s en temps réel et ajouter un recul numérique de 108 % à 100 %.
- Images regardées : `p50_camp.jpg`, `p50_camp_b.jpg`, `p50_ciel.jpg`, `p50_saut.jpg`.

### p51 · P51 · Noah dans le bus de nuit · 5,96 s · GARDER · 8,5/10
- Noah regarde son écran. De 0,5 à 1,6 s, il **se fige, bouche entrouverte**, puis se reprend et fixe l'écran, sérieux. La pluie coule sur la vitre, les lumières de la ville défilent et la caméra avance lentement.
- 1 : même visage sur 17 instants entre 0 et 5,9 s (taches de rousseur, boucles, boutons sur la joue), sans lissage (`p51_visage.jpg`, `p51_visage2.jpg`). La bouche ouverte est un peu théâtrale, mais crédible.
- 5 : **écran vert sain**. Aplat net, entier, avec les quatre coins visibles sur `p51_1.2.jpg` et `p51_4.0.jpg`. Le pouce gauche tient le bord sans couvrir l'écran. La « surface instable de 1,01 à 3,08 % » vient uniquement de l'avancée de la caméra (le téléphone grossit d'environ ×3 en surface). Ce n'est pas un défaut.
- 4 : la barre jaune du bus sort par la gauche vers 0,7 s à cause de la poussée, c'est normal. Saut signalé à 4,5 s (0,033) : rien de visible (`p51_saut.jpg`).
- 7 : 0,50–1,79 s (images 12–43), l'arrêt net.
- Images regardées : `p51_1.2.jpg`, `p51_4.0.jpg`, `p51_visage.jpg`, `p51_visage2.jpg`, `p51_saut.jpg`.

## Reprises

Aucune reprise obligatoire. Tous les défauts de ma partie se contournent au montage :
- **P47** : couper à l'image 48 avant la pousse du chignon.
- **P46 et P50** : accélérer la bascule et le recul.
- **P48 et P49** : prendre le lever du pouce comme moment de validation.
- **P38, P40 et P50** : adoucir la texture à l'étalonnage.

### Reprise facultative · P48 + P49 (si la rupture du bonnet avec P47 est jugée trop visible)
- **Cause** : Flow a ajouté un bonnet et une couverture sur la première image, ce qui casse la continuité avec P47, où Léa est tête nue. De plus, le pouce glisse au lieu de taper.
- **Image à importer** : `img37.png` **d'origine**, sans retouche, en vérifiant dans Flow que l'aperçu de la première image n'a ni bonnet ni couverture sur les épaules avant de lancer. **Durée** : 5 s.
- **Prompt** :

```
Live-action film shot, cinema camera, 35mm look, fine grain, warm firelight at night. Over-the-shoulder close-up of a woman with a low ponytail and no hat, wearing a dark green puffer jacket, phone held upright in her left hand. She smiles at the screen, then lifts her right thumb and taps once, quickly, near the bottom of the screen, and lifts it away. Static camera. The phone screen is a flat solid bright green and stays exactly like that for the whole shot: no interface, no picture, no text on it. Keep her hair, jacket and blanket on her lap exactly as in the first frame. Real-time speed, no slow motion, no cuts. No text, no logos, no subtitles. Natural ambient sound only, no dialogue, no music.
```

- **Ce qui change et pourquoi** :
  - « low ponytail and no hat » et « Keep her hair, jacket and blanket… exactly as in the first frame » : interdisent à Flow d'habiller Léa autrement que sur img37 (et donc qu'en P47).
  - « phone held upright in her left hand » : libère la main droite. Dans la prise actuelle, le pouce droit reste posé parce que les deux mains tiennent le téléphone.
  - « lifts her right thumb and taps once, quickly… and lifts it away » : décrit l'appui en trois temps (lever, toucher, retirer) au lieu d'un « taps once » que Flow a rendu comme un glissement.
- **Si la reprise rate**, garder la prise actuelle avec le contournement décrit dans la fiche p48.

## Non vérifié

- **Son** : je ne l'ai pas écouté. L'inventaire indique seulement qu'une piste audio est présente dans chaque fichier. Le son ne sera de toute façon pas utilisé.
- **Sens de rotation des roues** (P39, P41, P43) : on ne peut pas le trancher sur des images figées à cause du flou de mouvement. Aucune incohérence visible à vitesse réelle sur les bandes successives.
- **Déformation réelle de la piste dans P42 après 3 s** : impossible de séparer une vraie déformation de la découverte du cadre par la rotation. C'est hors du passage retenu.
- **Lecture à vitesse réelle** : j'ai jugé sur des images et des bandes à pas de 1 à 12 images, sans lecteur vidéo. Un vacillement de texture entre deux images extraites n'est donc pas exclu, même si la mesure de saut n'a rien signalé au-dessus de 0,06 hors image 0.
- **Version 9:16** : non examinée (hors brief).
