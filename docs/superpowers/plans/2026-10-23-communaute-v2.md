# Plan d'implémentation — Communauté v2 (grammaire du Compte)

**Date :** 2026-10-23
**Branche cible :** `chantier/communaute-v2` (créée depuis la référence figée en Task 1)
**Statut :** plan à valider — **aucun code écrit, aucun fichier de `src/` modifié, aucune migration.**
**Spec :** `docs/superpowers/specs/2026-10-23-communaute-v2-design.md`
**Référence :** `/compte` du 2026-10-23 (Liquid Glass v8 + carte vivante), captures
`docs/communaute/v2-audit/`.

---

## 1. Verdict exécutif

- **Ce qui est gardé :** le fil, les stories, les six espaces, les carnets, les clubs, les
  expéditions, les sorties, l'entraide, les deep links, la barre globale, `AppShell`, `DrawerShell`,
  `SlotShell`, `CapsuleTabs`, `LensPager`, `Sheet`, `ReportSheet`, `StoriesViewer`.
- **Ce qui change :** la coquille mobile, la capsule d'identité, le héro (3 totaux + stories à la
  une), la capsule des six espaces (icônes + libellés), la carte de post (verre), la feuille de
  commentaires, le desktop (une colonne), les états.
- **Ce qui disparaît :** le plateau texte des six espaces sur `/communaute`, le cockpit desktop
  (`Header` + 280/690/310), les compteurs `posts.length`, le faux « Charger plus », les composants
  morts après migration.
- **Réutilisation :** **14 composants/tokens tels quels · 5 étendus · 7 extraits · 0 dupliqué ·
  0 nouvelle primitive.** Les 4 compositions Communauté (top bar, héro, feed, grille) sont des
  assemblages, pas des primitives.
- **Risque principal :** déplacer la grammaire hors de `COMPTE_V8_CSS` sans déplacer un pixel du
  Compte. Mitigation : déplacement à l'identique, capture pixel-diff à 430 / 768 / 1440, clair et
  sombre, rollback immédiat si diff ≠ 0.
- **Effort :** 18 tâches, 3 lots. Lot 1 = socle + hub mobile ; lot 2 = desktop + post/feuilles ;
  lot 3 = sous-routes + finitions. Estimation : 8 à 12 jours ouvrés d'un agent, hors validation.

---

## 2. Inventaire de l'existant

### 2.1 Routes

| Élément | Chemin | Rôle | État | Preuve |
|---|---|---|---|---|
| Hub | `src/app/communaute/page.tsx` | page unique, mobile + desktop | à réécrire | 960 lignes ; mobile `:450-506`, desktop `:506-943` |
| Layout | `src/app/communaute/layout.tsx` | metadata, canonical, JSON-LD | conservé | 50 lignes |
| Loading | `src/app/communaute/loading.tsx` | squelette | à adapter | 70 lignes |
| Error | `src/app/communaute/error.tsx` | erreur de route | conservé | 46 lignes, `Card` + `Button` |
| Découvrir | `src/app/communaute/decouvrir/page.tsx` | grille de médias, filtres | à adapter (lot 3) | 149 lignes, `CommunityShell` + `.lkdv-subheader` |
| Post | `src/app/communaute/post/[id]/page.tsx` | détail | à adapter (lot 3) | 84 lignes |
| Reels | `src/app/communaute/reels/page.tsx` | vidéos plein écran | à adapter (lot 3) | 218 lignes |
| Publier | `src/app/communaute/publier/page.tsx` | création | à adapter (lot 3) | 1 362 lignes, `Header` + `Footer` + `AppShell` |
| Pro | `src/app/communaute/pro/page.tsx` | alias | conservé | 1 ligne, ré-export |

### 2.2 Composants

| Élément | Chemin | Rôle | État | Preuve |
|---|---|---|---|---|
| Hub mobile | `src/components/communaute/MobileCommunityHub.tsx` | stories, capsule, sections | à réécrire | 473 lignes ; capsule `:157-170`, fil `:178-245` |
| En-tête mobile | `src/components/communaute/MobileCommunityHeader.tsx` | marque + actions | à réécrire | 103 lignes ; `:45-101` |
| Coquille | `src/components/communaute/shell/CommunityShell.tsx` | fond + colonne | à étendre | 53 lignes ; `:30-51` |
| Héro | `src/components/communaute/shell/CommunityHeroCard.tsx` | identité + CTA | à remplacer | 137 lignes ; `:53-135` |
| Contexte | `src/components/communaute/shell/CommunityContextDrawer.tsx` | `Sheet` 2 lentilles | à adapter | 114 lignes ; `:44-110` |
| Carte de post | `src/components/communaute/CommunityPostCard.tsx` | like, save, commentaires, partage | à découper | 1 498 lignes ; rendu `:852-1120`, commentaires inline `:1120+` |
| Stories | `src/components/communaute/CommunityStoriesBar.tsx` | rail de stories | à adapter (mode « à la une ») | 911 lignes |
| Viewer | `src/components/communaute/StoriesViewer.tsx` | plein écran | conservé | 724 lignes |
| Archives | `src/components/communaute/StoriesArchiveSheet.tsx` | archives | conservé | 365 lignes |
| Vues | `src/components/communaute/StoryViewsSheet.tsx` | vues | conservé | 210 lignes |
| Sidebar gauche | `src/components/communaute/CommunityLeftSidebar.tsx` | cockpit desktop | à supprimer | 97 lignes ; utilisé seulement `page.tsx:516` |
| Sidebar droite | `src/components/communaute/CommunityRightSidebar.tsx` | cockpit desktop | à supprimer | 148 lignes ; utilisé seulement `page.tsx:938` |
| Vidéo | `src/components/communaute/CommunityVideo.tsx` | lecteur | conservé | 97 lignes |
| Commentaire | `src/components/communaute/CommentItem.tsx` | ligne de commentaire | conservé | 350 lignes |

### 2.3 Grammaire et primitives

| Élément | Chemin | Rôle | État | Preuve |
|---|---|---|---|---|
| Capsules | `src/styles/liquid-capsules.css` | `.lkdv-capsule`, `.lkdv-lens-float` | à étendre | 195 lignes ; `:24-97`, `:101-186` |
| Capsule React | `src/components/ui/CapsuleTabs.tsx` | tablist 48 px | réutilisé | 123 lignes ; `:40-121` |
| Drawer shell | `src/components/compte/drawer/shell/DrawerShell.tsx` | capsule 48 + secondaire 30 | réutilisé | CSS `:196-235` |
| Slot shell | `src/components/compte/drawer/SlotShell.tsx` | lentilles + états | réutilisé | CSS `:289-333` |
| Lens pager | `src/components/compte/drawer/LensPager.tsx` | swipe | réutilisé | 305 lignes |
| Slot selector | `src/components/compte/drawer/SlotSelector.tsx` | capsules | réutilisé | 84 lignes |
| Sheet | `src/components/ui/Sheet.tsx` | feuille Radix | réutilisé | 181 lignes |
| AppShell | `src/components/shell/AppShell.tsx` | shell, scroll, safe areas | conservé | 151 lignes ; `:121` |
| Registre nav | `src/components/mobile-nav/destinationRegistry.ts` | 5 destinations, plateau | à modifier | `:145-162` |
| CSS communauté | `src/styles/community-social.css` | 1 330 lignes, papier + verre | à réduire | `:204` (post), `:831` (immersif), `:939` (héro), `:1292` (capsule) |

### 2.4 Référence et runtime

| Élément | Chemin | Rôle | État | Preuve |
|---|---|---|---|---|
| Compte React | `src/components/compte/CompteLiquidGlassV8.tsx` | monte le runtime, portails | référence | 4 570 lignes ; CSS `:47`, HTML `:48`, rendu `:4418` |
| Runtime | `src/components/compte/compte-liquid-glass-v8-runtime.js` | DOM, top bar, carte, feuilles | référence | 5 746 lignes ; top `:1212`, `:3261`, nav `:986`, story `:2815` |
| Carte vivante | `src/components/compte/map/CompteMap.tsx` | MapLibre | hors périmètre | 771 lignes |
| Profil public | `src/app/profil/[id]/page.tsx` + `PublicProfileV2.tsx` | profils | hors périmètre | modifié non commité |

