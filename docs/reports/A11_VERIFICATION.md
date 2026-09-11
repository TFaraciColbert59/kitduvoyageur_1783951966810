# A11 — Rapport de vérification (P1 · Bêta publique)

Date : 2026-09-11 · Branche : `audit/adventure-intelligence` · Dernier commit : `e0faa113`
Statut : **partiel — lots moteurs/sécurité livrés, intégrations produit différées (listées)**

## Lots livrés

| Chantier | Contenu | Commits |
|---|---|---|
| Terrain Live | fusion atomique (`a11_merge_terrain_report`), corroboration unique (`terrain_report_contributors`), course de confirmation → réponse `duplicate`, cache + rate limit conditions, invalidation des agrégats sous seuil, pagination par segment | `21b466f0`, `778068ea`, `57914aaa` |
| Offline V2 | base Dexie **par utilisateur**, purge à la déconnexion, idempotence **SHA-256**, `markSynced` par file, worker de synchronisation (backoff, priorité, dead-letter, reprise, verrou multi-onglets) | `3cd9de2b`, `f347fda8` |
| Rollout | cohortes stables (`feature_flag_cohorts`, `current_feature_flags_for`), exclusions/allowlist, pourcentage | `63f438db` |
| Observabilité | `correlation_id`, `pipeline_version`, timestamps réels des runs, fallback count | `63f438db` |
| Secrets | **clé anon en dur supprimée** (fail-fast comme le serveur) | `3cc5300d` |
| Plans candidats | 3 **plans complets** confort/équilibré/aventure (sections complètes, différenciées, provenance `estimated`), persistés dans le snapshot de version | `a199a884` |
| Météo | prévision réelle via le service existant quand `/generate` reçoit des coordonnées ; sinon skip explicite (jamais inventé) | `0b20cbe6` |
| Backtesting | harnais `npx tsx scripts/ai/a11_backtest.ts <samples.json>` + fixture 40 échantillons + seuil de couverture P90 | `e0faa113` |

## Preuves

| Contrôle | Résultat |
|---|---|
| `npm test` | ✅ 262 fichiers / 1896 tests verts (+1 skip sans env) |
| `type-check` / `lint` | ✅ exit 0 |
| CI GitHub `audit/**` | ✅ success (runs post-a11) |

## Différé (assumé et tracé)

1. **Groupe / trek / entitlements bout-en-bout** (persistance + endpoints + écrans) : nécessite
   un cycle produit UI ; moteurs et contrats prêts depuis a8.
2. **Réglementation / documents / conditions live dans le plan** : aucune source déterministe
   disponible dans le périmètre ; les adaptateurs restent `skipped` avec raisons (aucune donnée inventée).
3. **Rollout opérationnel 20 jours par palier** : cohortes codées, observation humaine requise.
4. **Backtesting sur données réelles** : harnais prêt ; l'export anonymisé dépend de la gate BDD a10.
5. **Parité SQL/TS du bucket de cohorte** et exécution des migrations : gate BDD a10.
6. **Routes** : `currentAdventureFeatureFlags(userId)` applique les cohortes quand un utilisateur
   est fourni ; le câblage systématique côté routes reste à faire (suivi).

## Décisions (règles)

- La production n'a reçu **aucune écriture** ; toute la validation restante se fera sur copie ou
  base locale dès que l'environnement Docker est rétabli.
- Les flags de domaine restent **OFF** (conforme à l'audit et au rollout progressif).
