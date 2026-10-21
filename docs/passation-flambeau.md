# 🕯️ Transmission de Flambeau — LKDV (Le Kit du Voyageur)

> **Pour le nouvel agent :** Tout est prêt, propre et testé. Voici le récapitulatif opérationnel pour reprendre immédiatement le relais.

---

## 📌 1. État Actuel

- **Branche** : `main` (à jour avec `origin/main`, arbre propre `git status`).
- **Dernier commit** : [`b8853a89`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/commit/b8853a89) — `feat(compte): refonte v12 profil Instagram Liquid Glass, carte 3D fiabilisee et teleportation post`
- **Tests** : **294/294 tests verts** (`npx vitest run tests/design/`).
- **Build de production** : **100% OK** (`npm run build` passe avec 0 erreur).

---

## 🛡️ 2. Invariants Critiques

1. **INVARIANT ABSOLU `/compas`** :
   - **STRICT ZERO MODIFICATION** dans `src/app/compas/**` et `src/features/compas/**`.
2. **DESIGN SYSTEM LIQUID GLASS iOS 27 CLAIR** :
   - Tous les sélecteurs, capsules et barres d'onglets doivent être en **Liquid Glass clair** (`rgba(255, 255, 255, 0.65)`, `blur(28px)`, bordure blanche, lentille lumineuse, icône active `#17402C`). Zéro boîte noire/grise opaque.
3. **ERGONOMIE VISUELLE** :
   - Dans les sélecteurs compacts : **soit une icône pure, soit du texte pur, jamais les deux mélangés**.
4. **MÉTHODE** :
   - Proposer un plan complet et attendre l'approbation de l'utilisateur avant toute modification de code importante.

---

## 🚀 3. Ce qui a été accompli lors de la dernière session (Refonte v12)

- **Header `/compte` épuré** : nom et pseudo retirés de sous la photo de profil, compteurs (`publications`, `abonnés`, `abonnements`) recentrés sans fond lourd.
- **Sélecteur Grille / Sorties** : repositionné au coin supérieur droit de la card de profil en Liquid Glass iOS 27 clair avec lentille coulissante.
- **Boutons de profil** : retirés du centre de la carte et intégrés en tête du drawer Compte & Activité (`account_drawer`, icône réglages en haut à droite).
- **Posts & Téléportation 3D** : clic sur un post -> ouverture en drawer superposé (laissant la carte 3D visible dessous) + téléportation automatique de la caméra 3D vers le lieu exact (Lac Blanc, Néouvielle, Glacier Blanc, etc.) avec repère animé et Dynamic Island.
- **Carte 3D fiabilisée** : `ResizeObserver` sur le canvas, multi-watchers de redimensionnement (`map.resize()`), fond sombre `#0b101b`, zéro écran vide, tous calques affichés (relief, satellite, trace GPS, 5 massifs, sommets, refuges, photos pins).
- **Tous les sélecteurs de drawers harmonisés** : Identité 5 écrans, Lignées & Inventaire 5 onglets, Compte & Activité 3 tabs, et Abonnés/Abonnements tous en Liquid Glass clair iOS 27.

---

## 📂 4. Fichiers Centraux

- `src/components/compte/CompteLiquidGlassV8.tsx` (CSS Liquid Glass iOS 27 & markup)
- `src/components/compte/compte-liquid-glass-v8-runtime.js` (Moteur d'interactions, drawers, MapLibre 3D)
- `src/app/carte-3d/Carte3D.tsx` (Carte 3D plein écran)
- `tests/design/compte-refonte-v12.spec.ts` (Tests v12)

---

## 🧪 5. Commandes Utiles

```bash
npx vitest run tests/design/   # Lancer les tests de design
npm run build                  # Tester le build de production
git status                     # Vérifier la propreté de l'arbre
```
