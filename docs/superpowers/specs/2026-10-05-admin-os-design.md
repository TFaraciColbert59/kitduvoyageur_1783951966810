# LKDV Admin OS — Design Doc (Architectural)

**Date:** 2026-10-05
**Path:** `docs/superpowers/specs/2026-10-05-admin-os-design.md`
**Sources vérifiées:** lecture réelle repo (14 routes `/admin`, 15 API `api/admin`, 259 migrations, `requireAdmin`, `has_permission`, `action_logs`, `osQueries.ts` 698 lignes live, `admin-os.css` 20Ko, tokens forest/sage/stone, 530 specs vitest + playwright)
**Autonomie:** ordre explicite utilisateur = autonomie totale, aucune approbation demandée. Per `using-superpowers`, user instructions > skill gates. HARD-GATE brainstorming levé explicitement, hypothèses documentées ci-dessous, exécution continue P0→P5.

## 1. Classification

**Architectural.** Nouveau control plane transverse (identity, permissions, commands, approvals, audit, shell, 30 domaines). Restructure interfaces auth/audit/écriture admin. Pas bounded (pas un flag/endpoint isolé), pas spike (output = système durable).

## 2. État réel corrigé (vs spec JSON 1.0)

- Admin actuel **déjà modulaire**, pas monolithe 88Ko/136Ko : `layout.tsx` 1.6Ko (garde + AdminShell), `page.tsx` 6.1Ko/174 lignes (Hero+Grid+workspace+Inspector, 0 mock), `_os/` 7 fichiers (shell, routeConfig 11 entrées NAV, panels, osUi ⌘K), `_components/` 12 îlots, 13 pages, `features/admin/osQueries.ts` live RLS zéro mock.
- `admin_roles` (ENUM super_admin/admin/moderateur) + `user_profiles.role` (text user/admin/moderator — orthographe divergente) coexistent. `is_admin()` lit `user_profiles.role` (DEFINER + search_path durci 2026-09), `is_moderateur()/get_admin_role()` fossilisés sur `admin_roles`. `has_permission(p_code)` existe (`20261005000000_admin_rbac_core.sql`) mais avec fallback `OR is_admin()` + `GRANT EXECUTE TO anon` (oracle anonyme).
- Audit : `action_logs` canonique append-only + backfill double legacy + trigger `user_roles` + `logAdminAction` service_role existe. Mais `admin_audit_log` + `admin_audit_logs` conservées (double chemin écriture), policies historiques `USING(true)` partiellement nettoyées, `FORCE RLS` seulement sur RBAC/audit/flags, grants baseline larges (`GRANT ALL ON ALL TABLES TO authenticated`).
- `feature_flags` minimal existe (4 flags hub, SELECT authenticated, écriture service_role seule). **Aucun** `admin_commands` / `admin_approvals` / command engine / approval engine / Edge admin. `fetch-osm-trails` = stub `export {}`.
- Design : aucun `--cp-*` / `.cp-*` / `docs/compas/*` trouvé (0 hit). Tokens réels : `src/design/tokens.ts`, `liquid-glass.css` 40Ko, `tokens.css` 45Ko, palette Forest `#17402C`/Sage/Stone/Paper, `.admin-os` 20Ko light figée (ne suit pas dark mode — dette assumée).
- Socle réutilisable : `requireAdmin(code)` (12/15 routes) + AAL2 + CSRF double-submit + rate-limit fail-closed + `correlation.ts`/`logger.ts` (partiel, non généralisé admin) + 530 specs + `middleware.ts` page-guard (legacy `is_admin` seul).

## 3. Approches considérées

### A. Modular monolith incrémental (RECOMMANDÉ)
Construire sur fondations existantes. P0 : canonicaliser autorité (supprimer fallback, révoquer anon, converger middleware, fossiliser `admin_roles`), geler legacy audit (lecture seule), créer command+approval engine, envelope erreur + correlation généralisés, extraire primitives Admin OS depuis `_os/`. Puis P1→P5 domaine par domaine avec read/write split, server-only mutations Tier≥2, preview/dry-run bulk, pagination serveur.
- Pros : sûr, compat ascendante, migrations idempotentes + rollback, réutilise 698 lignes live testées, respecte spec Décision 2 (pas de microservices prématurés) + consigne "réutilise avant de recréer".
- Cons : progression moins spectaculaire en P0.

