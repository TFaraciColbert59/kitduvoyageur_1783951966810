## Spec compliance: ✅

- **`eslint.config.mjs` créé** : ✅ Fichier flat config créé à la racine du projet (commit `ff5ec60`), sans modification de configuration ESLint existante.
- **Portée des règles (`src/**/*.{ts,tsx}`)** : ✅ La section `lkdv/shell-safe-area` cible explicitement `['src/**/*.{ts,tsx}']`.
- **Règle `no-restricted-syntax` pour `safe-area-inset`** : ✅ Sélecteurs `Literal[value=/env\\(safe-area-inset-top/]` et `Literal[value=/env\\(safe-area-inset-bottom/]` configurés avec sévérité `warn` (non bloquant).
- **Règle `no-restricted-imports` pour `MobilePageShell`** : ✅ Import `@/components/mobile-nav/MobilePageShell` configuré avec sévérité `warn` et message orientant vers `AppShell`.
- **Exemptions des fichiers shell canoniques** : ✅ Les fichiers `src/components/shell/AppShell.tsx` et `src/components/mobile-nav/MobilePageShell.tsx` sont configurés dans un bloc dédié `lkdv/shell-safe-area-canonical` avec `no-restricted-syntax: 'off'`.
- **Exécution `npm run lint`** : ✅ Code de sortie `0`, `0` erreur bloquante, exactement `135` warnings `[LKDV Shell]` émis sur le code existant.
- **Syntaxe et structure** : ✅ Flat config ESLint 9 / Next.js 15 propre, utilisant `FlatCompat` pour `next/core-web-vitals` et `next/typescript`.

## Findings

None

## Task quality: Approved
