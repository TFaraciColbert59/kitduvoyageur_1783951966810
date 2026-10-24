# Fiche carnet — recette de la refonte (lot 1)

**Date :** 24 octobre 2026
**Branche :** `chantier/post-system` (worktree `lkdv-communaute-feed`)
**Périmètre :** `/carnets/[id]` uniquement. Hub `/carnets`, `/compte`, `/communaute` intacts.
**Carnet de recette :** `9ba890ca-e071-5ab8-8624-6bd8a471a6c1` — « Traversée intégrale de l'Islande : F208 & Hautes Terres » (public, 7 photos, 5 items de kit, 22 likes, 3 commentaires, `verified = true`).

---

## 1. Ce qui est livré

| Bloc | Fichier | État |
|---|---|---|
| Contrat de données + mise en forme pure | `src/features/carnet/detail/{types,format,buildCarnetDetail}.ts` | ✅ 27 tests |
| Lecture serveur cookies + 404 + JSON-LD échappé | `src/features/carnet/detail/{getCarnetDetail,jsonld}.ts`, `src/app/carnets/[id]/page.tsx` | ✅ 5 tests |
| Coquille, top bar, feuille `ckp-` | `src/styles/carnet-profile.css`, `CarnetTopBar`, `CarnetProfileView` | ✅ |
| Carte d'identité + capsule 48 | `CarnetIdentityCard`, `CarnetSectionTabs` | ✅ 12 tests |
| Grille 3 colonnes + mode carte + viewer | `CarnetMediaBlock`, `CarnetTraceMap`, `CarnetMediaViewer` | ✅ 7 tests |
| Sections Récit / Matériel / Nature | `CarnetStorySection`, `CarnetKitSection`, `CarnetNatureSection` | ✅ 5 tests |
| Engagement + commentaires | `useCarnetEngagement`, `useCarnetComments`, `CarnetCommentsPreview`, `CarnetCommentsSheet` | ✅ 10 tests |
| Menu ··· / partage / gestion / carte / signalement | `CarnetMoreMenu`, `CarnetShareSheet`, `CarnetManageSheet`, `CarnetMapSheet` | ✅ 5 tests |

**Total : 75 tests verts** (`npx vitest run src/components/carnet src/features/carnet`), `tsc --noEmit` sans erreur sur le périmètre.

## 2. Preuves visuelles

| Capture | Viewport | Constat |
|---|---|---|
| `ckp-after-430-v2.png` | 430 × 932 | Colonne 410 px, fond `account-bg`, carte 28, cover 96, stats réelles, capsule 5 sections, grille 3 col gap 2, bottom bar 48 sans lentille |
| `ckp-430-top.png` | 430 × 932 | Top bar sur une ligne : retour 38, pilule titre (cover 24), 3 `gbtn` |
| `ckp-430-comments-sheet.png` | 430 × 932 | Feuille commentaires, 3 commentaires réels, composer fixe, `Échap` ferme |
| `ckp-430-map.png` | 430 × 932 | Mode carte, « Aucune trace GPS. », GPX désactivé — état honnête |
| `ckp-1440.png` | 1440 × 900 | Colonne 520 centrée, aucune sidebar, top bar et carte alignées sur la même colonne |

Les captures sont dans `~/.dsh/mcp/screenshots/` (session de recette). Les copies de référence avant refonte restent dans `evidence/`.

## 3. Correctifs de recette (constatés puis corrigés)

1. **Barre de navigation globale superposée.** `MobileNavWrapper` rendait sur la fiche le plateau contextuel « Récit / Carte & GPX / Moments… » et une deuxième barre basse. → `/carnets/[id]` ajouté aux routes sans navigation (`MobileNavWrapper.tsx`), comme `/communaute` et `/compte`.
2. **Capsule illisible.** `.lkdv-capsule` prend sa couleur sur `--lkv-text-secondary`, qui vaut `rgba(255,255,255,.71)` dans le thème : libellés blancs sur verre blanc. → couleurs du Compte reposées localement (encre/muted) + typo 9,5/600 + icône sur libellé.
3. **Top bar sur deux lignes.** `.ckp-topbar` n'était pas `flex` : le groupe gauche et les trois boutons s'empilaient (h 76 au lieu de 38). → `display:flex` + `min-height: 38px`.
4. **`Échap` inopérant sur les feuilles.** `OverlaySheet` ne câble pas la touche (le runtime Compte le fait). → `useSheetEscape` dans les quatre feuilles de la fiche. Vérifié : `overlay: false`, `body.style.overflow` restauré.

## 4. Données réelles vérifiées

- Compteurs : 22 likes, 3 commentaires — identiques à `carnets.likes_count` / `comments_count`. Aucun 24/8 codé en dur.
- Auteur : `demo` / `@lea.fontaine`, score 94 — aucun « Antoine Duprès » (grep = 0 sur le HTML rendu).
- Badge « Vérifié » : présent parce que `verified = true` sur ce carnet ; absent sur les carnets `verified = false` (test unitaire).
- Étapes : 7 jours, `Landmannalaugar → Landmannalaugar` — ce sont les données réelles, aucune valeur inventée.
- Kit : 3,8 kg, somme des `poids_g` réels (1,1 + 0,898 + 0,166 + 0,551 + 1,1).
- Trace : absente → « Aucune trace GPS. » et GPX désactivé ; aucune trace synthétique.
- JSON-LD : présent, sérialisé via `serializeJsonLd` (aucun `</script>` possible).

## 5. Ce qui reste (lot 2)

1. **404 : statut HTTP (résiduel mesuré).** Le corps rend la page `not-found` (« Carnet introuvable », 5 occurrences de « 404 » dans le HTML), mais le statut reste **200** en dev *et* sur `next start` du build de production. `notFound()` a été déplacé dans `generateMetadata` (seul point avant le flush) : statut toujours 200 — comportement de streaming RSC de Next 15.5.28 sur cette route dynamique. À traiter au lot 2 (middleware de résolution ou page non streamée), avec un test `curl -I` de non-régression.
2. **Nettoyage legacy (tâche 9 du plan).** Les 14 composants de l'ancienne fiche et `src/lib/queries/carnet.ts` sont encore présents : plus référencés par la route, à supprimer avec vérification `grep` + `tsc`.
3. **Squelette et erreur.** `loading.tsx` et `error.tsx` de la fiche sont encore les anciens (layout 3 colonnes) : à remplacer par la version `ckp-` du plan (tâche 9, étapes 3-4).
4. **Like / favori connectés.** Non testés en session authentifiée dans cette recette (le navigateur de recette est anonyme) : la logique est couverte par 6 tests unitaires (écriture, retrait, retour arrière, vue unique) mais la persistance réelle reste à prouver en se connectant.
5. **Diff pixel** `npm run design:diff` avant/après : non exécuté (l'avant et l'après n'ont pas le même viewport de référence dans cette session).
6. **Build de production : vert.** `NODE_OPTIONS=--max-old-space-size=6144 DIST_DIR=.next-ckp npm run build` → `EXIT:0`, `Compiled successfully in 26.7s`, route `ƒ /carnets/[id]` à **13,2 kB / 231 kB** First Load JS (l'ancienne fiche mesurait 306 kB gzip). `tsc --noEmit` complet vert avec le même heap — sans lui, `tsc` et le build meurent en `JavaScript heap out of memory` sur cette machine (limite d'environnement, pas de régression applicative).
