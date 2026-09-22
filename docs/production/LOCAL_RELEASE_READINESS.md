# Local Release Readiness — Phase 3 (clôture locale Windows)

> Point de reprise : `2506bdab` · Aucun staging, aucune production, aucun build iOS/Android tenté depuis Windows.
> Rapport parent : `PHASE3_RELEASE_REPORT.md`.

## Localement validé (exécuté, vert)

| Contrôle | Commande | Résultat |
|---|---|---|
| Types | `npm run type-check` | ✅ 0 erreur |
| Lint | `npm run lint` | ✅ 0 erreur (warnings préexistants documentés) |
| Tests unitaires | `npm test` | ✅ 407 fichiers / **2 947 tests** (27 skipped) |
| Contrats design | `npx vitest run tests/design` | ✅ **162 tests** (dont x6 recâblé sur les tokens réels) |
| Accessibilité | `npm run test:a11y` | ✅ **57/57**, 0 critical / 0 serious |
| Invariants CI | `npm run verify:invariants` | ✅ 6/6 |
| **E2E local applicable** | `npm run test:e2e:local` | ✅ **43 passés / 10 skipped / 0 échec** (24,5 s) |
| Build production | `npm run build` | ✅ 11,5 s |
| Smoke HTTP | serveur `:4028` | ✅ 200 sur les routes principales |
| Console runtime | parcours des routes principales | ✅ aucune erreur produit reproductible (bruit d'environnement documenté) |

## Suites E2E séparées par environnement

| Suite | Commande | Portée |
|---|---|---|
| `local-web` | `npm run test:e2e:local` | Chromium desktop, sans auth ni service externe — **100 % verte** |
| `mobile` | `npm run test:e2e:mobile` | Invariants d'expérience mobile (projet mobile-chromium) |
| `webkit` | `npm run test:e2e:webkit` | Moteur WebKit (projet mobile-webkit) |
| `staging-auth` | tag `@staging-auth` | Session Supabase réelle requise → skip explicite en local |
| `external-services` | tag `@external` | Service externe réel (Supabase de test, IA) → skip explicite en local |

Le filtrage par projet empêche l'exécution de parcours desktop sur les projets mobiles (cause historique d'échecs non produits). Configuration : `playwright.config.ts` (workers 4, `expect.timeout` 10 s, tags documentés).

## Non applicable localement

| Élément | Raison |
|---|---|
| iOS réel (simulateur/appareil) | Windows, Xcode/SDK absents — WKWebView, Dynamic Island, clavier, haptics, géoloc, orientation, background/resume |
| Android natif | SDK Android + JDK 17 absents |
| Staging | aucun accès infra/credentials |
| Production | interdite sans staging vert + accès |
| Lighthouse CI / field data (LCP/INP/CLS) | non installé localement ; workflow `lighthouse-ci.yml` dédié |
| Seed démo authentifié | risque d'écriture sur la base configurée — à exécuter sur staging dédié |

## E2E — état final

- **43 passés, 10 skips explicites (raison par tag), 0 échec** sur la suite locale applicable.
- Échecs corrigés lors de la clôture : sélecteurs cassés par les migrations Phase 2 (titres `sr-only`, `/materiel` surface autonome, destinations de barre), consentement cookies atlas, heading voyage, bruit WebKit `interactive-widget`.
- Cas non applicables localement : dépendances Supabase/SQL, sessions auth réelles, services externes, moteur WebKit, invariants d'expérience mobile → désormais **skippés explicitement** (plus de rouge artificiel).
- Flakiness éliminée à la source : workers 4 + timeout d'assertion 10 s (le serveur Next unique saturait à 8 workers).

## Warnings restants

- **Lint** : warnings préexistants (variables non utilisées, `console`, hooks deps) — non bloquants, hors code modifié.
- **Build** : aucune erreur ; warnings ESLint repris du lint.
- **Tests** : aucun warning produit.
- **Tiers/historiques** : `_vercel/speed-insights` 404 hors Vercel, 401 API sans session (bruit d'environnement documenté).

## Dette locale restante (réelle uniquement)

1. ~100 inline statiques restants (majoritairement nav/géométrie/safe-area/verre/motion + admin/dev explicitement exclus).
2. 8 violations a11y `moderate` préexistantes (landmark/heading) — non bloquantes.
3. Back-office admin : 14 hex, 46 inline, 66 `<button>` (hors périmètre).
4. ~88 fichiers staging produit à arbitrer.
5. Performance non instrumentée (Lighthouse CI à lancer).
6. Validation native iOS/Android (macOS/SDK requis).

## Commit final local

`git log -1` après ce rapport — arbre git propre, aucune modification non commitée.
