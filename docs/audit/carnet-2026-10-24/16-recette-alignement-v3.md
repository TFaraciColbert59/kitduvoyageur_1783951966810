# Fiche carnet — recette de l'alignement v3 (anneaux, pilule, toggle)

**Date :** 24 octobre 2026
**Déploiement :** `https://kitduvoyageur-1783951966810-nj38tk1hq.vercel.app` (alias `koosmoweb.fr`), source **`01164f58`**, `Ready in 11m`, `EXIT:0`.
**Branche du code déployé :** `carnet/align-v3` (`12488ed5` → `276fc077` → `01164f58`).
**Carnet de recette :** `9ba890ca-e071-5ab8-8624-6bd8a471a6c1`.

---

## 1. Conformité mesurée sur la production

| Élément | Compte (référence) | Fiche (mesuré prod) | État |
|---|---|---|---|
| Carte | 12 / 406 / r24 | **12 / 406 / r24** | ✅ |
| Visuel d'identité | cercle 66 + anneau conique | **66, r 50 %, anneau conique** | ✅ |
| Pilule d'identité | 34, 700/16, bord 1 px, fond translucide, sans vignette | **34, 16px/700, bord 1 px, sans vignette** | ✅ |
| Cellule de stat | 101 × 39, valeur 19/700 | **99 × 39, 19px/700** | ✅ (2 px) |
| Action rapide | anneau 44 + disque 40 + libellé 9,8 | **44, disque 40, libellé 9,8** | ✅ |
| Tuile | 134, r 2 | **134, r 2** | ✅ |
| Grille | pleine largeur de carte (404) | **x 12, pleine largeur** | ✅ |
| Toggle grille/carte | 30, bas-droite de la carte | **présent, 30, bas-droite** | ✅ |
| Bloc titre dans la carte | aucun | **aucun** | ✅ |
| Barre du haut | 48 | **48** | ✅ |
| Barre basse | 402 à x14 | **402 à x14** | ✅ |
| Ligne de contexte | `lieu · texte` 11 px | `Islande · 25 avr. – 6 mai 2026` | ✅ |

## 2. Preuves visuelles

| Capture | Viewport | Constat |
|---|---|---|
| `prod-v3-430.png` | 430 × 932 | Couverture en anneau, stats 19/700, ligne de contexte, auteur 94 + Vérifié, 3 anneaux avec badges 23 / 3, grille pleine largeur, toggle |
| `prod-v3-1440.png` | 1440 × 900 | Colonne 430 centrée, carte 406, barre 402 |
| `iso-final-430.png` | 430 × 932 | Même rendu en local avant déploiement (preuve de non-régression du build) |

## 3. Tests

`npx vitest run src/components/carnet src/features/carnet` → **84 tests verts**, dont le contrat cible écrit dans le dépôt :
- pas de `h2` dans la carte, `.ckp-bio-line` = `France / Italie / Suisse · 26 sept. – 2 oct. 2026` ;
- auteur, score et vérification regroupés sur la ligne auteur ;
- bascule grille → carte du parcours, puis retour à la grille ;
- GPX proposé quand la trace existe ;
- 3 volets propriétaire, 2 volets visiteur.

## 4. Incident de chantier (à connaître)

Un **second agent travaille dans le même worktree** (`/Users/fr168256/Desktop/lkdv-communaute-feed`) et a réécrit en parallèle `CarnetIdentityCard.tsx`, la feuille `carnet-profile.css` et les tests, avec un contrat de classes différent (`.ckp-avi-wrap`, `.ckp-bio-meta`). Résultat : à deux reprises, le rendu local est parti en bannière (image de couverture non contrainte) parce que les composants et la feuille ne venaient pas de la même version.

**Décision :** le code déployé est isolé sur la branche **`carnet/align-v3`**, construite dans un worktree séparé (composants `12488ed5` + feuille v3 `276fc077` + tuiles r2 `01164f58`), testé et déployé depuis là. Le worktree principal contient toujours la version de l'autre agent.

**Conséquence :** un déploiement depuis le worktree principal **écraserait** cet alignement. Pour le reprendre :

```bash
git checkout carnet/align-v3 -- src/components/carnet src/styles/carnet-profile.css
```

## 5. Réserves

1. `koosmoweb.fr` ne résout pas depuis l'environnement d'audit (`NXDOMAIN`), alors que Vercel confirme l'alias ; les vérifications HTTP sont faites sur l'URL de déploiement.
2. Statut 404 des routes dynamiques : 200 avec corps introuvable (comportement plateforme, mesuré sur `/profil`, `/clubs`, `/voyages`).
3. Le bouton retour reste présent dans la barre du haut (une fiche est une page de détail) : seule entorse assumée à la barre du Compte.
4. Lentille de la barre basse toujours masquée (aucun onglet actif) : décision de la spec `11`.
