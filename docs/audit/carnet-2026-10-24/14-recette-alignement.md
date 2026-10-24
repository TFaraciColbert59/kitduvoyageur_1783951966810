# Fiche carnet — recette de l'alignement Compte/Communauté

**Date :** 24 octobre 2026
**Déploiement :** `https://kitduvoyageur-1783951966810-q3i4wag3q.vercel.app` (alias `koosmoweb.fr`), source `641f3e28`, `Ready in 4m`, `EXIT:0`.
**Carnet de recette :** `9ba890ca-e071-5ab8-8624-6bd8a471a6c1` (Islande, 7 photos, 22→23 likes, 3 commentaires).
**Méthode :** mesures `getBoundingClientRect` + `getComputedStyle` sur la page déployée, comparées aux valeurs du Compte relevées le même jour (`13-comparatif-compte-communaute.md`).

---

## 1. Tableau de conformité (mesuré sur la prod)

| Token | Compte (référence) | Fiche (mesuré) | État |
|---|---|---|---|
| Position de la carte | 12 | **12** | ✅ |
| Largeur de la carte | 406 | **406** | ✅ |
| Rayon de la carte | 24 | **24px** | ✅ |
| Couverture / avatar | 66 | **66**, r 18 | ✅ |
| Cellule de statistique | 101 × 39 | **100 × 39** | ✅ (1 px) |
| Valeur de stat | 19/700, `-0.38px` | **19/700, -0.38px** | ✅ |
| Libellé de stat | 10,5/500, sans majuscules | **10,5px / none** | ✅ |
| Action rapide | cercle 44 + libellé 9 | **44**, libellé **9px**, aucun tronqué | ✅ |
| Tuile | 134, r 2 | **134, r 2** | ✅ |
| Wrap de grille | 406, r 22 | **406, r 22**, dans la carte | ✅ |
| En-tête | 56 | **56** | ✅ |
| Pilule de titre | 40 | **40** | ✅ |
| Barre basse | 402 à x 14 | **402 à x 14** | ✅ |
| Colonne à 768 / 1440 | 430 (appareil) | **430**, carte **406** | ✅ |
| Drawer | dans la carte, poignée, capsule 378×48 | **dans la carte**, poignée 18, capsule 378×48, lentille 74×40 | ✅ |
| Voile du drawer | aucun | **`.lkdv-compte-overlay` absent** | ✅ |
| Titre / croix du drawer | aucun | **aucun** | ✅ |
| Sous-sélecteur | 30 px, bas-droite | **30 px**, Récents / Anciens | ✅ |

Tous les écarts P0 à P2 du comparatif sont fermés. Reste P3 assumé : l'avatar auteur est à 28 (comme la Communauté) et la pastille de titre utilise la couverture en 32 arrondi.

## 2. Preuves visuelles

| Capture | Viewport | Constat |
|---|---|---|
| `final-closed-430.png` | 430 × 932, pleine page | Carte 406 r24, stats 19/700 en 3 cellules, actions 44 avec badges 23 / 3, grille pleine largeur 134 r2, sections 24 |
| `align-drawer-430.png` | 430 × 932 | Drawer dans la carte : poignée, capsule 3 volets (icônes), 3 commentaires, composer 36 + envoi 34, sous-capsule Récents/Anciens, aucun voile |
| `final-768.png` | 768 × 1024 | Colonne 430 centrée, carte 406 |
| `final-1440.png` | 1440 × 900 | Colonne 430 centrée, carte 406, barre 402 |

## 3. Recette fonctionnelle du drawer

| # | Test | Résultat |
|---|---|---|
| 1 | Clic 💬 | Le drawer s'ouvre dans la carte, 3 volets pour un visiteur |
| 2 | Clic sur la poignée | Ferme, retour à la carte d'identité |
| 3 | `Échap` | Ferme |
| 4 | Re-clic sur l'icône active | Aucun effet de bord (sélecteur idempotent) |
| 5 | Sous-capsule Anciens | Ordre inversé sans rechargement (test unitaire + recette) |
| 6 | Volet Gérer | Présent seulement si `isOwner` (test unitaire) |
| 7 | Like | 22 → 23, persisté (`COUNT(*) = 23`), cœur plein |
| 8 | Commentaires | 3 réels, tri, composer, suppression du sien |

## 4. Tests

`npx vitest run src/components/carnet src/features/carnet` → **80 tests verts** (12 fichiers), dont :
`CarnetCardDrawer` (5), `CarnetSubCapsule` (1), `CarnetCommentsPane` (4), `CarnetMomentGrid` (3), `CarnetIdentityCard` (10), engagement (6), commentaires (4), builder (17), jsonld (5), format (12), top bar (4), récit (5).

## 5. Réserves

1. **Capsule en icônes seules** : c'est la grammaire du drawer Profil. La découvrabilité repose sur `aria-label` + `title` ; un premier passage utilisateur est recommandé.
2. **Dernière rangée de grille partielle** quand le nombre de photos n'est pas un multiple de 3 (7 photos → 3 + 3 + 1). Fidèle à la donnée, pas de tuile inventée.
3. **Scan d'espèces** (`/api/carnet/identify-species`) inchangé, non testé en prod (clé IA requise).
4. **Statut 404 des routes dynamiques** : 200 avec corps introuvable, comportement plateforme inchangé (mesuré aussi sur `/profil`, `/clubs`, `/voyages`).
5. **Hub `/carnets`** lit toujours `likes_count` (colonne non maintenue) : écart d'affichage possible avec la fiche (23 vs 22).
