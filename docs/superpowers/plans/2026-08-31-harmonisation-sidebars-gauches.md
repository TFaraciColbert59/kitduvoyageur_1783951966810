# Plan d'Implémentation — Harmonisation des Sidebars Gauches

> **Règle absolue :** La sidebar gauche de `/materiel` (`DepartLeftSidebar.tsx`) est le modèle visuel de référence absolu pour toutes les sidebars gauches du site (à l'exception d'Explorer).

**Goal:** Harmoniser le design de toutes les sidebars gauches de l'application (`CompteLeftSidebar.tsx`, `CommunityLeftSidebar.tsx`, `PaysLeftSidebar.tsx`) pour reproduire à l'identique la structure visuelle, la typographie, les espacements, les rayons, les bordures, le flou Liquid Glass et les indicateurs d'état de la sidebar de `/materiel` (`DepartLeftSidebar.tsx`).

**Architecture:** Les composantes visuelles (conteneur `glass`, en-tête carte, grille de boutons d'action rapide `grid-cols-2 gap-1.5`, zone centrale scrollable `flex-1 min-h-0 overflow-y-auto no-scrollbar`, items de navigation avec `bg-[#17402C] text-white border-[#17402C]` pour l'état actif + chevron droit et `bg-white/80 hover:bg-white text-[#17402C]` pour l'état inactif, et zone basse fixe avec footer `text-[8.5px] font-mono text-[#5A7064] tracking-wider uppercase`) seront reproduites à l'identique tout en conservant scrupuleusement la logique métier, les liens, les badges et les données de chaque page.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS, Framer Motion, TypeScript, Lucide Icons / LkvIcon.

---

## Modèle Visuel Canonique de Référence (`DepartLeftSidebar.tsx`)

```tsx
<aside className="h-full max-h-full w-full flex-1 flex flex-col justify-between glass rounded-[1.5rem] p-3.5 text-[#17402C] font-sans overflow-hidden border border-white/40 shadow-sm select-none">
  {/* 1. ZONE HAUTE FIXE (Mini Card Identité & Actions Rapides) */}
  <div className="shrink-0 space-y-2.5">
    <div className="p-3 rounded-2xl glass-sub-card space-y-2 relative overflow-hidden border border-white/50">
      ...
    </div>
    <div className="grid grid-cols-2 gap-1.5">
      ...
    </div>
  </div>

  {/* 2. ZONE CENTRALE SCROLLABLE À L'INTÉRIEUR (Navigation) */}
  <nav className="flex-1 min-h-0 overflow-y-auto no-scrollbar py-2 space-y-1.5">
    <p className="text-[9.5px] font-mono font-bold uppercase tracking-widest text-[#5A7064] px-2 mb-1">
      {SECTION_LABEL}
    </p>
    {items.map((item) => {
      const isActive = ...;
      return (
        <button
          key={item.id}
          type="button"
          onClick={...}
          className={`w-full px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-between group cursor-pointer border ${
            isActive
              ? 'bg-[#17402C] text-white border-[#17402C] shadow-sm'
              : 'bg-white/80 hover:bg-white text-[#17402C] border-white/80 shadow-2xs'
          }`}
        >
          <span className="truncate text-left">{item.label}</span>
          {isActive && <ChevronRightAnimated size={13} className="text-white/70 shrink-0" />}
        </button>
      );
    })}
  </nav>

  {/* 3. ZONE BASSE FIXE (Action Basse & Footer) */}
  <div className="shrink-0 pt-2 border-t border-[#17402C]/5 space-y-1.5">
    <button (ou Link)
      className="w-full glass-sub-card text-xs font-semibold text-[#365233] p-2 rounded-xl flex items-center justify-center gap-1.5 hover:bg-white/80 transition-colors cursor-pointer border border-white/40"
    >
      ...
    </button>
    <div className="text-center">
      <span className="text-[8.5px] font-mono text-[#5A7064] tracking-wider uppercase">
        Le Kit du Voyageur · [NOM MODULE]
      </span>
    </div>
  </div>
</aside>
```

---

## Tâches d'Implémentation Détaillées

### Tâche 1 : Harmonisation de `CompteLeftSidebar.tsx`
**Fichier à modifier :** `src/components/compte/CompteLeftSidebar.tsx`
- **Rendu visuel à appliquer :**
  - Conteneur `aside` : `p-3.5`, `rounded-[1.5rem]`, `border-white/40`, `shadow-sm`, `select-none`.
  - Top Card : `p-3`, `rounded-2xl`, `glass-sub-card`, `border-white/50`.
  - Grille d'actions : `grid grid-cols-2 gap-1.5`.
  - Section titre de nav : `text-[9.5px] font-mono font-bold uppercase tracking-widest text-[#5A7064] px-2 mb-1`.
  - Items de navigation : `w-full px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-between group cursor-pointer border`.
    - Actif : `bg-[#17402C] text-white border-[#17402C] shadow-sm` + `<ChevronRightIcon size={13} className="text-white/70 shrink-0" />`.
    - Inactif : `bg-white/80 hover:bg-white text-[#17402C] border-white/80 shadow-2xs`.
  - Zone basse : `shrink-0 pt-2 border-t border-[#17402C]/5 space-y-1.5` avec bouton `Partager mon profil` et footer text `text-[8.5px] font-mono text-[#5A7064] tracking-wider uppercase` (`Le Kit du Voyageur · Compte Voyageur`).
- **Logique métier préservée :** Informations du profil, avatar, niveau voyageur, callbacks `onEditProfile`, `onShareProfile`, et onglets `CompteTab`.

### Tâche 2 : Harmonisation de `CommunityLeftSidebar.tsx`
**Fichier à modifier :** `src/components/communaute/CommunityLeftSidebar.tsx`
- **Rendu visuel à appliquer :**
  - Conteneur `aside` : `p-3.5`, `rounded-[1.5rem]`, `border-white/40`, `shadow-sm`, `select-none`.
  - Top Card : `p-3`, `rounded-2xl`, `glass-sub-card`, `border-white/50`.
  - Grille d'actions : `grid grid-cols-2 gap-1.5` pour les CTA `Publier` et `Expédition`.
  - Section titre de nav : `text-[9.5px] font-mono font-bold uppercase tracking-widest text-[#5A7064] px-2 mb-1`.
  - Items de navigation : `w-full px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-between group cursor-pointer border`.
    - Actif : `bg-[#17402C] text-white border-[#17402C] shadow-sm` + `<ChevronRightIcon size={13} className="text-white/70 shrink-0" />`.
    - Inactif : `bg-white/80 hover:bg-white text-[#17402C] border-white/80 shadow-2xs`.
  - Zone basse : `shrink-0 pt-2 border-t border-[#17402C]/5 space-y-1.5` avec le raccourci `Explorer les aventures` et footer text `text-[8.5px] font-mono text-[#5A7064] tracking-wider uppercase` (`Le Kit du Voyageur · Communauté v2.0`).
- **Logique métier préservée :** Navigation entre les sous-espaces communauté, compteurs de badges (`fil`, `carnets`, `clubs`, `groupes`, `evenements`), raccourcis massifs phares, et callbacks `onFilterMassif`.

### Tâche 3 : Harmonisation de `PaysLeftSidebar.tsx`
**Fichier à modifier :** `src/components/pays/PaysLeftSidebar.tsx`
- **Rendu visuel à appliquer :**
  - Conteneur `aside` : `p-3.5`, `rounded-[1.5rem]`, `border-white/40`, `shadow-sm`, `select-none`.
  - Top Card : `p-3`, `rounded-2xl`, `glass-sub-card`, `border-white/50`.
  - Grille d'actions : `grid grid-cols-2 gap-1.5` pour les CTA `Créer mon kit` et `Guide PDF`.
  - Section titre de nav : `text-[9.5px] font-mono font-bold uppercase tracking-widest text-[#5A7064] px-2 mb-1`.
  - Items de navigation : `w-full px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-between group cursor-pointer border`.
    - Actif : `bg-[#17402C] text-white border-[#17402C] shadow-sm` + `<ChevronRightIcon size={13} className="text-white/70 shrink-0" />`.
    - Inactif : `bg-white/80 hover:bg-white text-[#17402C] border-white/80 shadow-2xs`.
  - Zone basse : `shrink-0 pt-2 border-t border-[#17402C]/5 space-y-1.5` avec le lien `Explorer tous les pays` et footer text `text-[8.5px] font-mono text-[#5A7064] tracking-wider uppercase` (`Le Kit du Voyageur · Earth v2.0`).
- **Logique métier préservée :** Drapeaux du pays (`CountryFlag`), noms EN/ISO3, navigation par sections (`presentation`, `destinations`, `activites`, `culture`, `gastronomie`, `pratique`, `communaute`), et callback `onPrint`.

### Tâche 4 : Vérification et Contrôles Anti-Régression
- Exécution de `npm run type-check` pour vérifier la validité TypeScript.
- Exécution de `npm run lint` pour s'assurer du respect des règles ESLint.
- Exécution de `npm run build` pour vérifier la compilation Next.js.

---

### ⛔ STOP ET RAPPORT DE FIN D'HARMONISATION

Présentation du rapport récapitulatif :
1. Sidebars gauches identifiées
2. Fichiers modifiés
3. Contrôles TypeScript, ESLint, et Build
4. Attente de validation explicite de l'utilisateur.
