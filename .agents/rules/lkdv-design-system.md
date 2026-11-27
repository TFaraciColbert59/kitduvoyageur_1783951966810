---
trigger: always_on
description: >-
  Règle obligatoire du Design System LKDV (toute l'application : Profil/Compte,
  Carnet, Clubs, Sorties, Coffre/Matériel, Kits, Pokédex, Stories, Messagerie,
  Carte 3D). Impose la réutilisation stricte des composants canoniques existants
  et interdit toute réinvention visuelle ad hoc.
---

# LKDV Design System — Règle Permanente Obligatoire (Toute l'Application)

> **RÈGLE D'OR ABSOLUE** : Avant de créer ou modifier un écran, un drawer, une carte produit, un kit, une fiche Pokédex, une story, un chat ou un contrôle de carte, **TU DOIS RÉUTILISER le composant canonique LKDV ci-dessous**. Il est **STRICTEMENT INTERDIT** de réinventer une liste en `<div>` inline, une barre d'onglets maison ou des boutons hors Design System.

---

## 1. Palette & Matière Liquid Glass (iOS 27 LKDV)
- **Couleurs officielles** : Vert forêt `#17402C` (primaire), encre sombre `#172B24` / `#0B1F17`, sauge `#96BA8E` / `#A3C4A3`, fond ivoire `#FBFAF6`, label secondaire `#56665D`. **JAMAIS** d'orange criard `#E4501C`.
- **Boutons & Pilules** :
  - Tous les boutons d'action sont des **pilules** (`border-radius: 999px`) ou des boutons circulaires Liquid Glass (`className="lg gbtn"` ou `className="lkdv-carnet-btn-soft"`).
  - **Bouton fermer / retour dans une fiche** : pilule circulaire **sans libellé** contenant uniquement une icône croix (`<X size={15} />`), jamais un bouton texte `← Retour ...`.
  - **Zéro formulaire inline** dans un drawer de lecture : ouvrir une feuille/modale portalisée (`createPortal(..., document.body)` ou `.phone`) avec fond verre.

---

## 2. Anatomie Canonique des Drawers & Sous-Drawers (Toute l'App)
Tout drawer principal (`Compte`, `Carnet`, `Club`, `Fiche Membre`, `Fiche Sortie`) respecte cette disposition **sans exception** :

1. **Haut du drawer** :
   - Poignée `.lkdv-mgrab` centrée en haut.
   - Barre d'onglets principale `CapsuleTabs` (`src/components/ui/CapsuleTabs.tsx`) dans `SlotShell.selector` (`src/components/compte/drawer/SlotShell.tsx`).
   - En-tête sticky opaque flouté (`rgba(249, 248, 244, 0.94)` + `backdrop-filter: blur(20px)`) pour éviter que le contenu scrollé ne transparaîsse derrière.
2. **Bas à droite — Sous-drawers & Filtres** :
   - **Tous les sous-drawers / volets internes** se placent **exclusivement en bas à droite** via `SlotShell` (`lenses` → `.lkdv-lens-tabs` + swipe horizontal `LensPager`). **Interdit** de créer une barre horizontale de sous-onglets en haut du contenu.
   - **Tous les filtres & tris** se placent **exclusivement en bas à droite** via `SortMenuButton` (`src/components/ui/drawer/SortMenuButton.tsx`) passé à `SlotShell.bottomRightFilter`. Toujours fournir `options={[]}`, `value`, `defaultValue`, `onChange` et `label` sur chaque groupe quand `groups` est utilisé. **Interdit** de mettre des rails de filtres inline dans le corps du drawer.
3. **Bas à gauche — Action Primaire Flottante (`.club-drawer-floating-left`)** :
   - Réservé à l'action primaire contextuelle en pilule (ex. `Je participe` / `Inscrit ✓` sur une Fiche Sortie, `Reprendre ce kit` / `Reprendre le tracé` sur Carnet).
   - **SUPPRIMÉ PARTOUT** : ne jamais afficher de pilule `Reprendre la lecture`.

---

## 3. Catalogue des Composants Canoniques à Réutiliser (Par Entité)

