# A10 — Validation BDD (Étape 0-B) — CERTIFIÉE

Date : 2026-09-11 · Environnement : Docker Desktop + Supabase local (PostgreSQL 17.6.1.141)
Dump prod : **schema-only**, aucune donnée. Aucune écriture production.

## Verdict : Étape 0 B — ✅ CERTIFIÉE (install + upgrade)

```text
[certify] Migrations post-baseline : 36 fichiers (strictes, ledger inscrit après succès)
  [ok]   ledger complet (179 versions, 0 en attente)
[certify] pgTAP — runner TAP réel (supabase test db)     → Result: PASS
[certify] F1 — policies larges (bloquant)                → ok (0 policy large, vue présente)
[certify] EXPLAIN (ANALYZE, BUFFERS) bloquant < 500 ms   → 19 ms
[certify] SUCCÈS — mode install certifié (0 échec, 0 migration en attente).
[certify] SUCCÈS — mode upgrade certifié (0 échec, 0 migration en attente).
```

## Méthodologie verrouillée

- Stratégie **baseline + post-baseline** : snapshot schema-only prod au cutoff `20260911120000`
  (`supabase/baseline/`), ledger des 143 versions prod, `auth_integration.sql` (trigger
  `auth.users`), `grants.sql` (GRANTs + default privileges).
- Harnais unique strict : `pwsh scripts/db/install-from-baseline.ps1 -Mode install|upgrade` —
  `ON_ERROR_STOP=1` partout, **ledger inscrit après chaque application réussie**, **runner TAP
  réel** (`supabase test db`), **F1 et EXPLAIN bloquants**, contrôle « 0 migration en attente ».
- **Aucune quarantaine** : toutes les suites pgTAP sont actives et vertes.

## Suites pgTAP (toutes vertes — runner TAP)

a1_domain_security · a2_segment_processing · a10_session_lease · a10_consent_enforcement ·
attributions (7/7) · conservation (8/8) · field_proof · lineage (24/24) · messaging_security (15/15) ·
security_lignees (10/10).

## Défauts réels corrigés pendant la validation

1. Claim de sessions : `LIMIT` non appliqué (sous-requête aplatie) → CTE `MATERIALIZED`.
2. Anti-cycle filiation bloquait tout fork → `NEW.id = ANY(ancestors)`.
3. Immuabilité filiation contournable (trigger limité à `forked_from`) → trigger élargi.
4. Refresh matviews `CONCURRENTLY` impossible sur base neuve → repli non concurrent.
5. Drift GRANTs messagerie (`anon` pouvait exécuter 2 RPC) → révocations réappliquées.
6. `kit_trust_scores` : LATERAL endurance non corrélé → doublons `kit_id` ; agrégation
   corrigée (`GROUP BY k.id`), une seule ligne par kit garantie, index unique créé sans warning.
7. `kit_attributions` : réimplémenté proprement en **migration additive post-baseline**
   (`20260911400000`) — tables, contraintes, index, RPC, RLS, grants/révocations, cascades ;
   suites `attributions` et `security_lignees` réactivées et vertes (la migration gelée reste
   gelée, l'historique prod n'est pas modifié).
8. Correction d'assertions de tests erronées (`USING` RLS ne lève pas d'exception ;
   vérifications hors rôle restreint ; IDs de fixtures anti-collision ; casts pgTAP).

## Hygiène

- Dump schema-only hors dépôt, supprimé après usage ; **aucune donnée personnelle en Git**.
- Flags de domaine OFF ; aucune écriture prod (lectures seules + dump schema-only).
- `.env.local` (projet Supabase de test) copié dans le worktree uniquement — gitignoré.
