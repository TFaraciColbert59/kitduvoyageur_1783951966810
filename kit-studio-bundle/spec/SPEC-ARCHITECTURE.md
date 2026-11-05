# Architecture cible

## Arborescence
```
src/app/kit-studio/
  page.tsx                  Server Component : lit la session, charge le kit (service), rend <KitStudioClient/>
  loading.tsx  error.tsx    squelette de cartes / ⚠ + Réessayer
  layout.tsx                metadata (noindex), thème clair
src/features/kit-studio/
  domain/                   PUR, testé (TDD), zéro import React/three/DOM
    types.ts schema.ts      types + zod (BagId, Zone, Item, KitState, OptionCategory…)
    catalog.ts              familles, objets, sacs, modules (données de la maquette, typées)
    palette.ts              coloris → tokens
    totals.ts balance.ts blockers.ts packing.ts swap.ts order.ts parts.ts attach.ts
    format.ts               kg/g/€/% (espaces insécables)
  store/                    zustand : kitStore (contenu), uiStore (tiroir, vue, mode), selectors
  scene/                    three (client uniquement) : createScene, bagBuilder, itemMesh, ghosts, camera, gestures, thumbnails, lifecycle
  ui/
    KitStudioClient.tsx     monte scène + tiroir
    Drawer/                 Dock, Grab, Strip, Capsule(glassSeg), Pager, Sheet
    cards/                  CardRail, Card, FamilyCapsule, ModeCapsule
    sheets/                 BilanSheet, ItemSheet, BagSheet, OrderSheet, DeckSheet
    Pill.tsx
    kit-studio.css          variables --ks-*, mappées sur --lkv-*
  services/
    kitRepository.ts        local d'abord (Preferences/localStorage), puis Supabase
    orderService.ts         préparation de commande (pas de paiement en v1)
  __tests__/ + tests/e2e-kit-studio/
```

## Règles
- Server Components pour la lecture et les secrets ; `'use client'` uniquement pour la scène et le tiroir. Pas de `innerHTML`.
- `domain/` n'importe rien d'extérieur ; les fonctions sont pures et déterministes ; chaque règle de la maquette a un test qui cite son numéro de ligne d'origine.
- Aucune requête dans un composant : passer par `services/` ; entrées validées par `zod` ; routes API (si besoin) avec `export const dynamic = 'force-dynamic'`.
- État : une seule source (`kitStore`) ; la scène lit l'état par sélecteurs et ne le modifie que par actions (`pack`, `unpack`, `swap`, `setColor`…).
- Retour haptique : hook existant `useHapticFeedback` (jamais `navigator.vibrate` en direct) ; sur iOS natif `src/lib/native/haptics.ts`.
- Navigation : `useRouter().push()`.

## Données et persistance (3 étages, du moins risqué au plus risqué)
1. **Étage 1 — local** (obligatoire, livré en premier) : catalogue embarqué, kit courant et kits de départ (Tour du Mont-Blanc, Week-end Vercors, Cabine 7 kg) enregistrés via `@capacitor/preferences` (repli `localStorage`), clé versionnée `lkdv-kit-studio:v1`.
2. **Étage 2 — compte** : lire/écrire `materiel_kits` et `trip_items` **avec les politiques RLS existantes** ; mapper les objets de la maquette sur le catalogue matériel (`catalogAdapter`). Aucune migration si les colonnes existent déjà ; sinon `ks-reviewer` (Opus) valide d'abord la migration et son rollback (`supabase/migrations_down/`).
3. **Étage 3 — lignées et preuve terrain** : brancher `KitSheetProvider`/`useKitSheet()` ; hors périmètre de la v1 sauf un lien d'ouverture de la fiche du kit.
La v1 est **complète** à l'étage 1 + lecture de l'étage 2. L'étage 3 est un bonus non bloquant.

## Qualité et sécurité
- RLS déjà en place ; ne jamais exposer coordonnées ni lieux fins (`loc` = ville de stockage → région seulement si partagé).
- `scripts/verify/identity_compliance.mjs` et `traveller_privacy.mjs` doivent rester verts.
- CSP : aucune ressource externe ; `three` est embarqué.
- Budgets : `npm run perf:budget` ; la route n'ajoute rien aux pages existantes.
- Tests : Vitest (domaine ≥ 95 % des branches de `domain/`), Testing Library (tiroir, cartes, feuilles), Playwright WebKit mobile 402 × 874 (parcours : ouvrir → ajouter un objet → équilibre → changer de coloris → commander), visuel (`playwright.visual.config.ts`, captures de référence issues de la maquette v2), a11y (`playwright.a11y.config.ts`).

## Mobile / Capacitor
- L'app iOS charge l'URL Vercel (`CAPACITOR_SERVER_URL`) : **la route se déploie sans nouvelle build native**. Aucune modification de `ios/` n'est nécessaire en v1.
- Une modification native (ex. `NATIVE_UI_BRIDGE`) exige une nouvelle build Xcode ; la v1 n'en a pas besoin.
- Barre d'état : thème clair forcé comme `/compas` (`src/lib/native/status-bar.ts`) ; page sans chrome ni tab bar.
