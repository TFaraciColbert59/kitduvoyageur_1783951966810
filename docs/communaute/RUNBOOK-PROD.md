# Runbook — mise en production de la refonte Communauté

**État au 2026-10-22 22:30 :** prêt à déployer, **déploiement impossible depuis cette session**
(voir §1). Tout le reste est vérifié.

---

## 1. Pourquoi le déploiement est bloqué ici

| Chemin | Blocage observé |
|---|---|
| `git push` (GitHub) | `remote: Permission to TFaraciColbert59/kitduvoyageur_1783951966810.git denied` → **403**, credential `osxkeychain` invalide ou mauvais compte |
| `vercel --prod` (CLI 65.1.0) | `> Logged out.` — aucun `VERCEL_TOKEN` dans l'environnement |
| MCP Vercel | outils **lecture seule** (pas de `create deployment`) |
| CI GitHub Actions | aucun job de déploiement (`ci.yml` n'a pas d'étape deploy) |

Le projet Vercel est bien relié au dépôt (`meta.githubCommitRef: "main"` sur le déploiement
`dpl_4Ezm3VRAqzLLhWoGhmngQUGDDn7k`), mais les 4 déploiements de production suivants n'ont pas de
métadonnée git : ils ont été poussés **par la CLI**, pas par un push.

## 2. Pré-vol (déjà vert)

| Vérification | Résultat |
|---|---|
| `npm run type-check` | exit 0 |
| `npx vitest run src/components/compte/drawer/__tests__ src/components/ui/__tests__/CapsuleTabs.test.tsx tests/design/community-social-contract.spec.ts` | 224/224 |
| `npx vitest run tests/design/community-* tests/community tests/design/p5-direction-tokens.spec.ts tests/design/lot2-shell.spec.ts tests/design/m02-destination-registry.spec.ts` | 79/79 |
| `npm run build` | succès (First Load JS partagé : 104 kB) |
| Captures avant/après | `docs/communaute/baseline/` et `docs/communaute/after/` |

## 3. Déployer — chemin A (CLI, le plus court)

```bash
cd /Users/fr168256/Desktop/kitduvoyageur_1783951966810
npx vercel login                 # une seule fois, ouvre le navigateur
npx vercel --prod --yes          # construit et promeut en production
```

Si un token existe déjà :

```bash
VERCEL_TOKEN=xxxxx npx vercel --prod --yes \
  --scope team_lBmtlHsEp3YQAM4hQCaWovPG
```

Le projet lié est `.vercel/project.json` :
`projectId = prj_AqYb1FBEcyNGTZMVimBJXRDulyXp`, `orgId = team_lBmtlHsEp3YQAM4hQCaWovPG`.

## 4. Déployer — chemin B (git)

```bash
git push -u origin chantier/communaute-design
# puis, une fois la branche validée :
git checkout main
git merge --ff-only chantier/communaute-design
git push origin main             # déclenche le déploiement production Vercel
```

⚠️ `main` local contient **4 commits du chantier Compte** non poussés (`2253f1ed`, `17a4a304`,
`f7f4694b`, `48fb3876`) qui partiront avec. Ils sont déjà dans la base de test (build + 224 tests
verts dessus), mais ce n'est pas mon chantier.

## 5. Après déploiement — vérifications

1. `GET /communaute` → 200, capsule d'identité + héro + capsule 48 px visibles.
2. `GET /compte` → 200, **aucune différence visuelle** avec `docs/communaute/baseline/compte-430x932-light.png`.
3. `GET /communaute/decouvrir`, `/communaute/reels`, `/communaute/publier`, `/communaute/post/[id]` → 200.
4. Console navigateur : 0 erreur, 0 warning d'hydratation.
5. Vercel → Runtime Errors (24 h) : 0 nouvelle erreur sur `/communaute`.

## 6. Rollback

Les déploiements de production récents sont tous `READY` et « rollback candidate » :

```bash
npx vercel rollback dpl_CbKxzMzqWr77j3huXYJwZCPektbG   # dernier déploiement avant ce chantier
```

Gabarit : `dpl_CbKxzMzqWr77j3huXYJwZCPektbG` (production, avant la refonte Communauté).
