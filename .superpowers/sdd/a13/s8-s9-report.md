# A13 (S8 + S9) — Backtesting réel anonymisé & E2E certification bout-en-bout

Branche : `audit/adventure-intelligence` (worktree `ai-finalization`). Plan source :
`docs/superpowers/plans/a13-l3-produit-bout-en-bout.md` (flux S8 et S9).
Environnement : Supabase **local** de test (schéma a1→a13 appliqué) + projet Supabase de
test de `.env.local`. Jamais la production ; aucun secret commité ; aucun flag modifié ;
aucune donnée inventée ; `src/app/hub/[section]/page.tsx` non touché.

## Commits

| Commit | Sujet | Périmètre |
| --- | --- | --- |
| `3e83498b` | `feat(ai): A13 S8 export backtesting anonymise et harnais JSONL (SHA-256, compteurs reels, TEST-A13-BT)` | script + déclarations + harnais A11 + tests + rapport S8 |
| `e649ad1d` | `feat(e2e): A13 S9 parcours certification phrase-plan-cockpit-offline-retour (spec Playwright, gate CI)` | spec E2E + gate 5 CI |
| ce commit | `docs(a13): rapport S8 backtesting anonymise et S9 E2E certification` | ce rapport |

## A. S8 — Export backtesting anonymisé

### Livré

