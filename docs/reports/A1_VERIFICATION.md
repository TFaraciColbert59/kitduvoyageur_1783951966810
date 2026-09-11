# A1 — Rapport de vérification (Phase 1 : domaine, BDD et sécurité)

Date : 2026-09-11 · Branche : `chantier/adventure-intelligence` · Commit : `13434b91`
Statut : **RÉALISÉ** (validation BDD sur copie = gate manuelle documentée)

## 1. Livrables

| Livrable | Chemin |
|---|---|
| Spec | `docs/superpowers/specs/2026-09-11-a1-domain-database-security-design.md` |
| Plan | `docs/superpowers/plans/a1-domain-database-security.md` |
| Domaine TS | `src/features/adventure-intelligence/domain/*` (confidence, provenance, engine, events, constraints, decisions, adventurePlan, health) |
| Schémas Zod | `src/features/adventure-intelligence/schemas/*` (adventurePlan, performance, terrain, prediction, live, index) |
| Santé (Noop) | `src/features/adventure-intelligence/providers/noopReadinessProvider.ts` |
| Consentements serveur | `src/features/adventure-intelligence/server/consents.ts` |
| Migrations | `supabase/migrations/20260911130000..20260911138000_a1_*.sql` (9 fichiers) |
| Tests TS | `tests/adventure-intelligence/*.spec.ts` (5 fichiers, 46 tests) |
| Tests pgTAP | `supabase/tests/database/a1_domain_security.test.sql` (22 assertions, TEST-A1-RLS-01..09) |

## 2. Preuves d'exécution (worktree, 2026-09-11)

| Commande | Résultat |
|---|---|
| `npm run test` | ✅ **204 fichiers, 1567 tests, 0 échec** (1521 baseline + 46 A1) |
| `npm run type-check` | ✅ exit 0 |
| `npm run lint` | ✅ exit 0 (warnings préexistants hors A1) |
| `npm run build` | ✅ exit 0 (artefacts icônes régénérés puis restaurés, non commités) |
| `npm run verify:invariants` | ✅ tous les invariants validés |
| `git diff --check` | ✅ aucun problème |
| Contrôle SQL statique | ✅ 18 `CREATE TABLE` = 18 `ENABLE ROW LEVEL SECURITY` ; `SECURITY DEFINER` uniquement avec `search_path` verrouillé |

## 3. Revue indépendante (subagent-driven)

- Implémenteur TS : 5 commits (`27e982c6` → `201b2d7d`), 46/46 tests.
- Revue indépendante : Spec ✅ Task 1-4 + 7 ; **1 Important** (`requiresConfirmation('other')`)
  + 4 mineurs → corrigé en `4374a5af` (round 1/5, 46/46 après correctif).
- Mineurs différés (documentés) : mapping DB↔TS (`ascentSpeedMPerHour`/`ascent_speed_m_per_h`,
  `effortScore`/`predicted_effort`) à introduire au premier write DB en Phase 3 ;
  `z.string().url()` conservé pour cohérence repo.
- pgTAP : 22 assertions, couvre consentements, passages, profils, seuil ≥ 5, vue sans identité,
  plans + `can_read_trip`, événements acteur, claim service-only.

## 4. Décisions et écarts

1. **Grants explicites + durcissement** (M9 `20260911138000`) : Supabase accorde par défaut
   EXECUTE aux rôles `anon`/`authenticated` sur les fonctions ; les RPC de traitement
   (`claim_pending_adventure_events`, `a1_sync_terrain_report_counts`, et par extension
   `claim_pending_ai_jobs` préexistant) sont désormais révoquées pour ces rôles.
2. **Vue publique Terrain Live** volontairement `SECURITY DEFINER` : la table de base n'a
   aucune policy publique (aucune fuite de `reporter_id`), la vue filtre statuts/expiration.
3. **« Base vide migrable »** : non satisfaite (replay cassé lot7-10, ruling a0) — la gate est
   remplacée par la validation sur copie de la base existante.
4. **À vérifier lors de la validation sur copie** (issue de l'audit a0) : la policy
   `public_read_user_profiles` (créée en `20260713210000`) doit être contrôlée et, si elle
   expose encore le profil, corrigée par une migration dédiée (traitée en Phase 9 hardening
   documenté ou en correctif immédiat selon le résultat sur copie).

## 5. Gate manuelle restante (nécessite une copie de la base)

```bash
supabase db push --db-url "<COPIE_DATABASE_URL>"      # applique les 9 migrations A1 (additives)
supabase test db --db-url "<COPIE_DATABASE_URL>"      # exécute les suites pgTAP (dont a1_domain_security)
```

Puis vérifications de sécurité recommandées sur la copie :

```sql
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'user_profiles';
SELECT has_function_privilege('authenticated', 'public.claim_pending_adventure_events(integer)', 'EXECUTE');
```

## 6. État

- Domaine TypeScript : **réalisé et testé** (46 tests, contrats Zod).
- Migrations : **écrites, additives, idempotentes, statiquement contrôlées** ; application et
  pgTAP à exécuter sur copie (gate manuelle).
- Sécurité : RLS 4 niveaux, seuils publics, aucun connecteur santé réel, aucun octroi
  `external_readiness`.
- Aucune fonctionnalité visible activée (conforme à la gate de sortie Phase 1).
