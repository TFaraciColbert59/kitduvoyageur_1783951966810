# PHASE 10 — Vérification (Observabilité et capacité)

**Date :** 2026-09-12
**Branche :** `feat/phase10-observability` — base `79bb1ca0` (= `origin/main`, Phase 8)
**Environnement :** Supabase local Docker (`supabase_db_ai-finalization`, 127.0.0.1:54322 / PostgREST 127.0.0.1:54321) + vitest + pgTAP + Node v24.
**Responsable :** agent BACKEND/PERFORMANCE/QA + ORCHESTRATOR ; destinataires d'alerte, RUM et charge distante = humain/ops non saisi
**Décision :** **PASS (périmètre local technique)** — **INSUFFICIENT_DATA** pour destinataire réel d'alerte, RUM, métriques de production, charge réelle à 10 000 et barème monétaire IA (jamais `PASS`)

---

## 1. Audit condensé (existant vérifié vs ajouté)

| Domaine | Existant (audité, non refait) | Ajouté Phase 10 |
|---|---|---|
| Corrélation | Phase 2/3 : `correlation_id uuid` sur plans, versions, sessions, carnets, publications + RPC de chaîne ; A11 : `adventure_engine_runs.correlation_id` | Entrée `x-correlation-id` acceptée/validée + génération si absente ; propagée à `generateAdventure` et `hike-sessions` ; en-tête renvoyé au client ; module pur testé |
| Healthcheck | A14 : `scripts/ops/a14_healthcheck.mjs` (files, âge, échecs, latence RPC ; exit 0/1/2) | SLO Phase 10 évalués depuis le snapshot A14 (`ops:slo-check`) |
| Observabilité moteur | A11 : `adventure_engine_runs` (`correlation_id`, `pipeline_version`, `external_calls`, `fallback_count`) | — (inchangé) |
| Rate limiting | Phase 6/8 : `src/lib/rate-limit` + `routes.ts`, 19 routes protégées | — (inchangé) |
| Logs | `console.error/warn` épars, aucun format | `src/lib/observability/logger.ts` : JSON, niveaux, `correlation_id`, `latency_ms`, `status`, **redaction** testée (e-mails, JWT, clés Stripe/Supabase, téléphone, noms, GPS arrondi ~11 km) |
| SLO | Tableau §Phase 10 du chantier (document uniquement) | `src/lib/observability/slo.ts` versionné + évaluateur pur + décision d'alerte ; `scripts/ops/phase10_slo_check.ts` |
| Dashboards | Définitions partielles dans `A14_OBSERVABILITY.md` §5 | `docs/observability/DASHBOARDS.md` : 6 domaines, source exacte de chaque métrique, distinction mesurable/`INSUFFICIENT_DATA` |
| Budget IA | Quotas SQL réels (`ai_usage_daily`, 20 heavy / 100 fast) ; `A15_COSTS.md` inventaire | `src/lib/observability/aiBudget.ts` (calcul pur testé) branché sur les lignes réelles ; trou monétaire documenté |
| Capacité | A15 : charge locale (proximité, conditions, plan) | `scripts/ops/phase10_capacity.mjs` : profils 100/1 000/10 000, charge mixte, garde-fous, verdicts honnêtes |
| RUM | `@vercel/speed-insights` monté (`src/app/layout.tsx:286`) | Documenté comme dépendant de la plateforme (`INSUFFICIENT_DATA` local) |
| Migrations | — | **Aucune** : phase 100 % code/docs, aucune migration (pgTAP exécuté pour non-régression) |

## 2. Livrables

### 2.1 Traces corrélées

- `src/lib/observability/correlation.ts` : `x-correlation-id` (UUID) + corps
  `correlationId` (prioritaire, continuité de chaîne), génération sinon ; une
  entrée invalide est refusée **sans être recopiée** (pas de fuite PII).
- `src/app/api/adventure/generate/route.ts` : identifiant résolu transmis à
  `generateAdventure` → `create_adventure_plan_bundle` →
  `adventure_engine_runs.correlation_id` ; réponse 201 avec `correlationId` +
  en-tête `x-correlation-id`.
- `src/app/api/hike-sessions/route.ts` : identifiant généré si absent →
  `hike_sessions.correlation_id` + `carnets.correlation_id` ; en-tête renvoyé.
- Propagation complète et requêtes de reprise d'incident : `docs/observability/TRACES.md`.
- Trou assumé et documenté : `adventure_domain_events` ne porte pas de
  `correlation_id` (aucun émetteur ne l'alimente aujourd'hui ; ajout additif
  réservé au premier émetteur concerné).
- Tests : `tests/observability/correlation.spec.ts` (8) +
  `tests/observability/generate-route-correlation.spec.ts` (3).

### 2.2 Logs structurés sans données sensibles