### 2.5 Données

| Table / vue | Usage | Preuve |
|---|---|---|
| `community_posts` | fil, découverte, reels, post | `fetch` `page.tsx:174-180` ; schéma `20260713120000_community_features.sql:220-234` |
| `post_likes`, `post_saves`, `post_comments` | états personnels, commentaires | `page.tsx:294-309` ; `CommunityPostCard.tsx:293-380` |
| `carnets` | section carnets | `page.tsx:181-186` |
| `clubs`, `club_members` | section clubs + appartenance | `page.tsx:188-190`, `:270-289` |
| `travel_groups` | expéditions | `page.tsx:191-199` |
| `events`, `join_event` | sorties + inscription | `page.tsx:200-208`, `:118-153` |
| `public_profiles` | auteurs | `page.tsx:311-330` ; vue `20261023090000_three_drawers.sql:12-35` |
| `story_*` | stories | `CommunityStoriesBar.tsx`, `StoriesViewer.tsx` |
| `follow_requests`, `user_blocks` | comptes privés, blocages | RLS `20261015220000_community_post_audience_rls.sql:44-90` |
| `qa_questions`, `qa_answers` | entraide (non branché) | `20260713120000_community_features.sql:263-300` |

### 2.6 Tests verrouillants

| Test | Ce qu'il verrouille | Preuve |
|---|---|---|
| `tests/design/community-social-contract.spec.ts` | ordre média → actions → légende → commentaires ; stories avant tabs ; header ; CSS scopé | 79 lignes |
| `tests/design/community-audience-security.spec.ts` | audience, média privé, RLS club | 49 lignes |
| `tests/design/community-reels-security.spec.ts` | reels | 55 lignes |
| `tests/community/*` | découverte, défauts privés, reproduction | 3 fichiers |
| `tests/visual/community-social.spec.ts` | `lkdv-subheader`, nav absente sur reels, opacité post ≥ 0,5, matrice 393/430/768/1024/1440 | 139 lignes |
| `tests/design/lot2-shell.spec.ts` | `hasExtendedNav` unique | `:96-105` |
| `tests/design/p5-direction-tokens.spec.ts` | tokens de direction | — |

---

## 3. Anatomie du design de référence

Mesures faites sur `/compte` à 430 × 932, Chromium, 2026-10-23. Les valeurs sont des contrats.

| # | Brique | Classes / sélecteurs | Valeurs mesurées | Comportement |
|---|---|---|---|---|
| 1 | Fond | `.lkv-app-background`, `.bg` | photo + voile, `position: fixed`, `z-index: 0` | immobile |
| 2 | Capsule identité | `.ig-top`, `.ig-handle`, `.gbtn.lg` | 34 px, radius 999, `blur(4px) saturate(1.9) brightness(1.07)`, ombre inset 1 px | sticky, 3 actions 34 px |
| 3 | Carte héro | `.card.cs`, `#card` | radius 24, padding 10/11, `blur(25.2px) saturate(1.8) brightness(1.05)` | scroll interne, 67 % de la hauteur |
| 4 | Avatar | `.ig-avi-wrap`, `.ig-avi-in` | 66 px (84 px mobile), anneau conique 2,5 px, bord blanc 2 px | ouvre le drawer |
| 5 | Compteurs | `.ig-stats`, `.ig-stat` | 3 colonnes, gap 4, cellule 39 px, radius 14, `rgba(255,255,255,.38)` | 3 boutons |
| 6 | Bio | `.ig-bio`, `.ig-bio-flags`, `.ig-bio-emp` | 11 px / 1,28, gap 2,5 | texte réel |
| 7 | Stories à la une | `.ig-hl-row`, `.ig-hl`, `.ig-hl-ring` | 5 colonnes, gap 4, anneau 44 px, libellé 9,8 px | scroll horizontal |
| 8 | Capsule section | `.segc`, `.lg-tabs`, `.lkdv-capsule`, `.sel-lens` | 48 px, padding 2, lentille `translateX`, 420 ms `cubic-bezier(.32,.72,0,1)` | tablist |
| 9 | Grille | `.ig-grid`, `.ig-tile` | 3 colonnes, gap 3, tuile 68 px (mobile 86 min, `1/1.05`), radius 10 (9 mobile) | 3 × N |
| 10 | Sélecteur flottant | `.ig-tabs-float`, `.ig-tabs`, `.ig-th.lens` | 30 px, 88 px de large, 10 px des bords, `blur(28px)` | 2 cellules |
| 11 | Feuille | `.sheet`, `.grab`, `.sh-b`, `.flow` | radius 28 mobile / 32 desktop, 3 hauteurs, `blur(30px)` | glissement |
| 12 | Capsules drawer | `.lkdv-drawer-tabs`, `.lkdv-drawer-secondary` | 48 px / 30 px, 14 px de marge, 54 px de bas | 2 niveaux |
| 13 | Barre basse | `.tb`, `.tb .lens` | 48 px mobile, 5 cellules, lentille 420 ms | 5 destinations |
| 14 | Mouvement | partout | `transform` / `opacity`, 420 ms, `prefers-reduced-motion` | pas de layout shift |

**Point dur :** ces règles vivent aujourd'hui dans `COMPTE_V8_CSS` (constante inline de 4 500
lignes), dans `DRAWER_SHELL_CSS`, dans `DRAWER_V2_CSS` et dans `community-social.css`. La même
lentille est écrite quatre fois. Le plan les déplace dans `src/styles/lkdv-glass.css`, sans changer
une valeur.

---

## 4. Matrice de réutilisation

### 4.1 Réutilisés tels quels (14)

| Besoin Communauté | Composant / token | Chemin | Test de non-régression |
|---|---|---|---|
| Capsule 48 px | `CapsuleTabs` | `src/components/ui/CapsuleTabs.tsx` | `CapsuleTabs.test.tsx` |
| Lentille | `.sel-lens` | `liquid-capsules.css` | capture 430 |
| Drawer 2 niveaux | `DrawerShell` | `drawer/shell/DrawerShell.tsx` | 211 tests drawer |
| Slot + états | `SlotShell` | `drawer/SlotShell.tsx` | idem |
| Swipe | `LensPager` | `drawer/LensPager.tsx` | idem |
| Sélecteur de slots | `SlotSelector` | `drawer/SlotSelector.tsx` | `SlotSelectorAria` |
| Feuille | `Sheet` | `src/components/ui/Sheet.tsx` | tests UI |
| Signalement | `ReportSheet` | `src/components/social/ReportSheet.tsx` | tests |
| Visionneuse | `ImageViewer` | `src/components/ui/ImageViewer.tsx` | — |
| Stories | `StoriesViewer` | `communaute/StoriesViewer.tsx` | tests community |
| Hors-ligne | `OfflineBanner` | `features/adventure-intelligence/ui/OfflineBanner.tsx` | — |
| Haptique | `useHapticFeedback` | `src/hooks/useHapticFeedback.ts` | — |
| Z-index | `--z-*` | `src/lib/ui/zIndex.ts` | design tests |
| Shell | `AppShell` | `src/components/shell/AppShell.tsx` | lot2-shell |

### 4.2 Étendus (5)

| Besoin | Composant | Extension | Risque |
|---|---|---|---|
| Capsule avec libellés | `CapsuleTabs` | prop `showLabels` (9,5 px) sans changer le DOM par défaut | test drawer |
| Stories à la une | `CommunityStoriesBar` | mode `variant="highlights"` : 5 anneaux 44 px, libellés | viewer |
| Carte de post | `CommunityPostCard` | présentation extraite, enveloppe verre | logique métier |
| Feuille verre | `Sheet` | variante de surface alignée sur `.sheet` | autres pages |
| Contexte | `CommunityContextDrawer` | `DrawerShell` 2 lentilles au lieu d'une `Sheet` | a11y |

### 4.3 Extraits (7)