- `scripts/ai/a13_export_backtest.mjs` : connexion PostgreSQL de test **via
  `SUPABASE_TEST_DB_URL` ou `DATABASE_URL` uniquement** (erreur explicite sinon, aucun
  défaut en dur, la chaîne n'est jamais affichée), compteurs réels des 4 tables,
  jointures `route_predictions` (stratégie `recommended`) × `hike_sessions` et
  `segment_predictions` × `session_segment_passages` (+ tags `trail_segments` pour le
  bucket), pseudonymisation **SHA-256** des `user_id`/`session_id` (sel optionnel
  `A13_BACKTEST_HASH_SALT`), whitelist stricte de sortie, JSONL écrit via `mkdtempSync`
  dans `os.tmpdir()` — **hors dépôt**, commande de suppression imprimée.
- `scripts/ai/a13_export_backtest.d.mts` : typage strict du module pour `tsc`.
- `scripts/ai/a11_backtest.ts` : `parseSamplesFile` exporté et étendu au **JSONL** (une
  ligne = un `BacktestSample`) tout en conservant le tableau JSON historique ; une ligne
  illisible/invalide est refusée avec son numéro (jamais ignorée silencieusement).
- `tests/adventure-intelligence/a13-backtest-export.spec.ts` : `TEST-A13-BT-01..03`.
- `docs/reports/A13_BACKTESTING.md` : rapport S8 complet (usage, seuils, exécution,
  constats de disponibilité, limites).

### Exécution réelle (base locale de test, schéma complet)

```text
$env:SUPABASE_TEST_DB_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
node scripts/ai/a13_export_backtest.mjs
=== Export backtesting A13 (anonymisé) ===
Base de test : route_predictions=0, segment_predictions=0, hike_sessions=0, session_segment_passages=0
Lignes lues : route=0, segment=0
Échantillons retenus : route=0, segment=0, total=0
Lignes ignorées (valeurs inexploitables) : route=0, segment=0
Identifiants pseudonymisés (SHA-256) : 0 utilisateurs distincts
DONNÉES INSUFFISANTES : 0 échantillon(s) exploitable(s) < 40 — échantillon partiel, aucune donnée inventée.
Fichier JSONL temporaire (hors dépôt) : C:\Users\Tony\AppData\Local\Temp\lkdv-a13-backtest-6TjSWm\samples.jsonl
A13_EXPORT_COUNTS {"counts":{...,"samples":0,"usersHashed":0,"minSamples":40,"sufficient":false},"database":{"routePredictions":0,"segmentPredictions":0,"hikeSessions":0,"sessionSegmentPassages":0},"errors":[],"outputPath":"C:\\…\\samples.jsonl"}

$ npx tsx scripts/ai/a11_backtest.ts C:\…\samples.jsonl
Fichier vide — un tableau JSON ou un JSONL d’échantillons BacktestSample est attendu.
EXIT=1
```

Fichier temporaire supprimé après usage (`Test-Path` ⇒ `False`).

### Métriques réelles

| Métrique | Valeur |
| --- | --- |
| Échantillons route / segment | **0 / 0** (0 paire réelle joignable) |
| MAE médiane, MAE moyenne, P90, couverture P90, dérive par bucket | **non calculables** |
| Utilisateurs pseudonymisés | 0 |

Aucune métrique n'est inventée. Le harnais refuse honnêtement un export vide (sortie 1).

### Disponibilité des données (point d'attention majeur)

- **Base locale de test** (celle qui porte le schéma a1→a13) : les 4 tables sont vides
  (`route_predictions=0`, `segment_predictions=0`, `hike_sessions=0`,
  `session_segment_passages=0`) — aucun parcours réel génération→session→traitement n'a
  encore alimenté cette base.
- **Projet de test de `.env.local`** : `hike_sessions` et `session_segment_passages`
  existent (20 lignes chacun via REST) mais **les migrations a2/a10/a13 n'y sont pas
  appliquées** : `route_predictions`/`segment_predictions` ⇒ REST `404`,
  `create_adventure_plan_bundle`/`a2_match_track_candidates`/`has_active_consent` ⇒
  RPC `404`. Aucune prédiction ne peut donc y être confrontée au réel, et aucune chaîne
  de connexion PostgreSQL de ce projet n'existe dans l'environnement local
  (`.env.local` = URL + clés API). L'export S8 ne peut lire que la base locale.
- Dès qu'une base de test contiendra ≥ 40 paires, relancer les deux commandes produit
  MAE médiane, P90, couverture et dérive par bucket (aucun code à changer).

### Tests S8

`TEST-A13-BT-01` pseudonymisation (vecteurs SHA-256 connus, sel), absence d'identifiants
bruts/emails/GPS dans le JSONL, whitelist de clés, stabilité intra-user/inter-session.
`TEST-A13-BT-02` dérivation route/segment (P50/P90/réel, difficulté, bucket
`technical|ascent|descent|flat`), comptage des lignes invalides, sérialisation JSONL +
relecture `parseSamplesFile`, rétrocompatibilité tableau JSON, refus d'une ligne invalide.
`TEST-A13-BT-03` insuffisance explicite < 40 (0 et 39 vs 40), `usersHashed`, rapport avec
compteurs réels et chemin du fichier — jamais de donnée inventée.

## B. S9 — E2E certification du parcours complet

### Livré

`scripts/e2e/a13-journey.spec.ts` (`TEST-A13-E2E-01`), sans fixture :

1. utilisateur réel créé via l'API admin du projet de test (`email_confirm: true`) ;
2. connexion par l'écran `/connexion` (cookies `@supabase/ssr`) ;
3. phrase (≥ 10 caractères) → `POST /api/adventure/generate` : **3 candidats +
   comparaison** (route/dates/hébergements partagés), **ETA P50 ≤ P90** par candidat ;
4. `POST /api/adventure/[id]/select` → version supérieure confirmée par
   `GET /api/adventure/[id]` ;
5. cockpit : `POST /api/adventure/[id]/cockpit` avec tracking GPS simulé (≥ 250 m) →
   recalcul réel (`position_250m`), version courante ;
6. `GET /api/adventure/[id]/offline-pack` : pack récupérable (`pack.adventureId`,
   `pack.plan.id`) ;
7. coupure → reconnexion : `POST /api/adventure/offline/sync` rejoué deux fois →
   `applied` puis **`duplicate`** (idempotence stricte) ;
8. retour d'expérience : `POST /api/hike-sessions` (session issue de la file
   hors-ligne) puis `GET /api/hike-sessions` la liste ;
9. cockpit **visible** sur `/randonnee-active?adventureId=…` (bouton
   « Ouvrir le cockpit » + dialogue).
10. nettoyage dans `finally` : suppression de l'utilisateur via l'API admin (cascades
    `auth.users`), même en cas d'échec.

