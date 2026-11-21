# Ours v3 — premier montage complet à 24 i/s

Généré par `node tools/montage/build-ours.mjs montage/edl-ours-v3.json` puis `python3 tools/montage/controle-ours.py` (ce fichier est réécrit à chaque contrôle). Montage de travail : pas d'étalonnage, écrans verts non incrustés, son = `qa/mix-v4.wav` tel quel.

- Film : `livraison/LKDV-ours-v3.mp4` · relecture avec repères : `livraison/LKDV-ours-v3-reperes.mp4` (non versionnés)
- Planches : `qa/snapshots/ours-v3/` (coupes-1.jpg, coupes-2.jpg, coupes-3.jpg, coupes-4.jpg, coupes-5.jpg, film.jpg)

## Plans

| Plan | Section | Images du film | Durée | Source | Images sources | Vitesse | Remarque |
|---|---|---|---|---|---|---|---|
| COSMOS | cosmos | 0–125 | 126 im · 5,250 s | `ouverture-lab/renders/ouverture-v3.mp4` | 0–125 | 1 |  |
| P06 | declic | 126–188 | 63 im · 2,625 s | `flow/clips/plans/p06.mp4` | 8–70 | 1 |  |
| P07 | declic | 189–230 | 42 im · 1,750 s | `flow/clips/incrustes/p07.mp4` | 8–49 | 1 |  |
| P08 | declic | 231–241 | 11 im · 0,458 s | `flow/clips/plans/p08.mp4` | 40–50 | 1 |  |
| P09 | declic | 242–251 | 10 im · 0,417 s | `flow/clips/incrustes/p07.mp4` | 80–89 | 1 | recadré ×1.3 centré (950, 540) |
| P10 | declic | 252–293 | 42 im · 1,750 s | `flow/clips/plans/p10.mp4` | 30–71 | 1 |  |
| P11 | decision | 294–314 | 21 im · 0,875 s | `flow/clips/plans/p11.mp4` | 2–22 | 1 |  |
| P12 | decision | 315–335 | 21 im · 0,875 s | `flow/clips/incrustes/p12.mp4` | 24–44 | 1 |  |
| P13 | decision | 336–356 | 21 im · 0,875 s | `flow/clips/incrustes/p13.mp4` | 20–40 | 1 |  |
| P14 | decision | 357–377 | 21 im · 0,875 s | `flow/clips/plans/p14.mp4` | 4–24 | 1 |  |
| P15 | decision | 378–388 | 11 im · 0,458 s | `flow/clips/incrustes/p13.mp4` | 98–108 | 1 | recadré ×1.3 centré (1080, 495) |
| P16 | decision | 389–419 | 31 im · 1,292 s | `flow/clips/incrustes/p16.mp4` | 8–38 | 1 |  |
| P17 | decision | 420–430 | 11 im · 0,458 s | `flow/clips/incrustes/p17.mp4` | 16–26 | 1 |  |
| P18 | decision | 431–451 | 21 im · 0,875 s | `flow/clips/plans/p18.mp4` | 17–37 | 1 |  |
| P19 | decision | 452–461 | 10 im · 0,417 s | `flow/clips/plans/p19.mp4` | 20–29 | 1 |  |
| P20 | depart | 462–472 | 11 im · 0,458 s | `flow/clips/plans/p20.mp4` | 13–23 | 1 |  |
| P21 | depart | 473–493 | 21 im · 0,875 s | `flow/clips/plans/p21.mp4` | 6–26 | 1 |  |
| P22 | depart | 494–514 | 21 im · 0,875 s | `flow/clips/plans/p22.mp4` | 36–56 | 1 |  |
| P23 | depart | 515–556 | 42 im · 1,750 s | `flow/clips/plans/p23.mp4` | 1–42 | 1 |  |
| P24 | depart | 557–577 | 21 im · 0,875 s | `flow/clips/plans/p24.mp4` | 4–24 | 1 |  |
| P25 | depart | 578–588 | 11 im · 0,458 s | `flow/clips/incrustes/p25.mp4` | 14–24 | 1 |  |
| P26 | montagne | 589–630 | 42 im · 1,750 s | `flow/clips/plans/p26-2.mp4` | 6–47 | 1 |  |
| P27 | montagne | 631–672 | 42 im · 1,750 s | `flow/clips/plans/p27.mp4` | 72–113 | 1 |  |
| P28 | montagne | 673–693 | 21 im · 0,875 s | `flow/clips/plans/p28-2.mp4` | 32–52 | 1 |  |
| P29 | montagne | 694–714 | 21 im · 0,875 s | `flow/clips/incrustes/p29.mp4` | 20–40 | 1 |  |
| P30 | montagne | 715–756 | 42 im · 1,750 s | `flow/clips/plans/p30-2.mp4` | 28–69 | 1 |  |
| P31 | montagne | 757–777 | 21 im · 0,875 s | `flow/clips/incrustes/p31.mp4` | 45–65 | 1 |  |
| P32 | montagne | 778–798 | 21 im · 0,875 s | `flow/clips/plans/p32.mp4` | 1–21 | 1 |  |
| P33 | coureur-cycliste | 799–819 | 21 im · 0,875 s | `flow/clips/plans/p33.mp4` | 6–26 | 1 |  |
| P34 | coureur-cycliste | 820–829 | 10 im · 0,417 s | `flow/clips/plans/p34.mp4` | 40–49 | 1 |  |
| P35 | coureur-cycliste | 830–850 | 21 im · 0,875 s | `flow/clips/plans/p35.mp4` | 4–24 | 1 |  |
| P36 | coureur-cycliste | 851–861 | 11 im · 0,458 s | `flow/clips/incrustes/p36.mp4` | 1–11 | 1 |  |
| P37 | coureur-cycliste | 862–882 | 21 im · 0,875 s | `flow/clips/plans/p37-2.mp4` | 3–51 | ×2,400 | accéléré ×2.4 (49 images sources → 21, filtre framerate : mélange linéaire des deux images voisines) |
| P38 | coureur-cycliste | 883–924 | 42 im · 1,750 s | `flow/clips/plans/p38.mp4` | 12–53 | 1 |  |
| P39 | coureur-cycliste | 925–945 | 21 im · 0,875 s | `flow/clips/plans/p39.mp4` | 2–22 | 1 |  |
| P40 | coureur-cycliste | 946–977 | 32 im · 1,333 s | `flow/clips/plans/p40.mp4` | 72–103 | 1 |  |
| P41 | coureur-cycliste | 978–987 | 10 im · 0,417 s | `flow/clips/plans/p41-2.mp4` | 6–15 | 1 |  |
| P42 | coureur-cycliste | 988–1019 | 32 im · 1,333 s | `flow/clips/plans/p42.mp4` | 2–33 | 1 |  |
| P43 | coureur-cycliste | 1020–1050 | 31 im · 1,292 s | `flow/clips/plans/p43.mp4` | 12–42 | 1 |  |
| P44 | coureur-cycliste | 1051–1071 | 21 im · 0,875 s | `flow/clips/plans/p44.mp4` | 2–22 | 1 |  |
| P45 | coureur-cycliste | 1072–1092 | 21 im · 0,875 s | `flow/clips/plans/p45.mp4` | 8–28 | 1 |  |
| P46 | bivouac | 1093–1134 | 42 im · 1,750 s | `flow/clips/plans/p46.mp4` | 18–85 | ×1,620 | accéléré ×1.62 (68 images sources → 42, filtre framerate : mélange linéaire des deux images voisines) |
| P47 | bivouac | 1135–1176 | 42 im · 1,750 s | `flow/clips/plans/p47.mp4` | 1–42 | 1 |  |
| P48 | bivouac | 1177–1208 | 32 im · 1,333 s | `flow/clips/incrustes/p48-2.mp4` | 34–65 | 1 |  |
| P49 | bivouac | 1209–1218 | 10 im · 0,417 s | `flow/clips/incrustes/p48-2.mp4` | 20–29 | 1 | recadré ×1.45 centré (1180, 535) |
| P50 | bivouac | 1219–1260 | 42 im · 1,750 s | `flow/clips/plans/p50.mp4` | 12–115 | ×2,500 | accéléré ×2.5 (104 images sources → 42, filtre framerate : mélange linéaire des deux images voisines) |
| P51 | final | 1261–1292 | 32 im · 1,333 s | `flow/clips/incrustes/p51.mp4` | 12–43 | 1 |  |
| P52 | final | 1293–1334 | 42 im · 1,750 s | `qa/tmp/ours/codas-film-24.mp4 (film/compositions/p52.html)` | 1–42 | 1 | ancienne composition (105 images à 60 i/s, 42 à 24 i/s) recalée à 42 images, ×1.000 |
| P53 | final | 1335–1386 | 52 im · 2,167 s | `qa/tmp/ours/codas-film-24.mp4 (film/compositions/p53.html)` | 43–83 | ×0,784 | ancienne composition (104 images à 60 i/s, 41 à 24 i/s) recalée à 52 images, ×0.784 |
| P54 | logo | 1387–1439 | 53 im · 2,208 s | `qa/tmp/ours/codas-film-24.mp4 (film/compositions/p54.html)` | 84–131 | ×0,904 | ancienne composition (120 images à 60 i/s, 48 à 24 i/s) recalée à 53 images, ×0.904 |

