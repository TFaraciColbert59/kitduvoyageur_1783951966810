# Final fix report — refonte cockpit départ (`chantier/depart-refonte`)

Date : 2026-09-12
Dispatch : unique vague de correctifs avant merge (3 findings + micro-fix).
HEAD de départ : `4eaa3701` (test(e2e): garde CTA Preparer + SW neutralise…).

## Finding 1 — `isOnline` transmis au hero + surface hors-ligne (spec §7)

- `DepartDesktopView.tsx` : `const { isOnline } = useDepartOfflineCache(depart, weather)` puis
  `isOnline={isOnline}` sur `DepartHeroCard`. Bandeau unique `role="status"` rendu si `!isOnline` :
  `glass-sub-card rounded-2xl px-3 py-2 text-xs font-medium text-[var(--lkv-text-primary)]/70` avec
  le texte « Mode hors-ligne — fiche et données en cache, synchronisation automatique. »
- `DepartMobileExperience.tsx` : idem (un seul bandeau dans la vue).
- Plus aucune destination de `useDepartOfflineCache` jetée ; le hero ne ment plus sur l'état réseau
  (défaut `true` côté SSR conservé, bascule après hydratation via `navigator.onLine`).

## Finding 2 — routage complet des actions d'alerte (comportement legacy restauré)

- `DepartDesktopView.tsx` :
  - `alert.targetItemId` → scroll scoped vers `#depart-checklist-heading` puis, 150 ms après,
    `window.dispatchEvent(new CustomEvent('highlight-checklist-item', { detail: { id } }))`.
  - `scroll_checklist` → scroll scoped vers le heading de checklist.
  - `view_dispo` → scroll scoped vers la nouvelle section `id="depart-equipment"`.
  - `scroll_weather` → scroll scoped vers `#depart-terrain`.
  - `edit_emergency` → ouverture de la fiche de départ (inchangé).
  - fallback → checklist (inchangé fonctionnellement).
- `DepartMobileExperience.tsx` :
  - `alert.targetItemId` → `setChecklistOpen(true)` puis highlight global après 150 ms (le listener
    `DepartChecklist.tsx:459` n'est plus mort).
  - `scroll_checklist` → ouverture du tiroir checklist + scroll différé vers le heading.
  - `view_dispo` → ouverture du `GlassDrawer` « Parc matériel » (`setEquipmentOpen(true)`).
  - `scroll_weather` → scroll scoped vers `#depart-terrain`.
  - `edit_emergency` / fallback → inchangés (fiche / checklist).
- Scoping : tous les `querySelector` partent de `rootRef.current` (desktop et mobile) — plus aucun
  `document.getElementById` susceptible de toucher une copie masquée (HubShell double-render).
  Le highlight est dispatché globalement, volontairement, pour que le `DepartChecklist` visible réagisse.
- `DepartTerrainSection.tsx` : ajout de `id="depart-terrain"` (ids dupliqués entre vues desktop/mobile
  tolérés, les requêtes étant scopées au root de chaque vue).

## Finding 5 (micro-fix) — double « Date à fixer »

- `DepartHeroCard.tsx` : le bloc séparateur + `CountdownLive` n'est rendu que si `startsAt` est
  truthy. Sans date, seul le fallback de `dateLabel` s'affiche (« Date à fixer » une seule fois).

## Contraintes respectées

- Tokens et `.glass*` uniquement ; aucun `rose-`/`sand-`/`forest-`/`bg-white/(60|90)`/`dark:` ;
  aucune math safe-area ; aucun autre changement de comportement.
- Aucun sous-agent utilisé ; travail réalisé sur le HEAD courant.

## Tests

Commandes exécutées à la racine du repo :

| Commande | Résultat |
| --- | --- |
| `npx vitest run tests/materiel` | 22 fichiers / 132 tests passés, 0 échec |
| `npx tsc --noEmit` | exit 0 (0 erreur) |
| `npm run lint` | exit 0 (0 erreur ; warnings pré-existants hors périmètre) |
| `npx vitest run tests/mobile-layout.spec.ts` | 9 tests passés (sanity check hors dossier) |

Suites pré-existantes en échec volontairement non touchées : a13-backtest-export, a14-healthcheck,
a15-rollout, phase10-capacity.

Couverture de verrouillage ajoutée :

- `tests/materiel/depart-desktop-view.spec.ts` : source-guards `isOnline={isOnline}`, texte du
  bandeau + `role="status"`, branches `view_dispo`/`scroll_weather`/`scroll_checklist`/
  `edit_emergency`, `highlight-checklist-item`, `querySelector('#depart-equipment'|'#depart-terrain')`,
  absence de `document.getElementById('depart-checklist-heading')`.
- `tests/materiel/depart-mobile-experience.spec.ts` : mêmes gardes + `setEquipmentOpen(true)` pour
  `view_dispo`, et remplacement de l'assert legacy `getElementById` par la version scopée.
- `tests/materiel/depart-hero-card.spec.ts` : sans `startsAt`, « Date à fixer » n'apparaît qu'une fois.

## Fichiers modifiés

- `src/features/materiel/components/depart/DepartDesktopView.tsx`
- `src/features/hub/components/mobile/depart/DepartMobileExperience.tsx`
- `src/features/materiel/components/depart/DepartTerrainSection.tsx`
- `src/features/materiel/components/depart/hero/DepartHeroCard.tsx`
- `tests/materiel/depart-desktop-view.spec.ts`
- `tests/materiel/depart-mobile-experience.spec.ts`
- `tests/materiel/depart-hero-card.spec.ts`

## Concerns

- Sur mobile, le `DepartChecklist` vit dans un portail Radix hors du `rootRef` : le scroll scopé de
  `scroll_checklist` est un no-op silencieux si le tiroir vient de s'ouvrir ; le tiroir s'affiche
  de toute façon en tête sur le heading. Le highlight d'item reste fonctionnel (événement global).
- WIP propriétaire et captures `docs/atlas/captures/*.png` volontairement non stagés.