- `src/lib/observability/logger.ts` : ligne JSON
  `{ ts, level, service, event, correlation_id, latency_ms, status, … }`,
  niveaux filtrables, sink injectable, silencieux en `NODE_ENV=test`.
- Redaction : clés `secret/token/password/api_key/authorization/cookie/jwt/…`,
  e-mails, PII (nom, téléphone, adresse), GPS arrondi à 1 décimale (~11 km) ;
  motifs dans toutes les chaînes (e-mail, JWT, `Bearer`, `sk_/pk_/rk_`,
  `sb*_`, `+33…`) ; profondeur et tableaux bornés ; `Error` sérialisée sans jeter.
- Câblé sur `api.adventure.generate` (`completed`/`failed`) et
  `api.hike-sessions` (`saved`/`failed`).
- Tests : `tests/observability/logger.spec.ts` (8) — un e-mail/un token ne sort
  jamais tel quel, JSON valide, latence/statut/corrélation présents.

### 2.3 SLO & alertes comme code

- `src/lib/observability/slo.ts` : 9 SLO versionnés (disponibilité, p95
  lecture/écriture, 5xx, sync destructives, RLS, perte carnet, 2 seuils de
  jobs), comparateurs `gte/lte/eq`, source réelle de chaque mesure.
- Évaluation pure : une mesure absente = `insufficient_data`, **jamais `pass`** ;
  `alertDecision` distingue `alert` (page) et `incomplete` (instrumentation).
- `scripts/ops/phase10_slo_check.ts` (`npm run ops:slo-check`) : consomme le
  snapshot A14 + le rapport A15 + un export `ai_usage_daily`, sortie JSON
  (`docs/reports/PHASE_10_SLO_CHECK.json`).
- Résultat local réel (`2026-09-12`) : 4 SLO `pass` (lecture p95 70,96 ms,
  5xx 0 %, file domaine 0/0), 0 échec, 5 `insufficient_data`.
- **Destinataire réel d'alerte non branché** → `INSUFFICIENT_DATA` (item humain/ops).

### 2.4 Dashboards (spécifications)

- `docs/observability/DASHBOARDS.md` : panneaux API, DB, IA, cartographie,
  Stripe, synchronisation + RUM ; chaque ligne indique la table/route/script
  exact qui porte la métrique et son état (mesuré localement vs à brancher).
- Aucun dashboard fictif : les panneaux non alimentés sont explicitement marqués
  `INSUFFICIENT_DATA` avec le prérequis (provider, cron distant, clé Stripe).

### 2.5 Budgets de coût IA

- `src/lib/observability/aiBudget.ts` : agrégation pure de `ai_usage_daily`
  (`requests_heavy`, `requests_fast`, `requests_by_feature`), comparaison aux
  plafonds réels (20/100 par utilisateur/jour), masquage des identifiants.
- Exécution réelle sur la table locale : **0 ligne** → pas de dépassement ;
  plafond global et budget monétaire non configurés → `insufficient_data`
  (modèles `:free`, aucun barème contractuel). Trous listés dans `A15_COSTS.md` §4.
- Tests : `tests/observability/ai-budget.spec.ts` (5).

### 2.6 Capacité locale

`scripts/ops/phase10_capacity.mjs` (garde-fou DSN/URL local, fixtures jetables,
nettoyage garanti en `finally`, concurrence plafonnée à 50 — `max_connections`
locale = 100). Charge mixte : 5/10 lecture de plan, 3/10 proximité PostGIS,
2/10 drapeaux.

Runs réels du 2026-09-12 (machine unique, Docker local — **jamais une preuve de
capacité de production**) :

| Profil | Connexions | Itérations | Débit | p50 | p95 | Erreurs | Verdict |
|---|---:|---:|---:|---:|---:|---:|---|
| 100 utilisateurs simulés | 10 | 23 245 | 2 321 req/s | 3,53 ms | **8,88 ms** | 0 | PASS local |
| 1 000 utilisateurs simulés | 50 | 40 697 | 2 707 req/s | 19,13 ms | **28,00 ms** | 0 | PASS local |
| 10 000 (exploratoire) | 50 (plafonné depuis 200) | 55 197 | 2 755 req/s | 18,82 ms | **27,43 ms** | 0 | **INCONCLUSIVE** (exit 4) |

Artefacts : `PHASE_10_CAPACITY_100.json`, `PHASE_10_CAPACITY_1000.json`,
`PHASE_10_CAPACITY_10000_EXPLORATORY.json` (fixtures restantes : 0).
La charge réelle à 10 000 simultanés et la charge distante restent un item
humain/Phase 1 : le profil 10k ne produit **jamais** de vert, même avec de bons
chiffres.

## 3. Commandes et résultats bruts

