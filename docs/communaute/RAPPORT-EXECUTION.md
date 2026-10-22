# Rapport d'exécution — Refonte Communauté (lot 1 + socle)

**Date :** 2026-10-22 · **Branche :** `chantier/communaute-design` · **Aucun push, aucun déploiement, aucune migration.**

Ce rapport remplace les cases du plan pour ce qui a été livré. Il dit aussi, sans détour, ce qui
n'a **pas** été fait.

---

## 1. Ce qui est livré

| Livrable | Fichier | État |
|---|---|---|
| Grammaire capsule partagée (48 px + 30 px) | `src/styles/liquid-capsules.css` (créé), importé dans `src/app/layout.tsx` | ✅ |
| Primitive capsule 48 px | `src/components/ui/CapsuleTabs.tsx` (créé) | ✅ |
| Migration du sélecteur du drawer Profil sur la primitive | `src/components/compte/drawer/SlotSelector.tsx` | ✅ DOM identique |
| Coquille immersive | `src/components/communaute/shell/CommunityShell.tsx` (créé) | ✅ |
| Carte héro en verre | `src/components/communaute/shell/CommunityHeroCard.tsx` (créé) | ✅ |
| Drawer contexte (Massifs / Clubs) | `src/components/communaute/shell/CommunityContextDrawer.tsx` (créé) | ✅ |
| Hub mobile : capsule unique des 6 espaces + états | `src/components/communaute/MobileCommunityHub.tsx` | ✅ |
| Page : coquille + héro + contexte, mobile et desktop | `src/app/communaute/page.tsx` | ✅ |
| Squelette aligné sur l'anatomie réelle | `src/app/communaute/loading.tsx` | ✅ |
| Re-skin verre de la page | `src/styles/community-social.css` | ✅ |
| Suppression du héro mort | `src/components/communaute/CommunityHeroOverview.tsx` (supprimé) | ✅ |

## 2. Preuves exécutées

| Commande | Résultat |
|---|---|
| `npm run type-check` | **0 erreur** |
| `npx vitest run src/components/ui/__tests__/CapsuleTabs.test.tsx` | **7/7** |
| `npx vitest run src/components/compte/drawer/__tests__` | **211/211** (24 fichiers) — aucune régression du drawer Profil |
| `npx vitest run tests/design/community-social-contract.spec.ts tests/design/community-audience-security.spec.ts tests/design/community-reels-security.spec.ts tests/community tests/design/p5-direction-tokens.spec.ts tests/design/lot2-shell.spec.ts tests/design/m02-destination-registry.spec.ts` | **79/79** (9 fichiers) |
| `npm run build` | **succès** (First Load JS partagé : 104 kB) |
| Captures | `docs/communaute/baseline/` (avant) et `docs/communaute/after/` (après), 430 × 932 et 1440 × 900 |

## 3. Ce qui n'est pas livré (et pourquoi)

| Élément du plan | Statut | Raison |
|---|---|---|
| `LensSelector` (capsule 30 px) | **retiré** | Aucun consommateur légitime dans ce lot : les filtres nommés (massifs, catégories de clubs) ont besoin de libellés, donc de `Chip`. Un composant extrait mais non consommé serait un composant mort, interdit. La capsule 30 px reste celle des drawers, inchangée. |
| Suppression du `NavigationPlateau` sur `/communaute` | **non fait** | Le masquer exige de toucher `destinationRegistry.hasExtendedNav`, qui pilote aussi la **réservation de hauteur** du shell (`AppShell`). Hors périmètre « aucune régression » : risque de trou en bas de page sur toutes les routes. Les deux barres sont visibles (capsule en page + plateau global), comme `/compte` qui a aussi deux barres (`.tb` + `.acc`). |
| Panes glissantes (`LensPager`) sur le hub | **non fait** | `LensPager` dépend des feuilles `.lkdv-lens-pager/-track/-pane` déclarées dans `DRAWER_V2_CSS` (injectées par `SlotShell`). Les réutiliser hors du drawer imposerait d'importer un CSS de 45 règles. Le changement d'espace reste au tap, avec la lentille 420 ms. |
| Extraction `useCommunityHubFeed` / `useCommunityHubTab` | **non fait** | Décision de risque : le code de chargement (5 requêtes, erreurs par section, pagination, identité) est correct et couvert indirectement ; le déplacer sans nécessité functional n'apportait rien au rendu et augmentait le risque. Il reste dans `page.tsx`. |
| Re-skin des sous-routes (`decouvrir`, `post/[id]`, `reels`, `publier`) | **non fait** | Lot 2 du plan, non entamé. |
| `error.tsx` | **non modifié** | Déjà une `Card` verre + `Button` : conforme. |
| Écarts extraits : `CommunityCommentsSheet` | **non fait** | Lot suivant (Task 13). |

## 4. Écart de fidélité assumé : l'encre de la page

Le thème global du site (`liquid-ios27`) est un thème **blanc sur photo** : `--lkv-text-primary`
y vaut `#ffffff`. La Communauté pose désormais des surfaces claires (verre + voile), donc elle
**rescope** les trois niveaux d'encre sur les primitives existantes `--lkv-forest-*`
(`community-social.css`, section 2), avec leur équivalent sous `.dark`. Aucune couleur nouvelle :
ce sont les jetons de `tokens.css`.

## 5. Non-régression `/compte`

Aucun fichier de `/compte` n'a changé de rendu :

- `SlotSelector` produit **exactement** le même DOM (`div.segc.lg-tabs.lens-on.lkdv-slot-selector`,
  `role="tablist"`, `aria-label="Slots du profil"`, `data-slot`, ids `lkdv-slot-tab-*` / `-panel-*`,
  roving `tabIndex`). Preuve : 211/211 tests drawer, dont `SlotSelectorAria` et `SlotShell`.
- La seule classe ajoutée au DOM du drawer est `lkdv-capsule`. Toutes les propriétés qu'elle porte
  (`height`, `padding`, `border-radius`, `background`, `border`, `display`, `width`,
  `grid-auto-columns`, `box-shadow`, `overflow`, `flex`) sont déjà posées **avec `!important`** par
  `DRAWER_SHELL_CSS` sur un sélecteur plus spécifique (`.lkdv-drawer-shell .lkdv-drawer-topnav
  .lkdv-drawer-tabs`), donc sans effet visuel.
- `CompteLiquidGlassV8.tsx`, `DrawerShell.tsx`, `SlotShell.tsx`, `ProfileDrawerHost.tsx` **n'ont pas
  été modifiés** (ils portent des modifications non commitées antérieures à ce chantier).

## 6. Reste à faire pour clore le plan

1. Sous-routes (Task 10-12).
2. `CommunityCommentsSheet` (Task 13).
3. A11y : `npm run test:a11y` sur `/communaute` (non exécuté ici ; le serveur dev n'était plus disponible en fin de session).
4. Captures 360 / 390 / 768 / 1024 et thème sombre.
5. Décision sur le `NavigationPlateau`.
