# Carnet — 15 composants d’amélioration visuelle

**Stack :** Next.js 15, React 19, MapLibre, CSS Compte.
**Contrainte :** aucune nouvelle grammaire visuelle ; capsule 30 px, lentille 41,5×25, verre et focus Compte.

| # | Composant | Source / inspiration | Usage Carnet | État |
|---|---|---|---|---|
| 1 | `Field` | [shadcn/ui Field](https://ui.shadcn.com/docs/components/base/field) | label sr-only + placeholder, erreur reliée | Intégré via inputs |
| 2 | `Input` | [shadcn/ui Input](https://ui.shadcn.com/docs/components/aria/input) | titre, destination, commentaire | Intégré |
| 3 | `Textarea` | [shadcn/ui Textarea](https://ui.shadcn.com/docs/components/base/textarea) | récit, `field-sizing-content` | Intégré |
| 4 | `IconButton` | Primitive Compte | dessiner, créer, photo, poubelle | Intégré |
| 5 | `CapsuleTabs` | `.ig-tabs` Compte | sélecteur jours | Intégré |
| 6 | `Drawer` / `Sheet` | [Base UI Drawer](https://base-ui.com/react/components/drawer) | feuille basse, snap futur | Existant |
| 7 | `ScrollArea` | CSS scroll-snap | slides Réglages/Jours/+ | Intégré |
| 8 | `Command` | [shadcn/ui Command](https://ui.shadcn.com/docs/components/command) | destination/activité en recherche | PlaceSearch existant |
| 9 | `Calendar` / `Popover` | [shadcn/ui Calendar](https://ui.shadcn.com/docs/components/calendar) | dates en pilules | Date pills intégrées |
| 10 | `Skeleton` | shadcn Skeleton | chargement carte | Intégré |
| 11 | `Empty` | shadcn Empty | jour sans moment | Intégré (bouton +) |
| 12 | `Thumbnail` | shadcn Avatar/Image | photo du moment | Intégré |
| 13 | `Toast` | [Sonner](https://sonner.emilkowal.ski/) | succès/erreur de création | Backlog |
| 14 | `Progress` / `Spinner` | [shadcn Spinner](https://ui.shadcn.com/docs/components/spinner) | ajustement du tracé | Intégré (loader) |
| 15 | `Tooltip` | [Base UI Tooltip](https://base-ui.com/react/components/tooltip) | boutons icône seulement | Backlog |

## Règles de placement

- Carte : `flex: 0 0 410px`, radius 16, marge 8.
- Feuille : contenu, pas de hauteur forcée, pas de carte blanche.
- Barre : `position: fixed`, `right: 14`, `bottom: 10 + safe-area`.
- Submit : haut droite de la carte, 44×44, jamais à gauche.
- Un seul accent `#17402C`, un seul verre, une seule ombre.

## Librairies vérifiées

- [shadcn/ui Field](https://ui.shadcn.com/docs/components/base/field)
- [shadcn/ui Drawer / Base UI](https://ui.shadcn.com/docs/components/base/drawer)
- [Base UI Drawer](https://base-ui.com/react/components/drawer)
- [shadcn/ui Textarea](https://ui.shadcn.com/docs/components/base/textarea)
- [Sonner](https://sonner.emilkowal.ski/)
- [input-otp](https://github.com/guilhermerodz/input-otp) (non utilisé ici)
