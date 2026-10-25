# Audit de l’existant — GitHub, code local et Supabase

Lecture du 25 octobre 2026, sans écriture applicative ni modification de la base. Ce relevé porte sur les circuits de récompense et leur raccordement ; ce n’est pas un audit de sécurité exhaustif. Les observations distantes sont enregistrées dans [evidence/](evidence/). Elles ne contiennent ni identités de membres ni clés d’accès.

## 1. Périmètre et niveau de preuve

- Dépôt GitHub public confirmé par le connecteur : `TFaraciColbert59/kitduvoyageur_1783951966810`, branche par défaut `main` ; voir [métadonnées](evidence/github-repository.json).
- Révision locale observée : `26a8c1bdb73cd164487a00ce50641ec0454f6591`, datée du 25 octobre, sujet `feat(ui): Liquid Glass iOS 27 bottom navigation component`. Les modifications déjà présentes sur la page de démonstration bottom bar, `IOS27BottomBar.tsx` et `account-glass.css` n’ont pas été éditées par cette recherche.
- Le connecteur GitHub a relu [PRODUCER_MATRIX.md](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/main/docs/progression/PRODUCER_MATRIX.md) et [droits-et-couts.md](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/main/docs/progression/2.0/droits-et-couts.md). Ils concordent avec les documents locaux inspectés. Cela ne prouve pas l’identité de toutes les branches ni la version du frontend déployé.
- Supabase : projet `lekitduvoyageur2`, ref `icxyvwzfjbflcbqukpfz`, `ACTIVE_HEALTHY`, PostgreSQL 17, région Paris. [Métadonnées projet](evidence/supabase-project.json), [366 migrations enregistrées, dernière version `20261021165000`](evidence/supabase-migration_summary.json). Un ledger de migrations ne prouve pas que toutes les fonctions correspondantes sont exploitées ni que tous les tests passent.
- Les valeurs de `pg_class.reltuples` dans [tables](evidence/supabase-tables.json) sont des estimations ; les nombres ci-dessous viennent de `COUNT(*)` dans [current_counts](evidence/supabase-current_counts.json). Les différentes requêtes ne sont pas un snapshot transactionnel commun : un trafic concurrent peut faire varier les totaux.

## 2. Ce qui existe réellement

| Circuit | Autorité et journal | Observation actuelle | Décision proposée |
|---|---|---|---|
| XP personnels | `user_progression`, événements, décisions, règles ; transactions marquées `counts_for_progression` et `affects_balance` | 51 projections, 15 événements, 0 décision canonique ; seul `v1` actif | Conserver moteur, preuves et idempotence ; rendre la présentation secondaire |
| Fidélité dépensable | `loyalty_history`, `loyalty_rewards`, `loyalty_redemptions` ; RPC `legacy_loyalty_*` | 118 écritures, 39 lignes catalogue, 4 échanges | Candidat à la porte grand public « Mes points », après inventaire des droits et du financement |
| Parts économiques et cash | `reward_accounts`, `reward_transactions`, `reward_periods`, `pending_contributions` | 251 comptes, 33 transactions ; pool enregistré nul ; anciens circuits d’émission toujours configurés actifs | Conserver droits acquis ; isoler et contrôler les nouveaux producteurs |
| Crédit boutique créateur | `store_credit_ledger`, attributions et royalties | 0 mouvement dans ce journal, total de crédits boutique observé nul | Conserver le circuit et la traçabilité, hors compteur de points si unités différentes |
| Badges | `badges`, `user_badges`, `progression_badge_links` | Tables présentes avec RLS ; documentation nouvelle prévoit 0 bonus XP | Conserver trophées ; vérifier et corriger les promesses d’anciens écrans |

Sources : [comptages](evidence/supabase-current_counts.json), [colonnes](evidence/supabase-columns.json), [agrégats économiques](evidence/supabase-balance_aggregates.json), [périodes](evidence/supabase-periods.json). Les agrégats mélangent potentiellement comptes de démonstration et réels : ils ne permettent pas de déterminer une dette commerciale opposable. Pas d’inférence de trésorerie bancaire à partir d’une table.

## 3. Corrections au relevé préliminaire fourni

