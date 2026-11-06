# REPO-MAP — kit-studio (T01)

Chemins relatifs à la racine du worktree. Lignes vérifiées par grep/lecture ; "~" = approximatif.

## 1. Tokens design
- `src/styles/tokens.css` (1117 l.) — importé par `src/app/layout.tsx:5` (`import '@/styles/tokens.css'`). Seul import trouvé.
- Façade `@/design` : `src/design/index.ts` (réexporte `./tokens`, `@/components/ui`, `./layouts`). Existe.
- Couleurs (nom = valeur) :
  - primary `#17402C` (l.18), primary-hover `#205238` (l.19), primary-soft `#365233` (l.20), primary-subtle `#D3EBD9` (l.21)
  - action `#226148` (l.24), action-hover `#1B4F3A` (l.25), action-soft `#D3EBD9` (l.26)
  - secondary `#5B7F55` (l.29), secondary-subtle `#D8E5D5` (l.31)
  - surface `#F5F7F3` (l.45), surface-paper/card `#FFFFFF` (l.46-47), surface-muted `#EDF1EA` (l.49)
  - text-primary `#172B24` (l.51), text-secondary `#56665D` (l.52), text-muted `#46584D` (l.53)
  - forest-50 `#EBF2EC` … forest-900 `#17402C`, forest-950 `#06120C` (l.73-83)
  - sage-500 = `var(--sage-500)` = `#5B7F55` (l.90, alias l.102) ; stone-200 = `#E8E2D9` (l.107, alias l.119) ; ink-900/700/500/300 = `var(--ink-*)` (l.144-147)
  - warm-300 `#F1DAB1` (l.133), border `rgba(23,43,36,.14)` (l.152)
  - success `#3D6038` (l.163), warning `#C89A3B` (l.165), danger `#A8443A` (l.169), info `#4B6B7C` (l.172)
- Rayons : `--lkv-radius-xs` 10px … `-sm` 14, `-md` 18, `-lg` 24, `-xl` 28, `-card` 28, `-sheet` 36, `-nav` 32, `-control` 18, `-button` 20, `-full` 9999px (l.194-207).
- Touch : `--lkv-touch-min` 44px (l.188), comfortable 48px (l.189).
- Verre : `--glass-fill-top` rgba(255,255,255,.13) (l.444), `--glass-base` rgba(12,16,14,.34) (l.449), `--glass-blur` 26px (l.450), blur scale `--blur-sm..2xl` (l.454-459), `--glass-shadow-sheet` (l.554), `--ease-glass` cubic-bezier(.22,1,.36,1) (l.258).
- Ombres : `--card-shadow` / `--card-shadow-elevated` référencées (l.536-537, définition non localisée) ; `--glass-shadow-overlay` (l.553).
- Mode sombre : aucun bloc `[data-theme=dark]` localisé par grep ; l.623 ne mentionne que `prefers-color-scheme` en commentaire. À vérifier avant de s'y fier.

## 2. MobileNavWrapper
- `src/components/mobile-nav/MobileNavWrapper.tsx`. **Pas de constante `HIDE_CHROME_PREFIXES`** (grep vide dans tout src). La logique est inline : `const isNoNavRoute =` (l.25-34).
- Contenu actuel : `startsWith` `/connexion`, `/inscription`, `/checkout` ; `=== '/communaute/reels'` et `startsWith('/communaute/reels/')` ; `=== '/carte-3d'` et `startsWith('/carte-3d')`. Si vrai → seulement `<OfflineBanner/>` (l.36-37).
- Conséquence : `/kit-studio` n'est PAS masqué (barre iOS affichée). Ajouter `/kit-studio` à l.25-34 si la scène doit être plein écran.

## 3. Haptique et barre d'état
- `src/lib/native/haptics.ts` : `export type HapticStyle` (l.3-11) = `light | medium | heavy | rigid | selection | success | warning | error` (**pas de `warn`**). `triggerNativeHaptic(style = "light")` (l.16) ; no-op si `prefers-reduced-motion` (l.19-22) ; plugin `@capacitor/haptics` importé dynamiquement.
- Hook : `src/hooks/useHapticFeedback.ts:6` `useHapticFeedback()` → `{ haptic(style), triggerHaptic(style), vibrate(pattern) }`. `vibrate` ignore le pattern et envoie toujours `"light"`.
- `src/lib/native/status-bar.ts` : `StatusBarTheme = "default" | "compas"` (l.56) ; table `dark`/`color` (l.58-61) : default = dark + `#17402C`, compas = light + `#FBFAF6`.
- Le thème clair de /compas : `statusBarThemeForPath` (l.64-67) renvoie `"compas"` uniquement pour `/compas` et `/compas/*`. Un `/kit-studio` tombe sur `default` (texte clair, fond vert). Ne pas copier ce pattern en le nommant /compas.

