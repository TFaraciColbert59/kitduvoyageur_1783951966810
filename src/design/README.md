# Design System LKDV — structure Phase 1

Façade unique : `import { … } from '@/design'`.

## Sources uniques de vérité

| Couche | Emplacement canonique | Notes |
|---|---|---|
| Tokens CSS | `src/styles/tokens.css` | Toutes les valeurs brutes (couleurs, rayons, durées, flous, z-index, safe areas, contrôles…). |
| Tokens TS | `src/design/tokens.ts` | Miroir typé, zéro hexadécimal (verrouillé par `tests/design/tokens-sync.spec.ts`). |
| Utilitaires CSS | `src/styles/tailwind.css` | Classes transverses uniquement (safe areas, scrollbars, keyframes). |
| Matériau verre | `src/styles/liquid-glass.css` | `.glass`, contrôles, messages. |
| Primitives UI | `src/components/ui/` | Convention `DESIGN_SYSTEM.md` (pas de déplacement de fichiers en Phase 1). |
| Layouts | `src/design/layouts/` | Compositions au-dessus de `AppShell`. |

## Règles

1. Une page ne code jamais une couleur, un rayon, une ombre, un blur ou un z-index en dur : elle consomme un token ou une primitive.
2. Les nouvelles primitives vont dans `src/components/ui/` et sont exportées par `@/design`.
3. `AppShell` / `MobilePageShell` reste le shell canonique mobile (safe areas, bottom nav).
4. Aucune feature ne définit son propre design global : elle compose les primitives.

## Migration progressive (Phase 2)

- Adopter `Page` / `PageHeader` / `PageContent` / `PageActions` / `Section` page par page.
- Remplacer les spinners artisanaux par `Spinner`, les séparateurs par `Divider`.
- Converger vers `GlassModal` (unique primitive modale) et supprimer `Sheet` / `PremiumBottomSheet` / sheets maison.
- Purger les styles locaux (`text-[#…]`, `rounded-[…]`, `z-[…]`, `blur-*` arbitraires) par feature.
