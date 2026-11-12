# CREDITS (obtenu le 2026-11-10)

Mention NASA : le contenu NASA est en général non protégé par le droit d'auteur (politique média NASA) ; crédit demandé « NASA/Goddard Space Flight Center Scientific Visualization Studio ». Aucun logo NASA (meatball/worm) à l'écran ; aucune suggestion de parrainage.

| Ressource | Fichier local | Source / URL | Auteur | Licence | Commercial | Preuve |
| --- | --- | --- | --- | --- | --- | --- |
| Terre jour, Blue Marble Next Generation 2004, 8192x4096 (2 hémisphères 4096x4096 PNG recollés, JPEG q92) | textures/earth-bluemarble-nasa-8192.jpg | https://svs.gsfc.nasa.gov/2915 (bluemarble-west-4096.png, bluemarble-east-4096.png) | NASA/GSFC SVS, Eric Sokolowsky ; données Reto Stockli (NASA/GSFC), MODIS | Domaine public NASA | Oui | Page SVS : « Please give credit for this item to: NASA/Goddard Space Flight Center Scientific Visualization Studio » |
| Lune, LROC color poles, 8192x4096 (tif 8k converti JPEG q92) | textures/moon-lroc-color-poles-8k.jpg | https://svs.gsfc.nasa.gov/4720 (lroc_color_poles_8k.tif) | NASA SVS, Ernie Wright (CGI Moon Kit) ; données LRO/LROC | Domaine public NASA | Oui | Page SVS 4720, crédit SVS |
| Contours pays/terres, Natural Earth 4.1.0 en TopoJSON (110m, 50m, 10m, land-50m) | geo/countries-{110m,50m,10m}.json, geo/land-50m.json | npm world-atlas@2.0.2 ; https://github.com/topojson/world-atlas | Mike Bostock (redistribution) ; Natural Earth | Données Natural Earth domaine public ; paquet ISC (geo/world-atlas-LICENSE.txt) | Oui | README : « redistribution of Natural Earth's vector data, version 4.1.0 » |
| Islande (id 352), tracé dérivé de countries-10m | geo/iceland.geojson, geo/iceland-path.json | dérivé de la ligne ci-dessus (topojson-client@3.1.0, ISC) | - | idem | Oui | script reproductible |
| GSAP 3.15.1 + CustomEase, MotionPath, DrawSVG, MorphSVG, SplitText | vendor/*.min.js | npm gsap@3.15.1 ; https://gsap.com/standard-license/ | GreenSock/Webflow | « no charge » standard license | Oui (tant que les utilisateurs finaux ne paient pas pour y accéder) | vendor/LICENSES/gsap-LICENSE.txt |
| three 0.180.0 (module + core min) | vendor/three.module.min.js, three.core.min.js | npm three@0.180.0 | Three.js authors | MIT | Oui | vendor/LICENSES/three-LICENSE.txt |
| Textures de secours (Blue Marble 4096, nuit 4096, relief 2048, eau 1600, day, dark) | textures/fallback-three-globe/* | npm three-globe@2.45.6, example/img | Vasco Asturiano (paquet) | Paquet MIT (vendor/LICENSES/three-globe-LICENSE.txt) ; origine NASA de ces images NON attestée par le paquet | A confirmer : usage provisoire seulement | README du paquet sans mention NASA ; à remplacer |

## Écartés
- Black Marble NASA 2016, nuages cloud_combined, relief/bathymétrie NASA : eoimages.gsfc.nasa.gov coupe la connexion (3 essais), archive.org aussi ; non obtenus. Nuit = secours three-globe provisoire (voir ci-dessus).
- npm earth-visualization (nuages 4096x2048) : seule mention « bundled NASA imagery (public domain) » générique, sans provenance par fichier ni LICENSE. Non copié. Nuages à faire en procédural.
- cesium moonSmall.jpg (256x128, provenance non documentée) ; NaturalEarthII de cesium (tuiles basse résolution) : non copiés.
- SVS 3615 (Terre « LARGEST », 2048x1024, direction artistique de production) : non copié.

## Équipe B cosmos (b-earth, b-descent, b-orbit) — ajouts du 2026-11-10

| Ressource | Fichier local | Source / URL | Auteur | Licence | Commercial | Preuve |
| --- | --- | --- | --- | --- | --- | --- |
| Lumières nocturnes, VIIRS Black Marble 2016, mondial 4096x2048 (WMS GetMap, EPSG:4326, JPEG) | textures/earth-blackmarble-nasa-gibs-4096.jpg | https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi (LAYERS=VIIRS_Black_Marble, BBOX=-90,-180,90,180) | NASA Earth Observatory / NASA GSFC (Black Marble, VIIRS Suomi NPP) ; service NASA GIBS (ESDIS) | Données NASA, politique de données ouvertes (pas de restriction d'usage) | Oui | Crédit demandé par GIBS : « We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS). » Remplace la nuit three-globe (provenance non attestée), qui n'est plus utilisée par l'équipe B. |
| Islande, Blue Marble Next Generation (500 m), emprise lon -25,0 → -12,6, lat 62,8 → 67,2, 4096x1454 | textures/iceland-bmng-nasa-gibs-4096.jpg | même service, LAYERS=BlueMarble_NextGeneration, BBOX=62.8,-25.0,67.2,-12.6 (WMS 1.3.0, ordre lat,lon) | NASA Earth Observatory (Reto Stöckli), MODIS ; service NASA GIBS | Données NASA, politique de données ouvertes | Oui | idem ; détail régional fondu dans la Blue Marble 8192 pendant la descente (6,2–11,0 s) |
| Nuages, aurore, lave, continents anciens, voiles de nuages, étoiles, satellites, avion, montgolfière, oies, gouttelettes | (aucun fichier : procéduraux dans assets/cosmos/b-*.js) | — | équipe B | création propre | Oui | — |
| Tracé Route 1 (28 localités) et traces K2 (Askole → Concordia → camp de base), Lyon (Rhône), Bourgogne (Beaune, Nuits) | (constantes dans b-descent.js / b-orbit.js) | coordonnées géographiques publiques de localités (faits, non protégés) | — | — | Oui | Longueur calculée de la Route 1 : voir qa/tmp/cosmos-b/RAPPORT.md |