## 4. @capacitor/preferences
- Présent : `package.json:119` `"@capacitor/preferences": "^8.0.1"`.
- Usage dans src : **aucun** (`Preferences.` absent). Le persistance client passe par zustand `persist` (localStorage).

## 5. Supabase : materiel_kits, trip_items
- `materiel_kits` : `supabase/migrations/20260825000000_materiel_rebuild.sql:25-39` (id uuid, user_id → auth.users, name, description, season, total_weight_g, is_public, is_favorite, is_trashed, cover_image_url, tags text[], search_vector, created_at/updated_at). RLS activée l.65.
  - select : `auth.uid() = user_id or is_public = true` (l.68-69)
  - insert : `with check (auth.uid() = user_id)` (l.71-72)
  - update : `using/with check (auth.uid() = user_id)` (l.74-75)
  - delete : `using (auth.uid() = user_id)` (l.77-78)
- `trip_items` : `supabase/migrations/20260904050000_trips_core.sql:108-122` (id, trip_id → trips ON DELETE CASCADE, item_name, category, quantity ≥1, weight_grams, is_packed, `status trip_item_status` default 'needed', packed_by, inventory_item_id, affiliate_link_id). **Pas de kit_id ici** ; ajouts ultérieurs possibles dans `20260908020000_trip_items_inventory_fk.sql` et `20260910120000_trip_items_purchase_state.sql` (non lus).
  - RLS activée l.395 ; policies l.482-496 : select `can_read_trip(trip_id)`, insert/update/delete `can_edit_trip(trip_id)` (helpers SQL, définitions non lues).

