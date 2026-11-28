# SURFACE_MAP — Atlas Ultra-Rapide des Surfaces & Domaines LKDV

> 1 ligne par surface active : route, composant clé, ce qu'elle possède et ce qu'elle partage au reste de l'app.

| Domaine / Route | Composant Clé | Possède | Expose / Interconnecte avec |
| :--- | :--- | :--- | :--- |
| **Explorer v2** `/explorer` (`?mode=plan`) | `ExplorerV2`, `MapStage`, `ExplorerGlassDrawer`, `ExplorerSummarySheet` | Carte 3D MapLibre+Three.js, 6 onglets (dont Rando/GR), Traceur 3 detents, Tracker GPS offline, Studio Analyse 6 volets | `outingHandoff.ts` → 6 formulaires Communauté, `ActiveOutingGlobalPill`, Pokédex, XP, Usure matériel |
| **Communauté V2** `/communaute`, `/communaute/reels`, `/communaute/post/[id]` | `CommunityFeed`, `CreateSheetV2`, `CommunityStoriesBar`, `FreedomReelsViewer` | Fil social, Stories, Reels, 6 formulaires de création | Drawers montables sur place (`*FormV2`, `StoriesViewer`, `FreedomCommentsDrawer`, `PostSharePanel`, `PostAuthorPill`) |
| **Carnets** `/carnets/[id]` *(hub `/carnets` → `308` `/communaute`)* | `CarnetScreenV2`, `CarnetDrawerV2`, `CarnetCommunityCreateBridge` | **Vérité Design #1** : vue 2 zones + `CarnetMap` + timeline jours + drawers `SlotShell` | `CarnetTile`, pilules contextuelles Carnet, pont création sur place |
| **Clubs & Sorties** `/clubs/[id]`, `/sorties/[id]` | `ClubLiquidGlassV8`, `ClubDrawerHost`, `ClubInlineFeed`, `ClubMap` | **Vérité Design #2** : carte 3D alpine + fil + sorties + coffre matériel + salons + stats | `ClubCrest`, `EventTicket`, `ClubGearProductCard`, Story Bloom, RSVP |
| **Messagerie** `/messagerie` | Conversations privées & groupes | Discussions temps réel, pièces jointes (`message-attachments`), partage cartes posts/GPX/produits | Cible universelle de `PostSharePanel` (`usePostShareTargets`) |
| **Hub & Kit Studio** `/hub/*`, `/kit-studio` | `KitStudio`, inventaire `user_gear` | Préparation voyage, sacs 3D, poids, usure `WearBar`, checklists | Fiches matériel (`ProductGlassCard`), lien vers sorties & carnets |
| **Boutique** `/panier`, `/checkout` | Tunnel Stripe + fidélité | Panier, commandes `/api/orders`, points fidélité | `ProductGlassCard`, récompenses |
| **Compte & Profil** `/compte/*`, `/profil/[id]`, `/live/[token]` | `CompteMap`, `SlotShell`, capteurs BLE, montres, Live Tracking | Historique activités, seuils physio, connecteurs, suivi temps réel sécurisé | `AccountAuthorPill`, `SlotShell` (modèle de tous les drawers), badges XP |
| **Compas & Admin** `/compas`, `/admin/*` | Cockpit préparation, back-office produits & progression | Aide décision départ, gestion catalogue & économie XP 2.0 | Règles `docs/progression/2.0/rules-registry.json` |
