# Observabilité — Phase 10

Ce dossier documente le volet **observabilité et capacité** du chantier
`docs/architecture/CHANTIER_LANCEMENT_MONDIAL.md` (§Phase 10) :

| Document | Contenu |
|---|---|
| [`TRACES.md`](./TRACES.md) | Contrat `correlation_id` (entrée → route → DB → événements), propagation, requêtes de reprise d'incident |
| [`DASHBOARDS.md`](./DASHBOARDS.md) | Panneaux minimaux (API, DB, IA, cartographie, Stripe, sync) et source réelle de chaque métrique |
| [`SLO_ALERTES.md`](./SLO_ALERTES.md) | SLO Phase 10 comme code, évaluation, alertes et item humain (destinataires) |

## Code associé

| Module | Rôle | Tests |
|---|---|---|
| `src/lib/observability/correlation.ts` | Entrée `x-correlation-id`/corps, validation, génération | `tests/observability/correlation.spec.ts` |
| `src/lib/observability/logger.ts` | Logs JSON (niveau, corrélation, latence, statut) + redaction PII | `tests/observability/logger.spec.ts` |
| `src/lib/observability/slo.ts` | SLO versionnés + évaluation pure + décision d'alerte | `tests/observability/slo.spec.ts` |
| `src/lib/observability/aiBudget.ts` | Budget IA calculé depuis `ai_usage_daily` | `tests/observability/ai-budget.spec.ts` |
| `scripts/ops/phase10_capacity.mjs` | Charge locale 100 / 1 000 / 10 000 (mixte) | `tests/ops/phase10-capacity.spec.ts` |
| `scripts/ops/phase10_slo_check.ts` | Vérification SLO à partir des sorties A14/A15 + `ai_usage_daily` | `tests/observability/slo.spec.ts` (fonctions pures) |

## Commandes

```powershell
npm run type-check
npm run test

# Charge locale (jamais la production, garde-fou DSN/URL local)
npm run ops:capacity -- --users 100
npm run ops:capacity -- --users 1000
npm run ops:capacity -- --users 10000 --allow-10k   # verdict toujours INCONCLUSIVE

# Healthcheck A14 (local) puis vérification SLO
node scripts/ops/a14_healthcheck.mjs --json > docs/reports/PHASE_10_HEALTHCHECK.json
npm run ops:slo-check -- --health docs/reports/PHASE_10_HEALTHCHECK.json --load docs/reports/A15_LOAD_TEST.json
```

## Règles d'honnêteté appliquées

1. Une mesure absente vaut `insufficient_data`, **jamais** `pass`.
2. Les proxys locaux (A15/capacité) ne sont jamais présentés comme des mesures
   de production : local ≠ production (pas de TLS, CDN, pooler, multi-instance).
3. Le profil 10 000 rend toujours `inconclusive` : la charge réelle à 10k et la
   charge distante sont des items humains (Phase 1), pas des résultats de code.
4. Les alertes sont **évaluables** ici ; leur branchement à un destinataire réel
   (e-mail/Slack/pager) reste `INSUFFICIENT_DATA` tant qu'aucun canal n'est
   provisionné.
5. Aucun log ne contient d'e-mail, de token, de clé, de téléphone, de nom ou de
   coordonnée GPS précise (rédaction testée).
