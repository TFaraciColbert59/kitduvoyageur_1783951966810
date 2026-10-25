# Pays v3 — duplication de la référence Cloudflare (25/10/2026, 18 h)

## Ce qui a été corrigé (les reproches, un par un)

| Reproche | Correction | Preuve |
|---|---|---|
| **La carte ne s'affiche pas** | tuiles Web Mercator réelles (Esri/OSM via `leafletTiles`) assemblées en absolu, pin capitale, sélecteur d'échelle 3 positions, colonne zoom, attribution en pastille au-dessus de la barre. Leaflet a été écarté : il fige la taille de son conteneur dans une colonne centrée (tuiles décalées de 167 px constatées). | `v3-deploy-apercu.png`, `v3-deploy-destinations.png` |
| **Fond des drawers / carte faux** | carte = matière §1.3 (`linear-gradient .486→.384` + `blur 25.2 sat 1.8`) ; feuille = §1.5 (`rgba(245,242,236,.34→.2→.26)` + `blur 30`) — aucune surcharge d'écran | `v3-deploy-drawer.png` |
| **Pas le bon effet de fond** | photo du pays en `<img class="bg-img">` (`object-fit: cover`) + voile `.bg::after` mesuré | idem |
| **Drawers / sous-drawers** | support **12/48/406 × 708,3** (mesuré), poignée, **nav 5 lentilles** 378 × 48, groupes internes r18, lignes à icône 30 r10, boutons `primary` / `ghost` (§4.8) | idem |
| **Sélecteur** | 88 × 30, lentille 41,5 × 25, deux positions (Grille / Cartes) | porte 19/19 |
| **Boutons, infos, disposition** | boutons de feuille pill 32 px, pastilles, groupes titrés, valeurs alignées à droite | captures |
| **Grille moche** | cartes média : photo + **badges posés** (sombre à gauche, clair à droite) + **légende qui chevauche** (titre 13,5/700, sous-titre 11, date, méta `·`) ; vue Grille = tuiles 134 avec badge `t-type` 20 r7, **gap 2** | `v3-deploy-destinations.png` |

## Preuves

| Contrôle | Résultat |
|---|---|
| `design:fidelity` build prod local (430 / 768 / 1440) | **19/19 · 19/19 · 19/19** pour `/pays/fr` **et** `/carnets/[id]` |
| URL déployée **https://kitduvoyageur-1783951966810-l99rrbrt7.vercel.app** | **19/19 · 19/19 · 19/19** |
| Tests pays + discovery + geo | **192 / 192** |
| Erreurs console | 0 |

## Ce qui reste

- Barre basse : les libellés sont ceux de la référence (Hub · Explorer · Communauté · Messages · Compte) mais la barre est globale — les autres écrans seront alignés dans leur lot.
- Badge de compteur sur Hub : supporté (`badges`), pas encore branché faute de compteur réel exposé.
- Carnet : le drawer carnet utilise encore `.li` ; à passer sur les mêmes groupes/lignes.
- Hub `/carnets` : encore legacy.
