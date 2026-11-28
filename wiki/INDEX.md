# WIKI LKDV — Radar Panoramique IA (Scan Rapide < 1 000 tokens)
<!-- Budget strict : < 95 lignes | BillyBoy scanne ce fichier AVANT de concevoir ou modifier toute feature -->

> **But de ce Wiki** : Empêcher le travail en silos. Avant d'écrire une ligne de code sur une page A, tu dois savoir en 2 secondes **tout ce qui existe ailleurs dans LKDV** et comment l'intégrer **sur place** (sans casser le flux utilisateur).

---

## 1. Réflexe d'Autonomie Systémique (6 Questions Obligatoires Avant de Concevoir)
1. **Drawer sur place > Redirection** : Peut-on monter le drawer existant (`CreateSheetV2`, `PostSharePanel`, `StoriesViewer`, `FreedomCommentsDrawer`, `ClubDrawerHost`) **directement sur la page courante** en `dynamic(..., { ssr: false })` au lieu d'envoyer l'utilisateur sur une autre route ?
2. **Interconnexions complètes** : Quels modules LKDV doivent réagir ou être proposés à partir de cet événement ?
   `Post` · `Story` · `Carnet` · `Club` · `Discussion (Messagerie)` · `Sortie` · `Kit / Usure Matériel` · `Pokédex Nature` · `Progression XP` · `Itinéraire` · `Bouteille à la mer`
3. **Zéro double saisie** : Quel pont de données (`outingHandoff.ts`, `CreateSheetContext`, `usePostShareTargets`) pré-remplit automatiquement le formulaire ou le partage ?
4. **Blocs canoniques** : Est-ce que j'utilise bien `IdentityPill`/`PostAuthorPill`, `CommunityStoriesBar`/`StoriesViewer`, `CommunityFeedPost`, `ProductGlassCard`, `SlotShell` (`CapsuleTabs` haut + lentilles/filtre bas-droite) ?
5. **Moteurs existants** : Le calcul existe-t-il déjà dans `wiki/DATA_FLOWS_AND_ENGINES.md` (télémétrie, DEM, WASM, météo, EXIF, haptique, gestes) ?
6. **Terrain & Anti-Dette** : Offline montagne OK ? Mobile `390×844` + hiérarchie swipes OK ? Si je crée une v2, je supprime la v1 dans le même commit ?

---

## 2. Matrice Rapide : « Où trouver quoi & quoi monter sur place ? »

| Besoin | Composant / Pont existant | Montable sur place ? | Détail Wiki |
| :--- | :--- | :---: | :--- |
| **Créer Post / Story / Carnet / Sortie / Kit / Club** | `CommunitySheetShell` + `CreateSheetContext` + `*FormV2` (modèle : `CarnetCommunityCreateBridge`) | **OUI** (lazy `dynamic`) | `EMBEDDABLE_DRAWERS.md` |
| **Partager dans Discussion / Club / Lien** | `PostSharePanel` (`usePostShareTargets`) / `FreedomShareDrawer` | **OUI** (portal) | `EMBEDDABLE_DRAWERS.md` |
| **Ouvrir Commentaires d'un post** | `FreedomCommentsDrawer` | **OUI** (portal) | `EMBEDDABLE_DRAWERS.md` |
| **Lire / Créer une Story** | `CommunityStoriesBar` + `StoriesViewer` + `StoryStage` | **OUI** (lazy `dynamic`) | `EMBEDDABLE_DRAWERS.md` |
| **Pré-remplir depuis une sortie GPS** | `src/features/explorer-v2/outingHandoff.ts` | **OUI** (payload pur) | `CAPABILITY_GRAPH.md` |
| **Afficher une personne** | `IdentityPill` / `PostAuthorPill` / `AccountAuthorPill` | **OUI** | `docs/06-design-system/CANONICAL_BLOCKS.md` |
| **Analyser une sortie (20+ moteurs)** | `summaryAnalysisEngine.ts` + `SummaryExpertAnalysisSubDrawer` | **OUI** (`.xp20-exp-scope`) | `DATA_FLOWS_AND_ENGINES.md` |
| **Drawer standard (haut + bas-droite)** | `SlotShell` (`CapsuleTabs 56px` + `lkdv-lens-tabs` + `bottomRightFilter`) | **OUI** | `docs/06-design-system/DRAWERS_AND_NAVIGATION.md` |

---

## 3. Les 4 Fiches Détaillées (Charger Uniquement Celle Utile)
- **[CAPABILITY_GRAPH.md](CAPABILITY_GRAPH.md)** — Graphe d'interconnexion complet par événement métier (Fin de sortie, Création, Découverte Nature, Événement Club, Matériel, Partage).
- **[EMBEDDABLE_DRAWERS.md](EMBEDDABLE_DRAWERS.md)** — Signatures exactes & recettes d'intégration des drawers montables **sur n'importe quelle page** sans redirection.
- **[DATA_FLOWS_AND_ENGINES.md](DATA_FLOWS_AND_ENGINES.md)** — Inventaire de tous les moteurs, hooks et utilitaires déjà codés (ne jamais réinventer).
- **[SURFACE_MAP.md](SURFACE_MAP.md)** — Carte 1-ligne de chaque domaine/page et de ce qu'elle expose au reste de l'app.