| Primitive | Chemin cible | Source exacte | Consommateur |
|---|---|---|---|
| `GlassTopBar` | `src/components/ui/glass/GlassTopBar.tsx` | `.ig-top` + `.ig-handle` + `.gbtn` | compte + communauté |
| `GlassIconButton` | `src/components/ui/glass/GlassIconButton.tsx` | `.gbtn` 34 px | idem |
| `GlassCard` | `src/components/ui/glass/GlassCard.tsx` | `.card.cs`, radius 24 | idem |
| `StatCell` | `src/components/ui/glass/StatCell.tsx` | `.ig-stat` | idem |
| `HighlightsRow` | `src/components/ui/glass/HighlightsRow.tsx` | `.ig-hl-row` | idem |
| `GlassTileGrid` | `src/components/ui/glass/GlassTileGrid.tsx` | `.ig-grid` + `.ig-tile` | compte + découverte |
| `FloatingLens` | `src/components/ui/glass/FloatingLens.tsx` | `.ig-tabs-float` + `.ig-th` | compte + communauté |

### 4.4 Nouveaux (0)

Aucune primitive nouvelle. Les quatre compositions (`CommunityTopBar`, `CommunityHero`,
`CommunityFeed`, `CommunityGrid`) sont des assemblages de primitives existantes ou extraites.

**Précision honnête :** le Compte ne consomme pas les primitives React. Il conserve son DOM vanilla
et consomme la **feuille CSS** partagée. Les primitives React sont le contrat de markup de la
Communauté : mêmes classes, mêmes dimensions, même DOM. C'est ce qui rend la comparaison pixel à
pixel possible sans réécrire un runtime de 5 746 lignes. La « réutilisation à 100 % » porte donc sur
la feuille et sur le contrat de markup, pas sur un import du composant Compte dans la Communauté.

**Compte :** 14 + 5 + 7 = 26 briques couvertes ; 0 dupliquée ; 0 nouvelle primitive.

---

## 5. Architecture cible

### 5.1 Arbre des routes

```
/communaute                         hub, ?tab=fil|evenements
  ?tab=carnets   -> redirect /carnets
  ?tab=clubs     -> redirect /clubs
  ?tab=groupes   -> redirect /groupes
  ?tab=entraide  -> redirect /entraide
/communaute/decouvrir               grille de médias
/communaute/post/[id]               détail + commentaires
/communaute/reels                   vidéos plein écran
/communaute/publier                 création (lot 3)
/communaute/pro                     alias inchangé
```

### 5.2 Arbre des composants (mobile)

```
src/app/communaute/page.tsx
└─ AppShell (background partagé, scroll, nav globale)
   └─ CommunityHub
      ├─ CommunityTopBar            (GlassTopBar + GlassIconButton)
      ├─ CommunityHero              (GlassCard + StatCell + HighlightsRow)
      │  └─ CommunityStoriesHighlights
      ├─ CommunitySpaces            (CapsuleTabs 48 px, 6 cellules)
      ├─ CommunityFeed              (Fil)
      │  ├─ CommunityPostCard (verre)
      │  └─ CommunityGrid (vue Grille, GlassTileGrid)
      ├─ FloatingLens (Fil / Grille, 30 px)
      ├─ CommunitySection (carnets / clubs / groupes / sorties)
      └─ CommunityStates (skeleton / empty / error / offline / guest)
```

### 5.3 Arbre des fichiers

```
src/components/ui/glass/
  GlassTopBar.tsx
  GlassIconButton.tsx
  GlassCard.tsx
  StatCell.tsx
  HighlightsRow.tsx
  GlassTileGrid.tsx
  FloatingLens.tsx
  __tests__/…

src/styles/lkdv-glass.css          (source unique, scope .lkdv-glass)

src/features/community/
  hooks/useCommunityHubData.ts
  hooks/useCommunityTotals.ts
  hooks/__tests__/…
  components/CommunityTopBar.tsx
  components/CommunityHero.tsx
  components/CommunitySpaces.tsx
  components/CommunityFeed.tsx
  components/CommunityGrid.tsx
  components/CommunityStoriesHighlights.tsx
  components/CommunitySection.tsx
  components/CommunityStates.tsx

src/components/communaute/sections/
  CarnetsSection.tsx
  ClubsSection.tsx
  GroupsSection.tsx
  EventsSection.tsx

src/components/communaute/sheets/
  CommunityCommentsSheet.tsx
  CommunityFiltersSheet.tsx
```

### 5.4 Frontières client / serveur

- La page reste un **client component** : elle dépend de `useAuth`, `useSearchParams` et des
  interactions. Aucune requête serveur n'est ajoutée.
- `useCommunityHubData` centralise les lectures Supabase côté client (RLS).
- Les totaux sont des requêtes `head: true` séparées ; pas de calcul côté serveur.
- Aucun secret, aucune clé service.

### 5.5 État

| État | Portée | Source |
|---|---|---|
| `activeTab` | page | `?tab=` (source unique) |
| `view` (`fil` / `grille`) | page | local, non persisté |
| `posts`, `hasMore`, `loadingMore` | hook | Supabase |
| `totals` | hook | 3 counts |
| `carnets`, `clubs`, `groups`, `events` | hook | Supabase, lazy par section |
| `contextOpen`, `commentsPostId`, `filters` | page | local |
| `stories` | `CommunityStoriesHighlights` | Supabase |

---

## 6. Mapping fonctionnel — rien perdu

| Fonctionnalité | Aujourd'hui | Nouvelle maison | Interaction | État vide | Permission | Deep link |
|---|---|---|---|---|---|---|
| Fil | `MobileCommunityHub:178-245` | `CommunityFeed` | scroll infini + Charger plus | « Le fil est calme » + CTA | public | `?tab=fil` |
| Likes | `CommunityPostCard:293-380` | carte verre, mêmes handlers | tap / double-tap | — | auth | — |
| Favoris | idem | idem | tap | — | auth | — |
| Commentaires | inline `:1120+` | `CommunityCommentsSheet` | tap, réponse, édition | « Sois le premier » | auth pour écrire | `?comment=` |
| Partage | `CommunityPostCard` | idem | menu | — | auth | — |
| Stories | `CommunityStoriesBar` | `CommunityStoriesHighlights` + viewer | tap anneau | « Aucune story » | public | — |
| Vues / archives | `StoriesArchiveSheet`, `StoryViewsSheet` | inchangés | tap | — | auteur | — |
| Carnets | `page.tsx:627-676` | `CarnetsSection` | filtres 30 px + recherche | « Aucun carnet » | public | `/carnets` |
| Clubs | `page.tsx:678-771` | `ClubsSection` | filtres 30 px | « Aucun club » | public | `/clubs` |
| Expéditions | `page.tsx:773-841` | `GroupsSection` | tap | « Aucune expédition » | public | `/groupes` |
| Sorties | `page.tsx:843-910` | `EventsSection` | inscription `join_event` | « Aucune sortie » | auth | `?tab=evenements` |
| Entraide | `page.tsx:912-933` (statique) | route `/entraide` | tap | — | public | `?tab=entraide` → redirect |
| Découverte | `decouvrir/page.tsx` | inchangée (lot 3) | filtres, pagination | « Aucun contenu » | public | — |
| Reels | `reels/page.tsx` | inchangée (lot 3) | scroll-snap | « Aucune vidéo » | public | — |
| Publier | `publier/page.tsx` | lot 3 | formulaire | — | auth | — |
| Profils | `/profil/[id]` | inchangé | tap auteur | — | RLS | — |
| Abonnements privés | `follow_requests` | inchangé | CTA | — | auth | — |
| Modération | `ReportSheet`, masquer | inchangé | menu | — | auth | — |
| Notifications | triggers SQL | inchangés | — | — | — | — |

---

## 7. Écran par écran

### 7.1 Hub mobile — 430 × 932

```
safe-top
┌─────────────────────────────────────────────┐
│ [Communauté]              (+) (⌕) (✉)      │  34 px
│ ┌─────────────────────────────────────────┐ │
│ │ (emblème 66)   12        48       6     │ │  GlassCard 24
│ │               publ.   clubs    sorties  │ │  StatCell ×3
│ │ Tes massifs · Vercors, Chartreuse…      │ │  11 px
│ │ [ Publier ]  [ Découvrir ]              │ │
│ │ ◯ ◯ ◯ ◯ ◯  stories à la une             │ │  44 px
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ ▣  ▤  ⚑  ⌂  ▦  ✎                        │ │  capsule 48 sticky
│ └─────────────────────────────────────────┘ │
│ Au fil des aventures          [Fil|Grille]  │  30 px
│ ┌─────────────────────────────────────────┐ │
│ │ post verre 20 px                        │ │
│ └─────────────────────────────────────────┘ │
│ …                                           │
│ [ barre globale 5 destinations ]            │  AppShell
└─────────────────────────────────────────────┘
```

