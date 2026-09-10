# H5 — Rapport de complétion

## État
Matrice 307 pré-existante (`src/lib/hub/hubRedirects.ts`, 24 sources statiques + `/materiel/depart/[id]`, `/groupes/[id]`, `/equipages/[slug]`), spec 17/17 verte — COMPOSÉE, non refaite.

## Fait ce tour
- H5.3 : headers `x-hub-redirect-source` / `x-hub-redirect-target` ajoutés sur chaque 307 (`src/middleware.ts`).

## Gates
- `npx vitest run tests/features/hub/hubRedirects.spec.ts` → 17 passed.
- `npx tsc --noEmit` → 0 erreur.
- Boucle `curl -sI` des 19 redirects : NON EXÉCUTÉE (serveur dev non lancé) — à faire avant PR.

## Conclusion
Phase H5 : VERT code — go/no-go = GO, preuve curl restante (notée NON TESTÉ).
