# Refonte Communauté Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** faire de `/communaute` la même pièce que `/compte` — même fond, mêmes capsules 48/30 px, mêmes lentilles, mêmes drawers, mêmes états — en extrayant la grammaire au lieu de la copier, sans perdre une fonctionnalité ni casser `/compte`.

**Architecture :** la grammaire « capsule + lentille » est extraite des trois endroits où elle est aujourd'hui dupliquée (`CompteLiquidGlassV8.tsx`, `DRAWER_SHELL_CSS`, `DRAWER_V2_CSS`) vers `src/styles/liquid-capsules.css` et deux primitives React (`CapsuleTabs`, `LensSelector`). `/communaute` devient une composition : `AppShell` → fond immersif → capsule d'identité → carte héro → capsule unique des 6 espaces → `LensPager` de 6 panes → barre basse. `/compte` ne change pas d'un pixel et le prouve.

**Tech Stack :** Next.js 15 (App Router), React 19, TypeScript strict, Tailwind, Supabase, Vitest, Playwright, CSS-in-component existant.

**Spec :** `docs/superpowers/specs/2026-10-22-communaute-refonte-design.md`

## Global Constraints

- Aucune couleur, ombre, rayon, police ou token nouveau. Seuls `--lkv-*`, `--glass-*`, `--label*`, `--tint`, `--accent`, `--pg`, `--sf` existants.
- `#E4501C` et la liste d'interdits de `docs/Design-tokens.md:27-38` restent interdits (0 occurrence aujourd'hui dans `src/app/communaute` et `src/components/communaute`).
- Capsule principale 48 px / icônes 18 px ; capsule secondaire 30 px / icônes 15 px ; contenu drawers 14 px latéral, 62 px bas ; cible tactile 44 px ; rayons 18–22 px cartes, 999 px capsules.
- Mouvement `transform`/`opacity`, capsule 420 ms `cubic-bezier(.32,.72,0,1)` (`DrawerShell.tsx:208`), `prefers-reduced-motion` respecté partout.
- Aucun `z-[9999]` local : échelle `src/lib/ui/zIndex.ts`. **Violation existante à corriger** : `CommunityStoriesBar.tsx:803` (`z-[9999]`).
- Aucun en-tête dans les drawers (`docs/superpowers/specs/2026-10-22-refonte-contenu-drawers-design.md:54`).
- Interdits absolus : importer `CompteLiquidGlassV8.tsx` depuis `src/components/communaute/**` ; `any` non justifié ; dépendance nouvelle ; `--bottom-tab-base-height` / `--bottom-tab-extended-height` n'importe où dans `src/` (`tests/design/lot2-shell.spec.ts:85-92`) ; `pathname?.startsWith('/communaute')` dans `AppShell` (`:105`).
- Tests verrouillants à ne pas renommer : `lkdv-community-experience`, `lkdv-social-post` (+ `-media`, `-actions`, `-caption` dans cet ordre), `lkdv-social-story-shelf` < `lkdv-social-category-tabs` < `lkdv-social-mobile-stream`, `lkdv-social-stories-rail`, `lkdv-community-reels-track`, `lkdv-social-reproduce`, `lkdv-social-profile-tile aspect-[3/4]`, `.lkdv-slot-shell`, `.lkdv-slot-selector`, `.lkdv-lens-pager`, `.lkdv-lens-tabs`, `[data-testid="slot-content"]`, `[data-hscroll="true"]`.
- Un commit par tâche, message conventionnel français, jamais `--no-verify`, jamais `git push`.

---

## 1. Verdict exécutif

**Gardé :** toutes les routes, tous les deep links, toutes les requêtes Supabase, les 6 espaces, les stories, la barre basse, `CommunityPostCard` (logique intacte), `DrawerShell`/`SlotShell`/`LensPager`/`SlotSelector`, les 24 tests des drawers.

**Changé :** la peau du mobile (papier → verre), le sélecteur des 6 espaces (3 → 1 capsule), la localisation de la grammaire capsule (3 copies → 1 fichier + 2 primitives), les états (ajout hors-ligne), le desktop (même langage, pas de 2ᵉ cockpit).

**Disparaît :** le `Tabs` scrollable du hub, le plateau secondaire sur `/communaute` seulement, les en-têtes maison de `decouvrir`/`reels`, les filets 1 px et les plaques opaques de `community-social.css`.

**Risque principal :** l'extraction CSS déplace une règle et fait bouger `/compte` de quelques pixels. Mitigation : capture avant/après à 430/768/1440 après **chaque** tâche de fondation, rollback immédiat sinon.

**Effort :** 16 tâches, 5 phases. Fondations sans effet visuel (1 j), hub mobile (2 j), desktop (0,5 j), sous-routes (1,5 j), post/feuilles (1 j), a11y/perf/tests/doc (1 j). Soit **7 jours ouvrés**.

---

## 2. Inventaire de l'existant

| Élément | Chemin | Rôle | État | Preuve |
|---|---|---|---|---|
| Page hub | `src/app/communaute/page.tsx` | Client component : data + 2 rendus (mobile/desktop) | À découper | `:1`, `:408-877` |
| Mapping onglets | idem | `?tab=` → `CommunityHubTab`, whitelist 6 valeurs | Gardé | `:42-47`, `:49-56` |
| Routage onglets | idem | carnets/clubs/groupes → vraies routes ; fil/evenements/entraide → `?tab=` | Gardé | `:61-72` |
| Chargement | idem | 5 `Promise.allSettled`, une section par onglet (lazy) | Gardé | `:137-180`, `:330-358` |
| Erreurs par section | idem | `sectionErrors` + « Réessayer » | Gardé | `:184-210`, `:487-501` |
| Pagination fil | idem | fenêtre croissante de 20 | Gardé | `:83-85`, `:233-235`, `:532-544` |
| État perso | idem | likes/favoris en une passe | Gardé | `:262-280` |
| Auteurs | idem | `fetchPublicProfilesWith` (vue `public_profiles`) | Gardé | `:283-301` |
| Deep links | idem | `?post=` scroll + highlight, `?comment=` | Gardé | `:360-372` |
| Filtres carnets/clubs | idem | `useMemo` catégorie + recherche | Gardé | `:374-406` |
| Racine visuelle | idem | `lkdv-community-experience` (**testé**) | Gardé | `:409` |
| Rendu mobile | idem | `AppShell` + `MobileCommunityHub` | À refondre | `:414-442` |
| Rendu desktop | idem | `Header` + 3 colonnes 280/1fr/310 | À adapter | `:447-875` |
| Hub mobile | `src/components/communaute/MobileCommunityHub.tsx` | 6 sections inline + `Tabs` + pull-to-refresh | À refondre | `:87-432` |
| `Tabs` du hub | idem | 6 onglets texte, scrollable (2ᵉ sélecteur) | **Supprimé** | `:120-134` |
| Massifs codés | idem | `MASSIFS` en dur (5) | Remplacé par données réelles | `:45` |
| En-tête mobile | `src/components/communaute/MobileCommunityHeader.tsx` | Brand + menu créer + recherche + messages | À re-skinner | `:44-101` |
| Carte post | `src/components/communaute/CommunityPostCard.tsx` | 1 498 lignes : média, actions, commentaires, partage, signalement | Présentation à extraire | `:339` (like), `:536` (share), `:580` (masquer), `:596` (signaler) |
| Ordre interne post (**testé**) | idem | média → actions → légende → commentaires | Gardé | `:855`, `:965`, `:1038`, `:1051` |
| Stories | `src/components/communaute/CommunityStoriesBar.tsx` | barre + composer + archives | Logique gardée, peau à revoir | `:96`, `:603`, `:803` (`z-[9999]`) |
| Viewer stories | `src/components/communaute/StoriesViewer.tsx` | plein écran | Gardé | 724 l. |
| Archives / vues | `StoriesArchiveSheet.tsx`, `StoryViewsSheet.tsx` | feuilles | Gardé | 365 / 210 l. |
| Commentaires | `src/components/communaute/CommentItem.tsx` | ligne commentaire | Gardé | 350 l. |
| Sidebar gauche | `src/components/communaute/CommunityLeftSidebar.tsx` | nav desktop + massifs + CTA | À adapter | `:45-108` |
| Sidebar droite | `src/components/communaute/CommunityRightSidebar.tsx` | événements/clubs/thème | À adapter | `:25-92` |
| Héro desktop | `src/components/communaute/CommunityHeroOverview.tsx` | carte « Le Camp de Base » | Devient le héro partagé | `:18-31` |
| CSS communauté | `src/styles/community-social.css` | 782 l., papier/Instagram | À re-skinner | `:5` (**testé**), `:58-75`, `:190-306`, `:747-782` |
| Découverte | `src/app/communaute/decouvrir/page.tsx` | grille 3 col + recherche | Lot 2 | `:85-118` |
| Post détail | `src/app/communaute/post/[id]/page.tsx` | carte unique | Lot 2 | `:60-69` |
| Reels | `src/app/communaute/reels/page.tsx` | plein écran, snap | Lot 2 | `:160-193` |
| Publier | `src/app/communaute/publier/page.tsx` | 1 349 l., composer | Lot 2 | `:653`, `:1329-1346` |
| Pro | `src/app/communaute/pro/page.tsx` | ré-export | Inchangé | `:1` |
| Layout/meta | `src/app/communaute/layout.tsx` | canonical, OG, JSON-LD | Inchangé | `:5-47` |
| Loading | `src/app/communaute/loading.tsx` | squelettes | À re-skinner | `:1-42` |
| Error | `src/app/communaute/error.tsx` | carte d'erreur | À re-skinner | `:1-46` |
| Drawer shell | `src/components/compte/drawer/shell/DrawerShell.tsx` | capsule 48 + 2ᵉ niveau 30 + piste 420 ms | Étendu | `:202-236` |
| Slot shell | `src/components/compte/drawer/SlotShell.tsx` | coquille slot + `LensPager` | Étendu | `:289-333` |
| Slot selector | `src/components/compte/drawer/SlotSelector.tsx` | capsule 5 slots | Étendu | `:96-120` |
| Lens pager | `src/components/compte/drawer/LensPager.tsx` | swipe 24 px, snap 250 ms | Réutilisé | `:6-10` |
| Hôte profil | `src/components/compte/drawer/ProfileDrawerHost.tsx` | 5 slots + verrou privé | Réutilisé | `:54-99`, `:206` |
| Slot communauté | `src/components/compte/drawer/slots/CommunitySlot.tsx` | 3 lentilles (défis/clubs/cordée) | Réutilisé | `:393-439` |
| Cartes drawer | `src/components/compte/drawer/cards/*` | 14 cartes | Réutilisées | dossier |
| Background partagé | `src/components/compte/CompteBackground.tsx` | toile `lkv-app-background` | Réutilisé | `:11-18` |
| Plateau secondaire | `src/components/mobile-nav/navigation/NavigationPlateau.tsx` | 6 onglets bas | Étendu (masqué sur `/communaute`) | `:82-89` |
| Shell de page | `src/components/shell/AppShell.tsx` | scroll unique, safe areas, nav | Réutilisé | `:13-106` |
| Baseline type-check | — | `tsc --noEmit` | **Vert** | exécuté 2026-10-22 |
| Baseline tests | — | échecs préexistants `worldFormats` + `free-departure-store` (localStorage/jsdom) | **Rouge localisé** | voir §14 R1 |
| Captures | `docs/communaute/baseline/` | 5 PNG 430/1440 | Créées | dossier |

