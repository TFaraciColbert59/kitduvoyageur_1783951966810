# Plan d'Implémentation & Audit Complet — Harmonisation 100% des Sidebars Gauches

> **Règle absolue :** La sidebar gauche de `/materiel` (`DepartLeftSidebar.tsx`) est le modèle visuel de référence absolu pour TOUTES les sidebars gauches et menus verticaux du site (hors Explorer).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harmoniser à 100% toutes les sidebars gauches et éléments de navigation verticale du site avec la sidebar de `/materiel` (`DepartLeftSidebar.tsx`) : **suppression totale des icônes et des informations numérotées (counts/badges)** dans la navigation, et application stricte des boutons capsules vert Forest (`bg-[#17402C] text-white border-[#17402C]`) avec chevron droit sur l'élément actif, et verre dépoli crème (`bg-white/80 text-[#17402C]`) sur les éléments inactifs.

**Architecture:** Les 6 composants identifiés gérant la navigation gauche (`CompteLeftSidebar.tsx`, `CommunityLeftSidebar.tsx`, `PaysLeftSidebar.tsx`, `CommunityHubNav.tsx`, `CarnetVerticalTabs.tsx`, `ClubVerticalTabs.tsx`, `CarnetDetailVerticalTabs.tsx`) adopteront scrupuleusement la structure et les classes de `DepartLeftSidebar.tsx`.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS, TypeScript, ChevronRightIcon.

---

## 1. AUDIT DÉTAILLÉ DE TOUTES LES SIDEBARS GAUCHES

### Modèle Canonique de Référence : `DepartLeftSidebar.tsx`
* **Conteneur** : `aside.h-full.max-h-full.w-full.flex-1.flex.flex-col.justify-between.glass.rounded-[1.5rem].p-3.5.text-[#17402C].font-sans.overflow-hidden.border.border-white/40.shadow-sm.select-none`
* **En-tête Carte Haut** : `p-3 rounded-2xl glass-sub-card space-y-2 relative overflow-hidden border border-white/50`
* **Actions Rapides** : `grid grid-cols-2 gap-1.5` avec `glass-capsule-btn`
* **Titre de Section** : `<p className="text-[9.5px] font-mono font-bold uppercase tracking-widest text-[#5A7064] px-2 mb-1">Navigation</p>`
* **Style des Boutons de Nav** :
  * **SANS icône à gauche**
  * **SANS badges ni informations numérotées**
  * **Actif** : `w-full px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-between group cursor-pointer border bg-[#17402C] text-white border-[#17402C] shadow-sm` + `<ChevronRightAnimated size={13} className="text-white/70 shrink-0" />`
  * **Inactif** : `w-full px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-between group cursor-pointer border bg-white/80 hover:bg-white text-[#17402C] border-white/80 shadow-2xs`
* **Footer Bas** : `shrink-0 pt-2 border-t border-[#17402C]/5 space-y-1.5` avec texte `text-[8.5px] font-mono text-[#5A7064] tracking-wider uppercase`.

---

## 2. COMPOSANTS ET FICHIERS À HARMONISER (LISTE COMPLÈTE)

1. **`CompteLeftSidebar.tsx`** (`src/components/compte/CompteLeftSidebar.tsx`)
   * *Incohérences à supprimer* : Icônes d'onglets (`HomeIcon`, `UserGroupIcon`, etc.) et badges/compteurs de points (`count`, `badge`).
   * *Ajustement* : Supprimer les icônes et les badges numérotés ; appliquer le bouton canonique `{t.label}` + chevron actif.

2. **`CommunityLeftSidebar.tsx`** (`src/components/communaute/CommunityLeftSidebar.tsx`)
   * *Incohérences à supprimer* : Icônes d'onglets (`ChatBubbleLeftRightIcon`, etc.) et badges numérotés (`badgeCounts`).
   * *Ajustement* : Supprimer les icônes et les badges numérotés ; appliquer le bouton canonique `{t.label}` + chevron actif.

3. **`PaysLeftSidebar.tsx`** (`src/components/pays/PaysLeftSidebar.tsx`)
   * *Incohérences à supprimer* : Badges numérotés des destinations/activités (`count`).
   * *Ajustement* : Supprimer les badges numérotés ; appliquer le bouton canonique `{s.label}` + chevron actif.

4. **`CommunityHubNav.tsx`** (`src/components/social/CommunityHubNav.tsx`)
   * *Incohérences à supprimer* : Mode vertical utilisant un style dégradé différent (`bg-gradient-to-r...`) et des badges numérotés.
   * *Ajustement* : Aligner le mode vertical sur les classes de boutons de `DepartLeftSidebar.tsx` sans badges numérotés.

