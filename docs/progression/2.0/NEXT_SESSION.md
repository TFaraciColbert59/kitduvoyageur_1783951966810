# NEXT_SESSION — état final après T48 (mandat exécuté)

> Mis à jour : 2026-10-11 (clôture). Lire d'abord `docs/progression/2.0/ETAT.md`
> (statuts + preuves), puis `rapport-final.md` (synthèse), `DEPLOYMENT.md` §9
> (cohortes/retour arrière) et `mesures.md` (mesure produit).

## Ce qui est terminé et prouvé

- **T01–T48 exécutés** ; les statuts par tâche vivent dans `ETAT.md` (TESTÉ /
  DÉPLOYÉ / FERMÉ / PARTIEL avec preuves datées). Dernier lot déployé en prod :
  `20261011182000` (index chauds) et `20261011183000` (réévaluation des refus
  temporaires) — ledger distant vérifié.
- **Batterie locale verte** : vitest progression+phase1 507/507 (9 skip
  env-gated), `tsc --noEmit` 0 erreur, `verify:invariants` OK, pgTAP 62 fichiers
  / 1164 tests PASS (dont `phase1_balance_lockdown` et `progression_hardening`
  réconciliées avec la doctrine T38/T11).
- **Gate doctrinal notable** : `phase1_balance_lockdown` teste désormais le
  flux d'encaissement (`record_order_encashment_event`) — la confirmation admin
  seule ne crédite plus (T38).

## Gates restants (conditionnés, documentés — rien d'autre n'est « à finir »)

1. **Webhook Stripe — clé + rejeu réel uniquement** : le BRANCHEMENT CODE est
   terminé (encaissement carte `stripe:<session>` idempotent, remboursements
   bornés, confirmation virement admin `admin-transfer:<orderId>` émise avant
   transition, échecs ⇒ Stripe rejoue / commande reste `pending` — 35/35 tests).
   Reste : renseigner `STRIPE_WEBHOOK_SECRET` et rejouer un événement réel,
   puis ouvrir l'émission commerciale (DEPLOYMENT.md §9).
2. **Appareils réels** : VoiceOver/TalkBack + gestes Capacitor (T43) — aucun
   téléphone dans cet environnement ; specs web mobile vertes (3/3 Playwright).
3. **Pilote de compréhension** ≥ 8/10 (T46) — population réelle requise.
4. **Financements** (pool T40, bons T39) : aucun financement enregistré →
   distribution fermée par construction.

## Tests d'intégration locaux (tous verts, 43/43 — à relancer ainsi)

```powershell
# Stack local déjà démarré (127.0.0.1:54321) ; pays : seed prod→local si base neuve
node scripts/ops/local_seed_countries.mjs
$anon = '<ANON_KEY de `npx supabase status -o env`>'
$svc  = '<SERVICE_ROLE_KEY de `npx supabase status -o env`>'
$env:PHASE1_PRODUCERS_E2E='1'; $env:NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:54321'
$env:SUPABASE_SERVICE_ROLE_KEY=$svc; $env:NEXT_PUBLIC_SUPABASE_ANON_KEY=$anon
$env:COUNTRIES_GEO_E2E='1'; $env:PHASE2_LOCAL_INTEGRATION='1'
$env:PHASE2_LOCAL_SERVICE_ROLE_KEY=$svc; $env:PHASE2_LOCAL_ANON_KEY=$anon
$env:A14_LOCAL_INTEGRATION='1'; $env:A14_LOCAL_SERVICE_ROLE_KEY=$svc
$env:A15_LOCAL_INTEGRATION='1'
# --no-file-parallelism OBLIGATOIRE : a14/a15 mutent les mêmes flags
npx vitest run --no-file-parallelism tests/phase1/producers.integration.spec.ts `
  tests/countries_geo.spec.ts tests/integration/phase2-chain.integration.spec.ts `
  tests/ops/a14-flag-rollback.integration.spec.ts tests/ops/a14-gdpr.integration.spec.ts `
  tests/ops/a15-rollout.spec.ts

# E2E mobile (serveur dev sur :4000 déjà lancé)
$env:PW_BASE_URL='http://127.0.0.1:4000'
npx playwright test scripts/e2e/progression-mobile.spec.ts scripts/e2e/progression-offline.spec.ts --project=mobile-chromium
```

## Reprise opérationnelle (si le mandat revient)

```powershell
# 1. État durable
Get-Content docs/progression/2.0/ETAT.md
# 2. Batterie complète locale
npx vitest run tests/features/progression tests/phase1
npx supabase test db --db-url "postgresql://postgres:postgres@127.0.0.1:54322/postgres?sslmode=disable"
# 3. Prod : jamais de db push direct — workdir isolé
node scripts/ops/phase1_build_push_workdir.mjs
npx supabase db push --linked --skip-vault --workdir "C:\Users\Tony\AppData\Local\Temp\opencode\phase1-push"
# 4. Contrôle pré-palier (lecture seule)
node scripts/ops/progression_rollout_check.mjs
```
