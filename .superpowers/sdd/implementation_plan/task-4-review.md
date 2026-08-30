## Spec compliance: ✅

- `src/components/shell/AppShell.tsx` créé avec l'interface `AppShellProps` (incluant `header?`, `bottomExtra?`, `safeTop?`, `hasBottomNav?`, `videoBackground?`, `background?`, `className?`, `children`) : ✅ Conforme
- `src/components/shell/index.ts` créé avec les exports `AppShell` et `AppShellProps` : ✅ Conforme
- Calcul de `--bottom-nav-height` identique à `MobilePageShell` (détection routes `hasUpperExtension` + fallbacks CSS vars) : ✅ Conforme
- Slot `header` rendu en `position: 'sticky'` (`top: 0, zIndex: 40`) : ✅ Conforme
- JSDoc de `safeTop` rappelant la règle d'obligation de documentation lors d'une désactivation : ✅ Conforme
- Validation TypeScript (`tsc --noEmit`) : ✅ Passé (0 erreur)
- Aucun fichier existant modifié dans le commit `6a07b8f` : ✅ Conforme

## Findings

None

## Task quality: Approved
