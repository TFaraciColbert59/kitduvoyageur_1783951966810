# Carnet → Compte : ce qui a été refondu et ce qui est prouvé

**Date :** 24 octobre 2026, 22 h
**Référence :** `/compte` (MobileCompteV2), mesuré au `getComputedStyle` en 430 × 932.
**Cible :** `/carnets/[id]` (Vercors 5 photos + Lille avec trace GPS).
**Commits :** `bf1400a6` (gabarit), `80b8c8b5` (icônes).
**Prod :** https://kitduvoyageur-1783951966810-8bsm1qb9s.vercel.app/carnets/c823a023-5be7-5f2c-9cdd-67a432cb6a2b (alias `koosmoweb.fr`).

---

## 1. Mesures de référence (Compte, 430 × 932)

| Élément | Compte mesuré |
|---|---|
| Barre du haut | `section.top` padding 6 12 8, rangée 36 (`ig-top`, gap 6), carte à y = 48 |
| Pilule d'identité | 34 de haut, padding 0 11, bord 1 px `rgba(255,255,255,.3)`, fond `.14`, 600 16/16, `ls -.32px`, texte `rgba(255,255,255,.94)`, sans vignette |
| Carte | x 12, y 48, **406 × 541**, rayon 24, **padding 8 12 56**, gradient `.486 → .384`, blur 25,2/1,8/1,05, 5 ombres (2 insets blancs + inset 16 + anneau .5 + `0 10px 30px`) |
| Anneau d'identité | 66, padding 2,5, conique `#17402C → #5B7F55 → #96B391 → #3D7A52`, image 58 à bord blanc 2 px |
| Statistiques | 3 × 101 × 39, padding 2 3, rayon 14, valeur 19/700 `#17402C` `ls -.38px`, libellé 10,5/500 `#56665D` |
| Bio | 11 px/1,22, marge 3 2, lignes de 13,4 |
| Actions | rangée 5 colonnes, anneau 44 (conique, padding 2), disque 38 `rgba(244,247,243,.88)` bord 1 px blanc, libellé 9,8/500, appui `.92` |
| Grille | pleine largeur de la carte, gap 3, tuiles 133 |
| Toggle | 88 × 30 à 10/10 du coin bas droit, cellules 42 × 25, lentille blanche sur l'actif |
| Barre basse | 402 à x 14 (inchangée) |

## 2. Ce qui a changé sur la fiche carnet

1. **Pilule** : plus de vignette ni d'initiale, 34 de haut, blanche bordée, 600/16 — le titre du carnet y vit seul, comme le pseudo du Compte.
2. **Titre** : le `h2` 19/700 et la ligne méta ont quitté la carte. Le `h1` reste (masqué) pour la sémantique et le SEO.
3. **Couverture** : carré 66 r18 → **cercle 66 à anneau conique**, image à bord blanc 2 px, appui `.95`.
4. **Bio** : destination · dates (11,2/400, encre) puis auteur · score · Vérifié (11,2/500, muted) puis le texte (11/1,22, 3 lignes) — la pastille verre `pmi-author` a disparu, le lien vers le profil de l'auteur est conservé.
5. **Actions** : cercles pleins `.5` → **anneaux 44 + disques 38**, libellés 9,8 ; compteurs conservés sur l'anneau.
6. **Carte** : padding 14 → **8 12 56**, **min-height 541**, 5 ombres du Compte, `overflow: hidden`.
7. **Grille** : gap 2 → **3**, gouttière 14 → 12, plus d'arrondi bas (la carte rogne).
8. **Toggle** : ajouté (88 × 30) en bas à droite de la carte, bascule **grille ↔ carte du parcours** ; le GPX vit sur la carte (pastille « GPX », km et D+ sur bandeau) ; le **volet Parcours du drawer est supprimé** (3 volets propriétaire, 2 visiteur).
9. **État vide** : bloc centré sur le verre de la carte (plus de panneau blanc), CTA « Gérer le carnet » pour le propriétaire.
10. **Sections** (Récit, Matériel, Nature, Commentaires) : rayon 24 et verre de contenu `.62` conservés — le verre du profil (`.486`) y rendait le texte illisible sur la toile sombre.

