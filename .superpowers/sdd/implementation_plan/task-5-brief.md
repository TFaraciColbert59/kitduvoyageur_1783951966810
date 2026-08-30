# Task 5 Brief — Migration vers AppShell (preuve de concept)

## Context
Le Kit du Voyageur (Next.js 15 + TypeScript). `AppShell` vient d'être créé dans `src/components/shell/AppShell.tsx` (Task 4).

**Objectif :** Migrer une page simple (sans header maison complexe) de `MobilePageShell` vers `AppShell` pour valider que la migration fonctionne. Page choisie : `/ambassadeurs` (la plus simple — 10 lignes entre MobilePageShell).

**RULING :** La migration complète de toutes les pages est hors scope de ce plan. Cette tâche est une preuve de concept sur une seule page simple. Les pages avec headers maison complexes (compte, communaute, profil, clubs) ne sont PAS migrées ici.

## Fichier à modifier

### `src/app/ambassadeurs/page.tsx`

Lire d'abord le fichier entier pour comprendre son usage de `MobilePageShell`.

Puis :
1. Remplacer l'import `MobilePageShell` par `AppShell`
2. Remplacer le composant `<MobilePageShell>` par `<AppShell>` (mêmes props)

Exemple attendu :
```tsx
// AVANT :
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
// ...
<MobilePageShell>
  {/* contenu */}
</MobilePageShell>

// APRÈS :
import { AppShell } from '@/components/shell';
// ...
<AppShell>
  {/* contenu */}
</AppShell>
```

## Vérifications

```powershell
npx tsc --noEmit
npm run lint
# Confirmer que AppShell est utilisé et non MobilePageShell
Select-String -Path "src/app/ambassadeurs/page.tsx" -Pattern "AppShell"
Select-String -Path "src/app/ambassadeurs/page.tsx" -Pattern "MobilePageShell"  # doit être vide
```

## Commit

```powershell
git add "src/app/ambassadeurs/page.tsx"
git commit -m "feat(shell): migrate /ambassadeurs to AppShell (proof of concept migration)"
```

## Contraintes globales

- TypeScript strict — 0 nouvelle erreur
- `npm run lint` doit passer
- Ne modifier que `src/app/ambassadeurs/page.tsx`
- Ne pas dispatcher de sous-agents

## Rapport

Écrire dans `.superpowers/sdd/implementation_plan/task-5-report.md` :
- Status: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
- Commit créé
- Résultat `tsc --noEmit`
- Concerns éventuels (notamment si AppShell n'existe pas encore car Task 4 n'est pas terminée — signaler BLOCKED dans ce cas)
