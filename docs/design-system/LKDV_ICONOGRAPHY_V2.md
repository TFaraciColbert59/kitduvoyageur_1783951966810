# LKDV V2 — la seule base d'icônes

Décision de Tony du 2026-10-28 : la bibliothèque LKDV V2 est **l'unique base de pictogrammes**, aujourd'hui et dans le futur.

## Contenu
- **238 SVG** (257 emplacements, 16 catégories), `viewBox="0 0 100 100"`, un seul vert `#00542B`, sans dégradé, ombre, transparence ni fond.
- Fichiers : `public/icons/lkdv/<clé>.svg` (clé = colonne `key` de `docs/design-system/lkdv-v2/inventaire.csv`).
- Sources conservées : `Catalogue-LKDV-V2.svg` (planche), `inventaire.csv`, `INVENTAIRE.md`.

## Utilisation
```tsx
import { LKDVIcon } from '@/components/ui/LKDVIcon';
<LKDVIcon name="montagne" size={20} />          // décoratif (aria-hidden)
<LKDVIcon name="alerte" size={20} alt="Alerte" /> // porteur de sens
```
Tables d'icônes (composants passés en valeur) : `lkdvIcon('boussole')` (`@/components/ui/lkdvIconComponent`).
Un nom hors base ne compile pas (`LKDVIconName`). Les anciens noms (lucide, Heroicons, kebab) ne se résolvent que par `resolveLKDVIcon` (`@/components/ui/lkdvAliases`), pour des données déjà stockées.

## Rendu et couleur
Le SVG sert de masque (`.lkdv-icon`, `src/styles/lkdv-icons.css`). La peinture est exactement `#00542B` quand le texte courant est sombre, et blanche quand il est clair : photo, bouton plein, bandeau forêt, thème sombre. Aucune liste de surfaces, aucun filtre, aucun script. Navigateurs sans « relative color syntax » : vert pur.

## Ajouter ou changer une icône
1. Mettre à jour la planche et l'inventaire dans `docs/design-system/lkdv-v2/`.
2. `npm run icons:import` régénère `public/icons/lkdv/` ; ajouter la clé à `LKDV_ICON_NAMES` (`src/components/ui/LKDVIcon.tsx`).
3. `npm run verify:icons` et `npx vitest run tests/design-system/lkdv-icons.spec.ts`.

## Garde-fous
- `scripts/verify/icon-names.mjs` : aucune autre bibliothèque, aucun ancien pack (`/icons/sf`, PNG), noms écrits en dur valides, SVG = liste typée, un seul vert.
- `tests/design-system/lkdv-icons.spec.ts` : mêmes invariants + dépendances tierces absentes de `package.json`.
- ESLint : `@typescript-eslint/no-restricted-imports` interdit lucide, Heroicons, Phosphor, react-icons, Tabler, Radix icons, Font Awesome, Feather.

## Hors base (assumé)
Le cercle vide « non coché » n'existe pas dans la base : c'est `EmptyCircle` (CSS, `src/components/ui/EmptyCircle.tsx`), pas un pictogramme. Les graphiques de données (jauges, courbes d'altitude, anneaux, mini-cartes, sceau d'empreinte) ne sont pas des icônes.

## Lacunes de la base repérées à la migration
Pas de « moins », de « coche » seule, de chevrons gauche/droite (le retour et le suivant sont des flèches), de cercle vide, de cœur plein, de panier d'archive, de corbeille de « restaurer ». Les correspondances retenues sont dans `src/components/ui/lkdvAliases.ts`.
