/**
 * Déclaration ambiante minimale : le harnais de recette des fondations
 * (`docs/audit/communaute-v2-2026-11-08/integration/fixtures.mjs`) est du
 * JavaScript sans types. Les données qu'il exporte sont consommées par
 * `tests/e2e/communaute-v2.fixtures.ts` puis re-typées avec les contrats
 * `communityFeedRpc` ; cette déclaration évite un `ts-expect-error` sur
 * l'import (règle : aucune suppression de contrôle de type pour passer).
 */
declare module '*.mjs';
