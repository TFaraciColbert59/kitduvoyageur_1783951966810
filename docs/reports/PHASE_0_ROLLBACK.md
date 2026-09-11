# PHASE 0 — Plan de rollback

**Date :** 2026-09-11
**SHA de référence :** `cf9a1c79` (phase en cours, tag final `g0-certified-*` posé après CI verte)
**Principe :** chaque changement Phase 0 est réversible indépendamment, sans perte de données.

## 1. GitHub Pages désactivé (check `build` rouge)

- **Changement :** `DELETE /repos/.../pages` (workflow dynamique `pages build and deployment` arrêté).
- **Rollback :** Settings → Pages → réactiver (Source : branche), ou API `POST /repos/.../pages`
  avec `{"source":{"branch":"main","path":"/"}}`.
- **Impact rollback :** le check rouge `build` réapparaît — à ne faire que si un usage Pages
  est réellement voulu (la production est servie par Vercel).

## 2. Workflow visuel — mode update + skip auth CI

- **Changement :** `.github/workflows/visual-regression.yml` (+`workflow_dispatch`, +
  upload d'artefact, +`NEXT_PUBLIC_CI` en test), `tests/visual/voyages-y-profiles-visual.spec.ts`
  (early-return auth en CI).
- **Rollback :** `git revert <commit>` — aucun impact runtime.
- **Attention :** sans le mode update, la régénération des snapshots Linux nécessite un run local
  sous Docker Playwright (plateforme Linux).

## 3. Snapshots Linux (`tests/visual/**/*-linux.png`, 69 fichiers)

- **Changement :** ajout des baselines Linux (mode hermétique CI).
- **Rollback :** `git rm tests/visual/**/*-linux.png` → le check visuel redevient rouge
  (comportement d'avant Phase 0). À coordonner avec une régénération.

## 4. Dépendances — next 15.5.25, retrait swapy, `npm audit fix`

- **Changement :** `package.json` / `package-lock.json` (next 15.5.18→15.5.25 exact,
  `swapy` retiré — GPL-3.0 inutilisé, mises à jour transitives non-majeures).
- **Rollback :** `git revert <commit>` + `npm ci`.
- **Attention :** revenir à 15.5.18 réintroduit la vulnérabilité critique Next.js
  (DoS/SSRF App Router, cache confusion). Ne rollback que si régression bloquante prouvée.

## 5. Documents et rapports Phase 0

- **Changement :** `docs/architecture/CHANTIER_LANCEMENT_MONDIAL.md`, `docs/reports/PHASE_0_*`,
  SBOM, audits, licences.
- **Rollback :** sans effet runtime ; `git revert` possible à tout moment.

## 6. Ruleset de protection `main` (dernière étape)

- **Changement :** ruleset branch `main` : PR obligatoire (0 approbation), checks requis
  (`quality-gates`, `lighthouse`, `bundle-analysis`, `build-ios`, `visual-tests`, puis
  `database-gates`), résolution des conversations, force-push/suppression interdits.
- **Rollback :** `DELETE /repos/.../rulesets/{id}` ou désactivation dans Settings → Rules.
- **Impact rollback :** réautorise les pushs directs sur `main` (déconseillé).

## 7. Tag `g0-certified-*`

- **Rollback :** `git push origin :refs/tags/<tag>` + `git tag -d <tag>`.
- Aucun impact code ; le tag est un marqueur de preuve.

## Données

Aucune migration, aucun changement de schéma, aucune donnée modifiée en Phase 0.
Aucun secret ajouté au dépôt (scan P0-C : PASS).
