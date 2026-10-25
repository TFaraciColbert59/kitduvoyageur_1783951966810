# PHASE 0 — Vérification (Réparer et figer la base de livraison)

**Date :** 2026-09-11
**SHA testé (CI verte) :** `cf9a1c79e3093a25097a23656beaf5aef51a2f25`
**Branche :** `audit/adventure-intelligence` = `main`
**Environnement :** GitHub Actions `ubuntu-latest` (Node 22) + poste Windows (Node 24.18.0, npm 12.0.2)
**Responsable :** agent ORCHESTRATOR (autonome, carte blanche utilisateur)
**Décision :** **PASS**

---

## 1. Contexte

Le HEAD initial (`1c570b50`) présentait deux checks rouges (`build` = GitHub Pages/Jekyll,
`visual-tests`) et des gates conditions ignorées (`database-gates`, `visual-gates`).
Objectif Phase 0 : CI totalement verte, gouvernance `main`, scans de base, SHA certifié unique.

## 2. Travaux exécutés et résultats

### 2.1 Document chantier
- `docs/architecture/CHANTIER_LANCEMENT_MONDIAL.md` écrit (13 phases, gates, ordre d'exécution,
  journal de preuve). Commit `a612d7bb` poussé sur `main`.

### 2.2 GitHub Pages désactivé (check `build` rouge)
- Cause : workflow dynamique `pages build and deployment` encore actif malgré `nextjs.yml` en manuel.
- Action : `DELETE /repos/.../pages` → **204**, puis `GET /pages` → **404**.
- Effet vérifié : plus aucun check `build`/`deploy` sur `cf9a1c79`.

### 2.3 Régression visuelle réparée
- **Cause racine :** tous les snapshots commités étaient `*-win32.png` ; la CI Linux cherchait
  `*-linux.png` (« A snapshot doesn't exist »). S'ajoutait un helper d'auth qui lisait `.env`
  (absent en CI) et provoquait ~10 min de retries par test.
- **Correctifs :** mode `workflow_dispatch` + input `update_snapshots` dans
  `.github/workflows/visual-regression.yml` ; skip immédiat de l'auth démo quand `NEXT_PUBLIC_CI=true`.
- **Génération :** snapshots Linux produits **dans la CI elle-même** (run `34653244850`, success),
  artefacts téléchargés, 69 fichiers approuvés et commités (`cf9a1c79`).
- **Résultat :** `visual-tests` = **success** sur `cf9a1c79`.

### 2.4 Sécurité dépendances
| Mesure | Avant | Après |
|---|---:|---:|
| Vulnérabilités prod (critical) | 1 (`next`) | **0** |
| Vulnérabilités prod (high) | 7 | 1 (`postcss`, fix next@16 majeur) |
| Vulnérabilités prod (total) | 13 | 5 |

- `next` 15.5.18 → **15.5.25** (exact) : corrige le critique Next.js App Router (DoS/SSRF/cache).
- `swapy` retiré : licence **GPL-3.0** incompatible, aucun import (NOTICE corrigé).
- `npm audit fix` (non-major) appliqué ; vérifs locales complètes après upgrade.

### 2.5 Scans Phase 0
- **SBOM CycloneDX** : `docs/reports/sbom-cyclonedx-20260911.json` (1,1 Mo, npm sbom).
- **Audits npm** : prod + complet, avant/après correctifs (4 fichiers JSON).
- **Licences** : `docs/reports/licenses-summary-20260911.txt` — MIT/ISC/Apache dominants ;
  points signalés : `react-leaflet` Hippocratic-2.1 (à valider juridiquement en Phase 8),
  `@img/sharp-win32-x64` Apache+LGPL (binaire optionnel), `caniuse-lite` CC-BY-4.0 (attribution).
- **Secrets** : `docs/reports/PHASE_0_SECRET_SCAN.md` — **PASS**, aucun secret dans les fichiers
  trackés, aucun JWT `service_role`, `.env.example` vide, `.gitignore` correct.

### 2.6 Vérifications locales (post-changements)
| Commande | Résultat |
|---|---|
| `npm run type-check` | exit 0 |
| `npm run lint` | exit 0 (warnings préexistants) |
| `npm run test` | exit 0 — **2027 passed** / 20 skipped (284 fichiers) |
| `npm run verify:invariants` | exit 0 |
| `npm run build` (env CI) | exit 0 |

### 2.7 CI sur `cf9a1c79` (preuve finale)

```text
quality-gates    : success (x2)
lighthouse       : success
bundle-analysis  : success
build-ios        : success
visual-tests     : success
database-gates   : skipped (activation Phase 1)
visual-gates     : skipped (opt-in)
pages build      : absent (desactive)
Aucun workflow parasite rouge.
```

## 3. Artefacts

- `docs/reports/PHASE_0_RESULTS.json` (résultats structurés)
- `docs/reports/PHASE_0_ROLLBACK.md` (plan de retour arrière)
- `docs/reports/PHASE_0_SECRET_SCAN.md`
- `docs/reports/sbom-cyclonedx-20260911.json`, `npm-audit-*.json`, `licenses-summary-20260911.txt`
- `docs/architecture/CHANTIER_LANCEMENT_MONDIAL.md`

## 4. Limites

- Snapshots Linux en mode **hermétique** (placeholder Supabase) : captures d'états vides/repli,
  cohérentes et déterministes, mais pas de données seedées. Amélioration prévue après Phase 1.
- `database-gates` non activé (secrets du projet de test absents — Phase 1, bloquée sur PAT complet).
- GitHub Secret Scanning natif indisponible (GHAS payant) ; compensé par invariant CI + scan manuel.
- Scan secrets limité aux fichiers trackés du SHA.

## 5. Risques résiduels

1. `postcss` high — correction exige next@16 (majeur), planifiée hors Phase 0.
2. Token GitHub admin local utilisé pour l'automatisation : rotation recommandée en fin de chantier.
3. PAT Supabase initial sans `projects:write` : un token complet est requis pour créer le projet test.

## 6. Définition de terminé

- Un seul SHA (`cf9a1c79`) identifié, **toutes les preuves CI associées vertes**.
- Tag de certification posé après ce rapport : `g0-certified-20260911` (sur l'arbre final docs inclus).
- Protection de `main` activée en clôture de phase (ruleset PR + checks).

## 7. Décision

**PASS** — la base de livraison est réparée et figée ; les seules gates non vertes sont
explicitement conditionnées à la Phase 1 (`database-gates`) ou à un opt-in (`visual-gates`).