## Provisoire

- Rien.

## Mesures

- ffprobe : 1440 images comptées, 24/1 i/s, 1920×1080, h264 yuv420p ; durée vidéo 60,000 s, durée son 60,000 s (aac 48000 Hz 317 kb/s), conteneur 60,000 s.
- Coupes : 48 sur 49 détectées à l'image attendue (pic de différence entre images à ±3 images).
  - P52 → P53 (image 1335) : pic à l'image 1332, différence 1,5, rapport 0,5 au voisinage
- Images doublées aux coupes (première image du plan = dernière du précédent) : 0.
- Images gelées à l'intérieur des plans : aucune.
- Sauts francs à l'intérieur des plans : aucun.
- blackdetect (0,04 s, seuil 0,10) : aucune plage noire.
- ebur128 : -14,0 LUFS intégré, LRA 6,0 LU, crête vraie -2,0 dBTP.
- Planches : coupes-1.jpg 382 Ko, coupes-2.jpg 399 Ko, coupes-3.jpg 360 Ko, coupes-4.jpg 381 Ko, coupes-5.jpg 39 Ko, film.jpg 378 Ko.

## Incrustation et copie d'envoi (ajouté après le contrôle)

- Les 14 plans à téléphone lisent `flow/clips/incrustes/` (vraies captures de l'app, détail et preuves : `qa/INCRUSTATION-VIDEO.md`). P09, P15 et P49 sont recadrés (×1,3 ; ×1,3 ; ×1,45) pour ne plus sauter sur place après le plan qui reprend leur cadre.
- Copie d'envoi : `livraison/LKDV-ours-v3-mobile.mp4`, 1920×1080, H.264 (CRF 19, débit plafonné à 3,4 Mb/s, mesuré à 3,44 Mb/s), AAC 192 kb/s, 1440 images, 27,3 Mo.