---

## 3. Anatomie du design de référence

Source : `src/components/compte/CompteLiquidGlassV8.tsx` (+ `compte-liquid-glass-v8-runtime.js`), captures `docs/communaute/baseline/compte-430x932-light.png` et `compte-1440x900-light.png`.

| # | Brique | Composant / sélecteur | Dimensions / comportement | Où |
|---|---|---|---|---|
| 1 | Fond immersif | `.lkdv-compte-v8`, `.phone`, photo + voile | plein cadre, `background:#faf9f5` puis photo, veille `--ga` | `CompteLiquidGlassV8.tsx` bloc `.lkdv-compte-v8` |
| 2 | Capsule d'identité | `.ig-top`, `.ig-handle` (34 px), `.gbtn` (34 px) | verre, radius 999, 3 boutons ronds | idem, `.ig-top*` |
| 3 | Carte héro | `#card.cs`, `.ig-header`, `.ig-stats`, `.ig-actions` | radius 24, padding 9/11, avatar 66 px anneau conique, 3 stats | idem |
| 4 | Capsule sections | `.segc.lg-tabs.lens-on` | 48 px, `--n`, `padding:2px`, radius 999 | idem + `DRAWER_SHELL_CSS` l.207 |
| 5 | Lentille | `.sel-lens` (`--i`) | `translateX(calc(var(--i)*100%))`, 420 ms | `DrawerShell.tsx:208` |
| 6 | Grille / tuiles | `.ig-grid`, `.ig-tile` | 3 col, gap 3, `aspect 1/1.05`, radius 9 | idem |
| 7 | Sélecteur flottant | `.ig-tabs-float` > `.ig-tabs` (30 px), `.ig-th.lens` | bas-droite 10 px, icônes 15 px, `width: calc(var(--n)*44px + 5px)` | `DrawerShell.tsx:216-220`, `SlotShell.tsx:299-303` |
| 8 | Carte contexte | `.ctx` + `.mapzone` (MapLibre 3D) | overlay blur 14, box 310 px | idem — **non repris** (D3) |
| 9 | Drawers | `.sheet`, `.sh-b`, `.sw-wrap[data-det]` | detents medium/large, slide 420 ms `lkdvSheetInRight/Left` | idem, `:1948-1951` runtime |
| 10 | Barre basse | `.tabbar` > `.tb` (48 px) | 5 destinations, lentille active | idem ; en prod : `BottomTabBar` via `AppShell` |
| 11 | États | `.lkdv-drawer-skeleton`, `-state[data-state]`, `-auth` | shimmer 1.4 s, vide/erreur centrés | `DrawerShell.tsx:221-233` |
| 12 | Mouvement | transitions `transform`/`opacity` | 420 ms `cubic-bezier(.32,.72,0,1)` ; pager 250 ms | `DrawerShell.tsx:208,214` ; `LensPager.tsx:6-10` |
| 13 | Tokens | `--page`, `--label`, `--label2`, `--label3`, `--tint`, `--accent`, `--good`, `--bad`, `--pg`, `--sep`, `--soft`, `--ga` | aucun hex nouveau autorisé | `CompteLiquidGlassV8.tsx` bloc `:root` local |
| 14 | CSS réel | `!important` massif sur les shells, inline non-`!important` sur la base | duplication `.segc` (l.1602) / `.ig-tabs` (l.802, l.1169) / `DRAWER_*_CSS` | 3 sources |

**Défauts constatés dans la référence, à ne pas propager :**
- `CompteLiquidGlassV8.tsx:265,418,550,611,658` : `#172B24` / `#56665D` en dur au lieu de `var(--label)`.
- `.lkdv-compte-v8` réinitialise `background:#faf9f5; color:#141413` (hors palette documentée).
- À 1440 × 900 le rendu est un **cadre d'iPhone + éditorial** (`status`, `island`, `home`, `aside.notes`) : ce n'est pas une mise en page desktop.
- Le thème sombre n'existe pas pour cette surface : capture `prefers-color-scheme: dark` identique à la capture claire (`compte-430x932-dark.png`).

---

## 4. Matrice de réutilisation 100 %

**28 réutilisés tels quels · 7 étendus · 9 extraits · 0 dupliqué · 0 nouveau.**

### 4.1 Réutilisés tels quels (28)

| Besoin Communauté | Composant | Chemin | Justification | Test de non-régression |
|---|---|---|---|---|
| Fond de page | `CompteBackground` | `src/components/compte/CompteBackground.tsx:11` | toile partagée déjà utilisée par `/carnets`, `/clubs` | capture `/carnets` |
| Shell, scroll, safe areas, nav | `AppShell` | `src/components/shell/AppShell.tsx:55` | un seul conteneur de scroll (loi shell) | `tests/design/lot2-shell.spec.ts` |
| Navigation basse | `BottomTabBar` (via `AppShell`) | `src/components/mobile-nav/...` | registre de destinations | `m02-destination-registry.spec.ts` |
| Glissement des panes | `LensPager` | `.../drawer/LensPager.tsx:48` | 24 px, 250 ms, `inert` | `LensPager.test.tsx` (12) |
| État vide/erreur de drawer | `DrawerEmpty`, `DrawerError` | `.../shell/DrawerShell.tsx:43-65` | déjà la bonne sémantique | `DrawerShell.test.tsx` |
| Squelette drawer | `DrawerSkeleton` | `.../shell/DrawerShell.tsx:33` | shimmer identique | idem |
| Lentilles du profil | `CommunitySlot` | `.../slots/CommunitySlot.tsx:393` | défis/clubs/cordée | `CommunityChallenges/Clubs/Cordee` (25) |
| Club en drawer | `ClubDrawer` | `.../drawer/ClubDrawer.tsx` | dialog + RSVP | `CommunityClubs.test.tsx` |
| Carte club | `ClubCard` | `.../cards/ClubCard.tsx` | 78 % rail, 20 radius | idem |
| Défi | `ChallengeRow` | `.../cards/ChallengeRow.tsx` | progression, XP | `CommunityChallenges.test.tsx` |
| Compagnon | `CompanionRow` | `.../cards/CompanionRow.tsx` | 44 px avatar | `CommunityCordee.test.tsx` |
| Sortie | `OutingCard` | `.../cards/OutingCard.tsx` | date + places | visuel |
| À la une | `HighlightCard` | `.../cards/HighlightCard.tsx` | story à la une | `MemoriesHighlights.test.tsx` |
| Tuile stat | `StatTile` | `.../cards/StatTile.tsx` | héro + vitrine | `VitrineStats.test.tsx` |
| Tuile badge | `BadgeTile` | `.../cards/BadgeTile.tsx` | trophées | `VitrineBadges.test.tsx` |
| Tampon | `StampTile` | `.../cards/StampTile.tsx` | passeport | `VitrineEmpreinte.test.tsx` |
| Ligne matériel | `GearRow` | `.../cards/GearRow.tsx` | poids, usure | `KitSlot.test.tsx` |
| Kit | `KitCard` | `.../cards/KitCard.tsx` | kit + items | idem |
| Prêt | `LoanCard` | `.../cards/LoanCard.tsx` | `data-hscroll` | `LoansSlot.test.tsx` |
| Republication | `RepostCard` | `.../cards/RepostCard.tsx` | reprise de contenu | `VitrineRepost.test.tsx` |
| Jauge d'usure | `WearGauge` | `.../cards/WearGauge.tsx` | matériel | `KitInventory.test.tsx` |
| Profil privé | `PrivateAccountLock` | `.../drawer/PrivateAccountLock.tsx` | verrou visiteur | `PrivateAccount.test.tsx` |
| Vide / erreur | `EmptyState`, `ErrorState` | `src/components/ui/EmptyState.tsx` | primitives DS | tests UI |
| Squelettes | `Skeleton`, `Spinner` | `src/components/ui/Skeleton.tsx` | pas de shimmer maison | `loading.tsx` |
| Puces/badges/boutons | `Badge`, `Chip`, `Button`, `IconButton` | `src/components/ui/*` | primitives DS | `p5-direction-tokens` |
| Recherche | `SearchField` | `src/components/ui/SearchField.tsx` | 44 px, clear | filtres carnets/clubs |
| Feuille 1 niveau | `Sheet` | `src/components/ui/Sheet.tsx:41` | detents, focus trap | e2e a11y |
| Hors-ligne | `OfflineBanner` | `src/features/adventure-intelligence/ui/OfflineBanner.tsx:16` | `offline`, `pendingCount` | nouveau test |
| Cartes carnet | `CarnetHubCard` | `src/components/carnets/CarnetHubCard.tsx` | carte récit | capture |

