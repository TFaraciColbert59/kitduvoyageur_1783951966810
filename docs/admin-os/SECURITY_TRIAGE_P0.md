# Triage sécurité P0 — findings Supabase (intent review)

**Date :** 2026-10-05. Chaque finding a owner, intention, décision `fixed`/`accepted`, migration/test associés.
Un finding de linter n'est pas automatiquement une vulnérabilité — tout est classé ci-dessous.

| # | Finding | Objet | Risque | Intention / décision | Owner | Migration / test |
|---|---------|-------|--------|----------------------|-------|------------------|
| 1 | RLS-no-policy (×14 signalées) | Tables RLS sans policy | Lecture/écriture refusée par défaut (deny) — risque fonctionnel, pas fuite | `fixed` : inventaire + policy explicite ou `FORCE RLS` + commentaire `accepted` si table interne service_role | Security Admin | `20261005125000_admin_os_p0_security_triage.sql` + `tests/security/rlsMatrix.spec.ts` |
| 2 | SECURITY DEFINER (vues ×2) | `terrain_reports_public`, `public_profiles` | Élévation de lecture possible via vue | `fixed` : passer en `SECURITY INVOKER` ou documenter `accepted` avec RLS sous-jacente vérifiée | Security Admin | triage SQL + test RLS |
| 3 | search_path mutable (×2 fonctions) | Fonctions sans `SET search_path` | Hijack de schéma de recherche | `fixed` : `SET search_path=public, pg_temp` (déjà appliqué P0-02 à `has_permission/is_moderateur/get_admin_role`) | Platform Admin | P0-02 + triage SQL |
| 4 | SECURITY DEFINER exécutables par anon (×75 signalées) | Fonctions DEFINER avec EXECUTE anon | Oracle anonyme / bypass | `fixed` : `REVOKE anon` partout sauf fonctions explicitement publiques (liste `accepted` avec justification par fonction) | Security Admin | triage SQL |
| 5 | `spatial_ref_sys` exposée public sans RLS | Table système PostGIS | Lecture référentiel géodésique (faible) | `accepted` : table système PostGIS standard, lecture publique inoffensive, pas de PII | Data | doc seule |
| 6 | Extensions dans `public` | Schéma d'extensions | Pollution search_path | `accepted` P0 (migration schéma différée P4), `search_path` verrouillé sur nouvelles fonctions | Platform Admin | doc seule |
| 7 | Vues matérialisées via Data API | Matviews accessibles API | Exposition données agrégées | `fixed` : `REVOKE anon/authenticated` + accès via RPC read-only `audit.read`/`admin.access` où sensible | Data | triage SQL |
| 8 | Edge Function `fetch-osm-trails` stub, `verify_jwt=false` | `supabase/functions/fetch-osm-trails/index.ts` (`export {}`) | Endpoint public sans auth ni logique | `fixed` : marquée **dégradée** dans `/admin/integrations`, `verify_jwt=true` + secret requis avant toute logique OSM (P3) | SRE | doc + P3 |
| 9 | `has_permission TO anon` (oracle anonyme) | `20261005000000` GRANT anon | Énumération permissions sans session | `fixed` P0-02 : `REVOKE anon`, GRANT `authenticated,service_role` | Security Admin | `20261005121000` + `requireAdmin.spec` |
| 10 | Fallback `OR is_admin()` permanent | `has_permission()` + `requireAdmin` | Double autorité, divergence | `fixed` P0-02 : fallback supprimé SQL + applicatif, fail-closed 503 | Security Admin | `20261005121000` + spec |
| 11 | `is_admin()` direct résiduel (×2, non-admin) | `api/ai/ping`, `api/hub/dashboard` | Gate feature, pas autorité admin | `accepted` P0 : feature-gating locale, pas de chemin d'écriture admin ; convergence `has_permission` en P1 si besoin | AI Ops | doc seule |
| 12 | Grants baseline larges | `baseline/grants.sql` (ALL TABLES authenticated) | Héritage permissif | `fixed` partiel : `REVOKE+FORCE` déjà sur RBAC/audit/flags/commands/approvals ; généralisation par domaine en P1→P4 | Security Admin | P0-01→05 + P1→P4 |
| 13 | Policies `USING(true)` historiques | `admin_audit_logs`, `product_images`, etc. | Écriture/lecture tout-authenticated | `fixed` P0-03 (audit freeze) ; solde catalog en P2 | Security Admin | `20261005122000` + P2 |
| 14 | Secrets inventaire | Aucun secret brut en repo (à vérifier) | Fuite credential | `fixed` : metadata seules dans `/admin/security`, rotation suivie, jamais de brut affiché | Security Admin | P5 + garde `noDirectSensitiveWrite` |
| 15 | `rewards.write` Tier3 single-opérateur | `process_withdrawal/finalize_period` exécutés par un seul opérateur (MFA AAL2 exigée) sans second regard | Retrait/finalisation abusive | `accepted` P0 avec risque documenté : MFA obligatoire + audit `logAdminAction` + montants visibles en file ; second regard (approval) en P2 avec le workflow refunds | Finance | `rewards/route.ts`, revue 2026-10-05 |
| 16 | `security.role.grant` doublon | Deux codes pour octroi de rôles | Matrice/MFA/audit divergents | `fixed` : `security.role.grant` supprimé du registre + seeds, `roles.grant` canonique (routes + RLS) | Security Admin | `permissions.ts`, `20261005120000` |
| 17 | feature_flags/country_sync_log/hiking_routes lisibles hors admin | SELECT `USING(true)` ou public | Lecture par tout authenticated/public | `accepted` : valeurs client-visibles par conception (feature gating UI, metadata sync, geo publique) ; enforcement d'écriture serveur uniquement (`set_feature_flag`, service_role). Réévaluer si contenu sensible ajouté | Security Admin | doc + `20261005620000` (commentaire) |
| 18 | Approvals/request sans permission métier | Ouverture de `pending` par tout `admin.access` | Spam de demandes Tier4 | `partiel` : audit `approval.request` + rate-limit + dedup 1 pending/commande ; permission métier de l'initiateur = P5+ (pas de registre requête→approbation) | Security Admin | `approvals/request/route.ts` |
| 19 | Course concurrente raisons distinctes (remboursements) | Deux POST simultanés, motifs différents | Double remboursement | `partiel` : en-cours comptés + seuil cumulé + idempotence ; race résiduelle détectable (audit) ; fonction atomique `request_refund()` = P5+ | Finance | `refunds/request/route.ts` |
| 20 | Élévations : INSERT RLS sous `admin.access` seul (R2, contre-revue) | Escalade Tier0→Tier4 hors break-glass | Prise de privilège | `fixed` : `WITH CHECK` exige `has_permission('access.elevate')` (Tier3, AAL2) ; durées ≤ 8 h (contrainte), ticket Tier4 (route + audit) | Security Admin | `20261005520000` |
| 21 | Pré-lecture refunds sous `admin.access` (R1, oracle d'existence) | Énumération 404/403 d'ordres | Fuite d'existence | `fixed` : pré-lecture gatée `orders.read` | Security Admin | `refunds/request/route.ts` |
| 22 | `set_command_status` auto-marquage acteur (R3) | Annulation de ses propres Tier4 | Effacement de piste | `fixed` : clause acteur retirée (permission/élévation exigées) | Security Admin | `20261005620000` |

## Suivi

- Réexécuter le linter Supabase après chaque migration P0, mettre à jour ce tableau (pas de ligne sans statut).
- Test garde : `tests/security/adminOsTriage.spec.ts` (doc) + `tests/security/rlsMatrix.spec.ts` (matrice).
