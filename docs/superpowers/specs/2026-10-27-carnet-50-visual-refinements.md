# Carnet — 50 corrections visuelles

**Date :** 2026-10-27
**Périmètre :** sous-drawer Carnet uniquement. Aucun autre écran.
**Contrainte :** aucun titre, aucun texte hors champ. Les libellés sont **uniquement des placeholders**. Aucune nouvelle règle de design : on reprend la grammaire du Compte.

## Recherche Exa — libs utiles

- [route-snapper](https://github.com/dabreegster/route_snapper) — Apache 2.0, MapLibre, routage client-side sur réseau, drag de waypoints. C’est la piste la plus proche du « tracé aimanté ».
- [Terra Draw Route Snap Mode](https://github.com/JamesLMilner/terra-draw-route-snap-mode) — MIT, snap sur réseau + itinéraire multi-stop, alternative.
- [shadcn/ui Drawer](https://ui.shadcn.com/docs/components/base/drawer) — passé à **Base UI**, snap points verticaux. Ne pas réintroduire Vaul par défaut.
- [Base UI Drawer](https://base-ui.com/react/components/drawer) — gestes, snap points, `Drawer.VirtualKeyboardProvider` pour les champs.

---

## A. Carte (1–14)

1. **Décaler la carte sous le sélecteur** de 10 px : elle ne doit plus être coupée par les icônes.
2. **Rayon 16 px** uniquement en haut de la carte ; le bas rejoint la feuille sans bord.
3. **Alléger le style** : topo désaturé, routes secondaires plus fines, moins de labels.
4. **Tracé avec liseré** : 6 px blanc translucide sous 3 px vert ; le trait ne doit plus être un gros trait noir.
5. **Extrémités arrondies** (`line-cap: round`, `line-join: round`).
6. **État brut vs snappé** : brut en pointillé fin, snappé en plein ; jamais les deux superposés.
7. **Points de départ/arrivée** : deux petits disques blancs à bord vert, pas des extrémités coupées.
8. **Marqueur jour** : 28 px, anneau blanc 2 px, ombre douce, numéro 11 px.
9. **Marqueur moment** : 18 px, vert, anneau blanc 1,5 px.
10. **Marqueur actif** : 34 px pour le jour, 22 px pour le moment, halo 6 px.
11. **Bouton Dessiner** : icône seule dans une pillule 44×44, plus de texte.
12. **Contrôles empilés** : Dessiner / Annuler / Effacer, 44×44, gap 8, en haut à gauche.
13. **Fondu bas de carte** : 24 px vers la feuille, pas de coupure nette.
14. **Attribution légale discrète** en bas ; supprimer l’échelle si elle chevauche la feuille.

## B. Feuille et jour (15–28)

15. **Une seule surface** : supprimer la grande carte blanche interne qui fait un « drawer dans le drawer ».
16. **Hauteur au contenu** : la feuille ne doit pas garder 250 px de vide sous un seul moment.
17. **Supprimer “Jour 1”** : le numéro du jour vit uniquement dans la capsule.
18. **Supprimer “1 moment”** : aucun compteur texte.
19. **Supprimer les cartes blanches par champ** : une seule surface, des séparateurs.
20. **Champs sans bordure** : fond transparent, ligne basse 0,5 px, radius 0.
21. **Hauteur de champ 44 px**, placeholder 13 px.
22. **Placeholder plus contrasté** : `#5F6F65`, jamais gris clair sur crème.
23. **Padding de feuille 14 px**, gap 10 px.
24. **Un seul séparateur horizontal** entre les moments, pas d’ombre.
25. **État vide** : un seul bouton `+` circulaire centré, aucun texte.
26. **Slides 100 % largeur**, gap 8, snap central ; pas de carte partielle visible.
27. **Gap carte/feuille 8 px** ; la feuille commence sur le fondu.
28. **Fond feuille** : même verre que Compte, sans dégradé décoratif.

## C. Moments (29–38)

29. **Grille de ligne** : index 16 / champ 1fr / photo 40 / poubelle 32, sans chevauchement.
30. **Index 9 px**, couleur `--feed-muted`, jamais un gros “1”.
31. **Photo 40×40**, radius 10, bord 0,5.
32. **Icône photo seule** ; pas de libellé.
33. **Poubelle 32×32**, opacité 0,45 au repos, 1 au focus ; rouge seulement à l’action.
34. **Commentaire sur une deuxième ligne**, pleine largeur, sans label.
35. **Ajouter un moment** : cercle pointillé 44×44 avec `+`, aucun texte.
36. **Espacement des lignes 8 px** ; pas de cartes empilées.
37. **Aucun placeholder “Moment” répété** : placeholder contextuel unique.
38. **Focus visible** : anneau 2 px `#17402C`, offset 2.

## D. Barre d’action (39–46)

39. **Capsule identique Compte** : 30 px, largeur `n × 41,5 + 5`, padding 2,5, radius 9999.
40. **Lentille 41,5×25**, déplacement 240 ms, jamais un oval vide.
41. **Barre alignée à droite**, bouton Créer 30×30 à gauche.
42. **Bouton Créer** : icône check seule, vert plein, 30×30.
43. **Numéros de jour 10 px**, actif `#17402C`, inactif `#6B7A70`.
44. **Réglages et `+`** : icônes 13 px, cellules 41,5.
45. **Zone tactile 44 px** via `::after`, sans agrandir la capsule.
46. **Overflow** : la capsule scrolle horizontalement au-delà de 6 jours, hauteur inchangée.

## E. Finitions (47–50)

47. **Supprimer tout artefact noir** en bas à droite ; respecter `env(safe-area-inset-bottom)`.
48. **Échelle typographique** : 13 input, 11 secondaire, 9 index ; pas de 16 px dans les champs.
49. **Contraste** : placeholder ≥ 4,5:1 ; focus visible ; reduced-motion sur lentille et marqueurs.
50. **Audit “zéro texte”** : supprimer tous les titres, compteurs, hints, notes, CTA texte hors placeholder.

---

## Ordre de priorité

1. **P0** : 1, 4, 15, 16, 17, 19, 29, 39, 47, 50.
2. **P1** : 2, 3, 5, 6, 8, 10, 18, 20, 21, 25, 31, 33, 35, 40, 41.
3. **P2** : le reste.

## Garde-fous

- Aucun titre, aucun texte hors champ : **placeholders uniquement**.
- Mêmes rayons, verre, ombres et focus que le Compte.
- Pas de nouvelle couleur, pas de nouveau font.
- La carte reste fixe ; seule la feuille swipe.
- Les libs de snapping sont une aide d’implémentation, pas une excuse pour changer la grammaire visuelle.
