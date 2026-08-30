# Task 2 Brief — Documenter tous les `safeTop={false}` non justifiés

## Context
Le kit du Voyageur (Next.js 15 + React 19 + TypeScript). 

**Bug #3 :** Certaines pages utilisent `safeTop={false}` sur `MobilePageShell` sans expliquer pourquoi, rendant impossible de savoir si c'est intentionnel ou un bug. La règle est : `safeTop={false}` est OK uniquement si la page embarque son propre header sticky qui gère déjà `env(safe-area-inset-top)`, et ce fait DOIT être documenté par un commentaire JSX explicite juste avant la prop.

## Fichiers à modifier

### 1. `src/components/mobile-nav/MobilePageShell.tsx`

Remplacer le commentaire JSDoc existant de la prop `safeTop` (actuellement lignes 18-20) par cette version enrichie :

```tsx
/**
 * Appliquer le padding-top safe-area (Dynamic Island / Notch / Status Bar).
 * ⚠ Mettre à `false` UNIQUEMENT si la page embarque son propre header sticky
 * qui gère déjà `env(safe-area-inset-top)` — et toujours ajouter un commentaire
 * JSX juste avant l'usage expliquant quel composant le gère et à quelle ligne.
 * Ne jamais mettre `false` sans raison documentée.
 */
safeTop?: boolean;
```

### 2. `src/app/compte/page.tsx` — ligne 160

Trouver `<MobilePageShell safeTop={false} background="transparent">` et ajouter le commentaire JSX JUSTE AVANT cette balise :

```tsx
{/* safeTop=false: MobileCompteV2 embarque son propre header sticky (MobileCompteV2.tsx:460)
    qui calcule pt-[calc(max(env(safe-area-inset-top,0px),10px)+6px)] */}
<MobilePageShell safeTop={false} background="transparent">
```

### 3. `src/app/communaute/page.tsx` — ligne 201

Trouver `<MobilePageShell videoBackground={true} safeTop={false}>` et ajouter le commentaire JSX JUSTE AVANT :

```tsx
{/* safeTop=false: MobileCommunityHeader embarque son propre header sticky (MobileCommunityHeader.tsx:24)
    qui calcule pt-[calc(max(env(safe-area-inset-top,0px),10px)+6px)] */}
<MobilePageShell videoBackground={true} safeTop={false}>
```

### 4. `src/app/profil/[id]/page.tsx` — ligne 204

Trouver `<MobilePageShell safeTop={false} background="transparent">` et ajouter le commentaire JSX JUSTE AVANT :

```tsx
{/* safeTop=false: PublicMobileProfileView embarque son propre header sticky (PublicMobileProfileView.tsx:67)
    qui calcule pt-[max(10px,env(safe-area-inset-top))] */}
<MobilePageShell safeTop={false} background="transparent">
```

### 5. `src/app/clubs/[id]/page.tsx` — ligne 792

Trouver `<MobilePageShell safeTop={false} videoBackground={false} background="#FAF8F5">` et ajouter le commentaire JSX JUSTE AVANT :

```tsx
{/* safeTop=false: MobileClubDetailView embarque son propre header sticky (MobileClubDetailView.tsx:89)
    qui calcule top-[calc(max(env(safe-area-inset-top,0px),12px)+6px)] */}
<MobilePageShell safeTop={false} videoBackground={false} background="#FAF8F5">
```

### Note sur les autres fichiers `safeTop={false}` : 
- `src/app/boussole/page.tsx:209` — page fullscreen (carte), `safeTop=false hasBottomNav=false`. Intentionnel, ne pas modifier (sauf pour ajouter un commentaire similaire si tu le juges utile).
- `src/app/carte-interactive/page.tsx:42` — idem, carte fullscreen. Ne pas modifier.

## Vérification

```powershell
npx tsc --noEmit
npm run lint
```
Les deux doivent passer sans nouvelle erreur.

## Commit

```powershell
git add src/components/mobile-nav/MobilePageShell.tsx
git add "src/app/compte/page.tsx"
git add "src/app/communaute/page.tsx"
git add "src/app/profil/[id]/page.tsx"
git add "src/app/clubs/[id]/page.tsx"
git commit -m "docs(shell): add explicit justification comments to all safeTop=false usages"
```

## Contraintes globales

- TypeScript strict — aucune nouvelle erreur
- `npm run lint` doit passer
- Ne modifier QUE les fichiers listés ci-dessus
- Ne pas dispatcher de sous-agents

## Rapport

Écrire dans `.superpowers/sdd/implementation_plan/task-2-report.md` :
- Status: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
- Liste des fichiers modifiés
- Commits créés
- Résultat `tsc --noEmit`
- Résultat `npm run lint`
