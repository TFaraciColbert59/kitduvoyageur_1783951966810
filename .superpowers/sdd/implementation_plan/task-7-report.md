# Task 7 Report — Règle ESLint anti-régression safe-area

## Status
**DONE**

## Format ESLint détecté & configuré
- **Configuration** : Flat config ESLint 9 / Next.js 15 via `eslint.config.mjs`.
- **Compatibilité** : Utilisation de `FlatCompat` (`@eslint/eslintrc`) étendant `next/core-web-vitals` et `next/typescript`, avec conservation des règles du projet et déclaration explicite des règles `lkdv/shell-safe-area`.
- **Exemptions canoniques** : Les fichiers shell canoniques (`src/components/shell/AppShell.tsx` et `src/components/mobile-nav/MobilePageShell.tsx`) sont explicitement exemptés de `no-restricted-syntax`.

## Commit créé
- `ff5ec60` : `chore(lint): add ESLint shell safe-area rules to warn on direct env() usage`

## Fichiers créés / modifiés
- **Créé** : `eslint.config.mjs` (Règles `lkdv/shell-safe-area` avertissant sur l'usage direct de `env(safe-area-inset-top)` et `env(safe-area-inset-bottom)` ainsi que sur l'import de `MobilePageShell`).

## Vérifications

1. **`npm run lint`** :
   - **Code de sortie** : `0` (SUCCESS)
   - **Erreurs bloquantes** : `0` erreur
   - **Warnings générés par les règles `[LKDV Shell]`** : `135` avertissements
     - Usage direct de `env(safe-area-inset-top)` ou `env(safe-area-inset-bottom)` sur les composants hors shell canonique.
     - Usage d'import déprécié `@/components/mobile-nav/MobilePageShell` invitant à migrer vers `@/components/shell` (`AppShell`).

2. **TypeScript (`npm run type-check` / `tsc --noEmit`)** :
   - **Code de sortie** : `0` (SUCCESS, 0 erreur)

3. **Tests unitaires (`npm test` / Vitest)** :
   - **Code de sortie** : `0` (12 test suites passées, 45 tests passés)

## Concerns éventuels
- Aucun. Les règles sont configurées en mode `warn`, ce qui assure la non-régression et le guidage pour les futurs développements sans casser les builds de production ou le pipeline CI existant.