### 4.2 Étendus (7) — aucune modification visuelle par défaut

| Composant | Extension | Pourquoi | Preuve de non-régression |
|---|---|---|---|
| `DrawerShell` | `header?: ReactNode` rendu entre capsule et viewport ; consomme `CapsuleTabs` + `LensSelector` | porter la capsule d'identité au-dessus des onglets, sans dupliquer la capsule | `DrawerShell.test.tsx` + e2e `compte-drawer-v2` |
| `SlotShell` | `header?: ReactNode` ; masque le sélecteur flottant si `lenses.length < 2` | sections sans 2ᵉ niveau ne doivent pas afficher une capsule à 1 cellule | `SlotShell.test.tsx` (4) |
| `SlotSelector` | consomme `CapsuleTabs` (DOM/aria **identiques**) | une seule implémentation de la capsule 48 | `SlotSelectorAria.test.tsx` (3) |
| `MobileCommunityHeader` | devient la capsule d'identité (verre, 34 px), garde `text-[color:var(--lkv-text-primary)]` | aligner brique 2 | `p5-direction-tokens.spec.ts:124` |
| `CommunityHeroOverview` | devient le contenu du héro (massifs + CTA) | réutiliser l'existant plutôt que créer | capture |
| `CommunityPostCard` | re-skin en place, feuille commentaires extraite, logique et classes verrouillées conservées | piège #10 : ne pas réécrire | `community-social-contract.spec.ts:16-25` |
| `NavigationPlateau` | `getUpperTabs` retourne `[]` pour la destination `community` | supprimer le 2ᵉ sélecteur des 6 espaces | `tests/e2e` nav + capture |

### 4.3 Extraits (9)

| Unité | Depuis | Vers | Consommateurs |
|---|---|---|---|
| Grammaire capsule | `CompteLiquidGlassV8.tsx` (`.segc` l.1602, `.ig-tabs` l.802/1169), `DrawerShell.tsx:202-236`, `SlotShell.tsx:289-333` | `src/styles/liquid-capsules.css` | `/compte`, drawers, `/communaute` |
| Capsule 48 px | `DrawerShell.tsx:107-138`, `SlotSelector.tsx:96-120` | `src/components/ui/CapsuleTabs.tsx` | drawers + hub |
| Capsule 30 px flottante | `DrawerShell.tsx:167-195`, `SlotShell.tsx:229-278` | `src/components/ui/LensSelector.tsx` | drawers + hub |
| Shell immersif communauté | `page.tsx:414-442` + `community-social.css:58-75` | `src/components/communaute/shell/CommunityShell.tsx` | hub, sous-routes |
| Carte héro | `CommunityHeroOverview.tsx:18-31` + anatomie `#card.cs` | `.../shell/CommunityHeroCard.tsx` | hub + profil public |
| Drawer contexte | `CommunityHeroOverview` + `DrawerShell` | `.../shell/CommunityContextDrawer.tsx` | hub |
| Chargement du hub | `page.tsx:74-358` | `.../hooks/useCommunityHubFeed.ts` | hub |
| Synchro `?tab=` | `page.tsx:41-72` | `.../hooks/useCommunityHubTab.ts` | hub, sous-routes |
| Feuille commentaires | `CommunityPostCard.tsx:1100-1490` | `.../CommunityCommentsSheet.tsx` | fil, détail |

### 4.4 Nouveaux (0)

Aucun composant nouveau n'est justifié : chaque besoin ci-dessus est couvert par un composant
existant, une extension, ou une extraction. Si une tâche découvre un besoin non couvert, elle
**s'arrête** et remonte au plan (§14, critère d'arrêt).

---

## 5. Architecture cible

```
src/
├─ app/
│  ├─ layout.tsx                        ← importe liquid-capsules.css (après tokens.css)
│  └─ communaute/
│     ├─ layout.tsx                     ← inchangé (metadata)
│     ├─ page.tsx                        ← 60 l. max : shell + <CommunityHub/>
│     ├─ loading.tsx                     ← DrawerSkeleton + capsule factice
│     ├─ error.tsx                       ← carte verre + « Réessayer »
│     ├─ decouvrir/page.tsx              ← lot 2
│     ├─ post/[id]/page.tsx              ← lot 2
│     ├─ reels/page.tsx                  ← lot 2
│     ├─ publier/page.tsx                ← lot 2
│     └─ pro/page.tsx                    ← inchangé
├─ components/
│  ├─ ui/
│  │  ├─ CapsuleTabs.tsx                 ← CREATE (extrait)
│  │  └─ LensSelector.tsx                ← CREATE (extrait)
│  ├─ communaute/
│  │  ├─ CommunityHub.tsx                ← CREATE : mobile + desktop, une grammaire
│  │  ├─ CommunityCommentsSheet.tsx      ← CREATE (extrait)
│  │  ├─ CommunityPostCard.tsx           ← MODIFY : re-skin en place (classes verrouillées conservées)
│  │  ├─ MobileCommunityHeader.tsx       ← MODIFY : capsule identité
│  │  ├─ CommunityStoriesBar.tsx         ← MODIFY : z-index + peau
│  │  ├─ CommunityLeftSidebar.tsx        ← MODIFY : verre
│  │  ├─ CommunityRightSidebar.tsx       ← MODIFY : verre
│  │  ├─ shell/
│  │  │  ├─ CommunityShell.tsx           ← CREATE
│  │  │  ├─ CommunityHeroCard.tsx        ← CREATE
│  │  │  └─ CommunityContextDrawer.tsx   ← CREATE
│  │  └─ hooks/
│  │     ├─ useCommunityHubFeed.ts       ← CREATE
│  │     └─ useCommunityHubTab.ts        ← CREATE
│  └─ compte/drawer/                     ← MODIFY : consomme les extractions
└─ styles/
   ├─ liquid-capsules.css                ← CREATE : source unique de la grammaire
   └─ community-social.css               ← MODIFY : re-skin, zéro filet 1 px
```

### 5.1 Frontières client / serveur

Tout `/communaute` reste **client** : `AuthContext`, `useSearchParams`, Supabase navigateur.
Aucune donnée n'est déplacée vers un Server Component dans ce chantier (cela changerait le
contrat de chargement et les tests). `metadata` reste serveur (`layout.tsx`).

```
[URL ?tab=] ──useCommunityHubTab──┐
                                  ├─► CommunityHub ─► CapsuleTabs (selector)
[Supabase] ──useCommunityHubFeed──┘                 └─► LensPager ─► 6 panes
                                                                    ├─ Fil      : CommunityPostCard[]
                                                                    ├─ Carnets  : CarnetHubCard[]
                                                                    ├─ Clubs    : ClubCard[]
                                                                    ├─ Expéditions : OutingCard-like
                                                                    ├─ Sorties  : event cards
                                                                    └─ Entraide : posts filtrés
```

### 5.2 État

| État | Source | Portée |
|---|---|---|
| `activeTab` | URL `?tab=` (source de vérité unique) | `useCommunityHubTab` |
| `posts/carnets/clubs/groups/events` | Supabase | `useCommunityHubFeed` |
| `sectionErrors` | `Promise.allSettled` | idem |
| `postsLimit` / `hasMorePosts` | pagination croissante | idem |
| `joinedEventIds` | RPC `join_event` | idem |
| `highlightPostId`, `deepLinkedCommentId` | `?post=`, `?comment=` | idem |
| `openContext` | état local du héro | `CommunityHub` |

---

## 6. Mapping fonctionnel — rien perdu

| # | Fonctionnalité (§5.2 du prompt) | Emplacement cible | Interaction | État vide | État erreur | Permission | Deep link |
|---|---|---|---|---|---|---|---|
| 1 | Fil + pagination | pane `fil` | capsule → pane ; bouton « Charger plus » | « Le fil est calme » + CTA publier | bandeau + Réessayer | lecture RLS `community_posts_select_audience` | `?tab=fil` |
| 2 | Likes | `CommunityPostCard` action 1 | tap optimiste | — | toast | authenticated | — |
| 3 | Favoris | action 2 | tap | — | toast | authenticated | — |
| 4 | Commentaires + réponses | `CommunityCommentsSheet` | tap ouvre `Sheet` | « Sois le premier à réagir. » | toast | authenticated | `?comment=<id>` |
| 5 | Partage | action partage | `navigator.share` sinon copie | — | fallback copie | tous | — |
| 6 | Stories bar | `CommunityStoriesBar` sous le héro | tap viewer | « Votre story » masquée si non connecté | retry interne | authenticated pour publier | — |
| 7 | Viewer stories | `StoriesViewer` | plein écran | — | fermeture | auteur/visibilité | — |
| 8 | Vues / archive / proches amis | `StoryViewsSheet`, `StoriesArchiveSheet` | depuis la barre | « Aucune archive » | retry | propriétaire | — |
| 9 | Carnets | pane `carnets` | chips massif + recherche | « Aucun carnet pour ce massif » | bandeau | RLS carnets | `?tab=carnets` → `/carnets` |
| 10 | Clubs | pane `clubs` | filtres + `ClubCard` → `ClubDrawer` | « Aucun club pour le moment » | bandeau | RLS clubs | `?tab=clubs` → `/clubs` |
| 11 | Groupes / expéditions | pane `groupes` | carte → `/groupes/[id]` | « Aucune expédition en formation » | bandeau | visibilité groupe | `?tab=groupes` → `/groupes` |
| 12 | Sorties / événements | pane `evenements` | « S'inscrire » → RPC `join_event` | « Aucune sortie programmée » | bandeau | authenticated pour s'inscrire | `?tab=evenements` |
| 13 | Entraide | pane `entraide` | posts type question | « Aucune question pour l'instant » | bandeau | lecture publique | `?tab=entraide` |
| 14 | Découverte | `/communaute/decouvrir` | recherche + filtres média | « Rien à découvrir » | retry | publique | — |
| 15 | Reels | `/communaute/reels` | snap vertical, like | « Aucune vidéo » | retry | publique | `/communaute/post/[id]` |
| 16 | Publication | `/communaute/publier` | composer | — | erreurs de champ | authenticated | lien depuis capsule |
| 17 | Carnet (création) | `/carnets/nouveau` | depuis menu créer | — | — | authenticated | `MobileCommunityHeader` |
| 18 | Profils publics | `/profil/[handle]` | tap auteur | profil privé → `PrivateAccountLock` | retry | visibilité | — |
| 19 | Demandes d'abonnement | drawer Réseau | accepter/refuser | « Aucune demande » | retry | propriétaire | — |
| 20 | Modération (signaler/bloquer/masquer) | menu du post + `comment_reports` | confirmation | — | toast | authenticated | — |
| 21 | Visiteur non connecté | `CommunityShell` | CTA connexion | bannière « Connectez-vous pour participer » | — | — | `/connexion?next=/communaute` |

