# BASELINE.md — exécutée le 2026-10-09 (session 2)

> **MISE À JOUR 2026-10-10** : les 8 échecs préexistants ci-dessous ont été **diagnostiqués et
> réparés** dans la branche `security/fixes-wave1` (commit « test(ci): reparation des 8 echecs
> preexistants ») — causes racines : time-bomb de date réelle (P015-14), attentes obsolètes vs
> design intentionnel documenté (contraste primary → `--btn-tint-solid`, 4ᵉ couche `sceneBackground`),
> registre IA sans `trajectoire-narration`, tests N7 exigeant un artefact local gitignoré
> (`qa-local/`) contre leur propre doctrine. **Suite complète : 6946 passés, 0 échec, 33 skips.**
> L'historique ci-dessous reste comme référence de la baseline initiale.

## Méthode

- Worktree propre DÉTACHÉ sur `14d80de870930f454096390e1a7f6636fd105750` :
  `C:\Users\Tony\AppData\Local\Temp\opencode\lkdv-baseline` (junction `node_modules` vers le dépôt).
- `.env`/`.env.local` absents du worktree (gitignorés) → aucune clé réelle chargée.
- Variables explicitement vidées en plus : NEXT_PUBLIC_SUPABASE_URL/ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
  STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, OPENROUTER_API_KEY, NVIDIA_API_KEY, GEMINI_API_KEY,
  CRON_SECRET, SEED_SECRET, RESEND_API_KEY, TRAVELPAYOUTS_WEBHOOK_SECRET, NEXT_PUBLIC_SITE_URL.
- Les 4 specs utilisant `fetch(` inspectées avant exécution : loopback/gated localhost — aucun appel
  externe possible. Aucun script seed/ops lancé.

## Résultats

| Porte | Commande | Résultat | Durée |
| --- | --- | --- | --- |
| TypeScript | `npx tsc --noEmit` | **EXIT 0** | 33 s |
| ESLint | `npx next lint` | **EXIT 0** (warnings uniquement) | ~1 min |
| Build | `npx next build` (env placeholders) | **EXIT 0** | ~105 s |
| Tests | `npx vitest run` | **EXIT 1** — 734 fichiers : 725 passed / 5 failed / 4 skipped ; 6943 tests : 6903 passed / 8 failed / 32 skipped | 36 s |

Build : First Load JS partagé 105 kB ; middleware 98.4 kB. Logs conservés dans le worktree
(`vitest-baseline.log`, `lint-baseline.log`, `build-baseline.log`).

## Échecs préexistants (reproduits sur checkout propre — non imputables à un patch)

| Fichier | Cause observée |
| --- | --- |
| `src/features/adventure-prep/__tests__/n7-capture-393x852.test.ts` (3 tests) | corpus/artefact local absent → `expected 0 to be greater than 0` |
| `src/features/adventure-prep/__tests__/start-date-suggestion-p015.test.tsx` (1) | date suggérée → `null` au lieu de `2026-10-05` (dépend du contexte/serveur d'horloge) |
| `tests/ai/registry.spec.ts` (1) | registre réel à 10 features vs 9 attendues (test figé non mis à jour) |
| `tests/design/task-2a-contrast.spec.ts` (2) | tokens de contraste/styles calculés attendus ≠ reçus (G3 / primary) |
| `tests/features/trajectoire/narration.spec.ts` (1) | assertion palette/couleurs (à détailler si repris) |

## Conséquences

- La CI GitHub (`ci.yml` Gate 3 = `npm test`) échouerait sur `14d80de8` tel quel **si** ces échecs n'y
  sont pas neutralisés par un artefact différent → à confirmer côté GitHub (H-019, sans accès distant).
- Toute comparaison avant/après d'un correctif devra s'appuyer sur ces 8 échecs comme référence connue
  (aucun ne doit augmenter) ; aucun test n'a été supprimé ou contourné.
- Réseau : aucun échange externe observé ; tests d'intégration distants = skip (gates absents). Une
  preuve par capture de trafic n'a pas été faite (limite honnête).
