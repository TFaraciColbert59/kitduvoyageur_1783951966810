# Plan — fiche carnet par jour

> Spec : `docs/superpowers/specs/2026-10-28-carnet-par-jour-design.md`
> Worktree : `lkdv-cf-carnet2`, branche `cf/carnet-latest`. Déploiement final sur Vercel.

**Goal :** la carte devient un balayage Résumé → J1 → Jn, avec stats, posts et carte cinématique par jour.

**Architecture :** dérivation serveur `days[]` + `summary` (aucune migration), composants de carte
découpés en `CarnetDaySummary` (haut) et `CarnetDayPages` (balayage), carte pilotée par `focusDay`.

**Tech :** Next 15, React 19, CSS existant, MapLibre via `CompteMap` (`variant="carnet"`).

## Contraintes globales

- Châssis Compte intouchable : carte `12/48/406×541`, grille `134`/gap 2/rayon 2, sélecteur `88×30`,
  barre basse `402×48`, verre `.486/.384` + `blur(25.2) saturate(1.8) brightness(1.05)`, rayon 24.
- Carte du bas : `height: 40dvh`, collée au bas.
- Aucune couleur hors `#172B24 #17402C #56665D #6B7A70 #8A968D #C13B34`.
- Aucun texte de titre ni phrase dans les drawers (placeholders uniquement).
- `scrollWidth === innerWidth` et `scrollHeight === innerHeight` à 430×932, 768×1024, 1440×900.
- Ne pas toucher `src/components/compte/**` (sauf `CompteMap` déjà adaptée), `AccountBottomBar`, messaging.

---

### Task 1 : dériver les jours côté serveur

**Files :** Modify `src/features/carnet/detail/types.ts`, `buildCarnetDetail.ts`, `getCarnetDetail.ts` ;
Create `src/features/carnet/detail/days.ts`, `__tests__/days.test.ts`.

**Produces :** `CarnetDay { index: number; date: string|null; distanceKm: number|null; elevationM: number|null;
durationS: number|null; moments: CarnetMoment[]; trace: GeoJsonLineString|null }` ;
`CarnetDetail.days: CarnetDay[]`, `CarnetDetail.summary: { distanceKm, elevationM, days, moments, trace }`.

- [ ] 1. Test : deux sorties le même jour → points fusionnés, distance = somme des segments du jour.
- [ ] 2. Test : jour sans point GPS mais avec moments → `trace: null`, `moments` présents.
- [ ] 3. Test : carnet sans dates → jours dérivés des `jour_numero` des moments, `date: null`.
- [ ] 4. Implémenter `buildDays(moments, sessions, carnet)` + `buildSummary(...)`.
- [ ] 5. Brancher dans `buildCarnetDetail`, sans casser `detail.trace` existant.
- [ ] 6. `npx vitest run src/features/carnet` vert, commit.

### Task 2 : carte cinématique par jour

**Files :** Modify `src/components/carnet/profile/CarnetMapCard.tsx`, `src/components/compte/map/CompteMap.tsx`
(prop `focus` déjà présente : ajouter `trace` par jour), `__tests__/CarnetMapCard.test.tsx`.

- [ ] 1. Test : `focus` change → `flyTo` appelé avec le centre du segment (mock MapLibre).
- [ ] 2. Test : `prefers-reduced-motion` → `jumpTo`, pas de `flyTo`.
- [ ] 3. Passer `trace` du jour à `CompteMap` (variant carnet) ; `null` → état vide existant.
- [ ] 4. Animation 900 ms `cubic-bezier(.22,1,.36,1)`, pitch 45, `fitBounds` du segment.
- [ ] 5. Tests verts, capture « à mi-vol », commit.

### Task 3 : balayage Résumé → J1..Jn

**Files :** Modify `CarnetCard.tsx`, `CarnetScreen.tsx` ; Create `CarnetDaySwipe.tsx`, `CarnetDayHeader.tsx`.

- [ ] 1. Test : swipe gauche depuis Résumé → J1 ; droit depuis J1 → Résumé ; bornes respectées.
- [ ] 2. Test : J3 sans GPS → `— km`, `— m`, état vide de grille.
- [ ] 3. Implémenter le balayage (pointer + clavier), 220 ms, `prefers-reduced-motion` → sans translation.
- [ ] 4. Le carrousel posts/parcours reste piloté par le sélecteur uniquement.
- [ ] 5. Tests verts, captures Résumé / J1 / J2, commit.

### Task 4 : barre d'action identique aux drawers

**Files :** Modify `CarnetCard.tsx`, `src/styles/carnet-profile.css`, `__tests__/CarnetCard.test.tsx`.

- [ ] 1. Test : la capsule fait `88×30`, 2 segments, à 10 px du bord droit et du bas.
- [ ] 2. Supprimer les boutons ♥ / 💬 de la carte (leurs pages restent accessibles par le carrousel).
- [ ] 3. Reprendre `.ckp-capsule` des drawers, lentille 41,5×25.
- [ ] 4. Tests verts, mesure, commit.

### Task 5 : recette et déploiement

- [ ] 1. `npx vitest run src/components/carnet src/features/carnet` : tout vert.
- [ ] 2. `NODE_OPTIONS=--max-old-space-size=10240 npx tsc --noEmit` : 0 erreur.
- [ ] 3. Captures 430×932 / 768×1024 / 1440×900, diff pixel châssis = 0.
- [ ] 4. Portage dans `cloudflare/vinext` + `vercel deploy --prod`, vérification de l'URL.
