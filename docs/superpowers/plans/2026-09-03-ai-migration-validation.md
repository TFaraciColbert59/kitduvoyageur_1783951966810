# Mise en service IA + validation chantier B — Plan

> Superpowers : writing-plans → TDD → verification-before-completion. Chirurgie minimale.

**Goal:** Guider l'application de `20260903000000_ai_foundations.sql` + script de vérification SQL, auditer le câblage du configurateur serveur, combler le trou de test (fallback déterministe si provider en échec).

**Verdict audit préliminaire (Mission 2, à confirmer dans le rapport) :** la route importe
déjà `analyzeKit` depuis `configuratorCore` (pur, zéro client) + `createClient()` serveur ;
`askAI({feature:'kit-configurator'})` ; toute sortie IA passe par `sanitizeAIKitOutput`
(avant retour) ; totaux + insertion `kit_reports` inchangés. Aucun bug browser-in-server.

**Spec:** brief 2026-09-03 (missions 1-3) ; contraintes : chirurgie minimale, rocketCritical et
`eslint.ignoreDuringBuilds` intouchés, aucune régression SSE/legacy.

## Task 1 — Tests manquants (TDD, RED)
**Files:** Test `tests/ai/kitConfigurator.spec.ts`
Ajouter `TEST-KCF-07..09` sur un nouveau helper pur `resolveKitAIOutput` :
- (07) sortie IA valide et 100 % IDs réels → données sanitizées telles quelles, `fabricatedDropped: 0` (couvre « a »).
- (08) texte IA non-JSON / parse impossible → `data = buildDeterministicFallback`, `usedFallback: true`.
- (09) `degraded: true` (provider 429/5xx/noop) → `data = fallback`, `usedFallback: true`, JAMAIS de throw (couvre « c »).
Run → FAIL (helper inexistant).

## Task 2 — Helper `resolveKitAIOutput` (GREEN, extrait de la glue de la route)
**Files:** Modify `src/lib/ai/features/kitConfigurator.ts`
Signature : `resolveKitAIOutput(params: { result: { degraded: boolean; text: string }; sourceable: RealShopProduct[]; sessionParams: KitSessionParams; analysis: KitAnalysis }): { data: KitAIOutput; usedFallback: boolean; fabricatedDropped: number }`.
Logique = celle des lignes 138-156 de la route (extractAIJson reste dans la route OU migre dans le helper — le helper doit rester pur : `extractAIJson` migre aussi). Implémentation minimale → PASS.

## Task 3 — Câblage route (chirurgie minimale)
**Files:** Modify `src/app/api/kit-report/generate/route.ts`
Remplacer le bloc 138-156 par l'appel au helper (comportement identique). Aucun autre changement.

## Task 4 — Gates + rapport
`npm run lint && npm run type-check && npm run build && npm run test` (exit 0 ×4) ; rapport : instructions SQL (SQL Editor, config.toml absent → CLI non liée), script de vérification, verdict Mission 2, fichiers, manuel restant.
