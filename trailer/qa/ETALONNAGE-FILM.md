# Étalonnage commun appliqué au film (P06–P51)

État au 13/11/2026, agent `landscape-director`. Terminé.

1. **Porteur et méthode.** L'attribut est posé sur le `<canvas id="pNN-canvas">` de chaque plan. Le moteur étalonne `video`, `img` et `canvas` (liste interne `["video","img","canvas"]`). L'`<img>` source est caché et sert seulement à `drawImage`, donc l'étalonner ne changerait rien. La valeur vient de `npx hyperframes media-treatment --project film --file compositions/p22.html --selector '#p22-canvas' --grading '{"lut":{"src":"assets/luts/lkdv-trailer.cube","intensity":1}}' --apply --json` (ok, tag canvas). La CLI réécrit tout le fichier (des `data-hf-id` partout) : je n'ai gardé que l'attribut `data-color-grading` qu'elle a validé, inséré seul sur la balise canvas. Résultat : 45 fichiers modifiés (P50 rendu à son état d'origine), 1 ligne chacun. `index.html` n'est pas touché.
2. **Preuve que le cube s'applique au rendu.** Captures du moteur avant/après (`snapshot --at`). Sur 11 plans à 100 %, l'écart ΔE2000 entre la capture étalonnée et notre interpolation trilinéaire du même cube, appliquée à la capture neutre, va de 0,18 à 0,29.
3. **Intensités.** 100 % sur P06–P47 et sur P51. **80 %** sur P48 et P49 (img37, nuit avec téléphone : noirs nettement relevés, ΔE p95 ≈ 5 à 100 %). P50 sans étalonnage, décision orchestrateur : le bivouac s'éteignait (mesures : ΔE moyen 2,34 à 100 %, 1,63 à 70 %, 1,39 à 60 %).
4. **Mesures** (1 % le plus sombre, 1 % le plus clair, ΔE2000 moyen / p95) :

| Plan | Sombres | Clairs | ΔE moy / p95 |
|---|---|---|---|
| P06 intérieur (100 %) | #0B0B0A → #171A17 | #F6C792 → #F7CB96 | 0,77 / 2,16 |
| P23 jour (100 %) | #100F0F → #191A19 | #EAD0D8 → #EBD5DA | 0,62 / 1,13 |
| P26 jour ★ (100 %) | #292B24 → #272821 | #EBE0D8 → #EAE3DD | 0,59 / 1,17 |
| P40 jour ★ (100 %) | #231B12 → #251D14 | #FDEFD3 → #FAF1E0 | 0,75 / 1,18 |
| P46 nuit (100 %) | #0D0D0C → #181A18 | #C68E62 → #C99164 | 0,66 / 1,73 |
| P48 nuit (80 %) | #050504 → #101411 | #FCDAB4 → #FBDCB9 | 1,44 / 3,84 (100 % : 1,87 / 5,12) |
| P50 nuit ★ | sans étalonnage, décision orchestrateur : le bivouac s'éteignait | — | — |

Écran de l'app dans P48 à 80 % : ΔE moyen 0,69, ce qui ne se voit pas. Le feu garde son orange (clairs #FCDAB4 → #FBDCB9).

5. **Contrôles.**
   - `npx hyperframes lint` : « 0 errors, 0 warnings ».
   - `npx hyperframes check --json`, relancé après le retrait de P50 : `ok: true`, `errorCount: 0`. Il remonte 8 avertissements `console_warning` « GPU stall due to ReadPixels », qui viennent de l'étalonnage des canvas en WebGL logiciel.
   - `node tools/timeline/compare-timeline.mjs` : `{"rows":54,"shots":54,"duration":60,"mismatches":0,"maxAbsFrameOffset":0}`.
6. **Preuves regardées.** `qa/snapshots/etalonnage-film/avant-apres-{p06,p23,p26,p40,p46,p48,p50}.jpg`, et `planche-p06-p51.jpg` (une image au milieu de chaque plan après étalonnage).
7. **Points faibles.**
   - P50 n'est pas étalonné (décision orchestrateur) : ses noirs restent neutres alors que P49 et P51 vont vers l'encre, donc un petit écart de teinte des noirs est possible aux deux coupes.
   - Sur les plans de jour, le changement est presque invisible (ΔE < 0,8). L'étalonnage unifie les noirs et les blancs crème, mais il ne crée pas de « look ».
   - Pas de rendu final MP4 : les mesures viennent des captures du moteur (`snapshot`), pas d'un encodage. Les avertissements ReadPixels annoncent un rendu plus lent sur 46 plans.
   - Les raccords à ±0,2 s n'ont pas été mesurés plan par plan. Un plan à 100 % qui coupe sur un plan à 80 % ou non étalonné (P47→P48, P49→P50, P50→P51) peut montrer un petit saut de noir.
