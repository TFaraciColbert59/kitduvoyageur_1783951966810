# Fiche carnet — recette de l'écran fixe et des drawers

**Date :** 24 octobre 2026
**Déploiement :** `https://kitduvoyageur-1783951966810-4c4hzyqcc.vercel.app` (alias `koosmoweb.fr`), `Ready in 15m`, `EXIT:0`.
**Code :** branche **`carnet/v5-ecran-fixe`** (worktree isolé `lkdv-carnet-v4`, depuis `carnet/align-v3`).
**Carnet de recette :** `9ba890ca-e071-5ab8-8624-6bd8a471a6c1`.

---

## 1. Mesures de production (430 × 932)

| Contrôle | Attendu (Compte) | Mesuré | État |
|---|---|---|---|
| Scroll de page | aucun | **`scrollHeight = innerHeight`** | ✅ |
| Carte | 12 / 406 | **12 / 406** | ✅ |
| Scroll interne | `.card-scroll` | **`.ckp-card-scroll` présent** | ✅ |
| Sélecteur | 31 / r12 / 320 ms | **31 / 12px / `transform .32s cubic-bezier(.22,1.15,.36,1)`** | ✅ |
| Barre basse | 402 à x14 | **402 à x14** | ✅ |
| Pilule | 40 | **40** | ✅ |
| Titre dans la carte | absent | **absent** | ✅ |
| Sections dans le flux | aucune | **0** | ✅ |
| Typo racine | 14 / −0.14 px / #172b24 | **14px / −0.14px / rgb(23,43,36)** | ✅ |

## 2. Déclencheurs vérifiés en production

| Déclencheur | Résultat mesuré |
|---|---|
| Couverture | drawer Carnet : poignée + capsule 7 volets (propriétaire) / 6 (visiteur) |
| Stat DISTANCE | drawer **Parcours** actif, carte Leaflet présente, bouton GPX présent |
| Stat DÉNIVELÉ + | drawer Parcours |
| Stat JOURS | drawer **Étapes** |
| Anneau ♥ | like réel (écriture `carnet_likes`) |
| Anneau 💬 | drawer **Commentaires** |
| Anneau Gérer / Parcours | drawer **Gérer** / **Parcours** |
| Tuile de la grille | **drawer Post** : compteur `1/7`, « Moment suivant », « Commentaires du carnet » |
| Pilule du haut | drawer **Carnet** |
| `+` / recherche / cloche | `/carnets/nouveau` · `/communaute` · `/compte?tab=notifications` |
| `···` | menu 226 px (enregistrer, partager, copier, signaler, gérer) |
| `Échap` / poignée | retour à la carte |

## 3. Captures

| Capture | Contenu |
|---|---|
| `final4-card.png` | écran fermé : barre 48 (pilule + 4 boutons), carte 406 r24, anneau 66, 3 stats boutons, ligne auteur + score + Vérifié, 3 anneaux avec badges, grille, sélecteur 31 |
| `final4-drawer.png` | drawer Carnet : poignée, capsule 7 volets, sous-lens Récit/Étapes/Matériel/Nature, volet Récit |
| `final4-post.png` | drawer Post d'un moment |

## 4. Données réelles branchées

- `CarnetDetail.likers` : 50 réactions max, profils joints (`public_profiles`), badge de réaction (`like`, `bravo`, `useful`).
- Compteurs : `COUNT(*)` sur `carnet_likes` et `carnet_comments` (colonnes décoratives ignorées).
- Drawers : récit, 7 étapes avec refuges, kit 3,8 kg, nature (API), parcours + GPX, commentaires, j'aime, partage, gestion.

## 5. Réserves

1. **Pilule et boutons sans le filtre liquid-glass** `url(#lf…)` de la maquette Compte : rendu par le bord 1 px et le fond translucide mesurés. Non reproductible en CSS pur.
2. **Capsule à 7 volets** pour le propriétaire : icônes seules, 44 px de haut (au lieu de 48) pour rester lisible. Le Compte en a 5.
3. **Sous-lens du drawer Carnet** rendu en rangée statique (pas la capsule flottante 30) : quatre libellés longs ne tiennent pas dans 30 px.
4. **`+` et recherche** naviguent vers `/carnets/nouveau` et `/communaute` au lieu de monter les drawers de la Communauté — le comportement est réel, la coquille drawer Communauté reste à brancher.
5. **Statut HTTP 404** des routes dynamiques inchangé (plateforme).
6. **Worktree principal contesté** : le code livré vit sur `carnet/v5-ecran-fixe` ; un déploiement depuis `/Users/fr168256/Desktop/lkdv-communaute-feed` écraserait cet état.