| Entité métier | Composant(s) Canonique(s) Obligatoire(s) | Règle d'affichage stricte |
|---|---|---|
| **Produit / Équipement (Sac, Coffre, Sortie)** | `ClubGearProductCard` (`src/components/clubs/drawer/ClubGearProductCard.tsx`) + `KitProductSheetV2` (`src/features/community/v2/create/kit/KitProductSheetV2.tsx`) | **Toujours** en **grille 2 colonnes** (`repeat(2, minmax(0, 1fr))`, `gap: 10`) avec `club-glass-card`, photo `aspectRatio: 1 / 0.85` (`borderRadius: 12`), badge stock/statut en haut à gauche (`club-badge-sage` / `club-badge-soft`), nom (2 lignes max), poids + état, badges `EPI` / caution. Clic → ouvre `KitProductSheetV2` en portail. **Interdit** d'afficher des équipements en simples lignes texte sans photo. |
| **Kit de matériel (Club, Profil, Carnet, Sortie)** | `KitCard` + `KIT_CARD_CSS` (`src/components/compte/drawer/cards/KitCard.tsx`) + `mapClubStandardKitToKitEntry` (`src/components/clubs/drawer/clubKitAdapter.ts`) | **Toujours** utiliser `<KitCard />` (avec clic produit ouvrant `KitProductSheetV2` et bouton circulaire de clonage en haut à droite). |
| **Pokédex (Carnet, Club, Membre, Sortie)** | `ClubPokedexDrawerBody` (`src/components/clubs/drawer/ClubPokedexDrawerBody.tsx`) / `CarnetPokedexDrawerBody` (`src/components/carnet/v2/CarnetPokedexDrawerBody.tsx`) | Grille de cartes holographiques 3D (`ClubPokedexHoloCard`). **Pas** de bandeau stats/`+ Observer` en haut. Filtres Règne/Sortie uniquement en bas à droite (`SortMenuButton`). CTA « J'ai observé cette espèce » en pilule Liquid Glass (`lkdv-carnet-btn-soft`). |
| **Stories & À la une** | `.ig-hl-row` / `StoryArchiveDrawer` (`src/components/stories/StoryArchiveDrawer.tsx`) / `ClubHighlightManageDrawer` (`src/components/clubs/feed/ClubHighlightManageDrawer.tsx`) / `StoriesViewer` (`src/components/communaute/StoriesViewer.tsx`) | Toujours garder visibles les bulles À la une (appui long pour éditer si habilité). Sur les tracés 3D, regrouper les stories en épingles compactes. |
| **Chat / Messagerie & Salons Club** | `MessagesScreen` (`src/components/messaging/MessagesScreen.tsx`), `ClubSalonsDrawerBody` (`src/components/clubs/drawer/ClubSalonsDrawerBody.tsx`), `messages-grammar.css` | Compositeur unique : `textarea.mfield` (`"Votre message…"`) + micro (`VoiceRecorderBar`) + bouton `…` (`ComposerMenuSheet` en portail) + envoi `msend` + hamburger `≡` tout en bas à droite pour changer de salon. Rendu riche des PJ (`TraceMap`, `AudioPlayerBubble`, `AttachmentDrawer`). |
| **Fiche Sortie** | `ClubOutingDetailSheet` + `OutingOverviewLens` + `OutingTransportLens` + `OutingGearLens` + `OutingMemoriesLens` (`src/components/clubs/drawer/outing/`) | Titre pur (sans km/D+ dupliqués), fermeture pilule `×` sans libellé, 5 sous-drawers en bas à droite (`SlotShell`), CTA `Je participe` en bas à gauche, profil altimétrique Recharts sur vrai `routeTrace` 3D, Aller & Retour multi-modal. **Ne jamais modifier `SortieFormV2.tsx`** sans demande explicite. |
| **Carte 3D & Mode Agrandi (`.mapbig`)** | `ClubMap` (`src/components/clubs/map/ClubMap.tsx`), `createClub3DStyle.ts`, `ClubOutingScrubberHud.tsx`, `club-adaptation.css`, `club-map.css` | En `.mapbig`, `#card` reste visible et réduit (avatar + 3 chiffres uniquement, **pas** de pilule `•••`), encoche centrale `#mgrab` visible en haut au milieu de la carte du bas. Routes/overlays discrets avec légende uniquement dans le popover d'affichage. Piliers 3D natifs `fill-extrusion`, ombres solaires fort contraste (`#0a1e4a` / `#fff1b8`). |

---

## 4. Checklist Obligatoire Avant Toute Modification UI
1. Vérifier dans le tableau ci-dessus si un composant canonique existe déjà pour l'entité affichée.
2. Si oui : **l'importer et le réutiliser directement** (jamais réécrire un markup alternatif).
3. Vérifier l'emplacement des contrôles : **sous-drawers en bas à droite**, **filtres en bas à droite**, **CTA principal flottant en bas à gauche**, **fermeture en pilule `×` sans texte**.
4. Vérifier que les données viennent de Supabase / APIs réelles (zéro mock).
