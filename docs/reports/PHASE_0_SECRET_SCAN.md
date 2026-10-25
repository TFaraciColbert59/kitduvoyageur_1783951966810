# PHASE 0 — Scan secrets (P0-C)

**Date :** 2026-09-11
**SHA scanné :** `77825522` (branche `audit/adventure-intelligence`, = `main`)
**Environnement :** worktree Windows, npm 12 / Node 24, dépôt complet (fichiers trackés uniquement)
**Responsable :** agent ORCHESTRATOR (autonome)
**Décision :** `PASS`

## Commandes exécutées

```text
git ls-files | Select-String "\.env"                      # fichiers env trackés
Select-String .gitignore -Pattern "env"                   # couverture gitignore
git grep -l -E <pattern> -- ":!node_modules"              # 9 motifs haute confiance
git grep -l '"role":"service_role"' -- ":!node_modules"   # JWT de rôle service
GET /repos/.../secret-scanning/alerts                     # alertes natives GitHub
```

## Résultats

| Vérification | Résultat |
|---|---|
| Fichiers `.env*` trackés | `.env.example` uniquement (valeurs vides, avertissement explicite) |
| `.gitignore` | couvre `.env`, `.env*.local`, `.env.local`, `.env.production`, `.env.development` |
| `sk-or-v1-`, `sbp_`, `ghp_`, `whsec_`, `AIza…`, clés privées PEM | **0** |
| `sk_live_*` | 7 occurrences, toutes placeholders/docs : `sk_live_abc123` (skill doc), `sk_live_••••` (UI admin masquée), textes de rapports, regex de l'invariant CI |
| `github_pat_` | 9 occurrences, toutes des regex de détection (skills sanitizer, workflows claude-seo) |
| `sk-ant-` | 1 occurrence : regex de détection du plugin Obsidian `realclaudian` (`\\b(sk-ant-?[\\w-]{10,})`) |
| JWT `"role":"service_role"` trackés | **0** |
| JWT `eyJhbGciOi…` (26 fichiers) | fixtures/tests + placeholder CI connu (`ci-build-placeholder`) — aucun service role |
| Alertes GitHub Secret Scanning | API 404 — fonctionnalité non activée (GHAS payant sur dépôt privé) |

## Limites

- Scan des **fichiers trackés** du SHA courant, pas de l'historique Git complet.
- GitHub Secret Scanning natif indisponible (GHAS) : compensé par l'invariant CI
  `ci_invariants.mjs` (blocage `sk_live_`, `whsec_`, `service_role`, `.env*` stagés) et ce scan manuel.
- Les motifs `github_pat_`/`sk-ant-` détectés sont des chaînes de détection, pas des secrets.

## Risques résiduels

- Un secret présent uniquement dans un commit historique supprimé depuis ne serait pas détecté ici.
  Mitigation recommandée (hors Phase 0) : `gitleaks`/`trufflehog` sur l'historique complet lors
  d'une passe sécurité dédiée (Phase 8).

## Artefacts

- `docs/reports/npm-audit-*.json` (audits dépendances)
- `docs/reports/sbom-cyclonedx-20260911.json` (SBOM CycloneDX)
- `docs/reports/licenses-summary-20260911.txt` (inventaire licences)
