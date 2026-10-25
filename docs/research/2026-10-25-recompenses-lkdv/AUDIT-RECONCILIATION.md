# Audit des chemins réels et réconciliation — 25 octobre 2026

Lectures seules en production (projet Supabase `icxyvwzfjbflcbqukpfz`, Vercel `prj_AqYb1FBEcyNGTZMVimBJXRDulyXp`), faites le 25 octobre 2026 vers 16 h UTC par `execute_sql` (SELECT uniquement) et les outils Vercel en lecture. Aucune écriture, aucun POST de gain, d’échange ou de retrait. Aucun identifiant de membre n’est recopié ici.

## 1. Appelants réels (code de la branche, révision `26a8c1b`)

| Route | Appelant monté | Effet économique | Constat |
|---|---|---|---|
| `POST /api/rewards/claim` | `components/groupes/DiscussionCard.tsx` (chaque message de groupe, `target_id` = **id du groupe**, pas du message) ; `app/carnets/page.tsx` (création de carnet) | `claim_reward_points` via rôle service → `pending_contributions` + `reward_transactions` (auto-approuvé pour `group_message`, `like` ; carnet si confiance ≥ 60) | Le fait déclencheur n’est pas vérifié en base ; 30 messages/jour × 2 points crédités sur simple appel. **Émission ouverte.** |
| `POST /api/rewards/withdraw` | ancien `/recompenses` (« Reward Pool »), `FideliteTab` (non importé) | `request_withdrawal` (session utilisateur) | Corps non validé (montant non typé, métadonnées libres), message SQL renvoyé tel quel. |
| `POST /api/loyalty/earn` | `app/rapport-expedition/page.tsx` | `legacy_loyalty_earn` +75 | Vérifie seulement l’existence et la propriété du rapport ; pas de critère d’utilité. **Émission ouverte.** |
| `POST /api/loyalty/redeem` | `app/fidelite/page.tsx` | `legacy_loyalty_redeem` | Aucun contrôle de financement, coût, stock ; statut `completed` immédiat. |
| `POST /api/loyalty/spend` / `refund` | `app/panier/page.tsx` (article offert) | `legacy_loyalty_spend` / `cart_refund` | Idempotent par `source_id`, verrou profil : conservé tel quel. |
| `GET /api/cron/progression-awards` | `/api/cron/daily` (seul cron `vercel.json`) | consomme `progression_award_intents` | Voir § 5. |

Écrans montés porteurs de promesses : `/fidelite` (paliers « 5 % à 20 % de réduction », « livraison gratuite », gains « avis +50, parrainage +200, kit partagé +100, photo +75, anniversaire +150 » sans producteur), `/recompenses` (« La plateforme partage la valeur réelle… recevez votre part du Reward Pool »), tiroir Compte « Fidélité » (« paliers et récompenses s’afficheront ici »). `FideliteTab.tsx` : aucun import (recherche `FideliteTab` dans `src` : sa seule définition).

## 2. Définitions vivantes relues

- `claim_reward_points` : interrupteur `kill_switches.rewards_active` lu avec `COALESCE(…, true)` ; branches like/message auto-approuvées ; pas de vérification d’existence du message/like. EXECUTE : `service_role` seulement.
- `legacy_loyalty_earn|spend|redeem|cart_refund` : `SECURITY DEFINER`, `search_path` verrouillé, verrou `user_profiles … FOR UPDATE`, solde = `SUM(loyalty_history.points)`. EXECUTE : `service_role` seulement.
- `sync_loyalty_points` (trigger `AFTER INSERT OR DELETE OR UPDATE` sur `loyalty_history`) recalcule `user_profiles.loyalty_points` ; sur `DELETE` il lit `NEW` (nul) et ne resynchronise pas : le journal doit rester en ajout seul.
- `loyalty_history` : **aucun index unique** sur `(user_id, source_id)` ; l’idempotence repose uniquement sur le verrou profil + `EXISTS`. Doublons actuels : 0 (13 lignes avec `source_id`).
- RLS : `loyalty_history`, `loyalty_redemptions` lecture propre ; `loyalty_rewards` lecture publique, écriture admin.
- Interrupteurs : `rewards_active=true`, `cashout_active=true` ; `action_base_points` like 1, group_message 2, comment 10, post 20, carnet 100, referral 200 ; plafonds de confiance `trust_level_caps`.

## 3. Réconciliation fidélité (unité « points » grand public)

