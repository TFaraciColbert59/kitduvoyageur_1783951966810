# A13 (S3) — Groupe, trek et entitlements (produit + serveur + Stripe)

Branche : `audit/adventure-intelligence` (worktree `ai-finalization`), base locale
`postgresql://…@127.0.0.1:54322/postgres`. Plan source :
`docs/superpowers/plans/a13-l3-produit-bout-en-bout.md` (flux S3). Périmètre :
persistance groupe/trek en versions de plan, routes serveur, entitlements
serveur + bilan Stripe explicite, quotas `full_generation`, UI mobile montée
dans le cockpit collectif. Aucun flag modifié, aucun secret commité, aucun push
distant, migration appliquée en local uniquement.

## Commits

| Commit | Sujet | Périmètre |
| --- | --- | --- |
| `610f1891` | `feat(db): A13 S3 entitlements utilisateur + append version plan (RPC service_role, pgTAP 17)` | 2 migrations + pgTAP |
| `250135fc` | `feat(ai): S3 groupe, trek et entitlements serveur (snapshot versionne, gating 402, Stripe metadonnees)` | domaine + serveur + routes + tests |
| `3be4ba98` | `feat(ui): S3 bloc groupe et vue trek montes dans le cockpit collectif (tokens lkv, 44px, reduced motion)` | UI + montage + tests render |
| ce commit | `docs(a13): rapport S3 groupe, trek et entitlements` | ce rapport |

## A. DDL — migrations additives (`610f1891`)

1. `20260911440000_a13_append_plan_version.sql` :
   - `public.a13_append_plan_version(p_user_id uuid, p_plan_id uuid, p_version jsonb)
     RETURNS integer` — `SECURITY DEFINER`, `search_path = public, pg_temp`,
     `REVOKE public/anon/authenticated`, `GRANT service_role` uniquement.
   - Transaction unique : propriété vérifiée sous `FOR UPDATE` (plan inconnu ⇒
     `… introuvable`, non-propriétaire ⇒ `… non détenu`), `version = GREATEST(
     current_version, MAX(version)) + 1`, insertion version, mise à jour
     `adventure_plans.current_version/updated_at`.
   - Le numéro fait autorité en base : `snapshot.currentVersion` est réécrit par
     `jsonb_set` avec la version réellement insérée (aucune divergence).
   - Garde-fous : `p_version.snapshot` objet et `reason` non vide obligatoires.
2. `20260911450000_a13_user_entitlements.sql` : table additive
   `public.user_entitlements` (`user_id` PK, `plan` CHECK catalogue,
   `active_passes jsonb` tableau, `source` CHECK, timestamps) + RLS (lecture de
   sa propre ligne par `authenticated`, `service_role` all) + trigger
   `set_updated_at`. Aucun prix ni produit ici : le domaine reste l'autorité.

## B. Domaine et serveur (`250135fc`)

- `domain/planGroupTrek.ts` (+ `schemas/groupTrek.schema.ts`) : étapes blueprint
  explicites (`blueprint_uniform`, distribution uniforme des agrégats — `[]` si
  aucun agrégat), projection publique
  `summarizeGroupPlanPublic` (allure, difficulté, limitant, séparation,
  redistribution **agrégée**, plage de difficulté), payloads de version
  `group-computed` / `trek-computed`, relectures validées (snapshot non conforme
  ⇒ `null`).
- `server/groupTrek.ts` : source de données injectée (`GroupTrekDataSource`) +
  adaptateur Supabase service_role. Résolution crew (`crewId` explicite sinon
  `trips.crew_id`), accès strict (créateur ou membre actif), membres actifs,
  **consentement `personal_performance` vérifié avant toute lecture de profil**
  (fail-safe ; repli standard sinon), étapes `trip_steps` réelles sinon repli
  blueprint explicite sinon `stages_unavailable`. Persistance via la RPC.
- Routes : `POST/GET /api/adventure/[id]/group` (reason `group-computed`,
  `GET` = dernier payload **public**), `POST/GET /api/adventure/[id]/trek`
  (reason `trek-computed`), `GET /api/adventure/[id]/monitoring` (aucune route
  monitoring préexistante : cette route rend le gating `monitoring` réel).
  Auth 401, id 404, corps Zod 400, service 503, entitlement 402, ownership 403,
  calculs refusés explicites 400/409, absence de payload 404 (`group_plan_absent`
  / `trek_plan_absent`).
- Privacy : seuls des agrégats publics sont persistés dans
  `adventure_plan_versions.snapshot` ; identités, vitesses individuelles et
  limitations ne sont jamais stockées ni exposées.

## C. Entitlements serveur et Stripe (`250135fc`)

- `src/lib/entitlements/server.ts` : résolution `user_entitlements` (service),
  fusion de grants, `free` par défaut, fail-safe `unavailable`, gating pur
  (`entitlementGate`), `requireEntitlement` → **402**
  `{ error: 'entitlement_required', requiredPlan }` (plan requis via domaine),
  `generationQuotaFor` (free = 2/h, standard = 5/h).
- `POST /api/adventure/generate` : `full_generation` absent ⇒ quota réduit
  explicite (429 `quotaPerHour: 2`, `requiredPlan: explorer`, message gratuit) ;
  sous le palier, la génération reste possible (aucune fonction gratuite
  bloquée).
