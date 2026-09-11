# A10 (10.11) — Montage UI + E2E Adventure Intelligence — Rapport

Date : 2026-09-11 · Worktree : `worktrees/ai-finalization` · Branche : `audit/adventure-intelligence`
Périmètre : spec a10 lot 10.11 (montage hub/cockpit + E2E), sans toucher aux
zones du chantier parallèle.

## 1. Ancre choisie et pourquoi

**Ancre : slot serveur `adventureIntelligence` de `HubShell`**
(`src/features/hub/components/HubShell.tsx`), alimenté par
`src/app/hub/layout.tsx`, rendu **à la racine `/hub` uniquement**
(`pathname === HUB_HOME_HREF`).

Justification :

- Les 3 fichiers interdits par le chantier parallèle ne sont pas touchés
  (`src/app/hub/[section]/page.tsx`, `HubRealtimeRefresh.tsx`,
  `src/features/hub/mobile/export*`).
- Les menus bento (`SortieMenu`/`PossessionMenu`/`CollectifMenu`) sont
  laissés intacts : leur layout plein écran (`h-[calc(100%-24px)] min-h-[680px]`)
  n'est pas dégradé ; le bloc est ajouté **après** le contenu, dans le
  `<main>` scrollable du shell desktop et après le conteneur plein écran
  du shell mobile.
- Le compteur `/hub` → `hubSectionFromPathname` renvoie `null` pour tout
  segment inconnu (`/hub/nouveau`) : l'égalité stricte `HUB_HOME_HREF`
  évite de polluer le wizard.
- Le slot est un `ReactNode` rendu par le serveur (pattern RSC → client
  component), il n'y a donc aucune donnée re-fetchée côté client.
- Aucune modification du catalogue de widgets (`widgetCatalog.ts`) : un
  nouveau widget aurait été invisible (le catalogue n'est consommé que par
  `HubOverviewSortie`, orphelin) et aurait décalé les compteurs de tests.

## 2. Flux de données (réel, zéro fixture)

```
/app/hub/layout.tsx (RSC)
  ├─ getHubAdventureData()                    (existant, cache React)
  └─ getAdventureIntelligence()               (NOUVEAU, cache React)
       ├─ getHubAdventureData()               (cache hit, mêmes requêtes)
       ├─ currentAdventureFeatureFlags()      (RPC current_feature_flags)
       ├─ adventure_plans (RLS owner/collaborateur, 1 plus récent)
       │    ├─ adventure_plan_decisions status='proposed'
       │    └─ route_predictions (plan_id, + récent computed_at)
       └─ listNearbyTerrainReports + createSupabaseTerrainReportsClient
          (module serveur A5 existant) UNIQUEMENT si terrain_live === true
  → <AdventureIntelligenceHub cockpit sections sectionHrefs terrain* />
       ├─ useOfflineManager (pattern src/features/hiking/offline)
       ├─ buildCockpitView({...cockpit, offline})   (domaine pur)
       ├─ <AdventureHubSection view sections … />   (existant A7)
       └─ <TerrainReportsList … /> si terrainEnabled
```

- **Mapping pur** : `src/features/adventure-intelligence/domain/cockpitMounting.ts`
  projette les lignes réelles (plan, prédiction, décisions, signalements)
  vers `CockpitInput`. Donnée absente ⇒ `null`/vide, jamais de valeur
  inventée (ETA uniquement depuis `route_predictions`, difficulté depuis
  `personal_difficulty`, confiance via `confidenceSchema`, sinon
  `COLD_CONFIDENCE`).
- **Liens rapides réels** : construits côté serveur depuis
  `hubSectionRegistry` + `hubSectionHref` (sortie : Itinéraire/Sécurité/
  Checklist/Journal ; possession : Kits/Préparation/Départ/À ne pas
  oublier ; collectif : Groupe/Invitations). Aucun littéral d'URL hors
  registre (règle H-D85 n°13).
- **États vides gracieux** : plan absent ⇒ héro « Aucune aventure »,
  `view.indicators = []` → « Aucune donnée disponible pour le moment. »,
  décisions vides → « Aucune décision en attente. ». Toute erreur du
  chargeur retombe sur `emptyIntelligence()` (jamais de 500).

## 3. Gating du flag `terrain_live`

- `getAdventureIntelligence` **n'exécute aucune requête Terrain** si
  `flags.terrain_live !== true` (else `[]`), et `terrainReports` ne
  contient jamais de signalement quand le flag est inactif.
- `buildHubCockpitInput` applique lui aussi le gate (défense en
  profondeur) : flag inactif ⇒ `liveReports = []`.
