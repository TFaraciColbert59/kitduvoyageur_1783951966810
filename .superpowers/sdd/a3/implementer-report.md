# A3 — Profil terrain, difficulté et prédictions — Rapport implémenteur (correctifs de revue)

- Worktree : `C:/Users/Tony/Downloads/LKDV/worktrees/adventure-intelligence`
- Branche : `chantier/adventure-intelligence`
- Date : 2026-09-11
- Revue traitée : `.superpowers/sdd/a3/review.diff`
- Commit des correctifs : `4bb477be5dff1a4344627a984103b82e86dc4f18` — `fix(a3): upsert des versions de profil et flag de prediction transparent`
- Fichiers touchés (4) :
  - `src/features/adventure-intelligence/server/buildUserProfile.ts`
  - `src/features/adventure-intelligence/domain/prediction.ts`
  - `tests/adventure-intelligence/build-profile.server.spec.ts`
  - `tests/adventure-intelligence/prediction-a3.spec.ts`

---

## Task 1 — Upsert idempotent des versions de profil (finding bloquant)

**Constat revue** : `buildUserProfile` appelait `client.insertProfileVersion(row)` inconditionnellement ; la table `user_performance_profile_versions` porte `UNIQUE (profile_id, model_version)`, donc un second build `a3-v1` violait la contrainte.

**Correctif**
- Contrat renommé : `insertProfileVersion` → `upsertProfileVersion(row: unknown): Promise<void>` dans `ProfileBuildClient`.
- Doc comment ajouté sur la méthode : DOIT être idempotent sur `(profile_id, model_version)` (écrase le snapshot existant), avec la note d'implémentation attendue côté adaptateur Supabase : `onConflict: 'profile_id,model_version'`.
- Appel de l'orchestrateur mis à jour vers `upsertProfileVersion` ; comportement (ordre profil → version, statuts `built`/`cold`, mapping colonnes) inchangé.
- En-tête de module corrigé (« snapshot versionné est upserté » au lieu de « inséré ») pour rester cohérent avec la contrainte A1.

**Reviewer Supabase** : aucun adaptateur concret n'existe encore sur cette branche (`rg insertProfileVersion|upsertProfileVersion` ne trouve que l'interface et ses tests) ; le contrat documente la clause `onConflict` à appliquer lors de son écriture.

## Task 2 — Durcissement TEST-A3-BUILD-03 (finding bloquant)

**Problème** : le test comptait 2 inserts (tableau), ce qui valide le contraire de l'idempotence — assertion vacuité.

**Correctif**
- Le fake client simule la sémantique upsert : `versionStore: Map<string, unknown>` clé `` `${profile_id}:${model_version}` ``, plus un compteur d'appels `callCounts.profileVersionUpserts` pour prouver que deux recalculs ont bien appelé le client.
- TEST-A3-BUILD-03 asserte désormais : `profileVersionUpserts === 2`, `versions.size === 1`, et la ligne conservée a bien `profile_id`/`model_version = a3-v1`.
- BUILD-01/02/04 adaptés à la Map (`versions.size`, `versions.get(...)`), y compris l'ordre d'invocation (`upsertProfileVersion`).

## Task 3 — Pass-through du flag `route_prediction_v2` (finding mineur)

**Correctif**
- `predictSegment(..., options?: { pace?: ResolvedPace; flagEnabled?: boolean })` : `flagEnabled` est passé à `resolvePace` (`options?.flagEnabled ?? true`, défaut rétrocompatible).
- Doc comment sur la fonction : les appelants transmettent le flag `route_prediction_v2` ; désactivé, `resolvePace` interdit la source `profile` et retombe sur la cascade sûre générique/standard.
- Aucun changement de `predictRoute` : ses appels internes à `predictSegment` conservent le défaut `true` (hors périmètre de la revue).

**Test ajouté** : `TEST-A3-PRED-11` — avec un profil chaud et `flagEnabled: false`, la durée retombe exactement sur l'allure générique (`10000 m × 13.5 min/km = 8100 s`) et devient strictement supérieure à la version personnalisée ; `flagEnabled: true` explicite est identique au défaut.

---

## Preuves TDD

- **RED** (tests durcis exécutés contre l'implémentation `HEAD~1` restaurée temporairement) :
  - `tests/adventure-intelligence/build-profile.server.spec.ts` → 3 échecs `TypeError: client.insertProfileVersion is not a function` (BUILD-01/02/03).
  - `tests/adventure-intelligence/prediction-a3.spec.ts` → `TEST-A3-PRED-11` : `AssertionError: expected 7200 to be close to 8100` (le flag était ignoré).
  - Total RED : 2 fichiers, 4 échecs / 17.
- **GREEN** (correctifs en place) : `npx vitest run tests/adventure-intelligence` → **14 fichiers, 115 tests passés**.
- `npm run type-check` (`tsc --noEmit`) → **exit 0**.
- `vite`/vitest : LF→CRLF warnings uniquement (préexistants, sans impact).

## Décisions

- Défaut `flagEnabled: true` pour préserver strictement les 10 tests de prédiction existants et tout appelant actuel ; le flag n'est requis que pour les intégrations serveur qui le lisent de `currentAdventureFeatureFlags()`.
- Le fake de test compte les appels ET stocke par clé composite : il démontre à la fois l'appel effectif et l'unicité de la ligne, sans dépendre de `ignoreDuplicates`/`onConflict` réels de Supabase.
- La doc du contrat vit dans l'interface (`buildUserProfile.ts`) et non dans un adaptateur absent : le prochain adaptateur Supabase doit implémenter `.upsert(rows, { onConflict: 'profile_id,model_version' })`.

## Concerns

- Aucun adaptateur `ProfileBuildClient` concret n'existe sur la branche ; le respect de `onConflict` reste donc une obligation de contrat documentée, non vérifiée par un test d'intégration.
- `predictRoute` n'expose pas encore de flag : si le flag `route_prediction_v2` doit couper la personnalisation au niveau route, il faudra propager `flagEnabled` dans `RoutePredictionInput` (hors périmètre de ce correctif).
- Le fichier de ce rapport est sous `.superpowers/` (non suivi par Git), le commit ne contient que les 4 fichiers de code/tests.
