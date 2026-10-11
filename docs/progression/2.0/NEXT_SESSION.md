# NEXT_SESSION — reprise de l'exécution Progression 2.0

> Mis à jour : 2026-10-11 (après T05). Lire d'abord `docs/progression/2.0/ETAT.md` (statuts, écarts, preuves).

## État au moment du point de reprise

- **P0 terminé** : T01–T04 vérifiés (scan prod 0 anomalie, isolation démo auditée 0 violation,
  sondes 401, restauration isolée rejouée, jobs pg_cron observés en prod à 12:20/12:25/12:30 UTC).
- **T05 terminé** : contrat économique v2 gelé (`registryV2.ts`, 13/13 tests, JSON canonique
  imprimé par `npx tsx scripts/ops/print_progression_registry_v2.ts`).
- Prochaine phase : **P1 — intention durable puis consommateur** (T06 → T07 → T08 → T09).

## Prochaine action concrète — T06 (intention durable avec la source)

1. Migration additive via CLI : table interne `progression_award_intents`
   (user_id, action_type, source_type, source_id, effective_at, state, attempts,
   next_attempt_at, payload refs) — unique sur (source_type, source_id) ;
   schéma non exposé ou RLS sans policy ; grants `service_role` seulement.
2. Relier les transitions finales des 7 producteurs (`producerHooks.ts`) à
   l'insertion atomique de l'intention, puis consommer l'intention (T07) :
   `src/lib/progression-award-requests.ts` reste un déclencheur best-effort
   accélérateur, jamais la seule source de vérité.
3. Tests : coupure entre source et appel (l'intention survit), unicité,
   producteur non finalisé n'écrit rien ; pgTAP atomicité/rollback.
4. Pousser la migration via le workdir isolé, puis observation du consommateur.

## Contrôle de réussite T06

- Rejouer le cas : source commitée puis crash avant consommation → l'intention
  existe, `state='pending'`, et la consommation ultérieure attribue une seule fois
  (une décision, une transaction, un événement).
- `supabase/tests/database/intent_source_atomicity.test.sql` vert sur base locale.
- `npx vitest run tests/features/progression/` vert.

## Règle de continuation

Ne pas relancer l'audit P0 : il est prouvé et daté dans `ETAT.md`. Reprendre à T06,
puis enchaîner T07→T11 sans validation externe (mandat permanent).
