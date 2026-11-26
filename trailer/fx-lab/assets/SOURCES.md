# Sources des éléments de fx-lab

- `logo-mark.svg` : copie exacte de `public/assets/logo-mark.svg` (dépôt LKDV). Vérifiée par `tests/logo-sync.mjs`.
- Terre de nuit (P53–P54) : **entièrement en code**. Le téléchargement d'une plaque NASA « Black Marble » (domaine public) a été tenté le 11/11/2026 depuis `eoimages.gsfc.nasa.gov` : refusé par le proxy réseau (HTTP 403 au tunnel). Aucune image externe n'est utilisée.
- Contours des terres : Natural Earth 1:110m admin-0 (domaine public), copie déjà présente dans le dépôt `public/data/countries-110m.geojson`, cuite dans `lib/fx/earth-data.js` par `tools/bake-earth.mjs`.
- Villes : coordonnées géographiques publiques (faits), poids d'éclairage choisis à la main.
- Plaques img03, img04, img05, img01, img39 : absentes à ce jour ; remplacées par des plaques en code (`lib/fx/plates.js`). Emplacements prévus : `assets/footage/img0N.png` (variables `PLATE` / `PLATES` dans les scènes).
