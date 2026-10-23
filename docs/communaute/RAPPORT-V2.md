# Rapport — Communauté v2 (grille + drawers)

**Date :** 2026-10-23
**Branche :** `chantier/communaute-v2` (merge `bc440287`, puis merge de la grille)
**Périmètre livré :** le hub `/communaute` mobile + desktop, la capsule des six espaces, le héro,
les stories à la une, la **grille de tuiles du Compte** et les **drawers de contenu**.
**Aucun push, aucun déploiement, aucune migration distante.**

---

## 1. Ce qui est livré

| Livrable | Fichier | Preuve |
|---|---|---|
| Capsule d'identité 34 px + 3 actions | `MobileCommunityHeader.tsx`, `community-social.css` | capture 430 |
| Héro 24 px : avatar 66 px, 3 totaux réels, contexte, actions, stories 44 px | `CommunityHeroCard.tsx`, `CommunityStoriesBar.tsx` | captures 430 / 1440 |
| Totaux réels (`count` SQL) | `useCommunityTotals.ts` | 196 publications · 18 clubs · 18 sorties |
| Capsule 48 px des six espaces — **filtre** de la grille | `MobileCommunityHub.tsx`, `CapsuleTabs.tsx` | capture 430 |
| Suppression du plateau texte `/communaute` | `destinationRegistry.ts` | une seule capsule locale |
| **Grille de tuiles identiques au Compte** (3 col., 1/1.05, rayon 9, badge verre) | `CommunityGrid.tsx`, `community-social.css` | capture 430 / 1440 |
| **Drawers de contenu** : publication, carnet, club, expédition, sortie | `CommunityContentDrawer.tsx` | capture drawer |
| Filtres réels : Tout, Carnets, Clubs, Expéditions, Sorties, Entraide | `CommunityGrid.tsx` | 30 tuiles « Tout », filtres par type |
| Deep links : `?tab=`, `?post=` (ouvre le drawer) | `page.tsx`, `MobileCommunityHub.tsx` | test manuel |
| Desktop en une colonne 760 px, 4/5 colonnes de tuiles | `page.tsx`, `community-social.css` | capture 1440 |
| `h1`, état invité, état vide, fin de liste | `page.tsx`, `MobileCommunityHub.tsx` | `h1=1` |
| Tests adaptés | `tests/design/community-social-contract.spec.ts`, `tests/visual/community-social.spec.ts` | 41/41 + 5/5 |

Captures : `docs/communaute/v2-after/communaute-430-grille-v2.png`,
`communaute-430-drawer.png`, `communaute-1440-v2.png`.

---

## 2. Preuves exécutées

| Commande | Résultat |
|---|---|
| `NODE_OPTIONS=--max-old-space-size=6144 npx tsc --noEmit` | **0 erreur**, exit 0 |
| `npx vitest run tests/design/community-social-contract.spec.ts tests/design/community-audience-security.spec.ts tests/design/community-reels-security.spec.ts tests/community tests/design/lot2-shell.spec.ts` | **41/41**, 7 fichiers |
| `PW_BASE_URL=http://localhost:4000 npx playwright test tests/visual/community-social.spec.ts --config=playwright.visual.config.ts --project=iphone-14-pro-chromium` | **5/5** |
| Navigation | `Carnets` filtre la grille ; `?tab=carnets` conservé ; `?post=` ouvre le drawer |
| Console | 0 erreur sur `/communaute` et `/communaute/decouvrir` |
| Grille | 30 tuiles « Tout », 6 filtres, drawer `role="dialog"` |

---

## 3. Le modèle d'interaction

- **La page ne navigue plus vers `/carnets`, `/clubs`, `/groupes` ou `/entraide`** depuis la
  capsule : les six espaces sont des **filtres** de la grille. Les routes restent accessibles
  directement pour les liens externes.
- **Chaque tuile ouvre un drawer** (`Sheet` canonique, hauteur auto, surface lisible) :
  - publication → carte complète avec like, commentaires, partage, favori ;
  - carnet → couverture, titre, destination, lien `/carnets/[id]` ;
  - club → nom, description, membres, lien `/clubs/[id]` ;
  - expédition → nom, destination, places, lien `/groupes/[id]` ;
  - sortie → date, lieu, inscrits, bouton `S'inscrire`.
- **« Tout » privilégie les contenus visuels** (publications, carnets, clubs, expéditions avec
  image) et **exclut les sorties**, qui ont leur propre filtre. La grille est plafonnée à 30
  tuiles pour ne pas devenir un mur de 60 lignes ; les filtres par type montrent l'intégralité.
- **Le style des tuiles est celui du Compte** : 3 colonnes, `gap: 3px`, `aspect-ratio: 1/1.05`,
  rayon 9, fond forêt, badge verre 24 px. À partir de 768 px : 4 colonnes ; 1280 px : 5.

---

## 4. Ce qui reste du plan

| Élément | Statut | Raison |
|---|---|---|
| Extraction `lkdv-glass.css` + migration à l'identique de `/compte` | **non fait** | la grammaire reste recopiée dans `community-social.css` ; `0 duplication` non prouvé |
| Feuille de commentaires séparée | **non fait** | les commentaires restent inline dans la carte de post, à l'intérieur du drawer |
| Carte de post découpée et variante « drawer » | **partiel** | la tuile est identique au Compte ; la carte du drawer reste la carte de fil |
| Sous-routes `decouvrir`, `post`, `reels`, `publier` | **non fait** | elles gardent `.lkdv-subheader` ; `publier` garde `Header`/`Footer` |
| A11y complète (`test:a11y`, axe) | **non exécuté** | à faire |
| Perf : budget 265 KiB | **non atteint** | First Load mesuré avant la grille ≈ 315 KiB ; à remesurer |
| Suite `npm test` complète | **non exécutée** | tests ciblés + visuels seulement |
| `post_type: 'event'` | **non corrigé** | correctif séparé |

---

## 5. Écarts assumés

- **Le drawer de publication réutilise `CommunityPostCard`** : les actions et commentaires sont
  réels, mais la carte garde sa mise en page de fil (elle n'est pas le modal Instagram du Compte).
  La **tuile** de prévisualisation, elle, est identique au Compte.
- **La barre basse reste celle de l'application** (5 destinations), pas le jeu d'onglets local du
  runtime Compte.
- **Le contexte parle de « destinations »**, pas de « massifs » : la donnée réelle contient des
  villes et des pays.
- **L'entraide** n'a pas de tuiles : son filtre affiche une carte d'entrée avec le lien `/entraide`.
  Il n'y a pas de données `qa_questions` chargées dans ce hub.

---

## 6. Conflit d'environnement

Le worktree principal a été réinitialisé plusieurs fois pendant l'implémentation. Le chantier a été
mené dans un **worktree isolé** (`/Users/fr168256/Desktop/lkdv-communaute-v2`) puis fusionné dans
`chantier/communaute-v2`. Le serveur principal tourne sur `http://localhost:4000` avec le code
fusionné.
