# RETENTION.md — durées de conservation (proposition à valider, 2026-10-09)

État actuel : la plupart des durées ne sont **pas définies dans le code** (gap privacy majeur).
Les valeurs ci-dessous sont des **propositions** à arbitrer par le responsable (D2), alignées sur les
mécanismes techniques existants. Aucune purge destructive ne doit être activée sans décision.

| Donnée | Mécanisme existant | Proposition | Notes |
| --- | --- | --- | --- |
| Compte + profil | effacement à la demande (route testée localement) | vie du compte + purge sous 30 j après suppression | exceptions légales (factures) |
| Messages + pièces jointes | bucket privé, URLs 24 h | vie du compte ; purge à la suppression | index/caches à inclure |
| Médias groupes (bucket public) | aucune purge | aligner sur le groupe ; **décision F-006** | migration d'URLs si bucket privé |
| GPS live | cron `expire-live-positions` | expiration live (existant) + 30 j max | précision/destinataires |
| Sessions rando/traces | aucune purge | 3 ans par défaut (à valider) ou suppression compte | sert la preuve terrain |
| Documents d'identité de voyage | signés 365 j | purger à la fin du voyage + 90 j | accès propriétaire seul |
| Inventaire/serials | aucune purge | vie du compte | partage token : révocable |
| Commandes/paiements | aucune purge | conservation comptable légale (10 ans FR) | ne pas effacer les factures |
| Rewards/royalties/ledger | aucune purge | vie du compte + 10 ans (obligations) | idempotence conservée |
| Participants médicaux (local) | purge au changement de compte (F-011) | réduction de collecte + chiffrement local (H-036) | données art. 9 potentielles |
| Télémétrie hub | aucune purge | 90 j agrégée / 13 mois max | IP non stockée en clair ? à vérifier |
| Cache IA (`ai_response_cache`) | TTL par feature (1 h → 1 an) | aligner les TTL sur la finalité ; purge planifiée (absente) | clé sans userId (H-021) |
| Logs/erreurs | inconnus | 30 j opérationnels, accès restreint | ne pas logguer PII/tokens |
| Backups | PITR plateforme (à confirmer) | fenêtre ≤ 30 j ; restauration ne doit pas ressusciter un effacement | procédure BACKUP_RESTORE.md |
| Caches SW/locaux | purge compte (F-011) ; tuiles LRU 3000 | n/a | préférences d'appareil conservées |

## Règles de mise en œuvre (proposées)

1. Une durée = un job de purge + une preuve (test) + une trace.
2. Les obligations légales priment : ne jamais supprimer un ordre/facture pour « rendre un test vert ».
3. Effacement : traiter base, Storage, caches, index, files offline, et fournisseurs (Resend ne
   conserve pas d'historique long ; IA : vérifier les politiques de rétention des providers).
4. Backups : documenter que la restauration réintroduit des données supprimées → fenêtre courte +
   procédure de re-suppression post-restauration.
