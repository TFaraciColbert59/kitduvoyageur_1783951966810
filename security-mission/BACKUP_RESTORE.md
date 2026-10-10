# BACKUP_RESTORE.md — sauvegardes et restauration (2026-10-09)

## 1. Faits vérifiés (documentés par l'équipe, non re-exécutés ce run)

- Test local exécuté le 2026-09-11 (`docs/reports/A14_BACKUP_RESTORE.md`) : `pg_dump` complet →
  restauration dans une base jetable → **0 erreur**, comptages identiques (223 tables, 629 policies,
  1975 fonctions, tables auth, lignes clés), base jetable supprimée, rollback flags re-testé (6 verts).
- RPO mesuré 0,169 s / RTO 3,827 s sur base locale quasi vide (plancher, pas une mesure prod).
- Finding opérationnel : restauration complète nécessite un rôle équivalent à `supabase_admin`
  (objets possédés par lui) — les procédures prod doivent utiliser un rôle aux droits équivalents.
- **Aucun workflow de sauvegarde dans le dépôt** (`db-backup.yml` absent de main ; le dossier de
  recherche l'annonçait — écart). La sauvegarde prod est supposée gérée par la plateforme (PITR).
- Docker daemon éteint pendant ce run → le test local n'a pas été rejoué (limite honnête).

## 2. Couverture requise vs couverte

| Élément | Couvert ? |
| --- | --- |
| Base Postgres (schéma + données) | oui (dump/restauration testés localement) |
| Rôles/grants/extensions | partiellement (restauration complète via rôle adéquat) |
| **Schémas auth/storage/vault et leurs policies** | **NON — le baseline suivi est `public`-only** (vérifié 2026-10-10 : la reprise de la queue de migrations échoue sur les policies storage absentes, evidence/d1-rls-isolated.md §4) |
| **Objets Storage (octets)** | **non** — un dump Postgres ne contient pas les fichiers des buckets |
| Configs (env, secrets) | non — nécessaire au rétablissement |
| Clés de déchiffrement | non documenté |
| Indépendance en cas de compromission GitHub/cloud | non démontrée |

## 3. Procédure recommandée (à valider D1)

1. Prod : confirmer PITR Supabase + fenêtre de rétention ; exporter périodiquement un dump logique
   chiffré hors plateforme, avec accès indépendant.
2. Storage : exporter les buckets (privés **et** publics) vers un stockage chiffré ; vérifier la
   restauration des octets, pas seulement des métadonnées.
3. Test trimestriel sur projet isolé (jamais in-place) : restaurer base + Storage, vérifier
   comptages + RLS (rôles anon/authenticated) + parcours critiques, mesurer RPO/RTO réels.
4. Après restauration : re-supprimer les données dont l'effacement a été demandé (RETENTION.md).
5. Consigner chaque exercice ; dérive > cible → revue d'infrastructure.
