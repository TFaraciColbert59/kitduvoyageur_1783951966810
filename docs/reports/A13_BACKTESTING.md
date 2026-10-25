# A13 (S8) — Backtesting sur données réelles anonymisées

Plan source : [`docs/superpowers/plans/a13-l3-produit-bout-en-bout.md`](../superpowers/plans/a13-l3-produit-bout-en-bout.md)
(flux S8). Base de **test** uniquement, jamais la production ; aucun secret
commité ; aucune donnée personnelle exportée ; aucune donnée inventée.

## Composants livrés

| Fichier | Rôle |
| --- | --- |
| `scripts/ai/a13_export_backtest.mjs` | Export anonymisé : compteurs réels, jointures prédiction/réel, pseudonymisation SHA-256, JSONL hors dépôt. |
| `scripts/ai/a11_backtest.ts` | Harnais existant, étendu pour relire le **JSONL** (une ligne = un `BacktestSample`) en plus du tableau JSON historique. |
| `tests/adventure-intelligence/a13-backtest-export.spec.ts` | `TEST-A13-BT-01..03` : pseudonymisation, absence de PII, dérivation prédit/réel, relecture JSONL, insuffisance explicite. |

## Utilisation

```bash
# Chaîne de connexion de TEST fournie par l'environnement local uniquement
# (SUPABASE_TEST_DB_URL ou DATABASE_URL) — jamais en dur, jamais la prod.
SUPABASE_TEST_DB_URL='postgresql://…@127.0.0.1:54322/postgres' \
  node scripts/ai/a13_export_backtest.mjs
npx tsx scripts/ai/a11_backtest.ts <chemin JSONL affiché>
```

Garanties d'anonymisation :

- **whitelist stricte** des champs de sortie (`predictedP50Seconds`,
  `predictedP90Seconds`, `actualSeconds`, difficultés, `terrainBucket`, `source`,
  `userHash`, `sessionHash`, `modelVersion`) ;
- `user_id`/`session_id` **jamais exportés bruts** : SHA-256 hex 64 (sel
  optionnel `A13_BACKTEST_HASH_SALT`) ;
- **aucune position GPS**, aucun nom/email, aucune colonne de profil : les
  requêtes ne sélectionnent que durées, difficultés et tags terrain ;
- fichier écrit dans `os.tmpdir()` via `mkdtempSync` — **hors dépôt** — et à
  supprimer après usage (le script imprime la commande de suppression).

Jointures réelles (SELECT uniquement, aucune écriture) :

- `route_predictions` (stratégie `recommended`, A10/S1) × `hike_sessions`
  (même utilisateur, session terminée après le calcul, durée dans
  `[P50×0,5 ; P50×2]`) ;
- `segment_predictions` × `session_segment_passages` (même utilisateur, même
  segment, passage postérieur au calcul) + tags `trail_segments`
  (`sac_scale`, `surface`) pour le bucket terrain (`technical` si sac à dos de
  montagne/rocheux, sinon `ascent`/`descent`/`flat` selon `gain_m − loss_m`).

Sous **40 échantillons**, le script affiche explicitement `DONNÉES INSUFFISANTES`
et produit un échantillon partiel (éventuellement vide) : aucune ligne n'est
fabriquée ni dupliquée.

## Exécution réelle (2026-09-11, base locale de test)

