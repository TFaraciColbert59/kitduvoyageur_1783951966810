# Inventaire des vidéos Flow (Omni Flash 1.2)

Généré par `tools/flow/inventaire.py` le 2026-11-14T15:32:43 à partir de `flow/clips/` (52 fichiers). Mesures complètes : `flow/inventaire.json`. Planches : `qa/snapshots/flow/pNN.jpg`. Copies exactes par plan : `flow/clips/plans/`.

**52 fichiers, 50 prises uniques, 43 fiches couvertes sur 43.**

Écarts : moyenne des écarts absolus RGB (0-255). Identification sur 64×36 (deuxième critère : corrélation normalisée de la luminance) ; mouvement, fidélité et dérive sur 160×90. Seuils indicatifs : figée si mouvement médian < 0.5, quasi figée < 1.0, ralenti probable si < 1.5 avec variation faible (cv < 0.35).

## Tableau par plan

| Plan | Fichier d'origine | Prise | Durée (demandée) | Cadence | Images | Taille | Source · écart (2e · marge) | Mouv. méd. | Alertes |
|---|---|---|---|---|---|---|---|---|---|
| P06 | `Woman_holding_phone_on_window_a23f9f45_1080p.mp4` | p06 | 3.92 s (4 s) | 24/1 | 94 | 1920×1080 | img06 · 3.05 (img10 17.57 · 14.52) | 1.474 | ralenti probable (mouvement faible et constant) |
| P07 + P09 | `Hands_holding_phone_by_window_aa76efce_1080p.mp4` | p07 | 3.92 s (4 s) | 24/1 | 94 | 1920×1080 | img07 · 3.98 (img08 41.12 · 37.14) | 1.326 | ralenti probable (mouvement faible et constant) |
| P08 | `Woman_eye_reflecting_lake_abc00439_1080p.mp4` | p08 | 3.00 s (3 s) | 24/1 | 72 | 1920×1080 | img08 · 2.78 (img05 32.09 · 29.31) | 1.434 | — |
| P10 | `Drone_flying_over_alpine_lake_9b0b6d2f_1080p.mp4` | p10 | 4.96 s (5 s) | 24/1 | 119 | 1920×1080 | img09 · 2.91 (img22 26.03 · 23.11) | 4.377 | — |
| P11 | `Woman_springing_up_from_seat_28b46d69_1080p.mp4` | p11 | 3.00 s (3 s) | 24/1 | 72 | 1920×1080 | img10 · 3.62 (img06 17.36 · 13.74) | 5.328 | — |
| P12 | `Woman_swipes_phone_screen_e893da55_1080p.mp4` | p12 | 3.00 s (3 s) | 24/1 | 72 | 1920×1080 | img40 · 3.35 (img08 40.88 · 37.53) | 2.042 | — |
| P13 + P15 | `Woman_holding_phone_c77f4cea_1080p.mp4` | p13 | 4.96 s (5 s) | 24/1 | 119 | 1920×1080 | img41 · 3.38 (img08 39.76 · 36.37) | 0.983 | quasi figée |
| P14 | `Three_people_reacting_to_phones_143183e6_1080p.mp4` | p14 | 3.00 s (3 s) | 24/1 | 72 | 1920×1080 | img11 · 3.29 (img32 44.51 · 41.22) | 2.019 | — |
| P16 | `Woman_smiling_on_bed_77bcad1b_1080p.mp4` | p16 | 3.92 s (4 s) | 24/1 | 94 | 1920×1080 | img42 · 2.86 (img26 44.8 · 41.94) | 2.243 | — |
| P17 | `Hands_holding_green_screen_phone_ff9180f8_1080p.mp4` | p17 | 3.00 s (3 s) | 24/1 | 72 | 1920×1080 | img43 (manuelle ; auto img32 55.09) | 0.65 | quasi figée<br>identification manuelle (img43)<br>la première image ne ressemble à aucune image source (écart auto 55, img43 à 73) ; contenu de la fiche P17 (macro, pouce qui appuie sur un écran vert, manche crème, taches de rousseur) mais cadrage différent de img43 (téléphone en bas, pouce venant du haut) ; vu à l'œil : tache blanchâtre sur le vert après l'appui (dès n°32) |
| P18 | `Woman_lifts_backpack_from_box_f377e9f4_1080p.mp4` | p18 | 3.92 s (4 s) | 24/1 | 94 | 1920×1080 | img44 · 2.61 (img17 48.17 · 45.56) | 5.135 | — |
| P19 | `Woman_packing_camping_gear_c89c0eb0_1080p.mp4` | p19 | 3.00 s (3 s) | 24/1 | 72 | 1920×1080 | img12 · 2.53 (img47 49.07 · 46.54) | 2.014 | — |
| P20 | `Hands_fastening_backpack_hip-bel…_631b2fb3_1080p.mp4` | p20 | 3.00 s (3 s) | 24/1 | 72 | 1920×1080 | img13 · 3.56 (img35b 40.05 · 36.48) | 3.734 | — |
| P21 | `Woman_running_down_spiral_staircase_555252ef_1080p.mp4` | p21 | 3.00 s (3 s) | 24/1 | 72 | 1920×1080 | img14 · 2.49 (img05 37.88 · 35.39) | 8.34 | — |
| P22 | `Woman_looking_out_train_window_5046a109_1080p.mp4` | p22 | 3.00 s (3 s) | 24/1 | 72 | 1920×1080 | img15 · 2.86 (img19 31.7 · 28.84) | 2.222 | — |
| P23 | `Hikers_preparing_on_mountain_trail_800873a4_1080p.mp4` | p23 | 3.92 s (4 s) | 24/1 | 94 | 1920×1080 | img16 · 3.41 (img47 38.49 · 35.08) | 2.89 | — |
| P24 | `Hikers_walking_on_mountain_trail_d8b87178_1080p.mp4` | p24 | 3.00 s (3 s) | 24/1 | 72 | 1920×1080 | img17 · 3.0 (img14 39.3 · 36.3) | 9.102 | — |
| P25 | `Woman_breathing_on_mountain_trail_b57690b0_1080p.mp4` | p25 | 3.00 s (3 s) | 24/1 | 72 | 1920×1080 | img18 · 3.35 (img14 40.5 · 37.15) | 1.589 | — |
| P26 | `Hikers_walking_alpine_ridge_900332ee_720p.mp4` | p26 | 5.96 s (5 s) | 24/1 | 143 | 1280×720 | img45 · 5.46 (img15 35.7 · 30.24) | 1.251 | taille 1280×720<br>durée 5.96 s pour 5 s demandées<br>ralenti probable (mouvement faible et constant) |
| P26 | `Four_hikers_walking_alpine_ridge_9785cb08_1080p.mp4` | p26-2 | 3.00 s (5 s) | 24/1 | 72 | 1920×1080 | img45 · 2.79 (img15 35.64 · 32.85) | 1.109 | durée 3.00 s pour 5 s demandées<br>ralenti probable (mouvement faible et constant) |
| P27 | `Hikers_walking_up_ridge_path_a3cffb9b_1080p.mp4` | p27 | 4.96 s (5 s) | 24/1 | 119 | 1920×1080 | img19 · 2.88 (img15 31.36 · 28.48) | 1.458 | ralenti probable (mouvement faible et constant) |
| P28 | `Man_pulls_woman_onto_summit_608a3332_1080p.mp4` | p28 | 3.92 s (4 s) | 24/1 | 94 | 1920×1080 | img20 · 17.02 (img24 48.2 · 31.18) | 8.015 | identification à vérifier (écart 17.02, marge 31.18)<br>première image retouchée par Flow par rapport à img20 (ciel bleu au lieu de rose, tours plus proches) : même scène, même cadrage |
| P28 | `Man_pulls_woman_onto_rock_d170dd14_1080p.mp4` | p28-2 | 4.96 s (4 s) | 24/1 | 119 | 1920×1080 | img20 · 17.05 (img24 48.59 · 31.54) | 6.468 | durée 4.96 s pour 4 s demandées<br>identification à vérifier (écart 17.05, marge 31.54) |
| P29 | `Woman_looking_at_rock_towers_2b710b8e_1080p.mp4` | p29 | 3.92 s (3 s) | 24/1 | 94 | 1920×1080 | img46 · 2.74 (img19 45.69 · 42.95) | 2.003 | durée 3.92 s pour 3 s demandées |
| P30 | `Drone_flying_over_alpine_lake_170193d3_1080p.mp4` | p30 | 3.00 s (5 s) | 24/1 | 72 | 1920×1080 | img09b · 3.07 (img09 32.33 · 29.26) | 1.881 | durée 3.00 s pour 5 s demandées<br>part de img09b (Sorapis, fiche P30) alors que le nom Flow évoque le survol en drone de la fiche P10 (img09) : probablement le prompt P10 lancé avec la mauvaise image ; P10 reste sans vidéo |
| P30 | `Woman_photographing_turquoise_mo…_5285fd95_1080p.mp4` | p30-2 | 4.96 s (5 s) | 24/1 | 119 | 1920×1080 | img09b · 3.36 (img09 32.59 · 29.23) | 1.241 | ralenti probable (mouvement faible et constant) |
| P31 | `Woman_taking_photo_of_lake_2a9c0b5c_1080p.mp4` | p31 | 4.96 s (3 s) | 24/1 | 119 | 1920×1080 | img22 · 2.96 (img09 25.41 · 22.45) | 2.743 | durée 4.96 s pour 3 s demandées<br>écran vert : surface verte gonflée (max 1.47 %) ; surface instable (0.44–1.47 %)<br>vu à l'œil : la hausse de surface verte vient de la poussée vers le téléphone, écran vert intact sur les 12 images |
| P32 | `Trail_runner_sprinting_past_hikers_db364b40_1080p.mp4` | p32 | 3.00 s (3 s) | 24/1 | 72 | 1920×1080 | img23 · 3.9 (img15 44.04 · 40.14) | 9.319 | — |
| P33 | `Trail_runner_running_along_cliff_f695a63c_1080p.mp4` | p33 | 3.00 s (3 s) | 24/1 | 72 | 1920×1080 | img24 · 3.34 (img31 41.35 · 38.01) | 14.174 | — |
| P34 | `Running_shoe_striking_limestone_…_8c245cd6_1080p.mp4` | p34 | 3.00 s (3 s) | 24/1 | 72 | 1920×1080 | img25 · 3.9 (img47 37.91 · 34.02) | 5.027 | — |
| P35 | `Trail_runner_descending_rocky_trail_a24c3789_1080p.mp4` | p35 | 3.00 s (3 s) | 24/1 | 72 | 1920×1080 | img26 · 3.49 (img47 35.07 · 31.58) | 16.203 | — |
| P36 | `Runner_exercising_with_phone_arm…_b8b1282b_1080p.mp4` | p36 | 3.00 s (3 s) | 24/1 | 72 | 1920×1080 | img27 · 3.73 (img28 46.22 · 42.49) | 17.175 | — |
| P37 | `Runner_leaping_over_stream_11b7d836_1080p.mp4` | p37 | 3.00 s (3 s) | 24/1 | 72 | 1920×1080 | img28 · 3.54 (img05 36.85 · 33.31) | 6.5 | — |
| P37 | `Trail_runner_leaping_over_stream_ae03725c_1080p.mp4` | p37-2 | 4.96 s (3 s) | 24/1 | 119 | 1920×1080 | img28 · 4.21 (img05 36.66 · 32.45) | 1.214 | durée 4.96 s pour 3 s demandées |
| P38 | `Runner_traversing_rock_wall_734fcd6c_1080p.mp4` | p38 | 4.96 s (5 s) | 24/1 | 119 | 1920×1080 | img47 · 2.97 (img26 34.68 · 31.71) | 1.698 | — |
| P39 | `Runner_and_cyclist_waving_on_087151f3_1080p.mp4` | p39 | 4.96 s (3 s) | 24/1 | 119 | 1920×1080 | img29 · 3.17 (img15 42.17 · 39.0) | 15.008 | durée 4.96 s pour 3 s demandées |
| P40 | `Cyclist_riding_along_alpine_lake_576192f6_1080p.mp4` | p40 | 4.96 s (5 s) | 24/1 | 119 | 1920×1080 | img30 · 3.66 (img48 44.86 · 41.2) | 5.867 | — |
| P41 | `Gravel_bike_rolling_on_stones_cdf2281b_1080p.mp4` | p41 | 3.00 s (3 s) | 24/1 | 72 | 1920×1080 | img31 · 3.85 (img17 40.11 · 36.27) | 11.871 | — |
| P41 | `Gravel_bike_rolling_on_stones_144f0e4c_1080p.mp4` | p41-2 | 3.00 s (3 s) | 24/1 | 72 | 1920×1080 | img31 · 3.93 (img17 40.29 · 36.36) | 12.683 | — |
| P42 | `Cyclist_riding_on_gravel_track_45515989_1080p.mp4` | p42 | 4.96 s (5 s) | 24/1 | 119 | 1920×1080 | img32 · 3.86 (img05 42.87 · 39.01) | 9.049 | — |
| P43 | `Cyclist_riding_on_mountain_road_f42adae3_1080p.mp4` | p43 | 4.96 s (5 s) | 24/1 | 119 | 1920×1080 | img48 · 3.44 (img34 38.17 · 34.73) | 3.187 | — |
| P44 | `Woman_riding_gravel_bike_3a8aa9cf_1080p.mp4` | p44 | 4.96 s (4 s) | 24/1 | 119 | 1920×1080 | img33 · 2.6 (img15 35.71 · 33.11) | 1.159 | durée 4.96 s pour 4 s demandées |
| P45 | `Woman_riding_bicycle_past_campers_9e3f9d40_1080p.mp4` | p45 | 3.92 s (3 s) | 24/1 | 94 | 1920×1080 | img34 · 3.87 (img15 35.43 · 31.56) | 6.531 | durée 3.92 s pour 3 s demandées |
| P46 | `Friends_camping_under_starry_sky_7604b3b1_1080p.mp4` | p46 | 4.96 s (5 s) | 24/1 | 119 | 1920×1080 | img35a · 4.13 (img34 42.28 · 38.14) | 0.704 | quasi figée<br>vu à l'œil : plan fixe en accéléré attendu (nuit qui tombe), finit sur img35b |
| P47 | `Four_friends_sitting_around_camp…_92688ac1_1080p.mp4` | p47 | 3.00 s (4 s) | 24/1 | 72 | 1920×1080 | img36 · 3.89 (img35b 33.09 · 29.2) | 5.199 | durée 3.00 s pour 4 s demandées |
| P48 + P49 | `Woman_using_phone_at_night_f676d63f_1080p.mp4` | p48 | 3.00 s (5 s) | 24/1 | 72 | 1920×1080 | img37 · 13.64 (img35b 28.56 · 14.93) | 1.585 | durée 3.00 s pour 5 s demandées<br>identification à vérifier (écart 13.64, marge 14.93)<br>première image retouchée par Flow par rapport à img37 (bonnet et couverture ajoutés) : même scène, même cadrage |
| P48 + P49 | `Woman_smiling_at_phone_screen_eeb53a19_1080p.mp4` | p48-2 | 4.96 s (5 s) | 24/1 | 119 | 1920×1080 | img37 · 13.65 (img35b 28.67 · 15.02) | 2.095 | identification à vérifier (écart 13.65, marge 15.02) |
| P50 | `People_camping_beneath_Milky_Way_0bd00ac2_1080p.mp4` | p50 | 5.96 s (5 s) | 24/1 | 143 | 1920×1080 | img49 · 4.44 (img39 12.73 · 8.29) | 0.395 | durée 5.96 s pour 5 s demandées<br>figée<br>vu à l'œil : recul très lent sur une image très sombre (luminance 15), le campement rapetisse un peu ; « figée » vient surtout de l'obscurité |
| P51 | `Young_man_staring_at_phone_a2e24403_1080p.mp4` | p51 | 5.96 s (4 s) | 24/1 | 143 | 1920×1080 | img38 · 4.71 (img35b 29.43 · 24.73) | 2.761 | durée 5.96 s pour 4 s demandées<br>écran vert : surface verte gonflée (max 3.08 %) ; surface instable (1.01–3.08 %)<br>vu à l'œil : la hausse de surface verte vient de la poussée, écran vert intact sur les 12 images |
| hors feuille | `Hands_holding_phone_with_green_a5e92ac5_1080p.mp4` | — | 3.00 s (—) | 24/1 | 72 | 1920×1080 | — · 55.44 (img38 55.76 · 0.32) | 1.048 | aucune image source reconnue (plus proche img32, écart 55.44) |

