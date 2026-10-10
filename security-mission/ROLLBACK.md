# ROLLBACK.md — retour arrière (2026-10-09)

Principe : un rollback de code ne rétablit pas l'état de la base. Un `down` destructif n'est jamais
un réflexe ; préférer fix-forward ou compensation validée. Ne jamais réintroduire une faille confirmée.

## 1. Code applicatif

| Correctif | Rollback | Effet |
| --- | --- | --- |
| F-003 (notifications Bearer) | revert `fbc537b2` | rouvre la vulnérabilité → **ne pas rollback** ; si le déclencheur casse, corriger le secret côté appelant |
| H-017 + F-011 (purge client) | revert `7488210f`/`0939b2b6`/`6eb6dd87` | rouvre la rétention inter-comptes → ne pas rollback ; en cas de perte de brouillons signalée, ajuster la liste de clés (fix-forward) |
| F-010 (og-preview) | revert `7c28dffe`/`dab78700` | rouvre SSRF → ne pas rollback ; en cas de preview cassée, élargir cap/allowlist |
| F-008 (migration DB) | **aucun down** : les mots de passe remplacés ne sont pas récupérables | si un compte légitime est touché à tort : reset password utilisateur ; garder la garde temporelle |
| Patches dépendances | revert du bump (lockfile) | rouvre l'avis → planifier un correctif |

## 2. Flags (déjà testés localement — A14)

- `UPDATE public.feature_flags SET enabled=false WHERE id='<flag>'` : rollback fonctionnel sans
  déploiement (preuve : terrain_live OFF→503, ON→pass, OFF→503 ; 6 tests locaux verts le 2026-09-11).
- Après toute opération : vérifier `SELECT count(*) FROM feature_flags WHERE enabled = true` = état
  attendu (tous OFF par défaut).

## 3. Données

- Migrations : expand/contract ; en cas d'erreur, forward-fix idempotent.
- Effacement utilisateur : ne pas restaurer un backup « par-dessus » un effacement — re-supprimer
  après restauration (fenêtre courte).
- Paiements : compensations via Stripe (remboursement) et reverse attribution (RPC existant) —
  jamais d'édition manuelle du ledger sans trace.

## 4. Procédure

1. Identifier le lot (commit) et l'effet observé.
2. Geler la promotion ; ne pas empiler d'autres changements.
3. Appliquer le fix-forward le plus petit ou le revert autorisé (jamais un revert qui rouvre une faille).
4. Relancer typecheck + tests ciblés + suite ; consigner l'incident (INCIDENT_RUNBOOK.md).
