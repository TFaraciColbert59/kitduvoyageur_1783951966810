# Portes de fusion — scène atelier, 8 novembre 2026

Fusion dans `main` explicitement autorisée par Tony après contrôle de `b302c8a`. Le code validé ici est celui de ce commit ; les ajouts suivants se limitent au constat de coloris et aux comptes rendus des contrôles.

| Contrôle | Résultat |
|---|---|
| `tsc --noEmit -p .` | vert, tas Node 8 Go |
| ESLint Kit Studio + route, `--max-warnings=0` | vert |
| `bash scripts/verify-kit-studio.sh` | toutes les portes vertes, 473 tests / 41 fichiers |
| `npm run build` | code 0, compilation, types et lint activés (`FAST_BUILD` absent) |
| `npm run perf:budget` | toutes les surfaces vertes ; Kit Studio 481 / 520 Ko gzip |
| Greffe temporairement neutralisée | test WebGL rouge attendu : zéro pixel recoloré |
| Shader restauré intégralement | neuf tests atlas verts |
| Diff et revue du périmètre | aucun changement du code caméra, couleur, shader, modules ou vignettes par rapport à la base publiée |

La revue du lot a couvert comportement, lisibilité, frontières de modules, sécurité et coût : pas de dépendance ajoutée ; texture de contact suivie par le tracker ; géométrie du chanfrein statique ; ombre de contact conservée lorsque les ombres dynamiques sont coupées. Aucun problème bloquant propre au lot décor retenu.

Les avertissements globaux préexistants du build ne sont pas convertis en exceptions ni masqués. Aucun seuil n'a été relevé.

Le test pixels passe par les identifiants explicites `forest` et `ochre`, ce qui explique qu'il reste vert malgré le défaut de résolution `m-2d482a` constaté dans le chemin de configuration par défaut. Ce défaut est documenté dans `CONSTAT-coloris-defaut.md` et laissé au lot couleur, conformément à la demande. Le défaut de centrage de caméra signalé précédemment reste également hors de ce lot.

Les sorties de validation sont dans `preuves/scene-atelier/fusion-*.txt` et `fusion-gates.json`. Le checkout `main` contient parallèlement des modifications de modules en cours : elles ne font pas partie du lot validé et doivent être conservées sans être ajoutées au commit de fusion.
