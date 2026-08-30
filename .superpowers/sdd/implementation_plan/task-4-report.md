# Task 4 Report — Créer `AppShell.tsx` : source unique de vérité du layout mobile

## Status
**DONE**

## Fichiers créés
- `src/components/shell/AppShell.tsx` : Composant `AppShell` réutilisable avec slots `header` (sticky) et `bottomExtra` (au-dessus de la barre de navigation), gestion centralisée des safe-areas (Dynamic Island / Notch / Home Indicator) et calcul dynamique de `--bottom-nav-height`.
- `src/components/shell/index.ts` : Point d'entrée de réexport (`AppShell`, `AppShellProps`).

## Commits créés
- `6a07b8f` : `feat(shell): create AppShell — single source of truth for mobile layout, with header/bottomExtra slots`

## Résultat vérifications
- `npx tsc --noEmit` : **SUCCESS (0 erreur)**
- `npx next lint --dir src/components/shell` : **SUCCESS (0 avertissement, 0 erreur)**

## Concerns éventuels
- Aucun. `MobilePageShell.tsx` reste inchangé et actif pour les pages existantes. `AppShell` est prêt à accueillir les migrations de pages.
