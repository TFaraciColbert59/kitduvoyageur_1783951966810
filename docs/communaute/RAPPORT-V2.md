# Rapport — Communauté v2 (hub)

**Date :** 2026-10-23
**Branche :** `chantier/communaute-v2` (merge `bc440287`)
**Périmètre livré :** le hub `/communaute` mobile + desktop, la capsule des six espaces, le héro,
les stories à la une, le fil/grille, la pagination et le contexte.
**Aucun push, aucun déploiement, aucune migration distante.**

---

## 1. Ce qui est livré

| Livrable | Fichier | Preuve |
|---|---|---|
| Capsule d'identité 34 px + 3 actions | `src/components/communaute/MobileCommunityHeader.tsx`, `community-social.css` | capture 430 |
| Héro 24 px : avatar 66 px, 3 totaux réels, contexte, actions, stories 44 px | `src/components/communaute/shell/CommunityHeroCard.tsx`, `CommunityStoriesBar.tsx` | captures 430 / 1440 |
| Totaux réels (`count` SQL) | `src/features/community/useCommunityTotals.ts` | 196 publications · 18 clubs · 18 sorties |
| Capsule unique 48 px des six espaces, icônes + libellés | `MobileCommunityHub.tsx`, `CapsuleTabs.tsx` | capture 430 |
| Suppression du plateau texte `/communaute` | `src/components/mobile-nav/destinationRegistry.ts` | capture 430 : une seule capsule locale |
| Fil en verre 20 px + vue Grille + sélecteur 30 px | `MobileCommunityHub.tsx`, `community-social.css` | captures 430 fil / grille |
| « Charger plus » réel (20 → 40) | `src/app/communaute/page.tsx` | test manuel : 20 puis 40 cartes |
| Contexte honnête : destinations réelles, pas de faux massifs | `CommunityContextDrawer.tsx` | drawer ouvert, destinations chargées |
| Desktop en une colonne 760 px, sans `Header` ni sidebars | `src/app/communaute/page.tsx`, suppression des deux sidebars | capture 1440 |
| `h1` réel, état invité, état vide, fin de liste | `page.tsx`, `MobileCommunityHub.tsx` | `h1=1`, captures |
| Tests de non-régression adaptés | `tests/design/community-social-contract.spec.ts`, `tests/visual/community-social.spec.ts` | 41/41 + 5/5 |

Captures : `docs/communaute/v2-after/` (430 clair, 430 grille, 430 scroll, 1440).

---

## 2. Preuves exécutées

| Commande | Résultat |
|---|---|
| `NODE_OPTIONS=--max-old-space-size=6144 npx tsc --noEmit` | **0 erreur**, exit 0 |
| `npx vitest run tests/design/community-social-contract.spec.ts tests/design/community-audience-security.spec.ts tests/design/community-reels-security.spec.ts tests/community tests/design/lot2-shell.spec.ts` | **41/41**, 7 fichiers |
| `PW_BASE_URL=http://localhost:4000 npx playwright test tests/visual/community-social.spec.ts --config=playwright.visual.config.ts --project=iphone-14-pro-chromium` | **5/5** |
| `npm run build` (worktree, code identique) | **Compiled successfully**, 337 pages générées |
| Navigation | `Carnets` → `/carnets` ; `?tab=entraide` → `/entraide` |
| Console | 0 erreur sur `/communaute` et `/communaute/decouvrir` |

---

## 3. Ce qui reste du plan

| Élément | Statut | Raison |
|---|---|---|
| Extraction `lkdv-glass.css` + migration à l'identique de `/compte` | **non fait** | le hub consomme une grammaire recopiée dans `community-social.css` ; `0 duplication` n'est pas encore prouvé |
| Feuille de commentaires (`CommunityCommentsSheet`) | **non fait** | commentaires encore inline dans `CommunityPostCard` |
| Carte de post découpée en sous-composants | **partiel** | surface verre appliquée, découpage interne non fait |
| Sous-routes `decouvrir`, `post`, `reels`, `publier` | **non fait** | elles gardent `.lkdv-subheader` ; `publier` garde `Header`/`Footer` |
| A11y complète (`test:a11y`, axe) | **non exécuté** | à faire en Task 18 |
| Perf : budget 265 KiB | **non atteint** | `/communaute` First Load ≈ 315 KiB avant lazy-loading des overlays stories ; à remesurer après le split |
| Suite `npm test` complète | **non exécutée** | seuls les tests ciblés + visuels ont été rejoués |
| `post_type: 'event'` | **non corrigé** | correctif séparé, hors périmètre |

---

## 4. Écarts assumés

- **La capsule des six espaces est sticky sous la capsule d'identité** (58 px) : elle reste
  accessible, mais elle flotte au-dessus du contenu comme la capsule du Compte.
- **Le héro affiche des totaux de communauté** (`publications`, `clubs`, `sorties`), pas les
  compteurs du profil. Les trois valeurs viennent d'un `count` SQL ; si une requête échoue, la
  cellule affiche « — ».
- **Le contexte parle de « destinations »**, pas de « massifs » : `carnets.destination` contient
  parfois « Lille, France » ou « Belgique ». Le libellé suit la donnée réelle.
- **La barre basse reste celle de l'application** (5 destinations) : le runtime Compte a un jeu
  d'onglets local différent ; on ne l'a pas dupliqué.
- **Le desktop n'est pas la maquette iPhone du Compte** : c'est la même page en 760 px, sans
  cockpit. C'est la décision D2 du spec.

---

## 5. Conflit d'environnement rencontré

Le worktree principal a été réinitialisé plusieurs fois pendant l'implémentation (fichiers
`page.tsx` et `CommunityStoriesBar.tsx` revenus à `HEAD`). Le chantier a donc été mené dans un
**worktree isolé** (`/Users/fr168256/Desktop/lkdv-communaute-v2`, branche
`chantier/communaute-v2-build`) puis fusionné dans `chantier/communaute-v2` (`bc440287`).
Aucun fichier de `src/` n'a été écrasé dans le worktree principal sans merge.

Le serveur de développement principal tourne sur `http://localhost:4000` avec le code fusionné.
