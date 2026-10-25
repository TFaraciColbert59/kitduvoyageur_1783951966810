# Livraison — Récompenses LKDV (points, objectif, catalogue financé)

25 octobre 2026 · branche `claude/recompenses-lkdv` · plan et preuves : [PLAN-IMPLEMENTATION.md](PLAN-IMPLEMENTATION.md) · audit : [AUDIT-RECONCILIATION.md](AUDIT-RECONCILIATION.md).

## 1. Ce qui est livré

| Couche | Contenu |
|---|---|
| Base (migration additive `supabase/migrations/20261025120000_rewards_points_v1.sql`) | Index unique `loyalty_history (user_id, source_id)` ; `kill_switches.rewards_active=false` (émission sociale legacy coupée, `cashout_active` conservé) ; `reward_config.points_program` **fermé** (barème pilote C, plafond 250/semaine, producteurs fermés) ; `reward_catalog_funding` privé (coût, financeur, budget, stock — toutes les lignes existantes `unfunded`) ; colonnes publiques de conditions sur `loyalty_rewards` ; réservation/annulation/idempotence sur `loyalty_redemptions` ; tables `reward_goals`, `reward_awards` (RLS lecture propriétaire) ; fonctions `rewards_award_points`, `rewards_decide_award`, `rewards_reverse_award`, `rewards_redeem`, `rewards_cancel_redemption`, `rewards_set_goal`, `rewards_wallet_snapshot` (SECURITY DEFINER, `search_path` verrouillé, service_role seul). |
| Contrat pur | `src/features/rewards/domain/{contract,catalog,wallet,redemption}.ts` : unité, barème, plafonds, décision « gain entier ou rien », réclamabilité, objectif, états d'affichage, parcours d'échange. |
| Serveur | `src/features/rewards/server/rewardsService.ts`, routes `GET /api/rewards/wallet`, `PUT|DELETE /api/rewards/goal`, `POST /api/rewards/redeem`, actions admin `cancel_redemption`, `reverse_award`, `decide_award` dans `/api/admin/rewards` (+ validation de `points_program`). |
| Fermetures legacy | `/api/rewards/claim` → 410 sans appel base ; appels clients retirés (messages de groupe, création de carnet) ; `/api/loyalty/earn` passe par `rewards_award_points` (fermé) ; `/api/loyalty/redeem` → 410 (remplacé) ; `/api/rewards/withdraw` validé par zod sans fuite SQL. |
| Interface | Tiroir React « Récompenses » dans le Compte (`rewards_drawer`, `DrawerShell`, volets Récompenses / Historique), entrée du tiroir Compte renommée, `?tab=fidelite|recompenses` ; page `/recompenses` refondue ; `/fidelite` → redirection permanente ; promesses retirées (paliers et gains fictifs de `/fidelite`, « Reward Pool », bonus de badges, `FideliteTab` mort) ; cash et crédit créateur jamais additionnés. |
| Outils | `scripts/rewards/db-verify.mjs` + `supabase/tests/rewards/fixture_prod_subset.sql` (banc SQL sur copie locale), laboratoire des états `/dev/recompenses` (404 en production). |

## 2. Ordre de déploiement (actions de Tony)

1. **Relire et fusionner** la branche (aucune fusion dans `main` sans accord). Le code est compatible avec une base **sans** la migration : les routes `/api/rewards/wallet|goal|redeem` répondent alors « Solde indisponible » (fonction absente), sans casser le Compte ; `/api/rewards/claim` et `/api/loyalty/redeem` sont déjà fermés côté application.
2. **Appliquer la migration** en production (SQL Editor ou `supabase db push`), après une sauvegarde. Elle est idempotente (rejouée deux fois sur copie) et refuse de s'appliquer s'il existe des doublons `(user_id, source_id)` dans `loyalty_history` (0 au 25 octobre).
3. **Contrôles post-migration** (lecture seule) :
   ```sql
   select value from public.reward_config where key in ('kill_switches','points_program');
   select count(*) filter (where funding_status='unfunded') unfunded, count(*) from public.reward_catalog_funding;
   select p.proname, has_function_privilege('authenticated', p.oid, 'EXECUTE') auth_exec
     from pg_proc p where p.proname like 'rewards\_%';
   select count(*) from public.user_profiles p
    where coalesce(p.loyalty_points,0) <> coalesce((select sum(points) from public.loyalty_history h where h.user_id=p.id),0);
   ```
   Attendu : `rewards_active=false`, `emission_open=false`, toutes les lignes `unfunded`, `auth_exec=false`, 0 écart.