## Plans manquants

- aucun

## Fichiers en trop (aucune fiche)

- `Hands_holding_phone_with_green_a5e92ac5_1080p.mp4` (plus proche : img32, écart 55.44)

## Doublons exacts (même md5, pas de copie)

- `Drone_flying_over_alpine_lake_170193d3_1080p (1).mp4` = `Drone_flying_over_alpine_lake_170193d3_1080p.mp4` (md5 4cd2586d9c31286ec95da0b8f5b5832e)
- `Runner_traversing_rock_wall_734fcd6c_1080p (1).mp4` = `Runner_traversing_rock_wall_734fcd6c_1080p.mp4` (md5 0d88a3a5fec8e99fcb524d5e0edf7179)

## Plusieurs prises

- **P26** : p26 = `Hikers_walking_alpine_ridge_900332ee_720p.mp4` (09:18:42, 5.96 s) ; p26-2 = `Four_hikers_walking_alpine_ridge_9785cb08_1080p.mp4` (10:11:36, 3.00 s)
- **P28** : p28 = `Man_pulls_woman_onto_summit_608a3332_1080p.mp4` (10:11:16, 3.92 s) ; p28-2 = `Man_pulls_woman_onto_rock_d170dd14_1080p.mp4` (14:59:10, 4.96 s)
- **P30** : p30 = `Drone_flying_over_alpine_lake_170193d3_1080p.mp4` (09:40:49, 3.00 s) ; p30-2 = `Woman_photographing_turquoise_mo…_5285fd95_1080p.mp4` (10:11:22, 4.96 s)
- **P37** : p37 = `Runner_leaping_over_stream_11b7d836_1080p.mp4` (10:09:49, 3.00 s) ; p37-2 = `Trail_runner_leaping_over_stream_ae03725c_1080p.mp4` (14:59:27, 4.96 s)
- **P41** : p41 = `Gravel_bike_rolling_on_stones_cdf2281b_1080p.mp4` (10:08:29, 3.00 s) ; p41-2 = `Gravel_bike_rolling_on_stones_144f0e4c_1080p.mp4` (10:09:28, 3.00 s)
- **P48** : p48 = `Woman_using_phone_at_night_f676d63f_1080p.mp4` (10:08:38, 3.00 s) ; p48-2 = `Woman_smiling_at_phone_screen_eeb53a19_1080p.mp4` (14:59:15, 4.96 s)