- L'UI ne rend la section « Conditions terrain » (et la
  `TerrainReportsList`) que si `terrainEnabled === true` ; sinon **rien**
  n'est rendu (aucun titre, aucune liste).
- Défaut fail-safe : RPC absente/en échec ⇒ flags A3, `terrain_live`
  traité comme inactif (A9_FLAGS).
- Vérifié par `TEST-A10-HUB-01` (gate + plafond 5) et
  `TEST-A10-E2E-03` (DOM : `terrain-conditions` count 0).

## 4. E2E — `scripts/e2e/adventure-intelligence.spec.ts`

Anonyme-sûr (même protocole consentement que `voyage.spec.ts`, aucune
session requise) ; charge `/hub` :

| Test | Assertions |
| --- | --- |
| `TEST-A10-E2E-01` | `/hub` : `data-testid="adventure-intelligence"` visible, heading « Cockpit aventure » visible, état vide OU indicateurs réels visibles, **zéro erreur console** (hors bruit ressources : `Failed to load resource`, favicon, `net::ERR_`, DevTools) et zéro `pageerror`. |
| `TEST-A10-E2E-02` | Focus clavier : Tab jusqu'à un contrôle de la section (liens de section réels), puis indicateur de focus visible (`box-shadow` ring ou outline ≠ none). |
| `TEST-A10-E2E-03` | `terrain_live` inactif par défaut ⇒ `terrain-conditions` absent, heading « Conditions terrain » absent. |

CI : `.github/workflows/ci.yml` Gate 5 →
`npx playwright test scripts/e2e/voyage.spec.ts scripts/e2e/adventure-intelligence.spec.ts`.

## 5. Design & accessibilité (preuves)

- Composants montés inchangés (`AdventureHubSection`, `OfflineBanner`,
  `TerrainReportsList`) : tokens `var(--lkv-*)` uniquement, rayons
  `var(--lkv-radius-card)` / `rounded-2xl`, `shadow-sm` natifs, animations
  `transform/opacity` ≤ 220 ms avec `useReducedMotion`, cibles
  `min-h-[44px]`/`min-h-[64px]`, `role="status"`, `aria-live="polite"`,
  `aria-label` sur les groupes.
- `OfflineBanner` A7 monté via le cockpit (état réseau réel
  `useOfflineManager` = pattern `src/features/hiking/offline`, + compteur
  d'actions en attente), non bloquant. Anti-hydratation : premier rendu
  neutre identique SSR/client puis état réel (zéro CLS, zéro mismatch).
- Garde-fous U-D60→U-D64 et H-D85 : verts (`tests/design/*`).
- Aucune couleur `#E4501C`, aucun `rgba(0,0,0)`, aucun dialogue natif,
  aucun rayon/ombre littéral dans les nouveaux fichiers.

## 6. Tests

- `tests/adventure-intelligence/hub-mounting.spec.ts` (`TEST-A10-HUB-01..06`) :
  gating flag + plafond sans mutation, plan sans invention, confiance
  invalide → froide, prédiction/stratégie/allure bornées, décisions vides
  écartées, état vide gracieux, données complètes (héro, ETA P50/P90,
  décision prioritaire, alertes triées).
- Gates locaux exécutés : `npx vitest run tests/adventure-intelligence`
  (51 fichiers / 325 tests ✓), `npm run type-check` ✓, `npm run lint` ✓
  (0 erreur), `npm run test` complet (250 fichiers / 1846 tests ✓),
  `npx tsc` ciblé sur le spec E2E ✓. Playwright non exécuté (consigne).

## 7. Concerns / limites

1. **Double indicateur hors-ligne** : le `OfflineBanner` A7 (pilule inline)
   peut coexister avec la bannière globale `mobile-nav` (H8). Non bloquant,
   mais à arbitrer en a11 (masquer la pilule quand la bannière globale est
   visible ou fusionner).
2. **Décisions proposées** : les boutons de décision exigent un handler ;
   aucune API de résolution de décision n'existe dans ce lot, ils restent
   donc inertes (`onDecide` non fourni). À brancher en a11.
3. **Chargeur sur toutes les routes hub** : le layout appelle
   `getAdventureIntelligence` aussi pour les sections (non rendu hors
   racine). Requêtes indexées et cachées par requête ; déplacer le fetch
   dans un layout racine dédié si la charge devient mesurable.
4. **Prédictions** : montrées uniquement si un `adventure_plan` existe
   (pas de prédiction orpheline) ; `nextCriticalSegment`/`aheadBehind`
   restent `null` faute de source réelle persistée (pas d'invention),
   `context_hash uniform_from_blueprint` (limite a11 connue).
5. **E2E** : filtre de bruit console limité aux erreurs de ressources
   externes ; à resserrer quand l'environnement CI est entièrement seedé.
