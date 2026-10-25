# Rectificatif — Description de la PR #31 (Chantier X & Y)

> Ce document constitue le rectificatif officiel à publier en commentaire de la **Pull Request #31** fusionnée sur `main`.

---

## 📌 Rectification des livrables de sidebars

Dans la description préliminaire de la PR #31, les fichiers suivants étaient mentionnés par inadvertance comme livrables :
- `KitSidebarLeft.tsx`
- `KitSidebarRight.tsx`
- `ItinerarySidebarLeft.tsx`
- `ItinerarySidebarRight.tsx`

### Constat et Architecture réelle :
Ces quatre composants historiques étaient des implémentations ad-hoc et cloisonnées développées lors des chantiers préliminaires.
Dans le cadre de l'unification du **Hub Voyage Unique (Chantier Y)**, ces 4 fichiers ont été **définitivement supprimés** (gain net : 10 856 octets) et unifiés au profit de deux sidebars canoniques uniques :

1. **`TripSidebarLeft.tsx`** :
   - Colonne de navigation unique (260 px).
   - Pilotée par le registre `tripSectionRegistry` (10 sections canoniques).
   - Intègre les permissions d'accès, le fil d'Ariane, les compteurs de badge, et le déclenchement de `TripSectionPicker.tsx` (Y2.4).
   - Respecte strictement la Règle Y-D80 n°10 (zéro `<aside>` hors de ce composant et du layout).

2. **`TripSidebarRight.tsx`** :
   - Colonne de contexte unique (300 px).
   - Hôte générique des 12 widgets du registre `tripWidgetRegistry`, ordonnés par priorité dynamique selon le profil dérivé du voyage (échelle, groupe, activité).

3. **Livrable UX complémentaire Y2.4 :**
   - **`TripSectionPicker.tsx`** : Garantit la promesse UX *« Aucune section n'est jamais verrouillée »*, permettant à l'utilisateur d'activer ou réactiver n'importe quelle section masquée par la matrice de profil par défaut, avec persistance dans `Trip.metadata.enabled_sections`.
