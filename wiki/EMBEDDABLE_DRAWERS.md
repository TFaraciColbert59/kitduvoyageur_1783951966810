# EMBEDDABLE_DRAWERS — Drawers Montables SUR PLACE (Sans Quitter la Page)

> **Règle d'or UX** : Si l'utilisateur est sur Explorer, un Carnet ou un Club et veut créer un Post, une Story, un Carnet ou partager dans une Discussion, **monte le drawer directement sur place** (lazy-loaded `dynamic(..., { ssr: false })`) au lieu de le rediriger vers `/communaute` ou `/messagerie`.

---

## 1. Formulaires de Création V2 (Post, Story, Carnet, Sortie, Kit, Club)
- **Modèle de référence prouvé en prod** : `src/components/carnet/v2/CarnetCommunityCreateBridge.tsx`
- **Coque & Contexte** :
  - `CommunitySheetShell` (`src/features/community/v2/shared/CommunitySheetShell.tsx`)
  - `CreateSheetContext` (`src/features/community/v2/create/CreateSheetContext.tsx`)
  - `CommunityFormDrawer` (`src/features/community/create/CommunityFormDrawer.tsx` — `76dvh`, poignée grabber, footer sticky, `EmbeddedFormContext` quand imbriqué)
- **Formulaires lazy-loadables sur n'importe quelle page** (`src/features/community/v2/create/forms/`) :
  - `PostFormV2` · `StoryFormV2` · `CarnetFormV2` · `SortieFormV2` · `KitFormV2` · `ClubFormV2`
- **Auto-remplissage depuis une sortie** : passer le payload généré par `src/features/explorer-v2/outingHandoff.ts`.
- **CSS requis** : `@/styles/communaute-v2.css`, `@/styles/communaute-v2-shell.css`, `@/features/community/v2/create/create-v2.css`.

## 2. Partage Direct (Messagerie, Clubs, Lien)
- **`PostSharePanel`** (`src/features/community/feed/PostSharePanel.tsx`)
  - Props : `{ post, user, onClose, onRequireAuth?, permalinkOverride? }`
  - Hook intégré : **`usePostShareTargets(user?.id)`** — charge les conversations Messagerie réelles, recherche instantanée, envoi en 1 tap + copie permalien + toast.
  - Rendu via `createPortal` → montable sur **n'importe quelle page**.
- **`FreedomShareDrawer`** (`src/features/community/reels/FreedomShareDrawer.tsx`)
  - Variante complète avec `useDragDismiss`, `SubCapsuleTabs`, `useHapticFeedback` et `usePostShareTargets`.

## 3. Commentaires d'un Contenu
- **`FreedomCommentsDrawer`** (`src/features/community/reels/FreedomCommentsDrawer.tsx`)
  - Drawer portal standardisé pour lire/poster des commentaires avec mentions (`MentionPicker`).

## 4. Stories (Visionneur, Vues, Archives)
- **`StoriesViewer`** (`src/components/communaute/StoriesViewer.tsx` — toujours en `dynamic(..., { ssr: false })`)
- **`StoryViewsSheet`** (`src/components/communaute/StoryViewsSheet.tsx`)
- **`StoriesArchiveSheet`** (`src/components/communaute/StoriesArchiveSheet.tsx`)
- **`StoryStage`** (`src/features/community/create/shared/StoryStage.tsx`) — éditeur d'overlays (`text`, `sticker` `lieu`/`altitude`/`meteo`/`distance`).

## 5. Sub-Drawers Portaled Explorer v2
- **`ExplorerNestedSubDrawer`** + **`SummaryExpertAnalysisSubDrawer`** (`src/features/explorer-v2/redesign/summary/`)
  - Hauteur `92dvh`, portée CSS **`.xp20-exp-scope` obligatoire** (jamais `.xp20-root`), reset `scrollTop = 0` sur `.xp20-nested-body`.

## 6. Coquille Universelle de Drawer (`SlotShell`)
- **`SlotShell`** (`src/components/compte/drawer/SlotShell.tsx`)
  - Props clés : `{ slot, title, selector, lenses, activeLensIndex, onLensChange, renderLens, bottomRightFilter, state }`
  - Donne gratuitement : `CapsuleTabs 56px` en haut, `LensPager` swipeable au centre, sous-volets icônes + filtre en **bas à droite**, états `loading`/`empty`/`error`.