| Commande | Résultat |
|---|---|
| `npm run type-check` (tsc --noEmit) | **exit 0** (0 erreur) |
| `npm run lint` | **exit 0** (0 erreur ; warnings préexistants hors périmètre) |
| `npm run test` (vitest complet) | **309 fichiers passés / 4 skipped** ; **2 189 tests passés / 27 skipped / 0 échoué** |
| Tests Phase 10 nouveaux | **34/34** : corrélation 8 + logger 8 + SLO 5 + budget 5 + route 3 + capacité 5 |
| `npx supabase test db --db-url …:54322` | **19 fichiers / 380 tests — Result: PASS** (aucune migration Phase 10 ; non-régression) |
| `node scripts/ops/a14_healthcheck.mjs` | **SAIN** (runs 24 h : 144 dont 0 échec ; files 0/0 ; RPC 0,61 ms) |
| `npm run ops:capacity -- --users 100` | **PASS local** (p95 8,88 ms, 0 erreur, 0 fixture restante) |
| `npm run ops:capacity -- --users 1000` | **PASS local** (p95 28,00 ms, 0 erreur, 0 fixture restante) |
| `npm run ops:capacity -- --users 10000 --allow-10k` | **INCONCLUSIVE** (exit 4 ; concurrence plafonnée ; item humain) |
| `npm run ops:slo-check -- …` | **0 SLO en échec**, 4 `pass`, 5 `insufficient_data`, budget IA `insufficient_data` (exit 0) |

Extraits réels :

```text
=== A14 healthcheck Adventure Intelligence (base locale) ===
Généré : 2026-09-12T06:30:16.359Z
Runs moteurs : total=144, 24h=144 (succès=112, échecs=0, skipped=32, durée moy=2 ms, p95=3 ms)
File événements domaine : attente=0, échec=0, plus vieil en attente=0 min
File générations : attente=0, plus ancienne=0 min
Latence RPC current_feature_flags : moy=0.61 ms (n=5)
RÉSULTAT : SAIN (tous les seuils respectés).

=== Phase 10 — Capacité LOCALE (jamais la production) ===
Profil : 1000 utilisateurs simulés · 50 connexions · 15 s · représentatif=true
Charge mixte : 40697 itérations, 2706.58 req/s, p50 19.13 ms, p95 28 ms, erreurs=0 → PASS
Fixtures restantes : 0

=== Phase 10 — SLO & budget (preuves locales, jamais la production) ===
- PASS               api_read_p95_ms (observé=70.96, cible=300)
- PASS               http_5xx_ratio (observé=0, cible=0.01)
- PASS               jobs_pending_events (observé=0, cible=50)
- PASS               jobs_oldest_pending_min (observé=0, cible=60)
- INSUFFICIENT_DATA  api_availability_ratio / api_write_p95_ms /
                     destructive_syncs / rls_violations / carnet_entry_loss
RÉSULTAT : aucun SLO en échec · 5 SLO non mesuré(s) (INSUFFICIENT_DATA)
```

## 4. Snapshots visuels impactés

**Aucune UI modifiée** (aucun composant, aucune page ; uniquement lib
serveur/scripts/docs) → **aucune baseline visuelle impactée, aucune
régénération nécessaire.**

## 5. Limites et risques résiduels (honnêtes)

1. **Destinataires d'alerte absents** : les alertes sont évaluables (code + CLI)
   mais aucun e-mail/Slack/pager n'est branché → `INSUFFICIENT_DATA`.
2. **Métriques de production absentes** localement : disponibilité, 5xx réels,
   RUM (Speed Insights nécessite le projet Vercel), p95 d'écriture.
3. **Charge réelle à 10 000** et charge distante non exécutées : item humain/
   Phase 1 ; le profil exploratoire local n'est jamais concluant.
4. **Aucun scénario d'écriture en charge** (POST) : le p95 écriture < 500 ms
   reste non mesuré.
5. **Budget IA monétaire** : plafond global/barème absents (modèles `:free`) ;
   aucun envoi d'alerte de coût.
6. **`adventure_domain_events` sans corrélation** : trou documenté
   (`TRACES.md` §3), aucun émetteur ne la fournit aujourd'hui.
7. **RUM et cache CDN/tuiles** : dépendants de la plateforme/fournisseur.
8. Les chiffres de capacité locale (p95 ms) ne préjugent pas de la production
   (pas de TLS, CDN, pooler, multi-instance, WAF).

## 6. Décision

**PASS (périmètre local technique)** pour : corrélation d'entrée + propagation,
logs structurés rédactés, SLO comme code + CLI, specs de dashboards, budget IA
calculable, capacité locale 100/1 000 exécutée, non-régression complète.

**`INSUFFICIENT_DATA` (jamais `PASS`)** pour : destinataire réel d'alerte, RUM,
métriques de production, charge réelle à 10 000, p95 écriture, barème monétaire
IA, compteurs ops (sync destructives, violations RLS, perte carnet).