### B. Rebuild parallèle `/admin-os` greenfield
Nouveau shell + nouveau schéma à côté, migration tardive.
- Pros : design pur sans contraintes legacy.
- Cons : duplication auth/audit/queries, divergence, double chemin sécu = risque, rejeté (viole réutilisation + Décision 5/6 autorité/audit/commande uniques).

### C. Split microservices prématuré
Extraire service admin isolé.
- Rejeté : spec §9.1 l'interdit explicitement sans besoin prouvé ; overhead ops injustifié.

## 4. Design retenu (A)

### 4.1 Architecture
`src/features/admin-os/` modulaire : `identity/permissions/commands/approvals/audit/search/users/support/commerce/marketplace/moderation/adventure/geo/ai/experiments/data/ops/security/compliance`. Chaque module : `queries(read RLS) + commands(handlers serveur) + schemas(zod) + permissions(keys) + ui(primitives) + tests`. Read side (vues/RPC read-only, agrégats, cursor pagination, freshness visible) séparé de Write side (UI → Server Action/API Admin → Authorization re-évaluée → validation version → Command record → Approval si Tier≥3/4 → Execute → transaction domaine → Audit append-only → Event + correlation).

### 4.2 Permissions unifiées `domain.resource.action`
Registre seedé (existant 13 clés → cible ~60) : `users.profile.read`, `users.pii.reveal`, `support.ticket.assign`, `commerce.refund.request/approve`, `marketplace.listing.restrict`, `trust.case.decide`, `features.flag.update`, `ai.prompt.promote`, `ops.job.retry`, `security.role.grant`, `audit.export.create`. Tiers 0(read, server_auth) / 1(routine, audit+reason si policy) / 2(sensitive, audit+reason+reauth contextuel) / 3(high, +JIT+MFA/passkey) / 4(critical, +second approver+délai/ticket). `user_roles` canonique, `user_profiles.role` déprécié (colonne gardée sync trigger puis lecture seule), `admin_roles` fossilisé lecture seule puis DROP en migration différée. `has_permission` sans `OR is_admin`, `REVOKE anon`, middleware converge vers `has_permission`.

### 4.3 Command Engine
Tables `admin_commands` (command_id, command_key, actor_id, resource_type/id, environment, payload, reason, ticket_id, risk_tier, idempotency_key UNIQUE, expected_version, preview, requires_approval, status, result, correlation_id, created/executed_at) + états `drafted/validated/awaiting_approval/approved/executing/succeeded/partially_succeeded/failed/unknown/cancelled/rolled_back`. Invariants : idempotence (replay même clé = même résultat), optimistic concurrency (`expected_version` → 409 explicite), jamais de Tier3/4 côté client, preview obligatoire bulk, correlation_id copiable, recovery sûre documentée.

### 4.4 Approval Engine
`admin_approval_requests/steps/decisions` : règles par commande (seuils financiers, SoD initiateur≠approbateur, auteur prompt≠promoteur), second approver Tier4, expiration + escalation, break-glass (compte scellé, alerte, incident obligatoire, post-review). Mobile crisis = approve/reject + kill switches sélectionnés uniquement.

### 4.5 Audit canonique
`action_logs` étendu (actor_session_id, elevation_id, action_key, risk_tier, environment, request/correlation_id, reason, before/after_hash+snapshot, approval_id, ip/user_agent_hash, result/error_code). Append-only (`FORCE RLS`, INSERT own, SELECT `audit.read`, 0 UPDATE/DELETE), non modifiable UI, hash-chaînage événements critiques, export signé expirant scope-limited audité. Legacy `admin_audit_log(s)` : freeze écriture (REVOKE INSERT authenticated, garder SELECT `audit.read` pour historique), backfill déjà fait, DROP différé P5.