## 3. Preuves

| Preuve | Résultat |
|---|---|
| Captures 430 | `evidence/prod-carnet-430.png`, `v3-carnet-empty-430.png`, `v3-carnet-map-430.png`, `v3-carnet-drawer-430.png`, `v3-carnet-sections-430.png` |
| Captures 768 / 1440 | `evidence/after2-carnet-768.png`, `after2-carnet-1440.png` |
| Référence | `evidence/ref-compte-local-430.png`, `cmp-card-compte.png` |
| Géométrie | carte `[12,48,406,558]` (541 mini), anneau `[26,58,66,66]`, stats `[102,72,302,39]`, grille `[12,280,406,270]`, toggle `[319,566,89,30]` — référence : carte y 48 h 541, anneau 66, cellules 101 × 39, toggle 88 × 30 à (320, 549) |
| Tests unitaires carnet | 40/40 (`CarnetIdentityCard` 14, `CarnetTopBar` 4, `CarnetMomentGrid` 3, `CarnetCardDrawer` 5, panes 8, menu 5, story 1) |
| Suite complète | 12 043 passés, **94 échecs identiques au HEAD** (vérifié dans un worktree propre : mêmes 27 fichiers) |
| `tsc --noEmit` | 0 erreur |
| `next lint` | 1 avertissement préexistant (`exhaustive-deps` sur `engagement.registerView`) |
| `next build` | OK (`NODE_OPTIONS=--max-old-space-size=6144`, `.next` nettoyé) |
| Parcours cliqués | toggle grille ↔ carte (Leaflet + tuiles + GPX), drawer Commentaires, Échap referme, état vide, 404 conservé |
| Prod 430 | carte `[12,48,406,558]`, toggle `[319,566,89,30]`, pilule `[56,6,232,34]`, 3 icônes d'action peintes |
| Prod état vide | carte `[12,48,406,541]`, toggle `[319,549,89,30]` — identique au Compte `[320,549,88,30]` |
| Prod 1440 | colonne 406 centrée, barre 402 |

## 4. Points ouverts (à arbitrer)

1. **Contraste du texte secondaire.** Mesuré sur la fiche : `#56665D` sur le verre = **1,7:1** (sections) à **2,0:1** (carte), encre `#172B24` = 3,2 à 4,8. Sur `/compte` le même texte atteint 4,3–4,5 parce que son fond est clair (`account-bg.webp` + surface `rgb(207,214,200)`), alors que la fiche carnet hérite de la toile sombre de l'application. Correctif possible : éclaircir la toile sous la colonne, ou remonter l'opacité des cartes de contenu à `.72` (seuil 4,5 atteint pour l'encre seulement).
2. **Volet Parcours supprimé** : la carte est passée dans la carte d'identité (toggle). Le GPX et les km/D+ restent accessibles. Décision validée par le plan, test du drawer mis à jour (2/3 volets).
3. **Pilule tronquée** : 236 px de large au maximum (place du retour et des 3 boutons) ; le titre complet reste dans `title`, dans l'`aria-label` et dans le `h1` masqué.
4. **Deux agents écrivaient dans ce worktree en même temps** (commits `12488ed5` et `492a8198` produits pendant la séance). L'état livré est cohérent et testé, mais un autre process peut encore modifier `community-feed.css` / `tsconfig.json` (non commités par moi).
5. **Icônes en masque CSS** : sur une charge à froid, les glyphes `/icons/sf/*.svg` n'apparaissent qu'une fois le masque chargé (constaté sur Vercel). Rien à corriger côté fiche — c'est la primitive `Icon` ; un `preload` des masques critiques supprimerait le clignotement.
6. **Desktop 1440** : la fiche garde la colonne 406 centrée + la barre 402 ; le Compte, lui, s'affiche dans un cadre téléphone. Hors périmètre de cette passe (déjà arbitré dans les lots précédents).