CI : spec ajoutée à la commande du **Gate 5** existant (`.github/workflows/ci.yml`, step
conditionnel `LKDV_E2E_ENABLED`) avec injection de
`SUPABASE_SERVICE_ROLE_KEY: secrets.SUPABASE_TEST_SERVICE_ROLE_KEY` (projet de test ;
secret absent ⇒ scénario ignoré).

### Exécution réelle

**1) Projet de test de `.env.local` (webserver `npm run start` du config existant)** :
blocage **de l'environnement**, pas du parcours. Sortie exacte :

```text
[WebServer] [adventure/generate] erreur inattendue: Could not find the table
'public.adventure_generation_requests' in the schema cache
Error: {"error":"Erreur serveur"}
Expected: 201
Received: 500
```

Cause : le projet de test ne porte pas les migrations a2/a10/a13 (REST 404 sur
`adventure_plans`, `route_predictions`, RPC `create_adventure_plan_bundle`, etc.).
Il faut y appliquer les migrations additives (`supabase db push --db-url …`) pour
activer cette porte CI ; aucun code applicatif n'est en cause.

**2) Base locale de test (schéma complet)** : parcours vert.

```text
$env:PW_BASE_URL='http://localhost:4028'   # serveur Next build avec l'env local de test
npx playwright test scripts/e2e/a13-journey.spec.ts
  ok 1 … TEST-A13-E2E-01: phrase → plan → sélection → cockpit → offline → reconnexion → retour
  1 passed (2.3s)
```

Nettoyage vérifié en base après le run (compteurs revenus à l'état initial) :

```text
adventure_plans=0, adventure_plan_versions=0, route_predictions=0,
hike_sessions=0, offline_sync_operations=0, carnets=0, auth_users=23 (inchangé)
```

### Points d'attention S9

- Le scénario exige `SUPABASE_SERVICE_ROLE_KEY` (création/nettoyage utilisateur) :
  absent, il est `skip` explicitement — jamais de données laissées derrière.
- L'ETA du scénario local passe par le repli explicite `uniform_from_blueprint`
  (aucun `trail_segments` dans la base locale) ; les bornes P50 ≤ P90 restent réelles.
  Le chemin map-matché est couvert par les tests S1.
- En CI, la porte ne sera verte qu'une fois les migrations a2/a10/a13 présentes sur le
  projet de test (secret `SUPABASE_TEST_SERVICE_ROLE_KEY` requis).

## C. Vérifications finales

| Vérification | Résultat |
| --- | --- |
| `npx vitest run tests/adventure-intelligence/a13-backtest-export.spec.ts` | 3 passed |
| `npx vitest run tests/adventure-intelligence/backtest-harness.spec.ts` | 3 passed (rétrocompatibilité) |
| `npm run test` | 277 fichiers passés / 1 ignoré ; **1984 tests passés / 6 ignorés** |
| `npm run type-check` | exit 0 |
| `npm run lint` | exit 0 (warnings préexistants uniquement) |
| `node scripts/verify/ci_invariants.mjs` | SUCCÈS |
| E2E local `TEST-A13-E2E-01` | 1 passed (2.3 s), nettoyage vérifié |
| Export réel + harnais A11 | 0 échantillon (compteurs réels), exit 1 explicite |
| Fichier d'export | supprimé après usage (hors dépôt) |

## D. Écarts / déférés

- **Données réelles insuffisantes** : aucune paire prédiction/réel n'existe encore
  (0 route, 0 segment) ; le rapport S8 chiffre cet état au lieu d'inventer. Aucun seuil
  de promotion de modèle ne peut être validé tant que la base de test ne reçoit pas de
  sessions traitées réelles.
- `feltDifficulty` reste `null` (échelle ressentie 0..10 non reliée sans ambiguïté à une
  paire prédiction/passage) — aucune conversion hasardeuse.
- Le projet de test distant n'a pas les migrations adventure-intelligence : la porte CI
  Gate 5 échouera tant que ce n'est pas appliqué (hors périmètre de ce flux, contrainte
  « pas de push distant »).