1. **Le plafond de 1 080 XP/semaine est un contrat v2 proposé, pas le plafond global actif démontré.** La base contient seulement `v1.active=true`, sans registre v2 publié. Le payload v1 a sept actions et leurs propres limites ; il n’a pas les plafonds par famille du JSON v2. [Payload complet actif](evidence/supabase-live_v1.json), [registre v2 fermé](../../../docs/progression/2.0/rules-registry.json), [validation serveur](../../../src/features/progression/server/v2RuleRegistry.ts).
2. **Les titres du brief sont historiques ou approximatifs.** Les titres réels sont notamment « Randonneur Curieux », « Marcheur Averti », « Guide de Cordée », « Gardien des Horizons ». Les seuils 0/100/300/700/1500/3000/5500/9000/14000/20000 concordent entre code et base. [Règles](../../../src/features/progression/domain/rules.ts), [base](evidence/supabase-live_v1.json). Aucun titre ne doit être présenté comme diplôme ou pouvoir d’autorisation.
3. **Les bons 1 000→2 €, 2 500→5 €, 5 000→10 € sont des propositions nouvelles.** Le catalogue live contient d’autres produits et remises, tous signalés `available=true`, dont 500 points→10 € et 2 500→50 €. La présence d’un bouton ou d’une ligne disponible ne démontre pas que le bien est approvisionné ou que la prestation sera honorée. [Catalogue live](evidence/supabase-catalog.json).
4. **Les limites 10 % du panier et 25 % de marge existent comme fonction pure.** La recherche `rg` ne trouve `quoteVoucher` que dans sa définition et ses tests, ni intégration au checkout dans les fichiers inspectés. Même constat pour `allocatePool`. Il serait faux d’affirmer que ces gardes s’appliquent automatiquement aux échanges actuels. [quoteVoucher](../../../src/features/progression/domain/voucherValue.ts), [allocatePool](../../../src/features/progression/domain/fundedPool.ts).
5. **La fidélité actuelle ne vient pas seulement d’achats.** `/api/loyalty/earn` accepte une action serveur `rapport_expedition` à 75 crédits, vérifie l’existence et la propriété d’un `kit_reports` puis appelle une RPC. La seule existence d’un rapport n’est pas une validation de qualité. [Validation](../../../src/features/loyalty/validation.ts), [vérification serveur](../../../src/features/loyalty/server.ts), [route](../../../src/app/api/loyalty/earn/route.ts). La règle 10 crédits/€ ne suffit donc pas à expliquer tous les crédits présents.

## 4. Écart prioritaire : « fermé » dans les notes, encore ouvert dans le chemin hérité

Constats simultanés, sans tester de gain réel :

- Les notes du 11 octobre disent « aucun nouveau crédit like/message à ouvrir ». [Document relu sur GitHub](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/main/docs/progression/2.0/droits-et-couts.md).
- La configuration live donne `rewards_active=true`, `cashout_active=true` ; `action_base_points.like=1`, `group_message=2`, `comment=10`, `post=20`, `carnet=100`, `referral=200`. Des limites existent (likes 10/jour et 50/semaine), donc ce n’est pas une émission explicitement illimitée. [Configuration](evidence/supabase-reward_config.json).
- La fonction live `claim_reward_points` conserve des branches like/message auto-approuvées. Elle vérifie notamment statut du compte, auteur cible et limites ; sa définition inspectée ne vérifie pas qu’un vrai like/message de cet utilisateur existe dans la table métier correspondante. Le texte utilisé pour noter certains contenus provient de `p_metadata`. [Définition distante](evidence/supabase-function_claim.json).
- L’appel direct est refusé à `anon` et `authenticated`, autorisé à `service_role`. C’est une protection réelle à conserver. Cependant la [route authentifiée `/api/rewards/claim`](../../../src/app/api/rewards/claim/route.ts) transmet `action_type`, `target_id`, `target_type`, `metadata` à cette RPC avec le rôle service. La révocation SQL ne remplace pas une validation métier dans ce chemin.
- Les triggers inspectés ne ferment pas ces actions ; le trigger économique ignore uniquement les transactions ayant `affects_balance=false`. [Triggers](evidence/supabase-account_triggers.json), [permissions](evidence/supabase-functions.json). Les contraintes inspectées de `pending_contributions` ne montrent pas d’unicité métier ; il faut compléter par les index avant de conclure sur le rejeu.

**Conclusion limitée mais actionable :** la fermeture opérationnelle annoncée n’est pas établie et le chemin legacy exige une revue avant toute augmentation de valeur. Ce rapport ne prétend ni qu’un membre l’exploite, ni qu’un gain frauduleux a été obtenu. Aucun POST de récompense, retrait ou achat n’a été envoyé. Ne pas supprimer les écritures anciennes pour « nettoyer » cet écart.

## 5. Fiabilité du gain : attente distincte du confirmé

Lecture actuelle : 53 intentions de carnets, dont 42 `pending` et 11 `refused`. Les 42 attentes sont toutes échues depuis plus de 24 h ; leur compteur `attempts` maximal vaut 0, la plus ancienne disponibilité remonte au 22 octobre à 20:51 UTC. [États](evidence/supabase-states.json), [détail agrégé](evidence/supabase-intents_summary.json), [âge](evidence/supabase-intent_health.json).

