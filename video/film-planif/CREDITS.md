# Crédits et licences — « Rien oublié » (épisode 1)

À reprendre dans la description de la publication (TikTok, Reels, YouTube) :

> Imagerie satellite : Sentinel-2 cloudless — https://s2maps.eu par EOX IT Services GmbH (contient des données Copernicus Sentinel modifiées, 2016), CC BY 4.0. Tracé : © contributeurs OpenStreetMap (ODbL). Musique originale. Photos Wikimedia Commons : Pedro Szekely from Los Angeles, USA (CC BY-SA 2.0), Jason Hollinger (CC BY 2.0), Fredlyfish4 (CC BY-SA 4.0), Ryem Rafail (CC BY-SA 4.0), Alexis Alvarez (CC BY-SA 4.0), LBM1948 (CC BY-SA 4.0), Deensel (CC BY 2.0), Chad Madden chadmadden (CC0), Murray Foubister (CC BY-SA 2.0), Vian (CC BY-SA 4.0). Image du condor générée pour le film.

| Élément | Source | Licence |
|---|---|---|
| Globe et vue rapprochée du W (`assets/map/plongee.mp4`) | Sentinel-2 cloudless 2016, EOX (`s2cloudless_3857`), rendu propre (`tools/plongee/render.py`) | CC BY 4.0 : usage commercial permis avec crédit |
| Tracé du W et refuges (`assets/map/trace.json`) | OpenStreetMap, relation 2203617 « La Ruta del W » (72,1 km) ; refuges via Nominatim | ODbL : crédit « © contributeurs OpenStreetMap » |
| Image du condor, plan 03 (`assets/gen/`) | générée par ChatGPT d'après `PROMPT-CHATGPT.md` | image générée |
| Photos des plans 01, 02 et 04 à 13 (`assets/photos/`) | Wikimedia Commons, voir le tableau suivant | CC BY, CC BY-SA ou CC0 : usage commercial permis avec crédit |
| Musique (`audio/`) | composition originale, synthèse déterministe (`audio/src/compose.py`) | aucun droit tiers |
| Badge (`assets/img/badge-anneau.png`) | logo LKDV | marque LKDV |

## Photos libres (Wikimedia Commons)

Sur 14 images demandées à ChatGPT, une seule est arrivée : le condor du plan 03. Les autres plans utilisent des photos libres de Torres del Paine et de Patagonie. Elles sont recadrées en 9:16 et étalonnées par `tools/prep-images.py`, avec le cadrage de `assets/photos/cadrage.json`. La licence BY-SA impose de créditer l'auteur et de partager l'image modifiée sous la même licence. Une image ChatGPT déposée plus tard dans `assets/gen/NN-*` remplace automatiquement la photo du même numéro.

| Plan | Fichier | Œuvre d'origine | Auteur | Licence |
|---|---|---|---|---|
| 01 | `assets/photos/01-aube-cuernos.jpg` | [Cuernos del Paine in Torres del Paine National Park.jpg](https://commons.wikimedia.org/wiki/File:Cuernos_del_Paine_in_Torres_del_Paine_National_Park.jpg) | Pedro Szekely from Los Angeles, USA | CC BY-SA 2.0 |
| 02 | `assets/photos/02-arc-en-ciel.jpg` | [Hikers and Rainbow in Torres del Paine (3279604458).jpg](https://commons.wikimedia.org/wiki/File:Hikers_and_Rainbow_in_Torres_del_Paine_(3279604458).jpg) | Jason Hollinger | CC BY 2.0 |
| 04 | `assets/photos/04-passerelle.jpg` | [Torres del Paine suspension bridge 1.JPG](https://commons.wikimedia.org/wiki/File:Torres_del_Paine_suspension_bridge_1.JPG) | Fredlyfish4 | CC BY-SA 4.0 |
| 05 | `assets/photos/05-torres-aube.jpg` | [Amanecer en las Torres.jpg](https://commons.wikimedia.org/wiki/File:Amanecer_en_las_Torres.jpg) | Ryem Rafail | CC BY-SA 4.0 |
| 06 | `assets/photos/06-refuge-paine-grande.jpg` | [Refugio Paine Grande.jpg](https://commons.wikimedia.org/wiki/File:Refugio_Paine_Grande.jpg) | Alexis Alvarez | CC BY-SA 4.0 |
| 07 | `assets/photos/07-cuernos-nuage.jpg` | [Torres del Paine, Los Cuernos 02.jpg](https://commons.wikimedia.org/wiki/File:Torres_del_Paine,_Los_Cuernos_02.jpg) | LBM1948 | CC BY-SA 4.0 |
| 08 | `assets/photos/08-icebergs-grey.jpg` | [Torres del Paine, Grey 21.jpg](https://commons.wikimedia.org/wiki/File:Torres_del_Paine,_Grey_21.jpg) | LBM1948 | CC BY-SA 4.0 |
| 09 | `assets/photos/09-lago-sarmiento.jpg` | [Lago Sarmiento, Patagonia (39516816024).jpg](https://commons.wikimedia.org/wiki/File:Lago_Sarmiento,_Patagonia_(39516816024).jpg) | Deensel | CC BY 2.0 |
| 10 | `assets/photos/10-sac-dos.jpg` | [Person hiking on trail - Lula Lake Land Trust (Unsplash).jpg](https://commons.wikimedia.org/wiki/File:Person_hiking_on_trail_-_Lula_Lake_Land_Trust_(Unsplash).jpg) | Chad Madden chadmadden | CC0 |
| 11 | `assets/photos/11-lago-grey.jpg` | [In & around Torres Del Paine Nat'l Park - a short hike amongst the icebergs of Lago Grey (48m asl) - shivering in a cold wind of the Patagonia ice-cap - (24559056473).jpg](https://commons.wikimedia.org/wiki/File:In_%26_around_Torres_Del_Paine_Nat%27l_Park_-_a_short_hike_amongst_the_icebergs_of_Lago_Grey_(48m_asl)_-_shivering_in_a_cold_wind_of_the_Patagonia_ice-cap_-_(24559056473).jpg) | Murray Foubister | CC BY-SA 2.0 |
| 12 | `assets/photos/12-tente-etoiles.jpg` | [Travel tent on a meadow under the big tree.jpg](https://commons.wikimedia.org/wiki/File:Travel_tent_on_a_meadow_under_the_big_tree.jpg) | Vian | CC BY-SA 4.0 |
| 13 | `assets/photos/13-mirador-base.jpg` | [Mirador Base Torres del Paine.jpg](https://commons.wikimedia.org/wiki/File:Mirador_Base_Torres_del_Paine.jpg) | Alexis Alvarez | CC BY-SA 4.0 |

Les personnes visibles (plans 02, 10 et 11) sont petites, de dos ou loin. Avant une campagne payante, il faudra vérifier qu'aucune n'est identifiable, à cause du droit à l'image.
