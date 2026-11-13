# Composants d'accessibilité — Lot O02-UI

Briques UI branchées sur le contrat `src/features/accessibility/index.ts` (aucun
fichier du contrat n'est modifié ici).

## Montage

- `AccessibilityRuntime` est monté une fois dans `src/app/layout.tsx` : il relit
  les préférences persistées et pose les attributs `data-*` sur `<html>`.
- `SkipToContentLink` remplace le lien d'évitement historique et place
  réellement le focus sur `<main id="main-content">`.
- `/accessibilite` rend `AccessibilitySettingsScreen` (préférences, audit
  WCAG/RGAA, repères clavier).

## Intégration aux panneaux K7.09, K7.10 et S6.22..S6.25

Ces écrans sont des drawers/sous-drawers (Compte → Abonnement, couverture,
droits, API, carbone). Les envelopper sans toucher `SheetContent.tsx` :

```tsx
<AccessibleDrawer
  open={open}
  onClose={close}
  title="Couverture géographique"
  description="Région gratuite, régions à l'achat et Pack Monde."
  restoreFocusTo={triggerRef.current}
>
  {/* contenu du panneau, y compris les états actif / expiré / révoqué */}
</AccessibleDrawer>
```

- Le piège de focus et la restitution au déclencheur viennent de
  `useDrawerFocusRestoration`.
- Toute transition d'état (droit actif, expiré, révoqué, version de cartes,
  offre partenaire, quota API, estimation carbone) s'annonce avec
  `LiveRegion` ou `announceToScreenReader`, en texte explicite.
- Les couleurs de statut ne sont jamais seules : le libellé porte l'état.
- `ContrastAuditTable` vérifie les jetons réels avec les seuils AA/AAA et le
  seuil 3:1 des composants d'interface (WCAG 1.4.11 / RGAA 3.2–3.3).

## Carte Explorer

`MapKeyboardRegion` s'ajoute autour de la carte sans modifier `ExplorerV2.tsx`
ni son état : flèches, zoom, recentrage, sélection et Échap, `Tab` toujours
libre, annonces dans la live-region partagée.

## Tests

`npx vitest run src/components/accessibility`