5. **`CarnetVerticalTabs.tsx`** (`src/components/carnets/CarnetVerticalTabs.tsx`)
   * *Incohérences à supprimer* : Icônes (`GlobeAltIcon`, `UserIcon`, etc.) et compteurs numérotés (`totalCount`, `myCarnetsCount`, etc.).
   * *Ajustement* : Supprimer les icônes et les badges numérotés ; appliquer le bouton canonique `{tab.label}` + chevron actif.

6. **`ClubVerticalTabs.tsx`** (`src/components/clubs/ClubVerticalTabs.tsx`)
   * *Incohérences à supprimer* : Icônes (`HomeIcon`, `CalendarDaysIcon`, etc.) et compteurs numérotés (`eventsCount`, `membersCount`, etc.).
   * *Ajustement* : Supprimer les icônes et les badges numérotés ; appliquer le bouton canonique `{tab.label}` + chevron actif.

7. **`CarnetDetailVerticalTabs.tsx`** (`src/components/carnet/CarnetDetailVerticalTabs.tsx`)
   * *Incohérences à supprimer* : Icônes (`HomeIcon`, `MapIcon`, etc.) et compteurs numérotés (`momentsCount`, `itemsCount`).
   * *Ajustement* : Supprimer les icônes et les badges numérotés ; appliquer le bouton canonique `{tab.label}` + chevron actif.

---

## 3. DÉCOUPAGE PAS-À-PAS DES TÂCHES

### Task 1 : Nettoyage et Harmonisation de `CompteLeftSidebar.tsx`
- **Fichier :** `src/components/compte/CompteLeftSidebar.tsx`
- [ ] Supprimer la colonne d'icônes et les badges/counts numérotés dans le mapping des onglets navigation.
- [ ] Conserver uniquement `{t.label}` à gauche et `{isActive && <ChevronRightAnimated size={13} className="text-white/70 shrink-0" />}` à droite.
- [ ] Conserver toutes les données du profil, l'avatar, le niveau voyageur, et les callbacks métier (`onEditProfile`, `onShareProfile`).

### Task 2 : Nettoyage et Harmonisation de `CommunityLeftSidebar.tsx`
- **Fichier :** `src/components/communaute/CommunityLeftSidebar.tsx`
- [ ] Supprimer les icônes et les badges numérotés (`count`) dans le mapping des espaces.
- [ ] Conserver uniquement `{t.label}` à gauche et `{isActive && <ChevronRightAnimated size={13} className="text-white/70 shrink-0" />}` à droite.
- [ ] Conserver l'en-tête de communauté, le studio de création rapide 2 colonnes (`Publier`, `Expédition`), les raccourcis massifs phares, et le lien de retour vers `/explorer`.

### Task 3 : Nettoyage et Harmonisation de `PaysLeftSidebar.tsx`
- **Fichier :** `src/components/pays/PaysLeftSidebar.tsx`
- [ ] Supprimer les badges numérotés de comptage (`count`) dans les sections de la fiche pays.
- [ ] Conserver uniquement `{s.label}` à gauche et `{isActive && <ChevronRightAnimated size={13} className="text-white/70 shrink-0" />}` à droite.
- [ ] Conserver le drapeau pays, le code ISO, la grille d'actions 2 colonnes, et le lien de retour.

### Task 4 : Harmonisation de `CommunityHubNav.tsx` (Mode Vertical)
- **Fichier :** `src/components/social/CommunityHubNav.tsx`
- [ ] En mode `layoutVariant === 'vertical'`, remplacer le style dégradé et les badges numérotés par les boutons canoniques de `DepartLeftSidebar.tsx` (sans icône, sans chiffres, avec chevron actif).

### Task 5 : Harmonisation des Onglets Verticaux (`CarnetVerticalTabs.tsx`, `ClubVerticalTabs.tsx`, `CarnetDetailVerticalTabs.tsx`)
- **Fichiers :**
  - `src/components/carnets/CarnetVerticalTabs.tsx`
  - `src/components/clubs/ClubVerticalTabs.tsx`
  - `src/components/carnet/CarnetDetailVerticalTabs.tsx`
- [ ] Supprimer les icônes et les compteurs numérotés dans les trois composants.
- [ ] Appliquer les boutons canoniques de `DepartLeftSidebar.tsx` avec chevron droit actif.

### Task 6 : Validation Globale TypeScript, ESLint & Build
- [ ] Exécuter `npm run type-check` (0 erreur requise).
- [ ] Exécuter `npm run lint` (0 erreur requise).
- [ ] Exécuter `npm run build` (0 erreur requise).

---

## ⛔ POINT DE CONTRÔLE (Lancement de la phase d'implémentation)
Une fois ce plan validé, nous procéderons pas-à-pas à l'implémentation et à la validation des tests.
