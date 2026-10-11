# Déploiement production — runbook de lancement

Mise à jour : 20 septembre 2026 · Branche `feat/mobile-direction-progression`.
**Ce runbook n'est pas encore exécuté.** Il liste les étapes exactes, les prérequis GO/NO-GO et les points de retour arrière.

## 0. Identité vérifiée (lecture seule, 20/09)

| Élément | Valeur | Preuve |
|---|---|---|
| Projet Supabase lié | `icxyvwzfjbflcbqukpfz` (« lekitduvoyageur2 », eu-west-3) | `npx supabase projects list` |
| URL de l'app | pointe bien vers ce projet | `.env.local` (sans afficher les secrets) |
| Autre projet visible | `lwrmuggefbmboikjgudc` (« LKDV »), **non lié** | ne pas confondre, ne pas y toucher |
| Dernière migration appliquée en production | `20260913210000` | `npx supabase migration list --linked` |
| Migrations en attente (lot sûr) | **22** (4 préexistantes renommées + 18 du programme) | `npx supabase db push --dry-run --linked` |
| Migration différée | 1 (`supabase/migrations_deferred/`) | à appliquer après déploiement de l'app |

## 1. Prérequis GO/NO-GO (bloquants)

| Porte | Critère | État |
|---|---|---|
| Revue visuelle mobile | Captures 390×844, 430×932, 768×1024, 1440×900 inspectées ; baselines visuelles régénérées après revue | **Non fait** |
| Appareils réels | Parcours clés sur iPhone (cible + petit) et Android intermédiaire : safe areas, clavier, reprise, splash, hors-ligne | **Non fait** |
| Charge + canari | Scénario 2× sur environnement autorisé, puis 1 % → 5 % → 25 % → 100 % | **Non fait** |
| Sauvegarde vérifiée | Backup récent **restauré avec succès** sur une base jetable | **Non fait** |
| Accès plateforme | CLI/console d'hébergement et stores | **Absents sur cette machine** |

Tant que ces lignes ne sont pas vertes, un lancement mondial ne peut pas être
déclaré « nickel » : le code est vérifié localement, pas l'expérience réelle.

## 2. Répétition générale (staging, obligatoire)

