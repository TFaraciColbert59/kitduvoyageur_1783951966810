# Parité design

**Mission** : couche 6 et checklist des 40 contrôles. Dire, preuve à l'appui, en quoi chaque écran diffère de la maquette.

**Méthode, par écran** :
1. Ouvrir le `.dc.html` de référence et l'écran livré à 1440 × 1040 puis 390 × 844, mêmes données de test autant que possible.
2. Captures côte à côte + différence de pixels ; relever couleurs calculées, polices, tailles, espacements, rayons, ombres des éléments principaux (`getComputedStyle`) et les comparer aux jetons.
3. Classer chaque différence : **voulue** (donnée réelle, état, contenu dynamique — justifiée par écrit) ou **écart** (→ `ECARTS.md` avec capture).
4. Remplir les 40 contrôles de `05_UI_UX_DESIGN.md` § 8 : oui / non + preuve.

**Prêt** : tableau par écran (différences voulues, écarts ouverts, 40 contrôles) dans `etat/preuves/parite/<ecran>.md`.