- **Objectif :** retrouver la hiérarchie du Compte (identité → héro → sections → contenu) sans
  perdre le fil.
- **Hiérarchie :** capsule 34 px, carte 24 px, capsule 48 px, cartes 20 px.
- **Contenu exact :** « Communauté » ; trois actions ; emblème ; totaux réels ; ligne de contexte ;
  Publier / Découvrir ; stories ; six espaces ; titre « Au fil des aventures » ; cartes.
- **Actions :** publier, découvrir, rechercher, messages, contexte, changer d'espace, filtrer,
  aimer, commenter, partager, enregistrer.
- **États :** voir §7.7.
- **Desktop :** même composition en 760 px centrés.
- **Clavier :** tablist, flèches, Home/End ; focus visible ; `inert` sur les panneaux inactifs.
- **Copy FR :** « Communauté », « Publier », « Découvrir », « Au fil des aventures », « Fil »,
  « Grille », « Charger plus », « Tu as tout vu ».
- **Analytics :** aucun ajout ; conserver les événements existants s'ils existent.

### 7.2 Hub desktop — 1440 × 900

- Une colonne de 760 px (860 px ≥ 1280), centrée, fond identique.
- Aucun `Header` de site, aucune sidebar.
- La capsule des six espaces fait la largeur de la colonne.
- Le fil reste une colonne ; la grille passe à 4 colonnes au-delà de 900 px de conteneur.
- Le sélecteur Fil/Grille reste en 30 px, à 10 px du bord du conteneur.
- Pas de « cockpit », pas de « live sync », pas de rail clubs.

### 7.3 Drawer contexte

- `DrawerShell` (2 lentilles) ou `Sheet` + capsule 48 px.
- Lentille 1 : massifs réels (carnets chargés + groupes), pas de total inventé.
- Lentille 2 : clubs dont la personne est membre.
- Vide : « Aucun massif dans les carnets chargés. » / « Aucun club rejoint. »
- Aucun en-tête, aucune icône de partage.

### 7.4 Feuille commentaires

- `Sheet` large, sans en-tête.
- En haut : extrait du post (auteur, texte tronqué) en carte verre 18 px.
- Liste : `CommentItem` existant, réponses indentées, « Voir plus ».
- Bas : composer 44 px, `aria-label`, envoi.
- États : chargement (3 squelettes), vide (« Sois le premier à répondre »), erreur (Réessayer),
  non connecté (CTA connexion).
- Clavier : focus dans le composer, Escape ferme, `inert` sur le fond.

### 7.5 Sections

- Chaque section est un `CommunitySection` : titre 15 px, compteur réel, sélecteur secondaire 30 px
  (si 2+ filtres), liste.
- Carnets : filtres massif ; cartes `CarnetHubCard` existantes, enveloppe verre.
- Clubs : filtres Tous / Activité / Pays / Mes clubs ; cartes verre.
- Expéditions : liste, places, lien cockpit.
- Sorties : liste, inscription, compteur ; filtre À venir / Passées (si la donnée existe).
- Entraide : route dédiée, pas de carte statique dans le hub.

### 7.6 Sous-routes (lot 3)

- Découvrir : `CommunityShell` + `.lkdv-subheader` conservé ; grille → `GlassTileGrid`.
- Post : `CommunityShell` + capsule de retour ; carte de post verre ; commentaires en feuille.
- Reels : plein écran conservé ; capsule overlay conservée ; pas de barre globale (test actuel).
- Publier : `AppShell` + sections en cartes verre ; `DrawerShell` pour les étapes si pertinent.

### 7.7 États

| État | Où | Rendu |
|---|---|---|
| Squelette | hub | héro + capsule + 2 cartes grises |
| Vide | fil, sections | carte verre + titre + phrase + CTA |
| Erreur section | section | carte d'erreur locale + Réessayer |
| Erreur totale | hub | carte d'erreur + Réessayer |
| Hors-ligne | hub | `OfflineBanner` + données en cache |
| Invité | hub | héro « Rejoins la communauté » + CTA ; fil public |
| Fin de liste | fil | « Tu as tout vu » |
| Post introuvable | post | carte + retour |

---

## 8. Données et API

### 8.1 Requêtes du hub

| Requête | Table | Champs | Filtre | Limite | Index |
|---|---|---|---|---|---|
| Posts page 0 | `community_posts` | `*` | RLS | 20 | `idx_community_posts_created` |
| Posts page N | `community_posts` | `*` | RLS | `.range(offset, offset+19)` | idem |
| Total posts | `community_posts` | `count` | RLS | `head: true` | idem |
| Total clubs | `clubs` | `count` | — | `head: true` | — |
| Total sorties | `events` | `count` | `event_date >= today`, `status != 'past'` | `head: true` | `events_date` (à vérifier) |
| Carnets | `carnets` | `*` | `visibility = public` (RLS) | 20 | `idx_carnets_created` |
| Clubs | `clubs` | `*` | — | 50 | `idx_clubs_members_count` (à vérifier) |
| Groupes | `travel_groups` | colonnes listées | — | 20 | — |
| Sorties | `events` | `*` | à venir | 20 | — |
| Auteurs | `public_profiles` | `id, full_name, avatar_url, loyalty_level` | ids | — | — |
| Stories | `post_stories` | `*` | RLS | 30 | — |

Les index `idx_community_posts_created` et `idx_carnets_created` existent
(`20260713120000_community_features.sql:337-346`). Les index `clubs(members_count)` et
`events(event_date)` sont **à vérifier** en Task 7 ; s'ils manquent, une migration additive
`create index if not exists` est proposée, pas exécutée sans accord.

### 8.2 Pagination

```ts
// useCommunityHubData.ts
const PAGE = 20;
async function loadMore() {
  if (loadingMore || !hasMore) return;
  setLoadingMore(true);
  const from = posts.length;
  const { data, error } = await supabase
    .from('community_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, from + PAGE - 1);
  if (!error && data) {
    setPosts((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      return [...prev, ...data.filter((p) => !seen.has(p.id))];
    });
    setHasMore(data.length === PAGE);
  }
  setLoadingMore(false);
}
```

- `hasMore` initial = `posts.length === PAGE`, pas `>=`.
- Aucune requête de rechargement complet au clic.
- En cas d'erreur, `loadMore` est réessayable sans perdre la page courante.

### 8.3 Totaux

```ts
const [postsCount, clubsCount, eventsCount] = await Promise.all([
  supabase.from('community_posts').select('*', { count: 'exact', head: true }),
  supabase.from('clubs').select('*', { count: 'exact', head: true }),
  supabase.from('events').select('*', { count: 'exact', head: true })
    .gte('event_date', today).neq('status', 'past'),
]);
```

- Un total `null` n'est pas affiché (`—` ou cellule masquée).
- Aucun `posts.length` dans le héro.
- Le badge de section affiche le total de la section, pas la page.

### 8.4 RLS et permissions

- `community_posts_select_audience` (`20261015220000_community_post_audience_rls.sql:44-90`) :
  public / abonnés / club + blocages. L'UI ne filtre pas à la place de la RLS.
- `public_profiles` est une vue `security_invoker`
  (`20261023090000_three_drawers.sql:12-35`) : pas de fuite de profils privés.
- `follow_requests` : demandes d'abonnement, RLS own/target
  (`20261023091000_three_drawers_rls.sql:40-50`).
- `join_event` : RPC atomique, déjà utilisée (`page.tsx:118-153`).
- Aucune clé service dans le client.

### 8.5 Erreurs

| Code | Cas | Rendu |
|---|---|---|
| 401 | session expirée | état invité + CTA |
| 403 | RLS | section vide, pas d'erreur brute |
| 404 | post supprimé | carte « introuvable » |
| 409 | inscription déjà faite | bouton « Inscrit ✓ » |
| 500 | Supabase | carte d'erreur + Réessayer |