4. **Ajouter `CRON_SECRET`** au projet Vercel (environnement Production) : sans lui, `/api/cron/daily` répond 401 et les 42 intentions de carnets restent en attente (voir l'audit § 5). Ces intentions n'émettent que de l'XP.

## 3. Activation contrôlée (rien n'est ouvert par cette livraison)

Un objet ne devient réclamable que si son financement est démontré :

```sql
-- Par objet, seulement avec une enveloppe réellement disponible :
update public.reward_catalog_funding
   set funding_status = 'funded', cost_cents = <coût livré réel>, funder = '<financeur>',
       budget_reference = '<référence budgétaire>', stock_remaining = <stock réel>
 where reward_id = '<id>';
update public.loyalty_rewards
   set fulfillment = 'physical|voucher|service|digital', terms = '<conditions>', terms_version = '<version>',
       partner_disclosure = '<partenaire, si sponsorisé>'
 where id = '<id>';
```

La contrainte `reward_catalog_funding_complete` refuse « funded » sans coût, financeur, budget et stock.

Ouvrir de nouveaux gains exige, **dans cet ordre** : un producteur qui appelle `rewards_award_points` après une preuve serveur (aucun n'est branché aujourd'hui, `rapport_expedition` n'a pas de règle), un budget d'émission, puis `emission_open=true` et `producer_open=true` pour la seule règle concernée, via `/api/admin/rewards` (`update_config`, valeur validée). Décision réservée à Tony.

## 4. Surveillance

```sql
-- Émission par semaine et par règle (doit rester ≤ 250 par membre)
select period_start, rule_key, status, count(*), sum(points)
  from public.reward_awards group by 1,2,3 order by 1 desc;
select user_id, period_start, sum(points) from public.reward_awards
 where status in ('pending','confirmed') group by 1,2 having sum(points) > 250;   -- attendu : 0 ligne
-- Échanges et stock
select status, count(*), sum(points_spent) from public.loyalty_redemptions group by 1;
select reward_id, funding_status, stock_remaining from public.reward_catalog_funding where funding_status='funded';
-- Intégrité journal ↔ profil (attendu 0) et soldes négatifs (attendu 0)
select count(*) from (select user_id, sum(points) s from public.loyalty_history group by 1) t where s < 0;
-- Intentions de progression
select state, count(*), max(attempts) from public.progression_award_intents group by 1;
```

Journaux applicatifs : préfixe `[rewards]` (code d'erreur SQL seulement, aucun identifiant ni message brut).

## 5. Retour arrière

- **Application** : revenir au commit précédent. Les anciennes routes fermées le restent tant que `kill_switches.rewards_active=false`.
- **Configuration** (sans redéploiement) : `update public.reward_config set value = jsonb_set(value,'{emission_open}','false') where key='points_program';` coupe toute nouvelle attribution ; `funding_status='suspended'` retire un objet des échanges.
- **Base** : la migration est additive. Pour la retirer après coup, sans perdre d'écriture : `drop function` des fonctions `rewards_*`, puis tables `reward_goals`, `reward_awards` (après export si elles contiennent des décisions), `reward_catalog_funding`, colonnes ajoutées et index. Rétablir `rewards_active=true` **rouvrirait** l'émission sociale legacy : à ne faire que sur décision explicite. Aucune ligne de `loyalty_history` n'est jamais supprimée : les compensations sont des écritures inverses.

## 6. Limites connues

- Tests de bout en bout connectés non exécutés : la connexion à un compte de production n'est pas autorisée à l'agent et la migration n'est pas appliquée. Couverture à la place : 51 contrôles SQL sur copie locale, tests de routes, de domaine et de composants, laboratoire visuel `/dev/recompenses`.
- Les 4 échanges « fulfilled » sans débit et les 4 contributions legacy en attente restent à arbitrer (audit § 3–4).
- `MUT.usecredit` du runtime Compte bascule un état local « crédit appliqué » : visible seulement si un crédit boutique existe (0 au 25 octobre) ; à brancher sur le panier ou retirer.
- 6 tests de `tests/design/compte-refonte-v11.spec.ts` échouent déjà sur `26a8c1b` (CSS absente de `CompteLiquidGlassV8.tsx`), indépendamment de ce chantier.