**Aucune ligne supprimée** : les 21 lignes ci-dessus correspondent exactement aux fonctionnalités du §5.2.

---

## 7. Écran par écran

### 7.1 Hub mobile — 430 × 932

```
┌──────────────────────────────────────────┐
│ (avatar 34) handle              + ⌕ ✉    │  capsule identité, sticky, safe-top
│ ╭──────────────────────────────────────╮ │
│ │ (avatar 66)  Nom · niveau            │ │  héro verre radius 22, padding 12
│ │ 3 massifs suivis · 2 clubs           │ │  — pas de compteur non total (D5)
│ │ [ Publier ]      [ Découvrir ]        │ │
│ ╰──────────────────────────────────────╯ │
│ ╭───── capsule 48 px, 6 icônes ────────╮ │
│ │ ◱   ◲   ◳   ◴   ◵   ◶               │ │  .sel-lens glisse 420 ms
│ ╰──────────────────────────────────────╯ │
│  pane active (LensPager, swipe 24 px)    │
│  ╭────────────────────────────────────╮  │
│  │ carte post : média / actions /     │  │
│  │ légende / commentaires             │  │
│  ╰────────────────────────────────────╯  │
│                     ╭── 30 px ──╮        │  sélecteur 2ᵉ niveau (si existe)
└──────────────────────────────────────────┘
        barre basse (AppShell, inchangée)
```

- **Objectif :** répondre à « qu'est-ce qui se passe dans ma communauté » en un écran.
- **Hiérarchie :** identité < héro < capsule < contenu. La capsule est la seule navigation.
- **Contenu exact :** voir §6 lignes 1-13.
- **Actions :** publier, découvrir, changer d'espace, filtrer, liker, commenter, partager, s'inscrire.
- **États :** squelette (3 cartes), vide avec CTA, erreur + réessayer, hors-ligne (bandeau 44 px), visiteur (bannière connexion).
- **Desktop 1440 :** 3 colonnes 280 / 1fr / 310, héro + capsule + pager dans la colonne centrale.
- **Clair / sombre :** via tokens `.dark` ; aucun hex local.
- **Clavier :** capsule roving tabindex (`←/→`, `Home/End`) ; panes `inert` quand inactives ; `Tab` ne sort pas de la pane active.
- **Copy FR :** « Pour vous », « Carnets », « Clubs », « Expéditions », « Sorties », « Entraide », « Charger plus de publications », « Le fil est calme ».
- **Analytics :** aucun événement existant dans le hub (aucun `track(` trouvé) → ne rien ajouter.

### 7.2 Drawer contexte — 2 lentilles

```
╭──────────────────────────────────────╮
│   [ Massif ]  [ Club ]   ← capsule 48│
│   · Chartreuse · Vercors · …         │
│   · 12 sorties · 3 carnets           │
╰──────────────────────────────────────╯
```
Ouvert depuis le héro, `DrawerShell` (2 niveaux), aucune carte 3D. Vide : « Aucun massif suivi. »

### 7.3 Découverte, Post, Reels, Publier

Voir §6 lignes 14-17 et la Task 10-12. Chaque écran garde son en-tête **capsule** (aucun
`.lkdv-community-discovery-header` / `.lkdv-community-reels-header`).

---

## 8. Données et API

Aucune migration, aucune colonne, aucun RPC nouveau. Vérifié dans `supabase/migrations` (392 fichiers).

| Table / vue | Définition | Colonnes utilisées par le hub |
|---|---|---|
| `community_posts` | `20260713120000_community_features.sql:220` | `*` (`page.tsx:147-150`) |
| `carnets` | idem `:8` | `*` (`:153-157`) |
| `clubs` | `20260712210000_app_tables.sql:19` | `*`, `members_count` (`:160`) |
| `club_members` | idem `:34` | `club_id`, `user_id`, `status` (`:246-250`) |
| `travel_groups` | `20260716000000_group_system_complete.sql:43` | `id,name,description,destination,theme,visibility,max_members,cover_url,created_at` (`:166-169`) |
| `events` | `20260712210000_app_tables.sql:55` | `*` + `event_date,current_participants,max_participants,organizer_id` (`:172-178`) |
| `post_likes`, `post_saves` | `20261013080000_social_state_persistence.sql:21,58` | `post_id` (`:269-270`) |
| `public_profiles` | **vue** `20261023090000_three_drawers.sql:12` | `id,full_name,avatar_url,loyalty_level` (`:293-299`) |
| `community_moderation_queue` | **vue** `20261013260000_moderation_queue.sql:94` | lecture modération |
| `follow_requests` | `20261023090000_three_drawers.sql:53` | demandes d'abonnement |
| `user_blocks`, `comment_reports` | `20260830000000:81`, `20260814000000:5` | blocage / signalement |

**RLS en vigueur :** `community_posts_select_audience` et `post_likes_select_audience`
(`20261015220000_community_post_audience_rls.sql:52,97`). Aucune policy nouvelle n'est créée.

**Index du fil :** `idx_community_posts_created` (`created_at DESC`,
`20260713120000:345`) — suffisant pour `ORDER BY created_at DESC LIMIT 20`.

**RPC utilisés :** `join_event` (`20261013270000_event_cancellation.sql:21`),
`toggle_community_post_like` (`20261021093000_worldwide_security_hardening.sql:91`).

**Realtime :** non utilisé par la communauté. Seuls `post_comments` et `notifications` sont dans
la publication (`20261021093000:166-180`). Le hub fait des lectures ponctuelles — on ne change rien.

**Cache / pagination :** pas de cache serveur ; pagination de 20 via `limit` croissant
(`page.tsx:83-85`). **Erreurs :** `Promise.allSettled` par section (`:144-210`) ; 401/403 tombent
en `error.message` et n'effacent pas les autres sections.

**Défauts préexistants à ne pas aggraver (hors scope, à signaler) :**
1. `publier/page.tsx:596` insère `post_type: 'event'` alors que le CHECK n'autorise que
   `post`,`tip`,`question`,`share` (`20260713120000:226`) → erreur 23514 + événement orphelin
   (la ligne `events` est écrite avant, `publier/page.tsx:564`).
2. `auth_manage_clubs` = `FOR ALL ... USING(true) WITH CHECK(true)`
   (`20260712230000_app_tables_v3.sql:402`) : aucun `DROP POLICY` ne la cible dans les 392
   migrations → elle se cumule en OR avec `auth_update_clubs`/`auth_delete_clubs`. À vérifier sur
   la base (`pg_policies`) avant toute action.
3. `clubs.members_count` est trié (`page.tsx:160`, `ORDER BY members_count DESC`) sans index.
4. `club_members.role`/`status` n'ont **aucun CHECK** dans la table effective : l'intégrité repose
   sur le trigger `guard_club_member_privileged_columns` (`20261013000000:113`).
5. `comment_reports.comment_id` et `user_blocks.blocker_id/blocked_id` n'ont pas de FK :
   lignes orphelinables.
6. `community_posts_audience_created (audience, created_at DESC)`
   (`20261021093000:156`) n'est **pas utilisable** par le fil, qui n'a aucun prédicat `audience`.

---

## 9. Design tokens et CSS

**Créé :** `src/styles/liquid-capsules.css` — copie **verbatim** des sélecteurs de base :
`.segc`, `.segc .th`, `.sel-lens`, `.lg-tabs`, `.lens-on`, `.ig-tabs`, `.ig-tabs .ig-th`,
`.ig-th.lens`, `.ig-tabs button`, `.ig-tabs-float`. Importé dans `src/app/layout.tsx` **après**
`tokens.css`/`liquid-glass.css` et **avant** `community-social.css`, pour que les surcharges
locales continuent de gagner.

**Modifié :** `src/styles/community-social.css` —
- conserve `.lkdv-community-experience` (l.5, testé) et `.lkdv-social-profile-screen` (l.312, testé) ;
- n'ajoute **aucune** règle racine `body`/`html` (interdit par `community-social-contract:77`) ;
- remplace les plaques opaques (l.58-75, 190-306) par des surfaces verre utilisant
  `--card-tint`, `--glass-border`, `--glass-blur` ;
- supprime les filets `border-bottom: 1px solid` au profit des capsules/espaces.

**Interdit :** `!important` nouveau (les seuls `!important` du projet vivent dans les CSS des
drawers, pour lutter contre Tailwind) ; toute couleur littérale ; tout `z-[...]`.

**Anti-collision :** les nouvelles classes sont préfixées `lkdv-` (`lkdv-hub-*`, `lkdv-hero-*`,
`lkdv-immersive`) et déclarées uniquement dans `community-social.css`, scopées sous
`.lkdv-community-experience`. Aucun sélecteur global nouveau.

---

## 10. Accessibilité (WCAG AA)