1. Obtenir un backup récent de production (Dashboard → Database → Backups, ou `pg_dump` avec l'URL DB).
2. Restaurer ce backup dans une base jetable (`lkdv-staging`).
3. Appliquer le lot sûr (22) : `npx supabase db push --db-url "<staging-url>?sslmode=require"`.
4. Vérifier : les 16 suites pgTAP passent (`204/204`), puis smoke tests app sur staging (`/`, `/connexion`, `/hub`, `/materiel`, `/progression`, `/explorer`, `/recompenses`) et un parcours réel : préparation → sortie → carnet → gain unique.
5. Contrôler l'état des flags : `local_leaderboard_active` **OFF**, anglais **OFF**.
6. Relever les requêtes lentes (`pg_stat_statements`) et la taille des tables de progression après seed.

## 3. Migration de production (fenêtre courte)

```powershell
# Contrôle avant : 22 attendues
npx supabase db push --dry-run --linked
# Application (chaque migration additive ; aucune donnée économique réécrite)
npx supabase db push --linked
```

Contrôles immédiats après push :

```sql
-- Tables du moteur présentes
SELECT count(*) FROM information_schema.tables
 WHERE table_schema='public' AND table_name IN
 ('user_progression','user_season_progress','progression_events','progression_rules',
  'progression_outbox','progression_decisions','progression_leaderboard_agg');
-- attendu : 7

-- L'ancienne app doit continuer de fonctionner pendant la fenêtre :
SELECT has_function_privilege('authenticated','public.claim_reward_points(uuid,text,uuid,text,jsonb)','EXECUTE');
-- attendu : true (le REVOKE est différé à l'étape 5)

-- Flags sûrs
SELECT id, enabled FROM public.feature_flags
 WHERE id IN ('local_leaderboard_active');
-- attendu : false
```

## 4. Déploiement de l'application

1. Ouvrir la PR `feat/mobile-direction-progression` → `main` (CI : tests, build-ios, Lighthouse, régression visuelle).
2. Merger après CI verte ; déployer la plateforme habituelle.
3. Canari : 1 % → 5 % → 25 % → 100 %, à chaque palier :
   - erreurs 5xx, latence p95 des routes `/api/progression*`, `/api/rewards/claim` ;
   - sonde `node scripts/ops/progression_outbox_health.mjs` (`ok=true`, retards < seuils) ;
   - un gain réel visible dans `/progression` après rechargement.
4. Arrêt sur régression : rollback plateforme (déploiement précédent) — la base reste compatible (migrations additives).

## 5. Migration différée (après app à 100 %)

```powershell
psql "$env:LKDV_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations_deferred/20260922000000_claim_revoke_after_app_deploy.sql
npx supabase migration repair --status applied 20260922000000 --linked
```

Puis : `has_function_privilege('authenticated', …claim_reward_points…)` doit être `false` et `/api/rewards/claim` doit fonctionner (service role).

## 6. Planification et exploitation

- Planifier `POST /api/cron/progression-outbox` (5 min) et `POST /api/cron/leaderboard-refresh` (15 min) — voir `PERFORMANCE.md` §6.
- Suivre `OPERATIONS.md` (seuils, rejeu `dead`, purge, cycle des saisons §2bis).
- Le flag `local_leaderboard_active` reste **OFF** jusqu'à validation anti-triangulation sur appareils réels.

## 7. Retour arrière

| Niveau | Action | Conséquence |
|---|---|---|
| App | Redéployer la version précédente | immédiat |
| DB « notre lot » | Appliquer les descentes `supabase/migrations_down/20260920*` / `20260921*` en ordre inverse (psql, base de test d'abord) | les 4 migrations préexistantes renommées n'ont pas de descentes : forward-only |
| DB « incident majeur » | Restaurer le backup de l'étape 2 | perte des écritures depuis le backup, à assumer explicitement |

## 8. Ce qui ne peut pas être fait depuis cette machine

- Aucune CLI d'hébergement (`vercel`, `netlify`, `gh`) n'est installée : la PR et le canari se font depuis la console GitHub/plateforme.
- Aucun build iOS/Android possible (pas de macOS, pas de comptes stores) : la validation appareils et les soumissions restent côté porteur.
- La sauvegarde/restauration de production exige l'accès au Dashboard (ou le mot de passe DB, absent de l'environnement local).

---

## 9. Complément P2.0 — flags, cohortes et réévaluation (T47, 2026-10-11)

### Flags séparés (familles indépendantes)

| Flag | Portée | Défaut | Activation |
|---|---|---|---|
| `progression.ui.card` | carte compacte + sheet | déjà livrée (lecture) | pas de flag requis (lecture seule, cache privé) |
| barème v2 | moteur d'attribution | **fermé** (`draft_closed`) | publication journalisée (T42) + date d'effet, jamais de recrédit |
| `adaptateurs` | activités hors randonnée | **fermé** (registre P3) | critères publiés + source de données vérifiée |
| `passeport` | découvertes privées | livré privé par défaut | aucune exposition publique |
| `coopération` | sorties/tâches/prêts | **fermé** (producteurs prouvés, émission v2 close) | preuve + population |
| `ligues` | cohortes | **fermé** (`population_insuffisante` tant que < 20 réels) | opt-in + population réelle |
| émission commerciale | fidélité/parts | **fermée** : encaissement autoritaire en place, webhook à brancher (T38) | financement + réconciliation vérifiés |

Ces familles sont indépendantes : couper l'une n'affecte jamais les autres ni
les journaux déjà écrits.

## Marche de déploiement (canari par conditions, pas par minuterie)

1 → 5 → 25 → 100 % **seulement si**, à chaque palier :

- scan d'anomalies 0 écart non-démo (`phase1_points_anomaly_scan.mjs`) ;
- outbox sans `dead`, retard ≤ 15 min (`progression_outbox_health.mjs`) ;
- parcours source→intention→décision→outbox→projection observé sur les
  compteurs (décisions = transactions = événements après rattrapage) ;
- coûts/refus dans les budgets mesurés (T45).

L'outillage : `node scripts/ops/progression_rollout_check.mjs` (lecture seule).

## Retour arrière

- **Applicatif** : redéployer le déploiement Vercel précédent — les journaux
  (décisions, transactions, événements, claims, intentions) et les nouveaux
  droits restent intacts ; la reprise les lit tels quels.
- **Migrations** : chaque migration du chantier a une descente
  (`supabase/migrations_down/`) qui **ne supprime aucun journal ni droit** ;
  retirer les triggers legacy de T38 est le seul changement de comportement
  majeur, sa descente les restaure.
- **Émission** : couper un producteur = le retirer du barème publié
  (journalisé T42) ; jamais de suppression de droits acquis.
- **Compensation** : toute correction future passe par un mouvement lié et
  motivé (journal), avec recours — jamais d'édition opaque de solde.