## Alertes techniques

**Cadence ≠ 24 i/s** (0)

- aucune

**Taille ≠ 1920×1080** (1)

- p26 — `Hikers_walking_alpine_ridge_900332ee_720p.mp4` : 1280×720

**Durée ≠ durée demandée (tolérance ±0,25 s)** (14)

- p26 — `Hikers_walking_alpine_ridge_900332ee_720p.mp4` : 5.96 s pour 5 s
- p26-2 — `Four_hikers_walking_alpine_ridge_9785cb08_1080p.mp4` : 3.00 s pour 5 s
- p28-2 — `Man_pulls_woman_onto_rock_d170dd14_1080p.mp4` : 4.96 s pour 4 s
- p29 — `Woman_looking_at_rock_towers_2b710b8e_1080p.mp4` : 3.92 s pour 3 s
- p30 — `Drone_flying_over_alpine_lake_170193d3_1080p.mp4` : 3.00 s pour 5 s
- p31 — `Woman_taking_photo_of_lake_2a9c0b5c_1080p.mp4` : 4.96 s pour 3 s
- p37-2 — `Trail_runner_leaping_over_stream_ae03725c_1080p.mp4` : 4.96 s pour 3 s
- p39 — `Runner_and_cyclist_waving_on_087151f3_1080p.mp4` : 4.96 s pour 3 s
- p44 — `Woman_riding_gravel_bike_3a8aa9cf_1080p.mp4` : 4.96 s pour 4 s
- p45 — `Woman_riding_bicycle_past_campers_9e3f9d40_1080p.mp4` : 3.92 s pour 3 s
- p47 — `Four_friends_sitting_around_camp…_92688ac1_1080p.mp4` : 3.00 s pour 4 s
- p48 — `Woman_using_phone_at_night_f676d63f_1080p.mp4` : 3.00 s pour 5 s
- p50 — `People_camping_beneath_Milky_Way_0bd00ac2_1080p.mp4` : 5.96 s pour 5 s
- p51 — `Young_man_staring_at_phone_a2e24403_1080p.mp4` : 5.96 s pour 4 s