- [ ] Capsule = `role="tablist"`, boutons `role="tab"`, `aria-selected`, `aria-controls`, roving `tabIndex` 0/-1, `aria-orientation="horizontal"`, `←/→` avec bouclage, `Home/End`.
- [ ] Panes = `role="tabpanel"`, `aria-labelledby`, `inert` + `aria-hidden` quand inactives.
- [ ] Cible tactile ≥ 44 px partout (capsule 48, boutons d'action 44, lignes 44).
- [ ] Focus visible : `outline: 2px solid var(--lkv-focus-ring)`, offset 2 px.
- [ ] Contrastes AA sur verre : `--label` sur `--card-tint` ≥ 4.5:1 ; `npm run audit:contrast` sans nouvelle alerte.
- [ ] `prefers-reduced-motion` : `LensPager` sans transition, capsule sans glissement, shimmer désactivé.
- [ ] Zoom 200 % : aucun texte tronqué, capsule scrollable horizontalement si `--n` élevé.
- [ ] Aucune information uniquement par la couleur (lentille = position + `aria-selected`).
- [ ] VoiceOver : capsule annoncée « Sections, 6 onglets, Pour vous sélectionné ».

---

## 11. Performance

Budgets de référence : `docs/performance/performance-budgets.json:8-12` — LCP ≤ 2500 ms p75,
INP ≤ 200 ms p75, CLS ≤ 0.1 p75. Aucun budget spécifique `/communaute` n'existe : on prend ceux-ci.

| Levier | Règle |
|---|---|
| Bundle | Interdiction d'importer `CompteLiquidGlassV8.tsx` ou la runtime vanilla (≈ 4 544 l. + base64). Vérifié par test de source. |
| Images | `next/image` pour les couvertures clubs/carnets ; `loading="lazy"` sauf première carte ; tailles 2x max. |
| Vidéos | `preload="metadata"`, `poster`, pas d'autoplay hors reels. |
| Rendu | `useMemo` sur les listes filtrées ; `React.memo` sur `CommunityPostCard` ; pas de re-render global quand `activeTab` change (panes montées à la première visite seulement). |
| Chargement | paresseux par section (déjà en place, `page.tsx:330-358`) ; on conserve. |
| Mesure | `npm run build` puis Lighthouse mobile 430 sur `/communaute` : documenter LCP/INP/CLS avant (baseline) et après. |

Objectifs chiffrés post-refonte : LCP ≤ 2500 ms, CLS ≤ 0.05, JS initial `/communaute` +0 Ko
(la refonte retire du CSS et n'ajoute aucune lib).

---

## 12. Tests

### 12.1 Existants à ne pas casser

| Fichier | # | Commande |
|---|---|---|
| `tests/design/community-social-contract.spec.ts` | 6 | `npx vitest run tests/design/community-social-contract.spec.ts` |
| `tests/design/community-audience-security.spec.ts` | 4 | idem |
| `tests/design/community-reels-security.spec.ts` | 5 | idem |
| `tests/community/*` | 16 | `npx vitest run tests/community` |
| `src/components/compte/drawer/__tests__/*` | 24 fichiers | `npx vitest run src/components/compte/drawer/__tests__` |
| `tests/design/p5-direction-tokens.spec.ts` | 32 | idem |
| `tests/design/lot2-shell.spec.ts` | 10 | idem |
| `tests/design/m02-destination-registry.spec.ts` | 6 | idem |
| `tests/e2e/compte-drawer-v2.spec.ts` | 5 | `npx playwright test tests/e2e/compte-drawer-v2.spec.ts --project=desktop-chromium` |
| `tests/visual/community-social.spec.ts` | 5 | `npx playwright test --config=playwright.visual.config.ts` |

### 12.2 Nouveaux tests

| Niveau | Fichier | Cas |
|---|---|---|
| Unitaire | `src/components/communaute/hooks/__tests__/useCommunityHubTab.test.ts` | 6 valeurs acceptées, valeur inconnue → `fil`, `?tab=` gagne sur l'état, push ne casse pas l'historique |
| Unitaire | `.../useCommunityHubFeed.test.ts` | une section en échec n'efface pas les autres, pagination +20, identité change → rechargement |
| Composant | `src/components/ui/__tests__/CapsuleTabs.test.tsx` | DOM identique à `SlotSelector` (5 tabs, 1 `aria-controls`, roving), `--n`, `--i`, 48 px |
| Composant | `src/components/ui/__tests__/LensSelector.test.tsx` | masqué si `items.length < 2`, `--n`, 30 px, `aria-selected` |
| Composant | `src/components/communaute/__tests__/CommunityHub.test.tsx` | 6 panes, une seule `slot-content`-like active, `inert` sur les autres, états squelette/vide/erreur/hors-ligne/visiteur |
| Composant | `.../CommunityHeroCard.test.tsx` | aucun compteur non total ; massifs réels ; CTA |
| Composant | `.../CommunityCommentsSheet.test.tsx` | feuille sans en-tête, vide/plein, focus rendu au déclencheur |
| Contrat source | `tests/design/community-hub-glass.spec.ts` | **aucun** import de `CompteLiquidGlassV8` dans `components/communaute` ; **aucun** `#E4501C` ; **aucun** `z-[9999]` ; `.segc.lg-tabs` présent ; `liquid-capsules.css` contient `.sel-lens` ; `community-social.css` sans `body {` |
| E2E | `tests/e2e/communaute-hub.spec.ts` | capsule 6 onglets + `←/→`, swipe pane 0→1, `?tab=clubs` route vers `/clubs`, `?post=` scroll, `?comment=` ouvre la feuille, clavier complet, 430 et 1440 |
| A11y | `tests/a11y/e2e/communaute.spec.ts` | axe 0 critique/sérieux, focus visible, `tablist` valide |

### 12.3 Seuils

- 0 test rouge introduit. Les échecs préexistants (`worldFormats`, `free-departure-store`) sont
  hors périmètre et documentés §14 R1.
- axe : 0 violation `critical` ou `serious`.
- Budgets perf : dépassement = échec de la tâche.

---

## 13. Plan par phases et tâches

### Phase 0 — Fondations (aucun changement visuel attendu)

#### Task 1 — Figer la baseline et le harnais de capture

**Files :**
- Create: `docs/communaute/baseline/README.md`
- Create: `scripts/visual/communaute-baseline.mjs`
- Test: aucun (outil)

**Dépend de :** rien.

**Steps :**
1. Écrire `README.md` : date, commit, viewports (360/390/430/768/1024/1440), thèmes, commande de rejeu.
2. Écrire `scripts/visual/communaute-baseline.mjs` : Playwright chromium, boucle viewports, `page.goto('/communaute'|'/compte')`, capture dans `docs/communaute/baseline/<route>-<w>.png`, log console + requêtes en échec.
3. Lancer `node scripts/visual/communaute-baseline.mjs` → 12 PNG.
4. Vérifier : `/compte` et `/communaute` répondent 200, 0 erreur console.

**Vérification :** `ls docs/communaute/baseline` → 12 fichiers + README ; 0 erreur console dans le log.

**Commit :** `test(communaute): figer la baseline visuelle avant refonte`

---

#### Task 2 — Extraire la grammaire capsule

**Files :**
- Create: `src/styles/liquid-capsules.css`
- Modify: `src/app/layout.tsx` (import uniquement)
- Modify: `src/components/compte/CompteLiquidGlassV8.tsx` (supprimer les doublons)
- Modify: `src/components/compte/drawer/shell/DrawerShell.tsx` (`DRAWER_SHELL_CSS` : garder les surcharges locales)
- Modify: `src/components/compte/drawer/SlotShell.tsx` (`DRAWER_V2_CSS` : idem)
- Test: `tests/design/community-hub-glass.spec.ts` (créé ici, étendu ensuite)

**Dépend de :** Task 1.

**Steps :**
1. Créer le test : `liquid-capsules.css` existe et contient `.segc`, `.sel-lens`, `.lg-tabs`, `.lens-on`, `.ig-tabs`, `.ig-th.lens`, `.ig-tabs-float` ; le fichier ne contient aucun `#E4501C` ; `layout.tsx` importe le fichier **après** `tokens.css`.
2. Lancer : `npx vitest run tests/design/community-hub-glass.spec.ts` → échoue (fichier absent).
3. Créer `liquid-capsules.css` en **copiant verbatim** les déclarations de base :
   - `.segc` + `.segc .th` depuis `CompteLiquidGlassV8.tsx:1602-1643` ;
   - `.ig-tabs`, `.ig-tabs .ig-th`, `.ig-tabs button` depuis `:802-890` et `:1169-1201` ;
   - `.sel-lens` / `.lens-on` depuis `:1602-1720` et `DrawerShell.tsx:208` ;
   - `.ig-tabs-float` depuis les règles de `DrawerShell.tsx:216` et `SlotShell.tsx:299`.
   Copier sans reformater : un `diff` ligne à ligne doit être vide.
4. Ajouter `@import '../styles/liquid-capsules.css';` (ou import JS) dans `src/app/layout.tsx`, après `tokens.css`.
5. Retirer des trois sources uniquement les déclarations **identiques** désormais centralisées ; laisser les surcharges scopées (`.lkdv-drawer-shell .segc...`, `!important`).
6. Lancer `npm run type-check` → 0 erreur.
7. Capturer `/compte` à 430 / 768 / 1440 et comparer à la baseline : **diff pixel = 0**. Si diff, `git checkout` de l'étape 5 et recommencer en déplaçant une règle à la fois.

**Vérification :**
- `npx vitest run tests/design/community-hub-glass.spec.ts` → vert.
- `npx vitest run src/components/compte/drawer/__tests__` → 24 fichiers verts.
- `npx playwright test tests/e2e/compte-drawer-v2.spec.ts --project=desktop-chromium` → vert.
- Diff captures `/compte` → 0.

**Commit :** `refactor(design): extraire la grammaire capsule dans liquid-capsules.css`

---

#### Task 3 — Extraire `CapsuleTabs` et migrer `DrawerShell` + `SlotSelector`

**Files :**
- Create: `src/components/ui/CapsuleTabs.tsx`
- Create: `src/components/ui/__tests__/CapsuleTabs.test.tsx`
- Modify: `src/components/compte/drawer/shell/DrawerShell.tsx`
- Modify: `src/components/compte/drawer/SlotSelector.tsx`

**Dépend de :** Task 2.

**Interfaces :**
```ts
export interface CapsuleTabItem { id: string; label: string; icon?: React.ReactNode }
export interface CapsuleTabsProps {
  items: readonly CapsuleTabItem[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  ariaLabel: string;
  size?: 48 | 30;                 // défaut 48
  orientation?: 'horizontal';     // défaut
  className?: string;
  idFor?: (id: string) => string | undefined;   // aria-controls
  panelIdFor?: (id: string) => string | undefined;
}
export function CapsuleTabs(props: CapsuleTabsProps): JSX.Element
```
Rendu attendu (inchangé) : `div.segc.lg-tabs.lens-on` + `style="--n:{items.length}"`, `span.sel-lens aria-hidden style="--i:{activeIndex}"`, un `button` par item, `role="tab"`, `aria-selected`, `aria-label`, `title`, `tabIndex` 0/-1, classes `active`.

**Steps :**
1. Écrire le test : rendu avec 5 items → 5 `role="tab"`, un seul `tabIndex=0`, `--n=5`, `--i=2`, `aria-selected` sur l'index 2, `ArrowRight` appelle `onIndexChange(3)`, `End` appelle `onIndexChange(4)`, `Home` → 0.
2. Lancer → échoue (module absent).
3. Créer `CapsuleTabs.tsx` en recopiant exactement la logique clavier de `SlotSelector.tsx:69-92` et le markup de `DrawerShell.tsx:107-138`.
4. Migrer `SlotSelector` : il garde son aria-label « Slots du profil », ses 5 items et `idFor/panelIdFor` ; **le DOM produit doit être identique**.
5. Migrer `DrawerShell` topnav : même capsule, mêmes classes, mêmes `id`.
6. Lancer les deux suites concernées.

**Vérification :**
- `npx vitest run src/components/ui/__tests__/CapsuleTabs.test.tsx src/components/compte/drawer/__tests__/SlotSelectorAria.test.tsx src/components/compte/drawer/__tests__/SlotShell.test.tsx src/components/compte/drawer/shell/__tests__/DrawerShell.test.tsx` → vert.
- `npx playwright test tests/e2e/compte-drawer-v2.spec.ts --project=desktop-chromium` → vert.
- Diff captures `/compte` → 0.

**Commit :** `refactor(ui): extraire CapsuleTabs et migrer les deux capsules 48 px`

---

#### Task 4 — Extraire `LensSelector` (capsule 30 px) et migrer `SlotShell`

**Files :**
- Create: `src/components/ui/LensSelector.tsx`
- Create: `src/components/ui/__tests__/LensSelector.test.tsx`
- Modify: `src/components/compte/drawer/SlotShell.tsx` (l.229-278)
- Modify: `src/components/compte/drawer/shell/DrawerShell.tsx` (secondaire, l.167-195)

**Dépend de :** Task 3.

**Interfaces :**
```ts
export interface LensSelectorItem { id: string; label: string; icon: React.ReactNode }
export interface LensSelectorProps {
  items: readonly LensSelectorItem[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  ariaLabel?: string;             // défaut 'Filtres'
  testIdFor?: (id: string) => string | undefined;  // ex. lkdv-lens-tab-<slot>-<id>
  panelSelector?: (id: string) => string | undefined;
}
```
Rendu : `div.ig-tabs.lkdv-lens-tabs` (30 px) + `span.ig-th.lens`, `--n`, `--w` = `${n*44}px`, `--lens-w`, `aria-selected`.

**Steps :**
1. Test : 3 items → 3 boutons, `--n=3`, `--w='132px'`, lentille `translateX(100%)` à l'index 1 ; **si `items.length < 2` → `null`**.
2. Lancer → échoue.
3. Créer le composant depuis `SlotShell.tsx:229-278` (même markup, mêmes ids).
4. `SlotShell` l'utilise ; conserver `[data-testid="slot-content"]` / `slot-pane-*` et `inert` **exactement**.
5. `DrawerShell` secondaire l'utilise pour la capsule 30 px.

**Vérification :** `npx vitest run src/components/ui/__tests__/LensSelector.test.tsx src/components/compte/drawer/__tests__` → vert ; e2e drawer → vert ; diff `/compte` → 0.

**Commit :** `refactor(ui): extraire LensSelector et migrer la capsule 30 px`

---

### Phase 1 — Hub mobile

#### Task 5 — Extraire le chargement et la synchro d'onglet

**Files :**
- Create: `src/components/communaute/hooks/useCommunityHubTab.ts`
- Create: `src/components/communaute/hooks/useCommunityHubFeed.ts`
- Create: `src/components/communaute/hooks/__tests__/useCommunityHubTab.test.ts`
- Create: `src/components/communaute/hooks/__tests__/useCommunityHubFeed.test.ts`
- Modify: `src/app/communaute/page.tsx` (consomme les hooks)

**Dépend de :** Task 4.

**Interfaces :**
```ts
export type CommunityTab = 'fil'|'carnets'|'clubs'|'groupes'|'evenements'|'entraide';
export function useCommunityHubTab(): { activeTab: CommunityTab; selectTab: (t: CommunityTab) => void };
export function useCommunityHubFeed(userId?: string): {
  posts: any[]; carnets: any[]; clubs: any[]; groups: any[]; events: any[];
  joinedEventIds: Record<string, boolean>;
  loading: boolean; hasMorePosts: boolean;
  sectionErrors: Record<string,string>;
  load: (sections?: string[]) => Promise<void>;
  loadMorePosts: () => void;
  joinEvent: (id: string|number) => Promise<void>;
  confirmJoinedEvent: (id: string) => void;
};
```

**Steps :**
1. Test `useCommunityHubTab` : `?tab=clubs` → `clubs` ; `?tab=prout` → `fil` ; `selectTab('carnets')` appelle `router.push('/carnets')` ; `selectTab('entraide')` pousse `/communaute?tab=entraide`.
2. Test `useCommunityHubFeed` : 5 requêtes `allSettled`, une en `error` → `sectionErrors.posts` rempli et `carnets` intact ; `loadMorePosts` incrémente le `limit` de 20 ; changement de `userId` réinitialise.
3. Lancer → échoue.
4. Déplacer **le code existant** de `page.tsx:41-358` dans les deux hooks, à l'identique (mêmes requêtes, mêmes `select`, mêmes RPC). Aucune optimisation opportuniste.
5. `page.tsx` ne garde que le rendu + `useCommunityHubTab` + `useCommunityHubFeed`.

**Vérification :** `npx vitest run src/components/communaute/hooks` → vert ; `npx vitest run tests/design/community-social-contract.spec.ts tests/community` → vert ; `npx vitest run tests/design/community-social-contract.spec.ts` doit toujours trouver `lkdv-community-experience` dans `page.tsx`.

**Commit :** `refactor(communaute): extraire le feed et la synchro ?tab=`

---

#### Task 6 — Créer la coquille immersive, le héro et le drawer contexte

**Files :**
- Create: `src/components/communaute/shell/CommunityShell.tsx`
- Create: `src/components/communaute/shell/CommunityHeroCard.tsx`
- Create: `src/components/communaute/shell/CommunityContextDrawer.tsx`
- Create: `src/components/communaute/__tests__/CommunityHeroCard.test.tsx`
- Modify: `src/components/communaute/CommunityHeroOverview.tsx`
- Modify: `src/styles/community-social.css`

**Dépend de :** Task 5.

**Interfaces :**
```ts
export function CommunityShell(props: {
  header?: React.ReactNode;        // capsule d'identité
  hero?: React.ReactNode;
  tabs: React.ReactNode;           // CapsuleTabs
  children: React.ReactNode;       // LensPager
  floatingSelector?: React.ReactNode;
}): JSX.Element;

export function CommunityHeroCard(props: {
  handle: string; displayName?: string; avatarUrl?: string;
  massifs: string[];               // réels, issus des carnets/clubs chargés
  clubCount: number;               // adhésions réelles (club_members status=active)
  onPublish: () => void; onDiscover: () => void; onOpenContext: () => void;
  state?: 'ready'|'loading'|'empty'|'error';
}): JSX.Element;
```

**Steps :**
1. Test `CommunityHeroCard` : sans `massifs` → aucun chiffre affiché ; avec 2 massifs → « Chartreuse · Vercors » ; `state='loading'` → `data-state="loading"` ; aucun texte contenant « publications » suivi d'un nombre.
2. Lancer → échoue.
3. Créer `CommunityHeroCard` en composant `Card` (variant verre) + `Badge` + `Button` + les classes `lkdv-hero-*` déclarées dans `community-social.css`. Reprendre le contenu de `CommunityHeroOverview.tsx:18-31` et les CTA existants.
4. Créer `CommunityShell` : `div.lkdv-community-experience.lkdv-immersive` → `CompteBackground` + voile + `header` sticky + contenu. **Pas de nouveau conteneur de scroll** (AppShell reste le seul).
5. Créer `CommunityContextDrawer` : `DrawerShell` 2 onglets (Massif / Club), contenu réel, vide explicite.
6. Ajouter les classes `.lkdv-immersive`, `.lkdv-hero-*`, `.lkdv-hub-*` dans `community-social.css`, scopées sous `.lkdv-community-experience`, zéro hex, zéro `!important`.

**Vérification :** `npx vitest run src/components/communaute/__tests__/CommunityHeroCard.test.tsx` → vert ; capture 430 → fond immersif + héro verre, pas de plaque opaque ; `grep -rn "#E4501C\|z-\[9999\]" src/components/communaute src/styles/community-social.css` → 0.

**Commit :** `feat(communaute): coquille immersive, héro verre et drawer contexte`

---

#### Task 7 — Remplacer les trois sélecteurs par la capsule unique

**Files :**
- Create: `src/components/communaute/CommunityHub.tsx`
- Create: `src/components/communaute/__tests__/CommunityHub.test.tsx`
- Modify: `src/components/communaute/MobileCommunityHub.tsx` (devient une pane, ou disparaît)
- Modify: `src/components/mobile-nav/navigation/NavigationPlateau.tsx`
- Modify: `src/app/communaute/page.tsx`
- Modify: `src/app/communaute/loading.tsx`, `error.tsx`

**Dépend de :** Task 6.

**Steps :**
1. Test `CommunityHub` : 6 `role="tab"` ; une seule pane active (`aria-hidden=false`, sans `inert`) ; 5 panes `inert` ; `ArrowRight` sur la capsule change de pane **et** met l'URL à jour ; `?tab=clubs` rend la pane clubs.
2. Lancer → échoue.
3. Écrire `CommunityHub` : `CommunityShell` + `CapsuleTabs` (6 icônes 18 px) + `LensPager` (6 panes). Chaque pane est le contenu actuel de `MobileCommunityHub.tsx` remonté tel quel (fil, carnets, clubs, groupes, evenements, entraide), sans réécriture logique.
4. Supprimer le `Tabs` scrollable de `MobileCommunityHub.tsx:120-134` et le composant s'il devient inutilisé (vérifier les 6 imports).
5. `NavigationPlateau` : `getUpperTabs` retourne `[]` quand la destination active est `community` (via `flags`, pas via `pathname.startsWith` dans `AppShell`).
6. `page.tsx` : racine `lkdv-community-experience` conservée (test l.74), rend `<CommunityHub/>`.
7. `loading.tsx` : `DrawerSkeleton` ×3 + capsule factice 48 px. `error.tsx` : carte verre + « Réessayer » (mêmes libellés).

**Vérification :**
- `npx vitest run src/components/communaute/__tests__ tests/design/community-social-contract.spec.ts` → vert (y compris `lkdv-social-story-shelf` < `lkdv-social-category-tabs` < `lkdv-social-mobile-stream`).
- Capture 430 : **un seul** sélecteur des 6 espaces visible.
- `npx vitest run tests/design/lot2-shell.spec.ts` → vert (aucun `pathname?.startsWith('/communaute')` dans AppShell).

**Commit :** `feat(communaute): capsule unique des six espaces et panes glissantes`

---

#### Task 8 — Les cinq états partagés

**Files :**
- Modify: `src/components/communaute/CommunityHub.tsx`
- Create: `src/components/communaute/__tests__/CommunityStates.test.tsx`
- Modify: `src/components/communaute/CommunityStoriesBar.tsx` (`z-[9999]` → `var(--z-modal)`)

**Dépend de :** Task 7.

**Steps :**
1. Test : `state='loading'` → `DrawerSkeleton` ; `state='empty'` → `DrawerEmpty` + CTA ; `state='error'` → `DrawerError` + `Réessayer` ; hors-ligne → `OfflineBanner` visible ; visiteur → bannière connexion et actions désactivées.
2. Ajouter la détection hors-ligne (`navigator.onLine` + `online`/`offline` listeners) dans le hub, sans nouveau fichier de contexte.
3. Brancher `sectionErrors` sur `DrawerError` par pane.
4. Remplacer `z-[9999]` par `var(--z-modal)` (`CommunityStoriesBar.tsx:803`).

**Vérification :** `npx vitest run src/components/communaute/__tests__/CommunityStates.test.tsx` → vert ; `grep -rn "z-\[9" src/components/communaute` → 0.

**Commit :** `feat(communaute): états squelette, vide, erreur, hors-ligne et visiteur`

---

### Phase 2 — Desktop

#### Task 9 — Adapter le desktop sur la même grammaire

**Files :**
- Modify: `src/components/communaute/CommunityHub.tsx`
- Modify: `src/components/communaute/CommunityLeftSidebar.tsx`
- Modify: `src/components/communaute/CommunityRightSidebar.tsx`
- Modify: `src/app/communaute/page.tsx`
- Modify: `src/styles/community-social.css`

**Dépend de :** Task 8.

**Steps :**
1. Ajouter un test de rendu à 1440 (ou une assertion de classes) : la colonne centrale contient **la même** `CapsuleTabs` et le **même** `LensPager` que le mobile (pas de second cockpit).
2. Au-dessus de `md`, rendre : grille `280px minmax(0,1fr) 310px`, `Header` existant, colonne gauche = nav + massifs + CTA (verre), colonne centrale = `CommunityHeroCard` + capsule + pager, colonne droite = 4 cartes (verre).
3. Supprimer les duplications desktop-only : rail `Chip` carnets (`page.tsx:563-581`) et clubs (`:615-631`) deviennent le `LensSelector` 30 px de la pane.
4. Re-skiner `community-social.css` desktop : plus de `border-bottom: 1px` sur les posts (`:190-306`), verre 18–22 px.

**Vérification :** capture 1440 → même vocabulaire que 430 ; `npx vitest run tests/design/community-social-contract.spec.ts` → vert ; aucun `Header` dupliqué.

**Commit :** `feat(communaute): desktop adapté à la même grammaire, plus de second cockpit`

---

### Phase 3 — Sous-routes

#### Task 10 — Découverte et détail de post

**Files :**
- Modify: `src/app/communaute/decouvrir/page.tsx`, `src/app/communaute/post/[id]/page.tsx`
- Modify: `src/styles/community-social.css`
- Test: `tests/design/community-hub-glass.spec.ts` (extension)

**Dépend de :** Task 9.

**Steps :**
1. Étendre le test : `decouvrir` et `post/[id]` contiennent `lkdv-immersive` et **plus** `lkdv-community-discovery-header`.
2. Remplacer l'en-tête maison par la capsule d'identité + bouton retour 44 px.
3. Grille 3 colonnes conservée (`3/4`), filtres en `LensSelector`.
4. `post/[id]` : rend `CommunityPostCard` en pleine largeur, dans `CommunityShell`.

**Vérification :** `npx vitest run tests/design/community-hub-glass.spec.ts tests/design/community-social-contract.spec.ts` → vert ; captures 430/1440.

**Commit :** `feat(communaute): découverte et détail de post sur la coquille commune`

---

#### Task 11 — Reels

**Files :**
- Modify: `src/app/communaute/reels/page.tsx`
- Modify: `src/styles/community-social.css`

**Dépend de :** Task 10.

**Steps :**
1. Ne **pas** toucher `lkdv-community-reels-track` (testé, `community-reels-security.spec.ts:35`) ni `aria-pressed={reel.liked}` (`:42`).
2. Remplacer l'en-tête par la capsule retour 44 px ; actions en capsule 30 px verticale.
3. Masquer la barre basse (déjà fait via `lkdv-toggle-bottom-bar`, `:138`).

**Vérification :** `npx vitest run tests/design/community-reels-security.spec.ts` → vert.

**Commit :** `feat(communaute): reels sur la capsule commune`

---

#### Task 12 — Publier

**Files :**
- Modify: `src/app/communaute/publier/page.tsx`
- Modify: `src/styles/community-social.css`

**Dépend de :** Task 11.

**Steps :**
1. Ne pas toucher : `multiple className="hidden"` (`social-media-reproduction.spec.ts:43`), `media_urls: mediaUrls`, `linked_kit_id: sharedKitId` (`:41-42`), `club_id: audience === 'club' ? selectedClub : null` (`community-audience-security.spec.ts:14-16`).
2. Sections en cartes verre, composer en `Sheet` pour les sous-étapes, CTA en `Button`.
3. Sélecteur d'audience : `CapsuleTabs` 30 px.

**Vérification :** `npx vitest run tests/design/community-audience-security.spec.ts tests/community` → vert.

**Commit :** `feat(communaute): composer de publication sur la grammaire commune`

---

### Phase 4 — Carte de post et feuilles

#### Task 13 — Re-skin de la carte de post et extraction de la feuille commentaires

**Files :**
- Create: `src/components/communaute/CommunityCommentsSheet.tsx`
- Create: `src/components/communaute/__tests__/CommunityCommentsSheet.test.tsx`
- Modify: `src/components/communaute/CommunityPostCard.tsx` (peau uniquement)
- **Aucune** modification de `src/components/communaute/CommunityPostView.tsx` : ce fichier n'est **pas** créé.

**Dépend de :** Task 12.

**Décision explicite : la présentation du post N'EST PAS extraite.**
`tests/design/community-social-contract.spec.ts:16-25` lit le **fichier**
`CommunityPostCard.tsx` et vérifie par `indexOf` que `lkdv-social-post`,
`lkdv-social-post-media`, `lkdv-social-post-actions`, `lkdv-social-post-caption`
apparaissent dans cet ordre — et que le commentaire littéral
`Full Feature Threaded Comments Drawer` est présent. Déplacer ces blocs dans un
`CommunityPostView.tsx` ferait échouer le test (piège #10 du prompt : « ne réécris pas
`CommunityPostCard` de zéro »). On garde donc la carte en place et on la re-skinne ; on
n'extrait que la **feuille** de commentaires.

**Steps :**
1. Test `CommunityCommentsSheet` : rendu avec 0 commentaire → « Sois le premier à réagir. » ; avec 3 → 3 lignes ; `Sheet` sans en-tête (aucun `h1`/`h2` dans les 120 premiers px) ; `aria-label` « Commentaires » ; focus dans la feuille à l'ouverture, rendu au déclencheur à la fermeture.
2. Lancer → échoue (module absent).
3. Extraire le JSX `CommunityPostCard.tsx:1100-1490` vers `CommunityCommentsSheet`, en gardant l'état et les handlers (`handleLikeComment:401`, `handleSaveEditComment:455`, `handleReportComment:509`) dans `CommunityPostCard` et en les passant en props.
4. `CommunityPostCard` conserve **à l'identique** : les quatre classes ci-dessus, leur ordre, et le commentaire `Full Feature Threaded Comments Drawer` à l'endroit du call-site.
5. Re-skin de la carte : surfaces verre (`--card-tint`), radius 18–22 px, `44 px` de cible, footer d'actions en capsule — **sans** toucher aux classes verrouillées ni à l'ordre.
6. Vérifier que `handleLike` (`:339`), `handleShare` (`:536`), `handleHidePost` (`:580`), `handleReport` (`:596`) sont toujours dans `CommunityPostCard.tsx`.

**Vérification :**
- `npx vitest run src/components/communaute/__tests__ tests/design/community-social-contract.spec.ts tests/design/community-audience-security.spec.ts tests/community` → vert.
- `grep -c "lkdv-social-post-media\|lkdv-social-post-actions\|lkdv-social-post-caption\|Full Feature Threaded Comments Drawer" src/components/communaute/CommunityPostCard.tsx` → 4.
- `wc -l src/components/communaute/CommunityPostCard.tsx` → < 1 200 (baisse par extraction de la feuille uniquement).

**Commit :** `refactor(communaute): extraire la feuille commentaires et re-skiner la carte`

---

### Phase 5 — A11y, perf, tests, documentation

#### Task 14 — Passe d'accessibilité

**Files :**
- Modify: `src/components/communaute/CommunityHub.tsx`, `shell/CommunityShell.tsx`, `CommunityStoriesBar.tsx`
- Create: `tests/a11y/e2e/communaute.spec.ts`

**Dépend de :** Task 13.

**Steps :**
1. Écrire le test axe sur `/communaute` (430 et 1440) : 0 violation `critical`/`serious`.
2. Corriger : ordre de focus, `aria-label` manquants, `inert`, contraste.
3. Vérifier clavier : `Tab` traverse capsule → panes → actions, `←/→` boucle, `Échap` ferme les feuilles.
4. Vérifier `zoom 200 %` (viewport 375 avec `deviceScaleFactor: 2`).

**Vérification :** `npm run test:a11y` → 0 violation ; capture clavier documentée.

**Commit :** `fix(communaute): accessibilité clavier, contrastes et lecteur d'écran`

---

#### Task 15 — Passe de performance

**Files :**
- Modify: `src/components/communaute/CommunityPostCard.tsx`, `CommunityHub.tsx` (memo, lazy)
- Create: `docs/communaute/PERF.md`

**Dépend de :** Task 14.

**Steps :**
1. `npm run build` → noter la taille des chunks `/communaute`.
2. Lighthouse mobile 430 → LCP/INP/CLS avant/après, consignés dans `PERF.md`.
3. `React.memo` sur `CommunityPostCard` ; `next/image` sur les couvertures ; pas de re-render à chaque frappe de recherche (debounce existant conservé).
4. Vérifier qu'aucun import de `CompteLiquidGlassV8` n'existe : le test de Task 2 le garantit.

**Vérification :** LCP ≤ 2500 ms, CLS ≤ 0.05, JS initial non supérieur à la baseline.

**Commit :** `perf(communaute): mémoïsation, images et mesures`

---

#### Task 16 — Clôture, captures et documentation

**Files :**
- Modify: `docs/superpowers/plans/2026-10-22-communaute-refonte.md` (cases cochées)
- Modify: `docs/superpowers/specs/2026-10-22-communaute-refonte-design.md` (écarts constatés)
- Create: `docs/communaute/after/` (captures 360/390/430/768/1024/1440, clair/sombre)

**Dépend de :** Task 15.

**Steps :**
1. Rejouer `scripts/visual/communaute-baseline.mjs` dans `docs/communaute/after/`.
2. Vérifier `/compte` identique à la baseline (diff 0).
3. `npm run type-check`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`, `npm run test:a11y`, `npx playwright test --config=playwright.visual.config.ts`, `npm run audit:contrast` → consigner les sorties.
4. Cocher les cases du plan ; écrire les écarts.

**Vérification :** toutes les commandes ci-dessus vertes (hors échecs préexistants §14 R1) ; 12 captures avant + 12 après.

**Commit :** `docs(communaute): captures, mesures et plan à jour`

---

## 14. Risques, rollback, rollout

| Risque | Prob. | Impact | Mitigation | Critère d'arrêt |
|---|---|---|---|---|
| R1 — `npm test` est **déjà rouge** sur 2 fichiers hors périmètre (`src/features/compas/__tests__/worldFormats.test.tsx`, `src/features/free-departure/__tests__/free-departure-store.test.ts` : `window.localStorage` undefined en jsdom) | certaine | moyen | documenté ; ne pas corriger dans ce chantier ; comparer le nombre d'échecs avant/après (`40/93` dans la baseline) | si un 41ᵉ échec apparaît |
| R2 — L'extraction CSS déplace une règle et décale `/compte` | moyenne | **élevé** | diff pixel après chaque tâche de Phase 0 ; déplacer une règle à la fois | tout diff ≠ 0 → `git checkout` de la tâche |
| R3 — `CommunityPostCard` perd de la logique en étant découpée | faible | élevé | **la carte n'est pas découpée** : seule la feuille commentaires sort ; les 4 classes verrouillées + le commentaire repère restent dans le fichier ; `grep` de contrôle en Task 13 | un handle perdu ou un `grep` ≠ 4 |
| R4 — Le plateau masqué casse la navigation mobile globale | faible | élevé | changement limité à la destination `community` ; e2e nav sur `/`, `/materiel`, `/compas` | régression d'une nav |
| R5 — `?tab=` perdu (tests + utilisateurs) | faible | élevé | whitelist conservée + test unitaire dédié | un `?tab=` non reconnu |
| R6 — Un test verrouillant un littéral casse (classes `.lkdv-social-*`) | moyenne | moyen | liste exhaustive §Global Constraints ; `grep` avant commit | un test de `tests/design/community-*` rouge |
| R7 — Le bundle augmente (import accidentel du mockup) | faible | moyen | test de source interdisant l'import ; mesure build | +1 Ko JS initial |
| R8 — Le thème sombre n'existe pas dans la référence | certaine | moyen | tokens `.dark` déjà présents dans `tokens.css:625` ; le hub consomme les tokens, pas d'hex | contraste AA non atteint en sombre |

**Rollback :** branche unique `chantier/communaute-design`, un commit par tâche. Retour arrière =
`git revert <commit>` de la tâche fautive. Aucune migration → aucun rollback de base.

**Feature flag :** aucun. La page n'est pas déployée dans ce chantier (`pas de push`, `pas de deploy`).

**Monitoring :** hors scope (pas de déploiement). Les mesures locales Lighthouse + axe font office de preuve.

---

## 15. Questions ouvertes et hypothèses par défaut

| # | Question | Hypothèse par défaut |
|---|---|---|
| 1 | À 1440, `/compte` est un cadre d'iPhone + éditorial, pas une page desktop. Le desktop Communauté doit-il être une **vraie** page responsive (3 colonnes, même grammaire) ou reproduire le cadre ? | Vraie page responsive (D4) |
| 2 | Les 6 espaces ont deux sélecteurs (Tabs milieu de page + plateau bas). Confirmez-vous la suppression du plateau **sur `/communaute` seulement** ? | Oui (D2) |
| 3 | La « carte contexte » du Compte est une carte 3D MapLibre. Pour la Communauté : aucune carte, un drawer contexte Massif/Club. | Pas de carte 3D (D3) |
| 4 | Le dépôt a **13 fichiers de `src/` modifiés non commités + 1 non suivi** (`src/components/compte/drawer/slots/SlotEmpty.tsx`), dont les fichiers de référence : `CompteLiquidGlassV8.tsx`, `compte-liquid-glass-v8-runtime.js`, `drawer/ProfileDrawerHost.tsx`, `drawer/SlotShell.tsx`, `drawer/shell/DrawerShell.tsx`, `drawer/compte/CompteDrawer.tsx`, `drawer/compte/SettingsPane.tsx`, `drawer/slots/MemoriesSlot.tsx`, `drawer/slots/VitrineSlot.tsx` et 3 fichiers de tests `__tests__`. Faut-il les committer avant branchement, ou les exclure ? | On demande avant de créer la branche ; aucun stash, aucun écrasement |
| 5 | Le thème sombre n'existe pas sur la surface `/compte`. Doit-il exister sur `/communaute` ? | Oui, via les tokens `.dark` existants, sans palette nouvelle |

---

## 16. Definition of Done

- [ ] `/communaute` mobile (430) a le même fond, la même capsule d'identité, le même héro verre, la même capsule 48 px, les mêmes lentilles, les mêmes feuilles, les mêmes états que `/compte`.
- [ ] Le desktop est une adaptation (3 colonnes) de ce design, sans cadre factice et sans second cockpit.
- [ ] Les 21 fonctionnalités du §6 sont accessibles et testées.
- [ ] `?tab=`, `?post=`, `?comment=` fonctionnent ; `/communaute/pro` inchangé.
- [ ] Matrice appliquée : 28 réutilisés, 7 étendus, 9 extraits, 0 duplication, 0 nouveau token.
- [ ] `/compte` identique avant/après (12 captures, diff 0).
- [ ] `npm run type-check` → 0 erreur.
- [ ] `npm run lint` → 0 erreur.
- [ ] `npm test` → aucun nouvel échec (les 40 échecs jsdom préexistants restent documentés).
- [ ] `npm run build` → succès.
- [ ] Playwright : 0 erreur console, 0 warning d'hydratation, 0 requête en échec.
- [ ] axe : 0 critique/sérieux ; clavier complet ; 44 px ; AA ; `prefers-reduced-motion`.
- [ ] Budgets : LCP ≤ 2500 ms, CLS ≤ 0.05, INP ≤ 200 ms, JS initial ≤ baseline.
- [ ] Captures 360/390/430/768/1024/1440, clair et sombre, avant et après.
- [ ] Plan coché, spec à jour, commits conventionnels sur `chantier/communaute-design`.
- [ ] Aucun déploiement, aucun push, aucune migration.
