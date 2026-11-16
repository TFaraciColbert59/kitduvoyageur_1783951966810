# Trailer LKDV — « Une phrase suffit »

Film de 65,7 s (1920 × 1080, 30 i/s) codé entièrement en HTML/CSS/GSAP + Three.js avec [HyperFrames](https://hyperframes.heygen.com) (Apache-2.0), rendu en MP4 de façon déterministe.

- Histoire et choix : `STORYLINES.md` (trois pistes, A construite) · brief chiffré : `SPEC.md` · revue : `REVIEW.md`.
- Racine : `index.html` (scènes + musique + effets). Scènes : `compositions/{montage,questions,compas,carte,groupe,kit3d,terrain,partage,fin}.html`.

## Commandes

```bash
cd video/trailer-lkdv
npx hyperframes@0.9.56 preview --background   # Studio dans le navigateur
npx hyperframes@0.9.56 check                  # lint + exécution + mise en page + contrastes + son
npx hyperframes@0.9.56 snapshot --review      # planches de revue
npx hyperframes@0.9.56 render --output renders/trailer-lkdv.mp4 --quality delivery
```

Node ≥ 22 et FFmpeg requis. Les skills HyperFrames sont dans `.claude/skills/{hyperframes,hyperframes-cli,hyperframes-registry,media-use,…}`.

## D'où vient chaque image

| Élément | Source |
| --- | --- |
| Photos de voyage, paysage du Compas | `public/assets/images/*` (fichiers du site) |
| Panneau du Compas, « Nous », « Kit / Trouver » | reconstruits en HTML d'après les captures `docs/compas/preuves/*` ; libellés et chiffres repris à l'identique |
| Voyage « Trek des 3 Vallées » (Gavarnie, 44 km, D+ 2 750 m, Tony / Léa / Noé, réchaud vital) | **jeu de démonstration** du Compas (`src/features/compas/dev/labData.ts`), calculé par le vrai moteur — pas un voyage réel |
| Carte | vol satellite cuit avec `bake-basemap.mjs` (MapLibre + Esri World Imagery, crédit à l'écran) ; étapes géocodées sur OpenStreetMap/Nominatim |
| Sac 3D | maillages réels du Kit Studio (`public/assets/bags/lkdv-one-45.glb`, modules `lkdv-m04`, `lkdv-m13`), teinte des coloris Forêt/Sauge/Pierre recopiée de `scene/bag/atlas.ts` |
| Écrans téléphone | captures réelles de l'app : `docs/explorer-v2/preuves/*`, `docs/audit/carnet-drawers-2026-11-11/prod3/01-fiche.png`, `docs/audit/carnets-hub-2026-11-11/*`, `docs/audit/communaute-v2-2026-11-08/ecarts-maquette/captures-v2/*` |
| Badge | `public/logo.png`, détouré en cercle (`assets/img/lkdv-badge.png`), jamais redessiné |

## Refaire la carte

```bash
cd video/trailer-lkdv && mkdir -p .bake && cd .bake
echo '{"name":"bake","private":true,"type":"module"}' > package.json && npm i puppeteer-core@24
cp -r ../../../.claude/skills/hyperframes/scripts/{bake-basemap.mjs,lib} .
NAME=gavarnie STYLE=satellite PROJECTION=globe FROM="2.35,48.85" CENTER="-0.004,42.737" \
  ZSTART=1.85 ZEND=11.3 PAN=0.35 HOLD=0.55 DUR=7.5 FPS=30 OUT=../assets/map \
  CHROME=/chemin/vers/chrome node bake-basemap.mjs
```

Les positions des étapes (`compositions/carte.html`, `groupe.html`) sont la projection Web Mercator de leurs coordonnées au zoom 11,3 centré sur (-0,004 ; 42,737).

## Crédits et licences

- Musique : « Ambient Uplift » par Soundrider/Dope, CC BY 3.0 — https://www.jamendo.com/track/1670557 (attribution obligatoire dans la description de toute publication).
- Effets sonores : Pixabay Content License (fournis avec le skill `media-use`).
- Imagerie satellite : © Esri, Maxar, Earthstar Geographics (crédit affiché sur la carte).
- Three.js r180 (MIT), GSAP 3.12 (licence GreenSock standard « no charge »), HyperFrames (Apache-2.0).