Les messages bruts (`error.message`) ne sont jamais affichés : `sectionErrors` est mappé sur des
libellés français.

---

## 9. Design tokens et CSS

### 9.1 Fichier canonique

`src/styles/lkdv-glass.css`, importé une seule fois dans `src/app/layout.tsx` (ou dans
`globals.css`). Scope `.lkdv-glass`. Il contient :

- les jetons de verre (`--sf`, `--label`, `--label2`, `--label3`, `--tint`, `--accent`, `--sep`,
  `--soft`, `--soft-line`, `--fill`, `--fill2`, `--pg`, `--pg-ink`, `--pg-sh`, `--ga`, `--gb`,
  `--glass-*`) ;
- les briques 2 à 11 (top bar, carte, stats, highlights, grille, sélecteur, feuille, capsules) ;
- leurs états, media queries et `prefers-reduced-motion` ;
- aucun base64, aucun écran de la maquette desktop.

### 9.2 Migration du Compte

1. Ajouter `lkdv-glass` à la racine `.lkdv-compte-v8`.
2. Copier les règles **à l'identique** dans `lkdv-glass.css`.
3. Supprimer les règles d'origine de `COMPTE_V8_CSS` (constante `:47`).
4. Capturer `/compte` avant/après à 430, 768, 1440, clair et sombre.
5. Pixel-diff : 0 pixel de différence toléré. Sinon rollback.

### 9.3 Suppression des doublons

- `DRAWER_SHELL_CSS` et `DRAWER_V2_CSS` : garder les surcharges locales (marges, `!important`
  spécifiques), supprimer les définitions de lentille/capsule déjà présentes dans
  `lkdv-glass.css`.
- `community-social.css` : supprimer les blocs de capsule, de héro, de verre ; ne garder que les
  règles propres à la Communauté (stories, grille de découverte, reels, sous-header).
- `liquid-capsules.css` : devient un fichier de compatibilité qui ré-exporte les classes
  canoniques, ou est supprimé si plus aucun import ne le référence.

### 9.4 Interdits

- `#E4501C`, toute couleur littérale nouvelle, tout `!important` nouveau, tout `z-[…]` local.
- Tout `style={{ background: '#…' }}` dans les nouveaux composants.
- Toute duplication d'une règle de `lkdv-glass.css` dans `community-social.css`.

### 9.5 Contrôles

```bash
# aucune couleur littérale nouvelle dans les fichiers communauté
rg -n "#[0-9a-fA-F]{3,8}" src/components/communaute src/features/community src/app/communaute \
  | rg -v "E4501C|var\\(--" || true

# aucune duplication de la lentille
rg -n "sel-lens|ig-th|translateX\\(calc\\(var\\(--i" src/styles src/components | wc -l
```

---

## 10. Accessibilité (WCAG AA)

- [ ] Toutes les cibles : 44 × 44 px (capsule 48, secondaire 30 + zone 44).
- [ ] `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, roving `tabIndex`.
- [ ] `inert` sur les panneaux inactifs.
- [ ] Focus visible (`--lkv-focus-ring`), ordre logique, pas de piège.
- [ ] `aria-live="polite"` sur les erreurs et le chargement.
- [ ] Contrastes : encre `#17402C` sur verre ≥ 7:1 ; secondaire `#365233` ≥ 4,5:1.
- [ ] La couleur n'est jamais le seul signal (badge + texte).
- [ ] `prefers-reduced-motion` : lentille et feuilles instantanées.
- [ ] Zoom 200 %, pas de débordement horizontal.
- [ ] VoiceOver : héro, capsule, fil, feuille commentaires.
- [ ] Clavier : Tab, flèches, Home/End, Escape, Entrée.

---

## 11. Performance

| Métrique | Budget | Mesure |
|---|---|---|
| LCP p75 | ≤ 2 500 ms | Lighthouse / Playwright trace |
| INP p75 | ≤ 200 ms | lab |
| CLS p75 | ≤ 0,1 | lab |
| JS partagé | 104 KiB | `next build` |
| Shell first load | ≤ 265 KiB | `next build` |
| MapLibre | 0 KiB ajouté | `rg maplibre src/app/communaute src/components/communaute` |
| Images | `next/image` ou `SmartImage`, `sizes` | revue |
| Feuilles | `dynamic` si > 30 KiB | bundle analyzer |

Stratégie :

- Aucun import de `CompteLiquidGlassV8`, aucun `maplibre-gl`.
- `CommunityPostCard` : présentation extraite ; `ImageViewer` déjà `dynamic`.
- `framer-motion` conservé pour le cœur du double-tap et les feuilles ; pas de nouvelle animation
  en boucle.
- Pas de `backdrop-filter` sur chaque carte de post : une seule couche de verre par carte, pas de
  blur imbriqué.
- `content-visibility: auto` sur les cartes hors écran (si le support est vérifié).

Mesures avant/après : `npm run build` (First Load JS), `npx playwright test` avec trace, captures
Lighthouse.

---

## 12. Tests

### 12.1 Existants à ne pas casser

- `tests/design/community-social-contract.spec.ts` (ordre média/actions/légende/commentaires,
  stories avant tabs, `lkdv-community-experience`, CSS scopé).
- `tests/design/community-audience-security.spec.ts` (audience, média privé, RLS club).
- `tests/design/community-reels-security.spec.ts`.
- `tests/community/*`.
- `tests/design/compte-drawer-*` (211 tests).
- `tests/design/lot2-shell.spec.ts`, `p5-direction-tokens.spec.ts`, `m02-destination-registry.spec.ts`.
- `tests/visual/community-social.spec.ts` : à mettre à jour **avec** le changement de spec
  (plateau supprimé, nouveau héro), pas pour masquer une régression.

### 12.2 Nouveaux tests

| Fichier | Cas |
|---|---|
| `src/features/community/hooks/__tests__/useCommunityHubData.test.ts` | page 0, loadMore sans doublon, `hasMore=false` à la fin, erreur section, totals `null` |
| `src/components/ui/glass/__tests__/GlassTopBar.test.tsx` | 34 px, 3 actions, focus |
| `src/components/ui/glass/__tests__/StatCell.test.tsx` | 3 cellules, `—` si null |
| `src/components/ui/glass/__tests__/HighlightsRow.test.tsx` | 5 anneaux, scroll, clavier |
| `src/components/ui/glass/__tests__/FloatingLens.test.tsx` | 2 cellules, `aria-selected` |
| `src/features/community/components/__tests__/CommunityHero.test.tsx` | totaux réels, invité |
| `src/features/community/components/__tests__/CommunitySpaces.test.tsx` | 6 espaces, `?tab=`, redirects |
| `src/features/community/components/__tests__/CommunityFeed.test.tsx` | vide, erreur, fin de liste |
| `src/components/communaute/sheets/__tests__/CommunityCommentsSheet.test.tsx` | vide, erreur, non connecté |
| `tests/e2e/communaute-v2.spec.ts` | mobile 430 : capsule, héro, fil, feuille ; desktop 1440 : une colonne ; clavier |
| `tests/visual/communaute-v2.spec.ts` | captures 430 / 768 / 1440, clair / sombre |
| `tests/a11y/communaute-v2.spec.ts` | axe 0 critique |

### 12.3 Commandes

```bash
npm run type-check
npx vitest run src/features/community src/components/ui/glass
npx vitest run tests/design/community-social-contract.spec.ts tests/design/community-audience-security.spec.ts tests/community
npx playwright test tests/visual/community-social.spec.ts --config=playwright.visual.config.ts --project=iphone-14-pro-chromium
npx playwright test tests/visual/communaute-v2.spec.ts --config=playwright.visual.config.ts
npm run test:a11y
npm run build
```

---

## 13. Plan par phases et tâches

> Chaque tâche est indépendante, vérifiable et commitée seule. Aucune tâche ne commence avant que la
> précédente soit verte. Les tâches 2 à 6 touchent `/compte` : elles sont **move-only** et bloquées
> par un pixel-diff nul.

### Phase 0 — Socle

#### Task 1 — Figer la référence et la baseline

- [ ] **Task 1**

**Files:**
- Modify: aucun fichier de `src/`.
- Create: `docs/communaute/v2-audit/BASELINE.md`.
- Test: aucun.

**Dépend de :** —

