# Task 6 Brief — Audit des `loading.tsx` : wrapper shell obligatoire

## Context
Le Kit du Voyageur (Next.js 15 + TypeScript). L'objectif est de s'assurer qu'aucun `loading.tsx` ne produit un écran blanc total — chacun doit afficher au minimum la structure de la page (shell ou skeleton).

## Constat de l'état actuel

Le fichier `src/app/pays/loading.tsx` (55 lignes) est déjà un skeleton complet (pas de MobilePageShell — c'est un globe fullscreen, normal).

D'autres `loading.tsx` peuvent être vides ou minimaux. 

## Objectif

Auditer les loading.tsx des **routes principales à risque** et corriger ceux qui produiraient un écran blanc.

## Routes à auditer (par priorité)

1. `src/app/communaute/loading.tsx`
2. `src/app/carnets/loading.tsx`
3. `src/app/compte/loading.tsx`
4. `src/app/clubs/loading.tsx`
5. `src/app/pays/loading.tsx` (déjà OK — vérifier seulement)

Pour chaque fichier :
- Lire son contenu
- Si le contenu est vide (`null`, `<div></div>`, ou moins de 5 éléments rendus) → ajouter un skeleton minimal avec `MobilePageShell`
- Si le contenu a déjà un skeleton significatif → ne pas modifier

## Template de correction pour un loading.tsx trop minimal

```tsx
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

export default function XxxLoading() {
  return (
    <MobilePageShell>
      {/* Skeleton pulsing — structure visible immédiatement */}
      <div className="px-4 pt-4 space-y-4">
        <div className="h-8 w-48 rounded-full bg-white/30 animate-pulse" />
        <div className="h-4 w-full rounded-full bg-white/20 animate-pulse" />
        <div className="h-4 w-3/4 rounded-full bg-white/20 animate-pulse" />
        <div className="h-32 w-full rounded-2xl bg-white/20 animate-pulse" />
      </div>
    </MobilePageShell>
  );
}
```

Adapter le skeleton au type de page (liste, cartes, etc.) si le contenu de la page est connu.

## Vérifications

```powershell
npx tsc --noEmit
npm run lint
```

## Commit

```powershell
# Ajouter uniquement les fichiers modifiés
git add src/app/communaute/loading.tsx
# + autres fichiers modifiés
git commit -m "fix(shell): ensure critical loading.tsx use shell skeleton (no white screen)"
```

Si aucun fichier ne nécessite de correction (tous sont déjà corrects), committer un rapport avec la note "audit done, no changes needed".

## Contraintes globales

- TypeScript strict — 0 nouvelle erreur
- `npm run lint` doit passer
- Ne modifier que les `loading.tsx` listés ci-dessus
- Ne pas dispatcher de sous-agents

## Rapport

Écrire dans `.superpowers/sdd/implementation_plan/task-6-report.md` :
- Status: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
- Pour chaque fichier audité : état avant (vide/minimal/correct) et action prise
- Commits créés
- Résultat `tsc --noEmit`
