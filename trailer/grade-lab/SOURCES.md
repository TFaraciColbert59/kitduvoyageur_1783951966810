# Images d'essai de l'étalonnage (`grade-lab/samples/`, ignoré par git)

Le proxy de la session refuse Wikimedia Commons, images.nasa.gov, nps.gov, Openverse et Flickr. Seul `raw.githubusercontent.com` répond : les photos viennent donc du jeu d'essai de scikit-image (v0.19.3), dont la licence de chaque image est écrite dans `skimage/data/_fetchers.py` à la même version. Aucune photo de montagne libre n'a pu être téléchargée : les lumières du film sont couvertes par des mires synthétiques.

| Fichier | URL | Auteur | Licence (d'après `_fetchers.py`) | Sert à |
|---|---|---|---|---|
| `dl/astronaut.png` | https://raw.githubusercontent.com/scikit-image/scikit-image/v0.19.3/skimage/data/astronaut.png | NASA (portrait d'Eileen Collins) | domaine public | visage, peau |
| `dl/coffee.png` | …/skimage/data/coffee.png | Rachel Michetti | CC0 | intérieur ambré, bois |
| `dl/rocket.jpg` | …/skimage/data/rocket.jpg | SpaceX (lancement DSCOVR) | domaine public | heure bleue, lampes au sodium |
| `dl/hubble_deep_field.jpg` | …/skimage/data/hubble_deep_field.jpg | NASA / Hubble | domaine public | ciel profond, étoiles |
| `dl/chelsea.png` | …/skimage/data/chelsea.png | Stefan van der Walt | CC0 | pelage chaud |
| `mires/*.png` | générées par `tools/grade/make-charts.mjs` | — | œuvre du projet | nuancier (gris + couleurs clés) et six plaques : aube rose, midi turquoise, heure dorée, feu de nuit, Voie lactée, intérieur ambré |

Le sac : `trailer/assets/ref/sac-lkdv-one-45.png` et `lkdv-one-45-40.png` (rendus du projet).
