# Chantier Mobile — Refonte Communauté + Groupes + Carnets + Clubs
**Date & Heure :** 17 août 2026  
**Objectif :** Unifier, fluidifier et moderniser l'expérience mobile des 4 univers communautaires (Communauté, Groupes, Carnets, Clubs) avec un standard UX unique de type réseau social moderne (façon Instagram/Aura).

---

## 📊 Suivi d'Avancement

- [x] **Audit Communauté**
- [x] **Audit Groupes**
- [x] **Audit Carnets**
- [x] **Audit Clubs**
- [x] **Audit navigation mobile & interactions**
- [x] **Composants d'Interaction Sociale Unifiés (`SocialActions`, `PostHeader`, `MoreMenuSheet`, `CommentsSheet`, `ReportSheet`, `CommunityHubNav`)**
- [x] **Refonte Hub Mobile Communauté (`src/components/communaute/MobileCommunityHub.tsx`)**
- [x] **Refonte Mobile Groupes (`src/components/groupes/MobileGroupesHub.tsx`)**
- [x] **Refonte Mobile Carnets (`src/components/carnets/MobileCarnetsHub.tsx`)**
- [x] **Refonte Mobile Clubs (`src/components/clubs/MobileClubsHub.tsx`)**
- [x] **Intégration et branchement instantané (Tabs, Skeletons, Cache/Prefetch)**
- [x] **Validation TypeScript (tsc pass sans erreur)**

---

## 🔍 Synthèse des Diagnostics de l'Audit

1. **Pages monolithiques géantes :**
   - `src/app/communaute/page.tsx` : ~1900 lignes.
   - `src/app/carnets/page.tsx` : ~1300 lignes.
   - `src/app/clubs/page.tsx` : ~1450 lignes.
   - `src/app/groupes/page.tsx` : ~780 lignes.
2. **Duplication des modales et conflits de calques :**
   - Modales desktop montées dans le flux mobile créant des overlays bloquants ou des désynchronisations d'état.
3. **Absence de standard social unique :**
   - Chaque écran recréait ses propres boutons de like, commentaire, partage, favoris et menus sans cohérence d'icônes, de positions, ni d'UI optimiste.
4. **Transition entre univers :**
   - Manque de navigation unifiée avec tabs partagés `[ Fil ] [ Groupes ] [ Clubs ] [ Carnets ]` avec feedback immédiat (< 100ms) et skeletons synchrones.