| Contrôle | Résultat |
|---|---|
| Membres dont `SUM(loyalty_history)` ≠ `user_profiles.loyalty_points` | **0** |
| Total journal = total profils | 114 090 = 114 090 |
| Détenteurs | 60 profils, dont 0 marqué `is_demo` |
| Origine | `earn` 102 lignes / 86 640 (libellés « Bienvenue dans le programme », « Sorties et contributions », horodatages ronds 16:00:00, 51 membres) ; `opening_balance` 10 / 10 690 ; `earned` 3 / 8 380 ; `purchase` 3 / 8 380 |
| Échanges `loyalty_redemptions` | 4, statut `fulfilled`, 5 120 points, **sans écriture de débit** dans le journal |

Écart à signaler : les 4 échanges « fulfilled » n’ont pas de débit correspondant. Les horodatages ronds et les domaines d’adresse des détenteurs (50 sur `voyageurs.lkdv.app`, 8 sur `email.fr`) suggèrent des données d’amorçage, **sans que ce soit démontré**. Décision : ne rien débiter rétroactivement (cela retirerait des points à des comptes dont le statut réel n’est pas établi) ; écart consigné, arbitrage laissé à Tony. Aucune ligne n’est supprimée.

## 4. Réconciliation économique (parts et cash, unité distincte)

| Contrôle | Résultat |
|---|---|
| `reward_accounts.available_points` ≠ somme `reward_transactions` (affects_balance) | 0 compte |
| `pending_points` ≠ somme `pending_contributions` en attente | 0 compte |
| `lifetime_points` ≠ somme positive | 0 compte |
| Transactions | `ADMIN_ADJUSTMENT` 2 / 2 468 ; `LIKE_REWARD` 10 / 10 ; `GROUP_REWARD` 6 / 12 ; `PROGRESSION_AWARD` 15 / 9 400 (`affects_balance=false`) |
| Contributions en attente | 4 (2 commentaires, 2 publications ; 50 points ; depuis août) |
| Cash disponible / en attente / retraits | 0 € / 0 € / aucune demande |

Ces points économiques ne sont pas des points fidélité : ils ne sont **jamais additionnés** au solde grand public. Les 4 contributions en attente restent « en vérification » : les approuver émettrait des droits (fermé), les rejeter retirerait une attente à des membres ; arbitrage laissé à Tony via `/api/admin/rewards` (`process_contribution`).

## 5. Les 42 intentions de carnets en attente

| Fait | Source |
|---|---|
| 42 `pending`, `attempts = 0`, créées entre le 22 oct. 20:51 et le 23 oct. 21:19 UTC | `progression_award_intents` |
| 11 `refused` (`carnet_non_rattache` ×10, `carnet_introuvable` ×1), `attempts = 1` | idem |
| Le consommateur HTTP n’est appelé que par `/api/cron/daily` (et un drain de 2 intentions du membre connecté dans `GET /api/progression`) | `src/lib/cron/dailyTasks.ts`, `src/app/api/progression/route.ts` |
| `/api/cron/daily` exige `CRON_SECRET` et répond 401 sinon | `src/app/api/cron/daily/route.ts` |
| **`CRON_SECRET` n’existe dans aucun environnement du projet Vercel** | `filter_project_envs`, 25 oct. |
| Les journaux d’exécution au-delà d’une heure ne sont pas conservés (offre Hobby) | Vercel, erreur 400 de rétention |
| Crons SQL actifs : outbox, leaderboard, purge, rapport quotidien, purge anonymes — aucun pour les intentions | `cron.job` |

Cause la plus probable, fortement étayée mais non observée dans un journal : le cron quotidien est refusé (401) faute de secret, donc le consommateur ne tourne jamais ; les 11 refus viennent d’un traitement synchrone à la création. Action de reprise : ajouter `CRON_SECRET` au projet Vercel (secret réservé à Tony), puis le cron du lendemain consommera 50 intentions par tir. Ces intentions produisent de l’XP de progression (`affects_balance=false`) : elles n’émettent aucun point dépensable, aucun bonus rétroactif n’est ajouté.

## 6. Production déployée

Déploiement de production `dpl_45ed9BToPhW5VSatZCZJ2BZPPiJr`, créé le 24 oct. 2026, sans métadonnée Git : impossible de prouver quelle révision du code est servie. Les constats « code » ci-dessus portent sur la branche locale.
