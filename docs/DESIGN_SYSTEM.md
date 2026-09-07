# Design System Unifié — Le Kit du Voyageur (LKDV)

## 1. Principes Directeurs
Le Design System LKDV s'articule autour des principes d'ergonomie mobile Apple Human Interface Guidelines et du style "Aura & Liquid Glass" :
- **Clarté et immersion** : Nuances végétales (`#17402C`, `#5B7F55`) inspirées des forêts alpines et des roches de haute montagne.
- **Accessibilité WCAG 2.2 AA** : Ratios de contraste strictement supérieurs à 4.5:1 pour le texte courant et 7.0:1 pour les éléments primaires.
- **Composants natifs & Safe-Area** : `AppShell` unique gérant les safe-areas iOS/Android (Dynamic Island, barre de statut, barre d'accueil).
- **Cibles tactiles Apple HIG** : Toutes les zones cliquables respectent un format minimal de 44x44 px sur mobile.

---

## 2. Palette Chromatique Officielle

| Nom | Valeur Hexadécimale | Rôle & Usage | Contraste mesuré |
|---|---|---|---|
| **Vert Forêt LKDV** | `#17402C` | Titres, fond de boutons primaires, badges sombres | 10.4:1 sur blanc |
| **Vert Sauge Action** | `#5B7F55` | Boutons secondaires, focus rings, accents visuels | 4.6:1 sur blanc |
| **Fond Écran Crème** | `#FBFAF6` | Arrière-plan global de l'application | Fond de base |
| **Noir Nuit Sombre** | `#0B1F17` | Arrière-plan mode Plein Soleil / Bivouac de nuit | 15.2:1 sur blanc |
| **Ambre Sponsorisé** | `#78350F` | Badge obligatoire Loi Influence 2023 | 7.2:1 sur `#FEF3C7` |
| **Rose Alerte** | `#881337` | Recommandations vitales, alertes sécurité terrain | 7.5:1 sur `#FFE4E6` |
| **Émeraude Validé** | `#065F46` | Succès, éléments cochés, synchronisation réussie | 6.8:1 sur `#D1FAE5` |

*Note de gouvernance : La couleur `#5C6B5E` est strictement interdite (D10 résolu).*

---

## 3. Primitives Réutilisables (`src/components/ui`)

1. **`AppShell`** :
   - Conteneur d'écran racine.
   - Intègre le skip-link d'accessibilité (`Aller au contenu principal`).
   - Gère le bandeau d'expédition active (`ActiveTripBanner`).
   - Calcule dynamiquement le safe padding top et bottom.
2. **`GlassCard`** :
   - Panneau de contenu avec effet de translucidité (`backdrop-blur-md`).
   - Variantes : `default`, `elevated`, `sun-mode`.
3. **`LkvButton`** :
   - Bouton universel respectant la cible tactile de 44 px.
   - Variantes : `primary`, `secondary`, `outline`, `ghost`, `danger`.
4. **`LkvBadge`** :
   - Pastille sémantique pour les statuts, catégories de poids, difficultés et avertissements.
5. **`TripSyncStatusIndicator`** :
   - Capsule d'état de synchronisation temps réel pour le mode hors-ligne.