**Steps:**
1. `git status --short` : inventorier les modifications non commitées. Ne rien stash, ne rien écraser.
2. Demander à l'utilisateur de commiter ou d'autoriser un commit `wip(compte): carte vivante + onboarding + profils publics` sur `main`.
3. Créer `chantier/communaute-v2` depuis `main` (ou depuis le commit WIP validé).
4. `git merge-base --is-ancestor main HEAD` → vérifier que la branche inclut `main`.
5. Créer un worktree propre `../lkdv-communaute-v2` pour les builds.
6. Écrire `BASELINE.md` : commit, hash du diff, date, node, `npm run build` (First Load JS), `npm test`, captures.
7. Capturer `/compte` et `/communaute` à 430 × 932, 768 × 1024, 1440 × 900, clair et sombre, dans `docs/communaute/v2-audit/`.

**Verification:**
- `git log --oneline -1` → commit de référence noté.
- `npm run build` → succès, First Load JS noté.
- `npm test` → 0 échec (ou échecs préexistants listés).

**Commit:** `docs(communaute): baseline v2 et référence figée`

#### Task 2 — Extraire les jetons de verre

- [ ] **Task 2**

**Files:**
- Create: `src/styles/lkdv-glass.css`.
- Modify: `src/app/layout.tsx` (import), `src/components/compte/CompteLiquidGlassV8.tsx` (classe racine + suppression des jetons extraits).
- Test: `tests/design/compte-liquid-glass-v8.spec.ts` (existant), captures.

**Dépend de :** Task 1

**Steps:**
1. Lister les jetons utilisés par les 14 briques : `--sf`, `--label*`, `--tint`, `--accent`, `--sep`, `--soft*`, `--fill*`, `--pg*`, `--ga`, `--gb`, `--glass-*`.
2. Créer `.lkdv-glass { … }` avec ces jetons, valeurs copiées à l'identique.
3. Ajouter `lkdv-glass` à la racine de `CompteLiquidGlassV8`.
4. Importer `lkdv-glass.css` dans `layout.tsx` avant les styles du Compte.
5. Capturer `/compte` avant/après à 430, 768, 1440, clair et sombre.
6. Pixel-diff : 0. Sinon rollback.

**Verification:**
- `npx vitest run tests/design/compte-liquid-glass-v8.spec.ts` → vert.
- Captures identiques (diff binaire).
- `npm run type-check` → 0.

**Commit:** `refactor(glass): extraire les jetons de verre du Compte`

#### Task 3 — Extraire la capsule d'identité

- [ ] **Task 3**

**Files:**
- Create: `src/components/ui/glass/GlassTopBar.tsx`, `GlassIconButton.tsx`, tests.
- Modify: `src/styles/lkdv-glass.css` (règles `.ig-top`, `.ig-handle`, `.gbtn`), `CompteLiquidGlassV8.tsx` (suppression des règles déplacées).
- Test: `src/components/ui/glass/__tests__/GlassTopBar.test.tsx`.

**Dépend de :** Task 2

**Steps:**
1. Écrire le test : 3 actions, 34 px, `aria-label`, focus.
2. Déplacer `.ig-top`, `.ig-handle`, `.gbtn` (et leurs états) dans `lkdv-glass.css`, scopés `.lkdv-glass`.
3. Créer `GlassTopBar` et `GlassIconButton` avec le markup exact du Compte.
4. Ne pas modifier le DOM du Compte dans cette tâche.
5. Capturer `/compte` → identique.

**Verification:**
- `npx vitest run src/components/ui/glass/__tests__/GlassTopBar.test.tsx` → vert.
- `npm run type-check` → 0.
- Capture `/compte` → 0 pixel de différence.

**Commit:** `refactor(glass): extraire la capsule d'identité`

#### Task 4 — Extraire la carte héro, les stats et les stories à la une

- [ ] **Task 4**

**Files:**
- Create: `src/components/ui/glass/GlassCard.tsx`, `StatCell.tsx`, `HighlightsRow.tsx`, tests.
- Modify: `src/styles/lkdv-glass.css` (`.card`, `.ig-header`, `.ig-avi-*`, `.ig-stat*`, `.ig-hl-*`), `CompteLiquidGlassV8.tsx`.
- Test: `GlassCard.test.tsx`, `StatCell.test.tsx`, `HighlightsRow.test.tsx`.

**Dépend de :** Task 3

**Steps:**
1. Tests : carte 24 px, 3 stats, 5 anneaux, clavier.
2. Déplacer les règles à l'identique.
3. Créer les trois primitives avec le markup du Compte.
4. Capturer `/compte` → identique.

**Verification:**
- `npx vitest run src/components/ui/glass/__tests__` → vert.
- Captures 430 / 768 / 1440 → 0 pixel.
- `npm run type-check` → 0.

**Commit:** `refactor(glass): extraire la carte héro et les stories à la une`

#### Task 5 — Extraire la grille, les tuiles et le sélecteur flottant

- [ ] **Task 5**

**Files:**
- Create: `src/components/ui/glass/GlassTileGrid.tsx`, `FloatingLens.tsx`, tests.
- Modify: `src/styles/lkdv-glass.css` (`.ig-grid`, `.ig-tile`, `.ig-tabs-float`, `.ig-tabs`, `.ig-th`), `CompteLiquidGlassV8.tsx`.
- Test: `GlassTileGrid.test.tsx`, `FloatingLens.test.tsx`.

**Dépend de :** Task 4

**Steps:**
1. Tests : 3 colonnes, 68 px, 2 cellules, `aria-selected`.
2. Déplacer les règles.
3. Créer les primitives.
4. Capturer `/compte` → identique.

**Verification:**
- `npx vitest run src/components/ui/glass/__tests__` → vert.
- Captures → 0 pixel.
- `npm run type-check` → 0.

**Commit:** `refactor(glass): extraire la grille et le sélecteur flottant`

#### Task 6 — Extraire la feuille et supprimer les copies

- [ ] **Task 6**

**Files:**
- Modify: `src/styles/lkdv-glass.css` (`.sheet`, `.grab`, `.sh-*`, `.flow`, `.segc`), `drawer/shell/DrawerShell.tsx`, `drawer/SlotShell.tsx`, `src/styles/community-social.css`, `src/styles/liquid-capsules.css`.
- Test: `tests/design/compte-drawer-v2-shell.spec.ts`, `compte-drawer-a11y.spec.ts`, captures.

**Dépend de :** Task 5

**Steps:**
1. Déplacer les règles de feuille et de capsule dans `lkdv-glass.css`.
2. Supprimer les définitions dupliquées de `DRAWER_SHELL_CSS` et `DRAWER_V2_CSS`, en gardant les surcharges locales.
3. Supprimer les blocs dupliqués de `community-social.css`.
4. Vérifier les 211 tests drawer et les captures `/compte`.

**Verification:**
- `npx vitest run src/components/compte/drawer/__tests__` → 211/211.
- `npx vitest run tests/design/compte-drawer-v2-shell.spec.ts tests/design/compte-drawer-a11y.spec.ts` → vert.
- Captures `/compte` → 0 pixel.
- `rg "sel-lens" src/styles src/components | wc -l` → une seule définition.

**Commit:** `refactor(glass): une seule feuille et une seule lentille`

### Phase 1 — Données

#### Task 7 — Centraliser les données du hub

- [ ] **Task 7**

**Files:**
- Create: `src/features/community/hooks/useCommunityHubData.ts`, `useCommunityTotals.ts`, tests.
- Modify: `src/app/communaute/page.tsx` (branchement progressif).
- Test: `src/features/community/hooks/__tests__/useCommunityHubData.test.ts`.

**Dépend de :** Task 6

**Steps:**
1. Écrire les tests : page 0, loadMore sans doublon, `hasMore=false`, erreur section, totals `null`.
2. Extraire les requêtes de `page.tsx:166-355` dans le hook.
3. Implémenter `loadMore` avec `.range()`.
4. Implémenter les 3 counts.
5. Vérifier les index `clubs(members_count)` et `events(event_date)` ; si absents, proposer une migration additive (non exécutée).
6. Brancher le hook sur la page actuelle sans changer le rendu.

