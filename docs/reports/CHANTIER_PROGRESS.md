# CHANTIER — Point d'étape consolidé (exécution autonome)

**Date :** 2026-09-12
**Main au moment de la rédaction :** `63730d00` (ce document est mergé après)
**Tag de certification Phase 0 :** `g0-certified-20260911` (commit `02afe6ee`)
**Branche de travail :** `audit/adventure-intelligence` = `main`
**Protection `main` :** ruleset `main-protection` (PR obligatoire, 5 checks requis, conversations, pas de force-push/suppression ; bypass admin en filet de secours)
**GitHub Pages :** désactivé (production = Vercel)

---

## 1. État des phases

| Phase | Statut | Preuves principales |
|---|---|---|
| 0 — Base de livraison | **PASS** | CI 100 % verte (quality-gates, lighthouse, bundle-analysis, build-ios, visual-tests), SBOM + audits (critique corrigé : next 15.5.25), scan secrets PASS, tag `g0-certified-20260911` |
| 1 — BDD distante | **INSUFFICIENT_DATA** | Bloquée : PAT Supabase complet (`projects:write`) requis pour créer le projet de test |
| 2 — Chaîne d'identifiants | **PASS local** | 2 migrations + 2 RPC, `TripExperience`, `correlation_id`, 57 assertions pgTAP, intégration 7/7 (échecs injectés) |
| 3 — AutoGen réel | **PASS local** | `createTripFromAutogenIntent`, recherche route réelle, gate navigation (`uniform_from_blueprint` jamais navigable), E2E local 2/2 |
| 4 — Couverture & POI | **PASS structure / INSUFFICIENT_DATA données** | Couverture versionnée + licences + rollback, pipeline 11 étapes dry-run, offres affiliation horodatées ; 0 région `covered`, flag off |
| 5 — Kit complet | **PASS local** | Complétude perso/partagé/manquant, raisons persistées, docs, sécurité pré-trip, storage privé + URL signées |
| 6 — Cockpit & hors-ligne | **PASS local** | Rate-limit distribué (Upstash + repli + fail-safe), pack versionné, conflits champ/champ, vault local (WebCrypto), reroutage réel uniquement |
| 7 — Carnet & communauté | **PASS local** | Zéro démo, privé par défaut, snapshot de publication immuable (24/24 pgTAP), consentement prépublication |
| 8 — Paiement & sécurité | **PASS code / INSUFFICIENT_DATA clés & juridique** | 224 tables auditées, 7 trous RLS corrigés, anti-escalade, Stripe idempotent mocké (30 tests), docs conformité à valider |
| 9 — UI/UX mondiale | **NON DÉMARRÉE** | Prochain gros chantier (nav unique, états standardisés, WCAG 2.2 AA, i18n/RTL) |
| 10 — Observabilité & capacité | **PASS code / INSUFFICIENT_DATA ops** | `x-correlation-id`, logger JSON sans PII, SLO as code, profils 100/1k (10k INCONCLUSIVE assumé) |
| 11 — Mobile & terrain | **PASS build / INSUFFICIENT_DATA stores & terrain** | JDK17/21 + SDK36 locaux, **AAB signé vérifié** (146 405 405 o, `jarsigner` exit 0), signature sans secret, docs stores |
| 12 — Préproduction & rollout | **NON DÉMARRÉE** | Ordre obligatoire interne → 1 → 5 → 20 → 50 → 100 %, décision humaine par palier |

## 2. Preuves globales au dernier SHA

- `npm run test` : **2 259 tests passés / 27 skipped — 0 échec** (318 fichiers).
- pgTAP local : **20 fichiers / 438 tests — PASS**.
- `type-check` / `lint` / `verify:invariants` : exit 0.
- CI GitHub : 5 checks requis verts sur chaque PR (46 PR dont #34–#46 pour ce chantier).
- Snapshots visuels Linux : stables (transitions figées, scrollbars masquées, barre de filtres masquée nommément).
- RLS : 223/224 tables protégées (`spatial_ref_sys` PostGIS sans privilèges clients).
- Aucun secret dans Git (scan + push protection ont bloqué une clé factice de test).

## 3. Verrous humains restants (les seuls)

1. **PAT Supabase complet** (scope `projects:write`) → débloque Phase 1 (projet de test, certification BDD distante, `database-gates`, E2E distant).
2. **Stripe** : 8 variables (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, 6 `STRIPE_PRICE_*`) → active la monétisation réelle.
3. **Upstash** : `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` → rate limiting distribué réel.
4. **Tuiles commerciales** : contrat fournisseur (MapTiler/Mapbox/…).
5. **Stores** : comptes Play Console / Apple Developer, upload AAB/TestFlight, Data Safety.
6. **Appareils & terrain** : 5 profils d'appareils, batterie/réseau instable, 30 paires ETA/réel, calibration.
7. **Juridique** : validation des brouillons `docs/compliance/` (DPO, AIPD, DPA, mentions par marché).
8. **Phase 12** : décision humaine par palier de rollout.

## 4. Comment reprendre

1. Déposer un PAT Supabase complet dans `C:\Users\Tony\AppData\Local\Temp\opencode\supabase-pat.txt` (jamais dans le dépôt).
2. Prochaine vague autonome : **Phase 1** (création projet test + certification distante), puis **Phase 9** (UI/UX) et **Phase 12** (préparation rollout).
3. Les rapports par phase sont dans `docs/reports/PHASE_<N>_{VERIFICATION.md,RESULTS.json,ROLLBACK.md}` ; les preuves transverses dans `docs/reports/` (SBOM, audits, scans) et `docs/architecture/CHANTIER_LANCEMENT_MONDIAL.md` (référence).
