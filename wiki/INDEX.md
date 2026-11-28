# WIKI LKDV — Radar Panoramique IA (Scan Rapide < 1 000 tokens)
<!-- Budget strict : < 95 lignes | BillyBoy scanne ce fichier AVANT de concevoir ou modifier toute feature -->

> **But de ce Wiki** : Empêcher le travail en silos. Avant d'écrire une ligne de code sur une page A, tu dois savoir en 2 secondes **tout ce qui existe ailleurs dans LKDV** et comment l'intégrer **sur place** (sans casser le flux utilisateur).

---

## 1. Réflexion Produit & Discernement (Valable pour TOUTE l'App — Jamais Automatique)
Avant de concevoir ou modifier quoi que ce soit (UX, carte, social, matériel, boutique, mobile, perf, data), passe par ce filtre de jugement — **ne rien ajouter machinalement, uniquement si c'est nécessaire, pratique ou utile à cet instant précis** :
1. **Utilité réelle > Remplissage** : Est-ce que ce pont ou cette option aide *vraiment* l'utilisateur ici, ou est-ce que ça rajoute du bruit ? Si c'est superflu, ne le mets pas.
2. **Sur place vs Redirection** : Si l'action reste dans le même flux mental, monter le drawer existant **sur place** (`dynamic(..., { ssr: false })`) ; si l'utilisateur change d'univers, une navigation propre est préférable.
3. **Vision globale de l'écosystème** : Quelles autres briques LKDV sont *pertinentes* ici ? (`Post`, `Story`, `Carnet`, `Club`, `Messagerie`, `Sortie`, `Kit/Matériel`, `Boutique`, `Pokédex`, `XP`, `Itinéraire`, `Live Tracking`, `Capteurs/Montres`).
4. **Zéro double saisie & réutilisation** : Existe-t-il déjà un pont (`outingHandoff.ts`, `usePostShareTargets`), un bloc canonique (`CANONICAL_BLOCKS.md`) ou un moteur (`DATA_FLOWS_AND_ENGINES.md`) à réutiliser ?
5. **Terrain & Anti-Dette** : Fluide en offline montagne, mobile `390×844`, hiérarchie des swipes respectée ? Et si une v2 remplace une v1, supprimer la v1 dans le même commit.

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