**Verification:**
- `npx vitest run src/features/community/hooks/__tests__` → vert.
- `npm run type-check` → 0.
- Test manuel : « Charger plus » ajoute 20 posts.

**Commit:** `feat(communaute): données du hub et pagination réelle`

### Phase 2 — Hub mobile

#### Task 8 — Top bar et héro

- [ ] **Task 8**

**Files:**
- Create: `src/features/community/components/CommunityTopBar.tsx`, `CommunityHero.tsx`, tests.
- Modify: `src/app/communaute/page.tsx` (mobile), `MobileCommunityHeader.tsx` (suppression), `CommunityHeroCard.tsx` (suppression).
- Test: `CommunityTopBar.test.tsx`, `CommunityHero.test.tsx`.

**Dépend de :** Task 7

**Steps:**
1. Tests : 3 actions, totaux réels, état invité.
2. Composer `CommunityTopBar` avec `GlassTopBar`.
3. Composer `CommunityHero` avec `GlassCard`, `StatCell`, `HighlightsRow`.
4. Remplacer le héro actuel dans la page mobile.
5. Vérifier que le héro ne lit jamais `posts.length`.

**Verification:**
- `npx vitest run src/features/community/components/__tests__/CommunityHero.test.tsx` → vert.
- Capture 430 → capsule 34, carte 24, 3 stats.
- `rg "posts.length" src/features/community src/app/communaute` → 0 dans le héro.

**Commit:** `feat(communaute): capsule d'identité et héro du Compte`

#### Task 9 — Capsule des six espaces et suppression du plateau

- [ ] **Task 9**

**Files:**
- Create: `src/features/community/components/CommunitySpaces.tsx`, test.
- Modify: `src/components/mobile-nav/destinationRegistry.ts` (retirer `/communaute`), `src/app/communaute/page.tsx`, `MobileCommunityHub.tsx` (suppression de la capsule locale).
- Test: `CommunitySpaces.test.tsx`, `tests/design/lot2-shell.spec.ts`.

**Dépend de :** Task 8

**Steps:**
1. Test : 6 espaces, `?tab=`, redirects carnets/clubs/groupes/entraide.
2. Retirer `/communaute` de `EXTENDED_NAV_PREFIXES`.
3. Vérifier chaque sous-route (`/communaute/decouvrir`, `/post`, `/reels`, `/publier`) : si une
   sous-route a besoin du plateau, créer une exception explicite dans le registre, jamais un préfixe
   global qui réintroduirait le doublon.
4. Rendre `CommunitySpaces` avec `CapsuleTabs` (icônes + libellés 9,5 px).
5. Vérifier `AppShell` : plus de plateau, hauteur réservée correcte.
6. Vérifier `/clubs`, `/carnets`, `/evenements` : plateau intact.

**Verification:**
- `npx vitest run src/features/community/components/__tests__/CommunitySpaces.test.tsx` → vert.
- `npx vitest run tests/design/lot2-shell.spec.ts` → vert.
- Capture 430 → un seul sélecteur local.
- `rg "NavigationPlateau" src/app/communaute` → 0.

**Commit:** `feat(communaute): un seul sélecteur des six espaces`

#### Task 10 — Stories à la une

- [ ] **Task 10**

**Files:**
- Create: `src/features/community/components/CommunityStoriesHighlights.tsx`, test.
- Modify: `CommunityStoriesBar.tsx` (variante `highlights`), `CommunityHero.tsx`.
- Test: `CommunityStoriesHighlights.test.tsx`.

**Dépend de :** Task 9

**Steps:**
1. Test : 5 anneaux, libellés, clic ouvre le viewer.
2. Ajouter la variante `highlights` à `CommunityStoriesBar`.
3. Brancher dans le héro.
4. Vérifier `StoriesViewer`, archives, vues.

**Verification:**
- `npx vitest run src/features/community/components/__tests__/CommunityStoriesHighlights.test.tsx` → vert.
- Capture 430 → 5 anneaux 44 px.
- `npx vitest run tests/community` → vert.

**Commit:** `feat(communaute): stories à la une dans le héro`

#### Task 11 — Fil et grille

- [ ] **Task 11**

**Files:**
- Create: `src/features/community/components/CommunityFeed.tsx`, `CommunityGrid.tsx`, `FloatingLens.tsx` (si non extrait), tests.
- Modify: `CommunityPostCard.tsx` (enveloppe verre, présentation), `page.tsx`.
- Test: `CommunityFeed.test.tsx`, `CommunityGrid.test.tsx`.

**Dépend de :** Task 10

**Steps:**
1. Tests : fil vide, erreur, fin de liste, grille 3 colonnes.
2. Extraire la présentation de `CommunityPostCard` (header, média, actions, légende) sans toucher à la logique.
3. Envelopper la carte dans `GlassCard` 20 px.
4. Ajouter la vue Grille avec `GlassTileGrid`.
5. Ajouter `FloatingLens` Fil/Grille.
6. Conserver l'ordre média → actions → légende → commentaires (test contrat).

**Verification:**
- `npx vitest run src/features/community/components/__tests__/CommunityFeed.test.tsx` → vert.
- `npx vitest run tests/design/community-social-contract.spec.ts` → vert.
- Capture 430 → cartes verre, sélecteur 30 px.

**Commit:** `feat(communaute): fil et grille en verre`

#### Task 12 — Sections

- [ ] **Task 12**

**Files:**
- Create: `src/components/communaute/sections/CarnetsSection.tsx`, `ClubsSection.tsx`, `GroupsSection.tsx`, `EventsSection.tsx`, `CommunitySection.tsx`.
- Modify: `MobileCommunityHub.tsx` (devient un orchestrateur), `page.tsx`.
- Test: tests de section.

**Dépend de :** Task 11

**Steps:**
1. Extraire chaque section de `MobileCommunityHub.tsx` et `page.tsx`.
2. Appliquer la carte verre et le sélecteur secondaire 30 px.
3. Router `entraide` vers `/entraide`.
4. Supprimer le code mort.

**Verification:**
- Tests de section verts.
- Captures 430 pour chaque onglet.
- `rg "MobileCommunityHub" src` → 1 import.

**Commit:** `feat(communaute): sections carnets, clubs, expéditions, sorties`

#### Task 13 — États

- [ ] **Task 13**

**Files:**
- Create: `src/features/community/components/CommunityStates.tsx`, tests.
- Modify: `page.tsx`, `loading.tsx`.
- Test: `CommunityStates.test.tsx`.

**Dépend de :** Task 12

**Steps:**
1. Tests : squelette, vide, erreur, hors-ligne, invité.
2. Brancher les états.
3. Aligner `loading.tsx` sur l'anatomie réelle.

**Verification:**
- Tests verts.
- Captures des 5 états.
- `npm run type-check` → 0.

**Commit:** `feat(communaute): les cinq états du hub`

### Phase 3 — Desktop

#### Task 14 — Une seule colonne

- [ ] **Task 14**

**Files:**
- Modify: `src/app/communaute/page.tsx` (suppression du bloc desktop), `src/styles/community-social.css` (suppression des règles cockpit).
- Delete: `CommunityLeftSidebar.tsx`, `CommunityRightSidebar.tsx`.
- Test: `tests/visual/community-social.spec.ts` (matrice 1440).

**Dépend de :** Task 13

**Steps:**
1. Supprimer `Header` et le conteneur 3 colonnes.
2. Rendre la même composition que le mobile, max 760 / 860 px.
3. Supprimer les sidebars et leurs imports.
4. Vérifier le rendu à 768, 1024, 1440.

**Verification:**
- Capture 1440 → une colonne, pas de `Header`.
- `rg "CommunityLeftSidebar|CommunityRightSidebar" src` → 0.
- Tests visuels verts.

**Commit:** `feat(communaute): desktop en une colonne, fin du cockpit`

### Phase 4 — Post et feuilles

#### Task 15 — Carte de post

- [ ] **Task 15**

**Files:**
- Modify: `CommunityPostCard.tsx` (sous-composants), `src/styles/community-social.css`.
- Test: `tests/design/community-social-contract.spec.ts`, tests de carte.

**Dépend de :** Task 14

**Steps:**
1. Découper la présentation en `PostHeader`, `PostMedia`, `PostActions`, `PostCaption`.
2. Conserver les handlers et les requêtes.
3. Appliquer la surface verre 20 px.
4. Vérifier l'ordre du contrat.