Commande (chaîne de connexion injectée par l'environnement, jamais commitée) :

```text
$env:SUPABASE_TEST_DB_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
node scripts/ai/a13_export_backtest.mjs
```

Sortie réelle intégrale :

```text
=== Export backtesting A13 (anonymisé) ===
Base de test : route_predictions=0, segment_predictions=0, hike_sessions=0, session_segment_passages=0
Lignes lues : route=0, segment=0
Échantillons retenus : route=0, segment=0, total=0
Lignes ignorées (valeurs inexploitables) : route=0, segment=0
Identifiants pseudonymisés (SHA-256) : 0 utilisateurs distincts
DONNÉES INSUFFISANTES : 0 échantillon(s) exploitable(s) < 40 — échantillon partiel, aucune donnée inventée.
Fichier JSONL temporaire (hors dépôt) : C:\Users\Tony\AppData\Local\Temp\lkdv-a13-backtest-6TjSWm\samples.jsonl
Suppression après usage : Remove-Item -LiteralPath "C:\Users\Tony\AppData\Local\Temp\lkdv-a13-backtest-6TjSWm\samples.jsonl"
A13_EXPORT_COUNTS {"counts":{"routeRows":0,"segmentRows":0,"routeSamples":0,"segmentSamples":0,"skippedRouteRows":0,"skippedSegmentRows":0,"samples":0,"usersHashed":0,"minSamples":40,"sufficient":false},"database":{"routePredictions":0,"segmentPredictions":0,"hikeSessions":0,"sessionSegmentPassages":0},"errors":[],"outputPath":"C:\\Users\\Tony\\AppData\\Local\\Temp\\lkdv-a13-backtest-6TjSWm\\samples.jsonl"}
```

Harnais A11 sur l'export (exit code réel **1**) :

```text
$ npx tsx scripts/ai/a11_backtest.ts C:\…\samples.jsonl
Fichier vide — un tableau JSON ou un JSONL d’échantillons BacktestSample est attendu.
EXIT=1
```

Le fichier temporaire a été supprimé après usage (`Test-Path` ⇒ `False`).

## Métriques réelles

| Métrique | Valeur |
| --- | --- |
| Échantillons route (recommandée × sessions) | **0** |
| Échantillons segment (prédictions × passages) | **0** |
| MAE médiane / moyenne / P90 | **non calculables** (0 paire) |
| Couverture P90 | **non calculable** (0 paire) |
| Dérive par bucket | **non calculable** (0 paire) |
| Users pseudonymisés | 0 |

**Aucune métrique n'est inventée** : avec 0 paire réellement jointes, le harnais
refuse un fichier vide (sortie 1, message ci-dessus). Dès que la base de test
contiendra des paires `route_predictions`/`segment_predictions` confrontables à
des sorties réelles, il suffira de relancer les deux commandes pour obtenir MAE
médiane, P90, couverture P90 et dérive par bucket.

## Disponibilité réelle des données (constats)

- **Base locale de test** (migrations a1→a13 appliquées, `.env.local` non
  impliqué) : `route_predictions=0`, `segment_predictions=0`,
  `hike_sessions=0`, `session_segment_passages=0` — un utilisateur de parcours
  complet (génération → session → traitement) n'existe pas encore.
- **Projet Supabase de test de `.env.local`** : `hike_sessions=20` et
  `session_segment_passages=20` via REST, mais **aucune table**
  `route_predictions`/`segment_predictions` (REST `404`) et **aucune RPC**
  `create_adventure_plan_bundle`/`a2_match_track_candidates`/`has_consent`
  (REST `404`) — les migrations adventure-intelligence n'y sont pas appliquées,
  donc aucune prédiction ne peut y être confrontée au réel.
- Aucune chaîne de connexion PostgreSQL n'existe pour ce projet distant dans
  l'environnement local (`.env.local` ne contient que URL + clés API) :
  l'export S8 ne peut donc lire que la base locale de test.

## Tests (TDD)

`TEST-A13-BT-01` : `hashAnonymousId` déterministe (vecteurs SHA-256 connus,
sel compris), absence des identifiants bruts/emails/GPS dans le JSONL,
whitelist exacte des clés, stabilité intra-utilisateur / inter-session.

`TEST-A13-BT-02` : dérivation `route`/`segment` (valeurs P50/P90/réel,
difficulté, bucket `technical|ascent|descent|flat`), comptage des lignes
inexploitables (jamais transformées), sérialisation JSONL puis relecture par
`parseSamplesFile` (harnais A11), rétrocompatibilité tableau JSON et refus d'une
ligne invalide.

`TEST-A13-BT-03` : sous 40 échantillons insuffisance explicite (message
français), 39 vs 40 (seuil), `usersHashed`, et rapport d'export contenant les
compteurs réels de la base et le chemin du fichier.

## Limites / déférés

- `feltDifficulty` reste `null` : la difficulté ressentie (`perceived_difficulty`)
  n'est pas reliée de façon fiable à une paire prédiction/passage ; aucune
  conversion d'échelle hasardeuse n'est faite.
- La dérive par bucket n'exploite que les échantillons segment (les échantillons
  route n'ont pas de bucket terrain).
- Un backtest pluriannuel (biais saisonniers) nécessitera un volume de sessions
  réelles traitées ; aucun historique n'est encore disponible.