Les 15 éléments de l’outbox sont `processed`. Cela ne prouve pas que les intentions en amont sont consommées. Trois crons SQL progression sont actifs (outbox, leaderboard, purge), mais le relevé de leurs noms ne contient pas le consommateur HTTP des intentions. Le code dispose d’une route cron et d’un drain opportuniste de deux intentions du membre dans `GET /api/progression`. Il faut vérifier séparément planification HTTP, secrets, déploiement frontend/backend et traffic, puis rejouer des sources autorisées en environnement isolé. Pas de diagnostic causal certain sur la seule lecture. [Crons](evidence/supabase-cron_summary.json), [consommateur](../../../src/features/progression/server/intentConsumer.ts), [API progression](../../../src/app/api/progression/route.ts), [API cron](../../../src/app/api/cron/progression-awards/route.ts).

Implication UX : afficher « Analyse en cours » jusqu’à la décision confirmée ; ne jamais faire `+50` puis attendre silencieusement un crédit hypothétique. Si hors ligne, enregistrer la demande locale et dédupliquer le rejeu. Si refus, montrer le motif compréhensible et un recours.

## 6. Catalogues et financement

Le catalogue est hétérogène et contient des répétitions de titres/tarifs. Il mélange réductions fixes, pourcentages, livraison, badges, produits et prestations. Le champ `value` est du texte : il ne suffit pas pour comptabiliser coût rendu, stock ou engagement de service. [Catalogue](evidence/supabase-catalog.json).

L’unique période enregistrée est `2026-08`, `OPEN`, avec revenu éligible, pool et distribution à 0 €. Les comptes totalisent 0 € de cash disponible et 0 centime de crédit boutique au relevé ; 2 comptes ont des points économiques positifs, total 2 490. Ces constats ne prouvent ni absence de dettes historiques hors table, ni que les points d’une famille sont convertibles dans une autre. [Période](evidence/supabase-periods.json), [agrégats](evidence/supabase-balance_aggregates.json).

Le programme d’objets gratuits doit donc être financé et raccordé à un stock réel. Une configuration à 15 % ou 5 000/mois n’est pas une provision. Le catalogue futur doit porter en unités typées prix en points, coût réel en centimes, financeur, disponibilité, livraison, version des conditions et règles de remboursement. Exigence proposée pour la migration : préserver les engagements acquis même après arrêt de l’émission nouvelle ; leur périmètre contractuel exact reste à inventorier.

## 7. À conserver, modifier ou retirer

| Conserver | Modifier | Retirer de l’émission nouvelle / des écrans |
|---|---|---|
| Journaux et soldes historiques ; sources métier ; transactions atomiques ; preuves serveur ; idempotence ; rôles service ; RLS | Portefeuille public simplifié ; catalogues versionnés et financés ; preuve des actions économiques ; reprise des attentes ; compensation des retours | Promesses de cash non adossées ; confusion XP/argent ; bonus badge dupliqué ; multiplicateur de partage sans limite ; affichage de cinq compteurs de premier niveau |
| Badges souvenir, réalisations, progression privée, niveaux conservés | Compétences et saisons accessibles en détail facultatif ; noms qui ne suggèrent pas de qualification | Compétition obligatoire, gain de vitesse/risque/SOS, récompense pour abandonner sa confidentialité |

La matrice détaillée des surfaces runtime et du code inactif figure dans [l’étude UX](03-ux-et-benchmarks.md). Une suppression de composant nécessite une recherche des imports, routes, deep links, notifications et données qu’il porte. Une table n’est pas supprimée parce que son compteur quitte l’accueil.

## 8. Contrat technique à reprendre dans l’implémentation future

La source métier est vérifiée côté serveur ; elle produit une demande durable, puis une seule décision par utilisateur/réalisation/programme. Une version de barème ne doit pas permettre de réclamer une seconde fois le même fait. L’attribution, son quota, la réservation budgétaire et le mouvement de journal doivent être atomiques. L’échange réserve stock et débit ensemble, et revient par compensation idempotente si la réservation échoue. Les règles d’annulation ne retirent jamais des XP pour une dépense de points.

RLS et grants sont deux couches complémentaires ; un rôle service contourne la RLS et reste au serveur. Les verrous doivent couvrir la décision concurrente de quota/dépense, pas seulement la lecture initiale du solde. Ces principes sont documentés par [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) et [PostgreSQL 17, verrous](https://www.postgresql.org/docs/17/explicit-locking.html). Le [changelog Supabase](https://supabase.com/changelog.md) a été consulté ; aucune migration de compatibilité n’est proposée dans cette phase de recherche.

Les fonctions déjà existantes, même testées historiquement, doivent être vérifiées sur le chemin réellement utilisé. Aucune suite applicative ni pgTAP n’a été relancée ici : cette livraison apporte une recherche, des lectures distantes et une simulation, pas une validation de production.

## 9. Accès Git : constat incident à traiter

La lecture initiale du remote local a affiché un jeton GitHub intégré à son URL. Il doit être considéré comme exposé et révoqué, puis remplacé par une authentification via le gestionnaire de credentials. Aucun jeton n’est recopié dans les fichiers de recherche. La configuration Git locale n’a pas été modifiée par cette étude.
