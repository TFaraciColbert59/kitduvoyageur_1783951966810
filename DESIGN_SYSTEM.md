# DESIGN_SYSTEM.md — Référentiel UI/UX & Composants Canoniques LKDV

Ce document est la **source de vérité unique** pour toute l'application **Le Kit du Voyageur (LKDV)** (Compte/Profil, Carnet, Clubs, Sorties, Coffre/Matériel, Kits, Pokédex, Stories, Messagerie, Carte 3D). Il est synchronisé avec la règle always-on [`.agents/rules/lkdv-design-system.md`](.agents/rules/lkdv-design-system.md).

## Principes Non Négociables
1. **Zéro duplication visuelle** : un produit, un kit, une espèce Pokédex, une story ou un message chat s'affiche **exactement de la même manière** partout dans l'application.
2. **Grammaire spatiale des Drawers** :
   - **Haut** : poignée `.lkdv-mgrab` + `CapsuleTabs` principal. En fiche détail, fermeture par **pilule circulaire `×` sans libellé**.
   - **Bas à droite** : **tous les sous-drawers** (`SlotShell` `lenses` → `.lkdv-lens-tabs`) et **tous les filtres** (`SortMenuButton`).
   - **Bas à gauche** : **CTA primaire flottant en pilule** (ex. `Je participe` / `Inscrit ✓`), sans jamais afficher `Reprendre la lecture`.
3. **Matière Liquid Glass** : pilules `border-radius: 999px`, verre translucide `lg gbtn` / `lkdv-carnet-btn-soft`, palette `#17402C` / `#172B24` / `#96BA8E` / `#FBFAF6` (aucun `#E4501C`).
4. **Composants canoniques** :
   - **Produit / Matériel** → `ClubGearProductCard` (`src/components/clubs/drawer/ClubGearProductCard.tsx`) en grille 2 colonnes + `KitProductSheetV2`.
   - **Kit** → `KitCard` (`src/components/compte/drawer/cards/KitCard.tsx`) + `KIT_CARD_CSS`.
   - **Pokédex** → `ClubPokedexDrawerBody` / `CarnetPokedexDrawerBody` (`ClubPokedexHoloCard`).
   - **Stories** → `StoryArchiveDrawer` / `ClubHighlightManageDrawer` / `StoriesViewer`.
   - **Chat / Salons** → `MessagesScreen` / `ClubSalonsDrawerBody` (`ComposerMenuSheet`, `AttachmentDrawer`, `VoiceRecorderBar`, `AudioPlayerBubble`, `TraceMap`, hamburger salons en bas à droite).
   - **Carte 3D** → `ClubMap`, `createClub3DStyle`, `ClubOutingScrubberHud` (en `.mapbig` : `#card` réduit avatar + 3 nombres, sans pilule `•••`, encoche `#mgrab` visible).