## 6. scripts/verify/*
Liste : `checklist-recompte.mjs`, `ci_invariants.mjs` (`npm run verify:invariants`), `contrast_palette.mjs`, `icon-names.mjs` (`verify:icons`), `identity_compliance.mjs`, `progression-v2-registry.mjs`, `traveller_privacy.mjs`, `user_traveller_rls_probe.sql`, `verify_capacitor_server.mjs`, `verify_headers.ts`, plus `verify_*.ts` (traces/POI/carte).
- `identity_compliance.mjs` (en-tête l.1-20) : 4 règles. (1) `user_orientation` jamais référencé hors périmètre identity ; (2) aucun token `--role-*` dans src ; (3) fichiers identity limités à la palette ink/sage (pas d'hex hors norme, pas emerald/red) ; (4) appelle `traveller_privacy`. Risque : tout hex/emerald dans `components/identity` ou `features/identity` casse.
- `traveller_privacy.mjs` (en-tête l.3-20) : 7 règles de confinement du profil voyageur (`user_traveller`, `server/traveller`, `server/travellerActions`, `TravellerCard`, `engine/traveller`, logs console, ligne « Papiers »). Risque pour kit-studio : importer `engine/traveller`, `server/traveller*`, ou nommer `user_traveller`/`TravellerCard`.
- Hook `prebuild` (`package.json:74`) exécute `traveller_privacy.mjs` : casse le build si violation.

## 7. Tests
- **Vitest** `vitest.config.ts` : `environment: 'node'` (l.11) ; `testTimeout` 30 s ; `setupFiles` (l.24) : `tests/setup/no-network.ts`, `tests/setup/jsdom-storage.ts` ; `include` (~l.30-35) : `tests/**/*.spec.ts(x)`, `src/**/__tests__/**/*.test.ts(x)`. Exclut `tests/e2e/**`, `tests/visual/` (sauf glass-contract), `tests/ui/**`.
  - jsdom par fichier : pragma en tête `// @vitest-environment jsdom` (exemple `src/contexts/__tests__/AuthContext.isolation.test.tsx:1`).
  - Testing Library présent : `@testing-library/react` ^16.3.3 (package.json:175), `dom` ^10.4.2 (l.174), `user-event` ^14.6.7 (l.176). jsdom ^26.1.0 (l.196).
  - Commande : `npx vitest run src/features/kit-studio` (ou `npm test -- src/features/kit-studio`). Un .tsx hors `__tests__` ne sera PAS collecté.
- **Playwright** `playwright.config.ts` : `testDir './'` (l.34) avec `testMatch` explicite (l.35+) : seuls les specs listés (`scripts/e2e/**`, `tests/e2e/compte-*.spec.ts`, etc.) tournent. **Un nouveau dossier ne sera pas exécuté** sans l'ajouter à `testMatch` ou sans le placer sous `scripts/e2e/`.
  - Projets : `desktop-chromium` (l.67, grepInvert @mobile|@webkit), `mobile-webkit` (l.75, iPhone 14 Pro l.78, grepInvert @local-web), `mobile-chromium` (l.82, viewport 430x932).
  - `baseURL` `process.env.PW_BASE_URL || 'http://localhost:4028'` (l.61). `webServer` (l.93-98) : `npm run start`, url 4028, `reuseExistingServer: true` (si `PW_BASE_URL` absent).
  - Commande : `npx playwright test --project=mobile-webkit scripts/e2e/<dossier>` (après avoir placé/listé le spec). Build préalable requis (`npm run start` sert `.next`).
- `playwright.visual.config.ts` : `testDir ./tests/visual` (l.8). Pas de webServer trouvé dans la sortie grep.
- `playwright.a11y.config.ts` : `testDir ./tests/a11y/e2e` (l.9), `webServer` `npm run dev` sur `localhost:4000` (l.42-45).
- Autres : `playwright.glass.config.ts` (`test:glass`).

## 8. next.config / CSP / budget
- `next.config.mjs` : **pas de `transpilePackages`** (grep vide). CSP via `cspHeader(process.env.CSP_MODE)` (l.162) ; en **Report-Only** par défaut (l.153-160), `CSP_MODE=enforce` pour appliquer.
- `csp.config.mjs` : `script-src` l.28 `'self' 'unsafe-inline' 'unsafe-eval'` + gtm/vercel/hcaptcha ; `img-src` l.31 contient `data: blob: https:` ; `worker-src` l.34 `'self' blob:`. Donc `blob:` workers et images OK.
- Budget : `scripts/perf/check-bundle-budget.mjs`. Lit `app-build-manifest.json` (l.41), somme les chunks de chaque surface, gzip niveau 9 par chunk (l.46). Budgets (l.24-30) : `/` 400 Ko, `/hub` 590, `/compas` 560, `/communaute` 460, `/compte` 460, `/clubs/[id]` 475. **Pas de budget `/kit-studio`** : à ajouter sinon non mesuré. Commande : `npm run perf:budget` (package.json:105, option `--dist`).

## 9. Points d'entrée pour un lien /kit-studio
- Hub : `src/app/hub/page.tsx`, `src/app/hub/[section]/page.tsx`. Sections : `src/features/hub/registry/hubSectionRegistry.ts` (`hubSectionHref` l.105 ; `HUB_DEPART_HREF` l.153 = section `depart` de nature `possession`).
- Matériel : domaine `src/features/materiel/` (components/depart/ dont `DepartChecklist.tsx`, `DepartHeroCard.tsx`, store/ hooks/). **Aucune `src/app/**/materiel/page.tsx`** : le matériel est servi via le hub. Une carte/lien s'insérerait dans `src/features/materiel/components/depart/` ou via la registry hub.
- **Interdit** : tout lien vers `/compas` (clubs runtime en contient, ne pas copier).

## 10. Composants réutilisables
- `EmptyState` : `src/components/ui/EmptyState.tsx:9` (`EmptyStateProps`) ; fonction l.25. Props : `icon?`, `title` (requis), `description?`, `actionLabel?`, `actionHref?`, `onAction?`, `className?`, `compact?`. Variante minimale : `src/components/compte/drawer/memories/EmptyState.tsx:9` (`label` seul).
- Drawers/feuilles du Compte : `src/components/compte/drawer/` : `InvitationsSheet.tsx` + `.css`, `ProfileSettingsSheet.tsx`, `ClubDrawer.tsx` + `.css`, `ProfileDrawerHost.tsx`, `shell/`, `slots/`. Route : `src/app/compte/page.tsx` (layout.tsx à côté).
- Verre (classes/CSS) : `InvitationsSheet.css:100` `backdrop-filter: blur(24px) saturate(160%)` ; `:81` `blur(3px)` ; `src/components/ui/action-pill.css:7` `blur(14px) saturate(1.6)`. Pas de nom de classe unique confirmé pour le verre : copier les tokens `--glass-*` plutôt que la classe.

## 11. zustand / zod
- `zustand` ^5.0.15 (`package.json:163`), `zod` ^4.4.3 (l.162), `next` 15.5.25 (l.147).
- Exemple persist : `src/features/materiel/store/useMaterielOrder.ts:3` (import `persist` from `zustand/middleware`), `create<OrderState>()(persist(...))` l.34-47, `{ name: 'lkdv-materiel-cockpit-order-v3' }` l.47. Même pattern : `useDepartOrder.ts`, `useKitsOrder.ts`.

## Risques / à décider
- `HIDE_CHROME_PREFIXES` n'existe pas : brief à corriger.
- Playwright `testMatch` filtre les specs : nouveaux tests Playwright non exécutés par défaut.
- `traveller_privacy` tourne en `prebuild` : un import ou nom interdit bloque le build.
- Pas de budget bundle pour `/kit-studio`.
- Non vérifié : colonnes ajoutées à `trip_items` par les migrations 2026090x/0910, helpers `can_read_trip`/`can_edit_trip`, `Shadow` tokens complets, mode sombre.