- `GET /api/billing/entitlements` : `configured`, `source`, `plan`,
  `activePasses`, `entitlements` + `stripe.{secretKey, priceIds}` en booléens.
  **Sans `STRIPE_SECRET_KEY`/price ids : `configured: false` explicite** —
  aucun prix inventé, aucune création de prix.
- Métadonnées Stripe existantes : `buildStripeCheckoutMetadata` accepte un grant
  optionnel `plan`/`pass` (validé par le domaine) et le webhook
  `checkout.session.completed` applique `grantEntitlementsFromMetadata`
  (fusion sans rétrogradation de plan, passes en union, best-effort non
  bloquant). Le checkout actuel ne fournit pas de grant (aucun price id
  configuré) : le chemin reste inerte, sans fake.

## D. UI mobile (`3be4ba98`)

- `ui/GroupPlanSummary.tsx` : allure collective, membre limitant + cause,
  redistribution plafonnée, risque de séparation, pauses — uniquement des
  agrégats ; états loading/absent/denied/error explicites ; cibles `min-h-[44px]`,
  tokens `--lkv-*`, `motion-reduce`, zéro orange, aucune identité.
- `ui/TrekPlanView.tsx` : journée critique, dérive max, capacité quotidienne,
  fatigue, ajustements proposés (libellés + raisons).
- `ui/GroupTrekPanel.tsx` (client) : résout le dernier plan accessible
  (préférence : `trip_id` du voyage lié, sinon plus récent), lit les payloads
  persistés et déclenche les calculs POST ; helpers de mapping testables
  200/402/404/500.
- Montage dans `src/features/hub/components/collectif/HubGroupeCockpit.tsx`
  (composant existant de `src/features/hub/components/**`) — **aucune
  modification de `src/app/hub/[section]/page.tsx`**.

## E. Preuves TDD / TAP

TDD strict RED → GREEN (tests écrits avant implémentation) :

| Étape | Preuve |
| --- | --- |
| RED pgTAP | `ERROR: function public.a13_append_plan_version(uuid, uuid, jsonb) does not exist` — `Failed 17/17 subtests` |
| GREEN pgTAP (fichier seul) | `Files=1, Tests=17, Result: PASS` |
| Suite pgTAP complète | `Files=13, Tests=205, Result: PASS` (0 `not ok`) |
| RED vitest | `Cannot find package '@/features/adventure-intelligence/domain/planGroupTrek'` (0 test) |
| Suite vitest complète | `Test Files 272 passed | 1 skipped (273)` ; `Tests 1958 passed | 6 skipped (1964)` |
| Static | `npm run type-check` exit 0 ; `npm run lint` exit 0 ; `node scripts/verify/ci_invariants.mjs` exit 0 |
| Migration | appliquée en local (`supabase migration up --db-url …54322`) ; aucun push |

Couverture vitest (40 tests S3) : `TEST-A13-GROUP-01..10` (projection publique,
payload version sans privé, consentement gate, accès crew, étapes, relectures,
API 401/402/403/404/400/409/200, GET public), `TEST-A13-TREK-01..07` (étapes
blueprint, version, relecture, API, 409), `TEST-A13-ENT-01..18` (résolution,
inconnus refusés, 402, fail-safe, parses métadonnées, config Stripe booléenne,
quotas, fusion de grants, billing 200/401/unavailable, grants webhook),
`TEST-A13-*-UI-01..03` (render statique, états, helpers de montage).

Couverture pgTAP : append propriétaire (version + snapshot forcé),
`current_version`/`updated_at`, version successive, refus non-propriétaire sans
écriture, plan inconnu, snapshot/reason manquants, `SECURITY DEFINER` +
`search_path` verrouillé, EXECUTE réservé à service_role.

## F. Écarts / points d'attention

- **Stripe non configuré** : aucune clé ni price id dans `.env.local` ⇒
  `configured: false`, plan `free`, entitlements vides ; les routes S3 renvoient
  donc 402 sans grant réel. Le câblage métadonnées/webhook est prêt mais inerte
  tant que le catalogue Stripe n'est pas configuré — **aucun prix inventé**.
- `user_entitlements` est une table additive : les grants peuvent être posés
  manuellement (`source='manual'`) en attendant le catalogue Stripe.
- La route monitoring est **nouvelle** (aucune n'existait) : elle expose
  exactement `adventure_plan_versions`/`adventure_plans.monitoring_rules` avec
  gating 402.
- Ownership strict propriétaire sur les routes S3 (un collaborateur de voyage
  reçoit 403) — choix conservateur, aligné sur `/select`.
- Le snapshot ne persiste que la projection publique du groupe (les vitesses
  individuelles ne sont jamais stockées) : un futur besoin d'édition fine
  nécessitera un payload interne chiffré/consenti, hors périmètre S3.
- Pas de renderer DOM dans le projet : l'UI est couverte par render statique
  ciblé + helpers de mapping ; l'E2E a11y Playwright complet reste au flux S9.
- Le repli d'étapes `blueprint_uniform` est une répartition uniforme explicite
  (source déclarée dans le payload et l'UI), jamais silencieuse.
