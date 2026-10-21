# HERMES — Mission d'autonomie LKDV (OpenCode + pipeline Ralph)

Statut : actif. Dernière mise à jour : 2026-10-18.
Ce document adapte les documents d'autonomie HERMES au harnais réellement utilisé
(OpenCode, agent principal unique, pipeline d'unités de travail Ralph). Il ne crée
pas de système concurrent : il n'existait aucun `docs/autonomy/` dans le dépôt
au commit `61963cc9`.

## 1. Source de vérité

- Dossier technique maître : `C:\Users\Tony\Downloads\LKDV_Dossier_Technique_Maitre.md`
  (éditions .html/.docx/.pdf au même emplacement) — version 1.0, 2026-10-18.
- Commit audité et figé : `61963cc949a89e6c185629a5d9404bd5c222c352` (branche `main`).
- Archive de code de référence : `C:\Users\Tony\Downloads\LKDV_Code_Reference_Complet\LKDV-reference`
  (+ `validation/`).
- Dépôt : `TFaraciColbert59/kitduvoyageur_1783951966810`.
- Règle : toute exigence se réfère au dossier maître. Ne jamais inventer son contenu.

## 2. Situation de départ constatée (audit du 2026-10-18)

- Le dépôt local est exactement au commit figé du dossier (`61963cc9`).
- `docs/autonomy/` n'existait pas → créé par cette passe.
- `src/features/kit-simulation/` n'existait pas → premier chantier exécutable (KIT-001).
- Contrats d'intégration vérifiés dans le dépôt réel :
  - `enforceRateLimit(identifier, {scope, limit, windowMs, failMode})` — `src/lib/rate-limit/routes.ts:25`.
  - `createClient()` asynchrone — `src/lib/supabase/server.ts:23`.
  - `gear_items.product_id` est `uuid REFERENCES shop_products(id)` —
    `supabase/migrations/20260720110000_gear_items_full_schema_occasion_offers.sql:7`.
  - La CI pgTAP ne collecte que `supabase/tests/database/*.test.sql` (`scripts/db/ci/run_pgtap.sh`).
- Écarts du dossier maître (E01–E18) : suivi dans `TASKS.json` (champ `traceability`).

## 3. Boucle de travail (cycles courts)

1. Relire `TASKS.json` et `EVIDENCE.md` avant de reprendre — ne pas refaire un travail validé.
2. Choisir la première unité `todo` sans dépendance bloquée.
3. Comprendre le code existant avant de modifier.
4. Tests d'abord quand la nature de l'unité le permet, sinon tests immédiatement après.
5. Implémenter le changement minimal cohérent avec l'architecture.
6. Exécuter : tests ciblés → `npm run type-check` → `node scripts/verify/ci_invariants.mjs`
   → lint ciblé. Jamais déclarer « vérifié » sans sortie de commande réelle.
7. Mettre à jour `TASKS.json` (statut) et `EVIDENCE.md` (commandes + résultats observés).
8. Commit explicite sur la branche de travail `chantier/**` ; PR vers `main` quand pertinent.
9. Enchaîner l'unité indépendante suivante sans attendre d'instruction.

## 4. Pipeline par unité (Ralph)

research → plan → implémentation → tests → revue → rapport prêt-à-fusionner.
Gabarit d'unité : `id`, `depends_on`, `scope`, `acceptance_tests`, `risk_level`,
`rollback_plan` (voir `TASKS.json`). Paliers de complexité :
- Tier 1 : fichiers isolés, tests déterministes.
- Tier 2 : comportement multi-fichiers, risque d'intégration modéré.
- Tier 3 : schéma / auth / perf / sécurité.

## 5. Règles de fusion (merge queue)

- Jamais fusionner une unité dont une dépendance a échoué.
- Rebaser la branche sur `main` avant chaque fusion ; re-exécuter les tests ensuite.
- Ne jamais affaiblir une protection de branche pour faciliter la fusion.

## 6. Reprise après interruption

Le registre doit suffire à reprendre sans perte : statut par unité, prochaine action
exacte, blocages avec cause. Si une unité bloque : la sortir de la file active,
consigner les constats, réduire son périmètre, réessayer plus tard. Aucune boucle
illimitée. Aucune affirmation d'exécution en arrière-plan qui ne soit réellement
configurée.

## 7. Budget et limites

- Cible fournisseur modèles : ≤ 20 €/mois — non garantie tant qu'aucun plafond réel
  côté fournisseur n'est vérifié (voir `POLICY.yml`).
- Les opérations payantes (Supabase, Vercel, IA) restent bornées par les budgets du
  dépôt (`src/lib/rate-limit`, coupe-circuits) et les drapeaux serveur.

## 8. Définition de la réussite

Le chantier est terminé lorsque chaque exigence du dossier maître a un statut
explicite (implemented / blocked / out-of-scope) avec preuve exécutée, que les
écarts restants sont recensés et que la livraison respecte les protections du
dépôt. Un plan écrit ou un build vert ne suffit pas.