**Figées, quasi figées, ralentis probables** (10)

- p06 — `Woman_holding_phone_on_window_a23f9f45_1080p.mp4` : ralenti probable (mouvement faible et constant) (médiane 1.474, cv 0.224)
- p07 — `Hands_holding_phone_by_window_aa76efce_1080p.mp4` : ralenti probable (mouvement faible et constant) (médiane 1.326, cv 0.157)
- p13 — `Woman_holding_phone_c77f4cea_1080p.mp4` : quasi figée (médiane 0.983, cv 0.34)
- p17 — `Hands_holding_green_screen_phone_ff9180f8_1080p.mp4` : quasi figée (médiane 0.65, cv 0.825)
- p26 — `Hikers_walking_alpine_ridge_900332ee_720p.mp4` : ralenti probable (mouvement faible et constant) (médiane 1.251, cv 0.312)
- p26-2 — `Four_hikers_walking_alpine_ridge_9785cb08_1080p.mp4` : ralenti probable (mouvement faible et constant) (médiane 1.109, cv 0.334)
- p27 — `Hikers_walking_up_ridge_path_a3cffb9b_1080p.mp4` : ralenti probable (mouvement faible et constant) (médiane 1.458, cv 0.058)
- p30-2 — `Woman_photographing_turquoise_mo…_5285fd95_1080p.mp4` : ralenti probable (mouvement faible et constant) (médiane 1.241, cv 0.197)
- p46 — `Friends_camping_under_starry_sky_7604b3b1_1080p.mp4` : quasi figée (médiane 0.704, cv 0.626)
- p50 — `People_camping_beneath_Milky_Way_0bd00ac2_1080p.mp4` : figée (médiane 0.395, cv 0.236)