### 4.6 Shell + primitives (desktop-first dense, keyboard-first)
Extraire `_os/` → `src/components/admin-os/` : `AdminGlassShell/Sidebar/CommandBar/DataGrid/Inspector/Sheet/StatusChip/RiskBadge/Timeline/Metric/Diff/ActionBar`. Bridge `--os-*` → tokens canoniques (pas fork) ; Glass pour chrome/nav/command/inspector, surfaces stables pour tables/logs/diffs/formulaires. Routes cibles §17 spec (37 routes) incrémentalement depuis 14 existantes ; nouvelles routes sous `/admin/<domaine>` avec `AdminRouteLayout` typé (supprime copier-coller Hero/Grid). ⌘K modes navigate/search/run/filter/jump/incident/ticket/user/trip/trace/flag/elevation avec affichage risque/scope/env/élévation/approbation. Search fédérée avec droits appliqués aux résultats. PII masquée par défaut, reveal audité Tier2+.

### 4.7 Observabilité
`x-correlation-id` + envelope `{ok|error:{code,message},correlationId}` généralisés à `/api/admin/*` via `src/server/admin/respond.ts`. Logs JSON structurés rédigés. Runbooks + incidents + jobs + deploys corrélés. Erreurs UI : message humain + état connu + action sûre + correlation copiable.

### 4.8 Sécurité P0
Triage linter : 14 RLS-no-policy, 1 vue DEFINER, 2 funcs search_path mutable, `spatial_ref_sys` public, extensions public, matviews Data API, DEFINER exécutables anon → chaque finding = owner/intention/statut/décision/test non-régression. `SECURITY DEFINER` audités (search_path + REVOKE + GRANT minimaux), Edge auth inventory (`fetch-osm-trails` marqué dégradé). Secrets : inventaire metadata seul, jamais brut.

### 4.9 Tests & gates
Matrice rôle×action×environnement, tests autorisation (existant `requireAdmin.spec` + pgTAP à étendre), architecture tests interdisant écritures admin client directes Tier≥2, SQL/RLS tests, concurrence (idempotence + version), E2E parcours complets, non-régression. Gates §20 spec (20 critères) bloquants avant "prêt".

## 5. Roadmap P0→P5
P0 fondations sécu (autorité, registry, JIT schema, audit unique, command/approval, mutations serveur, triage linter, primitives, tests autorisation). P1 shell/palette/search/workqueue/user360/support/moderation/audit/flags/ops/incidents/jobs. P2 catalog/inventory/orders/refunds/marketplace/risk/disputes/rewards. P3 trips/Compas/runs/geo/trails/countries/content. P4 AI registry/prompts/agents/evals/promotions/data catalog/lineage/quality/RLS explorer. P5 JIT complet/break-glass/multi-approvals/on-call/SSO/mobile crisis/fraud graph/evidence automation. Détail phases dans plan d'implémentation (writing-plans).

## 6. Hypothèses autonomie (risques documentés)
- Pas de SSO/SCIM en P0 (non prouvé nécessaire) ; schéma extensible.
- Impersonation : scope minimal + bannière + session séparée, désactivé par défaut, activable Tier4 avec justification.
- `user_profiles.role` gardée temporairement en sync trigger (compat RLS existantes), lecture seule applicative.
- OSM stub marqué dégradé, pas réparé en P0 (isolation propre).
- Compas `--cp-*` inexistant : bridge tokens réels, pas invention de valeurs (principe "no invented values").

## 7. Self-review
- Placeholders : aucun TBD ; contrats explicites.
- Cohérence : autorité/audit/commande uniques alignées Décisions 4/5/6 ; pas de microservices (Décision 2) ; correlation partout (Décision 9).
- Scope : single spec pour plan P0→P5, décomposé en phases dans writing-plans.
- Ambiguïtés levées : fallback `OR is_admin` supprimé (source divergence) ; anon révoqué ; legacy audit gelé pas droppé (rollback sûr).

## 8. Transition
Prochaine étape imposée par ce skill : invoquer `writing-plans` pour plan d'implémentation détaillé. Revue utilisateur du spec **levée explicitement** par ordre d'autonomie (à consigner au rapport final).
