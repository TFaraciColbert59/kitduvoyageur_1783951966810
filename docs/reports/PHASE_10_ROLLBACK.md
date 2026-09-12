# PHASE 10 — Plan de rollback

**Date :** 2026-09-12
**Branche :** `feat/phase10-observability` — base `79bb1ca0` (= `origin/main`, Phase 8)
**Principe :** la Phase 10 est **code + documentation uniquement** : aucune
migration, aucune écriture de données de production, aucun secret, aucun envoi
réseau. Le rollback applicatif est un simple revert ; il n'y a **rien à défaire
en base**.

## 1. Application (rollback recommandé)

```bash
git revert <commit_phase10>   # retour au comportement 79bb1ca0
```

Effets :

- les routes `adventure/generate` et `hike-sessions` reviennent à leur
  comportement précédent (corrélation de corps uniquement, sans en-tête ni
  écho) ; la chaîne Phase 2/3 existante reste intacte en base ;
- les logs structurés ajoutés disparaissent (retour aux `console.*` existants) ;
- les modules `src/lib/observability/*`, les scripts `phase10_*` et les docs
  partent avec le revert ; aucun autre code ne les importe en dehors des deux
  routes (vérifié).

Alternative sans revert : ne pas déployer le commit (aucun impact tant que la
branche n'est pas fusionnée).

## 2. Base de données

- **Aucune migration Phase 10** → aucun `DROP`, aucune colonne, aucune policy à
  retirer.
- `adventure_engine_runs`, `hike_sessions`, `carnets`, `adventure_plans` et
  leurs `correlation_id` existants ne sont ni modifiés ni supprimés par le
  rollback. **Conserver les données** (règle du chantier : ne pas supprimer les
  tables).
- Fixtures locales : les scripts A15/Phase 10 nettoient leurs lignes
  (`a15-load-*@example.invalid`) ; en cas de doute :
  `SELECT count(*) FROM auth.users WHERE email LIKE 'a15-load-%@example.invalid';`
  (attendu : 0).

## 3. Observabilité / alertes

- Le healthcheck A14 et `ops:slo-check` sont **en lecture seule** : les
  désactiver = ne plus les exécuter (cron distant, s'il existe).
- Aucun destinataire d'alerte n'ayant été branché, il n'y a aucun canal à
  couper (`INSUFFICIENT_DATA`).
- Les artefacts JSON de preuve restent dans `docs/reports/` : les conserver
  pour l'audit (aucune PII, aucune donnée de production).

## 4. Mapping avec le rollback du chantier (§12)

| Étape chantier | Application Phase 10 |
|---|---|
| Désactiver le feature flag | `adventure_generate` n'est pas derrière un flag pour ces changements ; revert du commit suffit. Les flags métier Phase 2/3 restent pilotés par `feature_flags` |
| Arrêter les nouvelles générations | hors périmètre (aucun changement du moteur) |
| Conserver les données compatibles | oui — aucune donnée réécrite |
| Ne pas supprimer les tables | oui — aucune table créée/supprimée |
| Restaurer la version applicative | `git revert` (§1) |
| Ouvrir un incident | obligatoire si le rollback est déclenché (règle Phase 12) |
| Post-mortem | obligatoire (règle Phase 12) |
| Reprendre au palier précédent | la Phase 10 ne modifie pas le rollout ; palier inchangé |

## 5. UI / baselines

**Aucune UI modifiée → aucun snapshot visuel à restaurer ni à régénérer.**
Aucune capture, aucun thème, aucune navigation.

## 6. Production et secrets

- Rien n'est déployé à ce stade : branche poussée pour revue, **pas de PR**,
  `main` non touchée.
- Aucun secret introduit ou lu : les scripts n'utilisent que les constantes de
  démonstration locales Supabase (`supabase start`), et refusent toute cible
  non locale sans opt-in explicite.
- Rollback production = ne pas déployer, ou revert si déjà déployé.

## 7. Verdict

- Rollback **trivial et sans risque de perte** (code/docs uniquement).
- Les éléments `INSUFFICIENT_DATA` (destinataires d'alerte, RUM, charge réelle
  10k, métriques de production) ne créent **aucune** dette de rollback : ils
  n'ont jamais été revendiqués comme faits.
