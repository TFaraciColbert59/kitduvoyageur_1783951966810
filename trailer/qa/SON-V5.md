# Son v5 : effets sur l'ours v4 (24 i/s)

Rédigé le 15/11/2026 par `sound-designer`. **Mesuré, non écouté** partout : je lis des chiffres et des images, je n'entends rien.
Outils : FFmpeg 6.0 (`node_modules/ffmpeg-static`), ffprobe 4.4, Node 26, python3 + numpy + Pillow. Les niveaux ne sont comparables qu'à version égale de FFmpeg.

## Ce qui a été fait

- **Musique et habillage v4 inchangés** (même montage, mêmes trois sons d'habillage), sauf un creux de respiration avant le drop 1 : −4 dB de 24,366 à 24,514 s (≈ images 585–588), rampes de 25 ms, retour au gain normal 12 ms avant l'attaque mesurée du drop (24,526 s).
- **31 effets** posés à l'image près sur le film à 24 i/s : **8 gestes**, **19 matières et ambiances**, **4 raccords**. 20 nouveaux fichiers dans la banque (`assets/audio/sfx/SOURCES.md`), dont 3 dérivés des prises Kenney CC0 ; aucun téléchargement.
- Commandes : `node tools/audio/build-all.mjs --v5` (banque v5, montage et habillage v4, effets, mastering, essais AAC, planches) puis `node tools/audio/mux-ours-v5.mjs` (films). `--v4` reste identique (sommes de contrôle de `mix-v4*.wav` inchangées après reconstruction).
- Fichiers : `tools/audio/sfx-cues-v5.json` (liste), `tools/audio/build-sfx-v5.mjs` (placement, mesure, `--calibrer`), `build-mix.mjs --v5`, `planche-v5.py`, `mux-ours-v5.mjs` ; pistes `qa/mix-v5.wav`, `qa/mix-v5-musique.wav`, `qa/mix-v5-habillage.wav`, `qa/mix-v5-effets.wav` (même gain commun, leur somme = le mix) ; films `livraison/LKDV-ours-v5.mp4` et `-mobile.mp4`.

## Règles de placement et de niveau

- Son ponctuel : le pic du fichier (maximum de l'énergie sur 5 ms) tombe **au milieu de l'image où l'on voit le geste**. Ambiance : commence sur la coupe de son plan, s'arrête sur la coupe suivante (fondu fini sur la coupe). Whoosh de raccord : s'éteint sur la coupe. Aucun son ne commence avant la coupe de son plan (tête rognée si besoin).
- Chaque effet : passe-haut 70–120 Hz (45 Hz pour les deux chocs de pied), fondus de quelques ms, passe-bas 18 kHz (deux passes) sur toute la piste. Gestes au centre ; ambiances en paire gauche/droite décorrélée (largeur 0,6 à 0,9).
- Niveau « sous la musique » : pondération K, même fenêtre sur la piste effets (chaque son seul) et sur la musique : 400 ms centrées sur le pic d'un son ponctuel, toute la durée posée d'une ambiance ou d'un whoosh. Les gains sont calculés une fois (`--calibrer`) puis figés dans le JSON.
- **Plafond de crête** : aucun effet ne dépasse −1 dBFS avant le gain commun (−5,8 dB). Il a fallu le poser : visés à 7 dB sous la musique, les trois accents très courts (clac, pied, réception) montaient la crête vraie du mix à +0,2 dBTP. Ils sont donc à 12,4 à 14,5 dB sous la musique sur 400 ms. Sur 50 ms autour du pic, le clac est à −3,6 dB de la musique, la réception à −4,9 dB et le pied sur la pierre à −9,6 dB (il tombe sur une grosse caisse du drop 2).

## Les effets, section par section

Image = image du film où l'on voit la cause ; pic = image mesurée du pic du son posé. Gain = gain du fichier (crête à −3 dBFS) avant le gain commun.

| Section | Id | Plan | Image | Pic / étendue | Fichier | Gain (dB) | Sous la musique : visé / obtenu (dB) | Ce que ça apporte, raison du calage |
|---|---|---|---|---|---|---|---|---|
| cosmos | R01 | COSMOS→P06 | 126 | 104–126 | whoosh-doux-a | −4,8 | 12 / 12 | La plongée finit sur la fenêtre : souffle descendant éteint sur la coupe |
| déclic | M01 | P06–P09 | 126 | 126–252 | pluie-interieur-g/d | −11,3 | 16 / 16 | Soir de pluie, intérieur feutré ; coupée net sur le lac (P10) |
| déclic | G01 | P09 | 243 | 243,50 | tap-pouce-a | −0,6 | 14 / 14 | Le pouce se pose, la photo du lac apparaît (fondu n°81 de p07) |
| décision | M02 | P11 | 294 | 294–315 | pluie-interieur-g/d | −9,9 | 18 / 18 | Retour dans la chambre, elle se lève devant la vitre |
| décision | G02 | P12 | 322 | 322,56 | tap-pouce-b | +2,1 | 14 / 14 | L'index touche l'écran (fondu E02a → E02b, n°31 de p12) |
| décision | G03 | P17 | 430 | 430,50 | tap-pouce-c | +2,0 | 13 / 13 | « Commander » : appui le plus marqué n°26 de p17 = dernière image du plan |
| décision | M03 | P18 | 431 | 431–452 | papier-carton | −4,5 | 13 / 13 | Le sac sort du carton et du papier de soie |
| départ | G04 | P20 | 472 | 472,50 | clac-boucle-c | +2,1 | 7 / 12,4 (plafond) | **Clac** : les moitiés se rejoignent entre 471 (flou, plus forte différence d'image) et 472 (fermée) |
| départ | M04 | P21 | 478 | 478,50 (+ 2e pas ≈ 489) | pas-escalier-a | −5,7 | 15 / 15 | Pas dans la cage d'escalier, en contretemps (pieds invisibles en plongée) |
| départ | M06 | P22 | 494 | 494–515 | rails-train | −1,9 | 16 / 16 | Le train : roulement et un choc de bogie |
| départ | M07 | P23 | 515 | 515–541 | souffle-b | −9,2 | 17 / 17 | Buée de respiration visible dans l'air froid (515–523), sans voix |
| départ | M08 | P24 | 565 | 565,50 | pas-sentier-a (1er pas) | 0,0 | 12 / 12 | Le talon se pose sur le sentier, poussière |
| montagne | M09 | P26–P27 | 592 | 592–673 | vent-crete-g/d | −11,9 | 20 / 20 | Vent d'altitude sous le drop (texture) |
| montagne | M10 | P30 | 715 | 715–757 | vent-crete-g/d | −10,8 | 20 / 20 | Grand plan du lac de Sorapis |
| montagne | R02 | P32→P33 | 799 | 785–799 | whoosh-doux-b | −3,4 | 12 / 12 | Le coureur traverse le cadre, le souffle finit sur la coupe et le drop 2 |
| coureur | M11, M12 | P33 | 807, 816 | 807,50, 816,50 | pas-sentier-b, -a | −3,0, −1,5 | 16 / 16 | Foulées : pied droit (807), pied gauche (816) au contact du sentier |
| coureur | G05 | P34 | 820 | 820,50 | appui-pierre | +1,6 | 7 / 12,7 (plafond) | **Pied sur la pierre** : posé dès la 1re image du plan (820, temps à 819,9) |
| coureur | M13 | P34 | 826 | 826,50 | gravillons-b | −4,1 | 14 / 14 | La poussée : gerbe de cailloux (825–829) |
| coureur | M14 | P35 | 832 | 832–854 | souffle-a | −6,8 | 17 / 17 | Une expiration du coureur de dos |
| coureur | M15 | P37 | 862 | 862–884 | torrent-g/d | −2,8 | 15 / 15 | L'eau du torrent sous le saut |
| coureur | M16 | P37 | 864 | 864,52 | eclaboussure-torrent | +0,3 | 12 / 13,1 (plafond) | Jet d'eau du pied arrière (862–866) |
| coureur | G06 | P37 | 866 | 866,50 | reception-rocher | +3,4 | 7 / 14,5 (plafond) | **Réception** : pied avant sur le rocher, n°13 de p37-2 (image 4 du plan) |
| coureur | M17 | P38 | 883 | 883–925 | vent-crete-d/g | −13,1 | 20 / 20 | Paroi en contre-plongée |
| cycliste | R03 | P39→P40 | 946 | 932–946 | whoosh-doux-c | −1,7 | 12 / 12 | Coureur et cycliste filent, puis le grand plan du lac |
| cycliste | G07 | P41 | 979 | 979,50 | gravillons-a | +0,7 | 9 / 11,5 (plafond) | La roue mord le gravier, gravillons dès la coupe |
| cycliste | M18 | P43 | 1020 | 1020–1051 | vent-crete-g/d | −8,3 | 20 / 20 | Grand plan de la route en lacets |
| bivouac | M19 | P46–P50 | 1093 | 1093–1261 | feu-bivouac-g/d | −2,7 (+3 sur P47–P49, −3 à −14 sur P50) | 12 / 12 | La nuit : le feu prend la place, plus près au feu, lointain sous la Voie lactée |
| bivouac | G08 | P49 | 1217 | 1217,50 | tap-pouce-a | 0,0 | 13 / 13 | Elle publie : n°28 de p48-2 (relâcher n°29 = 1218) |
| final | M20 | P51 | 1261 | 1261–1293 | pluie-interieur-d/g | −9,7 | 16 / 16 | Bus de nuit, vitre couverte de pluie |
| final | R04 | P51→P52 | 1293 | 1267–1293 | whoosh-doux-d | −6,9 | 12 / 12 | La remontée : souffle montant éteint sur la coupe |

Habillage v4 conservé tel quel : souffle-cosmos (0–1,33 s), impact-soleil (image 32), impact-logo (pic mesuré 57,818 s = image 1387,64 ; le logo apparaît à 1387).

## Volontairement sans effet

- **P08 (l'œil), P10 (le lac), P13–P16, P19, P25** : la musique porte ; la pluie s'arrête net sur le lac pour que l'étincelle soit un silence d'ambiance, pas un son.
- **Drops (589–1093)** : pas de pas sur P26–P32, pas de déclic photo sur P31 (il tombait dans la respiration en v2, il tombe ici dans le drop), rien sur P28, P29, P36, P39, P40, P42, P45. Seuls passent les accents P34, P37, P41, plus des vents à 20 dB sous la musique, qui ne seront probablement pas entendus pendant le drop (texture assumée).
- **Rires (P23, P47) et cri de joie (P44)** : il faudrait une vraie voix enregistrée (CC0) ; la banque n'en a pas, je n'ai rien téléchargé et un rire synthétisé sonnerait faux. P23 reçoit seulement la buée de respiration. **Aucune voix dans le mix** (aucun fichier de la banque n'est une voix).
- **P53 → logo** : rien, le roulement de la musique et le coup d'habillage font le travail. **Pas de sonnette** (son tonal synthétisé, hors de l'intention « mat, jamais un bip »).

## Mesures (FFmpeg 6.0)

- `qa/mix-v5.wav` : pcm_s24le, 48 000 Hz, stéréo, 2 880 000 échantillons = 60,000 s. EBU R128 : **−14,0 LUFS**, LRA 5,9 LU (v4 : 6,1), **crête vraie −1,7 dBTP** (v4 : −2,0). Gain commun −5,8 dB (v4 : −5,7).
- Essais AAC (`-aac_pns 0`) décodés et mesurés : **320 kb/s −14,0 LUFS, −1,7 dBTP** ; **192 kb/s −14,1 LUFS, −1,9 dBTP**.
- Pistes : musique −14,1 LUFS (v4 : −13,9 ; **−0,1 dB** par section, −0,19 dB sur « départ » à cause du creux), habillage −29,1 LUFS, **effets seuls −28,9 LUFS** (crête vraie −6,4 dBTP).
- Écart musique − effets par section (pondération K, énergie moyenne sur la section) : cosmos 18,4 · déclic 17,4 · décision 18,8 · départ 17,2 · montagne 19,9 · coureur-cycliste 16,9 · bivouac 11,8 · final 17,3 dB · logo : aucun effet. Moyenne pondérée par la durée ≈ 17 dB.
- Calage : les 14 sons ponctuels ont leur pic au milieu de leur image (écart 0,00 à +0,06 image) ; coup du logo +0,14 image.
- Reconstruction : `build-all.mjs --v5` lancé deux fois, MD5 identiques des 4 pistes, du JSON et de la banque (`qa/tmp/sums-v5-*.txt`). `--v4` reconstruit `mix-v4*.wav` à l'identique.
- Films (`qa/tmp/ours-v5.json`) : `LKDV-ours-v5.mp4` 1 440 images, image 60,000 s, son 60,000 s, conteneur 60,000 s, AAC 322 kb/s, 167,3 Mo, −14,0 LUFS, −1,7 dBTP ; `LKDV-ours-v5-mobile.mp4` 1 440 images, 60,000 / 60,000 / 60,000 s, AAC 194 kb/s, **27,24 Mo**, −14,1 LUFS, −1,9 dBTP. Flux image identique octet pour octet aux ours v4 (MD5 du flux copié).
- Planches regardées : `qa/snapshots/son-v5/film-60s.png` (trois pistes empilées, forme d'onde et spectrogramme, sections, nom de chaque effet) et `accents.png` (clac, pied, réception, logo : image du film au geste et forme d'onde, une graduation par image).

## Cinq moments à faire écouter à Tony

1. **4,4–5,6 s** (fin de la plongée → fenêtre) : le whoosh descendant est-il doux, la pluie entre-t-elle comme une vraie pluie derrière une vitre (et pas comme un souffle de radio) ?
2. **19,4–20,6 s** (P20 → P21) : le clac de la boucle à 19,688 s. Est-il net, plastique, crédible (synthétisé, pas une prise réelle) ? Il est plafonné à 12 dB sous la musique : assez présent pour être l'accent du film ?
3. **24,2–25,0 s** (P25 → Seceda) : le creux de −4 dB juste avant le drop 1. Se ressent-il comme une inspiration, ou comme un trou ?
4. **33,9–36,8 s** (P34 → P37) : le pied sur la pierre à 34,188 s tombe sur une grosse caisse et pourrait être masqué ; la réception à 36,104 s et le torrent. Lisibles ou noyés ? Pas « bande-annonce » ?
5. **45,4–52,6 s** (bivouac) : le feu prend-il la place de la musique sans faire friture ? Le tap de publication à 50,729 s est-il discret et mat ? Le feu s'éloigne-t-il sur la Voie lactée ?

## Fragile, non jugé

- Tout est mesuré, rien n'est écouté. Les timbres reposent sur des modèles physiques simples (bruit filtré, résonances, enveloppes) et sur trois prises réelles Kenney CC0. Sans écoute, je ne peux pas dire s'ils sonnent vrais. Les plus à risque sont le clac et le papier, entièrement synthétisés, et la pluie et le feu, faits de grains de bruit.
- Les accents sont plus bas que visé (plafond de crête). Si Tony les veut plus forts, il faudra soit un léger retrait de la musique sous chacun (40 à 100 ms), soit accepter une crête vraie plus près de −1 dBTP.
- Les pas de P21 et les foulées de P33 sont calés sur des images où les pieds sont petits ou flous (P21 : invisibles).
- **Licence de STORM II** (titre commercial) : une licence de synchronisation reste à obtenir avant toute diffusion publique.