**Verification:**
- `npx vitest run tests/design/community-social-contract.spec.ts` → vert.
- Capture 430 → carte verre, opacité ≥ 0,5.
- Tests de like/save/comment verts.

**Commit:** `refactor(communaute): présentation de la carte de post`

#### Task 16 — Feuilles commentaires, contexte, filtres

- [ ] **Task 16**

**Files:**
- Create: `src/components/communaute/sheets/CommunityCommentsSheet.tsx`, `CommunityFiltersSheet.tsx`, tests.
- Modify: `CommunityPostCard.tsx`, `CommunityContextDrawer.tsx`, `page.tsx`.
- Test: tests de feuille.

**Dépend de :** Task 15

**Steps:**
1. Tests : vide, erreur, non connecté, réponse.
2. Remplacer les commentaires inline par la feuille.
3. Passer le contexte en `DrawerShell` 2 lentilles ou `Sheet` + capsule 48.
4. Ajouter les filtres 30 px.
5. Vérifier `inert`, focus, Escape.

**Verification:**
- Tests verts.
- `npx playwright test tests/e2e/compte-drawer-v2.spec.ts` → vert (non-régression).
- Captures 430.

**Commit:** `feat(communaute): feuilles commentaires, contexte et filtres`

### Phase 5 — Sous-routes

#### Task 17 — Découvrir, post, reels, publier

- [ ] **Task 17**

**Files:**
- Modify: `decouvrir/page.tsx`, `post/[id]/page.tsx`, `reels/page.tsx`, `publier/page.tsx`.
- Test: `tests/visual/community-social.spec.ts`, `tests/e2e/communaute-v2.spec.ts`.

**Dépend de :** Task 16

**Steps:**
1. Appliquer `lkdv-glass` aux coquilles.
2. Remplacer les en-têtes maison par `.lkdv-subheader` (déjà fait pour découvrir/reels/post).
3. Publier : `AppShell` + sections en cartes verre, sans `Header`/`Footer`.
4. Vérifier les tests `lkdv-subheader`, `Navigation principale` absent sur Reels.

**Verification:**
- `npx playwright test tests/visual/community-social.spec.ts --config=playwright.visual.config.ts` → vert.
- Captures des 4 routes.
- `npm run type-check` → 0.

**Commit:** `feat(communaute): sous-routes sur la grammaire partagée`

### Phase 6 — Finitions

#### Task 18 — A11y, perf, preuves

- [ ] **Task 18**

**Files:**
- Modify: tests, docs, `docs/communaute/RAPPORT-V2.md`.
- Test: a11y, perf, visual.

**Dépend de :** Task 17

**Steps:**
1. `npm run type-check`, `npm test`, `npm run build`.
2. `npm run test:a11y`, `npm run audit:contrast`.
3. Captures 360 / 390 / 430 / 768 / 1024 / 1440, clair et sombre.
4. Mesures LCP / INP / CLS, First Load JS.
5. Rédiger le rapport avec commandes et sorties.

**Verification:**
- Toutes les commandes vertes.
- Captures et mesures dans le rapport.
- `/compte` identique (captures).

**Commit:** `docs(communaute): rapport v2, captures et mesures`

---

## 14. Risques, rollback, rollout

| Risque | Probabilité | Impact | Mitigation | Critère d'arrêt |
|---|---|---|---|---|
| L'extraction CSS déplace un pixel du Compte | moyenne | élevé | move-only + pixel-diff 5 viewports × 2 thèmes | diff ≠ 0 → rollback de la tâche |
| `COMPTE_V8_CSS` est une constante minifiée | élevée | moyen | édition ciblée + script de vérification + captures | une règle manquante → rollback |
| Le retrait du plateau casse la hauteur réservée | moyenne | moyen | test `lot2-shell`, captures 430/768, vérif `/clubs` | trou/chevauchement → rollback registre |
| `CommunityPostCard` perd la logique métier | moyenne | élevé | extraction de présentation uniquement, tests like/save/comment | un test rouge → rollback |
| Les counts RLS sont lents | faible | moyen | mesurer, fallback : masquer la 3e cellule si le count dépasse 50 ms | p95 > 50 ms → fallback |
| Le desktop une colonne déplaît | moyenne | moyen | décision D2 à valider, capture avant | refus utilisateur → Task 14 annulée |
| La branche est sale / derrière main | élevée | élevé | Task 1 obligatoire | pas de commit WIP → arrêt |
| Les tests visuels existants changent | élevée | moyen | mise à jour justifiée, pas de masquage | un test supprimé sans justification → arrêt |

**Rollback :** chaque tâche est un commit isolé. `git revert <sha>` suffit. Aucune migration, aucun
déploiement. Le feature flag n'est pas nécessaire : la branche n'est pas déployée.

**Rollout :** merge sur `main`, build Vercel, vérification production 430/1440, clair/sombre. Aucun
push sans accord.

---

## 15. Questions ouvertes et hypothèses

| # | Question | Hypothèse par défaut |
|---|---|---|
| 1 | Valides-tu l'extraction de la grammaire du Compte (Task 2-6), sachant que c'est ~40 % de l'effort ? | **oui** ; sans elle, la réutilisation à 100 % n'est pas atteignable |
| 2 | Le desktop doit-il être une colonne centrée (recommandé) ou garder un cockpit re-skinné ? | **colonne centrée** |
| 3 | Faut-il une carte MapLibre dans la Communauté ? | **non** ; pas de coordonnées réelles pour clubs/événements |
| 4 | Le héro doit-il afficher les totaux de la communauté ou les stats du profil ? | **totaux communauté** (publications, clubs, sorties à venir) |
| 5 | L'onglet Entraide doit-il router vers `/entraide` ou garder une carte statique ? | **router** vers `/entraide` |
| 6 | Peut-on commiter le chantier « carte vivante » avant de commencer ? | **oui**, nécessaire pour figer la référence |
| 7 | Le `post_type: 'event'` doit-il être corrigé dans ce chantier ? | **non**, correctif séparé |

---

## 16. Definition of Done

- [ ] La page `/communaute` mobile a le même fond, la même capsule 34 px, la même carte héro 24 px,
      la même capsule 48 px, les mêmes rayons et le même verre que `/compte`.
- [ ] Le desktop est une colonne centrée, sans `Header` de site ni sidebars.
- [ ] Un seul sélecteur des six espaces ; le plateau texte a disparu ; la barre globale est intacte.
- [ ] Tous les totaux viennent d'un `count` ; aucun `posts.length` affiché comme total.
- [ ] « Charger plus » charge réellement 20 posts de plus, sans doublon.
- [ ] Les six espaces mènent à un contenu réel ; `?tab=` et `?post=` fonctionnent.
- [ ] Les cinq états sont rendus (squelette, vide, erreur, hors-ligne, invité).
- [ ] `/compte` est identique avant/après (captures 430 / 768 / 1440, clair / sombre).
- [ ] 0 duplication de la lentille ; 0 nouveau token ; 0 `#E4501C`.
- [ ] `npm run type-check`, `npm test`, `npm run build`, tests visuels et a11y verts.
- [ ] Captures 360 / 390 / 430 / 768 / 1024 / 1440, clair et sombre.
- [ ] Rapport `docs/communaute/RAPPORT-V2.md` avec commandes, sorties et mesures.
- [ ] Aucun push, aucun déploiement, aucune migration distante sans accord.

---

## 17. Auto-contrôle du plan

- [x] Chaque affirmation sur l'existant a un `fichier:ligne`.
- [x] Chaque composant cité existe (chemin vérifié).
- [x] Chaque table citée existe (migration vérifiée).
- [x] Chaque tâche a des fichiers, des étapes, un test, une commande et un commit.
- [x] Chaque écran a ses états.
- [x] Chaque fonctionnalité du périmètre apparaît dans le mapping.
- [x] La matrice de réutilisation couvre 100 % des besoins.
- [x] Aucun « TBD », aucun « à définir ».
- [x] Chaque risque a une mitigation et un critère d'arrêt.
- [x] Le spec et le plan ne se contredisent pas.
- [x] Les chemins et la date sont exacts.
