# Baseline « Instant-Feel » — Étape 0 (commit 08055da3 + instrumentation de mesure)

Capturée le 2026-09-15 sur la branche `perf/instant-feel`, point de départ du chantier
performance. **Aucune optimisation appliquée** : cette baseline est la référence « avant »
de chaque lot P0→P5 (un chiffre avant/après par lot).

## 1. Bundle de production (Next.js 15.5.25, ANALYZE=true)

Build complet : 273 pages statiques générées. Rapports analyseur : `.next/analyze/client.html` (régénérable via `npm run analyze`, non commité).

| Route | Page JS | First Load JS | Verdict |
|---|---:|---:|---|
| Partagé (272 routes) | — | **104 kB** | cible P1-3 : ≤ 85 kB |
| Middleware | — | **98.5 kB** | cible P1-3 |
| `/hub/[section]` | **177 kB** | **563 kB** | 🔴 pire goulot (L'audit mesurait 542 kB : le commit export mobile a aggravé) |
| `/voyages/[slug]` | 131 kB | 476 kB | 🔴 |
| `/pays/[code]` (SSG ×196) | 36.6 kB | 422 kB | 🟠 |
| `/hub/nouveau` | 35.1 kB | 410 kB | 🟠 |
| `/compte` | 26.1 kB | 382 kB | 🟠 |
| `/communaute` | 23 kB | 377 kB | 🟠 |
| `/messagerie` | 27.4 kB | 368 kB | 🟠 |
| `/explorer` | 18.2 kB | 366 kB | 🟠 |
| `/randonnee-active` | 37.6 kB | 363 kB | 🟠 |
| `/clubs/[id]` | 18 kB | 363 kB | 🟠 |
| `/carnets` | 15.5 kB | 356 kB | 🟡 |
| `/hub` | 13.5 kB | 324 kB | 🟡 |

Chunks partagés : `1255` 46 kB + `4bd1b696` 54.2 kB + autres 3.33 kB.

## 2. TTFB `/hub` — production locale, Supabase distant (5 runs, p50)

Environnement : Windows local, serveur `next start` port 4028, Supabase cloud (EU).
Le chiffre représente le **temps de rendu serveur** (+1 RTT local), pas la latence réseau prod.

| Profil | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | p50 |
|---|---:|---:|---:|---:|---:|---:|
| Anonyme (repli possession) | 209 | 172 | 167 | 116 | 107 | **167 ms** |
| Authentifié sortie `y-long-group` (cascade complète + météo) | 1245 | 892 | 856 | 1012 | 964 | **964 ms** |
| Session B (redémarrage serveur) — anonyme | 212 | 142 | 97 | 112 | 84 | **112 ms** |
| Session B — authentifié sortie | 1161 | 880 | 870 | 864 | 783 | **870 ms** |

## 3. Trace cascade SSR (`LKDV_TRACE_SSR=1`, production, p50 authentifié)

Source : `src/lib/perf/ssrTrace.ts` (activée par env `LKDV_TRACE_SSR=1`, no-op sinon).

```
layout.adventure (getHubAdventureDataInner) ......... ~800 ms
  ├─ auth.getUser ................................... ~46 ms
  ├─ lists (N+1 groupes + possession + trips) ....... ~390 ms  ← P0-2
  ├─ trip.full (getTripBySlug, 10 tables) ........... ~210 ms  ← P0-2/P2-2
  └─ trip.enrich (crew+hiking[MÉTÉO]+checklist+imgs) ~130 ms  ← P0-2 (météo hors chemin critique)
layout.intelligence (SÉQUENTIEL après adventure) .... ~180 ms  ← P0-2
layout.stats (getHubTripStats via cache React) ...... ~0 ms
```

Somme cohérente avec le TTFB mesuré (~1050 ms).

## 4. Suites de vérification (état d'entrée)

| Suite | Résultat | Notes |
|---|---|---|
| `test:visual` (93 tests × 3 breakpoints) | **83 passed / 0 failed / 10 skipped** | 0 diff. Références ré-ancrées : cookie d'aventure active par test (protocole a11y), unification basculée sur `prepareVisualPage`, masques nommés sur données live (météo pays, hero photo Unsplash) |
| `test` (vitest) | **2755 passed / 1 timeout flaky** (`chantier-z5` Z-D32.1, passe en 0,6 s isolé) | |
| `type-check` | ✅ | |
| `test:e2e` | **49 passed / 18 failed — pré-existants** | Détail ci-dessous |
| `test:a11y` (57 scans axe) | **57 passed / 0 failed** | zéro violation critical/serious sur les surfaces hub |
| `verify:invariants` + `verify:icons` | ✅ | |
| `ops:healthcheck` | N/A environnement | attend un Supabase local (127.0.0.1:54322) non démarré sur cette machine |

### Échecs e2e pré-existants (18) — à ne PAS corriger dans ce chantier perf

- **Bug serveur réel** : `hubSectionHref` lance `Section groupe incompatible avec la nature
  possession` (`hubSectionRegistry.ts:109` via `HubWidgets.tsx:79`) sur `/hub` en repli
  possession → casse 6 tests (voyage.spec, materiel.spec). Non-perf, à signaler.
- `getByTestId('adventure-intelligence')` résout **2 éléments** sur `/hub` — preuve e2e du
  double-arbre desktop+mobile monté (constat C-05).
- `voyage.spec.ts:99` : `ReferenceError: createBtn is not defined` (bug du code de test).
- axe `/hub` (materiel.spec e2e) : 222 violations modérées (landmarks dupliqués,
  `user-scalable=no`) — couvertes à 0 par la suite a11y officielle (57/57) qui filtre
  critical/serious ; divergence de périmètre entre les deux suites.

## 5. Infrastructure de mesure ajoutée (Étape 0)

- `src/lib/perf/ssrTrace.ts` — traceur `traceStage()` gated par `LKDV_TRACE_SSR=1`
  (console.error car `removeConsole` retire log/info du bundle prod).
- Instrumentation : `getHubAdventureDataInner` (auth/lists/trip.full/trip.enrich) et
  `hub/layout.tsx` (adventure/intelligence/stats). Zéro changement de comportement.
- `PaysWeatherCard` + `PaysHeroOverview` : attribut `data-visual-mask` (données live) —
  invisible, conforme au protocole Y0.5 des masques nommés.
- `tests/visual/voyages-y-profiles-visual.spec.ts` : cookie d'aventure active par profil
  (y-day-solo / y-long-group / y-exped-solo) — captures déterministes.
- `tests/visual/unification-visual.spec.ts` : bascule sur `prepareVisualPage` (consentement,
  horloge figée, transitions gelées, masques).

## 6. Limites connues de la baseline

- Machine Windows locale, sans throttle CPU ni latence réseau simulée : les chiffres TTFB
  sont inférieurs au réel 4G ; la hiérarchie relative (possession 6× plus rapide que la
  cascade sortie) est le signal fiable.
- Photos distantes (Unsplash/flagcdn) exclues de la baseline pixel via masques nommés.
- Le seed `Y0.4` (`npm run seed:y`) est requis avant toute re-capture visuelle.
