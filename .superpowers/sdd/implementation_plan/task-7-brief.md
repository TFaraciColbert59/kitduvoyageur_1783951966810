# Task 7 Brief — Règle ESLint anti-régression safe-area

## Context
Le Kit du Voyageur (Next.js 15 + TypeScript). Next.js utilise ESLint via `next lint`.

**Objectif :** Ajouter une règle ESLint qui émet un `warn` quand `env(safe-area-inset-top` ou `env(safe-area-inset-bottom` est utilisé directement dans du code TypeScript/TSX hors des fichiers shell légitimes, et un `warn` sur les imports de `MobilePageShell` (dépréciés au profit d'`AppShell`).

## Vérification préalable

Avant de créer quoi que ce soit, vérifier quel format de config ESLint est en place :

```powershell
Get-ChildItem -Path . -Name "eslint.config*" -ErrorAction SilentlyContinue
Get-ChildItem -Path . -Name ".eslintrc*" -ErrorAction SilentlyContinue
```

Next.js 15 utilise le flat config (`eslint.config.mjs`). Si aucun fichier n'existe, Next.js gère ESLint en interne via `next.config` — créer `eslint.config.mjs`.

## Fichier à créer : `eslint.config.mjs`

```mjs
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

/** @type {import('eslint').Linter.Config[]} */
const config = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    name: 'lkdv/shell-safe-area',
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      /**
       * Avertir quand env(safe-area-inset-top) est utilisé directement dans du code TSX/TS.
       * Seuls AppShell.tsx et MobilePageShell.tsx sont autorisés (ils sont les sources canoniques).
       * Pour les overlays légitimes (cartes, drawers), annoter la ligne avec // lkdv-safe-area-ok
       */
      'no-restricted-syntax': [
        'warn',
        {
          selector: "Literal[value=/env\\(safe-area-inset-top/]",
          message:
            '[LKDV Shell] Éviter env(safe-area-inset-top) directement. ' +
            'Utiliser AppShell (safeTop=true) ou la CSS var --safe-top. ' +
            'Si inévitable (overlay de carte), ajouter // lkdv-safe-area-ok sur la ligne.',
        },
        {
          selector: "Literal[value=/env\\(safe-area-inset-bottom/]",
          message:
            '[LKDV Shell] Éviter env(safe-area-inset-bottom) directement. ' +
            'Utiliser AppShell ou la CSS var --bottom-nav-height. ' +
            'Si inévitable, ajouter // lkdv-safe-area-ok sur la ligne.',
        },
      ],
      /**
       * Avertir sur les imports de MobilePageShell (préférer AppShell pour les nouvelles pages).
       */
      'no-restricted-imports': [
        'warn',
        {
          paths: [
            {
              name: '@/components/mobile-nav/MobilePageShell',
              message:
                '[LKDV Shell] Pour les nouvelles pages, utiliser AppShell (@/components/shell). ' +
                'MobilePageShell reste supporté pour les pages existantes.',
            },
          ],
        },
      ],
    },
  },
];

export default config;
```

**NOTE :** Si `@eslint/eslintrc` n'est pas dans les dépendances, l'installer :
```powershell
npm install --save-dev @eslint/eslintrc
```

## Vérification

```powershell
# Vérifier que lint passe (des warnings sont attendus sur les fichiers existants)
npm run lint 2>&1 | Select-String -Pattern "error|warning" | Select-Object -First 20
# Attendu : warnings sur les fichiers existants (safe-area hors shell), 0 erreur bloquante
```

## Commit

```powershell
git add eslint.config.mjs
# Si @eslint/eslintrc installé :
git add package.json package-lock.json
git commit -m "chore(lint): add ESLint shell safe-area rules to warn on direct env() usage"
```

## Contraintes globales

- `npm run lint` doit passer (warnings OK, pas d'erreur)
- `tsc --noEmit` doit passer
- Ne pas dispatcher de sous-agents

## Rapport

Écrire dans `.superpowers/sdd/implementation_plan/task-7-report.md` :
- Status: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
- Format ESLint détecté
- Commit créé
- Résultat `npm run lint` (combien de warnings générés par la règle)
- Concerns éventuels
