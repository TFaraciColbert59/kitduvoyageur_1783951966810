# 50 finitions UI/UX — drawers, composants, affichage

> Plan d'exécution par lots. Contrainte globale : la page Compte reste la loi
> (carte 406×541, verre .486/.384 + blur 25.2/1.8/1.05, rayon 24, grille 134/2/2,
> sélecteur de jours n×41,5+5, barre 402×48). Aucun texte d'état, placeholders `—`.

## Lot A — anatomie du drawer (1–8)
1. Poignée 42×5, 6 px et `.32` au toucher.
2. Rayon haut 24 / bas 16 avec ombre qui épouse la courbe.
3. Liseré blanc 1 px sur l'arc supérieur seulement.
4. Voile de coupe au scroll (blur 12, hairline, 160 ms).
5. Zone de retour tactile 12 px en bas.
6. Élévation progressive de l'ombre à l'ouverture (200 ms puis stable).
7. Scrim gradué .10 → .28.
8. Croix 36 px toujours présente (jamais le glissement seul).

## Lot B — typographie (9–16)
9. Trois niveaux : 20/700, 13/500, 11/500.
10. `tabular-nums` partout.
11. Unité accolée 14/500 `#6B7A70`.
12. Placeholders casse normale.
13. Interlignage 1,42 / 1,15.
14. Métadonnées `#6B7A70` (AA).
15. Ellipse au milieu pour les lieux longs.
16. Un seul accent `#17402C`.

## Lot C — rythme (17–24)
17. Échelle 4/8/12/20/32.
18. Ligne 48 px, colonne de valeurs 120 px.
19. Hairline inset 16 px.
20. Groupes de 3 lignes, 20 px d'air.
21. Pas de filet sur première/dernière ligne.
22. Marges internes 16 px.
23. Réserve basse 64 px.
24. Aucun cadre.

## Lot D — composants (25–34)
25. Carte de stat : 34/700 + 11/500 + barre 6 px.
26. Ligne de liste : icône 16, valeur à droite, chevron si navigable.
27. Pastille avatar : anneau 1,5 px blanc, initiales 11/700.
28. Badge compteur 13 px max.
29. En-tête de section 10,5/600 `.08em` `#8A968D`.
30. État vide : glyphe 32 px 30 % + `—`.
31. Squelette 5×48 px, shimmer 1,4 s.
32. Erreur de champ : liseré `#C13B34` + message 11 px.
33. Section repliable : chevron 180°/180 ms, `grid-template-rows`.
34. Bouton primaire 48/r999/14-600, secondaire texte 13/600.

## Lot E — mouvement (35–42)
35. Entrée feuille `translateY(12px)` + fondu 220 ms.
36. Changement de volet : fondu + 8 px, 180 ms.
37. Compteurs rouleau 400 ms (une fois).
38. Sortie 160 ms.
39. Une propriété animée par transition.
40. `prefers-reduced-motion` : fondus 120 ms.
41. `prefers-reduced-transparency` : surface opaque.
42. Aucune animation en boucle.

## Lot F — mobile (43–50)
43. Safe areas dans réserve, capsule, barre.
44. Cibles 44 px.
45. États hover = focus = tactile.
46. Anneau de focus 2 px + offset 2.
47. Verrou de scroll du fond.
48. Échap ferme, focus rendu au déclencheur.
49. Voile local sur photo sous texte.
50. Aucune image décorative sans `aria-hidden`.

## Preuves par lot
- `npx vitest run src/components/carnet src/features/carnet` vert, `tsc --noEmit` 0 erreur.
- Captures 430×932 avant/après, `read_image`, diff pixel sur le châssis = 0.
- Déploiement Cloudflare après chaque lot validé.
