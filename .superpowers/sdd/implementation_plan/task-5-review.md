## Spec compliance: ✅

- **Suppression de MobilePageShell :** ✅ `MobilePageShell` n'est plus importé ni utilisé dans `src/app/ambassadeurs/page.tsx`.
- **Import d'AppShell :** ✅ `AppShell` est correctement importé depuis `@/components/shell`.
- **Remplacement du composant :** ✅ `<AppShell>` remplace `<MobilePageShell>` avec le même contenu enfant préservé.
- **Périmètre des modifications :** ✅ Seul `src/app/ambassadeurs/page.tsx` a été modifié comme spécifié dans le brief.
- **Validation TypeScript & Lint :** ✅ `tsc --noEmit` passe sans erreur (0 erreur) et lint validé.

## Findings
None

## Task quality: Approved