**Écrans verts abîmés** (2)

- p31 — `Woman_taking_photo_of_lake_2a9c0b5c_1080p.mp4` : surface verte gonflée (max 1.47 %) ; surface instable (0.44–1.47 %)
- p51 — `Young_man_staring_at_phone_a2e24403_1080p.mp4` : surface verte gonflée (max 3.08 %) ; surface instable (1.01–3.08 %)

## Écrans verts (12 images réparties)

| Plan | Source : surface % · non vert dans la boîte % | Vidéo : surface % min–max | Non vert dans la boîte % max | Alertes |
|---|---|---|---|---|
| p07 | 7.492 · 20.9 | 7.481–10.777 | 22.6 | — |
| p12 | 3.497 · 4.4 | 2.603–3.584 | 23.8 | — |
| p13 | 7.959 · 32.4 | 7.888–10.016 | 37.1 | — |
| p16 | 0.936 · 5.2 | 0.933–1.43 | 9.0 | — |
| p17 | 43.32 · 11.3 | 27.795–33.188 | 26.9 | — |
| p25 | 2.572 · 2.8 | 2.568–3.265 | 13.0 | — |
| p29 | 2.03 · 4.4 | 1.992–2.133 | 29.2 | — |
| p31 | 0.436 · 0.7 | 0.438–1.469 | 9.8 | surface verte gonflée (max 1.47 %) ; surface instable (0.44–1.47 %) |
| p36 | 4.724 · 9.4 | 4.632–5.057 | 11.8 | — |
| p48 | 3.447 · 31.5 | 2.756–3.2 | 42.8 | — |
| p48-2 | 3.447 · 31.5 | 2.819–3.274 | 41.1 | — |
| p51 | 1.013 · 50.3 | 1.007–3.083 | 51.1 | surface verte gonflée (max 3.08 %) ; surface instable (1.01–3.08 %) |

## Vérifications à l'œil

- Correspondances vérifiées côte à côte (source | 1re image | 2e candidate) : p06, p07, p11, p12, p13, p17, p22, p26, p27, p28, p29, p30, p30-2, p31, p36, p41-2, p46, p47, p48, p50, p51 (21 sur 45), dont toutes les douteuses (p17, p28, p48, p50) et les paires proches img07/img43, img40/img41, img35a/img35b/img49, img19/img46, img09/img09b/img22.
- Planches regardées en entier : p13, p17, p31, p46, p48, p50, p51 (lisibles, légendes et temps corrects).
- Les planches dépassent la limite de 350 Ko à qualité normale (grain du film) : qualité JPEG abaissée jusqu'à 20 pour certaines, encore lisibles.

## Son

Toutes les prises avec piste audio : aac 48000 Hz 2 canaux (50/50 prises).

