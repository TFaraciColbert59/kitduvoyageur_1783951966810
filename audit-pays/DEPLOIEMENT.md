# Déploiement & vérification — 25/10/2026

## Build

| Étape | Résultat |
|---|---|
| `npx next build` (propre, `.next` vide, dev arrêté) | **Compiled successfully in 67 s**, tableau `Route (app)` complet |
| Serveur de production local (`next start -p 4002`) | `/pays/fr` 200, `/carnets/[id]` 200, `/compte` 200 |
| `design:fidelity` sur le build local | **19/19** pays · **19/19** carnet · **19/19** compte |

Erreurs corrigées pendant le build :
- `PageNotFoundError` sur toutes les routes : build lancé pendant que `next dev` tournait sur le même `.next` → build propre après arrêt du dev.
- `Type error: Type 'string | null' is not assignable to type 'string | undefined'` (`CarnetProfileView` — `src` de l'anneau à couverture) → `|| undefined`.

## Déploiement

| | |
|---|---|
| URL vérifiée | **https://kitduvoyageur-1783951966810-b9alzaef3.vercel.app** |
| Cible | preview Vercel (projet `kitduvoyageur-1783951966810`), déployée par `vercel deploy` depuis ce worktree |
| Porte sur l'URL déployée | **19/19** `/pays/fr` · **19/19** `/carnets/…011` · **19/19** `/compte` |
| Captures | `deploy-pays-430.png`, `deploy-carnet-430.png` |

Première passe de la porte sur l'URL : 3/19 — la preview était encore froide (première compilation à la demande). Deuxième passe après chauffe : 19/19. À retenir pour toute vérification post-déploiement : **réchauffer la route avant de conclure**.

## Prod Cloudflare

La production réelle est un Worker Cloudflare (`kitduvoyageur.faracitonyp.workers.dev`, déployé depuis la branche `cloudflare/vinext`). Ce worktree est basé sur `main` et ne contient pas la configuration de déploiement Cloudflare (`wrangler.jsonc`, runtime vinext). **La mise en production Cloudflare reste à faire** : rebaser/merger cette branche sur `cloudflare/vinext`, puis `wrangler deploy` (ou la CI de cette branche).

`lekitduvoyageur.fr` renvoie 403 sur ce poste (proxy Zscaler) : la référence et la recette passent par l'URL `workers.dev`.
